import pickle

import pytest

from trips.domain.geo import LatLng
from trips.domain.geometry import haversine_m, simplify

DALLAS = LatLng(32.7767, -96.797)
DENVER = LatLng(39.7392, -104.9903)


def test_haversine_matches_known_city_distance():
    # Great-circle distance Dallas -> Denver is about 1,064 km.
    assert haversine_m(DALLAS, DENVER) == pytest.approx(1_064_000, rel=0.01)


def test_haversine_is_zero_for_the_same_point():
    assert haversine_m(DENVER, DENVER) == 0


def test_simplify_reduces_a_straight_line_to_its_endpoints():
    line = [LatLng(35.0, -100.0 + i * 0.001) for i in range(1000)]

    assert simplify(line, tolerance_m=10) == [line[0], line[-1]]


def test_simplify_keeps_corners_larger_than_the_tolerance():
    corner = LatLng(35.01, -99.5)  # ~1.1 km off the straight line
    line = [
        LatLng(35.0, -100.0),
        LatLng(35.0, -99.75),
        corner,
        LatLng(35.0, -99.25),
        LatLng(35.0, -99.0),
    ]

    simplified = simplify(line, tolerance_m=25)

    assert corner in simplified
    assert simplified[0] == line[0] and simplified[-1] == line[-1]


def test_simplify_drops_wiggles_within_the_tolerance():
    wiggle = LatLng(35.0001, -99.5)  # ~11 m off the line
    line = [LatLng(35.0, -100.0), wiggle, LatLng(35.0, -99.0)]

    assert simplify(line, tolerance_m=25) == [line[0], line[-1]]


def test_simplify_leaves_short_lines_unchanged():
    assert simplify([DALLAS, DENVER], tolerance_m=25) == [DALLAS, DENVER]


def test_latlng_survives_pickling_for_the_cache():
    assert pickle.loads(pickle.dumps(DENVER)) == DENVER


@pytest.mark.parametrize(("lat", "lng"), [(91, 0), (-91, 0), (0, 181), (0, -181)])
def test_latlng_rejects_impossible_coordinates(lat, lng):
    with pytest.raises(ValueError):
        LatLng(lat, lng)
