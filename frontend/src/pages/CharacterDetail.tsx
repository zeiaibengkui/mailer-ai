import { useState } from 'react'
import { useParams } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Snackbar from '@mui/material/Snackbar'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import FlashOnIcon from '@mui/icons-material/FlashOn'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff'
import SendIcon from '@mui/icons-material/Send'
import VisibilityIcon from '@mui/icons-material/Visibility'
import {
  useAddSender,
  useCharacter,
  useDeleteSender,
  useDeleteTask,
  useSenderHistory,
  useSenders,
  useSendMessage,
  useSetProactiveMuted,
  useTasks,
  useTriggerProactive,
  type SenderSummary,
  type ScheduledTask,
} from '../api/hooks.ts'
import { ApiError } from '../api/client.ts'
import { ConfirmDialog } from '../components/ConfirmDialog.tsx'
import { EmptyState } from '../components/EmptyState.tsx'
import { ErrorBanner } from '../components/ErrorBanner.tsx'
import { Monogram } from '../components/Monogram.tsx'
import { TYPE } from '../theme.ts'
import { formatDateTime, timeUntil } from '../utils.ts'

type Notice = { severity: 'success' | 'info' | 'error'; message: string } | null

function AddSenderDialog({
  open,
  onClose,
  onAdd,
  pending,
}: {
  open: boolean
  onClose: () => void
  onAdd: (email: string) => void
  pending: boolean
}) {
  const [email, setEmail] = useState('')
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Add sender</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="Email address"
          placeholder="friend@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          margin="dense"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!email.trim() || pending}
          onClick={() => onAdd(email.trim())}
        >
          {pending ? 'Adding…' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

const ROLE_LABEL: Record<string, { label: string; color: 'primary' | 'secondary' | 'default' }> = {
  assistant: { label: 'sent', color: 'primary' },
  user: { label: 'received', color: 'secondary' },
  system: { label: 'note', color: 'default' },
}

function HistoryDialog({
  charName,
  sender,
  senderId,
  onClose,
}: {
  charName: string
  sender: string
  senderId: string | null
  onClose: () => void
}) {
  const history = useSenderHistory(charName, senderId)
  return (
    <Dialog open={!!senderId} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Correspondence — {sender}</DialogTitle>
      <DialogContent dividers>
        {history.isPending && <CircularProgress />}
        {history.isError && <ErrorBanner error={history.error} />}
        {history.isSuccess &&
          (history.data.history.length === 0 ? (
            <EmptyState text="Nothing on this line yet. The first exchange will show up here." />
          ) : (
            <Stack spacing={1.5}>
              {history.data.history.map((m, i) => {
                const meta = ROLE_LABEL[m.role] ?? ROLE_LABEL.system
                return (
                  <Paper
                    key={i}
                    variant="outlined"
                    sx={{ p: 2, bgcolor: 'background.default' }}
                  >
                    <Stack
                      direction="row"
                      sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}
                    >
                      <Chip
                        label={meta.label}
                        size="small"
                        color={meta.color}
                        variant="outlined"
                        sx={{ fontFamily: 'inherit' }}
                      />
                      <Typography variant="caption" sx={{ fontSize: '0.68rem' }}>
                        {String(i + 1).padStart(2, '0')}
                      </Typography>
                    </Stack>
                    <Typography
                      variant="body2"
                      sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.65 }}
                    >
                      {m.content}
                    </Typography>
                  </Paper>
                )
              })}
            </Stack>
          ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}

function ComposeDialog({
  charName,
  open,
  onClose,
  onResult,
}: {
  charName: string
  open: boolean
  onClose: () => void
  onResult: (notice: Notice) => void
}) {
  const send = useSendMessage(charName)
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const canSend = !!to.trim() && !!subject.trim() && !!body.trim()

  const submit = () => {
    send.mutate(
      { to: to.trim(), subject: subject.trim(), body },
      {
        onSuccess: () => {
          onClose()
          setTo('')
          setSubject('')
          setBody('')
          onResult({ severity: 'success', message: `Sent to ${to.trim()}` })
        },
        onError: (e) => {
          onResult({
            severity: 'error',
            message:
              e instanceof ApiError && e.status === 401
                ? e.message
                : "Couldn't send — the SMTP line is down. Check the character's conf.toml and the bot log.",
          })
        },
      },
    )
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Send email as {charName}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="To" value={to} onChange={(e) => setTo(e.target.value)} />
          <TextField label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <TextField
            label="Body"
            multiline
            minRows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={send.isPending}>
          Cancel
        </Button>
        <Button variant="contained" startIcon={<SendIcon />} disabled={!canSend || send.isPending} onClick={submit}>
          {send.isPending ? 'Sending…' : 'Send'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default function CharacterDetail() {
  const { name = '' } = useParams()
  const char = useCharacter(name)
  const senders = useSenders(name)
  const tasks = useTasks(name)

  const addSender = useAddSender(name)
  const deleteSender = useDeleteSender(name)
  const deleteTask = useDeleteTask(name)
  const setProactiveMuted = useSetProactiveMuted(name)
  const triggerProactive = useTriggerProactive(name)

  const [addOpen, setAddOpen] = useState(false)
  const [historySender, setHistorySender] = useState<SenderSummary | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<
    { kind: 'sender' | 'task'; id: string; label: string } | null
  >(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [busySender, setBusySender] = useState<string | null>(null)

  const toggleMute = (s: SenderSummary) => {
    setProactiveMuted.mutate(
      { senderId: s.id, muted: !s.muted },
      {
        onSuccess: () =>
          setNotice({
            severity: 'success',
            message: s.muted ? `Proactive unmuted for ${s.sender}` : `Proactive muted for ${s.sender}`,
          }),
        onError: (e) => setNotice({ severity: 'error', message: e.message }),
      },
    )
  }

  const trigger = (s: SenderSummary) => {
    setBusySender(s.id)
    triggerProactive.mutate(s.id, {
      onSuccess: (res) => {
        setBusySender(null)
        const byStatus: Record<string, string> = {
          sent: `Proactive message sent to ${s.sender}`,
          later: `Proactive reply scheduled for ${s.sender}`,
          skip: `The agent decided not to message ${s.sender} right now`,
          no_reply: `No reply generated for ${s.sender}`,
        }
        setNotice({ severity: res.status === 'sent' ? 'success' : 'info', message: byStatus[res.status] })
      },
      onError: (e) => {
        setBusySender(null)
        setNotice({ severity: 'error', message: e.message })
      },
    })
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    if (deleteTarget.kind === 'sender') {
      deleteSender.mutate(deleteTarget.id, {
        onSuccess: () => {
          setDeleteTarget(null)
          setNotice({ severity: 'success', message: `Deleted sender ${deleteTarget.label}` })
        },
        onError: (e) => setNotice({ severity: 'error', message: e.message }),
      })
    } else {
      deleteTask.mutate(deleteTarget.id, {
        onSuccess: () => {
          setDeleteTarget(null)
          setNotice({ severity: 'success', message: 'Deleted task' })
        },
        onError: (e) => setNotice({ severity: 'error', message: e.message }),
      })
    }
  }

  if (char.isPending) return <CircularProgress />
  if (char.isError) return <ErrorBanner error={char.error} />
  const detail = char.data

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        sx={{ alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between', mb: 3, gap: 2 }}
      >
        <Stack direction="row" sx={{ alignItems: 'center', gap: 2.5 }}>
          <Monogram name={detail.name} size={64} />
          <Box>
            <Typography variant="overline" sx={{ color: 'secondary.main' }}>
              Agent file
            </Typography>
            <Typography variant="h4" sx={{ lineHeight: 1.1 }}>
              {detail.name}
            </Typography>
            <Typography variant="mono" sx={{ color: 'text.secondary', fontSize: '0.78rem', mt: 0.5, display: 'block' }}>
              {detail.email}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
              <Chip label={detail.bot.model} size="small" />
              <Chip label={`IMAP ${detail.imap.host}:${detail.imap.port}`} size="small" variant="outlined" />
            </Stack>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
            Add sender
          </Button>
          <Button variant="contained" startIcon={<SendIcon />} onClick={() => setComposeOpen(true)}>
            Send email
          </Button>
        </Stack>
      </Stack>

      <Typography variant="h6" gutterBottom sx={{ mt: 1 }}>
        Lines ({senders.data?.length ?? 0})
      </Typography>
      {senders.isPending && <CircularProgress />}
      {senders.isError && <ErrorBanner error={senders.error} />}
      {senders.isSuccess && senders.data.length === 0 && (
        <EmptyState
          text="No conversations on this line yet."
          action={<Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>Add sender</Button>}
        />
      )}
      {senders.isSuccess && senders.data.length > 0 && (
        <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Sender</TableCell>
                <TableCell align="right">Exchanges</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {senders.data.map((s) => (
                <TableRow key={s.id} sx={s.muted ? { opacity: 0.55 } : undefined}>
                  <TableCell sx={{ fontSize: '0.74rem', wordBreak: 'break-all', fontFamily: TYPE.mono }}>
                    {s.sender}
                    {s.muted && (
                      <Chip
                        label="muted"
                        size="small"
                        color="warning"
                        variant="outlined"
                        sx={{ ml: 1, fontSize: '0.6rem', height: 18 }}
                      />
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.74rem', fontFamily: TYPE.mono }}>
                    {s.exchanges}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={s.muted ? 'Unmute proactive' : 'Mute proactive'}>
                      <IconButton
                        size="small"
                        color={s.muted ? 'warning' : 'default'}
                        disabled={setProactiveMuted.isPending}
                        onClick={() => toggleMute(s)}
                      >
                        {s.muted ? (
                          <NotificationsOffIcon fontSize="small" />
                        ) : (
                          <NotificationsActiveIcon fontSize="small" />
                        )}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Send a proactive message now">
                      <IconButton
                        size="small"
                        color="secondary"
                        disabled={busySender === s.id}
                        onClick={() => trigger(s)}
                      >
                        {busySender === s.id ? (
                          <CircularProgress size={16} />
                        ) : (
                          <FlashOnIcon fontSize="small" />
                        )}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="View correspondence">
                      <IconButton size="small" onClick={() => setHistorySender(s)}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete sender">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() =>
                          setDeleteTarget({ kind: 'sender', id: s.id, label: s.sender })
                        }
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
        Queued replies ({tasks.data?.length ?? 0})
      </Typography>
      {tasks.isPending && <CircularProgress />}
      {tasks.isError && <ErrorBanner error={tasks.error} />}
      {tasks.isSuccess && tasks.data.length === 0 && (
        <EmptyState text="Nothing is queued — this agent is caught up on its mail." />
      )}
      {tasks.isSuccess && tasks.data.length > 0 && (
        <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Sender</TableCell>
                <TableCell>Fires</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tasks.data.map((t: ScheduledTask) => (
                <TableRow key={t.id}>
                  <TableCell sx={{ fontSize: '0.74rem', wordBreak: 'break-all', fontFamily: TYPE.mono }}>
                    {t.sender}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.74rem', fontFamily: TYPE.mono }}>
                    <Box component="span" sx={{ color: 'secondary.main' }}>
                      {timeUntil(t.scheduledAt)}
                    </Box>{' '}
                    · {formatDateTime(t.scheduledAt)}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Cancel task">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() =>
                          setDeleteTarget({ kind: 'task', id: t.id, label: `${t.sender} · ${formatDateTime(t.scheduledAt)}` })
                        }
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <AddSenderDialog
        open={addOpen}
        pending={addSender.isPending}
        onClose={() => setAddOpen(false)}
        onAdd={(email) =>
          addSender.mutate(email, {
            onSuccess: (res) => {
              setAddOpen(false)
              setNotice({
                severity: 'success',
                message: res.created ? `Added ${email}` : `${email} already registered`,
              })
            },
            onError: (e) => setNotice({ severity: 'error', message: e.message }),
          })
        }
      />

      <HistoryDialog
        charName={name}
        sender={historySender?.sender ?? ''}
        senderId={historySender?.id ?? null}
        onClose={() => setHistorySender(null)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget?.kind === 'sender' ? 'Delete sender' : 'Cancel task'}
        text={
          deleteTarget?.kind === 'sender'
            ? `Delete the conversation with "${deleteTarget.label}"? This cannot be undone.`
            : `Cancel the scheduled reply to "${deleteTarget?.label}"?`
        }
        confirmLabel={deleteTarget?.kind === 'sender' ? 'Delete' : 'Cancel task'}
        loading={deleteTarget?.kind === 'sender' ? deleteSender.isPending : deleteTask.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />

      <ComposeDialog charName={name} open={composeOpen} onClose={() => setComposeOpen(false)} onResult={setNotice} />

      <Snackbar
        open={!!notice}
        autoHideDuration={5000}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={notice?.severity ?? 'success'} onClose={() => setNotice(null)}>
          {notice?.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
