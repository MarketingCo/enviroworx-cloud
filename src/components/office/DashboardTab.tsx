'use client'
import { CheckCircle, Clock, AlertTriangle, TrendingUp, Package, Zap, CalendarPlus, DollarSign, Weight } from 'lucide-react'
import { Badge, KpiCard, SectionHeader, fmt, DEFAULT_CONFIG } from './shared'
import type { DashStats } from './shared'
function DashboardTab({ data, onRefresh }: { data: DashStats | null; onRefresh: () => void }) {
  if (!data) return <div className="flex items-center justify-center h-64 text-slate-500 text-sm">Loading dashboard...</div>

  const totalUnpaid = data.unpaidInvoices.reduce((s: number, i: any) => s + (i.outstanding || 0), 0)
  const expiringPermits = data.expiringPermits || []

  return (
    <div className="space-y-8">
      {/* Critical Alerts */}
      {expiringPermits.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 flex items-start gap-6">
          <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center text-white shrink-0 shadow-lg">
            <AlertTriangle size={24} />
          </div>
          <div className="flex-1">
            <h3 className="text-red-500 font-black uppercase tracking-widest text-xs mb-3">Permit Expiry Warning</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {expiringPermits.map((p: any) => (
                <div key={p.id} className="bg-slate-900/50 p-3 rounded-lg border border-red-500/10 flex justify-between items-center">
                  <div>
                    <p className="text-white font-bold text-sm">{p.location}</p>
                    <p className="text-[10px] text-red-400 font-black uppercase">Expires: {new Date(p.expiry_date).toLocaleDateString()}</p>
                  </div>
                  <Badge label={p.status} color="bg-red-900/40 text-red-400" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="Completed Today" value={data.stats.completedToday} icon={<CheckCircle size={24} />} />
        <KpiCard label="Completed This Week" value={data.stats.completedWeek} icon={<TrendingUp size={24} />} />
        <KpiCard label="Future Bookings" value={data.stats.futureBookings} icon={<CalendarPlus size={24} />} color="text-blue-400" />
        <KpiCard label="Tips Today" value={data.stats.tipsToday} icon={<Weight size={24} />} color="text-yellow-400" />
        <KpiCard label="Est. Profit Today" value={fmt(data.stats.estProfitToday || 0)} icon={<DollarSign size={24} />} color="text-emerald-500" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Inventory Summary */}
        <div className="bg-slate-900 border border-white/5 rounded-xl p-5">
          <SectionHeader title="Inventory by Size" />
          <div className="space-y-2">
            {data.inventorySummary.length === 0 && <p className="text-slate-500 text-sm">No inventory data</p>}
            {data.inventorySummary.map((row: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="font-bold text-white">{row.skip_size}yd</span>
                <div className="flex gap-3 text-xs">
                  <span className="text-green-400 font-bold">{row.available ?? 0} avail</span>
                  <span className="text-blue-400 font-bold">{row.in_use ?? 0} out</span>
                  {row.damaged > 0 && <span className="text-red-400 font-bold">{row.damaged} dmg</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Active Tippers */}
        <div className="bg-slate-900 border border-white/5 rounded-xl p-5">
          <SectionHeader title={`Active Tippers (${data.activeTippers.length})`} />
          {data.activeTippers.length === 0
            ? <p className="text-slate-500 text-sm">No trucks in yard</p>
            : <div className="space-y-2">
                {data.activeTippers.map((t: any, i: number) => (
                  <div key={i} className="border border-white/5 rounded-lg p-3">
                    <div className="flex justify-between">
                      <span className="font-black text-white text-sm">{t.reg}</span>
                      <span className="text-xs text-slate-400">{t.skip_size}</span>
                    </div>
                    <p className="text-xs text-slate-500">{t.customer_name} · {t.waste_type}</p>
                  </div>
                ))}
              </div>
          }
        </div>

        {/* Driver Hours */}
        <div className="bg-slate-900 border border-white/5 rounded-xl p-5">
          <SectionHeader title="Driver Hours Today" />
          {data.driverHours.length === 0
            ? <p className="text-slate-500 text-sm">No drivers clocked in</p>
            : <div className="space-y-2">
                {data.driverHours.map((d: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-white font-bold">{d.employee}</span>
                    <span className={`font-black ${(d.hours_worked ?? 0) >= DEFAULT_CONFIG.warnDriveHours ? 'text-yellow-400' : 'text-primary'}`}>
                      {(d.hours_worked ?? 0).toFixed(1)}h
                    </span>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Unpaid Invoices */}
        <div className="bg-slate-900 border border-white/5 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <SectionHeader title={`Unpaid Invoices (${data.unpaidInvoices.length})`} />
            <span className="text-red-400 font-black text-sm">{fmt(totalUnpaid)}</span>
          </div>
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {data.unpaidInvoices.length === 0
              ? <p className="text-slate-500 text-sm">All clear</p>
              : data.unpaidInvoices.map((inv: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                    <div>
                      <p className="text-white font-bold">{inv.customer_name}</p>
                      <p className="text-xs text-slate-500">{inv.date} · {inv.skip_size}</p>
                    </div>
                    <span className="text-yellow-400 font-black">{fmt(inv.outstanding ?? 0)}</span>
                  </div>
                ))
            }
          </div>
        </div>

        {/* Collections Due */}
        <div className="bg-slate-900 border border-white/5 rounded-xl p-5">
          <SectionHeader title={`Collections Due (${data.collections.length})`} />
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {data.collections.length === 0
              ? <p className="text-slate-500 text-sm">No collections overdue</p>
              : data.collections.map((c: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                    <div>
                      <p className="text-white font-bold">{c.customer_name}</p>
                      <p className="text-xs text-slate-500">{c.address}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">{c.skip_id}</p>
                      <p className="text-xs text-red-400 font-bold">{c.days_out ?? '?'}d out</p>
                    </div>
                  </div>
                ))
            }
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardTab
