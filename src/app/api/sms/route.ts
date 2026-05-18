/**
 * SMS API Route (replaces sendTwilioSMS from Code.gs)
 * POST /api/sms { to: "+447...", body: "message" }
 */
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit'

export async function POST(request: Request) {
  // Rate limit: 5 SMS per minute per IP
  const limit = await rateLimit(getClientIdentifier(request), { maxRequests: 5, windowMs: 60000 })
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 })
  }

  const { to, body } = await request.json()

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
          'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: to, From: from, Body: body }),
      }
    )
    const data = await res.json()
    return NextResponse.json({ success: res.status === 201, sid: data.sid })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ success: false, message })
  }
}
