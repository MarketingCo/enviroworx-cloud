'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase-browser'
import toast from 'react-hot-toast'
import { Trash2 } from 'lucide-react'
import { SKIP_SIZES } from '@/lib/config'
import { getCustomPricingList } from '@/lib/api'
import { updateConfigAction, addCustomPriceAction, deleteCustomPriceAction } from '@/app/actions/operations'
import { listOfficeStaffAction, getSetupStatusAction } from '@/app/actions/office-data'

import { fmt, today, tomorrow, KpiCard, SectionHeader, Badge, statusColor } from './shared'

export function SettingsTab() {
  const [config, setConfig] = useState<any>(null)
  const [customRates, setCustomRates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [newRate, setNewRate] = useState({
    customer_name: '',
    skip_size: '8',
    waste_type: '',
    net_price: ''
  })
  const [officeStaff, setOfficeStaff] = useState<
    { id: string; email: string; display_name: string | null; role: string; active: boolean }[]
  >([])
  const [setupChecks, setSetupChecks] = useState<
    { id: string; label: string; ok: boolean; detail: string }[]
  >([])

  async function load() {
    setLoading(true)
    const [{ data }, rates, staff, checks] = await Promise.all([
      supabase.from('config').select('*'),
      getCustomPricingList(),
      listOfficeStaffAction().catch(() => []),
      getSetupStatusAction().catch(() => []),
    ])
    const cfg: any = {}
    data?.forEach((row: any) => { cfg[row.key] = row.value })
    setConfig(cfg)
    setCustomRates(rates)
    setOfficeStaff(staff as typeof officeStaff)
    setSetupChecks(checks)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSave(key: string, value: any) {
    setSaving(true)
    try {
      await updateConfigAction(key, value)
      toast.success('Settings updated')
    } catch (e: any) {
      toast.error('Failed to update: ' + e.message)
    }
    setSaving(false)
  }

  async function handleAddRate() {
    if (!newRate.customer_name || !newRate.net_price) return toast.error('Customer and Price required')
    try {
      await addCustomPriceAction({
        customer_name: newRate.customer_name,
        skip_size: newRate.skip_size || undefined,
        waste_type: newRate.waste_type || undefined,
        net_price: Number(newRate.net_price)
      })
      toast.success('Special rate added')
      setNewRate({ customer_name: '', skip_size: '8', waste_type: '', net_price: '' })
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  async function handleDeleteRate(id: string) {
    if (!confirm('Remove this special rate?')) return
    await deleteCustomPriceAction(id)
    toast.success('Rate removed')
    load()
  }

  if (loading) return <div className="p-10 text-center text-slate-500 font-black uppercase animate-pulse">Loading system settings...</div>

  return (
    <div className="space-y-10 max-w-6xl animate-in fade-in slide-in-from-bottom-2 duration-500">
      {setupChecks.length > 0 && (
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-6">
          <SectionHeader title="System readiness" />
          <ul className="mt-4 grid sm:grid-cols-2 gap-3">
            {setupChecks.map((c) => (
              <li
                key={c.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  c.ok ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'
                }`}
              >
                <span className="text-lg">{c.ok ? '✓' : '!'}</span>
                <div>
                  <p className="text-sm font-bold text-white">{c.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{c.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* Skip Prices */}
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 shadow-xl">
          <SectionHeader title="Skip Hire Prices (Net)" />
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-4">
            {Object.entries(config.prices_skip || {}).map(([size, price]: [string, any]) => (
              <div key={size} className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-slate-500 uppercase">{size}yd Skip</label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 font-bold text-xs">£</span>
                  <input
                    type="number"
                    defaultValue={price}
                    onBlur={e => {
                      const next = { ...config.prices_skip, [size]: Number(e.target.value) }
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
            {Object.entries(config.prices_waste || {}).map(([type, price]: [string, any]) => (
              <div key={type} className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-slate-500 uppercase">{type}</label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 font-bold text-xs">£</span>
                  <input
                    type="number"
                    defaultValue={price}
                    onBlur={e => {
                      const next = { ...config.prices_waste, [type]: Number(e.target.value) }
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
            {Object.entries(config.disposal_costs || {}).map(([type, cost]: [string, any]) => (
              <div key={type} className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-slate-500 uppercase">{type}</label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 font-bold text-xs">£</span>
                  <input
                    type="number"
                    defaultValue={cost}
                    onBlur={e => {
                      const next = { ...config.disposal_costs, [type]: Number(e.target.value) }
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
              <input type="text" defaultValue={config.company_info?.name} onBlur={e => handleSave('company_info', { ...config.company_info, name: e.target.value })}
                className="bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm w-full outline-none" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-500 uppercase">Registered Address</label>
              <textarea defaultValue={config.company_info?.address} onBlur={e => handleSave('company_info', { ...config.company_info, address: e.target.value })}
                className="bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm w-full h-24 focus:border-primary outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-slate-500 uppercase">Office Phone</label>
                <input type="text" defaultValue={config.company_info?.phone} onBlur={e => handleSave('company_info', { ...config.company_info, phone: e.target.value })}
                  className="bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm focus:border-primary outline-none" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-slate-500 uppercase">Waste Carrier Licence</label>
                <input type="text" defaultValue={config.company_info?.waste_licence} onBlur={e => handleSave('company_info', { ...config.company_info, waste_licence: e.target.value })}
                  className="bg-slate-800 border border-white/10 text-white px-3 py-2 rounded text-sm focus:border-primary outline-none" />
              </div>
            </div>
            
            <div className="bg-slate-950/50 p-4 rounded-xl border border-white/5 mt-4">
              <p className="text-[10px] font-black text-primary uppercase mb-3 italic">Banking details</p>
              <div className="grid grid-cols-3 gap-3">
                <input type="text" placeholder="Bank" defaultValue={config.company_info?.bank_name} onBlur={e => handleSave('company_info', { ...config.company_info, bank_name: e.target.value })}
                  className="bg-slate-800 border border-white/10 text-white px-3 py-1.5 rounded text-[10px] outline-none" />
                <input type="text" placeholder="Sort Code" defaultValue={config.company_info?.sort_code} onBlur={e => handleSave('company_info', { ...config.company_info, sort_code: e.target.value })}
                  className="bg-slate-800 border border-white/10 text-white px-3 py-1.5 rounded text-[10px] outline-none" />
                <input type="text" placeholder="Account #" defaultValue={config.company_info?.account_number} onBlur={e => handleSave('company_info', { ...config.company_info, account_number: e.target.value })}
                  className="bg-slate-800 border border-white/10 text-white px-3 py-1.5 rounded text-[10px] outline-none" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 shadow-xl">
        <SectionHeader title="Office access (Google)" />
        <p className="text-xs text-slate-500 mt-2 mb-4 leading-relaxed">
          Staff listed in Supabase <code className="text-slate-400">office_staff</code> get roles after Google
          sign-in. Handover checklist: <code className="text-slate-400">docs/HANDOVER.md</code> · daily use:{' '}
          <code className="text-slate-400">docs/STAFF_GUIDE.md</code>.
        </p>
        {officeStaff.length === 0 ? (
          <p className="text-sm text-amber-400/90">
            No rows in office_staff yet — allowlist domains still work via env vars.
          </p>
        ) : (
          <ul className="divide-y divide-white/5 rounded-xl border border-white/5 overflow-hidden">
            {officeStaff.map((s) => (
              <li key={s.id} className="flex justify-between items-center px-4 py-3 text-sm">
                <div>
                  <p className="text-white font-semibold">{s.display_name || s.email}</p>
                  <p className="text-xs text-slate-500">{s.email}</p>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                  {s.role}
                  {!s.active ? ' · inactive' : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

