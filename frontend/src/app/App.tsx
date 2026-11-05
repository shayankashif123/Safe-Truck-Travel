import { Box, Divider } from '@mui/material'

import { RiskLegend } from '../features/map/RiskLegend'
import { TripForm } from '../features/trip-form/TripForm'
import { useTripPlanner } from '../features/trip-planner/useTripPlanner'
import { TripResults } from '../features/trip-results/TripResults'
import { AppHeader } from './AppHeader'

const PANEL_WIDTH = 420

export default function App() {
  const planner = useTripPlanner()

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppHeader />

      <Box
        sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}
      >
        <Box
          component="aside"
          sx={{
            width: { xs: '100%', md: PANEL_WIDTH },
            flexShrink: 0,
            overflowY: { md: 'auto' },
            bgcolor: 'background.paper',
            borderRight: { md: 1 },
            borderBottom: { xs: 1, md: 0 },
            borderColor: 'divider',
          }}
        >
          <Box sx={{ p: 2.5 }}>
            <TripForm onSubmit={planner.submit} submitting={planner.status === 'loading'} />
          </Box>
          <Divider />
          <Box sx={{ p: 2.5 }}>
            <TripResults planner={planner} />
          </Box>
        </Box>

        <Box
          component="main"
          aria-label="Map"
          sx={{
            flex: 1,
            minHeight: { xs: '60vh', md: 0 },
            position: 'relative',
            bgcolor: 'grey.100',
          }}
        >
          <Box sx={{ position: 'absolute', left: 16, bottom: 16 }}>
            <RiskLegend />
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
