// Actual Viewer props/lifecycle/continuity and purely local cover/draft callbacks; no native request.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import React from 'react'
import ts from 'typescript'
const require=createRequire(import.meta.url)
const source=fs.readFileSync(new URL('./studio-v4/ten-hour-generation-cover-fixture.tsx',import.meta.url),'utf8')
const output=ts.transpileModule(source,{reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}})
assert.deepEqual((output.diagnostics??[]).filter(item=>item.category===ts.DiagnosticCategory.Error),[])
const slots=[],effects=[];let cursor=0
const Viewer=()=>null,module={exports:{}}
const fakeReact={...React,useState:initial=>{const index=cursor++;if(!(index in slots))slots[index]=initial;return [slots[index],value=>{slots[index]=value}]},useEffect:callback=>effects.push(callback)}
vm.runInNewContext(output.outputText,{module,exports:module.exports,require:id=>id==='react'?fakeReact:id==='@/components/presentation-viewer'?{PresentationViewer:Viewer}:id.endsWith('.css')?{}:require(id)})
const find=(tree,predicate,result=[])=>{if(!tree||typeof tree!=='object')return result;if(predicate(tree))result.push(tree);React.Children.forEach(tree.props?.children,child=>find(child,predicate,result));return result}
const render=()=>{cursor=0;return module.exports.default()}
let checks=0,tree=render()
assert.equal(find(tree,node=>node.type===Viewer).length,0);assert.equal(effects.length,1)
assert.equal(find(tree,node=>node.props['data-studio-generation-specimen-toggle']==='true')[0].props.checked,false)
effects[0]();tree=render();checks++
const before=find(tree,node=>node.type===Viewer)[0]
assert.equal(before.props.presentationUrl,'https://layout-builder-v75-uat.up.railway.app/p/studio-v4-local-renderer')
assert.equal(before.props.isGenerating,false);assert.equal(before.props.showControls,true);assert.equal(before.key,null);checks++
const textarea=find(tree,node=>node.props['data-studio-generation-specimen-draft']==='true')[0]
textarea.props.onChange({target:{value:'Retained native local unsent draft'}})
for(const enabled of [true,false,true]){
 tree=render();find(tree,node=>node.props['data-studio-generation-specimen-toggle']==='true')[0].props.onChange({target:{checked:enabled}})
 tree=render();const viewer=find(tree,node=>node.type===Viewer)[0]
 assert.equal(viewer.props.isGenerating,enabled);assert.equal(tree.props['data-studio-generation-specimen-cover'],String(enabled))
 assert.equal(viewer.type,before.type);assert.equal(viewer.key,before.key)
 assert.equal(viewer.props.presentationUrl,before.props.presentationUrl);assert.equal(viewer.props.presentationId,before.props.presentationId)
 assert.equal(viewer.props.slideCount,before.props.slideCount);assert.equal(viewer.props.showControls,before.props.showControls)
 assert.equal(find(tree,node=>node.props['data-studio-generation-specimen-draft']==='true')[0].props.value,'Retained native local unsent draft')
 assert.equal(Object.keys(viewer.props).some(key=>key.startsWith('on')),false,'Specimen gives Viewer no generation/action callback');checks++
}
assert.ok(!/fetch\(|sendCommand|postMessage|WebSocket|setTimeout|setInterval|localStorage|onGenerate|generatingMode=|stageChrome=/.test(source),'Fixture adds no service/action/acknowledgement/timer/loader override')
assert.ok(source.includes('synthetic local isGenerating prop')&&source.includes('no generation starts, completes or acknowledges a result'))
assert.ok(source.includes("height:'100dvh'")&&source.includes('minHeight:0')&&source.includes("overflow:'hidden'"));checks++
console.log(`Studio generation cover fixture: ${checks} local native-prop/lifecycle/continuity/safety checks passed`)
