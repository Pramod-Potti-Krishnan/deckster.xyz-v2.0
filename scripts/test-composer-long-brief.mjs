// BASE-J5 (b): long Composer new-topic brief (ask 14) behind NEXT_PUBLIC_COMPOSER_LONG_BRIEF_ENABLED.
// Offline: the upstream (Director) is a fake, no network, no git. Flag-off identity is a digest over the proxy's answers
// and the dialog's rendered tree and validation outcomes, frozen from the base (studio-v4-dev-preparation-code @ 30c9fc9)
// before this change; the composer route, dialog and libs are byte-identical on the base at 83feff5.
//
// Backend facts this pins (Director uat 574b1e0, read-only):
//   stage_template_router.py  `use_fields["brief"]` max_length=LONG_BRIEF_MAX when COMPOSER_LONG_BRIEF_ENABLED, else 4000
//   composer_stage1b.py       DEFAULT_BRIEF_MAX = 4000, LONG_BRIEF_MAX = 16000
//   the `use` route reads `await request.json()`; no body-size middleware (main.py adds only CORS and RestEntitlementGuard)
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const FLAG = 'NEXT_PUBLIC_COMPOSER_LONG_BRIEF_ENABLED'
const BASE_PROXY_DIGEST = '4b2ad278a89fc56d746aaee730b38f46efc1e340a07ad91f6fc009faf722cc58'
const BASE_DIALOG_DIGEST = '4cb044e6ccde0aeb0424c6f5fe4a62a0778f1e1a92e72f04166287d7c5ee8aaa'
const BASE_VALIDATION_DIGEST = 'bd97cbf9d39363b81dca4b7df724c2af6b2b3bdc1093c88817d7b00d266036a7'

function read(relative) { return fs.readFileSync(new URL(relative, import.meta.url), 'utf8') }
function load(relative, context = {}, imports = {}) {
  const output = ts.transpileModule(read(relative), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  vm.runInNewContext(output, {
    module, exports: module.exports, URL, Buffer, AbortSignal, AbortController, DOMException, Error, setTimeout, clearTimeout,
    require: name => { if (!(name in imports)) throw new Error(`Unexpected import ${name}`); return imports[name] },
    ...context,
  })
  return module.exports
}
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
let checks = 0
const check = (fn, ...args) => { checks++; return fn(...args) }
const bytes = text => Buffer.byteLength(text)

// ---- 1. The helper ------------------------------------------------------------------------------------------------
const helperSource = read('../lib/composer-long-brief.ts')
check(assert.equal, /^\s*import\s/m.test(helperSource), false, 'the helper must stay import-free')
const brief = load('../lib/composer-long-brief.ts')
// BASE-J5 (a) adds lib/composer-ditto.ts, imported by the same route and dialog; when it is present (the merged tree) it is loaded for real.
const siblings = fs.existsSync(new URL('../lib/composer-ditto.ts', import.meta.url)) ? { '@/lib/composer-ditto': load('../lib/composer-ditto.ts') } : {}
check(assert.equal, brief.COMPOSER_BRIEF_MIN, 20)
check(assert.equal, brief.COMPOSER_BRIEF_MAX, 4000)
check(assert.equal, brief.COMPOSER_LONG_BRIEF_MAX, 16000, 'Director LONG_BRIEF_MAX')
check(assert.equal, brief.COMPOSER_REFERENCE_MAX_BYTES, 16384)
check(assert.equal, brief.COMPOSER_LONG_BRIEF_MAX_BYTES, 65536)
check(assert.equal, brief.composerBriefMax(false), 4000)
check(assert.equal, brief.composerBriefMax(true), 16000)
check(assert.equal, brief.composerReferenceMaxBytes(true, false), 16384)
check(assert.equal, brief.composerReferenceMaxBytes(false, false), 16384)
check(assert.equal, brief.composerReferenceMaxBytes(true, true), 65536, '`use` grows with the flag')
check(assert.equal, brief.composerReferenceMaxBytes(false, true), 16384, 'upload-reference never grows')
for (const [text, flag, ok] of [
  ['x'.repeat(19), false, false], ['x'.repeat(20), false, true], ['x'.repeat(4000), false, true], ['x'.repeat(4001), false, false],
  ['x'.repeat(16000), false, false], ['x'.repeat(19), true, false], ['x'.repeat(20), true, true], ['x'.repeat(4001), true, true],
  ['x'.repeat(16000), true, true], ['x'.repeat(16001), true, false], [`  ${'x'.repeat(20)}  `, false, true], [`  ${'x'.repeat(19)}  `, true, false],
  [` ${'x'.repeat(16000)} `, true, true], [`${' '.repeat(40)}`, true, false], ['', true, false],
]) check(assert.equal, brief.composerBriefLengthValid(text, flag), ok, `${text.length} chars, flag ${flag}`)
check(assert.equal, brief.composerBriefLimitMessage(false), 'Describe the new presentation in 20 to 4,000 characters.')
check(assert.equal, brief.composerBriefLimitMessage(true), 'Describe the new presentation in 20 to 16,000 characters.')

// The byte arithmetic behind the 65,536 cap: the largest 16,000-unit brief a person can really write, in the JSON the
// dialog sends. (A brief of 16,000 control characters is 96,000 bytes of \u00XX escapes; that one is refused, below.)
const frame = JSON.stringify({ session_id: 'session-1', brief: '' }).length
const realistic = {
  ascii: 'x'.repeat(16000), cjk: '東'.repeat(16000), emoji: '😀'.repeat(8000), quotes: '"'.repeat(16000),
  lines: 'ab\n'.repeat(5332) + 'abcd', backslashes: '\\'.repeat(16000),
}
for (const [name, text] of Object.entries(realistic)) {
  check(assert.ok, text.length <= 16000, name)
  const size = bytes(JSON.stringify({ session_id: 'session-1', brief: text }))
  check(assert.ok, size <= brief.COMPOSER_LONG_BRIEF_MAX_BYTES, `${name} brief fits the cap (${size} bytes)`)
}
check(assert.equal, bytes(JSON.stringify({ session_id: 'session-1', brief: realistic.cjk })), frame + 48000, 'CJK is 3 bytes a unit')
check(assert.ok, frame + 16000 * 3 < brief.COMPOSER_LONG_BRIEF_MAX_BYTES)

// ---- 2. The proxy -------------------------------------------------------------------------------------------------
const host = 'directorv40-uat.up.railway.app'
const serviceUrl = load('../lib/service-url.ts')
const contracts = load('../lib/composer-library.ts')
const env = {}
let upstream = []
let ownedSession = true
const route = load('../app/api/composer-library/[...path]/route.ts', {
  process: { env },
  fetch: async (url, options) => {
    upstream.push({ url, method: options.method, headers: options.headers, body: options.body ?? null, redirect: options.redirect })
    return Response.json({ job_id: 'job-1', status: 'queued' }, { status: 202 })
  },
}, {
  '@/lib/service-url': serviceUrl,
  'next/server': { NextResponse: Response },
  'next-auth': { getServerSession: async () => ({ user: { email: 'owner@example.test' } }) },
  '@/lib/auth-options': { authOptions: {} },
  '@/lib/prisma': { prisma: {
    user: { findUnique: async () => ({ id: 'trusted-user' }) },
    chatSession: { findFirst: async query => ownedSession ? { id: query.where.id } : null },
  } },
  '@/lib/composer-long-brief': brief,
  '@/lib/composer-library': contracts,
  ...siblings,
})
function setEnv(values) {
  for (const key of Object.keys(env)) delete env[key]
  Object.assign(env, { NEXT_PUBLIC_COMPOSER_LIBRARY_ENABLED: 'true', COMPOSER_DIRECTOR_URL: `https://${host}`, COMPOSER_FRONTDOOR_TOKEN: 'unit-test-placeholder' }, values)
}
async function send(method, path, body) {
  upstream = []
  const request = new Request(`http://localhost/api/composer-library/${path.join('/')}`, {
    method, headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  })
  const response = await route[method](request, { params: Promise.resolve({ path }) })
  return { status: response.status, json: await response.json(), upstream }
}
const USE = ['templates', 'template-1', 'use']
const UPLOAD = ['upload-reference']
const text = 'Explain how coastal habitats recover after a major storm.'
const upload = { session_id: 'session-1', researcher_session_id: 'session-1', storage_path: 'session-1/deck.pptx', file_name: 'deck.pptx', kind: 'pptx' }
// A valid JSON document of exactly `size` bytes (trailing whitespace is legal JSON), so the byte caps are probed to the byte.
function padded(value, size) {
  const base = JSON.stringify(value)
  assert(bytes(base) <= size, 'payload larger than the probe size')
  return base + ' '.repeat(size - bytes(base))
}
const withBrief = value => ({ session_id: 'session-1', brief: value })
const cjk = n => '東'.repeat(n)
const emoji = n => '😀'.repeat(n)

const corpus = [
  ['GET', ['templates']], ['GET', ['jobs', 'job-1']], ['GET', ['jobs', '../x']], ['POST', ['upload']],
  ['POST', USE, { session_id: 'session-1' }],
  ['POST', USE, withBrief(text)], ['POST', USE, withBrief(`  ${text}  `)], ['POST', USE, withBrief('Too short')],
  ['POST', USE, withBrief('x'.repeat(19))], ['POST', USE, withBrief('x'.repeat(20))],
  ['POST', USE, withBrief('x'.repeat(4000))], ['POST', USE, withBrief('x'.repeat(4001))],
  ['POST', USE, withBrief(`  ${'x'.repeat(4000)}  `)], ['POST', USE, withBrief(`  ${'x'.repeat(4001)}  `)],
  ['POST', USE, withBrief('x'.repeat(16000))], ['POST', USE, withBrief('x'.repeat(16001))],
  ['POST', USE, withBrief(cjk(4000))], ['POST', USE, withBrief(cjk(4001))], ['POST', USE, withBrief(cjk(5461))], ['POST', USE, withBrief(cjk(16000))],
  ['POST', USE, withBrief(emoji(2000))], ['POST', USE, withBrief(emoji(2001))], ['POST', USE, withBrief(emoji(8000))], ['POST', USE, withBrief(emoji(8001))],
  ['POST', USE, withBrief('"'.repeat(4000))], ['POST', USE, withBrief('"'.repeat(16000))], ['POST', USE, withBrief('\u0001'.repeat(3000))], ['POST', USE, withBrief('\u0001'.repeat(16000))],
  ['POST', USE, withBrief(7)], ['POST', USE, withBrief('')], ['POST', USE, withBrief(null)],
  ['POST', USE, { session_id: 'session-1', user_id: 'attacker' }], ['POST', USE, { session_id: 'session-1', brief: text, user_id: 'attacker' }],
  ['POST', USE, { session_id: 'session-1', mode: 'ditto' }],
  ['POST', USE, { session_id: '../escape', brief: text }], ['POST', USE, { brief: text }],
  ['POST', USE, {}], ['POST', USE, []], ['POST', USE, null], ['POST', USE, '{not json'],
  ['POST', USE, padded({ session_id: 'session-1' }, 16384)], ['POST', USE, padded({ session_id: 'session-1' }, 16385)],
  ['POST', USE, padded({ session_id: 'session-1' }, 32768)], ['POST', USE, padded({ session_id: 'session-1' }, 65536)], ['POST', USE, padded({ session_id: 'session-1' }, 65537)],
  ['POST', USE, padded(withBrief(text), 16384)], ['POST', USE, padded(withBrief(text), 16385)], ['POST', USE, padded(withBrief(text), 65536)], ['POST', USE, padded(withBrief(text), 65537)],
  ['POST', USE, 'x'.repeat(16385)], ['POST', USE, 'x'.repeat(70000)],
  ['POST', UPLOAD, upload], ['POST', UPLOAD, { ...upload, brief: text }], ['POST', UPLOAD, { ...upload, storage_path: 'other/deck.pptx' }],
  ['POST', UPLOAD, padded(upload, 16384)], ['POST', UPLOAD, padded(upload, 16385)], ['POST', UPLOAD, padded(upload, 65536)], ['POST', UPLOAD, padded(upload, 65537)],
  ['POST', UPLOAD, 'file-bytes'], ['POST', ['templates', 'template-1'], withBrief(text)], ['GET', USE],
]
// Flag off, in every spelling that is not the literal "true": byte-identical to the base.
let proxyDigest
for (const value of [undefined, 'false', '', '1', 'TRUE', 'True', ' true', 'true ']) {
  const results = []
  for (const newTopic of [undefined, 'true']) {
    for (const [method, path, body] of corpus) {
      setEnv({ ...(value === undefined ? {} : { [FLAG]: value }), ...(newTopic ? { NEXT_PUBLIC_COMPOSER_STAGE1B_NEW_TOPIC_ENABLED: newTopic } : {}) })
      results.push(await send(method, path, body))
    }
  }
  proxyDigest ??= digest(results)
  check(assert.equal, digest(results), proxyDigest, `flag ${JSON.stringify(value)} must answer exactly as flag unset`)
}
console.log(`flag-off proxy digest: ${proxyDigest} (${corpus.length * 2} requests)`)
check(assert.equal, proxyDigest, BASE_PROXY_DIGEST, 'flag-off proxy answers must equal the base')

// Flag off: today's limits, stated outright.
setEnv({ NEXT_PUBLIC_COMPOSER_STAGE1B_NEW_TOPIC_ENABLED: 'true' })
check(assert.equal, (await send('POST', USE, withBrief('x'.repeat(4000)))).status, 202)
check(assert.equal, (await send('POST', USE, withBrief('x'.repeat(4001)))).status, 400)
check(assert.equal, (await send('POST', USE, withBrief('x'.repeat(16000)))).status, 400)
check(assert.equal, (await send('POST', USE, padded({ session_id: 'session-1' }, 16384))).status, 202)
check(assert.equal, (await send('POST', USE, padded({ session_id: 'session-1' }, 16385))).status, 413)
check(assert.equal, (await send('POST', USE, withBrief(cjk(5461)))).status, 413, 'a 16,383-byte CJK brief plus the frame is over the 16,384 cap')

// Flag on: a brief of up to 16,000 characters is forwarded, trimmed, exactly as {session_id, brief}.
const on = { [FLAG]: 'true', NEXT_PUBLIC_COMPOSER_STAGE1B_NEW_TOPIC_ENABLED: 'true' }
setEnv(on)
for (const value of ['x'.repeat(4001), 'x'.repeat(16000), cjk(16000), emoji(8000), '"'.repeat(16000), 'ab\n'.repeat(5332) + 'abcd', '\\'.repeat(16000)]) {
  const result = await send('POST', USE, withBrief(`  ${value}  `))
  check(assert.equal, result.status, 202, `${value.length} units`)
  check(assert.equal, result.upstream.length, 1)
  check(assert.equal, result.upstream[0].url, `https://${host}/api/template-ingest/stage/templates/template-1/use`)
  check(assert.equal, result.upstream[0].body, JSON.stringify({ session_id: 'session-1', brief: value.trim() }))
  check(assert.equal, result.upstream[0].headers['X-Composer-User-Id'], 'trusted-user')
  check(assert.equal, result.upstream[0].headers.Authorization, 'Bearer unit-test-placeholder')
  check(assert.equal, result.upstream[0].redirect, 'error')
}
const cjkBody = JSON.stringify(withBrief(cjk(16000)))
check(assert.ok, bytes(cjkBody) > 32768 && bytes(cjkBody) < 65536, `a 16,000-character CJK brief is ${bytes(cjkBody)} bytes: over 32,768, inside the cap`)
// ...but not a character more (the limit is Director's own), and still not below 20 or a non-string.
for (const value of ['x'.repeat(16001), cjk(16001), emoji(8001), `  ${'x'.repeat(16001)}  `, 'x'.repeat(19), '', '     ', null, 7, ['x'.repeat(30)]]) {
  const result = await send('POST', USE, withBrief(value))
  check(assert.equal, result.status, 400, `brief ${JSON.stringify(value)?.slice(0, 24)}`)
  check(assert.equal, result.json.error, 'Invalid template library reference.')
  check(assert.equal, result.upstream.length, 0)
}
// The body cap on `use` is 65,536 bytes: exact at the edge, 413 one byte over, nothing forwarded.
check(assert.equal, bytes(padded({ session_id: 'session-1' }, 65536)), 65536)
check(assert.equal, (await send('POST', USE, padded({ session_id: 'session-1' }, 65536))).status, 202)
check(assert.equal, (await send('POST', USE, padded(withBrief(text), 65536))).status, 202)
for (const body of [padded({ session_id: 'session-1' }, 65537), padded(withBrief(text), 65537), 'x'.repeat(70000)]) {
  const over = await send('POST', USE, body)
  check(assert.equal, over.status, 413)
  check(assert.equal, over.json.error, 'Reference is too large.')
  check(assert.equal, over.upstream.length, 0)
}
// A 16,000-control-character brief is 96,000 bytes of \u00XX escapes: inside the character limit, outside the byte cap.
const escaped = await send('POST', USE, withBrief('\u0001'.repeat(16000)))
check(assert.equal, escaped.status, 413)
check(assert.equal, escaped.upstream.length, 0)
// `upload-reference` keeps its 16,384-byte storage reference; only `use` grew.
check(assert.equal, (await send('POST', UPLOAD, padded(upload, 16384))).status, 202)
for (const size of [16385, 32768, 65536, 65537]) {
  const result = await send('POST', UPLOAD, padded(upload, size))
  check(assert.equal, result.status, 413, `upload-reference at ${size} bytes`)
  check(assert.equal, result.upstream.length, 0)
}
check(assert.equal, (await send('POST', UPLOAD, { ...upload, brief: text })).status, 400, 'upload-reference never takes a brief')
// The rest of the `use` contract is unchanged by the flag: keys, ids, ownership, the new-topic gate, other routes.
check(assert.equal, (await send('POST', USE, { session_id: 'session-1', brief: text, user_id: 'attacker' })).status, 400)
check(assert.equal, (await send('POST', USE, { session_id: 'session-1', mode: 'ditto' })).status, 400, 'mode stays refused without its own flag')
check(assert.equal, (await send('POST', USE, { session_id: '../escape', brief: text })).status, 400)
check(assert.equal, (await send('POST', USE, { brief: text })).status, 400)
check(assert.equal, (await send('POST', USE, '{not json')).status, 400)
check(assert.equal, (await send('POST', ['templates', 'template-1'], withBrief(text))).status, 404)
check(assert.equal, (await send('GET', USE)).status, 404)
ownedSession = false
const foreign = await send('POST', USE, withBrief('x'.repeat(16000)))
check(assert.equal, foreign.status, 404)
check(assert.equal, foreign.upstream.length, 0)
ownedSession = true
// New-topic still needs its own flag, long brief or not.
setEnv({ [FLAG]: 'true' })
const gated = await send('POST', USE, withBrief('x'.repeat(16000)))
check(assert.equal, gated.status, 404)
check(assert.equal, gated.json.error, 'New-topic templates are not enabled.')
check(assert.equal, gated.upstream.length, 0)
check(assert.equal, (await send('POST', USE, { session_id: 'session-1' })).status, 202, 'a plain use is unaffected')
// Flag on changes nothing for any request that fits today's limits: same status and same forwarded body as flag off.
const fitsToday = ([, , body]) => {
  if (body === undefined) return true
  if (typeof body === 'string') return bytes(body) <= 16384
  const length = typeof body?.brief === 'string' ? body.brief.trim().length : 0
  return bytes(JSON.stringify(body)) <= 16384 && length <= 4000
}
let compared = 0
for (const entry of corpus.filter(fitsToday)) {
  const [method, path, body] = entry
  setEnv({ NEXT_PUBLIC_COMPOSER_STAGE1B_NEW_TOPIC_ENABLED: 'true' })
  const off = await send(method, path, body)
  setEnv(on)
  check(assert.equal, digest(await send(method, path, body)), digest(off), `${method} ${path.join('/')} within today's limits`)
  compared++
}
check(assert.ok, compared > 35, `compared ${compared} requests`)

// ---- 3. The dialog ------------------------------------------------------------------------------------------------
const dialogSource = read('../components/builder/composer-library-dialog.tsx')
const templates = [
  { id: 'supplied-one', name: 'A very long supplied template name '.repeat(5), slide_count: 4, stage_template_summary: { slide_count: 6 } },
  { id: 'supplied-two', name: 'Legacy slide count', slide_count: 8 },
  { id: 'supplied-three', name: 'No supplied count' },
]
const node = (type, props) => ({ type, props: props || {} })
function mountDialog({ studio, topic, longFlag, auth = true, layoutUrl = 'http://127.0.0.1:8531', initial, mocks = {} }) {
  const state = [...initial], exports = {}; let cursor = 0
  const proxy = new Proxy({}, { get: (_target, key) => key })
  vm.runInNewContext(ts.transpileModule(dialogSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText, {
    exports, module: { exports }, URL, AbortController, DOMException, Error, console,
    process: { env: {
      ...(studio === undefined ? {} : { NEXT_PUBLIC_STUDIO_V4_SHELL: studio }),
      ...(topic === undefined ? {} : { NEXT_PUBLIC_COMPOSER_STAGE1B_NEW_TOPIC_ENABLED: topic }),
      ...(longFlag === undefined ? {} : { [FLAG]: longFlag }),
      ...(layoutUrl === null ? {} : { NEXT_PUBLIC_LAYOUT_SERVICE_URL: layoutUrl }),
    } },
    ...(mocks.globals || {}),
    require(id) {
      if (id === 'react') return {
        useState(init) { const i = cursor++; if (!(i in state)) state[i] = typeof init === 'function' ? init() : init; return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value }] },
        useRef(value) { return { current: value } }, useCallback(fn) { return fn }, useEffect() {},
      }
      if (id === 'react/jsx-runtime') return { jsx: node, jsxs: node, Fragment: 'Fragment' }
      if (id === '@/hooks/use-auth') return { useAuth: () => ({ user: auth ? { id: 'local-owner' } : null }) }
      if (id === '@/hooks/use-chat-sessions') return { useChatSessions: () => ({ createSession: mocks.createSession || (async () => { throw new Error('No session creation allowed') }) }) }
      if (id === '@/lib/composer-library') return mocks.composerLibrary || { validateComposerFile: () => null, composerRequest() { throw new Error('No service allowed') }, waitForComposerJob() { throw new Error('No jobs allowed') }, requireComposerServiceUrl() { throw new Error('No service configuration allowed') } }
      if (id === '@/lib/composer-long-brief') return brief
      if (id in siblings) return siblings[id]
      if (id === '@/lib/researcher-upload') return { uploadFileToResearcher() { throw new Error('No upload allowed') } }
      if (id === '@/lib/layout-viewer-url-policy') return { evaluateLayoutViewerUrl: () => ({ status: 'allowed' }) }
      if (id === '@/lib/layout-service-client') return { LAYOUT_VIEWER_URL_POLICY: {} }
      if (id.endsWith('.css')) return {}
      if (id.startsWith('@/') || id === 'lucide-react') return proxy
      throw new Error(`Unexpected dependency ${id}`)
    },
  })
  return { state, render: () => { cursor = 0; return exports.ComposerLibraryDialog({ open: true, onOpenChange() {} }) } }
}
function all(tree, predicate, found = []) {
  if (!tree || typeof tree !== 'object') return found
  if (Array.isArray(tree)) { tree.forEach(value => all(value, predicate, found)); return found }
  if (predicate(tree)) found.push(tree)
  all(tree.props.children, predicate, found)
  return found
}
function visible(tree) { return tree == null || typeof tree === 'boolean' ? '' : typeof tree !== 'object' ? String(tree) : Array.isArray(tree) ? tree.map(visible).join(' ') : visible(tree.props.children) }
function canonical(tree) {
  if (tree == null || typeof tree === 'boolean') return []
  if (typeof tree !== 'object') return [String(tree)]
  if (Array.isArray(tree)) return tree.flatMap(canonical)
  if (tree.type === 'Fragment') return canonical(tree.props.children)
  const props = Object.fromEntries(Object.entries(tree.props).filter(([key, value]) => key !== 'children' && value !== undefined).map(([key, value]) => [key, typeof value === 'function' ? '[fn]' : value]))
  return [{ type: tree.type, props, children: canonical(tree.props.children) }]
}
// templates, loading, busy, progress, error, file, newBrief, newTopicTemplateId
const stateFor = (busy, draft = 'A meaningful local presentation brief') => [templates, false, busy, 'Supplied preparing status', 'Supplied failed-read detail', { name: 'valid.pptx', size: 1024 }, draft, 'supplied-one']
const rendered = options => mountDialog({ ...options, initial: stateFor(options.busy ?? false, options.draft) }).render()
const textareas = tree => all(tree, item => item.props.id === 'composer-new-brief')

// Flag off, in every spelling that is not the literal "true": the rendered tree is the base's, state for state.
let dialogDigest
for (const value of [undefined, 'false', '', '1', 'TRUE', ' true']) {
  const trees = []
  for (const studio of ['true', 'false', undefined]) for (const topic of ['true', 'false']) for (const auth of [true, false]) for (const busy of [true, false]) {
    const tree = rendered({ studio, topic, longFlag: value, auth, busy })
    check(assert.equal, JSON.stringify(canonical(tree)).includes('16,000'), false)
    trees.push(canonical(tree))
  }
  dialogDigest ??= digest(trees)
  check(assert.equal, digest(trees), dialogDigest, `flag ${JSON.stringify(value)} must render exactly as flag unset`)
}
console.log(`flag-off dialog digest: ${dialogDigest} (24 states)`)
check(assert.equal, dialogDigest, BASE_DIALOG_DIGEST, 'flag-off dialog markup must equal the base')

// Flag on: the same tree except the one prop. Every state, flag-off tree with maxLength 4000 swapped for 16000.
for (const studio of ['true', 'false', undefined]) for (const topic of ['true', 'false']) for (const auth of [true, false]) for (const busy of [true, false]) {
  const off = canonical(rendered({ studio, topic, longFlag: undefined, auth, busy }))
  const tree = rendered({ studio, topic, longFlag: 'true', auth, busy })
  const fields = textareas(tree)
  check(assert.equal, fields.length, topic === 'true' ? 1 : 0)
  for (const field of fields) check(assert.equal, field.props.maxLength, 16000)
  for (const field of textareas(rendered({ studio, topic, longFlag: undefined, auth, busy }))) check(assert.equal, field.props.maxLength, 4000)
  check(assert.equal, JSON.stringify(canonical(tree)).replace('"maxLength":16000', '"maxLength":4000'), JSON.stringify(off))
}

// The click flow: what "Create deck" sends and shows for a given draft.
async function createFlow(draft, { longFlag, auth = true, busy = false, createOk = true } = {}) {
  const calls = [], sessions = [], assigned = [], store = new Map()
  const job = { job_id: 'stage-use-run-1', status: 'complete', operation: 'stage_template_new_topic',
    checkpoint: { result: { session_id: 'fresh-session-0001', template_id: 'supplied-one', presentation_id: 'deck-9', viewer_url: 'http://127.0.0.1:8531/p/deck-9', slide_count: 6 } } }
  const lib = load('../lib/composer-library.ts', {
    fetch: async (url, options = {}) => {
      calls.push({ url, method: options.method || 'GET', body: options.body ?? null })
      if (options.method === 'POST') return Response.json({ job_id: 'stage-use-run-1', status: 'queued' }, { status: 202 })
      return Response.json(job)
    },
    setTimeout: callback => { queueMicrotask(callback); return 1 }, clearTimeout: () => {},
  })
  const mounted = mountDialog({ studio: 'true', topic: 'true', longFlag, auth, initial: stateFor(busy, draft), mocks: {
    composerLibrary: lib,
    createSession: async (...args) => { sessions.push(args); return createOk },
    globals: {
      crypto: { randomUUID: () => 'fresh-session-0001' },
      sessionStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) },
      window: { location: { assign: url => assigned.push(url) } },
    },
  } })
  const tree = mounted.render()
  const create = all(tree, item => item.type === 'Button' && visible(item) === 'Create deck')[0]
  create.props.onClick()
  for (let turn = 0; turn < 50; turn++) await new Promise(resolve => setImmediate(resolve))
  return { calls, sessions, assigned, error: mounted.state[4], progress: mounted.state[3] }
}
const drafts = [
  'x'.repeat(19), 'x'.repeat(20), `  ${'x'.repeat(19)}  `, `  ${'x'.repeat(20)}  `, 'x'.repeat(4000), 'x'.repeat(4001), `  ${'x'.repeat(4000)}  `, `  ${'x'.repeat(4001)}  `,
  'x'.repeat(16000), 'x'.repeat(16001), cjk(4000), cjk(4001), cjk(16000), emoji(2000), emoji(2001), emoji(8000), emoji(8001), '', '                         ',
]
// Flag off, in every spelling that is not the literal "true": same error text, same requests, same sessions as the base.
let validationDigest
for (const value of [undefined, 'false', '', '1', 'TRUE', ' true']) {
  const results = []
  for (const draft of drafts) results.push(await createFlow(draft, { longFlag: value }))
  validationDigest ??= digest(results)
  check(assert.equal, digest(results), validationDigest, `flag ${JSON.stringify(value)} must validate exactly as flag unset`)
}
console.log(`flag-off validation digest: ${validationDigest} (${drafts.length} drafts)`)
check(assert.equal, validationDigest, BASE_VALIDATION_DIGEST, 'flag-off dialog validation must equal the base')
// ...stated outright.
const tooLongOff = await createFlow('x'.repeat(4001), {})
check(assert.equal, tooLongOff.error, 'Describe the new presentation in 20 to 4,000 characters.')
check(assert.equal, tooLongOff.calls.length + tooLongOff.sessions.length + tooLongOff.assigned.length, 0)
const sixteenOff = await createFlow('x'.repeat(16000), {})
check(assert.equal, sixteenOff.error, 'Describe the new presentation in 20 to 4,000 characters.')
check(assert.equal, sixteenOff.calls.length, 0)
const edgeOff = await createFlow(`  ${'x'.repeat(4000)}  `, {})
check(assert.equal, edgeOff.error, null)
check(assert.equal, edgeOff.calls[0].body, JSON.stringify({ session_id: 'fresh-session-0001', brief: 'x'.repeat(4000) }))

// Flag on: 16,000 characters go through as the trimmed brief; one more is refused with the 16,000 copy and no request.
for (const draft of ['x'.repeat(4001), 'x'.repeat(16000), `  ${'x'.repeat(16000)}  `, cjk(16000), emoji(8000)]) {
  const sent = await createFlow(draft, { longFlag: 'true' })
  check(assert.equal, sent.error, null, `${draft.length} units`)
  check(assert.deepEqual, sent.sessions, [['fresh-session-0001', `New topic: ${draft.trim().slice(0, 80)}`]])
  check(assert.deepEqual, sent.calls.map(call => `${call.method} ${call.url}`),
    ['POST /api/composer-library/templates/supplied-one/use', 'GET /api/composer-library/jobs/stage-use-run-1'])
  check(assert.equal, sent.calls[0].body, JSON.stringify({ session_id: 'fresh-session-0001', brief: draft.trim() }))
  check(assert.deepEqual, sent.assigned, ['/builder?session_id=fresh-session-0001'])
}
for (const draft of ['x'.repeat(16001), `  ${'x'.repeat(16001)}  `, cjk(16001), emoji(8001), 'x'.repeat(19), '', '                         ']) {
  const refused = await createFlow(draft, { longFlag: 'true' })
  check(assert.equal, refused.error, 'Describe the new presentation in 20 to 16,000 characters.', `${draft.length} units`)
  check(assert.equal, refused.calls.length + refused.sessions.length + refused.assigned.length, 0)
}
// The guards are the base's: signed out or busy sends nothing; a failed session create stops before the request.
for (const options of [{ auth: false }, { busy: true }]) {
  const blocked = await createFlow('x'.repeat(16000), { longFlag: 'true', ...options })
  check(assert.equal, blocked.calls.length + blocked.sessions.length + blocked.assigned.length, 0)
}
const noSession = await createFlow('x'.repeat(16000), { longFlag: 'true', createOk: false })
check(assert.equal, noSession.calls.length, 0)
check(assert.equal, noSession.error, 'Could not create the deck session.')
// The textarea itself caps at the active limit.
check(assert.equal, textareas(rendered({ studio: 'true', topic: 'true', longFlag: undefined }))[0].props.maxLength, 4000)
check(assert.equal, textareas(rendered({ studio: 'true', topic: 'true', longFlag: 'true' }))[0].props.maxLength, 16000)

// ---- 4. Flag registry and wiring ----------------------------------------------------------------------------------
const envExample = read('../.env.example')
check(assert.equal, envExample.split('\n').filter(line => line.startsWith(`${FLAG}=`)).join(), `${FLAG}="false"`)
const pkg = JSON.parse(read('../package.json'))
check(assert.equal, pkg.scripts['test:composer-long-brief'], 'node scripts/test-composer-long-brief.mjs')
const scriptNames = Object.keys(pkg.scripts)
check(assert.equal, scriptNames[scriptNames.indexOf('test:theme-sync') + 1], 'test:composer-long-brief', 'anchored after test:theme-sync')
check(assert.notEqual, scriptNames.indexOf('test:composer-long-brief'), scriptNames.length - 1, 'not the last script line (merge-conflict anchor)')
const routeSource = read('../app/api/composer-library/[...path]/route.ts')
for (const [name, source] of [['route', routeSource], ['dialog', dialogSource]]) {
  check(assert.equal, source.split(`process.env.${FLAG} === 'true'`).length - 1, 1, `${name} reads the flag once as the literal "true"`)
}
check(assert.equal, /16384|16_384/.test(routeSource), false, 'the byte cap lives in the helper, not the route')
check(assert.equal, /\b4000\b|\b16000\b/.test(routeSource + dialogSource), false, 'the brief limits live in the helper, not the route or the dialog')
console.log(`Composer long brief: ${checks} checks passed (helper, flag-off proxy and dialog identity, flag-on limits and byte cap, dialog click flow, flag registry).`)
