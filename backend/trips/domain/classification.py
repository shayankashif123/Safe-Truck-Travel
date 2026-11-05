"""Risk for a single checkpoint: the worst of wind (load-adjusted), rain and snow."""

import math
from collections.abc import Sequence
from dataclasses import dataclass
from enum import StrEnum

from trips.domain.levels import RiskLevel
from trips.domain.rules import (
    LOAD_ESCALATIONS,
    RAIN_BANDS_IN_PER_HR,
    SNOW_BANDS_IN_PER_HR,
    WIND_BANDS_MPH,
    Band,
)


class Factor(StrEnum):
    WIND = "wind"
    RAIN = "rain"
    SNOW = "snow"


@dataclass(frozen=True, slots=True)
class WeatherSample:
    """Forecast conditions at one place and hour, already in the brief's units."""

    wind_mph: float
    rain_in_per_hr: float
    snow_in_per_hr: float
    gust_mph: float | None = None  # shown to the driver, never scored (docs/DECISIONS.md R2)


@dataclass(frozen=True, slots=True)
class RiskAssessment:
    level: RiskLevel
    wind: RiskLevel  # after load escalation
    rain: RiskLevel
    snow: RiskLevel
    load_escalated: bool

    @property
    def drivers(self) -> tuple[Factor, ...]:
        """The factors responsible for the overall level (none when it is LOW)."""
        if self.level == RiskLevel.LOW:
            return ()
        factors = ((Factor.WIND, self.wind), (Factor.RAIN, self.rain), (Factor.SNOW, self.snow))
        return tuple(factor for factor, level in factors if level == self.level)


def classify(value: float, bands: Sequence[Band]) -> RiskLevel:
    """Highest level whose band the value reaches; LOW if it reaches none."""
    _require_non_negative(value, "value")
    # Tables are verified mildest-to-worst at import (rules.ascending), so the
    # first match from the worst end is the answer. This runs ~20,000 times per
    # trip for the heatmap, so it avoids generators.
    for band in reversed(bands):
        if band.contains(value):
            return band.level
    return RiskLevel.LOW


def wind_level_for_load(wind_mph: float, load_lb: float) -> tuple[RiskLevel, bool]:
    """
    Wind level after the load rules, and whether a rule raised it.

    Escalations are matched against the unadjusted level only, so they never
    chain: 40 mph with 50,000 lb becomes SEVERE, not NO_TRAVEL.
    """
    _require_non_negative(load_lb, "load_lb")
    base = classify(wind_mph, WIND_BANDS_MPH)
    level = base
    for rule in LOAD_ESCALATIONS:
        if rule.wind_level == base and load_lb > rule.load_over_lb:
            # max() guarantees a rule can only raise the level, never lower it.
            level = max(level, rule.raised_to)
    return level, level > base


def assess_risk(sample: WeatherSample, load_lb: float) -> RiskAssessment:
    wind, load_escalated = wind_level_for_load(sample.wind_mph, load_lb)
    rain = classify(sample.rain_in_per_hr, RAIN_BANDS_IN_PER_HR)
    snow = classify(sample.snow_in_per_hr, SNOW_BANDS_IN_PER_HR)
    return RiskAssessment(
        level=max(wind, rain, snow),
        wind=wind,
        rain=rain,
        snow=snow,
        load_escalated=load_escalated,
    )


def _require_non_negative(value: float, name: str) -> None:
    if not math.isfinite(value) or value < 0:
        raise ValueError(f"{name} must be a finite, non-negative number (got {value!r})")
