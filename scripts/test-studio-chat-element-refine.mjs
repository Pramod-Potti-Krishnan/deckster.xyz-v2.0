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
//  3. the 13 transcripts DIRECTOR-2 RECORDED from Director !511 (01-12, head 19d09d60) and !512 (13, head e29e1566) (scripts/fixtures/chat-element-refine/director-frames, copied verbatim)
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
// #472 (NEXT_PUBLIC_CHAT_THEME_CHANGE / NEXT_PUBLIC_CHAT_EXPORT) is stacked on this change: its flag-gated lines come out first, and its files are its own.
import { stripChatThemeExport } from './studio-chat-theme-export-strip.mjs'
import { stripModelCatalog } from './studio-model-catalog-strip.mjs' // #473 (NEXT_PUBLIC_STUDIO_MODEL_CATALOG), stacked on #472 on this change: its .env.example block and package.json line come out first
import { stripNarrationRouter } from './studio-narration-router-strip.mjs' // #475 (NARRATION_VIA_ROUTER), stacked on #473 on #472 on this change: its .env.example block and package.json line come out first
import { sameAsBase } from './studio-env-append-tolerant.mjs' // stacked after #475: the .env.example rule that takes a later change's block (scripts/studio-env-append-tolerant.mjs)
import { STACK, stackFileTolerant, stackMutants, stackScope, sameOrTolerant, stripMutants } from './studio-stack-tolerant.mjs' // stacked after #475: a later PR's files are not this change's to answer for, and a shared file a later PR edits too keeps its base lines and this change's (scripts/studio-stack-tolerant.mjs)
import { stripLaunchWording } from './studio-launch-wording-strip.mjs' // NEXT_PUBLIC_STUDIO_LAUNCH_WORDING (launched wording): its flag-gated edits come out first, before every older change's strip
import { stripFirstPaint } from './studio-first-paint-strip.mjs' // stacked: NEXT_PUBLIC_STUDIO_FIRST_PAINT_ENABLED (COMPOSER-2 first paint): its flag-gated viewer lines come out first, inside read(), next to stripLaunchWording
import { stripJobLedger } from './studio-job-ledger-strip.mjs' // stacked after #475: P3-4c (NEXT_PUBLIC_STUDIO_JOB_LEDGER) adds its flag-gated job_update intake to the hook's startConnection; declarations() takes its lines out first
import { stripBulkEditUndo } from './studio-bulk-edit-undo-strip.mjs' // stacked after #475: the bulk edit + chat undo change (NEXT_PUBLIC_STUDIO_BULK_EDIT / NEXT_PUBLIC_STUDIO_CHAT_UNDO) adds marked lines to the hook (a cap in buildUserMessage, a routing line in startConnection); declarations() takes them out first
const STACKED_NARRATION_ROUTER = /^(lib\/narration\/(model-router|draft|tts|spoken)\.ts|app\/api\/narration\/(render|script|speak)\/route\.ts|app\/api\/narration\/voice\/sample\/\[voiceId\]\/route\.ts|scripts\/(test-studio-narration-router|studio-narration-router-strip)\.mjs)$/ // #475's own files (stacked on #473)
const STACKED_MODEL_CATALOG = /^(app\/\(app\)\/studio\/intelligence\/layout\.tsx|app\/api\/models\/catalogue\/route\.ts|components\/studio-personal\/intelligence-models\.(css|tsx)|lib\/studio-model-catalog\.ts|scripts\/(test-studio-model-catalog|studio-model-catalog-strip)\.mjs|scripts\/fixtures\/studio-model-catalog\/.+)$/ // #473's own files (stacked on #472 on this change)
const STACKED_THEME_EXPORT = /^(lib\/chat-theme-export(-wire)?\.ts|scripts\/(test-studio-chat-theme-export|studio-chat-theme-export-strip)\.mjs|scripts\/fixtures\/chat-theme-export\/.+|docs\/pass3\/chat-theme-export\/LIVE-CHECK-PLAN\.md)$/
const STACKED_KNOWN = rel => STACKED_THEME_EXPORT.test(rel) || STACKED_MODEL_CATALOG.test(rel) || STACKED_NARRATION_ROUTER.test(rel) || /^scripts\/(test-)?studio-env-append-tolerant\.mjs$/.test(rel) // stacked after #475: the stack this test declares (#472, #473, #475 and #480's rule), for scripts/studio-stack-tolerant.mjs

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const FIXTURES = path.join(root, 'scripts/fixtures/chat-element-refine')
const addStrip = await import('./studio-chat-add-targeted-strip.mjs') // LATER-CHANGES: registry read (CHAT-ADD-TARGETED): the targeted chat add stacked after this change, so its marked lines in the generation hook come out first
const read = rel => addStrip.stripChatAddTargeted(rel, stripFirstPaint(rel, stripLaunchWording(rel, fs.readFileSync(path.join(root, rel), 'utf8')))) // LATER-CHANGES: registry read (CHAT-ADD-TARGETED): read through the later change's strip
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
const DIRECTOR_COMMIT_13 = 'e29e1566d4483bb6b213d4a65c4e92daf9078253'
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

await check('fixtures: the 13 recorded Director transcripts are from Director !511 head 19d09d60 with the planned flags', async () => {
  assert.deepEqual(Object.keys(transcripts), ['01-success', '02-failed', '03-dismissed', '04-g3-no-element-reference', '05-g5-slide-op-in-flight', '06-no-cap',
    '07-failed-viewer-unavailable', '08-failed-element-not-found', '09-failed-timeout', '10-two-elements', '11-off-list-type', '12-long-id', '13-non-refinable-type'])
  for (const [name, t] of Object.entries(transcripts)) {
    // 13 was recorded on DIRECTOR-2's follow-up (seat2/director-mdc-refine-element-types e29e1566, stacked on !511): the narrowed refinable set.
    assert.equal(t.director_commit, name === '13-non-refinable-type' ? DIRECTOR_COMMIT_13 : DIRECTOR_COMMIT, name)
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
  // DIRECTOR-2's answer 4 (22 Oct): outside the 7 K5 types, or a blank placeholder: unsupported_type, and nothing is generated.
  const started = []
  for (const type of ['INFOGRAPHIC', 'DIAGRAM', null]) {
    assert.equal(status(await run({ componentTypeOf: () => type, generate: async () => { started.push(type); throw new Error('must not start') } })), 'failed:unsupported_type', String(type))
  }
  assert.equal(status(await run({ isBlankPlaceholder: () => true, generate: async () => { started.push('blank'); throw new Error('must not start') } })), 'failed:unsupported_type')
  assert.deepEqual(started, [], 'no generation was started')
  for (const type of ['TEXT_BOX', 'METRICS', 'TABLE', 'CHART', 'IMAGE', 'ICON_LABEL', 'SHAPE']) assert.equal(status(await run({ componentTypeOf: () => type })), 'refined', type)
  assert.ok(refine.chatElementReferenceFor({ elementId: 'el_infographic_2b9e', elementType: 'infographic', slideIndex: 2, slideId: 'L2' }), 'references are still sent for all 19 types')
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

// ---- 4. the chat refine reaches the Element panel's refine branch of the REAL useTextLabsGeneration ----------------------------------
// The complete hook and the complete useGenerationPanel run with plain hook bindings (the way scripts/test-metrics-card-refine-integration.mjs
// runs them); Layout and Text Labs are local stand-ins that only record. The refine context is the page's buildRefineContext of the payload
// the REAL Layout command returned (layout-replies.json), and the form is the runner's.
async function generateThrough(invocationKind, processEnv) {
  const equalDeps = (a, b) => a?.length === b?.length && a.every((value, index) => Object.is(value, b[index]))
  let active
  const hooks = {
    useRef(value) { const s = active, i = s.cursor++; return s.slots[i] ??= { current: value } },
    useState(value) { const s = active, i = s.cursor++; if (!(i in s.slots)) s.slots[i] = typeof value === 'function' ? value() : value; return [s.slots[i], next => { const old = s.slots[i], v = typeof next === 'function' ? next(old) : next; if (!Object.is(old, v)) { s.slots[i] = v; s.dirty = true } }] },
    useCallback(fn, deps) { const s = active, i = s.cursor++, old = s.slots[i]; if (!old || !equalDeps(deps, old.deps)) s.slots[i] = { value: fn, deps }; return s.slots[i].value },
    useMemo(fn, deps) { const s = active, i = s.cursor++, old = s.slots[i]; if (!old || !equalDeps(deps, old.deps)) s.slots[i] = { value: fn(), deps }; return s.slots[i].value },
    useEffect(fn, deps) { const s = active, i = s.cursor++, old = s.slots[i]; if (!old || !equalDeps(deps, old.deps)) s.pending.push(() => { old?.cleanup?.(); s.slots[i] = { deps, cleanup: fn() } }) },
  }
  const scope = () => ({ slots: [], cursor: 0, pending: [], dirty: false })
  const render = (s, fn) => { let result, n = 0; do { s.cursor = 0; s.pending = []; s.dirty = false; active = s; result = fn(); s.pending.forEach(effect => effect()); assert.ok(++n < 20) } while (s.dirty); return result }
  const cache = new Map(), fetches = [], commands = [], toasts = []
  const load = file => {
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }; cache.set(file, module)
    const out = ts.transpileModule(read(file), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
    vm.runInNewContext(out, { module, exports: module.exports, process: { env: processEnv }, Error, TypeError, DOMException, AbortController, URL, Date, Map, Set, setTimeout, clearTimeout,
      crypto: { randomUUID: () => crypto.randomUUID() }, FormData, Blob, console: { log() {}, info() {}, debug() {}, warn() {}, error() {} },
      fetch: async (url, init) => {
        const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body instanceof FormData ? Object.fromEntries(init.body.entries()) : null
        fetches.push({ url: String(url), body })
        return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ success: true, elements: [{ element_id: 'tl-chart-1', component_type: 'CHART', html: '<div>Synthetic bar chart</div>', content: '<div>Synthetic bar chart</div>' }] }) }
      },
      WebSocket: () => { throw new Error('no sockets') },
      require: spec => spec === 'react' ? hooks : spec.startsWith('@/') ? load([`${spec.slice(2)}.ts`, `${spec.slice(2)}.tsx`].find(f => fs.existsSync(path.join(root, f)))) : (() => { throw new Error(`unexpected ${spec}`) })() }, { filename: file })
    return module.exports
  }
  const { useTextLabsGeneration } = load('hooks/use-textlabs-generation.ts')
  const { useGenerationPanel } = load('hooks/use-generation-panel.ts')
  const panelScope = scope(), genScope = scope()
  const panel = render(panelScope, useGenerationPanel)
  const api = {
    sendElementCommand: async (action, params) => {
      commands.push({ action, params: plain(params) })
      if (action === 'getElementGeometry') return { success: true, action, elementId: params.elementId, position: { gridRow: '5/18', gridColumn: '2/16' }, componentType: 'CHART', themeVariantId: 'solid', themeBindings: { fill: 'primary' } }
      if (action === 'getSlideGenerationContext') return { success: true, slide_index: params.slideIndex, elements: [] }
      if (action.startsWith('insert') || action.startsWith('upsert')) return { success: true, elementId: 'el_chart_7f3a_refined' }
      return { success: true }
    },
  }
  api.captureStudioElementGeneration = () => ({ isCurrent: () => true, sendElementCommand: api.sendElementCommand })
  const themeSync = { status: 'applied', requestId: 'synthetic-theme-request', presentationId: PRESENTATION, themeFingerprint: 'synthetic-theme', error: null }
  const params = { generationPanel: panel, blankElements: { getElement: () => undefined, updatePosition() {}, setStatus() {}, updateGenerationMetadata() {}, removeElement() {}, addElement() {}, trackElement() {} },
    textLabsSession: { ensureSession: async () => 'synthetic-textlabs-session' }, layoutServiceApis: api, presentationId: PRESENTATION, currentSlideIndex: 2, getCurrentSlideIndex: () => 2,
    researchCapabilities: { web: false, uploadedDocuments: false, knowledgeGraph: false }, getThemeSyncSnapshot: () => ({ ...themeSync }),
    ensureThemeReady: async () => ({ ready: true, source: 'director', sync: { ...themeSync } }), toast: value => toasts.push(plain(value)) }
  const driver = render(genScope, () => useTextLabsGeneration(params))
  const payload = recorded.replies.on[0].reply.data
  const refineContext = realBuildRefineContext()(payload, 'CHART')
  const formData = refine.chatRefineFormData('CHART', 'make it a bar chart', refineContext)
  const invocation = invocationKind === 'chat-refine' ? { kind: 'chat-refine', slideIndex: 2, refineContext } : { kind: 'chat-add', slideIndex: 2 }
  const outcome = await driver.handleGenerate(formData, 'generate', invocation)
  return { outcome: plain(outcome), fetches, commands, toasts, panel: plain({ isOpen: panelScope.slots && render(panelScope, useGenerationPanel).isOpen }) }
}
const SHELL = { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_TEXT_LABS_URL: 'https://textlabs.synthetic.test', NEXT_PUBLIC_ELEMENTOR_URL: 'https://textlabs.synthetic.test' }
await check('generation: with the flag on, kind chat-refine runs the REAL hook\'s refine branch (Text Labs refines; the original is replaced in place)', async () => {
  const run = await generateThrough('chat-refine', { ...SHELL, NEXT_PUBLIC_CHAT_ELEMENT_REFINE: 'true' })
  assert.deepEqual(run.outcome, { status: 'inserted', presentationId: PRESENTATION, slideIndex: 2, elementIds: ['el_chart_7f3a_refined'] })
  assert.equal(run.fetches.length, 1, 'one Text Labs request')
  const { url, body } = run.fetches[0]
  assert.equal(url, 'https://textlabs.synthetic.test/api/chat/message')
  assert.equal(body.refine, true, 'a refine, not an add')
  assert.equal(body.replace_element_id, 'el_chart_7f3a'); assert.equal(body.existing_element.element_id, 'el_chart_7f3a')
  assert.equal(body.existing_element.component_type, 'CHART'); assert.deepEqual(body.existing_element.generation_config, { prompt: 'Revenue by region', chart_type: 'line' })
  assert.equal(body.message, 'make it a bar chart'); assert.equal(body.component_type, 'CHART'); assert.equal(body.slide_index, 2)
  assert.equal(body.use_deck_theme, true); assert.equal(body.theme_variant_id, 'solid'); assert.deepEqual(body.theme_bindings, { fill: 'primary' })
  assert.deepEqual(body.position_config, { start_col: 2, start_row: 5, position_width: 14, position_height: 13, auto_position: false }, 'the live geometry, so it stays in place')
  assert.deepEqual(run.commands.map(c => c.action), ['setElementGenerationState', 'getElementGeometry', 'getSlideGenerationContext', 'insertChart', 'deleteElement'])
  assert.deepEqual(run.commands[0].params, { elementId: 'el_chart_7f3a', generating: true, label: 'Regenerating…' })
  assert.equal(run.commands[3].params.gridRow, '5/18'); assert.equal(run.commands[3].params.gridColumn, '2/16')
  assert.equal(run.commands[4].params.elementId, 'el_chart_7f3a', 'the original goes once its replacement is in')
  assert.match(run.commands[3].params.mutationId, /^refine:el_chart_7f3a:/)
  // The same call with the flag off is NOT a refine (the invocation's target is ignored): only the flag-on runner ever builds it.
  const off = await generateThrough('chat-refine', { ...SHELL })
  assert.equal(off.fetches.length, 1); assert.equal(off.fetches[0].body.refine, undefined); assert.equal(off.fetches[0].body.replace_element_id, undefined)
  assert.deepEqual(off.commands.map(c => c.action), ['getSlideGenerationContext', 'insertChart'])
  // And chat-add, flag on or off, is exactly what it was: no refine.
  for (const env of [SHELL, { ...SHELL, NEXT_PUBLIC_CHAT_ELEMENT_REFINE: 'true' }]) {
    const add = await generateThrough('chat-add', env)
    assert.equal(add.fetches[0].body.refine, undefined); assert.deepEqual(add.commands.map(c => c.action), ['getSlideGenerationContext', 'insertChart'])
  }
})

// ---- 5. flag off is identical -------------------------------------------------------------------------------------------------------
await check(`identity: stripping this change gives back ${BASE_COMMIT.slice(0, 7)}'s files byte for byte; every added literal occurs once`, async () => {
  const strip = await import('./studio-chat-element-refine-strip.mjs')
  assert.deepEqual(CHAT_ELEMENT_REFINE_FILES, ['.env.example', 'package.json', 'app/builder/page.tsx', HOOK, 'hooks/use-textlabs-generation.ts', 'types/mdc.ts'])
  assert.equal(JSON.parse(read('package.json')).scripts['test:studio-chat-element-refine'], 'node scripts/test-studio-chat-element-refine.mjs', 'registered in package.json')
  // The flag's block appears once, after the base's Pass 3 blocks and before FRONTEND-1's PASS2 ADMIN block (its test applies mutants with lastIndexOf, so Admin and Docs stay last).
  const env = read('.env.example'), line = 'NEXT_PUBLIC_CHAT_ELEMENT_REFINE="false"\n'
  assert.equal(env.split(line).length, 2, 'the flag is documented once')
  assert.ok(!env.includes('# PASS2 ADMIN') || env.indexOf(line) < env.indexOf('# PASS2 ADMIN'), 'the block sits before the PASS2 ADMIN block')
  for (const phrase of ['an exact "true" turns it on', 'READ AT BUILD TIME: set it on Vercel', 'It needs no other flag', 'exact "true" enables it']) {
    assert.ok(!env.slice(env.indexOf('# PASS3 REFINE AN ELEMENT FROM CHAT'), env.indexOf(line)).includes(phrase), `the block reuses no other block's phrase: ${phrase}`)
  }
  for (const rel of CHAT_ELEMENT_REFINE_FILES) {
    const head = stripChatThemeExport(rel, stripModelCatalog(rel, stripNarrationRouter(rel, read(rel)))) // #475's lines out first (stacked), then #473's, then #472's (all stacked on this change)
    for (const [added] of strip.CHAT_ELEMENT_REFINE_CHANGES[rel]) assert.equal(head.split(added).length, 2, `${rel}: one occurrence`)
    if (rel === '.env.example') { assert.ok(sameAsBase(rel, stripChatElementRefine(rel, head), baseFile(rel), /NEXT_PUBLIC_CHAT_ELEMENT_REFINE\b/), rel); continue } // stacked after #475: .env.example may take a later change's block; every other file stays byte for byte, below
    { const v = sameOrTolerant(rel, head, stripChatElementRefine(rel, head), baseFile(rel), strip.CHAT_ELEMENT_REFINE_CHANGES[rel]); assert.ok(v.ok, `${rel}: ${v.reason}`); if (!v.exact) continue } // stacked after #475: when a later PR edited this shared file too, its base lines stay in order and this change's lines are all in HEAD and none is left (scripts/studio-stack-tolerant.mjs); otherwise byte for byte, below
    assert.equal(sha(stripChatElementRefine(rel, head)), sha(baseFile(rel)), rel)
  }
  // Nothing else in the tree differs from the base but this change's new files.
  // The committed tree against the base (not the working tree: a suite neighbour that rewrites docs/ while it runs must not count).
  const changed = git('diff', '--name-only', BASE_COMMIT, 'HEAD', '--', '.').split('\n').filter(Boolean)
  changed.splice(0, changed.length, ...changed.filter(rel => !/^(app\/api\/templates\/\[id\]\/route\.ts|components\/studio-libraries\/(library-manage|templates-workspace)\.tsx|hooks\/use-templates\.ts|lib\/studio-library-manage\.ts|scripts\/(studio-library-manage-strip|test-studio-route-params|test-studio-template-library-manage|test-studio-theme-library-manage)\.mjs|scripts\/fixtures\/template-rename\/.+)$/.test(rel))) // stacked after #475: the template rename's own files (PR #477) are not this change's to answer for
  // New files, and the older pins / strip roots that now read through scripts/studio-chat-element-refine-strip.mjs (one import + one call each).
  const NEW = /^(lib\/chat-element-refine(-wire)?\.ts|scripts\/(test-studio-chat-element-refine|studio-chat-element-refine-(layout|strip))\.mjs|scripts\/fixtures\/chat-element-refine\/.+|docs\/pass3\/chat-element-refine\/LIVE-CHECK-PLAN\.md)$/
  const READS_THROUGH_STRIP = ['scripts/studio-add-slide-status-strip.mjs', 'scripts/studio-open-read-only-strip.mjs', 'scripts/studio-theme-dark-persist-strip.mjs',
    'scripts/test-studio-add-element-ownership.mjs', 'scripts/test-studio-director-transport.mjs', 'scripts/test-studio-element-free-spot.mjs',
    'scripts/test-studio-element-placeholder-fix.mjs', 'scripts/test-studio-image-pending-write.mjs', 'scripts/test-theme-font-selection.mjs',
    // after the fae96200 base merge: the merged Pass 3 pins that hold the hook / types/mdc.ts to their own bases, and the library-manage stacked-file list
    'scripts/test-studio-duplicate-deck.mjs', 'scripts/test-studio-deck-mutation-dedupe.mjs', 'scripts/studio-library-manage-harness.mjs']
  for (const rel of READS_THROUGH_STRIP) {
    if (rel === 'scripts/studio-library-manage-harness.mjs') { const v = stackFileTolerant(git('show', `${STACK[475].head}:${rel}`), read(rel)); assert.ok(v.ok, `${rel}: ${v.reason}`); if (!v.exact) continue } // stacked after #475: a later PR's lines in the harness are taken, the stack's (#475's head) kept in order (scripts/studio-stack-tolerant.mjs); as the stack left it, it is checked below as before
    const removed = git('diff', '-U0', BASE_COMMIT, '--', rel).split('\n').filter(line => line.startsWith('-') && !line.startsWith('---'))
    const added = git('diff', '-U0', BASE_COMMIT, '--', rel).split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++'))
    added.splice(0, added.length, ...added.filter(line => !/^\+import \{ strip(PublishReviewFit|VersionHistoryDeckOnly|ComposeEntitlement) \} from '\.\/studio-(publish-review-fit|version-history-deck-only|compose-entitlement)-strip\.mjs'/.test(line))) // stacked after #475: the E2E-2 stack (#492 publish review fit, #493 version history deck only, #494 compose entitlement) adds one strip import each to the roots
    added.splice(0, added.length, ...added.filter(line => !/^\+import \{ strip(PublishPreviewInventory|PaymentsOpenSoon) \} from '\.\/studio-(publish-preview-inventory|payments-open-soon)-strip\.mjs'/.test(line))) // #475 stacked: the strip roots' two later import lines (#495's publish preview inventory and payments open soon) are those changes', not this change's
    added.splice(0, added.length, ...added.filter(line => !/^\+import \{ stripBulkEditUndo \} from '\.\/studio-bulk-edit-undo-strip\.mjs'/.test(line))) // stacked after #475: the bulk edit + chat undo change (NEXT_PUBLIC_STUDIO_BULK_EDIT / NEXT_PUBLIC_STUDIO_CHAT_UNDO) chains its strip into this root with one import line; that line is a later PR's, not this change's
    const stacked = added.some(line => /chat-theme-export|CHAT_THEME_EXPORT/.test(line)) // #472's own import and call on the same lines
    assert.ok(added.filter(line => !/FRONTEND-1 template rename|'app\/api\/templates\/\[id\]\/route\.ts'/.test(line)).length <= (stacked ? 10 : 5) && removed.length <= 2, `${rel}: an import and one call (${added.length}+/${removed.length}-)`) // stacked after #475: minus the template rename's (PR #477) two lines in the stacked list
    assert.ok(added.some(line => /stripChatElementRefine|CHAT_ELEMENT_REFINE_ENABLED: false|chat-element-refine/.test(line)), rel)
  }
  { const scope = stackScope(changed, STACK[470], STACKED_KNOWN); assert.equal(STACK[470].base, BASE_COMMIT); assert.deepEqual(git('diff', '--name-only', STACK[470].base, STACK[470].head).split('\n').filter(Boolean), STACK[470].files, 'the frozen files are #470\'s own diff'); assert.deepEqual({ missing: scope.missing, stray: scope.stray }, { missing: [], stray: [] }, 'every frozen file is changed, no stray in its family'); console.log(scope.line); changed.splice(0, changed.length, ...scope.checked) } // stacked after #475: only this change's files, its family and its declared stack are checked below; a later PR's files are ignored, with a count
  for (const rel of changed) assert.ok(CHAT_ELEMENT_REFINE_FILES.includes(rel) || NEW.test(rel) || READS_THROUGH_STRIP.includes(rel) || STACKED_THEME_EXPORT.test(rel) || STACKED_MODEL_CATALOG.test(rel) || STACKED_NARRATION_ROUTER.test(rel) || /^scripts\/(test-)?studio-env-append-tolerant\.mjs$/.test(rel), `unexpected change: ${rel}`) // #475's files are stacked, and so are the append-tolerant .env.example rule and its test
})

await check('identity: this change\'s own head (aa0cfee) without its lines is its base (8d5c494) byte for byte, file by file: fixed inputs, whatever later PRs put in HEAD or where (stacked after #475)', async () => { assert.equal(STACK[470].base, BASE_COMMIT); for (const rel of CHAT_ELEMENT_REFINE_FILES) assert.equal(sha(stripChatElementRefine(rel, git('show', `${STACK[470].head}:${rel}`))), sha(git('show', `${STACK[470].base}:${rel}`)), rel) }) // stacked after #475, scripts/studio-stack-tolerant.mjs
await check('identity: every added piece is behind the flag (or is a type, a comment or the flag-gated import)', async () => {
  const strip = await import('./studio-chat-element-refine-strip.mjs')
  for (const rel of CHAT_ELEMENT_REFINE_FILES) for (const [added, original] of strip.CHAT_ELEMENT_REFINE_CHANGES[rel]) {
    const addedLines = added.split('\n').filter(line => !original.split('\n').includes(line)).join('\n')
    // types/mdc.ts is types only (no runtime); package.json registers the test; .env.example documents the flag; every other hunk names the flag or the chat-refine kind.
    const gated = rel === 'types/mdc.ts' || rel === 'package.json' || /NEXT_PUBLIC_CHAT_ELEMENT_REFINE|CHAT_ELEMENT_REFINE_ENABLED|chat-refine/.test(addedLines)
    assert.ok(gated, `${rel}: ${addedLines.slice(0, 200)}`)
  }
})

// The reducer, cache, history-restore and send code paths: unchanged declarations hash-equal the base; the two that gained one flag-gated
// branch (buildUserMessage and so sendMessage, startConnection) hash-equal the base once that branch is stripped. The session cache and history restore files are untouched.
function declarations(text, names, file = HOOK) {
  text = stripJobLedger(file, text) // stacked after #475: P3-4c's flag-gated hook and page lines come out first (scripts/studio-job-ledger-strip.mjs); a base text has none
  text = stripBulkEditUndo(file, text) // stacked after #475: the bulk edit + chat undo change's marked hook lines come out too (scripts/studio-bulk-edit-undo-strip.mjs); a base text has none
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const found = {}
  const visit = node => {
    if ((ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node)) && names.includes(node.name?.getText(ast)) && !found[node.name.getText(ast)]) found[node.name.getText(ast)] = node.getText(ast)
    ts.forEachChild(node, visit)
  }
  visit(ast)
  for (const name of names) assert.ok(found[name], `${file} declares ${name}`)
  return found
}
const UNCHANGED_HOOK = ['setStateWithCache', 'clearAwaitReply', 'beginAwaitReply', 'sendMessageWhenConnected', 'sendElementDirectiveResult', 'sendControlMessage',
  'sendThemeSelection', 'restoreMessages', 'updateCacheUserMessages', 'clearMessages', 'ensureConnected', 'connect', 'disconnect', 'scheduleReconnect']
const STRIPPED_HOOK = ['buildUserMessage', 'sendMessage', 'startConnection']
const PAGE_PATHS = ['handleSendMessage', 'preflightDirectorTurn', 'handleActionClick', 'handleRefineElementRequested', 'getTemplateSlotCatalog']
const identityHashes = {}
await check('identity: reducer / cache / history-restore / send paths hash-equal the base (stripped only where the flag branch sits)', async () => {
  const head = read(HOOK), base = baseFile(HOOK)
  const h = declarations(head, [...UNCHANGED_HOOK, ...STRIPPED_HOOK]), b = declarations(base, [...UNCHANGED_HOOK, ...STRIPPED_HOOK])
  for (const name of UNCHANGED_HOOK) { assert.equal(sha(h[name]), sha(b[name]), name); identityHashes[`hook.${name}`] = sha(h[name]) }
  const hs = declarations(stripChatElementRefine(HOOK, stripChatThemeExport(HOOK, head)), STRIPPED_HOOK)
  for (const name of STRIPPED_HOOK) { assert.notEqual(sha(h[name]), sha(b[name]), `${name} carries the flag branch`); assert.equal(sha(hs[name]), sha(b[name]), name); identityHashes[`hook.${name}(stripped)`] = sha(hs[name]) }
  // The reducer: the onmessage setState through the transcript exclusion list is untouched text (it sits inside startConnection).
  const reducer = text => text.slice(text.indexOf('            // Turn gate: any reply-bearing frame unlocks the input.'), text.indexOf("            if ((message.type as string) === 'session_directive') {"))
  assert.ok(reducer(head).length > 2000); assert.equal(sha(reducer(head)), sha(reducer(base))); identityHashes['hook.reducer'] = sha(reducer(head))
  for (const rel of ['hooks/use-session-cache.ts', 'hooks/use-builder-session.ts', 'components/builder/message-list.tsx', 'lib/director-chat-history.ts', 'lib/mdc-element-directive.ts', 'components/presentation-viewer.tsx', 'lib/element-command-router.ts']) {
    if (stripBulkEditUndo(rel, read(rel)) !== read(rel)) { assert.equal(sha(stripBulkEditUndo(rel, read(rel))), sha(baseFile(rel)), rel); identityHashes[rel] = sha(baseFile(rel)); continue } // stacked after #475: the bulk edit + chat undo change's marked lines (NEXT_PUBLIC_STUDIO_BULK_EDIT / NEXT_PUBLIC_STUDIO_CHAT_UNDO) in a file it shares with the chat hard rule come out first; flags off, the file is this base's byte for byte
    assert.equal(sha(read(rel)), sha(baseFile(rel)), rel); identityHashes[rel] = sha(read(rel))
  }
  const page = read('app/builder/page.tsx'), basePage = baseFile('app/builder/page.tsx')
  const p = declarations(page, PAGE_PATHS, 'app/builder/page.tsx'), bp = declarations(basePage, PAGE_PATHS, 'app/builder/page.tsx')
  for (const name of PAGE_PATHS) { assert.equal(sha(p[name]), sha(bp[name]), `page ${name}`); identityHashes[`page.${name}`] = sha(p[name]) }
})

/** Every frame of every transcript, then a send of each kind: what the hook does with them, as bytes and state. */
async function hookTrace({ refineFlag, hookText, extraEnv }) {
  const hook = await mountHook({ refineFlag, hookText, extraEnv })
  hook.probe.reference = refine.chatElementReferenceFor(SELECTED_CHART)
  const trace = []
  await hook.send('Make this a bar chart')
  await hook.send('@[Slide 1: Overview] make it shorter')
  for (const [name, transcript] of Object.entries(transcripts)) {
    for (const entry of transcript.frames) if (entry.direction === 'out') { await hook.deliver({ ...entry.frame, message_id: `${name}-${entry.seq}` }); trace.push(hook.state()) }
  }
  hook.api.sendElementDirectiveResult({ directive_id: 'el_synthetic', status: 'inserted', element_id: 'x', error: null })
  await hook.settle()
  const result = { sent: hook.sent(), trace, refineDirectives: hook.seen.refineDirectives.length, onMessage: hook.seen.onMessage, elementDirectives: hook.seen.elementDirectives }
  hook.unmount()
  return result
}
await check('identity: the base hook and this hook, flag off, give the same bytes, transcript, cache and callbacks for all 13 transcripts and the sends', async () => {
  for (const extraEnv of [{}, { NEXT_PUBLIC_CHAT_MENTIONS: 'true' }, { NEXT_PUBLIC_CHAT_DIRECTIVES: 'false' }]) {
    const base = await hookTrace({ refineFlag: false, hookText: baseFile(HOOK), extraEnv })
    for (const flagValue of [undefined, 'false', '1', 'TRUE']) {
      const head = await hookTrace({ refineFlag: false, hookText: null, extraEnv: { ...extraEnv, ...(flagValue === undefined ? {} : { NEXT_PUBLIC_CHAT_ELEMENT_REFINE: flagValue }) } })
      assert.deepEqual(head, base, `${JSON.stringify(extraEnv)} flag=${flagValue}`)
    }
    assert.equal(base.refineDirectives, 0)
    for (const [index, data] of base.sent.entries()) if (data.startsWith('{"type":"user_message"')) identityHashes[`send.${JSON.stringify(extraEnv)}.${index}`] = sha(data)
  }
  const on = await hookTrace({ refineFlag: true, hookText: null, extraEnv: {} })
  const off = await hookTrace({ refineFlag: false, hookText: null, extraEnv: {} })
  assert.equal(on.refineDirectives, 6, 'flag on: the six recorded directives (01, 02, 03, 07, 08, 09) reach the runner')
  // Flag on, the sends differ only by the cap and the reference; the transcript and cache are the same frame for frame.
  const strip = data => { const frame = JSON.parse(data); if (frame.type === 'user_message') { frame.data.client_caps = frame.data.client_caps.filter(c => c !== 'element_refine1'); frame.data.references = frame.data.references?.filter(r => r.kind !== 'element'); if (!frame.data.references?.length) delete frame.data.references } return JSON.stringify(frame) }
  assert.deepEqual(on.sent.map(strip), off.sent, 'sends')
  // ... and the transcript and the cache are the same after every frame (only the turn gate differs: a directive unlocks it with the flag on).
  const view = trace => trace.map(({ messages, cache, presentationId }) => ({ messages, cache, presentationId }))
  assert.deepEqual(view(on.trace), view(off.trace), 'transcript and cache')
})

// ---- 6. the page's own wiring, executed ---------------------------------------------------------------------------------------------
const PAGE = 'app/builder/page.tsx'
const pageText = read(PAGE)
const pageAst = ts.createSourceFile(PAGE, pageText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
function findNode(predicate, node = pageAst) {
  if (predicate(node)) return node
  let hit = null
  ts.forEachChild(node, child => { if (!hit) hit = findNode(predicate, child) })
  return hit
}
const jsOf = text => ts.transpileModule(`(${text})`, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
const runnerNode = findNode(node => ts.isBinaryExpression(node) && node.left.getText(pageAst) === 'elementRefineDirectiveRunnerRef.current')
const addRunnerNode = findNode(node => ts.isBinaryExpression(node) && node.left.getText(pageAst) === 'elementDirectiveRunnerRef.current')
const selectionEffects = []
findNode(node => {
  if (ts.isCallExpression(node) && node.expression.getText(pageAst) === 'useEffect' && node.arguments[0]?.getText(pageAst).includes('chatElementSelectionRef.current =')) selectionEffects.push(node)
  return false
})
const hookCall = findNode(node => ts.isCallExpression(node) && node.expression.getText(pageAst) === 'useDecksterWebSocketV2')
const refineOptions = hookCall && hookCall.arguments[0].properties.find(p => ts.isSpreadAssignment(p) && p.getText(pageAst).includes('onElementRefineDirective'))

await check('page: wired only behind the flag, next to the K5 add runner, on the same owner record', async () => {
  assert.ok(runnerNode && addRunnerNode && refineOptions)
  assert.ok(runnerNode.getStart(pageAst) > addRunnerNode.getEnd(), 'after the add runner')
  assert.ok(pageText.slice(addRunnerNode.getEnd(), runnerNode.getStart(pageAst)).split('\n').length < 40, 'right beside it')
  assert.match(runnerNode.right.getText(pageAst), /^!CHAT_ELEMENT_REFINE_ENABLED \? null : \(message, owner\) => \{/)
  assert.match(refineOptions.expression.getText(pageAst), /^\(CHAT_ELEMENT_REFINE_ENABLED \? \{[\s\S]*\} : \{\}\)$/)
  assert.match(refineOptions.getText(pageAst), /getChatElementReference: \(\) => chatElementReferenceFor\(chatElementSelectionRef\.current\)/)
  assert.equal(selectionEffects.length, 2)
  for (const effect of selectionEffects) assert.match(effect.arguments[0].getText(pageAst), /^\(\) => \{\n    if \(!CHAT_ELEMENT_REFINE_ENABLED\) return\n/)
  assert.match(pageText, /function normalizeTextLabsElementType\(value: unknown\): TextLabsComponentType \| null \{\n  return normalizeSemanticComponentType\(value\)\n\}/, 'the type mapping the runner test uses')
  assert.match(pageText, /import \{ CHAT_ELEMENT_REFINE_ENABLED, chatElementReferenceFor, runElementRefineDirective, type ChatElementSelection, type ElementRefineDirectiveMessage, type ElementRefineDirectiveOwner \} from '@\/lib\/chat-element-refine'\n/)
})

/** The page's runner expression, evaluated with the page's names bound to local stand-ins (the generation is the recorded case's). */
function pageRunner(scope) {
  return vm.runInNewContext(jsOf(runnerNode.right.getText(pageAst)), { ...scope, Promise, setTimeout: (fn) => { fn(); return 0 }, String })
}
await check('page: its runner answers on the delivering socket only, once per directive, and turns a second directive away while one runs', async () => {
  const sentResults = []
  const generations = []
  const { deps } = caseDeps('01-success', generations, { current: 2 })
  let release
  const gate = new Promise(resolve => { release = resolve })
  const scope = {
    CHAT_ELEMENT_REFINE_ENABLED: true, runElementRefineDirective: refine.runElementRefineDirective,
    chatElementRefineInFlightRef: { current: false },
    elementDirectiveGenerationOwnerRef: { current: { sessionId: SESSION, deckOwnerSessionId: SESSION, presentationId: PRESENTATION, epoch: 3 } },
    generationPanel: { hasActiveGenerations: false, getSnapshot: () => ({ isOpen: false }) },
    slideStructure: { slides: [{}, {}, {}] }, currentSlideIndexRef: { current: 2 },
    layoutServiceApis: { goToSlide: deps.goToSlide, sendElementCommand: deps.sendElementCommand },
    normalizeTextLabsElementType: semantic.normalizeSemanticComponentType, shouldOpenAsBlankPlaceholder: blankPolicy.shouldOpenAsBlankPlaceholder,
    blankElements: { getElement: () => undefined }, buildRefineContext: deps.buildRefineContext,
    handleApprovedTextLabsGenerate: async (formData, intent, invocation) => { assert.equal(intent, 'generate'); await gate; return deps.generate(formData, invocation) },
    sendElementDirectiveResult: data => { sentResults.push(plain(data)); return true },
  }
  const runner = pageRunner(scope)
  const directive = transcripts['01-success'].frames[1].frame
  let current = true
  runner(directive, { sessionId: SESSION, isCurrent: () => current })
  for (let i = 0; i < 20 && !generations.length && scope.chatElementRefineInFlightRef.current; i++) await new Promise(resolve => setImmediate(resolve))
  runner({ ...directive, payload: { ...directive.payload, directive_id: 'elr_000000000002' } }, { sessionId: SESSION, isCurrent: () => true })
  for (let i = 0; i < 20 && sentResults.length < 1; i++) await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(sentResults, [{ directive_id: 'elr_000000000002', status: 'dismissed', element_id: 'el_chart_7f3a', error_code: null }], 'the second waits for nothing: dismissed')
  release()
  for (let i = 0; i < 40 && sentResults.length < 2; i++) await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(sentResults[1], { directive_id: directive.payload.directive_id, status: 'refined', element_id: 'el_chart_7f3a', error_code: null })
  assert.equal(scope.chatElementRefineInFlightRef.current, false, 'free again')
  // A socket that retired meanwhile gets no answer.
  current = false
  runner(directive, { sessionId: SESSION, isCurrent: () => current })
  for (let i = 0; i < 40; i++) await new Promise(resolve => setImmediate(resolve))
  assert.equal(sentResults.length, 2)
  assert.equal(vm.runInNewContext(jsOf(runnerNode.right.getText(pageAst)), { ...scope, CHAT_ELEMENT_REFINE_ENABLED: false }), null, 'flag off: no runner')
})

await check('page: the selection effects record the slide on screen at selection time and clear with the selection; flag off they record nothing', async () => {
  const [textEffect, elementEffect] = selectionEffects.map(effect => jsOf(effect.arguments[0].getText(pageAst)))
  const run = (code, scope) => vm.runInNewContext(code, scope)()
  const ref = { current: null }
  const slideStructure = { slides: [{ slide_id: 'L0' }, { slide_id: 'L1' }, { slide_id: 'L2' }] }
  const base = { CHAT_ELEMENT_REFINE_ENABLED: true, chatElementSelectionRef: ref, slideStructure, currentSlideIndexRef: { current: 2 } }
  run(elementEffect, { ...base, selectedElementId: 'el_chart_7f3a', selectedElementType: 'chart' })
  assert.deepEqual(plain(ref.current), SELECTED_CHART)
  assert.deepEqual(plain(refine.chatElementReferenceFor(ref.current)), transcripts['01-success'].frames[0].frame.data.references[0], 'exactly the recorded reference')
  run(textEffect, { ...base, selectedTextBoxId: null })
  assert.ok(ref.current, 'a text box deselect leaves an element selection alone')
  run(textEffect, { ...base, selectedTextBoxId: 'el_title_0', currentSlideIndexRef: { current: 0 } })
  assert.deepEqual(plain(ref.current), { elementId: 'el_title_0', elementType: 'TEXT_BOX', slideIndex: 0, slideId: 'L0' })
  run(elementEffect, { ...base, selectedElementId: null, selectedElementType: null })
  assert.ok(ref.current, 'an element deselect leaves a text box selection alone')
  run(textEffect, { ...base, selectedTextBoxId: null })
  assert.equal(ref.current, null)
  const off = { current: null }
  run(elementEffect, { ...base, CHAT_ELEMENT_REFINE_ENABLED: false, chatElementSelectionRef: off, selectedElementId: 'el_chart_7f3a', selectedElementType: 'chart' })
  assert.equal(off.current, null)
})

// ---- negative controls: each piece is load-bearing --------------------------------------------------------------------------------
await check('mutation: without the hook interception the directive never reaches the runner', async () => {
  const mutated = read(HOOK).replace('if (CHAT_ELEMENT_REFINE_ENABLED && (parsedMessage.type as unknown) === ELEMENT_REFINE_DIRECTIVE_TYPE) {', 'if (false) {')
  assert.notEqual(mutated, read(HOOK))
  const hook = await mountHook({ refineFlag: true, hookText: mutated })
  await hook.deliver(transcripts['01-success'].frames[1].frame)
  assert.equal(hook.seen.refineDirectives.length, 0)
  hook.unmount()
})
await check('mutation: without the send line there is no element_refine1 and no reference', async () => {
  const mutated = read(HOOK).replace('      if (CHAT_ELEMENT_REFINE_ENABLED) addChatElementRefineFields(', '      if (false) addChatElementRefineFields(')
  assert.notEqual(mutated, read(HOOK))
  const hook = await mountHook({ refineFlag: true, hookText: mutated })
  hook.probe.reference = refine.chatElementReferenceFor(SELECTED_CHART)
  await hook.send('Make this a bar chart')
  const data = JSON.parse(hook.sent().at(-1)).data
  assert.deepEqual(data.client_caps, ['mdc1']); assert.equal(data.references, undefined)
  hook.unmount()
})
await check('mutation: the base refineContext line in useTextLabsGeneration makes the chat refine an add (the refine-branch check catches it)', async () => {
  const head = read('hooks/use-textlabs-generation.ts')
  const mutated = stripChatElementRefine('hooks/use-textlabs-generation.ts', head)
  assert.equal(mutated, baseFile('hooks/use-textlabs-generation.ts'))
  const original = fs.readFileSync
  const target = path.join(root, 'hooks/use-textlabs-generation.ts')
  fs.readFileSync = function (file, ...rest) { return path.resolve(String(file)) === target ? mutated : original.call(this, file, ...rest) }
  let run
  try { run = await generateThrough('chat-refine', { ...SHELL, NEXT_PUBLIC_CHAT_ELEMENT_REFINE: 'true' }) } finally { fs.readFileSync = original }
  assert.equal(run.fetches[0].body.refine, undefined, 'no refine without the change')
})
await check('mutation: dropping the blank-placeholder rule would start a generation for a blank (an INFOGRAPHIC still has no form)', async () => {
  const text = read('lib/chat-element-refine.ts')
  const mutated = text.replace(' || deps.isBlankPlaceholder(refinePayload)) {', ') {')
  assert.notEqual(mutated, text)
  const weak = loadPure('lib/chat-element-refine.ts', { NEXT_PUBLIC_CHAT_ELEMENT_REFINE: 'true' }, { 'lib/chat-element-refine.ts': mutated })
  const generations = []
  const { deps } = caseDeps('01-success', generations, { current: 2 })
  const owner = { sessionId: SESSION, isCurrent: () => true }, directive = transcripts['01-success'].frames[1].frame
  assert.equal((await weak.runElementRefineDirective(directive, owner, { ...deps, isBlankPlaceholder: () => true })).status, 'refined')
  assert.equal(generations.length, 1, 'the mutation starts a generation; the real rule does not (runner check above)')
  // Without the 7-type rule an INFOGRAPHIC is still refused, by the missing K5 form (defence in depth), and nothing starts.
  const noTypeRule = loadPure('lib/chat-element-refine.ts', { NEXT_PUBLIC_CHAT_ELEMENT_REFINE: 'true' }, { 'lib/chat-element-refine.ts': text.replace("!(DIRECTIVE_TYPES as readonly string[]).includes(componentType) || ", '') })
  assert.equal((await noTypeRule.runElementRefineDirective(directive, owner, { ...deps, componentTypeOf: () => 'INFOGRAPHIC' })).error_code, 'unsupported_type')
  assert.equal(generations.length, 1)
})
await check('mutation: the .env.example rule refuses an edited base line and takes a later block of another flag (stacked after #475)', async () => { const base = baseFile('.env.example'), edited = base.replace(/^NEXTAUTH_URL=.*$/m, '$&x'), own = /NEXT_PUBLIC_CHAT_ELEMENT_REFINE\b/; assert.ok(edited !== base && !sameAsBase('.env.example', edited, base, own) && sameAsBase('.env.example', `${base}\n# a later change\nNEXT_PUBLIC_SOME_OTHER_FLAG="false"\n`, base, own)) }) // stacked after #475, #473's rule
await check('mutation: the stack-tolerant rules refuse a base line dropped from a shared file, this change\'s line left after its strip or gone from HEAD, an own file missing and a stray in its family; they take a later PR\'s line and file (stacked after #475)', async () => { const { CHAT_ELEMENT_REFINE_CHANGES } = await import('./studio-chat-element-refine-strip.mjs'); const shared = CHAT_ELEMENT_REFINE_FILES.filter(rel => rel !== '.env.example').map(rel => ({ rel, head: stripChatThemeExport(rel, stripModelCatalog(rel, stripNarrationRouter(rel, read(rel)))), strip: text => stripChatElementRefine(rel, text), base: baseFile(rel), changes: CHAT_ELEMENT_REFINE_CHANGES[rel] })); const results = stackMutants({ change: STACK[470], changed: git('diff', '--name-only', BASE_COMMIT, 'HEAD', '--', '.').split('\n').filter(Boolean), known: STACKED_KNOWN, shared, kept: [{ rel: 'scripts/studio-library-manage-harness.mjs', stack: git('show', `${STACK[475].head}:scripts/studio-library-manage-harness.mjs`), head: read('scripts/studio-library-manage-harness.mjs') }] }); for (const [label, held] of results) assert.ok(held, label); console.log(`stack-tolerant (#470): ${results.filter(([label]) => label.includes('mutant:')).length} mutants caught, ${results.filter(([label]) => label.includes('control:')).length} controls taken`) }) // stacked after #475, scripts/studio-stack-tolerant.mjs
await check('mutation: the strip module edited fails on fixed inputs (this change\'s own head and base, and its package.json line in the middle of the base\'s list): its env block leaves its blank line, its last package.json entry keeps the comma, or a middle one stays (stacked after #475)', async () => { const head = rel => git('show', `${STACK[470].head}:${rel}`), base = rel => git('show', `${STACK[470].base}:${rel}`), prev = '    "test:studio-p2-profile-page": "node scripts/test-studio-p2-profile-page.mjs"', mine = '    "test:studio-chat-element-refine": "node scripts/test-studio-chat-element-refine.mjs"', later = '    "test:studio-later": "node scripts/test-studio-later.mjs"'; const holds = strip => CHAT_ELEMENT_REFINE_FILES.every(rel => strip(rel, head(rel)) === base(rel)) && strip('package.json', base('package.json').replace(`${prev}\n`, `${prev},\n${mine},\n${later}\n`)) === base('package.json').replace(`${prev}\n`, `${prev},\n${later}\n`); const results = stripMutants(read('scripts/studio-chat-element-refine-strip.mjs'), source => new Function(`${source.replace(/^export /gm, '')}\nreturn { stripChatElementRefine }`)().stripChatElementRefine, holds, [['NEXT_PUBLIC_CHAT_ELEMENT_REFINE=\\"false\\"\\n\\n", "\\n"]', 'NEXT_PUBLIC_CHAT_ELEMENT_REFINE=\\"false\\"\\n", "\\n"]', 'the env block strip leaves its blank line'], ["text.replace(last, '\\n')", "text.replace(last, ',\\n')", 'the entry before its last package.json line keeps the comma'], [": text.replace(`${PACKAGE_LINE},\\n`, '')", ': text', 'its package.json line in the middle of the list stays']]); for (const [label, held] of results) assert.ok(held, label); console.log(`strip mutants on fixed inputs (#470): ${results.length - 1} caught`) }) // stacked after #475, scripts/studio-stack-tolerant.mjs

if (process.argv.includes('--print-hashes')) console.log(JSON.stringify(identityHashes, null, 2))
console.log(`${passed} chat element refine checks passed; ${failed.length} failed. ${live ? 'Layout: live real code.' : 'Layout: recorded real replies.'} Recorded Director frames, offline, no network.`)
if (failed.length) process.exitCode = 1
