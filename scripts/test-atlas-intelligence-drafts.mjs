import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

// Offline component-event replay. No DOM, auth, storage, socket, or service is exercised.
const source = fs.readFileSync(new URL('../components/studio-personal/intelligence-workspace.tsx', import.meta.url), 'utf8')
const catalog = JSON.parse(fs.readFileSync(new URL('../components/studio-personal/model-catalog-snapshot.json', import.meta.url), 'utf8'))
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true })
assert.equal(compiled.diagnostics.length, 0)

let host
const react = {
  useState(initial) {
    const owner = host, index = owner.cursor++
    if (!(index in owner.state)) owner.state[index] = typeof initial === 'function' ? initial() : initial
    return [owner.state[index], value => { owner.state[index] = typeof value === 'function' ? value(owner.state[index]) : value }]
  },
  useRef(initial) {
    const index = host.cursor++
    return host.state[index] ??= { current: initial }
  },
  useEffect(effect, dependencies) {
    const index = host.cursor++, prior = host.effects[index]
    if (!prior || dependencies.some((value, i) => value !== prior.dependencies[i])) {
      prior?.cleanup?.()
      host.effects[index] = { dependencies, cleanup: effect() }
    }
  },
}
const jsx = (type, props) => ({ type, props: props || {} })
const workflowAction = function StudioWorkflowAction() {}
const listeners = new Map()
const module = { exports: {} }
vm.runInNewContext(compiled.outputText, {
  module, exports: module.exports,
  process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' } },
  requestAnimationFrame: callback => callback(),
  window: { addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: name => listeners.delete(name) },
  require(id) {
    if (id === 'react') return react
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    if (id === 'lucide-react') return new Proxy({}, { get: (_, name) => name })
    if (id.includes('model-catalog')) return { default: catalog }
    if (id.includes('studio-workflow-action')) return { StudioWorkflowAction: workflowAction }
    if (id.includes('app-header')) return { BackToBuilderButton: function BackToBuilderButton() {} }
    if (id.endsWith('.css')) return {}
    throw new Error(`Unmocked dependency: ${id}`)
  },
})
function createHost(component) {
  return { state: [], effects: [], cursor: 0, render(props = {}) { host = this; this.cursor = 0; return component(props) } }
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  return [tree, ...nodes(tree.props?.children)]
}
const text = tree => typeof tree === 'string' || typeof tree === 'number' ? String(tree)
  : Array.isArray(tree) ? tree.map(text).join('') : text(tree?.props?.children ?? '')
const find = (tree, predicate) => { const match = nodes(tree).find(predicate); assert.ok(match, 'Expected component control'); return match }
const button = (tree, label) => find(tree, node => node.type === 'button' && text(node) === label)
const workspace = createHost(module.exports.IntelligenceWorkspace)
let tree = workspace.render()
assert.equal(listeners.has('beforeunload'), false)
assert.equal(find(tree, node => node.props.className === 'sp-intelligence-view').props.hidden, false)
const selectTask = id => {
  find(tree, node => node.props.className === 'sp-workflow-task' && text(node).includes(catalog.tasks[id].label)).props.onClick()
  tree = workspace.render()
}
const editorElement = () => find(tree, node => node.type?.name === 'WorkflowBriefEditor')
const handoff = () => find(tree, node => node.type === workflowAction).props.brief
const author = value => { editorElement().props.onChange(value); tree = workspace.render() }

// The suggestion enters the actual editor, focuses it, and stages only the active task.
const editor = createHost(editorElement().type)
let editorTree = editor.render(editorElement().props)
let focusCount = 0
find(editorTree, node => node.type === 'textarea').props.ref.current = { focus: () => focusCount++ }
button(editorTree, 'Use suggested brief').props.onClick()
tree = workspace.render()
assert.equal(focusCount, 1)
assert.equal(editorElement().props.value, editorElement().props.starter)
assert.equal(handoff(), editorElement().props.value)
assert.equal(listeners.has('beforeunload'), true)
editorTree = editor.render(editorElement().props)
assert.equal(button(editorTree, 'Use suggested brief').props.disabled, true)
button(editorTree, 'Use suggested brief').props.onClick()
assert.equal(editorElement().props.value, editorElement().props.starter)

const authored = Object.fromEntries(Object.keys(catalog.tasks).map(id => [id, `My unsent ${id} brief`]))
for (const [id, value] of Object.entries(authored)) { selectTask(id); author(value); assert.equal(handoff(), value) }
button(tree, 'Design preview').props.onClick(); tree = workspace.render()
assert.equal(find(tree, node => node.props.className === 'sp-intelligence-view').props.hidden, true)
button(tree, 'Current workflows').props.onClick(); tree = workspace.render()
for (const [id, value] of Object.entries(authored)) { selectTask(id); assert.equal(editorElement().props.value, value) }

// Reset is recoverable across task/view changes; no replacement silently overwrites drafts.
button(tree, 'Reset local briefs').props.onClick(); tree = workspace.render()
assert.equal(listeners.has('beforeunload'), true, 'Undo-held drafts still need the leave warning')
assert.equal(button(tree, 'Reset local briefs').props.disabled, true)
for (const id of Object.keys(catalog.tasks)) { selectTask(id); assert.equal(editorElement().props.value, ''); assert.equal(handoff(), editorElement().props.starter) }
button(tree, 'Undo reset').props.onClick(); tree = workspace.render()
for (const [id, value] of Object.entries(authored)) { selectTask(id); assert.equal(editorElement().props.value, value) }
button(tree, 'Reset local briefs').props.onClick(); tree = workspace.render()
author('New work after reset')
assert.ok(!nodes(tree).some(node => node.type === 'button' && text(node) === 'Undo reset'), 'Stale undo cannot replace newly authored work')
author(' ')
editorTree = editor.render(editorElement().props)
assert.equal(button(editorTree, 'Use suggested brief').props.disabled, true, 'Whitespace is still authored input')

// Design choices stay example-only; its Apply control never submits anything.
const preview = createHost(find(tree, node => node.type?.name === 'ModelDesignPreview').type)
const previewTree = preview.render()
assert.equal(button(previewTree, 'Apply to Deckster').props.disabled, true)
assert.equal(button(previewTree, 'Apply to Deckster').props.onClick, undefined)
assert.ok(text(previewTree).includes('Prototype examples only'))
console.log('PASS: offline Intelligence suggestion focus, four-task/view continuity, reset/undo recovery, review-only handoff, and inactive model application')
