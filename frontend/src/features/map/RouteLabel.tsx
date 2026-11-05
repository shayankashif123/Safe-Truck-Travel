import CheckRounded from '@mui/icons-material/CheckRounded'
import { ButtonBase, Typography } from '@mui/material'

import type { PlannedRoute } from '../../shared/api/types'
import { formatDuration, formatMiles } from '../../shared/format/format'
import { RouteLetter } from '../../shared/ui/RouteLetter'

interface RouteLabelProps {
  route: PlannedRoute
  selected: boolean
  onSelect: () => void
}

/** On-map callout with the route's key facts; clicking it selects the route. */
export function RouteLabel({ route, selected, onSelect }: RouteLabelProps) {
  return (
    <ButtonBase
      onClick={(event) => {
        event.stopPropagation() // do not let the map treat this as a background click
        onSelect()
      }}
      aria-label={`Select route ${route.id}`}
      aria-pressed={selected}
      sx={{
        gap: 0.75,
        pl: 0.5,
        pr: 1.25,
        py: 0.5,
        borderRadius: 999,
        bgcolor: '#FFFFFF',
        border: 1,
        borderColor: selected ? 'primary.main' : 'divider',
        boxShadow: '0 2px 10px rgb(15 23 42 / 0.14)',
        whiteSpace: 'nowrap',
        transition: 'border-color 120ms, transform 120ms',
        '&:hover': { transform: 'translateY(-1px)' },
      }}
    >
      <RouteLetter id={route.id} active={selected} size={20} />
      <Typography
        variant="caption"
        sx={{ fontWeight: 600, color: 'text.primary', fontVariantNumeric: 'tabular-nums' }}
      >
        {formatDuration(route.duration_s)} · {formatMiles(route.distance_mi)}
      </Typography>
      {route.recommended && (
        <CheckRounded
          aria-label="Recommended"
          sx={{ fontSize: 16, color: 'primary.main', ml: -0.25 }}
        />
      )}
    </ButtonBase>
  )
}
