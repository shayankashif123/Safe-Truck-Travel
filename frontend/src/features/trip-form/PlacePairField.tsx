import SwapVertRounded from '@mui/icons-material/SwapVertRounded'
import { Box, IconButton, Stack, Tooltip } from '@mui/material'

import { PlaceField } from './PlaceField'
import type { SelectedPlace } from './tripFormModel'

interface PlacePairFieldProps {
  origin: SelectedPlace | null
  destination: SelectedPlace | null
  onOriginChange: (place: SelectedPlace | null) => void
  onDestinationChange: (place: SelectedPlace | null) => void
  originError?: string
  destinationError?: string
}

const OriginMarker = () => (
  <Box
    aria-hidden
    sx={{ width: 12, height: 12, borderRadius: '50%', border: 2.5, borderColor: 'grey.700' }}
  />
)

const DestinationMarker = () => (
  <Box
    aria-hidden
    sx={{
      width: 12,
      height: 12,
      borderRadius: '50% 50% 50% 0',
      transform: 'rotate(-45deg)',
      bgcolor: 'primary.main',
    }}
  />
)

/** Origin and destination, Google-Maps style: ring, pin, and a swap button. */
export function PlacePairField(props: PlacePairFieldProps) {
  const { origin, destination, onOriginChange, onDestinationChange } = props

  function swap() {
    onOriginChange(destination)
    onDestinationChange(origin)
  }

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <Stack spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
        <PlaceField
          id="trip-origin"
          label="From"
          value={origin}
          onChange={onOriginChange}
          marker={<OriginMarker />}
          error={props.originError}
        />
        <PlaceField
          id="trip-destination"
          label="To"
          value={destination}
          onChange={onDestinationChange}
          marker={<DestinationMarker />}
          error={props.destinationError}
        />
      </Stack>
      <Tooltip title="Swap start and destination">
        <span>
          <IconButton
            aria-label="Swap start and destination"
            onClick={swap}
            disabled={!origin && !destination}
            size="small"
            sx={{ border: 1, borderColor: 'divider' }}
          >
            <SwapVertRounded fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  )
}
