import hashlib
from array import array
from datetime import datetime

from trips.domain.geo import LatLng
from trips.domain.geometry import simplify
from trips.domain.routes import Route
from trips.providers.tomtom import TomTomClient, to_rfc3339_utc
from trips.services.caching import cache_key, get_or_load
from trips.services.clients import tomtom_client

# TomTom takes 4-12 s per request. Re-running the same trip (e.g. changing the
# checkpoint spacing) should be instant, but traffic-aware times go stale.
ROUTES_TTL_S = 10 * 60

# 25 m is invisible at map zoom levels and sends ~10x fewer points (DECISIONS W7).
DISPLAY_TOLERANCE_M = 25


def truck_routes(
    origin: LatLng,
    destination: LatLng,
    depart_at: datetime,
    *,
    client: TomTomClient | None = None,
) -> list[Route]:
    key = cache_key(
        "routes",
        f"{origin.lat:.5f},{origin.lng:.5f}",
        f"{destination.lat:.5f},{destination.lng:.5f}",
        to_rfc3339_utc(depart_at.replace(second=0, microsecond=0)),
    )
    return get_or_load(
        key,
        ROUTES_TTL_S,
        lambda: (client or tomtom_client()).calculate_routes(origin, destination, depart_at),
    )


def display_points(route: Route) -> list[LatLng]:
    """
    The route line simplified for the browser.

    Simplification is the costliest step of a repeated trip, so the result is
    cached under a fingerprint of the exact coordinates: every request for the
    same route, whatever its departure, load or spacing, reuses it.
    """
    coordinates = array("d", (value for p in route.points for value in (p.lat, p.lng)))
    fingerprint = hashlib.blake2b(coordinates.tobytes(), digest_size=16).hexdigest()
    return get_or_load(
        cache_key("route-line", fingerprint, DISPLAY_TOLERANCE_M),
        ROUTES_TTL_S,
        lambda: simplify(route.points, DISPLAY_TOLERANCE_M),
    )
