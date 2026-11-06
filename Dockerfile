# syntax=docker/dockerfile:1
# One image serves the API and the built frontend (docs/DECISIONS.md D1).

# --- Stage 1: build the React app ----------------------------------------------
FROM node:22.23.4-bookworm-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Django runtime ----------------------------------------------------
FROM python:3.12.10-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install -r requirements.txt

COPY backend/ ./
# Compile once at build time: the app runs as a non-root user that cannot write
# bytecode, and on a small CPU recompiling at every boot is slow.
RUN python -m compileall -q /app
COPY --from=frontend /app/frontend/dist ./frontend_dist
# Compress once at build time; WhiteNoise then serves the .gz/.br copies.
RUN python -m whitenoise.compress --quiet frontend_dist

# A home directory: gunicorn keeps its control socket there.
RUN useradd --uid 10001 --create-home --shell /usr/sbin/nologin app
USER app

ENV FRONTEND_DIST_DIR=/app/frontend_dist \
    DJANGO_DEBUG=false \
    PORT=10000
EXPOSE 10000

# One process, so every request shares the in-memory cache; threads overlap the
# waits on TomTom and Open-Meteo. The timeout allows for a first trip on a
# small shared CPU. Only the host's load balancer can reach the container, so
# its X-Forwarded-* headers are trusted.
CMD ["sh", "-c", "exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT} --workers 1 --threads 8 --timeout 120 --forwarded-allow-ips '*' --access-logfile -"]
