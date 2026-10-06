import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

// Execute native useGenerationPanel methods/state and the actual Add Element
// callback/lifecycle. All Layout responses are supplied local values; there is
// no React DOM, browser, iframe command, service request or acknowledgement.
const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const parse = (path, text = read(path)) => {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  assert.equal(source.parseDiagnostics.length, 0, `${path} syntax`)
  return source
}
function find(root, predicate) {
  if (predicate(root)) return root
  let match
  ts.forEachChild(root, child => { if (!match) match = find(child, predicate) })
  return match
}
const declaration = (source, name) => {
  const node = find(source, node => ts.isVariableDeclaration(node) && node.name.getText(source) === name)
  assert.ok(node, name)
  return node.initializer
}
const printer = ts.createPrinter({ removeComments: true })
const print = (node, source) => printer.printNode(ts.EmitHint.Unspecified, node, source)
const evaluate = (text, context) => vm.runInNewContext(ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context)
const moduleCache = new Map()
function pure(path) {
  if (moduleCache.has(path)) return moduleCache.get(path)
  const module = { exports: {} }
  const context = { module, exports: module.exports, require: name => {
    assert.ok(name.startsWith('@/lib/') || name.startsWith('@/types/'), `unexpected pure dependency ${name}`)
    return pure(`${name.slice(2)}.ts`)
  } }
  evaluate(read(path), context)
  moduleCache.set(path, module.exports)
  return module.exports
}
const hook = parse('hooks/use-textlabs-generation.ts')
const client = parse('lib/textlabs-client.ts')
const BASELINE_REF = '61b97c6c19a4a8560e92da9d52425d260d9c3a28'
const baselineHook = parse('before.ts', execFileSync('git', ['show', `${BASELINE_REF}:hooks/use-textlabs-generation.ts`], { encoding: 'utf8' }))
const callback = declaration(hook, 'handleOpenPanel').arguments[0]
const baselineCallback = declaration(baselineHook, 'handleOpenPanel').arguments[0]
assert.equal(print(declaration(hook, 'handleGenerate'), hook), print(declaration(baselineHook, 'handleGenerate'), baselineHook), 'generation callback stays exact native source')
const mutationPayload = (node, source) => find(node, n => ts.isCallExpression(n) && n.expression.getText(source) === 'layoutServiceApis.sendElementCommand').arguments[1]
assert.equal(print(mutationPayload(callback, hook), hook), print(mutationPayload(baselineCallback, baselineHook), baselineHook), 'all native insertion payload keys/values stay exact')
const defaults = find(client, node => ts.isFunctionDeclaration(node) && node.name?.text === 'getDefaultSize')
const placeholder = find(hook, node => ts.isFunctionDeclaration(node) && node.name?.text === 'buildPlaceholderHtml')
const presentationUpdate = find(hook, node => ts.isIfStatement(node) && node.expression.getText(hook).includes('activePresentationTargetRef.current.presentationId'))
const lifecycle = find(hook, node => ts.isCallExpression(node) && node.expression.getText(hook) === 'useEffect' && node.arguments[0]?.getText(hook).includes('generationHookMountedRef.current = true')).arguments[0]

function nativePanel(studio, sourceText = read('hooks/use-generation-panel.ts')) {
  const cells = []
  let cursor = 0, effects = []
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in cells)) cells[index] = typeof initial === 'function' ? initial() : initial
      return [cells[index], next => { cells[index] = typeof next === 'function' ? next(cells[index]) : next }]
    },
    useRef(initial) {
      const index = cursor++
      if (!(index in cells)) cells[index] = { current: initial }
      return cells[index]
    },
    useCallback(fn) { return fn },
    useEffect(fn) { effects.push(fn) },
  }
  const module = { exports: {} }
  evaluate(sourceText, { module, exports: module.exports, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: studio } }, require: name => name === 'react' ? react : pure(`${name.slice(2)}.ts`) })
  function render() {
    cursor = 0; effects = []
    const panel = module.exports.useGenerationPanel()
    for (const effect of effects) effect()
    return panel
  }
  return { render }
}
function harness(studio, send = async () => ({ success: true, elementId: 'supplied-placeholder' }), useBaseline = false) {
  const events = [], tracked = new Map(), panel = nativePanel(studio)
  const c = {
    studio: studio === 'true', presentationId: 'presentation-A', currentSlideIndex: 2,
    getCurrentSlideIndex: () => c.liveSlide, liveSlide: 2,
    generationHookMountedRef: { current: true }, placeholderMountRevisionRef: { current: 0 },
    activePresentationTargetRef: { current: { presentationId: 'presentation-A', epoch: 0 } },
    pendingPlaceholderAddsRef: { current: new Set() }, placeholderSequenceRef: { current: 0 },
    freshDiagramAttemptHandoffsRef: { current: new Map() },
    generationPanel: panel.render(),
    ...pure('types/textlabs.ts'), ...pure('lib/element-geometry.ts'),
    Date: { now: () => 123456 }, console: { warn: () => {} },
    blankElements: { addElement: info => { tracked.set(info.elementId, info); events.push(['tracked', info]) } },
    layoutServiceApis: { sendElementCommand: (...args) => { events.push(['command', ...args]); return c.send(...args) } },
    send,
    toast: value => events.push(['toast', value]),
  }
  evaluate(`${print(placeholder, hook)}; ${print(defaults, client).replace(/^export /, '')}; globalThis.renderOwner = () => { ${print(presentationUpdate, hook)} }; globalThis.setup = ${print(lifecycle, hook)}; globalThis.cleanup = globalThis.setup();`, c)
  const originalCallback = useBaseline ? baselineCallback : callback
  const originalSource = useBaseline ? baselineHook : hook
  function bind() {
    c.generationPanel = panel.render()
    evaluate(`globalThis.open = (() => { const renderPresentationTarget = activePresentationTargetRef.current; const generationPanel = globalThis.generationPanel; return ${print(originalCallback, originalSource)} })();`, c)
  }
  function current() { return panel.render() }
  function changePresentation(id) { c.presentationId = id; c.renderOwner(); bind() }
  bind()
  return { c, events, tracked, panel, bind, current, changePresentation }
}
let cases = 0
const metadata = { success: true, elementId: 'owned-placeholder', themeVariantId: 'native-theme-variant', themeBindings: { text: 'text-primary' } }
for (const outcome of [metadata, { success: false, error: 'Supplied Layout refusal' }, new Error('Command timeout')]) {
  const h = harness('true', async () => { if (outcome instanceof Error) throw outcome; return outcome })
  await h.c.open('CHART')
  const panel = h.current()
  if (outcome === metadata) {
    assert.equal(panel.blankElementId, metadata.elementId)
    assert.equal(panel.elementType, 'CHART')
    assert.equal(panel.mode, 'generate')
    const tracked = h.tracked.get(metadata.elementId)
    assert.equal(tracked.slideIndex, 2)
    assert.equal(tracked.themeVariantId, metadata.themeVariantId)
    assert.equal(JSON.stringify(tracked.themeBindings), JSON.stringify(metadata.themeBindings))
  } else {
    assert.equal(h.tracked.size, 0)
    assert.equal(panel.isOpen, false)
    assert.ok(panel.error)
    assert.equal(h.events.filter(event => event[0] === 'toast').length, 1)
  }
  assert.equal(h.c.pendingPlaceholderAddsRef.current.size, 0)
  cases++
}
{
  let finish
  const h = harness('true', () => new Promise(resolve => { finish = resolve }))
  const first = h.c.open('CHART')
  const revision = h.current().getIntentRevision()
  await h.c.open('CHART')
  assert.equal(h.events.filter(event => event[0] === 'command').length, 1)
  assert.equal(h.current().getIntentRevision(), revision, 'ignored duplicate does not retire original intent')
  finish(metadata); await first
  assert.equal(h.current().blankElementId, metadata.elementId)
  assert.equal(h.c.pendingPlaceholderAddsRef.current.size, 0)
  cases++
}
for (const order of ['new-first', 'old-first']) {
  const resolutions = []
  const h = harness('true', () => new Promise(resolve => resolutions.push(resolve)))
  const old = h.c.open('CHART'), latest = h.c.open('TEXT_BOX')
  const commands = h.events.filter(event => event[0] === 'command')
  assert.equal(commands.length, 2)
  assert.notEqual(commands[0][2].elementId, commands[1][2].elementId, 'same-clock distinct additions retain unique blank_ identity')
  if (order === 'new-first') {
    resolutions[1]({ ...metadata, elementId: 'latest-placeholder' }); await latest
    h.current().updateCurrentDraft({ prompt: 'Newest native draft' })
    resolutions[0]({ ...metadata, elementId: 'older-placeholder' }); await old
  } else {
    resolutions[0]({ ...metadata, elementId: 'older-placeholder' }); await old
    assert.equal(h.current().isOpen, false, 'older ACK tracks without auto-opening')
    resolutions[1]({ ...metadata, elementId: 'latest-placeholder' }); await latest
    h.current().updateCurrentDraft({ prompt: 'Newest native draft' })
  }
  assert.equal(h.tracked.size, 2, 'both confirmed same-presentation placeholders remain recoverable')
  assert.equal(h.current().elementType, 'TEXT_BOX')
  assert.equal(h.current().blankElementId, 'latest-placeholder')
  assert.equal(h.current().currentDraft.prompt, 'Newest native draft')
  cases++
}
const panelChanges = [
  ['close', p => p.closePanel()],
  ['open blank', p => p.openPanelForElement('TABLE', 'new-blank')],
  ['resume', p => p.resumePanelForElement('TABLE', 'new-resumed')],
  ['edit', p => p.openPanelForEdit('TABLE', 'new-edit')],
  ['refine', p => p.openPanelForRefine('TABLE', { elementId: 'new-refine', elementType: 'TABLE', slideIndex: 2 })],
  ['type', p => p.changeElementType('TABLE')],
  ['replacement', p => p.completeBlankReplacement('TEXT_BOX', 'previous-blank', { elementId: 'native-replacement', elementType: 'TEXT_BOX', slideIndex: 2 })],
  ['draft', p => p.updateCurrentDraft({ prompt: 'New raw native draft', formData: { componentType: 'TEXT_BOX', prompt: 'Retained complete draft', useDeckTheme: true } })],
]
for (const [name, change] of panelChanges) {
  for (const outcome of [metadata, { success: false, error: 'Supplied old failure' }, new Error('Command timeout')]) {
    let finish, reject
    const h = harness('true', () => new Promise((resolve, fail) => { finish = resolve; reject = fail }))
    h.current().openPanelForElement('TEXT_BOX', 'previous-blank')
    h.bind()
    const result = h.c.open('CHART')
    // Do not render between invoking the native method and resolving the ACK;
    // the synchronous revision must protect React's still-stale snapshot.
    change(h.c.generationPanel)
    const expectedRevision = h.current().getIntentRevision()
    const expected = JSON.stringify({ ...h.current(), currentDraft: h.current().currentDraft })
    if (outcome instanceof Error) reject(outcome); else finish(outcome)
    await result
    assert.equal(h.current().getIntentRevision(), expectedRevision, `${name}: late result never changes active panel intent`)
    assert.equal(JSON.stringify({ ...h.current(), currentDraft: h.current().currentDraft }), expected)
    assert.equal(h.events.filter(event => event[0] === 'toast').length, 0)
    assert.equal(h.tracked.size, outcome === metadata ? 1 : 0)
    if (outcome === metadata) assert.equal(h.tracked.get(metadata.elementId).slideIndex, 2)
    assert.equal(h.c.pendingPlaceholderAddsRef.current.size, 0)
    cases++
  }
}
for (const outcome of [metadata, { success: false }, new Error('Command timeout')]) {
  let finish, reject
  const h = harness('true', () => new Promise((resolve, fail) => { finish = resolve; reject = fail }))
  const result = h.c.open('CHART')
  h.c.liveSlide = 5
  if (outcome instanceof Error) reject(outcome); else finish(outcome)
  await result
  assert.equal(h.current().isOpen, false)
  assert.equal(h.current().error, null)
  assert.equal(h.events.filter(event => event[0] === 'toast').length, 0)
  assert.equal(h.tracked.size, outcome === metadata ? 1 : 0)
  if (outcome === metadata) assert.equal(h.tracked.get(metadata.elementId).slideIndex, 2)
  cases++
}
for (const retirement of ['presentation B', 'A B A', 'unmount', 'cleanup setup']) {
  for (const outcome of [metadata, { success: false }, new Error('Command timeout')]) {
    let finish, reject
    const h = harness('true', () => new Promise((resolve, fail) => { finish = resolve; reject = fail }))
    const result = h.c.open('CHART')
    if (retirement === 'presentation B' || retirement === 'A B A') h.changePresentation('presentation-B')
    if (retirement === 'A B A') h.changePresentation('presentation-A')
    if (retirement === 'unmount' || retirement === 'cleanup setup') h.c.cleanup()
    if (retirement === 'cleanup setup') h.c.cleanup = h.c.setup()
    if (outcome instanceof Error) reject(outcome); else finish(outcome)
    await result
    assert.equal(h.tracked.size, 0, `${retirement}: old placeholder never enters current deck map`)
    assert.equal(h.current().isOpen, false)
    assert.equal(h.current().error, null)
    assert.equal(h.events.filter(event => event[0] === 'toast').length, 0)
    assert.equal(h.c.pendingPlaceholderAddsRef.current.size, 0)
    cases++
  }
}
for (const oldOutcome of [{ success: false, error: 'Old native failure' }, new Error('Old rejection')]) {
  let finishOld, rejectOld, finishNew
  const h = harness('true', (_action, params) => new Promise((resolve, reject) => {
    if (params.componentType === 'CHART') { finishOld = resolve; rejectOld = reject } else finishNew = resolve
  }))
  const old = h.c.open('CHART'), latest = h.c.open('TEXT_BOX')
  if (oldOutcome instanceof Error) rejectOld(oldOutcome); else finishOld(oldOutcome)
  await old
  assert.equal(h.current().error, null)
  assert.equal(h.events.filter(event => event[0] === 'toast').length, 0)
  assert.equal(h.c.pendingPlaceholderAddsRef.current.size, 1, 'old finally cannot retire another component admission')
  finishNew({ ...metadata, elementId: 'latest-placeholder' }); await latest
  assert.equal(h.current().blankElementId, 'latest-placeholder')
  cases++
}
{
  let finishOld, finishNew
  const h = harness('true', () => new Promise(resolve => { finishOld = resolve }))
  const old = h.c.open('CHART')
  h.c.cleanup(); h.c.cleanup = h.c.setup()
  h.c.send = () => new Promise(resolve => { finishNew = resolve })
  const latest = h.c.open('CHART')
  assert.equal(h.events.filter(event => event[0] === 'command').length, 2, 'new mount can admit same type while retired owner awaits')
  finishOld(metadata); await old
  assert.equal(h.c.pendingPlaceholderAddsRef.current.size, 1, 'retired mount cleanup cannot delete new mount admission')
  finishNew({ ...metadata, elementId: 'remounted-placeholder' }); await latest
  assert.equal(h.current().blankElementId, 'remounted-placeholder')
  assert.equal(h.tracked.size, 1)
  assert.equal(h.c.pendingPlaceholderAddsRef.current.size, 0)
  cases++
}
{
  const h = harness('true')
  const oldCallback = h.c.open
  h.changePresentation('presentation-B')
  await oldCallback('CHART')
  assert.equal(h.events.filter(event => event[0] === 'command').length, 0, 'old render callback cannot revive another presentation')
  h.c.cleanup()
  await h.c.open('CHART')
  assert.equal(h.events.filter(event => event[0] === 'command').length, 0, 'disposed hook refuses new admission')
  cases++
}
// Classic flags remain default-off. Compare actual baseline/current state,
// native payload, original blank_ ID, receipts and failure notices.
for (const flag of [undefined, 'false', 'TRUE']) {
  for (const outcome of [metadata, { success: false }, new Error('Command timeout')]) {
    const run = async baseline => {
      const h = harness(flag, async () => { if (outcome instanceof Error) throw outcome; return outcome }, baseline)
      await h.c.open('CHART')
      const panel = { ...h.current() }
      delete panel.getIntentRevision; delete panel.claimInsertionIntent
      return JSON.stringify({ panel, events: h.events, tracked: [...h.tracked.values()] })
    }
    assert.equal(await run(false), await run(true), 'classic admission outcome remains native baseline')
    cases++
  }
}
const oldPanelText = execFileSync('git', ['show', `${BASELINE_REF}:hooks/use-generation-panel.ts`], { encoding: 'utf8' })
for (const flag of [undefined, 'false', 'TRUE']) {
  const sequence = text => {
    const renderer = nativePanel(flag, text)
    let p = renderer.render()
    p.openPanelForElement('TEXT_BOX', 'native-blank'); p = renderer.render()
    p.updateCurrentDraft({ prompt: 'Native draft', showAdvanced: true }); p = renderer.render()
    p.resumePanelForElement('TEXT_BOX', 'native-resumed'); p = renderer.render()
    p.openPanelForRefine('TABLE', { elementId: 'native-table', elementType: 'TABLE', slideIndex: 2 }); p = renderer.render()
    p.closePanel(); p = renderer.render()
    p.changeElementType('IMAGE'); p = renderer.render()
    const result = { ...p }; delete result.getIntentRevision; delete result.claimInsertionIntent
    return JSON.stringify(result)
  }
  assert.equal(sequence(read('hooks/use-generation-panel.ts')), sequence(oldPanelText), 'classic real panel methods retain state/draft/research behavior')
  cases++
}
console.log(`Studio Add Element ownership: ${cases} offline actual-hook cases passed; literal gating/classic parity, exact payload, duplicate/distinct admission, confirmed tracking, native close/edit/refine/resume/type/draft intent, slide/presentation epoch, mount cleanup/remount and success/false/throw. No service write or acknowledgement performed.`)
