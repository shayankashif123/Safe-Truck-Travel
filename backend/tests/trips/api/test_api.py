from datetime import UTC, datetime, timedelta

import pytest
from rest_framework.test import APIClient

from tests.factories import FakeRouting, FieldWeather, straight_route
from trips.domain.geo import LatLng
from trips.providers.errors import NoRouteFound, ProviderRateLimited, ProviderUnavailable
from trips.providers.tomtom import Place, PlaceSuggestion
from trips.services.trip_planner import HEATMAP_FRAMES

PLAN_URL = "/api/trips/plan/"


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def fake_providers(monkeypatch):
    routing = FakeRouting(
        [
            straight_route(start=LatLng(35.0, -100.0), length_deg=1.0, hours=1.0),
            straight_route(start=LatLng(36.0, -100.0), length_deg=1.2, hours=1.5),
        ]
    )
    weather = FieldWeather(lambda loc, moment: 47.0 if loc.lat < 35.5 else 5.0)
    monkeypatch.setattr("trips.services.routing.tomtom_client", lambda: routing)
    monkeypatch.setattr("trips.services.weather.open_meteo_client", lambda: weather)
    return routing, weather


def payload(**overrides):
    departure = (datetime.now(UTC) + timedelta(hours=1)).isoformat().replace("+00:00", "Z")
    return {
        "origin": {"lat": 35.5, "lng": -100.0},
        "destination": {"lat": 35.5, "lng": -99.0},
        "departure": departure,
        "load_lb": 20_000,
        "spacing_mi": 25,
    } | overrides


# --- Trip plan: success --------------------------------------------------------


def test_plan_returns_ranked_routes_with_checkpoints_and_heatmap(api, fake_providers):
    response = api.post(PLAN_URL, payload(), format="json")

    assert response.status_code == 200
    body = response.json()
    assert body["recommended_route_id"] == "B"
    assert body["all_routes_blocked"] is False
    assert [r["id"] for r in body["routes"]] == ["B", "A"]  # ranked order
    assert [r["rank"] for r in body["routes"]] == [1, 2]

    best, other = body["routes"]
    assert best["recommended"] is True and best["decided_by"] is None
    assert other["decided_by"] == "severe_miles"
    assert other["risk"]["worst_level"] == "severe"
    assert set(other["risk"]["miles_by_level"]) == {
        "low",
        "moderate",
        "high",
        "severe",
        "no_travel",
    }


def test_checkpoints_use_geojson_order_and_string_levels(api, fake_providers):
    body = api.post(PLAN_URL, payload(), format="json").json()

    checkpoint = body["routes"][1]["checkpoints"][1]
    lng, lat = checkpoint["position"]
    assert -100 < lng < -99 and 34.9 < lat < 35.1
    assert checkpoint["level"] == "severe"
    assert checkpoint["drivers"] == ["wind"]
    assert checkpoint["weather"]["wind_mph"] == 47.0
    assert checkpoint["eta"].endswith("Z")


def test_geometry_is_simplified_for_the_browser(api, fake_providers):
    body = api.post(PLAN_URL, payload(), format="json").json()

    geometry = body["routes"][0]["geometry"]
    assert len(geometry) == 2  # a straight line needs only its endpoints


def test_heatmap_is_compact_integers_per_frame(api, fake_providers):
    heatmap = api.post(PLAN_URL, payload(), format="json").json()["heatmap"]

    assert heatmap["frames"] == HEATMAP_FRAMES
    assert heatmap["resolution_deg"] == 0.25
    cell = heatmap["cells"][0]
    assert set(cell) == {"row", "col", "levels"}
    assert len(cell["levels"]) == HEATMAP_FRAMES
    assert all(level in (0, 1, 2, 3, 4, None) for level in cell["levels"])


def test_solo_driver_is_the_default_and_stops_are_reported(api, monkeypatch):
    # 12 h of driving: a solo driver breaks at 8 h and rests at 11 h.
    long_route = straight_route(start=LatLng(35.0, -100.0), length_deg=12.0, hours=12.0)
    monkeypatch.setattr("trips.services.routing.tomtom_client", lambda: FakeRouting([long_route]))
    monkeypatch.setattr("trips.services.weather.open_meteo_client", lambda: FieldWeather())

    body = api.post(PLAN_URL, payload(spacing_mi=50), format="json").json()

    assert body["driver"] == "solo"
    (route,) = body["routes"]
    assert route["driving_duration_s"] == 12 * 3600
    assert route["trip_duration_s"] == 22.5 * 3600
    assert [s["kind"] for s in route["stops"]] == ["break", "rest"]
    rest = route["stops"][1]
    assert set(rest) == {"kind", "mile", "position", "start", "end"}
    assert rest["start"].endswith("Z") and rest["end"].endswith("Z")


def test_team_driver_has_no_stops(api, fake_providers):
    body = api.post(PLAN_URL, payload(driver="team"), format="json").json()

    assert body["driver"] == "team"
    assert all(r["stops"] == [] for r in body["routes"])
    assert all(r["trip_duration_s"] == r["driving_duration_s"] for r in body["routes"])


# --- Trip plan: validation -----------------------------------------------------


@pytest.mark.parametrize(
    ("override", "field"),
    [
        ({"spacing_mi": 30}, "spacing_mi"),
        ({"load_lb": -1}, "load_lb"),
        ({"load_lb": 100_001}, "load_lb"),
        ({"departure": "tomorrow"}, "departure"),
        ({"origin": {"lat": 95, "lng": 0}}, "origin"),
        ({"driver": "convoy"}, "driver"),
    ],
)
def test_invalid_fields_are_reported_per_field(api, override, field):
    response = api.post(PLAN_URL, payload(**override), format="json")

    assert response.status_code == 400
    body = response.json()
    assert body["code"] == "invalid_request"
    assert field in body["fields"]


def test_past_departure_is_a_readable_400(api, fake_providers):
    past = (datetime.now(UTC) - timedelta(hours=2)).isoformat()

    response = api.post(PLAN_URL, payload(departure=past), format="json")

    assert response.status_code == 400
    assert response.json() == {
        "code": "invalid_request",
        "detail": "Departure time is in the past.",
    }


# --- Trip plan: provider failures -------------------------------------------------


@pytest.mark.parametrize(
    ("error", "status", "code"),
    [
        (NoRouteFound("TomTom", "x"), 422, "no_route"),
        (ProviderRateLimited("Open-Meteo", "x"), 503, "provider_busy"),
        (ProviderUnavailable("TomTom", "x"), 503, "provider_unavailable"),
    ],
)
def test_provider_failures_map_to_stable_error_codes(api, monkeypatch, error, status, code):
    def fail(_request):
        raise error

    monkeypatch.setattr("trips.api.views.plan_trip", fail)

    response = api.post(PLAN_URL, payload(), format="json")

    assert response.status_code == status
    assert response.json()["code"] == code


def test_rate_limited_response_tells_the_client_when_to_retry(api, monkeypatch):
    def fail(_request):
        raise ProviderRateLimited("Open-Meteo", "x")

    monkeypatch.setattr("trips.api.views.plan_trip", fail)

    response = api.post(PLAN_URL, payload(), format="json")

    assert response["Retry-After"] == "60"


# --- Places -----------------------------------------------------------------------


def test_suggest_returns_place_suggestions(api, monkeypatch):
    monkeypatch.setattr(
        "trips.api.views.suggest_places",
        lambda q: [PlaceSuggestion("abc", "areas", "Denver, CO", "United States")],
    )

    response = api.get("/api/places/suggest/", {"q": "denv"})

    assert response.json() == {
        "results": [
            {"id": "abc", "kind": "areas", "title": "Denver, CO", "subtitle": "United States"}
        ]
    }


def test_suggest_skips_the_provider_for_one_character(api, monkeypatch):
    def must_not_be_called(_q):
        raise AssertionError("provider called")

    monkeypatch.setattr("trips.api.views.suggest_places", must_not_be_called)

    assert api.get("/api/places/suggest/", {"q": " d "}).json() == {"results": []}


def test_place_detail_returns_geojson_position(api, monkeypatch):
    monkeypatch.setattr(
        "trips.api.views.resolve_place",
        lambda kind, pid: Place(pid, "Denver, CO", "United States", LatLng(39.74, -104.98)),
    )

    body = api.get("/api/places/areas/abc/").json()

    assert body == {
        "id": "abc",
        "title": "Denver, CO",
        "subtitle": "United States",
        "position": [-104.98, 39.74],
    }


def test_place_detail_rejects_unknown_kinds(api):
    response = api.get("/api/places/users/abc/")

    assert response.status_code == 400
    assert response.json()["code"] == "invalid_request"
