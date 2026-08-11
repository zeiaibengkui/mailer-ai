import Box from '@mui/material/Box'
import { useTheme } from '@mui/material/styles'
import { TYPE } from '../theme.ts'

/**
 * A character's signature stamp: a double-ring seal carrying its initials.
 * Every outbound mail is signed by its character's hand, so the mark that
 * stands for a persona is a monogram, not an avatar photo.
 */

function initialsOf(name: string): string {
  const words = name.trim().split(/[\s._-]+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

export function Monogram({
  name,
  size = 44,
}: {
  name: string
  size?: number
}) {
  const theme = useTheme()
  const ring = theme.palette.divider
  const brass = theme.palette.secondary.main

  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
        fontFamily: TYPE.display,
        fontWeight: 600,
        fontSize: size * 0.4,
        color: 'text.primary',
        border: `1px solid ${ring}`,
        boxShadow: `inset 0 0 0 ${Math.max(2, size * 0.045)}px ${theme.palette.background.paper}, inset 0 0 0 ${Math.max(3, size * 0.06)}px ${ring}`,
        backgroundColor: theme.palette.background.default,
        position: 'relative',
        '&::after': {
          content: '""',
          position: 'absolute',
          inset: -size * 0.08,
          borderRadius: '50%',
          border: `1px solid ${brass}`,
          opacity: 0.45,
        },
      }}
    >
      {initialsOf(name)}
    </Box>
  )
}
