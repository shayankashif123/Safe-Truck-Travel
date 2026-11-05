/**
 * Map layer styles. Selection is expressed only through layer filters, so
 * selecting a route restyles on the GPU without re-uploading any data.
 */
import type { Palette } from '@mui/material/styles'
import type { ExpressionSpecification } from 'maplibre-gl'
import type { LayerProps } from 'react-map-gl/maplibre'

export const ROUTES_SOURCE = 'routes'
export const CHECKPOINTS_SOURCE = 'checkpoints'

export const LAYER = {
  otherRouteCasing: 'route-other-casing',
  otherRoute: 'route-other',
  selectedRouteCasing: 'route-selected-casing',
  selectedRoute: 'route-selected',
  otherCheckpoints: 'checkpoints-other',
  selectedCheckpoints: 'checkpoints-selected',
  routeHitArea: 'route-hit-area',
} as const

export const CHECKPOINT_LAYERS: readonly string[] = [
  LAYER.selectedCheckpoints,
  LAYER.otherCheckpoints,
]
export const INTERACTIVE_LAYERS: string[] = [...CHECKPOINT_LAYERS, LAYER.routeHitArea]

const byZoom = (atZoom4: number, atZoom10: number): ExpressionSpecification => [
  'interpolate',
  ['linear'],
  ['zoom'],
  4,
  atZoom4,
  10,
  atZoom10,
]

/**
 * Draw order, bottom to top. Route lines go *under* the basemap's place labels
 * (`labelLayerId`) so city names stay readable; checkpoints stay on top.
 */
export function buildLayers(
  palette: Palette,
  selectedRouteId: string | null,
  labelLayerId?: string,
): LayerProps[] {
  const id = selectedRouteId ?? ''
  const belowLabels = { beforeId: labelLayerId }
  const isSelectedRoute: ExpressionSpecification = ['==', ['get', 'routeId'], id]
  const isOtherRoute: ExpressionSpecification = ['!=', ['get', 'routeId'], id]

  const { risk } = palette
  const riskColor: ExpressionSpecification = [
    'match',
    ['get', 'level'],
    'low',
    risk.low.main,
    'moderate',
    risk.moderate.main,
    'high',
    risk.high.main,
    'severe',
    risk.severe.main,
    'no_travel',
    risk.no_travel.main,
    risk.no_data.main, // fallback, including 'no_data'
  ]

  const line = { 'line-join': 'round', 'line-cap': 'round' } as const

  return [
    // --- Lines, under the basemap labels -----------------------------------
    {
      id: LAYER.otherRouteCasing,
      type: 'line',
      source: ROUTES_SOURCE,
      filter: isOtherRoute,
      layout: line,
      paint: { 'line-color': '#FFFFFF', 'line-width': byZoom(4.5, 8) },
      ...belowLabels,
    },
    {
      id: LAYER.otherRoute,
      type: 'line',
      source: ROUTES_SOURCE,
      filter: isOtherRoute,
      layout: line,
      paint: { 'line-color': palette.grey[400], 'line-width': byZoom(2.5, 5) },
      ...belowLabels,
    },
    {
      id: LAYER.selectedRouteCasing,
      type: 'line',
      source: ROUTES_SOURCE,
      filter: isSelectedRoute,
      layout: line,
      paint: { 'line-color': '#FFFFFF', 'line-width': byZoom(8, 13) },
      ...belowLabels,
    },
    {
      id: LAYER.selectedRoute,
      type: 'line',
      source: ROUTES_SOURCE,
      filter: isSelectedRoute,
      layout: line,
      paint: { 'line-color': palette.primary.main, 'line-width': byZoom(4.5, 8) },
      ...belowLabels,
    },
    // --- Points and interaction, above everything ----------------------------
    {
      id: LAYER.otherCheckpoints,
      type: 'circle',
      source: CHECKPOINTS_SOURCE,
      filter: isOtherRoute,
      paint: {
        'circle-color': riskColor,
        'circle-radius': byZoom(2.25, 4),
        'circle-opacity': 0.6,
        'circle-stroke-color': '#FFFFFF',
        'circle-stroke-width': 0.75,
        'circle-stroke-opacity': 0.6,
      },
    },
    {
      id: LAYER.selectedCheckpoints,
      type: 'circle',
      source: CHECKPOINTS_SOURCE,
      filter: isSelectedRoute,
      paint: {
        'circle-color': riskColor,
        'circle-radius': byZoom(4.5, 7.5),
        'circle-stroke-color': '#FFFFFF',
        'circle-stroke-width': 1.75,
      },
    },
    {
      // Invisible and wide, so thin routes are easy to hover and click.
      id: LAYER.routeHitArea,
      type: 'line',
      source: ROUTES_SOURCE,
      layout: line,
      paint: { 'line-color': '#000000', 'line-opacity': 0, 'line-width': 16 },
    },
  ]
}
