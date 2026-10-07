import test from 'node:test'
import assert from 'node:assert/strict'
import { isAppPath, isPublicPath, resolveUser, gateDecision } from './session-gate.js'

const retryable = Object.assign(new Error('fetch failed'), { name: 'AuthRetryableFetchError' })
const sessionMissing = Object.assign(new Error('Auth session missing!'), { name: 'AuthSessionMissingError' })

test('isAppPath matches a prefix and its children, not a lookalike', () => {
  assert.equal(isAppPath('/dashboard'), true)
  assert.equal(isAppPath('/tenants/abc'), true)
  assert.equal(isAppPath('/portal/payments/history'), true)
  assert.equal(isAppPath('/dashboards'), false)
  assert.equal(isAppPath('/api/contracts/create'), false)
  assert.equal(isAppPath('/'), false)
})

test('isPublicPath is exact: only the pages that render without a session', () => {
  for (const p of ['/', '/pricing', '/login', '/signup', '/reset-password']) assert.equal(isPublicPath(p), true)
  assert.equal(isPublicPath('/dashboard'), false)
  assert.equal(isPublicPath('/login/extra'), false)
  assert.equal(isPublicPath('/auth/callback'), false)
})

test('no public path is also an app path', () => {
  for (const p of ['/', '/pricing', '/login', '/signup', '/reset-password']) assert.equal(isAppPath(p), false)
})

test('resolveUser returns the user when Auth answers', async () => {
  const user = { id: 'u1' }
  assert.deepEqual(await resolveUser(async () => ({ data: { user }, error: null })), { user })
})

test('resolveUser treats a missing session as signed out, not as an outage', async () => {
  assert.deepEqual(await resolveUser(async () => ({ data: { user: null }, error: sessionMissing })), { user: null })
})

test('resolveUser gives up when Auth never answers, instead of hanging', async () => {
  const started = Date.now()
  const result = await resolveUser(() => new Promise(() => {}), 20)
  assert.deepEqual(result, { unavailable: true })
  assert.ok(Date.now() - started < 1000)
})

test('resolveUser reports an unreachable Auth server as unavailable', async () => {
  assert.deepEqual(await resolveUser(async () => ({ data: { user: null }, error: retryable })), { unavailable: true })
})

test('resolveUser reports a failing Auth server (5xx, unparseable reply) as unavailable', async () => {
  const serverError = Object.assign(new Error('Internal Server Error'), { name: 'AuthApiError', status: 500 })
  const unknown = Object.assign(new Error('Unexpected token <'), { name: 'AuthUnknownError' })
  assert.deepEqual(await resolveUser(async () => ({ data: { user: null }, error: serverError })), { unavailable: true })
  assert.deepEqual(await resolveUser(async () => ({ data: { user: null }, error: unknown })), { unavailable: true })
})

test('resolveUser treats a rejected token (4xx) as signed out', async () => {
  const rejected = Object.assign(new Error('invalid JWT'), { name: 'AuthApiError', status: 403 })
  assert.deepEqual(await resolveUser(async () => ({ data: { user: null }, error: rejected })), { user: null })
})

test('resolveUser reports a thrown error as unavailable', async () => {
  assert.deepEqual(await resolveUser(async () => { throw new Error('boom') }), { unavailable: true })
})

test('gateDecision: signed-out app request goes to login, everything else passes', () => {
  assert.equal(gateDecision('/dashboard', { user: null }), 'login')
  assert.equal(gateDecision('/dashboard', { user: { id: 'u1' } }), 'pass')
  assert.equal(gateDecision('/api/payments/delete', { user: null }), 'pass')
})

test('gateDecision: an Auth outage fails closed on app paths and never redirects to login', () => {
  assert.equal(gateDecision('/dashboard', { unavailable: true }), 'unavailable')
  assert.equal(gateDecision('/portal/profile', { unavailable: true }), 'unavailable')
  assert.equal(gateDecision('/api/payments/delete', { unavailable: true }), 'pass')
})
