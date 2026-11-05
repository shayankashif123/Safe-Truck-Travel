import pytest

from trips.domain.levels import RiskLevel
from trips.domain.scoring import RoutePoint, summarize_route

LOW, MODERATE, HIGH, SEVERE, NO_TRAVEL = RiskLevel


def route(*points):
    return [RoutePoint(mile, level) for mile, level in points]


def test_stretch_takes_the_worse_endpoint_level():
    summary = summarize_route(route((0, LOW), (25, SEVERE)))

    assert summary.miles(SEVERE) == 25
    assert summary.miles(LOW) == 0


def test_short_final_stretch_counts_its_real_length():
    summary = summarize_route(route((0, LOW), (25, LOW), (37, HIGH)))

    assert summary.miles(LOW) == 25
    assert summary.miles(HIGH) == 12
    assert summary.total_miles == 37


def test_average_risk_is_distance_weighted():
    # 25 mi at Low (0) and 12 mi at High (2): (0*25 + 2*12) / 37
    summary = summarize_route(route((0, LOW), (25, LOW), (37, HIGH)))

    assert summary.average_risk == pytest.approx(24 / 37)


def test_every_mile_is_counted_exactly_once():
    points = route((0, LOW), (25, MODERATE), (50, HIGH), (75, SEVERE), (100, NO_TRAVEL), (110, LOW))
    summary = summarize_route(points)

    assert summary.total_miles == 110
    assert summary.miles(MODERATE) == 25
    assert summary.miles(HIGH) == 25
    assert summary.miles(SEVERE) == 25
    assert summary.miles(NO_TRAVEL) == 35


def test_missing_forecast_is_counted_as_no_data_never_low():
    summary = summarize_route(route((0, LOW), (25, LOW), (50, None)))

    assert summary.miles(LOW) == 25
    assert summary.no_data_miles == 25
    assert summary.average_risk == 0


def test_average_risk_is_none_without_any_data():
    summary = summarize_route(route((0, None), (25, None)))

    assert summary.no_data_miles == 25
    assert summary.average_risk is None


def test_requires_origin_and_destination():
    with pytest.raises(ValueError):
        summarize_route(route((0, LOW)))


def test_rejects_points_out_of_order():
    with pytest.raises(ValueError):
        summarize_route(route((0, LOW), (30, LOW), (20, LOW)))
