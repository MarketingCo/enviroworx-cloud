'use client'

import { useEffect, useState, useCallback } from 'react'
import { getAuditLogAction } from '@/app/actions/office-data'
import { SectionHeader, Button, EmptyState } from './shared'
import toast from 'react-hot-toast'

type AuditRow = {
  id: string
  type: string | null
  message: string | null
  status: string | null
  actor_email: string | null
  actor_name: string | null
  entity_type: string | null
  entity_id: string | null
  created_at: string | null
}

export function ActivityTab() {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getAuditLogAction(100)
      setRows(data as AuditRow[])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load activity')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (error)
    return (
      <EmptyState message={error} action={<Button variant="secondary" onClick={load}>Retry</Button>} />
    )

  return (
    <div className="space-y-6 max-w-5xl animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-4">
        <div>
          <SectionHeader title="Activity log" />
          <p className="text-slate-500 text-sm mt-1">Who did what — bookings, dispatch, payments, driver events</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-xs font-black uppercase tracking-widest text-primary hover:text-white transition disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {loading && rows.length === 0 ? (
        <p className="text-slate-500 text-sm font-bold uppercase tracking-widest animate-pulse">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-slate-500 text-sm">No activity yet. Actions will appear here as staff use the system.</p>
      ) : (
        <ul className="divide-y divide-white/5 rounded-2xl border border-white/5 bg-slate-900/50 overflow-hidden">
          {rows.map((row) => (
            <li key={row.id} className="px-5 py-4 hover:bg-white/[0.02] transition">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-white font-semibold">{row.message || row.type}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {row.actor_name || row.actor_email || 'System'}
                    {row.entity_type && row.entity_id ? (
                      <span className="text-slate-600">
                        {' '}
                        · {row.entity_type} {row.entity_id.slice(0, 8)}…
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span
                    className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                      row.status === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/15 text-emerald-400'
                    }`}
                  >
                    {row.status || 'ok'}
                  </span>
                  <p className="text-xs text-slate-500 mt-1 font-mono">
                    {row.created_at ? new Date(row.created_at).toLocaleString('en-GB') : ''}
                  </p>
                </div>
              </div>
              {row.type ? (
                <p className="text-[11px] text-slate-500 font-mono mt-2 uppercase tracking-wider">{row.type}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
