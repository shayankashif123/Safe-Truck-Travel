import MapOutlined from '@mui/icons-material/MapOutlined'
import RefreshRounded from '@mui/icons-material/RefreshRounded'
import { Box, Button, Stack, Typography } from '@mui/material'
import { Component, type ErrorInfo, type ReactNode } from 'react'

type Failure = 'none' | 'load' | 'render'

interface State {
  failure: Failure
}

/** A lazy chunk that cannot be fetched, e.g. a stale tab after a new deployment. */
function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /dynamically imported module|Importing a module script failed|error loading dynamically/i.test(
    message,
  )
}

/**
 * Keeps the planner usable if the map cannot start. The route panel works
 * without it. A failed download gets a reload button; anything else (most
 * likely missing WebGL2) gets an explanation instead.
 */
export class MapErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failure: 'none' }

  static getDerivedStateFromError(error: unknown): State {
    return { failure: isChunkLoadError(error) ? 'load' : 'render' }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Map failed to render', error, info.componentStack)
  }

  render() {
    const { failure } = this.state
    if (failure === 'none') return this.props.children

    const copy =
      failure === 'load'
        ? {
            title: 'The map did not load',
            body: 'A newer version may have been released, or the connection dropped.',
          }
        : {
            title: 'The map could not be displayed',
            body: 'Your browser may not support WebGL2. Route comparison in the panel still works.',
          }

    return (
      <Box sx={{ height: '100%', display: 'grid', placeItems: 'center', p: 3 }}>
        <Stack spacing={1} sx={{ alignItems: 'center', textAlign: 'center', maxWidth: 360 }}>
          <MapOutlined sx={{ color: 'text.secondary' }} />
          <Typography variant="subtitle2">{copy.title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {copy.body}
          </Typography>
          {failure === 'load' && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<RefreshRounded />}
              onClick={() => window.location.reload()}
            >
              Reload
            </Button>
          )}
        </Stack>
      </Box>
    )
  }
}
