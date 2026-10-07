import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'

const origin = 'http://127.0.0.1:8843'
const cases = [
  ['/builder', 'GET', 307],
  ['/auth/signin', 'GET', 200],
  ['/api/version', 'GET', 200],
  ['/api/debug/check-env', 'GET', 404, 'removed'],
  ['/api/test-env', 'GET', 404, 'removed'],
  ['/api/dev/mock-token', 'GET', 404],
  ['/api/dev/mock-token', 'POST', 404],
  ['/api/admin/cleanup-sessions', 'GET', 404],
  ['/api/admin/cleanup-sessions', 'POST', 404],
]
const results = []
for (const [path, method, expected, removed] of cases) {
  const response = await fetch(origin + path, { method, redirect: 'manual', signal: AbortSignal.timeout(10000) })
  assert.equal(response.status, expected, `${method} ${path}`)
  // Removed routes fall through to the framework 404; guarded handlers return the explicit JSON body.
  if (expected === 404 && !removed) assert.deepEqual(await response.json(), { error: 'Not found' })
  else await response.arrayBuffer()
  const location = response.headers.get('location')
  if (expected === 307) {
    const redirect = new URL(location, origin)
    assert.equal(redirect.pathname, '/api/auth/error')
    assert.equal(redirect.searchParams.get('error'), 'Configuration')
  }
  results.push({ path, method, expected, status: response.status, ...(location ? { location } : {}) })
}
writeFileSync('docs/studio-v4/dev-20261003/evidence/production-smoke.json', JSON.stringify({
  origin, productionBuild: true, node: process.version, results,
  unauthenticatedBuilderBlocked: true, authConfigurationMissing: true, guardBodiesVerified: true,
  loginOrSessionFixtures: false, serviceRequestsOrDatabaseQueries: false,
}, null, 2) + '\n')
console.log('9 compiled-server checks passed: Builder blocked for missing auth configuration, sign-in page, version, the four guarded development mock/cleanup handlers, and the two removed debug env routes; no login/session fixtures or service/database operations. Normal login remains unverified.')
