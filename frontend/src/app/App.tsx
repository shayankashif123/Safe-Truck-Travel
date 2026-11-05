import { Box, Typography } from '@mui/material'

import { RiskLegend } from '../features/map/RiskLegend'
import { AppHeader } from './AppHeader'

const SIDEBAR_WIDTH = 400

export default function App() {
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppHeader />

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <Box
          component="aside"
          sx={{
            width: SIDEBAR_WIDTH,
            flexShrink: 0,
            borderRight: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            p: 2.5,
            overflowY: 'auto',
          }}
        >
          <Typography variant="overline" color="text.secondary">
            Trip details
          </Typography>
        </Box>

        <Box component="main" sx={{ flex: 1, position: 'relative', bgcolor: 'grey.100' }}>
          <Box sx={{ position: 'absolute', left: 16, bottom: 16 }}>
            <RiskLegend />
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
