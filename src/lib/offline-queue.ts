/**
 * Offline Queue — IndexedDB-backed job completion queue
 * When the driver app is offline, completed jobs are stored here
 * and flushed to the server when connectivity is restored.
 */

const DB_NAME = 'enviroworx-driver'
const STORE_NAME = 'completed_jobs'
const DB_VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
      }
    }
  })
}

export interface QueuedJob {
  id?: number
  orderId: string
  skipId: string
  jobType: string
  address: string
  customerName: string
  lorryReg: string
  photoUrl?: string
  completedAt: string
  driverName: string
  synced: boolean
}

export async function queueCompletedJob(job: Omit<QueuedJob, 'id' | 'synced'>): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)

  await new Promise<void>((resolve, reject) => {
    const request = store.add({ ...job, synced: false })
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })

  db.close()
}

export async function getUnsyncedJobs(): Promise<QueuedJob[]> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)

  const jobs = await new Promise<QueuedJob[]>((resolve, reject) => {
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result.filter((j: QueuedJob) => !j.synced))
    request.onerror = () => reject(request.error)
  })

  db.close()
  return jobs
}

export async function markJobSynced(id: number): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)

  await new Promise<void>((resolve, reject) => {
    const request = store.delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })

  db.close()
}

export async function flushQueue(syncFn: (job: QueuedJob) => Promise<void>): Promise<{ synced: number; failed: number }> {
  const jobs = await getUnsyncedJobs()
  let synced = 0
  let failed = 0

  for (const job of jobs) {
    try {
      await syncFn(job)
      if (job.id) await markJobSynced(job.id)
      synced++
    } catch (err) {
      console.error(`Failed to sync job ${job.orderId}:`, err)
      failed++
    }
  }

  return { synced, failed }
}
