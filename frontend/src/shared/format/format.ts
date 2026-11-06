/**
 * Display formatting. US trucking conventions: miles, pounds, 12-hour clock.
 * Times take the IANA zone of the place they describe (see timeZones.ts);
 * without one they fall back to the viewer's zone.
 */

import { viewerTimeZone, zoneAbbreviation } from './timeZones'

const LOCALE = 'en-US'

export function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(Math.abs(seconds) / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes} min`
  if (minutes === 0) return `${hours} h`
  return `${hours} h ${minutes} min`
}

/**
 * "1,235 mi". Below 10 mi one decimal is kept, so a short risky stretch reads
 * "0.4 mi" rather than "0 mi". Pass `fractionDigits` to force a precision.
 */
export function formatMiles(miles: number, fractionDigits = miles < 10 ? 1 : 0): string {
  return `${miles.toLocaleString(LOCALE, { maximumFractionDigits: fractionDigits })} mi`
}

export function formatPounds(pounds: number): string {
  return `${pounds.toLocaleString(LOCALE)} lb`
}

/** "47 mph" */
export function formatSpeed(mph: number): string {
  return `${Math.round(mph)} mph`
}

/** "0.12 in/h"; two decimals because risk thresholds start at 0.10 in/h. */
export function formatPrecipitationRate(inchesPerHour: number): string {
  return `${inchesPerHour.toFixed(2)} in/h`
}

/** "+18 min", "−5 min", or null when the difference is under a minute. */
export function formatDurationDelta(seconds: number): string | null {
  if (Math.abs(seconds) < 60) return null
  return `${seconds > 0 ? '+' : '−'}${formatDuration(seconds)}`
}

/** "+127 mi", "−4 mi", or null when the difference rounds to zero. */
export function formatMilesDelta(miles: number): string | null {
  const rounded = Math.round(miles)
  if (rounded === 0) return null
  return `${rounded > 0 ? '+' : '−'}${formatMiles(Math.abs(rounded))}`
}

/** "Fri 3:15 PM" on the zone's clock. */
export function formatDayTime(iso: string, timeZone?: string | null): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timeZone ?? undefined,
  }).format(new Date(iso))
}

/**
 * "Fri 3:15 PM CST": local time at a place, always labelled with its zone,
 * so a trip that crosses zones (or a viewer elsewhere) can never misread it.
 */
export function formatLocalTime(iso: string, timeZone?: string | null): string {
  // Composed from parts: Intl inserts a comma ("Fri, 3:15 PM CST") when a zone
  // name is requested, which would not match formatDayTime elsewhere in the UI.
  const zone = zoneAbbreviation(timeZone ?? viewerTimeZone(), new Date(iso))
  return `${formatDayTime(iso, timeZone)} ${zone}`
}
