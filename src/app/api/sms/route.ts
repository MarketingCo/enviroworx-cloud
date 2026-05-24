/**
 * SMS API Route (replaces sendTwilioSMS from Code.gs)
 * POST /api/sms { to: "+447...", body: "message" }
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { canAccessOfficeRoutes } from '@/lib/office-access'
import { createSupabaseMiddlewareClient } from '@/lib/supabase-middleware'
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { captureError } from '@/lib/monitoring'

export async function POST(request: NextRequest) {
  const rl = rateLimit(`api:sms:${clientIp(request)}`, 30, 60_000)
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec)

  const { supabase, response } = createSupabaseMiddlewareClient(request)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const allowed = await canAccessOfficeRoutes(user, request)
  if (!allowed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { to, body } = await request.json()
  if (!to?.trim() || !body?.trim()) {
    return NextResponse.json({ error: 'to and body required' }, { status: 400 })
  }

  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER

  if (!sid || !token || !from) {
    return NextResponse.json({ success: false, message: 'Twilio not configured' })
  }

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: to, From: from, Body: body }),
      }
    )
    const data = await res.json()
    const json = NextResponse.json({ success: res.status === 201, sid: data.sid })
    response.cookies.getAll().forEach((c) => json.cookies.set(c.name, c.value))
    return json
  } catch (e: unknown) {
    await captureError(e, { route: '/api/sms' })
    const message = e instanceof Error ? e.message : 'SMS failed'
    return NextResponse.json({ success: false, message })
  }
}
