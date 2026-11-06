import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import vm from 'node:vm'
import {createRequire} from 'node:module'
import ts from 'typescript'
import {verifyVoiceRenderSource} from './studio-v4/voice-render-source-proof.mjs'

// Static fixture preparation only. Root owns server/browser/runtime observations.
const builderBytes=fs.readFileSync(new URL(import.meta.url))
const require=createRequire(import.meta.url),root=path.resolve(new URL('..',import.meta.url).pathname)
const packet=path.join(root,'docs/studio-v4/twenty-four-hour-parity-20261005/builder1/voice-ui-review')
const voiceOff=process.argv.includes('--voice-off')
const variant=voiceOff?'voice-off':'voice-enabled'
const input=path.join(packet,'render-input'),out=path.join(packet,'evidence/render',variant)
const sha=v=>crypto.createHash('sha256').update(v).digest('hex')
const read=file=>fs.readFileSync(path.join(root,file),'utf8')
fs.mkdirSync(input,{recursive:true});fs.mkdirSync(out,{recursive:true})
const accepted=JSON.parse(read('docs/studio-v4/twenty-four-hour-parity-20261005/builder1/voice-correction/APP-MANIFEST.json'))
const verifiedVoiceSource=verifyVoiceRenderSource(root)
const compiledInputs=path.join(input,'compiled-'+variant+'.jsonl');fs.writeFileSync(compiledInputs,'')
const webpack=require('next/dist/compiled/webpack/bundle5')().webpack
const tsLoader=path.join(input,'typescript-loader.cjs'),cssLoader=path.join(input,'css-loader.cjs'),linkAdapter=path.join(input,'next-link.cjs')
fs.writeFileSync(tsLoader,`const ts=require('typescript'),fs=require('node:fs'),crypto=require('node:crypto');module.exports=function(source){fs.appendFileSync(${JSON.stringify(compiledInputs)},JSON.stringify({file:this.resourcePath,sha256:crypto.createHash('sha256').update(source).digest('hex')})+'\\n');const result=ts.transpileModule(source,{fileName:this.resourcePath,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}});const errors=(result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);if(errors.length)throw Error(ts.formatDiagnosticsWithColorAndContext(errors,{getCanonicalFileName:f=>f,getCurrentDirectory:()=>this.context,getNewLine:()=>"\\n"}));return result.outputText};\n`)
fs.writeFileSync(cssLoader,`module.exports=function(){return 'module.exports={};'};\n`)
fs.writeFileSync(linkAdapter,`const React=require('react');module.exports=function Link(p){return React.createElement('a',{...p,onClick:e=>e.preventDefault(),title:'Isolated fixture: Next navigation is not mounted'})};\n`)
const fixture=path.join(packet,'voice-render-fixture.tsx')
const pagePath='app/builder/page.tsx',pageSource=read(pagePath)
const pageAst=ts.createSourceFile(pagePath,pageSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
const attr=(node,name)=>node.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.getText(pageAst)===name)?.initializer
const scrollSeams=[]
const visit=node=>{if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(pageAst)==='ScrollArea'){
 const cls=attr(node.openingElement,'className'),div=node.children.find(ts.isJsxElement)
 if(cls&&ts.isStringLiteral(cls)&&cls.text==='flex-1'&&div&&div.openingElement.tagName.getText(pageAst)==='div'){
  const ref=attr(div.openingElement,'ref'),padding=attr(div.openingElement,'className')
  if(ref&&ts.isJsxExpression(ref)&&ref.expression?.getText(pageAst)==='studioVoiceTranscriptRootRef'&&padding&&ts.isStringLiteral(padding))scrollSeams.push({component:'ScrollArea',className:cls.text,transcriptClassName:padding.text,sourceRef:'studioVoiceTranscriptRootRef',fixtureRef:'transcriptRef'})
 }}ts.forEachChild(node,visit)}
visit(pageAst);assert.equal(scrollSeams.length,1,'Actual Page transcript ScrollArea seam must be unambiguous')
assert.equal(scrollSeams[0].transcriptClassName,'px-3 py-4 space-y-4')
const fixtureLayoutSource=fs.readFileSync(fixture,'utf8')
assert.ok(fixtureLayoutSource.includes('<ScrollArea className="flex-1">'))
assert.ok(fixtureLayoutSource.includes('<div ref={transcriptRef} className="px-3 py-4 space-y-4">'))
assert.ok(!fixtureLayoutSource.includes('className="fixture-transcript"'))
const layoutSeam={...scrollSeams[0],pageSourceSha256:sha(pageSource),scope:'Actual ScrollArea import/class/transcript-source seam only, not a full Page render'}

const parsedConfig=ts.parseJsonConfigFileContent(ts.readConfigFile(path.join(root,'tsconfig.json'),ts.sys.readFile).config,ts.sys,root)
const typed=ts.createProgram([fixture,path.join(root,'types/next-auth.d.ts'),path.join(root,'next-env.d.ts')],{...parsedConfig.options,noEmit:true,incremental:false})
const typedErrors=ts.getPreEmitDiagnostics(typed).filter(d=>d.category===ts.DiagnosticCategory.Error)
assert.equal(typedErrors.length,0,ts.formatDiagnosticsWithColorAndContext(typedErrors,{getCanonicalFileName:f=>f,getCurrentDirectory:()=>root,getNewLine:()=> '\n'}))
const compiler=webpack({mode:'development',context:root,entry:fixture,devtool:false,target:'web',cache:false,output:{path:out,filename:'voice-render.js'},optimization:{minimize:false},resolve:{extensions:['.tsx','.ts','.js','.mjs','.json'],alias:{'@':root,'next/link$':linkAdapter,'react$':require.resolve('react'),'react/jsx-runtime$':require.resolve('react/jsx-runtime'),'react-dom$':require.resolve('react-dom'),'react-dom/client$':require.resolve('react-dom/client')},symlinks:true},module:{rules:[{test:/\.tsx?$/,use:[tsLoader]},{test:/\.css$/,use:[cssLoader]}]},plugins:[new webpack.DefinePlugin({'process.env':JSON.stringify({NODE_ENV:'development',NEXT_PUBLIC_STUDIO_V4_SHELL:'true',NEXT_PUBLIC_STUDIO_V4_VOICE_INTERACTIVE:voiceOff?'false':'true',NEXT_PUBLIC_STUDIO_V4_TOKENS:'true',NEXT_PUBLIC_STUDIO_V4_TYPE:'true',NEXT_PUBLIC_CHAT_CLARITY:'true',NEXT_PUBLIC_CHAT_QUESTIONS:'true',NEXT_PUBLIC_CHAT_MENTIONS:'true'})})]})
const stats=await new Promise((resolve,reject)=>compiler.run((error,stats)=>{compiler.close(()=>{});if(error)reject(error);else resolve(stats)}))
const summary=stats.toJson({all:false,errors:true,warnings:true});assert.ok(!stats.hasErrors(),JSON.stringify(summary.errors,null,2))
const moduleFiles=new Set()
for(const module of stats.compilation.modules){if(module.resource&&fs.existsSync(module.resource))moduleFiles.add(fs.realpathSync(module.resource))}
const appFiles=[...moduleFiles].filter(file=>file.startsWith(root+'/')&&!file.includes('/node_modules/')&&!file.startsWith(input+'/'))
for(const required of ['components/builder/chat/studio-director-header.tsx','components/builder/voice-interactive/director-call.tsx','components/builder/voice-interactive/director-character.tsx','components/builder/voice-interactive/use-director-call.ts','components/builder/message-list.tsx','components/builder/chat-input.tsx','components/builder/chat/question-card.tsx','components/ui/scroll-area.tsx','hooks/use-studio-director-call.ts','lib/studio-voice-transcript-provenance.ts','lib/studio-voice-owner.ts','lib/studio-director-message-policy.ts'])assert.ok(appFiles.includes(path.join(root,required)),'Actual fixture component absent '+required)
const styles=new Set(['app/globals.css','app/builder/studio-v4.css','app/builder/studio-v4-type.css','components/layout/studio-shell.css','components/builder/studio-workspace.css',...[...moduleFiles].filter(file=>file.endsWith('.css')).map(file=>path.relative(root,file))])
const tailwindModule={exports:{}}
const tailwindSource=read('tailwind.config.ts')
vm.runInNewContext(ts.transpileModule(tailwindSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:tailwindModule,exports:tailwindModule.exports,require})
const content=appFiles.filter(file=>/\.(tsx?|jsx?)$/.test(file)).map(file=>({raw:fs.readFileSync(file,'utf8'),extension:path.extname(file).slice(1)}))
const postcss=require('postcss'),tailwind=require('tailwindcss'),autoprefixer=require('autoprefixer')
const cssSource=[...styles].map(read).join('\n')
const processed=await postcss([tailwind({...tailwindModule.exports.default,content}),autoprefixer()]).process(cssSource,{from:path.join(root,'app/globals.css')})
const fixtureCss=`body{margin:0;background:#e8f0ed;color:#243438;font:14px Arial}.fixture-app{display:flex;gap:16px;align-items:start;padding:16px}.fixture-tools{width:300px;max-height:calc(100dvh - 32px);overflow:auto;flex-shrink:0}.fixture-tools h1{font-size:18px;font-weight:600}.fixture-tools>button,.fixture-tools>label{display:block;margin:8px 0}.fixture-tools>button{border:1px solid #99aaa5;border-radius:7px;background:white;padding:6px 10px}.fixture-tools select{display:block;border:1px solid #99aaa5;background:white;color:#243438;padding:5px}.fixture-tools pre{font:11px/1.5 monospace;white-space:pre-wrap;max-height:240px;overflow:auto}.fixture-tools output{display:block;margin:10px 0}.fixture-chat{height:calc(100dvh - 32px);min-width:300px;max-width:calc(100vw - 348px);border:1px solid var(--ss-line);border-radius:12px;overflow:hidden}.fixture-working-chat{height:100%;flex-direction:column}.dark body{background:#141c1e;color:#e2ebe8}.dark .fixture-tools>button,.dark .fixture-tools select{background:#243034;color:#e2ebe8;border-color:#526963}.fixture-tools :is(button,input,select):focus-visible{outline:3px solid #896dd4;outline-offset:2px}@media(max-width:750px){.fixture-app{display:block}.fixture-tools{width:auto;max-height:240px}.fixture-chat{max-width:100%;height:calc(100dvh - 280px)}}`
const bundle=fs.readFileSync(path.join(out,'voice-render.js'),'utf8');new vm.Script(bundle,{filename:'voice-render.js'})
fs.writeFileSync(path.join(out,'voice-render.css'),processed.css+'\n'+fixtureCss)
fs.writeFileSync(path.join(out,'voice-render.html'),`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; connect-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; frame-src 'none'; media-src 'none'"><meta name="voice-render-source-sha256" content="${sha(bundle)}"><title>Isolated actual Director call / chat source</title><link rel="stylesheet" href="voice-render.css"></head><body><div id="root"></div><script src="voice-render.js"></script></body></html>`)
const sources=[...new Set([...appFiles,...[...styles].map(file=>path.join(root,file)),path.join(root,'tailwind.config.ts')])].map(file=>({file:path.relative(root,file),sha256:sha(fs.readFileSync(file))}))
assert.deepEqual(verifyVoiceRenderSource(root),verifiedVoiceSource,'Root candidate changed during build')
const compileBound=fs.readFileSync(compiledInputs,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line))
for(const row of compileBound)assert.equal(sha(fs.readFileSync(row.file)),row.sha256,'Input changed during build '+row.file)
const dependencyFiles=[...moduleFiles].filter(file=>file.includes('/node_modules/')).map(file=>({path:path.relative(root,file),sha256:sha(fs.readFileSync(file))}))
assert.equal(sha(fs.readFileSync(new URL(import.meta.url))),sha(builderBytes),'Build adapter changed during preparation')
const receipt={variant,verifiedVoiceSource,layoutSeam,typedSourceErrors:typedErrors.length,compiledGate:{studio:'true',voice:voiceOff?'false':'true'},compileBoundInputs:compileBound.map(row=>({...row,file:path.relative(root,row.file)})),scope:'Static preparation: actual accepted call/character/hook and current shared useStudioDirectorCall, actual Page ScrollArea/transcript layout, header, MessageList, QuestionCard, ChatInput + actual shared helpers; installed ReactDOM/Radix/Markdown and compiled actual Tailwind/CSS. Browser observations belong to root.',acceptedAggregate:accepted.resultAppSha256,appRouterMounted:false,actualAccountOrTransport:false,actualNativeSpeech:false,serverOrBrowserStarted:false,adapters:['Inert Next Link','Explicit synthetic account/session/ingress inputs to actual shared helpers, not live reducer proof','All fetches return synthetic 503 and WebSocket construction throws; CSP refuses connections','Visible local/remote/unavailable synthesis adapter, synthetic dispatch only','Visible reduced-motion adapter','Literal gate choice in isolated fixture; no persistent/public app flag change'],warnings:summary.warnings.map(w=>w.message),sources,dependencies:dependencyFiles,outputs:['voice-render.js','voice-render.css','voice-render.html'].map(file=>({file,sha256:sha(fs.readFileSync(path.join(out,file))),bytes:fs.statSync(path.join(out,file)).size})),builderSha256:sha(builderBytes)}
fs.writeFileSync(path.join(packet,'evidence/render-preparation-'+variant+'.json'),JSON.stringify(receipt,null,2)+'\n')
console.log(`Prepared actual-source voice fixture: ${sources.length} app/style inputs, ${dependencyFiles.length} installed dependency inputs. No server/browser/service started.`)
