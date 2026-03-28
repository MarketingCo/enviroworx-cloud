'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { DEFAULT_CONFIG } from '@/lib/config'
import toast, { Toaster } from 'react-hot-toast'

/**
 * CUSTOMER PORTAL (replaces CustomerPortal.html)
 * Self-service portal for customers to:
 * - View their order history and spend
 * - Schedule collections
 * - Update contact details
 * - View invoices and outstanding balance
 */

interface Customer {
  id: string
  name: string
  phone: string
  email: string | null
  billing_address: string | null
  shipping_address: string | null
  account_balance: number | null
  portal_pin: string | null
}

interface OrderRow {
  id: string
  date: string
  job_type: string
  skip_size: string
  address: string
  status: string
  skip_id_used: string | null
  payment_method: string
  paid: boolean
  delivery_comments: string | null
}

interface CashLogRow {
  id: string
  logged_at: string
  ticket_number: string
  waste_type: string
  net_weight: number
  cost_net: number
  cost_gross: number
  amount_paid: number
  payment_method: string
}

export default function CustomerPortal() {
  const [screen, setScreen] = useState<'login' | 'dashboard'>('login')
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [cashLogs, setCashLogs] = useState<CashLogRow[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'overview' | 'orders' | 'tips' | 'request' | 'details'>('overview')

  // Login state
  const [loginName, setLoginName] = useState('')
  const [loginPin, setLoginPin] = useState('')

  // Collection request state
  const [collAddress, setCollAddress] = useState('')
  const [collDate, setCollDate] = useState('')
  const [collNotes, setCollNotes] = useState('')

  // Edit contact state
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editAddress, setEditAddress] = useState('')

  async function handleLogin() {
    if (!loginName.trim() || !loginPin.trim()) return toast.error('Enter your name and PIN')
    setLoading(true)

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .ilike('name', loginName.trim())
      .eq('portal_pin', loginPin.trim())
      .single()

    if (error || !data) {
      toast.error('Invalid name or PIN. Contact the office if you need access.')
      setLoading(false)
      return
    }

    setCustomer(data as Customer)
    setEditPhone(data.phone || '')
    setEditEmail(data.email || '')
    setEditAddress(data.shipping_address || '')
    await loadCustomerData(data.name)
    setScreen('dashboard')
    setLoading(false)
  }

  async function loadCustomerData(name: string) {
    const [{ data: ords }, { data: cls }] = await Promise.all([
      supabase.from('orders').select('*')
        .ilike('customer_name', name)
        .order('date', { ascending: false })
        .limit(100),
      supabase.from('cash_log').select('*')
        .ilike('customer_name', name)
        .order('logged_at', { ascending: false })
        .limit(100),
    ])
    setOrders((ords ?? []) as OrderRow[])
    setCashLogs((cls ?? []) as CashLogRow[])
  }

  function getTotalSpend() {
    const config = DEFAULT_CONFIG
    let total = 0
    for (const o of orders) {
      if (o.status === 'Completed') {
        const size = o.skip_size?.replace(/\D/g, '') ?? ''
        total += (config.pricesSkip[size] || 0) * (1 + config.vatRate)
      }
    }
    for (const cl of cashLogs) {
      total += cl.cost_gross || 0
    }
    return total
  }

  function getOutstanding() {
    const config = DEFAULT_CONFIG
    let owed = 0
    for (const o of orders) {
      if (o.status === 'Completed' && !o.paid && o.payment_method === 'Invoice') {
        const size = o.skip_size?.replace(/\D/g, '') ?? ''
        owed += (config.pricesSkip[size] || 0) * (1 + config.vatRate)
      }
    }
    for (const cl of cashLogs) {
      if (cl.payment_method === 'Invoice' && (cl.amount_paid || 0) < (cl.cost_gross || 0)) {
        owed += (cl.cost_gross || 0) - (cl.amount_paid || 0)
      }
    }
    return owed
  }

  function getActiveSkips() {
    return orders.filter(o =>
      ['Booked', 'Assigned', 'Out for Delivery'].includes(o.status) ||
      (o.status === 'Completed' && o.job_type === 'Delivery' && !orders.some(
        co => co.status === 'Completed' && co.job_type === 'Collection' && co.address === o.address && new Date(co.date) > new Date(o.date)
      ))
    )
  }

  async function handleCollectionRequest() {
    if (!collAddress.trim() || !collDate) return toast.error('Enter address and preferred date')
    setLoading(true)

    const { error } = await supabase.from('orders').insert({
      date: collDate,
      status: 'Booked' as any,
      job_type: 'Collection' as any,
      address: collAddress.trim(),
      customer_id: customer!.id,
      customer_name: customer!.name,
      phone: customer!.phone,
      payment_method: 'Invoice' as any,
      delivery_comments: `[Portal Request] ${collNotes}`.trim(),
    })

    if (error) {
      toast.error('Failed to submit request')
    } else {
      toast.success('Collection requested! We\'ll confirm shortly.')
      setCollAddress('')
      setCollDate('')
      setCollNotes('')
      await loadCustomerData(customer!.name)
    }
    setLoading(false)
  }

  async function handleUpdateContact() {
    if (!customer) return
    setLoading(true)

    const { error } = await supabase.from('customers').update({
      phone: editPhone,
      email: editEmail,
      shipping_address: editAddress,
    }).eq('id', customer.id)

    if (error) {
      toast.error('Failed to update details')
    } else {
      toast.success('Details updated!')
      setCustomer({ ...customer, phone: editPhone, email: editEmail, shipping_address: editAddress })
    }
    setLoading(false)
  }

  function handleLogout() {
    setScreen('login')
    setCustomer(null)
    setOrders([])
    setCashLogs([])
    setLoginName('')
    setLoginPin('')
    setTab('overview')
  }

  // ── LOGIN SCREEN ──
  if (screen === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-800 flex items-center justify-center p-5">
        <Toaster position="top-center" />
        <div className="w-full max-w-sm">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-black text-emerald-400 mb-2">ENVIROWORX</h1>
            <p className="text-slate-400 text-lg">Customer Portal</p>
          </div>

          <div className="bg-slate-800/70 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border border-slate-700">
            <label className="block text-slate-400 text-sm font-bold mb-2">Your Name</label>
            <input
              type="text"
              value={loginName}
              onChange={e => setLoginName(e.target.value)}
              placeholder="e.g. Smith Construction"
              className="w-full p-4 rounded-xl bg-slate-900 border border-slate-600 text-white text-lg mb-5 focus:border-emerald-500 focus:outline-none"
            />

            <label className="block text-slate-400 text-sm font-bold mb-2">Portal PIN</label>
            <input
              type="password"
              value={loginPin}
              onChange={e => setLoginPin(e.target.value)}
              placeholder="4-digit PIN"
              maxLength={4}
              className="w-full p-4 rounded-xl bg-slate-900 border border-slate-600 text-white text-lg mb-6 focus:border-emerald-500 focus:outline-none"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-700 p-4 rounded-xl text-white font-bold text-lg shadow-lg hover:from-emerald-600 hover:to-emerald-800 transition disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Sign In'}
            </button>

            <p className="text-slate-500 text-sm text-center mt-5">
              Don&apos;t have a PIN? Call the office to set one up.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── DASHBOARD ──
  const totalSpend = getTotalSpend()
  const outstanding = getOutstanding()
  const completedOrders = orders.filter(o => o.status === 'Completed').length

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Toaster position="top-center" />

      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-5 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-emerald-400">ENVIROWORX</h1>
          <p className="text-slate-400 text-sm">Welcome, {customer?.name}</p>
        </div>
        <button onClick={handleLogout} className="text-slate-400 hover:text-white text-sm font-bold px-4 py-2 bg-slate-700 rounded-lg">
          Sign Out
        </button>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-slate-700 bg-slate-800/50 overflow-x-auto">
        {(['overview', 'orders', 'tips', 'request', 'details'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-3 text-sm font-bold whitespace-nowrap transition ${tab === t ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-400 hover:text-white'}`}
          >
            {t === 'overview' ? '📊 Overview' : t === 'orders' ? '📋 Skip Hire' : t === 'tips' ? '⚖️ Weighbridge' : t === 'request' ? '🚛 Request Collection' : '👤 My Details'}
          </button>
        ))}
      </div>

      <div className="p-5 max-w-4xl mx-auto">

        {/* OVERVIEW TAB */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Orders" value={String(completedOrders)} color="text-emerald-400" />
              <StatCard label="Weighbridge Trips" value={String(cashLogs.length)} color="text-blue-400" />
              <StatCard label="Total Spend" value={`£${totalSpend.toFixed(0)}`} color="text-amber-400" />
              <StatCard label="Outstanding" value={`£${outstanding.toFixed(0)}`} color={outstanding > 0 ? 'text-red-400' : 'text-emerald-400'} />
            </div>

            {/* Recent Activity */}
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <h3 className="text-lg font-bold mb-4">Recent Activity</h3>
              {orders.slice(0, 5).map(o => (
                <div key={o.id} className="flex justify-between items-center py-3 border-b border-slate-700 last:border-0">
                  <div>
                    <span className={`text-sm font-bold ${o.job_type === 'Delivery' ? 'text-emerald-400' : o.job_type === 'Collection' ? 'text-red-400' : 'text-amber-400'}`}>
                      {o.job_type}
                    </span>
                    <span className="text-slate-400 text-sm ml-2">{o.skip_size}yd</span>
                    <p className="text-slate-300 text-sm">{o.address}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-400 text-sm">{o.date}</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      o.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400' :
                      o.status === 'Booked' ? 'bg-blue-500/20 text-blue-400' :
                      o.status === 'Cancelled' ? 'bg-red-500/20 text-red-400' :
                      'bg-amber-500/20 text-amber-400'
                    }`}>{o.status}</span>
                  </div>
                </div>
              ))}
              {orders.length === 0 && <p className="text-slate-500 text-center py-4">No orders yet.</p>}
            </div>
          </div>
        )}

        {/* ORDERS TAB */}
        {tab === 'orders' && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700">
              <h3 className="text-lg font-bold">Skip Hire History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-700/50">
                  <tr>
                    <th className="text-left p-3 text-slate-400">Date</th>
                    <th className="text-left p-3 text-slate-400">Type</th>
                    <th className="text-left p-3 text-slate-400">Size</th>
                    <th className="text-left p-3 text-slate-400">Address</th>
                    <th className="text-left p-3 text-slate-400">Status</th>
                    <th className="text-left p-3 text-slate-400">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="p-3">{o.date}</td>
                      <td className="p-3">{o.job_type}</td>
                      <td className="p-3">{o.skip_size}yd</td>
                      <td className="p-3 max-w-[200px] truncate">{o.address}</td>
                      <td className="p-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          o.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400' :
                          o.status === 'Booked' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-amber-500/20 text-amber-400'
                        }`}>{o.status}</span>
                      </td>
                      <td className="p-3">{o.paid ? '✅' : o.payment_method === 'Invoice' ? '📧 Invoice' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {orders.length === 0 && <p className="text-slate-500 text-center py-8">No orders found.</p>}
            </div>
          </div>
        )}

        {/* WEIGHBRIDGE TIPS TAB */}
        {tab === 'tips' && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700">
              <h3 className="text-lg font-bold">Weighbridge History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-700/50">
                  <tr>
                    <th className="text-left p-3 text-slate-400">Date</th>
                    <th className="text-left p-3 text-slate-400">Ticket</th>
                    <th className="text-left p-3 text-slate-400">Waste</th>
                    <th className="text-right p-3 text-slate-400">Net (kg)</th>
                    <th className="text-right p-3 text-slate-400">Net £</th>
                    <th className="text-right p-3 text-slate-400">Gross £</th>
                    <th className="text-left p-3 text-slate-400">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {cashLogs.map(cl => (
                    <tr key={cl.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="p-3">{new Date(cl.logged_at).toLocaleDateString('en-GB')}</td>
                      <td className="p-3 font-mono text-emerald-400">{cl.ticket_number}</td>
                      <td className="p-3">{cl.waste_type}</td>
                      <td className="p-3 text-right">{cl.net_weight?.toLocaleString()}</td>
                      <td className="p-3 text-right">£{(cl.cost_net || 0).toFixed(2)}</td>
                      <td className="p-3 text-right font-bold">£{(cl.cost_gross || 0).toFixed(2)}</td>
                      <td className="p-3">{(cl.amount_paid || 0) >= (cl.cost_gross || 0) ? '✅' : '📧'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {cashLogs.length === 0 && <p className="text-slate-500 text-center py-8">No weighbridge records found.</p>}
            </div>
          </div>
        )}

        {/* REQUEST COLLECTION TAB */}
        {tab === 'request' && (
          <div className="max-w-lg mx-auto">
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-bold mb-5">Request a Collection</h3>
              <p className="text-slate-400 text-sm mb-6">
                Submit a collection request and we&apos;ll schedule it for you. You&apos;ll get an SMS confirmation once a driver is assigned.
              </p>

              <label className="block text-slate-400 text-sm font-bold mb-2">Collection Address</label>
              <input
                type="text"
                value={collAddress}
                onChange={e => setCollAddress(e.target.value)}
                placeholder="e.g. 14 High Street, Edinburgh"
                className="w-full p-3 rounded-lg bg-slate-900 border border-slate-600 text-white mb-4 focus:border-emerald-500 focus:outline-none"
              />

              <label className="block text-slate-400 text-sm font-bold mb-2">Preferred Date</label>
              <input
                type="date"
                value={collDate}
                onChange={e => setCollDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full p-3 rounded-lg bg-slate-900 border border-slate-600 text-white mb-4 focus:border-emerald-500 focus:outline-none"
              />

              <label className="block text-slate-400 text-sm font-bold mb-2">Notes (optional)</label>
              <textarea
                value={collNotes}
                onChange={e => setCollNotes(e.target.value)}
                placeholder="Any access instructions or details"
                rows={3}
                className="w-full p-3 rounded-lg bg-slate-900 border border-slate-600 text-white mb-6 focus:border-emerald-500 focus:outline-none resize-none"
              />

              <button
                onClick={handleCollectionRequest}
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-700 p-4 rounded-xl text-white font-bold text-lg shadow-lg hover:from-emerald-600 transition disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit Collection Request'}
              </button>
            </div>
          </div>
        )}

        {/* MY DETAILS TAB */}
        {tab === 'details' && (
          <div className="max-w-lg mx-auto">
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-bold mb-5">My Contact Details</h3>

              <label className="block text-slate-400 text-sm font-bold mb-2">Phone</label>
              <input
                type="tel"
                value={editPhone}
                onChange={e => setEditPhone(e.target.value)}
                className="w-full p-3 rounded-lg bg-slate-900 border border-slate-600 text-white mb-4 focus:border-emerald-500 focus:outline-none"
              />

              <label className="block text-slate-400 text-sm font-bold mb-2">Email</label>
              <input
                type="email"
                value={editEmail}
                onChange={e => setEditEmail(e.target.value)}
                className="w-full p-3 rounded-lg bg-slate-900 border border-slate-600 text-white mb-4 focus:border-emerald-500 focus:outline-none"
              />

              <label className="block text-slate-400 text-sm font-bold mb-2">Default Address</label>
              <input
                type="text"
                value={editAddress}
                onChange={e => setEditAddress(e.target.value)}
                className="w-full p-3 rounded-lg bg-slate-900 border border-slate-600 text-white mb-6 focus:border-emerald-500 focus:outline-none"
              />

              <button
                onClick={handleUpdateContact}
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-700 p-4 rounded-xl text-white font-bold text-lg shadow-lg hover:from-emerald-600 transition disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Update Details'}
              </button>
            </div>

            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mt-5">
              <h3 className="text-lg font-bold mb-3">Account Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Account Name</span> <span className="font-bold">{customer?.name}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Total Spend</span> <span className="font-bold text-amber-400">£{totalSpend.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Outstanding Balance</span> <span className={`font-bold ${outstanding > 0 ? 'text-red-400' : 'text-emerald-400'}`}>£{outstanding.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Completed Jobs</span> <span className="font-bold">{completedOrders}</span></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <p className="text-slate-400 text-xs font-bold mb-1">{label}</p>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
    </div>
  )
}
