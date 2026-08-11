import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import DeleteIcon from '@mui/icons-material/Delete'
import { getApiKey, setApiKey, clearApiKey } from '../hooks/useApiKey.ts'
import { apiFetch } from '../api/client.ts'
import { ApiError } from '../api/client.ts'
import {
  useAddBannedPattern,
  useBannedPatterns,
  useRemoveBannedPattern,
} from '../api/hooks.ts'
import { TYPE } from '../theme.ts'

export default function Settings() {
  const [draft, setDraft] = useState(getApiKey())
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<null | { ok: boolean; message: string }>(null)

  const patterns = useBannedPatterns()
  const addPattern = useAddBannedPattern()
  const removePattern = useRemoveBannedPattern()
  const [patternDraft, setPatternDraft] = useState('')
  const [patternError, setPatternError] = useState<string | null>(null)

  const submitPattern = () => {
    setPatternError(null)
    addPattern.mutate(patternDraft.trim(), {
      onSuccess: () => setPatternDraft(''),
      onError: (e) => setPatternError(e instanceof ApiError ? e.message : String(e)),
    })
  }

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
      <Typography variant="overline" sx={{ color: 'secondary.main' }}>
        Keyring
      </Typography>
      <Typography variant="h4" gutterBottom sx={{ mt: 0.5 }}>
        Settings
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        The bot signs every request with a bearer token. Set a stable <code>API_KEY</code> in the
        bot&apos;s <code>.env</code> (generate with <code>openssl rand -hex 24</code>) and enter the
        same value here. It is stored only in this browser&apos;s <code>localStorage</code>.
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

      <Typography variant="h6" gutterBottom sx={{ mt: 5 }}>
        Global ban patterns ({patterns.data?.patterns.length ?? 0})
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        Regexps applied to <em>every</em> character's senders — any matching address is never
        replied to and never proactively messaged. Example:{' '}
        <code>@service\.netease\.com</code>.
      </Alert>
      <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
        <TextField
          size="small"
          label="Regex pattern"
          placeholder="@service\.netease\.com"
          value={patternDraft}
          onChange={(e) => setPatternDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitPattern()}
          sx={{ flexGrow: 1 }}
        />
        <Button
          variant="outlined"
          disabled={!patternDraft.trim() || addPattern.isPending}
          onClick={submitPattern}
        >
          {addPattern.isPending ? 'Adding…' : 'Add'}
        </Button>
      </Stack>
      {patternError && (
        <Alert severity="error" sx={{ mb: 1.5 }}>
          {patternError}
        </Alert>
      )}
      {patterns.isPending && <CircularProgress />}
      {patterns.isError && <Alert severity="error">{patterns.error.message}</Alert>}
      {patterns.isSuccess && patterns.data.patterns.length === 0 && (
        <Alert severity="info" sx={{ my: 1 }}>
          No global ban patterns — every sender is allowed by default.
        </Alert>
      )}
      {patterns.isSuccess && patterns.data.patterns.length > 0 && (
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Stack spacing={1}>
            {patterns.data.patterns.map((p) => (
              <Stack
                key={p}
                direction="row"
                sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}
              >
                <Typography variant="mono" sx={{ fontSize: '0.78rem', wordBreak: 'break-all', fontFamily: TYPE.mono }}>
                  {p}
                </Typography>
                <IconButton
                  size="small"
                  color="error"
                  disabled={removePattern.isPending}
                  onClick={() => removePattern.mutate(p)}
                  aria-label={`remove pattern ${p}`}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
            ))}
          </Stack>
        </Paper>
      )}
    </Box>
  )
}
