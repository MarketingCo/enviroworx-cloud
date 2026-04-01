'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  getDashboardStats,
  getDispatchJobs,
  assignDriverToJob,
  autoAssignJobs,
  processBooking,
  logActiveTipper,
  processWeightLog,
  searchCustomers,
  getCustomerTimeline,
  markJobPaid,
  cancelBooking,
  generateReport,
  getSkipUtilization,
  getLorries,
} from '@/lib/api'
import { DEFAULT_CONFIG, SKIP_SIZES, WB_SIZES } from '@/lib/config'
import toast, { Toaster } from 'react-hot-toast'
import {
  LayoutDashboard,
  Truck,
  Weight,
  CalendarPlus,
  Users,
  FileText,
  Wrench,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertTriangle,
  Package,
  TrendingUp,
  ChevronRight,
  Zap,
  X,
  Search,
  DollarSign,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = 'dashboard' | 'dispatch' | 'weighbridge' | 'bookings' | 'customers' | 'reports' | 'fleet' | 'inventory'

interface DashStats {
  stats: { completedToday: number; completedWeek: number; futureBookings: number; tipsToday: number }
  inventorySummary: any[]
  activeTippers: any[]
  unpaidInvoices: any[]
  driverHours: any[]
  collections: any[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) { return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
function today() { return new Date().toISOString().split('T')[0] }
function tomorrow() {
  const d = new Date(); d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function KpiCard({ label, value, icon, color = 'text-primary' }: { label: string; value: string | number; icon: React.ReactNode; color?: string }) {
  return (
    <div className="bg-slate-900 border border-white/5 rounded-xl p-5 flex items-center gap-4">
      <div className={`${color} shrink-0`}>{icon}</div>
      <div>
        <p className="text-2xl font-black tracking-tight text-white">{value}</p>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{label}</p>
      </div>
    </div>
  )
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

// ─── Dashboard Tab ───────────────────────────────────────────────────────────

function DashboardTab({ data, onRefresh }: { data: DashStats | null; onRefresh: () => void }) {
  if (!data) return <div className="flex items-center justify-center h-64 text-slate-500 text-sm">Loading dashboard...</div>

  const totalUnpaid = data.unpaidInvoices.reduce((s: number, i: any) => s + (i.outstanding || 0), 0)

  return (
    <div className="space-y-8">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Completed Today" value={data.stats.completedToday} icon={<CheckCircle size={24} />} />
        <KpiCard label="Completed This Week" value={data.stats.completedWeek} icon={<TrendingUp size={24} />} />
        <KpiCard label="Future Bookings" value={data.stats.futureBookings} icon={<CalendarPlus size={24} />} color="text-blue-400" />
        <KpiCard label="Tips Today" value={data.stats.tipsToday} icon={<Weight size={24} />} color="text-yellow-400" />
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

// ─── Dispatch Tab ─────────────────────────────────────────────────────────────

function DispatchTab() {
  const [jobs, setJobs] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [dispatchDate, setDispatchDate] = useState(tomorrow())
  const [loading, setLoading] = useState(false)

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

  const unassigned = jobs.filter(j => !j.driver_name)
  const assigned = jobs.filter(j => j.driver_name)

  return (
    <div className="space-y-6">
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
        <button onClick={load} className="mt-5 flex items-center gap-2 bg-slate-800 border border-white/10 text-white px-4 py-2 rounded text-sm hover:bg-slate-700">
          <RefreshCw size={14} /> Refresh
        </button>
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
            {unassigned.map((job: any) => (
              <div key={job.id} className="bg-slate-900 border border-yellow-500/20 rounded-xl p-4 flex flex-wrap items-center gap-4">
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
            {assigned.map((job: any) => (
              <div key={job.id} className="bg-slate-900 border border-white/5 rounded-xl p-4 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge label={job.status} color={statusColor(job.status)} />
                    <Badge label={job.job_type} color="bg-slate-700 text-slate-300" />
                    <Badge label={job.skip_size + 'yd'} color="bg-slate-700 text-slate-300" />
                  </div>
                  <p className="text-white font-bold mt-1">{job.customer_name}</p>
                  <p className="text-slate-400 text-xs">{job.address}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-primary font-bold text-sm">{job.driver_name}</span>
                  <select
                    className="bg-slate-800 border border-white/10 text-white px-2 py-1.5 rounded text-xs"
                    value={job.driver_name ?? ''}
                    onChange={e => handleAssign(job.id, e.target.value)}
                  >
                    <option value="">Unassign</option>
                    {drivers.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Weighbridge Tab ──────────────────────────────────────────────────────────

function WeighbridgeTab() {
  const [tippers, setTippers] = useState<any[]>([])
  const [lorries, setLorries] = useState<any[]>([])
  const [liveWeight, setLiveWeight] = useState<number | null>(null)
  const [form, setForm] = useState({
    lorryReg: '', customerName: '', wasteType: 'Mix Con', grossWeight: '',
    tareWeight: '', skipSize: '8', skipId: '', address: '', direction: 'IN',
    paymentMethod: 'Invoice', amountPaid: '', wbNotes: '', tipperRowIndex: ''
  })
  const [logMode, setLogMode] = useState<'full' | 'tipper'>('tipper')

  useEffect(() => {
    loadData()
    const ch = supabase.channel('wb').on('postgres_changes', { event: '*', schema: 'public', table: 'active_tippers' }, loadData).subscribe()
    const wbCh = supabase.channel('wb-readings').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'weighbridge_readings' }, (p) => {
      setLiveWeight(p.new.weight_kg)
    }).subscribe()
    return () => { supabase.removeChannel(ch); supabase.removeChannel(wbCh) }
  }, [])

  async function loadData() {
    const [{ data: t }, { data: l }] = await Promise.all([
      supabase.from('active_tippers').select('*').order('timestamp', { ascending: false }),
      supabase.from('lorries').select('*').order('registration'),
    ])
    setTippers(t ?? [])
    setLorries(l ?? [])
  }

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  function loadFromTipper(t: any) {
    setForm(f => ({
      ...f,
      lorryReg: t.reg,
      customerName: t.customer_name,
      wasteType: t.waste_type,
      grossWeight: String(t.gross_weight || ''),
      skipSize: t.skip_size,
      skipId: t.skip_id || '',
      address: t.address,
      tipperRowIndex: t.id,
      direction: 'OUT',
    }))
    setLogMode('full')
  }

  async function handleLogTipper() {
    const result = await logActiveTipper({
      lorryReg: form.lorryReg, customerName: form.customerName,
      wasteType: form.wasteType, grossWeight: Number(form.grossWeight),
      address: form.address, skipSize: form.skipSize, skipId: form.skipId,
    })
    result.success ? toast.success(result.message) : toast.error(result.message)
  }

  async function handleProcessWeight() {
    const net = Math.abs(Number(form.grossWeight) - Number(form.tareWeight))
    const wasteRate = DEFAULT_CONFIG.pricesWaste[form.wasteType] || 0
    const costNet = (net / 1000) * wasteRate
    const result = await processWeightLog({
      lorryReg: form.lorryReg, customerName: form.customerName,
      wasteType: form.wasteType, grossWeight: Number(form.grossWeight),
      tareWeight: Number(form.tareWeight), skipSize: form.skipSize,
      skipId: form.skipId, address: form.address, direction: form.direction,
      costNet, paymentMethod: form.paymentMethod,
      amountPaid: form.amountPaid ? Number(form.amountPaid) : 0,
      wbNotes: form.wbNotes, tipperRowIndex: form.tipperRowIndex,
    })
    result.success ? toast.success(result.message) : toast.error(result.message)
    if (result.success) {
      setForm(f => ({ ...f, lorryReg: '', customerName: '', grossWeight: '', tareWeight: '', skipId: '', amountPaid: '', wbNotes: '', tipperRowIndex: '' }))
      setLogMode('tipper')
    }
  }

  const net = Number(form.grossWeight) - Number(form.tareWeight)
  const estCostNet = (Math.abs(net) / 1000) * (DEFAULT_CONFIG.pricesWaste[form.wasteType] || 0)

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      {/* Holding Pen */}
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-slate-900 border border-white/5 rounded-xl p-5">
          <SectionHeader title={`Holding Pen (${tippers.length})`} />
          {tippers.length === 0 && <p className="text-slate-500 text-sm">No trucks in yard</p>}
          <div className="space-y-2">
            {tippers.map((t: any) => (
              <button key={t.id} onClick={() => loadFromTipper(t)}
                className="w-full text-left bg-slate-800 hover:bg-slate-700 border border-white/5 hover:border-primary/50 rounded-lg p-3 transition-all">
                <div className="flex justify-between">
                  <span className="font-black text-white">{t.reg}</span>
                  <ChevronRight size={14} className="text-primary" />
                </div>
                <p className="text-xs text-slate-400">{t.customer_name} · {t.waste_type} · {t.skip_size}</p>
              </button>
            ))}
          </div>
        </div>

        {liveWeight !== null && (
          <div className="bg-slate-900 border border-primary/20 rounded-xl p-5 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Live Scale</p>
            <p className="text-4xl font-black text-primary">{liveWeight.toLocaleString()} kg</p>
          </div>
        )}
      </div>

      {/* Log Form */}
      <div className="lg:col-span-3 bg-slate-900 border border-white/5 rounded-xl p-5">
        <div className="flex gap-2 mb-6">
          {(['tipper', 'full'] as const).map(m => (
            <button key={m} onClick={() => setLogMode(m)}
              className={`px-4 py-1.5 rounded text-xs font-black uppercase tracking-widest transition-all ${logMode === m ? 'bg-primary text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
              {m === 'tipper' ? 'Log Truck IN' : 'Process Weight'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Lorry Reg', key: 'lorryReg', type: 'text' },
            { label: 'Customer', key: 'customerName', type: 'text' },
          ].map(({ label, key, type }) => (
            <div key={key}>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">{label}</label>
              <input type={type} value={(form as any)[key]} onChange={e => set(key, e.target.value)}
                className="w-full bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm focus:border-primary outline-none" />
            </div>
          ))}

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Waste Type</label>
            <select value={form.wasteType} onChange={e => set('wasteType', e.target.value)}
              className="w-full bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm">
              {Object.keys(DEFAULT_CONFIG.pricesWaste).map(w => <option key={w}>{w}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Skip Size</label>
            <select value={form.skipSize} onChange={e => set('skipSize', e.target.value)}
              className="w-full bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm">
              {WB_SIZES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Gross Weight (kg)</label>
            <input type="number" value={form.grossWeight} onChange={e => set('grossWeight', e.target.value)}
              className="w-full bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm focus:border-primary outline-none" />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Skip ID</label>
            <input type="text" value={form.skipId} onChange={e => set('skipId', e.target.value)}
              className="w-full bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm focus:border-primary outline-none" />
          </div>

          {logMode === 'full' && (
            <>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Tare Weight (kg)</label>
                <input type="number" value={form.tareWeight} onChange={e => set('tareWeight', e.target.value)}
                  className="w-full bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm focus:border-primary outline-none" />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Direction</label>
                <select value={form.direction} onChange={e => set('direction', e.target.value)}
                  className="w-full bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm">
                  <option>IN</option><option>OUT</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Payment</label>
                <select value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)}
                  className="w-full bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm">
                  <option>Invoice</option><option>Cash</option><option>Card</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Amount Paid (£)</label>
                <input type="number" value={form.amountPaid} onChange={e => set('amountPaid', e.target.value)}
                  className="w-full bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm focus:border-primary outline-none" />
              </div>

              <div className="col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Notes</label>
                <input type="text" value={form.wbNotes} onChange={e => set('wbNotes', e.target.value)}
                  className="w-full bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm focus:border-primary outline-none" />
              </div>

              {form.grossWeight && form.tareWeight && (
                <div className="col-span-2 bg-slate-800 rounded-lg p-4 flex gap-8">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-widest">Net Weight</p>
                    <p className="text-xl font-black text-white">{Math.abs(net).toLocaleString()} kg</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-widest">Est. Net Cost</p>
                    <p className="text-xl font-black text-primary">{fmt(estCostNet)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-widest">Est. Gross</p>
                    <p className="text-xl font-black text-white">{fmt(estCostNet * 1.2)}</p>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="col-span-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Address</label>
            <input type="text" value={form.address} onChange={e => set('address', e.target.value)}
              className="w-full bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm focus:border-primary outline-none" />
          </div>
        </div>

        <button
          onClick={logMode === 'tipper' ? handleLogTipper : handleProcessWeight}
          className="mt-6 w-full bg-primary hover:bg-primary-dark text-white py-3 rounded font-black uppercase tracking-widest text-sm transition-all">
          {logMode === 'tipper' ? 'Log Truck IN' : 'Process & Issue Ticket'}
        </button>
      </div>
    </div>
  )
}

// ─── Bookings Tab ─────────────────────────────────────────────────────────────

function BookingsTab() {
  const [form, setForm] = useState({
    customerName: '', phone: '', address: '', skipSize: '8',
    jobType: 'Delivery', deliveryDate: tomorrow(), paymentMethod: 'Invoice',
    deliveryComments: '', permitCheck: false, permitWeeks: 1,
  })
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [searchTimer, setSearchTimer] = useState<any>(null)

  function set(k: string, v: any) { setForm(f => ({ ...f, [k]: v })) }

  function handleNameChange(v: string) {
    set('customerName', v)
    clearTimeout(searchTimer)
    if (v.length > 2) {
      setSearchTimer(setTimeout(async () => {
        const results = await searchCustomers(v)
        setSuggestions(results)
      }, 300))
    } else {
      setSuggestions([])
    }
  }

  function selectSuggestion(c: any) {
    setForm(f => ({ ...f, customerName: c.name, phone: c.phone || '', address: c.billing_address || '' }))
    setSuggestions([])
  }

  async function handleBook() {
    if (!form.customerName || !form.address || !form.deliveryDate) {
      toast.error('Fill in customer, address, and date')
      return
    }
    setLoading(true)
    try {
      const skipPrice = DEFAULT_CONFIG.pricesSkip[form.skipSize] || 0
      const result = await processBooking({
        ...form,
        calculatedPrice: String(skipPrice),
        permitWeeks: form.permitWeeks,
      })
      result.success ? toast.success(result.message) : toast.error(result.message)
      if (result.success) {
        setForm(f => ({ ...f, customerName: '', phone: '', address: '', deliveryComments: '' }))
      }
    } catch (e: any) {
      toast.error(e.message)
    }
    setLoading(false)
  }

  const skipNet = DEFAULT_CONFIG.pricesSkip[form.skipSize] || 0
  const skipGross = skipNet * 1.2

  return (
    <div className="max-w-2xl">
      <div className="bg-slate-900 border border-white/5 rounded-xl p-6 space-y-5">
        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">New Booking</h3>

        {/* Customer Name with autocomplete */}
        <div className="relative">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Customer Name</label>
          <input
            type="text" value={form.customerName} onChange={e => handleNameChange(e.target.value)}
            className="w-full bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm focus:border-primary outline-none"
            placeholder="Start typing to search..."
          />
          {suggestions.length > 0 && (
            <div className="absolute z-10 w-full bg-slate-800 border border-white/10 rounded-lg mt-1 shadow-xl">
              {suggestions.map((c: any) => (
                <button key={c.id} onClick={() => selectSuggestion(c)}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-700 text-sm text-white flex justify-between">
                  <span>{c.name}</span>
                  <span className="text-slate-500">{c.phone}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Phone</label>
            <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
              className="w-full bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm focus:border-primary outline-none" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Job Type</label>
            <select value={form.jobType} onChange={e => set('jobType', e.target.value)}
              className="w-full bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm">
              {['Delivery', 'Collection', 'Exchange', 'Wait & Load', 'Cage Load'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Address</label>
          <input type="text" value={form.address} onChange={e => set('address', e.target.value)}
            className="w-full bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm focus:border-primary outline-none" />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Skip Size</label>
            <select value={form.skipSize} onChange={e => set('skipSize', e.target.value)}
              className="w-full bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm">
              {SKIP_SIZES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Date</label>
            <input type="date" value={form.deliveryDate} onChange={e => set('deliveryDate', e.target.value)}
              className="w-full bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Payment</label>
            <select value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)}
              className="w-full bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm">
              {['Invoice', 'Cash', 'Card', 'BACS'].map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Comments</label>
          <input type="text" value={form.deliveryComments} onChange={e => set('deliveryComments', e.target.value)}
            className="w-full bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm focus:border-primary outline-none"
            placeholder="Access notes, gate codes..." />
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
            <input type="checkbox" checked={form.permitCheck} onChange={e => set('permitCheck', e.target.checked)}
              className="accent-primary" />
            Permit Required
          </label>
          {form.permitCheck && (
            <select value={form.permitWeeks} onChange={e => set('permitWeeks', Number(e.target.value))}
              className="bg-slate-800 border border-white/10 text-white px-3 py-1.5 rounded text-sm">
              {[1, 2, 3, 4].map(w => <option key={w} value={w}>{w} week{w > 1 ? 's' : ''}</option>)}
            </select>
          )}
        </div>

        {/* Price preview */}
        <div className="bg-slate-800 rounded-lg p-4 flex gap-8">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-widest">Net</p>
            <p className="text-xl font-black text-white">{fmt(skipNet)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-widest">Gross (inc VAT)</p>
            <p className="text-xl font-black text-primary">{fmt(skipGross)}</p>
          </div>
          {form.permitCheck && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-widest">Permit</p>
              <p className="text-xl font-black text-yellow-400">
                {fmt(DEFAULT_CONFIG.permitAdminFee + DEFAULT_CONFIG.permitWeeklyFee * form.permitWeeks)}
              </p>
            </div>
          )}
        </div>

        <button onClick={handleBook} disabled={loading}
          className="w-full bg-primary hover:bg-primary-dark text-white py-3 rounded font-black uppercase tracking-widest text-sm transition-all disabled:opacity-50">
          {loading ? 'Booking...' : 'Book Job'}
        </button>
      </div>
    </div>
  )
}

// ─── Customers Tab ────────────────────────────────────────────────────────────

function CustomersTab() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [timeline, setTimeline] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSearch() {
    if (query.length < 2) return
    setLoading(true)
    const data = await searchCustomers(query)
    setResults(data)
    setTimeline(null)
    setLoading(false)
  }

  async function loadTimeline(customerName: string) {
    setLoading(true)
    const data = await getCustomerTimeline(customerName)
    setTimeline(data)
    setResults([])
    setLoading(false)
  }

  async function handleMarkPaid(id: string, source: 'Orders' | 'CashLog') {
    await markJobPaid(id, source)
    toast.success('Marked as paid')
    loadTimeline(timeline.customer)
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <input
          type="text" value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Search customer name..."
          className="flex-1 bg-slate-900 border border-white/10 text-white px-4 py-2 rounded-lg text-sm focus:border-primary outline-none"
        />
        <button onClick={handleSearch} className="flex items-center gap-2 bg-primary text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-primary-dark">
          <Search size={16} /> Search
        </button>
        {timeline && (
          <button onClick={() => { setTimeline(null); setResults([]) }} className="text-slate-400 hover:text-white px-3 py-2 rounded-lg bg-slate-800">
            <X size={16} />
          </button>
        )}
      </div>

      {loading && <p className="text-slate-500 text-sm">Searching...</p>}

      {/* Search results */}
      {results.length > 0 && (
        <div className="bg-slate-900 border border-white/5 rounded-xl overflow-hidden">
          {results.map((c: any) => (
            <button key={c.id} onClick={() => loadTimeline(c.name)}
              className="w-full text-left px-5 py-4 hover:bg-slate-800 border-b border-white/5 flex justify-between items-center transition-colors">
              <div>
                <p className="text-white font-bold">{c.name}</p>
                <p className="text-xs text-slate-500">{c.phone} · {c.billing_address}</p>
              </div>
              <ChevronRight size={16} className="text-primary" />
            </button>
          ))}
        </div>
      )}

      {/* Customer Timeline */}
      {timeline && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-white/5 rounded-xl p-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Customer</p>
              <p className="text-lg font-black text-white">{timeline.customer}</p>
            </div>
            <div className="bg-slate-900 border border-white/5 rounded-xl p-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Total Spend</p>
              <p className="text-lg font-black text-primary">{fmt(timeline.totalSpend)}</p>
            </div>
            <div className="bg-slate-900 border border-white/5 rounded-xl p-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Outstanding</p>
              <p className={`text-lg font-black ${timeline.outstandingBalance > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {fmt(timeline.outstandingBalance)}
              </p>
            </div>
          </div>

          {/* Jobs */}
          {timeline.jobs?.length > 0 && (
            <div className="bg-slate-900 border border-white/5 rounded-xl p-5">
              <SectionHeader title={`Skip Jobs (${timeline.jobs.length})`} />
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {timeline.jobs.map((j: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm border-b border-white/5 pb-2">
                    <div>
                      <p className="text-white">{j.date} · {j.type} · {j.size}yd</p>
                      <p className="text-xs text-slate-500">{j.address}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-white">{fmt(j.amount)}</span>
                      {j.paid
                        ? <Badge label="Paid" color="bg-green-900/40 text-green-400" />
                        : <button onClick={() => handleMarkPaid(j.orderId, 'Orders')} className="text-xs font-bold text-yellow-400 hover:text-yellow-300">Mark Paid</button>
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tips */}
          {timeline.tips?.length > 0 && (
            <div className="bg-slate-900 border border-white/5 rounded-xl p-5">
              <SectionHeader title={`Weighbridge Tips (${timeline.tips.length})`} />
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {timeline.tips.map((t: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm border-b border-white/5 pb-2">
                    <div>
                      <p className="text-white">Ticket {t.ticket} · {t.wasteType}</p>
                      <p className="text-xs text-slate-500">{t.netWeight?.toLocaleString()} kg</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-white">{fmt(t.amount)}</span>
                      {t.paid
                        ? <Badge label="Paid" color="bg-green-900/40 text-green-400" />
                        : <Badge label="Unpaid" color="bg-red-900/40 text-red-400" />
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────

function ReportsTab() {
  const thisMonth = new Date().toISOString().slice(0, 7)
  const [startDate, setStartDate] = useState(`${thisMonth}-01`)
  const [endDate, setEndDate] = useState(today())
  const [loading, setLoading] = useState<string | null>(null)

  async function handleGenerate(type: string, label: string) {
    setLoading(type)
    try {
      const data = await generateReport(type, startDate, endDate)
      if (!data.length) { toast.error('No data for this period'); setLoading(null); return }

      // Convert to CSV
      const headers = Object.keys(data[0])
      const csv = [headers.join(','), ...data.map((r: any) => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `enviroworx_${type.toLowerCase()}_${startDate}_${endDate}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`${label} downloaded`)
    } catch (e: any) {
      toast.error(e.message)
    }
    setLoading(null)
  }

  const reports = [
    { type: 'SEPA', label: 'SEPA Report', desc: 'Waste transfer logs for Scottish Environment Protection Agency compliance' },
    { type: 'FINANCE', label: 'Finance Report', desc: 'Cash log with costs, payments, and outstanding balances' },
    { type: 'DRIVER_MANIFEST', label: 'Driver Manifest', desc: 'Completed jobs grouped by driver for payroll and operations review' },
    { type: 'ASSETS', label: 'Asset Report', desc: 'Current skip inventory — skips deployed to customers right now' },
  ]

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">From</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="w-full bg-slate-900 border border-white/10 text-white px-3 py-2 rounded text-sm" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">To</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="w-full bg-slate-900 border border-white/10 text-white px-3 py-2 rounded text-sm" />
        </div>
      </div>

      <div className="space-y-3">
        {reports.map(r => (
          <div key={r.type} className="bg-slate-900 border border-white/5 rounded-xl p-5 flex items-center justify-between gap-4">
            <div>
              <p className="font-black text-white">{r.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{r.desc}</p>
            </div>
            <button
              onClick={() => handleGenerate(r.type, r.label)}
              disabled={loading === r.type}
              className="shrink-0 flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded text-sm font-bold transition-all disabled:opacity-50">
              <FileText size={14} />
              {loading === r.type ? 'Generating...' : 'Download CSV'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Inventory Tab ────────────────────────────────────────────────────────────

function InventoryTab() {
  const [inventory, setInventory] = useState<any[]>([])
  const [filter, setFilter] = useState<'all' | 'Available' | 'In Use' | 'Damaged'>('all')
  const [sizeFilter, setSizeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('inventory').select('*').order('skip_id')
      setInventory(data ?? [])
      setLoading(false)
    }
    load()
    const ch = supabase.channel('inv').on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, async () => {
      const { data } = await supabase.from('inventory').select('*').order('skip_id')
      setInventory(data ?? [])
    }).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const sizes = [...new Set(inventory.map(s => s.skip_size).filter(Boolean))].sort()

  const filtered = inventory.filter(s => {
    if (filter !== 'all' && s.status !== filter) return false
    if (sizeFilter !== 'all' && s.skip_size !== sizeFilter) return false
    if (search && !s.skip_id?.toLowerCase().includes(search.toLowerCase()) &&
        !s.customer_name?.toLowerCase().includes(search.toLowerCase()) &&
        !s.delivery_address?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const counts = {
    all: inventory.length,
    Available: inventory.filter(s => s.status === 'Available').length,
    'In Use': inventory.filter(s => s.status === 'In Use' || s.status === 'Delivered').length,
    Damaged: inventory.filter(s => s.status === 'Damaged').length,
  }

  function statusBadge(status: string) {
    switch (status) {
      case 'Available': return 'bg-green-900/40 text-green-400'
      case 'In Use': case 'Delivered': return 'bg-blue-900/40 text-blue-400'
      case 'Damaged': return 'bg-red-900/40 text-red-400'
      default: return 'bg-slate-700 text-slate-400'
    }
  }

  function daysOut(dateStr: string | null) {
    if (!dateStr) return null
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        {(['all', 'Available', 'In Use', 'Damaged'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s as any)}
            className={`p-4 rounded-xl border text-left transition-all ${filter === s ? 'border-primary bg-primary/10' : 'border-white/5 bg-slate-900 hover:border-white/20'}`}>
            <p className="text-2xl font-black text-white">{counts[s]}</p>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{s === 'all' ? 'Total' : s}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search skip ID, customer, address..."
          className="flex-1 min-w-[200px] bg-slate-900 border border-white/10 text-white px-3 py-2 rounded-lg text-sm focus:border-primary outline-none" />
        <select value={sizeFilter} onChange={e => setSizeFilter(e.target.value)}
          className="bg-slate-900 border border-white/10 text-white px-3 py-2 rounded-lg text-sm">
          <option value="all">All sizes</option>
          {sizes.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? <p className="text-slate-500 text-sm">Loading inventory...</p> : (
        <div className="bg-slate-900 border border-white/5 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left">
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-500">Skip ID</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-500">Size</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-500">Status</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-500">Customer</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-500">Address</th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-500">Days Out</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s: any) => {
                  const days = daysOut(s.delivery_date)
                  const overdue = days !== null && days > DEFAULT_CONFIG.demurrageDays
                  return (
                    <tr key={s.id} className={`border-b border-white/5 hover:bg-slate-800/50 transition-colors ${overdue ? 'bg-red-900/5' : ''}`}>
                      <td className="px-4 py-3 font-mono font-bold text-white">{s.skip_id}</td>
                      <td className="px-4 py-3 font-bold text-white">{s.skip_size}yd</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide ${statusBadge(s.status)}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{s.customer_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-400 max-w-[200px] truncate">{s.delivery_address || '—'}</td>
                      <td className="px-4 py-3">
                        {days !== null ? (
                          <span className={`font-bold ${overdue ? 'text-red-400' : days > 20 ? 'text-yellow-400' : 'text-slate-400'}`}>
                            {days}d {overdue ? '⚠️' : ''}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-slate-500">No skips match filters</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-white/5 text-xs text-slate-500 font-bold">
            Showing {filtered.length} of {inventory.length} skips
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Fleet Tab ────────────────────────────────────────────────────────────────

function FleetTab() {
  const [lorries, setLorries] = useState<any[]>([])
  const [issues, setIssues] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      const [lorryData, { data: issueData }] = await Promise.all([
        getLorries(),
        supabase.from('fleet_logs').select('*').eq('status', 'Open').order('created_at', { ascending: false }),
      ])
      setLorries(lorryData)
      setIssues(issueData ?? [])
    }
    load()
  }, [])

  function motStatus(dateStr: string | null) {
    if (!dateStr) return 'text-slate-500'
    const daysUntil = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
    if (daysUntil < 0) return 'text-red-400'
    if (daysUntil < 30) return 'text-yellow-400'
    return 'text-green-400'
  }

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Lorry Fleet */}
        <div className="bg-slate-900 border border-white/5 rounded-xl p-5">
          <SectionHeader title={`Fleet (${lorries.length} vehicles)`} />
          <div className="space-y-3">
            {lorries.map((l: any) => (
              <div key={l.id} className="border border-white/5 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-black text-white">{l.registration}</span>
                  <Badge label={l.status || 'Active'} color={l.status === 'Off Road' ? 'bg-red-900/40 text-red-400' : 'bg-green-900/40 text-green-400'} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">MOT: </span>
                    <span className={motStatus(l.mot_due)}>{l.mot_due || 'Unknown'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Tax: </span>
                    <span className={motStatus(l.tax_due)}>{l.tax_due || 'Unknown'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Open Issues */}
        <div className="bg-slate-900 border border-white/5 rounded-xl p-5">
          <SectionHeader title={`Open Issues (${issues.length})`} />
          {issues.length === 0
            ? <p className="text-slate-500 text-sm">No open issues</p>
            : <div className="space-y-3">
                {issues.map((iss: any) => (
                  <div key={iss.id} className="border border-red-500/20 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-white">{iss.lorry_reg}</span>
                      <Badge label={iss.issue_type} color="bg-red-900/40 text-red-400" />
                    </div>
                    <p className="text-sm text-slate-400">{iss.description}</p>
                    <p className="text-xs text-slate-500 mt-1">Reported by {iss.reported_by}</p>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>
    </div>
  )
}

// ─── Main Office Page ─────────────────────────────────────────────────────────

export default function OfficePage() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [dashData, setDashData] = useState<DashStats | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadDash = useCallback(async () => {
    setRefreshing(true)
    try {
      const data = await getDashboardStats()
      setDashData(data)
    } catch {
      toast.error('Failed to load dashboard')
    }
    setRefreshing(false)
  }, [])

  useEffect(() => {
    loadDash()
    // Auto-refresh every 2 minutes
    const interval = setInterval(loadDash, 120000)
    // Real-time: refresh dashboard on key table changes
    const ch = supabase.channel('office-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_tippers' }, loadDash)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, loadDash)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, loadDash)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cash_log' }, loadDash)
      .subscribe()
    return () => { clearInterval(interval); supabase.removeChannel(ch) }
  }, [loadDash])

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { id: 'dispatch', label: 'Dispatch', icon: <Truck size={16} /> },
    { id: 'weighbridge', label: 'Weighbridge', icon: <Weight size={16} /> },
    { id: 'bookings', label: 'New Booking', icon: <CalendarPlus size={16} /> },
    { id: 'customers', label: 'Customers', icon: <Users size={16} /> },
    { id: 'reports', label: 'Reports', icon: <FileText size={16} /> },
    { id: 'fleet', label: 'Fleet', icon: <Wrench size={16} /> },
    { id: 'inventory', label: 'Inventory', icon: <Package size={16} /> },
  ]

  const isConfigMissing = !process.env.NEXT_PUBLIC_SUPABASE_URL

  return (
    <div className="bg-slate-950 min-h-screen text-white">
      <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } }} />

      {/* Header */}
      <header className="border-b border-white/5 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto px-6 h-14 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-primary rounded flex items-center justify-center font-black italic text-xs">E</div>
            <span className="font-black italic tracking-tighter uppercase text-sm">Enviroworx <span className="text-primary">Office</span></span>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-1 overflow-x-auto">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-black uppercase tracking-wide transition-all whitespace-nowrap ${
                  tab === t.id ? 'bg-primary text-white' : 'text-slate-500 hover:text-white hover:bg-slate-800'
                }`}>
                {t.icon} {t.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {tab === 'dashboard' && (
              <button onClick={loadDash} disabled={refreshing}
                className={`flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors ${refreshing ? 'animate-spin' : ''}`}>
                <RefreshCw size={14} />
              </button>
            )}
            <div className="flex gap-2">
              <a href="/driver" target="_blank" className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-white px-2 py-1 rounded bg-slate-900 border border-white/5">Driver</a>
              <a href="/portal" target="_blank" className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-white px-2 py-1 rounded bg-slate-900 border border-white/5">Portal</a>
              <a href="/tablet" target="_blank" className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-white px-2 py-1 rounded bg-slate-900 border border-white/5">Tablet</a>
            </div>
          </div>
        </div>
      </header>

      {/* Config warning */}
      {isConfigMissing && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-6 py-3 text-center">
          <p className="text-yellow-400 text-xs font-bold">Supabase not configured — add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local</p>
        </div>
      )}

      {/* Content */}
      <main className="max-w-screen-2xl mx-auto px-6 py-8">
        {tab === 'dashboard' && <DashboardTab data={dashData} onRefresh={loadDash} />}
        {tab === 'dispatch' && <DispatchTab />}
        {tab === 'weighbridge' && <WeighbridgeTab />}
        {tab === 'bookings' && <BookingsTab />}
        {tab === 'customers' && <CustomersTab />}
        {tab === 'reports' && <ReportsTab />}
        {tab === 'fleet' && <FleetTab />}
        {tab === 'inventory' && <InventoryTab />}
      </main>
    </div>
  )
}
