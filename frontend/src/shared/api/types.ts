/**
 * Backend API contract. Mirrors docs/API.md; change both together.
 * Coordinates are GeoJSON order [lng, lat]; times are UTC ISO 8601 strings.
 */
import type { RiskLevel } from '../risk/riskLevels'

export type LngLat = [number, number]

export type CheckpointSpacing = 10 | 25 | 50

export type RankingCriterion =
  'no_travel_miles' | 'severe_miles' | 'high_miles' | 'average_risk' | 'duration'

export type RiskFactor = 'wind' | 'rain' | 'snow'

export interface PlaceSuggestion {
  id: string
  kind: string
  title: string
  subtitle: string
}

export interface Place {
  id: string
  title: string
  subtitle: string
  position: LngLat
}

export interface TripPlanRequest {
  origin: { lat: number; lng: number }
  destination: { lat: number; lng: number }
  departure: string
  load_lb: number
  spacing_mi: CheckpointSpacing
}

export interface CheckpointWeather {
  wind_mph: number
  gust_mph: number | null
  rain_in_per_hr: number
  snow_in_per_hr: number
}

export interface Checkpoint {
  mile: number
  position: LngLat
  eta: string
  level: RiskLevel | null
  drivers: RiskFactor[]
  load_escalated: boolean
  weather: CheckpointWeather | null
}

export interface RouteRisk {
  miles_by_level: Record<RiskLevel, number>
  no_data_miles: number
  average_risk: number | null
  worst_level: RiskLevel | null
}

export interface PlannedRoute {
  id: string
  rank: number
  recommended: boolean
  decided_by: RankingCriterion | null
  distance_mi: number
  duration_s: number
  arrival: string
  risk: RouteRisk
  geometry: LngLat[]
  checkpoints: Checkpoint[]
}

export interface HeatmapCell {
  row: number
  col: number
  /** One entry per frame: 0 low ... 4 no_travel, null = no data. */
  levels: (number | null)[]
}

export interface Heatmap {
  resolution_deg: number
  start: string
  frames: number
  cells: HeatmapCell[]
}

export interface TripPlan {
  departure: string
  load_lb: number
  spacing_mi: CheckpointSpacing
  recommended_route_id: string
  all_routes_blocked: boolean
  /** Ranked order: the recommended route first. */
  routes: PlannedRoute[]
  heatmap: Heatmap
}

export interface ApiErrorBody {
  code: string
  detail: string
  fields?: Record<string, unknown>
}
