// PASS2D (frontend-1, ELEMENT-2 row 10): a new Add Element box must not land on top of the elements already on the slide.
// Flag NEXT_PUBLIC_STUDIO_ELEMENT_FREE_SPOT (exact "true", Studio shell only), default off.
//
// Before: handleOpenPanel puts every new element at grid column 2, row 4 (hooks/use-textlabs-generation.ts), so the second element on a
// slide sits on the first. With the flag on, choosing a card first reads the slide's elements from the viewer (the `getSlideGenerationContext`
// message Generate already sends) and the placeholder goes to the first free spot of the content area (lib/element-free-spot.ts).
//
// Proves, offline (no sockets, no keys, no paid or live call):
//   1. the placement helper (lib/element-free-spot.ts, no imports): span parsing, which viewer entries count, the scan order, the one-unit gap
//      and its fall-back to touching, the backdrop rule, "no room" -> null, determinism, order independence, and a property test against an
//      independent blocked-cell reference;
//   2. the REAL Layout: the answers the helper reads are frames recorded from the real layout-builder viewer
//      (scripts/fixtures/studio-element-free-spot/context-frames.json, layout-builder 71f4631): a blank canvas, the same canvas after two
//      insertTextBox calls shaped like handleOpenPanel's, a C1 slide, an H1s hero (with its full-bleed backdrop image) and an L25 slide.
//      The viewer code that produces them is pinned by file and line when a layout-builder checkout is at hand (LAYOUT_REPO, or
//      ../../backend/layout-builder; skipped with a notice otherwise);
//   3. the REAL hooks (use-generation-panel, use-blank-elements, use-textlabs-generation) in a small hook runtime against a fake viewer that
//      answers in those recorded shapes (Layout names a new text box itself and echoes the logical position it was given): the placeholder is
//      inserted at the free spot and tracked there; no room, a refused or silent read, a slide or deck that changed meanwhile, a second click, a
//      stale spot, the PLACEHOLDER_FIX hold-back window (the placeholder insertion must stay inside handleOpenPanel's synchronous window) and a
//      Generate that follows;
//   4. flag off (unset, "false", "TRUE", "1", ""): the command log, the tracking and the panel hash-equal to the base tree, and the viewer is
//      never asked about the slide's elements;
//   5. wiring: the flag is read in one file, .env.example, package.json, handleOpenPanel equals the base once the free-spot lines are put back,
//      the other handlers are untouched, the diff touches nothing else, and no viewer command is added beyond the existing read;
//   6. mutants of the helper and of the hook must each be caught.
//
//   node scripts/test-studio-element-free-spot.mjs
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import http from 'node:http'
import https from 'node:https'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import ts from 'typescript'

for (const name of Object.keys(process.env)) if (/KEY|TOKEN|SECRET|CREDENTIAL|PASSWORD/i.test(name)) delete process.env[name]
const denied = () => { throw new Error('Offline harness forbids network') }
net.connect = net.createConnection = net.Socket.prototype.connect = denied
http.request = http.get = https.request = https.get = denied
globalThis.fetch = denied

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
/** studio-v4-dev-preparation-code at #416: flag off must behave exactly as this. */
const BASE = '80dfde44a9ac5fc07bbb419deb3f62ff9d0180f6'
/** layout-builder uat the frames were recorded from. */
const LAYOUT_SHA = '71f463109e8b91dc94c2543caa04e3248b7acba0'
const LAYOUT_REPO = process.env.LAYOUT_REPO || path.resolve(root, '..', '..', 'backend', 'layout-builder')
const FLAG = 'NEXT_PUBLIC_STUDIO_ELEMENT_FREE_SPOT'
const FIX_FLAG = 'NEXT_PUBLIC_STUDIO_ELEMENT_PLACEHOLDER_FIX'
const LIB = 'lib/element-free-spot.ts'
const HOOK = 'hooks/use-textlabs-generation.ts'

const gitEnv = { ...process.env }
delete gitEnv.GIT_DIR
delete gitEnv.GIT_WORK_TREE
const gitIn = (cwd, args) => execFileSync('git', args, { cwd, env: gitEnv, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
const git = args => gitIn(root, args)
let baseAvailable = true
try { git(['cat-file', '-e', `${BASE}^{commit}`]) } catch { baseAvailable = false }
let layoutAvailable = true
try { gitIn(LAYOUT_REPO, ['cat-file', '-e', `${LAYOUT_SHA}^{commit}`]) } catch { layoutAvailable = false }

const sourceCache = new Map()
const compileCache = new Map()
/** A file of the working tree, of a git ref, or the mutated text an override supplies. */
const read = (file, ref, overrides) => {
  if (!ref && overrides && file in overrides) return overrides[file]
  const key = `${ref ?? 'working'}:${file}`
  if (!sourceCache.has(key)) {
    sourceCache.set(key, ref ? git(['show', `${ref}:${file}`]) : fs.readFileSync(path.join(root, file), 'utf8'))
  }
  return sourceCache.get(key)
}
const exists = (file, ref, overrides) => { try { read(file, ref, overrides); return true } catch { return false } }
const compile = source => {
  if (!compileCache.has(source)) {
    compileCache.set(source, ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText)
  }
  return compileCache.get(source)
}
const sha = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex').slice(0, 16)
const clone = value => JSON.parse(JSON.stringify(value))

const FRAMES = JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'studio-element-free-spot', 'context-frames.json'), 'utf8'))
const frame = name => clone(FRAMES.frames[name])

const unhandled = []
process.on('unhandledRejection', reason => unhandled.push(String(reason?.message ?? reason)))

// ---- 1. the placement helper, loaded as it stands (no imports) -------------------------------------------------------------------------------
function loadLib(overrides, env = {}, timers = { setTimeout, clearTimeout }) {
  const mod = { exports: {} }
  new Function('module', 'exports', 'process', 'setTimeout', 'clearTimeout', compile(read(LIB, null, overrides)))(
    mod, mod.exports, { env }, timers.setTimeout, timers.clearTimeout,
  )
  return mod.exports
}

/** An independent reference: a 0.2-resolution blocked-cell grid with prefix sums instead of interval arithmetic. */
function referenceSpot(occupied, width, height) {
  const S = 5
  const W = 33 * S
  const H = 19 * S
  for (const gap of [1, 0]) {
    const blocked = new Uint8Array(W * H)
    for (const box of occupied) {
      const x0 = Math.max(0, Math.round((box.startCol - gap) * S)); const x1 = Math.min(W, Math.round((box.endCol + gap) * S))
      const y0 = Math.max(0, Math.round((box.startRow - gap) * S)); const y1 = Math.min(H, Math.round((box.endRow + gap) * S))
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) blocked[y * W + x] = 1
    }
    const sum = new Int32Array((W + 1) * (H + 1))
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      sum[(y + 1) * (W + 1) + x + 1] = blocked[y * W + x] + sum[y * (W + 1) + x + 1] + sum[(y + 1) * (W + 1) + x] - sum[y * (W + 1) + x]
    }
    const area = (x0, y0, x1, y1) => sum[y1 * (W + 1) + x1] - sum[y0 * (W + 1) + x1] - sum[y1 * (W + 1) + x0] + sum[y0 * (W + 1) + x0]
    for (let row = 4; row + height <= 18; row++) for (let col = 2; col + width <= 32; col++) {
      if (area(col * S, row * S, (col + width) * S, (row + height) * S) === 0) return { startCol: col, startRow: row }
    }
  }
  return null
}

/** The default sizes Add Element uses (types/textlabs.ts TEXT_LABS_ELEMENT_DEFAULTS). */
const SIZES = { TEXT_BOX: [10, 6], METRICS: [8, 5], TABLE: [16, 8], CHART: [16, 12], IMAGE: [12, 7], ICON_LABEL: [2, 2], SHAPE: [3, 3], INFOGRAPHIC: [16, 9], DIAGRAM: [30, 14] }
const TYPES = Object.keys(SIZES)
const rect = (startCol, startRow, endCol, endRow) => ({ startCol, startRow, endCol, endRow })
const entry = (gridRow, gridColumn, extra = {}) => ({
  element_id: `e-${gridRow}-${gridColumn}`, renderer_type: 'textbox', component_type: 'TEXT_BOX', position: { gridRow, gridColumn }, summary: '',
  properties: { is_placeholder: false, locked: false, visible: true }, is_target: false, ...extra,
})
const context = (elements, over = {}) => ({
  success: true, action: 'getSlideGenerationContext', slide_index: 0, slide_title: null, slide_summary: null, target_element_id: null, elements, truncated: false, ...over,
})
/** What the helper should make of the recorded real frames. */
const RECTS = {
  blank_empty: [],
  blank_two_elements: [rect(2, 4, 12, 10), rect(13, 4, 21, 9)],
  c1: [rect(13, 18, 32, 19), rect(2, 1, 32, 3), rect(2, 3, 32, 4), rect(2, 18, 13, 19), rect(2, 4, 32, 18)],
  hero: [rect(3, 5, 17, 10), rect(3, 10, 17, 12), rect(3, 16, 17, 18)],
  l25: [],
}

function mulberry32(seed) {
  let a = seed >>> 0
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

async function libChecks(overrides) {
  const lib = loadLib(overrides)
  // the flag: exact literal
  for (const [value, expected] of [['true', true], ['TRUE', false], ['1', false], ['false', false], ['', false], [undefined, false], [' true', false]]) {
    assert.equal(loadLib(overrides, value === undefined ? {} : { [FLAG]: value }).STUDIO_ELEMENT_FREE_SPOT_ENABLED, expected, `flag ${JSON.stringify(value)}`)
  }
  assert.equal(loadLib(overrides, { NEXT_PUBLIC_STUDIO_ELEMENT_FREE_SPOTS: 'true' }).STUDIO_ELEMENT_FREE_SPOT_ENABLED, false, 'another name does not enable it')

  // constants the wiring and the docs state
  assert.deepEqual({ ...lib.FREE_SPOT_BOUNDS }, { minCol: 2, maxCol: 32, minRow: 4, maxRow: 18 })
  assert.equal(lib.FREE_SPOT_GAP, 1)
  assert.equal(lib.FREE_SPOT_BACKDROP_SHARE, 0.9)
  assert.equal(lib.FREE_SPOT_READ_TIMEOUT_MS, 2000)

  // spans
  for (const [text, expected] of [['4/10', [4, 10]], [' 4 / 10 ', [4, 10]], ['4.2/10.6', [4.2, 10.6]], ['4.2000001/10', [4.2, 10]], ['1/33', [1, 33]], ['2/3', [2, 3]]]) {
    assert.deepEqual(lib.parseFreeSpotSpan(text), expected, text)
  }
  for (const bad of ['10/4', '4/4', '', '4', '/', '4/', '/10', 'a/b', '4/10/12', '0/5', '-1/5', 'NaN/5', 'Infinity/9', '4/Infinity', null, undefined, 7, {}, ['4', '10']]) {
    assert.equal(lib.parseFreeSpotSpan(bad), null, `bad span ${JSON.stringify(bad)}`)
  }

  // which viewer entries count
  const occ = (...args) => lib.occupiedRectsFromContext(...args)
  assert.deepEqual(occ(context([]), 0), [])
  assert.deepEqual(occ(context([entry('4/10', '2/12'), entry('4/9', '13/21')]), 0), [rect(2, 4, 12, 10), rect(13, 4, 21, 9)])
  assert.deepEqual(occ(context([entry('4/10', '2/12')], { slide_index: 3 }), 3), [rect(2, 4, 12, 10)])
  assert.deepEqual(occ(context([entry('4/10', '2/12')], { slide_index: undefined, slideIndex: 0 }), 0), [rect(2, 4, 12, 10)], 'camelCase slideIndex is accepted')
  assert.deepEqual(occ(context([{ ...entry('4/10', '2/12'), position: { grid_row: '4/10', grid_column: '2/12' } }]), 0), [rect(2, 4, 12, 10)], 'snake_case keys are accepted')
  assert.equal(occ(context([entry('4/10', '2/12')], { slide_index: 1 }), 0), null, 'an answer for another slide is not trusted')
  assert.equal(occ(context([entry('4/10', '2/12')]), 1), null, 'nor is one when the slide asked about was another')
  assert.equal(occ(context([entry('4/10', '2/12')], { slide_index: undefined }), 0), null, 'nor one that names no slide')
  assert.equal(occ(context([entry('4/10', '2/12')], { success: false }), 0), null, 'a refusal')
  assert.equal(occ(context([entry('4/10', '2/12')], { success: 'true' }), 0), null, 'success must be exactly true')
  assert.equal(occ(context([entry('4/10', '2/12')], { truncated: true }), 0), null, 'a list cut short cannot be trusted')
  assert.equal(occ(context([], { elements: undefined }), 0), null, 'no element list')
  assert.equal(occ(context([], { elements: {} }), 0), null)
  for (const junk of [null, undefined, 'x', 7, [], { success: true }]) assert.equal(occ(junk, 0), null, `junk ${JSON.stringify(junk)}`)
  assert.deepEqual(occ(context([entry('4/10', '2/12', { properties: { visible: false } })]), 0), [], 'a hidden element is not in the way')
  assert.equal(occ(context([entry('4/10', '2/12', { properties: { visible: true } }), entry('4/10', '13/20', { properties: {} }), entry('4/10', '21/30', { properties: undefined })]), 0).length, 3, 'visible, unset or no properties all count')
  assert.deepEqual(occ(context([entry('4/10', '2/12', { position: null }), entry('x', '2/12'), entry('4/10', '12/2'), entry('4/10', '13/20')]), 0), [rect(13, 4, 20, 10)], 'an unreadable entry is skipped, the others kept')
  assert.deepEqual(occ(context([entry('1/19', '1/33')]), 0), [], 'a full-bleed backdrop is not in the way')
  assert.deepEqual(occ(context([entry('1/19', '1/30')]), 0), [], '29 x 18 (90.6% of the canvas) is a backdrop too')
  assert.deepEqual(occ(context([entry('1/19', '1/29')]), 0), [rect(1, 1, 29, 19)], '28 x 18 (87.5%) is not')
  assert.deepEqual(occ(context([entry('4/18', '2/32')]), 0), [rect(2, 4, 32, 18)], 'the whole content area (30 x 14) is not')
  assert.deepEqual(occ(context([entry('4/10', '2/12')]), 0.0), [rect(2, 4, 12, 10)])

  // the recorded real frames
  for (const name of Object.keys(RECTS)) assert.deepEqual(occ(frame(name), 0), RECTS[name], `real frame ${name}`)

  // the scan: hand-checked placements (gap of 1 first, touching only when nothing else fits)
  const pick = (occupied, type) => lib.chooseFreeSpot(occupied, ...SIZES[type])
  const A = rect(2, 4, 12, 10)
  const B = rect(13, 4, 21, 9)
  for (const type of TYPES) assert.deepEqual(pick([], type), { startCol: 2, startRow: 4 }, `${type} on an empty slide keeps today's position`)
  assert.deepEqual(pick([A], 'TEXT_BOX'), { startCol: 13, startRow: 4 }, 'right of A with one unit between')
  assert.deepEqual(pick([A, B], 'TEXT_BOX'), { startCol: 22, startRow: 4 })
  assert.deepEqual(pick([A, B], 'METRICS'), { startCol: 22, startRow: 4 })
  assert.deepEqual(pick([A, B], 'ICON_LABEL'), { startCol: 22, startRow: 4 })
  assert.deepEqual(pick([A, B], 'IMAGE'), { startCol: 13, startRow: 10 }, 'no room beside them: the first row below B, right of A')
  assert.deepEqual(pick([A, B], 'TABLE'), { startCol: 13, startRow: 10 })
  assert.equal(pick([A, B], 'CHART'), null, 'a 16 x 12 chart fits nowhere beside them')
  assert.deepEqual(pick([A, B, rect(22, 4, 32, 10)], 'TEXT_BOX'), { startCol: 2, startRow: 11 }, 'the third box fills the next band')
  assert.deepEqual(pick([rect(2, 4, 21, 10)], 'TEXT_BOX'), { startCol: 22, startRow: 4 }, 'a box ending on col 21 leaves col 22 for the next (21 + 1)')
  assert.deepEqual(pick([rect(2, 4, 22, 10)], 'TEXT_BOX'), { startCol: 2, startRow: 11 }, 'ending on 22: col 23 + 10 would pass col 32, so below')
  assert.deepEqual(pick([rect(2, 4, 22, 10)], 'ICON_LABEL'), { startCol: 23, startRow: 4 })
  // no room with a gap, but room when touching: the gap is dropped, not the placement
  assert.deepEqual(pick([rect(2, 4, 22, 18)], 'TEXT_BOX'), { startCol: 22, startRow: 4 }, 'touching beats overlapping when the gap leaves no room')
  assert.deepEqual(pick([rect(2, 4, 22.2, 18)], 'TEXT_BOX'), null, 'but 22.2 + 10 passes col 32: nothing')
  assert.deepEqual(pick([rect(2, 4, 21.8, 18)], 'TEXT_BOX'), { startCol: 22, startRow: 4 }, 'a fractional end is rounded up to the next whole column')
  assert.deepEqual(pick([rect(2, 4, 12, 10), rect(2, 10, 12, 18)], 'TEXT_BOX'), { startCol: 13, startRow: 4 })
  assert.equal(pick([rect(2, 4, 32, 18)], 'ICON_LABEL'), null, 'a full content area leaves nothing')
  assert.equal(pick(RECTS.c1.map(r => r), 'TEXT_BOX'), null, 'a C1 slide: the content box fills the area')
  assert.deepEqual(pick(RECTS.hero, 'TEXT_BOX'), { startCol: 18, startRow: 4 }, 'a hero slide: right of its text')
  assert.deepEqual(pick(RECTS.hero, 'IMAGE'), { startCol: 18, startRow: 4 })
  assert.equal(pick(RECTS.hero, 'CHART'), null)
  // sizes the area cannot hold, and nonsense
  assert.equal(lib.chooseFreeSpot([], 31, 6), null)
  assert.equal(lib.chooseFreeSpot([], 10, 15), null)
  assert.deepEqual(lib.chooseFreeSpot([], 30, 14), { startCol: 2, startRow: 4 })
  assert.deepEqual(lib.chooseFreeSpot([], 1, 1), { startCol: 2, startRow: 4 })
  for (const [w, h] of [[0, 6], [10, 0], [-1, 6], [10, -2], [NaN, 6], [10, Infinity], [undefined, 6]]) assert.equal(lib.chooseFreeSpot([], w, h), null, `size ${w} x ${h}`)
  // the result never moves the input, and is the same each time
  const frozen = Object.freeze([Object.freeze({ ...A }), Object.freeze({ ...B })])
  assert.deepEqual(lib.chooseFreeSpot(frozen, 10, 6), lib.chooseFreeSpot(frozen, 10, 6))

  // property test against the independent reference: a spot is never on a box, never outside the area, and is the reference's spot
  const random = mulberry32(20261016)
  const step = () => Math.round(random() * 5) / 5
  for (let trial = 0; trial < 160; trial++) {
    const count = Math.floor(random() * 7)
    const boxes = []
    for (let i = 0; i < count; i++) {
      const startCol = 1 + Math.floor(random() * 120) / 5
      const startRow = 1 + Math.floor(random() * 65) / 5
      boxes.push(rect(startCol, startRow, Math.min(33, startCol + 0.2 + Math.floor(random() * 90) / 5), Math.min(19, startRow + 0.2 + Math.floor(random() * 50) / 5)))
    }
    const type = TYPES[Math.floor(random() * TYPES.length)]
    const [width, height] = SIZES[type]
    const spot = lib.chooseFreeSpot(boxes, width, height)
    assert.deepEqual(spot, referenceSpot(boxes, width, height), `trial ${trial}: ${type} among ${JSON.stringify(boxes)}`)
    if (spot) {
      assert.ok(spot.startCol >= 2 && spot.startCol + width <= 32 && spot.startRow >= 4 && spot.startRow + height <= 18, 'inside the content area')
      assert.ok(Number.isInteger(spot.startCol) && Number.isInteger(spot.startRow), 'on a whole grid line')
      for (const box of boxes) {
        assert.ok(spot.startCol + width <= box.startCol || box.endCol <= spot.startCol || spot.startRow + height <= box.startRow || box.endRow <= spot.startRow, 'touches no box')
      }
    } else {
      // no spot: then even touching boxes leave no room (the reference agrees, and a smaller box would be a different question)
      assert.equal(referenceSpot(boxes, width, height), null)
    }
    const shuffled = [...boxes].sort(() => random() - 0.5)
    assert.deepEqual(lib.chooseFreeSpot(shuffled, width, height), spot, 'the order of the boxes does not matter')
    // through the viewer's answer too: positions as strings, a backdrop and a hidden element thrown in
    const asEntries = boxes.map(box => entry(`${box.startRow.toFixed(1)}/${box.endRow.toFixed(1)}`, `${box.startCol.toFixed(1)}/${box.endCol.toFixed(1)}`))
    const noise = [entry('1/19', '1/33'), entry('4/18', '2/32', { properties: { visible: false } }), entry('x', 'y')]
    const rects = occ(context([...noise, ...asEntries].sort(() => random() - 0.5)), 0)
    const expected = boxes.filter(box => (box.endRow - box.startRow) * (box.endCol - box.startCol) < 576 * 0.9)
    assert.equal(rects.length, expected.length, `trial ${trial}: entries kept`)
    assert.deepEqual(lib.chooseFreeSpot(rects, width, height), referenceSpot(expected, width, height), `trial ${trial}: through the viewer answer`)
    step()
  }

  // reading from the viewer: exactly one `getSlideGenerationContext` for the slide; any failure is "no spot"
  const sent = []
  const ok = async (action, params) => { sent.push([action, params]); return frame('blank_two_elements') }
  assert.deepEqual(await lib.pickElementFreeSpot({ sendElementCommand: ok, slideIndex: 0, width: 10, height: 6 }), { startCol: 22, startRow: 4 })
  assert.deepEqual(sent, [['getSlideGenerationContext', { slideIndex: 0 }]], 'one read, for the slide')
  sent.length = 0
  assert.deepEqual(await lib.pickElementFreeSpot({ sendElementCommand: ok, slideIndex: 2, width: 10, height: 6 }), null, 'an answer for slide 0 is not used for slide 2')
  assert.deepEqual(sent, [['getSlideGenerationContext', { slideIndex: 2 }]])
  assert.equal(await lib.pickElementFreeSpot({ sendElementCommand: async () => { throw new Error('refused') }, slideIndex: 0, width: 10, height: 6 }), null)
  assert.equal(await lib.pickElementFreeSpot({ sendElementCommand: () => { throw new Error('sync') }, slideIndex: 0, width: 10, height: 6 }), null)
  assert.equal(await lib.pickElementFreeSpot({ sendElementCommand: async () => ({ success: false }), slideIndex: 0, width: 10, height: 6 }), null)
  assert.equal(await lib.pickElementFreeSpot({ sendElementCommand: async () => frame('c1'), slideIndex: 0, width: 10, height: 6 }), null, 'no room')
  assert.deepEqual(await lib.pickElementFreeSpot({ sendElementCommand: async () => frame('l25'), slideIndex: 0, width: 10, height: 6 }), { startCol: 2, startRow: 4 })

  // the timer: 2 s by default, cleared when the answer comes, a hung read ends as "no spot", and a late refusal is not an unhandled rejection
  const pending = new Map()
  const asked = []
  let nextTimer = 0
  const timers = { setTimeout: (fn, ms) => { asked.push(ms); pending.set(++nextTimer, fn); return nextTimer }, clearTimeout: id => { pending.delete(id) } }
  const timed = loadLib(overrides, {}, timers)
  assert.deepEqual(await timed.pickElementFreeSpot({ sendElementCommand: ok, slideIndex: 0, width: 10, height: 6 }), { startCol: 22, startRow: 4 })
  assert.deepEqual(asked, [2000], 'the default budget')
  assert.equal(pending.size, 0, 'the timer is cleared once the answer is in')
  let lateReject
  const hung = timed.pickElementFreeSpot({ sendElementCommand: () => new Promise((_, reject) => { lateReject = reject }), slideIndex: 0, width: 10, height: 6, timeoutMs: 750 })
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(asked, [2000, 750], 'the caller\'s budget')
  assert.equal(pending.size, 1, 'one timer is waiting')
  ;[...pending.values()][0]()
  assert.equal(await hung, null, 'a read that never answers ends as no spot')
  lateReject(new Error('too late'))
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(unhandled, [], 'a refusal after the timeout is handled')
}

// ---- 2. the real Layout ------------------------------------------------------------------------------------------------------------------
const lineOf = (text, needle) => {
  const index = text.indexOf(needle)
  assert.notEqual(index, -1, `not found: ${needle}`)
  return text.slice(0, index).split('\n').length
}
function layoutFrameChecks() {
  assert.equal(FRAMES._provenance.layout_builder_sha, LAYOUT_SHA)
  for (const name of Object.keys(RECTS)) {
    const f = FRAMES.frames[name]
    assert.equal(f.success, true, `${name}: the viewer answers`)
    assert.equal(f.action, 'getSlideGenerationContext', `${name}: the answer names the command`)
    assert.equal(f.slide_index, 0, `${name}: the slide is a number`)
    assert.ok(Array.isArray(f.elements) && f.truncated === false, `${name}: an element list`)
    for (const element of f.elements) {
      assert.match(element.position.gridRow, /^\d+(\.\d)?\/\d+(\.\d)?$/, `${name}: logical row span`)
      assert.match(element.position.gridColumn, /^\d+(\.\d)?\/\d+(\.\d)?$/, `${name}: logical column span`)
    }
  }
  // hero: the full-bleed backdrop image is listed (and must be ignored)
  assert.deepEqual(FRAMES.frames.hero.elements.filter(e => e.component_type === 'IMAGE').map(e => e.position), [{ gridRow: '1/19', gridColumn: '1/33' }])
  // C1: the slide's own boxes are elements, the content box among them
  assert.ok(FRAMES.frames.c1.elements.some(e => e.position.gridRow === '4/18' && e.position.gridColumn === '2/32'))
  // L25: the rich-content body is NOT an element, so nothing is listed
  assert.deepEqual(FRAMES.frames.l25.elements, [])
  // insertTextBox: Layout names the text box itself and echoes the logical position it was given
  const answer = FRAMES.frames.insert_answer
  assert.equal(answer.success, true)
  assert.match(answer.elementId, /^textbox-/, 'Layout named it; the elementId Studio sent (blank_1) is ignored')
  assert.deepEqual(answer.position, { gridRow: '4/10', gridColumn: '2/12' }, 'the position comes back as the logical spans that were sent')
  assert.deepEqual(FRAMES.frames.blank_two_elements.elements.map(e => e.position), [{ gridRow: '4/10', gridColumn: '2/12' }, { gridRow: '4/9', gridColumn: '13/21' }], 'and the next read lists them as sent')
  assert.equal(FRAMES.frames.blank_two_elements.elements[0].element_id, answer.elementId, 'under the name Layout gave')

  if (!layoutAvailable) { console.log(`  note: layout-builder ${LAYOUT_SHA.slice(0, 8)} not at ${LAYOUT_REPO}: the frames are checked against the fixtures only`); return }
  const show = rel => gitIn(LAYOUT_REPO, ['show', `${LAYOUT_SHA}:${rel}`])
  const viewer = show('viewer/presentation-viewer.html')
  const manager = show('src/utils/element-manager.js')
  // the command Studio sends, and what it answers with
  assert.equal(lineOf(viewer, "case 'getSlideGenerationContext':"), 3927, 'viewer/presentation-viewer.html:3927')
  assert.match(viewer, /case 'getSlideGenerationContext':[\s\S]{0,500}window\.ElementManager\.getSlideGenerationContext\(\s*params\?\.slideIndex \?\?/, 'the viewer reads params.slideIndex')
  assert.equal(lineOf(viewer, "case 'insertTextBox':"), 3997, 'viewer/presentation-viewer.html:3997')
  assert.match(viewer, /case 'insertTextBox':[\s\S]{0,400}window\.ElementManager\.insertTextBox\(slideIndex, params\)/, 'insertTextBox passes Studio\'s params straight through')
  assert.equal(lineOf(viewer, 'event.source !== window.parent || !isAllowedParentOrigin(event.origin)'), 3145, 'the parent-origin guard Studio\'s iframe passes')
  // the element list: every registered element of the slide, with its live logical position
  assert.equal(lineOf(manager, 'function getSlideGenerationContext('), 8039, 'src/utils/element-manager.js:8039')
  assert.equal(lineOf(manager, 'position: element ? getElementGridPosition(element) : data.position || null,'), 8066, 'src/utils/element-manager.js:8066')
  assert.equal(lineOf(manager, 'function getElementGridPosition(element)'), 567, 'src/utils/element-manager.js:567')
  assert.match(show('src/utils/grid-converter.js'), /function toLogical\(gridValue\) \{/, 'src/utils/grid-converter.js:87 (physical 160 x 90 -> logical 32 x 18)')
  assert.match(manager, /function getElementGridPosition\(element\) \{[\s\S]{0,400}gridRow: window\.GridConverter \? window\.GridConverter\.toLogical\(rawGridRow\) : rawGridRow,[\s\S]{0,200}gridColumn: window\.GridConverter \? window\.GridConverter\.toLogical\(rawGridColumn\)/, 'positions are converted to the logical 32 x 18 grid')
  assert.match(manager, /const GENERATION_CONTEXT_LIMITS = Object\.freeze\(\{\s*elements: 100,/, 'at most 100 elements, then truncated: true')
  assert.equal(lineOf(manager, 'truncated: slideElements.length > boundedElements.length'), 8080, 'src/utils/element-manager.js:8080')
  assert.match(manager, /function getElementsBySlide\(slideIndex\) \{[\s\S]{0,300}data\.slideIndex === slideIndex/, 'the registry of dynamic elements, per slide')
  // insertTextBox: the position Studio passes
  assert.equal(lineOf(manager, 'function insertTextBox(slideIndex, config)'), 6366, 'src/utils/element-manager.js:6366')
  assert.match(manager, /const position = config\.position \|\| \{\s*gridRow: config\.gridRow \|\| '6\/12',\s*gridColumn: config\.gridColumn \|\| '5\/28'\s*\};/, 'insertTextBox reads config.gridRow and config.gridColumn')
  assert.equal(lineOf(manager, "gridRow: config.gridRow || '6/12',"), 6405, 'src/utils/element-manager.js:6405')
  assert.equal(lineOf(manager, "const id = config.id || generateId('textbox');"), 6389, 'Layout names the text box (config.id, not elementId)')
  // what is NOT available: the L-series body is not registered, and Layout's own free-spot code is not loaded by the viewer
  assert.doesNotMatch(viewer, /element-positioner|ElementPositioner/, 'viewer/presentation-viewer.html never loads src/utils/element-positioner.js')
  assert.doesNotMatch(viewer, /case 'getElementPositions'|case 'getSlideOccupancy'|case 'findFreeSpot'|case 'getAutoPosition'/, 'no viewer command returns free space or the base body\'s box')
}

// ---- 3. the hooks against a fake viewer that answers in the recorded shapes --------------------------------------------------------------------
const SLOW = 5000
const START = 1_800_000_000_000

function createRig({
  ref, overrides, studio = true, flag, fix, type = 'TEXT_BOX', slides = { 0: 'blank_two_elements' }, read: readMode = 'ok', noViewer = false,
} = {}) {
  // ---- virtual clock ----
  let now = 0
  let timerSeq = 0
  const timers = new Map()
  const setTimer = (fn, ms = 0) => { const id = ++timerSeq; timers.set(id, { at: now + (ms || 0), id, fn }); return id }
  const clearTimer = id => { timers.delete(id) }
  const sleep = ms => new Promise(resolve => setTimer(resolve, ms))
  const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)) }
  async function advance(ms) {
    await flush()
    const end = now + ms
    for (;;) {
      let due = null
      for (const timer of timers.values()) {
        if (timer.at <= end && (!due || timer.at < due.at || (timer.at === due.at && timer.id < due.id))) due = timer
      }
      if (!due) break
      timers.delete(due.id)
      now = Math.max(now, due.at)
      due.fn()
      await flush()
    }
    now = end
    await flush()
  }
  class ClockDate extends Date {
    constructor(...args) { if (args.length) super(...args); else super(START + now) }
    static now() { return START + now }
  }

  // ---- minimal React hook runtime ----
  const cells = []
  let cursor = 0
  let pendingEffects = []
  let renderScheduled = false
  const sameDeps = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]))
  const schedule = () => { if (renderScheduled) return; renderScheduled = true; setTimer(() => { renderScheduled = false; render() }, 0) }
  const hooks = {
    ...React,
    useState(initial) {
      const index = cursor++
      if (!(index in cells)) cells[index] = { value: typeof initial === 'function' ? initial() : initial }
      const cell = cells[index]
      cell.set ??= next => {
        const value = typeof next === 'function' ? next(cell.value) : next
        if (Object.is(value, cell.value)) return
        cell.value = value
        schedule()
      }
      return [cell.value, cell.set]
    },
    useRef(initial) { const index = cursor++; return cells[index] ??= { current: initial } },
    useCallback(fn, deps) { const index = cursor++; const previous = cells[index]; if (previous && sameDeps(previous.deps, deps)) return previous.fn; cells[index] = { fn, deps }; return fn },
    useMemo(fn, deps) { const index = cursor++; const previous = cells[index]; if (previous && sameDeps(previous.deps, deps)) return previous.value; const value = fn(); cells[index] = { value, deps }; return value },
    useEffect(fn, deps) {
      const index = cursor++
      const previous = cells[index]
      if (!previous || !deps || !sameDeps(previous.deps, deps)) {
        const entry = previous || { deps, cleanup: undefined }
        cells[index] = entry
        pendingEffects.push(() => { entry.cleanup?.(); entry.cleanup = fn(); entry.deps = deps })
      }
    },
  }

  // ---- module loader (real sources, optionally from a git ref, optionally mutated) ----
  const env = {
    NEXT_PUBLIC_ELEMENTOR_URL: 'https://textlabs.example.test',
    NEXT_PUBLIC_STUDIO_V4_SHELL: studio ? 'true' : 'false',
    NEXT_PUBLIC_TEXTBOX_REQUEST_FIDELITY_ENABLED: 'true',
  }
  if (flag !== undefined) env[FLAG] = flag
  if (fix !== undefined) env[FIX_FLAG] = fix
  const requests = []
  const toasts = []
  const state = { read: readMode, slide: 0, presentationId: 'offline-deck', theme: 'ready', leaseCurrent: true }
  const fakeConsole = { log() {}, info() {}, warn() {}, error() {} }
  const respond = (status, body) => ({ ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => body, text: async () => JSON.stringify(body) })
  const fakeFetch = async (url, init = {}) => {
    assert.ok(String(url).startsWith('https://textlabs.example.test/'), 'only the fake Text Labs host is reachable')
    requests.push({ at: now, url: String(url) })
    const signal = init.signal
    await new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
      signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
      sleep(SLOW).then(resolve, reject)
    })
    return respond(200, { success: true, elements: [{
      component_type: type, html: '<div>Offline generated</div>', image_url: 'https://offline.invalid/i.svg', content: '<div>Offline generated</div>',
      grid_position: { start_col: 5, start_row: 4, position_width: 10, position_height: 6 },
    }] })
  }
  const cache = new Map()
  let uuid = 0
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports
    const mod = { exports: {} }
    cache.set(file, mod)
    const requireModule = id => {
      if (id === 'react') return hooks
      if (id === 'react/jsx-runtime') return jsxRuntime
      const relative = id.startsWith('@/') ? id.slice(2) : id.startsWith('.') ? path.normalize(path.join(path.dirname(file), id)) : null
      if (!relative) return new Proxy({}, { get: () => () => null })
      const resolved = ['.ts', '.tsx', '/index.ts', '/index.tsx'].map(ext => relative + ext).find(candidate => exists(candidate, ref, overrides))
      assert.ok(resolved, `source dependency ${relative}`)
      return load(resolved)
    }
    const run = new Function('module', 'exports', 'require', 'process', 'setTimeout', 'clearTimeout', 'Date', 'fetch', 'console', 'crypto', compile(read(file, ref, overrides)))
    run(mod, mod.exports, requireModule, { env }, setTimer, clearTimer, ClockDate, fakeFetch, fakeConsole, { randomUUID: () => `uuid-${++uuid}` })
    return mod.exports
  }

  // ---- fake viewer, answering in the shapes the real one answered (scripts/fixtures/studio-element-free-spot/context-frames.json) ----
  // * getSlideGenerationContext lists the slide's elements with `position: { gridRow, gridColumn }` as logical spans, newest last.
  // * insertTextBox names the text box itself (it ignores `elementId`) and echoes the position it was given.
  const slideElements = new Map()
  for (const [index, source] of Object.entries(slides)) slideElements.set(Number(index), typeof source === 'string' ? frame(source).elements : clone(source))
  const live = new Map()          // id -> { blank, slide }
  const log = []                  // every command as the viewer received it
  let layoutSeq = 0
  let generated = 0
  const refuse = error => { throw new Error(error) }
  const elementsOf = slide => { if (!slideElements.has(slide)) slideElements.set(slide, []); return slideElements.get(slide) }
  const findElement = id => { for (const list of slideElements.values()) { const found = list.find(item => item.element_id === id); if (found) return found } return null }
  const layoutAnswer = async (entryLog, action, args) => {
    if (action === 'getSlideGenerationContext') {
      if (state.read === 'refuse') refuse('Supplied Layout refusal')
      if (state.read === 'hang') return new Promise(() => {})
      if (state.read === 'slow') await sleep(50)
      const slide = args.slideIndex ?? 0
      const target = args.targetElementId || null
      if (target && !findElement(target)) refuse(`Target element ${target} was not found on slide ${slide}`)
      return { ...frame('l25'), requestId: 'viewer', slide_index: slide, slide_title: null, slide_summary: null, target_element_id: target,
        elements: clone(elementsOf(slide)).map(item => ({ ...item, is_target: item.element_id === target })), truncated: false }
    }
    if (action === 'getElementGeometry') {
      const found = findElement(args.elementId)
      if (!found) refuse('Element not found')
      return { success: true, action, elementId: args.elementId, position: found.position, z_index: 1000, component_type: found.component_type,
        theme_variant_id: found.theme_variant_id ?? null, theme_bindings: {} }
    }
    if (action === 'getElementGenerationMetadata') {
      if (!findElement(args.elementId)) refuse(`Element not found: ${args.elementId}`)
      return { success: true, componentType: type, themeVariantSource: 'manual' }
    }
    if (action === 'getElementMutationReceipt') return { status: 'unknown' }
    if (action === 'setElementGenerationState') {
      if (!findElement(args.elementId)) refuse(`Element not found: ${args.elementId}`)
      return { success: true, action, elementId: args.elementId, generating: args.generating === true }
    }
    if (action.startsWith('insert') || action.startsWith('upsert')) {
      const slide = args.slideIndex ?? state.slide
      const id = entryLog.blank ? `textbox-layout-${++layoutSeq}` : `generated-${++generated}`
      entryLog.assigned = id
      elementsOf(slide).push({
        element_id: id, renderer_type: 'textbox', component_type: args.componentType ?? null, position: { gridRow: args.gridRow, gridColumn: args.gridColumn },
        summary: '', properties: { is_placeholder: Boolean(entryLog.blank), locked: false, visible: true }, is_target: false,
        theme_variant_id: entryLog.blank ? `variant-${type.toLowerCase()}` : null,
      })
      live.set(id, { blank: Boolean(entryLog.blank), slide })
      return { ...frame('insert_answer'), requestId: 'viewer', action, elementId: id, position: { gridRow: args.gridRow, gridColumn: args.gridColumn },
        component_type: args.componentType ?? null, theme_variant_id: entryLog.blank ? `variant-${type.toLowerCase()}` : null }
    }
    if (action === 'deleteElement') {
      if (!findElement(args.elementId)) refuse('Element not found')
      for (const list of slideElements.values()) { const at = list.findIndex(item => item.element_id === args.elementId); if (at >= 0) list.splice(at, 1) }
      live.delete(args.elementId)
      return { success: true, action }
    }
    return { success: true, action, elementId: args.elementId }
  }
  const sendElementCommand = async (action, args = {}) => {
    const entryLog = { at: now, action, params: JSON.stringify(args) }
    if (action === 'insertTextBox' && typeof args.content === 'string' && args.content.includes('data-blank-element=')) entryLog.blank = true
    log.push(entryLog)
    try {
      const answer = await layoutAnswer(entryLog, action, args)
      entryLog.outcome = 'ok'
      return answer
    } catch (error) {
      entryLog.outcome = String(error.message)
      throw error
    }
  }
  const layoutServiceApis = noViewer ? undefined : {
    sendElementCommand,
    captureStudioElementGeneration: () => ({ sendElementCommand: (...a) => sendElementCommand(...a), isCurrent: () => state.leaseCurrent }),
  }

  const panelModule = load('hooks/use-generation-panel.ts')
  const blankModule = load('hooks/use-blank-elements.ts')
  const generationModule = load(HOOK)
  let latest = null
  const params = {
    textLabsSession: { ensureSession: async () => 'offline-session' }, currentSlideIndex: 0, getCurrentSlideIndex: () => state.slide,
    deckContext: null, researchSessionId: null, researchStoreName: null, researchUserId: null, researchCapabilities: {},
    getThemeSyncSnapshot: () => ({ status: 'applied', presentationId: 'offline-deck', requestId: 'r', themeFingerprint: 'f' }),
    ensureThemeReady: async () => ({ ready: true, source: 'neutral' }),
    toast: value => { toasts.push({ at: now, ...value }) },
  }
  function Component() {
    const panel = panelModule.useGenerationPanel()
    const blank = blankModule.useBlankElements()
    // app/builder/page.tsx tracks the panel's placeholder for the element forms.
    const trackRef = hooks.useRef(blank.trackElement)
    trackRef.current = blank.trackElement
    hooks.useEffect(() => { trackRef.current(panel.blankElementId) }, [panel.blankElementId])
    const generation = generationModule.useTextLabsGeneration({
      ...params, layoutServiceApis, blankElements: blank, presentationId: state.presentationId, generationPanel: panel,
    })
    latest = { panel, generation, blank }
    return null
  }
  function render() {
    cursor = 0
    pendingEffects = []
    Component()
    const effects = pendingEffects
    pendingEffects = []
    for (const effect of effects) effect()
  }
  render()

  const rig = {
    log, requests, toasts, live, advance, state, elementsOf,
    get now() { return now },
    get panel() { return latest.panel },
    get blank() { return latest.blank },
    // The handler is captured the way a UI event handler captures it (the render's closure).
    open: typeName => latest.generation.handleOpenPanel(typeName),
    rerender: async () => { schedule(); await advance(0) },
    generate: (over = {}) => latest.generation.handleGenerate(rig.form(over), 'generate'),
    form: (over = {}) => ({
      componentType: type, prompt: 'Offline authored prompt', count: 1, useDeckTheme: false, structure: 'SECTIONS', textboxConfig: {},
      imageConfig: { operation: 'generate' }, chartConfig: { requested_data_source_mode: 'illustrative' }, shapeConfig: { shape_type: null },
      infographicConfig: {}, iconLabelConfig: {}, metricsConfig: {}, tableConfig: {}, diagramConfig: {}, codeDisplayConfig: {}, kanbanConfig: {},
      ganttConfig: {}, chevronConfig: {}, ideaBoardConfig: {}, cloudArchitectureConfig: {}, logicalArchitectureConfig: {}, dataArchitectureConfig: {},
      positionConfig: { start_col: 2, start_row: 4, position_width: 16, position_height: 12, auto_position: true }, ...over,
    }),
  }
  return rig
}

const reads = rig => rig.log.filter(c => c.action === 'getSlideGenerationContext')
const blankInserts = rig => rig.log.filter(c => c.action === 'insertTextBox' && c.blank)
const insertedAt = c => { const p = JSON.parse(c.params); return { gridRow: p.gridRow, gridColumn: p.gridColumn, width: p.positionWidth, height: p.positionHeight, slideIndex: p.slideIndex } }
const spanFor = (spot, [width, height]) => ({ gridRow: `${spot.startRow}/${spot.startRow + height}`, gridColumn: `${spot.startCol}/${spot.startCol + width}` })
const TODAY = { startCol: 2, startRow: 4 }
const ON = { flag: 'true' }
const trackedOf = rig => { const id = rig.panel.blankElementId; const info = id ? rig.blank.getElement(id) : undefined; return info ? { startCol: info.startCol, startRow: info.startRow, width: info.width, height: info.height, slideIndex: info.slideIndex } : null }
const traceOf = rig => JSON.stringify({
  log: rig.log, toasts: rig.toasts, blank: trackedOf(rig),
  panel: { isOpen: rig.panel.isOpen, blank: rig.panel.blankElementId, mode: rig.panel.mode, error: rig.panel.error, type: rig.panel.elementType },
  layout: [0, 1].map(i => rig.elementsOf(i)),
})

async function openAndSettle(options, typeName = options.type ?? 'TEXT_BOX') {
  const rig = createRig(options)
  await rig.advance(0)
  const opened = rig.open(typeName)
  await rig.advance(0)
  await opened
  await rig.advance(0)
  return rig
}

/** The scenarios the hook mutants are measured against. */
async function hookScenarios(overrides) {
  const o = extra => ({ overrides, ...ON, ...extra })
  // 1. the recorded canvas with two elements: every type goes to the first free spot, the placeholder is tracked there, the read is one command
  for (const typeName of TYPES) {
    const rig = await openAndSettle(o({ type: typeName }))
    const rects = RECTS.blank_two_elements
    const spot = referenceSpot(rects, ...SIZES[typeName]) ?? TODAY
    const inserts = blankInserts(rig)
    assert.equal(inserts.length, 1, `${typeName}: one placeholder`)
    assert.deepEqual(insertedAt(inserts[0]), { ...spanFor(spot, SIZES[typeName]), width: SIZES[typeName][0], height: SIZES[typeName][1], slideIndex: 0 }, `${typeName}: placed at ${JSON.stringify(spot)}`)
    assert.deepEqual(trackedOf(rig), { startCol: spot.startCol, startRow: spot.startRow, width: SIZES[typeName][0], height: SIZES[typeName][1], slideIndex: 0 }, `${typeName}: tracked where it was put`)
    assert.equal(rig.panel.isOpen, true, `${typeName}: the form opens`)
    assert.equal(rig.panel.blankElementId, inserts[0].assigned, `${typeName}: for the element Layout named`)
    assert.equal(reads(rig).length, 1, `${typeName}: one read`)
    assert.deepEqual(JSON.parse(reads(rig)[0].params), { slideIndex: 0 }, `${typeName}: for the slide`)
    assert.ok(rig.log.indexOf(reads(rig)[0]) < rig.log.indexOf(inserts[0]), `${typeName}: the read comes first`)
    assert.deepEqual(rig.toasts, [], `${typeName}: no notice`)
  }
  {
    const rig = await openAndSettle(o({ type: 'TEXT_BOX' }))
    assert.deepEqual(insertedAt(blankInserts(rig)[0]), { gridRow: '4/10', gridColumn: '22/32', width: 10, height: 6, slideIndex: 0 }, 'the hand-checked case: right of both, one unit clear')
    assert.deepEqual(trackedOf(rig), { startCol: 22, startRow: 4, width: 10, height: 6, slideIndex: 0 })
  }
  // 2. the slide the read is for is the slide the element goes on
  {
    const rig = createRig(o({ slides: { 0: 'blank_two_elements', 1: 'blank_empty' } }))
    rig.state.slide = 1
    await rig.advance(0)
    await rig.open('TEXT_BOX'); await rig.advance(0)
    assert.deepEqual(JSON.parse(reads(rig)[0].params), { slideIndex: 1 })
    assert.deepEqual(insertedAt(blankInserts(rig)[0]), { gridRow: '4/10', gridColumn: '2/12', width: 10, height: 6, slideIndex: 1 }, 'slide 1 is empty: today\'s position, on slide 1')
  }
  // 3. a refused read, a silent read, no room: today's position, the form still opens
  {
    const rig = await openAndSettle(o({ read: 'refuse' }))
    assert.deepEqual(insertedAt(blankInserts(rig)[0]), { gridRow: '4/10', gridColumn: '2/12', width: 10, height: 6, slideIndex: 0 })
    assert.equal(rig.panel.isOpen, true); assert.deepEqual(rig.toasts, []); assert.equal(rig.panel.error, null)
  }
  {
    const rig = createRig(o({ read: 'hang' }))
    await rig.advance(0)
    const opening = rig.open('TEXT_BOX')
    await rig.advance(1999)
    assert.equal(blankInserts(rig).length, 0, 'still waiting at 1999 ms')
    assert.equal(rig.panel.isOpen, false)
    await rig.advance(2)
    await opening
    assert.equal(blankInserts(rig).length, 1, 'opened once the 2 s budget ran out')
    assert.deepEqual(insertedAt(blankInserts(rig)[0]), { gridRow: '4/10', gridColumn: '2/12', width: 10, height: 6, slideIndex: 0 })
    assert.equal(rig.panel.isOpen, true)
  }
  {
    const rig = await openAndSettle(o({ slides: { 0: 'c1' } }))
    assert.deepEqual(insertedAt(blankInserts(rig)[0]), { gridRow: '4/10', gridColumn: '2/12', width: 10, height: 6, slideIndex: 0 }, 'a C1 slide has no room: today\'s position')
  }
  {
    const rig = await openAndSettle(o({ slides: { 0: 'hero' } }))
    assert.deepEqual(insertedAt(blankInserts(rig)[0]), { gridRow: '4/10', gridColumn: '18/28', width: 10, height: 6, slideIndex: 0 }, 'a hero: right of its text, the backdrop image ignored')
  }
  {
    const rig = await openAndSettle(o({ slides: { 0: 'l25' } }))
    assert.deepEqual(insertedAt(blankInserts(rig)[0]), { gridRow: '4/10', gridColumn: '2/12', width: 10, height: 6, slideIndex: 0 }, 'an L25 body is not an element: today\'s position')
  }
  // 4. the slide or the deck changed while the read was out
  {
    const rig = createRig(o({ read: 'slow', slides: { 0: 'blank_two_elements', 1: 'blank_empty' } }))
    await rig.advance(0)
    const opening = rig.open('TEXT_BOX')
    await rig.advance(10)
    rig.state.slide = 1                  // the user moves to slide 1 while the read of slide 0 is out
    await rig.advance(100)
    await opening
    assert.deepEqual(insertedAt(blankInserts(rig)[0]), { gridRow: '4/10', gridColumn: '2/12', width: 10, height: 6, slideIndex: 1 }, 'the spot found for slide 0 is not used on slide 1')
  }
  {
    const rig = createRig(o({ read: 'slow' }))
    await rig.advance(0)
    const opening = rig.open('TEXT_BOX')
    rig.state.presentationId = 'another-deck'
    await rig.rerender()                 // the page renders with the other deck while the read (50 ms) is still out
    await rig.advance(100)
    await opening
    await rig.advance(0)
    assert.equal(blankInserts(rig).length, 0, 'the click is dropped, as the open handler drops one whose deck changed: nothing goes into the new deck')
    assert.equal(rig.panel.isOpen, false)
  }
  // 5. a second click on the same card while the first reads is dropped (one placeholder); a later one works; a different card is its own
  {
    const rig = createRig(o({}))
    await rig.advance(0)
    const first = rig.open('TEXT_BOX')
    const second = rig.open('TEXT_BOX')
    await rig.advance(0)
    await Promise.all([first, second])
    assert.equal(blankInserts(rig).length, 1, 'one placeholder for two clicks')
    assert.equal(reads(rig).length, 1, 'and one read')
    await rig.open('METRICS'); await rig.advance(0)
    assert.equal(blankInserts(rig).length, 2, 'another card is not dropped')
    await rig.open('TEXT_BOX'); await rig.advance(0)
    assert.equal(blankInserts(rig).length, 3, 'the card can be chosen again once the first open is done')
  }
  // 6. the next card sees the placeholder the last one left (no fix: the placeholder is on the slide at once) and goes beside/below it
  {
    const rig = createRig(o({ slides: { 0: 'blank_empty' } }))
    await rig.advance(0)
    const seen = []
    for (const typeName of ['TEXT_BOX', 'TEXT_BOX', 'METRICS', 'TEXT_BOX']) {
      await rig.open(typeName); await rig.advance(0)
      const last = blankInserts(rig).at(-1)
      const { gridRow, gridColumn } = insertedAt(last)
      seen.push(`${typeName} ${gridRow} x ${gridColumn}`)
    }
    assert.deepEqual(seen, ['TEXT_BOX 4/10 x 2/12', 'TEXT_BOX 4/10 x 13/23', 'METRICS 4/9 x 24/32', 'TEXT_BOX 11/17 x 2/12'], 'each new box goes to the first free spot')
    // and none of the four overlaps another
    const boxes = blankInserts(rig).map(c => { const p = insertedAt(c); const [r0, r1] = p.gridRow.split('/').map(Number); const [c0, c1] = p.gridColumn.split('/').map(Number); return rect(c0, r0, c1, r1) })
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]; const b = boxes[j]
      assert.ok(a.endCol <= b.startCol || b.endCol <= a.startCol || a.endRow <= b.startRow || b.endRow <= a.startRow, `boxes ${i} and ${j} overlap`)
    }
  }
  // 7. no stale spot: a read that fails after one that worked uses today's position, not the last spot
  {
    const rig = createRig(o({ slides: { 0: 'blank_two_elements' } }))
    await rig.advance(0)
    await rig.open('TEXT_BOX'); await rig.advance(0)
    assert.equal(insertedAt(blankInserts(rig)[0]).gridColumn, '22/32')
    rig.state.read = 'refuse'
    await rig.open('ICON_LABEL'); await rig.advance(0)
    assert.deepEqual(insertedAt(blankInserts(rig)[1]), { gridRow: '4/6', gridColumn: '2/4', width: 2, height: 2, slideIndex: 0 }, 'today\'s position, not the previous spot')
  }
  // 8. PLACEHOLDER_FIX on as well: choosing a card still puts nothing on the slide; the spot is tracked and used at Generate
  {
    const rig = await openAndSettle(o({ fix: 'true', type: 'CHART', slides: { 0: frame('blank_two_elements').elements.slice(0, 1) } }), 'CHART')
    assert.equal(blankInserts(rig).length, 0, 'the placeholder insertion is still held back')
    assert.deepEqual(rig.log.map(c => c.action), ['getSlideGenerationContext'], 'only the read reached the viewer')
    assert.deepEqual(trackedOf(rig), { startCol: 13, startRow: 4, width: 16, height: 12, slideIndex: 0 }, 'tracked at the free spot')
    assert.equal(rig.panel.isOpen, true)
    const pending = rig.generate({ positionConfig: { start_col: 13, start_row: 4, position_width: 16, position_height: 12, auto_position: true } })
    await rig.advance(SLOW * 3)
    const result = await pending
    assert.equal(result.status, 'inserted', rig.panel.error ?? '')
    assert.equal(blankInserts(rig).length, 1)
    assert.deepEqual(insertedAt(blankInserts(rig)[0]), { gridRow: '4/16', gridColumn: '13/29', width: 16, height: 12, slideIndex: 0 }, 'Generate inserts the held-back placeholder at the spot')
    const generatedInsert = rig.log.find(c => /^insert|^upsert/.test(c.action) && !c.blank)
    assert.ok(generatedInsert, 'the generated element went in')
    const generatedParams = JSON.parse(generatedInsert.params)
    assert.equal(generatedParams.gridRow, '4/16', 'at the same row span'); assert.equal(generatedParams.gridColumn, '13/29', 'and column span')
  }
  // 9. PLACEHOLDER_FIX off: the placeholder is on the slide; Generate replaces it in place
  {
    const rig = await openAndSettle(o({ type: 'CHART', slides: { 0: frame('blank_two_elements').elements.slice(0, 1) } }), 'CHART')
    assert.equal(blankInserts(rig).length, 1)
    assert.deepEqual(insertedAt(blankInserts(rig)[0]), { gridRow: '4/16', gridColumn: '13/29', width: 16, height: 12, slideIndex: 0 })
    const pending = rig.generate({ positionConfig: { start_col: 13, start_row: 4, position_width: 16, position_height: 12, auto_position: true } })
    await rig.advance(SLOW * 3)
    const result = await pending
    assert.equal(result.status, 'inserted', rig.panel.error ?? '')
    const generatedInsert = rig.log.find(c => /^insert|^upsert/.test(c.action) && !c.blank)
    const generatedParams = JSON.parse(generatedInsert.params)
    assert.equal(generatedParams.gridRow, '4/16'); assert.equal(generatedParams.gridColumn, '13/29')
  }
  // 10. off: not the Studio shell, or the flag is anything but the exact "true": no read at all
  for (const variant of [{ studio: false, flag: 'true' }, { flag: 'false' }, { flag: 'TRUE' }, { flag: '1' }, { flag: '' }, { flag: undefined }]) {
    const rig = await openAndSettle({ overrides, ...variant })
    assert.equal(reads(rig).length, 0, `no read: ${JSON.stringify(variant)}`)
    assert.deepEqual(insertedAt(blankInserts(rig)[0]), { gridRow: '4/10', gridColumn: '2/12', width: 10, height: 6, slideIndex: 0 }, `today's position: ${JSON.stringify(variant)}`)
  }
}

// ---- 4. flag off is the base tree ----------------------------------------------------------------------------------------------------------------
async function flagOffIdentity() {
  const variants = [{}, { flag: 'false' }, { flag: 'TRUE' }, { flag: '1' }, { flag: '' }]
  const out = []
  for (const fix of [undefined, 'true']) {
    for (const variant of variants) {
      for (const typeName of TYPES) {
        const branch = traceOf(await openAndSettle({ ...variant, fix, type: typeName, slides: { 0: 'blank_two_elements', 1: 'hero' } }, typeName))
        assert.equal(JSON.parse(branch).log.some(c => c.action === 'getSlideGenerationContext'), false, 'flag off never reads the slide')
        out.push(branch)
        if (baseAvailable) {
          const base = traceOf(await openAndSettle({ ref: BASE, ...variant, fix, type: typeName, slides: { 0: 'blank_two_elements', 1: 'hero' } }, typeName))
          assert.equal(sha(branch), sha(base), `${typeName} ${JSON.stringify(variant)} fix=${fix}: the trace equals the base tree's`)
        }
      }
    }
  }
  // the viewer-less case: the same refusal as before
  const none = traceOf(await openAndSettle({ noViewer: true, flag: undefined }))
  const noneOn = traceOf(await openAndSettle({ noViewer: true, ...ON }))
  assert.equal(none, noneOn, 'with no viewer the flag changes nothing: the same notice')
  if (baseAvailable) assert.equal(sha(none), sha(traceOf(await openAndSettle({ ref: BASE, noViewer: true }))), 'and it is the base\'s notice')
  console.log(`  flag-off trace hash ${sha(out)} (${out.length} scenarios${baseAvailable ? `, each equal to the base ${BASE.slice(0, 8)}` : '; base commit not in this clone: not compared'})`)
}

// ---- 5. wiring ---------------------------------------------------------------------------------------------------------------------------------
function wiringChecks() {
  const lib = read(LIB)
  const code = lib.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  assert.doesNotMatch(code, /^\s*import\s|\brequire\s*\(|\bimport\s*\(/m, 'the helper has no imports')
  assert.deepEqual([...code.matchAll(/process\.env\.[A-Z0-9_]+/g)].map(m => m[0]), [`process.env.${FLAG}`], 'it reads the one flag')
  assert.match(lib, /export const STUDIO_ELEMENT_FREE_SPOT_ENABLED = process\.env\.NEXT_PUBLIC_STUDIO_ELEMENT_FREE_SPOT === 'true'/)
  assert.deepEqual([...new Set([...code.matchAll(/'([a-z]+[A-Z][A-Za-z]+)'/g)].map(m => m[1]))], ['getSlideGenerationContext'], 'the only viewer command named')
  assert.doesNotMatch(code, /\b(fetch|WebSocket|XMLHttpRequest|localStorage|sessionStorage|sendBeacon|postMessage)\b/, 'pure of network and storage')
  const readers = []
  const walk = dir => {
    for (const dirent of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      if (['node_modules', '.next', '.git', 'scripts', 'docs', 'screenshots'].includes(dirent.name)) continue
      const rel = path.posix.join(dir, dirent.name)
      if (dirent.isDirectory()) walk(rel)
      else if (/\.(tsx?|mjs)$/.test(dirent.name) && read(rel).includes(`process.env.${FLAG}`)) readers.push(rel)
    }
  }
  walk('.')
  assert.deepEqual(readers, [LIB], 'the flag is read in exactly one file')
  const hook = read(HOOK)
  assert.match(hook, /import \{\s*STUDIO_ELEMENT_FREE_SPOT_ENABLED,\s*pickElementFreeSpot,\s*type FreeSpot,?\s*\} from '@\/lib\/element-free-spot'/)
  assert.match(hook, /if \(studio && STUDIO_ELEMENT_FREE_SPOT_ENABLED\) \{\n {4}return \{ handleGenerate: placeholderDeferral \? handleGenerateDeferred : handleGenerate, handleOpenPanel: handleOpenPanelFreeSpot \}\n {2}\}/, 'the flag and the Studio shell select the wrapper')
  assert.match(hook, /\n {2}if \(placeholderDeferral\) return \{ handleGenerate: handleGenerateDeferred, handleOpenPanel: handleOpenPanelDeferred \}\n {2}return \{ handleGenerate, handleOpenPanel \}\n\}/, 'flag off returns the handlers it returned before')
  assert.match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_ELEMENT_FREE_SPOT="false"$/m, '.env.example documents the flag, off')
  assert.equal(JSON.parse(read('package.json')).scripts['test:studio-element-free-spot'], 'node scripts/test-studio-element-free-spot.mjs', 'registered in package.json')
  if (!baseAvailable) { console.log(`  note: base commit ${BASE.slice(0, 8)} not in this clone: the diff checks are skipped`); return }
  // the handlers are the base's, except the two lines handleOpenPanel takes its start from
  const printer = ts.createPrinter({ removeComments: true })
  const decl = (source, name) => {
    const sf = ts.createSourceFile('x.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    let found
    const visit = node => { if (!found && ts.isVariableDeclaration(node) && node.name.getText(sf) === name) found = printer.printNode(ts.EmitHint.Unspecified, node.initializer, sf); else ts.forEachChild(node, visit) }
    visit(sf)
    assert.ok(found, name)
    return found.replace(/\s+/g, ' ')
  }
  const baseHook = read(HOOK, BASE)
  for (const name of ['handleGenerate', 'handleOpenPanelDeferred', 'handleGenerateDeferred']) assert.equal(decl(hook, name), decl(baseHook, name), `${name} is unchanged`)
  const putBack = decl(hook, 'handleOpenPanel').replace(
    'const startCol = freeSpotRef.current?.startCol ?? 2; const startRow = freeSpotRef.current?.startRow ?? 4;',
    'const startCol = 2; const startRow = 4;',
  )
  assert.notEqual(putBack, decl(hook, 'handleOpenPanel'), 'the free-spot lines are in handleOpenPanel')
  assert.equal(putBack, decl(baseHook, 'handleOpenPanel'), 'handleOpenPanel is the base\'s once the two lines are put back')
  // the diff is the hook, the helper, .env.example, package.json and scripts; it adds no viewer command beyond the existing read
  // (Application paths only: other tests of the suite write evidence copies under docs/, which this check must not see.)
  const touched = git(['diff', '--name-only', BASE, '--', 'app', 'components', 'hooks', 'lib', 'types', 'prisma', 'migrations', 'public', 'middleware.ts', 'next.config.mjs',
    'tsconfig.json', 'package.json', 'pnpm-lock.yaml', '.env.example']).split('\n').filter(Boolean).filter(file => file !== LIB)
  assert.deepEqual(touched.sort(), ['.env.example', HOOK, 'package.json'].sort(), `the change touches only the hook, the new lib, .env.example and package.json: ${JSON.stringify(touched)}`)
  const added = git(['diff', BASE, '--', HOOK]).split('\n').filter(line => /^\+(?!\+\+)/.test(line))
  for (const line of added) assert.doesNotMatch(line, /postMessage|iframeRef|contentWindow|createViewerRequestId|sendCommand\(|sendElementCommand\('|action:/, `the hook diff adds no viewer command: ${line}`)
  const removed = git(['diff', BASE, '--', HOOK]).split('\n').filter(line => /^-(?!--)/.test(line)).map(line => line.slice(1).trim())
  assert.deepEqual(removed, ['const startCol = 2', 'const startRow = 4'], 'the hook diff removes only the two literal starts')
}

// ---- 6. mutants ----------------------------------------------------------------------------------------------------------------------------------
const MUTANTS = [
  [LIB, 'touching counts as overlap', s => s.replace('col + width <= box.startCol - gap || box.endCol + gap <= col', 'col + width < box.startCol - gap || box.endCol + gap < col')],
  [LIB, 'touching rows count as overlap', s => s.replace('row + height <= box.startRow - gap || box.endRow + gap <= row', 'row + height < box.startRow - gap || box.endRow + gap < row')],
  [LIB, 'gap never used', s => s.replace('for (const gap of [FREE_SPOT_GAP, 0])', 'for (const gap of [0])')],
  [LIB, 'gap never dropped', s => s.replace('for (const gap of [FREE_SPOT_GAP, 0])', 'for (const gap of [FREE_SPOT_GAP])')],
  [LIB, 'gap tried last', s => s.replace('for (const gap of [FREE_SPOT_GAP, 0])', 'for (const gap of [0, FREE_SPOT_GAP])')],
  [LIB, 'gap of 2', s => s.replace('export const FREE_SPOT_GAP = 1', 'export const FREE_SPOT_GAP = 2')],
  [LIB, 'columns before rows', s => s.replace(
    'for (let row = minRow; row + height <= maxRow; row++) {\n      for (let col = minCol; col + width <= maxCol; col++) {',
    'for (let col = minCol; col + width <= maxCol; col++) {\n      for (let row = minRow; row + height <= maxRow; row++) {')],
  [LIB, 'bottom-up scan', s => s.replace('for (let row = minRow; row + height <= maxRow; row++) {', 'for (let row = maxRow - height; row >= minRow; row--) {')],
  [LIB, 'area reaches column 33', s => s.replace('maxCol: 32', 'maxCol: 33')],
  [LIB, 'area starts at column 1', s => s.replace('minCol: 2', 'minCol: 1')],
  [LIB, 'area starts in the title band', s => s.replace('minRow: 4', 'minRow: 3')],
  [LIB, 'area runs into the footer row', s => s.replace('maxRow: 18', 'maxRow: 19')],
  [LIB, 'area stops a row early', s => s.replace('maxRow: 18', 'maxRow: 17')],
  [LIB, 'backdrop not ignored', s => s.replace('if ((rows[1] - rows[0]) * (cols[1] - cols[0]) >= CANVAS_AREA * FREE_SPOT_BACKDROP_SHARE) continue', '')],
  [LIB, 'backdrop only when the whole canvas', s => s.replace('export const FREE_SPOT_BACKDROP_SHARE = 0.9', 'export const FREE_SPOT_BACKDROP_SHARE = 1')],
  [LIB, 'backdrop share too low', s => s.replace('export const FREE_SPOT_BACKDROP_SHARE = 0.9', 'export const FREE_SPOT_BACKDROP_SHARE = 0.5')],
  [LIB, 'backdrop strictly above the share', s => s.replace('>= CANVAS_AREA * FREE_SPOT_BACKDROP_SHARE', '> CANVAS_AREA * FREE_SPOT_BACKDROP_SHARE + 1000')],
  [LIB, 'hidden element in the way', s => s.replace(' || asRecord(element?.properties)?.visible === false', '')],
  [LIB, 'cut-short list trusted', s => s.replace(' || root.truncated === true', '')],
  [LIB, 'another slide\'s answer trusted', s => s.replace('if (Number(root.slide_index ?? root.slideIndex) !== slideIndex) return null', '')],
  [LIB, 'refusal trusted', s => s.replace('if (!root || root.success !== true) return null', 'if (!root) return null')],
  [LIB, 'success read as truthy', s => s.replace('root.success !== true', '!root.success')],
  [LIB, 'no element list tolerated', s => s.replace('if (!Array.isArray(root.elements) || root.truncated === true) return null', 'if (root.truncated === true) return null')],
  [LIB, 'fractions not snapped', s => s.replace('const snapToMinorGrid = (value: number) => Math.round(value * 5) / 5', 'const snapToMinorGrid = (value: number) => value')],
  [LIB, 'reversed span accepted', s => s.replace('snappedStart >= 1 && snappedStart < snappedEnd', 'snappedStart >= 1')],
  [LIB, 'span from 0 accepted', s => s.replace('snappedStart >= 1 && snappedStart', 'snappedStart >= 0 && snappedStart')],
  [LIB, 'extra span parts accepted', s => s.replace('if (parts.length !== 2) return null', '')],
  [LIB, 'non-numbers accepted', s => s.replace('if (!Number.isFinite(start) || !Number.isFinite(end)) return null', '')],
  [LIB, 'unreadable entry stops the read', s => s.replace('if (!rows || !cols) continue', 'if (!rows || !cols) return null')],
  [LIB, 'size nonsense accepted', s => s.replace("if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null", '')],
  [LIB, 'read has no time limit', s => s.replace("timer = setTimeout(() => reject(new Error('Slide read timed out')), input.timeoutMs ?? FREE_SPOT_READ_TIMEOUT_MS)", 'timer = setTimeout(() => {}, input.timeoutMs ?? FREE_SPOT_READ_TIMEOUT_MS)')],
  [LIB, 'caller\'s time limit ignored', s => s.replace('input.timeoutMs ?? FREE_SPOT_READ_TIMEOUT_MS', 'FREE_SPOT_READ_TIMEOUT_MS')],
  [LIB, 'time limit of 20 s', s => s.replace('FREE_SPOT_READ_TIMEOUT_MS = 2000', 'FREE_SPOT_READ_TIMEOUT_MS = 20000')],
  [LIB, 'timer never cleared', s => s.replace('if (timer !== undefined) clearTimeout(timer)', '')],
  [LIB, 'a failed read throws', s => s.replace('} catch {\n    return null\n  } finally', '} catch (error) {\n    throw error\n  } finally')],
  [LIB, 'wrong slide asked', s => s.replace('{ slideIndex: input.slideIndex }', '{ slideIndex: 0 }')],
  [LIB, 'wrong command', s => s.replace("input.sendElementCommand('getSlideGenerationContext'", "input.sendElementCommand('getTextBoxes'")],
  [LIB, 'flag read as truthy', s => s.replace("=== 'true'", '!== undefined')],
  [LIB, 'flag under another name', s => s.replace('NEXT_PUBLIC_STUDIO_ELEMENT_FREE_SPOT ===', 'NEXT_PUBLIC_STUDIO_ELEMENT_FREE_SPOTS ===')],
  [HOOK, 'flag ignored', s => s.replace('if (studio && STUDIO_ELEMENT_FREE_SPOT_ENABLED) {', 'if (studio) {')],
  [HOOK, 'Studio shell ignored', s => s.replace('if (studio && STUDIO_ELEMENT_FREE_SPOT_ENABLED) {', 'if (STUDIO_ELEMENT_FREE_SPOT_ENABLED) {')],
  [HOOK, 'column ignored', s => s.replace('const startCol = freeSpotRef.current?.startCol ?? 2', 'const startCol = 2')],
  [HOOK, 'row ignored', s => s.replace('const startRow = freeSpotRef.current?.startRow ?? 4', 'const startRow = 4')],
  [HOOK, 'spot not set for a read that failed', s => s.replace('    freeSpotRef.current = spot // read', '    if (spot) freeSpotRef.current = spot // read')],
  [HOOK, 'PLACEHOLDER_FIX hold-back lost', s => s.replace('const open = placeholderDeferral ? handleOpenPanelDeferred : handleOpenPanel', 'const open = handleOpenPanel')],
  [HOOK, 'slide change not noticed', s => s.replace('      if ((getCurrentSlideIndex?.() ?? currentSlideIndex) !== slideIndex) spot = null\n', '')],
  [HOOK, 'second click not dropped', s => s.replace('    if (freeSpotOpeningRef.current.has(type)) return\n', '')],
  [HOOK, 'open guard never released', s => s.replace('      freeSpotOpeningRef.current.delete(type)\n', '')],
  [HOOK, 'read for the first slide only', s => s.replace('pickElementFreeSpot({ sendElementCommand, slideIndex, width', 'pickElementFreeSpot({ sendElementCommand, slideIndex: 0, width')],
  [HOOK, 'default size always', s => s.replace('slideIndex, width: defaults.width, height: defaults.height })', 'slideIndex, width: 10, height: 6 })')],
  [HOOK, 'read skipped', s => s.replace('spot = await pickElementFreeSpot({', 'spot = null; void ({')],
]
// A promise that never settles (a mutant that stalls the open handler or the read) is a caught mutant, not a hang.
const guarded = (fn, ms = 20000) => {
  let timer
  const stalled = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('stalled: a promise never settled')), ms) })
  return Promise.race([fn(), stalled]).finally(() => clearTimeout(timer))
}
async function assertMutantsCaught() {
  for (const [file, label, mutate] of MUTANTS) {
    const source = read(file)
    const mutated = mutate(source)
    assert.notEqual(mutated, source, `mutant "${label}" (${file}) changes the source`)
    let caught = false
    try {
      await guarded(async () => {
        if (file === LIB) { await libChecks({ [file]: mutated }); await hookScenarios({ [file]: mutated }) } else await hookScenarios({ [file]: mutated })
      })
    } catch { caught = true }
    unhandled.length = 0
    assert.equal(caught, true, `mutant "${label}" (${file}) must be caught`)
  }
}

// ---- run -----------------------------------------------------------------------------------------------------------------------------------------
let passed = 0
async function run(name, fn) { await fn(); passed++; console.log(`ok  ${name}`) }

await run('helper: flag literal, spans, which entries count, the scan, the gap, the backdrop, no room, determinism, property test, the read and its timer', () => libChecks())
await run('real Layout: recorded frames, and the pinned viewer code', layoutFrameChecks)
await run('hooks: first free spot per type, tracked, no room / refused / silent read, slide or deck changed, second click, stale spot, with and without PLACEHOLDER_FIX, Generate after, flag-off variants', () => hookScenarios())
await run('flag off == base tree (trace hash), the slide is never read', flagOffIdentity)
await run('wiring: one reader, .env.example, package.json, handlers untouched, diff scope, no new viewer command', wiringChecks)
await run(`${MUTANTS.length} mutants caught`, assertMutantsCaught)
assert.deepEqual(unhandled, [], 'no unhandled rejection')
console.log(`\n${passed} groups passed`)
