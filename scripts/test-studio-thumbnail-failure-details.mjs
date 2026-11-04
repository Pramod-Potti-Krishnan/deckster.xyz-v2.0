// Actual strip diagnostics, native action identity and complete original-source preservation.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import postcss from 'postcss'

const require=createRequire(import.meta.url),root=new URL('../',import.meta.url),file='components/slide-thumbnail-strip.tsx'
const source=fs.readFileSync(new URL(file,root),'utf8')
const original=execFileSync('git',['show','6b6ad57:'+file],{cwd:root,encoding:'utf8'})
const row=original.match(/          <div className="studio-thumbnail-refine-error"[\s\S]*?          <\/div>/)[0]
const restored=source.replace(/          <ThumbnailFailureDetails.*kind="refine".*\n/,row+'\n').replace(/        \{STUDIO_THUMBNAILS && isError && <ThumbnailFailureDetails.*\n/,'')
function canonical(text,strip=false) {
  const ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  const result=ts.transform(ast,[context=>{const visit=node=>{
    if(strip&&ts.isFunctionDeclaration(node)&&node.name?.text==='ThumbnailFailureDetails')return undefined
    if(strip&&ts.isImportDeclaration(node)&&node.moduleSpecifier.text==='@/components/ui/dialog')return undefined
    return ts.visitEachChild(node,visit,context)
  };return node=>ts.visitNode(node,visit)}])
  const printed=ts.createPrinter({removeComments:true}).printFile(result.transformed[0]);result.dispose();return printed
}
assert.equal(canonical(restored,true),canonical(original),'All native callbacks, keyboard selection, indices, processing gates, drag, options, classes and other source remain AST-exact')
const compile=text=>{const out=ts.transpileModule(text,{reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}});assert.deepEqual((out.diagnostics??[]).filter(item=>item.category===ts.DiagnosticCategory.Error),[]);return out.outputText}
const cn=(...args)=>args.filter(Boolean).join(' ')
const Passthrough=({children,asChild,...props})=>React.createElement('div',props,children)
const ui=new Proxy({},{get:()=>Passthrough})
const pure={}
for(const name of ['slide-compose-async','slide-thumbnail-menu']){const module={exports:{}};vm.runInNewContext(compile(fs.readFileSync(new URL('lib/'+name+'.ts',root),'utf8')),{module,exports:module.exports,require});pure[name]=module.exports}
function load(text,studio=true){const module={exports:{}};const fakeReact={...React,default:React,useState:initial=>[initial,()=>{}],useEffect:()=>{},useRef:()=>({current:null}),useCallback:fn=>fn};vm.runInNewContext(compile(text),{module,exports:module.exports,process:{env:{NEXT_PUBLIC_STUDIO_V4_SHELL:studio?'true':'false'}},require:id=>id==='react'?fakeReact:id==='@/lib/utils'?{cn}:id.startsWith('@/components/ui/')||id==='@radix-ui/react-tooltip'?ui:id==='@/lib/slide-compose-async'?pure['slide-compose-async']:id==='@/lib/slide-thumbnail-menu'?pure['slide-thumbnail-menu']:id==='./slide-layout-picker'?{SLIDE_LAYOUTS:[]}:id.endsWith('.css')?{}:require(id)});return module.exports}
const find=(tree,predicate,result=[])=>{if(!tree||typeof tree!=='object')return result;if(predicate(tree))result.push(tree);React.Children.forEach(tree.props?.children,child=>find(child,predicate,result));return result}
const Current=load(source+'\nexport { ThumbnailFailureDetails }'),Classic=load(source,false),Before=load(original,false)
let checks=1
for(const kind of ['compose','refine'])for(const reason of ['Refinement failed','Native first reason; native second reason.\n'+'long-native-identifier-'.repeat(180)]){
 const tree=Current.ThumbnailFailureDetails({slideNumber:2,kind,reason})
 const trigger=find(tree,node=>node.props['data-studio-thumbnail-failure-trigger']==='true')[0]
 const panel=find(tree,node=>node.props['data-studio-thumbnail-failure']==='true')[0]
 const text=find(tree,node=>node.props['data-studio-thumbnail-failure-text']==='true')[0]
 assert.equal(trigger.props.title,reason);assert.equal(trigger.props['aria-label'],`Inspect failed ${kind==='refine'?'refinement':'build'} for slide 2`)
 assert.equal(text.props.children,reason);assert.equal(text.props.role,'region');assert.equal(text.props.tabIndex,0);assert.equal(text.props['aria-label'],'Slide 2 failure details')
 let stopped=0;trigger.props.onClick({stopPropagation:()=>stopped++});panel.props.onKeyDown({stopPropagation:()=>stopped++});assert.equal(stopped,2)
 assert.equal(find(tree,node=>node.type==='button').length,1,'Inspection adds no retry/write action')
 assert.equal(panel.props['data-studio-v4-shell'],'true');checks++
}
assert.equal(Classic.ThumbnailFailureDetails,undefined)
const slides=[{slideNumber:1,slideId:'s1',title:'First'},{slideNumber:2,slideId:'s2',title:'Second'}]
for(const kind of ['compose','refine'])for(const status of ['building','error'])for(const retry of [false,true]){
 const retried=[],navigated=[],selected=[]
 const job={jobId:'job2',targetIndex:1,targetLayoutIndex:1,targetSlideId:'s2',kind,status,errors:['Native first reason','','Native second reason'],onRetry:retry?id=>retried.push(id):undefined}
 const props={slides,currentSlide:1,onSlideClick:n=>navigated.push(n),onSelectionChange:indices=>selected.push(indices),composeJobs:[job],orientation:'vertical'}
 assert.equal(renderToStaticMarkup(React.createElement(Classic.SlideThumbnailStrip,props)),renderToStaticMarkup(React.createElement(Before.SlideThumbnailStrip,props)),'Complete classic strip SSR is exact across native job states/gates')
 const tree=Current.SlideThumbnailStrip(props)
 const detail=find(tree,node=>node.type===Current.ThumbnailFailureDetails)
 assert.equal(detail.length,status==='error'?1:0,'Only existing error states expose inspection')
 if(detail.length)assert.equal(detail[0].props.reason,'Native first reason; Native second reason')
 if(kind==='compose'){
  const card=find(tree,node=>node.props['data-studio-compose-card']===true)[0]
  assert.equal(card.props.disabled,status==='error'?!retry:true)
  if(status==='error'&&retry){card.props.onClick();assert.deepEqual(retried,['job2'],'Native retry still uses exact job id')}
 }
 checks++
}
const css=fs.readFileSync(new URL('components/studio-thumbnails.css',root),'utf8');postcss.parse(css)
assert.ok(css.includes('.dark [data-studio-v4-shell="true"][data-studio-thumbnail-failure="true"]'))
assert.ok(css.includes('max-height:min(280px,50dvh)')&&css.includes('white-space:pre-wrap')&&css.includes('overflow-y:auto'))
assert.ok(source.includes("reason={errorText || 'Slide Composer failed'}")&&source.includes("reason={refineJob.errors?.filter(Boolean).join('; ') || 'Refinement failed'}"),'Exact existing native fallback diagnostics remain')
checks++
console.log(`Studio thumbnail diagnostics: ${checks} isolated native/classic/action/source/style checks passed`)
