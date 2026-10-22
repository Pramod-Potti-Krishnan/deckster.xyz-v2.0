// FRONTEND-2 Pass 3: refine an element from chat, Studio half (NEXT_PUBLIC_CHAT_ELEMENT_REFINE, exact "true", default off).
//
//   node scripts/test-studio-chat-element-refine.mjs                 # everything, offline (recorded Director frames + recorded Layout replies)
//   CHAT_REFINE_LAYOUT_DIR=<layout-builder checkout at 8b19344c> CHAT_REFINE_LAYOUT_SERVED=<dir with served-on.html / served-off.html> \
//     node scripts/test-studio-chat-element-refine.mjs               # also re-runs the REAL Layout viewer code and checks the recorded replies
//   ... --record-layout                                              # (with the two variables) re-records scripts/fixtures/chat-element-refine/layout-replies.json
//
// What it proves (OPS-2's bar for this change, streams/frontend/pass3/REFINE-ELEMENT-STUDIO-NOTES.md):
//  1. the wire half (lib/chat-element-refine-wire.ts) and the reference rule (Director !511 rules 1, 2, 4; slide_index from the selection);
//  2. requestElementRefine against the REAL Layout viewer code of layout-builder !245: the page Layout's server.py serves (flag off and on)
//     with its postMessage bridge, and element-manager.js + request-element-refine.js, run in a node vm (scripts/studio-chat-element-refine-layout.mjs),
//     reached through Studio's REAL viewer bridge (sendCommand, cut out of components/presentation-viewer.tsx) the way handleSendElementCommand
//     sends an unrouted command. Offline, the viewer's replies come from layout-replies.json, which that real code recorded;
//  3. the 12 transcripts DIRECTOR-2 RECORDED from Director !511's real code (scripts/fixtures/chat-element-refine/director-frames, copied verbatim)
//     replayed through the REAL Director socket hook: what Studio sends (client_caps, references) and what it answers to element_refine_directive
//     (element_directive_result) equal the recorded inbound frames, with message_id / directive_id / timestamp normalised;
//  4. the chat refine reaches the Element panel's refine branch of the REAL useTextLabsGeneration (Text Labs is asked to refine, in place);
//  5. flag off is identical: the hook, run from the base commit and from this tree, puts the same bytes on the socket and leaves the same state and
//     cache for the same frames (the directive included); the strip module gives back the base files byte for byte; the built payload of
//     representative sends hashes the same;
//  6. the page wires it only behind the flag, next to the K5 add runner, and a few negative controls fail as they should.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import React from 'react'
import { Root } from './studio-chat-harness/mini-react.mjs'
import { createEnvironment } from './studio-chat-harness/fake-env.mjs'
import { createModuleLoader } from './studio-chat-harness/module-loader.mjs'
import { BASE_ENV } from './studio-chat-harness/profiles.mjs'
import { createLayoutViewer, registerSyntheticDeck, LAYOUT_SCRIPTS } from './studio-chat-element-refine-layout.mjs'
import { stripChatElementRefine, BASE_COMMIT, CHAT_ELEMENT_REFINE_FILES } from './studio-chat-element-refine-strip.mjs'

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const FIXTURES = path.join(root, 'scripts/fixtures/chat-element-refine')
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value))
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const baseFile = rel => git('show', `${BASE_COMMIT}:${rel}`)

let passed = 0
const failed = []
async function check(label, fn) {
  try { await fn(); passed++; console.log(`PASS ${label}`) } catch (error) { failed.push(label); console.error(`FAIL ${label}: ${error?.stack?.split('\n').slice(0, 3).join(' | ') ?? error}`) }
}

// ---- TypeScript modules, plain (no React) -------------------------------------------------------------------------------------------
function loadPure(rel, env = {}, overrides = {}) {
  const cache = new Map()
  const load = file => {
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }
    cache.set(file, module)
    const text = overrides[file] ?? read(file)
    const out = ts.transpileModule(text, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    vm.runInNewContext(out, { module, exports: module.exports, process: { env }, console, URL, require(spec) {
      if (spec.startsWith('@/')) {
        const base = spec.slice(2)
        for (const ext of ['.ts', '.tsx']) if (fs.existsSync(path.join(root, base + ext))) return load(base + ext)
      }
      throw new Error(`unexpected dependency ${spec} of ${file}`)
    } }, { filename: file })
    return module.exports
  }
  return load(rel)
}
const wire = loadPure('lib/chat-element-refine-wire.ts', { NEXT_PUBLIC_CHAT_ELEMENT_REFINE: 'true' })
const refine = loadPure('lib/chat-element-refine.ts', { NEXT_PUBLIC_CHAT_ELEMENT_REFINE: 'true' })

// ---- recorded Director transcripts --------------------------------------------------------------------------------------------------
const DIRECTOR_DIR = path.join(FIXTURES, 'director-frames')
const transcripts = Object.fromEntries(fs.readdirSync(DIRECTOR_DIR).filter(name => /^\d\d-.*\.json$/.test(name)).sort()
  .map(name => [name.replace(/\.json$/, ''), JSON.parse(fs.readFileSync(path.join(DIRECTOR_DIR, name), 'utf8'))]))
const DIRECTOR_COMMIT = '19d09d603095e263ea87ab55af79fa59a8ad2370'
// message_id, directive_id and timestamp vary per recording run; everything else is compared as recorded.
function normalise(frame, ids = new Map()) {
  const walk = value => {
    if (Array.isArray(value)) return value.map(walk)
    if (!value || typeof value !== 'object') return value
    const out = {}
    for (const [key, item] of Object.entries(value)) {
      if ((key === 'message_id' || key === 'directive_id') && typeof item === 'string') {
        if (!ids.has(item)) ids.set(item, `<${key}:${[...ids.values()].filter(v => v.startsWith(`<${key}`)).length + 1}>`)
        out[key] = ids.get(item)
      } else if (key === 'timestamp' && typeof item === 'string') out[key] = '<timestamp>'
      else out[key] = walk(item)
    }
    return out
  }
  return walk(frame)
}

await check('fixtures: the 12 recorded Director transcripts are from Director !511 head 19d09d60 with the planned flags', async () => {
  assert.deepEqual(Object.keys(transcripts), ['01-success', '02-failed', '03-dismissed', '04-g3-no-element-reference', '05-g5-slide-op-in-flight', '06-no-cap',
    '07-failed-viewer-unavailable', '08-failed-element-not-found', '09-failed-timeout', '10-two-elements', '11-off-list-type', '12-long-id'])
  for (const [name, t] of Object.entries(transcripts)) {
    assert.equal(t.director_commit, DIRECTOR_COMMIT, name)
    assert.equal(t.flags.DIRECTOR_MDC_REFINE_ELEMENT_ENABLED, 'true', name)
    assert.equal(t.flags.CHAT_CAP_REFINE_ELEMENT, 'true', name)
    const outTypes = t.frames.filter(f => f.direction === 'out').map(f => f.frame.type)
    assert.deepEqual(outTypes, t.outbound_frame_types, name)
  }
})

// ---- 1. the wire half and the reference rule ---------------------------------------------------------------------------------------
await check('wire: element_refine1 is added once, after mdc1, and only one element reference ever rides a send', async () => {
  const ref = { kind: 'element', element_id: 'el_chart_7f3a', element_type: 'CHART', slide_index: 2, slide_id: 'L2', label: 'Chart · slide 3' }
  assert.deepEqual(plain(wire.addChatElementRefineFields({ text: 'x', client_caps: ['mdc1'] }, null)), { text: 'x', client_caps: ['mdc1', 'element_refine1'] })
  assert.deepEqual(plain(wire.addChatElementRefineFields({ text: 'x' }, ref)), { text: 'x', client_caps: ['element_refine1'], references: [ref] })
  const slideRef = { kind: 'slide', index: 0, slide_id: 'L0', label: 'Overview' }
  assert.deepEqual(plain(wire.addChatElementRefineFields({ client_caps: ['mdc1', 'element_refine1'], references: [slideRef] }, ref)), { client_caps: ['mdc1', 'element_refine1'], references: [slideRef, ref] })
  const twice = wire.addChatElementRefineFields(wire.addChatElementRefineFields({}, ref), { ...ref, element_id: 'el_table_91c0', element_type: 'TABLE' })
  assert.equal(twice.references.filter(r => r.kind === 'element').length, 1, 'Director !511 rule 2: at most one element reference')
  assert.equal(wire.elementRefineDirectiveId({ payload: { directive_id: 'elr_864a7b3a7212' } }), 'elr_864a7b3a7212')
  for (const bad of [null, {}, { payload: null }, { payload: { directive_id: '' } }, { payload: { directive_id: 7 } }]) assert.equal(wire.elementRefineDirectiveId(bad), null)
  assert.equal(wire.CHAT_ELEMENT_REFINE_ENABLED, true)
  assert.equal(loadPure('lib/chat-element-refine-wire.ts', {}).CHAT_ELEMENT_REFINE_ENABLED, false, 'default off')
  for (const raw of ['1', 'TRUE', 'yes', 'false', '']) assert.equal(loadPure('lib/chat-element-refine-wire.ts', { NEXT_PUBLIC_CHAT_ELEMENT_REFINE: raw }).CHAT_ELEMENT_REFINE_ENABLED, false, `exact "true" only (${raw})`)
})

await check('reference: allow-list (case-insensitive), 128-character id, slide index from the selection, label', async () => {
  const sel = (elementType, extra = {}) => ({ elementId: 'el_chart_7f3a', elementType, slideIndex: 2, slideId: 'L2', ...extra })
  assert.deepEqual(plain(refine.chatElementReferenceFor(sel('chart'))), { kind: 'element', element_id: 'el_chart_7f3a', element_type: 'CHART', slide_index: 2, slide_id: 'L2', label: 'Chart · slide 3' })
  assert.equal(refine.chatElementReferenceFor(sel('TEXT_BOX')).element_type, 'TEXT_BOX')
  assert.equal(refine.chatElementReferenceFor(sel('TEXT_BOX')).label, 'Text box · slide 3')
  assert.equal(refine.chatElementReferenceFor(sel('Gantt-Chart')).element_type, 'GANTT_CHART')
  assert.equal(refine.chatElementReferenceFor(sel('diagram')).element_type, 'DIAGRAM')
  assert.equal(refine.chatElementReferenceFor(sel('icon')).element_type, 'ICON_LABEL')
  for (const type of refine.DIRECTOR_ELEMENT_REFERENCE_TYPES) {
    assert.equal(refine.chatElementReferenceFor(sel(type.toLowerCase())).element_type, type, type)
  }
  assert.equal(refine.DIRECTOR_ELEMENT_REFERENCE_TYPES.length, 19)
  for (const off of ['WIDGET', 'hero', '', null]) assert.equal(refine.chatElementReferenceFor(sel(off)), null, `off the list: ${off}`)
  assert.ok(refine.chatElementReferenceFor(sel('chart', { elementId: 'x'.repeat(128) })))
  assert.equal(refine.chatElementReferenceFor(sel('chart', { elementId: 'x'.repeat(129) })), null)
  for (const slideIndex of [-1, 1.5, NaN, undefined]) assert.equal(refine.chatElementReferenceFor(sel('chart', { slideIndex })), null, `slide ${slideIndex}`)
  assert.equal(refine.chatElementReferenceFor(sel('chart', { slideId: null })).slide_id, null)
  assert.equal(refine.chatElementReferenceFor(null), null)
})

await check('errors: Layout bridge rejections map onto Director\'s codes', async () => {
  const code = refine.elementRefineCommandErrorCode
  assert.equal(code(new Error('Unknown action: requestElementRefine')), 'viewer_unavailable')
  assert.equal(code(new Error('element_not_found')), 'element_not_found')
  assert.equal(code(new Error('Command timeout')), 'timeout')
  for (const other of ['view-only', 'Iframe not ready', 'elementId parameter required', 'requestElementRefine is not available', '']) assert.equal(code(new Error(other)), 'viewer_unavailable', other)
})

// ---- 2. the REAL Layout viewer (layout-builder !245) -----------------------------------------------------------------------------
const STUDIO_ORIGIN = 'https://studio.synthetic.test'
const LAYOUT_ORIGIN = 'https://layout.synthetic.test'
const LAYOUT_COMMIT = '8b19344c4d364271e4eeedba759278da5b2270f4'
const REPLIES_FILE = path.join(FIXTURES, 'layout-replies.json')
const layoutDir = process.env.CHAT_REFINE_LAYOUT_DIR || null
const servedDir = process.env.CHAT_REFINE_LAYOUT_SERVED || null
const live = Boolean(layoutDir && servedDir)
const recordLayout = process.argv.includes('--record-layout')
if (recordLayout && !live) throw new Error('--record-layout needs CHAT_REFINE_LAYOUT_DIR and CHAT_REFINE_LAYOUT_SERVED')
// The viewer worlds the cases need: the flag on (the element is there / it was deleted) and the flag off.
const WORLDS = ['on', 'on-element-removed', 'off']
const PROBES = [{ elementId: 'el_chart_7f3a' }, { elementId: 'el_title_0' }, { elementId: 'no-such-element' }, {}]

function liveViewer(world, parent) {
  const servedHtml = fs.readFileSync(path.join(servedDir, world === 'off' ? 'served-off.html' : 'served-on.html'), 'utf8')
  const viewer = createLayoutViewer({ layoutDir, servedHtml, parent })
  registerSyntheticDeck(viewer)
  if (world === 'on-element-removed') viewer.removeElement('el_chart_7f3a')
  return viewer
}
const recorded = fs.existsSync(REPLIES_FILE) ? JSON.parse(fs.readFileSync(REPLIES_FILE, 'utf8')) : null

if (live) {
  await check('Layout (live): the served pages are Layout\'s own, flag off and on, and the viewer code is !245\'s', async () => {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: layoutDir, encoding: 'utf8' }).trim()
    assert.equal(head, LAYOUT_COMMIT, 'the layout-builder checkout is at !245 head')
    const off = fs.readFileSync(path.join(servedDir, 'served-off.html'), 'utf8'), on = fs.readFileSync(path.join(servedDir, 'served-on.html'), 'utf8')
    assert.equal(off.includes('requestElementRefine'), false)
    assert.equal(on.split("          case 'requestElementRefine':\n").length, 2)
    assert.ok(on.includes(`ALLOWED_PARENT_ORIGINS = Object.freeze(["${STUDIO_ORIGIN}"]);`))
  })
}

// Every reply each world gives to each probe, through the real bridge (live), with the observation that nothing else changed.
async function layoutReplies() {
  const out = {}
  for (const world of WORLDS) {
    const posted = []
    const parent = { postMessage(data, origin) { posted.push({ data: plain(data), origin }) } }
    const viewer = liveViewer(world, parent)
    const before = viewer.snapshot()
    out[world] = []
    for (const [index, params] of PROBES.entries()) {
      posted.length = 0
      await viewer.deliver({ action: 'requestElementRefine', params, requestId: `probe-${index}` }, STUDIO_ORIGIN)
      assert.equal(posted.length, 1, `${world} ${JSON.stringify(params)}: one reply`)
      assert.equal(posted[0].origin, STUDIO_ORIGIN)
      out[world].push({ params, reply: posted[0].data })
    }
    // A command from an origin the viewer does not trust gets no answer at all.
    posted.length = 0
    await viewer.deliver({ action: 'requestElementRefine', params: PROBES[0], requestId: 'foreign' }, 'https://foreign.synthetic.test')
    assert.equal(posted.length, 0, 'an untrusted origin is not answered')
    assert.equal(viewer.snapshot(), before, `${world}: no selection, registry, DOM or autosave change`)
    assert.ok(viewer.parentDescriptorIsData, `${world}: window.parent is the real parent again`)
    if (world !== 'off') assert.ok(viewer.bridge.scripts.includes('src/utils/request-element-refine.js'))
    else assert.ok(!viewer.bridge.scripts.includes('src/utils/request-element-refine.js'))
    out[`${world}:sources`] = viewer.sources
    out[`${world}:served_sha256`] = viewer.bridge.sha256
  }
  return out
}

if (live) {
  const replies = await layoutReplies()
  if (recordLayout) {
    const record = {
      recorded_by: 'scripts/test-studio-chat-element-refine.mjs --record-layout (the real Layout viewer code run in a node vm; scripts/studio-chat-element-refine-layout.mjs)',
      layout_commit: LAYOUT_COMMIT,
      layout_mr: 'pramodpotti/layout-builder-v7.5!245 (LAYOUT_REQUEST_ELEMENT_REFINE_ENABLED)',
      served_by: 'scripts/fixtures/chat-element-refine/serve-layout-viewer.py (server.py /p/<id> in process, flag unset and "true", FRONTEND_ALLOWED_ORIGINS=' + STUDIO_ORIGIN + ')',
      scripts: LAYOUT_SCRIPTS, studio_origin: STUDIO_ORIGIN, replies,
    }
    fs.writeFileSync(REPLIES_FILE, JSON.stringify(record, null, 2) + '\n')
    console.log(`recorded ${path.relative(root, REPLIES_FILE)}`)
  } else {
    await check('Layout (live): the real viewer code reproduces the recorded replies exactly', async () => {
      assert.ok(recorded, 'layout-replies.json exists')
      assert.deepEqual(replies, recorded.replies)
    })
  }
}

await check('Layout (recorded from !245\'s real code): flag on gives the button\'s payload; deleted is element_not_found; off is Unknown action', async () => {
  assert.ok(recorded, 'layout-replies.json exists')
  assert.equal(recorded.layout_commit, LAYOUT_COMMIT)
  const reply = (world, index) => recorded.replies[world][index].reply
  const chart = reply('on', 0)
  assert.equal(chart.success, true); assert.equal(chart.action, 'requestElementRefine'); assert.equal(chart.requestId, 'probe-0'); assert.equal(chart.elementId, 'el_chart_7f3a')
  assert.equal(chart.data.type, 'refineElementRequested'); assert.equal(chart.data.componentType, 'CHART'); assert.equal(chart.data.slideIndex, 2)
  assert.deepEqual(chart.data.themeBindings, { fill: 'primary' }); assert.equal(chart.data.generation_config.chart_type, 'line')
  assert.equal(reply('on', 1).data.componentType, 'TEXT_BOX')
  assert.deepEqual(reply('on', 2), { success: false, action: 'requestElementRefine', requestId: 'probe-2', error: 'element_not_found', elementId: 'no-such-element' })
  assert.deepEqual(reply('on', 3), { success: false, action: 'requestElementRefine', requestId: 'probe-3', error: 'elementId parameter required' })
  assert.equal(reply('on-element-removed', 0).error, 'element_not_found')
  for (const index of [0, 1, 2, 3]) assert.deepEqual(reply('off', index), { success: false, action: 'requestElementRefine', requestId: `probe-${index}`, error: 'Unknown action: requestElementRefine' })
  assert.notEqual(recorded.replies['on:served_sha256'], recorded.replies['off:served_sha256'])
})

// ---- Studio's REAL viewer bridge (components/presentation-viewer.tsx sendCommand) ----------------------------------------------------
const viewerTsx = read('components/presentation-viewer.tsx')
function functionText(source, name) {
  const file = ts.createSourceFile('presentation-viewer.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let found = null
  const visit = node => { if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node.getText(file); else ts.forEachChild(node, visit) }
  visit(file)
  assert.ok(found, `presentation-viewer.tsx defines ${name}`)
  return found
}
const messaging = loadPure('lib/layout-viewer-messaging.ts')
const router = loadPure('lib/element-command-router.ts')
const bridgeJs = ts.transpileModule(`${functionText(viewerTsx, 'createViewerRequestId')}\n${functionText(viewerTsx, 'sendCommand')}\n;({ sendCommand })`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText

/** A Studio window + iframe whose viewer is `route(data) -> reply | null` (null: the viewer never answers). */
function studioBridge(route) {
  const listeners = new Set()
  const timers = new Map()
  let nextTimer = 1, uuid = 0
  const acks = []
  const studioWindow = { addEventListener(type, fn) { if (type === 'message') listeners.add(fn) }, removeEventListener(type, fn) { if (type === 'message') listeners.delete(fn) } }
  const viewerHandle = {
    postMessage(data, targetOrigin) {
      assert.equal(targetOrigin, LAYOUT_ORIGIN, 'Studio posts to the viewer origin only')
      const request = plain(data)
      queueMicrotask(async () => {
        const reply = await route(request)
        if (reply) for (const fn of [...listeners]) fn({ source: viewerHandle, origin: LAYOUT_ORIGIN, data: plain(reply) })
      })
    },
  }
  const iframe = { src: `${LAYOUT_ORIGIN}/p/pres-e2e`, contentWindow: viewerHandle }
  const context = {
    window: studioWindow, Promise, Error, Date, Math, JSON, Object, Array, queueMicrotask,
    setTimeout: (fn, ms) => { const id = nextTimer++; timers.set(id, { fn, ms }); return id }, clearTimeout: id => { timers.delete(id) },
    crypto: { randomUUID: () => `studio-request-${++uuid}` },
    getLayoutServiceUrl: () => LAYOUT_ORIGIN, VIEWER_ORIGIN: LAYOUT_ORIGIN,
    getLayoutViewerOrigin: messaging.getLayoutViewerOrigin, isTrustedLayoutViewerMessage: messaging.isTrustedLayoutViewerMessage,
    isMatchingSlideComposeCommandResponse: () => { throw new Error('requestElementRefine must not take the strict compose/refine matcher') },
    scTrace() {}, isSlideComposerTraceEnabled: () => false, reportLayoutCommandAck: action => acks.push(action),
  }
  const { sendCommand } = vm.runInNewContext(bridgeJs, context)
  return {
    acks, timers, listeners,
    // handleSendElementCommand: a command the router does not know goes straight to sendCommand(iframe, action, params), default 5 s budget.
    sendElementCommand: (action, params) => {
      assert.equal(router.getCommandType(action), 'unknown', `${action} is not routed to Layout-service or Elementor handling`)
      return sendCommand(iframe, action, params)
    },
    fireTimers() { for (const [id, timer] of [...timers]) { timers.delete(id); timer.fn() } },
  }
}

/** The viewer a case talks to: the live real code, or (offline) the replies that code recorded, matched on params, requestId carried over. */
function viewerRoute(world) {
  if (world === 'stalled') return async () => null
  if (live) {
    let pendingReply = null
    const parent = { postMessage(data) { pendingReply = plain(data) } }
    const viewer = liveViewer(world, parent)
    return async request => { pendingReply = null; await viewer.deliver(request, STUDIO_ORIGIN); return pendingReply }
  }
  return async request => {
    const hit = recorded.replies[world].find(entry => JSON.stringify(entry.params) === JSON.stringify(request.params ?? {}))
    assert.ok(hit, `a recorded ${world} reply for ${JSON.stringify(request.params)}`)
    assert.equal(request.action, 'requestElementRefine')
    return { ...hit.reply, requestId: request.requestId }
  }
}

await check(`bridge: Studio's sendCommand <-> ${live ? 'the live real' : 'the recorded real'} Layout viewer, every outcome`, async () => {
  const on = studioBridge(viewerRoute('on'))
  const ok = await on.sendElementCommand('requestElementRefine', { elementId: 'el_chart_7f3a' })
  assert.equal(ok.success, true); assert.equal(ok.data.elementId, 'el_chart_7f3a'); assert.match(ok.requestId, /^studio-request-\d+$/)
  assert.equal(on.timers.size, 0, 'the timeout is cleared'); assert.equal(on.listeners.size, 0, 'the listener is removed')
  await assert.rejects(on.sendElementCommand('requestElementRefine', { elementId: 'no-such-element' }), /^Error: element_not_found$/)
  const off = studioBridge(viewerRoute('off'))
  await assert.rejects(off.sendElementCommand('requestElementRefine', { elementId: 'el_chart_7f3a' }), /^Error: Unknown action: requestElementRefine$/)
  const stalled = studioBridge(viewerRoute('stalled'))
  const pending = stalled.sendElementCommand('requestElementRefine', { elementId: 'el_chart_7f3a' })
  assert.equal([...stalled.timers.values()][0].ms, 5000, 'the default 5 s budget')
  stalled.fireTimers()
  await assert.rejects(pending, /^Error: Command timeout$/)
})


// ---- 3. the REAL Director socket hook, replaying DIRECTOR-2's recorded transcripts ---------------------------------------------------
const HOOK = 'hooks/use-deckster-websocket-v2.ts'
const SESSION = 's_e2e', PRESENTATION = 'pres-e2e'
const SELECTED_CHART = { elementId: 'el_chart_7f3a', elementType: 'chart', slideIndex: 2, slideId: 'L2' }

/** Read `rel` as `text` while `fn` loads modules (the harness loader reads files from disk): runs the BASE hook without a checkout. */
function withFileText(rel, text, fn) {
  if (text === null) return fn()
  const target = path.join(root, rel), original = fs.readFileSync
  fs.readFileSync = function (file, ...rest) { return path.resolve(String(file)) === target ? text : original.call(this, file, ...rest) }
  try { return fn() } finally { fs.readFileSync = original }
}

async function mountHook({ refineFlag, hookText = null, extraEnv = {} }) {
  const env = createEnvironment({ processEnv: { ...BASE_ENV, NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_CHAT_DIRECTIVES: 'true',
    ...(refineFlag ? { NEXT_PUBLIC_CHAT_ELEMENT_REFINE: 'true' } : {}), ...extraEnv } })
  const user = { id: 'synthetic-user', email: 'synthetic-user@example.invalid' }
  const hookModule = withFileText(HOOK, hookText, () => createModuleLoader({ root, globals: env.globals, stubs: { react: React },
    fileStubs: { 'hooks/use-auth': { useAuth: () => ({ user, isLoading: false }) } } }).load(HOOK))
  const seen = { refineDirectives: [], elementDirectives: [], onMessage: [] }
  const probe = { api: null, reference: null }
  function Probe() {
    probe.api = hookModule.useDecksterWebSocketV2({
      autoConnect: false, existingSessionId: SESSION,
      onMessage: message => { seen.onMessage.push(message.message_id) },
      onElementDirective: payload => { seen.elementDirectives.push(plain(payload)) },
      // What the page passes with the flag on (app/builder/page.tsx): the runner ref and chatElementReferenceFor(the selection).
      onElementRefineDirective: (message, owner) => { seen.refineDirectives.push({ message: plain(message), owner }) },
      getChatElementReference: () => probe.reference,
    })
    return null
  }
  const rootNode = new Root()
  const settle = async () => { for (let quiet = 0, rounds = 0; quiet < 2; rounds++) { if (rounds > 80) throw new Error('hook did not settle'); await env.macrotask(); quiet = rootNode.flush() ? 0 : quiet + 1 } }
  rootNode.setElement(React.createElement(Probe))
  await settle()
  probe.api.ensureConnected()
  await env.clock.advance(0, settle)
  assert.equal(env.sockets.length, 1, 'one socket')
  env.sockets[0].serverOpen()
  await env.clock.advance(0, settle)
  return {
    env, probe, seen, settle,
    get api() { return probe.api },
    async deliver(frame) { env.sockets[0].serverMessage(JSON.stringify(frame)); await env.clock.advance(0, settle) },
    async send(text) { const ok = probe.api.sendMessage(text); await env.clock.advance(0, settle); return ok },
    sent: () => env.outbound.filter(item => item.data !== 'ping').map(item => item.data),
    state: () => plain({ messages: probe.api.messages, awaiting: probe.api.awaitingDirectorReply, status: probe.api.currentStatus ?? null,
      presentationId: probe.api.presentationId ?? null, cache: env.sessionStorage.dump(), consoleErrors: env.consoleEvents.filter(e => e.level === 'error').length }),
    unmount() { rootNode.unmount() },
  }
}

function realBuildRefineContext() {
  // useElementRefinement is useCallback(fn, deps): with React's useCallback as the identity it IS the page's buildRefineContext.
  const module = { exports: {} }
  const out = ts.transpileModule(read('hooks/use-element-refinement.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(out, { module, exports: module.exports, require: spec => spec === 'react' ? { useCallback: fn => fn } : (() => { throw new Error(spec) })() })
  return module.exports.useElementRefinement({ slideContextByIndex: null, deckContext: null, sessionStoreName: null, sessionId: SESSION, currentSlideIndex: 0 })
}
const semantic = loadPure('lib/element-semantic-type.ts')
const blankPolicy = loadPure('lib/element-blank-policy.ts')

/** The page's runner deps for one case (app/builder/page.tsx passes the same functions with the page's values). */
function caseDeps(name, generations, slide = { current: 0 }) {
  const world = { '07-failed-viewer-unavailable': 'off', '08-failed-element-not-found': 'on-element-removed', '09-failed-timeout': 'stalled' }[name] ?? 'on'
  const bridge = studioBridge(viewerRoute(world))
  const buildRefineContext = realBuildRefineContext()
  return {
    bridge,
    deps: {
      displayed: () => ({ sessionId: SESSION, deckOwnerSessionId: SESSION, presentationId: PRESENTATION, epoch: 0 }),
      isBusy: () => name === '03-dismissed',
      slideCount: () => 3,
      currentSlideIndex: () => slide.current,
      goToSlide: async index => { slide.current = index },
      sendElementCommand: bridge.sendElementCommand,
      componentTypeOf: payload => semantic.normalizeSemanticComponentType(payload.componentType ?? payload.elementType),
      isBlankPlaceholder: payload => blankPolicy.shouldOpenAsBlankPlaceholder(payload, undefined),
      buildRefineContext,
      generate: async (formData, invocation) => {
        generations.push({ formData: plain(formData), invocation: plain(invocation) })
        return name === '02-failed'
          ? { status: 'failed', presentationId: PRESENTATION, slideIndex: invocation.slideIndex, error: 'Synthetic Text Labs refusal' }
          : { status: 'inserted', presentationId: PRESENTATION, slideIndex: invocation.slideIndex, elementIds: ['el_chart_7f3a_refined'] }
      },
      settle: async () => {},
    },
  }
}

const userData = data => plain({ text: data.text, client_caps: data.client_caps ?? null, references: data.references ?? null })
for (const [name, transcript] of Object.entries(transcripts)) {
  await check(`replay ${name}: Studio's frames equal Director !511's recorded inbound frames`, async () => {
    const studioFlag = name !== '06-no-cap'
    const hook = await mountHook({ refineFlag: studioFlag })
    // The selection behind each recording: none (04), the recorded reference otherwise (Studio can only ever have one selection).
    const recordedUser = transcript.frames[0].frame
    assert.equal(recordedUser.type, 'user_message')
    const recordedRef = recordedUser.data.references?.[0] ?? null
    hook.probe.reference = recordedRef ? refine.chatElementReferenceFor({ elementId: recordedRef.element_id, elementType: recordedRef.element_type, slideIndex: recordedRef.slide_index, slideId: recordedRef.slide_id }) : null
    assert.equal(await hook.send(recordedUser.data.text), true)
    const sentUser = JSON.parse(hook.sent().at(-1))
    assert.equal(sentUser.type, 'user_message')
    const mine = userData(sentUser.data), theirs = userData(recordedUser.data)
    if (['10-two-elements', '11-off-list-type', '12-long-id'].includes(name)) {
      // Director's guard cases Studio never produces: Studio sends at most one valid reference and skips an invalid one entirely.
      assert.deepEqual(mine.client_caps, theirs.client_caps)
      if (name === '10-two-elements') assert.deepEqual(mine.references, [theirs.references[0]], 'one selection, one reference')
      else assert.equal(mine.references, null, 'an off-list type or an over-long id is not sent at all')
    } else if (name === '06-no-cap') {
      assert.deepEqual(mine.client_caps, theirs.client_caps, 'flag off: mdc1 only')
      assert.equal(mine.references, null, 'flag off: no element reference')
    } else assert.deepEqual(mine, theirs)
    assert.equal(hook.api.awaitingDirectorReply, true)

    const ids = new Map()
    const generations = []
    const slide = { current: 0 }
    const { deps, bridge } = caseDeps(name, generations, slide)
    let expectedInbound = transcript.frames.filter(f => f.direction === 'in').slice(1).map(f => f.frame)
    for (const entry of transcript.frames.slice(1)) {
      if (entry.direction === 'in') continue
      const before = hook.state()
      await hook.deliver(entry.frame)
      if (entry.frame.type !== 'element_refine_directive') {
        assert.ok(hook.api.messages.some(m => m.message_id === entry.frame.message_id), `${entry.frame.type} reaches the transcript as before`)
        continue
      }
      // The directive: out of band, never in the transcript or the cache, unlocks the turn, handed to the runner once with its socket.
      assert.equal(hook.seen.refineDirectives.length, 1)
      const { message, owner } = hook.seen.refineDirectives[0]
      assert.deepEqual(message, plain(entry.frame))
      assert.equal(owner.sessionId, SESSION); assert.equal(owner.isCurrent(), true)
      const after = hook.state()
      assert.deepEqual(after.messages, before.messages, 'the directive is not a chat message')
      assert.deepEqual(after.cache, before.cache, 'nor cached')
      assert.equal(after.awaiting, false, 'it answers the turn')
      const running = refine.runElementRefineDirective(message, owner, deps)
      if (name === '09-failed-timeout') { for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve)); bridge.fireTimers() }
      const result = await running
      if (owner.isCurrent()) hook.api.sendElementDirectiveResult(result)
      await hook.settle()
      const answer = JSON.parse(hook.sent().at(-1))
      const recordedAnswer = expectedInbound.shift()
      // Director's harness leaves error_code out when it is null; Studio always sends the key (design §5: "or null").
      const withNull = frame => ({ ...frame, data: { error_code: null, ...frame.data } })
      assert.deepEqual(normalise(answer, ids), normalise(withNull(recordedAnswer), ids))
    }
    assert.equal(expectedInbound.length, 0, 'every recorded Studio frame was produced')
    const directive = transcript.frames.find(f => f.frame.type === 'element_refine_directive')
    if (!directive) {
      assert.equal(hook.seen.refineDirectives.length, 0)
      assert.equal(hook.sent().filter(data => data.includes('element_directive_result')).length, 0, 'nothing to answer')
    }
    if (name === '01-success' || name === '02-failed') {
      assert.equal(generations.length, 1)
      const { formData, invocation } = generations[0]
      assert.equal(invocation.kind, 'chat-refine'); assert.equal(invocation.slideIndex, 2)
      assert.equal(invocation.refineContext.elementId, 'el_chart_7f3a'); assert.equal(invocation.refineContext.elementType, 'CHART')
      assert.deepEqual(invocation.refineContext.themeBindings, { fill: 'primary' })
      assert.equal(formData.componentType, 'CHART'); assert.equal(formData.prompt, 'make it a bar chart'); assert.equal(formData.useDeckTheme, true)
      assert.equal(slide.current, 2, 'the runner went to the directive\'s slide first')
    } else assert.equal(generations.length, 0, 'no generation was started')
    hook.unmount()
  })
}

await check('runner: not_owner, a busy panel mid-run, a slide the viewer cannot reach, a blank placeholder, an unknown type', async () => {
  const directive = transcripts['01-success'].frames[1].frame
  const owner = { sessionId: SESSION, isCurrent: () => true }
  const run = async (patch = {}, message = directive) => {
    const { deps } = caseDeps('01-success', [])
    return refine.runElementRefineDirective(message, owner, { ...deps, ...patch })
  }
  const status = r => `${r.status}${r.error_code ? `:${r.error_code}` : ''}`
  assert.equal(status(await run({}, { ...directive, payload: { ...directive.payload, presentation_id: 'pres-other' } })), 'failed:not_owner')
  assert.equal(status(await run({}, { ...directive, session_id: 's_other' })), 'failed:not_owner')
  assert.equal(status(await run({ displayed: () => ({ sessionId: SESSION, deckOwnerSessionId: 's_other', presentationId: PRESENTATION }) })), 'failed:not_owner')
  let n = 0
  assert.equal(status(await run({ displayed: () => ({ sessionId: SESSION, deckOwnerSessionId: SESSION, presentationId: PRESENTATION, epoch: n++ ? 1 : 0 }) })), 'failed:not_owner', 'the deck changed while it ran')
  assert.equal(status(await run({}, { ...directive, payload: { ...directive.payload, slide_index: 7 } })), 'failed:element_not_found')
  assert.equal(status(await run({}, { ...directive, payload: { ...directive.payload, slide_index: 1 } })), 'failed:element_not_found', 'the element is on another slide')
  assert.equal(status(await run({ goToSlide: null })), 'failed:viewer_unavailable')
  assert.equal(status(await run({ goToSlide: async () => {} })), 'failed:viewer_unavailable', 'the slide never showed')
  assert.equal(status(await run({ sendElementCommand: null })), 'failed:viewer_unavailable')
  let calls = 0
  assert.equal(status(await run({ isBusy: () => calls++ > 0 })), 'dismissed', 'the panel opened while the payload was read')
  assert.equal(status(await run({ componentTypeOf: () => null })), 'failed:generation_failed')
  assert.equal(status(await run({ isBlankPlaceholder: () => true })), 'failed:generation_failed')
  assert.equal(status(await run({}, { ...directive, payload: { ...directive.payload, instruction: '  ' } })), 'failed:generation_failed')
  assert.equal(status(await run({ generate: async () => { throw new Error('boom') } })), 'failed:generation_failed')
  assert.equal(status(await run({ generate: async () => ({ status: 'inserted', presentationId: 'pres-other', slideIndex: 2, elementIds: ['x'] }) })), 'failed:not_owner')
  assert.equal(status(await run({ buildRefineContext: () => { throw new Error('boom') } })), 'failed:generation_failed')
  assert.equal(status(await run({ displayed: () => { throw new Error('boom') } })), 'failed:generation_failed', 'an unexpected throw is still a known status')
  for (const r of [await run(), await run({ isBusy: () => true })]) assert.deepEqual(Object.keys(r), ['directive_id', 'status', 'element_id', 'error_code'])
  assert.deepEqual(plain(await run({ isBusy: () => true })), { directive_id: directive.payload.directive_id, status: 'dismissed', element_id: 'el_chart_7f3a', error_code: null })
})

await check('hook (flag on): a directive without a usable directive_id is dropped unanswered; a foreign socket\'s frames never reach the runner', async () => {
  const hook = await mountHook({ refineFlag: true })
  const directive = transcripts['01-success'].frames[1].frame
  await hook.deliver({ ...directive, payload: { ...directive.payload, directive_id: '' } })
  assert.equal(hook.seen.refineDirectives.length, 0)
  await hook.deliver(directive)
  assert.equal(hook.seen.refineDirectives.length, 1)
  const { owner } = hook.seen.refineDirectives[0]
  const stale = hook.env.sockets[0].onmessage
  assert.equal(typeof hook.api.disconnect, 'function')
  hook.api.disconnect()
  await hook.env.clock.advance(0, hook.settle)
  assert.equal(owner.isCurrent(), false, 'the owner of a directive retires with its socket (the page then sends no answer)')
  stale({ data: JSON.stringify(directive) })
  await hook.settle()
  assert.equal(hook.seen.refineDirectives.length, 1, 'a closed socket\'s frame never reaches the runner')
  hook.unmount()
})
