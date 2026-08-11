import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { useCharacters } from '../api/hooks.ts'
import { ErrorBanner } from '../components/ErrorBanner.tsx'

export default function Characters() {
  const chars = useCharacters()
  const navigate = useNavigate()

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Characters
      </Typography>

      {chars.isPending && <CircularProgress />}
      {chars.isError && <ErrorBanner error={chars.error} />}

      {chars.isSuccess && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>IMAP</TableCell>
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
                    <Typography sx={{ fontWeight: 600 }}>{c.name}</Typography>
                  </TableCell>
                  <TableCell>{c.email}</TableCell>
                  <TableCell>
                    {c.imapHost}:{c.imapPort}
                  </TableCell>
                  <TableCell>
                    <Chip label={c.model} size="small" />
                  </TableCell>
                  <TableCell align="right">{c.senders.length}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}
