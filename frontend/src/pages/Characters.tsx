import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { useCharacters } from '../api/hooks.ts'
import { ErrorBanner } from '../components/ErrorBanner.tsx'
import { Monogram } from '../components/Monogram.tsx'
import { TYPE } from '../theme.ts'

export default function Characters() {
  const chars = useCharacters()
  const navigate = useNavigate()

  return (
    <Box>
      <Typography variant="overline" sx={{ color: 'secondary.main' }}>
        Roster
      </Typography>
      <Typography variant="h4" gutterBottom sx={{ mt: 0.5 }}>
        Characters
      </Typography>

      {chars.isPending && <CircularProgress />}
      {chars.isError && <ErrorBanner error={chars.error} />}

      {chars.isSuccess && (
        <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Character</TableCell>
                <TableCell>Mailbox</TableCell>
                <TableCell>IMAP line</TableCell>
                <TableCell>Model</TableCell>
                <TableCell align="right">Senders</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {chars.data.map((c) => (
                <TableRow
                  key={c.name}
                  hover
                  onClick={() => navigate(`/characters/${encodeURIComponent(c.name)}`)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>
                    <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}>
                      <Monogram name={c.name} size={30} />
                      <Typography sx={{ fontWeight: 500 }}>{c.name}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.74rem', fontFamily: TYPE.mono }}>
                    {c.email}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.74rem', color: 'text.secondary', fontFamily: TYPE.mono }}>
                    {c.imapHost}:{c.imapPort}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.72rem', fontFamily: TYPE.mono }}>
                    {c.model}
                  </TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.74rem', fontFamily: TYPE.mono }}>
                    {c.senders.length}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}
