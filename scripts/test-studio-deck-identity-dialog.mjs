import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import postcss from 'postcss'

const path = 'components/builder/deck-identity-dialog.tsx'
const source = fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const original = execFileSync('git', ['show', `15639c8:${path}`], { encoding: 'utf8' })
const focusStart = source.indexOf(' ref={studioShell ? contentRef : undefined} onOpenAutoFocus=')
const focusEnd = source.indexOf(' data-studio-deck-identity=', focusStart)
assert(focusStart > 0 && focusEnd > focusStart)
const withoutFocusAttributes = source.slice(0, focusStart) + source.slice(focusEnd)
const restored = withoutFocusAttributes
  .replace('useEffect, useLayoutEffect, useRef, useState', 'useEffect, useState')
  .replace('import { keepStudioScrollFocusVisible } from "@/lib/studio-inspector-focus"\n', '')
  .replace(/  useLayoutEffect\(\(\) => \{[\s\S]*?  \}, \[studioShell, enabled, open, draft\.logoUrl\]\)\n\n/, '')
  .replace(/ onFocusCapture=\{studioShell \? event => revealStudioDeckIdentityField\(event\.target\) : undefined\}/, '')
  .replace(/\nfunction revealStudioDeckIdentityField\(target: EventTarget \| null\) \{[\s\S]*?\n\}\n/, '')
  .replace(/  const (?:openerRef|contentRef|openedContentRef) = useRef<[^\n]+\n/g, '')
  .replace('import "./studio-deck-identity.css"\n', '')
  .replace('  const studioShell = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === "true"\n', '')
  .replace(/\n        (?:ref|data-studio-deck-identity-trigger|aria-haspopup)=\{studioShell \? [^}]+ : undefined\}/g, '')
  .replace(/\n                aria-(?:invalid|describedby)=\{studioShell(?: && logoLooksWrong)? \? [^}]+ : undefined\}/g, '')
  .replace(/ (?:data-studio-deck-identity[\w-]*|tabIndex|role|aria-label|id)=\{studioShell \? [^}]+ : undefined\}/g, '')
  .replace(/\n            \{studioShell && <p data-studio-deck-identity-note="true">Company, confidentiality and logo URL are kept in this browser\. Presenter comes from your signed-in profile\.<\/p>\}/, '')
assert.equal(restored, original, 'Every original flag/default/hook/storage callback/field/condition/copy and classic markup must remain exact')
postcss.parse(fs.readFileSync(new URL('../components/builder/studio-deck-identity.css', import.meta.url), 'utf8'))
let mutations = 0
const node = (type, props) => ({ type, props: props || {} })
class LocalHTMLElement {
  constructor({ id = '', invalid = false, group = null, viewport = null, rect = null } = {}) { Object.assign(this, { id, invalid, group, viewport, rect }); this.scrollTop = 0 }
  getAttribute(name) { return name === 'aria-invalid' ? String(this.invalid) : null }
  closest(selector) { return selector === '[data-studio-deck-identity-logo-group="true"]' ? this.group : this.viewport }
  getBoundingClientRect() { const scroll = this.viewport?.scrollTop || 0; return { ...this.rect, top: this.rect.top - scroll, bottom: this.rect.bottom - scroll } }
}
function runtime(text, flag, enabled, presenter, initialDraft, dom, realFocus = false) {
  const exports = {}, state = [true, initialDraft], effects = [], layouts = [], refs = [], reveals = [], frames = []; let cursor = 0, refCursor = 0
  const focusModule = { exports: {} }
  if (realFocus) vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../lib/studio-inspector-focus.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports: focusModule.exports, module: focusModule, HTMLElement: LocalHTMLElement })
  const form = { company: 'Stored local company', confidentiality: 'Stored local note', logoUrl: 'https://example.invalid/stored-logo.png' }
  vm.runInNewContext(ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, module: { exports }, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: flag } },
    require(id) {
      if (id === 'react') return {
        useState(init) { const i = cursor++; if (!(i in state)) state[i] = typeof init === 'function' ? init() : init; return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value }] },
        useRef(value) { const i = refCursor++; return refs[i] ||= { current: value } },
        useEffect(fn, deps) { effects.push({ fn, deps }) },
        useLayoutEffect(fn, deps) { layouts.push({ fn, deps }) },
      }
      if (id === 'react/jsx-runtime') return { jsx: node, jsxs: node, Fragment: 'Fragment' }
      if (id === '@/lib/studio-inspector-focus') return { keepStudioScrollFocusVisible(target, selector) { reveals.push({ target, selector }); if (realFocus) focusModule.exports.keepStudioScrollFocusVisible(target, selector) } }
      if (id === '@/hooks/use-deck-identity') return { useDeckIdentityForm: () => ({ form, presenter, save() { mutations++; throw new Error('No storage save permitted') } }) }
      if (id === '@/lib/deck-identity') return { isDeckIdentityEnabled: () => enabled }
      if (id === 'next/link') return { default: 'Link' }
      if (id.endsWith('.css')) return {}
      if (id.startsWith('@/components/') || id === 'lucide-react') return new Proxy({}, { get: (_target, key) => key })
      throw new Error(`Unexpected dependency ${id}`)
    },
    document: dom, HTMLElement: LocalHTMLElement, requestAnimationFrame(fn) { frames.push(fn); return frames.length }, cancelAnimationFrame() {},
    fetch() { mutations++; throw new Error('No services permitted') }, console,
  })
  return { form, state, effects, layouts, refs, reveals, frames, render(props = {}) { cursor = 0; refCursor = 0; effects.length = 0; layouts.length = 0; return exports.DeckIdentityDialog(props) } }
}
function all(tree, predicate, found = []) {
  if (!tree || typeof tree !== 'object') return found
  if (Array.isArray(tree)) { tree.forEach(value => all(value, predicate, found)); return found }
  if (predicate(tree)) found.push(tree)
  all(tree.props.children, predicate, found)
  return found
}
const find = (tree, predicate) => { const matches = all(tree, predicate); assert.equal(matches.length, 1); return matches[0] }
function visible(tree) { return tree == null || typeof tree === 'boolean' ? '' : typeof tree !== 'object' ? String(tree) : Array.isArray(tree) ? tree.map(visible).join(' ') : visible(tree.props.children) }
function canonical(tree) {
  if (tree == null || typeof tree === 'boolean') return []
  if (typeof tree !== 'object') return [String(tree)]
  if (Array.isArray(tree)) return tree.flatMap(canonical)
  if (tree.type === 'Fragment') return canonical(tree.props.children)
  return [{ type: tree.type, props: Object.fromEntries(Object.entries(tree.props).filter(([key, value]) => key !== 'children' && value !== undefined).map(([key, value]) => [key, typeof value === 'function' ? value.toString().replace(/\s+/g, ' ') : value])), children: canonical(tree.props.children) }]
}
let cases = 0
for (const flag of ['true', 'false', undefined, '1']) for (const isDark of [true, false]) for (const presenter of [null, 'Confirmed account name']) for (const logoUrl of ['', 'https://example.invalid/logo.png', 'http://example.invalid/logo.png']) {
  const draft = { company: 'Local unsaved company', confidentiality: 'Local unsaved note', logoUrl }
  const run = runtime(source, flag, true, presenter, draft), tree = run.render({ isDark })
  assert.equal(run.effects.length, 1)
  const inputs = all(tree, item => item.type === 'Input'); assert.equal(inputs.length, 3)
  inputs.forEach(input => assert.equal(input.props.maxLength, 120))
  assert.equal(find(tree, item => item.props.id === 'deck-identity-company').props.value, draft.company)
  assert.equal(find(tree, item => item.props.id === 'deck-identity-confidentiality').props.value, draft.confidentiality)
  const logo = find(tree, item => item.props.id === 'deck-identity-logo')
  assert.equal(logo.props.value, logoUrl)
  const trigger = find(tree, item => item.type === 'Button' && item.props['aria-label'] === 'Presenter details')
  assert(visible(tree).includes(presenter || 'Not set'))
  assert.equal(find(tree, item => item.type === 'Link').props.href, '/settings/profile')
  if (flag === 'true') {
    assert.equal(trigger.props['aria-haspopup'], 'dialog')
    assert.equal(logo.props['aria-invalid'], logoUrl.startsWith('http://'))
    assert.equal(logo.props['aria-describedby'], logoUrl.startsWith('http://') ? 'deck-identity-logo-warning' : undefined)
    assert.equal(find(tree, item => item.props['data-studio-deck-identity-fields']).props.tabIndex, 0)
    assert(visible(tree).includes('kept in this browser'))
    if (logoUrl.startsWith('http://')) assert.equal(find(tree, item => item.props.id === 'deck-identity-logo-warning').props.role, 'alert')
  } else {
    assert.equal(JSON.stringify(canonical(tree)), JSON.stringify(canonical(runtime(original, flag, true, presenter, draft).render({ isDark }))), 'Full classic render and callback source parity')
  }
  cases++
}
for (const flag of ['true', 'false', undefined]) {
  const disabled = runtime(source, flag, false, null, {})
  assert.equal(disabled.render(), null); assert.equal(disabled.effects.length, 1)
}
const local = runtime(source, 'true', true, 'Confirmed profile', {})
let tree = local.render(); local.effects[0].fn(); tree = local.render()
assert.equal(find(tree, item => item.props.id === 'deck-identity-company').props.value, local.form.company)
find(tree, item => item.props.id === 'deck-identity-company').props.onChange({ target: { value: 'Unsaved local edit' } }); tree = local.render()
assert.equal(find(tree, item => item.props.id === 'deck-identity-company').props.value, 'Unsaved local edit')
find(tree, item => item.props['data-studio-deck-identity-action'] === 'cancel').props.onClick(); tree = local.render()
assert.equal(find(tree, item => item.type === 'Dialog').props.open, false)
find(tree, item => item.props['aria-label'] === 'Presenter details').props.onClick(); tree = local.render(); local.effects[0].fn(); tree = local.render()
assert.equal(find(tree, item => item.props.id === 'deck-identity-company').props.value, local.form.company)
assert.equal(mutations, 0)
let focusCases = 0
for (const scenario of ['inside', 'body', 'none', 'unrelated-focus', 'other-dialog', 'disconnected', 'other-document']) {
  const body = {}, closing = { contains: target => target?.inside === true }, active = { inside: true }
  const dom = { body, activeElement: active, querySelectorAll: () => scenario === 'other-dialog' ? [closing, {}] : [closing] }
  if (scenario === 'body') dom.activeElement = body
  if (scenario === 'none') dom.activeElement = null
  if (scenario === 'unrelated-focus') dom.activeElement = {}
  let focused = 0, prevented = 0
  const opener = { isConnected: scenario !== 'disconnected', ownerDocument: scenario === 'other-document' ? {} : dom, focus(options) { focused++; assert.equal(options.preventScroll, true) } }
  const guard = runtime(source, 'true', true, 'Profile', {}, dom)
  const tree = guard.render()
  const content = find(tree, item => item.type === 'DialogContent')
  find(tree, item => item.props['aria-label'] === 'Presenter details').props.ref.current = opener
  content.props.ref.current = closing
  content.props.onOpenAutoFocus()
  content.props.ref.current = null // Actual closing ref can clear before close autofocus.
  content.props.onCloseAutoFocus({ preventDefault() { prevented++ } })
  const expected = ['inside', 'body', 'none'].includes(scenario) ? 1 : 0
  assert.equal(focused, expected); assert.equal(prevented, expected)
  assert.equal(guard.refs[2].current, null, 'The per-opening content is cleared after close')
  focusCases++
}
for (const flag of ['false', undefined, '1']) {
  const content = find(runtime(source, flag, true, null, {}).render(), item => item.type === 'DialogContent')
  assert.equal(content.props.onOpenAutoFocus, undefined); assert.equal(content.props.onCloseAutoFocus, undefined); assert.equal(content.props.ref, undefined)
}
let revealCases = 0
for (const flag of ['true', 'false', undefined, '1']) {
  const target = new LocalHTMLElement(), dom = { activeElement: target }
  const run = runtime(source, flag, true, 'Profile', { logoUrl: 'http://example.invalid/logo.png' }, dom)
  let tree = run.render()
  const fields = find(tree, item => item.props['data-studio-deck-identity-fields'] || item.props.className === 'space-y-3 py-1')
  if (flag === 'true') {
    fields.props.onFocusCapture({ target })
    assert.equal(run.reveals.length, 1); assert.equal(run.reveals[0].target, target)
    assert.equal(run.reveals[0].selector, '[data-studio-deck-identity-fields="true"]')
    const viewport = { contains: value => value === target }
    find(tree, item => item.type === 'DialogContent').props.ref.current = { querySelector: selector => { assert.equal(selector, '[data-studio-deck-identity-fields="true"]'); return viewport } }
    const cleanup = run.layouts[0].fn()
    assert.equal(run.reveals.length, 2)
    run.frames[0](); assert.equal(run.reveals.length, 3)
    dom.activeElement = {} // No scroll or focus when another control now owns focus.
    run.frames[0](); assert.equal(run.reveals.length, 3)
    assert.equal(typeof cleanup, 'function'); cleanup()
    assert.equal(JSON.stringify(run.layouts[0].deps), JSON.stringify([true, true, true, 'http://example.invalid/logo.png']))
    find(tree, item => item.props['data-studio-deck-identity-action'] === 'cancel').props.onClick()
    tree = run.render(); assert.equal(run.layouts[0].fn(), undefined)
    assert.equal(run.frames.length, 1, 'Closed dialog schedules no layout recheck')
  } else {
    assert.equal(fields.props.onFocusCapture, undefined)
    assert.equal(run.layouts[0].fn(), undefined); assert.equal(run.reveals.length, 0); assert.equal(run.frames.length, 0)
  }
  revealCases++
}
let groupCases = 0
for (const tall of [false, true]) {
  const viewport = new LocalHTMLElement({ rect: { top: 240, bottom: 516, height: 276 } })
  const group = new LocalHTMLElement({ viewport, rect: tall ? { top: 350, bottom: 800, height: 450 } : { top: 470, bottom: 550, height: 80 } })
  const target = new LocalHTMLElement({ id: 'deck-identity-logo', invalid: true, group, viewport, rect: { top: 496, bottom: 532, height: 36 } })
  const dom = { activeElement: target }
  const run = runtime(source, 'true', true, 'Profile', { logoUrl: 'http://example.invalid/logo.png' }, dom, true)
  const tree = run.render()
  find(tree, item => item.props['data-studio-deck-identity-fields']).props.onFocusCapture({ target })
  assert.equal(run.reveals.length, 2); assert.equal(run.reveals[0].target, group); assert.equal(run.reveals[1].target, target)
  assert.equal(viewport.scrollTop, tall ? 24 : 42)
  assert(target.getBoundingClientRect().bottom <= viewport.getBoundingClientRect().bottom - 8)
  if (!tall) assert(group.getBoundingClientRect().bottom <= viewport.getBoundingClientRect().bottom - 8, 'The complete fitting group is revealed, including its warning')
  const currentScroll = viewport.scrollTop
  find(tree, item => item.type === 'DialogContent').props.ref.current = { querySelector: () => ({ contains: value => value === target }) }
  run.layouts[0].fn(); run.frames[0](); assert.equal(viewport.scrollTop, currentScroll, 'Settled layout checks do not accumulate scroll when already visible')
  groupCases++
}
assert.equal(mutations, 0)
console.log(`Deck identity ${cases} shell/theme/profile/logo cases, full source/classic parity, feature-off null, 120-char fields, warning association and local Cancel/reopen reset passed; zero storage saves/services/sends. Guarded focus return ${focusCases} cases pass; classic has no focus handlers. Warning/focus reveal ${revealCases} gates pass with only existing viewport delegation. Complete logo group/fallback ${groupCases} actual-helper geometry cases pass.`)
