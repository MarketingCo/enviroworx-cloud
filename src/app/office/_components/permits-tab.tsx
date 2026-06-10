'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Signpost, Plus, Pencil, Trash2, X } from 'lucide-react'
import {
  listPermitsAction,
  upsertPermitAction,
  deletePermitAction,
  type PermitPayload,
} from '@/app/actions/office-data'
import { fmt, SectionHeader, Badge, Button, EmptyState, TableShell } from './shared'

const STATUSES = ['Applied', 'Active', 'Expired', 'Rejected']

const BLANK: PermitPayload = {
  location: '',
  permit_number: '',
  skip_id: '',
  date_applied: '',
  date_issued: '',
  expiry_date: '',
  status: 'Applied',
  fee: null,
  notes: '',
}

function daysToExpiry(expiry: string | null): number | null {
  if (!expiry) return null
  return Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000)
}

function expiryBadge(p: any) {
  const d = daysToExpiry(p.expiry_date)
  if (p.status === 'Expired' || (d !== null && d < 0))
    return <Badge label="Expired" color="bg-red-900/40 text-red-400" />
  if (d !== null && d <= 7) return <Badge label={`Expiring ${d}d`} color="bg-amber-900/40 text-amber-400" />
  if (p.status === 'Active') return <Badge label="Active" color="bg-green-900/40 text-green-400" />
  return <Badge label={p.status || '—'} color="bg-slate-700 text-slate-400" />
}

export function PermitsTab() {
  const [permits, setPermits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<PermitPayload | null>(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    setError(null)
    try {
      setPermits(await listPermitsAction())
    } catch (e: any) {
      setError(e?.message || 'Could not load permits')
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function save() {
    if (!form) return
    if (!form.location.trim()) return toast.error('Location is required')
    setSaving(true)
    try {
      await upsertPermitAction({ ...form, fee: form.fee ? Number(form.fee) : null })
      toast.success(form.id ? 'Permit updated' : 'Permit added')
      setForm(null)
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Could not save permit')
    }
    setSaving(false)
  }

  async function remove(id: string) {
    if (!confirm('Delete this permit?')) return
    try {
      await deletePermitAction(id)
      toast.success('Permit deleted')
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Could not delete permit')
    }
  }

  if (loading)
    return <div className="p-10 text-center text-slate-500 font-black uppercase animate-pulse">Loading permits…</div>

  if (error)
    return <EmptyState message={error} action={<Button variant="secondary" onClick={() => { setLoading(true); load() }}>Retry</Button>} />

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <SectionHeader title="Council permits" />
          <p className="text-slate-500 text-sm mt-1">
            Skips on public roads need a council permit — expiring ones alert on the dashboard
          </p>
        </div>
        <Button onClick={() => setForm({ ...BLANK })}>
          <span className="inline-flex items-center gap-1.5"><Plus size={14} /> Add permit</span>
        </Button>
      </div>

      {permits.length === 0 ? (
        <EmptyState
          icon={<Signpost size={32} />}
          message="No permits recorded yet"
          action={<Button variant="secondary" onClick={() => setForm({ ...BLANK })}>Add the first permit</Button>}
        />
      ) : (
        <TableShell headers={['Status', 'Location', 'Permit no.', 'Skip', 'Applied', 'Issued', 'Expires', 'Fee', '']}>
          {permits.map((p) => (
            <tr key={p.id} className="hover:bg-white/[0.02]">
              <td className="px-4 py-3">{expiryBadge(p)}</td>
              <td className="px-4 py-3 text-white font-bold">{p.location}</td>
              <td className="px-4 py-3">{p.permit_number || '—'}</td>
              <td className="px-4 py-3">{p.skip_id || '—'}</td>
              <td className="px-4 py-3 whitespace-nowrap">{p.date_applied || '—'}</td>
              <td className="px-4 py-3 whitespace-nowrap">{p.date_issued || '—'}</td>
              <td className="px-4 py-3 whitespace-nowrap text-white">{p.expiry_date || '—'}</td>
              <td className="px-4 py-3">{p.fee != null ? fmt(Number(p.fee)) : '—'}</td>
              <td className="px-4 py-3 whitespace-nowrap text-right">
                <button
                  onClick={() =>
                    setForm({
                      id: p.id,
                      location: p.location || '',
                      permit_number: p.permit_number || '',
                      skip_id: p.skip_id || '',
                      date_applied: p.date_applied || '',
                      date_issued: p.date_issued || '',
                      expiry_date: p.expiry_date || '',
                      status: p.status || 'Applied',
                      fee: p.fee,
                      notes: p.notes || '',
                    })
                  }
                  className="text-slate-500 hover:text-white p-1.5"
                  title="Edit"
                >
                  <Pencil size={14} />
                </button>
                <button onClick={() => remove(p.id)} className="text-slate-500 hover:text-red-400 p-1.5" title="Delete">
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </TableShell>
      )}

      {form && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setForm(null)}>
          <div
            className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white uppercase tracking-widest">
                {form.id ? 'Edit permit' : 'New permit'}
              </h3>
              <button onClick={() => setForm(null)} className="text-slate-500 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase">Location / address *</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white mt-1"
                  placeholder="12 Morningside Rd, EH10"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase">Permit / council ref</label>
                  <input
                    value={form.permit_number || ''}
                    onChange={(e) => setForm({ ...form, permit_number: e.target.value })}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white mt-1"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase">Skip ID</label>
                  <input
                    value={form.skip_id || ''}
                    onChange={(e) => setForm({ ...form, skip_id: e.target.value })}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white mt-1"
                    placeholder="S-14"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase">Applied</label>
                  <input
                    type="date"
                    value={form.date_applied || ''}
                    onChange={(e) => setForm({ ...form, date_applied: e.target.value })}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white mt-1"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase">Issued</label>
                  <input
                    type="date"
                    value={form.date_issued || ''}
                    onChange={(e) => setForm({ ...form, date_issued: e.target.value })}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white mt-1"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase">Expires</label>
                  <input
                    type="date"
                    value={form.expiry_date || ''}
                    onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white mt-1"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase">Fee £</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.fee ?? ''}
                    onChange={(e) => setForm({ ...form, fee: e.target.value === '' ? null : Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white mt-1"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase">Notes</label>
                <textarea
                  value={form.notes || ''}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white mt-1"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setForm(null)}>
                Cancel
              </Button>
              <Button onClick={save} loading={saving}>
                {form.id ? 'Save changes' : 'Add permit'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
