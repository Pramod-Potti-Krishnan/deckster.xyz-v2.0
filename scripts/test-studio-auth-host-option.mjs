// Source/compiler proof only: no auth/provider/prisma/Stripe module evaluation,
// environment-value reads, signing, account/database/service or runtime action.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
const root=fileURLToPath(new URL('../',import.meta.url)),baseline='c339e8c'
const file='lib/auth-options.ts',read=f=>fs.readFileSync(path.join(root,f),'utf8')
const before=f=>execFileSync('git',['show',`${baseline}:${f}`],{cwd:root,encoding:'utf8'})
const original=before(file),current=read(file)
const removed='  // Trust host in production (required for Vercel)\n  trustHost: true,\n'
assert.equal(original.split(removed).length,2)
assert.equal(current,original.replace(removed,''),'Entire source remainder byte-exact; only unsupported member and inaccurate comment removed')
const emit=source=>ts.transpileModule(source,{fileName:file,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}})
const originalJs=emit(original),currentJs=emit(current)
assert.deepEqual(currentJs.diagnostics,[])
const removedJs='    // Trust host in production (required for Vercel)\n    trustHost: true,\n'
assert.equal(originalJs.outputText.split(removedJs).length,2)
assert.equal(currentJs.outputText,originalJs.outputText.replace(removedJs,''),'Only unused literal property/comment deleted from emitted JS; no callback or policy code changes')
const members=source=>{
  const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true)
  const declaration=ast.statements.filter(ts.isVariableStatement).flatMap(n=>n.declarationList.declarations).find(n=>n.name.getText(ast)==='authOptions')
  assert.ok(ts.isObjectLiteralExpression(declaration.initializer))
  return declaration.initializer.properties.map(n=>({name:n.name.getText(ast),text:n.getText(ast)}))
}
const oldMembers=members(original),newMembers=members(current)
assert.deepEqual(newMembers,oldMembers.filter(n=>n.name!=='trustHost'),'Every provider/cookie/session/jwt/redirect/callback option retains original source')
assert.equal(oldMembers.filter(n=>n.name==='trustHost').length,1)
assert.equal(newMembers.some(n=>n.name==='trustHost'),false)
assert.equal(read('types/next-auth.d.ts'),before('types/next-auth.d.ts'),'Prior raw JWT string change and unchanged User/Session unions retained exactly')
let checks=8
const packageBase=path.join(root,'node_modules/next-auth')
const installed=JSON.parse(fs.readFileSync(path.join(packageBase,'package.json'),'utf8')).version
const locked=JSON.parse(read('package-lock.json')).packages['node_modules/next-auth'].version
assert.equal(installed,'4.24.13');assert.equal(locked,'4.24.11')
const matches=[];let scanned=0
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const filename=path.join(dir,entry.name)
  if(entry.isDirectory())walk(filename)
  else if(/\.(js|ts|json)$/.test(filename)){
    scanned++;if(/trustHost|trust[_-]host/i.test(fs.readFileSync(filename,'utf8')))matches.push(path.relative(packageBase,filename))
  }
}}
walk(packageBase)
assert.deepEqual(matches.sort(),['src/utils/detect-origin.ts','utils/detect-origin.js'],'No explicit auth option consumer; only unchanged host environment lookup')
const origin=fs.readFileSync(path.join(packageBase,'src/utils/detect-origin.ts'),'utf8')
assert.match(origin,/if \(process\.env\.VERCEL \?\? process\.env\.AUTH_TRUST_HOST\)/)
assert.match(origin,/return process\.env\.NEXTAUTH_URL/)
const core=fs.readFileSync(path.join(packageBase,'src/core/index.ts'),'utf8')
assert.match(core,/headers\["x-forwarded-host"\] \?\? headers\.host/)
assert.match(core,/headers\["x-forwarded-proto"\]/)
const defaultCallbacks=fs.readFileSync(path.join(packageBase,'core/lib/default-callbacks.js'),'utf8')
assert.match(defaultCallbacks,/new URL\(url\)\.origin === baseUrl/)
const coreInit=fs.readFileSync(path.join(packageBase,'core/init.js'),'utf8')
assert.match(coreInit,/authOptions\.useSecureCookies/)
checks+=9
const config=path.join(root,'.env.studio-v4-runtime/tsconfig.json')
assert.ok(fs.existsSync(config),'Use existing task client only; no generation/install')
const loaded=ts.readConfigFile(config,ts.sys.readFile);assert.equal(loaded.error,undefined)
const parsed=ts.parseJsonConfigFileContent(loaded.config,ts.sys,path.dirname(config));assert.deepEqual(parsed.errors,[])
assert.equal(parsed.options.incremental,false)
assert.ok(parsed.options.paths['@prisma/client'].some(value=>value.includes('.env.studio-v4-runtime/prisma-client')))
const authPath=path.join(root,file),declarationPath=path.join(root,'types/next-auth.d.ts')
function diagnostics(source){
  const host=ts.createCompilerHost({...parsed.options,noEmit:true,incremental:false}),get=host.getSourceFile
  host.getSourceFile=(f,v,...rest)=>path.resolve(f)===authPath?ts.createSourceFile(f,source,v,true):get(f,v,...rest)
  const program=ts.createProgram([authPath,declarationPath],{...parsed.options,noEmit:true,incremental:false},host)
  return ts.getPreEmitDiagnostics(program).map(d=>({file:d.file?path.relative(root,d.file.fileName):null,code:d.code,start:d.start,message:ts.flattenDiagnosticMessageText(d.messageText,' ')}))
}
const oldDiagnostics=diagnostics(original),newDiagnostics=diagnostics(current)
assert.deepEqual(oldDiagnostics.filter(d=>d.file===file),[{file,code:2353,start:original.indexOf('trustHost:'),message:"Object literal may only specify known properties, and 'trustHost' does not exist in type 'AuthOptions'."}])
assert.deepEqual(newDiagnostics.filter(d=>d.file===file),[],'Actual AuthOptions and callbacks now clean; no ignores/casts/altered host logic')
assert.deepEqual(newDiagnostics,oldDiagnostics.filter(d=>d.file!==file),'All other dependency diagnostics unchanged')
assert.deepEqual(newDiagnostics.map(d=>({file:d.file,code:d.code})),[{file:'lib/stripe/stripe.ts',code:2322}])
checks+=4
console.log(JSON.stringify({checks,authDiagnostics:[],remainingTransitiveDiagnostics:newDiagnostics.map(d=>({file:d.file,code:d.code})),packageProvenance:{installed,locked,scanned,trustHostMatches:matches},limitation:'Compiler/source only; auth/account/runtime behavior not exercised, Session/User tier cast remains, Stripe version/webhook contracts unmodified.'}))
