"""The heatmap's fast path must agree exactly with the checkpoint risk path."""

import random
from datetime import UTC, datetime, timedelta

import pytest

from trips.domain.classification import assess_risk
from trips.domain.forecast import HourlyForecast
from trips.domain.levels import RiskLevel
from trips.domain.risk_timeline import hourly_risk_levels

START = datetime(2026, 11, 7, 0, 0, tzinfo=UTC)
HOURS = 72

# Values on and around every threshold in the brief, plus the load-rule bands.
WIND = [0.0, 5.0, 24.9, 25.0, 34.9, 35.0, 44.9, 45.0, 54.9, 55.0, 70.0]
RAIN = [0.0, 0.09, 0.1, 0.25, 0.49, 0.5, 1.0, 1.01, 2.0]
SNOW = [0.0, 0.49, 0.5, 1.0, 1.99, 2.0, 3.0, 3.01, 4.0]


def random_forecast(rng: random.Random) -> HourlyForecast:
    def series(values):
        # Mostly realistic repeats, some gaps (None) like a forecast running out.
        return tuple(None if rng.random() < 0.03 else rng.choice(values) for _ in range(HOURS))

    return HourlyForecast(
        start_epoch=int(START.timestamp()),
        wind_mph=series(WIND),
        gust_mph=series(WIND),
        rain_in_per_hr=series(RAIN),
        snow_in_per_hr=series(SNOW),
    )


def reference(forecast, start, hours, load_lb):
    levels = []
    for h in range(hours):
        sample = forecast.sample_at(start + timedelta(hours=h))
        levels.append(assess_risk(sample, load_lb).level if sample else None)
    return tuple(levels)


@pytest.mark.parametrize("seed", range(40))
def test_matches_assess_risk_for_every_hour(seed):
    rng = random.Random(seed)
    forecast = random_forecast(rng)
    # Departures at awkward minutes, including :30 (the nearest-hour tie) and
    # before the series starts; loads on both sides of the 30,000/40,000 lb rules.
    start = START + timedelta(minutes=rng.choice([-90, 0, 1, 29, 30, 31, 59, 61, 600, 1439]))
    load = rng.choice([0, 30_000, 30_001, 40_000, 40_001, 80_000])

    assert hourly_risk_levels(forecast, start, 49, load) == reference(forecast, start, 49, load)


def test_hours_beyond_the_forecast_are_no_data_not_low():
    forecast = HourlyForecast(
        start_epoch=int(START.timestamp()),
        wind_mph=(5.0,) * 3,
        gust_mph=(5.0,) * 3,
        rain_in_per_hr=(0.0,) * 3,
        snow_in_per_hr=(0.0,) * 3,
    )

    levels = hourly_risk_levels(forecast, START, 5, 20_000)

    assert levels[0] == RiskLevel.LOW
    assert levels[-1] is None
