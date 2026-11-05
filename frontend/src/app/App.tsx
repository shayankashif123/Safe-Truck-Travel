import { Box, Divider, Skeleton } from '@mui/material'
import { lazy, Suspense } from 'react'

import { MapErrorBoundary } from '../features/map/MapErrorBoundary'
import { TripForm } from '../features/trip-form/TripForm'
import { useTripPlanner } from '../features/trip-planner/useTripPlanner'
import { TripResults } from '../features/trip-results/TripResults'
import { AppHeader } from './AppHeader'

// The map library is large; loading it separately keeps the form interactive sooner.
const TripMap = lazy(() => import('../features/map/TripMap'))

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
          <MapErrorBoundary>
            <Suspense
              fallback={
                <Skeleton
                  variant="rectangular"
                  sx={{ position: 'absolute', inset: 0, height: '100%' }}
                />
              }
            >
              <TripMap
                plan={planner.plan}
                selectedRouteId={planner.selectedRouteId}
                onSelectRoute={planner.selectRoute}
                busy={planner.status === 'loading'}
              />
            </Suspense>
          </MapErrorBoundary>
        </Box>
      </Box>
    </Box>
  )
}
