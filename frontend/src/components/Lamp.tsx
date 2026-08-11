import Box from '@mui/material/Box'
import { useTheme } from '@mui/material/styles'

/**
 * A switchboard lamp. Lit (brass glow) when a character's line is active —
 * queued work pending — and dark when idle. The pulse is turned off for
 * users who prefer reduced motion.
 */

export function Lamp({ lit, size = 12 }: { lit: boolean; size?: number }) {
  const theme = useTheme()
  const color = lit ? theme.palette.secondary.main : theme.palette.divider
  const glow = theme.palette.secondary.main

  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        backgroundColor: color,
        boxShadow: lit
          ? `0 0 ${size * 1.4}px ${size * 0.4}px ${glow}55, inset 0 0 2px ${theme.palette.background.paper}`
          : `inset 0 0 2px ${theme.palette.background.paper}`,
        animation: lit ? 'lamp-pulse 3.2s ease-in-out infinite' : undefined,
        '@keyframes lamp-pulse': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.55 },
        },
        '@media (prefers-reduced-motion: reduce)': {
          animation: 'none',
        },
      }}
    />
  )
}
