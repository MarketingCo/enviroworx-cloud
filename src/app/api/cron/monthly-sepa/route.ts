export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/auth'
import { runMonthlySepaDriveSync } from '@/lib/monthly-sepa-drive-sync'

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { searchParams } = new URL(req.url)
    const customStart = searchParams.get('start')
    const customEnd = searchParams.get('end')

    const today = new Date()
    const startStr = customStart
      ? customStart
      : new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0]
    const endStr = customEnd
      ? customEnd
      : new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0]

    const result = await runMonthlySepaDriveSync(startStr, endStr)
    if (!result.success) {
      return NextResponse.json({ message: result.message ?? 'Sync failed' })
    }
    return NextResponse.json({ success: true, count: result.count })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('SEPA Sheets Cron Error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
