// PASS2D R6 (FRONTEND-1): opening a saved session no longer writes to it or bumps it in Sessions. Flag NEXT_PUBLIC_STUDIO_SESSION_OPEN_READ_ONLY (exact "true"), default off.
//   Director answers a reconnect with a sync and, for a session with no topic, a fresh greeting (at the outline step the plan-confirmation card again); the Builder saved each of those
//   (a new message id with the reconnect's time moves lastMessageAt), echoed the restored state back to the row with lastMessageAt = now, and its Layout count reconcile did the
//   same. With the flag on an OPENED session is quiet until the user acts: passive metadata keeps only what is new and never lastMessageAt, passive bot messages are held, and the
//   first action (a user message, or any metadata write that is not passive) ends the quiet period for good and sends what was held, in order, before it.
//
// Run: node scripts/test-studio-open-read-only.mjs   (plain node: transpile + vm, no network, no browser, no env)
//
// Proven on the REAL sources: lib/studio-open-read-only.ts, hooks/use-session-persistence.ts, hooks/use-builder-session.ts, app/builder/page.tsx:
//   1. the pure gate over grids (stored row x update, message ids, hold limit, release) against an independent oracle;
//   2. the real persistence hook driven over a spy history: flag off every passive write goes out as before; flag on, quiet sessions send only what is new and never lastMessageAt,
//      hold bot messages, and the first action releases them in order; a session that was not opened, a released session and the other session are untouched;
//   3. the wiring: the begin call after the row is read, the passive marks (four message writes, two title writes, the page's two calls), the skipped URL repair, the flag read once;
//   4. mutation check: every mutant of the four sources is killed by sections 1-3.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
import { stripOpenReadOnly } from './studio-open-read-only-strip.mjs'

const root = path.resolve(new URL('..', import.meta.url).pathname)
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const LIB = 'lib/studio-open-read-only.ts'
const HOOK = 'hooks/use-session-persistence.ts'
const BUILDER = 'hooks/use-builder-session.ts'
const PAGE = 'app/builder/page.tsx'
const QUEUE = 'lib/director-chat-history.ts'
const HYGIENE = 'lib/studio-session-hygiene.ts'
const FLAG = 'NEXT_PUBLIC_STUDIO_SESSION_OPEN_READ_ONLY'
const SOURCES = { [LIB]: read(LIB), [HOOK]: read(HOOK), [BUILDER]: read(BUILDER), [PAGE]: read(PAGE) }
const QUEUE_SOURCE = read(QUEUE), HYGIENE_SOURCE = read(HYGIENE)

let checks = 0
const count = fn => (...args) => { checks++; return fn(...args) }
const eq = count(assert.equal), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch)
const json = count((a, b, m) => assert.equal(JSON.stringify(a), JSON.stringify(b), m))

const compile = (source, fileName) => ts.transpileModule(source, { fileName, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
function loadModule(source, fileName, { env = {}, stubs = {} } = {}) {
  const mod = { exports: {} }
  vm.runInNewContext(compile(source, fileName), {
    module: mod, exports: mod.exports, process: { env }, console, Date, Set, Map, Array, JSON, Promise, setTimeout, clearTimeout,
    require: id => { if (!(id in stubs)) throw new Error(`unexpected import ${id}`); return stubs[id] },
  })
  return mod.exports
}
const loadLib = (source, on) => loadModule(source, LIB, { env: on ? { [FLAG]: 'true' } : {} })

// ---------------------------------------------------------------- 1. the pure gate
const ROW = {
  title: 'Q3 review', currentStage: 4, slideCount: 3, blankPresentationUrl: 'http://l/p/b', blankPresentationId: 'b', strawmanPreviewUrl: 'http://l/p/s', strawmanPresentationId: 's',
  finalPresentationUrl: null, finalPresentationId: null,
  stateCache: { activeVersion: 'strawman', slideStructure: { slides: [{ title: 'A' }, { title: 'B' }] } },
  messages: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }],
}
const KEYS = ['title', 'currentStage', 'slideCount', 'blankPresentationUrl', 'blankPresentationId', 'strawmanPreviewUrl', 'strawmanPresentationId', 'finalPresentationUrl', 'finalPresentationId']
function oracleMetadata(row, updates) {
  if (!updates || typeof updates !== 'object') return null
  const out = {}
  for (const [key, value] of Object.entries(updates)) {
    if (key === 'lastMessageAt' || value === undefined || value === null) continue
    if (key === 'stateCache') {
      const a = row.stateCache?.activeVersion ?? null, b = value.activeVersion ?? null
      const c = JSON.stringify(row.stateCache?.slideStructure ?? null), d = JSON.stringify(value.slideStructure ?? null)
      if (a !== b || c !== d) out[key] = value
      continue
    }
    if (KEYS.includes(key) && row[key] !== undefined && row[key] !== null && row[key] === value) continue
    out[key] = value
  }
  return Object.keys(out).length ? out : null
}
const UPDATES = [
  { lastMessageAt: '2026-10-17T10:00:00Z' },
  { lastMessageAt: new Date(0), currentStage: 4, slideCount: 3 },
  { currentStage: 4, slideCount: 3, strawmanPreviewUrl: 'http://l/p/s', strawmanPresentationId: 's', stateCache: { activeVersion: 'strawman', slideStructure: { slides: [{ title: 'A' }, { title: 'B' }] } }, lastMessageAt: 'now' },
  { currentStage: 4, slideCount: 5, lastMessageAt: 'now' },
  { currentStage: 6, finalPresentationUrl: 'http://l/p/f', finalPresentationId: 'f', slideCount: 3 },
  { slideCount: '3' }, { currentStage: '4' }, { slideCount: 3.0 }, { slideCount: null }, { slideCount: undefined, currentStage: undefined }, { title: 'Q3 review' }, { title: 'Q4 review' }, { title: '' },
  { stateCache: { activeVersion: 'final', slideStructure: { slides: [{ title: 'A' }, { title: 'B' }] } } },
  { stateCache: { activeVersion: 'strawman', slideStructure: { slides: [{ title: 'A' }] } } },
  { stateCache: { activeVersion: 'strawman' } }, { stateCache: {} }, { stateCache: null },
  { blankPresentationUrl: 'http://l/p/b', blankPresentationId: 'b', currentStage: 0 }, { someNewField: 1 }, { someNewField: null }, {}, null, undefined, 'x', 7,
]
function proveLib(lib, label = 'lib') {
  eq(lib.OPEN_QUIET_HELD_LIMIT, 200, `${label}: the hold limit`)
  json([...lib.OPEN_QUIET_ROW_KEYS], KEYS, `${label}: the compared row fields`)
  const state = lib.beginOpenQuiet('S1', ROW)
  eq(state.quiet, true, `${label}: begins quiet`); eq(state.sessionId, 'S1', `${label}: the session`)
  json([...state.storedMessageIds].sort(), ['m1', 'm2', 'm3'], `${label}: the stored message ids`)
  eq(state.stored.finalPresentationUrl, undefined, `${label}: a null stored value is not a stored value`)
  for (const update of UPDATES) json(lib.openQuietMetadata(state, update), oracleMetadata(ROW, update), `${label}: metadata ${JSON.stringify(update)}`)
  // a row with nothing stored: every non-null field is new
  const empty = lib.beginOpenQuiet('S2', { messages: [] })
  json(lib.openQuietMetadata(empty, { currentStage: 0, slideCount: 1, lastMessageAt: 'x', blankPresentationUrl: 'u' }), { currentStage: 0, slideCount: 1, blankPresentationUrl: 'u' }, `${label}: nothing stored, nothing is an echo (zero counts as a value)`)
  for (const bad of [null, undefined, 5, 'x', [], {}]) { const s = lib.beginOpenQuiet('S3', bad); eq(s.quiet, true, `${label}: begin over ${JSON.stringify(bad)}`); eq(s.storedMessageIds.size, 0, `${label}: no ids from ${JSON.stringify(bad)}`) }
  const odd = lib.beginOpenQuiet('S4', { messages: [null, 1, { id: 5 }, { id: 'ok' }, {}] })
  json([...odd.storedMessageIds], ['ok'], `${label}: only string ids are kept`)
  // quiet?
  ok(lib.isOpenQuiet(state, 'S1'), `${label}: quiet for its session`)
  for (const other of ['S2', '', null, undefined, 5]) eq(lib.isOpenQuiet(state, other), false, `${label}: not quiet for ${JSON.stringify(other)}`)
  eq(lib.isOpenQuiet(null, 'S1'), false, `${label}: no state, not quiet`); eq(lib.isOpenQuiet(undefined, 'S1'), false, `${label}: undefined state`)
  // messages
  const a = lib.beginOpenQuiet('S1', ROW)
  eq(lib.openQuietHoldMessage(a, 'S1', { message_id: 'm2' }), true, `${label}: a stored message is not sent`)
  eq(a.held.length, 0, `${label}: and is not held either`)
  eq(lib.openQuietHoldMessage(a, 'S1', { message_id: 'new-1' }), true, `${label}: a new message is held`)
  eq(lib.openQuietHoldMessage(a, 'S1', { message_id: 'new-2' }, 'hello'), true, `${label}: a replayed user message is held`)
  eq(lib.openQuietHoldMessage(a, 'S1', {}), true, `${label}: a message without an id is held`)
  eq(lib.openQuietHoldMessage(a, 'S9', { message_id: 'other' }), false, `${label}: another session's message is not held`)
  json(a.held.map(h => [h.message.message_id ?? null, h.userText ?? null]), [['new-1', null], ['new-2', 'hello'], [null, null]], `${label}: held in order with the user text`)
  const released = lib.releaseOpenQuiet(a)
  eq(released.length, 3, `${label}: release returns what was held`); eq(a.quiet, false, `${label}: and ends the period`); eq(a.held.length, 0, `${label}: nothing is left held`)
  json(lib.releaseOpenQuiet(a), [], `${label}: a second release returns nothing`)
  eq(lib.openQuietHoldMessage(a, 'S1', { message_id: 'late' }), false, `${label}: after release nothing is held`)
  eq(lib.isOpenQuiet(a, 'S1'), false, `${label}: not quiet after release`)
  json(lib.releaseOpenQuiet(null), [], `${label}: release of nothing`)
  // the limit
  const big = lib.beginOpenQuiet('S1', ROW)
  for (let i = 0; i < 231; i++) lib.openQuietHoldMessage(big, 'S1', { message_id: `n${i}` })
  eq(big.held.length, 200, `${label}: at most 200 held`); eq(big.held[0].message.message_id, 'n31', `${label}: the oldest are dropped`); eq(big.held[199].message.message_id, 'n230', `${label}: the newest are kept`)
  const blankId = lib.beginOpenQuiet('', ROW)
  eq(lib.isOpenQuiet(blankId, ''), false, `${label}: an empty session id is never quiet`)
  // the flag constant
  eq(loadLib(SOURCES[LIB], true).STUDIO_SESSION_OPEN_READ_ONLY_ENABLED, true, `${label}: flag "true" is on`)
  for (const value of ['false', '', '1', 'TRUE', ' true', 'true ', 'yes']) eq(loadModule(SOURCES[LIB], LIB, { env: { [FLAG]: value } }).STUDIO_SESSION_OPEN_READ_ONLY_ENABLED, false, `${label}: ${JSON.stringify(value)} is off`)
  eq(loadLib(SOURCES[LIB], false).STUDIO_SESSION_OPEN_READ_ONLY_ENABLED, false, `${label}: unset is off`)
}

// ---------------------------------------------------------------- 2. the real persistence hook
const react = { useRef: v => ({ current: v }), useCallback: f => f, useEffect() {} }
function hookHarness(sources, on, { session = 'S1' } = {}) {
  const calls = { saved: [], updated: [] }
  const lib = loadModule(sources[LIB], LIB, { env: on ? { [FLAG]: 'true' } : {} })
  const mod = loadModule(sources[HOOK], HOOK, {
    env: {},
    stubs: {
      react, './use-chat-sessions': { useChatSessions: () => ({
        saveMessages: async (sid, messages) => { calls.saved.push({ sid, ids: messages.map(m => m.id), texts: messages.map(m => m.userText ?? null) }); return { saved: messages.length, failed: 0, total: messages.length } },
        updateSession: async (sid, updates) => { calls.updated.push({ sid, updates: JSON.parse(JSON.stringify(updates)) }); return {} },
      }) },
      './use-session-cache': { useSessionCache: () => ({ appendMessage() {} }) },
      '@/lib/debug-log': { debugLog() {} },
      '@/lib/director-chat-history': loadModule(QUEUE_SOURCE, QUEUE),
      '@/lib/studio-session-hygiene': loadModule(HYGIENE_SOURCE, HYGIENE, { stubs: { '@/lib/last-builder-session': { unsavedBuilderSessionKey: (o, s) => `${o}:${s}` } } }),
      '@/lib/studio-open-read-only': lib,
      './use-deckster-websocket-v2': {},
    },
  })
  const hook = mod.useSessionPersistence({ sessionId: session, userId: 'U1', enabled: true, debounceMs: 0 })
  return { hook, calls }
}
const bot = (id, type = 'chat_message', session = 'S1') => ({ message_id: id, session_id: session, timestamp: '2026-10-17T10:00:00.000Z', type, payload: { text: id } })
const PASSIVE = { passive: true }
const WRITE = { currentStage: 4, slideCount: 3, title: 'Q3 review', strawmanPreviewUrl: 'http://l/p/s', lastMessageAt: new Date('2026-10-17T10:00:00Z'), stateCache: { activeVersion: 'strawman', slideStructure: { slides: [{ title: 'A' }, { title: 'B' }] } } }

async function proveHook(sources, label = 'hook') {
  // flag off: a passive mark changes nothing; begin does nothing
  {
    const { hook, calls } = hookHarness(sources, false)
    hook.beginOpenQuiet('S1', ROW)
    await hook.updateMetadata(WRITE, PASSIVE)
    json(calls.updated.map(c => c.updates), [{ ...WRITE, lastMessageAt: '2026-10-17T10:00:00.000Z' }], `${label}: flag off, a passive write goes out whole, with lastMessageAt`)
    hook.queueMessage(bot('g1'), undefined, PASSIVE); hook.queueMessage(bot('u1'), 'hi', PASSIVE)
    await hook.flushMessages()
    json(calls.saved.map(c => c.ids), [['g1', 'u1']], `${label}: flag off, passive messages are saved`)
    json(calls.saved[0].texts, [null, 'hi'], `${label}: with their text`)
  }
  // flag on, never begun (a session that was not opened): untouched
  {
    const { hook, calls } = hookHarness(sources, true)
    await hook.updateMetadata(WRITE, PASSIVE)
    json(calls.updated.map(c => c.updates.lastMessageAt), ['2026-10-17T10:00:00.000Z'], `${label}: not opened, a passive write is whole`)
    hook.queueMessage(bot('g1'), undefined, PASSIVE); await hook.flushMessages()
    json(calls.saved.map(c => c.ids), [['g1']], `${label}: not opened, a passive message is saved`)
  }
  // flag on, opened: echo and bump are not sent
  {
    const { hook, calls } = hookHarness(sources, true)
    hook.beginOpenQuiet('S1', ROW)
    await hook.updateMetadata(WRITE, PASSIVE)
    eq(calls.updated.length, 0, `${label}: an echo of the stored row writes nothing`)
    await hook.updateMetadata({ lastMessageAt: new Date(), slideCount: null }, PASSIVE)
    eq(calls.updated.length, 0, `${label}: a bump with no value writes nothing`)
    await hook.updateMetadata({ ...WRITE, slideCount: 5 }, PASSIVE)
    json(calls.updated.map(c => c.updates), [{ slideCount: 5 }], `${label}: a real change is sent alone, without lastMessageAt`)
    eq('lastMessageAt' in calls.updated[0].updates, false, `${label}: never lastMessageAt while quiet`)
    hook.queueMessage(bot('greeting-new'), undefined, PASSIVE); hook.queueMessage(bot('m2'), undefined, PASSIVE); hook.queueMessage(bot('card-new', 'action_request'), undefined, PASSIVE)
    await hook.flushMessages()
    eq(calls.saved.length, 0, `${label}: passive bot messages (new or stored) are not sent`)
    eq(hook.pendingCount, 0, `${label}: and nothing is queued`)
    // the first user message releases: held ones go first, in order, then the user's
    hook.queueMessage(bot('user-1'), 'make it shorter')
    await hook.flushMessages()
    json(calls.saved.map(c => c.ids), [['greeting-new', 'card-new', 'user-1']], `${label}: the first user message sends what was held, in order, then itself`)
    json(calls.saved[0].texts, [null, null, 'make it shorter'], `${label}: with the user's text`)
    // released: everything as before
    await hook.updateMetadata(WRITE, PASSIVE)
    eq(calls.updated.length, 2, `${label}: after release a passive write goes out whole`)
    eq(calls.updated[1].updates.lastMessageAt, '2026-10-17T10:00:00.000Z', `${label}: with lastMessageAt`)
    hook.queueMessage(bot('late-1'), undefined, PASSIVE); await hook.flushMessages()
    json(calls.saved.map(c => c.ids), [['greeting-new', 'card-new', 'user-1'], ['late-1']], `${label}: after release a passive message is saved`)
  }
  // flag on, opened: a metadata write that is not passive is the user's and releases
  {
    const { hook, calls } = hookHarness(sources, true)
    hook.beginOpenQuiet('S1', ROW)
    hook.queueMessage(bot('greeting-new'), undefined, PASSIVE)
    await hook.updateMetadata({ slideCount: 4, lastMessageAt: new Date('2026-10-17T11:00:00Z') })
    json(calls.updated.map(c => c.updates), [{ slideCount: 4, lastMessageAt: '2026-10-17T11:00:00.000Z' }], `${label}: a user write goes out whole, with lastMessageAt`)
    for (let i = 0; i < 20; i++) await Promise.resolve()
    json(calls.saved.map(c => c.ids), [['greeting-new']], `${label}: and sends what was held without anyone asking`)
    await hook.flushMessages()
    json(calls.saved.map(c => c.ids), [['greeting-new']], `${label}: and releases what was held`)
    await hook.updateMetadata(WRITE, PASSIVE)
    eq(calls.updated.length, 2, `${label}: released for good`)
  }
  // flag on, opened: a non-passive message without text (a page flow) releases too
  {
    const { hook, calls } = hookHarness(sources, true)
    hook.beginOpenQuiet('S1', ROW)
    hook.queueMessage(bot('greeting-new'), undefined, PASSIVE)
    hook.queueMessage(bot('flow-1', 'action_request'))
    await hook.flushMessages()
    json(calls.saved.map(c => c.ids), [['greeting-new', 'flow-1']], `${label}: a non-passive message releases and goes after what was held`)
  }
  // a replayed user message is passive and keeps its text when released
  {
    const { hook, calls } = hookHarness(sources, true)
    hook.beginOpenQuiet('S1', ROW)
    hook.queueMessage(bot('replay-u'), 'old question', PASSIVE)
    await hook.flushMessages()
    eq(calls.saved.length, 0, `${label}: a replayed user message is held, not saved`)
    hook.queueMessage(bot('user-2'), 'new question'); await hook.flushMessages()
    json(calls.saved[0].texts, ['old question', 'new question'], `${label}: and keeps its text when released`)
  }
  // begun again for a re-open: quiet again; begun for another session: that one is quiet, this one is not
  {
    const { hook, calls } = hookHarness(sources, true)
    hook.beginOpenQuiet('S1', ROW); hook.queueMessage(bot('x1'), 'go'); await hook.flushMessages()
    hook.beginOpenQuiet('S1', ROW)
    await hook.updateMetadata(WRITE, PASSIVE)
    eq(calls.updated.length, 0, `${label}: begun again, quiet again`)
    hook.beginOpenQuiet('S2', ROW)
    await hook.updateMetadata(WRITE, PASSIVE)
    eq(calls.updated.length, 1, `${label}: begun for another session, this session is not quiet`)
  }
  // a message of another session is never held by this one's quiet period
  {
    const { hook, calls } = hookHarness(sources, true)
    hook.beginOpenQuiet('S1', ROW)
    hook.queueMessage(bot('other', 'chat_message', 'S2'), undefined, PASSIVE); await hook.flushMessages()
    eq(calls.saved.length, 0, `${label}: a frame for another session is dropped by the hook's own rule, as before`)
  }
  // an empty begin id does nothing
  {
    const { hook, calls } = hookHarness(sources, true)
    hook.beginOpenQuiet('', ROW)
    await hook.updateMetadata(WRITE, PASSIVE)
    eq(calls.updated.length, 1, `${label}: an empty session id begins nothing`)
  }
}

// ---------------------------------------------------------------- 3. the wiring
function proveSources(src, label = 'sources') {
  const lib = src[LIB], hook = src[HOOK], builder = src[BUILDER], page = src[PAGE]
  eq(lib.match(/process\.env\.NEXT_PUBLIC_STUDIO_SESSION_OPEN_READ_ONLY === 'true'/g)?.length, 1, `${label}: the flag is read once, exact "true"`)
  nomatch(hook + builder, /process\.env\.NEXT_PUBLIC_STUDIO_SESSION_OPEN_READ_ONLY/, `${label}: neither hook reads the flag itself (the lib's constant is the one read)`)
  eq((hook.match(/STUDIO_SESSION_OPEN_READ_ONLY_ENABLED/g) || []).length, 4, `${label}: the persistence hook consults the flag at its import and three places`)
  match(hook, /beginOpenQuiet: beginOpenQuietFor,/, `${label}: the hook returns the begin call`)
  match(hook, /if \(!STUDIO_SESSION_OPEN_READ_ONLY_ENABLED \|\| !forSessionId\) return;/, `${label}: begin does nothing with the flag off`)
  match(hook, /async \(updates: SessionMetadataUpdates, options\?: SessionWriteOptions\)/, `${label}: updateMetadata takes the options`)
  match(hook, /\(message: DirectorMessage, userText\?: string, options\?: SessionWriteOptions\)/, `${label}: queueMessage takes the options`)
  match(builder, /const PASSIVE_WRITE = \{ passive: true \} as const/, `${label}: the passive mark is passive`)
  match(builder, /if \(STUDIO_SESSION_OPEN_READ_ONLY_ENABLED\) persistence\?\.beginOpenQuiet\?\.\(session\.id, session\)/, `${label}: the row that was read begins the quiet period`)
  ok(builder.indexOf('persistence?.beginOpenQuiet?.(session.id, session)') > builder.indexOf('setCurrentSessionId(session.id)\n            setSessionStoreName'), `${label}: after the session id is set`)
  ok(builder.indexOf('persistence?.beginOpenQuiet?.(session.id, session)') > builder.indexOf("debugLog('✅ Session loaded successfully')") && builder.indexOf('persistence?.beginOpenQuiet?.(session.id, session)') < builder.indexOf('if (session.title) {'), `${label}: right after the load is reported done, before the title is read`)
  eq((builder.match(/PASSIVE_WRITE/g) || []).length, 1 + 4 + 2, `${label}: the constant and seven marks`)
  eq((builder.match(/queueMessage\([^)]*PASSIVE_WRITE\)|\} as DirectorMessage, text, PASSIVE_WRITE\)/g) || []).length, 4, `${label}: four passive message writes`)
  eq((builder.match(/\}, PASSIVE_WRITE\)/g) || []).length, 2, `${label}: two passive title writes`)
  match(builder, /Object\.keys\(normalizedSessionUrls\)\.length > 0 && !STUDIO_SESSION_OPEN_READ_ONLY_ENABLED/, `${label}: the URL repair write is skipped`)
  eq((page.match(/updateMetadata\(updates, \{ passive: true \}\)/g) || []).length, 2, `${label}: the page marks its two passive writes`)
  eq((page.match(/passive: true/g) || []).length, 2, `${label}: and nothing else`)
  match(page, /persistenceRef\.current\.updateMetadata\(updates, \{ passive: true \}\) \/\/ NEXT_PUBLIC_STUDIO_SESSION_OPEN_READ_ONLY: Director's own state frame/, `${label}: the state frame handler`)
  match(page, /persistenceRef\.current\.updateMetadata\(updates, \{ passive: true \}\) \/\/ NEXT_PUBLIC_STUDIO_SESSION_OPEN_READ_ONLY: the page's own count reconcile/, `${label}: the count reconcile`)
  // the strip puts the page back to its unmarked calls
  const stripped = stripOpenReadOnly(PAGE, page)
  nomatch(stripped, /passive: true|SESSION_OPEN_READ_ONLY/, `${label}: the strip removes every trace from the page`)
  eq((stripped.match(/persistenceRef\.current\.updateMetadata\(updates\)/g) || []).length, (page.match(/persistenceRef\.current\.updateMetadata\(updates\)/g) || []).length + 2, `${label}: the strip restores the two plain calls`)
}

async function checkAll(src) {
  proveLib(loadLib(src[LIB], true))
  await proveHook(src)
  proveSources(src)
}
await checkAll(SOURCES)
const realChecks = checks

// ---------------------------------------------------------------- 4. mutants
const mutants = [
  [LIB, 'lastMessageAt kept', s => s.replace("if (key === 'lastMessageAt') continue\n", '')],
  [LIB, 'null written', s => s.replace('if (value === undefined || value === null) continue', 'if (value === undefined) continue')],
  [LIB, 'echo kept', s => s.replace('state.stored[key] === value) continue', 'false) continue')],
  [LIB, 'echo check loosened', s => s.replace('state.stored[key] === value) continue', 'state.stored[key] == value) continue')],
  [LIB, 'stateCache always kept', s => s.replace("if (next.activeVersion !== state.storedStateCache.activeVersion || next.slideStructure !== state.storedStateCache.slideStructure) out[key] = value", 'out[key] = value')],
  [LIB, 'stateCache version ignored', s => s.replace('next.activeVersion !== state.storedStateCache.activeVersion || ', '')],
  [LIB, 'stateCache structure ignored', s => s.replace(' || next.slideStructure !== state.storedStateCache.slideStructure', '')],
  [LIB, 'empty result sent', s => s.replace('return Object.keys(out).length > 0 ? out : null', 'return out')],
  [LIB, 'stored id check dropped', s => s.replace("if (typeof id === 'string' && state.storedMessageIds.has(id)) return true\n", '')],
  [LIB, 'stored message held', s => s.replace("if (typeof id === 'string' && state.storedMessageIds.has(id)) return true", "if (typeof id === 'string' && state.storedMessageIds.has(id)) { state.held.push({ message }); return true }")],
  [LIB, 'message never held', s => s.replace('  state.held.push(userText ? { message, userText } : { message })\n', '')],
  [LIB, 'user text dropped', s => s.replace('userText ? { message, userText } : { message }', '{ message }')],
  [LIB, 'hold limit off by one', s => s.replace('state.held.length > OPEN_QUIET_HELD_LIMIT', 'state.held.length > OPEN_QUIET_HELD_LIMIT + 1')],
  [LIB, 'hold keeps the oldest', s => s.replace('state.held.splice(0, state.held.length - OPEN_QUIET_HELD_LIMIT)', 'state.held.splice(OPEN_QUIET_HELD_LIMIT)')],
  [LIB, 'limit changed', s => s.replace('OPEN_QUIET_HELD_LIMIT = 200', 'OPEN_QUIET_HELD_LIMIT = 100')],
  [LIB, 'release keeps quiet', s => s.replace('  state.quiet = false\n', '')],
  [LIB, 'release keeps held', s => s.replace("  state.held = []\n  return held", '  return held')],
  [LIB, 'quiet for any session', s => s.replace('state.sessionId === sessionId', 'true')],
  [LIB, 'quiet without a session id', s => s.replace("typeof sessionId === 'string' && sessionId !== '' && ", '')],
  [LIB, 'begin not quiet', s => s.replace('{ sessionId, quiet: true,', '{ sessionId, quiet: false,')],
  [LIB, 'null stored values kept', s => s.replace('if (row[key] !== undefined && row[key] !== null) stored[key] = row[key]', 'if (row[key] !== undefined) stored[key] = row[key]')],
  [LIB, 'non-string ids kept', s => s.replace("typeof message.id === 'string'", 'message')],
  [LIB, 'flag loosened', s => s.replace("=== 'true'", '!== undefined')],
  [LIB, 'flag read from the wrong name', s => s.replace('process.env.NEXT_PUBLIC_STUDIO_SESSION_OPEN_READ_ONLY', 'process.env.NEXT_PUBLIC_STUDIO_SESSION_READ_ONLY')],
  [HOOK, 'passive metadata ignored', s => s.replace('      if (options?.passive) {\n        const trimmed', '      if (false) {\n        const trimmed')],
  [HOOK, 'passive message ignored', s => s.replace('      if (options?.passive) {\n        if (openQuietHoldMessage', '      if (false) {\n        if (openQuietHoldMessage')],
  [HOOK, 'passive write releases', s => s.replace("        if (!trimmed) {\n          debugLog('[OPEN-READ-ONLY] passive metadata write skipped - nothing new for the opened session:', currentSessionId);\n          return;\n        }", "        releaseOpenQuiet(openQuietRef.current);\n        if (!trimmed) return;")],
  [HOOK, 'user message does not release', s => s.replace('        enqueueHeld(releaseOpenQuiet(openQuietRef.current), ownerUserId, currentSessionId);\n', '')],
  [HOOK, 'held sent after the user message', s => s.replace("        enqueueHeld(releaseOpenQuiet(openQuietRef.current), ownerUserId, currentSessionId);\n      }\n    }\n", "      }\n    }\n")],
  [HOOK, 'user write does not release', s => s.replace('        const held = releaseOpenQuiet(openQuietRef.current);\n        const ownerUserId = userIdRef.current;\n        if (held.length > 0 && ownerUserId) {\n          enqueueHeld(held, ownerUserId, currentSessionId);\n          void flushMessages();\n        }', '')],
  [HOOK, 'release does not flush', s => s.replace('          enqueueHeld(held, ownerUserId, currentSessionId);\n          void flushMessages();', '          enqueueHeld(held, ownerUserId, currentSessionId);')],
  [HOOK, 'held user text dropped', s => s.replace('        userText: userText || undefined,\n      });\n    }\n  }, []);', '        userText: undefined,\n      });\n    }\n  }, []);')],
  [HOOK, 'trimmed update not used', s => s.replace('effective = trimmed as SessionMetadataUpdates;', '')],
  [HOOK, 'lastMessageAt from the original', s => s.replace('lastMessageAt: effective.lastMessageAt instanceof Date\n          ? effective.lastMessageAt.toISOString()\n          : effective.lastMessageAt,', 'lastMessageAt: updates.lastMessageAt instanceof Date\n          ? updates.lastMessageAt.toISOString()\n          : updates.lastMessageAt,')],
  [HOOK, 'gate without the flag (metadata)', s => s.replace('if (STUDIO_SESSION_OPEN_READ_ONLY_ENABLED && openQuietRef.current && isOpenQuiet(openQuietRef.current, currentSessionId)) {\n      if (options?.passive) {\n        const trimmed', 'if (openQuietRef.current && isOpenQuiet(openQuietRef.current, currentSessionId)) {\n      if (options?.passive) {\n        const trimmed')],
  [HOOK, 'gate without the flag (messages)', s => s.replace('if (STUDIO_SESSION_OPEN_READ_ONLY_ENABLED && openQuietRef.current && isOpenQuiet(openQuietRef.current, currentSessionId)) {\n      if (options?.passive) {\n        if (openQuietHoldMessage', 'if (openQuietRef.current && isOpenQuiet(openQuietRef.current, currentSessionId)) {\n      if (options?.passive) {\n        if (openQuietHoldMessage')],
  [HOOK, 'begin without the flag', s => s.replace('if (!STUDIO_SESSION_OPEN_READ_ONLY_ENABLED || !forSessionId) return;', 'if (!forSessionId) return;')],
  [HOOK, 'begin ignores the session id', s => s.replace('beginOpenQuiet(forSessionId, row)', "beginOpenQuiet('S1', row)")],
  [HOOK, 'begin dropped from the return', s => s.replace('    beginOpenQuiet: beginOpenQuietFor,\n', '')],
  [BUILDER, 'begin dropped', s => s.replace('            if (STUDIO_SESSION_OPEN_READ_ONLY_ENABLED) persistence?.beginOpenQuiet?.(session.id, session)\n', '')],
  [BUILDER, 'begin without the flag', s => s.replace('if (STUDIO_SESSION_OPEN_READ_ONLY_ENABLED) persistence?.beginOpenQuiet?.(session.id, session)', 'persistence?.beginOpenQuiet?.(session.id, session)')],
  [BUILDER, 'begin with the wrong row', s => s.replace('persistence?.beginOpenQuiet?.(session.id, session)', 'persistence?.beginOpenQuiet?.(session.id, {})')],
  [BUILDER, 'repair write kept', s => s.replace(' && !STUDIO_SESSION_OPEN_READ_ONLY_ENABLED', '')],
  [BUILDER, 'welcome message not passive', s => s.replace("persistence.queueMessage(msg, undefined, PASSIVE_WRITE)\n      }\n", 'persistence.queueMessage(msg)\n      }\n')],
  [BUILDER, 'bot message not passive', s => s.replace("persistence.queueMessage(msg, undefined, PASSIVE_WRITE)\n      } else if", 'persistence.queueMessage(msg)\n      } else if')],
  [BUILDER, 'replayed user message not passive', s => s.replace('persistence.queueMessage(msg, userText, PASSIVE_WRITE)', 'persistence.queueMessage(msg, userText)')],
  [BUILDER, 'recovered user message not passive', s => s.replace('} as DirectorMessage, text, PASSIVE_WRITE);', '} as DirectorMessage, text);')],
  [BUILDER, 'title write not passive (first)', s => s.replace('          }, PASSIVE_WRITE)\n          hasTitleFromPresentationRef', '          })\n          hasTitleFromPresentationRef')],
  [BUILDER, 'title write not passive (second)', s => s.replace('        }, PASSIVE_WRITE)\n        hasTitleFromPresentationRef', '        })\n        hasTitleFromPresentationRef')],
  [BUILDER, 'passive mark is not passive', s => s.replace('const PASSIVE_WRITE = { passive: true } as const', 'const PASSIVE_WRITE = { passive: false } as const')],
  [PAGE, 'state frame write not passive', s => s.replace("updateMetadata(updates, { passive: true }) // NEXT_PUBLIC_STUDIO_SESSION_OPEN_READ_ONLY: Director's own state frame", "updateMetadata(updates) // Director's own state frame")],
  [PAGE, 'reconcile write not passive', s => s.replace("updateMetadata(updates, { passive: true }) // NEXT_PUBLIC_STUDIO_SESSION_OPEN_READ_ONLY: the page's own count reconcile", "updateMetadata(updates) // the page's own count reconcile")],
  [PAGE, 'a user write marked passive', s => s.replace("      persistence.updateMetadata(updates)\n    }\n\n    toast({\n      title: 'Slide built',", "      persistence.updateMetadata(updates, { passive: true })\n    }\n\n    toast({\n      title: 'Slide built',")],
]
let killed = 0
const survivors = []
for (const [file, name, mutate] of mutants) {
  const mutated = mutate(SOURCES[file])
  if (mutated === SOURCES[file]) { survivors.push(`${name} (mutation did not apply)`); continue }
  let died = false
  const before = checks
  try { await checkAll({ ...SOURCES, [file]: mutated }) } catch { died = true }
  checks = before
  if (died) killed++; else survivors.push(name)
}
eq(survivors.length, 0, `surviving mutants: ${survivors.join('; ')}`)
console.log(`session open read-only: ${realChecks} checks, ${killed}/${mutants.length} mutants killed`)
