import json
from collections.abc import Callable
from pathlib import Path

import httpx
import pytest
from django.core.cache import cache

FIXTURES = Path(__file__).parent / "fixtures"


class FakeServer:
    """Records outgoing requests and answers them with queued responses."""

    def __init__(self) -> None:
        self.requests: list[httpx.Request] = []
        self._replies: list[Callable[[httpx.Request], httpx.Response]] = []

    def reply(self, status: int = 200, json=None, *, text: str | None = None) -> None:
        if text is not None:
            self._replies.append(lambda _req: httpx.Response(status, text=text))
        else:
            self._replies.append(lambda _req: httpx.Response(status, json=json))

    def reply_with(self, handler: Callable[[httpx.Request], httpx.Response]) -> None:
        self._replies.append(handler)

    def fail_with(self, error: Exception) -> None:
        def raise_error(_req):
            raise error

        self._replies.append(raise_error)

    def client(self, base_url: str) -> httpx.Client:
        return httpx.Client(base_url=base_url, transport=httpx.MockTransport(self._handle))

    def _handle(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        # The last queued reply is reused, so one reply can serve many requests.
        handler = self._replies.pop(0) if len(self._replies) > 1 else self._replies[0]
        return handler(request)


@pytest.fixture
def server() -> FakeServer:
    return FakeServer()


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def load_fixture():
    def load(name: str):
        return json.loads((FIXTURES / name).read_text(encoding="utf-8"))

    return load
