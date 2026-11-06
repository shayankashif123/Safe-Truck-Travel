"""
Checkpoints every N miles along a route, with the truck's driving time to each.

Distances and times come from the routing provider's own profile (DECISIONS W2).
Between two profile marks, distance is spread along the polyline in proportion
to the geometric length of each segment, and time is interpolated linearly in
distance.
"""

import math
from bisect import bisect_right
from dataclasses import dataclass
from itertools import pairwise

from trips.domain.errors import InvalidInput
from trips.domain.geo import LatLng
from trips.domain.geometry import METERS_PER_MILE
from trips.domain.routes import Route

SUPPORTED_SPACINGS_MI = (10, 25, 50)

# A final stretch shorter than this would be a duplicate of the destination.
MIN_FINAL_STRETCH_M = 1.0


@dataclass(frozen=True, slots=True)
class Checkpoint:
    distance_m: float  # from the origin, along the route
    position: LatLng
    elapsed_s: float  # driving time from departure

    @property
    def mile(self) -> float:
        return self.distance_m / METERS_PER_MILE


class RouteProfile:
    """Position and elapsed driving time at any distance along a route."""

    def __init__(self, route: Route) -> None:
        self.route = route
        self._distances = _cumulative_distances(route)
        self._mark_distances = [mark.distance_m for mark in route.progress]
        self._mark_times = [mark.travel_time_s for mark in route.progress]

    @property
    def length_m(self) -> float:
        return self._distances[-1]

    def position_at(self, distance_m: float) -> LatLng:
        d = self._clamp(distance_m)
        i = _segment_index(self._distances, d)
        a, b = self.route.points[i], self.route.points[i + 1]
        f = _fraction(d, self._distances[i], self._distances[i + 1])
        return LatLng(a.lat + (b.lat - a.lat) * f, a.lng + (b.lng - a.lng) * f)

    def elapsed_at(self, distance_m: float) -> float:
        d = self._clamp(distance_m)
        i = _segment_index(self._mark_distances, d)
        f = _fraction(d, self._mark_distances[i], self._mark_distances[i + 1])
        return self._mark_times[i] + (self._mark_times[i + 1] - self._mark_times[i]) * f

    def distance_at(self, elapsed_s: float) -> float:
        """Distance covered after `elapsed_s` of driving: the inverse of elapsed_at."""
        t = max(0.0, min(elapsed_s, self._mark_times[-1]))
        i = _segment_index(self._mark_times, t)
        f = _fraction(t, self._mark_times[i], self._mark_times[i + 1])
        return self._mark_distances[i] + (self._mark_distances[i + 1] - self._mark_distances[i]) * f

    def _clamp(self, distance_m: float) -> float:
        return max(0.0, min(distance_m, self.length_m))


def place_checkpoints(profile: RouteProfile, spacing_mi: int) -> list[Checkpoint]:
    """Checkpoints at 0, N, 2N, ... miles, plus the destination."""
    if spacing_mi not in SUPPORTED_SPACINGS_MI:
        raise InvalidInput(f"Checkpoint spacing must be one of {SUPPORTED_SPACINGS_MI} miles.")

    step = spacing_mi * METERS_PER_MILE
    distances = [k * step for k in range(int(profile.length_m // step) + 1)]
    if profile.length_m - distances[-1] >= MIN_FINAL_STRETCH_M:
        distances.append(profile.length_m)

    return [Checkpoint(d, profile.position_at(d), profile.elapsed_at(d)) for d in distances]


def _cumulative_distances(route: Route) -> list[float]:
    """
    Distance from the origin to every polyline point, scaled so it matches the
    provider's measured distance at each profile mark exactly.
    """
    points = route.points
    distances = [0.0] * len(points)
    for start, end in pairwise(route.progress):
        # Only the *proportions* between segments matter, because the total is
        # rescaled to the provider's measured distance below. A flat projection
        # gives the same proportions as great-circle math over these short spans,
        # at a fraction of the cost.
        span = points[start.point_index : end.point_index + 1]
        cos_lat = math.cos(math.radians(span[0].lat))
        segments = [math.hypot((b.lng - a.lng) * cos_lat, b.lat - a.lat) for a, b in pairwise(span)]
        geometric = sum(segments)
        measured = end.distance_m - start.distance_m
        scale = measured / geometric if geometric > 0 else 0.0

        running = start.distance_m
        distances[start.point_index] = running
        for offset, segment in enumerate(segments, start=1):
            running += segment * scale
            distances[start.point_index + offset] = running
        distances[end.point_index] = end.distance_m  # exact, free of rounding drift
    return distances


def _segment_index(sorted_values: list[float], value: float) -> int:
    """Index i such that sorted_values[i] <= value <= sorted_values[i + 1]."""
    return min(max(bisect_right(sorted_values, value) - 1, 0), len(sorted_values) - 2)


def _fraction(value: float, low: float, high: float) -> float:
    return 0.0 if high <= low else (value - low) / (high - low)
