'use client'

import { useEffect, useState, useCallback } from 'react'
import { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import { getDashboardStats } from '@/lib/api'
import toast, { Toaster } from 'react-hot-toast'
import {
  LayoutDashboard,
  Truck,
  Weight,
  CalendarPlus,
  Users,
  FileText,
  Wrench,
  Package,
  TrendingUp,
  RefreshCw,
  Settings,
} from 'lucide-react'
import {
  DashboardTab,
  DispatchTab,
  WeighbridgeTab,
  BookingsTab,
  CustomersTab,
  ReportsTab,
  InventoryTab,
  FleetTab,
  MapTab,
  SettingsTab,
  type DashStats,
} from './_tabs'

// ─── Tab Type ────────────────────────────────────────────────────────────────

type Tab = 'dashboard' | 'dispatch' | 'weighbridge' | 'bookings' | 'customers' | 'reports' | 'fleet' | 'inventory' | 'map' | 'settings'

// ─── Main Office Page ─────────────────────────────────────────────────────────

export default function OfficePage() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [dashData, setDashData] = useState<DashStats | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadDash = useCallback(async () => {
    setRefreshing(true)
    try {
      const data = await getDashboardStats()
      setDashData(data)
    } catch {
      toast.error('Failed to load dashboard')
    }
    setRefreshing(false)
  }, [])

  useEffect(() => {
    loadDash()
    const interval = setInterval(loadDash, 120000)

    const ch = supabase.channel('office-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_tippers' }, (payload) => {
        loadDash()
        if (payload.eventType === 'INSERT') toast('🚛 New tipper in yard', { duration: 4000 })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        loadDash()
        const o = payload.new as Database["public"]["Tables"]["orders"]["Row"]
        toast.success(`📋 New booking: ${o.job_type || 'Order'} — ${o.customer_name || 'Customer'}`, { duration: 6000 })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        loadDash()
        const o = payload.new as Database["public"]["Tables"]["orders"]["Row"]
        if (o.status === 'Completed') {
          toast.success(`✅ Job completed: ${o.customer_name || 'Order'} · ${o.address || ''}`, { duration: 5000 })
        } else if (o.status === 'Aborted') {
          toast.error(`⛔ Job aborted: ${o.customer_name || 'Order'}`, { duration: 5000 })
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cash_log' }, (payload) => {
        loadDash()
        const cl = payload.new as Database["public"]["Tables"]["cash_log"]["Row"]
        toast(`⚖️ Weighbridge: ${cl.customer_name || 'Customer'} — ${cl.net_weight ?? '?'}kg`, { duration: 4000 })
      })
      .subscribe()

    return () => { clearInterval(interval); supabase.removeChannel(ch) }
  }, [loadDash])

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { id: 'dispatch', label: 'Dispatch', icon: <Truck size={16} /> },
    { id: 'weighbridge', label: 'Weighbridge', icon: <Weight size={16} /> },
    { id: 'bookings', label: 'New Booking', icon: <CalendarPlus size={16} /> },
    { id: 'customers', label: 'Customers', icon: <Users size={16} /> },
    { id: 'reports', label: 'Reports', icon: <FileText size={16} /> },
    { id: 'fleet', label: 'Fleet', icon: <Wrench size={16} /> },
    { id: 'inventory', label: 'Inventory', icon: <Package size={16} /> },
    { id: 'map', label: 'Live Map', icon: <TrendingUp size={16} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={16} /> },
  ]

  const isConfigMissing = !process.env.NEXT_PUBLIC_SUPABASE_URL

  return (
    <div className="bg-slate-950 min-h-screen text-white">
      <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } }} />

      {/* Header */}
      <header className="border-b border-white/5 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto px-6 h-14 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-primary rounded flex items-center justify-center font-black italic text-xs">E</div>
            <span className="font-black italic tracking-tighter uppercase text-sm">Enviroworx <span className="text-primary">Office</span></span>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-1 overflow-x-auto">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-black uppercase tracking-wide transition-all whitespace-nowrap ${
                  tab === t.id ? 'bg-primary text-white' : 'text-slate-500 hover:text-white hover:bg-slate-800'
                }`}>
                {t.icon} {t.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {tab === 'dashboard' && (
              <button onClick={loadDash} disabled={refreshing}
                className={`flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors ${refreshing ? 'animate-spin' : ''}`}>
                <RefreshCw size={14} />
              </button>
            )}
            <div className="flex gap-2">
              <a href="/driver" target="_blank" className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-white px-2 py-1 rounded bg-slate-900 border border-white/5">Driver</a>
              <a href="/portal" target="_blank" className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-white px-2 py-1 rounded bg-slate-900 border border-white/5">Portal</a>
              <a href="/tablet" target="_blank" className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-white px-2 py-1 rounded bg-slate-900 border border-white/5">Tablet</a>
            </div>
          </div>
        </div>
      </header>

      {/* Config warning */}
      {isConfigMissing && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-6 py-3 text-center">
          <p className="text-yellow-400 text-xs font-bold">Supabase not configured — add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local</p>
        </div>
      )}

      {/* Content */}
      <main className="max-w-screen-2xl mx-auto px-6 py-8">
        {tab === 'dashboard' && <DashboardTab data={dashData} onRefresh={loadDash} />}
        {tab === 'dispatch' && <DispatchTab />}
        {tab === 'weighbridge' && <WeighbridgeTab />}
        {tab === 'bookings' && <BookingsTab />}
        {tab === 'customers' && <CustomersTab />}
        {tab === 'reports' && <ReportsTab />}
        {tab === 'fleet' && <FleetTab />}
        {tab === 'inventory' && <InventoryTab />}
        {tab === 'map' && <MapTab />}
        {tab === 'settings' && <SettingsTab />}
      </main>
    </div>
  )
}
