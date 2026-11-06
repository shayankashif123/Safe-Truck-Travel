import { Box, Divider, Stack, Typography } from '@mui/material'

import { BRAND } from './brand/brand'
import logoMark from './brand/logo-mark.png'

/**
 * The logo's emblem with the brand name set as text. The full logo's lettering
 * would be ~6 px tall at header height, so the name is real text: sharp at any
 * zoom and readable by screen readers. The full logo is used in the README.
 */
export function AppHeader() {
  return (
    <Box
      component="header"
      sx={{
        height: 56,
        px: 2.5,
        display: 'flex',
        alignItems: 'center',
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 0 }}>
        {/* Decorative: the brand name follows as text. */}
        <Box
          component="img"
          src={logoMark}
          alt=""
          sx={{ height: 36, width: 'auto', display: 'block' }}
        />
        <Typography
          variant="h1"
          sx={{ fontWeight: 800, color: BRAND.navy, whiteSpace: 'nowrap', lineHeight: 1 }}
        >
          Safe Truck{' '}
          <Box component="span" sx={{ color: BRAND.green }}>
            Travels
          </Box>
        </Typography>
        <Divider
          orientation="vertical"
          flexItem
          sx={{ display: { xs: 'none', sm: 'block' }, my: 2 }}
        />
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ display: { xs: 'none', sm: 'block' }, whiteSpace: 'nowrap' }}
        >
          Weather-aware truck routing
        </Typography>
      </Stack>
    </Box>
  )
}
