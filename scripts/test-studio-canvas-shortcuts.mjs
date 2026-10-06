import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../lib/studio-canvas-shortcuts.ts', import.meta.url), 'utf8')
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } })
class Element { constructor(owner = null) { this.owner = owner } closest() { return this.owner } }
const module = { exports: {} }
vm.runInNewContext(output.outputText, { module, exports: module.exports, Element })
const { shouldHandleStudioCanvasShortcut: owns } = module.exports
const clear = { querySelector: () => null }
const popup = { querySelector: () => ({ role: 'menu' }) }
assert.equal(owns({ defaultPrevented: false, target: new Element() }, clear), true, 'canvas keeps ordinary deck shortcuts')
assert.equal(owns({ defaultPrevented: true, target: new Element() }, clear), false, 'consumed keys never reach the canvas')
assert.equal(owns({ defaultPrevented: false, target: new Element() }, popup), false, 'an open foreground popup owns its keyboard')
assert.equal(owns({ defaultPrevented: false, target: new Element({ role: 'combobox' }) }, clear), false, 'editing and navigation controls keep their keys')
assert.equal(owns({ defaultPrevented: false, target: new Element({ role: 'dialog' }) }, clear), false, 'nonmodal panel buttons keep their keys even without data-state')
assert.equal(owns({ defaultPrevented: false, target: new Element({ role: 'alertdialog' }) }, clear), false, 'deletion confirmation buttons keep their keys')
assert.equal(owns({ defaultPrevented: false, target: new Element() }, { querySelector: (selector) => selector.includes('[role="alertdialog"][data-state="open"]') ? {} : null }), false, 'an open deletion confirmation owns canvas keys')
assert.equal(owns({ defaultPrevented: false, target: null }, clear), true, 'a targetless ordinary event stays usable')
class BuildUpdates extends Element { closest(selector) { return selector.includes('[data-studio-build-footer="true"]') ? this : null } }
class FileDetails extends Element { closest(selector) { return selector.includes('[data-studio-file-detail="true"]') ? this : null } }
class QaDetails extends Element { closest(selector) { return selector.includes('[data-studio-qa-inspect="true"]') ? this : null } }
class InspectorControl extends Element { closest(selector) { return selector.includes('[data-studio-v4-panel]') ? this : null } }
class OrdinaryRegion extends Element { closest(selector) { return selector.includes('[role="region"]') ? this : null } }
assert.equal(owns({ defaultPrevented: false, target: new BuildUpdates() }, clear), false, 'native build updates keep their scrolling keys')
assert.equal(owns({ defaultPrevented: false, target: new FileDetails() }, clear), false, 'native source details keep their inspection keys')
assert.equal(owns({ defaultPrevented: false, target: new QaDetails() }, clear), false, 'native QA reasons keep their inspection keys')
assert.equal(owns({ defaultPrevented: false, target: new InspectorControl() }, clear), false, 'native Inspector controls keep their keys')
assert.equal(owns({ defaultPrevented: false, target: new OrdinaryRegion() }, clear), true, 'ordinary canvas regions retain deck shortcuts')
class DrawerHandle extends Element { closest(selector) { return selector.includes('[data-studio-drawer-handle]') ? this : null } }
assert.equal(owns({defaultPrevented:false,target:new DrawerHandle()},clear),false,'focused native drawer handles keep their navigation keys')
class EditGuide extends Element { closest(selector) { return selector.includes('[data-studio-edit-guide="true"]') ? this : null } }
class InactiveEditGuide extends Element { closest(selector) { return selector.includes('[data-studio-edit-guide="false"]') ? this : null } }
assert.equal(owns({defaultPrevented:false,target:new EditGuide()},clear),false,'focused native edit guidance owns scroll keys')
assert.equal(owns({defaultPrevented:false,target:new InactiveEditGuide()},clear),true,'only the literal active guide marker blocks canvas keys')
class DirectorLog extends Element { closest(selector) { return selector.includes('[data-studio-director-presence=\"true\"]') ? this : null } }
assert.equal(owns({defaultPrevented:false,target:new DirectorLog()},clear),false,'Director status/log own their native scrolling and toggle keys')
class MentionRows extends Element { closest(selector) { return selector.includes('[data-studio-composer-mentions=\"true\"]') ? this : null } }
assert.equal(owns({defaultPrevented:false,target:new MentionRows()},clear),false,'focused native mention rows own their keys')
class DirectorCode extends Element { closest(selector) { return selector.includes('[data-studio-director-code="true"]') ? this : null } }
class ClassicCode extends Element { closest(selector) { return selector.includes('[data-studio-director-code="false"]') ? this : null } }
assert.equal(owns({defaultPrevented:false,target:new DirectorCode()},clear),false,'focused native Director code owns scroll keys')
assert.equal(owns({defaultPrevented:false,target:new ClassicCode()},clear),true,'only the literal Studio code marker blocks canvas keys')
class PendingAction extends Element { closest(selector) { return selector.includes('[data-studio-composer-pending-action="true"]') ? this : null } }
class InactivePendingAction extends Element { closest(selector) { return selector.includes('[data-studio-composer-pending-action="false"]') ? this : null } }
assert.equal(owns({defaultPrevented:false,target:new PendingAction()},clear),false,'focused pending input details own scroll keys')
assert.equal(owns({defaultPrevented:false,target:new InactivePendingAction()},clear),true,'only the literal Studio pending-input marker blocks canvas keys')
console.log('Studio canvas keyboard ownership checks passed')

assert.equal(owns({ defaultPrevented: false, target: new Element() }, { querySelector: selector => selector === '[data-studio-canvas-covered="true"]' ? {} : null }), false, 'a covered mounted Stage must not receive foreground pane keys')
assert.equal(owns({ defaultPrevented: false, target: new Element() }, { querySelector: selector => selector === '[data-studio-canvas-covered="false"]' ? {} : null }), true, 'inactive coverage leaves normal canvas shortcuts available')

class WorkspaceSwitch extends Element { closest(selector) { return selector.includes('[data-studio-workspace-switch="true"]') ? this : null } }
assert.equal(owns({defaultPrevented:false,target:new WorkspaceSwitch()},clear),false,'Workspace switch buttons own their keys even while Stage is selected')
class InspectorSwitch extends Element { closest(selector) { return selector.includes('[data-studio-inspector-switch="true"]') ? this : null } }
assert.equal(owns({defaultPrevented:false,target:new InspectorSwitch()},clear),false,'Inspector switch buttons own their keys')

class SlideSpace extends Element {
  constructor(width, height, scrollWidth, scrollHeight) { super(); Object.assign(this, {clientWidth:width,clientHeight:height,scrollWidth,scrollHeight}) }
  closest(selector) { return selector === '[data-studio-slide-space="true"]' ? this : null }
}
assert.equal(owns({defaultPrevented:false,key:'ArrowRight',target:new SlideSpace(135,400,224,400)},clear),false,'overflowing narrow canvas owns default keyboard panning')
assert.equal(owns({defaultPrevented:false,key:'ArrowRight',target:new SlideSpace(432,40,432,140)},clear),false,'overflowing short canvas owns default keyboard panning')
assert.equal(owns({defaultPrevented:false,key:'ArrowRight',target:new SlideSpace(972,490,972,490)},clear),true,'normal-size canvas retains existing deck shortcuts')
assert.equal(owns({defaultPrevented:false,key:'ArrowRight',target:new SlideSpace(135,400,224,400)},{querySelector:()=>({})}),false,'foreground ownership still wins over scroll region')
console.log('Studio canvas keyboard ownership passed, including overflow panning and ordinary navigation.')
for (const key of ['g','b','e','Escape','s']) assert.equal(owns({defaultPrevented:false,key,target:new SlideSpace(135,400,224,400)},clear),true,'overflow region preserves native tool/escape/save shortcut ownership')
for (const modifier of ['ctrlKey','metaKey','altKey']) assert.equal(owns({defaultPrevented:false,key:'ArrowRight',[modifier]:true,target:new SlideSpace(135,400,224,400)},clear),true,'modified keys retain prior native shortcut ownership')
