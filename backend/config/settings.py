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

from config import frontend

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


def env_int(name: str, default: int | None) -> int | None:
    value = os.environ.get(name, "").strip()
    return int(value) if value else default


# --- Core -------------------------------------------------------------------

SECRET_KEY = env_str("DJANGO_SECRET_KEY")
DEBUG = env_bool("DJANGO_DEBUG")
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")
# Render sets the service's public hostname (also used by its health checks).
if render_host := os.environ.get("RENDER_EXTERNAL_HOSTNAME"):
    ALLOWED_HOSTS.append(render_host)

INSTALLED_APPS = [
    "rest_framework",
    "trips",
]

MIDDLEWARE = [
    # Outermost, so it compresses the final body: a trip plan is ~100-140 KB of
    # JSON. Safe from BREACH-style attacks: responses carry no secrets or tokens.
    "django.middleware.gzip.GZipMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# --- Frontend --------------------------------------------------------------------

# In production one service serves both the API and the built React app (one
# origin: no CORS). The Docker image sets this to the Vite build output. In
# development it is unset and Vite serves the frontend.
FRONTEND_DIST_DIR = os.environ.get("FRONTEND_DIST_DIR", "")
if FRONTEND_DIST_DIR:
    # Directly after SecurityMiddleware, as WhiteNoise requires (it serves its
    # own pre-compressed files, which GZipMiddleware leaves untouched).
    MIDDLEWARE.insert(
        MIDDLEWARE.index("django.middleware.security.SecurityMiddleware") + 1,
        "whitenoise.middleware.WhiteNoiseMiddleware",
    )
    WHITENOISE_ROOT = FRONTEND_DIST_DIR
    WHITENOISE_INDEX_FILE = True  # "/" serves index.html
    WHITENOISE_IMMUTABLE_FILE_TEST = frontend.IMMUTABLE_FILE_TEST
    WHITENOISE_ADD_HEADERS_FUNCTION = frontend.add_headers  # a callable, not a path

# --- HTTPS behind the host's load balancer ----------------------------------------

# Render terminates TLS and forwards plain HTTP with X-Forwarded-Proto. HTTP is
# already redirected to HTTPS at its edge, so Django does not redirect itself
# (that would also redirect the host's internal health checks).
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
if not DEBUG:
    SECURE_HSTS_SECONDS = 31_536_000

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
    # Proxies in front of Django that append to X-Forwarded-For. Set in production
    # so throttling keys on the address the proxy saw, which a client cannot forge.
    "NUM_PROXIES": env_int("DJANGO_NUM_PROXIES", None),
}

# --- External providers -------------------------------------------------------

# Checked when the TomTom client is first created, so the health check and the
# offline test suite run without a key.
TOMTOM_API_KEY = os.environ.get("TOMTOM_API_KEY", "")

# --- Cache ---------------------------------------------------------------------

# In-process cache, shared by the threads of the single server process. One trip
# stores a few hundred weather cells, so Django's default of 300 entries would
# evict a trip's data while it is in use. Entries average ~13 KB (measured), so
# 8,000 is ~100 MB: about 15 different trips, safe on a 512 MB instance.
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "OPTIONS": {"MAX_ENTRIES": env_int("CACHE_MAX_ENTRIES", 8_000)},
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
