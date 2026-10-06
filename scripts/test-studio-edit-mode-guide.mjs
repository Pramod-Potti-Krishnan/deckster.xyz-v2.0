// Actual pure native leaf + exact classic SSR, viewer gate/source and bounded scoped styles.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import postcss from 'postcss'

const require = createRequire(import.meta.url), root = new URL('../', import.meta.url)
const file = 'components/presentation-viewer.tsx'
const viewer = fs.readFileSync(new URL(file, root), 'utf8')
const thumbnailInitializer = `  const thumbnailVisibilityInitializedRef = useRef(false)
  useEffect(() => {
    if (thumbnailVisibilityInitializedRef.current) return
    thumbnailVisibilityInitializedRef.current = true
    // Initialize once after hydration; native toggles and later resizing own the choice.
    if (studioShell && window.innerWidth <= 666) setShowThumbnails(false)
  }, [studioShell])
`
assert.equal(viewer.split(thumbnailInitializer).length, 2, 'Exactly one known post-hydration initializer is normalized; its own focused test preserves initialization behavior')
const original = execFileSync('git',['show','0ad191f:'+file],{encoding:'utf8',cwd:root})
const originalGuide = original.match(/\{isEditMode && !isFullscreen && \(\s*([\s\S]*?)\s*\)\}/)?.[1]
assert.ok(originalGuide, 'Native original edit/fullscreen gate is found')
const originalBranch = original.match(/\{isEditMode && !isFullscreen && \([\s\S]*?\)\}/)[0]
const originalSaveBranch = original.match(/\{saveStatus === 'saving' \|\| isSaving \? \([\s\S]*?\) : null\}/)[0]
const restored = viewer.replace(thumbnailInitializer, '')
  .replace("import { EditModeGuide } from './edit-mode-guide'\n",'')
  .replace("import { StudioToolbarSaveFeedback } from './studio-toolbar-save-feedback'\n",'').replace(' data-studio-generation-cover={studioShell && !isFullscreen ? "true" : undefined}','').replace(/ +aria-current=\{studioShell && activeVersion === '(?:blank|strawman|final)' \? 'true' : undefined\}\n/g,'')
  .replace(/<StudioToolbarSaveFeedback[\s\S]*?\/>/,originalSaveBranch)
  .replace(/            data-studio-slide-space=\{studioShell \? "true" : undefined\}\n            data-studio-template-active=\{studioShell \? String\(templateModeOn\) : undefined\}\n/,'')
  .replace(/\{isEditMode && !isFullscreen && !studioShell && \(\s*<EditModeGuide \/>\s*\)\}/, originalBranch)
  .replace(/          \{\/\* Studio edit guidance has its own row outside the fitted slide\. \*\/\}\n          \{studioShell && isEditMode && !isFullscreen && \(\s*<EditModeGuide \/>\s*\)\}\n\n/,'')
const canonical = source => ts.createPrinter({removeComments:true}).printFile(ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX))
assert.equal(canonical(restored),canonical(original),'Whole native viewer source is AST-exact after reversing the leaf-only extraction')
const leaf = fs.readFileSync(new URL('components/edit-mode-guide.tsx',root),'utf8')
const css = fs.readFileSync(new URL('components/studio-edit-mode-guide.css',root),'utf8')
const compile = source => {
  const result = ts.transpileModule(source,{reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}})
  assert.deepEqual((result.diagnostics??[]).filter(item=>item.category===ts.DiagnosticCategory.Error),[])
  return result.outputText
}
function load(source, flag) {
  const module = {exports:{}}
  vm.runInNewContext(compile(source),{module,exports:module.exports,process:{env:{NEXT_PUBLIC_STUDIO_V4_SHELL:flag}},require:id=>id.endsWith('.css')?{}:require(id)})
  return module.exports
}
const Original = load('export function Original(){return ('+originalGuide+')}').Original
const classic = renderToStaticMarkup(React.createElement(Original))
let checks = 1
for (const flag of [undefined,'false','TRUE','1','']) {
  const Guide = load(leaf,flag).EditModeGuide
  assert.equal(renderToStaticMarkup(React.createElement(Guide)),classic,'Literal-off classic native DOM is exact')
  checks++
}
const Guide = load(leaf,'true').EditModeGuide, tree = Guide(), html = renderToStaticMarkup(tree)
assert.equal(tree.props['data-studio-edit-guide'],'true')
assert.equal(tree.props.role,'region')
assert.equal(tree.props['aria-label'],'Edit mode instructions')
assert.equal(tree.props.tabIndex,0)
assert.equal(tree.props.className,Original().props.className)
assert.equal(html.replace(/<[^>]+>/g,''),classic.replace(/<[^>]+>/g,''),'Every original instruction and shortcut is retained')
assert.ok(!html.includes('<button')&&!html.includes('<input'),'Guide introduces no command/action controls')
checks++
const parsed = postcss.parse(css)
for (const rule of parsed.nodes.filter(node=>node.type==='rule')) assert.ok(rule.selector.includes('[data-studio-edit-guide="true"]'),'Every style is independently literal-marker-scoped')
const main = parsed.nodes.find(node=>node.selector==='[data-studio-edit-guide="true"]')
const declarations = Object.fromEntries(main.nodes.map(node=>[node.prop,node.value]))
assert.equal(declarations['max-height'],'min(88px,40%)')
assert.equal(declarations['overflow-y'],'auto')
assert.equal(declarations['font-size'],'11px')
assert.equal(declarations['overscroll-behavior'],'contain')
assert.equal(declarations['pointer-events'],'auto')
assert.equal(declarations.position,'relative','Studio guide allocates its own row outside the fitted iframe')
assert.equal(declarations['flex-shrink'],'0')
assert.equal(declarations.bottom,'auto')
assert.equal(declarations['z-index'],undefined,'No overlay layer intercepts slide bottom-edge targets')
assert.ok(viewer.indexOf('{studioShell && isEditMode && !isFullscreen && (') > viewer.indexOf('{isEditMode && !isFullscreen && !studioShell && ('))
assert.ok(viewer.includes('</div>\n\n          {/* Studio edit guidance has its own row outside the fitted slide. */}'),'Guide appears after closing the native slide container')
assert.ok(viewer.includes('relative z-10 h-full w-full overflow-hidden rounded-sm'))
assert.ok(viewer.includes('absolute inset-0 z-20 bg-gray-100'),'Existing generation coverage keeps its higher layer')
assert.ok(css.includes(':focus-visible')&&css.includes('.dark [data-studio-edit-guide="true"]'))
assert.ok(!leaf.includes('sendCommand')&&!leaf.includes('useState')&&!leaf.includes('useEffect'),'Pure native leaf has no transport/state/timing')
checks++
const fixture = fs.readFileSync(new URL('scripts/studio-v4/ten-hour-edit-mode-guide-fixture.tsx',root),'utf8')
compile(fixture)
compile(viewer)
assert.ok(fixture.includes('isGenerating={false}')&&fixture.includes('showControls={false}'))
assert.ok(fixture.includes('stageChrome={{ footer:')&&fixture.includes('data-studio-edit-guide-specimen-boundary="true"'))
assert.ok(fixture.includes('height:88, position:\'relative\''),'Specimen guide occupies its own explicitly bounded footer outside the native slide')
assert.ok(fixture.includes('value={draft}')&&fixture.includes('onChange={event => setDraft(event.target.value)}'))
assert.ok(!/sendCommand|fetch\(|postMessage|enterEditMode|setIsEditMode|setTimeout|setInterval|localStorage/.test(fixture),'No fake native entry acknowledgement or connected operation')
checks++
console.log(`Studio edit guide: ${checks} isolated native/classic/source/style/specimen checks passed`)
