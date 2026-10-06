// Actual custom fallback only: exact classic DOM/native copy/callback and complete boundary lifecycle preservation.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import postcss from 'postcss'
const require=createRequire(import.meta.url),root=new URL('../',import.meta.url)
const file='components/error-boundary.tsx',source=fs.readFileSync(new URL(file,root),'utf8')
const original=execFileSync('git',['show','7538558:'+file],{cwd:root,encoding:'utf8'})
const start=original.indexOf('        <div className="bg-red-50 border border-red-200 rounded-lg p-4 m-4">')
const before=original.slice(start,original.indexOf('\n      )}',start))
assert.equal(source.replace("import { WebSocketErrorFallback } from './websocket-error-fallback'\n",'').replace('<WebSocketErrorFallback errorDetails={errorDetails} retry={retry} />',before.trimStart()),original,'Whole original boundary class/lifecycle/recovery/error manager/logging/generic fallback is byte-exact')
const leaf=fs.readFileSync(new URL('components/websocket-error-fallback.tsx',root),'utf8')
const compile=text=>{const built=ts.transpileModule(text,{reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}});assert.deepEqual((built.diagnostics??[]).filter(item=>item.category===ts.DiagnosticCategory.Error),[]);return built.outputText}
const Button=({children,variant,size,...props})=>React.createElement('button',{'data-variant':variant,'data-size':size,...props},children)
function load(text,flag){const module={exports:{}};vm.runInNewContext(compile(text),{module,exports:module.exports,process:{env:{NEXT_PUBLIC_STUDIO_V4_SHELL:flag}},require:id=>id==='@/components/ui/button'?{Button}:id.endsWith('.css')?{}:require(id)});return module.exports}
const Original=load(`import { WifiOff,RefreshCw } from 'lucide-react';import { Button } from '@/components/ui/button';export function Original({errorDetails,retry}){return (${before})}`).Original
const nativeDefault='Failed to establish connection with AI agents. Please check your internet connection and try again.'
const long='Supplied native diagnostic.\nSecond native line.\n'+'native_detail_long_0123456789 '.repeat(150)
const messages=[undefined,'','Supplied short message',long]
let checks=1
for(const flag of [undefined,'false','TRUE','1','true'])for(const message of messages){
 const Current=load(leaf,flag).WebSocketErrorFallback
 let retried=0;const retry=()=>retried++
 const props={errorDetails:message===undefined?undefined:{userMessage:message},retry}
 const tree=Current(props),classic=Original(props),children=React.Children.toArray(tree.props.children)
 assert.equal(children[1].props.children,message||nativeDefault,'Exact original fallback/empty/userMessage semantics remain')
 assert.equal(children[2].type,Button);assert.equal(children[2].props.onClick,retry,'Exact retry callback is preserved without wrapper or reconnect request')
 assert.equal(children[2].props.size,'sm');assert.equal(children[2].props.variant,'outline')
 children[2].props.onClick();assert.equal(retried,1)
 if(flag!=='true')assert.equal(renderToStaticMarkup(tree),renderToStaticMarkup(classic),'Classic whole native fallback SSR remains exact')
 else{assert.equal(tree.props['data-studio-v4-shell'],'true');assert.equal(tree.props['data-studio-websocket-error'],'true');assert.equal(tree.props.role,'alert');assert.equal(children[1].props.role,'region');assert.equal(children[1].props.tabIndex,0);assert.equal(children[1].props['aria-label'],'Connection error details')}
 checks++
}
const css=fs.readFileSync(new URL('components/studio-websocket-error.css',root),'utf8'),parsed=postcss.parse(css)
parsed.walkRules(rule=>assert.ok(rule.selector.includes('[data-studio-websocket-error="true"]'),'All standalone palette/focus/layout styles are own-marker scoped'))
assert.ok(css.includes('.dark [data-studio-v4-shell="true"][data-studio-websocket-error="true"]'))
assert.ok(css.includes('max-height:min(280px,50dvh)')&&css.includes('overflow-y:auto')&&css.includes('white-space:pre-wrap')&&css.includes('overflow-wrap:anywhere'))
assert.ok(css.includes('flex-shrink:0')&&css.includes(':focus-visible'))
assert.ok(!/useEffect|useState|fetch\(|sendCommand|postMessage|setTimeout|setInterval|location|errorHandler\./.test(leaf),'Pure leaf owns no boundary recovery/manager/transport/timing')
compile(source);checks++
const fixture=fs.readFileSync(new URL('scripts/studio-v4/ten-hour-websocket-error-fixture.tsx',root),'utf8')
const slots=[];let cursor=0
const NativeFallback=()=>null,module={exports:{}}
vm.runInNewContext(compile(fixture),{module,exports:module.exports,require:id=>id==='react'?{...React,useState:initial=>{const index=cursor++;if(!(index in slots))slots[index]=initial;return[slots[index],value=>{slots[index]=value}]}}:id==='@/components/websocket-error-fallback'?{WebSocketErrorFallback:NativeFallback}:require(id)})
const find=(tree,predicate,result=[])=>{if(!tree||typeof tree!=='object')return result;if(predicate(tree))result.push(tree);React.Children.forEach(tree.props?.children,child=>find(child,predicate,result));return result}
const render=()=>{cursor=0;return module.exports.default()}
for(const selected of ['default','short','long']){
 let tree=render();find(tree,node=>node.props['data-studio-websocket-error-specimen-selector']==='true')[0].props.onChange({target:{value:selected}})
 tree=render();const fallback=find(tree,node=>node.type===NativeFallback)[0]
 if(selected==='default')assert.equal(fallback.props.errorDetails,undefined)
 else assert.ok(fallback.props.errorDetails.userMessage.length>0)
 if(selected==='long')assert.ok(fallback.props.errorDetails.userMessage.includes('\n')&&fallback.props.errorDetails.userMessage.length>2000)
 fallback.props.retry();assert.equal(slots[1],true,'Fixture retry only reports explicit local refusal');checks++
}
assert.ok(!/ErrorBoundary|throw |new Error|fetch\(|sendCommand|postMessage|setTimeout|setInterval|location|errorHandler/.test(fixture),'No invented uncaught error, class recovery, transport or acknowledgement')
checks++
console.log(`Studio WebSocket fallback: ${checks} native/classic/callback/lifecycle/style/supplied-fixture checks passed`)
