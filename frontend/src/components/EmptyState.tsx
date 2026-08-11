import Alert from '@mui/material/Alert'

export function EmptyState({ text }: { text: string }) {
  return (
    <Alert severity="info" sx={{ my: 1 }}>
      {text}
    </Alert>
  )
}
