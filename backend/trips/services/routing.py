from datetime import datetime

from trips.domain.geo import LatLng
from trips.domain.routes import Route
from trips.providers.tomtom import TomTomClient, to_rfc3339_utc
from trips.services.caching import cache_key, get_or_load
from trips.services.clients import tomtom_client

# TomTom takes 4-12 s per request. Re-running the same trip (e.g. changing the
# checkpoint spacing) should be instant, but traffic-aware times go stale.
ROUTES_TTL_S = 10 * 60


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
