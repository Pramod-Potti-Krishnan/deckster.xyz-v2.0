// FRONTEND-2 (B48, 29 Oct; E2E-2 B3 row 42, Studio dev 973fa22b, deck d68f9b14, 03:26-03:30Z): proof of chat add stacking, a chat-added element lands on top of the slide's content like an Element panel add, so it can be selected
// (NEXT_PUBLIC_STUDIO_CHAT_ADD_STACKING, exact "true", default off, build-time).
//
//   node scripts/test-studio-chat-add-stacking.mjs                                  # offline: the viewer's replies, its save requests and Layout's server answers come from scripts/fixtures/chat-add-stacking/layout-transcripts.json, recorded from Layout's real code
//   CHAT_ADD_TARGETED_LAYOUT_DIR=<layout-builder at frontend2/layout-targeted-save> CHAT_ADD_TARGETED_LAYOUT_PYTHON=<a Python with Layout's requirements> node scripts/test-studio-chat-add-stacking.mjs
//                                                                                   # also runs the REAL Layout viewer code and the REAL Layout server live and checks they say what was recorded
//   ... --record-layout                                                             # (with the variables) re-records the fixture
// (#546's names are the variables: the same checkout and Python run both proofs.)
//
// THE DEFECT (E2E-2, row 42). "Add a bar chart to slide 3 ..." was saved correctly (#546) but the chart "sits at z=1 under the slide's content and infographic, so it can't be clicked": a click inside the chart selected the flow-chip infographic. The slide's own elements are
// z 100 (b3-pre.json: four text boxes and the infographic); the chat chart is z 1 (b3-34.json), at 4/16 | 2/18, which the z-100 elements cover.
// ROOT CAUSE, Studio's (triage, file:line, on dev 973fa22b). lib/mdc-element-directive.ts:18 BASE `z_index: 1` (since the first MDC commit, 30 Aug) is the form data of EVERY chat add; hooks/use-textlabs-generation.ts hands formData.z_index to buildInsertionParams
// (lib/textlabs-client.ts:1115 `zIndex ?? defaults.zIndex`) and sends it as the insert's zIndex. Every Element panel form starts at TEXT_LABS_ELEMENT_DEFAULTS[type].zIndex = 1000 (types/textlabs.ts:962-970; chart-form.tsx:36/140, text-box-form.tsx:54/273 ...), so a panel add is 1000.
// Layout honours the z it is sent (src/utils/element-manager.js insertChart:4207 `z-index: ${config.zIndex || (++zIndexCounter)}`; its own default, the counter, starts at 100 so it would be 101+), auto-save.js and chat-targeted-save.js store the element's own style.zIndex, so the saved z is the same 1.
// Not a regression of #546 or of the last days: z 1 has been the chat add's since 30 Aug, and the whole-deck path (flag off, targeted save off) stores it just the same (proved below). It is Layout-neutral: no Layout change is needed.
//
// What runs (scripts/studio-chat-add-targeted-world.mjs, #546's world): Director's recorded element_directive frame -> the page's runner and handleApprovedTextLabsGenerate (cut out of app/builder/page.tsx) -> the REAL useTextLabsGeneration (the hook this change edits) and useGenerationPanel ->
// Studio's real handleSendElementCommand / handleSendTextBoxCommand / sendCommand (cut out of components/presentation-viewer.tsx) -> Layout's REAL viewer (page bridge, edit-mode.js, auto-save.js, element-manager.js, arrange-commands.js, chat-targeted-save.js) loaded with a stored deck through
// Layout's own load path -> Layout's REAL server (server.py) answering each PUT. Text Labs is a stand-in; the DOM, the clock and the ids are fixed. The slide is the E2E-2 one: four text boxes and a picture strip standing in for the infographic, all at z 100, stored as the deck has them.
// What it proves:
//  1. the flag: exact "true", default off, .env.example block;
//  2. the root cause, flag off: for a chart, a text box and an image, the chat add is inserted at z 1, stored at z 1 (Layout's real server), and in EVERY cell of its box an element of the slide (z 100) is on top, so none of its box can be clicked;
//  3. flag on: the same chat adds are inserted at the panel's z (1000), stored at 1000, on top in every cell of their box; the position, the size, the content, the save path and the siblings are exactly flag off's; every other insert parameter is equal;
//  4. the SAME RULE as the Element panel: a manual panel add of each type is inserted and stored at the same z and sits on top in the same way; the manual add is unchanged by the flag (byte for byte), and a z the user chose in the panel is kept (the rule is the chat add's only);
//  5. the other chat types: metrics, shape and icon label land at their panel default; a table (a cited upsert, which carries no z) is sent exactly as before;
//  6. the whole-deck path (Studio's targeted save off): the editor's autosave stores z 1000 with the flag and z 1 without; the rest of the save is the same;
//  7. flag off is identical: the strip gives dev's hook back byte for byte, and dev's hook and this hook with the flag unset, "false" or any non-exact value make the same requests, saves and result;
//  8. mutants are caught; 9. scope over the COMMITTED diff, GATE-SAFE and robust after merge (subject across `rev-list --no-merges BASE..head`, HEAD^2 on the gate's merge, registry / .env.example / strip reads past later changes), proved on a gate-style merge, on a merge onto an advanced dev and on a synthetic change stacked after this one.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'
import { createAddWorld, plain, PRESENTATION } from './studio-chat-add-targeted-world.mjs'
import {
  BASE_COMMIT, CHAT_ADD_STACKING_FILES, CHAT_ADD_STACKING_NEW_FILES, CHAT_ADD_STACKING_PIN_FILES, CHAT_ADD_STACKING_PIN_EDITS, CHAT_ADD_STACKING_PIN_MARK, CHAT_ADD_STACKING_SCOPE_FILES, CHAT_ADD_STACKING_ENV_BLOCK,
  CHAT_ADD_STACKING_MARKER_RE, CHAT_ADD_STACKING_SUBJECT, stripChatAddStacking,
} from './studio-chat-add-stacking-strip.mjs'
import * as registry from './studio-later-changes.mjs'

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const TRANSCRIPTS = path.join(root, 'scripts/fixtures/chat-add-stacking/layout-transcripts.json')
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const HOOK = 'hooks/use-textlabs-generation.ts', LIB = 'lib/chat-add-stacking.ts'

const hookText = read(HOOK)
const laterStrips = (rel, text) => { const at = registry.LATER_STRIPS.indexOf(stripChatAddStacking); return (at === -1 ? [] : registry.LATER_STRIPS.slice(at + 1)).reduce((out, strip) => { const next = typeof strip === 'function' ? strip(rel, out) : out; return typeof next === 'string' ? next : out }, text) }
const laterRead = rel => laterStrips(rel, read(rel))
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] })

const RECORD = process.argv.includes('--record-layout')
const LAYOUT_DIR = (process.env.CHAT_ADD_TARGETED_LAYOUT_DIR || process.env.CHAT_EDIT_TARGETED_LAYOUT_DIR) ? path.resolve(process.env.CHAT_ADD_TARGETED_LAYOUT_DIR || process.env.CHAT_EDIT_TARGETED_LAYOUT_DIR) : null
const PYTHON = process.env.CHAT_ADD_TARGETED_LAYOUT_PYTHON || process.env.CHAT_EDIT_TARGETED_LAYOUT_PYTHON || null
const LIVE = Boolean(LAYOUT_DIR)
if (RECORD && !LIVE) throw new Error('--record-layout needs CHAT_ADD_TARGETED_LAYOUT_DIR')
if (LIVE && !PYTHON) throw new Error('the live run needs CHAT_ADD_TARGETED_LAYOUT_PYTHON (a Python with layout-builder\'s requirements) for Layout\'s own server')
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

// ---- the deck, the flags, the scenario --------------------------------------------------------------------------------------------------
const FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_ADD_STACKING'
const TARGETED = 'NEXT_PUBLIC_STUDIO_CHAT_ADD_TARGETED_SAVE'
const SHELL = { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_TEXT_LABS_URL: 'https://textlabs.synthetic.test', NEXT_PUBLIC_ELEMENTOR_URL: 'https://textlabs.synthetic.test', NEXT_PUBLIC_STUDIO_INSERT_PERSIST: 'true' }
const envOf = (stack, targeted = true) => ({ ...SHELL, ...(targeted ? { [TARGETED]: 'true' } : {}), ...(stack === undefined ? {} : { [FLAG]: stack }) }) // stack: 'true' | 'false' | another value | undefined (unset)
const ENV_ON = envOf('true'), ENV_OFF = envOf(undefined)
// Slide 2 as E2E-2's slide 3: four text boxes and the infographic, all z 100 (b3-pre.json). The infographic is a picture strip here (Layout's load path restores text boxes and images); what matters is its z and its box.
const ELEMENT = (id, row, col) => ({ id, position: { grid_row: row, grid_column: col }, content: '<p>x</p>', z_index: 100 })
const SLIDE_2 = { text_boxes: [ELEMENT('textbox_a', '4/8', '2/17'), ELEMENT('textbox_b', '13/17', '2/17'), ELEMENT('textbox_c', '4/8', '17/32'), ELEMENT('textbox_d', '13/17', '17/32')],
  images: [{ id: 'image_strip', position: { grid_row: '7/13', grid_column: '2/32' }, image_url: 'https://img.example/strip.png', z_index: 100 }] }
const TITLES = ['Cover', 'Where we lose', 'Plan']
const STORED = { id: PRESENTATION, title: 'T', slides: TITLES.map((title, i) => ({ layout: 'C1', slide_id: `L${i}`, content: { slide_title: title }, text_boxes: i === 1 ? plain(SLIDE_2.text_boxes) : [], images: i === 1 ? plain(SLIDE_2.images) : [] })) }
const SIBLING_IDS = [...SLIDE_2.text_boxes, ...SLIDE_2.images].map(item => item.id)
const FRAME = JSON.parse(read('scripts/fixtures/studio-job-ledger/directive-never-answered.json')).directive_and_running_row[0] // Director's recorded element_directive (a CHART on slide 4, 23 Oct)
assert.equal(FRAME.type, 'element_directive')
const PROMPT = { TEXT_BOX: 'Add a note: fresh produce turnover is the biggest lever', IMAGE: 'A picture of a market stall', CHART: 'Add a bar chart showing weekly food waste by category', METRICS: 'Three KPIs for Q4', SHAPE: 'A rectangle', ICON_LABEL: 'A growth label', TABLE: 'A table of regions and revenue' }
let counter = 0
const directive = (type, extra = {}) => ({ ...plain(FRAME.payload), directive_id: `el_s${++counter}`, element_type: type, prompt: PROMPT[type] ?? 'x', slide_index: 1, grid_hint: null, ...extra })
const COLLECTION = { TEXT_BOX: 'text_boxes', IMAGE: 'images', CHART: 'charts', METRICS: 'text_boxes', SHAPE: 'text_boxes', ICON_LABEL: 'text_boxes' }
const TYPES = ['CHART', 'TEXT_BOX', 'IMAGE']
const frameOf = result => JSON.stringify({ ...result, directive_id: 'd' })

/** One lib of this checkout in a vm with `env` as process.env (the world's loader, without a viewer). */
function loadFile(file, env, overrides = {}) {
  const cache = new Map()
  const load = rel => {
    if (cache.has(rel)) return cache.get(rel).exports
    const module = { exports: {} }
    cache.set(rel, module)
    const out = ts.transpileModule(overrides[rel] ?? read(rel), { fileName: rel, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
    vm.runInNewContext(out, { module, exports: module.exports, process: { env }, console, Promise, Error, JSON, Set, Map, Object, Array, Number, String, Boolean, setTimeout, clearTimeout,
      require(spec) { if (spec.startsWith('@/')) for (const ext of ['.ts', '.tsx']) if (fs.existsSync(path.join(root, spec.slice(2) + ext))) return load(spec.slice(2) + ext); throw new Error(`unexpected dependency ${spec} of ${rel}`) } }, { filename: rel })
    return module.exports
  }
  return load(file)
}
const loadLib = (env, overrides = {}) => loadFile(LIB, env, overrides)
/** The z the Element panel's own form of `type` starts at (types/textlabs.ts TEXT_LABS_ELEMENT_DEFAULTS), read from the real file. */
const PANEL_Z = type => loadFile('types/textlabs.ts', {}).TEXT_LABS_ELEMENT_DEFAULTS[type].zIndex
/** The form data the Element panel's own form of `type` hands handleGenerate (its z box at the default, no position change): what a manual add sends. */
const PANEL_FORM = {
  CHART: { componentType: 'CHART', chartConfig: {} },
  TEXT_BOX: { componentType: 'TEXT_BOX', itemsPerInstance: 1, textboxConfig: {}, semanticRole: 'BODY_TEXT', geometryMode: 'AUTO' },
  IMAGE: { componentType: 'IMAGE', imageConfig: {} },
}
const panelForm = (type, z = PANEL_Z(type)) => ({ prompt: PROMPT[type], count: 1, layout: 'horizontal', advancedModified: false, z_index: z, ...PANEL_FORM[type] })

/** One scenario (named; recorded and replayed by name). `transcriptFrom`: the recording an overridden (mutated or base) run replays offline. */
async function scenario(name, { env = ENV_ON, type = 'CHART', overrides = {}, transcriptFrom = null } = {}) {
  const mutated = Object.keys(overrides).length > 0
  const server = LIVE ? { deck: plain(STORED), statuses: [], summaries: [] } : null
  const key = transcriptFrom ?? name
  if (!LIVE && !recorded.scenarios[key]) throw new Error(`a recorded Layout transcript for "${key}" (record with CHAT_ADD_TARGETED_LAYOUT_DIR=... --record-layout)`)
  const world = await createAddWorld({ root, layoutDir: LIVE ? LAYOUT_DIR : null, env, overrides, layout: 'on', stored: STORED, server, python: PYTHON, transcript: LIVE ? null : recorded.scenarios[key] })
  const w = {
    world, name, mutated, type,
    fetches: () => (LIVE ? world.fetches() : recorded.scenarios[key].fetches),
    server: () => (LIVE ? server : recorded.scenarios[key].server),
    actions: () => world.viewer.log.requests.map(item => item.action),
    insert: () => world.viewer.log.requests.find(item => /^(insert|upsert)/.test(item.action)) ?? null,
    async add(extra = {}) { const result = await world.directive(directive(type, extra)); w.result = result; return result },
    /** The Element panel's own add of `type` (no chat invocation) at form data `form`, and past the editor's autosave debounce. */
    async manual(form) { const outcome = await world.manualGenerate(plain(form)); await world.clock.advance(10_000); w.result = outcome; return outcome },
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

// ---- what is on top where: the stored deck (what a reload shows), by CSS stacking: the higher z-index wins; the same z, the later one --------
const COLLECTIONS = ['text_boxes', 'images', 'charts', 'infographics', 'diagrams']
const span = value => { const [a, b] = String(value).split('/').map(Number); return [a, b] }
/** The elements of slide 2 as the stored deck has them, in paint order's tie-break (collection order, then record order): {id, z, rows, cols}. `only`: the ids that count (the slide's own elements and the new one; the editor's autosave also stores layout text, which is #546's matter). */
function boxesOf(deck, only) {
  const out = []
  for (const name of COLLECTIONS) for (const item of deck.slides[1][name] || []) if (!only || only.includes(item.id)) out.push({ id: item.id, z: Number(item.z_index), rows: span(item.position.grid_row), cols: span(item.position.grid_column) })
  return out
}
const cellsOf = box => { const out = []; for (let row = box.rows[0]; row < box.rows[1]; row++) for (let col = box.cols[0]; col < box.cols[1]; col++) out.push([row, col]); return out }
const covers = (box, [row, col]) => row >= box.rows[0] && row < box.rows[1] && col >= box.cols[0] && col < box.cols[1]
/** The element a click at (row, col) reaches: of the boxes that cover the cell, the highest z, the later one on a tie. */
const topAt = (boxes, cell) => boxes.filter(box => covers(box, cell)).reduce((top, box) => (top === null || box.z >= top.z ? box : top), null)
/** Of the new element's cells, how many it is on top of, and who takes the others. */
function clickMap(deck, id) {
  const boxes = boxesOf(deck, [...SIBLING_IDS, id])
  const mine = boxes.find(box => box.id === id)
  assert.ok(mine, `${id} is stored`)
  const takenBy = {}
  let onTop = 0
  const cells = cellsOf(mine)
  for (const cell of cells) { const top = topAt(boxes, cell); if (top.id === id) onTop++; else takenBy[top.id] = (takenBy[top.id] || 0) + 1 }
  return { id, z: mine.z, cells: cells.length, onTop, takenBy }
}
const storedOf = (deck, id) => { for (const name of COLLECTIONS) for (const item of deck.slides[1][name] || []) if (item.id === id) return item; return null }
const insertParams = w => { const insert = w.insert(); assert.ok(insert, 'an insert was sent'); return insert.params }
const without = (object, ...keys) => Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key)))
const rows = []

const sum = object => Object.values(object).reduce((total, value) => total + value, 0)
/** Normalises a save's z (1 or 1000: the one thing the flag changes) so two saves can be compared for everything else. */
const noZ = value => JSON.parse(JSON.stringify(value).replace(/"(z_index|zIndex)":(1|1000)\b/g, '"$1":"Z"'))
const libText = read(LIB)
const swap = (text, from, to) => { assert.equal(text.split(from).length, 2, from); return text.replace(from, to) }

// ===== 1. the flag ==========================================================================================================================
await check('flag: on only for the exact "true" of NEXT_PUBLIC_STUDIO_CHAT_ADD_STACKING (it stands alone); .env.example has the block after a blank line', async () => {
  assert.equal(loadLib(ENV_ON).CHAT_ADD_STACKING_ENABLED, true)
  assert.equal(loadLib(ENV_OFF).CHAT_ADD_STACKING_ENABLED, false)
  for (const value of ['1', 'TRUE', 'yes', ' true', 'True', '']) assert.equal(loadLib({ ...ENV_OFF, [FLAG]: value }).CHAT_ADD_STACKING_ENABLED, false, JSON.stringify(value))
  assert.equal(loadLib({ [FLAG]: 'true' }).CHAT_ADD_STACKING_ENABLED, true, 'the flag stands alone: it needs no other Studio flag')
  const env = read('.env.example')
  assert.ok(env.includes(`\n\n${CHAT_ADD_STACKING_ENV_BLOCK}`), 'the .env.example block, after a blank line')
  assert.ok(withoutLaterEnvBlocks(env).endsWith(`${FLAG}="false"\n`), 'the block is the last of this change and above it, the blocks registered after this one aside')
})
function laterBlocks() { const at = registry.LATER_ENV_BLOCKS.indexOf(CHAT_ADD_STACKING_ENV_BLOCK); return at === -1 ? [] : registry.LATER_ENV_BLOCKS.slice(at + 1) }
function withoutLaterEnvBlocks(text) { return laterBlocks().reduce((out, block) => { const body = String(block).replace(/^\n+/, '').replace(/\n+$/, ''); return body === '' ? out : out.replace(`\n${body}\n`, () => '') }, text) }
await check('the rule: the Element panel\'s own start z of a type (types/textlabs.ts TEXT_LABS_ELEMENT_DEFAULTS), for the types a chat add inserts with a z; none for a type the panel has no default for', () => {
  const lib = loadLib(ENV_ON)
  for (const type of ['TEXT_BOX', 'METRICS', 'TABLE', 'CHART', 'IMAGE', 'ICON_LABEL', 'SHAPE', 'INFOGRAPHIC', 'DIAGRAM']) assert.equal(lib.chatAddStackedZIndex(type), PANEL_Z(type), type)
  for (const type of [undefined, null, '', 'UNKNOWN', 'constructor', 'toString', '__proto__', 5, {}]) assert.equal(lib.chatAddStackedZIndex(type), null, String(type))
})

// ===== 2. the root cause, flag off (today) ===================================================================================================
await check('root cause: every chat add is built with the directive\'s z_index 1 (lib/mdc-element-directive.ts BASE), where every Element panel form starts at 1000 (types/textlabs.ts) and the slide\'s own elements are 100', () => {
  const directiveLib = loadFile('lib/mdc-element-directive.ts', {})
  for (const type of directiveLib.DIRECTIVE_TYPES) { assert.equal(directiveLib.buildFormDataForDirective(type, 'x').z_index, 1, type); assert.equal(PANEL_Z(type), 1000, type) }
  assert.deepEqual(SLIDE_2.text_boxes.concat(SLIDE_2.images).map(item => item.z_index), [100, 100, 100, 100, 100])
})
const offRuns = {}, onRuns = {}
for (const type of TYPES) {
  await check(`root cause (flag off): a chat ${type} add is inserted at z 1 and stored at z 1 by Layout's real server; of the cells of its box, none has it on top: the slide's z-100 elements take every click`, async () => {
    const w = await scenario(`c-off-${type}`, { env: ENV_OFF, type })
    const result = await w.add()
    assert.equal(result.status, 'inserted')
    const params = insertParams(w)
    assert.equal(params.zIndex, 1, 'the insert is sent at the directive\'s z')
    const deck = w.server().deck
    assert.equal(storedOf(deck, result.element_id).z_index, 1, 'Layout stores the z it was given')
    assert.deepEqual(deck.slides[1][COLLECTION[type]].filter(item => item.id === result.element_id).length, 1)
    const map = clickMap(deck, result.element_id)
    assert.equal(map.onTop, 0, 'not on top in any cell of its box')
    assert.equal(sum(map.takenBy), map.cells)
    for (const id of Object.keys(map.takenBy)) assert.ok(SIBLING_IDS.includes(id), `${id} is one of the slide's own elements`)
    offRuns[type] = { result, params, fetches: plain(w.fetches()), map }
    rows.push([type, 'chat, flag OFF', params.zIndex, map.z, `${map.onTop}/${map.cells}`, Object.entries(map.takenBy).map(([id, n]) => `${id} ${n}`).join(', ')])
    w.finish()
  })
}
await check('the click model: the higher z wins, the later one on a tie; an element is covered where a higher one overlaps it (so the new element at z 1 is, and the E2E-2 slide\'s elements are not)', () => {
  const boxes = [{ id: 'low', z: 1, rows: [4, 16], cols: [2, 18] }, { id: 'high', z: 100, rows: [7, 13], cols: [2, 32] }, { id: 'tie', z: 100, rows: [7, 13], cols: [2, 32] }]
  assert.equal(topAt(boxes, [8, 5]).id, 'tie'); assert.equal(topAt(boxes, [5, 5]).id, 'low'); assert.equal(topAt(boxes, [20, 20]), null)
  assert.equal(topAt([{ id: 'a', z: 1000, rows: [4, 16], cols: [2, 18] }, { id: 'b', z: 100, rows: [7, 13], cols: [2, 32] }], [8, 5]).id, 'a')
})

// ===== 3. flag on: on top =======================================================================================================================
function expectOn(w, type, result) {
  const params = insertParams(w)
  assert.equal(params.zIndex, PANEL_Z(type), `${type}: the insert is sent at the panel's z`)
  const deck = w.server().deck
  assert.equal(storedOf(deck, result.element_id).z_index, PANEL_Z(type), 'Layout stores it')
  const map = clickMap(deck, result.element_id)
  assert.equal(map.onTop, map.cells, 'on top in every cell of its box')
  assert.deepEqual(map.takenBy, {})
  return { params, map }
}
function expectOff(w, type, result) { // today's root cause
  assert.equal(insertParams(w).zIndex, 1)
  assert.equal(storedOf(w.server().deck, result.element_id).z_index, 1)
  assert.equal(clickMap(w.server().deck, result.element_id).onTop, 0)
}
for (const type of TYPES) {
  await check(`flag on: a chat ${type} add is inserted and stored at the panel's z (1000) and is on top in every cell of its box; position, size, content, save path and siblings are exactly flag off's`, async () => {
    const w = await scenario(`c-on-${type}`, { env: ENV_ON, type })
    const result = await w.add()
    assert.equal(result.status, 'inserted')
    const { params, map } = expectOn(w, type, result)
    const off = offRuns[type]
    assert.equal(frameOf(result), frameOf(off.result), 'the result frame is flag off\'s, byte for byte')
    assert.deepEqual(without(params, 'zIndex'), without(off.params, 'zIndex'), 'every other insert parameter (position, size, content, ids) is flag off\'s')
    assert.equal(params.gridRow, off.params.gridRow); assert.equal(params.gridColumn, off.params.gridColumn)
    assert.deepEqual(noZ(w.fetches()), noZ(off.fetches), 'the same save (one chat-save PUT of the one element), but for the z')
    assert.equal(w.fetches().length, 1); assert.equal(putsTo(w.fetches(), CHAT_SAVE).length, 1); assert.equal(putsTo(w.fetches(), WHOLE_DECK).length, 0)
    assert.deepEqual(w.server().deck.slides[1].text_boxes.filter(item => SIBLING_IDS.includes(item.id)), STORED.slides[1].text_boxes, 'the slide\'s own text boxes are stored as they were')
    assert.deepEqual(w.server().deck.slides[1].images.filter(item => SIBLING_IDS.includes(item.id)), STORED.slides[1].images, 'and the strip')
    assert.deepEqual(w.server().summaries, ['Chat edit: one element on slide 2'])
    onRuns[type] = { result, params, map, fetches: plain(w.fetches()) }
    rows.push([type, 'chat, flag ON', params.zIndex, map.z, `${map.onTop}/${map.cells}`, '-'])
    w.finish()
  })
}
await check('flag on: the other chat types land at their panel default too (metrics, shape and icon label are text boxes: z 1000, stored and on top)', async () => {
  for (const type of ['METRICS', 'SHAPE', 'ICON_LABEL']) {
    const w = await scenario(`c-on-${type}`, { env: ENV_ON, type })
    const result = await w.add()
    assert.equal(result.status, 'inserted', type)
    expectOn(w, type, result)
    assert.equal(w.insert().action, 'insertTextBox', `${type} is a text box insert`)
    w.finish()
  }
})
await check('flag on: a chat TABLE add (a cited upsert, which carries no z at all: Layout places it) is sent byte for byte as flag off sends it, and saved the same', async () => {
  const off = await scenario('c-off-TABLE', { env: ENV_OFF, type: 'TABLE' }), on = await scenario('c-on-TABLE', { env: ENV_ON, type: 'TABLE' })
  await off.add(); await on.add()
  assert.equal(on.insert().action, 'upsertCitedElement'); assert.ok(!('zIndex' in on.insert().params), 'no z in the command')
  assert.equal(sha(JSON.stringify(on.world.viewer.log.requests)), sha(JSON.stringify(off.world.viewer.log.requests)), 'the same requests to the viewer')
  assert.equal(sha(JSON.stringify(on.fetches())), sha(JSON.stringify(off.fetches())), 'the same saves')
  assert.equal(sha(JSON.stringify(on.server())), sha(JSON.stringify(off.server())), 'the same stored deck')
  off.finish(); on.finish()
})

// ===== 4. the same rule as the Element panel ====================================================================================================
const manualRuns = {}
for (const type of TYPES) {
  await check(`the Element panel's own ${type} add (no chat) is inserted and stored at the same z, on top in the same way; the flag changes nothing in it, byte for byte`, async () => {
    const off = await scenario(`m-off-${type}`, { env: ENV_OFF, type }), on = await scenario(`m-on-${type}`, { env: ENV_ON, type })
    off.world.textLabs.length = 0; on.world.textLabs.length = 0
    const manualOff = await off.manual(panelForm(type)), manualOn = await on.manual(panelForm(type))
    assert.equal(manualOn.status, 'inserted'); assert.equal(manualOff.status, 'inserted')
    assert.deepEqual(on.actions(), off.actions())
    assert.equal(sha(JSON.stringify(on.fetches())), sha(JSON.stringify(off.fetches())), 'the same saves with the flag on and off')
    assert.equal(sha(JSON.stringify(on.server())), sha(JSON.stringify(off.server())), 'the same stored deck')
    assert.equal(sha(JSON.stringify(on.world.viewer.log.requests)), sha(JSON.stringify(off.world.viewer.log.requests)), 'the same requests to the viewer')
    const params = insertParams(on), id = manualOn.elementIds[0]
    assert.equal(params.zIndex, PANEL_Z(type)); assert.equal(storedOf(on.server().deck, id).z_index, PANEL_Z(type))
    const map = clickMap(on.server().deck, id)
    assert.equal(map.onTop, map.cells, 'a panel add is on top in every cell of its box')
    // the chat add (flag on) and the panel add are the same: z, position, size, and who takes the click
    const chat = onRuns[type]
    assert.equal(chat.params.zIndex, params.zIndex, 'the same z'); assert.equal(chat.params.gridRow, params.gridRow); assert.equal(chat.params.gridColumn, params.gridColumn)
    assert.equal(chat.params.positionWidth, params.positionWidth); assert.equal(chat.params.positionHeight, params.positionHeight)
    assert.deepEqual({ z: chat.map.z, cells: chat.map.cells, onTop: chat.map.onTop }, { z: map.z, cells: map.cells, onTop: map.onTop }, 'the same stacking')
    manualRuns[type] = { params, map }
    rows.push([type, 'Element panel (either flag)', params.zIndex, map.z, `${map.onTop}/${map.cells}`, '-'])
    off.finish(); on.finish()
  })
}
await check('a z the user chose in the panel is kept with the flag on (the rule is the chat add\'s only: no chat invocation, no change)', async () => {
  const w = await scenario('m-on-CHART-z777', { env: ENV_ON, type: 'CHART' })
  const outcome = await w.manual(panelForm('CHART', 777))
  assert.equal(outcome.status, 'inserted')
  assert.equal(insertParams(w).zIndex, 777); assert.equal(storedOf(w.server().deck, outcome.elementIds[0]).z_index, 777)
  w.finish()
})

// ===== 6. the whole-deck path (Studio's targeted save off) ==========================================================================================
await check('Studio\'s targeted save off (today\'s whole-deck path): the editor\'s autosave stores the chat chart at z 1 without the flag (the defect needs no #546) and at z 1000 with it; one whole-deck save either way, the rest of it the same', async () => {
  const off = await scenario('w-off-CHART', { env: envOf(undefined, false), type: 'CHART' }), on = await scenario('w-on-CHART', { env: envOf('true', false), type: 'CHART' })
  const resultOff = await off.add(), resultOn = await on.add()
  assert.equal(resultOff.status, 'inserted'); assert.equal(resultOn.status, 'inserted')
  for (const w of [off, on]) { assert.equal(putsTo(w.fetches(), WHOLE_DECK).length, 1); assert.equal(putsTo(w.fetches(), CHAT_SAVE).length, 0); assert.ok(w.server().summaries.includes('Auto-save from editor')) }
  assert.equal(storedOf(off.server().deck, resultOff.element_id).z_index, 1)
  assert.equal(storedOf(on.server().deck, resultOn.element_id).z_index, 1000)
  const mapOff = clickMap(off.server().deck, resultOff.element_id)
  assert.equal(mapOff.onTop, 0)
  const map = clickMap(on.server().deck, resultOn.element_id)
  assert.equal(map.onTop, map.cells)
  assert.deepEqual(noZ(on.fetches()), noZ(off.fetches()), 'the same whole-deck save but for the z')
  rows.push(['CHART', 'chat, flag OFF, whole-deck save', 1, mapOff.z, `${mapOff.onTop}/${mapOff.cells}`, Object.entries(mapOff.takenBy).map(([id, n]) => `${id} ${n}`).join(', ')]); rows.push(['CHART', 'chat, flag ON, whole-deck save', 1000, map.z, `${map.onTop}/${map.cells}`, '-'])
  off.finish(); on.finish()
})

console.log('\nWHERE A CHAT ADD LANDS (slide 2: four text boxes and a strip at z 100, as E2E-2\'s slide; click map over the new element\'s own cells)')
console.log('| type | add | insert z | stored z | cells it is on top of | who takes the click |')
console.log('|---|---|---|---|---|---|')
for (const row of rows) console.log(`| ${row.join(' | ')} |`)

// ===== 7. flag off is identical =================================================================================================================
await check('flag off: the strip gives back dev\'s hook byte for byte (every added line is marked, pure insertions), and the .env.example block comes out with its blank line; all read past the changes registered after this one', async () => {
  for (const rel of CHAT_ADD_STACKING_FILES) {
    const base = git('show', `${BASE_COMMIT}:${rel}`), now = laterRead(rel)
    assert.equal(sha(stripChatAddStacking(rel, now)), sha(base), rel)
    const added = now.split('\n').length - base.split('\n').length
    assert.equal(now.split('\n').filter(line => CHAT_ADD_STACKING_MARKER_RE.test(line)).length, added, `${rel}: every added line carries the marker`)
    assert.ok(added > 0)
  }
  assert.equal(withoutLaterEnvBlocks(read('.env.example')), `${git('show', `${BASE_COMMIT}:.env.example`)}\n${CHAT_ADD_STACKING_ENV_BLOCK}`, 'the base, one blank line, the block')
  assert.equal(registry.stripLaterEnvBlocks('.env.example', read('.env.example')), registry.stripLaterEnvBlocks('.env.example', git('show', `${BASE_COMMIT}:.env.example`)), 'the registry takes the block out')
  for (const rel of CHAT_ADD_STACKING_NEW_FILES) assert.ok(fs.existsSync(path.join(root, rel)), rel)
  for (const rel of CHAT_ADD_STACKING_PIN_FILES) {
    assert.equal(sha(stripChatAddStacking(rel, laterRead(rel))), sha(git('show', `${BASE_COMMIT}:${rel}`)), `${rel}: the proof this change taught, put back, is dev's`)
    for (const [has] of CHAT_ADD_STACKING_PIN_EDITS[rel]) for (const line of has.split('\n').filter(Boolean)) assert.ok(line.includes(CHAT_ADD_STACKING_PIN_MARK), `${rel}: a taught line carries the pin mark`)
  }
})
await check('flag off: dev\'s hook (this hook without its marked lines) and this hook with the flag unset, "false" or any other value than "true" make the same requests, the same saves, the same stored deck and the same result for each type', async () => {
  const baseHook = stripChatAddStacking(HOOK, hookText)
  const snapshot = w => sha(JSON.stringify({ requests: w.world.viewer.log.requests, fetches: w.fetches(), server: w.server(), result: frameOf(w.result) }))
  for (const type of TYPES) {
    const base = await scenario(`c-off-${type}`, { env: ENV_OFF, type, overrides: { [HOOK]: baseHook }, transcriptFrom: `c-off-${type}` })
    await base.add()
    const want = snapshot(base)
    for (const value of type === 'CHART' ? [undefined, 'false', '1', 'TRUE', ' true', 'yes', ''] : [undefined, 'false']) {
      const now = await scenario(`c-off-${type}`, { env: envOf(value), type })
      await now.add()
      assert.equal(snapshot(now), want, `${type} with the flag ${JSON.stringify(value)}`)
      if (value === undefined) now.finish()
    }
  }
})

// ===== 8. mutants ===============================================================================================================================
const baseHook = stripChatAddStacking(HOOK, hookText)
const runOn = async (name, overrides, { type = 'CHART', env = ENV_ON, expect = 'on' } = {}) => {
  const w = await scenario(name, { env, type, overrides, transcriptFrom: name })
  const result = await w.add()
  ;(expect === 'on' ? expectOn : expectOff)(w, type, result)
}
await check('the hook\'s one line: gated by the flag AND by the chat-add invocation kind (a manual add and a chat refine are not stacked), sets the insert\'s zIndex from the lib\'s rule only, and sits after buildInsertionParams', () => {
  const lines = hookText.split('\n').filter(line => CHAT_ADD_STACKING_MARKER_RE.test(line))
  assert.equal(lines.length, 2, 'one import, one line')
  const [imp, use] = lines
  assert.match(imp, /^import \{ CHAT_ADD_STACKING_ENABLED, chatAddStackedZIndex \} from '@\/lib\/chat-add-stacking' \/\/ CHAT-ADD-STACKING/)
  assert.match(use, /^ {8}if \(CHAT_ADD_STACKING_ENABLED && invocation\?\.kind === 'chat-add'\) \{ const stackedZIndex = chatAddStackedZIndex\(formData\.componentType\); if \(stackedZIndex !== null\) params\.zIndex = stackedZIndex \} \/\/ CHAT-ADD-STACKING/)
  const at = hookText.indexOf(use), build = hookText.lastIndexOf('const { method, params } = buildInsertionParams(', at)
  assert.ok(build !== -1 && hookText.slice(build, at).split('\n').length < 12, 'right after the buildInsertionParams call')
  assert.ok(hookText.indexOf('const semanticUpsertParams = buildSemanticUpsertParams(') > at, 'before the semantic and cited upserts read params.zIndex')
})
await mutant('lib: the flag reads a loose value', () => assert.equal(loadLib({ ...ENV_OFF, [FLAG]: '1' }, { [LIB]: swap(libText, "=== 'true'", '!== undefined') }).CHAT_ADD_STACKING_ENABLED, false))
await mutant('hook: the marked line removed (the flag does nothing: the chart stays under the content)', () => runOn('c-on-CHART', { [HOOK]: baseHook }))
await mutant('hook: the flag test dropped (the chart is stacked with the flag off)', () => runOn('c-off-CHART', { [HOOK]: swap(hookText, 'CHAT_ADD_STACKING_ENABLED && invocation?.kind', 'invocation?.kind') }, { env: ENV_OFF, expect: 'off' }))
await mutant('hook: the chat-add test dropped (a panel add is stacked too: the z the user chose is lost)', async () => {
  const w = await scenario('m-on-CHART-z777', { env: ENV_ON, type: 'CHART', overrides: { [HOOK]: swap(hookText, "CHAT_ADD_STACKING_ENABLED && invocation?.kind === 'chat-add'", 'CHAT_ADD_STACKING_ENABLED') }, transcriptFrom: 'm-on-CHART-z777' })
  await w.manual(panelForm('CHART', 777))
  assert.equal(insertParams(w).zIndex, 777)
})
await mutant('hook: the gate is the refine kind (a chat add is not stacked)', () => runOn('c-on-CHART', { [HOOK]: swap(hookText, "CHAT_ADD_STACKING_ENABLED && invocation?.kind === 'chat-add'", "CHAT_ADD_STACKING_ENABLED && invocation?.kind === 'chat-refine'") }))
await mutant('hook: the z is set from the form data, as before (the directive\'s 1 again)', () => runOn('c-on-CHART', { [HOOK]: swap(hookText, 'params.zIndex = stackedZIndex', 'params.zIndex = formData.z_index') }))
await mutant('lib: only charts are stacked (a text box add stays under)', () => runOn('c-on-TEXT_BOX', { [LIB]: swap(libText, "return typeof zIndex === 'number' && Number.isFinite(zIndex) ? zIndex : null", "return componentType === 'CHART' && typeof zIndex === 'number' ? zIndex : null") }, { type: 'TEXT_BOX' }))
await mutant('lib: the directive\'s z (1) as the rule', () => runOn('c-on-CHART', { [LIB]: swap(libText, 'const zIndex = defaults?.zIndex', 'const zIndex = 1') }))
await mutant('lib: a z that only ties the slide\'s own elements (100) instead of the panel\'s', () => runOn('c-on-CHART', { [LIB]: swap(libText, 'const zIndex = defaults?.zIndex', 'const zIndex = 100') }))
await mutant('lib: a z of its own (1010) instead of the panel\'s (the rule must be the Element panel\'s, not a new number)', () => runOn('c-on-CHART', { [LIB]: swap(libText, 'const zIndex = defaults?.zIndex', 'const zIndex = 1010') }))
await mutant('lib: no rule for a text box type (null: the insert keeps the directive\'s z)', () => runOn('c-on-IMAGE', { [LIB]: swap(libText, 'TEXT_LABS_ELEMENT_DEFAULTS as Record', 'TEXT_LABS_ELEMENT_DEFAULTS as unknown as Record').replace('const zIndex = defaults?.zIndex', "const zIndex = componentType === 'IMAGE' ? undefined : defaults?.zIndex") }, { type: 'IMAGE' }))

// ===== 9. scope over the COMMITTED diff (BASE..head), gate-safe and robust after merge ==========================================================
console.log('scope over the committed diff (own commits by subject across `rev-list --no-merges BASE..head`)')
const GIT_IDENT = { GIT_AUTHOR_NAME: 'gate', GIT_AUTHOR_EMAIL: 'gate@example.invalid', GIT_COMMITTER_NAME: 'gate', GIT_COMMITTER_EMAIL: 'gate@example.invalid', GIT_AUTHOR_DATE: '2026-10-28T00:00:00Z', GIT_COMMITTER_DATE: '2026-10-28T00:00:00Z' }
const plumb = (args, input) => execFileSync('git', args, { cwd: root, encoding: 'utf8', ...(input === undefined ? {} : { input }), env: { ...process.env, ...GIT_IDENT }, stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'], maxBuffer: 1 << 28, timeout: 60_000 }).trim()
/** A blob object for `text`, written from a temporary FILE (never `hash-object --stdin`: a large input through a stdin pipe once left a git child waiting forever in another proof's run): stdin ignored, a 60 s timeout, no filters. */
const blobOf = text => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cas-blob-'))
  try { const file = path.join(dir, 'blob'); fs.writeFileSync(file, text); return plumb(['hash-object', '-w', '--no-filters', '--', file]) } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const subjectOf = c => git('log', '-1', '--format=%s', c).trim()
const parentsOf = sha => git('rev-list', '--parents', '-n', '1', sha).trim().split(/\s+/).slice(1)
/** This change's commits: found by SUBJECT across `rev-list --no-merges BASE..head`. A first-parent walk (`firstParentOnly`, the old query, kept for its mutant) sees nothing on the gate's merge and none of this change's commits once a change is stacked after it. */
const ownOf = (head, { firstParentOnly = false } = {}) => git('rev-list', ...(firstParentOnly ? ['--first-parent'] : []), '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => subjectOf(c).startsWith(CHAT_ADD_STACKING_SUBJECT))
/** GATE-SAFE head of every scope query. The gate's merge has dev as its FIRST parent (it carries none of this change's commits, whether or not dev has moved past BASE) and this change's head as its SECOND parent: the scope runs against HEAD^2.
 *  On a branch (HEAD is this change's tip, or a merge of dev INTO it, whose first parent is the change) HEAD itself is used. `gateRule: false` is the mutant that drops the rule. */
function scopeHead(ref = 'HEAD', { gateRule = true } = {}) {
  const head = git('rev-parse', `${ref}^{commit}`).trim()
  const parents = parentsOf(head)
  if (!gateRule || parents.length !== 2) return head
  return ownOf(parents[0]).length === 0 && ownOf(parents[1]).length > 0 ? parents[1] : head
}
const applyAll = (list, rel, text) => list.reduce((out, strip) => { const next = strip(rel, out); return typeof next === 'string' ? next : out }, text)
const otherStrips = (rel, text) => applyAll(registry.LATER_STRIPS.filter(strip => strip !== stripChatAddStacking), rel, text)
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
  assert.deepEqual([...touched].sort(), [...CHAT_ADD_STACKING_SCOPE_FILES].sort(), 'the files this change\'s own commits touch are exactly its scope')
  for (const rel of CHAT_ADD_STACKING_FILES) {
    const diff = diffLines(normDiff(ctx, rel, head))
    for (const line of diff) { assert.ok(line.startsWith('+'), `${rel}: a removed line: ${line.slice(0, 120)}`); assert.match(line, CHAT_ADD_STACKING_MARKER_RE, `${rel}: an unmarked added line: ${line.slice(0, 120)}`) }
    assert.ok(diff.length > 0, `${rel}: the number of added lines`)
    assert.equal(stripChatAddStacking(rel, ctx.norm(rel, git('show', `${head}:${rel}`))), ctx.norm(rel, git('show', `${BASE_COMMIT}:${rel}`)), `${rel}: without its marked lines the file is the base's, byte for byte`)
  }
  for (const rel of CHAT_ADD_STACKING_PIN_FILES) assert.equal(stripChatAddStacking(rel, ctx.norm(rel, git('show', `${head}:${rel}`))), ctx.norm(rel, git('show', `${BASE_COMMIT}:${rel}`)), `${rel}: the proof this change taught, put back, is the base's`)
  for (const rel of CHAT_ADD_STACKING_NEW_FILES) assert.equal(git('cat-file', '-t', `${head}:${rel}`).trim(), 'blob', rel)
  for (const rel of ['app/builder/page.tsx', 'components/presentation-viewer.tsx', 'lib/studio-insert-persist.ts', 'lib/element-command-router.ts', 'lib/chat-edit-targeted.ts', 'lib/chat-element-edit.ts', 'lib/element-placeholder-defer.ts', 'lib/mdc-element-directive.ts', 'lib/textlabs-client.ts', 'types/textlabs.ts', 'lib/chat-add-targeted.ts']) assert.ok(!touched.has(rel), `${rel} is not touched by this change`)
}
const scopeEnvAndRegistry = (head, ctx = REAL) => {
  const env = git('show', `${head}:.env.example`), baseEnv = git('show', `${BASE_COMMIT}:.env.example`)
  assert.equal(ctx.env(env), ctx.env(baseEnv), '.env.example is the base plus the registered blocks and nothing else')
  assert.equal(env.split(CHAT_ADD_STACKING_ENV_BLOCK).length - 1, 1, 'this change\'s block is there exactly once, verbatim')
  assert.match(env, new RegExp(`\\n\\n${CHAT_ADD_STACKING_ENV_BLOCK.split('\n')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), 'a blank line before the block')
  const diff = diffLines(git('diff', '-U0', `${BASE_COMMIT}..${head}`, '--', 'scripts/studio-later-changes.mjs'))
  assert.equal(diff.filter(line => line.startsWith('-')).length, 0, 'the registry loses no line')
  const mine = diff.filter(line => line.includes('studio-chat-add-stacking-strip.mjs'))
  assert.equal(mine.length, 3, 'the registry gains exactly this change\'s three lines'); for (const line of mine) assert.ok(line.startsWith('+') && line.includes('// LATER-CHANGE:'), line.slice(0, 140))
  assert.deepEqual(mine.map(line => /\)\.(\w+), \/\//.exec(line)?.[1]), ['CHAT_ADD_STACKING_SCOPE_FILES', 'CHAT_ADD_STACKING_ENV_BLOCK', 'stripChatAddStacking'])
}
const scopeAll = (head, ctx = REAL) => { scopeOwnCommits(head); scopeCommittedFiles(head, ctx); scopeEnvAndRegistry(head, ctx) }

const HEAD = scopeHead('HEAD')
await check(`this change's own commits (subject starts "${CHAT_ADD_STACKING_SUBJECT}", found across the whole line, no merges) exist, with the co-author line`, () => { scopeOwnCommits(HEAD) })
await check('the committed files are exactly this change\'s; every line added to the hook is a pure insertion that carries the marker; the strip gives the base back byte for byte (other changes\' lines out of both sides); the taught proof put back is the base\'s', () => scopeCommittedFiles(HEAD))
await check('.env.example is the base plus the block (after one blank line); the registry gains exactly its three marked lines and loses none; no secret-shaped literal in the new files', () => {
  scopeEnvAndRegistry(HEAD)
  for (const rel of [...CHAT_ADD_STACKING_NEW_FILES.filter(rel => !rel.endsWith('.json')), HOOK]) assert.doesNotMatch(fs.readFileSync(path.join(root, rel), 'utf8'), /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY)/, rel)
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
  assert.equal(stripChatAddStacking(HOOK, otherStrips(HOOK, git('show', `${GATE}:${HOOK}`))), otherStrips(HOOK, git('show', `${BASE_COMMIT}:${HOOK}`)), 'the merged tree, without this change\'s lines, is the base\'s hook')
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cas-idx-'))
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
    if (line.includes('CHAT_ADD_STACKING_SCOPE_FILES')) return [line, "  ...(await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_SCOPE_FILES, // LATER-CHANGE: synthetic, stacked after this one"]
    if (line.includes('CHAT_ADD_STACKING_ENV_BLOCK')) return [line, "  (await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_ENV_BLOCK, // LATER-CHANGE: synthetic, stacked after this one"]
    if (line.includes(').stripChatAddStacking')) return [line, "  (await import('./studio-synthetic-later-strip.mjs')).stripSynthetic, // LATER-CHANGE: synthetic, stacked after this one"]
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
  assert.equal(stripChatAddStacking(HOOK, SYN_CTX.norm(HOOK, git('show', `${gate}:${HOOK}`))), SYN_CTX.norm(HOOK, git('show', `${BASE_COMMIT}:${HOOK}`)), 'the merged tree is the base\'s hook without this change\'s and the later change\'s lines')
  const advanced = gateMerge(unrelated, SYNTHETIC)
  assert.equal(scopeHead(advanced), SYNTHETIC); scopeAll(scopeHead(advanced), SYN_CTX)
})
await check('mutant caught: the same synthetic later change fails a scope that is not told about it (its hook line is an unmarked addition, its registry lines extra)', () => {
  assert.throws(() => scopeCommittedFiles(SYNTHETIC), /unmarked added line|exactly its scope/)
  assert.throws(() => scopeEnvAndRegistry(SYNTHETIC), /gains exactly|base plus the registered blocks/)
})
await check('mutant caught: a stray foreign file in a "Chat add stacking:" commit fails the committed-files check (own commits found by subject, the diff names the file)', () => {
  const stray = commitWith(HEAD, { 'stray-chat-add-stacking.txt': 'stray\n' }, `${CHAT_ADD_STACKING_SUBJECT} a stray file${TRAILER}`)
  assert.ok(ownOf(stray).includes(stray), 'the stray commit is found by its subject')
  assert.doesNotThrow(() => scopeCommittedFiles(HEAD), 'the real head passes')
  assert.throws(() => scopeCommittedFiles(stray), /exactly its scope/, 'the committed-files check must fail on a stray file')
})
await check('mutant caught: an own commit without the co-author line, and an unmarked line added to the hook in an own commit, fail the scope', () => {
  const noTrailer = commitWith(HEAD, {}, `${CHAT_ADD_STACKING_SUBJECT} no trailer`)
  assert.throws(() => scopeOwnCommits(noTrailer), error => /^[0-9a-f]{8}$/.test(error.message), 'the commit without the trailer is named')
  const sneaky = commitWith(HEAD, { [HOOK]: git('show', `${HEAD}:${HOOK}`).replace('export type TextLabsGenerationResult', 'const sneaky = 1\nexport type TextLabsGenerationResult') }, `${CHAT_ADD_STACKING_SUBJECT} a sneaky line${TRAILER}`)
  assert.throws(() => scopeCommittedFiles(sneaky), /unmarked added line/)
})


await check('Layout identity: the recording names the Layout files it ran (and, live, they are the files on disk)', async () => {
  if (RECORD) return
  assert.ok(recorded.meta?.sources?.['src/utils/element-manager.js'] && recorded.meta?.sources?.['chat_targeted_save.py'])
  if (LIVE) for (const [rel, hash] of Object.entries(recorded.meta.sources)) assert.equal(sha(fs.readFileSync(path.join(LAYOUT_DIR, rel), 'utf8')), hash, rel)
})

if (RECORD) {
  recorded.meta = { recorded_with: 'CHAT_ADD_TARGETED_LAYOUT_DIR + --record-layout', layout_checkout: 'layout-builder frontend2/layout-targeted-save (LAYOUT_CHAT_TARGETED_SAVE_ENABLED), the merged tree of !262',
    director_frame: 'scripts/fixtures/studio-job-ledger/directive-never-answered.json directive_and_running_row[0] (a recorded element_directive; element type, prompt and slide are set per scenario)',
    sources: Object.fromEntries(['viewer/presentation-viewer.html', 'arrange_commands.py', 'chat_targeted_save.py', 'src/utils/chat-targeted-save.js', 'src/utils/arrange-commands.js', 'src/utils/edit-mode.js', 'src/utils/grid-converter.js', 'src/utils/auto-save.js', 'src/utils/element-manager.js', 'server.py',
      'src/utils/drag-drop.js', 'src/templates/template-registry.js', 'src/utils/semantic-slot-catalog.js', 'src/utils/direct-element-creator.js'].map(rel => [rel, sha(fs.readFileSync(path.join(LAYOUT_DIR, rel), 'utf8'))])) }
  fs.mkdirSync(path.dirname(TRANSCRIPTS), { recursive: true })
  fs.writeFileSync(TRANSCRIPTS, `${JSON.stringify(recorded, null, 1)}\n`)
  console.log(`recorded ${Object.keys(recorded.scenarios).length} scenarios`)
}

console.log(`\n${passed} passed, ${failed.length} failed; mutants: ${caught} caught, ${missed.length} missed${LIVE ? ' (live Layout code and server)' : ' (offline, recorded Layout code)'}`)
if (failed.length || missed.length) { if (failed.length) console.error(`failed: ${failed.join('; ')}`); if (missed.length) console.error(`missed: ${missed.join('; ')}`); process.exit(1) }
