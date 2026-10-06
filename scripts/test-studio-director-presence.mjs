import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {execFileSync} from 'node:child_process'
import ts from 'typescript'
const source=fs.readFileSync('components/build-narration/director-presence.tsx','utf8')
const before=execFileSync('git',['show','4d9362e:components/build-narration/director-presence.tsx'],{encoding:'utf8'})
const normalized=s=>ts.createPrinter().printFile(ts.createSourceFile('presence.tsx',s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX))
const studioSettledMotion = "\n          || (studioShell && narration.active && ['awaiting_user', 'error', 'complete'].includes(narration.phase))"
assert.equal(source.split(studioSettledMotion).length,2,'one exact separately tested Studio-only motion clause')
const stripped=source.replace(studioSettledMotion,'').replace('  loadingSession?: boolean\n','').replace(', loadingSession = false','').replace(/\s+hidden=\{studioShell && loadingSession \? true : undefined\}/,'').replace("import './studio-director-presence.css'",'').replace(/  const studioShell = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'\n/,'').replace(/\s+(?:data-studio-[\w-]+|tabIndex|role|aria-label|aria-expanded)=\{studioShell \?[^}]+\}/g,'')
assert.equal(normalized(stripped),normalized(before),'all native visibility/status/log/motion/callback code is exact after removing gated UI additions')
const compiled=ts.transpileModule(source,{reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}})
assert.equal((compiled.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0)
const jsx=(type,props,key)=>({type,props,key});const nodes=v=>Array.isArray(v)?v.flatMap(nodes):v&&typeof v==='object'?[v,...nodes(v.props?.children)]:[]
for(const flag of ['true','false','TRUE','1',''])for(const active of [false,true])for(const status of [null,{status:'thinking',text:'Exact current status'},{status:'complete',text:'Inactive current status'}])for(const logOpen of [false,true])for(const loadingSession of [false,true]){
 let toggle
 const imports={react:{useState:()=>[logOpen,value=>{toggle=value}]},'react/jsx-runtime':{jsx,jsxs:jsx},'framer-motion':{useReducedMotion:()=>false,motion:{span:'motion-span'}},'lucide-react':{ChevronDown:'ChevronDown',ChevronUp:'ChevronUp'},'./motion':{PRESENCE_SHUFFLE_S:2},'./studio-director-presence.css':{}}
 const mod={exports:{}};vm.runInNewContext(compiled.outputText,{module:mod,exports:mod.exports,process:{env:{NEXT_PUBLIC_STUDIO_V4_SHELL:flag}},require:name=>{assert.ok(name in imports,name);return imports[name]}})
 const narration={active,phase:'paused',phaseLabel:'Exact phase label',deckEvents:Array.from({length:31},(_,i)=>({id:String(i),text:'Returned event '+i}))}
 const tree=mod.exports.DirectorPresence({narration,currentStatus:status,loadingSession});const shown=active||status?.status==='thinking';assert.equal(!!tree,!!shown)
 if(!shown)continue
 assert.equal(tree.props['data-studio-director-presence'],flag==='true'?'true':undefined)
 assert.equal(tree.props.hidden,flag==='true'&&loadingSession?true:undefined,'only Studio session loading hides existing mounted presence; native state/children remain')
 const toggleButton=nodes(tree).find(x=>x.type==='button');toggleButton.props.onClick();assert.equal(toggle(logOpen),!logOpen)
 assert.equal(toggleButton.props['aria-expanded'],flag==='true'?logOpen:undefined)
 const list=nodes(tree).find(x=>x.type==='ul');assert.equal(!!list,logOpen)
 if(list){const items=nodes(list).filter(x=>x.type==='li');assert.equal(items.length,30);assert.equal(items[0].props.children,'Returned event 1');assert.equal(items.at(-1).props.children,'Returned event 30')}
}
console.log('Director presence visibility, exact native thirty-event ordering, toggle, literal flags and entire source parity pass; no motion/service/transport ran')
