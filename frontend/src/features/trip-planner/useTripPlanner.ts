import { useMutation } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'

import { toErrorBody } from '../../shared/api/client'
import { planTrip } from '../../shared/api/endpoints'
import type { ApiErrorBody, TripPlan, TripPlanRequest } from '../../shared/api/types'

export type PlannerStatus = 'idle' | 'loading' | 'error' | 'success'

export interface TripPlanner {
  status: PlannerStatus
  /** The last successful plan. Kept while a new one loads, cleared on error. */
  plan: TripPlan | null
  error: ApiErrorBody | null
  selectedRouteId: string | null
  submit: (request: TripPlanRequest) => void
  retry: () => void
  selectRoute: (routeId: string) => void
}

/** Owns the planning request and which route is selected (shared by panel and map). */
export function useTripPlanner(): TripPlanner {
  const lastRequest = useRef<TripPlanRequest | null>(null)
  const [plan, setPlan] = useState<TripPlan | null>(null)
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (request: TripPlanRequest) => planTrip(request),
    onSuccess: (result) => {
      setPlan(result)
      setSelectedRouteId(result.recommended_route_id)
    },
    onError: () => setPlan(null),
  })
  const { mutate } = mutation

  const submit = useCallback(
    (request: TripPlanRequest) => {
      lastRequest.current = request
      mutate(request)
    },
    [mutate],
  )

  const retry = useCallback(() => {
    if (lastRequest.current) mutate(lastRequest.current)
  }, [mutate])

  const status: PlannerStatus = mutation.isPending
    ? 'loading'
    : mutation.isError
      ? 'error'
      : plan
        ? 'success'
        : 'idle'

  return {
    status,
    plan,
    error: mutation.isError ? toErrorBody(mutation.error) : null,
    selectedRouteId,
    submit,
    retry,
    selectRoute: setSelectedRouteId,
  }
}
