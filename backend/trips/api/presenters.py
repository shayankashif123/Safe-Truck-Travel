"""
Domain objects -> JSON-ready dicts. The response contract is documented in docs/API.md.

Plain functions instead of DRF serializers: the response is read-only and holds
tens of thousands of values (the heatmap), where serializer overhead adds up.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

from trips.domain.geo import LatLng
from trips.domain.geometry import METERS_PER_MILE
from trips.domain.levels import RiskLevel
from trips.domain.ranking import Ranking
from trips.providers.tomtom import Place, PlaceSuggestion
from trips.services.trip_planner import (
    Heatmap,
    PlannedCheckpoint,
    PlannedRoute,
    PlannedStop,
    TripPlan,
)

COORD_DECIMALS = 5  # ~1 m


def present_trip_plan(plan: TripPlan) -> dict[str, Any]:
    ranking = plan.ranking
    by_id = {route.id: route for route in plan.routes}
    return {
        "departure": iso(plan.departure),
        # Grid behind checkpoint forecasts: 0.0625 normally, coarser on very long trips.
        "checkpoint_resolution_deg": plan.checkpoint_resolution_deg,
        # IANA zones: the UI shows each time in local time at its place (DECISIONS T4).
        "origin_time_zone": plan.origin_time_zone,
        "destination_time_zone": plan.destination_time_zone,
        "load_lb": plan.request.load_lb,
        "spacing_mi": plan.request.spacing_mi,
        "driver": str(plan.request.driver),
        "recommended_route_id": ranking.recommended.route_id,
        "all_routes_blocked": ranking.all_routes_blocked,
        "routes": [
            present_route(by_id[option.route_id], rank, ranking, plan.departure)
            for rank, option in enumerate(ranking.ranked, start=1)
        ],
        "heatmap": present_heatmap(plan.heatmap),
    }


def present_route(
    route: PlannedRoute, rank: int, ranking: Ranking, departure: datetime
) -> dict[str, Any]:
    option = next(o for o in ranking.ranked if o.route_id == route.id)
    recommended = option is ranking.recommended
    risk = route.risk
    return {
        "id": route.id,
        "rank": rank,
        "recommended": recommended,
        # Why the recommended route beats this one (None for the recommended route).
        "decided_by": None if recommended else _key_or_none(ranking.deciding_criterion(option)),
        "distance_mi": round(route.route.length_m / METERS_PER_MILE, 1),
        # Door to door including required stops; this is what the ranking compares.
        "trip_duration_s": round(route.trip_duration_s),
        "driving_duration_s": round(route.route.duration_s),
        "arrival": iso(departure + timedelta(seconds=route.trip_duration_s)),
        "stops": [present_stop(s) for s in route.stops],
        "risk": {
            "miles_by_level": {lvl.key: round(risk.miles(lvl), 1) for lvl in RiskLevel},
            "no_data_miles": round(risk.no_data_miles, 1),
            "average_risk": None if risk.average_risk is None else round(risk.average_risk, 2),
            "worst_level": _level_key(risk.worst_level),
        },
        "geometry": [_coords(p) for p in route.display_points],
        "checkpoints": [present_checkpoint(c) for c in route.checkpoints],
    }


def present_checkpoint(planned: PlannedCheckpoint) -> dict[str, Any]:
    weather, assessment = planned.weather, planned.assessment
    return {
        "mile": round(planned.checkpoint.mile, 1),
        "position": _coords(planned.checkpoint.position),
        "eta": iso(planned.eta),
        "time_zone": planned.time_zone,
        "level": _level_key(planned.level),
        "drivers": [str(f) for f in assessment.drivers] if assessment else [],
        "load_escalated": assessment.load_escalated if assessment else False,
        "weather": None
        if weather is None
        else {
            "wind_mph": round(weather.wind_mph, 1),
            "gust_mph": None if weather.gust_mph is None else round(weather.gust_mph, 1),
            "rain_in_per_hr": round(weather.rain_in_per_hr, 3),
            "snow_in_per_hr": round(weather.snow_in_per_hr, 3),
        },
    }


def present_stop(planned: PlannedStop) -> dict[str, Any]:
    return {
        "kind": str(planned.stop.kind),
        "mile": round(planned.mile, 1),
        "position": _coords(planned.position),
        "start": iso(planned.start),
        "end": iso(planned.end),
        "time_zone": planned.time_zone,
    }


def present_heatmap(heatmap: Heatmap) -> dict[str, Any]:
    return {
        "resolution_deg": heatmap.resolution_deg,
        "start": iso(heatmap.start),
        "frames": len(heatmap.cells[0].levels) if heatmap.cells else 0,
        # Levels are RiskLevel integers (0 = low ... 4 = no_travel), null = no data,
        # to keep tens of thousands of values compact.
        "cells": [
            {"row": c.cell.row, "col": c.cell.col, "levels": [_level_int(lvl) for lvl in c.levels]}
            for c in heatmap.cells
        ],
    }


def present_suggestion(suggestion: PlaceSuggestion) -> dict[str, Any]:
    return {
        "id": suggestion.id,
        "kind": suggestion.kind,
        "title": suggestion.title,
        "subtitle": suggestion.subtitle,
    }


def present_place(place: Place, time_zone: str | None) -> dict[str, Any]:
    return {
        "id": place.id,
        "title": place.title,
        "subtitle": place.subtitle,
        "position": _coords(place.position),
        "time_zone": time_zone,
    }


def iso(moment: datetime) -> str:
    return moment.astimezone(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _coords(point: LatLng) -> list[float]:
    """GeoJSON order: [lng, lat]."""
    return [round(point.lng, COORD_DECIMALS), round(point.lat, COORD_DECIMALS)]


def _level_key(level: RiskLevel | None) -> str | None:
    return None if level is None else level.key


def _level_int(level: RiskLevel | None) -> int | None:
    return None if level is None else int(level)


def _key_or_none(value: object | None) -> str | None:
    return None if value is None else str(value)
