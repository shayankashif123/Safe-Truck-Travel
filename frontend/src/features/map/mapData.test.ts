import { describe, expect, it } from 'vitest'

import type { LngLat, PlannedRoute, TripPlan } from '../../shared/api/types'
import { checkpointFeatures, labelAnchors, planBounds, pointAlong, routeFeatures } from './mapData'

function route(id: string, geometry: LngLat[], levels: (string | null)[] = []): PlannedRoute {
  return {
    id,
    rank: 1,
    recommended: id === 'A',
    decided_by: null,
    distance_mi: 100,
    duration_s: 3600,
    arrival: '2026-11-07T15:00:00Z',
    risk: {
      miles_by_level: { low: 100, moderate: 0, high: 0, severe: 0, no_travel: 0 },
      no_data_miles: 0,
      average_risk: 0,
      worst_level: 'low',
    },
    geometry,
    checkpoints: levels.map((level, i) => ({
      mile: i * 25,
      position: geometry[Math.min(i, geometry.length - 1)],
      eta: '2026-11-07T14:00:00Z',
      level: level as PlannedRoute['checkpoints'][number]['level'],
      drivers: [],
      load_escalated: false,
      weather: null,
    })),
  }
}

function plan(routes: PlannedRoute[]): TripPlan {
  return {
    departure: '2026-11-07T14:00:00Z',
    load_lb: 40_000,
    spacing_mi: 25,
    recommended_route_id: routes[0].id,
    all_routes_blocked: false,
    routes,
    heatmap: { resolution_deg: 0.25, start: '2026-11-07T14:00:00Z', frames: 49, cells: [] },
  }
}

const STRAIGHT: LngLat[] = [
  [-100, 35],
  [-99, 35],
  [-98, 35],
]

describe('routeFeatures', () => {
  it('makes one line per route, tagged with its id', () => {
    const collection = routeFeatures(plan([route('A', STRAIGHT), route('B', STRAIGHT)]))
    expect(collection.features.map((f) => f.properties.routeId)).toEqual(['A', 'B'])
    expect(collection.features[0].geometry.coordinates).toEqual(STRAIGHT)
  })
})

describe('checkpointFeatures', () => {
  it('flattens every route, keeping route, index and level', () => {
    const collection = checkpointFeatures(
      plan([route('A', STRAIGHT, ['low', 'severe']), route('B', STRAIGHT, ['moderate'])]),
    )
    expect(collection.features.map((f) => f.properties)).toEqual([
      { routeId: 'A', index: 0, level: 'low' },
      { routeId: 'A', index: 1, level: 'severe' },
      { routeId: 'B', index: 0, level: 'moderate' },
    ])
  })

  it('shows missing forecasts as no data, never as low', () => {
    const collection = checkpointFeatures(plan([route('A', STRAIGHT, [null])]))
    expect(collection.features[0].properties.level).toBe('no_data')
  })
})

describe('planBounds', () => {
  it('covers every route', () => {
    const north = route('B', [
      [-101, 36],
      [-97.5, 37],
    ])
    expect(planBounds(plan([route('A', STRAIGHT), north]))).toEqual([
      [-101, 35],
      [-97.5, 37],
    ])
  })
})

describe('pointAlong', () => {
  it('interpolates by distance and clamps to the ends', () => {
    expect(pointAlong(STRAIGHT, 0.5)).toEqual([-99, 35])
    expect(pointAlong(STRAIGHT, 0.25)).toEqual([-99.5, 35])
    expect(pointAlong(STRAIGHT, -1)).toEqual([-100, 35])
    expect(pointAlong(STRAIGHT, 2)).toEqual([-98, 35])
  })
})

describe('labelAnchors', () => {
  it('uses the midpoint when a route is alone', () => {
    expect(labelAnchors(plan([route('A', STRAIGHT)]))).toEqual({ A: [-99, 35] })
  })

  it('moves a label away from where another route runs alongside', () => {
    // B shares A's western half, then splits off north-east.
    const a = route('A', [
      [-100, 35],
      [-99, 35],
      [-98, 35],
    ])
    const b = route('B', [
      [-100, 35],
      [-99, 35],
      [-98, 36.5],
    ])
    const anchors = labelAnchors(plan([a, b]))
    expect(anchors.B[0]).toBeGreaterThan(-99) // on the part of B that is apart from A
    expect(anchors.B).not.toEqual(anchors.A)
  })
})
