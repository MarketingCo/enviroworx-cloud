'use client'

import { useState, useEffect, useCallback } from 'react'
import { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import {
  getDispatchJobs,
  assignDriverToJob,
  autoAssignJobs,
  cancelBooking,
} from '@/lib/api'
import { syncOrderToQuickBooks } from '@/app/actions/quickbooks'
import toast from 'react-hot-toast'
import {
  Truck,
  RefreshCw,
  Zap,
  X,
  DollarSign,
  CheckCircle,
} from 'lucide-react'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function today() { return new Date().toISOString().split('T')[0] }
function tomorrow() {
  const d = new Date(); d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

function SectionHeader({ title }: { title: string }) {
  return <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-3">{title}</h3>
}

function Badge({ label, color }: { label: string; color: string }) {
  return <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide ${color}`}>{label}</span>
}

function statusColor(status: string) {
  switch (status) {
    case 'Completed': return 'bg-green-900/40 text-green-400'
    case 'Assigned': return 'bg-blue-900/40 text-blue-400'
    case 'Booked': return 'bg-yellow-900/40 text-yellow-400'
    case 'Aborted': return 'bg-red-900/40 text-red-400'
    default: return 'bg-slate-700 text-slate-400'
  }
}

// ─── Dispatch Tab ─────────────────────────────────────────────────────────────

export default function DispatchTab() {
  const [jobs, setJobs] = useState<Database["public"]["Tables"]["orders"]["Row"][]>([])
  const [drivers, setDrivers] = useState<Database["public"]["Tables"]["drivers"]["Row"][]>([])
  const [dispatchDate, setDispatchDate] = useState(tomorrow())
  const [loading, setLoading] = useState(false)
  const [sortBy, setSortBy] = useState<'time' | 'area'>('time')

  const load = useCallback(async () => {
    setLoading(true)
    const [jobData, { data: driverData }] = await Promise.all([
      getDispatchJobs(dispatchDate),
      supabase.from('drivers').select('*').eq('status', 'Available').order('name'),
    ])
    setJobs(jobData)
    setDrivers(driverData ?? [])
    setLoading(false)
  }, [dispatchDate])

  useEffect(() => { load() }, [load])

  async function handleAssign(orderId: string, driverName: string) {
    const driver = drivers.find(d => d.name === driverName)
    await assignDriverToJob(orderId, driverName, driver?.id ?? null)
    toast.success(`Assigned to ${driverName}`)
    load()
  }

  async function handleAutoAssign() {
    const result = await autoAssignJobs(dispatchDate)
    toast.success(result.message ?? 'Auto-assigned')
    load()
  }

  async function handleCancel(orderId: string) {
    if (!confirm('Cancel this job?')) return
    await cancelBooking(orderId)
    toast.success('Job cancelled')
    load()
  }

  async function handleQBSync(orderId: string) {
    toast.loading('Syncing to QuickBooks...', { id: orderId })
    const res = await syncOrderToQuickBooks(orderId)
    if (res.success) {
      toast.success(`Draft Invoice Created: ${res.qbId}`, { id: orderId })
      load()
    } else {
      toast.error(`Sync failed: ${res.error}`, { id: orderId })
    }
  }

  const getPostcode = (addr: string) => {
    const match = addr.match(/[A-Z]{1,2}[0-9][A-Z0-9]? [0-9][A-Z]{2}/i) || addr.match(/[A-Z]{1,2}[0-9][A-Z0-9]?/i)
    return match ? match[0].toUpperCase() : '??'
  }

  const sortedJobs = [...jobs].sort((a, b) => {
    if (sortBy === 'area') return getPostcode(a.address).localeCompare(getPostcode(b.address))
    return (a.arrive_time || '99:99').localeCompare(b.arrive_time || '99:99')
  })

  const unassigned = sortedJobs.filter(j => !j.driver_name)
  const assigned = sortedJobs.filter(j => j.driver_name)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Dispatch Date</label>
            <input
              type="date"
              value={dispatchDate}
              onChange={e => setDispatchDate(e.target.value)}
              className="bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as 'time' | 'area')}
              className="bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm"
            >
              <option value="time">Time</option>
              <option value="area">Postcode Area</option>
            </select>
          </div>
          <button onClick={load} className="mt-5 flex items-center gap-2 bg-slate-800 border border-white/10 text-white px-4 py-2 rounded text-sm hover:bg-slate-700">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
        {unassigned.length > 0 && (
          <button onClick={handleAutoAssign} className="mt-5 flex items-center gap-2 bg-primary text-white px-4 py-2 rounded text-sm font-bold hover:bg-primary-dark">
            <Zap size={14} /> Auto-Assign ({unassigned.length})
          </button>
        )}
      </div>

      {loading && <p className="text-slate-500 text-sm">Loading jobs...</p>}

      {!loading && jobs.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <Truck size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-bold">No jobs for {dispatchDate}</p>
        </div>
      )}

      {/* Unassigned */}
      {unassigned.length > 0 && (
        <div>
          <SectionHeader title={`Unassigned (${unassigned.length})`} />
          <div className="space-y-2">
            {unassigned.map((job: Database["public"]["Tables"]["orders"]["Row"]) => (
              <div key={job.id} className="bg-slate-900 border border-yellow-500/20 rounded-xl p-4 flex flex-wrap items-center gap-4">
                <div className="w-12 text-center border-r border-white/5 mr-2">
                  <span className="text-[10px] font-black text-slate-500 block">AREA</span>
                  <span className="text-sm font-black text-white">{getPostcode(job.address).split(' ')[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge label={job.job_type} color="bg-slate-700 text-slate-300" />
                    <Badge label={job.skip_size + 'yd'} color="bg-slate-700 text-slate-300" />
                    <Badge label={job.payment_method || 'Cash'} color="bg-slate-800 text-slate-400" />
                  </div>
                  <p className="text-white font-bold mt-1">{job.customer_name}</p>
                  <p className="text-slate-400 text-xs">{job.address}</p>
                  {job.delivery_comments && <p className="text-slate-500 text-xs italic mt-0.5">{job.delivery_comments}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm"
                    defaultValue=""
                    onChange={e => { if (e.target.value) handleAssign(job.id, e.target.value) }}
                  >
                    <option value="">Assign driver...</option>
                    {drivers.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                  <button onClick={() => handleCancel(job.id)} className="text-slate-600 hover:text-red-400 transition-colors">
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assigned */}
      {assigned.length > 0 && (
        <div>
          <SectionHeader title={`Assigned (${assigned.length})`} />
          <div className="space-y-2">
            {assigned.map((job: Database["public"]["Tables"]["orders"]["Row"]) => {
              const isSynced = job.comments?.includes('[QB Sync:')
              return (
                <div key={job.id} className="bg-slate-900 border border-white/5 rounded-xl p-4 flex flex-wrap items-center gap-4">
                  <div className="w-12 text-center border-r border-white/5 mr-2">
                    <span className="text-[10px] font-black text-slate-500 block">AREA</span>
                    <span className="text-sm font-black text-white">{getPostcode(job.address).split(' ')[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge label={job.status} color={statusColor(job.status)} />
                      <Badge label={job.job_type} color="bg-slate-700 text-slate-300" />
                      <Badge label={job.skip_size + 'yd'} color="bg-slate-700 text-slate-300" />
                    </div>
                    <p className="text-white font-bold mt-1">{job.customer_name}</p>
                    <p className="text-slate-400 text-xs">{job.address}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {job.status === 'Completed' && job.payment_method === 'Invoice' && (
                      <button
                        onClick={() => handleQBSync(job.id)}
                        disabled={isSynced}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-black uppercase transition-all ${
                          isSynced ? 'bg-green-900/20 text-green-500 cursor-default' : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'
                        }`}
                      >
                        {isSynced ? <CheckCircle size={12} /> : <DollarSign size={12} />}
                        {isSynced ? 'Synced to QB' : 'Sync to QB'}
                      </button>
                    )}
                    <div className="flex flex-col items-end">
                      <span className="text-primary font-black text-[10px] uppercase tracking-tighter mb-1">{job.driver_name}</span>
                      <select
                        className="bg-slate-800 border border-white/10 text-white px-2 py-1 rounded text-[10px]"
                        value={job.driver_name ?? ''}
                        onChange={e => handleAssign(job.id, e.target.value)}
                      >
                        <option value="">Unassign</option>
                        {drivers.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
