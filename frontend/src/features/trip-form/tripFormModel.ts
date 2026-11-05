/**
 * Trip form state, defaults, validation and conversion to the API request.
 * Pure functions, so the rules can be unit tested without rendering anything.
 * Limits mirror the backend (docs/API.md); the backend validates again.
 */
import type {
  CheckpointSpacing,
  LngLat,
  PlaceSuggestion,
  TripPlanRequest,
} from '../../shared/api/types'

export interface SelectedPlace extends PlaceSuggestion {
  position: LngLat
}

export interface TripFormValues {
  origin: SelectedPlace | null
  destination: SelectedPlace | null
  /** Value of an <input type="datetime-local">, in the viewer's time zone. */
  departureLocal: string
  loadLb: number | null
  spacingMi: CheckpointSpacing
}

export type TripFormErrors = Partial<Record<keyof TripFormValues, string>>

export const SPACING_OPTIONS: readonly CheckpointSpacing[] = [10, 25, 50]
export const MAX_LOAD_LB = 100_000
export const MAX_DEPARTURE_DAYS = 7
const PAST_GRACE_MS = 5 * 60_000
const DAY_MS = 24 * 3600_000
const QUARTER_HOUR_MS = 15 * 60_000

export function initialTripFormValues(now: Date): TripFormValues {
  return {
    origin: null,
    destination: null,
    departureLocal: toLocalInputValue(nextQuarterHour(now)),
    loadLb: 40_000,
    spacingMi: 25,
  }
}

export function validateTripForm(values: TripFormValues, now: Date): TripFormErrors {
  const errors: TripFormErrors = {}

  if (!values.origin) errors.origin = 'Choose a starting point from the suggestions.'
  if (!values.destination) errors.destination = 'Choose a destination from the suggestions.'
  if (values.origin && values.destination && values.origin.id === values.destination.id) {
    errors.destination = 'Destination must differ from the starting point.'
  }

  const departure = fromLocalInputValue(values.departureLocal)
  if (!departure) {
    errors.departureLocal = 'Enter a departure date and time.'
  } else if (departure.getTime() < now.getTime() - PAST_GRACE_MS) {
    errors.departureLocal = 'Departure is in the past.'
  } else if (departure.getTime() > now.getTime() + MAX_DEPARTURE_DAYS * DAY_MS) {
    errors.departureLocal = `Departure must be within the next ${MAX_DEPARTURE_DAYS} days (forecast range).`
  }

  if (values.loadLb === null) {
    errors.loadLb = 'Enter the load weight.'
  } else if (values.loadLb < 0 || values.loadLb > MAX_LOAD_LB) {
    errors.loadLb = `Load must be between 0 and ${MAX_LOAD_LB.toLocaleString('en-US')} lb.`
  }

  return errors
}

/** Only call with values that passed validation. */
export function toTripPlanRequest(values: TripFormValues): TripPlanRequest {
  const { origin, destination, loadLb } = values
  const departure = fromLocalInputValue(values.departureLocal)
  if (!origin || !destination || loadLb === null || !departure) {
    throw new Error('toTripPlanRequest called with invalid values')
  }
  return {
    origin: { lng: origin.position[0], lat: origin.position[1] },
    destination: { lng: destination.position[0], lat: destination.position[1] },
    departure: departure.toISOString(),
    load_lb: loadLb,
    spacing_mi: values.spacingMi,
  }
}

export function nextQuarterHour(now: Date): Date {
  return new Date(Math.ceil(now.getTime() / QUARTER_HOUR_MS) * QUARTER_HOUR_MS)
}

/** "2026-11-07T14:05" in the viewer's time zone, as datetime-local inputs expect. */
export function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

export function fromLocalInputValue(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return null
  const date = new Date(value) // no offset in the string: parsed as local time
  return Number.isNaN(date.getTime()) ? null : date
}
