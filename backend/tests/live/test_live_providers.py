"""
Contract checks against the real APIs. Skipped by default; run with:

    pytest -m live

They catch provider changes the offline fixtures cannot (renamed fields,
changed units, revoked keys).
"""

import math
from datetime import UTC, datetime, timedelta

import pytest
from django.conf import settings

from trips.domain.geo import LatLng
from trips.providers.open_meteo import OpenMeteoClient
from trips.providers.tomtom import TomTomClient

pytestmark = pytest.mark.live

DALLAS = LatLng(32.7767, -96.797)
DENVER = LatLng(39.7392, -104.9903)
METERS_PER_MILE = 1609.344


def next_whole_hour() -> datetime:
    now = datetime.now(UTC)
    return now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)


@pytest.fixture
def tomtom():
    if not settings.TOMTOM_API_KEY:
        pytest.skip("TOMTOM_API_KEY is not set")
    return TomTomClient(settings.TOMTOM_API_KEY)


def test_open_meteo_returns_complete_hourly_series():
    start = next_whole_hour()

    forecasts = OpenMeteoClient().hourly_forecasts(
        [DENVER, DALLAS], start, start + timedelta(hours=5)
    )

    assert len(forecasts) == 2
    for forecast in forecasts:
        assert forecast.start_epoch == int(start.timestamp())
        assert forecast.hours == 6
        assert all(v is not None and v >= 0 for v in forecast.wind_mph)


def test_tomtom_suggest_and_resolve_a_city(tomtom):
    suggestions = tomtom.suggest_places("denv")
    denver = next(s for s in suggestions if s.title == "Denver, CO")

    place = tomtom.place_details(denver.kind, denver.id)

    assert math.isclose(place.position.lat, DENVER.lat, abs_tol=0.2)
    assert math.isclose(place.position.lng, DENVER.lng, abs_tol=0.2)


def test_tomtom_truck_routes_have_a_full_time_profile(tomtom):
    routes = tomtom.calculate_routes(DALLAS, DENVER, next_whole_hour())

    assert 1 <= len(routes) <= 3
    for route in routes:
        assert 700 < route.length_m / METERS_PER_MILE < 1100
        assert route.progress[-1].travel_time_s == pytest.approx(route.duration_s, abs=60)
