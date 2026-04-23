import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST /api/stripe/webhook
 * Handles checkout.session.completed — marks orders as paid and logs activity.
 */
export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!stripeKey || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' })

  const sig = req.headers.get('stripe-signature')
  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  const body = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const meta = session.metadata || {}
    const amountPaid = (session.amount_total || 0) / 100
    const customerName = meta.customer_name || ''
    const orderIds: string[] = meta.order_ids ? JSON.parse(meta.order_ids) : []
    const sessionId = session.id

    // Idempotency: check if this session was already processed
    const { data: existing } = await supabaseAdmin
      .from('cash_log')
      .select('id')
      .ilike('comments', `%[${sessionId}]%`)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json({ received: true, duplicate: true })
    }

    // Mark specific orders as paid
    if (orderIds.length > 0) {
      await supabaseAdmin.from('orders')
        .update({ paid: true })
        .in('id', orderIds)
        .eq('paid', false)
    } else if (customerName) {
      // Fallback: mark all unpaid completed invoice orders for this customer
      await supabaseAdmin.from('orders')
        .update({ paid: true })
        .ilike('customer_name', customerName)
        .eq('status', 'Completed')
        .eq('paid', false)
        .eq('payment_method', 'Invoice')
    }

    // Log the payment via cash_log (with session ID for idempotency)
    await supabaseAdmin.from('cash_log').insert({
      customer_name: customerName || 'Online Payment',
      amount_paid: amountPaid,
      cost_net: 0,
      cost_gross: amountPaid,
      payment_method: 'Card',
      comments: `Online payment received: £${amountPaid.toFixed(2)} [${sessionId}]`,
    })
  }

  return NextResponse.json({ received: true })
}
