"""
Plan a trip end to end:

    routes -> driver stops -> checkpoints + ETAs -> weather (one batch)
           -> risk -> ranking -> heatmap

This module only orchestrates. Every rule it applies lives in trips.domain.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from trips.domain.checkpoints import Checkpoint, RouteProfile, place_checkpoints
from trips.domain.classification import RiskAssessment, WeatherSample, assess_risk
from trips.domain.corridor import choose_corridor
from trips.domain.errors import InvalidInput
from trips.domain.forecast import HourlyForecast, floor_hour
from trips.domain.geo import LatLng
from trips.domain.geometry import METERS_PER_MILE, haversine_m
from trips.domain.hours_of_service import DriverMode, DrivingSchedule, Stop, schedule_drive
from trips.domain.levels import RiskLevel
from trips.domain.ranking import Ranking, RouteOption, rank_routes
from trips.domain.routes import Route
from trips.domain.scoring import RoutePoint, RouteRiskSummary, summarize_route
from trips.domain.weather_grid import GridCell, cell_for
from trips.providers.errors import NoRouteFound
from trips.providers.open_meteo import OpenMeteoClient
from trips.providers.tomtom import PROVIDER as ROUTING_PROVIDER
from trips.providers.tomtom import TomTomClient
from trips.services.routing import truck_routes
from trips.services.weather import forecasts_for_cells

HEATMAP_FRAMES = 49  # slider positions 0..48 hours after departure (DECISIONS H1)
MAX_DEPARTURE_AHEAD = timedelta(days=7)  # keeps every ETA inside the 16-day forecast
PAST_DEPARTURE_GRACE = timedelta(minutes=5)  # time spent filling in the form
MIN_TRIP_DISTANCE_M = METERS_PER_MILE
ROUTE_IDS = "ABCDEF"


@dataclass(frozen=True, slots=True)
class TripRequest:
    origin: LatLng
    destination: LatLng
    departure: datetime
    load_lb: int
    spacing_mi: int
    driver: DriverMode


@dataclass(frozen=True, slots=True)
class PlannedCheckpoint:
    checkpoint: Checkpoint
    eta: datetime
    weather: WeatherSample | None  # None: no forecast for this place and time
    assessment: RiskAssessment | None

    @property
    def level(self) -> RiskLevel | None:
        return self.assessment.level if self.assessment else None


@dataclass(frozen=True, slots=True)
class PlannedStop:
    """A required driver break or rest, placed where the truck will be at the time."""

    stop: Stop
    distance_m: float  # from the origin, along the route
    position: LatLng
    start: datetime
    end: datetime

    @property
    def mile(self) -> float:
        return self.distance_m / METERS_PER_MILE


@dataclass(frozen=True, slots=True)
class PlannedRoute:
    id: str
    route: Route
    schedule: DrivingSchedule
    stops: tuple[PlannedStop, ...]
    checkpoints: tuple[PlannedCheckpoint, ...]
    risk: RouteRiskSummary

    @property
    def trip_duration_s(self) -> float:
        """Door to door, including required stops. The ranking's "travel time"."""
        return self.schedule.total_s


@dataclass(frozen=True, slots=True)
class HeatmapCell:
    cell: GridCell
    levels: tuple[RiskLevel | None, ...]  # one per frame (hour after departure)


@dataclass(frozen=True, slots=True)
class Heatmap:
    resolution_deg: float
    start: datetime  # frame 0 = departure
    cells: tuple[HeatmapCell, ...]


@dataclass(frozen=True, slots=True)
class TripPlan:
    request: TripRequest
    departure: datetime  # effective departure (never in the past)
    routes: tuple[PlannedRoute, ...]  # routing-provider order
    ranking: Ranking
    heatmap: Heatmap


def plan_trip(
    request: TripRequest,
    *,
    now: datetime | None = None,
    routing_client: TomTomClient | None = None,
    weather_client: OpenMeteoClient | None = None,
) -> TripPlan:
    now = now or datetime.now(UTC)
    departure = _effective_departure(request.departure, now)
    if haversine_m(request.origin, request.destination) < MIN_TRIP_DISTANCE_M:
        raise InvalidInput("Origin and destination are the same place.")

    routes = truck_routes(request.origin, request.destination, departure, client=routing_client)
    if not routes:
        raise NoRouteFound(ROUTING_PROVIDER, "no truck route between these places")
    routes = routes[: len(ROUTE_IDS)]

    profiles = [RouteProfile(route) for route in routes]
    schedules = [schedule_drive(route.duration_s, request.driver) for route in routes]
    resolution, corridor = choose_corridor(profiles)
    checkpoints = [place_checkpoints(profile, request.spacing_mi) for profile in profiles]
    checkpoint_cells = [[cell_for(cp.position, resolution) for cp in cps] for cps in checkpoints]

    # One window covers every checkpoint ETA and every heatmap frame. The extra
    # hour is the precipitation bucket that follows the last moment (DECISIONS T2).
    window_start = floor_hour(departure)
    last_moment = departure + timedelta(
        hours=max(HEATMAP_FRAMES - 1, max(s.total_s for s in schedules) / 3600)
    )
    window_end = floor_hour(last_moment) + timedelta(hours=1)

    all_cells = corridor.union(*checkpoint_cells)
    forecasts = forecasts_for_cells(
        all_cells, window_start, window_end, now=now, client=weather_client
    )

    planned = tuple(
        _plan_route(
            ROUTE_IDS[i], profile, schedule, cps, cells, forecasts, departure, request.load_lb
        )
        for i, (profile, schedule, cps, cells) in enumerate(
            zip(profiles, schedules, checkpoints, checkpoint_cells, strict=True)
        )
    )
    ranking = rank_routes([RouteOption(r.id, r.trip_duration_s, r.risk) for r in planned])
    heatmap = _build_heatmap(forecasts, departure, resolution, request.load_lb)
    return TripPlan(request, departure, planned, ranking, heatmap)


def _plan_route(
    route_id: str,
    profile: RouteProfile,
    schedule: DrivingSchedule,
    checkpoints: list[Checkpoint],
    cells: list[GridCell],
    forecasts: dict[GridCell, HourlyForecast],
    departure: datetime,
    load_lb: int,
) -> PlannedRoute:
    planned = []
    for checkpoint, cell in zip(checkpoints, cells, strict=True):
        # Checkpoints carry driving time; the schedule adds the stops made before them.
        eta = departure + timedelta(seconds=schedule.elapsed_at(checkpoint.elapsed_s))
        weather = forecasts[cell].sample_at(eta)
        assessment = assess_risk(weather, load_lb) if weather else None
        planned.append(PlannedCheckpoint(checkpoint, eta, weather, assessment))

    risk = summarize_route([RoutePoint(p.checkpoint.mile, p.level) for p in planned])
    stops = tuple(_place_stop(stop, profile, departure) for stop in schedule.stops)
    return PlannedRoute(route_id, profile.route, schedule, stops, tuple(planned), risk)


def _place_stop(stop: Stop, profile: RouteProfile, departure: datetime) -> PlannedStop:
    distance_m = profile.distance_at(stop.driving_s)
    return PlannedStop(
        stop=stop,
        distance_m=distance_m,
        position=profile.position_at(distance_m),
        start=departure + timedelta(seconds=stop.start_s),
        end=departure + timedelta(seconds=stop.end_s),
    )


def _build_heatmap(
    forecasts: dict[GridCell, HourlyForecast],
    departure: datetime,
    resolution_deg: float,
    load_lb: int,
) -> Heatmap:
    frame_times = [departure + timedelta(hours=h) for h in range(HEATMAP_FRAMES)]
    cells = []
    for cell in sorted(forecasts):
        forecast = forecasts[cell]
        levels = []
        for moment in frame_times:
            sample = forecast.sample_at(moment)
            levels.append(assess_risk(sample, load_lb).level if sample else None)
        cells.append(HeatmapCell(cell, tuple(levels)))
    return Heatmap(resolution_deg, departure, tuple(cells))


def _effective_departure(requested: datetime, now: datetime) -> datetime:
    if requested.tzinfo is None:
        raise InvalidInput("Departure time must include a timezone.")
    if requested < now - PAST_DEPARTURE_GRACE:
        raise InvalidInput("Departure time is in the past.")
    if requested > now + MAX_DEPARTURE_AHEAD:
        raise InvalidInput("Departure must be within the next 7 days (forecast range).")
    # A departure a few minutes in the past means "now".
    return max(requested, now).astimezone(UTC).replace(microsecond=0)
