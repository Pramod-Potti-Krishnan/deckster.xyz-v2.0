// Actual existing Viewer/cache callback witnesses plus the new pure remapper.
// Preview values are opaque synthetic handles, never fabricated image URLs.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const uat = 'ee532fab4b84a6883f8a5b50675ccab692b62240'
const publicRef='84a6c54b77af77650c24e07a47f883a82cb47acb'
const beforeFiles={ 'components/presentation-viewer.tsx':'before-viewer.tsx.txt','hooks/use-stage-f-thumbnail-cache.ts':'before-cache-hook.ts.txt','components/slide-thumbnail-strip.tsx':'before-thumbnail-strip.tsx.txt' }
const source = (ref,file) => ref === 'before-working' ? read(`docs/studio-v4/eight-hour-parity-20261005/builder1/thumbnail-mutations/${beforeFiles[file]}`) : ref === 'working' ? read(file) : execFileSync('git',['show',`${ref}:${file}`],{cwd:root,encoding:'utf8'})
const compile = text => ts.transpileModule(text,{ compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true} }).outputText
function pure(file) { const module={exports:{}}; vm.runInNewContext(compile(read(file)),{module,exports:module.exports,require:()=>{throw Error('Unexpected dependency')}});return module.exports }
const thumbnails=pure('lib/stage-f-thumbnails.ts')
const helper=pure('lib/studio-slide-thumbnail-mutations.ts')
const {planStudioSlideThumbnailMutation:plan,remapStudioSlideThumbnailValues:remap,remapStudioSlideThumbnailRows:rows}=helper
const plain=value=>JSON.parse(JSON.stringify(value))
function declaration(text,name) {
  const ast=ts.createSourceFile('actual.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let found
  function visit(node) { if(ts.isVariableDeclaration(node)&&node.name.getText(ast)===name)found=node;ts.forEachChild(node,visit) }
  visit(ast);assert.ok(found,`Actual ${name} exists`);return {ast,node:found}
}
function callback(text,name,context) { const {ast,node}=declaration(text,name); const fn=node.initializer.arguments[0].getText(ast);const module={exports:{}};vm.runInNewContext(compile(`module.exports = (${fn})`),{module,exports:module.exports,...context});return module.exports }
const preview=Object.freeze({received:'synthetic-preview-A'}),second=Object.freeze({received:'synthetic-preview-B'}),third=Object.freeze({received:'synthetic-preview-C'})
const previewMap={0:preview,1:second,2:third}
const metadata=['A','B','C'].map((id,index)=>({slide_id:`synthetic-slide-${id}`,slide_index:index,title:`Synthetic title ${id}`}))
function viewer(ref,modified,total,map=previewMap) { return callback(source(ref,'components/presentation-viewer.tsx'),'slideThumbnails',{slideStructure:{slides:metadata},slidesModifiedByCrud:modified,totalSlides:total,thumbnailUrlsBySlide:map,studioShell:true,presentationId:'synthetic-deck',...thumbnails})() }
let checks=0;const receipts=[]
function check(label,fn) { fn();checks++;console.log(`PASS ${label}`) }
for(const ref of [uat,publicRef,'before-working']) check(`actual ${ref} Viewer loses every stable title/id after exact3→4 native add`,()=>{
  const before=viewer(ref,false,3),after=viewer(ref,true,4)
  assert.equal(before[0].title,'Synthetic title A');assert.equal(before[0].slideId,'synthetic-slide-A')
  assert.deepEqual(plain(after.map(row=>row.title)),['Slide 1','Slide 2','Slide 3','Slide 4']);assert.equal(after.filter(row=>row.slideId).length,0)
  receipts.push({ref,operation:'actual memo callback',before:{titles:before.map(row=>row.title),ids:3,previewHandles:3},after:{titles:after.map(row=>row.title),ids:0},evidence:'source/isolated; no pixels or URLs'})
})
check('actual current cache invalidation removes all same-presentation preview entries and records tombstone',()=>{
  const cacheText=source('before-working','hooks/use-stage-f-thumbnail-cache.ts'),renderScope={key:'synthetic-scope'};let record={scope:'synthetic-scope',hydrated:true,urls:{'synthetic-deck':previewMap,'synthetic-other':{0:preview}},invalidated:[]}
  const invalidate=callback(cacheText,'invalidateThumbnailUrls',{scope:'synthetic-scope',renderScope,scopeRef:{current:renderScope},aliveRef:{current:true},setRecord:update=>{record=update(record)}})
  invalidate('synthetic-deck');assert.equal(record.urls['synthetic-deck'],undefined);assert.equal(record.urls['synthetic-other'][0],preview);assert.deepEqual(plain(record.invalidated),['synthetic-deck'])
  const after=viewer('before-working',true,4,record.urls['synthetic-deck']??{});assert.equal(after.filter(row=>row.thumbnailUrl).length,0)
  receipts.push({ref:'working',operation:'actual invalidateThumbnailUrls + Viewer memo',beforePreviewEntries:3,afterPreviewEntries:0,tombstone:true,otherPresentationPreserved:true})
})
check('actual owner-captured Viewer invalidation dispatches only current owned frame and rejects ABA',()=>{
  const owner={presentationId:'synthetic-deck'},iframe={},mount={active:true,generation:0},ownerRef={current:owner},iframeRef={current:iframe};let calls=0
  const capture=callback(source('before-working','components/presentation-viewer.tsx'),'captureThumbnailInvalidation',{renderSlideMutationOwner:owner,iframeRef,slideMutationMountRef:{current:mount},studioShell:true,slideMutationOwnerRef:ownerRef,nativeSnapshotStructureEditedRef:{current:false},onThumbnailInvalidatedRef:{current:()=>calls++}})
  const pending=capture();pending();assert.equal(calls,1);ownerRef.current={presentationId:'synthetic-B'};ownerRef.current={presentationId:'synthetic-deck'};pending();assert.equal(calls,1)
})


function strip(ref) {
  const text=source(ref,'components/slide-thumbnail-strip.tsx'),ast=ts.createSourceFile('strip.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  const imports={react:{...React,useState:value=>[value,()=>{}],useRef:()=>({current:null}),useEffect:()=>{},useCallback:fn=>fn},'react/jsx-runtime':jsxRuntime,'@/lib/utils':{cn:(...args)=>args.filter(Boolean).join(' ')},'@/lib/slide-compose-async':pure('lib/slide-compose-async.ts'),'@/lib/slide-thumbnail-menu':pure('lib/slide-thumbnail-menu.ts'),'./slide-layout-picker':{SLIDE_LAYOUTS:[]}}
  for(const node of ast.statements){if(!ts.isImportDeclaration(node)||node.importClause?.isTypeOnly)continue;const key=node.moduleSpecifier.text;if(key in imports)continue;assert.ok(key==='lucide-react'||key.startsWith('@/components/ui/')||key==='@radix-ui/react-tooltip'||key.endsWith('.css'));imports[key]=Object.fromEntries((node.importClause?.namedBindings?.elements??[]).map(name=>[name.propertyName?.text??name.name.text,`synthetic:${name.name.text}`]))}
  const module={exports:{}};vm.runInNewContext(compile(text),{module,exports:module.exports,process:{env:{NEXT_PUBLIC_STUDIO_V4_SHELL:'true'}},require:key=>{assert.ok(key in imports,`Unexpected ${key}`);return imports[key]}});return module.exports.SlideThumbnailStrip
}
function nodes(value){return Array.isArray(value)?value.flatMap(nodes):!value||typeof value!=='object'?[]:[value,...nodes(value.props?.children)]}
for(const ref of [uat,publicRef,'before-working']) check(`actual ${ref} strip separates pressed bulk slide4 from current canvas slide5`,()=>{
 const Component=strip(ref),tree=Component({slides:Array.from({length:5},(_,i)=>({slideNumber:i+1,title:`Synthetic title ${i+1}`})),currentSlide:5,selectedSlides:[3],onSlideClick:()=>{},orientation:'vertical',totalSlides:5});const navigation=nodes(tree).filter(node=>node.props?.['data-studio-thumbnail-navigation']===true)
 if(ref===uat){const wrappers=nodes(tree).filter(node=>typeof node.props?.title==='string'&&node.props.title.startsWith('Click to navigate'));assert.equal(wrappers.length,5);assert.ok(wrappers[3].props.className.includes('border-blue-400'));assert.ok(wrappers[4].props.className.includes('border-blue-600'));assert.equal(navigation.length,0)}else{assert.equal(navigation.length,5);assert.equal(navigation[3].props['aria-pressed'],true);assert.equal(navigation[4].props['aria-current'],'true');assert.equal(navigation[4].props['aria-pressed'],false)}
 receipts.push({ref,operation:'actual strip render with currentSlide5 and selectedSlides[3]',bulkSelectedSlide:4,currentSlide:5,ariaAttributes:ref===uat?'not exposed in UAT':'pressed versus current',evidence:'source/isolated prop rendering only; no browser/native selection effect'})
})
if(process.argv.includes('--before')) {
  const folder=path.join(root,'docs/studio-v4/eight-hour-parity-20261005/builder1/thumbnail-mutations/evidence')
  fs.writeFileSync(path.join(folder,'actual-before-witness.json'),JSON.stringify({receipts,limitations:['Actual extracted Viewer/cache callbacks with synthetic metadata and opaque received preview handles','No URLs, pixels, browser, native mutation or connected persistence executed']},null,2)+'\n')
  const after=viewer('before-working',true,4,{})
  const preservedIds=after.filter(row=>row.slideId).length
  const preservedPreviews=after.filter(row=>row.thumbnailUrl).length
  console.error(`FAIL actual prior stable title/ID preservation: expected3 unchanged IDs, observed${preservedIds}`)
  console.error(`FAIL actual prior received-preview preservation: expected3 unchanged entries, observed${preservedPreviews}`)
  console.log('Actual existing callbacks fail both preservation criteria; pure helper/shared integration absent from this before witness.')
  process.exit(1)
}
const owner=Object.freeze({userId:'synthetic-user',sessionId:'synthetic-session',presentationId:'synthetic-deck',source:'synthetic-frame-source',activeVersion:'final',epoch:1})
const capture={owner,nativeRevision:2,metadataRevision:3,nativeCount:3}
const baseRows=metadata.map((slide,index)=>({slideNumber:index+1,slideIndex:index,actualSlideIndex:index,slideId:slide.slide_id,title:slide.title,content:`Synthetic content ${index}`}))
const input=(mutation,ack,extra={})=>({captured:capture,current:capture,mutation,acknowledgement:{success:true,...ack},...extra})
check('actual restore merge would refill a new empty slot with an old index image unless presentation restore is fenced',()=>{
 const p=plan(input({kind:'add'},{slide_index:1,slide_count:4})),live=remap(previewMap,p)
 const unsafe=thumbnails.mergeRestoredStageFThumbnailUrls({'synthetic-deck':previewMap},{'synthetic-deck':live})
 assert.equal(live[1],undefined);assert.equal(unsafe['synthetic-deck'][1],second)
 const fenced=thumbnails.mergeRestoredStageFThumbnailUrls({},{'synthetic-deck':live})
 assert.equal(fenced['synthetic-deck'][1],undefined);assert.equal(fenced['synthetic-deck'][2],second)
})
for(let inserted=0;inserted<=3;inserted++) check(`exact add index${inserted} preserves all prior preview/title identities and leaves inserted slot empty`,()=>{
  const p=plan(input({kind:'add'},{slide_index:inserted,slide_count:4}));assert.equal(p.mode,'mapped');const images=remap(previewMap,p),meta=rows(baseRows,p)
  assert.equal(images[inserted],undefined);assert.equal(meta[inserted].slideId,undefined);assert.equal(meta[inserted].title,`Slide ${inserted+1}`)
  for(let old=0;old<3;old++){const next=old>=inserted?old+1:old;assert.equal(images[next],previewMap[old]);assert.equal(meta[next].slideId,baseRows[old].slideId);assert.equal(meta[next].title,baseRows[old].title);assert.equal(meta[next].actualSlideIndex,next)}
})
for(const after of [true,false]) for(let sourceIndex=0;sourceIndex<3;sourceIndex++) check(`duplicate source${sourceIndex}/${after} never copies original ID/title/image into new slide`,()=>{
  const newIndex=sourceIndex+(after?1:0),p=plan(input({kind:'duplicate',sourceIndex,insertAfter:after},{new_slide_index:newIndex,slide_count:4}));assert.equal(p.mode,'mapped');assert.equal(remap(previewMap,p)[newIndex],undefined);assert.equal(rows(baseRows,p)[newIndex].slideId,undefined);assert.equal(Object.keys(remap(previewMap,p)).length,3)
})
for(const deleted of [[0],[1],[2],[0,2],[2,0]]) check(`exact bulk deletion[${deleted}] keeps only survivor identities`,()=>{
  const p=plan(input({kind:'delete'},{deleted_indices:deleted,deleted_count:deleted.length,remaining_slide_count:3-deleted.length}));assert.equal(p.mode,'mapped');const expected=[0,1,2].filter(i=>!deleted.includes(i));assert.deepEqual(plain(p.oldIndexByNewIndex),expected);const images=remap(previewMap,p);expected.forEach((old,next)=>assert.equal(images[next],previewMap[old]))
})
for(let fromIndex=0;fromIndex<3;fromIndex++) for(let toIndex=0;toIndex<3;toIndex++) check(`reorder${fromIndex}→${toIndex} uses owned immutable command and verified native count`,()=>{
  const p=plan(input({kind:'reorder',fromIndex,toIndex},{slide_order:['C1','C1','C1']},{verifiedNativeCount:3}));assert.equal(p.mode,'mapped');const expected=[0,1,2];const [old]=expected.splice(fromIndex,1);expected.splice(toIndex,0,old);assert.deepEqual(plain(p.oldIndexByNewIndex),expected);const images=remap(previewMap,p);expected.forEach((old,next)=>assert.equal(images[next],previewMap[old]))
})
check('confirmed changed layout excludes only changed image/title/ID, never others',()=>{
  const p=plan(input({kind:'change',index:1},{},{verifiedNativeCount:3}));assert.equal(p.mode,'mapped');assert.equal(remap(previewMap,p)[1],undefined);assert.equal(remap(previewMap,p)[0],preview);assert.equal(rows(baseRows,p)[1].slideId,undefined)
})
for(const [label,mutation,ack,extra] of [
 ['missing add index',{kind:'add'},{slide_count:4}],['fraction index',{kind:'add'},{slide_index:1.5,slide_count:4}],['negative index',{kind:'add'},{slide_index:-1,slide_count:4}],['coercible index',{kind:'add'},{slide_index:'1',slide_count:4}],['wrong count',{kind:'add'},{slide_index:1,slide_count:5}],['conflicting aliases',{kind:'add'},{slide_index:1,slide_count:4,data:{slideIndex:2}}],['wrong action',{kind:'add'},{action:'deleteSlides',slide_index:1,slide_count:4}],['native count discrepancy',{kind:'add'},{slide_index:1,slide_count:4},{verifiedNativeCount:5}],
 ['missing exact deletions',{kind:'delete'},{deleted_count:1,remaining_slide_count:2}],['duplicate deletion index',{kind:'delete'},{deleted_indices:[1,1],deleted_count:2,remaining_slide_count:1}],['all slides deleted',{kind:'delete'},{deleted_indices:[0,1,2],deleted_count:3,remaining_slide_count:0}],['partial deletion count',{kind:'delete'},{deleted_indices:[1],deleted_count:2,remaining_slide_count:2}],
 ['unknown duplicate position',{kind:'duplicate',sourceIndex:0,insertAfter:true},{new_slide_index:2,slide_count:4}],['reorder lacks fresh native count',{kind:'reorder',fromIndex:0,toIndex:2},{slide_order:['C1','C1','C1']}],['reorder wrong postcount',{kind:'reorder',fromIndex:0,toIndex:2},{},{verifiedNativeCount:4}],['layout change count unknown',{kind:'change',index:1},{}],['receipt refusal',{kind:'add'},{success:false,slide_index:1,slide_count:4}],
]) check(`ambiguous ${label} clears rather than guessing old mapping`,()=>{const p=plan(input(mutation,ack,extra));assert.equal(p.mode,'clear');assert.deepEqual(plain(remap(previewMap,p)),{})})
for(const [label,current] of [
 ['owner ABA',{...capture,owner:{...owner}}],['account',{...capture,owner:{...owner,userId:'other'}}],['source reload',{...capture,owner:{...owner,epoch:2}}],['native revision',{...capture,nativeRevision:3}],['metadata refreshed',{...capture,metadataRevision:4}],['native count changed',{...capture,nativeCount:4}],
]) check(`retired ${label} cannot remap or clear newer owner metadata`,()=>{const p=plan(input({kind:'add'},{slide_index:1,slide_count:4},{current}));assert.equal(p.mode,'retired');assert.equal(remap(previewMap,p),previewMap);assert.equal(rows(baseRows,p),baseRows)})
check('new metadata/count mismatch cannot project stale Director rows into fresh native order',()=>{
 const p=plan(input({kind:'add'},{slide_index:3,slide_count:4}));const projected=rows(baseRows.slice(0,2),p);assert.equal(projected.length,4);assert.equal(projected.filter(row=>row.slideId).length,0)
})
check('input maps/rows remain immutable and returned row positions are all physical native indices',()=>{
 const before=plain(baseRows);const p=plan(input({kind:'add'},{slide_index:1,slide_count:4}));const mapped=rows(baseRows,p);assert.deepEqual(plain(baseRows),before);assert.equal(previewMap[1],second);mapped.forEach((row,index)=>{assert.equal(row.slideNumber,index+1);assert.equal(row.slideIndex,index);assert.equal(row.actualSlideIndex,index)})
})
check('chained3→4→5 additions retain only original known metadata, not stale Director length3 fallback',()=>{
 const first=plan(input({kind:'add'},{slide_index:3,slide_count:4})),firstMap=remap(previewMap,first),firstRows=rows(baseRows,first)
 const nextCapture={...capture,nativeCount:4,nativeRevision:3};const secondPlan=plan({captured:nextCapture,current:nextCapture,mutation:{kind:'add'},acknowledgement:{success:true,slide_index:4,slide_count:5}});const next=remap(firstMap,secondPlan),meta=rows(firstRows,secondPlan);assert.equal(Object.keys(next).length,3);assert.equal(meta.filter(row=>row.slideId).length,3);assert.equal(meta.length,5)
})


check('unknown mapping still renders fresh acknowledged native count, never stale Director count',()=>{
 const p=plan(input({kind:'add'},{slide_count:4}));assert.equal(p.mode,'clear');assert.equal(p.nativeCount,4);const meta=rows(baseRows,p);assert.equal(meta.length,4);assert.equal(meta.filter(row=>row.slideId).length,0);assert.deepEqual(plain(remap(previewMap,p)),{})
})
const admits=helper.canAdmitStudioSlideThumbnailMetadata
const nativeIds=baseRows.map(row=>row.slideId)
check('metadata refresh admits only exact current native ID order and index positions',()=>assert.equal(admits({captured:capture,current:capture,rows:baseRows,nativeSlideIds:nativeIds}),true))
for(const [label,change] of [
 ['same-count stale reorder',{rows:[baseRows[2],baseRows[1],baseRows[0]]}],['wrong IDs',{nativeSlideIds:['other',nativeIds[1],nativeIds[2]]}],['unknown native IDs',{nativeSlideIds:[undefined,nativeIds[1],nativeIds[2]]}],['duplicate native IDs',{nativeSlideIds:[nativeIds[0],nativeIds[0],nativeIds[2]]}],['count mismatch',{rows:baseRows.slice(0,2)}],['stale metadata read',{current:{...capture,metadataRevision:4}}],['stale native revision',{current:{...capture,nativeRevision:3}}],['reload/ABA owner',{current:{...capture,owner:{...owner}}}],['stale actual index',{rows:baseRows.map((row,i)=>i===1?{...row,actualSlideIndex:0}:row)}],
]) check(`metadata refresh refuses ${label} without inventing identity`,()=>assert.equal(admits({captured:capture,current:capture,rows:baseRows,nativeSlideIds:nativeIds,...change}),false))
const folder=path.join(root,'docs/studio-v4/eight-hour-parity-20261005/builder1/thumbnail-mutations/evidence')
fs.writeFileSync(path.join(folder,'actual-before-witness.json'),JSON.stringify({receipts,limitations:['Actual extracted Viewer/cache callbacks with synthetic metadata and opaque preview handles','No image addresses constructed or fetched','No image pixels/connected outcome/native mutation/persistence verified by worker']},null,2)+'\n')
console.log(`${checks} thumbnail mutation source/isolated cases passed; no URLs/network/browser/services created.`)
