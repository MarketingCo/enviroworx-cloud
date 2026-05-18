/**
 * Admin API Routes
 * POST /api/admin
 * body: { action: 'archive' | 'utilization' | 'demurrage' | 'health', ... }
 */
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { archiveOldOrders, getSkipUtilization } from '@/lib/api'
import { supabaseAdmin, safeActivityLog } from '@/lib/supabase'
import { DEFAULT_CONFIG } from '@/lib/config'
import { requireOfficeAuth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const user = await requireOfficeAuth(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized - office login required' }, { status: 401 })
  }

  const body = await request.json()
  const { action: _action, ...requestData } = body
  const action = _action as string

  // Audit-log all admin actions
  await safeActivityLog({
    type: 'ADMIN_ACTION',
    message: `Admin action: ${action} by ${user.id}`,
    status: 'Completed',
    userId: user.id,
    userRole: user.role,
    details: { action, ...requestData },
  })

  switch (body.action) {

    case 'archive': {
      const result = await archiveOldOrders(body.olderThanDays || 365)
      return NextResponse.json(result)
    }

    case 'utilization': {
      const result = await getSkipUtilization()
      return NextResponse.json(result)
    }

    case 'demurrage': {
      // Find all skips deployed beyond demurrage threshold and create charges
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - DEFAULT_CONFIG.demurrageDays)
      const cutoffStr = cutoff.toISOString()

      const { data: overdueSkips } = await supabaseAdmin
        .from('inventory')
        .select('*')
        .in('status', ['In Use', 'Delivered'])
        .lt('delivery_date', cutoffStr)
        .not('customer_name', 'is', null)

      if (!overdueSkips?.length) {
        return NextResponse.json({ success: true, message: 'No overdue skips', count: 0 })
      }

      let charged = 0
      for (const skip of overdueSkips) {
        const daysOut = Math.floor((Date.now() - new Date(skip.delivery_date ?? '').getTime()) / 86400000)
        const daysOverdue = daysOut - DEFAULT_CONFIG.demurrageDays
        if (daysOverdue <= 0) continue

        // Check if demurrage already charged recently (last 7 days)
        const recentCutoff = new Date()
        recentCutoff.setDate(recentCutoff.getDate() - 7)
        const existingQuery = supabaseAdmin
          .from('cash_log')
          .select('id')
          .ilike('comments', '%[DEMURRAGE]%')
          .gte('logged_at', recentCutoff.toISOString())
        // Phase 9: use customer_id FK when available
        if (skip.customer_id) {
          existingQuery.eq('customer_id', skip.customer_id)
        } else {
          existingQuery.ilike('customer_name', skip.customer_name ?? '')
        }
        const { data: existing } = await existingQuery.limit(1)

        if (existing?.length) continue

        const chargeNet = DEFAULT_CONFIG.demurrageNetFee
        const chargeGross = chargeNet * (1 + DEFAULT_CONFIG.vatRate)

        await supabaseAdmin.from('cash_log').insert({
          customer_id: skip.customer_id,
          customer_name: skip.customer_name ?? 'Unknown',
          skip_size: skip.skip_size ?? 'Unknown',
          address: skip.delivery_address ?? 'On Hire',
          waste_type: 'Mix Con',
          gross_weight: 0,
          net_weight: 0,
          cost_net: chargeNet,
          cost_gross: chargeGross,
          amount_paid: 0,
          payment_method: 'Invoice',
          comments: `[DEMURRAGE] Skip ${skip.skip_id} on hire ${daysOut} days (${daysOverdue} days over limit)`,
        })
        charged++
      }

      return NextResponse.json({
        success: true,
        message: `Demurrage charged for ${charged} skips`,
        count: charged,
        totalSkipsChecked: overdueSkips.length,
      })
    }

    case 'health': {
      // System health check — useful for monitoring
      const checks = await Promise.allSettled([
        supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('inventory').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('drivers').select('id', { count: 'exact', head: true }),
      ])

      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        database: checks.every(c => c.status === 'fulfilled') ? 'ok' : 'degraded',
        checks: checks.map((c, i) => ({
          name: ['orders', 'inventory', 'drivers'][i],
          ok: c.status === 'fulfilled',
        })),
      })
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 })
  }
}
