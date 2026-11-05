import { LinearProgress, Skeleton, Stack, Typography } from '@mui/material'
import { useEffect, useState } from 'react'

/**
 * Honest progress: one real request, so no fake stages. The elapsed counter
 * reassures during TomTom's 5-15 s route calculation.
 */
export function ResultsLoading() {
  const [elapsedS, setElapsedS] = useState(0)

  useEffect(() => {
    const started = Date.now()
    const timer = setInterval(() => setElapsedS(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <Stack spacing={2} role="status" aria-live="polite">
      <Stack spacing={1}>
        <LinearProgress />
        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Calculating truck routes and forecasts…
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {elapsedS} s
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          A new trip usually takes 5–15 seconds. Changing the load or spacing afterwards is instant.
        </Typography>
      </Stack>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} variant="rounded" height={148} animation="wave" />
      ))}
    </Stack>
  )
}
