/**
 * DASHBOARD DATA (replaces getBusinessData & getRawDashboardData)
 */
import { supabase } from '../supabase'
import { DEFAULT_CONFIG } from '../config'

export async function getDashboardStats() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL not set')
  }
  const today = new Date().toISOString().split('T')[0]!
  const weekStart = getWeekStart()
  const twoDaysAway = new Date()
  twoDaysAway.setDate(twoDaysAway.getDate() + 2)
  const expiryCutoff = twoDaysAway.toISOString().split('T')[0]

  // Run all queries in parallel
  const [
    { data: completedToday },
    { data: completedWeek },
    { data: futureBookings },
    { data: tipsToday },
    { data: inventorySummary },
    { data: activeTippers },
    { data: unpaidInvoices },
    { data: driverHours },
    { data: collections },
    { data: expiringPermits },
    { data: revenueData },
  ] = await Promise.all([
    supabase.from('orders').select('id', { count: 'exact', head: true })
      .eq('status', 'Completed').eq('date', today),
    supabase.from('orders').select('id', { count: 'exact', head: true })
      .eq('status', 'Completed').gte('date', weekStart),
    supabase.from('orders').select('id', { count: 'exact', head: true })
      .in('status', ['Booked', 'Assigned']).gt('date', today),
    supabase.from('cash_log').select('id', { count: 'exact', head: true })
      .gte('logged_at', today + 'T00:00:00'),
    supabase.from('v_inventory_summary').select('*'),
    supabase.from('active_tippers').select('*').order('timestamp', { ascending: false }),
    supabase.from('v_unpaid_invoices').select('*').limit(100),
    supabase.from('v_driver_hours_today').select('*'),
    supabase.from('v_collections_due').select('*'),
    supabase.from('permits').select('*').lte('expiry_date', expiryCutoff).neq('status', 'Expired'),
    supabase.from('cash_log').select('cost_gross, net_weight, waste_type').gte('logged_at', today + 'T00:00:00')
  ])

  // Calculate estimated profit with dynamic disposal rates
  const totalRev = revenueData?.reduce((sum, r) => sum + (r.cost_gross || 0), 0) ?? 0
  const estDisposalCost = revenueData?.reduce((sum, r) => {
    const rate = DEFAULT_CONFIG.disposalCosts[r.waste_type || 'Mix Con'] || 130
    const tonnage = (r.net_weight || 0) / 1000
    return sum + (tonnage * rate)
  }, 0) ?? 0

  return {
    stats: {
      completedToday: completedToday?.length ?? 0,
      completedWeek: completedWeek?.length ?? 0,
      futureBookings: futureBookings?.length ?? 0,
      tipsToday: tipsToday?.length ?? 0,
      estProfitToday: totalRev - estDisposalCost
    },
    inventorySummary: inventorySummary ?? [],
    activeTippers: activeTippers ?? [],
    unpaidInvoices: unpaidInvoices ?? [],
    driverHours: driverHours ?? [],
    collections: collections ?? [],
    expiringPermits: expiringPermits ?? []
  }
}

// ── Helpers ──────────────────────────────────────────────────

function getWeekStart() {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  return monday.toISOString().split('T')[0]
}
