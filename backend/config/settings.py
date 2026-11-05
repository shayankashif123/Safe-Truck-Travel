"""
Django settings.

All environment-specific values come from environment variables (loaded from
backend/.env in local development). Nothing secret is ever hard-coded here.

The app is stateless: there is no database, no auth and no sessions, because
the brief requires none of them.
"""

import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")


def env_str(name: str, default: str | None = None) -> str:
    value = os.environ.get(name, default)
    if value is None or value == "":
        raise ImproperlyConfigured(
            f"Environment variable {name} is not set. "
            "Copy backend/.env.example to backend/.env and fill it in."
        )
    return value


def env_bool(name: str, default: bool = False) -> bool:
    return os.environ.get(name, str(default)).strip().lower() in {"1", "true", "yes"}


def env_list(name: str, default: str = "") -> list[str]:
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


# --- Core -------------------------------------------------------------------

SECRET_KEY = env_str("DJANGO_SECRET_KEY")
DEBUG = env_bool("DJANGO_DEBUG")
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

INSTALLED_APPS = [
    "rest_framework",
    "trips",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

# Stateless API: no database is configured on purpose.
DATABASES: dict = {}

# All datetimes are handled in UTC internally (see docs/DECISIONS.md).
USE_TZ = True
TIME_ZONE = "UTC"
LANGUAGE_CODE = "en-us"
USE_I18N = False

# --- Django REST Framework ---------------------------------------------------

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": [],
    "UNAUTHENTICATED_USER": None,
    "EXCEPTION_HANDLER": "trips.api.exceptions.api_exception_handler",
    # Per-client limits protect the free provider quotas on the public deployment.
    "DEFAULT_THROTTLE_RATES": {
        "trip_plan": "20/min",
        "places": "120/min",
    },
}

# --- External providers -------------------------------------------------------

# Checked when the TomTom client is first created, so the health check and the
# offline test suite run without a key.
TOMTOM_API_KEY = os.environ.get("TOMTOM_API_KEY", "")

# --- Cache ---------------------------------------------------------------------

# In-process cache. One trip stores a few hundred weather cells, so the default
# limit of 300 entries would evict a trip's data while it is still being used.
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "OPTIONS": {"MAX_ENTRIES": 20_000},
    }
}

# --- Logging -------------------------------------------------------------------

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        # httpx logs full request URLs at INFO, and TomTom's routing key travels
        # in the query string. Keep these loggers quiet so the key never reaches logs.
        "httpx": {"level": "WARNING"},
        "httpcore": {"level": "WARNING"},
    },
}
