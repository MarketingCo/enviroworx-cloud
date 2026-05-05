/**
 * SMS API Route (replaces sendTwilioSMS from Code.gs)
 * POST /api/sms { to: "+447...", body: "message" }
 */
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

export async function POST(request: Request) {
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
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e.message })
  }
}
