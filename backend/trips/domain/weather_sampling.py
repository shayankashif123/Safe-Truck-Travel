"""
Which weather locations a trip requests (docs/DECISIONS.md W1, H3).

Two grids, fetched in one batch:

- Checkpoints: as fine as 1/16 deg (~4 x 3.5 mi). That is finer than the
  smallest spacing (10 mi), so neighbouring checkpoints read their own
  forecasts, and close to the 2.5-3 km models Open-Meteo serves in the US.
- Heatmap corridor: 1/4 deg (~17 x 14 mi) cells within 12 miles of any route.

Open-Meteo's free tier counts one call per location, 600 per minute. One trip
may use at most TRIP_LOCATION_BUDGET of them. When a trip needs more, the
heatmap coarsens first, because checkpoints decide the recommendation; only
then do the checkpoints coarsen (very long trips at 10-mile spacing).
"""

from collections.abc import Sequence
from dataclasses import dataclass

from trips.domain.checkpoints import Checkpoint, RouteProfile
from trips.domain.corridor import CORRIDOR_RADIUS_M, corridor_cells
from trips.domain.weather_grid import GridCell, cell_for

CHECKPOINT_RESOLUTIONS_DEG = (0.0625, 0.125, 0.25, 0.5, 1.0)  # finest first
CORRIDOR_RESOLUTIONS_DEG = (0.25, 0.5, 1.0)  # finest first

# Three quarters of the 600/minute limit. Measured on Dallas -> Denver (the
# example trip): 292 locations at 25-mile spacing, 424 at 10, and switching the
# same trip from 25 to 10 within a minute needs 471 in total. So on trips of
# this size both spacings keep the 1/4 deg heatmap, and a spacing change stays
# under the minute limit; much longer trips may be asked to retry (503).
TRIP_LOCATION_BUDGET = 450


@dataclass(frozen=True, slots=True)
class WeatherSampling:
    checkpoint_resolution_deg: float
    checkpoint_cells: tuple[tuple[GridCell, ...], ...]  # per route, per checkpoint
    corridor_resolution_deg: float
    corridor: frozenset[GridCell]

    @property
    def locations(self) -> frozenset[GridCell]:
        """Every distinct cell to fetch: one weather location each."""
        return self.corridor.union(*self.checkpoint_cells)


def choose_sampling(
    profiles: Sequence[RouteProfile],
    checkpoints: Sequence[Sequence[Checkpoint]],
    *,
    budget: int = TRIP_LOCATION_BUDGET,
    radius_m: float = CORRIDOR_RADIUS_M,
) -> WeatherSampling:
    """The finest checkpoint grid, then the finest heatmap grid, that fit `budget`."""
    corridors: dict[float, frozenset[GridCell]] = {}  # each resolution computed once

    def corridor(resolution: float) -> frozenset[GridCell]:
        if resolution not in corridors:
            corridors[resolution] = frozenset(corridor_cells(profiles, resolution, radius_m))
        return corridors[resolution]

    sampling: WeatherSampling | None = None
    for checkpoint_res in CHECKPOINT_RESOLUTIONS_DEG:
        cells = tuple(
            tuple(cell_for(c.position, checkpoint_res) for c in route_checkpoints)
            for route_checkpoints in checkpoints
        )
        for corridor_res in CORRIDOR_RESOLUTIONS_DEG:
            sampling = WeatherSampling(checkpoint_res, cells, corridor_res, corridor(corridor_res))
            if len(sampling.locations) <= budget:
                return sampling

    # Even the coarsest grids exceed the budget (a continent-wide trip). Proceed
    # anyway: if the provider's limit is hit, the API answers 503 with Retry-After.
    assert sampling is not None
    return sampling
