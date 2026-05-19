'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'

export default function OfficePage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('orders')
  const [stats, setStats] = useState({
    activeJobs: 0,
    completedToday: 0,
    availableDrivers: 0,
    pendingInvoices: 0,
  })
  const [recentOrders, setRecentOrders] = useState<Array<{
    id: string; customer_name: string | null; address: string | null; skip_size: string | null; status: string | null; date: string | null
  }>>([])

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    const today = format(new Date(), 'yyyy-MM-dd')

    const { count: activeJobs } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('date', today)
      .in('status', ['Booked', 'Assigned'])

    const { count: completedToday } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('date', today)
      .eq('status', 'Completed')

    const { count: availableDrivers } = await supabase
      .from('drivers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Available')

    const { count: pendingInvoices } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Completed')
      .eq('payment_method', 'Invoice')
      .eq('paid', false)

    setStats({
      activeJobs: activeJobs ?? 0,
      completedToday: completedToday ?? 0,
      availableDrivers: availableDrivers ?? 0,
      pendingInvoices: pendingInvoices ?? 0,
    })

    const { data: orders } = await supabase
      .from('orders')
      .select('id, customer_name, address, skip_size, status, date')
      .eq('date', today)
      .order('created_at', { ascending: false })
      .limit(10)

    setRecentOrders(orders ?? [])
  }

  const tabs = ['orders', 'dispatch', 'settings']

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Enviroworx Office</h1>
            <p className="text-slate-400 mt-1">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
          </div>
          <button
            className="border border-slate-700 rounded px-4 py-2 text-sm hover:bg-slate-800 transition-colors"
            onClick={() => {
              supabase.auth.signOut()
              router.push('/office/login')
            }}
          >
            Sign Out
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Active Jobs', value: stats.activeJobs, color: 'text-blue-400' },
            { label: 'Completed Today', value: stats.completedToday, color: 'text-green-400' },
            { label: 'Available Drivers', value: stats.availableDrivers, color: 'text-yellow-400' },
            { label: 'Pending Invoices', value: stats.pendingInvoices, color: 'text-orange-400' },
          ].map((stat) => (
            <div key={stat.label} className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <p className="text-sm text-slate-400">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="border-b border-slate-800">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium capitalize rounded-t-lg transition-colors ${
                  activeTab === tab
                    ? 'bg-slate-900 text-white border-t border-x border-slate-800'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'orders' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Today&apos;s Orders</h2>
            <div className="space-y-2">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg p-4">
                  <div>
                    <p className="font-medium">{order.customer_name}</p>
                    <p className="text-sm text-slate-400">{order.address} — {order.skip_size}yd</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    order.status === 'Completed' ? 'bg-green-900 text-green-300' :
                    order.status === 'Assigned' ? 'bg-blue-900 text-blue-300' :
                    'bg-yellow-900 text-yellow-300'
                  }`}>{order.status}</span>
                </div>
              ))}
              {recentOrders.length === 0 && (
                <p className="text-slate-500 text-center py-8">No orders for today</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'dispatch' && (
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center">
            <h3 className="text-lg font-medium text-slate-300">Dispatch</h3>
            <p className="text-slate-500 mt-2">Tab components are being rebuilt. Check back soon.</p>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center">
            <h3 className="text-lg font-medium text-slate-300">Settings</h3>
            <p className="text-slate-500 mt-2">Settings tab is being rebuilt. Check back soon.</p>
          </div>
        )}
      </div>
    </div>
  )
}
