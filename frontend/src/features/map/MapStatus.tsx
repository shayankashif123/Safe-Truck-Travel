import { Box, CircularProgress, Typography } from '@mui/material'

interface MapStatusProps {
  hasPlan: boolean
  busy: boolean
}

/** A quiet pill at the top of the map: an empty-state hint, or work in progress. */
export function MapStatus({ hasPlan, busy }: MapStatusProps) {
  if (hasPlan && !busy) return null
  return (
    <Box
      role="status"
      sx={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.75,
        py: 0.75,
        borderRadius: 999,
        bgcolor: 'rgb(255 255 255 / 0.94)',
        border: 1,
        borderColor: 'divider',
        boxShadow: '0 2px 10px rgb(15 23 42 / 0.10)',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {busy && <CircularProgress size={14} thickness={5} />}
      <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary' }}>
        {busy
          ? hasPlan
            ? 'Updating routes…'
            : 'Calculating truck routes…'
          : 'Plan a trip to see routes, checkpoints and weather risk'}
      </Typography>
    </Box>
  )
}
