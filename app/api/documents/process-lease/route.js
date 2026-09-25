import { createClient } from '../../../../lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireLandlord, requireTeamRecord, requireTeamRecords } from '@/lib/auth/authorize'
import { createContract } from '../../../../lib/contracts/core.js'
import { createContractsAdapter } from '../../../../lib/contracts/adapter.js'
import { reviewedLeaseImport } from '../../../../lib/documents/lease-extraction.js'

function samePeople(left, right) {
  if (left.length !== right.length) return false
  const normalized = (ids) => [...ids].sort().join('|')
  return normalized(left) === normalized(right)
}

function primaryProfileUpdate(profile, { propertyId, unitId }) {
  const update = {}
  const fields = {
    move_in_date: profile.moveInDate,
    move_out_date: profile.moveOutDate,
    email: profile.email,
    phone: profile.phone,
    home_address: profile.homeAddress,
    age: profile.age,
    student_status: profile.studentStatus,
    student_year: profile.studentYear,
    zelle_name: profile.zelleName,
    has_cosigner: profile.hasCosigner,
  }
  for (const [column, value] of Object.entries(fields)) {
    if (value !== null && value !== undefined) update[column] = value
  }
  if (propertyId) update.property_id = propertyId
  if (unitId) update.unit_id = unitId
  return update
}

async function findOrCreateTenant(supabase, { name, landlordId, propertyId, unitId, primaryProfile, isPrimary }) {
  const { data: existing, error: existingError } = await supabase
    .from('tenant_profiles')
    .select('id')
    .eq('landlord_id', landlordId)
    .ilike('name', name)
    .limit(1)
  if (existingError) throw new Error(`Failed to look up tenant: ${existingError.message}`)

  let tenantId
  let created = false
  if (existing?.length) {
    tenantId = existing[0].id
  } else {
    // Document review has already validated the name. A placeholder user is
    // still needed because tenant_profiles.id references auth.users.id.
    const placeholderEmail = `${name.toLowerCase().replace(/\s+/g, '.')}.${Date.now()}@placeholder.local`
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: placeholderEmail,
      email_confirm: true,
      user_metadata: { role: 'tenant', name },
    })
    if (authError || !authData.user) throw new Error(`Failed to create tenant auth: ${authError?.message || 'unknown error'}`)

    const { error: insertError } = await supabase.from('tenant_profiles').insert({
      id: authData.user.id,
      name,
      email: placeholderEmail,
      landlord_id: landlordId,
      property_id: propertyId || null,
      unit_id: unitId || null,
      // Legacy write-only field. It remains for compatibility, but occupancy
      // is derived from the approved dates elsewhere in the application.
      status: 'active',
    })
    if (insertError) {
      await supabase.auth.admin.deleteUser(authData.user.id)
      throw new Error(`Failed to create tenant: ${insertError.message}`)
    }
    tenantId = authData.user.id
    created = true
  }

  const update = isPrimary
    ? primaryProfileUpdate(primaryProfile, { propertyId, unitId })
    : primaryProfileUpdate({}, { propertyId, unitId })
  if (Object.keys(update).length) {
    const { error: updateError } = await supabase.from('tenant_profiles').update(update).eq('id', tenantId)
    if (updateError) throw new Error(`Failed to update tenant: ${updateError.message}`)
  }
  return { tenantId, created }
}

export async function POST(request) {
  const supabase = await createClient()
  const { documentId, propertyId, unitId, approvedTenants, approvedFields } = await request.json()

  if (!documentId) return NextResponse.json({ error: 'Missing documentId' }, { status: 400 })

  const auth = await requireLandlord()
  if (auth.response) return auth.response

  const access = await requireTeamRecord(supabase, { table: 'documents', id: documentId, landlordId: auth.landlordId, select: 'id, landlord_id, ai_extracted' })
  if (access.response) return access.response
  const doc = access.row
  const propertyAccess = await requireTeamRecords(supabase, { table: 'properties', ids: [propertyId], landlordId: auth.landlordId })
  if (propertyAccess.response) return propertyAccess.response

  let reviewed
  try {
    reviewed = reviewedLeaseImport(doc.ai_extracted, { approvedTenants, approvedFields })
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Document extraction is malformed.' }, { status: 400 })
  }

  let unitNumber = null
  if (unitId) {
    const { data: unitRow, error: unitError } = await supabase.from('units').select('unit_number').eq('id', unitId).single()
    if (unitError || !unitRow) return NextResponse.json({ error: 'Selected unit was not found.' }, { status: 400 })
    unitNumber = unitRow.unit_number
  }

  const created = []
  const updated = []
  const tenantIds = []
  try {
    for (const name of reviewed.people) {
      const isPrimary = name.toLocaleLowerCase() === reviewed.primaryName.toLocaleLowerCase()
      const tenant = await findOrCreateTenant(supabase, {
        name,
        landlordId: auth.landlordId,
        propertyId,
        unitId,
        primaryProfile: reviewed.primaryProfile,
        isPrimary,
      })
      tenantIds.push(tenant.tenantId)
      ;(tenant.created ? created : updated).push(name)
    }
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to apply approved tenant information.' }, { status: 500 })
  }

  let contractsCreated = 0
  let skipped = []
  if (reviewed.contract) {
    // Imports are idempotent only for the same property, start date and exact
    // party set. A roommate needs one shared lease, not a duplicate contract
    // for each name discovered in the document.
    const { data: candidates, error: candidatesError } = await supabase
      .from('contracts')
      .select('id, property_id, unit, contract_tenants(tenant_id)')
      .eq('landlord_id', auth.landlordId)
      .eq('start_date', reviewed.contract.startDate)
    if (candidatesError) return NextResponse.json({ error: candidatesError.message }, { status: 500 })

    const duplicate = (candidates || []).some((contract) =>
      contract.property_id === (propertyId || null)
      && (contract.unit || null) === (unitNumber || null)
      && samePeople((contract.contract_tenants || []).map((link) => link.tenant_id), tenantIds)
    )
    if (duplicate) {
      skipped = reviewed.people
    } else {
      try {
        await createContract(createContractsAdapter(supabase), {
          landlordId: auth.landlordId,
          propertyId,
          unit: unitNumber,
          startDate: reviewed.contract.startDate,
          endDate: reviewed.contract.endDate,
          rentAmount: reviewed.contract.rentAmount,
          dueDay: null,
          tenantIds,
        })
        contractsCreated = 1
      } catch (error) {
        return NextResponse.json({ error: error.message || 'Failed to create lease.' }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ created, updated, skipped, contractsCreated })
}
