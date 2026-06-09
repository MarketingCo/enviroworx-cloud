'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase-browser'
import { DEFAULT_CONFIG, WB_SIZES } from '@/lib/config'
import toast from 'react-hot-toast'
import { Weight, X } from 'lucide-react'
import { getStoredTareAction as getStoredTare } from '@/app/actions/office-data'
import { searchCustomersAction, getEwcCodesAction, generateWtnAction } from '@/app/actions/office-data'
import { logActiveTipperAction, processWeightLogAction } from '@/app/actions/operations'
import { SectionHeader } from './shared'

const BLANK = {
  lorryReg: '', customerName: '', wasteType: 'Mix Con', grossWeight: '',
  tareWeight: '', skipSize: 'Tipper', skipId: '', address: 'Yard',
  direction: 'On-site', paymentMethod: 'Invoice', amountPaid: '', wbNotes: '', tipperRowIndex: '',
}

export function WeighbridgeTab() {
  const [queued, setQueued] = useState<any[]>([])
  const [lorries, setLorries] = useState<any[]>([])
  const [liveWeight, setLiveWeight] = useState<number | null>(null)
  const [tareMsg, setTareMsg] = useState('')
  const [hasSotredTare, setHasStoredTare] = useState(false)
  const [manualPrice, setManualPrice] = useState('')
  const [ewcCodes, setEwcCodes] = useState<{ id: string; code: string; description: string }[]>([])
  const [selectedEwcId, setSelectedEwcId] = useState('')
  const [wtnGenerating, setWtnGenerating] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [form, setForm] = useState({ ...BLANK })
  const [suggestions, setSuggestions] = useState<any[]>([])
  const searchTimer = useRef<any>(null)

  useEffect(() => {
    load()
    getEwcCodesAction().then(setEwcCodes).catch(() => {})
    const queueCh = supabase.channel('wb-queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_tippers' }, load)
      .subscribe()
    const scaleCh = supabase.channel('wb-scale')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'weighbridge_readings' }, (p) => {
        setLiveWeight((p.new as any).weight_kg)
      })
      .subscribe()
    return () => { supabase.removeChannel(queueCh); supabase.removeChannel(scaleCh) }
  }, [])

  async function load() {
    const [{ data: q }, { data: l }] = await Promise.all([
      supabase.from('active_tippers').select('*').order('timestamp', { ascending: false }),
      supabase.from('lorries').select('*').order('registration'),
    ])
    setQueued(q ?? [])
    setLorries(l ?? [])
  }

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  function reset() {
    setForm({ ...BLANK })
    setManualPrice('')
    setTareMsg('')
    setHasStoredTare(false)
    setSelectedEwcId('')
    setSuggestions([])
  }

  function handleNameChange(v: string) {
    set('customerName', v)
    clearTimeout(searchTimer.current)
    if (v.length > 2) {
      searchTimer.current = setTimeout(async () => {
        const r = await searchCustomersAction(v).catch(() => [])
        setSuggestions(r)
      }, 300)
    } else {
      setSuggestions([])
    }
  }

  function selectCustomer(c: any) {
    setForm(f => ({ ...f, customerName: c.name, address: c.billing_address || 'Yard' }))
    setSuggestions([])
  }

  async function handleRegChange(v: string) {
    set('lorryReg', v)
    if (!v) { setTareMsg(''); setHasStoredTare(false); return }
    setTareMsg('Checking tare…')
    const t = await getStoredTare(v, form.skipSize)
    if (t !== null) {
      setForm(f => ({ ...f, lorryReg: v, tareWeight: String(t) }))
      setHasStoredTare(true)
      setTareMsg(`Tare auto-filled (${t.toLocaleString()} kg)`)
    } else {
      setHasStoredTare(false)
      setTareMsg('')
    }
  }

  async function handleSizeChange(v: string) {
    set('skipSize', v)
    if (!form.lorryReg) return
    const t = await getStoredTare(form.lorryReg, v)
    if (t !== null) {
      setForm(f => ({ ...f, skipSize: v, tareWeight: String(t) }))
      setHasStoredTare(true)
      setTareMsg(`Tare auto-filled (${t.toLocaleString()} kg)`)
    } else {
      setHasStoredTare(false)
      setTareMsg('')
    }
  }

  function captureScale(field: 'grossWeight' | 'tareWeight') {
    if (liveWeight !== null) {
      set(field, String(liveWeight))
      toast.success(`Captured ${liveWeight.toLocaleString()} kg`)
    } else {
      toast.error('No live weight on scale')
    }
  }

  // Load a queued truck (pre-fills gross, they've come back from tipping → need tare)
  function loadQueued(t: any) {
    setForm(f => ({
      ...f,
      lorryReg: t.reg, customerName: t.customer_name, wasteType: t.waste_type,
      grossWeight: String(t.gross_weight || ''), skipSize: t.skip_size,
      skipId: t.skip_id || '', address: t.address || 'Yard', tipperRowIndex: t.id,
    }))
    setManualPrice('')
    setHasStoredTare(false)
    setTareMsg('Vehicle back from tipping — capture outgoing weight as tare')
    toast.success(`${t.reg || t.customer_name} loaded — capture tare weight`)
  }

  // Stage 1 for two-weighing flow: park the truck while it tips
  async function parkWhileTipping() {
    if (!form.lorryReg) { toast.error('Enter vehicle reg'); return }
    if (!form.customerName) { toast.error('Enter customer name'); return }
    if (!form.grossWeight && liveWeight === null) { toast.error('Capture incoming weight first'); return }
    const gross = form.grossWeight || String(liveWeight || 0)
    const r = await logActiveTipperAction({
      lorryReg: form.lorryReg, customerName: form.customerName, wasteType: form.wasteType,
      grossWeight: Number(gross), address: form.address || 'Yard',
      skipSize: form.skipSize, skipId: form.skipId,
    }) as any
    if (r?.success) {
      toast.success(`${form.lorryReg} parked — gross ${Number(gross).toLocaleString()} kg saved. Weigh again when empty.`)
      reset()
    } else {
      toast.error(r?.message || 'Failed to park')
    }
  }

  async function handleWeighAndTicket() {
    if (!form.lorryReg) { toast.error('Enter vehicle reg'); return }
    if (!form.customerName) { toast.error('Enter customer name'); return }
    if (!form.grossWeight) { toast.error('Capture or enter gross weight'); return }
    if (!form.tareWeight) { toast.error('Capture or enter tare weight'); return }

    setProcessing(true)
    const selectedEwc = ewcCodes.find(e => e.id === selectedEwcId)
    const result = await processWeightLogAction({
      lorryReg: form.lorryReg, customerName: form.customerName, wasteType: form.wasteType,
      grossWeight: Number(form.grossWeight), tareWeight: Number(form.tareWeight),
      skipSize: form.skipSize, skipId: form.skipId || undefined,
      address: form.address || 'Yard', direction: form.direction,
      costNet: manualPrice !== '' ? Number(manualPrice) : undefined,
      paymentMethod: form.paymentMethod,
      amountPaid: form.amountPaid ? Number(form.amountPaid) : 0,
      wbNotes: form.wbNotes, tipperRowIndex: form.tipperRowIndex,
      ewcCodeId: selectedEwcId || undefined, ewcCode: selectedEwc?.code || undefined,
    }) as any
    setProcessing(false)

    if (result?.success) {
      const wlId = result.weightLogId
      toast.success((t) => (
        <div className="flex flex-col gap-2">
          <span className="font-bold">✅ Ticket {result.ticketNumber} — {net.toLocaleString()} kg net</span>
          <div className="flex gap-2">
            <button onClick={() => { window.open(`/api/documents?type=WTN&ticketNumber=${result.ticketNumber}`, '_blank'); toast.dismiss(t.id) }}
              className="bg-emerald-500 text-white px-3 py-1.5 rounded text-xs font-black uppercase hover:bg-emerald-600">
              🖨️ Print Ticket
            </button>
            {wlId && (
              <button
                onClick={async () => {
                  setWtnGenerating(wlId)
                  try { const wtn = await generateWtnAction(wlId); window.open(`/api/documents/wtn?id=${wtn.id}`, '_blank') }
                  catch { toast.error('WTN failed') }
                  setWtnGenerating(null); toast.dismiss(t.id)
                }}
                disabled={wtnGenerating === wlId}
                className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-black uppercase hover:bg-blue-500 disabled:opacity-50">
                {wtnGenerating === wlId ? '…' : '📄 WTN'}
              </button>
            )}
          </div>
        </div>
      ), { duration: 15000 })
      reset()
    } else {
      toast.error(result?.message || 'Failed to process')
    }
  }

  const gross = Number(form.grossWeight) || 0
  const tare = Number(form.tareWeight) || 0
  const net = Math.max(0, gross - tare)
  const isCage = form.skipSize?.toUpperCase() === 'CAGE'
  const isSkipSize = /^\d/.test(form.skipSize)
  const autoPrice = isCage
    ? 180 + (net / 1000) * (DEFAULT_CONFIG.pricesWaste[form.wasteType] || 0)
    : (net / 1000) * (DEFAULT_CONFIG.pricesWaste[form.wasteType] || 0)
  const effectivePrice = manualPrice !== '' ? Number(manualPrice) : autoPrice
  const cashPayment = ['Cash', 'Card'].includes(form.paymentMethod)

  // Determine which flow mode we're in
  const hasGross = gross > 0
  const hasTare = tare > 0
  const readyToProcess = hasGross && hasTare

  return (
    <div className="max-w-xl mx-auto space-y-4">

      {/* Live scale — always at top when active */}
      {liveWeight !== null && (
        <div className="bg-slate-900 border border-primary/40 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Weight size={18} className="text-primary" />
            <span className="text-xs font-black uppercase tracking-widest text-slate-500">Scale Reading</span>
          </div>
          <span className="text-3xl font-black text-primary">{liveWeight.toLocaleString()} <span className="text-base">kg</span></span>
        </div>
      )}

      {/* Queue strip — trucks parked mid-tip */}
      {queued.length > 0 && (
        <div className="bg-slate-900 border border-white/5 rounded-xl p-4">
          <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Trucks tipping on site ({queued.length}) — click to load when back on scale</p>
          <div className="flex flex-wrap gap-2">
            {queued.map(t => {
              const mins = Math.floor((Date.now() - new Date(t.timestamp).getTime()) / 60000)
              return (
                <button key={t.id} onClick={() => loadQueued(t)}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-primary hover:text-slate-900 border border-white/5 hover:border-primary rounded-lg px-3 py-2 transition-all group">
                  <span className="font-black text-sm text-white group-hover:text-slate-900">{t.reg || t.customer_name}</span>
                  <span className={`text-xs font-black uppercase ${mins >= 20 ? 'text-red-400' : 'text-yellow-400'} group-hover:text-slate-700`}>{mins}m</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Main form */}
      <div className="bg-slate-900 border border-white/5 rounded-xl p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Weighbridge</h3>
          <button onClick={reset} className="text-xs font-black text-slate-600 hover:text-red-400 uppercase tracking-widest transition-colors flex items-center gap-1">
            <X size={10} /> Clear
          </button>
        </div>

        {/* Vehicle reg */}
        <div>
          <label className={`text-xs font-bold uppercase tracking-widest block mb-1 ${!form.lorryReg ? 'text-amber-400' : 'text-slate-500'}`}>
            Vehicle Reg
          </label>
          <div className="flex gap-2">
            <input type="text" value={form.lorryReg}
              onChange={e => handleRegChange(e.target.value.toUpperCase())}
              placeholder="SN68 VYL, van reg, trailer…"
              className={`flex-1 bg-slate-800 border ${!form.lorryReg ? 'border-amber-500/40' : 'border-white/10'} text-white px-3 py-2.5 rounded text-sm font-mono focus:border-primary outline-none uppercase`} />
            <select onChange={e => { if (e.target.value) handleRegChange(e.target.value) }}
              className="w-24 bg-slate-800 border border-white/10 text-white px-2 py-2 rounded text-xs font-bold uppercase">
              <option value="">Fleet</option>
              {lorries.map((l: any) => <option key={l.registration} value={l.registration}>{l.registration}</option>)}
            </select>
          </div>
        </div>

        {/* Customer */}
        <div className="relative">
          <label className={`text-xs font-bold uppercase tracking-widest block mb-1 ${!form.customerName ? 'text-amber-400' : 'text-slate-500'}`}>
            Customer / Site
          </label>
          <input type="text" value={form.customerName}
            onChange={e => handleNameChange(e.target.value)}
            placeholder="Search customers…"
            className={`w-full bg-slate-800 border ${!form.customerName ? 'border-amber-500/40' : 'border-white/10'} text-white px-3 py-2.5 rounded text-sm focus:border-primary outline-none`} />
          {suggestions.length > 0 && (
            <div className="absolute z-50 w-full bg-slate-800 border border-white/20 rounded-lg mt-1 shadow-[0_20px_50px_rgba(0,0,0,0.6)] max-h-52 overflow-y-auto">
              {suggestions.map((c: any) => (
                <button key={c.id} onClick={() => selectCustomer(c)}
                  className="w-full text-left px-4 py-2.5 hover:bg-primary hover:text-slate-900 text-sm text-white flex justify-between border-b border-white/5 transition-all">
                  <span className="font-black">{c.name}</span>
                  <span className="text-xs opacity-50">{c.phone}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Waste type + EWC */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Waste Type</label>
            <select value={form.wasteType} onChange={e => set('wasteType', e.target.value)}
              className="w-full bg-slate-800 border border-white/10 text-white px-3 py-2.5 rounded text-sm">
              {Object.entries(DEFAULT_CONFIG.pricesWaste).map(([w, p]) => (
                <option key={w} value={w}>{w} — £{p}/t</option>
              ))}
            </select>
          </div>
          <div>
            <label className={`text-xs font-bold uppercase tracking-widest block mb-1 ${!selectedEwcId ? 'text-amber-400' : 'text-slate-500'}`}>EWC Code</label>
            <select value={selectedEwcId} onChange={e => setSelectedEwcId(e.target.value)}
              className={`w-full bg-slate-800 border ${selectedEwcId ? 'border-white/10' : 'border-amber-500/40'} text-white px-3 py-2.5 rounded text-sm`}>
              <option value="">Select…</option>
              {ewcCodes.map(e => <option key={e.id} value={e.id}>{e.code}</option>)}
            </select>
          </div>
        </div>

        {/* Vehicle type + direction */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Vehicle Type</label>
            <select value={form.skipSize} onChange={e => handleSizeChange(e.target.value)}
              className="w-full bg-slate-800 border border-white/10 text-white px-3 py-2.5 rounded text-sm">
              {WB_SIZES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Direction</label>
            <div className="grid grid-cols-2 gap-1.5">
              {[{ val: 'On-site', label: '↓ IN' }, { val: 'Off-site', label: '↑ OUT' }].map(d => (
                <button key={d.val} type="button" onClick={() => set('direction', d.val)}
                  className={`py-2.5 rounded text-xs font-black transition-all ${form.direction === d.val
                    ? d.val === 'On-site' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── WEIGHING SECTION ── */}
        {/* Context-aware: if tare is stored, just show gross. If not, show both with clear labels. */}
        <div className={`grid gap-3 ${hasSotredTare ? 'grid-cols-1' : 'grid-cols-2'}`}>

          {/* GROSS — always shown */}
          <div className={`${hasGross ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-slate-800/40 border-white/10'} border rounded-lg p-3 transition-all`}>
            <div className="flex justify-between items-center mb-2">
              <div>
                <p className={`text-[11px] font-black uppercase tracking-widest ${hasGross ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {hasSotredTare ? 'Gross Weight (kg)' : '① Incoming — vehicle LOADED'}
                </p>
                {!hasSotredTare && !hasGross && (
                  <p className="text-[11px] text-slate-500 mt-0.5">Capture when vehicle arrives on scale</p>
                )}
              </div>
              <button onClick={() => captureScale('grossWeight')}
                className="text-xs font-black text-primary uppercase hover:underline whitespace-nowrap">
                ⚡ Capture
              </button>
            </div>
            <input type="number" value={form.grossWeight} onChange={e => set('grossWeight', e.target.value)}
              placeholder="0"
              className={`w-full bg-transparent border-0 text-2xl font-black text-white outline-none placeholder:text-slate-700`} />
          </div>

          {/* TARE — hidden if auto-filled from stored values */}
          {!hasSotredTare && (
            <div className={`${hasTare ? 'bg-blue-900/20 border-blue-500/30' : 'bg-slate-800/40 border-white/10'} border rounded-lg p-3 transition-all`}>
              <div className="flex justify-between items-center mb-2">
                <div>
                  <p className={`text-[11px] font-black uppercase tracking-widest ${hasTare ? 'text-blue-400' : 'text-slate-500'}`}>
                    ② Outgoing — vehicle EMPTY
                  </p>
                  {!hasTare && (
                    <p className="text-[11px] text-slate-500 mt-0.5">Capture when vehicle returns from tipping</p>
                  )}
                </div>
                <button onClick={() => captureScale('tareWeight')}
                  className="text-xs font-black text-primary uppercase hover:underline whitespace-nowrap">
                  ⚡ Capture
                </button>
              </div>
              <input type="number" value={form.tareWeight} onChange={e => { set('tareWeight', e.target.value); setTareMsg('') }}
                placeholder="0"
                className="w-full bg-transparent border-0 text-2xl font-black text-white outline-none placeholder:text-slate-700" />
            </div>
          )}
        </div>

        {/* Tare status message */}
        {tareMsg && (
          <p className={`text-xs font-bold ${hasSotredTare ? 'text-emerald-400' : 'text-amber-400'}`}>{tareMsg}</p>
        )}

        {/* Net weight + cost — live */}
        {readyToProcess && (
          <div className="bg-slate-800/60 border border-white/5 rounded-lg px-4 py-3 flex justify-between items-center">
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Net Weight</p>
              <p className="text-xl font-black text-white">{net.toLocaleString()} <span className="text-xs">kg</span></p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Tonnage</p>
              <p className="text-xl font-black text-slate-300">{(net / 1000).toFixed(3)} t</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Cost</p>
              <p className="text-xl font-black text-primary">£{effectivePrice.toFixed(2)}</p>
            </div>
          </div>
        )}

        {/* Skip ID — only for skip-sized vehicles */}
        {isSkipSize && (
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Skip ID (optional)</label>
            <input type="text" value={form.skipId} onChange={e => set('skipId', e.target.value)}
              placeholder="8-001, 14-023…"
              className="w-full bg-slate-800 border border-white/10 text-white px-3 py-2.5 rounded text-sm focus:border-primary outline-none" />
          </div>
        )}

        {/* Payment */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Payment</label>
            <select value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)}
              className="w-full bg-slate-800 border border-white/10 text-white px-3 py-2.5 rounded text-sm">
              <option>Invoice</option><option>Cash</option><option>Card</option>
            </select>
          </div>
          {cashPayment && (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Amount Paid (£)</label>
              <input type="number" value={form.amountPaid} onChange={e => set('amountPaid', e.target.value)}
                className="w-full bg-slate-800 border border-white/10 text-white px-3 py-2.5 rounded text-sm focus:border-primary outline-none" />
            </div>
          )}
        </div>

        {/* Notes + price override */}
        <div className="space-y-2">
          <input type="text" value={form.wbNotes} onChange={e => set('wbNotes', e.target.value)}
            placeholder="Notes (optional)…"
            className="w-full bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm focus:border-primary outline-none text-slate-300 placeholder:text-slate-600" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-600 font-black uppercase tracking-widest whitespace-nowrap">Price override £</span>
            <input type="number" value={manualPrice} onChange={e => setManualPrice(e.target.value)}
              placeholder="Auto"
              className="w-28 bg-slate-800 border border-white/10 text-white px-3 py-1.5 rounded text-sm focus:border-primary outline-none" />
          </div>
        </div>

        {/* Buttons — adapt to flow state */}
        <div className="space-y-2 pt-1">
          {/* Main action — changes based on what's been captured */}
          {!readyToProcess && !hasSotredTare && hasGross ? (
            // Gross captured, no tare yet — offer to park while tipping
            <button onClick={parkWhileTipping}
              className="w-full py-4 rounded-xl font-black uppercase tracking-widest text-sm transition-all shadow-xl bg-amber-500 text-slate-900 shadow-amber-500/20 hover:scale-[1.01]">
              🚛 Truck Tipping — Park & Return for Outgoing Weight
            </button>
          ) : (
            <button onClick={handleWeighAndTicket} disabled={processing}
              className="w-full py-4 rounded-xl font-black uppercase tracking-widest text-sm transition-all shadow-xl bg-primary text-slate-900 shadow-primary/20 hover:scale-[1.01] disabled:opacity-60 disabled:hover:scale-100">
              {processing ? 'Processing…' : '⚖️ Weigh & Print Ticket'}
            </button>
          )}

          {/* If gross captured and they want to park manually */}
          {hasGross && !readyToProcess && hasSotredTare === false && (
            <button onClick={parkWhileTipping}
              className="w-full py-2 text-xs font-black uppercase tracking-widest text-slate-600 hover:text-slate-400 transition-colors">
              or park in queue while tipping →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
