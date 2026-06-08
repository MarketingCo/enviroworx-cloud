'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { DEFAULT_CONFIG, SKIP_SIZES, WB_SIZES } from '@/lib/config'
import toast from 'react-hot-toast'
import KmlSyncButton from '@/components/KmlSyncButton'
import { LayoutDashboard, Truck, Weight, CalendarPlus, Users, FileText, Wrench, RefreshCw, CheckCircle, Clock, AlertTriangle, Package, TrendingUp, ChevronRight, Zap, X, Search, DollarSign, Settings, Trash2 } from 'lucide-react'
import { getStoredTare } from '@/lib/api'
import { searchCustomersAction, getEwcCodesAction, generateWtnAction } from '@/app/actions/office-data'
import { logActiveTipperAction, processWeightLogAction } from '@/app/actions/operations'

import { fmt, today, tomorrow, KpiCard, SectionHeader, Badge, statusColor } from './shared'

export function WeighbridgeTab() {
  const [tippers, setTippers] = useState<any[]>([])
  const [lorries, setLorries] = useState<any[]>([])
  const [liveWeight, setLiveWeight] = useState<number | null>(null)
  const [tareMsg, setTareMsg] = useState('')
  const [manualOverride, setManualOverride] = useState('')
  const [ewcCodes, setEwcCodes] = useState<{id:string;code:string;description:string}[]>([])
  const [selectedEwcId, setSelectedEwcId] = useState('')
  const [wtnGenerating, setWtnGenerating] = useState<string | null>(null)
  const [form, setForm] = useState({
    lorryReg: '', customerName: '', wasteType: 'Mix Con', grossWeight: '',
    tareWeight: '', skipSize: 'Tipper', skipId: '', address: 'Yard', direction: 'On-site',
    paymentMethod: 'Invoice', amountPaid: '', wbNotes: '', tipperRowIndex: ''
  })
  const [suggestions, setSuggestions] = useState<any[]>([])
  const searchTimerRef = useRef<any>(null)

  useEffect(() => {
    loadData()
    getEwcCodesAction().then(setEwcCodes).catch(() => {})
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
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (v.length > 2) {
      searchTimerRef.current = setTimeout(async () => {
        try {
          const results = await searchCustomersAction(v)
          setSuggestions(results)
        } catch {
          setSuggestions([])
        }
      }, 300)
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
    toast.success(`Loaded ${t.reg || 'Truck'} from yard. Ready to process.`)
  }
  async function handleLogTipper() {
    if (!form.lorryReg || !form.customerName) {
      toast.error('Registration and Customer Name are required', { icon: '⚠️' })
      return
    }
    const weightToUse = form.grossWeight || String(liveWeight || 0)
    const result = await logActiveTipperAction({
      lorryReg: form.lorryReg, customerName: form.customerName,
      wasteType: form.wasteType, grossWeight: Number(weightToUse),
      address: form.address || 'Yard', skipSize: form.skipSize, skipId: form.skipId,
    })
    
    if (result.success) {
      toast.success(result.message, { icon: '📥', duration: 4000 })
      // CRITICAL FIX: Reset the ENTIRE form so the next truck is a clean slate
      setForm({
        lorryReg: '', customerName: '', wasteType: 'Mix Con', grossWeight: '',
        tareWeight: '', skipSize: 'Tipper', skipId: '', address: 'Yard', direction: 'On-site',
        paymentMethod: 'Invoice', amountPaid: '', wbNotes: '', tipperRowIndex: ''
      })
      setManualOverride('')
      setSuggestions([])
    } else {
      toast.error(result.message)
    }
  }

  async function handleProcessWeight() {
    if (!form.lorryReg || !form.customerName || !form.grossWeight || !form.tareWeight) {
      toast.error('Missing required weights or details')
      return
    }
    const selectedEwc = ewcCodes.find(e => e.id === selectedEwcId)
    const result = await processWeightLogAction({
      lorryReg: form.lorryReg, customerName: form.customerName,
      wasteType: form.wasteType, grossWeight: Number(form.grossWeight),
      tareWeight: Number(form.tareWeight), skipSize: form.skipSize,
      skipId: form.skipId, address: form.address || 'Yard', direction: form.direction,
      costNet: manualOverride !== '' ? Number(manualOverride) : undefined,
      paymentMethod: form.paymentMethod,
      amountPaid: form.amountPaid ? Number(form.amountPaid) : 0,
      wbNotes: form.wbNotes, tipperRowIndex: form.tipperRowIndex,
      ewcCodeId: selectedEwcId || undefined,
      ewcCode: selectedEwc?.code || undefined,
    })
    
    if (result.success) {
      const wlId = (result as any).weightLogId
      toast.success((t) => (
        <div className="flex flex-col gap-2">
          <span className="font-bold">✅ {result.message}</span>
          <div className="flex gap-2">
            <button onClick={() => { window.open(`/api/documents?type=WTN&ticketNumber=${(result as any).ticketNumber}`, '_blank'); toast.dismiss(t.id) }}
              className="bg-emerald-500 text-white px-3 py-2 rounded text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all">
              🖨️ Print Ticket
            </button>
            {wlId && (
              <button
                onClick={async () => {
                  setWtnGenerating(wlId)
                  try { const wtn = await generateWtnAction(wlId); window.open(`/api/documents/wtn?id=${wtn.id}`, '_blank') }
                  catch { toast.error('WTN generation failed') }
                  setWtnGenerating(null); toast.dismiss(t.id)
                }}
                disabled={wtnGenerating === wlId}
                className="bg-blue-600 text-white px-3 py-2 rounded text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 disabled:opacity-50">
                {wtnGenerating === wlId ? '...' : '📄 WTN'}
              </button>
            )}
          </div>
        </div>
      ), { duration: 15000 })

      setForm({ lorryReg: '', customerName: '', grossWeight: '', tareWeight: '', skipId: '', amountPaid: '', wbNotes: '', tipperRowIndex: '', wasteType: 'Mix Con', skipSize: 'Tipper', address: 'Yard', direction: 'On-site', paymentMethod: 'Invoice' })
      setManualOverride('')
      setTareMsg('')
      setSelectedEwcId('')
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
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Weighbridge</h3>
          <button 
            onClick={() => {
              setForm({ lorryReg: '', customerName: '', wasteType: 'Mix Con', grossWeight: '', tareWeight: '', skipSize: 'Tipper', skipId: '', address: 'Yard', direction: 'On-site', paymentMethod: 'Invoice', amountPaid: '', wbNotes: '', tipperRowIndex: '' })
              setManualOverride('')
              setSuggestions([])
            }}
            className="text-[10px] font-black text-slate-500 hover:text-red-400 uppercase tracking-widest transition-colors"
          >
            Reset Form
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={`text-xs font-bold uppercase tracking-widest block mb-1 transition-colors ${!form.lorryReg ? 'text-amber-500' : 'text-slate-500'}`}>
              Registration {!form.lorryReg && ' *'}
            </label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={form.lorryReg} 
                onChange={e => set('lorryReg', e.target.value.toUpperCase())}
                placeholder="Type Reg..."
                className={`flex-1 bg-slate-800 border ${!form.lorryReg ? 'border-amber-500/50' : 'border-white/10'} text-white px-3 py-2 rounded text-sm focus:border-primary outline-none uppercase font-mono transition-all`} 
              />
              <select 
                value={lorries.some(l => l.registration === form.lorryReg) ? form.lorryReg : ''} 
                onChange={e => handleLorryChange(e.target.value)}
                className="w-24 bg-slate-800 border border-white/10 text-white px-2 py-2 rounded text-[10px] font-bold uppercase"
              >
                <option value="">FLEET</option>
                {lorries.map((l: any) => <option key={l.registration} value={l.registration}>{l.registration}</option>)}
              </select>
            </div>
          </div>

          <div className="relative">
            <label className={`text-xs font-bold uppercase tracking-widest block mb-1 transition-colors ${!form.customerName ? 'text-amber-500' : 'text-slate-500'}`}>
              Customer / Site {!form.customerName && ' *'}
            </label>
            <input type="text" value={form.customerName} onChange={e => handleNameChange(e.target.value)}
              placeholder="Search customers..."
              className={`w-full bg-slate-800 border ${!form.customerName ? 'border-amber-500/50' : 'border-white/10'} text-white px-3 py-2 rounded text-sm focus:border-primary outline-none transition-all`} />
            {suggestions.length > 0 && (
              <div className="absolute z-50 w-full bg-slate-800 border border-white/20 rounded-lg mt-1 shadow-[0_20px_50px_rgba(0,0,0,0.5)] max-h-64 overflow-y-auto">
                {suggestions.map((c: any) => (
                  <button key={c.id} onClick={() => selectSuggestion(c)}
                    className="w-full text-left px-4 py-3 hover:bg-primary hover:text-slate-900 text-sm text-white flex justify-between border-b border-white/5 group transition-all">
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="font-black truncate">{c.name}</span>
                        {c.updated_at && (
                          <span className="text-[8px] font-black uppercase tracking-tighter px-1 rounded bg-slate-950 text-slate-500 group-hover:bg-white/20 group-hover:text-slate-900">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] opacity-60 truncate">{c.billing_address || 'No address'}</p>
                    </div>
                    <span className="text-[10px] font-bold shrink-0 self-center opacity-40 group-hover:opacity-100">{c.phone}</span>
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
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">
              EWC Code <span className="text-slate-600 normal-case font-normal">(required for compliance)</span>
            </label>
            <select value={selectedEwcId} onChange={e => setSelectedEwcId(e.target.value)}
              className={`w-full bg-slate-800 border ${selectedEwcId ? 'border-emerald-500/50' : 'border-amber-500/30'} text-white px-3 py-2 rounded text-sm`}>
              <option value="">— Select EWC code —</option>
              {ewcCodes.map(e => <option key={e.id} value={e.id}>{e.code} — {e.description}</option>)}
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

          <div className="col-span-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Address</label>
            <input type="text" value={form.address} onChange={e => set('address', e.target.value)}
              className="w-full bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm focus:border-primary outline-none" />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={handleLogTipper}
            disabled={!form.lorryReg || !form.customerName}
            className="w-full py-3 rounded-xl font-black uppercase tracking-widest text-[11px] transition-all border border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            📥 Send to Yard
          </button>
          <button
            onClick={handleProcessWeight}
            disabled={!form.lorryReg || !form.customerName || !form.grossWeight || !form.tareWeight}
            className="w-full py-3 rounded-xl font-black uppercase tracking-widest text-[11px] transition-all shadow-lg bg-primary text-slate-900 shadow-primary/20 hover:scale-[1.02] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            📤 Process & Print Ticket
          </button>
        </div>
      </div>
    </div>
  )
}
