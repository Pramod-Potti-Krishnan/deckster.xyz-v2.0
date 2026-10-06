import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

// Actual native Arrange/Input/Select; supplied local props and callback records only.
// No iframe selection, edit mode, command ACK, service, save or delete occurs.
const jsx = (type, props, key) => ({ type, props, key })
const nodes = value => Array.isArray(value) ? value.flatMap(nodes) : !value || typeof value !== 'object' ? [] : [value, ...nodes(value.props?.children)]
const source = fs.readFileSync(new URL('../components/element-format-panel/tabs/arrange-tab.tsx', import.meta.url), 'utf8')
const names = [...source.matchAll(/const \[(\w+),\s*\w+\]\s*=\s*useState/g)].map(match => match[1])
const refuse = () => { throw new Error('Arrange fixture refuses service and iframe operations') }
const cn = (...values) => values.filter(Boolean).join(' ')
function fixture(flag) {
  let cursor = 0
  const state = {}, calls = []
  const imports = {
    react: { useState(initial) { const name = names[cursor++]; if (!(name in state)) state[name] = initial; return [state[name], value => { state[name] = typeof value === 'function' ? value(state[name]) : value }] }, useEffect() {} },
    'react/jsx-runtime': { jsx, jsxs: jsx }, '@/lib/utils': { cn },
    'lucide-react': Object.fromEntries(['ArrowDownToLine','ArrowUpToLine','ArrowDown','ArrowUp','FlipHorizontal','FlipVertical','Lock','Unlock','Link','Link2Off','ChevronDown'].map(name => [name, name])),
    './studio-arrange.css': {}, '@/components/ui/css-classes-input': { CSSClassesInput: 'CSSClassesInput' },
    '../types': { ALIGN_OPTIONS: ['left','center','right','top','middle','bottom'].map(value => ({ value, label: value })), DISTRIBUTE_OPTIONS: [] },
  }
  function load(relative) {
    const input = fs.readFileSync(new URL(relative, import.meta.url), 'utf8')
    const compiled = ts.transpileModule(input, { reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
    assert.equal((compiled.diagnostics || []).filter(item => item.category === ts.DiagnosticCategory.Error).length, 0)
    const mod = { exports: {} }
    vm.runInNewContext(compiled.outputText, { module: mod, exports: mod.exports, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: flag } }, fetch: refuse, window: { postMessage: refuse }, require: name => { assert.ok(name in imports, `Unexpected dependency ${name}`); return imports[name] } })
    return mod.exports
  }
  const { PanelInput } = load('../components/ui/panel/input.tsx')
  const { PanelSelect } = load('../components/ui/panel/select.tsx')
  imports['@/components/ui/panel'] = { PanelInput, PanelSelect, PanelSection: 'PanelSection', ControlRow: 'ControlRow', Divider: 'Divider' }
  const { ArrangeTab } = load('../components/element-format-panel/tabs/arrange-tab.tsx')
  const properties = { size: { width: 400, height: 200 }, position: { x: 11, y: 22 }, rotation: 40, flipped: { horizontal: false, vertical: true }, locked: false, cssClasses: ['native-unchanged'] }
  return { state, calls, properties, PanelInput, PanelSelect,
    render(values = {}, extra = {}) { Object.assign(state, values); cursor = 0; return ArrangeTab({ properties, elementId: 'synthetic-hero-props', isApplying: false, onSendCommand: async (action, payload) => { calls.push([action, { ...payload }]) }, ...extra }) },
    dom(tree) { const expand = value => Array.isArray(value) ? value.map(expand) : !value || typeof value !== 'object' ? value : typeof value.type === 'function' ? expand(value.type(value.props)) : { ...value, props: { ...value.props, children: expand(value.props?.children) } }; return expand(tree) },
  }
}
const labels = ['Width in points','Height in points','Horizontal position in points','Vertical position in points','Rotation angle in degrees']
for (const flag of ['true','false','TRUE',undefined]) {
  const test = fixture(flag), studio = flag === 'true'
  let tree = test.render(), dom = test.dom(tree)
  assert.equal(tree.props['data-studio-arrange'], studio ? 'true' : undefined)
  const inputs = nodes(dom).filter(node => node.type === 'input')
  assert.deepEqual(inputs.map(node => node.props['aria-label']), labels.map(label => studio ? label : undefined))
  assert.deepEqual(inputs.map(node => node.props.value), ['400','200','11','22','40'])
  assert.equal(inputs[4].props.min, 0); assert.equal(inputs[4].props.max, 360)
  const selects = nodes(dom).filter(node => node.type === 'select')
  assert.deepEqual(selects.map(node => node.props['aria-label']), ['Horizontal alignment','Vertical alignment'].map(label => studio ? label : undefined))
  assert.deepEqual(nodes(selects[0]).filter(node => node.type === 'option').map(node => node.props.value), ['','left','center','right'])
  assert.deepEqual(nodes(selects[1]).filter(node => node.type === 'option').map(node => node.props.value), ['','top','middle','bottom'])
  const buttons = nodes(tree).filter(node => node.type === 'button')
  assert.deepEqual(buttons.map(node => node.props['aria-pressed']), [undefined,undefined,undefined,undefined,studio ? false : undefined,studio ? false : undefined,studio ? true : undefined,studio ? false : undefined])
  for (const [title, command] of [['Send to Back','sendToBack'],['Send Backward','sendBackward'],['Bring Forward','bringForward'],['Bring to Front','bringToFront']]) {
    await buttons.find(node => node.props.title === title).props.onClick()
    assert.deepEqual(test.calls.at(-1), [command, { elementId: 'synthetic-hero-props' }])
  }
  await selects[0].props.onChange({ target: { value: 'center' } })
  assert.deepEqual(test.calls.at(-1), ['alignElement', { elementId: 'synthetic-hero-props', horizontal: 'center', vertical: undefined }])
  const count = test.calls.length
  inputs[0].props.onChange({ target: { value: '500' } }); assert.equal(test.calls.length, count)
  tree = test.render(); dom = test.dom(tree)
  await nodes(dom).find(node => node.type === 'input' && node.props.value === '500').props.onBlur()
  assert.deepEqual(test.calls.at(-1), ['resizeElement', { elementId: 'synthetic-hero-props', width: 500 }])
  nodes(tree).find(node => node.props?.title === 'Proportions unlinked').props.onClick()
  assert.equal(test.state.constrainProportions, true); assert.equal(test.state.aspectRatio, 2.5)
  tree = test.render({ width: '750' }); dom = test.dom(tree)
  await nodes(dom).find(node => node.type === 'input' && node.props.value === '750').props.onBlur()
  assert.deepEqual(test.calls.at(-1), ['resizeElement', { elementId: 'synthetic-hero-props', width: 750, height: 300, maintainAspectRatio: true }])
  assert.equal(test.state.height, '300')
  tree = test.render({ posX: '33', posY: '44', angle: '50' }); dom = test.dom(tree)
  await nodes(dom).find(node => node.type === 'input' && node.props.value === '33').props.onBlur()
  assert.deepEqual(test.calls.at(-1), ['positionElement', { elementId: 'synthetic-hero-props', x: 33, y: 44 }])
  await nodes(dom).find(node => node.type === 'input' && node.props.value === '50').props.onBlur()
  assert.deepEqual(test.calls.at(-1), ['rotateElement', { elementId: 'synthetic-hero-props', angle: 50 }])
  tree = test.render({ flippedH: false, flippedV: true, isLocked: false })
  const flipButtons = nodes(tree).filter(node => node.type === 'button')
  await flipButtons[5].props.onClick()
  assert.deepEqual(test.calls.at(-1), ['flipElement', { elementId: 'synthetic-hero-props', direction: 'horizontal' }])
  assert.equal(test.state.flippedH, true)
  await flipButtons[6].props.onClick()
  assert.deepEqual(test.calls.at(-1), ['flipElement', { elementId: 'synthetic-hero-props', direction: 'vertical' }])
  assert.equal(test.state.flippedV, false)
  await flipButtons[7].props.onClick()
  assert.deepEqual(test.calls.at(-1), ['lockElement', { elementId: 'synthetic-hero-props', locked: true }])
  assert.equal(test.state.isLocked, true)
  const classes = nodes(tree).find(node => node.type === 'CSSClassesInput')
  await classes.props.onChange(['native-unchanged', 'local-second'])
  assert.equal(test.calls.at(-1)[0], 'setElementClasses')
  assert.deepEqual(test.calls.at(-1)[1], { elementId: 'synthetic-hero-props', classes: ['native-unchanged', 'local-second'] })
  const beforeInvalid = test.calls.length
  tree = test.render({ width: 'invalid' }); dom = test.dom(tree)
  await nodes(dom).find(node => node.type === 'input' && node.props.value === 'invalid').props.onBlur()
  assert.equal(test.calls.length, beforeInvalid, 'native invalid numeric input emits no command')
  for (const [locked, applying] of [[false,true],[true,false],[true,true]]) {
    tree = test.render({ isLocked: locked }, { isApplying: applying }); dom = test.dom(tree)
    assert.ok(nodes(dom).filter(node => ['input','select'].includes(node.type)).every(node => node.props.disabled === (locked || applying)))
    const lock = nodes(tree).filter(node => node.type === 'button').at(-1)
    assert.equal(lock.props.disabled, applying, 'native unlock remains allowed when locked but not applying')
    assert.equal(lock.props['aria-pressed'], studio ? locked : undefined)
  }
  assert.deepEqual(test.properties.cssClasses, ['native-unchanged'])
  const defaultInput = test.PanelInput({ value: 'local', onChange: () => {} })
  assert.equal(nodes(defaultInput).find(node => node.type === 'input').props['aria-label'], undefined)
  const defaultSelect = test.PanelSelect({ options: [], value: '', onChange: () => {} })
  assert.equal(nodes(defaultSelect).find(node => node.type === 'select').props['aria-label'], undefined)
}
console.log('Actual Arrange/Input/Select passed: literal/classic named fields, native values/options/defaults, derived selected state, busy/lock gates, exact local order/align/resize/proportion/position/rotation callbacks and no-change-on-typing. No selection event, iframe/edit/save/delete/network or service ACK ran.')

// Supplied-props capture specimen: actual native wrapper forwards to actual ArrangeTab.
let fixtureCursor = 0
const fixtureCells = []
const fixtureImports = {
  react: { useState(initial) { const index = fixtureCursor++; if (!(index in fixtureCells)) fixtureCells[index] = initial; return [fixtureCells[index], value => { fixtureCells[index] = typeof value === 'function' ? value(fixtureCells[index]) : value }] }, useEffect() {}, useCallback: callback => callback },
  'react/jsx-runtime': { jsx, jsxs: jsx }, '@/lib/utils': { cn },
  'lucide-react': Object.fromEntries(['Trash2','Image','Table','BarChart3','LayoutGrid','GitBranch','Type','Layout','ArrowDownToLine','ArrowUpToLine','ArrowDown','ArrowUp','FlipHorizontal','FlipVertical','Lock','Unlock','Link','Link2Off'].map(name => [name,name])),
  '@/components/builder/studio-panels.css': {}, './studio-arrange.css': {}, '@/components/layout/studio-shell.css': {}, '@/components/builder/studio-canvas.css': {},
  '@/components/ui/css-classes-input': { CSSClassesInput: 'CSSClassesInput' },
  '@/components/ui/panel': { PanelInput: 'PanelInput', PanelSelect: 'PanelSelect', PanelSection: 'PanelSection', ControlRow: 'ControlRow', Divider: 'Divider' },
  './slide-format-panel': { SlideFormatPanel: refuse },
  '@/components/presentation-viewer': { PresentationViewer: 'NativePresentationViewer' },
}
function loadFixtureModule(relative) {
  const source = fs.readFileSync(new URL(relative, import.meta.url), 'utf8')
  const result = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
  assert.equal((result.diagnostics || []).filter(item => item.category === ts.DiagnosticCategory.Error).length, 0)
  const mod = { exports: {} }
  vm.runInNewContext(result.outputText, { module: mod, exports: mod.exports, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' } }, fetch: refuse, window: { postMessage: refuse }, require: name => { assert.ok(name in fixtureImports, `Unexpected specimen dependency ${name}`); return fixtureImports[name] } })
  return mod.exports
}
fixtureImports['@/types/elements'] = loadFixtureModule('../types/elements.ts')
fixtureImports['../types'] = loadFixtureModule('../components/element-format-panel/types.ts')
fixtureImports['./types'] = fixtureImports['../types']
const actualArrange = loadFixtureModule('../components/element-format-panel/tabs/arrange-tab.tsx')
fixtureImports['./tabs/arrange-tab'] = actualArrange
const actualPanel = loadFixtureModule('../components/element-format-panel/index.tsx')
fixtureImports['@/components/element-format-panel'] = actualPanel
const specimen = loadFixtureModule('./studio-v4/ten-hour-arrange-fixture.tsx')
const renderSpecimen = () => { fixtureCursor = 0; return specimen.default() }
let specimenTree = renderSpecimen()
const nativePanelNode = () => nodes(specimenTree).find(node => node.type === actualPanel.ElementFormatPanel)
assert.ok(nativePanelNode(), 'actual ElementFormatPanel imported directly')
assert.equal(nativePanelNode().props.elementType, 'hero')
assert.equal(nativePanelNode().props.properties.type, 'hero')
assert.equal(nativePanelNode().props.properties.heroType, 'title')
assert.equal(nativePanelNode().props.properties.zIndex, 3)
assert.equal(nativePanelNode().props.properties.cssClasses.length, 2)
const nativeWrapper = actualPanel.ElementFormatPanel(nativePanelNode().props)
assert.ok(nodes(nativeWrapper).find(node => node.type === actualArrange.ArrangeTab), 'real wrapper mounts actual ArrangeTab for supplied hero')
const viewer = nodes(specimenTree).find(node => node.type === 'NativePresentationViewer')
assert.equal(viewer.props.presentationId, 'studio-v4-local-renderer')
assert.equal(viewer.props.isGenerating, false); assert.equal(viewer.props.slideCount, 6)
assert.equal(viewer.props.onElementSelected, undefined, 'no mutation-bearing selection event handler fabricated')
const draftNode = () => nodes(specimenTree).find(node => node.props?.id === 'local-arrange-draft')
assert.equal(draftNode().props.value, specimen.ARRANGE_FIXTURE_DRAFT)
draftNode().props.onChange({ target: { value: 'Retained locally edited fixture draft' } })
specimenTree = renderSpecimen()
assert.equal(draftNode().props.value, 'Retained locally edited fixture draft')
const lockedNode = () => nodes(specimenTree).find(node => node.props?.id === 'local-arrange-locked')
for (const value of [true,false]) {
  lockedNode().props.onChange({ target: { checked: value } }); specimenTree = renderSpecimen()
  assert.equal(lockedNode().props.checked, value)
  assert.equal(nativePanelNode().props.properties.locked, value, 'local supplied toggle only; native props preserved')
}
await assert.rejects(nativePanelNode().props.onSendCommand('synthetic-local-refusal-check', {}), /refuses every command/)
await assert.rejects(nativePanelNode().props.onDelete(), /refuses deletion/)
specimenTree = renderSpecimen()
assert.equal(fixtureCells[2].commands, 1); assert.equal(fixtureCells[2].delete, 1)
assert.equal(draftNode().props.value, 'Retained locally edited fixture draft')
assert.equal(nativePanelNode().props.properties.locked, false)
assert.equal(specimen.ARRANGE_FIXTURE_PROPERTIES.locked, false, 'original supplied object untouched')
console.log('Honest Arrange specimen passed: actual ElementFormatPanel→actual ArrangeTab, complete Hero props, unchanged native viewer, retained local draft, both supplied lock states and explicit command/delete rejection counters. No selection/edit/save/network/service ACK ran.')
