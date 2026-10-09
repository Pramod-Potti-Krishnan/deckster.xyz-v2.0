import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import ts from 'typescript'

const root = new URL('../', import.meta.url)
const uat = 'ee532fab4b84a6883f8a5b50675ccab692b62240'
const dev = 'caf39422c0c6d397a2e4185e52e8531bf6ea3f46'
const read = file => fs.readFileSync(new URL(file, root), 'utf8')
const source = (ref, file) => ref === 'working' ? read(file) : execFileSync('git', ['show', `${ref}:${file}`], { cwd: root, encoding: 'utf8' })
const compile = text => {
  const out = ts.transpileModule(text, { reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } })
  assert.equal((out.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0)
  return out.outputText
}
const refuse = () => { throw new Error('Offline thumbnail proof refuses browser/network/account/service mutation') }
function pure(ref, name) {
  const module = { exports: {} }
  vm.runInNewContext(compile(source(ref, `lib/${name}.ts`)), { module, exports: module.exports, require: refuse })
  return module.exports
}
const helpers = pure('working', 'stage-f-thumbnails')
const { createStageFThumbnailCache, restoreStageFThumbnailCache, stageFThumbnailCacheKey, mergeRestoredStageFThumbnailUrls, mergeStageFPresentationThumbnailUrl, mergeStageFReadyThumbnailUrl, STAGE_F_THUMBNAIL_CACHE_TTL, STAGE_F_THUMBNAIL_CACHE_MAX_BYTES } = helpers
let count = 0
const results = []
function check(name, fn) { fn(); results.push(name); count++ }
const json = value => JSON.parse(JSON.stringify(value))
const owner = 'synthetic-user-a', session = 'synthetic-chat-a', now = 100000000
const live = { 'synthetic-final': { 0: 'https://cdn.invalid/final/0.png', 1: 'https://cdn.invalid/final/1.png' }, 'synthetic-strawman': { 0: 'https://cdn.invalid/strawman/0.png' } }
const cached = createStageFThumbnailCache(live, owner, session, now)
check('cache records explicit user/session/presentation identity and copies received URLs', () => {
  assert.equal(cached.ownerUserId, owner); assert.equal(cached.sessionId, session); assert.equal(cached.savedAt, now)
  assert.deepEqual(json(cached.thumbnailUrlsByPresentation), live)
  assert.deepEqual(json(restoreStageFThumbnailCache(json(cached), owner, session, now + 1)), live)
})
check('cache key refuses absent identity/new route and separates ambiguous IDs', () => {
  for (const [a,b] of [['',session],[owner,''],[owner,'new'],[null,session]]) assert.equal(stageFThumbnailCacheKey(a,b), null)
  assert.notEqual(stageFThumbnailCacheKey('a_b','c'), stageFThumbnailCacheKey('a','b_c'))
})
for (const [name, value, a, b, time] of [
  ['different account',cached,'synthetic-user-b',session,now],
  ['different chat',cached,owner,'synthetic-chat-b',now],
  ['missing cache owner',{...cached,ownerUserId:undefined},owner,session,now],
  ['missing cache session',{...cached,sessionId:undefined},owner,session,now],
  ['old schema',{...cached,version:0},owner,session,now],
  ['expired',cached,owner,session,now+STAGE_F_THUMBNAIL_CACHE_TTL+1],
  ['future timestamp',cached,owner,session,now-1],
  ['NaN clock',cached,owner,session,NaN],
  ['invalid timestamp',{...cached,savedAt:'100'},owner,session,now],
  ['array payload',[],owner,session,now],
  ['null payload',null,owner,session,now],
]) check(`restore refuses ${name}`, () => assert.deepEqual(json(restoreStageFThumbnailCache(value,a,b,time)), {}))
check('exact TTL boundary remains valid', () => assert.deepEqual(json(restoreStageFThumbnailCache(cached,owner,session,now+STAGE_F_THUMBNAIL_CACHE_TTL)),live))
check('empty/incomplete writes cannot create previews', () => {
  assert.equal(createStageFThumbnailCache({},owner,session,now),null)
  assert.equal(createStageFThumbnailCache(live,'',session,now),null)
  assert.equal(createStageFThumbnailCache(live,owner,session,NaN),null)
})
check('malformed entries and dead object URLs omitted; supplied inline image kept', () => {
  const map = {'synthetic-final': { 0:' ', 1:3, 2:'blob:https://app.invalid/temporary', 3:'data:image/png;base64,synthetic', '-1':'negative', '1.5':'fraction', '01':'ambiguous', '9007199254740992':'unsafe' }, ' synthetic-final': {0:'https://cdn.invalid/unowned.png'}}
  const normalized = createStageFThumbnailCache(map,owner,session,now)
  assert.deepEqual(json(normalized.thumbnailUrlsByPresentation), {'synthetic-final': {3:'data:image/png;base64,synthetic'}})
  assert.equal(map['synthetic-final'][2], 'blob:https://app.invalid/temporary', 'live input is untouched')
})
check('cache bounded to 32 presentations and 500 URLs; live input untouched', () => {
  const many = Object.fromEntries(Array.from({length:40},(_,i)=>[`synthetic-${i}`,Object.fromEntries(Array.from({length:20},(_,j)=>[j,`https://cdn.invalid/${i}/${j}.png`]))]))
  const bounded = createStageFThumbnailCache(many,owner,session,now).thumbnailUrlsByPresentation
  assert.equal(Object.keys(bounded).length,25)
  assert.equal(Object.values(bounded).reduce((n,urls)=>n+Object.keys(urls).length,0),500)
  assert.equal(Object.keys(many).length,40)
  const presentations = createStageFThumbnailCache(Object.fromEntries(Array.from({length:40},(_,i)=>[`synthetic-${i}`,{0:'https://cdn.invalid/0.png'}])),owner,session,now)
  assert.equal(Object.keys(presentations.thumbnailUrlsByPresentation).length,32)
})
check('oversized snapshot refused on both write and restore', () => {
  const huge = {'synthetic-final':Object.fromEntries(Array.from({length:100},(_,i)=>[i,'https://cdn.invalid/'+ 'x'.repeat(8000)]))}
  assert.equal(createStageFThumbnailCache(huge,owner,session,now),null)
  assert.deepEqual(json(restoreStageFThumbnailCache({...cached,thumbnailUrlsByPresentation:huge},owner,session,now)),{})
  assert.ok(JSON.stringify(cached).length * 2 < STAGE_F_THUMBNAIL_CACHE_MAX_BYTES)
})
check('live precedence retains presentation isolation and missing restored entries', () => {
  const merged = mergeRestoredStageFThumbnailUrls(live, {'synthetic-final':{0:'https://cdn.invalid/final/new.png'}})
  assert.equal(merged['synthetic-final'][0], 'https://cdn.invalid/final/new.png')
  assert.equal(merged['synthetic-final'][1], live['synthetic-final'][1])
  assert.equal(merged['synthetic-strawman'][0],live['synthetic-strawman'][0])
  assert.equal(live['synthetic-final'][0],'https://cdn.invalid/final/0.png')
})
check('refine replaces one index; compose inserts and moves later indices; repeat is idempotent', () => {
  const before = pure(dev,'stage-f-thumbnails').mergeStageFInsertedThumbnailUrl(live,'synthetic-final',0,'https://cdn.invalid/refined.png')
  assert.equal(before['synthetic-final'][1],live['synthetic-final'][0], 'exact deployed frontend reproduces wrong-index refinement when insertion helper is used')
  const refined = mergeStageFReadyThumbnailUrl(live,'synthetic-final',0,'https://cdn.invalid/refined.png','refine')
  assert.equal(refined['synthetic-final'][0],'https://cdn.invalid/refined.png'); assert.equal(refined['synthetic-final'][1],live['synthetic-final'][1]); assert.equal(refined['synthetic-final'][2],undefined)
  assert.equal(mergeStageFReadyThumbnailUrl(refined,'synthetic-final',0,'https://cdn.invalid/refined.png','refine'),refined)
  const inserted = mergeStageFReadyThumbnailUrl(live,'synthetic-final',1,'https://cdn.invalid/inserted.png','compose')
  assert.equal(inserted['synthetic-final'][2],live['synthetic-final'][1]); assert.equal(inserted['synthetic-final'][0],live['synthetic-final'][0])
  assert.equal(mergeStageFReadyThumbnailUrl(inserted,'synthetic-final',1,'https://cdn.invalid/inserted.png','compose'),inserted)
})
check('confirmed refine without new URL clears stale target image only', () => {
  const refined = mergeStageFReadyThumbnailUrl(live,'synthetic-final',0,null,'refine')
  assert.equal(refined['synthetic-final'][0],undefined)
  assert.equal(refined['synthetic-final'][1],live['synthetic-final'][1])
  assert.equal(refined['synthetic-strawman'][0],live['synthetic-strawman'][0])
  assert.equal(mergeStageFReadyThumbnailUrl(refined,'synthetic-final',0,null,'refine'),refined)
  assert.equal(live['synthetic-final'][0],'https://cdn.invalid/final/0.png')
})
function strip(ref, studio) {
  const text = source(ref,'components/slide-thumbnail-strip.tsx')
  const imports = {
    react: {...React, useState:initial=>[initial,refuse], useEffect:()=>{}, useRef:()=>({current:null}), useCallback:fn=>fn},
    'react/jsx-runtime': jsxRuntime,
    '@/lib/utils': {cn:(...args)=>args.filter(Boolean).join(' ')},
    '@/lib/slide-compose-async': pure(ref,'slide-compose-async'),
    '@/lib/slide-thumbnail-menu': pure(ref,'slide-thumbnail-menu'),
    './slide-layout-picker': {SLIDE_LAYOUTS:[]},
    '@/lib/studio-slide-title-label': {slideTitleLabel:title=>title},
    // F9-A (live rail preview, flag NEXT_PUBLIC_STUDIO_RAIL_LIVE_PREVIEW_FALLBACK_ENABLED, default off): flag-off stubs; older refs never import them.
    '@/lib/rail-live-preview': {STUDIO_RAIL_LIVE_PREVIEW_FALLBACK_ENABLED:false,railLivePreviewApplies:()=>false},
    './rail-live-preview': {RailLivePreview:()=>null},
  }
  const parsed=ts.createSourceFile('strip.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  for (const declaration of parsed.statements) {
    if (!ts.isImportDeclaration(declaration) || declaration.importClause?.isTypeOnly) continue
    const id=declaration.moduleSpecifier.text
    if (id in imports) continue
    assert.ok(id==='lucide-react'||id.startsWith('@/components/ui/')||id==='@radix-ui/react-tooltip'||id.endsWith('.css'),`unexpected dependency ${id}`)
    imports[id]=Object.fromEntries((declaration.importClause?.namedBindings?.elements??[]).map(name=>[name.propertyName?.text??name.name.text,`${id}:${name.name.text}`]))
  }
  const module={exports:{}}
  vm.runInNewContext(compile(text),{module,exports:module.exports,process:{env:{NEXT_PUBLIC_STUDIO_V4_SHELL:studio?'true':'false'}},require:id=>{assert.ok(id in imports,`unexpected require ${id}`);return imports[id]}})
  return module.exports.SlideThumbnailStrip
}
const nodes = value => Array.isArray(value) ? value.flatMap(nodes) : !value || typeof value !== 'object' ? [] : [value,...nodes(value.props?.children)]
const baseSlides=Array.from({length:7},(_,i)=>({slideNumber:i+1,title:`Synthetic slide ${i+1}`}))
const renderReceipts=[]
for (const [ref,studio] of [[uat,false],[dev,false],[dev,true],['working',true]]) {
  const Component=strip(ref,studio), localHelpers=pure(ref,'stage-f-thumbnails')
  const render=slides=>Component({slides,currentSlide:1,onSlideClick:refuse,orientation:'vertical'})
  check(`actual ${ref}/${studio} missing URLs render zero images`,()=>assert.equal(nodes(render(baseSlides)).filter(n=>n.type==='img').length,0))
  const map=mergeStageFPresentationThumbnailUrl({},'synthetic-final',0,'https://cdn.invalid/received-live.png')
  const liveSlides=localHelpers.applyStageFThumbnailUrls(baseSlides,map['synthetic-final'])
  check(`actual ${ref}/${studio} admitted live URL renders exact native img attrs`,()=>{
    const imgs=nodes(render(liveSlides)).filter(n=>n.type==='img')
    assert.equal(imgs.length,1);assert.equal(imgs[0].props.src,map['synthetic-final'][0]);assert.equal(imgs[0].props.loading,'lazy');assert.equal(imgs[0].props.decoding,'async')
  })
  const before=render(baseSlides)
  const recovered=restoreStageFThumbnailCache(createStageFThumbnailCache(map,owner,session,now),owner,session,now+1)
  const after=render(localHelpers.applyStageFThumbnailUrls(baseSlides,recovered['synthetic-final']))
  check(`actual ${ref}/${studio} same-owned local cache restores only received preview`,()=>{
    assert.equal(nodes(after).filter(n=>n.type==='img').length,1)
    assert.equal(nodes(before).filter(n=>n.type==='img').length,0)
    assert.equal(nodes(after).filter(n=>n.type==='img')[0].props.src,'https://cdn.invalid/received-live.png')
  })
  renderReceipts.push({ref,studio,before:{images:0,outlineRows:7},after:{images:1,outlineRows:7,src:'https://cdn.invalid/received-live.png'},level:'actual strip offline synthetic render; no image HTTP or connected proof'})
}
const dir=new URL('../docs/studio-v4/canvas-recovery-20261004/evidence/',import.meta.url)
fs.mkdirSync(dir,{recursive:true})
fs.writeFileSync(new URL('thumb-recovery-results.json',dir),JSON.stringify({cases:count,results,renderReceipts,limitations:['No existing lost URLs recreated','No backend or browser service calls','No real image fetch proof','Lead owns cache lifecycle/page/CRUD integration tests']},null,2)+'\n')
console.log(`Thumbnail recovery: ${count} cache/identity/TTL/bounds/refine/actual UAT-dev-strip checks passed; no network or account calls.`)
