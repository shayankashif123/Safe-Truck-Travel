from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs

import httpx
import pytest

from trips.domain.geo import LatLng
from trips.providers import open_meteo
from trips.providers.errors import ProviderBadResponse, ProviderRejected
from trips.providers.open_meteo import BASE_URL, OpenMeteoClient

START = datetime(2026, 11, 7, 14, 0, tzinfo=UTC)
END = START + timedelta(hours=2)
DENVER = LatLng(39.875, -104.875)
CHICAGO = LatLng(41.875, -87.625)


@pytest.fixture
def weather(server):
    return OpenMeteoClient(http=server.client(BASE_URL))


def form(request: httpx.Request) -> dict[str, str]:
    return {k: v[0] for k, v in parse_qs(request.content.decode()).items()}


def calm_item(hours: int = 3) -> dict:
    return {
        "hourly": {
            "time": [int(START.timestamp()) + h * 3600 for h in range(hours)],
            "wind_speed_10m": [5.0] * hours,
            "wind_gusts_10m": [8.0] * hours,
            "rain": [0.0] * hours,
            "showers": [0.0] * hours,
            "snowfall": [0.0] * hours,
        }
    }


def test_request_asks_for_brief_units_in_utc(weather, server, load_fixture):
    server.reply(json=load_fixture("open_meteo_two_locations.json"))

    weather.hourly_forecasts([DENVER, CHICAGO], START, END)

    sent = form(server.requests[0])
    assert server.requests[0].method == "POST"
    assert sent["latitude"] == "39.8750,41.8750"
    assert sent["longitude"] == "-104.8750,-87.6250"
    assert sent["hourly"] == "wind_speed_10m,wind_gusts_10m,rain,showers,snowfall"
    assert sent["wind_speed_unit"] == "mph"
    assert sent["precipitation_unit"] == "inch"
    assert (sent["timezone"], sent["timeformat"]) == ("GMT", "unixtime")
    assert (sent["start_hour"], sent["end_hour"]) == ("2026-11-07T14:00", "2026-11-07T16:00")


def test_parses_one_forecast_per_location_in_order(weather, server, load_fixture):
    server.reply(json=load_fixture("open_meteo_two_locations.json"))

    denver, chicago = weather.hourly_forecasts([DENVER, CHICAGO], START, END)

    assert denver.start_epoch == 1794060000
    assert denver.wind_mph == (12.1, 30.4, 47.0)
    assert denver.snow_in_per_hr == (0.0, 0.0, 0.6)
    assert chicago.wind_mph == (5.0, 6.0, None)


def test_rain_includes_showers(weather, server, load_fixture):
    server.reply(json=load_fixture("open_meteo_two_locations.json"))

    denver, _ = weather.hourly_forecasts([DENVER, CHICAGO], START, END)

    assert denver.rain_in_per_hr == pytest.approx((0.0, 0.11, 0.3))


def test_missing_values_stay_missing(weather, server, load_fixture):
    server.reply(json=load_fixture("open_meteo_two_locations.json"))

    denver, chicago = weather.hourly_forecasts([DENVER, CHICAGO], START, END)

    assert denver.gust_mph[2] is None
    assert chicago.rain_in_per_hr[1] is None  # rain known, showers missing


def test_single_location_response_object_is_accepted(weather, server):
    server.reply(json=calm_item())

    (forecast,) = weather.hourly_forecasts([DENVER], START, END)

    assert forecast.hours == 3


def test_many_locations_are_batched(weather, server, monkeypatch):
    monkeypatch.setattr(open_meteo, "MAX_LOCATIONS_PER_REQUEST", 2)

    def answer(request):
        count = len(form(request)["latitude"].split(","))
        return httpx.Response(200, json=[calm_item() for _ in range(count)])

    server.reply_with(answer)
    locations = [LatLng(30 + i, -100) for i in range(5)]

    forecasts = weather.hourly_forecasts(locations, START, END)

    assert len(server.requests) == 3  # 2 + 2 + 1
    assert len(forecasts) == 5


def test_fewer_forecasts_than_locations_is_a_bad_response(weather, server):
    server.reply(json=[calm_item()])

    with pytest.raises(ProviderBadResponse):
        weather.hourly_forecasts([DENVER, CHICAGO], START, END)


def test_gaps_in_forecast_hours_are_a_bad_response(weather, server):
    item = calm_item()
    item["hourly"]["time"][2] += 3600
    server.reply(json=item)

    with pytest.raises(ProviderBadResponse):
        weather.hourly_forecasts([DENVER], START, END)


def test_out_of_range_window_is_rejected(weather, server):
    server.reply(400, {"error": True, "reason": "Parameter 'start_hour' is out of allowed range"})

    with pytest.raises(ProviderRejected):
        weather.hourly_forecasts([DENVER], START, END)


@pytest.mark.parametrize(
    ("start", "end"),
    [
        (START.replace(minute=30), END),  # not a whole hour
        (START.replace(tzinfo=None), END),  # naive
        (END, START),  # reversed
    ],
)
def test_rejects_invalid_windows_without_calling_the_api(weather, server, start, end):
    with pytest.raises(ValueError):
        weather.hourly_forecasts([DENVER], start, end)

    assert server.requests == []
