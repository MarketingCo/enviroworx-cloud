import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin, safeActivityLog } from '@/lib/supabase'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

export const dynamic = 'force-dynamic'

/**
 * POST /api/stripe/webhook
 * Handles payment_intent.succeeded — marks orders as paid and logs activity.
 */
export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature')
  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }
  const body = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Webhook error: ${message}` }, { status: 400 })
  }

  // Idempotency check — skip duplicate events
  const { data: existing } = await supabaseAdmin
    .from('processed_stripe_events')
    .select('id')
    .eq('id', event.id)
    .single()

  if (existing) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const meta = session.metadata || {}
    const amountPaid = (session.amount_total || 0) / 100
    const customerName = meta.customer_name || ''
    const orderIds: string[] = meta.order_ids ? JSON.parse(meta.order_ids) : []

    // Match by customer_id from metadata (never by customer_name — names collide)
    const customerId = meta.customer_id
    if (orderIds.length > 0) {
      await supabaseAdmin.from('orders')
        .update({ paid: true })
        .in('id', orderIds)
    } else if (customerId) {
      // Mark all unpaid completed invoice orders for this customer by customer_id FK
      await supabaseAdmin.from('orders')
        .update({ paid: true })
        .eq('customer_id', customerId)
        .eq('status', 'Completed')
        .eq('paid', false)
        .eq('payment_method', 'Invoice')
    } else if (customerName) {
      // Fallback: log warning but still use ilike (for legacy events without customer_id in metadata)
      console.warn(`Stripe webhook: customer_id not in metadata for session ${session.id}, falling back to customer_name`)
      await supabaseAdmin.from('orders')
        .update({ paid: true })
        .ilike('customer_name', customerName)
        .eq('status', 'Completed')
        .eq('paid', false)
        .eq('payment_method', 'Invoice')
    }

    // Log the payment
    await safeActivityLog({
      type: 'SYS',
      message: `Online payment received: £${amountPaid.toFixed(2)} from ${customerName || customerId}`,
      status: 'Completed',
    })
  }

  // Mark event as processed
  await supabaseAdmin.from('processed_stripe_events').insert({
    id: event.id,
    type: event.type,
    processed_at: new Date().toISOString(),
  })

  return NextResponse.json({ received: true })
}
