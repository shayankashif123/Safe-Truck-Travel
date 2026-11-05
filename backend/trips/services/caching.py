"""Cache helpers shared by all services."""

import hashlib
from collections.abc import Callable

from django.core.cache import cache

# Bump when the shape of a cached value changes, so stale entries are ignored.
CACHE_VERSION = "v1"

_MISSING = object()


def cache_key(namespace: str, *parts: object) -> str:
    """A short, backend-safe key. Parts are hashed, so free text is allowed."""
    digest = hashlib.sha256("|".join(map(str, parts)).encode()).hexdigest()[:32]
    return f"{CACHE_VERSION}:{namespace}:{digest}"


def get_or_load[T](key: str, ttl_s: int, load: Callable[[], T]) -> T:
    value = cache.get(key, _MISSING)
    if value is _MISSING:
        value = load()
        cache.set(key, value, ttl_s)
    return value
