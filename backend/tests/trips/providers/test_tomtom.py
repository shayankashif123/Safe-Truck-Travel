import json
from datetime import UTC, datetime, timedelta, timezone

import httpx
import pytest

from trips.domain.geo import LatLng
from trips.domain.routes import ProgressMark
from trips.providers.errors import (
    NoRouteFound,
    ProviderBadResponse,
    ProviderRateLimited,
    ProviderRejected,
    ProviderUnavailable,
)
from trips.providers.tomtom import BASE_URL, TomTomClient

KEY = "test-key-123"
DALLAS = LatLng(32.7767, -96.797)
DENVER = LatLng(39.7392, -104.9903)
DEPART = datetime(2026, 11, 7, 14, 0, tzinfo=UTC)


@pytest.fixture
def tomtom(server):
    return TomTomClient(KEY, http=server.client(BASE_URL))


# --- Routing: request ----------------------------------------------------------


def test_route_request_asks_for_truck_routes_with_alternatives_and_progress(
    tomtom, server, load_fixture
):
    server.reply(json=load_fixture("tomtom_routes.json"))

    tomtom.calculate_routes(DALLAS, DENVER, DEPART)

    request = server.requests[0]
    params = request.url.params
    assert request.url.path == "/routing/1/calculateRoute/32.7767,-96.797:39.7392,-104.9903/json"
    assert params["travelMode"] == "truck"
    assert params["vehicleCommercial"] == "true"
    assert params["maxAlternatives"] == "2"
    assert params["departAt"] == "2026-11-07T14:00:00Z"
    assert params.get_list("extendedRouteRepresentation") == ["distance", "travelTime"]
    assert "vehicleWeight" not in params  # load is applied by our risk rules only


def test_departure_is_sent_in_utc(tomtom, server, load_fixture):
    server.reply(json=load_fixture("tomtom_routes.json"))
    chicago_time = datetime(2026, 11, 7, 8, 0, tzinfo=timezone(timedelta(hours=-6)))

    tomtom.calculate_routes(DALLAS, DENVER, chicago_time)

    assert server.requests[0].url.params["departAt"] == "2026-11-07T14:00:00Z"


def test_rejects_naive_departure(tomtom):
    with pytest.raises(ValueError):
        tomtom.calculate_routes(DALLAS, DENVER, datetime(2026, 11, 7, 14, 0))


# --- Routing: response ---------------------------------------------------------


def test_parses_every_route_with_its_distance_time_profile(tomtom, server, load_fixture):
    server.reply(json=load_fixture("tomtom_routes.json"))

    routes = tomtom.calculate_routes(DALLAS, DENVER, DEPART)

    assert len(routes) == 2
    first = routes[0]
    assert first.points[0] == LatLng(32.77667, -96.79699)
    assert len(first.points) == 4
    assert first.progress[1] == ProgressMark(point_index=2, distance_m=1900, travel_time_s=150)
    assert (first.length_m, first.duration_s) == (3000, 240)


def test_no_route_found_is_a_distinct_error(tomtom, server):
    server.reply(
        400,
        {"detailedError": {"code": "NO_ROUTE_FOUND", "message": "No valid route found"}},
    )

    with pytest.raises(NoRouteFound):
        tomtom.calculate_routes(DALLAS, DENVER, DEPART)


def test_other_client_errors_are_rejections(tomtom, server):
    server.reply(400, {"detailedError": {"code": "INVALID_REQUEST"}})

    with pytest.raises(ProviderRejected) as error:
        tomtom.calculate_routes(DALLAS, DENVER, DEPART)

    assert error.value.status == 400


@pytest.mark.parametrize(
    ("status", "expected"),
    [
        (401, ProviderUnavailable),
        (403, ProviderUnavailable),
        (429, ProviderRateLimited),
        (503, ProviderUnavailable),
    ],
)
def test_maps_http_failures(tomtom, server, status, expected):
    server.reply(status, {})

    with pytest.raises(expected):
        tomtom.calculate_routes(DALLAS, DENVER, DEPART)


def test_timeout_error_never_exposes_the_key(tomtom, server):
    server.fail_with(httpx.ReadTimeout("timed out"))

    with pytest.raises(ProviderUnavailable) as error:
        tomtom.calculate_routes(DALLAS, DENVER, DEPART)

    assert KEY not in str(error.value)
    assert error.value.__suppress_context__  # httpx error (which holds the URL) is dropped


def test_inconsistent_route_is_a_bad_response(tomtom, server, load_fixture):
    body = load_fixture("tomtom_routes.json")
    body["routes"][0]["progress"].pop()  # profile no longer reaches the destination
    server.reply(json=body)

    with pytest.raises(ProviderBadResponse):
        tomtom.calculate_routes(DALLAS, DENVER, DEPART)


def test_non_json_response_is_a_bad_response(tomtom, server):
    server.reply(text="<html>gateway</html>")

    with pytest.raises(ProviderBadResponse):
        tomtom.calculate_routes(DALLAS, DENVER, DEPART)


# --- Places --------------------------------------------------------------------


def test_suggest_request_uses_places_api_headers_and_country_filter(tomtom, server, load_fixture):
    server.reply(json=load_fixture("tomtom_suggest.json"))

    tomtom.suggest_places("denv")

    request = server.requests[0]
    assert request.method == "POST"
    assert request.url.path == "/maps/orbis/places/suggest"
    assert request.headers["TomTom-Api-Key"] == KEY
    assert request.headers["TomTom-Api-Version"] == "3"
    assert json.loads(request.content) == {
        "query": "denv",
        "maxResults": 6,
        "filters": {"countryCodesIso2": ["US", "CA"]},
    }


def test_suggestions_skip_entries_without_a_location(tomtom, server, load_fixture):
    server.reply(json=load_fixture("tomtom_suggest.json"))

    suggestions = tomtom.suggest_places("d")

    assert [(s.kind, s.id, s.title, s.subtitle) for s in suggestions] == [
        ("areas", "T2ME35qKUleNLKiycGnySA", "Denver, CO", "United States"),
        (
            "addresses",
            "-CauVp9VQF6mZ5ZfKjzrXQ",
            "1600 Penn Street",
            "Malta, OH 43758, United States",
        ),
    ]


def test_place_details_reads_geojson_lng_lat_order(tomtom, server, load_fixture):
    server.reply(json=load_fixture("tomtom_place.json"))

    place = tomtom.place_details("areas", "T2ME35qKUleNLKiycGnySA")

    assert server.requests[0].url.path == "/maps/orbis/places/details/areas/T2ME35qKUleNLKiycGnySA"
    assert place.position == LatLng(39.738453, -104.984853)
    assert place.title == "Denver, CO"


@pytest.mark.parametrize(
    ("kind", "place_id"), [("users", "abc"), ("areas", "../keys"), ("areas", "")]
)
def test_place_details_rejects_unsafe_references_without_calling_tomtom(
    tomtom, server, kind, place_id
):
    with pytest.raises(ValueError):
        tomtom.place_details(kind, place_id)

    assert server.requests == []


def test_requires_an_api_key():
    with pytest.raises(ValueError):
        TomTomClient("")
