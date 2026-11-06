"""Per-client rate limits that hold up behind the host's proxies (DECISIONS D4)."""

from django.conf import settings
from rest_framework.throttling import ScopedRateThrottle


class ClientRateThrottle(ScopedRateThrottle):
    """
    ScopedRateThrottle keyed on the client address from a trusted header.

    Behind Render, X-Forwarded-For cannot identify a client: the caller controls
    its leftmost entry and the proxy entries vary per request (measured live:
    130 rapid requests were never limited). Cloudflare, in front of every Render
    web service, writes CF-Connecting-IP and overwrites any value the caller
    sent, so that header is trusted when settings.CLIENT_IP_HEADER names it.
    """

    def get_ident(self, request):
        header = settings.CLIENT_IP_HEADER
        if header:
            meta_key = "HTTP_" + header.upper().replace("-", "_")
            client = request.META.get(meta_key, "").strip()
            if client:
                return client
        return super().get_ident(request)
