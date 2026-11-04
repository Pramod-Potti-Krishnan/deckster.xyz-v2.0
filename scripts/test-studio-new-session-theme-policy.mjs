// PASS2-J3 P0 (items 5 and 6): a NEW session's blank canvas never receives a Director sync_response, so with the composer
// library on (NEXT_PUBLIC_COMPOSER_LIBRARY_ENABLED) the composer theme policy stayed unresolved for the whole session: every
// set_theme was refused ("Waiting for the presentation theme policy from Director") and Add Element never reached Text Labs.
// NEXT_PUBLIC_STUDIO_NEW_SESSION_THEME_POLICY (default off) resolves the policy as "no adoption" on the session's first blank
// deck frame when no sync_response came first on that socket. A Composer adoption (use result, cached marker or sync) stays frozen.
//
// Runs the REAL hook (hooks/use-deckster-websocket-v2.ts) with a mocked socket, cache and identity. Offline: no socket, timer,
// database or HTTP operation leaves this process.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

const root = path.resolve(new URL('..', import.meta.url).pathname)
const FLAG = 'NEXT_PUBLIC_STUDIO_NEW_SESSION_THEME_POLICY'
const LAYOUT = 'http://localhost:8531'
const blankUrl = `${LAYOUT}/p/blank-a`
const adoptedUrl = `${LAYOUT}/p/deck-a`
const marker = { schema_version: 'composer-adoption-v1', template_id: 'template-a', presentation_id: 'deck-a', frozen_theme: true }
const plain = value => JSON.parse(JSON.stringify(value))

function harness({ composer = true, flag, cached = null, sessionId = 'session-a' } = {}) {
  let cursor = 0, frameId = 0; const slots = []; const modules = new Map(); const sockets = []
  const storage = new Map(); const persistence = []
  const cache = {
    getCachedState: () => cached, isCacheValid: () => true,
    setCachedState: state => { cached = { ...cached, ...state } },
    clearCache: () => { cached = null }, getCachedUserMessages: () => [],
    getLastSyncTime: () => null,
  }
  const react = {
    useState(initial) {
      const i = cursor++
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial
      return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next }]
    },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial } },
    useCallback: fn => fn, useMemo: fn => fn(), useEffect() {}, useLayoutEffect() {},
  }
  class Socket {
    static OPEN = 1; static CONNECTING = 0
    readyState = 0; sent = []
    constructor() { sockets.push(this) }
    send(body) { this.sent.push(body) }
    close() { this.readyState = 3; this.onclose?.({ code: 1000, reason: '', wasClean: true }) }
    open() { this.readyState = 1; this.onopen() }
  }
  const env = { NEXT_PUBLIC_COMPOSER_LIBRARY_ENABLED: String(composer), NEXT_PUBLIC_WS_URL: 'ws://localhost:8541/ws', NEXT_PUBLIC_LAYOUT_SERVICE_URL: LAYOUT }
  if (flag !== undefined) env[FLAG] = flag
  const quiet = { log() {}, warn() {}, error() {}, debug() {} }
  function load(filename) {
    if (modules.has(filename)) return modules.get(filename).exports
    const module = { exports: {} }; modules.set(filename, module)
    const text = fs.readFileSync(filename, 'utf8')
    const output = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    const require = name => {
      if (name === 'react') return react
      if (name === './use-auth') return { useAuth: () => ({ user: { id: 'owner-a', email: 'owner@example.test' } }) }
      if (name === './use-session-cache') return { useSessionCache: () => cache }
      const base = name.startsWith('@/') ? path.join(root, name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(filename), name) : null
      if (!base) throw new Error(`Unexpected dependency ${name}`)
      const candidate = [base, base + '.ts', base + '.tsx'].find(p => fs.existsSync(p) && fs.statSync(p).isFile())
      return load(candidate)
    }
    vm.runInNewContext(output, {
      module, exports: module.exports, require, process: { env }, console: quiet,
      URL, URLSearchParams, AbortController, Error, crypto: { randomUUID: () => 'unit-id' },
      WebSocket: Socket, navigator: { onLine: true },
      sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
      window: { addEventListener() {}, removeEventListener() {} },
      fetch: async () => ({ ok: true, json: async () => ({ auth_enabled: false }) }),
      setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    }, { filename })
    return module.exports
  }
  const { useDecksterWebSocketV2 } = load(path.join(root, 'hooks/use-deckster-websocket-v2.ts'))
  let hook
  function render() { cursor = 0; hook = useDecksterWebSocketV2({ existingSessionId: sessionId, autoConnect: false, onSessionStateChange: value => persistence.push(value) }); return hook }
  const deliver = frame => { sockets.at(-1).onmessage({ data: JSON.stringify({ message_id: `frame-${++frameId}`, ...frame }) }); return render() }
  // Director's new-session branch (websocket.py handle_connection, not is_reconnect): theme_sync for the initial theme,
  // then presentation_init for the blank deck (payload as create_presentation_init builds it), then the greeting.
  const initialThemeSync = (presentationId = 'blank-a', session = sessionId) => deliver({ session_id: session, type: 'theme_sync', payload: {
    request_id: `initial:${presentationId}`, status: 'applied', presentation_id: presentationId, theme: { mode: 'auto' } } })
  const presentationInit = ({ presentationId = 'blank-a', url = blankUrl, session = sessionId } = {}) => deliver({ session_id: session, type: 'presentation_init', role: 'assistant', payload: {
    operation: 'full_update', is_blank: true, slides: [{ slide_id: 'blank_slide_1', slide_number: 1, slide_type: 'title_slide' }],
    metadata: { main_title: 'Untitled Presentation', preview_url: url, preview_presentation_id: presentationId } } })
  const legacyBlank = ({ presentationId = 'blank-a', url = blankUrl, session = sessionId } = {}) => deliver({ session_id: session, type: 'slide_update', payload: {
    operation: 'full_update', is_blank: true, preview_url: url, metadata: { preview_presentation_id: presentationId }, slides: [{ slide_id: 'blank_slide_1' }] } })
  const greeting = () => deliver({ session_id: sessionId, type: 'chat_message', role: 'assistant', payload: { text: 'Hello! What would you like to build today?' } })
  const sync = (adoption = 'absent', presentationId = 'deck-a', url = adoptedUrl, session = sessionId) => deliver({ session_id: session, type: 'sync_response', payload: {
    current_state: 'COMPLETE', has_strawman: true, action: 'skip_history', message_count: 0, presentation_id: presentationId,
    ...(url === null ? {} : { presentation_url: url }), ...(adoption === 'absent' ? {} : { composer_adoption: adoption }) } })
  render()
  return {
    render, deliver, initialThemeSync, presentationInit, legacyBlank, greeting, sync, persistence, sockets,
    get cache() { return cached },
    sent: () => sockets.flatMap(socket => socket.sent),
    async connect() {
      hook.connect(); await new Promise(resolve => setImmediate(resolve))
      assert.ok(sockets.length, 'actual hook created its mocked transport'); sockets.at(-1).open(); return render()
    },
  }
}

// A brand-new session: connect, the initial theme_sync, the blank deck, the greeting. No sync_response is ever sent.
async function newBlankSession(options) {
  const h = harness(options)
  await h.connect()
  h.initialThemeSync()
  h.presentationInit()
  const hook = h.greeting()
  return { h, hook }
}
const setTheme = (requestId, presentationId = 'blank-a') => JSON.stringify({ type: 'set_theme', data: { request_id: requestId, theme: { mode: 'preset', preset_id: 'corporate-light' }, presentation_id: presentationId } })

// ---- 1. Root cause (flag off, composer on): the new session never resolves the composer theme policy -----------------
for (const flag of [undefined, 'false', 'TRUE', '1']) {
  const { h, hook } = await newBlankSession({ flag })
  assert.equal(hook.presentationId, 'blank-a', 'the blank deck is the displayed presentation')
  assert.equal(hook.isBlankPresentation, true)
  assert.equal(hook.composerThemeResolved, false, `ROOT CAUSE (flag ${flag}): no sync_response on a new session leaves the policy unresolved`)
  assert.equal(hook.composerAdoption, null)
  assert.equal(hook.sendThemeSelection({ mode: 'preset', preset_id: 'corporate-light' }, 'pick-1', 'blank-a'), false,
    `ROOT CAUSE (flag ${flag}): every theme sync is refused for the whole session`)
  assert.deepEqual(h.sent(), [], 'nothing reaches Director')
}

// ---- 2. Fix (flag on): the first blank deck frame of a new session resolves the policy as "no adoption" ----------------
{
  const h = harness({ flag: 'true' })
  let hook = await h.connect()
  assert.equal(hook.sendThemeSelection({ mode: 'auto' }, 'before-deck', 'blank-a'), false, 'onopen still must not race the policy')
  hook = h.initialThemeSync()
  assert.equal(hook.composerThemeResolved, false, 'theme_sync alone is not the deck frame')
  hook = h.presentationInit()
  assert.equal(hook.composerThemeResolved, true, 'FIX: the new session resolves on its first blank deck frame')
  assert.equal(hook.composerAdoption, null, 'resolved as no adoption')
  hook = h.greeting()
  assert.equal(hook.sendThemeSelection({ mode: 'preset', preset_id: 'corporate-light' }, 'pick-1', 'blank-a'), true, 'FIX: a theme pick reaches Director')
  assert.deepEqual(h.sent(), [setTheme('pick-1')], 'set_theme wire bytes are the existing ones')
  assert.equal('composerThemeResolved' in (h.cache || {}), false, 'the resolution is never persisted in the session cache')
  assert.equal(h.cache?.composerAdoption ?? null, null)
}

// The transport guard resolves with the frame itself (as sync_response does), not one React render later.
{
  const h = harness({ flag: 'true' })
  const hook = await h.connect()
  h.sockets.at(-1).onmessage({ data: JSON.stringify({ message_id: 'no-render-init', session_id: 'session-a', type: 'presentation_init', payload: {
    operation: 'full_update', is_blank: true, slides: [], metadata: { preview_url: blankUrl, preview_presentation_id: 'blank-a' } } }) })
  assert.equal(hook.sendThemeSelection({ mode: 'auto' }, 'same-tick', 'blank-a'), true, 'no render between the deck frame and a theme send')
}

// Legacy blank slide_update (is_blank) is the same deck frame.
{
  const h = harness({ flag: 'true' })
  await h.connect()
  const hook = h.legacyBlank()
  assert.equal(hook.composerThemeResolved, true)
  assert.equal(hook.composerAdoption, null)
  assert.equal(hook.sendThemeSelection({ mode: 'auto' }, 'legacy-blank', 'blank-a'), true)
}

// ---- 3. Adopted sessions stay frozen (flag on) ---------------------------------------------------------------------------
// 3a. "Use original": the use result lands first (applyTemplateIngestReady), then the socket and a blank frame: frozen.
{
  const h = harness({ flag: 'true' })
  let hook = h.render()
  const ready = { session_id: 'session-a', template_id: 'template-a', presentation_id: 'deck-a', viewer_url: adoptedUrl, composer_adoption: marker }
  assert.equal(hook.applyTemplateIngestReady(ready, 'session-a'), true)
  hook = await h.connect()
  hook = h.presentationInit()
  assert.deepEqual(plain(hook.composerAdoption), marker, 'a blank frame never clears an adoption')
  assert.equal(hook.presentationId, 'deck-a', 'the adopted deck stays displayed')
  assert.equal(hook.sendThemeSelection({ mode: 'auto' }, 'adopted-1', 'deck-a'), false, 'adopted deck stays frozen')
  hook = h.sync(marker)
  assert.equal(hook.sendThemeSelection({ mode: 'auto' }, 'adopted-2', 'deck-a'), false, 'adopted deck stays frozen after sync')
  assert.deepEqual(h.sent(), [])
}
// 3b. Blank frame first, then the use result: the adoption still freezes its deck.
{
  const { h } = await newBlankSession({ flag: 'true' })
  let hook = h.render()
  const ready = { session_id: 'session-a', template_id: 'template-a', presentation_id: 'deck-a', viewer_url: adoptedUrl, composer_adoption: marker }
  assert.equal(hook.applyTemplateIngestReady(ready, 'session-a'), true)
  hook = h.render()
  assert.deepEqual(plain(hook.composerAdoption), marker)
  assert.equal(hook.presentationId, 'deck-a')
  assert.equal(hook.sendThemeSelection({ mode: 'auto' }, 'adopted-after-blank', 'deck-a'), false, 'use result after the blank deck freezes the adopted deck')
  assert.deepEqual(h.sent(), [])
}
// 3c. Reload of an adopted session (cached marker): a blank frame must not unlock it; only Director's sync resolves it.
{
  const seed = harness({ flag: 'true' })
  await seed.connect(); seed.sync(marker)
  const reload = harness({ flag: 'true', cached: seed.cache })
  let hook = await reload.connect()
  hook = reload.presentationInit()
  assert.equal(hook.composerThemeResolved, false, 'a cached adoption waits for sync_response')
  assert.equal(hook.sendThemeSelection({ mode: 'auto' }, 'cached-adoption', 'deck-a'), false)
  hook = reload.sync(marker)
  assert.equal(hook.sendThemeSelection({ mode: 'auto' }, 'cached-adoption-synced', 'deck-a'), false)
  assert.deepEqual(reload.sent(), [])
}
// 3d. An existing session (sync_response first) is Director's to resolve: a later blank frame cannot override a refusal.
// (Director's reconnect branch can still create a blank deck at the first message when the connect-time one failed.)
{
  const h = harness({ flag: 'true' })
  await h.connect()
  let hook = h.sync({ ...marker, presentation_id: 'foreign-deck' }, 'foreign-deck', null)
  assert.equal(hook.composerThemeResolved, false, 'malformed provenance stays unresolved')
  assert.equal(hook.presentationUrl, null, 'no deck is held, so the next blank frame becomes the displayed deck')
  hook = h.presentationInit()
  assert.equal(hook.presentationId, 'blank-a')
  assert.equal(hook.composerThemeResolved, false, 'sync_response came first on this socket: the blank frame does not resolve')
  assert.equal(hook.sendThemeSelection({ mode: 'auto' }, 'after-sync', 'blank-a'), false)
  assert.deepEqual(h.sent(), [])
}
// 3e. A cached adoption whose deck URL is not held (so the blank frame does become the displayed deck) still waits for sync.
{
  const cached = { messages: [], userMessages: [], composerAdoption: marker, finalPresentationId: 'deck-a' }
  const h = harness({ flag: 'true', cached })
  let hook = await h.connect()
  assert.deepEqual(plain(hook.composerAdoption), marker, 'the cached adoption is read back')
  hook = h.presentationInit()
  assert.equal(hook.presentationId, 'blank-a', 'the blank deck is displayed')
  assert.equal(hook.composerThemeResolved, false, 'a known adoption is never resolved by a blank frame')
  assert.equal(hook.sendThemeSelection({ mode: 'auto' }, 'cached-marker-blank', 'blank-a'), false)
  assert.deepEqual(h.sent(), [])
}

// ---- 4. Ownership: foreign, blocked or held-deck frames never unlock ------------------------------------------------------
{
  const h = harness({ flag: 'true' })
  await h.connect()
  let hook = h.presentationInit({ session: 'session-b' })
  assert.equal(hook.composerThemeResolved, false, 'a frame for another session does not resolve this one')
  hook = h.presentationInit({ url: 'https://evil.invalid/p/blank-a' })
  assert.equal(hook.composerThemeResolved, false, 'a blocked viewer URL never resolves the policy')
  assert.equal(hook.sendThemeSelection({ mode: 'auto' }, 'foreign', 'blank-a'), false)
}
{
  // A deck this session already holds (restored record) is not a new session's blank canvas.
  const held = { messages: [{ message_id: 'm1', type: 'chat_message', payload: { text: 'hi' } }], userMessages: [],
    finalPresentationUrl: adoptedUrl, finalPresentationId: 'deck-a', presentationUrl: adoptedUrl, presentationId: 'deck-a', activeVersion: 'final' }
  const h = harness({ flag: 'true', cached: held })
  await h.connect()
  const hook = h.presentationInit()
  assert.equal(hook.presentationId, 'deck-a', 'the held deck stays displayed')
  assert.equal(hook.composerThemeResolved, false, 'a blank frame that does not become the displayed deck does not resolve')
}

// ---- 5. Every new socket starts unresolved again (reconnect waits for sync_response, as today) ------------------------
{
  const { h } = await newBlankSession({ flag: 'true' })
  let hook = h.render()
  hook.disconnect(); hook = h.render()
  hook = await h.connect()
  assert.equal(hook.composerThemeResolved, false, 'reconnect resets the policy')
  assert.equal(hook.sendThemeSelection({ mode: 'auto' }, 'reconnect-before-sync', 'blank-a'), false)
  hook = h.sync('absent', 'blank-a', blankUrl)
  assert.equal(hook.sendThemeSelection({ mode: 'auto' }, 'reconnect-after-sync', 'blank-a'), true, 'Director sync resolves the reconnected session')
}

// ---- 6. Composer library off: the new flag changes nothing ------------------------------------------------------------
for (const flag of [undefined, 'true']) {
  const { h, hook } = await newBlankSession({ composer: false, flag })
  assert.equal(hook.composerThemeResolved, false)
  assert.equal(hook.sendThemeSelection({ mode: 'auto' }, 'library-off', 'blank-a'), true, 'library off: set_theme was never gated')
  assert.equal(h.sent().length, 1)
}

// ---- 7. Flag-off identity: the same frames give identical hook state, cache and wire bytes with the flag off or absent -----
{
  const run = async flag => {
    const { h } = await newBlankSession({ flag })
    const hook = h.render()
    hook.sendThemeSelection({ mode: 'auto' }, 'identity', 'blank-a')
    const state = Object.fromEntries(Object.entries(hook).filter(([, value]) => typeof value !== 'function'))
    delete state.studioVoiceTranscriptReceipt
    return JSON.stringify({ state, cache: h.cache, sent: h.sent(), persistence: h.persistence }, (key, value) => key === 'clientTimestamp' ? 'wall-clock' : value)
  }
  assert.equal(await run('false'), await run(undefined), 'flag off is identical to the flag being absent')
}

console.log('New-session theme policy: root cause pinned (flag off), new blank session resolves on its first deck frame (flag on), adopted/cached/synced/foreign/blocked/held sessions stay frozen, reconnect resets, library-off and flag-off unchanged.')
