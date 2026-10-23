// FRONTEND-2, BY10: Studio's narration model calls through the model router (server flag NARRATION_VIA_ROUTER, only the string "true", default off).
// Run: node scripts/test-studio-narration-router.mjs   (plain node: transpile + vm, no network, no install; `git show` reads the base commit)
//
// What runs for real: lib/narration/model-router.ts, draft.ts, tts.ts and spoken.ts, evaluated from the working tree with a stubbed fetch and a recording env.
// The base's own draft.ts / tts.ts / spoken.ts (git show of the commit this branched from) run through the same scenarios, so "flag off" is compared to what
// shipped, not to a model of it. The four routes are held to the base by an inverse edit (undo only the new lines and the base text comes back byte for byte).
//
// What it proves:
//   1  flag off (every spelling that is not exactly "true", router variables set or not): the same requests as the base (URL, method, headers in order, body), the same
//      outcomes, the router variables never read, no signal added; the sha256 of the canonical record is printed for base and branch
//   2  flag on: POST {router}/v1/chat/completions and /v1/audio/speech and GET /v1/generation, the exact headers, bodies byte-identical to the direct ones (all 9 voices),
//      the long timeouts, no X-MR-Group, the router key only in Authorization
//   3  the fallback table (draft and speech): direct ONLY on a connect failure, a router 401/403, or a 502/503/504 without an error object, and only while OPENROUTER_API_KEY
//      exists; a read timeout, a reset after sending, 429, any other status and any router error object are final (one call, never a second charge)
//   4  X-MR-* ids: opaque ids only (an e-mail is never sent); 5 a missing or unusable router variable is the base's direct call, logged once without values
//   6  no key value in any log line or error message; 7 the wiring (routes, spoken lines, .env.example, package.json)
//   8  the stack: this change sits on #473 (model catalog) on #472 on #470 on 8d5c494, i.e. 13c90ea. Its block and line come out through scripts/studio-narration-router-strip.mjs and give back
//      13c90ea's .env.example and package.json byte for byte, the block sits after #473's block and before PASS2 ADMIN, and the committed tree differs from 13c90ea in this change's files only
//      (scripts/studio-stack-tolerant.mjs: only this change's frozen files, its path family and its declared stack; a later PR's files are ignored with a count, and package.json may keep a later PR's lines)
// then a mutation check: every mutant of the new code must fail at least one check.
import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'
import { sameAsBase } from './studio-env-append-tolerant.mjs' // the .env.example rule that takes a later change's block, for the pins that hold the file to an earlier commit

const repoRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const nodeRequire = createRequire(import.meta.url)
// The base this change is stacked on: #473 (model catalog) at 13c90ea, which holds #472, #470 and studio-v4-dev-preparation-code at 8d5c494. lib/narration/ and app/api/narration/ are the same text there as at fae9620 (where
// this change branched), so the flag-off comparison is unchanged; .env.example and package.json are held to 13c90ea through scripts/studio-narration-router-strip.mjs (this change's block and line come out).
const BASE_COMMIT = '13c90ea9c94dc2b426c98bf775b870f890b99fab'

const LIB = 'lib/narration/model-router.ts'
const DRAFT = 'lib/narration/draft.ts'
const TTS = 'lib/narration/tts.ts'
const SPOKEN = 'lib/narration/spoken.ts'
const VOICES = 'lib/narration/voices.ts'
const BUDGET = 'lib/narration/budget.ts'
const WAV = 'lib/narration/wav.ts'
const MEDIA_STORE = 'lib/narration/media-store.ts' // replaced by a stub: the real one needs Supabase
const R_SCRIPT = 'app/api/narration/script/route.ts'
const R_RENDER = 'app/api/narration/render/route.ts'
const R_SPEAK = 'app/api/narration/speak/route.ts'
const R_SAMPLE = 'app/api/narration/voice/sample/[voiceId]/route.ts'
const ENV = '.env.example'
const PKG = 'package.json'
const STRIP = 'scripts/studio-narration-router-strip.mjs'
const HARNESS = 'scripts/studio-library-manage-harness.mjs'
const STACK_TOLERANT = 'scripts/studio-stack-tolerant.mjs' // the scope and shared-file rules for a tree that holds later PRs too (read from its text, so the mutants below can edit it)
const NR_PKG_CHANGES = [['    "test:studio-narration-router": "node scripts/test-studio-narration-router.mjs"', '']] // this change's one package.json line

const tryRead = rel => { try { return fs.readFileSync(path.join(repoRoot, rel), 'utf8') } catch { return null } }
const baseCache = new Map()
const baseSource = rel => {
  if (!baseCache.has(rel)) {
    let text = null
    try { text = execFileSync('git', ['show', `${BASE_COMMIT}:${rel}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }) } catch { text = null }
    baseCache.set(rel, text)
  }
  return baseCache.get(rel)
}
const sha = text => createHash('sha256').update(text).digest('hex')
/** `git <args>` from the repo root; null when git cannot answer (the base commit is not in this clone). */
const gitOut = (...args) => { try { return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }) } catch { return null } }
/** The strip module's exports from its source text (a mutant's text too): the file is plain JavaScript with two top-level exports. */
const loadStrip = source => new Function(`${source.replace(/^export /gm, '')}\nreturn { stripNarrationRouter, NARRATION_ROUTER_FILES }`)()
/** scripts/studio-stack-tolerant.mjs from its source text (a mutant's too): plain JavaScript, no imports. */
const loadStack = source => new Function(`${source.replace(/^export /gm, '')}\nreturn { STACK, stackScope, sameOrTolerant, stackMutants }`)()

const STUB_MEDIA_STORE = `
export function contentKey(parts: unknown): string { return 'k' }
export async function getMedia(path: string): Promise<null> { return null }
export async function putMedia(path: string, body: unknown, contentType: string): Promise<{ ok: boolean }> { return { ok: true } }
`
const HEAD_FILES = [LIB, DRAFT, TTS, SPOKEN, VOICES, BUDGET, WAV, R_SCRIPT, R_RENDER, R_SPEAK, R_SAMPLE, ENV, PKG, STRIP, STACK_TOLERANT]
const headSources = () => ({ ...Object.fromEntries(HEAD_FILES.map(rel => [rel, tryRead(rel)])), [MEDIA_STORE]: STUB_MEDIA_STORE })
// The branch's untouched helpers with the BASE's three changed library files: what shipped.
const baseSources = head => {
  const base = { ...head, [LIB]: null }
  for (const rel of [DRAFT, TTS, SPOKEN]) base[rel] = baseSource(rel)
  return base
}

// ---------- runtime: transpile + vm, a stubbed fetch that records, an env that records reads ----------
const scriptCache = new Map() // source text -> compiled vm.Script: the suite runs thousands of runtimes (and every mutant reruns it)
const compile = text => {
  if (!scriptCache.has(text)) scriptCache.set(text, new vm.Script(ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText))
  return scriptCache.get(text)
}

function runtime(sources, { env = {}, script = [] } = {}) {
  const calls = [], logs = [], timeouts = [], reads = new Set(), queue = [...script], cache = new Map()
  const envProxy = new Proxy({ ...env }, { get: (target, key) => { if (typeof key === 'string') reads.add(key); return target[key] } })
  const line = level => (...args) => logs.push(`${level}: ${args.map(a => (a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}`)
  const consoleStub = { log: line('log'), info: line('info'), warn: line('warn'), error: line('error'), debug: line('debug') }
  const fetchStub = async (url, init) => {
    calls.push({
      url: String(url), method: init?.method ?? 'GET', headers: init?.headers ? Object.entries(init.headers) : [],
      body: init?.body ?? null, hasSignal: Boolean(init && 'signal' in init), keys: init ? Object.keys(init) : [],
    })
    const next = queue.shift()
    if (!next) throw new Error(`unexpected fetch to ${url}`)
    return next()
  }
  const abortSignal = { timeout: ms => { timeouts.push(ms); return AbortSignal.timeout(ms) } }
  const load = rel => {
    if (cache.has(rel)) return cache.get(rel)
    const text = sources[rel]
    if (text == null) throw new Error(`no source for ${rel}`)
    const module = { exports: {} }
    cache.set(rel, module.exports)
    const localRequire = id => (id.startsWith('./') ? load(`${path.posix.dirname(rel)}/${id.slice(2)}.ts`) : nodeRequire(id))
    compile(text).runInNewContext({
      module, exports: module.exports, require: localRequire, process: { env: envProxy }, fetch: fetchStub, console: consoleStub,
      AbortSignal: abortSignal, URL, Buffer, Response, Error, TypeError,
    })
    cache.set(rel, module.exports)
    return module.exports
  }
  return { calls, logs, timeouts, reads, load }
}

// ---------- fixtures ----------
const DIRECT_KEY = `dk${randomBytes(10).toString('hex')}` // built per run: never a literal
const ROUTER_KEY = `rk${randomBytes(10).toString('hex')}`
const ROUTER_URL = 'https://router.synthetic.invalid'
const OPENROUTER_CHAT = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_SPEECH = 'https://openrouter.ai/api/v1/audio/speech'
const SLIDE = { index: 2, title: 'Pricing', bodyText: 'Revenue grew twelve percent.\nMargin held.', speakerNotes: 'Say it plainly.', pacingHints: ['slow down'] }
const TEXT = 'Revenue grew twelve percent.'
const REPLY = { full: 'Revenue grew twelve percent.', compressed: 'Revenue grew.' }
const CTX = { userId: 'clx9u3.k2:A-1', sessionId: 'sess-9b1', presentationId: 'deck_77', traceId: 'trc_0123456789ab' }

const envOff = (extra = {}) => ({ OPENROUTER_API_KEY: DIRECT_KEY, ...extra })
const envOn = (extra = {}) => ({ OPENROUTER_API_KEY: DIRECT_KEY, NARRATION_VIA_ROUTER: 'true', MODEL_ROUTER_URL: ROUTER_URL, MODEL_ROUTER_STUDIO_KEY: ROUTER_KEY, ...extra })
const routerHeaders = (task, ctx = CTX, key = ROUTER_KEY) => [
  ['Content-Type', 'application/json'], ['Authorization', `Bearer ${key}`], ['X-MR-Service', 'studio'], ['X-MR-Task', task],
  ['X-MR-User-ID', ctx.userId], ['X-MR-Session-ID', ctx.sessionId], ['X-MR-Presentation-ID', ctx.presentationId], ['X-MR-Trace-ID', ctx.traceId],
]
const DIRECT_HEADERS = [['Content-Type', 'application/json'], ['Authorization', `Bearer ${DIRECT_KEY}`]]
const T_DRAFT = 'studio.narration_draft'
const T_TTS = 'studio.narration_tts'

// Steps for the stubbed fetch: each is called once, returns a Response or throws.
const json = (status, value, headers = {}) => () => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json', ...headers } })
const R = {
  chat: (reply = REPLY) => json(200, { choices: [{ message: { content: JSON.stringify(reply) } }] }),
  audio: (id = 'gen-1') => () => new Response(new Uint8Array(4096).fill(1), { status: 200, headers: { 'content-type': 'audio/mpeg', 'x-generation-id': id } }),
  cost: usd => json(200, { data: { total_cost: usd } }),
  status: (code, body = '', type = 'application/json') => Object.assign(() => new Response(body, { status: code, headers: { 'content-type': type } }), { statusCode: code }),
  throws: error => Object.assign(() => { throw error }, { error }),
}
const socketError = (code, syscall) => Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error(`socket ${code}`), { code, ...(syscall ? { syscall } : {}) }) })
const aggregateError = code => Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error(''), { code, errors: [Object.assign(new Error('a'), { code }), Object.assign(new Error('b'), { code })] }) })
const timeoutError = () => new DOMException('The operation was aborted due to timeout', 'TimeoutError')
const abortError = () => new DOMException('This operation was aborted', 'AbortError')

const settle = async promise => {
  try { return { ok: true, value: await promise } } catch (error) { return { ok: false, name: error?.name, message: String(error?.message), status: error?.status ?? null } }
}
const canon = value => JSON.stringify(value, (key, v) => (v && v.type === 'Buffer' ? `buffer:${v.data.length}` : v))
const draft = (rt, ctx = CTX) => settle(rt.load(DRAFT).draftSlideScript(SLIDE, 60, 30, ctx))
const speak = async (rt, voice = 'alloy', ctx = CTX) => {
  const out = await settle(rt.load(TTS).synthesize(TEXT, voice, ctx))
  if (out.ok) out.value = { ...out.value, audio: `bytes:${out.value.audio.byteLength}`, firstAudioSeconds: 0 }
  return out
}
const cost = (rt, id = 'gen-1', servedBy) => settle(rt.load(TTS).billedCostUsd(id, servedBy))
const ids = rt => rt.load(VOICES).NARRATION_VOICES.map(v => v.id)

// The base's runs do not depend on the branch's sources, so every mutant reuses them.
const BASE_RUNS = new Map()
// ---------- the suite (a function of the sources, so a mutant can be run through the same checks) ----------
function buildTests(S) {
  const tests = []
  const test = (name, fn) => tests.push([name, fn])
  const BASE = baseSources(S)
  const haveBase = [DRAFT, TTS, SPOKEN].every(rel => BASE[rel] != null)

  // ===== 1. flag off =====
  // Each scenario: the env to run in, the fetch steps, what to call. The same list runs on the base and on the branch.
  const SCENARIOS = {
    'draft ok': { script: [R.chat()], run: rt => draft(rt) },
    'draft http 500': { script: [R.status(500, 'upstream broke', 'text/plain')], run: rt => draft(rt) },
    'draft network failure': { script: [R.throws(new TypeError('fetch failed'))], run: rt => draft(rt) },
    'draft without a key': { keyless: true, script: [], run: rt => draft(rt) },
    'speech alloy (mp3) then its billed cost': { script: [R.audio('gen-a'), R.cost(0.0123)], run: async rt => [await speak(rt, 'alloy'), await cost(rt, 'gen-a')] },
    'speech zephyr (pcm)': { script: [R.audio('gen-z')], run: rt => speak(rt, 'zephyr') },
    'speech http 429': { script: [R.status(429, '{"error":{"code":429}}')], run: rt => speak(rt) },
    'speech network failure': { script: [R.throws(new TypeError('fetch failed'))], run: rt => speak(rt) },
    'speech without a key': { keyless: true, script: [], run: rt => speak(rt) },
    'speech with nothing to say': { script: [], run: rt => settle(rt.load(TTS).synthesize('   ', 'alloy')) },
    'cost lookup: no id, then a failing lookup, then a missing total': { script: [R.status(404), R.cost(undefined)], run: async rt => [await cost(rt, null), await cost(rt, 'gen-x'), await cost(rt, 'gen-y')] },
    'cost lookup without a key': { keyless: true, script: [], run: rt => cost(rt, 'gen-k') },
    'is narration configured': { script: [], run: async rt => ({ yes: rt.load(TTS).isNarrationConfigured() }) },
    'is narration configured, no key': { keyless: true, script: [], run: async rt => ({ no: rt.load(TTS).isNarrationConfigured() }) },
    'spoken fixed line, then an answer': {
      script: [R.audio('gen-s1'), R.audio('gen-s2')],
      run: async rt => {
        const spoken = rt.load(SPOKEN)
        const live = rt.load(VOICES).NARRATION_VOICES.find(v => rt.load(VOICES).canSpeakLiveAnswers(v)).id
        const line = await settle(spoken.speakFixedLine('A fixed line.', live, 'slot'))
        const answer = await settle(spoken.speakAnswer('A short answer.', live))
        return [line.ok ? { ...line, value: { ...line.value, body: `bytes:${line.value.body.byteLength}` } } : line, answer.ok ? { ...answer, value: { ...answer.value, body: `bytes:${answer.value.body.byteLength}` } } : answer]
      },
    },
  }
  const runScenarios = (sources, baseEnv) => Promise.all(Object.entries(SCENARIOS).map(async ([name, scenario]) => {
    const env = scenario.keyless ? { ...baseEnv, OPENROUTER_API_KEY: undefined } : baseEnv
    const rt = runtime(sources, { env, script: scenario.script })
    const outcome = await scenario.run(rt)
    return { name, calls: rt.calls, outcome, reads: [...rt.reads], logs: rt.logs }
  }))
  const secretsOut = text => text.split(DIRECT_KEY).join('<direct key>').split(ROUTER_KEY).join('<router key>')
  const record = results => secretsOut(canon(results.map(({ name, calls, outcome }) => ({ name, calls, outcome }))))

  const OFF_SPELLINGS = [undefined, '', 'false', 'FALSE', 'TRUE', 'True', '1', 'yes', 'on', ' true', 'true ', 'true\n', 'tru', 'enabled']
  const routerVars = { MODEL_ROUTER_URL: ROUTER_URL, MODEL_ROUTER_STUDIO_KEY: ROUTER_KEY }
  test('flag off: every spelling that is not exactly "true" makes the base\'s requests, outcomes and logs, and the router variables are never read', async () => {
    if (!haveBase) { console.log('SKIP flag-off comparison with the base: the base commit is not in this clone (fetch the full history)'); return }
    for (const withVars of [false, true]) {
      for (const spelling of OFF_SPELLINGS) {
        const env = envOff({ ...(withVars ? routerVars : {}), ...(spelling === undefined ? {} : { NARRATION_VIA_ROUTER: spelling }) })
        const key = JSON.stringify(env)
        if (!BASE_RUNS.has(key)) BASE_RUNS.set(key, await runScenarios(BASE, env))
        const base = BASE_RUNS.get(key)
        const head = await runScenarios(S, env)
        assert.equal(record(head), record(base), `NARRATION_VIA_ROUTER=${JSON.stringify(spelling)} vars=${withVars}: not the base`)
        for (const [i, scenario] of head.entries()) {
          assert.deepEqual(scenario.logs, base[i].logs, `${scenario.name}: logs differ from the base`)
          assert.ok(!scenario.reads.some(name => name.startsWith('MODEL_ROUTER')), `${scenario.name}: read a router variable with the flag off`)
          for (const call of scenario.calls) {
            assert.equal(call.hasSignal, false, `${scenario.name}: a signal was added to a direct call`)
            assert.ok(call.url.startsWith('https://openrouter.ai/api/v1/'), `${scenario.name}: ${call.url}`)
          }
        }
      }
    }
  })
  test('flag off: the sha256 of the canonical record, base and branch (printed)', async () => {
    if (!haveBase) return
    const env = envOff(routerVars)
    const base = record(await runScenarios(BASE, env)), head = record(await runScenarios(S, env))
    assert.equal(sha(head), sha(base))
    console.log(`  flag-off record sha256 base=${sha(base)} branch=${sha(head)} (${Object.keys(SCENARIOS).length} scenarios)`)
  })
  test('flag off: the direct requests are exactly the documented ones', async () => {
    const rt = runtime(S, { env: envOff(routerVars), script: [R.chat(), R.audio(), R.cost(0.5)] })
    await draft(rt); await speak(rt); await cost(rt, 'gen/1 2')
    assert.deepEqual(rt.calls.map(c => [c.method, c.url]), [['POST', OPENROUTER_CHAT], ['POST', OPENROUTER_SPEECH], ['GET', 'https://openrouter.ai/api/v1/generation?id=gen%2F1%202']])
    assert.deepEqual(rt.calls[0].headers, DIRECT_HEADERS); assert.deepEqual(rt.calls[1].headers, DIRECT_HEADERS)
    assert.deepEqual(rt.calls[2].headers, [['Authorization', `Bearer ${DIRECT_KEY}`]])
    assert.deepEqual(rt.calls[0].keys, ['method', 'headers', 'body']); assert.deepEqual(rt.calls[1].keys, ['method', 'headers', 'body']); assert.deepEqual(rt.calls[2].keys, ['headers'])
    assert.equal(rt.timeouts.length, 0)
  })
  test('flag off: isNarrationConfigured is the direct key alone, and no result carries servedBy', async () => {
    const withKey = runtime(S, { env: envOff(routerVars) }), noKey = runtime(S, { env: { ...routerVars, OPENROUTER_API_KEY: undefined } })
    assert.equal(withKey.load(TTS).isNarrationConfigured(), true); assert.equal(noKey.load(TTS).isNarrationConfigured(), false)
    const rt = runtime(S, { env: envOff(routerVars), script: [R.audio()] })
    const out = await speak(rt)
    assert.ok(out.ok && !('servedBy' in out.value))
    assert.equal(runtime(S, { env: envOff() }).load(LIB).narrationCallContext({ userId: 'u' }), undefined, 'a call context was made with the flag off')
  })

  // ===== 2. flag on =====
  test('flag on: draft is POST {router}/v1/chat/completions with the exact headers, the same body, and a timeout', async () => {
    const off = runtime(S, { env: envOff(), script: [R.chat()] }); await draft(off)
    const on = runtime(S, { env: envOn(), script: [R.chat()] })
    const out = await draft(on)
    assert.ok(out.ok); assert.equal(out.value.full, REPLY.full); assert.equal(out.value.compressed, REPLY.compressed)
    assert.equal(on.calls.length, 1)
    const [c] = on.calls
    assert.equal(c.url, `${ROUTER_URL}/v1/chat/completions`); assert.equal(c.method, 'POST')
    assert.deepEqual(c.headers, routerHeaders(T_DRAFT)); assert.equal(c.body, off.calls[0].body, 'the body changed')
    assert.equal(sha(c.body), sha(off.calls[0].body)); assert.ok(c.hasSignal)
    assert.ok(!c.headers.some(([name]) => /group/i.test(name)), 'X-MR-Group is sent')
    assert.ok(on.timeouts.length === 1 && on.timeouts[0] >= 30_000 && on.timeouts[0] <= 300_000, `draft timeout ${on.timeouts}`)
    assert.ok(JSON.parse(c.body).response_format.type === 'json_object' && JSON.parse(c.body).model.length > 0)
  })
  test('flag on: speech is POST {router}/v1/audio/speech with the exact headers; the body is the direct body for every voice; the timeout is at least 190 s', async () => {
    const voices = ids(runtime(S, { env: envOff() }))
    assert.equal(voices.length, 9)
    for (const voice of voices) {
      const off = runtime(S, { env: envOff(), script: [R.audio()] }); await speak(off, voice)
      const on = runtime(S, { env: envOn(), script: [R.audio('gen-9')] })
      const out = await speak(on, voice)
      assert.ok(out.ok, voice); assert.equal(out.value.generationId, 'gen-9'); assert.equal(out.value.servedBy, 'router')
      const [c] = on.calls
      assert.equal(on.calls.length, 1, voice); assert.equal(c.url, `${ROUTER_URL}/v1/audio/speech`, voice); assert.equal(c.method, 'POST')
      assert.deepEqual(c.headers, routerHeaders(T_TTS), voice); assert.equal(c.body, off.calls[0].body, `${voice}: the body changed`)
      assert.ok(c.hasSignal && on.timeouts.length === 1 && on.timeouts[0] >= 190_000 && on.timeouts[0] <= 600_000, `${voice}: speech timeout ${on.timeouts}`)
    }
  })
  test('flag on: the billed cost is GET {router}/v1/generation?id=... with the key and the service only, short timeout, null on any failure, and no direct retry', async () => {
    const on = runtime(S, { env: envOn(), script: [R.cost(0.0456), R.status(404), R.status(503), R.throws(socketError('ECONNREFUSED', 'connect')), R.status(401)] })
    assert.equal((await cost(on, 'gen 1/2')).value, 0.0456)
    for (let i = 0; i < 4; i++) assert.equal((await cost(on, 'gen-x')).value, null, `failure ${i}`)
    assert.equal(on.calls.length, 5, 'a failed lookup was retried')
    const [c] = on.calls
    assert.equal(c.url, `${ROUTER_URL}/v1/generation?id=gen%201%2F2`); assert.equal(c.method, 'GET')
    assert.deepEqual(c.headers, [['Authorization', `Bearer ${ROUTER_KEY}`], ['X-MR-Service', 'studio']]); assert.equal(c.body, null)
    assert.ok(on.calls.every(call => call.url.startsWith(ROUTER_URL)), 'a lookup went to OpenRouter')
    assert.ok(on.timeouts.every(ms => ms >= 1_000 && ms <= 30_000), `lookup timeouts ${on.timeouts}`)
  })
  test('flag on: a lookup for audio that fell back to OpenRouter is made on OpenRouter with the direct key', async () => {
    const rt = runtime(S, { env: envOn(), script: [R.cost(0.02), R.cost(0.03)] })
    assert.equal((await cost(rt, 'gen-d', 'direct')).value, 0.02)
    assert.equal(rt.calls[0].url, 'https://openrouter.ai/api/v1/generation?id=gen-d'); assert.deepEqual(rt.calls[0].headers, [['Authorization', `Bearer ${DIRECT_KEY}`]])
    assert.equal((await cost(rt, 'gen-r', 'router')).value, 0.03); assert.ok(rt.calls[1].url.startsWith(ROUTER_URL))
    assert.equal(rt.timeouts.length, 1)
  })
  test('flag on: the router key is only ever the Authorization value of a router call', async () => {
    const rt = runtime(S, { env: envOn(), script: [R.chat(), R.audio(), R.cost(1)] })
    await draft(rt); await speak(rt); await cost(rt)
    for (const c of rt.calls) {
      assert.ok(c.url.startsWith(ROUTER_URL))
      for (const [name, value] of c.headers) assert.equal(value.includes(ROUTER_KEY), name === 'Authorization', `${name}`)
      assert.ok(!c.url.includes(ROUTER_KEY) && !(c.body ?? '').includes(ROUTER_KEY) && !c.headers.some(([, v]) => v.includes(DIRECT_KEY)))
    }
    assert.deepEqual(rt.logs, [])
  })
  test('flag on: the base address is taken as a base (trailing slashes and a pasted /v1 dropped; credentials, query and fragment ignored)', async () => {
    for (const raw of [`${ROUTER_URL}/`, `${ROUTER_URL}//`, `${ROUTER_URL}/v1`, `${ROUTER_URL}/v1/`, `  ${ROUTER_URL}  `, ['https://', 'user:', 'pass', '@router.synthetic.invalid?x=1#f'].join('')]) {
      const rt = runtime(S, { env: envOn({ MODEL_ROUTER_URL: raw }), script: [R.chat()] })
      await draft(rt)
      assert.equal(rt.calls[0].url, `${ROUTER_URL}/v1/chat/completions`, JSON.stringify(raw))
    }
    const prefixed = runtime(S, { env: envOn({ MODEL_ROUTER_URL: 'http://127.0.0.1:8123/edge/' }), script: [R.chat()] }); await draft(prefixed)
    assert.equal(prefixed.calls[0].url, 'http://127.0.0.1:8123/edge/v1/chat/completions')
  })
  test('flag on, no OpenRouter key: the router alone is enough (configured, and the calls are made)', async () => {
    const env = envOn({ OPENROUTER_API_KEY: undefined })
    const rt = runtime(S, { env, script: [R.chat(), R.audio('g'), R.cost(0.1)] })
    assert.equal(rt.load(TTS).isNarrationConfigured(), true)
    assert.ok((await draft(rt)).ok); const spoken = await speak(rt); assert.ok(spoken.ok && spoken.value.servedBy === 'router'); assert.equal((await cost(rt, 'g')).value, 0.1)
    assert.equal(rt.calls.length, 3); assert.ok(rt.calls.every(c => c.url.startsWith(ROUTER_URL)))
  })

  // ===== 3. the fallback table =====
  const DIRECT_OK = { chat: R.chat(), speech: R.audio('gen-direct') }
  const CASES = [
    // [label, the router's step, goes direct?]
    ['connect refused', R.throws(socketError('ECONNREFUSED', 'connect')), true],
    ['connect refused on several addresses (AggregateError)', R.throws(aggregateError('ECONNREFUSED')), true],
    ['connect timeout', R.throws(socketError('UND_ERR_CONNECT_TIMEOUT')), true],
    ['connect-phase ETIMEDOUT', R.throws(socketError('ETIMEDOUT', 'connect')), true],
    ['name not found', R.throws(socketError('ENOTFOUND', 'getaddrinfo')), true],
    ['name lookup try again', R.throws(socketError('EAI_AGAIN', 'getaddrinfo')), true],
    ['host unreachable', R.throws(socketError('EHOSTUNREACH', 'connect')), true],
    ['network unreachable', R.throws(socketError('ENETUNREACH', 'connect')), true],
    ['certificate failure before any request', R.throws(socketError('CERT_HAS_EXPIRED')), true],
    ['router 401', R.status(401, '{"error":{"message":"bad key"}}'), true],
    ['router 403', R.status(403, '{"error":{"message":"scope"}}'), true],
    ['403 without a body', R.status(403), true],
    ['502 html from a proxy', R.status(502, '<html>Bad Gateway</html>', 'text/html'), true],
    ['503 empty', R.status(503), true],
    ['504 plain text', R.status(504, 'upstream request timeout', 'text/plain'), true],
    ['502 JSON without an error (a platform edge)', R.status(502, '{"status":"error","code":502,"message":"Application failed to respond"}'), true],
    ['503 JSON with a null error', R.status(503, '{"error":null}'), true],
    ['504 JSON array', R.status(504, '[1,2]'), true],
    ['502 with an error object', R.status(502, '{"error":{"message":"upstream","code":502}}'), false],
    ['503 with an error object', R.status(503, '{"error":{"message":"busy","type":"x"}}'), false],
    ['504 with an error object', R.status(504, '{"error":{"message":"deadline"}}'), false],
    ['503 with a string error (in doubt, no second charge)', R.status(503, '{"error":"overloaded"}'), false],
    ['429', R.status(429, '{"error":{"code":429}}'), false],
    ['429 without a body', R.status(429), false],
    ...[400, 402, 404, 408, 409, 413, 422, 500, 501, 507].map(code => [`${code}`, R.status(code, '{"error":{"message":"no"}}'), false]),
    ['500 without a body', R.status(500), false],
    ['read timeout (TimeoutError)', R.throws(timeoutError()), false],
    ['aborted (AbortError)', R.throws(abortError()), false],
    ['reset after the request was sent', R.throws(socketError('UND_ERR_SOCKET')), false],
    ['ECONNRESET', R.throws(socketError('ECONNRESET', 'read')), false],
    ['headers timeout', R.throws(socketError('UND_ERR_HEADERS_TIMEOUT')), false],
    ['body timeout', R.throws(socketError('UND_ERR_BODY_TIMEOUT')), false],
    ['ETIMEDOUT on an open connection', R.throws(socketError('ETIMEDOUT', 'read')), false],
    ['fetch failed with no cause', R.throws(new TypeError('fetch failed')), false],
    ['an unknown error', R.throws(new Error('boom')), false],
  ]
  const KINDS = [
    ['draft', rt => draft(rt), 'chat', OPENROUTER_CHAT, DIRECT_OK.chat],
    ['speech', rt => speak(rt, 'alloy'), 'speech', OPENROUTER_SPEECH, DIRECT_OK.speech],
  ]
  test(`fallback table: ${CASES.length} cases x draft and speech go direct only where the router did nothing, and never twice`, async () => {
    for (const [kind, call, , directUrl, directOk] of KINDS) {
      for (const [label, step, goesDirect] of CASES) {
        const rt = runtime(S, { env: envOn(), script: goesDirect ? [step, directOk] : [step] })
        const out = await call(rt)
        const where = `${kind} / ${label}`
        assert.equal(rt.calls.length, goesDirect ? 2 : 1, `${where}: calls ${rt.calls.map(c => c.url)}`)
        assert.ok(rt.calls[0].url.startsWith(ROUTER_URL), where)
        if (goesDirect) {
          assert.ok(out.ok, `${where}: ${out.message}`)
          const [, second] = rt.calls
          assert.equal(second.url, directUrl, where); assert.equal(second.method, 'POST'); assert.deepEqual(second.headers, DIRECT_HEADERS, `${where}: not today's direct headers`)
          assert.equal(second.body, rt.calls[0].body, `${where}: body differs`); assert.equal(second.hasSignal, false, where)
          if (kind === 'speech') assert.equal(out.value.servedBy, 'direct', where)
        } else {
          assert.ok(!out.ok, `${where}: should have failed`)
          assert.ok(!rt.calls.some(c => c.url.startsWith('https://openrouter.ai')), `${where}: went direct`)
          const status = Number(/^\d{3}/.exec(label)?.[0] ?? (label.startsWith('429') ? 429 : NaN))
          if (!Number.isNaN(status)) assert.ok(kind === 'draft' ? out.message.includes(`(${status})`) : out.status === status, `${where}: ${out.message} ${out.status}`)
        }
      }
    }
  })
  test('fallback table: with no OpenRouter key nothing can go direct, so every router failure is the only call and surfaces as an error', async () => {
    for (const [kind, call] of KINDS) {
      for (const [label, step] of CASES) {
        const rt = runtime(S, { env: envOn({ OPENROUTER_API_KEY: undefined }), script: [step] })
        const out = await call(rt)
        assert.equal(rt.calls.length, 1, `${kind} / ${label}`); assert.ok(!out.ok, `${kind} / ${label}: should have failed`)
        assert.ok(rt.calls.every(c => c.url.startsWith(ROUTER_URL)))
        // ... and the error is the router's own (a thrown error as it was, a status as the caller words it), not a crash of the fallback
        if (step.error) assert.ok(out.message.includes(step.error.message) || out.name === step.error.name, `${kind} / ${label}: ${out.name}: ${out.message}`)
        else assert.ok(kind === 'draft' ? out.message.includes(`(${step.statusCode})`) : out.status === step.statusCode, `${kind} / ${label}: ${out.message} ${out.status}`)
      }
    }
  })
  test('fallback: a failing direct call is the end (two calls, the direct error is the one reported), and a success needs no second call', async () => {
    for (const [kind, call] of KINDS) {
      const rt = runtime(S, { env: envOn(), script: [R.throws(socketError('ECONNREFUSED', 'connect')), R.status(500, 'direct broke', 'text/plain')] })
      const out = await call(rt)
      assert.equal(rt.calls.length, 2, kind); assert.ok(!out.ok && /500/.test(out.message) && /direct broke/.test(out.message), `${kind}: ${out.message}`)
    }
    const fine = runtime(S, { env: envOn(), script: [R.chat()] }); assert.ok((await draft(fine)).ok); assert.equal(fine.calls.length, 1)
  })
  test('fallback: is logged once per reason, without any address or key', async () => {
    const rt = runtime(S, { env: envOn(), script: [R.throws(socketError('ECONNREFUSED', 'connect')), R.chat(), R.throws(socketError('ECONNREFUSED', 'connect')), R.chat(), R.status(401), R.chat()] })
    for (let i = 0; i < 3; i++) await draft(rt)
    const warns = rt.logs.filter(l => l.startsWith('warn'))
    assert.equal(warns.length, 2, rt.logs.join('|')); assert.ok(warns[0] !== warns[1])
    for (const l of rt.logs) assert.ok(!l.includes(ROUTER_KEY) && !l.includes(DIRECT_KEY) && !l.includes('Bearer') && !l.includes('synthetic.invalid'), l)
  })

  // ===== 4. the ids =====
  const long = n => `a${'b'.repeat(n - 1)}`
  const GOOD_IDS = ['clx9u3k2', 'A', '0', 'a.b', 'a_b', 'a:b', 'a-b', 'usr_8f3.k2:A-1', 'trc_0123456789ab', long(255), '9lives']
  const BAD_IDS = ['someone@example.com', 'a@b', '', ' ', ' lead', 'trail ', 'has space', '-lead', '.lead', '_lead', ':lead', 'a/b', 'a\\b', 'a\nb', 'a\r\nb', 'ünï', 'a;b', 'a,b', 'a=b', 'a"b', '<x>', long(256), null, undefined, 5, {}, ['a']]
  test('X-MR-User-ID, Session-ID, Presentation-ID and Trace-ID: an opaque id is sent as is; anything else is left out and the call is still made', async () => {
    for (const [field, header] of [['userId', 'X-MR-User-ID'], ['sessionId', 'X-MR-Session-ID'], ['presentationId', 'X-MR-Presentation-ID'], ['traceId', 'X-MR-Trace-ID']]) {
      for (const value of GOOD_IDS) {
        const rt = runtime(S, { env: envOn(), script: [R.chat()] }); assert.ok((await draft(rt, { ...CTX, [field]: value })).ok)
        assert.deepEqual(rt.calls[0].headers.find(([name]) => name === header), [header, value], `${field}=${JSON.stringify(value)}`)
      }
      for (const value of BAD_IDS) {
        const rt = runtime(S, { env: envOn(), script: [R.chat()] }); assert.ok((await draft(rt, { ...CTX, [field]: value })).ok, `${field}=${JSON.stringify(value)} stopped the call`)
        assert.ok(!rt.calls[0].headers.some(([name]) => name === header), `${field}=${JSON.stringify(value)} was sent`)
        for (const [, v] of rt.calls[0].headers) assert.ok(typeof v === 'string' && !/[\r\n@]/.test(v), 'a bad id leaked into another header')
      }
    }
    const none = runtime(S, { env: envOn(), script: [R.chat(), R.audio()] }); await draft(none, null); await speak(none, 'alloy', {})
    for (const c of none.calls) assert.deepEqual(c.headers.map(([n]) => n), ['Content-Type', 'Authorization', 'X-MR-Service', 'X-MR-Task'], 'no context: no identity headers')
  })
  test('an e-mail address is never sent as the user id, in any header, in any call', async () => {
    const rt = runtime(S, { env: envOn(), script: [R.chat(), R.audio()] })
    const ctx = { userId: 'pat@example.com', sessionId: 'pat@example.com', presentationId: 'pat@example.com', traceId: 'pat@example.com' }
    await draft(rt, ctx); await speak(rt, 'alloy', ctx)
    for (const c of rt.calls) { assert.ok(!c.headers.some(([, v]) => v.includes('@') || v.includes('pat')), 'e-mail sent'); assert.ok(!c.url.includes('@') && !c.body.includes('pat@')) }
  })
  test('cleanMrId, mintNarrationTraceId and narrationCallContext', async () => {
    const lib = runtime(S, { env: envOn() }).load(LIB)
    for (const v of GOOD_IDS) assert.equal(lib.cleanMrId(v), v)
    for (const v of BAD_IDS) assert.equal(lib.cleanMrId(v), null, JSON.stringify(v))
    const seen = new Set()
    for (let i = 0; i < 50; i++) { const t = lib.mintNarrationTraceId(); assert.match(t, /^trc_[0-9a-f]{12}$/); seen.add(t) }
    assert.ok(seen.size > 45, 'trace ids repeat')
    const ctx = lib.narrationCallContext({ userId: 'u1', sessionId: 's1', presentationId: 'p1' })
    assert.equal(ctx.userId, 'u1'); assert.equal(ctx.sessionId, 's1'); assert.equal(ctx.presentationId, 'p1'); assert.match(ctx.traceId, /^trc_[0-9a-f]{12}$/)
    assert.notEqual(lib.narrationCallContext({}).traceId, ctx.traceId)
    const off = runtime(S, { env: envOff(routerVars) }).load(LIB)
    assert.equal(off.narrationCallContext({ userId: 'u1' }), undefined)
  })

  // ===== 5. a missing or unusable router variable =====
  const UNUSABLE = [
    ['no URL', { MODEL_ROUTER_URL: undefined }], ['no key', { MODEL_ROUTER_STUDIO_KEY: undefined }], ['neither', { MODEL_ROUTER_URL: undefined, MODEL_ROUTER_STUDIO_KEY: undefined }],
    ['blank URL', { MODEL_ROUTER_URL: '   ' }], ['blank key', { MODEL_ROUTER_STUDIO_KEY: '  ' }], ['empty both', { MODEL_ROUTER_URL: '', MODEL_ROUTER_STUDIO_KEY: '' }],
    ['URL that is not an address', { MODEL_ROUTER_URL: 'router host' }], ['URL with another scheme', { MODEL_ROUTER_URL: 'ftp://router.synthetic.invalid' }],
    ['key with a space', { MODEL_ROUTER_STUDIO_KEY: `${ROUTER_KEY} extra` }], ['key with a newline', { MODEL_ROUTER_STUDIO_KEY: `${ROUTER_KEY}\nx` }],
    ['key with non-ASCII', { MODEL_ROUTER_STUDIO_KEY: `${ROUTER_KEY}é` }],
  ]
  test('flag on with a missing or unusable router variable: the base\'s direct call, logged once, with no value in the log', async () => {
    for (const [label, change] of UNUSABLE) {
      const env = envOn(change)
      const off = runtime(S, { env: envOff(), script: [R.chat(), R.audio('g'), R.chat()] }); await draft(off); await speak(off)
      const rt = runtime(S, { env, script: [R.chat(), R.audio('g'), R.chat()] })
      await draft(rt); const spoken = await speak(rt); await draft(rt)
      assert.equal(rt.calls.length, 3, label)
      assert.deepEqual(rt.calls.slice(0, 2).map(c => [c.method, c.url, c.headers, c.body, c.hasSignal]), off.calls.map(c => [c.method, c.url, c.headers, c.body, c.hasSignal]), `${label}: not the direct call`)
      assert.ok(spoken.ok && !('servedBy' in spoken.value), label)
      const warns = rt.logs.filter(l => l.startsWith('warn'))
      assert.equal(warns.length, 1, `${label}: ${rt.logs.join('|')}`); assert.match(warns[0], /NARRATION_VIA_ROUTER/); assert.match(warns[0], /MODEL_ROUTER_URL/); assert.match(warns[0], /MODEL_ROUTER_STUDIO_KEY/)
      for (const l of rt.logs) for (const secret of [ROUTER_KEY, DIRECT_KEY, ROUTER_URL, 'synthetic.invalid', 'router host', 'Bearer', 'é']) assert.ok(!l.includes(secret), `${label}: log has ${secret}`)
      assert.equal(rt.load(TTS).isNarrationConfigured(), true)
    }
  })
  test('flag on with a missing router variable and no OpenRouter key: not configured, and the base\'s error', async () => {
    const rt = runtime(S, { env: envOn({ MODEL_ROUTER_URL: undefined, OPENROUTER_API_KEY: undefined }) })
    assert.equal(rt.load(TTS).isNarrationConfigured(), false)
    const d = await draft(rt), s = await speak(rt)
    assert.equal(d.message, 'OPENROUTER_API_KEY is not configured'); assert.equal(s.message, 'OPENROUTER_API_KEY is not configured'); assert.equal(rt.calls.length, 0)
  })

  // ===== 6. no secret anywhere =====
  test('no key value appears in any log line, error message or result, whichever way a call goes', async () => {
    const seen = []
    for (const [kind, call] of KINDS) {
      for (const [label, step, goesDirect] of CASES) {
        for (const env of [envOn(), envOn({ OPENROUTER_API_KEY: undefined })]) {
          const rt = runtime(S, { env, script: goesDirect && env.OPENROUTER_API_KEY ? [step, kind === 'draft' ? R.chat() : R.audio()] : [step] })
          const out = await call(rt)
          seen.push(...rt.logs, out.message ?? '', canon(out.value ?? null))
        }
      }
    }
    assert.ok(seen.length > 100)
    for (const text of seen) assert.ok(!text.includes(ROUTER_KEY) && !text.includes(DIRECT_KEY) && !/Bearer\s/.test(text), 'a key or an Authorization value is in an output')
  })

  // ===== 7. the wiring =====
  const flat = text => text.replace(/\s+/g, ' ')
  test('the four routes and the spoken lines hand the identity over (never an e-mail), and the render route lets the lookup follow where the audio came from', () => {
    const script = flat(S[R_SCRIPT]), render = flat(S[R_RENDER]), speakRoute = flat(S[R_SPEAK]), sample = flat(S[R_SAMPLE]), spoken = flat(S[SPOKEN])
    assert.ok(script.includes('narrationCallContext({ userId: user.id, sessionId: deck.sessionId, presentationId })'))
    assert.equal((script.match(/draftSlideScript\(/g) ?? []).length, 2, 'the route calls the draft twice')
    assert.ok(/allocation\.compressedWords, routed \)/.test(script) && /45, 25, routed \)/.test(script), 'both draft calls pass the context')
    assert.ok(render.includes('narrationCallContext({ userId: user.id, sessionId: deck.sessionId, presentationId })') && render.includes('synthesize(job.script, voice.id, routed)') && render.includes('billedCostUsd(result.generationId, result.servedBy)'))
    assert.ok(speakRoute.includes('narrationCallContext({ userId: deck.userId, sessionId: deck.sessionId })') && speakRoute.includes("speakFixedLine(RUNNING_LONG_LINE, voice, 'running-long', routed)") && speakRoute.includes('speakAnswer(spokenPrecis(text), voice, routed)'))
    assert.ok(sample.includes('narrationCallContext({ userId: auth.user.id })') && sample.includes('synthesize(SAMPLE_TEXT, voiceId, narrationCallContext('))
    assert.ok(spoken.includes('synthesize(text, voice.id, context)') && (spoken.match(/synthesize\(text, voice\.id, context\)/g) ?? []).length === 2 && !/synthesize\(text, voice\.id\)/.test(spoken))
    for (const text of [script, render, speakRoute, sample]) assert.ok(!/narrationCallContext\([^)]*email/i.test(text), 'an e-mail is handed to the context')
  })
  test('the routes are the base\'s routes plus only the new lines (undo them and the base comes back byte for byte)', () => {
    const undo = {
      [R_SCRIPT]: [
        ["import { narrationCallContext } from '@/lib/narration/model-router';\n", ''],
        ["    // One trace and one identity for the whole script run, for the model router. Undefined unless NARRATION_VIA_ROUTER is on.\n    const routed = narrationCallContext({ userId: user.id, sessionId: deck.sessionId, presentationId });\n", ''],
        ['              allocation.compressedWords,\n              routed\n', '              allocation.compressedWords\n'],
        ['          45,\n          25,\n          routed\n', '          45,\n          25\n'],
      ],
      [R_RENDER]: [
        ["import { narrationCallContext } from '@/lib/narration/model-router';\n", ''],
        ["    // One trace and one identity for the whole render, for the model router. Undefined unless NARRATION_VIA_ROUTER is on.\n    const routed = narrationCallContext({ userId: user.id, sessionId: deck.sessionId, presentationId });\n", ''],
        ['synthesize(job.script, voice.id, routed)', 'synthesize(job.script, voice.id)'],
        ['billedCostUsd(result.generationId, result.servedBy)', 'billedCostUsd(result.generationId)'],
      ],
      [R_SPEAK]: [
        ["import { narrationCallContext } from '@/lib/narration/model-router';\n", ''],
        ["    // Who the model router bills these lines to: the publisher, over this deck's session. Undefined unless NARRATION_VIA_ROUTER is on.\n    const routed = narrationCallContext({ userId: deck.userId, sessionId: deck.sessionId });\n", ''],
        ["'running-long', routed)", "'running-long')"],
        ['spokenPrecis(text), voice, routed)', 'spokenPrecis(text), voice)'],
      ],
      [R_SAMPLE]: [
        ["import { narrationCallContext } from '@/lib/narration/model-router';\n", ''],
        ["    // The signed-in person's opaque id for the model router; undefined unless NARRATION_VIA_ROUTER is on.\n    const result = await synthesize(SAMPLE_TEXT, voiceId, narrationCallContext({ userId: auth.user.id }));", '    const result = await synthesize(SAMPLE_TEXT, voiceId);'],
      ],
      [SPOKEN]: [
        ["import type { NarrationCallContext } from './model-router'\n", ''],
        ['  slot: string,\n  context?: NarrationCallContext\n)', '  slot: string\n)'],
        ['  voiceId: string,\n  context?: NarrationCallContext\n): Promise<{ body: Buffer; contentType: string; costCents', '  voiceId: string\n): Promise<{ body: Buffer; contentType: string; costCents'],
        ['synthesize(text, voice.id, context)', 'synthesize(text, voice.id)'],
      ],
    }
    for (const [rel, edits] of Object.entries(undo)) {
      let text = S[rel]
      for (const [from, to] of edits) { assert.ok(text.includes(from), `${rel}: expected text missing: ${from.slice(0, 60)}`); text = text.split(from).join(to) }
      const base = baseSource(rel)
      if (base == null) { console.log(`SKIP ${rel} against the base: the base commit is not in this clone`); continue }
      assert.equal(sha(text), sha(base), `${rel}: more than the new lines changed`)
    }
  })
  test('the new variables are server-only: never public, and the key name is read in model-router.ts alone', () => {
    const lib = S[LIB]
    assert.ok(/process\.env\.NARRATION_VIA_ROUTER === 'true'/.test(lib) && !/NEXT_PUBLIC_/.test(lib))
    assert.ok(!/NEXT_PUBLIC_(NARRATION_VIA_ROUTER|MODEL_ROUTER)/.test(S[ENV] + S[PKG]))
    const hits = []
    const walk = dir => {
      for (const entry of fs.readdirSync(path.join(repoRoot, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`
        if (entry.isDirectory()) { if (!['node_modules', '.next', '.git'].includes(entry.name)) walk(rel) }
        else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name) && /MODEL_ROUTER_STUDIO_KEY/.test(fs.readFileSync(path.join(repoRoot, rel), 'utf8'))) hits.push(rel)
      }
    }
    for (const dir of ['lib', 'app', 'components', 'hooks']) walk(dir)
    assert.deepEqual(hits, [LIB])
    assert.ok(!/['"]use client['"]/.test(lib))
  })
  test('.env.example: the flag "false" and the two empty variables, once each, in a block after #473\'s model catalog block and before PASS2 ADMIN; package.json registers the test last; both append-only over 13c90ea', () => {
    const env = S[ENV]
    assert.equal(env.split('\nNARRATION_VIA_ROUTER="false"\n').length - 1, 1)
    assert.equal(env.split('\nMODEL_ROUTER_URL=\n').length - 1, 1); assert.equal(env.split('\nMODEL_ROUTER_STUDIO_KEY=\n').length - 1, 1)
    assert.ok(env.indexOf('NARRATION_VIA_ROUTER="false"') < env.indexOf('MODEL_ROUTER_URL=') && env.indexOf('MODEL_ROUTER_URL=') < env.indexOf('MODEL_ROUTER_STUDIO_KEY='))
    assert.equal(JSON.parse(S[PKG]).scripts['test:studio-narration-router'], 'node scripts/test-studio-narration-router.mjs')
    for (const rel of [ENV, PKG]) {
      const baseText = baseSource(rel)
      if (baseText == null) { console.log(`SKIP ${rel} append-only check: the base commit is not in this clone`); continue }
      const norm = line => (rel === PKG ? line.replace(/,\s*$/, '') : line)
      const want = baseText.split('\n').map(norm), extras = []
      let next = 0
      for (const line of S[rel].split('\n').map(norm)) { if (next < want.length && line === want[next]) next++; else extras.push(line) }
      const kind = rel === PKG ? /^\s*"test:[a-z0-9-]+": "node scripts\/test-[a-z0-9-]+\.mjs"$/ : /^\s*$|^\s*#|^[A-Z][A-Z0-9_]*=/
      assert.equal(next, want.length, `${rel}: a base line is missing or out of order`)
      assert.ok(extras.every(line => line === '' || kind.test(line)), `${rel}: an unexpected extra line: ${extras.find(line => line !== '' && !kind.test(line))}`)
    }
    // Stacked order: after #473's model catalog block (the last PASS3 block), before FRONTEND-1's PASS2 ADMIN and Docs blocks (their mutants find a block with lastIndexOf, so those stay last).
    const at = env.lastIndexOf('# STUDIO NARRATION THROUGH THE MODEL ROUTER')
    assert.ok(at > 0 && env.indexOf('# STUDIO NARRATION THROUGH THE MODEL ROUTER') === at, 'one block')
    for (const earlier of ['NEXT_PUBLIC_CHAT_ELEMENT_REFINE="false"', 'NEXT_PUBLIC_CHAT_EXPORT="false"', 'NEXT_PUBLIC_STUDIO_MODEL_CATALOG="false"']) if (env.includes(earlier)) assert.ok(env.indexOf(earlier) < at, `after ${earlier.split('=')[0]}'s block`)
    for (const later of ['# PASS2 ADMIN', '# PASS2 Docs / Help / Legal / Agents']) if (env.includes(later)) assert.ok(at < env.indexOf(later), `before FRONTEND-1's ${later}`)
    if (env.includes('NEXT_PUBLIC_STUDIO_P2_DOCS="false"')) assert.ok(env.indexOf('NEXT_PUBLIC_STUDIO_P2_ADMIN="false"') < env.indexOf('NEXT_PUBLIC_STUDIO_P2_DOCS="false"') && env.slice(env.indexOf('NEXT_PUBLIC_STUDIO_P2_DOCS="false"\n') + 'NEXT_PUBLIC_STUDIO_P2_DOCS="false"\n'.length).split('\n').every(line => /^\s*$|^\s*#|^[A-Z][A-Z0-9_]*=/.test(line)), 'ADMIN then DOCS are still the last two of FRONTEND-1\'s blocks (only a later change\'s comments, blanks and assignments may follow)')
    const block = env.slice(at, env.indexOf('MODEL_ROUTER_STUDIO_KEY=\n', at))
    for (const phrase of ['only the string "true"', 'no public prefix', 'never committed', 'ONLY when the router cannot be', '401 or 403', '502, 503 or 504', 'a 429', 'second charge', 'X-MR-Service "studio"']) assert.ok(block.includes(phrase), `the .env.example block lost: ${phrase}`)
    assert.ok(!/READ AT BUILD TIME|exact value "true"|exact "true"|default off|Needs the Studio shell|Nothing is sent or stored|Build-time flag|PASS2|PASS3/.test(block), 'the block reuses another block\'s phrase')
    for (const line of block.split('\n')) if (line.length > 40) assert.equal(env.split(line).length - 1, 1, `no line of the block is repeated elsewhere: ${line.slice(0, 50)}`)
  })
  test('the strip module: without this change\'s block and line .env.example and package.json are 13c90ea\'s files byte for byte (a pure insertion); every other file comes back as it is', () => {
    assert.ok(S[STRIP] != null, `${STRIP} exists`)
    const { stripNarrationRouter, NARRATION_ROUTER_FILES } = loadStrip(S[STRIP])
    assert.deepEqual(NARRATION_ROUTER_FILES, [ENV, PKG], 'the two shared files')
    for (const rel of NARRATION_ROUTER_FILES) {
      const baseText = baseSource(rel)
      if (baseText == null) { console.log(`SKIP ${rel} strip against the base: the base commit is not in this clone`); continue }
      assert.ok(sameAsBase(rel, stripNarrationRouter(rel, S[rel]), baseText, /NARRATION_VIA_ROUTER|MODEL_ROUTER_URL|MODEL_ROUTER_STUDIO_KEY/) || (rel === PKG && loadStack(S[STACK_TOLERANT]).sameOrTolerant(rel, S[rel], stripNarrationRouter(rel, S[rel]), baseText, NR_PKG_CHANGES).ok), `${rel} without this change's lines is ${BASE_COMMIT.slice(0, 7)}'s file byte for byte (.env.example: a later change's block may follow; package.json: a later PR's lines, every base line kept in order)`)
      assert.equal(stripNarrationRouter(rel, stripNarrationRouter(rel, S[rel])), stripNarrationRouter(rel, S[rel]), `${rel}: stripping twice changes nothing more`)
      assert.equal(stripNarrationRouter(rel, baseText), baseText, `${rel}: a file without the lines comes back as it is`)
    }
    for (const other of ['app/builder/page.tsx', LIB, 'README.md']) assert.equal(stripNarrationRouter(other, 'some text'), 'some text', `${other} comes back as it is`)
    // the registration stays strippable when something is stacked after it (not the last entry)
    const mid = S[PKG].replace('"node scripts/test-studio-narration-router.mjs"', '"node scripts/test-studio-narration-router.mjs",\n    "test:studio-later": "node scripts/test-later.mjs"')
    assert.notEqual(mid, S[PKG], 'a later registration was put in')
    const baseText = baseSource(PKG)
    if (baseText != null) assert.equal(stripNarrationRouter(PKG, mid), baseText.replace(/\n  \},\n  "dependencies"/, ',\n    "test:studio-later": "node scripts/test-later.mjs"\n  },\n  "dependencies"'), 'package.json: the registration comes out of the middle of the list')
  })
  test('stacked scope: the committed tree (git diff BASE HEAD, not the working tree) differs from 13c90ea in this change\'s files only, and only by its lines', () => {
    const names = gitOut('diff', '--name-only', BASE_COMMIT, 'HEAD', '--', '.')
    if (names == null) { console.log('SKIP stacked scope: the base commit is not in this clone'); return }
    const changed = names.split('\n').filter(Boolean)
    changed.splice(0, changed.length, ...changed.filter(rel => !/^(app\/api\/templates\/\[id\]\/route\.ts|components\/studio-libraries\/(library-manage|templates-workspace)\.tsx|hooks\/use-templates\.ts|lib\/studio-library-manage\.ts|scripts\/(studio-library-manage-strip|test-studio-route-params|test-studio-template-library-manage|test-studio-theme-library-manage)\.mjs|scripts\/fixtures\/template-rename\/.+)$/.test(rel))) // stacked after #475: the template rename's own files (PR #477) are not this change's to answer for
    const SIBLINGS = ['scripts/test-studio-model-catalog.mjs', 'scripts/test-studio-chat-theme-export.mjs', 'scripts/test-studio-chat-element-refine.mjs'] // #473's, #472's and #470's tests accept this change's lines (tests only)
    const own = new Set([LIB, DRAFT, TTS, SPOKEN, R_SCRIPT, R_RENDER, R_SPEAK, R_SAMPLE, ENV, PKG, STRIP, HARNESS, 'scripts/test-studio-narration-router.mjs', ...SIBLINGS, 'scripts/studio-env-append-tolerant.mjs', 'scripts/test-studio-env-append-tolerant.mjs'])
    const stack = loadStack(S[STACK_TOLERANT]), scope = stack.stackScope(changed, stack.STACK[475], rel => own.has(rel)) // only this change's frozen files, its family and the stack declared above are checked; a later PR's files are ignored
    assert.equal(stack.STACK[475].base, BASE_COMMIT)
    assert.deepEqual((gitOut('diff', '--name-only', stack.STACK[475].base, stack.STACK[475].head) ?? '').split('\n').filter(Boolean), stack.STACK[475].files, 'the frozen files are #475\'s own diff')
    assert.deepEqual({ missing: scope.missing, stray: scope.stray }, { missing: [], stray: [] }, 'every frozen file is changed, no stray in its family')
    console.log(scope.line)
    for (const rel of scope.checked) assert.ok(own.has(rel), `stacked scope: ${rel} is not this change's`)
    for (const rel of [LIB, DRAFT, TTS, SPOKEN, R_SCRIPT, R_RENDER, R_SPEAK, R_SAMPLE, ENV, PKG, STRIP, HARNESS]) assert.ok(changed.includes(rel), `stacked scope: ${rel} is part of this change`)
    const lines = (rel, sign) => (gitOut('diff', '-U0', BASE_COMMIT, 'HEAD', '--', rel) ?? '').split('\n').filter(line => line.startsWith(sign) && !line.startsWith(sign.repeat(3)))
    assert.equal(lines(ENV, '-').length, 0, 'stacked scope: .env.example only gains lines (a pure insertion)')
    assert.ok(lines(ENV, '+').every(line => /^\+(#|[A-Z][A-Z0-9_]*=|$)/.test(line)) && lines(ENV, '+').some(line => line.startsWith('+NARRATION_VIA_ROUTER=')), 'stacked scope: and they are comments, blanks and assignments, this block among them (a later change\'s block may follow)')
    assert.ok(lines(PKG, '-').length <= 1 && lines(PKG, '-').every(line => /test:studio-model-catalog/.test(line)), 'stacked scope: package.json: at most #473\'s entry, which gains a comma')
    assert.ok(lines(PKG, '+').some(line => /test:studio-narration-router/.test(line)), 'stacked scope: package.json: this change\'s registration follows')
    assert.ok(lines(HARNESS, '-').length <= 1 && lines(HARNESS, '-').every(line => /#469 deck-mutation dedupe\)/.test(line)), 'stacked scope: the harness: at most its comment line was extended')
    const harnessAdded = lines(HARNESS, '+').filter(line => !/FRONTEND-1 template rename|'app\/api\/templates\/\[id\]\/route\.ts'/.test(line)) // minus the template rename's (PR #477) two lines in the stacked list
    assert.ok(harnessAdded.length >= 3 && harnessAdded.every(line => /narration|NARRATION/.test(line)), 'stacked scope: the stacked list gains this change\'s files only')
    for (const rel of SIBLINGS.filter(rel => changed.includes(rel))) {
      assert.ok(lines(rel, '+').every(line => /NarrationRouter|narration-router|NARRATION_ROUTER|#475/.test(line)), `stacked scope: ${rel}: every added line names this change`)
      assert.ok(lines(rel, '-').length <= 8, `stacked scope: ${rel}: only a few lines were extended`)
    }
  })
  test('the stack-tolerant rules (scripts/studio-stack-tolerant.mjs) on this change: a base line dropped from package.json, this change\'s line left after its strip or gone from HEAD, an own file missing and a stray in its family are refused; a later PR\'s line and file are taken', () => {
    const names = gitOut('diff', '--name-only', BASE_COMMIT, 'HEAD', '--', '.'), baseText = baseSource(PKG)
    if (names == null || baseText == null) { console.log('SKIP stack-tolerant rules: the base commit is not in this clone'); return }
    const stack = loadStack(S[STACK_TOLERANT]), known = rel => stack.STACK[475].files.includes(rel) || /^scripts\/(test-)?studio-env-append-tolerant\.mjs$/.test(rel) // the stack declared in the scope test above
    const results = stack.stackMutants({ change: stack.STACK[475], changed: names.split('\n').filter(Boolean), known,
      shared: [{ rel: PKG, head: S[PKG], strip: text => loadStrip(S[STRIP]).stripNarrationRouter(PKG, text), base: baseText, changes: NR_PKG_CHANGES }] })
    for (const [label, held] of results) assert.ok(held, label)
    console.log(`stack-tolerant (#475): ${results.filter(([label]) => label.includes('mutant:')).length} mutants caught, ${results.filter(([label]) => label.includes('control:')).length} controls taken`)
  })
  test('the draft model, its fields and the prompt are untouched (the router call is the same JSON as the direct one)', () => {
    const body = S[DRAFT].slice(S[DRAFT].indexOf('const requestBody = JSON.stringify({'), S[DRAFT].indexOf('const { response } = await callModel'))
    const baseDraft = baseSource(DRAFT)
    if (baseDraft == null) return
    for (const piece of ["model: DRAFT_MODEL,", "{ role: 'system', content: SYSTEM_PROMPT },", 'buildUserPrompt(slide, words, compressedWords)', 'temperature: 0.4,', "response_format: { type: 'json_object' },"]) {
      assert.ok(body.includes(piece), piece); assert.ok(baseDraft.includes(piece), piece)
    }
    assert.equal(S[DRAFT].slice(0, S[DRAFT].indexOf('export async function draftSlideScript')).replace("import { callModel, routerSettings, ROUTER_DRAFT_TIMEOUT_MS, type NarrationCallContext } from './model-router'\n", ''), baseDraft.slice(0, baseDraft.indexOf('export async function draftSlideScript')), 'the draft file changed above the call')
  })
  return tests
}

async function runSuite(S, { log = false } = {}) {
  const failures = []
  let passed = 0
  const originalLog = console.log
  for (const [name, fn] of buildTests(S)) {
    if (!log) console.log = () => {}
    try { await fn(); passed++; if (log) console.log(`PASS ${name}`) }
    catch (error) { failures.push([name, error]); if (log) console.log(`FAIL ${name}\n  ${String(error?.message ?? error).split('\n').slice(0, 6).join('\n  ')}`) }
    finally { console.log = originalLog }
  }
  return { passed, failures }
}

// ---------- mutants: each edit of the new code must fail at least one check ----------
const MUTANTS = [
  [LIB, "process.env.NARRATION_VIA_ROUTER === 'true'", "process.env.NARRATION_VIA_ROUTER !== 'false'", 'any value but "false" turns it on'],
  [LIB, "process.env.NARRATION_VIA_ROUTER === 'true'", "process.env.NARRATION_VIA_ROUTER === 'true' || process.env.NARRATION_VIA_ROUTER === '1'", '"1" turns it on'],
  [LIB, 'if (!narrationViaRouterOn()) return null\n  const baseUrl = routerBase(process.env.MODEL_ROUTER_URL)', 'const baseUrl = routerBase(process.env.MODEL_ROUTER_URL)\n  if (!narrationViaRouterOn()) return null', 'the router variables are read with the flag off'],
  [LIB, "response.status === 401 || response.status === 403", "response.status === 401", '403 no longer falls back'],
  [LIB, "response.status === 401 || response.status === 403", "response.status === 401 || response.status === 403 || response.status === 429", '429 falls back'],
  [LIB, "response.status === 401 || response.status === 403", "response.status === 401 || response.status === 403 || response.status === 500", '500 falls back'],
  [LIB, 'return !carriesErrorObject(await response.clone().text())', 'return true', '5xx falls back even with an error object'],
  [LIB, 'return !carriesErrorObject(await response.clone().text())', 'return false', '5xx never falls back'],
  [LIB, "(typeof error === 'string' && error.length > 0)", 'false', 'a string error no longer counts as the router\'s'],
  [LIB, 'if (direct && isConnectFailure(error)) return goDirect', 'if (direct) return goDirect', 'any thrown error (a read timeout) falls back'],
  [LIB, 'if (direct && isConnectFailure(error)) return goDirect', 'if (isConnectFailure(error)) return goDirect', 'falls back with no direct key'],
  [LIB, 'if (direct && (await routerDidNothing(response)))', 'if (await routerDidNothing(response))', 'falls back with no direct key (status)'],
  [LIB, "  'UND_ERR_CONNECT_TIMEOUT',\n", '', 'a connect timeout is final'],
  [LIB, "  'ECONNREFUSED',\n", '', 'a refused connection is final'],
  [LIB, "if (code === 'ETIMEDOUT' && syscall === 'connect') return true", "if (code === 'ETIMEDOUT') return true", 'an ETIMEDOUT on an open connection falls back'],
  [LIB, "  'ENOTFOUND',\n", "  'ENOTFOUND',\n  'UND_ERR_SOCKET',\n", 'a reset after sending falls back'],
  [LIB, '/^(CERT_|', '/^(NOPE_|', 'a certificate failure is final'],
  [LIB, "headers['X-MR-Service'] = 'studio'", "headers['X-MR-Service'] = 'studio'\n  headers['X-MR-Group'] = 'default'", 'X-MR-Group is sent'],
  [LIB, "headers['X-MR-Service'] = 'studio'", "headers['X-MR-Service'] = 'Studio'", 'service label changed'],
  [LIB, "if (task) headers['X-MR-Task'] = task", '', 'no task label'],
  [LIB, "for (const [name, value] of identity) if (value) headers[name] = value", "for (const [name, value] of identity) headers[name] = String(value)", 'invalid ids sent as "null"'],
  [LIB, "return typeof value === 'string' && ID_SHAPE.test(value) ? value : null", "return typeof value === 'string' && value ? value : null", 'any string is an id (an e-mail is sent)'],
  [LIB, 'const ID_SHAPE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/', 'const ID_SHAPE = /^[A-Za-z0-9._:-]{1,255}$/', 'an id may start with a dot'],
  [LIB, 'const ID_SHAPE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/', 'const ID_SHAPE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,300}$/', 'ids longer than 255 are sent'],
  [LIB, 'const ID_SHAPE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/', 'const ID_SHAPE = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,254}$/', 'an @ is allowed in an id'],
  [LIB, "return `trc_${randomBytes(6).toString('hex')}`", "return `trc_${randomBytes(4).toString('hex')}`", 'trace id has 8 hex'],
  [LIB, "return `trc_${randomBytes(6).toString('hex')}`", "return 'trc_000000000000'", 'trace id is constant'],
  [LIB, 'if (!narrationViaRouterOn()) return undefined\n  return { ...ids, traceId: mintNarrationTraceId() }', 'return { ...ids, traceId: mintNarrationTraceId() }', 'a context is made with the flag off'],
  [LIB, 'signal: AbortSignal.timeout(call.timeoutMs),', '', 'no timeout on a routed call'],
  [LIB, 'export const ROUTER_SPEECH_TIMEOUT_MS = 200_000', 'export const ROUTER_SPEECH_TIMEOUT_MS = 100_000', 'speech timeout under 190 s'],
  [LIB, 'export const ROUTER_DRAFT_TIMEOUT_MS = 120_000', 'export const ROUTER_DRAFT_TIMEOUT_MS = 2_000', 'draft timeout too short'],
  [LIB, 'export const ROUTER_LOOKUP_TIMEOUT_MS = 10_000', 'export const ROUTER_LOOKUP_TIMEOUT_MS = 200_000', 'the lookup can hold a render for minutes'],
  [LIB, 'headers.Authorization = `Bearer ${router.key}`', 'headers.Authorization = `Bearer ${router.key}`\n  headers["X-MR-Key"] = router.key', 'the key in a second header'],
  [LIB, "console.warn(`[Narration] ${message}`)", "console.warn(`[Narration] ${message} ${process.env.MODEL_ROUTER_STUDIO_KEY}`)", 'the key in a log line'],
  [LIB, "console.warn(`[Narration] ${message}`)", "console.warn(`[Narration] ${message} ${process.env.MODEL_ROUTER_URL}`)", 'the router address in a log line'],
  [LIB, 'if (logged.has(id)) return', '', 'a log line on every call'],
  [LIB, '!KEY_SHAPE.test(key)', 'false', 'an unusable key is used'],
  [LIB, "  return `${url.origin}${url.pathname}`.replace(/\\/+$/, '').replace(/\\/v1$/, '')", "  return `${url.origin}${url.pathname}`.replace(/\\/+$/, '')", 'a pasted /v1 is doubled'],
  [LIB, "if (url.protocol !== 'https:' && url.protocol !== 'http:') return null", '', 'any scheme is a router address'],
  [LIB, 'return { response: await fetch(direct.url, direct.init), servedBy: \'direct\' }\n  }\n\n  const goDirect', 'return { response: await fetch(direct.url, { ...direct.init, signal: AbortSignal.timeout(call.timeoutMs) }), servedBy: \'direct\' }\n  }\n\n  const goDirect', 'a signal is added to a direct call'],
  [LIB, 'const init: RequestInit = {\n    method: call.body === undefined ? \'GET\' : \'POST\',', 'const init: RequestInit = {\n    method: \'POST\',', 'the cost lookup is a POST'],
  [DRAFT, "task: 'studio.narration_draft',", "task: 'studio.narration_tts',", 'draft labelled as speech'],
  [TTS, "task: 'studio.narration_tts',", "task: 'studio.narration_draft',", 'speech labelled as a draft'],
  [DRAFT, '    body: requestBody,\n    direct:', '    body: requestBody.replace(\'"temperature":0.4\', \'"temperature":0.5\'),\n    direct:', 'the routed draft body differs'],
  [TTS, '        body: requestBody,\n        direct:', '        body: requestBody.replace(\'"input"\', \'"user":"x","input"\'),\n        direct:', 'the routed speech body differs'],
  [DRAFT, "path: '/v1/chat/completions'", "path: '/v1/completions'", 'draft to the wrong path'],
  [TTS, "path: '/v1/audio/speech'", "path: '/v1/speech'", 'speech to the wrong path'],
  [TTS, "path: `/v1/generation?id=${encodeURIComponent(generationId)}`", "path: `/v1/generation?id=${generationId}`", 'the generation id is not encoded'],
  [DRAFT, "if (!key && !router) throw new DraftError", "if (!key) throw new DraftError", 'the router alone is not enough for a draft'],
  [TTS, "if (!key && !router) {\n      throw", "if (!key) {\n      throw", 'the router alone is not enough for speech'],
  [TTS, 'return Boolean(process.env.OPENROUTER_API_KEY) || routerSettings() !== null', 'return Boolean(process.env.OPENROUTER_API_KEY)', 'configured ignores the router'],
  [TTS, "const router = servedBy === 'direct' ? null : routerSettings()", 'const router = routerSettings()', 'the lookup ignores where the audio came from'],
  [TTS, '...(router ? { servedBy } : {}),', 'servedBy,', 'servedBy is set with the flag off'],
  [TTS, '...(router ? { servedBy } : {}),', '', 'servedBy is never set'],
  [TTS, 'if (!generationId || (!key && !router)) return null', 'if (!generationId) return null', 'the lookup runs with no key at all'],
  [TTS, 'context?: NarrationCallContext\n): Promise<SynthesisResult> {\n  return mediaProvider.synthesize(text, getVoice(voiceId), context)', 'context?: NarrationCallContext\n): Promise<SynthesisResult> {\n  return mediaProvider.synthesize(text, getVoice(voiceId))', 'synthesize drops the context'],
  [SPOKEN, "const result = await synthesize(text, voice.id, context)\n    const audio = audioFrom(result)\n    await putMedia", "const result = await synthesize(text, voice.id)\n    const audio = audioFrom(result)\n    await putMedia", 'the fixed line drops the context'],
  [R_RENDER, 'billedCostUsd(result.generationId, result.servedBy)', 'billedCostUsd(result.generationId)', 'the render route drops servedBy'],
  [R_SCRIPT, "narrationCallContext({ userId: user.id, sessionId: deck.sessionId, presentationId })", "narrationCallContext({ userId: auth.user.email, sessionId: deck.sessionId, presentationId })", 'the script route hands over the e-mail'],
  [R_SAMPLE, 'narrationCallContext({ userId: auth.user.id })', 'narrationCallContext({ userId: auth.user.email })', 'the sample route hands over the e-mail'],
  [R_SPEAK, "speakAnswer(spokenPrecis(text), voice, routed)", "speakAnswer(spokenPrecis(text), voice)", 'the speak route drops the context'],
  [ENV, 'NARRATION_VIA_ROUTER="false"', 'NARRATION_VIA_ROUTER="true"', 'the flag defaults on in the example'],
  [ENV, '\nMODEL_ROUTER_STUDIO_KEY=\n', '\nMODEL_ROUTER_STUDIO_KEY=placeholder\n', 'a value in the key line'],
  [ENV, '\nMODEL_ROUTER_URL=\n', '\nNEXT_PUBLIC_MODEL_ROUTER_URL=\n', 'the URL is public'],
  [ENV, 'ONLY when the router cannot be', 'whenever the router cannot be', 'the example misstates the fallback'],
  [ENV, '# STUDIO NARRATION THROUGH THE MODEL ROUTER', t => { const at = t.indexOf('# STUDIO NARRATION THROUGH THE MODEL ROUTER'); const end = t.indexOf('MODEL_ROUTER_STUDIO_KEY=\n', at) + 'MODEL_ROUTER_STUDIO_KEY=\n'.length; return t.slice(0, at) + t.slice(end + 1) + '\n' + t.slice(at, end) }, 'the block moved after the PASS2 ADMIN and Docs blocks'],
  [ENV, '# STUDIO NARRATION THROUGH THE MODEL ROUTER', t => { const at = t.indexOf('# STUDIO NARRATION THROUGH THE MODEL ROUTER'); const end = t.indexOf('MODEL_ROUTER_STUDIO_KEY=\n', at) + 'MODEL_ROUTER_STUDIO_KEY=\n'.length; const block = t.slice(at, end); const rest = t.slice(0, at) + t.slice(end + 1); const refine = rest.indexOf('# PASS3 REFINE AN ELEMENT FROM CHAT'); return rest.slice(0, refine) + block + '\n' + rest.slice(refine) }, 'the block moved above the refine and theme / export blocks'],
  [ENV, '# STUDIO NARRATION THROUGH THE MODEL ROUTER', t => { const at = t.indexOf('# STUDIO NARRATION THROUGH THE MODEL ROUTER'); const end = t.indexOf('MODEL_ROUTER_STUDIO_KEY=\n', at) + 'MODEL_ROUTER_STUDIO_KEY=\n'.length; const block = t.slice(at, end); const rest = t.slice(0, at) + t.slice(end + 1); const catalog = rest.indexOf('# PASS3 MODEL CATALOG'); return rest.slice(0, catalog) + block + '\n' + rest.slice(catalog) }, 'the block moved above #473\'s model catalog block'],
  [ENV, 'NEXT_PUBLIC_STUDIO_P2_ADMIN="false"', 'NEXT_PUBLIC_STUDIO_P2_ADMIN="true"', 'a base line changed'],
  [STRIP, "return text.replace(ENV_BLOCK, '')", 'return text', 'the env block is not stripped'],
  [STRIP, 'MODEL_ROUTER_STUDIO_KEY=\\n\\n/', 'MODEL_ROUTER_STUDIO_KEY=\\n/', 'the env block strip leaves its blank line'],
  [STRIP, "text.includes(last) ? text.replace(last, '\\n') : text.replace(`${PACKAGE_LINE},\\n`, '')", 'text', 'the registration is not stripped'],
  [STRIP, "text.replace(last, '\\n')", "text.replace(last, ',\\n')", 'the previous entry keeps its comma'],
  [STRIP, ": text.replace(`${PACKAGE_LINE},\\n`, '')", ': text', 'the middle of the list is not handled'],
  [STRIP, '  return text\n}', "  return text + ' '\n}", 'another file is changed'],
  [STRIP, "export const NARRATION_ROUTER_FILES = ['.env.example', 'package.json']", "export const NARRATION_ROUTER_FILES = ['.env.example', 'package.json', 'README.md']", 'a third file is claimed'],
  [PKG, ',\n    "test:studio-narration-router": "node scripts/test-studio-narration-router.mjs"', '', 'the test is not registered'],
  [PKG, '"test:studio-narration-router": "node scripts/test-studio-narration-router.mjs"', '"test:studio-narration-router": "node scripts/test-studio-narration-router-2.mjs"', 'the test is registered to another file'],
  // scripts/studio-stack-tolerant.mjs: each rule taken out must be caught (by the scope test, the strip test or the stack-tolerant test)
  [STACK_TOLERANT, 'if (next < want.length) return { ok: false', 'if (false) return { ok: false', 'a base line may be dropped from a shared file'],
  [STACK_TOLERANT, 'if (leftover !== undefined) return', 'if (false) return', 'this change\'s line may stay after its strip'],
  [STACK_TOLERANT, 'if (gone !== undefined) return', 'if (false) return', 'this change\'s lines may be gone from HEAD'],
  [STACK_TOLERANT, 'if (own.length === 0) return', 'if (false) return', 'a shared file with no line of this change to look for passes'],
  [STACK_TOLERANT, 'if (stripped === baseText) return { ok: true, exact: true', 'if (false) return { ok: true, exact: true', 'the byte-for-byte case is not told apart'],
  [STACK_TOLERANT, 'const missing = change.files.filter(rel => !changed.includes(rel))', 'const missing = []', 'an own file may be missing'],
  [STACK_TOLERANT, 'else if (change.family.test(rel)) { checked.push(rel); stray.push(rel) }', 'else if (false) { checked.push(rel); stray.push(rel) }', 'a stray in this change\'s family is ignored like a later PR\'s file'],
  [STACK_TOLERANT, '    else ignored.push(rel)', '    else checked.push(rel)', 'a later PR\'s file is not ignored'],
]

// ---------- run ----------
const head = headSources()
if (head[LIB] == null) console.log(`NOTE ${LIB} does not exist in this tree (this is what the base looks like to this test)`)
const { passed, failures } = await runSuite(head, { log: true })
let killed = 0
const survivors = []
if (failures.length === 0) {
  for (const [rel, from, to, why] of MUTANTS) {
    assert.ok(head[rel]?.includes(from), `mutant anchor missing in ${rel}: ${from}`)
    assert.equal(head[rel].split(from).length - 1, 1, `mutant anchor is not unique in ${rel}: ${from}`)
    const mutated = await runSuite({ ...head, [rel]: typeof to === 'function' ? to(head[rel]) : head[rel].replace(from, () => to) })
    if (mutated.failures.length === 0) survivors.push(`${rel}: ${why}`)
    else killed++
  }
  console.log(`${survivors.length === 0 ? 'PASS' : 'FAIL'} mutation check: ${killed} of ${MUTANTS.length} mutants fail at least one check${survivors.length ? `; survivors: ${survivors.join(' | ')}` : ''}`)
}
console.log(`\n${passed} checks passed, ${failures.length} failed`)
if (failures.length || survivors.length) process.exitCode = 1
