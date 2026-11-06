"""
IANA time zone of a place, so the UI can show every time in local time at that
place (docs/DECISIONS.md T4).

timezonefinder looks the zone up offline in the timezone-boundary-builder
polygons (no API quota, no network): ~0.1 s to open its memory-mapped data
once per process, then a few microseconds per lookup.
"""

from functools import cache
from threading import Lock

from timezonefinder import TimezoneFinder

from trips.domain.geo import LatLng

# The library does not document thread safety. Lookups are serialised; at a
# few microseconds each that costs ~1 ms on a trip with hundreds of checkpoints.
_lock = Lock()


@cache
def _finder() -> TimezoneFinder:
    return TimezoneFinder()


def time_zone_at(point: LatLng) -> str | None:
    """e.g. "America/Denver"; None if the point is in no zone at all."""
    with _lock:
        return _finder().timezone_at(lng=point.lng, lat=point.lat)
