import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

/**
 * POST /api/stripe/webhook
 * Handles payment_intent.succeeded — marks orders as paid and logs activity.
 */
export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature')!
  const body = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const meta = session.metadata || {}
    const amountPaid = (session.amount_total || 0) / 100
    const customerName = meta.customer_name || ''
    const orderIds: string[] = meta.order_ids ? JSON.parse(meta.order_ids) : []

    if (orderIds.length > 0) {
      await supabase.from('orders')
        .update({ paid: true })
        .in('id', orderIds)
    } else if (customerName) {
      // Mark all unpaid completed invoice orders for this customer
      await supabase.from('orders')
        .update({ paid: true })
        .ilike('customer_name', customerName)
        .eq('status', 'Completed')
        .eq('paid', false)
        .eq('payment_method', 'Invoice')
    }

    // Log the payment
    await supabase.from('activity_log').insert({
      type: 'SYS',
      message: `Online payment received: £${amountPaid.toFixed(2)} from ${customerName}`,
      status: 'Completed',
    })
  }

  return NextResponse.json({ received: true })
}
