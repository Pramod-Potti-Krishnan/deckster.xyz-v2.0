// Offline Shape typed-failure source/lifecycle/feedback tests. No live requests.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import {createRequire} from 'node:module'
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const requireExisting=createRequire(path.join(repo,'package.json'))
const ts=requireExisting('typescript')
const React=requireExisting('react')
const {renderToStaticMarkup}=requireExisting('react-dom/server')
import { createHash } from 'node:crypto'

const baseline = process.env.SHAPE_TYPED_FAILURE_BASE_REF || 'bb26903c5ab9e0313380691c7c3789bd93a07e0e'
const sourceRoot = repo
const sourceAt = (file, ref) => ref
  ? execFileSync('git', ['show', `${ref}:${file}`], { cwd: repo, encoding: 'utf8' })
  : fs.existsSync(path.join(sourceRoot, file)) ? fs.readFileSync(path.join(sourceRoot, file), 'utf8')
    : execFileSync('git', ['show', `${process.env.TEXTBOX_RECOVERY_SOURCE_FALLBACK_REF}:${file}`], { cwd: repo, encoding: 'utf8' })
const flush = async () => { for (let i = 0; i < 100; i++) await Promise.resolve() }
let scenarioCount = 0
function runtime({ ref, shapeFlag, timeoutFlag, recoveryFlag, delay = 5_000, sessionDelay = 0, backendResponse = {success:true,elements:[{component_type:'SHAPE',html:'<svg data-synthetic="true"></svg>'}]} } = {}) {
  scenarioCount++
  let now = 0, timerId = 0, uuid = 0, refCursor = 0, effectCursor = 0
  const timers = new Map(), refs = [], effectStates = [], pendingEffects = []
  const requests = [], commands = [], statuses = [], controllers = [], sessionSignals = []
  const panel = { blankElementId: 'blank-1', isOpen: true, elementType: 'SHAPE', isGenerating: false,
    error: null, mode: 'generate', refineContext: null, researchMode: 'off', researchWeb: false,
    researchUploadedDocs: false, researchKnowledgeGraph: false }
  const blank = { elementId: 'blank-1', componentType: 'SHAPE', slideIndex: 0,
    startCol: 2, startRow: 4, width: 10, height: 6, status: 'blank' }
  let theme = { status: 'applied', requestId: 'theme-1', presentationId: 'deck-1', themeFingerprint: 'theme-a', error: null }
  const setTimer = (fn, ms) => { const id = ++timerId; timers.set(id, { at: now + ms, fn }); return id }
  const clearTimer = id => timers.delete(id)
  class ClockDate extends Date { static now() { return now } }
  class TrackedController extends AbortController { constructor() { super(); controllers.push(this) } }
  const React = {
    useRef(value) { const i = refCursor++; return refs[i] ??= { current: value } },
    useCallback: fn => fn,
    useEffect(fn, deps) {
      const i = effectCursor++, previous = effectStates[i]
      if (!previous || deps.some((v, j) => !Object.is(v, previous.deps[j]))) {
        pendingEffects.push(() => { previous?.cleanup?.(); effectStates[i] = { deps, cleanup: fn() } })
      }
    },
  }
  const cache = new Map()
  const environment = { NEXT_PUBLIC_ELEMENTOR_URL: 'https://textlabs.example.test',
    NEXT_PUBLIC_STUDIO_V4_SHELL: process.env.TEXTBOX_RECOVERY_STUDIO_SHELL ?? 'true',
    NEXT_PUBLIC_TEXTBOX_REQUEST_FIDELITY_ENABLED: process.env.TEXTBOX_RECOVERY_STUDIO_SHELL ?? 'true',
    NEXT_PUBLIC_TEXTBOX_PLANNED_TIMEOUT_ENABLED: timeoutFlag,
    NEXT_PUBLIC_ELEMENT_THEME_PREFLIGHT_RECOVERY_ENABLED: recoveryFlag,
    NEXT_PUBLIC_SHAPE_TYPED_FAILURE_RECOVERY_ENABLED: shapeFlag }
  function load(file) {
    if (cache.has(file)) return cache.get(file)
    const mod = { exports: {} }; cache.set(file, mod.exports)
    const compiled = ts.transpileModule(sourceAt(file, ref), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React,
    } }).outputText
    vm.runInNewContext(compiled, { module: mod, exports: mod.exports, React,
      process: { env: environment }, Date: ClockDate, setTimeout: setTimer, clearTimeout: clearTimer,
      AbortController: TrackedController, AbortSignal, DOMException, FormData, Blob, URL,
      crypto: { randomUUID: () => `synthetic-${++uuid}` },
      console: { log() {}, warn() {}, error() {}, info() {} }, Error,
      fetch: async (url, init = {}) => {
        if (!url.includes('textlabs.example.test')) return { ok: true, json: async () => ({ primary: '#123456' }) }
        requests.push({ body: JSON.parse(init.body), signal: init.signal, at: now })
        return await new Promise((resolve, reject) => {
          const id = setTimer(() => resolve({ ok: true, headers: { get: name => name === 'x-request-id' ? 'synthetic-request-1234' : null }, json: async () => ({
            ...backendResponse,
          }) }), delay)
          const abort = () => { clearTimer(id); reject(new DOMException('Aborted', 'AbortError')) }
          if (init.signal.aborted) abort()
          else init.signal.addEventListener('abort', abort, { once: true })
        })
      },
      require: id => {
        if (id === 'react') return React
        const relative = id.startsWith('@/') ? id.slice(2) : id.startsWith('.') ? path.normalize(path.join(path.dirname(file), id)) : null
        if (relative) return load(relative + '.ts')
        throw new Error(`Unexpected non-source dependency: ${id}`)
      },
    }, { filename: file })
    cache.set(file, mod.exports); return mod.exports
  }
  const methods = {
    setIsGenerating: value => { panel.isGenerating = value },
    setError: value => { panel.error = value; panel.retryStrategy=null }, setRetryStrategy: value => { panel.retryStrategy=value },
    getSnapshot: () => ({ ...panel }), closePanel: () => { panel.isOpen = false },
    rememberDraftForElement: () => {}, openPanelForElement: () => {}, resumePanelForElement: () => {},
    openPanelForRefine: () => {}, completeBlankReplacement: () => { panel.mode = 'refine' }, changeElementType: () => {},
  }
  const params = {
    presentationId: 'deck-1', currentSlideIndex: 0, researchCapabilities: {},
    generationPanel: null,
    blankElements: { getElement: id => id === blank.elementId ? blank : undefined,
      updatePosition: () => {}, updateGenerationMetadata: () => {}, setStatus: (_id, status) => { blank.status = status; statuses.push(status) },
      removeElement: () => { blank.status = 'removed' }, addElement: () => {}, trackElement: () => {} },
    textLabsSession: { ensureSession: async signal => {
      sessionSignals.push(signal)
      if (sessionDelay) await new Promise((resolve, reject) => {
        setTimer(resolve, sessionDelay)
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
      })
      return 'synthetic-session'
    } },
    layoutServiceApis: { sendElementCommand: async (action, args) => {
      commands.push({ action, args: JSON.parse(JSON.stringify(args)) })
      if (action === 'getElementGeometry') return { success: true, action, elementId: args.elementId,
        position: { gridRow: '4/10', gridColumn: '2/12' } }
      if (action === 'refreshElementThemeMetadata') return { themeVariantId: 'variant', themeBindings: { text: '--theme-text' } }
      return { success: true, elementId: action.startsWith('insert') || action.startsWith('upsert') ? 'generated-1' : args.elementId }
    } },
    getThemeSyncSnapshot: () => theme,
    ensureThemeReady: async () => ({ ready: true, source: 'director', sync: theme }), toast: () => {},
  }
  params.layoutServiceApis.captureStudioElementGeneration = () => ({ sendElementCommand: params.layoutServiceApis.sendElementCommand, isCurrent: () => params.presentationId === 'deck-1' })
  const hook = load('hooks/use-textlabs-generation.ts').useTextLabsGeneration
  let api
  function render() {
    refCursor = 0; effectCursor = 0
    params.generationPanel = { ...panel, ...methods }
    api = hook(params)
    while (pendingEffects.length) pendingEffects.shift()()
    return api
  }
  render()
  async function advance(ms) {
    await flush()
    const end = now + ms
    while (true) {
      const entry = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
      if (!entry) break
      now = entry[1].at; timers.delete(entry[0]); entry[1].fn(); await flush()
    }
    now = end; await flush()
  }
  const form = () => ({ componentType: 'SHAPE', prompt: 'synthetic three sections', structure: 'SECTIONS', count: 1, useDeckTheme: false, textboxConfig: {}, compose: false,
    positionConfig: { start_col: 2, start_row: 4, position_width: 10, position_height: 6, auto_position: false } })
  return { load, render, params, panel, blank, requests, commands, statuses, controllers, sessionSignals, form,
    advance, flush, get api() { return api }, get now() { return now }, get theme() { return theme }, set theme(value) { theme = value },
    unmount: () => effectStates.forEach(effect => effect?.cleanup?.()),
    summary: () => JSON.parse(JSON.stringify({ requests: requests.map(x => ({ body: x.body, at: x.at, aborted: x.signal.aborted })), commands,
      statuses, panel: { error: panel.error, isGenerating: panel.isGenerating, mode: panel.mode, retryStrategy: panel.retryStrategy }, blank: blank.status })),
  }
}


const cases=[]
const terminal=()=>({success:false,error:'Synthetic geometry could not be verified',error_code:'SHAPE_GEOMETRY_UNVERIFIABLE',retryable:false,downstream_request_id:'synthetic-downstream-1234'})
const form=()=>({componentType:'SHAPE',prompt:'SYNTHETIC_CUSTOM_SUBJECT',count:1,useDeckTheme:false,shapeConfig:{shape_type:null,prompt:'SYNTHETIC_CUSTOM_SUBJECT',fill_color:'#3B82F6',stroke_color:'#1E40AF',stroke_width:2,opacity:1,rotation:0,size:'large',target_background:'light',x:60,y:180,width_px:600,height_px:360},positionConfig:{start_col:2,start_row:4,position_width:10,position_height:6,auto_position:false}})
const guidance='Try a simpler shape description or choose a preset.'
const digest=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex')
function record(name,details={}){cases.push({name,...details})}
function feedback(error,retryStrategy,prompt,ref){
  const mod={exports:{}}
  const text=sourceAt('components/generation-panel/shared/generation-input.tsx',ref)
  const stub=({children})=>React.createElement('span',null,children)
  const code=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
  vm.runInNewContext(code,{module:mod,exports:mod.exports,process:{env:{NEXT_PUBLIC_STUDIO_V4_SHELL:'true'}},require:name=>{
    if(name==='react')return React
    if(name==='react/jsx-runtime')return requireExisting(name)
    if(name==='lucide-react')return new Proxy({},{get:()=>stub})
    if(name==='@/components/ui/popover')return {Popover:stub,PopoverContent:stub,PopoverTrigger:stub}
    if(name==='@/lib/element-prompt-limit')return runtime({ref:baseline}).load('lib/element-prompt-limit.ts')
    if(name.endsWith('.css'))return {}
    throw new Error(`Unexpected feedback import ${name}`)
  }})
  return renderToStaticMarkup(React.createElement(mod.exports.GenerationInput,{prompt,onPromptChange(){},mandatoryConfig:null,showAdvanced:false,onToggleAdvanced(){},onSubmit(){},isGenerating:false,error,retryStrategy}))
}
async function invoke({ref,flag,response=terminal(),data=form(),delay=5_000,refine=false,cancel=false,retire=false}={}){
 const run=runtime({ref,shapeFlag:flag,backendResponse:response,delay})
 if(refine){run.panel.mode='refine';run.panel.blankElementId=null;run.panel.editElementId='original-shape';run.panel.refineContext={elementId:'original-shape',elementType:'SHAPE',slideIndex:0,content:'<svg data-original="kept"></svg>',position:{start_col:2,start_row:4,position_width:10,position_height:6},generationConfig:{},research:{}};run.render()}
 const promise=run.api.handleGenerate(data)
 if(cancel||retire){await run.advance(1_000);if(cancel)run.controllers[0].abort();if(retire){run.params.presentationId='another-deck';run.render()}}
 await run.advance(5_000);await promise
 const summary=run.summary()
 return{run,data,summary,dom:feedback(run.panel.error,run.panel.retryStrategy,data.prompt,ref)}
}
if(process.env.SHAPE_TYPED_FAILURE_RESPONSE_FIXTURE){
 const fixture=JSON.parse(fs.readFileSync(process.env.SHAPE_TYPED_FAILURE_RESPONSE_FIXTURE,'utf8'))
 const response=fixture.response ?? fixture
 assert.equal(response.success,false)
 assert.equal(response.error_code,'SHAPE_GEOMETRY_UNVERIFIABLE')
 assert.equal(response.retryable,false)
 const result=await invoke({flag:'true',response})
 assert(result.run.panel.error.startsWith(response.error))
 assert(result.run.panel.error.includes(guidance))
 assert(result.run.panel.error.includes('Request reference:'))
 assert.equal(result.run.panel.retryStrategy,'do_not_retry')
 assert.equal(result.run.requests.length,1)
 assert.equal(result.run.blank.status,'blank')
 assert.equal(result.run.commands.some(x=>/^insert|^upsert|^delete/.test(x.action)),false)
 assert(result.dom.includes(guidance))
 record('actual typed failure fixture→candidate hook/DOM retained original blank',{fixture_sha256:digest(fs.readFileSync(process.env.SHAPE_TYPED_FAILURE_RESPONSE_FIXTURE,'utf8')),error_sha256:digest(result.run.panel.error),dom_sha256:digest(result.dom)})
}else{
// Actual pristine base/candidate parity: same source mocks and incoming terminal wire.
for(const flag of [undefined,'false','1','TRUE']){
 const before=await invoke({ref:baseline,flag}),after=await invoke({flag})
 assert.deepEqual(after.summary,before.summary)
 assert.equal(JSON.stringify(after.data),JSON.stringify(before.data))
 assert.equal(after.dom,before.dom)
 record(`OFF actual hook/request/error/DOM identity (${String(flag)})`,{summary_sha256:digest(after.summary),dom_sha256:digest(after.dom)})
}
const typed=await invoke({flag:'true'})
assert.equal(typed.run.requests.length,1)
assert(typed.run.panel.error.includes(`Synthetic geometry could not be verified ${guidance} Request reference: synthetic-re.`))
assert(typed.run.panel.error.includes('Diagram reference: synthetic-do.'))
assert.equal(typed.run.panel.retryStrategy,'do_not_retry')
assert.equal(typed.run.blank.elementId,'blank-1');assert.equal(typed.run.blank.status,'blank')
assert.equal(typed.run.commands.some(x=>/^insert|^upsert|^delete/.test(x.action)),false)
assert.equal(typed.run.panel.isGenerating,false)
assert(typed.dom.includes(guidance));assert(typed.dom.includes('Update the prompt or settings before generating again.'))
assert(!typed.dom.includes('Try again</'))
assert.equal(typed.data.prompt,'SYNTHETIC_CUSTOM_SUBJECT')
assert.equal(typed.run.requests[0].body.shape_config.fill_color,'#3B82F6')
assert.equal(typed.run.requests[0].body.shape_config.stroke_width,2)
record('ON typed terminal refusal: original blank/options/reference, one send, no retry or mutation',{error_sha256:digest(typed.run.panel.error),dom_sha256:digest(typed.dom)})
for(const [name,patch] of [['legacy untyped',{error_code:undefined}],['primitive refusal',{error_code:'SHAPE_PRIMITIVE_GRAMMAR_REFUSED',retryable:true}],['router terminal',{error_code:'SHAPE_ROUTER_TERMINAL'}],['unknown code',{error_code:'SYNTHETIC_UNKNOWN'}],['retryable verifier',{retryable:true}],['ambiguous verifier',{ambiguous_completion:true}]]){
 const response={...terminal(),...patch}
 const before=await invoke({ref:baseline,response,flag:'true'}),after=await invoke({response,flag:'true'})
 assert.deepEqual(after.summary,before.summary);assert.equal(after.dom,before.dom)
 record(`ON unchanged ${name}`,{summary_sha256:digest(after.summary),dom_sha256:digest(after.dom)})
}
for(const shapeType of ['arrow','circle','']){
 const data=form();data.shapeConfig.shape_type=shapeType
 const before=await invoke({ref:baseline,data:structuredClone(data),flag:'true'}),after=await invoke({data:structuredClone(data),flag:'true'})
 assert.deepEqual(after.summary,before.summary);assert.equal(after.dom,before.dom)
 record(`ON unchanged preset/noncustom ${shapeType||'empty type'}`)
}
for(const shapeType of ['custom','auto']){
 const data=form();data.shapeConfig.shape_type=shapeType
 const result=await invoke({flag:'true',data})
 assert(result.run.panel.error.includes(guidance));assert.equal(result.run.requests.length,1)
 record(`ON reserved Custom form type ${shapeType}`)
}
// All component values are excluded by the actual helper, including malformed plain errors.
const helperRuntime=runtime({shapeFlag:'true'}),client=helperRuntime.load('lib/textlabs-client.ts'),helper=helperRuntime.load('lib/shape-generation-failure.ts')
const error=new client.TextLabsRequestError('synthetic',{kind:'application',errorCode:'SHAPE_GEOMETRY_UNVERIFIABLE',retryable:false})
for(const componentType of ['TEXT_BOX','METRICS','TABLE','CHART','IMAGE','ICON_LABEL','INFOGRAPHIC','DIAGRAM_AUTO','CODE_DISPLAY','KANBAN_BOARD','GANTT_CHART','CHEVRON','IDEA_BOARD','CLOUD_ARCHITECTURE','LOGICAL_ARCHITECTURE','DATA_ARCHITECTURE','CUSTOM'])assert.equal(helper.shapeTypedFailureGuidance({...form(),componentType},error),null)
assert.equal(helper.shapeTypedFailureGuidance(form(),{kind:'application',errorCode:error.errorCode,retryable:false}),null)
for(const kind of ['transport','http'])assert.equal(helper.shapeTypedFailureGuidance(form(),new client.TextLabsRequestError('synthetic',{kind,errorCode:error.errorCode,retryable:false})),null)
record('ON actual helper excludes all non-SHAPE, malformed and non-application failures')
for(const componentType of ['TEXT_BOX','TABLE']){
 const data={...form(),componentType,structure:'SIMPLE',textboxConfig:{},tableConfig:{},layout:'horizontal'}
 const before=await invoke({ref:baseline,data:structuredClone(data),flag:'true'}),after=await invoke({data:structuredClone(data),flag:'true'})
 assert.deepEqual(after.summary,before.summary);assert.equal(after.dom,before.dom)
 record(`ON actual non-SHAPE hook unchanged ${componentType}`)
}
const refined=await invoke({flag:'true',refine:true})
assert(refined.run.panel.error.includes(guidance));assert.equal(refined.run.panel.mode,'refine');assert.equal(refined.run.panel.refineContext.content,'<svg data-original="kept"></svg>')
assert.equal(refined.run.commands.some(x=>/^insert|^upsert|^delete/.test(x.action)),false)
record('ON refine refusal retains original content, form subject and options')
for(const [name,scenario] of [['cancel',{cancel:true,delay:45_000}],['presentation change',{retire:true}]]){
 const before=await invoke({ref:baseline,flag:'true',...scenario}),after=await invoke({flag:'true',...scenario})
 assert.deepEqual(after.summary,before.summary);assert.equal(after.dom,before.dom)
 assert.equal(after.run.commands.some(x=>/^insert|^upsert|^delete/.test(x.action)),false)
 record(`ON unchanged ${name} authority/cancellation`)
}
// Explicit editing is a new user action, not a queued automatic retry.
const response=terminal(),later=runtime({shapeFlag:'true',backendResponse:response})
let data=form(),pending=later.api.handleGenerate(data);await later.advance(5_000);await pending
assert.equal(later.requests.length,1);assert(later.panel.error.includes(guidance))
for(const key of Object.keys(response))delete response[key]
Object.assign(response,{success:true,element:{component_type:'SHAPE',html:'<svg data-synthetic="simpler"></svg>',element_id:'new-shape'}})
later.render();data=form();data.prompt='SYNTHETIC_SIMPLER_SHAPE';data.shapeConfig.prompt=data.prompt
pending=later.api.handleGenerate(data);await later.advance(5_000);await pending
assert.equal(later.requests.length,2)
assert.equal(later.requests[1].body.message,data.prompt)
assert.notEqual(later.requests[0].body.generation_attempt_id,later.requests[1].body.generation_attempt_id)
assert.equal(later.commands.filter(x=>x.action==='insertTextBox').length,1)
assert.equal(later.blank.status,'removed');assert.equal(later.panel.error,null)
record('ON explicit edited subsequent Generate: exactly one new attempt, acknowledged insertion')
}
const receipt={base:baseline,candidate_head:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),cases,passed_cases:cases.length,source_hashes:Object.fromEntries(['lib/shape-generation-failure.ts','hooks/use-textlabs-generation.ts','lib/textlabs-client.ts','components/generation-panel/shared/generation-input.tsx','scripts/test-shape-typed-failure.mjs'].map(file=>[file,digest(fs.readFileSync(path.join(repo,file),'utf8'))])),live_calls:0,scope:'actual source functions/hooks; virtual clock/mock fetch/Layout; actual GenerationInput rendered with stubbed icons/popovers; no connected UI or reload proof'}
if(process.env.SHAPE_TYPED_PROOF_OUT){fs.mkdirSync(process.env.SHAPE_TYPED_PROOF_OUT,{recursive:true});fs.writeFileSync(path.join(process.env.SHAPE_TYPED_PROOF_OUT,'focused-results.json'),JSON.stringify(receipt,null,2)+'\n')}
console.log(`PASS ${cases.length} shape typed-failure cases; actual-source OFF hook/request/DOM pairs and ON recovery; no live calls`)
