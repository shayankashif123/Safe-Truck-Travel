import pytest

from trips.domain.levels import RiskLevel
from trips.domain.ranking import Criterion, RouteOption, rank_routes
from trips.domain.scoring import RouteRiskSummary

HOUR = 3600


def option(route_id, *, hours=10.0, no_travel=0.0, no_data=0.0, severe=0.0, high=0.0, average=0.0):
    miles = dict.fromkeys(RiskLevel, 0.0) | {
        RiskLevel.NO_TRAVEL: no_travel,
        RiskLevel.SEVERE: severe,
        RiskLevel.HIGH: high,
    }
    return RouteOption(route_id, hours * HOUR, RouteRiskSummary(miles, no_data, average))


def ids(ranking):
    return [o.route_id for o in ranking.ranked]


def test_no_travel_miles_outrank_everything():
    blocked = option("blocked", no_travel=5)
    severe = option("severe", severe=200, high=300, average=2.5, hours=20)

    ranking = rank_routes([blocked, severe])

    assert ids(ranking) == ["severe", "blocked"]
    assert ranking.deciding_criterion(blocked) == Criterion.NO_TRAVEL_MILES


def test_a_forecast_gap_never_makes_a_route_look_safest():
    # Route "gap" has no Severe miles only because 60 of its miles have no forecast.
    gap = option("gap", no_data=60, average=0.0)
    known = option("known", severe=40, average=1.5)

    ranking = rank_routes([gap, known])

    assert ids(ranking) == ["known", "gap"]
    assert ranking.deciding_criterion(gap) == Criterion.NO_DATA_MILES


def test_no_travel_still_outranks_missing_forecasts():
    ranking = rank_routes([option("blocked", no_travel=1), option("gap", no_data=100)])

    assert ranking.recommended.route_id == "gap"
    assert ranking.deciding_criterion(ranking.ranked[1]) == Criterion.NO_TRAVEL_MILES


def test_fewer_severe_miles_beat_a_much_faster_route():
    fast = option("fast", severe=10, hours=8)
    safe = option("safe", severe=0, high=50, hours=13)

    ranking = rank_routes([fast, safe])

    assert ranking.recommended.route_id == "safe"
    assert ranking.deciding_criterion(fast) == Criterion.SEVERE_MILES


def test_high_miles_decide_when_severe_is_tied():
    ranking = rank_routes([option("a", severe=5, high=40), option("b", severe=5, high=10)])

    assert ids(ranking) == ["b", "a"]
    assert ranking.deciding_criterion(ranking.ranked[1]) == Criterion.HIGH_MILES


def test_average_risk_decides_when_severe_and_high_are_tied():
    ranking = rank_routes([option("a", average=1.2), option("b", average=0.8)])

    assert ids(ranking) == ["b", "a"]
    assert ranking.deciding_criterion(ranking.ranked[1]) == Criterion.AVERAGE_RISK


def test_duration_decides_only_when_all_risk_is_tied():
    ranking = rank_routes([option("slow", hours=12), option("quick", hours=11)])

    assert ids(ranking) == ["quick", "slow"]
    assert ranking.deciding_criterion(ranking.ranked[1]) == Criterion.DURATION


def test_floating_point_noise_does_not_decide():
    # 12.0000001 vs 12.0 Severe miles are equal after rounding, so duration decides.
    noisy = option("noisy", severe=12.0000001, hours=9)
    clean = option("clean", severe=12.0, hours=10)

    assert rank_routes([clean, noisy]).recommended.route_id == "noisy"


def test_travel_times_within_the_same_minute_are_a_tie():
    # 15 seconds apart and both shown as "10 h": not a reason to recommend.
    first = option("first", hours=10 + 25 / HOUR)
    second = option("second", hours=10 + 10 / HOUR)

    ranking = rank_routes([first, second])

    assert ids(ranking) == ["first", "second"]
    assert ranking.deciding_criterion(ranking.ranked[1]) is None


def test_full_tie_keeps_provider_order():
    ranking = rank_routes([option("first"), option("second")])

    assert ids(ranking) == ["first", "second"]
    assert ranking.deciding_criterion(ranking.ranked[1]) is None


def test_missing_average_risk_ranks_last_on_that_criterion():
    unknown = option("unknown", average=None)
    known = option("known", average=3.9)

    assert rank_routes([unknown, known]).recommended.route_id == "known"


def test_all_routes_blocked_when_every_route_has_no_travel_miles():
    ranking = rank_routes([option("a", no_travel=3), option("b", no_travel=12)])

    assert ranking.all_routes_blocked is True
    assert ranking.recommended.route_id == "a"


def test_not_blocked_when_one_route_is_clear():
    assert rank_routes([option("a", no_travel=3), option("b")]).all_routes_blocked is False


def test_requires_at_least_one_route():
    with pytest.raises(ValueError):
        rank_routes([])
