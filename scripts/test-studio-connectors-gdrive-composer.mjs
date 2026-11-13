// KNOWLEDGE P4-15 composer half (DARK): "Add from Google Drive" in the Builder composer's attach menu, the Drive chips, D2 connect round trip, D8 errors.
// Flags: NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED AND NEXT_PUBLIC_STUDIO_CONNECTORS_SESSION_LINKS_ENABLED (exact "true", default off) + the Knowledge entitlement.
// Run: node scripts/test-studio-connectors-gdrive-composer.mjs   (transpile + vm, fake fetch / Picker / storage / timers, no network, no Google, no writes)
//   GDRIVE_COMPOSER_BASE=<commit>  the base the flag-off identity is proven against (default: #608's head 0578e0a1, the branch this change stacks on, refreshed onto studio-v4-dev-preparation-code 2f06e51e; first cut from 1baf289d)
//   1 pure helpers   2 server: the connect round trip returns to the chat   3 the hook, on a tiny hook runtime   4 the components (static markup)
//   5 FLAG-OFF IDENTITY: the REAL ChatInput with no `gdrive` prop renders exactly what the base's ChatInput renders (markup + element tree), and the marked lines
//     stripped (scripts/studio-connectors-gdrive-composer-strip.mjs) give the base's chat-input.tsx and builder page byte for byte, and no base line is rewritten (pure insertions)   6 page wiring   7 the wire
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import { stripConnectorsGdriveComposer, CONNECTORS_GDRIVE_COMPOSER_FILES, CONNECTORS_GDRIVE_COMPOSER_SCOPE_FILES } from './studio-connectors-gdrive-composer-strip.mjs'
import { LATER_STRIPS, LATER_CHANGE_FILES, stripLaterChanges } from './studio-later-changes.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nodeRequire = createRequire(path.join(root, 'package.json'))
const React = nodeRequire('react')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')
const BASE = process.env.GDRIVE_COMPOSER_BASE || 'f06501285747f4943a31d8d3985c97958b2f80cd'
const gitShow = rel => execFileSync('git', ['show', `${BASE}:${rel}`], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 })
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const plain = v => JSON.parse(JSON.stringify(v))
const sha = text => crypto.createHash('sha256').update(text).digest('hex')

let passed = 0
const t = async (name, fn) => { await fn(); passed++; console.log('ok -', name) }

// ---- loader: transpile-on-require in a vm-less Function scope, explicit stubs ------------------------------------------------------
function compile(rel, source) {
  const out = ts.transpileModule(source, { fileName: rel, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } })
  const errors = (out.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error)
  assert.equal(errors.length, 0, `${rel} does not transpile: ${errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join('; ')}`)
  return out.outputText
}
function createWorld({ env = {}, stubs = {}, globals = {} } = {}) {
  const cache = new Map(), names = Object.keys(globals)
  const resolve = (spec, fromRel) => {
    const base = spec.startsWith('@/') ? spec.slice(2) : path.posix.join(path.posix.dirname(fromRel), spec)
    for (const ext of ['', '.ts', '.tsx']) if (fs.existsSync(path.join(root, base + ext)) && fs.statSync(path.join(root, base + ext)).isFile() && /\.tsx?$/.test(base + ext)) return base + ext
    throw new Error(`unresolved ${spec} from ${fromRel}`)
  }
  function load(rel) {
    if (cache.has(rel)) return cache.get(rel).exports
    const module = { exports: {} }; cache.set(rel, module)
    const require = spec => {
      if (spec in stubs) return stubs[spec]
      if (spec.startsWith('@/') || spec.startsWith('.')) return load(resolve(spec, rel))
      return nodeRequire(spec)
    }
    new Function('module', 'exports', 'require', 'process', 'console', ...names, compile(rel, read(rel)))(module, module.exports, require, { env }, console, ...names.map(n => globals[n]))
    return module.exports
  }
  return { load }
}

const ENV_ON = { NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED: 'true', NEXT_PUBLIC_STUDIO_CONNECTORS_SESSION_LINKS_ENABLED: 'true' }
const lib = createWorld({ env: ENV_ON }).load('lib/connectors-gdrive-composer.ts')
const libOff = createWorld({ env: {} }).load('lib/connectors-gdrive-composer.ts')
const CHAT = 'chatsess00000001'
const FILE_A = '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456'
const FILE_B = '1ZyXwVuTsRqPoNmLkJiHgFeDcBa9876543'
const FILE_C = '1QqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQq1'

// ================================================ 1. pure helpers
await t('gate: needs BOTH flags exact "true" AND the entitlement', async () => {
  for (const [sl, drive, entitled, want] of [
    ['true', 'true', true, true], ['true', 'true', false, false], ['true', 'true', undefined, false], ['true', undefined, true, false], [undefined, 'true', true, false],
    ['TRUE', 'true', true, false], ['true', '1', true, false], ['false', 'true', true, false], [' true', 'true', true, false],
  ]) {
    const w = createWorld({ env: { NEXT_PUBLIC_STUDIO_CONNECTORS_SESSION_LINKS_ENABLED: sl, NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED: drive } }).load('lib/connectors-gdrive-composer.ts')
    assert.equal(w.isGdriveComposerEnabled(entitled), want, JSON.stringify([sl, drive, entitled]))
  }
  assert.equal(libOff.isGdriveComposerEnabled(true), false, 'both unset (the default) = off, even for an entitled user')
})
await t('D8 copy: too large (D8b), unsupported type (D8c), trashed, removed, generic', async () => {
  assert.deepEqual(plain(lib.itemFailure('Annual report.pdf', 'too_large')), { kind: 'too_large', message: '"Annual report.pdf" is too large. The limit is 20 MB per file.' })
  assert.deepEqual(plain(lib.itemFailure('Demo.mp4', 'mime_not_allowed')), { kind: 'unsupported', message: `"Demo.mp4" can't be used. Supported: Docs, Slides, Sheets, PDF, DOCX, PPTX, XLSX, CSV, TXT, MD.` })
  assert.equal(lib.itemFailure('X', 'trashed').kind, 'trashed')
  assert.equal(lib.itemFailure('X', 'disconnected').kind, 'expired')
  assert.equal(lib.itemFailure('X', 'erased').kind, 'removed')
  for (const code of ['bad_file_id', 'metadata_unavailable', 'download_failed', 'whatever', null, undefined]) assert.equal(lib.itemFailure('X', code).kind, 'generic')
  assert.match(lib.itemFailure(null, 'too_large').message, /^"Drive file" is too large/, 'no title: a plain name, never "null"')
})
await t('D8a: a revoked grant is "expired" (Reconnect); not connected is the connect prompt; the rest keep the server words', async () => {
  assert.deepEqual(plain(lib.requestFailure(409, { error_code: 'CONNECTOR_GRANT_REVOKED' })), { kind: 'expired', message: 'Drive connection expired. Reconnect to keep using your files.' })
  assert.deepEqual(plain(lib.requestFailure(404, { error_code: 'CONNECTOR_NOT_CONNECTED' })), { kind: 'not_connected' })
  assert.equal(lib.requestFailure(401, {}).kind, 'error')
  assert.match(lib.requestFailure(403, {}).message, /plan/)
  assert.equal(lib.requestFailure(502, { error: 'Could not add your Drive files. Please try again.', error_code: null }).message, 'Could not add your Drive files. Please try again.')
  assert.match(lib.requestFailure(500, null).message, /not available right now/)
})
await t('chips: items route -> chips, session-links route -> linked / error, ids and counts', async () => {
  const chips = lib.chipsFromItems([FILE_A, FILE_B, FILE_C, 'ghost'], [
    { id: FILE_A, title: 'Q3 plan', status: 'queued', error: null },
    { id: FILE_B, title: 'Annual report.pdf', status: 'rejected', error: 'too_large' },
    { source_ref: FILE_C, title: 'Revenue', status: 'queued' },
  ])
  assert.deepEqual(plain(chips.map(c => [c.id === 'ghost' ? 'ghost' : c.title, c.state, c.errorKind ?? null])), [['Q3 plan', 'linking', null], ['Annual report.pdf', 'error', 'too_large'], ['Revenue', 'linking', null], ['ghost', 'error', 'generic']])
  assert.deepEqual(lib.linkedIdsOf(chips), [], 'nothing is linked until the chat says so')
  const after = lib.chipsAfterLink(chips, { linked: [FILE_A], rejected: [{ id: FILE_C, error: 'not_found' }] })
  assert.deepEqual(plain(after.map(c => [c.title, c.state])), [['Q3 plan', 'linked'], ['Annual report.pdf', 'error'], ['Revenue', 'error'], ['Drive file', 'error']])
  assert.deepEqual(lib.linkedIdsOf(after), [FILE_A])
  assert.equal(after[2].errorKind, 'generic', 'not_found = could not use it')
  assert.deepEqual(lib.chipsAfterLink(chips, null).map(c => c.state), ['error', 'error', 'error', 'error'], 'no answer = nothing linked')
  assert.deepEqual(lib.chipsLinkFailed(chips).map(c => c.state), ['error', 'error', 'error', 'error'])
  assert.equal(lib.chipsLinkFailed(chips)[1].errorKind, 'too_large', 'a chip that already failed keeps its own reason')
  assert.equal(lib.contextLabel(1), '1 Drive file linked to this chat'); assert.equal(lib.contextLabel(2), '2 Drive files linked to this chat')
  const many = Array.from({ length: 25 }, (_, i) => ({ id: `id${i}`, title: 't', state: 'linked' }))
  assert.equal(lib.chipsRoom(many), 0); assert.equal(lib.chipsRoom(many.slice(0, 20)), 5)
  assert.equal(lib.chipsRoom([...many.slice(0, 20), { id: 'e', title: 't', state: 'error' }]), 5, 'an error chip does not take a place')
  assert.deepEqual(lib.mergeChips([many[0], many[1]], [{ ...many[1], title: 'new' }, many[2]]).map(c => c.title), ['t', 'new', 't'])
  assert.deepEqual(lib.removeChipById(many.slice(0, 3), 'id1').map(c => c.id), ['id0', 'id2'])
})
await t('memory per chat: linked chips only; [] is kept; garbage reads as nothing', async () => {
  const raw = lib.serializeChips([{ id: FILE_A, title: 'Q3 plan', state: 'linked' }, { id: FILE_B, title: 'x', state: 'error', message: 'm' }, { id: FILE_C, title: 'y', state: 'linking' }])
  assert.deepEqual(plain(lib.parseChips(raw)), [{ id: FILE_A, title: 'Q3 plan', state: 'linked' }])
  assert.deepEqual(plain(lib.parseChips('[]')), [], 'the user cleared the chat: the next message says so')
  for (const bad of [null, undefined, '', 'not json', '{"a":1}', '7']) assert.equal(lib.parseChips(bad), null)
  assert.deepEqual(plain(lib.parseChips(JSON.stringify([{ id: '../x', title: 'a' }, { id: FILE_A }, { id: FILE_A, title: 'dup' }, 5, null]))), [{ id: FILE_A, title: 'Drive file', state: 'linked' }])
  assert.equal(lib.chipsStorageKey(CHAT), `deckster_gdrive_links_${CHAT}`)
})
await t('connect round trip helpers: only /builder?session_id=<id> may be returned to; ?gdrive= is read once and taken off', async () => {
  assert.equal(lib.validReturnPath(`/builder?session_id=${CHAT}`), `/builder?session_id=${CHAT}`)
  for (const bad of [undefined, null, '', 'https://evil.test/builder?session_id=chatsess00000001', '//evil.test', '/settings/connectors', '/builder', '/builder?session_id=short', `/builder?session_id=${CHAT}&x=1`, `/builder?session_id=${CHAT}#h`, `/builder?session_id=${CHAT}\n`, `/builder?session_id=../${CHAT}`, 7])
    assert.equal(lib.validReturnPath(bad), null, String(bad))
  assert.equal(lib.gdriveStartHref(CHAT), `/api/connectors/gdrive/start?return=${encodeURIComponent(`/builder?session_id=${CHAT}`)}`)
  for (const none of [null, undefined, 'new', 'lib:owner', 'a b']) assert.equal(lib.gdriveStartHref(none), '/api/connectors/gdrive/start')
  assert.equal(lib.returnRedirectPath(`/builder?session_id=${CHAT}`, 'connected'), `/builder?session_id=${CHAT}&gdrive=connected`)
  assert.deepEqual(plain(lib.takeGdriveReturn(`?session_id=${CHAT}&gdrive=connected`)), { status: 'connected', search: `?session_id=${CHAT}` })
  assert.deepEqual(plain(lib.takeGdriveReturn('?gdrive=cancelled')), { status: 'cancelled', search: '' })
  assert.deepEqual(plain(lib.takeGdriveReturn('?gdrive=failed&theme=x')), { status: 'failed', search: '?theme=x' })
  assert.deepEqual(plain(lib.takeGdriveReturn('?gdrive=evil')), { status: null, search: '' }, 'an unknown status is taken off and ignored')
  assert.deepEqual(plain(lib.takeGdriveReturn(`?session_id=${CHAT}`)), { status: null, search: `?session_id=${CHAT}` }, 'no param: the address is left alone')
})

// ================================================ 2. server: connect round trip
class FakeRes { constructor(body, status = 200, location) { this.body = body; this.status = status; this.location = location; this.cookies = { jar: {}, set: (n, v, o) => { this.cookies.jar[n] = { v, o } } } } }
const NextResponse = { json: (b, i = {}) => new FakeRes(b, i.status ?? 200), redirect: (u) => new FakeRes(null, 307, String(u)) }
let calls = []
globalThis.fetch = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => ({}) } }
const serverStubs = (userId = 'cuid_session_user') => ({
  'next/server': { NextResponse },
  '@/lib/kg-proxy': { requireKgEntitled: async () => (userId ? { userId } : { error: new FakeRes({ error: 'Unauthorized' }, 401) }), kgHeaders: x => ({ ...x }) },
  '@/lib/service-url': { requireServiceUrl: (_l, c) => c[0].value },
})
const SERVER_ENV = { ...ENV_ON, NEXTAUTH_SECRET: 's3cret', NEXTAUTH_URL: 'https://app.test', GOOGLE_CONNECTOR_CLIENT_ID: 'cid', KNOWLEDGE_SERVICE_URL: 'https://researcher.test', RESEARCHER_SESSION_TOKEN_SECRET: 'test-only-researcher-session-secret-0123456789' }
const serverWorld = (env = SERVER_ENV) => createWorld({ env, stubs: serverStubs() }).load('lib/connectors-gdrive-server.ts')
const gdriveLib = createWorld({ env: SERVER_ENV }).load('lib/connectors-gdrive.ts')
const startReq = (query = '') => ({ url: `https://app.test/api/connectors/gdrive/start${query}` })
const cbReq = (state, cookies) => ({ url: `https://app.test/api/connectors/gdrive/callback?code=C1&state=${state}`, json: async () => null, cookies: { get: n => (n in cookies ? { value: cookies[n] } : undefined) } })
const RET = `/builder?session_id=${CHAT}`
await t('start: ?return=/builder?session_id=<id> is remembered in an httpOnly cookie; the Google URL and the nonce cookie are what they were', async () => {
  const s = serverWorld()
  const r = await s.handleStart(startReq(`?return=${encodeURIComponent(RET)}`))
  assert.equal(r.status, 307); assert.match(r.location, /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/)
  assert.equal(new URL(r.location).searchParams.get('scope'), 'https://www.googleapis.com/auth/drive.file')
  assert.ok(!r.location.includes('session_id') && !r.location.includes('builder'), 'the return path never goes to Google')
  const c = r.cookies.jar.deckster_gdrive_return
  assert.equal(c.v, RET); assert.ok(c.o.httpOnly && c.o.secure && c.o.path === '/api/connectors/gdrive' && c.o.maxAge === 600)
  assert.ok(r.cookies.jar.deckster_gdrive_oauth_nonce.o.httpOnly)
  assert.equal(calls.length, 0)
})
await t('start: no ?return= / an invalid one => no return cookie (the Settings round trip is unchanged); no request object at all works too', async () => {
  const s = serverWorld()
  for (const q of ['', '?return=', `?return=${encodeURIComponent('https://evil.test/')}`, `?return=${encodeURIComponent('//evil.test')}`, `?return=${encodeURIComponent('/settings/connectors')}`, `?return=${encodeURIComponent(`/builder?session_id=${CHAT}&next=x`)}`]) {
    const r = await s.handleStart(startReq(q)); assert.equal('deckster_gdrive_return' in r.cookies.jar, false, q); assert.ok(r.cookies.jar.deckster_gdrive_oauth_nonce)
  }
  const r0 = await s.handleStart(); assert.equal('deckster_gdrive_return' in r0.cookies.jar, false)
})
await t('start: flag off (either) => 404, nothing set', async () => {
  for (const env of [{ ...SERVER_ENV, NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED: undefined }, { ...SERVER_ENV, NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED: 'false' }]) {
    const r = await serverWorld(env).handleStart(startReq(`?return=${encodeURIComponent(RET)}`)); assert.equal(r.status, 404); assert.deepEqual(r.cookies.jar, {})
  }
})
await t('callback: with the return cookie the user lands back in the same chat with ?gdrive=<status>; the cookie is cleared; every status goes back', async () => {
  const s = serverWorld()
  const st = gdriveLib.signState('s3cret', 'cuid_session_user', 'n1')
  const r = await s.handleCallback(cbReq(st, { deckster_gdrive_oauth_nonce: 'n1', deckster_gdrive_return: RET }))
  assert.equal(r.location, `https://app.test/builder?session_id=${CHAT}&gdrive=connected`)
  assert.equal(r.cookies.jar.deckster_gdrive_return.o.maxAge, 0); assert.equal(r.cookies.jar.deckster_gdrive_oauth_nonce.o.maxAge, 0)
  assert.equal(calls.length, 1, 'the exchange still happens server to server'); assert.equal(calls[0].url, 'https://researcher.test/api/v1/connectors/gdrive/exchange')
  const bad = await s.handleCallback(cbReq(gdriveLib.signState('s3cret', 'someone_else', 'n1'), { deckster_gdrive_oauth_nonce: 'n1', deckster_gdrive_return: RET }))
  assert.equal(bad.location, `https://app.test/builder?session_id=${CHAT}&gdrive=invalid`)
  const cancelled = await s.handleCallback({ url: 'https://app.test/cb?error=access_denied', cookies: { get: n => (n === 'deckster_gdrive_return' ? { value: RET } : undefined) } })
  assert.equal(cancelled.location, `https://app.test/builder?session_id=${CHAT}&gdrive=cancelled`)
})
await t('callback: no / tampered return cookie => the Settings landing, exactly as before', async () => {
  const s = serverWorld()
  const st = gdriveLib.signState('s3cret', 'cuid_session_user', 'n1')
  const plainBack = await s.handleCallback(cbReq(st, { deckster_gdrive_oauth_nonce: 'n1' }))
  assert.equal(plainBack.location, 'https://app.test/settings/connectors?gdrive=connected'); assert.equal('deckster_gdrive_return' in plainBack.cookies.jar, false)
  for (const evil of ['https://evil.test/', '//evil.test', '/builder?session_id=x', '/settings/connectors']) {
    const r = await s.handleCallback(cbReq(st, { deckster_gdrive_oauth_nonce: 'n1', deckster_gdrive_return: evil }))
    assert.equal(r.location, 'https://app.test/settings/connectors?gdrive=connected', evil)
  }
})

// ================================================ 3. the hook, on a tiny hook runtime
class MemStorage { constructor() { this.map = new Map() } getItem(k) { return this.map.has(k) ? this.map.get(k) : null } setItem(k, v) { this.map.set(k, String(v)) } removeItem(k) { this.map.delete(k) } }
function hookRuntime() {
  let current = null
  const impl = { useState: (...a) => current.useState(...a), useRef: (...a) => current.useRef(...a), useCallback: (...a) => current.useCallback(...a), useEffect: (...a) => current.useEffect(...a) }
  const same = (a, b) => a && b && a.length === b.length && a.every((x, i) => Object.is(x, b[i]))
  function instance(call) {
    let cursor = 0, slots = [], pending = [], result, props, scheduled = false, rendering = false
    const hooks = {
      useState(init) { const i = cursor++; const slot = (slots[i] ??= { value: typeof init === 'function' ? init() : init }); return [slot.value, v => { const next = typeof v === 'function' ? v(slot.value) : v; if (!Object.is(next, slot.value)) { slot.value = next; schedule() } }] },
      useRef(init) { const i = cursor++; return (slots[i] ??= { current: init }) },
      useCallback(fn, deps) { const i = cursor++; const old = slots[i]; if (old && same(old.deps, deps)) return old.fn; slots[i] = { fn, deps }; return fn },
      useEffect(cb, deps) { const i = cursor++; const old = slots[i]; if (!old || !same(old.deps, deps)) { const next = { deps, cleanup: old?.cleanup }; slots[i] = next; pending.push(() => { next.cleanup?.(); next.cleanup = cb() }) } },
    }
    const render = () => {
      for (let pass = 0; pass < 20; pass++) {
        cursor = 0; pending = []; scheduled = false
        current = hooks; rendering = true
        try { result = call(props) } finally { current = null; rendering = false }
        for (const effect of pending) effect()
        if (!scheduled) return result
      }
      throw new Error('render loop')
    }
    function schedule() { scheduled = true; if (!rendering) queueMicrotask(() => { if (scheduled) render() }) }
    return { set(p) { props = p; return render() }, get result() { return result } }
  }
  return { impl, instance }
}
const settle = async () => { for (let i = 0; i < 12; i++) await new Promise(r => setTimeout(r, 0)) }

function makeHookWorld({ enabled = true, search = '', picks = [], fetchPlan = () => null, pickError = null } = {}) {
  const runtime = hookRuntime()
  const storage = new MemStorage()
  const log = { fetch: [], assigned: [], replaced: [], published: [], picker: 0 }
  const timers = []
  const win = { sessionStorage: storage, location: { search, pathname: '/builder', hash: '', assign: u => log.assigned.push(u) }, history: { replaceState: (_s, _t, u) => { log.replaced.push(u); win.location.search = u.includes('?') ? u.slice(u.indexOf('?')) : '' } } }
  const fakeFetch = async (url, init) => {
    const body = init?.body ? JSON.parse(init.body) : undefined
    log.fetch.push({ url, method: init?.method, body })
    const planned = fetchPlan(url, init?.method, body)
    const r = planned ?? { status: 200, body: {} }
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body }
  }
  const pickQueue = [...picks]
  const world = createWorld({
    env: enabled ? ENV_ON : {},
    stubs: { react: runtime.impl, '@/lib/gdrive-picker-loader': { openDrivePicker: async () => { log.picker++; if (pickError) throw pickError; return pickQueue.shift() ?? [] } } },
    globals: { window: win, fetch: fakeFetch, setTimeout: (fn, ms) => { if (ms >= 1000) { timers.push(fn); return timers.length } return setTimeout(fn, 0) }, clearTimeout: () => {} },
  })
  const hook = world.load('hooks/use-gdrive-composer.ts')
  const inst = runtime.instance(p => hook.useGdriveComposer(p))
  const host = { log, storage, win, timers, props: { sessionId: CHAT, onLinkedIdsChange: ids => log.published.push(ids === undefined ? 'undefined' : ids), enabled } }
  host.mount = () => inst.set(host.props)
  host.rerender = (over = {}) => { host.props = { ...host.props, ...over }; return inst.set(host.props) }
  Object.defineProperty(host, 'api', { get: () => inst.result })
  return host
}
const itemsOk = ids => ({ status: 200, body: { items: ids.map(id => ({ id, source_ref: id, title: `Title ${id.slice(0, 4)}`, status: 'queued', error: null })) } })
const linkOk = ids => ({ status: 200, body: { session_id: CHAT, linked: ids, rejected: [] } })
const happyPlan = (url, method, body) => (url.endsWith('/items') ? itemsOk(body.file_ids) : url.endsWith('/session-links') && method === 'POST' ? linkOk(body.item_ids) : url.endsWith('/session-links') ? { status: 200, body: { session_id: CHAT, unlinked: body.item_ids } } : null)

await t('hook, flag off: inert (no fetch, no storage, nothing published, no address change, addFromDrive does nothing)', async () => {
  const h = makeHookWorld({ enabled: false, search: `?session_id=${CHAT}&gdrive=connected`, picks: [[FILE_A]], fetchPlan: happyPlan })
  h.storage.setItem(`deckster_gdrive_links_${CHAT}`, JSON.stringify([{ id: FILE_A, title: 'x' }]))
  h.mount(); h.api.addFromDrive(async () => {}); await settle()
  assert.deepEqual(h.log.fetch, []); assert.deepEqual(h.log.published, []); assert.deepEqual(h.log.replaced, []); assert.equal(h.log.picker, 0); assert.deepEqual(plain(h.api.chips), []); assert.equal(h.api.connectOpen, false)
})
await t('hook: nothing stored => nothing published (no linked_item_ids key on the message); stored chips come back with the chat', async () => {
  const h = makeHookWorld(); h.mount(); await settle()
  assert.deepEqual(h.log.published, ['undefined']); assert.deepEqual(plain(h.api.chips), [])
  const h2 = makeHookWorld(); h2.storage.setItem(`deckster_gdrive_links_${CHAT}`, JSON.stringify([{ id: FILE_A, title: 'Q3 plan' }])); h2.mount(); await settle()
  assert.deepEqual(h2.log.published.at(-1), [FILE_A]); assert.deepEqual(plain(h2.api.chips), [{ id: FILE_A, title: 'Q3 plan', state: 'linked' }])
  h2.rerender({ sessionId: 'othersession0002' }); await settle()
  assert.deepEqual(plain(h2.api.chips), [], 'another chat shows its own chips'); assert.equal(h2.log.published.at(-1), 'undefined')
})
await t('pick: Picker -> /items -> /session-links; chips + the ids the build message carries; the chat is remembered', async () => {
  const h = makeHookWorld({ picks: [[FILE_A, FILE_B, FILE_A]], fetchPlan: happyPlan }); h.mount()
  h.api.addFromDrive(async () => {}); await settle()
  assert.equal(h.log.picker, 1)
  assert.deepEqual(h.log.fetch.map(f => [new URL(f.url, 'https://x').pathname, f.method]), [['/api/connectors/gdrive/items', 'POST'], ['/api/connectors/gdrive/session-links', 'POST']])
  assert.deepEqual(h.log.fetch[0].body, { file_ids: [FILE_A, FILE_B] }, 'duplicates dropped')
  assert.deepEqual(h.log.fetch[1].body, { session_id: CHAT, item_ids: [FILE_A, FILE_B] })
  assert.deepEqual(plain(h.api.chips.map(c => c.state)), ['linked', 'linked']); assert.equal(h.api.busy, false)
  assert.deepEqual(h.log.published.at(-1), [FILE_A, FILE_B])
  assert.deepEqual(JSON.parse(h.storage.getItem(`deckster_gdrive_links_${CHAT}`)).map(c => c.id), [FILE_A, FILE_B])
})
await t('pick: Picker cancelled => nothing fetched, nothing changed', async () => {
  const h = makeHookWorld({ picks: [[]], fetchPlan: happyPlan }); h.mount(); h.api.addFromDrive(async () => {}); await settle()
  assert.deepEqual(h.log.fetch, []); assert.deepEqual(plain(h.api.chips), []); assert.deepEqual(h.log.published, ['undefined'])
})
await t('D8b / D8c: too large and unsupported files become red chips, the rest of the pick is linked; the error chip is dismissed locally (no DELETE)', async () => {
  const plan = (url, method, body) => url.endsWith('/items')
    ? { status: 200, body: { items: [{ id: FILE_A, title: 'Q3 plan', status: 'queued' }, { id: FILE_B, title: 'Annual report.pdf', status: 'rejected', error: 'too_large' }, { id: FILE_C, title: 'Demo.mp4', status: 'rejected', error: 'mime_not_allowed' }] } }
    : linkOk(body.item_ids)
  const h = makeHookWorld({ picks: [[FILE_A, FILE_B, FILE_C]], fetchPlan: plan }); h.mount(); h.api.addFromDrive(async () => {}); await settle()
  assert.deepEqual(h.log.fetch[1].body, { session_id: CHAT, item_ids: [FILE_A] }, 'only the usable file is linked')
  assert.deepEqual(plain(h.api.chips.map(c => [c.state, c.errorKind ?? null])), [['linked', null], ['error', 'too_large'], ['error', 'unsupported']])
  assert.match(h.api.chips[1].message, /too large/); assert.match(h.api.chips[2].message, /Supported: Docs, Slides, Sheets/)
  assert.deepEqual(h.log.published.at(-1), [FILE_A])
  const before = h.log.fetch.length; h.api.removeChip(FILE_B); await settle()
  assert.equal(h.log.fetch.length, before, 'dismissing an error chip never calls the server'); assert.deepEqual(plain(h.api.chips.map(c => c.id)), [FILE_A, FILE_C])
})
await t('chip x: DELETE /session-links (unlink only), ids republished, [] after the last one; a failed unlink brings the chip back where it was', async () => {
  const h = makeHookWorld({ picks: [[FILE_A, FILE_B]], fetchPlan: happyPlan }); h.mount(); h.api.addFromDrive(async () => {}); await settle()
  h.api.removeChip(FILE_A); await settle()
  const del = h.log.fetch.at(-1); assert.deepEqual([del.method, new URL(del.url, 'https://x').pathname, del.body], ['DELETE', '/api/connectors/gdrive/session-links', { session_id: CHAT, item_ids: [FILE_A] }])
  assert.deepEqual(h.log.fetch.filter(f => f.url.includes('/items')).length, 1, 'the library is never touched by a chip x')
  assert.deepEqual(h.log.published.at(-1), [FILE_B]); h.api.removeChip(FILE_B); await settle()
  assert.deepEqual(h.log.published.at(-1), [], 'the user cleared the chat: [] (Director clears too)'); assert.equal(h.storage.getItem(`deckster_gdrive_links_${CHAT}`), '[]')
  // failure: chip comes back in place
  const h2 = makeHookWorld({ picks: [[FILE_A, FILE_B]], fetchPlan: (u, m, b) => (m === 'DELETE' ? { status: 502, body: { error: 'Could not remove your Drive files from this chat. Please try again.', error_code: null } } : happyPlan(u, m, b)) })
  h2.mount(); h2.api.addFromDrive(async () => {}); await settle(); h2.api.removeChip(FILE_A); await settle()
  assert.deepEqual(plain(h2.api.chips.map(c => c.id)), [FILE_A, FILE_B]); assert.deepEqual(h2.log.published.at(-1), [FILE_A, FILE_B])
  assert.equal(h2.api.notices.at(-1).tone, 'error'); assert.match(h2.api.notices.at(-1).text, /Could not remove/)
})
await t('D2a: not connected (picker rejects with CONNECTOR_NOT_CONNECTED) => the connect prompt; Connect goes to start?return=<this chat>; Not now closes it', async () => {
  const err = Object.assign(new Error('Google Drive is not available right now.'), { code: 'CONNECTOR_NOT_CONNECTED', status: 404 })
  const h = makeHookWorld({ pickError: err }); h.mount(); h.api.addFromDrive(async () => {}); await settle()
  assert.equal(h.api.connectOpen, true); assert.deepEqual(h.api.notices, []); assert.deepEqual(h.log.fetch, [])
  h.api.cancelConnect(); await settle(); assert.equal(h.api.connectOpen, false)
  h.api.addFromDrive(async () => {}); await settle(); h.api.connect(); await settle()
  assert.deepEqual(h.log.assigned, [`/api/connectors/gdrive/start?return=${encodeURIComponent(`/builder?session_id=${CHAT}`)}`]); assert.equal(h.api.startHref, h.log.assigned[0])
})
await t('D8a: an expired grant (picker or /items) => warn notice with Reconnect, never the connect prompt', async () => {
  const revoked = Object.assign(new Error('x'), { code: 'CONNECTOR_GRANT_REVOKED', status: 409 })
  const h = makeHookWorld({ pickError: revoked }); h.mount(); h.api.addFromDrive(async () => {}); await settle()
  assert.equal(h.api.connectOpen, false); assert.deepEqual(plain(h.api.notices.map(n => [n.tone, n.action, n.text])), [['warn', 'reconnect', 'Drive connection expired. Reconnect to keep using your files.']])
  const h2 = makeHookWorld({ picks: [[FILE_A]], fetchPlan: url => (url.endsWith('/items') ? { status: 409, body: { error: 'x', error_code: 'CONNECTOR_GRANT_REVOKED' } } : null) })
  h2.mount(); h2.api.addFromDrive(async () => {}); await settle()
  assert.equal(h2.api.notices[0].action, 'reconnect'); assert.deepEqual(plain(h2.api.chips), [])
  h2.api.connect(); assert.equal(h2.log.assigned.length, 1)
})
await t('a session-links failure marks the waiting chips as not added (and says why); an unknown picker error is shown in plain words', async () => {
  const h = makeHookWorld({ picks: [[FILE_A]], fetchPlan: (u, m, b) => (u.endsWith('/session-links') ? { status: 403, body: { error: 'Could not add your Drive files to this chat. Please try again.', error_code: null } } : happyPlan(u, m, b)) })
  h.mount(); h.api.addFromDrive(async () => {}); await settle()
  assert.deepEqual(plain(h.api.chips.map(c => c.state)), ['error']); assert.deepEqual(h.log.published.at(-1), []); assert.match(h.api.notices.at(-1).text, /Drive/)
  const h2 = makeHookWorld({ pickError: new Error('Google Drive picker is not set up yet.') }); h2.mount(); h2.api.addFromDrive(async () => {}); await settle()
  assert.equal(h2.api.notices[0].text, 'Google Drive picker is not set up yet.'); assert.equal(h2.api.connectOpen, false)
})
await t('a new chat: the composer\'s own session creator runs first and the pick uses the id it produced; no id in time => an error, no Picker', async () => {
  const h = makeHookWorld({ picks: [[FILE_A]], fetchPlan: happyPlan }); h.props.sessionId = null; h.mount()
  h.api.addFromDrive(async () => { await new Promise(r => setTimeout(r, 5)); h.rerender({ sessionId: CHAT }) }); await settle(); await new Promise(r => setTimeout(r, 30)); await settle()
  assert.equal(h.log.fetch[1].body.session_id, CHAT); assert.deepEqual(plain(h.api.chips.map(c => c.state)), ['linked'])
  const h2 = makeHookWorld({ picks: [[FILE_A]] }); h2.props.sessionId = null; h2.mount(); h2.api.addFromDrive(async () => { throw new Error('boom') }); await settle()
  assert.equal(h2.log.picker, 0); assert.match(h2.api.notices[0].text, /Could not start this chat/)
})
await t('the 25-file cap: only what fits is added, and the user is told', async () => {
  const ids = Array.from({ length: 27 }, (_, i) => `file_${String(i).padStart(2, '0')}_abcdefghij`)
  const h = makeHookWorld({ picks: [ids.slice(0, 25), ids.slice(25)], fetchPlan: happyPlan }); h.mount(); h.api.addFromDrive(async () => {}); await settle()
  assert.equal(h.api.chips.length, 25)
  h.api.addFromDrive(async () => {}); await settle(); assert.equal(h.api.chips.length, 25); assert.equal(h.log.picker, 1, 'full: the Picker is not even opened'); assert.match(h.api.notices.at(-1).text, /up to 25/)
})
await t('D2c: back from Google (?gdrive=connected): the param is taken off the address once, a toast says so, the Picker opens and the files are linked', async () => {
  const h = makeHookWorld({ search: `?session_id=${CHAT}&gdrive=connected`, picks: [[FILE_A]], fetchPlan: happyPlan }); h.mount(); await settle()
  assert.deepEqual(h.log.replaced, [`/builder?session_id=${CHAT}`]); assert.equal(h.log.picker, 1)
  assert.deepEqual(plain(h.api.chips.map(c => c.state)), ['linked']); assert.deepEqual(h.log.published.at(-1), [FILE_A])
  assert.ok(h.api.notices.some(n => n.tone === 'info' && n.text === 'Google Drive connected. Opening Picker…'), 'the toast')
  h.timers.forEach(fn => fn()); await settle(); assert.deepEqual(plain(h.api.notices.filter(n => n.tone === 'info')), [], 'the toast goes by itself')
  h.rerender({ sessionId: CHAT }); h.rerender({}); await settle(); assert.equal(h.log.picker, 1, 'it never reopens on later renders')
})
await t('?gdrive=cancelled / failed / invalid: a plain note, no Picker; failed and invalid offer Reconnect', async () => {
  for (const [status, tone, action] of [['cancelled', 'info', null],['failed', 'warn', 'reconnect'], ['invalid', 'warn', 'reconnect']]) {
    const h = makeHookWorld({ search: `?session_id=${CHAT}&gdrive=${status}` }); h.mount(); await settle()
    assert.equal(h.log.picker, 0, status); assert.deepEqual(h.log.replaced, [`/builder?session_id=${CHAT}`]); assert.deepEqual(plain(h.api.notices.map(n => [n.tone, n.action])), [[tone, action]], status)
  }
  const none = makeHookWorld({ search: `?session_id=${CHAT}` }); none.mount(); await settle(); assert.deepEqual(none.log.replaced, [], 'no param: the address bar is never touched')
})
await t('the return is held until the chat id is known, then handled once', async () => {
  const h = makeHookWorld({ search: '?session_id=new&gdrive=connected', picks: [[FILE_A]], fetchPlan: happyPlan }); h.props.sessionId = null; h.mount(); await settle()
  assert.equal(h.log.picker, 0); h.rerender({ sessionId: CHAT }); await settle(); assert.equal(h.log.picker, 1)
})

// ================================================ 4. the components (static markup)
const passthrough = ({ children }) => React.createElement(React.Fragment, null, children)
const uiStubs = {
  '@/components/ui/dropdown-menu': { DropdownMenu: passthrough, DropdownMenuTrigger: passthrough, DropdownMenuContent: ({ children, ...p }) => React.createElement('div', { role: 'menu', 'data-gdrive-menu': p['data-gdrive-menu'] }, children), DropdownMenuItem: ({ children, disabled, onSelect, ...p }) => React.createElement('div', { role: 'menuitem', 'aria-disabled': disabled ? 'true' : undefined, ...Object.fromEntries(Object.entries(p).filter(([k]) => k.startsWith('data-'))) }, children) },
  '@/components/ui/dialog': { Dialog: ({ open, children }) => (open ? React.createElement('div', { 'data-dialog': 'open' }, children) : null), DialogContent: ({ children, ...p }) => React.createElement('div', { role: 'dialog', 'data-gdrive-dialog': p['data-gdrive-dialog'] }, children), DialogHeader: passthrough, DialogFooter: passthrough, DialogTitle: ({ children }) => React.createElement('h2', null, children), DialogDescription: ({ children }) => React.createElement('p', null, children) },
  './studio-composer-hint': { StudioComposerHint: passthrough },
  './gdrive-composer.css': {},
}
const comps = createWorld({ env: ENV_ON, stubs: uiStubs }).load('components/builder/gdrive-composer.tsx')
const api = (over = {}) => ({ chips: [], notices: [], busy: false, connectOpen: false, startHref: '/x', addFromDrive() {}, connect() {}, cancelConnect() {}, removeChip() {}, dismissNotice() {}, ...over })
const html = el => renderToStaticMarkup(el)
await t('D1a menu: a Paperclip trigger "Attach" with Upload file + Add from Google Drive; without uploads only the Drive item; busy disables Drive', async () => {
  const on = html(React.createElement(comps.GdriveAttachMenu, { studio: true, uploadEnabled: true, uploadDisabled: false, busy: false, onUpload() {}, onAddFromDrive() {} }))
  assert.match(on, /aria-label="Attach"/); assert.match(on, /data-gdrive-menu-item="upload"[^>]*>.*Upload file/); assert.match(on, /data-gdrive-menu-item="drive"[^>]*>.*Add from Google Drive/); assert.ok(!on.includes('aria-label="Upload a file"'))
  const noUp = html(React.createElement(comps.GdriveAttachMenu, { studio: false, uploadEnabled: false, uploadDisabled: false, busy: false, onUpload() {}, onAddFromDrive() {} }))
  assert.ok(!noUp.includes('Upload file') && noUp.includes('Add from Google Drive') && noUp.includes('title="Attach"'))
  assert.match(html(React.createElement(comps.GdriveAttachMenu, { studio: true, uploadEnabled: true, uploadDisabled: true, busy: true, onUpload() {}, onAddFromDrive() {} })), /data-gdrive-menu-item="drive"[^>]*aria-disabled="true"|aria-disabled="true"[^>]*data-gdrive-menu-item="drive"/)
})
await t('D3b chips: "N Drive files linked to this chat", per-chip x with an accessible name, linking chips cannot be removed; nothing at all when there is nothing', async () => {
  assert.equal(html(React.createElement(comps.GdriveChipsBar, { gdrive: api() })), '')
  const m = html(React.createElement(comps.GdriveChipsBar, { gdrive: api({ chips: [{ id: FILE_A, title: 'Q3 plan.gdoc', state: 'linked' }, { id: FILE_B, title: 'Revenue.gsheet', state: 'linked' }, { id: FILE_C, title: 'Notes', state: 'linking' }] }) }))
  assert.match(m, /2 Drive files linked to this chat/); assert.match(m, /Q3 plan\.gdoc/); assert.match(m, /aria-label="Remove Q3 plan\.gdoc from this chat"/)
  assert.match(m, /data-gdrive-chip="linking"[\s\S]*?data-gdrive-chip-remove="true"[^>]*disabled/)
  assert.match(html(React.createElement(comps.GdriveChipsBar, { gdrive: api({ chips: [{ id: FILE_A, title: 'Only', state: 'linked' }] }) })), /1 Drive file linked to this chat/)
})
await t('D8 states: red chip + inline alert for too large / unsupported; warn alert with Reconnect for expiry; the connect prompt text (D2a)', async () => {
  const bad = lib.itemFailure('Annual report.pdf', 'too_large'), bad2 = lib.itemFailure('Demo.mp4', 'mime_not_allowed')
  const m = html(React.createElement(comps.GdriveChipsBar, { gdrive: api({ chips: [{ id: FILE_A, title: 'Annual report.pdf', state: 'error', errorKind: bad.kind, message: bad.message }, { id: FILE_B, title: 'Demo.mp4', state: 'error', errorKind: bad2.kind, message: bad2.message }] }) }))
  assert.match(m, /data-gdrive-chip="error" data-gdrive-kind="too_large"/); assert.match(m, /role="alert" data-gdrive-alert="error"/); assert.match(m, /is too large\. The limit is 20 MB per file\./); assert.match(m, /can&#x27;t be used\. Supported: Docs, Slides, Sheets, PDF, DOCX, PPTX, XLSX, CSV, TXT, MD\./)
  assert.match(m, /aria-label="Dismiss Annual report\.pdf"/); assert.ok(!m.includes('linked to this chat'), 'no "linked" line when nothing is linked')
  const w = html(React.createElement(comps.GdriveChipsBar, { gdrive: api({ notices: [{ id: 'n1', tone: 'warn', text: 'Drive connection expired. Reconnect to keep using your files.', action: 'reconnect' }] }) }))
  assert.match(w, /data-gdrive-alert="warn"/); assert.match(w, /data-gdrive-reconnect="true"[^>]*>Reconnect</)
  const d = html(React.createElement(comps.GdriveChipsBar, { gdrive: api({ connectOpen: true }) }))
  assert.match(d, /Connect Google Drive/); assert.match(d, /Deckster only sees the files you pick\. It cannot browse the rest of your Drive\./); assert.match(d, />Not now</); assert.match(d, />Connect</)
})

// ================================================ 5. FLAG-OFF IDENTITY
const CHAT_INPUT = 'components/builder/chat-input.tsx', PAGE = 'app/builder/page.tsx'
await t('marked lines stripped = the base file, byte for byte (chat-input.tsx and the builder page), through the registry too', async () => {
  for (const rel of CONNECTORS_GDRIVE_COMPOSER_FILES) {
    const now = read(rel), base = gitShow(rel)
    assert.notEqual(now, base, `${rel}: this change edits it`)
    assert.equal(stripConnectorsGdriveComposer(rel, now), base, `${rel}: strip(this change) === base`)
    assert.equal(stripLaterChanges(rel, now), stripLaterChanges(rel, base), `${rel}: through the registry (every later change's strip, this one included) it reads as the base reads`)
    assert.ok(LATER_STRIPS.includes(stripConnectorsGdriveComposer), 'registered')
  }
  assert.equal(stripConnectorsGdriveComposer('lib/other.ts', 'GDRIVE-COMPOSER x'), 'GDRIVE-COMPOSER x', 'another file is returned as it is')
  assert.equal(stripConnectorsGdriveComposer(PAGE, 7), 7)
  // every added line in the two files carries the marker, and the only rewritten base lines are the two put-backs
  for (const rel of CONNECTORS_GDRIVE_COMPOSER_FILES) {
    const diff = execFileSync('git', ['diff', '-U0', BASE, 'HEAD', '--', rel], { cwd: root, encoding: 'utf8' }).split('\n')
    const removed = diff.filter(l => /^-(?!--)/.test(l)), added = diff.filter(l => /^\+(?!\+\+)/.test(l))
    assert.deepEqual(removed, [], `${rel}: no base line is rewritten or removed (pure insertions: older pins hold the base's lines in order)`)
    assert.ok(added.every(l => /(?<![\w-])GDRIVE-COMPOSER(?![\w-])/.test(l)), `${rel}: every added line carries the marker`)
  }
  for (const rel of ['app/builder/page.tsx', 'components/builder/chat-input.tsx', 'lib/connectors-gdrive-server.ts', 'app/api/connectors/gdrive/start/route.ts', 'lib/gdrive-picker-loader.ts']) assert.ok(CONNECTORS_GDRIVE_COMPOSER_SCOPE_FILES.has(rel) && LATER_CHANGE_FILES.has(rel), `${rel} is registered`)
})

// the REAL ChatInput on both sources
const FLAG_SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const refuse = () => { throw new Error('fixture refuses services, timers and writes') }
const nothing = () => null
const hookStubs = { useState: init => [typeof init === 'function' ? init() : init, () => {}], useEffect() {}, useLayoutEffect() {}, useRef: current => ({ current }), useCallback: cb => cb, useMemo: cb => cb() }
const inputEnv = {}
const features = { enableFileUploads: true }
const gdriveComponents = createWorld({ env: ENV_ON, stubs: uiStubs }).load('components/builder/gdrive-composer.tsx')
const inputStubs = {
  react: { ...React, ...hookStubs }, 'react/jsx-runtime': nodeRequire('react/jsx-runtime'),
  'lucide-react': new Proxy({}, { get: (_, name) => (name === '__esModule' ? false : function Icon() { return React.createElement('svg', { 'data-icon': String(name) }) }) }),
  '@/components/ui/button': { Button: ({ children }) => React.createElement('button', null, children) },
  '@/components/ui/textarea': { Textarea: p => React.createElement('textarea', { placeholder: p.placeholder, 'aria-label': p['aria-label'], disabled: p.disabled, rows: p.rows, defaultValue: p.value }) },
  '@/components/ui/switch': { Switch: () => React.createElement('button', { role: 'switch' }) },
  '@/components/ui/dropdown-menu': { DropdownMenu: passthrough, DropdownMenuContent: passthrough, DropdownMenuTrigger: passthrough },
  '@/components/file-chip': { FileChip: () => React.createElement('span', { 'data-file-chip': 'true' }) },
  '@/components/builder/chat/mention-popover': { SlideMentionPopover: nothing }, '@/lib/mdc-mentions': { filterMentionSlides: () => [], mentionToken: refuse }, '@/lib/mdc-flags': { CHAT_MENTIONS: false },
  '@/lib/config': { getThemeBuilderUrl: refuse, features }, '@/lib/service-url': { ServiceUrlConfigError: class extends Error {} },
  '@/lib/theme-builder': { FALLBACK_THEME_PRESETS: [], isValidThemeHex: () => true, normalizeThemePresetId: v => v },
  '@/hooks/use-theme-profiles': { useThemeProfiles: () => ({ loading: false, error: null, listThemes: refuse, saveTheme: refuse, setStandardTheme: refuse, clearStandardTheme: refuse, deleteTheme: refuse }) },
  '@/hooks/use-templates': { isTemplateGenerationReady: () => false, templateGenerationUnavailableReason: () => '' },
  './template-picker': { TemplatePicker: nothing }, './studio-composer-hint': { StudioComposerHint: passthrough }, './studio-theme-menu': { StudioThemeMenu: nothing },
  '@/lib/studio-composer-popups': { nextComposerPopup: refuse, keepPopupOpenForDropdownList: refuse },
  '@/lib/studio-chat-clean': { STUDIO_CHAT_CLEAN_ENABLED: false, CHAT_CLEAN_TEXTAREA_MIN_HEIGHT: 44 }, '@/components/builder/chat/studio-chat-clean': { StudioChatCleanSendSide: nothing },
  '@/components/builder/chat/studio-chat-commands': { useStudioChatCommands: () => ({ menu: null, onKeyDown: () => false, textareaProps: {}, templatePicker: {} }) },
  '@/lib/studio-chat-parity': { CHAT_PARITY_THEME_LIBRARY_EVENT: 'x', STUDIO_CHAT_PARITY_THEMES_ENABLED: false },
  './gdrive-composer': gdriveComponents,
  './voice-call/voice-call-buttons': { VoiceCallButtons: nothing }, '@/lib/studio-voice-call-ui': { callEndFocusGoesToComposer: () => false }, // the base's VOICE-CALL imports (no voiceCall prop here: null / inert)
}
function loadChatInput(source) {
  const mod = { exports: {} }
  new Function('module', 'exports', 'require', 'process', 'console', 'fetch', 'setTimeout', 'clearTimeout', 'localStorage', compile(CHAT_INPUT, source))(mod, mod.exports, spec => { assert.ok(spec in inputStubs, `unexpected import ${spec}`); return inputStubs[spec] }, { env: inputEnv }, console, refuse, refuse, refuse, undefined)
  return mod.exports.ChatInput
}
const makeProps = (over = {}) => ({
  inputMessage: '', onInputChange: () => {}, onSubmit: () => {}, uploadedFiles: [], onFilesSelected: refuse, onRemoveFile: refuse, onClearAllFiles: refuse,
  pendingActionInput: null, onCancelAction: () => {}, researchEnabled: false, onResearchEnabledChange: refuse, webSearchEnabled: false, onWebSearchEnabledChange: refuse,
  knowledgeGraphEnabled: false, onKnowledgeGraphEnabledChange: refuse, showKnowledgeGraphToggle: false, knowledgeGraphAccess: 'unavailable', onKnowledgeGraphAccessClick: refuse,
  isReady: true, isLoadingSession: false, connected: true, connecting: false, user: { id: 'synthetic-user' }, currentSessionId: 'synthetic-session', onRequestSession: refuse, buildTheme: { mode: 'auto' }, onBuildThemeChange: refuse, ...over,
})
const STATES = {
  idle: () => makeProps(), draft: () => makeProps({ inputMessage: 'Make the title shorter' }),
  uploading: () => makeProps({ uploadedFiles: [{ id: 'f1', name: 'brief.pdf', status: 'uploading', size: 10, type: 'application/pdf' }] }),
  five: () => makeProps({ uploadedFiles: Array.from({ length: 5 }, (_, i) => ({ id: `f${i}`, name: `f${i}.pdf`, status: 'success', size: 10, type: 'application/pdf' })) }),
  'no-user': () => makeProps({ user: null }), loading: () => makeProps({ isLoadingSession: true }), disconnected: () => makeProps({ connected: false }),
  awaiting: () => makeProps({ awaitingReply: true }), research: () => makeProps({ researchEnabled: true, webSearchEnabled: true }),
}
// null / false / undefined children are no element at all: drop them (and unwrap a lone child) so a `{x ? <A/> : null}` that is null reads as absent
const normalise = node => {
  if (Array.isArray(node)) { const kept = node.filter(n => n !== null && n !== undefined && n !== false && n !== true).map(normalise); return kept }
  if (node && typeof node === 'object' && node.props) {
    const { children, ...rest } = node.props
    const kids = children === undefined ? undefined : (() => { const flat = [].concat(children).filter(n => n !== null && n !== undefined && n !== false && n !== true).map(normalise); return flat.length === 0 ? undefined : flat.length === 1 ? flat[0] : flat })()
    return { type: typeof node.type === 'function' ? `fn:${node.type.name}` : String(node.type?.toString?.() ?? node.type), key: node.key, props: { ...rest, ...(kids === undefined ? {} : { children: kids }) } }
  }
  return node
}
const ser = v => JSON.stringify(v, (k, i) => (typeof i === 'function' ? `[fn ${i.name || ''}]` : typeof i === 'symbol' ? String(i) : i === undefined ? '__undefined__' : i))
const BaseChatInput = loadChatInput(gitShow(CHAT_INPUT))
const NowChatInput = loadChatInput(read(CHAT_INPUT))
const setEnv = (shell, uploads = true) => { for (const k of Object.keys(inputEnv)) delete inputEnv[k]; if (shell !== undefined) inputEnv[FLAG_SHELL] = shell; features.enableFileUploads = uploads }
await t('FLAG OFF (no `gdrive` prop): the composer is exactly the base\'s: same markup and same element tree, every state, both shells, uploads on and off', async () => {
  let n = 0
  for (const shell of ['true', 'false', undefined]) for (const uploads of [true, false]) {
    setEnv(shell, uploads)
    for (const [name, make] of Object.entries(STATES)) {
      const a = BaseChatInput(make()), b = NowChatInput(make())
      assert.equal(html(b), html(a), `${name} shell=${shell} uploads=${uploads}: markup`)
      assert.equal(sha(ser(normalise(b))), sha(ser(normalise(a))), `${name} shell=${shell} uploads=${uploads}: element tree`)
      assert.ok(!html(b).includes('data-gdrive'), 'no Drive attribute anywhere'); n++
    }
  }
  assert.equal(n, 6 * Object.keys(STATES).length)
  setEnv('true', true)
  assert.match(html(NowChatInput(makeProps())), /aria-label="Upload a file"/, 'the direct Paperclip is still there, with its own label')
})
await t('FLAG ON (a `gdrive` prop): the Paperclip becomes the menu, the chips sit above the composer box, nothing else in the composer changes', async () => {
  setEnv('true', true)
  const g = api({ chips: [{ id: FILE_A, title: 'Q3 plan.gdoc', state: 'linked' }, { id: FILE_B, title: 'Revenue.gsheet', state: 'linked' }] })
  const off = html(NowChatInput(makeProps())), on = html(NowChatInput(makeProps({ gdrive: g })))
  assert.match(on, /data-gdrive-attach="true"/); assert.match(on, /aria-label="Upload a file" style="display:none" aria-hidden="true" tabindex="-1"/, 'the direct button is still in the tree, hidden and out of the tab order'); assert.ok(!off.includes('display:none'), 'flag off: not hidden'); assert.match(on, /Add from Google Drive/); assert.match(on, /Upload file/)
  assert.match(on, /2 Drive files linked to this chat/)
  assert.ok(on.indexOf('data-gdrive-composer="bar"') < on.indexOf('<form'), 'the chips are above the composer box')
  const barHtml = html(React.createElement(gdriveComponents.GdriveChipsBar, { gdrive: g }))
  const menuHtml = html(React.createElement(gdriveComponents.GdriveAttachMenu, { studio: true, uploadEnabled: true, uploadDisabled: false, busy: false, onUpload() {}, onAddFromDrive() {} }))
  assert.ok(on.includes(barHtml) && on.includes(menuHtml), 'the chips and the menu are the components\' own markup')
  const strip = text => text.replace(barHtml, '').replace(menuHtml, '').replace(' style="display:none" aria-hidden="true" tabindex="-1"', '')
  assert.equal(strip(on), off, 'with the chips, the menu and the hiding taken out, the composer is the same markup as with the flag off')
  setEnv('true', false)
  const noUploads = html(NowChatInput(makeProps({ gdrive: g })))
  assert.match(noUploads, /Add from Google Drive/); assert.ok(!noUploads.includes('Upload file'), 'file uploads off: the menu offers Drive only')
  setEnv('true', true)
  const five = html(NowChatInput(makeProps({ gdrive: g, uploadedFiles: STATES.five().uploadedFiles })))
  assert.match(five, /data-gdrive-menu-item="upload"[^>]*aria-disabled="true"|aria-disabled="true"[^>]*data-gdrive-menu-item="upload"/, 'five files attached: Upload file is disabled like the Paperclip')
  const busy = html(NowChatInput(makeProps({ gdrive: api({ busy: true }) })))
  assert.match(busy, /aria-disabled="true"/)
  const calls2 = []; const el = NowChatInput(makeProps({ gdrive: api({ addFromDrive: ensure => calls2.push(ensure) }), onRequestSession: async () => {} }))
  const find = (n, pred) => (Array.isArray(n) ? n.flatMap(c => find(c, pred)) : n && typeof n === 'object' && n.props ? [...(pred(n) ? [n] : []), ...find(n.props.children, pred)] : [])
  const menu = find(el, n => n.type === gdriveComponents.GdriveAttachMenu)[0]
  assert.ok(menu, 'the menu is in the tree'); menu.props.onAddFromDrive(); assert.equal(calls2.length, 1); assert.equal(typeof calls2[0], 'function', 'it hands the composer\'s own session creator to the hook')
})

// ================================================ 6. page wiring
const page = read(PAGE)
await t('page: the hook is called once, after the chat id exists; the gate is the existing Knowledge check; the four build sends read the ref; the prop is a marked spread', async () => {
  assert.equal(page.split('useGdriveComposer({').length - 1, 1)
  const hookAt = page.indexOf('const gdriveComposer = useGdriveComposer({ sessionId: currentSessionId, onLinkedIdsChange: ids => { gdriveLinkedIdsRef.current = ids } })')
  assert.ok(page.indexOf('const [currentSessionId, setCurrentSessionId]') > 0 && page.indexOf('const [currentSessionId, setCurrentSessionId]') < hookAt)
  assert.ok(page.indexOf('const gdriveLinkedIdsRef = useRef<string[] | undefined>(undefined)') > 0 && page.indexOf('const gdriveLinkedIdsRef') < hookAt, 'the ref is declared before the hook that fills it')
  assert.ok(page.includes('const gdriveOffer = isGdriveComposerEnabled(kgIsPremium)') && page.indexOf('const gdriveOffer') > page.indexOf('isPremium: kgIsPremium'))
  assert.ok(page.includes('{...(gdriveOffer ? { gdrive: gdriveComposer } : {})'))
  // handleSendMessage's three typed sends go through sendTypedTurn, whose first line adds the ids: their option literals stay the base's (test-studio-agent-mode-wire runs them as they are).
  // handleActionClick's send spreads them after the base's AGENT-MODE-WIRE line, which keeps its pinned place right after buildSendOptions.
  const lines = page.split('\n'), sendsAt = lines.flatMap((l, i) => (l.trim() === '...buildSendOptions,' ? [i] : []))
  assert.equal(sendsAt.length, 4, 'the four build sends spread buildSendOptions')
  const typed = lines.findIndex(l => l.trim() === 'const sendTypedTurn = async (options: Parameters<typeof sendMessageWhenConnected>[3]) => {')
  assert.ok(typed > 0 && sendsAt.slice(0, 3).every(i => i > typed), 'the typed send helper comes before its three callers')
  assert.ok(lines[typed + 1].trim().startsWith('if (gdriveLinkedIdsRef.current) options = { ...options, linkedItemIds: gdriveLinkedIdsRef.current } // GDRIVE-COMPOSER'), 'its first line adds the ids to what its callers pass')
  assert.equal(page.split('await sendTypedTurn({').length - 1, 3, 'three typed build sends go through it')
  const spread = '...(gdriveLinkedIdsRef.current ? { linkedItemIds: gdriveLinkedIdsRef.current } : {}),'
  const after = i => { let j = i + 1; while (/ \/\/ AGENT-MODE-WIRE$/.test(lines[j])) j++; return lines[j].trim() }
  assert.deepEqual(sendsAt.map(i => after(i).startsWith(spread)), [false, false, false, true], 'only the action click\'s literal carries the spread')
  assert.equal(page.split(spread).length - 1, 1)
  assert.ok(!/useGdriveComposer|gdriveLinkedIdsRef|isGdriveComposerEnabled|gdriveOffer/.test(stripConnectorsGdriveComposer(PAGE, page)), 'nothing of it survives the strip')
  assert.ok(/\[templateSendOptions, buildThemeSelection, deckIdentity\],\n/.test(page), 'buildSendOptions itself is the base\'s')
})

// ================================================ 7. the wire: chip ids become linked_item_ids (the #608 hook, unchanged); flag off => no key
await t('wire: the chips\' ids go out as linked_item_ids through the existing hook helper; flag off or undefined => no key; [] clears', async () => {
  const sl = createWorld({ env: ENV_ON }).load('lib/connectors-gdrive-session-links.ts'), slOff = createWorld({ env: {} }).load('lib/connectors-gdrive-session-links.ts')
  const ids = lib.linkedIdsOf([{ id: FILE_A, title: 'a', state: 'linked' }, { id: FILE_B, title: 'b', state: 'error' }])
  assert.deepEqual(plain(sl.linkedItemIdsField(ids)), { linked_item_ids: [FILE_A] })
  assert.deepEqual(plain(sl.linkedItemIdsField([])), { linked_item_ids: [] })
  assert.deepEqual(plain(sl.linkedItemIdsField(undefined)), {})
  assert.deepEqual(plain(slOff.linkedItemIdsField(ids)), {}, 'session-links flag off: the key is not there at all')
  assert.equal(fs.readFileSync(path.join(root, 'hooks/use-deckster-websocket-v2.ts'), 'utf8'), execFileSync('git', ['show', 'HEAD:hooks/use-deckster-websocket-v2.ts'], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 }), 'the websocket hook is not touched by this change')
})

console.log(`\n${passed} passed`)
