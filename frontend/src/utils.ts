/** URL-safe base64 of a sender email — matches the backend's encodeSenderId (no padding). */
export function encodeSenderId(sender: string): string {
  return btoa(sender).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

/** "in 2h 14m" / "overdue" — how long until a scheduled reply fires. */
export function timeUntil(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const diffMs = date.getTime() - Date.now()
  const sign = diffMs < 0 ? '-' : ''
  const totalMin = Math.round(Math.abs(diffMs) / 60000)
  const d = Math.floor(totalMin / 1440)
  const h = Math.floor((totalMin % 1440) / 60)
  const m = totalMin % 60
  const parts: string[] = []
  if (d > 0) parts.push(`${d}d`)
  if (h > 0) parts.push(`${h}h`)
  if (parts.length < 2 && m > 0) parts.push(`${m}m`)
  const body = parts.length > 0 ? parts.join(' ') : 'now'
  return sign === '-' ? `${body} overdue` : `in ${body}`
}
