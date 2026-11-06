import LocalShippingRounded from '@mui/icons-material/LocalShippingRounded'
import PauseRounded from '@mui/icons-material/PauseRounded'
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded'
import { Box, IconButton, Paper, Slider, Stack, Switch, Tooltip, Typography } from '@mui/material'

import { formatDayTime, formatPounds } from '../../shared/format/format'
import { RiskBadge } from '../../shared/risk/RiskBadge'
import type { RiskLevel } from '../../shared/risk/riskLevels'
import { RiskLegendRow } from './RiskLegend'

export interface TruckStatus {
  routeId: string
  mile: number
  arrived: boolean
  level: RiskLevel | null
}

interface HeatmapPanelProps {
  frame: number
  lastFrame: number
  frameTimeIso: string
  playing: boolean
  visible: boolean
  loadLb: number
  truck: TruckStatus | null
  onFrameChange: (frame: number) => void
  onTogglePlay: () => void
  onToggleVisible: () => void
}

const MARK_STEP_H = 12

/** The heatmap's control surface: visibility, time scrubber, truck status, legend. */
export function HeatmapPanel(props: HeatmapPanelProps) {
  const { frame, lastFrame, frameTimeIso, playing, visible, truck } = props
  const when = formatDayTime(frameTimeIso)
  const offset = frame === 0 ? 'At departure' : `Departure + ${frame} h`
  const marks = Array.from({ length: Math.floor(lastFrame / MARK_STEP_H) + 1 }, (_, i) => ({
    value: i * MARK_STEP_H,
    label: i === 0 ? 'Dep' : `+${i * MARK_STEP_H}h`,
  }))

  return (
    <Paper
      component="section"
      aria-labelledby="heatmap-panel-title"
      variant="outlined"
      sx={{
        position: 'absolute',
        left: 16,
        bottom: 16,
        // Above route labels and the truck marker (z-index 1-3).
        zIndex: 5,
        width: 380,
        maxWidth: 'calc(100% - 32px)',
        px: 2,
        pt: 1.5,
        pb: 1.25,
        borderRadius: 3,
        boxShadow: '0 8px 24px rgb(15 23 42 / 0.12)',
      }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography
            id="heatmap-panel-title"
            variant="overline"
            component="h2"
            color="text.secondary"
          >
            Weather risk along the corridor
          </Typography>
        </Box>
        <Switch
          size="small"
          checked={visible}
          onChange={props.onToggleVisible}
          slotProps={{ input: { 'aria-label': 'Show weather risk layer' } }}
        />
      </Stack>

      {/* Readout first, scrubber second: the answer sits above the control. */}
      <Stack direction="row" sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Typography variant="h2" component="p" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {when}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
        >
          {offset}
        </Typography>
      </Stack>

      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mt: 0.75 }}>
        <Tooltip title={playing ? 'Pause' : 'Play the next 48 hours'}>
          <IconButton
            aria-label={playing ? 'Pause forecast animation' : 'Play forecast animation'}
            onClick={props.onTogglePlay}
            size="small"
            sx={{ mb: 2.5, border: 1, borderColor: 'divider', color: 'primary.main' }}
          >
            {playing ? <PauseRounded fontSize="small" /> : <PlayArrowRounded fontSize="small" />}
          </IconButton>
        </Tooltip>
        {/* Horizontal padding keeps the first and last mark labels inside the panel. */}
        <Box sx={{ flex: 1, minWidth: 0, px: 1.25 }}>
          <Slider
            aria-label="Forecast hour"
            value={frame}
            min={0}
            max={lastFrame}
            step={1}
            marks={marks}
            onChange={(_event, value) => props.onFrameChange(value as number)}
            getAriaValueText={() => `${offset}, ${when}`}
            size="small"
            sx={{
              display: 'block',
              mb: 2.5,
              '& .MuiSlider-markLabel': {
                top: 22,
                fontSize: '0.6875rem',
                color: 'text.secondary',
              },
              '& .MuiSlider-thumb': { width: 14, height: 14 },
            }}
          />
        </Box>
      </Stack>

      {truck && <TruckLine truck={truck} />}

      <Box sx={{ mt: 1.25, pt: 1.25, borderTop: 1, borderColor: 'divider' }}>
        <RiskLegendRow />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
          Includes the wind load rules for {formatPounds(props.loadLb)}.
        </Typography>
      </Box>
    </Paper>
  )
}

function TruckLine({ truck }: { truck: TruckStatus }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 0.75 }}>
      <LocalShippingRounded sx={{ fontSize: 16, color: 'primary.main' }} />
      <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 500 }}>
        {truck.arrived
          ? `Route ${truck.routeId} truck has arrived`
          : `Route ${truck.routeId} truck · mile ${Math.round(truck.mile).toLocaleString('en-US')}`}
      </Typography>
      {!truck.arrived && <RiskBadge level={truck.level ?? 'no_data'} />}
    </Stack>
  )
}
