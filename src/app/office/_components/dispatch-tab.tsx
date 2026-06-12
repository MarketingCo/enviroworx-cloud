'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase-browser'
import { DEFAULT_CONFIG } from '@/lib/config'
import toast from 'react-hot-toast'
import { Truck, RefreshCw, Zap, X, CheckCircle, PoundSterling } from 'lucide-react'
import { getDispatchJobsAction as getDispatchJobs } from '@/app/actions/office-data'
import { assignDriverToJobAction, autoAssignJobsAction, cancelBookingAction } from '@/app/actions/operations'
import { optimiseDriverRouteAction, saveRouteOrderAction, type OptimisedRoute } from '@/app/actions/routing'
import { syncOrderToQuickBooks } from '@/app/actions/quickbooks'

import { fmt, today, tomorrow, SectionHeader, Badge, statusColor, Button, EmptyState } from './shared'
import { getTabCache, setTabCache } from './tab-cache'

export function DispatchTab() {
  const [dispatchDate, setDispatchDate] = useState(tomorrow())
  const cached = getTabCache<{ jobs: any[]; drivers: any[] }>(`dispatch:${tomorrow()}`)
  const [jobs, setJobs] = useState<any[]>(cached?.jobs ?? [])
  const [drivers, setDrivers] = useState<any[]>(cached?.drivers ?? [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'time' | 'area'>('time')
  const [route, setRoute] = useState<OptimisedRoute | null>(null)
  const [optimising, setOptimising] = useState<string | null>(null)
  const [savingRoute, setSavingRoute] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [jobData, { data: driverData }] = await Promise.all([
        getDispatchJobs(dispatchDate),
        supabase.from('drivers').select('*').eq('status', 'Available').order('name'),
      ])
      setJobs(jobData)
      setDrivers(driverData ?? [])
      setTabCache(`dispatch:${dispatchDate}`, { jobs: jobData, drivers: driverData ?? [] })
    } catch (e: any) {
      setError(e?.message || 'Could not load dispatch jobs')
    } finally {
      setLoading(false)
    }
  }, [dispatchDate])

  useEffect(() => { load() }, [load])

  async function handleAssign(orderId: string, driverName: string) {
    const driver = drivers.find(d => d.name === driverName)
    await assignDriverToJobAction(orderId, driverName, driver?.id ?? null)
    toast.success(`Assigned to ${driverName}`)
    load()
  }

  async function handleAutoAssign() {
    const result = await autoAssignJobsAction(dispatchDate)
    toast.success(result.message ?? 'Auto-assigned')
    load()
  }

  async function handleCancel(orderId: string) {
    if (!confirm('Cancel this job?')) return
    await cancelBookingAction(orderId)
    toast.success('Job cancelled')
    load()
  }

  async function handleQBSync(orderId: string) {
    toast.loading('Syncing to QuickBooks...', { id: orderId })
    const res = await syncOrderToQuickBooks(orderId)
    if (res.success && 'qbId' in res) {
      toast.success(`Draft Invoice Created: ${res.qbId}`, { id: orderId })
      load()
    } else {
      const err = 'error' in res ? res.error : 'Unknown error'
      toast.error(`Sync failed: ${err}`, { id: orderId })
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
  const driversWithRuns = [...new Set(assigned.filter(j => !['Completed', 'Cancelled', 'Aborted'].includes(j.status)).map(j => j.driver_name))]
    .map(name => ({ name, count: assigned.filter(j => j.driver_name === name && !['Completed', 'Cancelled', 'Aborted'].includes(j.status)).length }))
    .filter(d => d.count >= 2)

  async function handleOptimise(driverName: string) {
    setOptimising(driverName)
    try {
      setRoute(await optimiseDriverRouteAction(driverName, dispatchDate))
    } catch (e: any) {
      toast.error(e?.message || 'Could not optimise route')
    }
    setOptimising(null)
  }

  async function handleSaveRoute() {
    if (!route) return
    setSavingRoute(true)
    try {
      await saveRouteOrderAction(route.stops.map(st => st.orderId))
      toast.success(`Route saved — ${route.driverName}'s jobs now run in this order`)
      setRoute(null)
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Could not save route')
    }
    setSavingRoute(false)
  }

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
              onChange={e => setSortBy(e.target.value as any)}
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

      {loading && jobs.length === 0 && <p className="text-slate-500 text-sm">Loading jobs...</p>}

      {!loading && error && (
        <EmptyState
          icon={<Truck size={32} className="opacity-30" />}
          message={error}
          action={<Button variant="secondary" onClick={load}>Retry</Button>}
        />
      )}

      {!loading && !error && jobs.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <Truck size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-bold">No jobs for {dispatchDate}</p>
        </div>
      )}

      {route && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setRoute(null)}>
          <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-xl p-6 space-y-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Optimised run — {route.driverName}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  {route.date} · {route.totalDistanceKm} km · ~{Math.floor(route.totalDurationMin / 60)}h {route.totalDurationMin % 60}m driving · starts and ends at the yard
                </p>
              </div>
              <button onClick={() => setRoute(null)} className="text-slate-500 hover:text-white"><X size={16} /></button>
            </div>
            <ol className="space-y-2">
              {route.stops.map((st, i) => (
                <li key={st.orderId} className="flex items-center gap-3 bg-slate-800/60 border border-white/5 rounded-lg p-3">
                  <span className="w-7 h-7 shrink-0 rounded-full bg-primary text-slate-900 font-black text-sm flex items-center justify-center">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm truncate">{st.customerName} <span className="text-slate-500 font-normal">· {st.jobType} · {st.skipSize}yd</span></p>
                    <p className="text-xs text-slate-400 truncate">{st.address}</p>
                  </div>
                  <span className="text-xs text-slate-500 whitespace-nowrap">+{st.legDurationMin}m · {st.legDistanceKm}km</span>
                </li>
              ))}
            </ol>
            <div className="flex justify-end gap-2">
              <button onClick={() => setRoute(null)} className="px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white">Cancel</button>
              <button
                onClick={handleSaveRoute}
                disabled={savingRoute}
                className="px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest bg-primary text-slate-900 disabled:opacity-50"
              >
                {savingRoute ? 'Saving…' : 'Save order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unassigned */}
      {unassigned.length > 0 && (
        <div>
          <SectionHeader title={`Unassigned (${unassigned.length})`} />
          <div className="space-y-2">
            {unassigned.map((job: any) => (
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
                  {job.delivery_comments && <p className="text-slate-500 text-xs mt-0.5">{job.delivery_comments}</p>}
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
          {driversWithRuns.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Optimise route:</span>
              {driversWithRuns.map(d => (
                <button
                  key={d.name}
                  onClick={() => handleOptimise(d.name)}
                  disabled={optimising !== null}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-black uppercase bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all disabled:opacity-50"
                >
                  <Zap size={12} /> {optimising === d.name ? 'Optimising…' : `${d.name} (${d.count})`}
                </button>
              ))}
            </div>
          )}
          <div className="space-y-2">
            {assigned.map((job: any) => {
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
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-black uppercase transition-all ${
                          isSynced ? 'bg-green-900/20 text-green-500 cursor-default' : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'
                        }`}
                      >
                        {isSynced ? <CheckCircle size={12} /> : <PoundSterling size={12} />}
                        {isSynced ? 'Synced to QB' : 'Sync to QB'}
                      </button>
                    )}
                    <div className="flex flex-col items-end">
                      <span className="text-primary font-black text-xs uppercase tracking-tighter mb-1">{job.driver_name}</span>
                      <select
                        className="bg-slate-800 border border-white/10 text-white px-2 py-1 rounded text-xs"
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

// ─── Weighbridge Tab ──────────────────────────────────────────────────────────
