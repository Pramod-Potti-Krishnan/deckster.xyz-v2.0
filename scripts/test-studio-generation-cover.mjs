// Existing native isGenerating gate/loader/source and a single default-off nonfullscreen palette marker.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import postcss from 'postcss'
const root=new URL('../',import.meta.url),file='components/presentation-viewer.tsx'
const source=fs.readFileSync(new URL(file,root),'utf8')
const thumbnailInitializer = `  const thumbnailVisibilityInitializedRef = useRef(false)
  useEffect(() => {
    if (thumbnailVisibilityInitializedRef.current) return
    thumbnailVisibilityInitializedRef.current = true
    // Initialize once after hydration; native toggles and later resizing own the choice.
    if (studioShell && window.innerWidth <= 666) setShowThumbnails(false)
  }, [studioShell])
`
assert.equal(source.split(thumbnailInitializer).length, 2, 'Exactly one known post-hydration initializer is normalized; its own focused test preserves initialization behavior')
// Accepted viewer ownership/navigation/floating-control changes cannot be
// reversed by removing only this older presentation marker. Keep the complete
// accepted source guard; the original 6b6ad57 loader witness remains below.
const acceptedViewer=execFileSync('git',['show','0ed6298:'+file],{cwd:root,encoding:'utf8'})
const assertAcceptedViewer=candidate=>assert.ok(candidate===acceptedViewer,'The complete viewer must remain byte-exact to accepted application 0ed6298')
assertAcceptedViewer(source)
for(const [before,after] of [
 ['onClick={handleFullscreen}','onClick={handleSaveChanges}'],
 ['studioShell && !isFullscreen ? "true" : undefined','studioShell ? "true" : undefined'],
 ['aria-label="Slide authoring controls"','aria-label="Changed authoring controls"'],
]){
 assert.ok(source.includes(before),'Mutation witness must exercise actual accepted source')
 assert.throws(()=>assertAcceptedViewer(source.replace(before,after)),'Unknown handler/gate/markup changes must fail the complete source guard')
}
const marker=' data-studio-generation-cover={studioShell && !isFullscreen ? "true" : undefined}'
assert.equal(source.split(marker).length,2)
const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
let expression
const visit=node=>{if(ts.isJsxAttribute(node)&&node.name.getText(ast)==='data-studio-generation-cover')expression=node.initializer.expression.getText(ast);ts.forEachChild(node,visit)};visit(ast)
for(const studio of [false,true])for(const fullscreen of [false,true]){
 const value=vm.runInNewContext(`(${expression})`,{studioShell:studio,isFullscreen:fullscreen})
 assert.equal(value,studio&&!fullscreen?'true':undefined,'Only Studio outside fullscreen carries the palette marker')
}
const css=fs.readFileSync(new URL('components/builder/studio-canvas.css',root),'utf8')
const rules=postcss.parse(css).nodes.filter(node=>node.selector?.includes('data-studio-generation-cover'))
assert.equal(rules.length,1)
assert.ok(rules[0].selector.includes('[data-studio-v4-shell="true"]')&&rules[0].selector.includes(':not([data-studio-v4-fullscreen="true"])'))
assert.deepEqual(rules[0].nodes.map(node=>[node.prop,node.value]),[['background','var(--ss-surface)']],'Marker changes only the backdrop, with no fit/position/motion effects')
assert.equal(fs.readFileSync(new URL('components/slide-building-loader.tsx',root),'utf8'),execFileSync('git',['show','6b6ad57:components/slide-building-loader.tsx'],{cwd:root,encoding:'utf8'}),'Decorative loader/layout cycle and timers remain byte-exact')
console.log('Studio generation cover: native source, four literal/fullscreen combinations and palette/loader preservation checks passed')
