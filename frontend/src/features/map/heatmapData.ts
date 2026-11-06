/**
 * Corridor heatmap data and the truck's position on the timeline.
 * Pure functions; the heatmap source is built once per plan.
 */
import type { FeatureCollection, Polygon } from 'geojson'

import type { Heatmap, HeatmapCell, LngLat, PlannedRoute } from '../../shared/api/types'
import { pointAlong } from './mapData'

/** Level value used for "no forecast" (map feature state cannot hold null). */
export const NO_DATA = -1
const HOUR_MS = 3600_000

/**
 * One square polygon per cell. A feature's `id` is its index in
 * `heatmap.cells`, which is how frame levels are applied as feature state.
 * Geometry is uploaded once per plan; levels never travel in the data.
 */
export function heatmapFeatures(heatmap: Heatmap): FeatureCollection<Polygon> {
  const size = heatmap.resolution_deg
  return {
    type: 'FeatureCollection',
    features: heatmap.cells.map((cell, index) => {
      const [south, west] = [cell.row * size, cell.col * size]
      const [north, east] = [south + size, west + size]
      return {
        type: 'Feature',
        id: index,
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [west, south],
              [east, south],
              [east, north],
              [west, north],
              [west, south],
            ],
          ],
        },
      }
    }),
  }
}

/** Each cell's level at `frame`, in feature-id order. */
export function frameLevels(heatmap: Heatmap, frame: number): number[] {
  return heatmap.cells.map((cell) => cell.levels[frame] ?? NO_DATA)
}

export function frameTime(heatmap: Heatmap, frame: number): Date {
  return new Date(new Date(heatmap.start).getTime() + frame * HOUR_MS)
}

export interface TruckPosition {
  position: LngLat
  mile: number
  arrived: boolean
}

/**
 * Where the truck on `route` is at `moment`, interpolated between checkpoint
 * ETAs and placed on the route line so it never cuts corners.
 */
export function truckPositionAt(route: PlannedRoute, moment: Date): TruckPosition {
  const { checkpoints } = route
  const t = moment.getTime()
  const times = checkpoints.map((c) => new Date(c.eta).getTime())
  const last = checkpoints.length - 1

  if (t >= times[last]) {
    return {
      position: route.geometry[route.geometry.length - 1],
      mile: checkpoints[last].mile,
      arrived: true,
    }
  }

  let mile = checkpoints[0].mile
  for (let i = 0; i < last; i++) {
    if (t >= times[i] && t < times[i + 1]) {
      const f = (t - times[i]) / (times[i + 1] - times[i])
      mile = checkpoints[i].mile + f * (checkpoints[i + 1].mile - checkpoints[i].mile)
      break
    }
  }
  const fraction = route.distance_mi > 0 ? mile / route.distance_mi : 0
  return { position: pointAlong(route.geometry, fraction), mile, arrived: false }
}

/** Cells keyed by "row:col" for constant-time lookup. */
export function indexCells(heatmap: Heatmap): Map<string, HeatmapCell> {
  return new Map(heatmap.cells.map((cell) => [`${cell.row}:${cell.col}`, cell]))
}

/** Risk level (0-4) of the cell under `position` at `frame`; null when unknown. */
export function levelAt(
  heatmap: Heatmap,
  index: Map<string, HeatmapCell>,
  position: LngLat,
  frame: number,
): number | null {
  const size = heatmap.resolution_deg
  const cell = index.get(`${Math.floor(position[1] / size)}:${Math.floor(position[0] / size)}`)
  return cell?.levels[frame] ?? null
}
