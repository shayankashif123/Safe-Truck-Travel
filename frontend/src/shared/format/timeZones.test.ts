import { describe, expect, it } from 'vitest'

import { fromZonedInputValue, toZonedInputValue, tomorrowAt6, zoneAbbreviation } from './timeZones'

describe('zoned input values', () => {
  it('reads a clock time in the given zone, not the viewer’s', () => {
    // 2:00 PM in Dallas (CST, UTC-6) is 20:00 UTC wherever the viewer is.
    expect(fromZonedInputValue('2026-11-07T14:00', 'America/Chicago')?.toISOString()).toBe(
      '2026-11-07T20:00:00.000Z',
    )
    expect(fromZonedInputValue('2026-11-07T14:00', 'Asia/Karachi')?.toISOString()).toBe(
      '2026-11-07T09:00:00.000Z',
    )
  })

  it('shows an instant on the zone’s clock', () => {
    const instant = new Date('2026-11-07T20:00:00Z')
    expect(toZonedInputValue(instant, 'America/Chicago')).toBe('2026-11-07T14:00')
    expect(toZonedInputValue(instant, 'America/Denver')).toBe('2026-11-07T13:00')
    expect(toZonedInputValue(instant, 'America/St_Johns')).toBe('2026-11-07T16:30')
  })

  it('handles daylight saving on both sides of the change', () => {
    // US clocks fall back on 1 Nov 2026: CDT (UTC-5) before, CST (UTC-6) after.
    expect(fromZonedInputValue('2026-10-31T12:00', 'America/Chicago')?.toISOString()).toBe(
      '2026-10-31T17:00:00.000Z',
    )
    expect(fromZonedInputValue('2026-11-02T12:00', 'America/Chicago')?.toISOString()).toBe(
      '2026-11-02T18:00:00.000Z',
    )
  })

  it('round-trips every quarter hour across a DST change', () => {
    const start = Date.parse('2026-10-31T00:00:00Z')
    for (let t = start; t < start + 3 * 86_400_000; t += 15 * 60_000) {
      const value = toZonedInputValue(new Date(t), 'America/Denver')
      expect(
        toZonedInputValue(fromZonedInputValue(value, 'America/Denver')!, 'America/Denver'),
      ).toBe(value)
    }
  })

  it('rejects incomplete values', () => {
    expect(fromZonedInputValue('', 'America/Chicago')).toBeNull()
    expect(fromZonedInputValue('2026-11-07', 'America/Chicago')).toBeNull()
  })
})

describe('zoneAbbreviation', () => {
  it('names the zone as drivers know it, including daylight saving', () => {
    expect(zoneAbbreviation('America/Denver', new Date('2026-11-07T12:00:00Z'))).toBe('MST')
    expect(zoneAbbreviation('America/Denver', new Date('2026-07-07T12:00:00Z'))).toBe('MDT')
    expect(zoneAbbreviation('America/Phoenix', new Date('2026-07-07T12:00:00Z'))).toBe('MST')
  })
})

describe('tomorrowAt6', () => {
  it('is 6 AM tomorrow on the zone’s clock, even when it is already tomorrow for the viewer', () => {
    // 22:00 UTC on 7 Nov: still the 7th in Chicago (4 PM), already the 8th in Karachi.
    const now = new Date('2026-11-07T22:00:00Z')
    expect(tomorrowAt6(now, 'America/Chicago').toISOString()).toBe('2026-11-08T12:00:00.000Z')
    expect(tomorrowAt6(now, 'Asia/Karachi').toISOString()).toBe('2026-11-09T01:00:00.000Z')
  })
})
