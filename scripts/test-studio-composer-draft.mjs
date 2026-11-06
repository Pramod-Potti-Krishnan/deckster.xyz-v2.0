// PASS2D A1: the unsent chat-composer text survives a reload (flag NEXT_PUBLIC_STUDIO_COMPOSER_DRAFT, default off).
// Offline and self-contained: no network, no git, no browser. The repo root is found from this file (package.json anchor).
// It loads the real pure helper (lib/studio-composer-draft.ts, which imports nothing) and the real hook (hooks/use-studio-composer-draft.ts)
// on a tiny hook runtime with a React-like host (a state change re-renders, effects run after render, StrictMode double-run optional),
// drives reload / typing / send / failed send / id arrival / session switch / account switch / blocked storage with a fake storage, proves
// the flag-off hook is inert, pins the page wiring and the documented flag, then re-runs every suite against deliberately broken copies
// of the sources: each mutant must be caught.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const nodeRequire = createRequire(path.join(repoRoot, 'package.json'))

const FLAG = 'NEXT_PUBLIC_STUDIO_COMPOSER_DRAFT'
const FILES = {
  lib: 'lib/studio-composer-draft.ts',
  hook: 'hooks/use-studio-composer-draft.ts',
  page: 'app/builder/page.tsx',
  chat: 'components/builder/chat-input.tsx',
}
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
const SRC = Object.fromEntries(Object.entries(FILES).map(([key, rel]) => [key, read(rel)]))
const ENVEX = read('.env.example')
const PKG = JSON.parse(read('package.json'))

let checks = 0
const check = (fn, ...args) => { checks++; return fn(...args) }

// ---------------------------------------------------------------- loader: transpile-on-require, repo files only
const transpiled = new Map()
function compile(rel, source) {
  const key = `${rel}\0${source}`
  if (!transpiled.has(key)) {
    const out = ts.transpileModule(source, { fileName: rel, reportDiagnostics: true, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } })
    const errors = (out.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error)
    assert.equal(errors.length, 0, `${rel} does not transpile: ${errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join('; ')}`)
    transpiled.set(key, out.outputText)
  }
  return transpiled.get(key)
}
/** `overrides`: repo-relative path -> source text; `stubs`: import specifier as written -> module object; `globals`: extra free names. */
function createWorld({ env = {}, overrides = {}, stubs = {}, globals = {} } = {}) {
  const cache = new Map()
  const names = Object.keys(globals)
  const exists = rel => rel in overrides || (fs.existsSync(path.join(repoRoot, rel)) && fs.statSync(path.join(repoRoot, rel)).isFile())
  const resolve = (spec, fromRel) => {
    const base = spec.startsWith('@/') ? spec.slice(2) : path.posix.join(path.posix.dirname(fromRel), spec)
    for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) if (exists(base + ext) && /\.tsx?$/.test(base + ext)) return base + ext
    throw new Error(`unresolved ${spec} from ${fromRel}`)
  }
  function load(rel) {
    if (cache.has(rel)) return cache.get(rel).exports
    const module = { exports: {} }
    cache.set(rel, module)
    const source = rel in overrides ? overrides[rel] : read(rel)
    const require = spec => {
      if (spec in stubs) return stubs[spec]
      if (spec.startsWith('@/') || spec.startsWith('.')) return load(resolve(spec, rel))
      return nodeRequire(spec)
    }
    new Function('module', 'exports', 'require', 'process', ...names, compile(rel, source))(
      module, module.exports, require, { env }, ...names.map(name => globals[name]))
    return module.exports
  }
  return { load }
}

// ---------------------------------------------------------------- fakes
class MemStorage {
  constructor() { this.map = new Map(); this.log = [] }
  getItem(key) { this.log.push(['get', key]); return this.map.has(key) ? this.map.get(key) : null }
  setItem(key, value) { this.log.push(['set', key]); this.map.set(key, String(value)) }
  removeItem(key) { this.log.push(['remove', key]); this.map.delete(key) }
  has(key) { return this.map.has(key) }
}
const blockedStorage = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') }, removeItem() { throw new Error('blocked') } }
const fullStorage = Object.assign(new MemStorage(), { setItem() { throw new Error('QuotaExceededError') } })

const OWNER = 'user-1'
const S1 = 'sess-1'
const S2 = 'sess-2'
const DRAFT = 'Help me explain our Q3 results to the board'

// ---------------------------------------------------------------- suite 1: the pure helper
function pureSuite(overrides = {}) {
  const on = createWorld({ env: { [FLAG]: 'true' }, overrides }).load(FILES.lib)
  const off = createWorld({ env: {}, overrides }).load(FILES.lib)
  const other = createWorld({ env: { [FLAG]: '1' }, overrides }).load(FILES.lib)
  const upper = createWorld({ env: { [FLAG]: 'TRUE' }, overrides }).load(FILES.lib)

  // the flag: exact "true", default off
  check(assert.equal, on.STUDIO_COMPOSER_DRAFT_ENABLED, true)
  check(assert.equal, off.STUDIO_COMPOSER_DRAFT_ENABLED, false, 'unset = off')
  check(assert.equal, other.STUDIO_COMPOSER_DRAFT_ENABLED, false, '"1" is not "true"')
  check(assert.equal, upper.STUDIO_COMPOSER_DRAFT_ENABLED, false, '"TRUE" is not "true"')

  // the key: account + session; nothing for a session with no id
  const key = on.composerDraftKey(OWNER, S1)
  check(assert.equal, typeof key, 'string')
  check(assert.ok, key.includes(S1) && key.includes(OWNER))
  check(assert.notEqual, key, on.composerDraftKey(OWNER, S2), 'a key per session')
  check(assert.notEqual, key, on.composerDraftKey('user-2', S1), 'a key per account')
  check(assert.equal, on.composerDraftKey('a@b.c/x', S1).includes('/'), false, 'the account part is encoded')
  check(assert.equal, on.composerDraftKey(OWNER, null), null)
  check(assert.equal, on.composerDraftKey(OWNER, undefined), null)
  check(assert.equal, on.composerDraftKey(OWNER, 'new'), null, 'a fresh session with no id keeps nothing')
  check(assert.equal, on.composerDraftKey(OWNER, ''), null)
  check(assert.equal, on.composerDraftKey(null, S1), null, 'signed out keeps nothing')
  check(assert.equal, on.composerDraftKey('', S1), null)

  // read / write
  const storage = new MemStorage()
  on.writeComposerDraft(storage, key, DRAFT)
  check(assert.equal, on.readComposerDraft(storage, key), DRAFT)
  on.writeComposerDraft(storage, key, '  \n ')
  check(assert.equal, storage.has(key), false, 'blank text removes the draft')
  check(assert.equal, on.readComposerDraft(storage, key), '')
  on.writeComposerDraft(storage, key, 'a\nb  ')
  check(assert.equal, on.readComposerDraft(storage, key), 'a\nb  ', 'text is stored as typed, not trimmed')
  storage.setItem(key, '   ')
  check(assert.equal, on.readComposerDraft(storage, key), '', 'a stored blank reads as no draft')
  on.writeComposerDraft(storage, key, 'x'.repeat(on.COMPOSER_DRAFT_MAX_CHARS + 500))
  check(assert.equal, storage.map.get(key).length, on.COMPOSER_DRAFT_MAX_CHARS, 'writes are capped')
  storage.setItem(key, 'y'.repeat(on.COMPOSER_DRAFT_MAX_CHARS + 500))
  check(assert.equal, on.readComposerDraft(storage, key).length, on.COMPOSER_DRAFT_MAX_CHARS, 'reads are capped')
  check(assert.equal, on.COMPOSER_DRAFT_MAX_CHARS, 20_000)
  // no storage, no key: quiet
  check(assert.equal, on.readComposerDraft(null, key), '')
  check(assert.equal, on.readComposerDraft(storage, null), '')
  check(assert.doesNotThrow, () => on.writeComposerDraft(null, key, 'x'))
  const untouched = new MemStorage()
  on.writeComposerDraft(untouched, null, 'x')
  check(assert.deepEqual, untouched.log, [], 'no key: storage untouched')
  // blocked / full storage never throws
  check(assert.doesNotThrow, () => on.writeComposerDraft(blockedStorage, key, 'x'))
  check(assert.doesNotThrow, () => on.writeComposerDraft(blockedStorage, key, ''))
  check(assert.equal, on.readComposerDraft(blockedStorage, key), '')
  check(assert.doesNotThrow, () => on.writeComposerDraft(fullStorage, key, 'x'))

  // the restore plan
  const plan = on.planComposerDraftRestore
  check(assert.deepEqual, plan(null, 'k1', '', 'D'), { set: true, text: 'D' }, 'a load into an empty box restores the draft')
  check(assert.deepEqual, plan(null, 'k1', '  ', 'D'), { set: true, text: 'D' }, 'a blank box counts as empty')
  check(assert.deepEqual, plan(null, 'k1', 'typed', 'D'), { set: false }, 'text already typed is never replaced by an older draft')
  check(assert.deepEqual, plan(null, 'k1', '', ''), { set: false }, 'nothing stored, nothing to do')
  check(assert.deepEqual, plan('k1', 'k1', '', 'D'), { set: true, text: 'D' }, 'the same scope again (a double effect run) is the same decision')
  check(assert.deepEqual, plan('k1', 'k1', 'typed', 'D'), { set: false })
  check(assert.deepEqual, plan('k1', 'k2', 'old session text', 'D2'), { set: true, text: 'D2' }, 'another session shows its own draft')
  check(assert.deepEqual, plan('k1', 'k2', 'old session text', ''), { set: true, text: '' }, 'another session with no draft shows an empty box')
  check(assert.deepEqual, plan('k1', 'k2', '', ''), { set: false }, 'already empty: no change')
  check(assert.deepEqual, plan('k1', 'k2', 'same', 'same'), { set: false }, 'already showing that text: no change')
}

// ---------------------------------------------------------------- suite 2: the real hook, on a tiny hook runtime
function hookRuntime() {
  let current = null
  const impl = { useRef: (...a) => current.useRef(...a), useEffect: (...a) => current.useEffect(...a) }
  function instance(call, { strict = false } = {}) {
    let cursor = 0, slots = [], pending = [], mounted = false
    const hooks = {
      useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial } },
      useEffect(callback, deps) {
        const i = cursor++, old = slots[i]
        if (!old || deps.length !== old.deps.length || deps.some((dep, n) => !Object.is(dep, old.deps[n]))) {
          const next = { deps, cleanup: old?.cleanup }
          slots[i] = next
          pending.push(() => { next.cleanup?.(); next.cleanup = callback() })
        }
      },
    }
    return {
      render(props) {
        current = hooks; cursor = 0; pending = []
        try { call(props) } finally { current = null }
        const first = !mounted
        mounted = true
        for (const effect of pending) effect()
        // React StrictMode runs every effect a second time on mount.
        if (strict && first) for (const effect of pending) effect()
      },
    }
  }
  return { impl, instance }
}

/** A React-like host: `value` is state, `setValue` schedules a re-render, `user()` is the person typing or a send clearing the box. */
function makeHost(hookModule, runtime, { storage, enabled = true, owner = OWNER, sessionId = S1, value = '', strict = false } = {}) {
  const host = { value, sessionId, owner, enabled, sets: [], storage, dirty: false, generation: 0 }
  const inst = runtime.instance(p => hookModule.useStudioComposerDraft(p), { strict })
  // A new setter identity every render; an older one must never be called (the hook has to use the latest).
  const makeSetter = () => {
    const mine = ++host.generation
    return next => {
      if (mine !== host.generation) throw new Error('stale setValue called')
      host.sets.push(next)
      if (next !== host.value) { host.value = next; host.dirty = true }
    }
  }
  host.render = () => {
    for (let pass = 0; pass < 10; pass++) {
      host.dirty = false
      inst.render({ enabled: host.enabled, owner: host.owner, sessionId: host.sessionId, value: host.value, setValue: makeSetter() })
      if (!host.dirty) return host
    }
    throw new Error('render loop: the hook keeps changing the value')
  }
  host.type = text => { host.value = text; return host.render() }
  host.go = sessionId => { host.sessionId = sessionId; return host.render() }
  return host
}

function hookSuite(overrides = {}) {
  const runtime = hookRuntime()
  const storage = new MemStorage()
  const win = { get sessionStorage() { return win.__storage ?? storage } }
  const world = createWorld({ env: { [FLAG]: 'true' }, overrides, stubs: { react: runtime.impl }, globals: { window: win } })
  const hookModule = world.load(FILES.hook)
  const lib = world.load(FILES.lib)
  const keyOf = (owner, session) => lib.composerDraftKey(owner, session)
  const fresh = () => { win.__storage = undefined; storage.map.clear(); storage.log.length = 0 }
  const mount = (opts = {}) => makeHost(hookModule, runtime, { storage, ...opts }).render()

  // flag off: inert. No storage access at all, no value change, even with a draft stored.
  {
    fresh()
    storage.setItem(keyOf(OWNER, S1), DRAFT); storage.log.length = 0
    const host = mount({ enabled: false })
    host.type('hello'); host.go(S2); host.type('')
    check(assert.deepEqual, storage.log, [], 'flag off: the storage is never touched')
    check(assert.deepEqual, host.sets, [], 'flag off: the box is never set')
    check(assert.equal, storage.map.get(keyOf(OWNER, S1)), DRAFT, 'flag off: a stored draft is left alone')
  }

  // reload with a stored draft: it comes back, and the stored copy survives the mount (the write must not clobber it)
  {
    fresh()
    storage.setItem(keyOf(OWNER, S1), DRAFT)
    const host = mount()
    check(assert.equal, host.value, DRAFT, 'reload: the draft is back in the box')
    check(assert.equal, storage.map.get(keyOf(OWNER, S1)), DRAFT, 'reload: the stored draft survives the mount')
    check(assert.equal, storage.log.some(([op]) => op === 'remove'), false, 'reload: nothing was removed on the way')
  }
  // the same under StrictMode's second effect run
  {
    fresh()
    storage.setItem(keyOf(OWNER, S1), DRAFT)
    const host = mount({ strict: true })
    check(assert.equal, host.value, DRAFT, 'strict mode: the draft is back')
    check(assert.equal, storage.map.get(keyOf(OWNER, S1)), DRAFT, 'strict mode: the stored draft survives')
  }
  // a reload with nothing stored: an empty box, nothing written
  {
    fresh()
    const host = mount()
    check(assert.equal, host.value, '')
    check(assert.equal, storage.map.size, 0, 'no draft: nothing is written for an empty box')
    check(assert.deepEqual, host.sets, [], 'no draft: the box is not set')
  }

  // typing is kept as you type; emptying the box removes it
  {
    fresh()
    const host = mount()
    host.type('H'); host.type('Hel'); host.type(DRAFT)
    check(assert.equal, storage.map.get(keyOf(OWNER, S1)), DRAFT, 'typing: the latest text is stored')
    // reload: a new host over the same storage
    const reloaded = mount()
    check(assert.equal, reloaded.value, DRAFT, 'typing then reload: the text is back')
    reloaded.type('')
    check(assert.equal, storage.has(keyOf(OWNER, S1)), false, 'emptying the box removes the draft')
    check(assert.equal, mount().value, '', 'emptied then reload: an empty box')
  }

  // clear on send: the page empties the box once the send completes
  {
    fresh()
    const host = mount()
    host.type(DRAFT)
    host.type('') // the page's clearSubmittedComposer after a completed send
    check(assert.equal, storage.has(keyOf(OWNER, S1)), false, 'send: the stored draft is gone')
    check(assert.equal, mount().value, '', 'send then reload: no ghost draft')
  }
  // a failed send leaves the text in the box: it stays stored
  {
    fresh()
    const host = mount()
    host.type(DRAFT)
    host.render() // the failed send changes nothing
    check(assert.equal, storage.map.get(keyOf(OWNER, S1)), DRAFT, 'failed send: the draft stays stored')
    check(assert.equal, mount().value, DRAFT, 'failed send then reload: the text is back')
  }

  // a fresh session gets its id after the user has typed: the text is kept and stored under the new id
  {
    fresh()
    const host = mount({ sessionId: null })
    host.type(DRAFT)
    check(assert.equal, storage.map.size, 0, 'no id yet: nothing is stored')
    host.go(S1)
    check(assert.equal, host.value, DRAFT, 'id arrives: the typed text stays')
    check(assert.equal, storage.map.get(keyOf(OWNER, S1)), DRAFT, 'id arrives: the typed text is stored under the new id')
    check(assert.equal, mount().value, DRAFT, 'id arrives then reload: the text is back')
  }
  // typed text beats an older stored draft when the id arrives
  {
    fresh()
    storage.setItem(keyOf(OWNER, S1), 'older draft')
    const host = mount({ sessionId: null })
    host.type('newer text')
    host.go(S1)
    check(assert.equal, host.value, 'newer text', 'id arrives: typed text is never replaced by an older draft')
    check(assert.equal, storage.map.get(keyOf(OWNER, S1)), 'newer text')
  }
  // an empty box when the id arrives takes the stored draft
  {
    fresh()
    storage.setItem(keyOf(OWNER, S1), DRAFT)
    const host = mount({ sessionId: 'new' })
    check(assert.equal, host.value, '', "'new' has no id: nothing restored")
    host.go(S1)
    check(assert.equal, host.value, DRAFT, 'id arrives, box empty: the draft is restored')
  }

  // moving between sessions: each keeps its own draft, and one session's text never lands in another
  {
    fresh()
    storage.setItem(keyOf(OWNER, S2), 'draft for two')
    const host = mount({ sessionId: S1 })
    host.type('text for one')
    host.go(S2)
    check(assert.equal, host.value, 'draft for two', 'switch: the other session shows its own draft')
    check(assert.equal, storage.map.get(keyOf(OWNER, S1)), 'text for one', 'switch: the first session keeps its draft')
    check(assert.equal, storage.map.get(keyOf(OWNER, S2)), 'draft for two', "switch: the first session's text was not written into the other")
    host.go(S1)
    check(assert.equal, host.value, 'text for one', 'switch back: the first draft is back')
  }
  {
    fresh()
    const host = mount({ sessionId: S1 })
    host.type('text for one')
    host.go(S2)
    check(assert.equal, host.value, '', 'switch to a session with no draft: an empty box')
    check(assert.equal, storage.map.get(keyOf(OWNER, S1)), 'text for one', 'switch: the first draft is kept')
    check(assert.equal, storage.has(keyOf(OWNER, S2)), false, 'switch: nothing is stored for the empty box')
  }

  // another account never sees the draft
  {
    fresh()
    storage.setItem(keyOf(OWNER, S1), DRAFT)
    const host = mount({ owner: 'user-2' })
    check(assert.equal, host.value, '', 'another account: no draft')
  }
  // signed out (no owner): nothing kept
  {
    fresh()
    const host = mount({ owner: '' })
    host.type('x')
    check(assert.equal, storage.map.size, 0, 'no owner: nothing is stored')
  }

  // blocked or full storage: the composer still works
  for (const [name, bad] of [['blocked', blockedStorage], ['full', fullStorage]]) {
    fresh()
    win.__storage = bad
    const host = mount()
    check(assert.doesNotThrow, () => { host.type('abc'); host.type(''); host.go(S2) }, `${name} storage: no throw`)
    check(assert.equal, host.value, '', `${name} storage: the box still works`)
  }
  fresh()
}

// ---------------------------------------------------------------- suite 3: page wiring, flag documentation, flag-off identity pins
function guardSuite(sources = {}) {
  const page = sources.page ?? SRC.page
  const hook = sources.hook ?? SRC.hook
  const lib = sources.lib ?? SRC.lib
  const chat = sources.chat ?? SRC.chat
  const env = sources.env ?? ENVEX
  const pkg = sources.pkg ?? PKG

  // the page: one import of the flag, one of the hook, one call, fed by the page's own state
  check(assert.match, page, /import \{ STUDIO_COMPOSER_DRAFT_ENABLED \} from '@\/lib\/studio-composer-draft'/)
  check(assert.match, page, /import \{ useStudioComposerDraft \} from '@\/hooks\/use-studio-composer-draft'/)
  check(assert.equal, (page.match(/useStudioComposerDraft\(/g) ?? []).length, 1, 'one call site')
  check(assert.equal, (page.match(/STUDIO_COMPOSER_DRAFT_ENABLED/g) ?? []).length, 2, 'the flag is only the import and the call')
  const call = page.match(/useStudioComposerDraft\(\{([\s\S]*?)\n  \}\)/)?.[1] ?? ''
  check(assert.match, call, /enabled: STUDIO_COMPOSER_DRAFT_ENABLED,/)
  check(assert.match, call, /owner: builderCacheOwner,/)
  check(assert.match, call, /sessionId: currentSessionId,/)
  check(assert.match, call, /value: inputMessage,/)
  check(assert.match, call, /setValue: setInputMessage,/)
  // the hook is called after both pieces of state exist, and before the per-session options restore
  const at = page.indexOf('useStudioComposerDraft({')
  check(assert.ok, page.indexOf('const [inputMessage, setInputMessage] = useState("")') > 0 && page.indexOf('const [inputMessage, setInputMessage] = useState("")') < at, 'after the composer state')
  check(assert.ok, page.indexOf('const [currentSessionId, setCurrentSessionId]') > 0 && page.indexOf('const [currentSessionId, setCurrentSessionId]') < at, 'after the session id state')
  // the send path is untouched: the box is cleared by the existing clearSubmittedComposer, and that is what removes the draft
  check(assert.match, page, /if \(submittedDraft\.trim\(\) === messageText\) \{\s*\n\s*setInputMessage\(current => current === submittedDraft \? '' : current\)/)
  // the composer component itself is not changed by this flag
  check(assert.equal, /composer-?draft/i.test(chat), false, 'chat-input.tsx does not know the flag')

  // the hook: inert unless enabled, scoped to a real session of an account, restore before write
  check(assert.match, hook, /const key = enabled \? composerDraftKey\(owner, sessionId\) : null/)
  check(assert.ok, hook.indexOf('planComposerDraftRestore(') > 0 && hook.indexOf('planComposerDraftRestore(') < hook.indexOf('writeComposerDraft(sessionStorageOrNull(), key, value)'), 'restore is declared before write')
  check(assert.match, hook, /\}, \[key\]\)/)
  check(assert.match, hook, /\}, \[key, value\]\)/)
  check(assert.match, hook, /if \(!key\) return/)
  // the helper imports nothing
  check(assert.equal, /^\s*import\s/m.test(lib), false, 'lib/studio-composer-draft.ts imports nothing')
  check(assert.match, lib, /export const STUDIO_COMPOSER_DRAFT_ENABLED = process\.env\.NEXT_PUBLIC_STUDIO_COMPOSER_DRAFT === 'true'/)

  // flag documented, default off; test script registered
  check(assert.match, env, /^NEXT_PUBLIC_STUDIO_COMPOSER_DRAFT="false"$/m)
  check(assert.equal, pkg.scripts['test:studio-composer-draft'], 'node scripts/test-studio-composer-draft.mjs')
}

function fullSuite(overrides = {}, only = ['pure', 'hook', 'guard']) {
  if (only.includes('pure')) pureSuite(overrides)
  if (only.includes('hook')) hookSuite(overrides)
  if (only.includes('guard')) {
    const by = Object.fromEntries(Object.entries(FILES).filter(([, rel]) => rel in overrides).map(([key, rel]) => [key, overrides[rel]]))
    guardSuite(by)
  }
}

// ---------------------------------------------------------------- the real sources
fullSuite()

// ---------------------------------------------------------------- mutation check: every mutant must be caught
// [name, file key, from, to, suites to run]
const mutants = [
  // flag
  ['flag: any value enables', 'lib', "=== 'true'", "!== 'false'", ['pure']],
  ['flag: on by default', 'lib', "=== 'true'", "!== 'never'", ['pure']],
  // key
  ['key: not per session', 'lib', '_${encodeURIComponent(owner)}_${sessionId}`', '_${encodeURIComponent(owner)}`', ['pure', 'hook']],
  ['key: not per account', 'lib', 'deckster_composer_draft_v1_${encodeURIComponent(owner)}_${sessionId}`', 'deckster_composer_draft_v1_${sessionId}`', ['pure', 'hook']],
  ['key: the account part is not encoded', 'lib', 'encodeURIComponent(owner)', 'owner', ['pure']],
  ['key: a fresh session (new) keeps a draft', 'lib', "!sessionId || sessionId === 'new'", '!sessionId', ['pure', 'hook']],
  ['key: signed out keeps a draft', 'lib', 'if (!owner || !sessionId', 'if (!sessionId', ['pure', 'hook']],
  // storage
  ['write: blank text is stored', 'lib', 'if (!text.trim()) storage.removeItem(key)', 'if (false) storage.removeItem(key)', ['pure', 'hook']],
  ['write: the cap is gone', 'lib', 'storage.setItem(key, text.slice(0, COMPOSER_DRAFT_MAX_CHARS))', 'storage.setItem(key, text)', ['pure']],
  ['write: a storage error escapes', 'lib', '    // Private mode or a full storage: the composer still works, it just does not remember.\n', '    throw new Error("escape")\n', ['pure', 'hook']],
  ['read: a blank draft reads as a draft', 'lib', "typeof raw === 'string' && raw.trim() ? raw.slice(0, COMPOSER_DRAFT_MAX_CHARS) : ''", "typeof raw === 'string' ? raw.slice(0, COMPOSER_DRAFT_MAX_CHARS) : ''", ['pure']],
  ['read: the cap is gone', 'lib', 'raw.slice(0, COMPOSER_DRAFT_MAX_CHARS) : \'\'', "raw : ''", ['pure']],
  ['read: a storage error escapes', 'lib', '  } catch {\n    return \'\'\n  }', '  } catch (error) {\n    throw error\n  }', ['pure', 'hook']],
  ['cap: 200 characters', 'lib', 'COMPOSER_DRAFT_MAX_CHARS = 20_000', 'COMPOSER_DRAFT_MAX_CHARS = 200', ['pure', 'guard']],
  // the restore plan
  ['plan: typed text is replaced by the older draft', 'lib', 'if (!current.trim() && stored) return', 'if (stored) return', ['pure', 'hook']],
  ['plan: a draft never restores', 'lib', 'if (!current.trim() && stored) return { set: true, text: stored }', 'if (false) return { set: true, text: stored }', ['pure', 'hook']],
  ['plan: another session keeps the old text', 'lib', 'if (previousScope !== null && previousScope !== scope) return', 'if (false) return', ['pure', 'hook']],
  ['plan: another session with no draft keeps the old text', 'lib', 'return current === stored ? { set: false } : { set: true, text: stored }', 'return stored ? { set: true, text: stored } : { set: false }', ['pure', 'hook']],
  ['plan: a blank box does not count as empty', 'lib', '!current.trim() && stored', "current === '' && stored", ['pure']],
  // the hook
  ['hook: runs with the flag off', 'hook', 'const key = enabled ? composerDraftKey(owner, sessionId) : null', 'const key = composerDraftKey(owner, sessionId)', ['hook', 'guard']],
  ['hook: the stored draft is clobbered by the mount write', 'hook', "if (skipWriteKeyRef.current === key) { skipWriteKeyRef.current = null; return }", '', ['hook']],
  ['hook: the skip is never set', 'hook', '      skipWriteKeyRef.current = key\n', '', ['hook']],
  ['hook: the skip also swallows a kept draft (the first version of this hook)', 'hook', "    if (plan.set) {\n      // The box is about to change; the write for THIS commit would save the old text (or the empty box a reload starts with) over it.\n      skipWriteKeyRef.current = key\n      setValueRef.current(plan.text)\n    }", '    skipWriteKeyRef.current = key\n    if (plan.set) setValueRef.current(plan.text)', ['hook']],
  ['hook: the skip is never consumed', 'hook', 'skipWriteKeyRef.current = null; return }', 'return }', ['hook']],
  ['hook: no write on typing', 'hook', 'writeComposerDraft(sessionStorageOrNull(), key, value)', 'void value', ['hook', 'guard']],
  ['hook: the write ignores the value', 'hook', 'writeComposerDraft(sessionStorageOrNull(), key, value)', "writeComposerDraft(sessionStorageOrNull(), key, '')", ['hook', 'guard']],
  ['hook: restore never reads the storage', 'hook', 'readComposerDraft(sessionStorageOrNull(), key)', "''", ['hook']],
  ['hook: restore never sets the box', 'hook', '      setValueRef.current(plan.text)\n', '', ['hook']],
  ['hook: restore forgets the previous scope', 'hook', 'const previous = restoredKeyRef.current\n    restoredKeyRef.current = key', 'const previous = null\n    restoredKeyRef.current = key', ['hook']],
  ['hook: restore does not record its scope', 'hook', '    restoredKeyRef.current = key\n    if (!key) return', '    if (!key) return', ['hook']],
  ['hook: the restore only runs once', 'hook', '  }, [key])', '  }, [])', ['hook', 'guard']],
  ['hook: the write ignores a changed value', 'hook', '  }, [key, value])', '  }, [key])', ['hook', 'guard']],
  ['hook: a stale setter', 'hook', 'setValueRef.current = setValue\n', '', ['hook']],
  // page wiring
  ['page: the hook is not called', 'page', '  useStudioComposerDraft({', '  void ({', ['guard']],
  ['page: the flag is not passed', 'page', 'enabled: STUDIO_COMPOSER_DRAFT_ENABLED,', 'enabled: true,', ['guard']],
  ['page: the account is not passed', 'page', '    owner: builderCacheOwner,\n    sessionId: currentSessionId,\n    value: inputMessage,', '    owner: null,\n    sessionId: currentSessionId,\n    value: inputMessage,', ['guard']],
  ['page: another session id is passed', 'page', '    sessionId: currentSessionId,\n    value: inputMessage,', '    sessionId: null,\n    value: inputMessage,', ['guard']],
  ['page: another value is passed', 'page', '    value: inputMessage,\n    setValue: setInputMessage,\n  })\n  const builderOptionsRestoredSessionRef', "    value: '',\n    setValue: setInputMessage,\n  })\n  const builderOptionsRestoredSessionRef", ['guard']],
  ['page: a send no longer clears the box', 'page', "setInputMessage(current => current === submittedDraft ? '' : current)", 'void current', ['guard']],
  ['page: the composer component learns the flag', 'chat', 'const TEXTAREA_MIN_HEIGHT = 96', 'const TEXTAREA_MIN_HEIGHT = 96 // composer-draft', ['guard']],
  // docs and wiring
  ['env: documented on', 'env', 'NEXT_PUBLIC_STUDIO_COMPOSER_DRAFT="false"', 'NEXT_PUBLIC_STUDIO_COMPOSER_DRAFT="true"', ['guard']],
  ['env: not documented', 'env', 'NEXT_PUBLIC_STUDIO_COMPOSER_DRAFT="false"', '', ['guard']],
  ['package: script not registered', 'pkg', '"test:studio-composer-draft"', '"test:studio-composer-draft-x"', ['guard']],
]

const REL = { lib: FILES.lib, hook: FILES.hook, page: FILES.page, chat: FILES.chat }
let caught = 0
const survivors = []
const invalid = []
for (const [name, key, from, to, suites] of mutants) {
  const original = key === 'env' ? ENVEX : key === 'pkg' ? JSON.stringify(PKG, null, 2) : SRC[key]
  assert.ok(original.includes(from), `mutant "${name}" no longer matches the ${key} source`)
  const broken = original.replace(from, () => to)
  assert.notEqual(broken, original, `mutant "${name}" changes nothing`)
  if (key !== 'env' && key !== 'pkg') {
    // a mutant must be valid code: it is caught by behaviour, not by a syntax error
    try { compile(REL[key], broken) } catch (error) { invalid.push(`${name}: ${String(error.message).slice(0, 80)}`); continue }
  }
  const seen = checks
  let survived = false
  try {
    if (key === 'env') guardSuite({ env: broken })
    else if (key === 'pkg') guardSuite({ pkg: JSON.parse(broken) })
    else fullSuite({ [REL[key]]: broken }, suites)
    survived = true
  } catch { /* caught */ }
  checks = seen
  if (survived) survivors.push(name)
  else caught++
}
assert.deepEqual(invalid, [], 'every mutant must be valid code')
assert.deepEqual(survivors, [], `mutants survived: ${survivors.join(' | ')}`)
check(assert.equal, caught, mutants.length)

console.log(`studio-composer-draft: ${checks} checks passed, ${caught} mutants caught`)
