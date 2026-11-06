"""
The trip corridor: every weather-grid cell within a fixed radius of any route.

The heatmap shows these cells. The grid resolution is chosen in
weather_sampling.py, together with the checkpoint grid (DECISIONS H3, W1).
"""

import math
from collections.abc import Sequence

from trips.domain.checkpoints import RouteProfile
from trips.domain.geo import LatLng
from trips.domain.geometry import METERS_PER_DEGREE_LAT, METERS_PER_MILE, haversine_m
from trips.domain.weather_grid import GridCell, cell_for

# Cells within 12 miles of a route, plus every cell it passes through: a band of
# 2-3 quarter-degree cells. Measured on real trips, 20 miles cost ~70% more
# weather locations and pushed a same-minute spacing change over Open-Meteo's
# per-minute limit (DECISIONS H3).
CORRIDOR_RADIUS_M = 12 * METERS_PER_MILE


def corridor_cells(
    profiles: Sequence[RouteProfile], resolution_deg: float, radius_m: float
) -> set[GridCell]:
    # Sample the route at half a cell so no cell along the line is skipped.
    step_m = resolution_deg * METERS_PER_DEGREE_LAT / 2
    cells: set[GridCell] = set()
    for profile in profiles:
        samples = math.ceil(profile.length_m / step_m)
        for k in range(samples + 1):
            point = profile.position_at(k * step_m)
            cells |= _cells_near(point, resolution_deg, radius_m)
    return cells


def _cells_near(point: LatLng, resolution_deg: float, radius_m: float) -> set[GridCell]:
    home = cell_for(point, resolution_deg)
    cell_height_m = resolution_deg * METERS_PER_DEGREE_LAT
    cell_width_m = cell_height_m * max(math.cos(math.radians(point.lat)), 0.1)
    reach_rows = math.ceil(radius_m / cell_height_m)
    reach_cols = math.ceil(radius_m / cell_width_m)

    cells = {home}  # the cell under the route is always part of the corridor
    for d_row in range(-reach_rows, reach_rows + 1):
        for d_col in range(-reach_cols, reach_cols + 1):
            cell = GridCell(home.row + d_row, home.col + d_col, resolution_deg)
            if haversine_m(point, cell.center) <= radius_m:
                cells.add(cell)
    return cells
