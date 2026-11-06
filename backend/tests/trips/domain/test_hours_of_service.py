import pytest

from trips.domain.hours_of_service import (
    MAX_ON_DUTY_WINDOW_S,
    DriverMode,
    DrivingSchedule,
    StopKind,
    schedule_drive,
)

H = 3600.0


def kinds(schedule: DrivingSchedule) -> list[StopKind]:
    return [stop.kind for stop in schedule.stops]


@pytest.mark.parametrize("driving_h", [0, 1, 7.99, 8])
def test_no_stop_when_the_trip_ends_by_the_8_hour_break(driving_h):
    schedule = schedule_drive(driving_h * H, DriverMode.SOLO)

    assert schedule.stops == ()
    assert schedule.total_s == driving_h * H


def test_a_30_minute_break_after_8_hours_of_driving():
    schedule = schedule_drive(9 * H, DriverMode.SOLO)

    assert kinds(schedule) == [StopKind.BREAK]
    (brk,) = schedule.stops
    assert (brk.driving_s, brk.start_s, brk.end_s) == (8 * H, 8 * H, 8.5 * H)
    assert schedule.total_s == 9.5 * H


def test_no_rest_when_the_trip_ends_exactly_at_the_11_hour_limit():
    schedule = schedule_drive(11 * H, DriverMode.SOLO)

    assert kinds(schedule) == [StopKind.BREAK]
    assert schedule.total_s == 11.5 * H


def test_a_10_hour_rest_after_11_hours_then_the_cycle_repeats():
    schedule = schedule_drive(30 * H, DriverMode.SOLO)

    assert kinds(schedule) == [
        StopKind.BREAK,  # 8 h driven
        StopKind.REST,  # 11 h
        StopKind.BREAK,  # 19 h: the rest also restarted the 8-hour break clock
        StopKind.REST,  # 22 h; the next break (30 h) is not needed: the trip ends
    ]
    assert [s.driving_s / H for s in schedule.stops] == [8, 11, 19, 22]
    assert [s.start_s / H for s in schedule.stops] == [8, 11.5, 29.5, 33]
    assert schedule.total_s == (30 + 0.5 + 10 + 0.5 + 10) * H


def test_a_solo_shift_fits_the_14_hour_window():
    # The module's claim that the 14-hour on-duty window never binds.
    schedule = schedule_drive(40 * H, DriverMode.SOLO)
    shift_start = 0.0
    for stop in schedule.stops:
        if stop.kind is StopKind.REST:
            assert stop.start_s - shift_start <= MAX_ON_DUTY_WINDOW_S
            shift_start = stop.end_s


def test_a_team_drives_without_stopping():
    schedule = schedule_drive(30 * H, DriverMode.TEAM)

    assert schedule.stops == ()
    assert schedule.total_s == 30 * H


def test_elapsed_time_adds_only_the_stops_already_made():
    schedule = schedule_drive(12 * H, DriverMode.SOLO)

    assert schedule.elapsed_at(0) == 0
    assert schedule.elapsed_at(8 * H) == 8 * H  # arrives, then takes the break
    assert schedule.elapsed_at(9 * H) == 9.5 * H
    assert schedule.elapsed_at(11 * H) == 11.5 * H  # arrives, then rests
    assert schedule.elapsed_at(12 * H) == 22.5 * H == schedule.total_s


def test_more_driving_never_arrives_earlier():
    # Why the stops cannot reorder routes on travel time (docs/DECISIONS.md T3).
    totals = [schedule_drive(m * 60, DriverMode.SOLO).total_s for m in range(0, 50 * 60, 7)]

    assert totals == sorted(totals)


def test_rejects_negative_driving_time():
    with pytest.raises(ValueError):
        schedule_drive(-1, DriverMode.SOLO)
