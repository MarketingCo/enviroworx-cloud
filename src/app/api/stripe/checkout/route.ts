export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { computeCustomerOutstanding } from '@/lib/payments'
import { getSessionFromRequest } from '@/lib/session'
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { captureError } from '@/lib/monitoring'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

/**
 * POST /api/stripe/checkout
 * Portal customers only — creates Checkout for outstanding balance.
 */
export async function POST(req: NextRequest) {
  const rl = rateLimit(`api:stripe:checkout:${clientIp(req)}`, 10, 60_000)
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec)

  const session = await getSessionFromRequest(req)
  if (!session || session.role !== 'portal') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { customerId, orderIds, amount, description, customerEmail, customerName } =
      await req.json()

    if (!customerId || !amount || amount <= 0 || !customerName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (session.sub !== customerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { owed, unpaidOrderIds, unpaidCashLogIds } = await computeCustomerOutstanding(
      customerId,
      customerName
    )

    if (owed <= 0) {
      return NextResponse.json({ error: 'No outstanding balance' }, { status: 400 })
    }

    if (Math.abs(amount - owed) > 0.01) {
      return NextResponse.json({ error: 'Amount does not match outstanding balance' }, { status: 400 })
    }

    const idsToPay: string[] =
      Array.isArray(orderIds) && orderIds.length > 0
        ? orderIds.filter((id: string) => unpaidOrderIds.includes(id))
        : unpaidOrderIds

    const origin = req.headers.get('origin') || 'https://enviroworx.co.uk'

    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: customerEmail || undefined,
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: description || 'Enviroworx Invoice Payment',
              description: `Account: ${customerName}`,
            },
            unit_amount: Math.round(owed * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        customer_id: customerId,
        customer_name: customerName,
        order_ids: JSON.stringify(idsToPay),
        cash_log_ids: JSON.stringify(unpaidCashLogIds),
      },
      success_url: `${origin}/portal?payment=success`,
      cancel_url: `${origin}/portal?payment=cancelled`,
    })

    return NextResponse.json({ url: checkoutSession.url, sessionId: checkoutSession.id })
  } catch (err: unknown) {
    await captureError(err, { route: '/api/stripe/checkout' })
    const message = err instanceof Error ? err.message : 'Checkout failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
