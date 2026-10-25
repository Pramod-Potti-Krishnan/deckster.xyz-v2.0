// FRONTEND-2 (PROGRAM-1 Saturday evening push, 24 Oct: the Pass 3 polish set, PR C, stacked on PR B on PR A): proof for the flag NEXT_PUBLIC_STUDIO_PASS3_POLISH (exact "true", default off, build-time; the SAME flag as PR A and PR B).
// PR C closes one finding of the transcript check of DIRECTOR-2's recordings 08-11 (Director !548): a chip that is already Undone stays Undone. Without it lib/studio-bulk-edit-store.ts lets a LATER undo_result for the same
// change_id overwrite "restored" (a click on the Undo chip and a typed "undo that" in flight together: Director answers restored, then superseded / not_latest) and the chip reads "A later change replaced this" after a
// successful undo. With the flag on a restored chip keeps its state; every other phase behaves as before (failed -> restored on a retry still works). The change is TWO marked lines in the store (PASS3-POLISH-C).
// Run: node scripts/test-studio-pass3-polish-c.mjs   (plain node: the real TypeScript of the wire adapter and the store in a vm, `git show` reads the base commit; no network, no browser, no model call)
//
//   1. flag       the store imports PR A's constant (exact "true" and the Studio shell); the two marked lines are exactly the ones listed here and read no environment themselves
//   2. pin        the store without this change's marked lines (marker PASS3-POLISH-C, a whole token) is BASE_COMMIT's file byte for byte, through the registry too; every added line carries the marker
//   3. race       the REPLAY of recording 09: restored, then superseded / not_latest (and failed, and restored again) for the same change_id: flag on the chip stays restored, flag off (every misspelling) and the base file it is today's
//                 behaviour (superseded); a click in flight (pending) before the first answer; no extra render for the ignored frame
//   4. phases     every other phase x every answer (idle, pending, failed, superseded; restored, failed, superseded): flag on is the base file's outcome, except for a chip that is already restored; failed -> restored (a retry) works
//   5. recordings the store fed every out frame of recordings 01 to 11 (01 to 05 and 06 and 07 are the older fixture folders, 08 to 11 are the copies in scripts/fixtures/pass3-polish-c/, sha256-pinned): flag on, flag off and
//                 the base file leave the SAME trace after every frame (sha256 of each), the race (derived from 09) apart; the module's exports are the same
//   6. change     the strip (one rule, whole-token marker, the other changes' markers untouched), the registry (two lines, after PR B's), scope (the COMMITTED diff only; files of registered later changes are skipped), no secret
//   7. mutants    each one must make sections 1-6 fail
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import {
  BASE_COMMIT, PASS3_POLISH_C_FILES, PASS3_POLISH_C_FIXTURES, PASS3_POLISH_C_MARKER_RE, PASS3_POLISH_C_SCOPE_FILES, PASS3_POLISH_C_STORE, stripPass3PolishC,
} from './studio-pass3-polish-c-strip.mjs'
import { LATER_CHANGE_FILES, LATER_ENV_BLOCKS, LATER_STRIPS, stripLaterChanges } from './studio-later-changes.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nodeRequire = createRequire(import.meta.url)
const BASE = process.env.PASS3_POLISH_C_BASE || BASE_COMMIT
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
// This change's OWN committed files: the files of the non-merge commits in BASE..HEAD whose subject is this change's ("Pass 3 polish set, PR C: ..."), wherever they sit in the history. The working tree is never consulted
// (the suites of other changes write into docs/ and scripts/).
const ownCommitted = () => {
  const files = new Set()
  for (const block of git('log', '--no-merges', '--name-only', '--format=%x01%s', `${BASE}..HEAD`).split('\x01').filter(Boolean)) {
    const [subject, ...names] = block.split('\n')
    if (/^Pass 3 polish set, PR C:/.test(subject)) for (const name of names) if (name) files.add(name)
  }
  return [...files]
}
const showCache = new Map()
const baseOf = rel => { const ref = `${BASE}:${rel}`; if (!showCache.has(ref)) showCache.set(ref, git('show', ref)); return showCache.get(ref) }
let overrides = {} // in-memory mutations: every proof reads its sources through read()
const read = rel => (rel in overrides ? overrides[rel] : fs.readFileSync(path.join(root, rel), 'utf8'))
const sha = value => crypto.createHash('sha256').update(value).digest('hex')
const plain = value => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)))
const marked = line => PASS3_POLISH_C_MARKER_RE.test(line) // this change's marker, as a WHOLE token (PR A's PASS3-POLISH and PR B's PASS3-POLISH-B are not it)
// What this change's own checks read of the store: the file with every OTHER registered change's lines out (innermost, as every older pin reads it) and THIS change's own left in.
const withoutOthers = (rel, text) => {
  const si = LATER_STRIPS.indexOf(stripPass3PolishC)
  const mine = si >= 0 ? LATER_STRIPS.splice(si, 1)[0] : null
  try { return stripLaterChanges(rel, text) } finally { if (mine) LATER_STRIPS.splice(si, 0, mine) }
}

let checks = 0
const count = fn => (...args) => { checks++; return fn(...args) }
const eq = count(assert.equal), deep = count(assert.deepEqual), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch)

const STORE = PASS3_POLISH_C_STORE, WIRE = 'lib/studio-bulk-edit-wire.ts', LIB = 'lib/studio-pass3-polish.ts'
const REGISTRY = 'scripts/studio-later-changes.mjs', STRIP_MODULE = 'scripts/studio-pass3-polish-c-strip.mjs', THIS_TEST = 'scripts/test-studio-pass3-polish-c.mjs'
const FLAG = 'NEXT_PUBLIC_STUDIO_PASS3_POLISH', SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL', BULK = 'NEXT_PUBLIC_STUDIO_BULK_EDIT', UNDO = 'NEXT_PUBLIC_STUDIO_CHAT_UNDO'
const FEATURE = { [BULK]: 'true', [UNDO]: 'true' } // the feature itself on: the store only looks at undo_result with the chat-undo flag
const ON = { ...FEATURE, [FLAG]: 'true', [SHELL]: 'true' }
const OFF_STATES = [FEATURE, { ...FEATURE, [FLAG]: 'true' }, { ...FEATURE, [SHELL]: 'true' }, { ...FEATURE, [FLAG]: 'false', [SHELL]: 'true' }, { ...FEATURE, [FLAG]: 'TRUE', [SHELL]: 'true' }, { ...FEATURE, [FLAG]: '1', [SHELL]: 'true' },
  { ...FEATURE, [FLAG]: '', [SHELL]: 'true' }, { ...FEATURE, [FLAG]: ' true', [SHELL]: 'true' }, { ...FEATURE, [FLAG]: 'true', [SHELL]: 'false' }]

// ---------------------------------------------------------------- loading: the real TypeScript in a vm, one world per environment and per store text
const compileCache = new Map()
function compile(rel, text) {
  const cacheId = `${rel}\0${text}`
  if (!compileCache.has(cacheId)) compileCache.set(cacheId, ts.transpileModule(text, { fileName: rel, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText)
  return compileCache.get(cacheId)
}
function world(env, { storeText = null } = {}) {
  const registry = new Map()
  const textOf = rel => (rel === STORE && storeText !== null ? storeText : read(rel))
  function load(rel) {
    if (registry.has(rel)) return registry.get(rel).exports
    const module = { exports: {} }; registry.set(rel, module)
    const req = spec => (spec === 'react' ? nodeRequire('react') : spec.startsWith('@/') ? load(`${spec.slice(2)}.ts`) : (() => { throw new Error(`unexpected import ${spec} in ${rel}`) })())
    vm.runInThisContext(`(function(exports, require, module, __filename, process){${compile(rel, textOf(rel))}\n})`, { filename: rel })(module.exports, req, module, rel, { env: { ...env } })
    return module.exports
  }
  return { store: load(STORE), wire: load(WIRE), lib: load(LIB) }
}

// ---------------------------------------------------------------- the recordings
const FIXTURE_DIRS = {
  '01-bulk-confirm-card': 'bulk-edit-undo', '02-bulk-run-one-failure': 'bulk-edit-undo', '03-bulk-all-skipped': 'bulk-edit-undo', '04-undo-restored': 'bulk-edit-undo', '05-undo-superseded': 'bulk-edit-undo',
  '06-change-recorded-anchor': 'chat-undo-v2', '07-reconnect-replay': 'chat-undo-v2',
  '08-bulk-polish-one-name-per-slide': 'pass3-polish-c', '09-typed-undo': 'pass3-polish-c', '10-bulk-polish-title-only': 'pass3-polish-c', '11-bulk-polish-refine-only-and-rebuild-card': 'pass3-polish-c',
}
const REC_NAMES = Object.keys(FIXTURE_DIRS)
const fixturePath = name => `scripts/fixtures/${FIXTURE_DIRS[name]}/${name}.json`
const FIXTURE_SHA = { // 08 to 11: byte-identical copies of the Director repo's docs/mdc/bulk-edit-undo-frames/ at its commit 4330151d (Director !548); a changed byte fails here
  '08-bulk-polish-one-name-per-slide': '49c77dfe69412817bf8186088ac149b3b87f91d04151dff93f8bc7f64864610a',
  '09-typed-undo': 'a8606b38c8b3cd46f75e8b6cc5f37e344b6b479bafac7380f4f9dabd76b24490',
  '10-bulk-polish-title-only': '80fa26d784d82748cc39ec6d7b22a6e536289bc169b46f8c564b15f559088d8e',
  '11-bulk-polish-refine-only-and-rebuild-card': 'a1f11c4489bbe92b1b830ff24b2eee3c6c75cb42a313d396916058326ceddbb6',
}
const recording = name => JSON.parse(read(fixturePath(name)))
const outFrames = name => recording(name).frames.filter(item => item.direction === 'out').map(item => plain(item.frame))

/** The tab's view of one recording: its session, the deck its change_recorded names, and the deck's titles (DERIVED: no frame carries them). */
function contextOf(frames) {
  const sessionId = frames.find(frame => frame.session_id)?.session_id ?? 's_none'
  const change = frames.find(frame => frame.type === 'change_recorded')
  const confirm = frames.find(frame => frame.type === 'action_request' && frame.payload?.bulk_edit)
  const ids = confirm?.payload.bulk_edit.slide_ids ?? []
  return { sessionId, presentationId: change?.payload.presentation_id ?? null, isCurrent: true, ownerSessionId: sessionId, slideTitles: () => ids.map(id => ({ slide_id: id, title: `Title ${id}` })) }
}

/** Everything the store shows about one session after a frame: the bulks the frames named, and the chip under every Director line the frames sent. */
function snapshot(mod, store, frames, sessionId) {
  const bulkIds = [...new Set(frames.flatMap(frame => (frame.payload?.bulk_id ? [frame.payload.bulk_id] : frame.payload?.bulk_edit?.bulk_id ? [frame.payload.bulk_edit.bulk_id] : [])))]
  const hostIds = [...new Set(frames.filter(frame => frame.type === 'chat_message').flatMap(frame => [frame.message_id]).concat(frames.flatMap(frame => (frame.payload?.anchor_message_id ? [frame.payload.anchor_message_id] : []))))]
  const chips = hostIds.map(id => { const chip = store.changeFor(sessionId, id); return chip ? { host: id, id: chip.change.changeId, label: chip.change.label, kind: chip.change.kind, state: chip.state, live: chip.liveAnchorId, history: chip.historyAnchorId, replayed: chip.replayed, seq: chip.seq } : null })
  return { bulks: bulkIds.map(id => plain(store.bulk(sessionId, id))), chips: plain(chips) }
}
/** One trace: the route result, the store's version and the snapshot after every frame. `steps` may hold the user's click as a function. */
function traceOf(w, steps, context, { frames = steps.filter(step => typeof step !== 'function') } = {}) {
  const store = w.store.createBulkEditUndoStore(), log = []
  for (const step of steps) {
    const route = typeof step === 'function' ? step(store) : w.store.routeStudioBulkEditUndoFrame(plain(step), context, store)
    log.push({ route, version: store.version(), shown: snapshot(w.store, store, frames, context.sessionId) })
  }
  return { log, store }
}
const lastChip = trace => trace.log[trace.log.length - 1].shown.chips.find(chip => chip)
const phaseOf = trace => lastChip(trace).state.phase

// ---------------------------------------------------------------- 1. the flag and the two lines
function proveLines(storeText, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const lines = storeText.split('\n')
  const mine = lines.filter(marked)
  eq(mine.length, 2, a('exactly 2 lines are this change\'s'))
  const importAt = lines.findIndex(line => marked(line) && /^import \{ STUDIO_PASS3_POLISH_ENABLED \} from '@\/lib\/studio-pass3-polish' \/\/ PASS3-POLISH-C /.test(line))
  ok(importAt > 0, a('line 1 is the import of PR A\'s constant'))
  match(lines[importAt - 1], /^\} from '@\/lib\/studio-bulk-edit-wire'$/, a('it sits right after the wire import'))
  const guardAt = lines.findIndex(line => marked(line) && /^ {8}if \(STUDIO_PASS3_POLISH_ENABLED && record && record\.state\.phase === 'restored'\) return 'consumed' \/\/ PASS3-POLISH-C /.test(line))
  ok(guardAt > 0, a('line 2 is the guard: the flag, a record, its phase is restored: consumed'))
  match(lines[guardAt - 1], /^ {8}const record = result \? findChange\(sessions\.get\(sessionId\), result\.changeId\) : undefined$/, a('it follows the record lookup'))
  match(lines[guardAt + 1], /^ {8}if \(result && record\) \{ record\.state = undoPhaseOf\(result\.status, result\.reason\); changed\(\) \}$/, a('and sits before the assignment it guards, which is untouched'))
  for (const line of mine) { nomatch(line.replace(/\/\/.*$/, ''), /process\.env|NEXT_PUBLIC/, a('the code of a marked line reads no environment itself (the flag is PR A\'s constant)')) }
  // the unmarked code never mentions the polish flag: the only reads are the two marked lines
  eq(lines.filter(line => /STUDIO_PASS3_POLISH_ENABLED/.test(line)).length, 2, a('the constant is named on the two marked lines only'))
}
function proveLib(libText, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  match(libText, /export const STUDIO_PASS3_POLISH_ENABLED = process\.env\.NEXT_PUBLIC_STUDIO_PASS3_POLISH === 'true' && process\.env\.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'/, a('PR A\'s constant is exact "true" and needs the Studio shell'))
}

// ---------------------------------------------------------------- 2. the pin
function provePin(storeText, stripFn = stripPass3PolishC, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const base = withoutOthers(STORE, baseOf(STORE))
  const own = withoutOthers(STORE, storeText)
  const stripped = stripFn(STORE, own)
  eq(sha(stripped), sha(base), a(`${STORE}: without this change's lines it is the base commit's file, byte for byte`))
  eq(sha(stripLaterChanges(STORE, storeText)), sha(stripLaterChanges(STORE, baseOf(STORE))), a('and through the registry (innermost, as every older pin reads it) it is the base commit\'s file'))
  ok(!stripped.split('\n').some(marked), a('the stripped file carries no marker'))
  ok(!base.split('\n').some(marked), a('the base never carried the marker'))
  const lines = own.split('\n'), baseLines = base.split('\n')
  const kept = lines.filter(line => !marked(line))
  deep(kept, baseLines, a('every base line is there in order, none changed'))
  eq(lines.length - kept.length, 2, a('two lines added, none removed'))
}

// ---------------------------------------------------------------- 3 and 4. the race and the phases
const REC09 = () => outFrames('09-typed-undo')
/** The recorded setup of 09 up to and including change_recorded, the recorded answer (restored), and the answers DERIVED from it. */
function raceParts() {
  const frames = REC09(), context = contextOf(frames)
  const recorded = frames.findIndex(frame => frame.type === 'change_recorded')
  const setup = frames.slice(0, recorded + 1)
  const answer = frames.find(frame => frame.type === 'undo_result')   // RECORDED: restored
  const cid = answer.payload.change_id
  const derived = (status, reason = null) => ({ ...plain(answer), message_id: `msg_undo_derived_${status}`, payload: { change_id: cid, status, reason } }) // DERIVED: the same frame with another status
  return { frames, context, setup, answer, cid, derived, all: frames }
}
const NOW = 1_000_000
const click = cid => store => store.beginUndo(raceParts().context.sessionId, cid, NOW) // the person clicks the Undo chip: idle -> pending (the page's sendStudioUndo does this first)
const PHASE_SETUPS = { // the chip's phase before the second answer: DERIVED from recording 09 (answers) and the store's own click
  idle: p => [],
  pending: p => [click(p.cid)],
  failed: p => [p.derived('failed', 'restore_failed')],
  superseded: p => [p.derived('superseded', 'deck_changed')],
  restored: p => [p.answer],
}
const ANSWERS = [['restored', null], ['failed', 'busy'], ['superseded', 'not_latest'], ['superseded', 'deck_changed']]

function proveRace(mods, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const p = raceParts()
  const run = (w, tail) => traceOf(w, [...p.setup, ...tail], p.context, { frames: p.all })
  // the race itself: the typed "undo that" is answered (restored, RECORDED), then the click's answer arrives (superseded / not_latest, DERIVED)
  const second = p.derived('superseded', 'not_latest')
  const onRace = run(mods.on, [p.answer, second]), offRace = mods.off.map(w => run(w, [p.answer, second])), baseRace = run(mods.base, [p.answer, second])
  eq(phaseOf(onRace), 'restored', a('flag on: restored, then superseded / not_latest: the chip stays restored'))
  eq(onRace.log[onRace.log.length - 1].route, 'consumed', a('the ignored answer is still consumed (the hook stops there, as for any undo_result)'))
  eq(onRace.log[onRace.log.length - 1].version, onRace.log[onRace.log.length - 2].version, a('and it draws nothing again (no extra render)'))
  deep(onRace.log[onRace.log.length - 1].shown, onRace.log[onRace.log.length - 2].shown, a('the whole store is as it was before the ignored answer'))
  eq(phaseOf(baseRace), 'superseded', a('the base file: the same race leaves "A later change replaced this" (today)'))
  for (const [index, trace] of offRace.entries()) eq(sha(JSON.stringify(trace.log)), sha(JSON.stringify(baseRace.log)), a(`flag off (state ${index}): the race is the base file's trace, byte for byte`))
  // the same with the click in flight (pending) before the first answer
  const onClick = run(mods.on, [click(p.cid), p.answer, second]), baseClick = run(mods.base, [click(p.cid), p.answer, second])
  eq(onClick.log[p.setup.length].shown.chips.find(chip => chip).state.phase, 'pending', a('the click puts the chip to pending (the store, as before)'))
  eq(phaseOf(onClick), 'restored', a('flag on: pending, restored, superseded: restored'))
  eq(phaseOf(baseClick), 'superseded', a('the base file: pending, restored, superseded: superseded (today)'))
  // every later answer: failed, superseded (either reason) and restored again: restored stays
  for (const [status, reason] of ANSWERS) {
    const on = run(mods.on, [p.answer, p.derived(status, reason)]), base = run(mods.base, [p.answer, p.derived(status, reason)])
    eq(phaseOf(on), 'restored', a(`flag on: restored, then ${status}${reason ? ' / ' + reason : ''}: restored`))
    eq(phaseOf(base), status === 'restored' ? 'restored' : status === 'failed' ? 'failed' : 'superseded', a(`the base file: the same answer changes it (${status})`))
  }
  // a restored chip is final, but a NEW change is not blocked by it
  const closing = [...p.setup].reverse().find(frame => frame.type === 'chat_message') // the closing line of 09's change
  const line2 = { ...plain(closing), message_id: 'msg_line_second' }                    // DERIVED: another Director line, for a second change to sit under
  const second_change = { ...plain(p.setup[p.setup.length - 1]), message_id: 'msg_chg_second', payload: { ...plain(p.setup[p.setup.length - 1]).payload, change_id: 'chg_second', label: 'Refined slide 4', anchor_message_id: 'msg_line_second' } }
  const answer2 = { ...plain(p.answer), message_id: 'msg_undo_second', payload: { change_id: 'chg_second', status: 'restored', reason: null } }
  const frames2 = [...p.all, line2, second_change]
  const two = traceOf(mods.on, [...p.setup, p.answer, line2, second_change, answer2, second], p.context, { frames: frames2 }), twoBase = traceOf(mods.base, [...p.setup, p.answer, line2, second_change, answer2, second], p.context, { frames: frames2 })
  const states = trace => Object.fromEntries(trace.log[trace.log.length - 1].shown.chips.filter(chip => chip).map(chip => [chip.id, chip.state.phase]))
  deep(states(two), { [p.cid]: 'restored', chg_second: 'restored' }, a('flag on: a second change\'s own answer is applied, the first stays restored'))
  ok(JSON.stringify(states(twoBase)) !== JSON.stringify(states(two)), a('the base file differs (the first change goes to superseded)'))
  // unknown change ids and a foreign session are consumed, as before
  const unknown = { ...plain(p.answer), payload: { change_id: 'chg_unknown', status: 'superseded', reason: 'not_latest' } }, foreign = { ...plain(p.answer), session_id: 's_other' }
  for (const frame of [unknown, foreign, { type: 'undo_result', payload: null }, { type: 'undo_result', payload: { change_id: p.cid, status: 'weird' } }]) {
    eq(run(mods.on, [p.answer, frame]).log.pop().route, run(mods.base, [p.answer, frame]).log.pop().route, a('an answer for no chip, another session, or with a bad status is routed as before'))
    eq(phaseOf(run(mods.on, [p.answer, frame])), 'restored', a('and does not touch the restored chip'))
  }
  // beginUndo on a restored chip: nothing to do, as before
  const t = run(mods.on, [p.answer]); eq(mods.on.store.createBulkEditUndoStore().beginUndo('s', 'c', NOW), false, a('a store that never heard of the change has nothing to undo'))
  eq(t.store.beginUndo(p.context.sessionId, p.cid, NOW), false, a('beginUndo on a restored chip does nothing (as before)'))
}
function provePhases(mods, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const p = raceParts()
  const run = (w, tail) => traceOf(w, [...p.setup, ...tail], p.context, { frames: p.all })
  for (const [phase, setup] of Object.entries(PHASE_SETUPS)) {
    for (const [status, reason] of ANSWERS) {
      const tail = [...setup(p), p.derived(status, reason)]
      const on = run(mods.on, tail), base = run(mods.base, tail), off = run(mods.off[1], tail)
      eq(phaseOf(on), phase === 'restored' ? 'restored' : phaseOf(base), a(`${phase} + ${status}${reason ? ' / ' + reason : ''}: flag on is ${phase === 'restored' ? 'still restored' : 'the base file\'s outcome'}`))
      eq(sha(JSON.stringify(off.log)), sha(JSON.stringify(base.log)), a(`${phase} + ${status}: flag off is the base file's trace`))
      if (phase !== 'restored') eq(sha(JSON.stringify(on.log)), sha(JSON.stringify(base.log)), a(`${phase} + ${status}: flag on is the base file's whole trace, frame by frame`))
    }
  }
  // the retry: failed -> restored, with the flag on
  const retry = run(mods.on, [p.derived('failed', 'restore_failed'), p.answer])
  eq(phaseOf(retry), 'restored', a('failed, then restored (a retry): restored'))
  const retry2 = run(mods.on, [click(p.cid), p.derived('failed', 'busy'), p.answer])
  eq(phaseOf(retry2), 'restored', a('pending, failed (busy), then restored (a typed undo that worked): restored'))
  // an expired pending click still fails, as before
  const t = run(mods.on, [click(p.cid)]); eq(t.store.expirePending(p.context.sessionId, NOW + 60_000), 1, a('a pending click with no answer still expires'))
  // the chat-undo flag off: the store ignores undo_result altogether, polish on or not
  const noUndo = world({ ...ON, [UNDO]: 'false' }), noUndoBase = world({ ...ON, [UNDO]: 'false' }, { storeText: baseOf(STORE) })
  eq(sha(JSON.stringify(traceOf(noUndo, [...p.setup, p.answer, p.derived('superseded', 'not_latest')], p.context, { frames: p.all }).log)), sha(JSON.stringify(traceOf(noUndoBase, [...p.setup, p.answer, p.derived('superseded', 'not_latest')], p.context, { frames: p.all }).log)), a('chat undo off: the same trace as the base file'))
}

// ---------------------------------------------------------------- 5. the recordings, flag on / off / base
function proveRecordings(mods, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  for (const name of REC_NAMES) {
    if (name in FIXTURE_SHA) eq(sha(read(fixturePath(name))), FIXTURE_SHA[name], a(`${name}: the copy is byte-identical to the Director repo's recording (sha256 pinned)`))
    const frames = outFrames(name), context = contextOf(frames)
    ok(frames.length > 0 && recording(name).frames.every(item => item.direction === 'in' || item.direction === 'out'), a(`${name}: a recording with frames`))
    const base = traceOf(mods.base, frames, context), on = traceOf(mods.on, frames, context)
    eq(sha(JSON.stringify(on.log)), sha(JSON.stringify(base.log)), a(`${name}: flag on leaves the base file's trace after every one of ${frames.length} frames`))
    for (const [index, w] of mods.off.entries()) eq(sha(JSON.stringify(traceOf(w, frames, context).log)), sha(JSON.stringify(base.log)), a(`${name}: flag off (state ${index}) leaves the base file's trace`))
    // every frame of the recording is routed the same, and the adapter-owned ones are taken by the store
    const routes = on.log.map(entry => entry.route), types = frames.map(frame => frame.type)
    types.forEach((type, i) => eq(routes[i], ['bulk_edit_progress', 'bulk_edit_summary'].includes(type) || ((type === 'change_recorded' || type === 'undo_result')) ? 'consumed' : 'pass', a(`${name} #${i + 1} ${type}: routed as before`)))
  }
  // the recorded undo of 04 and 09 ends restored, the recorded superseded of 05 ends superseded: the same with the flag on
  const end = (name, w) => { const frames = outFrames(name); return phaseOf(traceOf(w, frames, contextOf(frames))) }
  eq(end('04-undo-restored', mods.on), 'restored', a('04: the recorded undo ends restored'))
  eq(end('05-undo-superseded', mods.on), 'superseded', a('05: the recorded superseded ends superseded (a superseded chip is not restored)'))
  eq(end('09-typed-undo', mods.on), 'restored', a('09: the typed undo ends restored'))
  deep(Object.keys(mods.on.store).sort(), Object.keys(mods.base.store).sort(), a('the module exports the same names as the base file'))
  deep(Object.keys(mods.on.store.createBulkEditUndoStore()).sort(), Object.keys(mods.base.store.createBulkEditUndoStore()).sort(), a('the store has the same methods as the base file\'s'))
}

// ---------------------------------------------------------------- 6. the change
function proveStrip(stripFn = stripPass3PolishC, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  eq(stripFn('lib/other.ts', 'x // PASS3-POLISH-C'), 'x // PASS3-POLISH-C', a('any other file is returned as it is'))
  eq(stripFn('.env.example', 'a\nb // PASS3-POLISH-C\n'), 'a\nb // PASS3-POLISH-C\n', a('.env.example is returned as it is (its block is PR A\'s)'))
  eq(stripFn(STORE, 'a\nb // PASS3-POLISH-C: x\nc\n'), 'a\nc\n', a('a marked line goes, every other byte stays (trailing newline too)'))
  eq(stripFn(STORE, 'a\nb // PASS3-POLISH\nc // PASS3-POLISH-B\nd // PASS3-POLISH-CC\ne // XPASS3-POLISH-C\nf // PASS3-POLISH-C-x\n'), 'a\nb // PASS3-POLISH\nc // PASS3-POLISH-B\nd // PASS3-POLISH-CC\ne // XPASS3-POLISH-C\nf // PASS3-POLISH-C-x\n', a('only this change\'s marker, as a whole token, takes a line out: PR A\'s and PR B\'s lines stay for their own strips'))
  eq(stripFn(STORE, stripFn(STORE, read(STORE))), stripFn(STORE, read(STORE)), a('stripping twice changes nothing more'))
  eq(stripFn(STORE, 7), 7, a('a non-string comes back'))
  deep(PASS3_POLISH_C_FILES, [STORE], a('the strip touches the bulk-edit store only'))
  eq(sha(stripFn(STORE, withoutOthers(STORE, read(STORE)))), sha(withoutOthers(STORE, baseOf(STORE))), a('the strip gives the base commit\'s store'))
  // the three polish strips (A, B, C) never take each other's lines: the order of registration does not matter
  const lines = 'a // PASS3-POLISH\nb // PASS3-POLISH-B\nc // PASS3-POLISH-C\nd\n'
  eq(stripFn(STORE, lines), 'a // PASS3-POLISH\nb // PASS3-POLISH-B\nd\n', a('in a file with all three markers it takes only its own'))
}
function proveRegistry(registryText, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const lines = registryText.split('\n').filter(line => line.includes("'./studio-pass3-polish-c-strip.mjs'"))
  eq(lines.length, 2, a('the registry has exactly two lines for this change: its files and its strip (no .env.example block)'))
  ok(lines.every(line => line.includes('// LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR C (NEXT_PUBLIC_STUDIO_PASS3_POLISH')), a('each carries the LATER-CHANGE marker'))
  match(lines[0], /\.\.\.\(await import\('\.\/studio-pass3-polish-c-strip\.mjs'\)\)\.PASS3_POLISH_C_SCOPE_FILES,/, a('line 1: the files'))
  match(lines[1], /\(await import\('\.\/studio-pass3-polish-c-strip\.mjs'\)\)\.stripPass3PolishC,/, a('line 2: the strip'))
  const at1 = registryText.indexOf(lines[0]), at2 = registryText.indexOf(lines[1]), files = registryText.indexOf('export const LATER_CHANGE_FILES'), blocks = registryText.indexOf('export const LATER_ENV_BLOCKS'), strips = registryText.indexOf('export const LATER_STRIPS')
  ok(files < at1 && at1 < blocks && strips < at2, a('the files line is in LATER_CHANGE_FILES, the strip line in LATER_STRIPS'))
  const bFiles = registryText.indexOf("'./studio-pass3-polish-b-strip.mjs')).PASS3_POLISH_B_SCOPE_FILES"), bStrip = registryText.indexOf("'./studio-pass3-polish-b-strip.mjs')).stripPass3PolishB")
  ok(bFiles > 0 && bFiles < at1 && bStrip > 0 && bStrip < at2, a('each comes after PR B\'s line in the same list (a union on merge keeps both)'))
  ok(!registryText.slice(blocks, strips).includes('studio-pass3-polish-c-strip'), a('and nothing of this change is in LATER_ENV_BLOCKS'))
  ok(LATER_STRIPS.includes(stripPass3PolishC) || LATER_STRIPS.some(fn => fn.name === 'stripPass3PolishC'), a('the registry holds the strip'))
  ok([...PASS3_POLISH_C_SCOPE_FILES].every(rel => LATER_CHANGE_FILES.has(rel)), a('the registry names every file of this change'))
  ok(!LATER_ENV_BLOCKS.some(block => /PASS3-POLISH-C/.test(String(block))), a('no env block of its own'))
}
function proveScope(at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  ok([...PASS3_POLISH_C_SCOPE_FILES].every(rel => fs.existsSync(path.join(root, rel))), a('every file listed exists'))
  deep([...PASS3_POLISH_C_FIXTURES].sort(), Object.keys(FIXTURE_SHA).map(name => fixturePath(name)).sort(), a('the fixtures listed are the four pinned ones'))
  const family = ['lib', 'hooks', 'components', 'scripts'].flatMap(dir => fs.existsSync(path.join(root, dir)) ? fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? (/pass3-polish-c/.test(entry.name) ? fs.readdirSync(path.join(root, dir, entry.name)).map(name => `${dir}/${entry.name}/${name}`) : []) : (/pass3-polish-c/.test(entry.name) ? [`${dir}/${entry.name}`] : [])) : [])
  deep(family.filter(rel => !PASS3_POLISH_C_SCOPE_FILES.has(rel) && !LATER_CHANGE_FILES.has(rel)), [], a('no file of this change\'s family is missing from its list'))
  const committed = ownCommitted()
  const stray = committed.filter(rel => !PASS3_POLISH_C_SCOPE_FILES.has(rel) && !LATER_CHANGE_FILES.has(rel))
  deep(stray, [], a(`every file in the committed diff of this change (${BASE.slice(0, 8)}..HEAD) is its own or a registered later change's (no older test is edited)`))
  if (committed.length) {
    deep([...PASS3_POLISH_C_SCOPE_FILES].filter(rel => !committed.includes(rel)), [], a('and every file of this change is in the committed diff'))
    ok(committed.filter(rel => /^scripts\/test-/.test(rel)).every(rel => rel === THIS_TEST || LATER_CHANGE_FILES.has(rel)), a('the only test it adds or edits is its own'))
    ok(committed.filter(rel => !/^scripts\//.test(rel)).every(rel => rel === STORE), a('the only app file it changes is the store'))
  }
}
function proveSecretScan(storeText, at = '') {
  const a = message => (at ? `${at}: ${message}` : message)
  const added = [STRIP_MODULE, THIS_TEST].map(read).concat(storeText.split('\n').filter(marked)).join('\n')
  nomatch(added, /\b(api[_-]?key|secret|token|passw(or)?d)\w*\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/i, a('no credential-shaped literal in the added lines (the recordings hold Director\'s opaque synthetic ids, as the older fixtures do)'))
  nomatch(added, /\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@'"`]+:[^@\s'"`]+@/i, a('no user:pass@ in an added URL'))
}

// ---------------------------------------------------------------- run everything
function proveAll(stripFn = stripPass3PolishC, at = '') {
  const storeText = read(STORE)
  proveLib(read(LIB), at)
  proveLines(withoutOthers(STORE, storeText), at)
  provePin(storeText, stripFn, at)
  const mods = { on: world(ON), off: OFF_STATES.map(env => world(env)), base: world(ON, { storeText: baseOf(STORE) }) }
  proveRace(mods, at)
  provePhases(mods, at)
  proveRecordings(mods, at)
  proveStrip(stripFn, at)
  proveRegistry(read(REGISTRY), at)
  proveScope(at)
  proveSecretScan(storeText, at)
  return mods
}
const mods = proveAll()
const digest = (() => { const frames = outFrames('09-typed-undo'), context = contextOf(frames); return { base: sha(JSON.stringify(traceOf(mods.base, frames, context).log)).slice(0, 16), off: sha(JSON.stringify(traceOf(mods.off[0], frames, context).log)).slice(0, 16) } })()
console.log(`flag off: ${REC_NAMES.length} recordings, ${OFF_STATES.length} flag-off states, traces sha256 base ${digest.base} == off ${digest.off} (recording 09)`)
console.log(`PASS flag, pin, race, phases, recordings 01-11, change: ${checks} checks`)

// =========================================================== 7. mutants
const killed = [], survived = []
async function mutant(name, edits, { strip = stripPass3PolishC } = {}) {
  const before = overrides
  try {
    overrides = { ...before }
    for (const [rel, from, to, mode] of edits) { // mode: none = the text occurs once; 'all' = every one
      const source = read(rel), n = source.split(from).length - 1
      assert.ok(mode ? n >= 1 : n === 1, `mutant "${name}" no longer applies to ${rel}: ${from.slice(0, 70)}`)
      overrides[rel] = mode === 'all' ? source.split(from).join(to) : source.replace(from, () => to)
    }
    proveAll(strip, name)
  } catch (error) {
    if (/no longer applies/.test(String(error.message))) throw error
    killed.push(name); if (process.env.PASS3_POLISH_C_VERBOSE) console.log(`  killed: ${name}\n    by: ${String(error.message).split('\n')[0].slice(0, 170)}`); return
  } finally { overrides = before }
  survived.push(name)
}
const GUARD = "if (STUDIO_PASS3_POLISH_ENABLED && record && record.state.phase === 'restored') return 'consumed'"
const IMPORT = "import { STUDIO_PASS3_POLISH_ENABLED } from '@/lib/studio-pass3-polish' // PASS3-POLISH-C"
// the guard
await mutant('guard: the flag is not required', [[STORE, GUARD, "if (record && record.state.phase === 'restored') return 'consumed'"]])
await mutant('guard: it also needs a pending click (never on the typed undo)', [[STORE, GUARD, "if (STUDIO_PASS3_POLISH_ENABLED && record && record.state.phase === 'restored' && record.state.since) return 'consumed'"]])
await mutant('guard: it protects every phase that is not idle (a retry after failed is blocked)', [[STORE, "record.state.phase === 'restored') return 'consumed'", "record.state.phase !== 'idle') return 'consumed'"]])
await mutant('guard: failed is final too', [[STORE, "record.state.phase === 'restored') return 'consumed'", "(record.state.phase === 'restored' || record.state.phase === 'failed')) return 'consumed'"]])
await mutant('guard: superseded is final too', [[STORE, "record.state.phase === 'restored') return 'consumed'", "(record.state.phase === 'restored' || record.state.phase === 'superseded')) return 'consumed'"]])
await mutant('guard: it protects superseded, not restored', [[STORE, "record.state.phase === 'restored') return 'consumed'", "record.state.phase === 'superseded') return 'consumed'"]])
await mutant('guard: the ignored answer is passed on to the hook', [[STORE, "record.state.phase === 'restored') return 'consumed'", "record.state.phase === 'restored') return 'pass'"]])
await mutant('guard: it does not return (the answer still overwrites)', [[STORE, "record.state.phase === 'restored') return 'consumed'", "record.state.phase === 'restored') void 0"]])
await mutant('guard: it dereferences a missing record (an answer for no chip is swallowed as pass)', [[STORE, "&& record && record.state.phase === 'restored'", "&& record.state.phase === 'restored'"]])
await mutant('guard: the ignored answer still draws again', [[STORE, "record.state.phase === 'restored') return 'consumed'", "record.state.phase === 'restored') { changed(); return 'consumed' }"]])
await mutant('guard: the answer is applied first, then reverted', [[STORE, GUARD + ' // PASS3-POLISH-C', "if (STUDIO_PASS3_POLISH_ENABLED && record && record.state.phase === 'restored') { record.state = { phase: 'restored' }; changed(); return 'consumed' } // PASS3-POLISH-C"]])
// the lines and the pin
await mutant('pin: the import loses its marker', [[STORE, IMPORT, IMPORT.replace(' // PASS3-POLISH-C', ' // PASS3')]])
await mutant('pin: an unmarked line added', [[STORE, 'export const UNDO_PENDING_TIMEOUT_MS = 60_000\n', 'export const UNDO_PENDING_TIMEOUT_MS = 60_000\nconst unmarked = 1\n']])
await mutant('pin: a third marked line', [[STORE, "export const UNDO_PENDING_TIMEOUT_MS = 60_000", "export const UNDO_PENDING_TIMEOUT_MS = 60_000 // PASS3-POLISH-C"]])
await mutant('pin: a base line changed', [[STORE, 'export const UNDO_PENDING_TIMEOUT_MS = 60_000', 'export const UNDO_PENDING_TIMEOUT_MS = 30_000']])
await mutant('pin: the store reads the environment itself', [[STORE, GUARD, "if (process.env.NEXT_PUBLIC_STUDIO_PASS3_POLISH === 'true' && record && record.state.phase === 'restored') return 'consumed'"]])
await mutant('pin: the import is from PR B\'s lib', [[STORE, "from '@/lib/studio-pass3-polish' // PASS3-POLISH-C", "from '@/lib/studio-pass3-polish-b' // PASS3-POLISH-C"]])
await mutant('flag: PR A\'s constant is loosened to any value', [[LIB, "process.env.NEXT_PUBLIC_STUDIO_PASS3_POLISH === 'true'", 'Boolean(process.env.NEXT_PUBLIC_STUDIO_PASS3_POLISH)']])
await mutant('flag: PR A\'s constant no longer needs the Studio shell', [[LIB, " && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'", '']])
// the recordings
await mutant('recordings: a byte of recording 09 changed', [[fixturePath('09-typed-undo'), '"status": "restored"', '"status": "restoreD"']])
await mutant('recordings: recording 11 has no out frame', [[fixturePath('11-bulk-polish-refine-only-and-rebuild-card'), '"direction": "out"', '"direction": "in"', 'all']])
// the strip, the registry
await mutant('strip: leaves the marked lines', [], { strip: (rel, text) => text })
await mutant('strip: the marker is a substring (PR A\'s and PR B\'s lines go with this one\'s)', [], { strip: (rel, text) => (rel === STORE && typeof text === 'string' ? text.split('\n').filter(line => !line.includes('PASS3-POLISH')).join('\n') : text) })
await mutant('strip: also removes an unmarked line', [], { strip: (rel, text) => (rel === STORE && typeof text === 'string' ? text.split('\n').filter(line => !marked(line) && !line.includes('UNDO_PENDING_TIMEOUT_MS = 60_000')).join('\n') : text) })
await mutant('strip: drops the trailing newline', [], { strip: (rel, text) => stripPass3PolishC(rel, text).replace(/\n$/, '') })
await mutant('registry: the files line is gone', [[REGISTRY, "  ...(await import('./studio-pass3-polish-c-strip.mjs')).PASS3_POLISH_C_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR C (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own: the flag's block is PR A's)\n", '']])
await mutant('registry: the strip line is gone', [[REGISTRY, "  (await import('./studio-pass3-polish-c-strip.mjs')).stripPass3PolishC, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR C (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own)\n", '']])
await mutant('registry: this change\'s files line sits before PR B\'s', [[REGISTRY, "  ...(await import('./studio-pass3-polish-c-strip.mjs')).PASS3_POLISH_C_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR C (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own: the flag's block is PR A's)\n", ''], [REGISTRY, "  ...(await import('./studio-first-paint-strip.mjs')).FIRST_PAINT_SCOPE_FILES,", "  ...(await import('./studio-pass3-polish-c-strip.mjs')).PASS3_POLISH_C_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR C (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own: the flag's block is PR A's)\n  ...(await import('./studio-first-paint-strip.mjs')).FIRST_PAINT_SCOPE_FILES,"]])
await mutant('secret scan: a credential-shaped literal', [[STRIP_MODULE, "export const PASS3_POLISH_C_MARKER = 'PASS3-POLISH-C'", `export const PASS3_POLISH_C_MARKER = 'PASS3-POLISH-C'\nconst ${['api', 'Key'].join('')} = '${['AKIA', 'ABCDEFGH', '12345678'].join('')}'`]])

console.log(`mutants: ${killed.length}/${killed.length + survived.length} killed`)
if (survived.length) { console.log('SURVIVED:\n  ' + survived.join('\n  ')); process.exit(1) }
console.log(`test-studio-pass3-polish-c: ${checks} checks passed, ${killed.length}/${killed.length} mutants killed; no network.`)
