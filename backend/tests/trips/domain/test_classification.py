import math

import pytest

from trips.domain.classification import (
    Factor,
    WeatherSample,
    assess_risk,
    classify,
    wind_level_for_load,
)
from trips.domain.levels import RiskLevel
from trips.domain.rules import (
    RAIN_BANDS_IN_PER_HR,
    SNOW_BANDS_IN_PER_HR,
    WIND_BANDS_MPH,
    Band,
    ascending,
)

LOW, MODERATE, HIGH, SEVERE, NO_TRAVEL = RiskLevel

# --- Thresholds: one case just below and one exactly at every boundary --------


@pytest.mark.parametrize(
    ("mph", "expected"),
    [
        (0, LOW),
        (24.99, LOW),
        (25, MODERATE),
        (34.99, MODERATE),
        (35, HIGH),
        (44.99, HIGH),
        (45, SEVERE),
        (54.99, SEVERE),
        (55, NO_TRAVEL),
        (120, NO_TRAVEL),
    ],
)
def test_wind_thresholds(mph, expected):
    assert classify(mph, WIND_BANDS_MPH) == expected


@pytest.mark.parametrize(
    ("in_per_hr", "expected"),
    [
        (0, LOW),
        (0.099, LOW),
        (0.10, MODERATE),
        (0.249, MODERATE),
        (0.25, HIGH),  # in both 0.10-0.25 and 0.25-0.50 in the brief; lower bound wins
        (0.499, HIGH),
        (0.50, SEVERE),
        (1.00, SEVERE),  # No Travel is explicitly ">1.00"
        (1.001, NO_TRAVEL),
    ],
)
def test_rain_thresholds(in_per_hr, expected):
    assert classify(in_per_hr, RAIN_BANDS_IN_PER_HR) == expected


@pytest.mark.parametrize(
    ("in_per_hr", "expected"),
    [
        (0, LOW),
        (0.499, LOW),
        (0.5, MODERATE),
        (0.999, MODERATE),
        (1.0, HIGH),
        (1.999, HIGH),
        (2.0, SEVERE),
        (3.0, SEVERE),  # No Travel is explicitly ">3.0"
        (3.001, NO_TRAVEL),
    ],
)
def test_snow_thresholds(in_per_hr, expected):
    assert classify(in_per_hr, SNOW_BANDS_IN_PER_HR) == expected


# --- Load rules --------------------------------------------------------------


@pytest.mark.parametrize(
    ("mph", "load_lb", "expected", "escalated"),
    [
        # >=55 mph is No Travel for any load, including an empty truck.
        (55, 0, NO_TRAVEL, False),
        # 45-54 mph + >30,000 lb -> No Travel (strictly greater than).
        (45, 30_000, SEVERE, False),
        (45, 30_001, NO_TRAVEL, True),
        (54.99, 30_001, NO_TRAVEL, True),
        # 35-44 mph + >40,000 lb -> Severe (strictly greater than).
        (35, 40_000, HIGH, False),
        (35, 40_001, SEVERE, True),
        (44.99, 40_001, SEVERE, True),
        # 35-44 mph between 30,000 and 40,000 lb: no rule applies.
        (40, 35_000, HIGH, False),
        # Rules never chain: 35-44 mph becomes Severe, not No Travel.
        (40, 80_000, SEVERE, True),
        # Below 35 mph the load has no effect.
        (34.99, 80_000, MODERATE, False),
        (10, 80_000, LOW, False),
    ],
)
def test_load_rules(mph, load_lb, expected, escalated):
    assert wind_level_for_load(mph, load_lb) == (expected, escalated)


# --- Combining factors -------------------------------------------------------


def test_overall_level_is_the_worst_factor():
    result = assess_risk(WeatherSample(wind_mph=10, rain_in_per_hr=0.6, snow_in_per_hr=0.7), 0)

    assert (result.wind, result.rain, result.snow) == (LOW, SEVERE, MODERATE)
    assert result.level == SEVERE
    assert result.drivers == (Factor.RAIN,)


def test_drivers_list_every_factor_at_the_overall_level():
    result = assess_risk(WeatherSample(wind_mph=36, rain_in_per_hr=0, snow_in_per_hr=1.5), 0)

    assert result.level == HIGH
    assert result.drivers == (Factor.WIND, Factor.SNOW)


def test_load_escalated_wind_drives_the_overall_level():
    result = assess_risk(WeatherSample(wind_mph=46, rain_in_per_hr=0.3, snow_in_per_hr=0), 35_000)

    assert result.level == NO_TRAVEL
    assert result.load_escalated is True
    assert result.drivers == (Factor.WIND,)


def test_calm_weather_has_no_drivers():
    result = assess_risk(WeatherSample(wind_mph=5, rain_in_per_hr=0, snow_in_per_hr=0), 80_000)

    assert result.level == LOW
    assert result.drivers == ()


# --- Invalid input -----------------------------------------------------------


@pytest.mark.parametrize("bad", [-0.01, math.nan, math.inf])
def test_rejects_invalid_measurements(bad):
    with pytest.raises(ValueError):
        classify(bad, WIND_BANDS_MPH)


def test_rejects_negative_load():
    with pytest.raises(ValueError):
        wind_level_for_load(30, -1)


def test_threshold_tables_must_run_from_mildest_to_worst():
    with pytest.raises(ValueError):
        ascending(Band(HIGH, 35), Band(MODERATE, 25))


# --- Invariants over the whole input range -----------------------------------

LOADS = (0, 30_000, 30_001, 40_000, 40_001, 80_000)
WIND_STEPS = [step / 4 for step in range(0, 70 * 4)]  # 0 to 69.75 mph in 0.25 steps


@pytest.mark.parametrize("load_lb", LOADS)
def test_more_wind_never_lowers_the_level(load_lb):
    levels = [wind_level_for_load(mph, load_lb)[0] for mph in WIND_STEPS]

    assert levels == sorted(levels)


@pytest.mark.parametrize("mph", WIND_STEPS[::8])
def test_heavier_load_never_lowers_the_level(mph):
    levels = [wind_level_for_load(mph, load)[0] for load in LOADS]

    assert levels == sorted(levels)
