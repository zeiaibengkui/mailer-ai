import { Link, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import CircularProgress from '@mui/material/CircularProgress'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { useCharacters, useStatus, type SenderSummary } from '../api/hooks.ts'
import { ErrorBanner } from '../components/ErrorBanner.tsx'
import { Lamp } from '../components/Lamp.tsx'
import { Monogram } from '../components/Monogram.tsx'
import { TYPE } from '../theme.ts'
import { formatUptime } from '../utils.ts'

export default function Dashboard() {
  const status = useStatus()
  const chars = useCharacters()
  const navigate = useNavigate()

  if (status.isPending || chars.isPending) return <CircularProgress />
  if (status.isError) return <ErrorBanner error={status.error} />
  if (chars.isError) return <ErrorBanner error={chars.error} />

  const { uptimeSeconds, characters: statusChars } = status.data
  const totalSenders = statusChars.reduce((n, c) => n + c.senders, 0)
  const totalTasks = statusChars.reduce((n, c) => n + c.tasks, 0)
  const totalExchanges = chars.data.reduce(
    (n, c) => n + c.senders.reduce((m, s) => m + s.exchanges, 0),
    0,
  )

  // The active lines ledger: every conversation across characters, ranked by heat.
  const lines: { char: string; sender: string; exchanges: number }[] = chars.data.flatMap((c) =>
    c.senders.map((s: SenderSummary) => ({
      char: c.name,
      sender: s.sender,
      exchanges: s.exchanges,
    })),
  )
  const activeLines = lines.sort((a, b) => b.exchanges - a.exchanges).slice(0, 6)

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="overline" sx={{ color: 'secondary.main' }}>
          The Exchange
        </Typography>
        <Typography variant="h4" gutterBottom sx={{ mt: 0.5 }}>
          Board
        </Typography>
        <Typography variant="mono" sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>
          exchange open · {formatUptime(uptimeSeconds)} up · {chars.data.length} characters ·{' '}
          {totalSenders} lines · {totalExchanges} exchanges · {totalTasks} queued
        </Typography>
      </Box>

      <Grid container spacing={2.5}>
        {chars.data.map((c, i) => {
          const senders = c.senders.length
          const queued = statusChars.find((sc) => sc.name === c.name)?.tasks ?? 0
          const lit = senders > 0 || queued > 0
          return (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={c.name}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%',
                  transition: 'transform .18s ease, border-color .18s ease',
                  animation: 'board-in .4s ease both',
                  animationDelay: `${i * 70}ms`,
                  '@keyframes board-in': {
                    from: { opacity: 0, transform: 'translateY(8px)' },
                    to: { opacity: 1, transform: 'translateY(0)' },
                  },
                  '@media (prefers-reduced-motion: reduce)': {
                    animation: 'none',
                    transition: 'none',
                  },
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    borderColor: 'secondary.main',
                  },
                }}
              >
                <CardActionArea component={Link} to={`/characters/${encodeURIComponent(c.name)}`}>
                  <CardContent sx={{ p: 2.5 }}>
                    <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <Monogram name={c.name} />
                      <Lamp lit={lit} />
                    </Stack>

                    <Typography variant="h6" sx={{ mt: 2, mb: 0.25 }}>
                      {c.name}
                    </Typography>
                    <Typography
                      variant="mono"
                      sx={{ color: 'text.secondary', fontSize: '0.74rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
                    >
                      {c.email}
                    </Typography>

                    <Box
                      sx={{
                        mt: 2,
                        pt: 1.5,
                        borderTop: '1px solid',
                        borderColor: 'divider',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1,
                      }}
                    >
                      <Typography variant="mono" sx={{ color: 'text.secondary', fontSize: '0.74rem' }}>
                        {senders} lines · {queued} queued
                      </Typography>
                      <Typography variant="mono" sx={{ fontSize: '0.7rem', color: 'secondary.main' }}>
                        {c.model}
                      </Typography>
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          )
        })}
      </Grid>

      <Box sx={{ mt: 5 }}>
        <Typography variant="overline" sx={{ color: 'text.secondary' }}>
          Active lines
        </Typography>
        <Typography variant="h5" gutterBottom sx={{ mt: 0.25 }}>
          Loudest conversations
        </Typography>

        {activeLines.length === 0 ? (
          <Box
            sx={{
              border: '1px dashed',
              borderColor: 'divider',
              borderRadius: 1,
              p: 4,
              textAlign: 'center',
              color: 'text.secondary',
            }}
          >
            <Typography variant="body1">No conversations on any line yet.</Typography>
            <Typography variant="body2">
              Open a character and add a sender to start one.
            </Typography>
          </Box>
        ) : (
          <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 56 }}>Rank</TableCell>
                  <TableCell>Character</TableCell>
                  <TableCell>Sender</TableCell>
                  <TableCell align="right">Exchanges</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {activeLines.map((l, i) => (
                  <TableRow
                    key={`${l.char}:${l.sender}`}
                    hover
                    onClick={() => navigate(`/characters/${encodeURIComponent(l.char)}`)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell sx={{ color: 'text.secondary', fontFamily: TYPE.mono }}>
                      {String(i + 1).padStart(2, '0')}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                        <Monogram name={l.char} size={22} />
                        <Typography variant="body2">{l.char}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell
                      sx={{ fontSize: '0.74rem', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: TYPE.mono }}
                    >
                      {l.sender}
                    </TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.74rem', fontFamily: TYPE.mono }}>
                      {l.exchanges}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Box>
  )
}
