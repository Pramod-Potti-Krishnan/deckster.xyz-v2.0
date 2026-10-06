import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { readAtlasBaseline } from './atlas-witness-baseline.mjs'
import ts from 'typescript'

// Native callbacks and native confirmation props extracted as AST. No save,
// account or service request is made; deferred results are local test inputs.
const root=new URL('../',import.meta.url), file='components/studio-libraries/themes-workspace.tsx'
const rootURL=root
const currentText=fs.readFileSync(new URL(file,root),'utf8')
const originalText=readAtlasBaseline(`4894987:${file}`)
const parse=text=>ts.createSourceFile('themes.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
const current=parse(currentText), original=parse(originalText)
const baselineOnly=process.argv.includes('--baseline-only')
function find(root,predicate){if(predicate(root))return root;let found;ts.forEachChild(root,n=>{if(!found)found=find(n,predicate)});return found}
const declaration=(root,name)=>{const node=find(root,n=>ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.name.text===name);assert.ok(node,name);return node.initializer}
const print=(node,root)=>ts.createPrinter({removeComments:true}).printNode(ts.EmitHint.Unspecified,node,root)
const canonical=text=>ts.createPrinter({removeComments:true}).printFile(parse(text))
const compile=text=>{const out=ts.transpileModule(text,{fileName:'themes.tsx',reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});assert.equal((out.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);return out.outputText}
const deferred=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j});return{promise,resolve,reject}}
const themeB={id:'saved-B',name:'Theme B',description:'Retained B description',theme_payload:{mode:'custom',primary_hex:'#123456',color_overrides:{accent:'#987654'}}}
const themeA={id:'saved-A',name:'Draft A',theme_payload:{mode:'preset',preset_id:'minimal'}}
let checks=0
const attribute=(node,name)=>node.attributes.properties.find(x=>ts.isJsxAttribute(x)&&x.name.getText()===name)
function harness(root=current,{owner=null,ready=true,flag='true',busy=false,dirty=true,replacePrompt=themeB}={}){
 const events=[],d=deferred(),c={
  name:'Draft A',description:'A description',draft:{...themeA.theme_payload},dirty,mode:'create',themes:[themeB],selectedId:themeB.id,
  replacePrompt,operation:null,canSave:true,busy:{current:busy},mounted:{current:true},listRequest:{current:0},operationRequest:{current:0},draftKey:'local-draft-key',currentDraft:{current:'local-draft-key'},INITIAL_THEME:{mode:'preset',preset_id:'minimal'},
  accountScope:{current:owner===null?null:{owner,ready,current:{current:{owner,ready}}}},accountReady:owner===null||ready,
  process:{env:{NEXT_PUBLIC_STUDIO_V4_SHELL:flag}},studioShell:flag==='true',
  saveTheme:args=>{events.push(['save',JSON.parse(JSON.stringify(args))]);return d.promise},
 }
 for(const [setter,key]of[['setName','name'],['setDescription','description'],['setDraft','draft'],['setDirty','dirty'],['setMode','mode'],['setThemes','themes'],['setSelectedId','selectedId'],['setNotice','notice'],['setActionError','actionError'],['setLoading','loading'],['setOperation','operation'],['setCompareBase','compareBase'],['setReplacePrompt','replacePrompt']])c[setter]=value=>{c[key]=typeof value==='function'?value(c[key]):value;events.push([setter,c[key]])}
 const confirm=find(root,n=>ts.isJsxAttribute(n)&&n.name.getText(root)==='onClick'&&n.initializer?.getText(root).includes('loadDraft(replacePrompt)'))
 assert.ok(confirm,'Native Discard & continue button')
 const keep=find(root,n=>ts.isJsxAttribute(n)&&n.name.getText(root)==='onClick'&&n.initializer?.getText(root).includes('setReplacePrompt(null)'))
 assert.ok(keep,'Native Keep draft button')
 const opening=confirm.parent.parent,confirmDisabled=attribute(opening,'disabled'),keepDisabled=attribute(keep.parent.parent,'disabled')
 // Execute the leaf's actual account callbacks using the actual helper guards.
 // Null is the historical outside-provider fixture; explicit owner fixtures below
 // exercise current ready/retired refusal without changing original race cases.
 const helperModule={exports:{}}
 const helperText=fs.readFileSync(new URL('components/studio-libraries/library-account-boundary.tsx',rootURL),'utf8')
 vm.runInNewContext(compile(helperText),{module:helperModule,exports:helperModule.exports,require:id=>id==='react'?{createContext:()=>({})}:id==='react/jsx-runtime'?{}:id==='@/hooks/use-auth'?{}:assert.fail(id)})
 Object.assign(c,{libraryAccountCanStart:helperModule.exports.libraryAccountCanStart,libraryAccountIsCurrent:helperModule.exports.libraryAccountIsCurrent})
 const script=[...['accountCanStart','accountIsCurrent'].map(name=>`globalThis.${name}=${print(declaration(current,name),current)};`),...['loadDraft','requestDraft','save'].map(name=>`globalThis.${name}=${print(declaration(root,name),root)};`),
  `globalThis.discard=${print(confirm.initializer.expression,root)};globalThis.keep=${print(keep.initializer.expression,root)};`,
  `globalThis.confirmDisabled=()=>${confirmDisabled?.initializer&&ts.isJsxExpression(confirmDisabled.initializer)?print(confirmDisabled.initializer.expression,root):'false'};`,
  `globalThis.keepDisabled=()=>${keepDisabled?.initializer&&ts.isJsxExpression(keepDisabled.initializer)?print(keepDisabled.initializer.expression,root):'false'};`].join('\n')
 vm.runInNewContext(compile(script),c)
 return{c,events,d}
}
// Actual baseline sequence, including a pre-opened native replacement prompt.
{
 const h=harness(original),pending=h.c.save();assert.equal(h.c.operation,'save');assert.equal(h.c.confirmDisabled(),false)
 h.c.discard();assert.equal(h.c.name,'Theme B copy');assert.equal(h.c.dirty,true)
 h.d.resolve(themeA);await pending;assert.equal(h.c.name,'Theme B copy');assert.equal(h.c.dirty,false);assert.equal(h.c.mode,'library');assert.equal(h.c.selectedId,'saved-A');checks++
}
// Normal current save/refusal, actual native payload, guards and Keep draft.
for(const root of [original,current]){
 for(const result of [themeA,null,{id:'unconfirmed'}]){
  const h=harness(root),pending=h.c.save();assert.deepEqual(h.events.find(e=>e[0]==='save')[1],{name:'Draft A',description:'A description',theme:{mode:'preset',preset_id:'minimal'},setStandard:false})
  h.d.resolve(result);await pending
  assert.equal(h.c.operation,null);assert.equal(h.c.busy.current,false)
  if(result===themeA){assert.equal(h.c.dirty,false);assert.equal(h.c.mode,'library');assert.equal(h.c.selectedId,'saved-A');assert.match(h.c.notice,/saved to your library/)}
  else{assert.equal(h.c.dirty,true);assert.equal(h.c.name,'Draft A');assert.match(h.c.actionError,/save was not confirmed/)}checks++
 }
 const h=harness(root),pending=h.c.save();assert.equal(h.c.keepDisabled(),false);h.c.keep();assert.equal(h.c.replacePrompt,null);assert.equal(h.c.name,'Draft A');assert.equal(h.c.dirty,true)
 h.d.resolve(null);await pending;assert.equal(h.c.dirty,true);checks++
 for(const extra of[{busy:true},{canSave:false}]){const h=harness(root);Object.assign(h.c,extra.busy?{busy:{current:true}}:extra);await h.c.save();assert.equal(h.events.length,0);checks++}
}
// Outside busy work, native copy/blank replacement and dirty-prompt behavior
// remain available. Copy keeps all native colors and clones explicit overrides.
for(const root of [original,current]){
 for(const source of[themeB,'blank']){
  const h=harness(root);h.c.loadDraft(source)
  assert.equal(h.c.mode,'create');assert.equal(h.c.replacePrompt,null)
  assert.equal(h.c.dirty,source!=='blank');assert.equal(h.c.name,source==='blank'?'':'Theme B copy')
  if(source!=='blank'){assert.equal(h.c.description,themeB.description);assert.notEqual(h.c.draft,themeB.theme_payload);assert.notEqual(h.c.draft.color_overrides,themeB.theme_payload.color_overrides);assert.deepEqual(JSON.parse(JSON.stringify(h.c.draft.color_overrides)),themeB.theme_payload.color_overrides)}checks++
 }
 const h=harness(root,{replacePrompt:null});h.c.requestDraft(themeB);assert.equal(h.c.replacePrompt,themeB);assert.equal(h.c.name,'Draft A');checks++
 const clean=harness(root,{dirty:false,replacePrompt:null});clean.c.requestDraft(themeB);assert.equal(clean.c.name,'Theme B copy');checks++
}
// Server route remains default-off and legacy users cannot invoke this Studio
// leaf through the existing route for absent/nonliteral public flags.
{
 const access=fs.readFileSync(new URL('components/studio-libraries/access.ts',root),'utf8')
 for(const flag of[undefined,'false','TRUE','1','true']){
  const mod={exports:{}},c={module:mod,exports:mod.exports,process:{env:{NEXT_PUBLIC_STUDIO_V4_SHELL:flag}},require:name=>{assert.equal(name,'next/navigation');return{notFound:()=>{throw new Error('Native route unavailable')}}}}
  vm.runInNewContext(compile(access),c)
  if(flag==='true')mod.exports.requireStudioLibraryAccess();else assert.throws(()=>mod.exports.requireStudioLibraryAccess(),/Native route unavailable/);checks++
 }
}
// Atlas receipt/lifetime corrections intentionally change save/standard.
// Keep the earlier replacement race witness and all exact unaffected controls.
// Undo only reviewed busy/account guards for the historical equality anchor.
// The current callbacks above still execute these guards in every behavior case.
// Exact read try/catch is separately exercised by account-boundary refusal replay.
assert.equal(currentText.split('if (!mounted.current || !accountIsCurrent()) return; ').length - 1,3,'Only patchDraft/name/description guards normalized')
const restored=currentText
 .replace("    // A previously opened confirmation can outlive the click that starts save.\n    if (!mounted.current || !accountCanStart() || busy.current) return\n",'')
 .replace("const requestDraft = (source: SavedThemeProfile | 'blank') => { if (!mounted.current || !accountCanStart() || busy.current) return; if (dirty)","const requestDraft = (source: SavedThemeProfile | 'blank') => { if (dirty)")
 .replaceAll('if (!mounted.current || !accountIsCurrent()) return; ', '')
 .replace("    if (!mounted.current || !accountCanStart()) return\n    const requestAccount = accountScope.current\n",'')
 .replace('    libraryRequested.current = true\n','')
 .replace('    let response\n    try { response = await listThemes() } catch { response = null }','    const response = await listThemes()')
 .replace('if (!mounted.current || request !== listRequest.current || !accountIsCurrent(requestAccount)) return','if (!mounted.current || request !== listRequest.current) return')
const restoredAst=parse(restored)
for(const name of['loadDraft','requestDraft','patchDraft','changePreset','setOverride','refresh']){
 assert.equal(print(declaration(restoredAst,name),restoredAst),print(declaration(original,name),original),name+' remains exact apart from reviewed busy/owner/read-refusal guards');checks++
}
const fields=root=>find(root,n=>ts.isJsxElement(n)&&n.openingElement.tagName.getText()==='fieldset')
assert.equal(print(fields(restoredAst),restoredAst),print(fields(original),original),'Every original editable field and option remains exact after only text owner guards');checks++
assert.equal(canonical(currentText.match(/const INITIAL_THEME[^\n]*/)[0]),canonical(originalText.match(/const INITIAL_THEME[^\n]*/)[0]));checks++
if(!baselineOnly){
 // Red until the reviewed application guard is implemented. Test invokes an
 // already-captured callback as well as the native disabled expression, so it
 // cannot pass merely by disabling the button after React eventually renders.
 for(const result of[themeA,null])for(const source of[themeB,'blank']){
  const h=harness(current,{replacePrompt:source}),captured=h.c.discard,pending=h.c.save()
  assert.equal(h.c.confirmDisabled(),true,'Native pending save disables destructive confirmation')
  const before=JSON.stringify(h.events);captured();assert.equal(JSON.stringify(h.events),before,'Captured discard cannot replace an in-flight draft')
  h.c.requestDraft(themeB);h.c.loadDraft(themeB);assert.equal(JSON.stringify(h.events),before,'Both native entry paths refuse busy replacement')
  h.d.resolve(result);await pending
  assert.equal(h.c.name,'Draft A');assert.equal(h.c.dirty,result!==themeA);checks++
 }
 // Once the operation settles, the original confirmation remains actionable.
 const h=harness(current),pending=h.c.save();h.d.resolve(null);await pending
 assert.equal(h.c.confirmDisabled(),false);h.c.discard();assert.equal(h.c.name,'Theme B copy');assert.equal(h.c.dirty,true);checks++
 // Busy ref guards synchronous queued replacement before operation state can
 // render. Keep draft is still an intentional non-destructive cancellation.
 const busy=harness(current,{busy:true});assert.equal(busy.c.confirmDisabled(),false,'Button state follows native operation; immediate safety comes from ref guard')
 const before=JSON.stringify(busy.events);busy.c.discard();busy.c.requestDraft('blank');assert.equal(JSON.stringify(busy.events),before);busy.c.keep();assert.equal(busy.c.replacePrompt,null);checks++
}
// Current owner fixture: captured replacement/save starts refuse live loading,
// and a retired owner refuses even before mounted cleanup.
for(const retirement of ['loading','other-owner','missing-owner']){
 const h=harness(current,{owner:'account-A'}),save=h.c.save,copy=h.c.loadDraft,request=h.c.requestDraft
 h.c.accountScope.current.current.current=retirement==='loading'?{owner:'account-A',ready:false}:{owner:retirement==='other-owner'?'account-B':null,ready:true}
 const before=JSON.stringify(h.events);await save();copy(themeB);request('blank');assert.equal(JSON.stringify(h.events),before);checks++
}
console.log(`Theme draft ownership: ${checks} actual-callback offline checks passed${baselineOnly?'; baseline/preparation mode; pending regression intentionally not waived for default run':''}; baseline4894987 race reproduced; no network/save ACK.`)
