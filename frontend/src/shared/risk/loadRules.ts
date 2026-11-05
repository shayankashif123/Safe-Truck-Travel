/**
 * Plain-language hint for the load field. Mirrors LOAD_ESCALATIONS in
 * backend/trips/domain/rules.py for display only; the backend decides risk.
 */
export const SEVERE_AT_35_MPH_OVER_LB = 40_000
export const NO_TRAVEL_AT_45_MPH_OVER_LB = 30_000

export function loadRuleHint(loadLb: number | null): string {
  if (loadLb === null) return 'Heavier loads lower the wind speeds that are safe to drive in.'
  if (loadLb > SEVERE_AT_35_MPH_OVER_LB) {
    return 'Heavy load: 35–44 mph winds count as Severe and 45+ mph as No Travel.'
  }
  if (loadLb > NO_TRAVEL_AT_45_MPH_OVER_LB) {
    return '45–54 mph winds count as No Travel at this weight.'
  }
  return 'Standard wind thresholds apply at this weight.'
}
