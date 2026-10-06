import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import { typedHarness, pageOwnership, evaluate, layoutLifecycle, page } from './test-director-question-submit.mjs'

// Actual Builder callback/native request and storage helpers. Every result is a
// supplied offline value; no service, persistence or transport ACK is claimed.
function find(root, predicate) {
  if (predicate(root)) return root
  let found
  ts.forEachChild(root, node => { if (!found) found = find(node, predicate) })
  return found
}
function all(root, predicate, result = []) { if (predicate(root)) result.push(root); ts.forEachChild(root, node => all(node,predicate,result)); return result }
const declaration = (root,name) => { const node = find(root,n => ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name); assert.ok(node,name); return node.initializer }
const print = (node,root = page) => ts.createPrinter({ removeComments: true }).printNode(ts.EmitHint.Unspecified,node,root)
const oldPage = ts.createSourceFile('baseline.tsx',execFileSync('git',['show','fa40582:app/builder/page.tsx'],{ encoding:'utf8' }),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
assert.equal(oldPage.parseDiagnostics.length,0)
const callback = root => print(declaration(root,'handleStartHandoffSession').arguments[0],root)
const current = callback(page), original = callback(oldPage)
const retirement = find(page,node => ts.isCallExpression(node) && node.expression.getText(page) === 'React.useLayoutEffect' && node.arguments[0]?.getText(page).includes('const request = studioManualHandoffRequestRef.current'))
assert.ok(retirement,'Actual Studio handoff retirement layout effect')
const flush = async () => { for (let i = 0; i < 24; i++) await Promise.resolve() }
const deferred = () => { let resolve,reject; const promise = new Promise((r,j) => { resolve=r; reject=j }); return { promise,resolve,reject } }
const body = { status:'ready',new_session_id:'offline-handoff-destination' }
const patchOk = { ok:true }
const handoffOk = { ok:true,json:async()=>body }
let checks = 0
function harness({ pause = null, code = current, storageFailure = false, outcomes = {}, ...extra } = {}) {
  const d = deferred(), storage = new Map()
  const h = typedHarness({
    studioShell:true, isUnsavedSession:pause === 'source',
    pendingManualDeckBuild:{ operationId:'offline-handoff-operation',presentationId:'offline-manual-deck',presentationUrl:'https://offline.invalid/deck',summary:{ slide_count:1,slides:[] },messageText:'A synthetic native request' },
    manualDeckHandoffBusy:false,pendingHandoffMemoryRef:{ current:null },studioManualHandoffRequestRef:{ current:null },
    buildThemeSelection:{ mode:'auto' },activeBuildThemeProfileForSelection:null,hasTemplateOverrides:false,templateOverrides:{},...extra,
  })
  const c = h.context
  pageOwnership(h)
  c.window = { sessionStorage:{ setItem:(k,v) => { if (storageFailure) throw new Error('Offline storage refusal'); storage.set(k,v); h.events.push(['storage',k]) },getItem:k=>storage.get(k)??null,removeItem:k=>{ storage.delete(k); h.events.push(['remove-storage',k]) } } }
  c.sessionStorage = c.window.sessionStorage
  c.session.answeredActionsRef = { current:new Set(['native-answered']) }
  c.session.lastLoadedSessionRef = { current:'offline-owned-session' }
  c.session.setUserMessages = value => { c.session.userMessages=typeof value === 'function'?value(c.session.userMessages):value; h.events.push(['messages',value]) }
  c.setManualDeckHandoffBusy = value => { c.manualDeckHandoffBusy=value; h.events.push(['busy',value]) }
  c.setManualDeckHandoffError = value => { c.manualDeckHandoffError=value; h.events.push(['manual-error',value]) }
  c.setIsUnsavedSession = value => h.events.push(['unsaved',value])
  c.setCurrentSessionId = value => h.events.push(['session',value])
  c.setSessionStoreName = value => h.events.push(['store',value])
  c.disconnect = () => h.events.push(['disconnect'])
  c.clearMessages = () => h.events.push(['clear'])
  c.router = { push:value=>h.events.push(['navigate',value]) }
  c.writeBuilderSessionOptions = (...args) => h.events.push(['options',...args])
  c.persistence.generateTitle = text => text
  evaluate('globalThis.NativeError = Error;', c)
  const respond = (stage, normal) => {
    if (stage === pause) return d.promise
    if (!(stage in outcomes)) return normal
    try { return typeof outcomes[stage] === 'function' ? outcomes[stage]() : outcomes[stage] }
    catch (error) { throw error instanceof Error ? new c.NativeError(error.message) : error }
  }
  c.createSession = async (id,title) => { h.events.push(['create',id,title]); return respond(id==='offline-owned-session'?'source':'destination',{ id }) }
  c.fetch = async (url,init) => {
    assert.ok(['/api/sessions/offline-owned-session','/api/director/sessions/offline-owned-session/handoff'].includes(url),'Exact native offline request URL')
    h.events.push(['fetch',url,init])
    if (init.method === 'PATCH') return respond('patch',patchOk)
    return respond('handoff',{ ok:true,json:async()=>{ h.events.push(['parse']); return respond('body',body) } })
  }
  evaluate(`globalThis.cleanup = (${layoutLifecycle(page,'questionSubmissionScopeRef')})();
    globalThis.retireHandoff = ${print(retirement.arguments[0])};
    globalThis.captureHandoff = () => {
      const currentSessionId = globalThis.currentSessionId;
      const user = globalThis.user;
      const pendingManualDeckBuild = globalThis.pendingManualDeckBuild;
      const manualDeckHandoffBusy = globalThis.manualDeckHandoffBusy;
      return ${code};
    }; globalThis.startHandoff = globalThis.captureHandoff();`,c)
  return { ...h,d,storage,change(kind) {
    if (kind==='unmount') c.cleanup()
    else {
      if (kind==='account') { c.authScopeUserId='other-owner'; c.user={ id:'other-owner' } }
      else c.routeSession='other-session'
      c.renderScope(); c.retireHandoff()
      if (kind==='roundtrip') { c.routeSession='offline-owned-session'; c.renderScope(); c.retireHandoff() }
    }
  } }
}
const traffic = h => h.events.filter(e=>['create','fetch','parse'].includes(e[0]))
const adoption = h => h.events.filter(e=>['disconnect','clear','messages','draft','store','manual-choice','session','navigate'].includes(e[0]))
const recovery = h => h.context.readPendingHandoff(h.context.window.sessionStorage,'offline-handoff-destination')

// Native payload and classic recovery contracts remain AST-identical to fa40582.
// Studio adds only the two validated local ownership/admission fields below;
// neither is added to the native Director request.
for (const name of ['buildSessionHandoffRequest','writeBuilderSessionOptions']) {
  const call = root => find(declaration(root,'handleStartHandoffSession'),n=>ts.isCallExpression(n)&&n.expression.getText(root)===name)
  assert.equal(print(call(page),page),print(call(oldPage),oldPage)); checks++
}
const currentPending = declaration(declaration(page,'handleStartHandoffSession'),'pendingSubmission')
assert.ok(ts.isObjectLiteralExpression(currentPending))
const unwrap = node => ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node
const localMetadata = currentPending.properties.filter(node => ts.isSpreadAssignment(node)
  && ts.isConditionalExpression(unwrap(node.expression)) && unwrap(node.expression).condition.getText(page) === 'studioShell')
assert.equal(localMetadata.length,1,'Exactly one Studio-only recovery metadata spread')
assert.equal(print(localMetadata[0],page),
  "...(studioShell ? { owner_user_id: authScopeUserId, submission_state: 'staged' as const } : {})",
  'Only exact account ownership and staged admission metadata may differ from classic')
const classicPending = ts.factory.updateObjectLiteralExpression(currentPending,
  ts.factory.createNodeArray(currentPending.properties.filter(node => node !== localMetadata[0]),
    currentPending.properties.hasTrailingComma))
assert.equal(print(classicPending,page),print(declaration(declaration(oldPage,'handleStartHandoffSession'),'pendingSubmission'),oldPage)); checks++
assert.equal(print(declaration(declaration(page,'handleStartHandoffSession'),'idempotencyKey'),page),
  print(declaration(declaration(oldPage,'handleStartHandoffSession'),'idempotencyKey'),oldPage)); checks++
const fetches = root => all(declaration(root,'handleStartHandoffSession'),n=>ts.isCallExpression(n)&&n.expression.getText(root)==='fetch').map(n=>print(n,root))
assert.deepEqual(fetches(page),fetches(oldPage)); checks++

// Frozen baseline: late A destination result disconnects/clears/navigates B.
{
  const h=harness({ code:original,pause:'destination' }), task=h.context.startHandoff(); await flush()
  assert.ok(h.events.some(e=>e[0]==='create'&&e[1]==='offline-handoff-destination'))
  h.change('route'); h.d.resolve({ id:'offline-handoff-destination' }); await task
  assert.ok(adoption(h).some(e=>e[0]==='disconnect')); assert.ok(adoption(h).some(e=>e[0]==='navigate')); checks++
}
for (const studioShell of [true,false]) for (const destination of [{ id:'offline-handoff-destination' },null]) {
  const h=harness({ studioShell,outcomes:{ destination } }); await h.context.startHandoff()
  assert.equal(traffic(h).filter(e=>e[0]==='fetch').length,2)
  assert.equal(h.events.find(e=>e[0]==='navigate')[1],'/builder?session_id=offline-handoff-destination')
  assert.equal(h.context.manualDeckHandoffBusy,false); assert.equal(h.context.inputMessage,'')
  assert.equal(recovery(h).idempotency_key,'offline-handoff-operation'); assert.equal(h.context.pendingHandoffMemoryRef.current.new_session_id,'offline-handoff-destination')
  assert.equal(h.events.filter(e=>e[0]==='session').length,destination?1:0)
  assert.equal(h.context.studioManualHandoffRequestRef.current,null); checks++
}
// Source create failure, PATCH refusal, handoff refusal/body parse failure,
// destination create failure retain the existing current-owner error contract.
for (const [stage,result,expected] of [
  ['source',null,'Could not save the customized deck to session history.'],
  ['source',()=>{throw new Error('Native source failure END')},'Native source failure END'],
  ['patch',{ ok:false },'Could not save the customized deck to session history.'],
  ['handoff',{ ok:false,json:async()=>({ detail:'Exact Director refusal END' }) },'Exact Director refusal END'],
  ['body',()=>{throw new Error('Parsing failure')},'Director could not create the new session.'],
  ['destination',()=>{throw new Error('Native destination row refusal END')},'Native destination row refusal END'],
]) {
  const h=harness({ isUnsavedSession:stage==='source',outcomes:{[stage]:result} }); await h.context.startHandoff()
  assert.equal(h.context.manualDeckHandoffError,expected); assert.equal(h.context.manualDeckHandoffBusy,false); assert.equal(adoption(h).length,0)
  assert.equal(h.events.filter(e=>e[0]==='toast').length,1)
  assert.equal(Boolean(recovery(h)),stage==='destination'); assert.equal(Boolean(h.context.pendingHandoffMemoryRef.current),stage==='destination'); checks++
}
{
  const h=harness({ storageFailure:true }); await h.context.startHandoff()
  assert.equal(recovery(h),null); assert.equal(h.context.pendingHandoffMemoryRef.current.new_session_id,'offline-handoff-destination')
  assert.ok(h.events.some(e=>e[0]==='warning')); assert.ok(h.events.some(e=>e[0]==='navigate')); checks++
}
// Every awaited native boundary: retire ownership before supplied true/false/
// thrown completion, preserve new-owner busy/request/error, and allow no next
// dispatch, adoption, storage/options write or draft clear from obsolete A.
for (const pause of ['source','patch','handoff','body','destination']) for (const change of ['route','account','roundtrip','unmount']) for (const outcome of ['true','false','throw']) {
  const h=harness({ pause }), oldHandler=h.context.startHandoff, task=oldHandler(); await flush()
  assert.equal(h.context.manualDeckHandoffBusy,true,`${pause} reached pending boundary`)
  h.change(change)
  if (change!=='unmount') assert.equal(h.context.manualDeckHandoffBusy,false,'Actual retirement effect releases obsolete busy')
  const replacement={ generation:999,sessionId:'replacement-session',userId:'replacement-owner' }
  h.context.studioManualHandoffRequestRef.current=replacement; h.context.manualDeckHandoffBusy=true
  h.context.manualDeckHandoffError='Keep new-owner error'; h.context.inputMessage='Keep new-owner unsent draft'
  const before=JSON.stringify(h.events), memory=h.context.pendingHandoffMemoryRef.current
  const successful=pause==='source'||pause==='destination'?{id:'offline-supplied-row'}:pause==='patch'?patchOk:pause==='handoff'?handoffOk:body
  outcome==='throw'?h.d.reject(new Error('Late supplied rejection END')):h.d.resolve(outcome==='true'?successful:false)
  await task
  assert.equal(JSON.stringify(h.events),before,`${pause}/${change}/${outcome}: no late effects`)
  assert.equal(h.context.studioManualHandoffRequestRef.current,replacement); assert.equal(h.context.manualDeckHandoffBusy,true)
  assert.equal(h.context.manualDeckHandoffError,'Keep new-owner error'); assert.equal(h.context.inputMessage,'Keep new-owner unsent draft')
  assert.equal(h.context.pendingHandoffMemoryRef.current,memory)
  assert.equal(Boolean(recovery(h)),pause==='destination','Known Director destination recovery survives retirement; earlier boundary creates no recovery claim'); checks++
}
// Synchronously repeated captured handler calls cannot dispatch twice before a
// React state render; the native request token is the immediate pending guard.
for (const pause of ['source','patch','handoff','body','destination']) {
  const h=harness({ pause }), captured=h.context.startHandoff, task=captured(); await flush(); const before=JSON.stringify(h.events)
  await captured(); assert.equal(JSON.stringify(h.events),before)
  const successful=pause==='source'||pause==='destination'?{id:'offline-supplied-row'}:pause==='patch'?patchOk:pause==='handoff'?handoffOk:body
  h.d.resolve(successful); await task; assert.equal(h.events.filter(e=>e[0]==='navigate').length,1); checks++
}
// A captured old callback cannot start fresh work in route/account loader gaps.
for (const change of ['route','account','unmount']) {
  const h=harness(), old=h.context.startHandoff; h.change(change); const before=JSON.stringify(h.events)
  await old(); assert.equal(JSON.stringify(h.events),before,`Old ${change} handler dispatches nothing`); checks++
}
// Start B through the actual new native callback/token (not only a sentinel).
// A completion cannot release B's token/busy while B's PATCH remains pending.
for (const pause of ['source','patch','handoff','body','destination']) {
  const h=harness({ pause }), a=h.context.startHandoff(); await flush(); h.change('route')
  const c=h.context, bDeferred=deferred()
  c.currentSessionId='other-session'; c.wsSessionId='other-session'; c.isUnsavedSession=false; c.renderScope(); c.retireHandoff()
  c.pendingManualDeckBuild={ ...c.pendingManualDeckBuild,operationId:'offline-operation-B',messageText:'Separate B pending request' }
  c.fetch=async(url,init)=>{ assert.equal(url,'/api/sessions/other-session'); assert.equal(init.method,'PATCH'); h.events.push(['new-owner-fetch',url]); return bDeferred.promise }
  const b=c.captureHandoff()(); await flush(); const bToken=c.studioManualHandoffRequestRef.current
  assert.ok(bToken); assert.equal(bToken.sessionId,'other-session'); assert.equal(c.manualDeckHandoffBusy,true)
  const before=JSON.stringify(h.events)
  const successful=pause==='source'||pause==='destination'?{id:'offline-supplied-row'}:pause==='patch'?patchOk:pause==='handoff'?handoffOk:body
  h.d.resolve(successful); await a
  assert.equal(JSON.stringify(h.events),before); assert.equal(c.studioManualHandoffRequestRef.current,bToken); assert.equal(c.manualDeckHandoffBusy,true)
  bDeferred.resolve({ok:false}); await b; assert.equal(c.studioManualHandoffRequestRef.current,null); assert.equal(c.manualDeckHandoffBusy,false); checks++
}
for (const extra of [{pendingManualDeckBuild:null},{currentSessionId:null,wsSessionId:null},{user:null},{manualDeckHandoffBusy:true}]) {
  const h=harness(extra); await h.context.startHandoff(); assert.equal(h.events.length,0); checks++
}
// Returning to A permits an explicit new invocation with the same operation
// idempotency key after the previous request has been retired, never adoption
// by the previous still-pending invocation.
{
  const h=harness({pause:'patch'}), first=h.context.startHandoff(); await flush(); h.change('roundtrip')
  h.context.fetch=async(url,init)=>{ h.events.push(['retry-fetch',url,init]); return init.method==='PATCH'?patchOk:handoffOk }
  await h.context.captureHandoff()(); const before=JSON.stringify(h.events)
  assert.ok(h.events.some(e=>e[0]==='navigate')); h.d.resolve(patchOk); await first
  assert.equal(JSON.stringify(h.events),before)
  const request=h.events.find(e=>e[0]==='retry-fetch'&&e[2].method==='POST')
  assert.equal(JSON.parse(request[2].body).idempotency_key,'offline-handoff-operation'); checks++
}
// Native request and recovery metadata retain all actual selected options,
// attached-file snapshot rules and template overrides without provider paths.
{
  const h=harness({ activeTemplate:{id:'offline-template',ready:true},buildThemeSelection:{mode:'another_deck',presentation_id:'offline-theme-deck'},
    researchEnabled:false,webSearchEnabled:true,extendedGenerationEnabled:false,knowledgeGraphEnabled:false,
    hasTemplateOverrides:true,templateOverrides:{slotA:{intent:'Keep original'}},
    uploadedFiles:[{id:'file-A',name:'Complete source name.pdf',size:123,type:'application/pdf',status:'success',storage_path:'must-not-leak'},{id:'file-B',name:'Pending file.pdf',status:'uploading'}] })
  await h.context.startHandoff()
  const request=JSON.parse(h.events.find(e=>e[0]==='fetch'&&e[2].method==='POST')[2].body), saved=recovery(h)
  assert.equal(request.user_id,'offline-owner'); assert.equal(request.template_id,'offline-template'); assert.equal(request.template_mode,true)
  assert.deepEqual(request.research,{deep_research:false,web_search:true,use_knowledge_graph:false})
  assert.equal(request.store_name,'offline-linked-store'); assert.deepEqual(request.theme,{mode:'another_deck',presentation_id:'offline-theme-deck'})
  assert.equal(saved.file_count,1); assert.deepEqual(JSON.parse(JSON.stringify(saved.attachments)),[{id:'file-A',name:'Complete source name.pdf',size:123,type:'application/pdf'}])
  assert.deepEqual(JSON.parse(JSON.stringify(saved.element_overrides)),{slotA:{intent:'Keep original'}})
  assert.equal(saved.extended_generation,false); assert.equal(saved.text,'A synthetic native request'); checks++
}
// Classic retains original late adoption and does not acquire Studio tokens.
{
  const h=harness({studioShell:false,pause:'destination'}),task=h.context.startHandoff(); await flush(); h.change('route')
  h.d.resolve(null); await task; assert.ok(h.events.some(e=>e[0]==='navigate')); assert.equal(h.context.studioManualHandoffRequestRef.current,null); checks++
}
console.log(`Manual handoff: ${checks} actual-callback offline checks passed; baseline fa40582 defect reproduced, native payload/recovery parity and five-boundary ownership fences. No network/service ACK.`)
