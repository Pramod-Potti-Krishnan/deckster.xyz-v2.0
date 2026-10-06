import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {execFileSync} from 'node:child_process'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
const dir=fileURLToPath(new URL('../../',import.meta.url)).replace(/\/$/,'')
const require=createRequire(dir+'/package.json'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),postcss=require('postcss')
const read=p=>fs.readFileSync(dir+'/'+p,'utf8'),old=p=>execFileSync('git',['show','1c4f793:'+p],{cwd:dir,encoding:'utf8'})
const parse=s=>ts.createSourceFile('source.tsx',s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
const all=(root,predicate)=>{const out=[];const visit=n=>{if(predicate(n))out.push(n);ts.forEachChild(n,visit)};visit(root);return out}
const print=n=>ts.createPrinter({removeComments:true}).printNode(ts.EmitHint.Unspecified,n,n.getSourceFile())
const compile=s=>{const out=ts.transpileModule(s,{reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}});assert.deepEqual((out.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error),[]);return out.outputText}
const vf='components/presentation-viewer.tsx',viewer=read(vf),before=old(vf),ast=parse(viewer),oldAst=parse(before)
compile(viewer);compile(read('components/builder/builder-header.tsx'))
const callbackProps=tree=>all(tree,n=>ts.isJsxAttribute(n)&&/^(on|disabled|checked)/.test(n.name.getText(tree))).map(n=>print(n)).sort()
assert.deepEqual(callbackProps(ast),callbackProps(oldAst),'Every JSX native callback/disabled/checked prop remains exact; moving controls adds no handler')
const viewerBody=tree=>all(tree,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='PresentationViewer')[0].body
const currentStatements=viewerBody(ast).statements.filter(n=>!ts.isReturnStatement(n)).map(print),oldStatements=viewerBody(oldAst).statements.filter(n=>!ts.isReturnStatement(n)).map(print)
const additions=["const [studioAuthoringPortalTarget, setStudioAuthoringPortalTarget] = useState<HTMLDivElement | null>(null);","const [studioPresentPortalTarget, setStudioPresentPortalTarget] = useState<HTMLDivElement | null>(null);"]
let filtered=currentStatements.filter(statement=>!additions.includes(statement)).map(statement=>statement.replace('[studioShell, isFullscreen, showControls, studioAuthoringPortalTarget]','[studioShell, isFullscreen, showControls]'))
// Root's separately authorized metadata-thumbnail fallback is outside this toolbar correction.
const normalizeThumbnail=statement=>statement.replace(/\s*thumbnailUrl: studioShell \? ownedRestoredThumbnailUrl\(slide, presentationId\) : undefined,\n/,'\n').replace('[slideStructure, totalSlides, slidesModifiedByCrud, thumbnailUrlsBySlide, studioShell, presentationId]','[slideStructure, totalSlides, slidesModifiedByCrud, thumbnailUrlsBySlide]')
assert.equal(filtered.length,oldStatements.length)
for(let i=0;i<filtered.length;i++) {
 if(filtered[i]!==oldStatements[i]) {
  assert.ok(filtered[i].includes('thumbnailUrl')&&filtered[i].includes('ownedRestoredThumbnailUrl'),'Only root metadata-thumbnail restore may differ outside JSX')
  assert.equal(normalizeThumbnail(filtered[i]),normalizeThumbnail(oldStatements[i]))
 }
}
const originalPresent=all(oldAst,n=>ts.isJsxElement(n)&&n.openingElement.tagName.getText(oldAst)==='button'&&n.openingElement.attributes.properties.some(p=>ts.isJsxAttribute(p)&&p.name.getText(oldAst)==='onClick'&&p.initializer.expression.getText(oldAst)==='handleFullscreen'))[0]
const present=all(ast,n=>ts.isVariableDeclaration(n)&&n.name.getText(ast)==='presentControl')[0]
assert.equal(print(present.initializer.expression),print(originalPresent),'Exact native Present JSX is reused; no new action/readiness/label semantics')
const versionOld=all(oldAst,n=>ts.isJsxElement(n)&&n.openingElement.tagName.getText(oldAst)==='DropdownMenuContent'&&n.openingElement.attributes.properties.some(p=>ts.isJsxAttribute(p)&&p.name.getText(oldAst)==='data-studio-authoring-menu'&&p.initializer.expression.getText(oldAst).includes('"version"')))[0]
const versionNew=all(ast,n=>ts.isVariableDeclaration(n)&&n.name.getText(ast)==='versionMenuItems')[0].initializer.expression
const jsxMeaningful=children=>children.filter(n=>!ts.isJsxText(n)||n.text.trim()).map(print)
assert.deepEqual(jsxMeaningful(versionNew.children),jsxMeaningful(versionOld.children),'All native version choices, callback arguments, current cues and tagged-option conditions remain exact')
const toolbarBody=tree=>all(tree,n=>ts.isArrowFunction(n)&&n.body.getText(tree).includes('const authoringControls =')&&n.body.getText(tree).startsWith('{'))[0].body
function loadToolbar(tree){const body=toolbarBody(tree),module={exports:{}};const bindings={};for(const id of all(body,n=>ts.isIdentifier(n)))bindings[id.text]=/^[A-Z]/.test(id.text)?({children})=>React.createElement('div',{'data-native-component':id.text},children):null
 for(const tag of all(body,n=>ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n))){const name=tag.tagName.getText(tree);if(/^[A-Z]/.test(name))bindings[name]=({children})=>React.createElement('div',{'data-native-component':name},children)}
 Object.assign(bindings,{module,exports:module.exports,require,cn:(...c)=>c.filter(Boolean).join(' '),createPortal:(child,target)=>React.createElement('div',{'data-test-portal':target},child),toolbarPortalTarget:'header',studioAuthoringPortalTarget:'authoring',studioPresentPortalTarget:'present',authoringStripRef:{current:null},downloadControls:React.createElement('button',{'data-test-download':true},'Download'),features:{},handleFullscreen:()=>{},onVersionSwitch:()=>{},setTheme:()=>{}})
 const defaults={studioShell:false,isFullscreen:false,viewerIsReady:true,templateBuilderEnabled:true,templateModeOn:false,canSaveTemplate:false,templateSaveGate:{},templateSelectionLocked:false,templateModeAvailable:false,templateIngestEnabled:false,isEditMode:false,resolvedTheme:'light',isGenerating:false,showToolbar:true,activeVersion:'final',strawmanPreviewUrl:'/strawman',finalPresentationUrl:'/final',currentSlide:1,totalSlides:2,slideCount:2,visualTotalSlides:2}
 const js=compile('export function Toolbar(){'+body.getText(tree).slice(1,-1)+'}')
 return values=>{const nextModule={exports:{}};const context={...bindings,...defaults,...values,module:nextModule,exports:nextModule.exports};vm.runInNewContext(js,context);return nextModule.exports.Toolbar()}
}
const current=loadToolbar(ast),original=loadToolbar(oldAst)
let classic=0,studio=0
for(const isFullscreen of [false,true])for(const viewerIsReady of [false,true])for(const templateBuilderEnabled of [false,true])for(const tagged of [false,true]){
 const values={studioShell:false,isFullscreen,viewerIsReady,templateBuilderEnabled,strawmanPreviewUrl:tagged?'/strawman':null,finalPresentationUrl:tagged?'/final':null}
 assert.equal(renderToStaticMarkup(current(values)),renderToStaticMarkup(original(values)),'Complete classic toolbar SSR stays exact through readiness/fullscreen/templates/tagged versions');classic++
}
for(const isFullscreen of [false,true])for(const viewerIsReady of [false,true])for(const tagged of [false,true]){
 const html=renderToStaticMarkup(current({studioShell:true,isFullscreen,viewerIsReady,strawmanPreviewUrl:tagged?'/strawman':null,finalPresentationUrl:tagged?'/final':null}))
 assert.ok(!html.includes('title="Switch version"'),'Studio top has no native version chip')
 assert.ok(!html.includes('Create &amp; edit'))
 assert.equal((html.match(/title="(?:Present fullscreen|Exit fullscreen \(ESC\))"/g)||[]).length,1,'Exactly one original Present exists: lower normal or native fullscreen')
 if(!isFullscreen){assert.ok(html.includes('data-test-portal="authoring"'));assert.ok(html.includes('data-test-portal="present"'));const header=html.slice(html.indexOf('data-test-portal="header"'));assert.ok(!header.includes('title="Present fullscreen"'),'Top delivery omits Present')}
 assert.equal(html.includes('>Version</div>'),viewerIsReady&&tagged,'Studio Show retains exact native tagged/readiness version gate');studio++
}
const authoringSlot = `          {studioShell && !isFullscreen && showControls && (
            <div ref={setStudioAuthoringPortalTarget} data-studio-authoring-slot="true" />
          )}
`
const presentSlot = '              {studioShell && showControls && <div ref={setStudioPresentPortalTarget} data-studio-present-slot="true" />}\n'
assert.equal(viewer.split(authoringSlot).length,2);assert.equal(viewer.split(presentSlot).length,2)
const restoredMain = parse(viewer.replace(authoringSlot,'').replace(presentSlot,'').replace("isFullscreen || studioShell ? '' : 'max-w-7xl'", "isFullscreen ? '' : 'max-w-7xl'").replace("                aria-label={studioShell ? 'Deckster home' : undefined}\n",''))
const mainArea = tree=>all(tree,n=>ts.isJsxElement(n)&&n.openingElement.attributes.properties.some(p=>ts.isJsxAttribute(p)&&p.name.getText(tree)==='className'&&p.initializer?.expression?.getText(tree).includes('flex-1 flex min-h-0 min-w-0 ${isFullscreen')))[0]
assert.equal(print(mainArea(restoredMain)),print(mainArea(oldAst)),'All native iframe/fit/render/notes/jobs/thumbnail/state branches are AST-exact outside the two added slots, Studio cap fix and root accessibility label')
const studioVersions = `                    {studioShell && viewerIsReady && (strawmanPreviewUrl || finalPresentationUrl) && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Version</DropdownMenuLabel>
                        {versionMenuItems}
                      </>
                    )}
`
assert.equal(viewer.split(studioVersions).length,2)
const authoringClean=parse(viewer.replace(studioVersions,''))
const authoring = tree=>all(tree,n=>ts.isVariableDeclaration(n)&&n.name.getText(tree)==='authoringControls')[0].initializer
assert.equal(print(authoring(authoringClean)),print(authoring(oldAst)),'All original Add Slide/Add Element/Template/Theme/Mode/Show controls remain AST-exact outside relocating existing version choices')
const header=read('components/builder/builder-header.tsx'),oldHeader=old('components/builder/builder-header.tsx')
const diagnostics=oldHeader.match(/          <div data-studio-v4-shell-diagnostics="true"[\s\S]*?          <\/div>/)[0]
const normalizedHeader=header.replace(/          \{!studioShell && \(\n            <div data-studio-v4-shell-diagnostics="true"[\s\S]*?          \)\}/,diagnostics)
assert.equal(ts.createPrinter({removeComments:true}).printFile(parse(normalizedHeader)),ts.createPrinter({removeComments:true}).printFile(parse(oldHeader)),'Header only gates visible diagnostics; full BuildVersionGuard and native callbacks remain exact')
assert.ok(header.includes('      <BuildVersionGuard />'))
for(const file of ['components/builder/studio-canvas.css','components/layout/studio-shell.css'])postcss.parse(read(file))
assert.ok(viewer.includes("isFullscreen || studioShell ? '' : 'max-w-7xl'"),'Only normal Studio removes the incorrect outer width cap')
assert.ok(!viewer.includes('className="studio-canvas-caption"'))
console.log(`PASS: all native JSX callbacks/guards exact; all pre-render state/handlers/effects preserved except two DOM targets/dependency; ${classic} complete classic toolbar SSR states, ${studio} Studio placements/gates; exact Present/version JSX/header safety; TSX/CSS syntax`)
