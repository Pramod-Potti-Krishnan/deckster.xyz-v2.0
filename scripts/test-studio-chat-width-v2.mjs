// PASS2B G11 (frontend-2): the Studio chat column's default width follows the accepted v4 mockup.
// Flag NEXT_PUBLIC_STUDIO_CHAT_WIDTH_V2 (exact "true", Studio shell only), default off. Flag off must size the column exactly as the base did.
//
// Run: node scripts/test-studio-chat-width-v2.mjs   (plain node: transpile + vm, no network, no env)
//   CHAT_WIDTH_V2_BASE_ROOT=<pristine base checkout> node scripts/test-studio-chat-width-v2.mjs
//     also runs the base checkout's allocator over the same grid and requires the flag-off hash to equal it (section 2).
//
// What is proven, on the REAL lib/studio-workspace-layout.ts and the REAL expressions in app/builder/page.tsx:
//   1. the policy: each stage x window width x user preference x inspector (welcome unchanged; plan 560; deck 440; canvas floors; degrade);
//   2. flag off: the value handed to the allocator, and the allocator's whole output, hash equal to the pre-flag expression over a grid;
//   3. a dragged width always wins and the allocator (unchanged) still clamps it: 480 px canvas floor, 360 px cap beside an inspector;
//   4. the page wiring: the flag is read once with exact 'true', the stage comes from the canvas lifecycle, the markup differs only with the flag on;
//   5. mutation check: every mutant of the policy source is killed by section 1-3.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file, base = root) => fs.readFileSync(path.join(base, file), 'utf8')
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const load = source => {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { module, exports: module.exports })
  return module.exports
}
const libSource = read('lib/studio-workspace-layout.ts')

// ---- the grid ----------------------------------------------------------------------------------------------------------------
// Workspace widths (what the page measures: the window minus the 66 px nav rail) at the windows PK checks, plus the layout boundaries.
const WIDTHS = [Number.NaN, 0, -5, 320, 600, 879, 880, 881, 1000, 1099, 1100, 1101, 1150, 1199, 1200, 1214, 1280, 1374, 1534, 1800, 1920, 2560]
const STAGES = ['welcome', 'plan', 'deck']
const SAVED = [null, 0, 280, 304, 420, 560, 640, 720, 900]
const BASE_EXPRESSION = (saved, stage, width) => saved ?? (stage === 'welcome' ? Math.min(640, width * .44) : 304) // the page's pre-flag expression, verbatim
const allocation = (lib, input) => lib.allocateStudioWorkspace({ chatOpen: true, inspectorOpen: false, inspectorPreference: 360, activePane: 'chat', ...input })
const same = (a, b) => Object.is(a, b)

// ---- sections 1 and 3: the policy, run against any copy of the lib (the real one, then each mutant) --------------------------
function prove(lib, label = 'lib') {
  const { studioChatDefaultWidth: dflt, studioChatPreference: pref, studioChatStage: stageOf } = lib
  const on = { enabled: true }
  for (const stage of STAGES) for (const width of WIDTHS) for (const inspectorOpen of [false, true]) {
    const at = `${label} ${stage} ${width} inspector=${inspectorOpen}`
    // flag off, welcome, an open inspector and a narrower-than-side-by-side window all keep today's value
    assert.ok(same(dflt({ enabled: false, stage, width, inspectorOpen }), BASE_EXPRESSION(null, stage, width)), `${at}: flag off is the base value`)
    assert.ok(same(dflt({ ...on, stage: 'welcome', width, inspectorOpen }), BASE_EXPRESSION(null, 'welcome', width)), `${at}: welcome unchanged`)
    if (inspectorOpen) assert.ok(same(dflt({ ...on, stage, width, inspectorOpen }), BASE_EXPRESSION(null, stage, width)), `${at}: an open inspector keeps today's value`)
    if (stage === 'welcome' || inspectorOpen) continue
    const w = Number.isFinite(width) && width > 0 ? width : 1100 // the allocator's own fallback for a bad measurement
    const got = dflt({ ...on, stage, width, inspectorOpen })
    if (w < 1100) { assert.ok(same(got, BASE_EXPRESSION(null, stage, width)), `${at}: narrower than side by side keeps today's value`); continue }
    const target = stage === 'plan' ? 560 : 440, floor = stage === 'plan' ? 640 : 720
    assert.equal(got, Math.min(target, w - floor), `${at}: target, limited by the canvas floor`)
    assert.ok(Number.isFinite(got) && got >= 380 && got <= target, `${at}: between 380 and the target`)
    assert.ok(w - got >= floor, `${at}: the canvas keeps at least ${floor}px`)
  }
  // the window widths PK checks (workspace = window - 66): the mockup's widths are reached in full
  for (const [windowWidth, workspace] of [[1280, 1214], [1440, 1374], [1600, 1534], [1920, 1854]]) {
    assert.equal(dflt({ ...on, stage: 'plan', width: workspace }), 560, `${windowWidth}: plan/outline 560`)
    assert.equal(dflt({ ...on, stage: 'deck', width: workspace }), 440, `${windowWidth}: deck 440`)
    for (const stage of ['plan', 'deck']) {
      const l = allocation(lib, { width: workspace, chatPreference: pref({ saved: null, ...on, stage, width: workspace }) })
      assert.equal(l.chatWidth, stage === 'plan' ? 560 : 440, `${windowWidth} ${stage}: the allocator keeps the default`)
      assert.ok(l.canvasWidth >= (stage === 'plan' ? 640 : 720) && l.canvasWidth >= 480, `${windowWidth} ${stage}: canvas ${l.canvasWidth}`)
    }
  }
  // degrade: monotone in the window width, never wider than the target, and exactly today's value once not side by side
  for (const stage of ['plan', 'deck']) {
    let last = 0
    for (let width = 1100; width <= 2600; width++) {
      const v = dflt({ ...on, stage, width })
      assert.ok(v >= last, `${stage} ${width}: never narrower as the window grows`)
      assert.ok(allocation(lib, { width, chatPreference: v }).chatWidth === v, `${stage} ${width}: the allocator does not need to clamp the default`)
      assert.ok(allocation(lib, { width, chatPreference: v }).canvasWidth >= 480, `${stage} ${width}: the 480px canvas floor holds`)
      last = v
    }
    assert.equal(dflt({ ...on, stage, width: 1100 }), stage === 'plan' ? 460 : 380, `${stage}: the narrowest side-by-side window`)
    assert.equal(dflt({ ...on, stage, width: 1099 }), 304, `${stage}: one pixel narrower is today's value`)
  }
  // the user's dragged width wins, in every stage, at every width, flag on or off; the unchanged allocator still bounds it
  for (const saved of SAVED.filter(Boolean)) for (const stage of STAGES) for (const width of WIDTHS) for (const enabled of [false, true]) for (const inspectorOpen of [false, true]) {
    assert.ok(same(pref({ saved, enabled, stage, width, inspectorOpen }), saved), `saved ${saved} ${stage} ${width} flag=${enabled}: wins`)
    if (width < 1100 || !(width > 0)) continue
    const a = { width, inspectorOpen, inspectorPreference: 360 }
    assert.equal(JSON.stringify(allocation(lib, { ...a, chatPreference: pref({ saved, enabled, stage, width, inspectorOpen }) })), JSON.stringify(allocation(lib, { ...a, chatPreference: saved })), `saved ${saved}: same layout as handing the allocator the saved width`)
  }
  for (const stage of STAGES) assert.ok(same(pref({ saved: 0, ...on, stage, width: 1374 }), 0), `${stage}: a saved 0 is not replaced (nullish, as in the base)`)
  const bounded = allocation(lib, { width: 1214, chatPreference: pref({ saved: 900, ...on, stage: 'deck', width: 1214 }) })
  assert.equal(bounded.chatWidth, 720, 'a dragged width is still capped by the allocator')
  assert.ok(bounded.canvasWidth >= 480)
  const beside = allocation(lib, { width: 1374, inspectorOpen: true, chatPreference: pref({ saved: 640, ...on, stage: 'deck', width: 1374, inspectorOpen: true }) })
  assert.equal(beside.chatWidth, 360, 'beside an inspector the 360px cap still applies to a dragged width')
  assert.equal(pref({ saved: null, ...on, stage: 'deck', width: 1374 }), 440, 'no saved width: the stage default')
  assert.equal(pref({ saved: null, enabled: false, stage: 'deck', width: 1374 }), 304, 'no saved width, flag off: today')
  // the stage comes from the canvas lifecycle
  const MODES = ['loading', 'awaiting_owner', 'awaiting_viewer', 'generated', 'authored', 'preparing', 'blank', 'empty']
  for (const mode of MODES) {
    assert.equal(stageOf({ welcome: true, mode }), 'welcome', `${mode}: the welcome landing wins`)
    assert.equal(stageOf({ welcome: false, mode }), mode === 'authored' || mode === 'preparing' ? 'plan' : 'deck', `${mode}: stage`)
  }
}
prove(load(libSource))
console.log('Chat width v2 policy (stage x window x preference x inspector) passed')

// ---- section 2: flag off is the base ------------------------------------------------------------------------------------------
function flagOffDigest(lib) {
  const rows = []
  for (const stage of STAGES) for (const width of WIDTHS) for (const saved of SAVED) for (const inspectorOpen of [false, true]) for (const overlay of [false, true]) {
    const chatPreference = lib.studioChatPreference({ saved, enabled: false, stage, width, inspectorOpen })
    rows.push(JSON.stringify([stage, width, saved, inspectorOpen, overlay, chatPreference,
      allocation(lib, { width, chatPreference, inspectorOpen, overlay, inspectorPreference: 420, chatOpen: true, activePane: 'chat' })]))
  }
  return sha(rows.join('\n'))
}
function baseDigest(allocator) {
  const rows = []
  for (const stage of STAGES) for (const width of WIDTHS) for (const saved of SAVED) for (const inspectorOpen of [false, true]) for (const overlay of [false, true]) {
    const chatPreference = BASE_EXPRESSION(saved, stage, width)
    rows.push(JSON.stringify([stage, width, saved, inspectorOpen, overlay, chatPreference,
      allocator({ chatOpen: true, inspectorOpen, inspectorPreference: 420, activePane: 'chat', width, chatPreference, overlay })]))
  }
  return sha(rows.join('\n'))
}
const lib = load(libSource)
const off = flagOffDigest(lib)
if (process.env.PRINT_GOLDEN) console.log('GOLDEN_FLAG_OFF_DIGEST', off)
const GOLDEN_FLAG_OFF_DIGEST = 'd8d4e287d0128884896b1594d3e8cfeba7979c15e797d1cdf26323c1eaa21a4a'
assert.equal(off, baseDigest(lib.allocateStudioWorkspace), 'flag off: the value and the whole allocation hash equal the pre-flag expression')
// the base copy of the allocator (the same grid through the file as it was before this change)
const BASE_ROOT = process.env.CHAT_WIDTH_V2_BASE_ROOT
if (BASE_ROOT) {
  const baseLib = load(read('lib/studio-workspace-layout.ts', path.resolve(BASE_ROOT)))
  assert.equal(typeof baseLib.studioChatPreference, 'undefined', 'CHAT_WIDTH_V2_BASE_ROOT must be the pristine base')
  assert.equal(off, baseDigest(baseLib.allocateStudioWorkspace), 'flag off: hash equals the base checkout')
  console.log('base checkout digest', baseDigest(baseLib.allocateStudioWorkspace), '== flag-off digest', off)
}
assert.equal(off, GOLDEN_FLAG_OFF_DIGEST, 'flag off: the digest recorded from the base sources (a2e14da) — re-print with PRINT_GOLDEN=1')
console.log('Chat width v2 flag off equals the base (digest ' + off.slice(0, 16) + ')')

// ---- section 4: the page wiring -------------------------------------------------------------------------------------------------
const page = read('app/builder/page.tsx'), ast = ts.createSourceFile('page.tsx', page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const all = (node, predicate) => { const found = []; const visit = n => { if (predicate(n)) found.push(n); ts.forEachChild(n, visit) }; visit(node); return found }
const variable = name => { const n = all(ast, n => ts.isVariableDeclaration(n) && n.name.getText(ast) === name)[0]; assert.ok(n, name); return n.initializer }
const evaluate = (expression, bindings) => {
  const out = ts.transpileModule(`export const value = (${expression});`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
  const module = { exports: {} }; vm.runInNewContext(out.outputText, { module, exports: module.exports, ...bindings }); return module.exports.value
}
assert.equal(variable('STUDIO_CHAT_WIDTH_V2_ENABLED').getText(ast), "process.env.NEXT_PUBLIC_STUDIO_CHAT_WIDTH_V2 === 'true'", 'exact "true" turns it on; unset is off')
assert.equal((page.match(/NEXT_PUBLIC_STUDIO_CHAT_WIDTH_V2/g) ?? []).length, 2, 'the flag is read in one place (plus its comment)')
const env = read('.env.example')
assert.match(env, /^NEXT_PUBLIC_STUDIO_CHAT_WIDTH_V2="false"$/m, 'documented, default off')
const layoutCall = variable('workspaceLayout')
const prop = name => layoutCall.arguments[0].properties.find(p => p.name?.getText(ast) === name).initializer.getText(ast)
assert.equal(prop('width'), 'studioOverlayWorkspace ? workspaceInnerWidth : workspaceWidth', 'the allocator input width is unchanged')
assert.equal(prop('chatOpen'), 'studioWorkspaceChatOpen', 'the panel-focus collapse still feeds the allocator')
assert.equal(prop('inspectorOpen'), 'Boolean(activeInspector)')
assert.equal((page.match(/chatPreference:/g) ?? []).length, 2, 'only the live layout and the drag persistence name a chat preference')
assert.match(page, /chatPreference: side === 'chat' \? width : chatWidth \?\? studioChatWidth,/, 'the drag persistence is untouched')
const stageExpression = variable('studioChatWidthStage').getText(ast)
assert.equal(stageExpression, 'studioChatStage({ welcome: studioWelcome, mode: studioCanvasLifecycle.mode })')
const stageOfPage = (welcome, mode) => evaluate(stageExpression, { studioChatStage: lib.studioChatStage, studioWelcome: welcome, studioCanvasLifecycle: { mode } })
assert.equal(stageOfPage(true, 'authored'), 'welcome'); assert.equal(stageOfPage(false, 'authored'), 'plan'); assert.equal(stageOfPage(false, 'generated'), 'deck')
const prefExpression = prop('chatPreference')
const pageValue = (bindings) => evaluate(prefExpression, { studioChatPreference: lib.studioChatPreference, STUDIO_CHAT_WIDTH_V2_ENABLED: false, studioShell: true, chatWidth: null, studioChatWidthStage: 'plan', workspaceWidth: 1374, activeInspector: null, ...bindings })
for (const studioShell of [false, true]) for (const flag of [false, true]) for (const stage of STAGES) for (const chatWidth of [null, 320, 640]) for (const width of [900, 1214, 1374, 1534]) for (const activeInspector of [null, 'element']) {
  const got = pageValue({ studioShell, STUDIO_CHAT_WIDTH_V2_ENABLED: flag, studioChatWidthStage: stage, chatWidth, workspaceWidth: width, activeInspector })
  const wants = flag && studioShell && stage !== 'welcome' && !activeInspector && width >= 1100 && chatWidth === null
    ? Math.min(stage === 'plan' ? 560 : 440, width - (stage === 'plan' ? 640 : 720))
    : BASE_EXPRESSION(chatWidth, stage, width)
  assert.ok(same(got, wants), `page expression: shell=${studioShell} flag=${flag} ${stage} saved=${chatWidth} ${width} inspector=${activeInspector}`)
}
// markup differs only with the flag on: the one new attribute is undefined otherwise
assert.match(page, /data-studio-chat-width-stage=\{studioShell && STUDIO_CHAT_WIDTH_V2_ENABLED \? studioChatWidthStage : undefined\}/)
assert.equal((page.match(/data-studio-chat-width-stage/g) ?? []).length, 1)
// the collapse, first-run and narrow-strip owners are not touched by this change
assert.equal((page.match(/chatOpen: studioWorkspaceChatOpen,/g) ?? []).length, 2, 'the live layout and the width persistence both read the panel-focus chat state')
console.log('Chat width v2 page wiring passed')

// ---- section 5: mutation check ----------------------------------------------------------------------------------------------------
const MUTANTS = [
  ['plan target 560 -> 520', "STUDIO_CHAT_WIDTH_V2_PLAN = 560", "STUDIO_CHAT_WIDTH_V2_PLAN = 520"],
  ['deck target 440 -> 400', "STUDIO_CHAT_WIDTH_V2_DECK = 440", "STUDIO_CHAT_WIDTH_V2_DECK = 400"],
  ['plan canvas floor 640 -> 540', "PLAN_CANVAS_MIN = 640", "PLAN_CANVAS_MIN = 540"],
  ['deck canvas floor 720 -> 620', "DECK_CANVAS_MIN = 720", "DECK_CANVAS_MIN = 620"],
  ['no canvas floor', "return Math.min(plan ? STUDIO_CHAT_WIDTH_V2_PLAN : STUDIO_CHAT_WIDTH_V2_DECK, room)", "return plan ? STUDIO_CHAT_WIDTH_V2_PLAN : STUDIO_CHAT_WIDTH_V2_DECK"],
  ['floor applied to the wrong stage', "(plan ? STUDIO_CHAT_WIDTH_V2_PLAN_CANVAS_MIN : STUDIO_CHAT_WIDTH_V2_DECK_CANVAS_MIN)", "(plan ? STUDIO_CHAT_WIDTH_V2_DECK_CANVAS_MIN : STUDIO_CHAT_WIDTH_V2_PLAN_CANVAS_MIN)"],
  ['saved width ignored', "return input.saved ?? studioChatDefaultWidth(input)", "return studioChatDefaultWidth(input)"],
  ['saved width loses to the default', "return input.saved ?? studioChatDefaultWidth(input)", "return studioChatDefaultWidth(input) ?? input.saved"],
  ['saved width falsy-coalesced', "return input.saved ?? studioChatDefaultWidth(input)", "return input.saved || studioChatDefaultWidth(input)"],
  ['flag off ignored', "if (!enabled || stage === 'welcome'", "if (stage === 'welcome'"],
  ['welcome changed with the flag', "if (!enabled || stage === 'welcome' || inspectorOpen) return legacy", "if (!enabled || inspectorOpen) return legacy"],
  ['inspector ignored', "stage === 'welcome' || inspectorOpen) return legacy", "stage === 'welcome') return legacy"],
  ['no side-by-side guard', "  if (workspaceWidth < STUDIO_DUAL_PANE_MIN_WIDTH) return legacy\n", ""],
  ['side-by-side boundary off by one', "workspaceWidth < STUDIO_DUAL_PANE_MIN_WIDTH", "workspaceWidth <= STUDIO_DUAL_PANE_MIN_WIDTH"],
  ['bad measurement not treated as 1100', "finiteWidth(width, 1100)", "finiteWidth(width, 0)"],
  ['legacy welcome ratio .44 -> .45', "Math.min(640, width * .44)", "Math.min(640, width * .45)"],
  ['legacy default 304 -> 300', "STUDIO_CHAT_WIDTH_LEGACY = 304", "STUDIO_CHAT_WIDTH_LEGACY = 300"],
  ['outline review is a deck', "input.mode === 'authored' || input.mode === 'preparing' ? 'plan' : 'deck'", "input.mode === 'preparing' ? 'plan' : 'deck'"],
  ['planning is a deck', "input.mode === 'authored' || input.mode === 'preparing' ? 'plan' : 'deck'", "input.mode === 'authored' ? 'plan' : 'deck'"],
  ['generated deck is a plan', "input.mode === 'authored' || input.mode === 'preparing' ? 'plan' : 'deck'", "input.mode === 'authored' || input.mode === 'preparing' || input.mode === 'generated' ? 'plan' : 'deck'"],
  ['welcome landing ignored', "if (input.welcome) return 'welcome'", "if (false) return 'welcome'"],
]
let killed = 0
for (const [name, from, to] of MUTANTS) {
  assert.ok(libSource.includes(from), `mutant "${name}": the text it replaces exists`)
  const mutated = libSource.replace(from, to)
  assert.notEqual(mutated, libSource, `mutant "${name}" changes the source`)
  let survived = false
  try { prove(load(mutated), name); survived = flagOffDigest(load(mutated)) === off } catch (error) { assert.equal(error?.code, 'ERR_ASSERTION', `mutant "${name}" must be killed by an assertion, not a crash: ${error}`) }
  assert.ok(!survived, `mutant survived: ${name}`)
  killed++
}
console.log(`Chat width v2 mutation check passed (${killed}/${MUTANTS.length} mutants killed)`)
