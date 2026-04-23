'use client'
import { useState } from 'react'
import { generateReport } from '@/lib/api'
import { today } from './shared'
import toast from 'react-hot-toast'
import { FileSpreadsheet, FileText, Download, RefreshCw } from 'lucide-react'
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

  async function handleDriveSync() {
    setLoading('DRIVE')
    try {
      const res = await fetch(`/api/cron/monthly-sepa?start=${startDate}&end=${endDate}`)
      const data = await res.json()
      if (data.success) {
        toast.success(`Synced ${data.count} items to Google Drive!`)
      } else {
        toast.error(data.message || 'No data found for sync')
      }
    } catch (e: any) {
      toast.error('Sync failed: ' + e.message)
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

export default ReportsTab
