import { InputAdornment, TextField } from '@mui/material'

import { loadRuleHint } from '../../shared/risk/loadRules'

interface LoadFieldProps {
  value: number | null
  onChange: (value: number | null) => void
  error?: string
}

const MAX_DIGITS = 6

/** Load in pounds, shown with thousands separators; the hint explains the load rules. */
export function LoadField({ value, onChange, error }: LoadFieldProps) {
  return (
    <TextField
      id="trip-load"
      label="Load weight"
      value={value === null ? '' : value.toLocaleString('en-US')}
      onChange={(event) => {
        const digits = event.target.value.replace(/\D/g, '').slice(0, MAX_DIGITS)
        onChange(digits ? Number(digits) : null)
      }}
      error={Boolean(error)}
      helperText={error ?? loadRuleHint(value)}
      slotProps={{
        input: { endAdornment: <InputAdornment position="end">lb</InputAdornment> },
        htmlInput: { inputMode: 'numeric', autoComplete: 'off' },
      }}
    />
  )
}
