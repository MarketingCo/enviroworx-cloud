'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { DEFAULT_CONFIG } from '@/lib/config'
import toast, { Toaster } from 'react-hot-toast'
import { Database } from '@/lib/database.types'
import { ErrorBoundary } from '@/components/ErrorBoundary'

/**
 * CUSTOMER PORTAL (replaces CustomerPortal.html)
 * Self-service portal for customers to:
 * - View their order history and spend
 * - Schedule collections
 * - Update contact details
 * - View invoices and outstanding balance
 *
 * AUTH: Uses Supabase Auth (email + password).
 * After login, looks up customer by auth_user_id.
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

function CustomerPortal() {
  const [screen, setScreen] = useState<'login' | 'dashboard'>('login')
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [cashLogs, setCashLogs] = useState<CashLogRow[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'overview' | 'orders' | 'tips' | 'request' | 'details'>('overview')
  const [payLoading, setPayLoading] = useState(false)

  // Login state — Supabase Auth (email + password)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Skip hire booking request state
  const [bookJobType, setBookJobType] = useState<'Delivery' | 'Collection' | 'Swap'>('Delivery')
  const [bookSkipSize, setBookSkipSize] = useState('8')
  const [collAddress, setCollAddress] = useState('')
  const [collDate, setCollDate] = useState('')
  const [collNotes, setCollNotes] = useState('')
  const [bookSubmitted, setBookSubmitted] = useState(false)

  // Edit contact state
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editAddress, setEditAddress] = useState('')

  // Check existing session on mount
  useEffect(() => {
    checkExistingSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function checkExistingSession() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      await loadCustomerByAuthId(session.user.id)
    }
    setLoading(false)
  }

  async function loadCustomerByAuthId(authUserId: string) {
    // Look up customer by auth_user_id
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('auth_user_id', authUserId)
      .single()

    if (error || !data) {
      toast.error('No customer account linked to this login. Contact the office.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    const cust = data as Customer
    setCustomer(cust)
    setEditPhone(cust.phone || '')
    setEditEmail(cust.email || '')
    setEditAddress(cust.shipping_address || '')
    await loadCustomerData(cust.name, cust.id)
    setScreen('dashboard')
  }

  async function handleLogin() {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      return toast.error('Enter your email and password')
    }
    setLoading(true)

    // Step 1: Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword.trim(),
    })

    if (authError || !authData.user) {
      toast.error(authError?.message || 'Invalid email or password')
      setLoading(false)
      return
    }

    // Step 2: Look up customer by auth_user_id
    await loadCustomerByAuthId(authData.user.id)
    setLoading(false)
  }

  async function loadCustomerData(_name: string, customerId?: string) {
    const ordersQuery = supabase.from('orders').select('*')
      .order('date', { ascending: false })
      .limit(100)
    const cashLogQuery = supabase.from('cash_log').select('*')
      .order('logged_at', { ascending: false })
      .limit(100)

    // Always use customer_id FK join (Phase 9 migration complete)
    if (customerId) {
      ordersQuery.eq('customer_id', customerId)
      cashLogQuery.eq('customer_id', customerId)
    } else {
      // No customerId provided — return empty to avoid unfiltered data leak
      setOrders([])
      setCashLogs([])
      return
    }

    const [{ data: ords }, { data: cls }] = await Promise.all([
      ordersQuery,
      cashLogQuery,
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

    const netPrice = DEFAULT_CONFIG.pricesSkip[bookSkipSize] ?? null
    const priceNote = netPrice ? ` [Net: £${netPrice}]` : ''

    const { error } = await supabase.from('orders').insert({
      date: collDate,
      status: 'Booked' as Database["public"]["Enums"]["order_status"],
      job_type: bookJobType as Database["public"]["Enums"]["job_type"],
      skip_size: bookJobType === 'Collection' ? 'N/A' : bookSkipSize,
      address: collAddress.trim(),
      customer_id: customer!.id,
      customer_name: customer!.name,
      phone: customer!.phone,
      payment_method: 'Invoice' as Database["public"]["Enums"]["payment_method"],
      delivery_comments: `[Portal Request]${priceNote}${collNotes ? ' ' + collNotes : ''}`.trim(),
    })

    if (error) {
      toast.error('Failed to submit request')
    } else {
      toast.success(`${bookJobType} requested! We'll confirm shortly.`)
      setCollAddress('')
      setCollDate('')
      setCollNotes('')
      setBookSubmitted(true)
      await loadCustomerData(customer!.name, customer!.id)
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

  async function handlePayNow() {
    if (!customer || outstanding <= 0) return
    setPayLoading(true)
    const unpaidOrderIds = orders
      .filter(o => o.status === 'Completed' && !o.paid && o.payment_method === 'Invoice')
      .map(o => o.id)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          customerName: customer.name,
          customerEmail: customer.email,
          orderIds: unpaidOrderIds,
          amount: outstanding,
          description: `Enviroworx Invoice — ${unpaidOrderIds.length} outstanding item(s)`,
        }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else toast.error(data.error || 'Payment failed to initialise')
    } catch {
      toast.error('Payment error — please call the office')
    }
    setPayLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setScreen('login')
    setCustomer(null)
    setOrders([])
    setCashLogs([])
    setLoginEmail('')
    setLoginPassword('')
    setTab('overview')
  }

  // Check for payment redirect
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const payment = params.get('payment')
    if (payment === 'success') {
      toast.success('Payment successful! Thank you for your payment.')
      // Remove the query param
      window.history.replaceState({}, '', window.location.pathname)
      // Refresh invoice list
      if (customer) {
        loadCustomerData(customer.name, customer.id)
      }
    } else if (payment === 'cancelled') {
      toast.error('Payment was cancelled.')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [customer])

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
            <label className="block text-slate-400 text-sm font-bold mb-2">Email</label>
            <input
              type="email"
              value={loginEmail}
              onChange={e => setLoginEmail(e.target.value)}
              placeholder="your@email.com"
              autoComplete="email"
              className="w-full p-4 rounded-xl bg-slate-900 border border-slate-600 text-white text-lg mb-5 focus:border-emerald-500 focus:outline-none"
            />

            <label className="block text-slate-400 text-sm font-bold mb-2">Password</label>
            <input
              type="password"
              value={loginPassword}
              onChange={e => setLoginPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
              className="w-full p-4 rounded-xl bg-slate-900 border border-slate-600 text-white text-lg mb-6 focus:border-emerald-500 focus:outline-none"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-700 p-4 rounded-xl text-white font-bold text-lg shadow-lg hover:from-emerald-600 hover:to-emerald-800 transition disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <p className="text-slate-500 text-sm text-center mt-5">
              Don&apos;t have an account? Call the office to set one up.
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
            {t === 'overview' ? '📊 Overview' : t === 'orders' ? '📋 Skip Hire' : t === 'tips' ? '⚖️ Weighbridge' : t === 'request' ? '🚛 Book a Skip' : '👤 My Details'}
          </button>
        ))}
      </div>

      <div className="p-5 max-w-4xl mx-auto">

        {/* OVERVIEW TAB */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* Outstanding Payment Banner */}
            {outstanding > 0 && (
              <div className="bg-red-900/30 border border-red-500/40 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-red-400 font-black text-lg">£{outstanding.toFixed(2)} Outstanding</p>
                  <p className="text-slate-400 text-sm">You have unpaid invoices on your account.</p>
                </div>
                <button
                  onClick={handlePayNow}
                  disabled={payLoading}
                  className="bg-gradient-to-r from-emerald-500 to-emerald-700 text-white font-black px-6 py-3 rounded-xl shadow hover:from-emerald-600 transition disabled:opacity-50 whitespace-nowrap"
                >
                  {payLoading ? 'Redirecting...' : '💳 Pay Now'}
                </button>
              </div>
            )}
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
                      <td className="p-3">
                        {o.paid ? '✅ Paid' : o.payment_method === 'Invoice' ? (
                          <a
                            href={`/api/documents?type=INVOICE&orderId=${o.id}`}
                            target="_blank"
                            className="text-xs font-bold text-blue-400 hover:text-blue-300 underline"
                          >
                            📄 Invoice
                          </a>
                        ) : '—'}
                      </td>
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

        {/* BOOK A SKIP TAB */}
        {tab === 'request' && (
          <div className="max-w-lg mx-auto">
            {bookSubmitted ? (
              <div className="bg-slate-800 rounded-xl p-8 border border-emerald-700 text-center">
                <div className="text-4xl mb-4">✅</div>
                <h3 className="text-xl font-bold text-emerald-400 mb-2">Request Submitted!</h3>
                <p className="text-slate-400 text-sm mb-6">
                  We&apos;ll confirm your {bookJobType.toLowerCase()} and send an SMS once a driver is assigned.
                </p>
                <button
                  onClick={() => setBookSubmitted(false)}
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-bold transition"
                >
                  Book Another
                </button>
              </div>
            ) : (
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-5">
                <div>
                  <h3 className="text-lg font-bold mb-1">Book a Skip / Collection</h3>
                  <p className="text-slate-400 text-sm">Request a skip hire or collection. You&apos;ll get SMS confirmation once a driver is assigned.</p>
                </div>

                {/* Job Type */}
                <div>
                  <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Job Type</label>
                  <div className="flex gap-2">
                    {(['Delivery', 'Collection', 'Swap'] as const).map(jt => (
                      <button
                        key={jt}
                        onClick={() => setBookJobType(jt)}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${bookJobType === jt ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-600'}`}
                      >
                        {jt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Skip Size + Price */}
                {bookJobType !== 'Collection' && (
                  <div>
                    <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Skip Size</label>
                    <div className="grid grid-cols-4 gap-2">
                      {Object.entries(DEFAULT_CONFIG.pricesSkip).map(([size, price]) => (
                        <button
                          key={size}
                          onClick={() => setBookSkipSize(size)}
                          className={`py-3 rounded-lg text-center transition ${bookSkipSize === size ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-600'}`}
                        >
                          <div className="font-black text-lg">{size}yd</div>
                          <div className="text-xs opacity-70">£{price}</div>
                        </button>
                      ))}
                    </div>
                    {bookSkipSize && DEFAULT_CONFIG.pricesSkip[bookSkipSize] && (
                      <div className="mt-3 p-3 bg-emerald-900/30 border border-emerald-700/50 rounded-lg">
                        <p className="text-emerald-400 font-bold text-sm">
                          Estimated price: £{DEFAULT_CONFIG.pricesSkip[bookSkipSize]} + VAT
                          <span className="text-slate-400 font-normal ml-2">(= £{(DEFAULT_CONFIG.pricesSkip[bookSkipSize] * (1 + DEFAULT_CONFIG.vatRate)).toFixed(0)} inc VAT)</span>
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Address */}
                <div>
                  <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">
                    {bookJobType === 'Collection' ? 'Collection Address' : 'Delivery Address'}
                  </label>
                  <input
                    type="text"
                    value={collAddress}
                    onChange={e => setCollAddress(e.target.value)}
                    placeholder={customer?.shipping_address || 'e.g. 14 High Street, Edinburgh'}
                    className="w-full p-3 rounded-lg bg-slate-900 border border-slate-600 text-white focus:border-emerald-500 focus:outline-none"
                  />
                  {customer?.shipping_address && !collAddress && (
                    <button
                      onClick={() => setCollAddress(customer.shipping_address ?? '')}
                      className="mt-1 text-xs text-emerald-400 hover:underline"
                    >
                      Use saved address: {customer.shipping_address}
                    </button>
                  )}
                </div>

                {/* Date */}
                <div>
                  <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Preferred Date</label>
                  <input
                    type="date"
                    value={collDate}
                    onChange={e => setCollDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full p-3 rounded-lg bg-slate-900 border border-slate-600 text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Notes (optional)</label>
                  <textarea
                    value={collNotes}
                    onChange={e => setCollNotes(e.target.value)}
                    placeholder="Access instructions, gate codes, any special requirements..."
                    rows={3}
                    className="w-full p-3 rounded-lg bg-slate-900 border border-slate-600 text-white focus:border-emerald-500 focus:outline-none resize-none"
                  />
                </div>

                <button
                  onClick={handleCollectionRequest}
                  disabled={loading || !collDate || !collAddress.trim()}
                  className="w-full bg-gradient-to-r from-emerald-500 to-emerald-700 p-4 rounded-xl text-white font-bold text-lg shadow-lg hover:from-emerald-600 transition disabled:opacity-50"
                >
                  {loading ? 'Submitting...' : `Request ${bookJobType}`}
                </button>
              </div>
            )}
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

export default function PortalPage() {
  return (
    <ErrorBoundary route="/portal">
      <CustomerPortal />
    </ErrorBoundary>
  )
}
