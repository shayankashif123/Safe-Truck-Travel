"""
The brief's risk tables, transcribed as data.

This file is the only place thresholds live. The logic that applies them is in
classification.py. Edge handling follows docs/DECISIONS.md R1: a band's lower
bound is inclusive unless the brief uses an explicit ">".
"""

from dataclasses import dataclass
from itertools import pairwise

from trips.domain.levels import RiskLevel


@dataclass(frozen=True, slots=True)
class Band:
    """A value reaches `level` when it is >= `lower` (or > `lower` if not inclusive)."""

    level: RiskLevel
    lower: float
    inclusive: bool = True

    def contains(self, value: float) -> bool:
        return value >= self.lower if self.inclusive else value > self.lower


def ascending(*bands: Band) -> tuple[Band, ...]:
    """A threshold table, checked once at import to run from mildest to worst."""
    for lower, higher in pairwise(bands):
        if not (higher.level > lower.level and higher.lower >= lower.lower):
            raise ValueError("risk bands must be ordered from mildest to worst")
    return bands


# Anything below the first band of a table is LOW.

WIND_BANDS_MPH = ascending(
    Band(RiskLevel.MODERATE, 25),
    Band(RiskLevel.HIGH, 35),
    Band(RiskLevel.SEVERE, 45),
    Band(RiskLevel.NO_TRAVEL, 55),  # ">=55 mph -> No Travel for any load"
)

RAIN_BANDS_IN_PER_HR = ascending(
    Band(RiskLevel.MODERATE, 0.10),
    Band(RiskLevel.HIGH, 0.25),
    Band(RiskLevel.SEVERE, 0.50),
    Band(RiskLevel.NO_TRAVEL, 1.00, inclusive=False),  # brief: ">1.00"
)

SNOW_BANDS_IN_PER_HR = ascending(
    Band(RiskLevel.MODERATE, 0.5),
    Band(RiskLevel.HIGH, 1.0),
    Band(RiskLevel.SEVERE, 2.0),
    Band(RiskLevel.NO_TRAVEL, 3.0, inclusive=False),  # brief: ">3.0"
)


@dataclass(frozen=True, slots=True)
class LoadEscalation:
    """When the *unadjusted* wind level is `wind_level` and the load exceeds
    `load_over_lb`, the wind level is raised to `raised_to`."""

    wind_level: RiskLevel
    load_over_lb: float
    raised_to: RiskLevel


# Expressed against the wind bands above so the mph ranges are defined once:
# the SEVERE wind band is exactly 45-54 mph and the HIGH band exactly 35-44 mph.
LOAD_ESCALATIONS: tuple[LoadEscalation, ...] = (
    LoadEscalation(RiskLevel.SEVERE, 30_000, RiskLevel.NO_TRAVEL),  # 45-54 mph + >30,000 lb
    LoadEscalation(RiskLevel.HIGH, 40_000, RiskLevel.SEVERE),  # 35-44 mph + >40,000 lb
)
