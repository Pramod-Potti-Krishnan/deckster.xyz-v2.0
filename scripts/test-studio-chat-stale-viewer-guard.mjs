// FRONTEND-2 (B43, 28 Oct; E2E-2 batch 2, rows 34, 35, 36, Studio dev, deck 017fa691, 21:42-22:07Z): proof of the stale viewer guard, a chat element ADD or EDIT after Director changed the deck on the server lands on the slide it means or says so, an add is Done only once it is stored,
// and Reload deck recovers (NEXT_PUBLIC_STUDIO_CHAT_STALE_VIEWER_GUARD, exact "true", default off, build-time). Stacked on #546 (NEXT_PUBLIC_STUDIO_CHAT_ADD_TARGETED_SAVE).
//
//   node scripts/test-studio-chat-stale-viewer-guard.mjs                                 # offline: the viewer's replies and Layout's server answers come from scripts/fixtures/chat-stale-viewer-guard/layout-transcripts.json, recorded from Layout's real code
//   CHAT_STALE_VIEWER_GUARD_LAYOUT_DIR=<layout-builder at frontend2/layout-targeted-save> CHAT_STALE_VIEWER_GUARD_LAYOUT_PYTHON=<a Python with Layout's requirements> node scripts/test-studio-chat-stale-viewer-guard.mjs
//                                                                                        # also runs the REAL Layout viewer code and the REAL Layout server live and checks they say what was recorded
//   ... --record-layout                                                                  # (with the variables) re-records the fixture
// (CHAT_ADD_TARGETED_LAYOUT_DIR / CHAT_ADD_TARGETED_LAYOUT_PYTHON and CHAT_EDIT_TARGETED_LAYOUT_DIR / _PYTHON, #546's and #540's names, are taken too.)
//
// THE DEFECT, on Layout's real server. Director changes the stored deck through Layout's routes; the viewer in the iframe is a snapshot nobody told. A chat add inserts into the VIEWER's slide at Director's index and the editor's autosave PUTs the whole deck: server.py update_all_slides applies
// slides[i] of the body to the stored slide i BY INDEX, wholesale, with no slide id, version or deck-changed check. It answers 200 and writes the old deck over the new one (a new slide holds a neighbour's layout text, a swapped slide holds its old content), and Director says "Done".
// The sticky "viewer not ready" is components/presentation-viewer.tsx's last save status ('error' after a lost save) that a reloaded viewer never replaces: captureStudioElementGeneration() answers null while it is 'error'.
// What it proves (the numbered checks below): 1 the flag; 2 the root cause, flags off; 3 #546 alone (Layout's 409 SLIDE_CHANGED: it can fail, it cannot land on the wrong slide); 4 the edits (#538 / #540 / #522); 5 the guard, add; 6 the guard with #546; 7 no server change: nothing changes;
// 8 a lost save is never Done; 9 the sticky not-ready and Reload deck; 10 honest refusals (unsaved work, a busy or never-loading viewer); 11 a change that lands after the check; 12 the guard, edit; 13 the guard's own rules; 14 flag off is identical;
// 15 mutants; 16 scope over the COMMITTED diff, GATE-SAFE and robust after merge.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { createGuardWorld, PRESENTATION, plain, STUDIO_ORIGIN, KEEPALIVE_LIMIT_BYTES } from './studio-chat-stale-viewer-guard-world.mjs'
import {
  BASE_COMMIT, CHAT_STALE_VIEWER_GUARD_FILES, CHAT_STALE_VIEWER_GUARD_NEW_FILES, CHAT_STALE_VIEWER_GUARD_PIN_FILES, CHAT_STALE_VIEWER_GUARD_SCOPE_FILES, CHAT_STALE_VIEWER_GUARD_ENV_BLOCK,
  CHAT_STALE_VIEWER_GUARD_MARKER_RE, CHAT_STALE_VIEWER_GUARD_PIN_EDITS, CHAT_STALE_VIEWER_GUARD_PIN_MARK, CHAT_STALE_VIEWER_GUARD_SUBJECT, stripChatStaleViewerGuard,
} from './studio-chat-stale-viewer-guard-strip.mjs'
import { stripChatAddTargeted } from './studio-chat-add-targeted-strip.mjs'
import { stripChatParity } from './studio-chat-parity-strip.mjs'
import { stripChatElementEdit2 } from './studio-chat-element-edit-2-strip.mjs'
import * as registry from './studio-later-changes.mjs'

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const TRANSCRIPTS = path.join(root, 'scripts/fixtures/chat-stale-viewer-guard/layout-transcripts.json')
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const HOOK = 'hooks/use-textlabs-generation.ts', VIEWER = 'components/presentation-viewer.tsx', PAGE = 'app/builder/page.tsx', LIB = 'lib/chat-stale-viewer-guard.ts'
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] })

const RECORD = process.argv.includes('--record-layout')
const envOf = (...names) => names.map(name => process.env[name]).find(Boolean)
const LAYOUT_DIR = envOf('CHAT_STALE_VIEWER_GUARD_LAYOUT_DIR', 'CHAT_ADD_TARGETED_LAYOUT_DIR', 'CHAT_EDIT_TARGETED_LAYOUT_DIR') ? path.resolve(envOf('CHAT_STALE_VIEWER_GUARD_LAYOUT_DIR', 'CHAT_ADD_TARGETED_LAYOUT_DIR', 'CHAT_EDIT_TARGETED_LAYOUT_DIR')) : null
const PYTHON = envOf('CHAT_STALE_VIEWER_GUARD_LAYOUT_PYTHON', 'CHAT_ADD_TARGETED_LAYOUT_PYTHON', 'CHAT_EDIT_TARGETED_LAYOUT_PYTHON') ?? null
const LIVE = Boolean(LAYOUT_DIR)
if (RECORD && !LIVE) throw new Error('--record-layout needs CHAT_STALE_VIEWER_GUARD_LAYOUT_DIR')
if (LIVE && !PYTHON) throw new Error('the live run needs CHAT_STALE_VIEWER_GUARD_LAYOUT_PYTHON (a Python with layout-builder\'s requirements) for Layout\'s own server')
const recorded = RECORD ? { meta: {}, scenarios: {} } : JSON.parse(fs.readFileSync(TRANSCRIPTS, 'utf8'))

let passed = 0
const failed = []
async function check(label, fn) {
  if (process.env.CHECK_ONLY && !label.includes(process.env.CHECK_ONLY)) return
  try { await fn(); passed++; console.log(`PASS ${label}`) } catch (error) { failed.push(label); console.error(`FAIL ${label}: ${error?.stack?.split('\n').slice(0, 5).join(' | ') ?? error}`) }
}
let caught = 0
const missed = []
async function mutant(label, run) {
  if (process.env.CHECK_ONLY) return
  try { await run(); missed.push(label); console.error(`MISSED mutant ${label}`) } catch { caught++; console.log(`CAUGHT mutant ${label}`) }
}

// ---- the deck, the flags, the scenario ----------------------------------------------------------------------------------------------------
const FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_STALE_VIEWER_GUARD'
const SHELL = { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_TEXT_LABS_URL: 'https://textlabs.synthetic.test', NEXT_PUBLIC_ELEMENTOR_URL: 'https://textlabs.synthetic.test', NEXT_PUBLIC_STUDIO_INSERT_PERSIST: 'true' }
const EDIT_ENV = { NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT: 'true', NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT_2: 'true' }
const FLAGS = {
  off: { ...SHELL },
  t546: { ...SHELL, NEXT_PUBLIC_STUDIO_CHAT_ADD_TARGETED_SAVE: 'true' },
  guard: { ...SHELL, [FLAG]: 'true' },
  both: { ...SHELL, [FLAG]: 'true', NEXT_PUBLIC_STUDIO_CHAT_ADD_TARGETED_SAVE: 'true' },
  edit: { ...SHELL, ...EDIT_ENV },
  t540: { ...SHELL, ...EDIT_ENV, NEXT_PUBLIC_STUDIO_CHAT_EDIT_TARGETED_SAVE: 'true' },
  'edit+guard': { ...SHELL, ...EDIT_ENV, [FLAG]: 'true' },
  't540+guard': { ...SHELL, ...EDIT_ENV, NEXT_PUBLIC_STUDIO_CHAT_EDIT_TARGETED_SAVE: 'true', [FLAG]: 'true' },
}
const TITLES = ['Cover', 'Where we lose', 'Plan', 'Cost', 'Close']
/** A stored text box (the record auto-save collects), with an id that is the same on every load: slide L1 holds note_l1, slide L3 holds note_l3. `pad` makes a whole-deck body pass Chromium's 64 KiB keepalive budget. */
const NOTE = (id, slide, pad = 0) => ({ id, parent_slide_id: slide, slot_name: null, component_type: 'TEXT_BOX', theme_variant_id: null, theme_bindings: null, style_owner: null, theme_variant_source: 'element_generation', frame_owner: 'layout', metrics_color_variant: null,
  research_provenance: null, generation_config: null, semantic_role: 'BODY_TEXT', slot_kind: null, accessory_type: null, position: { grid_row: '10/14', grid_column: '2/12' }, z_index: 1, content: `<p>Note ${id}${'x'.repeat(pad)}</p>`,
  style: { background_color: 'transparent', border_color: 'transparent', border_width: 0, border_radius: 0, opacity: 1, box_shadow: 'none', padding_top: 0, padding_right: 0, padding_bottom: 0, padding_left: 0, display: 'flex', flex_direction: 'column', justify_content: 'flex-start', align_items: 'flex-start' },
  locked: false, visible: true, text_style: { color: '#1f2937', font_family: 'Inter, system-ui, -apple-system, sans-serif', font_size: '32px', line_height: '1.5' } })
const storedDeck = ({ pad = 0 } = {}) => ({ id: PRESENTATION, title: 'T', slides: TITLES.map((title, i) => ({ layout: 'C1', slide_id: `L${i}`, content: { slide_title: title }, text_boxes: i === 1 ? [NOTE('note_l1', 'L1')] : i === 3 ? [NOTE('note_l3', 'L3', pad)] : [], images: [] })) })
/** The same deck with NO slide ids (an old deck, from before slide ids): the slides carry no slide_id at all. `note`: a stored text box on slide 2 ("Where we lose"), for the edit. */
const idlessDeck = ({ layout = 'C1', note = false } = {}) => ({ id: PRESENTATION, title: 'T', slides: TITLES.map((title, i) => ({ layout, content: { slide_title: title }, text_boxes: note && i === 1 ? [NOTE('note_l1', null)] : [], images: [] })) })
const textOf = html => String(html ?? '').replace(/<[^>]*>/g, '')
/** Layout text stored on a slide that is not the one it was drawn for: a title box whose text is not the title of the slide it is stored on (the whole-deck PUT applies slides[i] to stored slide i, and an id-less deck has no id to say no). */
const foreignIdless = deck => deck.slides.flatMap(slide => (slide.text_boxes || []).filter(box => /-title$/.test(box.id) && !textOf(box.content).includes(slide.content.slide_title)).map(box => `${slide.content.slide_title}<-${textOf(box.content).slice(0, 14)}`))
const titleAt = (deck, title) => deck.slides.findIndex(slide => slide.content.slide_title === title)
const titlesOf = deck => deck.slides.map(slide => slide.content.slide_title)
const FRAME = JSON.parse(read('scripts/fixtures/studio-job-ledger/directive-never-answered.json')).directive_and_running_row[0] // Director's recorded element_directive
assert.equal(FRAME.type, 'element_directive')
const EDIT_FRAME = JSON.parse(read('scripts/fixtures/chat-element-edit/director-frames/01-delete-ok.json')).frames_out.flat().find(frame => frame.type === 'element_edit') // Director's recorded element_edit
assert.equal(EDIT_FRAME.type, 'element_edit')
let counter = 0
const directive = (type, slideIndex) => ({ ...plain(FRAME.payload), directive_id: `el_g${++counter}`, element_type: type, prompt: 'Add a note: fresh produce turnover is the biggest lever', slide_index: slideIndex, grid_hint: null })
const editFrame = (slideIndex, slideId, elementId = 'note_l1') => ({ ...plain(EDIT_FRAME), message_id: `msg_g${++counter}`, payload: { ...plain(EDIT_FRAME.payload), directive_id: `ele_g${counter}`, slide_index: slideIndex, slide_id: slideId, element_id: elementId, op: 'style', style: { bold: true } } })
const CHANGES = ['none', 'addEnd', 'addMid', 'dup', 'del', 'undo', 'swap']
const STALE_AT_TARGET = ['addMid', 'dup', 'del', 'undo'] // the stored slide at the target's index (or the slide itself) is not the one the viewer shows there
const NOTE_RE = /^(L\d+|note_l\d+|slide_[0-9a-f]+)/
/** The slide a stored text box belongs to, by the id it was given (layout text: `<slide id>_textbox_<hash>`; the notes: note_l<N>). */
const ownerOf = id => (id.startsWith('note_l') ? `L${id.slice(6)}` : id.startsWith('slide_') ? id.split('_').slice(0, 2).join('_') : id.split('_')[0])
const foreignOf = deck => deck.slides.flatMap(slide => (slide.text_boxes || []).filter(box => NOTE_RE.test(box.id) && ownerOf(box.id) !== slide.slide_id).map(box => `${slide.slide_id}<-${box.id.slice(0, 12)}`))
const whereIs = (deck, id) => deck.slides.filter(slide => (slide.text_boxes || []).some(box => box.id === id)).map(slide => slide.slide_id)
const WHOLE_DECK = new RegExp(`/api/presentations/${PRESENTATION}/slides$`)
const CHAT_SAVE = /\/elements\/[^/]+\/chat-save$/
const putsTo = (fetches, re) => fetches.filter(item => item.method === 'PUT' && re.test(item.url))
const hashOf = value => sha(JSON.stringify(value))
const chatBoxes = deck => deck.slides.flatMap(slide => (slide.text_boxes || []).filter(box => /^textbox-/.test(box.id)).map(box => `${slide.slide_id}:${box.id}`))

/**
 * One scenario, run in a world (live Layout code, or its recording) and read as a snapshot. `fn(world)` drives it and returns what it likes. Recorded and replayed by name; a mutated one (overrides) runs live when there is a checkout and replays `transcriptFrom` otherwise.
 * The snapshot: viewers (every viewer's requests and frames), calls (Layout's server: Director's changes and Studio's reads), viewerCalls (what the viewer asked it), deck (stored at the end), fetches, sent (the result frames), notes, reloads, out.
 */
async function scenario(name, { flags = 'off', stored = storedDeck(), base = false, overrides = {}, transcriptFrom = null, viewerPutStatus = 200, reloadMs, read: readOverride = null }, fn) {
  counter = 0 // directive ids are the same on every run of a scenario, whatever ran before it
  const mutated = Object.keys(overrides).length > 0 || base || Boolean(readOverride) || name.startsWith('mutant-')
  const key = transcriptFrom ?? name
  if (!LIVE && !recorded.scenarios[key]) throw new Error(`a recorded Layout transcript for "${key}" (record with CHAT_STALE_VIEWER_GUARD_LAYOUT_DIR=... --record-layout)`)
  const env = typeof flags === 'string' ? FLAGS[flags] : flags
  const world = await createGuardWorld({ root, layoutDir: LAYOUT_DIR, python: PYTHON, env, overrides, stored, base, viewerPutStatus, ...(reloadMs ? { reloadMs } : {}), ...(readOverride ? { read: readOverride } : {}), ...(LIVE ? {} : { recording: recorded.scenarios[key] }) })
  const out = await fn(world)
  const snap = {
    viewers: plain(world.transcripts()), calls: plain(world.calls().filter(c => c.kind !== 'viewer')), viewerCalls: plain(world.calls().filter(c => c.kind === 'viewer').map(c => ({ kind: c.kind, requests: c.requests.map(r => ({ method: r.method, url: r.url })), statuses: c.statuses, bodies: c.bodies }))), deck: plain(world.deck()), deckLog: plain(world.deckLog()), fetches: plain(world.fetches()),
    sent: plain(world.sent), notes: world.consoleNotes, reloads: world.reloads.slice(), actions: world.actions(), toasts: plain(world.toasts), out: plain(out ?? null),
  }
  if (RECORD && !mutated) recorded.scenarios[name] = snap
  if (LIVE && !RECORD && !mutated) {
    const was = recorded.scenarios[name]
    assert.deepEqual(snap.viewers.map(v => v.requests), was.viewers.map(v => v.requests), `${name}: the live viewers were asked what was recorded`)
    assert.deepEqual(snap.viewers.map(v => v.frames), was.viewers.map(v => v.frames), `${name}: the live viewers answered what was recorded`)
    assert.deepEqual(snap.calls, was.calls, `${name}: Layout's server answered Director's changes and Studio's reads as recorded`)
    assert.deepEqual(snap.viewerCalls, was.viewerCalls, `${name}: Layout's server answered the viewer's saves as recorded`)
    assert.deepEqual(snap.fetches, was.fetches, `${name}: the live viewers saved what was recorded`)
    assert.deepEqual(snap.deckLog, was.deckLog, `${name}: Layout held the recorded deck at every read`)
    assert.deepEqual(snap.deck, was.deck, `${name}: Layout stored what was recorded`)
    assert.deepEqual(snap.sent, was.sent, `${name}: Studio answered Director as recorded`)
    assert.deepEqual(snap.notes, was.notes, `${name}: the same notes`)
  }
  if (!LIVE) {
    const was = recorded.scenarios[key]
    world.viewers().forEach((viewer, index) => { assert.equal(viewer.log.requests.length, was.viewers[index].requests.length, `${name}: every recorded request of viewer ${index + 1} was made (no more, no fewer)`); assert.equal(viewer.log.divergence, null, `${name}: no request diverged from the recording`) })
    assert.equal(world.viewers().length, was.viewers.length, `${name}: the same number of viewers (reloads)`)
    assert.equal(world.calls().length, was.calls.length, `${name}: every recorded call to Layout was made`)
    if (!mutated) { assert.deepEqual(plain(world.sent), was.sent, `${name}: Studio over the recorded replies answers Director as recorded`); assert.deepEqual(world.reloads, was.reloads) }
    Object.assign(snap, { fetches: was.fetches, viewerCalls: was.viewerCalls })
  }
  return { world, snap }
}

/** An add on the slide L2 ("Plan") after Director's `change`: the directive carries the server's index of that slide. */
async function addAfter(change, flags, extra = {}, drive = null) {
  return scenario(`add-${flags}-${change}${extra.suffix ?? ''}`, { flags, ...extra }, async world => {
    await world.change(change)
    const before = plain(world.deck())
    drive?.(world)
    const index = world.indexOf('L2')
    const result = await world.add(directive('TEXT_BOX', index))
    return { before, index, result }
  })
}
const summary = ({ snap }) => ({ result: snap.out.result, foreign: foreignOf(snap.deck), onSlide: snap.out.result.element_id ? whereIs(snap.deck, snap.out.result.element_id) : [], reloads: snap.reloads.length,
  whole: putsTo(snap.fetches, WHOLE_DECK), targeted: putsTo(snap.fetches, CHAT_SAVE), statuses: snap.viewerCalls.map(c => c.statuses[0]) })

// ===== 1. the flag ======================================================================================================================
function loadLib(env, overrides = {}) {
  const text = overrides[LIB] ?? read(LIB)
  const out = ts.transpileModule(text, { fileName: LIB, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  vm.runInNewContext(out, { module, exports: module.exports, process: { env }, Promise, Error, Set, Array, Boolean, Date, setTimeout }, { filename: LIB })
  return module.exports
}
import ts from 'typescript'
const swap = (text, from, to) => { assert.ok(text.includes(from), `mutant anchor: ${from.slice(0, 60)}`); return text.replace(from, () => to) }
const libText = read(LIB)
await check('flag: on only for the exact "true" of NEXT_PUBLIC_STUDIO_CHAT_STALE_VIEWER_GUARD (it needs no other flag); .env.example has the block after a blank line', async () => {
  assert.equal(loadLib({ [FLAG]: 'true' }).CHAT_STALE_VIEWER_GUARD_ENABLED, true)
  assert.equal(loadLib({}).CHAT_STALE_VIEWER_GUARD_ENABLED, false)
  for (const value of ['1', 'TRUE', 'yes', ' true', 'True', '']) assert.equal(loadLib({ [FLAG]: value }).CHAT_STALE_VIEWER_GUARD_ENABLED, false, value)
  const env = read('.env.example')
  assert.ok(env.includes(`\n\n${CHAT_STALE_VIEWER_GUARD_ENV_BLOCK}`), 'the .env.example block, after a blank line')
  assert.ok(env.includes(`${FLAG}="false"\n`))
  assert.equal(env.split(CHAT_STALE_VIEWER_GUARD_ENV_BLOCK).length - 1, 1)
})

// ===== 2. the root cause, flags off (today): Layout answers 200 and writes the old deck over the new one; Director says Done ==============================
const offRuns = {}
const rootRows = []
for (const change of CHANGES) {
  await check(`root cause (flags off): a chat add on slide "Plan" after Director's "${change}" is ONE whole-deck PUT that Layout answers 200 (it has no slide id, version or deck-changed check), the result is inserted (Done)${['none', 'addEnd'].includes(change) ? ', and nothing is overwritten (the change did not move the slide the viewer shows)' : ', and layout text and content of OTHER slides are written onto the wrong ones'}`, async () => {
    const run = await addAfter(change, 'off')
    offRuns[change] = run
    const s = summary(run)
    assert.equal(s.result.status, 'inserted'); assert.ok(s.result.element_id)
    assert.equal(s.whole.length, 1, 'one whole-deck save'); assert.equal(s.targeted.length, 0)
    assert.deepEqual(s.statuses, [200], 'Layout answers 200: not a refusal, whatever the viewer holds')
    assert.equal(s.whole[0].body.slides[0].slide_id, 'L0', 'the body names each slide by id, and carries no version'); assert.ok(!s.whole[0].body.keys.includes('version'))
    if (!['none', 'addEnd'].includes(change)) assert.ok(run.snap.deck.slides.some(slide => slide.content.slide_id && slide.content.slide_id !== slide.slide_id), 'Layout ignores the ids and applies slides[i] to stored slide i: a slide stores another slide\'s id in its content')
    assert.equal(s.reloads, 0)
    if (['none', 'addEnd'].includes(change)) assert.deepEqual(s.foreign, [])
    else assert.ok(s.foreign.length > 0, `${change}: ${s.foreign.length} text boxes of one slide stored on another`)
    rootRows.push([change, s.result.status, s.statuses.join(','), s.foreign.length, s.onSlide.join(',')])
  })
}
console.log('\nROOT CAUSE (flags off; the add targets slide "Plan" = L2, at the index the server has it)')
console.log('| Director changed the deck by | result | Layout\'s answer | layout text stored on the wrong slide | chat element stored on |\n|---|---|---|---|---|')
for (const row of rootRows) console.log(`| ${row.join(' | ')} |`)
console.log('')

// ===== 3. #546 alone: it can fail, it cannot land on the wrong slide =====================================================================
const t546Runs = {}
for (const change of CHANGES) {
  await check(`#546 alone (Layout's chat-save checks the slide id): after "${change}" the add ${STALE_AT_TARGET.includes(change) ? 'is refused by Layout (409 SLIDE_CHANGED) and fails honestly, and nothing is stored anywhere' : 'is stored on slide "Plan" and nothing else'}`, async () => {
    const run = await addAfter(change, 't546')
    t546Runs[change] = run
    const s = summary(run)
    assert.equal(s.whole.length, 0, 'no whole-deck save'); assert.equal(s.targeted.length, 1, 'one chat-save'); assert.deepEqual(s.foreign, [], 'nothing on a wrong slide, ever')
    assert.equal(s.reloads, 0)
    if (STALE_AT_TARGET.includes(change)) {
      assert.deepEqual(s.statuses, [409]); assert.equal(run.snap.viewerCalls[0].bodies[0].detail.code, 'SLIDE_CHANGED')
      assert.equal(s.result.status, 'failed'); assert.match(s.result.error, /could not be saved on its own, so it was not kept/)
      assert.deepEqual(run.snap.out.before.slides.map(slide => slide.slide_id), run.snap.deck.slides.map(slide => slide.slide_id)); assert.equal(hashOf(run.snap.deck), hashOf(run.snap.out.before), 'the stored deck is exactly what it was')
    } else {
      assert.deepEqual(s.statuses, [200]); assert.equal(s.result.status, 'inserted'); assert.deepEqual(s.onSlide, ['L2'])
      assert.equal(s.targeted[0].url, `/api/presentations/${PRESENTATION}/slides/${run.snap.out.index}/elements/${s.result.element_id}/chat-save`)
    }
  })
}

// ===== 4. the edits, #538 / #540 / #522 ===================================================================================================
const editRun = (flags, change) => scenario(`edit-${flags}-${change}`, { flags }, async world => {
  await world.change(change)
  const before = plain(world.deck())
  const index = world.indexOf('L1')
  const result = await world.edit(editFrame(index, 'L1'))
  return { before, index, result }
})
const editRuns = {}
for (const flags of ['edit', 't540']) for (const change of ['none', 'addMid', 'undo', 'swap']) {
  await check(`edit, ${flags === 'edit' ? 'whole-deck save (#522)' : 'targeted save (#540)'}, no guard, after "${change}": ${['addMid', 'undo'].includes(change) ? 'the viewer does not hold the element on that slide, so ok:false ELEMENT_NOT_FOUND and nothing is saved (it cannot land on another element)' : change === 'swap' && flags === 'edit' ? 'ok:true, and the stale whole-deck save writes the old slide content over the slide Director swapped' : 'ok:true, saved on slide "Where we lose" only'}`, async () => {
    const run = await editRun(flags, change)
    editRuns[`${flags}-${change}`] = run
    const { result } = run.snap.out
    const whole = putsTo(run.snap.fetches, WHOLE_DECK), targeted = putsTo(run.snap.fetches, CHAT_SAVE)
    assert.equal(run.snap.reloads.length, 0)
    if (['addMid', 'undo'].includes(change)) { assert.deepEqual(plain(result), { directive_id: result.directive_id, ok: false, error_code: 'ELEMENT_NOT_FOUND' }); assert.equal(whole.length + targeted.length, 0); assert.equal(hashOf(run.snap.deck), hashOf(run.snap.out.before)) }
    else {
      assert.equal(result.ok, true)
      if (flags === 'edit') { assert.equal(whole.length, 1); assert.equal(targeted.length, 0) } else { assert.equal(whole.length, 0); assert.equal(targeted.length, 1); assert.match(targeted[0].url, /\/slides\/1\/elements\/note_l1\/chat-save$/) }
      if (change === 'swap' && flags === 'edit') assert.ok(foreignOf(run.snap.deck).length > 0, 'the swapped slide holds the old slide\'s content')
      else assert.deepEqual(foreignOf(run.snap.deck), [])
    }
  })
}

// ===== 5. the guard, add ===================================================================================================================
const guardRuns = {}
for (const change of CHANGES) {
  await check(`guard on, after "${change}": ${change === 'none' ? 'the viewer already shows the server\'s deck, so it is NOT reloaded' : 'the viewer is reloaded onto the server\'s deck first'}, and the add is stored on slide "Plan" (by id), with no layout text of any slide on another one`, async () => {
    const run = await addAfter(change, 'guard')
    guardRuns[change] = run
    const s = summary(run)
    assert.equal(s.result.status, 'inserted'); assert.deepEqual(s.onSlide, ['L2']); assert.deepEqual(s.foreign, [])
    assert.equal(s.reloads, change === 'none' ? 0 : 1)
    assert.equal(s.whole.length, 1); assert.equal(s.whole[0].viewer, change === 'none' ? 1 : 2, 'saved by the viewer that shows the server\'s deck')
    assert.deepEqual(s.statuses, [200])
    const titles = deck => Object.fromEntries(deck.slides.map(slide => [slide.slide_id, slide.content.slide_title]))
    const was = titles(run.snap.out.before), now = titles(run.snap.deck)
    for (const [id, title] of Object.entries(was)) assert.equal(now[id], title, `${id} keeps its content`)
    assert.deepEqual(run.snap.deck.slides.map(slide => slide.slide_id), run.snap.out.before.slides.map(slide => slide.slide_id), 'no slide added, lost or moved by the add')
    const actions = run.snap.actions
    assert.ok(actions.indexOf('composeGetState') >= 0 && actions.indexOf('composeGetState') < actions.indexOf('insertTextBox'), 'the viewer was asked for its slide ids before the insert')
    const reads = run.snap.calls.filter(c => c.kind === 'studio'); assert.ok(reads.length >= 1 && reads.every(c => c.requests[0].method === 'GET' && /\/slides\/inventory$/.test(c.requests[0].url)), 'Studio read Layout\'s slide inventory (GET only)')
  })
}
console.log('\nGUARD ON (add on slide "Plan"):')
console.log('| Director changed the deck by | reloads | result | chat element stored on | layout text on the wrong slide | saved by |\n|---|---|---|---|---|---|')
for (const change of CHANGES) { const s = summary(guardRuns[change] ?? { snap: { out: { result: { status: '?' } }, deck: { slides: [] }, fetches: [], viewerCalls: [], reloads: [] } }); console.log(`| ${change} | ${s.reloads} | ${s.result.status} | ${s.onSlide.join(',')} | ${s.foreign.length} | ${s.whole[0] ? `whole-deck PUT of viewer ${s.whole[0].viewer}` : ''} |`) }
console.log('')

// ===== 6. the guard with #546 ===============================================================================================================
const bothRuns = {}
for (const change of CHANGES) {
  await check(`guard + #546, after "${change}": ${change === 'none' ? 'no reload' : 'one reload'}, then ONE chat-save for the new element at the server's index of "Plan" (200); no whole-deck save; every other slide exactly as stored`, async () => {
    const run = await addAfter(change, 'both')
    bothRuns[change] = run
    const s = summary(run)
    assert.equal(s.result.status, 'inserted'); assert.deepEqual(s.onSlide, ['L2']); assert.deepEqual(s.foreign, [])
    assert.equal(s.reloads, change === 'none' ? 0 : 1); assert.equal(s.whole.length, 0); assert.equal(s.targeted.length, 1); assert.deepEqual(s.statuses, [200])
    assert.equal(s.targeted[0].url, `/api/presentations/${PRESENTATION}/slides/${run.snap.out.index}/elements/${s.result.element_id}/chat-save`); assert.equal(s.targeted[0].body.slide_id, 'L2', 'addressed by the slide id Layout holds')
    run.snap.deck.slides.forEach((slide, i) => { if (slide.slide_id !== 'L2') assert.equal(hashOf(slide), hashOf(run.snap.out.before.slides[i]), `slide ${slide.slide_id} is exactly as stored`) })
    assert.equal(run.snap.deck.slides.find(slide => slide.slide_id === 'L2').text_boxes.length, run.snap.out.before.slides.find(slide => slide.slide_id === 'L2').text_boxes.length + 1)
  })
}

// ===== 7. no server change: nothing changes ==================================================================================================
await check('no server-side change: the guard asks Layout\'s inventory and the viewer for its slide ids (reads only), never reloads, and the add makes the same insert, the same save and the same stored deck as flag off (hash-equal)', async () => {
  const off = offRuns.none, on = guardRuns.none
  assert.equal(on.snap.reloads.length, 0)
  const strip = snap => snap.viewers[0].requests.map(item => [item.action, item.params]).filter(([action]) => action !== 'composeGetState')
  assert.equal(hashOf(strip(on.snap)), hashOf(strip(off.snap)), 'the same viewer commands once composeGetState is left out')
  assert.equal(on.snap.viewers[0].requests.filter(item => item.action === 'composeGetState').length, 1)
  assert.equal(hashOf(on.snap.fetches.map(f => [f.method, f.url, f.body])), hashOf(off.snap.fetches.map(f => [f.method, f.url, f.body])), 'the same saves')
  assert.equal(hashOf(on.snap.deck), hashOf(off.snap.deck), 'the same stored deck')
  assert.equal(hashOf({ ...on.snap.out.result, directive_id: 0, element_id: 0 }), hashOf({ ...off.snap.out.result, directive_id: 0, element_id: 0 }))
  const writes = on.snap.calls.filter(c => c.requests.some(r => r.method !== 'GET')).length; assert.equal(writes, 0, 'Studio wrote nothing to Layout')
})

// ===== 8. a lost save is never Done ==========================================================================================================
const FAT = storedDeck({ pad: 70_000 }) // a deck whose whole-deck body passes Chromium's 64 KiB keepalive budget (auto-save.js says it happens at about ten real slides)
const HIDE_AFTER_MS = 1_000
const guardEnvWithoutPersist = { ...SHELL, [FLAG]: 'true', NEXT_PUBLIC_STUDIO_INSERT_PERSIST: 'false' }
const lostSave = (name, flags, { putStatus = 200, hide = false } = {}) => scenario(name, { flags, stored: FAT, viewerPutStatus: putStatus }, async world => {
  if (hide) world.hideTabSoon(HIDE_AFTER_MS)
  const before = plain(world.deck())
  const result = await world.add(directive('TEXT_BOX', 2))
  return { before, result, status: world.viewerState.saveStatus, lease: Boolean(world.lease()) }
})
await check('the lost save of E2E-2, flags off: the viewer\'s save is refused (the editor\'s whole-deck PUT answered 500), the add is still reported inserted (Done) and nothing is stored, the viewer\'s status stays error', async () => {
  const run = await lostSave('lost-put-off', 'off', { putStatus: 500 })
  assert.equal(run.snap.out.result.status, 'inserted'); assert.deepEqual(whereIs(run.snap.deck, run.snap.out.result.element_id), []); assert.equal(hashOf(run.snap.deck), hashOf(run.snap.out.before))
  assert.equal(run.snap.out.status, 'error')
})
await check('the lost save of E2E-2, flags off: the tab is hidden before the debounce (visibilitychange: flushPendingChanges {keepalive: true}), Chromium refuses a keepalive body over 64 KiB with a TypeError, nothing reaches Layout, the pending save is cancelled, the add is still inserted (Done), and the status is error', async () => {
  const run = await lostSave('lost-hidden-off', 'off', { hide: true })
  const keep = run.snap.fetches.filter(f => f.keepalive)
  assert.equal(keep.length, 1); assert.ok(keep[0].bytes > KEEPALIVE_LIMIT_BYTES, `a ${keep[0].bytes} byte body`)
  assert.equal(run.snap.viewerCalls.length, 0, 'nothing reached Layout (the stored deck is unchanged, as E2E-2\'s GET showed)'); assert.equal(hashOf(run.snap.deck), hashOf(run.snap.out.before))
  assert.equal(run.snap.out.result.status, 'inserted'); assert.equal(run.snap.out.status, 'error')
  assert.equal(run.snap.fetches.filter(f => !f.keepalive && f.method === 'PUT').length, 0, 'the debounced save never ran: the flush cancelled it')
})
await check('guard on, whole-deck path: a refused save (500) fails the add (status failed with the reason, never inserted), the element is taken off the viewer again, and nothing is stored', async () => {
  const run = await lostSave('lost-put-guard', 'guard', { putStatus: 500 })
  assert.equal(run.snap.out.result.status, 'failed'); assert.match(run.snap.out.result.error, /the save did not land, so it was not kept/); assert.ok(!run.snap.out.result.element_id)
  assert.equal(hashOf(run.snap.deck), hashOf(run.snap.out.before))
  assert.ok(run.snap.actions.includes('deleteElement'), 'the unsaved element is removed again')
})
await check('guard on, the hidden tab: the add waits for the viewer\'s acknowledgement, gets error, and fails (status failed, never inserted)', async () => {
  const run = await lostSave('lost-hidden-guard', 'guard', { hide: true })
  assert.equal(run.snap.out.result.status, 'failed'); assert.match(run.snap.out.result.error, /the save did not land, so it was not kept/)
  assert.deepEqual(chatBoxes(run.snap.deck), [], 'the element is stored nowhere (the rollback\'s own save stores the viewer as it is, without it)')
})
await check('the viewer is not in edit mode (INSERT-PERSIST off: Layout\'s autosave drops every change made outside it): flags off the add is inserted (Done) and is never saved; guard on it fails (the autosave never took it) and nothing is stored', async () => {
  const flags = guardEnvWithoutPersist
  const off = await scenario('no-persist-off', { flags: { ...SHELL, NEXT_PUBLIC_STUDIO_INSERT_PERSIST: 'false' } }, async world => ({ result: await world.add(directive('TEXT_BOX', 2)) }))
  assert.equal(off.snap.out.result.status, 'inserted'); assert.deepEqual(chatBoxes(off.snap.deck), []); assert.equal(off.snap.fetches.filter(f => f.method === 'PUT').length, 0)
  const on = await scenario('no-persist-guard', { flags }, async world => ({ result: await world.add(directive('TEXT_BOX', 2)) }))
  assert.equal(on.snap.out.result.status, 'failed'); assert.match(on.snap.out.result.error, /the save did not land, so it was not kept/); assert.deepEqual(chatBoxes(on.snap.deck), [])
})
await check('guard + #546, a refused commit: the add fails as #546 already does (never inserted), nothing stored; the guard adds nothing', async () => {
  const run = await scenario('lost-commit-both', { flags: 'both' }, async world => {
    const before = plain(world.deck())
    world.onCommand = action => { if (action === 'insertTextBox') world.change('addMid') } // Layout moves a slide under the add
    return { before, result: await world.add(directive('TEXT_BOX', 2)) }
  })
  assert.equal(run.snap.out.result.status, 'failed'); assert.deepEqual(foreignOf(run.snap.deck), []); assert.deepEqual(putsTo(run.snap.fetches, CHAT_SAVE).length, 1)
  assert.deepEqual(run.snap.viewerCalls.map(c => c.statuses[0]), [409])
  assert.deepEqual(whereIs(run.snap.deck, 'x'), [])
  assert.equal(run.snap.deck.slides.every(slide => !(slide.text_boxes || []).some(box => /^textbox-/.test(box.id))), true, 'the element is stored on no slide')
})

// ===== 9. the sticky "viewer not ready", and Reload deck =======================================================================================
const stickyRun = (name, flags) => scenario(name, { flags, stored: FAT, viewerPutStatus: 500 }, async world => {
  const first = await world.add(directive('TEXT_BOX', 2)) // the save is refused: it is lost (flags off: still reported inserted)
  world.setPutStatus(200) // Layout is back
  const statusAfterLoss = world.viewerState.saveStatus
  const leaseBefore = Boolean(world.lease())
  world.reload(); await world.settle(5_000) // the user's Reload deck (the page's reload: a new viewer loads the server's deck)
  const statusAfterReload = world.viewerState.saveStatus
  const leaseAfter = Boolean(world.lease())
  const second = await world.add(directive('TEXT_BOX', 2))
  return { first, statusAfterLoss, leaseBefore, statusAfterReload, leaseAfter, second, ids: world.deck().slides.find(slide => slide.slide_id === 'L2').text_boxes.map(box => box.id) }
})
await check('sticky not-ready, flags off (E2E-2): after a lost save the viewer\'s status is error and the lease is null; Reload deck loads a new viewer, the status stays error, the lease stays null, and every later add answers "The presentation viewer is not ready" (rows 35, 36)', async () => {
  const run = await stickyRun('sticky-off', 'off')
  const o = run.snap.out
  assert.equal(o.statusAfterLoss, 'error'); assert.equal(o.leaseBefore, false)
  assert.equal(o.statusAfterReload, 'error', 'the new document posted nothing: the old status stays'); assert.equal(o.leaseAfter, false)
  assert.equal(o.second.status, 'failed'); assert.match(o.second.error, /The presentation viewer is not ready\. Wait for it to load before generating an element\./)
  assert.equal(run.snap.reloads.length, 1)
})
await check('sticky not-ready, guard on: the same loss; Reload deck clears it (the new frame ends the document\'s old status), the lease is back, and the next add is stored on slide "Plan"', async () => {
  const run = await stickyRun('sticky-guard', 'guard')
  const o = run.snap.out
  assert.equal(o.first.status, 'failed')
  assert.equal(o.statusAfterLoss, 'error'); assert.equal(o.statusAfterReload, 'saved'); assert.equal(o.leaseAfter, true)
  assert.equal(o.second.status, 'inserted'); assert.deepEqual(o.ids.filter(id => id === o.second.element_id), [o.second.element_id], 'stored on L2')
})

// ===== 10. honest refusals =====================================================================================================================
await check('guard on, the deck changed AND this tab holds a failed save: not reloaded (it would drop the user\'s edits); the add is answered failed with the reason; Layout is only read; the edit is answered ok:false SLIDE_CHANGED', async () => {
  const run = await scenario('refuse-unsaved', { flags: 'edit+guard', stored: FAT }, async world => {
    world.hideTabSoon(HIDE_AFTER_MS)
    await world.add(directive('TEXT_BOX', 2)) // inserted (flag on: failed), leaves the status error
    world.setSaveStatus('error')
    await world.change('addMid')
    const before = plain(world.deck())
    const add = await world.add(directive('TEXT_BOX', world.indexOf('L2')))
    const edit = await world.edit(editFrame(world.indexOf('L1'), 'L1'))
    return { before, add, edit }
  })
  assert.equal(run.snap.reloads.length, 0, 'never reloaded over unsaved edits')
  assert.equal(run.snap.out.add.status, 'failed'); assert.match(run.snap.out.add.error, /still holds edits that are not saved/)
  assert.equal(run.snap.out.edit.ok, false); assert.equal(run.snap.out.edit.error_code, 'SLIDE_CHANGED')
  assert.equal(hashOf(run.snap.deck), hashOf(run.snap.out.before), 'Layout was changed by nothing')
  assert.ok(run.snap.calls.filter(c => c.kind === 'studio').every(c => c.requests[0].method === 'GET'))
  assert.equal(run.snap.actions.filter(action => action === 'insertTextBox').length, 1, 'only the first add reached the viewer')
})
await check('guard on, the viewer shows the right deck but a failed save is still in its status: the add is answered failed with the way out (Save changes now, or Reload deck) instead of "not ready"', async () => {
  const run = await scenario('refuse-fresh-error', { flags: 'guard' }, async world => { world.setSaveStatus('error'); return { result: await world.add(directive('TEXT_BOX', 2)) } })
  assert.equal(run.snap.out.result.status, 'failed'); assert.match(run.snap.out.result.error, /A save in this tab failed earlier/); assert.ok(!run.snap.actions.includes('insertTextBox')); assert.equal(run.snap.sent.length, 1, 'answered once: the runner is not called after a refusal')
})
await check('guard on, a busy viewer (a save or slide change that never ends) and a stale deck: nothing is reloaded, the add is answered failed (busy) after the budget; a viewer that never loads the server\'s deck: failed (did not show the deck in time), nothing inserted', async () => {
  const busy = await scenario('refuse-busy', { flags: 'guard' }, async world => { await world.change('addMid'); world.introSafetyRef.current = { ...world.introSafetyRef.current, isSaving: true }; return { result: await world.add(directive('TEXT_BOX', world.indexOf('L2')), { settleMs: 1 }) } })
  assert.equal(busy.snap.out.result.status, 'failed'); assert.match(busy.snap.out.result.error, /busy/); assert.equal(busy.snap.reloads.length, 0); assert.ok(!busy.snap.actions.includes('insertTextBox'))
  const slow = await scenario('refuse-never-loads', { flags: 'guard', reloadMs: 120_000 }, async world => { await world.change('addMid'); return { result: await world.add(directive('TEXT_BOX', world.indexOf('L2')), { settleMs: 1 }) } })
  assert.equal(slow.snap.out.result.status, 'failed'); assert.match(slow.snap.out.result.error, /did not show the changed deck in time/); assert.equal(slow.snap.reloads.length, 1); assert.ok(!slow.snap.actions.includes('insertTextBox'))
})

// ===== 11. a change that lands after the check =================================================================================================
await check('a slide is added by Director AFTER the guard checked and before the targeted save commits (guard + #546): Layout answers 409 SLIDE_CHANGED, the add fails honestly, nothing is on a wrong slide (the guard never claims the deck stays put)', async () => {
  const run = await scenario('race-both', { flags: 'both' }, async world => {
    await world.change('addEnd') // the viewer is stale, so the guard reloads first
    world.onCommand = action => { if (action === 'insertTextBox') world.change('addMid') }
    const before = plain(world.deck())
    return { before, result: await world.add(directive('TEXT_BOX', world.indexOf('L2'))) }
  })
  assert.equal(run.snap.reloads.length, 1); assert.equal(run.snap.out.result.status, 'failed'); assert.deepEqual(foreignOf(run.snap.deck), [])
  assert.deepEqual(run.snap.viewerCalls.map(c => c.statuses[0]), [409])
})

// ===== 12. the guard, edit ====================================================================================================================
for (const flags of ['edit+guard', 't540+guard']) for (const change of ['addMid', 'undo', 'swap']) {
  await check(`guard on, edit (${flags === 'edit+guard' ? 'whole-deck save' : 'targeted save'}) after "${change}": the viewer is reloaded first, the edit finds its element and is ok:true; ${flags === 't540+guard' ? 'one chat-save at the server\'s index' : 'one whole-deck save by the reloaded viewer'}; no layout text on a wrong slide`, async () => {
    const run = await editRun(flags, change)
    const { result } = run.snap.out
    assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(run.snap.reloads.length, 1)
    assert.deepEqual(foreignOf(run.snap.deck), [])
    const whole = putsTo(run.snap.fetches, WHOLE_DECK), targeted = putsTo(run.snap.fetches, CHAT_SAVE)
    if (flags === 't540+guard') { assert.equal(whole.length, 0); assert.equal(targeted.length, 1); assert.equal(targeted[0].url, `/api/presentations/${PRESENTATION}/slides/${run.snap.out.index}/elements/note_l1/chat-save`); assert.equal(targeted[0].body.slide_id, 'L1') }
    else { assert.equal(whole.length, 1); assert.equal(whole[0].viewer, 2) }
    const note = run.snap.deck.slides.find(slide => slide.slide_id === 'L1').text_boxes.find(box => box.id === 'note_l1')
    assert.ok(note, 'the note is on slide "Where we lose"'); assert.equal(whereIs(run.snap.deck, 'note_l1').join(), 'L1')
    assert.ok(note.text_style && note.text_style.font_weight, 'the bold is in the stored note')
  })
}
await check('guard on, edit with no server change: no reload, and the edit saves exactly as without the guard (hash-equal saves and stored deck)', async () => {
  const on = await editRun('t540+guard', 'none'), off = await editRun('t540', 'none')
  assert.equal(on.snap.reloads.length, 0); assert.equal(on.snap.out.result.ok, true)
  assert.equal(hashOf(on.snap.fetches.map(f => [f.method, f.url, f.body])), hashOf(off.snap.fetches.map(f => [f.method, f.url, f.body])))
  assert.equal(hashOf(on.snap.deck), hashOf(off.snap.deck))
})

await check('an edit is ok:true only after its save (the viewer\'s acknowledgement, #522; the targeted commit, #540): a refused save answers ok:false SAVE_FAILED with the guard off and on, and nothing is stored', async () => {
  for (const flags of ['edit', 'edit+guard']) {
    const run = await scenario(`edit-lost-put-${flags}`, { flags, viewerPutStatus: 500 }, async world => { const before = plain(world.deck()); return { before, result: await world.edit(editFrame(world.indexOf('L1'), 'L1')) } })
    assert.deepEqual([run.snap.out.result.ok, run.snap.out.result.error_code], [false, 'SAVE_FAILED'], flags)
    assert.equal(hashOf(run.snap.deck), hashOf(run.snap.out.before), `${flags}: nothing is stored`)
  }
})

// ===== 12b. a deck whose slides have no ids ====================================================================================================
// Where they come from (Layout read-only): an old stored deck (from before slide ids; migrations/add_slide_ids.py backfills only when run, server.py:4029 only in the cleanup route), a slide stored under a legacy `id` key (the inventory reads slide_id only), a duplicate
// made with LAYOUT_SLIDE_THUMBNAILS_ENABLED off (server.py:4590-4596 copies its source's id). The viewer then draws the slide a TEMPORARY id of its own (direct-element-creator.js:657-669) and legacy `slide-N-slot` ids; Layout's inventory has a null slide_id, which Studio's
// parseSlideInventory rejects: nothing to compare by id.
const idlessAdd = (change, flags, { layout = 'C1', suffix = '' } = {}, drive = null) => scenario(`idless-add-${flags}-${change}${suffix}`, { flags, stored: idlessDeck({ layout }) }, async world => {
  await world.change(change)
  const before = plain(world.deck())
  drive?.(world)
  const index = titleAt(world.deck(), 'Plan')
  const result = await world.add(directive('TEXT_BOX', index))
  return { before, index, result }
})
const IDLESS_CHANGES = ['none', 'addMid', 'dup', 'del', 'undo']
const idlessRows = []
for (const change of IDLESS_CHANGES) {
  await check(`id-less deck, flags off (today), after "${change}": ONE whole-deck PUT answered 200 and the result is inserted (Done); ${change === 'none' ? 'nothing is overwritten (the viewer shows the deck)' : 'layout text of other slides is written onto the wrong slides (the index is all there is)'}`, async () => {
    const run = await idlessAdd(change, 'off')
    const s = { result: run.snap.out.result, foreign: foreignIdless(run.snap.deck), whole: putsTo(run.snap.fetches, WHOLE_DECK), statuses: run.snap.viewerCalls.map(c => c.statuses[0]) }
    assert.equal(s.result.status, 'inserted'); assert.equal(s.whole.length, 1); assert.deepEqual(s.statuses, [200]); assert.equal(run.snap.reloads.length, 0)
    if (change === 'none') assert.deepEqual(s.foreign, []); else assert.ok(s.foreign.length > 0, `${change}: ${s.foreign.length} title boxes on the wrong slide`)
    idlessRows.push([change, s.result.status, s.statuses.join(','), s.foreign.length])
  })
}
console.log('\nID-LESS DECK (flags off; the add targets slide "Plan")')
console.log('| Director changed the deck by | result | Layout\'s answer | title boxes on the wrong slide |\n|---|---|---|---|')
for (const row of idlessRows) console.log(`| ${row.join(' | ')} |`)
console.log('')
for (const change of IDLESS_CHANGES) {
  await check(`id-less deck, #546 alone, after "${change}": the viewer's temporary slide id is not the stored (none): Layout answers 409 SLIDE_CHANGED every time (even with no change), the add fails honestly and nothing is stored anywhere`, async () => {
    const run = await idlessAdd(change, 't546')
    assert.equal(run.snap.out.result.status, 'failed'); assert.match(run.snap.out.result.error, /could not be saved on its own, so it was not kept/)
    assert.deepEqual(run.snap.viewerCalls.map(c => c.statuses[0]), [409]); assert.equal(run.snap.viewerCalls[0].bodies[0].detail.code, 'SLIDE_CHANGED')
    assert.deepEqual(chatBoxes(run.snap.deck), []); assert.deepEqual(foreignIdless(run.snap.deck), [])
    assert.equal(hashOf(titlesOf(run.snap.deck)), hashOf(titlesOf(run.snap.out.before)))
  })
}
const idlessGuardRuns = {}
for (const change of IDLESS_CHANGES) {
  await check(`id-less deck, guard on, after "${change}": nothing can be compared by id, so the viewer is reloaded onto Layout's deck FIRST (Layout's signature the same before and after), and the add is stored on slide "Plan" only, no title box on a wrong slide, every title where it was`, async () => {
    const run = await idlessAdd(change, 'guard')
    idlessGuardRuns[change] = run
    const result = run.snap.out.result
    assert.equal(result.status, 'inserted')
    assert.deepEqual(run.snap.deck.slides.filter(slide => (slide.text_boxes || []).some(box => box.id === result.element_id)).map(slide => slide.content.slide_title), ['Plan'], 'stored on slide "Plan" and no other')
    assert.deepEqual(foreignIdless(run.snap.deck), []); assert.equal(hashOf(titlesOf(run.snap.deck)), hashOf(titlesOf(run.snap.out.before)))
    assert.equal(run.snap.reloads.length, 1, 'an id-less deck is always reloaded first')
    assert.equal(putsTo(run.snap.fetches, WHOLE_DECK).length, 1); assert.equal(putsTo(run.snap.fetches, WHOLE_DECK)[0].viewer, 2, 'saved by the reloaded viewer')
    const signatures = run.snap.calls.filter(c => c.kind === 'studio' && /\/slides\/inventory$/.test(c.requests[0].url)); assert.ok(signatures.length >= 3, 'Layout\'s inventory was read before the reload, after it and before the insert')
  })
}
for (const change of ['none', 'addMid', 'undo']) {
  await check(`id-less deck, guard + #546, after "${change}": reloaded first; the targeted save is still refused by Layout (409: the viewer's temporary id is not a stored id), so the add fails honestly, nothing stored, nothing on a wrong slide`, async () => {
    const run = await idlessAdd(change, 'both')
    assert.equal(run.snap.reloads.length, 1); assert.equal(run.snap.out.result.status, 'failed'); assert.deepEqual(run.snap.viewerCalls.map(c => c.statuses[0]), [409])
    assert.deepEqual(chatBoxes(run.snap.deck), []); assert.deepEqual(foreignIdless(run.snap.deck), [])
  })
}
await check('id-less deck, a slide that has no element to hold the targeted save with (a hero slide: #546 falls back to the editor\'s whole-deck save), guard + #546, after "addMid": reloaded first, and the add is stored on slide "Plan" only', async () => {
  const run = await idlessAdd('addMid', 'both', { layout: 'H1', suffix: '-H1' })
  assert.equal(run.snap.reloads.length, 1); assert.equal(run.snap.out.result.status, 'inserted')
  const where = run.snap.deck.slides.filter(slide => (slide.text_boxes || []).some(box => box.id === run.snap.out.result.element_id)).map(slide => slide.content.slide_title)
  assert.deepEqual(where, ['Plan']); assert.equal(putsTo(run.snap.fetches, WHOLE_DECK).length, 1); assert.equal(putsTo(run.snap.fetches, CHAT_SAVE).length, 0)
})
await check('id-less deck, Director changes the deck AFTER the guard proved the viewer and BEFORE the insert (while the element is being made): the signature is read again before the insert, differs, and the add stops there (status failed, nothing inserted, nothing stored)', async () => {
  const run = await scenario('idless-race-guard', { flags: 'guard', stored: idlessDeck() }, async world => {
    let fired = false
    world.onCommand = action => { if (action === 'getSlideGenerationContext' && !fired) { fired = true; world.change('addMid') } }
    const before = plain(world.deck())
    return { before, result: await world.add(directive('TEXT_BOX', titleAt(world.deck(), 'Plan'))) }
  })
  assert.equal(run.snap.reloads.length, 1); assert.equal(run.snap.out.result.status, 'failed'); assert.match(run.snap.out.result.error, /was changed while the element was being made/)
  assert.ok(!run.snap.actions.includes('insertTextBox'), 'nothing was inserted'); assert.deepEqual(chatBoxes(run.snap.deck), []); assert.equal(putsTo(run.snap.fetches, WHOLE_DECK).length, 0)
})
const idlessEdit = (name, flags, change) => scenario(name, { flags, stored: idlessDeck({ note: true }) }, async world => {
  await world.change(change)
  const before = plain(world.deck())
  const index = titleAt(world.deck(), 'Where we lose')
  const frame = editFrame(index, 'L1'); frame.payload.slide_id = null
  return { before, index, result: await world.edit(frame) }
})
await check('id-less deck, an edit after "addMid": flags off, ok:false ELEMENT_NOT_FOUND (the viewer\'s slide at that index is another slide); guard on (whole-deck save), the viewer is reloaded first and the edit is ok:true on slide "Where we lose" only; guard + #540, Layout refuses the temporary id (409) and the edit is ok:false SAVE_FAILED: never ok for a save that did not land, never on another slide', async () => {
  const off = await idlessEdit('idless-edit-edit-addMid', 'edit', 'addMid')
  assert.deepEqual([off.snap.out.result.ok, off.snap.out.result.error_code], [false, 'ELEMENT_NOT_FOUND']); assert.equal(off.snap.fetches.length, 0)
  const on = await idlessEdit('idless-edit-guard-addMid', 'edit+guard', 'addMid')
  assert.equal(on.snap.out.result.ok, true); assert.equal(on.snap.reloads.length, 1); assert.deepEqual(foreignIdless(on.snap.deck), [])
  const where = on.snap.deck.slides.filter(slide => (slide.text_boxes || []).some(box => box.id === 'note_l1' && box.text_style?.font_weight)).map(slide => slide.content.slide_title); assert.deepEqual(where, ['Where we lose'])
  const targeted = await idlessEdit('idless-edit-t540guard-addMid', 't540+guard', 'addMid')
  assert.deepEqual([targeted.snap.out.result.ok, targeted.snap.out.result.error_code], [false, 'SAVE_FAILED']); assert.deepEqual(targeted.snap.viewerCalls.map(c => c.statuses[0]), [409]); assert.equal(targeted.snap.reloads.length, 1)
  assert.equal(hashOf(titlesOf(targeted.snap.deck)), hashOf(titlesOf(targeted.snap.out.before))); assert.ok(!targeted.snap.deck.slides.some(slide => (slide.text_boxes || []).some(box => box.text_style?.font_weight)), 'nothing stored on any slide')
})

// ===== 13. the guard's own rules (lib/chat-stale-viewer-guard.ts, with stand-in deps) =========================================================
const stub = (over = {}) => {
  let time = 0, reloads = 0, shown = ['a', 'b', 'c'], server = ['a', 'x', 'b', 'c']
  const deps = { readServerSlideIds: async () => server, readViewerSlideIds: async () => shown, viewerSaveState: () => 'saved', viewerBusy: () => false, reloadViewer: () => { reloads++; shown = [...server] }, owns: () => true,
    wait: async ms => { time += ms }, now: () => time, ...over }
  return { deps, reloads: () => reloads, set: values => { ({ shown = shown, server = server } = { shown, server, ...values }) } }
}
await check('guard rules: equal ids are fresh (no reload); different ids reload once and read equal; no inventory means unverified (today\'s path); a failed read is refused (VIEWER_NOT_READY); a viewer with no usable identity is unverified; a viewer that never answers is refused after the budget', async () => {
  const lib = loadLib({ [FLAG]: 'true' })
  const ev = async deps => plain(await lib.ensureViewerMatchesServer(deps))
  const same = stub({ readServerSlideIds: async () => ['a', 'b', 'c'] }); assert.deepEqual(await ev(same.deps), { status: 'fresh' }); assert.equal(same.reloads(), 0)
  const diff = stub(); assert.deepEqual(await ev(diff.deps), { status: 'reloaded' }); assert.equal(diff.reloads(), 1)
  assert.deepEqual(await ev(stub({ readServerSlideIds: async () => null }).deps), { status: 'unverified' })
  const failed = await lib.ensureViewerMatchesServer(stub({ readServerSlideIds: async () => { throw new Error('x') } }).deps); assert.equal(failed.status, 'refused'); assert.equal(failed.code, 'VIEWER_NOT_READY')
  assert.deepEqual(await ev(stub({ readViewerSlideIds: async () => null }).deps), { status: 'unverified' })
  const mute = await lib.ensureViewerMatchesServer(stub({ readViewerSlideIds: async () => { throw new Error('no iframe') } }).deps); assert.equal(mute.status, 'refused'); assert.equal(mute.code, 'VIEWER_NOT_READY')
  const never = stub({ reloadViewer: () => {} }); const verdict = await lib.ensureViewerMatchesServer(never.deps); assert.equal(verdict.status, 'refused')
})
await check('guard rules: never reloads over a failed or pending save (it waits for a pending one, refuses a failed one), never while busy, and a viewer composing a slide (placeholders) is busy; an owner that changed gets nothing', async () => {
  const lib = loadLib({ [FLAG]: 'true' })
  const ev = async deps => plain(await lib.ensureViewerMatchesServer(deps))
  const failedSave = stub({ viewerSaveState: () => 'error' }); const a = await lib.ensureViewerMatchesServer(failedSave.deps); assert.equal(a.status, 'refused'); assert.equal(a.code, 'SLIDE_CHANGED'); assert.equal(failedSave.reloads(), 0)
  let waits = 0; const pending = stub({ viewerSaveState: () => (waits++ < 3 ? 'saving' : 'saved') }); assert.deepEqual(await ev(pending.deps), { status: 'reloaded' }); assert.equal(pending.reloads(), 1)
  const busy = stub({ viewerBusy: () => true }); const b = await lib.ensureViewerMatchesServer(busy.deps); assert.equal(b.status, 'refused'); assert.equal(busy.reloads(), 0)
  const composing = stub({ readViewerSlideIds: async () => 'busy' }); const c = await lib.ensureViewerMatchesServer(composing.deps); assert.equal(c.status, 'refused'); assert.equal(composing.reloads(), 0)
  const gone = stub({ owns: () => false }); assert.deepEqual(await ev(gone.deps), { status: 'owner-changed' }); assert.equal(gone.reloads(), 0)
  const failedFresh = stub({ readServerSlideIds: async () => ['a', 'b', 'c'], viewerSaveState: () => 'error' }); const d = await lib.ensureViewerMatchesServer(failedFresh.deps); assert.equal(d.status, 'refused'); assert.equal(d.code, 'VIEWER_NOT_READY')
})
await check('guard rules: the guard hands a directive to the runner AFTER the check; a refused add is answered once; two directives that arrive together are checked one after the other; a directive for an owner that left is not answered; an open element draft is left to the runner', async () => {
  const lib = loadLib({ [FLAG]: 'true' })
  const refused = { status: 'refused', code: 'SLIDE_CHANGED', message: 'm' }
  const ownerNow = { sessionId: 's', deckOwnerSessionId: 's', presentationId: 'p', epoch: 0 }
  const make = (verdicts, over = {}) => {
    const log = []
    const guard = lib.createChatStaleViewerGuard(() => ({ ensure: async () => { log.push('ensure'); return verdicts.shift() ?? { status: 'fresh' } }, addOwner: () => ownerNow, addPanelBusy: () => false, runAdd: p => log.push(`run:${p.directive_id}`),
      reportAddFailed: (p, error) => log.push(`failed:${p.directive_id}:${error}`), runEdit: m => log.push(`edit:${m.payload.directive_id}`), reportEditFailed: (id, code) => log.push(`editfailed:${id}:${code}`), ...over }))
    return { guard, log }
  }
  const tick = () => new Promise(resolve => setTimeout(resolve, 5))
  let m = make([refused, refused]); m.guard.add({ directive_id: 'd1' }); m.guard.add({ directive_id: 'd1' }); await tick()
  assert.deepEqual(m.log, ['ensure', 'failed:d1:m', 'ensure'], 'two copies of one refused directive are answered once')
  m = make([refused, { status: 'fresh' }]); m.guard.edit({ payload: { directive_id: 'e1' } }, { isCurrent: () => true }); m.guard.add({ directive_id: 'd2' }); await tick()
  assert.deepEqual(m.log, ['ensure', 'editfailed:e1:SLIDE_CHANGED', 'ensure', 'run:d2'], 'one after the other')
  m = make([], { addPanelBusy: () => true }); m.guard.add({ directive_id: 'd3' }); await tick(); assert.deepEqual(m.log, ['run:d3'], 'an open draft: straight to the runner, which answers dismissed')
  m = make([{ status: 'owner-changed' }]); m.guard.add({ directive_id: 'd4' }); await tick(); assert.deepEqual(m.log, ['ensure'], 'nothing is sent for an owner that left')
  m = make([{ status: 'fresh' }]); m.guard.edit({ payload: { directive_id: 'e2' } }, { isCurrent: () => false }); await tick(); assert.deepEqual(m.log, ['ensure'], 'a stale edit owner is not answered')
  m = make([{ status: 'unverified' }, { status: 'reloaded' }]); m.guard.add({ directive_id: 'd5' }); m.guard.edit({ payload: { directive_id: 'e3' } }, { isCurrent: () => true }); await tick(); assert.deepEqual(m.log, ['ensure', 'run:d5', 'ensure', 'edit:e3'], 'unverified and reloaded both go on to the runner')
})
await check('guard rules, a deck whose ids cannot be compared: always reloaded (Layout\'s signature read before and after, equal), reloaded again once when it moved under the reload, refused when it keeps moving or cannot be read or there is no reader; never over a failed save; the insert\'s re-check passes when unchanged and stops the add when changed or unreadable, once', async () => {
  const lib = loadLib({ [FLAG]: 'true' })
  const ev = async deps => plain(await lib.ensureViewerMatchesServer(deps))
  const sigs = (...values) => { const queue = [...values]; return async () => (queue.length > 1 ? queue.shift() : queue[0]) }
  const idle = (over = {}) => stub({ readServerSlideIds: async () => 'unusable', readServerSignature: sigs('s1', 's1'), ...over })
  const steady = idle(); assert.deepEqual(await ev(steady.deps), { status: 'reloaded' }); assert.equal(steady.reloads(), 1)
  await lib.confirmChatDeckUnchanged() // the check just made holds: the signature is still s1
  const moved = idle({ readServerSignature: sigs('a', 'b', 'b', 'b') }); assert.deepEqual(await ev(moved.deps), { status: 'reloaded' }); assert.equal(moved.reloads(), 2)
  const keeps = idle({ readServerSignature: sigs('a', 'b', 'c', 'd', 'e') }); const refused = await ev(keeps.deps); assert.equal(refused.status, 'refused'); assert.equal(refused.code, 'SLIDE_CHANGED'); assert.equal(keeps.reloads(), 2)
  const noRead = idle({ readServerSignature: undefined }); const none = await ev(noRead.deps); assert.equal(none.status, 'refused'); assert.equal(noRead.reloads(), 0)
  const broken = idle({ readServerSignature: async () => null }); const unread = await ev(broken.deps); assert.equal(unread.status, 'refused'); assert.equal(unread.code, 'VIEWER_NOT_READY')
  const viewerNoIds = stub({ readViewerSlideIds: async () => 'unusable', readServerSignature: sigs('x', 'x') }); assert.deepEqual(await ev(viewerNoIds.deps), { status: 'reloaded' }); assert.equal(viewerNoIds.reloads(), 1)
  const failed = idle({ viewerSaveState: () => 'error' }); const unsaved = await ev(failed.deps); assert.equal(unsaved.status, 'refused'); assert.equal(unsaved.code, 'SLIDE_CHANGED'); assert.equal(failed.reloads(), 0)
  const busy = idle({ viewerBusy: () => true }); assert.equal((await ev(busy.deps)).status, 'refused'); assert.equal(busy.reloads(), 0)
  // the insert's re-check
  let now = 's1'; const reader = idle({ readServerSignature: async () => now }); await ev(reader.deps); await lib.confirmChatDeckUnchanged(); await lib.confirmChatDeckUnchanged() // taken once: the second has nothing to check
  await ev(reader.deps); now = 's2'; await assert.rejects(lib.confirmChatDeckUnchanged(), /was changed while the element was being made/)
  await ev(idle().deps); await assert.doesNotReject(lib.confirmChatDeckUnchanged())
  await ev(stub({ readServerSlideIds: async () => ['a', 'b', 'c'] }).deps); await assert.doesNotReject(lib.confirmChatDeckUnchanged(), 'a deck compared by id leaves no check behind')
})
await check('the page hands the directives to the guard (the add handler and the edit handler), builds it once per mount behind the flag, and the viewer\'s api carries getStudioSaveStatus only with the flag on', () => {
  const page = read(PAGE)
  assert.ok(/if \(chatStaleViewerGuardRef\.current\) \{ chatStaleViewerGuardRef\.current\.add\(payload\); return \} \/\/ CHAT-STALE-VIEWER-GUARD[^\n]*\n\s+elementDirectiveRunnerRef\.current\?\.\(payload\)/.test(page), 'the add handler')
  assert.ok(/if \(chatStaleViewerGuardRef\.current\) \{ chatStaleViewerGuardRef\.current\.edit\(message, owner\); return \} \/\/ CHAT-STALE-VIEWER-GUARD[^\n]*\n\s+elementEditDirectiveRunnerRef\.current\?\.\(message, owner\) \/\/ CHAT-ELEMENT-EDIT/.test(page), 'the edit handler')
  assert.ok(page.includes('chatStaleViewerDepsRef.current = !CHAT_STALE_VIEWER_GUARD_ENABLED ? null : {'), 'null deps with the flag off')
  assert.ok(page.includes('if (CHAT_STALE_VIEWER_GUARD_ENABLED && !chatStaleViewerGuardRef.current) chatStaleViewerGuardRef.current = createChatStaleViewerGuard('), 'the guard exists only with the flag on')
  const viewerText = read(VIEWER)
  assert.ok(viewerText.includes('...(studioShell && CHAT_STALE_VIEWER_GUARD_ENABLED ? { getStudioSaveStatus } : {}), // CHAT-STALE-VIEWER-GUARD'))
  assert.ok(viewerText.includes("if (CHAT_STALE_VIEWER_GUARD_ENABLED) setSaveStatus('saved') // CHAT-STALE-VIEWER-GUARD"))
})

// the markers this change's lines carry besides their own: those changes' strips are the ones the older proofs read each file through
const SHARING = { 'hooks/use-textlabs-generation.ts': [stripChatAddTargeted, 'CHAT-ADD-TARGETED'], 'components/presentation-viewer.tsx': [stripChatParity, 'CHAT-PARITY'], 'app/builder/page.tsx': [stripChatElementEdit2, 'CHAT-ELEMENT-EDIT-2'] }
// ===== 14. flag off is identical ===============================================================================================================
const laterStrips = (rel, text) => { const at = registry.LATER_STRIPS.indexOf(stripChatStaleViewerGuard); return (at === -1 ? [] : registry.LATER_STRIPS.slice(at + 1)).reduce((out, strip) => { const next = typeof strip === 'function' ? strip(rel, out) : out; return typeof next === 'string' ? next : out }, text) }
const laterRead = rel => laterStrips(rel, read(rel))
const laterBlob = (ref, rel) => laterStrips(rel, git('show', `${ref}:${rel}`))
function laterBlocks() { const at = registry.LATER_ENV_BLOCKS.indexOf(CHAT_STALE_VIEWER_GUARD_ENV_BLOCK); return at === -1 ? [] : registry.LATER_ENV_BLOCKS.slice(at + 1) }
function withoutLaterEnvBlocks(text) { return laterBlocks().reduce((out, block) => { const body = String(block).replace(/^\n+/, '').replace(/\n+$/, ''); return body === '' ? out : out.replace(`\n${body}\n`, () => '') }, text) }
await check('flag off: the strip gives back #546\'s files byte for byte for the hook, the viewer and the page (every added line is marked, pure insertions, and the hook\'s carry #546\'s marker too); the .env.example block comes out with its blank line; all read past the changes registered after this one', async () => {
  for (const rel of CHAT_STALE_VIEWER_GUARD_FILES) {
    const base = git('show', `${BASE_COMMIT}:${rel}`), now = laterRead(rel)
    assert.equal(sha(stripChatStaleViewerGuard(rel, now)), sha(base), rel)
    const added = now.split('\n').length - base.split('\n').length
    assert.equal(now.split('\n').filter(line => CHAT_STALE_VIEWER_GUARD_MARKER_RE.test(line)).length, added, `${rel}: every added line carries the marker`)
    assert.ok(added > 0)
  }
  for (const [rel, [, token]] of Object.entries(SHARING)) for (const line of laterRead(rel).split('\n').filter(line => CHAT_STALE_VIEWER_GUARD_MARKER_RE.test(line))) assert.ok(line.split(/\s+/).includes(token) || line.includes(` ${token}:`) || line.includes(` ${token} `) || line.endsWith(` ${token}`), `${rel}: this change's lines carry ${token} too (the strip the older proofs read the file through takes them out): ${line.slice(0, 100)}`)
  assert.equal(withoutLaterEnvBlocks(read('.env.example')), `${git('show', `${BASE_COMMIT}:.env.example`)}\n${CHAT_STALE_VIEWER_GUARD_ENV_BLOCK}`, 'the base, one blank line, the block')
  assert.equal(registry.stripLaterEnvBlocks('.env.example', read('.env.example')), registry.stripLaterEnvBlocks('.env.example', git('show', `${BASE_COMMIT}:.env.example`)), 'the registry takes the block out')
  for (const rel of CHAT_STALE_VIEWER_GUARD_NEW_FILES) assert.ok(fs.existsSync(path.join(root, rel)), rel)
  for (const rel of CHAT_STALE_VIEWER_GUARD_PIN_FILES) {
    assert.equal(sha(stripChatStaleViewerGuard(rel, laterRead(rel))), sha(git('show', `${BASE_COMMIT}:${rel}`)), `${rel}: the proof this change taught, put back, is the base's`)
    for (const [has] of CHAT_STALE_VIEWER_GUARD_PIN_EDITS[rel]) for (const line of has.split('\n').filter(Boolean)) assert.ok(line.includes(CHAT_STALE_VIEWER_GUARD_PIN_MARK), `${rel}: a taught line carries the pin mark`)
  }
})
const baseRead = rel => stripChatStaleViewerGuard(rel, read(rel))
await check('flag off: the BASE files (this change\'s marked lines out of the hook, the viewer and the page) and these files make the same requests, the same saves, the same stored deck and the same result, for an add after a chat change and for an edit; no composeGetState, no inventory read, no reload', async () => {
  for (const [change, flags] of [['addMid', 'off'], ['none', 'off'], ['addMid', 't546']]) {
    const now = await addAfter(change, flags)
    const base = await scenario(`add-${flags}-${change}`, { flags, base: true, transcriptFrom: `add-${flags}-${change}`, read: baseRead, overrides: { [HOOK]: baseRead(HOOK) } }, async world => {
      await world.change(change); const before = plain(world.deck()); const index = world.indexOf('L2'); const result = await world.add(directive('TEXT_BOX', index)); return { before, index, result }
    })
    assert.equal(hashOf([now.snap.viewers.map(v => v.requests.map(item => [item.action, item.params])), now.snap.fetches.map(f => [f.method, f.url, f.body]), now.snap.deck, { ...now.snap.out.result, directive_id: 0, element_id: 0 }]),
      hashOf([base.snap.viewers.map(v => v.requests.map(item => [item.action, item.params])), base.snap.fetches.map(f => [f.method, f.url, f.body]), base.snap.deck, { ...base.snap.out.result, directive_id: 0, element_id: 0 }]), `${flags}/${change}: hash-equal`)
    assert.ok(!now.snap.actions.includes('composeGetState')); assert.equal(now.snap.calls.filter(c => c.kind === 'studio').length, 0); assert.equal(now.snap.reloads.length, 0)
  }
  const nowEdit = await editRun('t540', 'swap')
  const baseEdit = await scenario('edit-t540-swap', { flags: 't540', base: true, read: baseRead, overrides: { [HOOK]: baseRead(HOOK) } }, async world => { await world.change('swap'); const before = plain(world.deck()); const index = world.indexOf('L1'); return { before, index, result: await world.edit(editFrame(index, 'L1')) } })
  assert.equal(hashOf([nowEdit.snap.fetches.map(f => [f.method, f.url, f.body]), nowEdit.snap.deck, { ...nowEdit.snap.out.result, directive_id: 0 }]), hashOf([baseEdit.snap.fetches.map(f => [f.method, f.url, f.body]), baseEdit.snap.deck, { ...baseEdit.snap.out.result, directive_id: 0 }]))
})
await check('flag off: the guard is not reached from the add, the edit or the viewer (no guard object, no deps, no composeGetState, no inventory read, no reload), and the lib\'s flag is false', async () => {
  const run = offRuns.addMid
  assert.equal(run.world.guard(), null, 'no guard object')
  assert.ok(!run.snap.actions.includes('composeGetState')); assert.equal(run.snap.calls.filter(c => c.kind === 'studio').length, 0); assert.equal(run.snap.reloads.length, 0)
  assert.equal(loadLib({}).CHAT_STALE_VIEWER_GUARD_ENABLED, false)
})

// ===== 15. mutants ============================================================================================================================
const runMutant = (name, flags, overrides, extra = {}) => scenario(`mutant-${name}`, { flags, overrides, transcriptFrom: extra.from ?? `add-${flags}-addMid`, ...(extra.opts ?? {}) }, extra.fn ?? (async world => {
  await world.change('addMid'); const before = plain(world.deck()); const index = world.indexOf('L2'); return { before, index, result: await world.add(directive('TEXT_BOX', index)) }
}))
const goodGuard = async (run) => { const s = summary(run); assert.equal(s.result.status, 'inserted'); assert.deepEqual(s.onSlide, ['L2']); assert.deepEqual(s.foreign, []); assert.equal(s.reloads, 1) }
await mutant('lib: the id comparison always says equal (a stale viewer is never reloaded: the old deck is written over the new one)', async () => goodGuard(await runMutant('same', 'guard', { [LIB]: swap(libText, 'const sameIds = (a: ReadonlyArray<string>, b: ReadonlyArray<string>) => a.length === b.length && a.every((id, index) => id === b[index])', 'const sameIds = (_a: ReadonlyArray<string>, _b: ReadonlyArray<string>) => true') })))
await mutant('lib: a failed save does not stop a reload (the user\'s unsaved work is dropped)', async () => {
  const run = await scenario('mutant-reload-over-error', { flags: 'edit+guard', stored: FAT, overrides: { [LIB]: swap(libText, "if (state === 'error') return refuse('SLIDE_CHANGED', STALE_GUARD_MESSAGES.unsaved)", "if (false) return refuse('SLIDE_CHANGED', STALE_GUARD_MESSAGES.unsaved)") }, transcriptFrom: 'refuse-unsaved' }, async world => {
    world.hideTabSoon(HIDE_AFTER_MS); await world.add(directive('TEXT_BOX', 2)); world.setSaveStatus('error'); await world.change('addMid'); const before = plain(world.deck())
    const add = await world.add(directive('TEXT_BOX', world.indexOf('L2'))); return { before, add }
  })
  assert.equal(run.snap.reloads.length, 0, 'it must not reload over a failed save')
})
await mutant('hook: the add is not held for the save acknowledgement (inserted with nothing stored: Done for a lost save)', async () => {
  const run = await scenario('mutant-no-wait', { flags: 'guard', stored: FAT, overrides: { [HOOK]: read(HOOK).split('\n').filter(line => !line.includes('await requireChatAddSaved(watch')).join('\n') }, transcriptFrom: 'lost-put-guard', viewerPutStatus: 500 }, async world => { const before = plain(world.deck()); return { before, result: await world.add(directive('TEXT_BOX', 2)) } })
  assert.equal(run.snap.out.result.status, 'failed')
})
await mutant('lib: an add the autosave never took counts as stored (an untracked change is Done)', async () => {
  const run = await scenario('mutant-untracked-ok', { flags: guardEnvWithoutPersist, overrides: { [LIB]: swap(libText, "if (!watch.tracked()) { watch.close(); throw new Error(STALE_GUARD_MESSAGES.addNotSaved) }", 'if (!watch.tracked()) { watch.close(); return }') }, transcriptFrom: 'no-persist-guard' }, async world => ({ result: await world.add(directive('TEXT_BOX', 2)) }))
  assert.equal(run.snap.out.result.status, 'failed')
})
await mutant('lib: storedOnItsOwn is always true (an add that fell back to the editor\'s autosave is Done without waiting)', async () => {
  const run = await scenario('mutant-stored', { flags: 'guard', stored: FAT, overrides: { [LIB]: swap(libText, 'if (options.storedOnItsOwn) { watch.close(); return }', 'if (true) { watch.close(); return }') }, transcriptFrom: 'lost-put-guard', viewerPutStatus: 500 }, async world => { const before = plain(world.deck()); return { before, result: await world.add(directive('TEXT_BOX', 2)) } })
  assert.equal(run.snap.out.result.status, 'failed')
})
await mutant('viewer: a new frame keeps the last save status (Reload deck does not recover; the sticky not-ready)', async () => {
  const run = await scenario('mutant-sticky', { flags: 'guard', stored: FAT, viewerPutStatus: 500, read: rel => (rel === VIEWER ? read(rel).split('\n').filter(line => !line.includes("if (CHAT_STALE_VIEWER_GUARD_ENABLED) setSaveStatus('saved')")).join('\n') : read(rel)), transcriptFrom: 'sticky-guard' }, async world => {
    await world.add(directive('TEXT_BOX', 2)); world.setPutStatus(200); world.reload(); await world.settle(5_000); return { leaseAfter: Boolean(world.lease()), status: world.viewerState.saveStatus } })
  assert.equal(run.snap.out.leaseAfter, true)
})
await mutant('page: Reload deck does nothing (the viewer is never reloaded, the stale deck stays)', async () => {
  const run = await scenario('mutant-no-reload', { flags: 'guard', transcriptFrom: 'add-guard-addMid', read: rel => (rel === PAGE ? swap(read(rel), 'reloadViewer: () => deckChangedNotice.reload(),', 'reloadViewer: () => {},') : read(rel)) }, async world => {
    await world.change('addMid'); const index = world.indexOf('L2'); return { result: await world.add(directive('TEXT_BOX', index), { settleMs: 1 }) } })
  assert.equal(run.snap.out.result.status, 'inserted')
})
await mutant('lib: a refused add still reaches the runner (the element is inserted over a stale viewer)', async () => {
  const run = await scenario('mutant-refused-runs', { flags: 'guard', stored: FAT, overrides: { [LIB]: swap(libText, "if (verdict.status === 'refused') { if (once(payload.directive_id)) getDeps().reportAddFailed(payload, verdict.message); return }", "if (verdict.status === 'refused') { if (once(payload.directive_id)) getDeps().reportAddFailed(payload, verdict.message) }") }, transcriptFrom: 'refuse-fresh-error' }, async world => { world.setSaveStatus('error'); return { result: await world.add(directive('TEXT_BOX', 2)) } })
  assert.equal(run.snap.sent.length, 1, 'a refused add is answered once and never reaches the runner')
})
const idlessAddFn = async world => { await world.change('addMid'); const before = plain(world.deck()); const index = titleAt(world.deck(), 'Plan'); return { before, index, result: await world.add(directive('TEXT_BOX', index)) } }
const idlessGood = run => { assert.equal(run.snap.reloads.length, 1, 'reloaded first'); assert.equal(run.snap.out.result.status, 'inserted'); assert.deepEqual(foreignIdless(run.snap.deck), []) }
await mutant('lib: a deck whose ids cannot be compared is let through as "unverified" (the add goes on the index alone, over a stale viewer)', async () => idlessGood(await scenario('mutant-idless-unverified', { flags: 'guard', stored: idlessDeck(), overrides: { [LIB]: swap(libText, 'if (idless) return reloadIdless(deps, { left, poll, refuse, gone })', "if (idless) return { status: 'unverified' }") }, transcriptFrom: 'idless-add-guard-addMid' }, idlessAddFn)))
await mutant('page: an inventory Studio cannot read (a slide with no id) is read as "no inventory" (the guard never sees a deck it cannot compare)', async () => idlessGood(await scenario('mutant-idless-null', { flags: 'guard', stored: idlessDeck(), read: rel => (rel === PAGE ? swap(read(rel), "return read.reason === 'invalid_inventory' ? 'unusable' : null;", 'return null;') : read(rel)), transcriptFrom: 'idless-add-guard-addMid' }, idlessAddFn)))
const raceFn = async world => { let fired = false; world.onCommand = action => { if (action === 'getSlideGenerationContext' && !fired) { fired = true; world.change('addMid') } }; const before = plain(world.deck()); return { before, result: await world.add(directive('TEXT_BOX', titleAt(world.deck(), 'Plan'))) } }
await mutant('hook: the insert is not re-checked against Layout\'s signature (a change that lands while the element is being made is written onto the wrong slide)', async () => {
  const run = await scenario('mutant-idless-no-recheck', { flags: 'guard', stored: idlessDeck(), overrides: { [HOOK]: read(HOOK).split('\n').filter(line => !line.includes('await confirmChatDeckUnchanged()')).join('\n') }, transcriptFrom: 'idless-race-guard' }, raceFn)
  assert.equal(run.snap.out.result.status, 'failed'); assert.ok(!run.snap.actions.includes('insertTextBox'))
})
await mutant('lib: the re-check never throws (a changed signature is accepted)', async () => {
  const run = await scenario('mutant-idless-recheck-ok', { flags: 'guard', stored: idlessDeck(), overrides: { [LIB]: swap(libText, 'if (now === null || now !== check.signature) throw', 'if (false) throw') }, transcriptFrom: 'idless-race-guard' }, raceFn)
  assert.equal(run.snap.out.result.status, 'failed'); assert.ok(!run.snap.actions.includes('insertTextBox'))
})
await mutant('lib: the signature before and after the reload is not compared (a deck that moved under the reload is taken as proved)', async () => {
  const lib = loadLib({ [FLAG]: 'true' }, { [LIB]: swap(libText, 'if (after === before) { idlessCheck', 'if (true) { idlessCheck') })
  const sigs = (...values) => { const queue = [...values]; return async () => (queue.length > 1 ? queue.shift() : queue[0]) }
  const keeps = stub({ readServerSlideIds: async () => 'unusable', readServerSignature: sigs('a', 'b', 'c', 'd', 'e') }); const verdict = plain(await lib.ensureViewerMatchesServer(keeps.deps))
  assert.equal(verdict.status, 'refused', JSON.stringify(verdict))
})
await mutant('lib: with no signature reader an id-less deck goes on (never on the index alone: it must be refused)', async () => {
  const lib = loadLib({ [FLAG]: 'true' }, { [LIB]: swap(libText, "if (!read) return refuse('SLIDE_CHANGED', STALE_GUARD_MESSAGES.idlessChanging)", "if (!read) return { status: 'unverified' }") })
  const noRead = stub({ readServerSlideIds: async () => 'unusable' }); const verdict = plain(await lib.ensureViewerMatchesServer(noRead.deps))
  assert.equal(verdict.status, 'refused', JSON.stringify(verdict))
})
await mutant('lib: the flag reads a loose value', () => assert.equal(loadLib({ [FLAG]: '1' }, { [LIB]: swap(libText, "=== 'true'", '!== undefined') }).CHAT_STALE_VIEWER_GUARD_ENABLED, false))
await mutant('lib: a viewer that is composing a slide is reloaded (the build in progress is dropped)', async () => {
  const lib = loadLib({ [FLAG]: 'true' }, { [LIB]: swap(libText, "if (viewer === 'busy') return refuse('VIEWER_NOT_READY', STALE_GUARD_MESSAGES.busy)", '') })
  const composing = stub({ readViewerSlideIds: async () => 'busy' }); const verdict = await lib.ensureViewerMatchesServer(composing.deps); assert.equal(composing.reloads(), 0, JSON.stringify(verdict))
})

// ===== 16. scope over the COMMITTED diff (BASE..head), gate-safe and robust after merge ====================================================
console.log('scope over the committed diff (own commits by subject across `rev-list --no-merges BASE..head`)')
const GIT_IDENT = { GIT_AUTHOR_NAME: 'gate', GIT_AUTHOR_EMAIL: 'gate@example.invalid', GIT_COMMITTER_NAME: 'gate', GIT_COMMITTER_EMAIL: 'gate@example.invalid', GIT_AUTHOR_DATE: '2026-10-28T00:00:00Z', GIT_COMMITTER_DATE: '2026-10-28T00:00:00Z' }
const plumb = (args, input) => execFileSync('git', args, { cwd: root, encoding: 'utf8', ...(input === undefined ? {} : { input }), env: { ...process.env, ...GIT_IDENT }, stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'], maxBuffer: 1 << 28, timeout: 60_000 }).trim()
/** A blob object for `text`, written from a temporary FILE (never `hash-object --stdin`): stdin ignored, a 60 s timeout, no filters. */
const blobOf = text => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svg-blob-'))
  try { const file = path.join(dir, 'blob'); fs.writeFileSync(file, text); return plumb(['hash-object', '-w', '--no-filters', '--', file]) } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const subjectOf = c => git('log', '-1', '--format=%s', c).trim()
const parentsOf = sha1 => git('rev-list', '--parents', '-n', '1', sha1).trim().split(/\s+/).slice(1)
/** This change's commits: found by SUBJECT across `rev-list --no-merges BASE..head`. A first-parent walk (`firstParentOnly`, the old query, kept for its mutant) sees nothing on the gate's merge and none of this change's commits once a change is stacked after it. */
const ownOf = (head, { firstParentOnly = false } = {}) => git('rev-list', ...(firstParentOnly ? ['--first-parent'] : []), '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => subjectOf(c).startsWith(CHAT_STALE_VIEWER_GUARD_SUBJECT))
/** GATE-SAFE head of every scope query. The gate's merge has dev as its FIRST parent (it carries none of this change's commits, whether or not dev has moved past BASE) and this change's head as its SECOND parent: the scope runs against HEAD^2.
 *  On a branch (HEAD is this change's tip, or a merge of dev INTO it, whose first parent is the change) HEAD itself is used. `gateRule: false` is the mutant that drops the rule. */
function scopeHead(ref = 'HEAD', { gateRule = true } = {}) {
  const head = git('rev-parse', `${ref}^{commit}`).trim()
  const parents = parentsOf(head)
  if (!gateRule || parents.length !== 2) return head
  return ownOf(parents[0]).length === 0 && ownOf(parents[1]).length > 0 ? parents[1] : head
}
const applyAll = (list, rel, text) => list.reduce((out, strip) => { const next = strip(rel, out); return typeof next === 'string' ? next : out }, text)
// every OTHER change's lines out, except those whose markers this change's lines carry too (#546's, chat parity's, #538's): BASE already has their lines, so they are in both sides, and their strips would take this change's lines out as well
// (SHARING is defined with the other strip helpers above check 14)
const otherStrips = (rel, text) => applyAll(registry.LATER_STRIPS.filter(strip => strip !== stripChatStaleViewerGuard && !Object.values(SHARING).some(([shared]) => shared === strip)), rel, text)
const REAL = { files: registry.LATER_CHANGE_FILES, norm: otherStrips, env: text => registry.stripLaterEnvBlocks('.env.example', text) }
const diffLines = text => text.split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
/** `git diff -U0` of the base file against the file at `head`, both read through ctx.norm (every other change's lines out). */
const normDiff = (ctx, rel, head) => git('diff', '-U0', blobOf(ctx.norm(rel, git('show', `${BASE_COMMIT}:${rel}`))), blobOf(ctx.norm(rel, git('show', `${head}:${rel}`))))
const scopeOwnCommits = (head, opts) => {
  const own = ownOf(head, opts)
  assert.ok(own.length >= 1, 'no own commit yet')
  for (const c of own) assert.match(git('log', '-1', '--format=%B', c), /Co-Authored-By: Claude Sonnet 5\.5 <noreply@anthropic\.com>\s*$/, c.slice(0, 8))
  return own
}
const scopeCommittedFiles = (head, ctx = REAL) => {
  const own = scopeOwnCommits(head)
  const touched = new Set()
  for (const c of own) for (const rel of git('show', '--name-only', '--format=', c).split('\n').filter(Boolean)) touched.add(rel)
  assert.deepEqual([...touched].sort(), [...CHAT_STALE_VIEWER_GUARD_SCOPE_FILES].sort(), 'the files this change\'s own commits touch are exactly its scope')
  for (const rel of CHAT_STALE_VIEWER_GUARD_FILES) {
    const diff = diffLines(normDiff(ctx, rel, head))
    for (const line of diff) { assert.ok(line.startsWith('+'), `${rel}: a removed line: ${line.slice(0, 120)}`); assert.match(line, CHAT_STALE_VIEWER_GUARD_MARKER_RE, `${rel}: an unmarked added line: ${line.slice(0, 120)}`) }
    assert.ok(diff.length > 0, `${rel}: the number of added lines`)
    assert.equal(stripChatStaleViewerGuard(rel, ctx.norm(rel, git('show', `${head}:${rel}`))), ctx.norm(rel, git('show', `${BASE_COMMIT}:${rel}`)), `${rel}: without its marked lines the file is the base's, byte for byte`)
  }
  for (const rel of CHAT_STALE_VIEWER_GUARD_NEW_FILES) assert.equal(git('cat-file', '-t', `${head}:${rel}`).trim(), 'blob', rel)
  for (const rel of ['lib/chat-add-targeted.ts', 'lib/chat-edit-targeted.ts', 'lib/chat-element-edit.ts', 'lib/studio-insert-persist.ts', 'lib/element-command-router.ts', 'lib/chat-element-edit-save.ts', 'lib/studio-native-slide-order.ts', 'lib/slide-rail-identity.ts']) assert.ok(!touched.has(rel), `${rel} is not touched by this change`)
}
const scopeEnvAndRegistry = (head, ctx = REAL) => {
  const env = git('show', `${head}:.env.example`), baseEnv = git('show', `${BASE_COMMIT}:.env.example`)
  assert.equal(ctx.env(env), ctx.env(baseEnv), '.env.example is the base plus the registered blocks and nothing else')
  assert.equal(env.split(CHAT_STALE_VIEWER_GUARD_ENV_BLOCK).length - 1, 1, 'this change\'s block is there exactly once, verbatim')
  assert.match(env, new RegExp(`\\n\\n${CHAT_STALE_VIEWER_GUARD_ENV_BLOCK.split('\n')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), 'a blank line before the block')
  const diff = diffLines(git('diff', '-U0', `${BASE_COMMIT}..${head}`, '--', 'scripts/studio-later-changes.mjs'))
  assert.equal(diff.filter(line => line.startsWith('-')).length, 0, 'the registry loses no line')
  const mine = diff.filter(line => line.includes('studio-chat-stale-viewer-guard-strip.mjs'))
  assert.equal(mine.length, 3, 'the registry gains exactly this change\'s three lines'); for (const line of mine) assert.ok(line.startsWith('+') && line.includes('// LATER-CHANGE:'), line.slice(0, 140))
  assert.deepEqual(mine.map(line => /\)\.(\w+), \/\//.exec(line)?.[1]), ['CHAT_STALE_VIEWER_GUARD_SCOPE_FILES', 'CHAT_STALE_VIEWER_GUARD_ENV_BLOCK', 'stripChatStaleViewerGuard'])
}
const scopeAll = (head, ctx = REAL) => { scopeOwnCommits(head); scopeCommittedFiles(head, ctx); scopeEnvAndRegistry(head, ctx) }

const HEAD = scopeHead('HEAD')
await check(`this change's own commits (subject starts "${CHAT_STALE_VIEWER_GUARD_SUBJECT}", found across the whole line, no merges) exist, with the co-author line`, () => { scopeOwnCommits(HEAD) })
await check('the committed files are exactly this change\'s; every line added to the hook, the viewer and the page is a pure insertion that carries the marker; the strip gives the base back byte for byte (other changes\' lines out of both sides)', () => scopeCommittedFiles(HEAD))
await check('.env.example is the base plus the block (after one blank line); the registry gains exactly its three marked lines and loses none; no secret-shaped literal in the new files', () => {
  scopeEnvAndRegistry(HEAD)
  for (const rel of [...CHAT_STALE_VIEWER_GUARD_NEW_FILES.filter(rel => !rel.endsWith('.json')), HOOK, VIEWER, PAGE]) assert.doesNotMatch(fs.readFileSync(path.join(root, rel), 'utf8'), /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY)/, rel)
})
// GATE-SAFE: the gate's merge (first parent dev, second parent this change's head; the tree is `git merge-tree --write-tree dev head`) and the whole scope section against it
const gateMerge = (dev, head) => plumb(['commit-tree', plumb(['merge-tree', '--write-tree', dev, head]).split('\n')[0], '-p', dev, '-p', head, '-m', 'gate-style merge (local, no ref)'])
const GATE = gateMerge(BASE_COMMIT, HEAD)
await check('GATE-SAFE: on a gate-style merge (first parent BASE, second parent this change\'s head) the scope head is HEAD^2 and the whole scope section passes against it; the merged tree is read too', () => {
  assert.deepEqual(parentsOf(GATE), [BASE_COMMIT, HEAD])
  assert.deepEqual(git('log', '--format=%H', '--first-parent', '--no-merges', `${BASE_COMMIT}..${GATE}`).split('\n').filter(Boolean), [], 'the gate\'s first-parent, no-merges line from BASE is empty: why HEAD itself cannot be used')
  assert.equal(scopeHead(GATE), HEAD, 'HEAD^2 is the change\'s head')
  scopeAll(scopeHead(GATE))
  scopeEnvAndRegistry(GATE)
  for (const rel of CHAT_STALE_VIEWER_GUARD_FILES) assert.equal(stripChatStaleViewerGuard(rel, otherStrips(rel, git('show', `${GATE}:${rel}`))), otherStrips(rel, git('show', `${BASE_COMMIT}:${rel}`)), `the merged tree, without this change's lines, is the base's ${rel}`)
  assert.equal(scopeHead(HEAD), HEAD, 'a branch head is used as it is'); assert.equal(scopeHead(BASE_COMMIT), BASE_COMMIT, 'BASE itself is used as it is')
})
await check('mutant caught: the old first-parent own-commit query finds no own commit on the gate-style merge, and without the HEAD^2 rule the scope head is the merge itself', () => {
  const head = scopeHead(GATE, { gateRule: false })
  assert.equal(head, GATE)
  assert.throws(() => scopeOwnCommits(head, { firstParentOnly: true }), /no own commit yet/)
  assert.doesNotThrow(() => scopeOwnCommits(head), 'the subject query across the line finds them on the merge itself')
})
/** A commit (objects only, no ref) whose tree is `parent`'s with `edits` ({path: text}) applied, built through a temporary index file. */
const commitWith = (parent, edits, message) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svg-idx-'))
  try {
    const env = { ...process.env, ...GIT_IDENT, GIT_INDEX_FILE: path.join(dir, 'index') }
    const viaIndex = (...a) => execFileSync('git', a, { cwd: root, env, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 }).trim()
    viaIndex('read-tree', parent)
    for (const [rel, text] of Object.entries(edits)) viaIndex('update-index', '--add', '--cacheinfo', `100644,${blobOf(text)},${rel}`)
    return plumb(['commit-tree', viaIndex('write-tree'), '-p', parent, '-m', message])
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const TRAILER = '\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>'
// a merge onto an ADVANCED dev: a commit on dev after BASE that touches an unrelated file; the gate's first parent is no longer BASE
const unrelated = commitWith(BASE_COMMIT, { 'unrelated-after-base.txt': 'unrelated\n' }, 'Dev: an unrelated commit after BASE')
const ADVANCED_GATE = gateMerge(unrelated, HEAD)
await check('GATE-SAFE after dev moved on: a gate merge whose first parent is a dev commit past BASE (an unrelated commit): the scope head is still this change\'s head and the scope section passes; the unrelated commit is not this change\'s concern', () => {
  assert.deepEqual(parentsOf(ADVANCED_GATE), [unrelated, HEAD]); assert.notEqual(parentsOf(ADVANCED_GATE)[0], BASE_COMMIT)
  assert.equal(scopeHead(ADVANCED_GATE), HEAD)
  scopeAll(scopeHead(ADVANCED_GATE)); scopeEnvAndRegistry(ADVANCED_GATE)
  assert.equal(ownOf(ADVANCED_GATE).length, ownOf(HEAD).length, 'the same own commits are found on the merge')
})
// a SYNTHETIC change stacked after this one: marked lines in the hook (next to this change's own), a registry trio below this change's, an .env.example block, a new file
const SYN = { marker: 'SYNTHETIC-LATER', file: 'scripts/studio-synthetic-later-strip.mjs', block: '# SYNTHETIC LATER (a made-up change stacked after this one)\nNEXT_PUBLIC_SYNTHETIC_LATER="false"\n' }
const syntheticStrip = (rel, text) => rel === HOOK && typeof text === 'string' ? text.split('\n').filter(line => !line.includes(SYN.marker)).join('\n') : text
const syntheticCommit = parent => {
  const at = rel => git('show', `${parent}:${rel}`)
  const hook = at(HOOK).split('\n').flatMap(line => line.startsWith('    let staleGuardWatch') ? [line, `    const syntheticLater = 1 // ${SYN.marker}`] : [line]).join('\n')
  const reg = at('scripts/studio-later-changes.mjs').split('\n').flatMap(line => {
    if (line.includes('CHAT_STALE_VIEWER_GUARD_SCOPE_FILES')) return [line, "  ...(await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_SCOPE_FILES, // LATER-CHANGE: synthetic, stacked after this one"]
    if (line.includes('CHAT_STALE_VIEWER_GUARD_ENV_BLOCK')) return [line, "  (await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_ENV_BLOCK, // LATER-CHANGE: synthetic, stacked after this one"]
    if (line.includes(').stripChatStaleViewerGuard')) return [line, "  (await import('./studio-synthetic-later-strip.mjs')).stripSynthetic, // LATER-CHANGE: synthetic, stacked after this one"]
    return [line]
  }).join('\n')
  return commitWith(parent, { [HOOK]: hook, 'scripts/studio-later-changes.mjs': reg, '.env.example': `${at('.env.example')}\n${SYN.block}`, [SYN.file]: 'export const SYNTHETIC_SCOPE_FILES = new Set()\n' }, `Synthetic later: a change stacked after this one${TRAILER}`)
}
const SYNTHETIC = syntheticCommit(HEAD)
const SYN_CTX = {
  files: new Set([...registry.LATER_CHANGE_FILES, SYN.file]),
  norm: (rel, text) => syntheticStrip(rel, otherStrips(rel, text)),
  env: text => registry.stripLaterEnvBlocks('.env.example', text).replace(`\n${SYN.block}`, ''),
}
await check('ROBUST AFTER MERGE: a synthetic change stacked after this one (its marked line beside this change\'s in the hook, a registry trio, an .env.example block, a new file; its own commit has another subject) leaves this change\'s scope section passing, on the branch, on the gate\'s merge and on a merge onto an advanced dev', () => {
  assert.ok(ownOf(SYNTHETIC).length === ownOf(HEAD).length && !ownOf(SYNTHETIC).includes(SYNTHETIC), 'the later commit is not this change\'s')
  assert.equal(scopeHead(SYNTHETIC), SYNTHETIC)
  scopeAll(SYNTHETIC, SYN_CTX)
  const gate = gateMerge(BASE_COMMIT, SYNTHETIC)
  assert.equal(scopeHead(gate), SYNTHETIC); scopeAll(scopeHead(gate), SYN_CTX); scopeEnvAndRegistry(gate, SYN_CTX)
  assert.equal(stripChatStaleViewerGuard(HOOK, SYN_CTX.norm(HOOK, git('show', `${gate}:${HOOK}`))), SYN_CTX.norm(HOOK, git('show', `${BASE_COMMIT}:${HOOK}`)), 'the merged tree is the base\'s hook without this change\'s and the later change\'s lines')
  const advanced = gateMerge(unrelated, SYNTHETIC)
  assert.equal(scopeHead(advanced), SYNTHETIC); scopeAll(scopeHead(advanced), SYN_CTX)
})
await check('mutant caught: the same synthetic later change fails a scope that is not told about it (its hook line is an unmarked addition, its registry lines extra)', () => {
  assert.throws(() => scopeCommittedFiles(SYNTHETIC), /unmarked added line|exactly its scope/)
  assert.throws(() => scopeEnvAndRegistry(SYNTHETIC), /gains exactly|base plus the registered blocks/)
})
await check('mutant caught: a stray foreign file in a "Stale viewer guard:" commit fails the committed-files check (own commits found by subject, the diff names the file)', () => {
  const stray = commitWith(HEAD, { 'stray-stale-viewer-guard.txt': 'stray\n' }, `${CHAT_STALE_VIEWER_GUARD_SUBJECT} a stray file${TRAILER}`)
  assert.ok(ownOf(stray).includes(stray), 'the stray commit is found by its subject')
  assert.doesNotThrow(() => scopeCommittedFiles(HEAD), 'the real head passes')
  assert.throws(() => scopeCommittedFiles(stray), /exactly its scope/, 'the committed-files check must fail on a stray file')
})
await check('mutant caught: an own commit without the co-author line, and an unmarked line added to the page in an own commit, fail the scope', () => {
  const noTrailer = commitWith(HEAD, {}, `${CHAT_STALE_VIEWER_GUARD_SUBJECT} no trailer`)
  assert.throws(() => scopeOwnCommits(noTrailer), error => /^[0-9a-f]{8}$/.test(error.message), 'the commit without the trailer is named')
  const sneaky = commitWith(HEAD, { [PAGE]: git('show', `${HEAD}:${PAGE}`).replace('const handleNewChatWrappedRef', 'const sneaky = 1\n  const handleNewChatWrappedRef') }, `${CHAT_STALE_VIEWER_GUARD_SUBJECT} a sneaky line${TRAILER}`)
  assert.throws(() => scopeCommittedFiles(sneaky), /unmarked added line/)
})
await check('Layout identity: the recording names the Layout files it ran (and, live, they are the files on disk)', async () => {
  if (RECORD) return
  assert.ok(recorded.meta?.sources?.['src/utils/chat-targeted-save.js'] && recorded.meta?.sources?.['chat_targeted_save.py'] && recorded.meta?.sources?.['server.py'])
  if (LIVE) for (const [rel, hash] of Object.entries(recorded.meta.sources)) assert.equal(sha(fs.readFileSync(path.join(LAYOUT_DIR, rel), 'utf8')), hash, rel)
})

if (RECORD) {
  recorded.meta = { recorded_with: 'CHAT_STALE_VIEWER_GUARD_LAYOUT_DIR + --record-layout', layout_checkout: 'layout-builder frontend2/layout-targeted-save (LAYOUT_CHAT_TARGETED_SAVE_ENABLED, LAYOUT_SLIDE_THUMBNAILS_ENABLED)', studio_origin: STUDIO_ORIGIN,
    director_frames: 'scripts/fixtures/studio-job-ledger/directive-never-answered.json directive_and_running_row[0] (an element_directive) and scripts/fixtures/chat-element-edit/director-frames/01-delete-ok.json (an element_edit); the type, prompt, slide and element are set per scenario',
    sources: Object.fromEntries(['viewer/presentation-viewer.html', 'arrange_commands.py', 'chat_targeted_save.py', 'src/utils/chat-targeted-save.js', 'src/utils/arrange-commands.js', 'src/utils/edit-mode.js', 'src/utils/grid-converter.js', 'src/utils/auto-save.js', 'src/utils/element-manager.js', 'server.py',
      'src/utils/drag-drop.js', 'src/templates/template-registry.js', 'src/utils/semantic-slot-catalog.js', 'src/utils/direct-element-creator.js', 'slide_thumbnails.py'].map(rel => [rel, sha(fs.readFileSync(path.join(LAYOUT_DIR, rel), 'utf8'))])) }
  fs.mkdirSync(path.dirname(TRANSCRIPTS), { recursive: true })
  fs.writeFileSync(TRANSCRIPTS, `${JSON.stringify(recorded, null, 1)}\n`)
  console.log(`recorded ${Object.keys(recorded.scenarios).length} scenarios`)
}

console.log(`\n${passed} passed, ${failed.length} failed; mutants: ${caught} caught, ${missed.length} missed${LIVE ? ' (live Layout code and server)' : ' (offline, recorded Layout code)'}`)
if (failed.length || missed.length) { if (failed.length) console.error(`failed: ${failed.join('; ')}`); if (missed.length) console.error(`missed: ${missed.join('; ')}`); process.exit(1) }
