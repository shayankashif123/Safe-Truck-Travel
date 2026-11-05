from tests.factories import straight_route
from trips.domain.checkpoints import RouteProfile
from trips.domain.corridor import CORRIDOR_RADIUS_M, choose_corridor, corridor_cells
from trips.domain.geo import LatLng
from trips.domain.geometry import METERS_PER_MILE, haversine_m
from trips.domain.weather_grid import cell_for


def profile(**kwargs):
    return RouteProfile(straight_route(**kwargs))


def test_corridor_contains_every_cell_under_the_route():
    route_profile = profile(length_deg=3)

    cells = corridor_cells([route_profile], 0.25, CORRIDOR_RADIUS_M)

    for point in route_profile.route.points:
        assert cell_for(point, 0.25) in cells


def test_corridor_cells_lie_within_the_radius_of_the_route():
    route_profile = profile(length_deg=3)
    route_line = route_profile.route.points

    cells = corridor_cells([route_profile], 0.25, CORRIDOR_RADIUS_M)

    for cell in cells:
        nearest = min(haversine_m(cell.center, p) for p in route_line)
        # Cells under the line are included even if their center is just outside.
        assert nearest <= CORRIDOR_RADIUS_M + 20 * METERS_PER_MILE


def test_corridor_is_wider_than_the_route_line():
    route_profile = profile(length_deg=3)
    line_cells = {cell_for(p, 0.25) for p in route_profile.route.points}

    cells = corridor_cells([route_profile], 0.25, CORRIDOR_RADIUS_M)

    assert len(cells) > 2 * len(line_cells)


def test_overlapping_routes_share_cells():
    a = profile(length_deg=3)
    b = profile(length_deg=3, start=LatLng(35.05, -100.0))  # ~3.5 mi north of A

    shared = corridor_cells([a, b], 0.25, CORRIDOR_RADIUS_M)
    separate = corridor_cells([a], 0.25, CORRIDOR_RADIUS_M) | corridor_cells(
        [b], 0.25, CORRIDOR_RADIUS_M
    )

    assert shared == separate
    assert len(shared) < 2 * len(corridor_cells([a], 0.25, CORRIDOR_RADIUS_M))


def test_uses_the_finest_grid_that_fits_the_budget():
    resolution, cells = choose_corridor([profile(length_deg=3)], max_cells=10_000)

    assert resolution == 0.25
    assert all(c.resolution_deg == 0.25 for c in cells)


def test_long_trips_coarsen_the_grid_to_stay_within_budget():
    long_trip = [profile(length_deg=20, n_points=401)]
    fine = corridor_cells(long_trip, 0.25, CORRIDOR_RADIUS_M)

    resolution, cells = choose_corridor(long_trip, max_cells=len(fine) - 1)

    assert resolution > 0.25
    assert len(cells) < len(fine)
