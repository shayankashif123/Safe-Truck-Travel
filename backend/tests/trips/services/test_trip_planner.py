from datetime import UTC, datetime, timedelta

import pytest

from tests.factories import FakeRouting, FieldWeather, straight_route
from trips.domain.errors import InvalidInput
from trips.domain.forecast import floor_hour
from trips.domain.geo import LatLng
from trips.domain.levels import RiskLevel
from trips.domain.ranking import Criterion
from trips.domain.weather_grid import cell_for
from trips.providers.errors import NoRouteFound
from trips.services.trip_planner import HEATMAP_FRAMES, TripRequest, plan_trip

NOW = datetime(2026, 11, 7, 13, 0, tzinfo=UTC)
DEPARTURE = NOW + timedelta(hours=1)

# Two routes 1 degree (~69 mi) apart, so their 20-mile corridors never overlap.
SOUTH = straight_route(start=LatLng(35.0, -100.0), length_deg=1.0, hours=1.0)
NORTH = straight_route(start=LatLng(36.0, -100.0), length_deg=1.2, hours=1.5)


def windy_south(location, moment):
    """Severe wind (47 mph) around the southern route, calm elsewhere."""
    return 47.0 if location.lat < 35.5 else 5.0


def request(**overrides) -> TripRequest:
    fields = {
        "origin": LatLng(35.5, -100.0),
        "destination": LatLng(35.5, -99.0),
        "departure": DEPARTURE,
        "load_lb": 20_000,
        "spacing_mi": 10,
    } | overrides
    return TripRequest(**fields)


def plan(req=None, *, routes=(SOUTH, NORTH), weather=None, now=NOW):
    weather = weather or FieldWeather(windy_south)
    return plan_trip(
        req or request(),
        now=now,
        routing_client=FakeRouting(list(routes)),
        weather_client=weather,
    )


# --- Recommendation ---------------------------------------------------------


def test_recommends_the_route_with_fewer_severe_miles_even_if_slower():
    result = plan()

    assert result.ranking.recommended.route_id == "B"  # NORTH: 1.5 h but calm
    south = next(o for o in result.ranking.ranked if o.route_id == "A")
    assert result.ranking.deciding_criterion(south) == Criterion.SEVERE_MILES


def test_route_ids_follow_the_providers_order():
    assert [r.id for r in plan().routes] == ["A", "B"]


def test_heavy_load_turns_severe_wind_into_no_travel():
    result = plan(request(load_lb=35_000))

    south = result.routes[0]
    assert {c.level for c in south.checkpoints} == {RiskLevel.NO_TRAVEL}
    assert all(c.assessment.load_escalated for c in south.checkpoints)
    assert result.ranking.all_routes_blocked is False


def test_all_routes_blocked_when_every_route_has_no_travel():
    everywhere_windy = FieldWeather(lambda loc, moment: 60.0)

    result = plan(weather=everywhere_windy)

    assert result.ranking.all_routes_blocked is True


# --- Checkpoints and time -----------------------------------------------------


def test_checkpoint_etas_are_departure_plus_driving_time():
    south = plan().routes[0]

    assert south.checkpoints[0].eta == DEPARTURE
    assert south.checkpoints[-1].eta == DEPARTURE + timedelta(hours=1)


def test_weather_is_read_at_each_checkpoints_eta():
    # Hourly wind: 14:00 calm, 15:00 storm (50 mph). The 1-hour southern trip
    # leaves at 14:00. Wind uses the nearest hour, so checkpoints reached before
    # 14:30 read 14:00 (calm) and those from 14:30 on read 15:00 (storm).
    storm_hour = DEPARTURE + timedelta(hours=1)
    weather = FieldWeather(lambda loc, moment: 50.0 if moment >= storm_hour else 5.0)
    halfway = DEPARTURE + timedelta(minutes=30)

    south = plan(weather=weather).routes[0]

    early = [c for c in south.checkpoints if c.eta < halfway]
    late = [c for c in south.checkpoints if c.eta >= halfway]
    assert early and all(c.level == RiskLevel.LOW for c in early)
    assert late and all(c.level == RiskLevel.SEVERE for c in late)


def test_missing_forecast_becomes_no_data_not_low():
    weather = FieldWeather(missing_from=DEPARTURE + timedelta(minutes=30))

    south = plan(weather=weather).routes[0]

    assert south.checkpoints[-1].level is None
    assert south.risk.no_data_miles > 0


def test_one_weather_request_covers_every_checkpoint_and_heatmap_frame():
    weather = FieldWeather(windy_south)

    plan(weather=weather)

    assert len(weather.windows) == 1  # one batched fetch for the whole trip
    start, end = weather.windows[0]
    assert start <= floor_hour(DEPARTURE)
    assert end >= floor_hour(DEPARTURE + timedelta(hours=HEATMAP_FRAMES - 1)) + timedelta(hours=1)
    assert len(weather.locations) == len(set(weather.locations))  # no cell twice


# --- Heatmap ---------------------------------------------------------------------


def test_heatmap_has_a_level_for_every_cell_and_frame():
    result = plan()

    heatmap = result.heatmap
    assert heatmap.start == DEPARTURE
    assert heatmap.resolution_deg == 0.25
    assert all(len(cell.levels) == HEATMAP_FRAMES for cell in heatmap.cells)


def test_heatmap_includes_every_checkpoint_cell():
    result = plan()

    heatmap_cells = {c.cell for c in result.heatmap.cells}
    for route in result.routes:
        for checkpoint in route.checkpoints:
            assert cell_for(checkpoint.checkpoint.position, 0.25) in heatmap_cells


def test_heatmap_frames_change_over_time_and_apply_the_load_rules():
    storm_at = DEPARTURE + timedelta(hours=10)
    weather = FieldWeather(lambda loc, moment: 47.0 if moment >= storm_at else 5.0)

    result = plan(request(load_lb=35_000), weather=weather)

    levels = result.heatmap.cells[0].levels
    assert levels[9] == RiskLevel.LOW
    assert levels[10] == RiskLevel.NO_TRAVEL  # 47 mph + 35,000 lb


# --- Validation -------------------------------------------------------------------


@pytest.mark.parametrize(
    "departure",
    [
        NOW - timedelta(minutes=10),  # in the past
        NOW + timedelta(days=7, minutes=1),  # beyond the forecast range
        datetime(2026, 11, 7, 14, 0),  # no timezone
    ],
)
def test_rejects_unusable_departure_times(departure):
    with pytest.raises(InvalidInput):
        plan(request(departure=departure))


def test_departure_a_few_minutes_ago_means_now():
    result = plan(request(departure=NOW - timedelta(minutes=2)))

    assert result.departure == NOW


def test_rejects_identical_origin_and_destination():
    with pytest.raises(InvalidInput):
        plan(request(destination=LatLng(35.5001, -100.0)))


def test_no_routes_from_the_provider_is_no_route_found():
    with pytest.raises(NoRouteFound):
        plan(routes=())
