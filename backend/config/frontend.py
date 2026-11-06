"""How WhiteNoise serves the built frontend in production (see settings.py)."""

# Vite puts a content hash in every file name under /assets/: cache forever.
IMMUTABLE_FILE_TEST = r"^/assets/"


def add_headers(headers, path: str, url: str) -> None:
    # index.html names the current hashed bundles, so it must be revalidated:
    # after a deploy, a cached copy would point at bundles that no longer exist.
    if url == "/" or url.endswith(".html"):
        headers["Cache-Control"] = "no-cache"
