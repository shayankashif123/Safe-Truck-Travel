/**
 * Wall-clock time in a named IANA time zone, using only the browser's Intl API.
 *
 * Trip times are instants (UTC). People read them as local clock times at a
 * place, so the UI converts at the edges: instants are shown in the zone of the
 * place they describe, and a typed departure is read in the origin's zone.
 */

const INPUT_VALUE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/

/** The viewer's own zone, e.g. "Asia/Karachi". */
export function viewerTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

interface WallClock {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const wallFormatters = new Map<string, Intl.DateTimeFormat>()

function wallClock(date: Date, timeZone: string): WallClock {
  let formatter = wallFormatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    wallFormatters.set(timeZone, formatter)
  }
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, Number(part.value)]),
  )
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  }
}

/** How far the zone's clock is ahead of UTC at `date`, in ms (e.g. -6 h for CST). */
function offsetMs(date: Date, timeZone: string): number {
  const w = wallClock(date, timeZone)
  const wallAsUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second)
  return wallAsUtc - (date.getTime() - date.getMilliseconds())
}

/** "2026-11-07T14:05": `date` on the zone's clock, as datetime-local inputs expect. */
export function toZonedInputValue(date: Date, timeZone: string): string {
  const w = wallClock(date, timeZone)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${w.year}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}`
}

/**
 * The instant at which the zone's clock shows `value`. Null if `value` is not a
 * complete date and time. Around a daylight-saving change, a clock time that
 * does not exist or occurs twice resolves to one nearby valid instant.
 */
export function fromZonedInputValue(value: string, timeZone: string): Date | null {
  const match = INPUT_VALUE.exec(value)
  if (!match) return null
  const [year, month, day, hour, minute] = match.slice(1).map(Number)
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute)
  if (Number.isNaN(wallAsUtc)) return null
  // The offset depends on the instant we are looking for, so guess, then correct
  // once with the offset at the guess (this settles DST transitions).
  const guess = wallAsUtc - offsetMs(new Date(wallAsUtc), timeZone)
  return new Date(wallAsUtc - offsetMs(new Date(guess), timeZone))
}

/** Short zone name at `date`, e.g. "CST", "MDT" or "GMT+5". */
export function zoneAbbreviation(timeZone: string, date: Date = new Date()): string {
  return (
    new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' })
      .formatToParts(date)
      .find((part) => part.type === 'timeZoneName')?.value ?? timeZone
  )
}

/** 06:00 tomorrow on the zone's clock. */
export function tomorrowAt6(now: Date, timeZone: string): Date {
  const today = wallClock(now, timeZone)
  const tomorrow = new Date(Date.UTC(today.year, today.month - 1, today.day + 1))
  const date = tomorrow.toISOString().slice(0, 10)
  return fromZonedInputValue(`${date}T06:00`, timeZone) as Date
}
