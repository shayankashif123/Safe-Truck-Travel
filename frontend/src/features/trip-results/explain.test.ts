import { describe, expect, it } from 'vitest'

import type { PlannedRoute, RankingCriterion, TripPlan } from '../../shared/api/types'
import type { RiskLevel } from '../../shared/risk/riskLevels'
import {
  compareOn,
  drivingSummary,
  riskyMilesSummary,
  sameRiskyMiles,
  summarizeRecommendation,
} from './explain'

function route(
  id: string,
  {
    miles = {},
    distance = 800,
    hours = 12,
    average = 0,
    decidedBy = null,
    noData = 0,
  }: {
    miles?: Partial<Record<RiskLevel, number>>
    distance?: number
    hours?: number
    average?: number | null
    decidedBy?: RankingCriterion | null
    noData?: number
  } = {},
): PlannedRoute {
  const byLevel = { low: 0, moderate: 0, high: 0, severe: 0, no_travel: 0, ...miles }
  const worst = (['no_travel', 'severe', 'high', 'moderate', 'low'] as const).find(
    (l) => byLevel[l] > 0,
  )
  return {
    id,
    rank: 0,
    recommended: false,
    decided_by: decidedBy,
    distance_mi: distance,
    trip_duration_s: hours * 3600,
    driving_duration_s: hours * 3600,
    arrival: '2026-11-08T03:00:00Z',
    stops: [],
    risk: {
      miles_by_level: byLevel,
      no_data_miles: noData,
      average_risk: average,
      worst_level: worst ?? null,
    },
    geometry: [],
    checkpoints: [],
  }
}

function plan(routes: PlannedRoute[], blocked = false): TripPlan {
  return {
    departure: '2026-11-07T14:00:00Z',
    origin_time_zone: 'America/Chicago',
    destination_time_zone: 'America/Denver',
    load_lb: 40_000,
    spacing_mi: 25,
    driver: 'solo',
    recommended_route_id: routes[0].id,
    all_routes_blocked: blocked,
    routes,
    heatmap: { resolution_deg: 0.25, start: '2026-11-07T14:00:00Z', frames: 49, cells: [] },
  }
}

describe('compareOn', () => {
  it('words a miles criterion from either side', () => {
    const a = route('A', { miles: { severe: 38 } })
    const b = route('B')
    expect(compareOn('severe_miles', a, b, 'worse')).toBe(
      'More Severe miles than Route B (38 mi vs 0 mi)',
    )
    expect(compareOn('severe_miles', b, a, 'better')).toBe(
      'Fewer Severe miles than Route A (0 mi vs 38 mi)',
    )
  })

  it('words average risk with two decimals and duration as time', () => {
    const a = route('A', { average: 0.054, hours: 13 })
    const b = route('B', { average: 0.062, hours: 12.5 })
    expect(compareOn('average_risk', a, b, 'better')).toBe(
      'Lower average risk than Route B (0.05 vs 0.06)',
    )
    expect(compareOn('duration', b, a, 'better')).toBe(
      'Shorter trip than Route A (12 h 30 min vs 13 h)',
    )
  })
})

describe('riskyMilesSummary', () => {
  it('lists every level above Low and missing data', () => {
    expect(riskyMilesSummary(route('A', { miles: { moderate: 50, high: 12 }, noData: 25 }))).toBe(
      '50 mi Moderate · 12 mi High · 25 mi no data',
    )
  })

  it('reassures when everything is Low', () => {
    expect(riskyMilesSummary(route('A', { miles: { low: 800 } }))).toBe('Low risk the whole way')
  })
})

describe('summarizeRecommendation', () => {
  it('names the deciding criterion against the runner-up', () => {
    const best = route('B', { miles: { low: 900 } })
    const runnerUp = route('A', { miles: { severe: 38 }, decidedBy: 'severe_miles' })
    const summary = summarizeRecommendation(plan([best, runnerUp]))
    expect(summary.title).toBe('Route B recommended')
    expect(summary.body).toBe('Fewer Severe miles than Route A (0 mi vs 38 mi).')
    expect(summary.tone).toBe('success')
  })

  it('points out when average risk favoured a longer route with the same risky miles (K3a)', () => {
    const best = route('B', { miles: { moderate: 50 }, distance: 930, average: 0.054 })
    const runnerUp = route('A', {
      miles: { moderate: 50 },
      distance: 803,
      average: 0.062,
      decidedBy: 'average_risk',
    })
    expect(summarizeRecommendation(plan([best, runnerUp])).body).toBe(
      'Lower average risk than Route A (0.05 vs 0.06). ' +
        'Both routes have the same risky miles; Route B is 127 mi longer.',
    )
  })

  it('warns when every route is blocked', () => {
    const best = route('A', { miles: { no_travel: 12 } })
    const summary = summarizeRecommendation(
      plan([best, route('B', { miles: { no_travel: 40 } })], true),
    )
    expect(summary.tone).toBe('error')
    expect(summary.body).toMatch(/fewest No Travel miles \(12 mi\)/)
  })

  it('uses a warning tone when even the best route has Severe miles', () => {
    expect(summarizeRecommendation(plan([route('A', { miles: { severe: 5 } })])).tone).toBe(
      'warning',
    )
  })

  it('handles a single route and a full tie', () => {
    expect(summarizeRecommendation(plan([route('A')])).title).toMatch(/only truck route/)
    expect(summarizeRecommendation(plan([route('A'), route('B')])).body).toMatch(
      /tie on every criterion/,
    )
  })
})

describe('sameRiskyMiles', () => {
  it('ignores Low miles and sub-mile rounding', () => {
    expect(
      sameRiskyMiles(
        route('A', { miles: { low: 10, high: 5.2 } }),
        route('B', { miles: { low: 99, high: 4.9 } }),
      ),
    ).toBe(true)
    expect(
      sameRiskyMiles(route('A', { miles: { high: 5 } }), route('B', { miles: { severe: 5 } })),
    ).toBe(false)
  })
})

describe('drivingSummary', () => {
  const stop = (kind: 'break' | 'rest') => ({
    kind,
    mile: 0,
    position: [0, 0] as [number, number],
    start: '2026-11-07T22:00:00Z',
    end: '2026-11-07T22:30:00Z',
    time_zone: null,
  })

  it('is null when the truck makes no stops', () => {
    expect(drivingSummary(route('A'))).toBeNull()
  })

  it('explains where the extra time of a solo trip comes from', () => {
    const solo = { ...route('A', { hours: 12.8 }), stops: [stop('break'), stop('rest')] }
    expect(drivingSummary(solo)).toBe('12 h 48 min driving + 1 break (30 min) + 1 rest (10 h)')
  })

  it('counts repeated stops', () => {
    const long = {
      ...route('A', { hours: 30 }),
      stops: ['break', 'rest', 'break', 'rest'].map((k) => stop(k as 'break' | 'rest')),
    }
    expect(drivingSummary(long)).toBe('30 h driving + 2 breaks (30 min each) + 2 rests (10 h each)')
  })
})
