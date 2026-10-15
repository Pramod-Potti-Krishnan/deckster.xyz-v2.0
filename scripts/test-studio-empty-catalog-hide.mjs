// PASS2B G39 (FRONTEND-2): the composer template pop-up draws no empty "Deckster templates" block while there is no catalog. Flag
// NEXT_PUBLIC_STUDIO_EMPTY_CATALOG_HIDE (exact "true"), default off. The block (a disabled "No Deckster templates yet" dropdown and its explanation) sits in the
// Studio shell's dropdown pop-up only; with the flag on it is not drawn while DECKSTER_PROVIDED_TEMPLATES is empty, so "My templates" comes first.
//
// Run: node scripts/test-studio-empty-catalog-hide.mjs   (plain node: transpile + vm, no network, no browser, no env)
//   EMPTY_CATALOG_HIDE_BASE=<commit> overrides the base commit the flag-off identity is checked against (default e9503ae).
//
// Proven on the REAL components/builder/template-picker.tsx (and the real theme dropdown module, use-templates and lib/studio-composer-popups; the services
// are fixtures that refuse everything else), mounted with a small hooks runtime and inert children:
//   1. source: the file minus the three added lines is the base commit's; the flag is read once, inline, exact "true", and gates only `deckster.length === 0`;
//   2. flag off (unset, "", "false", near-misses; "true" outside the Studio shell too): every state's tree is the base commit's file's, node for node;
//   3. flag on, empty catalog: the tree is the base's with the Deckster block removed (and nothing else); "My templates", the heading, the refresh and
//      close buttons, the composer's actions and the notices are the base's; flag on with a catalog entry: the base's tree exactly, block and option included;
//   4. mutation check: every mutant of the file is killed by sections 1-3.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const BASE_COMMIT = process.env.EMPTY_CATALOG_HIDE_BASE || 'e9503ae'
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
const baseSource = rel => execFileSync('git', ['show', `${BASE_COMMIT}:${rel}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
let checks = 0
let counting = true
const count = fn => (...args) => { if (counting) checks++; return fn(...args) }
const eq = count(assert.equal), ok = count(assert.ok), match = count(assert.match)
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
const refuse = () => { throw new Error('empty-catalog-hide fixture refuses services and writes') }

const PICKER = 'components/builder/template-picker.tsx', DROPDOWN = 'components/theme-dropdown-picker.tsx', POPUPS = 'lib/studio-composer-popups.ts'
const SOURCE = read(PICKER), BASE = baseSource(PICKER)
const FLAG = 'NEXT_PUBLIC_STUDIO_EMPTY_CATALOG_HIDE', SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const compile = (source, fileName) => ts.transpileModule(source, { fileName, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText

// ---------------------------------------------------------------- 1. source
const COMMENT = `    // PASS2B G39 (NEXT_PUBLIC_STUDIO_EMPTY_CATALOG_HIDE, default off): no Deckster catalog exists yet, so with the flag on the empty "Deckster templates" block
    // (a disabled dropdown and its explanation) is not drawn until the list has an entry. Off, or with a catalog, the block is the base's.\n`
const DECISION = "    const hideEmptyDeckster = process.env.NEXT_PUBLIC_STUDIO_EMPTY_CATALOG_HIDE === 'true' && deckster.length === 0\n"
const FIELD = '    const decksterField = hideEmptyDeckster ? null : <div className="stcd-field" data-studio-template-dd="deckster">\n'
const FIELD_BASE = '    const decksterField = <div className="stcd-field" data-studio-template-dd="deckster">\n'
function proveSource(source, label = 'source') {
  eq(source.split(COMMENT + DECISION + FIELD).length - 1, 1, `${label}: the decision and the field, once, in this order`)
  eq((source.match(/process\.env\.NEXT_PUBLIC_STUDIO_EMPTY_CATALOG_HIDE/g) ?? []).length, 1, `${label}: the flag is read once, inline`)
  eq((source.match(/hideEmptyDeckster/g) ?? []).length, 2, `${label}: the decision is used once, by the field`)
  eq((source.match(/\{decksterField\}/g) ?? []).length, 2, `${label}: the field is drawn in the two dropdown branches, as in the base`)
  eq(source.replace(COMMENT + DECISION + FIELD, FIELD_BASE), BASE, `${label}: without the three added lines the file is ${BASE_COMMIT}'s`)
}
proveSource(SOURCE)
match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_EMPTY_CATALOG_HIDE="false"$/m, 'documented in .env.example, default off')

// ---------------------------------------------------------------- 2. the pop-up, mounted
const transpiled = new Map()
function createLoader({ env, stubs, globals, overrides }) {
  const cache = new Map()
  const resolve = (spec, from) => {
    const base = spec.startsWith('@/') ? path.join(repoRoot, spec.slice(2)) : path.resolve(path.dirname(from), spec)
    for (const suffix of ['.ts', '.tsx']) if (fs.existsSync(base + suffix)) return base + suffix
    return null
  }
  const requireFor = (spec, from) => {
    if (spec in stubs) return stubs[spec]
    if (spec.endsWith('.css')) return {}
    if (spec.startsWith('@/') || spec.startsWith('.')) { const file = resolve(spec, from); assert.ok(file, `unresolved import ${spec}`); return run(file) }
    throw new Error(`unexpected import ${spec} in ${path.relative(repoRoot, from)}`)
  }
  function run(file) {
    if (cache.has(file)) return cache.get(file)
    const mod = { exports: {} }
    cache.set(file, mod.exports)
    const rel = path.relative(repoRoot, file), source = overrides[rel] ?? fs.readFileSync(file, 'utf8'), key = `${rel}\0${sha(source)}`
    if (!transpiled.has(key)) transpiled.set(key, compile(source, file))
    vm.runInNewContext(transpiled.get(key), { module: mod, exports: mod.exports, process: { env }, console, ...globals, require: spec => requireFor(spec, file) })
    cache.set(file, mod.exports)
    return mod.exports
  }
  return { load: rel => run(path.join(repoRoot, rel)) }
}
const jsx = (type, props, key) => ({ type, props: props ?? {}, key })
const jsxRuntime = { jsx, jsxs: jsx, Fragment: 'Fragment' }
function createRuntime() {
  const cells = []
  let cursor = 0, dirty = false, inert = false
  const effects = []
  const depsChanged = (old, deps) => !old || !deps || deps.some((value, index) => !Object.is(value, old.deps?.[index]))
  const react = {
    useState(init) {
      if (inert) return [typeof init === 'function' ? init() : init, () => {}]
      const i = cursor++
      cells[i] ??= { value: typeof init === 'function' ? init() : init }
      const cell = cells[i]
      return [cell.value, value => { const next = typeof value === 'function' ? value(cell.value) : value; if (!Object.is(next, cell.value)) { cell.value = next; dirty = true } }]
    },
    useRef(init) { if (inert) return { current: init }; const i = cursor++; return cells[i] ??= { current: init } },
    useMemo(fn, deps) { if (inert) return fn(); const i = cursor++, old = cells[i]; if (depsChanged(old, deps)) cells[i] = { deps, value: fn() }; return cells[i].value },
    useCallback(fn, deps) { if (inert) return fn; const i = cursor++, old = cells[i]; if (depsChanged(old, deps)) cells[i] = { deps, value: fn }; return cells[i].value },
    useEffect(fn, deps) {
      if (inert) return
      const i = cursor++, old = cells[i]
      if (depsChanged(old, deps)) { cells[i] = { deps, cleanup: old?.cleanup }; effects.push(() => { cells[i].cleanup?.(); cells[i].cleanup = fn() }) }
    },
    useLayoutEffect() {}, useSyncExternalStore: (_subscribe, get) => get(), useId: () => 'local-id', Fragment: 'Fragment',
  }
  react.default = react
  function expand(node) {
    if (Array.isArray(node)) return node.map(expand)
    if (!node || typeof node !== 'object') return node
    if (typeof node.type === 'function') return expand(node.type(node.props))
    const props = {}
    for (const [key, value] of Object.entries(node.props ?? {})) props[key] = key === 'children' ? expand(value) : value
    return { type: node.type, props, key: node.key }
  }
  return {
    react,
    render(Component, props) {
      let tree
      for (let attempt = 0; attempt < 14; attempt++) {
        cursor = 0; dirty = false; inert = false
        const root = Component(props)
        inert = true
        tree = expand(root)
        inert = false
        while (effects.length) effects.shift()()
        if (!dirty) return tree
      }
      throw new Error('render did not settle')
    },
  }
}
const flat = node => Array.isArray(node) ? node.flatMap(flat) : !node || typeof node !== 'object' ? [] : [node, ...flat(node.props?.children)]
const text = node => Array.isArray(node) ? node.map(text).join('') : node == null || typeof node === 'boolean' ? '' : typeof node === 'object' ? text(node.props?.children) : String(node)
const norm = value => JSON.stringify(value, (key, item) => typeof item === 'function' ? '[fn]' : item)
async function drain(runtime, Component, props, turns = 6) {
  let tree = runtime.render(Component, props())
  for (let i = 0; i < turns; i++) { await tick(); tree = runtime.render(Component, props()) }
  return tree
}
// The tree with the Deckster block replaced by null (what `hideEmptyDeckster ? null : <div>` leaves in the children array).
const withoutDeckster = node => Array.isArray(node) ? node.map(withoutDeckster) : !node || typeof node !== 'object' ? node
  : node.props?.['data-studio-template-dd'] === 'deckster' ? null : { ...node, props: { ...node.props, ...(node.props?.children === undefined ? {} : { children: withoutDeckster(node.props.children) }) } }

const OWNER = 'local-owner', LAYOUT = 'https://layout-builder-v75-uat.up.railway.app'
const COMPOSER_TEMPLATES = [
  { id: 'cmp-northwind', name: 'Northwind QBR', slide_count: 30, stage_template_summary: { slide_count: 30, schema_version: 'composer-template-v1' } },
  { id: 'cmp-j1', name: 'Rollout plan', slide_count: 6, stage_template_summary: { slide_count: 6 } },
]
const SAVED_TEMPLATES = [
  { id: 'tp-1', name: 'Quarterly review', description: 'Eight-slide QBR', slide_count: 8, blueprint_generation_method: 'llm', blueprint_enrichment_status: 'complete', template_purity_status: 'clean' },
  { id: 'tp-2', name: 'Product launch', description: null, slide_count: 12, blueprint_generation_method: 'llm', blueprint_enrichment_status: 'complete', template_purity_status: 'clean' },
]
const CATALOG = [{ id: 'dk-1', name: 'Board update', description: 'A ready-made board update.', slideCount: 8 }]
const EXPLANATION = 'Deckster has no ready-made templates yet. Templates you upload are listed under My templates.'
const COMPOSER_ENV = { NEXT_PUBLIC_LAYOUT_SERVICE_URL: LAYOUT, NEXT_PUBLIC_COMPOSER_STAGE1B_DITTO_ENABLED: 'true', NEXT_PUBLIC_COMPOSER_STAGE1B_NEW_TOPIC_ENABLED: 'true' }
const envOf = (shell, value) => ({ ...COMPOSER_ENV, ...(shell === undefined ? {} : { [SHELL]: shell }), ...(value === undefined ? {} : { [FLAG]: value }) })

async function mount({ source, env, catalog, library = COMPOSER_TEMPLATES }) {
  const runtime = createRuntime()
  const answer = (status, data) => ({ ok: status < 400, status, json: async () => data })
  const globals = {
    fetch: async (url, init = {}) => String(url).endsWith('/api/composer-library/templates') && init.method === 'GET' ? answer(200, { templates: library }) : answer(404, { error: 'Not found' }),
    URL, AbortController, DOMException, Error, setTimeout: callback => { setTimeout(callback, 0); return 1 }, clearTimeout() {}, crypto: { randomUUID: () => 'fresh-session-0001' },
  }
  const stubs = {
    react: runtime.react, 'react/jsx-runtime': jsxRuntime, 'lucide-react': new Proxy({}, { get: (_, name) => name === '__esModule' ? false : `Icon:${String(name)}` }),
    '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') }, 'next/link': { default: 'a' },
    '@/components/ui/dropdown-menu': { DropdownMenu: 'DropdownMenu', DropdownMenuContent: 'DropdownMenuContent', DropdownMenuTrigger: 'DropdownMenuTrigger', DropdownMenuItem: 'DropdownMenuItem', DropdownMenuLabel: 'DropdownMenuLabel', DropdownMenuSeparator: 'DropdownMenuSeparator' },
    '@/hooks/use-toast': { useToast: () => ({ toast() {} }) }, './studio-composer-hint': { StudioComposerHint: ({ children }) => children },
    '@/lib/theme-builder': { isValidThemeHex: () => true }, '@/lib/theme-fonts': { ensureThemeFontStylesheet() {}, themeFontCss: () => '', themeFontFields: () => ({}) },
  }
  const loader = createLoader({ env, stubs, globals, overrides: { [PICKER]: source } })
  stubs['@/lib/studio-composer-popups'] = { ...loader.load(POPUPS), DECKSTER_PROVIDED_TEMPLATES: catalog }
  const real = loader.load('hooks/use-templates.ts')
  stubs['@/hooks/use-templates'] = { ...real, useTemplates: () => ({ loading: false, listTemplates: async () => ({ templates: SAVED_TEMPLATES, count: SAVED_TEMPLATES.length }), reoptimizeTemplate: refuse, watchTemplateStatus: () => () => {} }) }
  stubs['@/components/theme-dropdown-picker'] = { ...loader.load(DROPDOWN), ThemeDropdownPicker: props => jsx('ThemeDropdownPicker', props) }
  const mod = loader.load(PICKER)
  return { runtime, Body: mod.ComposerTemplatePopupBody, Content: mod.TemplatePickerContent }
}
const popup = (over = {}) => () => ({ onSelect() {}, open: true, mode: 'generation', showSavedTemplates: true, selectionLocked: false, selectedTemplateId: null, onClose() {}, onOpenLibrary() {}, onComposerAction() {}, composerUserId: OWNER, ...over })
const saved = (over = {}, locked = false) => () => ({ onSelect() {}, isOpen: true, mode: 'generation', label: 'Reuse a template', preferredTemplateId: null, standalone: false, ...over,
  dropdowns: { selectedTemplateId: 'tp-2', locked, savedTemplates: true, onClose() {}, onNewTemplate() {} } })
const classic = () => ({ onSelect() {}, isOpen: true, mode: 'generation', label: 'Reuse a template', preferredTemplateId: 'tp-1', standalone: true })
// [name, component, props, library, dropdown pop-up (the Studio shell draws one)?]
const STATES = [
  ['composer pop-up', 'Body', popup({ showSavedTemplates: false })],
  ['composer pop-up with saved templates', 'Body', popup()],
  ['composer pop-up, locked deck', 'Body', popup({ selectionLocked: true })],
  ['composer pop-up, signed out', 'Body', popup({ composerUserId: null })],
  ['composer pop-up, empty library', 'Body', popup(), []],
  ['composer pop-up, one template chosen', 'Body', popup(), COMPOSER_TEMPLATES, 'choose'],
  ['saved-templates dropdowns', 'Content', saved()],
  ['saved-templates dropdowns, locked', 'Content', saved({}, true)],
  ['classic template list', 'Content', classic, COMPOSER_TEMPLATES, 'classic'],
]
const cacheOfBase = new Map()
async function drive(source, env, catalog, [, which, props, library, mode]) {
  const world = await mount({ source, env, catalog, library })
  const Component = world[which]
  const tree = await drain(world.runtime, Component, props, 8)
  if (mode !== 'choose') return tree
  const mine = flat(tree).find(n => n.type === 'ThemeDropdownPicker' && n.props.copy.label === 'My templates')
  mine.props.onSelect(mine.props.options[0].id)
  return drain(world.runtime, Component, props, 3)
}
const baseTree = async (state, catalog, shell) => { const key = `${state[0]}|${catalog.length}|${shell}`; if (!cacheOfBase.has(key)) cacheOfBase.set(key, await drive(BASE, envOf(shell), catalog, state)); return cacheOfBase.get(key) }
const OFF_VALUES = [undefined, '', 'false', 'FALSE', 'TRUE', 'True', '1', 'yes', ' true', 'true ', 'on']
const deckster = tree => flat(tree).filter(n => n.props?.['data-studio-template-dd'] === 'deckster')
async function proveTrees(source, label = 'pop-up') {
  for (const state of STATES) {
    const [name, , , , mode] = state, shell = mode === 'classic' ? undefined : 'true'
    for (const catalog of [[], CATALOG]) {
      const tag = `${label}: ${name}, ${catalog.length ? 'with a catalog' : 'no catalog'}`
      const base = await baseTree(state, catalog, shell)
      // flag off: the base's tree, whatever the value (and "true" outside the shell is off too)
      for (const value of OFF_VALUES) eq(norm(await drive(source, envOf(shell, value), catalog, state)), norm(base), `${tag}: flag ${JSON.stringify(value)} is the base`)
      const on = await drive(source, envOf(shell, 'true'), catalog, state)
      if (mode === 'classic') { eq(norm(on), norm(base), `${tag}: the classic list ignores the flag`); eq(deckster(on).length, 0, `${tag}: and has no Deckster block`); continue }
      eq(deckster(base).length, 1, `${tag}: the base draws one Deckster block`)
      if (catalog.length === 0) {
        const [block] = deckster(base), dropdown = flat(block).find(n => n.type === 'ThemeDropdownPicker')
        eq(dropdown.props.copy.label, 'Deckster templates', `${tag}: the base block is the Deckster dropdown`); eq(dropdown.props.copy.placeholder, 'No Deckster templates yet', `${tag}: with its placeholder`)
        eq(dropdown.props.locked, true, `${tag}: disabled`); eq(text(flat(block).find(n => n.props?.['data-studio-template-empty'] === 'deckster')), EXPLANATION, `${tag}: with its explanation`)
        eq(deckster(on).length, 0, `${tag}: on, no Deckster block`); eq(flat(on).some(n => n.props?.['data-studio-template-empty'] === 'deckster'), false, `${tag}: on, no explanation`)
        eq(flat(on).some(n => n.type === 'ThemeDropdownPicker' && n.props.copy.label === 'Deckster templates'), false, `${tag}: on, no Deckster dropdown`)
        eq(norm(on), norm(withoutDeckster(base)), `${tag}: on is the base without the Deckster block, and nothing else`)
        const mine = flat(on).filter(n => n.type === 'ThemeDropdownPicker'), baseMine = flat(base).filter(n => n.type === 'ThemeDropdownPicker' && n.props.copy.label === 'My templates')
        eq(mine.length, 1, `${tag}: on, one dropdown left`); eq(mine[0].props.copy.label, 'My templates', `${tag}: My templates`); eq(norm(mine[0].props), norm(baseMine[0].props), `${tag}: My templates is the base's`)
        eq(text(flat(on).find(n => n.type === 'strong')), 'Reuse a template', `${tag}: heading kept`)
        ok(flat(on).some(n => /^Refresh (saved )?templates$/.test(n.props?.['aria-label'] ?? '')), `${tag}: refresh kept`); ok(flat(on).some(n => n.props?.['aria-label'] === 'Close template options'), `${tag}: close kept`)
      } else {
        eq(norm(on), norm(base), `${tag}: on keeps the base's tree, block and entry included`)
        const dropdown = flat(deckster(on)[0]).find(n => n.type === 'ThemeDropdownPicker')
        eq(dropdown.props.options.length, 1, `${tag}: the entry is listed`); eq(dropdown.props.locked, name.includes('locked'), `${tag}: usable unless the deck is locked`); eq(dropdown.props.copy.label, 'Deckster templates', `${tag}: the Deckster dropdown`)
        eq(flat(on).some(n => n.props?.['data-studio-template-empty'] === 'deckster'), false, `${tag}: no empty-state line`)
      }
    }
  }
}
await proveTrees(SOURCE)

// ---------------------------------------------------------------- 4. mutation check
const MUTANTS = [
  ['flag read loosely', "NEXT_PUBLIC_STUDIO_EMPTY_CATALOG_HIDE === 'true' &&", "NEXT_PUBLIC_STUDIO_EMPTY_CATALOG_HIDE !== 'false' &&"],
  ['flag read as truthy', "process.env.NEXT_PUBLIC_STUDIO_EMPTY_CATALOG_HIDE === 'true' &&", 'process.env.NEXT_PUBLIC_STUDIO_EMPTY_CATALOG_HIDE &&'],
  ['flag name typo', 'process.env.NEXT_PUBLIC_STUDIO_EMPTY_CATALOG_HIDE ===', 'process.env.NEXT_PUBLIC_STUDIO_EMPTY_CATALOG_HID ==='],
  ['flag ignored', "process.env.NEXT_PUBLIC_STUDIO_EMPTY_CATALOG_HIDE === 'true' && deckster.length === 0", 'deckster.length === 0'],
  ['always hidden', "process.env.NEXT_PUBLIC_STUDIO_EMPTY_CATALOG_HIDE === 'true' && deckster.length === 0", "process.env.NEXT_PUBLIC_STUDIO_EMPTY_CATALOG_HIDE === 'true'"],
  ['never hidden', "process.env.NEXT_PUBLIC_STUDIO_EMPTY_CATALOG_HIDE === 'true' && deckster.length === 0", 'false'],
  ['hidden with a catalog only', 'HIDE === \'true\' && deckster.length === 0', "HIDE === 'true' && deckster.length > 0"],
  ['inverted', 'hideEmptyDeckster ? null : <div', '!hideEmptyDeckster ? null : <div'],
  ['block kept, explanation dropped', 'hideEmptyDeckster ? null : <div', '<div'],
  ['block drawn as an empty element', 'hideEmptyDeckster ? null : <div', 'hideEmptyDeckster ? <div className="stcd-field" data-studio-template-dd="deckster" /> : <div'],
  ['My templates note hidden with it', '{myEmpty && <p className="stcd-empty" role="status" data-studio-template-empty="mine">', '{myEmpty && !hideEmptyDeckster && <p className="stcd-empty" role="status" data-studio-template-empty="mine">'],
  ['saved-templates note dropped', '{myEmpty && <p className="stcd-empty" data-studio-template-empty="mine">', '{false && <p className="stcd-empty" data-studio-template-empty="mine">'],
  ['explanation changed', "'Deckster has no ready-made templates yet. Templates you upload are listed under My templates.'", "'Deckster has no ready-made templates yet.'"],
  ['placeholder changed', "placeholder: 'No Deckster templates yet' }", "placeholder: 'No templates yet' }"],
  ['dropdown enabled when empty', 'locked={dropdowns.locked || deckster.length === 0} onSelect={choose}', 'locked={dropdowns.locked} onSelect={choose}'],
  ['Deckster label changed', "label: 'Deckster templates', help: null", "label: 'Deckster catalog', help: null"],
  ['heading changed', '<strong>{label}</strong>', '<strong>{label}!</strong>'],
  ['close button relabelled', 'aria-label="Close template options"', 'aria-label="Close"'],
]
let killed = 0
counting = false
for (const [name, from, to] of MUTANTS) {
  assert.ok(SOURCE.includes(from), `mutant "${name}": the text it replaces exists`)
  const mutated = SOURCE.replace(from, () => to)
  assert.notEqual(mutated, SOURCE, `mutant "${name}" changes the source`)
  let survived = false
  try { proveSource(mutated, name); await proveTrees(mutated, name); survived = true } catch (error) { assert.equal(error?.code, 'ERR_ASSERTION', `mutant "${name}" must be killed by an assertion, not a crash: ${error}`); killed++ }
  assert.ok(!survived, `mutant survived: ${name}`)
}
counting = true
eq(killed, MUTANTS.length)

console.log(`Studio empty-catalog hide (G39): ${checks} checks passed, ${killed}/${MUTANTS.length} mutants killed; no network.`)
