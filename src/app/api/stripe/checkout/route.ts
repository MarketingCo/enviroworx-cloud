export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout session for outstanding invoices.
 * Body: { customerId, orderIds?, amount, description }
 */
export async function POST(req: NextRequest) {
  // Rate limit: 10 checkout attempts per minute per IP
  const limit = await rateLimit(getClientIdentifier(req), { maxRequests: 10, windowMs: 60000 })
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  try {
    const { customerId, orderIds, amount, description, customerEmail, customerName } = await req.json()

    if (!customerId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
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
              images: [],
            },
            unit_amount: Math.round(amount * 100), // pence
          },
          quantity: 1,
        },
      ],
      metadata: {
        customer_id: customerId,
        customer_name: customerName || '',
        order_ids: orderIds ? JSON.stringify(orderIds) : '',
      },
      success_url: `${origin}/portal?payment=success`,
      cancel_url: `${origin}/portal?payment=cancelled`,
    })

    return NextResponse.json({ url: session.url, sessionId: session.id })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Stripe checkout error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
