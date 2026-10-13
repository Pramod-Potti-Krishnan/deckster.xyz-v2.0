import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

// NEXT_PUBLIC_STUDIO_INTELLIGENCE_POLISH (default off), independent of NEXT_PUBLIC_STUDIO_MODEL_CATALOG_2026_10. Offline: no DOM, auth, socket or service.
//   1. flag OFF (with the catalog flag off AND on): the Intelligence workspace renders to the exact bytes of its base (SHA-256 of react-dom/server
//      output, recorded from PR #377's head e4fb4da with this harness), and the stylesheet cannot match any flag-off element;
//   2. flag ON: Design preview keeps its draft in this browser and restores it (with the view) on reload, through resolveRetiredModel; every storage
//      access is guarded; with no storage the draft is session-only and leaving is warned about; Reset draft clears it; the scope toggle, readiness
//      popup, "Managed by Deckster" section, single status pill and single note are there; nothing is requested, sent, or saved to an account.
// POLISH_TEST_ROOT points the harness at another checkout (the base branch, or a mutated copy); POLISH_PRINT=1 prints the hashes it computes.
const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '..')
const ROOT = path.resolve(process.env.POLISH_TEST_ROOT || repo)
const require = createRequire(path.join(repo, 'package.json'))
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup, renderToString } = require('react-dom/server')
const reactJsxRuntime = require('react/jsx-runtime')

const workspaceDir = path.join(ROOT, 'components/studio-personal')
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex')
const readJson = name => JSON.parse(fs.readFileSync(path.join(workspaceDir, name), 'utf8'))
const base = readJson('model-catalog-snapshot.json')
const refreshed = readJson('model-catalog-snapshot-2026-10.json')

// Recorded once from PR #377's head (e4fb4da, the base of this branch) with this harness: the flag-off bytes must never change.
//   static = renderToStaticMarkup, string = renderToString (keeps the text-node separators a hydrating page gets)
const BASE_RENDER_SHA256 = {
  'catalog-off': { static: '378e65f07fedb5184e446271db5f9768d7c18d37d44555e7b8b3b8e8f3e60305', string: '364b6ce51ebf468f45d67cfb0f8b8fd2ac7a387e131d1124f8feea9e4d0a6324' },
  'catalog-on': { static: '08fda605174852e6969bcd90013649fa64911a1ac7b378e4a0f1c9943182d142', string: '258dfa99a9791589823598765cd6429fa9817228f3f0ce50aee04f377d319751' },
}

// ---- harness: the component source, compiled; its imports mocked --------------------------------------------------------------------
const source = fs.readFileSync(path.join(workspaceDir, 'intelligence-workspace.tsx'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true })
assert.equal(compiled.diagnostics.length, 0)

class FakeNode {}
function load({ catalog, polish, hooks, win, doc }) {
  const env = { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }
  if (catalog !== undefined) env.NEXT_PUBLIC_STUDIO_MODEL_CATALOG_2026_10 = catalog
  if (polish !== undefined) env.NEXT_PUBLIC_STUDIO_INTELLIGENCE_POLISH = polish
  const mockJsx = (type, props) => ({ type, props: props || {} })
  const icon = name => function Icon() { return React.createElement('svg', { 'data-icon': String(name) }) }
  const module = { exports: {} }
  // No fetch, XMLHttpRequest, WebSocket, sendBeacon or navigator in the sandbox: any use of them is a ReferenceError and fails the test.
  vm.runInNewContext(compiled.outputText, {
    module, exports: module.exports, process: { env }, window: win, document: doc, Node: FakeNode,
    require(id) {
      if (id === 'react') return hooks ?? React
      if (id === 'react/jsx-runtime') return hooks ? { jsx: mockJsx, jsxs: mockJsx, Fragment: 'Fragment' } : reactJsxRuntime
      if (id === 'lucide-react') return new Proxy({}, { get: (_, name) => hooks ? String(name) : icon(name) })
      if (id.endsWith('model-catalog-snapshot.json')) return { default: base }
      if (id.endsWith('model-catalog-snapshot-2026-10.json')) return { default: refreshed }
      if (id.includes('studio-workflow-action')) return { StudioWorkflowAction: function StudioWorkflowAction() { return hooks ? null : React.createElement('button', { type: 'button' }, 'action') } }
      if (id.includes('app-header')) return { BackToBuilderButton: function BackToBuilderButton() { return hooks ? null : React.createElement('button', { type: 'button' }, 'back') } }
      if (id.includes('studio-intro-replay')) return { StudioIntroReplay: function StudioIntroReplay() { return null } }
      if (id.endsWith('.css')) return {}
      throw new Error(`Unmocked dependency: ${id}`)
    },
  })
  return module.exports
}

function renderHtml({ catalog, polish }, how = 'static') {
  const { IntelligenceWorkspace } = load({ catalog, polish })
  const element = React.createElement(IntelligenceWorkspace)
  return how === 'static' ? renderToStaticMarkup(element) : renderToString(element)
}

// ---- a small hook runtime: nested function components, state, refs, effects with deps and cleanups, a flush loop, a storage that can fail -----------------
function makeStorage(mode = {}) {
  const map = new Map(), log = []
  return {
    map, log, mode,
    getItem(key) { log.push(`get ${key}`); if (mode.get) throw new Error('SecurityError'); return map.has(key) ? map.get(key) : null },
    setItem(key, value) { log.push(`set ${key}`); if (mode.set) throw new Error('QuotaExceededError'); map.set(key, String(value)) },
    removeItem(key) { log.push(`remove ${key}`); if (mode.remove) throw new Error('SecurityError'); map.delete(key) },
  }
}
const walk = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(walk) : [tree, ...walk(tree.props?.children)]
function page({ catalog, storage, accessThrows = false, ...rest }) {
  const polish = 'polish' in rest ? rest.polish : 'true' // an explicit undefined means the flag is unset
  const listeners = { window: new Map(), document: new Map() }
  const win = {
    innerWidth: 1440, innerHeight: 900,
    addEventListener: (name, fn) => listeners.window.set(name, fn), removeEventListener: name => listeners.window.delete(name),
  }
  if (accessThrows) Object.defineProperty(win, 'localStorage', { get() { throw new Error('SecurityError') } })
  else win.localStorage = storage
  const doc = { addEventListener: (name, fn) => listeners.document.set(name, fn), removeEventListener: name => listeners.document.delete(name) }

  let current, dirty = false
  const fibers = new Map(), queue = []
  const hooks = {
    useState(initial) {
      const fiber = current, index = fiber.cursor++
      if (!(index in fiber.state)) fiber.state[index] = typeof initial === 'function' ? initial() : initial
      return [fiber.state[index], value => {
        const next = typeof value === 'function' ? value(fiber.state[index]) : value
        if (!Object.is(next, fiber.state[index])) { fiber.state[index] = next; dirty = true }
      }]
    },
    useRef(initial) { const fiber = current, index = fiber.cursor++; return fiber.state[index] ??= { current: initial } },
    useEffect(effect, deps) {
      assert.ok(Array.isArray(deps), 'every effect needs a dependency array')
      const fiber = current, index = fiber.cursor++, prior = fiber.effects[index]
      if (!prior || deps.some((value, i) => !Object.is(value, prior.deps[i]))) fiber.pending.push({ fiber, index, effect, deps })
    },
  }
  const exports = load({ catalog, polish, hooks, win, doc })
  function resolve(node, where) {
    if (Array.isArray(node)) return node.map((child, i) => resolve(child, `${where}.${i}`))
    if (!node || typeof node !== 'object') return node
    if (typeof node.type === 'function') {
      const key = `${where}/${node.type.name}`
      let fiber = fibers.get(key)
      if (!fiber) fibers.set(key, fiber = { state: [], effects: [], cursor: 0, pending: [] })
      const parent = current
      current = fiber; fiber.cursor = 0
      const out = node.type(node.props)
      current = parent
      const resolved = resolve(out, key)
      queue.push(...fiber.pending); fiber.pending = []
      return resolved
    }
    return { type: node.type, props: { ...node.props, children: resolve(node.props.children, `${where}.c`) } }
  }
  const rt = {
    storage, win, listeners, tree: null,
    flush() {
      for (let pass = 0; pass < 40; pass++) {
        dirty = false; queue.length = 0
        rt.tree = resolve({ type: exports.IntelligenceWorkspace, props: {} }, 'root')
        for (const { fiber, index, effect, deps } of queue.splice(0)) {
          fiber.effects[index]?.cleanup?.()
          fiber.effects[index] = { deps, cleanup: effect() }
        }
        if (!dirty) return rt
      }
      throw new Error('render loop did not settle')
    },
    act(fn) { fn(); return rt.flush() },
    unmount() { for (const fiber of fibers.values()) for (const entry of fiber.effects) entry?.cleanup?.() },
    nodes(tree) { return walk(arguments.length ? tree : rt.tree) },
    text(tree) { return typeof tree === 'string' || typeof tree === 'number' ? String(tree) : Array.isArray(tree) ? tree.map(rt.text).join('') : tree && typeof tree === 'object' ? rt.text(tree.props?.children ?? '') : '' },
    find(predicate, label = 'control') { const match = rt.nodes().find(predicate); assert.ok(match, `Expected ${label}`); return match },
    maybe(predicate) { return rt.nodes().find(predicate) },
    button(label) { return rt.find(node => node.type === 'button' && rt.text(node).trim() === label, `button "${label}"`) },
    select(task) { return rt.find(node => node.type === 'select' && node.props.id === `sp-model-${task}`, `select ${task}`) },
    choose(task, value) { rt.act(() => rt.select(task).props.onChange({ target: { value } })) },
    designHidden() { return rt.nodes().filter(node => node.props?.className === 'sp-intelligence-view')[1].props.hidden },
    currentHidden() { return rt.nodes().filter(node => node.props?.className === 'sp-intelligence-view')[0].props.hidden },
    pill() { return rt.maybe(node => String(node.props?.className || '').includes('sp-ip-pill')) },
    badge() { return rt.maybe(node => node.props?.className === 'sp-draft-badge') },
    note() { return rt.find(node => node.props?.id === 'sp-model-note', 'the one note') },
    changedLabel() { return rt.text(rt.find(node => node.props?.className === 'sp-section-heading' && rt.text(node).includes('Your models'))).replace('Your models, by task', '') },
    feedback() { return rt.text(rt.nodes().filter(node => node.props?.className === 'sp-feedback' && node.props.role === 'status').at(-1)) },
  }
  return rt.flush()
}

const KEY = version => `deckster-studio-intelligence-draft-v1:${version}`
const VERSION = { off: base.version, on: refreshed.version }
const savedPayload = (catalogVersion, draft, extra = {}) => JSON.stringify({ v: 1, catalog: catalogVersion, draft, activeTask: 'planning_strategy', view: 'design', ...extra })
const emptyDraft = { planning_strategy: 'default', content_writing: 'default', research_analysis: 'default', imagery: 'default' }

// ---- 1. flag OFF: nothing may change -----------------------------------------------------------------------------------------------
const hashes = {}
for (const [name, catalog] of [['catalog-off', undefined], ['catalog-on', 'true']]) {
  hashes[name] = { static: sha256(renderHtml({ catalog })), string: sha256(renderHtml({ catalog }, 'string')) }
}
if (process.env.POLISH_PRINT) console.log(JSON.stringify(hashes, null, 2))
for (const [name, catalog] of [['catalog-off', undefined], ['catalog-on', 'true']]) {
  for (const flag of [undefined, '', 'false', '0', '1', 'TRUE', 'True', 'yes', ' true']) {
    assert.equal(sha256(renderHtml({ catalog, polish: flag })), BASE_RENDER_SHA256[name].static, `${name}, polish ${JSON.stringify(flag)}: static markup must be the exact base bytes`)
    assert.equal(sha256(renderHtml({ catalog, polish: flag }, 'string')), BASE_RENDER_SHA256[name].string, `${name}, polish ${JSON.stringify(flag)}: hydration markup must be the exact base bytes`)
  }
}
{ // flag off keeps the old copy and no polish element or attribute
  const off = renderHtml({})
  for (const old of ['Prototype examples only. These model names, starting points, and specifications do not describe', 'Applying preferences is not connected.', 'Model assignment is not connected here.', 'Design only', 'Nothing is saved to your account or sent to a model.', 'Reloading or leaving this page discards the draft.', 'Current workflows']) assert.ok(off.includes(old), `flag off lost: ${old}`)
  assert.ok(!off.includes('sp-ip-') && !off.includes('data-intelligence-polish') && !off.includes('sp-model-note'), 'flag off: no polish markup')
}
{ // the stylesheet is scoped: with the flag off no element can match a rule in it
  const css = fs.readFileSync(path.join(workspaceDir, 'intelligence-polish.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const selectors = [...css.matchAll(/(?:^|[}{])\s*([^{}@]+?)\s*\{/g)].map(match => match[1]).filter(text => !/^\d/.test(text))
  assert.ok(selectors.length > 20)
  for (const group of selectors) for (const selector of group.split(',').map(text => text.trim())) assert.ok(/sp-ip-|data-intelligence-polish/.test(selector), `unscoped selector: ${selector}`)
}
{ // flag off: the old behaviour holds. The draft is in memory only and nothing is read or written (no storage object exists in the sandbox)
  const rt = page({ catalog: undefined, polish: undefined, storage: makeStorage() })
  rt.choose('planning_strategy', 'google/gemini-2.5-pro')
  assert.deepEqual(rt.storage.log, [], 'flag off: storage untouched')
  assert.equal(rt.listeners.window.has('beforeunload'), false, 'flag off: no new leave warning')
  assert.equal(rt.currentHidden(), false)
  assert.equal(rt.text(rt.badge()), 'Current workflows')
  rt.act(() => rt.button('Design preview').props.onClick())
  assert.equal(rt.text(rt.badge()), 'Design preview only')
  assert.equal(rt.pill(), undefined)
}

// ---- 2. flag ON ---------------------------------------------------------------------------------------------------------------------
// the rendered Design preview: the pieces, and ONE note
for (const catalogFlag of [undefined, 'true']) {
  const on = renderHtml({ catalog: catalogFlag, polish: 'true' })
  const preview = on.slice(on.indexOf('class="sp-design-preview"'))
  assert.ok(on.includes('data-intelligence-polish="true"'))
  for (const text of ['Managed by Deckster', '4 supporting tasks', 'Structure &amp; Layout', 'Visual Review', 'Utilities', 'Embeddings']) assert.ok(preview.includes(text), `${text} is missing`)
  assert.ok(on.includes('Available controls · service-managed model routing') && !on.includes('sp-ip-scope') && !on.includes('Your own intelligence'), 'the server render is the Current workflows view: its bar is untouched')
  assert.equal(preview.match(/class="sp-design-warning"/g).length, 1, 'one note')
  assert.equal(preview.match(/Nothing is applied, saved to your account, or sent to a model\./g).length, 1, 'the "nothing is saved or sent" sentence appears once')
  assert.ok(!/not connected/i.test(preview), 'no "not connected" disclaimer is left in Design preview')
  for (const gone of ['These model names, starting points, and specifications do not describe', 'Applying preferences is not connected', 'Model assignment is not connected here', 'Design only', 'Nothing is saved to your account or sent to a model.', 'Reloading or leaving this page discards the draft.', 'sp-model-save-note']) assert.ok(!preview.includes(gone), `${gone} should be gone`)
  assert.ok(preview.includes('Narration uses the existing delivery controls.'))
  assert.ok(preview.includes('aria-describedby="sp-model-note"'), 'the disabled Apply button points at the one note')
  const managed = preview.slice(preview.indexOf('class="sp-ip-managed"'), preview.indexOf('</details>', preview.indexOf('class="sp-ip-managed"')))
  const catalogUsed = catalogFlag ? refreshed : base
  for (const model of Object.values(catalogUsed.models)) assert.ok(!managed.includes(model.name), 'Managed by Deckster names no model: the catalog lists none for these tasks')
  assert.ok(!preview.includes('role="dialog"'), 'the readiness popup is closed until it is opened')
}

for (const [label, catalogFlag] of [['catalog off', undefined], ['catalog on', 'true']]) {
  const version = catalogFlag ? VERSION.on : VERSION.off
  const key = KEY(version)
  const task = catalogFlag ? 'google/gemini-3.1-pro-preview' : 'google/gemini-2.5-pro'

  // keep -> reload -> restored (with the view); reset clears
  {
    const storage = makeStorage()
    let rt = page({ catalog: catalogFlag, storage })
    assert.equal(rt.currentHidden(), false); assert.equal(rt.designHidden(), true)
    assert.equal(rt.text(rt.badge()), 'Current workflows', `${label}: Current workflows keeps its chip`)
    assert.deepEqual(storage.log, ['get ' + key, 'remove ' + key], `${label}: one read on mount; with no draft the key is cleared (a stale or corrupt value never lingers)`)
    rt.act(() => rt.button('Design preview').props.onClick())
    assert.equal(rt.text(rt.pill()), 'No draft changes')
    assert.equal(rt.badge(), undefined, 'one pill: the header chip is replaced, not joined')
    rt.choose('planning_strategy', task)
    rt.choose('imagery', catalogFlag ? 'google/gemini-3.1-flash-image-preview' : 'google/gemini-3.1-flash-image-preview')
    assert.equal(rt.text(rt.pill()), 'Draft kept on this device')
    assert.equal(rt.changedLabel(), '2 draft changes')
    const stored = JSON.parse(storage.map.get(key))
    assert.deepEqual(stored, { v: 1, catalog: version, draft: { ...emptyDraft, planning_strategy: task, imagery: 'google/gemini-3.1-flash-image-preview' }, activeTask: 'planning_strategy', view: 'design' })
    assert.deepEqual([...storage.map.keys()], [key], `${label}: only the versioned draft key is written`)
    assert.equal(rt.listeners.window.has('beforeunload'), false, `${label}: with storage working, no leave warning for the draft`)
    rt.unmount()

    rt = page({ catalog: catalogFlag, storage }) // "reload"
    assert.equal(rt.designHidden(), false, `${label}: reload returns to Design preview`)
    assert.equal(rt.currentHidden(), true)
    assert.equal(rt.select('planning_strategy').props.value, task)
    assert.equal(rt.select('imagery').props.value, 'google/gemini-3.1-flash-image-preview')
    assert.equal(rt.select('content_writing').props.value, 'default')
    assert.equal(rt.changedLabel(), '2 draft changes')
    assert.equal(rt.text(rt.pill()), 'Draft kept on this device')
    assert.equal(rt.feedback(), 'Your earlier draft was restored.', 'a restore is announced, never silent')
    assert.ok(rt.text(rt.note()).includes('Your draft stays in this browser until you reset it.'))
    assert.equal(rt.button('Reset draft').props.disabled, false)
    // switching to Current workflows is remembered as the view; the draft still comes back
    rt.act(() => rt.button('Current workflows').props.onClick())
    assert.equal(JSON.parse(storage.map.get(key)).view, 'current')
    rt.unmount()
    rt = page({ catalog: catalogFlag, storage })
    assert.equal(rt.currentHidden(), false, `${label}: the view the viewer left is the view restored`)
    assert.equal(rt.select('planning_strategy').props.value, task, `${label}: the draft is still restored in Design preview`)
    rt.act(() => rt.button('Design preview').props.onClick())
    assert.equal(rt.text(rt.pill()), 'Draft kept on this device')
    // Reset draft clears it
    rt.act(() => rt.button('Reset draft').props.onClick())
    assert.equal(storage.map.has(key), false, `${label}: Reset draft removes the stored draft`)
    assert.equal(rt.text(rt.pill()), 'No draft changes')
    rt.unmount()
    rt = page({ catalog: catalogFlag, storage })
    assert.equal(rt.currentHidden(), false); assert.equal(rt.select('planning_strategy').props.value, 'default')
    // choosing the starting point back by hand also leaves nothing stored
    rt.act(() => rt.button('Design preview').props.onClick())
    rt.choose('imagery', 'google/gemini-3.1-flash-image-preview'); assert.ok(storage.map.has(key))
    rt.choose('imagery', 'default'); assert.equal(storage.map.has(key), false)
    rt.unmount()
  }

  // a restored draft goes through resolveRetiredModel and the task's own list: no retired or unknown id survives
  {
    const storage = makeStorage()
    storage.map.set(key, savedPayload(version, {
      planning_strategy: 'google/gemini-2.5-pro', content_writing: 'google/gemini-2.5-flash-lite', research_analysis: 'google/gemini-2.5-flash', imagery: 'not/a-model',
    }, { activeTask: 'content_writing' }))
    const rt = page({ catalog: catalogFlag, storage })
    const values = Object.fromEntries(['planning_strategy', 'content_writing', 'research_analysis', 'imagery'].map(id => [id, rt.select(id).props.value]))
    const catalogUsed = catalogFlag ? refreshed : base
    for (const [id, value] of Object.entries(values)) assert.ok(value === 'default' || catalogUsed.tasks[id].models.includes(value), `${label}: ${id} restored ${value}`)
    assert.equal(values.imagery, 'default', 'an id the task does not offer falls back to the starting point')
    if (catalogFlag) {
      assert.deepEqual(values, { planning_strategy: 'google/gemini-3.1-pro-preview', content_writing: 'google/gemini-3.1-flash-lite', research_analysis: 'google/gemini-3-flash-preview', imagery: 'default' })
      assert.ok(!/google\/gemini-2\.5-(pro|flash-lite|flash)(?![-\w])/.test(storage.map.get(key)), 'the re-written draft holds no retired id')
    } else {
      assert.equal(values.planning_strategy, 'google/gemini-2.5-pro', 'catalog off: 2.5 Pro is an ordinary, offered model')
    }
    assert.equal(rt.text(rt.find(node => node.props?.className === 'sp-inspector-top')).includes(catalogUsed.tasks.content_writing.label), true, 'the inspected task is restored')
    rt.unmount()
  }

  // a draft that cannot be trusted restores nothing and never throws
  for (const [name, raw] of [
    ['corrupt JSON', '{"v":1,"catalog":'], ['not an object', '"x"'], ['null', 'null'], ['an array', '[1]'], ['wrong format version', savedPayload(version, { planning_strategy: task }).replace('"v":1', '"v":2')],
    ['another catalog version in the body', savedPayload('2026-01-01.1', { planning_strategy: task })], ['no draft field', JSON.stringify({ v: 1, catalog: version })],
    ['draft not an object', JSON.stringify({ v: 1, catalog: version, draft: 'x' })], ['every field wrong', savedPayload(version, { planning_strategy: 5, content_writing: null, research_analysis: {}, imagery: [] })],
    ['all starting points', savedPayload(version, emptyDraft)], ['empty string', ''],
  ]) {
    const storage = makeStorage(); storage.map.set(key, raw)
    const rt = page({ catalog: catalogFlag, storage })
    assert.equal(rt.currentHidden(), false, `${label}: ${name}: stays on Current workflows`)
    assert.equal(rt.select('planning_strategy').props.value, 'default', `${label}: ${name}`)
    assert.equal(rt.feedback(), '', `${label}: ${name}: nothing was restored`)
    rt.unmount()
  }
  { // the key carries the catalog version: a draft made against the other catalog is never read
    const storage = makeStorage()
    storage.map.set(KEY(catalogFlag ? VERSION.off : VERSION.on), savedPayload(catalogFlag ? VERSION.off : VERSION.on, { planning_strategy: task }))
    const rt = page({ catalog: catalogFlag, storage })
    assert.equal(rt.select('planning_strategy').props.value, 'default')
    assert.deepEqual(storage.log, ['get ' + key, 'remove ' + key], 'only this catalog version\'s key is read')
    assert.ok(storage.map.has(KEY(catalogFlag ? VERSION.off : VERSION.on)), 'the other version\'s key is left alone')
    assert.notEqual(KEY(VERSION.off), KEY(VERSION.on))
  }

  // storage unavailable: session-only, and leaving is warned about (only then)
  for (const [name, options, mode] of [['getItem throws', {}, { get: true }], ['setItem throws (quota, private mode)', {}, { set: true }], ['reading window.localStorage throws', { accessThrows: true }, {}]]) {
    const storage = makeStorage(mode)
    let rt = page({ catalog: catalogFlag, storage, ...options })
    rt.act(() => rt.button('Design preview').props.onClick())
    assert.equal(rt.text(rt.pill()), 'No draft changes', `${label}: ${name}: no change yet, nothing to lose`)
    assert.equal(rt.listeners.window.has('beforeunload'), false, `${label}: ${name}: no warning without a draft`)
    rt.choose('planning_strategy', task)
    assert.equal(rt.text(rt.pill()), 'Session only', `${label}: ${name}`)
    assert.equal(rt.pill().props['data-state'], 'session')
    assert.equal(rt.listeners.window.has('beforeunload'), true, `${label}: ${name}: leaving with an unsaved draft is warned about`)
    { let prevented = false; rt.listeners.window.get('beforeunload')({ preventDefault() { prevented = true } }); assert.ok(prevented, 'the handler asks the browser to confirm') }
    assert.ok(rt.text(rt.note()).includes('This browser cannot keep a draft, so reloading or leaving this page discards it.'))
    assert.ok(!rt.text(rt.note()).includes('stays in this browser'))
    assert.equal(rt.select('planning_strategy').props.value, task, `${label}: ${name}: the in-memory draft still works`)
    rt.act(() => rt.button('Reset draft').props.onClick())
    assert.equal(rt.listeners.window.has('beforeunload'), false, `${label}: ${name}: reset removes the warning`)
    rt.choose('planning_strategy', task)
    assert.equal(rt.listeners.window.has('beforeunload'), true)
    rt.unmount()
    assert.equal(rt.listeners.window.has('beforeunload'), false, `${label}: ${name}: unmounting removes the listener`)
    assert.ok(!storage.map.has(key), `${label}: ${name}: nothing was stored`)
  }
  { // storage that fails only after a good start: the first failed write flips to session-only
    const storage = makeStorage()
    const rt = page({ catalog: catalogFlag, storage })
    rt.act(() => rt.button('Design preview').props.onClick())
    rt.choose('planning_strategy', task)
    assert.equal(rt.text(rt.pill()), 'Draft kept on this device')
    storage.mode.set = true
    rt.choose('imagery', 'google/gemini-3.1-flash-image-preview')
    assert.equal(rt.text(rt.pill()), 'Session only')
    assert.equal(rt.listeners.window.has('beforeunload'), true)
    rt.unmount()
  }

  // scope toggle, readiness popup, Managed by Deckster, in the live tree
  {
    const storage = makeStorage()
    const rt = page({ catalog: catalogFlag, storage })
    rt.act(() => rt.button('Design preview').props.onClick())
    assert.ok(!rt.text(rt.find(node => node.props?.className === 'sp-context-bar sp-ip-bar', 'the Design preview bar')).includes('Prototype model catalog'), 'the bar\'s catalog label gives way to the scope toggle (the note says it once)')
    assert.ok(rt.nodes().every(node => node.props?.className !== 'sp-context-bar' || !rt.text(node).includes('Prototype model catalog')))
    const scope = rt.find(node => node.props?.role === 'group' && node.props['aria-label'] === 'Model preference scope')
    const [defaults, presentation] = rt.nodes(scope.props.children).filter(node => node.type === 'button')
    assert.equal(defaults.props['aria-pressed'], true); assert.equal(presentation.props['aria-pressed'], false)
    assert.equal(presentation.props.disabled, true); assert.equal(presentation.props.onClick, undefined, 'This presentation has no backing and does nothing')
    assert.equal(presentation.props['aria-describedby'], 'sp-ip-scope-note')
    assert.equal(rt.text(rt.find(node => node.props?.id === 'sp-ip-scope-note')), 'Choices for one presentation aren’t available in this preview.')
    rt.act(() => rt.button('Current workflows').props.onClick())
    assert.equal(rt.maybe(node => node.props?.role === 'group' && node.props['aria-label'] === 'Model preference scope'), undefined, 'Current workflows has no scope toggle')
    assert.equal(rt.maybe(node => node.props?.className === 'sp-ip-readiness-trigger'), undefined)
    assert.ok(rt.text(rt.find(node => node.props?.className === 'sp-context-bar')).includes('Available controls · service-managed model routing'), 'Current workflows keeps its own bar')
    rt.act(() => rt.button('Design preview').props.onClick())
    // readiness popup
    const trigger = () => rt.find(node => node.props?.className === 'sp-ip-readiness-trigger', 'readiness trigger')
    assert.equal(trigger().props['aria-expanded'], false); assert.equal(trigger().props['aria-haspopup'], 'dialog')
    assert.equal(rt.maybe(node => node.props?.role === 'dialog'), undefined)
    let focused = null
    trigger().props.ref.current = { getBoundingClientRect: () => ({ bottom: 200, right: 1300 }), focus: () => { focused = 'trigger' }, contains: () => false }
    rt.act(() => trigger().props.onClick())
    const dialog = () => rt.find(node => node.props?.role === 'dialog', 'readiness dialog')
    assert.equal(trigger().props['aria-expanded'], true)
    assert.equal(dialog().props['aria-labelledby'], 'sp-ip-readiness-title')
    const dialogText = rt.text(dialog())
    for (const text of ['Your own intelligence', 'Research & documents', 'Datasets', 'Presentations', 'Sample target · 5 items', 'none of your documents, datasets or presentations are read', 'no model is trained']) assert.ok(dialogText.includes(text), `popup lacks: ${text}`)
    assert.ok(!/\b\d+ (of|\/) 3\b|0\/3/.test(dialogText), 'no invented counts')
    assert.ok(rt.nodes(dialog()).filter(node => node.type === 'button').length === 1, 'the popup starts nothing: its only button closes it')
    assert.equal(dialog().props.style.left, 740); assert.equal(dialog().props.style.top, 208)
    assert.ok(rt.listeners.document.has('keydown') && rt.listeners.document.has('pointerdown'))
    // inside click keeps it open, outside click closes it
    const inside = new FakeNode()
    rt.find(node => node.props?.role === 'dialog').props.ref.current = { contains: target => target === inside }
    rt.act(() => rt.listeners.document.get('pointerdown')({ target: inside }))
    assert.ok(rt.maybe(node => node.props?.role === 'dialog'), 'a click inside keeps it open')
    rt.act(() => rt.listeners.document.get('pointerdown')({ target: new FakeNode() }))
    assert.equal(rt.maybe(node => node.props?.role === 'dialog'), undefined, 'a click outside closes it')
    assert.equal(rt.listeners.document.size, 0, 'listeners are removed on close')
    // Escape closes it and returns focus to the trigger
    rt.act(() => trigger().props.onClick())
    let prevented = false
    rt.act(() => rt.listeners.document.get('keydown')({ key: 'Tab', preventDefault() { prevented = true } }))
    assert.ok(rt.maybe(node => node.props?.role === 'dialog') && !prevented, 'other keys do nothing')
    rt.act(() => rt.listeners.document.get('keydown')({ key: 'Escape', preventDefault() { prevented = true } }))
    assert.equal(rt.maybe(node => node.props?.role === 'dialog'), undefined); assert.ok(prevented); assert.equal(focused, 'trigger')
    // the close button closes it too
    rt.act(() => trigger().props.onClick())
    focused = null
    rt.act(() => rt.find(node => node.type === 'button' && node.props['aria-label'] === 'Close intelligence readiness').props.onClick())
    assert.equal(rt.maybe(node => node.props?.role === 'dialog'), undefined); assert.equal(focused, 'trigger')
    // opening the popup touched nothing
    assert.ok(storage.log.every(op => op === 'get ' + key || op === 'remove ' + key), `opening the popup and switching views only reads or clears the key: ${storage.log}`)
    rt.unmount()
    assert.equal(rt.listeners.window.size + rt.listeners.document.size, 0)
  }
}

// ---- 3. flags are independent ------------------------------------------------------------------------------------------------------
{
  const combos = {}
  for (const catalog of [undefined, 'true']) for (const polish of [undefined, 'true']) combos[`${catalog ?? 'off'}/${polish ?? 'off'}`] = renderHtml({ catalog, polish })
  assert.equal(new Set(Object.values(combos).map(sha256)).size, 4, 'four distinct renders')
  assert.ok(combos['off/true'].includes(base.version) && combos['off/true'].includes('Gemini 2.5 Pro') && !combos['off/true'].includes('Release status'), 'polish alone leaves the 2026-08-20.1 catalog')
  assert.ok(combos['true/off'].includes(refreshed.version) && combos['true/off'].includes('Release status') && !combos['true/off'].includes('sp-ip-'), 'catalog alone adds no polish')
  assert.ok(combos['true/true'].includes(refreshed.version) && combos['true/true'].includes('Release status') && combos['true/true'].includes('sp-ip-managed'), 'both together')
}

// ---- 4. nothing is requested, sent or saved to an account ----------------------------------------------------------------------------
for (const forbidden of [/\bfetch\s*\(/, /XMLHttpRequest/, /\bWebSocket\b/, /sendBeacon/, /\bnavigator\b/, /sessionStorage/, /indexedDB/, /document\.cookie/, /\/api\//, /next-auth/, /useAuth/, /useRouter/]) {
  assert.ok(!forbidden.test(source), `the workspace must not use ${forbidden}`)
}
assert.equal((source.match(/window\.localStorage/g) || []).length, 3, 'localStorage is touched in exactly three places: the read, the write and the clear')
for (const match of source.matchAll(/window\.localStorage/g)) { // every access sits inside a try block, before its catch
  const opened = source.lastIndexOf('try {', match.index)
  assert.ok(opened > -1 && !source.slice(opened, match.index).includes('catch'), 'a localStorage access is outside a try block')
  assert.ok(source.indexOf('catch', match.index) > -1)
}
// ---- 5. the flag is documented, default off, and the test is wired ----------------------------------------------------------------------------
const env = fs.readFileSync(path.join(repo, '.env.example'), 'utf8')
assert.ok(/^NEXT_PUBLIC_STUDIO_INTELLIGENCE_POLISH="false"$/m.test(env), '.env.example must document the flag, default "false"')
assert.ok(JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8')).scripts['test:studio-intelligence-polish'] === 'node scripts/test-studio-intelligence-polish.mjs')

console.log('PASS: Intelligence polish off = base bytes (both catalog states); on = draft kept per viewer and restored with its view through resolveRetiredModel, guarded storage with a leave warning only when storage fails, reset clears, scope toggle + readiness popup + Managed by Deckster + one pill + one note, nothing requested or saved to an account')
