// PASS2 Intelligence (FRONTEND-1): the Intelligence page opens on the model chooser, as the accepted v4 mockup has it. Flag NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE (exact "true"),
// default off, and only where the Studio shell is on (the page 404s without it).
//   INT-01 the page opens on the chooser; the current-workflows guide folds into a "How it works" section (same markup)
//   INT-03 a fifth row, Voice & Narration, with the registry's voices      INT-04 each row names its current model and "Recommended" / "Your choice"
//   INT-05 the select offers the recommendation, Best / Balanced / Economy presets, the specific models and (narration) the voices
//   INT-07 a choice applies on change and is kept in this browser; "Reset to recommendations" only when something changed; the dead "Apply to Deckster" button is gone
//   INT-15 ("+ Presentation" in the top bar, the rail's divider and active bar) is NOT built here: it is shared shell work, done for every library page by DET-12 on frontend1/p2-details
//   kept: the live catalog (and its 2026-10 flag), the model comparison, "Your own intelligence", "Managed by Deckster", the scope toggle, "About this catalog"
//
// Run: node scripts/test-studio-p2-intelligence.mjs   (plain node: transpile + vm, no network, no browser, no env)
//   P2_INTEL_BASE=<commit> overrides the base commit flag-off identity is checked against (default fbc77c0, the studio-v4-dev-preparation-code tip the work started from).
//   P2_INTEL_NO_MUTANTS=1 skips the mutation pass.
//
// Proven on the REAL sources lib/studio-intelligence-p2.ts, components/studio-personal/intelligence-p2.tsx, intelligence-workspace.tsx, intelligence-p2.css and the page:
//   1. the helper is import-free; the tasks, presets, voices, options, resolution and the storage format are exact, for the base catalog and the 2026-10 catalog;
//   2. the workspace (executed): flag off, and flag on without the chooser, render the exact bytes of the base commit's workspace (four catalog x polish combinations, two renderers);
//      flag on with the chooser renders the chooser first, the guide inside "How it works", and no view switcher or Design preview;
//   3. the chooser (executed, with a hook runtime): rows, current lines, options, apply on change, reset, storage (restore, legacy draft, failing storage), no request of any kind;
//   4. the CSS: every rule is scoped to this page's markers; the rail and top-bar rules are there;
//   5. mutation check: every mutant of the sources is killed by sections 1-4.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { stripP2Polish } from './studio-p2-polish-strip.mjs'
import { stripLaunchWording } from './studio-launch-wording-strip.mjs' // NEXT_PUBLIC_STUDIO_LAUNCH_WORDING (launched wording): its flag-gated edits come out first, before every older change's strip

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(repoRoot, 'package.json'))
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup, renderToString } = require('react-dom/server')
const postcss = require('postcss')
const reactJsxRuntime = require('react/jsx-runtime')

const BASE_COMMIT = process.env.P2_INTEL_BASE || 'fbc77c0430099ec7e11a188307ee5521b6937719'
// the Pass 2 polish change (scripts/test-studio-p2-polish.mjs) is put back out first: this test holds the files as this page's change left them
const read = rel => stripP2Polish(rel, stripLaunchWording(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8')))
const baseSource = rel => {
  try { return execFileSync('git', ['show', `${BASE_COMMIT}:${rel}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }) }
  catch (error) { throw new Error(`base commit ${BASE_COMMIT} is not in this clone (fetch the full history): ${error.message}`) }
}

const LIB = 'lib/studio-intelligence-p2.ts'
const CHOOSER = 'components/studio-personal/intelligence-p2.tsx'
const WORKSPACE = 'components/studio-personal/intelligence-workspace.tsx'
const CSS = 'components/studio-personal/intelligence-p2.css'
const PAGE = 'app/(app)/studio/intelligence/page.tsx'
const ENV = '.env.example'
const PKG = 'package.json'
const SOURCES = Object.fromEntries([LIB, CHOOSER, WORKSPACE, CSS, PAGE, ENV, PKG].map(rel => [rel, read(rel)]))
const BASE_WORKSPACE = baseSource(WORKSPACE)
const BASE_PAGE = baseSource(PAGE)
const dir = 'components/studio-personal'
const baseCatalog = JSON.parse(read(`${dir}/model-catalog-snapshot.json`))
const refreshedCatalog = JSON.parse(read(`${dir}/model-catalog-snapshot-2026-10.json`))
const FLAG = 'NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE'

let checks = 0
let counting = true
const count = fn => (...args) => { if (counting) checks++; return fn(...args) }
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value)) // values built inside the vm carry its realm's prototypes
const eq = count(assert.equal), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch), deepEq = count((actual, expected, message) => assert.deepStrictEqual(plain(actual), plain(expected), message))

// ---------------------------------------------------------------- loading
const compile = (source, fileName) => {
  const out = ts.transpileModule(source, { fileName, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } })
  assert.equal((out.diagnostics ?? []).filter(x => x.category === ts.DiagnosticCategory.Error).length, 0, `${fileName} compiles`)
  return out.outputText
}
function loadLib(source) {
  const module = { exports: {} }
  new Function('module', 'exports', compile(source, LIB))(module, module.exports)
  return module.exports
}
const icon = name => function Icon() { return React.createElement('svg', { 'data-icon': String(name) }) }
class FakeNode {}
/** The workspace source (the branch's or the base commit's), run with its imports stubbed. `hooks` (a hook runtime) switches React and the JSX runtime to mocks that build plain nodes. */
function loadWorkspace(source, { env = {}, hooks, win, doc } = {}) {
  const mockJsx = (type, props) => ({ type, props: props || {} })
  const module = { exports: {} }
  vm.runInNewContext(compile(source, WORKSPACE), {
    module, exports: module.exports, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', ...env } }, window: win, document: doc, Node: FakeNode,
    require(id) {
      if (id === 'react') return hooks ?? React
      if (id === 'react/jsx-runtime') return hooks ? { jsx: mockJsx, jsxs: mockJsx, Fragment: 'Fragment' } : reactJsxRuntime
      if (id === 'lucide-react') return new Proxy({}, { get: (_, name) => hooks ? String(name) : icon(name) })
      if (id.endsWith('model-catalog-snapshot.json')) return { default: baseCatalog }
      if (id.endsWith('model-catalog-snapshot-2026-10.json')) return { default: refreshedCatalog }
      if (id.includes('studio-workflow-action')) return { StudioWorkflowAction: function StudioWorkflowAction() { return hooks ? null : React.createElement('button', { type: 'button' }, 'action') } }
      if (id.includes('app-header')) return { BackToBuilderButton: function BackToBuilderButton() { return hooks ? null : React.createElement('button', { type: 'button' }, 'back') } }
      if (id.includes('studio-intro-replay')) return { StudioIntroReplay: function StudioIntroReplay() { return null } }
      if (id.endsWith('.css')) return {}
      assert.fail(`Unmocked dependency in the workspace: ${id}`)
    },
  })
  return module.exports
}
function loadChooser(source, { lib, workspace, hooks, win, doc }) {
  const mockJsx = (type, props) => ({ type, props: props || {} })
  const module = { exports: {} }
  const deps = {
    react: hooks ?? React,
    'react/jsx-runtime': hooks ? { jsx: mockJsx, jsxs: mockJsx, Fragment: 'Fragment' } : reactJsxRuntime,
    'lucide-react': new Proxy({}, { get: (_, name) => hooks ? String(name) : icon(name) }),
    './intelligence-workspace': workspace,
    '@/lib/studio-intelligence-p2': lib,
    './intelligence-p2.css': {},
  }
  vm.runInNewContext(compile(source, CHOOSER), { module, exports: module.exports, window: win, document: doc, require: id => (id in deps ? deps[id] : assert.fail(`Unexpected import in the chooser: ${id}`)) })
  return module.exports
}

// ---------------------------------------------------------------- a small hook runtime (nested function components, state, effects with deps and cleanups, a flush loop)
const walk = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(walk) : [tree, ...walk(tree.props?.children)]
const nodeText = tree => typeof tree === 'string' || typeof tree === 'number' ? String(tree) : Array.isArray(tree) ? tree.map(nodeText).join('') : tree && typeof tree === 'object' ? nodeText(tree.props?.children ?? '') : ''
function makeStorage(mode = {}) {
  const map = new Map(), log = []
  return {
    map, log, mode,
    getItem(key) { log.push(`get ${key}`); if (mode.get) throw new Error('SecurityError'); return map.has(key) ? map.get(key) : null },
    setItem(key, value) { log.push(`set ${key}`); if (mode.set) throw new Error('QuotaExceededError'); map.set(key, String(value)) },
    removeItem(key) { log.push(`remove ${key}`); if (mode.remove) throw new Error('SecurityError'); map.delete(key) },
  }
}
/** Mounts the chooser (from the given sources) under a hook runtime. */
function mount({ sources = SOURCES, catalogFlag, storage, accessThrows = false } = {}) {
  const listeners = { window: new Map(), document: new Map() }
  const win = { innerWidth: 1440, innerHeight: 900, addEventListener: (name, fn) => listeners.window.set(name, fn), removeEventListener: name => listeners.window.delete(name) }
  if (accessThrows) Object.defineProperty(win, 'localStorage', { get() { throw new Error('SecurityError') } })
  else win.localStorage = storage
  const doc = { addEventListener: (name, fn) => listeners.document.set(name, fn), removeEventListener: name => listeners.document.delete(name) } // no querySelector: the page must not reach into the shell's DOM
  let current
  const fibers = new Map(), queue = []
  let dirty = false
  const hooks = {
    useState(initial) {
      const fiber = current, index = fiber.cursor++
      if (!(index in fiber.state)) fiber.state[index] = typeof initial === 'function' ? initial() : initial
      return [fiber.state[index], value => { const next = typeof value === 'function' ? value(fiber.state[index]) : value; if (!Object.is(next, fiber.state[index])) { fiber.state[index] = next; dirty = true } }]
    },
    useRef(initial) { const fiber = current, index = fiber.cursor++; return fiber.state[index] ??= { current: initial } },
    useEffect(effect, deps) {
      assert.ok(Array.isArray(deps), 'every effect needs a dependency array')
      const fiber = current, index = fiber.cursor++, prior = fiber.effects[index]
      if (!prior || deps.some((value, i) => !Object.is(value, prior.deps[i]))) fiber.pending.push({ fiber, index, effect, deps })
    },
  }
  const env = catalogFlag ? { NEXT_PUBLIC_STUDIO_MODEL_CATALOG_2026_10: catalogFlag } : {}
  const lib = loadLib(sources[LIB])
  const workspace = loadWorkspace(sources[WORKSPACE], { env: { ...env, [FLAG]: 'true' }, hooks, win, doc })
  const chooser = loadChooser(sources[CHOOSER], { lib, workspace, hooks, win, doc })
  function resolve(node, where) {
    if (Array.isArray(node)) return node.map((child, i) => resolve(child, `${where}.${i}`))
    if (!node || typeof node !== 'object') return node
    if (typeof node.type === 'function') {
      const key = `${where}/${node.type.name}`
      let fiber = fibers.get(key)
      if (!fiber) fibers.set(key, fiber = { state: [], effects: [], cursor: 0, pending: [] })
      const parent = current
      current = fiber; fiber.cursor = 0
      const out = node.type(node.props)
      current = parent
      const resolved = resolve(out, key)
      queue.push(...fiber.pending); fiber.pending = []
      return resolved
    }
    return { type: node.type, props: { ...node.props, children: resolve(node.props.children, `${where}.c`) } }
  }
  const rt = {
    storage, win, doc, listeners, lib, tree: null,
    flush() {
      for (let pass = 0; pass < 40; pass++) {
        dirty = false; queue.length = 0
        rt.tree = resolve({ type: chooser.IntelligenceChooser, props: {} }, 'root')
        for (const { fiber, index, effect, deps } of queue.splice(0)) { fiber.effects[index]?.cleanup?.(); fiber.effects[index] = { deps, cleanup: effect() } }
        if (!dirty) return rt
      }
      throw new Error('render loop did not settle')
    },
    act(fn) { fn(); return rt.flush() },
    unmount() { for (const fiber of fibers.values()) for (const entry of fiber.effects) entry?.cleanup?.() },
    nodes() { return walk(rt.tree) },
    text: nodeText,
    find(predicate, label = 'control') { const found = rt.nodes().find(predicate); assert.ok(found, `Expected ${label}`); return found },
    maybe(predicate) { return rt.nodes().find(predicate) },
    all(predicate) { return rt.nodes().filter(predicate) },
    select(task) { return rt.find(node => node.type === 'select' && node.props.id === `sp-p2-model-${task}`, `select ${task}`) },
    choose(task, value) { rt.act(() => rt.select(task).props.onChange({ target: { value } })) },
    row(task) { return rt.find(node => node.props?.['data-model-task'] === task, `row ${task}`) },
    current(task) { return rt.find(node => node.props?.['data-p2-current'] === task, `current line ${task}`) },
    inspectButton(task) { return rt.find(node => node.type === 'button' && node.props.className?.includes('sp-p2-inspect') && rt.text(rt.row(task)).startsWith(rt.text(node)) && rt.row(task).props.children.flat?.().includes(node), `inspect ${task}`) },
    reset() { return rt.maybe(node => node.props?.['data-p2-reset'] === 'true') },
    pill() { return rt.find(node => node.props?.['data-p2-status'] !== undefined, 'the status pill') },
    feedback() { return rt.text(rt.find(node => String(node.props?.className || '').includes('sp-p2-feedback'), 'the live region')) },
    note() { return rt.text(rt.find(node => node.props?.['data-p2-note'] === 'true', 'the one note')) },
    inspector() { return rt.find(node => node.props?.['data-p2-inspector'] !== undefined, 'the inspector') },
  }
  return rt.flush()
}

// ---------------------------------------------------------------- expected values (written out here, not derived from the helper)
const TASKS = [
  ['planning_strategy', 'Planning & Strategy', 'Deck planning · Story structure · Narrative strategy'],
  ['content_writing', 'Content Writing', 'Slide copy · Speaker notes · Writing and rewriting'],
  ['research_analysis', 'Research & Analysis', 'Research planning · Source synthesis · Analysis'],
  ['imagery', 'Imagery', 'Slide imagery · Image generation · Illustrations'],
  ['voice_narration', 'Voice & Narration', 'Presentation narration · Voice selection'],
]
const VOICE_MODELS_LABELS = ['Fish Audio S2.1 Pro · Fish Audio', 'Microsoft MAI Voice 2 Flash · Microsoft', 'Kokoro 82M · Hexgrad', 'Gemini 3.1 Flash TTS Preview · Google']
const VOICES = ['Alloy · Fish Audio S2.1 Pro', 'Ava · Microsoft MAI Voice 2 Flash', 'Andrew · Microsoft MAI Voice 2 Flash', 'Heart · Kokoro 82M', 'Zephyr · Gemini 3.1 Flash TTS Preview', 'Puck · Gemini 3.1 Flash TTS Preview', 'Charon · Gemini 3.1 Flash TTS Preview', 'Kore · Gemini 3.1 Flash TTS Preview', 'Aoede · Gemini 3.1 Flash TTS Preview']
const G = n => `${n} · Google`
const EXPECTED_OPTIONS = {
  base: {
    planning_strategy: { recommended: 'Recommended — Gemini 3 Flash Preview', presets: ['Best — Gemini 3.1 Pro Preview', 'Balanced — Gemini 3 Flash Preview', 'Economy — Gemini 2.5 Flash Lite'], models: [G('Gemini 3 Flash Preview'), G('Gemini 3.1 Pro Preview'), G('Gemini 2.5 Pro'), G('Gemini 2.5 Flash Lite')] },
    content_writing: { recommended: 'Recommended — Gemini 3 Flash Preview', presets: ['Best — Gemini 3.5 Flash', 'Balanced — Gemini 3 Flash Preview', 'Economy — Gemini 2.5 Flash Lite'], models: [G('Gemini 3 Flash Preview'), G('Gemini 3.5 Flash'), G('Gemini 2.5 Flash'), G('Gemini 2.5 Flash Lite')] },
    research_analysis: { recommended: 'Recommended — Gemini 3 Flash Preview', presets: ['Best — Gemini 3.1 Pro Preview', 'Balanced — Gemini 3 Flash Preview', 'Economy — Gemini 2.5 Flash Lite'], models: [G('Gemini 3 Flash Preview'), G('Gemini 3.1 Pro Preview'), G('Gemini 2.5 Flash'), G('Gemini 2.5 Flash Lite')] },
    imagery: { recommended: 'Recommended — Gemini 2.5 Flash Image', presets: ['Best — Gemini 3.1 Flash Image Preview', 'Balanced — Gemini 2.5 Flash Image', 'Economy — Gemini 2.5 Flash Image'], models: [G('Gemini 2.5 Flash Image'), G('Gemini 3.1 Flash Image Preview')] },
  },
  refreshed: {
    planning_strategy: { recommended: 'Recommended — Gemini 3 Flash Preview', presets: ['Best — Gemini 3.1 Pro Preview', 'Balanced — Gemini 3 Flash Preview', 'Economy — Gemini 3.1 Flash Lite'], models: [G('Gemini 3 Flash Preview'), G('Gemini 3.1 Pro Preview'), G('Gemini 3.1 Flash Lite')] },
    content_writing: { recommended: 'Recommended — Gemini 3 Flash Preview', presets: ['Best — Gemini 3.5 Flash', 'Balanced — Gemini 3 Flash Preview', 'Economy — Gemini 3.1 Flash Lite'], models: [G('Gemini 3 Flash Preview'), G('Gemini 3.5 Flash'), G('Gemini 3.1 Flash Lite')] },
    research_analysis: { recommended: 'Recommended — Gemini 3 Flash Preview', presets: ['Best — Gemini 3.1 Pro Preview', 'Balanced — Gemini 3 Flash Preview', 'Economy — Gemini 3.1 Flash Lite'], models: [G('Gemini 3 Flash Preview'), G('Gemini 3.1 Pro Preview'), G('Gemini 3.1 Flash Lite')] },
    imagery: { recommended: 'Recommended — Gemini 2.5 Flash Image', presets: ['Best — Gemini 3.1 Flash Image Preview', 'Balanced — Gemini 2.5 Flash Image', 'Economy — Gemini 2.5 Flash Image'], models: [G('Gemini 2.5 Flash Image'), G('Gemini 3.1 Flash Image Preview')] },
  },
}
const VOICE_EXPECTED = { recommended: 'Recommended — Alloy · Fish Audio S2.1 Pro', presets: ['Best — Fish Audio S2.1 Pro', 'Balanced — Microsoft MAI Voice 2 Flash', 'Economy — Kokoro 82M'], models: VOICE_MODELS_LABELS, voices: VOICES }
const RETIRED = ['google/gemini-2.5-pro', 'google/gemini-2.5-flash', 'google/gemini-2.5-flash-lite']

// ================================================================ the whole check, run on a set of sources (the real ones, then each mutant)
function verify(S) {
  // ------------------------------------------------------------ 1. the helper
  const libSource = S[LIB]
  nomatch(libSource.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''), /\bimport\b|\brequire\s*\(|\bfetch\b|XMLHttpRequest|WebSocket|sendBeacon/, 'the helper is import-free and makes no request')
  const lib = loadLib(libSource)
  for (const [label, cat] of [['base', baseCatalog], ['refreshed', refreshedCatalog]]) {
    const catalog = cat
    deepEq(lib.P2_TASKS.map(task => [task.id, task.label, task.descriptors.join(' · ')]), TASKS, 'the five tasks in the mockup order')
    deepEq(lib.P2_TASK_IDS, TASKS.map(task => task[0]))
    deepEq(lib.P2_PRESETS, [{ id: 'best', label: 'Best' }, { id: 'balanced', label: 'Balanced' }, { id: 'economy', label: 'Economy' }])
    for (const [id] of TASKS.slice(0, 4)) {
      const options = lib.p2Options(catalog, id)
      const expected = EXPECTED_OPTIONS[label][id]
      eq(options.recommended.value, 'default'); eq(options.recommended.label, expected.recommended)
      deepEq(options.presets.map(option => option.label), expected.presets, `${label} ${id} presets`)
      deepEq(options.presets.map(option => option.value), ['best', 'balanced', 'economy'])
      deepEq(options.models.map(option => option.label), expected.models, `${label} ${id} models`)
      deepEq(options.models.map(option => option.value), catalog.tasks[id].models.map(model => `model:${model}`), 'the specific models are exactly what the catalog lists for the task')
      deepEq(options.voices, [], 'only narration offers voices')
      // every offered value is a valid choice; a preset never names a model the task does not offer
      for (const option of [options.recommended, ...options.presets, ...options.models]) ok(lib.isP2Choice(catalog, id, option.value), `${id} ${option.value}`)
      for (const preset of ['best', 'balanced', 'economy']) ok(catalog.tasks[id].models.includes(lib.p2PresetModelId(catalog, id, preset)), `${label} ${id} ${preset} is offered`)
      for (const retired of RETIRED) if (label === 'refreshed') ok(!options.models.some(option => option.value === `model:${retired}`) && !options.presets.some(option => option.label.includes(catalog.models[retired]?.name ?? '#')), 'no retired id is offered with the refreshed catalog')
    }
    {
      const voice = lib.p2Options(catalog, 'voice_narration')
      eq(voice.recommended.label, VOICE_EXPECTED.recommended); deepEq(voice.presets.map(option => option.label), VOICE_EXPECTED.presets); deepEq(voice.models.map(option => option.label), VOICE_EXPECTED.models); deepEq(voice.voices.map(option => option.label), VOICE_EXPECTED.voices)
      eq(voice.voices.length, 9)
      deepEq(voice.voices.map(option => option.value.split('::')[1]), ['alloy', 'ava', 'andrew', 'heart', 'zephyr', 'puck', 'charon', 'kore', 'aoede'])
      for (const option of [voice.recommended, ...voice.presets, ...voice.models, ...voice.voices]) ok(lib.isP2Choice(catalog, 'voice_narration', option.value), `voice ${option.value}`)
    }
    // resolution
    const rec = lib.p2Resolve(catalog, 'planning_strategy', 'default')
    deepEq([rec.name, rec.provider, rec.origin, rec.modelId], ['Gemini 3 Flash Preview', 'Google', 'Recommended', 'google/gemini-3-flash-preview'])
    eq(lib.p2OriginLine(rec), 'Google · Recommended')
    const best = lib.p2Resolve(catalog, 'planning_strategy', 'best')
    deepEq([best.name, best.origin], ['Gemini 3.1 Pro Preview', 'Your choice'])
    eq(lib.p2Resolve(catalog, 'content_writing', 'model:google/gemini-3.5-flash').name, 'Gemini 3.5 Flash')
    eq(lib.p2Resolve(catalog, 'imagery', 'default').name, 'Gemini 2.5 Flash Image')
    eq(lib.p2Resolve(catalog, 'imagery', 'economy').name, 'Gemini 2.5 Flash Image')
    const economy = lib.p2Resolve(catalog, 'planning_strategy', 'economy')
    eq(economy.name, label === 'base' ? 'Gemini 2.5 Flash Lite' : 'Gemini 3.1 Flash Lite')
    const alloy = lib.p2Resolve(catalog, 'voice_narration', 'default')
    deepEq([alloy.name, alloy.voiceName, alloy.provider, alloy.origin, alloy.modelId], ['Alloy', 'Alloy', 'Fish Audio', 'Recommended', 'fish-audio/s2.1-pro'])
    deepEq([lib.p2Resolve(catalog, 'voice_narration', 'balanced').name, lib.p2Resolve(catalog, 'voice_narration', 'balanced').provider], ['Ava', 'Microsoft'])
    eq(lib.p2Resolve(catalog, 'voice_narration', 'economy').name, 'Heart')
    eq(lib.p2Resolve(catalog, 'voice_narration', 'model:google/gemini-3.1-flash-tts-preview').name, 'Zephyr')
    deepEq([lib.p2Resolve(catalog, 'voice_narration', 'voice:google/gemini-3.1-flash-tts-preview::kore').name, lib.p2Resolve(catalog, 'voice_narration', 'voice:google/gemini-3.1-flash-tts-preview::kore').provider], ['Kore', 'Google'])
    // an invalid choice reads as the recommendation
    for (const bad of ['nonsense', '', 'model:google/not-a-model', 'voice:fish-audio/s2.1-pro::alloy', 'model:fish-audio/s2.1-pro', null, undefined, 7]) {
      ok(!lib.isP2Choice(catalog, 'planning_strategy', bad), `planning must reject ${String(bad)}`)
      eq(lib.p2Resolve(catalog, 'planning_strategy', bad).origin, 'Recommended')
    }
    ok(!lib.isP2Choice(catalog, 'voice_narration', 'model:google/gemini-3.1-pro-preview') && !lib.isP2Choice(catalog, 'voice_narration', 'voice:fish-audio/s2.1-pro::nobody'), 'narration offers narration models and voices only')
    ok(!lib.isP2Choice(catalog, 'imagery', 'model:google/gemini-3.1-pro-preview'), 'a task offers only its own models')
    // storage
    eq(lib.p2StorageKey(catalog), `deckster-studio-intelligence-p2-v1:${catalog.version}`)
    const choices = { ...lib.p2DefaultChoices(), planning_strategy: 'best', voice_narration: 'voice:microsoft/mai-voice-2-flash::andrew' }
    eq(lib.p2ChangedCount(choices), 2); eq(lib.p2ChangedCount(lib.p2DefaultChoices()), 0)
    eq(lib.p2Serialize(catalog, choices), JSON.stringify({ v: 1, catalog: catalog.version, choices }))
    deepEq(lib.p2Parse(catalog, lib.p2Serialize(catalog, choices)), choices)
    eq(lib.p2Parse(catalog, lib.p2Serialize(catalog, lib.p2DefaultChoices())), null)
    eq(lib.p2Parse(catalog, null), null); eq(lib.p2Parse(catalog, ''), null); eq(lib.p2Parse(catalog, '{not json'), null); eq(lib.p2Parse(catalog, 'null'), null); eq(lib.p2Parse(catalog, '[]'), null)
    eq(lib.p2Parse(catalog, JSON.stringify({ v: 2, catalog: catalog.version, choices })), null)
    eq(lib.p2Parse(catalog, JSON.stringify({ v: 1, catalog: 'other', choices })), null)
    eq(lib.p2Parse(catalog, JSON.stringify({ v: 1, catalog: catalog.version })), null)
    // a stored retired id maps to its successor under the refreshed catalog (and is read as is under the base one); junk is dropped
    const stored = { planning_strategy: 'model:google/gemini-2.5-pro', content_writing: 'model:google/gemini-2.5-flash-lite', research_analysis: 'bogus', imagery: 'model:google/nope', voice_narration: 'best', __proto__: { x: 1 }, toString: 'best' }
    const sane = lib.p2Sanitize(catalog, JSON.parse(JSON.stringify(stored)))
    if (label === 'refreshed') deepEq(sane, { planning_strategy: 'model:google/gemini-3.1-pro-preview', content_writing: 'model:google/gemini-3.1-flash-lite', research_analysis: 'default', imagery: 'default', voice_narration: 'best' })
    else deepEq(sane, { planning_strategy: 'model:google/gemini-2.5-pro', content_writing: 'model:google/gemini-2.5-flash-lite', research_analysis: 'default', imagery: 'default', voice_narration: 'best' })
    deepEq(lib.p2Sanitize(catalog, JSON.parse('{"__proto__":{"planning_strategy":"best"},"constructor":"best"}')), lib.p2DefaultChoices())
    deepEq(lib.p2Sanitize(catalog, null), lib.p2DefaultChoices()); deepEq(lib.p2Sanitize(catalog, ['best']), lib.p2DefaultChoices()); deepEq(lib.p2Sanitize(catalog, 'best'), lib.p2DefaultChoices())
    // the earlier Design preview draft
    const legacy = { planning_strategy: 'google/gemini-3.1-pro-preview', content_writing: 'default', research_analysis: 'google/gemini-3-flash-preview', imagery: 'default' }
    deepEq(lib.p2FromLegacyDraft(catalog, legacy), { ...lib.p2DefaultChoices(), planning_strategy: 'model:google/gemini-3.1-pro-preview', research_analysis: 'model:google/gemini-3-flash-preview' })
    eq(lib.p2FromLegacyDraft(catalog, null), null); eq(lib.p2FromLegacyDraft(catalog, { planning_strategy: 'default' }), null)
    // comparison start
    eq(lib.p2ComparisonFor(catalog, 'planning_strategy', 'default'), 'google/gemini-3.1-pro-preview')
    eq(lib.p2ComparisonFor(catalog, 'planning_strategy', 'best'), 'google/gemini-3-flash-preview')
  }
  {
    // a catalog that does not offer a preset's model: the preset is not offered, and is not a valid choice
    const narrow = JSON.parse(JSON.stringify(baseCatalog))
    narrow.tasks.imagery.models = ['google/gemini-2.5-flash-image']
    deepEq(lib.p2Options(narrow, 'imagery').presets.map(option => option.value), ['balanced', 'economy'])
    eq(lib.p2PresetModelId(narrow, 'imagery', 'best'), null); eq(lib.p2PresetModelId(narrow, 'imagery', 'economy'), 'google/gemini-2.5-flash-image')
    ok(!lib.isP2Choice(narrow, 'imagery', 'best') && lib.isP2Choice(narrow, 'imagery', 'balanced'))
    eq(lib.p2Resolve(narrow, 'imagery', 'best').origin, 'Recommended')
    // a stored set made of inherited keys restores nothing
    deepEq(lib.p2Sanitize(baseCatalog, Object.create({ planning_strategy: 'best', imagery: 'best' })), lib.p2DefaultChoices())
    deepEq(lib.p2Sanitize(baseCatalog, Object.assign(Object.create({ imagery: 'best' }), { planning_strategy: 'best' })), { ...lib.p2DefaultChoices(), planning_strategy: 'best' })
  }
  // the status pill and the spoken lines
  deepEq(lib.p2Status(0, 'ok'), { state: 'clean', label: 'Following recommendations' })
  deepEq(lib.p2Status(0, 'unavailable'), { state: 'clean', label: 'Following recommendations' })
  deepEq(lib.p2Status(2, 'ok'), { state: 'saved', label: 'Saved on this device' })
  deepEq(lib.p2Status(2, 'pending'), { state: 'saved', label: 'Saved on this device' })
  deepEq(lib.p2Status(1, 'unavailable'), { state: 'session', label: 'Session only' })
  eq(lib.p2ChoiceFeedback(baseCatalog, 'planning_strategy', 'best', 'ok'), 'Planning & Strategy: Gemini 3.1 Pro Preview kept on this device.')
  eq(lib.p2ChoiceFeedback(baseCatalog, 'planning_strategy', 'best', 'unavailable'), 'Planning & Strategy: Gemini 3.1 Pro Preview kept for this session.')
  eq(lib.p2ChoiceFeedback(baseCatalog, 'voice_narration', 'default', 'ok'), 'Voice & Narration follows the recommendation, Alloy.')
  eq(lib.P2_RESET_LABEL, 'Reset to recommendations')
  eq(lib.P2_RESET_FEEDBACK, 'Your choices now follow Deckster’s recommendations.')
  eq(lib.P2_ONE_LINE, 'Your choices are kept on this device. Deckster does not use them to pick models yet.')
  ok(lib.P2_ONE_LINE_NO_STORAGE.includes('cannot keep your choices') && lib.P2_ONE_LINE_NO_STORAGE.includes('does not use them to pick models yet'))

  // ------------------------------------------------------------ 2. the workspace
  const renderBase = (env, how) => { const { IntelligenceWorkspace } = loadWorkspace(BASE_WORKSPACE, { env }); const el = React.createElement(IntelligenceWorkspace); return how === 'string' ? renderToString(el) : renderToStaticMarkup(el) }
  const renderBranch = (env, how, props) => { const { IntelligenceWorkspace } = loadWorkspace(S[WORKSPACE], { env }); const el = React.createElement(IntelligenceWorkspace, props); return how === 'string' ? renderToString(el) : renderToStaticMarkup(el) }
  const chooserElement = React.createElement('div', { id: 'chooser-stand-in' }, 'CHOOSER')
  for (const catalogEnv of [{}, { NEXT_PUBLIC_STUDIO_MODEL_CATALOG_2026_10: 'true' }]) {
    for (const polishEnv of [{}, { NEXT_PUBLIC_STUDIO_INTELLIGENCE_POLISH: 'true' }]) {
      const env = { ...catalogEnv, ...polishEnv }
      for (const how of ['static', 'string']) {
        const expected = renderBase(env, how)
        eq(renderBranch(env, how), expected, `flag unset: the base bytes (${JSON.stringify(env)}, ${how})`)
        // flag off while the page hands in a chooser: still the base bytes
        for (const off of [undefined, '', 'false', '0', '1', 'TRUE', 'True', 'yes', ' true', 'true ']) eq(renderBranch({ ...env, ...(off === undefined ? {} : { [FLAG]: off }) }, how, { chooser: chooserElement }), expected, `flag ${JSON.stringify(off)} with a chooser: the base bytes (${JSON.stringify(env)}, ${how})`)
        // flag on, no chooser handed in: the base bytes (the chooser is what turns the page over)
        eq(renderBranch({ ...env, [FLAG]: 'true' }, how), expected, `flag on without a chooser: the base bytes (${JSON.stringify(env)}, ${how})`)
      }
      const on = renderBranch({ ...env, [FLAG]: 'true' }, 'static', { chooser: chooserElement })
      ok(on.includes('data-intelligence-p2="true"') && on.includes('id="chooser-stand-in"'))
      ok(on.indexOf('CHOOSER') < on.indexOf('sp-p2-how'), 'the chooser comes first, the guide after it')
      ok(on.includes('<details class="sp-p2-how" data-intelligence-how="true"><summary>How it works<small>Where each kind of work happens in Studio today</small></summary>'), 'the guide folds into How it works')
      ok(!/<details class="sp-p2-how"[^>]* open/.test(on), 'How it works is folded')
      const how = on.slice(on.indexOf('sp-p2-how'))
      for (const text of ['Choose the work you want to do', 'CURRENT WORKFLOW', 'Your brief for Director', 'Use suggested brief', 'Reset local briefs', 'Review the editable brief in Studio']) ok(how.includes(text), `How it works keeps the guide: ${text}`)
      ok(!on.includes('class="sp-intelligence-view" hidden=""'), 'the guide is shown inside the section')
      for (const gone of ['Design preview', 'sp-design-preview', 'Give each part of your story a clear direction.', 'Available controls · service-managed model routing', 'sp-preview-switcher', 'Apply to Deckster', 'Prototype examples only']) ok(!on.includes(gone), `flag on: ${gone} is gone`)
      eq(on.match(/<main /g).length, 1)
      ok(on.includes('data-studio-personal="intelligence"') && on.includes('data-studio-intro-surface="models"'), 'the page keeps its markers')
    }
  }
  {
    const w = S[WORKSPACE]
    match(w, /const p2 = p2Intelligence && Boolean\(chooser\)/)
    match(w, /const p2Intelligence = process\.env\.NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE === "true"/)
  }

  // ------------------------------------------------------------ 3. the chooser
  for (const [label, catalogFlag, cat] of [['catalog off', undefined, baseCatalog], ['catalog on', 'true', refreshedCatalog]]) {
    const expected = EXPECTED_OPTIONS[catalogFlag ? 'refreshed' : 'base']
    const key = `deckster-studio-intelligence-p2-v1:${cat.version}`
    const legacyKey = `deckster-studio-intelligence-draft-v1:${cat.version}`
    // first view
    {
      const storage = makeStorage()
      const rt = mount({ sources: S, catalogFlag, storage })
      eq(rt.text(rt.find(node => node.type === 'h1')), 'Intelligence')
      ok(rt.nodes().some(node => node.type === 'p' && rt.text(node) === 'Choose the model behind each part of your story.'), `${label}: the mockup's subtitle`)
      eq(rt.text(rt.find(node => node.type === 'p' && node.props.className === 'sp-eyebrow')), 'WORK WITH DECKSTER')
      deepEq(rt.all(node => node.props?.['data-model-task']).map(node => node.props['data-model-task']), TASKS.map(task => task[0]), 'five rows in order')
      for (const [id, name, descriptors] of TASKS) {
        const row = rt.row(id)
        eq(row.props.role, 'listitem')
        const inspect = rt.find(node => node.type === 'button' && node.props.className?.includes('sp-p2-inspect') && walk(row).includes(node))
        eq(rt.text(inspect), `${name}${descriptors}`)
        eq(inspect.props['aria-label'], id === 'voice_narration' ? 'Show Voice & Narration choices' : `Compare ${name} models`)
        const select = rt.select(id)
        eq(select.props.value, 'default'); eq(select.props['aria-describedby'], 'sp-p2-note')
        const label = rt.find(node => node.type === 'label' && node.props.htmlFor === `sp-p2-model-${id}`)
        eq(label.props.className, 'sr-only'); eq(rt.text(label), `${name} model`)
        const options = walk(select).filter(node => node.type === 'option').map(node => rt.text(node))
        const groups = walk(select).filter(node => node.type === 'optgroup').map(node => node.props.label)
        if (id === 'voice_narration') {
          deepEq(groups, ['Presets', 'Specific models', 'Voices']); deepEq(options, [VOICE_EXPECTED.recommended, ...VOICE_EXPECTED.presets, ...VOICE_EXPECTED.models.map(text => text.replace(/ · [^·]+$/, '')).map((model, i) => `${model} · ${VOICE_MODELS_LABELS[i].split(' · ')[1]}`), ...VOICES])
        } else {
          deepEq(groups, ['Presets', 'Specific models']); deepEq(options, [expected[id].recommended, ...expected[id].presets, ...expected[id].models])
        }
      }
      // the current line of each row: the model in bold, then "provider · origin"
      for (const [id, name, provider] of [['planning_strategy', 'Gemini 3 Flash Preview', 'Google'], ['content_writing', 'Gemini 3 Flash Preview', 'Google'], ['research_analysis', 'Gemini 3 Flash Preview', 'Google'], ['imagery', 'Gemini 2.5 Flash Image', 'Google'], ['voice_narration', 'Alloy', 'Fish Audio']]) {
        const line = rt.current(id)
        eq(rt.text(line), `${name}${provider} · Recommended`)
        eq(line.props.children[0].type, 'strong'); eq(rt.text(line.props.children[0]), name)
      }
      // nothing says Apply; nothing is disabled; no reset until something changes
      ok(!rt.nodes().some(node => /Apply/i.test(rt.text(node))), 'no Apply button')
      deepEq(rt.all(node => node.type === 'button' && node.props.disabled).map(node => rt.text(node)), ['This presentation'], 'the only disabled control is the scope toggle’s This presentation, as before')
      eq(rt.reset(), undefined)
      eq(rt.note(), lib.P2_ONE_LINE); eq(rt.feedback(), '')
      eq(rt.text(rt.pill()), 'Following recommendations'); eq(rt.pill().props['data-state'], 'clean')
      eq(rt.text(rt.find(node => node.type === 'h2' && node.props.id === 'sp-p2-tasks-heading')), 'FIVE TASKS, FIVE CHOICES')
      ok(rt.nodes().some(node => node.type === 'div' && node.props.className === 'sp-ip-scope-group') || rt.nodes().some(node => node.props?.['aria-label'] === 'Model preference scope'), 'the Reusable defaults / This presentation toggle is there')
      {
        const main = rt.find(node => node.props?.className === 'sp-p2-main', 'the left column')
        const kids = [].concat(main.props.children).filter(Boolean).map(node => node.type === 'section' ? 'card' : node.type === 'details' ? node.props.className : node.type)
        deepEq(kids, ['card', 'sp-ip-managed', 'sp-provenance sp-p2-provenance'], 'the card, then Managed by Deckster, then About this catalog, in the left column under the card')
        deepEq([].concat(rt.find(node => node.props?.className === 'sp-model-layout sp-p2-layout').props.children).filter(Boolean).map(node => node.type), ['div', 'aside'], 'the column beside the comparison')
      }
      ok(rt.nodes().some(node => node.type === 'details' && node.props.className === 'sp-ip-managed'), 'Managed by Deckster is there')
      ok(rt.nodes().some(node => node.type === 'details' && String(node.props.className).includes('sp-provenance') && rt.text(node).includes(`Design snapshot · ${cat.version}`)), 'About this catalog is there, with its version')
      ok(rt.nodes().some(node => node.type === 'button' && node.props.className?.includes('sp-ip-readiness-trigger')), 'Your own intelligence is there')
      ok(rt.nodes().some(node => node.type === 'button' && node.props.disabled && rt.text(node).includes('This presentation')), 'This presentation is shown disabled, as before')
      deepEq(storage.log, [`get ${key}`, `get ${legacyKey}`, `set ${key}`], `${label}: one read of the new key, one of the earlier draft, one write of the unchanged set (so a reset sticks)`)
      eq(JSON.parse(storage.map.get(key)).choices.planning_strategy, 'default')
      // the inspector opens on Planning & Strategy
      const inspector = rt.inspector()
      eq(inspector.props['data-p2-inspector'], 'planning_strategy')
      eq(rt.text(rt.find(node => node.type === 'h2' && node.props.id === 'sp-comparison-heading')), 'Planning & Strategy')
      ok(rt.text(inspector).includes('Your current choice') && rt.text(inspector).includes('Gemini 3 Flash Preview'))
      const compare = rt.find(node => node.type === 'select' && !node.props.id)
      eq(compare.props.value, 'google/gemini-3.1-pro-preview')
      deepEq(walk(compare).filter(node => node.type === 'option').map(node => rt.text(node)), expected.planning_strategy.models.map(text => text.replace(' · Google', '')))
      const th = walk(rt.find(node => node.type === 'thead')).filter(node => node.type === 'th').map(node => rt.text(node))
      deepEq(th, ['Detail', 'Current', 'Compare'])
      const rows = walk(rt.find(node => node.type === 'tbody')).filter(node => node.type === 'tr').map(node => walk(node).filter(n => n.type === 'th' || n.type === 'td').map(n => rt.text(n)))
      deepEq(rows.slice(0, 3), [['Context window', '1,048,576', '1,048,576'], ['Image output', 'No', 'No'], ['Tool support', 'Yes', 'Yes']])
      eq(rows.length, catalogFlag ? 7 : 3)
      if (catalogFlag) deepEq(rows.slice(3).map(row => row[0]), ['Release status', 'Price per 1M tokens', 'Structured output', 'Input types'])
      const use = rt.find(node => node.type === 'button' && rt.text(node) === 'Use this model')
      ok(!use.props.disabled, 'a different model is compared: Use this model is live')
      eq(rt.text(rt.find(node => node.props?.className === 'sp-comparison-note')), catalogFlag ? 'Snapshot specifications and public list prices only. Speed, quality, and live availability have not been verified.' : 'Snapshot specifications only. Speed, quality, pricing, and live availability have not been verified.')
    }
    // apply on change
    {
      const storage = makeStorage()
      const rt = mount({ sources: S, catalogFlag, storage })
      for (const bad of ['model:google/not-a-model', 'voice:fish-audio/s2.1-pro::alloy', 'nonsense', '']) { rt.choose('planning_strategy', bad); eq(rt.select('planning_strategy').props.value, 'default', `${label}: ${bad} is not a choice`); eq(rt.feedback(), '') }
      rt.choose('imagery', 'model:google/gemini-3.1-pro-preview'); eq(rt.select('imagery').props.value, 'default', 'a task only takes its own models')
      eq(rt.reset(), undefined)
      rt.choose('planning_strategy', 'best')
      eq(rt.text(rt.current('planning_strategy')), 'Gemini 3.1 Pro PreviewGoogle · Your choice')
      eq(rt.feedback(), 'Planning & Strategy: Gemini 3.1 Pro Preview kept on this device.')
      eq(rt.text(rt.pill()), 'Saved on this device'); eq(rt.pill().props['data-state'], 'kept')
      ok(rt.reset(), 'Reset to recommendations appears once something changed')
      eq(rt.text(rt.reset()), 'Reset to recommendations'); eq(rt.reset().props.disabled, undefined); eq(rt.reset().type, 'button')
      eq(rt.select('planning_strategy').props.value, 'best')
      deepEq(JSON.parse(storage.map.get(key)), { v: 1, catalog: cat.version, choices: { ...lib.p2DefaultChoices(), planning_strategy: 'best' } })
      rt.choose('voice_narration', 'voice:microsoft/mai-voice-2-flash::andrew')
      eq(rt.text(rt.current('voice_narration')), 'AndrewMicrosoft · Your choice')
      eq(rt.feedback(), 'Voice & Narration: Andrew kept on this device.')
      rt.choose('imagery', 'economy')
      eq(rt.text(rt.current('imagery')), 'Gemini 2.5 Flash ImageGoogle · Your choice')
      rt.choose('content_writing', 'model:google/gemini-3.5-flash')
      eq(rt.text(rt.current('content_writing')), 'Gemini 3.5 FlashGoogle · Your choice')
      deepEq(Object.fromEntries(Object.entries(JSON.parse(storage.map.get(key)).choices)), { planning_strategy: 'best', content_writing: 'model:google/gemini-3.5-flash', research_analysis: 'default', imagery: 'economy', voice_narration: 'voice:microsoft/mai-voice-2-flash::andrew' })
      eq(rt.listeners.window.has('beforeunload'), false, 'working storage: no leave warning')
      // choosing the recommendation again is a choice that follows it
      rt.choose('planning_strategy', 'default')
      eq(rt.feedback(), 'Planning & Strategy follows the recommendation, Gemini 3 Flash Preview.')
      eq(rt.text(rt.current('planning_strategy')), 'Gemini 3 Flash PreviewGoogle · Recommended')
      // reset
      rt.act(() => rt.reset().props.onClick())
      eq(rt.reset(), undefined); eq(rt.feedback(), 'Your choices now follow Deckster’s recommendations.')
      for (const [id] of TASKS) eq(rt.select(id).props.value, 'default')
      eq(rt.text(rt.pill()), 'Following recommendations')
      eq(JSON.parse(storage.map.get(key)).choices.content_writing, 'default')
      rt.unmount()
      // a reload after the reset restores nothing, and does not bring the earlier draft back
      storage.map.set(legacyKey, JSON.stringify({ v: 1, catalog: cat.version, draft: { planning_strategy: 'google/gemini-3.1-pro-preview', content_writing: 'default', research_analysis: 'default', imagery: 'default' }, activeTask: 'planning_strategy', view: 'design' }))
      const again = mount({ sources: S, catalogFlag, storage })
      eq(again.select('planning_strategy').props.value, 'default', `${label}: after a reset the earlier draft does not return`)
      eq(again.feedback(), '')
    }
    // inspect and compare
    {
      const rt = mount({ sources: S, catalogFlag, storage: makeStorage() })
      const open = id => rt.act(() => rt.find(node => node.type === 'button' && node.props.className?.includes('sp-p2-inspect') && walk(rt.row(id)).includes(node)).props.onClick())
      open('content_writing')
      eq(rt.inspector().props['data-p2-inspector'], 'content_writing'); eq(rt.text(rt.find(node => node.props?.id === 'sp-comparison-heading')), 'Content Writing')
      eq(rt.row('content_writing').props['data-active'], true); eq(rt.row('planning_strategy').props['data-active'], false)
      const compare = () => rt.find(node => node.type === 'select' && !node.props.id)
      eq(compare().props.value, 'google/gemini-3.5-flash')
      rt.act(() => compare().props.onChange({ target: { value: 'google/gemini-3.5-flash' } }))
      rt.act(() => rt.find(node => node.type === 'button' && rt.text(node) === 'Use this model').props.onClick())
      eq(rt.select('content_writing').props.value, 'model:google/gemini-3.5-flash')
      eq(rt.feedback(), 'Content Writing: Gemini 3.5 Flash kept on this device.')
      ok(compare().props.value !== 'google/gemini-3.5-flash', 'the comparison moved off the model just chosen')
      ok(!rt.find(node => node.type === 'button' && rt.text(node) === 'Use this model').props.disabled, 'a different model is compared: Use this model is live')
      rt.act(() => compare().props.onChange({ target: { value: 'google/gemini-3.5-flash' } }))
      const use = rt.find(node => node.type === 'button' && rt.text(node) === 'Use this model')
      ok(use.props.disabled === true, 'the model already chosen: Use this model is disabled')
      ok(use.props.style && use.props.style.opacity === 1 && /color-mix/.test(use.props.style.background), 'the disabled button keeps the page’s 60% blend on an opaque button')
      // focusing a row's select inspects that row
      rt.act(() => rt.select('imagery').props.onFocus())
      eq(rt.inspector().props['data-p2-inspector'], 'imagery')
      deepEq(walk(compare()).filter(node => node.type === 'option').map(node => rt.text(node)), ['Gemini 2.5 Flash Image', 'Gemini 3.1 Flash Image Preview'])
      eq(compare().props.value, 'google/gemini-3.1-flash-image-preview')
      const rows = walk(rt.find(node => node.type === 'tbody')).filter(node => node.type === 'tr').map(node => walk(node).filter(n => n.type === 'th' || n.type === 'td').map(n => rt.text(n)))
      deepEq(rows[0], ['Context window', '32,768', '65,536']); deepEq(rows[1], ['Image output', 'Yes', 'Yes'])
      // the narration row has voices, not a comparison
      open('voice_narration')
      eq(rt.inspector().props['data-p2-inspector'], 'voice_narration')
      eq(rt.text(rt.find(node => node.props?.id === 'sp-comparison-heading')), 'Voice & Narration')
      ok(rt.maybe(node => node.props?.['data-p2-voices'] === 'true'), 'the narration inspector lists the voices')
      ok(rt.text(rt.inspector()).includes('Narration models are not compared here. Narration still uses the existing delivery controls.'))
      eq(rt.maybe(node => node.type === 'table'), undefined); eq(rt.maybe(node => node.type === 'button' && rt.text(node) === 'Use this model'), undefined)
      for (const model of ['Fish Audio S2.1 Pro', 'Microsoft MAI Voice 2 Flash', 'Kokoro 82M', 'Gemini 3.1 Flash TTS Preview']) ok(rt.text(rt.inspector()).includes(model))
      ok(rt.text(rt.inspector()).includes('Zephyr, Puck, Charon, Kore, Aoede'))
      // choosing a preset for the active narration row moves no comparison
      rt.choose('voice_narration', 'best'); eq(rt.text(rt.current('voice_narration')), 'AlloyFish Audio · Your choice')
    }
    // restore from storage
    {
      const storage = makeStorage()
      storage.map.set(key, JSON.stringify({ v: 1, catalog: cat.version, choices: { planning_strategy: 'economy', content_writing: 'default', research_analysis: 'model:google/gemini-3.1-pro-preview', imagery: 'best', voice_narration: 'voice:google/gemini-3.1-flash-tts-preview::puck' } }))
      const rt = mount({ sources: S, catalogFlag, storage })
      eq(rt.select('planning_strategy').props.value, 'economy'); eq(rt.select('research_analysis').props.value, 'model:google/gemini-3.1-pro-preview'); eq(rt.select('voice_narration').props.value, 'voice:google/gemini-3.1-flash-tts-preview::puck')
      eq(rt.text(rt.current('voice_narration')), 'PuckGoogle · Your choice')
      eq(rt.feedback(), 'Your earlier choices were restored.'); eq(rt.text(rt.pill()), 'Saved on this device'); ok(rt.reset())
      {
        const s3 = makeStorage()
        s3.map.set(key, JSON.stringify({ v: 1, catalog: cat.version, choices: { ...lib.p2DefaultChoices(), planning_strategy: 'best' } }))
        const r3 = mount({ sources: S, catalogFlag, storage: s3 })
        eq(r3.find(node => node.type === 'select' && !node.props.id).props.value, 'google/gemini-3-flash-preview', 'the comparison opens on a model other than the one restored')
        ok(!r3.find(node => node.type === 'button' && r3.text(node) === 'Use this model').props.disabled)
      }
      eq(rt.text(rt.current('planning_strategy')), `${catalogFlag ? 'Gemini 3.1 Flash Lite' : 'Gemini 2.5 Flash Lite'}Google · Your choice`)
      deepEq(storage.log.slice(0, 2), [`get ${key}`, `set ${key}`], 'a stored set is read once and written back as it is')
      ok(!storage.log.includes(`get ${legacyKey}`), 'the earlier draft is only read when no choices are stored')
      // another catalog version, junk, or another format restores nothing
      for (const raw of [JSON.stringify({ v: 1, catalog: 'something-else', choices: { planning_strategy: 'best' } }), '{oops', JSON.stringify({ v: 9, catalog: cat.version, choices: { planning_strategy: 'best' } }), JSON.stringify({ v: 1, catalog: cat.version, choices: { planning_strategy: 'model:google/gone' } })]) {
        const s2 = makeStorage(); s2.map.set(key, raw)
        const r2 = mount({ sources: S, catalogFlag, storage: s2 })
        for (const [id] of TASKS) eq(r2.select(id).props.value, 'default')
        eq(r2.feedback(), '')
      }
    }
    // the earlier Design preview draft, when no choices are stored
    {
      const storage = makeStorage()
      storage.map.set(legacyKey, JSON.stringify({ v: 1, catalog: cat.version, draft: { planning_strategy: 'google/gemini-3.1-pro-preview', content_writing: 'default', research_analysis: 'default', imagery: 'google/gemini-3.1-flash-image-preview' }, activeTask: 'planning_strategy', view: 'design' }))
      const rt = mount({ sources: S, catalogFlag, storage })
      eq(rt.select('planning_strategy').props.value, 'model:google/gemini-3.1-pro-preview'); eq(rt.select('imagery').props.value, 'model:google/gemini-3.1-flash-image-preview')
      eq(rt.select('content_writing').props.value, 'default'); eq(rt.feedback(), 'Your earlier choices were restored.')
      deepEq(storage.log.slice(0, 3), [`get ${key}`, `get ${legacyKey}`, `set ${key}`])
      ok(storage.map.has(legacyKey), 'the earlier draft itself is left alone (the flag-off page still reads it)')
      ok(!storage.log.some(line => line === `remove ${legacyKey}` || line === `set ${legacyKey}`))
    }
    // failing storage
    {
      for (const mode of [{ get: true }, 'access']) {
        const storage = makeStorage(mode === 'access' ? {} : mode)
        const rt = mount({ sources: S, catalogFlag, storage, accessThrows: mode === 'access' })
        eq(rt.note(), lib.P2_ONE_LINE_NO_STORAGE, 'the note says the choices will not be kept')
        eq(rt.text(rt.pill()), 'Following recommendations')
        eq(rt.listeners.window.has('beforeunload'), false, 'no warning while nothing is changed')
        rt.choose('planning_strategy', 'best')
        eq(rt.text(rt.pill()), 'Session only'); eq(rt.pill().props['data-state'], 'session')
        eq(rt.feedback(), 'Planning & Strategy: Gemini 3.1 Pro Preview kept for this session.')
        ok(rt.listeners.window.has('beforeunload'), 'with changes and no storage, leaving is warned about')
        ok(!storage.log.some(line => line.startsWith('set ')), 'nothing is written when reading failed')
        rt.act(() => rt.reset().props.onClick())
        eq(rt.listeners.window.has('beforeunload'), false, 'reset lifts the warning')
      }
      const storage = makeStorage({ set: true })
      const rt = mount({ sources: S, catalogFlag, storage })
      eq(rt.note(), lib.P2_ONE_LINE_NO_STORAGE, 'a write that fails flips the page to session-only')
      rt.choose('imagery', 'best'); eq(rt.text(rt.pill()), 'Session only')
    }
  }
  // the shell (top bar, rail) is not this page's: no portal, no "+ Presentation", no query into the document
  {
    const rt = mount({ sources: S, storage: makeStorage() })
    eq(rt.maybe(node => node.type === 'Portal'), undefined); eq(rt.maybe(node => node.props?.['data-p2-new-presentation']), undefined)
    ok(!rt.nodes().some(node => rt.text(node) === 'Presentation' || node.props?.href === '/builder'), 'no new-presentation entry from this page')
    nomatch(S[CHOOSER], /createPortal|querySelector|document\.|next\/link|react-dom|\bLink\b/, 'the chooser does not reach into the shell')
  }
  // no request of any kind: the sandbox has no fetch, XMLHttpRequest, WebSocket, sendBeacon or navigator (any use would have thrown above); the source has none either
  nomatch(S[CHOOSER], /\bfetch\b|XMLHttpRequest|WebSocket|sendBeacon|navigator\b|sessionStorage|\/api\//, 'the chooser makes no request and touches no account')

  // ------------------------------------------------------------ the page
  {
    const page = S[PAGE]
    match(page, /import \{ IntelligenceWorkspace \} from "@\/components\/studio-personal\/intelligence-workspace"/)
    match(page, /import \{ IntelligenceChooser \} from "@\/components\/studio-personal\/intelligence-p2"/)
    match(page, /<IntelligenceWorkspace chooser=\{process\.env\.NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE === "true" \? <IntelligenceChooser \/> : undefined\} \/>/)
    match(page, /if \(process\.env\.NEXT_PUBLIC_STUDIO_V4_SHELL !== "true"\) notFound\(\)/)
    // the page differs from the base page only by the import, the comment and the one prop
    eq(page.replace(/import \{ IntelligenceChooser \}.*\n/, '').replace(/  \/\/ PASS2 INT-01.*\n/, '').replace(' chooser={process.env.NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE === "true" ? <IntelligenceChooser /> : undefined}', ''), BASE_PAGE)
  }

  // ------------------------------------------------------------ 4. the CSS
  {
    const css = S[CSS]
    const root = postcss.parse(css)
    const selectors = []
    root.walkRules(rule => { if (rule.parent.type === 'atrule' && /keyframes/.test(rule.parent.name)) return; for (const selector of rule.selectors) selectors.push(selector.trim()) })
    ok(selectors.length > 30)
    for (const selector of selectors) ok(/sp-p2-|data-intelligence-p2|data-p2-/.test(selector), `unscoped selector: ${selector}`)
    // the shell (rail, top bar) is not styled from this page
    nomatch(css, /data-studio-v4-rail|data-studio-v4-shell-header|studio-rail|aria-current|:has\(|sp-p2-new/, 'no shell rule')
    match(css, /\.sp-p2-row \{ display: grid;/)
    match(css, /\.sp-workspace\[data-intelligence-p2\] \{ overflow-y: auto;/)
    match(css, /\[data-intelligence-p2\] \.sp-model-layout\.sp-p2-layout \{ flex: 0 0 auto; grid-template-rows: none;/)
    match(css, /\.sp-model-layout\.sp-p2-layout \{ align-items: start; grid-template-columns: minmax\(0, 1\.9fr\)/)
    match(css, /\.sp-p2-how > summary \{ display: flex;/)
    eq((css.match(/!important/g) || []).length, 1, 'one !important, on the note’s margin'); match(css, /\.sp-p2-note \{[^}]*margin: -4px 0 10px !important;[^}]*\}/)
  }
  match(S[ENV], /^NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE="false"$/m)
  eq((S[ENV].match(/^NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE=/gm) || []).length, 1)
  match(S[PKG], /"test:studio-p2-intelligence": "node scripts\/test-studio-p2-intelligence\.mjs"/)
  JSON.parse(S[PKG])
}

// ================================================================ run on the real sources
verify(SOURCES)
const REAL_CHECKS = checks
console.log(`OK: ${REAL_CHECKS} checks on the real sources`)

// ================================================================ 5. mutation check
if (!process.env.P2_INTEL_NO_MUTANTS) {
  // [file, exact text to find (must occur), replacement]
  const MUTANTS = [
    // the helper
    [LIB, "economy: 'google/gemini-2.5-flash-lite' },\n  content_writing", "economy: 'google/gemini-3-flash-preview' },\n  content_writing"],
    [LIB, "best: 'google/gemini-3.5-flash'", "best: 'google/gemini-3.1-pro-preview'"],
    [LIB, "imagery: { best: 'google/gemini-3.1-flash-image-preview'", "imagery: { best: 'google/gemini-2.5-flash-image'"],
    [LIB, "{ id: 'content_writing', label: 'Content Writing'", "{ id: 'content_writing', label: 'Writing'"],
    [LIB, "{ id: 'voice_narration', label: 'Voice & Narration', descriptors: ['Presentation narration', 'Voice selection'] },\n]", "]"],
    [LIB, "export const P2_VOICE_RECOMMENDED = 'fish-audio/s2.1-pro'", "export const P2_VOICE_RECOMMENDED = 'hexgrad/kokoro-82m'"],
    [LIB, "{ id: 'alloy', name: 'Alloy' }", "{ id: 'alloy', name: 'Alloy2' }"],
    [LIB, "{ id: 'aoede', name: 'Aoede' }", "{ id: 'aoede2', name: 'Aoede' }"],
    [LIB, "origin = valid === P2_DEFAULT_CHOICE ? 'Recommended' : 'Your choice'", "origin = valid === P2_DEFAULT_CHOICE ? 'Your choice' : 'Recommended'"],
    [LIB, "return catalog.retiredModels?.[id]?.successor ?? id", "return id"],
    [LIB, "return p2ModelIds(catalog, task).includes(id) ? id : null", "return id"],
    [LIB, "return isModelTask(task) ? p2ModelIds(catalog, task).includes(id) : P2_VOICE_MODELS.some(model => model.id === id)", "return true"],
    [LIB, "return task === 'voice_narration' && p2AllVoices().some(voice => voice.key === value)", "return p2AllVoices().some(voice => voice.key === value)"],
    [LIB, "if (isPreset(value)) return p2PresetModelId(catalog, task, value) !== null", "if (isPreset(value)) return true"],
    [LIB, "const raw = Object.prototype.hasOwnProperty.call(stored, task) ? stored[task] : undefined", "const raw = stored[task]"],
    [LIB, "const resolved = raw.startsWith('model:') && isModelTask(task) ? `model:${p2ResolveRetired(catalog, raw.slice(6))}` : raw", "const resolved = raw"],
    [LIB, "saved.v !== 1 || saved.catalog !== catalog.version", "saved.v !== 1"],
    [LIB, "saved.v !== 1 || saved.catalog !== catalog.version", "saved.catalog !== catalog.version"],
    [LIB, "return p2ChangedCount(choices) ? choices : null\n}\n\n/** A draft", "return choices\n}\n\n/** A draft"],
    [LIB, "export const p2StorageKey = (catalog: P2Catalog) => `deckster-studio-intelligence-p2-v1:${catalog.version}`", "export const p2StorageKey = (catalog: P2Catalog) => `deckster-studio-intelligence-draft-v1:${catalog.version}`"],
    [LIB, "export const p2ChangedCount = (choices: P2Choices) => P2_TASK_IDS.filter(id => choices[id] !== P2_DEFAULT_CHOICE).length", "export const p2ChangedCount = (choices: P2Choices) => P2_TASK_IDS.filter(id => choices[id] === P2_DEFAULT_CHOICE).length"],
    [LIB, "return JSON.stringify({ v: 1, catalog: catalog.version, choices })", "return JSON.stringify({ v: 1, choices })"],
    [LIB, "label: 'Saved on this device'", "label: 'Saved to your account'"],
    [LIB, "storage === 'unavailable' ? { state: 'session', label: 'Session only' }", "storage === 'pending' ? { state: 'session', label: 'Session only' }"],
    [LIB, "const where = storage === 'unavailable' ? 'for this session' : 'on this device'", "const where = 'on this device'"],
    [LIB, "'Your choices are kept on this device. Deckster does not use them to pick models yet.'", "'Your choices are kept on this device.'"],
    [LIB, "export const P2_RESET_LABEL = 'Reset to recommendations'", "export const P2_RESET_LABEL = 'Reset'"],
    [LIB, "label: `${preset.label} — ${task === 'voice_narration' ? voiceModel(modelId).name : catalog.models[modelId].name}`", "label: `${preset.label} — ${catalog.models[modelId]?.name ?? modelId}`"],
    [LIB, "recommended: { value: P2_DEFAULT_CHOICE, label: `Recommended — ${recommended.name} · ${voiceModel(recommended.modelId).name}` }", "recommended: { value: P2_DEFAULT_CHOICE, label: `Recommended — ${recommended.name}` }"],
    [LIB, "return p2ModelIds(catalog, task).find(id => id !== current) ?? current", "return current"],
    // the chooser
    [CHOOSER, "{changed > 0 && <button type=\"button\" className=\"sp-p2-reset\"", "{<button type=\"button\" className=\"sp-p2-reset\""],
    [CHOOSER, "try { window.localStorage.setItem(p2StorageKey(catalog), p2Serialize(catalog, choices)) } catch { setStorage(\"unavailable\") }", "try { window.localStorage.setItem(p2StorageKey(catalog), p2Serialize(catalog, choices)) } catch { }"],
    [CHOOSER, "if (!restored || storage === \"unavailable\") return", "if (storage === \"unavailable\") return"],
    [CHOOSER, "raw !== null ? p2Parse(catalog, raw) : p2FromLegacyDraft(", "raw !== null ? p2Parse(catalog, raw) : null && p2FromLegacyDraft("],
    [CHOOSER, "raw !== null ? p2Parse(catalog, raw) : p2FromLegacyDraft(", "p2Parse(catalog, raw) ?? p2FromLegacyDraft("],
    [CHOOSER, "if (!changed || storage !== \"unavailable\") return", "if (!changed) return"],
    [CHOOSER, "onUse={id => choose(activeTask, `model:${id}`)}", "onUse={id => choose(activeTask, id)}"],
    [CHOOSER, "<h1>Intelligence</h1><p>Choose the model behind each part of your story.</p>", "<h1>Intelligence</h1><p>Give each part of your story a clear direction.</p>"],
    [CHOOSER, "<label className=\"sr-only\" htmlFor={`sp-p2-model-${task.id}`}>", "<label htmlFor={`sp-p2-model-${task.id}`}>"],
    [CHOOSER, " aria-describedby=\"sp-p2-note\" value={choices[task.id]}", " value={choices[task.id]}"],
    [CHOOSER, "{options.presets.length > 0 && <optgroup label=\"Presets\">", "{false && <optgroup label=\"Presets\">"],
    [CHOOSER, "{options.voices.length > 0 && <optgroup label=\"Voices\">", "{false && <optgroup label=\"Voices\">"],
    [CHOOSER, "<span>{p2OriginLine(resolved)}</span></div>", "<span>{resolved.provider}</span></div>"],
    [CHOOSER, "setFeedback(P2_RESET_FEEDBACK)\n  }", "setFeedback(\"\")\n  }"],
    [CHOOSER, "    const next = p2DefaultChoices()\n    setChoices(next)", "    const next = choices\n    setChoices(next)"],
    [CHOOSER, "<button type=\"button\" className=\"sp-button sp-button-accent\" style={same ? DISABLED_ACTION_OPAQUE : undefined} disabled={same}", "<button type=\"button\" className=\"sp-button sp-button-accent\" style={same ? DISABLED_ACTION_OPAQUE : undefined}"],
    [CHOOSER, "<th scope=\"col\">Current</th>", "<th scope=\"col\">Preview</th>"],
    [CHOOSER, "<ManagedByDeckster />", ""],
    [CHOOSER, "<IntelligenceReadiness />", ""],
    [CHOOSER, "{catalogRefreshed && <>", "{false && <>"],
    [CHOOSER, "<span>Your current choice</span>", "<span>Your design preview assignment</span>"],
    [CHOOSER, "<button type=\"button\" className=\"sp-p2-reset\" data-p2-reset=\"true\" onClick={reset}>", "<button type=\"button\" className=\"sp-p2-reset\" data-p2-reset=\"true\" disabled onClick={reset}>"],
    [CHOOSER, "setFeedback(p2ChoiceFeedback(catalog, id, value, storage))", "setFeedback(\"\")"],
    [CHOOSER, "    if (!isP2Choice(catalog, id, value)) return\n", ""],
    [CHOOSER, "if (id === activeTask && id !== \"voice_narration\") setComparison(", "if (false) setComparison("],
    [CHOOSER, "<p className=\"sp-p2-note\" id=\"sp-p2-note\" data-p2-note=\"true\"><Info size={14} aria-hidden=\"true\" />{storage === \"unavailable\" ? P2_ONE_LINE_NO_STORAGE : P2_ONE_LINE}</p>", "<p className=\"sp-p2-note\" id=\"sp-p2-note\" data-p2-note=\"true\"><Info size={14} aria-hidden=\"true\" />{P2_ONE_LINE}</p>"],
    [CHOOSER, "<h2 id=\"sp-p2-tasks-heading\">FIVE TASKS, FIVE CHOICES</h2>", "<h2 id=\"sp-p2-tasks-heading\">YOUR MODELS</h2>"],
    [CHOOSER, "          {changed > 0 &&", "          {<button type=\"button\" disabled>Apply to Deckster</button>}{changed > 0 &&"],
    // the workspace
    [WORKSPACE, "const p2 = p2Intelligence && Boolean(chooser)", "const p2 = Boolean(chooser)"],
    [WORKSPACE, "const p2 = p2Intelligence && Boolean(chooser)", "const p2 = p2Intelligence"],
    [WORKSPACE, "{!p2 && <div className=\"sp-intelligence-view\" hidden={view !== \"design\"}>", "{<div className=\"sp-intelligence-view\" hidden={view !== \"design\"}>"],
    [WORKSPACE, "{p2 ? chooser : <>", "{p2 ? null : <>"],
    [WORKSPACE, "<summary>How it works<small>Where each kind of work happens in Studio today</small></summary>", "<summary>How it works</summary>"],
    [WORKSPACE, "{p2 ? <details className=\"sp-p2-how\"", "{false ? <details className=\"sp-p2-how\""],
    [WORKSPACE, "data-intelligence-p2={p2 ? \"true\" : undefined}", "data-intelligence-p2={undefined}"],
    [WORKSPACE, "process.env.NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE === \"true\"", "process.env.NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE !== \"false\""],
    [WORKSPACE, "<p>Give each part of your story a clear direction.</p>", "<p>Give each part of your story a direction.</p>"],
    [WORKSPACE, "hidden={view !== \"current\"}>\n      <div className=\"sp-workflow-layout\">", "hidden={view === \"current\"}>\n      <div className=\"sp-workflow-layout\">"],
    // the page
    [PAGE, "process.env.NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE === \"true\" ? <IntelligenceChooser /> : undefined", "process.env.NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE !== \"false\" ? <IntelligenceChooser /> : undefined"],
    [PAGE, "process.env.NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE === \"true\" ? <IntelligenceChooser /> : undefined", "<IntelligenceChooser />"],
    [PAGE, "if (process.env.NEXT_PUBLIC_STUDIO_V4_SHELL !== \"true\") notFound()", "if (process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === \"false\") notFound()"],
    // the CSS
    [CSS, ".sp-p2-how > summary { display", ".sp-p2-howx > summary { display"],
    [CSS, ".sp-p2-main { min-width: 0; }", ".sp-p2-main { min-width: 0; }\n[data-studio-v4-rail] nav [aria-current=\"page\"] { position: relative; }"],
    [CSS, ".sp-p2-main { min-width: 0; }", ".sp-p2-main { min-width: 0; }\n.sp-p2-new { height: 34px; }"],
    [CSS, ".sp-p2-main { min-width: 0; }", ".sp-p2-main { min-width: 0; }\n[data-intelligence-p2] [data-studio-v4-shell-header] { display: none; }"],
    [CHOOSER, "  const [storage, setStorage] = useState<P2Storage>(\"pending\")", "  const slot = document.querySelector('header')\n  const [storage, setStorage] = useState<P2Storage>(\"pending\")"],
    [CHOOSER, "    <header className=\"sp-heading\">", "    {createPortal(<a href=\"/builder\" data-p2-new-presentation=\"true\">Presentation</a>, document.body)}\n    <header className=\"sp-heading\">"],
    [CSS, ".sp-p2-row { display: grid;", "p { display: grid;"],
    [CSS, ".sp-workspace[data-intelligence-p2] { overflow-y: auto;", ".sp-workspace[data-intelligence-p2] { overflow-y: hidden;"],
    [CSS, "[data-intelligence-p2] .sp-model-layout.sp-p2-layout { flex: 0 0 auto;", "[data-intelligence-p2] .sp-model-layout.sp-p2-layout { flex: 1;"],
    [CSS, "minmax(0, 1.9fr) minmax(290px, .9fr)", "minmax(0, 1fr) minmax(290px, 1fr)"],
    [CHOOSER, "      <ManagedByDeckster />\n      <details className=\"sp-provenance sp-p2-provenance\">", "      <details className=\"sp-provenance sp-p2-provenance\">"],
    [CSS, "[data-intelligence-p2] .sp-p2-main .sp-ip-managed { margin-top: 12px; }", ".sp-ip-managed { margin-top: 12px; }"],
    [CSS, ".sp-p2-note { display: flex; align-items: center; gap: 7px; margin: -4px 0 10px !important;", ".sp-p2-note { display: flex; align-items: center; gap: 7px; margin: -4px 0 10px !important; color: red !important;"],
    // the flag and the script
    [ENV, 'NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE="false"', 'NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE="true"'],
    [PKG, '"test:studio-p2-intelligence": "node scripts/test-studio-p2-intelligence.mjs"', '"test:studio-p2-intelligence": "node scripts/test-studio-p2-intelligence.mjs --x"'],
  ]
  counting = false
  const survivors = []
  for (const [file, find, replace] of MUTANTS) {
    if (!SOURCES[file].includes(find)) { survivors.push(`UNAPPLIABLE ${file}: ${find.slice(0, 70)}`); continue }
    const mutated = { ...SOURCES, [file]: SOURCES[file].replace(find, () => replace) }
    try { verify(mutated); survivors.push(`SURVIVED ${file}: ${find.slice(0, 80)}  ->  ${replace.slice(0, 50)}`) } catch { /* killed */ }
  }
  counting = true
  if (survivors.length) { console.error(survivors.join('\n')); throw new Error(`${survivors.length} of ${MUTANTS.length} mutants survived`) }
  console.log(`OK: ${MUTANTS.length}/${MUTANTS.length} mutants killed`)
}
console.log(`PASS test-studio-p2-intelligence: ${REAL_CHECKS} checks`)
