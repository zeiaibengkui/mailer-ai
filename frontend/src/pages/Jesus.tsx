import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { apiFetchSSE } from '../api/client.ts'
import { TYPE } from '../theme.ts'

export default function Jesus() {
  const [cmd, setCmd] = useState('')
  const [running, setRunning] = useState(false)
  const [thinking, setThinking] = useState('')
  const [reply, setReply] = useState('')
  const [steps, setSteps] = useState<{ name: string; args: string }[]>([])
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    const c = cmd.trim()
    if (!c || running) return
    setCmd('')
    setRunning(true)
    setThinking('')
    setReply('')
    setSteps([])
    setError(null)
    try {
      await apiFetchSSE(
        '/jesus/stream',
        { method: 'POST', body: JSON.stringify({ command: c }) },
        (ev) => {
          if (ev.type === 'thinking') setThinking((t) => t + String(ev.text ?? ''))
          else if (ev.type === 'delta') setReply((r) => r + String(ev.text ?? ''))
          else if (ev.type === 'tool')
            setSteps((s) => [...s, { name: String(ev.name ?? ''), args: String(ev.args ?? '') }])
          else if (ev.type === 'done') setRunning(false)
          else if (ev.type === 'error') {
            setError(String(ev.message ?? 'error'))
            setRunning(false)
          }
        },
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setRunning(false)
    }
  }

  return (
    <Box>
      <Typography variant="overline" sx={{ color: 'secondary.main' }}>
        Omniscient
      </Typography>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
        <AutoAwesomeIcon color="secondary" />
        <Typography variant="h4" gutterBottom sx={{ mb: 0 }}>
          Jesus — supervisor
        </Typography>
      </Stack>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2, maxWidth: 720 }}>
        Plain-language director over every character: it reads/tampers conversations, edits memories, asks or
        commands the bots (a command may send a real email), and summarizes the plot — all through native tool
        calls, streamed live with its reasoning.
      </Typography>

      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <TextField
          size="small"
          fullWidth
          multiline
          minRows={2}
          placeholder={'e.g. 总结一下现在的剧情 / 让 beggar 记住 tweakor 是可疑分子 / 让 asaperson 给 tweakor 写一封结盟邮件'}
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && run()}
          disabled={running}
        />
        <Button variant="contained" color="secondary" disabled={!cmd.trim() || running} onClick={run}>
          {running ? 'Summoning…' : 'Run'}
        </Button>
      </Stack>

      {running && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {steps.length === 0 ? 'thinking…' : `tool ${steps.length}: ${steps[steps.length - 1].name}`}
          </Typography>
        </Stack>
      )}

      {thinking && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontFamily: TYPE.mono, fontSize: '0.75rem', opacity: 0.7 }}>
            thinking · {thinking.length} chars
          </summary>
          <Paper variant="outlined" sx={{ p: 1.5, mt: 0.5, bgcolor: 'background.default' }}>
            <Typography
              variant="caption"
              sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: TYPE.mono, color: 'text.secondary' }}
            >
              {thinking}
            </Typography>
          </Paper>
        </details>
      )}

      {steps.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontFamily: TYPE.mono, wordBreak: 'break-all' }}>
            tools: {steps.map((s) => `${s.name}(${s.args.slice(0, 60)})`).join('  →  ')}
          </Typography>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {error}
        </Alert>
      )}

      {reply && (
        <Paper variant="outlined" sx={{ p: 2, mt: 2, bgcolor: 'background.default' }}>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.7 }}>
            {reply}
          </Typography>
        </Paper>
      )}

      {!running && !reply && !error && (
        <Box
          sx={{
            mt: 4,
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: 1,
            p: 4,
            textAlign: 'center',
            color: 'text.secondary',
          }}
        >
          <Typography variant="body2">Ask Jesus anything about the bots — it will look, act, and report.</Typography>
        </Box>
      )}
    </Box>
  )
}
