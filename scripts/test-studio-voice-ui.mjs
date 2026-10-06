import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import ts from 'typescript'
import {verifyVoiceRenderSource} from './studio-v4/voice-render-source-proof.mjs'
import React from 'react'
import * as jsx from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'

const require=createRequire(import.meta.url),root=path.resolve(new URL('..',import.meta.url).pathname)
const packet=path.join(root,'docs/studio-v4/twenty-four-hour-parity-20261005/builder1/voice-ui-review')
const header='components/builder/chat/studio-director-header.tsx'
const before=path.join(root,'docs/studio-v4/twenty-four-hour-parity-20261005/builder1/voice-shared-review/source',header)
const sha=v=>crypto.createHash('sha256').update(v).digest('hex'),read=f=>fs.readFileSync(path.join(root,f),'utf8')
const sourceHashes=new Map(),refuse=()=>{throw Error('Header fixture refuses transport, media and scheduling')}
const checks=[]
function check(name,fn){checks.push({name,pass:true,...fn()});console.log('PASS '+name)}
function load(source,file,env={},deps={},globals={}){sourceHashes.set(file,sha(source));const mod={exports:{}};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{module:mod,exports:mod.exports,process:{env},require:name=>{if(name.endsWith('.css'))return{};if(name in deps)return deps[name];if(name==='react')return React;if(name==='react/jsx-runtime')return jsx;if(name==='lucide-react')return require('lucide-react');throw Error('Unexpected header fixture dependency '+name)},fetch:refuse,WebSocket:refuse,window:new Proxy({},{get:refuse}),document:new Proxy({},{get:refuse}),setTimeout:refuse,setInterval:refuse,requestAnimationFrame:refuse,...globals});return mod.exports}
const currentHeader=env=>load(read(header),header,env).StudioDirectorHeader
const oldHeader=env=>load(fs.readFileSync(before,'utf8'),'frozen-predecessor/'+header,env).StudioDirectorHeader
function actualEntry(){const helpers=load(read('lib/studio-voice-interactive.ts'),'lib/studio-voice-interactive.ts');return load(read('components/builder/voice-interactive/director-call.tsx'),'components/builder/voice-interactive/director-call.tsx',{}, {'@/lib/studio-voice-interactive':helpers,'./director-character':{DirectorCharacter:()=>{throw Error('Header entry must not mount a character')}}}).DirectorCallEntry}

check('six accepted leaves unchanged and exact one-line question-scroll successor with reusable 55/53 evidence',()=>{
  const verified=verifyVoiceRenderSource(root)
  const reused=['incoming55','candidate-preservation53','candidate-correction53'].map(name=>{const file='docs/studio-v4/twenty-four-hour-parity-20261005/builder1/voice-correction/checks/'+name+'.log',source=read(file);assert.ok(source.includes(name==='incoming55'?'55 checks passed':name==='candidate-preservation53'?'53 applicable candidate checks passed':'53 actual-source candidate correction scenarios passed'));return{file,sha256:sha(source),rerun:false}})
  return {...verified,reused}
})
check('actual header OFF output is byte-identical to predecessor for status/loading and absent actions',()=>{
  const settings=[{}, {NEXT_PUBLIC_STUDIO_V4_SHELL:'true'}, {NEXT_PUBLIC_STUDIO_V4_SHELL:'false'}, {NEXT_PUBLIC_STUDIO_V4_SHELL:'TRUE'}, {NEXT_PUBLIC_STUDIO_V4_SHELL:'true',NEXT_PUBLIC_STUDIO_V4_VOICE_INTERACTIVE:'false'}, {NEXT_PUBLIC_STUDIO_V4_SHELL:'true',NEXT_PUBLIC_STUDIO_V4_VOICE_INTERACTIVE:'TRUE'}];let comparisons=0;for(const env of settings){const current=currentHeader(env),prior=oldHeader(env);for(const connectionState of ['connected','connecting','disconnected','error'])for(const isLoadingSession of [false,true])for(const actions of [undefined,null,false,[]]){const props={connectionState,isLoadingSession,actions};assert.equal(renderToStaticMarkup(jsx.jsx(current,props)),renderToStaticMarkup(jsx.jsx(prior,props)));comparisons++}}return{comparisons,exactServerMarkup:true,noSchedulingMediaOrTransport:true}
})
check('actual header shell-OFF never renders even a supplied action child',()=>{
  const unexpected=()=>{throw Error('Shell OFF must not mount action')};for(const flag of [undefined,'false','TRUE','1'])assert.equal(renderToStaticMarkup(jsx.jsx(currentHeader({NEXT_PUBLIC_STUDIO_V4_SHELL:flag}),{connectionState:'error',actions:jsx.jsx(unexpected,{})})), '');return{shellOffCases:4,noActionMount:true}
})
check('actual additive entry preserves header identity/connection and original voice/interactive callbacks',()=>{
  const Entry=actualEntry(),Header=currentHeader({NEXT_PUBLIC_STUDIO_V4_SHELL:'true'}),starts=[],call={mode:'chat',elapsedSeconds:0,start:mode=>starts.push(mode)};const entry=Entry({call,disabled:false});const buttons=entry.props.children;assert.equal(buttons.length,2);buttons[0].props.onClick();buttons[1].props.onClick();assert.deepEqual(starts,['voice','interactive']);const html=renderToStaticMarkup(jsx.jsx(Header,{connectionState:'connected',actions:jsx.jsx(Entry,{call,disabled:true})}));assert.ok(html.includes('aria-label="Director conversation"'));assert.ok(html.includes('aria-label="Director connection"'));assert.ok(html.includes('data-connection-state="connected"'));assert.ok(html.includes('Start voice call with the Director'));assert.ok(html.includes('Open interactive Director'));assert.equal((html.match(/<header/g)||[]).length,1);assert.equal((html.match(/disabled=""/g)||[]).length,2);return{actualAcceptedEntry:true,identityStatusRetained:true,nativeCallbacksPreserved:true,noCharacterOrPanelMount:true}
})
check('actual in-call timer pill remains additive and loading status still authoritative',()=>{
  const Entry=actualEntry(),Header=currentHeader({NEXT_PUBLIC_STUDIO_V4_SHELL:'true'});for(const mode of ['voice','interactive']){const html=renderToStaticMarkup(jsx.jsx(Header,{connectionState:'connected',isLoadingSession:true,actions:jsx.jsx(Entry,{call:{mode,elapsedSeconds:62}})}));assert.ok(html.includes('Loading conversation…'));assert.ok(html.includes('data-connection-state="loading"'));assert.ok(html.includes('1:02'));assert.ok(html.includes('data-director-call-pill="true"'));assert.ok(!html.includes('data-director-call-entry="true"'))}return{modes:2,timerAndLoadingPreserved:true}
})

check('actual old/new focus function brings enabled control into oversized viewport and preserves ownership gates',()=>{
  const file='components/builder/voice-interactive/director-call.tsx',oldSource=fs.readFileSync(path.join(root,'docs/studio-v4/twenty-four-hour-parity-20261005/builder1/voice-shared-review/source',file),'utf8'),newSource=read(file)
  const helpers=load(read('lib/studio-voice-interactive.ts'),'lib/studio-voice-interactive.ts')
  const deps={'@/lib/studio-voice-interactive':helpers,'./director-character':{DirectorCharacter:refuse}}
  const run=(source,reduced=false,deny=false,loseAfterScroll=false,duplicate=false)=>{
    const viewportHeight=47,cardHeight=240,controlOffset=175,controlHeight=30
    let scrollTop=0,focused=false,valid=!deny;const events=[]
    const scroll=(target,offset,height,options)=>{
      events.push({target,options:null});const top=offset-scrollTop,bottom=top+height
      // Explicit DOM geometry adapter for nearest alignment. A tall card already
      // covering both viewport edges does not move; its descendant may be clipped.
      if(options.block==='center')scrollTop=offset+height/2-viewportHeight/2
      else if(!(top<0&&bottom>viewportHeight)&&!(top===0&&height>viewportHeight)){
        if(top<0)scrollTop=offset;else if(bottom>viewportHeight)scrollTop=offset+height-viewportHeight
      }
      scrollTop=Math.max(0,Math.min(scrollTop,cardHeight-viewportHeight))
      if(loseAfterScroll)valid=false
    }
    const control={isConnected:true,scrollIntoView(options){scroll('control',controlOffset,controlHeight,options);events.at(-1).options=options},focus(options){assert.equal(options.preventScroll,true);focused=true;events.push({focus:true})}}
    const card={isConnected:true,getAttribute:name=>name==='data-director-action-id'?'synthetic-question':'current',hasAttribute:()=>false,closest:()=>null,querySelector:()=>control,scrollIntoView(options){scroll('card',0,cardHeight,options);events.at(-1).options=options}}
    const root={querySelectorAll:()=>duplicate?[card,card]:[card]}
    const fn=load(source,source===oldSource?'frozen-predecessor/'+file:file,{},deps,{window:{matchMedia:()=>({matches:reduced})}}).focusDirectorQuestion
    const result=fn('synthetic-question',()=>valid,()=>root)
    return {result,focused,scrollTop,controlTop:controlOffset-scrollTop,controlBottom:controlOffset+controlHeight-scrollTop,inViewport:controlOffset-scrollTop>=0&&controlOffset+controlHeight-scrollTop<=viewportHeight,events}
  }
  const scenarios=[]
  for(const reduced of [false,true]){
    const before=run(oldSource,reduced),after=run(newSource,reduced)
    assert.equal(before.focused,true);assert.equal(before.inViewport,false);assert.equal(before.events[0].target,'card')
    assert.equal(after.result,true);assert.equal(after.focused,true);assert.equal(after.inViewport,true);assert.equal(after.events[0].target,'control');assert.equal(after.events[0].options.behavior,reduced?'auto':'smooth');assert.equal(after.events[0].options.block,'center');for(const rounding of [-0.5,0,0.5]){assert.ok(after.controlTop+rounding-3>=0,'3px focus ring survives rounding at top');assert.ok(after.controlBottom+rounding+3<=47,'3px focus ring survives rounding at bottom')}
    scenarios.push({reduced,before,after})
  }
  for(const flags of [[true,false,false],[false,true,false],[false,false,true]]){const result=run(newSource,false,...flags);assert.equal(result.result,false);assert.equal(result.focused,false);if(!flags[1])assert.equal(result.events.length,0);scenarios.push({deniedBefore:flags[0],lostAfterScroll:flags[1],duplicateCard:flags[2],result})}
  return {scenarios,focusRingPx:3,roundingOffsetsPx:[-0.5,0,0.5],scope:'Actual source function + explicit nearest/center scroll geometry adapter; root real-Radix before/after screenshots provide separate rendered evidence',rootBeforeReceipt:'docs/studio-v4/twenty-four-hour-parity-20261005/builder1/voice-shared-review/browser/question-focus-before-correction.json'}
})

fs.mkdirSync(path.join(packet,'evidence'),{recursive:true})
for(const [file,hash]of sourceHashes)if(!file.startsWith('frozen-predecessor/'))assert.equal(sha(read(file)),hash,'Source changed before freezing '+file)
fs.writeFileSync(path.join(packet,'evidence/header-checks.json'),JSON.stringify({scope:'Actual header ReactDOMServer markup and accepted entry callback source; no browser or integrated page ownership proof',checks,sourceHashes:[...sourceHashes].map(([file,sha256])=>({file,sha256})),testScriptSha256:sha(fs.readFileSync(new URL(import.meta.url)))},null,2)+'\n')
console.log(`Completed ${checks.length} header/leaf preservation groups; no media/runtime requests`)
