import { Box, Stack, Typography } from '@mui/material'

import { RANKING_STEPS } from './explain'

/** Shown before the first search: how routes will be judged. */
export function ResultsIntro() {
  return (
    <Box>
      <Typography variant="overline" color="text.secondary" component="h2">
        How routes are ranked
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
        Up to three truck routes are compared using the forecast for the hour the truck reaches each
        checkpoint. Each rule only breaks ties left by the one above it.
      </Typography>
      <Stack component="ol" spacing={1} sx={{ m: 0, p: 0, listStyle: 'none' }}>
        {RANKING_STEPS.map((step, index) => (
          <Stack
            key={step.criterion}
            component="li"
            direction="row"
            spacing={1.25}
            sx={{ alignItems: 'center' }}
          >
            <Box
              aria-hidden
              sx={{
                width: 20,
                height: 20,
                borderRadius: '6px',
                display: 'grid',
                placeItems: 'center',
                fontSize: '0.6875rem',
                fontWeight: 700,
                color: 'grey.600',
                bgcolor: 'grey.100',
                border: 1,
                borderColor: 'divider',
              }}
            >
              {index + 1}
            </Box>
            <Typography variant="body2">{step.label}</Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  )
}
