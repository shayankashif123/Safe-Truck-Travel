import type { CheckpointSpacing } from '../../shared/api/types'
import { SegmentedField } from './SegmentedField'
import { SPACING_OPTIONS } from './tripFormModel'

const OPTIONS = SPACING_OPTIONS.map((miles) => ({ value: miles, label: `${miles} mi` }))

interface SpacingFieldProps {
  value: CheckpointSpacing
  onChange: (value: CheckpointSpacing) => void
}

export function SpacingField({ value, onChange }: SpacingFieldProps) {
  return (
    <SegmentedField
      label="Weather checkpoint every"
      options={OPTIONS}
      value={value}
      onChange={onChange}
      helperText="Weather is checked at each checkpoint for the hour the truck gets there."
    />
  )
}
