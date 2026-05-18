/**
 * REPORTS (replaces generateSheetReport)
 * + MISC OPERATIONS (markJobPaid, archive)
 */
import { supabase } from '../supabase'

export async function generateReport(type: string, startDate: string, endDate: string) {
  switch (type) {
    case 'SEPA': {
      const { data } = await supabase.from('weight_logs').select('*')
        .gte('logged_at', startDate).lte('logged_at', endDate + 'T23:59:59')
        .order('logged_at')
      return data ?? []
    }
    case 'FINANCE': {
      const { data } = await supabase.from('cash_log').select('*')
        .gte('logged_at', startDate).lte('logged_at', endDate + 'T23:59:59')
        .order('logged_at')
      return data ?? []
    }
    case 'ASSETS': {
      const { data } = await supabase.from('inventory').select('*')
        .in('status', ['Delivered', 'In Use'])
      return data ?? []
    }
    case 'DRIVER_MANIFEST': {
      const { data } = await supabase.from('orders').select('*')
        .gte('date', startDate).lte('date', endDate)
        .eq('status', 'Completed')
        .order('driver_name')
      return data ?? []
    }
    default:
      return []
  }
}

// ── Misc Operations ──────────────────────────────────────────

export async function markJobPaid(id: string, source: 'Orders' | 'CashLog') {
  if (source === 'Orders') {
    await supabase.from('orders').update({ paid: true }).eq('id', id)
  } else {
    // Get cost_gross and set amount_paid = cost_gross
    const { data } = await supabase.from('cash_log').select('cost_gross').eq('id', id).single()
    if (data) {
      await supabase.from('cash_log').update({ amount_paid: data.cost_gross }).eq('id', id)
    }
  }
  return { success: true, message: 'Paid!' }
}

// ── Data Archival ────────────────────────────────────────────

export async function archiveOldOrders(olderThanDays: number = 365) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - olderThanDays)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  // Move completed orders older than cutoff to archive
  const { data: oldOrders } = await supabase
    .from('orders')
    .select('*')
    .eq('status', 'Completed')
    .lte('date', cutoffStr)

  if (!oldOrders?.length) return { success: true, message: 'No orders to archive.', count: 0 }

  // Insert into archive table
  const archiveRows = oldOrders.map(o => ({
    original_id: o.id,
    data: o,
    archived_at: new Date().toISOString(),
  }))

  const { error: insertErr } = await supabase.from('archive_orders').insert(archiveRows)
  if (insertErr) throw insertErr

  // Delete from main orders table
  const ids = oldOrders.map(o => o.id)
  const { error: deleteErr } = await supabase.from('orders').delete().in('id', ids)
  if (deleteErr) throw deleteErr

  return { success: true, message: `Archived ${oldOrders.length} orders older than ${olderThanDays} days.`, count: oldOrders.length }
}
