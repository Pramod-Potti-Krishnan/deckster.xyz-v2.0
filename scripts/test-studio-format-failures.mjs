import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import postcss from 'postcss'

// Real leaf bodies/callbacks with isolated hook/JSX dependencies. No iframe,
// browser, API or successful service acknowledgement is fabricated.
const root = new URL('../', import.meta.url)
const files = ['components/textbox-format-panel/index.tsx', 'components/element-format-panel/index.tsx']
const baseline = 'c339e8c'
const jsx = (type, props, key) => ({ type, props, ...(key === undefined ? {} : { key }) })
const flatten = value => Array.isArray(value) ? value.flatMap(flatten) : !value || typeof value !== 'object' ? [] : [value, ...flatten(value.props?.children)]
const text = value => Array.isArray(value) ? value.map(text).join('') : value == null || typeof value === 'boolean' ? '' : typeof value === 'object' ? text(value.props?.children) : String(value)
const snapshot = tree => JSON.stringify(normalize(tree), (key, value) => typeof value === 'function' ? '[native callback]' : value)
// React omits boolean/null children from the rendered subtree.
const normalize = node => Array.isArray(node) ? node.filter(value => value != null && typeof value !== 'boolean').map(normalize) : node && typeof node === 'object' ? Object.fromEntries(Object.entries(node).map(([key,value]) => [key, normalize(value)])) : node
const canonical = source => ts.createPrinter({ removeComments: true }).printFile(ts.createSourceFile('leaf.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX))
let checks = 0
function harness(source, name, flag) {
  const slots = [], effects = []
  let cursor = 0, writes = 0
  const react = {
    useState(initial) {
      const i = cursor++
      if (!(i in slots)) slots[i] = { value: typeof initial === 'function' ? initial() : initial }
      return [slots[i].value, value => { writes++; slots[i].value = typeof value === 'function' ? value(slots[i].value) : value }]
    },
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial } },
    useCallback(callback) { return callback },
    useEffect(callback, deps) {
      const i = cursor++, old = slots[i]
      if (!old || deps.some((value, index) => value !== old.deps[index])) effects.push(() => { old?.cleanup?.(); slots[i] = { deps, cleanup: callback() } })
    },
  }
  const dependencies = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'lucide-react': Object.fromEntries(['Trash2','Type','Image','Table','BarChart3','LayoutGrid','GitBranch','Layout','Sparkles','Loader2'].map(value => [value, value])),
    '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
    '@/components/builder/studio-panels.css': {},
    '@/components/builder/studio-format-failures.css': {},
    '@/components/ui/panel': { PanelSection: 'PanelSection', ButtonGroup: 'ButtonGroup', Divider: 'Divider' },
    './style-tab': { StyleTab: 'StyleTab' },
    './ai-tab': { AITab: 'AITab' },
    './tabs/arrange-tab': { ArrangeTab: 'ArrangeTab' },
    './slide-format-panel': { SlideFormatPanel: 'SlideFormatPanel' },
    './types': {},
    '@/types/elements': { ELEMENT_INFO: Object.fromEntries(['image','table','chart','infographic','diagram','text','hero'].map(value => [value, { label: value }])) },
  }
  const compiled = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
  assert.equal((compiled.diagnostics || []).filter(value => value.category === ts.DiagnosticCategory.Error).length, 0)
  const mod = { exports: {} }
  vm.runInNewContext(compiled.outputText, { module: mod, exports: mod.exports, Error, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: flag } }, fetch: () => assert.fail('No service requests allowed'), require: id => { assert.ok(id in dependencies, id); return dependencies[id] } })
  return {
    render(props) { cursor = 0; const tree = mod.exports[name](props); while (effects.length) effects.shift()(); return tree },
    unmount() { for (const slot of slots) slot?.cleanup?.() },
    get writes() { return writes },
  }
}
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const notice = tree => flatten(tree).find(node => node.props?.['data-studio-format-failure'] === 'true')
const child = (tree, type) => { const found = flatten(tree).find(node => node.type === type); assert.ok(found, type); return found }

for (const file of files) {
  const source = fs.readFileSync(new URL(file, root), 'utf8')
  const original = execFileSync('git', ['show', `${baseline}:${file}`], { cwd: root, encoding: 'utf8' })
  const isText = file.includes('textbox'), name = isText ? 'TextBoxFormatPanel' : 'ElementFormatPanel', type = isText ? 'StyleTab' : 'ArrangeTab'
  // Revert only the explicitly additive Studio binding. This checks every
  // original callback, option, delete gate, slide/AI branch and class as an AST.
  const restored = source
    .replace("import { useState, useCallback, useEffect, useRef } from 'react'", "import { useState, useCallback } from 'react'")
    .replace("import '@/components/builder/studio-format-failures.css'\n", '')
    .replace(/\nconst STUDIO_FORMAT_FAILURES[\s\S]*?\nexport function /, '\nexport function ')
    .replace(/  const formatTargetKey =[^\n]*\n  const formatFeedback = useStudioFormatFeedback[^\n]*\n  const applying =[^\n]*\n\n/, '')
    .replace(/\{STUDIO_FORMAT_FAILURES && formatFeedback.failure !== null && \([\s\S]*?\n\s*\)\}\n\n\s*/, '')
    .replace('STUDIO_FORMAT_FAILURES ? formatFeedback.run : handleSendCommand', 'handleSendCommand')
    .replace('STUDIO_FORMAT_FAILURES ? formatFeedback.runNative : handleSendCommand', 'handleSendCommand')
    .replace("STUDIO_FORMAT_FAILURES ? formatTargetKey : elementId || 'no-selection'", "elementId || 'no-selection'")
    .replaceAll('key={STUDIO_FORMAT_FAILURES ? formatTargetKey : undefined}\n', '')
    .replace('STUDIO_FORMAT_FAILURES ? (action, params) => formatFeedback.run(action, { ...params, elementId }) : handleSendCommand', 'handleSendCommand')
    .replaceAll('isApplying={applying}', 'isApplying={isApplying}')
    .replaceAll('{applying && (', '{isApplying && (')
  assert.equal(canonical(restored), canonical(original), `${name}: original source remains exact after additive Studio code removal`); checks++
  const props = { isOpen: true, elementId: 'owned-element-a', elementType: 'image', presentationId: 'owned-presentation-a', slideIndex: 2, sessionId: 'owned-session-a', formatting: { fontFamily: 'Inter', color: '#28433e' }, properties: { size: { width: 400, height: 300 } }, onClose() {}, onDelete() {}, onSendCommand: async () => ({ success: true }) }
  for (const flag of [undefined, 'false', 'TRUE', '1']) {
    for (const elementType of ['image','table','chart','infographic','diagram','text','hero',null]) {
      const current = harness(source, name, flag), prior = harness(original, name, flag), p = { ...props, elementType }
      assert.equal(snapshot(current.render(p)), snapshot(prior.render(p))); checks++
    }
    const h = harness(source, name, flag), rejection = new Error('Classic rejection identity retained')
    const p = { ...props, onSendCommand: async () => { throw rejection } }
    await assert.rejects(child(h.render(p), type).props.onSendCommand('nativeAction', { value: 9 }), error => error === rejection)
    assert.equal(notice(h.render(p)), undefined); checks++
  }
  for (const thrown of [new Error('Native multiline\nreason END'), 'Native string refusal END', { message: 'Unexpected object is not serialized' }, null, new Error('')]) {
    const h = harness(source, name, 'true'), calls = []
    const p = { ...props, onSendCommand: async (...args) => { calls.push(args); throw thrown } }
    const params = { elementId: 'attempted-override', value: 31, lock: true }, control = child(h.render(p), type)
    const failed = await control.props.onSendCommand('nativeAction', params)
    const expected = thrown instanceof Error && thrown.message ? thrown.message : typeof thrown === 'string' ? thrown : 'Formatting command failed.'
    assert.equal(failed.success, false); assert.equal(failed.error, expected)
    const tree = h.render(p), alert = notice(tree)
    assert.ok(alert); assert.equal(alert.props.role, 'alert'); assert.equal(alert.props.tabIndex, 0); assert.equal(alert.props['aria-label'], 'Formatting change not confirmed')
    assert.equal(flatten(alert).find(node => node.type === 'p').props.children, expected)
    assert.match(text(alert), /Controls may show attempted values/)
    assert.equal(child(tree, type).props.isApplying, false)
    assert.equal(calls.length, 1); assert.equal(calls[0][0], 'nativeAction')
    assert.equal(calls[0][1].elementId, isText ? 'attempted-override' : 'owned-element-a')
    assert.equal(calls[0][1].value, 31); assert.equal(calls[0][1].lock, true)
    if (isText) assert.equal(calls[0][1], params)
    const noDelete = h.render({ ...p, onDelete: undefined }); assert.equal(flatten(noDelete).filter(node => node.type === 'button' && node.props.title?.startsWith('Delete')).length, 0)
    checks++
  }
  const targetHarness = harness(source, name, 'true')
  const firstKey = child(targetHarness.render(props), type).key
  assert.ok(firstKey)
  for (const extra of [{ elementId: 'b' }, { presentationId: 'b' }, { slideIndex: 4 }, ...(isText ? [{ sessionId: 'b' }] : [{ elementType: 'chart' }])]) {
    assert.notEqual(child(targetHarness.render({ ...props, ...extra }), type).key, firstKey)
  }
  checks++
  // A supplied explicit native failure is preserved; successful result identity
  // is forwarded without inventing status or clearing a user field.
  const h = harness(source, name, 'true'), failedResult = { success: false, error: 'Original native result failure' }
  let p = { ...props, onSendCommand: async () => failedResult }
  assert.equal(await child(h.render(p), type).props.onSendCommand('nativeAction', {}), failedResult)
  assert.match(text(notice(h.render(p))), /Original native result failure/)
  const successfulResult = { success: true, nativeData: 17 }; p = { ...p, onSendCommand: async () => successfulResult }
  assert.equal(await child(h.render(p), type).props.onSendCommand('nativeAction', {}), successfulResult)
  assert.equal(notice(h.render(p)), undefined); checks++

  // Delayed requests forward existing busy guards, refuse duplicate leaf calls,
  // and cannot leave stale feedback/busy on close, target change or route unmount.
  for (const change of ['element', 'presentation', 'slide', 'close', ...(isText ? ['session'] : ['type']), 'unmount']) {
    const d = deferred(), test = harness(source, name, 'true'); let sends = 0
    const a = { ...props, onSendCommand: () => { sends++; return d.promise } }
    const oldHandler = child(test.render(a), type).props.onSendCommand
    const pending = oldHandler('nativeAction', { value: 7 })
    assert.equal(child(test.render(a), type).props.isApplying, true)
    assert.equal((await oldHandler('nativeAction', { value: 8 })).success, false); assert.equal(sends, 1)
    let b = { ...a }
    if (change === 'element') b.elementId = 'owned-element-b'
    if (change === 'presentation') b.presentationId = 'owned-presentation-b'
    if (change === 'slide') b.slideIndex = 3
    if (change === 'session') b.sessionId = 'owned-session-b'
    if (change === 'type') b.elementType = 'chart'
    if (change === 'close') b.isOpen = false
    if (change === 'unmount') test.unmount()
    else { const tree = test.render(b); assert.equal(notice(tree), undefined); if (b.isOpen) assert.equal(child(tree, type).props.isApplying, false) }
    const writes = test.writes
    d.reject(new Error('Obsolete selection failure')); await pending
    assert.equal(test.writes, writes, 'stale completion never writes state')
    if (change !== 'unmount') { assert.equal(notice(test.render({ ...b, isOpen: true })), undefined); assert.equal((await oldHandler('nativeAction', {})).success, false); assert.equal(sends, 1) }
    checks++
  }
  const a = deferred(), b = deferred(), latest = harness(source, name, 'true')
  let p1 = { ...props, onSendCommand: () => a.promise }, p2 = { ...props, elementId: 'owned-element-b', onSendCommand: () => b.promise }
  const first = child(latest.render(p1), type).props.onSendCommand('one', {})
  const second = child(latest.render(p2), type).props.onSendCommand('two', {})
  a.reject(new Error('Old refusal')); await first
  assert.equal(child(latest.render(p2), type).props.isApplying, true); assert.equal(notice(latest.render(p2)), undefined)
  b.reject(new Error('Current refusal')); await second
  assert.match(text(notice(latest.render(p2))), /Current refusal/)
  latest.render(p1); assert.equal(notice(latest.render(p1)), undefined); checks++
  const long = 'Native refusal\n' + '<script>literal diagnostic</script> '.repeat(600) + ' COMPLETE-END'
  const longHarness = harness(source, name, 'true'), lp = { ...props, onSendCommand: async () => { throw new Error(long) } }
  await child(longHarness.render(lp), type).props.onSendCommand('nativeAction', {})
  assert.equal(flatten(notice(longHarness.render(lp))).find(node => node.type === 'p').props.children, long)
  assert.equal(flatten(longHarness.render(lp)).some(node => node.props?.dangerouslySetInnerHTML), false); checks++
  // Existing AI/slide handlers keep their original rejection behavior.
  if (isText) {
    const ai = harness(source, name, 'true'), err = new Error('Native AI error'), ap = { ...props, onSendCommand: async () => { throw err } }
    flatten(ai.render(ap)).find(node => node.type === 'button' && text(node) === 'AI').props.onClick()
    await assert.rejects(child(ai.render(ap), 'AITab').props.onSendCommand('generateTextBoxContent', {}), value => value === err)
    const aiSource = fs.readFileSync(new URL('components/textbox-format-panel/ai-tab.tsx', root), 'utf8')
    for (const oldResult of ['success', 'failure']) {
      const parent = harness(source, name, 'true'), oldWait = deferred(), newWait = deferred()
      const pA = { ...props, onSendCommand: () => oldWait.promise }, pB = { ...props, presentationId: 'deck-b', onSendCommand: () => newWait.promise }
      flatten(parent.render(pA)).find(node => node.type === 'button' && text(node) === 'AI').props.onClick()
      const oldNode = child(parent.render(pA), 'AITab'), oldChild = harness(aiSource, 'AITab', 'true')
      const oldTree = () => oldChild.render(oldNode.props)
      flatten(oldTree()).find(node => node.type === 'textarea').props.onChange({ target: { value: 'Old local AI draft' } })
      const oldSubmit = flatten(oldTree()).find(node => node.type === 'button' && text(node).includes('Generate Content')).props.onClick()
      const newNode = child(parent.render(pB), 'AITab'); assert.notEqual(newNode.key, oldNode.key)
      oldChild.unmount()
      const newChild = harness(aiSource, 'AITab', 'true')
      const newTree = () => newChild.render(child(parent.render(pB), 'AITab').props)
      flatten(newTree()).find(node => node.type === 'textarea').props.onChange({ target: { value: 'New retained AI draft' } })
      const newSubmit = flatten(newTree()).find(node => node.type === 'button' && text(node).includes('Generate Content')).props.onClick()
      if (oldResult === 'success') oldWait.resolve({ success: true })
      else oldWait.reject(new Error('Old AI refusal'))
      await oldSubmit
      assert.equal(flatten(newTree()).find(node => node.type === 'textarea').props.value, 'New retained AI draft')
      assert.equal(child(parent.render(pB), 'AITab').props.isApplying, true)
      assert.equal(text(newTree()).includes('Old AI refusal'), false)
      newWait.reject(new Error('Current AI refusal')); await newSubmit
      assert.equal(flatten(newTree()).find(node => node.type === 'textarea').props.value, 'New retained AI draft')
      assert.match(text(newTree()), /Current AI refusal/)
      assert.equal(child(parent.render(pB), 'AITab').props.isApplying, false)
      assert.equal(notice(parent.render(pB)), undefined, 'AI keeps its native failure surface')
      checks++
    }

  } else {
    const slide = harness(source, name, 'true'), err = new Error('Native slide error'), sp = { ...props, elementId: null, elementType: null, onSendCommand: async () => { throw err } }
    await assert.rejects(child(slide.render(sp), 'SlideFormatPanel').props.onSendCommand('setSlideBackground', {}), value => value === err)
    assert.equal(notice(slide.render(sp)), undefined)
  }
  checks++
}
const css = fs.readFileSync(new URL('components/builder/studio-format-failures.css', root), 'utf8'), parsed = postcss.parse(css)
parsed.walkRules(rule => assert.ok(rule.selector.includes('[data-studio-format-failure="true"]'), 'Every rule requires the literal-only notice marker'))
assert.match(css, /max-height: min\(136px, 25dvh\)/); assert.match(css, /overflow-y: auto/); assert.match(css, /white-space: pre-wrap/); assert.match(css, /:focus-visible/); assert.match(css, /\.dark \[data-studio-format-failure="true"\]/); assert.match(css, /outline: 2px solid/); checks++
console.log(`Studio formatting failures: ${checks} real-leaf classic/source/refusal/payload/pending/identity/unmount/readability checks passed. No service or browser requests.`)
