import LocalShippingRounded from '@mui/icons-material/LocalShippingRounded'
import { Box, useTheme } from '@mui/material'
import { memo, useEffect, useMemo, useState } from 'react'
import type { MapSourceDataEvent } from 'maplibre-gl'
import { Layer, Marker, Source, useMap } from 'react-map-gl/maplibre'

import type { TripPlan } from '../../shared/api/types'
import { RISK_LEVELS } from '../../shared/risk/riskLevels'
import { HeatmapPanel, type TruckStatus } from './HeatmapPanel'
import {
  frameLevels,
  frameTime,
  heatmapFeatures,
  indexCells,
  levelAt,
  truckPositionAt,
} from './heatmapData'
import { HEATMAP_LEVEL_STATE, HEATMAP_SOURCE, heatmapLayer } from './mapLayers'

const PLAY_INTERVAL_MS = 280

interface CorridorHeatmapProps {
  plan: TripPlan
  selectedRouteId: string | null
  /** Layer the heatmap is drawn beneath (the basemap's labels). */
  beforeId?: string
}

/**
 * Corridor heatmap, its time control and the truck's position on the timeline.
 * Rendered inside <Map>. The frame lives here, so scrubbing re-renders only
 * this component; the map itself is updated through feature state.
 */
export const CorridorHeatmap = memo(function CorridorHeatmap({
  plan,
  selectedRouteId,
  beforeId,
}: CorridorHeatmapProps) {
  const theme = useTheme()
  const { current: map } = useMap()
  const { heatmap } = plan
  const lastFrame = Math.max(0, heatmap.frames - 1)

  // The frame is tied to the plan it was chosen for, so a new plan starts at 0
  // without an effect resetting state.
  const [frameState, setFrameState] = useState({ plan, frame: 0 })
  const frame = frameState.plan === plan ? Math.min(frameState.frame, lastFrame) : 0
  const [playing, setPlaying] = useState(false)
  const [visible, setVisible] = useState(true)

  const features = useMemo(() => heatmapFeatures(heatmap), [heatmap])
  const cellIndex = useMemo(() => indexCells(heatmap), [heatmap])
  const layer = useMemo(
    () => heatmapLayer(theme.palette, visible, beforeId),
    [theme.palette, visible, beforeId],
  )

  // Push the frame's levels to the GPU as feature state: the only map work per
  // slider step. If the source is not on the map yet (style still loading),
  // apply as soon as it appears.
  useEffect(() => {
    const instance = map?.getMap()
    if (!instance) return
    const levels = frameLevels(heatmap, frame)
    const apply = () => {
      if (!instance.getSource(HEATMAP_SOURCE)) return false
      levels.forEach((level, id) =>
        instance.setFeatureState({ source: HEATMAP_SOURCE, id }, { [HEATMAP_LEVEL_STATE]: level }),
      )
      return true
    }
    if (apply()) return
    const onSourceData = (event: MapSourceDataEvent) => {
      if (event.sourceId === HEATMAP_SOURCE && apply()) instance.off('sourcedata', onSourceData)
    }
    instance.on('sourcedata', onSourceData)
    return () => {
      instance.off('sourcedata', onSourceData)
    }
  }, [map, heatmap, frame])

  // Looping playback, like weather apps; stops when the user pauses.
  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => {
      setFrameState((current) => {
        const from = current.plan === plan ? current.frame : 0
        return { plan, frame: from >= lastFrame ? 0 : from + 1 }
      })
    }, PLAY_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [playing, plan, lastFrame])

  const moment = frameTime(heatmap, frame)
  const route = plan.routes.find((r) => r.id === selectedRouteId) ?? plan.routes[0]
  const truck = truckPositionAt(route, moment)
  const levelIndex = levelAt(heatmap, cellIndex, truck.position, frame)
  const truckStatus: TruckStatus = {
    routeId: route.id,
    mile: truck.mile,
    arrived: truck.arrived,
    stopKind: truck.stop?.kind ?? null,
    level: levelIndex === null ? null : RISK_LEVELS[levelIndex],
  }

  return (
    <>
      <Source id={HEATMAP_SOURCE} type="geojson" data={features} />
      <Layer {...layer} />

      <Marker
        longitude={truck.position[0]}
        latitude={truck.position[1]}
        anchor="center"
        style={{ zIndex: 3 }}
      >
        <TruckMarker />
      </Marker>

      <HeatmapPanel
        frame={frame}
        lastFrame={lastFrame}
        frameTimeIso={moment.toISOString()}
        playing={playing}
        visible={visible}
        loadLb={plan.load_lb}
        truck={truckStatus}
        onFrameChange={(next) => {
          setPlaying(false)
          setFrameState({ plan, frame: next })
        }}
        onTogglePlay={() => setPlaying((p) => !p)}
        onToggleVisible={() => setVisible((v) => !v)}
      />
    </>
  )
})

function TruckMarker() {
  return (
    <Box
      aria-label="Truck position at the selected hour"
      role="img"
      sx={{
        width: 28,
        height: 28,
        display: 'grid',
        placeItems: 'center',
        borderRadius: '50%',
        bgcolor: '#FFFFFF',
        border: 2,
        borderColor: 'primary.main',
        boxShadow: '0 2px 8px rgb(15 23 42 / 0.25)',
        pointerEvents: 'none',
      }}
    >
      <LocalShippingRounded sx={{ fontSize: 15, color: 'primary.main' }} />
    </Box>
  )
}
