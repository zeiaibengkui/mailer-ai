import Alert from '@mui/material/Alert'
import { Link } from 'react-router-dom'
import { ApiError } from '../api/client.ts'

export function ErrorBanner({ error }: { error: unknown }) {
  if (!error) return null
  const is401 = error instanceof ApiError && error.status === 401
  const message = error instanceof Error ? error.message : String(error)
  return (
    <Alert severity={is401 ? 'warning' : 'error'} sx={{ my: 1 }}>
      {is401 ? (
        <>
          The API rejected this key. Paste the <code>API_KEY</code> from the bot&apos;s{' '}
          <code>.env</code> in <Link to="/settings">Settings</Link> and try again.
        </>
      ) : (
        message
      )}
    </Alert>
  )
}
