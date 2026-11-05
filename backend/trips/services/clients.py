"""
One long-lived client per provider, so HTTP connections are reused across
requests instead of paying a new TLS handshake every time.
"""

from functools import cache

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from trips.providers.open_meteo import OpenMeteoClient
from trips.providers.tomtom import TomTomClient


@cache
def tomtom_client() -> TomTomClient:
    if not settings.TOMTOM_API_KEY:
        raise ImproperlyConfigured(
            "TOMTOM_API_KEY is not set. Add it to backend/.env (see backend/.env.example)."
        )
    return TomTomClient(settings.TOMTOM_API_KEY)


@cache
def open_meteo_client() -> OpenMeteoClient:
    return OpenMeteoClient()
