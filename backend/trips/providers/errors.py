"""
Provider failures, grouped by what the caller should do about them.

Messages never include request URLs, because TomTom's key travels in the URL.
"""

from typing import Any


class ProviderError(Exception):
    def __init__(self, provider: str, message: str) -> None:
        super().__init__(f"{provider}: {message}")
        self.provider = provider


class ProviderUnavailable(ProviderError):
    """Timeout, network failure, server error or rejected credentials. Retry later."""


class ProviderRateLimited(ProviderError):
    """Quota exceeded. Retry later."""


class ProviderBadResponse(ProviderError):
    """The provider answered with something we cannot parse."""


class ProviderRejected(ProviderError):
    """The provider refused this specific request (HTTP 4xx)."""

    def __init__(self, provider: str, status: int, body: Any) -> None:
        super().__init__(provider, f"request rejected (HTTP {status})")
        self.status = status
        self.body = body


class NoRouteFound(ProviderError):
    """No drivable truck route exists between the two places."""
