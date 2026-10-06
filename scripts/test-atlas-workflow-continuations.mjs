import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { readAtlasBaseline } from './atlas-witness-baseline.mjs'
import ts from 'typescript'

// Real shared button callbacks and real href/key helpers, private storage/router
// witnesses only. No browser, account, network or service acknowledgement.
const file='components/studio-libraries/studio-workflow-action.tsx'
const source=fs.readFileSync(file,'utf8'),baseline=readAtlasBaseline(`3f6e8ce:${file}`)
const compile=code=>ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText
const jsx=(type,props)=>({type,props}),flat=value=>Array.isArray(value)?value.flatMap(flat):!value||typeof value!=='object'?[]:[value,...flat(value.props?.children)]
function load(file){const mod={exports:{}};vm.runInNewContext(compile(fs.readFileSync(file,'utf8')),{module:mod,exports:mod.exports,URLSearchParams,require:id=>assert.fail(id)});return mod.exports}
const workflow=load('lib/studio-workflow.ts'),last=load('lib/last-builder-session.ts')
function harness(code=source){
 const slots=[],events=[];let cursor=0,tree,props,writes=0
 const api={user:{id:'account-A'},get:()=> 'session/A',set:()=>{}}
 const react={useRef(initial){return slots[cursor++]??={current:initial}},useState(initial){const i=cursor++;slots[i]??={value:initial};return[slots[i].value,value=>{writes++;slots[i].value=value}]}}
 const imports={react,'react/jsx-runtime':{jsx,jsxs:jsx},'next/navigation':{useRouter:()=>({push:url=>events.push(['push',url])})},'@/hooks/use-auth':{useAuth:()=>({user:api.user})},'@/lib/last-builder-session':last,'@/lib/studio-workflow':workflow}
 const mod={exports:{}},context={module:mod,exports:mod.exports,Date:{now:()=>12345},window:{localStorage:{getItem:key=>{events.push(['read',key]);return api.get()}},sessionStorage:{setItem:(key,value)=>{api.set();events.push(['stage',key,JSON.parse(value)])}}},require:id=>{assert.ok(id in imports,id);return imports[id]}}
 vm.runInNewContext(compile(code),context)
 const h={api,events,render(next=props){props=next;cursor=0;tree=mod.exports.StudioWorkflowAction(props);return h},get click(){return flat(tree).find(n=>n.type==='button').props.onClick},get writes(){return writes},get tree(){return tree}}
 return h.render({action:'templates',itemId:'template/A',children:'Continue'})
}
let cases=0
for(const action of['templates','theme','master','brief'])for(const disabled of[false,true]){
 const a=harness(),b=harness(baseline),props={action,itemId:'item/A',brief:' Retained brief ',children:'Continue',disabled};a.render(props);b.render(props);a.click();b.click()
 assert.deepEqual(a.events,b.events);assert.equal(a.writes,b.writes);cases++
}
for(const brief of['',' '.repeat(3),'x'.repeat(20001),'Normal draft']){
 const a=harness(),b=harness(baseline),props={action:'brief',brief,children:'Continue'};a.render(props);b.render(props)
 a.api.set=b.api.set=()=>{throw Error('Local storage refusal')};a.click();b.click();assert.deepEqual(a.events,b.events);assert.equal(a.writes,b.writes);cases++
}
for(const action of['templates','brief']){
 const h=harness(),identity={owner:'A',ready:true},props={action,brief:'Draft',children:'Continue',canStart:()=>identity.owner==='A'&&identity.ready};h.render(props);const held=h.click
 identity.ready=false;held();assert.equal(h.events.length,0);assert.equal(h.writes,0)
 identity.ready=true;held();assert.equal(h.events.filter(e=>e[0]==='push').length,1);cases++
}
for(const owner of['B',null]){
 const h=harness(),identity={owner:'A'},props={action:'brief',brief:'Draft',children:'Continue',canStart:()=>identity.owner==='A'};h.render(props);const held=h.click
 identity.owner=owner;h.render({...props,canStart:()=>true});held();assert.equal(h.events.length,0);assert.equal(h.writes,0,'Captured owner is checked even after latest guard changes');cases++
}
for(const sideEffect of['read','stage','stage-refusal']){
 const h=harness(),identity={current:true};h.render({action:'brief',brief:'Draft',children:'Continue',canStart:()=>identity.current})
 if(sideEffect==='read')h.api.get=()=>{identity.current=false;return 'session/A'}
 else h.api.set=()=>{identity.current=false;if(sideEffect==='stage-refusal')throw Error('Retired refusal')}
 h.click();assert.equal(h.events.filter(e=>e[0]==='push').length,0);assert.equal(h.writes,0,'Retired storage callback cannot show an old error or navigate');cases++
}
{
 const h=harness();h.render({action:'templates',children:'Continue',canStart:()=>false});const held=h.click
 h.render({action:'templates',children:'Continue',canStart:()=>true});held();assert.equal(h.events.length,0);cases++
}
{
 const h=harness();h.render({action:'templates',children:'Continue',disabled:true,canStart:()=>true});const held=h.click
 h.render({action:'templates',children:'Continue',disabled:false,canStart:()=>true});held();assert.equal(h.events.length,0,'Captured disabled/template-readiness gate is not waived');h.click();assert.equal(h.events.filter(e=>e[0]==='push').length,1);cases++
}
console.log(`PASS ${cases} actual workflow continuation cases; omitted-option native parity, live captured/latest owner gates, preserved disabled gates, private storage/navigation only`)
