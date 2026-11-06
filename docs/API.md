# API

JSON over HTTP. All times are UTC ISO 8601 (`2026-11-07T14:00:00Z`). All
coordinates in responses are GeoJSON order: `[lng, lat]`.

## Errors

Every error has the same body, so the client can branch on `code`:

```json
{ "code": "invalid_request", "detail": "Departure time is in the past.", "fields": { "...": ["..."] } }
```

| Status | `code` | Meaning |
|---|---|---|
| 400 | `invalid_request` | Bad input. `fields` lists per-field messages when relevant. |
| 422 | `no_route` | No truck route exists between the two places. |
| 429 | `rate_limited` | Too many requests from this client (20 plans/min, 120 place lookups/min). |
| 503 | `provider_busy` | Weather or routing quota reached. Has a `Retry-After` header. |
| 503 | `provider_unavailable` | Weather or routing service down or timing out. |

## `GET /api/places/suggest/?q=denv`

Autocomplete (US and Canada). Fewer than 2 characters returns no results.

```json
{ "results": [ { "id": "T2ME35...", "kind": "areas", "title": "Denver, CO", "subtitle": "United States" } ] }
```

## `GET /api/places/{kind}/{id}/`

Coordinates of a suggestion.

```json
{ "id": "T2ME35...", "title": "Denver, CO", "subtitle": "United States", "position": [-104.98485, 39.73845] }
```

## `POST /api/trips/plan/`

Request:

```json
{
  "origin": { "lat": 32.7767, "lng": -96.797 },
  "destination": { "lat": 39.7392, "lng": -104.9903 },
  "departure": "2026-11-07T14:00:00Z",
  "load_lb": 42000,
  "spacing_mi": 25,
  "driver": "solo"
}
```

| Field | Rule |
|---|---|
| `departure` | From 5 minutes ago (treated as now) to 7 days ahead. |
| `load_lb` | Integer, 0 to 100,000. |
| `spacing_mi` | One of 10, 25, 50. |
| `driver` | `solo` (default) or `team`. A solo driver makes the stops required by US hours of service; a team keeps driving. |

Response (abridged):

```json
{
  "departure": "2026-11-07T14:00:00Z",
  "load_lb": 42000,
  "spacing_mi": 25,
  "driver": "solo",
  "recommended_route_id": "B",
  "all_routes_blocked": false,
  "routes": [
    {
      "id": "B",
      "rank": 1,
      "recommended": true,
      "decided_by": null,
      "distance_mi": 931.8,
      "trip_duration_s": 85518,
      "driving_duration_s": 47718,
      "arrival": "2026-11-08T13:45:18Z",
      "stops": [
        { "kind": "break", "mile": 612.4, "position": [-101.8313, 35.2220], "start": "2026-11-07T22:00:00Z", "end": "2026-11-07T22:30:00Z" },
        { "kind": "rest", "mile": 818.9, "position": [-103.2310, 37.8121], "start": "2026-11-08T01:30:00Z", "end": "2026-11-08T11:30:00Z" }
      ],
      "risk": {
        "miles_by_level": { "low": 931.8, "moderate": 0, "high": 0, "severe": 0, "no_travel": 0 },
        "no_data_miles": 0,
        "average_risk": 0.0,
        "worst_level": "low"
      },
      "geometry": [[-96.797, 32.77667], "..."],
      "checkpoints": [
        {
          "mile": 25.0,
          "position": [-97.1012, 32.9471],
          "eta": "2026-11-07T14:31:10Z",
          "level": "moderate",
          "drivers": ["wind"],
          "load_escalated": false,
          "weather": { "wind_mph": 27.3, "gust_mph": 38.1, "rain_in_per_hr": 0.0, "snow_in_per_hr": 0.0 }
        }
      ]
    }
  ],
  "heatmap": {
    "resolution_deg": 0.25,
    "start": "2026-11-07T14:00:00Z",
    "frames": 49,
    "cells": [ { "row": 131, "col": -388, "levels": [0, 0, 1, 1, 2, null, "..."] } ]
  }
}
```

- `routes` are in **ranked order**; `id` (A, B, C) is the routing provider's order and stays stable.
- `decided_by`: the first ranking criterion on which the recommended route beats this one
  (`no_travel_miles`, `severe_miles`, `high_miles`, `average_risk`, `duration`), or `null`.
- `trip_duration_s` is door to door, including `stops`; it is the "travel time" the ranking
  compares, and `arrival` is departure + `trip_duration_s`. `driving_duration_s` is wheel time only.
- `stops` are the required driver stops in time order: `break` (30 min after 8 h of driving) and
  `rest` (10 h after 11 h of driving). Always empty for `team`. Checkpoint `eta`s include every stop
  made before the checkpoint.
- Checkpoint `level` / `weather` are `null` when no forecast covers that place and time.
- Heatmap `levels[h]` is the risk `h` hours after departure, as an integer
  (0 low, 1 moderate, 2 high, 3 severe, 4 no_travel; `null` = no data).
  A cell spans `[row, row + 1) × resolution_deg` latitude and `[col, col + 1) × resolution_deg` longitude.
