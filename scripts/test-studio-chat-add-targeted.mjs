// FRONTEND-2 (B42, 28 Oct; E2E-2 batch 2, rows 37 and 38, Studio dev, 28 Oct 21:11Z): proof of targeted chat add, a chat element ADD saves only the new element and never sets off the editor's whole-deck autosave
// (NEXT_PUBLIC_STUDIO_CHAT_ADD_TARGETED_SAVE, exact "true", default off, build-time). The add-side twin of scripts/test-studio-chat-edit-targeted.mjs (#540).
//
//   node scripts/test-studio-chat-add-targeted.mjs                                  # offline: the viewer's replies, its save requests and Layout's server answers come from scripts/fixtures/chat-add-targeted/layout-transcripts.json, recorded from Layout's real code
//   CHAT_ADD_TARGETED_LAYOUT_DIR=<layout-builder at frontend2/layout-targeted-save> CHAT_ADD_TARGETED_LAYOUT_PYTHON=<a Python with Layout's requirements> node scripts/test-studio-chat-add-targeted.mjs
//                                                                                   # also runs the REAL Layout viewer code and the REAL Layout server live and checks they say what was recorded
//   ... --record-layout                                                             # (with the variables) re-records the fixture
// (CHAT_EDIT_TARGETED_LAYOUT_DIR / CHAT_EDIT_TARGETED_LAYOUT_PYTHON, #540's names, are taken too.)
//
// THE DEFECT. A chat add (Director element_directive -> app/builder/page.tsx elementDirectiveRunnerRef -> handleApprovedTextLabsGenerate -> hooks/use-textlabs-generation.ts handleGenerate, invocation 'chat-add') inserts through the viewer's
// insert commands, which INSERT-PERSIST makes enter edit mode, so the insert's change mark schedules the editor's debounced WHOLE-DECK save (auto-save.js buildSaveRequest collects every slide; collectTextBoxes takes the layout text
// direct-element-creator.js draws on each one). PUT /slides stores it all: "Auto-save from editor" with every slide's title / section label / footer / Sources stored as text boxes (E2E-2: 16 text boxes on 4 slides).
//
// What runs (scripts/studio-chat-add-targeted-world.mjs): Director's recorded element_directive frame (scripts/fixtures/studio-job-ledger/directive-never-answered.json) -> the page's runner and handleApprovedTextLabsGenerate (cut out of app/builder/page.tsx) ->
// the REAL useTextLabsGeneration and useGenerationPanel -> Studio's real handleSendElementCommand (INSERT-PERSIST's edit mode included), handleSendTextBoxCommand and sendCommand (cut out of components/presentation-viewer.tsx) -> Layout's REAL viewer (page bridge,
// edit-mode.js, auto-save.js, element-manager.js, arrange-commands.js, chat-targeted-save.js) loaded with a stored deck through Layout's own load path -> Layout's REAL server (server.py) answering each PUT. Text Labs is a stand-in; the DOM, the clock and the ids are fixed.
// What it proves:
//  1. the root cause, flags off: ONE whole-deck PUT "Auto-save from editor" whose stored deck has the layout text of slides 1 and 3 as text boxes (they had none), for a text box, an image and a chart add;
//  2. flags on: the same adds make ONE chat-save PUT (begin on an element already on the slide, the insert, cancel, begin on the new element named by the insert's answer, commit), no whole-deck save even after the debounce, nothing stored on any other slide,
//     exactly one element more on the slide, in the right collection; the stored deck reloads (Layout's load path) with the element and the layout text still layout text;
//  3. Layout's flag off (Studio's on): today's path, reported as such (the add is saved by the editor's autosave, the whole-deck PUT is the defect again); no begin is left open, no silent ok;
//  4. the placeholder is never stored: a chat add inserts none; a blank placeholder box on the slide at commit time is not in the save;
//  5. Undo: the result frame is byte-identical to flag off; the save is a Layout version (the previous stored deck is the one before it); chat undo is untouched;
//  6. the manual Add Element (no chat invocation) and a manual Edit Mode change are unchanged, byte for byte, and a manual change after a chat add is not held by a scope left open;
//  7. failures are honest: an insert that fails leaves no scope open; a refused or a never-answered commit fails the add (the hook's rollback removes the element); a slow commit (8 s, 18 s) is pending then ok, never failed while it lands; an owner change sends nothing more;
//     no element to hold the marks with, another targeted save open, and a cited table upsert keep today's path;
//  8. flag off is identical: the strip gives the base hook back byte for byte, and the base hook and this hook with the flag off make the same requests, saves and result;
//  9. mutants are caught; 10. scope over the COMMITTED diff, GATE-SAFE and robust after merge (subject across `rev-list --no-merges BASE..head`, HEAD^2 on the gate's merge, registry / .env.example / strip reads past later changes), proved on a
//     gate-style merge, on a merge onto an advanced dev and on a synthetic change stacked after this one.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'
import { createClock, createLayoutViewer } from './studio-chat-element-edit-layout.mjs'
import { renderStoredDeck } from './studio-chat-edit-targeted-reload.mjs'
import { createAddWorld, plain, PRESENTATION, STUDIO_ORIGIN } from './studio-chat-add-targeted-world.mjs'
import {
  BASE_COMMIT, CHAT_ADD_TARGETED_FILES, CHAT_ADD_TARGETED_NEW_FILES, CHAT_ADD_TARGETED_PIN_FILES, CHAT_ADD_TARGETED_PIN_EDITS, CHAT_ADD_TARGETED_PIN_MARK, CHAT_ADD_TARGETED_SCOPE_FILES, CHAT_ADD_TARGETED_ENV_BLOCK,
  CHAT_ADD_TARGETED_MARKER_RE, CHAT_ADD_TARGETED_SUBJECT, stripChatAddTargeted,
} from './studio-chat-add-targeted-strip.mjs'
import * as registry from './studio-later-changes.mjs'

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const TRANSCRIPTS = path.join(root, 'scripts/fixtures/chat-add-targeted/layout-transcripts.json')
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const HOOK = 'hooks/use-textlabs-generation.ts', LIB = 'lib/chat-add-targeted.ts'

const hookText = read(HOOK)
const laterStrips = (rel, text) => { const at = registry.LATER_STRIPS.indexOf(stripChatAddTargeted); return (at === -1 ? [] : registry.LATER_STRIPS.slice(at + 1)).reduce((out, strip) => { const next = typeof strip === 'function' ? strip(rel, out) : out; return typeof next === 'string' ? next : out }, text) }
const laterRead = rel => laterStrips(rel, read(rel))
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] })
const laterBlob = (ref, rel) => laterStrips(rel, git('show', `${ref}:${rel}`))

const RECORD = process.argv.includes('--record-layout')
const LAYOUT_DIR = (process.env.CHAT_ADD_TARGETED_LAYOUT_DIR || process.env.CHAT_EDIT_TARGETED_LAYOUT_DIR) ? path.resolve(process.env.CHAT_ADD_TARGETED_LAYOUT_DIR || process.env.CHAT_EDIT_TARGETED_LAYOUT_DIR) : null
const PYTHON = process.env.CHAT_ADD_TARGETED_LAYOUT_PYTHON || process.env.CHAT_EDIT_TARGETED_LAYOUT_PYTHON || null
const LIVE = Boolean(LAYOUT_DIR)
if (RECORD && !LIVE) throw new Error('--record-layout needs CHAT_ADD_TARGETED_LAYOUT_DIR')
if (LIVE && !PYTHON) throw new Error('the live run needs CHAT_ADD_TARGETED_LAYOUT_PYTHON (a Python with layout-builder\'s requirements) for Layout\'s own server')
const recorded = RECORD ? { meta: {}, scenarios: {}, reload: {} } : JSON.parse(fs.readFileSync(TRANSCRIPTS, 'utf8'))

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

// ---- the deck, the flags, the scenario --------------------------------------------------------------------------------------------------
const FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_ADD_TARGETED_SAVE'
const SHELL = { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_TEXT_LABS_URL: 'https://textlabs.synthetic.test', NEXT_PUBLIC_ELEMENTOR_URL: 'https://textlabs.synthetic.test', NEXT_PUBLIC_STUDIO_INSERT_PERSIST: 'true' }
const ENV_ON = { ...SHELL, [FLAG]: 'true' }
const ENV_OFF = { ...SHELL }
const TITLES = ['Cover', 'Where we lose', 'Plan']
const STORED = { id: PRESENTATION, title: 'T', slides: TITLES.map((title, i) => ({ layout: 'C1', slide_id: `L${i}`, content: { slide_title: title }, text_boxes: [], images: [] })) }
const FRAME = JSON.parse(read('scripts/fixtures/studio-job-ledger/directive-never-answered.json')).directive_and_running_row[0] // Director's recorded element_directive (a CHART on slide 4, 23 Oct)
assert.equal(FRAME.type, 'element_directive')
const PROMPT = { TEXT_BOX: 'Add a note: fresh produce turnover is the biggest lever', IMAGE: 'A picture of a market stall', CHART: 'Revenue by region, Q4', METRICS: 'Three KPIs for Q4', TABLE: 'A table of regions and revenue' }
let counter = 0
const directive = (type, extra = {}) => ({ ...plain(FRAME.payload), directive_id: `el_t${++counter}`, element_type: type, prompt: PROMPT[type] ?? 'x', slide_index: 1, grid_hint: null, ...extra })
const COLLECTION = { TEXT_BOX: 'text_boxes', IMAGE: 'images', CHART: 'charts', METRICS: 'text_boxes' }
const TYPES = ['TEXT_BOX', 'IMAGE', 'CHART']
const tableRows = [] // [type, mode, whole-deck PUTs, chat-save PUTs, version summaries, text boxes stored per slide, elements stored per slide]
const frameOf = result => JSON.stringify({ ...result, directive_id: 'd' }) // the result frame, whatever the directive id was

/** One scenario (named; recorded and replayed by name). `transcriptFrom`: the recording an overridden (mutated or base) run replays offline. */
async function scenario(name, { studio = 'on', layout = 'on', type = 'TEXT_BOX', stored = STORED, overrides = {}, layoutScript = null, putDelayMs = 0, putStatus = 200, beforeRun = null, transcriptFrom = null, leaseCurrent = null, run: payloadExtra = {}, insertPersist = true } = {}) {
  const mutated = Object.keys(overrides).length > 0 || Boolean(layoutScript)
  const env = { ...(studio === 'on' ? ENV_ON : ENV_OFF), ...(insertPersist ? {} : { NEXT_PUBLIC_STUDIO_INSERT_PERSIST: 'false' }) }
  const server = LIVE && putDelayMs === 0 && putStatus === 200 ? { deck: plain(stored), statuses: [], summaries: [] } : null // a stand-in answer (a slow or a refused PUT) replaces Layout's server for the budget scenarios
  const key = transcriptFrom ?? name
  if (!LIVE && !recorded.scenarios[key]) throw new Error(`a recorded Layout transcript for "${key}" (record with CHAT_ADD_TARGETED_LAYOUT_DIR=... --record-layout)`)
  const world = await createAddWorld({ root, layoutDir: LIVE ? LAYOUT_DIR : null, env, overrides, layout, stored, server, python: PYTHON, putDelayMs, putStatus, layoutScript, beforeRun, leaseCurrent,
    transcript: LIVE ? null : recorded.scenarios[key] })
  const w = {
    world, name, mutated, type,
    sent: world.sent, toasts: world.toasts, notes: world.consoleNotes,
    fetches: () => (LIVE ? world.fetches() : recorded.scenarios[key].fetches),
    server: () => (LIVE ? server : recorded.scenarios[key].server),
    actions: () => world.viewer.log.requests.map(item => item.action),
    probe: () => (LIVE ? world.probe() : recorded.scenarios[key].probe),
    async add(extra = {}) {
      const result = await world.directive(directive(type, { ...payloadExtra, ...extra }))
      w.result = result
      return result
    },
    finish() {
      if (RECORD && !mutated) recorded.scenarios[name] = { ...plain(world.viewer.log), fetches: plain(world.fetches()), server: plain(server), notes: world.consoleNotes, result: w.result ?? null, probe: world.probe() }
      if (LIVE && !RECORD && !mutated) {
        const was = recorded.scenarios[name]
        assert.deepEqual(plain(world.viewer.log.requests), was.requests, `${name}: the live viewer was asked what was recorded`)
        assert.deepEqual(plain(world.viewer.log.frames), was.frames, `${name}: the live viewer answered what was recorded`)
        assert.deepEqual(plain(world.fetches()), was.fetches, `${name}: the live viewer saved what was recorded`)
        assert.deepEqual(plain(server), was.server, `${name}: Layout's server stored what was recorded`)
        assert.deepEqual(world.consoleNotes, was.notes, `${name}: the same notes`)
        assert.deepEqual(world.probe(), was.probe, `${name}: the same viewer state at the end`)
      }
      if (!LIVE) {
        assert.equal(world.viewer.log.requests.length, recorded.scenarios[key].requests.length, `${name}: every recorded request was made (no more, no fewer)`)
        assert.equal(world.viewer.log.divergence, null, `${name}: no request diverged from the recording`)
      }
    },
  }
  return w
}

const putsTo = (fetches, re) => fetches.filter(item => item.method === 'PUT' && re.test(item.url))
const WHOLE_DECK = new RegExp(`/api/presentations/${PRESENTATION}/slides$`)
const CHAT_SAVE = /\/slides\/\d+\/elements\/[^/]+\/chat-save$/
const storedTextBoxes = deck => deck.slides.map(slide => (slide.text_boxes || []).length)
const elementCounts = slide => ['text_boxes', 'images', 'charts', 'infographics', 'diagrams'].reduce((sum, name) => sum + (slide[name] || []).length, 0)
const layoutTextBoxIds = deck => deck.slides.map(slide => (slide.text_boxes || []).map(box => box.id))

// ===== 1. the flag ==========================================================================================================================
/** One lib of this checkout in a vm with `env` as process.env (the world's loader, without a viewer: a flag needs none). */
function loadLib(env, overrides = {}) {
  const cache = new Map()
  const load = file => {
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }
    cache.set(file, module)
    const out = ts.transpileModule(overrides[file] ?? read(file), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
    vm.runInNewContext(out, { module, exports: module.exports, process: { env }, console, Promise, Error, JSON, Set, Map, Object, Array, Number, String, Boolean, setTimeout, clearTimeout,
      require(spec) { if (spec.startsWith('@/')) for (const ext of ['.ts', '.tsx']) if (fs.existsSync(path.join(root, spec.slice(2) + ext))) return load(spec.slice(2) + ext); throw new Error(`unexpected dependency ${spec} of ${file}`) } }, { filename: file })
    return module.exports
  }
  return load(LIB)
}
await check('flag: on only for the exact "true" of NEXT_PUBLIC_STUDIO_CHAT_ADD_TARGETED_SAVE (it does not need #540\'s flag); .env.example has the block after a blank line', async () => {
  assert.equal(loadLib(ENV_ON).CHAT_ADD_TARGETED_SAVE_ENABLED, true)
  assert.equal(loadLib(ENV_OFF).CHAT_ADD_TARGETED_SAVE_ENABLED, false)
  for (const value of ['1', 'TRUE', 'yes', ' true', 'True', '']) assert.equal(loadLib({ ...ENV_OFF, [FLAG]: value }).CHAT_ADD_TARGETED_SAVE_ENABLED, false, JSON.stringify(value))
  assert.equal(loadLib({ [FLAG]: 'true' }).CHAT_ADD_TARGETED_SAVE_ENABLED, true, 'the flag stands alone')
  const env = read('.env.example')
  assert.ok(env.includes(`\n\n${CHAT_ADD_TARGETED_ENV_BLOCK}`), 'the .env.example block, after a blank line')
  assert.ok(withoutLaterEnvBlocks(env).endsWith(`${FLAG}="false"\n`), 'the block is the last of this change and above it, the blocks registered after this one aside')
})
function laterBlocks() { const at = registry.LATER_ENV_BLOCKS.indexOf(CHAT_ADD_TARGETED_ENV_BLOCK); return at === -1 ? [] : registry.LATER_ENV_BLOCKS.slice(at + 1) }
function withoutLaterEnvBlocks(text) { return laterBlocks().reduce((out, block) => { const body = String(block).replace(/^\n+/, '').replace(/\n+$/, ''); return body === '' ? out : out.replace(`\n${body}\n`, () => '') }, text) }

// ===== 2. the root cause, flags off (today) =================================================================================================
const offRuns = {}
for (const type of TYPES) {
  await check(`root cause (flags off): a chat ${type} add on slide 2 is ONE whole-deck "Auto-save from editor" PUT; the layout text of slides 1 and 3 is stored as text boxes (they had none)`, async () => {
    const w = await scenario(`off-${type}`, { studio: 'off', type })
    const result = await w.add()
    offRuns[type] = result
    assert.equal(result.status, 'inserted')
    const whole = putsTo(w.fetches(), WHOLE_DECK)
    assert.equal(whole.length, 1, 'one whole-deck save')
    assert.equal(putsTo(w.fetches(), CHAT_SAVE).length, 0)
    assert.equal(whole[0].body.change_summary, 'Auto-save from editor')
    assert.equal(whole[0].body.slides.length, 3, 'every slide is in the save')
    const stored = w.server().deck
    assert.ok(storedTextBoxes(stored)[0] > 0 && storedTextBoxes(stored)[2] > 0, `slides 1 and 3 now hold stored text boxes: ${storedTextBoxes(stored)}`)
    assert.ok(w.server().summaries.includes('Auto-save from editor'))
    assert.ok(!w.actions().some(action => /TargetedElementSave/.test(action)), 'no begin / commit')
    assert.deepEqual(w.actions().filter(action => action.startsWith('insert')).length, 1, 'one insert')
    assert.ok(!w.actions().includes('deleteElement'), 'no placeholder to delete')
    tableRows.push([type, 'flags OFF', putsTo(w.fetches(), WHOLE_DECK).length, 0, w.server().summaries.join(' | '), storedTextBoxes(stored).join('/'), stored.slides.map(elementCounts).join('/')])
    w.finish()
  })
}

// ===== 3. flags on: only the new element ====================================================================================================
const onRuns = {}
for (const type of TYPES) {
  await check(`flags on: a chat ${type} add on slide 2 saves ONLY the new element (one chat-save PUT), no whole-deck save even after the debounce; nothing is stored on slides 1 and 3; exactly one element more on slide 2`, async () => {
    const w = await scenario(`on-${type}`, { type })
    const result = await w.add()
    onRuns[type] = result
    assert.equal(result.status, 'inserted')
    assert.equal(typeof result.element_id, 'string')
    const fetches = w.fetches()
    assert.equal(putsTo(fetches, WHOLE_DECK).length, 0, 'no whole-deck save')
    assert.equal(fetches.length, 1, 'one request to Layout in all')
    const [save] = fetches
    assert.equal(save.method, 'PUT')
    assert.equal(save.url, `/api/presentations/${PRESENTATION}/slides/1/elements/${result.element_id}/chat-save`, 'the id is the one the insert answered')
    assert.equal(save.body.slide_id, 'L1')
    assert.equal(save.body.collection, COLLECTION[type])
    assert.equal(save.body.element.id, result.element_id)
    assert.deepEqual(save.body.siblings, [], 'no sibling record')
    const stored = w.server().deck
    assert.deepEqual(storedTextBoxes(stored).filter((_, i) => i !== 1), [0, 0], 'no layout text stored on slides 1 and 3')
    assert.equal(elementCounts(stored.slides[1]), 1, 'slide 2 gained exactly one element')
    assert.equal(elementCounts(stored.slides[0]) + elementCounts(stored.slides[2]), 0)
    assert.equal(stored.slides[1][COLLECTION[type]].length, 1)
    assert.deepEqual(w.server().statuses, [200])
    assert.deepEqual(w.server().summaries, ['Chat edit: one element on slide 2'], 'one Layout version, no "Auto-save from editor"')
    const actions = w.actions()
    const at = name => actions.indexOf(name)
    const begins = actions.map((action, i) => action === 'beginTargetedElementSave' ? i : -1).filter(i => i >= 0)
    assert.equal(begins.length, 2, 'begin on an element that is already there, then on the new one')
    const insert = actions.findIndex(action => action.startsWith('insert'))
    assert.ok(begins[0] < insert && insert < at('cancelTargetedElementSave') && at('cancelTargetedElementSave') < begins[1] && begins[1] < at('commitTargetedElementSave'), actions.join(','))
    assert.ok(!actions.includes('saveAllChanges') && !actions.includes('deleteElement'))
    const asked = w.world.viewer.log.requests
    assert.equal(asked[begins[1]].params.elementId, result.element_id, 'the second begin is the new element')
    assert.notEqual(asked[begins[0]].params.elementId, result.element_id, 'the first begin is an element that was already on the slide')
    assert.match(w.notes.join('|'), /saved: only the new element/)
    tableRows.push([type, 'flags ON', 0, putsTo(fetches, CHAT_SAVE).length, w.server().summaries.join(' | '), storedTextBoxes(stored).join('/'), stored.slides.map(elementCounts).join('/')])
    w.finish()
  })
}
for (const type of ['METRICS', 'SHAPE', 'ICON_LABEL']) await check(`flags on, a ${type} add (an insertTextBox too) is saved the same way: one text box record, nothing else stored`, async () => {
  const w = await scenario(`on-${type}`, { type })
  const result = await w.add()
  assert.equal(result.status, 'inserted')
  assert.equal(w.fetches().length, 1)
  assert.match(w.fetches()[0].url, /\/slides\/1\/elements\/[^/]+\/chat-save$/)
  assert.deepEqual(storedTextBoxes(w.server().deck), [0, 1, 0])
  w.finish()
})
await check('flags on: the result frame is byte-identical to flag off\'s (the same ids, the same status), for each type', async () => {
  for (const type of TYPES) assert.equal(frameOf(onRuns[type]), frameOf(offRuns[type]), type)
})

console.log('\nCHAT ADD (slide 2 of 3; the layout title of every slide is layout text, none stored as a text box before the add)')
console.log('| type | mode | whole-deck PUTs | chat-save PUTs | Layout version | stored text boxes (slides 1/2/3) | stored elements (slides 1/2/3) |')
console.log('|---|---|---|---|---|---|---|')
for (const row of tableRows) console.log(`| ${row.join(' | ')} |`)

// ===== 3b. the stored deck reloads: what shows after a real reload, flags on vs off =========================================================
const nodesOf = (viewer, i) => viewer.slide(i).querySelectorAll('.inserted-textbox').length
function reloadRecord(w) {
  const server = w.server(), id = w.result.element_id
  const original = createLayoutViewer({ layoutDir: LAYOUT_DIR, studioOrigin: STUDIO_ORIGIN, parent: { postMessage() {} }, clock: createClock(), presentationId: PRESENTATION, arrange: true, targeted: false })
  renderStoredDeck(original, STORED, LAYOUT_DIR)
  const fresh = createLayoutViewer({ layoutDir: LAYOUT_DIR, studioOrigin: STUDIO_ORIGIN, parent: { postMessage() {} }, clock: createClock(), presentationId: PRESENTATION, arrange: true, targeted: false })
  renderStoredDeck(fresh, server.deck, LAYOUT_DIR)
  return { present: Boolean(fresh.document.getElementById(id)), textBoxNodes: [0, 1, 2].map(i => nodesOf(fresh, i)), originalTextBoxNodes: [0, 1, 2].map(i => nodesOf(original, i)), storedTextBoxes: storedTextBoxes(server.deck) }
}
const reloads = {}
for (const type of ['TEXT_BOX', 'IMAGE']) for (const flag of ['off', 'on']) {
  await check(`reload (${type}, flags ${flag}): the stored deck loaded by Layout's own load path shows the new element${flag === 'on' ? ' and every slide\'s layout text exactly once, as layout text' : ''}`, async () => {
    const name = `reload-${flag}-${type}`
    let record
    if (LIVE) {
      const w = await scenario(name, { studio: flag, type })
      await w.add(); record = reloadRecord(w); w.finish()
      if (RECORD) recorded.reload[name] = record; else assert.deepEqual(plain(record), recorded.reload[name], `${name}: the live reload is what was recorded`)
    } else {
      const w = await scenario(name, { studio: flag, type })
      await w.add(); w.finish(); record = recorded.reload[name]
    }
    reloads[name] = record
    assert.equal(record.present, true, 'the new element is there after a reload')
    if (flag === 'on') {
      assert.deepEqual(record.storedTextBoxes, [0, type === 'TEXT_BOX' ? 1 : 0, 0])
      assert.deepEqual(record.textBoxNodes.map((n, i) => n - (i === 1 && type === 'TEXT_BOX' ? 1 : 0)), record.originalTextBoxNodes, 'the layout text is drawn once per slide, as the unedited deck draws it')
    }
  })
}
await check('reload: flags on never keep LESS than flags off (the new element survives a reload under both), and flags off store the layout text of other slides as text boxes where flags on do not', async () => {
  for (const type of ['TEXT_BOX', 'IMAGE']) {
    assert.equal(reloads[`reload-on-${type}`].present, reloads[`reload-off-${type}`].present)
    assert.ok(reloads[`reload-off-${type}`].storedTextBoxes[0] > 0 && reloads[`reload-on-${type}`].storedTextBoxes[0] === 0)
  }
})

// ===== 4. Layout's flag off ==================================================================================================================
await check('Studio\'s flag on, Layout\'s flag off: today\'s path, reported as such (the editor\'s autosave stores the add; the whole-deck PUT is the defect again); begin was refused before anything changed; no scope is left open, no silent ok', async () => {
  const w = await scenario('on-layout-off', { layout: 'off' })
  const result = await w.add()
  assert.equal(result.status, 'inserted', 'the add is still made and saved, as today')
  assert.equal(putsTo(w.fetches(), WHOLE_DECK).length, 1, 'saved by the editor\'s autosave')
  assert.equal(putsTo(w.fetches(), CHAT_SAVE).length, 0)
  assert.match(w.notes.join('|'), /by the editor's autosave \(Layout's targeted save is not available: Unknown action: beginTargetedElementSave\)/, 'honestly reported')
  const actions = w.actions()
  assert.equal(actions.filter(action => action === 'beginTargetedElementSave').length, 1, 'one refused begin, before the insert')
  assert.ok(actions.indexOf('beginTargetedElementSave') < actions.findIndex(action => action.startsWith('insert')))
  assert.ok(!actions.includes('commitTargetedElementSave') && !actions.includes('cancelTargetedElementSave'))
  assert.equal(JSON.stringify(w.fetches()), JSON.stringify((await scenarioFetches('off-TEXT_BOX'))), 'the save is byte for byte flag off\'s')
  w.finish()
})
async function scenarioFetches(name) { const w = await scenario(name, { studio: 'off' }); await w.add(); const out = w.fetches(); w.finish(); return out }

// ===== 5. the placeholder is never stored =====================================================================================================
await check('placeholder: a chat add inserts none (one insert, no delete, no blank-element markup); a blank placeholder box on the slide at commit time is not in the save and is not stored', async () => {
  const blank = { elementId: 'blank_placeholder_1', slideIndex: 1, gridRow: '8/14', gridColumn: '20/30', content: '<div data-blank-element="blank_placeholder_1">Click to configure</div>', zIndex: 10 }
  const w = await scenario('on-blank-placeholder', { beforeRun: viewer => { viewer.context.ElementManager.insertTextBox(1, { ...blank, id: blank.elementId }) } })
  const result = await w.add()
  assert.equal(result.status, 'inserted')
  const inserts = w.world.viewer.log.requests.filter(item => item.action.startsWith('insert'))
  assert.equal(inserts.length, 1)
  assert.ok(!JSON.stringify(inserts).includes('data-blank-element'))
  assert.ok(!w.actions().includes('deleteElement'))
  const [save] = w.fetches()
  assert.ok(!JSON.stringify(save.body).includes('blank_placeholder_1') && !JSON.stringify(save.body).includes('Click to configure'))
  assert.ok(!JSON.stringify(w.server().deck).includes('blank_placeholder_1'), 'the placeholder is not stored')
  assert.equal(elementCounts(w.server().deck.slides[1]), 1)
  w.finish()
  // the code says the same: the hook gives a chat-add invocation no blank placeholder, and the runner dismisses a chat add while the panel holds a draft
  assert.match(read(HOOK), /const blankId = invocation \? null : generationPanel\.blankElementId/)
  assert.match(read('app/builder/page.tsx'), /generationPanel\.hasActiveGenerations \|\| panel\.isOpen\)\s*\{\s*report\('dismissed'/)
})

// ===== 6. Undo ==============================================================================================================================
await check('Undo: the ok result frame of a targeted add is byte-identical to today\'s; the save is one Layout version written after the add (the stored deck before it is the one the Undo chip goes back to); chat undo and the Undo chip are untouched', async () => {
  for (const type of TYPES) assert.equal(frameOf(onRuns[type]), frameOf(offRuns[type]), type)
  const w = await scenario('on-TEXT_BOX')
  await w.add()
  assert.deepEqual(w.server().summaries, ['Chat edit: one element on slide 2'])
  assert.deepEqual(w.server().deck.slides.map(slide => slide.slide_id), STORED.slides.map(slide => slide.slide_id), 'the slides are the same slides')
  w.finish()
  for (const rel of ['components/builder/chat/studio-undo-chip.tsx', 'lib/studio-chat-commands.ts']) assert.equal(laterRead(rel), laterStrips(rel, git('show', `${BASE_COMMIT}:${rel}`)), rel)
})

// ===== 7. manual Add Element and manual Edit Mode are unchanged ================================================================================
const MANUAL = { componentType: 'TEXT_BOX', prompt: 'A note', count: 1, layout: 'horizontal', advancedModified: false, z_index: 1, itemsPerInstance: 1, textboxConfig: {}, semanticRole: 'BODY_TEXT', geometryMode: 'AUTO' }
async function manualAdd(name, studio) {
  const w = await scenario(name, { studio })
  w.world.textLabs.length = 0
  const outcome = await w.world.manualGenerate(plain(MANUAL))
  await w.world.clock.advance(10_000)
  return { w, outcome }
}
await check('manual Add Element (no chat invocation) with the flag ON is unchanged: the same requests, the same whole-deck save, byte for byte, as flag off', async () => {
  const off = await manualAdd('manual-add-off', 'off'), on = await manualAdd('manual-add-on', 'on')
  assert.equal(on.outcome.status, 'inserted')
  assert.deepEqual(on.w.actions(), off.w.actions())
  assert.ok(!on.w.actions().some(action => /TargetedElementSave/.test(action)))
  assert.equal(putsTo(on.w.fetches(), WHOLE_DECK).length, 1)
  assert.equal(sha(JSON.stringify(on.w.fetches())), sha(JSON.stringify(off.w.fetches())))
  assert.equal(sha(JSON.stringify(on.w.server())), sha(JSON.stringify(off.w.server())))
  off.w.finish(); on.w.finish()
})
async function chatThenManual(name, options = {}) {
  const w = await scenario(name, options)
  assert.equal((await w.add()).status, 'inserted')
  const id = w.result.element_id
  const reply = await w.world.manual('resizeTextBox', { elementId: id, gridRow: '6/12', gridColumn: '3/17' })
  assert.equal((await reply).success, true)
  return w
}
await check('manual Edit Mode after a chat add: the scope is closed, the next manual change on the same slide is tracked and saved by the editor\'s whole-deck save, as before', async () => {
  const w = await chatThenManual('on-then-manual')
  assert.equal(putsTo(w.fetches(), CHAT_SAVE).length, 1)
  assert.equal(putsTo(w.fetches(), WHOLE_DECK).length, 1, 'the manual change: the editor\'s save')
  w.finish()
})

// ===== 8. failures and fallbacks ================================================================================================================
await check('an insert that fails: the scope is cancelled (no scope left open, so the next manual change on the slide is saved), nothing is saved by the chat add, and the add is reported failed', async () => {
  const w = await scenario('on-insert-fails', { type: 'IMAGE', beforeRun: viewer => { viewer.context.ElementManager.__insertImage = viewer.context.ElementManager.insertImage; viewer.context.ElementManager.insertImage = () => ({ success: false, error: 'Image URL could not be rendered safely' }) } })
  const result = await w.add()
  assert.equal(result.status, 'failed')
  assert.equal(w.fetches().length, 0, 'nothing was saved')
  const actions = w.actions()
  assert.ok(actions.includes('beginTargetedElementSave') && actions.includes('cancelTargetedElementSave') && !actions.includes('commitTargetedElementSave'), actions.join(','))
  assert.equal(w.probe().scopeOpen, false, 'no scope is open')
  w.finish()
})
for (const [label, name, options, expectOk] of [
  ['a PUT that takes 8 s (past the 5 s command budget): commit answers pending, the status reads saved, the add is ok', 'budget-slow-8s', { putDelayMs: 8_000 }, true],
  ['a PUT that takes 18 s (inside the 20 s budget): ok', 'budget-slow-18s', { putDelayMs: 18_000 }, true],
  ['a PUT Layout refuses (500): the add FAILS (never ok:true on an unsaved element)', 'budget-refused', { putStatus: 500 }, false],
  ['a PUT still unanswered at the end of the budget (30 s): the add FAILS, never ok', 'budget-too-slow', { putDelayMs: 30_000 }, false],
]) {
  await check(`commit: ${label}`, async () => {
    const w = await scenario(name, options)
    const result = await w.add()
    assert.equal(result.status, expectOk ? 'inserted' : 'failed', JSON.stringify(result))
    assert.equal(putsTo(w.fetches(), CHAT_SAVE).length, 1)
    assert.equal(putsTo(w.fetches(), WHOLE_DECK).length, 0)
    const statuses = w.actions().filter(action => action === 'getTargetedElementSaveStatus').length
    assert.ok(options.putDelayMs ? statuses > 0 : statuses === 0, `${statuses} status reads`)
    if (!expectOk) {
      assert.match(result.error, /could not be saved on its own/)
      const actions = w.actions()
      assert.equal(actions.filter(action => action === 'deleteElement').length, 1, 'the element that was never stored is taken off the slide, once')
      assert.equal(actions.filter(action => action === 'beginTargetedElementSave').length, 3, 'anchor, new element, anchor again for the removal (its change mark is held too)')
      assert.equal(actions.filter(action => action === 'cancelTargetedElementSave').length, 2)
      assert.equal(w.probe().scopeOpen, false, 'no scope is left open')
    }
    w.finish()
  })
}
await check('an owner change right after the insert (the viewer is no longer the one the add started on): the add ends changed, no commit and no save is sent', async () => {
  let current = true
  const w = await scenario('on-owner-changes', { leaseCurrent: () => current })
  w.world.onCommand = action => { if (action === 'cancelTargetedElementSave') current = false }
  const result = await w.add()
  assert.equal(result.status, 'failed')
  assert.ok(!w.actions().includes('commitTargetedElementSave'))
  assert.equal(w.actions().filter(action => action === 'beginTargetedElementSave').length, 1, 'no begin for the new element once the owner changed')
  assert.equal(w.fetches().length, 0)
  w.finish()
})
await check('no element on the slide to hold the marks with: today\'s path (the editor\'s autosave), reported; nothing opened, nothing left open', async () => {
  const w = await scenario('on-no-anchor', { beforeRun: viewer => { const manager = viewer.context.ElementManager; for (const [id, data] of [...manager._registry]) if (data.slideIndex === 1) { manager._registry.delete(id); viewer.document.getElementById(id)?.remove() } } })
  const result = await w.add()
  assert.equal(result.status, 'inserted')
  assert.match(w.notes.join('|'), /by the editor's autosave \(the slide has no element to hold its change marks with\)/)
  assert.ok(!w.actions().some(action => /beginTargetedElementSave|commitTargetedElementSave/.test(action)))
  assert.equal(putsTo(w.fetches(), WHOLE_DECK).length, 1)
  w.finish()
})
await check('another targeted save is open (BUSY): today\'s path, reported; the other scope is not touched', async () => {
  const w = await scenario('on-busy', { beforeRun: viewer => { const anchor = viewer.slide(0).querySelectorAll('.inserted-textbox')[0]; const begun = viewer.context.LayoutChatTargetedSave.run('beginTargetedElementSave', { elementId: anchor.id, slideIndex: 0 }); void begun } })
  const result = await w.add()
  assert.equal(result.status, 'inserted')
  assert.match(w.notes.join('|'), /by the editor's autosave \(Layout's targeted save is not available: Another targeted save is open\)/)
  assert.equal(w.probe().scopeOpen, true, 'the other scope is still open (not cancelled by the add)')
  assert.ok(!w.actions().some(action => /commitTargetedElementSave|cancelTargetedElementSave/.test(action)))
  w.finish()
})
await check('a begin that answers success without a saveId is not a scope: today\'s path, reported (never a commit on nothing)', async () => {
  const w = await scenario('on-begin-without-saveid', { beforeRun: viewer => {
    const real = viewer.context.LayoutChatTargetedSave
    viewer.context.LayoutChatTargetedSave = { ACTIONS: real.ACTIONS, isOpen: real.isOpen, run: async (action, params) => (action === 'beginTargetedElementSave' ? { success: true, elementId: params.elementId, slideIndex: params.slideIndex, collection: 'text_boxes' } : real.run(action, params)) } } })
  const result = await w.add()
  assert.equal(result.status, 'inserted')
  assert.match(w.notes.join('|'), /by the editor's autosave \(Layout's targeted save is not available: Command failed\)/)
  assert.ok(!w.actions().some(action => /commitTargetedElementSave|cancelTargetedElementSave/.test(action)))
  assert.equal(putsTo(w.fetches(), WHOLE_DECK).length, 1)
  w.finish()
})
await check('a cited table upsert (a TABLE add) is not one Layout stores on its own: today\'s path, reported', async () => {
  const w = await scenario('on-table', { type: 'TABLE' })
  const result = await w.add()
  assert.equal(result.status, 'inserted')
  assert.match(w.notes.join('|'), /by the editor's autosave \(upsertCitedElement is not saved on its own\)/)
  assert.ok(!w.actions().some(action => /TargetedElementSave/.test(action)))
  w.finish()
})

// ===== 9. flag off is identical =================================================================================================================
await check('flag off: the strip gives back dev\'s hook byte for byte (every added line is marked, pure insertions), and the .env.example block comes out with its blank line; all read past the changes registered after this one', async () => {
  for (const rel of CHAT_ADD_TARGETED_FILES) {
    const base = git('show', `${BASE_COMMIT}:${rel}`), now = laterRead(rel)
    assert.equal(sha(stripChatAddTargeted(rel, now)), sha(base), rel)
    const added = now.split('\n').length - base.split('\n').length
    assert.equal(now.split('\n').filter(line => CHAT_ADD_TARGETED_MARKER_RE.test(line)).length, added, `${rel}: every added line carries the marker`)
    assert.ok(added > 0)
  }
  assert.equal(withoutLaterEnvBlocks(read('.env.example')), `${git('show', `${BASE_COMMIT}:.env.example`)}\n${CHAT_ADD_TARGETED_ENV_BLOCK}`, 'the base, one blank line, the block')
  assert.equal(registry.stripLaterEnvBlocks('.env.example', read('.env.example')), registry.stripLaterEnvBlocks('.env.example', git('show', `${BASE_COMMIT}:.env.example`)), 'the registry takes the block out')
  for (const rel of CHAT_ADD_TARGETED_NEW_FILES) assert.ok(fs.existsSync(path.join(root, rel)), rel)
  for (const rel of CHAT_ADD_TARGETED_PIN_FILES) {
    assert.equal(sha(stripChatAddTargeted(rel, laterRead(rel))), sha(git('show', `${BASE_COMMIT}:${rel}`)), `${rel}: the proof this change taught, put back, is dev's`)
    for (const [has] of CHAT_ADD_TARGETED_PIN_EDITS[rel]) for (const line of has.split('\n').filter(Boolean)) assert.ok(line.includes(CHAT_ADD_TARGETED_PIN_MARK), `${rel}: a taught line carries the pin mark`)
  }
})
await check('flag off: the BASE hook (this hook without its marked lines) and this hook make the same requests, the same saves and the same result for each type; neither sends a begin', async () => {
  for (const type of TYPES) {
    const base = await scenario(`off-${type}`, { studio: 'off', type, overrides: { [HOOK]: stripChatAddTargeted(HOOK, hookText) }, transcriptFrom: `off-${type}` })
    const result = await base.add()
    assert.equal(frameOf(result), frameOf(offRuns[type]), `${type}: the same result`)
    if (LIVE) {
      const now = await scenario(`off-${type}`, { studio: 'off', type })
      await now.add()
      assert.equal(sha(JSON.stringify([base.world.viewer.log.requests.map(item => [item.action, item.params]), base.fetches(), base.server()])), sha(JSON.stringify([now.world.viewer.log.requests.map(item => [item.action, item.params]), now.fetches(), now.server()])), `${type}: requests, saves and stored deck hash-equal`)
    }
    base.finish()
    assert.ok(!base.actions().some(action => /TargetedElementSave/.test(action)))
  }
})
await check('flag off: the flag-off scenarios are the recording of today\'s code path (a whole-deck save, no begin) for every type', async () => {
  for (const type of TYPES) {
    const was = recorded.scenarios[`off-${type}`] ?? (RECORD ? { requests: [], fetches: [] } : null)
    assert.ok(was)
    if (!RECORD) { assert.ok(!was.requests.some(item => /TargetedElementSave/.test(item.action))); assert.equal(putsTo(was.fetches, WHOLE_DECK).length, 1) }
  }
})

// ===== 10. mutants ===============================================================================================================================
const libText = read(LIB)
const settle = w => { if (!LIVE) w.finish() } // offline a mutant is caught by the replay: a request the recording does not have, or one it has that was never made
const swap = (text, from, to) => { assert.equal(text.split(from).length, 2, from); return text.replace(from, to) }
const runOn = async (name, overrides, options = {}) => {
  const w = await scenario(name, { overrides, transcriptFrom: options.transcriptFrom ?? name, ...options })
  const result = await w.add()
  if (LIVE) {
    assert.equal(result.status, 'inserted')
    assert.equal(putsTo(w.fetches(), WHOLE_DECK).length, 0)
    assert.equal(putsTo(w.fetches(), CHAT_SAVE).length, 1)
    assert.deepEqual(storedTextBoxes(w.server().deck), [0, 1, 0])
    assert.equal(w.server().deck.slides[1].text_boxes[0].id, result.element_id, 'the stored text box is the new element')
  } else {
    assert.equal(result.status, 'inserted')
    assert.equal(w.world.viewer.log.divergence, null)
    assert.equal(w.world.viewer.log.requests.length, recorded.scenarios[options.transcriptFrom ?? name].requests.length)
  }
}
await mutant('hook: the scope opening removed (the whole-deck save comes back)', () => runOn('on-TEXT_BOX', { [HOOK]: stripChatAddTargeted(HOOK, hookText) }))
await mutant('hook: the new element\'s save removed (the anchor\'s scope is cancelled and nothing is saved: ok without a save)', () => runOn('on-TEXT_BOX', { [HOOK]: hookText.split('\n').filter(line => !line.includes('await scope.finish(insertedElementId)')).join('\n') }))
await mutant('hook: a manual generation (no chat invocation) is scoped too', async () => {
  const mutated = swap(hookText, "if (CHAT_ADD_TARGETED_SAVE_ENABLED && invocation?.kind === 'chat-add') {", 'if (CHAT_ADD_TARGETED_SAVE_ENABLED) {')
  const off = await manualAdd('manual-add-off', 'off')
  const w = await scenario('manual-add-on', { overrides: { [HOOK]: mutated } })
  await w.world.manualGenerate(plain(MANUAL)); await w.world.clock.advance(10_000)
  assert.deepEqual(w.actions(), off.w.actions()); settle(w)
})
await mutant('hook: the catch no longer cancels (a failed insert leaves Layout\'s scope open)', async () => {
  const mutated = hookText.split('\n').filter(line => !line.includes('await chatAddScope.cancel()')).join('\n')
  const w = await scenario('on-insert-fails', { type: 'IMAGE', overrides: { [HOOK]: mutated }, beforeRun: viewer => { viewer.context.ElementManager.insertImage = () => ({ success: false, error: 'Image URL could not be rendered safely' }) } })
  await w.add()
  if (LIVE) assert.equal(w.probe().scopeOpen, false); else w.finish()
})
await mutant('lib: the new element\'s commit never sent (ok without a save)', () => runOn('on-TEXT_BOX', { [LIB]: swap(libText, 'const result = await runTargetedElementSave({', 'const result = await (async (_unused) => ({ ok: true }))({') }))
await mutant('lib: the anchor\'s scope left open (the new element\'s begin is refused: BUSY)', () => runOn('on-TEXT_BOX', { [LIB]: swap(libText, '      await close()\n      if (!ctx.owns())', '      if (!ctx.owns())') }))
await mutant('lib: the commit saves the anchor, not the new element (a layout text box stored)', () => runOn('on-TEXT_BOX', { [LIB]: swap(libText, "directiveId: 'chat-add', elementId, slideIndex", "directiveId: 'chat-add', elementId: anchorId, slideIndex") }))
await mutant('lib: a refused begin read as an open scope (no fallback to today\'s path)', async () => {
  const w = await scenario('on-layout-off', { layout: 'off', overrides: { [LIB]: swap(libText, "    return today(`Layout's targeted save is not available: ${messageOf(error) || 'no answer'}`)", "    saveId = 'x'") }, transcriptFrom: 'on-layout-off' })
  const result = await w.add(); settle(w)
  assert.equal(result.status, 'inserted', 'the add still ends inserted, as today')
  assert.equal(putsTo(w.fetches(), WHOLE_DECK).length, 1)
  assert.match(w.notes.join('|'), /by the editor's autosave/)
})
await mutant('lib: a begin that answers no saveId is accepted', async () => {
  const w = await scenario('on-begin-without-saveid', { overrides: { [LIB]: swap(libText, "    if (!saveId) throw new Error('Command failed')\n  } catch (error) {\n    return today(", "  } catch (error) {\n    return today(") }, transcriptFrom: 'on-begin-without-saveid',
    beforeRun: viewer => { const real = viewer.context.LayoutChatTargetedSave; viewer.context.LayoutChatTargetedSave = { ACTIONS: real.ACTIONS, isOpen: real.isOpen, run: async (action, params) => (action === 'beginTargetedElementSave' ? { success: true, elementId: params.elementId, slideIndex: params.slideIndex, collection: 'text_boxes' } : real.run(action, params)) } } })
  await w.add(); settle(w)
  assert.match(w.notes.join('|'), /by the editor's autosave \(Layout's targeted save is not available: Command failed\)/)
})
await mutant('lib: the unsaved element is not taken off under a scope (the hook\'s own rollback deletes it: a whole-deck save follows)', async () => {
  const w = await scenario('budget-refused', { putStatus: 500, overrides: { [LIB]: swap(libText, '        if (ctx.owns()) await discard(elementId)\n', '') }, transcriptFrom: 'budget-refused' })
  const result = await w.add(); settle(w)
  assert.equal(result.status, 'failed')
  assert.equal(putsTo(w.fetches(), WHOLE_DECK).length, 0, 'no whole-deck save after a failed add')
})
await mutant('lib: the owner check after the insert dropped (a commit goes to a viewer the add no longer owns)', async () => {
  let current = true
  const w = await scenario('on-owner-changes', { leaseCurrent: () => current, overrides: { [LIB]: swap(libText, '      if (!ctx.owns()) throw new Error(CHAT_ADD_CHANGED_MESSAGE)\n      const result', '      const result') }, transcriptFrom: 'on-owner-changes' })
  w.world.onCommand = action => { if (action === 'cancelTargetedElementSave') current = false }
  await w.add(); settle(w)
  assert.equal(w.actions().filter(action => action === 'beginTargetedElementSave').length, 1, 'no begin for the new element once the owner changed')
})
await mutant('lib: the flag reads a loose value', () => assert.equal(loadLib({ ...ENV_OFF, [FLAG]: '1' }, { [LIB]: swap(libText, "=== 'true'", '!== undefined') }).CHAT_ADD_TARGETED_SAVE_ENABLED, false))
await mutant('lib: the insert list takes a cited table upsert', async () => {
  const w = await scenario('on-table', { type: 'TABLE', overrides: { [LIB]: swap(libText, "new Set(['insertTextBox',", "new Set(['upsertCitedElement', 'insertTextBox',") }, transcriptFrom: 'on-table' })
  await w.add(); settle(w)
  assert.ok(!w.actions().some(action => /TargetedElementSave/.test(action)))
})
await mutant('lib: a pending commit read as failed (no status reads: a slow write fails the add)', async () => {
  const mutated = swap(read('lib/chat-edit-targeted.ts'), 'answer?.pending === true && waited', 'false && waited')
  const w = await scenario('budget-slow-8s', { putDelayMs: 8_000, overrides: { 'lib/chat-edit-targeted.ts': mutated }, transcriptFrom: 'budget-slow-8s' })
  assert.equal((await w.add()).status, 'inserted'); settle(w)
})
await mutant('lib: a status read that says saving taken as saved (ok before the write lands)', async () => {
  const mutated = swap(read('lib/chat-edit-targeted.ts'), "answer = read?.state === 'saving' ? answer : read", "answer = read?.state === 'saving' ? { saved: true } : read")
  const w = await scenario('budget-too-slow', { putDelayMs: 30_000, overrides: { 'lib/chat-edit-targeted.ts': mutated }, transcriptFrom: 'budget-too-slow' })
  assert.equal((await w.add()).status, 'failed'); settle(w)
})
if (LIVE && !RECORD) {
  // The REAL Layout script, mutated, loaded over the served one (window.LayoutChatTargetedSave is looked up at each command).
  const layoutMutant = (from, to) => text => swap(text, from, to)
  await mutant('Layout script: the chat add\'s marks reach auto-save.js (the whole-deck save comes back)', () => runOn('on-TEXT_BOX', {}, { layoutScript: layoutMutant('        scope.held += 1;\n        return;\n', '        scope.held += 1;\n') }))
  await mutant('Layout script: cancel leaves the scope open (the next manual change is held, never saved)', async () => {
    const w = await chatThenManual('on-then-manual', { layoutScript: layoutMutant('    close(scope);\n    return { success: true, cancelled: true };', '    return { success: true, cancelled: true };') })
    assert.equal(putsTo(w.fetches(), CHAT_SAVE).length, 1)
  })
}

// ===== 11. scope over the COMMITTED diff (BASE..head), gate-safe and robust after merge ==========================================================
console.log('scope over the committed diff (own commits by subject across `rev-list --no-merges BASE..head`)')
const GIT_IDENT = { GIT_AUTHOR_NAME: 'gate', GIT_AUTHOR_EMAIL: 'gate@example.invalid', GIT_COMMITTER_NAME: 'gate', GIT_COMMITTER_EMAIL: 'gate@example.invalid', GIT_AUTHOR_DATE: '2026-10-28T00:00:00Z', GIT_COMMITTER_DATE: '2026-10-28T00:00:00Z' }
const plumb = (args, input) => execFileSync('git', args, { cwd: root, encoding: 'utf8', ...(input === undefined ? {} : { input }), env: { ...process.env, ...GIT_IDENT }, stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'], maxBuffer: 1 << 28, timeout: 60_000 }).trim()
/** A blob object for `text`, written from a temporary FILE (never `hash-object --stdin`: a large input through a stdin pipe once left a git child waiting forever in another proof's run): stdin ignored, a 60 s timeout, no filters. */
const blobOf = text => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cat-blob-'))
  try { const file = path.join(dir, 'blob'); fs.writeFileSync(file, text); return plumb(['hash-object', '-w', '--no-filters', '--', file]) } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const subjectOf = c => git('log', '-1', '--format=%s', c).trim()
const parentsOf = sha => git('rev-list', '--parents', '-n', '1', sha).trim().split(/\s+/).slice(1)
/** This change's commits: found by SUBJECT across `rev-list --no-merges BASE..head`. A first-parent walk (`firstParentOnly`, the old query, kept for its mutant) sees nothing on the gate's merge and none of this change's commits once a change is stacked after it. */
const ownOf = (head, { firstParentOnly = false } = {}) => git('rev-list', ...(firstParentOnly ? ['--first-parent'] : []), '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => subjectOf(c).startsWith(CHAT_ADD_TARGETED_SUBJECT))
/** GATE-SAFE head of every scope query. The gate's merge has dev as its FIRST parent (it carries none of this change's commits, whether or not dev has moved past BASE) and this change's head as its SECOND parent: the scope runs against HEAD^2.
 *  On a branch (HEAD is this change's tip, or a merge of dev INTO it, whose first parent is the change) HEAD itself is used. `gateRule: false` is the mutant that drops the rule. */
function scopeHead(ref = 'HEAD', { gateRule = true } = {}) {
  const head = git('rev-parse', `${ref}^{commit}`).trim()
  const parents = parentsOf(head)
  if (!gateRule || parents.length !== 2) return head
  return ownOf(parents[0]).length === 0 && ownOf(parents[1]).length > 0 ? parents[1] : head
}
const applyAll = (list, rel, text) => list.reduce((out, strip) => { const next = strip(rel, out); return typeof next === 'string' ? next : out }, text)
const otherStrips = (rel, text) => applyAll(registry.LATER_STRIPS.filter(strip => strip !== stripChatAddTargeted), rel, text)
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
  assert.deepEqual([...touched].sort(), [...CHAT_ADD_TARGETED_SCOPE_FILES].sort(), 'the files this change\'s own commits touch are exactly its scope')
  for (const rel of CHAT_ADD_TARGETED_FILES) {
    const diff = diffLines(normDiff(ctx, rel, head))
    for (const line of diff) { assert.ok(line.startsWith('+'), `${rel}: a removed line: ${line.slice(0, 120)}`); assert.match(line, CHAT_ADD_TARGETED_MARKER_RE, `${rel}: an unmarked added line: ${line.slice(0, 120)}`) }
    assert.ok(diff.length > 0, `${rel}: the number of added lines`)
    assert.equal(stripChatAddTargeted(rel, ctx.norm(rel, git('show', `${head}:${rel}`))), ctx.norm(rel, git('show', `${BASE_COMMIT}:${rel}`)), `${rel}: without its marked lines the file is the base's, byte for byte`)
  }
  for (const rel of CHAT_ADD_TARGETED_PIN_FILES) assert.equal(stripChatAddTargeted(rel, ctx.norm(rel, git('show', `${head}:${rel}`))), ctx.norm(rel, git('show', `${BASE_COMMIT}:${rel}`)), `${rel}: the proof this change taught, put back, is the base's`)
  for (const rel of CHAT_ADD_TARGETED_NEW_FILES) assert.equal(git('cat-file', '-t', `${head}:${rel}`).trim(), 'blob', rel)
  for (const rel of ['app/builder/page.tsx', 'components/presentation-viewer.tsx', 'lib/studio-insert-persist.ts', 'lib/element-command-router.ts', 'lib/chat-edit-targeted.ts', 'lib/chat-element-edit.ts', 'lib/element-placeholder-defer.ts']) assert.ok(!touched.has(rel), `${rel} is not touched by this change`)
}
const scopeEnvAndRegistry = (head, ctx = REAL) => {
  const env = git('show', `${head}:.env.example`), baseEnv = git('show', `${BASE_COMMIT}:.env.example`)
  assert.equal(ctx.env(env), ctx.env(baseEnv), '.env.example is the base plus the registered blocks and nothing else')
  assert.equal(env.split(CHAT_ADD_TARGETED_ENV_BLOCK).length - 1, 1, 'this change\'s block is there exactly once, verbatim')
  assert.match(env, new RegExp(`\\n\\n${CHAT_ADD_TARGETED_ENV_BLOCK.split('\n')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), 'a blank line before the block')
  const diff = diffLines(git('diff', '-U0', `${BASE_COMMIT}..${head}`, '--', 'scripts/studio-later-changes.mjs'))
  assert.equal(diff.filter(line => line.startsWith('-')).length, 0, 'the registry loses no line')
  const mine = diff.filter(line => line.includes('studio-chat-add-targeted-strip.mjs'))
  assert.equal(mine.length, 3, 'the registry gains exactly this change\'s three lines'); for (const line of mine) assert.ok(line.startsWith('+') && line.includes('// LATER-CHANGE:'), line.slice(0, 140))
  assert.deepEqual(mine.map(line => /\)\.(\w+), \/\//.exec(line)?.[1]), ['CHAT_ADD_TARGETED_SCOPE_FILES', 'CHAT_ADD_TARGETED_ENV_BLOCK', 'stripChatAddTargeted'])
}
const scopeAll = (head, ctx = REAL) => { scopeOwnCommits(head); scopeCommittedFiles(head, ctx); scopeEnvAndRegistry(head, ctx) }

const HEAD = scopeHead('HEAD')
await check(`this change's own commits (subject starts "${CHAT_ADD_TARGETED_SUBJECT}", found across the whole line, no merges) exist, with the co-author line`, () => { scopeOwnCommits(HEAD) })
await check('the committed files are exactly this change\'s; every line added to the hook is a pure insertion that carries the marker; the strip gives the base back byte for byte (other changes\' lines out of both sides); the taught proof put back is the base\'s', () => scopeCommittedFiles(HEAD))
await check('.env.example is the base plus the block (after one blank line); the registry gains exactly its three marked lines and loses none; no secret-shaped literal in the new files', () => {
  scopeEnvAndRegistry(HEAD)
  for (const rel of [...CHAT_ADD_TARGETED_NEW_FILES.filter(rel => !rel.endsWith('.json')), HOOK]) assert.doesNotMatch(fs.readFileSync(path.join(root, rel), 'utf8'), /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY)/, rel)
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
  assert.equal(stripChatAddTargeted(HOOK, otherStrips(HOOK, git('show', `${GATE}:${HOOK}`))), otherStrips(HOOK, git('show', `${BASE_COMMIT}:${HOOK}`)), 'the merged tree, without this change\'s lines, is the base\'s hook')
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cat-idx-'))
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
  const hook = at(HOOK).split('\n').flatMap(line => line.startsWith('    let chatAddScope') ? [line, `    const syntheticLater = 1 // ${SYN.marker}`] : [line]).join('\n')
  const reg = at('scripts/studio-later-changes.mjs').split('\n').flatMap(line => {
    if (line.includes('CHAT_ADD_TARGETED_SCOPE_FILES')) return [line, "  ...(await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_SCOPE_FILES, // LATER-CHANGE: synthetic, stacked after this one"]
    if (line.includes('CHAT_ADD_TARGETED_ENV_BLOCK')) return [line, "  (await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_ENV_BLOCK, // LATER-CHANGE: synthetic, stacked after this one"]
    if (line.includes(').stripChatAddTargeted')) return [line, "  (await import('./studio-synthetic-later-strip.mjs')).stripSynthetic, // LATER-CHANGE: synthetic, stacked after this one"]
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
  assert.equal(stripChatAddTargeted(HOOK, SYN_CTX.norm(HOOK, git('show', `${gate}:${HOOK}`))), SYN_CTX.norm(HOOK, git('show', `${BASE_COMMIT}:${HOOK}`)), 'the merged tree is the base\'s hook without this change\'s and the later change\'s lines')
  const advanced = gateMerge(unrelated, SYNTHETIC)
  assert.equal(scopeHead(advanced), SYNTHETIC); scopeAll(scopeHead(advanced), SYN_CTX)
})
await check('mutant caught: the same synthetic later change fails a scope that is not told about it (its hook line is an unmarked addition, its registry lines extra)', () => {
  assert.throws(() => scopeCommittedFiles(SYNTHETIC), /unmarked added line|exactly its scope/)
  assert.throws(() => scopeEnvAndRegistry(SYNTHETIC), /gains exactly|base plus the registered blocks/)
})
await check('mutant caught: a stray foreign file in a "Targeted chat add:" commit fails the committed-files check (own commits found by subject, the diff names the file)', () => {
  const stray = commitWith(HEAD, { 'stray-chat-add-targeted.txt': 'stray\n' }, `${CHAT_ADD_TARGETED_SUBJECT} a stray file${TRAILER}`)
  assert.ok(ownOf(stray).includes(stray), 'the stray commit is found by its subject')
  assert.doesNotThrow(() => scopeCommittedFiles(HEAD), 'the real head passes')
  assert.throws(() => scopeCommittedFiles(stray), /exactly its scope/, 'the committed-files check must fail on a stray file')
})
await check('mutant caught: an own commit without the co-author line, and an unmarked line added to the hook in an own commit, fail the scope', () => {
  const noTrailer = commitWith(HEAD, {}, `${CHAT_ADD_TARGETED_SUBJECT} no trailer`)
  assert.throws(() => scopeOwnCommits(noTrailer), error => /^[0-9a-f]{8}$/.test(error.message), 'the commit without the trailer is named')
  const sneaky = commitWith(HEAD, { [HOOK]: git('show', `${HEAD}:${HOOK}`).replace('export type TextLabsGenerationResult', 'const sneaky = 1\nexport type TextLabsGenerationResult') }, `${CHAT_ADD_TARGETED_SUBJECT} a sneaky line${TRAILER}`)
  assert.throws(() => scopeCommittedFiles(sneaky), /unmarked added line/)
})
await check('Layout identity: the recording names the Layout files it ran (and, live, they are the files on disk)', async () => {
  if (RECORD) return
  assert.ok(recorded.meta?.sources?.['src/utils/chat-targeted-save.js'] && recorded.meta?.sources?.['chat_targeted_save.py'])
  if (LIVE) for (const [rel, hash] of Object.entries(recorded.meta.sources)) assert.equal(sha(fs.readFileSync(path.join(LAYOUT_DIR, rel), 'utf8')), hash, rel)
})

if (RECORD) {
  recorded.meta = { recorded_with: 'CHAT_ADD_TARGETED_LAYOUT_DIR + --record-layout', layout_checkout: 'layout-builder frontend2/layout-targeted-save (LAYOUT_CHAT_TARGETED_SAVE_ENABLED), the merged tree of !262', studio_origin: STUDIO_ORIGIN,
    director_frame: 'scripts/fixtures/studio-job-ledger/directive-never-answered.json directive_and_running_row[0] (a recorded element_directive; element type, prompt and slide are set per scenario)',
    sources: Object.fromEntries(['viewer/presentation-viewer.html', 'arrange_commands.py', 'chat_targeted_save.py', 'src/utils/chat-targeted-save.js', 'src/utils/arrange-commands.js', 'src/utils/edit-mode.js', 'src/utils/grid-converter.js', 'src/utils/auto-save.js', 'src/utils/element-manager.js', 'server.py',
      'src/utils/drag-drop.js', 'src/templates/template-registry.js', 'src/utils/semantic-slot-catalog.js', 'src/utils/direct-element-creator.js'].map(rel => [rel, sha(fs.readFileSync(path.join(LAYOUT_DIR, rel), 'utf8'))])) }
  fs.mkdirSync(path.dirname(TRANSCRIPTS), { recursive: true })
  fs.writeFileSync(TRANSCRIPTS, `${JSON.stringify(recorded, null, 1)}\n`)
  console.log(`recorded ${Object.keys(recorded.scenarios).length} scenarios`)
}

console.log(`\n${passed} passed, ${failed.length} failed; mutants: ${caught} caught, ${missed.length} missed${LIVE ? ' (live Layout code and server)' : ' (offline, recorded Layout code)'}`)
if (failed.length || missed.length) { if (failed.length) console.error(`failed: ${failed.join('; ')}`); if (missed.length) console.error(`missed: ${missed.join('; ')}`); process.exit(1) }
