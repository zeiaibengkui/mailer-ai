import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client.ts'

export const qk = {
  status: ['status'] as const,
  characters: ['characters'] as const,
  character: (name: string) => ['character', name] as const,
  senders: (name: string) => ['senders', name] as const,
  history: (name: string, senderId: string) => ['history', name, senderId] as const,
  tasks: (name: string) => ['tasks', name] as const,
}

export interface StatusChar {
  name: string
  email: string
  model: string
  proactiveModel: string
  senders: number
  tasks: number
}

export interface Status {
  uptimeSeconds: number
  characters: StatusChar[]
}

export interface SenderSummary {
  id: string
  sender: string
  exchanges: number
}

export interface CharacterInfo {
  name: string
  email: string
  imapHost: string
  imapPort: number
  model: string
  proactiveModel: string
  senders: SenderSummary[]
}

export interface EndpointConf {
  host: string
  port: number
  secure: boolean
  user: string
}

export interface ScheduledTask {
  id: string
  sender: string
  scheduledAt: string
}

export interface CharacterDetail {
  name: string
  email: string
  imap: EndpointConf
  smtp: EndpointConf
  bot: {
    fetch_interval_ms: number
    proactive_interval_ms: number
    proactive_min_gap_ms: number
    model: string
    proactive_model: string
  }
  senders: SenderSummary[]
  tasks: ScheduledTask[]
}

export interface HistoryMessage {
  role: string
  content: string
}

export interface SenderHistory {
  id: string
  sender: string
  history: HistoryMessage[]
}

const REFETCH_MS = 10000

export function useStatus() {
  return useQuery({
    queryKey: qk.status,
    queryFn: () => apiFetch<Status>('/status'),
    refetchInterval: REFETCH_MS,
  })
}

export function useCharacters() {
  return useQuery({
    queryKey: qk.characters,
    queryFn: () => apiFetch<CharacterInfo[]>('/characters'),
    refetchInterval: REFETCH_MS,
  })
}

export function useCharacter(name: string) {
  return useQuery({
    queryKey: qk.character(name),
    queryFn: () => apiFetch<CharacterDetail>(`/characters/${encodeURIComponent(name)}`),
    enabled: !!name,
  })
}

export function useSenders(name: string) {
  return useQuery({
    queryKey: qk.senders(name),
    queryFn: () => apiFetch<SenderSummary[]>(`/characters/${encodeURIComponent(name)}/senders`),
    enabled: !!name,
  })
}

export function useSenderHistory(name: string, senderId: string | null) {
  return useQuery({
    queryKey: qk.history(name, senderId ?? ''),
    queryFn: () =>
      apiFetch<SenderHistory>(
        `/characters/${encodeURIComponent(name)}/senders/${encodeURIComponent(senderId!)}`,
      ),
    enabled: !!name && !!senderId,
  })
}

export function useTasks(name: string) {
  return useQuery({
    queryKey: qk.tasks(name),
    queryFn: () => apiFetch<ScheduledTask[]>(`/characters/${encodeURIComponent(name)}/tasks`),
    enabled: !!name,
  })
}

export function useAddSender(name: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sender: string) =>
      apiFetch<{ id: string; sender: string; created: boolean }>(
        `/characters/${encodeURIComponent(name)}/senders`,
        { method: 'POST', body: JSON.stringify({ sender }) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.senders(name) })
      qc.invalidateQueries({ queryKey: qk.status })
    },
  })
}

export function useDeleteSender(name: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (senderId: string) =>
      apiFetch<{ ok: boolean }>(
        `/characters/${encodeURIComponent(name)}/senders/${encodeURIComponent(senderId)}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.senders(name) })
      qc.invalidateQueries({ queryKey: qk.status })
      qc.invalidateQueries({ queryKey: qk.characters })
    },
  })
}

export function useDeleteTask(name: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: boolean }>(`/characters/${encodeURIComponent(name)}/tasks/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.tasks(name) })
      qc.invalidateQueries({ queryKey: qk.status })
    },
  })
}

export function useSendMessage(name: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (msg: { to: string; subject: string; body: string }) =>
      apiFetch<{ ok: boolean; to: string; subject: string }>(
        `/characters/${encodeURIComponent(name)}/messages`,
        { method: 'POST', body: JSON.stringify(msg) },
      ),
    // Sending to a new address creates a sender, so refresh the sender list too.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.senders(name) })
      qc.invalidateQueries({ queryKey: qk.status })
    },
  })
}
