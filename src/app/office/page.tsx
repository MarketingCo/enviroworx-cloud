'use client'

import { useEffect, useState, useCallback } from 'react'
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
  MapPin,
  Settings,
  Package,
} from 'lucide-react'
import { type Tab, type DashStats } from '@/components/office/shared'
import DashboardTab from '@/components/office/DashboardTab'
import DispatchTab from '@/components/office/DispatchTab'
import WeighbridgeTab from '@/components/office/WeighbridgeTab'
import BookingsTab from '@/components/office/BookingsTab'
import CustomersTab from '@/components/office/CustomersTab'
import ReportsTab from '@/components/office/ReportsTab'
import InventoryTab from '@/components/office/InventoryTab'
import FleetTab from '@/components/office/FleetTab'
import MapTab from '@/components/office/MapTab'
import SettingsTab from '@/components/office/SettingsTab'

export default function OfficePage() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [dashData, setDashData] = useState<DashStats | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadDash = useCallback(async () => {
    try {
      const data = await getDashboardStats()
      setDashData(data)
    } catch (err: any) {
      console.error('Dashboard load error:', err)
    }
  }, [])

  useEffect(() => {
    loadDash()
    const interval = setInterval(loadDash, 120000)
    return () => clearInterval(interval)
  }, [loadDash])

  useEffect(() => {
    const ch = supabase.channel('office-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        const o = payload.new as any
        toast.success(`📋 New booking: ${o.job_type || 'Order'} — ${o.customer_name || 'Customer'}`, { duration: 6000 })
        loadDash()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'weight_logs' }, (payload) => {
        const o = payload.new as any
        toast.success(`⚖️ Weighbridge: ${o.net_weight?.toFixed(0) || '?'}kg — ${o.customer_name || 'Unknown'}`, { duration: 4000 })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cash_log' }, (payload) => {
        const cl = payload.new as any
        if (cl.amount_paid > 0) {
          toast.success(`💰 Payment: £${cl.amount_paid?.toFixed(2)} — ${cl.customer_name || 'Cash'}`, { duration: 4000 })
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [loadDash])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadDash()
    setTimeout(() => setRefreshing(false), 500)
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { id: 'dispatch', label: 'Dispatch', icon: <Truck size={16} /> },
    { id: 'weighbridge', label: 'Weighbridge', icon: <Weight size={16} /> },
    { id: 'bookings', label: 'Bookings', icon: <CalendarPlus size={16} /> },
    { id: 'customers', label: 'Customers', icon: <Users size={16} /> },
    { id: 'reports', label: 'Reports', icon: <FileText size={16} /> },
    { id: 'inventory', label: 'Inventory', icon: <Package size={16} /> },
    { id: 'fleet', label: 'Fleet', icon: <Wrench size={16} /> },
    { id: 'map', label: 'Map', icon: <MapPin size={16} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={16} /> },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-white flex">
      <Toaster position="bottom-right" />

      {/* Sidebar */}
      <aside className="w-52 border-r border-white/5 bg-slate-950/80 flex flex-col">
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-500 rounded flex items-center justify-center font-black italic tracking-tighter text-xs">E</div>
            <span className="text-sm font-black italic tracking-tighter uppercase">Office</span>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-0.5">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                tab === t.id
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-white/5">
          <div className="text-[9px] text-slate-600 font-medium uppercase tracking-wider">System</div>
          <div className="flex items-center gap-1.5 mt-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-slate-500">Connected</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl">
          {tab === 'dashboard' && <DashboardTab data={dashData} onRefresh={handleRefresh} />}
          {tab === 'dispatch' && <DispatchTab />}
          {tab === 'weighbridge' && <WeighbridgeTab />}
          {tab === 'bookings' && <BookingsTab />}
          {tab === 'customers' && <CustomersTab />}
          {tab === 'reports' && <ReportsTab />}
          {tab === 'inventory' && <InventoryTab />}
          {tab === 'fleet' && <FleetTab />}
          {tab === 'map' && <MapTab />}
          {tab === 'settings' && <SettingsTab />}
        </div>
      </main>
    </div>
  )
}
