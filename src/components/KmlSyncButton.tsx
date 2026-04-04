'use client'

import { useState } from 'react'
import { toast } from 'react-hot-toast'

export default function KmlSyncButton() {
  const [syncing, setSyncing] = useState(false)

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/admin/sync-kml', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        toast.success(`Synced ${data.count} points from KML`)
        window.location.reload() // Reload to refresh map data
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast.error(`Sync failed: ${error.message}`)
    }
    setSyncing(false)
  }

  return (
    <button
      onClick={handleSync}
      disabled={syncing}
      className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded text-xs font-black transition-all flex items-center gap-2"
    >
      {syncing ? '⌛ Syncing...' : '📡 Sync KML Map'}
    </button>
  )
}
