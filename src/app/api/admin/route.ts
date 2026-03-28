/**
 * Admin API Routes
 * POST /api/admin
 * body: { action: 'archive' | 'utilization', ... }
 */
import { NextResponse } from 'next/server'
import { archiveOldOrders, getSkipUtilization } from '@/lib/api'

export async function POST(request: Request) {
  const body = await request.json()

  switch (body.action) {
    case 'archive': {
      const result = await archiveOldOrders(body.olderThanDays || 365)
      return NextResponse.json(result)
    }
    case 'utilization': {
      const result = await getSkipUtilization()
      return NextResponse.json(result)
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}
