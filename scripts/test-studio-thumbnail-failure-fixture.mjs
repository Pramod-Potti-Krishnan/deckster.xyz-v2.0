// Native-component fixture prop identity, simultaneous diagnostics and safe local callbacks/lifecycle.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import React from 'react'
import ts from 'typescript'
const require=createRequire(import.meta.url)
const source=fs.readFileSync(new URL('./studio-v4/ten-hour-thumbnail-failure-fixture.tsx',import.meta.url),'utf8')
const result=ts.transpileModule(source,{reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}})
assert.deepEqual((result.diagnostics??[]).filter(item=>item.category===ts.DiagnosticCategory.Error),[])
const slots=[],effects=[];let cursor=0
const Viewer=()=>null,Strip=()=>null,module={exports:{}}
const fakeReact={...React,useState:initial=>{const index=cursor++;if(!(index in slots))slots[index]=initial;return [slots[index],value=>{slots[index]=value}]},useEffect:callback=>effects.push(callback)}
vm.runInNewContext(result.outputText,{module,exports:module.exports,require:id=>id==='react'?fakeReact:id==='@/components/presentation-viewer'?{PresentationViewer:Viewer}:id==='@/components/slide-thumbnail-strip'?{SlideThumbnailStrip:Strip}:id.endsWith('.css')?{}:require(id)})
const find=(tree,type,result=[])=>{if(!tree||typeof tree!=='object')return result;if(tree.type===type)result.push(tree);React.Children.forEach(tree.props?.children,child=>find(child,type,result));return result}
let tree=module.exports.default(),checks=0
assert.equal(find(tree,Viewer).length,0);assert.equal(effects.length,1);effects[0]();cursor=0;tree=module.exports.default();checks++
const viewer=find(tree,Viewer)[0],strip=find(tree,Strip)[0]
assert.equal(viewer.props.presentationUrl,'https://layout-builder-v75-uat.up.railway.app/p/studio-v4-local-renderer')
assert.equal(viewer.props.isGenerating,false);assert.equal(viewer.props.showControls,false);checks++
const jobs=strip.props.composeJobs
assert.equal(jobs.length,2);assert.deepEqual(Array.from(jobs,job=>job.kind),['compose','refine'])
assert.deepEqual(Array.from(jobs,job=>job.status),['error','error'])
assert.equal(jobs[0].jobId,'studio-local-compose-failure');assert.equal(jobs[1].jobId,'studio-local-refine-failure')
assert.equal(jobs[1].targetSlideId,strip.props.slides[1].slideId)
for(const job of jobs){assert.ok(job.errors[0].includes('\n'));assert.ok(job.errors[0].length>2000);assert.equal(job.errors.length,2);assert.equal(job.onRetry,undefined);assert.equal(job.onSelect,undefined)}checks++
assert.equal(strip.props.onRefineSlide,undefined);assert.equal(strip.props.onDeleteSlide,undefined);assert.equal(strip.props.onReorderSlides,undefined);checks++
const initialDraft=slots[1]
strip.props.onSelectionChange([1]);strip.props.onSlideClick(3)
assert.deepEqual(slots[2],[1]);assert.equal(slots[3],true);assert.equal(slots[1],initialDraft);checks++
cursor=0;tree=module.exports.default()
const after=find(tree,Viewer)[0],afterStrip=find(tree,Strip)[0]
assert.equal(after.props.presentationUrl,viewer.props.presentationUrl)
assert.equal(afterStrip.props.composeJobs,jobs,'Stable native supplied job identity survives local inspection/selection')
assert.equal(afterStrip.props.slides,strip.props.slides);checks++
assert.ok(!/fetch\(|sendCommand|postMessage|WebSocket|setTimeout|setInterval|localStorage|onGenerate/.test(source),'No fixture transport, mutation, timer, persistence or fake acknowledgement')
assert.ok(source.includes('synthetic local error props, not generated failures')&&source.includes('Slide navigation refused locally.'))
assert.ok(source.includes('data-studio-thumbnail-failure-specimen="true"')&&source.includes('data-studio-thumbnail-failure-specimen-draft="true"'));checks++
console.log(`Studio thumbnail failure fixture: ${checks} local native-prop/lifecycle/safety checks passed`)
