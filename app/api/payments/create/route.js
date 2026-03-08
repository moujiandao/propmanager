import Stripe from 'stripe'
import { supabaseAdmin } from '../../../../lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function POST(request) {
  const { tenantId, contractId, amount, landlordId } = await request.json()

  // Get or create Stripe customer for tenant
  const { data: tenant } = await supabaseAdmin
    .from('tenant_profiles')
    .select('stripe_customer_id, email, name')
    .eq('id', tenantId)
    .single()

  let customerId = tenant.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: tenant.email,
      name: tenant.name,
      metadata: { tenantId, landlordId }
    })
    customerId = customer.id
    await supabaseAdmin
      .from('tenant_profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', tenantId)
  }

  // Create PaymentIntent for ACH
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount * 100, // Stripe uses cents
    currency: 'usd',
    customer: customerId,
    payment_method_types: ['us_bank_account'],
    metadata: { tenantId, contractId, landlordId }
  })

  // Save payment record to DB
  await supabaseAdmin.from('payments').insert({
    landlord_id: landlordId,
    tenant_id: tenantId,
    contract_id: contractId,
    amount,
    due_date: new Date().toISOString().split('T')[0],
    status: 'pending',
    type: 'one-time',
    ach_status: 'pending',
    stripe_payment_intent_id: paymentIntent.id
  })

  return Response.json({ clientSecret: paymentIntent.client_secret })
}
