// FRONTEND-2: proof that Studio's template match (#559, flag NEXT_PUBLIC_STUDIO_TEMPLATE_MATCH, the string "true", default off, build-time) already renders Director P4-7c's mixed-template frames (Director !611: matcher v2
// and the strawman-level match). TESTS ONLY: no product code, no existing proof and no existing fixture is changed; the flag stays off. This file is its own proof, next to scripts/test-studio-template-match.mjs (which it does not
// import and does not change); the loader below is that proof's approach (the REAL lib/studio-template-match.ts and hooks/use-studio-template-match.ts, transpiled and run in a bare function scope with a fake `process` and `window`).
//
//   F.  The fixtures: scripts/studio-template-match-fixtures/frames-p47c.json holds DIRECTOR-2's M6 and M7 (streams/director2/p4-7-template-match/out), extracted verbatim the way M0-M5 were, with each recording's sha256.
//   E1-E6. What the recorded frames must draw (see A2 below), through the REAL hook and lib.
//   Mutants of each: every one must be caught by the check of its expectation.
//
//   node scripts/test-studio-template-match-p47c.mjs
//
// Offline: no socket, fetch or real timer (the harness's host network guard is installed). No git is used.
process.env.NODE_ENV = 'production'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import net from 'node:net'
import dns from 'node:dns'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { installHostNetworkGuard } from './studio-chat-harness/fake-env.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
installHostNetworkGuard(net, dns)

let checks = 0, passed = 0
const failures = []
function check(label, fn) {
  const before = checks
  try { fn(); passed++; console.log(`ok   ${label} (${checks - before} asserts)`) } catch (error) { failures.push(`${label}: ${error.message.split('\n')[0]}`); console.log(`FAIL ${label}\n     ${error.message.split('\n').slice(0, 4).join('\n     ')}`) }
}
function mutant(label, run) {
  try { run() } catch { passed++; console.log(`ok   mutant caught: ${label}`); return }
  failures.push(`mutant survived: ${label}`); console.log(`FAIL mutant survived: ${label}`)
}
const ok = (condition, message) => { checks++; assert.ok(condition, message) }
const eq = (actual, expected, message) => { checks++; assert.deepEqual(actual, expected, message) }
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const swap = (text, from, to) => { assert.equal(text.split(from).length, 2, `exactly one ${JSON.stringify(from.slice(0, 80))}`); return text.replace(from, () => to) }

// ---- the recordings ------------------------------------------------------------------------------------------------------------------------------------------------------
const FIXTURE_PATH = 'scripts/studio-template-match-fixtures/frames-p47c.json'
const FIX = JSON.parse(read(FIXTURE_PATH))
const SC = FIX.scenarios
const SESSION = 's_p47_m'
const P47C_CAPS = ['mdc1', 'theme1', 'export1', 'element_refine1', 'element_edit1', 'notes1', 'bulk_edit1', 'mentions2', 'commands1', 'template_match1'] // Studio's client_caps as every recording carries them, template_match1 last
const inbound = (name, type) => SC[name].frames.filter(item => item.direction === 'in' && item.type === type)
const recorded = (name, seq) => { const item = SC[name].frames.find(frame => frame.seq === seq); assert.ok(item, `${name} seq ${seq}`); return item.frame }
const directorFrames = name => SC[name].frames.filter(item => item.type === 'template_match')
/** One real frame with one change (a field deleted or altered): for a NEGATIVE case or a precedence check, never evidence of what Director sends. */
const derive = (name, seq, edit) => { const copy = JSON.parse(JSON.stringify(recorded(name, seq))); edit(copy.payload); return copy }
const ENVELOPE_CAPS = P47C_CAPS.slice(0, -1) // Studio's list as the recordings carry it, without the new cap
const WORKSPACE_OUT = path.join(process.env.HOME || '', 'Deckster/.worktrees/frontend2-ws/streams/director2/p4-7-template-match/out')

// ---- evaluation of module text (the real files and the mutants) -----------------------------------------------------------------------------------------------------------
function compile(text, fileName) {
  const out = ts.transpileModule(text, { fileName, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, isolatedModules: true } })
  const errors = (out.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error)
  if (errors.length) throw new Error(`${fileName} does not transpile: ${ts.flattenDiagnosticMessageText(errors[0].messageText, '\n')}`)
  return out.outputText
}
const resolveRepo = spec => { const base = spec.slice(2); for (const ext of ['.ts', '.tsx']) if (fs.existsSync(path.join(root, base + ext))) return base + ext; throw new Error(`no repo file for ${spec}`) }
function makeLoader({ env = {}, window } = {}) {
  const cache = new Map()
  const load = rel => {
    if (cache.has(rel)) return cache.get(rel).exports
    const module = { exports: {} }
    cache.set(rel, module)
    const scope = { process: { env }, ...(window !== undefined ? { window } : {}) }
    new Function('module', 'exports', 'require', ...Object.keys(scope), compile(src(rel), rel))(module, module.exports, spec => requireFor(rel, spec), ...Object.values(scope))
    return module.exports
  }
  const requireFor = (from, spec) => {
    if (spec.startsWith('@/')) return load(resolveRepo(spec))
    if (['react', 'react/jsx-runtime'].includes(spec)) return require(spec)
    throw new Error(`unexpected import ${spec} in ${from}`)
  }
  return { load }
}

let ACTIVE = {} // a mutant's text, merged into every loader (set and restored by the mutants)
const src = rel => (rel in ACTIVE ? ACTIVE[rel] : read(rel))
const FLAG = 'NEXT_PUBLIC_STUDIO_TEMPLATE_MATCH'
const ON_ENV = { [FLAG]: 'true' }
const LIB = 'lib/studio-template-match.ts', HOOK = 'hooks/use-studio-template-match.ts'

/** A throwaway browser: localStorage (what the code wrote is counted). */
function fakeStorage(seed) {
  const map = new Map(seed ? Object.entries(seed) : [])
  const storage = { map, writes: 0, getItem: key => (map.has(key) ? map.get(key) : null), setItem: (key, value) => { storage.writes++; map.set(key, String(value)) } }
  return storage
}
function makeWorld({ env = ON_ENV, storage = fakeStorage() } = {}) {
  const window = { matchMedia: () => ({ matches: false }), localStorage: storage }
  const loader = makeLoader({ env, window })
  return { window, storage, lib: loader.load(LIB), hook: loader.load(HOOK), load: loader.load }
}

/** What a snapshot of the store draws, in the proof's terms. */
const viewOf = snapshot => ({
  reason: snapshot.frame ? snapshot.frame.reason : undefined,
  badge: snapshot.badge ? snapshot.badge.text : null,
  undo: snapshot.badge && snapshot.badge.undo ? snapshot.badge.undo : undefined,
  chips: Array.from({ length: 10 }, (_, i) => (snapshot.chips.get(i + 1) ? snapshot.chips.get(i + 1).text : null)),
  rows: snapshot.rows.map(row => [row.name, row.owner, row.inUse, row.coverage]),
})
function viewFromFrame(frame, lib) { // the lib's own derivations of a parsed frame, as the store draws them
  return { reason: frame.reason, badge: (b => (b ? b.text : null))(lib.templateBadge(frame)), undo: (b => (b && b.undo ? b.undo : undefined))(lib.templateBadge(frame)),
    chips: Array.from({ length: 10 }, (_, i) => (c => (c ? c.text : null))(lib.templateChips(frame).get(i + 1))), rows: lib.pickerRows(frame).map(row => [row.name, row.owner, row.inUse, row.coverage]) }
}

/** Studio's side of one recording: the socket opens (the preference goes out), then each recorded step is driven the way the UI drives it, and each Director frame is received. */
function replay(name, world = makeWorld()) {
  const { hook } = world
  hook.studioTemplateMatchStore.reset()
  const first = inbound(name, 'template_auto_apply')[0]
  if (first && first.frame.data.enabled === false) world.storage.map.set(world.lib.TEMPLATE_AUTO_APPLY_STORAGE_KEY, JSON.stringify({ u_test: false }))
  const sent = [], views = []
  const socket = { send: message => { sent.push(message); return true }, caps: () => ENVELOPE_CAPS }
  ok(hook.templateMatchSocketOpened({ sessionId: SESSION, userId: 'u_test', socket }), `${name}: the socket opened and the preference went out`)
  eq(sent.length, 1, `${name}: exactly one message at connect`)
  eq(sent[0].type, 'template_auto_apply', `${name}: ... a template_auto_apply, before any user_message`)
  let seenConnectStep = false
  for (const step of SC[name].frames) {
    if (step.direction === 'in' && step.type === 'template_auto_apply') { if (seenConnectStep) hook.setTemplateAutoApply(step.frame.data.enabled); seenConnectStep = true }
    else if (step.direction === 'in' && step.type === 'template_switch') hook.switchTemplate(step.frame.data.template_id)
    else if (step.type === 'template_match') {
      ok(hook.templateMatchFrameReceived(step.frame, SESSION), `${name} seq ${step.seq}: the recorded frame is taken`)
      views.push([`${name}:${step.seq}`, viewOf(hook.studioTemplateMatchStore.getSnapshot())])
    }
  }
  return { sent, views, world }
}

// ============================================================================================================================================
// A2. P4-7c (Director !611: matcher v2 and the strawman-level match): the mixed-template frames, M6 and M7. TESTS ONLY: the lib and the hook are read as they are on dev, and nothing here changes them (the flag stays off).
//     Every expectation was written from the recorded frames and DIRECTOR-2's README (streams/director2/p4-7-template-match/out/README.md, "v2: P4-7c"), then run against the REAL lib and the REAL hook.
//     The plan card sends ONE frame (the deck decision only: slides[] empty, no assignment). The strawman sends a SECOND one with slides[], deck[i].slides and assignment[] (Composer's mix-and-match plan); while assignment[]
//     is in force it drives slides[].applied_match, which is what Studio reads (assignment[] itself is not read). After a switch, "no template" or a whole-deck choice the frame has NO assignment key.
//     E1 the plan-card frame draws nothing; E2 the strawman frames draw the plan; E3 a switch draws the new template's own chips; E4 auto-apply off draws nothing; E5 turning it back on draws the plan again;
//     E6 parsing tolerates the new keys. F is the fixtures themselves (verbatim). The mutants of every one of them are in F below ("P4-7c").
// ============================================================================================================================================
const P47C = {
  files: { M6: 'scenario-M6-assignment.json', M7: 'scenario-M7-mixed.json' },
  sha256: { M6: '9aa9ee2e8737165a5d4992c84f9bf0fdb8c154bb01440a46431ef559bf6f5ff6', M7: '0c151b261c238a3b7e3553ad994b34ebfe289c656f94f53bb76ada73937cae8a' }, // the recordings' own sha256 (the originals in streams/director2/p4-7-template-match/out)
  bytes: { M6: 190836, M7: 142544 },
  frames: { M6: 'aad1bb0db3920d1c55cefada6d6419df9846996e53c423259b76a8edca49e9de', M7: '1ec2f1b53a3a53959aa8a1db6378a92b30ad259bd1c7d3695a2718fa1104f15f' }, // sha256 of JSON.stringify(the extracted frames): a frame edited in the fixture changes it, with or without the originals on disk
  steps: {
    M6: [[7, 'in', 'template_auto_apply'], [8, 'in', 'user_message'], [10, 'in', 'user_message'], [14, 'out', 'template_match'], [15, 'in', 'user_message'], [33, 'out', 'template_match'], [34, 'in', 'template_switch'], [35, 'out', 'template_match'], [36, 'in', 'template_auto_apply'], [37, 'out', 'template_match'], [38, 'in', 'template_auto_apply'], [39, 'out', 'template_match'], [40, 'in', 'user_message']],
    M7: [[7, 'in', 'template_auto_apply'], [8, 'in', 'user_message'], [10, 'in', 'user_message'], [14, 'out', 'template_match'], [15, 'in', 'user_message'], [39, 'out', 'template_match']],
  },
}
const P47C_NEW = 'New in your theme'
// the README's assignment tables (M6 and M7), slide by slide: what each rail thumbnail must say
const P47C_PLAN_M6 = ['Atlas Quarterly · slide 1', 'Atlas Quarterly · slide 4', 'Meridian Roadmap · slide 4', 'Atlas Quarterly · slide 6', P47C_NEW, 'Atlas Quarterly · slide 3', 'Meridian Roadmap · slide 4', 'Atlas Quarterly · slide 5', 'Meridian Roadmap · slide 2', 'Meridian Roadmap · slide 8']
const P47C_SWITCH_M6 = [P47C_NEW, P47C_NEW, 'Meridian Roadmap · slide 4', P47C_NEW, P47C_NEW, P47C_NEW, 'Meridian Roadmap · slide 4', P47C_NEW, 'Meridian Roadmap · slide 2', 'Meridian Roadmap · slide 8'] // Meridian's own four (s3, s7, s9, s10)
const P47C_MIX_M7 = ['Atlas Quarterly · slide 1', 'Meridian Roadmap · slide 3', 'Atlas Quarterly · slide 5', 'Meridian Roadmap · slide 2', 'Atlas Quarterly · slide 7', 'Harbor Review · slide 2', 'Meridian Roadmap · slide 3', 'Meridian Roadmap · slide 5', 'Atlas Quarterly · slide 6', 'Harbor Review · slide 3']
const p47cRowsM6 = inUse => [['Atlas Quarterly', 'Yours', inUse === 'atlas', '7 of 10 slides'], ['Meridian Roadmap', 'Yours', inUse === 'meridian', '6 of 10 slides'], ['No template', null, inUse === 'none', null]]
const P47C_ROWS_M7 = [['Atlas Quarterly', 'Yours', true, '5 of 10 slides'], ['Meridian Roadmap', 'Yours', false, '6 of 10 slides'], ['Harbor Review', 'Yours', false, '3 of 10 slides'], ['No template', null, false, null]]
const P47C_EXPECT = {
  'M6:14': { reason: 'match', badge: null, undo: undefined, chips: Array(10).fill(null), rows: p47cRowsM6('atlas') }, // the plan card
  'M6:33': { reason: 'match', badge: '9 slides use your templates', undo: undefined, chips: P47C_PLAN_M6, rows: p47cRowsM6('atlas') }, // the strawman, with assignment[]
  'M6:35': { reason: 'switch', badge: '4 slides use your templates', undo: { to: 'tpl_fake_atlas' }, chips: P47C_SWITCH_M6, rows: p47cRowsM6('meridian') }, // Change to Meridian: no assignment
  'M6:37': { reason: 'auto_apply_off', badge: null, undo: undefined, chips: Array(10).fill(null), rows: [] },
  'M6:39': { reason: 'match', badge: '9 slides use your templates', undo: undefined, chips: P47C_PLAN_M6, rows: p47cRowsM6('atlas') }, // auto-apply back on: the seq 33 result
  'M7:14': { reason: 'match', badge: null, undo: undefined, chips: Array(10).fill(null), rows: P47C_ROWS_M7 },
  'M7:39': { reason: 'match', badge: '10 slides use your templates', undo: undefined, chips: P47C_MIX_M7, rows: P47C_ROWS_M7 }, // three own templates on one deck
}
const P47C_DECK_KEYS = ['count_fit', 'audience_fit', 'depth_fit', 'decision_reason']
const p47cViews = name => Object.fromEntries(replay(name).views) // the real hook, the recorded steps in order: "M6:33" -> what the store draws
const p47cSeqs = name => directorFrames(name).map(step => step.seq)
const p47cDrawn = (lib, raw) => { const frame = lib.parseTemplateMatchFrame(raw); ok(frame, 'the frame is read'); return viewFromFrame(frame, lib) } // the lib's own draw of a raw frame (one that is not read is a failure)
const p47cTexts = chips => Array.from({ length: 10 }, (_, i) => (chips.get(i + 1) ? chips.get(i + 1).text : null))
const P47C_CHECKS = {} // by expectation key: the F mutants run exactly one of these against a mutated lib or hook
function p47c(key, label, fn) { P47C_CHECKS[key] = fn; check(`A. P4-7c ${key}: ${label}`, fn) }

/** F: the fixtures. The recordings verbatim: their sha256 and size, the steps in recorded order, a digest of the extracted frames, and the extraction redone from the original (when it is on disk and is the recording that was extracted). */
const p47cSha = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
function p47cExtractionSuite(name, s, bytes) { // the original is the recording that was extracted, and filtering it the way the extraction did gives the fixture's frames, verbatim
  eq([p47cSha(bytes), bytes.length], [s.sha256, s.bytes], `${name}: the original is the recording that was extracted`)
  const again = JSON.parse(bytes.toString('utf8')).frames.filter(step => step.direction === 'in' || step.type === 'template_match').map(({ seq, turn, direction, type, frame }) => ({ seq, turn, direction, type, frame }))
  eq(s.frames, again, `${name}: the extraction redone from the original is the fixture, verbatim`)
}
function p47cFixtureSuite(sc) {
  for (const name of ['M6', 'M7']) {
    const s = sc[name]
    eq([s.file, s.sha256, s.bytes, s.scenario, s.base_sha.slice(0, 12)], [P47C.files[name], P47C.sha256[name], P47C.bytes[name], name, 'ab236ac0c494'], `${name}: the recording's file, sha256, size, scenario and Director head (the P4-7c branch)`)
    eq(s.client_caps, P47C_CAPS, `${name}: Studio's client caps as in the v0 recordings, template_match1 last`)
    eq(s.frames.map(step => [step.seq, step.direction, step.type]), P47C.steps[name], `${name}: every inbound frame and every template_match, in recorded order`)
    eq(p47cSha(Buffer.from(JSON.stringify(s.frames))), P47C.frames[name], `${name}: the extracted frames are the frames that were extracted (nothing edited)`)
    const original = path.join(WORKSPACE_OUT, s.file)
    if (!fs.existsSync(original)) console.log(`NOTE A  ${s.file} is not on disk: the fixture was checked against its recorded digests only`)
    else if (p47cSha(fs.readFileSync(original)) !== s.sha256) console.log(`NOTE A  ${s.file} on disk is not the recording that was extracted (re-recorded?): the fixture was checked against its recorded digests only`)
    else p47cExtractionSuite(name, s, fs.readFileSync(original))
    // the extraction itself, on a made-up original (timing keys on every step, one frame of another kind): the same filter gives the fixture back
    const made = Buffer.from(JSON.stringify({ scenario: name, frames: [...s.frames.map(step => ({ ...step, t_ms: 1, dt_ms: 1 })), { seq: 999, turn: 9, direction: 'out', type: 'chat_message', frame: { type: 'chat_message' } }] }))
    p47cExtractionSuite(name, { ...s, sha256: p47cSha(made), bytes: made.length }, made)
  }
}
check('F. P4-7c fixtures: M6 and M7 are DIRECTOR-2\'s recordings, extracted verbatim (their sha256, the steps in order, a digest of the frames; the originals compared when on disk)', () => p47cFixtureSuite(SC))

p47c('E1', 'the plan-card frame (the deck decision: slides[] empty, no assignment) draws no badge and no chips (matchedSlideCount 0): M6 seq 14, M7 seq 14', () => {
  const lib = makeWorld().lib
  const views = { ...p47cViews('M6'), ...p47cViews('M7') }
  for (const key of ['M6:14', 'M7:14']) {
    const [name, seq] = key.split(':'), envelope = recorded(name, Number(seq)), payload = envelope.payload
    eq([payload.reason, payload.auto_apply, payload.applied, payload.applied_template.decision, payload.built_slide_ids, payload.slides], ['match', true, true, 'slides', [], []], `${key}: recorded: a match, applied at the slide level, nothing built, slides[] empty`)
    ok(!('assignment' in payload), `${key}: recorded: no assignment key`)
    ok(payload.deck.length >= 2 && payload.deck.every(item => item.decision === 'slides' && Array.isArray(item.slides) && item.slides.length === 0 && P47C_DECK_KEYS.every(k => k in item)), `${key}: recorded: every candidate is decided "slides", carries the new fit keys and has no slides of its own`)
    const frame = lib.parseTemplateMatchFrame(envelope)
    ok(frame, `${key}: the frame is read`)
    eq([lib.matchedSlideCount(frame), lib.templateBadge(frame), lib.templateChips(frame).size], [0, null, 0], `${key}: no slide matched: no badge and no chips`)
    eq(views[key], P47C_EXPECT[key], `${key}: through the real hook: nothing above the slide and nothing on the rail; the picker group still lists the candidates, the applied one "In use"`)
  }
})

p47c('E2', 'the strawman frame with assignment[]: the badge counts the rows whose applied_match is set ("<n> slides use your templates": M6 seq 33 -> 9, M7 seq 39 -> 10); each slide\'s chip is its applied_match.chip, "New in your theme" where it is null', () => {
  const lib = makeWorld().lib
  const views = { ...p47cViews('M6'), ...p47cViews('M7') }
  for (const [key, want] of [['M6:33', 9], ['M7:39', 10]]) {
    const [name, seq] = key.split(':'), envelope = recorded(name, Number(seq)), payload = envelope.payload
    ok(Array.isArray(payload.assignment) && payload.assignment.length === 10, `${key}: recorded: assignment[] of ten`)
    ok(payload.slides.length === 10 && payload.slides.every(row => 'applied_match' in row), `${key}: recorded: ten rows, the applied_match key on every one`)
    eq(payload.slides.filter(row => row.applied_match).length, want, `${key}: recorded: applied_match is set on ${want} rows`)
    eq([payload.reason, payload.auto_apply, payload.applied, payload.applied_template.name, payload.applied_template.decision, payload.built_slide_ids], ['match', true, true, 'Atlas Quarterly', 'slides', []], `${key}: recorded: applied (the best entry, Atlas) at the slide level, nothing built`)
    for (const row of payload.slides) eq(row.applied_match, payload.assignment.find(item => item.slide_id === row.slide_id).match, `${key} ${row.slide_id}: recorded: applied_match is the assignment's match (null where the plan has none)`)
    const frame = lib.parseTemplateMatchFrame(envelope), badge = lib.templateBadge(frame), chips = lib.templateChips(frame)
    eq([lib.matchedSlideCount(frame), badge.kind, badge.text, badge.name, badge.undo], [want, 'slides', `${want} slides use your templates`, 'Atlas Quarterly', null], `${key}: the badge counts the rows whose applied_match is set`)
    payload.slides.forEach((row, index) => { const chip = chips.get(index + 1); eq([chip.tone, chip.text], row.applied_match ? ['template', row.applied_match.chip] : ['theme', P47C_NEW], `${key} ${row.slide_id}: the chip is its applied_match.chip, or "New in your theme" where that is null`) })
    eq(p47cTexts(chips), P47C_EXPECT[key].chips, `${key}: the chips are the README's assignment table, slide by slide`)
    eq(views[key], P47C_EXPECT[key], `${key}: through the real hook: the badge, the chips and the group as the table says`)
  }
  // a MIX: templates other than the applied one are named, and the best-per-slide column is not what is drawn
  const names = key => new Set(P47C_EXPECT[key].chips.filter(text => text !== P47C_NEW).map(text => text.split(' · slide ')[0]))
  eq([...names('M6:33')].sort(), ['Atlas Quarterly', 'Meridian Roadmap'], 'M6 seq 33: two of the user\'s templates on one deck')
  eq([...names('M7:39')].sort(), ['Atlas Quarterly', 'Harbor Review', 'Meridian Roadmap'], 'M7 seq 39: three of the user\'s templates on one deck')
  eq([recorded('M7', 39).payload.slides[0].match.chip, views['M7:39'].chips[0]], ['Atlas Quarterly · slide 3', 'Atlas Quarterly · slide 1'], 'M7 s1: the best match across all candidates is Atlas slide 3, the plan puts Atlas slide 1: the plan is what is drawn')
  ok(recorded('M6', 33).payload.slides[4].match !== null && recorded('M6', 33).payload.slides[4].applied_match === null, 'M6 s5: recorded: a best match exists, the plan has none (today\'s build)')
  eq(views['M6:33'].chips[4], P47C_NEW, 'M6 s5: drawn "New in your theme"')
})

p47c('E3', 'M6 seq 35 (Change to Meridian: the frame has no assignment key): "4 slides use your templates", and Meridian\'s own chips, none of the plan\'s Atlas ones; Undo goes back to Atlas', () => {
  const lib = makeWorld().lib
  const views = p47cViews('M6')
  const sent = recorded('M6', 34), envelope = recorded('M6', 35), payload = envelope.payload
  eq([sent.type, sent.data.template_id], ['template_switch', 'tpl_fake_meridian'], 'M6 seq 34: recorded: the picker\'s Change to Meridian')
  ok(!('assignment' in payload), 'M6 seq 35: recorded: no assignment key after a switch')
  eq([payload.reason, payload.applied_template.name, payload.applied_template.decision, payload.previous_template_id, payload.built_slide_ids], ['switch', 'Meridian Roadmap', 'slides', 'tpl_fake_atlas', []], 'M6 seq 35: recorded: a switch to Meridian, Atlas before it, nothing built')
  const ids = rows => rows.map(row => row.slide_id)
  eq(ids(payload.slides.filter(row => row.applied_match)), ['s3', 's7', 's9', 's10'], 'recorded: applied_match is set on Meridian\'s four slides')
  ok(payload.slides.every(row => 'applied_match' in row && (!row.applied_match || row.applied_match.template_id === 'tpl_fake_meridian')), 'recorded: ... every one of them Meridian\'s own')
  eq(ids(payload.deck.find(item => item.template_id === 'tpl_fake_meridian').slides.filter(row => row.match)), ['s3', 's7', 's9', 's10'], 'recorded: Meridian\'s own list (deck[].slides) names the same four')
  const frame = lib.parseTemplateMatchFrame(envelope), badge = lib.templateBadge(frame), chips = lib.templateChips(frame)
  eq([badge.kind, badge.text, badge.name, badge.templateId, badge.undo], ['slides', '4 slides use your templates', 'Meridian Roadmap', 'tpl_fake_meridian', { to: 'tpl_fake_atlas' }], 'the badge counts Meridian\'s own four; Undo goes back to Atlas')
  eq(p47cTexts(chips), P47C_SWITCH_M6, 'Meridian\'s own chips: slides 3, 7, 9, 10 name Meridian, every other slide reads "New in your theme"')
  ok(!p47cTexts(chips).some(text => /Atlas/.test(text)), 'no Atlas chip is left once Meridian is chosen (the plan\'s Atlas slides are not carried over)')
  eq(views['M6:35'], P47C_EXPECT['M6:35'], 'through the real hook: the badge, Undo, the chips and the group (Meridian "In use")')
  eq(views['M6:33'].chips.map((text, i) => (text === views['M6:35'].chips[i] ? null : i + 1)).filter(Boolean), [1, 2, 4, 6, 8], 'against the plan (seq 33): exactly the slides the plan gave to Atlas changed (s5 had no match either way)')
})

p47c('E4', 'M6 seq 37 (auto-apply off): no badge, no chips and no group (off means no template), though the frame still carries assignment[] as a suggestion', () => {
  const lib = makeWorld().lib
  const views = p47cViews('M6')
  const envelope = recorded('M6', 37), payload = envelope.payload
  eq([payload.status, payload.reason, payload.auto_apply, payload.applied, payload.applied_template], ['matched', 'auto_apply_off', false, false, null], 'M6 seq 37: recorded: auto-apply off, nothing applied')
  ok(Array.isArray(payload.assignment) && payload.assignment.length === 10, 'recorded: assignment[] is back, as a suggestion')
  ok(payload.slides.length === 10 && payload.slides.every(row => row.match && 'applied_match' in row && row.applied_match === null), 'recorded: the best matches are listed, applied_match (the key) is null on every row')
  const frame = lib.parseTemplateMatchFrame(envelope)
  eq([lib.templateBadge(frame), lib.templateChips(frame).size, lib.pickerRows(frame)], [null, 0, []], 'no badge, no chips, no group')
  eq(views['M6:37'], P47C_EXPECT['M6:37'], 'through the real hook: nothing is drawn')
  // DERIVED from real frames by one change each: it is auto_apply and applied that decide, not the missing applied_match
  const off = lib.parseTemplateMatchFrame(derive('M6', 33, p => { p.auto_apply = false }))
  eq([lib.templateBadge(off), lib.templateChips(off).size, lib.pickerRows(off)], [null, 0, []], 'DERIVED (M6 seq 33 with auto_apply false, applied_match still on the rows): no badge, no chips, no group')
  const nothing = lib.parseTemplateMatchFrame(derive('M6', 33, p => { p.applied = false; p.applied_template = null }))
  eq([lib.templateBadge(nothing), lib.templateChips(nothing).size], [null, 0], 'DERIVED (M6 seq 33 with nothing applied, applied_match still on the rows): no badge, no chips')
})

p47c('E5', 'M6 seq 39 (auto-apply back on): the seq 33 result again, through the whole path 14, 33, 35, 37, 39; the store keeps nothing of the switch or the off frame', () => {
  const replayed = replay('M6'), views = Object.fromEntries(replayed.views)
  const a = recorded('M6', 33).payload, b = recorded('M6', 39).payload
  eq([recorded('M6', 36).data.enabled, recorded('M6', 38).data.enabled], [false, true], 'recorded: Studio turned auto-apply off (seq 36) and on again (seq 38)')
  const { previous_template_id: pa, ...restA } = a, { previous_template_id: pb, ...restB } = b
  eq([restB, pa, pb], [restA, null, 'tpl_fake_atlas'], 'recorded: seq 39 is seq 33 but for previous_template_id (null, then Atlas)')
  eq(Object.keys(views), ['M6:14', 'M6:33', 'M6:35', 'M6:37', 'M6:39'], 'five frames, in order')
  eq(Object.values(views).map(view => view.badge), [null, '9 slides use your templates', '4 slides use your templates', null, '9 slides use your templates'], 'the badge along the path')
  eq(views['M6:39'], views['M6:33'], 'seq 39 is drawn as seq 33 is')
  eq(views['M6:39'], P47C_EXPECT['M6:39'], 'seq 39: the plan\'s nine slide chips and "New in your theme" for s5, no Undo, Atlas "In use"')
  const store = replayed.world.hook.studioTemplateMatchStore.getSnapshot()
  eq([store.frame.reason, store.autoApply, store.badge.text, store.chips.size], ['match', true, '9 slides use your templates', 10], 'the store holds the latest frame, auto-apply on')
  eq(replayed.sent, SC.M6.frames.filter(step => step.direction === 'in' && (step.type === 'template_auto_apply' || step.type === 'template_switch')).map(step => step.frame), 'the four messages Studio sent are the recorded ones, verbatim (connect, switch, off, on)')
  eq(replayed.world.storage.writes, 2, 'the preference was written by the two toggles only, never by a frame')
})

p47c('E6', 'parsing tolerates the new keys (assignment[], count_fit / audience_fit / depth_fit, decision_reason, variety_penalty, and a scope) and does not reject version 1 frames that carry them; the draw is the same without them', () => {
  const lib = makeWorld().lib
  const FRAMES = [['M6', 14], ['M6', 33], ['M6', 35], ['M6', 37], ['M6', 39], ['M7', 14], ['M7', 39]]
  const keyOf = ([name, seq]) => `${name}:${seq}`
  eq([p47cSeqs('M6'), p47cSeqs('M7')], [[14, 33, 35, 37, 39], [14, 39]], 'recorded: the template_match frames of M6 and M7')
  eq(FRAMES.filter(([n, s]) => 'assignment' in recorded(n, s).payload).map(keyOf), ['M6:33', 'M6:37', 'M6:39', 'M7:39'], 'recorded: assignment[] is on the strawman frames and the auto-apply-off suggestion, not on the plan card or a switch')
  eq(FRAMES.filter(([n, s]) => (recorded(n, s).payload.assignment ?? []).length > 0 && recorded(n, s).payload.assignment.every(item => typeof item.variety_penalty === 'number')).map(keyOf), ['M6:33', 'M6:37', 'M6:39', 'M7:39'], 'recorded: variety_penalty is on every assignment entry')
  ok(FRAMES.every(([n, s]) => !('scope' in recorded(n, s).payload) && recorded(n, s).payload.deck.every(item => !('scope' in item))), 'recorded: scope is Director\'s request to Composer, not a frame key: no recorded frame carries it (the DERIVED cases below add it)')
  const stripNew = q => { delete q.assignment; delete q.scope; for (const item of q.deck) for (const k of P47C_DECK_KEYS) delete item[k] }
  for (const pair of FRAMES) {
    const [name, seq] = pair, key = keyOf(pair), envelope = recorded(name, seq), payload = envelope.payload
    eq(payload.version, 1, `${key}: recorded: version 1`)
    ok(payload.deck.every(item => P47C_DECK_KEYS.every(k => k in item)), `${key}: recorded: every candidate carries count_fit, audience_fit, depth_fit and decision_reason`)
    const frame = lib.parseTemplateMatchFrame(envelope)
    ok(frame, `${key}: a version 1 frame that carries the new keys is read`)
    eq(lib.parseTemplateMatchFrame(payload), frame, `${key}: ... and so is its bare payload, to the same frame`)
    eq([frame.status, frame.reason, frame.deck.length, frame.slides.length, frame.plan_id], [payload.status, payload.reason, payload.deck.length, payload.slides.length, payload.plan_id], `${key}: nothing is dropped`)
    eq(Object.keys(frame).sort(), ['applied', 'applied_template', 'auto_apply', 'built_slide_ids', 'deck', 'plan_id', 'previous_template_id', 'reason', 'slides', 'status'], `${key}: the parsed frame holds what Studio reads and none of the new keys`)
    const same = p47cDrawn(lib, envelope)
    eq(p47cDrawn(lib, derive(name, seq, stripNew)), same, `${key}: DERIVED (assignment, scope and the four fit keys deleted): the same badge, chips and group`)
    for (const scope of ['deck', 'both']) eq(p47cDrawn(lib, derive(name, seq, q => { q.scope = scope; for (const item of q.deck) item.scope = scope })), same, `${key}: DERIVED (scope "${scope}" added): the same`)
  }
  const base = p47cDrawn(lib, recorded('M6', 33))
  for (const junk of [null, 'x', 5, [], {}, [null, 5, { slide_id: 's1' }]]) eq(p47cDrawn(lib, derive('M6', 33, q => { q.assignment = junk })), base, `DERIVED (assignment ${JSON.stringify(junk)}): the same`)
  for (const junk of [null, 'high', -1, 2, {}]) eq(p47cDrawn(lib, derive('M6', 33, q => { for (const item of q.deck) { item.count_fit = junk; item.audience_fit = junk; item.depth_fit = junk; item.decision_reason = junk } })), base, `DERIVED (the fit keys and decision_reason ${JSON.stringify(junk)}): the same`)
  eq(p47cDrawn(lib, derive('M6', 33, q => { q.scope = { deck: true } })), base, 'DERIVED (scope not a string): the same')
  for (const [label, edit] of [['version 2', q => { q.version = 2 }], ['version "1"', q => { q.version = '1' }], ['no version', q => { delete q.version }]]) eq(lib.parseTemplateMatchFrame(derive('M6', 33, edit)), null, `ignored: ${label}, new keys or not`)
})

// ============================================================================================================================================
// Mutants: every one must be caught (the mutated text is made OUTSIDE the mutant: a mutant whose text is not found fails the proof, it is never counted as caught)
// ============================================================================================================================================
console.log("mutants")
// P4-7c (M6, M7): each mutant breaks one thing the A2 expectations say, and the check of that expectation (alone, in a copy of the lib or the hook with the mutant's text in place) must catch it
function p47cMutant(label, keys, rel, pairs) {
  let mutated = read(rel)
  for (const [from, to] of pairs) mutated = swap(mutated, from, to) // made OUTSIDE the mutant: a text that is not found fails the proof, it is never counted as caught
  for (const key of keys) mutant(`P4-7c ${key}: ${label}`, () => {
    ACTIVE = { [rel]: mutated }
    try { P47C_CHECKS[key]() } finally { ACTIVE = {} }
  })
}
const P47C_RULE2 = ['if (frame.slides.some(row => row.applied_match !== undefined)) { // 2.', 'if (false) { // 2.']
const P47C_RULE3 = ['if (item.slides) { // 3.', 'if (false) { // 3.']
const P47C_IN_USE = "frame.status === 'matched' && frame.auto_apply && frame.applied)"
const P47C_FRAME_OK = 'if (p.version !== TEMPLATE_MATCH_VERSION) return null\n'
// E1: the plan-card frame draws nothing
p47cMutant('a badge with no slide matched', ['E1'], LIB, [["return n > 0 ? { kind: 'slides'", "return n >= 0 ? { kind: 'slides'"]])
p47cMutant('the plan card\'s count is the candidate\'s covered number, not the slides drawn', ['E1'], LIB, [['if (own) return own.filter(row => row.match !== null).length', 'if (own) return appliedDeckItem(frame)?.covered ?? own.filter(row => row.match !== null).length']])
// E2: the strawman frame draws the plan (applied_match), not the best match per slide
p47cMutant('rule 2 (applied_match) dropped: the chips come from the applied candidate\'s own list', ['E2'], LIB, [P47C_RULE2])
p47cMutant('the count ignores applied_match (the applied candidate\'s own list is counted)', ['E2'], LIB, [['if (frame.slides.some(row => row.applied_match !== undefined)) return frame.slides.filter(row => row.applied_match).length', 'if (false) return frame.slides.filter(row => row.applied_match).length']])
p47cMutant('the count is the best match per slide, not the plan\'s', ['E2', 'E3'], LIB, [['return frame.slides.filter(row => row.applied_match).length', 'return frame.slides.filter(row => row.match).length']])
p47cMutant('a null applied_match is drawn as the best match, not "New in your theme"', ['E2', 'E3'], LIB, [['row.applied_match ? matchChip(row.applied_match, name) : themeChip()', 'row.applied_match ? matchChip(row.applied_match, name) : row.match ? matchChip(row.match, name) : themeChip()']])
p47cMutant('the chips are the best match per slide, not the plan\'s', ['E2', 'E3'], LIB, [['row.applied_match ? matchChip(row.applied_match, name) : themeChip()', 'row.match ? matchChip(row.match, name) : themeChip()']])
p47cMutant('a chip loses its own words and reads "From <applied template>"', ['E2', 'E3'], LIB, [['text: match.chip ?? `From ${fallbackName}` })', 'text: `From ${fallbackName}` })']])
// E3: after a switch the new template's own chips, no assignment, Undo to the old one
p47cMutant('rules 2 and 3 dropped: a switch draws the best match per slide (Atlas everywhere)', ['E3'], LIB, [P47C_RULE2, P47C_RULE3])
p47cMutant('a switch offers no Undo', ['E3'], LIB, [["['switch', 'chat_switch', 'undo']", "['chat_switch', 'undo']"]])
// E4: auto-apply off draws nothing
p47cMutant('auto-apply off is ignored', ['E4'], LIB, [[P47C_IN_USE, "frame.status === 'matched' && frame.applied)"]])
p47cMutant('whether anything is applied is ignored', ['E4'], LIB, [[P47C_IN_USE, "frame.status === 'matched' && frame.auto_apply)"]])
p47cMutant('chips are drawn whatever the state', ['E4'], LIB, [['if (!templateInUse(frame)) return chips', 'if (!frame) return chips']])
p47cMutant('the group is drawn with auto-apply off', ['E4'], LIB, [["return Boolean(frame && frame.status === 'matched' && frame.auto_apply && frame.deck.length > 0)", "return Boolean(frame && frame.status === 'matched' && frame.deck.length > 0)"]])
// E5: turning auto-apply back on draws the plan again; nothing sticks
p47cMutant('off is sticky: the frame after the off frame is not taken', ['E5'], HOOK, [['  const frame = parseTemplateMatchFrame(message)\n  if (!frame) return false\n', "  const frame = parseTemplateMatchFrame(message)\n  if (!frame) return false\n  if (snapshot.frame && snapshot.frame.reason === 'auto_apply_off' && snapshot.autoApply) return false\n"]])
p47cMutant('Undo is offered for any reason', ['E2', 'E5'], LIB, [['frame.previous_template_id === undefined || frame.reason === null || !TEMPLATE_UNDO_REASONS.includes(frame.reason)', 'frame.previous_template_id === undefined']])
p47cMutant('every frame writes the preference', ['E5'], LIB, [['return frame.auto_apply !== current ? frame.auto_apply : null', 'return frame.auto_apply']])
// E6: parsing tolerates the new keys
p47cMutant('any version taken', ['E6'], LIB, [[P47C_FRAME_OK, '']])
p47cMutant('a frame with an assignment is rejected', ['E2', 'E6'], LIB, [[P47C_FRAME_OK, "if (p.version !== TEMPLATE_MATCH_VERSION || 'assignment' in p) return null\n"]])
p47cMutant('a frame with a scope is rejected', ['E6'], LIB, [[P47C_FRAME_OK, "if (p.version !== TEMPLATE_MATCH_VERSION || 'scope' in p) return null\n"]])
p47cMutant('a candidate that carries the fit keys is dropped', ['E1', 'E6'], LIB, [['function parseDeckItem(value: unknown): TemplateMatchDeckItem | null {\n  if (!isRecord(value)) return null', "function parseDeckItem(value: unknown): TemplateMatchDeckItem | null {\n  if (!isRecord(value) || 'count_fit' in value) return null"]])
// F: the fixtures
{
  const tampered = edit => { const copy = JSON.parse(JSON.stringify(SC)); edit(copy); return copy }
  mutant('P4-7c F: a recorded frame edited in the fixture (one chip of M6 seq 33)', () => p47cFixtureSuite(tampered(sc => { sc.M6.frames.find(step => step.seq === 33).frame.payload.slides[0].applied_match.chip += '!' })))
  mutant('P4-7c F: a recorded frame dropped from the fixture (M7 seq 39)', () => p47cFixtureSuite(tampered(sc => { sc.M7.frames = sc.M7.frames.filter(step => step.seq !== 39) })))
  mutant('P4-7c F: a recorded step moved (M6 seq 35 before seq 33)', () => p47cFixtureSuite(tampered(sc => { const f = sc.M6.frames; const i = f.findIndex(step => step.seq === 33); [f[i], f[i + 2]] = [f[i + 2], f[i]] })))
  mutant('P4-7c F: the extraction differs from the original it names (one value edited, the original\'s own sha256 and size)', () => {
    const made = Buffer.from(JSON.stringify({ frames: SC.M6.frames })), edited = JSON.parse(JSON.stringify(SC.M6))
    edited.frames.find(step => step.seq === 33).frame.payload.status = 'no_match'
    p47cExtractionSuite('M6', { ...edited, sha256: p47cSha(made), bytes: made.length }, made)
  })
  mutant('P4-7c F: the declared sha256 of a recording changed', () => p47cFixtureSuite(tampered(sc => { sc.M7.sha256 = '0'.repeat(64) })))
}

// ============================================================================================================================================
console.log(`\n${failures.length ? 'FAIL' : 'PASS'}  studio template match P4-7c: ${passed} checks and mutants passed, ${failures.length} failed (${checks} asserts)`)
for (const failure of failures) console.log(`  - ${failure}`)
process.exit(failures.length ? 1 : 0)
