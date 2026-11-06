// FRONTEND-2 (B61: chat parity C-D1, the Studio half; contract CODEX-6 streams/codex/codex6/CHAT-CAPS-META.md, "Studio reader"): proof of the dual-shape reader of Director's sync_response.payload.chat_capabilities
// and its read-only snapshot. Flag NEXT_PUBLIC_STUDIO_CHAT_CAPS_META (exact "true", build-time, default off). Director's side (DIRECTOR_CHAT_CAPS_META_ENABLED) is held and off: the reader works with today's legacy map and with none.
//
//   node scripts/test-studio-chat-caps.mjs        (plain node: transpile + vm of the REAL sources; the REAL hook driven offline through the chat harness with RECORDED Director frames; no network, no browser, no .next)
//
// What it proves:
//  1. the flag is the exact string "true" (every other spelling is off), read inline once; the lib is import-free and does no I/O (no socket, no fetch, no storage: never persisted);
//  2. the parser on the contract's replay set (scripts/fixtures/chat-caps/replay.json, values DERIVED from Director 3e01129): legacy true / false, typed true and false fields, mixed and malformed entries, empty and absent,
//     a legacy key with and without a valid sibling, unknown keys, the C2 mixed group whose operation still needs confirmation, an operation hint without its group; parsing never changes its input;
//  3. the snapshot holder: replaced per valid current-session sync, never merged; a stale socket's or another session's reply is ignored; it reads UNKNOWN once its writer is no longer current; a read is a copy;
//  4. the REAL hook through RECORDED frames (scripts/fixtures/build-resume/j7-stop-resume.json, scripts/fixtures/studio-job-ledger/sync-response-with-jobs.json): the snapshot's life across syncs, another session's sync,
//     a replacement socket (and a stale reply on the old one), a session change and an account change; a build_state frame keeps its meaning; with the flag on, every outbound byte (handshakes, the user_message and its
//     client_caps), every callback and the hook's state are the flag-off run's and the run of the hook without this change's lines: parsing emits NO action and changes NO client capability or handshake;
//  5. Part B: the inventory found no capability for Studio to confirm (see the PR body), so nothing is built: no app or component file, no card, no sender;
//  6. the pins: the hook and types/mdc.ts without their marked lines are the base's, byte for byte (the strip is idempotent); the marked lines are pure insertions, the hook's one logic line inside the sync_response case,
//     its import clear of #585's BILLING-F5-USAGE lines; the two older proofs taught put back to the base; read past the strips of changes registered after this one (laterStrips);
//  7. scope over the COMMITTED diff, GATE-SAFE (own commits by subject across `rev-list --no-merges BASE..head`, HEAD^2 on the gate's merge, no hash-object --stdin), standing down once merged (ON_OWN_LINE), ROBUST AFTER MERGE;
//  8. mutants are caught.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import React from 'react'
import { Root } from './studio-chat-harness/mini-react.mjs'
import { createEnvironment } from './studio-chat-harness/fake-env.mjs'
import { createModuleLoader } from './studio-chat-harness/module-loader.mjs'
import { BASE_ENV } from './studio-chat-harness/profiles.mjs'
import {
  BASE_COMMIT, CHAT_CAPS_FILES, CHAT_CAPS_NEW_FILES, CHAT_CAPS_PIN_EDITS, CHAT_CAPS_PIN_FILES, CHAT_CAPS_PIN_MARK, CHAT_CAPS_PIN_AFTER, CHAT_CAPS_SCOPE_FILES,
  CHAT_CAPS_ENV_BLOCK, CHAT_CAPS_MARKER_RE, CHAT_CAPS_SUBJECT, CHAT_CAPS_FLAG, stripChatCaps,
} from './studio-chat-caps-strip.mjs'
import * as registry from './studio-later-changes.mjs'

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
const baseText = rel => git('show', `${BASE_COMMIT}:${rel}`)
const applyAll = (list, rel, text) => list.reduce((out, strip) => { const next = typeof strip === 'function' ? strip(rel, out) : out; return typeof next === 'string' ? next : out }, text)
/** Only the strips of the changes registered AFTER this one, in the registry's order: on a branch stacked after this change a later change's own lines are undone first, so a file reads as this change left it. */
const laterStrips = (rel, text) => { const at = registry.LATER_STRIPS.indexOf(stripChatCaps); return applyAll(at === -1 ? [] : registry.LATER_STRIPS.slice(at + 1), rel, text) }
const plain = value => JSON.parse(JSON.stringify(value, (key, v) => (v instanceof Error ? { error: v.message } : v instanceof Map ? Object.fromEntries(v) : v instanceof Set ? [...v] : v === undefined ? null : v)))

let passed = 0
const failed = []
async function check(label, fn) {
  if (process.env.CHECK_ONLY && !label.includes(process.env.CHECK_ONLY)) return
  try { await fn(); passed++; console.log(`PASS ${label}`) } catch (error) { failed.push(label); console.error(`FAIL ${label}: ${error?.stack?.split('\n').slice(0, 5).join(' | ') ?? error}`) }
}
let caught = 0
const missed = []
async function mutant(label, run) {
  if (process.env.CHECK_ONLY) return
  try { await run(); missed.push(label); console.error(`MISSED mutant ${label}`) } catch { caught++; console.log(`CAUGHT mutant ${label}`) }
}
const swap = (text, from, to) => { assert.equal(text.split(from).length, 2, `exactly one ${JSON.stringify(from.slice(0, 80))}`); return text.replace(from, () => to) }

const LIB = 'lib/studio-chat-caps.ts', HOOK = 'hooks/use-deckster-websocket-v2.ts', MDC = 'types/mdc.ts', FIXTURE = 'scripts/fixtures/chat-caps/replay.json'
const FLAG = CHAT_CAPS_FLAG
const SPELLINGS = [undefined, '', 'false', 'TRUE', 'True', '1', 'yes', ' true', 'true ', 'true']

// ---- the lib in a vm (import-free: any require throws) ---------------------------------------------------------------------------------------------
const compileCache = new Map()
const transpile = (text, file = LIB) => { const id = `${file}\0${text}`; if (!compileCache.has(id)) compileCache.set(id, ts.transpileModule(text, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText); return compileCache.get(id) }
function loadLib(env = {}, text = read(LIB)) {
  const mod = { exports: {} }
  vm.runInNewContext(transpile(text), { module: mod, exports: mod.exports, process: { env: { ...env } }, require: id => { throw new Error(`the lib must stay import-free: ${id}`) } })
  return mod.exports
}

// ===== 1. the flag ==================================================================================================================================
console.log('1. flag')
await check('the flag is on only for the exact value "true"; the environment is read inline, once, and nowhere else; the lib is import-free and does no I/O (no socket, fetch, storage, window or timer: never persisted)', () => {
  for (const value of SPELLINGS) {
    const lib = loadLib(value === undefined ? {} : { [FLAG]: value })
    assert.equal(lib.STUDIO_CHAT_CAPS_META_ENABLED, value === 'true', JSON.stringify(value))
    assert.equal(lib.studioChatCapsMetaOn(value), value === 'true', JSON.stringify(value))
  }
  const src = read(LIB), code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  assert.equal(code.split('process.env').length - 1, 1, 'one environment read'); assert.ok(code.includes(`process.env.${FLAG})`), 'the literal read Next inlines')
  assert.doesNotMatch(code, /^\s*import\s|require\(|\bfetch\(|WebSocket|\.send\(|postMessage|localStorage|sessionStorage|indexedDB|document\.|window\.|setTimeout|setInterval|dispatchEvent/m, 'no import, no I/O, no persistence')
  assert.doesNotMatch(src, /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY)/, 'no secret-shaped literal')
})

// ===== 2. the parser on the contract's replay set ======================================================================================================
console.log('2. parser (replay set)')
const FIX = JSON.parse(read(FIXTURE))
const resolveValue = v => (typeof v === 'string' && v.startsWith('$') ? structuredClone(FIX.values[v.slice(1)]) : v)
const payloadOf = c => Object.fromEntries(Object.entries(c.payload).map(([k, v]) => [k, resolveValue(v)]))
const capsView = result => (result.known ? Object.fromEntries([...result.caps].map(([k, v]) => [k, [v.confirm ?? null, v.clientDirective ?? null]])) : null)
const opsView = result => (result.known ? Object.fromEntries([...result.operations].map(([k, v]) => [k, [v.capability, v.confirm, v.clientDirective]])) : null)
function proveReplay(lib, at = '') {
  const a = m => (at ? `${at}: ${m}` : m)
  assert.ok(FIX.cases.length >= 15, a('the replay set is there'))
  for (const c of FIX.cases) {
    const payload = payloadOf(c), before = JSON.stringify(payload)
    const result = lib.parseSyncChatCapabilities(payload)
    assert.equal(JSON.stringify(payload), before, a(`${c.id}: parsing does not change its input`))
    const e = c.expect
    assert.equal(result.known, e.known, a(`${c.id}: known is ${e.known}`))
    if (!e.known) { assert.deepEqual(Object.keys(result), ['known'], a(`${c.id}: unknown carries nothing`)); continue }
    assert.ok([result.caps, result.operations].every(m => Object.prototype.toString.call(m) === '[object Map]'), a(`${c.id}: two maps`))
    for (const [key, hint] of result.caps) { assert.equal(hint.available, true, a(`${c.id}: ${key} is available`)); assert.ok(Object.isFrozen(hint), a(`${c.id}: ${key}'s hint is frozen`)) }
    if (e.caps) assert.deepEqual(capsView(result), e.caps, a(`${c.id}: the caps`))
    if (e.capsAllUnknownHint) assert.deepEqual(capsView(result), Object.fromEntries(e.capsAllUnknownHint.map(k => [k, [null, null]])), a(`${c.id}: every legacy key, availability known, hint unknown`))
    if (e.capsFromValues) assert.deepEqual(capsView(result), Object.fromEntries(Object.entries(FIX.values[e.capsFromValues]).map(([k, v]) => [k, [v.confirm, v.client_directive]])), a(`${c.id}: every typed key with its two fields`))
    if (e.operations) assert.deepEqual(opsView(result), e.operations, a(`${c.id}: the operations`))
    for (const [key, op, want] of e.confirmHints ?? []) assert.equal(lib.chatCapConfirmHint(result, key, op ?? undefined), want === null ? undefined : want, a(`${c.id}: confirm hint of ${key}${op ? ` / ${op}` : ''}`))
    assert.deepEqual(capsView(lib.parseSyncChatCapabilities(payloadOf(c))), capsView(result), a(`${c.id}: the same input gives the same snapshot`))
  }
  // the two shapes carry the same advertised keys (C-D1 changes the value type only)
  const legacy = lib.parseChatCapabilities(FIX.values.legacy_defaults), typed = lib.parseChatCapabilities(FIX.values.typed_defaults)
  assert.deepEqual([...legacy.caps.keys()], [...typed.caps.keys()], a('the legacy and the typed map advertise the same keys'))
  assert.equal(lib.chatCapConfirmHint({ known: false }, 'qa'), undefined, a('unknown snapshot: no hint'))
  assert.equal(lib.chatCapConfirmHint(typed, 'delete_deck'), undefined, a('a key not advertised: no hint'))
}
await check('the replay set: absent / null / array / string are UNKNOWN, {} is KNOWN-EMPTY; legacy true (hint unknown) and false (dropped); typed true and false fields; malformed entries (Director\'s own test entries) and unknown keys dropped; a legacy key takes a VALID sibling\'s hint, else unknown; the nested value wins; a sibling never adds a key', () => proveReplay(loadLib({ [FLAG]: 'true' })))
await check('the C2 mixed group: the group\'s confirm=false is no permission (its hint reads unknown), its deletion still needs the card (true), C-D1\'s extra operation hints (generate logo, save, optimise: true; stop: false); an operation hint without its group is dropped', () => {
  const lib = loadLib()
  const mixed = lib.parseSyncChatCapabilities(payloadOf(FIX.cases.find(c => c.id === 'c2_mixed_group_legacy')))
  assert.equal(mixed.caps.get('templates').confirm, false, 'the group itself says false')
  assert.equal(lib.chatCapConfirmHint(mixed, 'templates', 'templates.delete_template'), true, 'its deletion needs the card')
  assert.equal(lib.chatCapConfirmHint(mixed, 'templates'), undefined, 'a group false is no permission to skip a card')
  assert.equal(lib.chatCapConfirmHint(mixed, 'export'), false, 'a plain key\'s own false is its normal path')
  assert.deepEqual(opsView(mixed)['templates.delete_template'], ['templates', true, true])
  const none = lib.parseSyncChatCapabilities(payloadOf(FIX.cases.find(c => c.id === 'operation_hint_without_group')))
  assert.equal(none.operations.size, 0, 'no operation without its group')
})

// ===== 3. the snapshot holder ============================================================================================================================
console.log('3. snapshot holder')
const owner = (over = {}) => ({ frameSessionId: 'sess-a', socketSessionId: 'sess-a', currentSessionId: 'sess-a', isCurrent: () => true, ...over })
const TYPED = { chat_capabilities: FIX.values.typed_defaults }, LEGACY = { chat_capabilities: { qa: true, export: true } }
function proveHolder(text = read(LIB)) {
  const lib = loadLib({ [FLAG]: 'true' }, text)
  assert.deepEqual(plain(lib.chatCapsSnapshot()), { known: false }, 'unknown before any sync')
  let current = true; const isCurrent = () => current
  lib.chatCapsSyncReceived(TYPED, owner({ isCurrent }))
  assert.deepEqual(Object.keys(capsView(lib.chatCapsSnapshot())), Object.keys(FIX.values.typed_defaults), 'a valid current-session sync is read')
  lib.chatCapsSyncReceived(LEGACY, owner({ isCurrent }))
  assert.deepEqual(capsView(lib.chatCapsSnapshot()), { qa: [null, null], export: [null, null] }, 'the next sync REPLACES it (never merged)')
  lib.chatCapsSyncReceived(TYPED, owner({ isCurrent: () => false })); assert.deepEqual(Object.keys(capsView(lib.chatCapsSnapshot())), ['qa', 'export'], 'a stale socket\'s reply is ignored')
  lib.chatCapsSyncReceived(TYPED, owner({ frameSessionId: 'sess-b' })); assert.deepEqual(Object.keys(capsView(lib.chatCapsSnapshot())), ['qa', 'export'], 'another session\'s reply is ignored')
  lib.chatCapsSyncReceived(TYPED, owner({ frameSessionId: undefined })); assert.deepEqual(Object.keys(capsView(lib.chatCapsSnapshot())), ['qa', 'export'], 'a reply that names no session is ignored')
  lib.chatCapsSyncReceived(TYPED, owner({ socketSessionId: 'sess-a', currentSessionId: 'sess-b' })); assert.deepEqual(Object.keys(capsView(lib.chatCapsSnapshot())), ['qa', 'export'], 'a socket of a session the hook no longer shows is ignored')
  lib.chatCapsSyncReceived(TYPED, owner({ frameSessionId: '', socketSessionId: '', currentSessionId: '' })); assert.deepEqual(Object.keys(capsView(lib.chatCapsSnapshot())), ['qa', 'export'], 'an empty session is ignored')
  lib.chatCapsSyncReceived(TYPED, owner({ isCurrent: () => { throw new Error('retired') } })); assert.deepEqual(Object.keys(capsView(lib.chatCapsSnapshot())), ['qa', 'export'], 'a throwing check reads as not current')
  lib.chatCapsSyncReceived({}, owner({ isCurrent })); assert.deepEqual(plain(lib.chatCapsSnapshot()), { known: false }, 'a valid sync without the field replaces it with UNKNOWN')
  lib.chatCapsSyncReceived({ chat_capabilities: {} }, owner({ isCurrent })); const empty = lib.chatCapsSnapshot(); assert.ok(empty.known && empty.caps.size === 0, '{} is KNOWN-EMPTY')
  lib.chatCapsSyncReceived(TYPED, owner({ isCurrent }))
  const copy = lib.chatCapsSnapshot(); copy.caps.delete('qa'); copy.caps.set('delete_deck', { available: true, confirm: false, clientDirective: true }); copy.operations.set('x', {})
  assert.ok(lib.chatCapsSnapshot().caps.has('qa') && !lib.chatCapsSnapshot().caps.has('delete_deck') && lib.chatCapsSnapshot().operations.size === 0, 'a read is a copy: no reader can change the snapshot')
  current = false; assert.deepEqual(plain(lib.chatCapsSnapshot()), { known: false }, 'once its writer is no longer current (socket, account or session changed) it reads UNKNOWN')
  current = true; assert.deepEqual(plain(lib.chatCapsSnapshot()), { known: false }, 'and it was dropped: it does not come back')
  const fresh = loadLib({ [FLAG]: 'true' }, text); fresh.chatCapsSyncReceived(TYPED, owner()); assert.deepEqual(plain(loadLib({ [FLAG]: 'true' }, text).chatCapsSnapshot()), { known: false }, 'a new page (a new module) starts UNKNOWN: nothing is persisted')
  assert.equal(lib.chatCapsSyncReceived(TYPED, owner()), undefined, 'the write returns nothing')
}
await check('replaced per valid current-session sync, never merged; stale-socket, other-session, no-session and not-shown-session replies ignored; absent replaces with UNKNOWN, {} is KNOWN-EMPTY; reads are copies; UNKNOWN (and dropped) once the writer is not current; nothing persists', () => proveHolder())

// ===== 4. the REAL hook through RECORDED frames ===========================================================================================================
console.log('4. the hook, offline, through recorded frames')
const J7 = JSON.parse(read('scripts/fixtures/build-resume/j7-stop-resume.json'))
const SESSION = J7.session.id, USER = { id: J7.session.userId, email: `${J7.session.userId}@example.invalid` }, OTHER_USER = { id: 'synthetic-user-b', email: 'synthetic-user-b@example.invalid' }
const SYNC_HISTORY = J7.frames.reconnect_send_history[0], SYNC_SKIP = J7.frames.reconnect_skip_history[0]
const FOREIGN = JSON.parse(read('scripts/fixtures/studio-job-ledger/sync-response-with-jobs.json'))
/** A RECORDED frame with only the cap fields set (derived from Director 3e01129, the fixture's values) and its message_id suffixed, so no dedupe can hide a delivery. */
const withCaps = (frame, id, fields = {}) => { const copy = structuredClone(frame); copy.message_id = `${frame.message_id}_${id}`; for (const [k, v] of Object.entries(fields)) copy.payload[k] = resolveValue(v); return copy }
const V = FIX.values
function withFileTexts(texts, fn) {
  const targets = new Map(Object.entries(texts).filter(([, text]) => typeof text === 'string').map(([rel, text]) => [path.join(root, rel), text]))
  const original = fs.readFileSync
  fs.readFileSync = function (file, ...rest) { const hit = targets.get(path.resolve(String(file))); return hit !== undefined ? hit : original.call(this, file, ...rest) }
  try { return fn() } finally { fs.readFileSync = original }
}
async function mountHook({ flag, hookText, libText, user = USER } = {}) {
  const env = createEnvironment({ processEnv: { ...BASE_ENV, NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_CHAT_DIRECTIVES: 'true', ...(flag === undefined ? {} : { [FLAG]: flag }) } })
  const auth = { user }
  const loader = createModuleLoader({ root, globals: env.globals, stubs: { react: React }, fileStubs: { 'hooks/use-auth': { useAuth: () => ({ user: auth.user, isLoading: false }) } } })
  const { hookModule, lib } = withFileTexts({ [HOOK]: hookText, [LIB]: libText }, () => ({ hookModule: loader.load(HOOK), lib: loader.load(LIB) }))
  const seen = { messages: [], buildStates: [], sessionStates: [], writes: 0 }
  const realWrite = lib.chatCapsSyncReceived
  lib.chatCapsSyncReceived = (...args) => { seen.writes++; return realWrite(...args) } // the hook calls it through the module object: every call is counted
  const probe = { api: null, props: { session: SESSION } }
  function Probe() {
    probe.api = hookModule.useDecksterWebSocketV2({
      autoConnect: false, reconnectOnError: true, existingSessionId: probe.props.session,
      onMessage: message => { seen.messages.push(message.message_id) },
      onBuildStateSync: state => { seen.buildStates.push(plain(state)) },
      onSessionStateChange: state => { seen.sessionStates.push(plain(state)) },
    })
    return null
  }
  const rootNode = new Root()
  const settle = async () => { for (let calm = 0, rounds = 0; calm < 2; rounds++) { if (rounds > 80) throw new Error('did not settle'); await env.macrotask(); calm = rootNode.flush() ? 0 : calm + 1 } }
  let renders = 0
  rootNode.setElement(React.createElement(Probe, { n: renders }))
  await settle()
  probe.api.ensureConnected()
  await env.clock.advance(0, settle)
  assert.equal(env.sockets.length, 1, 'one socket')
  env.sockets[0].serverOpen()
  await env.clock.advance(0, settle)
  const stateOf = () => plain(Object.fromEntries(Object.entries(probe.api).filter(([, v]) => typeof v !== 'function')))
  return {
    env, lib, seen,
    get api() { return probe.api },
    snapshot: () => { const s = lib.chatCapsSnapshot(); return s.known ? { caps: capsView(s), operations: opsView(s) } : 'UNKNOWN' },
    async deliver(frame, socket = env.sockets[env.sockets.length - 1]) { socket.serverMessage(JSON.stringify(frame)); await env.clock.advance(0, settle) },
    async advance(ms) { await env.clock.advance(ms, settle) },
    async rerender(props = {}, nextUser) { Object.assign(probe.props, props); if (nextUser !== undefined) auth.user = nextUser; rootNode.setElement(React.createElement(Probe, { n: ++renders })); await settle(); await env.clock.advance(0, settle) },
    trace: () => plain({ state: stateOf(), outbound: env.outbound.map(o => [o.socket, o.data]), handshakes: env.handshakes, closes: env.clientCloses, fetches: env.fetches, seen: { messages: seen.messages, buildStates: seen.buildStates, sessionStates: seen.sessionStates },
      cache: env.sessionStorage.dump(), local: env.localStorage.dump(), errors: env.consoleEvents.filter(e => e.level === 'error').length, blocked: env.blockedNetwork }),
    unmount() { rootNode.unmount() },
  }
}
/** The recorded run: the snapshot and the observable trace after each step. */
async function recordedRun(opts) {
  const h = await mountHook(opts), steps = []
  const step = (name) => steps.push({ name, snapshot: h.snapshot(), trace: h.trace() })
  step('open')
  await h.deliver(withCaps(SYNC_HISTORY, 'typed_c2', { chat_capabilities: '$typed_c2', chat_capability_meta: '$legacy_c2_capability_meta', chat_operation_meta: '$typed_c2_operation_meta' })); step('typed C2 sync, with build_state')
  await h.deliver(withCaps(SYNC_SKIP, 'legacy_c2', { chat_capabilities: '$legacy_c2', chat_capability_meta: '$legacy_c2_capability_meta', chat_operation_meta: '$legacy_c2_operation_meta' })); step('legacy C2 sync')
  await h.deliver(withCaps(FOREIGN, 'foreign', { chat_capabilities: '$typed_defaults' })); step('another session\'s sync')
  await h.deliver(withCaps(SYNC_SKIP, 'nocaps')); step('a sync without the field')
  await h.deliver(withCaps(SYNC_SKIP, 'empty', { chat_capabilities: {} })); step('a sync with {}')
  await h.deliver(withCaps(SYNC_SKIP, 'typed', { chat_capabilities: '$typed_defaults' })); step('a typed sync')
  h.api.sendMessage('Make the title shorter'); await h.advance(0); step('a typed user_message (client caps)')
  const first = h.env.sockets[0]
  first.serverClose(1006, 'synthetic drop'); await h.advance(0); step('socket dropped')
  for (let i = 0; i < 60 && h.env.sockets.length < 2; i++) await h.advance(1000)
  assert.equal(h.env.sockets.length, 2, 'a replacement socket')
  step('replacement socket')
  await h.deliver(withCaps(SYNC_SKIP, 'stale', { chat_capabilities: '$contract_example' }), first); step('a stale reply on the old socket')
  h.env.sockets[1].serverOpen(); await h.advance(0)
  await h.deliver(withCaps(SYNC_SKIP, 'second', { chat_capabilities: '$contract_example' })); step('the new socket\'s sync')
  await h.rerender({ session: 'synthetic-other-session' }); step('session change')
  h.unmount()
  return { steps, writes: h.seen.writes }
}
const view = name => FIX.cases.find(c => c.id === name)
/** A run that throws becomes a failing check (every hook check below asserts there is no error), not a crash. */
const settled = promise => promise.catch(error => ({ error, steps: [], writes: -1 }))
const ON = await settled(recordedRun({ flag: 'true' }))
const OFF = await settled(recordedRun({ flag: undefined }))
const snapAt = (run, name) => { if (run.error) throw run.error; return run.steps.find(s => s.name === name).snapshot }
await check('flag on, the snapshot\'s life: UNKNOWN at open; a typed C2 sync is read (its build_state reaches onBuildStateSync as recorded); a legacy C2 sync REPLACES it (hints from the valid sibling, the deletion still needs its card); another session\'s sync is ignored; no field replaces with UNKNOWN; {} is KNOWN-EMPTY', () => {
  assert.equal(snapAt(ON, 'open'), 'UNKNOWN')
  const typed = snapAt(ON, 'typed C2 sync, with build_state')
  assert.deepEqual(Object.keys(typed.caps).sort(), Object.keys(V.typed_c2).sort(), 'every typed key'); assert.deepEqual(typed.caps.new_deck_redirect, [true, true]); assert.deepEqual(typed.operations['identity.generate_logo'], ['identity', true, true])
  assert.deepEqual(ON.steps.find(s => s.name === 'typed C2 sync, with build_state').trace.seen.buildStates, [plain(SYNC_HISTORY.payload.build_state)], 'the build_state frame keeps its meaning: onBuildStateSync gets the recorded build_state')
  const legacy = snapAt(ON, 'legacy C2 sync')
  assert.deepEqual(Object.keys(legacy.caps).sort(), Object.keys(V.legacy_c2).sort(), 'replaced, not merged: exactly the legacy keys')
  assert.deepEqual(legacy.caps.templates, [false, true], 'a legacy true takes its valid sibling\'s hint'); assert.deepEqual(legacy.operations['templates.delete_template'], ['templates', true, true], 'the mixed group\'s deletion still needs its card')
  assert.equal(legacy.operations['identity.generate_logo'], undefined, 'C-D1\'s extra hint is not in a legacy frame')
  assert.deepEqual(snapAt(ON, 'another session\'s sync'), legacy, 'another session\'s sync changes nothing')
  assert.equal(snapAt(ON, 'a sync without the field'), 'UNKNOWN', 'absent replaces with UNKNOWN')
  assert.deepEqual(snapAt(ON, 'a sync with {}'), { caps: {}, operations: {} }, '{} is KNOWN-EMPTY')
  assert.deepEqual(Object.keys(snapAt(ON, 'a typed sync').caps), Object.keys(V.typed_defaults))
})
await check('flag on: a replacement socket clears it (UNKNOWN before the new socket\'s sync), a stale reply on the old socket is ignored, the new socket\'s sync is read, a session change clears it', () => {
  assert.equal(snapAt(ON, 'replacement socket'), 'UNKNOWN', 'the replacement socket: UNKNOWN')
  assert.equal(snapAt(ON, 'a stale reply on the old socket'), 'UNKNOWN', 'the old socket\'s late reply is ignored')
  assert.deepEqual(snapAt(ON, 'the new socket\'s sync').caps, capsView(loadLib().parseChatCapabilities(V.contract_example)), 'the new socket\'s own sync')
  assert.equal(snapAt(ON, 'session change'), 'UNKNOWN', 'a session change: UNKNOWN')
})
await check('flag off: the hook never calls the reader (0 writes) and the snapshot stays UNKNOWN at every step', () => {
  for (const run of [ON, OFF]) if (run.error) throw run.error
  assert.equal(OFF.writes, 0, 'no call'); for (const s of OFF.steps) assert.equal(s.snapshot, 'UNKNOWN', s.name)
  assert.ok(ON.writes >= 6, `flag on, the reader was called (${ON.writes})`)
})
await check('parsing emits NO action and changes NO client capability or handshake: at every step, flag on, the hook\'s state, every outbound byte (handshakes, the user_message with its client_caps), every callback, the caches and the console are the flag-off run\'s', () => {
  for (const run of [ON, OFF]) if (run.error) throw run.error
  assert.equal(ON.steps.length, OFF.steps.length)
  const um = ON.steps.find(s => s.name === 'a typed user_message (client caps)').trace.outbound.map(([, d]) => d).filter(d => typeof d === 'string' && d.includes('"user_message"'))
  assert.ok(um.length === 1 && /client_caps/.test(um[0]), 'positive control: the typed user_message, with its client caps, is in the trace')
  for (let i = 0; i < ON.steps.length; i++) assert.deepEqual(ON.steps[i].trace, OFF.steps[i].trace, `step ${ON.steps[i].name}`)
})
await check('today\'s behaviour: flag on, the hook WITHOUT this change\'s lines (the strip) gives the same trace at every step as the hook with them', async () => {
  const BASE_HOOK = await recordedRun({ flag: 'true', hookText: stripChatCaps(HOOK, read(HOOK)) })
  assert.equal(BASE_HOOK.writes, 0)
  for (let i = 0; i < ON.steps.length; i++) assert.deepEqual(ON.steps[i].trace, BASE_HOOK.steps[i].trace, `step ${ON.steps[i].name}`)
})
await check('flag on: an account change clears it (the socket\'s owner is no longer current), and the trace matches flag off', async () => {
  const runs = {}
  for (const flag of ['true', undefined]) {
    const h = await mountHook({ flag })
    await h.deliver(withCaps(SYNC_SKIP, 'acct', { chat_capabilities: '$typed_defaults' }))
    const before = h.snapshot()
    await h.rerender({}, OTHER_USER)
    runs[String(flag)] = { before, after: h.snapshot(), trace: h.trace() }
    h.unmount()
  }
  assert.deepEqual(Object.keys(runs.true.before.caps), Object.keys(V.typed_defaults), 'read before the change'); assert.equal(runs.true.after, 'UNKNOWN', 'UNKNOWN after the account change')
  assert.equal(runs.undefined.before, 'UNKNOWN'); assert.deepEqual(runs.true.trace, runs.undefined.trace, 'the same observable run')
})

// ===== 5. Part B ========================================================================================================================================
console.log('5. Part B')
await check('Part B: the inventory found no capability for Studio to confirm, so nothing is built: the change touches no app or component file, adds no card and no sender; Studio has no executor for the C2 deck, publish and library-delete groups (no deckops1 / publish1 / themes2 / templates2 anywhere in app, components, hooks or lib)', () => {
  for (const rel of [...CHAT_CAPS_SCOPE_FILES]) assert.ok(!/^(app|components)\//.test(rel), `${rel}: no app or component file`)
  const exports = Object.keys(loadLib()).sort()
  assert.deepEqual(exports, ['CHAT_CAPS_KNOWN_KEYS', 'CHAT_CAPS_KNOWN_OPERATIONS', 'CHAT_CAPS_MIXED_GROUPS', 'STUDIO_CHAT_CAPS_META_ENABLED', 'chatCapConfirmHint', 'chatCapsSnapshot', 'chatCapsSyncReceived', 'parseChatCapabilities', 'parseSyncChatCapabilities', 'studioChatCapsMetaOn'], 'pure readers only')
  /** `git grep -l` over the committed tree (HEAD), code dirs only; exit 1 with no output is "no match". */
  const grepHead = pattern => { try { return git('grep', '-l', '-E', pattern, 'HEAD', '--', 'app', 'components', 'hooks', 'lib').split('\n').filter(Boolean) } catch (error) { if (error.status === 1 && !String(error.stdout || '').trim()) return []; throw error } }
  assert.ok(grepHead("'themes1'").length >= 1, 'positive control: the grep finds the client cap Studio does advertise (themes1)')
  assert.deepEqual(grepHead('deckops1|publish1|themes2|templates2'), [], 'no Studio executor advertises those client caps')
})

// ===== 6. pins ==========================================================================================================================================
console.log('6. pins')
const diffLines = text => text.split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
const lineDiff = (before, after) => { const b = before.split('\n'), a = after.split('\n'), out = []; let i = 0, j = 0; while (i < b.length || j < a.length) { if (b[i] === a[j]) { i++; j++ } else if (a[j] !== undefined && !b.slice(i).includes(a[j])) { out.push(`+${a[j++]}`) } else if (b[i] !== undefined && !a.slice(j).includes(b[i])) { out.push(`-${b[i++]}`) } else { out.push(`-${b[i++]}`); out.push(`+${a[j++]}`) } } return out }
const MARKED_COUNT = { [HOOK]: 2, [MDC]: 4 }
function provePins(readNow = read, at = '', later = laterStrips) {
  const a = m => (at ? `${at}: ${m}` : m)
  for (const rel of CHAT_CAPS_FILES) {
    const now = later(rel, readNow(rel)), base = baseText(rel), marked = now.split('\n').filter(line => CHAT_CAPS_MARKER_RE.test(line))
    assert.equal(stripChatCaps(rel, now), base, a(`${rel}: without its marked lines it is the base's, byte for byte`))
    assert.equal(stripChatCaps(rel, stripChatCaps(rel, now)), base, a(`${rel}: stripping twice changes nothing more`))
    assert.equal(marked.length, MARKED_COUNT[rel], a(`${rel}: ${MARKED_COUNT[rel]} marked lines`))
    const diff = lineDiff(base, now); assert.deepEqual(diff.filter(l => l.startsWith('-')), [], a(`${rel}: nothing is removed or rewritten`)); assert.equal(diff.length, MARKED_COUNT[rel], a(`${rel}: only the marked lines are added`))
    assert.doesNotMatch(marked.join('\n').replace(/\/\/.*$/gm, ''), /process\.env/, a(`${rel}: the marked lines read no environment (the lib does)`))
  }
  const hook = later(HOOK, readNow(HOOK)).split('\n'), hm = hook.filter(line => CHAT_CAPS_MARKER_RE.test(line)), at0 = hook.indexOf(hm[0]), at1 = hook.indexOf(hm[1])
  assert.ok(/^import \{ STUDIO_CHAT_CAPS_META_ENABLED, chatCapsSyncReceived \} from '@\/lib\/studio-chat-caps';/.test(hm[0]), a('hook line 1 is the import'))
  assert.ok(at0 > 0 && hook[at0 - 1].includes("from '@/lib/studio-flow-control'"), a('the import follows the flow-control import (not before the first import, where #585\'s goes)'))
  assert.equal(hm[1].trimStart().split(' //')[0], 'if (STUDIO_CHAT_CAPS_META_ENABLED) chatCapsSyncReceived(message.payload, { frameSessionId: message.session_id, socketSessionId, currentSessionId: sessionIdRef.current, isCurrent: isCurrentSocket });', a('hook line 2: one gated call, the frame\'s payload and owner, nothing else'))
  assert.equal(hook[at1 - 1], "                case 'sync_response':", a('hook line 2 is the first line INSIDE the sync_response case'))
  assert.ok(hook[at1 + 1].startsWith('                  if (COMPOSER_LIBRARY_ENABLED && socketSessionId === sessionIdRef.current &&'), a('and the case\'s first base line follows it'))
  for (const i of [at0, at1]) for (const n of [hook[i - 1], hook[i + 1]]) assert.doesNotMatch(n, /BILLING-F5-USAGE|const previousNotice = transportNoticeRef\.current/, a('no neighbour is one of #585\'s lines'))
  const mdc = later(MDC, readNow(MDC)).split('\n'), mm = mdc.filter(line => CHAT_CAPS_MARKER_RE.test(line))
  assert.ok(mm[0].startsWith('export interface MdcChatCapabilityMeta { confirm: boolean; client_directive: boolean }') && mdc[mdc.indexOf(mm[0]) + 1] === 'export interface MdcSyncExtras {', a('types/mdc.ts: the entry type, right before MdcSyncExtras'))
  assert.ok(mm[1].startsWith('    | Record<string, MdcChatCapabilityMeta>') && mdc[mdc.indexOf(mm[1]) - 1] === '  chat_capabilities?: Record<string, boolean>', a('types/mdc.ts: the C-D1 union line under the unchanged base line'))
  assert.ok(mm[2].startsWith('  chat_capability_meta?: Record<string, MdcChatCapabilityMeta>') && mm[3].startsWith('  chat_operation_meta?: Record<string, MdcChatCapabilityMeta>'), a('types/mdc.ts: the two siblings'))
  for (const rel of CHAT_CAPS_PIN_FILES) {
    const now = later(rel, readNow(rel)), base = baseText(rel)
    assert.equal(stripChatCaps(rel, now), base, a(`${rel}: an older proof taught: put back it is the base's, byte for byte`))
    assert.equal(stripChatCaps(rel, stripChatCaps(rel, now)), base, a(`${rel}: put back twice changes nothing more`))
    for (const [has, was] of CHAT_CAPS_PIN_EDITS[rel]) { assert.equal(now.split(has).length - 1, 1, a(`${rel}: a taught line is there exactly once`)); for (const line of has.split('\n').filter(Boolean)) assert.ok(line.includes(CHAT_CAPS_PIN_MARK), a(`${rel}: a taught line carries the registry-read mark`)); assert.ok(!was.includes(CHAT_CAPS_PIN_MARK)) }
    const added = lineDiff(base, now).filter(l => l.startsWith('+')); assert.ok(added.length === 1 && added.every(l => l.includes(CHAT_CAPS_PIN_MARK)), a(`${rel}: one line added to the proof, with the mark`))
    const lines = now.split('\n'), taught = lines.findIndex(l => l.includes(CHAT_CAPS_PIN_MARK)); assert.ok(lines[taught - 1].startsWith(CHAT_CAPS_PIN_AFTER), a(`${rel}: right after the phone shell coverage's subject filter`))
  }
  for (const rel of [LIB, ...CHAT_CAPS_NEW_FILES]) assert.doesNotMatch(readNow(rel), /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY)/, `${rel}: no secret-shaped literal`)
}
await check('the hook and types/mdc.ts without their marked lines are the base\'s, byte for byte (idempotent); pure insertions only; the hook\'s logic line is the first line of the sync_response case, its import after the flow-control import, clear of #585\'s lines; the older proofs taught put back to the base', () => { provePins() })
await check('the strip is plain data: nothing but the marker, the lists and the functions; any other file comes back untouched; the registry holds the strip, the block and every file', () => {
  const text = read('scripts/studio-chat-caps-strip.mjs')
  assert.doesNotMatch(text.replace(/"(?:[^"\\\n]|\\.)*"/g, '""').replace(/'(?:[^'\\\n]|\\.)*'/g, "''").replace(/`[^`]*`/g, '``').replace(/\/\/.*$/gm, ''), /^import |require\(|readFileSync|execFileSync/m, 'no imports, nothing read from disk or git')
  assert.equal(stripChatCaps('app/builder/page.tsx', 'x // CHAT-CAPS-META\n'), 'x // CHAT-CAPS-META\n', 'a file this change does not own is returned as it is')
  assert.equal(stripChatCaps(HOOK, 'a\nb // CHAT-CAPS-META-X\nc // X-CHAT-CAPS-META\nd // CHAT-PARITY\n'), 'a\nb // CHAT-CAPS-META-X\nc // X-CHAT-CAPS-META\nd // CHAT-PARITY\n', 'the marker is a whole token')
  assert.equal(stripChatCaps(HOOK, 1), 1)
  assert.ok(registry.LATER_STRIPS.includes(stripChatCaps) && registry.LATER_ENV_BLOCKS.includes(CHAT_CAPS_ENV_BLOCK) && [...CHAT_CAPS_SCOPE_FILES].every(rel => registry.LATER_CHANGE_FILES.has(rel)), 'the registry holds the strip, the block and every file')
  assert.ok(CHAT_CAPS_ENV_BLOCK.includes(`${FLAG}="false"`), 'the flag is documented as off')
})

// ===== 7. scope =========================================================================================================================================
console.log('7. scope over the committed diff (own commits by subject across `rev-list --no-merges BASE..head`)')
const GIT_IDENT = { GIT_AUTHOR_NAME: 'gate', GIT_AUTHOR_EMAIL: 'gate@example.invalid', GIT_COMMITTER_NAME: 'gate', GIT_COMMITTER_EMAIL: 'gate@example.invalid', GIT_AUTHOR_DATE: '2026-11-06T00:00:00Z', GIT_COMMITTER_DATE: '2026-11-06T00:00:00Z' }
const plumb = (args, env = {}) => execFileSync('git', args, { cwd: root, encoding: 'utf8', env: { ...process.env, ...GIT_IDENT, ...env }, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, timeout: 60_000 }).trim()
/** A blob object for `text`, written from a temporary FILE (never `hash-object --stdin`): stdin ignored, a 60 s timeout, no filters. */
const blobOf = text => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccm-blob-'))
  try { const file = path.join(dir, 'blob'); fs.writeFileSync(file, text); return plumb(['hash-object', '-w', '--no-filters', '--', file]) } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const subjectOf = c => git('log', '-1', '--format=%s', c).trim()
const parentsOf = rev => git('rev-list', '--parents', '-n', '1', rev).trim().split(/\s+/).slice(1)
const isOwnSubject = subject => subject.startsWith(CHAT_CAPS_SUBJECT)
/** This change's commits: found by SUBJECT across `rev-list --no-merges BASE..head`. A first-parent walk (`firstParentOnly`, kept for its mutant) sees none of them on the gate's merge. */
const ownOf = (head, { firstParentOnly = false } = {}) => git('rev-list', ...(firstParentOnly ? ['--first-parent'] : []), '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => isOwnSubject(subjectOf(c)))
/** GATE-SAFE head of every scope query: on the gate's merge (dev first, this change's head second) the scope runs against HEAD^2; elsewhere HEAD itself. `gateRule: false` is the mutant that drops the rule. */
function scopeHead(ref = 'HEAD', { gateRule = true } = {}) {
  const head = git('rev-parse', `${ref}^{commit}`).trim(), parents = parentsOf(head)
  if (!gateRule || parents.length !== 2) return head
  return ownOf(parents[0]).length === 0 && ownOf(parents[1]).length > 0 ? parents[1] : head
}
const OLDER_PREFIXES = /^(Phone shell coverage:|Phone landscape:|Phone hints:|Phone shell 1:|Phone shell 2:|Stage open gate:|Chat column wide:|Welcome trim:|Director mark trim:|Chat element edit|Targeted chat edit:|Targeted chat add:|Chat text set:|Text set keep look:|Structural refine decline:|Strawman|Template match:|Template proof order:|Save refused notice:|Chat parity)/
const scopeOwnCommits = (head, opts) => {
  const own = ownOf(head, opts)
  assert.ok(own.length >= 1, 'no own commit yet')
  for (const c of own) assert.match(git('log', '-1', '--format=%B', c), /Co-Authored-By: Claude (?:Sonnet|Opus) 5\.5 <noreply@anthropic\.com>\s*$/, c.slice(0, 8))
  for (const c of git('rev-list', '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean)) assert.doesNotMatch(subjectOf(c), OLDER_PREFIXES, `${c.slice(0, 8)} would be taken for an older change's own commit`)
  return own
}
const scopeCommittedFiles = head => {
  const own = scopeOwnCommits(head), touched = new Set()
  for (const c of own) for (const rel of git('show', '--name-only', '--format=', c).split('\n').filter(Boolean)) touched.add(rel)
  const net = new Set(git('diff', '--name-only', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean)); for (const rel of [...touched]) if (!net.has(rel)) touched.delete(rel)
  assert.deepEqual([...touched].sort(), [...CHAT_CAPS_SCOPE_FILES].sort(), 'the files this change\'s own commits touch (net of what they put back) are exactly its scope')
  assert.deepEqual([...net].sort(), [...CHAT_CAPS_SCOPE_FILES].sort(), 'and the whole committed diff from BASE is nothing else')
  for (const rel of CHAT_CAPS_FILES) {
    const now = git('show', `${head}:${rel}`), diff = lineDiff(baseText(rel), now)
    assert.ok(diff.length === MARKED_COUNT[rel] && diff.every(line => line.startsWith('+') && CHAT_CAPS_MARKER_RE.test(line)), `${rel}: ${MARKED_COUNT[rel]} added lines, each with the marker, none removed`)
    assert.equal(stripChatCaps(rel, now), baseText(rel), `${rel}: without its marked lines the file is the base's, byte for byte`)
  }
  for (const rel of CHAT_CAPS_NEW_FILES) assert.equal(git('cat-file', '-t', `${head}:${rel}`).trim(), 'blob', rel)
  for (const rel of CHAT_CAPS_PIN_FILES) assert.equal(stripChatCaps(rel, git('show', `${head}:${rel}`)), baseText(rel), `${rel}: an older proof taught: put back it is the base's`)
  for (const rel of ['app/builder/page.tsx', 'components/builder/message-list.tsx', 'lib/studio-chat-parity.ts', 'lib/studio-chat-parity-runners.ts', 'lib/chat-theme-export.ts', 'lib/studio-flow-control.ts', 'hooks/use-studio-flow-control.ts', 'package.json']) assert.ok(!touched.has(rel), `${rel} is not touched by this change`)
}
const scopeEnvAndRegistry = head => {
  const envText = git('show', `${head}:.env.example`), baseEnv = baseText('.env.example')
  assert.equal(registry.stripLaterEnvBlocks('.env.example', envText), registry.stripLaterEnvBlocks('.env.example', baseEnv), '.env.example is the base plus the registered blocks and nothing else')
  assert.equal(envText.split(CHAT_CAPS_ENV_BLOCK).length - 1, 1, 'this change\'s block is there exactly once, verbatim')
  assert.ok(envText.includes(`\n\n${CHAT_CAPS_ENV_BLOCK}`), 'a blank line before the block')
  assert.ok(envText.endsWith(CHAT_CAPS_ENV_BLOCK), 'the block is the last one')
  const diff = diffLines(git('diff', '-U0', `${BASE_COMMIT}..${head}`, '--', 'scripts/studio-later-changes.mjs'))
  assert.equal(diff.filter(line => line.startsWith('-')).length, 0, 'the registry loses no line')
  const own = diff.filter(line => line.includes('studio-chat-caps-strip.mjs'))
  assert.equal(own.length, 3, 'the registry gains exactly this change\'s three lines'); for (const line of own) assert.ok(line.startsWith('+') && line.includes('// LATER-CHANGE:'), line.slice(0, 140))
  assert.deepEqual(own.map(line => /\)\.(\w+), \/\//.exec(line)?.[1]), ['CHAT_CAPS_SCOPE_FILES', 'CHAT_CAPS_ENV_BLOCK', 'stripChatCaps'])
  assert.equal(diff.length, 3, 'and nothing else in the registry')
  const reg = git('show', `${head}:scripts/studio-later-changes.mjs`).split('\n')
  for (const line of own) { const at = reg.indexOf(line.slice(1)); assert.ok(at > 0 && reg[at - 1].includes('studio-phone-shell-coverage-strip.mjs') && reg[at + 1].startsWith('  // one line per later change'), `at the TRUE END of its list, after PHONE_SHELL_COVERAGE: ${line.slice(1, 80)}`) }
}
const scopeAll = head => { scopeOwnCommits(head); scopeCommittedFiles(head); scopeEnvAndRegistry(head) }

const HEAD = scopeHead('HEAD')
/** This change's own commits on the FIRST-PARENT line of `head` from BASE. Merged into dev, its commits come in by a merge's second parent and that line has none of them. */
const ownOnLine = head => git('rev-list', '--first-parent', '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => isOwnSubject(subjectOf(c)))
/** There the committed diff from BASE holds the later changes' work too, so the scope checks stand down; the pins (read past the later changes' strips) and every other section still run. */
const ON_OWN_LINE = ownOnLine(HEAD).length > 0
const scopeCheck = (label, fn) => (ON_OWN_LINE ? check(label, fn) : undefined)
if (!ON_OWN_LINE) console.log('NOTE scope: no commit of this change on the first-parent line from BASE (merged into dev: its commits are on a second parent); the scope checks stand down, the pins above cover the files')
await scopeCheck(`this change's own commits (subject starts "${CHAT_CAPS_SUBJECT}", found across the whole line, no merges) exist, with the co-author line; none could be taken for an older change's`, () => { scopeOwnCommits(HEAD) })
await scopeCheck('the committed files are exactly this change\'s; every line added to an app file is a marked pure insertion; the strip gives the base back byte for byte; the page, the cards and the executors are not touched', () => scopeCommittedFiles(HEAD))
await scopeCheck('.env.example is the base plus the block (after one blank line, the last one); the registry gains exactly its three marked lines at the true end of each list, after PHONE_SHELL_COVERAGE, and loses none', () => scopeEnvAndRegistry(HEAD))
const gateMerge = (dev, head) => plumb(['commit-tree', plumb(['merge-tree', '--write-tree', dev, head]).split('\n')[0], '-p', dev, '-p', head, '-m', 'gate-style merge (local, no ref)'])
const GATE = ON_OWN_LINE ? gateMerge(BASE_COMMIT, HEAD) : null
await scopeCheck('GATE-SAFE: on a gate-style merge (first parent BASE, second parent this change\'s head) the scope head is HEAD^2 and the whole scope section passes against it; the merged tree is read too', () => {
  assert.deepEqual(parentsOf(GATE), [BASE_COMMIT, HEAD])
  assert.deepEqual(git('log', '--format=%H', '--first-parent', '--no-merges', `${BASE_COMMIT}..${GATE}`).split('\n').filter(Boolean), [], 'the gate\'s first-parent, no-merges line from BASE is empty: why HEAD itself cannot be used')
  assert.equal(scopeHead(GATE), HEAD, 'HEAD^2 is the change\'s head')
  scopeAll(scopeHead(GATE)); scopeEnvAndRegistry(GATE)
  for (const rel of CHAT_CAPS_FILES) assert.equal(stripChatCaps(rel, git('show', `${GATE}:${rel}`)), baseText(rel), `the merged tree, without this change's lines, is the base's ${rel}`)
  assert.equal(scopeHead(HEAD), HEAD, 'a branch head is used as it is'); assert.equal(scopeHead(BASE_COMMIT), BASE_COMMIT, 'BASE itself is used as it is')
})
await scopeCheck('mutant caught: the old first-parent own-commit query finds no own commit on the gate-style merge, and without the HEAD^2 rule the scope head is the merge itself', () => {
  const head = scopeHead(GATE, { gateRule: false })
  assert.equal(head, GATE)
  assert.throws(() => scopeOwnCommits(head, { firstParentOnly: true }), /no own commit yet/)
  assert.doesNotThrow(() => scopeOwnCommits(head), 'the subject query across the line finds them on the merge itself')
})
/** A commit (objects only, no ref) whose tree is `parent`'s with `edits` ({path: text}) applied, built through a temporary index file. */
const commitWith = (parent, edits, message) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccm-idx-'))
  try {
    const envIdx = { GIT_INDEX_FILE: path.join(dir, 'index') }
    plumb(['read-tree', parent], envIdx)
    for (const [rel, text] of Object.entries(edits)) plumb(['update-index', '--add', '--cacheinfo', `100644,${blobOf(text)},${rel}`], envIdx)
    return plumb(['commit-tree', plumb(['write-tree'], envIdx), '-p', parent, '-m', message])
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const TRAILER = '\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>'
const unrelated = ON_OWN_LINE ? commitWith(BASE_COMMIT, { 'unrelated-after-base.txt': 'unrelated\n' }, 'Dev: an unrelated commit after BASE') : null
const ADVANCED_GATE = ON_OWN_LINE ? gateMerge(unrelated, HEAD) : null
await scopeCheck('GATE-SAFE after dev moved on: a gate merge whose first parent is a dev commit past BASE: the scope head is still this change\'s head and the scope section passes', () => {
  assert.deepEqual(parentsOf(ADVANCED_GATE), [unrelated, HEAD]); assert.notEqual(parentsOf(ADVANCED_GATE)[0], BASE_COMMIT)
  assert.equal(scopeHead(ADVANCED_GATE), HEAD)
  scopeAll(scopeHead(ADVANCED_GATE)); scopeEnvAndRegistry(ADVANCED_GATE)
  assert.equal(ownOf(ADVANCED_GATE).length, ownOf(HEAD).length, 'the same own commits are found on the merge')
})
await scopeCheck('mutant caught: a stray file in a "Chat caps:" commit, an own commit without the co-author line, an unmarked line added to the hook or types/mdc.ts, and a touched foreign file (the page, the message list) fail the scope', () => {
  const stray = commitWith(HEAD, { 'stray-chat-caps.txt': 'stray\n' }, `${CHAT_CAPS_SUBJECT} a stray file${TRAILER}`)
  assert.ok(ownOf(stray).includes(stray)); assert.doesNotThrow(() => scopeCommittedFiles(HEAD)); assert.throws(() => scopeCommittedFiles(stray), /exactly its scope/)
  const noTrailer = commitWith(HEAD, {}, `${CHAT_CAPS_SUBJECT} no trailer`)
  assert.throws(() => scopeOwnCommits(noTrailer), error => /^[0-9a-f]{8}$/.test(error.message), 'the commit without the trailer is named')
  for (const rel of CHAT_CAPS_FILES) {
    const sneaky = commitWith(HEAD, { [rel]: git('show', `${HEAD}:${rel}`).replace(/^(import [^\n]*\n)/m, '$1const sneaky = 1\n') }, `${CHAT_CAPS_SUBJECT} a sneaky line${TRAILER}`)
    assert.throws(() => scopeCommittedFiles(sneaky), /added lines|exactly its scope/, rel)
  }
  for (const rel of ['app/builder/page.tsx', 'components/builder/message-list.tsx']) {
    const foreign = commitWith(HEAD, { [rel]: git('show', `${HEAD}:${rel}`) + '\n' }, `${CHAT_CAPS_SUBJECT} touches ${rel}${TRAILER}`)
    assert.throws(() => scopeCommittedFiles(foreign), /exactly its scope|is not touched/, rel)
  }
})
// a branch stacked after this change: dev's merge brings it in by its SECOND parent, then a later change adds its own subject filter beside this change's in a taught proof
const SYN = { file: 'scripts/test-studio-deck-sync-truth.mjs', mark: 'registry read (SYNTHETIC-LATER)' }
const synStrip = (rel, text) => (rel === SYN.file && typeof text === 'string' ? text.split('\n').filter(line => !line.includes(SYN.mark)).join('\n') : text)
const stackedAfter = () => {
  const dev = gateMerge(BASE_COMMIT, HEAD), taught = git('show', `${dev}:${SYN.file}`).split('\n')
  const at = taught.findIndex(line => line.includes('registry read (CHAT-CAPS-META)')); assert.ok(at > 0, 'this change\'s subject filter is in the taught proof')
  taught.splice(at + 1, 0, `  shas.splice(0, shas.length, ...shas.filter(sha => !/^Synthetic later:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: ${SYN.mark}: a made-up change stacked after this one`)
  return commitWith(dev, { [SYN.file]: taught.join('\n') }, `Synthetic later: a change stacked after this one${TRAILER}`)
}
await scopeCheck('ROBUST AFTER MERGE: on a branch stacked after this change (dev\'s merge brings it in by a second parent, then a later change adds its subject filter beside this one\'s in a taught proof) no own commit is on the first-parent line, so the scope checks stand down there, and the pins, read past the later change\'s strip, still pass', () => {
  const later = stackedAfter(), readAt = rel => git('show', `${later}:${rel}`)
  assert.equal(ownOf(later).length, ownOf(HEAD).length, 'this change\'s commits are all there, by the second parent'); assert.deepEqual(ownOnLine(later), [], 'none of them on the first-parent line')
  provePins(readAt, 'stacked after', (rel, text) => synStrip(rel, laterStrips(rel, text)))
  assert.throws(() => provePins(readAt, 'stacked after, not told', laterStrips), /put back it is the base's/, 'mutant caught: without the later change\'s strip, its line breaks the put-back')
})

// ===== 8. mutants (each one edit of the real sources, fed to the same checks) ===========================================================================
if (!process.env.CHECK_ONLY) console.log('mutants')
const libSrc = read(LIB), hookSrc = read(HOOK)
const libMutant = (from, to) => loadLib({ [FLAG]: 'true' }, swap(libSrc, from, to))
await mutant('parser: a legacy false is read as available', () => proveReplay(libMutant('    if (value === true) {', '    if (value === true || value === false) {')))
await mutant('parser: the string "true" is read as a legacy true', () => proveReplay(libMutant('    if (value === true) {', "    if (value === true || value === 'true') {")))
await mutant('parser: an entry with an extra field is accepted', () => proveReplay(libMutant('Object.keys(value).length !== 2 || ', '')))
await mutant('parser: a key unknown to the UI is kept', () => proveReplay(libMutant('    if (!knownKey(key)) continue\n', '')))
await mutant('parser: the sibling\'s hint is ignored', () => proveReplay(libMutant('const legacy = sibling && own(sibling, key) ? hintOf(sibling[key]) : null', 'const legacy = null as { confirm: boolean; clientDirective: boolean } | null')))
await mutant('parser: the sibling wins over the nested value', () => proveReplay(libMutant('    const typed = hintOf(value)\n', '    const typed = (sibling && own(sibling, key) ? hintOf(sibling[key]) : null) ?? hintOf(value)\n')))
await mutant('parser: an operation hint without its group is kept', () => proveReplay(libMutant('if (hint && caps.has(capability))', 'if (hint)')))
await mutant('parser: a mixed group\'s false is read as permission to skip the card', () => proveReplay(libMutant("  if (CHAT_CAPS_MIXED_GROUPS.includes(key) && cap.confirm !== true) return undefined\n", '')))
await mutant('parser: absent is read as known-empty', () => proveReplay(libMutant('  if (!isRecord(capabilities)) return UNKNOWN\n', '  if (!isRecord(capabilities)) return Object.freeze({ known: true as const, caps: new Map(), operations: new Map() })\n')))
await mutant('parser: {} is read as unknown', () => proveReplay(libMutant('  const sibling = isRecord(capabilityMeta)', '  if (Object.keys(capabilities).length === 0) return UNKNOWN\n  const sibling = isRecord(capabilityMeta)')))
await mutant('holder: merges with the snapshot before', () => proveHolder(swap(libSrc, '  held = { snapshot: parseSyncChatCapabilities(payload), isCurrent: owner.isCurrent }', '  const next = parseSyncChatCapabilities(payload)\n  held = { snapshot: held && held.snapshot.known && next.known ? Object.freeze({ known: true as const, caps: new Map([...held.snapshot.caps, ...next.caps]), operations: new Map([...held.snapshot.operations, ...next.operations]) }) : next, isCurrent: owner.isCurrent }')))
await mutant('holder: a stale socket\'s reply is written', () => proveHolder(swap(libSrc, " || !stillCurrent(owner.isCurrent)) return", ') return')))
await mutant('holder: another session\'s reply is written', () => proveHolder(swap(libSrc, ' || owner.frameSessionId !== owner.socketSessionId) return', ') return')))
await mutant('holder: a no-longer-current snapshot is still read', () => proveHolder(swap(libSrc, '  if (held && !stillCurrent(held.isCurrent)) held = null\n', '')))
await mutant('holder: a read hands out the held maps', () => proveHolder(swap(libSrc, 'caps: new Map(held.snapshot.caps), operations: new Map(held.snapshot.operations)', 'caps: held.snapshot.caps, operations: held.snapshot.operations')))
await mutant('hook: the call is not gated on the flag (flag off then writes)', async () => {
  const text = swap(hookSrc, '                  if (STUDIO_CHAT_CAPS_META_ENABLED) chatCapsSyncReceived(', '                  if (true) chatCapsSyncReceived(')
  const h = await mountHook({ flag: undefined, hookText: text }); await h.deliver(withCaps(SYNC_SKIP, 'm1', { chat_capabilities: '$typed_defaults' })); const s = h.snapshot(); h.unmount()
  assert.equal(s, 'UNKNOWN', 'flag off: UNKNOWN')
})
await mutant('hook: the frame\'s own session is not passed (another session\'s sync is read)', async () => {
  const text = swap(hookSrc, '{ frameSessionId: message.session_id, socketSessionId,', '{ frameSessionId: socketSessionId, socketSessionId,')
  const h = await mountHook({ flag: 'true', hookText: text }); await h.deliver(withCaps(SYNC_SKIP, 'm2', { chat_capabilities: { qa: true } })); await h.deliver(withCaps(FOREIGN, 'm2f', { chat_capabilities: '$typed_defaults' })); const s = h.snapshot(); h.unmount()
  assert.deepEqual(s.caps, { qa: [null, null] }, 'another session\'s sync changes nothing')
})
await mutant('pins: an unmarked line added to the hook', () => provePins(rel => (rel === HOOK ? swap(read(HOOK), "                case 'sync_response':\n", "                case 'sync_response':\n                  void 0;\n") : read(rel))))
await mutant('pins: the logic line moved out of the sync_response case', () => provePins(rel => {
  if (rel !== HOOK) return read(rel)
  const lines = read(HOOK).split('\n'), at = lines.findIndex(l => CHAT_CAPS_MARKER_RE.test(l) && l.includes('chatCapsSyncReceived(message.payload')), [line] = lines.splice(at, 1)
  lines.splice(lines.findIndex(l => l === "                case 'chat_message':") , 0, line); return lines.join('\n')
}))
await mutant('pins: the import put before the first import (#585\'s spot)', () => provePins(rel => {
  if (rel !== HOOK) return read(rel)
  const lines = read(HOOK).split('\n'), at = lines.findIndex(l => CHAT_CAPS_MARKER_RE.test(l) && l.startsWith('import ')), [line] = lines.splice(at, 1); lines.unshift(line); return lines.join('\n')
}))
await mutant('pins: a taught proof keeps a second, unmarked line', () => provePins(rel => (rel === CHAT_CAPS_PIN_FILES[0] ? read(rel).replace(CHAT_CAPS_PIN_EDITS[rel][0][0], `${CHAT_CAPS_PIN_EDITS[rel][0][0]}  // stray\n`) : read(rel))))
await mutant('pins: types/mdc.ts rewrites its base line instead of adding one', () => provePins(rel => (rel === MDC ? swap(read(MDC), '  chat_capabilities?: Record<string, boolean>\n    | Record<string, MdcChatCapabilityMeta>', '  chat_capabilities?: Record<string, boolean | MdcChatCapabilityMeta> // CHAT-CAPS-META: rewritten\n    | Record<string, MdcChatCapabilityMeta>') : read(rel))))

console.log(`\n${passed} passed, ${failed.length} failed; mutants ${caught} caught, ${missed.length} missed`)
if (failed.length || missed.length) { for (const label of failed) console.error(`  failed: ${label}`); for (const label of missed) console.error(`  missed: ${label}`); process.exit(1) }
