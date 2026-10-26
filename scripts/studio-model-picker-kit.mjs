// FRONTEND-2 P3-10 MODEL CHOICE, the compact picker: the loader its proof (scripts/test-studio-model-picker.mjs) and its fixture (scripts/render-model-picker-fixture.mjs) share. It transpiles the picker's real TypeScript
// (lib/studio-model-picker.ts, components/model-choice/*) with the project's own `typescript` and runs it in this process, with whatever React and Radix the caller hands in. No network, no browser, nothing written.
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const nodeRequire = createRequire(path.join(root, 'package.json'))

export const FILES = {
  p2: 'lib/studio-intelligence-p2.ts',
  catalog: 'lib/studio-model-catalog.ts',
  choice: 'lib/studio-model-choice.ts',
  picker: 'lib/studio-model-picker.ts',
  hook: 'components/model-choice/use-model-choice.ts',
  component: 'components/model-choice/model-picker.tsx',
  css: 'components/model-choice/model-picker.css',
}

const compiled = new Map()
function compile(source, fileName) {
  const key = `${fileName}\0${source}`
  if (compiled.has(key)) return compiled.get(key)
  const out = ts.transpileModule(source, { fileName, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } })
  const errors = (out.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error)
  if (errors.length) throw new Error(`${fileName} does not compile: ${ts.flattenDiagnosticMessageText(errors[0].messageText, '\n')}`)
  compiled.set(key, out.outputText)
  return out.outputText
}

/** Runs one file with `deps` as its only imports. `context` adds globals (window, fetch, process). */
export function runModule(rel, deps, { read = r => fs.readFileSync(path.join(root, r), 'utf8'), context = {} } = {}) {
  const module = { exports: {} }
  const require = id => { if (id in deps) return deps[id]; throw new Error(`Unexpected import in ${rel}: ${id}`) }
  vm.runInNewContext(compile(read(rel), rel), { module, exports: module.exports, require, process: { env: {} }, console, URL, URLSearchParams, AbortSignal, Promise, setTimeout, clearTimeout, Date, ...context })
  return module.exports
}

/** The picker's modules. `react` / `jsx` / `radix` / `lucide` are what the component and the hook import; `env` is process.env for the hook and the component; `globals` are window / fetch. */
export function loadPicker({ read, react, jsx, radix, lucide, env = {}, globals = {} }) {
  const opts = { read, context: { process: { env }, ...globals } }
  const p2 = runModule(FILES.p2, {}, opts)
  const cat = runModule(FILES.catalog, {}, opts)
  const choice = runModule(FILES.choice, { '@/lib/studio-intelligence-p2': p2, '@/lib/studio-model-catalog': cat }, opts)
  const picker = runModule(FILES.picker, { '@/lib/studio-intelligence-p2': p2, '@/lib/studio-model-catalog': cat, '@/lib/studio-model-choice': choice }, opts)
  const hook = runModule(FILES.hook, { react, '@/lib/studio-model-catalog': cat, '@/lib/studio-model-choice': choice, '@/lib/studio-model-picker': picker }, opts)
  const component = runModule(FILES.component, {
    react, 'react/jsx-runtime': jsx, '@radix-ui/react-popover': radix, 'lucide-react': lucide, '@/lib/studio-model-picker': picker, './use-model-choice': hook, './model-picker.css': {},
  }, opts)
  return { p2, cat, choice, picker, hook, component }
}

/** Real React, real Radix, real icons: for markup. */
export function realDeps() {
  return { react: nodeRequire('react'), jsx: nodeRequire('react/jsx-runtime'), radix: nodeRequire('@radix-ui/react-popover'), lucide: nodeRequire('lucide-react') }
}
