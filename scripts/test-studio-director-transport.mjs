// Entire actual hook, real pure contracts, local cache/socket/effect fixture.
// No real auth, token, browser, HTTP or Director operation is exercised.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import { createFirstSendHookHarness } from '../docs/studio-v4/eight-hour-parity-20261005/builder1/director-transport/test-fixtures/actual-hook.mjs'

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const file = 'hooks/use-deckster-websocket-v2.ts'
const beforeRef = 'bc4616a279940374a0b54bed56c5c6cf1b4f60ab'
const sourceRef = process.argv.find(argument => argument.startsWith('--source-ref='))?.slice('--source-ref='.length)
const source = sourceRef ? execFileSync('git', ['show', `${sourceRef}:${file}`], { cwd: root, encoding: 'utf8' }) : fs.readFileSync(path.join(root, file), 'utf8')
const before = execFileSync('git', ['show', `${beforeRef}:${file}`], { cwd: root, encoding: 'utf8' })
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
const frame = (type, payload, id = `synthetic-${type}`) => ({ type, message_id: id, session_id: session, timestamp: '2026-10-05T00:00:00Z', payload })
const mutation = (kind = 'slide_added', extra = {}) => frame('deck_mutation', { mutation: kind, slide_index: 1, presentation_id: deck, presentation_url: `${origin}/p/${deck}`, refresh_token: 'synthetic-refresh', ...extra })
async function fixture({ old = false, sourceOverride, callbacks = {}, receiveMutations = true } = {}) {
  let cache = null
  const writes = [], events = [], notices = [], failures = [], generic = []
  const h = createFirstSendHookHarness({ existingSessionId: session, onDeckMutation: receiveMutations ? (message, owner) => { events.push({ message, owner }); callbacks.onDeckMutation?.(message, owner) } : undefined, onTransportNotice: (notice, owner) => { notices.push({ notice, owner }); callbacks.onTransportNotice?.(notice, owner) }, onError: error => { failures.push(error); callbacks.onError?.(error) }, onMessage: message => generic.push(message) }, sourceOverride || (old ? before : source), { ...dependencies,
    './use-session-cache': { useSessionCache: () => ({ getCachedState: () => cache, isCacheValid: () => Boolean(cache), setCachedState: value => { cache = { ...(cache || {}), ...value }; writes.push(plain(value)) }, clearCache: () => { cache = null } }) },
  })
  await h.token(0, { auth_enabled: false }); h.sockets[0].open()
  h.api.restoreMessages([frame('chat_message', { text: 'Keep durable prose' }, 'synthetic-durable')], { deckOwnerSessionId: session, activeVersion: 'final', finalPresentationId: deck, finalPresentationUrl: `${origin}/p/${deck}`, presentationId: deck, presentationUrl: `${origin}/p/${deck}`, currentStage: 6, slideCount: 3 })
  await h.advance(0)
  return { h, writes, events, notices, failures, generic, get cache() { return cache }, async deliver(message) { h.sockets.at(-1).onmessage({ data: JSON.stringify(message) }); await h.advance(0) } }
}
let checks = 0
const failed = []
async function check(label, fn) { try { await fn(); checks++; console.log(`PASS ${label}`) } catch (error) { failed.push(label); console.error(`FAIL ${label}: ${error.message}`) } }

await check('pinned pre-change hook drops supported deck_mutation/auth/error frames', async () => {
  const f = await fixture({ old: true })
  for (const message of [mutation(), { type: 'auth_refreshed', payload: { expires_at: 1000 } }, { type: 'auth_refresh_failed', payload: { code: 'WS_AUTH_REFRESH_REJECTED', message: 'Synthetic refusal' } }, { type: 'auth_expired', payload: { code: 'WS_AUTH_EXPIRED', message: 'Synthetic expiry', discarded_message_type: 'user_message' } }, { type: 'error', payload: { code: 'PROCESSING_FAILED', message: 'Synthetic processing failure', detail: 'Synthetic detail' } }]) await f.deliver(message)
  assert.equal(f.events.length, 0); assert.equal(f.notices.length, 0); assert.equal(f.failures.length, 0); assert.equal(f.h.api.transportNotice, undefined)
})

await check('exact UAT ee532fab hook reproduces both inherited ingress drops', async () => {
  const f = await fixture({ sourceOverride: uatBefore })
  for (const message of [mutation(), { type: 'auth_refreshed', payload: { expires_at: 1000 } }, { type: 'auth_refresh_failed', payload: { code: 'WS_AUTH_REFRESH_REJECTED', message: 'Synthetic refusal' } }, { type: 'auth_expired', payload: { code: 'WS_AUTH_EXPIRED', message: 'Synthetic expiry', discarded_message_type: 'user_message' } }, { type: 'error', payload: { code: 'PROCESSING_FAILED', message: 'Synthetic processing failure', detail: 'Synthetic detail' } }]) await f.deliver(message)
  assert.equal(f.events.length, 0); assert.equal(f.notices.length, 0); assert.equal(f.failures.length, 0); assert.equal(f.h.api.transportNotice, undefined); assert.equal(f.h.api.messages[0].payload.text, 'Keep durable prose')
})

for (const kind of ['slide_added', 'slide_deleted', 'slide_replaced', 'slide_reordered']) await check(`supported owned ${kind} exposes exact mutation + current context once`, async () => {
  const f = await fixture(), message = mutation(kind, kind === 'slide_reordered' ? { new_slide_index: 0 } : {})
  const initial = plain({ messages: f.h.api.messages, count: f.h.api.slideCount, url: f.h.api.presentationUrl, id: f.h.api.presentationId }), writes = f.writes.length
  await f.deliver(message); await f.deliver(message)
  assert.equal(f.events.length, 1); assert.deepEqual(plain(f.events[0].message), message)
  const owner = f.events[0].owner
  assert.equal(owner.sessionId, session); assert.equal(owner.userId, 'synthetic-owner'); assert.equal(owner.presentationId, deck); assert.equal(owner.activeVersion, 'final'); assert.ok(Number.isInteger(owner.transportGeneration)); assert.equal(owner.isCurrent(), true)
  assert.deepEqual(plain({ messages: f.h.api.messages, count: f.h.api.slideCount, url: f.h.api.presentationUrl, id: f.h.api.presentationId }), initial)
  assert.equal(f.writes.length, writes); assert.equal(f.generic.length, 0); assert.equal(f.h.sockets[0].sends.length, 0)
})
for (const [name, change] of [
  ['foreign-session', m => ({ ...m, session_id: 'synthetic-foreign' })],
  ['missing-session', m => { delete m.session_id; return m }],
  ['foreign-presentation', m => ({ ...m, payload: { ...m.payload, presentation_id: 'synthetic-foreign-deck' } })],
  ['unapproved-url', m => ({ ...m, payload: { ...m.payload, presentation_url: 'https://foreign.invalid/p/synthetic-deck' } })],
  ['url-id-mismatch', m => ({ ...m, payload: { ...m.payload, presentation_url: `${origin}/p/different-deck` } })],
  ['unsupported-kind', m => ({ ...m, payload: { ...m.payload, mutation: 'delete_everything' } })],
  ['negative-index', m => ({ ...m, payload: { ...m.payload, slide_index: -1 } })],
  ['fraction-index', m => ({ ...m, payload: { ...m.payload, slide_index: 1.5 } })],
  ['negative-reorder', m => ({ ...m, payload: { ...m.payload, new_slide_index: -1 } })],
  ['missing-id', m => { delete m.message_id; return m }],
  ['missing-refresh', m => { delete m.payload.refresh_token; return m }],
]) await check(`deck mutation refuses ${name} without state/cache/callback side effects`, async () => {
  const f = await fixture(), writes = f.writes.length
  await f.deliver(change(mutation()))
  assert.equal(f.events.length, 0); assert.equal(f.writes.length, writes); assert.equal(f.generic.length, 0); assert.equal(f.h.api.messages.length, 1)
})
await check('optional mutation viewer URL may be omitted for exact owned presentation', async () => {
  const f = await fixture(), message = mutation(); delete message.payload.presentation_url; await f.deliver(message); assert.equal(f.events.length, 1)
})
for (const change of ['disconnect', 'session', 'account', 'unmount', 'version', 'restore', 'clear', 'version-ABA']) await check(`retained mutation ownership fence retires across ${change}`, async () => {
  const f = await fixture(); await f.deliver(mutation()); const owner = f.events[0].owner
  if (change === 'disconnect') f.h.disconnect()
  if (change === 'session') f.h.adopt('synthetic-session-B')
  if (change === 'account') f.h.account({ id: 'synthetic-owner-B' })
  if (change === 'unmount') f.h.unmount()
  if (change === 'version' || change === 'version-ABA') { f.h.api.switchVersion('strawman'); assert.equal(owner.isCurrent(), false, 'synchronous version retirement'); await f.h.advance(0); if (change === 'version-ABA') { f.h.api.switchVersion('final'); await f.h.advance(0) } }
  if (change === 'restore') { f.h.api.restoreMessages(f.h.api.messages, { presentationId: deck, presentationUrl: `${origin}/p/${deck}`, finalPresentationId: deck, finalPresentationUrl: `${origin}/p/${deck}`, deckOwnerSessionId: session }); assert.equal(owner.isCurrent(), false); await f.h.advance(0) }
  if (change === 'clear') { f.h.api.clearMessages(); assert.equal(owner.isCurrent(), false); await f.h.advance(0) }
  assert.equal(owner.isCurrent(), false)
})
for (const type of ['auth_refreshed', 'auth_refresh_failed', 'auth_expired', 'error']) await check(`raw ${type} retains supported metadata outside transcript/cache`, async () => {
  const f = await fixture(), writes = f.writes.length
  const payload = type === 'auth_refreshed' ? { expires_at: 1000 } : { code: type === 'auth_expired' ? 'WS_AUTH_EXPIRED' : type === 'error' ? 'PROCESSING_FAILED' : 'WS_AUTH_REFRESH_REJECTED', message: 'Synthetic transport reason', ...(type === 'auth_expired' ? { discarded_message_type: 'user_message' } : {}), ...(type === 'error' ? { detail: 'Synthetic processing detail' } : {}), unsupported_extra: 'not retained' }
  await f.deliver({ type, timestamp: '2026-10-05T00:00:00Z', payload })
  assert.equal(f.h.api.transportNotice.type, type); assert.equal(f.h.api.transportNotice.sessionId, session); assert.equal(f.notices.length, 1); assert.equal(f.notices[0].owner.isCurrent(), true)
  if (type === 'auth_refreshed') { assert.equal(f.h.api.transportNotice.expiresAt, 1000); assert.equal(f.failures.length, 0) }
  else { assert.equal(f.h.api.transportNotice.code, payload.code); assert.equal(f.h.api.error.message, payload.message); assert.equal(f.failures.length, 1) }
  if (type === 'auth_expired') { assert.equal(f.h.api.transportNotice.discardedMessageType, 'user_message'); assert.equal(f.h.api.transportNotice.requiresResend, true) }
  if (type === 'error') assert.equal(f.h.api.transportNotice.detail, 'Synthetic processing detail')
  assert.equal(f.h.api.transportNotice.unsupported_extra, undefined); assert.equal(f.h.api.messages.length, 1); assert.equal(f.writes.length, writes); assert.equal(f.generic.length, 0); assert.equal(f.h.sockets[0].sends.length, 0)
})
for (const type of ['auth_refreshed', 'auth_refresh_failed', 'auth_expired', 'error']) await check(`raw ${type} foreign optional session cannot paint transport notice`, async () => {
  const f = await fixture(); await f.deliver({ type, session_id: 'synthetic-session-B', payload: { expires_at: 1000, code: 'SYNTHETIC', message: 'Foreign reason' } }); assert.equal(f.h.api.transportNotice, null); assert.equal(f.notices.length, 0); assert.equal(f.failures.length, 0)
})
await check('discarded/error turn unlocks input without replay; passive refresh acknowledgement does not unlock', async () => {
  const f = await fixture(); assert.equal(f.h.api.sendMessage('Synthetic explicit user action'), true); await f.h.advance(0); assert.equal(f.h.api.awaitingDirectorReply, true)
  await f.deliver({ type: 'auth_refreshed', payload: { expires_at: 1000 } }); assert.equal(f.h.api.awaitingDirectorReply, true)
  await f.deliver({ type: 'auth_expired', payload: { code: 'WS_AUTH_EXPIRED', message: 'Please resend the last action', discarded_message_type: 'user_message' } }); assert.equal(f.h.api.awaitingDirectorReply, false); assert.equal(f.h.sockets[0].sends.length, 1)
  f.h.sockets[0].close(4003); await f.h.advance(1500); await f.h.token(1, { auth_enabled: false }); f.h.sockets[1].open(); await f.h.advance(0)
  assert.equal(f.h.sockets[1].sends.length, 0); assert.equal(f.h.api.transportNotice.requiresResend, true); assert.equal(f.h.api.messages[0].payload.text, 'Keep durable prose')
  assert.equal(f.h.api.sendMessage('Synthetic explicit manual resend'), true); await f.h.advance(0); assert.equal(f.h.sockets[1].sends.length, 1); assert.equal(f.h.api.transportNotice, null); await f.deliver({ type: 'auth_refreshed', payload: { expires_at: 2000 } }); assert.equal(f.h.api.transportNotice.requiresResend, false)
})
for (const type of ['deck_mutation', 'auth_expired', 'error']) await check(`stale closed socket ${type} cannot publish callbacks/errors`, async () => {
  const f = await fixture(), receive = f.h.sockets[0].onmessage; f.h.disconnect()
  receive({ data: JSON.stringify(type === 'deck_mutation' ? mutation() : { type, payload: { code: 'SYNTHETIC', message: 'Old reason' } }) }); await f.h.advance(0)
  assert.equal(f.events.length, 0); assert.equal(f.notices.length, 0); assert.equal(f.failures.length, 0)
})

await check('same message ID with a changed refresh token cannot deliver a second mutation', async () => {
  const f = await fixture(); await f.deliver(mutation()); await f.deliver(mutation('slide_added', { refresh_token: 'changed-synthetic-refresh' })); assert.equal(f.events.length, 1)
})
await check('supported completion unlocks the current turn even when callback is omitted', async () => {
  const f = await fixture({ receiveMutations: false }); f.h.api.sendMessage('Synthetic action'); await f.h.advance(0); assert.equal(f.h.api.awaitingDirectorReply, true); await f.deliver(mutation()); assert.equal(f.h.api.awaitingDirectorReply, false); assert.equal(f.events.length, 0); assert.equal(f.h.sockets[0].sends.length, 1)
})
await check('acknowledgement after discarded action preserves resend guidance identically in state/callback', async () => {
  const f = await fixture(); await f.deliver({ type: 'auth_expired', payload: { code: 'WS_AUTH_EXPIRED', message: 'Resend synthetic action', discarded_message_type: 'user_message' } }); await f.deliver({ type: 'auth_refreshed', payload: { expires_at: 1000 } }); assert.equal(f.h.api.transportNotice.requiresResend, true); assert.deepEqual(plain(f.h.api.transportNotice), plain(f.notices.at(-1).notice)); assert.equal(f.h.sockets[0].sends.length, 0)
})
await check('auth acknowledgement clears only refresh rejection error and keeps processing errors', async () => {
  const f = await fixture(); await f.deliver({ type: 'auth_refresh_failed', payload: { code: 'WS_AUTH_REFRESH_REJECTED', message: 'Synthetic rejected refresh' } }); assert.ok(f.h.api.error); await f.deliver({ type: 'auth_refreshed', payload: { expires_at: 1000 } }); assert.equal(f.h.api.error, null); await f.deliver({ type: 'error', payload: { code: 'PROCESSING_FAILED', message: 'Synthetic processing refusal' } }); await f.deliver({ type: 'auth_refreshed', payload: { expires_at: 2000 } }); assert.equal(f.h.api.error.code, 'PROCESSING_FAILED')
})
for (const [label, value] of [['null', null], ['array', []], ['missing payload', { type: 'auth_expired' }], ['invalid expiry', { type: 'auth_refreshed', payload: { expires_at: -1 } }], ['invalid code', { type: 'error', payload: { code: 2, message: 'Synthetic' } }], ['empty reason', { type: 'error', payload: { code: 'SYNTHETIC', message: '' } }], ['payload session mismatch', { type: 'error', payload: { code: 'SYNTHETIC', message: 'Synthetic', session_id: 'foreign' } }]]) await check(`malformed raw ${label} frame has no transport side effects`, async () => {
  const f = await fixture(); await f.deliver(value); assert.equal(f.h.api.transportNotice, null); assert.equal(f.notices.length, 0); assert.equal(f.failures.length, 0); assert.equal(f.h.errors.length, 0)
})
await check('structured processing error unlocks a turn and retains durable prose without replay', async () => {
  const f = await fixture(); f.h.api.sendMessage('Synthetic user action'); await f.h.advance(0); assert.equal(f.h.api.awaitingDirectorReply, true); await f.deliver({ type: 'error', payload: { code: 'PROCESSING_FAILED', message: 'Retry synthetic operation', detail: 'Synthetic detail' } }); assert.equal(f.h.api.awaitingDirectorReply, false); assert.equal(f.h.api.messages[0].payload.text, 'Keep durable prose'); assert.equal(f.h.sockets[0].sends.length, 1)
})


await check('passive auth refresh refusal reports failure without unlocking an unrelated turn', async () => {
  const f = await fixture(); f.h.api.sendMessage('Synthetic current action'); await f.h.advance(0); await f.deliver({ type: 'auth_refresh_failed', payload: { code: 'WS_AUTH_REFRESH_REJECTED', message: 'Synthetic refresh rejected' } }); assert.equal(f.h.api.awaitingDirectorReply, true); assert.equal(f.h.api.transportNotice.requiresResend, false); assert.equal(f.h.sockets[0].sends.length, 1)
})
await check('onError synchronous retirement prevents a second retained transport notice callback', async () => {
  let f; f = await fixture({ callbacks: { onError: () => f.h.disconnect() } }); await f.deliver({ type: 'error', payload: { code: 'SYNTHETIC', message: 'Synthetic current reason' } }); assert.equal(f.failures.length, 1); assert.equal(f.notices.length, 0)
})


function declaration(text, name) {
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  let found
  function visit(node) {
    if ((ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node)) && node.name?.getText(ast) === name) found = node.getText(ast)
    ts.forEachChild(node, visit)
  }
  visit(ast); assert.ok(found, `Actual declaration ${name} exists`); return found
}
for (const name of ['buildUserMessage', 'setStateWithCache', 'clearAwaitReply', 'beginAwaitReply', 'clearAuthRefreshTimer', 'clearReconnectTimer', 'clearReconnectStabilityTimer', 'clearPongDeadline', 'stopHeartbeat', 'acknowledgeHeartbeat', 'startHeartbeat', 'scheduleReconnect', 'ensureConnected', 'connect', 'connectOnMount', 'disconnect', 'sendMessageWhenConnected', 'sendElementDirectiveResult', 'sendControlMessage', 'sendThemeSelection', 'sendBuildControl', 'applyTemplateIngestReady', 'clearEphemeralIds', 'updateCacheUserMessages']) await check(`unchanged actual ${name} preservation source guard`, async () => assert.equal(declaration(source, name), declaration(before, name)))
await check('auth refresh scheduling is byte-exact except truthful local-send log', async () => {
  const reverted = declaration(source, 'scheduleAuthRefresh').replace("// Browser send is not the server's auth_refreshed acknowledgement.\n        debugLog('🔐 Director WS auth refresh sent; awaiting acknowledgement');", "debugLog('🔐 Director WS token refreshed');")
  assert.equal(reverted, declaration(before, 'scheduleAuthRefresh'))
})
await check('preservation guard negative control detects a changed generation default', async () => {
  const changed = source.replace('extended_generation: options?.extendedGeneration ?? true', 'extended_generation: options?.extendedGeneration ?? false')
  assert.throws(() => assert.equal(declaration(changed, 'buildUserMessage'), declaration(before, 'buildUserMessage')))
})

console.log(`${checks} actual hook transport cases passed; ${failed.length} failed. Synthetic local frames only.`)
if (failed.length) process.exitCode = 1
