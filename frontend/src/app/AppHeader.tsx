import { Box, Stack, Typography } from '@mui/material'

import { type ApiHealth, useApiHealth } from '../shared/hooks/useApiHealth'

const HEALTH_LABEL: Record<ApiHealth, string> = {
  checking: 'Connecting…',
  online: 'API online',
  offline: 'API offline',
}

const HEALTH_COLOR: Record<ApiHealth, string> = {
  checking: 'grey.300',
  online: 'success.main',
  offline: 'error.main',
}

export function AppHeader() {
  const health = useApiHealth()

  return (
    <Box
      component="header"
      sx={{
        height: 56,
        px: 2.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <Box
          aria-hidden
          sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: 'primary.main' }}
        />
        <Typography variant="h1">Weather-Aware Truck Routing</Typography>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }} role="status">
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: HEALTH_COLOR[health] }} />
        <Typography variant="caption" color="text.secondary">
          {HEALTH_LABEL[health]}
        </Typography>
      </Stack>
    </Box>
  )
}
