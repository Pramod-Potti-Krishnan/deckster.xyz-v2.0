// Deterministic, offline stand-ins for everything the Director chat touches in a browser:
// a virtual clock (timers + Date), a fake WebSocket that records every outbound byte,
// a fake fetch that only knows the Director ws-token route, in-memory storage and a
// console that records errors/warnings. Nothing here opens a real socket or file.
import { setImmediate as macrotask } from 'node:timers/promises'

export const START_MS = Date.UTC(2026, 9, 5, 12, 0, 0)
export const SYNTHETIC_WS_URL = 'wss://director.synthetic.invalid/ws'
export const SYNTHETIC_LAYOUT_URL = 'https://layout.synthetic.invalid'

export class VirtualClock {
  constructor(start = START_MS) {
    this.t = start
    this.seq = 0
    this.nextId = 1
    this.timers = new Map()
    this.uncaught = []
    this.setTimeout = (fn, ms = 0, ...args) => this.#add(fn, ms, args, 0)
    this.setInterval = (fn, ms = 0, ...args) => this.#add(fn, ms, args, Math.max(1, Number(ms) || 1))
    this.clearTimeout = id => { this.timers.delete(Number(id)) }
    this.clearInterval = this.clearTimeout
    this.requestAnimationFrame = fn => this.#add(() => fn(this.t - START_MS), 16, [], 0)
    this.cancelAnimationFrame = this.clearTimeout
  }
  now() { return this.t }
  pending() { return this.timers.size }
  #add(fn, ms, args, interval) {
    if (typeof fn !== 'function') throw new TypeError('harness clock: timer callback must be a function')
    const id = this.nextId++
    this.timers.set(id, { id, fn, args, at: this.t + Math.max(0, Number(ms) || 0), seq: ++this.seq, interval })
    return id
  }
  // Fire every timer due within `ms`, in (time, creation) order, letting `settle` drain
  // promises and React renders between callbacks, exactly like a quiet event loop would.
  async advance(ms, settle) {
    const target = this.t + Math.max(0, ms)
    let fired = 0
    for (;;) {
      let next = null
      for (const timer of this.timers.values()) {
        if (timer.at > target) continue
        if (!next || timer.at < next.at || (timer.at === next.at && timer.seq < next.seq)) next = timer
      }
      if (!next) break
      if (++fired > 20000) throw new Error('harness clock: more than 20000 timer firings in one advance; runaway interval?')
      this.t = Math.max(this.t, next.at)
      if (next.interval) { next.at += next.interval; next.seq = ++this.seq } else this.timers.delete(next.id)
      try { next.fn(...next.args) } catch (error) { this.uncaught.push(String(error?.message ?? error).slice(0, 200)) }
      await settle()
    }
    this.t = target
    await settle()
  }
}

export function createStorage() {
  const map = new Map()
  return {
    getItem: key => (map.has(String(key)) ? map.get(String(key)) : null),
    setItem: (key, value) => { map.set(String(key), String(value)) },
    removeItem: key => { map.delete(String(key)) },
    clear: () => map.clear(),
    key: index => [...map.keys()][index] ?? null,
    get length() { return map.size },
    dump: () => Object.fromEntries([...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1))),
  }
}

const summarise = args => args.map(arg => typeof arg === 'string' ? arg.slice(0, 160) : arg instanceof Error ? `${arg.name}: ${String(arg.message).slice(0, 120)}` : `<${typeof arg}>`).join(' ')

export function createConsole(sink) {
  const quiet = () => {}
  return {
    log: quiet, info: quiet, debug: quiet, trace: quiet, group: quiet, groupEnd: quiet, groupCollapsed: quiet, table: quiet, dir: quiet, time: quiet, timeEnd: quiet,
    warn: (...args) => sink.push({ level: 'warn', text: summarise(args) }),
    error: (...args) => sink.push({ level: 'error', text: summarise(args) }),
  }
}

// window/EventTarget good enough for the online/offline listeners the hook registers.
export function createWindow(extra) {
  const listeners = new Map()
  const win = {
    ...extra,
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn) },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn) },
    dispatchEvent(event) { for (const fn of [...(listeners.get(event.type) || [])]) fn(event); return true },
    listenerCount: type => listeners.get(type)?.size || 0,
  }
  return win
}

export function createDeterministicCrypto(prefix = 'synthetic-uuid') {
  let n = 0
  return { randomUUID: () => `${prefix}-${String(++n).padStart(4, '0')}`, getRandomValues: array => { for (let i = 0; i < array.length; i++) array[i] = (i * 31 + 7) & 0xff; return array } }
}

// One fake server connection per `new WebSocket(...)`. Test controls are prefixed `server`.
export function createSocketFactory(env) {
  class FakeWebSocket {
    static CONNECTING = 0
    static OPEN = 1
    static CLOSING = 2
    static CLOSED = 3
    CONNECTING = 0
    OPEN = 1
    CLOSING = 2
    CLOSED = 3
    constructor(url, protocols) {
      this.id = env.sockets.length
      this.url = String(url)
      this.protocols = protocols === undefined ? null : [].concat(protocols)
      this.readyState = 0
      this.onopen = this.onmessage = this.onerror = this.onclose = null
      env.sockets.push(this)
      env.handshakes.push({ socket: this.id, url: this.url, subprotocols: this.protocols ? this.protocols.length : 0, at: env.clock.now() - START_MS })
    }
    send(data) {
      if (this.readyState !== 1) throw new DOMExceptionLike('WebSocket is not open', 'InvalidStateError')
      if (typeof data !== 'string') throw new TypeError('harness: the Director chat only sends text frames')
      env.outbound.push({ socket: this.id, at: env.clock.now() - START_MS, data })
      if (data === 'ping' && env.autoPong) env.clock.setTimeout(() => { if (this.readyState === 1) this.onmessage?.({ data: 'pong' }) }, 0)
    }
    close(code = 1005, reason = '') {
      if (this.readyState >= 2) return
      this.readyState = 2
      env.clientCloses.push({ socket: this.id, code, reason: String(reason) })
      env.clock.setTimeout(() => { this.readyState = 3; this.onclose?.({ code, reason: String(reason), wasClean: true }) }, 0)
    }
    serverOpen() { this.readyState = 1; this.onopen?.({ type: 'open' }) }
    serverMessage(data) { this.onmessage?.({ data }) }
    serverClose(code = 1006, reason = '') { this.readyState = 3; this.onclose?.({ code, reason, wasClean: code === 1000 }) }
    serverError() { this.onerror?.({ type: 'error' }) }
  }
  return FakeWebSocket
}

export class DOMExceptionLike extends Error {
  constructor(message, name) { super(message); this.name = name }
}

// Only the Director ws-token route exists. Any other request is a harness failure, not a retry.
export function createFetch(env) {
  return async (input, init) => {
    const url = String(input)
    env.fetches.push({ url, method: init?.method || 'GET' })
    if (/^\/api\/director\/ws-token\?session_id=[^&]+$/.test(url)) {
      return { ok: true, status: 200, json: async () => ({ auth_enabled: false }) }
    }
    env.blockedNetwork.push(url)
    throw new Error(`harness: network disabled (${url.slice(0, 80)})`)
  }
}

export function createEnvironment({ processEnv }) {
  const env = {
    clock: new VirtualClock(),
    sockets: [], handshakes: [], outbound: [], clientCloses: [], fetches: [], blockedNetwork: [],
    consoleEvents: [], windowOpens: [], autoPong: true,
    sessionStorage: createStorage(), localStorage: createStorage(),
    settle: async () => {},
  }
  env.console = createConsole(env.consoleEvents)
  env.crypto = createDeterministicCrypto()
  env.WebSocket = createSocketFactory(env)
  env.fetch = createFetch(env)
  const clock = env.clock
  const FakeDate = class extends Date {
    constructor(...args) { if (args.length === 0) super(clock.now()); else super(...args) }
    static now() { return clock.now() }
  }
  env.navigator = { onLine: true, userAgent: 'harness' }
  env.window = createWindow({
    sessionStorage: env.sessionStorage, localStorage: env.localStorage,
    open: (...args) => { env.windowOpens.push(args.map(String)); return null },
    location: { href: 'https://studio.synthetic.invalid/builder', origin: 'https://studio.synthetic.invalid', pathname: '/builder', search: '' },
    innerWidth: 1600, innerHeight: 900,
  })
  // Globals visible to the repo modules. Language builtins come from the vm context itself.
  env.globals = {
    console: env.console, process: { env: { ...processEnv } }, window: env.window, navigator: env.navigator,
    sessionStorage: env.sessionStorage, localStorage: env.localStorage, crypto: env.crypto, fetch: env.fetch,
    WebSocket: env.WebSocket, Date: FakeDate,
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, setInterval: clock.setInterval, clearInterval: clock.clearInterval,
    requestAnimationFrame: clock.requestAnimationFrame, cancelAnimationFrame: clock.cancelAnimationFrame,
    performance: { now: () => clock.now() - START_MS },
    queueMicrotask, structuredClone, URL, URLSearchParams, TextEncoder, TextDecoder, AbortController, DOMException: DOMExceptionLike,
  }
  env.macrotask = macrotask
  return env
}

// Belt and braces: even though the fake globals never reach the network, make the host
// process itself refuse sockets and fetch while the harness runs.
export function installHostNetworkGuard(net, dns) {
  const refuse = name => () => { throw new Error(`studio-chat harness: ${name} is blocked; this runner is offline`) }
  const saved = { connect: net.Socket.prototype.connect, lookup: dns.lookup, fetch: globalThis.fetch }
  net.Socket.prototype.connect = refuse('net.Socket.connect')
  dns.lookup = refuse('dns.lookup')
  globalThis.fetch = refuse('fetch')
  return () => { net.Socket.prototype.connect = saved.connect; dns.lookup = saved.lookup; globalThis.fetch = saved.fetch }
}
