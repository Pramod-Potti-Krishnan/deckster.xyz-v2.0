// Compiler/source checks only. Never evaluate auth-options/prisma, sign tokens,
// load credentials/providers, or access accounts, databases or services.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
const root = fileURLToPath(new URL('../', import.meta.url)), beforeRevision = '412cc6c'
const declarationFile = 'types/next-auth.d.ts', authFile = 'lib/auth-options.ts'
const read = file => fs.readFileSync(path.join(root,file),'utf8')
const before = file => execFileSync('git',['show',`${beforeRevision}:${file}`],{cwd:root,encoding:'utf8'})
const original = before(declarationFile), current = read(declarationFile)
const oldBlock = 'declare module "next-auth/jwt" {\n  interface JWT {\n    id: string\n    tier: "free" | "starter" | "pro" | "premium"'
const newBlock = 'declare module "next-auth/jwt" {\n  interface JWT {\n    id: string\n    tier: string'
assert.equal(original.split(oldBlock).length,2)
assert.equal(current,original.replace(oldBlock,newBlock),'Only raw JWT tier type changed; User/Session unions and all other declarations are byte-exact')
const removedHostOption = '  // Trust host in production (required for Vercel)\n  trustHost: true,\n'
assert.equal(before(authFile).split(removedHostOption).length,2)
assert.equal(read(authFile),before(authFile).replace(removedHostOption,''),'Whole auth remainder exact outside only approved unsupported option/comment removal; callbacks/session cast/claims/gates untouched')
const emit = (source,fileName) => ts.transpileModule(source,{fileName,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}})
const oldAuth = emit(before(authFile),authFile), currentAuth = emit(read(authFile),authFile)
assert.deepEqual(currentAuth.diagnostics,[])
const removedEmittedHostOption = '    // Trust host in production (required for Vercel)\n    trustHost: true,\n'
assert.equal(oldAuth.outputText.split(removedEmittedHostOption).length,2)
assert.equal(currentAuth.outputText,oldAuth.outputText.replace(removedEmittedHostOption,''),'Emitted auth JS changes only by deleting unused literal member/comment')
// Treat augmentation text as a .ts source solely for compiler emission: all
// interfaces are erased, and its type-only imports emit no executable code.
const oldTypes = emit(original,'next-auth-type-emission.ts'), currentTypes = emit(current,'next-auth-type-emission.ts')
assert.deepEqual(currentTypes.diagnostics,[]); assert.equal(currentTypes.outputText,oldTypes.outputText)
assert.equal(currentTypes.outputText.trim(),'"use strict";\nObject.defineProperty(exports, "__esModule", { value: true });')
let checks=5
const isolatedPath=path.join(root,'.env.studio-v4-runtime/tsconfig.json')
assert.ok(fs.existsSync(isolatedPath),'Existing task 19-model compiler config required; do not generate a replacement client')
const loaded=ts.readConfigFile(isolatedPath,ts.sys.readFile); assert.equal(loaded.error,undefined)
const parsed=ts.parseJsonConfigFileContent(loaded.config,ts.sys,path.dirname(isolatedPath)); assert.deepEqual(parsed.errors,[])
assert.equal(parsed.options.incremental,false)
assert.ok(parsed.options.paths['@prisma/client'].some(value=>value.includes('.env.studio-v4-runtime/prisma-client')))
const authPath=path.join(root,authFile), declarationPath=path.join(root,declarationFile)
const format=d=>({file:d.file?path.relative(root,d.file.fileName):null,code:d.code,start:d.start,message:ts.flattenDiagnosticMessageText(d.messageText,' ')})
function check(declaration,authSource=read(authFile)){
  const host=ts.createCompilerHost({...parsed.options,noEmit:true,incremental:false})
  const getSourceFile=host.getSourceFile
  host.getSourceFile=(file,languageVersion,...rest)=>path.resolve(file)===declarationPath?ts.createSourceFile(file,declaration,languageVersion,true):path.resolve(file)===authPath?ts.createSourceFile(file,authSource,languageVersion,true):getSourceFile(file,languageVersion,...rest)
  const program=ts.createProgram([authPath,declarationPath],{...parsed.options,noEmit:true,incremental:false},host)
  const diagnostics=ts.getPreEmitDiagnostics(program).map(format)
  return {diagnostics,auth:diagnostics.filter(d=>d.file===authFile),other:diagnostics.filter(d=>d.file!==authFile)}
}
const oldCheck=check(original), currentCheck=check(current)
assert.equal(oldCheck.auth.length,1); assert.equal(oldCheck.auth[0].code,2322)
assert.ok(oldCheck.auth[0].message.includes('tier: string'))
const unsupportedOptionCheck=check(current,before(authFile))
assert.deepEqual(unsupportedOptionCheck.auth,[{
  file:authFile,code:2353,start:before(authFile).indexOf('trustHost:'),
  message:"Object literal may only specify known properties, and 'trustHost' does not exist in type 'AuthOptions'.",
}],'Exact prior unsupported option error reproduced from unchanged baseline source')
assert.deepEqual(currentCheck.auth,[],'Actual auth source has no diagnostics after the two separately authorized declaration/option corrections')
assert.deepEqual(unsupportedOptionCheck.other,currentCheck.other,'Host option removal does not suppress transitive failures')
assert.equal(before(authFile).includes('trustHost: true,'),true)
assert.equal(currentCheck.auth.some(d=>d.code===2322),false)
assert.deepEqual(currentCheck.other,oldCheck.other,'All transitive unrelated failures remain unchanged, not suppressed')
checks+=9
const ast=ts.createSourceFile(declarationFile,current,ts.ScriptTarget.Latest,true)
const moduleBody=name=>ast.statements.find(n=>ts.isModuleDeclaration(n)&&n.name.text===name).body
const jwt=moduleBody('next-auth/jwt').statements.find(n=>ts.isInterfaceDeclaration(n)&&n.name.text==='JWT')
assert.equal(jwt.members.find(n=>n.name.text==='tier').type.kind,ts.SyntaxKind.StringKeyword)
const authAst=ts.createSourceFile(authFile,read(authFile),ts.ScriptTarget.Latest,true)
const casts=[]
function visit(node){if(ts.isAsExpression(node)&&node.expression.getText(authAst)==='token.tier')casts.push(node.getText(authAst));ts.forEachChild(node,visit)}visit(authAst)
assert.deepEqual(casts,['token.tier as "free" | "starter" | "pro" | "premium"'])
assert.match(read('prisma/schema.prisma'),/tier\s+String\s+@default\("free"\)/)
checks+=3
// Read-only installed package provenance and option-consumer audit. No module
// import/evaluation, environment value access or auth-host behavior change.
const packageBase=path.join(root,'node_modules/next-auth'), matched=[], packageFiles=[]
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name)
  if(entry.isDirectory())walk(file)
  else if(/\.(js|ts|json)$/.test(file)){
    packageFiles.push(file)
    if(/trustHost|trust[_-]host/i.test(fs.readFileSync(file,'utf8')))matched.push(path.relative(packageBase,file))
  }
}}
walk(packageBase)
assert.deepEqual(matched.sort(),['src/utils/detect-origin.ts','utils/detect-origin.js'])
const detectOrigin=fs.readFileSync(path.join(packageBase,'src/utils/detect-origin.ts'),'utf8')
assert.match(detectOrigin,/process\.env\.VERCEL \?\? process\.env\.AUTH_TRUST_HOST/)
assert.match(detectOrigin,/return process\.env\.NEXTAUTH_URL/)
const installedVersion=JSON.parse(fs.readFileSync(path.join(packageBase,'package.json'),'utf8')).version
const lockedVersion=JSON.parse(read('package-lock.json')).packages['node_modules/next-auth'].version
assert.equal(installedVersion,'4.24.13'); assert.equal(lockedVersion,'4.24.11')
checks+=5
console.log(JSON.stringify({checks,installedPackageAudit:{installedVersion,lockedVersion,files:packageFiles.length,trustHostMatches:matched},actualAuthBefore:oldCheck.auth.map(d=>({code:d.code,file:d.file})),priorUnsupportedOption:unsupportedOptionCheck.auth.map(d=>({code:d.code,file:d.file})),actualAuthAfter:currentCheck.auth.map(d=>({code:d.code,file:d.file,message:d.message})),unchangedTransitiveDiagnostics:currentCheck.other.map(d=>({code:d.code,file:d.file})),limitation:'Session/User unions and preexisting session tier cast remain; no runtime/auth/account/DB/service/signing or whole-app pass claimed.'}))
