/** Pending driver actions when offline — synced when back online */

export type QueuedDriverAction = {
  id: string
  type: 'complete' | 'abort' | 'on_site'
  payload: Record<string, unknown>
  createdAt: number
}

const STORAGE_KEY = 'env_driver_action_queue'

export function getDriverQueue(): QueuedDriverAction[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as QueuedDriverAction[]) : []
  } catch {
    return []
  }
}

export function enqueueDriverAction(
  type: QueuedDriverAction['type'],
  payload: Record<string, unknown>
) {
  const queue = getDriverQueue()
  queue.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    payload,
    createdAt: Date.now(),
  })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
}

export function setDriverQueue(queue: QueuedDriverAction[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
}

export function clearDriverQueue() {
  localStorage.removeItem(STORAGE_KEY)
}
