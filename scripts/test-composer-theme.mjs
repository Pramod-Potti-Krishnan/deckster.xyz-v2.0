import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

const root = path.resolve(new URL('..', import.meta.url).pathname)
const marker = { schema_version: 'composer-adoption-v1', template_id: 'template-a', presentation_id: 'deck-a', frozen_theme: true }
const url = 'http://localhost:8531/p/deck-a'
const plain = value => JSON.parse(JSON.stringify(value))

// Run the actual hook and transport admission with mocked identity/cache/socket.
// No socket, timer, database, or HTTP operation leaves this process.
function harness(enabled, cached = null) {
  let cursor = 0; const slots = []; const modules = new Map(); const sockets = []
  const storage = new Map()
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
    useCallback: fn => fn, useMemo: fn => fn(), useEffect() {},
  }
  class Socket {
    static OPEN = 1; static CONNECTING = 0
    readyState = 0; sent = []
    constructor() { sockets.push(this) }
    send(body) { this.sent.push(JSON.parse(body)) }
    close() { this.readyState = 3; this.onclose?.({ code: 1000, reason: '', wasClean: true }) }
    open() { this.readyState = 1; this.onopen() }
  }
  const env = { NEXT_PUBLIC_COMPOSER_LIBRARY_ENABLED: String(enabled), NEXT_PUBLIC_WS_URL: 'ws://localhost:8541/ws', NEXT_PUBLIC_LAYOUT_SERVICE_URL: 'http://localhost:8531' }
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
  function render() { cursor = 0; hook = useDecksterWebSocketV2({ existingSessionId: 'session-a', autoConnect: false }); return hook }
  const sync = (adoption = marker, presentationId = 'deck-a', sessionId = 'session-a') => {
    sockets.at(-1).onmessage({ data: JSON.stringify({ message_id: String(Math.random()), session_id: sessionId, type: 'sync_response', payload: {
      current_state: 'COMPLETE', has_strawman: true, action: 'skip_history', message_count: 0, presentation_id: presentationId,
      presentation_url: url, ...(adoption === 'absent' ? {} : { composer_adoption: adoption }),
    } }) }); return render()
  }
  render()
  return { render, sync, get cache() { return cached }, sockets, async connect() {
    hook.connect(); await new Promise(resolve => setImmediate(resolve))
    assert.ok(sockets.length, 'actual hook created its mocked transport'); sockets.at(-1).open(); return render()
  } }
}

const fresh = harness(true)
let hook = await fresh.connect()
assert.equal(hook.sendThemeSelection({ mode: 'auto' }, 'before-sync', 'deck-a'), false, 'onopen must not race authoritative provenance')
hook = fresh.sync()
assert.deepEqual(plain(hook.composerAdoption), marker)
assert.equal(hook.sendThemeSelection({ mode: 'auto' }, 'frozen', 'deck-a'), false)
assert.equal(fresh.sockets[0].sent.length, 0)
assert.deepEqual(plain(fresh.cache.composerAdoption), marker, 'provenance is retained in the existing owner-scoped cache')

for (const cached of [fresh.cache, null]) {
  const reload = harness(true, cached)
  hook = await reload.connect()
  assert.equal(hook.sendThemeSelection({ mode: 'auto' }, 'reloaded-before-sync', 'deck-a'), false)
  hook = reload.sync()
  assert.equal(hook.sendThemeSelection({ mode: 'auto' }, 'reloaded-after-sync', 'deck-a'), false)
  assert.equal(reload.sockets[0].sent.length, 0, 'reload with or without browser cache cannot reapply a source theme')
}

fresh.render().disconnect(); hook = fresh.render()
hook = await fresh.connect(); hook = fresh.sync()
assert.equal(hook.sendThemeSelection({ mode: 'auto' }, 'reconnect', 'deck-a'), false)

const initial = harness(true)
hook = initial.render()
const ready = { session_id: 'session-a', template_id: 'template-a', presentation_id: 'deck-a', viewer_url: url, composer_adoption: marker }
assert.equal(hook.applyTemplateIngestReady(ready, 'other-session'), false)
assert.equal(initial.render().composerAdoption, null)
assert.equal(hook.applyTemplateIngestReady(ready, 'session-a'), true)
assert.deepEqual(plain(initial.render().composerAdoption), marker)
hook = await initial.connect()
assert.equal(hook.sendThemeSelection({ mode: 'auto' }, 'adopt-open', 'deck-a'), false)

const malformed = harness(true)
await malformed.connect()
hook = malformed.sync({ ...marker, presentation_id: 'foreign-deck' })
assert.equal(hook.composerThemeResolved, false)
assert.equal(hook.sendThemeSelection({ mode: 'auto' }, 'malformed', 'deck-a'), false)
hook = malformed.sync(marker, 'deck-a', 'foreign-session')
assert.equal(hook.composerThemeResolved, false, 'foreign session cannot resolve policy')

const ordinary = harness(true)
await ordinary.connect()
hook = ordinary.sync('absent')
assert.equal(hook.sendThemeSelection({ mode: 'auto' }, 'ordinary', 'deck-a'), true, 'flag-on ordinary decks unlock only after owned sync')
hook.clearMessages()
assert.equal(ordinary.render().composerAdoption, null)
assert.equal(ordinary.render().composerThemeResolved, false)

const legacy = harness(false)
hook = await legacy.connect()
assert.equal(hook.sendThemeSelection({ mode: 'auto' }, 'legacy-before-sync', 'deck-a'), true, 'flag-off transport behavior is unchanged')
hook = legacy.sync()
assert.equal(hook.composerAdoption, null)
assert.equal(hook.sendThemeSelection({ mode: 'auto' }, 'legacy-after-sync', 'deck-a'), true)
assert.equal(legacy.sockets[0].sent.length, 2)
console.log('Composer theme: actual hook initial admission, sync race, reload/cache, reconnect, foreign/malformed provenance and flag-off transport passed.')
