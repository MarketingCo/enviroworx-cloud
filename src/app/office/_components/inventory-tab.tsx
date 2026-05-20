'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { DEFAULT_CONFIG, SKIP_SIZES, WB_SIZES } from '@/lib/config'
import toast from 'react-hot-toast'
import KmlSyncButton from '@/components/KmlSyncButton'
import { LayoutDashboard, Truck, Weight, CalendarPlus, Users, FileText, Wrench, RefreshCw, CheckCircle, Clock, AlertTriangle, Package, TrendingUp, ChevronRight, Zap, X, Search, DollarSign, Settings, Trash2 } from 'lucide-react'
import { getInventoryAction } from '@/app/actions/office-data'
import { assignDriverToJobAction, autoAssignJobsAction, processBookingAction, logActiveTipperAction, processWeightLogAction, markJobPaidAction, cancelBookingAction, updateDriverPinAction, updateConfigAction, addCustomPriceAction, deleteCustomPriceAction } from '@/app/actions/operations'

import { fmt, today, tomorrow, KpiCard, SectionHeader, Badge, statusColor } from './shared'

export function InventoryTab() {
  const [inventory, setInventory] = useState<any[]>([])
  const [filter, setFilter] = useState<'all' | 'Available' | 'In Use' | 'Damaged'>('all')
  const [sizeFilter, setSizeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const data = await getInventoryAction()
        setInventory(data)
      } catch (e: any) {
        toast.error(e.message || 'Could not load inventory')
      }
      setLoading(false)
    }
    load()
    const ch = supabase.channel('inv').on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
      load()
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
