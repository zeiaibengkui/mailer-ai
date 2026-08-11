import { createTheme, type ThemeOptions } from '@mui/material/styles'
import type { CSSProperties } from 'react'

/**
 * "The Exchange" — an operator's switchboard for autonomous mail agents.
 *
 * Palette (named tokens, shared by light + dark):
 *   ink   — deep switchboard green-black   (dark app background)
 *   panel — raised surface                  (dark)
 *   rule  — hairline dividers / ledger lines
 *   paper — warm ledger ivory               (light app background)
 *   teal  — primary signal (the live connection)
 *   brass — secondary signal (the lamp / queued work)
 *   mail  — dispatch red (destructive, send-fail)
 *
 * Type:
 *   Fraunces (soft letterpress serif) — wordmark, titles, monogram stamps
 *   IBM Plex Sans — body
 *   IBM Plex Mono — machine data: addresses, hosts, ports, counts, times
 */

export const TYPE = {
  display: '"Fraunces", "Iowan Old Style", Georgia, serif',
  body: '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
}

type Palette = {
  mode: 'light' | 'dark'
  primary: { main: string }
  secondary: { main: string }
  error: { main: string }
  background: { default: string; paper: string }
  text: { primary: string; secondary: string }
  divider: string
  action: { hover: string }
}

function palette(mode: 'light' | 'dark'): Palette {
  return mode === 'dark'
    ? {
        mode,
        primary: { main: '#4FA98F' },
        secondary: { main: '#D8A13E' },
        error: { main: '#C8523A' },
        background: { default: '#0E1312', paper: '#161C1A' },
        text: { primary: '#E8E6DA', secondary: '#8B958E' },
        divider: '#2B3431',
        action: { hover: 'rgba(79, 169, 143, 0.08)' },
      }
    : {
        mode,
        primary: { main: '#2E7A63' },
        secondary: { main: '#A9761F' },
        error: { main: '#A64028' },
        background: { default: '#F1EEE1', paper: '#F8F5EB' },
        text: { primary: '#23261F', secondary: '#6C756C' },
        divider: '#D9D3C1',
        action: { hover: 'rgba(46, 122, 99, 0.08)' },
      }
}

function base(mode: 'light' | 'dark'): ThemeOptions {
  const p = palette(mode)
  const isDark = mode === 'dark'

  return {
    palette: p,
    shape: { borderRadius: 6 },
    typography: {
      fontFamily: TYPE.body,
      display: { fontFamily: TYPE.display },
      mono: { fontFamily: TYPE.mono },
      h1: { fontFamily: TYPE.display, fontWeight: 600 },
      h2: { fontFamily: TYPE.display, fontWeight: 600 },
      h3: { fontFamily: TYPE.display, fontWeight: 600 },
      h4: { fontFamily: TYPE.display, fontWeight: 600 },
      h5: { fontFamily: TYPE.display, fontWeight: 600 },
      h6: { fontFamily: TYPE.display, fontWeight: 600, letterSpacing: '0.01em' },
      subtitle1: { fontFamily: TYPE.display, fontWeight: 500 },
      subtitle2: { fontFamily: TYPE.display, fontWeight: 500 },
      body1: { fontFamily: TYPE.body },
      body2: { fontFamily: TYPE.body },
      overline: {
        fontFamily: TYPE.mono,
        fontSize: '0.72rem',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        fontWeight: 500,
      },
      caption: { fontFamily: TYPE.mono, color: p.text.secondary },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            // Faint engineering grid — a switchboard panel, not a blank page.
            backgroundImage: isDark
              ? 'radial-gradient(circle at 1px 1px, rgba(216, 161, 62, 0.05) 1px, transparent 0)'
              : 'radial-gradient(circle at 1px 1px, rgba(35, 38, 31, 0.045) 1px, transparent 0)',
            backgroundSize: '22px 22px',
          },
          '& ::selection': {
            backgroundColor: isDark ? 'rgba(216, 161, 62, 0.35)' : 'rgba(46, 122, 99, 0.22)',
          },
          '& :focus-visible': {
            outline: `2px solid ${p.secondary.main}`,
            outlineOffset: 2,
          },
          '*::-webkit-scrollbar': { width: 10, height: 10 },
          '*::-webkit-scrollbar-thumb': {
            backgroundColor: p.divider,
            borderRadius: 5,
            border: `3px solid ${p.background.default}`,
          },
          '*::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: p.background.paper,
            color: p.text.primary,
            borderBottom: `1px solid ${p.divider}`,
            boxShadow: 'none',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 500,
            letterSpacing: '0.01em',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontFamily: TYPE.mono,
            fontSize: '0.75rem',
            height: 24,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          outlined: { borderColor: p.divider },
        },
      },
      MuiTable: {
        styleOverrides: {
          root: { borderCollapse: 'collapse' },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: p.divider },
          head: {
            fontFamily: TYPE.mono,
            fontSize: '0.7rem',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: p.text.secondary,
            fontWeight: 500,
            borderBottom: `2px solid ${p.divider}`,
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            '&:hover': { backgroundColor: p.action.hover },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            fontFamily: TYPE.mono,
            fontSize: '0.72rem',
            backgroundColor: isDark ? '#232B28' : '#2A2E27',
          },
        },
      },
      MuiSnackbarContent: {
        styleOverrides: { root: { fontFamily: TYPE.mono } },
      },
    },
  }
}

// --- Custom Typography variants: `mono` (machine data) and `display` (Fraunces) ---

declare module '@mui/material/styles' {
  interface TypographyVariants {
    mono: CSSProperties
    display: CSSProperties
  }
  interface TypographyVariantsOptions {
    mono?: CSSProperties
    display?: CSSProperties
  }
}
declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    mono: true
    display: true
  }
}

export const lightTheme = createTheme(base('light'))
export const darkTheme = createTheme(base('dark'))
