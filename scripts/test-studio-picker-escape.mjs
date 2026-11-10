import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import {execFileSync} from 'node:child_process'
const file='components/generation-panel/index.tsx'
const source=fs.readFileSync(file,'utf8'),previous=execFileSync('git',['show','37c53c0:'+file],{encoding:'utf8'})
function callback(text){
 const ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let effect
 const visit=node=>{if(ts.isCallExpression(node)&&node.expression.getText(ast)==='useEffect'&&node.arguments[0]?.getText(ast).includes("window.addEventListener('keydown', handleKeyDown)"))effect=node.arguments[0];ts.forEachChild(node,visit)};visit(ast);assert.ok(effect)
 return ts.transpileModule('('+effect.getText(ast)+')()',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
}
const current=callback(source),old=callback(previous)
function run(options={}){
 const {studio,prior=false,key='Escape',consumed=false,generating=false,open=true,hidden=false,input=true,ctrl=false,meta=false}=options
 const flag=Object.hasOwn(options,'studio')?studio:'true'
 let listener,removed,closed=0,generated=0,prevented=0
 const ctx={process:{env:{NEXT_PUBLIC_STUDIO_V4_SHELL:flag}},isOpen:open,isGenerating:generating,showGenerationInput:input,onClose:()=>closed++,handleFooterGenerate:()=>generated++,panelRootRef:{current:{closest:()=>hidden}},window:{addEventListener:(type,fn)=>{assert.equal(type,'keydown');listener=fn},removeEventListener:(type,fn)=>{assert.equal(type,'keydown');removed=fn}}}
 const cleanup=vm.runInNewContext(prior?old:current,ctx)
 const event={key,defaultPrevented:consumed,ctrlKey:ctrl,metaKey:meta,preventDefault(){this.defaultPrevented=true;prevented++}}
 listener?.(event);cleanup?.();assert.equal(removed,listener)
 return {closed,generated,prevented,registered:Boolean(listener)}
}
let checks=0
assert.deepEqual(run({consumed:true}),{closed:0,generated:0,prevented:0,registered:true});checks++
assert.equal(run({consumed:false}).closed,1);checks++
assert.equal(run({open:false}).registered,false);checks++
assert.equal(run({generating:true}).closed,0);checks++
assert.equal(run({hidden:true}).closed,0);checks++
for(const studio of [undefined,'','false','TRUE'])for(const consumed of [false,true])for(const generating of [false,true]){
 assert.deepEqual(run({studio,consumed,generating}),run({studio,consumed,generating,prior:true}));checks++
}
for(const cfg of [{key:'Enter',ctrl:true},{key:'Enter',meta:true},{key:'Enter',ctrl:true,consumed:true},{key:'Enter',meta:true,generating:true},{key:'Enter',ctrl:true,input:false},{key:'e'},{key:'Enter'}]){
 assert.deepEqual(run(cfg),run({...cfg,prior:true}));checks++
}
// Normalize only the new comments/guard; original remaining panel source is exact.
const guard="        // Radix consumes a picker Escape before it reaches this window listener.\n        // Let that layer dismiss and restore focus without closing its inspector.\n        if (process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && e.defaultPrevented) return\n"
// Later accepted leaf-draft forwarding is independently checked against its
// predecessor by the Text Box and Metric/Chart tests. Normalize those exact
// lines only; every other byte still reverses to the original panel.
const reviewedLeafWiring = source
 .replace('slotCatalogError={slotCatalogError} existingTextTarget={existingTextTarget} initialDraft={initialDraft} onDraftChange={onDraftChange} targetElementId={targetElementId} />','slotCatalogError={slotCatalogError} existingTextTarget={existingTextTarget} />')
 .replace('<MetricsForm {...commonProps} researchControls={researchControls} existingTextTarget={existingTextTarget} initialDraft={initialDraft} onDraftChange={onDraftChange} targetElementId={targetElementId} />','<MetricsForm {...commonProps} researchControls={researchControls} existingTextTarget={existingTextTarget} initialDraft={initialDraft} />')
assert.ok(source.includes(guard));assert.equal(reviewedLeafWiring.replace(guard,''),previous);checks++
console.log(`${checks} actual inspector shortcut checks passed; browser keyboard traversal is separate.`)
