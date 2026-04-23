'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { logActiveTipper, processWeightLog, getStoredTare, searchCustomers } from '@/lib/api'
import { geocodeAddress } from '@/app/actions/geo'
import { SectionHeader, fmt, DEFAULT_CONFIG, WB_SIZES } from './shared'
import { Weight, Clock, Truck, Package, RefreshCw, DollarSign, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
function WeighbridgeTab() {
  const [tippers, setTippers] = useState<any[]>([])
  const [lorries, setLorries] = useState<any[]>([])
  const [liveWeight, setLiveWeight] = useState<number | null>(null)
  const [tareMsg, setTareMsg] = useState('')
  const [manualOverride, setManualOverride] = useState('')
  const [form, setForm] = useState({
    lorryReg: '', customerName: '', wasteType: 'Mix Con', grossWeight: '',
    tareWeight: '', skipSize: 'Tipper', skipId: '', address: 'Yard', direction: 'On-site',
    paymentMethod: 'Invoice', amountPaid: '', wbNotes: '', tipperRowIndex: ''
  })
  const [logMode, setLogMode] = useState<'full' | 'tipper'>('tipper')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [searchTimer, setSearchTimer] = useState<any>(null)

  useEffect(() => {
    loadData()
    const ch = supabase.channel('wb').on('postgres_changes', { event: '*', schema: 'public', table: 'active_tippers' }, loadData).subscribe()
    const wbCh = supabase.channel('wb-readings').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'weighbridge_readings' }, (p) => {
      setLiveWeight((p.new as any).weight_kg)
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
    setForm(f => ({ ...f, customerName: c.name, address: c.billing_address || 'Yard' }))
    setSuggestions([])
  }

  async function fetchTare(reg: string, size: string) {
    if (!reg) { setTareMsg(''); return }
    setTareMsg('Checking...')
    const tare = await getStoredTare(reg, size)
    if (tare !== null) {
      setForm(f => ({ ...f, tareWeight: String(tare) }))
      setTareMsg('Auto-filled')
    } else {
      setTareMsg('No stored tare')
    }
  }

  function handleLorryChange(val: string) {
    set('lorryReg', val)
    fetchTare(val, form.skipSize)
  }

  function handleSizeChange(val: string) {
    set('skipSize', val)
    fetchTare(form.lorryReg, val)
  }

  function captureWeight(field: 'grossWeight' | 'tareWeight') {
    if (liveWeight !== null) {
      set(field, String(liveWeight))
      toast.success(`Captured ${liveWeight}kg`)
    }
  }

  function getWaitTime(timestamp: string) {
    const minutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000)
    if (minutes < 10) return { text: `${minutes}m wait`, color: 'text-emerald-400' }
    if (minutes < 20) return { text: `${minutes}m wait`, color: 'text-yellow-400' }
    return { text: `${minutes}m wait!`, color: 'text-red-400' }
  }

  function loadFromTipper(t: any) {
    setForm(f => ({
      ...f,
      lorryReg: t.reg,
      customerName: t.customer_name,
      wasteType: t.waste_type,
      grossWeight: String(t.gross_weight || ''),
      tareWeight: String(liveWeight || ''),
      skipSize: t.skip_size,
      skipId: t.skip_id || '',
      address: t.address || 'Yard',
      tipperRowIndex: t.id,
      direction: 'On-site',
    }))
    setManualOverride('')
    setLogMode('full')
    toast.success(`Loaded ${t.reg || 'Truck'}. Weight captured from scale.`)
  }
  async function handleLogTipper() {
    const weightToUse = form.grossWeight || String(liveWeight || 0)
    const result = await logActiveTipper({
      lorryReg: form.lorryReg, customerName: form.customerName,
      wasteType: form.wasteType, grossWeight: Number(weightToUse),
      address: form.address || 'Yard', skipSize: form.skipSize, skipId: form.skipId,
    })
    result.success ? toast.success(result.message) : toast.error(result.message)
    if (result.success) set('lorryReg', '')
  }

  async function handleProcessWeight() {
    const result = await processWeightLog({
      lorryReg: form.lorryReg, customerName: form.customerName,
      wasteType: form.wasteType, grossWeight: Number(form.grossWeight),
      tareWeight: Number(form.tareWeight), skipSize: form.skipSize,
      skipId: form.skipId, address: form.address || 'Yard', direction: form.direction,
      costNet: manualOverride !== '' ? Number(manualOverride) : undefined,
      paymentMethod: form.paymentMethod,
      amountPaid: form.amountPaid ? Number(form.amountPaid) : 0,
      wbNotes: form.wbNotes, tipperRowIndex: form.tipperRowIndex,
    })
    
    if (result.success) {
      toast.success((t) => (
        <div className="flex flex-col gap-2">
          <span>{result.message}</span>
          <button 
            onClick={() => {
              window.open(`/api/documents?type=WTN&ticketNumber=${(result as any).ticketNumber}`, '_blank')
              toast.dismiss(t.id)
            }}
            className="bg-white text-slate-900 px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-widest shadow-xl"
          >
            🖨️ Print Ticket
          </button>
        </div>
      ), { duration: 10000 })

      setForm(f => ({ ...f, lorryReg: '', customerName: '', grossWeight: '', tareWeight: '', skipId: '', amountPaid: '', wbNotes: '', tipperRowIndex: '' }))
      setManualOverride('')
      setTareMsg('')
      setLogMode('tipper')
    } else {
      toast.error(result.message)
    }
  }

  // Pricing calculation (matches legacy logic exactly)
  const gross = Number(form.grossWeight) || 0
  const tare = Number(form.tareWeight) || 0
  const net = Math.max(0, gross - tare)
  const isCage = form.skipSize?.toUpperCase() === 'CAGE'
  const isOwnFleet = !!form.lorryReg
  const wasteRate = DEFAULT_CONFIG.pricesWaste[form.wasteType] || 0
  let autoPrice = 0
  if (isCage) {
    autoPrice = 180 + (net / 1000) * wasteRate
  } else if (!isOwnFleet) {
    autoPrice = (net / 1000) * wasteRate
  }
  const displayPrice = manualOverride !== '' ? Number(manualOverride) : autoPrice
  const displayLabel = isOwnFleet && manualOverride === '' ? 'Pre-paid skip — £0.00' : fmt(displayPrice)

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      {/* Holding Pen */}
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-slate-900 border border-white/5 rounded-xl p-5">
          <SectionHeader title={`Holding Pen (${tippers.length})`} />
          {tippers.length === 0 && <p className="text-slate-500 text-sm">No trucks in yard</p>}
          <div className="space-y-2 mt-3">
            {tippers.map((t: any) => {
              const wait = getWaitTime(t.timestamp)
              return (
                <button key={t.id} onClick={() => loadFromTipper(t)}
                  className="w-full text-left bg-slate-800 hover:bg-slate-700 border border-white/5 hover:border-primary/50 rounded-lg p-3 transition-all group">
                  <div className="flex justify-between items-center">
                    <span className="font-black text-white">{t.reg || 'Manual'}</span>
                    <span className={`text-[10px] font-black uppercase tracking-tighter ${wait.color}`}>{wait.text}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{t.customer_name} · {t.waste_type}</p>
                  <div className="flex justify-between items-center mt-2 border-t border-white/5 pt-2">
                    <p className="text-[9px] text-slate-600 font-bold uppercase tracking-tighter">Entered {new Date(t.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
                    <ChevronRight size={12} className="text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {liveWeight !== null && (
          <div className="bg-slate-900 border border-primary/20 rounded-xl p-5 text-center group relative overflow-hidden">
            <div className="absolute inset-0 bg-primary/5 animate-pulse" />
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1 relative z-10">Live Scale</p>
            <p className="text-5xl font-black text-primary relative z-10">{liveWeight.toLocaleString()} <span className="text-xl">kg</span></p>
          </div>
        )}
      </div>

      {/* Log Form */}
      <div className="lg:col-span-3 bg-slate-900 border border-white/5 rounded-xl p-5 shadow-2xl">
        <div className="flex gap-2 mb-6">
          {(['tipper', 'full'] as const).map(m => (
            <button key={m} onClick={() => setLogMode(m)}
              className={`px-4 py-1.5 rounded text-xs font-black uppercase tracking-widest transition-all ${logMode === m ? 'bg-primary text-slate-900 shadow-lg shadow-primary/20' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
              {m === 'tipper' ? '1. Log Truck IN' : '2. Process Final Weight'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Lorry (Own Fleet)</label>
            <select value={form.lorryReg} onChange={e => handleLorryChange(e.target.value)}
              className="w-full bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm">
              <option value="">-- Manual / 3rd Party --</option>
              {lorries.map((l: any) => <option key={l.registration} value={l.registration}>{l.registration}</option>)}
            </select>
          </div>

          <div className="relative">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Customer / Site</label>
            <input type="text" value={form.customerName} onChange={e => handleNameChange(e.target.value)}
              className="w-full bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm focus:border-primary outline-none" />
            {suggestions.length > 0 && (
              <div className="absolute z-10 w-full bg-slate-800 border border-white/10 rounded-lg mt-1 shadow-2xl max-h-48 overflow-y-auto">
                {suggestions.map((c: any) => (
                  <button key={c.id} onClick={() => selectSuggestion(c)}
                    className="w-full text-left px-4 py-2 hover:bg-slate-700 text-sm text-white flex justify-between border-b border-white/5 group transition-colors">
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold truncate">{c.name}</span>
                        {c.updated_at && (
                          <span className="text-[8px] font-black uppercase tracking-tighter px-1 rounded bg-slate-900 text-slate-500 group-hover:text-slate-300">
                            Active {new Date(c.updated_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 shrink-0">{c.phone}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Waste Type</label>
            <select value={form.wasteType} onChange={e => set('wasteType', e.target.value)}
              className="w-full bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm">
              {Object.entries(DEFAULT_CONFIG.pricesWaste).map(([w, p]) => <option key={w} value={w}>{w} — £{p}/t</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Vehicle Size</label>
            <select value={form.skipSize} onChange={e => handleSizeChange(e.target.value)}
              className="w-full bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm">
              {WB_SIZES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <div className="flex justify-between items-end mb-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Gross (kg)</label>
              <button onClick={() => captureWeight('grossWeight')} className="text-[9px] font-black text-primary uppercase hover:underline">Capture Scale</button>
            </div>
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
                <div className="flex justify-between items-end mb-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tare (kg)</label>
                  <button onClick={() => captureWeight('tareWeight')} className="text-[9px] font-black text-primary uppercase hover:underline">Capture Scale</button>
                </div>
                <input type="number" value={form.tareWeight} onChange={e => { set('tareWeight', e.target.value); setTareMsg('') }}
                  className="w-full bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm focus:border-primary outline-none" />
                {tareMsg && <p className={`text-[10px] mt-1 ${tareMsg === 'Auto-filled' ? 'text-primary' : 'text-amber-400'}`}>{tareMsg}</p>}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Direction</label>
                <div className="grid grid-cols-2 gap-2">
                  {[{ val: 'On-site', label: '↓ IN' }, { val: 'Off-site', label: '↑ OUT' }].map(d => (
                    <button key={d.val} type="button" onClick={() => set('direction', d.val)}
                      className={`py-2 rounded text-[10px] font-black transition-all ${form.direction === d.val ? (d.val === 'On-site' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white') : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                      {d.label}
                    </button>
                  ))}
                </div>
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

              {(gross > 0 || tare > 0) && (
                <div className="col-span-2 bg-slate-800 border border-white/5 rounded-lg p-4 space-y-3 shadow-inner">
                  <div className="flex justify-between items-center border-b border-white/5 pb-3">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-black">Net Weight</p>
                      <p className="text-2xl font-black text-white">{net.toLocaleString()} <span className="text-xs">kg</span></p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-500 uppercase font-black">Total Cost</p>
                      <p className="text-2xl font-black text-primary">{displayLabel}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-[10px] text-slate-500 font-black uppercase whitespace-nowrap">Price Override (£)</label>
                    <input type="number" value={manualOverride} onChange={e => setManualOverride(e.target.value)}
                      placeholder="Auto" min="0" step="0.01"
                      className="w-full bg-slate-700 border border-white/10 text-white px-3 py-1.5 rounded text-sm focus:border-primary outline-none" />
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
          className="mt-6 w-full bg-primary hover:bg-primary-dark text-slate-900 py-4 rounded-xl font-black uppercase tracking-widest text-sm transition-all shadow-lg shadow-primary/10">
          {logMode === 'tipper' ? '1. Log Truck IN' : '2. Finish & Print Ticket'}
        </button>
      </div>
    </div>
  )
}

export default WeighbridgeTab
