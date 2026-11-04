// Pure actual native toolbar leaf: original guards/callback identity, classic DOM and scoped feedback.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import postcss from 'postcss'

const require = createRequire(import.meta.url), root = new URL('../',import.meta.url)
const file = 'components/presentation-viewer.tsx'
const original = execFileSync('git',['show','82610eb:'+file],{encoding:'utf8',cwd:root})
const viewer = fs.readFileSync(new URL(file,root),'utf8')
const thumbnailInitializer = `  const thumbnailVisibilityInitializedRef = useRef(false)
  useEffect(() => {
    if (thumbnailVisibilityInitializedRef.current) return
    thumbnailVisibilityInitializedRef.current = true
    // Initialize once after hydration; native toggles and later resizing own the choice.
    if (studioShell && window.innerWidth <= 666) setShowThumbnails(false)
  }, [studioShell])
`
assert.equal(viewer.split(thumbnailInitializer).length, 2, 'Exactly one known post-hydration initializer is normalized; its own focused test preserves initialization behavior')
const branch = original.match(/\{saveStatus === 'saving' \|\| isSaving \? \([\s\S]*?\) : null\}/)?.[0]
assert.ok(branch)
// The viewer now includes accepted native navigation/selection/Mode/Present
// ownership and floating-control changes. Pin their full source, while retaining
// the genuine 82610eb branch below as the classic DOM/callback witness.
const acceptedViewer = execFileSync('git',['show','0ed6298:'+file],{encoding:'utf8',cwd:root})
const assertAcceptedViewer = candidate => assert.ok(candidate === acceptedViewer, 'The complete viewer must remain byte-exact to accepted application 0ed6298')
assertAcceptedViewer(viewer)
for (const [before,after] of [
  ['onSave={handleSaveChanges}','onSave={handleFullscreen}'],
  ['disabled={!viewerIsReady}','disabled={false}'],
  ['aria-label="Slide authoring controls"','aria-label="Changed authoring controls"'],
]) {
  assert.ok(viewer.includes(before),'Mutation witness must exercise actual accepted source')
  assert.throws(()=>assertAcceptedViewer(viewer.replace(before,after)),'Unknown handler/gate/markup changes must fail the complete source guard')
}
const leaf = fs.readFileSync(new URL('components/studio-toolbar-save-feedback.tsx',root),'utf8')
const compile = source => {
  const result=ts.transpileModule(source,{reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}})
  assert.deepEqual((result.diagnostics??[]).filter(item=>item.category===ts.DiagnosticCategory.Error),[])
  return result.outputText
}
const cn = (...classes) => classes.filter(Boolean).join(' ')
function load(source,flag) {
  const module={exports:{}}
  vm.runInNewContext(compile(source),{module,exports:module.exports,process:{env:{NEXT_PUBLIC_STUDIO_V4_SHELL:flag}},require:id=>id.endsWith('.css')?{}:id==='@/lib/utils'?{cn}:require(id)})
  return module.exports
}
const Original=load(`import { Save } from 'lucide-react'; import { cn } from '@/lib/utils'; export function Original({saveStatus,isSaving,viewerIsReady,onSave:handleSaveChanges,toolbarButtonClass,toolbarLabelClass}){return (${branch.slice(1,-1)})}`).Original
const buttonClass='flex h-12 min-w-[72px] flex-col items-center justify-center gap-0.5 rounded-md px-3 py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-40', labelClass='text-[10px] font-medium'
let checks=1
for (const flag of [undefined,'false','TRUE','1','true']) {
  const Guide=load(leaf,flag).StudioToolbarSaveFeedback
  for (const status of ['saved','unsaved','saving','error']) for (const busy of [false,true]) for (const ready of [false,true]) {
    let called=0;const callback=()=>{called++}
    const props={saveStatus:status,isSaving:busy,viewerIsReady:ready,onSave:callback,toolbarButtonClass:buttonClass,toolbarLabelClass:labelClass}
    const tree=Guide(props), before=Original(props), html=renderToStaticMarkup(tree)
    if(flag!=='true') assert.equal(html,renderToStaticMarkup(before),'Every classic state/readiness/precedence combination retains native DOM')
    assert.equal(tree?.type,before?.type,'Native hidden/control precedence remains unchanged')
    if(tree?.type==='button') {
      assert.equal(tree.props.onClick,callback,'Exact callback is passed without wrapper/retry substitution')
      assert.equal(tree.props.disabled,!ready)
      assert.equal(tree.props.title,'Save changes now')
      tree.props.onClick(); assert.equal(called,1)
    }
    if(flag==='true'&&tree) {
      assert.equal(tree.props['data-studio-v4-shell'],'true')
      assert.equal(tree.props['data-studio-toolbar-save'],'true')
      assert.equal(tree.props['data-save-state'],busy?'saving':status)
      assert.equal(tree.props['aria-live'],'polite')
      if(busy||status==='saving') {assert.equal(tree.props.role,'status');assert.equal(tree.props['aria-label'],'Saving changes');assert.ok(html.includes('Saving'))}
      else {assert.ok(html.includes(status==='error'?'Save failed':'Unsaved'));assert.equal(tree.props['aria-label'],status==='error'?'Save failed. Save changes now':'Unsaved changes. Save changes now')}
    }
    if(status==='saved'&&!busy) assert.equal(html,'','Native saved state makes no extra success claim/control')
    checks++
  }
}
const css=fs.readFileSync(new URL('components/studio-toolbar-save-feedback.css',root),'utf8')
const parsed=postcss.parse(css)
parsed.walkRules(rule=>{assert.ok(rule.selector.includes('[data-studio-v4-shell="true"][data-studio-toolbar-save="true"]'),'Every palette/focus/motion rule is independently literal-scoped')})
assert.ok(css.includes('height:32px')&&css.includes('max-width:130px')&&css.includes('.dark ')&&css.includes(':focus-visible'))
assert.ok(!/useState|useEffect|sendCommand|forceSave|fetch\(/.test(leaf),'Pure leaf adds no transport/timing/state')
assert.ok(viewer.includes('onSave={handleSaveChanges}'),'Actual viewer retains exact native save action')
assert.ok(viewer.includes('ref={slideContainerRef}\n            data-studio-slide-space={studioShell ? "true" : undefined}\n            data-studio-template-active={studioShell ? String(templateModeOn) : undefined}'),'Slide-space metadata is literal-shell-only and retains actual template state')
checks++
const specimen=fs.readFileSync(new URL('scripts/studio-v4/ten-hour-toolbar-save-fixture.tsx',root),'utf8')
compile(specimen);compile(viewer)
assert.ok(specimen.includes('isGenerating={false}')&&specimen.includes('downloadControls={<StudioToolbarSaveFeedback'))
assert.ok(specimen.includes('value={draft}')&&specimen.includes('onSave={() => setRefused(true)}'))
assert.ok(!/sendCommand|postMessage|fetch\(|localStorage|setTimeout|setInterval/.test(specimen),'Specimen cannot send or fake a save acknowledgement')
checks++
const slots=[],effects=[];let cursor=0
const NativeViewer=()=>null
const module={exports:{}}
const fakeReact={...React,useState:initial=>{const index=cursor++;if(!(index in slots))slots[index]=initial;return [slots[index],value=>{slots[index]=value}]},useEffect:callback=>effects.push(callback)}
vm.runInNewContext(compile(specimen),{module,exports:module.exports,require:id=>id==='react'?fakeReact:id==='@/components/presentation-viewer'?{PresentationViewer:NativeViewer}:id==='@/components/studio-toolbar-save-feedback'?{StudioToolbarSaveFeedback:()=>null}:id.endsWith('.css')?{}:require(id)})
const findViewer=(tree)=>{if(!tree||typeof tree!=='object')return [];const here=tree.type===NativeViewer?[tree]:[];React.Children.forEach(tree.props?.children,child=>here.push(...findViewer(child)));return here}
let tree=module.exports.default()
assert.equal(findViewer(tree).length,0,'SSR/initial hydration does not race the native iframe load listener')
assert.equal(effects.length,1)
effects[0]();cursor=0;tree=module.exports.default()
const native=findViewer(tree)[0]
assert.ok(native,'The actual native viewer mounts only after the client effect')
assert.equal(native.props.presentationUrl,'https://layout-builder-v75-uat.up.railway.app/p/studio-v4-local-renderer')
assert.equal(native.props.isGenerating,false)
assert.equal(native.props.showControls,true)
assert.equal(slots[1],'unsaved','Mounting does not mutate supplied save state')
assert.equal(native.props.downloadControls.props.saveStatus,'unsaved')
checks++
console.log(`Studio toolbar Save: ${checks} isolated state/classic/callback/source/style/specimen checks passed`)
