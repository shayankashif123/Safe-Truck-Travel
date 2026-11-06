"""The production setup that serves the built React app (settings FRONTEND_DIST_DIR)."""

import pytest
from django.http import HttpResponse
from django.test import RequestFactory, override_settings
from whitenoise.middleware import WhiteNoiseMiddleware

from config import frontend


@pytest.fixture
def dist(tmp_path):
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<!doctype html><title>app</title>")
    (tmp_path / "assets" / "index-AbC123xY.js").write_text("console.log(1)")
    return tmp_path


def serve(dist, path):
    with override_settings(
        WHITENOISE_ROOT=str(dist),
        WHITENOISE_INDEX_FILE=True,
        WHITENOISE_IMMUTABLE_FILE_TEST=frontend.IMMUTABLE_FILE_TEST,
        WHITENOISE_ADD_HEADERS_FUNCTION=frontend.add_headers,
    ):
        middleware = WhiteNoiseMiddleware(lambda request: HttpResponse("api", status=404))
        return middleware(RequestFactory().get(path))


def test_the_app_page_is_always_revalidated(dist):
    response = serve(dist, "/")

    assert response.status_code == 200
    assert response["Cache-Control"] == "no-cache"
    assert response["X-Frame-Options"] == "DENY"


def test_hashed_bundles_are_cached_forever(dist):
    response = serve(dist, "/assets/index-AbC123xY.js")

    assert response.status_code == 200
    assert "immutable" in response["Cache-Control"]


def test_other_paths_fall_through_to_django(dist):
    assert serve(dist, "/api/health/").content == b"api"
