import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { normalizeClarificationSuccessor } from '../docs/studio-v4/twenty-four-hour-parity-20261005/builder1/selection-lane-successor/normalize-lane.mjs'
import { execFileSync } from 'node:child_process'
const file='components/slide-generation-panel/index.tsx',source=fs.readFileSync(process.argv.includes('--selection-snapshot')?'docs/studio-v4/twenty-four-hour-parity-20261005/builder1/sync-selection-review/FINAL-panel.tsx.txt':process.argv.includes('--clarification-snapshot')?'docs/studio-v4/twenty-four-hour-parity-20261005/builder1/clarification-integration/FINAL-index.tsx.txt':file,'utf8'),before=execFileSync('git',['show','569a09f:'+file],{encoding:'utf8'})
function parts(text){
 const ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let reset,submit
 const visit=n=>{if(ts.isCallExpression(n)&&n.expression.getText(ast)==='useEffect'&&n.arguments[0]?.getText(ast).includes('const panelContextKey ='))reset=n.arguments[0].getText(ast);if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='handleGenerate')submit=n.initializer.getText(ast);ts.forEachChild(n,visit)};visit(ast);assert(reset&&submit)
 return {reset:ts.transpileModule('('+reset+')()',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,submit}
}
const now=parts(source),old=parts(before),plain=x=>JSON.parse(JSON.stringify(x))
function harness(flag='true',prior=false){
 const values={prompt:'',keyMessage:'',error:null,successMessage:null,acceptedJobId:null,needsInput:null,answers:{},useWebSearch:false,useDeepResearch:false,useUploadedDocuments:false,useKnowledgeGraph:false};let calls=[]
 const ctx={process:{env:{NEXT_PUBLIC_STUDIO_V4_SHELL:flag}},lastPanelContextKeyRef:{current:null},isOpen:true,isRefineMode:false,mode:'compose',sessionId:'session-A',presentationId:'deck-A',currentSlide:2,refineTarget:null,research:{useWebSearch:true,useDeepResearch:false,useUploadedDocuments:true,useKnowledgeGraph:false}}
 for(const key of Object.keys(values))ctx['set'+key[0].toUpperCase()+key.slice(1)]=value=>{values[key]=value;calls.push([key,value])}
 return {values,ctx,run(change={}){Object.assign(ctx,change);ctx.isRefineMode=ctx.mode==='refine';calls=[];vm.runInNewContext(prior?old.reset:now.reset,ctx);return plain(calls)},draft(){Object.assign(values,{prompt:'Unsent raw A',keyMessage:'Key A',error:'Retained refusal',needsInput:{questions:[{id:'A'}]},answers:{A:'Answer A'},useWebSearch:false,useUploadedDocuments:false})}}
}
let checks=0
const baseline=harness('true',true);baseline.run();baseline.draft();baseline.run({isOpen:false});baseline.run({isOpen:true});assert.equal(baseline.values.prompt,'');checks++
for(const mode of ['compose','refine']){
 const h=harness();h.run({mode,refineTarget:mode==='refine'?{slide_id:'slide-A',slide_index:1}:null});h.draft();const draft=plain(h.values)
 assert.deepEqual(h.run({isOpen:false}),[]);assert.deepEqual(h.run({isOpen:true}),[]);assert.deepEqual(plain(h.values),draft);checks++
 assert.deepEqual(h.run({refineTarget:mode==='refine'?{slide_id:'slide-A',slide_index:1,title:'New label'}:null}),[]);checks++
}
for(const change of [{sessionId:'session-B'},{presentationId:'deck-B'},{currentSlide:3},{mode:'refine',refineTarget:{slide_id:'slide-B',slide_index:1}},{sessionId:null,presentationId:null}]){
 const h=harness();h.run();h.draft();h.run({isOpen:false});h.run(change);h.run({isOpen:true});assert.equal(h.values.prompt,'');assert.equal(h.values.keyMessage,'');assert.equal(h.values.error,null);assert.equal(h.values.needsInput,null);assert.deepEqual(plain(h.values.answers),{});checks++
}
for(const change of [{refineTarget:{slide_id:'slide-B',slide_index:1}},{refineTarget:{slide_id:'slide-A',slide_index:2}},{mode:'compose'}, {sessionId:'session-B'}, {presentationId:'deck-B'}]){
 const h=harness();h.run({mode:'refine',refineTarget:{slide_id:'slide-A',slide_index:1}});h.draft();h.run(change);assert.equal(h.values.prompt,'');checks++
}
for(const flag of [undefined,'','false','TRUE']){
 const a=harness(flag),b=harness(flag,true);a.ctx.process.env.NEXT_PUBLIC_STUDIO_V4_SHELL=flag;b.ctx.process.env.NEXT_PUBLIC_STUDIO_V4_SHELL=flag
 for(const change of [{},{isOpen:false},{isOpen:true},{currentSlide:3},{sessionId:'session-B',presentationId:'deck-B'},{mode:'refine',refineTarget:{slide_id:'slide-A',slide_index:0}},{refineTarget:{slide_id:'slide-B',slide_index:1}}]){
  assert.deepEqual(a.run(change),b.run(change));assert.deepEqual(plain(a.values),plain(b.values));a.draft();b.draft();checks++
 }
}
assert.equal(parts(normalizeClarificationSuccessor(source)).submit,old.submit);checks++
// Reverse only the 18 option callbacks accepted for this parity slice. The
// actual behavioral cases above continue to execute the unnormalized component.
function reverseSlideOptionDraftGuards(candidate) {
  const pairs = [
  [
    "  function handleLayoutChange(layout: LayoutChoice) {\n    retireStudioDraft()\n",
    "  function handleLayoutChange(layout: LayoutChoice) {\n"
  ],
  [
    "  function handleContentTypeChange(value: OptionalChoice<ContentType>) {\n    retireStudioDraft()\n",
    "  function handleContentTypeChange(value: OptionalChoice<ContentType>) {\n"
  ],
  [
    "  function handleShapeChange(value: OptionalChoice<ShapeSubtype>) {\n    retireStudioDraft()\n",
    "  function handleShapeChange(value: OptionalChoice<ShapeSubtype>) {\n"
  ],
  [
    "onChange={(value) => { retireStudioDraft(); setCanvasType(value) }}",
    "onChange={setCanvasType}"
  ],
  [
    "onChange={(value) => { retireStudioDraft(); setHeroStyle(value) }}",
    "onChange={setHeroStyle}"
  ],
  [
    "onChange={(value) => { retireStudioDraft(); setContactEmail(value) }}",
    "onChange={setContactEmail}"
  ],
  [
    "onChange={(value) => { retireStudioDraft(); setContactPhone(value) }}",
    "onChange={setContactPhone}"
  ],
  [
    "onChange={(value) => { retireStudioDraft(); setContactWebsite(value) }}",
    "onChange={setContactWebsite}"
  ],
  [
    "onChange={(value) => { retireStudioDraft(); setContactLinkedin(value) }}",
    "onChange={setContactLinkedin}"
  ],
  [
    "onChange={(value) => { retireStudioDraft(); setAttribution(value) }}",
    "onChange={setAttribution}"
  ],
  [
    "onChange={(event) => { retireStudioDraft(); setEyebrow(event.target.value) }}",
    "onChange={(event) => setEyebrow(event.target.value)}"
  ],
  [
    "onValueChange={(value) => { retireStudioDraft(); setHeroBackground(value) }}",
    "onValueChange={setHeroBackground}"
  ],
  [
    "onClick={() => { retireStudioDraft(); setUseWebSearch(prev => !prev) }}",
    "onClick={() => setUseWebSearch(prev => !prev)}"
  ],
  [
    "onClick={() => { retireStudioDraft(); setUseDeepResearch(prev => !prev) }}",
    "onClick={() => setUseDeepResearch(prev => !prev)}"
  ],
  [
    "onClick={() => { retireStudioDraft(); setUseUploadedDocuments(prev => !prev) }}",
    "onClick={() => setUseUploadedDocuments(prev => !prev)}"
  ],
  [
    "onClick={() => { retireStudioDraft(); setUseKnowledgeGraph(prev => !prev) }}",
    "onClick={() => setUseKnowledgeGraph(prev => !prev)}"
  ],
  [
    "onClick={() => { retireStudioDraft(); setWebSearchMaxQueries(prev => Math.max(1, prev - 1)) }}",
    "onClick={() => setWebSearchMaxQueries(prev => Math.max(1, prev - 1))}"
  ],
  [
    "onClick={() => { retireStudioDraft(); setWebSearchMaxQueries(prev => Math.min(10, prev + 1)) }}",
    "onClick={() => setWebSearchMaxQueries(prev => Math.min(10, prev + 1))}"
  ]
]
  for (const [addition, original] of pairs) {
    assert.equal(candidate.split(addition).length, 2, 'One exact accepted option-retirement addition')
    candidate = candidate.replace(addition, original)
  }
  return candidate
}
const restored=reverseSlideOptionDraftGuards(normalizeClarificationSuccessor(source)).replace("      if (process.env.NEXT_PUBLIC_STUDIO_V4_SHELL !== 'true') lastPanelContextKeyRef.current = null","      lastPanelContextKeyRef.current = null").replace("    const panelContextKey = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'\n      ? JSON.stringify([mode, sessionId, presentationId, isRefineMode ? refineTarget?.slide_id ?? 'index' : 'compose', isRefineMode ? refineTarget?.slide_index ?? currentSlide - 1 : currentSlide])\n      : isRefineMode","    const panelContextKey = isRefineMode").replace('    isRefineMode,\n    mode,\n    sessionId,\n    presentationId,','    isRefineMode,')
assert.equal(restored,before);checks++
console.log(`${checks} actual Slide inspector draft/context checks passed; submit callback and classic behavior preserved.`)
