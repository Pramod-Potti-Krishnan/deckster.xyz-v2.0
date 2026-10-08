// BASE-J5 (a): Composer "Rebuild from own content" (ditto, Stage 1B gate G3) behind
// NEXT_PUBLIC_COMPOSER_STAGE1B_DITTO_ENABLED. Offline: the upstream (Director) is a fake, no network, no git.
// Flag-off identity is a digest over the proxy's answers and the dialog's rendered tree, frozen from the base
// (studio-v4-dev-preparation-code @ bb26903) before this change.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const FLAG = 'NEXT_PUBLIC_COMPOSER_STAGE1B_DITTO_ENABLED'
const BASE_PROXY_DIGEST = 'c3d06565066e9574018f789e6c79f11cb7af164d8c577a4d6bf3f594cb3d229b'
const BASE_DIALOG_DIGEST = '4cb044e6ccde0aeb0424c6f5fe4a62a0778f1e1a92e72f04166287d7c5ee8aaa'

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

// ---- 1. The helper ------------------------------------------------------------------------------------------------
const helperSource = read('../lib/composer-ditto.ts')
check(assert.equal, /^\s*import\s/m.test(helperSource), false, 'the helper must stay import-free')
const ditto = load('../lib/composer-ditto.ts')
check(assert.equal, ditto.COMPOSER_DITTO_MODE, 'ditto')
check(assert.deepEqual, [...ditto.composerUseKeys(false)], ['session_id', 'brief'])
check(assert.deepEqual, [...ditto.composerUseKeys(true)], ['session_id', 'brief', 'mode'])
check(assert.equal, ditto.composerUseModeAllowed({}), true)
check(assert.equal, ditto.composerUseModeAllowed({ brief: 'x' }), true)
check(assert.equal, ditto.composerUseModeAllowed({ mode: 'ditto' }), true)
for (const bad of ['Ditto', 'DITTO', ' ditto', 'ditto ', '', 'new-topic', null, 1, true, ['ditto'], { mode: 'ditto' }]) {
  check(assert.equal, ditto.composerUseModeAllowed({ mode: bad }), false, `mode ${JSON.stringify(bad)}`)
}
for (const brief of ['a brief long enough to count', '', null, 0]) {
  check(assert.equal, ditto.composerUseModeAllowed({ mode: 'ditto', brief }), false, 'mode together with a brief')
}

// ---- 2. The proxy -------------------------------------------------------------------------------------------------
const host = 'directorv40-uat.up.railway.app'
const serviceUrl = load('../lib/service-url.ts')
const contracts = load('../lib/composer-library.ts')
const env = {}
let upstream = []
// The long-brief change (flag NEXT_PUBLIC_COMPOSER_LONG_BRIEF_ENABLED) adds lib/composer-long-brief.ts and imports it in the
// route and the dialog; map it when that file is present so this test passes with and without it.
const longBriefImports = fs.existsSync(new URL('../lib/composer-long-brief.ts', import.meta.url))
  ? { '@/lib/composer-long-brief': load('../lib/composer-long-brief.ts') } : {}
let ownedSession = true
let ownerQuery = null
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
    chatSession: { findFirst: async query => { ownerQuery = query; return ownedSession ? { id: query.where.id } : null } },
  } },
  '@/lib/composer-library': contracts,
  '@/lib/composer-ditto': ditto,
  ...longBriefImports,
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
const brief = 'Explain how coastal habitats recover after a major storm.'
const upload = { session_id: 'session-1', researcher_session_id: 'session-1', storage_path: 'session-1/deck.pptx', file_name: 'deck.pptx', kind: 'pptx' }
const exact16384 = (() => {
  const head = '{"session_id":"session-1","brief":"'; const tail = '"}'
  return head + 'x'.repeat(16384 - head.length - tail.length) + tail
})()
assert.equal(Buffer.byteLength(exact16384), 16384)

// Every request shape the proxy has to answer, including the ones that mention `mode` (refused at the base).
const corpus = [
  ['GET', ['templates']], ['GET', ['jobs', 'job-1']], ['GET', ['jobs', '../x']], ['POST', ['upload']],
  ['POST', USE, { session_id: 'session-1' }],
  ['POST', USE, { session_id: 'session-1', brief }],
  ['POST', USE, { session_id: 'session-1', brief: `  ${brief}  ` }],
  ['POST', USE, { session_id: 'session-1', brief: 'Too short' }],
  ['POST', USE, { session_id: 'session-1', brief: 'x'.repeat(4000) }],
  ['POST', USE, { session_id: 'session-1', brief: 'x'.repeat(4001) }],
  ['POST', USE, { session_id: 'session-1', brief: 7 }],
  ['POST', USE, { session_id: 'session-1', user_id: 'attacker' }],
  ['POST', USE, { session_id: 'session-1', mode: 'ditto' }],
  ['POST', USE, { session_id: 'session-1', mode: 'ditto', brief }],
  ['POST', USE, { session_id: 'session-1', mode: 'ditto', brief: '' }],
  ['POST', USE, { session_id: 'session-1', mode: 'new-topic' }],
  ['POST', USE, { session_id: 'session-1', mode: null }],
  ['POST', USE, { session_id: 'session-1', mode: ['ditto'] }],
  ['POST', USE, { session_id: 'session-1', mode: 'ditto', user_id: 'attacker' }],
  ['POST', USE, { session_id: '../escape', mode: 'ditto' }],
  ['POST', USE, { mode: 'ditto' }],
  ['POST', USE, {}], ['POST', USE, []], ['POST', USE, null], ['POST', USE, '{not json'],
  ['POST', USE, exact16384], ['POST', USE, 'x'.repeat(16385)],
  ['POST', ['upload-reference'], upload],
  ['POST', ['upload-reference'], { ...upload, mode: 'ditto' }],
  ['POST', ['upload-reference'], { ...upload, storage_path: 'other/deck.pptx' }],
  ['POST', ['templates', 'template-1'], { session_id: 'session-1', mode: 'ditto' }],
  ['POST', ['templates', 'template-1', 'extra', 'use'], { session_id: 'session-1', mode: 'ditto' }],
  ['GET', USE],
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

// Flag off: `mode` never reaches Director.
setEnv({})
for (const mode of ['ditto', 'new-topic', null]) {
  const result = await send('POST', USE, { session_id: 'session-1', mode })
  check(assert.equal, result.status, 400)
  check(assert.equal, result.json.error, 'Invalid template library reference.')
  check(assert.equal, result.upstream.length, 0)
}

// Flag on: ditto is forwarded as exactly {session_id, mode}.
setEnv({ [FLAG]: 'true' })
const accepted = await send('POST', USE, { session_id: 'session-1', mode: 'ditto' })
check(assert.equal, accepted.status, 202)
check(assert.equal, accepted.upstream.length, 1)
check(assert.equal, accepted.upstream[0].url, `https://${host}/api/template-ingest/stage/templates/template-1/use`)
check(assert.equal, accepted.upstream[0].method, 'POST')
check(assert.equal, accepted.upstream[0].body, '{"session_id":"session-1","mode":"ditto"}')
check(assert.equal, accepted.upstream[0].headers['X-Composer-User-Id'], 'trusted-user')
check(assert.equal, accepted.upstream[0].headers.Authorization, 'Bearer unit-test-placeholder')
check(assert.equal, accepted.upstream[0].redirect, 'error')
// The session must belong to the signed-in account (and not be deleted) before anything is forwarded.
check(assert.equal, JSON.stringify(ownerQuery), '{"where":{"id":"session-1","userId":"trusted-user","status":{"not":"deleted"}},"select":{"id":true}}')
// ...with or without the new-topic flag, which is unrelated.
setEnv({ [FLAG]: 'true', NEXT_PUBLIC_COMPOSER_STAGE1B_NEW_TOPIC_ENABLED: 'true' })
check(assert.equal, (await send('POST', USE, { session_id: 'session-1', mode: 'ditto' })).upstream[0].body, '{"session_id":"session-1","mode":"ditto"}')

// Flag on: only the literal "ditto", never with a brief (the brief is 400 even when new-topic is off or on).
for (const topic of [undefined, 'true']) {
  setEnv({ [FLAG]: 'true', ...(topic ? { NEXT_PUBLIC_COMPOSER_STAGE1B_NEW_TOPIC_ENABLED: topic } : {}) })
  for (const mode of ['Ditto', 'DITTO', ' ditto', 'ditto ', '', 'new-topic', 'use', null, 1, true, ['ditto'], { mode: 'ditto' }]) {
    const result = await send('POST', USE, { session_id: 'session-1', mode })
    check(assert.equal, result.status, 400, `mode ${JSON.stringify(mode)}`)
    check(assert.equal, result.upstream.length, 0)
  }
  for (const withBrief of [brief, '', 'Too short', 'x'.repeat(4001), null, 7]) {
    const result = await send('POST', USE, { session_id: 'session-1', mode: 'ditto', brief: withBrief })
    check(assert.equal, result.status, 400, `mode with brief ${JSON.stringify(withBrief)?.slice(0, 20)}`)
    check(assert.equal, result.json.error, 'Invalid template library reference.')
    check(assert.equal, result.upstream.length, 0)
  }
  // Other keys stay refused next to mode; the owner and id checks still run.
  check(assert.equal, (await send('POST', USE, { session_id: 'session-1', mode: 'ditto', user_id: 'attacker' })).status, 400)
  check(assert.equal, (await send('POST', USE, { session_id: '../escape', mode: 'ditto' })).status, 400)
  check(assert.equal, (await send('POST', USE, { mode: 'ditto' })).status, 400)
  ownedSession = false
  const foreign = await send('POST', USE, { session_id: 'other-users-session', mode: 'ditto' })
  check(assert.equal, foreign.status, 404)
  check(assert.equal, foreign.upstream.length, 0)
  ownedSession = true
}
// Flag on: `mode` is for `use` only.
setEnv({ [FLAG]: 'true' })
check(assert.equal, (await send('POST', ['upload-reference'], { ...upload, mode: 'ditto' })).status, 400)
check(assert.equal, (await send('POST', ['templates', 'template-1'], { session_id: 'session-1', mode: 'ditto' })).status, 404)
check(assert.equal, (await send('GET', USE)).status, 404)
// Flag on changes nothing for the plain and new-topic bodies: same status and same forwarded body as flag off.
for (const topic of [undefined, 'true']) {
  for (const body of [{ session_id: 'session-1' }, { session_id: 'session-1', brief }, { session_id: 'session-1', brief: 'Too short' }]) {
    setEnv(topic ? { NEXT_PUBLIC_COMPOSER_STAGE1B_NEW_TOPIC_ENABLED: topic } : {})
    const off = await send('POST', USE, body)
    setEnv({ [FLAG]: 'true', ...(topic ? { NEXT_PUBLIC_COMPOSER_STAGE1B_NEW_TOPIC_ENABLED: topic } : {}) })
    const on = await send('POST', USE, body)
    check(assert.equal, digest(on), digest(off))
  }
}

// ---- 3. The dialog ------------------------------------------------------------------------------------------------
const dialogSource = read('../components/builder/composer-library-dialog.tsx')
const templates = [
  { id: 'supplied-one', name: 'A very long supplied template name '.repeat(5), slide_count: 4, stage_template_summary: { slide_count: 6 } },
  { id: 'supplied-two', name: 'Legacy slide count', slide_count: 8 },
  { id: 'supplied-three', name: 'No supplied count' },
]
const node = (type, props) => ({ type, props: props || {} })
function mountDialog({ studio, topic, dittoFlag, auth = true, layoutUrl = 'http://127.0.0.1:8531', initial, mocks = {} }) {
  const state = [...initial], exports = {}; let cursor = 0
  const proxy = new Proxy({}, { get: (_target, key) => key })
  vm.runInNewContext(ts.transpileModule(dialogSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText, {
    exports, module: { exports }, URL, AbortController, DOMException, Error, console,
    process: { env: {
      ...(studio === undefined ? {} : { NEXT_PUBLIC_STUDIO_V4_SHELL: studio }),
      ...(topic === undefined ? {} : { NEXT_PUBLIC_COMPOSER_STAGE1B_NEW_TOPIC_ENABLED: topic }),
      ...(dittoFlag === undefined ? {} : { [FLAG]: dittoFlag }),
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
      if (id === '@/lib/composer-ditto') return ditto
      if (id in longBriefImports) return longBriefImports[id]
      if (id === '@/lib/researcher-upload') return { uploadFileToResearcher() { throw new Error('No upload allowed') } }
      if (id === '@/lib/layout-viewer-url-policy') return { evaluateLayoutViewerUrl: () => ({ status: 'allowed' }) }
      if (id === '@/lib/layout-service-client') return { LAYOUT_VIEWER_URL_POLICY: {} }
      if (id.endsWith('.css')) return {}
      if (id.startsWith('@/components/') || id === 'lucide-react') return proxy
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
const withoutDitto = nodes => nodes.filter(item => !(item.type === 'Button' && item.children[0] === 'Rebuild from own content'))
  .map(item => typeof item === 'object' ? { ...item, children: withoutDitto(item.children) } : item)
const stateFor = busy => [templates, false, busy, 'Supplied preparing status', 'Supplied failed-read detail', { name: 'valid.pptx', size: 1024 }, 'A meaningful local presentation brief', 'supplied-one']
const rendered = options => mountDialog({ ...options, initial: stateFor(options.busy ?? false) }).render()
const dittoButtons = tree => all(tree, item => item.type === 'Button' && visible(item) === 'Rebuild from own content')

// Flag off, in every spelling that is not the literal "true": the rendered tree is the base's, state for state.
let dialogDigest
for (const value of [undefined, 'false', '', '1', 'TRUE', ' true']) {
  const trees = []
  for (const studio of ['true', 'false', undefined]) for (const topic of ['true', 'false']) for (const auth of [true, false]) for (const busy of [true, false]) {
    const tree = rendered({ studio, topic, dittoFlag: value, auth, busy })
    check(assert.equal, dittoButtons(tree).length, 0)
    check(assert.equal, JSON.stringify(canonical(tree)).includes('ditto'), false)
    trees.push(canonical(tree))
  }
  dialogDigest ??= digest(trees)
  check(assert.equal, digest(trees), dialogDigest, `flag ${JSON.stringify(value)} must render exactly as flag unset`)
}
console.log(`flag-off dialog digest: ${dialogDigest} (24 states)`)
check(assert.equal, dialogDigest, BASE_DIALOG_DIGEST, 'flag-off dialog markup must equal the base')

// Flag on: one extra button per template, between "Use original" and "New topic"; everything else unchanged.
for (const studio of ['true', 'false', undefined]) for (const topic of ['true', 'false']) for (const auth of [true, false]) for (const busy of [true, false]) {
  const off = canonical(rendered({ studio, topic, dittoFlag: undefined, auth, busy }))
  const tree = rendered({ studio, topic, dittoFlag: 'true', auth, busy })
  const buttons = dittoButtons(tree)
  check(assert.equal, buttons.length, 3)
  for (const button of buttons) {
    check(assert.equal, button.props.disabled, busy || !auth)
    check(assert.equal, button.props['data-studio-composer-action'], studio === 'true' ? 'ditto' : undefined)
    check(assert.equal, typeof button.props.onClick, 'function')
  }
  for (const actions of all(tree, item => item.props.className === 'flex shrink-0 gap-2')) {
    check(assert.deepEqual, [actions.props.children].flat().filter(Boolean).map(visible), topic === 'true' ? ['Use original', 'Rebuild from own content', 'New topic'] : ['Use original', 'Rebuild from own content'])
  }
  // Removing the added buttons gives back the flag-off tree exactly.
  check(assert.equal, JSON.stringify(withoutDitto(canonical(tree))), JSON.stringify(off))
}

// Flag on: the click creates a fresh owned session, sends exactly {session_id, mode: "ditto"}, polls the same job route
// and opens the deck. "Use original" is untouched. The upstream job is the contract's ditto job (no model calls).
const oddTemplate = { id: 'odd/id x', name: 'Odd id' }
async function clickFlow(action, template, { auth = true, busy = false, createOk = true, layoutUrl, job } = {}) {
  const calls = [], sessions = [], assigned = [], store = new Map()
  const polls = [{ job_id: 'stage-use-run-1', status: 'running', stage: 'assembling' }, job]
  const lib = load('../lib/composer-library.ts', {
    fetch: async (url, options = {}) => {
      calls.push({ url, method: options.method || 'GET', body: options.body ?? null })
      if (options.method === 'POST') return Response.json({ job_id: 'stage-use-run-1', status: 'queued' }, { status: 202 })
      return Response.json(polls.shift() ?? job)
    },
    setTimeout: callback => { queueMicrotask(callback); return 1 }, clearTimeout: () => {},
  })
  const mounted = mountDialog({ studio: 'true', topic: 'false', dittoFlag: 'true', auth, ...(layoutUrl === undefined ? {} : { layoutUrl }),
    initial: [[...templates, oddTemplate], false, busy, null, null, null, '', null], mocks: {
    composerLibrary: lib,
    createSession: async (...args) => { sessions.push(args); return createOk },
    globals: {
      crypto: { randomUUID: () => 'fresh-session-0001' },
      sessionStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) },
      window: { location: { assign: url => assigned.push(url) } },
    },
  } })
  const tree = mounted.render()
  const record = all(tree, item => item.props['data-studio-composer-record'] === template)[0]
  const button = all(record, item => item.type === 'Button' && visible(item) === action)[0]
  button.props.onClick()
  for (let turn = 0; turn < 50; turn++) await new Promise(resolve => setImmediate(resolve))
  return { calls, sessions, assigned, store, error: mounted.state[4], progress: mounted.state[3] }
}
const readyJob = {
  job_id: 'stage-use-run-1', status: 'complete', operation: 'stage_template_ditto',
  checkpoint: { result: { session_id: 'fresh-session-0001', template_id: 'supplied-two', presentation_id: 'deck-9', viewer_url: 'http://127.0.0.1:8531/p/deck-9', slide_count: 8, model_calls: 0, spend_usd: 0 } },
}
const rebuilt = await clickFlow('Rebuild from own content', 'supplied-two', { job: readyJob })
check(assert.equal, rebuilt.error, null)
check(assert.deepEqual, rebuilt.sessions, [['fresh-session-0001', 'Rebuild: Legacy slide count']])
check(assert.deepEqual, rebuilt.calls.map(call => `${call.method} ${call.url}`),
  ['POST /api/composer-library/templates/supplied-two/use', 'GET /api/composer-library/jobs/stage-use-run-1', 'GET /api/composer-library/jobs/stage-use-run-1'])
check(assert.equal, rebuilt.calls[0].body, '{"session_id":"fresh-session-0001","mode":"ditto"}')
check(assert.deepEqual, rebuilt.assigned, ['/builder?session_id=fresh-session-0001'])
const readyRecord = JSON.parse(rebuilt.store.get('deckster_composer_ready_fresh-session-0001'))
check(assert.equal, readyRecord.user_id, 'local-owner')
check(assert.equal, readyRecord.result.presentation_id, 'deck-9')
check(assert.equal, readyRecord.result.composer_adoption.frozen_theme, true)
check(assert.equal, rebuilt.store.has('deckster_composer_job_local-owner'), false, 'the pending-job record is cleared once the deck opens')

const original = await clickFlow('Use original', 'supplied-two', { job: { ...readyJob, operation: 'stage_template_use' } })
check(assert.equal, original.calls[0].body, '{"session_id":"fresh-session-0001"}')
check(assert.deepEqual, original.sessions, [['fresh-session-0001', 'Template: Legacy slide count']])
check(assert.deepEqual, original.assigned, ['/builder?session_id=fresh-session-0001'])

// Guards: no session, request or navigation when signed out or busy; a failed session create stops before the request;
// a failed job shows its error and never opens a deck.
for (const options of [{ auth: false }, { busy: true }]) {
  const blocked = await clickFlow('Rebuild from own content', 'supplied-two', { job: readyJob, ...options })
  check(assert.equal, blocked.calls.length + blocked.sessions.length + blocked.assigned.length, 0)
}
const noSession = await clickFlow('Rebuild from own content', 'supplied-two', { job: readyJob, createOk: false })
check(assert.equal, noSession.calls.length, 0)
check(assert.equal, noSession.error, 'Could not create the deck session.')
const failed = await clickFlow('Rebuild from own content', 'supplied-two', { job: { job_id: 'stage-use-run-1', status: 'failed', errors: ['Template could not be rebuilt.'] } })
check(assert.equal, failed.error, 'Template could not be rebuilt.')
check(assert.equal, failed.assigned.length, 0)
const foreignDeck = await clickFlow('Rebuild from own content', 'supplied-two', { job: { ...readyJob, checkpoint: { result: { ...readyJob.checkpoint.result, session_id: 'someone-elses-session' } } } })
check(assert.match, foreignDeck.error, /does not belong to the requested session/)
check(assert.equal, foreignDeck.assigned.length, 0)
// The layout service must be configured and approved before anything is created (same gate as "Use original").
for (const layoutUrl of [null, 'https://unapproved.example']) {
  const unconfigured = await clickFlow('Rebuild from own content', 'supplied-two', { job: readyJob, layoutUrl })
  check(assert.equal, unconfigured.calls.length + unconfigured.sessions.length + unconfigured.assigned.length, 0)
  check(assert.match, unconfigured.error, /Template library/)
}
// The template id is encoded into the path.
const odd = await clickFlow('Rebuild from own content', 'odd/id x', { job: readyJob })
check(assert.equal, odd.calls[0].url, '/api/composer-library/templates/odd%2Fid%20x/use')

// ---- 4. Flag registry and wiring ----------------------------------------------------------------------------------
const envExample = read('../.env.example')
check(assert.equal, envExample.split('\n').filter(line => line.startsWith(`${FLAG}=`)).join(), `${FLAG}="false"`)
const pkg = JSON.parse(read('../package.json'))
check(assert.equal, pkg.scripts['test:composer-ditto'], 'node scripts/test-composer-ditto.mjs')
const scriptNames = Object.keys(pkg.scripts)
check(assert.notEqual, scriptNames.indexOf('test:composer-ditto'), scriptNames.length - 1, 'not the last script line (merge-conflict anchor)')
const routeSource = read('../app/api/composer-library/[...path]/route.ts')
for (const [name, text] of [['route', routeSource], ['dialog', dialogSource]]) {
  check(assert.equal, text.split(`process.env.${FLAG} === 'true'`).length - 1, 1, `${name} reads the flag once as the literal "true"`)
}
console.log(`Composer ditto: ${checks} checks passed (helper, flag-off proxy and dialog identity, flag-on proxy rules, dialog action and click flow, flag registry).`)
