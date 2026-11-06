import { Chip, Stack, TextField } from '@mui/material'

import {
  fromZonedInputValue,
  toZonedInputValue,
  tomorrowAt6,
  zoneAbbreviation,
} from '../../shared/format/timeZones'
import { useNow } from '../../shared/hooks/useNow'
import { MAX_DEPARTURE_DAYS, nextQuarterHour } from './tripFormModel'

interface DepartureFieldProps {
  value: Date | null
  onChange: (value: Date | null) => void
  /** IANA zone the time is shown and typed in (the origin's, else the viewer's). */
  timeZone: string
  /** Where that zone comes from, e.g. "Dallas, TX"; absent for the viewer's own zone. */
  placeName?: string
  error?: string
}

const HOUR_MS = 3600_000

function presets(now: Date, timeZone: string): { label: string; value: Date }[] {
  return [
    { label: 'Now', value: nextQuarterHour(now) },
    { label: 'In 6 hours', value: nextQuarterHour(new Date(now.getTime() + 6 * HOUR_MS)) },
    { label: 'Tomorrow 6 AM', value: tomorrowAt6(now, timeZone) },
  ]
}

export function DepartureField({
  value,
  onChange,
  timeZone,
  placeName,
  error,
}: DepartureFieldProps) {
  const now = useNow()
  const max = new Date(now.getTime() + MAX_DEPARTURE_DAYS * 24 * HOUR_MS)
  const zone = zoneAbbreviation(timeZone, value ?? now)
  const help = placeName ? `Local time in ${placeName} (${zone})` : `Your local time (${zone})`

  return (
    <Stack spacing={1}>
      <TextField
        id="trip-departure"
        type="datetime-local"
        label="Departure"
        value={value ? toZonedInputValue(value, timeZone) : ''}
        onChange={(event) => onChange(fromZonedInputValue(event.target.value, timeZone))}
        error={Boolean(error)}
        helperText={error ?? help}
        slotProps={{
          inputLabel: { shrink: true },
          htmlInput: {
            min: toZonedInputValue(now, timeZone),
            max: toZonedInputValue(max, timeZone),
            step: 300,
          },
        }}
      />
      <Stack direction="row" spacing={0.75} role="group" aria-label="Quick departure times">
        {presets(now, timeZone).map((preset) => {
          const active = value?.getTime() === preset.value.getTime()
          return (
            <Chip
              key={preset.label}
              label={preset.label}
              size="small"
              variant={active ? 'filled' : 'outlined'}
              color={active ? 'primary' : 'default'}
              onClick={() => onChange(preset.value)}
            />
          )
        })}
      </Stack>
    </Stack>
  )
}
