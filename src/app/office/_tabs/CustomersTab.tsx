'use client'

import { useState } from 'react'
import { Database } from '@/lib/database.types'
import {
  searchCustomers,
  getCustomerTimeline,
  markJobPaid,
} from '@/lib/api'
import toast from 'react-hot-toast'
import {
  Search,
  X,
  ChevronRight,
} from 'lucide-react'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) { return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }

function SectionHeader({ title }: { title: string }) {
  return <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-3">{title}</h3>
}

function Badge({ label, color }: { label: string; color: string }) {
  return <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide ${color}`}>{label}</span>
}

// ─── Customers Tab ────────────────────────────────────────────────────────────

export default function CustomersTab() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Database["public"]["Tables"]["customers"]["Row"][]>([])
  const [timeline, setTimeline] = useState<{ customer: string; totalSpend: number; outstandingBalance: number; jobs: { date: string; type: string; size: string; address: string; amount: number; paid: boolean; orderId: string }[]; tips: { ticket: string; wasteType: string; netWeight: number | null; amount: number; paid: boolean }[] } | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSearch() {
    if (query.length < 2) return
    setLoading(true)
    const data = await searchCustomers(query)
    setResults(data)
    setTimeline(null)
    setLoading(false)
  }

  async function loadTimeline(customerName: string, customerId?: string) {
    setLoading(true)
    const data = await getCustomerTimeline(customerName, customerId)
    setTimeline(data)
    setResults([])
    setLoading(false)
  }

  async function handleMarkPaid(id: string, source: 'Orders' | 'CashLog') {
    await markJobPaid(id, source)
    toast.success('Marked as paid')
    // Reload timeline using the same name; customer_id not stored in timeline state
    loadTimeline(timeline!.customer)
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <input
          type="text" value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Search customer name..."
          className="flex-1 bg-slate-900 border border-white/10 text-white px-4 py-2 rounded-lg text-sm focus:border-primary outline-none"
        />
        <button onClick={handleSearch} className="flex items-center gap-2 bg-primary text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-primary-dark">
          <Search size={16} /> Search
        </button>
        {timeline && (
          <button onClick={() => { setTimeline(null); setResults([]) }} className="text-slate-400 hover:text-white px-3 py-2 rounded-lg bg-slate-800">
            <X size={16} />
          </button>
        )}
      </div>

      {loading && <p className="text-slate-500 text-sm">Searching...</p>}

      {/* Search results */}
      {results.length > 0 && (
        <div className="bg-slate-900 border border-white/5 rounded-xl overflow-hidden">
          {results.map((c: Database["public"]["Tables"]["customers"]["Row"]) => (
            <button key={c.id} onClick={() => loadTimeline(c.name, c.id)}
              className="w-full text-left px-5 py-4 hover:bg-slate-800 border-b border-white/5 flex justify-between items-center transition-colors">
              <div>
                <p className="text-white font-bold">{c.name}</p>
                <p className="text-xs text-slate-500">{c.phone} · {c.billing_address}</p>
              </div>
              <ChevronRight size={16} className="text-primary" />
            </button>
          ))}
        </div>
      )}

      {/* Customer Timeline */}
      {timeline && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-white/5 rounded-xl p-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Customer</p>
              <p className="text-lg font-black text-white">{timeline.customer}</p>
            </div>
            <div className="bg-slate-900 border border-white/5 rounded-xl p-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Total Spend</p>
              <p className="text-lg font-black text-primary">{fmt(timeline.totalSpend)}</p>
            </div>
            <div className="bg-slate-900 border border-white/5 rounded-xl p-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Outstanding</p>
              <p className={`text-lg font-black ${timeline.outstandingBalance > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {fmt(timeline.outstandingBalance)}
              </p>
            </div>
          </div>

          {/* Jobs */}
          {timeline.jobs?.length > 0 && (
            <div className="bg-slate-900 border border-white/5 rounded-xl p-5">
              <SectionHeader title={`Skip Jobs (${timeline.jobs.length})`} />
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {timeline.jobs.map((j, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm border-b border-white/5 pb-2">
                    <div>
                      <p className="text-white">{j.date} · {j.type} · {j.size}yd</p>
                      <p className="text-xs text-slate-500">{j.address}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-white">{fmt(j.amount)}</span>
                      {j.paid
                        ? <Badge label="Paid" color="bg-green-900/40 text-green-400" />
                        : <button onClick={() => handleMarkPaid(j.orderId, 'Orders')} className="text-xs font-bold text-yellow-400 hover:text-yellow-300">Mark Paid</button>
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tips */}
          {timeline.tips?.length > 0 && (
            <div className="bg-slate-900 border border-white/5 rounded-xl p-5">
              <SectionHeader title={`Weighbridge Tips (${timeline.tips.length})`} />
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {timeline.tips.map((t, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm border-b border-white/5 pb-2">
                    <div>
                      <p className="text-white">Ticket {t.ticket} · {t.wasteType}</p>
                      <p className="text-xs text-slate-500">{t.netWeight?.toLocaleString()} kg</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-white">{fmt(t.amount)}</span>
                      {t.paid
                        ? <Badge label="Paid" color="bg-green-900/40 text-green-400" />
                        : <Badge label="Unpaid" color="bg-red-900/40 text-red-400" />
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
