import { Box } from '@mui/material'

/** The route's letter (A, B, C) as a small square badge; filled when active. */
export function RouteLetter({
  id,
  active,
  size = 22,
}: {
  id: string
  active: boolean
  size?: number
}) {
  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '6px',
        display: 'grid',
        placeItems: 'center',
        fontSize: size >= 22 ? '0.75rem' : '0.6875rem',
        fontWeight: 700,
        color: active ? 'primary.contrastText' : 'grey.700',
        bgcolor: active ? 'primary.main' : 'grey.100',
        border: 1,
        borderColor: active ? 'primary.main' : 'divider',
      }}
    >
      {id}
    </Box>
  )
}
