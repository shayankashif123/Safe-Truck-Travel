"""
Turns checkpoint levels along one route into miles per level and average risk.

Rules (docs/DECISIONS.md K1, K3, T5):
- Each stretch between consecutive checkpoints takes the worse of its two
  endpoint levels, and its full length counts toward that level.
- A stretch touching a checkpoint without forecast data counts as "no data",
  never as Low.
- Average risk is the distance-weighted mean level score over stretches that
  have data.
"""

from dataclasses import dataclass
from itertools import pairwise

from trips.domain.levels import RiskLevel


@dataclass(frozen=True, slots=True)
class RoutePoint:
    mile: float  # distance from the origin along the route
    level: RiskLevel | None  # None when no forecast is available for this point


@dataclass(frozen=True, slots=True)
class RouteRiskSummary:
    miles_by_level: dict[RiskLevel, float]
    no_data_miles: float
    average_risk: float | None  # None when no stretch has data

    def miles(self, level: RiskLevel) -> float:
        return self.miles_by_level.get(level, 0.0)

    @property
    def total_miles(self) -> float:
        return sum(self.miles_by_level.values()) + self.no_data_miles

    @property
    def worst_level(self) -> RiskLevel | None:
        """The highest level any stretch reaches; None when no stretch has data."""
        return max((lvl for lvl, miles in self.miles_by_level.items() if miles > 0), default=None)


def summarize_route(points: list[RoutePoint]) -> RouteRiskSummary:
    if len(points) < 2:
        raise ValueError("A route needs at least two points (origin and destination).")

    miles_by_level = dict.fromkeys(RiskLevel, 0.0)
    no_data_miles = 0.0

    for start, end in pairwise(points):
        length = end.mile - start.mile
        if length < 0:
            raise ValueError("Route points must be ordered by increasing mile.")
        if start.level is None or end.level is None:
            no_data_miles += length
        else:
            miles_by_level[max(start.level, end.level)] += length

    known_miles = sum(miles_by_level.values())
    average_risk = (
        sum(level * miles for level, miles in miles_by_level.items()) / known_miles
        if known_miles > 0
        else None
    )
    return RouteRiskSummary(miles_by_level, no_data_miles, average_risk)
