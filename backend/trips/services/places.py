from trips.providers.tomtom import Place, PlaceSuggestion, TomTomClient
from trips.services.caching import cache_key, get_or_load
from trips.services.clients import tomtom_client

SUGGESTIONS_TTL_S = 24 * 3600
PLACE_TTL_S = 30 * 24 * 3600  # a place's coordinates practically never change


def suggest_places(query: str, *, client: TomTomClient | None = None) -> list[PlaceSuggestion]:
    normalized = " ".join(query.split()).lower()
    return get_or_load(
        cache_key("suggest", normalized),
        SUGGESTIONS_TTL_S,
        lambda: (client or tomtom_client()).suggest_places(normalized),
    )


def resolve_place(kind: str, place_id: str, *, client: TomTomClient | None = None) -> Place:
    return get_or_load(
        cache_key("place", kind, place_id),
        PLACE_TTL_S,
        lambda: (client or tomtom_client()).place_details(kind, place_id),
    )
