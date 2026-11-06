from tests.factories import straight_route
from trips.domain.checkpoints import RouteProfile, place_checkpoints
from trips.domain.corridor import CORRIDOR_RADIUS_M, corridor_cells
from trips.domain.geo import LatLng
from trips.domain.weather_grid import cell_for
from trips.domain.weather_sampling import choose_sampling

# ~3 degrees of longitude (~170 mi) at 35 N.
PROFILES = [RouteProfile(straight_route(length_deg=3))]
CHECKPOINTS = [place_checkpoints(p, 10) for p in PROFILES]


def checkpoint_cells(resolution):
    return {cell_for(c.position, resolution) for cps in CHECKPOINTS for c in cps}


def corridor(resolution):
    return corridor_cells(PROFILES, resolution, CORRIDOR_RADIUS_M)


def test_checkpoints_get_a_fine_grid_and_the_heatmap_a_quarter_degree():
    sampling = choose_sampling(PROFILES, CHECKPOINTS, budget=10_000)

    assert sampling.checkpoint_resolution_deg == 0.0625
    assert sampling.corridor_resolution_deg == 0.25
    assert all(c.resolution_deg == 0.25 for c in sampling.corridor)


def test_checkpoints_10_miles_apart_read_different_forecasts():
    sampling = choose_sampling(PROFILES, CHECKPOINTS, budget=10_000)

    (cells,) = sampling.checkpoint_cells
    assert len(cells) == len(CHECKPOINTS[0])
    assert all(a != b for a, b in zip(cells, cells[1:], strict=False))


def test_every_location_is_requested_once():
    # Two identical routes: their checkpoints share cells.
    twice = choose_sampling(PROFILES * 2, CHECKPOINTS * 2, budget=10_000)

    assert len(twice.locations) == len(checkpoint_cells(0.0625)) + len(corridor(0.25))


def test_the_heatmap_coarsens_before_the_checkpoints():
    budget = len(checkpoint_cells(0.0625)) + len(corridor(0.5))

    sampling = choose_sampling(PROFILES, CHECKPOINTS, budget=budget)

    assert sampling.checkpoint_resolution_deg == 0.0625
    assert sampling.corridor_resolution_deg == 0.5
    assert len(sampling.locations) <= budget


def test_checkpoints_coarsen_only_when_the_coarsest_heatmap_is_not_enough():
    budget = len(checkpoint_cells(0.0625)) + len(corridor(1.0)) - 1

    sampling = choose_sampling(PROFILES, CHECKPOINTS, budget=budget)

    # The finest checkpoint grid that fits; on this straight route 1/8 deg still
    # gives every 10-mile checkpoint its own cell, so 1/4 deg is the first saving.
    assert sampling.checkpoint_resolution_deg > 0.0625
    assert len(sampling.locations) <= budget


def test_an_impossible_budget_falls_back_to_the_coarsest_grids():
    sampling = choose_sampling(PROFILES, CHECKPOINTS, budget=1)

    assert (sampling.checkpoint_resolution_deg, sampling.corridor_resolution_deg) == (1.0, 1.0)


def test_checkpoint_cells_follow_route_and_checkpoint_order():
    north = RouteProfile(straight_route(start=LatLng(36.0, -100.0), length_deg=1))
    profiles = [*PROFILES, north]
    checkpoints = [place_checkpoints(p, 25) for p in profiles]

    sampling = choose_sampling(profiles, checkpoints, budget=10_000)

    for route_cells, route_checkpoints in zip(sampling.checkpoint_cells, checkpoints, strict=True):
        assert route_cells == tuple(cell_for(c.position, 0.0625) for c in route_checkpoints)
