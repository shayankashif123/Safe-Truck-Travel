import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded'
import ErrorRounded from '@mui/icons-material/ErrorRounded'
import WarningRounded from '@mui/icons-material/WarningRounded'
import { Box, Stack, Typography } from '@mui/material'

import type { TripPlan } from '../../shared/api/types'
import { type SummaryTone, summarizeRecommendation } from './explain'

const TONE: Record<SummaryTone, { color: string; Icon: typeof CheckCircleRounded }> = {
  success: { color: 'success.main', Icon: CheckCircleRounded },
  warning: { color: 'warning.main', Icon: WarningRounded },
  error: { color: 'error.main', Icon: ErrorRounded },
}

/** The headline answer: which route, and the one reason that decided it. */
export function RecommendationSummary({ plan }: { plan: TripPlan }) {
  const summary = summarizeRecommendation(plan)
  const { color, Icon } = TONE[summary.tone]

  return (
    <Box
      component="section"
      aria-label="Recommendation"
      sx={{ pl: 1.5, py: 0.5, borderLeft: 3, borderColor: color }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Icon sx={{ color, fontSize: 18 }} />
        <Typography variant="subtitle2" component="h3">
          {summary.title}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {summary.body}
      </Typography>
    </Box>
  )
}
