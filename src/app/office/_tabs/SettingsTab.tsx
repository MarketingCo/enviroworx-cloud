'use client'

import { useState, useEffect } from 'react'
import { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import {
  updateConfig,
  getCustomPricingList,
  addCustomPrice,
  deleteCustomPrice,
} from '@/lib/api'
import { DEFAULT_CONFIG, SKIP_SIZES } from '@/lib/config'
import toast from 'react-hot-toast'
import {
  Trash2,
} from 'lucide-react'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) { return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }

function SectionHeader({ title }: { title: string }) {
  return <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-3">{title}</h3>
}

// ─── Settings Tab ────────────────────────────────────────────────────────────

export default function SettingsTab() {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null)
  const [customRates, setCustomRates] = useState<Database["public"]["Tables"]["custom_pricing"]["Row"][]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [newRate, setNewRate] = useState({
    customer_name: '',
    skip_size: '8',
    waste_type: '',
    net_price: ''
  })

  async function load() {
    setLoading(true)
    const [{ data }, rates] = await Promise.all([
      supabase.from('config').select('*'),
      getCustomPricingList()
    ])
    const cfg: Record<string, unknown> = {}
    data?.forEach(row => { cfg[row.key] = row.value })
    setConfig(cfg)
    setCustomRates(rates)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSave(key: string, value: unknown) {
    setSaving(true)
    try {
      await updateConfig(key, value)
      toast.success('Settings updated')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      toast.error('Failed to update: ' + message)
    }
    setSaving(false)
  }

  async function handleAddRate() {
    if (!newRate.customer_name || !newRate.net_price) return toast.error('Customer and Price required')
    try {
      await addCustomPrice({
        customer_name: newRate.customer_name,
        skip_size: newRate.skip_size || undefined,
        waste_type: newRate.waste_type || undefined,
        net_price: Number(newRate.net_price)
      })
      toast.success('Special rate added')
      setNewRate({ customer_name: '', skip_size: '8', waste_type: '', net_price: '' })
      load()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      toast.error(message)
    }
  }

  async function handleDeleteRate(id: string) {
    if (!confirm('Remove this special rate?')) return
    await deleteCustomPrice(id)
    toast.success('Rate removed')
    load()
  }

  if (loading) return <div className="p-10 text-center text-slate-500 font-black uppercase animate-pulse">Loading system settings...</div>

  return (
    <div className="space-y-10 max-w-6xl animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* Skip Prices */}
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 shadow-xl">
          <SectionHeader title="Skip Hire Prices (Net)" />
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-4">
            {Object.entries(config!.prices_skip as Record<string, number> || {}).map(([size, price]: [string, number]) => (
              <div key={size} className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-slate-500 uppercase">{size}yd Skip</label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 font-bold text-xs">£</span>
                  <input
                    type="number"
                    defaultValue={price}
                    onBlur={e => {
                      const next = { ...config!.prices_skip, [size]: Number(e.target.value) }
                      handleSave('prices_skip', next)
                    }}
                    className="bg-slate-800 border border-white/10 text-white px-2 py-1 rounded text-sm w-full focus:border-primary outline-none"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Waste Tip Rates */}
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 shadow-xl">
          <SectionHeader title="Waste Tip Rates (per Tonne)" />
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-4">
            {Object.entries(config!.prices_waste as Record<string, number> || {}).map(([type, price]: [string, number]) => (
              <div key={type} className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-slate-500 uppercase">{type}</label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 font-bold text-xs">£</span>
                  <input
                    type="number"
                    defaultValue={price}
                    onBlur={e => {
                      const next = { ...config!.prices_waste, [type]: Number(e.target.value) }
                      handleSave('prices_waste', next)
                    }}
                    className="bg-slate-800 border border-white/10 text-white px-2 py-1 rounded text-sm w-full focus:border-primary outline-none"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Profitability Calc */}
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 shadow-xl">
          <SectionHeader title="Profitability Calc (Disposal Costs)" />
          <p className="text-[9px] text-slate-500 mb-4 uppercase font-bold italic tracking-tighter">Your actual costs per tonne at the tip.</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {Object.entries(config!.disposal_costs as Record<string, number> || {}).map(([type, cost]: [string, number]) => (
              <div key={type} className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-slate-500 uppercase">{type}</label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 font-bold text-xs">£</span>
                  <input
                    type="number"
                    defaultValue={cost}
                    onBlur={e => {
                      const next = { ...config!.disposal_costs, [type]: Number(e.target.value) }
                      handleSave('disposal_costs', next)
                    }}
                    className="bg-slate-800 border border-white/10 text-white px-2 py-1 rounded text-sm w-full focus:border-primary outline-none"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Special Customer Rates */}
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 shadow-xl flex flex-col h-[500px]">
          <SectionHeader title="Special Customer Rates (Overrides)" />
          <div className="bg-slate-950/50 p-4 rounded-xl border border-white/5 mb-4">
            <p className="text-[10px] font-black text-primary uppercase mb-3 italic">Add New Override</p>
            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="Customer Name" value={newRate.customer_name} onChange={e => setNewRate({ ...newRate, customer_name: e.target.value })}
                className="bg-slate-800 border border-white/10 text-white px-3 py-1.5 rounded text-sm focus:border-primary outline-none" />
              <input type="number" placeholder="Net Price (£)" value={newRate.net_price} onChange={e => setNewRate({ ...newRate, net_price: e.target.value })}
                className="bg-slate-800 border border-white/10 text-white px-3 py-1.5 rounded text-sm focus:border-primary outline-none" />
              <select value={newRate.skip_size} onChange={e => setNewRate({ ...newRate, skip_size: e.target.value })}
                className="bg-slate-800 border border-white/10 text-white px-3 py-1.5 rounded text-sm outline-none">
                <option value="">-- No Skip Size --</option>
                {SKIP_SIZES.map(s => <option key={s} value={s}>{s}yd Skip</option>)}
              </select>
              <button onClick={handleAddRate} className="bg-primary text-slate-900 font-black text-xs uppercase tracking-widest rounded hover:brightness-90 transition">
                Create Override
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {customRates.map(r => (
              <div key={r.id} className="bg-slate-800/50 border border-white/5 p-3 rounded-lg flex justify-between items-center group">
                <div>
                  <p className="text-white font-bold text-sm">{r.customer_name}</p>
                  <p className="text-[10px] text-slate-500 uppercase font-black">
                    {r.skip_size ? `${r.skip_size}yd Skip` : r.waste_type || 'General'} Override
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-primary font-black text-sm">{fmt(r.net_price)}</span>
                  <button onClick={() => handleDeleteRate(r.id)} className="text-slate-600 hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {customRates.length === 0 && <p className="text-center text-slate-600 text-sm mt-10 italic">No custom rates configured</p>}
          </div>
        </div>

        {/* Identity & Branding */}
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 shadow-2xl flex flex-col h-[500px]">
          <SectionHeader title="Branding Protocol" />
          <div className="space-y-4 flex-1">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-500 uppercase">Registered Name</label>
              <input type="text" defaultValue={(config!.company_info as Record<string, string>)?.name} onBlur={e => handleSave('company_info', { ...config!.company_info, name: e.target.value })}
                className="bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm w-full outline-none" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-500 uppercase">Registered Address</label>
              <textarea defaultValue={(config!.company_info as Record<string, string>)?.address} onBlur={e => handleSave('company_info', { ...config!.company_info, address: e.target.value })}
                className="bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm w-full h-24 focus:border-primary outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-slate-500 uppercase">Office Phone</label>
                <input type="text" defaultValue={(config!.company_info as Record<string, string>)?.phone} onBlur={e => handleSave('company_info', { ...config!.company_info, phone: e.target.value })}
                  className="bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm focus:border-primary outline-none" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-slate-500 uppercase">Waste Carrier Licence</label>
                <input type="text" defaultValue={(config!.company_info as Record<string, string>)?.waste_licence} onBlur={e => handleSave('company_info', { ...config!.company_info, waste_licence: e.target.value })}
                  className="bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm focus:border-primary outline-none" />
              </div>
            </div>

            <div className="bg-slate-950/50 p-4 rounded-xl border border-white/5 mt-4">
              <p className="text-[10px] font-black text-primary uppercase mb-3 italic">Banking details</p>
              <div className="grid grid-cols-3 gap-3">
                <input type="text" placeholder="Bank" defaultValue={(config!.company_info as Record<string, string>)?.bank_name} onBlur={e => handleSave('company_info', { ...config!.company_info, bank_name: e.target.value })}
                  className="bg-slate-800 border border-white/10 text-white px-3 py-1.5 rounded text-[10px] outline-none" />
                <input type="text" placeholder="Sort Code" defaultValue={(config!.company_info as Record<string, string>)?.sort_code} onBlur={e => handleSave('company_info', { ...config!.company_info, sort_code: e.target.value })}
                  className="bg-slate-800 border border-white/10 text-white px-3 py-1.5 rounded text-[10px] outline-none" />
                <input type="text" placeholder="Account #" defaultValue={(config!.company_info as Record<string, string>)?.account_number} onBlur={e => handleSave('company_info', { ...config!.company_info, account_number: e.target.value })}
                  className="bg-slate-800 border border-white/10 text-white px-3 py-1.5 rounded text-[10px] outline-none" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
