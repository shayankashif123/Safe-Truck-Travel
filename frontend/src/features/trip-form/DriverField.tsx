import type { DriverMode } from '../../shared/api/types'
import { SegmentedField } from './SegmentedField'

const OPTIONS: readonly { value: DriverMode; label: string }[] = [
  { value: 'solo', label: 'Solo driver' },
  { value: 'team', label: 'Team' },
]

const HELP: Record<DriverMode, string> = {
  solo: 'Includes the required 30-min break after 8 h and 10-h rest after 11 h of driving.',
  team: 'Two drivers take turns, so the truck keeps moving.',
}

interface DriverFieldProps {
  value: DriverMode
  onChange: (value: DriverMode) => void
}

export function DriverField({ value, onChange }: DriverFieldProps) {
  return (
    <SegmentedField
      label="Driver"
      options={OPTIONS}
      value={value}
      onChange={onChange}
      helperText={HELP[value]}
    />
  )
}
