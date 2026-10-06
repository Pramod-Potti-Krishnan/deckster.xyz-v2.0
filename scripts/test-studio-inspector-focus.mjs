import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const source=fs.readFileSync(new URL('../lib/studio-inspector-focus.ts',import.meta.url),'utf8')
const module={exports:{}}
class HTMLElement { constructor(box,viewport=null){this.box=box;this.viewport=viewport;this.scrollTop=40} closest(){return this.viewport} getBoundingClientRect(){return this.box} }
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports,HTMLElement})
const {studioInspectorScrollDelta:delta,keepStudioInspectorFocusVisible:keep,keepStudioScrollFocusVisible:keepScroll}=module.exports
const viewport={top:100,bottom:300,height:200}
assert.equal(delta({top:120,bottom:150,height:30},viewport),0)
assert.equal(delta({top:280,bottom:300,height:20},viewport),8)
assert.equal(delta({top:100,bottom:130,height:30},viewport),-8)
assert.equal(delta({top:95,bottom:125,height:30},viewport),-13)
assert.equal(delta({top:299,bottom:329,height:30},viewport),37)
assert.equal(delta({top:95,bottom:310,height:215},viewport),0,'oversized editable fields keep browser caret scrolling')
assert.equal(delta({top:100,bottom:100,height:0},viewport),0)
assert.equal(delta({top:100,bottom:104,height:4},{top:100,bottom:110,height:10}),0)
const region=new HTMLElement(viewport),field=new HTMLElement({top:280,bottom:300,height:20},region)
keep(field);assert.equal(region.scrollTop,48)
keepScroll(field,'.sp-account-body');assert.equal(region.scrollTop,56)
keep(null);keep(region);assert.equal(region.scrollTop,56)
const outside=new HTMLElement({top:0,bottom:30,height:30});keep(outside);assert.equal(outside.scrollTop,40)
assert.match(fs.readFileSync(new URL('../components/generation-panel/index.tsx',import.meta.url),'utf8'),/onFocusCapture=\{process\.env\.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' \? event => keepStudioInspectorFocusVisible\(event.target\) : undefined\}/)
console.log('Native Inspector focus clearance checks passed')
