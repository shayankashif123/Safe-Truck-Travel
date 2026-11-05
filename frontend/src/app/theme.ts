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
  400: '#94A3B8',
  500: '#64748B',
  600: '#475569',
  700: '#334155',
  800: '#1E293B',
  900: '#0F172A',
}

const teal = { main: '#0E5A6A', dark: '#0A4350', light: '#3E8593', tint: '#E7F0F2' }

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: teal.main, dark: teal.dark, light: teal.light, contrastText: '#FFFFFF' },
    success: { main: '#1F9D6B' },
    warning: { main: '#C77700' },
    error: { main: '#C62828' },
    background: { default: slate[50], paper: '#FFFFFF' },
    text: { primary: slate[900], secondary: slate[500] },
    divider: slate[200],
    grey: slate,
    risk,
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: '"Inter Variable", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
    h1: { fontSize: '1.0625rem', fontWeight: 600, letterSpacing: '-0.01em' },
    h2: { fontSize: '0.9375rem', fontWeight: 600, letterSpacing: '-0.005em' },
    h3: {
      fontSize: '1.25rem',
      fontWeight: 600,
      letterSpacing: '-0.015em',
      fontVariantNumeric: 'tabular-nums',
    },
    subtitle2: { fontWeight: 600, fontSize: '0.875rem' },
    body2: { lineHeight: 1.5 },
    caption: { lineHeight: 1.45 },
    overline: { fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em', lineHeight: 1.6 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        'html, body, #root': { height: '100%' },
        // Tabular figures are applied only where numbers must align (see `h3`),
        // because in Inter they also widen punctuation such as hyphens.
        body: { WebkitFontSmoothing: 'antialiased', fontFeatureSettings: '"cv11" 1' },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        sizeLarge: { minHeight: 44, fontSize: '0.9375rem' },
        // While loading, keep the brand colour so it reads as "working", not "disabled".
        root: {
          '&.MuiButton-contained.MuiButton-colorPrimary.MuiButton-loading': {
            backgroundColor: teal.main,
            color: '#FFFFFF',
            '& .MuiButton-loadingIndicator': { color: '#FFFFFF' },
          },
        },
      },
    },
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiCard: { defaultProps: { variant: 'outlined' } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
    MuiTextField: { defaultProps: { size: 'small', fullWidth: true } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: slate[300] },
          '&:hover:not(.Mui-focused):not(.Mui-error) .MuiOutlinedInput-notchedOutline': {
            borderColor: slate[400],
          },
        },
        input: { fontWeight: 500 },
      },
    },
    MuiFormHelperText: { styleOverrides: { root: { marginLeft: 2, marginRight: 2 } } },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          color: slate[600],
          borderColor: slate[300],
          '&.Mui-selected': {
            color: teal.dark,
            backgroundColor: teal.tint,
            '&:hover': { backgroundColor: '#DCE9EC' },
          },
        },
      },
    },
    MuiTooltip: {
      defaultProps: { arrow: true },
      styleOverrides: {
        tooltip: {
          backgroundColor: slate[800],
          fontSize: '0.75rem',
          fontWeight: 500,
          padding: '6px 10px',
        },
        arrow: { color: slate[800] },
      },
    },
    MuiSkeleton: { styleOverrides: { root: { backgroundColor: slate[100] } } },
    MuiLinearProgress: {
      styleOverrides: { root: { height: 2, backgroundColor: teal.tint } },
    },
    MuiAutocomplete: {
      styleOverrides: {
        paper: { border: `1px solid ${slate[200]}`, boxShadow: '0 8px 24px rgb(15 23 42 / 0.08)' },
        option: { paddingTop: 8, paddingBottom: 8 },
      },
    },
  },
})
