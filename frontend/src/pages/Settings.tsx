import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { getApiKey, setApiKey, clearApiKey } from '../hooks/useApiKey.ts'
import { apiFetch } from '../api/client.ts'

export default function Settings() {
  const [draft, setDraft] = useState(getApiKey())
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<null | { ok: boolean; message: string }>(null)

  const testConnection = async () => {
    setApiKey(draft.trim())
    setTesting(true)
    setResult(null)
    try {
      await apiFetch<{ ok: boolean }>('/health')
      setResult({ ok: true, message: 'Connected to the bot API.' })
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : String(e) })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Box sx={{ maxWidth: 560 }}>
      <Typography variant="h5" gutterBottom>
        Settings
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        The bot requires a bearer token for every API call. Set a stable <code>API_KEY</code> in the
        bot's <code>.env</code> (generate with <code>openssl rand -hex 24</code>) and enter the same
        value here. It is stored only in this browser&apos;s <code>localStorage</code>.
      </Alert>

      <Stack spacing={2}>
        <TextField
          label="API key"
          type="password"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          helperText="Stored locally; sent as `Authorization: Bearer <key>`."
        />
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            onClick={testConnection}
            disabled={testing || !draft.trim()}
            startIcon={testing ? <CircularProgress size={16} /> : undefined}
          >
            Test connection
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              clearApiKey()
              setDraft('')
              setResult(null)
            }}
          >
            Clear
          </Button>
        </Stack>
        {result && (
          <Alert severity={result.ok ? 'success' : 'error'}>{result.message}</Alert>
        )}
      </Stack>
    </Box>
  )
}
