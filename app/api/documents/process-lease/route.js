import { createClient } from '../../../../lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireLandlord, requireTeamRecord, requireTeamRecords } from '@/lib/auth/authorize'
import { createContract } from '../../../../lib/contracts/core.js'
import { createContractsAdapter } from '../../../../lib/contracts/adapter.js'
import { reviewedLeaseImport } from '../../../../lib/documents/lease-extraction.js'
import { cleanupCreatedTenantAccounts, oneTenantMatch, validateLeaseAssignment } from '../../../../lib/documents/import-safety.js'

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

async function findOrCreateTenant(supabase, { name, landlordId }) {
  const { data: existing, error: existingError } = await supabase
    .from('tenant_profiles')
    .select('id, property_id, unit_id, move_in_date, move_out_date, email, phone, home_address, age, student_status, student_year, zelle_name, has_cosigner')
    .eq('landlord_id', landlordId)
    .ilike('name', name)
  if (existingError) throw new Error(`Failed to look up tenant: ${existingError.message}`)
  const matchedTenant = oneTenantMatch(existing, name)

  let tenantId
  let created = false
  if (matchedTenant) {
    tenantId = matchedTenant.id
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
      // Legacy write-only field. It remains for compatibility, but occupancy
      // is derived from the approved dates elsewhere in the application.
      status: 'active',
    })
    if (insertError) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(authData.user.id)
      const failure = new Error(deleteError
        ? `Failed to create tenant: ${insertError.message}. Auth cleanup also failed: ${deleteError.message}`
        : `Failed to create tenant: ${insertError.message}`)
      // The caller retries cleanup because a returned Auth error is not an
      // exception and this account was not otherwise added to its created list.
      if (deleteError) failure.createdTenantId = authData.user.id
      throw failure
    }
    tenantId = authData.user.id
    created = true
  }

  return { tenantId, created, before: created ? null : matchedTenant }
}

async function updateImportedTenant(supabase, { tenantId, propertyId, unitId, primaryProfile, isPrimary }) {
  const update = isPrimary
    ? primaryProfileUpdate(primaryProfile, { propertyId, unitId })
    : primaryProfileUpdate({}, { propertyId, unitId })
  if (Object.keys(update).length) {
    const { error: updateError } = await supabase.from('tenant_profiles').update(update).eq('id', tenantId)
    if (updateError) throw new Error(`Failed to update tenant: ${updateError.message}`)
  }
}

async function cleanupCreatedTenants(supabase, tenantIds) {
  return cleanupCreatedTenantAccounts({
    async deleteTenantProfiles(ids) {
      const { error } = await supabase.from('tenant_profiles').delete().in('id', ids)
      if (error) throw new Error(`Failed to remove created tenant profiles: ${error.message}`)
    },
    async deleteAuthUser(tenantId) {
      const { error } = await supabase.auth.admin.deleteUser(tenantId)
      if (error) throw new Error(`Failed to remove created tenant auth user: ${error.message}`)
    },
  }, tenantIds)
}

function profileSnapshot(row) {
  return {
    property_id: row.property_id,
    unit_id: row.unit_id,
    move_in_date: row.move_in_date,
    move_out_date: row.move_out_date,
    email: row.email,
    phone: row.phone,
    home_address: row.home_address,
    age: row.age,
    student_status: row.student_status,
    student_year: row.student_year,
    zelle_name: row.zelle_name,
    has_cosigner: row.has_cosigner,
  }
}

async function restoreExistingProfiles(supabase, snapshots) {
  const failures = []
  for (const { tenantId, before } of [...snapshots].reverse()) {
    const { error } = await supabase.from('tenant_profiles').update(profileSnapshot(before)).eq('id', tenantId)
    if (error) failures.push(error.message)
  }
  if (failures.length) throw new Error(`Could not restore every existing tenant profile: ${failures.join('; ')}`)
}

async function deleteCreatedContract(supabase, contractId) {
  if (!contractId) return
  const { error } = await supabase.from('contracts').delete().eq('id', contractId)
  if (error) throw new Error(`Could not remove the newly created lease: ${error.message}`)
}

async function importFailure(supabase, { tenantIds, existingSnapshots, contractId }, error, message) {
  const cleanupFailures = []
  for (const cleanup of [
    () => deleteCreatedContract(supabase, contractId),
    () => restoreExistingProfiles(supabase, existingSnapshots),
    () => cleanupCreatedTenants(supabase, tenantIds),
  ]) {
    try {
      await cleanup()
    } catch (cleanupError) {
      cleanupFailures.push(cleanupError.message || String(cleanupError))
    }
  }
  const suffix = cleanupFailures.length ? `. Cleanup also failed: ${cleanupFailures.join('; ')}` : ''
  return NextResponse.json({ error: `${error.message || message}${suffix}` }, { status: 500 })
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
  try {
    // Validate before tenant creation. The contract RPC repeats the property
    // check, but it runs after this route has otherwise created auth/profile
    // records, so it cannot be the first line of defense here.
    unitNumber = await validateLeaseAssignment({
      async findPropertyForLandlord(id, landlordId) {
        const { data, error } = await supabase.from('properties').select('id').eq('id', id).eq('landlord_id', landlordId).maybeSingle()
        if (error) throw new Error(error.message)
        return data
      },
      async findUnit(id) {
        const { data, error } = await supabase.from('units').select('unit_number, property_id').eq('id', id).maybeSingle()
        if (error) throw new Error(error.message)
        return data
      },
    }, { landlordId: auth.landlordId, propertyId, unitId })
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Invalid property or unit assignment.' }, { status: 400 })
  }

  const created = []
  const updated = []
  const tenantIds = []
  const createdTenantIds = []
  const existingSnapshots = []
  try {
    for (const name of reviewed.people) {
      const tenant = await findOrCreateTenant(supabase, {
        name,
        landlordId: auth.landlordId,
      })
      tenantIds.push(tenant.tenantId)
      if (tenant.created) createdTenantIds.push(tenant.tenantId)
      else existingSnapshots.push({ tenantId: tenant.tenantId, before: tenant.before })
      ;(tenant.created ? created : updated).push(name)
    }

    for (let index = 0; index < reviewed.people.length; index += 1) {
      await updateImportedTenant(supabase, {
        tenantId: tenantIds[index],
        propertyId,
        unitId,
        primaryProfile: reviewed.primaryProfile,
        isPrimary: reviewed.people[index].toLocaleLowerCase() === reviewed.primaryName.toLocaleLowerCase(),
      })
    }
  } catch (error) {
    if (error.createdTenantId) createdTenantIds.push(error.createdTenantId)
    return importFailure(supabase, { tenantIds: createdTenantIds, existingSnapshots, contractId: null }, error, 'Failed to apply approved tenant information')
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
    if (candidatesError) {
      return importFailure(supabase, { tenantIds: createdTenantIds, existingSnapshots, contractId: null }, candidatesError, 'Failed to look up existing leases')
    }

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
        return importFailure(supabase, { tenantIds: createdTenantIds, existingSnapshots, contractId: null }, error, 'Failed to create lease')
      }
    }
  }

  return NextResponse.json({ created, updated, skipped, contractsCreated })
}
