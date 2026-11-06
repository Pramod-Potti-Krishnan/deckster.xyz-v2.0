// FRONTEND-1 (UX-02): proof of NEXT_PUBLIC_STUDIO_INTELLIGENCE_SIMPLE (exact "true", build-time, default off; only with NEXT_PUBLIC_STUDIO_MODEL_PICKER_SIMPLE and NEXT_PUBLIC_STUDIO_MODEL_CHOICE): the Intelligence page as ONE preset slider
// (Fast / Balanced / Best / Max) for the account default, the composer's simple picker's own logic; the per-task dropdowns under a collapsed "Advanced", unchanged.
//   lib/studio-intelligence-simple.ts, components/studio-personal/intelligence-simple.tsx (+ .css), the marked lines in app/(app)/studio/intelligence/page.tsx, the .env.example block, the registry lines, the taught proofs.
//
//   node scripts/test-studio-intelligence-simple.mjs     (plain node: transpile + run of the REAL sources, the project's React and Radix for markup, an offline React host for behaviour, postcss over the REAL stylesheet; no network)
//
//   A. The flag: exact "true", and only with both picker flags.
//   B. The logic: the stops, title, per-step list, reset are the composer picker's (simpleView, scope "user"), state by state; a stop saves the PRESET only; the reset saves null.
//   C. No model is named in the sources: the list follows the catalogue.
//   D. The markup: the heading, the title, the per-step list, ONE slider, the four stop names, a collapsed "Advanced" holding the page's chooser; no other text, no price.
//   E. The behaviour (the REAL component, the hook stubbed): a stop saves its preset, the chosen stop nothing, a drag nothing, reset null, saves wait their turn; the hook is asked for the account default.
//   F. The page: flag off (any one of the three off) it is the base page, element and bytes (the marked lines stripped); on, the simple page with the chooser handed in as Advanced.
//   G. The stylesheet: every rule keyed to .sp-isimple, no !important.
//   H. The pins: .env.example, the registry, the taught proofs put back to their base.
//   I. Scope over the committed diff (own commits by subject).
//   J. MUTANTS: each must be caught.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import postcss from 'postcss'
import { FILES, nodeRequire, realDeps, root, runModule } from './studio-model-picker-kit.mjs'
import { Root, hostNodes, textOf } from './studio-chat-harness/mini-react.mjs'
import * as stripModule from './studio-intelligence-simple-strip.mjs'
import * as registry from './studio-later-changes.mjs'

const {
  BASE_COMMIT, INTELLIGENCE_SIMPLE_FILES: MARKED, INTELLIGENCE_SIMPLE_NEW_FILES: NEW_FILES, INTELLIGENCE_SIMPLE_PIN_EDITS: PIN_EDITS, INTELLIGENCE_SIMPLE_PIN_FILES: PIN_FILES, INTELLIGENCE_SIMPLE_PIN_MARK: PIN_MARK,
  INTELLIGENCE_SIMPLE_SCOPE_FILES: SCOPE_FILES, INTELLIGENCE_SIMPLE_ENV_BLOCK: ENV_BLOCK, INTELLIGENCE_SIMPLE_MARKER_RE: MARKER_RE, INTELLIGENCE_SIMPLE_SUBJECT: SUBJECT, INTELLIGENCE_SIMPLE_FLAG: FLAG, stripIntelligenceSimple, putBackPin,
} = stripModule
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
const disk = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const baseText = rel => git('show', `${BASE_COMMIT}:${rel}`)
const plain = value => (value === undefined ? null : JSON.parse(JSON.stringify(value)))
const eq = (actual, expected, message) => assert.deepStrictEqual(plain(actual), plain(expected), message)

let passed = 0
const failed = []
async function check(label, fn) { try { await fn(); passed++; console.log(`PASS ${label}`) } catch (error) { failed.push(label); console.error(`FAIL ${label}: ${error?.stack?.split('\n').slice(0, 4).join(' | ') ?? error}`) } }

const LIB = 'lib/studio-intelligence-simple.ts', COMPONENT = 'components/studio-personal/intelligence-simple.tsx', CSS = 'components/studio-personal/intelligence-simple.css', PAGE = 'app/(app)/studio/intelligence/page.tsx'
const ENV = '.env.example', REGISTRY = 'scripts/studio-later-changes.mjs', ROUTER_MAP = 'scripts/fixtures/studio-model-choice/catalogue-router-map.json'
const SOURCES = Object.fromEntries([LIB, COMPONENT, CSS, PAGE].map(rel => [rel, disk(rel)]))
const real = realDeps()
const icons = new Proxy({}, { get: (_, name) => (name === '__esModule' ? false : props => React.createElement('svg', { 'data-icon': String(name), ...(props?.['aria-hidden'] ? { 'aria-hidden': 'true' } : {}) })) })
const base = (() => {
  const ctx = { read: rel => disk(rel), context: { process: { env: {} } } }
  const p2 = runModule(FILES.p2, {}, ctx), cat = runModule(FILES.catalog, {}, ctx)
  const choice = runModule(FILES.choice, { '@/lib/studio-intelligence-p2': p2, '@/lib/studio-model-catalog': cat }, ctx)
  const picker = runModule(FILES.picker, { '@/lib/studio-intelligence-p2': p2, '@/lib/studio-model-catalog': cat, '@/lib/studio-model-choice': choice }, ctx)
  const sliderLib = runModule(FILES.sliderLib, { '@/lib/studio-model-choice': choice, '@/lib/studio-model-picker': picker }, ctx)
  const simpleLib = runModule(FILES.simpleLib, { '@/lib/studio-intelligence-p2': p2, '@/lib/studio-model-choice': choice, '@/lib/studio-model-picker': picker, '@/lib/studio-model-slider': sliderLib }, ctx)
  return { p2, cat, choice, picker, sliderLib, simpleLib }
})()
const body = JSON.parse(disk(ROUTER_MAP))
const catalogueOf = json => { const result = base.cat.classifyCatalogueResponse(200, json); assert.equal(result.kind, 'ready'); return base.choice.withPresets(result.catalogue, json) }
const ROUTER = catalogueOf(body)
const TASKS = ['planning_strategy', 'content_writing', 'research_analysis']
const TIERS = ['economy', 'balanced', 'best', 'max']
const LABEL = { economy: 'Fast', balanced: 'Balanced', best: 'Best', max: 'Max' }
const AUTO = { kind: 'auto' }
const modelNameOf = slug => body.models[slug].name.replace(/^[^:]+:\s*/, '')

function load(src, { env = {}, slider = real.radixSlider, hook } = {}) {
  const ctx = { read: rel => (rel in src ? src[rel] : disk(rel)), context: { process: { env } } }
  const lib = runModule(LIB, { '@/lib/studio-model-picker-simple': base.simpleLib, '@/lib/studio-model-choice': base.choice, '@/lib/studio-model-picker': base.picker, '@/lib/studio-model-slider': base.sliderLib }, ctx)
  const css = Object.fromEntries(['@/components/model-choice/model-picker.css', '@/components/model-choice/model-slider.css', '@/components/model-choice/model-picker-simple.css', './personal-workspaces.css', './intelligence-simple.css'].map(id => [id, {}]))
  const comp = runModule(COMPONENT, {
    react: real.react, 'react/jsx-runtime': real.jsx, '@radix-ui/react-slider': slider, 'lucide-react': icons, '@/lib/studio-model-picker': base.picker, '@/lib/studio-model-slider': base.sliderLib,
    '@/lib/studio-model-picker-simple': base.simpleLib, '@/lib/studio-intelligence-simple': lib, '@/components/model-choice/use-model-choice': { useModelChoice: hook ?? (() => { throw new Error('stub needed') }) }, ...css,
  }, ctx)
  return { lib, comp }
}

function suite(src, run) {
  const { lib, comp } = load(src)
  run('A: the flag is the exact string "true", and the page is the simple one only with both picker flags too', () => {
    eq(lib.STUDIO_INTELLIGENCE_SIMPLE_FLAG, FLAG); eq(FLAG, 'NEXT_PUBLIC_STUDIO_INTELLIGENCE_SIMPLE')
    for (const [v, want] of [['true', true], ['false', false], ['TRUE', false], ['1', false], [' true', false], ['', false], [undefined, false], [null, false]]) eq(lib.intelligenceSimpleFlagOn(v), want, String(v))
    for (const [a, b, c, want] of [['true', 'true', 'true', true], ['true', 'true', undefined, false], ['true', undefined, 'true', false], [undefined, 'true', 'true', false], ['True', 'true', 'true', false]]) eq(lib.intelligenceSimpleActive(a, b, c), want, `${a} ${b} ${c}`)
    const env = (a, b, c) => Object.fromEntries([['NEXT_PUBLIC_STUDIO_INTELLIGENCE_SIMPLE', a], ['NEXT_PUBLIC_STUDIO_MODEL_PICKER_SIMPLE', b], ['NEXT_PUBLIC_STUDIO_MODEL_CHOICE', c]].filter(([, v]) => v !== undefined))
    eq(load(src, { env: env('true', 'true', 'true') }).lib.STUDIO_INTELLIGENCE_SIMPLE_ENABLED, true); eq(load(src, { env: env('true', 'true') }).lib.STUDIO_INTELLIGENCE_SIMPLE_ENABLED, false); eq(load(src, { env: env(undefined, 'true', 'true') }).lib.STUDIO_INTELLIGENCE_SIMPLE_ENABLED, false)
    for (const name of ['INTELLIGENCE_SIMPLE', 'MODEL_PICKER_SIMPLE', 'MODEL_CHOICE']) assert.match(src[LIB], new RegExp(`process\\.env\\.NEXT_PUBLIC_STUDIO_${name}\\b`), `${name} read as a literal`)
  })
  run('B: the page view IS the composer picker\'s view on the reusable default, state by state (title, thumb, value text, reset), and its list is always open', () => {
    const states = [AUTO, ...TIERS.map(tier => ({ kind: 'tier', tier })), { kind: 'model', model: 'anthropic/claude-opus-5.5' }, { kind: 'mixed' }]
    for (const state of states) {
      const v = lib.intelligenceSimpleView({ catalogue: ROUTER, state }), p = base.simpleLib.simpleView({ catalogue: ROUTER, state, scope: 'user' })
      eq([v.title, v.index, v.thumb, v.valueText, v.resetLabel, v.resetEnabled, v.stops], [p.title, p.index, p.thumb, p.valueText, p.resetLabel, p.resetEnabled, p.stops], state.kind)
      eq(v.rows, p.list?.rows ?? [], `${state.kind}: the rows are the picker's list`)
    }
    eq(lib.intelligenceSimpleView({ catalogue: ROUTER, state: AUTO }).stops.map(stop => stop.label), ['Fast', 'Balanced', 'Best', 'Max'])
    for (const tier of TIERS) {
      const v = lib.intelligenceSimpleView({ catalogue: ROUTER, state: { kind: 'tier', tier } })
      eq(v.title, LABEL[tier]); eq(v.rows.map(row => row.id), TASKS); eq(v.rows.map(row => row.model), TASKS.map(task => modelNameOf(body.groups[task].presets[tier])), `${tier}: each step's model, from the catalogue`); eq(v.detail, null)
    }
    eq([lib.intelligenceSimpleView({ catalogue: ROUTER, state: AUTO }).rows, lib.intelligenceSimpleView({ catalogue: ROUTER, state: AUTO }).detail], [[], 'Deckster chooses'])
    eq([lib.intelligenceSimpleView({ catalogue: ROUTER, state: { kind: 'mixed' } }).title, lib.intelligenceSimpleView({ catalogue: ROUTER, state: { kind: 'mixed' } }).detail], ['Custom', null])
    const none = lib.intelligenceSimpleView({ catalogue: null, state: { kind: 'tier', tier: 'best' } }); eq([none.title, none.rows, none.detail], ['Best', [], null], 'no catalogue: the preset, nothing to list')
  })
  run('B: a stop saves the PRESET only (never a model, never Auto); the chosen stop saves nothing unless a save is in flight; the reset saves null', () => {
    for (const tier of TIERS) {
      const v = lib.intelligenceSimpleView({ catalogue: ROUTER, state: AUTO })
      TIERS.forEach((t, i) => eq(lib.intelligenceStopSave(v, i), { tier: t }))
      const chosen = lib.intelligenceSimpleView({ catalogue: ROUTER, state: { kind: 'tier', tier } }), at = TIERS.indexOf(tier)
      eq(lib.intelligenceStopSave(chosen, at), null, `${tier}: already chosen`); eq(lib.intelligenceStopSave(chosen, at, true), { tier }, `${tier}: in flight it is asked again`)
      for (const [i, t] of TIERS.entries()) if (i !== at) eq(lib.intelligenceStopSave(chosen, i), { tier: t })
    }
    eq(lib.intelligenceStopSave(lib.intelligenceSimpleView({ catalogue: ROUTER, state: AUTO }), 4), null, 'no such stop'); eq(lib.intelligenceStopSave(lib.intelligenceSimpleView({ catalogue: ROUTER, state: AUTO }), -1), null)
    const custom = lib.intelligenceSimpleView({ catalogue: ROUTER, state: { kind: 'model', model: 'anthropic/claude-opus-5.5' } }); eq(lib.intelligenceStopSave(custom, 0), { tier: 'economy' }, 'from a specific model, a stop saves its preset')
    eq(lib.intelligenceResetChoice, null); eq(lib.intelligenceResetChoice, base.simpleLib.simpleResetChoice, 'the picker\'s own reset')
    eq(base.picker.applyChoice(base.choice.modelChoiceDefaults(), { tier: 'best' }), { planning_strategy: 'best', content_writing: 'best', research_analysis: 'best', imagery: 'default', voice_narration: 'default' }, 'saved per text group as the preset')
  })
  run('C: no model or vendor is named in the sources; another catalogue gives other names', () => {
    for (const rel of [LIB, COMPONENT, CSS]) assert.doesNotMatch(src[rel], /claude|gpt|gemini|kimi|deepseek|qwen|opus|sonnet|grok|glm|mistral|llama|moonshot|anthropic|openai|luna|sol\b/i, `${rel} names no model`)
    const other = structuredClone(body); other.groups.content_writing.presets.best = 'moonshotai/kimi-k3'
    eq(lib.intelligenceSimpleView({ catalogue: catalogueOf(other), state: { kind: 'tier', tier: 'best' } }).rows[1].model, modelNameOf('moonshotai/kimi-k3'))
  })

  const advanced = React.createElement('div', { 'data-test': 'chooser' }, 'FIVE TASKS')
  const markup = (state, extra = {}) => renderToStaticMarkup(React.createElement(comp.IntelligenceSimpleLayout, { view: lib.intelligenceSimpleView({ catalogue: ROUTER, state }), blocked: false, advanced, onDraft() {}, onCommit() {}, onReset() {}, ...extra }))
  const outside = html => html.replace(/<details[\s\S]*<\/details>/, '').replace(/&amp;/g, '&').replace(/<[^>]+>/g, '|').split('|').map(t => t.trim()).filter(Boolean)
  run('D: the page shows the heading, the preset\'s name, the per-step list, ONE slider and the four stop names; nothing else outside Advanced (no hint, no note, no price)', () => {
    const html = markup({ kind: 'tier', tier: 'best' })
    eq(outside(html), ['WORK WITH DECKSTER', 'Intelligence', 'Best', 'Planning & Strategy', 'Kimi K3', 'Content Writing', 'Claude Sonnet 5.5', 'Research & Analysis', 'Claude Sonnet 5.5', 'Fast', 'Balanced', 'Best', 'Max'])
    eq((html.match(/role="slider"/g) || []).length, 1, 'one slider'); assert.doesNotMatch(html, /\$|per 1M|price/i, 'no price'); assert.match(html, /data-intelligence-simple="true"/)
    assert.match(html, /<h2[^>]*data-isimple="title"[^>]*>Best<\/h2>/); assert.match(html, /aria-label="Reset to Auto"/)
    eq(outside(markup(AUTO)), ['WORK WITH DECKSTER', 'Intelligence', 'Auto', 'Deckster chooses', 'Fast', 'Balanced', 'Best', 'Max'])
  })
  run('D: "Advanced" is a plain collapsed row holding the chooser handed in, unchanged; open on request', () => {
    const html = markup({ kind: 'tier', tier: 'best' })
    assert.match(html, /<details class="sp-isimple-advanced" data-isimple="advanced"><summary>Advanced<\/summary><div class="sp-isimple-advanced-body"><div data-test="chooser">FIVE TASKS<\/div><\/div><\/details>/, 'collapsed, the chooser inside')
    assert.match(markup({ kind: 'tier', tier: 'best' }, { initialAdvanced: true }), /<details class="sp-isimple-advanced" data-isimple="advanced" open="">/)
    eq((html.match(/<details/g) || []).length, 1)
  })

  // E. behaviour
  const fakeSlider = { Root: ({ children, ...props }) => React.createElement('div', { 'data-fake': 'slider-root', ...props }, children), Track: ({ children }) => React.createElement('div', null, children), Range: () => null, Thumb: props => React.createElement('span', { 'data-fake': 'thumb', ...props }) }
  const host = ({ state = { kind: 'tier', tier: 'balanced' }, ready = true, hold = false } = {}) => {
    const calls = [], asked = [], pending = []
    const api = { ready, scope: 'user', catalogue: ROUTER, catalogueStatus: 'ready', state, userState: state, deckOwn: undefined, choice: undefined, saving: false, mode: 'account', reason: null, storageOk: true, feedback: '', saveNote: '',
      select: choice => { calls.push(choice); return hold ? new Promise(resolve => pending.push(resolve)) : Promise.resolve({ kind: 'saved', choice }) } }
    const { comp: c } = load(src, { slider: fakeSlider, hook: id => { asked.push(id); return api } })
    const r = new Root(); r.setElement(React.createElement(c.IntelligenceSimple, { advanced: React.createElement('div', null, 'chooser') })); r.flush()
    const by = (name, value) => hostNodes(r.tree).find(node => node.props?.[name] === value)
    const flush = async () => { for (let i = 0; i < 4; i++) { await new Promise(resolve => setImmediate(resolve)); r.flush() } }
    return { calls, asked, pending, r, by, flush, slider: () => by('data-isimple', 'slider').props }
  }
  run('E: the hook is asked for the account default (no presentation); a release on a stop saves its preset; the chosen stop and a drag save nothing; the title follows the drag', async () => {
    const h = host(); eq(h.asked[0], null)
    h.slider().onValueCommit([1]); await h.flush(); eq(h.calls, [], 'the chosen stop')
    h.slider().onValueChange([3]); h.r.flush(); eq(h.calls, [], 'a drag alone'); eq(textOf(h.by('data-isimple', 'title')), 'Max'); eq(textOf(h.by('data-isimple', 'rows')).includes('Claude Opus 5.5'), true, 'the list follows the thumb')
    h.slider().onValueCommit([3]); await h.flush(); eq(h.calls, [{ tier: 'max' }]); eq(textOf(h.by('data-isimple', 'title')), 'Balanced', 'back on what is saved')
    h.by('data-isimple-stop', 'economy').props.onClick(); await h.flush(); eq(h.calls, [{ tier: 'max' }, { tier: 'economy' }], 'a click on a stop name')
  })
  run('E: reset saves null (Auto) and is off when nothing is chosen; not ready, the slider and reset are off', async () => {
    const h = host(); eq(h.by('data-isimple', 'reset').props.disabled, false); h.by('data-isimple', 'reset').props.onClick(); await h.flush(); eq(h.calls, [null])
    const a = host({ state: AUTO }); eq(a.by('data-isimple', 'reset').props.disabled, true)
    const w = host({ ready: false }); eq([w.by('data-isimple', 'reset').props.disabled, w.slider().disabled], [true, true])
  })
  run('E: a choice made while a save is in flight waits its turn; only the latest is saved after', async () => {
    const h = host({ hold: true })
    h.slider().onValueCommit([2]); h.slider().onValueCommit([3]); h.slider().onValueCommit([0]); await h.flush(); eq(h.calls, [{ tier: 'best' }], 'one save at a time')
    h.pending.shift()({ kind: 'saved' }); await h.flush(); eq(h.calls, [{ tier: 'best' }, { tier: 'economy' }], 'then the latest')
  })

  // F. the page
  const pageEl = (text, env) => {
    const mod = runModule(PAGE, {
      'react/jsx-runtime': real.jsx,
      '@/components/studio-personal/intelligence-workspace': { IntelligenceWorkspace: function IntelligenceWorkspace() { return null } },
      '@/components/studio-personal/intelligence-p2': { IntelligenceChooser: function IntelligenceChooser() { return null } },
      '@/components/studio-personal/intelligence-simple': { IntelligenceSimple: function IntelligenceSimple() { return null } },
      '@/lib/studio-intelligence-simple': load(src, { env }).lib,
      'next/navigation': { notFound: () => { throw new Error('NEXT_NOT_FOUND') } },
    }, { read: () => text, context: { process: { env } } })
    const el = mod.default(); return { type: el.type.name, chooser: el.props.chooser?.type?.name ?? null, advanced: el.props.advanced?.type?.name ?? null }
  }
  run('F: without the marked lines the page is its base, byte for byte; flag off (or either picker flag off) the page renders as the base; on, the simple page with the chooser as Advanced', () => {
    eq(stripIntelligenceSimple(PAGE, src[PAGE]), baseText(PAGE)); eq(src[PAGE].split('\n').filter(line => MARKER_RE.test(line)).length, 3)
    eq(src[PAGE].split('\n').filter(line => !MARKER_RE.test(line)).join('\n'), baseText(PAGE), 'pure insertions')
    const shell = { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE: 'true' }
    const all = { ...shell, NEXT_PUBLIC_STUDIO_INTELLIGENCE_SIMPLE: 'true', NEXT_PUBLIC_STUDIO_MODEL_PICKER_SIMPLE: 'true', NEXT_PUBLIC_STUDIO_MODEL_CHOICE: 'true' }
    for (const off of [{}, { NEXT_PUBLIC_STUDIO_INTELLIGENCE_SIMPLE: 'false' }, { NEXT_PUBLIC_STUDIO_MODEL_PICKER_SIMPLE: 'false' }, { NEXT_PUBLIC_STUDIO_MODEL_CHOICE: 'false' }, { NEXT_PUBLIC_STUDIO_INTELLIGENCE_SIMPLE: 'TRUE' }]) {
      const env = Object.keys(off).length ? { ...all, ...off } : shell
      eq(pageEl(src[PAGE], env), pageEl(baseText(PAGE), env), JSON.stringify(off)); eq(pageEl(src[PAGE], env).type, 'IntelligenceWorkspace')
    }
    eq(pageEl(src[PAGE], all), { type: 'IntelligenceSimple', chooser: null, advanced: 'IntelligenceChooser' })
  })
  run('G: the stylesheet: every rule is keyed to .sp-isimple; no !important', () => {
    const ast = postcss.parse(src[CSS]); let rules = 0
    ast.walkRules(rule => { rules++; for (const sel of rule.selectors) assert.match(sel, /^\.sp-isimple /, sel) })
    ast.walkDecls(decl => assert.ok(!decl.important, decl.toString())); assert.ok(rules >= 8)
  })
}

const runAll = async (src, quiet) => { const fails = []; try { suite(src, (label, fn) => { tasks.push([label, fn]) }) } catch (error) { tasks.length = 0; if (!quiet) throw error; return ['the sources do not load'] } for (const [label, fn] of tasks.splice(0)) { try { await fn() ; if (!quiet) { passed++; console.log(`PASS ${label}`) } } catch (error) { fails.push(label); if (!quiet) { failed.push(label); console.error(`FAIL ${label}: ${error?.stack?.split('\n').slice(0, 4).join(' | ')}`) } } } return fails }
const tasks = []
await runAll(SOURCES, false)

// H. the pins
await check('H: .env.example: the base plus a blank line and the block, default off; the registry names this change on three lines; each taught proof puts back to its base', () => {
  eq(disk(ENV), baseText(ENV).replace(/\n*$/, '\n') + '\n' + ENV_BLOCK); assert.match(ENV_BLOCK, /^NEXT_PUBLIC_STUDIO_INTELLIGENCE_SIMPLE="false"\n$/m)
  eq(registry.stripLaterEnvBlocks(ENV, disk(ENV)), registry.stripLaterEnvBlocks(ENV, baseText(ENV)))
  const reg = disk(REGISTRY), lines = reg.split('\n').filter(line => line.includes('studio-intelligence-simple-strip.mjs')); eq(lines.length, 3); for (const line of lines) assert.match(line, /\/\/ LATER-CHANGE: FRONTEND-1, UX-02/)
  eq(reg.split('\n').filter(line => !line.includes('studio-intelligence-simple-strip.mjs')).join('\n'), baseText(REGISTRY))
  eq(registry.stripLaterChanges(PAGE, disk(PAGE)) === registry.stripLaterChanges(PAGE, baseText(PAGE)), true, 'through the registry the page is the base\'s')
  for (const rel of PIN_FILES) {
    const now = disk(rel); eq(putBackPin(rel, now), baseText(rel), rel); eq(stripIntelligenceSimple(rel, now), baseText(rel))
    for (const [has] of PIN_EDITS[rel]) { eq(now.split(has).length - 1, 1, `${rel}: taught once`); for (const line of has.split('\n').filter(Boolean)) assert.ok(line.includes(PIN_MARK), line.slice(0, 80)) }
  }
  eq(stripIntelligenceSimple('lib/x.ts', 'a // INTELLIGENCE-SIMPLE'), 'a // INTELLIGENCE-SIMPLE'); eq(stripIntelligenceSimple(PAGE, 'a\nb // INTELLIGENCE-SIMPLE-X\nc // INTELLIGENCE-SIMPLE\n'), 'a\nb // INTELLIGENCE-SIMPLE-X\n')
})
// I. scope
const subjectOf = c => git('log', '-1', '--format=%s', c).trim()
const own = git('rev-list', '--no-merges', `${BASE_COMMIT}..HEAD`).split('\n').filter(Boolean).filter(c => subjectOf(c).startsWith(SUBJECT))
await check('I: this change\'s own commits ("Model picker: Intelligence page ...") touch exactly its files', () => {
  if (own.length === 0) { console.log('  (no own commit yet: scope checked on the working tree)'); eq(git('diff', '--name-only', 'HEAD').split('\n').filter(Boolean).concat(git('ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean)).sort(), [...SCOPE_FILES].sort()); return }
  const touched = new Set(); for (const c of own) for (const rel of git('show', '--name-only', '--format=', c).split('\n').filter(Boolean)) touched.add(rel)
  eq([...touched].sort(), [...SCOPE_FILES].sort()); for (const rel of NEW_FILES) eq(git('cat-file', '-t', `HEAD:${rel}`).trim(), 'blob')
  for (const rel of ['lib/studio-model-picker-simple.ts', 'components/model-choice/model-picker-simple.tsx', 'components/studio-personal/intelligence-p2.tsx', 'components/studio-personal/intelligence-workspace.tsx', 'components/studio-personal/intelligence-model-choice.tsx']) assert.ok(!touched.has(rel), rel)
})

// J. mutants
const mutants = []
const mut = (label, rel, from, to) => { assert.equal(SOURCES[rel].split(from).length, 2, `mutant anchor once: ${label}`); mutants.push([label, { ...SOURCES, [rel]: SOURCES[rel].replace(from, () => to) }]) }
mut('flag: any value', LIB, "value === 'true'", "Boolean(value)")
mut('flag: picker flag ignored', LIB, '&& intelligenceSimpleFlagOn(pickerSimple) ', '')
mut('lib: a stop saves a model', LIB, "return stopChoice(stop, 'user')", "return { model: String(stop.id) }")
mut('lib: the chosen stop saves again', LIB, "if (!busy && view.thumb === 'selected' && index === view.index) return null", '')
mut('lib: deck scope', LIB, "scope: 'user', stops", "scope: 'deck', stops")
mut('lib: reset to a preset', LIB, 'export const intelligenceResetChoice: ModelChoice = null', "export const intelligenceResetChoice: ModelChoice = { tier: 'balanced' }")
mut('lib: list only for the writing step', LIB, "const rows = view.list?.rows ?? []", "const rows = (view.list?.rows ?? []).filter(row => row.id === 'content_writing')")
mut('lib: a hardcoded model', LIB, "export const INTELLIGENCE_SIMPLE_ADVANCED = 'Advanced'", "export const INTELLIGENCE_SIMPLE_ADVANCED = 'Advanced'\nexport const DEFAULT_MODEL = 'anthropic/claude-sonnet-5.5'")
mut('component: a deck scope', COMPONENT, 'useModelChoice(null)', 'useModelChoice("sess-1")')
mut('component: Advanced open by default', COMPONENT, 'open={initialAdvanced || undefined}', 'open')
mut('component: an extra hint line', COMPONENT, '<span className="mpick-sr"', '<p className="sp-isimple-hint">Applies to planning, writing and research steps.</p><span className="mpick-sr"')
mut('component: a second slider', COMPONENT, '        <ol className="mpick-stops"', '        <SliderPrimitive.Root min={0} max={1} value={[0]}><SliderPrimitive.Thumb role="slider" /></SliderPrimitive.Root>\n        <ol className="mpick-stops"')
mut('component: a drag saves', COMPONENT, 'onValueChange={values => onDraft(values[0])}', 'onValueChange={values => { onDraft(values[0]); onCommit(values[0]) }}')
mut('component: no save queue', COMPONENT, '    if (!inFlight.current) save(choice)\n', '    if (true) save(choice)\n')
mut('component: reset always on', COMPONENT, 'disabled={blocked || saving || !view.resetEnabled}', 'disabled={blocked}')
mut('component: no rows', COMPONENT, 'view.rows.length > 0', 'false')
mut('component: chooser dropped', COMPONENT, '<div className="sp-isimple-advanced-body">{advanced}</div>', '<div className="sp-isimple-advanced-body" />')
mut('page: hook not gated', PAGE, 'if (STUDIO_INTELLIGENCE_SIMPLE_ENABLED) return', 'if (true) return')
mut('page: unmarked line', PAGE, ' // INTELLIGENCE-SIMPLE: one preset slider', ' // one preset slider')
mut('css: unscoped rule', CSS, '.sp-isimple .sp-isimple-rows dt,', '.sp-isimple-rows dt,')
mut('css: !important', CSS, 'position: static;', 'position: static !important;')
let caught = 0
const missed = []
for (const [label, src] of mutants) { const fails = await runAll(src, true); if (fails.length) { caught++; console.log(`CAUGHT mutant ${label} (${fails.length} checks failed, e.g. ${fails[0].slice(0, 70)})`) } else { missed.push(label); console.error(`MISSED mutant ${label}`) } }
console.log(`${passed} checks passed, ${failed.length} failed; ${caught} mutants caught, ${missed.length} missed`)
if (failed.length || missed.length) { console.error('test-studio-intelligence-simple: FAILED'); process.exit(1) }
console.log('test-studio-intelligence-simple: all passed')
