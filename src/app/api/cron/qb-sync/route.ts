/**
 * QuickBooks Daily Sync Cron
 * GET /api/cron/qb-sync
 *
 * DISABLED — do not enable until invoice amount calculation is implemented.
 * Currently returns 503 to prevent £0 draft invoices from being created.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { verifyCronSecret } from '@/lib/auth'

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json(
    {
      message:
        'QB sync not yet implemented — invoice amount calculation pending. ' +
        'Remove this guard and implement real pricing logic before enabling.',
      status: 'disabled',
    },
    { status: 503 }
  )
}
