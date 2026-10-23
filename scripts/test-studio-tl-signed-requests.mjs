// Text Labs signed requests, Studio side (contract: deckster-workspace streams/router/pass3/TL-SIGNED-REQUESTS-CONTRACT.md).
// Flags NEXT_PUBLIC_STUDIO_TL_SIGNED_REQUESTS (browser) and TEXT_LABS_SIGNED_REQUESTS_ENABLED (server), both default off; secret
// TEXT_LABS_IDENTITY_SECRET (server-only). Every key- or token-shaped value here is built at runtime (no literal secrets).
//
//   node scripts/test-studio-tl-signed-requests.mjs              (plain node: transpile + vm, no network)
//   node scripts/test-studio-tl-signed-requests.mjs --no-mutants
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const MINT = 'lib/text-labs-identity-mint.ts'
const ROUTE = 'app/api/identity/text-labs-token/route.ts'
const CLIENT = 'lib/text-labs-signed-fetch.ts'
const TL = 'lib/textlabs-client.ts'
const SRC = { [MINT]: read(MINT), [ROUTE]: read(ROUTE), [CLIENT]: read(CLIENT), [TL]: read(TL), '.env.example': read('.env.example') }

const transpile = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const runtimeSecret = (bytes = 32) => crypto.randomBytes(bytes).toString('hex') // test-only, made at run time
const b64urlDecode = text => Buffer.from(text, 'base64url').toString('utf8')

function loadMint(text, env = {}) {
  const mod = { exports: {} }
  vm.runInNewContext(transpile(text), { module: mod, exports: mod.exports, process: { env }, Buffer, Date, Math,
    require: id => { if (id === 'crypto') return crypto; assert.fail(`unexpected import ${id}`) } })
  return mod.exports
}

function loadClient(text, env = {}) {
  const mod = { exports: {} }
  vm.runInNewContext(transpile(text), { module: mod, exports: mod.exports, process: { env }, setTimeout, clearTimeout, Date, Math, DOMException, Number,
    require: id => assert.fail(`the browser module must stay import-free: ${id}`) })
  return mod.exports
}

function loadRoute(env, session, mintText = SRC[MINT]) {
  const mint = loadMint(mintText, env)
  const logs = []
  const calls = { session: 0 }
  const NextResponse = { json: (body, init = {}) => ({ body, status: init.status ?? 200, headers: init.headers ?? {} }) }
  const mod = { exports: {} }
  vm.runInNewContext(transpile(SRC[ROUTE]), { module: mod, exports: mod.exports, process: { env },
    console: { warn: (...a) => logs.push(a.join(' ')), error: (...a) => logs.push(a.join(' ')), log: (...a) => logs.push(a.join(' ')) },
    require: id => {
      if (id === 'next/server') return { NextResponse }
      if (id === 'next-auth') return { getServerSession: async () => { calls.session++; return session } }
      if (id === '@/lib/auth-options') return { authOptions: {} }
      if (id === '@/lib/text-labs-identity-mint') return mint
      assert.fail(`unexpected import ${id}`)
    } })
  return { GET: mod.exports.GET, logs, calls }
}

/** A fake Response with a JSON body (clone() reads the same body again). */
function res(status, body) {
  const text = body === undefined ? '' : JSON.stringify(body)
  const make = () => ({ status, ok: status >= 200 && status < 300, json: async () => JSON.parse(text), clone: () => make() })
  return make()
}

let checks = 0
const ok = (cond, msg) => { assert.ok(cond, msg); checks++ }
const plain = v => (v === undefined ? v : JSON.parse(JSON.stringify(v))) // objects made in the vm sandbox have another realm's prototypes
const eq = (a, b, msg) => { assert.deepEqual(plain(a), plain(b), msg); checks++ }

async function mintChecks(mintText) {
  const m = loadMint(mintText)
  const secret = runtimeSecret()
  const t = m.mintTextLabsToken('ckuser123', secret, 1_790_000_000)
  const [payloadPart, signaturePart, extra] = t.token.split('.')
  ok(payloadPart && signaturePart && extra === undefined, 'token = payload.signature')
  ok(!/[=+/]/.test(t.token), 'base64url without padding')
  const payload = JSON.parse(b64urlDecode(payloadPart))
  eq(payload, { sub: 'ckuser123', iat: 1_790_000_000, exp: 1_790_000_540 }, 'payload: sub, integer iat, exp = iat + 540')
  ok(Number.isInteger(payload.iat) && Number.isInteger(payload.exp), 'iat / exp are integers')
  const expected = crypto.createHmac('sha256', Buffer.from(secret, 'utf8')).update(payloadPart, 'ascii').digest().toString('base64url')
  eq(signaturePart, expected, 'the signature is HMAC-SHA256 over the encoded payload, keyed by the raw secret')
  eq([t.expires_at, t.ttl_seconds], [1_790_000_540, 540], 'expires_at = exp, ttl 540')
  const paddedSecret = `  ${runtimeSecret()}\n`
  const tp = m.mintTextLabsToken('ckuser123', paddedSecret, 1_790_000_000)
  const [pp, ps] = tp.token.split('.')
  eq(ps, crypto.createHmac('sha256', Buffer.from(paddedSecret, 'utf8')).update(pp, 'ascii').digest().toString('base64url'), 'a padded secret is used exactly as given (Text Labs does not trim it)')
  ok(m.TEXT_LABS_TOKEN_TTL_SECONDS <= 600, 'the lifetime stays inside the gate cap (600 s)')
  for (const good of ['ckuser123', 'a', 'A.b_c:d-9', 'x'.repeat(255)]) ok(m.isTextLabsSubject(good), `subject ${good.slice(0, 12)} is canonical`)
  for (const bad of ['', 'a@b.com', '.lead', 'x'.repeat(256), 'has space', null, 42]) ok(!m.isTextLabsSubject(bad), `subject ${String(bad).slice(0, 12)} is refused`)
  eq(m.textLabsSigningSecret({}), null, 'no secret: not configured')
  eq(m.textLabsSigningSecret({ TEXT_LABS_IDENTITY_SECRET: 'a'.repeat(31) }), null, '31 bytes: not configured')
  eq(m.textLabsSigningSecret({ TEXT_LABS_IDENTITY_SECRET: `  ${'a'.repeat(31)}  ` }), null, 'padding does not count towards 32 bytes')
  const padded = ` ${'b'.repeat(32)} `
  eq(m.textLabsSigningSecret({ TEXT_LABS_IDENTITY_SECRET: padded }), padded, 'a usable secret is returned raw (Text Labs signs with the exact value)')
  for (const value of [undefined, '', 'TRUE', '1', ' true']) eq(m.textLabsSignedRequestsEnabled({ TEXT_LABS_SIGNED_REQUESTS_ENABLED: value }), false, `server flag ${JSON.stringify(value)} is off`)
  eq(m.textLabsSignedRequestsEnabled({ TEXT_LABS_SIGNED_REQUESTS_ENABLED: 'true' }), true, 'server flag exact "true" is on')
}

async function routeChecks() {
  const secret = runtimeSecret()
  const on = { TEXT_LABS_SIGNED_REQUESTS_ENABLED: 'true', TEXT_LABS_IDENTITY_SECRET: secret }
  { const r = loadRoute({}, { user: { id: 'ckuser123' } }); const out = await r.GET()
    eq([out.status, out.body], [200, { token_enabled: false }], 'flag off: {"token_enabled": false}'); eq(r.calls.session, 0, 'flag off reads no session'); eq(out.headers['Cache-Control'], 'no-store', 'no-store') }
  { const r = loadRoute(on, null); const out = await r.GET(); eq([out.status, out.body], [401, { error: 'unauthenticated' }], 'no session: 401') }
  { const r = loadRoute(on, { user: { id: 'pk@example.com' } }); const out = await r.GET(); eq(out.status, 401, 'an e-mail id is never minted'); ok(!('token' in out.body), 'no token for an e-mail id') }
  { const r = loadRoute({ ...on, TEXT_LABS_IDENTITY_SECRET: 'short' }, { user: { id: 'ckuser123' } }); const out = await r.GET()
    eq([out.status, out.body], [503, { error: 'identity_signing_not_configured' }], 'short secret: 503') }
  { const r = loadRoute(on, { user: { id: 'ckuser123' } }); const out = await r.GET()
    eq(out.status, 200, 'mint: 200'); eq(out.headers['Cache-Control'], 'no-store', 'mint: no-store')
    eq(Object.keys(out.body).sort(), ['expires_at', 'header', 'token', 'ttl_seconds'], 'mint: the contract shape')
    eq(out.body.header, 'X-MR-Identity-Token', 'mint: the header name')
    eq(JSON.parse(b64urlDecode(out.body.token.split('.')[0])).sub, 'ckuser123', 'mint: sub is the session user id')
    const logs = r.logs.join('\n'); ok(!logs.includes(out.body.token) && !logs.includes(secret) && !logs.includes('ckuser123'), 'logs never carry the token, secret or user id') }
  { const r = loadRoute({ ...on, TEXT_LABS_IDENTITY_SECRET: 'short' }, { user: { id: 'ckuser123' } }); await r.GET()
    ok(r.logs.every(l => /^\[Text Labs token\] refused: [a-z_]+$/.test(l)), 'refusal logs are reason codes only') }
}

/** A fake fetch: a queue of answers per path, every call recorded. */
function fakeFetch(answers) {
  const calls = []
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init })
    const queue = answers[url.startsWith('/api/identity') ? 'mint' : 'tl']
    assert.ok(queue.length, `unexpected call ${url}`)
    const next = queue.shift()
    return typeof next === 'function' ? next(url, init) : next
  }
  return { fetchImpl, calls }
}

const tokenFor = n => `${Buffer.from(JSON.stringify({ n })).toString('base64url')}.${crypto.randomBytes(8).toString('base64url')}`

async function clientChecks(clientText) {
  const lib = loadClient(clientText, { NEXT_PUBLIC_STUDIO_TL_SIGNED_REQUESTS: 'true' })
  eq(lib.STUDIO_TL_SIGNED_REQUESTS_ENABLED, true, 'browser flag exact "true" is on')
  for (const value of [undefined, '', 'false', 'TRUE', '1']) eq(loadClient(clientText, value === undefined ? {} : { NEXT_PUBLIC_STUDIO_TL_SIGNED_REQUESTS: value }).STUDIO_TL_SIGNED_REQUESTS_ENABLED, false, `browser flag ${JSON.stringify(value)} is off`)
  eq([lib.TL_IDENTITY_HEADER, lib.TL_TOKEN_MINT_PATH, lib.TL_TOKEN_REFRESH_MARGIN_MS, lib.TL_RATE_LIMIT_MAX_WAIT_MS], ['X-MR-Identity-Token', '/api/identity/text-labs-token', 60_000, 30_000], 'the constants')
  let t = 1_790_000_000_000
  const now = () => t
  const sec = () => Math.floor(t / 1000)
  { // one mint for concurrent callers; refresh inside the 60 s margin
    const A = tokenFor(1), B = tokenFor(2)
    const f = fakeFetch({ mint: [res(200, { token: A, expires_at: sec() + 540 }), res(200, { token: B, expires_at: sec() + 1080 })], tl: [] })
    const cache = lib.createTextLabsTokenCache({ fetchImpl: f.fetchImpl, now })
    const [h1, h2] = await Promise.all([cache.header(), cache.header()])
    eq([h1, h2], [{ 'X-MR-Identity-Token': A }, { 'X-MR-Identity-Token': A }], 'concurrent callers share one mint')
    eq(f.calls.length, 1, 'one mint call')
    eq(f.calls[0].init.credentials, 'same-origin', 'the mint call uses the session cookie (same origin)')
    t += 470_000 // 70 s left
    eq(await cache.header(), { 'X-MR-Identity-Token': A }, 'still 70 s left: same token, no mint'); eq(f.calls.length, 1, 'no second mint yet')
    t += 15_000 // 55 s left
    eq(await cache.header(), { 'X-MR-Identity-Token': B }, 'inside the margin: a fresh token'); eq(f.calls.length, 2, 'the second mint')
  }
  { // token_enabled false: no header, no second ask within 5 minutes
    const f = fakeFetch({ mint: [res(200, { token_enabled: false }), res(200, { token_enabled: false })], tl: [] })
    const cache = lib.createTextLabsTokenCache({ fetchImpl: f.fetchImpl, now })
    eq(await cache.header(), {}, 'server flag off: no header'); eq(await cache.header(), {}, 'still none'); eq(f.calls.length, 1, 'asked once')
    t += 5 * 60_000 + 1; await cache.header(); eq(f.calls.length, 2, 'asked again after 5 minutes')
  }
  for (const [label, answer] of [['401', res(401, { error: 'unauthenticated' })], ['503', res(503, { error: 'identity_signing_not_configured' })], ['malformed', res(200, { token: 7 })], ['throw', () => { throw new Error('network') }]]) {
    const f = fakeFetch({ mint: [answer], tl: [] })
    eq(await lib.createTextLabsTokenCache({ fetchImpl: f.fetchImpl, now }).header(), {}, `mint ${label}: no header`)
  }
  const signed = (tl, mints, sleeps = []) => {
    const f = fakeFetch({ mint: mints, tl })
    const cache = lib.createTextLabsTokenCache({ fetchImpl: f.fetchImpl, now })
    const fetchSigned = lib.createTextLabsSignedFetch({ fetchImpl: f.fetchImpl, cache, sleep: async ms => { sleeps.push(ms) } })
    return { f, fetchSigned, sleeps }
  }
  const gate = (status, code, extra = {}) => res(status, { detail: { error_code: code, message: 'x', ...extra } })
  const mintOk = n => res(200, { token: tokenFor(n), expires_at: sec() + 540 })
  const tlCalls = f => f.calls.filter(c => !c.url.startsWith('/api/identity'))
  const init = { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Generation-Attempt-ID': 'attempt-1' }, body: '{}' }
  { const s = signed([res(200, { ok: true })], [mintOk(1)]); const out = await s.fetchSigned('https://tl/api/chat/message', init)
    eq(out.status, 200, 'a plain success'); const h = tlCalls(s.f)[0].init.headers
    ok(h['X-MR-Identity-Token'] && h['X-Generation-Attempt-ID'] === 'attempt-1' && h['Content-Type'] === 'application/json', 'the token header is added and the request headers are kept') }
  for (const code of ['SIGNED_REQUEST_EXPIRED', 'SIGNED_REQUEST_INVALID', 'SIGNED_REQUEST_REQUIRED']) {
    const s = signed([gate(401, code), res(200, { ok: true })], [mintOk(1), mintOk(2)])
    const out = await s.fetchSigned('https://tl/api/chat/message', init)
    eq(out.status, 200, `${code}: re-minted and resent`)
    const sent = tlCalls(s.f)
    eq(sent.length, 2, `${code}: exactly one resend`)
    ok(sent[0].init.headers['X-MR-Identity-Token'] !== sent[1].init.headers['X-MR-Identity-Token'], `${code}: the resend carries the new token`)
    eq(sent[1].init.headers['X-Generation-Attempt-ID'], 'attempt-1', `${code}: the same X-Generation-Attempt-ID`)
  }
  { const s = signed([gate(401, 'SIGNED_REQUEST_EXPIRED'), gate(401, 'SIGNED_REQUEST_EXPIRED')], [mintOk(1), mintOk(2)])
    const out = await s.fetchSigned('https://tl/api/chat/message', init); eq(out.status, 401, 'a second 401 is returned'); eq(tlCalls(s.f).length, 2, 'never a third send') }
  { const s = signed([res(401, { detail: { error_code: 'SOMETHING_ELSE' } })], [mintOk(1)])
    await s.fetchSigned('https://tl/api/chat/message', init); eq(tlCalls(s.f).length, 1, 'another 401 code: no resend'); eq(s.f.calls.length, 2, 'and no re-mint') }
  { const s = signed([gate(503, 'SIGNED_REQUESTS_NOT_CONFIGURED')], [mintOk(1)])
    const out = await s.fetchSigned('https://tl/api/chat/message', init); eq(out.status, 503, '503 not configured is returned'); eq(s.f.calls.length, 2, 'no re-mint, no resend') }
  { const s = signed([gate(429, 'RATE_LIMITED', { retry_after_seconds: 3 }), res(200, {})], [mintOk(1)])
    const out = await s.fetchSigned('https://tl/api/chat/message', init); eq(out.status, 200, '429: one resend after the wait'); eq(s.sleeps, [3000], 'waited retry_after_seconds') }
  { const s = signed([gate(429, 'RATE_LIMITED', { retry_after_seconds: 99 }), gate(429, 'RATE_LIMITED', { retry_after_seconds: 99 })], [mintOk(1)])
    const out = await s.fetchSigned('https://tl/api/chat/message', init); eq(s.sleeps, [30000], 'the wait is capped at 30 s'); eq(out.status, 429, 'a second 429 is returned'); eq(tlCalls(s.f).length, 2, 'one resend only') }
  { const s = signed([res(429, { detail: {} })], [mintOk(1)])
    await s.fetchSigned('https://tl/api/chat/message', init); eq(tlCalls(s.f).length, 1, 'a 429 without RATE_LIMITED: no resend') }
  { // a real sleep is aborted by the request's signal
    const f = fakeFetch({ mint: [mintOk(1)], tl: [gate(429, 'RATE_LIMITED', { retry_after_seconds: 5 })] })
    const fetchSigned = lib.createTextLabsSignedFetch({ fetchImpl: f.fetchImpl, cache: lib.createTextLabsTokenCache({ fetchImpl: f.fetchImpl, now }) })
    const ac = new AbortController()
    const pending = fetchSigned('https://tl/api/chat/message', { ...init, signal: ac.signal })
    setTimeout(() => ac.abort(), 20)
    await assert.rejects(pending, e => e.name === 'AbortError'); checks++
    eq(tlCalls(f).length, 1, 'aborted while waiting: no resend')
  }
  eq(lib.textLabsGateCode({ detail: { error_code: 'RATE_LIMITED' } }), 'RATE_LIMITED', 'gate code from detail')
  eq(lib.textLabsGateCode({ error_code: 'RATE_LIMITED' }), null, 'only detail.error_code counts')
  ok(/Reload the page/.test(lib.textLabsGateMessage('SIGNED_REQUEST_EXPIRED')), 'a final 401: reload the page')
  ok(/unavailable/.test(lib.textLabsGateMessage('SIGNED_REQUESTS_NOT_CONFIGURED')), '503: unavailable')
  ok(/Too many requests/.test(lib.textLabsGateMessage('RATE_LIMITED')), '429: slow down')
  eq(lib.textLabsGateMessage('OTHER'), null, 'another code: the existing message')
}

function staticChecks() {
  const tl = SRC[TL]
  const signedCalls = tl.match(/\(STUDIO_TL_SIGNED_REQUESTS_ENABLED \? textLabsSignedFetch : fetch\)\(`\$\{[^}]+\}\/api\/[a-z/]+`/g) || []
  eq(signedCalls.map(c => c.replace(/.*\/api\//, '/api/').replace('`', '')), ['/api/chat/message', '/api/infographic/generate'], 'the header goes only on the two paid routes')
  eq((tl.match(/textLabsSignedFetch/g) || []).length, 3, 'textLabsSignedFetch: one import, two calls')
  eq((tl.match(/STUDIO_TL_SIGNED_REQUESTS_ENABLED \? textLabsGateMessage\(textLabsGateCode\(errorData\)\) : null/g) || []).length, 2, 'the gate message only with the flag on, on both routes')
  // The secret never reaches the browser: only the server route's lib reads it, and no client module imports that lib.
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', 'app', 'lib', 'hooks', 'components'], { cwd: root, encoding: 'utf8' }).split('\n').filter(f => /\.(ts|tsx)$/.test(f))
  const readers = files.filter(f => read(f).includes('TEXT_LABS_IDENTITY_SECRET'))
  eq(readers, [MINT], 'TEXT_LABS_IDENTITY_SECRET is read in one server file only')
  const importers = files.filter(f => /from '@\/lib\/text-labs-identity-mint'/.test(read(f)))
  eq(importers, [ROUTE], 'only the server route imports the mint lib')
  ok(!/^['"]use client['"]/m.test(SRC[ROUTE]) && /export const runtime = 'nodejs'/.test(SRC[ROUTE]), 'the route is a Node server route')
  ok(!/NEXT_PUBLIC_[A-Z_]*TEXT_LABS_IDENTITY/.test(SRC['.env.example'] + SRC[CLIENT] + SRC[TL]), 'no NEXT_PUBLIC_ name carries the identity secret')
  ok(!/localStorage|sessionStorage|console\./.test(SRC[CLIENT]), 'the browser module never stores or logs the token')
  const env = SRC['.env.example']
  eq((env.match(/^NEXT_PUBLIC_STUDIO_TL_SIGNED_REQUESTS="false"$/gm) || []).length, 1, 'browser flag declared once, "false"')
  eq((env.match(/^TEXT_LABS_SIGNED_REQUESTS_ENABLED="false"$/gm) || []).length, 1, 'server flag declared once, "false"')
  eq((env.match(/^TEXT_LABS_IDENTITY_SECRET=$/gm) || []).length, 1, 'the secret placeholder is empty')
  ok(env.indexOf('TEXT_LABS_IDENTITY_SECRET=') < env.indexOf('# PASS2 ADMIN'), 'the block sits before # PASS2 ADMIN')
}

/** Cross-check against Text Labs' own verifier when ROUTER-2's worktree and a venv are on this Mac (a throwaway secret; SKIP otherwise). */
function verifierCheck() {
  const tlDir = process.env.TL_VERIFIER_DIR || path.join(process.env.HOME || '', 'Deckster/.worktrees/fe2-tl-verify') // a text-labs checkout (uat has the gate's verifier)
  const py = [path.join(process.env.HOME || '', 'Deckster/.worktrees/router-venv-text-labs/bin/python'), path.join(tlDir, '.venv/bin/python')].find(p => fs.existsSync(p))
  if (!fs.existsSync(path.join(tlDir, 'backend/services/model_router.py')) || !py) { console.log('  SKIP Text Labs verifier cross-check (worktree or venv not here)'); return }
  const m = loadMint(SRC[MINT])
  const secret = runtimeSecret()
  const now = Math.floor(Date.now() / 1000)
  const { token } = m.mintTextLabsToken('ckuser123', secret, now)
  const code = 'import sys; from backend.services import model_router as m; print(m.inspect_identity_token(sys.argv[1], sys.argv[2], max_lifetime_s=600))'
  let out
  try { out = execFileSync(py, ['-c', code, token, secret], { cwd: tlDir, encoding: 'utf8', env: { PATH: '/usr/bin:/bin', HOME: process.env.HOME || '' }, stdio: ['ignore', 'pipe', 'pipe'] }).trim() }
  catch (e) { console.log(`  SKIP Text Labs verifier cross-check (it did not import: ${String(e.stderr || e.message).split('\n').filter(Boolean).pop()?.slice(0, 120)})`); return }
  eq(out, "('ckuser123', 'ok')", "Text Labs' inspect_identity_token accepts Studio's token (max_lifetime_s=600)")
}

const MUTANTS = [
  [MINT, 'ttl 601', s => s.replace('export const TEXT_LABS_TOKEN_TTL_SECONDS = 540', 'export const TEXT_LABS_TOKEN_TTL_SECONDS = 601')],
  [MINT, 'signs the trimmed secret', s => s.replace("createHmac('sha256', Buffer.from(secret, 'utf8'))", "createHmac('sha256', Buffer.from(secret.trim(), 'utf8'))")],
  [MINT, 'e-mail subject allowed', s => s.replace('const SUBJECT_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/', 'const SUBJECT_RE = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,254}$/')],
  [MINT, 'short secret accepted', s => s.replace('>= TEXT_LABS_SECRET_MIN_BYTES ? raw : null', '>= 1 ? raw : null')],
  [MINT, 'loose server flag', s => s.replace("env.TEXT_LABS_SIGNED_REQUESTS_ENABLED === 'true'", 'Boolean(env.TEXT_LABS_SIGNED_REQUESTS_ENABLED)')],
  [CLIENT, 'no refresh margin', s => s.replace('expiresAtMs - now() < TL_TOKEN_REFRESH_MARGIN_MS', 'expiresAtMs - now() < 0')],
  [CLIENT, 'no shared mint', s => s.replace('if (minting) return minting // one mint in flight', '// mutant')],
  [CLIENT, 'disabled not remembered', s => s.replace('disabledUntil = now() + TL_TOKEN_DISABLED_RECHECK_MS', 'disabledUntil = 0')],
  [CLIENT, 're-mint on any 401', s => s.replace("if (!code || !TL_REMINT_CODES.includes(code)) return response", '')],
  [CLIENT, 'no invalidate on 401', s => s.replace('deps.cache.invalidate()\n      return send()', 'return send()')],
  [CLIENT, 'resend on 503', s => s.replace('    return response\n  }\n}\n\n/** detail.error_code', "    if (response.status === 503) return send()\n    return response\n  }\n}\n\n/** detail.error_code")],
  [CLIENT, 'no wait cap', s => s.replace('Math.min(retryAfterSeconds * 1000, TL_RATE_LIMIT_MAX_WAIT_MS)', 'retryAfterSeconds * 1000')],
  [CLIENT, 'any 429 resent', s => s.replace("if (code !== 'RATE_LIMITED' || retryAfterSeconds === null) return response", '')],
  [CLIENT, 'loose browser flag', s => s.replace("process.env.NEXT_PUBLIC_STUDIO_TL_SIGNED_REQUESTS === 'true'", 'Boolean(process.env.NEXT_PUBLIC_STUDIO_TL_SIGNED_REQUESTS)')],
  [CLIENT, 'headers replaced', s => s.replace('headers: { ...(init.headers as Record<string, string> | undefined), ...(await deps.cache.header()) },', 'headers: { ...(await deps.cache.header()) },')],
]

await mintChecks(SRC[MINT])
await routeChecks()
await clientChecks(SRC[CLIENT])
staticChecks()
verifierCheck()
console.log(`Text Labs signed requests: ${checks} checks passed`)
if (!process.argv.includes('--no-mutants')) {
  const survivors = []
  for (const [file, name, mutate] of MUTANTS) {
    const mutated = mutate(SRC[file])
    assert.notEqual(mutated, SRC[file], `mutant "${name}" must change the source`)
    try {
      if (file === MINT) await mintChecks(mutated)
      else await clientChecks(mutated)
      survivors.push(name)
    } catch { /* caught */ }
  }
  assert.deepEqual(survivors, [], `mutants survived: ${survivors.join(', ')}`)
  console.log(`PASS mutation check: ${MUTANTS.length} of ${MUTANTS.length} mutants fail at least one check`)
}
