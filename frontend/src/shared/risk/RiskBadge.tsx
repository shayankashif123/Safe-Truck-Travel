import { Box } from '@mui/material'

import { RISK_LABEL, type RiskDisplayLevel } from './riskLevels'

interface RiskBadgeProps {
  level: RiskDisplayLevel
  /** Overrides the default label, e.g. "Worst: Severe". */
  label?: string
}

/** Compact level pill: tinted background, coloured dot, readable text. */
export function RiskBadge({ level, label }: RiskBadgeProps) {
  return (
    <Box
      component="span"
      sx={(theme) => ({
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1,
        py: 0.25,
        borderRadius: 999,
        fontSize: '0.75rem',
        fontWeight: 600,
        lineHeight: 1.6,
        whiteSpace: 'nowrap',
        color: theme.palette.risk[level].text,
        bgcolor: theme.palette.risk[level].surface,
      })}
    >
      <Box
        component="span"
        aria-hidden
        sx={(theme) => ({
          width: 6,
          height: 6,
          borderRadius: '50%',
          bgcolor: theme.palette.risk[level].main,
        })}
      />
      {label ?? RISK_LABEL[level]}
    </Box>
  )
}
