/**
 * Turns the backend's ranking into plain-language explanations.
 * The backend decides; this module only words its decision.
 */
import type { PlannedRoute, RankingCriterion, StopKind, TripPlan } from '../../shared/api/types'
import { formatDuration, formatMiles } from '../../shared/format/format'
import { RISK_LABEL, type RiskLevel } from '../../shared/risk/riskLevels'

/** The brief's ranking order, as shown to the user. */
export const RANKING_STEPS: readonly { criterion: RankingCriterion; label: string }[] = [
  { criterion: 'no_travel_miles', label: 'Fewest No Travel miles' },
  { criterion: 'severe_miles', label: 'Fewest Severe miles' },
  { criterion: 'high_miles', label: 'Fewest High miles' },
  { criterion: 'average_risk', label: 'Lowest average risk' },
  { criterion: 'duration', label: 'Shortest travel time (door to door)' },
]

const RISKY_LEVELS: readonly RiskLevel[] = ['moderate', 'high', 'severe', 'no_travel']

interface CriterionCopy {
  better: string
  worse: string
  value: (route: PlannedRoute) => string
}

const milesAt = (level: RiskLevel) => (route: PlannedRoute) =>
  formatMiles(route.risk.miles_by_level[level])

const CRITERION_COPY: Record<RankingCriterion, CriterionCopy> = {
  no_travel_miles: {
    better: 'Fewer No Travel miles',
    worse: 'More No Travel miles',
    value: milesAt('no_travel'),
  },
  severe_miles: {
    better: 'Fewer Severe miles',
    worse: 'More Severe miles',
    value: milesAt('severe'),
  },
  high_miles: { better: 'Fewer High miles', worse: 'More High miles', value: milesAt('high') },
  average_risk: {
    better: 'Lower average risk',
    worse: 'Higher average risk',
    value: (route) => route.risk.average_risk?.toFixed(2) ?? 'n/a',
  },
  duration: {
    better: 'Shorter trip',
    worse: 'Longer trip',
    value: (route) => formatDuration(route.trip_duration_s),
  },
}

/** e.g. "More Severe miles than Route B (38 mi vs 0 mi)". */
export function compareOn(
  criterion: RankingCriterion,
  subject: PlannedRoute,
  reference: PlannedRoute,
  direction: 'better' | 'worse',
): string {
  const copy = CRITERION_COPY[criterion]
  return `${copy[direction]} than Route ${reference.id} (${copy.value(subject)} vs ${copy.value(reference)})`
}

/** True when both routes spend the same miles at every level above Low. */
export function sameRiskyMiles(a: PlannedRoute, b: PlannedRoute): boolean {
  return RISKY_LEVELS.every(
    (level) =>
      Math.round(a.risk.miles_by_level[level]) === Math.round(b.risk.miles_by_level[level]),
  )
}

/** "50 mi Moderate · 12 mi High", or a calm message when every mile is Low. */
export function riskyMilesSummary(route: PlannedRoute): string {
  const parts = RISKY_LEVELS.filter((level) => route.risk.miles_by_level[level] > 0).map(
    (level) => `${formatMiles(route.risk.miles_by_level[level])} ${RISK_LABEL[level]}`,
  )
  if (route.risk.no_data_miles > 0) parts.push(`${formatMiles(route.risk.no_data_miles)} no data`)
  return parts.length ? parts.join(' · ') : 'Low risk the whole way'
}

const STOP_NOUN: Record<StopKind, [singular: string, plural: string]> = {
  break: ['break (30 min)', 'breaks (30 min each)'],
  rest: ['rest (10 h)', 'rests (10 h each)'],
}

/**
 * Where a solo trip's extra time comes from, e.g.
 * "12 h 48 min driving + 1 break (30 min) + 1 rest (10 h)". Null when there are no stops.
 */
export function drivingSummary(route: PlannedRoute): string | null {
  if (route.stops.length === 0) return null
  const parts = [`${formatDuration(route.driving_duration_s)} driving`]
  for (const kind of ['break', 'rest'] as const) {
    const count = route.stops.filter((stop) => stop.kind === kind).length
    if (count > 0) parts.push(`${count} ${STOP_NOUN[kind][count === 1 ? 0 : 1]}`)
  }
  return parts.join(' + ')
}

/** The finest checkpoint weather grid (1/16 deg, ~4 mi); see docs/DECISIONS.md W1. */
const FINEST_CHECKPOINT_GRID_DEG = 0.0625
const MILES_PER_DEGREE_LAT = 69

/**
 * A note when checkpoint weather had to come from a coarser grid (very long
 * trips at fine spacing), so the driver knows the sampling is coarser than asked.
 */
export function samplingNote(plan: TripPlan): string | null {
  if (plan.checkpoint_resolution_deg <= FINEST_CHECKPOINT_GRID_DEG) return null
  const miles = Math.round(plan.checkpoint_resolution_deg * MILES_PER_DEGREE_LAT)
  return (
    `Long trip: checkpoint weather comes from a ~${miles}-mile grid ` +
    'to stay within the free forecast quota.'
  )
}

export type SummaryTone = 'success' | 'warning' | 'error'

export interface RecommendationSummary {
  tone: SummaryTone
  title: string
  body: string
}

export function summarizeRecommendation(plan: TripPlan): RecommendationSummary {
  const [best, runnerUp] = plan.routes
  const tone = toneFor(best.risk.worst_level)

  if (plan.all_routes_blocked) {
    return {
      tone: 'error',
      title: 'Every route crosses No Travel conditions',
      body:
        `Route ${best.id} has the fewest No Travel miles ` +
        `(${formatMiles(best.risk.miles_by_level.no_travel)}). Consider a later departure.`,
    }
  }

  if (!runnerUp) {
    return {
      tone,
      title: `Route ${best.id} is the only truck route found`,
      body: riskyMilesSummary(best),
    }
  }

  if (!runnerUp.decided_by) {
    return {
      tone,
      title: `Route ${best.id} recommended`,
      body: 'The routes tie on every criterion; the routing provider lists this one first.',
    }
  }

  let body = `${compareOn(runnerUp.decided_by, best, runnerUp, 'better')}.`
  // Make the average-risk trade-off visible (docs/DECISIONS.md K3a).
  const extraMiles = best.distance_mi - runnerUp.distance_mi
  if (runnerUp.decided_by === 'average_risk' && sameRiskyMiles(best, runnerUp) && extraMiles >= 1) {
    body +=
      ` Both routes have the same risky miles; Route ${best.id} is ` +
      `${formatMiles(extraMiles)} longer.`
  }
  return { tone, title: `Route ${best.id} recommended`, body }
}

/** Error tone is reserved for "every route is blocked"; any notable risk is a warning. */
function toneFor(level: RiskLevel | null): SummaryTone {
  return level === 'low' || level === 'moderate' ? 'success' : 'warning'
}
