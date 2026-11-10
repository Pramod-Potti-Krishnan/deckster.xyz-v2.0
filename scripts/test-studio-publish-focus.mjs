import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { execFileSync } from 'node:child_process'
const file='components/publish-dialog.tsx',source=fs.readFileSync(file,'utf8')
const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
let flag,attribute
function visit(n){
 if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='STUDIO_PUBLISH')flag=n.initializer
 if(ts.isJsxAttribute(n)&&n.name.getText(ast)==='onCloseAutoFocus')attribute=n.initializer.expression
 ts.forEachChild(n,visit)
}
visit(ast);assert.ok(flag&&attribute)
const code=ts.transpileModule('const STUDIO_PUBLISH='+flag.getText(ast)+';('+attribute.getText(ast)+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
let checks=0
function run({flag='true',connected=true,disabled=false,owner='owned-session',current=true,withRef=true}={}){
 let prevented=0,focused=[]
 const trigger={isConnected:connected,disabled,getAttribute:n=>{assert.equal(n,'data-studio-publish-session');return owner},focus:options=>focused.push(options)}
 const handler=vm.runInNewContext(code,{process:{env:{NEXT_PUBLIC_STUDIO_V4_SHELL:flag}},sessionId:'owned-session',returnFocusRef:withRef?{current:current?trigger:null}:undefined})
 handler?.({preventDefault:()=>prevented++})
 return {prevented,focused:JSON.parse(JSON.stringify(focused)),registered:!!handler}
}
assert.deepEqual(run(),{prevented:1,focused:[{preventScroll:true}],registered:true});checks++
for(const cfg of [{connected:false},{disabled:true},{owner:'other-session'},{owner:null},{current:false},{withRef:false}]){
 assert.deepEqual(run(cfg),{prevented:0,focused:[],registered:true});checks++
}
for(const flag of [undefined,'','false','TRUE']){
 // Spread does not substitute the destructuring default for an absent flag.
 const handler=vm.runInNewContext(code,{process:{env:{NEXT_PUBLIC_STUDIO_V4_SHELL:flag}},sessionId:'owned-session',returnFocusRef:{current:null}})
 assert.equal(handler,undefined);checks++
}
assert.match(source,/ref=\{publishTriggerRef\}/);checks++
assert.match(source,/data-studio-publish-session=\{STUDIO_PUBLISH \? sessionId : undefined\}/);checks++
assert.match(source,/returnFocusRef=\{STUDIO_PUBLISH \? publishTriggerRef : undefined\}/);checks++
// Other authorized visual changes now have separate actual-component/classic
// preservation checks. Keep this feature's callback exactly equal to its
// accepted checkpoint rather than freezing unrelated dialog appearance.
const baseline=execFileSync('git',['show','0ed6298:'+file],{encoding:'utf8'})
const baselineAst=ts.createSourceFile(file,baseline,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
let baselineAttribute
function baselineVisit(n){
 if(ts.isJsxAttribute(n)&&n.name.getText(baselineAst)==='onCloseAutoFocus')baselineAttribute=n.initializer.expression
 ts.forEachChild(n,baselineVisit)
}
baselineVisit(baselineAst);assert.ok(baselineAttribute)
assert.equal(attribute.getText(ast),baselineAttribute.getText(baselineAst));checks++
console.log(`${checks} actual Publish close-focus/default-off/ownership/wiring checks passed; accepted focus callback exact.`)
