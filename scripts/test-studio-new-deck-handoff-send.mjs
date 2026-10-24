// FRONTEND-2: Director's new-deck handoff sends its brief on the NEW session's socket (flag NEXT_PUBLIC_STUDIO_NEW_DECK_HANDOFF_SEND, exact
// "true", default off, build-time). The defect (23 Oct, Studio dev with NEXT_PUBLIC_CHAT_DIRECTIVES on): after Director's recorded
// session_directive {"directive":"new_session","prefill_prompt":"Build a deck about Hiring plan 2027","auto_send":true}, the new session showed
// the brief as a sent "You" bubble and "Connected", and no user_message ever reached Director: the page called sendMessageWhenConnected right
// after handleNewChat, while the OLD session was still the Director hook's origin, so that send gave up once the new session was adopted.
//
//   node scripts/test-studio-new-deck-handoff-send.mjs              # everything, offline, plain node (transpile + vm; no network, no build)
//   node scripts/test-studio-new-deck-handoff-send.mjs --no-mutants
//   node scripts/test-studio-new-deck-handoff-send.mjs --explain       # each mutant runs every check and lists the ones that catch it
//
// What it proves:
//  1. the page's REAL handler code (onSessionDirective, handleNewChatWrapped and this change's hook call, cut out of app/builder/page.tsx by
//     AST; handleNewChat, the session's connection-request effect and its currentSessionIdRef sync, cut out of hooks/use-builder-session.ts),
//     with the REAL Director hook and this change's REAL hook, driven with DIRECTOR-2's RECORDED frames (c-redirect-mdc1.json, verbatim):
//       flag on: exactly one user_message with the brief, the usual client_caps and the deck identity (byte for byte what the normal send
//       path builds), on the NEW session's socket, after it opens; nothing on the old socket; no second copy on a later reconnect or a manual
//       connect, nor when the new socket opens, closes and opens again before or after the send; when the new socket never opens within the
//       send window (12 s), nothing is sent, the bubble goes, the brief is back in the input box with the typed turn's notice, and nothing is
//       retried when the socket opens later;
//       flag off (unset and four other spellings): the same bytes, state and calls as the base page (BASE_COMMIT), the old behaviour;
//       auto_send false (a DERIVED frame: the recorded one with auto_send flipped): the brief goes into the input box, nothing is sent and no
//       bubble is added, flag on or off, the same as the base page;
//  2. this change's hook alone (stub props): the flag, a refused hand-over, a send that resolves false or throws, leaving the session, the
//     timeout, a second hand-over, unmount;
//  3. the strip module gives back BASE_COMMIT's files byte for byte, the three shared strip roots chain it, and the page / .env.example pieces;
//  4. a strict secret scan of every line this change adds;
//  5. mutants, each caught.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import React from 'react'
import { Root } from './studio-chat-harness/mini-react.mjs'
import { createEnvironment } from './studio-chat-harness/fake-env.mjs'
import { createModuleLoader } from './studio-chat-harness/module-loader.mjs'
import { BASE_ENV } from './studio-chat-harness/profiles.mjs'
import * as extract from './studio-chat-harness/page-extract.mjs'
import { stripNewDeckHandoffSend, BASE_COMMIT, NEW_DECK_HANDOFF_SEND_FILES, NEW_DECK_HANDOFF_SEND_NEW_FILES, NEW_DECK_HANDOFF_SEND_CHANGES } from './studio-new-deck-handoff-send-strip.mjs'
import { stripOpenReadOnly } from './studio-open-read-only-strip.mjs'
import { stripDarkPersist } from './studio-theme-dark-persist-strip.mjs'
import { stripAddSlideStatus } from './studio-add-slide-status-strip.mjs'
import { STACKED_PASS3_FILES } from './studio-library-manage-harness.mjs'
import { stripComposeEntitlement } from './studio-compose-entitlement-strip.mjs' // stacked after #475: Add Slide compose signs its user puts its .env.example block between this one and # PASS2 ADMIN

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const readWithoutComposeEntitlement = rel => stripComposeEntitlement(rel, read(rel)) // stacked after #475: Add Slide compose signs its user (STUDIO_COMPOSE_ENTITLEMENT_ENABLED) adds lines to .env.example and the compose route only; this reads a file without them
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value))
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
const baseFile = rel => git('show', `${BASE_COMMIT}:${rel}`)

const FLAG = 'NEXT_PUBLIC_STUDIO_NEW_DECK_HANDOFF_SEND'
const PAGE = 'app/builder/page.tsx'
const HOOK = 'hooks/use-studio-new-deck-handoff-send.ts'
const WS = 'hooks/use-deckster-websocket-v2.ts'
const SESSION_HOOK = 'hooks/use-builder-session.ts'
const ENV = '.env.example'
const FIXTURE = 'scripts/fixtures/studio-new-deck-handoff-send/c-redirect-mdc1.json'
// sha256 of DIRECTOR-2's recorded file (deckster-workspace streams/director2/preview-b/frames/c-redirect-mdc1.json), copied verbatim.
const RECORDED_SHA256 = 'f6b582d9a57679742d81caa0042f9fd1c38d40f296095884f174f121db9cd6f4'
const recordedText = read(FIXTURE)
const REC = JSON.parse(recordedText)
const OUT = REC.frames.filter(f => f.direction === 'out').map(f => f.frame) // Director to Studio, in order: turn 0's card, turn 1's reply + directive
const DIRECTIVE = OUT.find(f => f.type === 'session_directive')
const BRIEF = DIRECTIVE.payload.prefill_prompt
const OLD = REC.session_at_start.id // the built session the recording starts in (s_e2e): the old socket's session
// DERIVED (not recorded): the recorded directive with auto_send flipped to false.
const DERIVED_NO_AUTO_SEND = { ...plain(DIRECTIVE), payload: { ...plain(DIRECTIVE.payload), auto_send: false } }
const IDENTITY = { presenter: 'Synthetic Presenter', company: 'Synthetic Co', source: 'form' } // what deckIdentityRef holds (synthetic)
const SEND_WINDOW_MS = 12000
const NOT_SENT_TOAST = { title: "Couldn't reach the Director", description: 'Your message was not sent — the connection dropped and could not be reopened. It is still in the box; try again.', variant: 'destructive' }

let checks = 0
const quiet = { on: false, collect: null } // --explain: a mutant runs every check and lists the ones it fails
const failures = []
async function check(label, fn) {
  if (quiet.on && quiet.collect) { try { await fn() } catch { quiet.collect.push(label) } return }
  if (quiet.on) { await fn(); checks++; return }
  try { await fn(); checks++; console.log(`PASS ${label}`) } catch (error) { failures.push(label); console.error(`FAIL ${label}: ${error?.stack?.split('\n').slice(0, 4).join(' | ') ?? error}`) }
}

/** Read the files of `texts` as given while `fn` loads modules (the harness loader reads from disk): runs a mutant. */
function withFileTexts(texts, fn) {
  const targets = new Map(Object.entries(texts).filter(([, text]) => typeof text === 'string').map(([rel, text]) => [path.join(root, rel), text]))
  const original = fs.readFileSync
  fs.readFileSync = function (file, ...rest) { const hit = targets.get(path.resolve(String(file))); return hit !== undefined ? hit : original.call(this, file, ...rest) }
  try { return fn() } finally { fs.readFileSync = original }
}

// ---- the page's and the session hook's own code, by AST ----------------------------------------------------------------------------
const piecesCache = new Map()
function pieces(pageText, sessionText) {
  const key = sha(pageText) + sha(sessionText)
  if (piecesCache.has(key)) return piecesCache.get(key)
  const page = ts.createSourceFile(PAGE, pageText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const session = ts.createSourceFile(SESSION_HOOK, sessionText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const option = name => extract.compile(extract.hookOptionProperty(page, 'useDecksterWebSocketV2', name), page, `page.hookOption.${name}`)
  const directive = extract.hookOptionProperty(page, 'useDecksterWebSocketV2', 'onSessionDirective')
  const wrapped = extract.useCallbackFunction(page, 'handleNewChatWrapped')
  const handoffCalls = extract.findCalls(page, 'useStudioNewDeckHandoffSend')
  const effects = extract.findCalls(session, 'useEffect')
  const connection = effects.find(call => call.arguments[0].getText(session).includes('shouldRequestBuilderSessionConnection('))
  const refSync = effects.find(call => /^\(\) => \{\s*currentSessionIdRef\.current = currentSessionId\b/.test(call.arguments[0].getText(session)))
  assert.ok(connection && refSync, "the session hook's connection-request effect and its currentSessionIdRef sync")
  assert.ok(handoffCalls.length <= 1, 'one hook call at most')
  const out = {
    directiveText: directive.getText(page),
    directive: extract.compile(directive, page, 'page.onSessionDirective'),
    wrapped: extract.compile(wrapped, page, 'page.handleNewChatWrapped'),
    wrappedSetters: [...new Set(wrapped.getText(page).match(/\bset[A-Z]\w*/g))],
    handoffCallText: handoffCalls[0]?.getText(page) ?? null,
    handoffArgs: handoffCalls[0] ? extract.compile(handoffCalls[0].arguments[0], page, 'page.useStudioNewDeckHandoffSend(...)') : null,
    newChat: extract.compile(extract.useCallbackFunction(session, 'handleNewChat'), session, 'session.handleNewChat'),
    connectionEffect: extract.compile(connection.arguments[0], session, 'session.connectionEffect'),
    connectionDeps: extract.compile(connection.arguments[1], session, 'session.connectionEffect deps'),
    refSyncEffect: extract.compile(refSync.arguments[0], session, 'session.currentSessionIdRef sync'),
    refSyncDeps: extract.compile(refSync.arguments[1], session, 'session.currentSessionIdRef sync deps'),
    options: Object.fromEntries(['existingSessionId', 'reconnectOnError', 'maxReconnectAttempts', 'reconnectDelay'].map(name => [name, option(name)])),
  }
  piecesCache.set(key, out)
  return out
}

/**
 * The Builder as far as this flow goes: the page's state (currentSessionId, isUnsavedSession, the bubbles, the input box), the REAL Director
 * hook with the page's own options, the session hook's REAL handleNewChat / connection-request effect / ref sync, the page's REAL
 * handleNewChatWrapped and onSessionDirective (rebuilt every render, as the page's closures are), and this change's REAL hook through the
 * page's own call. Hook order is the page's: the Director hook, then the session hook's effects, then this change's hook.
 */
async function mountPage({ flag, pageText = read(PAGE), files = {} }) {
  const env = createEnvironment({ processEnv: { ...BASE_ENV, NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_CHAT_DIRECTIVES: 'true', ...(flag === undefined ? {} : { [FLAG]: flag }) } })
  const user = { id: 'synthetic-user', email: 'synthetic-user@example.invalid' }
  const loader = createModuleLoader({ root, globals: env.globals, stubs: { react: React }, fileStubs: { 'hooks/use-auth': { useAuth: () => ({ user, isLoading: false }) } } })
  const modules = withFileTexts(files, () => ({
    ws: loader.load(WS), handoff: loader.load(HOOK), policy: loader.load('lib/director-reconnect-policy.ts'), lastSession: loader.load('lib/last-builder-session.ts'),
  }))
  const parts = pieces(pageText, files[SESSION_HOOK] ?? read(SESSION_HOOK))
  const log = { toasts: [], pushes: [], directives: [] }
  const probe = { state: null }
  const noop = () => {}
  function Page() {
    const [currentSessionId, setCurrentSessionId] = React.useState(OLD)
    const [isUnsavedSession, setIsUnsavedSession] = React.useState(false)
    const [isResumedSession, setIsResumedSession] = React.useState(true)
    const [userMessages, setUserMessages] = React.useState([])
    const [inputMessage, setInputMessage] = React.useState('')
    const refs = React.useRef(null)
    if (!refs.current) {
      refs.current = Object.fromEntries(['handleNewChatWrappedRef', 'transcriptLoadRequestRef', 'lastLoadedSessionRef', 'justCreatedSessionRef', 'hasTitleFromUserMessageRef',
        'hasTitleFromPresentationRef', 'hasSeenWelcomeRef', 'connectionRequestedSessionRef', 'skipBuilderOptionsPersistRef'].map(name => [name, { current: null }]))
      Object.assign(refs.current, {
        deckIdentityRef: { current: IDENTITY }, currentSessionIdRef: { current: OLD }, standardThemeLoadedRef: { current: false },
        userMessageIdsRef: { current: new Set() }, persistedMessageIdsRef: { current: new Set() }, userMessageContentMapRef: { current: new Map() }, answeredActionsRef: { current: new Set() },
      })
    }
    const r = refs.current
    const directiveScope = {} // filled below, in this render: the handler reads it when a frame arrives (the page's closure)
    const api = modules.ws.useDecksterWebSocketV2({
      autoConnect: false, // the page's features.immediateConnection && !currentSessionId: a session id is always set here
      ...Object.fromEntries(Object.entries(parts.options).map(([name, value]) => [name, value({ currentSessionId })])),
      onSessionDirective: payload => { log.directives.push(plain(payload)); return parts.directive(directiveScope)(payload) },
    })
    const session = { setUserMessages, currentSessionIdRef: r.currentSessionIdRef }
    session.handleNewChat = parts.newChat({
      ...r, crypto: env.crypto, debugLog: noop, recordStudioFreshAssignment: noop, disconnect: api.disconnect, setUserMessages, clearMessages: api.clearMessages,
      setIsUnsavedSession, setIsResumedSession, setCurrentSessionId, setSessionStoreName: noop, builderCacheOwner: user.id, sessionStorage: env.sessionStorage,
      unsavedBuilderSessionKey: modules.lastSession.unsavedBuilderSessionKey, router: { push: url => { log.pushes.push(url) } },
    })
    const connectionScope = {
      currentSessionId, isUnsavedSession, isResumedSession, connected: api.connected, connecting: api.connecting, reconnectStatus: api.reconnectStatus,
      connectionRequestedSessionRef: r.connectionRequestedSessionRef, shouldRequestBuilderSessionConnection: modules.policy.shouldRequestBuilderSessionConnection,
      isLoadingSession: false, isAuthLoading: false, user, debugLog: noop, ensureConnected: api.ensureConnected,
    }
    React.useEffect(parts.refSyncEffect({ ...r, currentSessionId }), parts.refSyncDeps({ currentSessionId }))
    React.useEffect(parts.connectionEffect(connectionScope), parts.connectionDeps(connectionScope))
    const toast = notice => { log.toasts.push(plain(notice)) }
    const armNewDeckHandoffSend = parts.handoffArgs ? modules.handoff.useStudioNewDeckHandoffSend(parts.handoffArgs({
      currentSessionId, wsSessionId: api.sessionId, socketSessionId: api.socketSessionId, connected: api.connected, connectionGeneration: api.connectionGeneration,
      sendMessageWhenConnected: api.sendMessageWhenConnected, setInputMessage, session, toast,
    })) : undefined
    const setters = Object.fromEntries(parts.wrappedSetters.map(name => [name, noop]))
    r.handleNewChatWrappedRef.current = parts.wrapped({
      ...setters, setInputMessage, session, retireStudioVoiceOwner: noop, builderOptionsScope: null, clearAllFiles: noop,
      skipBuilderOptionsPersistRef: r.skipBuilderOptionsPersistRef, standardThemeLoadedRef: r.standardThemeLoadedRef,
    })
    Object.assign(directiveScope, {
      handleNewChatWrappedRef: r.handleNewChatWrappedRef, session, Date: env.globals.Date, setInputMessage, sendMessageWhenConnected: api.sendMessageWhenConnected,
      deckIdentityRef: r.deckIdentityRef, currentSessionId, STUDIO_NEW_DECK_HANDOFF_SEND_ENABLED: modules.handoff.STUDIO_NEW_DECK_HANDOFF_SEND_ENABLED, armNewDeckHandoffSend,
    })
    probe.state = { currentSessionId, isUnsavedSession, userMessages, inputMessage, api }
    return null
  }
  const rootNode = new Root()
  const settle = async () => { for (let calm = 0, rounds = 0; calm < 2; rounds++) { if (rounds > 200) throw new Error('did not settle'); await env.macrotask(); calm = rootNode.flush() ? 0 : calm + 1 } }
  rootNode.setElement(React.createElement(Page))
  await settle()
  await env.clock.advance(0, settle)
  assert.equal(env.sockets.length, 1, "the session's connection request opened one socket")
  env.sockets[0].serverOpen()
  await env.clock.advance(0, settle)
  const sessionOf = id => new URL(env.handshakes.find(h => h.socket === id).url).searchParams.get('session_id')
  const advance = ms => env.clock.advance(ms, settle)
  const page = {
    env, log, settle, advance,
    get api() { return probe.state.api },
    state: () => plain({ currentSessionId: probe.state.currentSessionId, unsaved: probe.state.isUnsavedSession, userMessages: probe.state.userMessages, input: probe.state.inputMessage }),
    sessionOf,
    socketsOf: id => env.sockets.filter(s => sessionOf(s.id) === id),
    async deliver(frame, socket = env.sockets[0]) { socket.serverMessage(JSON.stringify(frame)); await advance(0) },
    async handoff(directive = DIRECTIVE) { for (const frame of OUT) await page.deliver(frame.type === 'session_directive' ? directive : frame); await advance(0) },
    /** A new socket for `id` (after `after` sockets), advancing 100 ms at a time; fails after `limit` ms. */
    async nextSocket(id, after = env.sockets.length, limit = 11000) {
      for (let waited = 0; waited <= limit; waited += 100) { const hit = env.sockets.slice(after).find(s => sessionOf(s.id) === id); if (hit) return hit; await advance(100) }
      throw new Error(`no new socket for ${id}: ${JSON.stringify(env.sockets.map(s => [s.id, sessionOf(s.id), s.readyState]))} status ${probe.state.api.reconnectStatus} ${JSON.stringify(env.consoleEvents.slice(-3))}`)
    },
    userSends: () => env.outbound.filter(item => item.data.startsWith('{"type":"user_message"')).map(item => ({ socket: item.socket, session: sessionOf(item.socket), frame: JSON.parse(item.data), data: item.data })),
    trace: () => plain({ outbound: env.outbound, handshakes: env.handshakes, closes: env.clientCloses, fetches: env.fetches, toasts: log.toasts, pushes: log.pushes, directives: log.directives,
      state: page.state(), messages: probe.state.api.messages.map(m => [m.message_id, m.type]), errors: env.consoleEvents.filter(e => e.level === 'error').length, pending: env.clock.pending() }),
    unmount() { rootNode.unmount() },
  }
  return page
}

/** The whole recorded flow, for identity: the handoff, the new socket opening, the send window passing, a drop, the reconnect. */
async function fullFlow(page, directive = DIRECTIVE) {
  const checkpoints = []
  await page.handoff(directive)
  checkpoints.push(page.trace())
  const newId = page.state().currentSessionId
  const first = await page.nextSocket(newId, 1)
  first.serverOpen(); await page.advance(0)
  checkpoints.push(page.trace())
  await page.advance(SEND_WINDOW_MS + 1000)
  checkpoints.push(page.trace())
  const count = page.env.sockets.length
  first.serverClose(1006); await page.advance(0)
  const second = await page.nextSocket(newId, count)
  second.serverOpen(); await page.advance(2000)
  checkpoints.push(page.trace())
  return checkpoints
}

async function pageChecks({ pageText = read(PAGE), files = {} } = {}) {
  const mount = flag => mountPage({ flag, pageText, files })

  await check('page (flag on): the recorded handoff sends exactly one user_message, the brief with the usual client_caps and the deck identity, on the NEW session\'s socket, after it opens', async () => {
    const page = await mount('true')
    await page.handoff()
    const newId = page.state().currentSessionId
    assert.notEqual(newId, OLD, 'handleNewChat made a new session')
    assert.ok(page.log.pushes.includes(`/builder?session_id=${newId}`), 'and pushed its route')
    assert.equal(page.env.clientCloses.filter(c => c.socket === 0).length, 1, 'the old socket was closed by handleNewChat')
    assert.deepEqual(page.userSends(), [], 'nothing is sent before the new socket opens')
    const bubbles = page.state().userMessages
    assert.equal(bubbles.length, 1); assert.equal(bubbles[0].text, BRIEF); assert.match(bubbles[0].id, /^user-nd-\d+$/)
    assert.equal(page.state().input, '', 'the box is empty: the brief is the bubble')
    const socket = await page.nextSocket(newId, 1)
    assert.equal(socket.readyState, 0, 'the new session\'s socket is still connecting')
    await page.advance(1000)
    assert.deepEqual(page.userSends(), [], 'still nothing while it connects')
    socket.serverOpen(); await page.advance(0)
    const sends = page.userSends()
    assert.equal(sends.length, 1, 'exactly one user_message')
    assert.equal(sends[0].socket, socket.id, 'on the new socket'); assert.equal(sends[0].session, newId)
    assert.equal(sends[0].frame.data.text, BRIEF)
    assert.deepEqual(sends[0].frame.data.client_caps, REC.client_caps, 'the usual client_caps (["mdc1"], as in the recording)')
    assert.deepEqual(sends[0].frame.data.deck_identity, IDENTITY, 'the deck identity the page passes')
    assert.equal(page.env.outbound.filter(o => o.socket === 0 && o.data.includes('Hiring plan 2027')).length, 0, 'nothing of the brief on the old socket')
    assert.deepEqual(page.state().userMessages, bubbles, 'the bubble stays (it was sent)'); assert.deepEqual(page.log.toasts, [])
    // The normal send path, byte for byte: the hook's own sendMessage builds the same frame for the same text and options.
    page.api.sendMessage(BRIEF, undefined, undefined, { deckIdentity: IDENTITY }); await page.advance(0)
    assert.equal(page.userSends()[1].data, sends[0].data, 'the same bytes as an ordinary send')
    page.unmount()
  })

  await check('page (flag on): no second send on a later reconnect, on a manual connect, or after the send window', async () => {
    const page = await mount('true')
    await page.handoff()
    const newId = page.state().currentSessionId
    const first = await page.nextSocket(newId, 1)
    first.serverOpen(); await page.advance(0)
    assert.equal(page.userSends().length, 1)
    await page.advance(5000)
    const count = page.env.sockets.length
    first.serverClose(1006); await page.advance(0)
    const second = await page.nextSocket(newId, count)
    second.serverOpen(); await page.advance(SEND_WINDOW_MS + 1000)
    const before = page.env.sockets.length
    second.serverClose(1006); page.api.connect(); await page.advance(0) // the user's own Reconnect
    const third = await page.nextSocket(newId, before)
    third.serverOpen(); await page.advance(3000)
    assert.ok(page.userSends().length === 1 && page.userSends()[0].socket === first.id, 'still exactly one, on the first new socket')
    assert.deepEqual(page.log.toasts, []); assert.equal(page.state().userMessages.length, 1); assert.equal(page.state().input, '')
    page.unmount()
  })

  await check('page (flag on): the new socket opens, closes and opens again AFTER the send: still exactly one user_message, none on the old session', async () => {
    const page = await mount('true')
    await page.handoff()
    const newId = page.state().currentSessionId
    const first = await page.nextSocket(newId, 1)
    first.serverOpen(); await page.advance(0)
    assert.equal(page.userSends().length, 1, 'sent as the new socket opened')
    await page.advance(200)
    const count = page.env.sockets.length
    first.serverClose(1006); await page.advance(0)
    const second = await page.nextSocket(newId, count)
    second.serverOpen(); await page.advance(3000)
    const sends = page.userSends()
    assert.equal(sends.length, 1, 'exactly one')
    assert.equal(sends[0].socket, first.id, 'the one sent on the first new socket'); assert.equal(sends[0].frame.data.text, BRIEF)
    assert.ok(sends.every(s => s.session === newId), 'never on the old session')
    assert.deepEqual(page.log.toasts, []); assert.equal(page.state().input, '')
    page.unmount()
  })

  await check('page (flag on): the new socket opens, closes and opens again BEFORE the send: exactly one user_message, on the socket that stayed open', async () => {
    const page = await mount('true')
    await page.handoff()
    const newId = page.state().currentSessionId
    const first = await page.nextSocket(newId, 1)
    const count = page.env.sockets.length
    first.serverOpen(); first.serverClose(1006) // dropped before the page rendered the open: nothing could be sent on it
    await page.advance(0)
    assert.deepEqual(page.userSends(), [], 'nothing on the socket that dropped')
    const second = await page.nextSocket(newId, count)
    second.serverOpen(); await page.advance(3000)
    const sends = page.userSends()
    assert.equal(sends.length, 1, 'exactly one'); assert.equal(sends[0].socket, second.id, 'on the socket that opened and stayed open')
    assert.ok(sends.every(s => s.session === newId), 'never on the old session')
    assert.equal(page.state().userMessages.length, 1); assert.deepEqual(page.log.toasts, [])
    page.unmount()
  })

  await check('page (flag on): the new socket never opens within the send window: nothing sent, the bubble goes, the brief is back in the box with the notice, and nothing is retried', async () => {
    const page = await mount('true')
    await page.handoff()
    const newId = page.state().currentSessionId
    await page.advance(SEND_WINDOW_MS - 1)
    assert.equal(page.state().userMessages.length, 1, 'within the window the bubble is still the brief'); assert.equal(page.state().input, '')
    await page.advance(1)
    assert.deepEqual(page.state().userMessages, [], 'no bubble claims it was sent'); assert.equal(page.state().input, BRIEF, 'the brief is back in the box')
    assert.deepEqual(page.log.toasts, [NOT_SENT_TOAST], "the typed turn's own \"didn't go through\" notice, once")
    const late = page.socketsOf(newId).at(-1)
    assert.ok(late && late.readyState === 0, 'the new session\'s socket is still connecting')
    late.serverOpen(); await page.advance(5000) // it opens after all: nothing is sent by itself
    const before = page.env.sockets.length
    late.serverClose(1006); page.api.connect(); await page.advance(0)
    const again = await page.nextSocket(newId, before)
    again.serverOpen(); await page.advance(SEND_WINDOW_MS + 1000)
    assert.deepEqual(page.userSends(), [], 'no automatic retry when the socket opens later')
    assert.equal(page.state().input, BRIEF); assert.equal(page.log.toasts.length, 1)
    page.unmount()
  })

  await check('page (flag off, five spellings): the flow is the base page\'s, byte for byte and state for state (the old path: the bubble, nothing sent)', async () => {
    const base = await mountPage({ flag: undefined, pageText: baseFile(PAGE), files: { ...files, [PAGE]: undefined } })
    const want = await fullFlow(base); base.unmount()
    assert.equal(want.at(-1).outbound.filter(o => o.data.startsWith('{"type":"user_message"')).length, 0, 'the base sends nothing (the defect, as recorded)')
    assert.equal(want.at(-1).state.userMessages.length, 1, 'and keeps the bubble')
    for (const flag of [undefined, 'false', '', 'TRUE', '1']) {
      const page = await mount(flag)
      const got = await fullFlow(page); page.unmount()
      assert.equal(sha(JSON.stringify(got)), sha(JSON.stringify(want)), `flag ${JSON.stringify(flag)}`)
    }
  })

  await check('page: auto_send false (DERIVED from the recorded frame): the brief goes into the input box, nothing is sent, no bubble; flag on and off, as the base page', async () => {
    const base = await mountPage({ flag: undefined, pageText: baseFile(PAGE), files: { ...files, [PAGE]: undefined } })
    const want = await fullFlow(base, DERIVED_NO_AUTO_SEND); base.unmount()
    for (const checkpoint of want) {
      assert.equal(checkpoint.state.input, BRIEF, 'the brief is in the box'); assert.deepEqual(checkpoint.state.userMessages, [], 'no bubble')
      assert.equal(checkpoint.outbound.filter(o => o.data.startsWith('{"type":"user_message"')).length, 0, 'nothing sent'); assert.deepEqual(checkpoint.toasts, [])
    }
    assert.notEqual(want[0].state.currentSessionId, OLD, 'a fresh session all the same')
    for (const flag of ['true', undefined]) {
      const page = await mount(flag)
      const got = await fullFlow(page, DERIVED_NO_AUTO_SEND); page.unmount()
      assert.equal(sha(JSON.stringify(got)), sha(JSON.stringify(want)), `flag ${JSON.stringify(flag)}`)
    }
  })

  await check('page: flag off is the base handler (the strip gives the base page\'s onSessionDirective, and its hook call goes)', async () => {
    const stripped = pieces(stripNewDeckHandoffSend(PAGE, pageText), read(SESSION_HOOK)), base = pieces(baseFile(PAGE), read(SESSION_HOOK))
    assert.equal(stripped.directiveText, base.directiveText)
    assert.equal(stripped.handoffCallText, null); assert.equal(base.handoffCallText, null)
  })
}

// ---- 2. this change's hook alone ---------------------------------------------------------------------------------------------------
async function mountHook(options = {}) {
  const { flag, files = {} } = { flag: 'true', ...options } // an explicit { flag: undefined } is the unset flag
  const env = createEnvironment({ processEnv: { ...BASE_ENV, ...(flag === undefined ? {} : { [FLAG]: flag }) } })
  const loader = createModuleLoader({ root, globals: env.globals, stubs: { react: React } })
  const mod = withFileTexts(files, () => loader.load(HOOK))
  const log = { sends: [], toasts: [], input: [] }
  const props = { currentSessionId: 'A', wsSessionId: 'A', socketSessionId: 'A', connected: true, connectionGeneration: 1 }
  const box = { messages: [{ id: 'bubble-a', text: 'older', timestamp: 1 }], result: () => Promise.resolve(true), arm: null, force: null }
  function Unit() {
    const [, force] = React.useState(0)
    box.force = force
    box.arm = mod.useStudioNewDeckHandoffSend({
      ...props,
      sendMessageWhenConnected: (...args) => { log.sends.push(plain(args)); return box.result() },
      setInputMessage: text => { log.input.push(text) },
      setUserMessages: update => { box.messages = update(box.messages) },
      toast: notice => { log.toasts.push(plain(notice)) },
    })
    return null
  }
  const rootNode = new Root()
  const settle = async () => { for (let calm = 0, rounds = 0; calm < 2; rounds++) { if (rounds > 200) throw new Error('did not settle'); await env.macrotask(); calm = rootNode.flush() ? 0 : calm + 1 } }
  rootNode.setElement(React.createElement(Unit))
  await settle()
  return {
    mod, env, log, box,
    async set(patch) { Object.assign(props, patch); box.force(n => n + 1); await settle() },
    async arm(handoff) { box.messages = [...box.messages, { id: handoff.bubbleId, text: handoff.text, timestamp: 2 }]; box.arm(handoff); await settle() },
    advance: ms => env.clock.advance(ms, settle),
    bubbles: () => box.messages.map(m => m.id),
    unmount() { rootNode.unmount() },
  }
}
const HANDOFF = (sessionId = 'B', bubbleId = 'user-nd-1') => ({ sessionId, text: BRIEF, bubbleId, options: { deckIdentity: IDENTITY } })
const ADOPT = id => [{ currentSessionId: id }, { wsSessionId: id, connected: false, socketSessionId: null }]
async function adopt(unit, id) { for (const patch of ADOPT(id)) await unit.set(patch) }

async function hookChecks({ files = {} } = {}) {
  const mount = options => mountHook({ ...options, files })
  await check('hook: on for the exact value "true" only', async () => {
    assert.equal((await mount()).mod.STUDIO_NEW_DECK_HANDOFF_SEND_ENABLED, true)
    for (const flag of [undefined, '', 'false', 'TRUE', 'True', '1', ' true', 'true ', 'yes']) assert.equal((await mount({ flag })).mod.STUDIO_NEW_DECK_HANDOFF_SEND_ENABLED, false, String(JSON.stringify(flag)))
    assert.equal((await mount()).mod.NEW_DECK_HANDOFF_SEND_TIMEOUT_MS, SEND_WINDOW_MS)
    assert.ok(read(WS).includes(`const SEND_RECONNECT_TIMEOUT_MS = ${SEND_WINDOW_MS};`), "the window is the Director hook's own send window")
  })
  await check('hook: sends once, only when the page, the Director hook and an open socket are on the new session; the exact arguments', async () => {
    const unit = await mount()
    await unit.arm(HANDOFF())
    await unit.set({ connectionGeneration: 2 }) // the OLD socket is still open and current: never
    await unit.set({ currentSessionId: 'B' })
    await unit.set({ wsSessionId: 'B', socketSessionId: 'A' })
    await unit.set({ connected: false, socketSessionId: null })
    await unit.set({ connected: true, socketSessionId: 'A' })
    assert.deepEqual(unit.log.sends, [], 'not until the open socket is the new session\'s')
    await unit.set({ socketSessionId: 'B', connectionGeneration: 3 })
    assert.deepEqual(unit.log.sends, [[BRIEF, null, null, { deckIdentity: IDENTITY }]], 'sendMessageWhenConnected(text, undefined, undefined, options)')
    for (const patch of [{ connected: false }, { connected: true, connectionGeneration: 4 }, { connectionGeneration: 5 }]) await unit.set(patch)
    await unit.advance(SEND_WINDOW_MS + 1)
    assert.equal(unit.log.sends.length, 1, 'once'); assert.deepEqual(unit.log.toasts, []); assert.deepEqual(unit.log.input, [])
    assert.deepEqual(unit.bubbles(), ['bubble-a', 'user-nd-1'], 'a sent brief keeps its bubble')
    unit.unmount()
  })
  for (const [label, result] of [['resolves false', () => Promise.resolve(false)], ['throws', () => Promise.reject(new Error('synthetic failure'))]]) {
    await check(`hook: a send that ${label}: the bubble goes, the brief is back in the box with the notice, never retried`, async () => {
      const unit = await mount()
      unit.box.result = result
      await unit.arm(HANDOFF())
      await adopt(unit, 'B'); await unit.set({ connected: true, socketSessionId: 'B', connectionGeneration: 2 })
      assert.equal(unit.log.sends.length, 1)
      assert.deepEqual(unit.bubbles(), ['bubble-a']); assert.deepEqual(unit.log.input, [BRIEF]); assert.deepEqual(unit.log.toasts, [NOT_SENT_TOAST])
      unit.box.result = () => Promise.resolve(true)
      for (const patch of [{ connected: false }, { connected: true, connectionGeneration: 3 }]) await unit.set(patch)
      await unit.advance(SEND_WINDOW_MS + 1)
      assert.equal(unit.log.sends.length, 1, 'no automatic retry'); assert.equal(unit.log.toasts.length, 1)
      unit.unmount()
    })
  }
  await check('hook: a hand-over for the session the page is still on (or none) is refused: nothing is sent; the brief is back in the box', async () => {
    for (const sessionId of ['A', null, '']) {
      const unit = await mount()
      await unit.arm(HANDOFF(sessionId))
      await unit.set({ connectionGeneration: 2 }); await unit.advance(SEND_WINDOW_MS + 1)
      assert.deepEqual(unit.log.sends, [], JSON.stringify(sessionId)); assert.deepEqual(unit.bubbles(), ['bubble-a'])
      assert.deepEqual(unit.log.input, [BRIEF]); assert.deepEqual(unit.log.toasts, [NOT_SENT_TOAST])
      unit.unmount()
    }
  })
  await check('hook: the send window: nothing at 11 999 ms, then the bubble goes and the brief is back with the notice; a socket that opens later sends nothing', async () => {
    const unit = await mount()
    await unit.arm(HANDOFF())
    await adopt(unit, 'B')
    await unit.advance(SEND_WINDOW_MS - 1)
    assert.deepEqual(unit.log.input, []); assert.deepEqual(unit.bubbles(), ['bubble-a', 'user-nd-1'])
    await unit.advance(1)
    assert.deepEqual(unit.log.input, [BRIEF]); assert.deepEqual(unit.bubbles(), ['bubble-a']); assert.deepEqual(unit.log.toasts, [NOT_SENT_TOAST])
    await unit.set({ connected: true, socketSessionId: 'B', connectionGeneration: 2 })
    assert.deepEqual(unit.log.sends, [], 'no automatic retry')
    unit.unmount()
  })
  await check('hook: leaving the new session before its socket opens drops the brief (nothing sent on a return, nothing put in another session\'s box)', async () => {
    const unit = await mount()
    await unit.arm(HANDOFF())
    await adopt(unit, 'B')
    await unit.set({ currentSessionId: 'C', wsSessionId: 'C' })
    await unit.set({ currentSessionId: 'B', wsSessionId: 'B' }); await unit.set({ connected: true, socketSessionId: 'B', connectionGeneration: 2 })
    await unit.advance(SEND_WINDOW_MS + 1)
    assert.deepEqual(unit.log.sends, []); assert.deepEqual(unit.log.input, []); assert.deepEqual(unit.log.toasts, [])
    unit.unmount()
  })
  await check('hook: a second hand-over replaces the first; unmount clears the timer; with the flag off nothing ever runs', async () => {
    const unit = await mount()
    await unit.arm(HANDOFF('B', 'user-nd-1'))
    await unit.advance(1000)
    await unit.arm(HANDOFF('C', 'user-nd-2'))
    await adopt(unit, 'C'); await unit.advance(SEND_WINDOW_MS - 500) // past the first hand-over's window, inside the second's
    assert.deepEqual(unit.log.input, [], "the first hand-over's window does not fire")
    await unit.set({ connected: true, socketSessionId: 'C', connectionGeneration: 2 })
    assert.deepEqual(unit.log.sends.map(s => s[0]), [BRIEF]); unit.unmount()
    const gone = await mount()
    await gone.arm(HANDOFF())
    gone.unmount()
    assert.equal(gone.env.clock.pending(), 0, 'no timer left'); await gone.advance(SEND_WINDOW_MS + 1); assert.deepEqual(gone.log.input, [])
    for (const flag of [undefined, 'false']) {
      const off = await mount({ flag })
      await off.arm(HANDOFF()); await adopt(off, 'B'); await off.set({ connected: true, socketSessionId: 'B', connectionGeneration: 2 }); await off.advance(SEND_WINDOW_MS + 1)
      assert.deepEqual([off.log.sends, off.log.input, off.log.toasts, off.env.clock.pending()], [[], [], [], 0], `flag ${String(JSON.stringify(flag))}`)
      off.unmount()
    }
  })
}

// ---- 3. the strip, the page and .env.example pieces ---------------------------------------------------------------------------------
async function staticChecks() {
  await check('strip: stripping gives back the base files byte for byte; new files are new; the three shared strip roots chain it', () => {
    assert.deepEqual([...NEW_DECK_HANDOFF_SEND_FILES].sort(), [ENV, PAGE].sort())
    for (const rel of NEW_DECK_HANDOFF_SEND_FILES) {
      assert.notEqual(read(rel), baseFile(rel), `${rel} is changed`)
      let later = false // a later PR's commit on this file after the base: then the stacked rule
      try { later = git('log', '--format=%s', `${BASE_COMMIT}..HEAD`, '--', rel).split('\n').filter(Boolean).some(s => !/new-deck handoff/i.test(s)) } catch { later = false }
      const stripped = stripNewDeckHandoffSend(rel, read(rel))
      if (!later) { assert.equal(sha(stripped), sha(baseFile(rel)), `${rel}: byte for byte`); continue }
      assert.ok(!/NEW_DECK_HANDOFF_SEND|NewDeckHandoffSend/.test(stripped), `${rel}: none of this change's text is left (stacked)`)
      let at = 0
      for (const line of baseFile(rel).split('\n')) { const i = stripped.indexOf(line, at); assert.ok(i >= 0, `${rel}: base line kept in order (stacked)`); at = i + line.length }
    }
    assert.equal(stripNewDeckHandoffSend('lib/other.ts', 'x'), 'x')
    for (const rel of NEW_DECK_HANDOFF_SEND_FILES) for (const [added, original] of NEW_DECK_HANDOFF_SEND_CHANGES[rel]) {
      assert.equal(read(rel).split(added).length, 2, `${rel}: each added piece occurs once`)
      assert.equal(original, '', `${rel}: a pure insertion, context-free`)
      assert.match(added, /NEW_DECK_HANDOFF_SEND/, `${rel}: each piece names the flag`)
    }
    for (const rel of NEW_DECK_HANDOFF_SEND_NEW_FILES) {
      assert.ok(fs.existsSync(path.join(root, rel)), rel)
      assert.throws(() => git('cat-file', '-e', `${BASE_COMMIT}:${rel}`), undefined, `${rel} is new`)
    }
    for (const strip of [stripOpenReadOnly, stripDarkPersist, stripAddSlideStatus]) assert.equal(sha(strip(PAGE, read(PAGE))), sha(strip(PAGE, baseFile(PAGE))), strip.name)
    assert.ok(STACKED_PASS3_FILES.includes(HOOK), 'the new hook is in STACKED_PASS3_FILES')
  })
  await check("fixture: DIRECTOR-2's recorded file, verbatim; the directive the test drives is the recorded one", () => {
    assert.equal(sha(recordedText), RECORDED_SHA256)
    assert.deepEqual(plain(DIRECTIVE.payload), { directive: 'new_session', reason: 'one_deck_per_session', prefill_prompt: 'Build a deck about Hiring plan 2027', auto_send: true })
    assert.deepEqual(OUT.map(f => f.type), ['chat_message', 'action_request', 'chat_message', 'session_directive'])
    assert.ok(OUT.every(f => f.session_id === OLD))
  })
  await check('page and .env.example: one import, one hook call after the session hook, one flag branch in onSessionDirective; the flag documented once, right before # PASS2 ADMIN', () => {
    const read = readWithoutComposeEntitlement // stacked after #475: the later .env.example block (STUDIO_COMPOSE_ENTITLEMENT_ENABLED) comes out first, so this block is still right before # PASS2 ADMIN
    const page = read(PAGE)
    assert.equal((page.match(/^import \{ STUDIO_NEW_DECK_HANDOFF_SEND_ENABLED, useStudioNewDeckHandoffSend \} from '@\/hooks\/use-studio-new-deck-handoff-send'$/gm) || []).length, 1)
    assert.equal((page.match(/useStudioNewDeckHandoffSend\(/g) || []).length, 1)
    assert.ok(page.indexOf('const armNewDeckHandoffSend = useStudioNewDeckHandoffSend(') > page.indexOf('const session = useBuilderSession('), 'after the session hook')
    const directive = pieces(page, read(SESSION_HOOK)).directiveText
    assert.equal((directive.match(/STUDIO_NEW_DECK_HANDOFF_SEND_ENABLED/g) || []).length, 1)
    assert.ok(directive.indexOf('armNewDeckHandoffSend(') > directive.indexOf('session.setUserMessages(') && directive.indexOf('armNewDeckHandoffSend(') < directive.indexOf('void sendMessageWhenConnected(prefill'), 'between the bubble and the old send')
    assert.ok(read(HOOK).includes("process.env.NEXT_PUBLIC_STUDIO_NEW_DECK_HANDOFF_SEND === 'true'"), 'the flag read as a literal (build-time)')
    const env = read(ENV)
    assert.equal((env.match(/^NEXT_PUBLIC_STUDIO_NEW_DECK_HANDOFF_SEND="false"$/gm) || []).length, 1)
    const at = env.indexOf('# NEW-DECK HANDOFF SEND (FRONTEND-2')
    assert.ok(at > env.indexOf('NEXT_PUBLIC_STUDIO_JOB_LEDGER="false"\n\n'), 'after the P3-4c job ledger block')
    assert.ok(env.indexOf('NEXT_PUBLIC_STUDIO_NEW_DECK_HANDOFF_SEND="false"\n\n# PASS2 ADMIN (FRONTEND-1') > 0, 'right before # PASS2 ADMIN')
  })
}

// ---- 4. a strict secret scan of every added line -------------------------------------------------------------------------------------
async function secretScan() {
  await check('secrets: no line this change adds carries anything credential-shaped', () => {
    const added = []
    for (const rel of NEW_DECK_HANDOFF_SEND_FILES) {
      const base = new Set(baseFile(rel).split('\n'))
      for (const line of read(rel).split('\n')) if (!base.has(line)) added.push([rel, line])
    }
    const touched = ['scripts/studio-open-read-only-strip.mjs', 'scripts/studio-theme-dark-persist-strip.mjs', 'scripts/studio-add-slide-status-strip.mjs', 'scripts/studio-library-manage-harness.mjs']
    for (const rel of touched) { const base = new Set(baseFile(rel).split('\n')); for (const line of read(rel).split('\n')) if (!base.has(line)) added.push([rel, line]) }
    for (const rel of NEW_DECK_HANDOFF_SEND_NEW_FILES) for (const line of read(rel).split('\n')) added.push([rel, line])
    assert.ok(added.length > 100)
    const dash = '-'.repeat(5)
    const rules = [
      ['private key', new RegExp(`${dash}BEGIN [A-Z ]*PRIVATE KEY`)], ['AWS key', /\b(AKIA|ASIA)[0-9A-Z]{16}\b/], ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{30,}/],
      ['Slack token', /\bxox[abposr]-[A-Za-z0-9-]{10,}/], ['Google API key', /\bAIza[0-9A-Za-z_-]{30,}/], ['Stripe key', /\b[rs]k_(live|test)_[A-Za-z0-9]{10,}/],
      ['OpenAI / Anthropic style key', /\bsk-[A-Za-z0-9_-]{20,}/], ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./], ['bearer', /\bBearer\s+[A-Za-z0-9._~+/-]{16,}/i],
      ['URL with a password', /[a-z]+:\/\/[^\s/:@]+:[^\s/@]+@/i],
      ['an assignment of a secret-named value', /(api[_-]?key|secret|token|passw(or)?d|credential|auth)[A-Za-z_]*["']?\s*[:=]\s*["'][^"'\s]{12,}["']/i],
      ['a long opaque literal (mixed case and digits)', /["'`](?=[A-Za-z0-9+/_=-]*[a-z])(?=[A-Za-z0-9+/_=-]*[A-Z])(?=[A-Za-z0-9+/_=-]*\d)[A-Za-z0-9+/_-]{24,}={0,2}["'`]/],
      ['a long hex literal', /["'`][0-9a-fA-F]{32,}["'`]/],
    ]
    // The only long hex literals are git object ids (this change's base commit, the recording's Director commit) and the fixture's sha256.
    const allowed = new Set([BASE_COMMIT, REC.director_commit, RECORDED_SHA256])
    for (const [rel, line] of added) for (const [name, rule] of rules) {
      const hit = line.match(rule)
      if (hit && ![...allowed].some(value => hit[0].includes(value))) assert.fail(`${rel}: ${name}: ${line.slice(0, 120)}`)
    }
  })
}

async function suite({ pageText, files } = {}, { statics = true } = {}) {
  await hookChecks({ files })
  await pageChecks({ pageText, files })
  if (statics) { await staticChecks(); await secretScan() }
}

// ---- 5. mutants: each must fail at least one check ---------------------------------------------------------------------------------
const GATE = "    if (!connected || wsSessionId !== pending.sessionId || socketSessionId !== pending.sessionId) return\n"
const CLEAR = '    pendingRef.current = null // exactly once: cleared before the send, so no later reconnect, re-open or retry can send it again\n'
const SEND = '    void live.current.sendMessageWhenConnected(pending.text, undefined, undefined, pending.options)\n      .then(sent => { if (sent !== true) fail() }, fail)\n'
const MUTANTS = [
  ['the flag spelling', HOOK, [["process.env.NEXT_PUBLIC_STUDIO_NEW_DECK_HANDOFF_SEND === 'true'", 'Boolean(process.env.NEXT_PUBLIC_STUDIO_NEW_DECK_HANDOFF_SEND)']]],
  ['old-session origin (sent at once from the hand-over)', HOOK, [['    pendingRef.current = pending\n    setArmed(count => count + 1)\n',
    '    if (pending.timer) clearTimeout(pending.timer)\n    void live.current.sendMessageWhenConnected(pending.text, undefined, undefined, pending.options).then(sent => { if (sent !== true) notSent(pending, true) })\n']]],
  ['sends twice', HOOK, [[SEND, `    void live.current.sendMessageWhenConnected(pending.text, undefined, undefined, pending.options)\n${SEND}`]]],
  ['re-send on reconnect (re-armed after a send)', HOOK, [['.then(sent => { if (sent !== true) fail() }, fail)', '.then(sent => { if (sent !== true) fail(); else pendingRef.current = pending }, fail)']]],
  ['auto-retry on failure (the window keeps the brief pending)', HOOK, [['      if (pendingRef.current !== pending) return\n      pendingRef.current = null\n', '      if (pendingRef.current !== pending) return\n']]],
  ['text not restored', HOOK, [['    setInputMessage(handoff.text)\n', '']]],
  ['caps dropped (the user_message built without client_caps)', WS, [["          ...(CHAT_DIRECTIVES && { client_caps: ['mdc1'] }),\n", '']]],
  ['pending not cleared', HOOK, [[CLEAR, '']]],
  ['flap before the send: a drop of the new socket counts as a failure', HOOK, [
    ['    const pending: PendingHandoff = { ...handoff, sessionId: handoff.sessionId, adopted: false, timer: null }\n', '    const pending: PendingHandoff = { ...handoff, sessionId: handoff.sessionId, adopted: false, timer: null, generation: live.current.connectionGeneration } as PendingHandoff\n'],
    [GATE, `    if (!connected && connectionGeneration !== (pending as unknown as { generation: number }).generation) { pendingRef.current = null; notSent(pending, true); return }\n${GATE}`]]],
  ['flap after the send: once per connection, not once', HOOK, [[CLEAR, '    if ((pending as unknown as { sentOn?: number }).sentOn === connectionGeneration) return\n    ;(pending as unknown as { sentOn?: number }).sentOn = connectionGeneration\n']]],
  ['handed over on adoption (the send waits in sendMessageWhenConnected), not once the socket is open', HOOK, [[GATE, '    if (wsSessionId !== pending.sessionId) return\n']]],
  ['the bubble left behind when not sent', HOOK, [['    setUserMessages(prev => prev.filter(message => message.id !== handoff.bubbleId))\n', '']]],
  ['the hand-over accepted for the session the page is on', HOOK, [['    if (!handoff.sessionId || handoff.sessionId === live.current.currentSessionId) {\n', '    if (!handoff.sessionId) {\n']]],
  ['a send that does not go out is not reported', HOOK, [['.then(sent => { if (sent !== true) fail() }, fail)', '.then(() => undefined, () => undefined)']]],
  ['leaving the new session keeps the brief pending', HOOK, [['      if (pending.adopted) {\n        if (pending.timer) clearTimeout(pending.timer)\n        pendingRef.current = null\n      }\n', '']]],
  ['the page hands over the old session id', PAGE, [['armNewDeckHandoffSend({ sessionId: session.currentSessionIdRef.current,', 'armNewDeckHandoffSend({ sessionId: currentSessionId,']]],
  ['the page drops the deck identity', PAGE, [['options: { ...(deckIdentityRef.current ? { deckIdentity: deckIdentityRef.current } : {}) } }); return }', 'options: {} }); return }']]],
]

// A promise rejection nobody handles is a failure of the code under test (a mutant's is reported by the checks it breaks).
const unhandled = []
process.on('unhandledRejection', error => { unhandled.push(String(error?.message ?? error).slice(0, 160)) })
await suite({})
if (unhandled.length) { failures.push('unhandled rejections'); console.error(`FAIL unhandled rejections: ${unhandled.join('; ')}`) }
console.log(`new-deck handoff send: ${checks} checks passed${failures.length ? `, ${failures.length} FAILED` : ''}`)
if (failures.length) process.exit(1)
if (!process.argv.includes('--no-mutants')) {
  const survivors = []
  const names = new Set()
  for (const [name, rel, edits] of MUTANTS) {
    assert.ok(!names.has(name), `duplicate mutant ${name}`); names.add(name)
    let text = read(rel)
    for (const [from, to] of edits) { assert.equal(text.split(from).length, 2, `mutant "${name}": its text occurs once in ${rel}`); text = text.replace(from, () => to) }
    const before = failures.length
    quiet.on = true
    quiet.collect = process.argv.includes('--explain') ? [] : null
    let caught = false
    try {
      if (rel === PAGE) await suite({ pageText: text, files: {} }, { statics: false })
      else await suite({ files: { [rel]: text } }, { statics: false })
    } catch { caught = true }
    const caughtBy = quiet.collect
    quiet.on = false; quiet.collect = null
    caught ||= failures.length > before || Boolean(caughtBy?.length)
    console.log(`${caught ? 'CAUGHT' : 'SURVIVED'} mutant: ${name}${caughtBy ? `\n    by: ${caughtBy.join('\n        ')}` : ''}`)
    if (!caught) survivors.push(name)
  }
  if (survivors.length) { console.error(`${survivors.length} mutant(s) survived: ${survivors.join('; ')}`); process.exit(1) }
  console.log(`all ${MUTANTS.length} mutants caught`)
}
