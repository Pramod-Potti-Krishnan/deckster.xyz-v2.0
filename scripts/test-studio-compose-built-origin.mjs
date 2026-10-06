import assert from 'node:assert/strict'
import ts from 'typescript'
import { normalizeBuiltSelectionSuccessor } from '../docs/studio-v4/twenty-four-hour-parity-20261005/builder1/selection-lane-successor/normalize-lane.mjs'
import { execFileSync } from 'node:child_process'
import { parse, current, declaration, print, evaluate, find, harness } from './test-studio-compose-ownership.mjs'
import { panelHarness } from './test-studio-slide-panel-ownership.mjs'
const prior=parse(execFileSync('git',['show','ee0c946:app/builder/page.tsx'],{encoding:'utf8'}))
const result={status:'built',presentation_id:'presentation-A',presentation_url:'https://fixture.invalid/A',slide_index:1,slides_built:4}
const nativeIdentityAdmission=Boolean(find(current,n=>ts.isVariableDeclaration(n)&&n.name.getText(current)==='studioSyncRequestRef'))
const renderOrigin=find(current,n=>ts.isVariableDeclaration(n)&&n.name.getText(current)==='isCurrentSlideBuiltOwner')
assert.ok(renderOrigin)
let checks=0
function builtHarness({source=current,studioShell=true,bootstrap=false}={}){
 const h=harness({source,studioShell}),c=h.context
 Object.assign(c,{URL,URLSearchParams,effectivePresentationId:bootstrap?null:'presentation-A',presentationId:bootstrap?null:'presentation-A',effectiveSlideCount:3,activeVersion:'final',presentationUrl:'https://fixture.invalid/A',slideComposerOverride:null})
 c.persistence={updateMetadata:value=>h.events.push(['persist',c.currentSessionIdRef.current,value])}
 if(bootstrap){c.studioSlideComposeOwnerRef.current.presentationId=null;c.slideComposerPresentationRef.current.presentationId=null}
 // Initialize new private receipt refs from their actual source declarations.
 if(source===current){
  const visit=n=>{if(ts.isVariableDeclaration(n)&&/^studioSync/.test(n.name.getText(current))&&ts.isCallExpression(n.initializer)&&n.initializer.expression.getText(current)==='useRef'){evaluate(`globalThis.${n.name.getText(current)}={current:${print(n.initializer.arguments[0],current)}}`,c)}ts.forEachChild(n,visit)};visit(current)
  const refresh=find(current,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='withSlideComposerRefreshToken');if(refresh)evaluate(print(refresh,current),c)
 }
 const make=()=>{
  if(source===current){c.studioComposeMountGeneration=c.questionSubmissionScopeRef.current.generation;c.useMemo=fn=>fn();evaluate(`globalThis.isCurrentSlideBuiltOwner = ${print(renderOrigin.initializer,current)}`,c)}
  evaluate(`globalThis.onBuilt = ${print(declaration(source,'handleSlideComposerBuilt').arguments[0],source)}`,c)
  // Keep lexical guard per actual useCallback render, never substitute B's guard.
  if(source===current){const guard=c.isCurrentSlideBuiltOwner;const body=print(declaration(source,'handleSlideComposerBuilt').arguments[0],source);evaluate(`globalThis.onBuilt = ((isCurrentSlideBuiltOwner)=>${body})(globalThis.guard)`,Object.assign(c,{guard}))}
  return c.onBuilt
 }
 const onBuilt=make();return{...h,onBuilt,make}
}
// Original native parent reproduces adoption after session navigation.
{
 const h=builtHarness({source:prior});h.retire('session');h.events.length=0;h.onBuilt(result);assert.ok(h.events.some(e=>e[0]==='override'&&e[1]==='session-B'));checks++
}
for(const retirement of['session','version','roundtrip','account','unmount','strict-remount']){
 const h=builtHarness();h.retire(retirement);h.events.length=0;h.onBuilt(result);assert.deepEqual(h.events,[],retirement+' cannot adopt the original result');checks++
}
for(const studioShell of[true,false])for(const bootstrap of[true,false]){
 const h=builtHarness({studioShell,bootstrap});h.onBuilt(result);const override=h.events.find(e=>e[0]==='override')[2];assert.equal(override.presentationId,'presentation-A');assert.equal(override.slideCount,nativeIdentityAdmission&&studioShell&&!bootstrap?3:4);if(nativeIdentityAdmission&&studioShell&&!bootstrap)assert.equal(h.events.some(e=>e[0]==='selection'),false,'No positional selection claim before native identity verification');else assert.equal(h.events.find(e=>e[0]==='selection')[2],1);assert.equal(h.events.find(e=>e[0]==='persist')[2].finalPresentationId,'presentation-A');assert.equal(h.events.find(e=>e[0]==='toast')[2].title,'Slide built');checks++
}
// Fresh callback after return accepts normal success while the older one stays retired.
{
 const h=builtHarness();h.retire('roundtrip');const fresh=h.make();h.events.length=0;h.onBuilt(result);assert.equal(h.events.length,0);fresh(result);assert.ok(h.events.some(e=>e[0]==='override'));checks++
}
// Execute native layout cleanup/setup and its scheduled state update, including
// first Strict Mode replay before the first real user submission.
{
 const h=builtHarness(),c=h.context,updates=[]
 c.setStudioComposeMountGeneration=value=>updates.push(value)
 const mount=find(current,n=>ts.isCallExpression(n)&&n.expression.getText(current)==='React.useLayoutEffect'&&n.arguments[0]?.getText(current).includes('questionSubmissionScopeRef.current.active = true'))
 evaluate(`globalThis.mountNative = ${print(mount.arguments[0],current)}`,c)
 let cleanup=c.mountNative();cleanup();cleanup=c.mountNative();assert.deepEqual(updates,[0,1]);const fresh=h.make();h.events.length=0;h.onBuilt(result);assert.equal(h.events.length,0);fresh(result);assert.ok(h.events.some(e=>e[0]==='persist'));cleanup();h.events.length=0;fresh(result);assert.equal(h.events.length,0);checks++
}
// Actual native panel still reports its original synchronous result; actual
// frozen parent prevents its adoption after all represented retirement paths.
for(const retirement of['session','version','roundtrip','account','unmount']){
 const h=builtHarness();let release;const pending=new Promise(r=>release=r)
 const panel=panelHarness({async:false,onRequest:()=>pending,onBuilt:value=>h.onBuilt(value)})
 panel.prompt('Original A');const task=panel.generate();h.retire(retirement);panel.render({sessionId:retirement==='session'?'session-B':'session-A',presentationId:'presentation-B'});panel.prompt('New panel draft');h.events.length=0
 release({ok:true,json:async()=>result});await task;assert.equal(panel.events.filter(e=>e[0]==='built').length,1);assert.equal(panel.state.prompt,'New panel draft');assert.deepEqual(h.events,[]);checks++
}
// Classic callback body reverses to the exact native parent, including metadata.
{
 const patched=normalizeBuiltSelectionSuccessor(print(declaration(current,'handleSlideComposerBuilt').arguments[0],current)).replace(/\s*if \(studioShell && !isCurrentSlideBuiltOwner\(\)\)\s*return;/,'')
 const original=print(declaration(prior,'handleSlideComposerBuilt').arguments[0],prior)
 assert.equal(patched.replace(/\s+/g,''),original.replace(/\s+/g,''));checks++
}
console.log(`PASS ${checks} actual synchronous parent origin, panel-delivery, Strict Mode entry and native classic checks; supplied responses only.`)
