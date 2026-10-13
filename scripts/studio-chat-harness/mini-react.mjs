// A small, DOM-free React host for running the REAL hook and components offline.
//
// It installs itself as React's hook dispatcher (the same slot react-dom uses), so the
// repo's own `useState/useEffect/...` calls run unmodified. It expands the element tree
// into plain host nodes, keeps per-position fibers (state, refs, effects) across passes,
// and runs layout/passive effects with React's destroy-all-then-create-all ordering.
//
// Fidelity notes (also in README): single synchronous renderer, no StrictMode, no
// concurrent rendering. setState follows React's eager-state rule (the updater runs at
// dispatch time when the component has no pending work, and is not re-run at render), so
// updaters with side effects (the hook's cache writer, page callbacks) fire at the same
// moments they do in production.
import React from 'react'

const internals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
const FORWARD_REF = Symbol.for('react.forward_ref')
const MEMO = Symbol.for('react.memo')
const CONTEXT = Symbol.for('react.context')
const PROVIDER = Symbol.for('react.provider')

let current = null // fiber whose component function is executing

const depsEqual = (a, b) => {
  if (!a || !b || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false
  return true
}

class Fiber {
  constructor(root, path, label) {
    this.root = root
    this.path = path
    this.label = label
    this.hooks = []
    this.cursor = 0
    this.pending = false // an update is queued and not yet rendered (React's fiber.lanes !== NoLanes)
    this.alive = true
    this.pass = -1
    this.effects = []
    this.renderPhaseUpdate = false
  }
}

function slot(kind, make) {
  const fiber = current
  if (!fiber) throw new Error('mini-react: a hook was called outside a component render')
  const index = fiber.cursor++
  let hook = fiber.hooks[index]
  if (!hook) { hook = fiber.hooks[index] = { kind, ...make() } }
  else if (hook.kind !== kind) throw new Error(`mini-react: hook order changed in ${fiber.label} (slot ${index}: ${hook.kind} then ${kind})`)
  return { fiber, hook }
}

function dispatchState(fiber, hook, action) {
  if (!fiber.alive) return
  const update = { action, eager: false, value: undefined }
  if (current === fiber) {
    fiber.renderPhaseUpdate = true
  } else if (!fiber.pending) {
    // React's eager-state path: compute now against the last rendered state.
    const value = typeof action === 'function' ? action(hook.rendered) : action
    update.eager = true
    update.value = value
    if (Object.is(value, hook.rendered)) return
  }
  hook.queue.push(update)
  fiber.pending = true
  fiber.root.schedule()
}

function useState(initial) {
  const { fiber, hook } = slot('state', () => ({ queue: [], state: undefined, rendered: undefined, init: false }))
  if (!hook.init) {
    hook.state = typeof initial === 'function' ? initial() : initial
    hook.init = true
    hook.setter = action => dispatchState(fiber, hook, action)
  }
  for (const update of hook.queue) hook.state = update.eager ? update.value : typeof update.action === 'function' ? update.action(hook.state) : update.action
  hook.queue = []
  hook.rendered = hook.state
  return [hook.state, hook.setter]
}

function useReducer(reducer, initialArg, init) {
  const { fiber, hook } = slot('reducer', () => ({ queue: [], state: undefined, init: false }))
  if (!hook.init) {
    hook.state = init ? init(initialArg) : initialArg
    hook.init = true
    hook.dispatch = action => { if (!fiber.alive) return; hook.queue.push(action); fiber.pending = true; fiber.root.schedule() }
  }
  for (const action of hook.queue) hook.state = reducer(hook.state, action)
  hook.queue = []
  return [hook.state, hook.dispatch]
}

function useRef(initial) {
  const { hook } = slot('ref', () => ({ ref: { current: initial } }))
  return hook.ref
}

function useMemo(factory, deps) {
  const { hook } = slot('memo', () => ({ has: false, deps: undefined, value: undefined }))
  if (hook.has && deps !== undefined && deps !== null && depsEqual(deps, hook.deps)) return hook.value
  hook.value = factory()
  hook.deps = deps
  hook.has = true
  return hook.value
}

function useCallback(callback, deps) {
  const { hook } = slot('callback', () => ({ has: false, deps: undefined, value: undefined }))
  if (hook.has && deps !== undefined && deps !== null && depsEqual(deps, hook.deps)) return hook.value
  hook.value = callback
  hook.deps = deps
  hook.has = true
  return callback
}

function effectHook(layout) {
  return (create, deps) => {
    const { fiber, hook } = slot(layout ? 'layout' : 'effect', () => ({ ran: false, deps: undefined, cleanup: undefined }))
    const changed = !hook.ran || deps === undefined || deps === null || !depsEqual(deps, hook.deps)
    hook.deps = deps
    if (changed) { hook.ran = true; fiber.effects.push({ layout, hook, create }) }
  }
}

const dispatcher = {
  useState, useReducer, useRef, useMemo, useCallback,
  useEffect: effectHook(false), useLayoutEffect: effectHook(true), useInsertionEffect: effectHook(true),
  useContext: context => context?._currentValue,
  readContext: context => context?._currentValue,
  useDebugValue() {},
  useImperativeHandle() {},
  useId() { const { fiber, hook } = slot('id', () => ({})); return hook.id ??= `:h${fiber.path.length}${fiber.root.nextId++}:` },
  useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
  useDeferredValue: value => value,
  useTransition: () => [false, fn => fn()],
  useEffectEvent: fn => fn,
  use() { throw new Error('mini-react: use() is not supported by the chat harness') },
  useOptimistic() { throw new Error('mini-react: useOptimistic is not supported') },
  useActionState() { throw new Error('mini-react: useActionState is not supported') },
  useMemoCache() { throw new Error('mini-react: useMemoCache is not supported') },
}

const typeName = type => typeof type === 'string' ? type
  : typeof type === 'function' ? (type.displayName || type.name || 'Anonymous')
  : type?.$$typeof === FORWARD_REF ? `ForwardRef(${type.displayName || type.render?.name || ''})`
  : type?.$$typeof === MEMO ? `Memo(${typeName(type.type)})` : String(type?.$$typeof?.toString?.() ?? 'Unknown')

export class Root {
  constructor() {
    this.fibers = new Map()
    this.pass = 0
    this.dirty = false
    this.element = null
    this.tree = null
    this.nextId = 1
    this.renders = 0
  }
  setElement(element) { this.element = element; this.dirty = true }
  schedule() { this.dirty = true }

  // Render until quiescent. Returns true when at least one pass ran.
  flush() {
    let ran = false
    for (let loops = 0; this.dirty; loops++) {
      if (loops > 200) throw new Error('mini-react: render loop did not settle after 200 passes (setState in an effect without a guard?)')
      this.dirty = false
      this.#pass()
      ran = true
    }
    return ran
  }

  unmount() {
    const fibers = [...this.fibers.values()]
    this.fibers.clear()
    for (const fiber of fibers) this.#destroy(fiber)
    this.element = null
    this.tree = null
  }

  #destroy(fiber) {
    fiber.alive = false
    for (const hook of fiber.hooks) {
      if ((hook.kind === 'layout' || hook.kind === 'effect') && typeof hook.cleanup === 'function') {
        const cleanup = hook.cleanup
        hook.cleanup = undefined
        cleanup()
      }
    }
  }

  #pass() {
    this.pass++
    this.renders++
    const completed = []
    this.completed = completed
    this.tree = this.element === null ? null : this.#expand(this.element, 'root')
    for (const [path, fiber] of [...this.fibers]) {
      if (fiber.pass !== this.pass) { this.fibers.delete(path); this.#destroy(fiber) }
    }
    const layout = [], passive = []
    for (const fiber of completed) {
      for (const effect of fiber.effects) (effect.layout ? layout : passive).push(effect)
      fiber.effects = []
    }
    for (const list of [layout, passive]) {
      for (const effect of list) {
        const cleanup = effect.hook.cleanup
        effect.hook.cleanup = undefined
        if (typeof cleanup === 'function') cleanup()
      }
      for (const effect of list) {
        const result = effect.create()
        effect.hook.cleanup = typeof result === 'function' ? result : undefined
      }
    }
  }

  #fiberFor(path, label) {
    let fiber = this.fibers.get(path)
    if (!fiber) { fiber = new Fiber(this, path, label); this.fibers.set(path, fiber) }
    return fiber
  }

  #call(fiber, render, props, ref) {
    const previousHooks = internals.H
    const previousFiber = current
    internals.H = dispatcher
    try {
      for (let attempt = 0; ; attempt++) {
        fiber.cursor = 0
        fiber.pending = false
        fiber.renderPhaseUpdate = false
        fiber.effects = []
        current = fiber
        const out = render(props, ref)
        current = previousFiber
        if (!fiber.renderPhaseUpdate) return out
        if (attempt > 25) throw new Error(`mini-react: too many render-phase updates in ${fiber.label}`)
      }
    } finally {
      current = previousFiber
      internals.H = previousHooks
    }
  }

  #children(children, path) {
    if (Array.isArray(children)) {
      return children.map((child, index) => {
        const keySegment = React.isValidElement(child) && child.key != null ? `k:${child.key}` : `i:${index}`
        return this.#expand(child, `${path}.${keySegment}`)
      })
    }
    return [this.#expand(children, `${path}.0`)]
  }

  #expand(node, path) {
    if (node === null || node === undefined || typeof node === 'boolean') return null
    if (typeof node === 'string' || typeof node === 'number' || typeof node === 'bigint') return { t: 'text', value: String(node) }
    if (Array.isArray(node)) return { t: 'frag', key: null, children: this.#children(node, path) }
    if (!React.isValidElement(node)) throw new Error(`mini-react: unsupported child of type ${typeof node} at ${path}`)
    const { type, props, key } = node
    if (type === React.Fragment) return { t: 'frag', key, children: this.#children(props.children, path) }
    if (typeof type === 'string') {
      const { children, ref, ...rest } = props
      return { t: 'host', type, key, props: rest, children: children === undefined ? [] : this.#children(children, `${path}/${type}`) }
    }
    let render = null, label = typeName(type), ref = props.ref ?? null, resolved = type
    if (resolved?.$$typeof === MEMO) { resolved = resolved.type; label = typeName(resolved) }
    if (typeof resolved === 'function') {
      if (resolved.prototype?.isReactComponent) throw new Error(`mini-react: class component ${label} is not supported`)
      render = resolved
    } else if (resolved?.$$typeof === FORWARD_REF) {
      render = resolved.render
    } else if (resolved?.$$typeof === PROVIDER || resolved?.$$typeof === CONTEXT) {
      return { t: 'frag', key, children: this.#children(props.children, path) }
    } else {
      throw new Error(`mini-react: unsupported element type ${label} at ${path}`)
    }
    const fiberPath = `${path}:${label}`
    const fiber = this.#fiberFor(fiberPath, label)
    fiber.pass = this.pass
    const output = this.#call(fiber, render, props, ref)
    const child = this.#expand(output, fiberPath)
    this.completed.push(fiber)
    return { t: 'comp', name: label, key, props, child }
  }
}

// ---- tree utilities -------------------------------------------------------

export function flatten(node, out = []) {
  if (!node) return out
  if (node.t === 'frag') { for (const child of node.children) flatten(child, out); return out }
  if (node.t === 'comp') return flatten(node.child, out)
  out.push(node)
  return out
}

export function hostNodes(node, out = []) {
  if (!node) return out
  if (node.t === 'frag') node.children.forEach(child => hostNodes(child, out))
  else if (node.t === 'comp') hostNodes(node.child, out)
  else if (node.t === 'host') { out.push(node); node.children.forEach(child => hostNodes(child, out)) }
  return out
}

export function textOf(node) {
  if (!node) return ''
  if (node.t === 'text') return node.value
  if (node.t === 'frag') return node.children.map(textOf).join('')
  if (node.t === 'comp') return textOf(node.child)
  return node.children.map(textOf).join('')
}

// Convert the expanded tree back into plain React elements so react-dom's own
// serializer produces the markup (attribute order, escaping, void tags all exact).
export function toElements(node) {
  if (!node) return null
  if (node.t === 'text') return node.value
  if (node.t === 'comp') return toElements(node.child)
  const children = node.children.map(toElements)
  if (node.t === 'frag') return React.createElement(React.Fragment, null, ...children)
  const props = {}
  for (const [name, value] of Object.entries(node.props)) {
    if (name === 'key' || name === 'ref') continue
    props[name] = value
  }
  return React.createElement(node.type, props, ...children)
}

// Top-level children of a named component's output, flattened through UNKEYED
// fragments/arrays only, so each keyed child (the React key a list renders by) stays a node.
export function keyedChildren(tree, name) {
  const find = node => {
    if (!node) return null
    if (node.t === 'comp') return node.name === name ? node : find(node.child)
    if (node.t === 'frag' || node.t === 'host') { for (const child of node.children) { const hit = find(child); if (hit) return hit } }
    return null
  }
  const comp = find(tree)
  if (!comp) return null
  const out = []
  const walk = node => {
    if (!node) return
    if (node.t === 'frag' && node.key == null) node.children.forEach(walk)
    else if (node.t === 'comp' && node.key == null) walk(node.child)
    else out.push(node)
  }
  walk(comp.child)
  return out
}
