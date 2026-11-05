import { createTheme } from '@mui/material/styles'

import type { RiskDisplayLevel } from '../shared/risk/riskLevels'

/**
 * main:    solid colour for map lines, checkpoints and heatmap cells
 * surface: soft tint for badge and card backgrounds
 * text:    readable text on `surface` (WCAG AA or better)
 */
export interface RiskSwatch {
  main: string
  surface: string
  text: string
}

declare module '@mui/material/styles' {
  interface Palette {
    risk: Record<RiskDisplayLevel, RiskSwatch>
  }
  interface PaletteOptions {
    risk?: Record<RiskDisplayLevel, RiskSwatch>
  }
}

/**
 * Risk scale: green -> amber -> orange -> red -> plum.
 * No Travel is plum, not a darker red, so it stays distinct from Severe for
 * red-green colour-blind users. Colour is never the only signal: every level
 * is also shown with its text label.
 */
const risk: Record<RiskDisplayLevel, RiskSwatch> = {
  low: { main: '#1F9D6B', surface: '#E6F4EE', text: '#0E5B3D' },
  moderate: { main: '#D9A400', surface: '#FBF3D9', text: '#6B5100' },
  high: { main: '#E8710A', surface: '#FDECDD', text: '#8A3F00' },
  severe: { main: '#D4302B', surface: '#FBE4E3', text: '#8E1B17' },
  no_travel: { main: '#5B1A7A', surface: '#EFE3F5', text: '#4A1463' },
  no_data: { main: '#94A3B8', surface: '#F1F5F9', text: '#475569' },
}

/**
 * Single source of truth for the visual language.
 *
 * Direction: a calm, data-dense "operations tool" look. Neutral slate
 * surfaces, 1px borders instead of drop shadows, one deep-teal accent, and
 * saturated colour reserved for risk levels so that risk always stands out.
 */
const slate = {
  50: '#F8FAFC',
  100: '#F1F5F9',
  200: '#E2E8F0',
  300: '#CBD5E1',
  500: '#64748B',
  700: '#334155',
  900: '#0F172A',
}

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#0E5A6A', dark: '#0A4350', light: '#3E8593', contrastText: '#FFFFFF' },
    background: { default: slate[50], paper: '#FFFFFF' },
    text: { primary: slate[900], secondary: slate[500] },
    divider: slate[200],
    grey: slate,
    risk,
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: '"Inter Variable", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
    h1: { fontSize: '1.125rem', fontWeight: 600, letterSpacing: '-0.01em' },
    h2: { fontSize: '1rem', fontWeight: 600, letterSpacing: '-0.005em' },
    subtitle2: { fontWeight: 600 },
    body2: { lineHeight: 1.5 },
    overline: { fontWeight: 600, letterSpacing: '0.08em', lineHeight: 1.6 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        'html, body, #root': { height: '100%' },
        body: { WebkitFontSmoothing: 'antialiased', fontFeatureSettings: '"tnum" 1, "cv11" 1' },
      },
    },
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiCard: { defaultProps: { variant: 'outlined' } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
  },
})
