import assert from 'node:assert/strict'
import test from 'node:test'
import { requireLandlord, rejectMismatchedLandlord, requireTeamRecords } from './authorize.js'

function session({ user = { id: 'auth-1' }, membership = { landlord_id: 'team-1' }, membershipError = null } = {}) {
  return async () => ({
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: membership, error: membershipError }) }),
      }),
    }),
  })
}

test('requireLandlord returns the team from the authenticated membership', async () => {
  assert.deepEqual(await requireLandlord({ createSession: session() }), { landlordId: 'team-1', authId: 'auth-1' })
})

test('requireLandlord rejects an absent session', async () => {
  const result = await requireLandlord({ createSession: session({ user: null }) })
  assert.equal(result.response.status, 401)
})

test('requireLandlord rejects a signed-in user without landlord membership', async () => {
  const result = await requireLandlord({ createSession: session({ membership: null }) })
  assert.equal(result.response.status, 403)
})

test('a body team id cannot override the authenticated team', () => {
  assert.equal(rejectMismatchedLandlord('other-team', 'team-1').status, 403)
  assert.equal(rejectMismatchedLandlord('team-1', 'team-1'), null)
})

test('requireTeamRecords rejects a foreign or missing referenced id', async () => {
  const admin = {
    from: () => ({
      select: () => ({
        in: async () => ({ data: [{ id: 'tenant-a', landlord_id: 'other-team' }], error: null }),
      }),
    }),
  }
  const result = await requireTeamRecords(admin, {
    table: 'tenant_profiles', ids: ['tenant-a', 'tenant-missing'], landlordId: 'team-1',
  })
  assert.equal(result.response.status, 403)
})
