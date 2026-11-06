"""
TomTom client: place autocomplete, place coordinates and truck routing.

Docs:
- Routing:  https://docs.tomtom.com/routing-api/documentation/tomtom-maps/calculate-route
- Places:   https://docs.tomtom.com/places-search-api/documentation/places-search/suggest
"""

import re
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import httpx

from trips.domain.errors import InvalidInput
from trips.domain.geo import LatLng
from trips.domain.routes import ProgressMark, Route
from trips.providers.errors import NoRouteFound, ProviderRejected
from trips.providers.http import CONNECT_TIMEOUT_S, build_client, parse_response, request_json

PROVIDER = "TomTom"
BASE_URL = "https://api.tomtom.com"
# Route calculation measured at 4-12 s for long truck trips.
TIMEOUT = httpx.Timeout(30.0, connect=CONNECT_TIMEOUT_S)

PLACES_API_VERSION = "3"
SUGGEST_COUNTRIES = ("US", "CA")
MAX_SUGGESTIONS = 6
PLACE_KINDS = frozenset({"addresses", "streets", "intersections", "pois", "areas"})
PLACE_ID = re.compile(r"^[A-Za-z0-9_-]{1,128}$")

# Two alternatives give up to three routes. TomTom may return fewer (DECISIONS K6);
# asking for more roughly doubles response time.
ROUTE_ALTERNATIVES = 2


@dataclass(frozen=True, slots=True)
class PlaceSuggestion:
    id: str
    kind: str  # TomTom details type, e.g. "areas" or "addresses"
    title: str
    subtitle: str


@dataclass(frozen=True, slots=True)
class Place:
    id: str
    title: str
    subtitle: str
    position: LatLng


class TomTomClient:
    def __init__(self, api_key: str, http: httpx.Client | None = None) -> None:
        if not api_key:
            raise ValueError("TomTom API key is missing")
        self._key = api_key
        self._http = http or build_client(base_url=BASE_URL, timeout=TIMEOUT)

    # --- Places ------------------------------------------------------------

    def suggest_places(self, query: str) -> list[PlaceSuggestion]:
        body = request_json(
            self._http,
            PROVIDER,
            "POST",
            "/maps/orbis/places/suggest",
            headers=self._places_headers("results"),
            json={
                "query": query,
                "maxResults": MAX_SUGGESTIONS,
                "filters": {"countryCodesIso2": list(SUGGEST_COUNTRIES)},
            },
        )
        return parse_response(PROVIDER, _parse_suggestions, body)

    def place_details(self, kind: str, place_id: str) -> Place:
        validate_place_ref(kind, place_id)  # both values end up in the URL path
        body = request_json(
            self._http,
            PROVIDER,
            "GET",
            f"/maps/orbis/places/details/{kind}/{place_id}",
            headers=self._places_headers("id,title,subtitles,position"),
        )
        return parse_response(PROVIDER, _parse_place, body)

    # --- Routing -----------------------------------------------------------

    def calculate_routes(
        self, origin: LatLng, destination: LatLng, depart_at: datetime
    ) -> list[Route]:
        params = [
            ("key", self._key),
            ("travelMode", "truck"),
            ("vehicleCommercial", "true"),
            ("maxAlternatives", str(ROUTE_ALTERNATIVES)),
            ("departAt", to_rfc3339_utc(depart_at)),
            ("traffic", "true"),
            ("extendedRouteRepresentation", "distance"),
            ("extendedRouteRepresentation", "travelTime"),
        ]
        path = (
            f"/routing/1/calculateRoute/"
            f"{origin.lat},{origin.lng}:{destination.lat},{destination.lng}/json"
        )
        try:
            body = request_json(self._http, PROVIDER, "GET", path, params=params)
        except ProviderRejected as exc:
            if _error_code(exc.body) == "NO_ROUTE_FOUND":
                raise NoRouteFound(PROVIDER, "no truck route between these places") from None
            raise
        return parse_response(PROVIDER, _parse_routes, body)

    def _places_headers(self, attributes: str) -> dict[str, str]:
        return {
            "TomTom-Api-Key": self._key,
            "TomTom-Api-Version": PLACES_API_VERSION,
            "Attributes": attributes,
        }


def validate_place_ref(kind: str, place_id: str) -> None:
    """Reject a place reference that is not a TomTom kind and id."""
    if kind not in PLACE_KINDS or not PLACE_ID.fullmatch(place_id):
        raise InvalidInput("Invalid place reference.")


def to_rfc3339_utc(moment: datetime) -> str:
    if moment.tzinfo is None:
        raise ValueError("departure time must be timezone-aware")
    return moment.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


# --- Parsing -------------------------------------------------------------------


def _parse_suggestions(body: Any) -> list[PlaceSuggestion]:
    suggestions = []
    for result in body["results"]:
        more = result.get("more") or {}
        # Skip "discover" entries (category searches); they have no single location.
        if more.get("operation") != "details":
            continue
        args = {p["parameter"]: p["argument"] for p in more["pathParameters"]}
        suggestions.append(
            PlaceSuggestion(
                id=args["id"],
                kind=args["type"],
                title=result["title"],
                subtitle=", ".join(result.get("subtitles") or []),
            )
        )
    return suggestions


def _parse_place(body: Any) -> Place:
    lng, lat = body["position"]["coordinates"][:2]  # GeoJSON order: [lng, lat]
    return Place(
        id=body["id"],
        title=body["title"],
        subtitle=", ".join(body.get("subtitles") or []),
        position=LatLng(lat, lng),
    )


def _parse_routes(body: Any) -> list[Route]:
    return [_parse_route(raw) for raw in body["routes"]]


def _parse_route(raw: Any) -> Route:
    summary = raw["summary"]
    return Route(
        points=tuple(
            LatLng(p["latitude"], p["longitude"]) for leg in raw["legs"] for p in leg["points"]
        ),
        progress=tuple(
            ProgressMark(m["pointIndex"], m["distanceInMeters"], m["travelTimeInSeconds"])
            for m in raw["progress"]
        ),
        length_m=summary["lengthInMeters"],
        duration_s=summary["travelTimeInSeconds"],
    )


def _error_code(body: Any) -> str | None:
    if isinstance(body, dict):
        detail = body.get("detailedError")
        if isinstance(detail, dict):
            return detail.get("code")
    return None
