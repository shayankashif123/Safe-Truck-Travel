import AltRouteRounded from '@mui/icons-material/AltRouteRounded'
import { Box, Button, Divider, Link, Stack, Typography } from '@mui/material'
import { type FormEvent, useState } from 'react'

import type { TripPlanRequest } from '../../shared/api/types'
import { DepartureField } from './DepartureField'
import { LoadField } from './LoadField'
import { PlacePairField } from './PlacePairField'
import { SpacingField } from './SpacingField'
import {
  initialTripFormValues,
  type SelectedPlace,
  toTripPlanRequest,
  type TripFormErrors,
  type TripFormValues,
  validateTripForm,
} from './tripFormModel'

/** A ready-made trip so reviewers can try the app without typing. */
const EXAMPLE_TRIP: { origin: SelectedPlace; destination: SelectedPlace } = {
  origin: {
    id: 'example-dallas',
    kind: 'areas',
    title: 'Dallas, TX',
    subtitle: 'United States',
    position: [-96.797, 32.7767],
  },
  destination: {
    id: 'example-denver',
    kind: 'areas',
    title: 'Denver, CO',
    subtitle: 'United States',
    position: [-104.9903, 39.7392],
  },
}

interface TripFormProps {
  onSubmit: (request: TripPlanRequest) => void
  submitting: boolean
}

export function TripForm({ onSubmit, submitting }: TripFormProps) {
  const [values, setValues] = useState<TripFormValues>(() => initialTripFormValues(new Date()))
  const [errors, setErrors] = useState<TripFormErrors>({})
  const [submitted, setSubmitted] = useState(false)

  function apply(patch: Partial<TripFormValues>) {
    const next = { ...values, ...patch }
    setValues(next)
    // After the first submit, re-validate as the user fixes things.
    if (submitted) setErrors(validateTripForm(next, new Date()))
  }

  function update<K extends keyof TripFormValues>(key: K, value: TripFormValues[K]) {
    apply({ [key]: value })
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    const found = validateTripForm(values, new Date())
    setErrors(found)
    if (Object.keys(found).length === 0) onSubmit(toTripPlanRequest(values))
  }

  return (
    <Box component="form" noValidate onSubmit={handleSubmit} aria-labelledby="trip-form-title">
      <Stack
        direction="row"
        sx={{ alignItems: 'baseline', justifyContent: 'space-between', mb: 2 }}
      >
        <Typography id="trip-form-title" variant="h2" component="h2">
          Plan a trip
        </Typography>
        <Link
          component="button"
          type="button"
          variant="caption"
          underline="hover"
          sx={{ fontWeight: 600 }}
          onClick={() => apply(EXAMPLE_TRIP)}
        >
          Try Dallas → Denver
        </Link>
      </Stack>

      <Stack spacing={2.5}>
        <PlacePairField
          origin={values.origin}
          destination={values.destination}
          onOriginChange={(place) => update('origin', place)}
          onDestinationChange={(place) => update('destination', place)}
          originError={errors.origin}
          destinationError={errors.destination}
        />

        <Divider flexItem />

        <DepartureField
          value={values.departureLocal}
          onChange={(value) => update('departureLocal', value)}
          error={errors.departureLocal}
        />
        <LoadField
          value={values.loadLb}
          onChange={(value) => update('loadLb', value)}
          error={errors.loadLb}
        />
        <SpacingField value={values.spacingMi} onChange={(value) => update('spacingMi', value)} />

        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          loading={submitting}
          loadingPosition="start"
          startIcon={<AltRouteRounded />}
        >
          {submitting ? 'Comparing routes…' : 'Compare routes'}
        </Button>
      </Stack>
    </Box>
  )
}
