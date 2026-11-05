import { Box } from '@mui/material'

/** Start of a trip: a ring. Used in the form and on the map so they read as one. */
export function OriginMarker({ size = 12 }: { size?: number }) {
  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: size > 12 ? 3 : 2.5,
        borderColor: 'grey.800',
        bgcolor: '#FFFFFF',
      }}
    />
  )
}

/** End of a trip: a pin in the accent colour. */
export function DestinationMarker({ size = 12 }: { size?: number }) {
  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size,
        borderRadius: '50% 50% 50% 0',
        transform: 'rotate(-45deg)',
        bgcolor: 'primary.main',
        border: size > 12 ? 2 : 0,
        borderColor: '#FFFFFF',
      }}
    />
  )
}
