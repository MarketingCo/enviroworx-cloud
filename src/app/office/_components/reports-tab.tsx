'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { DEFAULT_CONFIG, SKIP_SIZES, WB_SIZES } from '@/lib/config'
import toast from 'react-hot-toast'
import { LayoutDashboard, Truck, Weight, CalendarPlus, Users, FileText, FileSpreadsheet, Wrench, RefreshCw, CheckCircle, Clock, AlertTriangle, Package, TrendingUp, ChevronRight, Zap, X, Search, Settings, Trash2 } from 'lucide-react'
import {
  generateReportAction,
  getOpsSummaryAction,
  runMonthlySepaDriveSyncAction,
} from '@/app/actions/office-data'

import { fmt, today, tomorrow, KpiCard, SectionHeader, Badge, statusColor, Button, EmptyState } from './shared'

export function ReportsTab() {
  const thisMonth = new Date().toISOString().slice(0, 7)
  const [startDate, setStartDate] = useState(`${thisMonth}-01`)
  const [endDate, setEndDate] = useState(today())
  const [loading, setLoading] = useState<string | null>(null)
  const [summary, setSummary] = useState<{
    cashGross: number
    cashPaid: number
    tonnageTonnes: number
    tipCount: number
    completedJobs: number
    openJobs: number
    unpaidInvoices: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadSummary = useCallback(() => {
    setError(null)
    getOpsSummaryAction(startDate, endDate)
      .then(setSummary)
      .catch((e: any) => {
        setSummary(null)
        setError(e?.message || 'Could not load summary')
      })
  }, [startDate, endDate])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  async function handleGenerate(type: string, label: string) {
    setLoading(type)
    try {
      const data = await generateReportAction(type, startDate, endDate)
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

  async function handleDriveSync() {
    setLoading('DRIVE')
    try {
      const data = await runMonthlySepaDriveSyncAction(startDate, endDate)
      if (data.success) {
        toast.success(`Synced ${data.count ?? 0} items to Google Drive!`)
      } else {
        toast.error(data.message || 'No data found for sync')
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Sync failed')
    }
    setLoading(null)
  }

  const reports = [
    { type: 'SEPA', label: 'SEPA Report', desc: 'Waste transfer logs for Scottish Environment Protection Agency compliance' },
    { type: 'FINANCE', label: 'Finance Report', desc: 'Cash log with costs, payments, and outstanding balances' },
    { type: 'UNPAID_INVOICES', label: 'Unpaid Invoices', desc: 'All outstanding invoices from orders and tipping — export for credit control or QuickBooks import' },
    { type: 'DRIVER_MANIFEST', label: 'Driver Manifest', desc: 'Completed jobs grouped by driver for payroll and operations review' },
    { type: 'ASSETS', label: 'Asset Report', desc: 'Current skip inventory — skips deployed to customers right now' },
  ]

  if (error)
    return (
      <EmptyState message={error} action={<Button variant="secondary" onClick={loadSummary}>Retry</Button>} />
    )

  return (
    <div className="space-y-6 max-w-2xl">
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Cash (gross)', value: fmt(summary.cashGross) },
            { label: 'Tonnage', value: `${summary.tonnageTonnes.toFixed(1)}t` },
            { label: 'Jobs done', value: String(summary.completedJobs) },
            { label: 'Unpaid inv.', value: String(summary.unpaidInvoices) },
          ].map((k) => (
            <div key={k.label} className="bg-slate-900 border border-white/5 rounded-xl p-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{k.label}</p>
              <p className="text-xl font-black text-white mt-1">{k.value}</p>
            </div>
          ))}
        </div>
      )}

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
        <button
          onClick={handleDriveSync}
          disabled={!!loading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-4 rounded-xl font-black uppercase tracking-widest text-sm transition-all shadow-xl shadow-indigo-500/10 flex items-center justify-center gap-3"
        >
          {loading === 'DRIVE' ? <RefreshCw className="animate-spin" size={18} /> : <FileSpreadsheet size={18} />}
          {loading === 'DRIVE' ? 'Syncing...' : 'Sync SEPA to Google Drive'}
        </button>

        <div className="pt-4 pb-2 text-center">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">— OR DOWNLOAD LOCAL CSV —</span>
        </div>

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
