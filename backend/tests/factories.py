"""Builders for realistic domain objects used across tests."""

from datetime import datetime, timedelta

from trips.domain.forecast import HOUR_S, HourlyForecast
from trips.domain.geo import LatLng
from trips.domain.geometry import haversine_m
from trips.domain.routes import ProgressMark, Route

DEFAULT_START = LatLng(35.0, -100.0)


def straight_route(
    *,
    start: LatLng = DEFAULT_START,
    length_deg: float = 1.0,
    n_points: int = 101,
    hours: float = 1.0,
    first_half_share: float = 0.5,
    provider_length_m: float | None = None,
) -> Route:
    """
    An eastbound route along a parallel, like a provider would return it.

    `first_half_share` is the fraction of driving time spent on the first half
    (0.5 = constant speed). `provider_length_m` lets the provider's measured
    length differ from the geometric one.
    """
    points = tuple(
        LatLng(start.lat, start.lng + length_deg * i / (n_points - 1)) for i in range(n_points)
    )
    length = provider_length_m or haversine_m(points[0], points[-1])
    duration = hours * HOUR_S
    mid = n_points // 2
    progress = (
        ProgressMark(0, 0.0, 0.0),
        ProgressMark(mid, length * mid / (n_points - 1), duration * first_half_share),
        ProgressMark(n_points - 1, length, duration),
    )
    return Route(points, progress, length, duration)


class FakeRouting:
    """Stands in for TomTomClient.calculate_routes."""

    def __init__(self, routes: list[Route]) -> None:
        self.routes = routes
        self.calls = 0

    def calculate_routes(self, origin, destination, depart_at):
        self.calls += 1
        return self.routes


class FieldWeather:
    """
    Stands in for OpenMeteoClient: weather defined as a function of place and time.

    `wind_at(location, moment)` gives wind in mph. Values at or after
    `missing_from` are None, as when a forecast runs out.
    """

    def __init__(self, wind_at=lambda loc, moment: 5.0, missing_from: datetime | None = None):
        self.wind_at = wind_at
        self.missing_from = missing_from
        self.windows: list[tuple[datetime, datetime]] = []
        self.locations: list[LatLng] = []

    def hourly_forecasts(self, locations, start, end):
        self.windows.append((start, end))
        self.locations.extend(locations)
        hours = int((end - start) / timedelta(hours=1)) + 1
        moments = [start + timedelta(hours=h) for h in range(hours)]
        return [self._forecast(loc, start, moments) for loc in locations]

    def _forecast(self, location, start, moments):
        def value(moment, v):
            return None if self.missing_from and moment >= self.missing_from else v

        return HourlyForecast(
            start_epoch=int(start.timestamp()),
            wind_mph=tuple(value(m, self.wind_at(location, m)) for m in moments),
            gust_mph=tuple(value(m, 10.0) for m in moments),
            rain_in_per_hr=tuple(value(m, 0.0) for m in moments),
            snow_in_per_hr=tuple(value(m, 0.0) for m in moments),
        )
