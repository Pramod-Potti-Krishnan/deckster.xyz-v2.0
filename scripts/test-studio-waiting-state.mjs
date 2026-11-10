// Pure native supplied loading copy/scopes, standalone palette, literal gate and no lifecycle.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import postcss from 'postcss'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
const require=createRequire(import.meta.url),root=new URL('../',import.meta.url)
const source=fs.readFileSync(new URL('components/builder/studio-waiting-state.tsx',root),'utf8')
const compiled=ts.transpileModule(source,{reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}})
assert.deepEqual((compiled.diagnostics??[]).filter(item=>item.category===ts.DiagnosticCategory.Error),[])
function load(flag){const module={exports:{}};vm.runInNewContext(compiled.outputText,{module,exports:module.exports,process:{env:{NEXT_PUBLIC_STUDIO_V4_SHELL:flag}},require:id=>id.endsWith('.css')?{}:require(id)});return module.exports.StudioWaitingState}
let checks=0
for(const flag of [undefined,'false','TRUE','1',''])for(const scope of ['screen','canvas']){
 const Waiting=load(flag);assert.equal(Waiting({message:'Loading session...',scope}),null,'Only literal true can present the Studio leaf; classic caller branches stay native');checks++
}
const Waiting=load('true')
for(const message of ['Loading builder...','Loading session...','Redirecting to sign in...'])for(const scope of ['screen','canvas']){
 const tree=Waiting({message,scope}),inner=tree.props.children,children=React.Children.toArray(inner.props.children)
 assert.equal(tree.props['data-studio-v4-shell'],'true');assert.equal(tree.props['data-studio-waiting'],'true');assert.equal(tree.props['data-waiting-scope'],scope)
 assert.equal(tree.props.role,'status');assert.equal(tree.props['aria-live'],'polite');assert.equal(tree.props['aria-atomic'],'true')
 assert.equal(children[0].props['aria-hidden'],'true');assert.equal(children[1].props.children,message,'Existing native messages are exact, including punctuation')
 assert.ok(!/<button|<input|tabindex/.test(renderToStaticMarkup(tree)),'Waiting introduces no action or keyboard trap');checks++
}
assert.ok(renderToStaticMarkup(Waiting({})).includes('Loading builder...'));checks++
assert.ok(!/useState|useEffect|fetch\(|sendCommand|postMessage|setTimeout|setInterval|Date\.|localStorage|location|onClick/.test(source),'Leaf owns no auth/session/loading lifecycle, settlement, transport, persistence or timing');checks++
const css=fs.readFileSync(new URL('components/builder/studio-waiting-state.css',root),'utf8'),parsed=postcss.parse(css)
parsed.walkRules(rule=>{if(!rule.parent.name?.endsWith('keyframes'))assert.ok(rule.selector.includes('[data-studio-waiting="true"]'),'Every waiting layout/palette/motion selector has own literal marker')})
assert.ok(css.includes('min-height:100dvh')&&css.includes('flex:1 1 0%')&&css.includes('min-height:0'))
assert.ok(css.includes('prefers-reduced-motion:reduce')&&css.includes('animation:none'))
assert.ok(css.includes('.dark [data-studio-v4-shell="true"][data-studio-waiting="true"]'))
assert.ok(css.includes('overflow-wrap:anywhere')&&css.includes('max-width:420px'))
assert.ok(!css.includes('var(--ss-'),'Auth loading works independently before Builder shell mounts');checks++
const specimen=fs.readFileSync(new URL('scripts/studio-v4/ten-hour-waiting-fixture.tsx',root),'utf8')
const built=ts.transpileModule(specimen,{reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}})
assert.deepEqual((built.diagnostics??[]).filter(item=>item.category===ts.DiagnosticCategory.Error),[])
let selected='builder';const module={exports:{}}
const NativeWaiting=()=>null
vm.runInNewContext(built.outputText,{module,exports:module.exports,require:id=>id==='react'?{...React,useState:initial=>[selected,value=>{selected=value}]}:id==='@/components/builder/studio-waiting-state'?{StudioWaitingState:NativeWaiting}:require(id)})
const find=(tree,predicate,result=[])=>{if(!tree||typeof tree!=='object')return result;if(predicate(tree))result.push(tree);React.Children.forEach(tree.props?.children,child=>find(child,predicate,result));return result}
for(const [value,scope,message] of [['builder','screen','Loading builder...'],['session','canvas','Loading session...'],['account','screen','Loading builder...'],['redirect','screen','Redirecting to sign in...']]){
 const before=module.exports.default(),selector=find(before,node=>node.props['data-studio-waiting-specimen-selector']==='true')[0]
 selector.props.onChange({target:{value}})
 const tree=module.exports.default(),leaf=find(tree,node=>node.type===NativeWaiting)[0]
 assert.equal(leaf.props.scope,scope);assert.equal(leaf.props.message,message)
 assert.equal(find(tree,node=>node.type===NativeWaiting).length,1);checks++
}
const page=fs.readFileSync(new URL('app/builder/page.tsx',root),'utf8')
assert.ok(page.includes('if (accountChanged) return <BuilderLoadingState />'),'Account switch uses the real default copy; no invented Switching account message')
assert.ok(specimen.includes('min-height:0; height:100%')&&specimen.includes("height:'100dvh'"),'Only the supplied specimen bounds the full-screen scope below its synthetic header')
assert.ok(!/useEffect|fetch\(|postMessage|setTimeout|setInterval|localStorage|location|router|useAuth|useSession/.test(specimen),'Specimen never starts or settles auth/session/account loading')
checks++

// Execute the actual reducer and leaf together: CSS never settles a build or creates a slide.
const narrationSource=fs.readFileSync(new URL('lib/build-narration-heuristics.ts',root),'utf8')
const narrationModule={exports:{}}
vm.runInNewContext(ts.transpileModule(narrationSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:narrationModule,exports:narrationModule.exports})
const {initialNarrationState,narrationReducer}=narrationModule.exports
const nodes=(tree,key)=>find(tree,node=>node.props?.[key]==='true')
const render=props=>renderToStaticMarkup(Waiting(props))
const fixtures=[]
const take=(name,props)=>{const html=render(props);fixtures.push({name,props,html});return Waiting(props)}
for(const activity of ['thinking','planning','awaiting_user']){
 const tree=take(activity,{scope:'canvas',activity})
 assert.equal(tree.props['data-waiting-phase'],activity)
 assert.equal(tree.props['data-waiting-motion'],activity==='awaiting_user'?undefined:'true')
 assert.equal(nodes(tree,'data-studio-waiting-outline').length,0,'Before actual structure, no invented slides')
 assert.equal(nodes(tree,'data-studio-waiting-meter').length,0,'Before actual count, no invented progress')
 checks++
}
let state=initialNarrationState()
state=narrationReducer(state,{type:'typed_phase',payload:{build_id:'synthetic-build',phase:'planning',label:'Synthetic planning event'},ts:1000})
take('typed-planning',{scope:'canvas',narration:state})
state=narrationReducer(state,{type:'strawman',ghosts:[{index:0,title:'Synthetic opening',points:['Actual supplied outline point']},{index:1,title:'Synthetic evidence',points:[]},{index:2,title:'Synthetic decision',points:['A','B','C']}],ts:2000})
const outline=take('strawman',{scope:'canvas',narration:state})
assert.equal(nodes(outline,'data-studio-waiting-outline')[0].props.children.length,3)
assert.ok(render({scope:'canvas',narration:state}).includes('Actual supplied outline point'))
assert.equal(nodes(outline,'data-studio-waiting-meter').length,0)
const frozen=JSON.stringify(state)
assert.equal(render({scope:'canvas',narration:state}),render({scope:'canvas',narration:state}),'Repeated renders do not advance the animation state')
assert.equal(JSON.stringify(state),frozen,'Leaf never mutates supplied reducer state');checks++
state=narrationReducer(state,{type:'awaiting_user',ts:3000})
let tree=take('approval-gate',{scope:'canvas',narration:state,activity:'thinking'})
assert.equal(tree.props['data-waiting-motion'],undefined,'Real decision gate supersedes optimistic thinking activity');checks++
state=narrationReducer(state,{type:'typed_phase',payload:{build_id:'synthetic-build',phase:'building',label:'Synthetic build event',slide_count:3,auto_proceed:true},ts:4000})
state=narrationReducer(state,{type:'typed_event',payload:{build_id:'synthetic-build',seq:1,scope:'deck',stage:'render',status:'progress',text:'Synthetic native progress line'},ts:4500})
tree=take('building-zero',{scope:'canvas',narration:state})
assert.equal(nodes(tree,'data-studio-waiting-meter')[0].props.value,0)
assert.equal(nodes(tree,'data-studio-waiting-meter')[0].props.max,3)
assert.ok(render({scope:'canvas',narration:state}).includes('Synthetic native progress line'));checks++
state=narrationReducer(state,{type:'typed_slide_built',payload:{build_id:'synthetic-build',session_id:'synthetic-session',presentation_id:'synthetic-final',slide_index:0,slide_count:3},ts:5000})
tree=take('building-one',{scope:'canvas',narration:state})
assert.equal(nodes(tree,'data-studio-waiting-meter')[0].props.value,1)
assert.equal(nodes(tree,'data-studio-waiting-outline')[0].props.children[0].props['data-slide-state'],'built')
assert.ok(render({scope:'canvas',narration:state}).includes('1 of 3 slides built'));checks++
for(const phase of ['paused','stopped','error','qa','finalizing','complete']){
 const supplied={...state,phase,phaseLabel:`Synthetic ${phase} event`}
 tree=take(phase,{scope:'canvas',narration:supplied})
 assert.equal(tree.props['data-waiting-motion'],['qa','finalizing'].includes(phase)?'true':undefined)
 assert.equal(nodes(tree,'data-studio-waiting-meter')[0].props.value,1,'Changing phase cannot fabricate completed slide receipts')
 assert.ok(render({scope:'canvas',narration:supplied}).includes(`Synthetic ${phase} event`));checks++
}
for(const invalid of [{slideCount:0},{slideCount:-1},{slideCount:NaN},{slideCount:2.5},{slidesDone:-1},{slidesDone:4},{slidesDone:NaN}]){
 assert.equal(nodes(Waiting({scope:'canvas',narration:{...state,...invalid}}),'data-studio-waiting-meter').length,0,'Uncertain/out-of-range counts produce no fabricated meter');checks++
}
for(const props of [{scope:'screen',narration:state,activity:'thinking'},{scope:'canvas',narration:{...state,active:false}},{scope:'canvas',narration:initialNarrationState()}]){
 tree=Waiting(props);assert.equal(tree.props['data-waiting-progress'],undefined)
 assert.equal(nodes(tree,'data-studio-waiting-spinner').length,1,'Loading contract unchanged for screen/inactive narration');checks++
}
tree=Waiting({scope:'canvas',activity:'thinking',message:'Exact supplied status <safe>'})
assert.ok(renderToStaticMarkup(tree).includes('Exact supplied status &lt;safe&gt;'));checks++
tree=Waiting({scope:'canvas',narration:{...state,ghosts:Array.from({length:8},(_,index)=>({index,title:`Synthetic ${index}`,points:[]})),deckEvents:Array.from({length:7},(_,index)=>({id:`event-${index}`,text:`Synthetic line ${index}`,status:'progress'}))}})
assert.equal(nodes(tree,'data-studio-waiting-outline')[0].props.children.length,4)
assert.equal(nodes(tree,'data-studio-waiting-events')[0].props.children.length,2);checks++
for(const item of fixtures){assert.ok(!/<button|<input|tabindex|iframe/.test(item.html),'Leaf introduces no transport, acceptance control, frame or keyboard trap');checks++}
assert.ok(css.includes('[data-waiting-motion="true"]')&&css.includes('[data-waiting-progress="true"]'))
assert.ok(css.includes('overflow:auto')&&css.includes('align-items:safe center'),'Small canvas preserves scrollable real content')
assert.ok(css.includes('studio-waiting-sheet="front"]')&&css.includes('studio-waiting-dot="true"] { animation:none'),'Reduced motion stops all decorative loops');checks++

if(process.argv.includes('--write-evidence')){
 const evidence=new URL('docs/studio-v4/canvas-lifecycle-20261004/evidence/',root)
 fs.mkdirSync(evidence,{recursive:true})
 const beforeSource=execFileSync('git',['show','HEAD:components/builder/studio-waiting-state.tsx'],{cwd:root,encoding:'utf8'})
 const beforeCss=execFileSync('git',['show','HEAD:components/builder/studio-waiting-state.css'],{cwd:root,encoding:'utf8'})
 const beforeModule={exports:{}}
 vm.runInNewContext(ts.transpileModule(beforeSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module:beforeModule,exports:beforeModule.exports,process:{env:{NEXT_PUBLIC_STUDIO_V4_SHELL:'true'}},require:id=>id.endsWith('.css')?{}:require(id)})
 const page=(label,sheet,items)=>`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${label}</title><style>body{margin:0;font:14px system-ui;background:#eaf0ec;color:#425b4f}header{padding:20px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:20px;padding:20px}section{min-width:0;display:flex;flex-direction:column;height:570px}h2{font-size:13px}section>div{flex:1;min-height:0}${sheet}</style><header><h1>${label}</h1><p>Offline actual component with synthetic reducer events. Decorative animation is not native Layout rendering, service activity or connected acceptance. Controls, iframe and native ribbon/footer are outside this leaf.</p></header><main>${items.map(item=>`<section><h2>${item.name}</h2>${item.html}</section>`).join('')}</main></html>`
 fs.writeFileSync(new URL('animation-before.html',evidence),page('Before · waiting leaf only',beforeCss,fixtures.map(item=>({...item,html:renderToStaticMarkup(beforeModule.exports.StudioWaitingState(item.props))}))))
 fs.writeFileSync(new URL('animation-after.html',evidence),page('After · real supplied progress states',css,fixtures))
 const sha=s=>createHash('sha256').update(s).digest('hex')
 fs.writeFileSync(new URL('animation-component-receipt.json',evidence),JSON.stringify({level:'Offline actual component + actual narration reducer; synthetic events; no service/browser proof',checks,source_sha256:sha(source),css_sha256:sha(css),reducer_sha256:sha(narrationSource),before_source_sha256:sha(beforeSource),before_css_sha256:sha(beforeCss),before_ref:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),fixtures:fixtures.map(({name,html})=>({name,html}))},null,2)+'\n')
}
console.log(`Studio waiting state: ${checks} actual-component/reducer/loading/gates/counts/motion/safety checks passed`)
