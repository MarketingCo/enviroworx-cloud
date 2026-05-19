export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { computeCustomerOutstanding } from '@/lib/payments'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout session for outstanding invoices.
 * Body: { customerId, orderIds?, amount, description, customerEmail?, customerName }
 */
export async function POST(req: NextRequest) {
  try {
    const { customerId, orderIds, amount, description, customerEmail, customerName } = await req.json()

    if (!customerId || !amount || amount <= 0 || !customerName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { owed, unpaidOrderIds, unpaidCashLogIds } = await computeCustomerOutstanding(customerId, customerName)

    if (owed <= 0) {
      return NextResponse.json({ error: 'No outstanding balance' }, { status: 400 })
    }

    // Reject tampered amounts (allow 1p tolerance for rounding)
    if (Math.abs(amount - owed) > 0.01) {
      return NextResponse.json({ error: 'Amount does not match outstanding balance' }, { status: 400 })
    }

    const idsToPay: string[] = Array.isArray(orderIds) && orderIds.length > 0
      ? orderIds.filter((id: string) => unpaidOrderIds.includes(id))
      : unpaidOrderIds

    if (idsToPay.length === 0 && owed > 0) {
      // Cash-log-only balance — still allow payment but with empty order_ids
    }

    const origin = req.headers.get('origin') || 'https://enviroworx.co.uk'

    const session = await stripe.checkout.sessions.create({
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

    return NextResponse.json({ url: session.url, sessionId: session.id })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Checkout failed'
    console.error('Stripe checkout error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
