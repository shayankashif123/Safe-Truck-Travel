import BusinessOutlined from '@mui/icons-material/BusinessOutlined'
import LocationCityOutlined from '@mui/icons-material/LocationCityOutlined'
import PlaceOutlined from '@mui/icons-material/PlaceOutlined'
import { Autocomplete, Box, CircularProgress, TextField, Typography } from '@mui/material'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'

import { fetchPlace, fetchPlaceSuggestions } from '../../shared/api/endpoints'
import type { PlaceSuggestion } from '../../shared/api/types'
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue'
import type { SelectedPlace } from './tripFormModel'

const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 250
const SUGGESTIONS_STALE_MS = 5 * 60_000

const KIND_ICON: Record<string, typeof PlaceOutlined> = {
  areas: LocationCityOutlined,
  pois: BusinessOutlined,
}

interface PlaceFieldProps {
  id: string
  label: string
  value: SelectedPlace | null
  onChange: (place: SelectedPlace | null) => void
  marker: ReactNode
  error?: string
}

/**
 * Address autocomplete backed by TomTom Places (through our API). Suggestions
 * are debounced and cached; choosing one resolves its coordinates once.
 */
export function PlaceField({ id, label, value, onChange, marker, error }: PlaceFieldProps) {
  const queryClient = useQueryClient()
  const [input, setInput] = useState(value?.title ?? '')
  const [resolving, setResolving] = useState(false)
  const [resolveError, setResolveError] = useState<string | null>(null)

  const query = useDebouncedValue(input.trim(), DEBOUNCE_MS)
  const searchable = query.length >= MIN_QUERY_LENGTH && query !== value?.title

  const suggestions = useQuery({
    queryKey: ['places', 'suggest', query.toLowerCase()],
    queryFn: ({ signal }) => fetchPlaceSuggestions(query, signal),
    enabled: searchable,
    staleTime: SUGGESTIONS_STALE_MS,
    placeholderData: keepPreviousData,
  })

  async function select(suggestion: PlaceSuggestion | null) {
    setResolveError(null)
    if (!suggestion) {
      onChange(null)
      return
    }
    setResolving(true)
    try {
      const place = await queryClient.fetchQuery({
        queryKey: ['places', suggestion.kind, suggestion.id],
        queryFn: ({ signal }) => fetchPlace(suggestion.kind, suggestion.id, signal),
        staleTime: Infinity,
      })
      onChange({ ...suggestion, position: place.position, time_zone: place.time_zone })
    } catch {
      setResolveError('Could not load this place. Please choose it again.')
      onChange(null)
    } finally {
      setResolving(false)
    }
  }

  const helperText = resolveError ?? error

  return (
    <Autocomplete<PlaceSuggestion>
      id={id}
      options={searchable ? (suggestions.data ?? []) : []}
      value={value}
      inputValue={input}
      onInputChange={(_event, next) => setInput(next)}
      onChange={(_event, next) => void select(next)}
      filterOptions={(options) => options} // the server already filtered
      getOptionLabel={(option) => option.title}
      isOptionEqualToValue={(option, selected) => option.id === selected.id}
      loading={searchable && suggestions.isFetching}
      loadingText="Searching…"
      noOptionsText={
        query.length < MIN_QUERY_LENGTH ? 'Type a city, address or place' : 'No matching places'
      }
      autoHighlight
      forcePopupIcon={false} // a search field, not a fixed list
      renderOption={(props, option) => {
        const { key, ...optionProps } = props
        const Icon = KIND_ICON[option.kind] ?? PlaceOutlined
        return (
          <Box component="li" key={key} {...optionProps} sx={{ gap: 1.5 }}>
            <Icon fontSize="small" sx={{ color: 'text.secondary', flexShrink: 0 }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                {option.title}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap component="div">
                {option.subtitle}
              </Typography>
            </Box>
          </Box>
        )
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder="City, address or place"
          error={Boolean(helperText)}
          helperText={helperText}
          slotProps={{
            ...params.slotProps,
            input: {
              ...params.slotProps.input,
              startAdornment: (
                <Box sx={{ display: 'flex', alignItems: 'center', pl: 0.5, pr: 0.25 }}>
                  {marker}
                </Box>
              ),
              endAdornment: (
                <>
                  {resolving && <CircularProgress size={16} sx={{ mr: 1 }} />}
                  {params.slotProps.input.endAdornment}
                </>
              ),
            },
          }}
        />
      )}
    />
  )
}
