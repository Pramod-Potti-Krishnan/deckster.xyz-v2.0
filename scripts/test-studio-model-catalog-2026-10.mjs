import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

// NEXT_PUBLIC_STUDIO_MODEL_CATALOG_2026_10 (default off). Offline: no DOM, auth, storage, socket or service is exercised.
//   1. flag OFF: the 2026-08-20.1 catalog file is byte-identical, and the Intelligence workspace renders to the exact bytes the base
//      branch produced (SHA-256 of react-dom/server output, recorded from the base branch with this same harness);
//   2. flag ON: no catalog entry, task list, default or draft mapping references a retired Gemini 2.5 id, each retired id maps to its
//      successor, and the successors carry their public metadata.
// MODEL_CATALOG_TEST_ROOT points the harness at another checkout (the base branch, or a mutated copy); MODEL_CATALOG_PRINT=1 prints hashes.
const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '..')
const ROOT = path.resolve(process.env.MODEL_CATALOG_TEST_ROOT || repo)
const require = createRequire(path.join(repo, 'package.json'))
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const reactJsxRuntime = require('react/jsx-runtime')

const workspaceDir = path.join(ROOT, 'components/studio-personal')
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex')
const readJson = name => JSON.parse(fs.readFileSync(path.join(workspaceDir, name), 'utf8'))

// Recorded once from the base branch (583f357) with this harness: the flag-off bytes must never change.
const BASE_CATALOG_FILE_SHA256 = '4a8cf55c79f25c79b51d7f1007de9a15a35217fa1ab960b005ad235e55f9b34f'
const BASE_RENDER_SHA256 = '378e65f07fedb5184e446271db5f9768d7c18d37d44555e7b8b3b8e8f3e60305'

const RETIRED = ['google/gemini-2.5-pro', 'google/gemini-2.5-flash', 'google/gemini-2.5-flash-lite']
const SUCCESSOR = {
  'google/gemini-2.5-flash': 'google/gemini-3-flash-preview',
  'google/gemini-2.5-flash-lite': 'google/gemini-3.1-flash-lite',
  'google/gemini-2.5-pro': 'google/gemini-3.1-pro-preview',
}

const baseFile = fs.readFileSync(path.join(workspaceDir, 'model-catalog-snapshot.json'))
const base = JSON.parse(baseFile.toString('utf8'))
const refreshedPath = path.join(workspaceDir, 'model-catalog-snapshot-2026-10.json')
const refreshedExists = fs.existsSync(refreshedPath)
const refreshed = refreshedExists ? readJson('model-catalog-snapshot-2026-10.json') : null

// ---- harness: the component source, compiled, with its imports mocked --------------------------------------------------------------
const source = fs.readFileSync(path.join(workspaceDir, 'intelligence-workspace.tsx'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true })
assert.equal(compiled.diagnostics.length, 0)

function load(flag, mode) {
  const env = { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }
  if (flag !== undefined) env.NEXT_PUBLIC_STUDIO_MODEL_CATALOG_2026_10 = flag
  let host
  const mockReact = {
    useState(initial) {
      const owner = host, index = owner.cursor++
      if (!(index in owner.state)) owner.state[index] = typeof initial === 'function' ? initial() : initial
      return [owner.state[index], value => { owner.state[index] = typeof value === 'function' ? value(owner.state[index]) : value }]
    },
    useRef(initial) { const index = host.cursor++; return host.state[index] ??= { current: initial } },
    useEffect() { host.cursor++ },
  }
  const mockJsx = (type, props) => ({ type, props: props || {} })
  const icon = name => function Icon() { return React.createElement('svg', { 'data-icon': String(name) }) }
  const stub = name => ({ [name]: function Stub() { return null } })
  const module = { exports: {} }
  vm.runInNewContext(compiled.outputText, {
    module, exports: module.exports, process: { env },
    require(id) {
      if (id === 'react') return mode === 'mock' ? mockReact : React
      if (id === 'react/jsx-runtime') return mode === 'mock' ? { jsx: mockJsx, jsxs: mockJsx, Fragment: 'Fragment' } : reactJsxRuntime
      if (id === 'lucide-react') return new Proxy({}, { get: (_, name) => mode === 'mock' ? name : icon(name) })
      if (id.endsWith('model-catalog-snapshot.json')) return { default: base }
      if (id.endsWith('model-catalog-snapshot-2026-10.json')) return { default: refreshed }
      if (id.includes('studio-workflow-action')) return { StudioWorkflowAction: function StudioWorkflowAction() { return React.createElement('button', { type: 'button' }, 'action') } }
      if (id.includes('app-header')) return { BackToBuilderButton: function BackToBuilderButton() { return React.createElement('button', { type: 'button' }, 'back') } }
      if (id.includes('studio-intro-replay')) return stub('StudioIntroReplay')
      if (id.endsWith('.css')) return {}
      throw new Error(`Unmocked dependency: ${id}`)
    },
  })
  return { exports: module.exports, setHost: value => { host = value } }
}

function renderHtml(flag) {
  const { exports } = load(flag, 'ssr')
  return renderToStaticMarkup(React.createElement(exports.IntelligenceWorkspace))
}

// Event replay of ModelDesignPreview with an in-memory hook host (same technique as test-atlas-intelligence-drafts.mjs).
function previewHost(flag) {
  const loaded = load(flag, 'mock')
  const workspace = { state: [], cursor: 0, render() { loaded.setHost(this); this.cursor = 0; return loaded.exports.IntelligenceWorkspace({}) } }
  const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)]
  const text = tree => typeof tree === 'string' || typeof tree === 'number' ? String(tree) : Array.isArray(tree) ? tree.map(text).join('') : tree && typeof tree === 'object' ? text(tree.props?.children ?? '') : ''
  const element = nodes(workspace.render()).find(node => node.type?.name === 'ModelDesignPreview')
  assert.ok(element, 'Expected ModelDesignPreview')
  const preview = { state: [], cursor: 0, render() { loaded.setHost(this); this.cursor = 0; return element.type({}) } }
  return { preview, nodes, text, exports: loaded.exports }
}
const optionValues = (nodes, tree) => nodes(tree).filter(node => node.type === 'option').map(node => node.props.value)
const row = (nodes, text, tree, label) => {
  const tr = nodes(tree).find(node => node.type === 'tr' && text(node).startsWith(label))
  return tr && nodes(tr).filter(node => node.type === 'td').map(text)
}

// ---- 1. flag OFF: nothing may change ----------------------------------------------------------------------------------------------
const baseFileSha = sha256(baseFile)
const offHtml = renderHtml(undefined)
if (process.env.MODEL_CATALOG_PRINT) console.log(JSON.stringify({ baseFileSha, renderSha: sha256(offHtml), renderBytes: offHtml.length }))
assert.equal(baseFileSha, BASE_CATALOG_FILE_SHA256, '2026-08-20.1 catalog file must stay byte-identical')
for (const flag of [undefined, '', 'false', '0', '1', 'TRUE', 'True', 'yes', ' true']) {
  assert.equal(sha256(renderHtml(flag)), BASE_RENDER_SHA256, `flag ${JSON.stringify(flag)}: the Intelligence workspace must render the exact base bytes`)
}
assert.ok(offHtml.includes(base.version) && offHtml.includes('Gemini 2.5 Pro') && offHtml.includes('Snapshot specifications only. Speed, quality, pricing, and live availability have not been verified.'))
assert.ok(!offHtml.includes('Release status') && !offHtml.includes('Price per 1M'), 'extra comparison rows are flag-on only')
{ // flag-off draft behaviour: the old retired ids are still ordinary choices
  const { preview, nodes, exports } = previewHost(undefined)
  assert.equal(exports.resolveRetiredModel('google/gemini-2.5-pro'), 'google/gemini-2.5-pro')
  let tree = preview.render()
  const select = () => nodes(tree).find(node => node.type === 'select' && node.props.id === 'sp-model-planning_strategy')
  assert.ok(optionValues(nodes, tree).includes('google/gemini-2.5-pro'))
  select().props.onChange({ target: { value: 'google/gemini-2.5-pro' } })
  tree = preview.render()
  assert.equal(select().props.value, 'google/gemini-2.5-pro')
}

// ---- 2. flag ON ----------------------------------------------------------------------------------------------------------------------
assert.ok(refreshedExists, 'model-catalog-snapshot-2026-10.json is missing')
const RETIRED_SET = new Set(RETIRED)
assert.notEqual(refreshed.version, base.version)
assert.match(refreshed.version, /^2026-10-\d\d\.\d+$/)

// no entry, task list or default references a retired id
for (const [taskId, task] of Object.entries(refreshed.tasks)) {
  assert.deepEqual(Object.keys(base.tasks), Object.keys(refreshed.tasks), 'same four tasks')
  assert.ok(!RETIRED_SET.has(task.defaultModel), `${taskId} default is retired`)
  assert.ok(task.models.includes(task.defaultModel), `${taskId} default is not in its own list`)
  assert.equal(new Set(task.models).size, task.models.length, `${taskId} lists a model twice`)
  for (const id of task.models) {
    assert.ok(!RETIRED_SET.has(id), `${taskId} still lists retired ${id}`)
    assert.ok(refreshed.models[id], `${taskId} lists ${id}, which has no catalog entry`)
  }
}
for (const id of Object.keys(refreshed.models)) assert.ok(!RETIRED_SET.has(id), `catalog entry ${id} is retired`)
for (const id of Object.keys(refreshed.models)) assert.ok(Object.values(refreshed.tasks).some(task => task.models.includes(id)), `${id} is in no task list`)
// the draft/default mapping: exactly the three retired ids, each to the chosen live successor
assert.deepEqual(Object.keys(refreshed.retiredModels).sort(), [...RETIRED].sort())
for (const [id, entry] of Object.entries(refreshed.retiredModels)) {
  assert.equal(entry.successor, SUCCESSOR[id], `${id} must map to ${SUCCESSOR[id]}`)
  assert.ok(refreshed.models[entry.successor], `${id} successor ${entry.successor} has no entry`)
  assert.ok(!RETIRED_SET.has(entry.successor), `${id} successor is itself retired`)
  assert.equal(entry.retiresOn, '2026-10-16')
}
// the model that stays untouched: 2.5 Flash Image is not on the retirement list
assert.equal(refreshed.tasks.imagery.defaultModel, 'google/gemini-2.5-flash-image')
assert.deepEqual(refreshed.tasks.imagery, base.tasks.imagery)
for (const id of ['google/gemini-2.5-flash-image', 'google/gemini-3.1-flash-image-preview', 'google/gemini-3.5-flash']) {
  for (const key of Object.keys(base.models[id])) assert.deepEqual(refreshed.models[id][key], base.models[id][key], `${id}.${key} must carry over`)
}
// successors carry accurate public metadata (OpenRouter public model list, 13 Oct 2026; Google model pages for the labels)
const expected = {
  'google/gemini-3-flash-preview': { name: 'Gemini 3 Flash Preview', releaseStage: 'preview', input: 0.5, output: 3 },
  'google/gemini-3.1-pro-preview': { name: 'Gemini 3.1 Pro Preview', releaseStage: 'preview', input: 2, output: 12 },
  'google/gemini-3.1-flash-lite': { name: 'Gemini 3.1 Flash Lite', releaseStage: 'ga', input: 0.25, output: 1.5 },
}
for (const [id, want] of Object.entries(expected)) {
  const model = refreshed.models[id]
  assert.equal(model.name, want.name)
  assert.equal(model.provider, 'Google')
  assert.equal(model.contextWindow, 1048576)
  assert.equal(model.imageOutput, false)
  assert.equal(model.tools, true)
  assert.equal(model.structuredOutput, true)
  assert.equal(model.releaseStage, want.releaseStage)
  assert.deepEqual([...model.inputModalities].sort(), ['audio', 'file', 'image', 'text', 'video'])
  assert.deepEqual(model.pricePerMillionTokens, { input: want.input, output: want.output })
}

// rendered: only live names, only successors, the extra rows
const onHtml = renderHtml('true')
assert.notEqual(sha256(onHtml), BASE_RENDER_SHA256)
assert.ok(onHtml.includes(refreshed.version) && !onHtml.includes(base.version))
for (const id of RETIRED) assert.ok(!onHtml.includes(`value="${id}"`), `${id} is still an option`)
assert.ok(!/google\/gemini-2\.5-(pro|flash-lite|flash)(?![-\w])/.test(onHtml), 'a retired id is rendered')
for (const name of ['Gemini 2.5 Pro', 'Gemini 2.5 Flash Lite', 'Gemini 2.5 Flash']) assert.ok(!onHtml.includes(`>${name}<`) && !onHtml.includes(`· ${name}<`), `${name} is rendered`)
for (const name of ['Gemini 3 Flash Preview', 'Gemini 3.1 Pro Preview', 'Gemini 3.1 Flash Lite', 'Gemini 2.5 Flash Image']) assert.ok(onHtml.includes(name), `${name} is missing`)
for (const text of ['Release status', 'Input types', 'Structured output', 'Price per 1M tokens', '$0.50 in / $3.00 out', '$2.00 in / $12.00 out', 'Snapshot specifications and public list prices only.']) assert.ok(onHtml.includes(text), `${text} is missing`)
assert.ok(!onHtml.includes('pricing, and live availability'), 'the old "pricing not verified" note must be replaced')

// draft mapping: a retired id (e.g. a draft saved before the refresh) resolves to its successor; nothing dangles
{
  const { preview, nodes, text, exports } = previewHost('true')
  for (const [id, successor] of Object.entries(SUCCESSOR)) {
    assert.equal(exports.resolveRetiredModel(id), successor)
    assert.equal(exports.resolveRetiredModel(successor), successor)
  }
  assert.equal(exports.resolveRetiredModel('google/gemini-2.5-flash-image'), 'google/gemini-2.5-flash-image')
  assert.equal(exports.resolveRetiredModel('default'), 'default')
  let tree = preview.render()
  const select = task => nodes(tree).find(node => node.type === 'select' && node.props.id === `sp-model-${task}`)
  for (const task of Object.keys(refreshed.tasks)) assert.ok(!optionValues(nodes, nodes(tree).find(node => node.props?.id === `sp-model-${task}`)).some(id => RETIRED_SET.has(id)))
  select('planning_strategy').props.onChange({ target: { value: 'google/gemini-2.5-pro' } })
  tree = preview.render()
  assert.equal(select('planning_strategy').props.value, 'google/gemini-3.1-pro-preview')
  select('content_writing').props.onChange({ target: { value: 'google/gemini-2.5-flash-lite' } })
  tree = preview.render()
  assert.equal(select('content_writing').props.value, 'google/gemini-3.1-flash-lite')
  select('research_analysis').props.onChange({ target: { value: 'google/gemini-2.5-flash' } })
  tree = preview.render()
  assert.equal(select('research_analysis').props.value, 'google/gemini-3-flash-preview')
  // a successor this task does not offer is ignored, not stored: the draft cannot hold an id the picker has no option for
  select('content_writing').props.onChange({ target: { value: 'google/gemini-2.5-pro' } })
  tree = preview.render()
  assert.equal(select('content_writing').props.value, 'google/gemini-3.1-flash-lite')
  for (const task of Object.keys(refreshed.tasks)) {
    const value = select(task).props.value
    assert.ok(value === 'default' || refreshed.tasks[task].models.includes(value), `${task} draft holds ${value}`)
    assert.ok(!RETIRED_SET.has(value))
  }
  // the comparison rows show the metadata of what is picked
  const prices = row(nodes, text, tree, 'Price per 1M tokens')
  assert.ok(prices && prices.every(cell => /^\$\d+\.\d\d in \/ \$\d+\.\d\d out$/.test(cell)), `price cells: ${JSON.stringify(prices)}`)
  assert.deepEqual(row(nodes, text, tree, 'Release status'), ['Preview', 'Preview'])
}

console.log('PASS: model catalog 2026-10 off = base bytes (catalog file + rendered workspace); on = no retired Gemini 2.5 id anywhere, drafts map to successors, successor metadata present')
