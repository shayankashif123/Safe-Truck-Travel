/**
 * Trip form state, defaults, validation and conversion to the API request.
 * Pure functions, so the rules can be unit tested without rendering anything.
 * Limits mirror the backend (docs/API.md); the backend validates again.
 */
import type {
  CheckpointSpacing,
  DriverMode,
  LngLat,
  PlaceSuggestion,
  TripPlanRequest,
} from '../../shared/api/types'
import { viewerTimeZone } from '../../shared/format/timeZones'

export interface SelectedPlace extends PlaceSuggestion {
  position: LngLat
  /** IANA zone of the place; the departure is shown and typed in the origin's. */
  time_zone: string | null
}

export interface TripFormValues {
  origin: SelectedPlace | null
  destination: SelectedPlace | null
  /**
   * The departure instant. Kept as an instant (not as clock text) so choosing an
   * origin in another time zone changes how it is displayed, never when it is.
   */
  departure: Date | null
  loadLb: number | null
  spacingMi: CheckpointSpacing
  driver: DriverMode
}

export type TripFormErrors = Partial<Record<keyof TripFormValues, string>>

export const SPACING_OPTIONS: readonly CheckpointSpacing[] = [10, 25, 50]
export const DRIVER_OPTIONS: readonly DriverMode[] = ['solo', 'team']
export const MAX_LOAD_LB = 100_000
export const MAX_DEPARTURE_DAYS = 7
const PAST_GRACE_MS = 5 * 60_000
const DAY_MS = 24 * 3600_000
const QUARTER_HOUR_MS = 15 * 60_000

export function initialTripFormValues(now: Date): TripFormValues {
  return {
    origin: null,
    destination: null,
    departure: nextQuarterHour(now),
    loadLb: 40_000,
    spacingMi: 25,
    // Solo is the safe default: required stops only ever make ETAs later.
    driver: 'solo',
  }
}

export function validateTripForm(values: TripFormValues, now: Date): TripFormErrors {
  const errors: TripFormErrors = {}

  if (!values.origin) errors.origin = 'Choose a starting point from the suggestions.'
  if (!values.destination) errors.destination = 'Choose a destination from the suggestions.'
  if (values.origin && values.destination && values.origin.id === values.destination.id) {
    errors.destination = 'Destination must differ from the starting point.'
  }

  const { departure } = values
  if (!departure) {
    errors.departure = 'Enter a departure date and time.'
  } else if (departure.getTime() < now.getTime() - PAST_GRACE_MS) {
    errors.departure = 'Departure is in the past.'
  } else if (departure.getTime() > now.getTime() + MAX_DEPARTURE_DAYS * DAY_MS) {
    errors.departure = `Departure must be within the next ${MAX_DEPARTURE_DAYS} days (forecast range).`
  }

  if (values.loadLb === null) {
    errors.loadLb = 'Enter the load weight.'
  } else if (values.loadLb < 0 || values.loadLb > MAX_LOAD_LB) {
    errors.loadLb = `Load must be between 0 and ${MAX_LOAD_LB.toLocaleString('en-US')} lb.`
  }

  return errors
}

/** Origin and destination exchanged in one step (used as a state updater). */
export function swapPlaces(values: TripFormValues): TripFormValues {
  return { ...values, origin: values.destination, destination: values.origin }
}

/** Only call with values that passed validation. */
export function toTripPlanRequest(values: TripFormValues): TripPlanRequest {
  const { origin, destination, loadLb, departure } = values
  if (!origin || !destination || loadLb === null || !departure) {
    throw new Error('toTripPlanRequest called with invalid values')
  }
  return {
    origin: { lng: origin.position[0], lat: origin.position[1] },
    destination: { lng: destination.position[0], lat: destination.position[1] },
    departure: departure.toISOString(),
    load_lb: loadLb,
    spacing_mi: values.spacingMi,
    driver: values.driver,
  }
}

export function nextQuarterHour(now: Date): Date {
  return new Date(Math.ceil(now.getTime() / QUARTER_HOUR_MS) * QUARTER_HOUR_MS)
}

/** The zone the departure is shown and typed in: the origin's, else the viewer's. */
export function departureTimeZone(values: Pick<TripFormValues, 'origin'>): string {
  return values.origin?.time_zone ?? viewerTimeZone()
}
