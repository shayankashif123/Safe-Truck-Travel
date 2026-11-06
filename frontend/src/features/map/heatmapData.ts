/**
 * Corridor heatmap data and the truck's position on the timeline.
 * Pure functions; the heatmap source is built once per plan.
 */
import type { FeatureCollection, Polygon } from 'geojson'

import type { Heatmap, HeatmapCell, LngLat, PlannedRoute, RouteStop } from '../../shared/api/types'
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
  /** The required driver stop being made at this moment, if any. */
  stop: RouteStop | null
}

interface Keyframe {
  time: number
  mile: number
}

/**
 * The truck's timeline: every checkpoint ETA plus the start and end of every
 * stop. Between keyframes the truck moves at a steady speed; during a stop the
 * two keyframes share a mile, so it stands still.
 */
function keyframes(route: PlannedRoute): Keyframe[] {
  const frames = route.checkpoints.map((c) => ({ time: Date.parse(c.eta), mile: c.mile }))
  for (const stop of route.stops) {
    frames.push(
      { time: Date.parse(stop.start), mile: stop.mile },
      { time: Date.parse(stop.end), mile: stop.mile },
    )
  }
  return frames.sort((a, b) => a.time - b.time || a.mile - b.mile)
}

/** Where the truck on `route` is at `moment`, placed on the route line. */
export function truckPositionAt(route: PlannedRoute, moment: Date): TruckPosition {
  const t = moment.getTime()
  const frames = keyframes(route)
  const finish = frames[frames.length - 1]

  if (t >= finish.time) {
    return {
      position: route.geometry[route.geometry.length - 1],
      mile: finish.mile,
      arrived: true,
      stop: null,
    }
  }

  let mile = frames[0].mile
  for (let i = 0; i < frames.length - 1; i++) {
    const [a, b] = [frames[i], frames[i + 1]]
    if (t >= a.time && t < b.time) {
      mile = a.mile + ((t - a.time) / (b.time - a.time)) * (b.mile - a.mile)
      break
    }
  }
  const stop = route.stops.find((s) => t >= Date.parse(s.start) && t < Date.parse(s.end)) ?? null
  const fraction = route.distance_mi > 0 ? mile / route.distance_mi : 0
  return { position: pointAlong(route.geometry, fraction), mile, arrived: false, stop }
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
