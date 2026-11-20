// MY COMPANIONS (AVATAR-W5 Step A, the client half: A-4 and A-5, for FRONTEND-1): proof of NEXT_PUBLIC_STUDIO_MY_COMPANIONS (exact "true", only with the Studio shell NEXT_PUBLIC_STUDIO_V4_SHELL "true", build-time, default off) in the
// browser's code: lib/studio-my-companions.ts (new), the marked lines of lib/studio-voice-call-ui.ts, components/builder/voice-call/voice-call-stage.tsx, hooks/use-studio-voice-call.ts and app/(app)/studio/companions/page.tsx, and the
// list-only page components/studio-avatar-spawn/my-companions-page.tsx (new). The two server routes and the link minter have their own proof (scripts/test-studio-avatar-pack-route.mjs); the marker, the strip, the registry and the
// scope are the wiring proof's (scripts/test-studio-my-companions-wiring.mjs).
//
//   node scripts/test-studio-my-companions.mjs     (plain node: ts.transpileModule, a bare vm for the two import-free libs, the repo's own mini-react host for the hook and the containers, react-dom/server for the markup;
//                                                  fake fetches and a fake storage, the host network guard installed: no network, no browser, no .next, no Next runtime; git is read for the base files only)
//
// What it proves:
//  A. the new lib, function by function: the flag (exact "true" with the shell, read as two literals), the pack root (a user pack id, and nothing that only looks like one, goes to /api/avatar/pack/<id>), the list's strict parser on
//     hostile input, the list request (GET, same-origin credentials, no-store) and the pack probe (200 and a JSON object only, never a request off the pack route), none of which ever throws; import-free, no console;
//  B. lib/studio-voice-call-ui.ts: every committed pack (and any other cast name) gives EXACTLY the base's strings and catalogs (base = git show 659f66d7, run through the same functions); a user pack id loads from
//     /api/avatar/pack/<id>/ through the REAL core parser, every file the player would ask for is a path the pack route accepts; the choices, the remembered character (two arguments: the base's answers), the file stays import-free;
//  C. the call stage: with no names the markup is the base's for every cast pack; a user pack goes by its display name in the switch and the transcript; its scene art is asked for through the pack route;
//  D. the call hook, driven offline (mini-react): flag off, nothing is asked for and the stage gets CHOICES itself (the base hook's props and storage writes, tap for tap); flag on, ONE list request, a probe per companion, only
//     reachable ones offered (with their names), the device's remembered user pack is read again once the list is known, a remembered pack that is gone (or unreachable) is the default, a pick of one is remembered;
//  E. the page: list only (no button, no input, no file), loading / one entry (thumb through the pack route, Felix's portrait when it fails) / empty / error, the container drives them from the lib; the route's flag matrix
//     (off: 404; the upload mock alone: the base page's markup; mine, alone or with the mock: the list);
//  F. mutants: each is one edit of a real source, fed to the same checks, and must fail an assertion.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import dns from 'node:dns'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { Root, toElements } from './studio-chat-harness/mini-react.mjs'
import { installHostNetworkGuard } from './studio-chat-harness/fake-env.mjs'

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const require = createRequire(import.meta.url)
const release = installHostNetworkGuard(net, dns)
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
const BASE_COMMIT = '659f66d7a431711f27c8ad54acb1505c0f3b3265' // Studio dev, the head this change is cut from
const plain = value => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)))
const count = (text, needle) => text.split(needle).length - 1
const code = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const macro = () => new Promise(resolve => setImmediate(resolve))
/** What the flag-off runs produced, this change's and the base's, side by side (only the real sources, never a mutant): hashed at the end. */
const flagOff = { now: [], base: [] }
const recordOff = (texts, now, base) => { if (Object.keys(texts).length === 0) { flagOff.now.push(typeof now === 'string' ? now : JSON.stringify(now)); flagOff.base.push(typeof base === 'string' ? base : JSON.stringify(base)) } }

let passed = 0
const failed = []
async function check(label, fn) {
  try { await fn(); passed++; console.log(`PASS ${label}`) } catch (error) { failed.push(label); console.error(`FAIL ${label}: ${error?.stack?.split('\n').slice(0, 6).join(' | ') ?? error}`) }
}

const LIB = 'lib/studio-my-companions.ts', UI = 'lib/studio-voice-call-ui.ts', STAGE = 'components/builder/voice-call/voice-call-stage.tsx', HOOK = 'hooks/use-studio-voice-call.ts'
const VIEW = 'components/studio-avatar-spawn/my-companions-page.tsx', PAGE = 'app/(app)/studio/companions/page.tsx', SPAWN = 'lib/studio-avatar-spawn.ts', CORE = 'lib/studio/voice/bird-motion.ts'
const BASES = Object.fromEntries([UI, STAGE, HOOK, PAGE].map(rel => [rel, git('show', `${BASE_COMMIT}:${rel}`)]))
const BASE_TEXTS = { ...BASES }

const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL', FLAG = 'NEXT_PUBLIC_STUDIO_MY_COMPANIONS', VOICE = 'NEXT_PUBLIC_STUDIO_VOICE_CALL', SPAWN_FLAG = 'NEXT_PUBLIC_STUDIO_AVATAR_SPAWN'
const MINE_ON = { [SHELL]: 'true', [FLAG]: 'true' }
const SPELLINGS = [undefined, '', 'false', 'TRUE', 'True', '1', 'yes', ' true', 'true ', 'true']
// Made-up pack ids (u- and 26 characters): sequential letters and digits, nothing random-looking.
const U1 = 'u-abcdefghijklmnopqrstuvwxyz', U2 = 'u-0123456789abcdefghijklmnop', U3 = 'u-zyxwvutsrqponmlkjihgfedcba'
const NEAR = ['u-abcdefghijklmnopqrstuvwxy', 'u-abcdefghijklmnopqrstuvwxyz0', 'u-ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'U-abcdefghijklmnopqrstuvwxyz', 'u_abcdefghijklmnopqrstuvwxyz', 'u-abcdefghijklmnopqrstuvwxy-', 'u-abcdefghijklm/opqrstuvwxyz', '../u-abcdefghijklmnopqrstuvwxyz', 'u-abcdefghijklmnopqrstuvwxyz/../maya', 'u-abcdefghijklmnopqrstuvwxyz\n', ' u-abcdefghijklmnopqrstuvwxyz', 'u-', '']
const ROUTE = id => `/api/avatar/pack/${id}`

// ---- loading the real sources ------------------------------------------------------------------------------------------------------------------------
const compileCache = new Map()
function compile(text, fileName) {
  const id = `${fileName}\0${text}`
  if (!compileCache.has(id)) {
    const out = ts.transpileModule(text, { fileName, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, isolatedModules: true } })
    const errors = (out.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error)
    if (errors.length) throw new Error(`${fileName} does not transpile: ${ts.flattenDiagnosticMessageText(errors[0].messageText, '\n')}`)
    compileCache.set(id, out.outputText)
  }
  return compileCache.get(id)
}
/** An import-free file in a BARE vm: its own text, a fake `process`, nothing else (no require: an import would throw). Values come back from another realm: compare them through plain(). */
function bare(rel, { env = {}, texts = {} } = {}) {
  const module = { exports: {} }
  vm.runInNewContext(compile(texts[rel] ?? read(rel), rel), { module, exports: module.exports, process: { env: { ...env } } }, { filename: rel })
  return module.exports
}
/** The real files (or a text in `texts`: the base's, or a mutant) in THIS realm, their imports resolved against the repo; `stubs` replace an import specifier. */
function makeHost({ env = {}, texts = {}, stubs = {} } = {}) {
  const cache = new Map()
  const resolve = (from, spec) => {
    const base = spec.startsWith('@/') ? path.join(root, spec.slice(2)) : path.resolve(path.dirname(from), spec)
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
    throw new Error(`cannot resolve ${spec} from ${path.relative(root, from)}`)
  }
  const load = abs => {
    if (cache.has(abs)) return cache.get(abs).exports
    const module = { exports: {} }
    cache.set(abs, module)
    const rel = path.relative(root, abs)
    const text = rel in texts ? texts[rel] : fs.readFileSync(abs, 'utf8')
    const req = spec => {
      if (spec in stubs) return stubs[spec]
      if (spec.endsWith('.css')) return {}
      if (spec.startsWith('@/') || spec.startsWith('.')) return load(resolve(abs, spec))
      return require(spec)
    }
    new Function('module', 'exports', 'require', 'process', compile(text, rel))(module, module.exports, req, { env })
    return module.exports
  }
  return { load: rel => load(path.join(root, rel)) }
}

// ---- fakes ---------------------------------------------------------------------------------------------------------------------------------------------
const jsonAnswer = (body, status = 200) => ({ status, json: async () => body })
const htmlAnswer = (status = 200) => ({ status, json: async () => { throw new SyntaxError('Unexpected token < in JSON') } })
/** A fetch that records every request; `routes` maps a URL to an answer, an Error (thrown) or a function of the URL. Anything else: the one 404. */
function fakeFetch(routes = {}) {
  const calls = []
  const fn = async (url, init) => {
    calls.push({ url, init: plain(init) })
    const hit = typeof routes === 'function' ? routes(url) : routes[url]
    if (hit instanceof Error) throw hit
    return hit ?? jsonAnswer({ error: 'Not found' }, 404)
  }
  fn.calls = calls
  return fn
}
const entry = (id, displayName = 'Quokka Rocket') => ({ id, displayName, packBaseUrl: ROUTE(id) })
const LIST_INIT = { method: 'GET', credentials: 'same-origin', cache: 'no-store' }
class FakeStorage {
  constructor(data = {}) { this.data = { ...data }; this.writes = [] }
  getItem(name) { return Object.prototype.hasOwnProperty.call(this.data, name) ? this.data[name] : null }
  setItem(name, value) { this.writes.push([name, String(value)]); this.data[name] = String(value) }
}
const throwingStorage = () => ({ getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } })
const CALL_SLOT = 'deckster.studio.voiceCompanion' // the voice call's device slot (COMPANION_STORAGE_KEY)

// ---- the route's relative-path rule (CONTRACT.md: what the pack route serves), for the files the player asks for ------------------------------------------
const routeAccepts = rel => {
  const parts = rel.split('/')
  return rel.length <= 200 && parts.length >= 1 && parts.length <= 6 && parts.every(part => /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/.test(part) && part !== '.' && part !== '..') && /\.(json|webp|png)$/.test(parts[parts.length - 1]) && !/[%\\]/.test(rel) && !rel.includes('..')
}

// ============================================================================================================================================
// A. lib/studio-my-companions.ts
// ============================================================================================================================================
console.log('A. the lib')
async function libChecks(texts = {}) {
  const lib = (env = MINE_ON) => bare(LIB, { env, texts })
  const L = lib()
  // -- the flag
  for (const value of SPELLINGS) {
    const flagEnv = value === undefined ? {} : { [FLAG]: value }, on = value === 'true'
    assert.equal(lib({ [SHELL]: 'true', ...flagEnv }).STUDIO_MY_COMPANIONS_ENABLED, on, `flag ${JSON.stringify(value)} with the shell on`)
    assert.equal(L.studioMyCompanionsOn({ [SHELL]: 'true', ...flagEnv }), on, `studioMyCompanionsOn ${JSON.stringify(value)}`)
    assert.equal(lib(flagEnv).STUDIO_MY_COMPANIONS_ENABLED, false, `flag ${JSON.stringify(value)} without the shell is off`)
    assert.equal(lib({ [SHELL]: value ?? '', [FLAG]: 'true' }).STUDIO_MY_COMPANIONS_ENABLED, on, `the shell spelled ${JSON.stringify(value)} with the flag on`)
    assert.equal(lib({ [SHELL]: 'true', [SPAWN_FLAG]: 'true', [VOICE]: 'true', ...(value === undefined ? {} : { [FLAG]: value }) }).STUDIO_MY_COMPANIONS_ENABLED, on, 'the upload mock\'s flag and the call\'s flag do not turn it on')
  }
  assert.equal(lib({}).STUDIO_MY_COMPANIONS_ENABLED, false, 'default: off')
  assert.equal(L.STUDIO_MY_COMPANIONS_FLAG, FLAG)
  const src = code(texts[LIB] ?? read(LIB))
  assert.equal(count(src, 'process.env'), 2, 'two environment reads, the shell and the flag')
  assert.ok(src.includes("process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_MY_COMPANIONS === 'true'"), 'as two literals Next inlines')
  assert.doesNotMatch(src, /\bconsole\b|^\s*import\s|require\(|localStorage|sessionStorage|indexedDB|XMLHttpRequest|sendBeacon|WebSocket/m, 'import-free, no console, no storage of its own, no other transport')
  assert.doesNotMatch(src, /\bfetch\(/, 'no request but through the fetch it is handed')
  // -- ids and the pack root
  assert.equal(L.USER_PACK_ID_PATTERN.source, bare(SPAWN, { env: {} }).PACK_ID_PATTERN.source, 'the user pack id is the spawn mock\'s PACK_ID_PATTERN (u- and 26 of [a-z0-9])')
  assert.deepEqual([L.COMPANIONS_ROUTE, L.PACK_ROUTE_BASE, L.MAX_MY_COMPANIONS], ['/api/avatar/companions', '/api/avatar/pack', 20])
  for (const pack of ['felix', 'bob', 'maya', 'deckster-owl', 'toy-1']) assert.equal(L.packRootUrl(pack), `/companions/${pack}`, `${pack}: the cast's folder, as before`)
  for (const id of [U1, U2, U3]) { assert.equal(L.packRootUrl(id), ROUTE(id), `${id}: the pack route`); assert.equal(L.isUserPackId(id), true) }
  for (const near of NEAR) { assert.equal(L.isUserPackId(near), false, `${JSON.stringify(near)} is not a user pack id`); assert.equal(L.packRootUrl(near), `/companions/${near}`, `${JSON.stringify(near)}: never the pack route`) }
  for (const notText of [null, undefined, 7, {}, [U1]]) assert.equal(L.isUserPackId(notText), false)
  // -- the list's parser, on hostile input
  for (const junk of [null, undefined, 0, 'x', [], [entry(U1)], {}, { companions: null }, { companions: 'x' }, { companions: { 0: entry(U1) } }, { list: [entry(U1)] }]) assert.deepEqual(plain(L.parseMyCompanions(junk)), [], `not the list's shape: ${JSON.stringify(junk)?.slice(0, 40)}`)
  assert.deepEqual(plain(L.parseMyCompanions({ companions: [entry(U1, 'PK')] })), [entry(U1, 'PK')], 'one good entry')
  const hostile = [
    null, 1, 'u-x', [], [entry(U1)], entry(U1),
    { ...entry(U2), id: 'u-abcdefghijklmnopqrstuvwxy', packBaseUrl: ROUTE('u-abcdefghijklmnopqrstuvwxy') }, // 25 characters
    { ...entry(U2), id: U2.toUpperCase(), packBaseUrl: ROUTE(U2.toUpperCase()) }, // upper case
    { ...entry(U2), id: '../maya', packBaseUrl: ROUTE('../maya') },
    { ...entry(U2), packBaseUrl: `${ROUTE(U2)}/` }, { ...entry(U2), packBaseUrl: ROUTE(U3) }, { ...entry(U2), packBaseUrl: '/companions/maya' }, { ...entry(U2), packBaseUrl: `https://storage.test${ROUTE(U2)}` }, { id: U2, displayName: 'x' },
    { ...entry(U2), displayName: '' }, { ...entry(U2), displayName: '   ' }, { ...entry(U2), displayName: 'x'.repeat(41) }, { ...entry(U2), displayName: 7 }, { ...entry(U2), displayName: null },
    { ...entry(U3, '  Night\u0007  Owl\n'), extra: 'dropped', owner: { userId: 'user-a' } },
    entry(U3, 'Second copy'),
    JSON.parse(`{"__proto__": {"id": "${U2}"}, "displayName": "Proto", "packBaseUrl": "${ROUTE(U2)}"}`),
  ]
  const parsed = plain(L.parseMyCompanions({ companions: hostile }))
  assert.deepEqual(parsed, [entry(U1, 'Quokka Rocket'), { id: U3, displayName: 'Night Owl', packBaseUrl: ROUTE(U3) }], 'hostile entries: only well-formed ones, names tidied, extra fields (the owner too) dropped, a second copy of an id dropped')
  assert.deepEqual(Object.keys(parsed[1]).sort(), ['displayName', 'id', 'packBaseUrl'])
  assert.equal(L.parseMyCompanions({ companions: [entry(U1, 'x'.repeat(40))] })[0].displayName.length, 40, 'a 40-character name is kept')
  const many = Array.from({ length: 30 }, (_, i) => entry(`u-${String(i).padStart(2, '0')}${'abcdefghijklmnopqrstuvwx'}`, `Companion ${i}`))
  const kept = L.parseMyCompanions({ companions: many })
  assert.equal(kept.length, 20, 'at most 20'); assert.deepEqual(plain(kept), many.slice(0, 20), 'the first 20, in order')
  const spawn = bare(SPAWN, { env: {} })
  for (const raw of ['PK', '  PK  ', 'a\u0000b', 'x'.repeat(40), 'x'.repeat(41), '', ' ', 7, null, 'tab\tname', 'Zoë Ç']) assert.equal(L.cleanCompanionName(raw), spawn.cleanDisplayName(raw), `the name rule is the spawn mock's: ${JSON.stringify(raw)}`)
  // -- the list request
  const good = { companions: [entry(U1, 'PK'), entry(U2, 'Second')] }
  const f1 = fakeFetch({ '/api/avatar/companions': jsonAnswer(good) })
  assert.deepEqual(plain(await L.fetchMyCompanions(f1)), good.companions, 'a 200 list'); assert.deepEqual(f1.calls, [{ url: '/api/avatar/companions', init: LIST_INIT }], 'ONE request: GET, same-origin credentials, no-store')
  assert.deepEqual(plain(await L.loadMyCompanions(f1)), good.companions)
  assert.deepEqual(plain(await L.loadMyCompanions(fakeFetch({ '/api/avatar/companions': jsonAnswer({ companions: [] }) }))), [], 'an empty list is a list (the page says so), not a failure')
  const failures = {
    'a throwing fetch': Object.assign(() => { throw new Error('offline') }, {}),
    'a rejected fetch': fakeFetch({ '/api/avatar/companions': new TypeError('Failed to fetch') }),
    'the one 404': fakeFetch({}),
    'a 500': fakeFetch({ '/api/avatar/companions': jsonAnswer({ companions: [entry(U1)] }, 500) }),
    'a 302 answer': fakeFetch({ '/api/avatar/companions': jsonAnswer(good, 302) }),
    'a 201 answer': fakeFetch({ '/api/avatar/companions': jsonAnswer(good, 201) }),
    '200 with HTML': fakeFetch({ '/api/avatar/companions': htmlAnswer() }),
    '200 with the wrong JSON': fakeFetch({ '/api/avatar/companions': jsonAnswer({ error: 'x' }) }),
    '200 with JSON null': fakeFetch({ '/api/avatar/companions': jsonAnswer(null) }),
    'an answer whose json() throws at once': async () => ({ status: 200, json() { throw new Error('x') } }),
    'no answer at all': async () => undefined,
    'no fetch': null,
    'not a function': 'fetch',
  }
  for (const [label, fn] of Object.entries(failures)) {
    let list, loaded
    await assert.doesNotReject(async () => { list = await L.fetchMyCompanions(fn); loaded = await L.loadMyCompanions(fn) }, `${label}: never throws`)
    assert.deepEqual(plain(list), [], `${label}: fetchMyCompanions is []`); assert.equal(loaded, null, `${label}: loadMyCompanions is null (a failure)`)
  }
  // -- the pack probe
  const manifest = `${ROUTE(U1)}/motion/manifest.json`
  const probe = async (answer, target) => { const fn = fakeFetch({ [manifest]: answer }); const ok = await L.reachable(fn, target); return { ok, calls: fn.calls } }
  const yes = await probe(jsonAnswer({ version: 2, frames: {} }), entry(U1))
  assert.equal(yes.ok, true, '200 with a JSON object: reachable'); assert.deepEqual(yes.calls, [{ url: manifest, init: { method: 'GET', credentials: 'same-origin' } }], 'one GET of <packBaseUrl>/motion/manifest.json, same-origin')
  for (const [label, answer] of [['404', jsonAnswer({ error: 'Not found' }, 404)], ['500', jsonAnswer({}, 500)], ['302', jsonAnswer({}, 302)], ['200 HTML', htmlAnswer()], ['200 JSON array', jsonAnswer([1])], ['200 JSON null', jsonAnswer(null)], ['200 JSON string', jsonAnswer('manifest')], ['a thrown error', new TypeError('Failed to fetch')]]) {
    let result
    await assert.doesNotReject(async () => { result = await probe(answer, entry(U1)) }, `${label}: never throws`)
    assert.equal(result.ok, false, `${label}: not reachable`)
  }
  for (const target of [null, undefined, {}, { packBaseUrl: '/companions/maya' }, { packBaseUrl: `${ROUTE(U1)}/` }, { packBaseUrl: `https://storage.test${ROUTE(U1)}` }, { packBaseUrl: ROUTE('u-abcdefghijklmnopqrstuvwxy') }, { packBaseUrl: `${ROUTE(U1)}/../../companions` }, { packBaseUrl: ROUTE('../maya') }, { packBaseUrl: 7 }]) {
    const out = await probe(jsonAnswer({}), target)
    assert.deepEqual([out.ok, out.calls.length], [false, 0], `${JSON.stringify(target)}: not a pack-route base: false, and nothing is asked for`)
  }
  assert.equal(await L.reachable(null, entry(U1)), false); assert.equal(await L.reachable(() => { throw new Error('x') }, entry(U1)), false); assert.equal(await L.reachable(async () => undefined, entry(U1)), false, 'no answer at all')
  // -- reachable companions: the list, then a probe each, only the ones that answer, in order
  const world = fakeFetch({ '/api/avatar/companions': jsonAnswer({ companions: [entry(U1, 'PK'), entry(U2, 'Gone'), entry(U3, 'Third')] }), [`${ROUTE(U1)}/motion/manifest.json`]: jsonAnswer({}), [`${ROUTE(U3)}/motion/manifest.json`]: jsonAnswer({}) })
  assert.deepEqual(plain(await L.reachableCompanions(world)), [entry(U1, 'PK'), entry(U3, 'Third')], 'only the reachable ones, in the list\'s order')
  assert.deepEqual(world.calls.map(c => c.url), ['/api/avatar/companions', `${ROUTE(U1)}/motion/manifest.json`, `${ROUTE(U2)}/motion/manifest.json`, `${ROUTE(U3)}/motion/manifest.json`], 'one list request, one probe each')
  const down = fakeFetch({ '/api/avatar/companions': new TypeError('offline') })
  assert.deepEqual([plain(await L.reachableCompanions(down)), down.calls.length], [[], 1], 'no list: none, and no probe')
  assert.deepEqual(plain(await L.reachableCompanions(null)), [])
  // -- names
  const names = L.myCompanionNames([entry(U1, 'PK'), entry(U3, 'Night Owl')])
  assert.deepEqual(plain(names), { [U1]: 'PK', [U3]: 'Night Owl' })
  assert.deepEqual([L.myCompanionName(names, U1), L.myCompanionName(names, U2), L.myCompanionName(names, 'felix'), L.myCompanionName(undefined, U1), L.myCompanionName(null, U1)], ['PK', null, null, null, null])
  assert.equal(L.myCompanionName({ felix: 'Not Felix' }, 'felix'), null, 'a cast pack never takes a name from the list')
  assert.equal(L.myCompanionName(Object.create({ [U1]: 'Inherited' }), U1), null, 'only a name of its own, never an inherited one')
  assert.equal(L.myCompanionName({ [U1]: '' }, U1), null); assert.equal(L.myCompanionName({ [U1]: 7 }, U1), null)
  for (const word of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) assert.equal(L.myCompanionName({}, word), null, `${word}: nothing from Object.prototype`)
  // -- remembering a pick of one of the owner's
  const mine = [entry(U1, 'PK')]
  const store = new FakeStorage()
  assert.equal(L.rememberMyCompanion(store, CALL_SLOT, U1, mine), true); assert.deepEqual(store.writes, [[CALL_SLOT, U1]], 'one of the owner\'s, on offer: remembered in the slot it is handed')
  for (const [label, args] of [['a cast pack', ['bob', mine]], ['a user pack not on offer', [U2, mine]], ['a near miss', [NEAR[0], mine]], ['nothing on offer', [U1, []]]]) {
    const s = new FakeStorage(); assert.equal(L.rememberMyCompanion(s, CALL_SLOT, ...args), false, label); assert.deepEqual(s.writes, [], `${label}: nothing written`)
  }
  assert.equal(L.rememberMyCompanion(throwingStorage(), CALL_SLOT, U1, mine), false, 'storage that throws: false, no throw'); assert.equal(L.rememberMyCompanion(null, CALL_SLOT, U1, mine), false)
}
await check('the lib: the flag (exact "true" with the shell, two literals); the pack root (user ids only, never a near miss); the strict list parser on hostile input (max 20, names tidied); the list request (GET, same-origin, no-store) and the probe (200 JSON object only, never off the pack route), neither ever throws; names (own keys only); remembering a pick; import-free, no console', () => libChecks())

// ============================================================================================================================================
// B. lib/studio-voice-call-ui.ts
// ============================================================================================================================================
console.log('B. the voice call lib')
const VOICE_ENV = { [VOICE]: 'true' }
const committedPacks = fs.readdirSync(path.join(root, 'public/companions')).filter(dir => fs.existsSync(path.join(root, 'public/companions', dir, 'motion/manifest.json'))).sort()
const readDisk = url => { const file = path.join(root, 'public', url); return url.startsWith('/companions/') && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null }
/** Serves a pack's files: the cast from public/companions/; a user pack id from the files of the cast pack `as` (what a private pack holds is the same bird layout). */
const diskFetch = (asked, as = {}) => async url => {
  asked.push(url)
  for (const [id, cast] of Object.entries(as)) if (url.startsWith(`${ROUTE(id)}/`)) { const hit = readDisk(`/companions/${cast}/${url.slice(ROUTE(id).length + 1)}`); if (hit === null) throw new Error('404'); return hit }
  const hit = readDisk(url)
  if (hit === null) throw new Error('404')
  return hit
}
async function uiChecks(texts = {}) {
  assert.equal(typeof bare(UI, { env: VOICE_ENV, texts }).loadCompanionPack, 'function', 'the lib still runs in a bare vm (import-free)')
  const now = makeHost({ env: VOICE_ENV, texts }).load(UI), was = makeHost({ env: VOICE_ENV, texts: { [UI]: BASES[UI] } }).load(UI)
  assert.ok(['bob', 'felix', 'maya'].every(pack => committedPacks.includes(pack)), 'the cast is committed')
  // -- every cast pack: exactly the base's strings and catalogs
  const castNames = [...committedPacks, 'deckster-owl', 'toy-1', 'x', ...NEAR]
  for (const pack of castNames) {
    assert.equal(now.portraitUrl(pack), was.portraitUrl(pack), `${pack}: the portrait is the base's`)
    for (const file of ['scene.webp', 'art/scene-1.png']) assert.equal(now.sceneUrl(pack, file), was.sceneUrl(pack, file), `${pack}: the scene is the base's`)
    for (const framing of ['disc', 'chest', 'full']) {
      const a = [], b = []
      const got = await now.loadCompanionPack(pack, framing, diskFetch(a), raw => raw), want = await was.loadCompanionPack(pack, framing, diskFetch(b), raw => raw)
      assert.deepEqual([plain(got), a], [plain(want), b], `${pack} ${framing}: the same catalog from the same files as the base`)
      recordOff(texts, [now.portraitUrl(pack), now.sceneUrl(pack, 'scene.webp'), a, got], [was.portraitUrl(pack), was.sceneUrl(pack, 'scene.webp'), b, want])
    }
  }
  // synthetic packs (a layered face, a pointer, a refused or missing Face catalog): the same requests and results as the base
  const synthetic = {
    layered: { clips: { lean_in: {} }, frames: {}, face: { pieces: { mouth: {} } } }, pointer: { clips: { lean_in: {} }, frames: {}, face: { manifest: 'face/manifest.json' } }, plainPack: { clips: { lean_in: {} }, frames: {} },
  }
  for (const [kind, body] of Object.entries(synthetic)) {
    for (const faceFails of [false, true]) {
      const serve = asked => async url => { asked.push(url); if (url.endsWith('/motion/manifest.json')) return body; if (faceFails) throw new Error('404'); return { clips: { lean_in: {} }, frames: {}, variant: 'face' } }
      for (const pack of ['bob', 'toy-1']) {
        const a = [], b = []
        assert.deepEqual([plain(await now.loadCompanionPack(pack, 'disc', serve(a), raw => raw)), a], [plain(await was.loadCompanionPack(pack, 'disc', serve(b), raw => raw)), b], `${kind} (Face ${faceFails ? 'missing' : 'there'}) ${pack}: as the base`)
      }
    }
  }
  // -- a user pack id: its files are read from the pack route, through the REAL core parser
  const core = makeHost({ env: VOICE_ENV, texts }).load(CORE)
  for (const id of [U1, U2]) {
    assert.equal(now.portraitUrl(id), `${ROUTE(id)}/portrait-512.webp`, 'the portrait through the pack route')
    assert.equal(now.sceneUrl(id, 'scene.webp'), `${ROUTE(id)}/scene.webp`); assert.equal(now.sceneUrl(id, 'art/sky.png'), `${ROUTE(id)}/art/sky.png`)
    for (const [cast, framing, face] of [['maya', 'chest', null], ['maya', 'full', null], ['maya', 'disc', 'face/manifest.json'], ['bob', 'disc', 'motion/face/manifest.json'], ['bob', 'chest', null], ['felix', 'disc', 'motion/face/manifest.json'], ['felix', 'full', null]]) {
      const asked = [], castAsked = []
      const mine = await now.loadCompanionPack(id, framing, diskFetch(asked, { [id]: cast }), core.parseBirdMotionManifest)
      const theirs = await was.loadCompanionPack(cast, framing, diskFetch(castAsked), core.parseBirdMotionManifest)
      assert.ok(mine && theirs, `${cast} as ${id} ${framing}: a catalog`)
      assert.deepEqual(asked, castAsked.map(url => url.replace(`/companions/${cast}/`, `${ROUTE(id)}/`)), `${cast} as ${id} ${framing}: every request is on the pack route, the same files the cast's are read from`)
      assert.equal(asked[0], `${ROUTE(id)}/motion/manifest.json`); if (face) assert.ok(asked.includes(`${ROUTE(id)}/${face}`), `${cast} as ${id} ${framing}: its Face catalog (${face}) through the route`)
      assert.deepEqual(plain(mine.manifest), plain(theirs.manifest), `${cast} as ${id} ${framing}: the same catalog as the committed pack`)
      assert.deepEqual(plain(mine.layered), plain(theirs.layered))
      assert.equal(mine.base, theirs.base.replace(`/companions/${cast}/`, `${ROUTE(id)}/`), `${cast} as ${id} ${framing}: its frames are read from the pack route`)
      // every file the player would then ask for (frames at base + src, the layered face's pieces at base + piece) is a path the pack route serves
      const files = [...Object.values(mine.manifest.frames ?? {}).map(frame => frame.src)]
      const walk = value => { if (typeof value === 'string' && /\.(webp|png)$/.test(value)) files.push(value); else if (value && typeof value === 'object') Object.values(value).forEach(walk) }
      walk(mine.layered?.pieces)
      assert.ok(files.length > 10, 'frames to check')
      for (const src of files) { const url = `${mine.base}${src}`; assert.ok(url.startsWith(`${ROUTE(id)}/`) && routeAccepts(url.slice(ROUTE(id).length + 1)), `${url}: a path the pack route serves`) }
      assert.ok(routeAccepts(now.portraitUrl(id).slice(ROUTE(id).length + 1)) && routeAccepts(now.sceneUrl(id, 'scene.webp').slice(ROUTE(id).length + 1)))
    }
    assert.equal(await now.loadCompanionPack(id, 'disc', async () => { throw new Error('404') }, core.parseBirdMotionManifest), null, 'a user pack that does not answer: no catalog, no throw (the player shows the portrait, then the initials)')
  }
  // -- the choices
  assert.deepEqual(plain(now.companionChoicesWithMine('felix', [])), ['felix', 'bob', 'maya'], 'none of the owner\'s: the cast')
  assert.deepEqual(plain(now.companionChoicesWithMine('felix', [U1, U2])), ['felix', 'bob', 'maya', U1, U2], 'the cast, then the owner\'s own')
  assert.deepEqual(plain(now.companionChoicesWithMine('deckster-owl', [U1, 'maya', '../x', U1.toUpperCase(), U1, NEAR[0], 7, null])), ['deckster-owl', 'felix', 'bob', 'maya', U1], 'anything that is not a user pack id is left out; none twice')
  for (const fallback of ['felix', 'bob', 'maya', 'deckster-owl']) assert.deepEqual(plain(now.companionChoices(fallback)), plain(was.companionChoices(fallback)), 'companionChoices is the base\'s')
  assert.deepEqual(plain(now.COMPANION_CHOICES), plain(was.COMPANION_CHOICES)); assert.equal(now.COMPANION_STORAGE_KEY, CALL_SLOT)
  // -- the remembered character: two arguments are the base's answers; a third offers the owner's own
  const stores = [{}, { [CALL_SLOT]: 'bob' }, { [CALL_SLOT]: 'maya' }, { [CALL_SLOT]: 'felix' }, { [CALL_SLOT]: '../etc' }, { [CALL_SLOT]: 'toy' }, { [CALL_SLOT]: U1 }, { [CALL_SLOT]: 'Maya' }, { [CALL_SLOT]: 'deckster-owl' }]
  for (const data of stores) for (const fallback of ['felix', 'bob', 'deckster-owl']) assert.equal(now.readCompanionChoice(new FakeStorage(data), fallback), was.readCompanionChoice(new FakeStorage(data), fallback), `two arguments: ${JSON.stringify(data)} / ${fallback}: the base's answer`)
  for (const s of [null, undefined, throwingStorage()]) assert.equal(now.readCompanionChoice(s, 'felix'), 'felix')
  const remembered = new FakeStorage({ [CALL_SLOT]: U1 })
  assert.equal(now.readCompanionChoice(remembered, 'felix', [U1]), U1, 'one of the owner\'s, on offer: believed')
  assert.equal(now.readCompanionChoice(remembered, 'felix', [U2]), 'felix', 'one that is not on offer (gone from the list): the default')
  assert.equal(now.readCompanionChoice(remembered, 'felix', []), 'felix'); assert.equal(now.readCompanionChoice(remembered, 'bob'), 'bob', 'two arguments: a user pack is never believed')
  assert.equal(now.readCompanionChoice(new FakeStorage({ [CALL_SLOT]: 'maya' }), 'felix', [U1]), 'maya', 'a cast choice with the owner\'s on offer: still the cast choice')
  assert.equal(now.readCompanionChoice(new FakeStorage({ [CALL_SLOT]: '../x' }), 'felix', ['../x']), 'felix', 'a stranger handed in as one of the owner\'s is still not believed')
  assert.equal(now.readCompanionChoice(throwingStorage(), 'felix', [U1]), 'felix', 'storage that throws: the default')
  for (const name of ['bob', U1, '../x']) { const a = new FakeStorage(), b = new FakeStorage(); assert.deepEqual([now.writeCompanionChoice(a, name, 'felix'), a.writes], [was.writeCompanionChoice(b, name, 'felix'), b.writes], `writeCompanionChoice(${name}) is the base's (a user pack is refused there)`) }
  // -- the file stays import-free (the bare vm above has no require) and FRONTEND-1's pinned texts are still there, once each
  const src = texts[UI] ?? read(UI)
  assert.doesNotMatch(code(src), /\bfetch\(|^\s*import\s/m, 'no request and no import in the lib')
  for (const pinned of ["main.layered ? `/companions/${pack}/face/manifest.json` : main.pointer", '`/companions/${pack}/portrait-512.webp`', "return typeof stored === 'string' && companionChoices(fallback).includes(stored) ? stored : fallback", 'if (!storage || !companionChoices(fallback).includes(name)) return false']) assert.equal(count(src, pinned), 1, `the voice call proof's pinned text is there once: ${pinned.slice(0, 60)}`)
}
await check('the voice call lib: every committed pack (and any other cast name) gives the base\'s strings and catalogs; a user pack id loads from /api/avatar/pack/<id>/ through the real core parser, and every file the player asks for is a path the route serves; the choices and the remembered character (two arguments: the base\'s answers); import-free; the voice call proof\'s pinned texts kept', () => uiChecks())

// ============================================================================================================================================
// C. The call stage
// ============================================================================================================================================
console.log('C. the call stage')
const SNAP = { active: true, starting: false, phase: 'idle', scene: 'idle', chip: 'Your turn', dance: false, caption: null, progress: null, notice: null, mode: 'audio', muted: false, reducedMotion: false, holding: false, latched: false, transcript: [], controls: { talk: true, stop: false, mute: true, end: true } }
const fakePlayer = ({ pack, framing }) => React.createElement('div', { 'data-fake-player': 'true', 'data-pack': pack, 'data-framing': framing })
const noop = () => {}
const stageProps = (snapshot, extra = {}) => ({ snapshot: { ...SNAP, ...snapshot }, pack: 'bob', choices: ['felix', 'bob', 'maya'], onChooseCompanion: noop, getLevel: () => 0, onTalkPress: noop, onTalkRelease: noop, onStop: noop, onMute: noop, onEnd: noop, onRetry: noop, onDismissNotice: noop, ...extra })
async function withBrowser(fn, { fetchFn = async () => { throw new Error('offline') }, images = [] } = {}) {
  const was = { fetch: globalThis.fetch, Image: globalThis.Image, window: globalThis.window }
  globalThis.window = { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) }
  globalThis.fetch = fetchFn
  globalThis.Image = class { set src(url) { images.push(url); queueMicrotask(() => this.onload?.()) } }
  try { return await fn() } finally { globalThis.fetch = was.fetch; globalThis.Image = was.Image; if (was.window === undefined) delete globalThis.window; else globalThis.window = was.window }
}
async function stageChecks(texts = {}) {
  const stageOf = t => makeHost({ env: VOICE_ENV, texts: t, stubs: { './companion-player': { CompanionPlayer: fakePlayer } } }).load(STAGE)
  await withBrowser(async () => {
    const now = stageOf(texts), was = stageOf(BASE_TEXTS)
    const html = (mod, snapshot, extra) => renderToStaticMarkup(React.createElement(mod.VoiceCallStage, stageProps(snapshot, extra)))
    const transcript = [{ id: 1, who: 'you', text: 'hello' }, { id: 2, who: 'director', text: 'Hi there.' }]
    // -- no names (the flag off): the base's markup, every cast pack, both kinds of call
    for (const pack of committedPacks) for (const choices of [['felix', 'bob', 'maya'], ['felix', 'bob'], [pack]]) for (const snapshot of [{}, { mode: 'video' }, { transcript }, { notice: { kind: 'mic', title: 'x', steps: ['y'], retry: true } }]) {
      const label = `${pack} [${choices}] ${JSON.stringify(snapshot).slice(0, 30)}`
      const mine = html(now, snapshot, { pack, choices }), theirs = html(was, snapshot, { pack, choices })
      assert.equal(mine, theirs, `${label}: the base's markup`)
      recordOff(texts, mine, theirs)
      assert.equal(html(now, snapshot, { pack, choices, names: { felix: 'Not Felix', bob: 'Not Bob', maya: 'Not Maya' } }), html(was, snapshot, { pack, choices }), `${label}: a name for a cast pack is never used`)
    }
    // -- one of the owner's: its display name in the switch, the pager and the transcript; the player is handed its id
    const choices = ['felix', 'bob', 'maya', U1], names = { [U1]: 'Quokka Rocket' }
    const mineHtml = html(now, { transcript }, { pack: U1, choices, names })
    assert.ok(mineHtml.includes(`data-studio-voice-character="${U1}"`) && mineHtml.includes('aria-label="Character: Quokka Rocket. Switch to Felix"') && mineHtml.includes('title="Switch to Felix"'), 'the switch names the owner\'s companion and offers the next (Felix)')
    assert.ok(/<\/svg>Quokka Rocket<span class="studio-voice-pack-dots"/.test(mineHtml), 'the top bar shows its display name')
    assert.ok(mineHtml.includes('<b>Quokka Rocket</b><span>Hi there.</span>') && mineHtml.includes('<b>You</b><span>hello</span>'), 'the transcript names it')
    assert.ok(mineHtml.includes(`data-pack="${U1}"`) && mineHtml.includes(`data-choice="${U1}" data-on="true"`), 'the player gets its id; its pager dot is on')
    assert.ok(!mineHtml.includes(`>${U1}<`) && !mineHtml.includes('U Abcdefghijklmnopqrstuvwxyz'), 'the opaque id is never shown as a name')
    assert.ok(html(now, {}, { pack: 'maya', choices, names }).includes('aria-label="Character: Maya. Switch to Quokka Rocket"'), 'from Maya the switch offers it by name')
    assert.ok(html(now, {}, { pack: U1, choices, names: Object.create({ [U1]: 'Inherited' }) }).includes('Character: U Abcdefghijklmnopqrstuvwxyz.'), 'an inherited name is never used (the cast\'s own words)')
    // -- the scene art (video): the manifest and the image through the pack route for a user pack; the cast's as before
    for (const [pack, mod] of [['bob', now], ['bob', was], [U1, now]]) {
      const asked = [], images = []
      const scene = pack === U1 ? 'art/sky.png' : undefined
      const markup = await withBrowser(async () => {
        const node = new Root(); node.setElement(React.createElement(mod.VoiceCallStage, stageProps({ mode: 'video' }, { pack, choices, names })))
        for (let i = 0; i < 12; i++) { await macro(); node.flush() }
        const out = renderToStaticMarkup(toElements(node.tree)); node.unmount(); return out
      }, { fetchFn: async (url, init) => { asked.push([url, plain(init)]); return { ok: true, status: 200, json: async () => ({ scene }) } }, images })
      const at = pack === U1 ? ROUTE(U1) : '/companions/bob'
      assert.deepEqual(asked, [[`${at}/motion/manifest.json`, { credentials: 'same-origin' }]], `${pack}: the scene's manifest is asked for at ${at}`)
      assert.deepEqual(images, [`${at}/${scene ?? 'scene.webp'}`], `${pack}: the scene image is ${at}/...`)
      assert.ok(markup.includes(`--voice-scene-art:url(&quot;${at}/${scene ?? 'scene.webp'}&quot;)`), `${pack}: drawn as the scene`)
    }
  })
}
await check('the call stage: with no names it is the base\'s markup for every cast pack (a name for a cast pack is never used); one of the owner\'s goes by its display name in the switch, the pager and the transcript; its scene art is read through the pack route', () => stageChecks())

// ============================================================================================================================================
// D. The call hook
// ============================================================================================================================================
console.log('D. the call hook')
/** Mounts the REAL hook (or the base's) in the offline host with the controller, the browser adapters and the stage stubbed; `win` is the page's window (fetch, localStorage). */
async function mountHook({ env, texts = {}, win, enabled = true }) {
  const calls = { controllers: [] }
  const stubs = {
    '@/components/builder/voice-call/voice-call-stage': { VoiceCallStage: function FakeStage() { return null } },
    '@/lib/studio-voice-call-controller': { VoiceCallController: class {
      constructor(o) { calls.controllers.push(o); this.subscribe = () => () => {}; this.getSnapshot = () => ({ active: true, starting: false, notice: null, mode: 'audio' }); this.onFrame = noop; this.onSent = noop; this.dispose = noop; this.endCall = noop; this.getLevel = () => 0; this.startCall = async () => {}; this.talkPress = noop; this.talkRelease = noop; this.pttUp = async () => {}; this.stop = noop; this.setMuted = noop; this.dismissNotice = noop }
    } },
    '@/lib/studio-voice-call-browser': { browserVoiceEnv: () => ({}), browserVoicePort: () => ({}) },
  }
  const was = globalThis.window
  globalThis.window = { addEventListener: noop, removeEventListener: noop, ...win }
  const mod = makeHost({ env, texts, stubs }).load(HOOK)
  let latest = null
  function Page() { latest = mod.useStudioVoiceCall({ enabled, sendTurn: noop, sendAction: noop, sessionKey: 's1', connected: true }); return null }
  const node = new Root(); node.setElement(React.createElement(Page))
  const settle = async () => { for (let i = 0; i < 12; i++) { await macro(); node.flush() } }
  await settle()
  return {
    latest: () => latest, settle,
    tap: async () => { latest.dock.props.onChooseCompanion(); node.schedule(); await settle() },
    done: () => { node.unmount(); if (was === undefined) delete globalThis.window; else globalThis.window = was },
  }
}
const dockOf = run => { const dock = run.latest().dock; return dock ? { pack: dock.props.pack, choices: plain(dock.props.choices), names: plain(dock.props.names) } : null }
async function hookChecks(texts = {}) {
  const ON = { [VOICE]: 'true', ...MINE_ON }
  // -- flag off (every way it can be off): no request at all, CHOICES itself, and tap for tap the base hook's props and storage writes
  for (const env of [{ [VOICE]: 'true' }, { [VOICE]: 'true', [SHELL]: 'true' }, { [VOICE]: 'true', [FLAG]: 'true' }, { [VOICE]: 'true', [SHELL]: 'true', [FLAG]: 'TRUE' }, { [VOICE]: 'true', [SHELL]: 'true', [SPAWN_FLAG]: 'true' }]) {
    for (const data of [{}, { [CALL_SLOT]: 'maya' }, { [CALL_SLOT]: U1 }]) {
      const trace = async t => {
        const fetchFn = fakeFetch({ '/api/avatar/companions': jsonAnswer({ companions: [entry(U1)] }) }), localStorage = new FakeStorage(data)
        const run = await mountHook({ env, texts: t, win: { fetch: fetchFn, localStorage } })
        try {
          const seen = [dockOf(run)]
          const first = run.latest().dock.props.choices
          for (let i = 0; i < 4; i++) { await run.tap(); seen.push(dockOf(run)) }
          return { seen, writes: localStorage.writes, requests: fetchFn.calls.length, same: first === run.latest().dock.props.choices }
        } finally { run.done() }
      }
      const now = await trace(texts), was = await trace(BASE_TEXTS)
      const label = `${JSON.stringify(env)} ${JSON.stringify(data)}`
      assert.equal(now.requests, 0, `${label}: nothing is asked for`)
      assert.deepEqual(now.seen, was.seen, `${label}: the stage gets the base hook's character and choices, tap for tap (no names)`)
      assert.deepEqual(now.writes, was.writes, `${label}: the device gets the base hook's writes`)
      assert.equal(now.same, true, `${label}: the choices are the CHOICES constant itself (the same array every render)`)
      assert.deepEqual(now.seen[0].choices, ['felix', 'bob', 'maya'])
      recordOff(texts, [now.seen, now.writes], [was.seen, was.writes])
    }
  }
  // -- the hook not enabled (the Studio shell off on the page): nothing is asked for even with the flag on
  {
    const fetchFn = fakeFetch({}), run = await mountHook({ env: ON, texts, enabled: false, win: { fetch: fetchFn, localStorage: new FakeStorage() } })
    assert.deepEqual([run.latest().dock, fetchFn.calls.length], [null, 0], 'enabled false: no dock and no request'); run.done()
  }
  // -- flag on: one list request, a probe each, only reachable ones offered, with their names
  const LIST = { companions: [entry(U1, 'Quokka Rocket'), entry(U2, 'Unreachable')] }
  const world = (list = LIST) => fakeFetch({ '/api/avatar/companions': jsonAnswer(list), [`${ROUTE(U1)}/motion/manifest.json`]: jsonAnswer({ version: 2 }), [`${ROUTE(U2)}/motion/manifest.json`]: jsonAnswer({ error: 'Not found' }, 404) })
  {
    const fetchFn = world(), localStorage = new FakeStorage()
    const run = await mountHook({ env: ON, texts, win: { fetch: fetchFn, localStorage } })
    assert.deepEqual(fetchFn.calls, [{ url: '/api/avatar/companions', init: LIST_INIT }, { url: `${ROUTE(U1)}/motion/manifest.json`, init: { method: 'GET', credentials: 'same-origin' } }, { url: `${ROUTE(U2)}/motion/manifest.json`, init: { method: 'GET', credentials: 'same-origin' } }], 'ONE list request (GET, same-origin, no-store), then one probe per companion')
    assert.deepEqual(dockOf(run), { pack: 'felix', choices: ['felix', 'bob', 'maya', U1], names: { [U1]: 'Quokka Rocket' } }, 'the switch offers the cast, then the reachable one (by name); the unreachable one never reaches it')
    const packs = []
    for (let i = 0; i < 4; i++) { await run.tap(); packs.push(run.latest().dock.props.pack) }
    assert.deepEqual(packs, ['bob', 'maya', U1, 'felix'], 'one tap at a time goes round the cast and the owner\'s own')
    assert.deepEqual(localStorage.writes, [[CALL_SLOT, 'bob'], [CALL_SLOT, 'maya'], [CALL_SLOT, U1], [CALL_SLOT, 'felix']], 'every pick is remembered on the device, the owner\'s own too')
    await run.settle(); assert.equal(fetchFn.calls.length, 3, 'asked once: no second list request on later renders'); run.done()
  }
  // -- the remembered character, read again once the list is known
  for (const [label, data, list, want] of [
    ['a remembered pack of the owner\'s, reachable', { [CALL_SLOT]: U1 }, LIST, U1],
    ['a remembered pack that is not reachable', { [CALL_SLOT]: U2 }, LIST, 'felix'],
    ['a remembered pack that is gone from the list', { [CALL_SLOT]: U1 }, { companions: [] }, 'felix'],
    ['a remembered pack, the list failing', { [CALL_SLOT]: U1 }, null, 'felix'],
    ['a remembered cast pack', { [CALL_SLOT]: 'maya' }, LIST, 'maya'],
  ]) {
    const fetchFn = list === null ? fakeFetch({ '/api/avatar/companions': new TypeError('offline') }) : world(list)
    const run = await mountHook({ env: ON, texts, win: { fetch: fetchFn, localStorage: new FakeStorage(data) } })
    assert.equal(run.latest().dock.props.pack, want, `${label}: ${want}`)
    if (list !== LIST) assert.deepEqual(dockOf(run).choices, ['felix', 'bob', 'maya'], `${label}: the cast alone`)
    run.done()
  }
  // -- no fetch in the page, blocked storage: the cast, no throw
  {
    const run = await mountHook({ env: ON, texts, win: { localStorage: null } })
    assert.deepEqual(dockOf(run), { pack: 'felix', choices: ['felix', 'bob', 'maya'], names: undefined }, 'no fetch at all: the cast'); run.done()
  }
  // -- unmounted before the list arrives: nothing is set afterwards (no error)
  {
    let answer
    const slow = Object.assign(async url => { if (url === '/api/avatar/companions') return new Promise(resolve => { answer = resolve }); return jsonAnswer({}) }, {})
    const run = await mountHook({ env: ON, texts, win: { fetch: slow, localStorage: new FakeStorage() } })
    run.done(); answer(jsonAnswer(LIST)); await macro(); await macro()
  }
  // -- the source: the route is never named in the hook, it makes no request of its own, and the lib is called only inside the flag's guard
  const src = code(texts[HOOK] ?? read(HOOK))
  assert.doesNotMatch(src, /\/api\/avatar|\bfetch\(|NEXT_PUBLIC_STUDIO_MY_COMPANIONS/, 'the hook names no route, makes no request itself and does not read the flag (the lib does)')
  const guard = src.indexOf('if (!enabled || !STUDIO_MY_COMPANIONS_ENABLED) return'), asks = src.indexOf('reachableCompanions(')
  assert.ok(guard > 0 && asks > guard && count(src, 'reachableCompanions(') === 1 && !/fetchMyCompanions\(|loadMyCompanions\(|reachable\(/.test(src), 'the one call that asks is after the guard (flag off: never)')
  assert.ok(src.slice(guard, asks).split('\n').length <= 4 && !src.slice(guard, asks).includes('}, ['), '...inside the same effect')
}
await check('the call hook: flag off (every way) nothing is asked for and the stage gets CHOICES itself, the base hook\'s props and storage writes tap for tap; flag on, ONE list request and a probe each, only reachable companions offered (with names), the remembered one read again (gone or unreachable: the default), every pick remembered', () => hookChecks())

// ============================================================================================================================================
// E. The page
// ============================================================================================================================================
console.log('E. the page')
const NO_CONTROLS = /<button|<input|type="file"|<form|<select|<textarea|>\s*(Pick|Picked|Create my avatar|Delete|Delete companion|Save companion)\s*</
async function pageChecks(texts = {}) {
  const viewOf = env => makeHost({ env, texts }).load(VIEW)
  const view = viewOf(MINE_ON)
  const html = v => renderToStaticMarkup(React.createElement(view.MyCompanionsList, { view: v }))
  const wrapped = markup => /^(<link rel="preload" as="image"[^>]*>)*<main class="mx-auto max-w-2xl p-6" data-testid="studio-my-companions-page"><h1 class="text-2xl font-semibold">My companions<\/h1><div data-studio-avatar-spawn="true"><section class="sas-card"/.test(markup) && markup.endsWith('</section></div></main>') // (react-dom's own image preload hint may come first)
  const loading = html({ state: 'loading' }), one = html({ state: 'ready', entries: [entry(U1, 'Quokka Rocket')] }), empty = html({ state: 'ready', entries: [] }), error = html({ state: 'error' })
  for (const [label, markup] of [['loading', loading], ['one entry', one], ['empty', empty], ['error', error]]) {
    assert.ok(wrapped(markup), `${label}: "My companions", wrapped so the mock's stylesheet applies`)
    assert.doesNotMatch(markup, NO_CONTROLS, `${label}: no button, no input, no file, no Pick / Create / Delete`)
  }
  assert.ok(loading.includes('data-sas-part="loading"') && loading.includes('Loading…') && loading.includes('aria-busy="true"'), 'loading: a loading note')
  assert.ok(one.includes(`data-sas-companion="${U1}"`) && one.includes('<span class="sas-name">Quokka Rocket</span>') && one.includes(`src="${ROUTE(U1)}/portrait-512.webp"`) && one.includes('class="sas-thumb"'), 'one entry: its name and its portrait through the pack route')
  assert.ok(!one.includes('data-sas-part="empty"') && !one.includes('data-sas-part="loading"') && !one.includes('data-sas-part="error"'))
  assert.ok(empty.includes('data-sas-part="empty"') && empty.includes('You have no companions of your own yet.') && !empty.includes('<ul'), 'empty: the empty note')
  assert.ok(error.includes('data-sas-part="error"') && error.includes('role="alert"') && /could not be loaded/.test(error) && !error.includes('<ul'), 'error: a plain error note')
  const two = html({ state: 'ready', entries: [entry(U1, 'A <b>bold</b> name'), entry(U2, 'Second')] })
  assert.ok(two.includes('A &lt;b&gt;bold&lt;/b&gt; name') && (two.match(/<li /g) ?? []).length === 2, 'names are text (escaped), one row each')
  // -- the thumb falls back to Felix's portrait when the pack's does not load (the mock's CompanionThumb)
  {
    const node = new Root(); node.setElement(React.createElement(view.MyCompanionsList, { view: { state: 'ready', entries: [entry(U1)] } })); node.flush()
    const img = () => { const found = []; const walk = n => { if (!n) return; if (n.t === 'host' && n.type === 'img') found.push(n); (n.children ?? []).forEach(walk); if (n.t === 'comp') walk(n.child) }; walk(node.tree); return found[0] }
    assert.equal(img().props.src, `${ROUTE(U1)}/portrait-512.webp`); img().props.onError(); node.flush()
    assert.equal(img().props.src, '/companions/felix/portrait-512.webp', 'the thumb steps to Felix\'s portrait'); node.unmount()
  }
  // -- the container: loading first, then the list from the lib (one GET), or the empty note, or the error note
  const drive = async (fetchFn, env = MINE_ON) => {
    const mod = viewOf(env), node = new Root(); node.setElement(React.createElement(mod.MyCompanionsPage, { fetchFn })); node.flush()
    const first = renderToStaticMarkup(toElements(node.tree))
    for (let i = 0; i < 8; i++) { await macro(); node.flush() }
    const after = renderToStaticMarkup(toElements(node.tree)); node.unmount(); return { first, after }
  }
  const listFetch = fakeFetch({ '/api/avatar/companions': jsonAnswer({ companions: [entry(U1, 'Quokka Rocket'), { id: 'bad' }] }) })
  const shown = await drive(listFetch)
  assert.ok(shown.first.includes('data-sas-part="loading"'), 'the container starts on the loading note')
  assert.ok(shown.after.includes('<span class="sas-name">Quokka Rocket</span>') && !shown.after.includes('data-sas-part="loading"') && (shown.after.match(/<li /g) ?? []).length === 1, 'then the owner\'s list (a bad entry dropped)')
  assert.deepEqual(listFetch.calls, [{ url: '/api/avatar/companions', init: LIST_INIT }], 'one GET of the list, nothing else (no probe: a thumb that fails is Felix)')
  assert.ok((await drive(fakeFetch({ '/api/avatar/companions': jsonAnswer({ companions: [] }) }))).after.includes('data-sas-part="empty"'), 'an empty list: the empty note')
  for (const [label, fn] of [['the one 404', fakeFetch({})], ['a thrown error', fakeFetch({ '/api/avatar/companions': new TypeError('offline') })], ['200 HTML', fakeFetch({ '/api/avatar/companions': htmlAnswer() })], ['the wrong shape', fakeFetch({ '/api/avatar/companions': jsonAnswer({ error: 'x' }) })]]) assert.ok((await drive(fn)).after.includes('data-sas-part="error"'), `${label}: the error note`)
  // the browser's own fetch when none is handed in
  {
    const fetchFn = fakeFetch({ '/api/avatar/companions': jsonAnswer({ companions: [entry(U2, 'From the window')] }) }), was = globalThis.window
    globalThis.window = { fetch: fetchFn }
    try { assert.ok((await drive(undefined)).after.includes('From the window'), 'no fetch handed in: the window\'s'); assert.equal(fetchFn.calls.length, 1) } finally { if (was === undefined) delete globalThis.window; else globalThis.window = was }
  }
  // flag off: the component is nothing and asks nothing
  for (const env of [{}, { [FLAG]: 'true' }, { [SHELL]: 'true' }, { [SHELL]: 'true', [FLAG]: '1' }, { [SHELL]: 'true', [SPAWN_FLAG]: 'true' }]) {
    const fn = fakeFetch({}), out = await drive(fn, env)
    assert.deepEqual([out.first, out.after, fn.calls.length], ['', '', 0], `${JSON.stringify(env)}: <MyCompanionsPage /> is null and asks nothing`)
  }
  const viewSrc = code(texts[VIEW] ?? read(VIEW))
  assert.doesNotMatch(viewSrc, /\bconsole\b|\bfetch\(|localStorage|sessionStorage|\/api\/avatar|<button|<input|<form/, 'the page component: no console, no request of its own, no storage, no route named, no control')
  // -- the route's flag matrix
  const stubs = { 'next/navigation': { notFound() { throw new Error('NEXT_NOT_FOUND') } }, '@/hooks/use-auth': { useAuth: () => ({ user: { id: 'user-a' } }) } }
  const route = (env, t = texts) => renderToStaticMarkup(React.createElement(makeHost({ env, texts: t, stubs }).load(PAGE).default))
  for (const env of [{}, { [SHELL]: 'true' }, { [FLAG]: 'true' }, { [SPAWN_FLAG]: 'true', [FLAG]: 'true' }, { [SHELL]: 'true', [FLAG]: '1' }, { [SHELL]: 'TRUE', [FLAG]: 'true', [SPAWN_FLAG]: 'true' }, { [SHELL]: 'true', [FLAG]: 'false', [SPAWN_FLAG]: 'false' }]) {
    assert.throws(() => route(env), /NEXT_NOT_FOUND/, `${JSON.stringify(env)}: 404`)
    assert.throws(() => route(env, BASE_TEXTS), /NEXT_NOT_FOUND/, `${JSON.stringify(env)}: 404 on the base too`)
  }
  for (const env of [{ [SHELL]: 'true', [SPAWN_FLAG]: 'true' }, { [SHELL]: 'true', [SPAWN_FLAG]: 'true', [FLAG]: 'TRUE' }]) {
    const out = route(env), base = route(env, BASE_TEXTS)
    assert.equal(out, base, `${JSON.stringify(env)}: the upload mock alone: the base page's markup`)
    recordOff(texts, out, base)
    assert.ok(out.includes('data-testid="studio-companions-page"') && out.includes('Create my avatar'))
  }
  for (const env of [MINE_ON, { ...MINE_ON, [SPAWN_FLAG]: 'true' }]) {
    const out = route(env)
    assert.ok(out.includes('data-testid="studio-my-companions-page"') && out.includes('data-sas-part="loading"') && !out.includes('data-testid="studio-companions-page"'), `${JSON.stringify(env)}: the owner's list (it wins over the upload mock)`)
    assert.doesNotMatch(out, NO_CONTROLS, `${JSON.stringify(env)}: no upload, no create, no delete`)
  }
  assert.equal((texts[PAGE] ?? read(PAGE)).split('\n')[0], '"use client"'); assert.equal((texts[VIEW] ?? read(VIEW)).split('\n')[0], "'use client'")
}
await check('the page: list only (no button, input, file, Pick, Create or Delete); loading / one entry (thumb through the pack route, Felix when it fails) / empty / error; the container drives them from one GET; flag off it is nothing; the route: off 404, the upload mock alone the base page, mine (alone or with the mock) the list', () => pageChecks())

await check('flag off, hashed: every output the flag-off runs produced (the lib\'s strings and catalogs, the stage\'s markup, the hook\'s props and writes, the page) hashes to the base\'s', () => {
  const hash = list => crypto.createHash('sha256').update(list.join('\n\u0000')).digest('hex')
  assert.ok(flagOff.now.length > 100, `outputs recorded (${flagOff.now.length})`)
  assert.equal(hash(flagOff.now), hash(flagOff.base), 'the same hash')
  console.log(`  flag-off outputs: ${flagOff.now.length}, sha256 ${hash(flagOff.now)} (base ${hash(flagOff.base)})`)
})

// ============================================================================================================================================
// F. Mutants
// ============================================================================================================================================
console.log('F. mutants')
let caught = 0
const missed = []
class SwapError extends Error {}
const swap = (text, from, to) => { if (text.split(from).length !== 2) throw new SwapError(`exactly one ${JSON.stringify(from.slice(0, 90))} (found ${text.split(from).length - 1})`); return text.replace(from, () => to) }
async function mutant(label, rel, from, to, suite) {
  try {
    const texts = { [rel]: swap(read(rel), from, to) }
    compile(texts[rel], rel)
    await suite(texts)
    missed.push(label); console.error(`MISSED mutant ${label}`)
  } catch (error) {
    if (error instanceof SwapError || error?.code !== 'ERR_ASSERTION') { missed.push(label); console.error(`MISSED mutant ${label}: it did not fail an assertion (${String(error?.message ?? error).slice(0, 200)})`) } else { caught++; console.log(`CAUGHT mutant ${label}  [${String(error.message).replace(/\s+/g, ' ').slice(0, 110)}]`) }
  }
}
const MUTANTS = [
  ['lib: the flag is on for anything but "false"', LIB, "process.env.NEXT_PUBLIC_STUDIO_MY_COMPANIONS === 'true'", "process.env.NEXT_PUBLIC_STUDIO_MY_COMPANIONS !== 'false'", libChecks],
  ['lib: the flag needs no Studio shell', LIB, "export const STUDIO_MY_COMPANIONS_ENABLED = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && ", 'export const STUDIO_MY_COMPANIONS_ENABLED = ', libChecks],
  ['lib: a user pack id may be 20 to 30 characters', LIB, 'export const USER_PACK_ID_PATTERN = /^u-[a-z0-9]{26}$/', 'export const USER_PACK_ID_PATTERN = /^u-[a-z0-9]{20,30}$/', libChecks],
  ['lib: a user pack id may be upper case', LIB, 'export const USER_PACK_ID_PATTERN = /^u-[a-z0-9]{26}$/', 'export const USER_PACK_ID_PATTERN = /^u-[a-z0-9]{26}$/i', libChecks],
  ['lib: a user pack is read from /companions', LIB, 'return isUserPackId(pack) ? `${PACK_ROUTE_BASE}/${pack}` : `/companions/${pack}`', 'return `/companions/${pack}`', libChecks],
  ['lib: the list takes any base URL', LIB, " || packBaseUrl !== `${PACK_ROUTE_BASE}/${id}`) continue", ') continue', libChecks],
  ['lib: the list has no cap', LIB, '    if (out.length >= MAX_MY_COMPANIONS) break\n', '', libChecks],
  ['lib: the list keeps a second copy of an id', LIB, ' || out.some(entry => entry.id === id)) continue', ') continue', libChecks],
  ['lib: the names are not tidied', LIB, 'out.push({ id, displayName: name, packBaseUrl })', 'out.push({ id, displayName: displayName as string, packBaseUrl })', libChecks],
  ['lib: the list is asked for without the cookies', LIB, "{ method: 'GET', credentials: 'same-origin', cache: 'no-store' }", "{ method: 'GET', cache: 'no-store' }", libChecks],
  ['lib: the list may come from a cache', LIB, "{ method: 'GET', credentials: 'same-origin', cache: 'no-store' }", "{ method: 'GET', credentials: 'same-origin' }", libChecks],
  ['lib: any status is a list', LIB, '    if (!response || response.status !== 200) return null\n', '    if (!response) return null\n', libChecks],
  ['lib: a failed list request throws', LIB, '  } catch {\n    return null\n  }', '  } catch (error) {\n    throw error\n  }', libChecks],
  ['lib: any 200 is a pack', LIB, '    return isRecord(await response.json())\n', '    return true\n', libChecks],
  ['lib: a 404 probe is a pack', LIB, '    if (!response || response.status !== 200) return false\n', '    if (!response) return false\n', libChecks],
  ['lib: the probe goes off the pack route', LIB, '    if (!isUserPackId(id)) return false\n', '', libChecks],
  ['lib: unreachable companions are kept', LIB, 'return list.filter((_, at) => answers[at] === true)', 'return list', libChecks],
  ['lib: an inherited name is used', LIB, " || !Object.prototype.hasOwnProperty.call(names, pack)) return null", ') return null', libChecks],
  ['lib: any pack is remembered', LIB, ' || !mine.some(entry => entry.id === pack)) return false', ') return false', libChecks],
  ['ui: a user pack is read from /companions', UI, 'const packRoot = (pack: string): string => (USER_PACK_ID.test(pack) ? `/api/avatar/pack/${pack}` : `/companions/${pack}`)', 'const packRoot = (pack: string): string => `/companions/${pack}`', uiChecks],
  ['ui: every pack is read from the pack route', UI, 'const packRoot = (pack: string): string => (USER_PACK_ID.test(pack) ? `/api/avatar/pack/${pack}` : `/companions/${pack}`)', 'const packRoot = (pack: string): string => `/api/avatar/pack/${pack}`', uiChecks],
  ['ui: a user pack\'s portrait is at /companions', UI, '(USER_PACK_ID.test(pack) ? `${packRoot(pack)}/portrait-512.webp` : ', '(false ? `${packRoot(pack)}/portrait-512.webp` : ', uiChecks],
  ['ui: a user pack\'s layered face is at /companions', UI, 'main.layered && USER_PACK_ID.test(pack) ? `${packRoot(pack)}/face/manifest.json`', 'false ? `${packRoot(pack)}/face/manifest.json`', uiChecks],
  ['ui: the choices take anything', UI, '...mine.filter(id => typeof id === \'string\' && USER_PACK_ID.test(id))', '...mine', uiChecks],
  ['ui: any stored user pack is believed', UI, '&& mine.length > 0 && companionChoicesWithMine(fallback, mine).includes(stored)) return stored', '&& USER_PACK_ID.test(stored)) return stored', uiChecks],
  ['stage: the names are never used', STAGE, 'myCompanionName(names, choice) ?? castCompanionName(choice)', 'castCompanionName(choice)', stageChecks],
  ['stage: a name for a cast pack is used', STAGE, 'myCompanionName(names, choice) ?? castCompanionName(choice)', '(names && Object.prototype.hasOwnProperty.call(names, choice) ? names[choice] : null) ?? castCompanionName(choice)', stageChecks],
  ['stage: the scene\'s manifest is read from /companions', STAGE, 'await fetch(`${packRootUrl(pack)}/motion/manifest.json`', 'await fetch(`/companions/${pack}/motion/manifest.json`', stageChecks],
  ['hook: the list is asked for with the flag off', HOOK, '    if (!enabled || !STUDIO_MY_COMPANIONS_ENABLED) return // MY-COMPANIONS\n', '    if (!enabled) return // MY-COMPANIONS\n', hookChecks],
  ['hook: unreachable companions are offered', HOOK, 'void reachableCompanions(get).then(found => {', 'void import(\'@/lib/studio-my-companions\').then(lib => lib.fetchMyCompanions(get)).then(found => {', hookChecks],
  ['hook: the remembered character is not read again', HOOK, '      setCompanion(readCompanionChoice(deviceStorage(), STUDIO_VOICE_COMPANION, found.map(entry => entry.id))) // MY-COMPANIONS\n', '', hookChecks],
  ['hook: a pick of the owner\'s is not remembered', HOOK, 'rememberMyCompanion(deviceStorage(), COMPANION_STORAGE_KEY, next, mine); ', '', hookChecks],
  ['hook: the owner\'s are not offered', HOOK, 'snapshot, pack: companion, choices, names,', 'snapshot, pack: companion, choices: CHOICES, names,', hookChecks],
  ['hook: flag off, the choices are a new array', HOOK, ': CHOICES // MY-COMPANIONS', ': companionChoicesWithMine(STUDIO_VOICE_COMPANION, []) // MY-COMPANIONS', hookChecks],
  ['hook: the list is asked for on every render', HOOK, '  }, [enabled]) // MY-COMPANIONS\n', '  }) // MY-COMPANIONS\n', hookChecks],
  ['page: a failed list reads as empty', VIEW, "list ? { state: 'ready', entries: list } : { state: 'error' }", "{ state: 'ready', entries: list ?? [] }", pageChecks],
  ['page: a Delete button', VIEW, '<span className="sas-name">{entry.displayName}</span>', '<span className="sas-name">{entry.displayName}</span><button type="button" className="sas-danger">Delete</button>', pageChecks],
  ['page: no empty note', VIEW, "{view.state === 'ready' && view.entries.length === 0 ? <p className=\"sas-note\" data-sas-part=\"empty\">{MY_COMPANIONS_EMPTY}</p> : null}", '', pageChecks],
  ['page: the component draws with the flag off', VIEW, '  if (!STUDIO_MY_COMPANIONS_ENABLED) return null\n', '', pageChecks],
  ['route: the upload mock wins when both are on', PAGE, 'if (STUDIO_MY_COMPANIONS_ENABLED) return <MyCompanionsPage />', 'if (STUDIO_MY_COMPANIONS_ENABLED && !STUDIO_AVATAR_SPAWN_ENABLED) return <MyCompanionsPage />', pageChecks],
  ['route: the list is drawn with every flag off', PAGE, 'if (STUDIO_MY_COMPANIONS_ENABLED) return <MyCompanionsPage />', 'if (true) return <MyCompanionsPage />', pageChecks],
]
for (const [label, rel, from, to, suite] of MUTANTS) await mutant(label, rel, from, to, suite)
console.log(`mutants: ${caught} caught of ${MUTANTS.length}`)
await check(`every mutant is caught (${MUTANTS.length})`, () => { assert.deepEqual(missed, []); assert.equal(caught, MUTANTS.length); assert.ok(MUTANTS.length >= 20) })

release()
console.log(`\n${passed} passed, ${failed.length} failed`)
if (failed.length) { console.error(`FAILED: ${failed.join(' | ')}`); process.exit(1) }
console.log('OK studio my companions')
