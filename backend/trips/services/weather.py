from collections.abc import Iterable
from datetime import UTC, datetime, timedelta

from django.core.cache import cache

from trips.domain.forecast import HourlyForecast, floor_hour
from trips.domain.weather_grid import GridCell
from trips.providers.open_meteo import OpenMeteoClient
from trips.services.caching import cache_key
from trips.services.clients import open_meteo_client

# Forecast models refresh roughly hourly; 30 minutes keeps data fresh while
# making repeat requests free.
FORECAST_TTL_S = 30 * 60

# Open-Meteo charges per location, not per hour of data (up to two weeks). So
# every cell is fetched once for a fixed window starting at the current hour:
# a later request with a different departure, load or spacing reuses it
# instead of spending the rate limit again (DECISIONS W4).
# 13 days = the latest departure (7 days ahead) plus a coast-to-coast solo trip
# with required rests (~65 h of driving takes ~5 days), still under two weeks.
# Anything beyond is reported as "no data", never as safe (DECISIONS T5).
FETCH_HORIZON = timedelta(days=13)


def forecasts_for_cells(
    cells: Iterable[GridCell],
    start: datetime,
    end: datetime,
    *,
    now: datetime | None = None,
    client: OpenMeteoClient | None = None,
) -> dict[GridCell, HourlyForecast]:
    """
    Hourly forecasts covering at least `start`..`end` for every distinct cell.

    Cached cells are reused. All remaining cells are fetched together in as few
    batched requests as possible, never more than once each.
    """
    fetch_start = min(floor_hour(now or datetime.now(UTC)), start)
    fetch_end = max(fetch_start + FETCH_HORIZON, end)

    unique = sorted(set(cells))
    window = (int(fetch_start.timestamp()), int(fetch_end.timestamp()))
    keys = {cell: cache_key("forecast", cell.key, *window) for cell in unique}

    cached: dict[str, HourlyForecast] = cache.get_many(list(keys.values()))
    missing = [cell for cell in unique if keys[cell] not in cached]

    fetched: dict[GridCell, HourlyForecast] = {}
    if missing:
        forecasts = (client or open_meteo_client()).hourly_forecasts(
            [cell.center for cell in missing], fetch_start, fetch_end
        )
        fetched = dict(zip(missing, forecasts, strict=True))
        cache.set_many({keys[cell]: f for cell, f in fetched.items()}, FORECAST_TTL_S)

    return {cell: fetched[cell] if cell in fetched else cached[keys[cell]] for cell in unique}
