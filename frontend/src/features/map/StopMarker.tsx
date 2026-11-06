import HotelRounded from '@mui/icons-material/HotelRounded'
import LocalCafeRounded from '@mui/icons-material/LocalCafeRounded'
import { Box, Tooltip, Typography } from '@mui/material'
import { useEffect, useRef } from 'react'

import type { RouteStop, StopKind } from '../../shared/api/types'
import { formatDayTime, formatLocalTime } from '../../shared/format/format'

const STOP_TITLE: Record<StopKind, string> = {
  break: '30-minute break',
  rest: '10-hour rest',
}

const STOP_ICON: Record<StopKind, typeof HotelRounded> = {
  break: LocalCafeRounded,
  rest: HotelRounded,
}

/**
 * MapLibre listens for pointer events on the whole map container, so events on
 * a marker also reach the layers underneath it (e.g. open a checkpoint popup).
 * The marker sits on top, so it should own its events. React's synthetic
 * stopPropagation runs too late (at the React root), hence native listeners.
 */
const ISOLATED_EVENTS = ['mousemove', 'click', 'dblclick'] as const

interface StopMarkerProps {
  stop: RouteStop
  /** Called when the pointer enters the marker, so the map can drop its own hover state. */
  onPointerEnter?: () => void
}

/** A required driver stop on the selected route, with its times on hover or focus. */
export function StopMarker({ stop, onPointerEnter }: StopMarkerProps) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const keepToMarker = (event: Event) => event.stopPropagation()
    ISOLATED_EVENTS.forEach((type) => element.addEventListener(type, keepToMarker))
    return () => ISOLATED_EVENTS.forEach((type) => element.removeEventListener(type, keepToMarker))
  }, [])

  const Icon = STOP_ICON[stop.kind]
  const title = STOP_TITLE[stop.kind]
  // Local time where the truck is parked; the zone is named once, at the end.
  const when = `${formatDayTime(stop.start, stop.time_zone)} – ${formatLocalTime(stop.end, stop.time_zone)}`
  const mile = `mile ${Math.round(stop.mile).toLocaleString('en-US')}`

  return (
    <Tooltip
      arrow
      title={
        <>
          <Typography variant="caption" component="p" sx={{ fontWeight: 600 }}>
            {title} · {mile}
          </Typography>
          <Typography variant="caption" component="p">
            {when}
          </Typography>
        </>
      }
    >
      <Box
        ref={ref}
        onPointerEnter={onPointerEnter}
        role="img"
        tabIndex={0}
        aria-label={`${title} at ${mile}, ${when}`}
        sx={{
          width: 22,
          height: 22,
          display: 'grid',
          placeItems: 'center',
          borderRadius: '7px',
          bgcolor: '#FFFFFF',
          border: 1,
          borderColor: 'grey.400',
          color: 'grey.800',
          boxShadow: '0 1px 4px rgb(15 23 42 / 0.2)',
          cursor: 'default',
          '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: 2 },
        }}
      >
        <Icon sx={{ fontSize: 14 }} />
      </Box>
    </Tooltip>
  )
}
