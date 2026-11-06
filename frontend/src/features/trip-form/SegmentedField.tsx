import { Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { useId } from 'react'

export interface SegmentedOption<T extends string | number> {
  value: T
  label: string
}

interface SegmentedFieldProps<T extends string | number> {
  label: string
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Explains the current choice; may depend on it. */
  helperText: string
}

/** A labelled single choice between a few options, always with one selected. */
export function SegmentedField<T extends string | number>({
  label,
  options,
  value,
  onChange,
  helperText,
}: SegmentedFieldProps<T>) {
  const labelId = useId()
  return (
    <Stack spacing={0.75}>
      <Typography id={labelId} variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
        {label}
      </Typography>
      <ToggleButtonGroup
        aria-labelledby={labelId}
        exclusive
        fullWidth
        size="small"
        value={value}
        // MUI reports null when the selected button is clicked again; keep the choice.
        onChange={(_event, next: T | null) => next !== null && onChange(next)}
      >
        {options.map((option) => (
          <ToggleButton key={option.value} value={option.value}>
            {option.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Typography variant="caption" color="text.secondary">
        {helperText}
      </Typography>
    </Stack>
  )
}
