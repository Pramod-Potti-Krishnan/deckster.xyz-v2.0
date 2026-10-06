import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { readAtlasBaseline } from './atlas-witness-baseline.mjs'
import ts from 'typescript'
import postcss from 'postcss'

const path = 'components/studio-libraries/themes-workspace.tsx'
const source = fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const original = readAtlasBaseline(`af16640:${path}`)
// Only the approved generic handoff row changes the support subtree. Require
// its exact source before normalizing back to the historical reading anchor;
// all description/metadata/unknown-base text stays in the equality witness.
assert.equal(source.split('if (!mounted.current || !accountIsCurrent()) return; ').length - 1, 3, 'Only reviewed patch/text owner guards exist')
const genericText = 'Use the theme picker in Studio to select a saved theme for an eligible presentation.'
const genericRow = `<div className="sl-workflow-link"><div><strong>Continue in Studio</strong><p>${genericText}</p></div><StudioWorkflowAction action="theme" canStart={canContinueInStudio} disabled={!accountReady}>Back to {process.env.NEXT_PUBLIC_STUDIO_V4_LABELS === 'true' ? 'Studio' : 'builder'}</StudioWorkflowAction><ArrowRight size={14} aria-hidden="true" /></div>`
assert.equal(source.split(genericRow).length, 2, 'Exact reviewed generic row, no broad support exception')
const restored = source.replace(genericRow, `<StudioWorkflowLink>${genericText}</StudioWorkflowLink>`).replace('useEffect, useId, useLayoutEffect, useRef', 'useEffect, useRef')
  .replace("import { keepStudioScrollFocusVisible } from '@/lib/studio-inspector-focus'\n", '')
  .replace('  const colorRef = useRef<HTMLDivElement | null>(null)\n', '')
  .replace(/  useLayoutEffect\(\(\) => \{[\s\S]*?  \}, \[studioShell, value, invalid\]\)\n/, '')
  .replace(/ ref=\{studioShell \? colorRef : undefined\} onFocusCapture=\{studioShell \? event => revealStudioThemeColor\(event\.target, event\.currentTarget, invalid\) : undefined\}/, '')
  .replace(/function revealStudioThemeColor\(target: EventTarget \| null, group: HTMLElement \| null, invalid: boolean\) \{[\s\S]*?\n\}\n\n/, '')
  .replace("  const warningId = useId()\n  const studioShell = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'\n", '')
  .replace(/ (?:aria-describedby|data-studio-theme-color-hex|data-studio-theme-color-group|id|data-studio-theme-color-warning|role)=\{studioShell(?: && invalid)? \? [^}]+ : undefined\}/g, '')
  .replace(/ (?:data-studio-theme-support-region|tabIndex|role|aria-label)=\{process\.env\.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' \? [^}]+ : undefined\}/g, '')
// The Atlas receipt/lifetime batch deliberately changes save/standard handlers.
// Preserve the historical color and full support-reading witnesses exactly.
const parse = value => ts.createSourceFile('themes.tsx', value, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const findNode = (node, predicate) => { if (predicate(node)) return node; let found; ts.forEachChild(node, child => { if (!found) found = findNode(child, predicate) }); return found }
const restoredAst = parse(restored), originalAst = parse(original), printer = ts.createPrinter({ removeComments: true })
for (const [label, predicate] of [
  ['ColorField', node => ts.isFunctionDeclaration(node) && node.name?.text === 'ColorField'],
  ['complete support reading', node => ts.isJsxElement(node) && node.openingElement.attributes.properties.some(a => ts.isJsxAttribute(a) && a.name.getText() === 'className' && a.initializer?.getText() === '\"sl-theme-support-content\"')],
]) {
  const current = findNode(restoredAst, predicate), prior = findNode(originalAst, predicate)
  assert(current && prior, label)
  assert.equal(printer.printNode(ts.EmitHint.Unspecified, current, restoredAst), printer.printNode(ts.EmitHint.Unspecified, prior, originalAst), label + ' remains exact after reviewed reading additions are removed')
}
const css = fs.readFileSync(new URL('../components/studio-libraries/libraries.css', import.meta.url), 'utf8')
postcss.parse(css)
assert(css.includes('[data-studio-theme-support-region="true"]:focus-visible'))
assert(css.includes('outline-offset: -2px'))
let services = 0, serial = 0
const node = (type, props) => ({ type, props: props || {} })
class LocalHTMLElement {
  constructor({ viewport = null, rect = null } = {}) { Object.assign(this, { viewport, rect }); this.scrollTop = 0 }
  closest() { return this.viewport }
  getBoundingClientRect() { const scroll = this.viewport?.scrollTop || 0; return { ...this.rect, top: this.rect.top - scroll, bottom: this.rect.bottom - scroll } }
}
function runtime(text, flag, initial = [], dom, realFocus = false) {
  const exports = {}, state = [...initial], effects = [], layouts = [], refs = [], reveals = [], frames = []; let cursor = 0, refCursor = 0
  const focusModule = { exports: {} }
  if (realFocus) vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../lib/studio-inspector-focus.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports: focusModule.exports, module: focusModule, HTMLElement: LocalHTMLElement })
  vm.runInNewContext(ts.transpileModule(`${text}\nexport { ColorField as LocalColorField }`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, module: { exports }, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: flag } },
    require(id) {
      if (id === 'react') return {
        useState(init) { const i = cursor++; if (!(i in state)) state[i] = typeof init === 'function' ? init() : init; return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value }] },
        useId() { const i = cursor++; if (!(i in state)) state[i] = `local-theme-color-${++serial}`; return state[i] }, useRef(value) { const i = refCursor++; return refs[i] ||= { current: value } }, useCallback(fn) { return fn }, useEffect(fn, deps) { effects.push({ fn, deps }) }, useLayoutEffect(fn, deps) { layouts.push({ fn, deps }) },
      }
      if (id === 'react/jsx-runtime') return { jsx: node, jsxs: node, Fragment: 'Fragment' }
      if (id === '@/lib/studio-inspector-focus') return { keepStudioScrollFocusVisible(target, selector) { reveals.push({ target, selector }); if (realFocus) focusModule.exports.keepStudioScrollFocusVisible(target, selector) } }
      if (id === '@/hooks/use-theme-profiles') return { useThemeProfiles: () => Object.fromEntries(['listThemes', 'saveTheme', 'setStandardTheme', 'clearStandardTheme'].map(key => [key, () => { services++; throw new Error('No services permitted') }])) }
      if (id === '@/lib/theme-builder') return {
        FALLBACK_THEME_PRESETS: [{ preset_id: 'minimal', name: 'Minimal' }],
        isValidThemeHex: value => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value),
        normalizeThemePresetId: value => value, isCanonicalThemePresetId: value => value === 'minimal',
        selectCanonicalThemePreset() { throw new Error('No preset change in this reading test') },
      }
      if (id === './theme-preview') return {
        THEME_TOKENS: [['primary', 'Primary']], ThemePreview: 'ThemePreview', ThemeSwatches: 'ThemeSwatches',
        themePreviewPalette: () => ({ primary: '#223344', secondary: '#334455', tertiary: '#445566', neutral: '#556677' }),
      }
      if (id === './themes-fidelity.css') return {}
      if (id === './library-controls') return new Proxy({}, { get: (_target, key) => key === 'libraryDate' ? value => value : key })
      // Historical native/classic reading fixture deliberately has no provider;
      // live account ownership is covered by test-atlas-themes-account-boundary.
      if (id === './library-account-boundary') return { useStudioLibraryAccount: () => null, libraryAccountIsCurrent: () => { throw new Error('Null context must bypass guard') }, libraryAccountCanStart: () => { throw new Error('Null context must bypass guard') } }
      if (id === './studio-workflow-action') return { StudioWorkflowAction: 'StudioWorkflowAction' }
      if (id === 'lucide-react') return new Proxy({}, { get: (_target, key) => key })
      throw new Error(`Unexpected runtime dependency ${id}`)
    }, console, document: dom, HTMLElement: LocalHTMLElement, requestAnimationFrame(fn) { frames.push(fn); return frames.length }, cancelAnimationFrame() {},
    fetch() { services++; throw new Error('No requests permitted') },
  })
  return { effects, layouts, refs, reveals, frames, render(name, props) { cursor = 0; refCursor = 0; effects.length = 0; layouts.length = 0; return exports[name](props) } }
}
function all(tree, predicate, found = []) {
  if (!tree || typeof tree !== 'object') return found
  if (Array.isArray(tree)) { tree.forEach(value => all(value, predicate, found)); return found }
  if (predicate(tree)) found.push(tree)
  all(tree.props.children, predicate, found)
  return found
}
const find = (tree, predicate) => { const matches = all(tree, predicate); assert.equal(matches.length, 1); return matches[0] }
function canonical(tree) {
  if (tree == null || typeof tree === 'boolean') return []
  if (typeof tree !== 'object') return [String(tree)]
  if (Array.isArray(tree)) return tree.flatMap(canonical)
  if (tree.type === 'Fragment') return canonical(tree.props.children)
  // The actual shared identity test proves the stable themes ID preserves the
  // complete native workspace JSX. This historical stub does not render that
  // component; normalize only its explicit, verified identity prop.
  if (tree.type === 'LibraryWorkspace' && tree.props.workspaceId === 'themes') {
    const { workspaceId, ...props } = tree.props
    return canonical({ ...tree, props })
  }
  // Normalize only the separately tested generic handoff row for historical
  // classic layout parity. Validate its exact label/body/action first.
  if (tree.type === 'div' && tree.props.className === 'sl-workflow-link') {
    const children = tree.props.children
    assert.equal(children[0].props.children[0].props.children, 'Continue in Studio')
    assert.equal(children[0].props.children[1].props.children, genericText)
    assert.equal(children[1].type, 'StudioWorkflowAction'); assert.equal(children[1].props.action, 'theme')
    assert.equal(children[1].props.itemId, undefined); assert.equal(children[1].props.disabled, false)
    assert.equal(children[1].props.canStart(), true); assert.equal(children[2].type, 'ArrowRight')
    return canonical({ type: 'StudioWorkflowLink', props: { children: genericText } })
  }
  return [{ type: typeof tree.type === 'function' ? tree.type.name : tree.type, props: Object.fromEntries(Object.entries(tree.props).filter(([key, value]) => key !== 'children' && value !== undefined && !(tree.type === 'StudioWorkflowAction' && key === 'canStart')).map(([key, value]) => [key, typeof value === 'function' ? value.toString().replace(/\s+/g, ' ').replace('if (!mounted.current || !accountIsCurrent()) return; ', '') : value])), children: canonical(tree.props.children) }]
}
let cases = 0
const ids = new Set()
for (const flag of ['true', 'false', undefined, '1']) for (const value of [undefined, '#AABBCC', 'invalid']) {
  const changed = [], reset = () => {}
  const props = { label: 'Primary', value, fallback: '#223344', onChange: next => changed.push(next), onReset: reset }
  const fieldRuntime = runtime(source, flag)
  const tree = fieldRuntime.render('LocalColorField', props)
  const hex = find(tree, item => item.type === 'input' && item.props['aria-label'] === 'Primary hex value')
  const invalid = value === 'invalid'
  assert.equal(hex.props.value, value ?? ''); assert.equal(hex.props['aria-invalid'], invalid)
  if (flag === 'true' && invalid) {
    const error = find(tree, item => item.props['data-studio-theme-color-warning'])
    assert.equal(error.props.id, hex.props['aria-describedby']); assert.equal(error.props.role, 'alert')
    assert(!ids.has(error.props.id)); ids.add(error.props.id)
    assert.equal(find(fieldRuntime.render('LocalColorField', props), item => item.props['data-studio-theme-color-warning']).props.id, error.props.id, 'Warning association stays stable while the field rerenders')
    // A second identically named native field must not duplicate its warning id.
    const duplicate = runtime(source, flag).render('LocalColorField', props)
    const second = find(duplicate, item => item.props['data-studio-theme-color-warning'])
    assert.notEqual(second.props.id, error.props.id)
  } else assert.equal(hex.props['aria-describedby'], undefined)
  if (flag !== 'true') assert.equal(JSON.stringify(canonical(tree)), JSON.stringify(canonical(runtime(original, flag).render('LocalColorField', props))))
  hex.props.onChange({ target: { value: '#556677' } }); assert.deepEqual(changed, ['#556677'])
  if (value !== undefined) assert.equal(find(tree, item => item.type === 'button').props.onClick, reset)
  cases++
}
const theme = { id: 'local-theme', name: 'Supplied theme', description: `${'Full source-backed description '.repeat(80)}[END OF DESCRIPTION]`, theme_payload: { mode: 'custom', preset_id: 'unknown_saved', primary_hex: '#223344', color_overrides: { unknown_token: '#556677' } }, created_at: '2026-10-01', updated_at: '2026-10-02', usage_count: 7 }
for (const flag of ['true', 'false', undefined, '1']) for (const mode of ['create', 'library']) {
  const state = [mode, [theme], theme.id, '', 'all', false, '', null, '', '', '', '', theme.theme_payload, false, 'title', false, null]
  const run = runtime(source, flag, state), tree = run.render('ThemesWorkspace', {})
  assert.equal(run.effects.length, 3, 'Existing lifetime/dirty effects plus separate same-owner readiness effect')
  const region = find(tree, item => item.props.className === 'sl-theme-support-content')
  assert.equal(region.props.tabIndex, flag === 'true' ? 0 : undefined)
  assert.equal(region.props.role, flag === 'true' ? 'region' : undefined)
  assert.equal(region.props['aria-label'], flag === 'true' ? 'Theme details and use' : undefined)
  if (mode === 'library') {
    assert.equal(find(region, item => item.type === 'ReadValue' && item.props.label === 'Description').props.value, theme.description)
    assert.equal(find(region, item => item.type === 'MetadataDisclosure').props.value, theme.theme_payload)
  }
  if (flag !== 'true') assert.equal(JSON.stringify(canonical(tree)), JSON.stringify(canonical(runtime(original, flag, state).render('ThemesWorkspace', {}))))
  cases++
}
let revealCases = 0
for (const flag of ['true', 'false', undefined, '1']) {
  const target = {}, dom = { activeElement: target }
  const run = runtime(source, flag, [], dom)
  const props = { label: 'Primary', value: '#bad', fallback: '#223344', onChange() {}, onReset() {} }
  const tree = run.render('LocalColorField', props)
  if (flag === 'true') {
    const group = { contains: value => value === target }
    tree.props.ref.current = group
    tree.props.onFocusCapture({ target, currentTarget: group })
    assert.equal(run.reveals.length, 2); assert.equal(run.reveals[0].target, group); assert.equal(run.reveals[1].target, target); assert.equal(run.reveals[0].selector, '.sl-form-scroll')
    const cleanup = run.layouts[0].fn(); assert.equal(run.reveals.length, 4)
    run.frames[0](); assert.equal(run.reveals.length, 6)
    dom.activeElement = {}; run.frames[0](); assert.equal(run.reveals.length, 6, 'An unrelated active field is never scrolled')
    assert.equal(typeof cleanup, 'function'); cleanup()
    assert.equal(JSON.stringify(run.layouts[0].deps), JSON.stringify([true, '#bad', true]))
    run.render('LocalColorField', { ...props, value: undefined })
    assert.equal(JSON.stringify(run.layouts[0].deps), JSON.stringify([true, null, false]), 'Native Reset change triggers a new layout check without changing validation')
  } else {
    assert.equal(tree.props.onFocusCapture, undefined); assert.equal(tree.props.ref, undefined)
    assert.equal(run.layouts[0].fn(), undefined); assert.equal(run.reveals.length, 0); assert.equal(run.frames.length, 0)
  }
  revealCases++
}
let groupCases = 0
for (const tall of [false, true]) {
  const viewport = new LocalHTMLElement({ rect: { top: 210, bottom: 491, height: 281 } })
  const group = new LocalHTMLElement({ viewport, rect: tall ? { top: 100, bottom: 550, height: 450 } : { top: 430, bottom: 552, height: 122 } })
  const target = new LocalHTMLElement({ viewport, rect: { top: 464, bottom: 497, height: 33 } })
  const warning = new LocalHTMLElement({ viewport, rect: { top: 516, bottom: 548, height: 32 } })
  group.contains = value => value === target
  const dom = { activeElement: target }
  const run = runtime(source, 'true', [], dom, true)
  const props = { label: 'Primary', value: '#bad', fallback: '#223344', onChange() {}, onReset() {} }
  const tree = run.render('LocalColorField', props); tree.props.ref.current = group
  tree.props.onFocusCapture({ target, currentTarget: group })
  assert.equal(run.reveals.length, 2); assert.equal(run.reveals[0].target, group); assert.equal(run.reveals[1].target, target)
  assert.equal(viewport.scrollTop, tall ? 14 : 69)
  assert(target.getBoundingClientRect().bottom <= viewport.getBoundingClientRect().bottom - 8)
  if (!tall) assert(warning.getBoundingClientRect().bottom <= viewport.getBoundingClientRect().bottom - 8, 'The complete fitting color group reveals both input and warning')
  const currentScroll = viewport.scrollTop; run.layouts[0].fn(); run.frames[0](); assert.equal(viewport.scrollTop, currentScroll)
  groupCases++
}
assert.equal(services, 0)
console.log(`Theme support ${cases} field/reading cases, exact color/support-reading witnesses and classic render parity (only reviewed owner guards/generic action normalized), unique warning associations, unchanged local callbacks/full description/metadata and named keyboard region passed; zero reads/saves/standards/apply. Active color focus/reveal ${revealCases} gates passed with only native form viewport delegation. Complete warning group/fallback ${groupCases} actual-helper geometry cases pass.`)
