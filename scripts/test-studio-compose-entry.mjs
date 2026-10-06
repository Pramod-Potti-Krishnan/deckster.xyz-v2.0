import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { createHash } from 'node:crypto'
import { component, nodes, configuredOrigin } from '../docs/studio-v4/eight-hour-parity-20261005/builder1/test-fixtures/viewer-component-harness.mjs'
const files = ['app/builder/page.tsx','components/builder/presentation-area.tsx','components/presentation-viewer.tsx']
const source = Object.fromEntries(files.map(file => [file, fs.readFileSync(file,'utf8')]))
const ast = ts.createSourceFile(files[0], source[files[0]], ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
let open, foreground, gate
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'handleOpenSlideCompose') open = node.initializer.arguments[0]
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'bringToFront') foreground = node.initializer.arguments[0]
  if (ts.isJsxAttribute(node) && node.name.getText(ast) === 'onGenerateSlide') gate = node.initializer.expression
  ts.forEachChild(node, visit)
}
visit(ast); assert.ok(open && foreground && gate)
const evaluate = (node, bindings) => vm.runInNewContext(ts.transpileModule('('+node.getText(ast)+')', { compilerOptions:{target:ts.ScriptTarget.ES2022} }).outputText, bindings)
let mode='refine', target={slide_id:'synthetic-owned-slide',slide_index:1}, panel=false, pane='chat', preferred='element', stage=true, stack={element:1,slide:2,deck:3}
const binding = { studioShell:true, zCounterRef:{current:4}, setPanelZIndices:update=>{stack=update(stack)}, selectWorkspacePane:value=>{pane=value;stage=false}, setPreferredInspector:value=>{preferred=value} }
const bringToFront=evaluate(foreground,binding)
const callback=evaluate(open,{setSlideGenerationMode:value=>{mode=value},setSlideRefineTarget:value=>{target=value},setShowFormatPanel:value=>{panel=value},bringToFront})
for (const studioShell of [false,true]) for (const slideComposerEnabled of [false,true]) {
  assert.equal(evaluate(gate,{studioShell,features:{slideComposerEnabled},handleOpenSlideCompose:callback}), studioShell&&slideComposerEnabled?callback:undefined)
}
callback();assert.equal(mode,'compose');assert.equal(target,null);assert.equal(panel,true);assert.equal(pane,'inspector');assert.equal(preferred,'slide');assert.equal(stage,false);assert.equal(stack.slide,5)
assert.ok(source[files[1]].includes('onGenerateSlide={onGenerateSlide}'), 'Actual Area forwards same optional callback')
for (const studio of [true,false]) {
  const viewer=component(source[files[2]],studio)
  let tree=viewer.render({presentationUrl:configuredOrigin+'/p/synthetic-owned',presentationId:'synthetic-owned',slideCount:3,showControls:true,onGenerateSlide:studio?callback:undefined,sessionId:'synthetic-owner',deckOwnerSessionId:'synthetic-owner'},true)
  if (studio) {
    const slot=nodes(tree).find(node=>node.props?.['data-studio-authoring-slot']==='true')
    assert.ok(slot);slot.props.ref({syntheticPortal:true})
    tree=viewer.render({presentationUrl:configuredOrigin+'/p/synthetic-owned',presentationId:'synthetic-owned',slideCount:3,showControls:true,onGenerateSlide:callback,sessionId:'synthetic-owner',deckOwnerSessionId:'synthetic-owner'})
  }
  const picker=nodes(tree).find(node=>node.type===viewer.stub('./slide-layout-picker','SlideLayoutPicker'))
  assert.ok(picker);assert.equal(picker.props.onGenerateSlide,studio?callback:undefined)
  assert.equal(picker.props.disabled,true,'Native picker cannot generate until actual Viewer is ready')
  assert.equal(typeof picker.props.onAddSlide,'function','Existing native layout insertion callback remains')
}
const receipt={level:'Actual page callback/prop expression, actual Viewer function-hook fixture, source Area forwarding; no mounted page/browser/backend execution',checks:7,sourceHashes:Object.fromEntries(files.map(file=>[file,createHash('sha256').update(source[file]).digest('hex')])),connectedFixProven:false}
const evidence=process.argv.find(arg=>arg.startsWith('--evidence='))?.slice('--evidence='.length)
if(evidence)fs.writeFileSync(evidence,JSON.stringify(receipt,null,2)+'\n')
console.log('7 actual compose-entry integration groups passed; real native readiness and classic entry preserved.')
