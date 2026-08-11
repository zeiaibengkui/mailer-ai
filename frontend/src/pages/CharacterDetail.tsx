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
  useTasks,
  type SenderSummary,
  type ScheduledTask,
} from '../api/hooks.ts'
import { ConfirmDialog } from '../components/ConfirmDialog.tsx'
import { EmptyState } from '../components/EmptyState.tsx'
import { ErrorBanner } from '../components/ErrorBanner.tsx'
import { formatDateTime } from '../utils.ts'

type Notice = { severity: 'success' | 'error'; message: string } | null

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
      <DialogTitle>History — {sender}</DialogTitle>
      <DialogContent dividers>
        {history.isPending && <CircularProgress />}
        {history.isError && <ErrorBanner error={history.error} />}
        {history.isSuccess &&
          (history.data.history.length === 0 ? (
            <EmptyState text="No conversation yet." />
          ) : (
            <Stack spacing={1}>
              {history.data.history.map((m, i) => (
                <Box
                  key={i}
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Chip
                    label={m.role}
                    size="small"
                    color={m.role === 'assistant' ? 'primary' : m.role === 'user' ? 'secondary' : 'default'}
                    sx={{ mb: 1 }}
                  />
                  <Typography
                    variant="body2"
                    sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                  >
                    {m.content}
                  </Typography>
                </Box>
              ))}
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
          onResult({ severity: 'error', message: e.message })
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

  const [addOpen, setAddOpen] = useState(false)
  const [historySender, setHistorySender] = useState<SenderSummary | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<
    { kind: 'sender' | 'task'; id: string; label: string } | null
  >(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

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
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}
      >
        <Box>
          <Typography variant="h5">{detail.name}</Typography>
          <Typography variant="body2" color="text.secondary">
            {detail.email}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
            <Chip label={detail.bot.model} size="small" />
            <Chip label={`IMAP ${detail.imap.host}:${detail.imap.port}`} size="small" variant="outlined" />
          </Stack>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
            Add sender
          </Button>
          <Button variant="contained" startIcon={<SendIcon />} onClick={() => setComposeOpen(true)}>
            Send email
          </Button>
        </Stack>
      </Stack>

      <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
        Senders ({senders.data?.length ?? 0})
      </Typography>
      {senders.isPending && <CircularProgress />}
      {senders.isError && <ErrorBanner error={senders.error} />}
      {senders.isSuccess && senders.data.length === 0 && <EmptyState text="No senders yet." />}
      {senders.isSuccess && senders.data.length > 0 && (
        <TableContainer component={Paper} variant="outlined">
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
                <TableRow key={s.id}>
                  <TableCell>{s.sender}</TableCell>
                  <TableCell align="right">{s.exchanges}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="View history">
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
        Scheduled tasks ({tasks.data?.length ?? 0})
      </Typography>
      {tasks.isPending && <CircularProgress />}
      {tasks.isError && <ErrorBanner error={tasks.error} />}
      {tasks.isSuccess && tasks.data.length === 0 && <EmptyState text="No scheduled tasks." />}
      {tasks.isSuccess && tasks.data.length > 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Sender</TableCell>
                <TableCell>Scheduled at</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tasks.data.map((t: ScheduledTask) => (
                <TableRow key={t.id}>
                  <TableCell>{t.sender}</TableCell>
                  <TableCell>{formatDateTime(t.scheduledAt)}</TableCell>
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
