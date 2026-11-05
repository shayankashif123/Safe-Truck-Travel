"""Distances and line simplification on the Earth's surface."""

import math
from collections.abc import Sequence

from trips.domain.geo import LatLng

EARTH_RADIUS_M = 6_371_008.8
METERS_PER_MILE = 1609.344
METERS_PER_DEGREE_LAT = math.pi * EARTH_RADIUS_M / 180  # ~111 km


def haversine_m(a: LatLng, b: LatLng) -> float:
    """Great-circle distance in meters."""
    phi1, phi2 = math.radians(a.lat), math.radians(b.lat)
    d_phi = phi2 - phi1
    d_lambda = math.radians(b.lng - a.lng)
    h = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(min(1.0, math.sqrt(h)))


def simplify(points: Sequence[LatLng], tolerance_m: float) -> list[LatLng]:
    """
    Reduce a polyline to the points needed to stay within `tolerance_m` of the
    original. Endpoints are always kept.

    Two passes, as in simplify.js: a cheap radial pass drops points closer than
    the tolerance to the previous kept point, then Douglas-Peucker removes
    points that lie close to the line through their neighbours. Used to send the
    browser a few hundred points per route instead of ~10,000.
    """
    if len(points) < 3:
        return list(points)

    # Project to a local flat plane in meters: accurate for deviations of tens
    # of meters and far cheaper than spherical geometry.
    mean_lat = math.radians(sum(p.lat for p in points) / len(points))
    x_scale = METERS_PER_DEGREE_LAT * math.cos(mean_lat)
    xs = [p.lng * x_scale for p in points]
    ys = [p.lat * METERS_PER_DEGREE_LAT for p in points]
    tolerance_sq = tolerance_m * tolerance_m

    # Pass 1: radial distance.
    candidates = [0]
    last_x, last_y = xs[0], ys[0]
    for i in range(1, len(points) - 1):
        dx, dy = xs[i] - last_x, ys[i] - last_y
        if dx * dx + dy * dy > tolerance_sq:
            candidates.append(i)
            last_x, last_y = xs[i], ys[i]
    candidates.append(len(points) - 1)

    # Pass 2: Douglas-Peucker over the candidates (squared distances, no sqrt).
    keep = [False] * len(candidates)
    keep[0] = keep[-1] = True
    stack = [(0, len(candidates) - 1)]
    while stack:
        first, last = stack.pop()
        ax, ay = xs[candidates[first]], ys[candidates[first]]
        bx, by = xs[candidates[last]], ys[candidates[last]]
        dx, dy = bx - ax, by - ay
        length_sq = dx * dx + dy * dy
        farthest, farthest_sq = -1, tolerance_sq
        for k in range(first + 1, last):
            px, py = xs[candidates[k]], ys[candidates[k]]
            if length_sq:
                t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length_sq))
                ex, ey = px - (ax + t * dx), py - (ay + t * dy)
            else:
                ex, ey = px - ax, py - ay
            distance_sq = ex * ex + ey * ey
            if distance_sq > farthest_sq:
                farthest, farthest_sq = k, distance_sq
        if farthest != -1:
            keep[farthest] = True
            stack.extend(((first, farthest), (farthest, last)))

    return [points[candidates[k]] for k, kept in enumerate(keep) if kept]
