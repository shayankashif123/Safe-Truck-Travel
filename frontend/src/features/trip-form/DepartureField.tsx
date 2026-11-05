import { Chip, Stack, TextField } from '@mui/material'

import { localTimeZoneName } from '../../shared/format/format'
import { useNow } from '../../shared/hooks/useNow'
import { MAX_DEPARTURE_DAYS, nextQuarterHour, toLocalInputValue } from './tripFormModel'

interface DepartureFieldProps {
  value: string
  onChange: (value: string) => void
  error?: string
}

const HOUR_MS = 3600_000

function presets(now: Date): { label: string; value: string }[] {
  const tomorrowMorning = new Date(now)
  tomorrowMorning.setDate(now.getDate() + 1)
  tomorrowMorning.setHours(6, 0, 0, 0)
  return [
    { label: 'Now', value: toLocalInputValue(nextQuarterHour(now)) },
    {
      label: 'In 6 hours',
      value: toLocalInputValue(nextQuarterHour(new Date(now.getTime() + 6 * HOUR_MS))),
    },
    { label: 'Tomorrow 6 AM', value: toLocalInputValue(tomorrowMorning) },
  ]
}

export function DepartureField({ value, onChange, error }: DepartureFieldProps) {
  const now = useNow()
  const max = new Date(now.getTime() + MAX_DEPARTURE_DAYS * 24 * HOUR_MS)

  return (
    <Stack spacing={1}>
      <TextField
        id="trip-departure"
        type="datetime-local"
        label="Departure"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        error={Boolean(error)}
        helperText={error ?? `Your local time (${localTimeZoneName(now)})`}
        slotProps={{
          inputLabel: { shrink: true },
          htmlInput: { min: toLocalInputValue(now), max: toLocalInputValue(max), step: 300 },
        }}
      />
      <Stack direction="row" spacing={0.75} role="group" aria-label="Quick departure times">
        {presets(now).map((preset) => (
          <Chip
            key={preset.label}
            label={preset.label}
            size="small"
            variant={preset.value === value ? 'filled' : 'outlined'}
            color={preset.value === value ? 'primary' : 'default'}
            onClick={() => onChange(preset.value)}
          />
        ))}
      </Stack>
    </Stack>
  )
}
