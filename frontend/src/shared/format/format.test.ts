import { describe, expect, it } from 'vitest'

import { loadRuleHint } from '../risk/loadRules'
import {
  formatDayTime,
  formatLocalTime,
  formatDuration,
  formatDurationDelta,
  formatMiles,
  formatMilesDelta,
  formatPrecipitationRate,
  formatSpeed,
} from './format'

describe('durations', () => {
  it.each([
    [45 * 60, '45 min'],
    [3600, '1 h'],
    [13 * 3600 + 15 * 60, '13 h 15 min'],
    [89, '1 min'],
  ])('%i s -> %s', (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text)
  })

  it('signs deltas and hides differences under a minute', () => {
    expect(formatDurationDelta(18 * 60)).toBe('+18 min')
    expect(formatDurationDelta(-5 * 60)).toBe('−5 min')
    expect(formatDurationDelta(30)).toBeNull()
  })
})

describe('distances', () => {
  it('rounds to whole miles with separators', () => {
    expect(formatMiles(1234.6)).toBe('1,235 mi')
  })

  it('signs deltas and hides zero', () => {
    expect(formatMilesDelta(127.2)).toBe('+127 mi')
    expect(formatMilesDelta(-4)).toBe('−4 mi')
    expect(formatMilesDelta(0.3)).toBeNull()
  })
})

describe('weather values', () => {
  it('rounds wind to whole mph and precipitation to hundredths', () => {
    expect(formatSpeed(46.6)).toBe('47 mph')
    expect(formatPrecipitationRate(0.1)).toBe('0.10 in/h')
    expect(formatPrecipitationRate(0.256)).toBe('0.26 in/h')
  })
})

describe('formatDayTime', () => {
  it('uses a short weekday and a 12-hour clock', () => {
    expect(formatDayTime('2026-11-07T15:15:00Z', 'UTC')).toBe('Sat 3:15 PM')
  })
})

describe('formatLocalTime', () => {
  it('shows local time at the place, labelled with its zone', () => {
    // One instant, as read in Dallas and in Denver.
    expect(formatLocalTime('2026-11-07T20:40:00Z', 'America/Chicago')).toBe('Sat 2:40 PM CST')
    expect(formatLocalTime('2026-11-07T20:40:00Z', 'America/Denver')).toBe('Sat 1:40 PM MST')
  })
})

describe('loadRuleHint mirrors the backend load rules', () => {
  it.each([
    [null, /Heavier loads/],
    [30_000, /Standard/],
    [30_001, /45–54 mph winds count as No Travel/],
    [40_000, /45–54 mph winds count as No Travel/],
    [40_001, /35–44 mph winds count as Severe/],
  ])('%s lb', (load, hint) => {
    expect(loadRuleHint(load)).toMatch(hint)
  })
})
