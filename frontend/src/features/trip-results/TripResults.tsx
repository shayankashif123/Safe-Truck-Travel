import { Box, LinearProgress, Stack, Typography } from '@mui/material'

import { formatLocalTime, formatPounds } from '../../shared/format/format'
import type { TripPlanner } from '../trip-planner/useTripPlanner'
import { routeCountNote, samplingNote } from './explain'
import { RecommendationSummary } from './RecommendationSummary'
import { ResultsError } from './ResultsError'
import { ResultsIntro } from './ResultsIntro'
import { ResultsLoading } from './ResultsLoading'
import { RouteCard } from './RouteCard'

/** Switches between intro, loading, error and results without layout jumps. */
export function TripResults({ planner }: { planner: TripPlanner }) {
  const { status, plan, error } = planner

  if (status === 'error' && error) return <ResultsError error={error} onRetry={planner.retry} />
  if (!plan) return status === 'loading' ? <ResultsLoading /> : <ResultsIntro />

  // A re-plan (e.g. new spacing) keeps the previous results visible but dimmed,
  // so a sub-second refresh does not flash skeletons.
  const refreshing = status === 'loading'
  const recommended = plan.routes[0]
  const notes = [routeCountNote(plan), samplingNote(plan)].filter((note) => note !== null)

  return (
    <Box component="section" aria-label="Route comparison" aria-busy={refreshing}>
      <Box sx={{ height: 2, mb: 1.5 }}>{refreshing && <LinearProgress />}</Box>
      <Stack spacing={2} sx={{ opacity: refreshing ? 0.55 : 1, transition: 'opacity 150ms' }}>
        <Box>
          <Typography variant="overline" color="text.secondary" component="h2">
            {plan.routes.length} {plan.routes.length === 1 ? 'route' : 'routes'} compared
          </Typography>
          <Typography variant="caption" color="text.secondary" component="p">
            Departs {formatLocalTime(plan.departure, plan.origin_time_zone)} ·{' '}
            {formatPounds(plan.load_lb)} · checkpoint every {plan.spacing_mi} mi
          </Typography>
          {notes.map((note) => (
            <Typography
              key={note}
              variant="caption"
              color="warning.dark"
              component="p"
              sx={{ mt: 0.5 }}
            >
              {note}
            </Typography>
          ))}
        </Box>

        <RecommendationSummary plan={plan} />

        <Stack spacing={1.5}>
          {plan.routes.map((route) => (
            <RouteCard
              key={route.id}
              route={route}
              recommended={recommended}
              arrivalTimeZone={plan.destination_time_zone}
              selected={route.id === planner.selectedRouteId}
              onSelect={() => planner.selectRoute(route.id)}
            />
          ))}
        </Stack>
      </Stack>
    </Box>
  )
}
