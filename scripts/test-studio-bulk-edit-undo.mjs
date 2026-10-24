// FRONTEND-2 (PROGRAM-1 SUPERCHARGE I2): proof for the Studio side of DIRECTOR-2's whole-deck edits and chat undo
//   NEXT_PUBLIC_STUDIO_BULK_EDIT  (default off): the confirm card for a whole-deck edit, per-slide receipts as they arrive, an honest summary.
//   NEXT_PUBLIC_STUDIO_CHAT_UNDO  (default off): a small "Undo" chip under the Director chat line that reported a change; one undo frame; deck_restored replaces the viewer.
//   Both draw only when Director advertises it (sync_response.payload.chat_capabilities: bulk_edit, chat_undo); with both flags off nothing changes.
// Plain node, no browser, no network, no services, no paid call, one process (about a minute): the REAL TypeScript is transpiled and run in a vm; the REAL MessageList, confirm card and Undo chip are
// server-rendered with react-dom, and the clicks go through the same components under a small hooks runtime (state kept between renders). The look is judged from the real stylesheet and the shell's own
// colour tokens (contrast in light and dark); the before / after PNGs are the caller's (the steps are in the report).
//   DERIVED  scripts/fixtures/bulk-edit-undo/*.json: frames built from the FINAL I2 wire as DIRECTOR-2 relayed it (not recordings). Each file says so in "provenance" and holds the frames in arrival order, so
//            DIRECTOR-2's record.py frames replace them file for file. Nothing below is RECORDED.
//   1. flags      exact "true" only, read in the modules that read them (and nowhere else)
//   2. handshake  client_caps bulk_edit1 / undo1, each with its own flag, after the other caps; capabilities from sync_response; absent = nothing drawn
//   3. wire       every frame parsed in lib/studio-bulk-edit-wire.ts: valid, malformed (null, never a throw), hostile objects
//   4. store      routing, order, sessions, presentations, bulks kept apart, the latest-change-only rule, the one undo
//   5. cards      confirm card (count, chips, Director's estimate label, one answer, disabled after), receipts any order, summaries, Undo chip states, the clicks and the exact frames sent
//   6. hookup     the real MessageList: card and chip where they belong, the generic ask otherwise, malformed draws nothing
//   7. deck       deck_restored: accepted with the undo flag only, a whole-viewer refresh plan; the other mutations are untouched
//   8. flag off   MessageList markup and the deck_mutation plan are the base commit's, hashed
//   9. change     strip = BASE_COMMIT byte for byte, the roots, the harness, .env.example, scope (the COMMITTED diff only), secret scan, no Layout write, the look
//  10. mutants    each one must make sections 1-9 fail
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { BASE_COMMIT, BULK_EDIT_UNDO_CHANGES, BULK_EDIT_UNDO_FILES, BULK_EDIT_UNDO_NEW_FILES, BULK_EDIT_UNDO_PIN_FILES } from './studio-bulk-edit-undo-strip.mjs'
import { stripOpenReadOnly } from './studio-open-read-only-strip.mjs'
import { stripDarkPersist } from './studio-theme-dark-persist-strip.mjs'
import { stripAddSlideStatus } from './studio-add-slide-status-strip.mjs'
import { STACKED_PASS3_FILES } from './studio-library-manage-harness.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nodeRequire = createRequire(import.meta.url)
const BASE = process.env.BULK_EDIT_UNDO_BASE || BASE_COMMIT
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
const baseCache = new Map()
const baseOf = rel => { if (!baseCache.has(rel)) baseCache.set(rel, git('show', `${BASE}:${rel}`)); return baseCache.get(rel) }
let overrides = {} // in-memory mutations: the suite reads every source through read()
const read = rel => (rel in overrides ? overrides[rel] : fs.readFileSync(path.join(root, rel), 'utf8'))
const sha = value => crypto.createHash('sha256').update(value).digest('hex')
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value))

const WIRE = 'lib/studio-bulk-edit-wire.ts', STORE = 'lib/studio-bulk-edit-store.ts', CARD = 'components/builder/chat/studio-bulk-edit-card.tsx', CHIP = 'components/builder/chat/studio-undo-chip.tsx'
const CSS = 'components/builder/chat/studio-bulk-edit-undo.css', LIST = 'components/builder/message-list.tsx', HOOK = 'hooks/use-deckster-websocket-v2.ts', MDC = 'types/mdc.ts'
const REFRESH = 'lib/studio-deck-mutation-refresh.ts', ENV = '.env.example', HARNESS = 'scripts/studio-library-manage-harness.mjs', STRIP_MODULE = 'scripts/studio-bulk-edit-undo-strip.mjs', SHELL_CSS = 'components/layout/studio-shell.css'
const ROOTS = ['scripts/studio-open-read-only-strip.mjs', 'scripts/studio-theme-dark-persist-strip.mjs', 'scripts/studio-add-slide-status-strip.mjs']
const BULK = 'NEXT_PUBLIC_STUDIO_BULK_EDIT', UNDO = 'NEXT_PUBLIC_STUDIO_CHAT_UNDO', SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const MISSPELLED = [undefined, '', 'false', 'FALSE', 'TRUE', 'True', '1', 'yes', 'on', ' true', 'true ', 'true\n']
const MARKER = 'BULK-EDIT-UNDO'
const ON = { [BULK]: 'true', [UNDO]: 'true', [SHELL]: 'true' }, OFF = { [SHELL]: 'true' }, ONLY_BULK = { [BULK]: 'true', [SHELL]: 'true' }, ONLY_UNDO = { [UNDO]: 'true', [SHELL]: 'true' }

// ---------------------------------------------------------------- fixtures: RECORDED (DIRECTOR-2, real Director code) and DERIVED
// RECORDED  scripts/fixtures/bulk-edit-undo/0*.json: DIRECTOR-2's five offline record.py transcripts, copied verbatim (director_commit 8258481b, Director draft !542, branch seat2/director-bulk-edit-undo @ 89c51c57): the real
//           WebSocketHandler and DecisionEngine over scripted model output and a fake socket, $0, no network. Each holds {direction: "in" | "out", frame}; "out" is exactly what Director sent, "in" what Studio sends.
//           01 the confirm card, 02 a run with one failure, 03 every slide skipped, 04 undo restored, 05 undo superseded.
// DERIVED   every other frame below says so: the sync_response that advertises the capabilities (the recorder drives _process_message and never a sync), the deck's titles (the wire carries none), the all-failed run
//           (recording 02 with every receipt failed), a newer change_recorded, a second bulk, and every malformed or hostile frame.
const REC_NAMES = ['01-bulk-confirm-card', '02-bulk-run-one-failure', '03-bulk-all-skipped', '04-undo-restored', '05-undo-superseded']
const REC = Object.fromEntries(REC_NAMES.map(name => [name, JSON.parse(fs.readFileSync(path.join(root, 'scripts/fixtures/bulk-edit-undo', `${name}.json`), 'utf8'))])) // RECORDED
const clone = value => JSON.parse(JSON.stringify(value))
const out = name => REC[name].frames.filter(item => item.direction === 'out').map(item => clone(item.frame))
const inbound = name => REC[name].frames.filter(item => item.direction === 'in').map(item => clone(item.frame))
const CONFIRM = out('01-bulk-confirm-card')[0]
const SID = CONFIRM.session_id, ASK_ID = CONFIRM.message_id, BULK_ID = CONFIRM.payload.bulk_edit.bulk_id
const CHANGE_04 = out('04-undo-restored').find(frame => frame.type === 'change_recorded'), PRES = CHANGE_04.payload.presentation_id
const IDS = CONFIRM.payload.bulk_edit.slide_ids, N = IDS.length
const TITLES = ['Welcome', 'Why now', 'Market size', 'Our approach', 'Roadmap'] // DERIVED: the deck's own titles, which no frame carries
const SYNC = { type: 'sync_response', message_id: 'msg_sync_derived', session_id: SID, timestamp: '2026-10-24T12:15:00.000Z', role: 'assistant', // DERIVED: Director's sync_response advertising both capabilities
  payload: { action: 'skip_history', message_count: 2, current_state: 'REFINE_STRAWMAN', has_strawman: true, presentation_id: PRES, slide_count: N, chat_capabilities: { bulk_edit: true, chat_undo: true } } }
const DECK_RESTORED = out('04-undo-restored').find(frame => frame.type === 'deck_mutation' && frame.payload.mutation === 'deck_restored')
const framesOf = name => [clone(SYNC), ...out(name)] // a socket's frames in arrival order, after the sync
const askOf = name => out(name).find(frame => frame.type === 'action_request')
const withBulk = (change, base = CONFIRM) => { const frame = clone(base); change(frame.payload.bulk_edit, frame.payload, frame); return frame }
const syncWith = caps => { const frame = clone(SYNC); if (caps === undefined) delete frame.payload.chat_capabilities; else frame.payload.chat_capabilities = caps; return frame }
const progressFrame = (index, status, reason, bulkId = BULK_ID, slideId) => ({ type: 'bulk_edit_progress', message_id: `p${index}`, session_id: SID, role: 'assistant', payload: { bulk_id: bulkId, slide_id: slideId === undefined ? IDS[index] : slideId, slide_index: index, status, reason: reason ?? null } }) // DERIVED
const summaryFrame = (done, failed, skipped, total = N, bulkId = BULK_ID) => ({ type: 'bulk_edit_summary', message_id: 's1', session_id: SID, role: 'assistant', payload: { bulk_id: bulkId, done, failed, skipped, total } }) // DERIVED
const changeFrame = (id, label = 'Changed 4 slides', kind = 'bulk_edit', presentation = PRES) => ({ type: 'change_recorded', message_id: `c_${id}`, session_id: SID, role: 'assistant', payload: { change_id: id, label, kind, presentation_id: presentation, undoable: true } }) // DERIVED
const undoResultFrame = (id, status, reason) => ({ type: 'undo_result', message_id: `u_${id}`, session_id: SID, role: 'assistant', payload: { change_id: id, status, reason: reason ?? null } }) // DERIVED
const chatFrame = (id, text = 'Done with that one.') => ({ type: 'chat_message', message_id: id, session_id: SID, timestamp: '2026-10-24T12:20:00.000Z', role: 'assistant', payload: { text, sub_title: null, list_items: null, format: 'markdown', ephemeral: false } }) // DERIVED
const allFailed = () => out('02-bulk-run-one-failure').map(frame => { // DERIVED from recording 02: every receipt failed, the summary says so
  if (frame.type === 'bulk_edit_progress') { frame.payload.status = 'failed'; frame.payload.reason = 'refine_failed' }
  if (frame.type === 'bulk_edit_summary') Object.assign(frame.payload, { done: 0, failed: 5, skipped: 0 })
  return frame
}).filter(frame => frame.type !== 'deck_mutation' && frame.type !== 'change_recorded')
const CTX = (extra = {}) => ({ sessionId: SID, presentationId: PRES, isCurrent: true, slideTitles: () => IDS.map((id, at) => ({ slide_id: id, title: TITLES[at] })), ...extra })

// ---------------------------------------------------------------- loading: the real TypeScript in a vm, one world per flag set
const compileCache = new Map()
function compile(rel, text) {
  const cacheId = `${rel}\0${text}`
  if (!compileCache.has(cacheId)) compileCache.set(cacheId, ts.transpileModule(text, { fileName: rel, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)
  return compileCache.get(cacheId)
}
/** A fake React whose hooks keep their state between renders, to click through the real components without a DOM. */
function fakeReact() {
  const real = nodeRequire('react'), slots = []
  let cursor = 0
  return {
    api: { ...real, useState(init) { const at = cursor++; if (!(at in slots)) slots[at] = typeof init === 'function' ? init() : init; return [slots[at], value => { slots[at] = typeof value === 'function' ? value(slots[at]) : value }] },
      useEffect() {}, useSyncExternalStore(_subscribe, get) { return get() } },
    begin() { cursor = 0 },
  }
}
function world({ env = {}, ref = false, fake = null } = {}) {
  const registry = new Map(), fetches = []
  const textOf = rel => (rel in overrides ? overrides[rel] : ref ? baseOf(rel) : fs.readFileSync(path.join(root, rel), 'utf8'))
  const exists = rel => { try { if (rel in overrides) return true; if (ref) { baseOf(rel); return true } return fs.statSync(path.join(root, rel)).isFile() } catch { return false } }
  function load(rel) {
    if (registry.has(rel)) return registry.get(rel).exports
    const module = { exports: {} }; registry.set(rel, module)
    const resolve = (spec, from) => {
      const base = spec.startsWith('@/') ? spec.slice(2) : path.posix.join(path.posix.dirname(from), spec)
      for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) if (/\.tsx?$/.test(base + ext) && exists(base + ext)) return base + ext
      throw Error(`unresolved ${spec} from ${rel}`)
    }
    const req = spec => spec.endsWith('.css') ? {} : spec === 'react' && fake ? fake.api : spec.startsWith('@/') || spec.startsWith('.') ? load(resolve(spec, rel)) : nodeRequire(spec)
    const fetchStub = (...args) => { fetches.push(args); throw new Error('no network from this feature') }
    vm.runInThisContext(`(function(exports, require, module, __filename, process, fetch){${compile(rel, textOf(rel))}\n})`, { filename: rel })(module.exports, req, module, rel, { env: { ...env } }, fetchStub)
    return module.exports
  }
  return { load, fetches }
}
const React = nodeRequire('react'), { renderToStaticMarkup } = nodeRequire('react-dom/server')
const text = html => html.replace(/<[^>]*>/g, ' ').replace(/&quot;|&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()

/** Walks a React element tree (function components are not expanded) for host elements. */
function findAll(node, test, found = []) {
  if (Array.isArray(node)) { for (const child of node) findAll(child, test, found); return found }
  if (!node || typeof node !== 'object' || !('props' in node)) return found
  if (typeof node.type === 'string' && test(node)) found.push(node)
  findAll(node.props?.children, test, found)
  return found
}
const buttonOf = (tree, attr, value) => findAll(tree, node => node.type === 'button' && node.props[attr] === value)[0]

// ---------------------------------------------------------------- the suite
const results = { passed: 0, failed: [] }
let STOP = false
let LAST = ''
async function check(name, fn) {
  try { await fn(); results.passed++ } catch (error) {
    if (STOP) { LAST = `${name} :: ${String(error?.message ?? error).split('\n')[0].slice(0, 110)}`; throw error }
    results.failed.push(name); console.log(`FAIL ${name}\n     ${String(error?.stack ?? error).split('\n').slice(0, 7).join('\n     ')}`)
  }
}

async function suite() {
  const w = {}
  const wire = (env = ON) => (w[`wire${JSON.stringify(env)}`] ??= world({ env }).load(WIRE))
  const stores = (env = ON) => { const wd = world({ env }); return { wd, store: wd.load(STORE), wire: wd.load(WIRE) } }
  const freshStore = (env = ON) => { const { store, wire: wr, wd } = stores(env); const instance = store.createBulkEditUndoStore(); return { store, wire: wr, wd, instance } }

  // ---- 1. flags
  await check('flags: exact "true" only, each flag read where it should be and nowhere else', () => {
    for (const value of MISSPELLED) {
      const wr = world({ env: { [BULK]: value, [UNDO]: value } }).load(WIRE)
      assert.equal(wr.STUDIO_BULK_EDIT_ENABLED, false, `bulk ${JSON.stringify(value)}`); assert.equal(wr.STUDIO_CHAT_UNDO_ENABLED, false, `undo ${JSON.stringify(value)}`)
      assert.equal(wr.STUDIO_BULK_EDIT_UNDO_ENABLED, false); assert.deepEqual(plain(wr.BULK_EDIT_UNDO_CLIENT_CAPS), [])
      const frame = clone(DECK_RESTORED); assert.equal(wr.normaliseDeckRestored(frame), false, `deck_restored is left alone for ${JSON.stringify(value)}`); assert.deepEqual(frame, DECK_RESTORED)
    }
    const only = (env) => world({ env }).load(WIRE)
    assert.equal(only({ [BULK]: 'true' }).STUDIO_BULK_EDIT_ENABLED, true); assert.equal(only({ [BULK]: 'true' }).STUDIO_CHAT_UNDO_ENABLED, false)
    assert.equal(only({ [UNDO]: 'true' }).STUDIO_CHAT_UNDO_ENABLED, true); assert.equal(only({ [UNDO]: 'true' }).STUDIO_BULK_EDIT_ENABLED, false)
    const files = git('ls-files', '-co', '--exclude-standard', 'lib', 'components', 'hooks', 'app', 'types').split('\n').filter(rel => /\.(tsx?|css)$/.test(rel) && (rel in overrides || fs.existsSync(path.join(root, rel))))
    const readers = name => files.filter(rel => new RegExp(`process\\.env\\.${name}\\b`).test(read(rel))).sort()
    assert.deepEqual(readers(BULK), [WIRE], 'NEXT_PUBLIC_STUDIO_BULK_EDIT is read in the wire adapter only')
    assert.deepEqual(readers(UNDO), [WIRE], 'NEXT_PUBLIC_STUDIO_CHAT_UNDO is read in the wire adapter only')
  })

  // ---- 2. handshake
  await check('handshake: bulk_edit1 / undo1 in client_caps, each with its own flag, after the other caps; flags off adds nothing', () => {
    const caps = env => plain(world({ env }).load(WIRE).BULK_EDIT_UNDO_CLIENT_CAPS)
    assert.deepEqual(caps({}), []); assert.deepEqual(caps({ [BULK]: 'true' }), ['bulk_edit1']); assert.deepEqual(caps({ [UNDO]: 'true' }), ['undo1']); assert.deepEqual(caps(ON), ['bulk_edit1', 'undo1'])
    const add = (env, data) => plain(world({ env }).load(WIRE).addBulkEditUndoCaps(data))
    assert.deepEqual(add(ON, { text: 'hi', client_caps: ['mdc1', 'element_refine1'] }).client_caps, ['mdc1', 'element_refine1', 'bulk_edit1', 'undo1'])
    assert.deepEqual(add(ON, { text: 'hi', client_caps: ['mdc1', 'bulk_edit1'] }).client_caps, ['mdc1', 'bulk_edit1', 'undo1'])
    assert.deepEqual(add(ON, { text: 'hi' }).client_caps, ['bulk_edit1', 'undo1']); assert.deepEqual(add({ [UNDO]: 'true' }, { client_caps: ['mdc1'] }).client_caps, ['mdc1', 'undo1'])
    assert.deepEqual(add({}, { client_caps: ['mdc1'] }).client_caps, ['mdc1'], 'both flags off: the caps are unchanged')
    const hook = read(HOOK)
    assert.match(hook, /if \(BULK_EDIT_UNDO_CLIENT_CAPS\.length > 0\) addBulkEditUndoCaps\(message\.data as unknown as Record<string, unknown>\); \/\/ BULK-EDIT-UNDO/, 'the hook adds the caps only when this build has any')
    assert.ok(hook.indexOf('addChatElementRefineFields(message.data') < hook.indexOf('addBulkEditUndoCaps(message.data'), 'after the element refine cap, like it')
  })
  await check('capabilities: only sync_response.payload.chat_capabilities, a key counts only when exactly true', () => {
    const { parseChatCapabilities } = wire()
    const caps = frame => plain(parseChatCapabilities(frame))
    assert.deepEqual(caps(SYNC), { bulkEdit: true, chatUndo: true }); assert.deepEqual(caps(syncWith({ bulk_edit: true })), { bulkEdit: true, chatUndo: false })
    assert.deepEqual(caps(syncWith({ chat_undo: true, qa: true })), { bulkEdit: false, chatUndo: true })
    assert.deepEqual(caps(syncWith({ bulk_edit: 'true', chat_undo: 1 })), { bulkEdit: false, chatUndo: false }); assert.deepEqual(caps(syncWith(undefined)), { bulkEdit: false, chatUndo: false })
    assert.deepEqual(caps(syncWith([])), { bulkEdit: false, chatUndo: false }); assert.equal(caps({ type: 'chat_message', payload: {} }), null); assert.equal(caps(null), null); assert.equal(caps('x'), null)
    assert.deepEqual(caps({ type: 'sync_response', payload: 'nope' }), { bulkEdit: false, chatUndo: false })
  })

  // ---- 3. wire
  await check('recorded: DIRECTOR-2\'s frames are what the fixtures say, and every frame of this feature parses with the names the adapter reads', () => {
    const wr = wire()
    for (const name of REC_NAMES) { assert.equal(REC[name].director_commit, '8258481ba51a0c1279ef6bf7e76bee7c40a5b8c1', name); assert.deepEqual(REC[name].client_caps, ['mdc1', 'bulk_edit1', 'undo1'], name); assert.equal(REC[name].frames.length, REC[name].frame_counts.in + REC[name].frame_counts.out, name) }
    assert.deepEqual(REC_NAMES.map(name => [REC[name].frame_counts.in, REC[name].frame_counts.out]), [[1, 1], [2, 19], [2, 9], [2, 8], [2, 7]])
    const seen = {}
    for (const name of REC_NAMES) for (const frame of out(name)) {
      assert.equal(frame.session_id, SID, `${name}: one session`); assert.equal(frame.role, 'assistant')
      const parsed = { bulk_edit_progress: wr.parseBulkEditProgress, bulk_edit_summary: wr.parseBulkEditSummary, change_recorded: wr.parseChangeRecorded, undo_result: wr.parseUndoResult }[frame.type]
      if (parsed) { assert.notEqual(parsed(frame), null, `${name}: a recorded ${frame.type} parses`); seen[frame.type] = (seen[frame.type] ?? 0) + 1 }
      if (frame.type === 'action_request') { assert.notEqual(wr.parseBulkEditConfirm(frame), null, `${name}: the recorded confirm parses`); seen.confirm = (seen.confirm ?? 0) + 1 }
      if (frame.type === 'chat_message') assert.notEqual(wr.parseDirectorChatTurn(frame), null, `${name}: a recorded chat line is a Director turn`)
    }
    assert.deepEqual(seen, { confirm: 3, bulk_edit_progress: 10, bulk_edit_summary: 2, change_recorded: 3, undo_result: 2 })
    const sent = name => inbound(name).map(frame => frame.data.action_value).filter(Boolean)
    assert.deepEqual(sent('02-bulk-run-one-failure'), [`confirm_bulk_edit:${askOf('02-bulk-run-one-failure').payload.bulk_edit.bulk_id}`]); assert.equal(plain(wr.parseBulkEditConfirm(askOf('02-bulk-run-one-failure'))).confirm.value, sent('02-bulk-run-one-failure')[0], 'the answer Studio sends is the recorded inbound action_value')
    for (const name of ['04-undo-restored', '05-undo-superseded']) { const id = out(name).find(frame => frame.type === 'change_recorded').payload.change_id; assert.deepEqual(sent(name), [`undo_change:${id}`], name); assert.equal(wr.undoChangeAction(id).value, sent(name)[0], 'the undo Studio sends is the recorded inbound action_value') }
    assert.deepEqual(out('04-undo-restored').map(frame => frame.type), ['chat_message', 'slide_ready', 'deck_mutation', 'chat_message', 'change_recorded', 'undo_result', 'chat_message', 'deck_mutation'], 'the order: closing line, change_recorded; then undo_result, line, deck_restored')
    assert.deepEqual(out('05-undo-superseded').map(frame => frame.type), ['chat_message', 'slide_ready', 'deck_mutation', 'chat_message', 'change_recorded', 'undo_result', 'chat_message'])
  })
  await check('wire: the confirm frame parses to the card model (Director\'s words, no credits, usd kept but never drawn)', () => {
    const { parseBulkEditConfirm, bulkEditChoiceOf, isBulkEditConfirmFrame } = wire()
    const model = plain(parseBulkEditConfirm(CONFIRM))
    assert.equal(model.bulkId, BULK_ID); assert.equal(model.instruction, 'Shorten the title'); assert.deepEqual(model.slideIndexes, [0, 1, 2, 3, 4]); assert.equal(model.slideCount, 5)
    assert.deepEqual(model.slideIds, ['L0', 'L1', 'L2', 'L3', 'L4']); assert.equal(model.estimateLabel, 'about $0.25 to $0.50'); assert.equal(model.estimateUsd, 0.5)
    assert.deepEqual(model.confirm, { label: 'Change 5 slides', value: `confirm_bulk_edit:${BULK_ID}` }); assert.deepEqual(model.cancel, { label: 'Cancel', value: `cancel_bulk_edit:${BULK_ID}` })
    assert.equal(isBulkEditConfirmFrame(CONFIRM), true); assert.equal(isBulkEditConfirmFrame({ ...CONFIRM, payload: { ...CONFIRM.payload, kind: 'other' } }), false)
    assert.equal(bulkEditChoiceOf(parseBulkEditConfirm(CONFIRM), `confirm_bulk_edit:${BULK_ID}`), 'confirm'); assert.equal(bulkEditChoiceOf(parseBulkEditConfirm(CONFIRM), `cancel_bulk_edit:${BULK_ID}`), 'cancel')
    assert.equal(bulkEditChoiceOf(parseBulkEditConfirm(CONFIRM), 'confirm_bulk_edit:other'), null); assert.equal(bulkEditChoiceOf(parseBulkEditConfirm(CONFIRM), undefined), null)
    const noEstimate = plain(parseBulkEditConfirm(withBulk(bulk => { delete bulk.estimate }))); assert.equal(noEstimate.estimateLabel, null); assert.equal(noEstimate.estimateUsd, null)
    const noIds = plain(parseBulkEditConfirm(withBulk(bulk => { delete bulk.slide_ids }))); assert.deepEqual(noIds.slideIds, [null, null, null, null, null])
    const two = plain(parseBulkEditConfirm(withBulk(bulk => { bulk.slide_indexes = [2, 4]; bulk.slide_ids = ['L2', null]; bulk.slide_count = 2 })))
    assert.deepEqual(two.slideIndexes, [2, 4]); assert.deepEqual(two.slideIds, ['L2', null]); assert.equal(two.slideCount, 2)
  })
  await check('wire: a malformed confirm is null (and says it was meant as one), never a throw', () => {
    const { parseBulkEditConfirm, isBulkEditConfirmFrame } = wire()
    const bad = { // DERIVED from recording 01, one field changed each
      'no bulk_edit': withBulk((_b, p) => { delete p.bulk_edit }), 'bulk_edit not an object': withBulk((_b, p) => { p.bulk_edit = 'x' }), 'no bulk_id': withBulk(b => { delete b.bulk_id }), 'empty bulk_id': withBulk(b => { b.bulk_id = '' }),
      'bulk_id with a space': withBulk(b => { b.bulk_id = 'a b' }), 'bulk_id too long': withBulk(b => { b.bulk_id = 'x'.repeat(129) }), 'bulk_id a number': withBulk(b => { b.bulk_id = 7 }),
      'no instruction': withBulk(b => { delete b.instruction }), 'blank instruction': withBulk(b => { b.instruction = '   ' }), 'no slide_indexes': withBulk(b => { delete b.slide_indexes }), 'empty slide_indexes': withBulk(b => { b.slide_indexes = [] }),
      'negative index': withBulk(b => { b.slide_indexes[0] = -1 }), 'fractional index': withBulk(b => { b.slide_indexes[0] = 0.5 }), 'string index': withBulk(b => { b.slide_indexes[0] = '0' }), 'duplicate index': withBulk(b => { b.slide_indexes[1] = 0 }),
      'too many slides': withBulk(b => { b.slide_indexes = Array.from({ length: 201 }, (_, i) => i); b.slide_count = 201 }), 'wrong count (6 for 5)': withBulk(b => { b.slide_count = 6 }), 'wrong count (4 for 5)': withBulk(b => { b.slide_count = 4 }),
      'no count': withBulk(b => { delete b.slide_count }), 'count as a string': withBulk(b => { b.slide_count = '5' }), 'ids shorter': withBulk(b => { b.slide_ids = b.slide_ids.slice(1) }), 'ids not an array': withBulk(b => { b.slide_ids = 'x' }),
      'an id not a string': withBulk(b => { b.slide_ids[2] = 5 }), 'actions missing': withBulk((_b, p) => { delete p.actions }), 'no confirm action': withBulk((_b, p) => { p.actions = p.actions.slice(1) }), 'no cancel action': withBulk((_b, p) => { p.actions = p.actions.slice(0, 1) }),
      'confirm for another bulk': withBulk((_b, p) => { p.actions[0].value = 'confirm_bulk_edit:other' }), 'two confirm actions': withBulk((_b, p) => { p.actions.push({ ...p.actions[0] }) }), 'blank confirm label': withBulk((_b, p) => { p.actions[0].label = ' ' }),
      'actions not objects': withBulk((_b, p) => { p.actions = ['confirm_bulk_edit:x', 'cancel_bulk_edit:x'] }),
    }
    for (const [name, frame] of Object.entries(bad)) { assert.equal(plain(parseBulkEditConfirm(frame)), null, name); assert.equal(isBulkEditConfirmFrame(frame), true, `${name}: still claims to be one`) }
    for (const junk of [null, undefined, 0, 'x', [], {}, { type: 'action_request' }, { type: 'action_request', payload: null }, { type: 'action_request', payload: { kind: 'bulk_edit_confirm' } }]) assert.equal(parseBulkEditConfirm(junk), null)
  })
  await check('wire: receipts, summaries, changes and undo results parse; the malformed are null; reasons are said in words, never as a raw code', () => {
    const wr = wire()
    assert.deepEqual(plain(wr.parseBulkEditProgress(progressFrame(2, 'failed', 'refine_failed'))), { bulkId: BULK_ID, slideId: 'L2', slideIndex: 2, status: 'failed', reason: 'refine_failed' })
    assert.equal(plain(wr.parseBulkEditProgress(progressFrame(1, 'done'))).reason, null); assert.equal(plain(wr.parseBulkEditProgress(progressFrame(1, 'skipped', 'x', BULK_ID, null))).slideId, null)
    for (const frame of [progressFrame(1, 'weird'), progressFrame(-1, 'done'), progressFrame(1.5, 'done'), progressFrame('1', 'done'), progressFrame(1, 'done', undefined, ''), progressFrame(1, 'done', undefined, 'a b'), { type: 'bulk_edit_progress' }, { type: 'bulk_edit_progress', payload: null }, { type: 'other', payload: {} }, null])
      assert.equal(wr.parseBulkEditProgress(frame), null)
    const flat = { type: 'bulk_edit_progress', bulk_id: BULK_ID, slide_index: 0, status: 'done' }; assert.equal(plain(wr.parseBulkEditProgress(flat)).status, 'done', 'a frame without a payload key is read flat')
    assert.deepEqual(plain(wr.parseBulkEditSummary(summaryFrame(4, 1, 0))), { bulkId: BULK_ID, done: 4, failed: 1, skipped: 0, total: 5 })
    for (const frame of [summaryFrame(4, 2, 1), summaryFrame(-1, 0, 0), summaryFrame(1.5, 0, 0), summaryFrame('4', 1, 0), { type: 'bulk_edit_summary', payload: { bulk_id: BULK_ID, done: 1, failed: 0, skipped: 0 } }, summaryFrame(1, 0, 0, 5, ''), { type: 'bulk_edit_summary', payload: [] }])
      assert.equal(wr.parseBulkEditSummary(frame), null)
    assert.deepEqual(plain(wr.parseChangeRecorded(CHANGE_04)), { changeId: CHANGE_04.payload.change_id, label: 'Refined slide 3', kind: 'slide_replaced', presentationId: PRES })
    for (const kind of ['slide_added', 'slide_replaced', 'slide_deleted', 'slide_reordered', 'bulk_edit']) assert.equal(plain(wr.parseChangeRecorded(changeFrame('c', 'x', kind))).kind, kind)
    assert.equal(plain(wr.parseChangeRecorded({ ...changeFrame('c', ''), payload: { ...changeFrame('c').payload, label: '  ' } })).label, 'Changed the deck', 'a plain label stands in when Director sends none')
    for (const kind of ['element_added', 'theme_changed', 'slide_x', '', 5, undefined]) assert.equal(wr.parseChangeRecorded({ ...changeFrame('c'), payload: { ...changeFrame('c').payload, kind } }), null, `v1: no chip for kind ${String(kind)}`)
    for (const undoable of [false, 'true', 1, undefined]) assert.equal(wr.parseChangeRecorded({ ...changeFrame('c'), payload: { ...changeFrame('c').payload, undoable } }), null, `undoable ${String(undoable)}`)
    for (const patch of [{ change_id: '' }, { change_id: 5 }, { presentation_id: '' }, { presentation_id: null }]) assert.equal(wr.parseChangeRecorded({ ...changeFrame('c'), payload: { ...changeFrame('c').payload, ...patch } }), null)
    for (const status of ['restored', 'failed', 'superseded']) assert.equal(plain(wr.parseUndoResult(undoResultFrame('c', status, 'busy'))).status, status)
    assert.equal(plain(wr.parseUndoResult(undoResultFrame('c', 'failed', 'busy'))).reason, 'busy'); assert.equal(plain(wr.parseUndoResult(undoResultFrame('c', 'restored'))).reason, null)
    for (const frame of [undoResultFrame('c', 'weird'), undoResultFrame('', 'restored'), { type: 'undo_result', payload: {} }, { type: 'undo_result' }, null]) assert.equal(wr.parseUndoResult(frame), null)
    assert.deepEqual(plain(wr.undoChangeAction('chg_9')), { label: 'Undo', value: 'undo_change:chg_9', primary: false, requires_input: false })
    assert.deepEqual(plain(wr.parseDirectorChatTurn(chatFrame('m1'))), { messageId: 'm1' })
    for (const frame of [{ ...chatFrame('m1'), role: 'user' }, { ...chatFrame('m1'), payload: { text: '  ' } }, { ...chatFrame('m1'), payload: { text: 'x', ephemeral: true } }, { ...chatFrame('') }, { type: 'slide_update' }]) assert.equal(wr.parseDirectorChatTurn(frame), null)
    const bulkWords = { refine_failed: "the new version didn't come out cleanly", unavailable: 'the service was unavailable', unconfirmed: "the change wasn't confirmed", slide_missing: 'the slide is no longer in the deck' }
    for (const [code, words] of Object.entries(bulkWords)) assert.equal(wr.bulkReasonWords(code), words, code)
    const undoWords = { busy: 'Director was busy with another change', layout_unavailable: 'the deck service was unavailable', version_missing: "the earlier version isn't available", restore_failed: "the restore didn't go through", no_deck: 'there is no deck to restore' }
    for (const [code, words] of Object.entries(undoWords)) assert.equal(wr.undoReasonWords(code), words, code)
    for (const unknown of ['some_future_code', 'not_latest', 'deck_changed', 'toString', '__proto__']) { assert.equal(wr.bulkReasonWords(unknown), null, `${unknown}: an unknown code is not drawn`); assert.equal(wr.undoReasonWords(unknown), null) }
    assert.equal(wr.bulkReasonWords('Slide is locked by a manual edit'), 'Slide is locked by a manual edit', 'a reason that is already a sentence is drawn as sent'); assert.equal(wr.bulkReasonWords(null), null); assert.equal(wr.undoReasonWords(''), null)
  })
  await check('wire: hostile frames are null and never throw', () => {
    const wr = wire(), boom = () => new Proxy({}, { get() { throw new Error('boom') }, has() { throw new Error('boom') }, ownKeys() { throw new Error('boom') } })
    const cyclic = { type: 'action_request' }; cyclic.payload = cyclic
    const getter = { get type() { throw new Error('boom') } }
    const hostile = [boom(), getter, cyclic, { type: 'action_request', payload: boom() }, { type: 'action_request', payload: { kind: 'bulk_edit_confirm', bulk_edit: boom() } },
      { type: 'bulk_edit_progress', payload: boom() }, { type: 'bulk_edit_summary', payload: boom() }, { type: 'change_recorded', payload: boom() }, { type: 'undo_result', payload: boom() }, { type: 'sync_response', payload: boom() },
      { type: 'chat_message', payload: boom() }, { type: 'action_request', payload: { kind: 'bulk_edit_confirm', bulk_edit: { bulk_id: 'x', instruction: 'y', slide_indexes: Array.from({ length: 1_000_000 }, (_, i) => i) } } }]
    for (const frame of hostile) for (const fn of ['parseChatCapabilities', 'parseBulkEditConfirm', 'isBulkEditConfirmFrame', 'parseBulkEditProgress', 'parseBulkEditSummary', 'parseChangeRecorded', 'parseUndoResult', 'parseDirectorChatTurn']) {
      let outcome; assert.doesNotThrow(() => { outcome = wr[fn](frame) }, `${fn} on a hostile frame`); assert.ok(outcome === null || typeof outcome === 'boolean' || typeof outcome === 'object', fn)
    }
    const { instance } = freshStore()
    for (const frame of hostile) assert.doesNotThrow(() => instance.route(frame, CTX()), 'the store never throws on a frame')
    assert.doesNotThrow(() => instance.route(CONFIRM, CTX({ slideTitles: () => { throw new Error('boom') } })))
    assert.doesNotThrow(() => instance.route(CONFIRM, CTX({ slideTitles: () => 'not an array' })))
  })

  // ---- 4. store
  await check('store: routing by flag - a frame is consumed only with its own flag on, everything else passes', () => {
    const feed = (env, frame) => freshStore(env).instance.route(frame, CTX())
    const consumed = [progressFrame(0, 'done'), summaryFrame(1, 0, 0), changeFrame('c1'), undoResultFrame('c1', 'restored')]
    assert.deepEqual(consumed.map(frame => feed(ON, frame)), ['consumed', 'consumed', 'consumed', 'consumed'])
    assert.deepEqual(consumed.map(frame => feed({}, frame)), ['pass', 'pass', 'pass', 'pass'])
    assert.deepEqual(consumed.map(frame => feed({ [BULK]: 'true' }, frame)), ['consumed', 'consumed', 'pass', 'pass'])
    assert.deepEqual(consumed.map(frame => feed({ [UNDO]: 'true' }, frame)), ['pass', 'pass', 'consumed', 'consumed'])
    for (const name of REC_NAMES) for (const frame of out(name)) if (!['bulk_edit_progress', 'bulk_edit_summary', 'change_recorded', 'undo_result'].includes(frame.type)) assert.equal(feed(ON, frame), 'pass', `${name}: a ${frame.type} carries on to the hook as before`)
    for (const frame of [SYNC, { type: 'slide_update', payload: {} }, { type: 'nonsense' }, null, 5]) assert.equal(feed(ON, frame), 'pass')
    assert.equal(feed(ON, { ...changeFrame('c1'), session_id: 'someone_else' }), 'consumed')
    const { instance } = freshStore(); assert.equal(instance.route(progressFrame(0, 'done'), CTX({ sessionId: null })), 'pass'); assert.equal(instance.route(progressFrame(0, 'done'), CTX({ isCurrent: false })), 'pass')
  })
  await check('store: capabilities come from the socket\'s own sync_response and are replaced by the next one', () => {
    const { instance } = freshStore()
    assert.deepEqual(plain(instance.capabilities(SID)), { bulkEdit: false, chatUndo: false })
    instance.route(SYNC, CTX()); assert.deepEqual(plain(instance.capabilities(SID)), { bulkEdit: true, chatUndo: true })
    instance.route(syncWith({ chat_undo: true }), CTX()); assert.deepEqual(plain(instance.capabilities(SID)), { bulkEdit: false, chatUndo: true })
    instance.route(syncWith(undefined), CTX()); assert.deepEqual(plain(instance.capabilities(SID)), { bulkEdit: false, chatUndo: false })
    instance.route({ ...SYNC, session_id: 'someone_else' }, CTX()); assert.deepEqual(plain(instance.capabilities(SID)), { bulkEdit: false, chatUndo: false }, 'another session\'s sync_response is not this tab\'s')
    assert.deepEqual(plain(instance.capabilities('someone_else')), { bulkEdit: false, chatUndo: false }); assert.deepEqual(plain(instance.capabilities(null)), { bulkEdit: false, chatUndo: false })
  })
  await check('store: receipts in any order, kept per bulk and per slide; the summary kept; the chip titles read from the deck structure', () => {
    const run = out('02-bulk-run-one-failure'), ask = askOf('02-bulk-run-one-failure'), bulkId = ask.payload.bulk_edit.bulk_id
    const receipts = run.filter(frame => frame.type === 'bulk_edit_progress')
    assert.deepEqual(receipts.map(frame => frame.payload.status), ['done', 'done', 'failed', 'done', 'done']); assert.equal(receipts.length, N)
    const outcomes = []
    for (let round = 0; round < 12; round++) {
      const { instance } = freshStore(); instance.route(ask, CTX())
      const order = receipts.map((frame, at) => [Math.sin(round * 7.3 + at * 3.1), frame]).sort((a, b) => a[0] - b[0]).map(pair => pair[1])
      for (const frame of order) assert.equal(instance.route(frame, CTX()), 'consumed')
      outcomes.push(JSON.stringify(plain(instance.bulk(SID, bulkId).receipts)))
    }
    assert.equal(new Set(outcomes).size, 1, 'the same receipts in any order give the same state')
    const { instance } = freshStore(); instance.route(CONFIRM, CTX())
    assert.deepEqual(plain(instance.bulk(SID, BULK_ID).titles), TITLES, 'titles by slide id')
    instance.route(progressFrame(1, 'done'), CTX()); instance.route(progressFrame(1, 'failed', 'unavailable'), CTX())
    assert.equal(instance.bulk(SID, BULK_ID).receipts[1].status, 'failed', 'a later receipt for the same slide replaces the earlier')
    instance.route(progressFrame(0, 'done', undefined, 'bulk_other'), CTX()); assert.equal(instance.bulk(SID, BULK_ID).receipts[0], undefined, 'a receipt of another bulk is not this bulk\'s')
    assert.equal(instance.bulk(SID, 'bulk_other').receipts[0].status, 'done'); assert.equal(instance.bulk('someone_else', BULK_ID), null)
    instance.route(progressFrame(2, 'done', undefined, BULK_ID, 'slide_zzz'), CTX()); instance.route(progressFrame(9, 'done'), CTX()); assert.equal(instance.bulk(SID, BULK_ID).receipts[2], undefined, 'a receipt whose slide id disagrees with the confirmed one is dropped'); assert.equal(instance.bulk(SID, BULK_ID).receipts[9], undefined, 'and so is one for a position the confirm did not name')
    const early = freshStore().instance; early.route(progressFrame(2, 'done'), CTX()); assert.equal(early.bulk(SID, BULK_ID).receipts[2].status, 'done', 'a receipt that arrives before its confirm is kept')
    instance.route(summaryFrame(4, 1, 0), CTX()); assert.deepEqual(plain(instance.bulk(SID, BULK_ID).summary), { bulkId: BULK_ID, done: 4, failed: 1, skipped: 0, total: 5 })
    instance.route(progressFrame(4, 'skipped', 'slide_missing'), CTX()); assert.equal(instance.bulk(SID, BULK_ID).receipts[4].status, 'skipped', 'a receipt after the summary is still kept')
    instance.route({ ...progressFrame(3, 'done'), session_id: 'someone_else' }, CTX()); assert.equal(instance.bulk(SID, BULK_ID).receipts[3], undefined, 'another session\'s receipt is dropped')
    const byIndex = freshStore().instance; byIndex.route(withBulk(b => { delete b.slide_ids }), CTX({ slideTitles: () => [{ title: 'A' }, { title: 'B  \n b' }, { title: 5 }, null, { title: 'x'.repeat(200) }] }))
    const titles = plain(byIndex.bulk(SID, BULK_ID).titles); assert.deepEqual(titles.slice(0, 3), ['A', 'B b', null]); assert.equal(titles[4].length, 80)
    const byId = freshStore().instance; byId.route(CONFIRM, CTX({ slideTitles: () => [{ slide_id: 'slide_zzz', title: 'Other' }, { slide_id: 'L1', title: 'Right one' }] }))
    assert.deepEqual(plain(byId.bulk(SID, BULK_ID).titles), [null, 'Right one', null, null, null], 'a named id is matched by id, never by position')
    const once = freshStore().instance; once.route(CONFIRM, CTX()); once.route(CONFIRM, CTX({ slideTitles: () => [] })); assert.deepEqual(plain(once.bulk(SID, BULK_ID).titles), TITLES, 'the first snapshot is kept')
  })
  await check('store: changes - anchored to the latest Director chat line, this deck only, the latest one alone is undoable', () => {
    const rec = out('04-undo-restored'), at = rec.findIndex(frame => frame.type === 'change_recorded'), closing = rec[at - 1]
    const { instance } = freshStore(); instance.route(SYNC, CTX())
    for (const frame of rec.slice(0, at + 1)) instance.route(frame, CTX())
    assert.equal(closing.type, 'chat_message'); assert.equal(instance.changeFor(SID, closing.message_id).change.changeId, CHANGE_04.payload.change_id, 'recorded: anchored to the closing line, not the first line')
    assert.equal(instance.changeFor(SID, rec[0].message_id), null); assert.equal(instance.changeFor(SID, closing.message_id).state.phase, 'idle')
    instance.route(CHANGE_04, CTX()); assert.equal(instance.changeFor(SID, closing.message_id).seq, 1, 'a replayed change_recorded is recorded once')
    // DERIVED: the same session goes on - ephemeral and user lines anchor nothing, a newer change turns the older chip off at once
    const s = freshStore().instance; s.route(SYNC, CTX())
    s.route(chatFrame('m1'), CTX()); s.route({ ...chatFrame('m_eph'), payload: { text: 'x', ephemeral: true } }, CTX()); s.route({ ...chatFrame('m_user'), role: 'user' }, CTX())
    s.route(changeFrame('c1', 'First'), CTX()); assert.equal(s.changeFor(SID, 'm1').change.changeId, 'c1'); assert.equal(s.changeFor(SID, 'm_eph'), null); assert.equal(s.changeFor(SID, 'm_user'), null)
    s.route(chatFrame('m2'), CTX()); s.route(changeFrame('c2', 'Second', 'slide_added'), CTX())
    assert.equal(s.changeFor(SID, 'm1').state.phase, 'superseded', 'a newer change replaced the older chip at once, with no click'); assert.equal(s.changeFor(SID, 'm2').state.phase, 'idle')
    s.route(changeFrame('c_other', 'Other deck', 'slide_added', 'pres_other'), CTX()); assert.equal(s.changeFor(SID, 'm2').state.phase, 'idle', 'another presentation\'s change replaces nothing'); assert.equal(s.changeFor(SID, 'm2').change.changeId, 'c2')
    const none = freshStore().instance; none.route(chatFrame('m1'), CTX()); none.route(changeFrame('c1'), CTX({ presentationId: null })); assert.equal(none.changeFor(SID, 'm1'), null, 'no displayed deck known: nothing recorded')
    none.route(changeFrame('c1', 'x', 'bulk_edit', 'pres_other'), CTX()); assert.equal(none.changeFor(SID, 'm1'), null, 'a frame for another deck is not recorded')
    none.route({ ...changeFrame('c3'), session_id: 'someone_else' }, CTX()); assert.equal(none.changeFor(SID, 'm1'), null)
    none.route({ ...changeFrame('c4'), payload: { ...changeFrame('c4').payload, undoable: false } }, CTX()); assert.equal(none.changeFor(SID, 'm1'), null, 'not undoable: no chip')
    const pending = freshStore().instance; pending.route(chatFrame('m1'), CTX()); pending.route(changeFrame('c1'), CTX()); assert.equal(pending.beginUndo(SID, 'c1'), true)
    pending.route(chatFrame('m2'), CTX()); pending.route(changeFrame('c2'), CTX()); assert.equal(pending.changeFor(SID, 'm1').state.phase, 'pending', 'a click already sent keeps waiting for its own answer')
    const decks = freshStore().instance; decks.route(chatFrame('m1'), CTX()); decks.route(changeFrame('c1'), CTX()); decks.route(chatFrame('m2'), CTX())
    decks.route(changeFrame('c2', 'Other deck', 'slide_added', 'pres_other'), CTX({ presentationId: 'pres_other' })); assert.equal(decks.changeFor(SID, 'm1').state.phase, 'idle', 'a change of another deck supersedes only that deck\'s chips')
    const many = freshStore().instance; many.route(chatFrame('m'), CTX()); for (let i = 0; i < 130; i++) many.route(changeFrame(`c${i}`), CTX()); assert.equal(many.changeFor(SID, 'm').change.changeId, 'c129')
  })
  await check('store: one undo - idle to pending once, the answers end it (the recorded ones), an unknown id changes nothing, a stuck one times out', () => {
    const { instance } = freshStore(); instance.route(chatFrame('m1'), CTX()); instance.route(changeFrame('c1'), CTX())
    assert.equal(instance.beginUndo(SID, 'nope'), false); assert.equal(instance.beginUndo('someone_else', 'c1'), false)
    assert.equal(instance.beginUndo(SID, 'c1', 1000), true); assert.equal(instance.beginUndo(SID, 'c1'), false, 'a second click is not a second request')
    assert.equal(instance.expirePending(SID, 1000 + 59_999), 0); assert.equal(instance.expirePending(SID, 1000 + 60_000), 1)
    assert.deepEqual(plain(instance.changeFor(SID, 'm1').state), { phase: 'failed', reason: 'No answer from the Director' }); assert.equal(instance.beginUndo(SID, 'c1'), false, 'a failed one is final')
    for (const [name, phase, reason] of [['04-undo-restored', 'restored', undefined], ['05-undo-superseded', 'superseded', undefined]]) {
      const s = freshStore().instance; for (const frame of framesOf(name)) { if (frame.type === 'undo_result') s.beginUndo(SID, frame.payload.change_id); s.route(frame, CTX()) }
      const record = s.changeFor(SID, out(name)[3].message_id); assert.equal(record.change.changeId, out(name).find(frame => frame.type === 'change_recorded').payload.change_id); assert.equal(record.state.phase, phase, `${name}: the recorded undo_result ends the click`)
    }
    for (const [status, reason, phase] of [['restored', undefined, 'restored'], ['failed', 'version_missing', 'failed'], ['superseded', 'not_latest', 'superseded']]) { // DERIVED answers
      const s = freshStore().instance; s.route(chatFrame('m1'), CTX()); s.route(changeFrame('c1'), CTX()); s.beginUndo(SID, 'c1')
      assert.equal(s.route(undoResultFrame('c1', status, reason), CTX()), 'consumed'); assert.equal(s.changeFor(SID, 'm1').state.phase, phase)
      assert.equal(s.changeFor(SID, 'm1').state.reason ?? null, status === 'failed' ? 'version_missing' : null)
    }
    const s = freshStore().instance; s.route(chatFrame('m1'), CTX()); s.route(changeFrame('c1'), CTX()); s.beginUndo(SID, 'c1')
    assert.equal(s.route(undoResultFrame('nope', 'restored'), CTX()), 'consumed'); assert.equal(s.changeFor(SID, 'm1').state.phase, 'pending', 'an unknown id changes nothing')
    s.cancelPending(SID, 'c1'); assert.equal(s.changeFor(SID, 'm1').state.phase, 'idle'); s.cancelPending(SID, 'c1'); assert.equal(s.changeFor(SID, 'm1').state.phase, 'idle')
  })
  await check('senders: the answer is Director\'s own action value, once; the undo is one frame with action_value undo_change:<id>; neither touches the network', async () => {
    const { store, wd, instance, wire: wr } = freshStore()
    const sent = [], answered = new Set()
    const send = (action, messageId, key) => { sent.push([plain(action), messageId, key]); answered.add(key) } // the page's handleActionClick records the key on success
    const confirm = plain(wr.parseBulkEditConfirm(CONFIRM)).confirm
    const action = { label: confirm.label, value: confirm.value, primary: true, requires_input: false }
    assert.equal(await store.chooseBulkEdit(action, ASK_ID, { active: new Set([ASK_ID]), answered, answerKey: ASK_ID, send }), true)
    assert.deepEqual(sent, [[{ label: 'Change 5 slides', value: `confirm_bulk_edit:${BULK_ID}`, primary: true, requires_input: false }, ASK_ID, ASK_ID]])
    assert.match(inbound('02-bulk-run-one-failure')[1].data.action_value, /^confirm_bulk_edit:bulk_[0-9a-f]{12}$/, 'the recorded inbound answer has this shape'); assert.match(sent[0][0].value, /^confirm_bulk_edit:bulk_[0-9a-f]{12}$/)
    assert.equal(await store.chooseBulkEdit(action, ASK_ID, { active: new Set([ASK_ID]), answered, answerKey: ASK_ID, send }), false, 'an answered ask sends nothing'); assert.equal(sent.length, 1)
    assert.equal(await store.chooseBulkEdit(action, ASK_ID, { active: new Set(), answered: new Set(), answerKey: ASK_ID, send }), false, 'a closed ask sends nothing'); assert.equal(sent.length, 1)
    assert.equal(await store.chooseBulkEdit(action, ASK_ID, { active: new Set([ASK_ID]), answered: new Set(), answerKey: ASK_ID, send: () => {} }), false, 'a send the page did not record is not an answer')
    assert.equal(await store.chooseBulkEdit(action, ASK_ID, { active: new Set([ASK_ID]), answered: new Set(), answerKey: ASK_ID, send: () => { throw new Error('boom') } }), false)
    instance.route(chatFrame('m1'), CTX()); instance.route(changeFrame('chg_0001'), CTX())
    const undoSent = [], undoAnswered = new Set()
    const gate = { answered: undoAnswered, send: (a, m, k) => { undoSent.push([plain(a), m, k]); undoAnswered.add(k) } }
    assert.equal(await store.sendStudioUndo(SID, 'chg_0001', 'm1', gate, instance), true)
    assert.equal(await store.sendStudioUndo(SID, 'chg_0001', 'm1', gate, instance), false, 'a second click sends no second frame')
    assert.deepEqual(undoSent, [[{ label: 'Undo', value: 'undo_change:chg_0001', primary: false, requires_input: false }, 'm1', 'undo_change:chg_0001']]); assert.equal(instance.changeFor(SID, 'm1').state.phase, 'pending')
    instance.route(chatFrame('m2'), CTX()); instance.route(changeFrame('chg_0002'), CTX())
    assert.equal(await store.sendStudioUndo(SID, 'chg_0002', 'm2', { answered: new Set(), send: () => {} }, instance), false); assert.equal(instance.changeFor(SID, 'm2').state.phase, 'idle', 'a send that did not go out puts the chip back')
    assert.equal(await store.sendStudioUndo(SID, 'chg_0002', 'm2', { answered: new Set(), send: () => { throw new Error('boom') } }, instance), false); assert.equal(instance.changeFor(SID, 'm2').state.phase, 'idle')
    assert.equal(await store.sendStudioUndo(null, 'chg_0002', 'm2', gate, instance), false); assert.equal(await store.sendStudioUndo(SID, 'unknown', 'm2', gate, instance), false)
    assert.equal(wd.fetches.length, 0, 'no network call from any sender')
    const decide = (env, ask, caps) => { const s = freshStore(env); if (caps) s.instance.route(SYNC, CTX()); return s.store.bulkEditAskDecision(ask, SID, s.instance) }
    assert.equal(decide({}, CONFIRM, true), null, 'flag off: an ordinary ask'); assert.equal(decide(ON, CONFIRM, false), null, 'Director did not advertise it: an ordinary ask'); assert.equal(plain(decide(ONLY_UNDO, CONFIRM, true)), null)
    assert.equal(decide(ON, CONFIRM, true).kind, 'card'); assert.equal(decide(ON, { payload: { prompt_text: 'x', actions: [] } }, true), null)
    assert.equal(decide(ON, withBulk(b => { b.slide_count = 9 }), true).kind, 'hidden', 'a malformed confirm draws nothing'); assert.equal(decide(ON, { payload: null }, true), null)
  })

  // ---- 5. cards
  const cardWorld = (env = ON, fake = null) => { const wd = world({ env, fake }); return { wd, card: wd.load(CARD), chip: wd.load(CHIP), store: wd.load(STORE) } }
  const render = (element) => renderToStaticMarkup(element)
  const modelOf = w => w.wire.parseBulkEditConfirm(CONFIRM)
  const rowProps = (w, extra = {}) => ({ ask: { message_id: ASK_ID }, model: modelOf(w), sessionId: SID, choose: async () => true, store: w.instance, ...extra })
  const prime = (instance, frames = []) => { instance.route(SYNC, CTX()); instance.route(CONFIRM, CTX()); for (const frame of frames) instance.route(frame, CTX()) }
  const cw = () => { const c = cardWorld(); const wr = c.wd.load(WIRE); return { ...c, wire: wr, instance: c.store.createBulkEditUndoStore() } }
  /** A recorded run's card: the run's own confirm ask and every frame of it routed, then the card drawn. */
  const runHtml = (c, frames) => {
    const s = c.store.createBulkEditUndoStore(), ask = frames.find(frame => frame.type === 'action_request'); for (const frame of frames) s.route(frame, CTX())
    return render(React.createElement(c.card.StudioBulkEditRow, { ask: { message_id: ask.message_id }, model: c.wire.parseBulkEditConfirm(ask), sessionId: SID, choose: async () => true, store: s }))
  }

  await check('card: the confirm card states the instruction, N slides, a chip per slide, Director\'s estimate and Director\'s two answers (recorded 01)', () => {
    const c = cw(); prime(c.instance)
    const html = render(React.createElement(c.card.StudioBulkEditRow, rowProps(c)))
    const words = text(html)
    assert.match(words, /Whole-deck change 5 slides/); assert.match(words, /“Shorten the title”/)
    for (let n = 1; n <= N; n++) assert.ok(new RegExp(`data-studio-bulk-edit-chip-part="number">${n}<`).test(html), `chip ${n}`)
    for (const title of TITLES) assert.ok(html.includes(`>${title}<`), `title ${title}`)
    assert.equal((html.match(/data-studio-bulk-edit-chip=""/g) || []).length, N)
    assert.match(words, /Estimate: about \$0\.25 to \$0\.50/); assert.ok(html.includes('data-studio-bulk-edit-option="confirm"') && html.includes('data-studio-bulk-edit-option="cancel"'))
    assert.match(words, /Change 5 slides Cancel/); assert.doesNotMatch(html, /disabled/); assert.doesNotMatch(html, /aria-pressed/); assert.match(html, /data-studio-bulk-edit-state="ask"/)
    assert.match(html, /role="group" aria-label="Whole-deck change: 5 slides"/); assert.equal((html.match(/<button type="button"/g) || []).length, 2)
    assert.doesNotMatch(words, /Rough cost|prompt/i, 'the card is the instruction, the slides, the estimate and the answers - not a second copy of Director\'s sentence')
    const one = render(React.createElement(c.card.StudioBulkEditRow, rowProps(c, { model: c.wire.parseBulkEditConfirm(withBulk(b => { b.slide_indexes = [4]; b.slide_ids = ['L4']; b.slide_count = 1 })) })))
    assert.match(text(one), /Whole-deck change 1 slide(?!s)/)
    const noTitles = render(React.createElement(c.card.StudioBulkEditRow, rowProps(c, { store: c.store.createBulkEditUndoStore() })))
    assert.match(noTitles, /data-studio-bulk-edit-chip-part="number">3</); assert.doesNotMatch(noTitles, /data-studio-bulk-edit-chip-part="title"/, 'no titles known: numbers only')
  })
  await check('card: the cost is Director\'s estimate label - usd is never formatted, and no label draws no cost', () => {
    const c = cw(); const lab = (frame) => { const s = c.store.createBulkEditUndoStore(); s.route(SYNC, CTX()); return render(React.createElement(c.card.StudioBulkEditRow, rowProps(c, { store: s, model: c.wire.parseBulkEditConfirm(frame) }))) }
    const html = lab(withBulk(b => { b.estimate = { usd: 0.0731, label: 'a few seconds' } })) // DERIVED from recording 01
    assert.match(text(html), /Estimate: a few seconds/); assert.doesNotMatch(html, /0\.07|\$/, 'usd is not formatted')
    const none = lab(withBulk(b => { b.estimate = { usd: 0.5 } })); assert.doesNotMatch(text(none), /Estimate|0\.5|\$/); assert.doesNotMatch(lab(withBulk(b => { delete b.estimate })), /Estimate/)
    assert.doesNotMatch(lab(CONFIRM), /credit/i, 'there are no credits on this wire')
  })
  await check('card: one answer only - the answered card is disabled and shows the choice; earlier and unknown say so', () => {
    const c = cw(); prime(c.instance); const model = plain(modelOf(c))
    const html = (extra) => render(React.createElement(c.card.StudioBulkEditRow, rowProps(c, extra)))
    const confirmed = html({ status: 'answered', chosenValue: model.confirm.value })
    assert.equal((confirmed.match(/ disabled=""/g) || []).length, 2, 'both buttons disabled'); assert.match(confirmed, /data-studio-bulk-edit-option="confirm"[^>]*aria-pressed="true"/); assert.doesNotMatch(confirmed.match(/data-studio-bulk-edit-option="cancel"[^>]*>/)[0], /aria-pressed/)
    assert.match(text(confirmed), /You chose: Change 5 slides/); assert.match(confirmed, /data-studio-bulk-edit-state="answered"/)
    const cancelled = html({ status: 'answered', chosenValue: model.cancel.value }); assert.match(text(cancelled), /You chose: Cancel/); assert.match(cancelled.match(/data-studio-bulk-edit-option="cancel"[^>]*>/)[0], /aria-pressed="true"/)
    const reloaded = html({ chosenValue: model.confirm.value }); assert.equal((reloaded.match(/ disabled=""/g) || []).length, 2, 'a reloaded answered card (the transcript names the choice) is disabled too'); assert.match(text(reloaded), /You chose: Change 5 slides/)
    const unknown = html({ status: 'answered' }); assert.equal((unknown.match(/ disabled=""/g) || []).length, 2); assert.match(text(unknown), /Answered/); assert.doesNotMatch(unknown, /aria-pressed/)
    const earlier = html({ status: 'earlier' }); assert.equal((earlier.match(/ disabled=""/g) || []).length, 2); assert.match(text(earlier), /No longer available/)
    assert.doesNotMatch(html({ chosenValue: 'confirm_bulk_edit:another' }), /disabled/, 'a reply naming another bulk locks nothing')
  })
  await check('card clicks: the first click sends Director\'s own action once and locks the card; a second click sends nothing; a send that failed unlocks it', async () => {
    const fake = fakeReact(); const c = cardWorld(ON, fake); const wr = c.wd.load(WIRE), instance = c.store.createBulkEditUndoStore(); prime(instance); const model = plain(modelOf({ wire: wr }))
    const calls = []; let outcome = true
    const props = { ...rowProps({ wire: wr, instance }), choose: async (action, id) => { calls.push([plain(action), id]); return outcome } }
    const draw = () => { fake.begin(); return c.card.StudioBulkEditRow(props) }
    let tree = draw()
    const confirm = () => buttonOf(tree, 'data-studio-bulk-edit-option', 'confirm'), cancel = () => buttonOf(tree, 'data-studio-bulk-edit-option', 'cancel')
    assert.equal(confirm().props.disabled, false); confirm().props.onClick(); tree = draw()
    assert.equal(confirm().props.disabled, true); assert.equal(cancel().props.disabled, true); assert.match(text(renderToStaticMarkup(tree)), /Sending/)
    cancel().props.onClick(); confirm().props.onClick(); assert.equal(calls.length, 1, 'locked: one answer only')
    assert.deepEqual(calls[0], [{ label: 'Change 5 slides', value: `confirm_bulk_edit:${BULK_ID}`, primary: true, requires_input: false }, ASK_ID])
    await new Promise(resolve => setTimeout(resolve, 5)); tree = draw(); assert.equal(confirm().props.disabled, true, 'the answer went out: the card stays locked (and the page marks it answered)')
    const fake2 = fakeReact(), c2 = cardWorld(ON, fake2); outcome = false; const calls2 = []
    const props2 = { ...rowProps({ wire: c2.wd.load(WIRE), instance: c2.store.createBulkEditUndoStore() }), choose: async (action) => { calls2.push(plain(action)); return false } }
    const draw2 = () => { fake2.begin(); return c2.card.StudioBulkEditRow(props2) }
    let tree2 = draw2(); buttonOf(tree2, 'data-studio-bulk-edit-option', 'cancel').props.onClick(); await new Promise(resolve => setTimeout(resolve, 5)); tree2 = draw2()
    assert.equal(buttonOf(tree2, 'data-studio-bulk-edit-option', 'cancel').props.disabled, false, 'not sent: open again'); assert.deepEqual(calls2, [{ label: 'Cancel', value: `cancel_bulk_edit:${BULK_ID}`, primary: false, requires_input: false }])
    const fake3 = fakeReact(), c3 = cardWorld(ON, fake3), props3 = { ...rowProps({ wire: c3.wd.load(WIRE), instance: c3.store.createBulkEditUndoStore() }), status: 'answered', chosenValue: model.confirm.value, choose: async () => { calls.push('answered'); return true } }
    fake3.begin(); const t3 = c3.card.StudioBulkEditRow(props3); buttonOf(t3, 'data-studio-bulk-edit-option', 'confirm').props.onClick(); assert.ok(!calls.includes('answered'), 'an answered card cannot be clicked into a second answer')
  })
  await check('receipts: shown as they arrive in any order, with Director\'s reason in words; another bulk\'s, another slide\'s and a stranger\'s are not shown (recorded 02)', () => {
    const c = cw(), run = out('02-bulk-run-one-failure'), ask = askOf('02-bulk-run-one-failure'), bulkId = ask.payload.bulk_edit.bulk_id
    const s = c.store.createBulkEditUndoStore(); s.route(SYNC, CTX()); s.route(ask, CTX())
    const show = () => render(React.createElement(c.card.StudioBulkEditRow, { ask: { message_id: ask.message_id }, model: c.wire.parseBulkEditConfirm(ask), sessionId: SID, choose: async () => true, store: s }))
    assert.doesNotMatch(show(), /reported|data-state="done"/)
    const receipts = run.filter(frame => frame.type === 'bulk_edit_progress')
    s.route(receipts[3], CTX()); let html = show()
    assert.match(html, /data-studio-bulk-edit-chip="" data-state="done"/); assert.match(text(html), /1 of 5 slides reported/); assert.doesNotMatch(html, /data-studio-bulk-edit-part="reasons"/)
    s.route(receipts[0], CTX()); s.route(receipts[2], CTX()); html = show()
    assert.match(text(html), /3 of 5 slides reported/); assert.match(text(html), /Slide 3 · Market size: Couldn't change — the new version didn't come out cleanly/); assert.doesNotMatch(text(html), /refine_failed/, 'a raw code is never drawn')
    assert.equal((html.match(/data-studio-bulk-edit-chip="" data-state="done"/g) || []).length, 2); assert.match(html, /data-studio-bulk-edit-chip="" data-state="failed"/); assert.match(html, /data-state="waiting"/)
    s.route(receipts[1], CTX()); s.route(receipts[4], CTX()); html = show(); assert.match(text(html), /5 of 5 slides reported/)
    s.route({ ...clone(receipts[1]), payload: { ...receipts[1].payload, bulk_id: 'bulk_other', status: 'failed' } }, CTX()); s.route({ ...clone(receipts[1]), payload: { ...receipts[1].payload, status: 'failed', slide_id: 'slide_zzz' } }, CTX()); s.route(progressFrame(9, 'done', undefined, bulkId, 'L9'), CTX())
    html = show(); assert.equal((html.match(/data-studio-bulk-edit-chip="" data-state="failed"/g) || []).length, 1, 'another bulk\'s receipt and a stranger slide\'s are not shown'); assert.match(text(html), /5 of 5 slides reported/); assert.doesNotMatch(text(html), /Slide 10|slide_zzz/)
    // a receipt that came in before its confirm is kept by the store (nothing to check it against yet); the card still shows only a receipt for the slide the confirm named at that position
    const late = c.store.createBulkEditUndoStore(); late.route(SYNC, CTX()); late.route(progressFrame(1, 'failed', 'unavailable', bulkId, 'slide_zzz'), CTX()); late.route(ask, CTX())
    const lateHtml = render(React.createElement(c.card.StudioBulkEditRow, { ask: { message_id: ask.message_id }, model: c.wire.parseBulkEditConfirm(ask), sessionId: SID, choose: async () => true, store: late }))
    assert.doesNotMatch(lateHtml, /data-state="failed"/); assert.doesNotMatch(text(lateHtml), /reported|Slide 2/)
  })
  await check('summary: counts, never "Done" on a partial, all failed or all skipped; "all changed" only when every slide changed (recorded 02 and 03; all-failed derived)', () => {
    const c = cw(), summaryOf = html => (html.match(/data-studio-bulk-edit-part="summary"[^>]*>([\s\S]*?)<\/p>/) || [])[1]
    const partial = runHtml(c, framesOf('02-bulk-run-one-failure'))
    assert.match(partial, /data-summary-state="partial"/); assert.deepEqual([...summaryOf(partial).matchAll(/<span>([^<]*)<\/span>/g)].map(m => m[1]), ['4 of 5 changed', '1 failed'], 'the partial reads "4 of 5 changed" then "1 failed"')
    assert.match(text(partial), /Slide 3 · Market size: Couldn't change — the new version didn't come out cleanly/); assert.doesNotMatch(partial, /reported/, 'the progress line gives way to the summary'); assert.doesNotMatch(text(partial), /refine_failed/)
    const skipped = runHtml(c, framesOf('03-bulk-all-skipped')), failed = runHtml(c, [clone(SYNC), ...allFailed()])
    for (const html of [partial, skipped, failed]) assert.doesNotMatch(text(html), /\bdone\b|all changed|everything|success/i, 'no "Done" on a partial, a failure or a skip')
    assert.match(skipped, /data-summary-state="none-changed"/); assert.match(text(summaryOf(skipped)), /^0 of 5 changed 5 skipped$/)
    assert.equal((skipped.match(/data-studio-bulk-edit-chip="" data-state="skipped"/g) || []).length, 5); assert.match(text(skipped), /Slide 1 · Welcome: Skipped — the slide is no longer in the deck/); assert.doesNotMatch(text(skipped), /slide_missing/)
    assert.match(failed, /data-summary-state="none-changed"/); assert.match(text(summaryOf(failed)), /^0 of 5 changed 5 failed$/); assert.match(text(failed), /Slide 5 · Roadmap: Couldn't change — the new version didn't come out cleanly/)
    const all = runHtml(c, [clone(SYNC), CONFIRM, summaryFrame(5, 0, 0)]); assert.match(all, /data-summary-state="all-changed"/); assert.match(text(summaryOf(all)), /^5 of 5 changed$/)
    for (const [d, f, s] of [[4, 1, 0], [4, 0, 1], [1, 0, 0], [0, 0, 0]]) assert.doesNotMatch(runHtml(c, [clone(SYNC), CONFIRM, summaryFrame(d, f, s)]), /data-summary-state="all-changed"/, `${d}/${f}/${s} is not all changed`)
    assert.match(text(summaryOf(runHtml(c, [clone(SYNC), CONFIRM, summaryFrame(2, 1, 1)]))), /^2 of 5 changed 1 failed 1 skipped 1 not finished$/, 'an unfinished remainder is said, not hidden')
    assert.doesNotMatch(summaryOf(partial), /\.</, 'counts, not a second sentence')
  })
  const chipHtmlOf = (c, mutate, caps = SYNC, anchor = out('04-undo-restored')) => { // recorded 04's frames up to change_recorded, then whatever the state needs
    const s = c.store.createBulkEditUndoStore(); s.route(caps, CTX()); const at = anchor.findIndex(frame => frame.type === 'change_recorded'); for (const frame of anchor.slice(0, at + 1)) s.route(frame, CTX()); mutate?.(s)
    return render(React.createElement(c.chip.StudioUndoChip, { sessionId: SID, messageId: anchor[at - 1].message_id, undo: async () => true, store: s }))
  }
  await check('undo chip: every state, its words, its accessible name, and nothing without the capability (recorded 04 and 05)', () => {
    const c = cw(), id = CHANGE_04.payload.change_id, name = 'Undo: Refined slide 3'
    const idle = chipHtmlOf(c); assert.match(idle, new RegExp(`<button type="button" data-studio-chat-undo="idle" aria-label="${name}" title="${name}"`)); assert.match(text(idle), /^Undo$/); assert.doesNotMatch(idle, /disabled|tabindex/)
    const pending = chipHtmlOf(c, s => s.beginUndo(SID, id)); assert.match(pending, new RegExp(`<button type="button" data-studio-chat-undo="pending" disabled="" aria-busy="true" aria-label="${name}"`)); assert.match(text(pending), /^Undoing…$/); assert.match(pending, /<svg/)
    const restored = chipHtmlOf(c, s => { s.beginUndo(SID, id); for (const frame of out('04-undo-restored').filter(f => f.type === 'undo_result')) s.route(frame, CTX()) }); assert.match(restored, /<span data-studio-chat-undo="restored" role="status"/); assert.match(text(restored), /^Undone$/); assert.doesNotMatch(restored, /<button/)
    const answered = chipHtmlOf(c, s => { const r = out('05-undo-superseded'); s.beginUndo(SID, r.find(f => f.type === 'change_recorded').payload.change_id); s.route(r.find(f => f.type === 'undo_result'), CTX()) }, SYNC, out('05-undo-superseded'))
    const later = chipHtmlOf(c, s => { s.route(chatFrame('m2'), CTX()); s.route(changeFrame('chg_newer', 'Moved a slide', 'slide_reordered'), CTX()) }) // DERIVED: a newer change_recorded
    for (const html of [answered, later]) { assert.match(html, new RegExp(`<button type="button" data-studio-chat-undo="superseded" disabled="" aria-label="${name}\\. A later change replaced this"`)); assert.match(text(html), /^A later change replaced this$/) }
    const failedWith = reason => chipHtmlOf(c, s => { s.beginUndo(SID, id); s.route(undoResultFrame(id, 'failed', reason), CTX()) }) // DERIVED: the failure codes Director names
    assert.match(text(failedWith('version_missing')), /^Couldn't undo: the earlier version isn't available$/); assert.match(failedWith('busy'), /role="status"/); assert.match(text(failedWith('layout_unavailable')), /^Couldn't undo: the deck service was unavailable$/)
    assert.match(text(failedWith('restore_failed')), /^Couldn't undo: the restore didn't go through$/); assert.match(text(failedWith('no_deck')), /^Couldn't undo: there is no deck to restore$/); assert.match(text(failedWith('a_code_nobody_knows')), /^Couldn't undo$/, 'an unknown code is not drawn'); assert.match(text(failedWith(undefined)), /^Couldn't undo$/)
    assert.doesNotMatch(failedWith('version_missing'), /version_missing/, 'a raw code is never drawn')
    assert.equal(chipHtmlOf(c, null, syncWith({ bulk_edit: true })), '', 'Director did not advertise chat_undo: nothing is drawn'); assert.equal(chipHtmlOf(c, null, syncWith(undefined)), '')
    const s = c.store.createBulkEditUndoStore(); const rec = out('04-undo-restored'); s.route(SYNC, CTX()); for (const frame of rec.slice(0, 5)) s.route(frame, CTX())
    assert.equal(render(React.createElement(c.chip.StudioUndoChip, { sessionId: SID, messageId: 'another', undo: async () => true, store: s })), '', 'only the line that reported the change'); assert.equal(render(React.createElement(c.chip.StudioUndoChip, { sessionId: null, messageId: rec[3].message_id, undo: async () => true, store: s })), '')
  })
  await check('undo chip click: ONE frame with action_value undo_change:<id> (the recorded one); the second click is not a second frame; never a write to Layout', async () => {
    const fake = fakeReact(), c = cardWorld(ON, fake), s = c.store.createBulkEditUndoStore(), wd = c.wd, rec = out('04-undo-restored')
    s.route(SYNC, CTX()); for (const frame of rec.slice(0, 5)) s.route(frame, CTX())
    const closing = rec[3].message_id, sent = [], answered = new Set()
    const undo = (changeId, messageId) => c.store.sendStudioUndo(SID, changeId, messageId, { answered, send: (action, id, key) => { sent.push([plain(action), id, key]); answered.add(key) } }, s)
    const draw = () => { fake.begin(); return c.chip.StudioUndoChip({ sessionId: SID, messageId: closing, undo, store: s }) }
    let tree = draw(); const button = () => findAll(tree, node => node.type === 'button')[0]
    assert.equal(button().props['data-studio-chat-undo'], 'idle'); button().props.onClick(); button().props.onClick()
    await new Promise(resolve => setTimeout(resolve, 5)); tree = draw()
    const recordedValue = inbound('04-undo-restored').map(frame => frame.data.action_value).filter(Boolean)[0]
    assert.deepEqual(sent, [[{ label: 'Undo', value: recordedValue, primary: false, requires_input: false }, closing, recordedValue]], 'exactly one undo frame, the recorded one, on the page\'s answer path'); assert.equal(button().props['data-studio-chat-undo'], 'pending'); assert.equal(button().props.disabled, true)
    assert.equal(wd.fetches.length, 0, 'the chip never writes to Layout (no request of any kind)')
    for (const frame of rec.slice(5)) s.route(frame, CTX()); tree = draw(); assert.equal(findAll(tree, node => node.type === 'button').length, 0); assert.equal(findAll(tree, node => node.props?.['data-studio-chat-undo'] === 'restored').length, 1)
  })

  // ---- 6. hookup: the real MessageList
  const listWorld = (env) => { const wd = world({ env }); const store = wd.load(STORE); const list = wd.load(LIST); return { wd, store, list, instance: store.studioBulkEditUndo } }
  const asMessage = frame => ({ ...clone(frame), clientTimestamp: Date.parse(frame.timestamp) })
  const listHtml = (lw, { frames, userMessages = [], answered = new Set(), messageList = lw.list }) => renderToStaticMarkup(React.createElement(messageList.MessageList, {
    sessionId: SID, userMessages, messages: frames.filter(frame => frame.type === 'chat_message' || frame.type === 'action_request').map(asMessage),
    userMessageIdsRef: { current: new Set(userMessages.map(u => u.id)) }, userMessageContentMapRef: { current: new Map(userMessages.map(u => [u.text.trim().toLowerCase(), u.id])) },
    hasSeenWelcomeRef: { current: true }, answeredActionsRef: { current: answered }, messagesEndRef: { current: null }, onActionClick() {}, onSubmitAnswers() {} }))
  const feedAll = (lw, frames) => { lw.instance.reset(); for (const frame of frames) lw.instance.route(frame, CTX()) }
  const askTime = Date.parse(CONFIRM.timestamp)
  await check('hookup: with both flags on and Director\'s capability, the ask is the confirm card (the generic card gives way) and the change reporter has its Undo chip (recorded 02, 04)', () => {
    const lw = listWorld(ON), frames = framesOf('02-bulk-run-one-failure')
    feedAll(lw, frames)
    const html = listHtml(lw, { frames })
    assert.equal((html.match(/data-studio-bulk-edit="confirm"/g) || []).length, 1); assert.doesNotMatch(html, /data-studio-director-ask=/, 'the generic card is not drawn beside it'); assert.match(html, new RegExp(`data-director-action-id="${askOf('02-bulk-run-one-failure').message_id}"`))
    assert.equal((html.match(/data-studio-chat-undo="idle"/g) || []).length, 1, 'one chip'); assert.match(html, /aria-label="Undo: Changed 4 slides"/)
    const closing = html.slice(html.indexOf('I changed 4 of 5 slides')); assert.ok(closing.includes('data-studio-chat-undo="idle"'), 'under the closing line'); assert.ok(!html.slice(0, html.indexOf('I changed 4 of 5 slides')).includes('data-studio-chat-undo'), 'and nowhere before it')
    assert.match(text(html), /Whole-deck change 5 slides/); assert.match(text(html), /4 of 5 changed 1 failed/); assert.match(text(html), /Slide 3 · Market size: Couldn't change/)
    const restored = framesOf('04-undo-restored'); feedAll(lw, restored); const html2 = listHtml(lw, { frames: restored })
    assert.equal((html2.match(/data-studio-chat-undo=/g) || []).length, 1); assert.ok(html2.slice(html2.indexOf('Done. Slide 3 is refined'), html2.indexOf('Undone: Refined slide 3')).includes('data-studio-chat-undo="restored"'), 'Director answered the click: the chip says Undone')
    const before = restored.slice(0, restored.findIndex(f => f.type === 'change_recorded') + 1); feedAll(lw, before); const html3 = listHtml(lw, { frames: before }); assert.ok(html3.slice(html3.indexOf('Done. Slide 3 is refined')).includes('data-studio-chat-undo="idle"'))
    const skipped = framesOf('03-bulk-all-skipped'); feedAll(lw, skipped); const html4 = listHtml(lw, { frames: skipped }); assert.doesNotMatch(html4, /data-studio-chat-undo/, 'nothing changed: no change_recorded, no chip'); assert.match(text(html4), /0 of 5 changed 5 skipped/)
    const superseded = framesOf('05-undo-superseded'); feedAll(lw, superseded); assert.match(listHtml(lw, { frames: superseded }), /data-studio-chat-undo="superseded"/)
  })
  await check('hookup: no capability, one flag, or flags off - the ordinary ask and no chip; a malformed confirm draws nothing at all', () => {
    const frames = framesOf('02-bulk-run-one-failure')
    const ordinary = html => { assert.doesNotMatch(html, /data-studio-bulk-edit=/); assert.match(html, /data-studio-director-ask="/); assert.match(text(html), /Change 5 slides \(slides 1, 2, 3, 4 and 5\)\? I'll apply/) }
    const noCap = listWorld(ON); noCap.instance.reset(); for (const frame of frames.filter(f => f.type !== 'sync_response')) noCap.instance.route(frame, CTX())
    const htmlNoCap = listHtml(noCap, { frames }); ordinary(htmlNoCap); assert.doesNotMatch(htmlNoCap, /data-studio-chat-undo/, 'no chat_undo advertised: no chip')
    for (const env of [OFF, ONLY_UNDO]) { const lw = listWorld(env); feedAll(lw, frames); lw.instance.route(SYNC, CTX()); const html = listHtml(lw, { frames }); ordinary(html); if (env === OFF) assert.doesNotMatch(html, /data-studio-chat-undo/) }
    const onlyBulk = listWorld(ONLY_BULK); feedAll(onlyBulk, frames); const htmlBulk = listHtml(onlyBulk, { frames }); assert.match(htmlBulk, /data-studio-bulk-edit="confirm"/); assert.doesNotMatch(htmlBulk, /data-studio-chat-undo/, 'bulk flag alone: no chip')
    const onlyUndo = listWorld(ONLY_UNDO); feedAll(onlyUndo, frames); assert.match(listHtml(onlyUndo, { frames }), /data-studio-chat-undo="idle"/, 'undo flag alone: the chip, and the ordinary ask')
    const lw = listWorld(ON); const bad = withBulk(b => { b.slide_count = 3 }) // DERIVED from recording 01
    lw.instance.reset(); lw.instance.route(SYNC, CTX()); const html = listHtml(lw, { frames: [SYNC, bad] }); assert.doesNotMatch(html, /data-studio-bulk-edit=|data-studio-director-ask|data-director-action-id/); assert.doesNotThrow(() => listHtml(lw, { frames: [bad, { type: 'action_request', message_id: 'x', session_id: SID, timestamp: CONFIRM.timestamp, payload: { kind: 'bulk_edit_confirm', bulk_edit: null, actions: [] } }] }))
  })
  await check('hookup: answered - the page\'s record or the transcript\'s reply disables the card and names the choice; the older chips give way to the newest', () => {
    const lw = listWorld(ON), frames = framesOf('01-bulk-confirm-card'); feedAll(lw, frames)
    const answered = listHtml(lw, { frames, userMessages: [{ id: 'u1', text: 'Change 5 slides', timestamp: askTime + 5000 }], answered: new Set([ASK_ID]) })
    assert.match(answered, /data-studio-bulk-edit-state="answered"/); assert.match(text(answered), /You chose: Change 5 slides/); assert.equal((answered.match(/ disabled=""/g) || []).length, 2)
    const reloaded = listHtml(lw, { frames, userMessages: [{ id: 'u1', text: 'Cancel', timestamp: askTime + 5000 }] }); assert.match(text(reloaded), /You chose: Cancel/); assert.equal((reloaded.match(/ disabled=""/g) || []).length, 2, 'a reload (nothing recorded by the page) still shows it answered')
    const open = listHtml(lw, { frames }); assert.match(open, /data-studio-bulk-edit-state="ask"/); assert.doesNotMatch(open, / disabled=""/)
    const chain = [SYNC, chatFrame('mA', 'Added a slide.'), changeFrame('cA', 'Added a slide', 'slide_added'), chatFrame('mB', 'Moved it.'), changeFrame('cB', 'Moved a slide', 'slide_reordered')] // DERIVED: two changes in a row
    feedAll(lw, chain); const html = listHtml(lw, { frames: chain })
    assert.match(html.slice(html.indexOf('Added a slide.'), html.indexOf('Moved it.')), /data-studio-chat-undo="superseded"[^>]*disabled=""/); assert.match(html.slice(html.indexOf('Moved it.')), /data-studio-chat-undo="idle"/)
  })

  // ---- 7. deck_restored
  function planInput(message) {
    return { message, ownerIsCurrent: true, ownerPresentationId: PRES, displayed: { presentationId: PRES, presentationUrl: DECK_RESTORED.payload.presentation_url, slideCount: 5, refreshToken: 5 }, now: 1_000_000, seen: undefined }
  }
  const mutation = (kind, over = {}) => ({ message_id: 'dm1', payload: { mutation: kind, slide_index: 0, presentation_id: PRES, refresh_token: 'rt-1', ...over } }) // DERIVED
  await check('deck_restored (recorded 04): with the undo flag the hook reads it as a whole-viewer refresh (slide_replaced, restored, no guessed count); the planner is the base\'s but for that one count; flag off, unchanged', () => {
    const on = world({ env: { [UNDO]: 'true' } }).load(WIRE), off = world({ env: {} }).load(WIRE), plan = world({ env: {} }).load(REFRESH)
    assert.equal(DECK_RESTORED.payload.mutation, 'deck_restored'); assert.equal(DECK_RESTORED.type, 'deck_mutation', 'the frame literal is unchanged; the mutation is the new value')
    const frame = clone(DECK_RESTORED); assert.equal(on.normaliseDeckRestored(frame), true)
    assert.deepEqual(frame.payload, { ...DECK_RESTORED.payload, mutation: 'slide_replaced', restored: true }); assert.equal(frame.type, 'deck_mutation'); assert.equal(frame.message_id, DECK_RESTORED.message_id); assert.equal(frame.payload.refresh_token, DECK_RESTORED.payload.refresh_token)
    const planned = plain(plan.planDeckMutationRefresh(planInput(frame)))
    assert.deepEqual(planned.override, { presentationUrl: DECK_RESTORED.payload.presentation_url, presentationId: PRES, slideCount: null, refreshToken: 1_000_000 }, 'a new viewer token, the displayed deck, no guessed slide count'); assert.equal(planned.focusSlideIndex, 0)
    assert.equal(plain(plan.planDeckMutationRefresh({ ...planInput(frame), now: 3 })).override.refreshToken, 6, 'the viewer\'s token always moves on')
    assert.equal(plain(plan.planDeckMutationRefresh({ ...planInput(frame), ownerPresentationId: 'pres_other' })), null); assert.equal(plain(plan.planDeckMutationRefresh({ ...planInput(frame), ownerIsCurrent: false })), null)
    assert.equal(plain(plan.planDeckMutationRefresh(planInput(out('04-undo-restored').find(f => f.type === 'deck_mutation' && f.payload.mutation === 'slide_replaced')))).override.slideCount, 5, 'an ordinary replaced slide keeps the count')
    const untouched = clone(DECK_RESTORED); assert.equal(off.normaliseDeckRestored(untouched), false); assert.deepEqual(untouched, DECK_RESTORED, 'flag off: the frame is not touched')
    assert.equal(plain(plan.planDeckMutationRefresh(planInput(DECK_RESTORED))), null, 'and deck_restored stays an unknown mutation to the planner, as before')
    for (const other of [{ type: 'deck_mutation', payload: { mutation: 'slide_added' } }, { type: 'chat_message', payload: { mutation: 'deck_restored' } }, { type: 'deck_mutation' }, { type: 'deck_mutation', payload: null }, { type: 'deck_mutation', payload: 'deck_restored' }, null, 7]) {
      const copy = other && typeof other === 'object' ? clone(other) : other; assert.equal(on.normaliseDeckRestored(copy), false); assert.deepEqual(copy, other)
    }
    const hostile = new Proxy({}, { get() { throw new Error('boom') }, set() { throw new Error('boom') } }); assert.equal(on.normaliseDeckRestored(hostile), false)
    const hook = read(HOOK); const at = hook.indexOf('if (STUDIO_CHAT_UNDO_ENABLED) normaliseDeckRestored(parsedMessage); // BULK-EDIT-UNDO')
    assert.ok(at > 0 && at < hook.indexOf("if (parsedMessage.type === 'deck_mutation') {"), 'the hook reads it before the deck_mutation checks, only with the undo flag')
    assert.ok(hook.indexOf('routeStudioBulkEditUndoFrame(') < at && at < hook.indexOf('if (!isKnownDirectorMessageType(parsedMessage.type))'), 'right after the store routing, ahead of the allowlist')
    assert.match(read(MDC), /\| 'deck_restored' \/\/ BULK-EDIT-UNDO/); assert.match(read(MDC), /restored\?: boolean \/\/ BULK-EDIT-UNDO/)
    assert.match(read(REFRESH), /\(payload as \{ restored\?: unknown \}\)\.restored === true \? null \/\/ BULK-EDIT-UNDO/)
  })

  // ---- 8. flag off
  await check('flag off: the chat markup and the deck_mutation plan are the base commit\'s, hashed; no typed-text matching of "undo"', () => {
    const transcripts = [framesOf('01-bulk-confirm-card'), framesOf('02-bulk-run-one-failure'), framesOf('03-bulk-all-skipped'), framesOf('04-undo-restored'), framesOf('05-undo-superseded'), [SYNC, chatFrame('m1'), withBulk((_b, p) => { p.bulk_edit = null })]]
    const lw = listWorld(OFF), base = (() => { const wd = world({ env: OFF, ref: true }); return { list: wd.load(LIST) } })()
    for (const [at, frames] of transcripts.entries()) {
      feedAll(lw, frames); lw.instance.route(SYNC, CTX()) // even a store that was told everything draws nothing with the flags off
      const withUser = [{ id: 'u1', text: 'Change 5 slides', timestamp: askTime + 5000 }]
      for (const args of [{ frames }, { frames, userMessages: withUser }, { frames, userMessages: withUser, answered: new Set([ASK_ID]) }]) {
        const now = listHtml(lw, args), then = listHtml({ ...lw, list: base.list }, { ...args, messageList: base.list })
        assert.equal(sha(now), sha(then), `transcript ${at}: flag-off markup is ${BASE.slice(0, 8)}'s byte for byte`)
      }
    }
    const kinds = ['slide_added', 'slide_deleted', 'slide_replaced', 'slide_reordered', 'deck_restored', 'bogus']
    const hashes = kinds.map(kind => sha(JSON.stringify(plain(world({ env: {} }).load(REFRESH).planDeckMutationRefresh(planInput(mutation(kind)))))))
    const baseHashes = kinds.map(kind => sha(JSON.stringify(plain(world({ env: {}, ref: true }).load(REFRESH).planDeckMutationRefresh(planInput(mutation(kind)))))))
    assert.deepEqual(hashes, baseHashes, 'deck_mutation plans, flag off')
    const onPlan = world({ env: ON }).load(REFRESH); assert.deepEqual(['slide_added', 'slide_deleted', 'slide_replaced', 'slide_reordered', 'bogus'].map(kind => sha(JSON.stringify(plain(onPlan.planDeckMutationRefresh(planInput(mutation(kind))))))), hashes.filter((_, at) => kinds[at] !== 'deck_restored'), 'flags on: every other mutation plans as before')
    const wr = world({ env: {} }).load(WIRE); assert.deepEqual(plain(wr.addBulkEditUndoCaps({ client_caps: ['mdc1'] }).client_caps), ['mdc1']); assert.equal(wr.STUDIO_BULK_EDIT_UNDO_ENABLED, false)
    assert.match(read(HOOK), /if \(STUDIO_BULK_EDIT_UNDO_ENABLED && routeStudioBulkEditUndoFrame\(parsedMessage, bulkEditUndoContext\(socketSessionId, deckMutationOwnerRef\.current, slideStructureRef\.current, isCurrentSocket\(\)\)\) === 'consumed'\) return; \/\/ BULK-EDIT-UNDO/, 'the hook routes only with a flag on, and only a consumed frame stops there')
    for (const rel of [WIRE, STORE, CARD, CHIP]) assert.doesNotMatch(read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s\/\/ .*$/gm, ''), /undo that|\.test\(\s*(text|message|reply|input)\b|toLowerCase\(\)\.includes/i, `${rel}: a typed "undo that" is not mapped; Director points the user at the chip`)
  })

  // ---- 9. change
  const stripFile = async () => (await import(`data:text/javascript;base64,${Buffer.from(read(STRIP_MODULE)).toString('base64')}`))
  await check('strip: stripping this change gives back the base files byte for byte; every piece occurs once and carries the marker', async () => {
    const mod = await stripFile()
    for (const rel of mod.BULK_EDIT_UNDO_FILES) {
      const head = read(rel); assert.equal(mod.stripBulkEditUndo(rel, head), baseOf(rel), `${rel}: stripped is ${BASE.slice(0, 8)}'s file`)
      for (const [added, original] of mod.BULK_EDIT_UNDO_CHANGES[rel]) {
        assert.equal(head.split(added).length - 1, 1, `${rel}: a piece occurs once`)
        if (rel !== ENV) for (const line of added.split('\n').filter(Boolean)) assert.ok(line.includes(MARKER) || /^\s*\/\/ BULK-EDIT-UNDO|^ *\/\/ .*BULK-EDIT-UNDO/.test(line), `${rel}: every added line carries ${MARKER}: ${line.slice(0, 90)}`)
        assert.ok(!baseOf(rel).includes(added), `${rel}: the base does not hold a piece`)
      }
    }
    assert.deepEqual([...mod.BULK_EDIT_UNDO_FILES].sort(), [ENV, HOOK, LIST, MDC, REFRESH].sort()); assert.equal(mod.BASE_COMMIT, 'caf6577253ad0b30757dbc9f75d07608dbdbf9d3')
    for (const rel of mod.BULK_EDIT_UNDO_NEW_FILES) assert.ok(fs.existsSync(path.join(root, rel)) || rel in overrides, `${rel} exists`)
    for (const rel of mod.stripBulkEditUndo === undefined ? [] : [WIRE, STORE, CARD, CHIP, CSS]) assert.ok(mod.BULK_EDIT_UNDO_NEW_FILES.includes(rel), `${rel} is a listed new file`)
    assert.equal(mod.stripBulkEditUndo('lib/other.ts', 'abc'), 'abc')
  })
  await check('roots and harness: the three shared roots chain the strip innermost; the new files and the two shared ones are in STACKED_PASS3_FILES', () => {
    for (const rel of ROOTS) { const text = read(rel); assert.equal((text.match(/stripThumbnailLastGood\(rel, stripBulkEditUndo\(rel, text\)\)/g) || []).length, 1, `${rel}: chained once, innermost`); assert.equal((text.match(/^import \{ stripBulkEditUndo \} from '\.\/studio-bulk-edit-undo-strip\.mjs'/gm) || []).length, 1) }
    for (const rel of [WIRE, STORE, CARD, CHIP, CSS, LIST, REFRESH]) assert.ok(STACKED_PASS3_FILES.includes(rel), `${rel} is in STACKED_PASS3_FILES`)
    for (const rel of ['.env.example', 'app/builder/page.tsx']) for (const root3 of [stripOpenReadOnly, stripDarkPersist, stripAddSlideStatus]) assert.equal(typeof root3(rel, 'x'), 'string')
    for (const rel of BULK_EDIT_UNDO_FILES) assert.equal(stripAddSlideStatus(rel, read(rel)), stripAddSlideStatus(rel, baseOf(rel)), `${rel}: the add-slide root strips this change out as well`)
  })
  await check('.env.example: one block with both flags, default off, last before # PASS2 ADMIN and after the thumbnail block; exact names', () => {
    const env = read(ENV), lines = env.split('\n')
    for (const name of [BULK, UNDO]) { assert.equal((env.match(new RegExp(`^${name}="false"$`, 'gm')) || []).length, 1, name); assert.equal(lines.filter(line => line.startsWith(`${name}=`)).length, 1) }
    const at = lines.indexOf(`${UNDO}="false"`), admin = lines.findIndex(line => line.startsWith('# PASS2 ADMIN'))
    assert.equal(lines[at - 1], `${BULK}="false"`); assert.equal(lines[at + 1], ''); assert.equal(admin, at + 2, 'right before # PASS2 ADMIN')
    assert.ok(lines.indexOf('NEXT_PUBLIC_STUDIO_THUMBNAIL_LAST_GOOD="false"') < at, 'after the thumbnail last good block (which was last)')
    const block = lines.slice(lines.findIndex(line => line.startsWith('# STUDIO BULK EDIT + CHAT UNDO')), at + 1).join('\n')
    for (const word of ['bulk_edit1', 'undo1', 'chat_capabilities', 'bulk_edit_confirm', 'confirm_bulk_edit:', 'cancel_bulk_edit:', 'undo_change:', 'change_recorded', 'undo_result', 'deck_restored', 'NEXT_PUBLIC_STUDIO_DECK_MUTATION_REFRESH_ENABLED', 'exact value "true"']) assert.ok(block.includes(word), `the block says ${word}`)
    assert.ok(!/credit/i.test(block), 'no credits on this wire')
  })
  await check('scope: the COMMITTED diff BASE..HEAD answers for its own files only; the working tree is never read', () => {
    const allowed = new Set([...BULK_EDIT_UNDO_FILES, ...BULK_EDIT_UNDO_NEW_FILES, ...ROOTS, HARNESS, ...BULK_EDIT_UNDO_PIN_FILES])
    const changed = git('diff', '--name-only', BASE, 'HEAD').split('\n').filter(Boolean)
    const stray = changed.filter(rel => !allowed.has(rel)); assert.deepEqual(stray, [], `files outside this change: ${stray.join(', ')}`)
    if (!STOP) process.stdout.write(`     (committed diff ${BASE.slice(0, 8)}..HEAD: ${changed.length} files)\n`)
  })
  await check('secrets: no line this change adds carries a credential-shaped literal', () => {
    const added = git('diff', '-U0', BASE, 'HEAD').split('\n').filter(line => /^\+(?!\+\+)/.test(line)).join('\n') + '\n' + [WIRE, STORE, CARD, CHIP, CSS, 'scripts/test-studio-bulk-edit-undo.mjs'].map(rel => (fs.existsSync(path.join(root, rel)) ? fs.readFileSync(path.join(root, rel), 'utf8') : '')).join('\n')
    for (const pattern of [/AKIA[0-9A-Z]{16}/, /sk-[A-Za-z0-9]{20,}/, /xox[bap]-[A-Za-z0-9-]{10,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./, /(?<![A-Za-z_])(?:password|secret|token|api[_-]?key)\s*[:=]\s*['"][^'"\s]{12,}['"]/i])
      assert.ok(!pattern.test(added.replace(/caf6577253ad0b30757dbc9f75d07608dbdbf9d3|8089eee2|f9218b4f/g, '')), `credential-shaped text: ${pattern}`)
  })
  await check('no Layout write, no request: the feature has no network or viewer call of its own', () => {
    for (const rel of [WIRE, STORE, CARD, CHIP]) {
      const code = read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '')
      assert.doesNotMatch(code, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|navigator\.|localStorage|sessionStorage|document\.|window\.|postMessage|sendElementCommand|layout-service|\/versions|\bapi\//i, `${rel}: no request, storage, viewer or version call`)
      assert.doesNotMatch(code, /from ['"](?!react['"]|lucide-react['"]|@\/lib\/studio-bulk-edit-(wire|store)['"]|\.\/studio-bulk-edit-undo\.css['"])/, `${rel}: imports only react, the icons and its own modules`)
    }
    assert.match(read(STORE), /\bsend: AnswerSender/); assert.match(read(LIST), /send: onActionClick \}\) \/\/ BULK-EDIT-UNDO/); assert.equal((read(LIST).match(/send: onActionClick/g) || []).length, 2, 'both senders are the page\'s own answer path')
    const page = fs.readFileSync(path.join(root, 'app/builder/page.tsx'), 'utf8'), hook = read(HOOK)
    assert.match(page, /actionValue: action\.value,\s*\n\s*actionLabel: action\.label,/, 'the page sends an ask\'s answer as actionValue'); assert.match(hook, /\.\.\.\(options\?\.actionValue && \{ action_value: options\.actionValue \}\)/, 'and the hook puts it in user_message.data.action_value')
  })
  await check('look: the sheet is keyed to its own attributes; the shell\'s tokens give 4.5:1 for every text it draws, in light and dark; focus is visible; reduced motion stops the spinner', () => {
    const css = read(CSS), shell = read(SHELL_CSS)
    for (const selector of css.replace(/\/\*[\s\S]*?\*\//g, '').split('{').map(part => part.split('}').pop()).map(s => s.trim()).filter(s => s && !s.startsWith('@') && !/^(from|to|\d+%)/.test(s))) for (const part of selector.split(',')) assert.match(part.trim(), /\[data-studio-(bulk-edit|chat-undo)/, `selector is scoped: ${part.trim().slice(0, 80)}`)
    const blocks = shell.split('}').map(block => block.trim()); const tokens = (marker) => Object.fromEntries([...blocks.find(block => block.includes(marker)).matchAll(/--ss-([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)].map(m => [m[1], m[2]]))
    const light = tokens('[data-studio-v4-shell="true"] {'), dark = { ...light, ...tokens('.dark [data-studio-v4-shell="true"]') }
    const lum = hex => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] }
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
    const mix = (a, b, share) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * share + parseInt(b.slice(i, i + 2), 16) * (1 - share)).toString(16).padStart(2, '0')).join('')
    for (const [mode, t] of [['light', light], ['dark', dark]]) {
      const card = mix(t.accent, t.panel, 0.04)
      for (const [fg, bg, name] of [[t.text, card, 'text on the card'], [t.muted, card, 'muted on the card'], [t.accent, card, 'heading on the card'], [t.text, t.panel, 'text on a chip'], [t.muted, t.panel, 'muted on a chip'],
        [t['on-action'], t.action, 'primary button'], [t.text, t.panel, 'secondary button'], [t.text, t.panel, 'idle Undo'], [t.muted, t.panel, 'Undone / Couldn\'t undo']]) assert.ok(ratio(fg, bg) >= 4.5, `${mode}: ${name} is ${ratio(fg, bg).toFixed(2)}:1`)
      for (const [fg, bg, name] of [[t.teal, t.panel, 'a done mark (icon)']]) assert.ok(ratio(fg, bg) >= 3, `${mode}: ${name} is ${ratio(fg, bg).toFixed(2)}:1`)
    }
    assert.match(css, /:focus-visible \{ outline: 2px solid var\(--ss-accent\)/); assert.match(css, /prefers-reduced-motion: reduce[\s\S]*animation: none/); assert.match(css, /forced-colors: active/)
    assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /#[0-9a-fA-F]{3,8}\b|rgb\(/, 'no colour of its own: the shell\'s tokens only')
  })
}

// ---------------------------------------------------------------- mutants
const MUTANTS = [
  { name: 'flag spelling (bulk): another variable name', edits: [[WIRE, "process.env.NEXT_PUBLIC_STUDIO_BULK_EDIT === 'true'", "process.env.NEXT_PUBLIC_STUDIO_BULKEDIT === 'true'"]] },
  { name: 'flag spelling (undo): truthy, not exact "true"', edits: [[WIRE, "process.env.NEXT_PUBLIC_STUDIO_CHAT_UNDO === 'true'", "!!process.env.NEXT_PUBLIC_STUDIO_CHAT_UNDO"]] },
  { name: 'capability gate ignored (confirm card)', edits: [[STORE, 'if (!store.capabilities(sessionId).bulkEdit) return null', '']] },
  { name: 'capability gate ignored (Undo chip)', edits: [[CHIP, 'sessionId && store.capabilities(sessionId).chatUndo ? ', 'sessionId ? ']] },
  { name: 'capability read from the wrong key', edits: [[WIRE, 'bulkEdit: caps[CAPABILITY_BULK_EDIT] === true', 'bulkEdit: caps[CAPABILITY_BULK_EDIT] !== undefined']] },
  { name: 'double answer allowed (the card does not lock)', edits: [[CARD, '    if (locked) return\n', '']] },
  { name: 'double answer allowed (an answered ask sends again)', edits: [[STORE, '|| gate.answered.has(gate.answerKey)) return false', ') return false']] },
  { name: '"Done" on a partial: the all-changed state needs only one slide', edits: [[WIRE, 'summary.total > 0 && summary.done === summary.total && summary.failed === 0 && summary.skipped === 0', 'summary.done > 0']] },
  { name: 'wrong count on the card', edits: [[CARD, "const count = `${model.slideCount} slide${model.slideCount === 1 ? '' : 's'}`", "const count = `${model.slideCount + 1} slide${model.slideCount === 1 ? '' : 's'}`"]] },
  { name: 'wrong count accepted by the wire (chips and count may disagree)', edits: [[WIRE, 'if (bulk.slide_count !== indexes.length) return null', '']] },
  { name: 'undo sent twice (a second click is not stopped)', edits: [[STORE, 'if (!store.beginUndo(sessionId, changeId)) return false', '']] },
  { name: 'undo sent twice (pending is not final)', edits: [[STORE, "if (!record || record.state.phase !== 'idle') return false", 'if (!record) return false']] },
  { name: 'undo writes to Layout', edits: [[STORE, 'const action = undoChangeAction(changeId)\n', "const action = undoChangeAction(changeId)\n    await fetch('/api/presentations/x/versions/restore', { method: 'POST' })\n"]] },
  { name: 'a malformed frame throws (receipts)', edits: [[WIRE, "return { bulkId, slideId: cleanId(body.slide_id), slideIndex: body.slide_index, status, reason: cleanText(body.reason, MAX_REASON) }\n  } catch { return null }", "return { bulkId, slideId: cleanId(body.slide_id), slideIndex: body.slide_index, status, reason: cleanText(body.reason, MAX_REASON) }\n  } catch (error) { throw error }"]] },
  { name: 'a malformed frame throws (the store)', edits: [[STORE, "    } catch { return 'pass' }\n  }\n\n  return {", "    } catch (error) { throw error }\n  }\n\n  return {"]] },
  { name: 'a malformed confirm is drawn anyway (generic card instead of nothing)', edits: [[STORE, "return model ? { kind: 'card', model } : { kind: 'hidden' }", 'return model ? { kind: \'card\', model } : null']] },
  { name: 'cross-bulk receipt mixing', edits: [[STORE, 'let bulk = data.bulks.get(bulkId)', "let bulk = data.bulks.get('shared')"], [STORE, 'data.bulks.set(bulkId, bulk)', "data.bulks.set('shared', bulk)"]] },
  { name: 'a receipt of another slide is shown on the slide at that position', edits: [[CARD, 'receipt.slideId !== null && model.slideIds[at] !== null && receipt.slideId !== model.slideIds[at]', 'false']] },
  { name: 'flag off changed: the hook routes frames without a flag', edits: [[HOOK, 'if (STUDIO_BULK_EDIT_UNDO_ENABLED && routeStudioBulkEditUndoFrame(', 'if (routeStudioBulkEditUndoFrame(']] },
  { name: 'flag off changed: the card is drawn without the flag (both gates removed)', edits: [[LIST, 'const bulkAsk = STUDIO_BULK_EDIT_ENABLED && studio ? bulkEditAskDecision(actionMsg, sessionId) : null', 'const bulkAsk = studio ? bulkEditAskDecision(actionMsg, sessionId) : null'], [STORE, 'if (!STUDIO_BULK_EDIT_ENABLED || !isBulkEditConfirmFrame({ type', 'if (!isBulkEditConfirmFrame({ type']] },
  { name: 'flag off changed: the chip is drawn without the flag (both gates removed)', edits: [[LIST, '{STUDIO_CHAT_UNDO_ENABLED && studio && <StudioUndoChip', '{studio && <StudioUndoChip'], [STORE, "if (!STUDIO_CHAT_UNDO_ENABLED) return 'pass'\n        if (foreign) return 'consumed'\n        const change", "if (foreign) return 'consumed'\n        const change"]] },
  { name: 'caps sent with the flag off', edits: [[WIRE, '...(STUDIO_BULK_EDIT_ENABLED ? [BULK_EDIT_CLIENT_CAP] : []),', '...[BULK_EDIT_CLIENT_CAP],']] },
  { name: 'client cap misspelled', edits: [[WIRE, "export const UNDO_CLIENT_CAP = 'undo1'", "export const UNDO_CLIENT_CAP = 'undo_1'"]] },
  { name: 'an answer path other than action_value (the confirm action is rewritten)', edits: [[STORE, 'await gate.send(action, messageId, gate.answerKey)', "await gate.send({ ...action, value: action.value.replace('confirm_bulk_edit:', 'bulk_choice:') }, messageId, gate.answerKey)"]] },
  { name: 'an answer path other than action_value (the undo value)', edits: [[WIRE, 'value: `${UNDO_CHANGE_PREFIX}${changeId}`', 'value: `undo:${changeId}`']] },
  { name: 'an older chip still enabled after a newer change_recorded', edits: [[STORE, "for (const record of data.changes) if (record.change.presentationId === change.presentationId && record.state.phase === 'idle') record.state = { phase: 'superseded' }", '']] },
  { name: 'the newer change supersedes another deck\'s chips too', edits: [[STORE, 'if (record.change.presentationId === change.presentationId && record.state.phase', 'if (record.state.phase']] },
  { name: 'a change for another presentation is recorded', edits: [[STORE, '|| change.presentationId !== context.presentationId) return', ') return']] },
  { name: 'v1 scope widened: any change kind gets a chip', edits: [[WIRE, "!CHANGE_KINDS.includes(body.kind)", 'false']] },
  { name: 'deck_restored ignored with the flag on', edits: [[WIRE, "if (!STUDIO_CHAT_UNDO_ENABLED || frameType(frame) !== 'deck_mutation'", "if (true || frameType(frame) !== 'deck_mutation'"]] },
  { name: 'deck_restored handled with the flag off (the adapter)', edits: [[WIRE, "if (!STUDIO_CHAT_UNDO_ENABLED || frameType(frame) !== 'deck_mutation'", "if (frameType(frame) !== 'deck_mutation'"]] },
  { name: 'deck_restored handled with the flag off (the hook line)', edits: [[HOOK, 'if (STUDIO_CHAT_UNDO_ENABLED) normaliseDeckRestored(parsedMessage);', 'normaliseDeckRestored(parsedMessage);']] },
  { name: 'deck_restored keeps the old slide count (not marked restored)', edits: [[WIRE, '    frame.payload.restored = true\n', '']] },
  { name: 'deck_restored keeps the old slide count (the planner)', edits: [[REFRESH, "    : (payload as { restored?: unknown }).restored === true ? null // BULK-EDIT-UNDO: the socket hook marks an undo's deck_restored (NEXT_PUBLIC_STUDIO_CHAT_UNDO) with restored:true; a restored version may have another slide count, so none is guessed (the rail's re-read settles it)\n", '']] },
  { name: 'deck_restored read as another mutation (a slide is deleted)', edits: [[WIRE, "frame.payload.mutation = 'slide_replaced'", "frame.payload.mutation = 'slide_deleted'"]] },
  { name: 'a raw reason code is drawn (receipts)', edits: [[WIRE, 'return REASON_CODE.test(reason) ? null : reason', 'return reason']] },
  { name: 'a failed undo shows the raw reason code', edits: [[CHIP, 'const why = undoReasonWords(state.reason)', 'const why = state.reason']] },
  { name: 'usd formatted instead of the label', edits: [[CARD, '{BULK_EDIT_COPY.estimate}: {model.estimateLabel}', '{BULK_EDIT_COPY.estimate}: ${model.estimateUsd}']] },
  { name: 'credits shown', edits: [[CARD, '{model.estimateLabel ? <p', '{model.estimateLabel ? <p title="credits"']] },
  { name: 'undo chip anchored to the first Director line, not the latest', edits: [[STORE, 'if (turn) dataFor(sessionId).lastDirectorChat = turn.messageId', 'if (turn && !dataFor(sessionId).lastDirectorChat) dataFor(sessionId).lastDirectorChat = turn.messageId']] },
  { name: 'receipts keyed by arrival, not by slide', edits: [[STORE, '.receipts[receipt.slideIndex] = receipt', '.receipts[Object.keys(bulkFor(dataFor(sessionId), receipt.bulkId).receipts).length] = receipt']] },
  { name: 'strip: a piece of the strip is wrong', edits: [[STRIP_MODULE, 'export function stripBulkEditUndo(rel, text) {\n  const table = CHANGES[rel]\n  if (!table) return text\n', 'export function stripBulkEditUndo(rel, text) {\n  const table = CHANGES[rel]\n  if (!table || rel === \'types/mdc.ts\') return text\n']] },
  { name: 'env block default on', edits: [[ENV, 'NEXT_PUBLIC_STUDIO_CHAT_UNDO="false"', 'NEXT_PUBLIC_STUDIO_CHAT_UNDO="true"']] },
]

console.log(`Studio bulk edit + chat undo (${BASE.slice(0, 8)} base)`)
await suite()
console.log(`${results.passed} checks passed, ${results.failed.length} failed`)
let escaped = 0
if (results.failed.length === 0 && !process.env.BULK_EDIT_UNDO_NO_MUTANTS) {
  STOP = true
  const sourceOf = rel => fs.readFileSync(path.join(root, rel), 'utf8')
  let killed = 0
  for (const mutant of MUTANTS) {
    overrides = {}
    for (const [rel, from, to] of mutant.edits) {
      const source = rel in overrides ? overrides[rel] : sourceOf(rel)
      assert.equal(source.split(from).length - 1, 1, `mutant "${mutant.name}" no longer applies to ${rel}: ${from.slice(0, 70)}`)
      overrides[rel] = source.replace(from, () => to)
    }
    let caught = false
    try { await suite() } catch { caught = true }
    overrides = {}
    if (process.env.BULK_EDIT_UNDO_WHY) console.log(`  ${caught ? 'killed' : 'SURVIVED'} ${mutant.name}\n     by ${LAST}`)
    if (caught) killed++; else { escaped++; console.log(`SURVIVED mutant: ${mutant.name}`) }
  }
  console.log(`${killed}/${MUTANTS.length} mutants killed`)
}
const bad = results.failed.length + escaped
console.log(bad === 0 ? 'PASS test-studio-bulk-edit-undo' : `FAIL test-studio-bulk-edit-undo (${results.failed.length} checks, ${escaped} surviving mutants)`)
process.exit(bad === 0 ? 0 : 1)
