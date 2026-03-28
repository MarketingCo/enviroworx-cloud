'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getDashboardStats, getDispatchJobs, assignDriverToJob, processBooking, processWeightLog, searchCustomers, markJobPaid, cancelBooking, updateBooking, autoAssignJobs, logActiveTipper, getStoredTare, getLiveScaleWeight } from '@/lib/api'
import { DEFAULT_CONFIG, SKIP_SIZES, WB_SIZES } from '@/lib/config'
import toast from 'react-hot-toast'

// ============================================================
// MAIN OFFICE DASHBOARD (replaces Page.html)
// ============================================================

type Tab = 'dispatch' | 'booking' | 'weighbridge' | 'accounts' | 'collections' | 'reports'

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('dispatch')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [dispatchJobs, setDispatchJobs] = useState<any[]>([])
  const [dispatchDate, setDispatchDate] = useState(todayStr())
  const [drivers, setDrivers] = useState<any[]>([])
  const [lorries, setLorries] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<any[]>([])

  // ---- DATA FETCHING ----
  const fetchAll = useCallback(async () => {
    try {
      const [dashData, djobs, { data: drvs }, { data: lors }] = await Promise.all([
        getDashboardStats(),
        getDispatchJobs(dispatchDate),
        supabase.from('drivers').select('*').order('name'),
        supabase.from('lorries').select('*').order('registration'),
      ])
      setData(dashData)
      setDispatchJobs(djobs)
      setDrivers(drvs ?? [])
      setLorries(lors ?? [])
      setLoading(false)
    } catch (e: any) {
      toast.error('Data load error: ' + e.message)
      setLoading(false)
    }
  }, [dispatchDate])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ---- REALTIME SUBSCRIPTIONS ----
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_tippers' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => fetchAll())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchAll])

  // ---- CUSTOMER SEARCH ----
  useEffect(() => {
    if (customerSearch.length < 2) { setCustomerResults([]); return }
    const timer = setTimeout(async () => {
      const results = await searchCustomers(customerSearch)
      setCustomerResults(results)
    }, 200)
    return () => clearTimeout(timer)
  }, [customerSearch])

  if (loading) return <LoadingScreen />

  const config = DEFAULT_CONFIG
  const stats = data?.stats ?? { completedToday: 0, completedWeek: 0, futureBookings: 0, tipsToday: 0 }
  const inventory = data?.inventorySummary ?? []
  const tippers = data?.activeTippers ?? []
  const unpaid = data?.unpaidInvoices ?? []
  const collections = data?.collections ?? []
  const driverHours = data?.driverHours ?? []

  const unassigned = dispatchJobs.filter(j => !j.driver_name && ['Booked', 'Aborted'].includes(j.status))
  const driverHoursMap = Object.fromEntries(driverHours.map((d: any) => [d.driver_name, d.hours_today]))

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* NAVBAR */}
      <nav className="bg-gradient-to-r from-emerald-900 to-emerald-700 text-white px-8 py-4 flex justify-between items-center shadow-sm">
        <div className="text-2xl font-extrabold flex items-center gap-3">
          ♻️ ENVIROWORX HUB
          <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full ml-2">Cloud</span>
        </div>
        <button onClick={fetchAll} className="bg-amber-500 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-amber-600 transition">
          ↻ Refresh
        </button>
      </nav>

      {/* STATS BANNER */}
      <div className="flex gap-5 bg-white px-6 py-4 border-b border-gray-200 shadow-sm">
        <StatCard value={stats.completedToday} label="Jobs Completed Today" color="text-emerald-600" />
        <StatCard value={stats.completedWeek} label="Completed This Week" color="text-sky-600" />
        <StatCard value={stats.tipsToday} label="Yard Tips Today" color="text-amber-500" />
        <StatCard value={stats.futureBookings} label="Future Bookings" color="text-violet-600" />
      </div>

      {/* MAIN CONTENT */}
      <div className="flex flex-1 p-4 gap-4 min-h-0">
        {/* SIDEBAR - Inventory */}
        <div className="w-72 bg-white rounded-2xl p-5 shadow-sm border border-gray-200 flex flex-col overflow-y-auto flex-shrink-0">
          <h3 className="font-bold text-gray-800 mb-3">PREDICTIVE STOCK</h3>
          <div className="space-y-2 flex-1">
            {inventory.map((inv: any) => {
              const booked = dispatchJobs.filter(j => j.skip_size === inv.skip_size && ['Delivery', 'Exchange'].includes(j.job_type) && j.date === todayStr()).length
              const returning = dispatchJobs.filter(j => j.skip_size === inv.skip_size && ['Collection', 'Exchange'].includes(j.job_type) && j.date === todayStr()).length
              const net = inv.available + returning - booked
              const bgColor = net < 0 ? 'bg-red-50 border-red-200' : net === 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'
              return (
                <div key={inv.skip_size} className={`p-2 px-3 rounded-xl border flex justify-between items-center ${bgColor}`}>
                  <span className="font-bold text-lg">{inv.skip_size}yd</span>
                  <div className="text-right text-xs text-gray-500">
                    Yard: <b>{inv.available}</b><br />
                    <span className="text-emerald-600">+{returning} In</span> | <span className="text-red-500">-{booked} Out</span><br />
                    <span className={`font-bold text-sm ${net < 0 ? 'text-red-600' : 'text-black'}`}>Net: {net}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* WORKSPACE */}
        <div className="flex-1 bg-white rounded-2xl p-6 shadow-sm border border-gray-200 flex flex-col overflow-y-auto">
          {/* TABS */}
          <div className="flex gap-3 mb-6 border-b-2 border-gray-100 pb-2 flex-wrap flex-shrink-0">
            {(['dispatch', 'booking', 'weighbridge', 'accounts', 'collections', 'reports'] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition ${tab === t ? 'bg-emerald-100 text-emerald-700 shadow-inner ring-1 ring-emerald-300' : 'text-gray-500 hover:bg-gray-50'}`}>
                {t === 'dispatch' ? '🚚 Smart Dispatch' :
                 t === 'booking' ? '📅 Book Job' :
                 t === 'weighbridge' ? '⚖️ Weighbridge' :
                 t === 'accounts' ? '💰 Accounts' :
                 t === 'collections' ? '⚠️ Collections' : '📊 Reports'}
              </button>
            ))}
          </div>

          {/* TAB CONTENT */}
          {tab === 'dispatch' && (
            <DispatchTab
              jobs={dispatchJobs}
              unassigned={unassigned}
              drivers={drivers}
              driverHoursMap={driverHoursMap}
              date={dispatchDate}
              onDateChange={setDispatchDate}
              onAssign={async (orderId, driverName, driverId) => {
                await assignDriverToJob(orderId, driverName, driverId)
                toast.success(driverName ? 'Assigned' : 'Unassigned')
                fetchAll()
              }}
              onAutoAssign={async () => {
                const result = await autoAssignJobs(dispatchDate)
                toast.success(result.message)
                fetchAll()
              }}
              config={config}
            />
          )}

          {tab === 'booking' && (
            <BookingTab
              customerSearch={customerSearch}
              setCustomerSearch={setCustomerSearch}
              customerResults={customerResults}
              config={config}
              onBook={async (form) => {
                const result = await processBooking(form)
                toast.success(result.message)
                fetchAll()
              }}
            />
          )}

          {tab === 'weighbridge' && (
            <WeighbridgeTab
              lorries={lorries}
              tippers={tippers}
              config={config}
              onLogIn={async (form) => {
                const result = await logActiveTipper(form)
                toast.success(result.message)
                fetchAll()
              }}
              onLogOut={async (form) => {
                const result = await processWeightLog(form)
                toast.success(result.message)
                fetchAll()
              }}
            />
          )}

          {tab === 'accounts' && (
            <AccountsTab unpaid={unpaid} config={config} onMarkPaid={async (id, source) => {
              await markJobPaid(id, source)
              toast.success('Paid!')
              fetchAll()
            }} />
          )}

          {tab === 'collections' && (
            <CollectionsTab collections={collections} config={config} />
          )}

          {tab === 'reports' && <ReportsTab />}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex-1 text-center border-r border-gray-200 last:border-0">
      <div className={`text-3xl font-extrabold ${color}`}>{value}</div>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</div>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="text-center">
        <div className="text-4xl mb-4 animate-spin">♻️</div>
        <p className="text-gray-500 font-semibold">Loading Enviroworx Hub...</p>
      </div>
    </div>
  )
}

// ---- DISPATCH TAB ----
function DispatchTab({ jobs, unassigned, drivers, driverHoursMap, date, onDateChange, onAssign, onAutoAssign, config }: any) {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  return (
    <div className="flex flex-col flex-1">
      <div className="flex gap-2 mb-6 items-center">
        <button onClick={() => onDateChange(todayStr())}
          className={`px-5 py-2 rounded-lg font-semibold text-sm ${date === todayStr() ? 'bg-white shadow text-emerald-700' : 'text-gray-600 bg-gray-200'}`}>
          Today
        </button>
        <button onClick={() => onDateChange(tomorrowStr)}
          className={`px-5 py-2 rounded-lg font-semibold text-sm ${date === tomorrowStr ? 'bg-white shadow text-emerald-700' : 'text-gray-600 bg-gray-200'}`}>
          Tomorrow
        </button>
        <input type="date" value={date} onChange={e => onDateChange(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm font-semibold" />
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Unassigned Pool */}
        <div className="flex-1 bg-gray-50 rounded-2xl p-5 overflow-y-auto border border-gray-200">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold">Unassigned <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs">{unassigned.length}</span></h3>
            <button onClick={onAutoAssign} className="bg-violet-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-violet-600">
              🤖 Auto-Assign
            </button>
          </div>
          <div className="space-y-3">
            {unassigned.map((j: any) => (
              <JobCard key={j.id} job={j} drivers={drivers} onAssign={onAssign} />
            ))}
            {unassigned.length === 0 && <p className="text-gray-400 text-sm text-center py-8">All jobs assigned!</p>}
          </div>
        </div>

        {/* Driver Routes */}
        <div className="flex-1 bg-gray-50 rounded-2xl p-5 overflow-y-auto border border-gray-200">
          <h3 className="font-bold mb-3">Driver Routes</h3>
          {drivers.map((drv: any) => {
            const driverJobs = jobs.filter((j: any) => j.driver_name === drv.name && j.status !== 'Completed' && j.status !== 'Aborted')
            const hours = driverHoursMap[drv.name] || 0
            return (
              <div key={drv.id} className="mb-4">
                <div className="bg-white p-3 rounded-lg border border-gray-200 mb-2 flex justify-between items-center">
                  <span className="font-bold">{drv.name} <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{driverJobs.length} Jobs</span></span>
                  <span className={`text-xs ${hours > 8 ? 'text-red-600 font-bold' : 'text-gray-400'}`}>{hours.toFixed(1)}h logged</span>
                </div>
                <div className="space-y-2 ml-2">
                  {driverJobs.map((j: any) => (
                    <div key={j.id} className={`bg-white p-3 rounded-lg border border-gray-200 job-border-${j.job_type.toLowerCase().replace(/\s+/g, '')}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-bold">{j.job_type} ({j.skip_size}yd)</span>
                          <p className="text-sm text-gray-500 mt-1">{j.address}</p>
                          <p className="text-sm font-semibold">{j.customer_name}</p>
                        </div>
                        <button onClick={() => onAssign(j.id, '', null)} className="text-red-500 text-xs hover:bg-red-50 px-2 py-1 rounded">✕</button>
                      </div>
                      {j.delivery_comments && (
                        <div className="text-xs mt-2 text-amber-600 bg-amber-50 px-2 py-1 rounded">📝 {j.delivery_comments}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function JobCard({ job, drivers, onAssign }: any) {
  const [showAssign, setShowAssign] = useState(false)
  const postcode = (job.address?.match(/\b([A-Z]{1,2}\d{1,2})\b/i) || [])[1] || ''
  const borderClass = `job-border-${job.job_type.toLowerCase().replace(/\s+/g, '')}`

  return (
    <div className={`bg-white p-4 rounded-xl border border-gray-200 shadow-sm ${borderClass}`}>
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-bold">{job.job_type} ({job.skip_size}yd)
            {postcode && <span className="ml-2 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs">{postcode.toUpperCase()}</span>}
          </h4>
          {job.status === 'Aborted' && <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded mt-1 inline-block">ABORTED</span>}
        </div>
        <button onClick={() => setShowAssign(!showAssign)} className="bg-emerald-600 text-white px-3 py-1 rounded text-sm font-bold hover:bg-emerald-700">
          Assign →
        </button>
      </div>
      <p className="text-sm text-gray-500 mt-1">{job.address}</p>
      <p className="text-sm font-semibold">{job.customer_name}</p>
      {job.delivery_comments && <p className="text-xs text-amber-600 mt-1">📝 {job.delivery_comments}</p>}

      {showAssign && (
        <div className="mt-3 flex gap-2 flex-wrap">
          {drivers.map((d: any) => (
            <button key={d.id} onClick={() => { onAssign(job.id, d.name, d.id); setShowAssign(false) }}
              className="bg-gray-100 px-3 py-1 rounded-full text-sm font-semibold hover:bg-emerald-100 hover:text-emerald-700 transition">
              {d.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- BOOKING TAB ----
function BookingTab({ customerSearch, setCustomerSearch, customerResults, config, onBook }: any) {
  const [form, setForm] = useState({
    customerName: '', phone: '', address: '', skipSize: '8', jobType: 'Delivery',
    deliveryDate: todayStr(), paymentMethod: 'Invoice', deliveryComments: '',
    permitCheck: false, permitWeeks: 1,
  })
  const [submitting, setSubmitting] = useState(false)

  const update = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }))

  const skipPrice = config.pricesSkip[form.skipSize.replace(/\D/g, '')] || 0
  const permitCost = form.permitCheck ? config.permitAdminFee + (config.permitWeeklyFee * form.permitWeeks) : 0
  const netTotal = skipPrice + permitCost
  const grossTotal = netTotal * (1 + config.vatRate)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.customerName) return toast.error('Enter a customer name')
    setSubmitting(true)
    try {
      await onBook({ ...form, calculatedPrice: netTotal.toFixed(2) })
      setForm(f => ({ ...f, customerName: '', phone: '', address: '', deliveryComments: '' }))
      setCustomerSearch('')
    } catch (err: any) { toast.error(err.message) }
    setSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-3xl">
      <div className="grid grid-cols-2 gap-5">
        <div className="relative">
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Customer Name</label>
          <input type="text" value={customerSearch} onChange={e => { setCustomerSearch(e.target.value); update('customerName', e.target.value) }}
            className="w-full px-4 py-3 border rounded-xl" required />
          {customerResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white border rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto mt-1">
              {customerResults.map((c: any) => (
                <div key={c.id} className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b last:border-0"
                  onClick={() => { update('customerName', c.name); update('phone', c.phone || ''); setCustomerSearch(c.name); setCustomerResults([]) }}>
                  <strong>{c.name}</strong><br /><small className="text-gray-400">{c.phone}</small>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Phone</label>
          <input type="text" value={form.phone} onChange={e => update('phone', e.target.value)} className="w-full px-4 py-3 border rounded-xl" required />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Size</label>
          <select value={form.skipSize} onChange={e => update('skipSize', e.target.value)} className="w-full px-4 py-3 border rounded-xl">
            {SKIP_SIZES.map(s => <option key={s} value={s}>{s}yd</option>)}
            <option value="Cage">Cage</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Type</label>
          <select value={form.jobType} onChange={e => update('jobType', e.target.value)} className="w-full px-4 py-3 border rounded-xl">
            {['Delivery', 'Exchange', 'Collection', 'Wait & Load', 'Cage Load'].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Date</label>
          <input type="date" value={form.deliveryDate} onChange={e => update('deliveryDate', e.target.value)} className="w-full px-4 py-3 border rounded-xl" required />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Address</label>
        <input type="text" value={form.address} onChange={e => update('address', e.target.value)} className="w-full px-4 py-3 border rounded-xl" required />
      </div>

      {/* Price Box */}
      <div className="bg-gradient-to-r from-emerald-50 to-green-100 border border-emerald-200 rounded-2xl p-6 text-center">
        <div className="text-sm font-bold text-emerald-800 uppercase">Estimated Quote</div>
        <div className="text-4xl font-extrabold text-emerald-900 mt-2">£{grossTotal.toFixed(2)} <span className="text-sm">INC VAT</span></div>
        <label className="flex items-center gap-2 justify-center mt-3 text-sm text-emerald-700">
          <input type="checkbox" checked={form.permitCheck} onChange={e => update('permitCheck', e.target.checked)} className="rounded" />
          Council Permit Required?
        </label>
        {form.permitCheck && (
          <input type="number" min="1" value={form.permitWeeks} onChange={e => update('permitWeeks', parseInt(e.target.value) || 1)}
            className="mt-2 w-24 px-3 py-2 border border-emerald-300 rounded-lg text-center" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Payment</label>
          <select value={form.paymentMethod} onChange={e => update('paymentMethod', e.target.value)} className="w-full px-4 py-3 border rounded-xl">
            {['Invoice', 'Cash', 'Card'].map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Notes</label>
          <input type="text" value={form.deliveryComments} onChange={e => update('deliveryComments', e.target.value)}
            placeholder="e.g. AM Slot, Code 1234" className="w-full px-4 py-3 border rounded-xl" />
        </div>
      </div>

      <button type="submit" disabled={submitting}
        className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-emerald-700 disabled:opacity-50 transition">
        {submitting ? 'Saving...' : 'CONFIRM BOOKING'}
      </button>
    </form>
  )
}

// ---- WEIGHBRIDGE TAB ----
function WeighbridgeTab({ lorries, tippers, config, onLogIn, onLogOut }: any) {
  const [form, setForm] = useState({
    lorryReg: '', manualReg: '', skipSize: '', skipId: '', customerName: '',
    wasteType: 'TBC', grossWeight: '', tareWeight: '', address: 'Yard',
    direction: 'On-site', costNet: '', paymentMethod: 'Invoice',
    amountPaid: '', tylRef: '', wbNotes: '', tipperRowIndex: '',
  })

  const update = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }))

  const gross = parseFloat(form.grossWeight) || 0
  const tare = parseFloat(form.tareWeight) || 0
  const net = gross - tare
  const wastePrice = config.pricesWaste[form.wasteType] || 0
  const isInternal = form.lorryReg !== ''
  const isCage = form.skipSize?.toUpperCase() === 'CAGE'

  let costNet = form.costNet ? parseFloat(form.costNet) : 0
  if (!form.costNet) {
    if (isCage) costNet = 180 + ((Math.max(0, net) / 1000) * wastePrice)
    else if (!isInternal && net > 0) costNet = (net / 1000) * wastePrice
    else costNet = 0
  }
  const costGross = costNet * (1 + config.vatRate)

  const loadTipper = (t: any) => {
    const isInternalReg = lorries.some((l: any) => l.registration === t.reg)
    setForm(f => ({
      ...f,
      lorryReg: isInternalReg ? t.reg : '',
      manualReg: isInternalReg ? '' : t.reg,
      customerName: t.customer_name || '',
      wasteType: t.waste_type || 'TBC',
      grossWeight: t.gross_weight?.toString() || '',
      address: t.address || 'Yard',
      skipSize: t.skip_size || '',
      skipId: t.skip_id || '',
      tipperRowIndex: t.id,
      direction: 'Off-site',
    }))
    toast.success(`🚛 Loaded ${t.reg}`)
  }

  const fetchTare = async () => {
    const reg = form.lorryReg || form.manualReg
    if (!reg || !form.skipSize) return
    const tw = await getStoredTare(reg, form.skipSize)
    if (tw) { update('tareWeight', tw.toString()); toast.success(`Tare: ${tw}kg`) }
  }

  const fetchLiveWeight = async (target: 'grossWeight' | 'tareWeight') => {
    const reading = await getLiveScaleWeight()
    if (reading) {
      update(target, reading.weight_kg.toString())
      toast.success(`${reading.weight_kg}kg applied`)
    } else {
      toast.error('No recent weight found')
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Tippers in holding pen */}
      <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
        <h4 className="font-bold text-gray-800 mb-3">🚚 Trucks In Yard (Holding Pen)</h4>
        {tippers.length === 0 ? (
          <p className="text-gray-400 text-sm italic">No trucks currently in the holding pen.</p>
        ) : (
          <div className="space-y-2">
            {tippers.map((t: any) => (
              <div key={t.id} onClick={() => loadTipper(t)}
                className="bg-white p-3 rounded-lg border border-gray-200 border-l-4 border-l-amber-400 flex justify-between items-center cursor-pointer hover:translate-y-[-1px] transition">
                <div><strong className="text-amber-700">{t.reg}</strong> <span className="ml-2 text-amber-900 font-semibold">{t.customer_name}</span></div>
                <span className="text-sm text-amber-700">In at {new Date(t.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weighbridge Form */}
      <div className="grid grid-cols-3 gap-4 bg-gray-50 p-5 rounded-xl border border-gray-200">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Lorry Reg</label>
          <select value={form.lorryReg} onChange={e => { update('lorryReg', e.target.value); if (e.target.value) fetchTare() }} className="w-full px-3 py-3 border rounded-xl">
            <option value="">-- Manual / 3rd Party --</option>
            {lorries.map((l: any) => <option key={l.id} value={l.registration}>{l.registration}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Manual Reg</label>
          <input type="text" value={form.manualReg} onChange={e => update('manualReg', e.target.value)} disabled={!!form.lorryReg}
            className="w-full px-3 py-3 border rounded-xl disabled:opacity-50" placeholder="XY22 ABC" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Vehicle / Skip Size</label>
          <select value={form.skipSize} onChange={e => { update('skipSize', e.target.value); fetchTare() }} className="w-full px-3 py-3 border rounded-xl">
            <option value="">-- Select --</option>
            {WB_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Customer</label>
          <input type="text" value={form.customerName} onChange={e => update('customerName', e.target.value)} className="w-full px-3 py-3 border rounded-xl" required />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Waste Type</label>
          <select value={form.wasteType} onChange={e => update('wasteType', e.target.value)} className="w-full px-3 py-3 border rounded-xl">
            <option value="TBC">-- Select Waste --</option>
            {Object.keys(config.pricesWaste).map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Direction</label>
          <select value={form.direction} onChange={e => update('direction', e.target.value)} className="w-full px-3 py-3 border rounded-xl">
            <option value="On-site">IN (To Yard)</option>
            <option value="Off-site">OUT (Away)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="flex justify-between text-xs font-semibold text-gray-500 mb-1 uppercase">
            Gross (kg)
            <button type="button" onClick={() => fetchLiveWeight('grossWeight')} className="text-emerald-600 hover:underline">Get Live</button>
          </label>
          <input type="number" value={form.grossWeight} onChange={e => update('grossWeight', e.target.value)} className="w-full px-3 py-3 border rounded-xl" />
        </div>
        <div>
          <label className="flex justify-between text-xs font-semibold text-gray-500 mb-1 uppercase">
            Tare (kg)
            <button type="button" onClick={() => fetchLiveWeight('tareWeight')} className="text-amber-500 hover:underline">Get Live</button>
          </label>
          <input type="number" value={form.tareWeight} onChange={e => update('tareWeight', e.target.value)} className="w-full px-3 py-3 border rounded-xl" />
        </div>
      </div>

      {/* Price Box */}
      <div className="bg-gradient-to-r from-emerald-50 to-green-100 border border-emerald-200 rounded-2xl p-6 text-center">
        <div className="text-sm font-bold text-emerald-800 uppercase">Price To Pay</div>
        <div className="text-4xl font-extrabold text-emerald-900 mt-2">
          {isInternal && !form.costNet ? '£0.00' : `£${costNet.toFixed(2)}`}
          <span className="text-sm"> NET</span>
        </div>
        <div className="text-sm text-emerald-700 mt-1">
          + £{(costNet * config.vatRate).toFixed(2)} VAT = <strong>£{costGross.toFixed(2)} GROSS</strong>
        </div>
        <div className="mt-3 flex items-center justify-center gap-2">
          <label className="text-sm text-emerald-700 font-semibold">Manual Override (£):</label>
          <input type="number" value={form.costNet} onChange={e => update('costNet', e.target.value)}
            placeholder="Auto" className="w-28 px-3 py-2 border border-emerald-300 rounded-lg text-center" />
        </div>
      </div>

      <div className="flex gap-4">
        <button onClick={() => {
          const reg = form.lorryReg || form.manualReg
          if (!form.skipSize) return toast.error('Select a size')
          if (!reg) return toast.error('Enter a reg')
          onLogIn({ lorryReg: reg, customerName: form.customerName, wasteType: form.wasteType, grossWeight: gross, address: form.address, skipSize: form.skipSize, skipId: form.skipId })
        }} className="flex-1 bg-blue-500 text-white py-4 rounded-xl font-bold hover:bg-blue-600">
          Log IN (Holding Pen)
        </button>
        <button onClick={() => {
          const reg = form.lorryReg || form.manualReg
          if (!form.skipSize) return toast.error('Select a size')
          if (!reg) return toast.error('Enter a reg')
          if (form.wasteType === 'TBC') return toast.error('Select waste type')
          onLogOut({ ...form, lorryReg: reg, grossWeight: gross, tareWeight: tare, costNet: costNet || undefined, tipperRowIndex: form.tipperRowIndex || undefined })
        }} className="flex-[2] bg-amber-500 text-white py-4 rounded-xl font-bold hover:bg-amber-600">
          📤 Log OUT & Generate Doc
        </button>
      </div>
    </div>
  )
}

// ---- ACCOUNTS TAB ----
function AccountsTab({ unpaid, config, onMarkPaid }: any) {
  return (
    <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
      <h3 className="font-bold text-emerald-700 mb-4">💰 Pending Invoices</h3>
      <table className="w-full">
        <thead>
          <tr className="text-left text-xs font-semibold text-gray-500 uppercase border-b-2 border-gray-200">
            <th className="pb-3">Date</th><th className="pb-3">Customer</th><th className="pb-3">Job/ID</th><th className="pb-3">Address</th><th className="pb-3">Amount</th><th className="pb-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {unpaid.map((u: any) => {
            const skipSize = u.skip_size?.replace(/\D/g, '') ?? ''
            const netPrice = config.pricesSkip[skipSize] || 0
            const grossPrice = u.source === 'Orders' ? (netPrice * (1 + config.vatRate)) : (u.gross_cost || 0)
            return (
              <tr key={u.id} className="border-b border-gray-100">
                <td className="py-3 text-sm">{u.date}</td>
                <td className="py-3 font-semibold text-emerald-700">{u.customer_name}</td>
                <td className="py-3 text-sm">{u.skip_id || 'Tip'}</td>
                <td className="py-3 text-sm text-gray-500">{u.address}</td>
                <td className="py-3 font-bold">£{grossPrice.toFixed(2)}</td>
                <td className="py-3">
                  <button onClick={() => onMarkPaid(u.id, u.source)}
                    className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-emerald-700">
                    Mark Paid
                  </button>
                </td>
              </tr>
            )
          })}
          {unpaid.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-400">All invoices paid!</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

// ---- COLLECTIONS TAB ----
function CollectionsTab({ collections, config }: any) {
  return (
    <table className="w-full">
      <thead>
        <tr className="text-left text-xs font-semibold text-gray-500 uppercase border-b-2 border-gray-200">
          <th className="pb-3">ID</th><th className="pb-3">Customer</th><th className="pb-3">Address</th><th className="pb-3">Delivered</th><th className="pb-3">Days</th>
        </tr>
      </thead>
      <tbody>
        {collections.map((c: any) => (
          <tr key={c.skip_id} className="border-b border-gray-100">
            <td className="py-3 font-bold">{c.skip_id}</td>
            <td className="py-3 font-semibold text-emerald-700">{c.customer_name}</td>
            <td className="py-3 text-sm text-gray-500">{c.delivery_address}</td>
            <td className="py-3 text-sm">{c.delivery_date ? new Date(c.delivery_date).toLocaleDateString('en-GB') : ''}</td>
            <td className="py-3">
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${c.days_on_hire >= 14 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
                {c.days_on_hire}d
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ---- REPORTS TAB ----
function ReportsTab() {
  const [startDate, setStartDate] = useState(todayStr())
  const [endDate, setEndDate] = useState(todayStr())

  const downloadReport = async (type: string) => {
    toast.loading(`Generating ${type} report...`)
    try {
      const res = await fetch(`/api/reports?type=${type}&start=${startDate}&end=${endDate}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Enviroworx_${type}_${startDate}_to_${endDate}.csv`
      a.click()
      toast.dismiss()
      toast.success('Report downloaded!')
    } catch (err: any) {
      toast.dismiss()
      toast.error(err.message)
    }
  }

  return (
    <div className="bg-gray-50 p-8 rounded-2xl border border-gray-200 max-w-2xl">
      <h3 className="text-xl font-bold text-emerald-700 mb-6">📊 Business Intelligence & Compliance</h3>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Start Date</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-4 py-3 border rounded-xl" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">End Date</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-4 py-3 border rounded-xl" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => downloadReport('SEPA')} className="bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700">SEPA Waste Return</button>
        <button onClick={() => downloadReport('DRIVER_MANIFEST')} className="bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700">Driver Manifest</button>
        <button onClick={() => downloadReport('QUICKBOOKS')} className="bg-sky-600 text-white py-4 rounded-xl font-bold hover:bg-sky-700">QuickBooks Export</button>
        <button onClick={() => downloadReport('FINANCE')} className="bg-amber-500 text-white py-4 rounded-xl font-bold hover:bg-amber-600">Revenue / Cash Log</button>
      </div>
    </div>
  )
}

// Utility
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
