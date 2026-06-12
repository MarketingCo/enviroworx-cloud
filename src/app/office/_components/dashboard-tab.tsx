'use client'

import { useState } from 'react'
import { DEFAULT_CONFIG } from '@/lib/config'
import toast from 'react-hot-toast'
import { AlertTriangle, Signpost, PoundSterling, ChevronRight } from 'lucide-react'
import { sendOverstaySmsAction } from '@/app/actions/operations'

import { fmt, SectionHeader, type DashStats, type Tab } from './shared'

/** Command-centre home: what's happening now, what needs action.
 *  Pure statistics live in the slim footer; detail lives in the tabs. */
export function DashboardTab({
  data,
  onRefresh,
  onNavigate,
}: {
  data: DashStats | null
  onRefresh: () => void
  onNavigate?: (tab: Tab) => void
}) {
  const [smsSending, setSmsSending] = useState<string | null>(null)

  async function handleOverstaySms(skipId: string) {
    setSmsSending(skipId)
    try {
      const res = (await sendOverstaySmsAction(skipId)) as any
      if (res?.success) toast.success('SMS sent')
      else toast.error(res?.error ?? res?.message ?? 'SMS failed')
    } catch (e: any) {
      toast.error(e.message)
    }
    setSmsSending(null)
  }

  if (!data)
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-slate-800/40 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="h-64 bg-slate-800/40 rounded-2xl animate-pulse" />
          <div className="h-64 bg-slate-800/40 rounded-2xl animate-pulse" />
        </div>
      </div>
    )

  const totalUnpaid = data.unpaidInvoices.reduce((s: number, i: any) => s + (i.amount || 0), 0)
  const expiringPermits = data.expiringPermits || []
  const overstayDays = DEFAULT_CONFIG.demurrageDays || 28
  const overstays = data.collections.filter((c: any) => (c.days_on_hire ?? 0) > overstayDays)
  const driversOn = data.driverHours.filter((d: any) => d.currently_clocked_in).length
  const jobs = data.todayJobs ?? { total: 0, completed: 0, unassigned: 0 }
  const attention = expiringPermits.length > 0 || overstays.length > 0 || totalUnpaid > 0

  const heroTiles: {
    label: string
    value: string
    sub?: string
    warn?: boolean
    tab?: Tab
  }[] = [
    {
      label: "Today's jobs",
      value: `${jobs.completed} / ${jobs.total}`,
      sub: jobs.total === 0 ? 'none booked' : 'completed',
      tab: 'dispatch',
    },
    {
      label: 'Unassigned',
      value: String(jobs.unassigned),
      sub: jobs.unassigned > 0 ? 'need a driver' : 'all assigned',
      warn: jobs.unassigned > 0,
      tab: 'dispatch',
    },
    {
      label: 'Tipping now',
      value: String(data.activeTippers.length),
      sub: data.activeTippers.length > 0 ? 'trucks in yard' : 'yard clear',
      tab: 'weighbridge',
    },
    {
      label: 'Drivers on',
      value: String(driversOn),
      sub: 'clocked in',
    },
  ]

  return (
    <div className="space-y-5">
      {/* ── NOW — the day at a glance ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {heroTiles.map((t) => (
          <button
            key={t.label}
            onClick={() => t.tab && onNavigate?.(t.tab)}
            disabled={!t.tab}
            className={`text-left bg-slate-900 border rounded-2xl p-5 transition-colors ${
              t.warn ? 'border-amber-500/40' : 'border-white/5'
            } ${t.tab ? 'hover:border-primary/40 cursor-pointer' : 'cursor-default'}`}
          >
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{t.label}</p>
            <p className={`text-3xl font-black mt-1 ${t.warn ? 'text-amber-400' : 'text-white'}`}>{t.value}</p>
            {t.sub && <p className="text-xs text-slate-500 mt-0.5">{t.sub}</p>}
          </button>
        ))}
      </div>

      {/* ── NEEDS ATTENTION — only exists when something does ── */}
      {attention && (
        <div className="flex flex-wrap gap-3">
          {expiringPermits.length > 0 && (
            <button
              onClick={() => onNavigate?.('permits')}
              className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 hover:border-red-400 rounded-xl px-4 py-3 transition-colors"
            >
              <Signpost size={18} className="text-red-400" />
              <span className="text-sm font-bold text-white">
                {expiringPermits.length} permit{expiringPermits.length === 1 ? '' : 's'} expiring
              </span>
              <ChevronRight size={14} className="text-red-400" />
            </button>
          )}
          {overstays.length > 0 && (
            <button
              onClick={() => onNavigate?.('inventory')}
              className="flex items-center gap-3 bg-orange-500/10 border border-orange-500/30 hover:border-orange-400 rounded-xl px-4 py-3 transition-colors"
            >
              <AlertTriangle size={18} className="text-orange-400" />
              <span className="text-sm font-bold text-white">
                {overstays.length} skip{overstays.length === 1 ? '' : 's'} overstayed
              </span>
              <ChevronRight size={14} className="text-orange-400" />
            </button>
          )}
          {totalUnpaid > 0 && (
            <button
              onClick={() => onNavigate?.('customers')}
              className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/30 hover:border-yellow-400 rounded-xl px-4 py-3 transition-colors"
            >
              <PoundSterling size={18} className="text-yellow-400" />
              <span className="text-sm font-bold text-white">
                {fmt(totalUnpaid)} unpaid · {data.unpaidInvoices.length} invoice{data.unpaidInvoices.length === 1 ? '' : 's'}
              </span>
              <ChevronRight size={14} className="text-yellow-400" />
            </button>
          )}
        </div>
      )}

      {/* ── WORK LISTS ── */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Collections due */}
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-5">
          <SectionHeader title={`Collections due (${data.collections.length})`} />
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {data.collections.length === 0 ? (
              <p className="text-slate-500 text-sm">No collections overdue</p>
            ) : (
              data.collections
                .slice()
                .sort((a: any, b: any) => (b.days_on_hire ?? 0) - (a.days_on_hire ?? 0))
                .map((c: any, i: number) => {
                  const days = Math.round(c.days_on_hire ?? 0)
                  const overstay = days > overstayDays
                  return (
                    <div
                      key={i}
                      className={`flex justify-between items-center text-sm border-b pb-2 ${overstay ? 'border-orange-500/20' : 'border-white/5'}`}
                    >
                      <div className="flex-1 min-w-0 pr-3">
                        <p className="text-white font-bold truncate">{c.customer_name}</p>
                        <p className="text-xs text-slate-400 truncate">{c.address}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <p className="text-xs text-slate-500">
                            {c.skip_id} · {c.skip_size}yd
                          </p>
                          <p className={`text-xs font-bold ${overstay ? 'text-orange-400' : 'text-slate-400'}`}>
                            {days}d {overstay ? 'overstay' : 'out'}
                          </p>
                        </div>
                        {overstay && (
                          <button
                            onClick={() => handleOverstaySms(c.skip_id)}
                            disabled={smsSending === c.skip_id}
                            title="SMS customer to arrange collection"
                            className="text-xs font-bold uppercase bg-orange-900/40 hover:bg-orange-500 text-orange-400 hover:text-white px-2 py-1 rounded transition-all disabled:opacity-50"
                          >
                            {smsSending === c.skip_id ? '...' : 'SMS'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
            )}
          </div>
        </div>

        {/* Unpaid invoices */}
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <SectionHeader title={`Unpaid invoices (${data.unpaidInvoices.length})`} />
            <span className="text-yellow-400 font-black text-sm">{fmt(totalUnpaid)}</span>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {data.unpaidInvoices.length === 0 ? (
              <p className="text-slate-500 text-sm">All clear</p>
            ) : (
              data.unpaidInvoices.map((inv: any, i: number) => (
                <div key={i} className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                  <div>
                    <p className="text-white font-bold">{inv.customer_name}</p>
                    <p className="text-xs text-slate-400">
                      {inv.date} · {inv.skip_size}
                    </p>
                  </div>
                  <span className="text-yellow-400 font-bold">{fmt(inv.amount ?? 0)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── QUIET STATS FOOTER ── */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2 bg-slate-900/60 border border-white/5 rounded-2xl px-5 py-3.5">
        {[
          { label: 'This week', value: String(data.stats.completedWeek) },
          { label: 'Future bookings', value: String(data.stats.futureBookings) },
          { label: 'Tips today', value: String(data.stats.tipsToday) },
          { label: 'Est. profit today', value: fmt(data.stats.estProfitToday || 0) },
        ].map((s) => (
          <div key={s.label} className="flex items-baseline gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{s.label}</span>
            <span className="text-sm font-black text-slate-200">{s.value}</span>
          </div>
        ))}
        <button onClick={onRefresh} className="ml-auto text-xs text-slate-500 hover:text-white transition-colors">
          Refresh
        </button>
      </div>
    </div>
  )
}
