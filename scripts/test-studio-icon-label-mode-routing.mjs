// Complete actual form + actual API builder/send serialization; synthetic transport only.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import React from 'react'
import ts from 'typescript'
const require=createRequire(import.meta.url),root=new URL('../',import.meta.url)
const packet=new URL('docs/studio-v4/eight-hour-parity-20261005/builder1/icon-label-mode-routing/',root)
const file='components/generation-panel/forms/icon-label-form.tsx'
const current=fs.readFileSync(new URL(file,root),'utf8'),previous=fs.readFileSync(new URL('evidence/before-form.tsx',packet),'utf8')
const selected=process.argv.includes('--before')?previous:current
const copy=value=>JSON.parse(JSON.stringify(value))
function harness({ studio = true, old = false, sourceOverride } = {}) {
  const wireRequests = []; const states = [], refs = [], effects = [], submitted = [], drafts = [], registered = [], mandatory = [], cache = new Map()
  let cursor = 0, refCursor = 0, theme = { mode: 'none', overrides: null }, themeInitialized = false
  const fakeReact = { ...React,
    useState(value) { const i = cursor++; if (!(i in states)) states[i] = typeof value === 'function' ? value() : value; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value }] },
    useRef(value) { const i = refCursor++; if (!(i in refs)) refs[i] = { current: value }; return refs[i] },
    useMemo: fn => fn(), useCallback: fn => fn, useEffect: fn => effects.push(fn),
  }
  const empty = () => null
  const stubs = { react: fakeReact, 'lucide-react': new Proxy({}, { get: () => empty }), '../shared/collapsible-section': { CollapsibleSection: ({ children }) => children },
    '../shared/toggle-row': { ToggleRow: empty }, '../shared/z-index-input': { ZIndexInput: empty },
    '../shared/theme-source-selector': { ThemeSourceSelector: empty }, '../shared/padding-control': { PaddingControl: empty },
    '../shared/use-theme-source-state': { useThemeSourceState: (_, initial) => { if (!themeInitialized) { theme = initial ?? theme; themeInitialized = true } return { themeSource: theme, updateThemeSource: value => { theme = value }, useDeckTheme: theme.mode === 'deck', themeOverrides: theme.overrides } } },
  }
  function load(path, override) {
    if (cache.has(path)) return cache.get(path)
    const module = { exports: {} }
    const result = ts.transpileModule(override ?? fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true } })
    vm.runInNewContext(result.outputText, { module, exports: module.exports, React: fakeReact, console, AbortController, fetch:async(_url,init)=>{wireRequests.push(JSON.parse(init.body));return {ok:true,status:200,json:async()=>({success:true,element:{html:'Synthetic local generated content'}})}}, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: studio ? 'true' : 'false' } }, require: id => id in stubs ? stubs[id] : id.endsWith('.css') ? {} : id.startsWith('@/') ? load(new URL(id.slice(2) + '.ts', root).pathname) : require(id) })
    cache.set(path, module.exports); return module.exports
  }
  const mod = load(new URL(file, root).pathname, sourceOverride ?? (old ? previous : current))
  const catalog = load(new URL('lib/diagram-catalog.ts', root).pathname).DIAGRAM_CATALOG_FALLBACK
  function render(extra = {}) {
    cursor = 0; refCursor = 0; effects.length = 0
    return mod.IconLabelForm({ prompt: 'Local diagram prompt', showAdvanced: true, panelMode: 'refine', presentationId: 'local-fixture', isGenerating: false, registerMandatoryConfig: value => mandatory.push(value), registerSubmit: fn => registered.push(fn), onSubmit: value => submitted.push(value), onDraftChange: value => drafts.push(value), ...extra })
  }
  function effect(fragment) { const fn = effects.find(fn => fn.toString().includes(fragment)); assert.ok(fn, fragment); fn() }
  function report() { effect('iconLabelControls:'); return drafts.at(-1) }
  function submit() { effect('registerSubmit'); registered.at(-1)(); return submitted.at(-1) }
  function picker() { effect('registerMandatoryConfig'); return mandatory.at(-1) }
  return { mod, catalog, render, report, submit, picker, submitted, drafts, effect, async wire(form){ const client=load(new URL('lib/textlabs-client.ts',root).pathname);const payload=client.buildApiPayload('synthetic-generation-session',form);await client.sendMessage(payload.sessionId,payload.message,payload.options);return wireRequests.at(-1) } }
}
function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return null
  if (predicate(tree)) return tree
  for (const child of React.Children.toArray(tree.props?.children)) { const found = find(child, predicate); if (found) return found }
  return null
}
const field = (tree, label) => { const found = find(tree, node => node.props?.label === label); assert.ok(found, label); return found.props }
const buttons = tree => {
  const out = []
  const visit = node => { if (!node || typeof node !== 'object') return; if (node.type === 'button') out.push(node); React.Children.forEach(node.props?.children, visit) }
  visit(tree); return out
}
const words = node => typeof node === 'string' ? node : !node || typeof node !== 'object' ? '' : React.Children.toArray(node.props?.children).map(words).join('')
const button = (tree, name) => { const node = buttons(tree).find(node => words(node) === name); assert.ok(node, name); return node.props }
const input = (tree, name) => { const node = find(tree, node => node.props?.['aria-label'] === name); assert.ok(node, name); return node.props }


const observations=[];let passed=0,failed=0
async function check(name,fn){try{await fn();passed++;observations.push({name,result:'pass'});console.log('PASS '+name)}catch(error){failed++;observations.push({name,result:'fail',reason:error.message});console.error('FAIL '+name+': '+error.message)}}
function form(studio=true,props={}){const h=harness({studio,sourceOverride:selected});const base={prompt:'Kitchen',showAdvanced:true,panelMode:'refine',...props};h.render(base);h.effect('setOperation(previous');h.render(base);return {h,base,mode:value=>{h.picker().find(c=>c.fieldLabel==='Mode').onChange(value);h.render(base)},op:value=>{h.picker().find(c=>c.fieldLabel==='Icon operation').onChange(value);h.render(base)}}}
for(const panelMode of ['generate','edit','refine'])await check('Studio Label '+panelMode+' routes generate despite hidden Icon operation',async()=>{const f=form(true,{panelMode});f.mode('label');assert.equal(f.h.picker().some(c=>c.fieldLabel==='Icon operation'),false);const submitted=f.h.submit();assert.equal(submitted.iconLabelConfig.operation,'generate');const wire=await f.h.wire({...submitted,refine:panelMode==='refine'});assert.equal(wire.icon_label_config.operation,'generate');assert.equal(wire.icon_label_config.mode,'label');assert.equal(wire.message,'Kitchen');assert.equal(wire.refine,panelMode==='refine')})
for(const operation of ['restyle','replace'])await check('Icon '+operation+'→Label→Icon preserves stored Icon intent while Label routes generate',async()=>{const f=form();f.op(operation);f.mode('label');assert.equal(f.h.report().iconLabelControls.operation,operation);assert.equal(f.h.submit().iconLabelConfig.operation,'generate');f.mode('icon');assert.equal(f.h.picker().find(c=>c.fieldLabel==='Icon operation').selectedValue,operation);assert.equal((await f.h.wire(f.h.submit())).icon_label_config.operation,operation)})
for(const operation of ['restyle','replace','generate'])await check('restored Label draft with hidden '+operation+' submits generate and retains raw draft',async()=>{const f=form(true,{initialDraft:{formData:{componentType:'ICON_LABEL',prompt:'Saved Label',count:3,iconLabelConfig:{mode:'label',operation,font:'inter',color:null,exclude_icons:['star']}}}});const submitted=f.h.submit();assert.equal(submitted.iconLabelConfig.operation,'generate');assert.equal(submitted.count,3);assert.equal(submitted.iconLabelConfig.font,'inter');assert.equal(submitted.iconLabelConfig.color,null);assert.deepEqual(copy(submitted.iconLabelConfig.exclude_icons),['star']);assert.equal(submitted.positionConfig.auto_position,false);assert.equal((await f.h.wire(submitted)).icon_label_config.mode,'label')})
await check('Label Reset to Auto preserves routing and releases explicit styles/geometry',async()=>{const f=form();f.op('replace');f.mode('label');let tree=f.h.render(f.base);button(tree,'Reset to Auto').onClick();f.h.render(f.base);const submitted=f.h.submit();assert.equal(submitted.iconLabelConfig.operation,'generate');assert.equal(submitted.iconLabelConfig.mode,'label');for(const name of ['size','style','font','color','stroke_width','exclude_icons','target_background'])assert.equal(submitted.iconLabelConfig[name],undefined);assert.equal(submitted.count,1);assert.equal(f.h.report().iconLabelControls.operation,'replace')})
await check('Icon Edit current and Choose new wire unchanged with Auto and sparse style overrides',async()=>{const f=form();assert.equal((await f.h.wire(f.h.submit())).icon_label_config.operation,'restyle');f.op('replace');f.h.picker().find(c=>c.fieldLabel==='Style').onChange('square-outline');f.h.render(f.base);const wire=await f.h.wire(f.h.submit());assert.equal(wire.icon_label_config.operation,'replace');assert.equal(wire.icon_label_config.style,'square-outline');f.h.picker().find(c=>c.fieldLabel==='Style').onChange('auto');f.h.render(f.base);assert.equal(f.h.submit().iconLabelConfig.style,undefined)})
for(const panelMode of ['generate','edit','refine'])await check('Classic '+panelMode+' Icon/Label exact before payload unchanged',async()=>{for(const mode of ['icon','label']){const a=harness({studio:false,sourceOverride:selected}),b=harness({studio:false,sourceOverride:previous});const props={panelMode,initialDraft:{formData:{componentType:'ICON_LABEL',count:2,prompt:'Classic',iconLabelConfig:{mode,font:'inter',operation:'replace'}}}};for(const h of [a,b]){h.render(props);h.effect('setOperation(previous');h.render(props)}assert.deepEqual(copy(a.submit()),copy(b.submit()));assert.equal(a.report(),undefined)}})
await check('exact UAT ee532fab form also retains hidden restyle for Label refinement',async()=>{const uat=execFileSync('git',['show','ee532fab4b84a6883f8a5b50675ccab692b62240:'+file],{cwd:root,encoding:'utf8'});const h=harness({studio:true,sourceOverride:uat});const props={panelMode:'refine',prompt:'Kitchen'};h.render(props);h.effect('setOperation(previous');h.render(props);h.picker().find(c=>c.fieldLabel==='Mode').onChange('label');h.render(props);assert.equal(h.submit().iconLabelConfig.operation,'restyle')})
await check('whole form changes only explicit Studio Label operation routing',async()=>{const expression="operation: STUDIO_VISUAL_FORMS && mode === 'label' ? 'generate' : operation,";if(!process.argv.includes('--before')){assert.equal(current.split(expression).length-1,1);assert.equal(current.replace(expression,'operation,'),previous)}})
await check('negative control detects Label restyle regression without weakening unrelated source guard',async()=>{
 if(process.argv.includes('--before'))return
 const expression="operation: STUDIO_VISUAL_FORMS && mode === 'label' ? 'generate' : operation,"
 const bad=current.replace(expression,"operation: STUDIO_VISUAL_FORMS && mode === 'label' ? 'restyle' : operation,")
 const h=harness({studio:true,sourceOverride:bad});const props={panelMode:'refine',initialDraft:{formData:{componentType:'ICON_LABEL',iconLabelConfig:{mode:'label'}}}};h.render(props);h.effect('setOperation(previous');h.render(props);assert.throws(()=>assert.equal(h.submit().iconLabelConfig.operation,'generate'))
 const unrelated=current.replace('      count,','      count: count + 1,');assert.throws(()=>assert.equal(unrelated.replace(expression,'operation,'),previous))
})
const backend=execFileSync('python3',['-c',`import ast,json,typing
from pathlib import Path
p=Path(${JSON.stringify(new URL('evidence/backend/chat_routes.py',packet).pathname)})
t=ast.parse(p.read_text());f=next(n for n in t.body if isinstance(n,ast.FunctionDef) and n.name=='_icon_restyle_preflight_error')
ns={'Optional':typing.Optional};exec(compile(ast.Module(body=[f],type_ignores=[]),'frozen-gateway','exec'),ns)
fn=ns['_icon_restyle_preflight_error'];print(json.dumps({'restyle_refine_without_icon':fn(operation='restyle',refine=True,source_icon_name=None),'generate_refine_without_icon':fn(operation='generate',refine=True,source_icon_name=None)}))`],{encoding:'utf8'})
await check('exact unbound gateway actual preflight rejects retained restyle and admits generate without icon identity',async()=>{const result=JSON.parse(backend);assert.ok(result.restyle_refine_without_icon.includes('current icon identity'));assert.equal(result.generate_refine_without_icon,null)})
fs.writeFileSync(new URL(process.argv.includes('--before')?'evidence/before-receipt.json':'evidence/after-receipt.json',packet),JSON.stringify({passed,failed,observations,status:'SOURCE/ISOLATED VERIFIED',limits:'Whole form hook/callback model + actual buildApiPayload/sendMessage local capture + exact unbound gateway pure preflight. No services, native mutation, connected Label resolution or deployed gateway binding.'},null,2)+'\n')
console.log(`${passed} passed; ${failed} failed; source-only whole form/wire cases`);if(failed)process.exitCode=1
