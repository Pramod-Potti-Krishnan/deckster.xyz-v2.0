// FRONTEND-2 Pass 3 track 4: the shared harness of scripts/test-studio-theme-library-manage.mjs and scripts/test-studio-template-library-manage.mjs. Not a test itself (the suite only runs test-*.mjs).
// Plain node: the real TypeScript is transpiled and run in a vm, with a small fake React (hooks keep their state between renders; a state write asks for another render) and the
// JSX runtime answering plain {type, props, key} nodes. No browser, no network, no services: every import a module asks for must be handed in, and an unknown one fails loudly.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// LIBRARY_MANAGE_BASE=<commit> overrides the commit the flag-off identity is checked against (default bcd8aed: studio-v4-dev-preparation-code after #458, the head this was built on).
export const BASE_COMMIT = process.env.LIBRARY_MANAGE_BASE || 'bcd8aed'
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
export function baseSource(rel) {
  try { git(['cat-file', '-e', `${BASE_COMMIT}^{commit}`]); return git(['show', `${BASE_COMMIT}:${rel}`]) } catch { return null }
}
export const sha = text => crypto.createHash('sha256').update(text).digest('hex')
export const plain = value => JSON.parse(JSON.stringify(value))

// ---- in-memory mutations (--mutation-check): a child run applies one source edit, the suite must then fail ---------------------------------------------------------
export function makeReader(mutations, envName) {
  const index = process.env[envName] === undefined ? null : Number(process.env[envName])
  return rel => {
    let source = fs.readFileSync(path.join(root, rel), 'utf8')
    const mutation = index === null ? null : mutations[index]
    if (mutation && mutation.file === rel) {
      assert.ok(source.includes(mutation.from), `mutation "${mutation.name}" no longer applies; update MUTATIONS`)
      source = source.replace(mutation.from, () => mutation.to)
    }
    return source
  }
}

// ---- compile + run ------------------------------------------------------------------------------------------------------------------------------------------------------
export function compile(code, file = 'module.tsx') {
  const out = ts.transpileModule(code, { fileName: file, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } })
  assert.equal(out.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0, `${file} transpiles`)
  return out.outputText
}
export const jsx = (type, props, key) => ({ type, props: props ?? {}, key })
export const jsxRuntime = { jsx, jsxs: jsx, Fragment: 'Fragment' }
export const refuse = () => assert.fail('No network, storage, navigation or services allowed')

/** Runs `code` as a CommonJS module. `imports` is the closed list of modules it may require. */
export function loadSource(code, imports = {}, { env = {}, globals = {}, file = 'module.tsx' } = {}) {
  const mod = { exports: {} }
  const context = { module: mod, exports: mod.exports, process: { env: { ...env } }, console, URLSearchParams, encodeURIComponent, decodeURIComponent, Promise, fetch: refuse, ...globals,
    require: name => { assert.ok(name in imports, `${file} asked for an import nobody handed in: ${name}`); return imports[name] } }
  vm.runInNewContext(compile(code, file), context)
  return mod.exports
}

export const flat = value => Array.isArray(value) ? value.flatMap(flat) : !value || typeof value !== 'object' ? [] : [value, ...flat(value.props?.children)]
export const text = value => Array.isArray(value) ? value.map(text).join('') : value == null || typeof value === 'boolean' ? '' : typeof value === 'object' ? text(value.props?.children) : String(value)
export const tick = async (times = 16) => { for (let i = 0; i < times; i++) await new Promise(resolve => setImmediate(resolve)) }
export const deferred = () => { let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej }); return { promise, resolve, reject } }

/**
 * Mounts one function component with a fake React. `renderFn()` (it calls the component) is called for every render; its hooks keep their cells between renders. A state write marks the tree dirty;
 * `settle()` renders again until nothing is dirty and every effect ran. `refs` of drawn nodes are given a stub element so focus/closest/querySelector calls are recorded.
 */
export function createRuntime(renderFn, { elementFor = () => ({}) } = {}) {
  const cells = [], pendingEffects = [], focused = []
  let cursor = 0, dirty = false, tree = null, unmounted = false, renders = 0
  const react = {
    useState(initial) {
      const i = cursor++
      cells[i] ??= { value: typeof initial === 'function' ? initial() : initial }
      const cell = cells[i]
      return [cell.value, update => {
        if (unmounted) return
        const next = typeof update === 'function' ? update(cell.value) : update
        if (!Object.is(next, cell.value)) { cell.value = next; dirty = true }
      }]
    },
    useRef(initial) { const i = cursor++; return cells[i] ??= { current: initial } },
    useCallback(callback, deps) { const i = cursor++, old = cells[i]; if (!old || !deps || deps.some((v, j) => !Object.is(v, old.deps?.[j]))) cells[i] = { callback, deps }; return cells[i].callback },
    useMemo(factory, deps) { const i = cursor++, old = cells[i]; if (!old || !deps || deps.some((v, j) => !Object.is(v, old.deps?.[j]))) cells[i] = { value: factory(), deps }; return cells[i].value },
    useEffect(effect, deps) {
      const i = cursor++, old = cells[i]
      if (!old || !deps || deps.some((v, j) => !Object.is(v, old.deps?.[j]))) {
        cells[i] = { deps, effect, cleanup: old?.cleanup }
        pendingEffects.push(() => { const cell = cells[i]; cell.cleanup?.(); cell.cleanup = effect() })
      }
    },
    useLayoutEffect() {}, useId: () => 'id-1',
  }
  const attachRefs = node => {
    for (const n of flat(node)) if (n.props?.ref && typeof n.props.ref === 'object') n.props.ref.current = elementFor(n, focused)
  }
  const api = {
    react, focused,
    render() {
      for (let attempts = 0; ; attempts++) {
        assert.ok(attempts < 20, 'render settles')
        cursor = 0; dirty = false; renders++
        tree = renderFn()
        attachRefs(tree)
        while (pendingEffects.length) pendingEffects.shift()()
        if (!dirty) return tree
      }
    },
    async settle() { for (let i = 0; i < 20; i++) { await Promise.resolve(); if (dirty || pendingEffects.length) api.render() } await tick(2); if (dirty) api.render(); return tree },
    unmount() { unmounted = true; cells.forEach(cell => { cell?.cleanup?.(); if (cell) cell.cleanup = undefined }) },
    find: predicate => flat(tree).filter(predicate),
    one: predicate => { const found = flat(tree).filter(predicate); assert.equal(found.length, 1, `exactly one node matches (found ${found.length})`); return found[0] },
    get tree() { return tree }, get renders() { return renders },
  }
  return api
}
