// Offline actual-leaf and source checks. No service, browser, save or billing proof.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
const root = fileURLToPath(new URL('../', import.meta.url))
const baseline = '0ed6298'
const files = ['publish-dialog', 'publish-wizard', 'narration-voice-picker', 'publish-session-controls', 'publish-qa-settings'].map(n => `components/${n}.tsx`)
const prior = file => execFileSync('git', ['show', `${baseline}:${file}`], { cwd: root, encoding: 'utf8' })
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const parse = (file, text) => ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const printer = ts.createPrinter({ removeComments: true })
const print = (node, ast) => printer.printNode(ts.EmitHint.Unspecified, node, ast)
const behaviorAttributes = new Set(['onClick', 'onChange', 'onBlur', 'onCheckedChange', 'onValueChange', 'onOpenChange', 'onCloseAutoFocus', 'onPublish', 'onCancel', 'onProgressClose', 'onRecordChange', 'checked', 'value', 'defaultValue', 'disabled', 'min', 'max', 'type', 'href', 'key', 'sessionId', 'slug', 'slideCount', 'hasBudget'])
function contract(file, text) {
  const ast = parse(file, text), calls = [], attrs = [], hooks = []
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const name = node.expression.getText(ast)
      if (name === 'fetch' || name === 'JSON.stringify') calls.push(print(node, ast))
      if (/^(useState|useEffect|useLayoutEffect|useCallback|useMemo|resolveBudget|suggestedReserveMinutes)$/.test(name)) hooks.push(print(node, ast))
    }
    if (ts.isJsxAttribute(node) && behaviorAttributes.has(node.name.getText(ast))) {
      // The new read-only preview has its own owner-target witnesses. Compare
      // every existing handler/gate/target exactly; exclude only its added prop.
      const element = node.parent.parent
      const addedPreviewTarget = node.name.getText(ast) === 'sessionId' &&
        ts.isJsxSelfClosingElement(element) && element.tagName.getText(ast) === 'StudioPublishPreview'
      if (!addedPreviewTarget) attrs.push(print(node, ast))
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return { calls, attrs, hooks }
}
let checks = 0
for (const file of files) {
  assert.deepEqual(contract(file, read(file)), contract(file, prior(file)), `${file}: requests, initial state, effects, controlled values, callbacks and gates retain their baseline source`)
  const diagnostics = ts.transpileModule(read(file), { fileName: file, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).diagnostics
  assert.deepEqual(diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error), [])
  checks += 2
}
// Mutations demonstrate that the contract check catches a dropped limit,
// altered request body, a disabled gate, and automatic-record defaults.
for (const [file, old, next] of [
  ['components/publish-wizard.tsx', 'max={480}', 'max={100}'],
  ['components/narration-voice-picker.tsx', '{ slug, estimate: !confirmed }', '{ slug, estimate: false }'],
  ['components/narration-voice-picker.tsx', 'disabled={rendering || !slug || !storage.ok}', 'disabled={rendering || !slug}'],
  ['components/publish-wizard.tsx', 'recordNarration: true', 'recordNarration: false'],
]) {
  const source = read(file)
  assert.ok(source.includes(old))
  assert.notDeepEqual(contract(file, source.replace(old, next)), contract(file, source))
  checks++
}
function harness(file, source, flag, props, initialOverrides = {}) {
  let cursor = 0
  const slots = [], effects = [], requests = [], jsx = (type, props) => ({ type, props: props ?? {} })
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = Object.hasOwn(initialOverrides, i) ? initialOverrides[i] : typeof initial === 'function' ? initial() : initial; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next }] },
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value } },
    useCallback: fn => fn, useMemo: fn => fn(), useEffect: fn => { effects.push(fn) }, useLayoutEffect: () => {},
  }
  const budget = { resolveBudget: (total, reserve) => total ? { narrationMinutes: total - (reserve ?? Math.floor(total / 5)), qaReserveMinutes: reserve ?? Math.floor(total / 5) } : null, suggestedReserveMinutes: total => Math.floor(total / 5) }
  const module = { exports: {} }
  const symbols = new Proxy({}, { get: (_target, name) => name })
  const code = ts.transpileModule(source, { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  vm.runInNewContext(code, { module, exports: module.exports, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: flag } }, fetch: async (url, options) => { requests.push({ url, method: options?.method, body: options?.body ? JSON.parse(options.body) : undefined }); return { ok: true, json: async () => ({ persistenceReady: true, toRender: 2, alreadyRendered: 0, estimatedCents: 3, estimatedMinutes: 1, rendered: 2, reused: 0, spentCents: 3, results: [] }) } }, require: name => {
    if (name === 'react') return { ...react, default: react }
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' }
    if (name.endsWith('.css')) return {}
    if (name === '@/lib/narration/budget') return budget
    if (name === '@/hooks/use-toast') return { useToast: () => ({ toast: () => {} }) }
    if (name === '@/hooks/use-copy-to-clipboard') return { useCopyToClipboard: () => ({ copy: () => {}, copied: false }) }
    if (name === 'lucide-react' || name.startsWith('@/components/')) return symbols
    throw new Error(`Unknown offline dependency ${name}`)
  } })
  const component = module.exports[path.basename(file, '.tsx') === 'publish-wizard' ? 'PublishWizard' : path.basename(file, '.tsx') === 'narration-voice-picker' ? 'NarrationVoicePicker' : 'PublishControls']
  function materialize(tree) { return Array.isArray(tree) ? tree.map(materialize) : !tree || typeof tree !== 'object' ? tree : typeof tree.type === 'function' ? materialize(tree.type(tree.props)) : { ...tree, props: { ...tree.props, children: materialize(tree.props.children) } } }
  return { render() { cursor = 0; return materialize(component(props)) }, slots, requests }
}
const serialize = tree => JSON.stringify(tree, (key, value) => key === 'children' && Array.isArray(value) ? value.filter(child => child !== false && child !== null && child !== undefined) : typeof value === 'function' ? 'callback' : value)
const wizardProps = { sessionId: 'owned-session', slideCount: 3, record: null, busy: false, progress: null, onPublish: () => {}, onCancel: () => {} }
for (const flag of [undefined, 'false', 'TRUE', '1']) {
  for (let step = 0; step < 4; step++) {
    const file = 'components/publish-wizard.tsx', props = { ...wizardProps }
    const current = harness(file, read(file), flag, props, { 0: step }), original = harness(file, prior(file), flag, props, { 0: step })
    assert.equal(serialize(current.render()), serialize(original.render()), `Classic wizard step ${step} remains identical with flag ${flag}`)
    checks++
  }
  for (const busy of [true, false]) for (const progress of [null, [{ label: 'Publishing the deck', status: 'failed', detail: 'Full native refusal' }]]) {
    const file = 'components/publish-wizard.tsx', props = { ...wizardProps, busy, progress, record: { visibility: 'restricted', hasPasscode: true, allowPdf: false, allowPptx: true, qaEnabled: true, qaAutoAnswer: false, narrationEnabled: true, narrationBudgetMinutes: 20, qaReserveMinutes: 4 } }
    assert.equal(serialize(harness(file, read(file), flag, props).render()), serialize(harness(file, prior(file), flag, props).render()))
    checks++
  }
  for (const props of [{ sessionId: null, slideCount: null }, { sessionId: 'owned-session', slideCount: 3 }]) {
    const file = 'components/narration-voice-picker.tsx'
    assert.equal(serialize(harness(file, read(file), flag, props).render()), serialize(harness(file, prior(file), flag, props).render()))
    checks++
  }
  const file = 'components/publish-dialog.tsx', props = { sessionId: 'owned-session', deckTitle: 'QA deck', slideCount: 3, hasFinalDeck: true }
  assert.equal(serialize(harness(file, read(file), flag, props).render()), serialize(harness(file, prior(file), flag, props).render()))
  checks++
}
// Exact source of the 0ed6298 close-focus repair is part of the contract above.
// Exercise the new stable trigger independently of its mutable tooltip/state.
const focusAst = parse('components/publish-dialog.tsx', read('components/publish-dialog.tsx'))
let focusExpression
function findFocus(node) { if (ts.isJsxAttribute(node) && node.name.getText(focusAst) === 'onCloseAutoFocus') focusExpression = node.initializer.expression; ts.forEachChild(node, findFocus) }
findFocus(focusAst)
assert.ok(focusExpression)
const focusCode = ts.transpileModule(`const STUDIO_PUBLISH = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'; (${focusExpression.getText(focusAst)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
for (const config of [{}, { isConnected: false }, { disabled: true }, { owner: 'another-session' }, { missing: true }]) {
  let prevented = 0, focused = 0
  const trigger = { isConnected: true, disabled: false, owner: 'owned-session', ...config, getAttribute: () => trigger.owner, focus: options => { assert.equal(options.preventScroll, true); focused++ } }
  const handler = vm.runInNewContext(focusCode, { process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' } }, sessionId: 'owned-session', returnFocusRef: { current: config.missing ? null : trigger } })
  handler({ preventDefault: () => prevented++ })
  const eligible = trigger.isConnected && !trigger.disabled && trigger.owner === 'owned-session' && !config.missing
  assert.equal(prevented, Number(eligible)); assert.equal(focused, Number(eligible)); checks++
}
const flatten = tree => Array.isArray(tree) ? tree.flatMap(flatten) : !tree || typeof tree !== 'object' ? [] : [tree, ...flatten(tree.props?.children)]
for (const enabled of [true, false]) for (const publishedCount of [null, 2, 3]) {
  const file = 'components/publish-dialog.tsx', current = harness(file, read(file), 'true', { sessionId: 'owned-session', deckTitle: 'QA deck', slideCount: 3, hasFinalDeck: enabled }, { 2: publishedCount })
  const trigger = flatten(current.render()).find(node => node.type === 'button')
  assert.equal(trigger.props['data-studio-publish-trigger'], 'true')
  assert.equal(trigger.props.disabled, !enabled)
  assert.equal(trigger.props['data-studio-publish-session'], 'owned-session')
  assert.equal(trigger.props.title, !enabled ? 'Publishing unlocks once the final deck is built' : publishedCount !== null && publishedCount !== 3 ? `Published ${publishedCount} slides · deck now has 3` : 'Publish this deck to a shareable link')
  assert.equal(flatten(trigger).filter(n => n.props?.['aria-hidden'] === true).length, Number(publishedCount !== null && publishedCount !== 3))
  assert.equal(trigger.props.children[0].type, 'Globe')
  checks++
}
// Returned voices remain authoritative, including unknown catalogue ids.
// Supplied responses exercise actual selection and estimate/confirmation paths.
const settle = async () => { for (let i = 0; i < 10; i++) await Promise.resolve() }
const returnedVoices = [
  { id: 'service-voice-a', name: 'Returned A', description: 'A complete returned description', costPerMinuteUsd: .002, firstAudioSeconds: .7, liveAnswers: true, sampleUrl: '/local-supplied-a.mp3' },
  { id: 'service-voice-b', name: 'Returned B', description: 'Another returned description', costPerMinuteUsd: .1, firstAudioSeconds: 9, liveAnswers: false, sampleUrl: '/local-supplied-b.mp3' },
]
const voiceFile = 'components/narration-voice-picker.tsx'
const voiceProps = { sessionId: 'owned-session', slug: 'owned-slug', slideCount: 3, hasBudget: true }
const voiceHarness = harness(voiceFile, read(voiceFile), 'true', voiceProps, { 0: returnedVoices, 6: false })
let voiceTree = voiceHarness.render()
const cards = flatten(voiceTree).filter(n => n.props?.['data-studio-voice-card'] === true)
assert.equal(cards.length, returnedVoices.length)
assert.equal(flatten(voiceTree).filter(n => n.props?.['data-studio-voice-preview'] === 'true').length, 2)
flatten(voiceTree).find(n => n.props?.['aria-label'] === 'Use Returned B').props.onClick()
await settle()
assert.deepEqual(voiceHarness.requests[0], { url: '/api/narration/voice', method: 'PATCH', body: { sessionId: 'owned-session', voiceId: 'service-voice-b' } })
voiceTree = voiceHarness.render()
assert.equal(flatten(voiceTree).find(n => n.props?.['aria-label'] === 'Returned B selected').props.disabled, true)
const buttonText = node => Array.isArray(node) ? node.map(buttonText).join('') : typeof node === 'string' || typeof node === 'number' ? String(node) : node?.props ? buttonText(node.props.children) : ''
flatten(voiceTree).find(n => n.type === 'Button' && buttonText(n) === 'Record the narration').props.onClick()
await settle()
assert.deepEqual(voiceHarness.requests[1], { url: '/api/narration/render', method: 'POST', body: { slug: 'owned-slug', estimate: true } })
voiceTree = voiceHarness.render()
flatten(voiceTree).find(n => n.type === 'Button' && buttonText(n) === 'Record for 3¢').props.onClick()
await settle()
assert.deepEqual(voiceHarness.requests[2], { url: '/api/narration/render', method: 'POST', body: { slug: 'owned-slug', estimate: false } })
for (const [state, props, action] of [
  [{ 5: { ok: false, reason: 'Native storage refusal' } }, voiceProps, 'Record the narration'],
  [{}, { ...voiceProps, slug: null }, 'Record the narration'],
  [{}, { ...voiceProps, hasBudget: false }, 'Write the script'],
]) {
  const blocked = harness(voiceFile, read(voiceFile), 'true', props, { 0: returnedVoices, 6: false, ...state })
  assert.equal(flatten(blocked.render()).find(n => n.type === 'Button' && buttonText(n) === action).props.disabled, true)
  assert.equal(blocked.requests.length, 0)
}
checks += 8
const css = read('components/studio-publish.css')
assert.match(css, /\.studio-publish-management \[role="tab"\]\[data-state="active"\][^}]*border-bottom-color: var\(--sp-accent\)/)
assert.match(css, /\.studio-narration-voices[^}]*repeat\(auto-fill, minmax\(130px, 1fr\)\)/)
assert.match(css, /\.studio-publish-body[^}]*overflow-y: auto/)
assert.match(css, /prefers-reduced-motion/)
assert.match(css, /\.studio-publish-audience label:focus-within/)
checks += 5
console.log(`Publish fidelity: ${checks} offline contract/default-off/actual-trigger/mutation checks pass. Rendered visual and connected behavior remain separate lead-owned gates.`)
