// Native physical-DOM listener bridge; no presentation action or owner changes.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import React from 'react'
import ts from 'typescript'

const root = new URL('../', import.meta.url), file = 'components/builder/builder-header.tsx'
const source = fs.readFileSync(new URL(file, root), 'utf8')
const original = execFileSync('git', ['show', 'b1134ff:' + file], { cwd: root, encoding: 'utf8' })
const effect = source.match(/  React\.useEffect\(\(\) => \{\n    if \(!studioShell \|\| !onToolbarInteract\)[\s\S]*?  \}, \[studioShell, onToolbarInteract\]\)\n\n/)?.[0]
assert.ok(effect, 'The optional native bridge has exact callback/Studio effect dependencies')
assert.equal(source.replace('  onToolbarInteract?: () => void\n', '').replace('  onToolbarInteract,\n', '').replace(effect, ''), original, 'Every pre-existing header element, handler, gate and focus-reveal effect remains byte-exact')
const compiled = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } })
assert.deepEqual((compiled.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error), [])
const require = createRequire(import.meta.url)
const noop = () => null
let cases = 0
for (const flag of [undefined, 'false', 'TRUE', '1', 'true']) for (const hasCallback of [false, true]) for (const hasContainer of [false, true]) {
  const effects = [], container = new EventTarget(), calls = []
  const header = { querySelector: selector => { assert.equal(selector, '[data-studio-v4-toolbar-target]'); return hasContainer ? container : null } }
  const fakeReact = { ...React, useRef: () => ({ current: header }), useEffect: (callback, dependencies) => effects.push({ callback, dependencies }) }
  const module = { exports: {} }
  vm.runInNewContext(compiled.outputText, { module, exports: module.exports, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: flag } }, require: id => {
    if (id === 'react') return { ...fakeReact, default: fakeReact }
    if (id === 'next-themes') return { useTheme: () => ({ resolvedTheme: 'light' }) }
    if (id === '@/lib/deck-identity') return { isDeckIdentityEnabled: () => false }
    if (id === 'react/jsx-runtime') return require(id)
    return new Proxy({ default: noop }, { get: (_, name) => name === '__esModule' ? true : noop })
  } })
  const callback = () => calls.push('interaction')
  module.exports.BuilderHeader({ onOpenChatHistory: noop, onToolbarInteract: hasCallback ? callback : undefined })
  assert.equal(effects.length, 2, 'Native scroll-to-focused-control effect is retained alongside the new bridge')
  const bridge = effects[1]
  assert.equal(bridge.dependencies[0], flag === 'true')
  assert.equal(bridge.dependencies[1], hasCallback ? callback : undefined)
  const cleanup = bridge.callback(), active = flag === 'true' && hasCallback && hasContainer
  for (const type of ['focusin', 'pointerdown', 'click', 'keydown']) container.dispatchEvent(new Event(type))
  assert.equal(calls.length, active ? 2 : 0, 'Only focusin/pointerdown inside the existing target notify an optional Studio caller')
  if (active) {
    assert.equal(typeof cleanup, 'function')
    cleanup()
    container.dispatchEvent(new Event('focusin')); container.dispatchEvent(new Event('pointerdown'))
    assert.equal(calls.length, 2, 'Cleanup removes both exact native listeners')
  } else assert.equal(cleanup, undefined)
  cases++
}
console.log(`Studio toolbar interaction: ${cases} literal/optional/container/event/cleanup cases and whole-header preservation passed`)
