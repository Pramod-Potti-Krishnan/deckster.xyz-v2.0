import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import ts from 'typescript'

// Preparation only. Root owns the static server/browser and all native observations.
const require = createRequire(import.meta.url)
const root = path.resolve(new URL('..', import.meta.url).pathname)
const out = path.join(root, 'docs/studio-v4/connected-intros-20261004/evidence')
const read = name => fs.readFileSync(path.join(root, name), 'utf8')
const hash = value => crypto.createHash('sha256').update(value).digest('hex')
function compile(source, name) {
  const result = ts.transpileModule(source, {fileName:name,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}})
  assert.equal(result.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length??0,0,`Syntax diagnostics in ${name}`)
  return result.outputText
}
const product = {
  '@/components/builder/studio-introduction':'components/builder/studio-introduction.tsx',
  '@/components/studio-about-dialog':'components/studio-about-dialog.tsx',
  '@/components/ui/dialog':'components/ui/dialog.tsx',
  '@/components/workspace-intro/workspace-intro':'components/workspace-intro/workspace-intro.tsx',
  '@/components/workspace-intro/scene':'components/workspace-intro/scene.tsx',
  '@/components/studio-intro-replay':'components/studio-intro-replay.tsx',
  '@/components/builder/studio-welcome-stage':'components/builder/studio-welcome-stage.tsx',
  '@/lib/studio-intro-eligibility':'lib/studio-intro-eligibility.ts',
  '@/lib/utils':'lib/utils.ts',
}
const stylePaths = ['components/workspace-intro/workspace-intro.css','components/workspace-intro/scene.css','components/builder/studio-introduction.css','components/builder/studio-canvas.css','components/studio-about-dialog.css','components/studio-onboarding.css']
const adapters = {
  'next/link':`const React=require('react');exports.__esModule=true;exports.default=p=>React.createElement('a',{...p,title:'Isolated fixture: product navigation is not mounted',onClick:e=>e.preventDefault()});`,
  '@/components/onboarding-modal':`exports.OnboardingModal=()=>{throw Error('Fixture cannot mount the generic guide; use the actual cinematic provider');};`,
}
const records = new Map()
let nextId = 0
const canonical = file => fs.realpathSync(file)
function add(key, source, file, local=false) {
  if(records.has(key))return records.get(key).id
  const record = {id:nextId++,source,file,local,deps:{}}
  records.set(key,record)
  const ast=ts.createSourceFile(file||key,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS)
  function visit(node) {
    if(ts.isCallExpression(node)&&node.expression.getText(ast)==='require') {
      assert.equal(node.arguments.length,1,`Unexpected require arity in ${key}`)
      assert.ok(ts.isStringLiteral(node.arguments[0]),`Dynamic require is unsupported in ${key}`)
      const spec=node.arguments[0].text
      if(!(spec in record.deps))record.deps[spec]=resolve(spec,file,local)
    }
    ts.forEachChild(node,visit)
  }
  visit(ast)
  return record.id
}
function resolve(spec, parentFile, local) {
  if(spec.endsWith('.css'))return add('adapter:css','module.exports={};',null)
  if(spec in adapters)return add('adapter:'+spec,adapters[spec],null,true)
  if(spec in product) {
    const file=canonical(path.join(root,product[spec]))
    return add(file,compile(fs.readFileSync(file,'utf8'),file),file,true)
  }
  if(local && spec.startsWith('.')) {
    const relative=path.resolve(path.dirname(parentFile),spec)
    const file=[relative,relative+'.tsx',relative+'.ts',relative+'.js'].find(f=>fs.existsSync(f)&&fs.statSync(f).isFile())
    assert.ok(file,`Unknown local module ${spec} from ${parentFile}`)
    const real=canonical(file)
    return add(real,/\.tsx?$/.test(file)?compile(fs.readFileSync(real,'utf8'),real):fs.readFileSync(real,'utf8'),real,true)
  }
  assert.ok(!spec.startsWith('@/'),`Unmapped application dependency ${spec}`)
  const file=canonical(require.resolve(spec,{paths:[parentFile?path.dirname(parentFile):root]}))
  assert.ok(!file.endsWith('.mjs'),`ESM dependency needs explicit handling: ${spec}`)
  if(file.endsWith('.json'))return add(file,'module.exports='+fs.readFileSync(file,'utf8'),file)
  return add(file,fs.readFileSync(file,'utf8'),file)
}
const fixtureSource = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { StudioIntroductionProvider, StudioIntroductionButton, useStudioAboutReplay, useStudioIntroduction } from '@/components/builder/studio-introduction';
import { StudioAboutDialog } from '@/components/studio-about-dialog';
import { StudioWelcomeStage } from '@/components/builder/studio-welcome-stage';
const baseline='Synthetic pristine draft retained by the working child';
const trace=[];
let start=performance.now();
function observe(label){trace.push({ms:Math.round(performance.now()-start),label});const output=document.querySelector('[data-radix-trace]');if(output)output.textContent=trace.map((r,i)=>(i+1)+'. '+r.ms+'ms '+r.label).join('\\n');}
function clearTrace(){trace.length=0;start=performance.now();const output=document.querySelector('[data-radix-trace]');if(output)output.textContent='Trace cleared; open About then use its Replay action.';}
document.addEventListener('focusin',event=>{const target=event.target;if(target?.getAttribute?.('data-fixture-account')==='true')observe('account received focus');if(target?.getAttribute?.('aria-label')==='Skip introduction'){observe('actual cinematic portal present; open Radix dialogs: '+document.querySelectorAll('[role="dialog"][data-state="open"]').length);observe('Skip received focus');}});
function WorkingChild({build,setBuild,error,setError,dirty,setDirty}) {
 const [aboutOpen,setAboutOpen]=React.useState(false),[draft,setDraft]=React.useState(baseline),[selection,setSelection]=React.useState('synthetic-slide-2'),[clicks,setClicks]=React.useState(0),[riskOnClose,setRiskOnClose]=React.useState('none');
 const account=React.useRef(null),iframe=React.useRef(null),mounts=React.useRef(0),previousFrame=React.useRef(null);
 const intro=useStudioIntroduction();
 const onOpenChange=React.useCallback(open=>{if(!open){observe('About close requested');if(riskOnClose==='build')setBuild(true);if(riskOnClose==='error')setError(true);if(riskOnClose==='dirty'){setDirty(true);setDraft('Synthetic intervening unsent draft');}}setAboutOpen(open)},[riskOnClose,setBuild,setError,setDirty]);
 const about=useStudioAboutReplay({onOpenChange,restoreFocus:()=>{account.current?.focus();observe('actual About hook restored account focus');}});
 React.useEffect(()=>{mounts.current++;document.querySelector('[data-working-mounts]').textContent=String(mounts.current);observe('working child mounted '+mounts.current+' time(s)');},[]);
 React.useEffect(()=>{if(previousFrame.current){observe(previousFrame.current===iframe.current?'synthetic iframe DOM identity retained; intro active: '+String(intro?.active):'WARNING: synthetic iframe DOM identity changed');}previousFrame.current=iframe.current;},[intro?.active]);
 return <>
  <header data-studio-v4-shell-header>
   <StudioIntroductionButton persistent className="studio-header-intro-replay"/>
   <button ref={account} data-fixture-account="true" onClick={()=>setAboutOpen(true)}>About Studio</button>
   <button onClick={clearTrace}>Clear observation trace</button>
   <button onClick={()=>setBuild(v=>!v)}>{build?'Clear synthetic build risk':'Set synthetic build risk'}</button>
   <button onClick={()=>setError(v=>!v)}>{error?'Clear synthetic error risk':'Set synthetic error risk'}</button>
   <button onClick={()=>{setDraft(baseline);setDirty(false);}}>Restore pristine draft</button>
   <label>Risk arriving on About close<select aria-label="Risk arriving on About close" value={riskOnClose} onChange={e=>setRiskOnClose(e.target.value)}><option value="none">None</option><option value="build">New synthetic build</option><option value="error">New synthetic error</option><option value="dirty">New synthetic dirty draft</option></select></label>
   <button onClick={()=>document.documentElement.classList.toggle('dark')}>Light / dark</button>
  </header>
  <aside className="fixture-observation"><strong>Actual Radix / isolated source fixture</strong><p>Build: {String(build)} · Error: {String(error)} · Dirty: {String(dirty)} · Replay enabled: {String(intro?.enabled)} · Active: {String(intro?.active)}</p><p>Working child mounts: <output data-working-mounts>0</output> · Existing control calls: {clicks}</p><pre data-radix-trace aria-live="polite">Use Clear observation trace, then open About.</pre></aside>
  <main data-studio-v4-shell="true" data-studio-v4-shell-workspace>
   <div data-studio-intro-surface="builder">
    <p>This is an isolated synthetic working surface, not Builder, Layout, account data or connected acceptance.</p>
    <StudioWelcomeStage studioIntroReplay={<StudioIntroductionButton className="fixture-pane-replay"/>}/>
    <label>Persistent synthetic draft<input aria-label="Persistent synthetic draft" value={draft} onChange={e=>{setDraft(e.target.value);setDirty(e.target.value!==baseline)}}/></label>
    <label>Persistent synthetic selection<select aria-label="Persistent synthetic selection" value={selection} onChange={e=>setSelection(e.target.value)}><option>synthetic-slide-1</option><option>synthetic-slide-2</option></select></label>
    <iframe ref={iframe} title="Persistent synthetic iframe" src="about:blank#radix-synthetic-final"/>
    <button onClick={()=>setClicks(v=>v+1)}>Existing synthetic control</button>
   </div>
  </main>
  <StudioAboutDialog open={aboutOpen} onOpenChange={onOpenChange} onCloseAutoFocus={about.onCloseAutoFocus} onReplay={about.requestFromAbout} replayEnabled={about.intro?.availableIgnoringOwnAboutModal}/>
 </>
}
function App(){const[build,setBuild]=React.useState(false),[error,setError]=React.useState(false),[dirty,setDirty]=React.useState(false);return <StudioIntroductionProvider enabled eligibility={{workspaceReady:true,initialEntry:false,activeBuild:build,decisionPending:false,errorPresent:error,modalOpen:false,dirtyDraft:dirty,workInFlight:false}}><WorkingChild build={build} setBuild={setBuild} error={error} setError={setError} dirty={dirty} setDirty={setDirty}/></StudioIntroductionProvider>}
window.fetch=()=>{throw Error('Isolated Radix fixture refuses fetch')};window.WebSocket=function(){throw Error('Isolated Radix fixture refuses WebSocket')};
createRoot(document.getElementById('root')).render(<App/>);
`
const entry=add('fixture-entry',compile(fixtureSource,'radix-fixture.tsx'),path.join(root,'scripts/radix-fixture.tsx'),true)
const checks=[]
function verify(name, condition){assert.ok(condition,name);checks.push({name,pass:true})}
const moduleFor=file=>records.get(canonical(path.join(root,file)))
const reactMain=canonical(require.resolve('react'))
const reactDomMain=canonical(require.resolve('react-dom'))
const reactIds=new Set([...records.values()].flatMap(r=>Object.entries(r.deps).filter(([name])=>name==='react').map(([,id])=>id)))
const domIds=new Set([...records.values()].flatMap(r=>Object.entries(r.deps).filter(([name])=>name==='react-dom').map(([,id])=>id)))
verify('All package and application React imports share the installed canonical React module',reactIds.size===1&&reactIds.has(records.get(reactMain).id))
verify('All ReactDOM imports share the installed canonical ReactDOM module',domIds.size===1&&domIds.has(records.get(reactDomMain).id))
const radixFile=canonical(require.resolve('@radix-ui/react-dialog'))
verify('Actual UI Dialog imports actual installed Radix Dialog',moduleFor('components/ui/dialog.tsx').deps['@radix-ui/react-dialog']===records.get(radixFile).id)
verify('Actual About imports actual UI Dialog rather than a synthetic dialog adapter',moduleFor('components/studio-about-dialog.tsx').deps['@/components/ui/dialog']===moduleFor('components/ui/dialog.tsx').id)
verify('Provider and generic cinematic wrapper share the same actual WorkspaceIntro module',moduleFor('components/builder/studio-introduction.tsx').deps['@/components/workspace-intro/workspace-intro']===moduleFor('components/studio-intro-replay.tsx').deps['@/components/workspace-intro/workspace-intro'])
verify('No Radix, React, ReactDOM or product focus hook module is an adapter',[...records.keys()].filter(key=>key.startsWith('adapter:')).every(key=>['adapter:css','adapter:next/link','adapter:@/components/onboarding-modal'].includes(key)))
const bundle=`(()=>{const process={env:{NODE_ENV:'development',NEXT_PUBLIC_STUDIO_V4_SHELL:'true'}};const cache={};const modules={${[...records.values()].map(r=>JSON.stringify(r.id)+':[function(module,exports,require){\n'+r.source+'\n},'+JSON.stringify(r.deps)+']').join(',')}};function load(id){if(cache[id])return cache[id].exports;const descriptor=modules[id];if(!descriptor)throw Error('Unknown fixture module '+id);const module={exports:{}};cache[id]=module;descriptor[0](module,module.exports,name=>{if(!(name in descriptor[1]))throw Error('Unbundled fixture require '+name);return load(descriptor[1][name])});return module.exports}load(${entry});})();`
new vm.Script(bundle,{filename:'radix-browser.js'});checks.push({name:'Full browser bundle parses without syntax errors',pass:true})
const fixtureHash=hash(bundle)
const css=stylePaths.map(read).join('\n')
const supportCss=`
body{margin:0;font:14px Arial;background:#e9f0ed;color:#203739}header{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px;min-height:72px}button{padding:7px 10px;cursor:pointer}button:disabled{cursor:default;opacity:.45}label{display:inline-flex;gap:8px;align-items:center}select,input{padding:6px}.fixture-observation{position:absolute;left:10px;top:120px;width:310px;bottom:10px;overflow:auto}pre{white-space:pre-wrap;font:12px/1.6 monospace}main{position:absolute;left:340px;top:120px;right:10px;bottom:10px;overflow:auto;background:white;padding:12px;--ss-text:#203739;--ss-muted:#617a76;--ss-line:#d6e1dc;--ss-panel:#f4f8f6;--ss-accent:#7358ba}main input{min-width:300px}main iframe{display:block;width:90%;height:80px}main .studio-welcome-stage{width:min(100%,620px);box-sizing:border-box}main label{display:flex;margin:8px}main button{margin:8px}.dark body{background:#141c1e;color:#dce7e2}.dark main{background:#222d30;--ss-text:#dce7e2;--ss-muted:#a2b8b0;--ss-line:#334245;--ss-panel:#222d30}button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #8a70d3;outline-offset:2px}
/* Compatibility styling only: real Radix Portal/Presence/FocusScope remain unchanged. */
[data-radix-popper-content-wrapper]{z-index:50}[data-state][role=dialog]{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:50;width:min(560px,calc(100vw - 60px));box-sizing:border-box;background:white;padding:24px;border-radius:10px;box-shadow:0 12px 60px #142b2466}.dark [data-state][role=dialog]{background:#222d30;color:#dce7e2}[data-state][role=dialog]>button:last-child{position:absolute;right:10px;top:10px}[data-state][role=dialog] .sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}.fixed.inset-0{position:fixed;inset:0;z-index:49;background:#0009}[data-state=open][role=dialog]{animation:fixture-dialog-open .2s ease-out}[data-state=closed][role=dialog]{animation:fixture-dialog-close .2s ease-in}[data-state=closed].fixed.inset-0{animation:fixture-overlay-close .2s ease-in}
@keyframes fixture-dialog-open{from{opacity:0}to{opacity:1}}@keyframes fixture-dialog-close{from{opacity:1}to{opacity:0}}@keyframes fixture-overlay-close{from{opacity:1}to{opacity:0}}@media(prefers-reduced-motion:reduce){[data-state][role=dialog],[data-state].fixed.inset-0{animation:none!important}}`
const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="radix-fixture-source-sha256" content="${fixtureHash}"><title>Isolated actual Radix About replay proof</title><style>${css}\n${supportCss}</style></head><body><div id="root"></div><script src="radix-browser.js"></script></body></html>`
fs.mkdirSync(out,{recursive:true})
fs.writeFileSync(path.join(out,'radix-browser.js'),bundle)
fs.writeFileSync(path.join(out,'radix-browser.html'),html)
const localSources={...Object.fromEntries(Object.values(product).map(file=>[file,hash(read(file))])),...Object.fromEntries(stylePaths.map(file=>[file,hash(read(file))]))}
const dependencySources=[...records.values()].filter(r=>r.file&&!r.local).map(r=>({path:path.relative(root,r.file),sha256:hash(fs.readFileSync(r.file))}))
const receipt={level:'preparation/source/dependency bundling only; browser proof belongs to lead',actualRadix:true,syntheticDialogAdapter:false,actualProductHooks:true,wholeBuilderRouterMounted:false,realLayout:false,accountOrServicesUsed:false,browserOrServerStarted:false,fixtureHash,bundleBytes:Buffer.byteLength(bundle),moduleCount:records.size,preparationChecks:checks,adapters:['inert next/link navigation','generic onboarding guide refuses mounting','CSS import no-op; product CSS plus explicit fixture compatibility styles'],focusTrace:'DOM focus observation records account focus, then portal existence/no open Radix dialog at Skip focus; it does not observe or fabricate the private replay counter',sha256:{...localSources,'scripts/test-studio-intro-radix-browser.mjs':hash(read('scripts/test-studio-intro-radix-browser.mjs')),'radix-browser.html':hash(html),'radix-browser.js':fixtureHash},dependencies:dependencySources}
fs.writeFileSync(path.join(out,'radix-source-receipt.json'),JSON.stringify(receipt,null,2)+'\n')
console.log(checks.length+' preparation/dependency identity checks pass; no native focus result claimed.');
console.log(`Actual Radix fixture prepared: ${records.size} modules, ${Buffer.byteLength(bundle)} bytes; source syntax and static dependency resolution pass. No browser/server/service started.`)
