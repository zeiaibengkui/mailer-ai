import type { ReactNode } from 'react'
import Alert from '@mui/material/Alert'

export function EmptyState({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <Alert severity="info" sx={{ my: 1.5, borderRadius: 1 }} action={action}>
      {text}
    </Alert>
  )
}
