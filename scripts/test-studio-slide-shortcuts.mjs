import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const source = fs.readFileSync(new URL('../lib/studio-slide-shortcuts.ts', import.meta.url), 'utf8')
class Element { constructor(chooser = false) { this.chooser = chooser } closest(selector) { return this.chooser && selector === '[data-studio-slide-menu]' ? this : null } }
const module = { exports: {} }
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module, exports: module.exports, Element })
const { shouldYieldStudioSlidePanelShortcut: yields } = module.exports
assert.equal(yields({ defaultPrevented: false, target: new Element(true) }), true, 'a native chooser owns dismissal and selection')
assert.equal(yields({ defaultPrevented: true, target: new Element() }), true, 'consumed native keys do not close or submit the parent panel')
assert.equal(yields({ defaultPrevented: false, target: new Element() }), false, 'ordinary panel Escape and submit shortcuts remain')
assert.equal(yields({ defaultPrevented: false, target: null }), false)
const panel = fs.readFileSync(new URL('../components/slide-generation-panel/index.tsx', import.meta.url), 'utf8')
assert.match(panel, /process\.env\.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && shouldYieldStudioSlidePanelShortcut\(e\)/)
console.log('Studio slide chooser shortcut ownership passed')
