import pytest

from tests.factories import straight_route
from trips.domain.checkpoints import RouteProfile, place_checkpoints
from trips.domain.errors import InvalidInput
from trips.domain.geometry import METERS_PER_MILE
from trips.domain.routes import ProgressMark, Route


def test_checkpoints_start_at_origin_every_n_miles_and_end_at_destination():
    route = straight_route(provider_length_m=57 * METERS_PER_MILE)

    checkpoints = place_checkpoints(RouteProfile(route), spacing_mi=10)

    assert [round(c.mile, 3) for c in checkpoints] == [0, 10, 20, 30, 40, 50, 57]
    assert checkpoints[0].position == route.points[0]
    assert checkpoints[-1].position == route.points[-1]


def test_no_duplicate_checkpoint_when_length_is_an_exact_multiple():
    route = straight_route(provider_length_m=50 * METERS_PER_MILE)

    checkpoints = place_checkpoints(RouteProfile(route), spacing_mi=25)

    assert [round(c.mile, 3) for c in checkpoints] == [0, 25, 50]


@pytest.mark.parametrize("spacing", [10, 25, 50])
def test_each_supported_spacing_produces_ordered_checkpoints(spacing):
    checkpoints = place_checkpoints(RouteProfile(straight_route(length_deg=3)), spacing)

    miles = [c.mile for c in checkpoints]
    assert miles == sorted(miles)
    assert all(b - a <= spacing + 1e-9 for a, b in zip(miles, miles[1:], strict=False))


def test_rejects_unsupported_spacing():
    with pytest.raises(InvalidInput):
        place_checkpoints(RouteProfile(straight_route()), spacing_mi=30)


def test_distances_follow_the_providers_measured_length():
    # The provider says the road is 10% longer than the straight line.
    geometric = RouteProfile(straight_route()).length_m
    route = straight_route(provider_length_m=geometric * 1.1)

    profile = RouteProfile(route)

    assert profile.length_m == pytest.approx(geometric * 1.1)
    # Halfway along the road is still halfway along the line.
    assert profile.position_at(profile.length_m / 2).lng == pytest.approx(-99.5, abs=1e-6)


def test_eta_follows_the_providers_time_profile_not_an_average_speed():
    # Two hours in total; the first half (e.g. city traffic) takes 75% of it.
    route = straight_route(hours=2, first_half_share=0.75)
    profile = RouteProfile(route)
    half = profile.length_m / 2

    assert profile.elapsed_at(0) == 0
    assert profile.elapsed_at(half / 2) == pytest.approx(0.75 * 3600)  # quarter way: 45 min
    assert profile.elapsed_at(half) == pytest.approx(1.5 * 3600)
    assert profile.elapsed_at(profile.length_m) == pytest.approx(2 * 3600)


def test_positions_and_times_are_clamped_to_the_route():
    profile = RouteProfile(straight_route())

    assert profile.position_at(-50) == profile.route.points[0]
    assert profile.elapsed_at(profile.length_m + 500) == profile.route.duration_s


def test_route_rejects_a_profile_that_goes_backwards():
    points = straight_route().points
    backwards = (ProgressMark(0, 0, 0), ProgressMark(50, 900, 60), ProgressMark(100, 800, 120))

    with pytest.raises(ValueError):
        Route(points, backwards, 800, 120)
