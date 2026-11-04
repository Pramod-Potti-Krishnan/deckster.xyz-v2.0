import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import { readAtlasBaseline } from './atlas-witness-baseline.mjs'
const file='components/studio-libraries/library-controls.tsx',source=fs.readFileSync(file,'utf8'),prior=readAtlasBaseline(`d8f5325:${file}`)
const restored=source.replace('children, actions, workspaceId }: {','children, actions }: {').replace('; workspaceId?: string','').replace('workspaceId ?? title.toLowerCase()','title.toLowerCase()')
assert.equal(restored,prior,'Entire existing shared controls unchanged except exact optional identity seam')
const jsx=(type,props)=>({type,props});const load=code=>{const mod={exports:{}};vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText,{module:mod,exports:mod.exports,require:id=>id==='react/jsx-runtime'?{jsx,jsxs:jsx}:id==='react'?{}:id==='./libraries.css'?{}:new Proxy({},{get:(_,key)=>key})});return mod.exports}
const normalize=value=>JSON.parse(JSON.stringify(value,(key,item)=>typeof item==='function'?'[native callback]':item))
const current=load(source),original=load(prior);let cases=0
for(const title of['Templates','Themes','Themes & brand','Some other caller'])for(const mode of['create','library']){
 const props={title,description:'Original description',mode,onModeChange:()=>{},children:'Exact children',actions:'Original actions'}
 assert.deepEqual(normalize(current.LibraryWorkspace(props)),normalize(original.LibraryWorkspace(props)),'Omitted prop preserves complete JSX/labels/actions/default identity');cases++
 const tree=current.LibraryWorkspace({...props,workspaceId:'themes'}),native=original.LibraryWorkspace(props)
 assert.equal(tree.props['data-studio-library'],'themes');assert.deepEqual(normalize({...tree.props,'data-studio-library':native.props['data-studio-library']}),normalize(native.props),'Stable ID changes no title/accessibility/children/actions');cases++
}
const themes=fs.readFileSync('components/studio-libraries/themes-workspace.tsx','utf8');assert.match(themes,/return <LibraryWorkspace workspaceId="themes" title=/)
console.log(`PASS ${cases} actual workspace identity/default JSX cases; exact unchanged other controls; no hooks/network/browser`)
