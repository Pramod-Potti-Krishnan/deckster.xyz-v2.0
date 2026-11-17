// KNOWLEDGE-3 for FRONTEND-1: proof of the Google Drive card's reasons. Flag NEXT_PUBLIC_STUDIO_CONNECTORS_CARD_REASONS, the exact string "true", default off.
// It changes the Google Drive card on Settings > Connectors (app/(app)/settings/connectors/page.tsx) and nothing else: (1) the card shows ONE fixed sentence for how the Google sign-in ended, from the callback's ?gdrive= word (cancelled, invalid, failed, connected; any other value shows nothing), read once on mount,
// taken off the address bar, and gone once the person acts; (2) a failed list call keeps its words and gains small print: "code: <error_code>" (an error_code that starts with CONNECTOR_) or "service error <status>". Never a token, an id or an e-mail. Off, the card is dev's card.
//
//   node scripts/test-studio-gdrive-card-reasons.mjs        (plain node, offline: the REAL sources transpiled and run in a vm; the REAL page runs in the offline React host (scripts/studio-chat-harness/mini-react.mjs: the real hooks, effects in React's order) over a fake window and a fake fetch;
//                                                           react-dom/server for the markup; git is read for the strip, the registry and the scope; no network, no browser, no .next)
//
// What it proves (A to H), then mutants (I):
//  A. the lib: the flag is on for the exact string "true" and for nothing else, one literal env read; the four words give their exact sentences (word for word) and any other value gives nothing; the word reader; the small-print rule (a CONNECTOR_ code, else the status; never a token, an id or an e-mail);
//  B. flag off: the page is dev's page, step for step (the same markup, the same requests, the same address-bar calls) over a run of scenarios (the four words and others in the address, a good list, a failed list of every kind, the person acting); the sha256 of both runs is printed and equal;
//  B2. flag on, by the real page: each of the four words shows its exact sentence once; an unknown value, a different case and no word show nothing; the word is read once (one read of the address, over many renders), taken off the address bar (the other parameters and the hash stay), and the line is gone once the person acts and does not come back
//      (also with an address bar that cannot be changed, and with Strict Mode's second run of the effects); a failed list call keeps its words and gains its small print under them (a code, else the status), cleared by the next good answer and by the person acting, never under another message; never a token, an id or an e-mail;
//  C. only insertions: no base line of the page is rewritten (the strip gives dev's page byte for byte; fifteen pure insertions, each carrying the marker CARD-REASONS), every line that touches the new state is behind the flag;
//  D. nothing else changed: the composer, its lib and marker rule, the connector routes, the server lib and the other Drive files are dev's, byte for byte;
//  E. .env.example: one block at the end, the flag "false", dev's file plus that block, the words the lib has;
//  F. the registry: exactly three lines, each marked LATER-CHANGE, at the true end; the strips commute;
//  C2. the older proofs: two get one splice line each (they read the first-parent line of BASE..HEAD, which carries this change's commit); the others are dev's;
//  G. own-commit scope, by the subject prefix "Card reasons:", the commit message, and a secret scan;
//  H. the flag is read from one literal env name, and only the lib reads it.
//  I. mutants: each is one edit of the real sources, fed to the same checks, and must be caught.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import * as stripModule from './studio-gdrive-card-reasons-strip.mjs'
import * as researchDefaultStrip from './studio-research-default-strip.mjs'
import * as registry from './studio-later-changes.mjs'
import { Root, hostNodes, textOf, toElements } from './studio-chat-harness/mini-react.mjs'

const { BASE_COMMIT, CARD_REASONS_PIN_FILES: PIN_FILES, CARD_REASONS_PIN_MARK: PIN_MARK, CARD_REASONS_PIN_EDITS: PIN_EDITS, CARD_REASONS_SCOPE_FILES: SCOPE, CARD_REASONS_NEW_FILES: NEW_FILES, CARD_REASONS_FILES: APP_FILES, CARD_REASONS_MARKER_RE: MARKER_RE, CARD_REASONS_FLAGS: FLAGS, CARD_REASONS_SUBJECT: SUBJECT, CARD_REASONS_EDITS: EDITS, CARD_REASONS_ENV_BLOCK: ENV_BLOCK } = stripModule
const STRIP_FN = stripModule.stripCardReasons
const [FLAG] = FLAGS
const DRIVE_FLAG = 'NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED'

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const nodeRequire = createRequire(path.join(root, 'package.json'))
const React = nodeRequire('react')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
const baseCache = new Map()
const baseText = rel => { if (!baseCache.has(rel)) baseCache.set(rel, git('show', `${BASE_COMMIT}:${rel}`)); return baseCache.get(rel) }

let passed = 0
const failed = []
async function check(label, fn) {
  if (process.env.CHECK_ONLY && !label.includes(process.env.CHECK_ONLY)) return
  try { await fn(); passed++; console.log(`PASS ${label}`) } catch (error) { failed.push(label); console.error(`FAIL ${label}: ${String(error?.message ?? error).split('\n').slice(0, 14).join(' | ').slice(0, 700)}`) }
}
let caught = 0
const missed = []
class SwapError extends Error {}
async function mutant(label, run) {
  if (process.env.CHECK_ONLY) return
  try { await run(); missed.push(label); console.error(`MISSED mutant ${label}`) } catch (error) {
    if (error instanceof SwapError || error?.code !== 'ERR_ASSERTION') { missed.push(label); console.error(`MISSED mutant ${label}: it did not fail an assertion (${String(error?.message ?? error).slice(0, 160)})`) } else { caught++; console.log(`CAUGHT mutant ${label}${process.env.SHOW_CAUGHT ? ` :: ${String(error.message).split('\n')[0].slice(0, 140)}` : ''}`) }
  }
}
const swap = (text, from, to) => { if (text.split(from).length !== 2) throw new SwapError(`exactly one ${JSON.stringify(from.slice(0, 80))} (found ${text.split(from).length - 1})`); return text.replace(from, () => to) }

const LIB = 'lib/studio-connectors-card-reasons.ts', PAGE = 'app/(app)/settings/connectors/page.tsx', REGISTRY = 'scripts/studio-later-changes.mjs', ENV = '.env.example', COMPOSER_LIB = 'lib/connectors-gdrive-composer.ts', GDRIVE_LIB = 'lib/connectors-gdrive.ts'
const compile = (file, text) => ts.transpileModule(text, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
const compiled = new Map()
const jsOf = (rel, text) => { const key = `${rel}\0${text}`; if (!compiled.has(key)) compiled.set(key, compile(rel, text)); return compiled.get(key) }
/** The repo's own TypeScript modules in a vm: `@/x` is the repo (or the text given for it), node packages come from node_modules. `stubs` answer by specifier, `fileStubs` by repo path without extension. */
function loaderFor({ env = {}, texts = {}, stubs = {}, fileStubs = {}, win, fetchFn }) {
  const cache = new Map()
  const run = rel => {
    if (cache.has(rel)) return cache.get(rel).exports
    const mod = { exports: {} }; cache.set(rel, mod)
    const req = spec => {
      if (Object.hasOwn(stubs, spec)) return stubs[spec]
      if (spec.startsWith('@/')) {
        const base = spec.slice(2)
        if (Object.hasOwn(fileStubs, base)) return fileStubs[base]
        for (const ext of ['.ts', '.tsx']) if (fs.existsSync(path.join(root, base + ext))) return run(base + ext)
        throw new Error(`cannot resolve ${spec}`)
      }
      return nodeRequire(spec)
    }
    vm.runInNewContext(jsOf(rel, texts[rel] ?? read(rel)), { require: req, module: mod, exports: mod.exports, process: { env: { ...env } }, console, URL, URLSearchParams, Promise, window: win, fetch: fetchFn }, { filename: rel })
    return mod.exports
  }
  return run
}
const loadLib = (rel, { env = {}, texts = {} } = {}) => loaderFor({ env, texts })(rel)
const lineWith = (text, needle) => { const hits = text.split('\n').filter(line => line.includes(needle)); assert.equal(hits.length, 1, `exactly one line holds ${JSON.stringify(needle)} (found ${hits.length})`); return hits[0] }
function lineDiff(was, now) {
  const count = new Map(); for (const line of was.split('\n')) count.set(line, (count.get(line) || 0) + 1)
  const added = []; for (const line of now.split('\n')) { const n = count.get(line) || 0; if (n > 0) count.set(line, n - 1); else added.push(line) }
  const removed = []; for (const [line, n] of count) for (let i = 0; i < n; i++) removed.push(line)
  return { added, removed }
}
const SECRET = /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|xox[bp]-)/
const count = (text, needle) => text.split(needle).length - 1

/** The four words and their sentences, as FRONTEND-1 gave them (independent of the lib's text). */
const LINES = {
  cancelled: 'Google sign-in was cancelled or not approved.',
  invalid: 'The Google sign-in took too long or finished in another browser. Please try again here.',
  failed: 'Google said yes, but Deckster could not save the connection. This is our fault; please try again later.',
  connected: 'Google Drive is connected.',
}
const WORDS = Object.keys(LINES)
const ROUTE_WORDS = 'Could not load your Drive files. Please try again.' // what the list route says (lib/connectors-gdrive-server.ts handleItemsGet), and so what the card shows today
const UNKNOWN_WORDS = ['', 'Connected', 'CONNECTED', 'Cancelled', 'FAILED', ' connected', 'connected ', 'success', 'ok', 'true', '1', 'error', 'denied', '__proto__', 'constructor', 'toString', 'hasOwnProperty', 'connected,failed', '<script>alert(1)</script>', 'connected%20']
/** Values a token, an id or an e-mail could ride in: none may ever reach the markup. */
const HOSTILE = ['ACCESS-TOKEN-0f3a9c-secret', 'REFRESH-TOKEN-7b21d4-secret', 'person@example.com', 'cuid_owner_9f8e7d', 'item_secret_0123456789', 'KEY-VALUE-5e8c1a-secret']

// ============================================================================================================================================
// A. the lib: the flag, the four sentences, the word reader, the small print
// ============================================================================================================================================
const LIB_EXPORTS = ['STUDIO_CONNECTORS_CARD_REASONS', 'gdriveFailureDetail', 'gdriveResultLine', 'takeGdriveResultWord']
function libChecks(texts = {}) {
  const text = texts[LIB] ?? read(LIB)
  const NOT_TRUE = [undefined, '', 'false', 'True', 'TRUE', '1', ' true', 'true ', 'yes', 'on']
  for (const value of NOT_TRUE) assert.equal(loadLib(LIB, { env: value === undefined ? {} : { [FLAG]: value }, texts }).STUDIO_CONNECTORS_CARD_REASONS, false, `${FLAG}=${JSON.stringify(value)}: off`)
  assert.equal(loadLib(LIB, { env: { [FLAG]: 'true' }, texts }).STUDIO_CONNECTORS_CARD_REASONS, true, `${FLAG}: exactly "true" is on`)
  assert.equal(loadLib(LIB, { env: { [DRIVE_FLAG]: 'true' }, texts }).STUDIO_CONNECTORS_CARD_REASONS, false, 'the Drive flag does not turn it on')
  assert.equal(count(text, `process.env.${FLAG}`), 1, `the literal env name ${FLAG} is read once (so Next inlines it)`)
  assert.equal(count(text, 'process.env'), 1, 'one env read in all')
  assert.match(text, new RegExp(`^export const STUDIO_CONNECTORS_CARD_REASONS = process\\.env\\.${FLAG} === 'true'$`, 'm'), 'the same pattern as lib/studio-research-default.ts: a top-level constant, the exact string "true"')
  assert.deepEqual(Object.keys(loadLib(LIB, { env: { [FLAG]: 'true' }, texts })).sort(), LIB_EXPORTS, 'the lib exports the flag and three helpers')
  assert.deepEqual([...text.matchAll(/^\s*(import|require)\b.*$/gm)].map(m => m[0]), [], 'the lib imports nothing')
  const lib = loadLib(LIB, { env: {}, texts }) // run with NO env: the helpers decide from their arguments alone
  // the four sentences, word for word
  for (const [word, sentence] of Object.entries(LINES)) assert.equal(lib.gdriveResultLine(word), sentence, `${word}: its sentence, word for word`)
  assert.equal(new Set(WORDS.map(word => lib.gdriveResultLine(word))).size, 4, 'four different sentences')
  for (const word of UNKNOWN_WORDS) assert.equal(lib.gdriveResultLine(word), null, `${JSON.stringify(word)}: nothing`)
  for (const value of [null, undefined, 0, 1, true, false, {}, [], ['connected'], { toString: () => 'connected' }, Symbol.iterator]) assert.equal(lib.gdriveResultLine(value), null, `a value that is not the word's string: nothing (${String(typeof value)})`)
  // the word reader
  const take = search => JSON.parse(JSON.stringify(lib.takeGdriveResultWord(search))) // out of the vm's realm
  assert.deepEqual(take(''), { word: null, found: false, search: '' }, 'no query')
  assert.deepEqual(take('?gdrive=connected'), { word: 'connected', found: true, search: '' }, 'the word comes out, nothing is left')
  assert.deepEqual(take('?foo=1&gdrive=failed&bar=2'), { word: 'failed', found: true, search: '?foo=1&bar=2' }, 'the other parameters stay, in order')
  assert.deepEqual(take('?gdrive='), { word: '', found: true, search: '' }, 'an empty word is found (and taken off), and is not a word')
  assert.deepEqual(take('?gdrive=cancelled&gdrive=connected'), { word: 'cancelled', found: true, search: '' }, 'the first word counts; every gdrive parameter comes off')
  assert.deepEqual(take('?GDRIVE=connected'), { word: null, found: false, search: '?GDRIVE=connected' }, 'another case is not the parameter')
  assert.deepEqual(take('?gdrive_marker=abc&gdrive=invalid'), { word: 'invalid', found: true, search: '?gdrive_marker=abc' }, 'the composer\'s marker parameter is not this change\'s to take')
  assert.deepEqual(take('gdrive=invalid'), { word: 'invalid', found: true, search: '' }, 'a query without its ? reads the same')
  assert.deepEqual(take('?session_id=abc'), { word: null, found: false, search: '?session_id=abc' }, 'a query without the word comes back as it is')
  // the small print
  const detail = (status, body) => lib.gdriveFailureDetail(status, body)
  for (const code of codesOfRoute()) assert.equal(detail(502, { error_code: code }), `code: ${code}`, `every code the route relays is shown as a code: ${code}`)
  assert.equal(detail(502, { error: ROUTE_WORDS, error_code: 'CONNECTOR_UPSTREAM_ERROR' }), 'code: CONNECTOR_UPSTREAM_ERROR', 'a CONNECTOR_ code')
  assert.equal(detail(401, { error_code: 'CONNECTOR_IDENTITY_INVALID' }), 'code: CONNECTOR_IDENTITY_INVALID', 'a relayed 4xx keeps its code')
  assert.equal(detail(502, { error: ROUTE_WORDS, error_code: null }), 'service error 502', 'a null code: the status')
  assert.equal(detail(504, { error: ROUTE_WORDS }), 'service error 504', 'no code: the status')
  assert.equal(detail(401, {}), 'service error 401', 'an empty answer: the status')
  for (const status of [400, 401, 403, 404, 429, 500, 502, 503, 504]) assert.equal(detail(status, undefined), `service error ${status}`, `service error ${status}`)
  for (const body of [null, undefined, 'text', 5, [], ['CONNECTOR_X'], { error_code: undefined }, { error_code: 5 }, { error_code: {} }, { error_code: ['CONNECTOR_NOT_CONNECTED'] }]) assert.equal(detail(502, body), 'service error 502', `a body without a usable code: the status (${JSON.stringify(body)})`)
  // a code that does not start with CONNECTOR_, or that is not shaped like the codes the route relays, is never printed: the status instead
  for (const code of ['OTHER_THING', 'connector_not_connected', 'CONNECTOR', 'CONNECTOR_', 'XCONNECTOR_A', ' CONNECTOR_A', 'CONNECTOR_A ', 'CONNECTOR_a', 'CONNECTOR_NOT-CONNECTED', 'CONNECTOR_A B', 'CONNECTOR_person@example.com', 'CONNECTOR_ACCESS.TOKEN', 'CONNECTOR_A\nB', 'CONNECTOR_' + 'A'.repeat(65), ...HOSTILE]) assert.equal(detail(502, { error_code: code }), 'service error 502', `${JSON.stringify(code)} is not printed`)
  assert.equal(detail(502, { error_code: 'CONNECTOR_' + 'A'.repeat(64) }), `code: CONNECTOR_${'A'.repeat(64)}`, 'the longest shape the lib allows')
  assert.equal(detail(Number.NaN, { error_code: 'CONNECTOR_NOT_CONNECTED' }), 'code: CONNECTOR_NOT_CONNECTED', 'a code needs no status')
  for (const status of [0, 99, 600, 1.5, 502.5, Number.NaN, '502', null, undefined, {}, -1, Infinity]) assert.equal(detail(status, {}), null, `no HTTP status, no code: nothing to say (${JSON.stringify(status)})`)
  // never a token, an id or an e-mail, whatever the answer carries
  const hostile = { error: ROUTE_WORDS, access_token: HOSTILE[0], refresh_token: HOSTILE[1], email: HOSTILE[2], owner_id: HOSTILE[3], item_id: HOSTILE[4], key: HOSTILE[5], detail: HOSTILE.join(' '), account_label: HOSTILE[2] }
  assert.equal(detail(502, hostile), 'service error 502')
  assert.equal(detail(502, { ...hostile, error_code: 'CONNECTOR_UPSTREAM_ERROR' }), 'code: CONNECTOR_UPSTREAM_ERROR')
  for (const secret of HOSTILE) for (const out of [detail(502, hostile), detail(502, { ...hostile, error_code: 'CONNECTOR_UPSTREAM_ERROR' }), detail(500, { error_code: secret })]) assert.ok(!String(out).includes(secret), `${secret} is never printed`)
  // the four words are the composer's four (the composer's own reader accepts these and no other)
  const composer = loaderFor({})(COMPOSER_LIB)
  for (const word of WORDS) assert.equal(composer.takeGdriveReturn(`?gdrive=${word}`).status, word, `${word} is one of the composer's words`)
  for (const word of UNKNOWN_WORDS.filter(w => w !== '')) assert.equal(composer.takeGdriveReturn(`?gdrive=${encodeURIComponent(word)}`).status, null, `${JSON.stringify(word)} is not one of the composer's words either`)
}
/** The codes the route relays (the allow-list in lib/connectors-gdrive.ts). */
function codesOfRoute() { const codes = loaderFor({})(GDRIVE_LIB).CONNECTOR_ERROR_CODES; assert.ok(codes.length >= 14, 'the allow-list is there'); return [...codes] }

// ============================================================================================================================================
// the page, run for real: the offline React host over a fake window and a fake fetch
// ============================================================================================================================================
const tick = () => new Promise(resolve => setImmediate(resolve))
/** One page view's world: the address bar (reads of the query are counted; the page may change it with replaceState, or be refused), every request, every toast. It outlives a reload: a new page view reads the address as the last one left it. */
function makeWorld({ search = '', hash = '', script, replaceThrows = false }) {
  let currentSearch = search
  const world = { script, fetches: [], replaced: [], toasts: [], searchReads: 0, pickerIds: [], peekSearch: () => currentSearch }
  const loc = { pathname: '/settings/connectors', hash }
  Object.defineProperty(loc, 'search', { get() { world.searchReads++; return currentSearch }, enumerable: true })
  world.loc = loc
  world.win = { location: loc, history: { replaceState(_state, _title, url) {
    world.replaced.push(url)
    if (replaceThrows) throw new Error('SecurityError: the address bar cannot be changed')
    const parts = /^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(String(url))
    loc.pathname = parts[1]; currentSearch = parts[2] || ''; loc.hash = parts[3] || ''
  } } }
  world.fetch = async (url, init = {}) => {
    world.fetches.push(`${init.method || 'GET'} ${url}`)
    const answer = await world.script(String(url), init)
    return { ok: answer.status >= 200 && answer.status < 300, status: answer.status, json: async () => { if (answer.json === undefined) throw new SyntaxError('the body is not JSON'); return answer.json } }
  }
  return world
}
const asAssertion = (what, error) => { if (error?.code === 'ERR_ASSERTION') return error; return new assert.AssertionError({ message: `${what} threw: ${String(error?.message ?? error).split('\n')[0]}` }) }
/** The page mounted in the offline host. `texts` carries a mutated source (or dev's page); `on` sets the card-reasons flag; `strict` replays the mount effects once (React's development Strict Mode: effects run, are cleaned up, and run again, before any answer). */
function mountPage(world, { on = true, texts = {}, strict = false } = {}) {
  const env = { [DRIVE_FLAG]: 'true', ...(on ? { [FLAG]: 'true' } : {}) }
  const stubs = {
    'next/navigation': { notFound: () => { throw new Error('NEXT_NOT_FOUND') } },
    '@/hooks/use-toast': { useToast: () => ({ toast: t => { world.toasts.push(t) } }) },
    '@/lib/gdrive-picker-loader': { openDrivePicker: async () => world.pickerIds },
  }
  const fileStubs = { 'components/settings/gdrive-remove-item': { DriveRemoveButton: ({ title, disabled, onConfirm }) => React.createElement('button', { 'data-stub-remove': 'true', disabled, onClick: () => onConfirm() }, `Remove ${title ?? 'Untitled'}`) } } // Radix's dialog needs real contexts; the button's own proof is test-studio-connectors-item-remove
  const host = new Root()
  const view = {
    world, host,
    html: () => renderToStaticMarkup(toElements(host.tree)),
    text: () => textOf(host.tree),
    nodes: pred => hostNodes(host.tree).filter(pred),
    results: () => hostNodes(host.tree).filter(node => node.props?.['data-connectors-gdrive-result'] === 'true').map(node => textOf(node)),
    details: () => hostNodes(host.tree).filter(node => node.props?.['data-connectors-gdrive-detail'] === 'true').map(node => textOf(node)),
    alerts: () => hostNodes(host.tree).filter(node => node.props?.role === 'alert').map(node => textOf(node)),
    async settle() { for (let i = 0; i < 4; i++) { await tick(); host.flush() } },
    /** A click on the button with this label, the way React runs it: the handler's first (synchronous) part, a render, then the rest. */
    async click(label) {
      const node = hostNodes(host.tree).find(n => typeof n.props?.onClick === 'function' && textOf(n) === label)
      assert.ok(node, `a "${label}" button is there`)
      const done = node.props.onClick(); host.flush(); await done; await view.settle()
    },
  }
  try {
    const page = loaderFor({ env, texts, stubs, fileStubs, win: world.win, fetchFn: world.fetch })(PAGE)
    host.setElement(React.createElement(page.default)); host.flush()
    if (strict) {
      for (const fiber of host.fibers.values()) for (const hook of fiber.hooks) if (hook.kind === 'effect') hook.ran = false // Strict Mode's second run of every mount effect
      host.schedule(); host.flush()
    }
  } catch (error) { throw asAssertion('the page', error) }
  return view
}
/** Runs `fn` over a mounted page, and turns anything the page throws into a failed assertion (a mutant that crashes is caught). */
async function over(world, options, fn) { const view = mountPage(world, options); try { await view.settle(); return await fn(view) } catch (error) { throw asAssertion('the page', error) } }

const ITEMS = [{ id: 'item_aaaaaaaaaa', title: 'Plan', status: 'ready', modified_time: '2026-11-01T10:00:00Z', url: 'https://drive.google.com/file/d/1AbC/view' }, { id: 'item_bbbbbbbbbb', title: null, status: 'queued' }]
const CONNECTED = { status: 200, json: { connected: true, account_label: 'Drive account', items: ITEMS } }
const DISCONNECTED = { status: 200, json: { connected: false, account_label: null, items: [] } }
const listFail = (status, extra = {}) => ({ status, json: { error: ROUTE_WORDS, ...extra } })
const NETWORK = { throws: true }
const NOT_JSON = { status: 502 } // a body that is not JSON
/** A fake service: the list answers come in turn (the last one repeats); the add, the disconnect and the remove answer as given. */
function scriptFor({ list = [CONNECTED], add = { status: 200, json: { items: [] } }, disconnect = { status: 200, json: { disconnected: true } }, remove = { status: 200, json: { removed: ['item_aaaaaaaaaa'], rejected: [], content_erased: true } } } = {}) {
  let n = 0
  return async (url, init = {}) => {
    const method = init.method || 'GET'
    if (url === '/api/connectors/gdrive/items' && method === 'GET') { const answer = list[Math.min(n++, list.length - 1)]; if (answer.throws) throw new TypeError('Failed to fetch'); return answer }
    if (url === '/api/connectors/gdrive/items' && method === 'POST') { if (add.throws) throw new TypeError('Failed to fetch'); return add }
    if (url === '/api/connectors/gdrive/items' && method === 'DELETE') return remove
    if (url === '/api/connectors/gdrive/disconnect' && method === 'POST') return disconnect
    throw new Error(`the fake service has no answer for ${method} ${url}`)
  }
}

// ============================================================================================================================================
// B. flag off: the page is dev's page, step for step
// ============================================================================================================================================
const DEV_PAGE = () => ({ [PAGE]: baseText(PAGE) })
/** One scenario: an address, the service's answers, and what the person does. Each step is recorded: the markup, every request so far, every address-bar call, the toasts. */
const SCENARIOS = [
  { name: 'a good list, no word', list: [CONNECTED, DISCONNECTED], steps: [['click', 'Disconnect']] },
  { name: 'not connected, no word', list: [DISCONNECTED], steps: [] },
  ...[...WORDS, 'bogus', 'Connected', ''].map(word => ({ name: `?gdrive=${word}, a good list`, search: `?gdrive=${encodeURIComponent(word)}`, list: [CONNECTED], steps: [['click', 'Disconnect']] })),
  { name: 'other parameters and a hash around the word', search: '?foo=1&gdrive=connected&bar=2', hash: '#top', list: [DISCONNECTED], steps: [] },
  { name: 'a failed reload: 502 with a code, then the person adds files and it fails, then a reload of the page', search: '?gdrive=failed', list: [CONNECTED, listFail(502, { error_code: 'CONNECTOR_UPSTREAM_ERROR' }), CONNECTED], add: { status: 502, json: { error: 'Could not add your Drive files. Please try again.' } }, pickerIds: ['file_aaaaaaaaaa'], steps: [['click', 'Disconnect'], ['click', 'Add files from Drive'], ['reload']] },
  { name: 'a failed list: 504 without a code', list: [listFail(504)], steps: [] },
  { name: 'a failed list: 401 without a code (Studio\'s own refusal)', list: [{ status: 401, json: { error: 'Not signed in' } }], steps: [] },
  { name: 'a failed list: 502 with an answer that is not JSON', list: [NOT_JSON], steps: [] },
  { name: 'a failed list: the request itself fails', list: [NETWORK], steps: [] },
  { name: 'a failed reload, then the person disconnects again and the list is good', list: [CONNECTED, listFail(503), CONNECTED], steps: [['click', 'Disconnect'], ['click', 'Disconnect']] },
  { name: 'a removal', list: [CONNECTED, CONNECTED], steps: [['click', 'Remove Plan']] },
  { name: 'strict mode', search: '?gdrive=connected', strict: true, list: [CONNECTED], steps: [] },
]
async function runScenario(scenario, { texts = {}, on = false } = {}) {
  const world = makeWorld({ search: scenario.search ?? '', hash: scenario.hash ?? '', script: scriptFor({ list: scenario.list, add: scenario.add }) })
  world.pickerIds = scenario.pickerIds ?? []
  const records = []
  const record = (step, view) => records.push({ step, html: view.html(), fetches: [...world.fetches], replaced: [...world.replaced], toasts: JSON.parse(JSON.stringify(world.toasts)), search: world.peekSearch() })
  let view = mountPage(world, { on, texts, strict: scenario.strict === true })
  try {
    await view.settle(); record('mounted', view)
    for (const [kind, label] of scenario.steps) {
      if (kind === 'reload') { view.host.unmount(); view = mountPage(world, { on, texts }); await view.settle(); record('reloaded', view) } else { await view.click(label); record(`${kind} ${label}`, view) }
    }
  } catch (error) { throw asAssertion(`the page in "${scenario.name}"`, error) }
  return records
}
/** Flag off, the page is dev's page: the same markup, the same requests, the same address-bar calls and toasts, at every step of every scenario. */
async function offChecks(texts = {}) {
  const hashDev = crypto.createHash('sha256'), hashNow = crypto.createHash('sha256')
  for (const scenario of SCENARIOS) {
    const dev = await runScenario(scenario, { texts: DEV_PAGE(), on: false })
    const now = await runScenario(scenario, { texts, on: false })
    assert.deepEqual(now, dev, `flag off, "${scenario.name}": the page is dev's, step for step`)
    assert.deepEqual(now.map(r => r.replaced).flat(), [], `flag off, "${scenario.name}": the address bar is never changed`)
    hashDev.update(JSON.stringify(dev)); hashNow.update(JSON.stringify(now))
  }
  const digest = hashNow.digest('hex')
  assert.equal(digest, hashDev.digest('hex'), 'flag off: the sha256 of the outputs is dev\'s')
  // the card says nothing new with the flag off, whatever the address says
  const world = makeWorld({ search: '?gdrive=failed', script: scriptFor({ list: [listFail(502, { error_code: 'CONNECTOR_UPSTREAM_ERROR' })] }) })
  await over(world, { on: false, texts }, view => {
    assert.deepEqual(view.results(), [], 'flag off: no sentence for the word'); assert.deepEqual(view.details(), [], 'flag off: no small print')
    assert.deepEqual(view.alerts(), [ROUTE_WORDS], 'flag off: the one alert is the route\'s own words, as today')
    assert.equal(world.searchReads, 0, 'flag off: the address is not even read')
  })
  return digest
}

// ============================================================================================================================================
// B2. flag on, by the real page
// ============================================================================================================================================
const RESULT_RE = /data-connectors-gdrive-result="true"/g
async function onChecks(texts = {}) {
  const ok = scriptFor({ list: [CONNECTED] })
  // each of the four words: its exact sentence, once; the word comes off the address bar; the rest of the address stays
  for (const word of WORDS) for (const strict of [false, true]) {
    const world = makeWorld({ search: `?gdrive=${word}`, script: ok })
    await over(world, { texts, strict }, view => {
      assert.deepEqual(view.results(), [LINES[word]], `${word}${strict ? ' (Strict Mode)' : ''}: ONE line, its exact sentence`)
      assert.equal(count(view.html(), 'data-connectors-gdrive-result="true"'), 1, `${word}: one result element in the markup`)
      for (const other of WORDS.filter(w => w !== word)) assert.ok(!view.html().includes(LINES[other]), `${word}: not the sentence of ${other}`)
      assert.ok(!view.html().includes(`>${word}<`) && !view.html().includes(`"${word}"`), `${word}: the raw word is not what is shown`)
      assert.deepEqual(world.replaced, ['/settings/connectors'], `${word}: the word comes off the address bar, once (Strict Mode's second run finds it gone)`)
      assert.equal(world.peekSearch(), '', `${word}: and nothing else was in it`)
      assert.equal(world.searchReads, strict ? 2 : 1, `${word}: the address is read once on mount (twice with Strict Mode's second run), however often the page renders`)
      assert.ok(view.html().includes('Connected as Drive account'), `${word}: the card is otherwise the card`)
    })
  }
  {
    const world = makeWorld({ search: '?foo=1&gdrive=failed&bar=2', hash: '#top', script: ok })
    await over(world, { texts }, view => {
      assert.deepEqual(view.results(), [LINES.failed]); assert.deepEqual(world.replaced, ['/settings/connectors?foo=1&bar=2#top'], 'the other parameters and the hash stay')
    })
  }
  // any other value, another case, an empty word, no word: nothing shown
  for (const word of UNKNOWN_WORDS) {
    const world = makeWorld({ search: `?gdrive=${encodeURIComponent(word)}`, script: ok })
    await over(world, { texts }, view => {
      assert.deepEqual(view.results(), [], `${JSON.stringify(word)}: nothing shown`)
      for (const sentence of Object.values(LINES)) assert.ok(!view.html().includes(sentence), `${JSON.stringify(word)}: none of the four sentences`)
      assert.ok(!view.html().includes('<script>'), `${JSON.stringify(word)}: nothing from the address reaches the markup`)
      assert.deepEqual(world.replaced, ['/settings/connectors'], `${JSON.stringify(word)}: taken off the address bar all the same (as the composer does)`)
    })
  }
  { // no word: nothing, and the address bar is left alone
    const world = makeWorld({ search: '?foo=1', script: ok })
    await over(world, { texts }, view => { assert.deepEqual(view.results(), []); assert.deepEqual(world.replaced, [], 'no word: no address-bar call'); assert.equal(world.searchReads, 1, 'and the address is read once') })
    const none = makeWorld({ script: ok }); await over(none, { texts }, view => { assert.deepEqual(view.results(), []); assert.deepEqual(none.replaced, []) })
  }
  // once: the line is gone when the person acts and does not come back; a reload (the address was cleaned) says nothing
  for (const [action, addFails] of [['Disconnect', false], ['Remove Plan', false], ['Add files from Drive', false], ['Add files from Drive', true]]) {
    const world = makeWorld({ search: '?gdrive=connected', script: scriptFor({ list: [CONNECTED, CONNECTED], add: addFails ? { status: 502, json: { error: 'Could not add your Drive files. Please try again.' } } : { status: 200, json: { items: [] } } }) })
    world.pickerIds = ['file_aaaaaaaaaa']
    await over(world, { texts }, async view => {
      assert.deepEqual(view.results(), [LINES.connected], `${action}: shown at first`)
      await view.click(action)
      assert.deepEqual(view.results(), [], `${action}${addFails ? ' (it fails)' : ''}: gone once the person acted, and it does not come back when the action ends`)
      rerender(view); await view.settle()
      assert.deepEqual(view.results(), [], `${action}: still gone after further renders`)
      assert.equal(world.searchReads, 1, `${action}: the address was read once`)
      assert.deepEqual(world.replaced, ['/settings/connectors'], `${action}: and changed once`)
      const again = mountPage(world, { texts }); await again.settle()
      assert.deepEqual(again.results(), [], `${action}: a reload says nothing (the word is off the address bar)`)
      assert.equal(world.replaced.length, 1, `${action}: the reload changes no address`)
    })
  }
  { // an address bar that cannot be changed: still once in this page view, no crash, and not again once the person acted
    const world = makeWorld({ search: '?gdrive=invalid', script: scriptFor({ list: [CONNECTED, CONNECTED] }), replaceThrows: true })
    await over(world, { texts }, async view => {
      assert.deepEqual(view.results(), [LINES.invalid], 'the line is shown although the address bar refuses')
      assert.deepEqual(world.replaced, ['/settings/connectors'], 'one attempt')
      await view.click('Disconnect'); rerender(view); await view.settle()
      assert.deepEqual(view.results(), [], 'gone once the person acted, and it does not come back (the word is still in the address)')
      assert.equal(world.searchReads, 1, 'the address was read once')
      assert.equal(world.replaced.length, 1, 'and no second attempt')
    })
  }
  // a failed list call: its own words, and small print under them
  const failures = [
    ['502 with a CONNECTOR_ code', listFail(502, { error_code: 'CONNECTOR_UPSTREAM_ERROR' }), ROUTE_WORDS, 'code: CONNECTOR_UPSTREAM_ERROR'],
    ['401 with a relayed code', listFail(401, { error_code: 'CONNECTOR_IDENTITY_INVALID' }), ROUTE_WORDS, 'code: CONNECTOR_IDENTITY_INVALID'],
    ['503 with the not-set-up words and no code', { status: 503, json: { error: 'Google Drive connection is not set up on this server yet.' } }, 'Google Drive connection is not set up on this server yet.', 'service error 503'],
    ['504 without a code', listFail(504), ROUTE_WORDS, 'service error 504'],
    ['502 with a null code', listFail(502, { error_code: null }), ROUTE_WORDS, 'service error 502'],
    ['401 (Studio\'s own refusal)', { status: 401, json: { error: 'Not signed in' } }, 'Not signed in', 'service error 401'],
    ['403 (Studio\'s own refusal)', { status: 403, json: { error: 'Not entitled' } }, 'Not entitled', 'service error 403'],
    ['404 (flag off on the server)', { status: 404, json: { error: 'Not found' } }, 'Not found', 'service error 404'],
    ['502 with a code that does not start with CONNECTOR_', listFail(502, { error_code: 'SOMETHING_ELSE' }), ROUTE_WORDS, 'service error 502'],
    ['502 with a CONNECTOR_ code that is an e-mail', listFail(502, { error_code: 'CONNECTOR_person@example.com' }), ROUTE_WORDS, 'service error 502'],
    ['502 with an answer that is not JSON', NOT_JSON, 'Could not load Google Drive.', 'service error 502'],
    ['500 with no error words at all', { status: 500, json: {} }, 'Could not load Google Drive.', 'service error 500'],
  ]
  for (const [name, answer, words, print] of failures) {
    const world = makeWorld({ script: scriptFor({ list: [{ ...answer, json: answer.json === undefined ? undefined : { ...answer.json, access_token: HOSTILE[0], refresh_token: HOSTILE[1], email: HOSTILE[2], owner_id: HOSTILE[3], item_id: HOSTILE[4], key: HOSTILE[5], account_label: HOSTILE[2] } }] }) })
    await over(world, { texts }, view => {
      assert.deepEqual(view.alerts(), [words], `${name}: the alert keeps today's words`)
      assert.deepEqual(view.details(), [print], `${name}: and gains its small print`)
      assert.ok(view.html().includes(`data-connectors-gdrive-detail="true">${print}</p>`), `${name}: a paragraph of small print`)
      assert.match(view.html(), /<p class="text-xs [^"]*" style="[^"]*" data-connectors-gdrive-detail="true">/, `${name}: in small print`)
      const alerts = hostNodes(view.host.tree).filter(n => n.props?.role === 'alert')
      assert.equal(alerts.length, 1, `${name}: one alert, the small print is not a second one`)
      for (const secret of HOSTILE) assert.ok(!view.html().includes(secret), `${name}: ${secret} is nowhere in the markup`)
      assert.deepEqual(world.toasts, [], `${name}: no toast`)
      assert.deepEqual(world.replaced, [], `${name}: no word, no address-bar call`)
    })
  }
  { // the request itself fails: no answer, so no status and no code: today's words, no small print
    const world = makeWorld({ script: scriptFor({ list: [NETWORK] }) })
    await over(world, { texts }, view => { assert.deepEqual(view.alerts(), ['Could not load Google Drive. Please try again.']); assert.deepEqual(view.details(), [], 'no answer, nothing to add') })
  }
  { // a good answer shows none
    const world = makeWorld({ script: ok }); await over(world, { texts }, view => { assert.deepEqual(view.details(), []); assert.deepEqual(view.alerts(), []) })
  }
  // the small print belongs to the list call's message: it goes when the person acts, is replaced by the next failure's, and never shows under another message. Each scenario is ONE page view: a good list, then actions whose reload of the list answers as scripted.
  const ADD_FAILS = { status: 502, json: { error: 'Could not add your Drive files. Please try again.' } }
  const CODE = { error_code: 'CONNECTOR_UPSTREAM_ERROR' }
  { // an action's reload fails with a code: the route's words and the code; the person acts again and that fails with its own message: the code is not under it
    const world = makeWorld({ script: scriptFor({ list: [CONNECTED, listFail(502, CODE)], disconnect: { status: 500, json: { error: 'Could not disconnect.' } } }) })
    world.pickerIds = ['file_aaaaaaaaaa']
    await over(world, { texts }, async view => {
      assert.deepEqual(view.details(), [], 'a good list at first: no small print')
      await view.click('Add files from Drive') // the add is good; its reload of the list fails with a code
      assert.deepEqual(view.alerts(), [ROUTE_WORDS]); assert.deepEqual(view.details(), ['code: CONNECTOR_UPSTREAM_ERROR'], 'the reload after the add failed: its code')
      await view.click('Disconnect') // the person acts: the print goes with the message; the disconnect fails with its own words
      assert.deepEqual(view.alerts(), ['Could not disconnect.'], 'the disconnect\'s own message')
      assert.deepEqual(view.details(), [], 'and the list\'s small print is not under it')
    })
  }
  { // the same with an add that fails itself
    const world = makeWorld({ script: scriptFor({ list: [CONNECTED, listFail(504)], add: ADD_FAILS }) })
    world.pickerIds = ['file_aaaaaaaaaa']
    await over(world, { texts }, async view => {
      await view.click('Disconnect') // good; the reload fails with 504
      assert.deepEqual(view.details(), ['service error 504'])
      await view.click('Add files from Drive') // fails with its own message
      assert.deepEqual(view.alerts(), ['Could not add your Drive files. Please try again.']); assert.deepEqual(view.details(), [], 'no small print under another message')
    })
  }
  { // a coded failure, then a failure of another kind: the print is the new one's, not the old one's
    const world = makeWorld({ script: scriptFor({ list: [CONNECTED, listFail(502, CODE), listFail(504)] }) })
    await over(world, { texts }, async view => {
      await view.click('Disconnect'); assert.deepEqual(view.details(), ['code: CONNECTOR_UPSTREAM_ERROR'])
      await view.click('Disconnect'); assert.deepEqual(view.details(), ['service error 504'], 'the next failure\'s print replaces it')
    })
  }
  { // a coded failure, then the request itself fails (no answer: today's other words, no small print, and not the old code)
    const world = makeWorld({ script: scriptFor({ list: [CONNECTED, listFail(502, CODE), NETWORK] }) })
    await over(world, { texts }, async view => {
      await view.click('Disconnect'); assert.deepEqual(view.details(), ['code: CONNECTOR_UPSTREAM_ERROR'])
      await view.click('Disconnect')
      assert.deepEqual(view.alerts(), ['Could not load Google Drive. Please try again.']); assert.deepEqual(view.details(), [], 'no answer, no small print: the old code is not left under the new message')
    })
  }
  { // a coded failure, then a good answer: the print is gone with the message
    const world = makeWorld({ script: scriptFor({ list: [CONNECTED, listFail(502, CODE), CONNECTED] }) })
    await over(world, { texts }, async view => {
      await view.click('Disconnect'); assert.deepEqual(view.details(), ['code: CONNECTOR_UPSTREAM_ERROR'])
      await view.click('Disconnect')
      assert.deepEqual(view.alerts(), [], 'a good answer: no message'); assert.deepEqual(view.details(), [], 'and no small print')
      assert.equal(count(view.html(), 'data-connectors-gdrive-detail'), 0)
    })
  }
  { // the failed list on a page view that began with the word: both lines, each its own (the sentence, the route's words, the small print)
    const world = makeWorld({ search: '?gdrive=failed', script: scriptFor({ list: [listFail(502, CODE)] }) })
    await over(world, { texts }, view => {
      assert.deepEqual(view.results(), [LINES.failed]); assert.deepEqual(view.alerts(), [LINES.failed, ROUTE_WORDS]); assert.deepEqual(view.details(), ['code: CONNECTOR_UPSTREAM_ERROR'])
    })
  }
  { // an action's own message with a good refresh after it: no small print (the refresh did not fail); with a failed refresh: the route's words replace it and carry their code
    const NOT_FOUND = { status: 200, json: { removed: [], rejected: [{ id: 'item_aaaaaaaaaa', error: 'not_found' }], content_erased: false } }
    const good = makeWorld({ script: scriptFor({ list: [CONNECTED, CONNECTED], remove: NOT_FOUND }) })
    await over(good, { texts }, async view => {
      await view.click('Remove Plan')
      assert.deepEqual(view.alerts(), ['That file is no longer in your library.'], 'the removal\'s own message'); assert.deepEqual(view.details(), [], 'a good refresh: no small print')
    })
    const bad = makeWorld({ script: scriptFor({ list: [CONNECTED, listFail(502, CODE)], remove: NOT_FOUND }) })
    await over(bad, { texts }, async view => {
      await view.click('Remove Plan')
      assert.deepEqual(view.alerts(), [ROUTE_WORDS], 'the failed refresh: the route\'s words'); assert.deepEqual(view.details(), ['code: CONNECTOR_UPSTREAM_ERROR'], 'with its code')
    })
  }
}
/** A render with nothing new (the state setter that changes nothing): the page is asked to render again. */
function rerender(view) { view.host.schedule(); view.host.flush() }

// ============================================================================================================================================
// C. only insertions: the strip gives dev's page byte for byte; every line that touches the new state is behind the flag
// ============================================================================================================================================
/** What a later change's strips (those registered after this one) leave of a file, so that the check sees this change's lines and the base's others. */
const laterOnly = (rel, text) => { const strips = registry.LATER_STRIPS, at = strips.indexOf(STRIP_FN); return (at === -1 ? [] : strips.slice(at + 1)).reduce((out, strip) => { const next = strip(rel, out); return typeof next === 'string' ? next : out }, text) }
const IMPORT_LINE = 'import { STUDIO_CONNECTORS_CARD_REASONS, gdriveFailureDetail, gdriveResultLine, takeGdriveResultWord } from "@/lib/studio-connectors-card-reasons" // CARD-REASONS'
function pageDiffChecks(texts = {}) {
  const page = texts[PAGE] ?? read(PAGE), base = baseText(PAGE)
  const mine = laterOnly(PAGE, page)
  const out = STRIP_FN(PAGE, mine)
  assert.equal(out, base, `${PAGE}: without this change's lines (and any later change's) the page is dev's, byte for byte`)
  assert.equal(STRIP_FN(PAGE, out), out, `${PAGE}: stripping twice changes nothing more`)
  assert.notEqual(mine, base, `${PAGE}: the change is there to strip`)
  const diff = lineDiff(base, mine)
  assert.deepEqual(diff.removed, [], 'no base line is rewritten or lost: every change to the page is a pure insertion')
  assert.equal(EDITS[PAGE].filter(([, was]) => was !== '').length, 0, 'every pair of the strip is an insertion (its `was` is empty)')
  assert.equal(EDITS[PAGE].length, 15, 'fifteen insertions, one per marked line')
  assert.ok(EDITS[PAGE].every(([has]) => has.endsWith('\n') && has.split('\n').length === 2), 'each is one whole line')
  for (const line of diff.added) assert.match(line, MARKER_RE, `a line added to the page carries the marker: ${line.trim().slice(0, 100)}`)
  assert.deepEqual([...diff.added].sort(), EDITS[PAGE].flatMap(([has]) => has.split('\n').filter(Boolean)).sort(), 'the lines added to the page are exactly the strip\'s')
  assert.equal(diff.added.length, 15, 'fifteen lines added in all')
  assert.equal(lineWith(mine, 'from "@/lib/studio-connectors-card-reasons"'), IMPORT_LINE, 'the import is the flag and the three helpers')
  for (const rel of APP_FILES) assert.equal(STRIP_FN(rel, 'x\nCARD-REASONS\n'), 'x\nCARD-REASONS\n', 'a text with no edit in it comes back as it is')
  for (const rel of ['hooks/use-gdrive-composer.ts', COMPOSER_LIB, 'lib/connectors-gdrive-server.ts', 'app/builder/page.tsx', ENV, REGISTRY, 'toString', '__proto__']) assert.equal(STRIP_FN(rel, 'x\nCARD-REASONS\n'), 'x\nCARD-REASONS\n', `${rel}: a file this change does not own comes back as it is`)
  assert.equal(STRIP_FN(PAGE, 5), 5, 'a text that is not a string comes back as it is')
}
/** The page's text facts that the run cannot see: every marked line that touches the new state or the address is behind the flag, in the order that keeps the base's own hooks and answers first. */
const STATE_USE = /\b(setResultLine|setListDetail|resultLine|listDetail|takeGdriveResultWord|gdriveResultLine|gdriveFailureDetail)\b/
function guardChecks(texts = {}) {
  const page = texts[PAGE] ?? read(PAGE), lines = page.split('\n'), marked = lines.map((line, index) => ({ line, index })).filter(({ line }) => MARKER_RE.test(line))
  assert.equal(marked.length, 15, 'fifteen marked lines')
  const head = lines.findIndex(line => line.startsWith('  useEffect(() => { // CARD-REASONS'))
  assert.ok(head > 0 && lines.indexOf('  }, []) // CARD-REASONS', head) > head, 'one marked mount effect, keyed on nothing (it reads the address once)')
  const close = lines.indexOf('  }, []) // CARD-REASONS', head)
  assert.equal(lines[head + 1], '    if (!STUDIO_CONNECTORS_CARD_REASONS) return // CARD-REASONS: flag off, nothing here runs', 'the mount effect returns first when the flag is off')
  assert.equal(lines.filter(line => /\bwindow\./.test(line) && !MARKER_RE.test(line)).length, 0, 'the address (window) is touched on marked lines only (the base page touches none)')
  assert.ok(lines.slice(head, close + 1).filter(line => /\bwindow\./.test(line)).length === 2, 'the mount effect reads the address once (location.search) and changes it once (history.replaceState)')
  for (const { line, index } of marked) {
    if (!STATE_USE.test(line) || /^  const \[(resultLine|listDetail), set(ResultLine|ListDetail)\] = useState/.test(line) || line === IMPORT_LINE) continue
    if (index > head && index <= close) continue // behind the mount effect's own first-line guard
    assert.ok(line.includes('STUDIO_CONNECTORS_CARD_REASONS'), `a marked line that touches the new state names the flag: ${line.trim().slice(0, 110)}`)
  }
  assert.match(lines.find(line => /\[busy\]\) \/\/ CARD-REASONS/.test(line)) ?? '', /useEffect\(\(\) => \{ if \(STUDIO_CONNECTORS_CARD_REASONS && busy\) setResultLine\(null\) \}, \[busy\]\)/, 'the line goes when the person acts (busy): keyed on busy, behind the flag')
  assert.match(lines.find(line => /\[message\]\) \/\/ CARD-REASONS/.test(line)) ?? '', /useEffect\(\(\) => \{ if \(STUDIO_CONNECTORS_CARD_REASONS && message === null\) setListDetail\(null\) \}, \[message\]\)/, 'the small print goes when the message does: keyed on message, behind the flag')
  const at = needle => { const hits = lines.map((line, i) => line.includes(needle) ? i : -1).filter(i => i >= 0); assert.equal(hits.length, 1, `one line holds ${needle}`); return hits[0] }
  assert.ok(at('const data = await res.json()') < at('setListDetail(gdriveFailureDetail(res.status, data))') && at('setListDetail(gdriveFailureDetail(res.status, data))') < at('if (!res.ok) { setMessage('), 'the small print is decided from the parsed answer, before the base\'s own message line')
  assert.ok(lines[at('setListDetail(gdriveFailureDetail(res.status, data))')].includes('STUDIO_CONNECTORS_CARD_REASONS && !res.ok'), 'only a failed answer gets small print')
  assert.ok(at('const [state, setState]') < at('const [busy, setBusy]') && at('const [busy, setBusy]') < at('const [message, setMessage]') && at('const [message, setMessage]') < at('const [resultLine, setResultLine]') && at('const [resultLine, setResultLine]') < at('const [listDetail, setListDetail]'), 'the new states come after the base\'s three, so the Drive state is still the first useState and the order of the base\'s hooks is the base\'s')
  const render = lines.filter(line => /data-connectors-gdrive-(result|detail)="true"/.test(line))
  assert.equal(render.length, 2, 'two render lines: the sentence and the small print')
  assert.ok(render.find(line => line.includes('data-connectors-gdrive-detail')).trim().startsWith('{STUDIO_CONNECTORS_CARD_REASONS && message && listDetail && '), 'the small print is drawn only under a message')
  for (const line of render) assert.ok(line.trim().startsWith('{STUDIO_CONNECTORS_CARD_REASONS && ') && /\}\{\/\* CARD-REASONS[^*]*\*\/\}$/.test(line), `a render line is behind the flag and is an expression child that adds no text node: ${line.trim().slice(0, 90)}`)
  assert.ok(at('data-connectors-gdrive-result="true"') < at('{message && <Alert>') && at('{message && <Alert>') < at('data-connectors-gdrive-detail="true"'), 'the sentence is above the message, the small print right under it')
  assert.ok(!/connectors-gdrive-(composer|server)|GDRIVE_MARKER|takeGdriveReturn|isGenuineReturn/.test(page), 'the page does not use the composer\'s reader or its marker (that rule stays the composer\'s)')
}

// ============================================================================================================================================
// C2. the older proofs: two get one line (the subject splice); the other four are dev's, byte for byte
// ============================================================================================================================================
// The page change is a pure insertion, so the older proofs need nothing for it (the registry's strips and the marker cover it). The two that read the first-parent line of BASE..HEAD meet this change's own commit there, so each drops this change's subject from it, as for every later change.
const PIN_GAINS = { 'scripts/test-studio-chat-element-edit.mjs': 1, 'scripts/test-studio-deck-sync-truth.mjs': 1 }
const UNTAUGHT = ['scripts/test-studio-job-ledger.mjs', 'scripts/test-studio-new-deck-handoff-send.mjs', 'scripts/test-studio-chat-element-refine.mjs', 'scripts/test-studio-billing-f5-usage.mjs', 'scripts/test-studio-research-default.mjs', 'scripts/test-studio-connectors-gdrive.mjs', 'scripts/test-studio-connectors-item-remove.mjs', 'scripts/test-studio-connectors-gdrive-composer.mjs', 'scripts/test-studio-connectors-session-links.mjs', 'scripts/test-studio-connectors-gdrive-badge.mjs']
function pinChecks(texts = {}, mod = stripModule) {
  const strip = mod.stripCardReasons, pinFiles = mod.CARD_REASONS_PIN_FILES
  assert.deepEqual([...pinFiles].sort(), Object.keys(PIN_GAINS).sort(), 'the older proofs this change teaches: the two that read the first-parent line')
  for (const [rel, gained] of Object.entries(PIN_GAINS)) {
    const now = laterOnly(rel, texts[rel] ?? read(rel)), diff = lineDiff(baseText(rel), now)
    assert.equal(strip(rel, now), baseText(rel), `${rel}: without this change's line the proof is dev's, byte for byte`)
    assert.equal(strip(rel, strip(rel, now)), strip(rel, now), `${rel}: putting back twice changes nothing more`)
    assert.deepEqual([diff.removed.length, diff.added.length], [0, gained], `${rel}: the proof gains ${gained} marked line and loses none`)
    for (const line of diff.added) assert.ok(line.includes(mod.CARD_REASONS_PIN_MARK), `${rel}: a line added to the proof carries the pin mark: ${line.trim().slice(0, 100)}`)
    for (const line of diff.added) assert.ok(line.includes('shas.splice') && line.includes('^Card reasons:') && !line.includes('Research default') && !line.includes('Replace picture'), `${rel}: the line is a splice that names this change's own subject, and only that`)
  }
  assert.equal(Object.values(mod.CARD_REASONS_PIN_EDITS).flat().every(([, was]) => was === ''), true, 'every pin edit is a pure insertion')
  for (const rel of UNTAUGHT) assert.equal(laterOnly(rel, texts[rel] ?? read(rel)), baseText(rel), `${rel} is dev's file, byte for byte (nothing to teach it)`)
}

// ============================================================================================================================================
// D. nothing else changed: the composer and its marker rule, the routes, the server lib, the other Drive files
// ============================================================================================================================================
const UNTOUCHED = ['hooks/use-gdrive-composer.ts', COMPOSER_LIB, 'lib/connectors-gdrive-server.ts', GDRIVE_LIB, 'lib/connectors-gdrive-flag.ts', 'lib/connectors-gdrive-remove.ts', 'lib/connectors-gdrive-citations.ts', 'lib/connectors-gdrive-session-links.ts', 'lib/gdrive-picker-loader.ts',
  'components/settings/gdrive-remove-item.tsx', 'components/settings/settings-sidebar.tsx', 'components/builder/chat-input.tsx', ...git('ls-files', 'app/api/connectors').split('\n').filter(Boolean)]
function untouchedChecks(texts = {}) {
  assert.ok(UNTOUCHED.length >= 16 && UNTOUCHED.includes('app/api/connectors/gdrive/callback/route.ts'), 'the callback route is among the files held to dev')
  for (const rel of UNTOUCHED) assert.equal(laterOnly(rel, texts[rel] ?? read(rel)), baseText(rel), `${rel} is dev's file, byte for byte`)
  const composer = texts[COMPOSER_LIB] ?? read(COMPOSER_LIB)
  assert.ok(composer.includes('export const isGenuineReturn') && composer.includes('queryMarker === cookieMarker'), 'the composer\'s one-time marker rule is where it was')
  assert.ok((texts['hooks/use-gdrive-composer.ts'] ?? read('hooks/use-gdrive-composer.ts')).includes('isGenuineReturn(marker, markerFromCookies(window.document.cookie))'), 'and the composer still acts on ?gdrive= only when the marker matches')
}

// ============================================================================================================================================
// E. .env.example: one block at the end
// ============================================================================================================================================
/** .env.example without the blocks registered after this one (a later change's block sits below this one's). */
const laterEnv = text => { const blocks = registry.LATER_ENV_BLOCKS, at = blocks.indexOf(ENV_BLOCK); return (at === -1 ? [] : blocks.slice(at + 1)).reduce((out, later) => out.replace(`\n${later}`, ''), text) }
function envChecks(texts = {}, block = ENV_BLOCK) {
  const env = laterEnv(texts[ENV] ?? read(ENV))
  assert.ok(env.endsWith(`\n${block}`), '.env.example ends with the block (at the end)')
  assert.equal(env.slice(0, env.length - block.length - 1), baseText(ENV), '.env.example is dev\'s file plus that one blank-line-separated block')
  assert.equal((env.match(new RegExp(`^${FLAG}=`, 'gm')) || []).length, 1, `.env.example assigns ${FLAG} once`)
  assert.match(block, new RegExp(`^${FLAG}="false"$`, 'm'), `${FLAG} is documented as "false"`)
  assert.ok(block.trimEnd().split('\n').at(-1) === `${FLAG}="false"`, 'the block ends with its assignment')
  assert.ok(block.split('\n').filter(line => line && !line.startsWith('#')).length === 1 && block.split('\n').filter(line => line.startsWith('#')).length >= 2, 'comments and one assignment')
  for (const sentence of Object.values(LINES)) assert.ok(block.includes(`"${sentence}"`), `the block gives the sentence word for word: ${sentence}`)
  for (const word of WORDS) assert.ok(block.includes(`${word} "`), `the block names the word ${word}`)
  assert.ok(block.includes('code: <error_code>') && block.includes('starts with CONNECTOR_') && block.includes('service error <status>'), 'the block says what the small print is')
  assert.ok(block.includes(`("${ROUTE_WORDS}")`), 'and that the failed list call keeps its words')
  assert.ok(block.includes('any other value shows nothing') && /never show(s)? a token, an id or an e-mail/.test(block), 'unknown values show nothing; never a token, an id or an e-mail')
  assert.ok(block.includes('exact value "true"') && block.includes('default off'), 'exact "true", default off')
  assert.ok(block.includes('NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED') && block.includes('not touched'), 'it rides the Drive flag; the composer is not touched')
  assert.equal(registry.stripLaterEnvBlocks(ENV, env).includes(FLAG), false, 'the registry takes the block out of .env.example')
  assert.equal(registry.stripLaterEnvBlocks(ENV, env).includes('STUDIO CONNECTORS CARD REASONS'), false, 'and its comments with it')
  assert.equal(registry.stripLaterEnvBlocks(ENV, env), registry.stripLaterEnvBlocks(ENV, baseText(ENV)), 'read through the registry it is what the registry makes of dev\'s file')
  // the words are the lib's (the documentation cannot drift from what the card says)
  const lib = loadLib(LIB, { env: {}, texts: { [LIB]: texts[LIB] ?? read(LIB) } })
  for (const word of WORDS) assert.ok(block.includes(`${word} "${lib.gdriveResultLine(word)}"`), `the block's sentence for ${word} is the lib's`)
}

// ============================================================================================================================================
// F. the registry
// ============================================================================================================================================
const REG_MARK = '// LATER-CHANGE: KNOWLEDGE-3, the Google Drive card says why'
function registryChecks(text = read(REGISTRY)) {
  const lists = { LATER_CHANGE_FILES: 'CARD_REASONS_SCOPE_FILES', LATER_ENV_BLOCKS: 'CARD_REASONS_ENV_BLOCK', LATER_STRIPS: 'stripCardReasons' }
  const neighbour = { LATER_CHANGE_FILES: 'RESEARCH_DEFAULT_SCOPE_FILES', LATER_ENV_BLOCKS: 'RESEARCH_DEFAULT_ENV_BLOCK', LATER_STRIPS: 'stripResearchDefault' }
  for (const [list, name] of Object.entries(lists)) {
    const start = text.indexOf(`export const ${list} = `), end = text.indexOf('// one line per later change, above this comment', start)
    assert.ok(start >= 0 && end > start, `${list} is in the registry, with its marker comment after the lines`)
    const rows = text.slice(start, end).split('\n').filter(Boolean), at = rows.findIndex(line => line.includes('studio-gdrive-card-reasons-strip.mjs'))
    assert.ok(at > 0, `${list}: this change's line is in the list`)
    assert.ok(rows[at].includes(`).${name},`), `${list}: the line reads ${name}`)
    assert.equal((text.slice(start, end).match(/studio-gdrive-card-reasons-strip\.mjs/g) || []).length, 1, `${list}: one line names this change's strip`)
    const before = rows.findIndex(line => line.includes(`).${neighbour[list]},`))
    assert.ok(before >= 0 && at > before, `${list}: the line sits after the Research default's (the order the changes were stacked, at the true end)`)
  }
  const registered = text.split('\n').filter(line => line.includes('studio-gdrive-card-reasons-strip.mjs'))
  assert.equal(registered.length, 3, 'the registry gains exactly its three lines'); assert.ok(registered.every(line => line.includes(REG_MARK) && /(?<![\w-])LATER-CHANGE(?![\w-])/.test(line)), 'each carries the registry marker')
  const diff = lineDiff(baseText(REGISTRY), text)
  assert.deepEqual(diff.removed, [], 'and loses none'); assert.ok(registered.every(line => diff.added.includes(line)), 'and the three are among the lines it adds')
  assert.ok(registry.LATER_STRIPS.includes(STRIP_FN), 'the strip is registered'); assert.ok(registry.LATER_ENV_BLOCKS.includes(ENV_BLOCK), 'the block is registered')
  assert.ok([...SCOPE].every(rel => registry.LATER_CHANGE_FILES.has(rel)), 'every scope file is registered')
  assert.ok(registry.LATER_STRIPS.indexOf(STRIP_FN) > registry.LATER_STRIPS.indexOf(researchDefaultStrip.stripResearchDefault), 'the strip runs after the Research default\'s (the order the changes were stacked)')
  assert.ok(registry.LATER_ENV_BLOCKS.indexOf(ENV_BLOCK) > registry.LATER_ENV_BLOCKS.indexOf(researchDefaultStrip.RESEARCH_DEFAULT_ENV_BLOCK), 'and so does the block')
  // an older proof that holds the page to dev's file reads it through the registry: it is dev's
  assert.equal(registry.stripLaterChanges(PAGE, read(PAGE)), registry.stripLaterChanges(PAGE, baseText(PAGE)), `${PAGE}: read through the registry it is the base's (older proofs read it like that)`)
  assert.equal(registry.stripLaterChanges(ENV, read(ENV)), registry.stripLaterChanges(ENV, baseText(ENV)), `${ENV}: read through the registry it is the base's`)
  for (const rel of PIN_FILES) assert.equal(registry.stripLaterChanges(rel, read(rel)), registry.stripLaterChanges(rel, baseText(rel)), `${rel}: read through the registry it is the base's`)
  // the strips of the neighbouring change leave each other's lines alone, whichever order they run in
  const builder = read('app/builder/page.tsx'), connectors = read(PAGE)
  assert.equal(STRIP_FN('app/builder/page.tsx', builder), builder, 'this strip leaves the Builder page (the Research default\'s) alone')
  assert.equal(researchDefaultStrip.stripResearchDefault(PAGE, connectors), connectors, 'the Research default strip leaves the Drive card\'s page alone')
  assert.equal(STRIP_FN(PAGE, researchDefaultStrip.stripResearchDefault(PAGE, connectors)), researchDefaultStrip.stripResearchDefault(PAGE, STRIP_FN(PAGE, connectors)), 'the two strips commute')
  for (const rel of [PAGE, 'app/builder/page.tsx', ENV, ...PIN_FILES]) assert.equal(STRIP_FN(rel, researchDefaultStrip.stripResearchDefault(rel, read(rel))), researchDefaultStrip.stripResearchDefault(rel, STRIP_FN(rel, read(rel))), `${rel}: the two strips commute`)
}

// ============================================================================================================================================
// G. scope, commits, secrets
// ============================================================================================================================================
const subjectOf = sha => git('log', '-1', '--format=%s', sha)
const own = (...args) => git('rev-list', '--no-merges', ...args, `${BASE_COMMIT}..HEAD`).split('\n').filter(Boolean).filter(sha => subjectOf(sha).startsWith(SUBJECT))
/** This change's commits: on the first-parent line, by the subject prefix; once the gate has merged the branch they sit on the merge's second parent, so the whole range is read as well. */
const firstParentCommits = () => own('--first-parent'), allCommits = () => own()
function touchedFiles(commits) { const net = new Set(git('diff', '--name-only', `${BASE_COMMIT}..HEAD`).split('\n').filter(Boolean)); return new Set(commits.flatMap(commit => git('show', '--name-only', '--format=', commit).split('\n')).filter(rel => rel && net.has(rel))) }
function scopeCheck(commits, extra = []) { assert.deepEqual([...touchedFiles(commits), ...extra].filter(rel => !SCOPE.has(rel)).sort(), [], 'no file outside this change\'s scope differs from the base') }
function messageProblems(subject, body) { const problems = []; if (!subject.startsWith(SUBJECT)) problems.push(`the subject starts "${SUBJECT}"`); if (!/^Co-Authored-By: Claude Opus 5\.5 <noreply@anthropic\.com>\s*$/m.test(body.trimEnd().split('\n').at(-1) ?? '')) problems.push('the co-author line, last'); return problems }
function secretChecks(texts = {}) {
  for (const rel of [...APP_FILES, ...NEW_FILES, ENV, REGISTRY]) assert.doesNotMatch(texts[rel] ?? read(rel), SECRET, `${rel}: no secret`)
  for (const sha of allCommits()) assert.doesNotMatch(git('show', '--format=%B', sha), SECRET, `commit ${sha.slice(0, 8)}: no secret in the diff or the message`)
}

// ============================================================================================================================================
// H. one literal read
// ============================================================================================================================================
function oneReadChecks(texts = {}) {
  for (const rel of git('ls-files', 'app', 'hooks', 'components', 'lib', 'middleware.ts', 'next.config.mjs').split('\n').filter(Boolean).filter(f => /\.(ts|tsx|mjs|js)$/.test(f))) {
    const text = texts[rel] ?? read(rel)
    assert.equal((text.match(new RegExp(`process\\.env\\.${FLAG}\\b`, 'g')) || []).length, rel === LIB ? 1 : 0, `${rel}: ${rel === LIB ? `reads ${FLAG} once` : `does not read ${FLAG} itself`}`)
  }
  for (const rel of git('grep', '-l', '-E', '-e', 'STUDIO_CONNECTORS_CARD_REASONS', '--', 'app', 'hooks', 'components', 'lib').split('\n').filter(Boolean)) assert.ok([LIB, PAGE].includes(rel), `${rel}: only the lib and the Drive card's page name the flag`)
  assert.equal((((texts[LIB] ?? read(LIB)).match(/process\.env/g)) || []).length, 1)
}

// ============================================================================================================================================
// run
// ============================================================================================================================================
const TEXTS = Object.fromEntries([...APP_FILES, ...NEW_FILES.filter(f => f !== 'scripts/test-studio-gdrive-card-reasons.mjs'), ...PIN_FILES, ...UNTAUGHT, ...UNTOUCHED, ENV, REGISTRY].map(rel => [rel, read(rel)]))
await check('A. the lib: the flag is on for the exact string "true" and nothing else, one literal read; the four sentences word for word; any other value shows nothing; the small print (a CONNECTOR_ code, else the status; never a token, an id or an e-mail)', () => libChecks())
let offHash = ''
await check('B. flag off: the page is dev\'s page step for step (markup, requests, address-bar calls, toasts) over every scenario; the sha256 of the outputs is dev\'s', async () => { offHash = await offChecks(TEXTS) })
if (offHash) console.log(`     flag off, sha256 of every scenario's output, this page and dev's page alike: ${offHash}`)
await check('B2. flag on, by the real page: each word its sentence once, others nothing, the word read once and taken off the address bar, gone when the person acts, never back; a failed list keeps its words and gains its small print, never a token, an id or an e-mail', () => onChecks(TEXTS))
await check('C. only insertions: no base line of the page is rewritten; the strip gives dev\'s page byte for byte', () => pageDiffChecks(TEXTS))
await check('C3. every line that touches the new state or the address is behind the flag; the order of the base\'s hooks is the base\'s', () => guardChecks(TEXTS))
await check('C2. the older proofs: two get one splice line each; the others are dev\'s', () => pinChecks(TEXTS))
await check('D. nothing else changed: the composer, its marker rule, the routes, the server lib and the other Drive files are dev\'s', () => untouchedChecks(TEXTS))
await check('E. .env.example: one block at the end, "false", dev\'s file plus the block, the words the lib has', () => envChecks(TEXTS))
await check('F. the registry: three lines, each marked LATER-CHANGE, after the Research default\'s; the strips commute', () => registryChecks())
await check('G1. own-commit scope, by the subject prefix on the first-parent line; the commit message', () => {
  const commits = allCommits(); assert.ok(commits.length >= 1, 'this change has a commit of its own')
  scopeCheck(firstParentCommits()); scopeCheck(commits)
  for (const commit of commits) assert.deepEqual(messageProblems(subjectOf(commit), git('log', '-1', '--format=%B', commit)), [], `commit ${commit.slice(0, 8)}`)
})
await check('G2. a secret scan of the files and the commits', () => secretChecks(TEXTS))
await check('H. the flag is read from one literal env name, and only the lib reads it', () => oneReadChecks())

// ---- I. mutants ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const P = (from, to) => ({ [PAGE]: swap(TEXTS[PAGE], from, to) })
const L = (from, to) => ({ [LIB]: swap(read(LIB), from, to) })
const E = (from, to) => ({ [ENV]: swap(TEXTS[ENV], from, to) })
const L_HEAD = lineWith(TEXTS[PAGE], '  useEffect(() => { // CARD-REASONS')
const L_GUARD = lineWith(TEXTS[PAGE], '    if (!STUDIO_CONNECTORS_CARD_REASONS) return // CARD-REASONS')
const L_TAKEN = lineWith(TEXTS[PAGE], '    const taken = takeGdriveResultWord(')
const L_LINE = lineWith(TEXTS[PAGE], '    const line = gdriveResultLine(taken.word)')
const L_SET = lineWith(TEXTS[PAGE], '    if (line) setResultLine(line)')
const L_REPLACE = lineWith(TEXTS[PAGE], '    if (taken.found) {')
const L_CLOSE = '  }, []) // CARD-REASONS'
const L_BUSY = lineWith(TEXTS[PAGE], '[busy]) // CARD-REASONS')
const L_MSG = lineWith(TEXTS[PAGE], '[message]) // CARD-REASONS')
const L_LOAD = lineWith(TEXTS[PAGE], 'setListDetail(gdriveFailureDetail(res.status, data))')
const L_RES = lineWith(TEXTS[PAGE], 'data-connectors-gdrive-result="true"')
const L_DET = lineWith(TEXTS[PAGE], 'data-connectors-gdrive-detail="true"')
const L_STATE1 = lineWith(TEXTS[PAGE], '  const [resultLine, setResultLine]')
const L_STATE2 = lineWith(TEXTS[PAGE], '  const [listDetail, setListDetail]')
const L_BASE_STATE = '  const [message, setMessage] = useState<string | null>(null)'
const set = (line, from, to) => { if (!line.includes(from)) throw new SwapError(`${JSON.stringify(from.slice(0, 60))} is in the line`); return P(line, line.replace(from, to)) }
/** Flag off and flag on, by the real page. */
const behave = async texts => { await offChecks(texts); await onChecks(texts) }
const FLAG_LINE = `process.env.${FLAG} === 'true'`
const MUTANTS = [
  // the lib: the flag
  ['lib: the flag accepts "True"', L(FLAG_LINE, `process.env.${FLAG}?.toLowerCase() === 'true'`), libChecks],
  ['lib: the flag is on for anything but "false"', L(FLAG_LINE, `process.env.${FLAG} !== 'false'`), libChecks],
  ['lib: the flag is on for any value', L(FLAG_LINE, `!!process.env.${FLAG}`), libChecks],
  ['lib: the flag reads the Drive flag', L(`process.env.${FLAG} ===`, `process.env.${DRIVE_FLAG} ===`), libChecks],
  ['lib: the flag reads another name', L(`process.env.${FLAG} ===`, `process.env.${FLAG.slice(0, -1)} ===`), libChecks],
  ['lib: a second read through a dynamic key', L(`${FLAG_LINE}\n`, `${FLAG_LINE} || process.env['NEXT_PUBLIC_STUDIO_CONNECTORS_' + 'CARD_REASONS'] === 'true'\n`), libChecks],
  ['lib: an import', L('export const STUDIO_CONNECTORS_CARD_REASONS', "import { x } from './y'\nexport const STUDIO_CONNECTORS_CARD_REASONS"), libChecks],
  ['lib: a secret', { [LIB]: `${read(LIB)}// sk-${'a'.repeat(24)}\n` }, secretChecks],
  // the lib: the sentences and the words
  ['lib: the cancelled sentence says declined', L('cancelled or not approved.', 'cancelled or declined.'), libChecks],
  ['lib: the invalid sentence loses its last words', L(' Please try again here.', ''), libChecks],
  ['lib: the failed sentence loses its second part', L(' This is our fault; please try again later.', ''), libChecks],
  ['lib: the connected sentence has no period', L("'Google Drive is connected.'", "'Google Drive is connected'"), libChecks],
  ['lib: the failed sentence is said for invalid too', L("case 'invalid': return 'The Google sign-in took too long or finished in another browser. Please try again here.'", "case 'invalid': return 'Google said yes, but Deckster could not save the connection. This is our fault; please try again later.'"), libChecks],
  ['lib: cancelled shows nothing', L("    case 'cancelled': return 'Google sign-in was cancelled or not approved.'\n", ''), libChecks],
  ['lib: an unknown value shows a sentence', L('    default: return null', "    default: return 'Google Drive is connected.'"), libChecks],
  ['lib: the word is matched without case', L('switch (word) {', "switch (typeof word === 'string' ? word.toLowerCase() : word) {"), libChecks],
  ['lib: the word is trimmed', L('switch (word) {', "switch (typeof word === 'string' ? word.trim() : word) {"), libChecks],
  ['lib: a fifth word', L("    default: return null", "    case 'denied': return 'Google Drive was denied.'\n    default: return null"), libChecks],
  // the lib: the word reader
  ['lib: the word is not taken off', L("  params.delete('gdrive')\n", ''), libChecks],
  ['lib: found is false for an empty word', L("const found = params.has('gdrive')", "const found = params.get('gdrive') !== null && params.get('gdrive') !== ''"), libChecks],
  ['lib: found is always true', L("const found = params.has('gdrive')", 'const found = true'), libChecks],
  ['lib: the last word counts', L("const word = params.get('gdrive')", "const word = params.getAll('gdrive').at(-1) ?? null"), libChecks],
  ['lib: the other parameters are dropped', L("search: rest ? `?${rest}` : '' }", "search: '' }"), libChecks],
  ['lib: the query comes back without its ?', L("search: rest ? `?${rest}` : '' }", "search: rest }"), libChecks],
  ['lib: the marker parameter is taken too', L("  params.delete('gdrive')\n", "  params.delete('gdrive')\n  params.delete('gdrive_marker')\n"), libChecks],
  // the lib: the small print
  ['lib: any code that starts with CONNECTOR_ is printed', L('/^CONNECTOR_[A-Z0-9_]{1,64}$/', '/^CONNECTOR_/'), libChecks],
  ['lib: a code may carry anything after the prefix', L('/^CONNECTOR_[A-Z0-9_]{1,64}$/', '/^CONNECTOR_[A-Za-z0-9_.@:-]+$/'), libChecks],
  ['lib: a code may be lower case', L('/^CONNECTOR_[A-Z0-9_]{1,64}$/', '/^CONNECTOR_[A-Za-z0-9_]{1,64}$/'), libChecks],
  ['lib: a code may be long', L('/^CONNECTOR_[A-Z0-9_]{1,64}$/', '/^CONNECTOR_[A-Z0-9_]{1,500}$/'), libChecks],
  ['lib: a code is not anchored at the end', L('/^CONNECTOR_[A-Z0-9_]{1,64}$/', '/^CONNECTOR_[A-Z0-9_]{1,64}/'), libChecks],
  ['lib: a code needs no prefix', L('/^CONNECTOR_[A-Z0-9_]{1,64}$/', '/^[A-Z0-9_]{1,64}$/'), libChecks],
  ['lib: the status comes before the code', L("  if (typeof code === 'string' && /^CONNECTOR_[A-Z0-9_]{1,64}$/.test(code)) return `code: ${code}`\n  if (typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599) return `service error ${status}`\n", "  if (typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599) return `service error ${status}`\n  if (typeof code === 'string' && /^CONNECTOR_[A-Z0-9_]{1,64}$/.test(code)) return `code: ${code}`\n"), libChecks],
  ['lib: the code is read from another field', L('(body as { error_code?: unknown }).error_code', '(body as { code?: unknown }).code'), libChecks],
  ['lib: the code line says error_code:', L('`code: ${code}`', '`error_code: ${code}`'), libChecks],
  ['lib: the status line says error', L('`service error ${status}`', '`error ${status}`'), libChecks],
  ['lib: the status line adds the error words from the answer', L('`service error ${status}`', '`service error ${status}: ${(body as { error?: unknown } | null)?.error}`'), libChecks],
  ['lib: a status of 0 is an HTTP status', L('status >= 100', 'status >= 0'), libChecks],
  ['lib: a status of 600 or more is an HTTP status', L('status <= 599', 'status <= 999'), libChecks],
  ['lib: a status that is not an integer is an HTTP status', L('Number.isInteger(status) && ', ''), libChecks],
  ['lib: no status gives a line anyway', L('  return null\n}', '  return `service error`\n}'), libChecks],
  ['lib: the small print also names an account', L('`code: ${code}`', '`code: ${code} (${(body as { account_label?: unknown }).account_label})`'), libChecks],
  // the page: the mount effect
  ['effect: it runs with the flag off', P(`${L_GUARD}\n`, ''), behave],
  ['effect: it runs with the flag off (text check)', P(`${L_GUARD}\n`, ''), guardChecks],
  ['effect: the guard is inverted', set(L_GUARD, 'if (!STUDIO', 'if (STUDIO'), behave],
  ['effect: it reads the address without the flag (before the guard)', P(`${L_GUARD}\n`, `    void window.location.search // CARD-REASONS\n${L_GUARD}\n`), offChecks],
  ['effect: the sentence is never set', P(`${L_SET}\n`, ''), onChecks],
  ['effect: it sets the sentence even when there is none (Strict Mode\'s second run clears it)', set(L_SET, 'if (line) setResultLine(line)', 'setResultLine(line)'), onChecks],
  ['effect: it sets the raw word', set(L_LINE, 'gdriveResultLine(taken.word)', 'taken.word'), onChecks],
  ['effect: it reads another parameter', set(L_TAKEN, 'window.location.search', 'window.location.hash'), onChecks],
  ['effect: the word is not taken off the address bar', P(`${L_REPLACE}\n`, ''), onChecks],
  ['effect: the other parameters are dropped from the address', set(L_REPLACE, '${taken.search}', ''), onChecks],
  ['effect: the whole query is put back', set(L_REPLACE, '${taken.search}', '${window.location.search}'), onChecks],
  ['effect: the hash is dropped from the address', set(L_REPLACE, '${window.location.hash}', ''), onChecks],
  ['effect: the path is dropped from the address', set(L_REPLACE, '${window.location.pathname}', ''), onChecks],
  ['effect: the word is taken off only when it is a word', set(L_REPLACE, 'if (taken.found)', 'if (line)'), onChecks],
  ['effect: the address bar refusing crashes the page', set(L_REPLACE, '} catch {', '} finally {'), onChecks],
  ['effect: it is keyed on nothing less (it runs on every render)', P(L_CLOSE, '  }) // CARD-REASONS'), onChecks],
  ['effect: it is keyed on busy (it runs again when the person acts)', P(L_CLOSE, '  }, [busy]) // CARD-REASONS'), onChecks],
  ['effect: the sentence is not taken off when the person acts', P(`${L_BUSY}\n`, ''), onChecks],
  ['effect: the sentence is taken off at the first render (busy is not busy)', set(L_BUSY, '&& busy)', '&& !busy)'), onChecks],
  ['effect: the sentence goes only when the action ends', set(L_BUSY, '&& busy)', '&& !busy && resultLine !== null)'), onChecks],
  ['effect: the busy effect runs once only', set(L_BUSY, '[busy])', '[])'), onChecks],
  ['effect: the busy effect has no flag guard (text check)', set(L_BUSY, 'STUDIO_CONNECTORS_CARD_REASONS && busy', 'busy'), guardChecks],
  ['effect: the small print stays when the message goes', P(`${L_MSG}\n`, ''), onChecks],
  ['effect: the small print goes with any change of message (it never shows)', set(L_MSG, 'message === null', 'true'), onChecks],
  ['effect: the small print goes with the message, keyed on nothing else (never cleared)', set(L_MSG, '[message])', '[])'), onChecks],
  ['effect: the message effect has no flag guard (text check)', set(L_MSG, 'STUDIO_CONNECTORS_CARD_REASONS && message === null', 'message === null'), guardChecks],
  // the page: the failed list call
  ['load: no small print', P(`${L_LOAD}\n`, ''), onChecks],
  ['load: no small print without the flag guard (text check)', set(L_LOAD, 'STUDIO_CONNECTORS_CARD_REASONS && !res.ok', '!res.ok'), guardChecks],
  ['load: the small print is set for a good answer too', set(L_LOAD, ' && !res.ok', ''), onChecks],
  ['load: the status and the answer are swapped', set(L_LOAD, '(res.status, data)', '(data, res.status)'), onChecks],
  ['load: the answer is not given', set(L_LOAD, '(res.status, data)', '(res.status, null)'), onChecks],
  ['load: the status is not given', set(L_LOAD, '(res.status, data)', '(0, data)'), onChecks],
  ['load: the small print is set before the answer is read (text check)', { [PAGE]: TEXTS[PAGE].replace(`${L_LOAD}\n`, '').replace('      const res = await fetch("/api/connectors/gdrive/items", { cache: "no-store" })\n', `      const res = await fetch("/api/connectors/gdrive/items", { cache: "no-store" })\n${L_LOAD.replace('data', 'null')}\n`) }, guardChecks],
  // the page: the render lines
  ['render: the sentence is drawn without the flag (text check)', set(L_RES, '{STUDIO_CONNECTORS_CARD_REASONS && resultLine &&', '{resultLine &&'), guardChecks],
  ['render: the small print is drawn without the flag (text check)', set(L_DET, '{STUDIO_CONNECTORS_CARD_REASONS && message && listDetail &&', '{message && listDetail &&'), guardChecks],
  ['render: the sentence is not drawn', set(L_RES, '{STUDIO_CONNECTORS_CARD_REASONS && resultLine &&', '{STUDIO_CONNECTORS_CARD_REASONS && false &&'), onChecks],
  ['render: the sentence has no data attribute', set(L_RES, ' data-connectors-gdrive-result="true"', ''), onChecks],
  ['render: the small print is not drawn', set(L_DET, '{STUDIO_CONNECTORS_CARD_REASONS && message && listDetail &&', '{STUDIO_CONNECTORS_CARD_REASONS && false &&'), onChecks],
  ['render: the small print is drawn without a message', set(L_DET, ' && message && listDetail', ' && listDetail'), guardChecks],
  ['render: the small print is a second alert', P(L_DET, L_DET.replace(/<p className="[^"]*" style=\{\{[^}]*\}\} (data-connectors-gdrive-detail="true")>\{listDetail\}<\/p>/, '<Alert $1><AlertDescription>{listDetail}</AlertDescription></Alert>')), onChecks],
  ['render: the small print is not small print', set(L_DET, 'text-xs ', ''), onChecks],
  ['render: the small print shows the raw answer', set(L_DET, '{listDetail}', '{listDetail}{" "}{JSON.stringify(message)}'), onChecks],
  ['render: a space text node after the sentence (flag off, the markup differs)', set(L_RES, '}{/* CARD-REASONS', '} {/* CARD-REASONS'), offChecks],
  ['render: a space text node after the sentence (text check)', set(L_RES, '}{/* CARD-REASONS', '} {/* CARD-REASONS'), guardChecks],
  ['render: the small print is above the message', { [PAGE]: TEXTS[PAGE].replace(`${L_DET}\n`, '').replace('        {message && <Alert>', `${L_DET}\n        {message && <Alert>`) }, guardChecks],
  ['render: the sentence is below the message', { [PAGE]: TEXTS[PAGE].replace(`${L_RES}\n`, '').replace(L_DET, `${L_RES}\n${L_DET}`) }, guardChecks],
  // the page: the base is the base's
  ['page: a base line is rewritten (the message alert)', P('{message && <Alert><AlertDescription>{message}</AlertDescription></Alert>}', '{message && <Alert variant="destructive"><AlertDescription>{message}</AlertDescription></Alert>}'), pageDiffChecks],
  ['page: the base\'s message line gains the small print inside it', P('{message && <Alert><AlertDescription>{message}</AlertDescription></Alert>}', '{message && <Alert><AlertDescription>{message}{listDetail}</AlertDescription></Alert>}'), pageDiffChecks],
  ['page: the base\'s failed-list line is rewritten', P('if (!res.ok) { setMessage(data.error || "Could not load Google Drive."); return }', 'if (!res.ok) { setMessage(data.error || "Could not load your Drive files."); return }'), pageDiffChecks],
  ['page: the base\'s failed-list line is rewritten (the words, run)', P('if (!res.ok) { setMessage(data.error || "Could not load Google Drive."); return }', 'if (!res.ok) { setMessage(data.error || "Could not load your Drive files."); return }'), offChecks],
  ['page: the base\'s network failure words are rewritten (run)', P('catch { setMessage("Could not load Google Drive. Please try again.") }', 'catch { setMessage("Could not load Google Drive.") }'), offChecks],
  ['page: a line is added without the marker', P(`${L_LINE}\n`, `${L_LINE}\n    const unmarked = 1\n`), pageDiffChecks],
  ['page: a line loses its marker', set(L_LINE, ' // CARD-REASONS', ' // card reasons'), pageDiffChecks],
  ['page: a line carries a look-alike marker', set(L_LINE, ' // CARD-REASONS', ' // CARD-REASONS-X'), pageDiffChecks],
  ['page: a third insertion elsewhere is marked', P('  const { toast } = useToast()\n', '  const { toast } = useToast()\n  const cardNote = 1 // CARD-REASONS\n'), pageDiffChecks],
  ['page: the effect differs from the strip\'s pair (the strip cannot put it back)', set(L_LINE, 'const line =', 'const  line ='), pageDiffChecks],
  ['page: the import is gone', P(`${IMPORT_LINE}\n`, ''), pageDiffChecks],
  ['page: the import names a fourth thing', P(IMPORT_LINE, IMPORT_LINE.replace('takeGdriveResultWord }', 'takeGdriveResultWord, x }')), pageDiffChecks],
  ['page: it imports the composer\'s reader', P(`${IMPORT_LINE}\n`, `${IMPORT_LINE}\nimport { takeGdriveReturn } from "@/lib/connectors-gdrive-composer" // CARD-REASONS\n`), guardChecks],
  ['page: it reads the address in an unmarked line', P(`${L_LINE}\n`, `${L_LINE}\n    const where = window.location.href\n`), guardChecks],
  ['page: it touches the address in a second place', P(`${L_LINE}\n`, `${L_LINE}\n    void window.location.hash // CARD-REASONS\n`), guardChecks],
  ['page: the new states come before the base\'s', { [PAGE]: TEXTS[PAGE].replace(`${L_STATE1}\n${L_STATE2}\n`, '').replace(`${L_BASE_STATE}\n`, `${L_STATE1}\n${L_STATE2}\n${L_BASE_STATE}\n`) }, guardChecks],
  ['page: it reads the flag itself', { [PAGE]: `${TEXTS[PAGE]}const y = process.env.${FLAG}\n` }, oneReadChecks],
  // nothing else changed
  ['composer: the marker rule is weakened', { 'lib/connectors-gdrive-composer.ts': swap(TEXTS['lib/connectors-gdrive-composer.ts'], 'queryMarker === cookieMarker', 'true') }, untouchedChecks],
  ['composer: its hook is edited', { 'hooks/use-gdrive-composer.ts': `${TEXTS['hooks/use-gdrive-composer.ts']}// x\n` }, untouchedChecks],
  ['composer: it acts without the marker', { 'hooks/use-gdrive-composer.ts': swap(TEXTS['hooks/use-gdrive-composer.ts'], 'isGenuineReturn(marker, markerFromCookies(window.document.cookie))', 'true') }, untouchedChecks],
  ['routes: the callback is edited', { 'app/api/connectors/gdrive/callback/route.ts': `${TEXTS['app/api/connectors/gdrive/callback/route.ts']}// x\n` }, untouchedChecks],
  ['routes: the server lib is edited', { 'lib/connectors-gdrive-server.ts': `${TEXTS['lib/connectors-gdrive-server.ts']}// x\n` }, untouchedChecks],
  ['routes: the error codes are edited', { 'lib/connectors-gdrive.ts': `${TEXTS['lib/connectors-gdrive.ts']}// x\n` }, untouchedChecks],
  ['sidebar: the settings sidebar is edited', { 'components/settings/settings-sidebar.tsx': `${TEXTS['components/settings/settings-sidebar.tsx']}// x\n` }, untouchedChecks],
  // .env.example
  ['env: the default is edited to "true"', E(`${FLAG}="false"`, `${FLAG}="true"`), envChecks],
  ['env: the block is not last', { [ENV]: `${TEXTS[ENV]}\n# something after\n` }, envChecks],
  ['env: the block is gone', E(`\n${ENV_BLOCK}`, ''), envChecks],
  ['env: the flag is assigned twice', { [ENV]: `${TEXTS[ENV]}${FLAG}="false"\n` }, envChecks],
  ['env: a base line is edited', E('NEXT_PUBLIC_STUDIO_RESEARCH_SWITCH="false"', 'NEXT_PUBLIC_STUDIO_RESEARCH_SWITCH="true"'), envChecks],
  ['env: the cancelled sentence says declined', E('cancelled "Google sign-in was cancelled or not approved."', 'cancelled "Google sign-in was cancelled or declined."'), envChecks],
  ['env: the failed sentence is cut', E(' This is our fault; please try again later."', '"'), envChecks],
  ['env: the block drops the status words', E('otherwise "service error <status>"', 'otherwise nothing'), envChecks],
  ['env: the block drops the CONNECTOR_ rule', E('that starts with CONNECTOR_', 'of any kind'), envChecks],
  ['env: the block does not say unknown values show nothing', E('any other value shows nothing', 'any other value is shown'), envChecks],
  ['env: the block does not say it rides the Drive flag', E('which exists only with NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED on (above)', 'which always exists'), envChecks],
  ['env: the block says the composer changes', E('handling and its one-time marker are not touched.', 'handling and its one-time marker are changed.'), envChecks],
  ['env: the block says the flag is not exact', E('STUDIO CONNECTORS CARD REASONS (KNOWLEDGE-3 for FRONTEND-1). On for the exact value "true"; default off', 'STUDIO CONNECTORS CARD REASONS (KNOWLEDGE-3 for FRONTEND-1). On for any value; default off'), envChecks],
  ['env: the block names another failed-list words', E('("Could not load your Drive files. Please try again.")', '("Could not load Google Drive.")'), envChecks],
  // the older proofs
  ['pin: a taught proof loses its mark', { 'scripts/test-studio-chat-element-edit.mjs': swap(TEXTS['scripts/test-studio-chat-element-edit.mjs'], 'registry read (CARD-REASONS): on a branch', 'registry read: on a branch') }, pinChecks],
  ['pin: a subject splice names another subject too', { 'scripts/test-studio-deck-sync-truth.mjs': TEXTS['scripts/test-studio-deck-sync-truth.mjs'].replace('!/^Card reasons:/.test', '!/^(Card reasons|Research default):/.test') }, pinChecks],
  ['pin: a taught proof loses a base line', { 'scripts/test-studio-chat-element-edit.mjs': swap(TEXTS['scripts/test-studio-chat-element-edit.mjs'], "import { LATER_STRIPS } from './studio-later-changes.mjs'\n", '') }, pinChecks],
  ['pin: a taught proof gains a stray unmarked line', { 'scripts/test-studio-deck-sync-truth.mjs': `${TEXTS['scripts/test-studio-deck-sync-truth.mjs']}// stray\n` }, pinChecks],
  ['pin: a taught proof gains a second splice', { 'scripts/test-studio-chat-element-edit.mjs': `${TEXTS['scripts/test-studio-chat-element-edit.mjs']}shas.splice(0, shas.length) // LATER-CHANGES: registry read (CARD-REASONS)\n` }, pinChecks],
  ['pin: a proof that is dev\'s keeps a line', { 'scripts/test-studio-job-ledger.mjs': `${TEXTS['scripts/test-studio-job-ledger.mjs']}// LATER-CHANGES: registry read (CARD-REASONS)\n` }, pinChecks],
  ['pin: an older Drive proof is edited', { 'scripts/test-studio-connectors-gdrive.mjs': `${TEXTS['scripts/test-studio-connectors-gdrive.mjs']}// x\n` }, pinChecks],
  ['pin: the Research default proof is edited', { 'scripts/test-studio-research-default.mjs': `${TEXTS['scripts/test-studio-research-default.mjs']}// x\n` }, pinChecks],
]
for (const [label, texts, fn] of MUTANTS) await mutant(label, () => fn({ ...TEXTS, ...texts }))
const registryText = TEXTS[REGISTRY]
const ownLine = list => registryText.split('\n').filter(line => line.includes('studio-gdrive-card-reasons-strip.mjs')).find(line => line.includes(list)) + '\n'
const neighbourLine = name => registryText.split('\n').find(line => line.includes('studio-research-default-strip.mjs') && line.includes(name)) + '\n'
await mutant('registry: the files line is gone', () => registryChecks(swap(registryText, ownLine('CARD_REASONS_SCOPE_FILES'), '')))
await mutant('registry: the env line is gone', () => registryChecks(swap(registryText, ownLine('CARD_REASONS_ENV_BLOCK'), '')))
await mutant('registry: the strip line is gone', () => registryChecks(swap(registryText, ownLine('stripCardReasons'), '')))
await mutant('registry: the strip line has no LATER-CHANGE marker', () => registryChecks(swap(registryText, ownLine('stripCardReasons'), ownLine('stripCardReasons').replace('LATER-CHANGE', 'LATER'))))
await mutant('registry: the files line sits before the Research default\'s', () => registryChecks(swap(swap(registryText, ownLine('CARD_REASONS_SCOPE_FILES'), ''), neighbourLine('RESEARCH_DEFAULT_SCOPE_FILES'), ownLine('CARD_REASONS_SCOPE_FILES') + neighbourLine('RESEARCH_DEFAULT_SCOPE_FILES'))))
await mutant('registry: the env line sits before the Research default\'s', () => registryChecks(swap(swap(registryText, ownLine('CARD_REASONS_ENV_BLOCK'), ''), neighbourLine('RESEARCH_DEFAULT_ENV_BLOCK'), ownLine('CARD_REASONS_ENV_BLOCK') + neighbourLine('RESEARCH_DEFAULT_ENV_BLOCK'))))
await mutant('registry: the strip line sits before the Research default\'s', () => registryChecks(swap(swap(registryText, ownLine('stripCardReasons'), ''), neighbourLine('stripResearchDefault'), ownLine('stripCardReasons') + neighbourLine('stripResearchDefault'))))
await mutant('registry: another line is lost', () => registryChecks(swap(registryText, neighbourLine('stripResearchDefault'), '')))
await mutant('registry: the line reads another name', () => registryChecks(swap(registryText, ownLine('CARD_REASONS_ENV_BLOCK'), ownLine('CARD_REASONS_ENV_BLOCK').replace('CARD_REASONS_ENV_BLOCK', 'CARD_REASONS_FLAGS'))))
await mutant('registry: a fourth line', () => registryChecks(swap(registryText, '  // one line per later change, above this comment\n])\n\nexport const LATER_ENV_BLOCKS', `  ...(await import('./studio-gdrive-card-reasons-strip.mjs')).CARD_REASONS_FLAGS, // LATER-CHANGE: KNOWLEDGE-3, the Google Drive card says why: x\n  // one line per later change, above this comment\n])\n\nexport const LATER_ENV_BLOCKS`)))
const STRIP_FILE = 'scripts/studio-gdrive-card-reasons-strip.mjs', STRIP_TEXT = read(STRIP_FILE)
const strippedWith = async (from, to) => import(`data:text/javascript;base64,${Buffer.from(swap(STRIP_TEXT, from, to)).toString('base64')}`) // a mutated copy of the strip module (it imports nothing)
await mutant('strip module: a taught proof is left out of the list', async () => pinChecks(TEXTS, await strippedWith('Object.keys(CARD_REASONS_PIN_EDITS)', 'Object.keys(CARD_REASONS_PIN_EDITS).slice(1)')))
await mutant('strip module: the strip does not put the proofs back', async () => pinChecks(TEXTS, await strippedWith('if (!Object.hasOwn(CARD_REASONS_EDITS, rel) && !Object.hasOwn(CARD_REASONS_PIN_EDITS, rel)) return text', 'if (!Object.hasOwn(CARD_REASONS_EDITS, rel)) return text')))
await mutant('strip module: the page edits are not put back', async () => { const mod = await strippedWith('.reduce((out, [has, was]) => out.replace(has, () => was), text)', '.reduce((out) => out, text)'); assert.equal(mod.stripCardReasons(PAGE, read(PAGE)), baseText(PAGE), 'the strip gives dev\'s page') })
await mutant('strip module: the page edits are put back once only', async () => { const mod = await strippedWith('.reduce((out, [has, was]) => out.replace(has, () => was), text)', '.reduce((out, [has, was], i) => i === 0 ? out.replace(has, () => was) : out, text)'); assert.equal(mod.stripCardReasons(PAGE, read(PAGE)), baseText(PAGE), 'the strip gives dev\'s page') })
await mutant('strip module: a file it does not own is changed', async () => { const mod = await strippedWith('  if (typeof text !== \'string\') return text\n', '  if (typeof text !== \'string\') return text\n  if (rel === \'app/builder/page.tsx\') return text + \'x\'\n'); assert.equal(mod.stripCardReasons('app/builder/page.tsx', 'x\nCARD-REASONS\n'), 'x\nCARD-REASONS\n') })
await mutant('scope: a stray file', () => scopeCheck(allCommits(), ['components/builder/message-list.tsx']))
await mutant('scope: the composer hook', () => scopeCheck(allCommits(), ['hooks/use-gdrive-composer.ts']))
await mutant('scope: the Builder page of another change', () => scopeCheck(allCommits(), ['app/builder/page.tsx']))
await mutant('commit: no co-author line', () => assert.deepEqual(messageProblems(`${SUBJECT} x`, 'a body\n'), []))
await mutant('commit: another co-author', () => assert.deepEqual(messageProblems(`${SUBJECT} x`, 'Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>\n'), []))
await mutant('commit: the co-author line is not last', () => assert.deepEqual(messageProblems(`${SUBJECT} x`, 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n\nmore\n'), []))
await mutant('commit: another subject', () => assert.deepEqual(messageProblems('Fix a thing', 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n'), []))

console.log(`\n${passed} checks passed, ${failed.length} failed; ${caught} mutants caught, ${missed.length} missed`)
if (failed.length || missed.length) { if (failed.length) console.error(`FAILED: ${failed.join('; ')}`); if (missed.length) console.error(`MISSED: ${missed.join('; ')}`); process.exit(1) }
process.exit(0)
