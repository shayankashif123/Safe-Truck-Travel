import pytest

from trips.domain.geo import LatLng
from trips.domain.weather_grid import GridCell, cell_for


def test_snaps_to_the_cell_containing_the_point():
    cell = cell_for(LatLng(39.7392, -104.9903))

    # Cell spans lat 39.50-39.75 and lng -105.00 to -104.75.
    assert (cell.row, cell.col) == (158, -420)
    assert cell.center == LatLng(39.625, -104.875)


def test_negative_coordinates_round_down_not_toward_zero():
    # int(-104.99 / 0.25) would give -419, which is the wrong cell.
    assert cell_for(LatLng(-0.1, -0.1)) == GridCell(-1, -1, 0.25)


def test_points_in_the_same_cell_share_it():
    assert cell_for(LatLng(39.76, -104.99)) == cell_for(LatLng(39.99, -104.76))


def test_cell_edges_belong_to_the_cell_above():
    assert cell_for(LatLng(40.0, -105.0)) == GridCell(160, -420, 0.25)


def test_coarser_resolution():
    cell = cell_for(LatLng(39.7392, -104.9903), resolution_deg=1.0)

    assert cell.center == LatLng(39.5, -104.5)


def test_rejects_unsupported_resolution():
    with pytest.raises(ValueError):
        cell_for(LatLng(0, 0), resolution_deg=0.3)


def test_key_is_stable_and_unique_per_resolution():
    point = LatLng(39.7392, -104.9903)

    assert cell_for(point, 0.25).key == "0.25:158:-420"
    assert cell_for(point, 0.25).key != cell_for(point, 0.5).key
