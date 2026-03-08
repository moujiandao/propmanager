import Stripe from 'stripe'
import { createClient } from '../../../../lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function POST(request) {
  const supabaseAdmin = await createClient()
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  let event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object
    await supabaseAdmin
      .from('payments')
      .update({ status: 'completed', ach_status: 'completed', paid_date: new Date().toISOString().split('T')[0] })
      .eq('stripe_payment_intent_id', pi.id)
  }

  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object
    await supabaseAdmin
      .from('payments')
      .update({ status: 'failed', ach_status: 'failed' })
      .eq('stripe_payment_intent_id', pi.id)
  }

  return Response.json({ received: true })
}
