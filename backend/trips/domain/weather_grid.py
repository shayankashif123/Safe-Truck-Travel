"""
Fixed lat/lng grids for weather requests.

Weather is fetched once per cell, at the cell's center, so nearby or
overlapping routes share requests and repeated trips hit the cache. Checkpoints
use a fine grid and the heatmap a coarser one (docs/DECISIONS.md W1).
"""

import math
from dataclasses import dataclass

from trips.domain.geo import LatLng

# Binary fractions only, so row * resolution has no floating-point error.
# At US latitudes: 1/16 deg ~ 4 x 3.5 mi, 1/8 ~ 9 x 7, 1/4 ~ 17 x 14, 1/2, 1.
SUPPORTED_RESOLUTIONS_DEG = (0.0625, 0.125, 0.25, 0.5, 1.0)
DEFAULT_RESOLUTION_DEG = 0.25


@dataclass(frozen=True, slots=True, order=True)
class GridCell:
    row: int
    col: int
    resolution_deg: float

    @property
    def center(self) -> LatLng:
        lat = (self.row + 0.5) * self.resolution_deg
        lng = (self.col + 0.5) * self.resolution_deg
        return LatLng(max(-90.0, min(90.0, lat)), lng)

    @property
    def key(self) -> str:
        return f"{self.resolution_deg}:{self.row}:{self.col}"


def cell_for(point: LatLng, resolution_deg: float = DEFAULT_RESOLUTION_DEG) -> GridCell:
    if resolution_deg not in SUPPORTED_RESOLUTIONS_DEG:
        raise ValueError(f"unsupported grid resolution: {resolution_deg}")
    # floor (not int()) so negative coordinates snap to the correct cell.
    return GridCell(
        row=math.floor(point.lat / resolution_deg),
        col=math.floor(point.lng / resolution_deg),
        resolution_deg=resolution_deg,
    )
