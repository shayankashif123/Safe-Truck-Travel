from datetime import UTC, datetime, timedelta

import pytest

from trips.domain.forecast import HourlyForecast

T0 = datetime(2026, 11, 7, 14, 0, tzinfo=UTC)

# Index:      0 (14:00)  1 (15:00)  2 (16:00)
FORECAST = HourlyForecast(
    start_epoch=int(T0.timestamp()),
    wind_mph=(10.0, 20.0, 30.0),
    gust_mph=(15.0, 25.0, None),
    rain_in_per_hr=(0.01, 0.02, 0.03),  # total for the hour ending at each timestamp
    snow_in_per_hr=(0.1, 0.2, 0.3),
)


def at(minutes: int) -> datetime:
    return T0 + timedelta(minutes=minutes)


@pytest.mark.parametrize(
    ("minutes", "wind", "precip_hour"),
    [
        (0, 10.0, 1),  # 14:00: wind now; rain for 14:00-15:00 (labelled 15:00)
        (20, 10.0, 1),  # 14:20: wind nearest 14:00; rain bucket 14:00-15:00
        (29, 10.0, 1),
        (30, 20.0, 1),  # 14:30: half-up rounding picks 15:00 for wind
        (59, 20.0, 1),
        (60, 20.0, 2),  # 15:00: new rain bucket 15:00-16:00
        (80, 20.0, 2),
    ],
)
def test_wind_uses_nearest_hour_and_precipitation_uses_containing_hour(minutes, wind, precip_hour):
    sample = FORECAST.sample_at(at(minutes))

    assert sample.wind_mph == wind
    assert sample.rain_in_per_hr == FORECAST.rain_in_per_hr[precip_hour]
    assert sample.snow_in_per_hr == FORECAST.snow_in_per_hr[precip_hour]


def test_gust_is_carried_along_but_may_be_missing():
    assert FORECAST.sample_at(at(0)).gust_mph == 15.0
    assert FORECAST.sample_at(at(110)).gust_mph is None  # 15:50 -> nearest 16:00


@pytest.mark.parametrize("minutes", [-31, 120])  # before the window / no bucket after 16:00
def test_returns_none_outside_the_forecast(minutes):
    assert FORECAST.sample_at(at(minutes)) is None


def test_returns_none_when_a_scored_value_is_missing():
    gappy = HourlyForecast(
        start_epoch=int(T0.timestamp()),
        wind_mph=(10.0, None),
        gust_mph=(None, None),
        rain_in_per_hr=(0.0, 0.0),
        snow_in_per_hr=(0.0, 0.0),
    )

    assert gappy.sample_at(at(50)) is None  # wind at 15:00 is missing


def test_rejects_naive_time():
    with pytest.raises(ValueError):
        FORECAST.sample_at(datetime(2026, 11, 7, 14, 0))


def test_rejects_series_of_different_lengths():
    with pytest.raises(ValueError):
        HourlyForecast(int(T0.timestamp()), (1.0,), (1.0, 2.0), (0.0,), (0.0,))


def test_rejects_start_that_is_not_a_whole_hour():
    with pytest.raises(ValueError):
        HourlyForecast(int(T0.timestamp()) + 60, (1.0,), (1.0,), (0.0,), (0.0,))
