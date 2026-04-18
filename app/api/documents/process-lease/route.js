import { createClient } from '../../../../lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const supabase = await createClient()
  const { documentId, propertyId, unitId, approvedTenants, approvedFields } = await request.json()

  if (!documentId) {
    return NextResponse.json({ error: 'Missing documentId' }, { status: 400 })
  }

  // 1. Fetch document record
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .single()

  if (docError || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  const ai = doc.ai_extracted
  if (!ai || !ai.tenant_name) {
    return NextResponse.json({ error: 'Document has not been parsed or is missing tenant_name' }, { status: 400 })
  }

  // 2. Build the full list of people on the lease, filtered by approvals
  let allPeople = [ai.tenant_name, ...(ai.housemates || [])].filter(n => n && n.trim())
  if (approvedTenants && approvedTenants.length > 0) {
    allPeople = allPeople.filter(name => approvedTenants.includes(name))
  }

  // 3. Look up the unit number text for the contract's `unit` field
  let unitNumber = null
  if (unitId) {
    const { data: unitRow } = await supabase.from('units').select('unit_number').eq('id', unitId).single()
    if (unitRow) unitNumber = unitRow.unit_number
  }

  const landlordId = doc.landlord_id
  const created = []
  const updated = []
  const skipped = []
  let contractsCreated = 0

  for (const personName of allPeople) {
    // 4a. Search tenant_profiles by name (case-insensitive)
    const { data: existing } = await supabase
      .from('tenant_profiles')
      .select('id, name')
      .eq('landlord_id', landlordId)
      .ilike('name', personName.trim())
      .limit(1)

    let tenantId
    if (existing && existing.length > 0) {
      tenantId = existing[0].id
      updated.push(personName)
    } else {
      // Create auth user first (tenant_profiles.id must reference auth.users.id)
      const placeholderEmail = `${personName.trim().toLowerCase().replace(/\s+/g, '.')}.${Date.now()}@placeholder.local`
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: placeholderEmail,
        email_confirm: true,
        user_metadata: { role: 'tenant', name: personName.trim() },
      })

      if (authError) {
        console.error('Failed to create auth user:', authError)
        return NextResponse.json({ error: `Failed to create tenant auth: ${authError.message}` }, { status: 500 })
      }

      const { error: insertError } = await supabase
        .from('tenant_profiles')
        .insert({
          id: authData.user.id,
          name: personName.trim(),
          email: placeholderEmail,
          landlord_id: landlordId,
          property_id: propertyId || null,
          unit_id: unitId || null,
          status: 'active',
        })

      if (insertError) {
        console.error('Failed to create tenant profile:', insertError)
        return NextResponse.json({ error: `Failed to create tenant: ${insertError.message}` }, { status: 500 })
      }
      tenantId = authData.user.id
      created.push(personName)
    }

    // 5. Update tenant profile with approved fields only
    const profileUpdate = {}
    if (!approvedFields || approvedFields.move_in_date) profileUpdate.move_in_date = ai.lease_start_date || null
    if (!approvedFields || approvedFields.move_out_date) profileUpdate.move_out_date = ai.move_out_date || null
    if (!approvedFields || approvedFields.email) profileUpdate.email = ai.email || null
    if (!approvedFields || approvedFields.phone) profileUpdate.phone = ai.phone || null
    if (!approvedFields || approvedFields.home_address) profileUpdate.home_address = ai.home_address || null
    if (!approvedFields || approvedFields.age) profileUpdate.age = ai.age || null
    if (!approvedFields || approvedFields.student_status) profileUpdate.student_status = ai.student_status || null
    if (!approvedFields || approvedFields.student_year) profileUpdate.student_year = ai.student_year || null
    if (!approvedFields || approvedFields.zelle_name) profileUpdate.zelle_name = ai.zelle_name || null
    if (!approvedFields || approvedFields.has_cosigner) profileUpdate.has_cosigner = ai.has_cosigner || false
    // Always set property and unit if provided (these come from the UI dropdowns, not the AI)
    if (propertyId) profileUpdate.property_id = propertyId
    if (unitId) profileUpdate.unit_id = unitId

    if (Object.keys(profileUpdate).length > 0) {
      await supabase
        .from('tenant_profiles')
        .update(profileUpdate)
        .eq('id', tenantId)
    }

    // 6. Upsert contract - only if lease fields are approved, skip if duplicate
    const createContract = !approvedFields || (approvedFields.lease_start_date || approvedFields.rent_amount)
    if (createContract && ai.lease_start_date) {
      const { data: existingContract } = await supabase
        .from('contracts')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('start_date', ai.lease_start_date)
        .limit(1)

      if (existingContract && existingContract.length > 0) {
        skipped.push(personName)
      } else {
        const contractData = { landlord_id: landlordId, tenant_id: tenantId, property_id: propertyId }
        if (!approvedFields || approvedFields.lease_start_date) contractData.start_date = ai.lease_start_date
        if (!approvedFields || approvedFields.lease_end_date) contractData.end_date = ai.lease_end_date
        if (!approvedFields || approvedFields.rent_amount) contractData.rent_amount = ai.rent_amount
        if (unitNumber) contractData.unit = unitNumber

        const { error: contractError } = await supabase
          .from('contracts')
          .insert(contractData)

        if (contractError) {
          console.error('Failed to create contract:', contractError)
          return NextResponse.json({ error: `Failed to create contract: ${contractError.message}` }, { status: 500 })
        }
        contractsCreated++
      }
    }
  }

  return NextResponse.json({ created, updated, skipped, contractsCreated })
}
