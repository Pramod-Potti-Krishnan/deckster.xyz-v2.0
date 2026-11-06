// Actual restore handoff/callback under stale socket identity; no transport.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
const root=new URL('../',import.meta.url)
const read=file=>fs.readFileSync(new URL(file,root),'utf8')
const old=file=>execFileSync('git',['show','7f21998:'+file],{cwd:root,encoding:'utf8'})
const parse=source=>ts.createSourceFile('hook.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS)
const find=(source,name)=>{
  const ast=parse(source);let value
  const visit=node=>{if(ts.isVariableDeclaration(node)&&node.name.getText(ast)===name)value=node.initializer.getText(ast);ts.forEachChild(node,visit)}
  visit(ast);assert.ok(value,name);return value
}
const evaluate=(expression,bindings={})=>{
  const module={exports:{}}
  vm.runInNewContext(ts.transpileModule('export const value=('+expression+');',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,...bindings})
  return module.exports.value
}
const policyModule={exports:{}}
vm.runInNewContext(ts.transpileModule(read('lib/layout-viewer-url-policy.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:policyModule,exports:policyModule.exports,URL})
const policy={configuredOrigin:'https://layout.example.test',allowedOrigins:['https://layout.example.test']}
const restoreSource=read('hooks/use-deckster-websocket-v2.ts')
const callback=find(restoreSource,'restoreMessages'),previousCallback=find(old('hooks/use-deckster-websocket-v2.ts'),'restoreMessages')
function restore(expression,metadata){
  let state={messages:[],ephemeralFadeToken:0,untouched:'keep'}
  const setStateWithCache=update=>{state=update(state)}
  evaluate(expression,{useCallback:fn=>fn,setStateWithCache,sessionIdRef:{current:'previous-session'},
    sanitizeRestoredLayoutViewerUrls:policyModule.exports.sanitizeRestoredLayoutViewerUrls,LAYOUT_VIEWER_URL_POLICY:policy,
    debugLog:()=>{},console:{error:()=>{}},guardDirectorLayoutUrlMessage:m=>({message:m}),scrubBuildControlCapabilityMessages:m=>m})([],metadata)
  return JSON.parse(JSON.stringify(state))
}
const record={id:'selected-session',finalPresentationUrl:'https://layout.example.test/p/final',finalPresentationId:'final',blankPresentationUrl:'https://layout.example.test/p/custom',blankPresentationId:'custom',strawmanPreviewUrl:'https://layout.example.test/p/strawman',strawmanPresentationId:'strawman',slideCount:2,currentStage:6,stateCache:{activeVersion:'final',slideStructure:{slides:[{thumbnail_presentation_id:'final',thumbnail_url:'https://fixtures.invalid/first.png'}]}}}
const object=find(read('hooks/use-builder-session.ts'),'restoredSessionState')
const previousObject=find(old('hooks/use-builder-session.ts'),'restoredSessionState')
let checks=0
for(const flag of [undefined,'false','TRUE','true']){
  const metadata=evaluate(object,{session:record,process:{env:{NEXT_PUBLIC_STUDIO_V4_SHELL:flag}}})
  const previousMetadata=evaluate(previousObject,{session:record})
  if(flag==='true'){
    assert.equal(metadata.deckOwnerSessionId,record.id)
    const {deckOwnerSessionId,...rest}=metadata
    assert.equal(JSON.stringify(rest),JSON.stringify(previousMetadata))
  }else assert.equal(JSON.stringify(metadata),JSON.stringify(previousMetadata),'Classic loaded metadata remains exact')
  for(const activeVersion of ['blank','strawman','final']){
    const input={...metadata,activeVersion},before=restore(previousCallback,input),after=restore(callback,input)
    assert.equal(before.deckOwnerSessionId,'previous-session','Reproduces the actual pre-commit socket-ref timing bug')
    assert.equal(after.deckOwnerSessionId,flag==='true'?record.id:'previous-session')
    const {deckOwnerSessionId:beforeOwner,...oldFields}=before
    const {deckOwnerSessionId:afterOwner,...newFields}=after
    assert.deepEqual(newFields,oldFields,'All restored content/version/status/cache fields stay exact')
    checks++
  }
}
for(const explicitOwner of [undefined,null,'','another-session','selected-session']){
  const restored=restore(callback,{...record,deckOwnerSessionId:explicitOwner,activeVersion:'final'})
  assert.equal(restored.deckOwnerSessionId,explicitOwner===undefined?'previous-session':explicitOwner)
  checks++
}
for(const explicitOwner of [undefined,null,'selected-session']){
  for(const urls of [{},{presentationUrl:'https://foreign.invalid/p/final',finalPresentationUrl:'https://foreign.invalid/p/final'}]){
    assert.equal(restore(callback,{...urls,deckOwnerSessionId:explicitOwner}).deckOwnerSessionId,null,'Missing/blocked deck never acquires an owner')
    checks++
  }
}
const fixed=evaluate(object,{session:record,process:{env:{NEXT_PUBLIC_STUDIO_V4_SHELL:'true'}}})
assert.notEqual(restore(previousCallback,fixed).deckOwnerSessionId,record.id,'Reverting the callback demonstrably reintroduces the regression');checks++
// Exact protected hook sources outside this narrowly declared handoff.
const handoff=read('hooks/use-builder-session.ts').replace(/              \/\/ The loaded record owns this metadata even before React commits\n              \/\/ the selected session and the socket adopts its new identity\.\n              \.\.\.\(process\.env\.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'\n                \? \{ deckOwnerSessionId: session\.id \}\n                : \{\}\),\n/,'')
assert.equal(handoff,old('hooks/use-builder-session.ts'));checks++
const unchanged=restoreSource.replace('    /** Explicit owner of loaded metadata; independent of socket adoption. */\n    deckOwnerSessionId?: string | null;\n','').replace(') ? (sessionState.deckOwnerSessionId === undefined\n      ? sessionIdRef.current\n      : sessionState.deckOwnerSessionId) : null;',') ? sessionIdRef.current : null;')
assert.equal(unchanged,old('hooks/use-deckster-websocket-v2.ts'));checks++
console.log(`${checks} actual session-record/restore ownership cases pass, including old-regression reproduction and exact classic/other-hook preservation.`)
