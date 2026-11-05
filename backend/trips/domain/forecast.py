"""
Hourly forecast for one location, and how a truck's ETA maps onto it.

Time alignment (docs/DECISIONS.md T2):
- Wind is an instantaneous reading at each timestamp, so the nearest
  timestamp is used.
- Rain and snow at a timestamp are totals for the hour *ending* there, so the
  hour bucket that contains the ETA is used: an ETA of 14:20 reads the 15:00
  value, which covers 14:00-15:00.
"""

import math
from dataclasses import dataclass
from datetime import datetime

from trips.domain.classification import WeatherSample

HOUR_S = 3600

Series = tuple[float | None, ...]


@dataclass(frozen=True, slots=True)
class HourlyForecast:
    start_epoch: int  # UTC timestamp of the first entry; entries are one hour apart
    wind_mph: Series
    gust_mph: Series
    rain_in_per_hr: Series
    snow_in_per_hr: Series

    def __post_init__(self) -> None:
        if self.start_epoch % HOUR_S:
            raise ValueError("forecast must start on a whole UTC hour")
        lengths = {
            len(s) for s in (self.wind_mph, self.gust_mph, self.rain_in_per_hr, self.snow_in_per_hr)
        }
        if len(lengths) != 1 or 0 in lengths:
            raise ValueError("forecast series must be non-empty and the same length")

    @property
    def hours(self) -> int:
        return len(self.wind_mph)

    def sample_at(self, at: datetime) -> WeatherSample | None:
        """Conditions at `at`, or None when the forecast does not cover it."""
        if at.tzinfo is None:
            raise ValueError("`at` must be timezone-aware")

        offset_h = (at.timestamp() - self.start_epoch) / HOUR_S
        nearest = math.floor(offset_h + 0.5)  # half-up, not banker's rounding
        bucket_end = math.floor(offset_h) + 1

        wind = _at(self.wind_mph, nearest)
        rain = _at(self.rain_in_per_hr, bucket_end)
        snow = _at(self.snow_in_per_hr, bucket_end)
        if wind is None or rain is None or snow is None:
            return None
        return WeatherSample(
            wind_mph=wind,
            rain_in_per_hr=rain,
            snow_in_per_hr=snow,
            gust_mph=_at(self.gust_mph, nearest),
        )


def floor_hour(moment: datetime) -> datetime:
    return moment.replace(minute=0, second=0, microsecond=0)


def _at(series: Series, index: int) -> float | None:
    return series[index] if 0 <= index < len(series) else None
