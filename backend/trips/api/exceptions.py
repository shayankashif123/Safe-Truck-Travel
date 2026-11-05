"""
Maps domain and provider errors to HTTP responses in one place.

Every error body has the same shape: {"code": "<stable_id>", "detail": "<message>"},
so the frontend can branch on `code` and show `detail`.
"""

import logging

from rest_framework.response import Response
from rest_framework.views import exception_handler

from trips.domain.errors import InvalidInput
from trips.providers.errors import (
    NoRouteFound,
    ProviderError,
    ProviderRateLimited,
)

logger = logging.getLogger(__name__)

RETRY_AFTER_S = 60

DRF_STATUS_CODES = {
    400: "invalid_request",
    404: "not_found",
    405: "method_not_allowed",
    429: "rate_limited",
}


def api_exception_handler(exc: Exception, context: dict) -> Response | None:
    if isinstance(exc, InvalidInput):
        return _error(400, "invalid_request", str(exc))

    if isinstance(exc, NoRouteFound):
        return _error(422, "no_route", "No truck route was found between these places.")

    if isinstance(exc, ProviderRateLimited):
        logger.warning("Provider rate limit hit: %s", exc)
        response = _error(
            503, "provider_busy", "The weather or routing service is busy. Try again in a minute."
        )
        response["Retry-After"] = str(RETRY_AFTER_S)
        return response

    if isinstance(exc, ProviderError):
        logger.error("Provider failure: %s", exc)
        return _error(
            503,
            "provider_unavailable",
            f"{exc.provider} is not responding right now. Please try again shortly.",
        )

    # Everything else (validation, throttling, 404, 405) is handled by DRF, then
    # wrapped in the same envelope. Field-level validation messages are kept.
    response = exception_handler(exc, context)
    if response is not None and isinstance(response.data, dict):
        data = response.data
        response.data = {
            "code": DRF_STATUS_CODES.get(response.status_code, "error"),
            "detail": str(data.get("detail", "Invalid request.")),
        }
        fields = {key: value for key, value in data.items() if key != "detail"}
        if fields:
            response.data["fields"] = fields
    return response


def _error(status: int, code: str, detail: str) -> Response:
    return Response({"code": code, "detail": detail}, status=status)
