import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

// Actual leaf code with an offline hook/event host; no browser, account or service is used.
export function detailsHarness(shell = 'true') {
  let currentHost, serial = 0
  const env = { user: { id: 'owner-a', name: 'Account A', email: 'a@example.invalid', image: 'https://example.invalid/a.png' }, loading: false,
    requests: [], updates: [], update: async fields => ({ user: { ...env.user, ...fields } }), fetch: async () => { throw new Error('No local response configured') },
    created: [], revoked: [], listeners: new Map(), failObjectUrl: false }
  const effect = (callback, dependencies) => {
    const index = currentHost.cursor++, previous = currentHost.effects[index]
    if (!previous || dependencies.some((value, i) => value !== previous.dependencies[i])) {
      currentHost.pending.push(() => { previous?.cleanup?.(); currentHost.effects[index] = { callback, dependencies, cleanup: callback() } })
    }
  }
  const react = {
    useState(initial) {
      const owner = currentHost, index = owner.cursor++
      if (!(index in owner.state)) owner.state[index] = typeof initial === 'function' ? initial() : initial
      return [owner.state[index], value => { owner.state[index] = typeof value === 'function' ? value(owner.state[index]) : value }]
    },
    useRef(initial) { const index = currentHost.cursor++; return currentHost.state[index] ??= { current: initial } },
    useEffect: effect, useLayoutEffect: effect,
  }
  function createHost(component) {
    return { state: [], effects: [], cursor: 0, pending: [],
      render(props = {}) {
        currentHost = this; this.cursor = 0; this.pending = []
        const result = component(props)
        for (const callback of this.pending) { currentHost = this; callback() }
        return result
      },
      cleanup() { for (const entry of this.effects) entry?.cleanup?.() },
      replayEffects() { this.cleanup(); for (const entry of this.effects) if (entry) entry.cleanup = entry.callback() },
    }
  }
  const cache = new Map()
  const workflowAction = function StudioWorkflowAction() {}
  function loadLeaf(name) {
    if (cache.has(name)) return cache.get(name)
    const path = new URL(`../components/studio-personal/${name}.tsx`, import.meta.url)
    const compiled = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true })
    assert.equal(compiled.diagnostics.length, 0)
    const module = { exports: {} }
    vm.runInNewContext(compiled.outputText, {
      module, exports: module.exports, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: shell } },
      window: { addEventListener: (name, callback) => env.listeners.set(callback, name), removeEventListener: (_, callback) => env.listeners.delete(callback) },
      URL: { createObjectURL: file => { if (env.failObjectUrl) throw new Error('Local URL refused'); const url = `blob:local-${++serial}`; env.created.push({ url, file }); return url }, revokeObjectURL: url => env.revoked.push(url) },
      FormData: class { constructor() { this.parts = [] } append(...parts) { this.parts.push(parts) } },
      fetch: async (path, options) => { env.requests.push({ path, options }); return env.fetch(path, options) },
      require(id) {
        if (id === 'react') return react
        if (id === 'react/jsx-runtime') return { jsx: (type, props, key) => ({ type, props: props || {}, key }), jsxs: (type, props, key) => ({ type, props: props || {}, key }) }
        if (id === 'lucide-react') return new Proxy({}, { get: (_, name) => name })
        if (id === 'next/link') return { default: 'a' }
        if (id === 'next-auth/react') return { useSession: () => ({ update: fields => { env.updates.push(fields); return env.update(fields) } }) }
        if (id.includes('use-auth')) return { useAuth: () => ({ user: env.user, isLoading: env.loading }) }
        if (id.includes('studio-workflow-action')) return { StudioWorkflowAction: workflowAction }
        if (id.includes('studio-inspector-focus')) return { keepStudioScrollFocusVisible() {} }
        if (id.startsWith('./account-')) return loadLeaf(id.slice(2))
        if (id.endsWith('.css')) return {}
        throw new Error(`Unmocked dependency: ${id}`)
      },
    })
    cache.set(name, module.exports)
    return module.exports
  }
  return { env, loadLeaf, createHost, workflowAction }
}
export function nodes(tree) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  return [tree, ...nodes(tree.props?.children)]
}
export const text = tree => typeof tree === 'string' || typeof tree === 'number' ? String(tree)
  : Array.isArray(tree) ? tree.map(text).join('') : text(tree?.props?.children ?? '')
export const find = (tree, predicate) => { const value = nodes(tree).find(predicate); assert.ok(value, 'Expected leaf control'); return value }
export const button = (tree, label) => find(tree, node => node.type === 'button' && (node.props['aria-label'] || text(node).trim()) === label)
export const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve() }
export const deferred = () => { let resolve, reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail }); return { promise, resolve, reject } }
export const response = (result, ok = true) => ({ ok, json: async () => result })
