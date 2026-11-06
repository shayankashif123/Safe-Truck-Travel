import { describe, expect, it } from 'vitest'

import {
  departureTimeZone,
  initialTripFormValues,
  nextQuarterHour,
  type SelectedPlace,
  swapPlaces,
  toTripPlanRequest,
  type TripFormValues,
  validateTripForm,
} from './tripFormModel'

const NOW = new Date(2026, 10, 7, 13, 7) // local time
const DALLAS: SelectedPlace = {
  id: 'dallas',
  kind: 'areas',
  title: 'Dallas, TX',
  subtitle: 'United States',
  position: [-96.797, 32.7767],
  time_zone: 'America/Chicago',
}
const DENVER: SelectedPlace = {
  ...DALLAS,
  id: 'denver',
  title: 'Denver, CO',
  position: [-104.99, 39.74],
  time_zone: 'America/Denver',
}

function valid(overrides: Partial<TripFormValues> = {}): TripFormValues {
  return { ...initialTripFormValues(NOW), origin: DALLAS, destination: DENVER, ...overrides }
}

describe('initial values', () => {
  it('departs at the next quarter hour with a 40,000 lb load, 25 mi spacing and a solo driver', () => {
    const values = initialTripFormValues(NOW)
    expect(values.departure).toEqual(new Date(2026, 10, 7, 13, 15))
    expect(values.loadLb).toBe(40_000)
    expect(values.spacingMi).toBe(25)
    expect(values.driver).toBe('solo')
  })

  it('keeps a time already on a quarter hour', () => {
    expect(nextQuarterHour(new Date(2026, 10, 7, 13, 30)).getMinutes()).toBe(30)
  })
})

describe('validateTripForm', () => {
  it('accepts a complete trip', () => {
    expect(validateTripForm(valid(), NOW)).toEqual({})
  })

  it('requires both places to be chosen from suggestions', () => {
    const errors = validateTripForm(valid({ origin: null, destination: null }), NOW)
    expect(Object.keys(errors).sort()).toEqual(['destination', 'origin'])
  })

  it('rejects the same place twice', () => {
    expect(validateTripForm(valid({ destination: DALLAS }), NOW).destination).toMatch(/differ/)
  })

  it('allows a departure a few minutes ago but not earlier', () => {
    const fourMinutesAgo = new Date(NOW.getTime() - 4 * 60_000)
    const tenMinutesAgo = new Date(NOW.getTime() - 10 * 60_000)
    expect(validateTripForm(valid({ departure: fourMinutesAgo }), NOW)).toEqual({})
    expect(validateTripForm(valid({ departure: tenMinutesAgo }), NOW).departure).toMatch(/past/)
  })

  it('rejects departures beyond the 7-day forecast range', () => {
    const eightDays = new Date(NOW.getTime() + 8 * 24 * 3600_000)
    expect(validateTripForm(valid({ departure: eightDays }), NOW).departure).toMatch(/7 days/)
  })

  it('requires a departure', () => {
    expect(validateTripForm(valid({ departure: null }), NOW).departure).toMatch(/Enter/)
  })

  it.each([
    [null, /Enter/],
    [100_001, /between/],
  ])('rejects load %s', (loadLb, message) => {
    expect(validateTripForm(valid({ loadLb }), NOW).loadLb).toMatch(message)
  })

  it('accepts an empty truck', () => {
    expect(validateTripForm(valid({ loadLb: 0 }), NOW)).toEqual({})
  })
})

describe('swapPlaces', () => {
  it('exchanges origin and destination and keeps everything else', () => {
    const before = valid({ loadLb: 12_345 })
    const after = swapPlaces(before)
    expect(after.origin).toBe(DENVER)
    expect(after.destination).toBe(DALLAS)
    expect(after.loadLb).toBe(12_345)
  })

  it('handles an empty side', () => {
    expect(swapPlaces(valid({ destination: null })).origin).toBeNull()
  })
})

describe('toTripPlanRequest', () => {
  it('converts GeoJSON positions to lat/lng and the departure to UTC ISO', () => {
    const departure = new Date('2026-11-07T20:00:00Z')
    const request = toTripPlanRequest(valid({ departure }))
    expect(request.origin).toEqual({ lat: 32.7767, lng: -96.797 })
    expect(request.destination).toEqual({ lat: 39.74, lng: -104.99 })
    expect(request.departure).toBe('2026-11-07T20:00:00.000Z')
    expect(request.load_lb).toBe(40_000)
    expect(request.spacing_mi).toBe(25)
    expect(request.driver).toBe('solo')
  })

  it('sends the chosen driver mode', () => {
    expect(toTripPlanRequest(valid({ driver: 'team' })).driver).toBe('team')
  })
})

describe('departureTimeZone', () => {
  it("is the origin's zone once an origin is chosen", () => {
    expect(departureTimeZone({ origin: DALLAS })).toBe('America/Chicago')
  })

  it("falls back to the viewer's zone", () => {
    const viewer = Intl.DateTimeFormat().resolvedOptions().timeZone
    expect(departureTimeZone({ origin: null })).toBe(viewer)
    expect(departureTimeZone({ origin: { ...DALLAS, time_zone: null } })).toBe(viewer)
  })
})
