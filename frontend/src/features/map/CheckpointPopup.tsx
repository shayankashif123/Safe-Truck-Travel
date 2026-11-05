import CloseRounded from '@mui/icons-material/CloseRounded'
import { Box, IconButton, Stack, Typography } from '@mui/material'

import type { Checkpoint, CheckpointWeather, RiskFactor } from '../../shared/api/types'
import { formatDayTime, formatPrecipitationRate, formatSpeed } from '../../shared/format/format'
import { RiskBadge } from '../../shared/risk/RiskBadge'

interface CheckpointPopupProps {
  routeId: string
  checkpoint: Checkpoint
  /** A pinned popup stays open and shows a close button. */
  onClose?: () => void
}

const FACTOR_LABEL: Record<RiskFactor, string> = { wind: 'wind', rain: 'rain', snow: 'snow' }

export function CheckpointPopup({ routeId, checkpoint, onClose }: CheckpointPopupProps) {
  const { level, weather, drivers } = checkpoint

  return (
    <Box sx={{ width: 248, p: 1.5 }}>
      <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
            Route {routeId} · Mile {Math.round(checkpoint.mile).toLocaleString('en-US')}
          </Typography>
          <Typography variant="subtitle2" component="p">
            Arrives {formatDayTime(checkpoint.eta)}
          </Typography>
        </Box>
        {onClose && (
          <IconButton size="small" aria-label="Close" onClick={onClose} sx={{ mt: -0.5, mr: -0.5 }}>
            <CloseRounded fontSize="small" />
          </IconButton>
        )}
      </Stack>

      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1, flexWrap: 'wrap' }}>
        <RiskBadge level={level ?? 'no_data'} />
        {drivers.length > 0 && (
          <Typography variant="caption" color="text.secondary">
            from {drivers.map((d) => FACTOR_LABEL[d]).join(' and ')}
          </Typography>
        )}
      </Stack>

      {checkpoint.load_escalated && (
        <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: 'text.primary' }}>
          Raised by the load: heavy trucks are more exposed to wind.
        </Typography>
      )}

      {weather ? (
        <WeatherGrid weather={weather} />
      ) : (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          No forecast covers this place at this time.
        </Typography>
      )}
    </Box>
  )
}

function WeatherGrid({ weather }: { weather: CheckpointWeather }) {
  const cells = [
    ['Wind', formatSpeed(weather.wind_mph)],
    ['Gusts', weather.gust_mph === null ? '—' : formatSpeed(weather.gust_mph)],
    ['Rain', formatPrecipitationRate(weather.rain_in_per_hr)],
    ['Snow', formatPrecipitationRate(weather.snow_in_per_hr)],
  ]
  return (
    <Box
      component="dl"
      sx={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 1,
        m: 0,
        mt: 1.25,
        pt: 1.25,
        borderTop: 1,
        borderColor: 'divider',
      }}
    >
      {cells.map(([label, value]) => (
        <Box key={label}>
          <Typography component="dt" variant="caption" color="text.secondary">
            {label}
          </Typography>
          <Typography
            component="dd"
            variant="body2"
            sx={{ m: 0, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
          >
            {value}
          </Typography>
        </Box>
      ))}
    </Box>
  )
}
