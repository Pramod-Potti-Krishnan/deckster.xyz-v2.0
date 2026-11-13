// P4-15 piece C (DARK): remove ONE Drive item from the library (Researcher !273 DELETE /gdrive/items) — rides NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED.
// Run: node scripts/test-studio-connectors-item-remove.mjs   (transpile + vm, fake fetch, no network)
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { execFileSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nodeRequire = createRequire(path.join(root, 'package.json'))
const React = nodeRequire('react')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')

function load(file, stubs, env) {
  const cache = new Map()
  const run = (abs) => {
    if (cache.has(abs)) return cache.get(abs).exports
    const src = fs.readFileSync(abs, 'utf8')
    const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    const mod = { exports: {} }; cache.set(abs, mod)
    const req = (spec) => {
      if (spec in stubs) return stubs[spec]
      if (spec.startsWith('@/')) { const base = path.join(root, spec.slice(2)); for (const s of ['.ts', '.tsx']) if (fs.existsSync(base + s)) return run(base + s) }
      return nodeRequire(spec)
    }
    vm.runInNewContext(js, { require: req, module: mod, exports: mod.exports, process: { env }, console, URL, URLSearchParams, Buffer, JSON, Date, Promise, AbortSignal, fetch: (...a) => globalThis.fetch(...a) }, { filename: abs })
    return mod.exports
  }
  return run(path.join(root, file))
}

// ---- fakes ----
class FakeRes {
  constructor(body, status = 200, location, headers) { this.body = body; this.status = status; this.location = location; this.headers = new Headers(headers); this.cookies = { jar: {}, set: (n, v, o) => { this.cookies.jar[n] = { v, o } } } }
}
const plain = v => JSON.parse(JSON.stringify(v))
const NextResponse = { json: (b, i = {}) => new FakeRes(b, i.status ?? 200, undefined, i.headers), redirect: (u) => new FakeRes(null, 307, String(u)) }
// hardening: the server reads Researcher answers as real Responses (a capped stream), so every fake answer becomes one
async function asResponse(r) {
  if (r instanceof Response) return r
  let text
  try { text = JSON.stringify(await r.json()) } catch { text = 'not json' }
  return new Response(text, { status: r.status })
}
let calls = []
let entitlementChecks = 0
let reply = () => ({ ok: true, status: 200, json: async () => ({}) })
const stubsFor = (userId = 'cuid_session_user') => ({
  'next/server': { NextResponse },
  '@/lib/kg-proxy': {
    requireKgEntitled: async () => { entitlementChecks++; return userId ? { userId } : { error: new FakeRes({ error: 'Unauthorized' }, 401) } },
    kgHeaders: (x) => ({ ...x, 'X-API-Key': 'test-key' }),
  },
  '@/lib/service-url': { requireServiceUrl: (_l, c) => { if (!c[0].value) throw new Error('nc'); return c[0].value } },
})
const ENV_ON = { NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED: 'true', NEXTAUTH_SECRET: 's3cret', NEXTAUTH_URL: 'https://app.test', GOOGLE_CONNECTOR_CLIENT_ID: 'cid', KNOWLEDGE_SERVICE_URL: 'https://researcher.test', RESEARCHER_SESSION_TOKEN_SECRET: 'test-only-researcher-session-secret-0123456789' }
const fakeFetch = async (url, init) => { calls.push({ url, init, body: init?.body ? JSON.parse(init.body) : undefined }); return asResponse(await reply(url, init)) }
globalThis.fetch = fakeFetch
const SERVER = 'lib/connectors-gdrive-server.ts'
let jsonReads = 0
const req = (body) => ({ url: 'u', json: async () => { jsonReads++; return body } })
let passed = 0
const t = async (name, fn) => { calls = []; entitlementChecks = 0; jsonReads = 0; reply = () => ({ ok: true, status: 200, json: async () => ({}) }); await fn(); passed++; console.log('ok -', name) }

const DOC = '1DocAAAAAAAAAAAAA'
const DOC2 = '1DocBBBBBBBBBBBBB'
const rm = load('lib/connectors-gdrive-remove.ts', {}, {})

// 1. flag off => the DELETE handler 404s, no body read, no entitlement check, no fetch
for (const flag of [undefined, 'false', 'TRUE', '1', ' true']) {
  await t(`flag ${JSON.stringify(flag)} => DELETE items 404, nothing read or fetched`, async () => {
    const s = load(SERVER, stubsFor(), { ...ENV_ON, NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED: flag })
    const r = await s.handleItemsDelete(req({ item_ids: [DOC] }))
    assert.equal(r.status, 404); assert.deepEqual(plain(r.body), { error: 'Not found' })
    assert.equal(calls.length, 0); assert.equal(jsonReads, 0); assert.equal(entitlementChecks, 0)
  })
}
await t('items route exports GET, POST and DELETE; DELETE flag off => 404 through the real route', async () => {
  const route = load('app/api/connectors/gdrive/items/route.ts', { '@/lib/connectors-gdrive-server': load(SERVER, stubsFor(), {}) }, {})
  assert.deepEqual(Object.keys(route).filter(k => ['GET', 'POST', 'DELETE'].includes(k)).sort(), ['DELETE', 'GET', 'POST'])
  assert.equal((await route.DELETE(req({ item_ids: [DOC] }))).status, 404)
  assert.equal(calls.length, 0)
})

// 2. on: Researcher contract (!273): DELETE /api/v1/connectors/gdrive/items {owner_id, item_ids}, service key + lib:<owner> K-06 token
const tokenParts = (tok) => String(tok).split('.').map(p => Buffer.from(p, 'base64url').toString('utf8'))
await t('on: DELETE {owner_id = session cuid, item_ids deduped}; body owner ignored; lib:<owner> token; allow-listed relay', async () => {
  reply = () => ({ ok: true, status: 200, json: async () => ({ removed: [DOC], rejected: [{ id: DOC2, error: 'not_found', storage_path: 'p/x' }], content_erased: false, secret: 'LEAK', token: 'LEAK' }) })
  const s = load(SERVER, stubsFor(), ENV_ON)
  const r = await s.handleItemsDelete(req({ item_ids: [DOC, DOC, DOC2], owner_id: 'attacker' }))
  assert.equal(r.status, 200)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://researcher.test/api/v1/connectors/gdrive/items')
  assert.equal(calls[0].init.method, 'DELETE')
  assert.deepEqual(calls[0].body, { owner_id: 'cuid_session_user', item_ids: [DOC, DOC2] })
  const hdrs = calls[0].init.headers
  assert.equal(hdrs['X-API-Key'], 'test-key'); assert.equal(hdrs['Content-Type'], 'application/json')
  const tokName = Object.keys(hdrs).find(k => k !== 'Content-Type' && k !== 'X-API-Key')
  const parts = tokenParts(hdrs[tokName])
  assert.ok(parts.includes('lib:cuid_session_user') && parts.includes('cuid_session_user'), 'sid = lib:<owner>, uid = owner')
  assert.deepEqual(plain(r.body), { removed: [DOC], rejected: [{ id: DOC2, error: 'not_found' }], content_erased: false })
})
await t('on: unauthenticated => 401, no fetch; no identity secret => 503, no fetch', async () => {
  assert.equal((await load(SERVER, stubsFor(null), ENV_ON).handleItemsDelete(req({ item_ids: [DOC] }))).status, 401)
  assert.equal((await load(SERVER, stubsFor(), { ...ENV_ON, RESEARCHER_SESSION_TOKEN_SECRET: '' }).handleItemsDelete(req({ item_ids: [DOC] }))).status, 503)
  assert.equal(calls.length, 0)
})
await t('on: bad input => 400, no fetch (null body, missing, empty, non-array, bad ids, 26 ids)', async () => {
  const s = load(SERVER, stubsFor(), ENV_ON)
  for (const b of [null, {}, { item_ids: [] }, { item_ids: DOC }, { item_ids: ['../x'] }, { item_ids: ['a b'] }, { item_ids: [123] }, { item_ids: ['a'.repeat(129)] }, { item_ids: Array.from({ length: 26 }, (_, i) => `id${i}`) }])
    assert.equal((await s.handleItemsDelete(req(b))).status, 400)
  assert.equal(calls.length, 0)
})

// 3. Researcher errors are never a success: 503 erase unavailable, flag off upstream (404), 422, owner mismatch, thrown fetch
await t('upstream 503 CONNECTOR_ERASE_UNAVAILABLE => 502 + error_code, "nothing was changed", no detail leak', async () => {
  reply = () => ({ ok: false, status: 503, json: async () => ({ detail: 'CONNECTOR_ERASE_UNAVAILABLE' }) })
  const r = await load(SERVER, stubsFor(), ENV_ON).handleItemsDelete(req({ item_ids: [DOC] }))
  assert.equal(r.status, 502); assert.equal(r.body.error_code, 'CONNECTOR_ERASE_UNAVAILABLE'); assert.match(r.body.error, /Nothing was changed/)
  assert.ok(!('removed' in r.body))
})
await t('upstream 422 / 403 with an allow-listed error_code keep their status; an unlisted 404 is a 502 (hardening, REVIEW-1 #4)', async () => {
  const s = load(SERVER, stubsFor(), ENV_ON)
  for (const [status, detail, code, want] of [[404, 'Not Found', null, 502], [422, 'CONNECTOR_ITEM_ID_INVALID', 'CONNECTOR_ITEM_ID_INVALID', 422], [403, 'CONNECTOR_OWNER_MISMATCH', 'CONNECTOR_OWNER_MISMATCH', 403], [500, 'Traceback...', null, 502]]) {
    reply = () => ({ ok: false, status, json: async () => ({ detail }) })
    const r = await s.handleItemsDelete(req({ item_ids: [DOC] }))
    assert.equal(r.status, want); assert.equal(r.body.error_code, code); assert.equal(r.headers.get('cache-control'), 'no-store')
    assert.ok(!JSON.stringify(plain(r.body)).includes('Traceback'))
  }
})
await t('thrown fetch => 502 plain words; a 200 with an empty body relays no removal', async () => {
  reply = () => { throw new Error('boom: secret') }
  const s = load(SERVER, stubsFor(), ENV_ON)
  const r = await s.handleItemsDelete(req({ item_ids: [DOC] }))
  assert.equal(r.status, 502); assert.ok(!JSON.stringify(plain(r.body)).includes('secret'))
  reply = () => ({ ok: true, status: 200, json: async () => { throw new Error('not json') } })
  assert.deepEqual(plain((await s.handleItemsDelete(req({ item_ids: [DOC] }))).body), { removed: [], rejected: [], content_erased: false })
})

// 4. client helpers (client-safe lib)
await t('validateRemoveItemIds: 1..25 safe ids, deduped; anything else null', async () => {
  assert.deepEqual(plain(rm.validateRemoveItemIds([DOC, DOC, 'a_b-C'])), [DOC, 'a_b-C'])
  for (const bad of [undefined, null, [], 'x', [''], ['a/b'], ['../x'], [1], ['a'.repeat(129)], Array.from({ length: 26 }, (_, i) => `i${i}`)]) assert.equal(rm.validateRemoveItemIds(bad), null)
  assert.equal(rm.validateRemoveItemIds(Array.from({ length: 25 }, (_, i) => `i${i}`)).length, 25)
})
await t('classifyRemoveResponse: success only when this id was removed AND content erased; everything else says what state it is in', async () => {
  const c = rm.classifyRemoveResponse
  const ok = c(DOC, 200, { removed: [DOC], rejected: [], content_erased: true })
  assert.deepEqual(plain(ok), { kind: 'removed', refresh: true, message: 'Removed. Content and index were deleted. Your Drive file is unchanged.' })
  // not a success, whatever the status line says
  for (const body of [{}, null, undefined, 'x', { removed: [], rejected: [], content_erased: false }, { removed: [DOC], rejected: [], content_erased: false }, { removed: [DOC2], rejected: [], content_erased: true }, { removed: [DOC], rejected: [{ id: DOC2, error: 'erase_incomplete' }], content_erased: false }]) {
    const r = c(DOC, 200, body); assert.equal(r.kind, 'failed'); assert.ok(!/Removed\./.test(r.message))
  }
  const inc = c(DOC, 200, { removed: [], rejected: [{ id: DOC, error: 'erase_incomplete' }], content_erased: false })
  assert.deepEqual(plain(inc), { kind: 'failed', refresh: true, message: "Couldn't finish removing it, so it is still in your library. Please try again." })
  const gone = c(DOC, 200, { removed: [], rejected: [{ id: DOC, error: 'not_found' }], content_erased: false })
  assert.deepEqual(plain(gone), { kind: 'not_found', refresh: true, message: 'That file is no longer in your library.' })
  const unavailable = c(DOC, 502, { error: 'x', error_code: 'CONNECTOR_ERASE_UNAVAILABLE' })
  assert.deepEqual(plain(unavailable), { kind: 'failed', refresh: false, message: "Couldn't remove it: removal isn't available right now, so nothing was changed. Please try again later." })
  for (const [status, body] of [[502, { error_code: null }], [404, {}], [400, {}], [401, {}], [503, null]]) {
    const r = c(DOC, status, body)
    assert.deepEqual(plain(r), { kind: 'failed', refresh: false, message: "Couldn't remove it. Nothing was changed. Please try again." })
  }
})
await t('removeDriveItem: DELETE /api/connectors/gdrive/items {item_ids:[id]} then classify; a network failure is "nothing changed"', async () => {
  reply = () => ({ ok: true, status: 200, json: async () => ({ removed: [DOC], rejected: [], content_erased: true }) })
  const ok = await rm.removeDriveItem(DOC)
  assert.equal(ok.kind, 'removed'); assert.equal(calls[0].url, '/api/connectors/gdrive/items'); assert.equal(calls[0].init.method, 'DELETE')
  assert.deepEqual(calls[0].body, { item_ids: [DOC] }); assert.equal(calls[0].init.headers['Content-Type'], 'application/json')
  reply = () => ({ ok: false, status: 502, json: async () => ({ error: 'x', error_code: 'CONNECTOR_ERASE_UNAVAILABLE' }) })
  assert.equal((await rm.removeDriveItem(DOC)).kind, 'failed')
  reply = () => ({ ok: true, status: 200, json: async () => { throw new Error('bad json') } })
  assert.equal((await rm.removeDriveItem(DOC)).kind, 'failed')
  reply = () => { throw new Error('offline') }
  assert.deepEqual(plain(await rm.removeDriveItem(DOC)), { kind: 'failed', refresh: false, message: "Couldn't remove it. Nothing was changed. Please try again." })
})

// 5. UI: D6b copy, the row button, the page (flag off = notFound, nothing rendered)
await t('D6b copy: the three bullets + warning render; title names the file', async () => {
  const ui = load('components/settings/gdrive-remove-item.tsx', {}, {})
  const html = renderToStaticMarkup(React.createElement(ui.DriveRemoveCopy))
  for (const line of ['Deckster deletes its copy of the text and its search index (vectors).', 'It is unlinked from the chats that use it. Existing slides keep their text, but the citation stops resolving.', '<strong>Your file in Google Drive is not touched.</strong>', 'This cannot be undone. To use it again, re-add it from Drive.']) assert.ok(html.includes(line), line)
  assert.equal(rm.removeDialogTitle('Q3 plan'), 'Remove "Q3 plan" from your library?'); assert.equal(rm.removeDialogTitle(null), 'Remove "Untitled" from your library?')
  assert.equal(rm.REMOVE_CONFIRM_LABEL, 'Remove permanently')
})
await t('D6a row button: labelled per file, disabled when busy, dialog closed (no confirm text until clicked)', async () => {
  const ui = load('components/settings/gdrive-remove-item.tsx', {}, {})
  const on = renderToStaticMarkup(React.createElement(ui.DriveRemoveButton, { title: 'Q3 plan', onConfirm: async () => {} }))
  assert.ok(on.includes('Remove from library') && on.includes('aria-label="Remove Q3 plan from library"') && on.includes('data-connectors-gdrive-role="remove"'))
  assert.ok(!on.includes('disabled=""') && !on.includes('Remove permanently') && !on.includes('cannot be undone'))
  assert.ok(renderToStaticMarkup(React.createElement(ui.DriveRemoveButton, { title: null, disabled: true, onConfirm: async () => {} })).includes('disabled=""'))
})
const pageStubs = (nf, driveState) => {
  let first = true // GoogleDriveCard's first useState is the Drive state: seed it (effects do not run in a static render)
  return {
    'next/navigation': { notFound: () => { nf.n++; throw new Error('NEXT_NOT_FOUND') } },
    react: { ...React, useState: (init) => (first && driveState ? (first = false, [driveState, () => {}]) : (first = false, React.useState(init))) },
  }
}
await t('page: flag off => notFound before anything renders (no card, no remove button)', async () => {
  const nf = { n: 0 }
  const page = load('app/(app)/settings/connectors/page.tsx', pageStubs(nf), {})
  assert.throws(() => renderToStaticMarkup(React.createElement(page.default)), /NEXT_NOT_FOUND/); assert.equal(nf.n, 1)
  assert.equal(calls.length, 0)
})
await t('page: flag on => every listed file with an id gets a Remove from library button (also when disconnected); none without an id', async () => {
  const nf = { n: 0 }
  const items = [{ id: DOC, title: 'Q3 plan', status: 'ready' }, { id: DOC2, title: null, status: 'disconnected' }, { title: 'No id yet', status: 'queued' }]
  const html = renderToStaticMarkup(React.createElement(load('app/(app)/settings/connectors/page.tsx', pageStubs(nf, { connected: false, items }), ENV_ON).default))
  assert.equal(nf.n, 0)
  assert.equal(html.split('data-connectors-gdrive-role="remove"').length - 1, 2)
  assert.ok(html.includes('aria-label="Remove Q3 plan from library"') && html.includes('aria-label="Remove Untitled from library"'))
  const none = renderToStaticMarkup(React.createElement(load('app/(app)/settings/connectors/page.tsx', pageStubs({ n: 0 }, { connected: true, items: [] }), ENV_ON).default))
  assert.ok(none.includes('data-connectors-gdrive="true"') && !none.includes('Remove from library'))
})

await t('page (hardening, REVIEW-1 #6): an item links only to https drive.google.com / docs.google.com (the citation badge\'s rule); anything else is plain text', async () => {
  const items = [
    { id: 'i_drive_01', title: 'Drive file', url: 'https://drive.google.com/file/d/1AbC/view' }, { id: 'i_docs_002', title: 'Docs file', url: 'https://docs.google.com/document/d/1AbC/edit' },
    { id: 'i_sites_03', title: 'Sites page', url: 'https://sites.google.com/view/evil' }, { id: 'i_redir_04', title: 'Redirector', url: 'https://www.google.com/url?q=https://evil.example/' },
    { id: 'i_js_00005', title: 'Script', url: 'javascript:alert(1)' }, { id: 'i_http_006', title: 'Plain http', url: 'http://drive.google.com/file/d/1/view' }, { id: 'i_none_007', title: 'No url' },
  ]
  const html = renderToStaticMarkup(React.createElement(load('app/(app)/settings/connectors/page.tsx', pageStubs({ n: 0 }, { connected: true, items }), ENV_ON).default))
  const links = [...html.matchAll(/<a href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map(m => [m[1], m[2]]).filter(([, text]) => !/Connect/.test(text))
  assert.deepEqual(links, [['https://drive.google.com/file/d/1AbC/view', 'Drive file'], ['https://docs.google.com/document/d/1AbC/edit', 'Docs file']])
  for (const title of ['Sites page', 'Redirector', 'Script', 'Plain http', 'No url']) assert.match(html, new RegExp(`<span class="font-medium">${title}</span>`), title)
  assert.ok(!/sites\.google|www\.google\.com\/url|javascript:/.test(html))
})

// 6. flag-off identity: every edit to an older file is additive (only the lines named here are replaced), so with the Drive flag off nothing
//    older changes; the new code is reachable only through the Drive-flag-gated page and the handler's own gate (section 1).
await t('older files: this change only ADDS lines, except the named replaced lines (vs the base)', async () => {
  const base = process.env.ITEM_REMOVE_BASE || '0578e0a1c6e3e77fe8b9c88534c2c30d2280175c' // the merge base: #608's head refreshed onto studio-v4-dev-preparation-code 2f06e51e (before the refresh: f4192aa0, the pre-C merge; piece C alone was measured vs 1baf289d)
  const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 })
  git('cat-file', '-e', `${base}^{commit}`)
  // composer A + badge B sit between that base and piece C here: only their own edits, read from history (#608 1baf289d -> the pre-C merge f4192aa0), are allowed besides this change's
  const AB = ['1baf289da2aca08b83a996ac0c4dd3b30aea315a', 'f4192aa0']
  // the hardening follow-up sits on #615's head 815ea9cf (its merge base): its own edits, read as 815ea9cf -> the working tree, are allowed besides these
  const HARDENING_BASE = process.env.CONNECTORS_HARDENING_BASE || '815ea9cf7bcc8605450ef817b905864299900a5d'
  git('cat-file', '-e', `${HARDENING_BASE}^{commit}`)
  const removedLines = (range, f) => git('diff', '--unified=0', ...range, '--', f).split('\n').filter(l => l.startsWith('-') && !l.startsWith('---')).map(l => l.slice(1))
  const REPLACED = {
    'app/api/connectors/gdrive/items/route.ts': ["import { handleItemsGet, handleItemsPost } from '@/lib/connectors-gdrive-server'"],
    'docs/CONNECTORS_E2E_STATUS.md': ['| 11s | Studio proxy + UI for remove-one-item | MISSING (follow-up once 11 lands) | — | — |'],
  }
  const older = ['app/(app)/settings/connectors/page.tsx', 'app/api/connectors/gdrive/items/route.ts', 'lib/connectors-gdrive-server.ts', 'lib/connectors-gdrive.ts', 'package.json', 'docs/CONNECTORS_E2E_STATUS.md', 'scripts/studio-later-changes.mjs']
  for (const f of older) {
    // the hardening's removed lines count only where the base had them (a line composer A added and the hardening rewrote was never the base's)
    const baseLines = new Set(git('show', `${base}:${f}`).split('\n'))
    const hardeningRemoved = removedLines([HARDENING_BASE], f).filter(l => baseLines.has(l))
    assert.deepEqual(removedLines([base], f).sort(), [...removedLines(AB, f), ...hardeningRemoved, ...(REPLACED[f] ?? [])].sort(), f)
  }
  // and nothing else older moved: the whole diff vs base is this change's files only
  const touched = git('diff', '--name-only', base).split('\n').filter(Boolean)
  const registry = await import('./studio-connectors-item-remove-strip.mjs')
  const own = new Set([...registry.CONNECTORS_ITEM_REMOVE_SCOPE_FILES, 'lib/connectors-gdrive-remove.ts'])
  const abTouched = new Set([...git('diff', '--name-only', ...AB).split('\n'), ...git('diff', '--name-only', HARDENING_BASE).split('\n')].filter(Boolean))
  for (const f of touched) assert.ok(own.has(f) || abTouched.has(f), `stray file in the diff: ${f}`)
})

console.log(`\n${passed} passed`)
