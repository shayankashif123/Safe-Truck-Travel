import { Box, Stack, Tooltip, Typography } from '@mui/material'

import type { RouteRisk } from '../api/types'
import { formatMiles } from '../format/format'
import { RISK_LABEL, RISK_LEVELS, type RiskDisplayLevel } from './riskLevels'

interface Segment {
  level: RiskDisplayLevel
  miles: number
}

function segmentsOf(risk: RouteRisk): Segment[] {
  const segments: Segment[] = RISK_LEVELS.map((level) => ({
    level,
    miles: risk.miles_by_level[level],
  }))
  segments.push({ level: 'no_data', miles: risk.no_data_miles })
  return segments.filter((segment) => segment.miles > 0)
}

/** Share of the route's miles at each risk level, as one stacked bar. */
export function RiskBar({ risk }: { risk: RouteRisk }) {
  const segments = segmentsOf(risk)
  const total = segments.reduce((sum, s) => sum + s.miles, 0)
  const description = segments
    .map((s) => `${formatMiles(s.miles)} ${RISK_LABEL[s.level]}`)
    .join(', ')

  return (
    <Tooltip
      title={
        <Stack spacing={0.25}>
          {segments.map((s) => (
            <Typography key={s.level} variant="caption" sx={{ display: 'block' }}>
              {RISK_LABEL[s.level]}: {formatMiles(s.miles)}
            </Typography>
          ))}
        </Stack>
      }
    >
      <Box
        role="img"
        aria-label={`Miles by risk level: ${description}`}
        sx={{ display: 'flex', gap: '2px', height: 8, borderRadius: 999, overflow: 'hidden' }}
      >
        {segments.map((s) => (
          <Box
            key={s.level}
            sx={(theme) => ({
              flexGrow: s.miles / total,
              minWidth: 3,
              bgcolor: theme.palette.risk[s.level].main,
            })}
          />
        ))}
      </Box>
    </Tooltip>
  )
}
