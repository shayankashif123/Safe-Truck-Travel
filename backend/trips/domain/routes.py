from dataclasses import dataclass
from itertools import pairwise

from trips.domain.geo import LatLng


@dataclass(frozen=True, slots=True)
class ProgressMark:
    """Cumulative distance and driving time from the origin to `points[point_index]`."""

    point_index: int
    distance_m: float
    travel_time_s: float


@dataclass(frozen=True, slots=True)
class Route:
    """
    One drivable route as returned by the routing provider.

    `progress` is the provider's own distance/time profile along the route, so
    ETAs reflect slower urban stretches and faster highways rather than an
    average speed.
    """

    points: tuple[LatLng, ...]
    progress: tuple[ProgressMark, ...]
    length_m: float
    duration_s: float

    def __post_init__(self) -> None:
        if len(self.points) < 2:
            raise ValueError("a route needs at least two points")
        if not self.progress:
            raise ValueError("a route needs a distance/time profile")
        if (
            self.progress[0].point_index != 0
            or self.progress[-1].point_index != len(self.points) - 1
        ):
            raise ValueError("the distance/time profile must span the whole route")
        for earlier, later in pairwise(self.progress):
            if (
                later.point_index <= earlier.point_index
                or later.distance_m < earlier.distance_m
                or later.travel_time_s < earlier.travel_time_s
            ):
                raise ValueError("the distance/time profile must move forward along the route")
