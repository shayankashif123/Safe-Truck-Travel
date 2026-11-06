"""
Driver hours of service: where and for how long a truck must stop on the way.

FMCSA rules for property-carrying drivers (49 CFR 395.3), as summarised at
https://www.fmcsa.dot.gov/regulations/hours-service/summary-hours-service-regulations:

- at most 11 hours of driving after 10 consecutive hours off duty;
- no driving once 8 cumulative hours have been driven without a break of at
  least 30 minutes;
- no driving beyond the 14th hour after coming on duty.

Modelling choices (docs/DECISIONS.md T3):

- A solo driver starts the trip rested, with a full weekly allowance.
- Each stop is taken as late as the rules allow, never earlier.
- Only driving is on-duty time (no loading, fuelling or inspections). The
  14-hour window therefore never binds: a shift is 8 h + 0.5 h + 3 h = 11.5 h.
  ``test_a_solo_shift_fits_the_14_hour_window`` keeps that claim honest.
- The 60/70-hour weekly limit is not modelled.
- A team keeps the truck moving: one driver rests in the sleeper berth while
  the other drives, so the provider's continuous driving time applies.
"""

from dataclasses import dataclass
from enum import StrEnum

HOUR_S = 3600.0

MAX_DRIVING_BEFORE_BREAK_S = 8 * HOUR_S
BREAK_S = 0.5 * HOUR_S
MAX_DRIVING_PER_SHIFT_S = 11 * HOUR_S
REST_S = 10 * HOUR_S
MAX_ON_DUTY_WINDOW_S = 14 * HOUR_S


class DriverMode(StrEnum):
    SOLO = "solo"  # must stop for breaks and rest
    TEAM = "team"  # two drivers alternate; the truck keeps moving


class StopKind(StrEnum):
    BREAK = "break"  # 30 minutes after 8 hours of driving
    REST = "rest"  # 10 hours after 11 hours of driving


STOP_DURATION_S = {StopKind.BREAK: BREAK_S, StopKind.REST: REST_S}


@dataclass(frozen=True, slots=True)
class Stop:
    kind: StopKind
    driving_s: float  # driving time completed when the stop begins
    start_s: float  # time since departure when the stop begins

    @property
    def duration_s(self) -> float:
        return STOP_DURATION_S[self.kind]

    @property
    def end_s(self) -> float:
        return self.start_s + self.duration_s


@dataclass(frozen=True, slots=True)
class DrivingSchedule:
    """A trip's driving time with the stops the driver must make along the way."""

    driving_s: float
    stops: tuple[Stop, ...]

    @property
    def total_s(self) -> float:
        """Door-to-door trip time: driving plus every stop."""
        return self.driving_s + sum(stop.duration_s for stop in self.stops)

    def elapsed_at(self, driving_s: float) -> float:
        """
        Time since departure at which the truck has driven `driving_s`.

        A place reached exactly when a stop is due is reached *before* that stop:
        the truck arrives, then rests.
        """
        # A trip has a handful of stops at most, so a linear scan is simplest.
        return driving_s + sum(s.duration_s for s in self.stops if s.driving_s < driving_s)


def schedule_drive(driving_s: float, mode: DriverMode) -> DrivingSchedule:
    """The stops a driver in `mode` must make to cover `driving_s` of driving."""
    if driving_s < 0:
        raise ValueError("driving time must not be negative")
    if mode is DriverMode.TEAM:
        return DrivingSchedule(driving_s, ())

    stops: list[Stop] = []
    driven = elapsed = 0.0
    since_break = since_rest = 0.0
    while True:
        until_break = MAX_DRIVING_BEFORE_BREAK_S - since_break
        until_rest = MAX_DRIVING_PER_SHIFT_S - since_rest
        leg = min(until_break, until_rest)
        if driven + leg >= driving_s:
            break  # the destination comes before (or exactly when) the next stop is due

        driven += leg
        elapsed += leg
        since_break += leg
        since_rest += leg
        # A 10-hour rest also counts as the 30-minute break.
        kind = StopKind.REST if until_rest <= until_break else StopKind.BREAK
        stops.append(Stop(kind, driven, elapsed))
        elapsed += STOP_DURATION_S[kind]
        since_break = 0.0
        if kind is StopKind.REST:
            since_rest = 0.0

    return DrivingSchedule(driving_s, tuple(stops))
