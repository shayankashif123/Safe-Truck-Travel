import RefreshRounded from '@mui/icons-material/RefreshRounded'
import { Alert, AlertTitle, Button } from '@mui/material'

import type { ApiErrorBody } from '../../shared/api/types'

interface ErrorCopy {
  title: string
  retry: boolean
  /** Shown instead of the server's message when set. */
  detail?: string
}

/** Keyed by the backend's stable error `code` (docs/API.md). */
const ERROR_COPY: Record<string, ErrorCopy> = {
  no_route: {
    title: 'No truck route found',
    retry: false,
    detail: 'There is no drivable truck route between these places. Try different locations.',
  },
  invalid_request: { title: 'Check the trip details', retry: false },
  provider_busy: { title: 'Forecast service is busy', retry: true },
  provider_unavailable: { title: 'A data provider is not responding', retry: true },
  rate_limited: { title: 'Too many requests', retry: true },
  network_error: { title: 'Cannot reach the server', retry: true },
  server_error: { title: 'Server error', retry: true },
}

const FALLBACK: ErrorCopy = { title: 'Something went wrong', retry: true }

interface ResultsErrorProps {
  error: ApiErrorBody
  onRetry: () => void
}

export function ResultsError({ error, onRetry }: ResultsErrorProps) {
  const copy = ERROR_COPY[error.code] ?? FALLBACK
  return (
    <Alert
      severity={copy.retry ? 'warning' : 'error'}
      variant="outlined"
      action={
        copy.retry && (
          <Button color="inherit" size="small" startIcon={<RefreshRounded />} onClick={onRetry}>
            Try again
          </Button>
        )
      }
    >
      <AlertTitle sx={{ fontWeight: 600 }}>{copy.title}</AlertTitle>
      {copy.detail ?? error.detail}
    </Alert>
  )
}
