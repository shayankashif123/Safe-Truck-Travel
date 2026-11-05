/**
 * Display formatting. US trucking conventions: miles, pounds, 12-hour clock.
 * `timeZone` is only passed in tests; the app uses the viewer's own zone.
 */

const LOCALE = 'en-US'

export function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(Math.abs(seconds) / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes} min`
  if (minutes === 0) return `${hours} h`
  return `${hours} h ${minutes} min`
}

export function formatMiles(miles: number): string {
  return `${Math.round(miles).toLocaleString(LOCALE)} mi`
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

/** "Fri 3:15 PM" */
export function formatDayTime(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(new Date(iso))
}

/** Short name of the viewer's time zone, e.g. "CST" or "GMT+5". */
export function localTimeZoneName(date = new Date()): string {
  return (
    new Intl.DateTimeFormat(LOCALE, { timeZoneName: 'short' })
      .formatToParts(date)
      .find((part) => part.type === 'timeZoneName')?.value ?? 'local time'
  )
}
