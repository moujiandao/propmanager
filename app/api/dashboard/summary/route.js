import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { statusForRow } from '@/lib/tenant/status'

const client = new Anthropic()

const isoDate = (d) => d.toISOString().slice(0, 10)
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000)
const fullName = (t) => [t.name, t.last_name].filter(Boolean).join(' ').trim() || 'Unnamed tenant'

function buildFacts({ tenants: rawTenants, contracts, payments, maintenance, properties, units, now }) {
  // Tenant status is DERIVED from the move-in/move-out dates (lib/tenant/status.js), not read
  // from the stored column. Normalize once here so the `t.status === ...` comparisons below
  // stay as they are, and so they agree with what the UI shows for the same tenant.
  const tenants = rawTenants.map(t => ({ ...t, status: statusForRow(t, now) }))

  const today = isoDate(now)
  const in30 = isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30))
  const in60 = isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 60))

  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonthKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`
  const prevMonthLastDay = new Date(now.getFullYear(), now.getMonth(), 0).getDate()
  const prevMonthEnd = `${prevMonthKey}-${String(prevMonthLastDay).padStart(2, '0')}`
  const prevMonthLabel = prevMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  const propertyById = new Map(properties.map(p => [p.id, p]))
  const unitById = new Map(units.map(u => [u.id, u]))
  const labelFor = (t) => {
    const prop = propertyById.get(t.property_id)
    const unit = unitById.get(t.unit_id)
    const unitLabel = unit?.unit_number || t.unit || ''
    const addr = prop?.address || 'Unknown property'
    return unitLabel ? `Unit ${unitLabel} · ${addr}` : addr
  }

  const movingIn30 = tenants
    .filter(t => t.status === 'future tenant' && t.move_in_date && t.move_in_date >= today && t.move_in_date <= in30)
    .map(t => ({
      tenant: fullName(t),
      where: labelFor(t),
      moveInDate: t.move_in_date,
      securityDepositReceived: Number(t.security_deposit || 0) > 0,
    }))

  const movingOut30 = tenants
    .filter(t => t.status === 'current tenant' && t.move_out_date && t.move_out_date >= today && t.move_out_date <= in30)
    .map(t => ({
      tenant: fullName(t),
      where: labelFor(t),
      moveOutDate: t.move_out_date,
    }))

  const futureByKey = new Map()
  tenants.filter(t => t.status === 'future tenant').forEach(t => {
    const key = `${t.property_id || '_'}::${t.unit_id || t.unit || '_'}`
    const existing = futureByKey.get(key)
    if (!existing || (t.move_in_date && (!existing.move_in_date || t.move_in_date < existing.move_in_date))) {
      futureByKey.set(key, t)
    }
  })

  const unitsNeedingTenant = tenants
    .filter(t => t.status === 'current tenant' && t.move_out_date && t.move_out_date >= today && t.move_out_date <= in60)
    .filter(t => {
      const key = `${t.property_id || '_'}::${t.unit_id || t.unit || '_'}`
      return !futureByKey.has(key)
    })
    .map(t => ({
      where: labelFor(t),
      currentTenant: fullName(t),
      moveOutDate: t.move_out_date,
      daysUntilVacant: daysBetween(today, t.move_out_date),
    }))

  const paidPrevMonthTenantIds = new Set(
    payments
      .filter(p => p.status === 'completed' && p.due_date && p.due_date.startsWith(prevMonthKey))
      .map(p => p.tenant_id)
  )
  const wasActiveLastMonth = (t) => {
    if (t.status !== 'current tenant') return false
    if (t.move_in_date && t.move_in_date > prevMonthEnd) return false
    return true
  }
  const unpaidPrevMonth = tenants
    .filter(wasActiveLastMonth)
    .filter(t => !paidPrevMonthTenantIds.has(t.id))
    .map(t => ({
      tenant: fullName(t),
      where: labelFor(t),
      monthlyRent: t.monthly_rent || null,
    }))

  const cleaningsToSchedule = []
  movingOut30.forEach(out => {
    const sameKeyFuture = tenants.find(t =>
      t.status === 'future tenant' &&
      t.move_in_date &&
      labelFor(t) === out.where
    )
    if (sameKeyFuture && sameKeyFuture.move_in_date > out.moveOutDate) {
      const gap = daysBetween(out.moveOutDate, sameKeyFuture.move_in_date)
      cleaningsToSchedule.push({
        where: out.where,
        cleanBy: sameKeyFuture.move_in_date,
        movingOutOn: out.moveOutDate,
        gapDays: gap,
      })
    }
  })

  const openMaint = maintenance
    .filter(m => m.status !== 'resolved' && m.status !== 'closed')
    .map(m => {
      const tenant = tenants.find(t => t.id === m.tenant_id)
      const prop = propertyById.get(m.property_id)
      const ageDays = m.created_at ? daysBetween(m.created_at.slice(0, 10), today) : null
      return {
        tenant: tenant ? fullName(tenant) : null,
        where: prop ? (m.unit ? `Unit ${m.unit} · ${prop.address}` : prop.address) : (m.unit || ''),
        type: m.type || null,
        priority: m.priority || null,
        status: m.status || null,
        description: (m.description || '').slice(0, 200),
        ageDays,
      }
    })

  return {
    today,
    previousMonth: prevMonthLabel,
    counts: {
      properties: properties.length,
      currentTenants: tenants.filter(t => t.status === 'current tenant').length,
      futureTenants: tenants.filter(t => t.status === 'future tenant').length,
      openMaintenance: openMaint.length,
    },
    movingInNext30Days: movingIn30,
    movingOutNext30Days: movingOut30,
    unitsThatNeedNewTenantWithin60Days: unitsNeedingTenant,
    unpaidRentPreviousMonth: unpaidPrevMonth,
    cleaningsToScheduleNext30Days: cleaningsToSchedule,
    openMaintenanceRequests: openMaint,
  }
}

export async function POST(request) {
  const { landlordId, lang } = await request.json()
  if (!landlordId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const targetLang = lang === 'zh' ? 'zh' : 'en'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  try {
    const [tenantsRes, contractsRes, paymentsRes, maintRes, propsRes] = await Promise.all([
      supabase.from('tenant_profiles').select('*').eq('landlord_id', landlordId),
      supabase.from('contracts').select('*').eq('landlord_id', landlordId),
      supabase.from('payments').select('*').eq('landlord_id', landlordId),
      supabase.from('maintenance_requests').select('*').eq('landlord_id', landlordId),
      supabase.from('properties').select('*').eq('landlord_id', landlordId),
    ])

    const firstError = [tenantsRes, contractsRes, paymentsRes, maintRes, propsRes].find(r => r.error)
    if (firstError) {
      return Response.json({ error: firstError.error.message }, { status: 500 })
    }

    const propertyIds = (propsRes.data || []).map(p => p.id)
    const unitsRes = propertyIds.length
      ? await supabase.from('units').select('*').in('property_id', propertyIds)
      : { data: [], error: null }
    if (unitsRes.error) {
      return Response.json({ error: unitsRes.error.message }, { status: 500 })
    }
    const scopedUnits = unitsRes.data || []

    // Properties flagged NOT in production drop out of this briefing, same as the
    // dashboard/Tenants/Payments/To Do List pages. Property count itself is unaffected —
    // only tenant- and maintenance-derived facts are scoped down.
    const excludedPropertyIds = new Set((propsRes.data || []).filter(p => p.in_production === false).map(p => p.id))
    const visibleTenants = (tenantsRes.data || []).filter(t => !t.property_id || !excludedPropertyIds.has(t.property_id))
    const visibleTenantIds = new Set(visibleTenants.map(t => t.id))
    const visiblePayments = (paymentsRes.data || []).filter(p => !p.tenant_id || visibleTenantIds.has(p.tenant_id))
    const visibleMaintenance = (maintRes.data || []).filter(m => !m.property_id || !excludedPropertyIds.has(m.property_id))

    const facts = buildFacts({
      tenants: visibleTenants,
      contracts: contractsRes.data || [],
      payments: visiblePayments,
      maintenance: visibleMaintenance,
      properties: propsRes.data || [],
      units: scopedUnits,
      now: new Date(),
    })

    const prompt = `You are briefing a landlord on what needs attention. Below is a JSON snapshot. Output an EXTREMELY concise per-unit briefing. Group every event under its unit. Grammar does not need to be perfect. Style: shorthand notes a property manager would jot.

FORMAT (follow exactly):
- For each unit that has at least one event, write a unit header on its own line: "Unit <label> · <Property address>"
- Underneath, list each event for that unit on its own indented line starting with two spaces. Max ~10 words per line.
- Separate units with one blank line.
- If a fact is portfolio-wide (e.g. unpaid rent total across multiple units), put it under its respective unit too — do not aggregate across units.
- Each unit's event lines should cover any of: move-out (with count + date), move-in (with count + date), cleaning due (with date), needs new tenant by <date>, open maintenance (specific problem + age), unpaid rent (count + month).

CONTENT RULES:
- DO NOT list tenant names for move-ins, move-outs, cleanings, or unpaid rent. Use a count instead, e.g. "2 move out May 31".
- For maintenance, summarize the ACTUAL problem from the description field in a few words (e.g. "Kitchen: faucet leaking"), then age in days. If no description, fall back to "<type> issue". Tenant name optional, only if it adds clarity.
- ALWAYS use the absolute date from the JSON (e.g., "May 31", "Jun 1"). NEVER use relative date words like "today", "tomorrow", "yesterday", "this week", "next week". The "today" field in the JSON is for your reference only.
- No filler phrases like "Good news is", "You've got", "There is", "Heads up".
- No intro or closing sentence. No markdown, no bullets, no numbering.
- Order units chronologically by the EARLIEST upcoming event date for that unit. Soonest first, farthest in the future last. Treat open maintenance as a present-day event (sort it as if its date is today). Within a unit, also order the event lines from soonest to latest date.
- Skip units that have nothing pressing.
- If nothing is pressing across the entire portfolio, output one line: "All quiet."
- Do not invent anything not in the JSON.

Snapshot:
${JSON.stringify(facts, null, 2)}`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })

    const englishSummary = message.content[0]?.text?.trim() || ''

    let summary = englishSummary
    if (targetLang === 'zh' && englishSummary) {
      const translatePrompt = `Translate the following shorthand property-manager notes into natural, vernacular mainland-China Mandarin. Keep the EXACT same structure: unit header lines, indented event lines (two leading spaces), blank lines between units. Do NOT pad into full sentences, do NOT merge lines, do NOT add filler. Preserve every fact (tenant names, unit labels, dates, counts, dollar amounts) exactly. Keep tenant names in their original English spelling. Keep property addresses in their original English spelling. Match or beat the source length. Return only the translated lines, nothing else.

CRITICAL: Preserve dates exactly as written in the source. If the source says "May 31", translate to "5月31日" — NEVER substitute relative words like "明天" (tomorrow), "今天" (today), "昨天" (yesterday), "本周" (this week), or "下周" (next week). Only use the absolute date.

Notes:
${englishSummary}`
      const zhMessage = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{ role: 'user', content: translatePrompt }],
      })
      summary = zhMessage.content[0]?.text?.trim() || englishSummary
    }

    return Response.json({ summary, lang: targetLang, generatedAt: new Date().toISOString() })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
