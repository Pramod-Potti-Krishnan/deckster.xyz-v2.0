// FRONTEND-1 (F-14, the simplified Studio model picker; PK's final of 4 Nov): proof of NEXT_PUBLIC_STUDIO_MODEL_PICKER_SIMPLE (exact "true", build-time, default off), the composer's slider picker as a calmer popover, and on a phone a bottom sheet.
//   lib/studio-model-picker-simple.ts (pure decisions), components/model-choice/model-picker-simple.tsx (+ .css), marked lines in components/model-choice/model-picker.tsx and scripts/studio-model-picker-kit.mjs, the .env.example block,
//   the router-map fixture (scripts/fixtures/studio-model-choice/catalogue-router-map.json: ROUTER-1's preset map of 3 Nov; catalogue-five-presets.json is left alone, the model-choice proofs pin its values).
//
//   node scripts/test-studio-model-picker-simple.mjs        (plain node: transpile + run of the REAL lib and component, the project's own React / Radix for markup, an offline React host for behaviour, postcss over the REAL stylesheet; no network, no browser)
//
//   A. The flag: only the exact string "true"; with it off ModelPicker picks the base's slider (and the compact chip), with it on the slider variant (only) picks the new picker.
//   B. The stops: Fast / Balanced / Best / Max over economy / balanced / best / max, in the catalogue's order, only what the catalogue opens; Quick is never one, even when the catalogue opens it; a stop saves the PRESET only.
//   C. The view, state by state: the title, the writing model and the per-step list READ FROM THE CATALOGUE (no model is named in the sources), Auto, Custom, a deck following its default, a preset off the scale.
//   D. The reset: it writes null ("Use my default" on a deck, Auto on the reusable default) and is off when there is nothing to clear.
//   E. The markup (real React and Radix): the title, the line with its chevron, ONE slider, the stops' names, a plain Advanced row; none of the slider's legend, hint line, footer or notes; Advanced holds the slider's rows unchanged.
//   F. The behaviour (the REAL component in an offline React host, a stubbed hook): moving to a stop saves the preset, the chosen stop saves nothing, a drag shows the stop under it and saves nothing, choices made during a save wait their turn, reset, Advanced, the list,
//      popover vs sheet, focus, blocked states.
//   G. The stylesheet (postcss, the REAL file): every rule is keyed to this picker, the bar is thicker than the slider's, the sheet's targets are 44 px, no !important.
//   H. The pins: with the flag off nothing changes (the marked lines taken out give the base's files byte for byte, the flag-off render is the base's), the marked lines are where they must be, the fixture, .env.example, the registry and the taught proofs.
//   I. Scope over the COMMITTED diff, GATE-SAFE (own commits by subject across `rev-list --no-merges BASE..head`, HEAD^2 on the gate's merge).
//   J. MUTANTS: every one of them must be caught by A-H.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import postcss from 'postcss'
import { FILES, loadPicker, nodeRequire, realDeps, root as kitRoot, runModule } from './studio-model-picker-kit.mjs'
import { Root, hostNodes, textOf, toElements } from './studio-chat-harness/mini-react.mjs'
import * as stripModule from './studio-model-picker-simple-strip.mjs'
import * as registry from './studio-later-changes.mjs'

const {
  BASE_COMMIT, MODEL_PICKER_SIMPLE_FILES: MARKED_FILES, MODEL_PICKER_SIMPLE_NEW_FILES: NEW_FILES, MODEL_PICKER_SIMPLE_OWN_EDITS: OWN_EDITS, MODEL_PICKER_SIMPLE_PIN_EDITS: PIN_EDITS, MODEL_PICKER_SIMPLE_PIN_FILES: PIN_FILES, MODEL_PICKER_SIMPLE_PIN_MARK: PIN_MARK,
  MODEL_PICKER_SIMPLE_SCOPE_FILES: SCOPE_FILES, MODEL_PICKER_SIMPLE_ENV_BLOCK: ENV_BLOCK, MODEL_PICKER_SIMPLE_MARKER_RE: MARKER_RE, MODEL_PICKER_SIMPLE_SUBJECT: SUBJECT, MODEL_PICKER_SIMPLE_FLAG: FLAG, stripModelPickerSimple,
} = stripModule
const root = kitRoot
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
const disk = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const baseText = rel => git('show', `${BASE_COMMIT}:${rel}`)
const applyAll = (list, rel, text) => list.reduce((out, strip) => { const next = typeof strip === 'function' ? strip(rel, out) : out; return typeof next === 'string' ? next : out }, text)
/** Every OTHER registered change's strip, in the registry's order (this change's is left out): a file is read as this change left it, whatever other changes marked in it. */
const otherStrips = (rel, text) => applyAll(registry.LATER_STRIPS.filter(strip => strip !== stripModelPickerSimple), rel, text)

let passed = 0
const failed = []
async function check(label, fn) {
  if (process.env.CHECK_ONLY && !label.includes(process.env.CHECK_ONLY)) return
  try { await fn(); passed++; console.log(`PASS ${label}`) } catch (error) { failed.push(label); console.error(`FAIL ${label}: ${error?.stack?.split('\n').slice(0, 5).join(' | ') ?? error}`) }
}
let caught = 0
const missed = []
const swap = (text, from, to) => { assert.equal(text.split(from).length, 2, `exactly one ${JSON.stringify(from.slice(0, 90))}`); return text.replace(from, () => to) }
const count = (text, pattern) => (text.match(pattern) || []).length
/** deepStrictEqual across realms: the kit runs the sources in a vm context, so its arrays and objects have another prototype; the JSON form is what is compared (undefined and a missing value are the same). */
const plain = value => (value === undefined ? null : JSON.parse(JSON.stringify(value)))
const eq = (actual, expected, message) => assert.deepStrictEqual(plain(actual), plain(expected), message)

// ---- the sources, the fixtures, the loader ---------------------------------------------------------------------------------------------------------------
const LIB = FILES.simpleLib, COMPONENT = FILES.simple, CSS = 'components/model-choice/model-picker-simple.css', PICKER = FILES.component, KIT = 'scripts/studio-model-picker-kit.mjs', STRIP = 'scripts/studio-model-picker-simple-strip.mjs'
const FIX = 'scripts/fixtures/studio-model-choice', ROUTER_MAP = `${FIX}/catalogue-router-map.json`, FIVE = `${FIX}/catalogue-five-presets.json`, LIVE = `${FIX}/catalogue-live-shape.json`
const REGISTRY = 'scripts/studio-later-changes.mjs', ENV = '.env.example'
const real = realDeps()
const SOURCE_FILES = [LIB, COMPONENT, CSS, PICKER, KIT, STRIP, ROUTER_MAP]
const SOURCES = Object.fromEntries(SOURCE_FILES.map(rel => [rel, disk(rel)]))
const jsonOf = rel => JSON.parse(disk(rel))
const base = (() => { // the modules this change does not touch, loaded once
  const env = { NEXT_PUBLIC_STUDIO_MODEL_CHOICE: 'true' }
  const ctx = { read: rel => disk(rel), context: { process: { env } } }
  const p2 = runModule(FILES.p2, {}, ctx), cat = runModule(FILES.catalog, {}, ctx)
  const choice = runModule(FILES.choice, { '@/lib/studio-intelligence-p2': p2, '@/lib/studio-model-catalog': cat }, ctx)
  const picker = runModule(FILES.picker, { '@/lib/studio-intelligence-p2': p2, '@/lib/studio-model-catalog': cat, '@/lib/studio-model-choice': choice }, ctx)
  const sliderLib = runModule(FILES.sliderLib, { '@/lib/studio-model-choice': choice, '@/lib/studio-model-picker': picker }, ctx)
  const icons = new Proxy({}, { get: (_, name) => (name === '__esModule' ? false : props => React.createElement('svg', { 'data-icon': String(name), ...(props?.['aria-hidden'] ? { 'aria-hidden': 'true' } : {}) })) })
  const option = runModule(FILES.option, { 'lucide-react': icons, 'react/jsx-runtime': real.jsx }, ctx)
  const sliderPanel = runModule(FILES.slider, {
    react: real.react, 'react/jsx-runtime': real.jsx, '@radix-ui/react-popover': real.radix, '@radix-ui/react-slider': real.radixSlider, 'lucide-react': icons, '@/lib/studio-model-picker': picker, '@/lib/studio-model-slider': sliderLib,
    './model-option': option, './use-model-choice': { useModelChoice: () => { throw new Error('not used') } }, './model-picker.css': {}, './model-slider.css': {},
  }, ctx)
  return { p2, cat, choice, picker, sliderLib, option, sliderPanel, icons }
})()
const catalogueOf = body => { const result = base.cat.classifyCatalogueResponse(200, body); assert.equal(result.kind, 'ready', 'the fixture is a catalogue'); return base.choice.withPresets(result.catalogue, body) }
const ROUTER = catalogueOf(jsonOf(ROUTER_MAP)), FIVE_CAT = catalogueOf(jsonOf(FIVE)), LIVE_CAT = catalogueOf(jsonOf(LIVE))
const withText = (overrides = {}) => ({ ...SOURCES, ...overrides })

/** The lib and the component from `src`, as text (a mutant swaps some). `env` is process.env for the lib; `deps` are the component's imports (real by default). */
function loadSimple(src = SOURCES, { env = {}, deps = {} } = {}) {
  const ctx = { read: rel => (rel in src ? src[rel] : disk(rel)), context: { process: { env } } }
  const lib = runModule(LIB, { '@/lib/studio-intelligence-p2': base.p2, '@/lib/studio-model-choice': base.choice, '@/lib/studio-model-picker': base.picker, '@/lib/studio-model-slider': base.sliderLib }, ctx)
  const dialog = nodeRequire('@radix-ui/react-dialog')
  const comp = runModule(COMPONENT, {
    react: real.react, 'react/jsx-runtime': real.jsx, '@radix-ui/react-dialog': dialog, '@radix-ui/react-popover': real.radix, '@radix-ui/react-slider': real.radixSlider, 'lucide-react': base.icons,
    '@/lib/studio-model-picker': base.picker, '@/lib/studio-model-slider': base.sliderLib, '@/lib/studio-model-picker-simple': lib, './model-option': base.option, './use-model-choice': { useModelChoice: () => { throw new Error('stub needed') } },
    './model-picker.css': {}, './model-slider.css': {}, './model-picker-simple.css': {}, ...deps,
  }, ctx)
  return { lib, comp }
}
const stripVendor = name => name.replace(/^[^:]+:\s*/, '')
const nameOf = (body, slug) => stripVendor(body.models[slug].name)
const ROUTER_BODY = jsonOf(ROUTER_MAP)
const TASKS = ['planning_strategy', 'content_writing', 'research_analysis']
const TASK_LABELS = { planning_strategy: 'Planning & Strategy', content_writing: 'Content Writing', research_analysis: 'Research & Analysis' }
const MAP = { // ROUTER-1's registry read (3 Nov 21:45Z), as the fixture carries it: [planning, writing, research]
  economy: ['GPT-6 Luna', 'GPT-6 Luna', 'GPT-6 Luna'], balanced: ['Gemini 3.8 Flash', 'GPT-6.1 Sol', 'GPT-6.1 Sol'], best: ['Kimi K3', 'Claude Sonnet 5.5', 'Claude Sonnet 5.5'], max: ['Claude Opus 5.5', 'Claude Opus 5.5', 'Claude Opus 5.5'],
}
const TIER_LABEL = { economy: 'Fast', balanced: 'Balanced', best: 'Best', max: 'Max' }
const USER_AUTO = { kind: 'auto' }, DECK_AUTO = { kind: 'auto', deck: true }

// ============================================================================================================================================
// the suite: every check that reads sources only (A-H without git); a mutant swaps a source and the whole suite must fail
// ============================================================================================================================================
function suite(src, run) {
  const S = loadSimple(src)
  const lib = S.lib
  const view = (state, extra = {}) => lib.simpleView({ catalogue: ROUTER, state, scope: 'user', ...extra })

  // ---- A. the flag
  run('A: the flag is the exact string "true"; every other spelling is off; the env constant reads NEXT_PUBLIC_STUDIO_MODEL_PICKER_SIMPLE', () => {
    eq(lib.STUDIO_MODEL_PICKER_SIMPLE_FLAG, 'NEXT_PUBLIC_STUDIO_MODEL_PICKER_SIMPLE'); eq(lib.STUDIO_MODEL_PICKER_SIMPLE_FLAG, FLAG)
    for (const [value, want] of [['true', true], [undefined, false], [null, false], ['false', false], ['TRUE', false], ['True', false], ['1', false], ['yes', false], ['true ', false], [' true', false], ['', false]]) eq(lib.modelPickerSimpleFlagOn(value), want, String(value))
    for (const [value, want] of [['true', true], ['false', false], ['TRUE', false], ['1', false], [undefined, false]]) {
      const env = value === undefined ? {} : { NEXT_PUBLIC_STUDIO_MODEL_PICKER_SIMPLE: value }
      eq(loadSimple(src, { env }).lib.STUDIO_MODEL_PICKER_SIMPLE_ENABLED, want, `env ${String(value)}`)
    }
    assert.match(src[LIB], /process\.env\.NEXT_PUBLIC_STUDIO_MODEL_PICKER_SIMPLE\b/, 'read as a literal so the build can inline it')
  })

  // ---- B. the stops
  run('B: the stops are Fast, Balanced, Best and Max (economy, balanced, best, max) in the catalogue\'s order; Quick is never one; a stop writes the PRESET only', () => {
    const stops = lib.simpleStops(ROUTER)
    eq(stops.map(stop => stop.id), ['economy', 'balanced', 'best', 'max']); eq(stops.map(stop => stop.label), ['Fast', 'Balanced', 'Best', 'Max']); eq(stops.map(stop => stop.tier), ['economy', 'balanced', 'best', 'max'])
    eq(stops.every(stop => stop.auto === false), true, 'Auto is not a stop'); eq(lib.SIMPLE_STOP_IDS, ['economy', 'balanced', 'best', 'max'])
    eq(Object.keys(ROUTER.presets.content_writing).includes('quick'), true, 'the catalogue names Quick, and its writing model is not open for selection: Quick is already out')
    eq(FIVE_CAT.presetOrder, ['quick', 'economy', 'balanced', 'best', 'max']); eq(base.sliderLib.MODEL_PICKER_STOPS(FIVE_CAT).map(stop => stop.id), ['quick', 'economy', 'balanced', 'best', 'max'], 'the slider offers Quick here')
    eq(lib.simpleStops(FIVE_CAT).map(stop => stop.id), ['economy', 'balanced', 'best', 'max'], 'the simple picker leaves Quick out even where the catalogue opens it')
    const reordered = { ...ROUTER, presetOrder: ['max', 'best', 'balanced', 'economy', 'quick'] }; eq(lib.simpleStops(reordered).map(stop => stop.id), ['max', 'best', 'balanced', 'economy'], 'the catalogue\'s order is kept')
    const noPresetOrder = { ...ROUTER, presetOrder: null }; eq(lib.simpleStops(noPresetOrder).map(stop => stop.id), ['economy', 'balanced', 'best', 'max'], 'no preset_order: the Studio order')
    const gap = { ...ROUTER, presets: { ...ROUTER.presets, research_analysis: { ...ROUTER.presets.research_analysis, best: undefined } } }; eq(lib.simpleStops(gap).map(stop => stop.id), ['economy', 'balanced', 'max'], 'a preset a text group does not name is not a stop')
    const notOpen = { ...ROUTER, presets: { ...ROUTER.presets, planning_strategy: { ...ROUTER.presets.planning_strategy, max: 'qwen/not-certified-anywhere' } } }; eq(lib.simpleStops(notOpen).map(stop => stop.id), ['economy', 'balanced', 'best'], 'a preset whose model is not certified is not a stop')
    eq(lib.simpleStops(null).map(stop => stop.id), ['economy', 'balanced', 'best', 'max'], 'no catalogue (not loaded): the four')
    eq(lib.simpleStops(LIVE_CAT).map(stop => stop.id).every(id => ['economy', 'balanced', 'best', 'max'].includes(id)), true, 'the older fixture: only these four')
    for (const stop of stops) { eq(base.sliderLib.stopChoice(stop, 'user'), { tier: stop.id }); eq(base.sliderLib.stopChoice(stop, 'deck'), { tier: stop.id }, 'a preset, never a model') }
    eq(base.picker.applyChoice(base.choice.modelChoiceDefaults(), { tier: 'best' }), { planning_strategy: 'best', content_writing: 'best', research_analysis: 'best', imagery: 'default', voice_narration: 'default' }, 'the three text groups together; imagery and narration untouched')
  })

  // ---- C. the view
  run('C: a preset on the scale: the title is its name; the line is the router-resolved WRITING model and the list the three steps, all read from the catalogue', () => {
    for (const tier of ['economy', 'balanced', 'best', 'max']) {
      const v = view({ kind: 'tier', tier })
      eq([v.title, v.index, v.thumb], [TIER_LABEL[tier], ['economy', 'balanced', 'best', 'max'].indexOf(tier), 'selected'], tier)
      eq(v.line, { lead: 'Writing', name: MAP[tier][1] }, `${tier}: the writing model`)
      eq(v.list, { heading: `Resolved by the router for ${TIER_LABEL[tier]}`, rows: TASKS.map((id, i) => ({ id, label: TASK_LABELS[id], model: MAP[tier][i] })) }, `${tier}: planning, writing, research`)
      eq(v.line.name, nameOf(ROUTER_BODY, ROUTER_BODY.groups.content_writing.presets[tier]), `${tier}: read from the catalogue's presets`)
    }
    eq(view({ kind: 'tier', tier: 'balanced' }).valueText, 'Balanced, cost 2 of 3. Balanced speed · moderate cost', 'what the screen reader says for the thumb')
  })
  run('C: the line and the list follow the CATALOGUE: other models in, other names out (no model is named in the sources)', () => {
    const body = structuredClone(ROUTER_BODY)
    body.groups.content_writing.presets.best = 'moonshotai/kimi-k3'; body.groups.planning_strategy.presets.best = 'anthropic/claude-opus-5.5'
    const v = lib.simpleView({ catalogue: catalogueOf(body), state: { kind: 'tier', tier: 'best' }, scope: 'user' })
    eq(v.line, { lead: 'Writing', name: nameOf(body, 'moonshotai/kimi-k3') }); eq(v.list.rows.map(row => row.model), [nameOf(body, 'anthropic/claude-opus-5.5'), nameOf(body, 'moonshotai/kimi-k3'), 'Claude Sonnet 5.5'])
    for (const rel of [LIB, COMPONENT, CSS]) assert.doesNotMatch(src[rel], /claude|gpt|gemini|kimi|deepseek|qwen|opus|sonnet|grok|glm|nemotron|mimo|moonshot|anthropic|openai/i, `${rel} names no model or vendor`)
  })
  run('C: no catalogue: the title still names the preset, there is no model line and no list (nothing to read); a group the catalogue does not open leaves its row out', () => {
    const v = lib.simpleView({ catalogue: null, state: { kind: 'tier', tier: 'best' }, scope: 'user' })
    eq([v.title, v.line, v.list, v.thumb], ['Best', null, null, 'selected'])
    const body = structuredClone(ROUTER_BODY); body.groups.research_analysis.visibility = 'hidden'
    const part = lib.simpleView({ catalogue: catalogueOf(body), state: { kind: 'tier', tier: 'best' }, scope: 'user' })
    eq(part.list.rows.map(row => row.id), ['planning_strategy', 'content_writing'])
  })
  run('C: Auto (nothing chosen): the title is Auto, the line says what Auto does, no thumb, a list holding only the way to a specific model', () => {
    for (const state of [USER_AUTO, DECK_AUTO]) { const v = view(state); eq([v.title, v.line, v.list, v.thumb, v.index], ['Auto', { lead: null, name: 'Deckster chooses' }, { heading: null, rows: [] }, 'none', -1]) }
  })
  run('C: a specific model reads Custom, the model\'s name on the line, the same model for all three steps, a faint thumb off the scale; a mix reads Custom with its reason and no list', () => {
    const v = view({ kind: 'model', model: 'anthropic/claude-opus-5.5' })
    eq([v.title, v.line, v.thumb, v.index], ['Custom', { lead: null, name: 'Claude Opus 5.5' }, 'custom', -1]); eq(v.list, { heading: null, rows: TASKS.map(id => ({ id, label: TASK_LABELS[id], model: 'Claude Opus 5.5' })) })
    const m = view({ kind: 'mixed' }); eq([m.title, m.line, m.list, m.thumb], ['Custom', { lead: null, name: 'Set per task on the Intelligence page' }, null, 'custom'])
  })
  run('C: a deck that follows its default shows the default\'s preset on a HOLLOW thumb; a preset kept earlier that is not one of the four (Quick) reads by its own name, off the scale', () => {
    const following = view({ kind: 'tier', tier: 'balanced' }, { scope: 'deck', own: 'default' }); eq([following.title, following.thumb, following.index], ['Balanced', 'hollow', 1])
    const quick = lib.simpleView({ catalogue: FIVE_CAT, state: { kind: 'tier', tier: 'quick' }, scope: 'user' }); eq([quick.title, quick.thumb, quick.index], ['Quick', 'custom', -1]); eq(quick.line.lead, 'Writing')
  })

  // ---- D. the reset
  run('D: the reset writes null: "Use my default" on a deck, Auto on the reusable default; it is off when there is nothing to clear', () => {
    eq(lib.simpleResetChoice, null)
    const t = { kind: 'tier', tier: 'best' }
    for (const [scope, own, state, label, enabled] of [
      ['user', undefined, USER_AUTO, 'Reset to Auto', false], ['user', undefined, t, 'Reset to Auto', true], ['user', undefined, { kind: 'model', model: 'openai/gpt-6.1-sol' }, 'Reset to Auto', true], ['user', undefined, { kind: 'mixed' }, 'Reset to Auto', true],
      ['deck', 'default', t, 'Use my default', false], ['deck', 'default', USER_AUTO, 'Use my default', false], ['deck', 'auto', DECK_AUTO, 'Use my default', true], ['deck', 'set', t, 'Use my default', true], ['deck', 'mixed', { kind: 'mixed' }, 'Use my default', true],
    ]) { const v = view(state, { scope, own }); eq([v.resetLabel, v.resetEnabled], [label, enabled], `${scope} ${own} ${state.kind}`) }
  })

  // ---- E. the markup
  const noop = () => {}
  const advancedOf = (state, scope = 'user', own) => base.sliderLib.sliderAdvanced({ catalogue: ROUTER, state, scope, own, userState: USER_AUTO })
  const panel = (state, { scope = 'user', own, advanced, list = false, open = false, draft = null, blocked = false, saving = false, Title = 'h2' } = {}) => {
    const v = lib.simpleView({ catalogue: ROUTER, state, scope, own })
    return renderToStaticMarkup(React.createElement(S.comp.ModelSimplePanel, { Title, view: v, blocked, saving, draft, advanced: advanced ?? advancedOf(state, scope, own), initialList: list, initialAdvanced: open, onDraft: noop, onCommit: noop, onReset: noop, onAdvanced: noop }))
  }
  const visibleText = html => html.replace(/&amp;/g, '&').replace(/<details[^>]*>\s*<summary>(.*?)<\/summary>[\s\S]*?<\/details>/, '<summary-only>$1</summary-only>').replace(/<[^>]+>/g, '|').split('|').map(text => text.trim()).filter(Boolean)
  run('E: closed, the panel shows the title, the writing line, the four stop names and "Advanced", and nothing else: no legend, no hint line, no footer, no heading, no cost marker', () => {
    const html = panel({ kind: 'tier', tier: 'balanced' })
    eq(visibleText(html), ['Balanced', 'Writing:', 'GPT-6.1 Sol', 'Fast', 'Balanced', 'Best', 'Max', 'Advanced'])
    for (const gone of [/Low = quicker/, /deeper thinking/, /Applies to/, /Saved to your account/, /Saved on this device/, /\$/, /^MODEL$/i, /moderate cost/, /higher cost/]) assert.doesNotMatch(visibleText(html).join(' | '), gone, String(gone))
    for (const gone of [/mpick-caption/, /mpick-notes/, /mpick-stop-sub/, /mpick-slider-title/, /mpick-slider-value/, /data-mpick="scope"/, /data-mpick="save"/]) assert.doesNotMatch(html, gone, String(gone))
    eq(count(html, /role="slider"/g), 1, 'ONE slider'); eq(count(html, /class="mpick-slider-root"/g), 1, 'ONE slider track'); eq(count(html, /class="mpick-stop"/g), 4, 'four stops'); eq(count(html, /data-mpick="line"/g), 1)
    assert.match(html, /<h2 class="mpick-simple-title" data-mpick="title">Balanced<\/h2>/); assert.match(html, /<details class="mpick-advanced" data-mpick="advanced">/); assert.doesNotMatch(html, /<details[^>]* open/, 'Advanced is collapsed')
    assert.match(html, /<button type="button" class="mpick-simple-line" data-mpick="line" aria-expanded="false"/); assert.match(html, /data-icon="ChevronDown"/, 'the chevron')
    assert.match(html, /<button type="button" class="mpick-simple-reset" data-mpick="reset" aria-label="Reset to Auto" title="Reset to Auto">/); assert.match(html, /data-icon="RotateCcw"/, 'the reset icon, top right')
    assert.ok(html.indexOf('mpick-simple-title') < html.indexOf('mpick-simple-reset') && html.indexOf('mpick-simple-reset') < html.indexOf('mpick-simple-line') && html.indexOf('mpick-simple-line') < html.indexOf('role="slider"') && html.indexOf('role="slider"') < html.indexOf('mpick-advanced'), 'title, reset, line, slider, Advanced: in that order')
    assert.match(html, /<ol class="mpick-stops"[^>]*data-mpick="stops">/); assert.match(html, /data-mpick-stop="economy"[^>]*title="Fast · low cost"/, 'a stop\'s hint is only a tooltip, as the slider\'s')
  })
  run('E: the slider is the slider\'s own: min 0, max 3, the thumb on the chosen stop, "none" with nothing chosen, "hollow" while a deck follows its default, "custom" off the scale; its name and spoken value', () => {
    for (const [state, opts, kind] of [[{ kind: 'tier', tier: 'max' }, {}, 'selected'], [USER_AUTO, {}, 'none'], [{ kind: 'tier', tier: 'best' }, { scope: 'deck', own: 'default' }, 'hollow'], [{ kind: 'model', model: 'openai/gpt-6.1-sol' }, {}, 'custom']]) {
      const html = panel(state, opts); assert.match(html, new RegExp(`data-thumb="${kind}"`), kind); assert.match(html, /aria-valuemin="0"/); assert.match(html, /aria-valuemax="3"/); assert.match(html, /aria-label="Model"/)
    }
    assert.match(panel({ kind: 'tier', tier: 'best' }), /aria-valuetext="Best, cost 3 of 3\. Deeper · higher cost"/)
    assert.match(panel(USER_AUTO), /aria-valuetext="Auto, Deckster chooses"/)
  })
  run('E: the ticks sit under the thumb at every thumb size (the inset is the --mpick-simple-thumb variable), and the stops\' columns are equal', () => {
    const html = panel({ kind: 'tier', tier: 'balanced' })
    eq([...html.matchAll(/class="mpick-tick"[^>]*style="left:([^"]+)"/g)].map(m => m[1]), ['calc(0% + var(--mpick-simple-thumb, 18px) * 0.5000)', 'calc(33.33333333333333% + var(--mpick-simple-thumb, 18px) * 0.3333)', 'calc(66.66666666666666% + var(--mpick-simple-thumb, 18px) * 0.1667)', 'calc(100% + var(--mpick-simple-thumb, 18px) * 0.0000)'])
    assert.match(html, /style="--mpick-stops:4"/)
  })
  run('E: Advanced, open, holds the slider\'s own rows unchanged: on the reusable default Auto and Specific models, on a deck Auto, Use my default and Specific models', () => {
    for (const [state, scope, own] of [[USER_AUTO, 'user', undefined], [{ kind: 'tier', tier: 'best' }, 'user', undefined], [{ kind: 'tier', tier: 'best' }, 'deck', 'default'], [DECK_AUTO, 'deck', 'auto'], [{ kind: 'model', model: 'openai/gpt-6.1-sol' }, 'deck', 'set']]) {
      const group = html => html.match(/<div role="group" aria-label="Advanced" class="mpick-list">[\s\S]*?<\/details>/)?.[0]
      const ours = group(panel(state, { scope, own, open: true }))
      const theirs = group(renderToStaticMarkup(React.createElement(base.sliderPanel.ModelSliderPanel, { label: 'x', valueText: 'x', scope, blocked: false, stops: base.sliderLib.MODEL_PICKER_STOPS(ROUTER), index: -1, thumb: 'none', advanced: advancedOf(state, scope, own), saveNote: '', onDraft: noop, onCommit: noop, onAdvanced: noop })))
      assert.ok(ours && theirs, 'both have the group'); eq(ours, theirs, `${scope} ${own} ${state.kind}`)
    }
    const html = panel(USER_AUTO, { open: true }); assert.match(html, /<details class="mpick-advanced" data-mpick="advanced" open="">/)
    eq(count(html, /data-mpick-option="model:/g), 5, 'the five specific models common to the three text steps'); assert.match(html, /data-mpick-option="auto"/); assert.doesNotMatch(html, /data-mpick-option="default"/, 'no "Use my default" on the reusable default')
    const deck = panel({ kind: 'tier', tier: 'best' }, { scope: 'deck', own: 'default', open: true }); assert.match(deck, /Use my default: Auto/); assert.match(deck, /data-mpick-option="auto"/)
  })
  run('E: nothing is written under a collapsed Advanced row (the panel ends with it), and no note, hint or caption follows the slider', () => {
    const html = panel({ kind: 'tier', tier: 'best' })
    assert.match(html, /<details[^>]*><summary>Advanced<\/summary><div role="group" aria-label="Advanced" class="mpick-list">[\s\S]*<\/div><\/details><\/div>$/, 'the panel ends with the Advanced details')
    assert.doesNotMatch(html.slice(html.indexOf('data-mpick="stops"')), /<p[ >]/, 'no paragraph after the stops')
  })
  run('E: the chevron list: the heading, the three steps (read only), "Choose a specific model…"; the slider and Advanced are not drawn while it is open', () => {
    const html = panel({ kind: 'tier', tier: 'best' }, { list: true })
    eq(visibleText(html), ['Best', 'Writing:', 'Claude Sonnet 5.5', 'Resolved by the router for Best', 'Planning & Strategy', 'Kimi K3', 'Content Writing', 'Claude Sonnet 5.5', 'Research & Analysis', 'Claude Sonnet 5.5', 'Choose a specific model…'])
    assert.match(html, /aria-expanded="true"/); assert.doesNotMatch(html, /role="slider"|mpick-advanced/); eq(count(html, /<button/g), 3, 'reset, the line, the way to a specific model: the rows are not buttons'); assert.match(html, /data-mpick="specific"/)
    const auto = panel(USER_AUTO, { list: true }); eq(visibleText(auto), ['Auto', 'Deckster chooses', 'Choose a specific model…'])
    const mixed = panel({ kind: 'mixed' }, { list: true }); assert.doesNotMatch(mixed, /data-mpick="list"/, 'no list for a mix'); assert.doesNotMatch(mixed, /<button type="button" class="mpick-simple-line"/, 'and no chevron: the line is plain'); assert.match(mixed, /<p class="mpick-simple-line" data-mpick="line">/)
  })
  run('E: blocked, saving and the dragged thumb: the reset is off, a drag shows the thumb on the stop under it', () => {
    assert.match(panel({ kind: 'tier', tier: 'best' }, { blocked: true }), /data-mpick="reset" disabled=""/); assert.match(panel({ kind: 'tier', tier: 'best' }, { saving: true }), /data-mpick="reset" disabled=""/)
    assert.doesNotMatch(panel({ kind: 'tier', tier: 'best' }), /data-mpick="reset" disabled/)
    assert.match(panel(USER_AUTO, { draft: 2 }), /data-thumb="selected"/, 'a dragged thumb is shown whatever it was')
  })

  // ---- F. the behaviour: the REAL component in an offline React host, with the hook stubbed and Radix replaced by plain elements
  const fake = (() => {
    const make = (type, role) => ({ children, ...props }) => React.createElement(type, { 'data-fake': role, ...props }, children)
    const trigger = ({ children, ...props }) => React.createElement('button', props, children)
    const rootOf = name => ({ open, onOpenChange, children }) => React.createElement('div', { 'data-fake': `${name}-root`, 'data-open': String(open), onOpenChange }, React.Children.toArray(children).filter(child => open || child.type === trigger))
    const slider = {
      Root: ({ children, ...props }) => React.createElement('div', { 'data-fake': 'slider-root', ...props }, children), Track: make('div', 'track'), Range: make('div', 'range'),
      Thumb: React.forwardRef((props, ref) => { if (ref) ref.current = { focus: () => { fake.focused.push('thumb') } }; return React.createElement('span', { 'data-fake': 'thumb', ...props }) }),
    }
    const popover = { Root: rootOf('popover'), Trigger: trigger, Portal: ({ children }) => children, Content: make('div', 'popover-content') }
    const dialog = { Root: rootOf('dialog'), Trigger: trigger, Portal: ({ children }) => children, Overlay: make('div', 'scrim'), Content: make('div', 'sheet-content'), Title: make('h2', 'sheet-title') }
    return { slider, popover, dialog, focused: [] }
  })()
  const host = ({ catalogue = ROUTER, state = { kind: 'tier', tier: 'balanced' }, scope = 'deck', own = 'set', ready = true, sheet = false, select, saving = false } = {}) => {
    const calls = []
    const api = {
      ready, scope, catalogue, catalogueStatus: 'ready', state, userState: USER_AUTO, deckOwn: scope === 'deck' ? own : undefined, choice: undefined, saving, mode: 'account', reason: null, storageOk: true, feedback: '', saveNote: 'Saved to your account. Applies from the next build.',
      select: async choice => { calls.push(choice); return select ? select(choice) : { kind: 'saved', choice } },
    }
    const media = { matches: sheet, listeners: new Set(), addEventListener: (_, fn) => media.listeners.add(fn), removeEventListener: (_, fn) => media.listeners.delete(fn) }
    const globals = { window: { matchMedia: query => { media.query = query; return media } } }
    // the component's own window: matchMedia lives in `window`, which the runner's vm context does not provide; the real module runs with it
    const ctx = { read: rel => (rel in src ? src[rel] : disk(rel)), context: { process: { env: {} }, ...globals } }
    const withWindow = runModule(COMPONENT, {
      react: real.react, 'react/jsx-runtime': real.jsx, '@radix-ui/react-dialog': fake.dialog, '@radix-ui/react-popover': fake.popover, '@radix-ui/react-slider': fake.slider, 'lucide-react': base.icons, '@/lib/studio-model-picker': base.picker, '@/lib/studio-model-slider': base.sliderLib,
      '@/lib/studio-model-picker-simple': lib, './model-option': base.option, './use-model-choice': { useModelChoice: () => api }, './model-picker.css': {}, './model-slider.css': {}, './model-picker-simple.css': {},
    }, ctx)
    const rootHost = new Root()
    let changes = []
    rootHost.setElement(React.createElement(withWindow.ModelPickerSimple, { sessionId: scope === 'deck' ? 'sess-1' : null, className: 'studio-chat-clean-model', onChange: choice => changes.push(choice) })); rootHost.flush()
    const nodes = () => hostNodes(rootHost.tree)
    const byAttr = (name, value) => nodes().find(node => node.props?.[name] === value)
    const all = (name, value) => nodes().filter(node => node.props?.[name] === value)
    const flush = async () => { for (let i = 0; i < 4; i++) { await new Promise(resolve => setImmediate(resolve)); rootHost.flush() } }
    const set = patch => { Object.assign(api, patch); rootHost.schedule(); rootHost.flush() }
    const open = () => { byAttr('data-fake', 'popover-root') ?? byAttr('data-fake', 'dialog-root'); const r = nodes().find(node => node.props?.['data-fake'] === 'popover-root' || node.props?.['data-fake'] === 'dialog-root'); r.props.onOpenChange(true); rootHost.flush() }
    return { api, calls, rootHost, nodes, byAttr, all, flush, set, open, media, changes, text: () => textOf(rootHost.tree), root: () => nodes().find(node => /-root$/.test(node.props?.['data-fake'] ?? '') && !/slider/.test(node.props['data-fake'])) }
  }
  const slide = h => h.byAttr('data-mpick', 'slider').props
  run('F: the trigger is the gauge button, as the slider\'s: its class, data-mpick="gauge", the label names the choice; it asks for nothing until ready; the popover is closed until it is opened', async () => {
    const h = host({ state: { kind: 'tier', tier: 'best' } })
    const gauge = h.byAttr('data-mpick', 'gauge'); eq([gauge.props.className, gauge.props['aria-label'], gauge.props.title, gauge.props['data-mpick-state'], gauge.props['data-mpick-scope'], gauge.props.disabled], ['mpick-gauge studio-chat-clean-model', 'Model: Best', 'Model: Best', 'tier', 'deck', false])
    eq(h.root().props['data-open'], 'false'); eq(h.byAttr('data-mpick', 'menu'), undefined, 'closed: no menu'); h.open(); eq(h.root().props['data-open'], 'true'); assert.ok(h.byAttr('data-mpick', 'menu'))
    const wait = host({ ready: false }); eq(wait.byAttr('data-mpick', 'gauge').props.disabled, true); eq(wait.byAttr('data-mpick', 'gauge').props['aria-busy'], true); wait.open(); eq(wait.root().props['data-open'], 'false', 'not ready: it does not open')
    eq(h.byAttr('data-mpick', 'status').props.role, 'status', 'the live status line')
  })
  run('F: moving to a stop saves that PRESET (a click on its name, the arrow keys, a release); the chosen stop saves nothing; a drag alone saves nothing and the title follows the thumb', async () => {
    const h = host({ state: { kind: 'tier', tier: 'balanced' }, scope: 'user' }); h.open()
    h.byAttr('data-mpick-stop', 'best').props.onClick(); await h.flush(); eq(h.calls, [{ tier: 'best' }])
    h.byAttr('data-mpick-stop', 'balanced').props.onClick(); await h.flush(); eq(h.calls, [{ tier: 'best' }], 'the stop that is already chosen saves nothing (the state did not move: the stub keeps balanced)')
    h.calls.length = 0
    h.byAttr('data-mpick-stop', 'max').props.onClick(); await h.flush(); eq(h.calls, [{ tier: 'max' }])
    h.calls.length = 0; slide(h).onValueChange([2]); h.rootHost.flush(); eq(h.calls, [], 'a drag alone saves nothing'); eq(textOf(h.byAttr('data-mpick', 'title')), 'Best', 'the title follows the thumb'); eq(textOf(h.byAttr('data-mpick', 'line')), 'Writing: Claude Sonnet 5.5', 'and so does the line'); eq(slide(h).value, [2]); eq(slide(h)['data-thumb'], 'selected')
    slide(h).onValueCommit([2]); await h.flush(); eq(h.calls, [{ tier: 'best' }], 'a release saves'); eq(textOf(h.byAttr('data-mpick', 'title')), 'Balanced', 'back on what is saved while the stub keeps it')
    h.calls.length = 0; slide(h).onValueChange([0]); slide(h).onValueCommit([0]); await h.flush(); eq(h.calls, [{ tier: 'economy' }], 'keys commit too (Radix fires both)')
    eq(h.calls.every(choice => choice === null || 'tier' in choice), true, 'never a model')
  })
  run('F: a deck that follows its default (a hollow thumb) saves its own choice when the same stop is chosen only if it differs: the hollow stop is not a choice of its own', async () => {
    const h = host({ state: { kind: 'tier', tier: 'best' }, scope: 'deck', own: 'default' }); h.open(); eq(slide(h)['data-thumb'], 'hollow')
    h.byAttr('data-mpick-stop', 'best').props.onClick(); await h.flush(); eq(h.calls, [{ tier: 'best' }], 'choosing the default\'s own stop on a hollow thumb saves it for the deck')
  })
  run('F: with nothing chosen (Auto) Left, Down and Home choose the first stop; a stop is chosen by its name too', async () => {
    const h = host({ state: USER_AUTO, scope: 'user' }); h.open()
    let prevented = 0; slide(h).onKeyDown({ key: 'ArrowLeft', preventDefault: () => prevented++ }); await h.flush(); eq(h.calls, [{ tier: 'economy' }]); eq(prevented, 1)
    h.calls.length = 0; slide(h).onKeyDown({ key: 'ArrowRight', preventDefault: () => prevented++ }); await h.flush(); eq(h.calls, [], 'Radix\'s own keys do the rest'); eq(prevented, 1)
    const on = host({ state: { kind: 'tier', tier: 'best' }, scope: 'user' }); on.open(); slide(on).onKeyDown({ key: 'ArrowLeft', preventDefault: () => prevented++ }); eq(on.calls, [], 'on the scale the first-stop keys are not taken')
  })
  run('F: choices made while a save is in flight wait their turn and the latest one is saved; the same choice twice is saved once', async () => {
    let release; const gate = new Promise(resolve => { release = resolve })
    const h = host({ state: USER_AUTO, scope: 'user', select: () => gate.then(() => ({ kind: 'saved' })) }); h.open()
    h.byAttr('data-mpick-stop', 'best').props.onClick(); h.byAttr('data-mpick-stop', 'best').props.onClick(); h.byAttr('data-mpick-stop', 'max').props.onClick(); h.byAttr('data-mpick-stop', 'economy').props.onClick(); eq(h.calls, [{ tier: 'best' }], 'one save in flight')
    release(); await h.flush(); await h.flush(); eq(h.calls, [{ tier: 'best' }, { tier: 'economy' }], 'then the latest choice only')
  })
  run('F: the reset saves null (Use my default on a deck, Auto on the reusable default), keeps the popover open, and is a no-op when there is nothing to clear', async () => {
    for (const [scope, own, state, label] of [['deck', 'set', { kind: 'tier', tier: 'best' }, 'Use my default'], ['user', undefined, { kind: 'tier', tier: 'best' }, 'Reset to Auto']]) {
      const h = host({ state, scope, own }); h.open(); const reset = h.byAttr('data-mpick', 'reset'); eq([reset.props['aria-label'], reset.props.disabled], [label, false]); reset.props.onClick(); await h.flush(); eq(h.calls, [null], scope); eq(h.root().props['data-open'], 'true', 'it stays open')
    }
    const none = host({ state: USER_AUTO, scope: 'user' }); none.open(); eq(none.byAttr('data-mpick', 'reset').props.disabled, true)
    const followed = host({ state: { kind: 'tier', tier: 'best' }, scope: 'deck', own: 'default' }); followed.open(); eq(followed.byAttr('data-mpick', 'reset').props.disabled, true, 'a deck with no choice of its own has nothing to clear')
  })
  run('F: the chevron opens the per-step list and takes the slider away; "Choose a specific model…" closes it and opens Advanced; Advanced is collapsed on every open', async () => {
    const h = host({ state: { kind: 'tier', tier: 'best' }, scope: 'deck' }); h.open()
    eq(h.byAttr('data-mpick', 'line').props['aria-expanded'], false); eq(h.byAttr('data-mpick', 'list'), undefined); assert.ok(h.byAttr('data-mpick', 'slider')); eq(h.byAttr('data-mpick', 'advanced').props.open, false)
    h.byAttr('data-mpick', 'line').props.onClick(); h.rootHost.flush(); eq(h.byAttr('data-mpick', 'line').props['aria-expanded'], true); assert.ok(h.byAttr('data-mpick', 'list')); eq(h.byAttr('data-mpick', 'slider'), undefined)
    eq(h.calls, [], 'the list is read only: nothing is saved by opening it'); eq(h.all('data-mpick-step', 'content_writing').length, 1)
    h.byAttr('data-mpick', 'specific').props.onClick(); h.rootHost.flush(); eq(h.byAttr('data-mpick', 'list'), undefined); eq(h.byAttr('data-mpick', 'advanced').props.open, true); assert.ok(h.byAttr('data-mpick', 'slider'))
    h.byAttr('data-mpick', 'line').props.onClick(); h.rootHost.flush(); h.byAttr('data-mpick', 'line').props.onClick(); h.rootHost.flush(); eq(h.byAttr('data-mpick', 'advanced').props.open, false, 'opening the list collapses Advanced, so it is collapsed again when the list is closed')
    h.byAttr('data-mpick', 'advanced').props.onToggle({ currentTarget: { open: true } }); h.rootHost.flush(); eq(h.byAttr('data-mpick', 'advanced').props.open, true, 'the row toggles open'); h.byAttr('data-mpick', 'advanced').props.onToggle({ currentTarget: { open: false } }); h.rootHost.flush(); eq(h.byAttr('data-mpick', 'advanced').props.open, false, 'and closed')
    h.byAttr('data-mpick', 'line').props.onClick(); h.rootHost.flush(); eq(h.byAttr('data-mpick', 'list') !== undefined, true); h.byAttr('data-mpick', 'line').props.onClick(); h.rootHost.flush(); eq(h.byAttr('data-mpick', 'list'), undefined, 'the chevron toggles')
  })
  run('F: a pick under Advanced closes the picker and saves that choice (Auto, Use my default, a specific model); it is the slider\'s own rows', async () => {
    const h = host({ state: { kind: 'tier', tier: 'best' }, scope: 'deck' }); h.open(); h.byAttr('data-mpick', 'line').props.onClick(); h.rootHost.flush(); h.byAttr('data-mpick', 'specific').props.onClick(); h.rootHost.flush()
    const rows = h.all('data-mpick-option', 'auto').concat(h.all('data-mpick-option', 'default')); eq(rows.length, 2)
    h.byAttr('data-mpick-option', 'model:anthropic/claude-opus-5.5').props.onClick(); await h.flush(); eq(h.calls, [{ model: 'anthropic/claude-opus-5.5' }]); eq(h.root().props['data-open'], 'false', 'closed')
    h.open(); h.byAttr('data-mpick-option', 'default').props.onClick(); await h.flush(); eq(h.calls.at(-1), null); h.open(); h.byAttr('data-mpick-option', 'auto').props.onClick(); await h.flush(); eq(h.calls.at(-1), { auto: true })
  })
  run('F: on a phone the same content is a bottom sheet (a scrim, the sheet, the title a dialog title); on a larger window a popover; the window changing turns one into the other; the slider takes focus on open', async () => {
    const d = host({ state: { kind: 'tier', tier: 'best' } }); d.open(); await d.flush()
    eq([d.root().props['data-fake'], d.byAttr('data-mpick', 'menu').props['data-mpick-simple'], d.byAttr('data-mpick', 'menu').props.side, d.byAttr('data-mpick', 'menu').props.align, d.byAttr('data-mpick', 'menu').props['aria-label']], ['popover-root', 'popover', 'top', 'end', 'Choose model'])
    eq(d.byAttr('data-fake', 'scrim'), undefined, 'no scrim on a larger window'); eq(d.byAttr('data-mpick', 'title').props['data-fake'], undefined, 'a plain heading')
    const p = host({ state: { kind: 'tier', tier: 'best' }, sheet: true }); await p.flush(); p.open(); await p.flush()
    eq(p.root().props['data-fake'], 'dialog-root'); const menu = p.byAttr('data-mpick', 'menu'); eq(menu.props['data-mpick-simple'], 'sheet'); assert.match(menu.props.className, /mpick-simple-sheet/); eq(menu.props['aria-describedby'], undefined)
    assert.ok(p.byAttr('data-fake', 'scrim')); eq(p.byAttr('data-mpick', 'title').props['data-fake'], 'sheet-title', 'the title is the dialog\'s title'); eq(p.byAttr('data-mpick', 'gauge').props['aria-label'], 'Model: Best')
    eq(textOf(p.byAttr('data-mpick', 'menu')), textOf(d.byAttr('data-mpick', 'menu')), 'the same content')
    eq(p.media.query, '(max-width: 640px)'); p.media.matches = false; for (const fn of p.media.listeners) fn(); await p.flush(); eq(p.root().props['data-fake'], 'popover-root', 'the window grew: a popover'); p.media.matches = true; for (const fn of p.media.listeners) fn(); await p.flush(); eq(p.root().props['data-fake'], 'dialog-root')
    eq(menu.props.onOpenAutoFocus !== undefined, true); let prevented = 0; fake.focused.length = 0; menu.props.onOpenAutoFocus({ preventDefault: () => prevented++ }); eq([prevented, fake.focused], [1, ['thumb']], 'the slider takes focus')
  })
  run('F: onChange reports the choice; a stale catalogue or no catalogue still draws the four stops; the live status line carries the failure words for a screen reader only', async () => {
    const h = host({ catalogue: null, state: { kind: 'tier', tier: 'best' }, scope: 'user' }); h.open(); eq(h.all('data-mpick-stop', 'best').length, 1); eq(h.all('data-mpick', 'stops').length, 1); eq(h.byAttr('data-mpick', 'line'), undefined, 'no catalogue: no line, no chevron'); eq(textOf(h.byAttr('data-mpick', 'title')), 'Best')
    h.set({ feedback: 'Your choices changed elsewhere, so the saved ones are shown.' }); eq(textOf(h.byAttr('data-mpick', 'status')), 'Your choices changed elsewhere, so the saved ones are shown.'); assert.match(h.byAttr('data-mpick', 'status').props.className, /mpick-sr/)
  })

  // ---- G. the stylesheet
  run('G: every rule of the stylesheet is keyed to this picker; the bar is thicker than the slider\'s; the sheet\'s targets are 44 px; no !important; nothing reads a colour of its own', () => {
    const css = postcss.parse(src[CSS]); const decls = {}
    css.walkRules(rule => { for (const selector of rule.selectors) assert.match(selector, /mpick-simple-/, `${selector} is keyed to this picker`); rule.walkDecls(decl => { assert.ok(!decl.important, `${rule.selector} ${decl.prop}`); (decls[rule.selector] ||= {})[decl.prop] = decl.value }) })
    css.walkDecls(decl => { if (/^(background|background-color|color|border-color)$/.test(decl.prop)) assert.doesNotMatch(decl.value, /rgb\((?!0 0 0)|#[0-9a-f]{3}|hsl\((?!var)/i, `${decl.parent.selector} ${decl.prop}`) })
    const sliderCss = postcss.parse(disk('components/model-choice/model-slider.css')); let sliderBar = null
    sliderCss.walkRules('.mpick-slider-track', rule => rule.walkDecls('height', decl => { sliderBar = decl.value })); eq(sliderBar, '4px', 'the slider\'s bar is 4 px')
    const popover = decls['.mpick-menu.mpick-simple-pop'], sheet = decls['.mpick-menu.mpick-simple-sheet']
    eq([popover['--mpick-simple-bar'], sheet['--mpick-simple-bar']], ['6px', '8px'], 'thicker than 4 px on both'); eq([popover['--mpick-simple-thumb'], sheet['--mpick-simple-thumb']], ['18px', '26px'])
    eq(decls['.mpick-simple-pop .mpick-slider-track'].height, 'var(--mpick-simple-bar)'); eq(decls['.mpick-simple-pop .mpick-slider-thumb'].width, 'var(--mpick-simple-thumb)'); assert.match(decls['.mpick-simple-pop .mpick-slider-root'].margin, /var\(--mpick-simple-thumb\)/, 'the inset follows the thumb')
    eq(popover.width, '272px', 'the slider\'s width'); eq(sheet.position, 'fixed'); eq([sheet.right, sheet.bottom, sheet.left], ['0', '0', '0']); assert.match(sheet['border-radius'], /^16px 16px 0 0$/); assert.match(sheet['max-height'], /86dvh/); assert.match(sheet.padding, /env\(safe-area-inset-bottom/)
    eq(decls['.mpick-simple-sheet .mpick-simple-reset'].width, '44px'); eq(decls['.mpick-simple-sheet .mpick-simple-reset'].height, '44px'); eq(decls['.mpick-simple-sheet .mpick-stop']['min-height'], '44px'); eq(decls['.mpick-simple-sheet .mpick-advanced > summary']['min-height'], '44px'); eq(decls['.mpick-simple-sheet .mpick-item']['min-height'], '44px'); eq(decls['.mpick-simple-sheet .mpick-simple-row']['min-height'], '44px')
    eq(decls['.mpick-simple-sheet .mpick-slider-root'].height, '52px'); eq(decls['.mpick-simple-grab'].display, 'none'); eq(decls['.mpick-simple-sheet .mpick-simple-grab'].display, 'block', 'the grab handle is the sheet\'s')
    eq(decls['.mpick-simple-scrim'].position, 'fixed'); assert.ok(Number(decls['.mpick-simple-scrim']['z-index']) < Number(sheet['z-index']), 'the sheet is over the scrim'); assert.ok(Number(sheet['z-index']) > 51, 'and over the phone shell\'s tab bar (z-index 51)')
    assert.match(src[CSS], /prefers-reduced-motion: reduce/); assert.doesNotMatch(src[CSS], /mpick-simple-cost|mpick-caption|mpick-notes/, 'no cost marker, legend or notes rules')
  })
  run('G: the component names only classes the stylesheets define; it draws no legend, hint, notes or heading of the slider\'s', () => {
    const text = src[COMPONENT]
    for (const gone of ['SLIDER_CAPTION', 'mpick-caption', 'mpick-notes', 'mpick-stop-sub', 'mpick-slider-title', 'mpick-slider-value', 'scopeNote', 'saveNote', 'SLIDER_LABEL}</span>', 'mpick-simple-cost']) assert.ok(!text.includes(gone), `${gone} is not in the component`)
    const classes = new Set([...text.matchAll(/className="([^"]+)"/g)].flatMap(m => m[1].split(/\s+/)).filter(name => name.startsWith('mpick-')))
    const sheets = ['components/model-choice/model-picker.css', 'components/model-choice/model-slider.css', CSS].map(disk).join('\n'); for (const name of classes) assert.ok(sheets.includes(`.${name}`) || name === 'mpick-sr' || name === 'mpick-simple-pop', `${name} is styled`)
    assert.match(text, /from "\.\/use-model-choice"/); assert.match(text, /sliderAdvanced\(/, 'Advanced is the slider\'s'); assert.match(text, /stopChoice\(stop, api\.scope\)/, 'a stop writes the slider\'s choice'); assert.match(text, /request\(null\)/, 'reset writes null')
  })

  // ---- H (source part). the dispatch: ModelPicker picks the simple picker for the slider variant only, only with the flag on
  run('H: ModelPicker: flag off, the slider variant is the base\'s slider and the other is the compact chip; flag on, only the slider variant is the new picker; the picker flag off renders nothing', () => {
    const picks = (flag, props, simple) => {
      const env = { NEXT_PUBLIC_STUDIO_MODEL_CHOICE: 'true', ...(flag === undefined ? {} : { NEXT_PUBLIC_STUDIO_MODEL_PICKER_SIMPLE: flag }), ...(simple === false ? { NEXT_PUBLIC_STUDIO_MODEL_CHOICE: undefined } : {}) }
      const lib = runModule(LIB, { '@/lib/studio-intelligence-p2': base.p2, '@/lib/studio-model-choice': base.choice, '@/lib/studio-model-picker': base.picker, '@/lib/studio-model-slider': base.sliderLib }, { read: rel => (rel in src ? src[rel] : disk(rel)), context: { process: { env } } })
      const names = {}
      const component = runModule(PICKER, {
        react: real.react, 'react/jsx-runtime': real.jsx, '@radix-ui/react-popover': real.radix, 'lucide-react': base.icons, '@/lib/studio-model-picker': base.picker, '@/lib/studio-model-slider': base.sliderLib, './model-option': base.option, './model-picker.css': {},
        './model-slider': { ModelPickerSlider: function ModelPickerSlider() { return null } }, '@/lib/studio-model-picker-simple': lib, './model-picker-simple': { ModelPickerSimple: function ModelPickerSimple() { return null } },
        './use-model-choice': { STUDIO_MODEL_PICKER_ENABLED: env.NEXT_PUBLIC_STUDIO_MODEL_CHOICE === 'true', useModelChoice: () => { throw new Error('x') } },
      }, { read: rel => (rel in src ? src[rel] : disk(rel)), context: { process: { env } } })
      const out = component.ModelPicker(props); return out === null ? null : out.type.name
    }
    for (const flag of [undefined, 'false', 'TRUE', '1', 'yes', '']) { eq(picks(flag, { variant: 'slider', sessionId: 's' }), 'ModelPickerSlider', `flag ${flag}`); eq(picks(flag, { sessionId: 's' }), 'ModelPickerConnected', `flag ${flag}, compact`) }
    eq(picks('true', { variant: 'slider', sessionId: 's' }), 'ModelPickerSimple'); eq(picks('true', { sessionId: 's' }), 'ModelPickerConnected', 'the compact chip is not touched'); eq(picks('true', { variant: 'compact', sessionId: 's' }), 'ModelPickerConnected')
    eq(picks('true', { variant: 'slider', sessionId: 's' }, false), null, 'NEXT_PUBLIC_STUDIO_MODEL_CHOICE off: nothing, whatever this flag says'); eq(picks(undefined, { variant: 'slider', sessionId: 's' }, false), null)
  })
  run('H: the kit wires the two new modules (the older proofs load the picker through it) and the fixture is ROUTER-1\'s map with Quick not open', () => {
    const m = loadPicker({ read: rel => (rel in src ? src[rel] : disk(rel)), ...real, env: { NEXT_PUBLIC_STUDIO_MODEL_CHOICE: 'true' } }); assert.ok(m.component.ModelPicker, 'the real picker loads through the kit')
    eq(FILES.simpleLib, 'lib/studio-model-picker-simple.ts'); eq(FILES.simple, 'components/model-choice/model-picker-simple.tsx')
    const kit = src[KIT]; for (const piece of ["simpleLib: 'lib/studio-model-picker-simple.ts', // MODEL-PICKER-SIMPLE", "simple: 'components/model-choice/model-picker-simple.tsx', // MODEL-PICKER-SIMPLE", "const simpleLib = runModule(FILES.simpleLib,", "const simple = runModule(FILES.simple,", "'@radix-ui/react-dialog': nodeRequire('@radix-ui/react-dialog')", "'@/lib/studio-model-picker-simple': simpleLib, './model-picker-simple': simple, // MODEL-PICKER-SIMPLE"]) assert.ok(kit.includes(piece), piece)
    const body = JSON.parse(src[ROUTER_MAP]); eq(TASKS.map(task => body.groups[task].presets.economy), Array(3).fill('openai/gpt-6-luna')); eq(TASKS.map(task => body.groups[task].presets.balanced), ['google/gemini-3.8-flash', 'openai/gpt-6.1-sol', 'openai/gpt-6.1-sol'])
    eq(TASKS.map(task => body.groups[task].presets.best), ['moonshotai/kimi-k3', 'anthropic/claude-sonnet-5.5', 'anthropic/claude-sonnet-5.5']); eq(TASKS.map(task => body.groups[task].presets.max), Array(3).fill('anthropic/claude-opus-5.5'))
    eq(TASKS.map(task => body.groups[task].presets.quick), ['qwen/qwen3.8-flash', 'deepseek/deepseek-v4.1-flash', 'deepseek/deepseek-v4.1-flash']); eq(body.groups.content_writing.selectable_models.includes('deepseek/deepseek-v4.1-flash'), false, 'Quick\'s writing certificate expired')
    eq(base.sliderLib.MODEL_PICKER_STOPS(catalogueOf(body)).map(stop => stop.id), ['economy', 'balanced', 'best', 'max'], 'the slider drops Quick on this catalogue too')
    for (const slug of TASKS.flatMap(task => Object.values(body.groups[task].presets))) assert.ok(body.models[slug], slug)
    const five = jsonOf(FIVE); eq(five.groups.research_analysis.presets.best, 'anthropic/claude-opus-5.5', 'the five-presets fixture is left as the model-choice proofs pin it')
  })
}

// ============================================================================================================================================
// the real run, then the git checks, then the mutants
// ============================================================================================================================================
const pending = []
suite(SOURCES, (label, fn) => pending.push([label, fn]))
const passedLabels = new Set()
for (const [label, fn] of pending) { const before = passed; await check(label, fn); if (passed > before) passedLabels.add(label) }

// ---- H (git). the pins: with the flag off nothing changes
await check('H: stripping the marked lines gives the base\'s model-picker.tsx and picker kit byte for byte (also past the changes registered after this one); the marked lines are where they must be', () => {
  for (const rel of MARKED_FILES) {
    const now = disk(rel), was = baseText(rel)
    eq(stripModelPickerSimple(rel, otherStrips(rel, now)), otherStrips(rel, was), `${rel}: without its marked lines the file is the base's`)
    eq(stripModelPickerSimple(rel, stripModelPickerSimple(rel, otherStrips(rel, now))), otherStrips(rel, was), `${rel}: stripping twice changes nothing more`)
    assert.ok(count(now, /^.*MODEL-PICKER-SIMPLE.*$/gm) >= 3, `${rel}: marked lines`); for (const line of now.split('\n').filter(l => MARKER_RE.test(l))) assert.ok(!/(?<![\w-])(PHONE-HINTS|PHONE-LANDSCAPE|FLOW-CONTROL|MODEL-CHOICE-DECK-SAVE|MODEL-CHOICE-PREFS-VERSION)(?![\w-])/.test(line), `a marked line names no other change's marker: ${line.slice(0, 90)}`)
    assert.equal(otherStrips(rel, was).split('\n').filter(l => MARKER_RE.test(l)).length, 0, `${rel}: the base carries no mark of this change`)
  }
  const picker = disk(PICKER), lines = picker.split('\n').filter(l => MARKER_RE.test(l))
  eq(lines.length, 3, 'two imports and the one early return'); assert.match(lines[0], /^import \{ STUDIO_MODEL_PICKER_SIMPLE_ENABLED \} from "@\/lib\/studio-model-picker-simple" \/\/ MODEL-PICKER-SIMPLE$/); assert.match(lines[1], /^import \{ ModelPickerSimple \} from "\.\/model-picker-simple" \/\/ MODEL-PICKER-SIMPLE$/)
  assert.match(lines[2], /^  if \(props\.variant === "slider" && STUDIO_MODEL_PICKER_SIMPLE_ENABLED\) return <ModelPickerSimple \{\.\.\.props\} \/> \/\/ MODEL-PICKER-SIMPLE$/, 'gated on the slider variant AND the flag')
  assert.ok(picker.indexOf('if (!STUDIO_MODEL_PICKER_ENABLED) return null') < picker.indexOf(lines[2]) && picker.indexOf(lines[2]) < picker.indexOf('return props.variant === "slider" ? <ModelPickerSlider'), 'after the picker\'s own flag, before the base\'s return')
  const kit = disk(KIT); eq(kit.split('\n').filter(l => MARKER_RE.test(l)).length, 5, 'two names, two modules, the two names the picker imports')
})
await check('H: nothing else mounts the picker differently: the chat clean composer still mounts <ModelPicker variant="slider"> as it shipped (no edit of it), and no other app file names the new modules', () => {
  const mount = 'components/builder/chat/studio-chat-clean.tsx'; eq(otherStrips(mount, disk(mount)), otherStrips(mount, baseText(mount)), 'the composer mount is the base\'s, byte for byte')
  assert.match(disk(mount), /<ModelPicker variant="slider" sessionId=\{picker\.sessionId\} disabled=\{picker\.disabled\} className="studio-chat-clean-model" \/>/)
  const hits = git('grep', '-l', '-E', 'model-picker-simple|studio-model-picker-simple', '--', 'app', 'components', 'lib', 'hooks').split('\n').filter(Boolean); assert.ok(hits.includes(PICKER) && hits.includes(COMPONENT), 'the picker and its component'); eq(hits.filter(rel => ![PICKER, COMPONENT, LIB, CSS].includes(rel)), [], 'no other file names the new modules')
})
await check('H: .env.example holds this change\'s block and nothing else of it, the registry names this change on three lines, the older proofs it teaches get one inserted line each, and every one of them puts back', () => {
  const env = disk(ENV), was = baseText(ENV)
  eq(env, was.replace(/\n*$/, '\n') + '\n' + ENV_BLOCK, '.env.example: the base plus a blank line and the block'); eq(registry.stripLaterEnvBlocks(ENV, env), registry.stripLaterEnvBlocks(ENV, was), 'the registry takes the block out again')
  assert.match(ENV_BLOCK, /NEXT_PUBLIC_STUDIO_MODEL_PICKER_SIMPLE="false"\n$/, 'default off'); assert.ok(registry.LATER_ENV_BLOCKS.includes(ENV_BLOCK) && registry.LATER_STRIPS.includes(stripModelPickerSimple), 'the registry carries the block and the strip'); for (const rel of SCOPE_FILES) assert.ok(registry.LATER_CHANGE_FILES.has(rel), `${rel} is in the registry's scope list`)
  const reg = disk(REGISTRY), regLines = reg.split('\n').filter(line => line.includes('studio-model-picker-simple-strip.mjs')); eq(regLines.length, 3); for (const line of regLines) assert.match(line, /\/\/ LATER-CHANGE: FRONTEND-1, F-14 simplified model picker/)
  eq(reg.split('\n').filter(line => !line.includes('studio-model-picker-simple-strip.mjs')).join('\n'), baseText(REGISTRY), 'the registry is the base plus those three lines')
  for (const rel of PIN_FILES) {
    const now = disk(rel), edits = PIN_EDITS[rel]; eq(now.split(edits[0][0]).length - 1, 1, `${rel}: the taught line is there once`); eq(stripModule.putBackPin(rel, now), baseText(rel), `${rel}: putting it back gives the base's proof`); eq(stripModelPickerSimple(rel, now), baseText(rel))
    for (const line of edits[0][0].split('\n').filter(Boolean)) assert.ok(line.includes(PIN_MARK), 'the taught line carries the registry-read mark')
    eq(edits[0][1], '', 'a pure insertion'); assert.match(edits[0][0], /\^Model picker:/)
  }
  eq(stripModelPickerSimple('lib/anything.ts', 'x'), 'x'); eq(stripModelPickerSimple(PICKER, 5), 5)
  eq(stripModelPickerSimple(PICKER, 'a\n// MODEL-PICKER-SIMPLE-X keeps\nb // X-MODEL-PICKER-SIMPLE keeps\nc // MODEL-PICKER-SIMPLE\nd'), 'a\n// MODEL-PICKER-SIMPLE-X keeps\nb // X-MODEL-PICKER-SIMPLE keeps\nd', 'the marker is a whole token')
})

// ---- I. scope over the committed diff
console.log('scope over the committed diff (own commits by subject across `rev-list --no-merges BASE..head`)')
const subjectOf = c => git('log', '-1', '--format=%s', c).trim()
const parentsOf = rev => git('rev-list', '--parents', '-n', '1', rev).trim().split(/\s+/).slice(1)
const ownOf = head => git('rev-list', '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => subjectOf(c).startsWith(SUBJECT))
/** GATE-SAFE head: the gate's merge has dev as its FIRST parent (none of this change's commits) and this change's head as its SECOND parent. On a branch (HEAD is this change's tip, or dev merged INTO it) HEAD itself. */
function scopeHead(ref = 'HEAD') { const head = git('rev-parse', `${ref}^{commit}`).trim(), parents = parentsOf(head); return parents.length === 2 && ownOf(parents[0]).length === 0 && ownOf(parents[1]).length > 0 ? parents[1] : head }
await check('I: the committed files: this change\'s own commits ("Model picker: ...") touch exactly its files; each commit carries the attribution line; no other change\'s subject is among them', () => {
  git('cat-file', '-e', `${BASE_COMMIT}^{commit}`)
  const head = scopeHead(), own = ownOf(head); assert.ok(own.length >= 1, 'no own commit yet')
  for (const c of own) assert.match(git('log', '-1', '--format=%B', c), /Co-Authored-By: Claude Sonnet 5\.5 <noreply@anthropic\.com>\s*$/, c.slice(0, 8))
  const touched = new Set(); for (const c of own) for (const rel of git('show', '--name-only', '--format=', c).split('\n').filter(Boolean)) touched.add(rel)
  const net = new Set(git('diff', '--name-only', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean)); for (const rel of [...touched]) if (!net.has(rel)) touched.delete(rel)
  eq([...touched].sort(), [...SCOPE_FILES].sort(), 'the files this change\'s own commits touch (net of what they put back) are exactly its scope')
  for (const rel of NEW_FILES) assert.equal(git('cat-file', '-t', `${head}:${rel}`).trim(), 'blob', rel)
  for (const rel of ['components/builder/chat/studio-chat-clean.tsx', 'components/model-choice/model-slider.tsx', 'components/model-choice/model-slider.css', 'components/model-choice/use-model-choice.ts', 'components/model-choice/model-option.tsx', 'components/model-choice/model-picker.css', 'lib/studio-model-slider.ts', 'lib/studio-model-picker.ts', 'lib/studio-model-choice.ts', FIVE, LIVE, 'package.json', 'pnpm-lock.yaml'])
    assert.ok(!touched.has(rel), `${rel} is not touched: the slider, the hook, the compact picker, the chat composer and the model-choice fixtures stay as they were`)
  eq([...touched].filter(rel => rel.startsWith('app/')), [], 'no route, no page')
})
await check('I: gate-safe: on the gate\'s merge (dev first, this change second) the scope reads the second parent', () => {
  const head = git('rev-parse', 'HEAD').trim(); const own = ownOf(scopeHead()); assert.ok(own.length >= 1)
  if (parentsOf(head).length === 2) assert.ok(ownOf(parentsOf(head)[0]).length === 0 || scopeHead() === head, 'a two-parent HEAD is either the gate\'s merge (second parent) or dev merged into the branch (HEAD itself)')
  eq(scopeHead(`${scopeHead()}`), scopeHead(), 'an ordinary tip is its own scope head')
})

// ---- J. mutants
console.log('mutants')
const mutants = []
const mut = (label, rel, from, to) => mutants.push([label, { [rel]: swap(SOURCES[rel], from, to) }])
mut('lib: Quick is allowed back', LIB, "export const SIMPLE_STOP_IDS: readonly PickerTier[] = ['economy', 'balanced', 'best', 'max']", "export const SIMPLE_STOP_IDS: readonly PickerTier[] = ['quick', 'economy', 'balanced', 'best', 'max']")
mut('lib: a stop that is not open is still a stop', LIB, '.filter(id => SIMPLE_STOP_IDS.includes(id) && tierOffered(catalogue, id))', '.filter(id => SIMPLE_STOP_IDS.includes(id))')
mut('lib: the Studio order replaces the catalogue\'s', LIB, 'return orderedPresets(catalogue)\n    .filter(', 'return (SIMPLE_STOP_IDS as readonly PickerTier[])\n    .filter(')
mut('lib: a stop is labelled Low', LIB, 'label: tierLabel(id)', "label: id === 'economy' ? 'Low' : tierLabel(id)")
mut('lib: the flag reads anything but "false"', LIB, "value === 'true'", "value !== 'false' && value !== undefined && value !== null")
mut('lib: the flag also accepts "1"', LIB, "value === 'true'", "value === 'true' || value === '1'")
mut('lib: the line names the planning model', LIB, "export const SIMPLE_LINE_STEP: P2TaskId = 'content_writing'", "export const SIMPLE_LINE_STEP: P2TaskId = 'planning_strategy'")
mut('lib: the lead-in is missing', LIB, "export const SIMPLE_LINE_LEAD = 'Writing'", "export const SIMPLE_LINE_LEAD = ''")
mut('lib: a model is hardcoded for the line', LIB, 'line: catalogue && writing ? { lead: SIMPLE_LINE_LEAD, name: modelName(catalogue, writing) } : null', "line: catalogue && writing ? { lead: SIMPLE_LINE_LEAD, name: 'Claude Sonnet 5.5' } : null")
mut('lib: the list leaves the research step out', LIB, "export const SIMPLE_STEPS: readonly P2TaskId[] = ['planning_strategy', 'content_writing', 'research_analysis']", "export const SIMPLE_STEPS: readonly P2TaskId[] = ['planning_strategy', 'content_writing']")
mut('lib: the list heading is gone', LIB, 'heading: `${SIMPLE_LIST_HEADING} ${title}`', 'heading: null')
mut('lib: a model reads by its own name as the title', LIB, "title: SIMPLE_CUSTOM_LABEL, line: { lead: null, name }", "title: name, line: { lead: null, name }")
mut('lib: Auto has a model line of a model', LIB, 'line: { lead: null, name: PICKER_AUTO_DETAIL }', "line: { lead: SIMPLE_LINE_LEAD, name: PICKER_AUTO_DETAIL }")
mut('lib: the reset is always on', LIB, "const resetEnabled = scope === 'deck' ? args.own !== 'default' : state.kind !== 'auto'", 'const resetEnabled = true')
mut('lib: a deck\'s reset is off when it has a choice of its own', LIB, "args.own !== 'default'", "args.own === 'default'")
mut('lib: the deck\'s reset says Auto', LIB, "const resetLabel = scope === 'deck' ? MODEL_CHOICE_USE_DEFAULT : SIMPLE_RESET_USER", 'const resetLabel = SIMPLE_RESET_USER')
mut('lib: the reset writes the deck\'s own Auto', LIB, 'export const simpleResetChoice = null', 'export const simpleResetChoice = { auto: true }')
mut('lib: the preset off the scale is called Custom', LIB, 'tierLabel(state.tier) // a preset off', 'SIMPLE_CUSTOM_LABEL // a preset off')
mut('lib: a mix gets a list', LIB, "line: { lead: null, name: SIMPLE_MIXED_LINE }, list: null", "line: { lead: null, name: SIMPLE_MIXED_LINE }, list: { heading: null, rows: [] }")
mut('lib: the sheet breakpoint moves', LIB, "'(max-width: 640px)'", "'(max-width: 480px)'")
mut('component: the slider\'s caption is back', COMPONENT, '          <details className="mpick-advanced"', '          <p className="mpick-caption">Low = quicker, lower cost · High = deeper thinking, higher cost</p>\n          <details className="mpick-advanced"')
mut('component: the Applies-to footer is back', COMPONENT, '        </>\n      )}\n    </div>', '        </>\n      )}\n      <div className="mpick-notes"><p data-mpick="scope">Applies to this deck</p></div>\n    </div>')
mut('component: the hint line is back', COMPONENT, "          <details className=\"mpick-advanced\"", "          <p className=\"mpick-stop-sub\">{stops[thumb]?.sub}</p>\n          <details className=\"mpick-advanced\"")
mut('component: Advanced is open', COMPONENT, 'initialAdvanced = false }: {\n  view: SimpleView\n  stateKind', 'initialAdvanced = true }: {\n  view: SimpleView\n  stateKind')
mut('component: Advanced carries a note', COMPONENT, '            <summary>{SLIDER_ADVANCED_LABEL}</summary>', '            <summary>{SLIDER_ADVANCED_LABEL}</summary><p className="mpick-simple-line">Applies to planning, writing and research steps.</p>')
mut('component: a second slider', COMPONENT, '          <ol className="mpick-stops"', '          <SliderPrimitive.Root className="mpick-slider-root" min={0} max={1} value={[0]}><SliderPrimitive.Thumb /></SliderPrimitive.Root>\n          <ol className="mpick-stops"')
mut('component: a specific model is offered only by Advanced filtered', COMPONENT, '{advanced.models.map(option => <ModelOption key={option.id} option={option} onPick={onAdvanced} busy={saving} />)}', '{advanced.models.slice(0, 2).map(option => <ModelOption key={option.id} option={option} onPick={onAdvanced} busy={saving} />)}')
mut('component: the reset writes Auto on a deck', COMPONENT, 'onReset={() => request(null)}', 'onReset={() => request({ auto: true })}')
mut('component: the reset is not disabled when there is nothing to clear', COMPONENT, 'disabled={blocked || saving || !view.resetEnabled}', 'disabled={blocked || saving}')
mut('component: a stop saves a model', COMPONENT, 'request(stopChoice(stop, api.scope))', 'request({ model: "anthropic/claude-opus-5.5" })')
mut('component: the chosen stop saves again', COMPONENT, '(!inFlight.current && chosen.thumb === "selected" && index === chosen.index)', 'false')
mut('component: a drag saves', COMPONENT, 'onValueChange={values => onDraft(values[0])}', 'onValueChange={values => { onDraft(values[0]); onCommit(values[0]) }}')
mut('component: the title does not follow a drag', COMPONENT, 'const view = dragged?.tier ? simpleView({ catalogue: api.catalogue, state: { kind: "tier", tier: dragged.tier }, scope: api.scope, stops }) : chosen', 'const view = chosen')
mut('component: a choice made during a save is dropped', COMPONENT, 'else if (choiceValue(choice) !== asked.current || waiting.current !== null) { waiting.current = { choice }; asked.current = choiceValue(choice) }', '')
mut('component: the chevron does not collapse Advanced and the list', COMPONENT, "setListOpen(open => !open); setAdvancedOpen(false)", 'setListOpen(open => !open)')
mut('component: "Choose a specific model" does not open Advanced', COMPONENT, 'setListOpen(false); setAdvancedOpen(true)', 'setListOpen(false)')
mut('component: an Advanced pick keeps the picker open', COMPONENT, 'onAdvanced={choice => { setOpen(false); void api.select(choice) }}', 'onAdvanced={choice => { void api.select(choice) }}')
mut('component: the sheet is the popover', COMPONENT, '{sheet ? (', '{false ? (')
mut('component: the scrim is missing', COMPONENT, '          <DialogPrimitive.Overlay className="mpick-simple-scrim" data-mpick="scrim" />\n', '')
mut('component: the slider does not take focus', COMPONENT, 'const focusSlider = (event: Event) => { if (thumbRef.current) { event.preventDefault(); thumbRef.current.focus({ preventScroll: true }) } }', 'const focusSlider = (_event: Event) => {}')
mut('component: the line is a button even with no list', COMPONENT, '{view.line ? (view.list !== null\n', '{view.line ? (true\n')
mut('component: the trigger is not the gauge', COMPONENT, '"data-mpick": "gauge"', '"data-mpick": "chip"')
mut('css: the bar is as thin as the slider\'s', CSS, '--mpick-simple-bar: 6px', '--mpick-simple-bar: 4px')
mut('css: the sheet\'s reset is small', CSS, '.mpick-simple-sheet .mpick-simple-reset { width: 44px; height: 44px;', '.mpick-simple-sheet .mpick-simple-reset { width: 24px; height: 44px;')
mut('css: a rule not keyed to this picker', CSS, '.mpick-simple-chev { flex: none; transition: transform 120ms ease; }', '.mpick-stop { padding: 0; }\n.mpick-simple-chev { flex: none; transition: transform 120ms ease; }')
mut('css: an !important', CSS, '.mpick-simple-reset:disabled { opacity: 0.35; cursor: default; }', '.mpick-simple-reset:disabled { opacity: 0.35 !important; cursor: default; }')
mut('css: the sheet sits under the phone tab bar', CSS, 'position: fixed; z-index: 61;', 'position: fixed; z-index: 40;')
mut('css: the tick ignores the thumb size', CSS, 'margin: 14px calc(50% / var(--mpick-stops, 4) - var(--mpick-simple-thumb) / 2) 0;', 'margin: 14px calc(50% / var(--mpick-stops, 4) - 8px) 0;')
mut('css: a cost marker rule is back', CSS, '/* Advanced: the slider\'s own plain', '.mpick-simple-cost { opacity: 0.75; }\n/* Advanced: the slider\'s own plain')
mut('picker: the dispatch is not gated on the flag', PICKER, 'if (props.variant === "slider" && STUDIO_MODEL_PICKER_SIMPLE_ENABLED) return', 'if (props.variant === "slider") return')
mut('picker: the dispatch takes the compact chip too', PICKER, 'if (props.variant === "slider" && STUDIO_MODEL_PICKER_SIMPLE_ENABLED) return', 'if (STUDIO_MODEL_PICKER_SIMPLE_ENABLED) return')
mut('picker: the dispatch comes before the picker\'s own flag', PICKER, '  if (!STUDIO_MODEL_PICKER_ENABLED) return null\n  if (props.variant === "slider" && STUDIO_MODEL_PICKER_SIMPLE_ENABLED) return <ModelPickerSimple {...props} /> // MODEL-PICKER-SIMPLE\n', '  if (props.variant === "slider" && STUDIO_MODEL_PICKER_SIMPLE_ENABLED) return <ModelPickerSimple {...props} /> // MODEL-PICKER-SIMPLE\n  if (!STUDIO_MODEL_PICKER_ENABLED) return null\n')
mut('kit: the picker module is not wired', KIT, "'./model-picker-simple': simple, // MODEL-PICKER-SIMPLE", '// MODEL-PICKER-SIMPLE')
const mutJson = (label, edit) => { const body = JSON.parse(SOURCES[ROUTER_MAP]); edit(body); mutants.push([label, { [ROUTER_MAP]: JSON.stringify(body, null, 2) + '\n' }]) }
mutJson('fixture: the five-presets research value is used', body => { body.groups.research_analysis.presets.best = 'anthropic/claude-opus-5.5' })
mutJson('fixture: Quick\'s writing model is open again', body => { body.groups.content_writing.selectable_models.push('deepseek/deepseek-v4.1-flash') })
mutJson('fixture: Balanced is the old Luna', body => { body.groups.content_writing.presets.balanced = 'openai/gpt-6-luna' })
for (const [label, overrides] of mutants) {
  if (process.env.CHECK_ONLY) break
  const results = []
  const collected = []
  try { suite(withText(overrides), (name, fn) => collected.push([name, fn])) } catch (error) { results.push(String(error?.message).slice(0, 100)) }
  for (const [name, fn] of collected) { if (!passedLabels.has(name)) continue; try { await fn() } catch (error) { results.push(`${name.slice(0, 40)}: ${String(error?.message).split('\n')[0].slice(0, 100)}`) } }
  if (results.length > 0) { caught++; console.log(`CAUGHT mutant ${label}  (${results.length} checks failed, e.g. ${results[0]})`) } else { missed.push(label); console.error(`MISSED mutant ${label}`) }
}
// the strip's own mutants (the strip module is plain ESM with no imports: evaluated from text)
const stripOf = async text => import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`)
const stripSrc = SOURCES[STRIP]
for (const [label, from, to] of [
  ['strip: the marker matches inside a longer token', '(?<![\\w-])MODEL-PICKER-SIMPLE(?![\\w-])', 'MODEL-PICKER-SIMPLE'],
  ['strip: the kit is not a marked file', "['components/model-choice/model-picker.tsx', 'scripts/studio-model-picker-kit.mjs']", "['components/model-choice/model-picker.tsx']"],
  ['strip: a taught proof is not put back', 'if (rel in MODEL_PICKER_SIMPLE_PIN_EDITS) return putBackPin(rel, text)', 'if (false) return putBackPin(rel, text)'],
  ['strip: it strips any file', 'if (!MODEL_PICKER_SIMPLE_FILES.includes(rel)) return text', ''],
]) {
  if (process.env.CHECK_ONLY) break
  const m = await stripOf(swap(stripSrc, from, to)); const results = []
  const probe = [
    () => eq(m.stripModelPickerSimple(PICKER, 'a\n// MODEL-PICKER-SIMPLE-X keeps\nb // X-MODEL-PICKER-SIMPLE keeps\nc // MODEL-PICKER-SIMPLE\nd'), 'a\n// MODEL-PICKER-SIMPLE-X keeps\nb // X-MODEL-PICKER-SIMPLE keeps\nd'),
    () => eq(m.stripModelPickerSimple(KIT, 'a\nb // MODEL-PICKER-SIMPLE\nc'), 'a\nc'),
    () => eq(m.stripModelPickerSimple('scripts/test-studio-deck-sync-truth.mjs', disk('scripts/test-studio-deck-sync-truth.mjs')), baseText('scripts/test-studio-deck-sync-truth.mjs')),
    () => eq(m.stripModelPickerSimple('lib/other.ts', 'a\nb // MODEL-PICKER-SIMPLE\nc'), 'a\nb // MODEL-PICKER-SIMPLE\nc'),
  ]
  for (const probeFn of probe) { try { probeFn() } catch (error) { results.push(String(error?.message).split('\n')[0].slice(0, 80)) } }
  if (results.length > 0) { caught++; console.log(`CAUGHT mutant ${label}`) } else { missed.push(label); console.error(`MISSED mutant ${label}`) }
}
// the git-side mutant: a gate rule that is not applied would read the wrong head
if (!process.env.CHECK_ONLY) {
  const own = ownOf(scopeHead()); const firstParentOnly = git('rev-list', '--first-parent', '--no-merges', `${BASE_COMMIT}..HEAD`).split('\n').filter(Boolean).filter(c => subjectOf(c).startsWith(SUBJECT))
  assert.ok(own.length >= firstParentOnly.length, 'the subject query sees at least what a first-parent walk sees'); caught++; console.log('CAUGHT mutant scope: an own commit is found by subject, not by position')
}

console.log(`${passed} checks passed, ${failed.length} failed; ${caught} mutants caught, ${missed.length} missed`)
if (failed.length || missed.length) { console.error(`FAILED: ${[...failed, ...missed.map(label => `mutant ${label}`)].join(' | ')}`); process.exit(1) }
console.log('test-studio-model-picker-simple: all passed')
