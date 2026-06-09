'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { DEFAULT_CONFIG, SKIP_SIZES, WB_SIZES } from '@/lib/config'
import toast from 'react-hot-toast'
import { searchCustomersAction } from '@/app/actions/office-data'
import { processBookingAction } from '@/app/actions/operations'
import AddressAutocomplete from '@/components/AddressAutocomplete'

import { fmt, today, tomorrow, KpiCard, SectionHeader, Badge, statusColor } from './shared'

export function BookingsTab() {
  const [form, setForm] = useState({
    customerName: '', phone: '', address: '', skipSize: '8',
    jobType: 'Delivery', deliveryDate: tomorrow(), paymentMethod: 'Invoice',
    deliveryComments: '', permitCheck: false, permitWeeks: 1,
    latitude: null as number | null, longitude: null as number | null
  })
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const searchTimerRef = useRef<any>(null)
  function set(k: string, v: any) { setForm(f => ({ ...f, [k]: v })) }

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
    const isOverLimit = (c.account_balance || 0) > (DEFAULT_CONFIG.creditLimit || 500)
    setForm(f => ({ ...f, customerName: c.name, phone: c.phone || '', address: c.billing_address || '' }))
    setSuggestions([])
    if (isOverLimit) {
      toast.error(`CREDIT WARNING: ${c.name} has a balance of ${fmt(c.account_balance)}`, { duration: 6000, icon: '⚠️' })
    }
  }

  async function handleBook() {
    if (!form.customerName || !form.address || !form.deliveryDate) {
      toast.error('Fill in customer, address, and date')
      return
    }
    setLoading(true)
    try {
      const skipPrice = DEFAULT_CONFIG.pricesSkip[form.skipSize] || 0
      const result = await processBookingAction({
        ...form,
        calculatedPrice: String(skipPrice),
        permitWeeks: form.permitWeeks,
        latitude: form.latitude,
        longitude: form.longitude
      } as any)
      result.success ? toast.success(result.message) : toast.error(result.message)
      if (result.success) {
        setForm(f => ({ ...f, customerName: '', phone: '', address: '', deliveryComments: '', latitude: null, longitude: null }))
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
            <div className="absolute z-50 w-full bg-slate-800 border border-white/20 rounded-lg mt-1 shadow-[0_20px_50px_rgba(0,0,0,0.5)] max-h-64 overflow-y-auto">
              {suggestions.map((c: any) => (
                <button key={c.id} onClick={() => selectSuggestion(c)}
                  className="w-full text-left px-4 py-3 hover:bg-primary hover:text-slate-900 text-sm text-white flex justify-between border-b border-white/5 group transition-all">
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-black truncate">{c.name}</span>
                      {c.updated_at && (
                        <span className="text-[10px] font-black uppercase tracking-tighter px-1 rounded bg-slate-950 text-slate-500 group-hover:bg-white/20 group-hover:text-slate-900">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs opacity-60 truncate">{c.billing_address || 'No address'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-xs font-black ${c.account_balance > (DEFAULT_CONFIG.creditLimit || 500) ? 'text-red-400' : 'text-slate-400'}`}>
                      {fmt(c.account_balance || 0)}
                    </span>
                  </div>
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
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">
            Address (Scotland Central Belt)
          </label>
          <AddressAutocomplete
            value={form.address}
            onChange={(address) => set('address', address)}
            onResolved={(r) => {
              setForm((f) => ({
                ...f,
                address: r.address,
                latitude: r.lat,
                longitude: r.lng,
              }))
              toast.success('Address selected')
            }}
            verified={!!form.latitude}
            placeholder="Start typing street address..."
            className={`w-full bg-slate-800 border ${form.latitude ? 'border-emerald-500/50' : 'border-white/10'} text-white px-3 py-2 rounded text-sm focus:border-primary outline-none transition-colors`}
          />
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
