import { Box, Paper, Stack, Typography } from '@mui/material'

import { RISK_DISPLAY_LEVELS, RISK_LABEL } from '../../shared/risk/riskLevels'

export function RiskLegend() {
  return (
    <Paper
      component="section"
      aria-labelledby="risk-legend-title"
      variant="outlined"
      sx={{ px: 1.5, py: 1.25, minWidth: 148, boxShadow: '0 1px 2px rgb(15 23 42 / 0.06)' }}
    >
      <Typography
        id="risk-legend-title"
        variant="overline"
        component="h2"
        color="text.secondary"
        sx={{ display: 'block', mb: 0.5 }}
      >
        Risk level
      </Typography>

      <Stack component="ul" spacing={0.75} sx={{ m: 0, p: 0, listStyle: 'none' }}>
        {RISK_DISPLAY_LEVELS.map((level) => (
          <Stack
            component="li"
            key={level}
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center' }}
          >
            <Box
              aria-hidden
              sx={{
                width: 12,
                height: 12,
                borderRadius: '3px',
                bgcolor: (theme) => theme.palette.risk[level].main,
              }}
            />
            <Typography variant="body2">{RISK_LABEL[level]}</Typography>
          </Stack>
        ))}
      </Stack>
    </Paper>
  )
}
