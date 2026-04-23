import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout session for outstanding invoices.
 * Body: { customerId, orderIds?, amount, description }
 */
export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' })

  try {
    const { customerId, orderIds, amount, description, customerEmail, customerName } = await req.json()

    if (!customerId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const origin = req.headers.get('origin') || 'https://enviroworx.vercel.app'

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
  } catch (err: any) {
    console.error('Stripe checkout error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
