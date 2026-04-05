import { createClient } from '../../../../lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const supabase = await createClient()
  const { documentId, propertyId, unitId } = await request.json()

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

  // 2. Build the full list of people on the lease
  const allPeople = [ai.tenant_name, ...(ai.housemates || [])].filter(n => n && n.trim())

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
      // 4c. Insert new tenant profile
      const { data: newTenant, error: insertError } = await supabase
        .from('tenant_profiles')
        .insert({
          name: personName.trim(),
          landlord_id: landlordId,
          property_id: propertyId || null,
          unit_id: unitId || null,
          status: 'active',
        })
        .select('id')
        .single()

      if (insertError) {
        return NextResponse.json({ error: `Failed to create tenant: ${insertError.message}` }, { status: 500 })
      }
      tenantId = newTenant.id
      created.push(personName)
    }

    // 5. Update tenant profile with property/unit/move-in date
    await supabase
      .from('tenant_profiles')
      .update({
        property_id: propertyId || null,
        unit_id: unitId || null,
        move_in_date: ai.lease_start_date || null,
      })
      .eq('id', tenantId)

    // 6. Upsert contract - skip if one already exists for this tenant with same start_date
    if (ai.lease_start_date) {
      const { data: existingContract } = await supabase
        .from('contracts')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('start_date', ai.lease_start_date)
        .limit(1)

      if (existingContract && existingContract.length > 0) {
        skipped.push(personName)
      } else {
        const { error: contractError } = await supabase
          .from('contracts')
          .insert({
            landlord_id: landlordId,
            tenant_id: tenantId,
            property_id: propertyId || null,
            unit: unitNumber,
            start_date: ai.lease_start_date,
            end_date: ai.lease_end_date || null,
            rent_amount: ai.rent_amount || null,
          })

        if (contractError) {
          return NextResponse.json({ error: `Failed to create contract: ${contractError.message}` }, { status: 500 })
        }
        contractsCreated++
      }
    }
  }

  return NextResponse.json({ created, updated, skipped, contractsCreated })
}
