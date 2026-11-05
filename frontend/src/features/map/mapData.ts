/**
 * TripPlan -> map data. Pure functions, unit tested, memoised per plan by the
 * map component, so the GPU receives each dataset once per plan.
 */
import type { FeatureCollection, LineString, Point } from 'geojson'

import type { LngLat, TripPlan } from '../../shared/api/types'
import type { RiskDisplayLevel } from '../../shared/risk/riskLevels'

export interface RouteFeatureProps {
  routeId: string
}

export interface CheckpointFeatureProps {
  routeId: string
  index: number
  level: RiskDisplayLevel
}

export type Bounds = [LngLat, LngLat]

export function routeFeatures(plan: TripPlan): FeatureCollection<LineString, RouteFeatureProps> {
  return {
    type: 'FeatureCollection',
    features: plan.routes.map((route) => ({
      type: 'Feature',
      properties: { routeId: route.id },
      geometry: { type: 'LineString', coordinates: route.geometry },
    })),
  }
}

export function checkpointFeatures(
  plan: TripPlan,
): FeatureCollection<Point, CheckpointFeatureProps> {
  return {
    type: 'FeatureCollection',
    features: plan.routes.flatMap((route) =>
      route.checkpoints.map((checkpoint, index) => ({
        type: 'Feature' as const,
        properties: { routeId: route.id, index, level: checkpoint.level ?? 'no_data' },
        geometry: { type: 'Point' as const, coordinates: checkpoint.position },
      })),
    ),
  }
}

/** South-west and north-east corners around every route. */
export function planBounds(plan: TripPlan): Bounds {
  let [minLng, minLat, maxLng, maxLat] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const route of plan.routes) {
    for (const [lng, lat] of route.geometry) {
      minLng = Math.min(minLng, lng)
      minLat = Math.min(minLat, lat)
      maxLng = Math.max(maxLng, lng)
      maxLat = Math.max(maxLat, lat)
    }
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ]
}

/** Point `fraction` (0..1) of the way along a line, by distance. */
export function pointAlong(line: LngLat[], fraction: number): LngLat {
  const lengths = segmentLengths(line)
  const total = lengths.reduce((sum, length) => sum + length, 0)
  let remaining = Math.max(0, Math.min(1, fraction)) * total
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i] && lengths[i] > 0) {
      const t = remaining / lengths[i]
      const [a, b] = [line[i], line[i + 1]]
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
    }
    remaining -= lengths[i]
  }
  return line[line.length - 1]
}

const LABEL_CANDIDATES = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8]
const MAX_SAMPLES_PER_ROUTE = 200

/**
 * Where to put each route's label: the candidate point along the route that is
 * farthest from every other route, so labels of nearby routes do not overlap.
 */
export function labelAnchors(plan: TripPlan): Record<string, LngLat> {
  const anchors: Record<string, LngLat> = {}
  for (const route of plan.routes) {
    const others = plan.routes
      .filter((other) => other.id !== route.id)
      .flatMap((other) => sample(other.geometry, MAX_SAMPLES_PER_ROUTE))

    let best = pointAlong(route.geometry, LABEL_CANDIDATES[0])
    let bestClearance = -1
    for (const fraction of LABEL_CANDIDATES) {
      const candidate = pointAlong(route.geometry, fraction)
      const clearance = others.length
        ? Math.min(...others.map((point) => planarDistance(candidate, point)))
        : Infinity
      if (clearance > bestClearance) {
        best = candidate
        bestClearance = clearance
      }
    }
    anchors[route.id] = best
  }
  return anchors
}

function segmentLengths(line: LngLat[]): number[] {
  return line.slice(1).map((point, i) => planarDistance(line[i], point))
}

/** Distance in degrees with longitude scaled by latitude; fine for comparisons. */
function planarDistance(a: LngLat, b: LngLat): number {
  const cosLat = Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180)
  return Math.hypot((b[0] - a[0]) * cosLat, b[1] - a[1])
}

function sample(line: LngLat[], max: number): LngLat[] {
  const step = Math.max(1, Math.ceil(line.length / max))
  return line.filter((_, i) => i % step === 0)
}
