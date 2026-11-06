"""
Route recommendation (docs/DECISIONS.md K2, K4, K5, K8, K10).

Routes are ordered strictly by, in priority order:
    No Travel miles -> miles without a forecast -> Severe miles -> High miles
    -> average risk -> travel time
Lower is better on every criterion. A later criterion only matters when all
earlier ones are equal. Miles without a forecast rank right after No Travel so
that a gap in the data can never be what makes a route look safest.
"""

import math
from collections.abc import Sequence
from dataclasses import dataclass
from enum import StrEnum

from trips.domain.levels import RiskLevel
from trips.domain.scoring import RouteRiskSummary

# Values are rounded before comparison so floating-point noise (e.g. 12.0000001
# vs 12.0 Severe miles) cannot decide a recommendation, and to the precision
# the UI shows, so an explanation never reads "12 h 48 min vs 12 h 48 min".
MILES_DECIMALS = 1
AVERAGE_RISK_DECIMALS = 2
DURATION_UNIT_S = 60  # whole minutes


class Criterion(StrEnum):
    NO_TRAVEL_MILES = "no_travel_miles"
    NO_DATA_MILES = "no_data_miles"
    SEVERE_MILES = "severe_miles"
    HIGH_MILES = "high_miles"
    AVERAGE_RISK = "average_risk"
    DURATION = "duration"


@dataclass(frozen=True, slots=True)
class RouteOption:
    route_id: str
    duration_s: float
    risk: RouteRiskSummary


def criteria(option: RouteOption) -> dict[Criterion, float]:
    """The comparable value of each criterion, in priority order."""
    risk = option.risk
    average = risk.average_risk if risk.average_risk is not None else math.inf
    return {
        Criterion.NO_TRAVEL_MILES: round(risk.miles(RiskLevel.NO_TRAVEL), MILES_DECIMALS),
        Criterion.NO_DATA_MILES: round(risk.no_data_miles, MILES_DECIMALS),
        Criterion.SEVERE_MILES: round(risk.miles(RiskLevel.SEVERE), MILES_DECIMALS),
        Criterion.HIGH_MILES: round(risk.miles(RiskLevel.HIGH), MILES_DECIMALS),
        Criterion.AVERAGE_RISK: round(average, AVERAGE_RISK_DECIMALS),
        Criterion.DURATION: round(option.duration_s / DURATION_UNIT_S),
    }


def ranking_key(option: RouteOption) -> tuple[float, ...]:
    return tuple(criteria(option).values())


@dataclass(frozen=True, slots=True)
class Ranking:
    ranked: tuple[RouteOption, ...]  # best first

    @property
    def recommended(self) -> RouteOption:
        return self.ranked[0]

    @property
    def all_routes_blocked(self) -> bool:
        """True when even the best route has No Travel miles, so every route does."""
        return criteria(self.recommended)[Criterion.NO_TRAVEL_MILES] > 0

    def deciding_criterion(self, other: RouteOption) -> Criterion | None:
        """The first criterion on which the recommended route beats `other`.

        None means the two are tied on every criterion.
        """
        best, rival = criteria(self.recommended), criteria(other)
        return next((name for name in Criterion if best[name] != rival[name]), None)


def rank_routes(options: Sequence[RouteOption]) -> Ranking:
    if not options:
        raise ValueError("At least one route option is required.")
    # sorted() is stable: fully tied routes keep the routing provider's order.
    return Ranking(tuple(sorted(options, key=ranking_key)))
