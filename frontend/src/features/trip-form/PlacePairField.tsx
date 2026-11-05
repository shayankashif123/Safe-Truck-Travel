import SwapVertRounded from '@mui/icons-material/SwapVertRounded'
import { IconButton, Stack, Tooltip } from '@mui/material'

import { DestinationMarker, OriginMarker } from '../../shared/ui/PlaceMarkers'
import { PlaceField } from './PlaceField'
import type { SelectedPlace } from './tripFormModel'

interface PlacePairFieldProps {
  origin: SelectedPlace | null
  destination: SelectedPlace | null
  onOriginChange: (place: SelectedPlace | null) => void
  onDestinationChange: (place: SelectedPlace | null) => void
  /** Must swap both places in a single state update. */
  onSwap: () => void
  originError?: string
  destinationError?: string
}

/** Origin and destination, Google-Maps style: ring, pin, and a swap button. */
export function PlacePairField(props: PlacePairFieldProps) {
  const { origin, destination } = props

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <Stack spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
        <PlaceField
          id="trip-origin"
          label="From"
          value={origin}
          onChange={props.onOriginChange}
          marker={<OriginMarker />}
          error={props.originError}
        />
        <PlaceField
          id="trip-destination"
          label="To"
          value={destination}
          onChange={props.onDestinationChange}
          marker={<DestinationMarker />}
          error={props.destinationError}
        />
      </Stack>
      <Tooltip title="Swap start and destination">
        <span>
          <IconButton
            aria-label="Swap start and destination"
            onClick={props.onSwap}
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
