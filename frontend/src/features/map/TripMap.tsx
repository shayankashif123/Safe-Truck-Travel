import { Box, GlobalStyles, useTheme } from '@mui/material'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Layer,
  Map,
  type MapLayerMouseEvent,
  type MapRef,
  Marker,
  NavigationControl,
  Popup,
  ScaleControl,
  Source,
} from 'react-map-gl/maplibre'

import type { TripPlan } from '../../shared/api/types'
import { DestinationMarker, OriginMarker } from '../../shared/ui/PlaceMarkers'
import { CheckpointPopup } from './CheckpointPopup'
import { MapStatus } from './MapStatus'
import { checkpointFeatures, labelAnchors, planBounds, routeFeatures } from './mapData'
import {
  buildLayers,
  CHECKPOINT_LAYERS,
  CHECKPOINTS_SOURCE,
  INTERACTIVE_LAYERS,
  LAYER,
  ROUTES_SOURCE,
} from './mapLayers'
import { BASEMAP_STYLE_URL, maplibregl } from './maplibre'
import { RiskLegend } from './RiskLegend'
import { RouteLabel } from './RouteLabel'

const INITIAL_VIEW = { longitude: -98.6, latitude: 39.5, zoom: 3.3 } // continental US
const FIT_PADDING = 72
const FIT_MAX_ZOOM = 9

export interface TripMapProps {
  plan: TripPlan | null
  selectedRouteId: string | null
  onSelectRoute: (routeId: string) => void
  busy: boolean
}

/** A checkpoint reference, tied to the plan it came from so it can never go stale. */
interface CheckpointRef {
  plan: TripPlan
  routeId: string
  index: number
}

export default function TripMap({ plan, selectedRouteId, onSelectRoute, busy }: TripMapProps) {
  const theme = useTheme()
  const mapRef = useRef<MapRef>(null)
  const [hovered, setHovered] = useState<CheckpointRef | null>(null)
  const [pinned, setPinned] = useState<CheckpointRef | null>(null)
  const [overInteractive, setOverInteractive] = useState(false)
  // The basemap's first label layer; route lines are drawn just beneath it.
  const [labelLayerId, setLabelLayerId] = useState<string>()

  // Built once per plan; selection changes only touch layer filters.
  const data = useMemo(
    () =>
      plan && {
        routes: routeFeatures(plan),
        checkpoints: checkpointFeatures(plan),
        anchors: labelAnchors(plan),
        bounds: planBounds(plan),
      },
    [plan],
  )
  const layers = useMemo(
    () => buildLayers(theme.palette, selectedRouteId, labelLayerId),
    [theme.palette, selectedRouteId, labelLayerId],
  )

  const fitToPlan = useCallback(() => {
    if (!data || !mapRef.current) return
    mapRef.current.fitBounds(data.bounds, {
      padding: FIT_PADDING,
      maxZoom: FIT_MAX_ZOOM,
      duration: prefersReducedMotion() ? 0 : 800,
    })
  }, [data])

  // New plan: frame it. (onLoad covers a plan that arrives before the map is ready.)
  useEffect(fitToPlan, [fitToPlan])

  function checkpointAt(event: MapLayerMouseEvent): CheckpointRef | null {
    const feature = event.features?.find((f) => CHECKPOINT_LAYERS.includes(f.layer.id))
    if (!plan || !feature) return null
    return {
      plan,
      routeId: String(feature.properties.routeId),
      index: Number(feature.properties.index),
    }
  }

  function routeAt(event: MapLayerMouseEvent): string | null {
    const feature = event.features?.find((f) => f.layer.id === LAYER.routeHitArea)
    return feature ? String(feature.properties.routeId) : null
  }

  function handleMouseMove(event: MapLayerMouseEvent) {
    const checkpoint = checkpointAt(event)
    setOverInteractive(Boolean(checkpoint || routeAt(event)))
    setHovered((previous) => (sameCheckpoint(previous, checkpoint) ? previous : checkpoint))
  }

  function handleClick(event: MapLayerMouseEvent) {
    const checkpoint = checkpointAt(event)
    if (checkpoint) {
      setPinned(checkpoint)
      onSelectRoute(checkpoint.routeId)
      return
    }
    setPinned(null)
    const routeId = routeAt(event)
    if (routeId) onSelectRoute(routeId)
  }

  // A pinned popup wins over a hovered one; references from older plans are ignored.
  const active = [pinned, hovered].find((ref) => ref && ref.plan === plan) ?? null
  const activeCheckpoint = active
    ? plan?.routes.find((r) => r.id === active.routeId)?.checkpoints[active.index]
    : undefined
  const ends = plan?.routes[0]?.geometry

  return (
    <Box sx={{ position: 'absolute', inset: 0 }}>
      <GlobalStyles
        styles={{
          '.trip-map-popup .maplibregl-popup-content': {
            padding: 0,
            borderRadius: 10,
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: '0 12px 32px rgb(15 23 42 / 0.16)',
          },
          '.maplibregl-ctrl-group': {
            borderRadius: '8px !important',
            boxShadow: '0 1px 3px rgb(15 23 42 / 0.14) !important',
          },
          '.maplibregl-ctrl-attrib, .maplibregl-ctrl-scale': { fontSize: 11 },
        }}
      />

      <Map
        ref={mapRef}
        mapLib={maplibregl}
        mapStyle={BASEMAP_STYLE_URL}
        initialViewState={INITIAL_VIEW}
        style={{ position: 'absolute', inset: 0 }}
        interactiveLayerIds={data ? INTERACTIVE_LAYERS : undefined}
        cursor={overInteractive ? 'pointer' : 'grab'}
        onMouseMove={handleMouseMove}
        onMouseOut={() => {
          setOverInteractive(false)
          setHovered(null)
        }}
        onClick={handleClick}
        onLoad={(event) => {
          setLabelLayerId(event.target.getStyle().layers.find((l) => l.type === 'symbol')?.id)
          fitToPlan()
        }}
        attributionControl={{ compact: true }}
        dragRotate={false}
        pitchWithRotate={false}
        touchPitch={false}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <ScaleControl position="bottom-right" unit="imperial" />

        {data && (
          <>
            <Source id={ROUTES_SOURCE} type="geojson" data={data.routes} />
            <Source id={CHECKPOINTS_SOURCE} type="geojson" data={data.checkpoints} />
            {layers.map((layer) => (
              <Layer key={layer.id} {...layer} />
            ))}
          </>
        )}

        {plan &&
          data &&
          plan.routes.map((route) => (
            <Marker
              key={route.id}
              longitude={data.anchors[route.id][0]}
              latitude={data.anchors[route.id][1]}
              anchor="center"
              style={{ zIndex: route.id === selectedRouteId ? 2 : 1 }}
            >
              <RouteLabel
                route={route}
                selected={route.id === selectedRouteId}
                onSelect={() => onSelectRoute(route.id)}
              />
            </Marker>
          ))}

        {ends && (
          <>
            <Marker longitude={ends[0][0]} latitude={ends[0][1]} anchor="center">
              <OriginMarker size={16} />
            </Marker>
            <Marker
              longitude={ends[ends.length - 1][0]}
              latitude={ends[ends.length - 1][1]}
              anchor="bottom"
              offset={[0, -3]}
            >
              <DestinationMarker size={18} />
            </Marker>
          </>
        )}

        {active && activeCheckpoint && (
          <Popup
            longitude={activeCheckpoint.position[0]}
            latitude={activeCheckpoint.position[1]}
            anchor="bottom"
            offset={12}
            closeButton={false}
            closeOnClick={false}
            maxWidth="none"
            className="trip-map-popup"
          >
            <CheckpointPopup
              routeId={active.routeId}
              checkpoint={activeCheckpoint}
              onClose={active === pinned ? () => setPinned(null) : undefined}
            />
          </Popup>
        )}
      </Map>

      <MapStatus hasPlan={Boolean(plan)} busy={busy} />

      <Box sx={{ position: 'absolute', left: 16, bottom: 16, pointerEvents: 'none' }}>
        <RiskLegend />
      </Box>
    </Box>
  )
}

function sameCheckpoint(a: CheckpointRef | null, b: CheckpointRef | null): boolean {
  return a?.plan === b?.plan && a?.routeId === b?.routeId && a?.index === b?.index
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}
