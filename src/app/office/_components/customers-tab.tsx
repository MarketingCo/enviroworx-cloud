'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { DEFAULT_CONFIG } from '@/lib/config'
import { Search, X, ChevronRight } from 'lucide-react'
import { markJobPaidAction } from '@/app/actions/operations'
import toast from 'react-hot-toast'
import {
  listCustomersAction,
  searchCustomersAction,
  getCustomerTimelineAction,
  findDuplicateCustomersAction,
  mergeCustomersAction,
} from '@/app/actions/office-data'

import { fmt, today, tomorrow, KpiCard, SectionHeader, Badge, statusColor, Button, EmptyState } from './shared'
import { getTabCache, setTabCache } from './tab-cache'

export function CustomersTab() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [timeline, setTimeline] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [initialLoaded, setInitialLoaded] = useState(false)
  const [duplicates, setDuplicates] = useState<
    { key: string; customers: { id: string; name: string; phone: string | null }[] }[]
  >([])
  const [mergePrimary, setMergePrimary] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  async function loadInitial() {
    setLoading(true)
    setError(null)
    try {
      const data = await listCustomersAction(100)
      setResults(data)
      setTabCache('customers', data)
      setInitialLoaded(true)
    } catch (e: any) {
      setError(e?.message || 'Could not load customers')
    }
    setLoading(false)
  }

  useEffect(() => {
    loadInitial()
    findDuplicateCustomersAction()
      .then(setDuplicates)
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleMerge(groupKey: string, customers: { id: string; name: string }[]) {
    const primaryId = mergePrimary[groupKey] || customers[0]?.id
    const duplicateIds = customers.filter((c) => c.id !== primaryId).map((c) => c.id)
    if (!primaryId || !duplicateIds.length) {
      toast.error('Select which record to keep as primary')
      return
    }
    if (!confirm(`Merge ${duplicateIds.length} duplicate(s) into the primary account? This cannot be undone.`)) {
      return
    }
    setLoading(true)
    try {
      const res = await mergeCustomersAction(primaryId, duplicateIds)
      toast.success(`Merged into ${res.primaryName}`)
      const [list, dups] = await Promise.all([listCustomersAction(100), findDuplicateCustomersAction()])
      setResults(list)
      setDuplicates(dups)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Merge failed')
    }
    setLoading(false)
  }

  async function handleSearch() {
    if (query.length < 2) {
      if (initialLoaded) {
        const data = await listCustomersAction(100)
        setResults(data)
      }
      setTimeline(null)
      return
    }
    setLoading(true)
    try {
      const data = await searchCustomersAction(query)
      setResults(data)
      setTimeline(null)
    } catch (e: any) {
      toast.error(e.message || 'Search failed')
    }
    setLoading(false)
  }

  async function loadTimeline(customerName: string) {
    setLoading(true)
    try {
      const data = await getCustomerTimelineAction(customerName)
      setTimeline(data)
      setResults([])
    } catch (e: any) {
      toast.error(e.message || 'Could not load customer history')
    }
    setLoading(false)
  }

  async function handleMarkPaid(id: string, source: 'Orders' | 'CashLog') {
    await markJobPaidAction(id, source)
    toast.success('Marked as paid')
    loadTimeline(timeline.customer)
  }

  if (error)
    return (
      <EmptyState message={error} action={<Button variant="secondary" onClick={loadInitial}>Retry</Button>} />
    )

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

      {duplicates.length > 0 && !timeline && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5 space-y-4">
          <SectionHeader title={`Possible duplicates (${duplicates.length})`} />
          {duplicates.slice(0, 5).map((group) => (
            <div key={group.key} className="bg-slate-900/80 rounded-lg p-4 space-y-3">
              {group.customers.map((c) => (
                <label key={c.id} className="flex items-center gap-3 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name={`primary-${group.key}`}
                    checked={(mergePrimary[group.key] || group.customers[0]?.id) === c.id}
                    onChange={() => setMergePrimary((p) => ({ ...p, [group.key]: c.id }))}
                  />
                  <span className="text-white font-semibold">{c.name}</span>
                  <span className="text-slate-500 text-xs">{c.phone}</span>
                </label>
              ))}
              <button
                type="button"
                onClick={() => handleMerge(group.key, group.customers)}
                className="text-xs font-black uppercase tracking-widest text-amber-300 hover:text-white"
              >
                Merge into primary
              </button>
            </div>
          ))}
        </div>
      )}

      {loading && <p className="text-slate-500 text-sm">Loading...</p>}

      {!loading && !timeline && results.length === 0 && (
        <p className="text-slate-500 text-sm">
          No customers found. Run data migration or add customers via New Booking.
        </p>
      )}

      {/* Search results */}
      {!timeline && results.length > 0 && (
        <div className="bg-slate-900 border border-white/5 rounded-xl overflow-hidden">
          {results.map((c: any) => (
            <button key={c.id} onClick={() => loadTimeline(c.name)}
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

          {/* Open jobs */}
          {timeline.openOrders?.length > 0 && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-5">
              <SectionHeader title={`Active jobs (${timeline.openOrders.length})`} />
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {timeline.openOrders.map((o: { id: string; date: string; job_type: string; skip_size: string; address: string; status: string }) => (
                  <div key={o.id} className="flex justify-between text-sm border-b border-white/5 pb-2">
                    <div>
                      <p className="text-white">{o.date} · {o.job_type} · {o.skip_size}yd</p>
                      <p className="text-xs text-slate-500">{o.address}</p>
                    </div>
                    <Badge label={o.status} color={statusColor(o.status)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Jobs */}
          {timeline.jobs?.length > 0 && (
            <div className="bg-slate-900 border border-white/5 rounded-xl p-5">
              <SectionHeader title={`Skip Jobs (${timeline.jobs.length})`} />
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {timeline.jobs.map((j: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm border-b border-white/5 pb-2">
                    <div>
                      <p className="text-white">{j.date} · {j.type} · {j.size}yd</p>
                      <p className="text-xs text-slate-500">{j.address}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-white">{fmt(j.amount)}</span>
                      {j.paid
                        ? <Badge label="Paid" color="bg-green-900/40 text-green-400" />
                        : <button onClick={() => handleMarkPaid(j.id, 'Orders')} className="text-xs font-bold text-yellow-400 hover:text-yellow-300">Mark Paid</button>
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
                {timeline.tips.map((t: any, i: number) => (
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

// ─── Reports Tab ──────────────────────────────────────────────────────────────
