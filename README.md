# Weather-Aware Truck Routing

Compare truck routes by forecast weather risk at the truck's arrival time,
load weight and travel time, and get a clear recommendation.

> Work in progress. Full documentation follows as features land.
> Open questions in the brief and how they were resolved: [docs/DECISIONS.md](docs/DECISIONS.md).

## Stack

- **Backend:** Django 5.2 LTS + Django REST Framework (stateless JSON API)
- **Frontend:** React 19 + TypeScript + Vite + MUI

## Data sources

- Routing and place search: [TomTom](https://developer.tomtom.com/) (API key required).
- Weather forecasts: [Open-Meteo](https://open-meteo.com/) (free tier, non-commercial use).
- Basemap: [OpenFreeMap](https://openfreemap.org/), © [OpenMapTiles](https://openmaptiles.org/), data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
- Time zones: [timezonefinder](https://github.com/jannikmi/timezonefinder) with
  [timezone-boundary-builder](https://github.com/evansiroky/timezone-boundary-builder) data (ODbL), offline.

## Local setup

Requirements: Python 3.12+, Node 22+.

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
copy .env.example .env            # macOS/Linux: cp .env.example .env  (then set DJANGO_SECRET_KEY)
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
npm run dev                       # http://localhost:5173, proxies /api to :8000
```

## Quality checks

```bash
# backend/
pytest                  # offline: provider responses come from tests/fixtures
pytest -m live          # contract checks against the real TomTom and Open-Meteo APIs
ruff check . && ruff format --check .

# frontend/
npm test                # unit tests (form rules, recommendation wording, formatting)
npm run lint && npm run typecheck && npm run format:check
```
