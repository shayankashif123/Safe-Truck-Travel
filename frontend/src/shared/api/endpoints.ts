import { apiGet, apiPost } from './client'
import type { Place, PlaceSuggestion, TripPlan, TripPlanRequest } from './types'

export const fetchPlaceSuggestions = async (query: string, signal?: AbortSignal) =>
  (
    await apiGet<{ results: PlaceSuggestion[] }>(
      `/api/places/suggest/?q=${encodeURIComponent(query)}`,
      signal,
    )
  ).results

export const fetchPlace = (kind: string, id: string, signal?: AbortSignal) =>
  apiGet<Place>(`/api/places/${encodeURIComponent(kind)}/${encodeURIComponent(id)}/`, signal)

export const planTrip = (request: TripPlanRequest, signal?: AbortSignal) =>
  apiPost<TripPlan>('/api/trips/plan/', request, signal)
