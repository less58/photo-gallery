const KEY = 'selectit_clients'

export type ClientRecord = { email: string }

export function getClientHistory(): ClientRecord[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch { return [] }
}

export function saveClientToHistory(email: string) {
  if (typeof window === 'undefined') return
  const list = getClientHistory().filter(r => r.email !== email.toLowerCase())
  list.unshift({ email: email.toLowerCase() })
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50)))
}
