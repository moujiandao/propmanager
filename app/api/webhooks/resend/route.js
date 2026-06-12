import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// Resend webhook: handles delivery/open/bounce/complaint events (matched on the
// Resend message id) and inbound replies (correlated back to the original send
// via the reply+<id>@ sub-address, then In-Reply-To headers, then sender email).
//
// Signed with Svix (same scheme Resend uses). We verify with node:crypto so no
// extra dependency is needed.

const SVIX_TOLERANCE_S = 300   // reject replays older/newer than 5 minutes

function verifySvix(secret, headers, body) {
  if (!secret) return false
  const id = headers.get('svix-id')
  const ts = headers.get('svix-timestamp')
  const sigHeader = headers.get('svix-signature')
  if (!id || !ts || !sigHeader) return false
  // Replay guard: timestamp must be within tolerance of now.
  const tsNum = parseInt(ts, 10)
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > SVIX_TOLERANCE_S) return false
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const expected = crypto.createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64')
  // svix-signature is space-separated "v1,<sig>" pairs
  return sigHeader.split(' ').some(part => {
    const sig = part.split(',')[1]
    if (!sig || sig.length !== expected.length) return false
    try { return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) } catch { return false }
  })
}

const admin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Pull the originating message id out of a reply+<uuid>@domain sub-address.
function originIdFromAddresses(addrs) {
  for (const a of [].concat(addrs || [])) {
    const m = String(a?.address || a || '').match(/reply\+([0-9a-f-]{36})@/i)
    if (m) return m[1]
  }
  return null
}

export async function POST(request) {
  const body = await request.text()
  if (!verifySvix(process.env.RESEND_WEBHOOK_SECRET, request.headers, body)) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event
  try { event = JSON.parse(body) } catch { return Response.json({ error: 'Bad JSON' }, { status: 400 }) }
  const supabase = admin()
  const type = event?.type || ''
  const data = event?.data || {}

  // ── Delivery / engagement events ──
  const statusByType = {
    'email.delivered': { status: 'delivered', col: 'delivered_at' },
    'email.opened': { status: 'opened', col: 'opened_at' },
    'email.bounced': { status: 'bounced' },
    'email.complained': { status: 'complained' },
    'email.delivery_delayed': { status: 'sent' },
  }
  if (statusByType[type]) {
    const resendId = data.email_id || data.id
    if (resendId) {
      const patch = { status: statusByType[type].status }
      if (statusByType[type].col) patch[statusByType[type].col] = event.created_at || new Date().toISOString()
      // Don't downgrade a replied/opened row back to delivered.
      const { data: row } = await supabase.from('email_messages').select('id,status,opened_at').eq('resend_message_id', resendId).maybeSingle()
      if (row) {
        if (type === 'email.delivered' && (row.opened_at)) delete patch.status
        await supabase.from('email_messages').update(patch).eq('id', row.id)
      }
    }
    return Response.json({ received: true })
  }

  // ── Inbound reply ──
  // Gate strictly on inbound event types; only fall back to shape-sniffing when
  // the type is unrecognized AND the payload looks like a received message
  // (so outbound delivery events that carry data.from aren't misclassified).
  const INBOUND_TYPES = ['inbound.email.received', 'email.inbound', 'email.received']
  const looksInbound = !type && data?.from && (data?.text || data?.html)
  if (INBOUND_TYPES.includes(type) || looksInbound) {
    const when = event.created_at || new Date().toISOString()
    // 1) reply+<id>@ sub-address  2) In-Reply-To/References header  3) sender email
    let originId = originIdFromAddresses(data.to)
    if (!originId) {
      const hdrs = data.headers || {}
      const ref = hdrs['in-reply-to'] || hdrs['In-Reply-To'] || hdrs.references || ''
      const m = String(ref).match(/reply\+([0-9a-f-]{36})@/i)
      if (m) originId = m[1]
    }

    let origin = null
    if (originId) {
      const { data: o } = await supabase.from('email_messages').select('*').eq('id', originId).maybeSingle()
      origin = o
    }
    const fromAddr = data.from?.address || data.from || ''
    if (!origin && fromAddr) {
      const { data: ten } = await supabase.from('tenant_profiles').select('id,landlord_id').eq('email', fromAddr).maybeSingle()
      if (ten) {
        const { data: o } = await supabase.from('email_messages')
          .select('*').eq('tenant_id', ten.id).eq('direction', 'outbound')
          .order('created_at', { ascending: false }).limit(1).maybeSingle()
        origin = o
      }
    }
    if (!origin) return Response.json({ received: true, note: 'no matching outbound message' })

    await supabase.from('email_messages').insert({
      landlord_id: origin.landlord_id,
      direction: 'inbound',
      tenant_id: origin.tenant_id,
      automation_id: origin.automation_id,
      template_id: origin.template_id,
      to_email: fromAddr,
      subject: data.subject || `Re: ${origin.subject || ''}`,
      body_html: data.html || null,
      body_text: data.text || null,
      status: 'received',
      reply_to_message_id: origin.id,
    })
    await supabase.from('email_messages').update({ replied_at: when }).eq('id', origin.id)
    return Response.json({ received: true })
  }

  return Response.json({ received: true, ignored: type })
}
