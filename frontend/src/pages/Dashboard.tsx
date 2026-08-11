import { Link } from 'react-router-dom'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useStatus } from '../api/hooks.ts'
import { ErrorBanner } from '../components/ErrorBanner.tsx'
import { formatUptime } from '../utils.ts'

export default function Dashboard() {
  const status = useStatus()

  if (status.isPending) return <CircularProgress />
  if (status.isError) return <ErrorBanner error={status.error} />

  const { uptimeSeconds, characters } = status.data
  const totalSenders = characters.reduce((n, c) => n + c.senders, 0)
  const totalTasks = characters.reduce((n, c) => n + c.tasks, 0)

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Overview
      </Typography>

      <Stack direction="row" spacing={1} sx={{ mb: 3, flexWrap: 'wrap' }}>
        <Chip label={`Uptime ${formatUptime(uptimeSeconds)}`} color="primary" />
        <Chip label={`${characters.length} characters`} />
        <Chip label={`${totalSenders} senders`} />
        <Chip label={`${totalTasks} scheduled tasks`} />
      </Stack>

      <Grid container spacing={2}>
        {characters.map((c) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={c.name}>
            <Card variant="outlined">
              <CardActionArea component={Link} to={`/characters/${encodeURIComponent(c.name)}`}>
                <CardContent>
                  <Typography variant="h6">{c.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {c.email}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {c.model} · {c.proactiveModel}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {c.senders} senders · {c.tasks} tasks
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}
