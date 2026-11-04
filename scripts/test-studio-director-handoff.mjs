// Entire actual hook, real pure contracts, local cache/socket/effect fixture.
// No real auth, token, browser, HTTP or Director operation is exercised.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import { createFirstSendHookHarness } from '../docs/studio-v4/eight-hour-parity-20261005/builder1/director-handoff/test-fixtures/actual-hook.mjs'

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const file = 'hooks/use-deckster-websocket-v2.ts'
const packet = path.join(root, 'docs/studio-v4/eight-hour-parity-20261005/builder1/director-handoff')
const before = fs.readFileSync(path.join(packet, 'pre-handoff-hook.ts'), 'utf8')
const useBefore = process.argv.includes('--before')
const source = useBefore ? before : fs.readFileSync(path.join(root, file), 'utf8')
const uatRef = 'ee532fab4b84a6883f8a5b50675ccab692b62240'
const uatBefore = execFileSync('git', ['show', `${uatRef}:${file}`], { cwd: root, encoding: 'utf8' })
const plain = value => JSON.parse(JSON.stringify(value))
const modules = new Map()
function pure(name) {
  if (modules.has(name)) return modules.get(name)
  const module = { exports: {} }; modules.set(name, module.exports)
  const source = fs.readFileSync(path.join(root, name), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(compiled, { module, exports: module.exports, URL, process: { env: {} }, require(specifier) {
    if (specifier.startsWith('@/lib/')) return pure(`lib/${specifier.slice('@/lib/'.length)}.ts`)
    if (specifier.startsWith('./')) return pure(path.join(path.dirname(name), specifier) + '.ts')
    throw Error(`Unexpected pure dependency ${specifier}`)
  } })
  return module.exports
}
const session = 'synthetic-session', deck = 'synthetic-deck', origin = 'https://synthetic-layout.invalid'
const policy = pure('lib/layout-viewer-url-policy.ts')
const dependencies = Object.fromEntries(['slide-compose-async', 'director-layout-url-ingress', 'director-sync-recovery', 'director-chat-history', 'director-history-presentation', 'layout-viewer-url-policy', 'composer-theme-policy', 'build-control-helpers'].map(name => [`@/lib/${name}`, pure(`lib/${name}.ts`)]))
dependencies['@/lib/layout-service-client'] = { LAYOUT_VIEWER_URL_POLICY: policy.createLayoutViewerUrlPolicy(origin) }

const identity = { sessionId: session, userId: 'synthetic-owner', idempotencyKey: 'synthetic-handoff-key' }
const frame = (status = 'processing', extra = {}) => ({ type: 'handoff_request_status', session_id: session, payload: { idempotency_key: identity.idempotencyKey, status, ...extra } })
async function fixture({ sourceOverride, expected, restore = true, callbacks = {} } = {}) {
  const writes = [], notices = [], generic = [], failures = []
  let cache = null
  const h = createFirstSendHookHarness({ existingSessionId: session, expectedHandoffRequest: expected, onHandoffRequestStatus: (status, owner) => { notices.push({ status, owner }); callbacks.onStatus?.(status, owner) }, onMessage: message => generic.push(message), onError: error => failures.push(error) }, sourceOverride || source, { ...dependencies,
    './use-session-cache': { useSessionCache: () => ({ getCachedState: () => cache, isCacheValid: () => Boolean(cache), setCachedState: value => { cache = { ...(cache || {}), ...value }; writes.push(plain(value)) }, clearCache: () => { cache = null } }) },
  })
  await h.token(0, { auth_enabled: false }); h.sockets[0].open()
  if (restore) { h.api.restoreMessages([{ type: 'chat_message', session_id: session, message_id: 'synthetic-durable', timestamp: '2026-10-05T00:00:00Z', payload: { text: 'Keep durable prose' } }]); await h.advance(0) }
  return { h, writes, notices, generic, failures,
    async send(key = identity.idempotencyKey) { const result = h.api.sendMessage('Synthetic pending handoff', undefined, 0, { handoffIdempotencyKey: key, extendedGeneration: false }); await h.advance(0); return result },
    async deliver(message) { h.sockets.at(-1).onmessage({ data: JSON.stringify(message) }); await h.advance(0) },
  }
}
let checks = 0; const failed = []
async function check(label, fn) { try { await fn(); checks++; console.log(`PASS ${label}`) } catch (error) { failed.push(label); console.error(`FAIL ${label}: ${error.message}`) } }
for (const [label, baseline] of [['frozen d971', before], ['exact UAT ee532fab', uatBefore]]) await check(`${label} actual hook drops handoff statuses despite a keyed native send`, async () => {
  const f = await fixture({ sourceOverride: baseline }); assert.equal(await f.send(), true)
  for (const status of ['processing', 'already_processing', 'already_completed', 'failed']) await f.deliver(frame(status, status === 'failed' ? { error: 'Synthetic matching-key refusal' } : {}))
  assert.equal(f.notices.length, 0); assert.equal(f.h.api.handoffRequestStatus, undefined); assert.equal(f.h.api.awaitingDirectorReply, true)
})
for (const status of ['processing', 'already_processing', 'already_completed', 'failed']) for (const priming of ['sent', 'expected', 'restored']) await check(`${status} admitted only for exact ${priming} owned request; no native/cache/transcript effect`, async () => {
  const f = await fixture({ restore: priming !== 'expected', expected: priming === 'expected' ? identity : undefined })
  if (priming === 'sent') assert.equal(await f.send(), true)
  if (priming === 'restored') assert.equal(f.h.api.trackHandoffRequest(identity), true)
  const writes = f.writes.length, sends = f.h.sockets[0].sends.length
  const beforeMessages = plain(f.h.api.messages)
  await f.deliver(frame(status, status === 'failed' ? { error: 'Synthetic durable refusal', unknown: 'ignored' } : {}))
  assert.equal(f.notices.length, 1); const { status:notice, owner } = f.notices[0]
  assert.equal(notice.sessionId, session); assert.equal(notice.idempotencyKey, identity.idempotencyKey); assert.equal(notice.status, status); assert.deepEqual(plain(f.h.api.handoffRequestStatus), plain(notice))
  if (status === 'failed') assert.equal(notice.error, 'Synthetic durable refusal')
  assert.equal(notice.unknown, undefined); assert.equal(owner.sessionId, session); assert.equal(owner.userId, identity.userId); assert.equal(owner.idempotencyKey, identity.idempotencyKey); assert.ok(Number.isInteger(owner.requestGeneration)); assert.ok(Number.isInteger(owner.transportGeneration)); assert.equal(owner.isCurrent(), true)
  assert.equal(f.h.api.awaitingDirectorReply, false); assert.equal(f.writes.length, writes); assert.deepEqual(plain(f.h.api.messages), beforeMessages); assert.equal(f.generic.length, 0); assert.equal(f.failures.length, 0); assert.equal(f.h.sockets[0].sends.length, sends)
})
for (const [name, mutate] of [
  ['foreign session', m => ({ ...m, session_id: 'synthetic-foreign' })],
  ['missing session', m => { delete m.session_id; return m }],
  ['foreign key', m => ({ ...m, payload: { ...m.payload, idempotency_key: 'synthetic-other' } })],
  ['missing key', m => { delete m.payload.idempotency_key; return m }],
  ['numeric key', m => ({ ...m, payload: { ...m.payload, idempotency_key: 1 } })],
  ['persisted-only completed', m => ({ ...m, payload: { ...m.payload, status: 'completed' } })],
  ['persisted-only retryable_failed', m => ({ ...m, payload: { ...m.payload, status: 'retryable_failed' } })],
  ['unknown status', m => ({ ...m, payload: { ...m.payload, status: 'ready' } })],
  ['malformed error', m => ({ ...m, payload: { ...m.payload, error: { nested: 'not supported' } } })],
  ['array payload', m => ({ ...m, payload: [] })],
]) await check(`handoff refuses ${name} without notice/cache/transcript or turn unlock`, async () => {
  const f = await fixture(); await f.send(); const writes = f.writes.length
  await f.deliver(mutate(frame())); assert.equal(f.notices.length, 0); assert.equal(f.h.api.handoffRequestStatus, null); assert.equal(f.h.api.awaitingDirectorReply, true); assert.equal(f.writes.length, writes); assert.equal(f.h.api.messages.length, 1)
})
await check('unregistered unsolicited handoff key cannot manufacture owned progress', async () => {
  const f = await fixture(); await f.deliver(frame()); assert.equal(f.notices.length, 0); assert.equal(f.h.api.handoffRequestStatus, null)
})
await check('local failed send does not prime a request or accept subsequent status', async () => {
  const f = await fixture(); const ws = f.h.sockets[0]; ws.send = () => { throw Error('Synthetic local send refusal') }; assert.equal(await f.send(), false); await f.deliver(frame()); assert.equal(f.notices.length, 0); assert.equal(f.h.api.handoffRequestStatus, null)
})
for (const invalid of [{ ...identity, sessionId: 'foreign' }, { ...identity, userId: 'other' }, { ...identity, idempotencyKey: '   ' }]) await check(`known restore prime rejects foreign/empty identity ${JSON.stringify(invalid)}`, async () => {
  const f = await fixture(); assert.equal(f.h.api.trackHandoffRequest(invalid), false); await f.deliver(frame()); assert.equal(f.notices.length, 0)
})
for (const retirement of ['disconnect', 'session', 'account', 'account-ABA', 'unmount', 'clear', 'restore', 'key', 'expected-removal']) await check(`retained request owner retires across ${retirement}`, async () => {
  const f = await fixture(); await f.send(); await f.deliver(frame()); const owner = f.notices[0].owner, receive = f.h.sockets[0].onmessage
  if (retirement === 'disconnect') f.h.disconnect()
  if (retirement === 'session') f.h.adopt('synthetic-session-B')
  if (retirement === 'account' || retirement === 'account-ABA') { f.h.account({ id:'synthetic-owner-B' }); if (retirement === 'account-ABA') f.h.account({ id:identity.userId }) }
  if (retirement === 'unmount') f.h.unmount()
  if (retirement === 'clear') f.h.api.clearMessages()
  if (retirement === 'restore') f.h.api.restoreMessages(f.h.api.messages)
  if (retirement === 'key') await f.send('synthetic-new-key')
  if (retirement === 'expected-removal') { f.h.options({ expectedHandoffRequest: identity }); f.h.options({ expectedHandoffRequest: null }) }
  assert.equal(owner.isCurrent(), false, 'synchronous retirement before paint')
  receive({ data: JSON.stringify(frame('failed',{ error:'Late synthetic old request refusal' })) }); await f.h.advance(0); assert.equal(f.notices.length, 1)
})
await check('same key explicit retry retires prior callback owner and never retries automatically', async () => {
  const f = await fixture(); await f.send(); await f.deliver(frame('failed',{ error:'Synthetic failed attempt' })); const old = f.notices[0].owner; assert.equal(f.h.sockets[0].sends.length, 1); assert.equal(await f.send(), true); assert.equal(old.isCurrent(), false); await f.deliver(frame('already_processing')); assert.equal(f.notices.length, 2); assert.notEqual(f.notices[1].owner.requestGeneration, old.requestGeneration); assert.equal(f.h.sockets[0].sends.length, 2)
})
await check('late valid handoff status cannot unlock a newer unkeyed user turn', async () => {
  const f = await fixture(); await f.send(); f.h.api.sendMessage('Synthetic unrelated newer turn'); await f.h.advance(0); await f.deliver(frame('failed',{ error:'Late owned request failure' })); assert.equal(f.h.api.awaitingDirectorReply, true); assert.equal(f.h.api.handoffRequestStatus.status, 'failed'); assert.equal(f.h.sockets[0].sends.length, 2)
})
await check('same-session reconnect admits known key on new socket without replay and retires prior callback', async () => {
  const f = await fixture(); await f.send(); await f.deliver(frame()); const old = f.notices[0].owner; f.h.sockets[0].close(1006); await f.h.advance(1500); await f.h.token(1,{ auth_enabled:false }); f.h.sockets[1].open(); assert.equal(old.isCurrent(),false); await f.deliver(frame('already_completed')); assert.equal(f.notices.length,2); assert.equal(f.h.sockets[1].sends.length,0); assert.equal(f.h.api.handoffRequestStatus.status,'already_completed'); assert.equal(f.h.api.presentationId,null)
})
await check('restore retires old key; explicit owned prime restores notice ingress without send', async () => {
  const f = await fixture(); await f.send(); f.h.api.restoreMessages(f.h.api.messages); await f.h.advance(0); await f.deliver(frame()); assert.equal(f.notices.length,0); assert.equal(f.h.api.trackHandoffRequest(identity),true); await f.deliver(frame('already_processing')); assert.equal(f.notices.length,1); assert.equal(f.h.sockets[0].sends.length,1)
})
await check('expected key never binds to another signed-in account', async () => {
  const f = await fixture({ expected:identity,restore:false }); f.h.account({ id:'other-owner' }); await f.deliver(frame()); assert.equal(f.notices.length,0); assert.equal(f.h.api.handoffRequestStatus,null)
})


await check('sent key whitespace matches exact backend trim without changing outgoing wire', async () => {
  const f = await fixture(); await f.send(` ${identity.idempotencyKey} `); assert.equal(JSON.parse(f.h.sockets[0].sends[0]).data.handoff_idempotency_key, ` ${identity.idempotencyKey} `); await f.deliver(frame()); assert.equal(f.notices.length,1); assert.equal(f.notices[0].owner.idempotencyKey,identity.idempotencyKey)
})
await check('known restore key uses backend canonical trim', async () => {
  const f = await fixture(); assert.equal(f.h.api.trackHandoffRequest({ ...identity,idempotencyKey:` ${identity.idempotencyKey} ` }),true); await f.deliver(frame()); assert.equal(f.notices.length,1)
})
await check('foreign optional payload session cannot paint known handoff status', async () => {
  const f = await fixture(); await f.send(); await f.deliver(frame('failed',{ error:'Synthetic reason',session_id:'foreign' })); assert.equal(f.notices.length,0); assert.equal(f.h.api.handoffRequestStatus,null)
})
await check('optional callback absence still exposes truthful notice without generic error', async () => {
  const f = await fixture(); f.h.options({ onHandoffRequestStatus:undefined }); await f.send(); await f.deliver(frame('failed',{ error:'Synthetic durable refusal' })); assert.equal(f.h.api.handoffRequestStatus.error,'Synthetic durable refusal'); assert.equal(f.notices.length,0); assert.equal(f.failures.length,0); assert.equal(f.generic.length,0)
})

await check('known expected identity survives mount cleanup/setup without reviving an old callback or replaying', async () => {
  const f = await fixture({ expected:identity,restore:false }); await f.deliver(frame()); const owner=f.notices[0].owner; f.h.replayMountEffects(); await f.h.token(1,{ auth_enabled:false }); f.h.sockets[1].open(); await f.deliver(frame('already_processing')); assert.equal(owner.isCurrent(),false); assert.equal(f.notices.length,2); assert.equal(f.notices[1].owner.isCurrent(),true); assert.equal(f.h.sockets[1].sends.length,0)
})
function reverseHandoffAdditions(text) {
  return text
    .replace(/export interface DirectorHandoffRequestIdentity \{[\s\S]*?(?=export class DirectorTransportError)/, '')
    .replace(/^  handoffRequestStatus: DirectorHandoffRequestStatus \| null;\n/m, '')
    .replace(/^  \/\/ Known pending identity only; this never sends\/retries the durable request\.\n  expectedHandoffRequest\?: DirectorHandoffRequestIdentity \| null;\n  onHandoffRequestStatus\?: \(status: DirectorHandoffRequestStatus, owner: DirectorHandoffRequestOwner\) => void;\n/m, '')
    .replace(/^ +handoffRequestStatus: null,\n/gm, '')
    .replace(/  const handoffRequestRef = useRef<TrackedHandoffRequest \| null>\(null\);[\s\S]*?(?=  \/\/ Ephemeral per-connection capability\.)/, '')
    .replace(/            \/\/ The durable handoff acknowledgement has session\/key identity,[\s\S]*?(?=            \/\/ These server frames intentionally omit)/, '')
    .replace(/      const turnSequence = \+\+sentTurnSequenceRef\.current;[\s\S]*?(?=      \/\/ Only an explicit)/, '')
    .replace(/^    retireHandoffRequest\(\);\n/gm, '')
    .replace(/retireDeckMutationOwner, retireHandoffRequest, sessionCache/g, 'retireDeckMutationOwner, sessionCache')
    .replace(/^    trackHandoffRequest,\n/m, '')
}
await check('whole d971 source preserved byte-for-byte outside explicit handoff additions', async () => assert.equal(reverseHandoffAdditions(source), before))
await check('whole source preservation guard catches unrelated changed generation default', async () => {
  const changed = source.replace('extended_generation: options?.extendedGeneration ?? true', 'extended_generation: options?.extendedGeneration ?? false')
  assert.throws(() => assert.equal(reverseHandoffAdditions(changed), before))
})
console.log(`${checks} actual hook handoff cases passed; ${failed.length} failed. Synthetic local frames only.`)
if (failed.length) process.exitCode=1
