import { Box, Paper, Stack, Typography } from '@mui/material'

import { RISK_DISPLAY_LEVELS, RISK_LABEL } from '../../shared/risk/riskLevels'

const Swatch = ({ level }: { level: (typeof RISK_DISPLAY_LEVELS)[number] }) => (
  <Box
    aria-hidden
    sx={{
      width: 10,
      height: 10,
      flexShrink: 0,
      borderRadius: '3px',
      bgcolor: (theme) => theme.palette.risk[level].main,
    }}
  />
)

/** Compact one-line legend, used inside the heatmap panel. */
export function RiskLegendRow() {
  return (
    <Stack
      component="ul"
      aria-label="Risk levels"
      direction="row"
      sx={{ m: 0, p: 0, listStyle: 'none', flexWrap: 'wrap', columnGap: 1.5, rowGap: 0.5 }}
    >
      {RISK_DISPLAY_LEVELS.map((level) => (
        <Stack
          key={level}
          component="li"
          direction="row"
          spacing={0.75}
          sx={{ alignItems: 'center' }}
        >
          <Swatch level={level} />
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
            {RISK_LABEL[level]}
          </Typography>
        </Stack>
      ))}
    </Stack>
  )
}

/** Stand-alone legend card, shown on the map before any trip is planned. */
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
            <Swatch level={level} />
            <Typography variant="body2">{RISK_LABEL[level]}</Typography>
          </Stack>
        ))}
      </Stack>
    </Paper>
  )
}
