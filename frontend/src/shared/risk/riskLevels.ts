/**
 * Risk levels as they appear in the API contract (backend RiskLevel.key),
 * mildest first. 'no_data' is a display-only state for missing forecasts.
 */
export const RISK_LEVELS = ['low', 'moderate', 'high', 'severe', 'no_travel'] as const

export type RiskLevel = (typeof RISK_LEVELS)[number]

export type RiskDisplayLevel = RiskLevel | 'no_data'

export const RISK_DISPLAY_LEVELS: readonly RiskDisplayLevel[] = [...RISK_LEVELS, 'no_data']

export const RISK_LABEL: Record<RiskDisplayLevel, string> = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  severe: 'Severe',
  no_travel: 'No Travel',
  no_data: 'No data',
}
