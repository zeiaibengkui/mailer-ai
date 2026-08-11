import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client.ts'
import { encodeSenderId } from '../utils.ts'

export const qk = {
  status: ['status'] as const,
  characters: ['characters'] as const,
  character: (name: string) => ['character', name] as const,
  senders: (name: string) => ['senders', name] as const,
  history: (name: string, senderId: string) => ['history', name, senderId] as const,
  tasks: (name: string) => ['tasks', name] as const,
  memory: (name: string) => ['memory', name] as const,
  banned: (name: string) => ['banned', name] as const,
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
  /** Proactive messages to this sender are muted (never sent proactively). */
  muted: boolean
  /** ISO time of the last proactive message actually sent, or null. */
  lastProactive: string | null
  /** This sender is permanently banned — the character never replies to them. */
  banned: boolean
}

export interface ProactiveTriggerResult {
  ok: boolean
  sender: string
  status: 'skip' | 'later' | 'sent' | 'no_reply' | 'ban'
}

/** One line of a character's long-term memory (memory.md). */
export interface MemoryEntry {
  at: string
  sender: string
  text: string
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

/** Mute (block) or unmute proactive messages for a sender. */
export function useSetProactiveMuted(name: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { senderId: string; muted: boolean }) =>
      apiFetch<{ ok: boolean; sender: string; muted: boolean }>(
        `/characters/${encodeURIComponent(name)}/senders/${encodeURIComponent(args.senderId)}/proactive`,
        { method: 'PATCH', body: JSON.stringify({ muted: args.muted }) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.senders(name) })
      qc.invalidateQueries({ queryKey: qk.status })
    },
  })
}

/** Manually trigger one proactive message to a sender now. */
export function useTriggerProactive(name: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (senderId: string) =>
      apiFetch<ProactiveTriggerResult>(
        `/characters/${encodeURIComponent(name)}/senders/${encodeURIComponent(senderId)}/proactive`,
        { method: 'POST' },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.senders(name) })
      qc.invalidateQueries({ queryKey: qk.status })
    },
  })
}

export function useMemory(name: string) {
  return useQuery({
    queryKey: qk.memory(name),
    queryFn: () =>
      apiFetch<{ memory: MemoryEntry[] }>(`/characters/${encodeURIComponent(name)}/memory`),
    enabled: !!name,
  })
}

/** Manually add a long-term memory entry, tagged with which person it's about. */
export function useAddMemory(name: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { sender: string; content: string }) =>
      apiFetch<{ ok: boolean; at: string; sender: string }>(
        `/characters/${encodeURIComponent(name)}/memory`,
        { method: 'POST', body: JSON.stringify(args) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.memory(name) })
    },
  })
}

export function useBanned(name: string) {
  return useQuery({
    queryKey: qk.banned(name),
    queryFn: () =>
      apiFetch<{ banned: string[] }>(`/characters/${encodeURIComponent(name)}/banned`),
    enabled: !!name,
  })
}

/** Permanently stop replying to a sender (adds to the character's ban list). */
export function useAddBan(name: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sender: string) =>
      apiFetch<{ ok: boolean; sender: string; banned: string[] }>(
        `/characters/${encodeURIComponent(name)}/banned`,
        { method: 'POST', body: JSON.stringify({ sender }) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.banned(name) })
      qc.invalidateQueries({ queryKey: qk.senders(name) })
      qc.invalidateQueries({ queryKey: qk.status })
    },
  })
}

/** Lift a ban on a sender (they can be replied to again). */
export function useRemoveBan(name: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sender: string) =>
      apiFetch<{ ok: boolean; banned: string[] }>(
        `/characters/${encodeURIComponent(name)}/banned/${encodeURIComponent(encodeSenderId(sender))}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.banned(name) })
      qc.invalidateQueries({ queryKey: qk.senders(name) })
      qc.invalidateQueries({ queryKey: qk.status })
    },
  })
}
