const STORAGE_KEY = 'mailer-api-key'

// Plain localStorage helpers — the fetch wrapper reads the key synchronously,
// so these deliberately avoid React state.
export function getApiKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setApiKey(key: string) {
  try {
    localStorage.setItem(STORAGE_KEY, key)
  } catch {
    /* ignore */
  }
}

export function clearApiKey() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
