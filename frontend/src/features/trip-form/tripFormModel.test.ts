import { describe, expect, it } from 'vitest'

import {
  fromLocalInputValue,
  initialTripFormValues,
  nextQuarterHour,
  type SelectedPlace,
  swapPlaces,
  toLocalInputValue,
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
}
const DENVER: SelectedPlace = {
  ...DALLAS,
  id: 'denver',
  title: 'Denver, CO',
  position: [-104.99, 39.74],
}

function valid(overrides: Partial<TripFormValues> = {}): TripFormValues {
  return { ...initialTripFormValues(NOW), origin: DALLAS, destination: DENVER, ...overrides }
}

describe('initial values', () => {
  it('departs at the next quarter hour with a 40,000 lb load and 25 mi spacing', () => {
    const values = initialTripFormValues(NOW)
    expect(values.departureLocal).toBe('2026-11-07T13:15')
    expect(values.loadLb).toBe(40_000)
    expect(values.spacingMi).toBe(25)
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
    const fourMinutesAgo = toLocalInputValue(new Date(NOW.getTime() - 4 * 60_000))
    const tenMinutesAgo = toLocalInputValue(new Date(NOW.getTime() - 10 * 60_000))
    expect(validateTripForm(valid({ departureLocal: fourMinutesAgo }), NOW)).toEqual({})
    expect(validateTripForm(valid({ departureLocal: tenMinutesAgo }), NOW).departureLocal).toMatch(
      /past/,
    )
  })

  it('rejects departures beyond the 7-day forecast range', () => {
    const eightDays = toLocalInputValue(new Date(NOW.getTime() + 8 * 24 * 3600_000))
    expect(validateTripForm(valid({ departureLocal: eightDays }), NOW).departureLocal).toMatch(
      /7 days/,
    )
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
  it('converts GeoJSON positions to lat/lng and local time to UTC ISO', () => {
    const request = toTripPlanRequest(valid({ departureLocal: '2026-11-07T14:00' }))
    expect(request.origin).toEqual({ lat: 32.7767, lng: -96.797 })
    expect(request.destination).toEqual({ lat: 39.74, lng: -104.99 })
    expect(request.departure).toBe(new Date(2026, 10, 7, 14, 0).toISOString())
    expect(request.load_lb).toBe(40_000)
    expect(request.spacing_mi).toBe(25)
  })
})

describe('local input values', () => {
  it('round-trips through the datetime-local format', () => {
    const date = new Date(2026, 0, 5, 9, 45)
    expect(toLocalInputValue(date)).toBe('2026-01-05T09:45')
    expect(fromLocalInputValue('2026-01-05T09:45')).toEqual(date)
  })

  it('rejects malformed values', () => {
    expect(fromLocalInputValue('')).toBeNull()
    expect(fromLocalInputValue('tomorrow')).toBeNull()
  })
})
