import { describe, expect, it } from 'vitest'

import type { Heatmap, PlannedRoute } from '../../shared/api/types'
import {
  frameLevels,
  frameTime,
  heatmapFeatures,
  indexCells,
  levelAt,
  NO_DATA,
  truckPositionAt,
} from './heatmapData'

const HEATMAP: Heatmap = {
  resolution_deg: 0.25,
  start: '2026-11-07T14:00:00Z',
  frames: 3,
  cells: [
    { row: 140, col: -400, levels: [0, 3, null] }, // lat 35.00-35.25, lng -100.00 to -99.75
    { row: 140, col: -399, levels: [1, 1, 4] },
  ],
}

// A 100-mile eastbound route: checkpoints at 0, 50 and 100 miles, one hour apart.
const ROUTE: PlannedRoute = {
  id: 'A',
  rank: 1,
  recommended: true,
  decided_by: null,
  distance_mi: 100,
  trip_duration_s: 7200,
  driving_duration_s: 7200,
  arrival: '2026-11-07T16:00:00Z',
  stops: [],
  risk: {
    miles_by_level: { low: 100, moderate: 0, high: 0, severe: 0, no_travel: 0 },
    no_data_miles: 0,
    average_risk: 0,
    worst_level: 'low',
  },
  geometry: [
    [-100, 35.1],
    [-99, 35.1],
  ],
  checkpoints: [0, 50, 100].map((mile, i) => ({
    mile,
    position: [-100 + mile / 100, 35.1] as [number, number],
    eta: new Date(Date.UTC(2026, 10, 7, 14 + i)).toISOString(),
    level: 'low' as const,
    drivers: [],
    load_escalated: false,
    weather: null,
  })),
}

describe('heatmapFeatures', () => {
  it('turns each cell into a square polygon on the grid', () => {
    const [first] = heatmapFeatures(HEATMAP).features
    expect(first.geometry.coordinates[0]).toEqual([
      [-100, 35],
      [-99.75, 35],
      [-99.75, 35.25],
      [-100, 35.25],
      [-100, 35],
    ])
  })

  it('ids features by cell index so levels can be applied as feature state', () => {
    expect(heatmapFeatures(HEATMAP).features.map((f) => f.id)).toEqual([0, 1])
  })
})

describe('frameLevels', () => {
  it('lists every cell level for a frame, with missing data as NO_DATA', () => {
    expect(frameLevels(HEATMAP, 0)).toEqual([0, 1])
    expect(frameLevels(HEATMAP, 2)).toEqual([NO_DATA, 4])
  })
})

describe('frameTime', () => {
  it('is the departure plus whole hours', () => {
    expect(frameTime(HEATMAP, 6).toISOString()).toBe('2026-11-07T20:00:00.000Z')
  })
})

describe('truckPositionAt', () => {
  it('starts at the origin at departure', () => {
    const truck = truckPositionAt(ROUTE, new Date('2026-11-07T14:00:00Z'))
    expect(truck).toEqual({ position: [-100, 35.1], mile: 0, arrived: false, stop: null })
  })

  it('interpolates between checkpoint ETAs and stays on the route line', () => {
    const truck = truckPositionAt(ROUTE, new Date('2026-11-07T14:30:00Z'))
    expect(truck.mile).toBe(25)
    expect(truck.position[0]).toBeCloseTo(-99.75)
    expect(truck.position[1]).toBeCloseTo(35.1)
  })

  it('reports arrival after the last ETA', () => {
    const truck = truckPositionAt(ROUTE, new Date('2026-11-07T20:00:00Z'))
    expect(truck).toEqual({ position: [-99, 35.1], mile: 100, arrived: true, stop: null })
  })

  describe('with a required rest', () => {
    // Same drive, but the truck rests 10 h at mile 75 (reached at 15:30).
    const REST = {
      kind: 'rest' as const,
      mile: 75,
      position: [-99.25, 35.1] as [number, number],
      start: '2026-11-07T15:30:00Z',
      end: '2026-11-08T01:30:00Z',
    }
    const RESTING: PlannedRoute = {
      ...ROUTE,
      trip_duration_s: 7200 + 36_000,
      stops: [REST],
      checkpoints: ROUTE.checkpoints.map((c, i) =>
        i === 2 ? { ...c, eta: '2026-11-08T02:00:00Z' } : c,
      ),
    }

    it('drives up to the stop, then stands still for its whole length', () => {
      expect(truckPositionAt(RESTING, new Date('2026-11-07T15:15:00Z')).mile).toBe(62.5)
      for (const at of ['2026-11-07T15:30:00Z', '2026-11-07T20:00:00Z', '2026-11-08T01:29:00Z']) {
        const truck = truckPositionAt(RESTING, new Date(at))
        expect(truck.mile).toBe(75)
        expect(truck.stop).toEqual(REST)
      }
    })

    it('moves on after the stop and arrives at the last ETA', () => {
      const after = truckPositionAt(RESTING, new Date('2026-11-08T01:45:00Z'))
      expect(after.mile).toBe(87.5)
      expect(after.stop).toBeNull()
      expect(truckPositionAt(RESTING, new Date('2026-11-08T02:00:00Z')).arrived).toBe(true)
    })
  })
})

describe('levelAt', () => {
  const index = indexCells(HEATMAP)

  it('reads the level of the cell under a point at a frame', () => {
    expect(levelAt(HEATMAP, index, [-99.9, 35.1], 1)).toBe(3)
    expect(levelAt(HEATMAP, index, [-99.7, 35.1], 2)).toBe(4)
  })

  it('returns null outside the corridor or without data', () => {
    expect(levelAt(HEATMAP, index, [-90, 40], 0)).toBeNull()
    expect(levelAt(HEATMAP, index, [-99.9, 35.1], 2)).toBeNull()
  })
})
