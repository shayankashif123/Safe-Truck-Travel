/**
 * Backend API contract. Mirrors docs/API.md; change both together.
 * Coordinates are GeoJSON order [lng, lat]; times are UTC ISO 8601 strings.
 */
import type { RiskLevel } from '../risk/riskLevels'

export type LngLat = [number, number]

export type CheckpointSpacing = 10 | 25 | 50

/** Solo drivers stop for breaks and rest (US hours of service); a team keeps driving. */
export type DriverMode = 'solo' | 'team'

/** A 30-minute break after 8 h of driving, or a 10-hour rest after 11 h. */
export type StopKind = 'break' | 'rest'

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
  driver: DriverMode
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

export interface RouteStop {
  kind: StopKind
  mile: number
  position: LngLat
  start: string
  end: string
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
  /** Door to door, including required stops; what the ranking compares. */
  trip_duration_s: number
  driving_duration_s: number
  arrival: string
  /** Required driver stops in the order they happen (empty for a team). */
  stops: RouteStop[]
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
  driver: DriverMode
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
