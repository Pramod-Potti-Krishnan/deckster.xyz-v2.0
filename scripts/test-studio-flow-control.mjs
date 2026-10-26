// FRONTEND-1 (P3-1 D "flow control", Studio half): proof of NEXT_PUBLIC_STUDIO_FLOW_FOCUS, NEXT_PUBLIC_STUDIO_FLOW_AMEND and NEXT_PUBLIC_STUDIO_FLOW_AMEND_INSTRUCTIONS (the string "true", default off, build-time).
//   lib/studio-flow-control.ts (pure decisions), hooks/use-studio-flow-control.ts (state, timers, sends), components/build-narration/flow-amend-bar.tsx (the line and the buttons),
//   marked lines in app/builder/page.tsx, hooks/use-deckster-websocket-v2.ts and types/build-narration.ts, and the .env.example block.
// The Director side is streams/director2/flow-control/CONTRACT.md (26 Oct): build_phase `settled` after a stop, `steer_pending` on a paused ack, `applied_to` on the resume ack, instructions <= 1000 characters.
//
//   A. The lib, function by function (flags, frame -> focus event incl. the 1-based slide_update, the focus target and its user-navigation rules, Director's acknowledgements, the amend state, the resume text, the rebuild steps).
//   B. The bar, drawn and clicked.
//   C. The REAL hook in the chat harness's offline React host with a virtual clock: follow-the-build (settle, viewer readiness, overlay, user takes over, build takes over, restored deck), the paused composer,
//      Resume (plain and with instructions), Rebuild (stop, settled / 8 s, send once), steer and applied lines, and flags off: nothing filled, listened to, timed or sent.
//   D. The page, the socket hook, the types and .env.example: every marked line is where and as gated as it must be; stripping them gives the base's files byte for byte; the scope is this change's files.
//   E. MUTANTS: every one of them must be caught by A-D.
//
//   node scripts/test-studio-flow-control.mjs
//
// Offline: no socket, fetch or real timer (the harness's host network guard is installed); git is read only for D.
process.env.NODE_ENV = 'production'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import net from 'node:net'
import dns from 'node:dns'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { installHostNetworkGuard } from './studio-chat-harness/fake-env.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const release = installHostNetworkGuard(net, dns)
let checks = 0
const ok = (condition, message) => { checks++; assert.ok(condition, message) }
const eq = (actual, expected, message) => { checks++; assert.deepEqual(actual, expected, message) }
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')

const React = (await import('react')).default
const { renderToStaticMarkup } = await import('react-dom/server')
const { Root } = await import('./studio-chat-harness/mini-react.mjs')
const { createEnvironment } = await import('./studio-chat-harness/fake-env.mjs')
const strip = await import('./studio-flow-control-strip.mjs')
const macrotask = () => new Promise(resolve => setImmediate(resolve))

const LIB = 'lib/studio-flow-control.ts'
const HOOK = 'hooks/use-studio-flow-control.ts'
const BAR = 'components/build-narration/flow-amend-bar.tsx'
const PAGE = 'app/builder/page.tsx'
const WS = 'hooks/use-deckster-websocket-v2.ts'
const TYPES = 'types/build-narration.ts'
// Later changes stack on top of this one, so every source, diff and scope check reads THIS change's own newest commit, not HEAD or the working tree.
const OWN = (() => { try { const run = (...a) => execFileSync('git', ['-C', root, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); return run('log', '-1', '--format=%H', '--no-merges', '-E', '--grep=^Flow control', 'HEAD') || run('rev-parse', 'HEAD') } catch { return null } })()
const readOwn = rel => { if (!OWN) return read(rel); try { return execFileSync('git', ['-C', root, 'show', `${OWN}:${rel}`], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }) } catch { return read(rel) } }
const SOURCES = { [LIB]: read(LIB), [HOOK]: read(HOOK), [BAR]: read(BAR), [PAGE]: readOwn(PAGE), [WS]: readOwn(WS), [TYPES]: readOwn(TYPES), '.env.example': readOwn('.env.example') }

// ---- evaluation of module text (the real files and the mutants), in THIS realm so deepEqual compares plain objects ----------------------------------
function compile(text, fileName) {
  const out = ts.transpileModule(text, { fileName, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, isolatedModules: true } })
  const errors = (out.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error)
  if (errors.length) throw new Error(`${fileName} does not transpile: ${ts.flattenDiagnosticMessageText(errors[0].messageText, '\n')}`)
  return out.outputText
}
function evalModule(text, fileName, scope = {}, requires = {}) {
  const module = { exports: {} }
  const names = Object.keys(scope)
  new Function('module', 'exports', 'require', ...names, compile(text, fileName))(module, module.exports, name => {
    if (!(name in requires)) throw new Error(`unexpected import ${name} in ${fileName}`)
    return requires[name]
  }, ...names.map(name => scope[name]))
  return module.exports
}
const FLAG_FOCUS = 'NEXT_PUBLIC_STUDIO_FLOW_FOCUS'
const FLAG_AMEND = 'NEXT_PUBLIC_STUDIO_FLOW_AMEND'
const FLAG_INSTR = 'NEXT_PUBLIC_STUDIO_FLOW_AMEND_INSTRUCTIONS'
const NARRATION = 'NEXT_PUBLIC_BUILD_NARRATION'
const CONTROL = 'NEXT_PUBLIC_BUILD_CONTROL'
const ALL_ON = { [FLAG_FOCUS]: 'true', [FLAG_AMEND]: 'true', [FLAG_INSTR]: 'true', [NARRATION]: 'true', [CONTROL]: 'true' }
const loadLib = (text = SOURCES[LIB], env = ALL_ON) => evalModule(text, LIB, { process: { env } })

// ============================================================================================================================================
// A. The lib
// ============================================================================================================================================
function libSuite(lib) {
  // -- flags ------------------------------------------------------------------------------------------------------------------------------
  for (const [label, env, want] of [
    ['unset', {}, [false, false, false]],
    ['"false"', { [FLAG_FOCUS]: 'false', [FLAG_AMEND]: 'false', [FLAG_INSTR]: 'false', [NARRATION]: 'true', [CONTROL]: 'true' }, [false, false, false]],
    ['not exactly "true"', { [FLAG_FOCUS]: 'TRUE', [FLAG_AMEND]: '1', [FLAG_INSTR]: 'yes', [NARRATION]: 'true', [CONTROL]: 'true' }, [false, false, false]],
    ['focus alone', { [FLAG_FOCUS]: 'true' }, [true, false, false]],
    ['amend without the narration and control flags', { [FLAG_AMEND]: 'true' }, [false, false, false]],
    ['amend with narration only', { [FLAG_AMEND]: 'true', [NARRATION]: 'true' }, [false, false, false]],
    ['amend with control only', { [FLAG_AMEND]: 'true', [CONTROL]: 'true' }, [false, false, false]],
    ['amend with both', { [FLAG_AMEND]: 'true', [NARRATION]: 'true', [CONTROL]: 'true' }, [false, true, false]],
    ['instructions without amend', { [FLAG_INSTR]: 'true', [NARRATION]: 'true', [CONTROL]: 'true' }, [false, false, false]],
    ['instructions with amend but not narration/control', { [FLAG_INSTR]: 'true', [FLAG_AMEND]: 'true' }, [false, false, false]],
    ['instructions with amend, narration and control', { [FLAG_INSTR]: 'true', [FLAG_AMEND]: 'true', [NARRATION]: 'true', [CONTROL]: 'true' }, [false, true, true]],
    ['everything', ALL_ON, [true, true, true]],
  ]) {
    const flags = loadLib(SOURCES_BY_LIB.get(lib) ?? SOURCES[LIB], env)
    eq([flags.STUDIO_FLOW_FOCUS_ENABLED, flags.STUDIO_FLOW_AMEND_ENABLED, flags.STUDIO_FLOW_AMEND_INSTRUCTIONS_ENABLED], want, `flags: ${label}`)
  }
  eq(lib.flowFocusFlagOn('true'), true, 'focus flag fn: true'); eq(lib.flowFocusFlagOn(undefined), false, 'focus flag fn: unset')

  // -- the bus ------------------------------------------------------------------------------------------------------------------------
  eq([lib.flowBus.focus, lib.flowBus.phase, lib.flowBus.instructions, lib.takeFlowInstructions()], [null, null, undefined, undefined], 'bus: empty at rest')
  lib.flowBus.instructions = 'Shorter titles'
  eq([lib.takeFlowInstructions(), lib.flowBus.instructions, lib.takeFlowInstructions()], ['Shorter titles', undefined, undefined], 'bus: the instructions are taken once, and only once')

  // -- the focus index ----------------------------------------------------------------------------------------------------------------------
  const idx = (over) => lib.flowFocusIndex({ kind: 'deck_mutation', slideIndex: 3, newSlideIndex: null, mutation: 'slide_replaced', ...over })
  eq(idx({}), 3, 'slide_index')
  eq(idx({ newSlideIndex: 5 }), 5, 'new_slide_index wins')
  eq(idx({ newSlideIndex: 0 }), 0, 'new_slide_index 0 is a slide, not "absent"')
  eq(idx({ newSlideIndex: undefined }), 3, 'absent new_slide_index falls back')
  eq(idx({ slideIndex: 0 }), 0, 'slide_index 0')
  eq(idx({ newSlideIndex: Number.NaN }), null, 'a bad new_slide_index points nowhere')
  eq(idx({ slideIndex: -1 }), null, 'negative'); eq(idx({ slideIndex: 1.5 }), null, 'fraction'); eq(idx({ slideIndex: '2' }), null, 'a string')
  eq(idx({ slideIndex: null }), null, 'null'); eq(idx({ slideIndex: Number.MAX_SAFE_INTEGER + 2 }), null, 'unsafe integer')
  eq(idx({ mutation: 'slide_deleted' }), null, 'a deleted slide has nothing to show')
  eq(lib.flowFocusIndex({ kind: 'slide_built', slideIndex: 4, mutation: 'slide_deleted' }), 4, 'only deck_mutation reads the mutation kind')

  // -- frames -> focus events ----------------------------------------------------------------------------------------------------------------
  const from = lib.flowFocusEventFromFrame
  const mutation = (payload, type = 'deck_mutation') => ({ type, message_id: 'm1', session_id: 's1', payload: { mutation: 'slide_replaced', slide_index: 2, presentation_id: 'pres-1', refresh_token: 'r', ...payload } })
  eq(from(mutation({})), { kind: 'deck_mutation', messageId: 'm1', presentationId: 'pres-1', slideIndex: 2, newSlideIndex: null, mutation: 'slide_replaced', restored: false }, 'deck_mutation')
  eq(from(mutation({ mutation: 'slide_reordered', slide_index: 1, new_slide_index: 4 })).newSlideIndex, 4, 'deck_mutation: reordered new index')
  eq(lib.flowFocusIndex(from(mutation({ new_slide_index: 'x' }))), null, 'deck_mutation: an invalid new_slide_index is not ignored in favour of slide_index')
  eq(from(mutation({ restored: true })).restored, true, 'deck_mutation: restored (chat undo)')
  eq(from(mutation({ mutation: 'deck_restored', slide_index: 0 })).restored, true, 'deck_mutation: raw deck_restored')
  eq(from(mutation({ presentation_id: ' pres-1' })).presentationId, null, 'deck_mutation: an unclean presentation id is none')
  eq(from(mutation({}, 'slide_built')), { kind: 'slide_built', messageId: 'm1', presentationId: 'pres-1', slideIndex: 2 }, 'slide_built')
  eq(from(mutation({}, 'slide_ready')), { kind: 'slide_ready', messageId: 'm1', presentationId: 'pres-1', slideIndex: 2 }, 'slide_ready')
  eq(from(mutation({ slide_index: 0 }, 'slide_built')).slideIndex, 0, 'slide_built: 0-based, 0 is the first slide')
  eq(from(mutation({ slide_index: 6 }, 'change_recorded')), { kind: 'change_recorded', messageId: 'm1', presentationId: 'pres-1', slideIndex: 6 }, 'change_recorded with a slide_index')
  eq(from(mutation({ slide_index: undefined }, 'change_recorded')), null, 'change_recorded without one has nothing to show')
  eq(from(mutation({ slide_index: -3 }, 'change_recorded')), null, 'change_recorded with a bad one')
  const update = (payload) => ({ type: 'slide_update', payload: { operation: 'partial_update', metadata: { preview_presentation_id: 'pres-1' }, slides: [{ slide_id: 'a', slide_number: 2 }, { slide_id: 'b', slide_number: 5 }], affected_slides: null, ...payload } })
  eq(from(update({})), { kind: 'slide_update', messageId: null, presentationId: 'pres-1', slideIndex: 4 }, 'slide_update: slide_number is 1-based (5 -> 4), the last slide of the update')
  eq(from({ ...update({}), message_id: 'u1' }).messageId, 'u1', 'slide_update: its message id')
  eq(from({ ...mutation({}), message_id: '' }).messageId, null, 'an empty message id is none')
  eq([...lib.FLOW_FOCUS_FRAME_TYPES].sort(), ['change_recorded', 'deck_mutation', 'slide_built', 'slide_ready', 'slide_update'], 'the frames the socket hook shows the page')
  for (const type of lib.FLOW_FOCUS_FRAME_TYPES) eq(lib.isFlowFocusFrameType(type), true, `${type} is shown to the page`)
  for (const type of ['build_event', 'slide_progress', 'bulk_edit_progress', 'build_phase', 'chat_message', 'slide_context', '', undefined, null, 5, {}]) eq(lib.isFlowFocusFrameType(type), false, `${JSON.stringify(type)} is not`)
  eq(from(update({ affected_slides: ['a'] })).slideIndex, 1, 'slide_update: only the affected slides (2 -> 1)')
  eq(from(update({ affected_slides: [] })).slideIndex, 4, 'slide_update: an empty affected list is all of them')
  eq(from(update({ affected_slides: ['zz'] })).slideIndex, null, 'slide_update: affected slides that are not in the list point nowhere')
  eq(from(update({ operation: 'full_update' })), null, 'slide_update: a full update is the whole outline arriving')
  eq(from(update({ slides: [{ slide_id: 'a', slide_number: 0 }] })).slideIndex, null, 'slide_update: slide_number 0 is not a slide')
  eq(from(update({ slides: [] })).slideIndex, null, 'slide_update: no slides')
  eq(from(update({ metadata: {}, preview_presentation_id: 'pres-9' })).presentationId, 'pres-9', 'slide_update: the id at the payload root')
  eq(from(update({ metadata: { preview_presentation_id: 'pres-1' }, preview_presentation_id: 'pres-9' })).presentationId, 'pres-1', 'slide_update: metadata first')
  for (const type of ['build_event', 'slide_progress', 'bulk_edit_progress', 'chat_message', 'build_phase']) {
    eq(from({ type, payload: { slide_index: 2, presentation_id: 'pres-1' } }), null, `${type} is never a focus event`)
  }
  for (const junk of [null, undefined, 'x', 3, {}, { type: 'deck_mutation' }, { type: 'deck_mutation', payload: 'x' }]) eq(from(junk), null, `junk frame ${JSON.stringify(junk)}`)

  // -- the focus target ---------------------------------------------------------------------------------------------------------------------
  const event = (over = {}) => ({ kind: 'deck_mutation', presentationId: 'pres-1', slideIndex: 3, newSlideIndex: null, mutation: 'slide_replaced', ...over })
  const target = (over = {}) => lib.flowFocusTarget({ enabled: true, event: event(), displayedPresentationId: 'pres-1', overlay: false, state: lib.initialFlowFocusState(), now: 100000, ...over })
  eq(target(), { index: 3, selectStage: false }, 'target: the slide, no stage change on a wide layout')
  eq(target({ overlay: true }), { index: 3, selectStage: true }, 'target: on an overlay layout the stage pane is brought up')
  eq(target({ enabled: false }), null, 'target: flag off')
  eq(target({ displayedPresentationId: 'pres-2' }), null, 'target: another deck on the stage')
  eq(target({ displayedPresentationId: null }), null, 'target: no deck on the stage')
  eq(target({ displayedPresentationId: undefined, event: event({ presentationId: undefined }) }), null, 'target: neither side has an id')
  eq(target({ event: event({ presentationId: '' }) }), null, 'target: an empty id')
  eq(target({ displayedPresentationId: 'pres-2', alsoPresentationIds: [null, 'pres-1'] }), { index: 3, selectStage: false }, 'target: the deck this build is filling counts')
  eq(target({ displayedPresentationId: 'pres-2', alsoPresentationIds: [null, 'pres-3'] }), null, 'target: another deck is another deck')
  eq(target({ event: event({ slideIndex: -1 }) }), null, 'target: a bad index')
  eq(target({ event: event({ mutation: 'slide_deleted' }) }), null, 'target: a deleted slide')
  eq(target({ event: event({ slideIndex: 1, newSlideIndex: 6 }) }), { index: 6, selectStage: false }, 'target: new_slide_index')
  const navAt = at => ({ ...lib.initialFlowFocusState(), lastUserNavAt: at })
  eq(target({ state: navAt(99999) }), null, 'target: the user navigated 1 ms ago')
  eq(target({ state: navAt(96001) }), null, 'target: 3999 ms ago')
  eq(target({ state: navAt(96000) }), { index: 3, selectStage: false }, 'target: exactly 4000 ms ago is over')
  eq(target({ state: navAt(50000) }), { index: 3, selectStage: false }, 'target: long ago')
  eq(target({ state: navAt(99000), graceMs: 500 }), { index: 3, selectStage: false }, 'target: the window is a parameter')
  eq(lib.FLOW_FOCUS_USER_NAV_GRACE_MS, 4000, 'the window is 4 s')
  const restored = over => event({ restored: true, slideIndex: 0, mutation: 'slide_replaced', ...over })
  eq(target({ event: restored(), overlay: true }), { index: null, selectStage: true }, 'target: a restored deck only brings the stage up (overlay)')
  eq(target({ event: restored(), overlay: false }), null, 'target: a restored deck on a wide layout has nothing to do')
  eq(target({ event: restored({ slideIndex: 9, newSlideIndex: 4 }), overlay: true }), { index: null, selectStage: true }, 'target: a restored deck ignores its index')
  eq(target({ event: restored({ slideIndex: null }), overlay: true }), { index: null, selectStage: true }, 'target: a restored deck with no index still opens the stage')
  eq(target({ event: restored(), overlay: true, state: navAt(99999) }), null, 'target: a restored deck waits for the user too')
  eq(target({ event: restored({ presentationId: 'other' }), overlay: true }), null, 'target: a restored OTHER deck is ignored')
  // during a build
  const built = (over = {}) => event({ kind: 'slide_built', buildKey: 'b1', mutation: null, ...over })
  const building = over => ({ ...lib.initialFlowFocusState(), buildKey: 'b1', newestBuiltIndex: 2, ...over })
  eq(target({ event: built({ slideIndex: 3 }), state: building() }), { index: 3, selectStage: false }, 'build: a newer slide is followed')
  eq(target({ event: built({ slideIndex: 2 }), state: building() }), null, 'build: the slide already followed is not newer')
  eq(target({ event: built({ slideIndex: 1 }), state: building() }), null, 'build: an older slide finishing late is not followed')
  eq(target({ event: built({ slideIndex: 0 }), state: building({ newestBuiltIndex: null }) }), { index: 0, selectStage: false }, 'build: the first one')
  eq(target({ event: built({ slideIndex: 1 }), state: building({ buildKey: 'b0' }) }), { index: 1, selectStage: false }, 'build: another build starts again')
  eq(target({ event: built({ slideIndex: 5 }), state: building({ takenOverBuildKey: 'b1', lastUserNavAt: 1000 }) }), null, 'build: the user took this build over, however long ago')
  eq(target({ event: built({ slideIndex: 5 }), state: building({ takenOverBuildKey: 'b0', lastUserNavAt: 1000 }) }), { index: 5, selectStage: false }, 'build: taking over an earlier build does not stop this one')
  eq(target({ event: built({ slideIndex: 1, buildKey: null }), state: building() }), { index: 1, selectStage: false }, 'build: with no build key only the 4 s rule applies')
  eq(target({ event: event({ slideIndex: 1 }), state: building({ takenOverBuildKey: 'b1', lastUserNavAt: 1000 }) }), { index: 1, selectStage: false }, 'a deck_mutation is not a build slide: only the 4 s rule')
  eq(target({ event: event({ kind: 'slide_ready', slideIndex: 1 }), state: building() }), { index: 1, selectStage: false }, 'slide_ready is not "newest built" either')

  // -- the focus state -----------------------------------------------------------------------------------------------------------------------
  const s0 = lib.initialFlowFocusState()
  eq(s0, { lastUserNavAt: null, takenOverBuildKey: null, selfIndex: null, selfUntil: 0, settleUntil: 0, lastSeenIndex: null, buildKey: null, newestBuiltIndex: null }, 'state: initial')
  let s = lib.flowFocusAfterTarget(s0, built({ slideIndex: 4 }), 4, 1000)
  eq([s.settleUntil, s.buildKey, s.newestBuiltIndex], [3500, 'b1', 4], 'after: the viewer settles for 2.5 s; the build and its newest slide are noted')
  s = lib.flowFocusAfterTarget(s, built({ slideIndex: 6 }), 6, 2000); eq(s.newestBuiltIndex, 6, 'after: newest moves up')
  s = lib.flowFocusAfterTarget(s, built({ slideIndex: 5 }), 5, 2100); eq(s.newestBuiltIndex, 6, 'after: newest never moves down within a build')
  s = lib.flowFocusAfterTarget(s, built({ slideIndex: 1, buildKey: 'b2' }), 1, 2200); eq([s.buildKey, s.newestBuiltIndex], ['b2', 1], 'after: a new build starts its own count (lower is fine)')
  s = lib.flowFocusAfterTarget(s, event({ slideIndex: 9 }), 9, 2300); eq([s.buildKey, s.newestBuiltIndex], ['b2', 1], 'after: a deck_mutation leaves the build count alone')
  s = lib.flowFocusAfterTarget(s0, restored(), null, 5); eq([s.settleUntil, s.newestBuiltIndex], [2505, null], 'after: no index, no newest')
  eq(lib.flowFocusAfterTarget(s0, built(), 0, 0).newestBuiltIndex, 0, 'after: index 0 is a newest slide')
  eq(s0.settleUntil, 0, 'after: the old state is not changed')
  s = lib.flowFocusMarkSelf(s0, 4, 10); eq([s.selfIndex, s.selfUntil], [4, 2010], 'self: our own goToSlide is ours for 2 s')
  s = lib.flowFocusNoteUserNav(s0, 500, 'b1'); eq([s.lastUserNavAt, s.takenOverBuildKey], [500, 'b1'], 'user nav: stamped, and takes the build over')
  s = lib.flowFocusNoteUserNav({ ...s0, buildKey: 'b7' }, 500); eq(s.takenOverBuildKey, 'b7', 'user nav: with no key given, the build the state knows')
  s = lib.flowFocusNoteUserNav({ ...s0, takenOverBuildKey: 'b3' }, 500); eq(s.takenOverBuildKey, 'b3', 'user nav: with no build at all, an earlier takeover stays')
  // slide changes the viewer reports
  s = lib.flowFocusNoteSlideChange(s0, 0, 100, 'b1'); eq([s.lastUserNavAt, s.lastSeenIndex], [null, 0], 'change: the first report is where the viewer starts')
  const seen = { ...s0, lastSeenIndex: 0 }
  s = lib.flowFocusNoteSlideChange(seen, 5, 100, 'b1'); eq([s.lastUserNavAt, s.takenOverBuildKey, s.lastSeenIndex], [100, 'b1', 5], 'change: a move the user made counts, and takes the build over')
  s = lib.flowFocusNoteSlideChange(seen, 0, 100); eq(s, seen, 'change: the same slide again is nothing')
  s = lib.flowFocusNoteSlideChange({ ...seen, selfIndex: 5, selfUntil: 200 }, 5, 199); eq([s.lastUserNavAt, s.lastSeenIndex], [null, 5], 'change: our own move, inside its window')
  s = lib.flowFocusNoteSlideChange({ ...seen, selfIndex: 5, selfUntil: 200 }, 5, 200); eq(s.lastUserNavAt, 200, 'change: our own move, after its window, is the user\'s')
  s = lib.flowFocusNoteSlideChange({ ...seen, selfIndex: 5, selfUntil: 200 }, 6, 150); eq(s.lastUserNavAt, 150, 'change: a different slide than the one we went to is the user\'s')
  s = lib.flowFocusNoteSlideChange({ ...seen, settleUntil: 300 }, 0 + 3, 299); eq([s.lastUserNavAt, s.lastSeenIndex], [null, 3], 'change: the viewer reloading after an event')
  s = lib.flowFocusNoteSlideChange({ ...seen, settleUntil: 300 }, 3, 300); eq(s.lastUserNavAt, 300, 'change: after the settle window')

  // -- the navigation step ------------------------------------------------------------------------------------------------------------------
  const pending = { index: 3, presentationId: 'pres-1', at: 1000 }
  const step = (over = {}) => lib.flowFocusStep({ pending, now: 1500, state: lib.initialFlowFocusState(), hasViewerApi: true, viewerReady: true, ...over })
  eq(step(), { action: 'go' }, 'step: go')
  eq(step({ now: 1399 }), { action: 'wait', retryInMs: 1 }, 'step: not before the settle delay')
  eq(step({ now: 1400 }), { action: 'go' }, 'step: at the settle delay')
  eq(step({ now: 1000 }), { action: 'wait', retryInMs: 400 }, 'step: right away waits the whole delay')
  eq(step({ hasViewerApi: false }), { action: 'wait', retryInMs: 250 }, 'step: no viewer API yet')
  eq(step({ viewerReady: false }), { action: 'wait', retryInMs: 250 }, 'step: the viewer is not ready')
  eq(step({ viewerReady: false, now: 6900 }), { action: 'wait', retryInMs: 100 }, 'step: the last wait is cut to the deadline')
  eq(step({ now: 6999, viewerReady: false }), { action: 'wait', retryInMs: 1 }, 'step: 1 ms before the deadline')
  eq(step({ now: 7000, viewerReady: false }), { action: 'drop' }, 'step: 6 s and the viewer never came')
  eq(step({ now: 7000 }), { action: 'drop' }, 'step: 6 s is 6 s, ready or not')
  eq(step({ state: { ...s0, lastUserNavAt: 1200 } }), { action: 'drop' }, 'step: the user navigated since the event')
  eq(step({ state: { ...s0, lastUserNavAt: 1000 } }), { action: 'drop' }, 'step: in the same millisecond')
  eq(step({ state: { ...s0, lastUserNavAt: 999 } }), { action: 'go' }, 'step: a navigation before the event does not cancel it')

  // -- Director's acknowledgements -----------------------------------------------------------------------------------------------------------
  const sig0 = lib.initialFlowSignals()
  eq(sig0, { buildId: null, settledAt: null, steerPending: false, appliedTo: null, appliedAt: null }, 'signals: initial')
  eq(lib.isFlowSettledPhase({ phase: 'settled' }), true, 'settled is settled'); eq(lib.isFlowSettledPhase({ phase: 'stopped' }), false, 'stopped is not'); eq(lib.isFlowSettledPhase(null), false, 'null is not')
  let sig = lib.flowSignalsReduce(sig0, { build_id: 'b1', phase: 'settled' }, 700)
  eq([sig.buildId, sig.settledAt], ['b1', 700], 'signals: settled stamps the time and learns the build')
  eq(sig.steerPending, false, 'signals: nothing is queued yet')
  eq(lib.flowSignalsReduce(sig, { build_id: 'b1', phase: 'paused' }, 750).steerPending, false, 'signals: the plain paused ack of a pause is not a steer')
  eq(lib.flowSignalsReduce(sig, { build_id: 'b1', phase: 'paused', steer_pending: false }, 750).steerPending, false, 'signals: nor is steer_pending:false')
  sig = lib.flowSignalsReduce(sig, { build_id: 'b1', phase: 'paused', steer_pending: true }, 800); eq(sig.steerPending, true, 'signals: a paused ack with steer_pending')
  sig = lib.flowSignalsReduce(sig, { build_id: 'b1', phase: 'paused' }, 900); eq(sig.steerPending, true, 'signals: a repeated plain paused ack keeps the mark')
  sig = lib.flowSignalsReduce(sig, { build_id: 'b1', phase: 'paused', steer_pending: false }, 900); eq(sig.steerPending, true, 'signals: only building (or another phase) ends the steer')
  sig = lib.flowSignalsReduce(sig, { build_id: 'b1', phase: 'building', applied_to: [5, 3, 4, 4] }, 1000)
  eq([sig.steerPending, sig.appliedTo, sig.appliedAt, sig.settledAt], [false, [3, 4, 5], 1000, 700], 'signals: building ends the steer, carries applied_to (sorted, once each)')
  for (const bad of [null, undefined, 'x', {}, [-1], [1.5], ['2'], [1, 'x'], [1, null]]) {
    eq(lib.flowSignalsReduce(sig0, { build_id: 'b1', phase: 'building', applied_to: bad }, 5).appliedTo, null, `signals: applied_to ${JSON.stringify(bad)} is not a list of slides`)
  }
  eq(lib.flowSignalsReduce(sig0, { build_id: 'b1', phase: 'building', applied_to: [0] }, 5).appliedTo, [0], 'signals: slide 0')
  sig = lib.flowSignalsReduce({ ...sig0, steerPending: true }, { build_id: 'b1', phase: 'building', applied_to: [] }, 6)
  eq([sig.appliedTo, sig.appliedAt, sig.steerPending], [[], 6, false], 'signals: applied_to [] is said, not absent: it applied to no slide (the slides were already in progress)')
  eq(lib.flowSignalsReduce(sig0, { build_id: 'b1', phase: 'building' }, 6).appliedAt, null, 'signals: a building ack with no applied_to says nothing')
  sig = lib.flowSignalsReduce({ ...sig0, steerPending: true }, { phase: 'stopped' }, 10); eq(sig.steerPending, false, 'signals: a stop ends the steer')
  sig = lib.flowSignalsReduce({ ...sig0, steerPending: true }, { phase: 'complete' }, 10); eq(sig.steerPending, false, 'signals: so does the end of the build')
  sig = lib.flowSignalsReduce({ ...sig0, buildId: 'b1', settledAt: 5, steerPending: true, appliedTo: [1], appliedAt: 5 }, { build_id: 'b2', phase: 'planning' }, 10)
  eq(sig, { buildId: 'b2', settledAt: null, steerPending: false, appliedTo: null, appliedAt: null }, 'signals: another build resets all of it')
  sig = lib.flowSignalsReduce({ ...sig0, buildId: 'b1', settledAt: 5 }, { build_id: 'b2', phase: 'settled' }, 10); eq([sig.buildId, sig.settledAt], ['b2', 10], 'signals: a settled of the new build')
  ok(lib.flowSignalsReduce(sig0, null, 1) === sig0 && lib.flowSignalsReduce(sig0, 'x', 1) === sig0 && lib.flowSignalsReduce(sig0, { phase: 'weird' }, 1) === sig0, 'signals: nothing to learn, nothing changes')
  eq(lib.flowAppliedLabel([3, 4, 5, 6]), 'Applied to slides 4–7.', 'label: a range, 1-based')
  eq(lib.flowAppliedLabel([0]), 'Applied to slide 1.', 'label: one slide'); eq(lib.flowAppliedLabel([0, 1]), 'Applied to slides 1–2.', 'label: two')
  eq(lib.flowAppliedLabel([3, 5, 8]), 'Applied to slides 4, 6 and 9.', 'label: a list'); eq(lib.flowAppliedLabel([6, 3, 3, 4, 5]), 'Applied to slides 4–7.', 'label: unsorted, repeated')
  eq([lib.flowAppliedLabel(null), lib.flowAppliedLabel(undefined), lib.flowAppliedLabel([-2])], [null, null, null], 'label: nothing to say')
  eq(lib.flowAppliedLabel([]), "These changes couldn't be applied to slides already in progress — use Rebuild to apply them.", 'label: applied to none, said plainly')
  eq(lib.FLOW_NOT_APPLIED_LINE, "These changes couldn't be applied to slides already in progress — use Rebuild to apply them.", 'the words for applied to none')
  eq([lib.flowAppliedHoldMs([3]), lib.flowAppliedHoldMs([]), lib.flowAppliedHoldMs(null), lib.FLOW_APPLIED_HOLD_MS, lib.FLOW_NOT_APPLIED_HOLD_MS], [8000, 20000, 8000, 8000, 20000], 'label: it asks the user to act, so it stays longer than "Applied to"')

  // -- the amend state -----------------------------------------------------------------------------------------------------------------------
  const amend = (over = {}) => lib.flowAmendState({ enabled: true, active: true, control: 'paused', rebuild: null, draft: '', instructionsEnabled: false, ...over })
  const rebuilding = (stage = 'stopping') => ({ text: 'x', buildId: 'b1', stage, startedAt: 0, stoppedAt: null, sentAt: null })
  for (const hidden of [amend({ enabled: false }), amend({ active: false }), amend({ control: 'running' }), amend({ enabled: false, rebuild: rebuilding() }), amend({ active: false, rebuild: rebuilding() })]) {
    eq([hidden.visible, hidden.key, hidden.line, hidden.canSend, hidden.showResume, hidden.showRebuild], [false, null, '', false, false, false], 'amend: hidden (flag off, no build, or running)')
  }
  eq(lib.FLOW_AMEND_LINES, {
    pause_requested: 'Pausing the build…', paused: 'Paused — type changes, then Resume or Rebuild.', steer_queued: 'Changes queued for resume.', resuming: 'Resuming the build…',
    stopping: 'Stopping the build…', stopped: 'Stopped — your finished slides are kept. Type changes, then Rebuild or Resume.', rebuilding: 'Rebuilding once the last slide finishes…',
  }, 'amend: the lines')
  ok(!/exact "true" enables it/.test(JSON.stringify(lib.FLOW_AMEND_LINES)), 'amend: no developer words')
  const rows = [
    // control, rebuild stage, steer, key, canSend, buttons
    ['pause_requested', null, false, 'pause_requested', false, false],
    ['paused', null, false, 'paused', true, true],
    ['paused', null, true, 'steer_queued', true, true],
    ['resume_requested', null, false, 'resuming', false, false],
    ['stop_requested', null, false, 'stopping', false, false],
    ['stopped', null, false, 'stopped', true, true],
    ['paused', 'stopping', false, 'rebuilding', true, false],
    ['stop_requested', 'stopping', false, 'rebuilding', true, false],
    ['stopped', 'awaiting_settled', false, 'rebuilding', true, false],
    ['stopped', 'sent', false, 'rebuilding', true, false],
  ]
  for (const [control, stage, steerPending, key, canSend, buttons] of rows) {
    const state = amend({ control, steerPending, rebuild: stage ? rebuilding(stage) : null })
    eq([state.visible, state.key, state.line, state.canSend, state.showResume, state.showRebuild, state.resumeEnabled],
      [true, key, key === 'rebuilding' ? (stage === 'sent' ? lib.FLOW_AMEND_REBUILD_SENT_LINE : lib.FLOW_AMEND_LINES.rebuilding) : lib.FLOW_AMEND_LINES[key], canSend, buttons, buttons, buttons], `amend: ${control} / ${stage} / steer ${steerPending}`)
  }
  eq(lib.FLOW_AMEND_REBUILD_SENT_LINE, 'Rebuilding with your changes…', 'amend: the line once the draft is sent')
  let state = amend({ control: 'running', appliedTo: [3, 4, 5, 6] })
  eq([state.visible, state.key, state.line, state.canSend, state.showResume], [true, 'applied', 'Applied to slides 4–7.', false, false], 'amend: applied_to is shown once the build runs again')
  eq(amend({ control: 'paused', appliedTo: [3] }).key, 'paused', 'amend: applied_to is only for a running build')
  eq(amend({ control: 'running', appliedTo: null }).visible, false, 'amend: no applied_to says nothing')
  state = amend({ control: 'running', appliedTo: [] })
  eq([state.visible, state.key, state.line, state.canSend, state.showResume, state.showRebuild, state.rebuildEnabled, state.rebuildHint], [true, 'not_applied', "These changes couldn't be applied to slides already in progress — use Rebuild to apply them.", false, false, true, false, 'Type your changes first'], 'amend: applied_to [] says it plainly and offers Rebuild only (nothing typed yet)')
  state = amend({ control: 'running', appliedTo: [], draft: 'Shorter titles' })
  eq([state.key, state.showRebuild, state.rebuildEnabled, state.rebuildHint], ['not_applied', true, true, null], 'amend: ...Rebuild is ready when the changes are in the box')
  eq(amend({ control: 'paused', appliedTo: [] }).key, 'paused', 'amend: an old applied_to [] does not touch a paused build')
  eq(amend({ control: 'resume_requested', appliedTo: [] }).key, 'resuming', 'amend: ...nor a resuming one')
  eq(amend({ control: 'running', rebuild: rebuilding('sent') }).key, 'rebuilding', 'amend: a rebuild in flight shows even before the control says stopped')
  state = amend({ draft: '' }); eq([state.rebuildEnabled, state.rebuildHint, state.resumeLabel, state.resumeHint], [false, 'Type your changes first', 'Resume', null], 'amend: no draft: Rebuild waits for text')
  state = amend({ draft: '   ' }); eq(state.rebuildEnabled, false, 'amend: blank is no draft')
  state = amend({ draft: 'Shorter titles' }); eq([state.rebuildEnabled, state.rebuildHint, state.resumeLabel], [true, null, 'Resume'], 'amend: a draft enables Rebuild; Resume stays Resume with the instructions flag off')
  state = amend({ draft: 'Shorter titles', instructionsEnabled: true }); eq(state.resumeLabel, 'Resume with these changes', 'amend: with the instructions flag, Resume says it takes the changes')
  state = amend({ draft: '', instructionsEnabled: true }); eq(state.resumeLabel, 'Resume', 'amend: ...only when there is something typed')
  eq(amend({ draft: 'x'.repeat(1000), instructionsEnabled: true }).resumeHint, null, 'amend: 1000 characters fit')
  eq(amend({ draft: 'x'.repeat(1001), instructionsEnabled: true }).resumeHint, 'Only the first 1000 characters are sent.', 'amend: 1001 are cut, and it says so')
  eq(amend({ draft: 'x'.repeat(1001), instructionsEnabled: false }).resumeHint, null, 'amend: nothing is cut with the flag off')
  eq(amend({ draft: '😀'.repeat(1000), instructionsEnabled: true }).resumeHint, null, 'amend: 1000 emoji are 1000 characters')
  eq(amend({ draft: '😀'.repeat(1001), instructionsEnabled: true }).resumeHint, 'Only the first 1000 characters are sent.', 'amend: 1001 emoji are 1001')
  state = amend({ control: 'stopped', draft: 'abc' }); eq([state.showRebuild, state.rebuildEnabled], [true, true], 'amend: stopped can rebuild too')
  state = amend({ control: 'resume_requested', draft: 'abc' }); eq([state.showRebuild, state.rebuildEnabled, state.rebuildHint], [false, false, null], 'amend: no buttons while a request is in flight')

  // -- the resume text ------------------------------------------------------------------------------------------------------------------------
  const resume = (draft, instructionsEnabled = true) => lib.flowResumeInstructions({ instructionsEnabled, draft })
  eq(resume('  Shorter titles  '), 'Shorter titles', 'resume: trimmed'); eq(resume('Shorter titles', false), undefined, 'resume: flag off sends nothing')
  eq([resume(''), resume('   \n '), resume('', false)], [undefined, undefined, undefined], 'resume: nothing typed, nothing sent')
  eq(resume('x'.repeat(1000)), 'x'.repeat(1000), 'resume: 1000 characters unchanged'); eq(resume('x'.repeat(1001)), 'x'.repeat(1000), 'resume: 1001 are cut to 1000')
  eq(resume('x'.repeat(5000)).length, 1000, 'resume: 5000 are cut to 1000')
  eq(resume('😀'.repeat(1000)), '😀'.repeat(1000), 'resume: 1000 emoji unchanged')
  const cut = resume('😀'.repeat(1001)); eq([Array.from(cut).length, cut === '😀'.repeat(1000)], [1000, true], 'resume: 1001 emoji are cut by character, never inside a pair')
  eq(resume(`${'a'.repeat(999)}😀😀`), `${'a'.repeat(999)}😀`, 'resume: the cut falls after whole characters')

  // -- the rebuild steps ----------------------------------------------------------------------------------------------------------------------
  const rb = (over = {}) => ({ text: 'Shorter titles', buildId: 'b1', stage: 'stopping', startedAt: 1000, stoppedAt: null, sentAt: null, ...over })
  const rstep = (over = {}, rebuild = rb()) => lib.flowRebuildStep({ rebuild, control: 'stop_requested', phase: 'building', buildId: 'b1', now: 1100, settledAt: null, ...over })
  eq(lib.flowRebuildStep({ rebuild: null, control: 'paused', phase: 'paused', buildId: 'b1', now: 5 }), 'none', 'rebuild: nothing pending')
  eq(rstep(), 'wait', 'rebuild: the stop is in flight')
  eq(rstep({ control: 'stopped', phase: 'stopped' }), 'stopped', 'rebuild: Director said stopped: now wait for settled')
  eq(rstep({ control: 'running', phase: 'stopped' }), 'stopped', 'rebuild: the phase alone says stopped too')
  eq(rstep({ control: 'stopped', phase: 'stopped', settledAt: 1000 }), 'send', 'rebuild: settled at the start counts')
  eq(rstep({ control: 'stopped', phase: 'stopped', settledAt: 999 }), 'stopped', 'rebuild: a settled from before this rebuild does not')
  eq(rstep({ control: 'paused', phase: 'paused', now: 1749 }), 'wait', 'rebuild: the stop request has 750 ms to show as a control state')
  eq(rstep({ control: 'paused', phase: 'paused', now: 1750 }), 'cancel', 'rebuild: then a control that fell back means the stop failed')
  eq(rstep({ control: 'running', phase: 'complete' }), 'cancel', 'rebuild: the build ended'); eq(rstep({ control: 'running', phase: 'error' }), 'cancel', 'rebuild: the build failed')
  eq(rstep({ control: 'running', phase: 'idle' }), 'cancel', 'rebuild: idle')
  eq(rstep({ buildId: 'b2' }), 'cancel', 'rebuild: another build'); eq(rstep({ buildId: null }), 'wait', 'rebuild: no build id now is no news')
  eq(rstep({}, rb({ buildId: null })), 'wait', 'rebuild: no build id then is no news either')
  const waiting = over => rb({ stage: 'awaiting_settled', stoppedAt: 2000, ...over })
  const wstep = (over = {}, rebuild = waiting()) => rstep({ control: 'stopped', phase: 'stopped', now: 2100, ...over }, rebuild)
  eq(wstep(), 'wait', 'rebuild: waiting for settled'); eq(wstep({ settledAt: 1500 }), 'send', 'rebuild: settled -> send')
  eq(wstep({ settledAt: 999 }), 'wait', 'rebuild: an old settled is not this one')
  eq(wstep({ now: 9999 }), 'wait', 'rebuild: 7999 ms after stopped: still waiting'); eq(wstep({ now: 10000 }), 'send', 'rebuild: 8 s after stopped and no settled: send anyway (Director flag off)')
  eq(wstep({ control: 'running', phase: 'building' }), 'cancel', 'rebuild: no longer stopped (resumed by hand): cancel')
  eq(wstep({ buildId: 'b2' }), 'cancel', 'rebuild: another build while waiting')
  const sent = over => rb({ stage: 'sent', stoppedAt: 2000, sentAt: 3000, ...over })
  eq(wstep({ now: 3100 }, sent()), 'wait', 'rebuild: sent, still stopped: hold the line'); eq(wstep({ now: 12999 }, sent()), 'wait', 'rebuild: 9999 ms after the send')
  eq(wstep({ now: 13000 }, sent()), 'done', 'rebuild: 10 s after the send')
  eq(wstep({ control: 'running', phase: 'building', now: 3100 }, sent()), 'done', 'rebuild: the new build shows')
  eq(wstep({ buildId: 'b2', now: 3100 }, sent()), 'done', 'rebuild: another build id after the send')
  eq(lib.flowRebuildWakeInMs(null, 5), null, 'wake: nothing')
  eq(lib.flowRebuildWakeInMs(rb(), 1000), 750, 'wake: the stop grace'); eq(lib.flowRebuildWakeInMs(rb(), 1750), null, 'wake: at the deadline only a new input can change the answer'); eq(lib.flowRebuildWakeInMs(rb(), 2000), null, 'wake: past it, none (no timer spinning)')
  eq(lib.flowRebuildWakeInMs(waiting(), 2500), 7500, 'wake: the settled wait'); eq(lib.flowRebuildWakeInMs(sent(), 4000), 9000, 'wake: the hold')
}
const SOURCES_BY_LIB = new Map()
const realLib = loadLib()
SOURCES_BY_LIB.set(realLib, SOURCES[LIB])
libSuite(realLib)
console.log(`PASS A  lib: flags, frames, focus target and user-navigation rules, Director's acknowledgements, amend state, resume text, rebuild steps (${checks} checks)`)

// ============================================================================================================================================
// B. The bar
// ============================================================================================================================================
const lucide = new Proxy({}, { get: (_t, name) => name === '__esModule' ? true : (props => React.createElement('svg', { 'data-icon': String(name), ...props })) })
function walk(node, found = []) {
  if (Array.isArray(node)) { for (const child of node) walk(child, found); return found }
  if (!node || typeof node !== 'object') return found
  found.push(node)
  if (node.props?.children !== undefined) walk(node.props.children, found)
  return found
}
function barSuite(lib, barText = SOURCES[BAR]) {
  const { FlowAmendBar } = evalModule(barText, BAR, {}, { react: React, 'react/jsx-runtime': require('react/jsx-runtime'), 'lucide-react': lucide, '@/lib/studio-flow-control': lib })
  const tag = (html, id) => (html.match(new RegExp(`<button[^>]*data-testid="${id}"[^>]*>`)) ?? [''])[0]
  const state = (over = {}) => lib.flowAmendState({ enabled: true, active: true, control: 'paused', rebuild: null, draft: '', instructionsEnabled: false, ...over })
  const calls = []
  const draw = (s) => FlowAmendBar({ state: s, onResume: () => calls.push('resume'), onRebuild: () => calls.push('rebuild') })
  eq(draw(state({ control: 'running' })), null, 'bar: nothing while hidden')
  eq(renderToStaticMarkup(React.createElement(FlowAmendBar, { state: state({ control: 'running' }), onResume() {}, onRebuild() {} })), '', 'bar: no markup while hidden')
  let html = renderToStaticMarkup(React.createElement(FlowAmendBar, { state: state(), onResume() {}, onRebuild() {} }))
  ok(html.includes('Paused — type changes, then Resume or Rebuild.') && html.includes('role="status"') && html.includes('aria-live="polite"'), 'bar: the paused line, announced politely')
  ok(html.includes('>Resume<') && html.includes('Rebuild with these instructions'), 'bar: both buttons')
  ok(tag(html, 'bn-flow-amend-rebuild').includes('disabled=""') && tag(html, 'bn-flow-amend-rebuild').includes('title="Type your changes first"'), 'bar: Rebuild is disabled with no text, and says why')
  ok(tag(html, 'bn-flow-amend-resume') !== '' && !tag(html, 'bn-flow-amend-resume').includes('disabled=""'), 'bar: Resume is enabled')
  html = renderToStaticMarkup(React.createElement(FlowAmendBar, { state: state({ draft: 'Shorter titles', instructionsEnabled: true }), onResume() {}, onRebuild() {} }))
  ok(html.includes('Resume with these changes') && tag(html, 'bn-flow-amend-rebuild') !== '' && !tag(html, 'bn-flow-amend-rebuild').includes('disabled=""') && !html.includes('Type your changes first'), 'bar: with text, Resume carries it and Rebuild is enabled')
  ok(!html.includes('bn-flow-amend-hint'), 'bar: no hint for a short text')
  html = renderToStaticMarkup(React.createElement(FlowAmendBar, { state: state({ draft: 'x'.repeat(1200), instructionsEnabled: true }), onResume() {}, onRebuild() {} }))
  ok(html.includes('bn-flow-amend-hint') && html.includes('Only the first 1000 characters are sent.'), 'bar: a long text says it is cut')
  html = renderToStaticMarkup(React.createElement(FlowAmendBar, { state: state({ control: 'resume_requested' }), onResume() {}, onRebuild() {} }))
  ok(html.includes('Resuming the build…') && !html.includes('<button'), 'bar: the line alone while a request is in flight')
  html = renderToStaticMarkup(React.createElement(FlowAmendBar, { state: state({ control: 'running', appliedTo: [3, 4, 5, 6] }), onResume() {}, onRebuild() {} }))
  ok(html.includes('Applied to slides 4–7.') && !html.includes('<button'), 'bar: the applied line')
  html = renderToStaticMarkup(React.createElement(FlowAmendBar, { state: state({ control: 'running', appliedTo: [], draft: 'Shorter titles' }), onResume() {}, onRebuild() {} }))
  ok(html.includes('use Rebuild to apply them') && html.includes('be applied to slides already in progress') && !html.includes('Applied to slides') && tag(html, 'bn-flow-amend-resume') === '' && tag(html, 'bn-flow-amend-rebuild') !== '' && !tag(html, 'bn-flow-amend-rebuild').includes('disabled=""'), 'bar: applied to none: the plain words, Rebuild ready, no Resume')
  html = renderToStaticMarkup(React.createElement(FlowAmendBar, { state: state({ rebuild: { text: 'x', buildId: 'b', stage: 'stopping', startedAt: 0, stoppedAt: null, sentAt: null } }), onResume() {}, onRebuild() {} }))
  ok(html.includes('Rebuilding once the last slide finishes…') && !html.includes('<button'), 'bar: rebuilding: the line, no buttons')
  const only = (over) => walk(draw({ ...state({ draft: 'abc' }), ...over })).filter(node => node.type === 'button').map(node => node.props['data-testid'])
  eq(only({ showResume: true, showRebuild: false }), ['bn-flow-amend-resume'], 'bar: Resume alone')
  eq(only({ showResume: false, showRebuild: true }), ['bn-flow-amend-rebuild'], 'bar: Rebuild alone')
  eq(only({ showResume: false, showRebuild: false }), [], 'bar: neither')
  const buttons = walk(draw(state({ draft: 'abc' }))).filter(node => node.type === 'button')
  eq(buttons.length, 2, 'bar: two buttons')
  buttons[0].props.onClick(); buttons[1].props.onClick()
  eq(calls.splice(0), ['resume', 'rebuild'], 'bar: Resume calls Resume, Rebuild calls Rebuild')
  ok(buttons.every(button => button.props.type === 'button'), 'bar: buttons never submit the composer')
}
barSuite(realLib)
console.log(`PASS B  bar: markup, disabled states, clicks (${checks} checks)`)

// ============================================================================================================================================
// C. The real hook in the offline React host
// ============================================================================================================================================
const PRES = 'pres-1'
async function makeWorld({ flags = ALL_ON, libText = SOURCES[LIB], hookText = SOURCES[HOOK], props = {} } = {}) {
  const processEnv = { ...flags }
  const env = createEnvironment({ processEnv })
  const listeners = []
  const document = {
    addEventListener(type, fn, capture) { listeners.push({ type, fn, capture }) },
    removeEventListener(type, fn) { const at = listeners.findIndex(l => l.type === type && l.fn === fn); if (at >= 0) listeners.splice(at, 1) },
    click(target) { for (const l of [...listeners]) if (l.type === 'click') l.fn({ target }) },
  }
  const scope = { process: { env: processEnv }, Date: env.globals.Date, setTimeout: env.clock.setTimeout, clearTimeout: env.clock.clearTimeout, document }
  const lib = evalModule(libText, LIB, { process: scope.process })
  const barModule = evalModule(SOURCES[BAR], BAR, {}, { react: React, 'react/jsx-runtime': require('react/jsx-runtime'), 'lucide-react': lucide, '@/lib/studio-flow-control': lib })
  const hookModule = evalModule(hookText, HOOK, scope, { react: React, '@/lib/studio-flow-control': lib, '@/components/build-narration/flow-amend-bar': barModule })
  const calls = { go: [], reveal: 0, control: [], mark: [], sent: [], drafts: [], stopAwait: 0, stopFailed: 0 }
  const p = {
    studioShell: true, overlay: false, revealStage: () => { calls.reveal++ }, displayedPresentationId: PRES, buildPresentationId: null,
    goToSlide: async index => { calls.go.push(index) }, viewerSafety: { presentationId: PRES, ready: true, busy: false, error: false },
    narrationEnabled: true, narration: { active: false, buildId: null, control: 'running', phase: 'idle' }, draft: '', setDraft: update => { calls.drafts.push(update) },
    // What the socket hook's sendBuildControl does with the bus: takes what the flow hook left for this one request (and nothing for any other).
    sendBuildControl: (...args) => { const text = lib.takeFlowInstructions(); calls.control.push(text ? [...args, text] : args); return `req-${calls.control.length}` },
    markControl: (...args) => { calls.mark.push(args) }, sendDraft: text => { calls.sent.push(text) },
    awaitingReply: false, stopAwaiting: () => { calls.stopAwait++ }, sessionKey: 'sess-1', onStopFailed: () => { calls.stopFailed++ },
    ...props,
  }
  let latest = null
  function Page() { latest = hookModule.useStudioFlowControl({ ...p }); return null }
  const rootNode = new Root()
  rootNode.setElement(React.createElement(Page))
  const settle = async () => { for (let quiet = 0, rounds = 0; quiet < 2; rounds++) { if (rounds > 80) throw new Error('did not settle'); await macrotask(); quiet = rootNode.flush() ? 0 : quiet + 1 } }
  await settle()
  const world = {
    env, lib, calls, bus: lib.flowBus, p, document, listeners, settle, latest: () => latest, pending: () => env.clock.pending(),
    set: async patch => { Object.assign(p, patch); rootNode.schedule(); await settle() },
    advance: async ms => { await env.clock.advance(ms, settle) },
    event: (frame) => lib.flowFocusEventFromFrame(frame),
    run: async frame => { lib.flowBus.focus(frame); await settle() },
    phase: async payload => { lib.flowBus.phase(payload); await settle() },
    unmount: () => rootNode.unmount(),
  }
  return world
}
let frameSeq = 0
const frame = (type, payload = {}, messageId = `m${++frameSeq}`) => ({ type, session_id: 's1', message_id: messageId, payload: { presentation_id: PRES, slide_index: 3, ...(type === 'deck_mutation' ? { mutation: 'slide_replaced', refresh_token: 'r' } : {}), ...payload } })
const FOCUS_ONLY = { [FLAG_FOCUS]: 'true' }
const building = (over = {}) => ({ active: true, buildId: 'b1', control: 'running', phase: 'building', ...over })
const paused = (over = {}) => building({ control: 'paused', phase: 'paused', ...over })

async function focusHookSuite(make) {
  // follows a deck_mutation, after the settle delay
  let w = await make({ flags: FOCUS_ONLY })
  eq(w.latest().bar, null, 'focus: no bar with the amend flag off')
  ok(typeof w.bus.focus === 'function', 'focus: the bus carries the focus runner with the flag on')
  eq(w.bus.phase, null, 'focus: ...and not the phase runner (amend flag off)')
  await w.run(frame('deck_mutation'))
  eq(w.calls.go, [], 'focus: not at once'); await w.advance(399); eq(w.calls.go, [], 'focus: not before 400 ms'); await w.advance(1); eq(w.calls.go, [3], 'focus: at 400 ms the stage goes to slide 4 (index 3)')
  eq(w.calls.reveal, 0, 'focus: a wide layout needs no stage change'); await w.advance(10000); eq(w.calls.go, [3], 'focus: once'); eq(w.pending(), 0, 'focus: no timer is left')
  // new_slide_index wins; slide 0
  w = await make({ flags: FOCUS_ONLY })
  await w.run(frame('deck_mutation', { mutation: 'slide_reordered', slide_index: 1, new_slide_index: 0 })); await w.advance(500); eq(w.calls.go, [0], 'focus: a moved slide: its new place, index 0 included')
  // overlay: the stage pane first, at once
  w = await make({ flags: FOCUS_ONLY, props: { overlay: true } })
  await w.run(frame('slide_ready', { slide_index: 2 })); eq([w.calls.reveal, w.calls.go], [1, []], 'focus: overlay: the stage is brought up at once'); await w.advance(400); eq(w.calls.go, [2], 'focus: ...then the slide')
  // another deck: nothing at all
  w = await make({ flags: FOCUS_ONLY, props: { overlay: true } })
  await w.run(frame('deck_mutation', { presentation_id: 'pres-other' })); await w.advance(10000); eq([w.calls.go, w.calls.reveal, w.pending()], [[], 0, 0], 'focus: another deck is ignored: no stage change, no navigation, no timer')
  // a deleted slide
  w = await make({ flags: FOCUS_ONLY }); await w.run(frame('deck_mutation', { mutation: 'slide_deleted' })); await w.advance(2000); eq(w.calls.go, [], 'focus: a deleted slide')
  // the deck this build is filling counts before the stage has swapped to it
  w = await make({ flags: FOCUS_ONLY, props: { displayedPresentationId: 'strawman-1', buildPresentationId: PRES, viewerSafety: { presentationId: 'strawman-1', ready: true, busy: false, error: false }, narration: building() } })
  await w.run(frame('slide_built', { slide_index: 0 })); await w.advance(1000); eq(w.calls.go, [], 'focus: the viewer still shows the strawman: no navigation in the wrong deck')
  await w.set({ displayedPresentationId: PRES, viewerSafety: { presentationId: PRES, ready: true, busy: false, error: false } }); eq(w.calls.go, [0], 'focus: once the viewer shows the filling deck, the first slide')
  // viewer readiness
  for (const [label, safety] of [['busy', { presentationId: PRES, ready: true, busy: true, error: false }], ['not ready', { presentationId: PRES, ready: false, busy: false, error: false }], ['in error', { presentationId: PRES, ready: true, busy: false, error: true }], ['another deck', { presentationId: 'x', ready: true, busy: false, error: false }], ['none', null]]) {
    w = await make({ flags: FOCUS_ONLY, props: { viewerSafety: safety } })
    await w.run(frame('deck_mutation')); await w.advance(3000); eq(w.calls.go, [], `focus: viewer ${label}: waits`)
    await w.set({ viewerSafety: { presentationId: PRES, ready: true, busy: false, error: false } }); eq(w.calls.go, [3], `focus: viewer ${label}: goes when it is ready`)
  }
  w = await make({ flags: FOCUS_ONLY, props: { viewerSafety: null } })
  await w.run(frame('deck_mutation')); await w.advance(5999); eq(w.calls.go, [], 'focus: never ready: still waiting at 5999 ms'); await w.advance(2); eq([w.calls.go, w.pending()], [[], 0], 'focus: never ready: given up at 6 s, nothing left running')
  w = await make({ flags: FOCUS_ONLY, props: { goToSlide: null } })
  await w.run(frame('deck_mutation')); await w.advance(2000); eq(w.calls.go, [], 'focus: no viewer API yet'); await w.set({ goToSlide: async i => { w.calls.go.push(i) } }); eq(w.calls.go, [3], 'focus: ...then the slide')
  w = await make({ flags: FOCUS_ONLY, props: { studioShell: false, viewerSafety: null } })
  await w.run(frame('deck_mutation')); await w.advance(400); eq(w.calls.go, [3], 'focus: outside the Studio shell there is no readiness to wait for')
  // the user took over
  w = await make({ flags: FOCUS_ONLY })
  w.latest().noteSlideChange(0); await w.advance(10000)
  w.latest().noteSlideChange(5)
  await w.advance(100); await w.run(frame('deck_mutation')); await w.advance(1000); eq(w.calls.go, [], 'focus: the user moved to slide 6 a moment ago: no yank')
  await w.advance(3000); await w.run(frame('deck_mutation')); await w.advance(400); eq(w.calls.go, [3], 'focus: after 4 s the stage follows again')
  // the user navigated between the event and the move
  w = await make({ flags: FOCUS_ONLY, props: { viewerSafety: null } })
  w.latest().noteSlideChange(0); await w.advance(10000)
  await w.run(frame('deck_mutation')); await w.advance(3000); w.latest().noteSlideChange(7); await w.set({ viewerSafety: { presentationId: PRES, ready: true, busy: false, error: false } }); await w.advance(3000); eq(w.calls.go, [], 'focus: a navigation after the event cancels the move')
  // our own move is not the user's
  w = await make({ flags: FOCUS_ONLY, props: { viewerSafety: null } })
  w.latest().noteSlideChange(0); await w.advance(10000)
  await w.run(frame('deck_mutation', { slide_index: 3 })); await w.advance(3000); await w.set({ viewerSafety: { presentationId: PRES, ready: true, busy: false, error: false } }); eq(w.calls.go, [3], 'focus: moved after the viewer settled')
  w.latest().noteSlideChange(3); await w.advance(200); await w.run(frame('deck_mutation', { slide_index: 4 })); await w.advance(400); eq(w.calls.go, [3, 4], 'focus: the viewer reporting our own move does not count as the user navigating')
  // pane switches count (a click on the switch)
  w = await make({ flags: FOCUS_ONLY })
  eq(w.listeners.map(l => [l.type, l.capture]), [['click', true]], 'focus: one capture-phase click listener')
  w.document.click({ closest: selector => (selector.includes('[data-studio-workspace-switch]') ? {} : null) })
  await w.run(frame('deck_mutation')); await w.advance(1000); eq(w.calls.go, [], 'focus: a click on the pane switch is navigation')
  w = await make({ flags: FOCUS_ONLY }); w.document.click({ closest: () => null })
  await w.run(frame('deck_mutation')); await w.advance(400); eq(w.calls.go, [3], 'focus: a click elsewhere is not')
  w = await make({ flags: FOCUS_ONLY }); w.document.click({ closest: selector => (selector.includes('[data-studio-inspector-switch]') ? {} : null) })
  await w.run(frame('deck_mutation')); await w.advance(400); eq(w.calls.go, [], 'focus: nor is a click on the inspector tabs')
  w.unmount(); eq([w.listeners.length, w.bus.focus, w.bus.phase], [0, null, null], 'focus: the listener and the bus runners go with the page')
  // a restored deck
  w = await make({ flags: FOCUS_ONLY, props: { overlay: true } })
  await w.run(frame('deck_mutation', { mutation: 'slide_replaced', restored: true, slide_index: 0 })); await w.advance(3000); eq([w.calls.reveal, w.calls.go], [1, []], 'focus: a restored deck opens the stage and goes nowhere')
  w = await make({ flags: FOCUS_ONLY }); await w.run(frame('deck_mutation', { mutation: 'deck_restored', slide_index: 0 })); await w.advance(3000); eq([w.calls.reveal, w.calls.go, w.pending()], [0, [], 0], 'focus: ...and on a wide layout does nothing')
  // change_recorded and slide_update
  w = await make({ flags: FOCUS_ONLY }); await w.run(frame('change_recorded', { slide_index: 6 })); await w.advance(400); eq(w.calls.go, [6], 'focus: change_recorded with a slide_index')
  w = await make({ flags: FOCUS_ONLY }); await w.run(frame('change_recorded', { slide_index: undefined })); await w.advance(2000); eq(w.calls.go, [], 'focus: change_recorded without one')
  w = await make({ flags: FOCUS_ONLY })
  await w.run({ type: 'slide_update', payload: { operation: 'partial_update', metadata: { preview_presentation_id: PRES }, slides: [{ slide_id: 'a', slide_number: 5 }], affected_slides: ['a'] } }); await w.advance(400); eq(w.calls.go, [4], 'focus: slide_update, 1-based on the wire')
  // a frame delivered twice is acted on once
  w = await make({ flags: FOCUS_ONLY })
  await w.run(frame('deck_mutation', { slide_index: 3 }, 'dup-1')); await w.advance(400); eq(w.calls.go, [3], 'dedupe: the first delivery')
  await w.advance(10000); await w.run(frame('deck_mutation', { slide_index: 3 }, 'dup-1')); await w.advance(1000); eq(w.calls.go, [3], 'dedupe: the same message id again (a replay) goes nowhere')
  await w.run(frame('deck_mutation', { slide_index: 3 }, 'dup-2')); await w.advance(400); eq(w.calls.go, [3, 3], 'dedupe: another message id is another frame')
  await w.run(frame('slide_built', { slide_index: 5 }, 'dup-1')); await w.advance(400); eq(w.calls.go, [3, 3, 5], 'dedupe: the same id on another kind of frame is not the same frame')
  for (let n = 0; n < 250; n++) await w.run(frame('deck_mutation', { presentation_id: 'other' }, `fill-${n}`))
  await w.advance(10000); await w.run(frame('deck_mutation', { slide_index: 3 }, 'dup-2')); await w.advance(400); eq(w.calls.go.length, 4, 'dedupe: the memory is bounded (an old id is forgotten)')
  // building: newest only, and the user takes the build over
  w = await make({ flags: FOCUS_ONLY, props: { narration: building() } })
  w.latest().noteSlideChange(0); await w.advance(10000)
  await w.run(frame('slide_built', { slide_index: 0 })); await w.advance(400); await w.run(frame('slide_built', { slide_index: 1 })); await w.advance(400); eq(w.calls.go, [0, 1], 'build: each newly built slide is followed')
  await w.run(frame('slide_built', { slide_index: 1 })); await w.run(frame('slide_built', { slide_index: 0 })); await w.advance(2000); eq(w.calls.go, [0, 1], 'build: a slide that is not newer is not')
  await w.advance(5000); w.latest().noteSlideChange(9); await w.advance(5000)
  await w.run(frame('slide_built', { slide_index: 2 })); await w.advance(2000); eq(w.calls.go, [0, 1], 'build: the user moved: the build is theirs now, however long ago')
  await w.set({ narration: building({ buildId: 'b2' }) }); await w.run(frame('slide_built', { slide_index: 0 })); await w.advance(400); eq(w.calls.go, [0, 1, 0], 'build: the next build is followed again')
  // the user moves before the first slide of a build is built
  w = await make({ flags: FOCUS_ONLY, props: { narration: building() } })
  w.latest().noteSlideChange(0); await w.advance(10000); w.latest().noteSlideChange(4); await w.advance(10000)
  await w.run(frame('slide_built', { slide_index: 0 })); await w.advance(2000); eq(w.calls.go, [], 'build: a user who already navigated during this build is not yanked by its first slide')
  // flag off
  w = await make({ flags: {} })
  eq([w.bus.focus, w.bus.phase, w.bus.instructions, w.listeners.length, w.pending()], [null, null, undefined, 0, 0], 'off: the bus is empty, no listener, no timer')
  w.latest().noteSlideChange(4); w.latest().resume(); w.latest().rebuild(); await w.advance(5000)
  eq([w.latest().amend.visible, w.calls.go, w.calls.control, w.calls.mark, w.calls.sent, w.calls.reveal, w.calls.stopAwait, w.pending()], [false, [], [], [], [], 0, 0, 0], 'off: nothing drawn, navigated, sent or timed even when called')
  w = await make({ flags: { [NARRATION]: 'true', [CONTROL]: 'true' }, props: { narration: paused(), awaitingReply: true, draft: 'text' } })
  eq([w.latest().amend.visible, w.calls.stopAwait, w.bus.phase], [false, 0, null], 'off: a paused build with both flags set but the amend flag off is untouched')
}

async function amendHookSuite(make) {
  const AMEND_ON = { [FLAG_AMEND]: 'true', [NARRATION]: 'true', [CONTROL]: 'true' }
  const AMEND_INSTR = { ...AMEND_ON, [FLAG_INSTR]: 'true' }
  // the paused composer and its line
  let w = await make({ flags: AMEND_ON, props: { narration: paused() } })
  ok(typeof w.bus.phase === 'function', 'amend: the bus carries the phase runner'); eq(w.bus.focus, null, 'amend: ...and not the focus runner (flag off)')
  eq([w.latest().amend.visible, w.latest().amend.key, w.latest().amend.canSend], [true, 'paused', true], 'amend: paused: the line, and the composer may send')
  eq(w.calls.stopAwait, 0, 'amend: nothing to unlock')
  ok(w.latest().bar && w.latest().bar.props.state === w.latest().amend && w.latest().bar.props.onResume === w.latest().resume && w.latest().bar.props.onRebuild === w.latest().rebuild, 'amend: the bar is the bar, handed the state, Resume and Rebuild (in that order)')
  await w.phase({ build_id: 'b1', phase: 'paused' }); eq(w.latest().amend.key, 'paused', 'amend: the ack of the pause itself is not a queued change')
  await w.set({ awaitingReply: true }); ok(w.calls.stopAwait >= 1, 'amend: paused with the reply gate shut: the gate is released (as Esc does)')
  w = await make({ flags: AMEND_ON, props: { narration: building(), awaitingReply: true } }); eq(w.calls.stopAwait, 0, 'amend: a running build keeps its reply gate')
  w = await make({ flags: AMEND_ON, props: { narration: paused({ control: 'pause_requested' }), awaitingReply: true } }); eq([w.latest().amend.key, w.calls.stopAwait], ['pause_requested', 0], 'amend: a pause in flight keeps its gate too')
  w = await make({ flags: AMEND_ON, props: { narration: paused({ control: 'stopped', phase: 'stopped' }), awaitingReply: true } }); eq([w.latest().amend.key], ['stopped']); ok(w.calls.stopAwait >= 1, 'amend: stopped: released')
  // templates and other builds the narration does not run
  w = await make({ flags: AMEND_ON, props: { narration: paused(), narrationEnabled: false, awaitingReply: true } }); eq([w.latest().amend.visible, w.calls.stopAwait], [false, 0], 'amend: narration off for this build (template reuse): untouched')
  w = await make({ flags: { [FLAG_AMEND]: 'true', [NARRATION]: 'true' }, props: { narration: paused() } }); eq([w.latest().amend.visible, w.bus.phase], [false, null], 'amend: without the build control flag: off')
  w = await make({ flags: AMEND_ON, props: { narration: { active: false, buildId: null, control: 'running', phase: 'idle' } } }); eq(w.latest().amend.visible, false, 'amend: no build, no bar')
  // resume
  w = await make({ flags: AMEND_ON, props: { narration: paused(), draft: ' Shorter titles ' } })
  w.latest().resume(); eq(w.calls.control, [['resume', 'b1']], 'resume: instructions flag off: a plain resume, whatever is typed'); eq(w.calls.mark, [['resume_requested', 'b1', 'req-1']], 'resume: the narration is told'); eq(w.calls.drafts, [], 'resume: the box is left alone')
  w = await make({ flags: AMEND_INSTR, props: { narration: paused(), draft: ' Shorter titles ' } })
  eq(w.latest().amend.resumeLabel, 'Resume with these changes', 'resume: the button says it takes the text')
  w.latest().resume(); eq(w.calls.control, [['resume', 'b1', 'Shorter titles']], 'resume: with the instructions flag, the typed text goes with it (the instructions sender)'); eq(w.calls.mark, [['resume_requested', 'b1', 'req-1']], 'resume: and the narration is told')
  eq([w.bus.instructions, w.lib.takeFlowInstructions()], [undefined, undefined], 'resume: nothing is left on the bus for the next request')
  eq(w.calls.drafts.length, 1, 'resume: the box is cleared...'); eq([w.calls.drafts[0](' Shorter titles '), w.calls.drafts[0]('something newer')], ['', 'something newer'], 'resume: ...unless the user has typed something else since')
  w = await make({ flags: AMEND_INSTR, props: { narration: paused(), draft: 'x'.repeat(1500) } }); w.latest().resume(); eq(w.calls.control[0][2].length, 1000, 'resume: cut to 1000 characters')
  w = await make({ flags: AMEND_INSTR, props: { narration: paused(), draft: '' } }); w.latest().resume(); eq(w.calls.control, [['resume', 'b1']], 'resume: nothing typed, nothing carried (the plain sender)'); eq(w.calls.drafts, [], 'resume: nothing to clear')
  w = await make({ flags: AMEND_INSTR, props: { narration: paused(), draft: 'abc', sendBuildControl: (...args) => { w.calls.control.push(args); return null } } })
  w.latest().resume(); eq([w.bus.instructions, w.calls.control], [undefined, [['resume', 'b1']]], 'resume: a sender that takes nothing (it did not leave) leaves nothing on the bus for the next request')
  w = await make({ flags: AMEND_INSTR, props: { narration: paused(), draft: 'abc', sendBuildControl: (...args) => { w.lib.takeFlowInstructions(); w.calls.control.push(args); return null } } })
  w.latest().resume(); eq([w.calls.mark, w.calls.drafts], [[], []], 'resume: a request that did not leave marks nothing and keeps the text')
  // rebuild: stop, settled, send
  w = await make({ flags: AMEND_ON, props: { narration: paused(), draft: '  Make it shorter  ' } })
  w.latest().rebuild(); await w.settle()
  eq(w.calls.control, [['stop', 'b1']], 'rebuild: a stop first'); eq(w.calls.mark, [['stop_requested', 'b1', 'req-1']], 'rebuild: the narration is told')
  await w.set({ narration: paused({ control: 'stop_requested' }) })
  eq([w.latest().amend.key, w.latest().amend.line, w.latest().amend.showRebuild, w.latest().amend.canSend], ['rebuilding', 'Rebuilding once the last slide finishes…', false, true], 'rebuild: the line says so, no buttons')
  await w.advance(5000); eq(w.calls.sent, [], 'rebuild: nothing is sent before Director says stopped')
  await w.set({ narration: paused({ control: 'stopped', phase: 'stopped' }) }); eq(w.calls.sent, [], 'rebuild: stopped is not settled')
  await w.advance(7900); eq(w.calls.sent, [], 'rebuild: 7.9 s after stopped: still waiting for settled')
  await w.advance(200); eq(w.calls.sent, ['Make it shorter'], 'rebuild: no settled in 8 s (Director flag off): the draft goes, trimmed, as an ordinary message')
  eq(w.latest().amend.line, 'Rebuilding with your changes…', 'rebuild: the line once it is sent'); await w.advance(5000); eq(w.calls.sent.length, 1, 'rebuild: once')
  await w.set({ narration: building({ buildId: 'b2', phase: 'planning' }) }); eq([w.latest().amend.visible, w.calls.sent.length], [false, 1], 'rebuild: the new build ends the line')
  await w.advance(60000); eq(w.pending(), 0, 'rebuild: nothing left running')
  // settled before the 8 s
  w = await make({ flags: AMEND_ON, props: { narration: paused(), draft: 'Make it shorter' } })
  w.latest().rebuild(); await w.set({ narration: paused({ control: 'stopped', phase: 'stopped' }) }); await w.advance(3000); eq(w.calls.sent, [], 'rebuild: waiting for settled')
  await w.phase({ build_id: 'b1', phase: 'settled' }); eq(w.calls.sent, ['Make it shorter'], 'rebuild: Director said settled: the draft goes at once')
  w = await make({ flags: AMEND_ON, props: { narration: paused(), draft: 'Make it shorter' } })
  w.latest().rebuild(); await w.phase({ build_id: 'b1', phase: 'settled' }); eq(w.calls.sent, [], 'rebuild: a settled before the stop is acknowledged does not send')
  await w.set({ narration: paused({ control: 'stopped', phase: 'stopped' }) }); eq(w.calls.sent, ['Make it shorter'], 'rebuild: ...but counts once it is')
  // the stop is not acknowledged
  w = await make({ flags: AMEND_ON, props: { narration: paused(), draft: 'abc' } })
  w.latest().rebuild(); await w.set({ narration: paused({ control: 'stop_requested' }) }); await w.advance(20000)
  await w.set({ narration: paused() }); eq([w.latest().amend.key, w.calls.sent], ['paused', []], 'rebuild: the stop timed out and the control fell back: no rebuild, the bar is the paused one again')
  // another build
  w = await make({ flags: AMEND_ON, props: { narration: paused(), draft: 'abc' } })
  w.latest().rebuild(); await w.set({ narration: paused({ control: 'stop_requested' }) }); await w.set({ narration: building({ buildId: 'b2' }) }); await w.advance(20000); eq([w.latest().amend.visible, w.calls.sent], [false, []], 'rebuild: another build starting cancels it')
  // already stopped
  w = await make({ flags: AMEND_ON, props: { narration: paused({ control: 'stopped', phase: 'stopped' }), draft: 'abc' } })
  w.latest().rebuild(); await w.settle(); eq(w.calls.control, [], 'rebuild: already stopped: no second stop'); eq(w.latest().amend.key, 'rebuilding', 'rebuild: already stopped: rebuilding')
  await w.advance(7900); eq(w.calls.sent, [], 'rebuild: already stopped, no settled seen: waits'); await w.advance(200); eq(w.calls.sent, ['abc'], 'rebuild: ...then sends')
  w = await make({ flags: AMEND_ON, props: { narration: paused({ control: 'stopped', phase: 'stopped' }), draft: 'abc' } })
  await w.phase({ build_id: 'b1', phase: 'settled' }); await w.advance(1000); w.latest().rebuild(); await w.settle(); eq(w.calls.sent, ['abc'], 'rebuild: already stopped AND already settled: sends at once')
  // nothing typed
  w = await make({ flags: AMEND_ON, props: { narration: paused(), draft: '   ' } }); w.latest().rebuild(); await w.settle(); eq([w.calls.control, w.calls.mark], [[], []], 'rebuild: nothing typed, nothing stopped')
  // the stop could not be sent
  w = await make({ flags: AMEND_ON, props: { narration: paused(), draft: 'abc', sendBuildControl: (...args) => { w.calls.control.push(args); return null } } })
  w.latest().rebuild(); await w.settle(); eq([w.calls.mark, w.calls.stopFailed, w.latest().amend.key], [[], 1, 'paused'], 'rebuild: a stop that did not leave is reported, nothing is pending, the text stays')
  // the reply gate at the moment of sending
  w = await make({ flags: AMEND_ON, props: { narration: paused({ control: 'stopped', phase: 'stopped' }), draft: 'abc' } })
  w.latest().rebuild(); await w.phase({ build_id: 'b1', phase: 'settled' }); eq(w.calls.sent, ['abc'], 'rebuild: baseline')
  w = await make({ flags: AMEND_ON, props: { narration: paused({ control: 'stopped', phase: 'stopped' }), draft: 'abc' } })
  w.latest().rebuild(); await w.set({ awaitingReply: true, stopAwaiting: () => { w.calls.stopAwait++ } }); await w.phase({ build_id: 'b1', phase: 'settled' })
  eq(w.calls.sent, [], 'rebuild: the reply gate is shut: not sent into it'); ok(w.calls.stopAwait >= 1, 'rebuild: it is released'); await w.set({ awaitingReply: false }); eq(w.calls.sent, ['abc'], 'rebuild: sent once it is open')
  // another session
  w = await make({ flags: AMEND_ON, props: { narration: paused(), draft: 'abc' } })
  w.latest().rebuild(); await w.set({ narration: paused({ control: 'stop_requested' }) }); eq(w.latest().amend.key, 'rebuilding', 'session: rebuilding')
  await w.set({ sessionKey: 'sess-2' }); eq(w.latest().amend.key, 'stopping', 'session: another session: the rebuild is gone (the line is what the narration says)')
  // steer and applied
  w = await make({ flags: AMEND_INSTR, props: { narration: paused() } })
  await w.phase({ build_id: 'b1', phase: 'paused', steer_pending: true }); eq([w.latest().amend.key, w.latest().amend.line, w.latest().amend.showResume, w.latest().amend.canSend], ['steer_queued', 'Changes queued for resume.', true, true], 'steer: changes queued for resume, buttons kept')
  await w.set({ narration: building({ control: 'resume_requested', phase: 'paused' }) }); await w.phase({ build_id: 'b1', phase: 'building', applied_to: [3, 4, 5, 6] })
  await w.set({ narration: building() }); eq([w.latest().amend.key, w.latest().amend.line], ['applied', 'Applied to slides 4–7.'], 'applied: Director says where the changes went')
  await w.advance(7900); eq(w.latest().amend.key, 'applied', 'applied: for 8 s'); await w.advance(200); eq([w.latest().amend.visible, w.pending()], [false, 0], 'applied: then it is gone, and nothing is left running')
  w = await make({ flags: AMEND_INSTR, props: { narration: paused() } })
  await w.phase({ build_id: 'b1', phase: 'paused', steer_pending: true }); await w.set({ sessionKey: 'sess-2' }); eq(w.latest().amend.key, 'paused', 'steer: another session starts clean')
  // applied_to [] : Slide Builder already holds the deck. The words are plain, the text comes back, Rebuild takes it
  const NOT_APPLIED = "These changes couldn't be applied to slides already in progress — use Rebuild to apply them."
  w = await make({ flags: AMEND_INSTR, props: { narration: paused(), draft: ' Shorter titles ' } })
  w.latest().resume(); eq(w.calls.control, [['resume', 'b1', 'Shorter titles']], 'none: the resume carried the text'); eq(w.calls.drafts.length, 1, 'none: and cleared the box')
  await w.set({ draft: '', narration: building({ control: 'resume_requested', phase: 'paused' }) }); await w.phase({ build_id: 'b1', phase: 'building', applied_to: [] }); await w.set({ narration: building() })
  eq([w.latest().amend.key, w.latest().amend.line, w.latest().amend.showRebuild, w.latest().amend.showResume], ['not_applied', NOT_APPLIED, true, false], 'none: Director applied it to no slide: it says so plainly (not "Applied")')
  eq(w.calls.drafts.length, 2, 'none: the text is put back'); eq([w.calls.drafts[1](''), w.calls.drafts[1]('something else'), w.calls.drafts[1]('  ')], ['Shorter titles', 'something else', 'Shorter titles'], 'none: ...in an empty box only, never over what the user has typed since')
  await w.set({ draft: 'Shorter titles' }); eq([w.latest().amend.rebuildEnabled, w.latest().amend.rebuildHint], [true, null], 'none: Rebuild is ready with it')
  await w.phase({ build_id: 'b1', phase: 'building', applied_to: [] }); eq(w.calls.drafts.length, 2, 'none: a repeated frame does not put it back again')
  await w.advance(19900); eq(w.latest().amend.key, 'not_applied', 'none: it stays 20 s: it asks the user to do something'); await w.advance(200); eq([w.latest().amend.visible, w.pending()], [false, 0], 'none: then it is gone, and nothing is left running')
  // ...and Rebuild from a running build is the same Rebuild: stop, settled, send
  w = await make({ flags: AMEND_INSTR, props: { narration: building(), draft: 'Shorter titles' } })
  await w.phase({ build_id: 'b1', phase: 'building', applied_to: [] }); eq(w.latest().amend.key, 'not_applied', 'none: (a running build)')
  w.latest().rebuild(); await w.settle(); eq([w.calls.control, w.calls.mark], [[['stop', 'b1']], [['stop_requested', 'b1', 'req-1']]], 'none: Rebuild stops the running build first')
  await w.set({ narration: building({ control: 'stopped', phase: 'stopped' }) }); await w.phase({ build_id: 'b1', phase: 'settled' }); eq(w.calls.sent, ['Shorter titles'], 'none: ...and the text goes once Director has settled')
  // applied to some slides: nothing to put back
  w = await make({ flags: AMEND_INSTR, props: { narration: paused(), draft: 'Shorter titles' } })
  w.latest().resume(); await w.set({ draft: '', narration: building() }); await w.phase({ build_id: 'b1', phase: 'building', applied_to: [4, 5] }); eq([w.latest().amend.key, w.calls.drafts.length], ['applied', 1], 'none: applied to some slides: the box stays as it was cleared')
  await w.phase({ build_id: 'b1', phase: 'building', applied_to: [] }); eq(w.calls.drafts.length, 1, 'none: a text that was taken is not restored by a later frame')
  // a resume that carried nothing never restores an older text
  w = await make({ flags: AMEND_INSTR, props: { narration: paused(), draft: 'Shorter titles' } })
  w.latest().resume(); await w.set({ draft: '', narration: paused() }); w.latest().resume(); await w.phase({ build_id: 'b1', phase: 'building', applied_to: [] }); eq(w.calls.drafts.length, 1, 'none: a later resume without text does not bring an older text back')
  // another session
  w = await make({ flags: AMEND_INSTR, props: { narration: paused(), draft: 'Shorter titles' } })
  w.latest().resume(); await w.set({ draft: '', sessionKey: 'sess-2', narration: building() }); await w.phase({ build_id: 'b9', phase: 'building', applied_to: [] }); eq(w.calls.drafts.length, 1, 'none: another session never gets the old text')
  // settled never reaches the narration (the page checks isFlowSettledPhase before forwarding); the runner takes every phase
  w = await make({ flags: AMEND_ON, props: { narration: paused() } }); await w.phase(null); await w.phase('x'); await w.phase({}); eq(w.latest().amend.key, 'paused', 'phase: junk is nothing')
}

const worldMaker = (texts = {}) => options => makeWorld({ ...texts, ...options })
await focusHookSuite(worldMaker())
await amendHookSuite(worldMaker())
console.log(`PASS C  hook: follow-the-build, the paused composer, Resume, Rebuild, steer, applied, flags off (${checks} checks)`)

// ============================================================================================================================================
// C2. The REAL socket hook in the chat harness: the build_phase tap (settled stops at the door, everything else carries on as before)
// ============================================================================================================================================
{
  const { runTranscript } = await import('./studio-chat-harness/transcript.mjs')
  const { PROFILES } = await import('./studio-chat-harness/profiles.mjs')
  const SESSION = 'synthetic-session-flow'
  const send = (id, payload) => ({ op: 'frame', frame: { message_id: id, session_id: SESSION, timestamp: '2026-10-05T12:00:01Z', type: 'build_phase', role: 'assistant', payload } })
  const fixture = { name: 'flow-control-build-phase', description: 'build_phase frames of a steered build', session: { id: SESSION, userId: 'synthetic-user-01' }, steps: [
    { op: 'ensureConnected' }, { op: 'open' },
    send('p1', { build_id: 'b1', phase: 'building', label: 'Building' }),
    send('p2', { build_id: 'b1', phase: 'paused', label: 'Paused', steer_pending: true }),
    send('p3', { build_id: 'b1', phase: 'stopped', label: 'Stopped' }),
    send('p4', { build_id: 'b1', phase: 'settled', label: 'Settled' }),
    send('p5', { build_id: 'b1', phase: 'building', label: 'Building', applied_to: [2, 3] }),
    { op: 'checkpoint', name: 'end' },
  ] }
  const run = async flags => {
    const out = await runTranscript({ root, fixture, profile: 'studio', processEnv: { ...PROFILES.studio, ...flags }, includeMarkup: false })
    eq(out.blockedNetwork, [], 'C2: no network')
    const calls = JSON.parse(out.files['calls.json'])
    return { phases: calls.filter(call => call.name === 'hook.onBuildPhase').map(call => call.args[0]), messages: calls.filter(call => call.name === 'hook.onMessage').map(call => call.args[0].message_id) }
  }
  const sentPayloads = fixture.steps.filter(step => step.op === 'frame').map(step => step.frame.payload)
  const off = await run({})
  eq(off.phases, sentPayloads, 'C2: flags off: every build_phase reaches the page, settled included, payloads as sent (exactly as before)')
  eq(off.messages, ['p1', 'p2', 'p3', 'p4', 'p5'], 'C2: flags off: ...and the message callback')
  const on = await run({ [FLAG_AMEND]: 'true', [NARRATION]: 'true', [CONTROL]: 'true' })
  eq(on.phases, sentPayloads.filter(payload => payload.phase !== 'settled'), 'C2: amend on: every build_phase but settled reaches the page, with steer_pending and applied_to untouched')
  eq(on.messages, ['p1', 'p2', 'p3', 'p5'], 'C2: amend on: a settled frame goes no further than the door (no message callback either)')
  eq((await run({ [FLAG_FOCUS]: 'true' })).phases, sentPayloads, 'C2: focus on alone: build_phase is untouched')
  eq((await run({ [FLAG_AMEND]: 'true' })).phases, sentPayloads, 'C2: amend flag without the narration and control flags: off')
  eq((await run({ [FLAG_INSTR]: 'true', [NARRATION]: 'true', [CONTROL]: 'true' })).phases, sentPayloads, 'C2: the instructions flag without the amend flag: off')
  console.log(`PASS C2 socket hook in the chat harness: settled stops at the door with the amend flags on; every other frame, and every frame with the flags off, is as before (${checks} checks)`)
}

// ============================================================================================================================================
// D. The page, the socket hook, the types, .env.example, the scope
// ============================================================================================================================================
const lines = text => text.split('\n')
const must = (text, needle, message) => ok(text.includes(needle), message)
function sourceSuite(sources, { git = true } = {}) {
  const page = sources[PAGE], ws = sources[WS], types = sources[TYPES], env = sources['.env.example']
  const lineOf = (text, needle) => { const found = lines(text).filter(line => line.includes(needle)); ok(found.length === 1, `exactly one line with: ${needle.slice(0, 70)} (${found.length})`); return found[0] }
  // page: nothing of the flow flags comes before the Builder's runners (an older proof slices the page by the positions of a parse that does not see these lines), and nothing is added to the socket hook's options
  const firstFlow = page.indexOf('FLOW-CONTROL')
  ok(firstFlow > page.indexOf('themeExportDirectiveRunnerRef.current = ') && firstFlow > page.indexOf('elementDirectiveRunnerRef.current = '), 'page: the first FLOW-CONTROL line is after the Builder\'s element and theme runners')
  ok(!page.includes('onFlowFocusFrame') && !page.includes('flowSocket') && !page.includes('flowFocusEventFromFrame'), 'page: the socket hook\'s options and callbacks (onSlideBuilt, onSlideComposeReady, onMessage, onBuildPhase) are untouched: the socket hook shows the frames to the flow hook')
  const importLine = lineOf(page, "import { useStudioFlowControl } from '@/hooks/use-studio-flow-control' // FLOW-CONTROL")
  ok(page.indexOf(importLine) > page.indexOf('function AuthenticatedBuilderContent(') && page.indexOf(importLine) < page.indexOf('function BuilderLoadingState('), 'page: imports the flow hook between the Builder content and the loading state (after the runners)')
  const callLine = lineOf(page, 'const flowControl = useStudioFlowControl({')
  ok(callLine.includes('// FLOW-CONTROL'), 'page: the hook call is marked')
  const call = page.slice(page.indexOf(callLine), page.indexOf('}) // FLOW-CONTROL', page.indexOf(callLine)))
  for (const piece of ['overlay: studioOverlayWorkspace', 'revealStage: revealStudioStage', 'displayedPresentationId: effectivePresentationId',
    'buildPresentationId: buildNarration.buildPresentationId', 'goToSlide: layoutServiceApis?.goToSlide', 'viewerSafety: studioViewerSafety', 'narrationEnabled: effectiveBuildNarrationEnabled && features.buildControlEnabled',
    'narration: buildNarration', 'draft: inputMessage', 'setDraft: setInputMessage', 'sendBuildControl, markControl: markNarrationControl', 'sendDraft: text => handleSendMessage(undefined, text)',
    'awaitingReply: awaitingDirectorReply', 'stopAwaiting: stopAwaitingReply']) ok(call.includes(piece), `page: the hook is handed ${piece}`)
  ok(!call.includes('socket') && !call.includes('Instructions'), 'page: ...and nothing about the socket or the instructions')
  ok(page.indexOf(callLine) > page.indexOf('const handleSendMessage = useCallback(') && page.indexOf(callLine) > page.indexOf('const [inputMessage'), 'page: the hook call is after the send it uses')
  const slideChange = lineOf(page, 'flowControl.noteSlideChange(nextVisualIndex) // FLOW-CONTROL')
  ok(page.indexOf(slideChange) > page.indexOf('const nextVisualIndex = Math.max(0, slideNum - 1)') && page.indexOf(slideChange) < page.indexOf('currentSlideIndexRef.current = nextVisualIndex'), 'page: the viewer\'s slide report reaches the hook first')
  const barLine = lineOf(page, '{flowControl.bar}')
  ok(barLine.trim().startsWith('{flowControl.bar}{/* FLOW-CONTROL') && page.indexOf(barLine) > page.indexOf('<DirectorPresence narration={buildNarration}') && page.indexOf(barLine) < page.indexOf('{workflowBrief && <div className="studio-brief-handoff"'), 'page: the bar (null with the amend flag off) sits between the presence line and the composer')
  // socket hook
  ok(ws.includes("import { STUDIO_FLOW_AMEND_ENABLED, STUDIO_FLOW_FOCUS_ENABLED, flowBus, isFlowFocusFrameType, isFlowSettledPhase, takeFlowInstructions } from '@/lib/studio-flow-control'; // FLOW-CONTROL"), 'ws: imports the flags, the bus and the three helpers')
  ok(!ws.includes('onFlowFocusFrame') && !ws.includes('sendBuildControlWithInstructions') && !ws.includes('buildControlInstructionsRef'), 'ws: no new option, no new sender, no ref: the bus carries it')
  const tap = lineOf(ws, 'flowBus.focus?.(parsedMessage); // FLOW-CONTROL')
  ok(tap.includes('STUDIO_FLOW_FOCUS_ENABLED &&') && tap.includes('isFlowFocusFrameType(parsedMessage.type)') && tap.includes('parsedMessage.session_id === socketSessionId') && tap.includes('isCurrentSocket()'), 'ws: the frame tap is gated, for the frames that name a slide, this socket\'s session and while this socket is current')
  const phaseTap = lineOf(ws, 'flowBus.phase?.(parsedMessage.payload)')
  ok(phaseTap.includes('if (STUDIO_FLOW_AMEND_ENABLED && parsedMessage.type === \'build_phase\') {') && phaseTap.includes('if (parsedMessage.session_id === socketSessionId && isCurrentSocket()) flowBus.phase?.(parsedMessage.payload);') && phaseTap.includes('if (isFlowSettledPhase(parsedMessage.payload)) return; } // FLOW-CONTROL'), 'ws: the build_phase tap is gated, shown to the flow hook for this socket\'s session, and a settled frame goes no further')
  for (const line of [tap, phaseTap]) ok(ws.indexOf(line) < ws.indexOf('routeStudioBulkEditUndoFrame(parsedMessage') && ws.indexOf(line) < ws.indexOf('normaliseDeckRestored(parsedMessage)') && ws.indexOf(line) < ws.indexOf("if (parsedMessage.type === 'deck_mutation') {") && ws.indexOf(line) < ws.indexOf('if (!isKnownDirectorMessageType(parsedMessage.type))'), 'ws: ...before the bulk-edit route that consumes change_recorded, the restore normaliser and the deck_mutation checks')
  eq(lines(ws).filter(line => line.includes('...(instructions ? { instructions } : {}), // FLOW-CONTROL')).length, 2, 'ws: instructions are spread only when there are some, into the HTTP body and the WS fallback')
  eq(lines(ws).filter(line => line.includes('control_token')).length, lines(sources.__base?.[WS] ?? ws).filter(line => line.includes('control_token')).length, 'ws: no token handling changed')
  const signature = lineOf(ws, 'const sendBuildControl = useCallback(')
  ok(!signature.includes('instructions') && !signature.includes('FLOW-CONTROL'), 'ws: sendBuildControl\'s own signature is not rewritten')
  const baseWs = sources.__base?.[WS]
  if (baseWs) ok(lines(baseWs).includes(signature), 'ws: ...it is the base\'s line')
  const take = lineOf(ws, 'const instructions = takeFlowInstructions(); // FLOW-CONTROL')
  ok(lines(ws)[lines(ws).indexOf(signature) + 1] === take && ws.indexOf(take) < ws.indexOf('const requestId = createBuildControlRequestId('), 'ws: the instructions are taken, once, as the first thing sendBuildControl does')
  // types
  ok(/steer_pending\?: boolean \| null; \/\/ FLOW-CONTROL/.test(types) && /applied_to\?: number\[\] \| null; \/\/ FLOW-CONTROL/.test(types) && /instructions\?: string; \/\/ FLOW-CONTROL/.test(types), 'types: the three optional fields')
  // env
  ok(env.endsWith(`\n${strip.FLOW_CONTROL_ENV_BLOCK}`) && strip.FLOW_CONTROL_ENV_BLOCK.endsWith('\n'), '.env.example: the block is the last thing in the file, after one blank line')
  for (const flag of strip.FLOW_CONTROL_FLAGS) eq(lines(env).filter(line => line === `${flag}="false"`).length, 1, `.env.example: ${flag} once, "false"`)
  ok(env.includes('# STUDIO FLOW FOCUS') && !/exact "true" enables it/.test(env.slice(env.indexOf('# STUDIO FLOW FOCUS'))), '.env.example: the block does not use that phrase')
  ok(lines(strip.FLOW_CONTROL_ENV_BLOCK).filter(line => line && !line.startsWith('#') && !/^NEXT_PUBLIC_STUDIO_FLOW_[A-Z_]+="false"$/.test(line)).length === 0, '.env.example: the block is comments and its three assignments')
}
const baseOk = (() => { try { execFileSync('git', ['-C', root, 'cat-file', '-e', `${strip.BASE_COMMIT}^{commit}`], { stdio: 'ignore' }); return true } catch { return false } })()
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 1 << 28 })
const TAUGHT = strip.FLOW_CONTROL_PIN_FILES
const baseSources = baseOk ? Object.fromEntries([...strip.FLOW_CONTROL_FILES, ...TAUGHT].map(rel => [rel, git('show', `${strip.BASE_COMMIT}:${rel}`)])) : null
sourceSuite({ ...SOURCES, __base: baseSources })
if (baseOk) {
  for (const rel of strip.FLOW_CONTROL_FILES) {
    ok(strip.stripFlowControl(rel, SOURCES[rel]) === baseSources[rel], `${rel}: without this change's lines it is the base's file, byte for byte`)
    ok(SOURCES[rel] !== baseSources[rel], `${rel}: it is changed`)
    const diff = git('diff', '--unified=0', strip.BASE_COMMIT, OWN, '--', rel).split('\n')
    const added = diff.filter(line => line.startsWith('+') && !line.startsWith('+++')), removed = diff.filter(line => line.startsWith('-') && !line.startsWith('---'))
    ok(added.every(line => strip.FLOW_CONTROL_MARKER_RE.test(line)), `${rel}: every added line carries the marker (${added.filter(line => !strip.FLOW_CONTROL_MARKER_RE.test(line)).length} do not)`)
    eq(removed, [], `${rel}: no existing line is rewritten or removed (pure insertions, so a later or earlier stacked change cannot be broken by this one)`)
  }
  // the older proofs taught to read through the registry: with the taught lines put back they are the base's files, byte for byte; each is one whole marked line for one whole line
  eq(TAUGHT, ['scripts/test-studio-speed-perceived.mjs'], 'taught: one older proof')
  for (const rel of TAUGHT) {
    const head = readOwn(rel), base = baseSources[rel]
    ok(strip.stripFlowControl(rel, head) === base, `${rel}: with the taught lines put back it is the base's file, byte for byte`)
    for (const [has, was] of strip.FLOW_CONTROL_EDITS[rel]) {
      eq(head.split(has).length - 1, 1, `${rel}: a taught line is there once`)
      ok(has.endsWith('\n') && has.split('\n').length === 2 && strip.FLOW_CONTROL_MARKER_RE.test(has) && has.includes('registry read (FLOW-CONTROL)') && was.endsWith('\n') && was.split('\n').length === 2, `${rel}: one whole marked line for one whole line`)
      ok(base.includes(was) && !strip.FLOW_CONTROL_MARKER_RE.test(was), `${rel}: the line it replaces is the base's`)
    }
    const [firstHas] = strip.FLOW_CONTROL_EDITS[rel][0]
    ok(strip.stripFlowControl(rel, head.replace(firstHas, () => `${firstHas}const unmarked = 1\n`)) !== base, `${rel}: an unmarked line added next to a taught one is not put back`)
    ok(strip.stripFlowControl(rel, head.replace('registry read (FLOW-CONTROL)', () => 'registry read')) !== base, `${rel}: a taught line that loses its mark is not put back`)
    const diff = git('diff', '--unified=0', strip.BASE_COMMIT, OWN, '--', rel).split('\n').filter(line => /^[-+]/.test(line) && !/^(---|\+\+\+)/.test(line))
    eq([diff.filter(line => line.startsWith('+')).length, diff.filter(line => line.startsWith('-')).length], [strip.FLOW_CONTROL_EDITS[rel].length, strip.FLOW_CONTROL_EDITS[rel].length], `${rel}: only the taught lines changed`)
  }
  const envDiff = git('diff', '--unified=0', strip.BASE_COMMIT, OWN, '--', '.env.example').split('\n').filter(line => /^[-+]/.test(line) && !/^(---|\+\+\+)/.test(line))
  ok(envDiff.length > 0 && envDiff.every(line => line.startsWith('+')), '.env.example: only lines added')
  eq(envDiff.map(line => line.slice(1)).join('\n') + '\n', '\n' + strip.FLOW_CONTROL_ENV_BLOCK, '.env.example: exactly the block, after one blank line')
  // The committed diff only: other suites write into docs/ and scripts/ while they run, so the working tree and untracked files are never read for scope.
  const changed = git('diff', '--name-only', `${strip.BASE_COMMIT}..${OWN}`).split('\n').filter(Boolean)
  const strays = changed.filter(rel => !strip.FLOW_CONTROL_SCOPE_FILES.has(rel))
  eq(strays, [], 'scope: every file of the committed diff is this change\'s')
  for (const rel of strip.FLOW_CONTROL_NEW_FILES) ok(fs.existsSync(path.join(root, rel)), `scope: ${rel} exists`)
  ok(strip.FLOW_CONTROL_FILES.every(rel => !strip.FLOW_CONTROL_NEW_FILES.includes(rel)), 'scope: marked and new files are different lists')
} else console.log(`NOTE D  git has no ${strip.BASE_COMMIT.slice(0, 8)}: the base-identity and scope checks were skipped`)
const registry = await import('./studio-later-changes.mjs')
ok(registry.LATER_STRIPS.includes(strip.stripFlowControl), 'registry: the strip is named'); ok(registry.LATER_ENV_BLOCKS.includes(strip.FLOW_CONTROL_ENV_BLOCK), 'registry: the block is named')
ok([...strip.FLOW_CONTROL_SCOPE_FILES].every(rel => registry.LATER_CHANGE_FILES.has(rel)), 'registry: every file is named')
ok(registry.stripLaterChanges(PAGE, SOURCES[PAGE]) === (baseSources ? registry.stripLaterChanges(PAGE, baseSources[PAGE]) : registry.stripLaterChanges(PAGE, SOURCES[PAGE])), 'registry: the page, read through it, is the base\'s (older proofs read it like that)')
ok(strip.stripFlowControl('lib/other.ts', 'x // FLOW-CONTROL\n') === 'x // FLOW-CONTROL\n', 'strip: a file that is not this change\'s comes back as it is')
ok(strip.stripFlowControl(PAGE, 'a\nb // FLOW-CONTROL-X\nc // X-FLOW-CONTROL\nd // FLOW-CONTROL\n') === 'a\nb // FLOW-CONTROL-X\nc // X-FLOW-CONTROL\n', 'strip: the marker is a whole token')
console.log(`PASS D  sources: marked lines, gates, base identity, .env.example, scope, registry (${checks} checks)`)

// ============================================================================================================================================
// E. Mutants: every one must be caught
// ============================================================================================================================================
const libMutants = [
  ['the socket hook shows slide_ready no more', "['deck_mutation', 'change_recorded', 'slide_built', 'slide_ready', 'slide_update']", "['deck_mutation', 'change_recorded', 'slide_built', 'slide_update']"],
  ['the socket hook shows build_event too', "['deck_mutation', 'change_recorded', 'slide_built', 'slide_ready', 'slide_update']", "['deck_mutation', 'change_recorded', 'slide_built', 'slide_ready', 'slide_update', 'build_event']"],
  ['taking the instructions leaves them on the bus', 'const text = flowBus.instructions\n  flowBus.instructions = undefined\n  return text', 'const text = flowBus.instructions\n  return text'],
  ['the message id is not read', "const messageId = cleanId(frame?.message_id)", "const messageId = null"],
  ['focus flag: anything but "false" turns it on', "return focus === 'true'", "return focus !== 'false'"],
  ['amend flag without the narration flag', "amend === 'true' && narration === 'true' && control === 'true'", "amend === 'true' && control === 'true'"],
  ['amend flag without the control flag', "amend === 'true' && narration === 'true' && control === 'true'", "amend === 'true' && narration === 'true'"],
  ['instructions flag without the amend flag', "instructions === 'true' && flowAmendFlagOn(amend, narration, control)", "instructions === 'true'"],
  ['new_slide_index: 0 is "absent"', 'event.newSlideIndex ?? event.slideIndex', 'event.newSlideIndex || event.slideIndex'],
  ['a deleted slide is followed', "if (event.kind === 'deck_mutation' && event.mutation === 'slide_deleted') return null\n", ''],
  ['a negative index is a slide', 'Number.isSafeInteger(value) && value >= 0', 'Number.isSafeInteger(value) && value >= -1'],
  ['a fraction is a slide', 'Number.isSafeInteger(value) && value >= 0', "value >= 0"],
  ['another deck is followed', 'const ours = presentationId === input.displayedPresentationId ||', 'const ours = true ||'],
  ['the deck being filled is not ours', '(input.alsoPresentationIds ?? []).includes(presentationId)', 'false'],
  ['the 4 s window is 4 s and a bit', 'input.now - state.lastUserNavAt < grace', 'input.now - state.lastUserNavAt <= grace'],
  ['the 4 s window is never', 'input.now - state.lastUserNavAt < grace', 'input.now - state.lastUserNavAt < 0'],
  ['the window is not a parameter', 'const grace = input.graceMs ?? FLOW_FOCUS_USER_NAV_GRACE_MS', 'const grace = FLOW_FOCUS_USER_NAV_GRACE_MS'],
  ['a restored deck on a wide layout goes somewhere', 'return input.overlay ? { index: null, selectStage: true } : null', 'return { index: null, selectStage: true }'],
  ['a restored deck does nothing on an overlay', 'return input.overlay ? { index: null, selectStage: true } : null', 'return null'],
  ['a restored deck goes to slide 1', 'return input.overlay ? { index: null, selectStage: true } : null', 'return input.overlay ? { index: 0, selectStage: true } : null'],
  ['a restored deck ignores the user', 'if (event.kind === \'deck_mutation\' && event.restored) return', 'if (false) return'],
  ['the stage pane is never brought up', 'return { index, selectStage: input.overlay }', 'return { index, selectStage: false }'],
  ['the stage pane is always brought up', 'return { index, selectStage: input.overlay }', 'return { index, selectStage: true }'],
  ['a taken-over build is followed', 'if (buildKey !== null && state.takenOverBuildKey === buildKey) return null\n', ''],
  ['an older built slide is followed', 'index <= state.newestBuiltIndex', 'index < state.newestBuiltIndex'],
  ['after a target the viewer is not settling', 'settleUntil: now + FLOW_FOCUS_EVENT_SETTLE_MS', 'settleUntil: state.settleUntil'],
  ['the newest built slide moves down', 'Math.max(next.newestBuiltIndex, index)', 'index'],
  ['a new build does not reset the count', 'if (buildKey !== next.buildKey) {', 'if (false) {'],
  ['the first report counts as the user', 'if (state.lastSeenIndex === null) return { ...state, lastSeenIndex: index } // the first report is where the viewer starts, not a move\n', ''],
  ['our own move counts as the user', 'if (state.selfIndex === index && now < state.selfUntil)', 'if (false)'],
  ['our own move is ours forever', 'now < state.selfUntil', 'true'],
  ['the viewer reloading counts as the user', 'if (now < state.settleUntil) return { ...state, lastSeenIndex: index }\n', ''],
  ['the same slide again counts', 'if (state.lastSeenIndex === index) return state\n', ''],
  ['a user move does not take the build over', 'takenOverBuildKey: buildKey ?? state.buildKey ?? state.takenOverBuildKey', 'takenOverBuildKey: state.takenOverBuildKey'],
  ['a user move takes over only a named build', 'takenOverBuildKey: buildKey ?? state.buildKey ?? state.takenOverBuildKey', 'takenOverBuildKey: buildKey ?? state.takenOverBuildKey'],
  ['a navigation after the event does not cancel it', 'state.lastUserNavAt >= pending.at', 'state.lastUserNavAt > pending.at'],
  ['a navigation after the event never cancels it', "if (state.lastUserNavAt !== null && state.lastUserNavAt >= pending.at) return { action: 'drop' }\n", ''],
  ['the wait for the viewer is forever', "if (waited >= maxWaitMs) return { action: 'drop' }\n", ''],
  ['the wait ends a millisecond late', 'waited >= maxWaitMs', 'waited > maxWaitMs'],
  ['no settle delay', 'if (waited < settleMs)', 'if (false)'],
  ['the settle delay is a millisecond too long', 'if (waited < settleMs)', 'if (waited <= settleMs)'],
  ['navigate without the viewer being ready', '!input.hasViewerApi || !input.viewerReady', '!input.hasViewerApi'],
  ['navigate without the viewer API', '!input.hasViewerApi || !input.viewerReady', '!input.viewerReady'],
  ['slide_update is 0-based', 'number - 1 : null', 'number : null'],
  ['a full slide_update is a focus event', "if (body.operation !== 'partial_update') return null", ''],
  ['slide_update takes the first slide', 'changed[changed.length - 1]', 'changed[0]'],
  ['slide_update takes all slides, not the affected', 'affected && affected.size > 0\n        ? slides.filter', 'false\n        ? slides.filter'],
  ['change_recorded without an index is an event', "if (!isSlideIndex(body.slide_index)) return null\n      return { kind: 'change_recorded'", "return { kind: 'change_recorded'"],
  ['a raw deck_restored is not restored', "body.restored === true || body.mutation === 'deck_restored'", 'body.restored === true'],
  ['a bad new_slide_index falls back to slide_index', ': Number.NaN,', ': null,'],
  ['build_event is a focus event', "    case 'change_recorded': {", "    case 'build_event': case 'change_recorded': {"],
  ['settled is not stamped', "if (phase === 'settled') return { ...next, settledAt: now }", "if (phase === 'settled') return { ...next, settledAt: null }"],
  ['a plain paused frame is a steer', 'payload.steer_pending === true ? { ...next, steerPending: true } : next', '{ ...next, steerPending: true }'],
  ['a repeated paused frame drops the steer', 'payload.steer_pending === true ? { ...next, steerPending: true } : next', '{ ...next, steerPending: payload.steer_pending === true }'],
  ['building does not end the steer', '{ ...next, steerPending: false, appliedTo: applied, appliedAt: applied !== null ? now : null }', '{ ...next, appliedTo: applied, appliedAt: applied !== null ? now : null }'],
  ['another phase does not end the steer', "if (typeof phase === 'string' && next.steerPending) return { ...next, steerPending: false }\n", ''],
  ['a new build does not reset the signals', 'if (buildId && signals.buildId !== buildId) next = { ...initialFlowSignals(), buildId }', 'if (buildId && signals.buildId !== buildId) next = { ...next, buildId }'],
  ['applied_to is taken as it comes', 'if (!indexes.length || indexes.length !== value.length) return null', 'if (!indexes.length) return null'],
  ['applied_to is not sorted', 'Array.from(new Set(indexes)).sort((a, b) => a - b)', 'Array.from(new Set(indexes))'],
  ['applied_to is not de-duplicated', 'Array.from(new Set(indexes)).sort((a, b) => a - b)', 'indexes.sort((a, b) => a - b)'],
  ['the applied label is 0-based', '.map(index => index + 1)', '.map(index => index)'],
  ['the applied range is always a list', 'const contiguous = numbers.every((n, i) => i === 0 || n === numbers[i - 1] + 1)', 'const contiguous = false'],
  ['a gap is called a range', 'const contiguous = numbers.every((n, i) => i === 0 || n === numbers[i - 1] + 1)', 'const contiguous = true'],
  ['the paused line changes', "paused: 'Paused — type changes, then Resume or Rebuild.'", "paused: 'Paused.'"],
  ['an empty applied_to is not said', 'if (value.length === 0) return [] // "applied to none": said plainly, not the same as not saying', 'if (value.length === 0) return null'],
  ['an empty applied_to is stamped as nothing', 'appliedAt: applied !== null ? now : null', 'appliedAt: applied && applied.length ? now : null'],
  ['applied to none reads "Applied"', "key = input.appliedTo!.length === 0 ? 'not_applied' : 'applied'", "key = 'applied'"],
  ['applied to none has no Rebuild', "const canRebuild = halted || key === 'not_applied'", 'const canRebuild = halted'],
  ['applied to none offers Resume', 'showResume: halted,', "showResume: halted || key === 'not_applied',"],
  ['applied to none has no words', 'if (!appliedTo.length) return FLOW_NOT_APPLIED_LINE\n', 'if (!appliedTo.length) return null\n'],
  ['the words of applied to none change', "These changes couldn't be applied to slides already in progress — use Rebuild to apply them.", 'These changes could not be applied.'],
  ['applied to none leaves after 8 s', 'return appliedTo && appliedTo.length === 0 ? FLOW_NOT_APPLIED_HOLD_MS : FLOW_APPLIED_HOLD_MS', 'return FLOW_APPLIED_HOLD_MS'],
  ['the bar shows with the flag off', 'if (!input.enabled || !input.active) return HIDDEN', 'if (!input.active) return HIDDEN'],
  ['the bar shows with no build', 'if (!input.enabled || !input.active) return HIDDEN', 'if (!input.enabled) return HIDDEN'],
  ['the rebuild line wins over nothing', "if (input.rebuild) key = 'rebuilding'", "if (false) key = 'rebuilding'"],
  ['a queued steer is not shown', "key = input.steerPending ? 'steer_queued' : 'paused'", "key = 'paused'"],
  ['the composer is locked while paused', 'canSend: halted || key === \'rebuilding\'', 'canSend: key === \'rebuilding\''],
  ['the composer is open while pausing', 'canSend: halted || key === \'rebuilding\'', 'canSend: true'],
  ['the composer is locked while rebuilding', 'canSend: halted || key === \'rebuilding\'', 'canSend: halted'],
  ['the buttons show while a request is in flight', 'showResume: halted,', 'showResume: true,'],
  ['Rebuild is enabled with no text', 'rebuildEnabled: canRebuild && hasDraft,', 'rebuildEnabled: canRebuild,'],
  ['Rebuild has no hint', 'rebuildHint: canRebuild && !hasDraft ? FLOW_AMEND_REBUILD_NEEDS_TEXT : null,', 'rebuildHint: null,'],
  ['Resume always says "with these changes"', 'resumeLabel: withChanges ?', 'resumeLabel: hasDraft ?'],
  ['the truncation hint is missing', "codePointLength(draft) > FLOW_AMEND_INSTRUCTIONS_MAX ? FLOW_AMEND_INSTRUCTIONS_TRUNCATED_HINT : null", 'null'],
  ['the truncation hint counts UTF-16 units', 'for (const _ of text) count++', 'count = text.length'],
  ['resume carries text with the flag off', 'if (!input.instructionsEnabled) return undefined\n  const text', 'const text'],
  ['resume carries blank text', 'if (!text) return undefined', 'if (false) return undefined'],
  ['resume text is not cut', 'return characters.length > FLOW_AMEND_INSTRUCTIONS_MAX ? characters.slice(0, FLOW_AMEND_INSTRUCTIONS_MAX).join(\'\') : text', 'return text'],
  ['resume text is cut by UTF-16 unit', 'const characters = Array.from(text)', "const characters = text.split('')"],
  ['resume text is cut at 1001', 'characters.length > FLOW_AMEND_INSTRUCTIONS_MAX ?', 'characters.length > FLOW_AMEND_INSTRUCTIONS_MAX + 1 ?'],
  ['stopped sends before settled', "if (stopped) return settled ? 'send' : 'stopped'", "if (stopped) return 'send'"],
  ['a stale settled counts', 'input.settledAt >= rebuild.startedAt', 'true'],
  ['any settled counts', 'const settled = input.settledAt !== null && input.settledAt !== undefined && input.settledAt >= rebuild.startedAt', 'const settled = input.settledAt != null'],
  ['no settled, no send', "rebuild.stoppedAt !== null && input.now - rebuild.stoppedAt >= FLOW_REBUILD_SETTLE_WAIT_MS ? 'send' : 'wait'", "'wait'"],
  ['the settled wait is a millisecond too long', 'input.now - rebuild.stoppedAt >= FLOW_REBUILD_SETTLE_WAIT_MS', 'input.now - rebuild.stoppedAt > FLOW_REBUILD_SETTLE_WAIT_MS'],
  ['the settled wait is 80 ms', 'export const FLOW_REBUILD_SETTLE_WAIT_MS = 8000', 'export const FLOW_REBUILD_SETTLE_WAIT_MS = 80'],
  ['another build does not cancel a rebuild', "return rebuild.stage === 'sent' ? 'done' : 'cancel'", "return 'wait'"],
  ['a failed stop waits forever', "return input.now - rebuild.startedAt < FLOW_REBUILD_STOP_GRACE_MS ? 'wait' : 'cancel'", "return 'wait'"],
  ['a failed stop cancels at once', "return input.now - rebuild.startedAt < FLOW_REBUILD_STOP_GRACE_MS ? 'wait' : 'cancel'", "return 'cancel'"],
  ['a finished build does not cancel', "if (input.phase === 'complete' || input.phase === 'error' || input.phase === 'idle') return 'cancel'\n", ''],
  ['a resumed build still rebuilds', "    if (!stopped) return 'cancel'\n", ''],
  ['the sent line never ends', "if (rebuild.sentAt !== null && input.now - rebuild.sentAt >= FLOW_REBUILD_SENT_HOLD_MS) return 'done'\n", ''],
  ['the sent line ends when the new build shows', "    if (!stopped) return 'done'\n", ''],
  ['the wake time is wrong', '(rebuild.stoppedAt ?? now) + FLOW_REBUILD_SETTLE_WAIT_MS', '(rebuild.stoppedAt ?? now) + FLOW_REBUILD_SENT_HOLD_MS'],
]
const barMutants = [
  ['the bar draws while hidden', 'if (!state.visible) return null\n', ''],
  ['Rebuild is never disabled', 'disabled={!state.rebuildEnabled}', 'disabled={false}'],
  ['Resume is always disabled', 'disabled={!state.resumeEnabled}', 'disabled={true}'],
  ['the buttons always show', '{state.showResume && (', '{true && ('],
  ['Resume calls Rebuild', 'onClick={onResume}', 'onClick={onRebuild}'],
  ['Rebuild calls Resume', 'onClick={onRebuild}', 'onClick={onResume}'],
  ['no hint for a long text', '{state.resumeHint ? (', '{false ? ('],
  ['the line is not announced', 'role="status" aria-live="polite" ', ''],
  ['Rebuild does not say why it waits', 'title={state.rebuildHint ?? undefined}', ''],
  ['a button submits the composer', 'type="button"\n              onClick={onRebuild}', 'onClick={onRebuild}'],
]
const hookMutants = [
  ['the stage pane is not brought up', 'if (target.selectStage) current.revealStage()', ''],
  ['a build slide has no build key', "const event = frameEvent.kind === 'slide_built' ? { ...frameEvent, buildKey: buildKey() } : frameEvent", 'const event = frameEvent'],
  ['the filling deck is not ours', 'alsoPresentationIds: [current.buildPresentationId],', 'alsoPresentationIds: [],'],
  ['navigate in the wrong deck', 'safety.presentationId === pending.presentationId', 'true'],
  ['navigate while the viewer is busy', 'safety.ready && !safety.busy && !safety.error &&', 'safety.ready &&'],
  ['our own move is not marked', 'focusStateRef.current = flowFocusMarkSelf(focusStateRef.current, pending.index, Date.now())', ''],
  ['a restored deck navigates to nothing', 'if (target.index !== null && event.presentationId) setPending', 'if (event.presentationId) setPending'],
  ['the viewer is waited for only in the shell', 'const viewerReady = !current.studioShell\n', 'const viewerReady = false\n'],
  ['the pane switch is not navigation', "'[data-studio-workspace-switch], [data-studio-inspector-switch]'", "'.nothing'"],
  ['the focus runner is on the bus with the flag off', 'flowBus.focus = !STUDIO_FLOW_FOCUS_ENABLED ? null : frame', 'flowBus.focus = frame'],
  ['the phase runner is on the bus with the flag off', 'flowBus.phase = !STUDIO_FLOW_AMEND_ENABLED ? null : payload', 'flowBus.phase = payload'],
  ['the bus keeps the runners after the page', 'useEffect(() => () => { flowBus.focus = null; flowBus.phase = null; flowBus.instructions = undefined }, [])', ''],
  ['resume hands over no instructions', '    flowBus.instructions = instructions // taken, once, by the sendBuildControl call below\n', ''],
  ['resume leaves its instructions on the bus', '    flowBus.instructions = undefined\n', ''],
  ['a delivered-twice frame is acted on twice', "if (seenFramesRef.current.includes(key)) return", "if (false) return"],
  ['the frames seen are never remembered', "seenFramesRef.current = [...seenFramesRef.current, key].slice(-SEEN_FRAMES_MAX)", ""],
  ['the frames seen are all remembered', "slice(-SEEN_FRAMES_MAX)", "slice(-100000)"],
  ['the frame kind is not part of the key', "const key = `${frameEvent.kind}:${frameEvent.messageId}`", "const key = `${frameEvent.messageId}`"],
  ['no click listener', "document.addEventListener('click', onClick, true)", ''],
  ['the listener is never removed', "return () => document.removeEventListener('click', onClick, true)", ''],
  ['the listener is added with the flag off', "if (!STUDIO_FLOW_FOCUS_ENABLED || typeof document === 'undefined') return\n    const onClick", "if (typeof document === 'undefined') return\n    const onClick"],
  ['the user move does not name the build', 'focusStateRef.current = flowFocusNoteSlideChange(focusStateRef.current, index, Date.now(), buildKey())', 'focusStateRef.current = flowFocusNoteSlideChange(focusStateRef.current, index, Date.now())'],
  ['the pending move has no timer', 'const timer = setTimeout(() => setFocusTick(tick => tick + 1), step.retryInMs)', 'const timer = 0'],
  ['the gate is released on a running build', 'if (amend.canSend && input.awaitingReply) input.stopAwaiting()', 'if (input.awaitingReply) input.stopAwaiting()'],
  ['the gate is never released', 'if (amend.canSend && input.awaitingReply) input.stopAwaiting()', ''],
  ['resume does not tell the narration', "current.markControl('resume_requested', buildId, requestId)", ''],
  ['resume clears whatever is typed', "current.setDraft(value => (value === draft ? '' : value))", "current.setDraft(() => '')"],
  ['resume keeps the text Director has', "      current.setDraft(value => (value === draft ? '' : value))\n", ''],
  ['resume marks a request that did not leave', 'if (!requestId) return\n    current.markControl', 'current.markControl'],
  ['rebuild does not stop first', "const requestId = current.sendBuildControl('stop', buildId ?? undefined)", "const requestId = 'req-x'"],
  ['rebuild does not tell the narration', "current.markControl('stop_requested', buildId, requestId)", ''],
  ['a failed stop is silent', "if (!requestId) { current.onStopFailed(); return }", "if (!requestId) { return }"],
  ['a failed stop still rebuilds', "if (!requestId) { current.onStopFailed(); return }", "if (!requestId) { current.onStopFailed() }"],
  ['rebuild with no text', "if (!text || !amendOn) return", "if (!amendOn) return"],
  ['rebuild sends the untrimmed draft', 'const text = current.draft.trim()', 'const text = current.draft'],
  ['an earlier settled is forgotten', 'startedAt: signals.settledAt ?? now', 'startedAt: now'],
  ['rebuild stops what is already stopped', "if (current.narration.control === 'stopped' || current.narration.phase === 'stopped') {", 'if (false) {'],
  ['the draft goes into a shut reply gate', 'if (input.awaitingReply) { input.stopAwaiting(); return }\n', ''],
  ['the draft is sent as something else', 'void latestRef.current.sendDraft(rebuildState.text)', 'void latestRef.current.sendDraft(input.draft)'],
  ['the rebuild never reaches "sent"', "setRebuildState(previous => previous ? { ...previous, stage: 'sent', sentAt: now } : previous)", ''],
  ['the stopped stage is skipped', "setRebuildState(previous => previous && previous.stage === 'stopping' ? { ...previous, stage: 'awaiting_settled', stoppedAt: now } : previous)", ''],
  ['a cancelled rebuild stays', "if (step === 'cancel' || step === 'done') { setRebuildState(null); return }", "if (step === 'cancel' || step === 'done') { return }"],
  ['another session keeps the rebuild', '    setRebuildState(null)\n    setSignals(INITIAL_SIGNALS)', '    setSignals(INITIAL_SIGNALS)'],
  ['another session keeps the signals', '    setRebuildState(null)\n    setSignals(INITIAL_SIGNALS)', '    setRebuildState(null)'],
  ['applied stays up', 'Math.max(0, signals.appliedAt + flowAppliedHoldMs(signals.appliedTo) - Date.now())', '1e12'],
  ['the rebuild has no timer', 'const timer = setTimeout(() => setAmendTick(tick => tick + 1), wake)', 'const timer = 0'],
  ['the text is not put back', 'if (signals.appliedTo.length === 0 && text) latestRef.current.setDraft', 'if (false) latestRef.current.setDraft'],
  ['the text overwrites what was typed', '(value.trim() ? value : text)', 'text'],
  ['applied to some slides puts the text back', 'if (signals.appliedTo.length === 0 && text)', 'if (text)'],
  ['the text is put back again by a repeated frame', '    const text = resumedWithRef.current\n    resumedWithRef.current = null\n', '    const text = resumedWithRef.current\n'],
  ['a resume forgets nothing', '    resumedWithRef.current = null\n    flowBus.instructions = instructions', '    flowBus.instructions = instructions'],
  ['another session keeps the text', '    resumedWithRef.current = null\n    setRebuildState(null)', '    setRebuildState(null)'],
  ['applied to none leaves after 8 s (hook)', 'signals.appliedAt + flowAppliedHoldMs(signals.appliedTo) - Date.now()', 'signals.appliedAt + 8000 - Date.now()'],
  ['the bar is drawn with the amend flag off', 'const bar = STUDIO_FLOW_AMEND_ENABLED ? createElement(', 'const bar = true ? createElement('],
  ['the bar is wired to the wrong handlers', 'onResume: resume, onRebuild: rebuild', 'onResume: rebuild, onRebuild: resume'],
  ['the idle bar is returned for the flags on', 'if (!STUDIO_FLOW_FOCUS_ENABLED && !amendOn) return IDLE', 'if (false) return IDLE'],
  ['the idle bar is not idle', 'resume: () => {},', 'resume: () => { throw new Error("idle resume") },'],
]
const sourceMutants = [
  ['page: the viewer report does not reach the hook', 'flowControl.noteSlideChange(nextVisualIndex) // FLOW-CONTROL', '// FLOW-CONTROL', PAGE],
  ['page: the amend hook runs for template builds', 'narrationEnabled: effectiveBuildNarrationEnabled && features.buildControlEnabled', 'narrationEnabled: true', PAGE],
  ['page: the draft goes out as typed', 'sendDraft: text => handleSendMessage(undefined, text)', 'sendDraft: () => handleSendMessage()', PAGE],
  ['ws: the tap is not gated', 'if (STUDIO_FLOW_FOCUS_ENABLED && isFlowFocusFrameType(parsedMessage.type)', 'if (isFlowFocusFrameType(parsedMessage.type)', WS],
  ['ws: the focus tap reaches the page with the bus empty', 'flowBus.focus?.(parsedMessage); // FLOW-CONTROL', 'flowBus.phase?.(parsedMessage); // FLOW-CONTROL', WS],
  ['ws: the phase tap is not gated', "if (STUDIO_FLOW_AMEND_ENABLED && parsedMessage.type === 'build_phase') {", "if (parsedMessage.type === 'build_phase') {", WS],
  ['ws: settled reaches the narration', 'if (isFlowSettledPhase(parsedMessage.payload)) return; } // FLOW-CONTROL', '} // FLOW-CONTROL', WS],
  ['ws: the flow hook does not see the phase', 'flowBus.phase?.(parsedMessage.payload); if (isFlowSettledPhase', 'if (isFlowSettledPhase', WS],
  ['ws: the phase goes to another session\'s flow hook', 'if (parsedMessage.session_id === socketSessionId && isCurrentSocket()) flowBus.phase?.', 'if (isCurrentSocket()) flowBus.phase?.', WS],
  ['ws: the focus tap comes after the bulk-edit route', "flowBus.focus?.(parsedMessage); // FLOW-CONTROL\n", "// FLOW-CONTROL\n", WS],
  ['ws: the instructions are taken late', 'const instructions = takeFlowInstructions(); // FLOW-CONTROL', 'const instructions = undefined; // FLOW-CONTROL', WS],
  ['page: a flow line before the Builder\'s runners', "// Force dynamic rendering to prevent build-time errors\n", "// FLOW-CONTROL\n// Force dynamic rendering to prevent build-time errors\n", PAGE],
  ['page: the import moves to the top', "import { useStudioFlowControl } from '@/hooks/use-studio-flow-control' // FLOW-CONTROL\n", "", PAGE],
  ['page: an added line has no marker', "  }) // FLOW-CONTROL\n", "  })\n", PAGE],
  ['ws: the tap shows every frame', 'isFlowFocusFrameType(parsedMessage.type) && parsedMessage.session_id === socketSessionId', 'parsedMessage.session_id === socketSessionId', WS],
  ['ws: instructions in the HTTP body only', '      ...(instructions ? { instructions } : {}), // FLOW-CONTROL\n      request_id: requestId,', '      request_id: requestId,', WS],
  ['ws: instructions always sent', '            ...(instructions ? { instructions } : {}), // FLOW-CONTROL', '            instructions, // FLOW-CONTROL', WS],
  ['ws: sendBuildControl\'s signature is rewritten', "const sendBuildControl = useCallback((action: BuildControlData['action'], buildId?: string): string | null => {", "const sendBuildControl = useCallback((action: BuildControlData['action'], buildId?: string, extra?: string): string | null => {", WS],
  ['types: the instructions field is gone', 'instructions?: string; // FLOW-CONTROL', '', TYPES],
  ['env: the flag is on', 'NEXT_PUBLIC_STUDIO_FLOW_FOCUS="false"', 'NEXT_PUBLIC_STUDIO_FLOW_FOCUS="true"', '.env.example'],
  ['env: the phrase', '# STUDIO FLOW AMEND (FRONTEND-1; P3-1 D). On only for the string "true"', '# STUDIO FLOW AMEND (FRONTEND-1; P3-1 D). On only for the exact "true" enables it', '.env.example'],
]
const COMPILED_LABELS = { lib: LIB, bar: BAR, hook: HOOK }
function mutate(text, [name, from, to], label) {
  const at = text.indexOf(from)
  ok(at >= 0, `mutant "${name}" no longer matches the ${label} source`)
  const out = text.slice(0, at) + to + text.slice(at + from.length)
  ok(out !== text, `mutant "${name}" changes the ${label} source`)
  if (COMPILED_LABELS[label]) compile(out, COMPILED_LABELS[label]) // a mutant that is not even valid code proves nothing: fail loudly
  return out
}
const survivors = [], crashes = []
let stripMutantCount = 0
const afterMutants = checks
const caughtAsync = async (name, run) => { try { await run() } catch (error) { if (error?.name !== 'AssertionError') crashes.push(`${name}: ${String(error?.message).slice(0, 60)}`); return } survivors.push(name) }
let mutantCount = 0
const savedChecks = () => checks
for (const mutant of libMutants) {
  mutantCount++
  const text = mutate(SOURCES[LIB], mutant, 'lib')
  const lib = loadLib(text)
  SOURCES_BY_LIB.set(lib, text)
  const before = savedChecks()
  let failed = false
  const note = (error) => { failed = true; if (error?.name !== 'AssertionError') crashes.push(`lib: ${mutant[0]}: ${String(error?.message).slice(0, 60)}`) }
  try { libSuite(lib) } catch (error) { note(error) }
  if (!failed) { try { barSuite(lib); await focusHookSuite(worldMaker({ libText: text })); await amendHookSuite(worldMaker({ libText: text })) } catch (error) { note(error) } }
  if (!failed) survivors.push(`lib: ${mutant[0]}`)
  checks = before
}
for (const mutant of barMutants) { mutantCount++; const text = mutate(SOURCES[BAR], mutant, 'bar'); await caughtAsync(`bar: ${mutant[0]}`, () => barSuite(realLib, text)) }
for (const mutant of hookMutants) {
  mutantCount++
  const text = mutate(SOURCES[HOOK], mutant, 'hook')
  await caughtAsync(`hook: ${mutant[0]}`, async () => { await focusHookSuite(worldMaker({ hookText: text })); await amendHookSuite(worldMaker({ hookText: text })) })
}
for (const [name, from, to, rel] of sourceMutants) {
  mutantCount++
  const broken = mutate(SOURCES[rel], [name, from, to], rel)
  await caughtAsync(`source: ${name}`, () => {
    sourceSuite({ ...SOURCES, __base: baseSources, [rel]: broken })
    if (baseOk && strip.FLOW_CONTROL_FILES.includes(rel)) ok(strip.stripFlowControl(rel, broken) === baseSources[rel], 'without its marked lines the file is still the base\'s')
  })
}
// the strip module itself
const stripText = fs.readFileSync(path.join(root, 'scripts/studio-flow-control-strip.mjs'), 'utf8')
const loadStrip = text => evalModule(text, 'studio-flow-control-strip.ts', {}, {})
if (baseOk) {
  const stripMutants = [
    ['the marker matches inside a word', "/(?<![\\w-])FLOW-CONTROL(?![\\w-])/", '/FLOW-CONTROL/'],
    ['only the first marked line goes', '.filter(line => !FLOW_CONTROL_MARKER_RE.test(line))', ".filter((line, at, all) => !FLOW_CONTROL_MARKER_RE.test(line) || all.findIndex(l => FLOW_CONTROL_MARKER_RE.test(l)) !== at)"],
    ['another file is stripped too', "if (!FLOW_CONTROL_FILES.includes(rel)) return text", 'if (false) return text'],
    ['a taught line is not put back', 'return (FLOW_CONTROL_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)', 'return text'],
  ]
  for (const mutant of stripMutants) {
    mutantCount++; stripMutantCount++
    const mod = loadStrip(mutate(stripText, mutant, 'strip'))
    const unchangedOther = mod.stripFlowControl('lib/other.ts', 'x // FLOW-CONTROL\n') === 'x // FLOW-CONTROL\n'
    const wholeToken = mod.stripFlowControl(PAGE, 'b // FLOW-CONTROL-X\n') === 'b // FLOW-CONTROL-X\n'
    const baseIdentity = strip.FLOW_CONTROL_FILES.every(rel => mod.stripFlowControl(rel, SOURCES[rel]) === baseSources[rel]) && TAUGHT.every(rel => mod.stripFlowControl(rel, readOwn(rel)) === baseSources[rel])
    if (unchangedOther && wholeToken && baseIdentity) survivors.push(`strip: ${mutant[0]}`)
  }
}
eq(survivors, [], `every mutant is caught (survivors: ${survivors.join('; ') || 'none'})`)
console.log(`PASS E  ${mutantCount} mutants (lib ${libMutants.length}, bar ${barMutants.length}, hook ${hookMutants.length}, sources ${sourceMutants.length}, strip ${stripMutantCount}), every one caught${crashes.length ? ` (${crashes.length} by a thrown error rather than a failed check)` : ''}`)
if (process.env.FLOW_TEST_VERBOSE) for (const crash of crashes) console.log(`  threw: ${crash}`)
release()
console.log(`OK studio flow control: ${afterMutants} checks`)
