import { Box, Card, CardActionArea, Stack, Typography } from '@mui/material'

import type { PlannedRoute } from '../../shared/api/types'
import {
  formatDayTime,
  formatDuration,
  formatDurationDelta,
  formatMiles,
  formatMilesDelta,
} from '../../shared/format/format'
import { RiskBadge } from '../../shared/risk/RiskBadge'
import { RiskBar } from '../../shared/risk/RiskBar'
import { RISK_LABEL } from '../../shared/risk/riskLevels'
import { RouteLetter } from '../../shared/ui/RouteLetter'
import { compareOn, drivingSummary, riskyMilesSummary } from './explain'

interface RouteCardProps {
  route: PlannedRoute
  recommended: PlannedRoute
  selected: boolean
  onSelect: () => void
}

/**
 * One route, about six facts: time first, then the difference from the
 * recommended route, then risk, then why it is not the recommendation.
 */
export function RouteCard({ route, recommended, selected, onSelect }: RouteCardProps) {
  const isRecommended = route.id === recommended.id
  const driving = drivingSummary(route)
  const deltas = [
    formatDurationDelta(route.trip_duration_s - recommended.trip_duration_s),
    formatMilesDelta(route.distance_mi - recommended.distance_mi),
  ].filter(Boolean)

  return (
    <Card
      sx={{
        borderColor: selected ? 'primary.main' : 'divider',
        boxShadow: selected ? (theme) => `0 0 0 1px ${theme.palette.primary.main}` : 'none',
        transition: 'border-color 120ms, box-shadow 120ms',
      }}
    >
      <CardActionArea onClick={onSelect} aria-pressed={selected} sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <RouteLetter id={route.id} active={selected} />
            <Typography variant="subtitle2" component="h3">
              Route {route.id}
            </Typography>
            {isRecommended && (
              <Typography
                variant="caption"
                sx={{ fontWeight: 700, color: 'primary.main', letterSpacing: '0.02em' }}
              >
                RECOMMENDED
              </Typography>
            )}
            <Box sx={{ flex: 1 }} />
            {route.risk.worst_level && (
              <RiskBadge
                level={route.risk.worst_level}
                label={`Worst: ${RISK_LABEL[route.risk.worst_level]}`}
              />
            )}
          </Stack>

          <Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
              <Typography variant="h3" component="p">
                {formatDuration(route.trip_duration_s)}
              </Typography>
              {!isRecommended && deltas.length > 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  {deltas.join(' · ')}
                </Typography>
              )}
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {formatMiles(route.distance_mi)} · Arrives {formatDayTime(route.arrival)}
            </Typography>
            {driving && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {driving}
              </Typography>
            )}
          </Box>

          <Stack spacing={0.75}>
            <RiskBar risk={route.risk} />
            <Typography variant="caption" color="text.secondary">
              {riskyMilesSummary(route)}
            </Typography>
          </Stack>

          {!isRecommended && route.decided_by && (
            <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 500 }}>
              {compareOn(route.decided_by, route, recommended, 'worse')}
            </Typography>
          )}
        </Stack>
      </CardActionArea>
    </Card>
  )
}
