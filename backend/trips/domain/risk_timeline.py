"""
Risk level of one place, hour by hour: the heatmap's inner loop.

    hourly_risk_levels(forecast, start, hours, load_lb)[h]
        == assess_risk(forecast.sample_at(start + h hours), load_lb).level

(None where the forecast has no data). The heatmap evaluates this ~10,000
times per trip (49 hours x ~200 cells), so it skips the per-hour sample and
assessment objects and reuses the level of values it has already classified:
most hours have exactly 0.0 rain and 0.0 snow. Measured at about half the CPU
of a cached trip request before this existed; equivalence with assess_risk is
property-tested in tests/trips/domain/test_risk_timeline.py.
"""

from datetime import datetime, timedelta

from trips.domain.classification import classify, wind_level_for_load
from trips.domain.forecast import HourlyForecast
from trips.domain.levels import RiskLevel
from trips.domain.rules import RAIN_BANDS_IN_PER_HR, SNOW_BANDS_IN_PER_HR

_HOUR = timedelta(hours=1)


def hourly_risk_levels(
    forecast: HourlyForecast, start: datetime, hours: int, load_lb: float
) -> tuple[RiskLevel | None, ...]:
    wind_memo: dict[float, RiskLevel] = {}
    rain_memo: dict[float, RiskLevel] = {}
    snow_memo: dict[float, RiskLevel] = {}

    levels: list[RiskLevel | None] = []
    for h in range(hours):
        # Same index arithmetic as HourlyForecast.sample_at, so results match exactly.
        nearest, bucket_end = forecast.indices_at(start + h * _HOUR)
        wind = _at(forecast.wind_mph, nearest)
        rain = _at(forecast.rain_in_per_hr, bucket_end)
        snow = _at(forecast.snow_in_per_hr, bucket_end)
        if wind is None or rain is None or snow is None:
            levels.append(None)
            continue

        wind_level = wind_memo.get(wind)
        if wind_level is None:
            wind_level = wind_memo[wind] = wind_level_for_load(wind, load_lb)[0]
        rain_level = rain_memo.get(rain)
        if rain_level is None:
            rain_level = rain_memo[rain] = classify(rain, RAIN_BANDS_IN_PER_HR)
        snow_level = snow_memo.get(snow)
        if snow_level is None:
            snow_level = snow_memo[snow] = classify(snow, SNOW_BANDS_IN_PER_HR)

        levels.append(max(wind_level, rain_level, snow_level))
    return tuple(levels)


def _at(series: tuple[float | None, ...], index: int) -> float | None:
    return series[index] if 0 <= index < len(series) else None
