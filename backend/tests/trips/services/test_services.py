from datetime import UTC, datetime, timedelta

import pytest
from django.core.exceptions import ImproperlyConfigured

from trips.domain.forecast import HourlyForecast
from trips.domain.geo import LatLng
from trips.domain.routes import ProgressMark, Route
from trips.domain.weather_grid import cell_for
from trips.providers.tomtom import Place, PlaceSuggestion
from trips.services import clients
from trips.services.places import resolve_place, suggest_places
from trips.services.routing import truck_routes
from trips.services.time_zones import time_zone_at
from trips.services.weather import FETCH_HORIZON, forecasts_for_cells

START = datetime(2026, 11, 7, 14, 0, tzinfo=UTC)
END = START + timedelta(hours=2)
DALLAS = LatLng(32.7767, -96.797)
DENVER = LatLng(39.7392, -104.9903)


class FakeWeather:
    def __init__(self):
        self.calls: list[list[LatLng]] = []
        self.windows: list[tuple[datetime, datetime]] = []

    def hourly_forecasts(self, locations, start, end):
        self.calls.append(list(locations))
        self.windows.append((start, end))
        return [
            HourlyForecast(int(start.timestamp()), (5.0,), (8.0,), (0.0,), (0.0,))
            for _ in locations
        ]


class FakeTomTom:
    def __init__(self):
        self.calls = 0

    def calculate_routes(self, origin, destination, depart_at):
        self.calls += 1
        return [
            Route((origin, destination), (ProgressMark(0, 0, 0), ProgressMark(1, 10, 1)), 10, 1)
        ]

    def suggest_places(self, query):
        self.calls += 1
        return [PlaceSuggestion("id1", "areas", query.title(), "United States")]

    def place_details(self, kind, place_id):
        self.calls += 1
        return Place(place_id, "Denver, CO", "United States", DENVER)


# --- Weather -------------------------------------------------------------------


def test_each_distinct_cell_is_requested_once():
    weather = FakeWeather()
    same_cell = [cell_for(LatLng(39.76, -104.99)), cell_for(LatLng(39.99, -104.76))]
    other_cell = cell_for(DALLAS)

    result = forecasts_for_cells([*same_cell, other_cell], START, END, client=weather)

    assert len(weather.calls) == 1  # one batched request
    assert len(weather.calls[0]) == 2  # two distinct cells
    assert set(result) == {same_cell[0], other_cell}


def test_repeat_request_is_served_from_cache():
    weather = FakeWeather()
    cells = [cell_for(DALLAS), cell_for(DENVER)]

    forecasts_for_cells(cells, START, END, client=weather)
    again = forecasts_for_cells(cells, START, END, client=weather)

    assert len(weather.calls) == 1
    assert set(again) == set(cells)


def test_only_uncached_cells_are_fetched():
    weather = FakeWeather()
    forecasts_for_cells([cell_for(DALLAS)], START, END, client=weather)

    forecasts_for_cells([cell_for(DALLAS), cell_for(DENVER)], START, END, client=weather)

    assert weather.calls[1] == [cell_for(DENVER).center]


def test_a_different_departure_inside_the_horizon_reuses_the_fetch():
    weather = FakeWeather()
    forecasts_for_cells([cell_for(DALLAS)], START, END, now=START, client=weather)

    forecasts_for_cells(
        [cell_for(DALLAS)],
        START + timedelta(hours=5),
        END + timedelta(hours=5),
        now=START,
        client=weather,
    )

    assert len(weather.calls) == 1


def test_fetch_window_starts_now_and_spans_the_full_horizon():
    weather = FakeWeather()
    now = START - timedelta(hours=3, minutes=20)

    forecasts_for_cells([cell_for(DALLAS)], START, END, now=now, client=weather)

    start, end = weather.windows[0]
    assert start == START - timedelta(hours=4)  # current hour, floored
    assert end == start + FETCH_HORIZON


def test_window_beyond_the_horizon_extends_the_fetch():
    weather = FakeWeather()
    late_end = START + FETCH_HORIZON + timedelta(hours=6)

    forecasts_for_cells([cell_for(DALLAS)], START, late_end, now=START, client=weather)

    assert weather.windows[0][1] == late_end


# --- Routing -------------------------------------------------------------------


def test_same_trip_within_the_same_minute_reuses_routes():
    tomtom = FakeTomTom()

    truck_routes(DALLAS, DENVER, START, client=tomtom)
    truck_routes(DALLAS, DENVER, START + timedelta(seconds=40), client=tomtom)

    assert tomtom.calls == 1


def test_different_departure_minute_fetches_new_routes():
    tomtom = FakeTomTom()

    truck_routes(DALLAS, DENVER, START, client=tomtom)
    truck_routes(DALLAS, DENVER, START + timedelta(minutes=1), client=tomtom)

    assert tomtom.calls == 2


# --- Places --------------------------------------------------------------------


def test_suggestions_ignore_case_and_extra_spaces():
    tomtom = FakeTomTom()

    suggest_places("Denver", client=tomtom)
    suggest_places("  denver ", client=tomtom)

    assert tomtom.calls == 1


def test_resolved_places_are_cached():
    tomtom = FakeTomTom()

    resolve_place("areas", "abc", client=tomtom)
    place = resolve_place("areas", "abc", client=tomtom)

    assert tomtom.calls == 1
    assert place.position == DENVER


# --- Configuration -------------------------------------------------------------


def test_missing_tomtom_key_fails_with_a_clear_message(settings):
    settings.TOMTOM_API_KEY = ""
    clients.tomtom_client.cache_clear()
    try:
        with pytest.raises(ImproperlyConfigured, match="TOMTOM_API_KEY"):
            clients.tomtom_client()
    finally:
        clients.tomtom_client.cache_clear()


# --- Time zones ---------------------------------------------------------------


@pytest.mark.parametrize(
    ("place", "zone"),
    [
        (LatLng(32.7767, -96.797), "America/Chicago"),  # Dallas
        (LatLng(39.7392, -104.9903), "America/Denver"),  # Denver
        (LatLng(31.7619, -106.485), "America/Denver"),  # El Paso: Texas, but Mountain time
        (LatLng(33.4484, -112.074), "America/Phoenix"),  # Arizona: no daylight saving
        (LatLng(47.5615, -52.7126), "America/St_Johns"),  # Newfoundland: UTC-3:30
    ],
)
def test_time_zone_at_finds_the_local_zone(place, zone):
    assert time_zone_at(place) == zone


# --- Route display line -------------------------------------------------------------


def test_each_route_is_simplified_once_and_then_served_from_cache(monkeypatch):
    from tests.factories import straight_route
    from trips.services import routing

    calls = []
    real = routing.simplify
    monkeypatch.setattr(routing, "simplify", lambda pts, tol: calls.append(1) or real(pts, tol))
    route = straight_route()

    first = routing.display_points(route)
    again = routing.display_points(straight_route())  # equal content, new object

    assert first == again == [route.points[0], route.points[-1]]
    assert len(calls) == 1


def test_different_routes_get_their_own_display_line():
    from tests.factories import straight_route
    from trips.services.routing import display_points

    assert display_points(straight_route(length_deg=1)) != display_points(
        straight_route(length_deg=2)
    )


def test_invalid_place_reference_is_rejected_before_the_provider_is_touched(monkeypatch):
    from trips.domain.errors import InvalidInput
    from trips.services import places

    def no_client():
        raise AssertionError("the provider client must not be created for invalid input")

    monkeypatch.setattr(places, "tomtom_client", no_client)

    with pytest.raises(InvalidInput):
        places.resolve_place("users", "abc")
