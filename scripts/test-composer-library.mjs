import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function load(relative, context = {}, imports = {}) {
  const source = fs.readFileSync(new URL(relative, import.meta.url), 'utf8')
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  vm.runInNewContext(output, {
    module, exports: module.exports, URL, Buffer, AbortSignal, DOMException, setTimeout, clearTimeout,
    require: name => { if (!(name in imports)) throw new Error(`Unexpected import ${name}`); return imports[name] },
    ...context,
  })
  return module.exports
}

const contracts = load('../lib/composer-library.ts')
const { requireComposerServiceUrl, validateComposerFile, composerReadyResult } = contracts
const host = 'directorv40-uat.up.railway.app'
assert.equal(requireComposerServiceUrl(`https://${host}`, host), `https://${host}`)
assert.equal(requireComposerServiceUrl('http://127.0.0.1:8533/', host), 'http://127.0.0.1:8533')
for (const url of [undefined, 'https://unapproved.example', `http://${host}`, `https://${host}.evil.example`, `https://user:pass@${host}`, `https://${host}/redirect`, `https://${host}?to=evil`, `https://${host}:444`]) {
  assert.throws(() => requireComposerServiceUrl(url, host))
}
assert.equal(validateComposerFile({ name: 'deck.PPTX', size: 1 }), null)
for (const file of [{ name: 'deck.pdf', size: 1 }, { name: 'deck.pptx', size: 0 }, { name: 'deck.pptx', size: 104857601 }]) assert.ok(validateComposerFile(file))
const ready = { session_id: 'owned-session', template_id: 'template-1', presentation_id: 'deck-1', viewer_url: 'http://127.0.0.1:8531/p/deck-1', slide_count: 3 }
assert.equal(composerReadyResult({ status: 'queued' }, ready.session_id), null)
assert.deepEqual(JSON.parse(JSON.stringify(composerReadyResult({ status: 'complete', checkpoint: { result: ready } }, ready.session_id))), ready)
assert.throws(() => composerReadyResult({ status: 'complete', checkpoint: { result: ready } }, 'other-session'))
assert.throws(() => composerReadyResult({ status: 'complete', checkpoint: { result: { ...ready, viewer_url: '' } } }, ready.session_id))

let identity = { user: { id: 'trusted-user', email: 'fallback@example.test' } }
let calls = []
let dbUser = { id: 'trusted-user' }
let ownedSession = true
const ownershipQueries = []
const env = { NEXT_PUBLIC_COMPOSER_LIBRARY_ENABLED: 'true', COMPOSER_DIRECTOR_URL: `https://${host}`, COMPOSER_FRONTDOOR_TOKEN: 'unit-test-placeholder' }
const route = load('../app/api/composer-library/[...path]/route.ts', {
  process: { env },
  fetch: async (url, options) => { calls.push({ url, options }); return Response.json({ job_id: 'job-1', status: 'queued' }, { status: 202 }) },
}, {
  'next/server': { NextResponse: Response },
  'next-auth': { getServerSession: async () => identity },
  '@/lib/auth-options': { authOptions: {} },
  '@/lib/prisma': { prisma: {
    user: { findUnique: async query => { assert.equal(query.where.email, identity.user.email); return dbUser } },
    chatSession: { findFirst: async query => {
      ownershipQueries.push(query)
      assert.equal(query.where.userId, 'trusted-user')
      assert.equal(query.where.status.not, 'deleted')
      return ownedSession ? { id: query.where.id } : null
    } },
  } },
  '@/lib/composer-library': contracts,
})
function request(method, path, body, extraHeaders = {}) {
  const req = new Request(`http://localhost/api/composer-library/${path.join('/')}`, {
    method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...extraHeaders },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  })
  return route[method](req, { params: Promise.resolve({ path }) })
}
env.NEXT_PUBLIC_COMPOSER_LIBRARY_ENABLED = 'false'
assert.equal((await request('GET', ['templates'])).status, 404)
assert.equal(calls.length, 0)
env.NEXT_PUBLIC_COMPOSER_LIBRARY_ENABLED = 'true'
identity = null
assert.equal((await request('GET', ['templates'])).status, 401)
assert.equal(calls.length, 0)
identity = { user: { id: 'untrusted-stale-id', email: 'owner@example.test' } }
const originalBase = env.COMPOSER_DIRECTOR_URL
for (const base of [undefined, 'https://unapproved.example']) {
  env.COMPOSER_DIRECTOR_URL = base
  assert.equal((await request('GET', ['templates'])).status, 503)
}
env.COMPOSER_DIRECTOR_URL = originalBase
assert.equal(calls.length, 0)
assert.equal((await request('GET', ['templates'], undefined, { 'X-Composer-User-Id': 'attacker', Authorization: 'Bearer attacker' })).status, 202)
assert.equal(calls[0].options.headers['X-Composer-User-Id'], 'trusted-user')
assert.equal(calls[0].options.headers.Authorization, 'Bearer unit-test-placeholder')
assert.equal(calls[0].options.redirect, 'error')
assert.equal(calls[0].url, `https://${host}/api/template-ingest/stage/templates`)
calls = []
for (const path of [['upload'], ['templates', '../escape', 'use'], ['templates', 'template-1'], ['jobs', 'job-1', 'extra']]) {
  assert.equal((await request('POST', path, {})).status, 404)
}
assert.equal((await request('POST', ['upload-reference'], 'file-bytes', { 'Content-Type': 'application/octet-stream' })).status, 415)
assert.equal((await request('POST', ['upload-reference'], 'x'.repeat(16385))).status, 413)
assert.equal((await request('POST', ['templates', 'template-1', 'use'], { session_id: 'session-1', user_id: 'attacker' })).status, 400)
assert.equal(calls.length, 0)
const upload = { session_id: 'session-1', researcher_session_id: 'session-1', storage_path: 'session-1/deck.pptx', file_name: 'deck.pptx', kind: 'pptx' }
for (const spoof of [
  { researcher_session_id: 'other-session' },
  { storage_path: 'other-session/deck.pptx' },
  { storage_path: 'session-1/../deck.pptx' },
  { storage_path: 'session-1/%2e%2e%2fdeck.pptx' },
  { storage_path: 'session-1/..\\deck.pptx' },
]) {
  assert.equal((await request('POST', ['upload-reference'], { ...upload, ...spoof })).status, 400)
}
ownedSession = false
assert.equal((await request('POST', ['upload-reference'], upload)).status, 404)
assert.equal((await request('POST', ['templates', 'template-1', 'use'], { session_id: 'other-users-session' })).status, 404)
assert.equal(calls.length, 0)
ownedSession = true
assert.equal((await request('POST', ['upload-reference'], upload)).status, 202)
assert.deepEqual(JSON.parse(calls.at(-1).options.body), upload)
assert.equal(ownershipQueries.at(-1).where.id, 'session-1')
assert.equal((await request('POST', ['templates', 'template-1', 'use'], { session_id: 'session-1' })).status, 202)
assert.equal((await request('GET', ['jobs', 'job-1'])).status, 202)
console.log('Composer library: URL admission, session ownership, file validation, flag-off, identity, route and reference-only proxy checks passed.')
