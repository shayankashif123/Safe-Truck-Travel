"""
Open-Meteo client: hourly forecasts for many locations in batched requests.

Docs: https://open-meteo.com/en/docs
Units are requested in mph and inches, so no conversion is needed
(docs/DECISIONS.md R4). The free tier counts one call per location, so callers
should send each grid cell only once.
"""

from collections.abc import Sequence
from datetime import UTC, datetime
from itertools import batched, pairwise
from typing import Any

import httpx

from trips.domain.forecast import HOUR_S, HourlyForecast
from trips.domain.geo import LatLng
from trips.providers.errors import ProviderBadResponse
from trips.providers.http import build_client, parse_response, request_json

PROVIDER = "Open-Meteo"
BASE_URL = "https://api.open-meteo.com"
MAX_LOCATIONS_PER_REQUEST = 100
HOURLY_VARIABLES = ("wind_speed_10m", "wind_gusts_10m", "rain", "showers", "snowfall")


class OpenMeteoClient:
    def __init__(self, http: httpx.Client | None = None) -> None:
        self._http = http or build_client(base_url=BASE_URL)

    def hourly_forecasts(
        self, locations: Sequence[LatLng], start: datetime, end: datetime
    ) -> list[HourlyForecast]:
        """
        One forecast per location, in the same order.

        `start` and `end` are whole UTC hours and both are included.
        """
        _require_whole_hour(start)
        _require_whole_hour(end)
        if end < start:
            raise ValueError("end must not be before start")

        forecasts: list[HourlyForecast] = []
        for chunk in batched(locations, MAX_LOCATIONS_PER_REQUEST):
            body = request_json(
                self._http, PROVIDER, "POST", "/v1/forecast", data=_form(chunk, start, end)
            )
            forecasts.extend(parse_response(PROVIDER, _parse_forecasts, body))

        if len(forecasts) != len(locations):
            raise ProviderBadResponse(PROVIDER, "number of forecasts does not match locations")
        return forecasts


def _form(locations: Sequence[LatLng], start: datetime, end: datetime) -> dict[str, str]:
    return {
        "latitude": ",".join(f"{p.lat:.4f}" for p in locations),
        "longitude": ",".join(f"{p.lng:.4f}" for p in locations),
        "hourly": ",".join(HOURLY_VARIABLES),
        "wind_speed_unit": "mph",
        "precipitation_unit": "inch",
        "timezone": "GMT",
        "timeformat": "unixtime",
        "start_hour": start.astimezone(UTC).strftime("%Y-%m-%dT%H:%M"),
        "end_hour": end.astimezone(UTC).strftime("%Y-%m-%dT%H:%M"),
    }


def _parse_forecasts(body: Any) -> list[HourlyForecast]:
    # A single location comes back as an object, several as a list.
    items = body if isinstance(body, list) else [body]
    return [_parse_forecast(item["hourly"]) for item in items]


def _parse_forecast(hourly: dict[str, Any]) -> HourlyForecast:
    times = hourly["time"]
    if any(later - earlier != HOUR_S for earlier, later in pairwise(times)):
        raise ValueError("forecast hours are not contiguous")
    return HourlyForecast(
        start_epoch=times[0],
        wind_mph=tuple(hourly["wind_speed_10m"]),
        gust_mph=tuple(hourly["wind_gusts_10m"]),
        # Open-Meteo splits liquid precipitation into "rain" and convective
        # "showers"; both count as rain for risk (docs/DECISIONS.md R3).
        rain_in_per_hr=tuple(
            _sum_or_none(rain, showers)
            for rain, showers in zip(hourly["rain"], hourly["showers"], strict=True)
        ),
        snow_in_per_hr=tuple(hourly["snowfall"]),
    )


def _sum_or_none(a: float | None, b: float | None) -> float | None:
    return None if a is None or b is None else a + b


def _require_whole_hour(moment: datetime) -> None:
    if moment.tzinfo is None:
        raise ValueError("times must be timezone-aware")
    if moment.timestamp() % HOUR_S:
        raise ValueError("times must be whole hours")
