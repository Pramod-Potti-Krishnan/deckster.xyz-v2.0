/**
 * R-20261007-frontend-24: lib/identity-token-client.ts (cache per session, refresh
 * at 60% of the lifetime, exactly one re-mint on a 401, 403 as "not your session").
 *
 * Offline: a fake clock and a fake `fetch`; the real helper is compiled and run
 * unchanged. The helper has exactly one app importer, lib/upload-identity-token.ts
 * (R-20261007-frontend-27, behind its own flag), and this test checks that too.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TTL = 900
const HEADER = 'X-Deckster-Session-Token'
const T0 = 1_790_000_000_000

const logs = []
const record = (...args) => { logs.push(args.map(String).join(' ')) }
const source = fs.readFileSync(path.join(REPO, 'lib/identity-token-client.ts'), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const module = { exports: {} }
vm.runInNewContext(compiled, {
  module, exports: module.exports, Promise, Map, Error, Number, Math, Date, encodeURIComponent,
  globalThis: {},
  console: { log: record, info: record, warn: record, error: record },
})
const {
  createIdentityTokenClient, NotYourSessionError, IdentityTokenUnavailableError,
  IDENTITY_TOKEN_REFRESH_FRACTION, IDENTITY_TOKEN_DISABLED_RECHECK_MS, IDENTITY_TOKEN_ENDPOINT,
  identityTokenClient,
} = module.exports

assert.equal(IDENTITY_TOKEN_REFRESH_FRACTION, 0.6)
assert.equal(IDENTITY_TOKEN_ENDPOINT, '/api/identity/token')
assert.equal(typeof identityTokenClient.withToken, 'function')

// ----------------------------------------------------------- the fakes
function world() {
  const w = { nowMs: T0, mintCalls: [], mintCount: 0, mintReply: null, downstream: [] }
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  w.json = json
  w.fetchImpl = async (url, init) => {
    w.mintCalls.push({ url, init })
    w.mintCount += 1
    if (w.mintReply) {
      const reply = typeof w.mintReply === 'function' ? w.mintReply(w.mintCount) : w.mintReply
      if (reply instanceof Error) throw reply
      return reply
    }
    return json({
      token: `v1.tok-${w.mintCount}.x.${Math.floor(w.nowMs / 1000) + TTL}.mac`,
      expires_at: Math.floor(w.nowMs / 1000) + TTL,
      header: HEADER,
      ttl_seconds: TTL,
    })
  }
  w.client = createIdentityTokenClient({ fetchImpl: w.fetchImpl, now: () => w.nowMs })
  return w
}
const advance = (w, seconds) => { w.nowMs += seconds * 1000 }
const tokenOf = n => `v1.tok-${n}.x.`

// ------------------------------------------- 1. mint, cache, refresh
{
  const w = world()
  const first = await w.client.getCredential('sess-A')
  assert.equal(first.header, HEADER)
  assert.ok(first.token.startsWith(tokenOf(1)))
  assert.equal(w.mintCalls.length, 1)
  assert.equal(w.mintCalls[0].url, '/api/identity/token?session_id=sess-A')
  assert.equal(w.mintCalls[0].init.method, 'GET')
  assert.equal(w.mintCalls[0].init.credentials, 'same-origin')
  assert.equal(w.mintCalls[0].init.cache, 'no-store')

  // cached per session
  assert.equal((await w.client.getCredential('sess-A')).token, first.token)
  assert.equal(w.mintCalls.length, 1, 'served from the cache')
  const other = await w.client.getCredential('sess-B')
  assert.ok(other.token.startsWith(tokenOf(2)))
  assert.equal(w.mintCalls.length, 2, 'another session mints its own')
  assert.equal(w.mintCalls[1].url, '/api/identity/token?session_id=sess-B')
  assert.equal((await w.client.getCredential('sess-A')).token, first.token, 'sessions do not share tokens')

  // session ids are URL-encoded
  await w.client.getCredential('weird id/&x')
  assert.equal(w.mintCalls.at(-1).url, '/api/identity/token?session_id=weird%20id%2F%26x')

  // refresh at 60% of the lifetime (540 s of 900)
  const w2 = world()
  const a = await w2.client.getCredential('s')
  advance(w2, 539)
  assert.equal((await w2.client.getCredential('s')).token, a.token, 'still cached at 539 s')
  assert.equal(w2.mintCalls.length, 1)
  advance(w2, 1)
  const refreshed = await w2.client.getCredential('s')
  assert.notEqual(refreshed.token, a.token, 'refreshed at 540 s')
  assert.equal(w2.mintCalls.length, 2)
  assert.equal((await w2.client.getCredential('s')).token, refreshed.token, 'the new token is cached from then on')
  assert.equal(w2.mintCalls.length, 2)

  // concurrent callers share one mint
  const w3 = world()
  const [x, y, z] = await Promise.all([w3.client.getCredential('s'), w3.client.getCredential('s'), w3.client.getCredential('s')])
  assert.equal(w3.mintCalls.length, 1)
  assert.equal(x.token, y.token)
  assert.equal(y.token, z.token)

  // a failed refresh falls back to the still-valid token; an expired one does not
  const w4 = world()
  const b = await w4.client.getCredential('s')
  advance(w4, 600)
  w4.mintReply = w4.json({ error: 'x' }, 503)
  assert.equal((await w4.client.getCredential('s')).token, b.token, 'refresh failed, token still valid: keep using it')
  advance(w4, 301)
  await assert.rejects(() => w4.client.getCredential('s'), err => err instanceof IdentityTokenUnavailableError && err.code === 'unavailable' && err.status === 503)

  // invalidate
  const w5 = world()
  await w5.client.getCredential('s'); await w5.client.getCredential('t')
  w5.client.invalidate('s')
  await w5.client.getCredential('s'); await w5.client.getCredential('t')
  assert.equal(w5.mintCalls.length, 3, 'only the invalidated session minted again')
  w5.client.invalidate()
  await w5.client.getCredential('t')
  assert.equal(w5.mintCalls.length, 4)

  // no session id: nothing is requested
  const w6 = world()
  await assert.rejects(() => w6.client.getCredential(''), err => err instanceof IdentityTokenUnavailableError && err.code === 'no_session')
  assert.equal(w6.mintCalls.length, 0)
}

// ------------------------------------ 2. exactly one re-mint on a 401
{
  const w = world()
  const seen = []
  const downstream = async headers => {
    seen.push({ ...headers })
    return w.downstream.shift()?.() ?? new Response('{}', { status: 200 })
  }

  // 401 then 200: one re-mint, the retry carries the new token
  w.downstream = [() => new Response('{}', { status: 401 }), () => new Response('{"ok":true}', { status: 200 })]
  let response = await w.client.withToken('sess-A', downstream)
  assert.equal(response.status, 200)
  assert.equal(seen.length, 2, 'the call was made twice')
  assert.equal(w.mintCalls.length, 2, 'minted twice: the first token and exactly one re-mint')
  assert.ok(seen[0][HEADER].startsWith(tokenOf(1)))
  assert.ok(seen[1][HEADER].startsWith(tokenOf(2)), 'the retry carries a fresh token')
  assert.notEqual(seen[0][HEADER], seen[1][HEADER])

  // the fresh token is the cached one afterwards
  seen.length = 0
  w.downstream = []
  await w.client.withToken('sess-A', downstream)
  assert.ok(seen[0][HEADER].startsWith(tokenOf(2)))
  assert.equal(w.mintCalls.length, 2)

  // 401 twice: the second 401 comes back to the caller, no third call, no third mint
  const w2 = world()
  const seen2 = []
  w2.downstream = [() => new Response('{}', { status: 401 }), () => new Response('{}', { status: 401 }), () => new Response('{}', { status: 200 })]
  response = await w2.client.withToken('s', async headers => { seen2.push(headers); return w2.downstream.shift()() })
  assert.equal(response.status, 401, 'a second 401 is returned, not looped on')
  assert.equal(seen2.length, 2)
  assert.equal(w2.mintCalls.length, 2)

  // a non-401 failure is never retried
  const w3 = world()
  let n3 = 0
  response = await w3.client.withToken('s', async () => { n3 += 1; return new Response('{}', { status: 500 }) })
  assert.equal(response.status, 500)
  assert.equal(n3, 1)
  assert.equal(w3.mintCalls.length, 1)

  // the re-mint failing surfaces the mint error
  const w4 = world()
  let n4 = 0
  await assert.rejects(() => w4.client.withToken('s', async () => {
    n4 += 1
    w4.mintReply = w4.json({}, 403)
    return new Response('{}', { status: 401 })
  }), err => err instanceof NotYourSessionError)
  assert.equal(n4, 1)
}

// --------------------------------------- 3. 403 is "not your session"
{
  // from the mint route: typed error, the call is never made
  const w = world()
  w.mintReply = w.json({ error: 'session_not_owned' }, 403)
  let called = 0
  await assert.rejects(() => w.client.withToken('s', async () => { called += 1; return new Response('{}') }), err => {
    assert.ok(err instanceof NotYourSessionError)
    assert.equal(err.name, 'NotYourSessionError')
    assert.equal(err.code, 'session_not_owned')
    assert.equal(err.status, 403)
    assert.match(err.message, /does not belong to your account/)
    assert.equal(err.message.includes('@'), false)
    return true
  })
  assert.equal(called, 0)
  await assert.rejects(() => w.client.getCredential('s'), err => err instanceof NotYourSessionError)

  // from the service, when a token was sent: the same typed error, and no retry
  const w2 = world()
  let n2 = 0
  await assert.rejects(() => w2.client.withToken('s', async () => { n2 += 1; return new Response('{}', { status: 403 }) }), err => err instanceof NotYourSessionError)
  assert.equal(n2, 1)
  assert.equal(w2.mintCalls.length, 1)

  // a 403 mint drops anything cached for that session
  const w3 = world()
  await w3.client.getCredential('s')
  advance(w3, 600)
  w3.mintReply = w3.json({}, 403)
  await assert.rejects(() => w3.client.getCredential('s'), err => err instanceof NotYourSessionError)
  w3.mintReply = null
  const again = await w3.client.getCredential('s')
  assert.ok(again.token.startsWith(tokenOf(3)), 'the old token was not reused after a 403')
}

// -------------------------- 4. tokens switched off: today's behaviour
{
  const w = world()
  w.mintReply = () => w.json({ token_enabled: false })
  const seen = []
  const call = async headers => { seen.push({ ...headers }); return new Response('{}', { status: 200 }) }
  assert.equal(await w.client.getCredential('s'), null)
  const r = await w.client.withToken('s', call)
  assert.equal(r.status, 200)
  assert.deepEqual(seen, [{}], 'no header at all')
  assert.equal(w.mintCalls.length, 1, 'the "off" answer is remembered')

  // a 401 or 403 from the service with no token on the call is just a response
  for (const status of [401, 403]) {
    const got = await w.client.withToken('s', async () => new Response('{}', { status }))
    assert.equal(got.status, status)
  }
  assert.equal(w.mintCalls.length, 1, 'no re-mint without a token')

  // asked again after the recheck window; an enabled answer switches tokens on
  advance(w, IDENTITY_TOKEN_DISABLED_RECHECK_MS / 1000)
  w.mintReply = null
  const on = await w.client.getCredential('s')
  assert.ok(on.token.startsWith(tokenOf(2)))
  assert.equal(w.mintCalls.length, 2)
}

// ------------------------------------------- 5. mint failures are typed
{
  const cases = [
    [401, { error: 'unauthenticated' }, 'unauthenticated', 401],
    [410, { error: 'session_deleted' }, 'session_deleted', 410],
    [503, { error: 'ownership_lookup_failed' }, 'unavailable', 503],
    [500, {}, 'unavailable', 500],
  ]
  for (const [status, body, code, expectedStatus] of cases) {
    const w = world()
    w.mintReply = w.json(body, status)
    await assert.rejects(() => w.client.getCredential('s'), err => err instanceof IdentityTokenUnavailableError && err.code === code && err.status === expectedStatus, `status ${status}`)
  }
  let w = world()
  w.mintReply = new Error('offline')
  await assert.rejects(() => w.client.getCredential('s'), err => err instanceof IdentityTokenUnavailableError && err.code === 'network')
  for (const bad of [
    { token: '', header: HEADER, ttl_seconds: TTL, expires_at: 1 },
    { token: 'v1.a', header: '', ttl_seconds: TTL, expires_at: 1 },
    { token: 'v1.a', header: HEADER, ttl_seconds: 0, expires_at: 1 },
    { token: 'v1.a', header: HEADER, ttl_seconds: 'soon', expires_at: 1 },
    { token: 'v1.a', header: HEADER, ttl_seconds: TTL },
    { nothing: true },
  ]) {
    w = world()
    w.mintReply = w.json(bad)
    await assert.rejects(() => w.client.getCredential('s'), err => err instanceof IdentityTokenUnavailableError && err.code === 'bad_response')
  }
  w = world()
  w.mintReply = new Response('not json', { status: 200 })
  await assert.rejects(() => w.client.getCredential('s'), err => err instanceof IdentityTokenUnavailableError && err.code === 'bad_response')
}

// ----------------------------- 6. never logs, and has exactly one app importer
assert.equal(logs.length, 0, 'the helper logs nothing')
{
  const skip = new Set(['node_modules', '.next', '.git', 'scripts', 'docs', 'screenshots', 'public'])
  const users = []
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name) && !full.endsWith('lib/identity-token-client.ts')) {
        if (fs.readFileSync(full, 'utf8').includes('identity-token-client')) users.push(path.relative(REPO, full))
      }
    }
  }
  walk(REPO)
  assert.deepEqual(users, ['lib/upload-identity-token.ts'], 'imported only by the Researcher upload wrapper (flag NEXT_PUBLIC_UPLOAD_IDENTITY_TOKEN_ENABLED)')
  const callers = []
  const find = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) find(full)
      else if (/\.(ts|tsx)$/.test(entry.name) && fs.readFileSync(full, 'utf8').includes('/api/identity/token') && !full.endsWith('identity-token-client.ts') && !full.endsWith('app/api/identity/token/route.ts')) {
        callers.push(path.relative(REPO, full))
      }
    }
  }
  find(REPO)
  assert.deepEqual(callers, [], 'nothing else calls the mint route')
}

console.log('identity token client tests passed')
