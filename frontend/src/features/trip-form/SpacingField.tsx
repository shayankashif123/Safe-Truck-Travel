import { Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'

import type { CheckpointSpacing } from '../../shared/api/types'
import { SPACING_OPTIONS } from './tripFormModel'

interface SpacingFieldProps {
  value: CheckpointSpacing
  onChange: (value: CheckpointSpacing) => void
}

export function SpacingField({ value, onChange }: SpacingFieldProps) {
  return (
    <Stack spacing={0.75}>
      <Typography
        id="spacing-label"
        variant="caption"
        sx={{ fontWeight: 600, color: 'text.secondary' }}
      >
        Weather checkpoint every
      </Typography>
      <ToggleButtonGroup
        aria-labelledby="spacing-label"
        exclusive
        fullWidth
        size="small"
        value={value}
        onChange={(_event, next: CheckpointSpacing | null) => next && onChange(next)}
      >
        {SPACING_OPTIONS.map((miles) => (
          <ToggleButton key={miles} value={miles}>
            {miles} mi
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Typography variant="caption" color="text.secondary">
        Weather is checked at each checkpoint for the hour the truck gets there.
      </Typography>
    </Stack>
  )
}
