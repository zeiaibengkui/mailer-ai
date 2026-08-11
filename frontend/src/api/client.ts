import { getApiKey } from '../hooks/useApiKey.ts'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// The bot API now answers CORS itself, so the dashboard calls it directly.
// Override with VITE_API_BASE if the API moves (e.g. behind a same-origin
// reverse proxy in a future deployment).
const API_BASE: string = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://127.0.0.1:3000'

/** Fetch a bot-API endpoint (cross-origin via CORS) with the stored bearer key. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
      ...(init?.headers ?? {}),
    },
  })

  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body && typeof body.error === 'string') message = body.error
    } catch {
      /* response was not JSON */
    }
    throw new ApiError(res.status, message)
  }

  return res.json() as Promise<T>
}

/**
 * Fetch a bot-API endpoint that streams Server-Sent Events and invoke a callback for each
 * event (parsed from `event:` + `data:` lines). Used by the Jesus supervisor console.
 */
export async function apiFetchSSE(
  path: string,
  init: RequestInit,
  onEvent: (ev: { type: string; [k: string]: unknown }) => void,
): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
      ...(init?.headers ?? {}),
    },
  })

  if (!res.ok || !res.body) {
    let message = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body && typeof body.error === 'string') message = body.error
    } catch {
      /* response was not JSON */
    }
    throw new ApiError(res.status, message)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const blocks = buffer.split('\n\n')
    buffer = blocks.pop() ?? ''
    for (const block of blocks) {
      let eventName = 'message'
      let data = ''
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) eventName = line.slice(6).trim()
        else if (line.startsWith('data:')) data += line.slice(5).trim()
      }
      if (!data) continue
      try {
        onEvent({ type: eventName, ...JSON.parse(data) })
      } catch {
        /* malformed event — skip */
      }
    }
  }
}
