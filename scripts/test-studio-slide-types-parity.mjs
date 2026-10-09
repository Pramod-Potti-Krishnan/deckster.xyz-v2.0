// Actual components and supplied local responses only. No browser, service,
// connected mutation, visual fidelity or persistence claim is made here.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

const root = new URL('../', import.meta.url)
const uat = 'ee532fab4b84a6883f8a5b50675ccab692b62240'
const before = '9ab40d5bc11081441e0b8b631ecd2dc842f637b8'
const read = path => fs.readFileSync(new URL(path, root), 'utf8')
const pinned = (ref, path) => execFileSync('git', ['show', `${ref}:${path}`], { cwd: root, encoding: 'utf8' })
const plain = value => JSON.parse(JSON.stringify(value))
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
function pure(source) { const module = { exports: {} }; vm.runInNewContext(compile(source), { module, exports: module.exports }); return module.exports }
const elements = pure(read('types/elements.ts'))
const helpers = pure(read('components/slide-generation-panel/compose-helpers.ts'))
const asyncFields = pure(read('lib/slide-compose-async.ts'))
const jsx = (type, props) => ({ type, props: props || {} })
const nodes = value => Array.isArray(value) ? value.flatMap(nodes) : !value || typeof value !== 'object' ? [] : [value, ...nodes(value.props?.children)]
const textOf = value => Array.isArray(value) ? value.map(textOf).join('') : value && typeof value === 'object' ? textOf(value.props?.children) : String(value ?? '')
const one = (tree, predicate) => { const found = nodes(tree).filter(predicate); assert.equal(found.length, 1, 'Unique actual component control'); return found[0] }
const defer = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve } }
const response = body => ({ ok: true, json: async () => body })
const depsEqual = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]))

function componentHarness(path, options = {}) {
  let cursor = 0, dirty = false, tree, seq = 0
  const slots = [], effects = [], requests = [], results = []
  const hooks = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, value => { const next = typeof value === 'function' ? value(slots[i].value) : value; if (!Object.is(next, slots[i].value)) { slots[i].value = next; dirty = true } }] },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i] },
    useMemo(fn, deps) { const i = cursor++; if (!depsEqual(slots[i]?.deps, deps)) slots[i] = { deps, value: fn() }; return slots[i].value },
    useCallback(fn, deps) { return hooks.useMemo(() => fn, deps) },
    useEffect(setup, deps) { const i = cursor++; if (!depsEqual(slots[i]?.deps, deps)) { const previous = slots[i]; slots[i] = { deps, cleanup: previous?.cleanup }; effects.push(() => { slots[i].cleanup?.(); slots[i].cleanup = setup() }) } },
  }
  const imports = { react: hooks, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' }, '@/types/elements': elements, './compose-helpers': helpers, '@/lib/slide-compose-async': asyncFields, '@/lib/config': { features: { slideComposerAsyncEnabled: options.async ?? true, slideComposerTraceEnabled: false } }, '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') }, '@/lib/theme-builder': { FALLBACK_THEME_PRESETS: [] }, '@/hooks/use-knowledge-graph': { useKnowledgeGraph: () => ({ isEntitled: true, isSubscribed: true }) }, '@/lib/studio-slide-shortcuts': { shouldYieldStudioSlidePanelShortcut: () => false }, '@/lib/studio-add-slide-v2': { ADD_SLIDE_V2_ENABLED: false }, './studio-add-slide-v2': { AddSlideV2Entry: () => null } }
  const module = { exports: {} }, context = { module, exports: module.exports, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: options.flag ?? 'true' } }, document: { fullscreenElement: null }, window: { localStorage: { getItem: () => null }, addEventListener: () => {}, removeEventListener: () => {} }, crypto: { randomUUID: () => `synthetic-job-${++seq}` }, console,
    fetch(url, init) { const request = { url, body: JSON.parse(init.body) }; requests.push(request); return options.onRequest?.(request) ?? Promise.resolve(response(options.async === false ? { status: 'built', presentation_id: 'synthetic-deck', slide_index: 1 } : { status: 'accepted', job_id: request.body.job_id, session_id: request.body.session_id, presentation_id: request.body.presentation_id, target_index: 1 })) },
    require(name) { if (name in imports) return imports[name]; if (name.endsWith('.css')) return {}; if (name === 'lucide-react' || name.startsWith('@/components/')) return new Proxy({}, { get: (_, key) => key }); throw new Error(`No offline dependency allowed: ${name}`) },
  }
  const isPicker = path.includes('slide-layout-picker')
  const source = options.source ?? read(path)
  const instrumented = isPicker ? source : source.replace('  return (\n    <div className="absolute inset-0 z-20 flex pointer-events-none">', '  globalThis.__actualGenerate = handleGenerate;\n  return (\n    <div className="absolute inset-0 z-20 flex pointer-events-none">')
  if (!isPicker) assert.notEqual(instrumented, source, 'Observe actual awaitable native callback without changing its implementation')
  vm.runInNewContext(compile(instrumented), context)
  const props = isPicker ? { onAddSlide: async layout => results.push(layout), disabled: false } : { isOpen: true, onClose() {}, mode: 'compose', currentSlide: 2, sessionId: 'synthetic-session', presentationId: 'synthetic-deck', research: { useUploadedDocuments: true, useWebSearch: false, useDeepResearch: false, useKnowledgeGraph: false }, buildThemeSelection: { mode: 'auto' }, enabled: true, onAccepted: result => results.push(plain(result)), onBuilt: result => results.push(plain(result)) }
  function render(extra = {}) { Object.assign(props, extra); let count = 0; do { assert.ok(++count < 20); cursor = 0; dirty = false; tree = module.exports[isPicker ? 'SlideLayoutPicker' : 'SlideGenerationPanel']({ ...props }); while (effects.length) effects.shift()() } while (dirty); return tree }
  render()
  return { render, requests, results, props, get tree() { return tree }, input(value) { one(render(), n => n.type === 'GenerationInput').props.onPromptChange(value); render() }, submit() { render(); return context.__actualGenerate() } }
}

let cases = 0
const failures = []
async function check(name, fn) { try { await fn(); cases++; console.log(`PASS ${name}`) } catch (error) { failures.push(name); console.error(`FAIL ${name}: ${error.message}`) } }
await check('all 19 native labels/IDs/categories equal exact UAT source', () => {
  assert.deepEqual(plain(elements.SLIDE_LAYOUTS), plain(pure(pinned(uat, 'types/elements.ts')).SLIDE_LAYOUTS))
  assert.equal(elements.SLIDE_LAYOUTS.length, 19)
})
for (const layout of elements.SLIDE_LAYOUTS) await check(`native picker dispatch ${layout.layout}`, async () => {
  const h = componentHarness('components/slide-layout-picker.tsx')
  const card = one(h.render(), n => n.props?.['aria-label'] === `Insert ${layout.label} slide`)
  await card.props.onClick()
  assert.deepEqual(h.results, [layout.layout])
})
await check('all native catalogue cards unavailable while parent mutation gate is set', () => {
  const h = componentHarness('components/slide-layout-picker.tsx')
  const cards = nodes(h.render({ disabled: true })).filter(n => n.props?.['aria-label']?.startsWith('Insert '))
  assert.equal(cards.length, 19); assert.ok(cards.every(n => n.props.disabled))
})
await check('category/search filtering and empty recovery keep every original layout reachable', () => {
  const h = componentHarness('components/slide-layout-picker.tsx')
  for (const category of elements.SLIDE_LAYOUT_CATEGORIES) {
    one(h.render(), n => n.type === 'button' && textOf(n) === category.label).props.onClick()
    assert.equal(nodes(h.render()).filter(n => n.props?.['aria-label']?.startsWith('Insert ')).length, elements.SLIDE_LAYOUTS.filter(l => l.category === category.category).length)
  }
  one(h.render(), n => n.props?.['aria-label'] === 'Find a slide layout').props.onChange({ target: { value: 'missing synthetic layout' } })
  one(h.render(), n => n.type === 'button' && textOf(n) === 'Show all layouts').props.onClick()
  assert.equal(nodes(h.render()).filter(n => n.props?.['aria-label']?.startsWith('Insert ')).length, 19)
})
await check('Studio Generate method closes the catalogue and dispatches only its optional callback', () => {
  let generations = 0
  const h = componentHarness('components/slide-layout-picker.tsx')
  h.render({ onGenerateSlide: () => generations++ })
  one(h.render(), n => n.type === 'Popover').props.onOpenChange(true)
  one(h.render(), n => n.type === 'button' && textOf(n) === 'Generate').props.onClick()
  assert.equal(generations, 1); assert.deepEqual(h.results, [])
  assert.equal(one(h.render(), n => n.type === 'Popover').props.open, false)
  assert.equal(nodes(h.render()).filter(n => n.props?.['aria-label']?.startsWith('Insert ')).length, 19)
})
await check('Studio method row stays absent until its shared integration callback exists', () => {
  const h = componentHarness('components/slide-layout-picker.tsx'); assert.equal(nodes(h.render()).filter(n => n.props?.['aria-label'] === 'New slide method').length, 0)
})
for (const flag of ['', 'false', 'TRUE']) await check(`classic ${flag || 'unset'} ignores new method callback and preserves pinned picker UI`, async () => {
  let generations = 0
  const current = componentHarness('components/slide-layout-picker.tsx', { flag }), baseline = componentHarness('components/slide-layout-picker.tsx', { flag, source: pinned(uat, 'components/slide-layout-picker.tsx') })
  current.render({ onGenerateSlide: () => generations++ })
  const snapshot = h => nodes(h.render()).filter(n => n.type === 'button').map(n => ({ label: textOf(n), title: n.props.title, disabled: n.props.disabled }))
  assert.deepEqual(plain(snapshot(current)), plain(snapshot(baseline)))
  assert.equal(nodes(current.render()).some(n => n.props?.['aria-label'] === 'New slide method'), false)
  assert.equal(generations, 0)
})
await check('Studio method switch is unavailable under the same native mutation gate', () => {
  const h = componentHarness('components/slide-layout-picker.tsx'); h.render({ onGenerateSlide() {}, disabled: true })
  assert.equal(one(h.render(), n => n.type === 'button' && textOf(n) === 'Generate').props.disabled, true)
})

const panelFile = 'components/slide-generation-panel/index.tsx'
const choose = (h, label, value, flush = true) => { one(h.render(), n => n.props?.label === label && typeof n.props.onChange === 'function').props.onChange(value); if (flush) h.render() }
await check('generated type/menu values and compose helper maps preserve exact UAT source', () => {
  const old = componentHarness(panelFile, { source: pinned(uat, panelFile) }), current = componentHarness(panelFile)
  assert.deepEqual(plain(one(current.render(), n => n.props?.label === 'Slide type').props.options.map(({ value, label, description }) => ({ value, label, description }))), plain(one(old.render(), n => n.props?.label === 'Slide type').props.options.map(({ value, label, description }) => ({ value, label, description }))))
  assert.equal(read('components/slide-generation-panel/compose-helpers.ts'), pinned(uat, 'components/slide-generation-panel/compose-helpers.ts'))
})
for (const [family, content] of [['text', 'text_heavy_columns'], ['chart', 'chart'], ['infographic', 'infographic'], ['diagram', 'diagram_idea_board']]) for (const shape of helpers.SHAPE_OPTIONS[family]) await check(`actual generated ${family}/${shape.value} payload`, async () => {
  const h = componentHarness(panelFile); h.input('Synthetic capability fixture'); choose(h, 'Slide type', 'content_text'); choose(h, 'Content', content); choose(h, 'Layout style', shape.value); await h.submit()
  const selections = h.requests[0].body.selections
  assert.equal(h.requests[0].url, '/api/slides/compose'); assert.equal(h.requests[0].body.insert_after_index, 1)
  if (family === 'text') { assert.equal(selections.content_type, shape.value); assert.equal(selections.text_subtype, { text_heavy_columns: 'text_heavy_vertical', text_heavy_rows: 'text_heavy_horizontal', text_heavy_grid: 'text_heavy_grid', table: 'table' }[shape.value]) }
  else { assert.equal(selections[`${family}_subtype`], shape.value); assert.equal(selections.content_type, family === 'diagram' ? `diagram_${shape.value}` : family) }
  assert.equal(h.results.length, 1)
})
for (const type of ['hero_title', 'hero_section', 'hero_closing']) await check(`actual generated ${type} style/background payload`, async () => {
  const h = componentHarness(panelFile); h.input('Synthetic hero fixture'); choose(h, 'Slide type', type)
  const styles = one(h.render(), n => n.props?.label === 'Hero style').props.options
  assert.equal(styles.length, 3)
  const background = one(h.render(), n => n.props?.label === 'Background')
  assert.deepEqual(plain(background.props.options.map(x => x.value)), ['solid_dark', 'solid_light', 'photo_dark'])
  for (const style of styles) {
    h.input('Synthetic hero fixture'); choose(h, 'Hero style', style.value); await h.submit(); assert.equal(h.requests.at(-1).body.selections.hero_style, style.value)
  }
})
for (const [family, content] of [['text', 'text_heavy_columns'], ['chart', 'chart'], ['infographic', 'infographic'], ['diagram', 'diagram_idea_board']]) await check(`actual generated ${family}/automatic shape`, async () => {
  const h = componentHarness(panelFile); h.input('Synthetic automatic shape'); choose(h, 'Slide type', 'content_text'); choose(h, 'Content', content); choose(h, 'Layout style', 'auto'); await h.submit()
  assert.equal(h.requests[0].body.selections.content_type, content)
})
await check('actual generated automatic type keeps selection inference native', async () => {
  const h = componentHarness(panelFile); h.input('Synthetic automatic slide'); await h.submit(); assert.equal(h.requests[0].body.selections, undefined)
})
const heroStyles = { hero_title: ['editorial', 'highlight_word', 'accent_bar'], hero_section: ['number_left', 'panel_left', 'number_watermark'], hero_closing: ['thankyou', 'split_contact', 'quote'] }
const refinementCases = [
  { family: 'automatic', type: 'auto', shape: 'auto' },
  ...Object.entries(helpers.SHAPE_OPTIONS).flatMap(([family, options]) => [...options, { value: 'auto' }].map(({ value }) => ({ family, type: 'content_text', content: { text: 'text_heavy_columns', chart: 'chart', infographic: 'infographic', diagram: 'diagram_idea_board' }[family], shape: value }))),
  ...Object.entries(heroStyles).flatMap(([type, styles]) => styles.map(style => ({ family: 'hero', type, style }))),
]
assert.equal(refinementCases.length, 35)
for (const item of refinementCases) await check(`actual refine target/request ${item.type}/${item.style ?? item.shape}`, async () => {
  const h = componentHarness(panelFile); h.render({ mode: 'refine', refineTarget: { slide_id: 'synthetic-stable-slide', slide_index: 7, title: 'Synthetic original' } }); h.input('Synthetic refine; keep unrelated content')
  choose(h, 'Change structure (optional)', item.type)
  if (item.content) { choose(h, 'Content', item.content); choose(h, 'Layout style', item.shape) }
  if (item.style) choose(h, 'Hero style', item.style)
  await h.submit(); const request = h.requests[0]
  assert.equal(request.url, '/api/slides/refine'); assert.equal(request.body.slide_id, 'synthetic-stable-slide'); assert.equal(request.body.slide_index, 7); assert.equal(request.body.insert_after_index, undefined); assert.equal(h.results[0].kind, 'refine'); assert.equal(h.results[0].target_slide_id, 'synthetic-stable-slide')
})

// Acceptance race: a real option callback is queued, then the supplied old
// response settles before React repaints. Payload remains original and its
// legitimate parent callback still executes; current draft must stay intact.
for (const async of [true, false]) for (const edit of ['type', 'content', 'shape', 'image', 'hero-style', 'hero-background', 'kicker', 'Email', 'Phone', 'Website', 'LinkedIn', 'Attribution', 'web', 'deep', 'uploads', 'knowledge', 'queries', 'queries-decrease']) {
  function configure(h) {
    if (['Email', 'Phone', 'Website', 'LinkedIn', 'Attribution'].includes(edit)) { choose(h, 'Slide type', 'hero_closing'); choose(h, 'Hero style', edit === 'Attribution' ? 'quote' : 'split_contact') }
    else if (edit.startsWith('hero') || edit === 'kicker') choose(h, 'Slide type', 'hero_title')
    else if (['content', 'shape', 'image'].includes(edit)) choose(h, 'Slide type', 'content_text')
  }
  function change(h) {
    if (edit === 'type') choose(h, 'Slide type', 'hero_title', false)
    if (edit === 'content') choose(h, 'Content', 'chart', false)
    if (edit === 'shape') choose(h, 'Layout style', 'text_heavy_rows', false)
    if (edit === 'image') one(h.render(), n => n.props?.options?.some(o => o.value === 'I1') && typeof n.props.onChange === 'function').props.onChange('I1')
    if (edit === 'hero-style') choose(h, 'Hero style', 'highlight_word', false)
    if (edit === 'hero-background') one(h.render(), n => n.props?.label === 'Background').props.onValueChange('solid_light')
    if (edit === 'kicker') one(one(h.render(), n => n.type === 'label' && textOf(n).startsWith('Kicker line')), n => n.type === 'Input').props.onChange({ target: { value: 'Queued kicker' } })
    if (['Email', 'Phone', 'Website', 'LinkedIn', 'Attribution'].includes(edit)) choose(h, edit, 'Queued contact detail', false)
    if (edit === 'web') one(h.render(), n => n.props?.label === 'Web search').props.onClick()
    if (edit === 'deep') one(h.render(), n => n.props?.label === 'Deep research').props.onClick()
    if (edit === 'uploads') one(h.render(), n => n.props?.label === 'Use my uploaded files').props.onClick()
    if (edit === 'knowledge') one(h.render(), n => n.props?.label === 'Use my knowledge repo').props.onClick()
    if (edit === 'queries') one(h.render(), n => n.props?.title === 'Increase max queries').props.onClick()
    if (edit === 'queries-decrease') one(h.render(), n => n.props?.title === 'Decrease max queries').props.onClick()
  }
  async function race(source) {
    const wait = defer(), h = componentHarness(panelFile, { async, source, onRequest: () => wait.promise }); configure(h); if (edit.startsWith('queries')) one(h.render(), n => n.props?.label === 'Web search').props.onClick(); h.input('Keep the queued changed draft'); const pending = h.submit(); change(h)
    const body = h.requests[0].body
    wait.resolve(response(async ? { status: 'accepted', job_id: body.job_id, session_id: body.session_id, presentation_id: body.presentation_id, target_index: 1 } : { status: 'built', presentation_id: body.presentation_id, slide_index: 1 }))
    await pending
    assert.equal(h.requests.length, 1); assert.equal(h.results.length, 1); assert.equal(body.instruction, 'Keep the queued changed draft')
    return one(h.render(), n => n.type === 'GenerationInput').props.prompt
  }
  await check(`before witness queued ${edit} (${async ? 'async' : 'sync'}) clears newer draft`, async () => assert.equal(await race(pinned(before, panelFile)), ''))
  await check(`fixed queued ${edit} (${async ? 'async' : 'sync'}) preserves newer draft`, async () => assert.equal(await race(read(panelFile)), 'Keep the queued changed draft'))
}
// Literal default-off behavior, including native classic result/draft handling,
// stays identical to the pre-change component for the touched structure path.
for (const flag of ['', 'false', 'TRUE']) for (const async of [true, false]) await check(`classic ${flag || 'unset'} queued options behavior/payload unchanged (${async})`, async () => {
  async function run(source) {
    const wait = defer(), h = componentHarness(panelFile, { flag, async, source, onRequest: () => wait.promise }); h.input('Classic instruction'); const p = h.submit(); choose(h, 'Slide type', 'hero_title', false); const body = h.requests[0].body
    wait.resolve(response(async ? { status: 'accepted', job_id: body.job_id, target_index: 1 } : { status: 'built', presentation_id: body.presentation_id, slide_index: 1 })); await p
    return { request: h.requests[0], result: h.results[0], prompt: one(h.render(), n => n.type === 'GenerationInput').props.prompt }
  }
  assert.deepEqual(plain(await run(read(panelFile))), plain(await run(pinned(before, panelFile))))
})
console.log(`${cases} isolated component cases passed; ${failures.length} failed. No connected or save/reopen proof.`)
if (failures.length) process.exitCode = 1
