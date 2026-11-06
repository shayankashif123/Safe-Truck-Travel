"""Shared HTTP plumbing so every provider handles failures the same way."""

import ssl
from collections.abc import Callable
from functools import cache
from typing import Any

import certifi
import httpx

from trips.providers.errors import (
    ProviderBadResponse,
    ProviderRateLimited,
    ProviderRejected,
    ProviderUnavailable,
)

# connect includes the DNS lookup; slow home networks were measured at 1+ s for it.
CONNECT_TIMEOUT_S = 10.0
DEFAULT_TIMEOUT = httpx.Timeout(20.0, connect=CONNECT_TIMEOUT_S)
CONNECT_RETRIES = 2  # retries connection failures only, never a request the server received


@cache
def tls_context() -> ssl.SSLContext:
    """
    One TLS context for every provider client. Loading the CA bundle was
    measured at ~0.6 s of CPU per client, paid on the first request.
    """
    return ssl.create_default_context(cafile=certifi.where())


def build_client(*, base_url: str, timeout: httpx.Timeout = DEFAULT_TIMEOUT) -> httpx.Client:
    return httpx.Client(
        base_url=base_url,
        timeout=timeout,
        transport=httpx.HTTPTransport(retries=CONNECT_RETRIES, verify=tls_context()),
        headers={"Accept": "application/json"},
    )


def request_json(client: httpx.Client, provider: str, method: str, url: str, **kwargs: Any) -> Any:
    """Send a request and return its JSON body, or raise a ProviderError."""
    # `from None` below drops httpx's exception, whose context holds the
    # request URL (and with it TomTom's key).
    try:
        response = client.request(method, url, **kwargs)
    except httpx.TimeoutException:
        raise ProviderUnavailable(provider, "request timed out") from None
    except httpx.TransportError:
        raise ProviderUnavailable(provider, "network error") from None

    status = response.status_code
    if status == 429:
        raise ProviderRateLimited(provider, "rate limit exceeded")
    if status in (401, 403):
        raise ProviderUnavailable(provider, "authentication failed; check the API key")
    if status >= 500:
        raise ProviderUnavailable(provider, f"server error (HTTP {status})")
    if status >= 400:
        raise ProviderRejected(provider, status, _json_or_none(response))

    body = _json_or_none(response)
    if body is None:
        raise ProviderBadResponse(provider, "response is not JSON")
    return body


def parse_response[T](provider: str, parse: Callable[[Any], T], body: Any) -> T:
    """Run a parser and convert any shape mismatch into ProviderBadResponse."""
    try:
        return parse(body)
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise ProviderBadResponse(provider, f"unexpected response shape ({exc!r})") from None


def _json_or_none(response: httpx.Response) -> Any:
    try:
        return response.json()
    except ValueError:
        return None
