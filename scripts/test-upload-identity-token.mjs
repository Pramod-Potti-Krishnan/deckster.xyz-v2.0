/**
 * R-20261007-frontend-27: the session token on browser -> Researcher upload calls
 * (flag NEXT_PUBLIC_UPLOAD_IDENTITY_TOKEN_ENABLED, default off).
 *
 * Offline and keyless: `fetch` is a stub for the mint route, the Researcher and the
 * storage PUT; the real upload hook, upload library, wrapper and token helper are
 * compiled and run unchanged (a tiny React-hooks shim stands in for React). Every id
 * and token below is a made-up string.
 *
 * Optional proof mode: UPLOAD_IDENTITY_TOKEN_BASE_REF=<git ref of the stacked base, e.g.
 * origin/ops2/upload-owner-and-identity-token> replays the same flag-off scenarios
 * against the base commit's hook and upload library and requires the recorded
 * requests, toasts and chips to be identical, then prints a SHA-256 of both runs.
 */
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FLAG = 'NEXT_PUBLIC_UPLOAD_IDENTITY_TOKEN_ENABLED'
const OWNER_FLAG = 'NEXT_PUBLIC_UPLOAD_OWNER_ID_ENABLED'
const SHELL_ENV = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const HEADER = 'X-Deckster-Session-Token'
const RESEARCHER = 'http://researcher.test'
const CUID = 'cm8xk2l0a0000abcdefghij123'
const CHAT = 'sess-1234567890' // the hook's chat session id
const LIB_CHAT = 'sess-1' // the upload library's session id
const RS = 'researcher-session-1' // what the stubbed Researcher's create answers: not the chat id, on purpose
const NOT_YOURS = /does not belong to your account/

const env = {}
const readWorking = rel => fs.readFileSync(path.join(REPO, rel), 'utf8')
const readBase = (ref, rel) => execFileSync('git', ['show', `${ref}:${rel}`], { cwd: REPO, encoding: 'utf8' })

const transpiled = new Map()
function compileSource(source, imports, globals) {
  if (!transpiled.has(source)) {
    transpiled.set(source, ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText)
  }
  const output = transpiled.get(source)
  const module = { exports: {} }
  vm.runInNewContext(output, {
    module,
    exports: module.exports,
    Promise, Set, Map, Error, JSON, Math, Date, Array, Object, String, Number, Boolean, RegExp,
    URL, URLSearchParams, File, Response, Headers, encodeURIComponent, clearTimeout,
    process: { env },
    require: name => {
      if (!(name in imports)) throw new Error(`Unexpected import ${name}`)
      return imports[name]
    },
    ...globals,
  })
  return module.exports
}

// ----------------------------------------------------------------- the world
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const flat = headers => {
  if (!headers) return {}
  if (typeof Headers !== 'undefined' && headers instanceof Headers) return Object.fromEntries(headers.entries())
  if (Array.isArray(headers)) return Object.fromEntries(headers)
  return { ...headers }
}
const plain = value => JSON.parse(JSON.stringify(value)) // objects built inside the vm have their own prototypes
const tokenSid = value => String(value).split('.')[1]

function makeWorld(options = {}) {
  const w = {
    calls: [], mints: [], logs: [], toasts: [], timeouts: [], delays: [],
    replies: { create: [], prepare: [], process: [], poll: [] }, // one-shot replies, consumed in order
    mint: options.mint ?? null, // null: mint normally; else (sid, count) => Response | Error
    createSessionId: options.createSessionId ?? RS,
    jobId: options.noJob ? undefined : 'job-1',
  }
  w.fetch = async (url, init = {}) => {
    const u = String(url)
    const call = {
      url: u,
      method: init.method ?? 'GET',
      headers: flat(init.headers),
      body: typeof init.body === 'string' ? init.body : init.body ? '<binary>' : undefined,
      keys: Object.keys(init).sort(),
      hasSignal: Boolean(init.signal),
    }
    w.calls.push(call)
    if (u.startsWith('/api/identity/token')) {
      call.route = 'mint'
      const sid = decodeURIComponent(new URL(u, 'http://app.test').searchParams.get('session_id'))
      w.mints.push(sid)
      if (w.mint) {
        const reply = w.mint(sid, w.mints.length)
        if (reply instanceof Error) throw reply
        return reply
      }
      return json({
        token: `tok.${sid}.${w.mints.length}`,
        expires_at: Math.floor(Date.now() / 1000) + 900,
        header: HEADER,
        ttl_seconds: 900,
      })
    }
    const route = u.endsWith('/api/v1/sessions/create') ? 'create'
      : u.endsWith('/api/v1/files/storage-upload-url') ? 'prepare'
        : u.endsWith('/api/v1/files/process-uploaded') ? 'process'
          : u.includes('/api/v1/files/ingest-status/') ? 'poll' : null
    if (route) {
      call.route = route
      const queued = w.replies[route].shift()
      if (queued) return queued()
      if (route === 'create') return json({ success: true, session_id: w.createSessionId })
      if (route === 'prepare') return json({ signed_url: 'http://storage.test/put/1', storage_path: `${RS}/doc.pdf` })
      if (route === 'process') {
        return w.jobId
          ? json({ success: true, status: 'processing', job_id: w.jobId, file_name: 'doc.pdf', storage_path: `${RS}/doc.pdf` }, 202)
          : json({ success: true, status: 'ready', file_name: 'doc.pdf', storage_path: `${RS}/doc.pdf` })
      }
      return json({ job_id: w.jobId, status: 'ready', file_name: 'doc.pdf', storage_path: `${RS}/doc.pdf` })
    }
    if (u.startsWith('http://storage.test/')) { call.route = 'put'; return new Response('', { status: 200 }) }
    if (/\/api\/sessions\/[^/]+\/files$/.test(u)) { call.route = 'link'; return json({ ok: true }) }
    throw new Error(`unexpected request ${u}`)
  }
  return w
}

const researcherCalls = w => w.calls.filter(c => ['create', 'prepare', 'process', 'poll'].includes(c.route))
const callsFor = (w, route) => w.calls.filter(c => c.route === route)
const asUnmarked = w => w.calls.filter(c => c.route !== 'mint')
// What flag on changes: the token header (and the `headers` key a bare poll then needs). Nothing else.
const withoutToken = calls => calls.map(({ keys, ...call }) => ({
  ...call,
  headers: Object.fromEntries(Object.entries(call.headers).filter(([k]) => k !== HEADER)),
}))

function globalsFor(world, shim) {
  return {
    fetch: world.fetch,
    crypto: { randomUUID: () => 'file-uuid-1' },
    console: {
      log() {}, info() {}, error() {},
      warn: (...args) => { world.logs.push(args.map(String).join(' ')) },
    },
    setTimeout: (fn, ms) => { world.delays.push(ms); setImmediate(fn); return 0 },
    AbortSignal: { timeout: ms => { world.timeouts.push(ms); return AbortSignal.timeout(ms) } },
  }
}

// ------------------------------------------- a tiny React-hooks shim
function createHarness(hookFn, shim) {
  const slots = []
  const effects = []
  let index = 0
  Object.assign(shim, {
    useState(init) {
      const k = index++
      if (!(k in slots)) slots[k] = { v: typeof init === 'function' ? init() : init }
      const slot = slots[k]
      return [slot.v, update => { slot.v = typeof update === 'function' ? update(slot.v) : update }]
    },
    useRef(init) {
      const k = index++
      if (!(k in slots)) slots[k] = { current: init }
      return slots[k]
    },
    useCallback(fn) { index += 1; return fn },
    useMemo(fn) { index += 1; return fn() },
    useEffect(fn, deps) {
      const k = index++
      const prev = slots[k]
      const changed = !prev || !deps || !prev.deps || deps.some((d, n) => !Object.is(d, prev.deps[n]))
      slots[k] = { deps }
      if (changed) effects.push({ k, fn })
    },
  })
  const cleanups = new Map()
  const harness = {
    current: null,
    render(props) {
      index = 0
      effects.length = 0
      harness.current = hookFn(props)
      for (const { k, fn } of effects) {
        cleanups.get(k)?.()
        const cleanup = fn()
        cleanups.set(k, typeof cleanup === 'function' ? cleanup : undefined)
      }
      return harness.current
    },
    unmount() { for (const cleanup of cleanups.values()) cleanup?.(); cleanups.clear() },
  }
  return harness
}

// ------------------------------------------------- source under test
const tokenLibSource = readWorking('lib/upload-identity-token.ts')
const clientSource = readWorking('lib/identity-token-client.ts')
const ownerSource = readWorking('lib/upload-owner.ts')
const hookSource = readWorking('hooks/use-file-upload.ts')
const libSource = readWorking('lib/researcher-upload.ts')
const uploadStatus = compileSource(readWorking('lib/upload-status.ts'), {}, {})
const hasServiceUrl = fs.existsSync(path.join(REPO, 'lib/service-url.ts'))
const serviceUrl = hasServiceUrl ? compileSource(readWorking('lib/service-url.ts'), {}, {}) : null
const hookHasOwnerPath = hookSource.includes('STUDIO_UPLOAD_OWNERSHIP')
const MODES = hookHasOwnerPath ? [['classic', undefined], ['studio owner path', 'true']] : [['classic', undefined]]
const config = {
  apiConfig: { knowledgeServiceUrl: `${RESEARCHER}/` },
  uploadConfig: { maxFiles: 5 },
  getKnowledgeServiceUrl: () => `${RESEARCHER}/`,
}

function loadStack(world, { hook = hookSource, lib = libSource } = {}) {
  const shim = {}
  const globals = globalsFor(world, shim)
  const upload = compileSource(ownerSource, {}, globals)
  const client = compileSource(clientSource, {}, globals)
  const wrapper = compileSource(tokenLibSource, { '@/lib/identity-token-client': client }, globals)
  const common = {
    '@/lib/config': config,
    '@/lib/upload-owner': upload,
    '@/lib/upload-identity-token': wrapper,
    ...(serviceUrl ? { '@/lib/service-url': serviceUrl } : {}),
  }
  const hookModule = compileSource(hook, {
    react: shim,
    '@/hooks/use-toast': { useToast: () => ({ toast: t => { world.toasts.push(t) } }) },
    '@/components/file-chip': {},
    '@/lib/file-validation': { validateFile: () => null },
    '@/lib/upload-status': uploadStatus,
    ...common,
  }, globals)
  const libModule = compileSource(lib, common, globals)
  return { shim, hookModule, libModule, wrapper, client }
}

const pdf = () => new File(['%PDF-1.4 stub'], 'doc.pdf', { type: 'application/pdf' })
const hookProps = (userId = CUID) => ({ sessionId: CHAT, userId })
const TERMINAL = new Set(['success', 'degraded', 'partial', 'error'])

function setEnv(values) {
  for (const key of [FLAG, OWNER_FLAG, SHELL_ENV]) delete env[key]
  Object.assign(env, Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined)))
}

async function runHook({ flag, shell, owner, world = makeWorld(), props = hookProps(), source = hookSource, lib = libSource }) {
  setEnv({ [FLAG]: flag, [SHELL_ENV]: shell, [OWNER_FLAG]: owner })
  const { shim, hookModule } = loadStack(world, { hook: source, lib })
  const harness = createHarness(hookModule.useFileUpload, shim)
  const api = harness.render(props)
  await api.handleFilesSelected([pdf()])
  let view = harness.render(props)
  // the ingest-status poll runs in the background after the upload resolves
  for (let i = 0; i < 400 && !view.files.every(f => TERMINAL.has(f.status)); i += 1) {
    await new Promise(resolve => setImmediate(resolve))
    view = harness.render(props)
  }
  setEnv({})
  return { world, files: view.files.map(f => ({ status: f.status, error: f.errorMessage })) }
}

async function runLib({ flag, owner, world = makeWorld(), options = {}, source = libSource, hook = hookSource }) {
  setEnv({ [FLAG]: flag, [OWNER_FLAG]: owner })
  const { libModule } = loadStack(world, { lib: source, hook })
  let error = null
  let result = null
  try {
    result = await libModule.uploadFileToResearcher({ sessionId: LIB_CHAT, userId: CUID, file: pdf(), ...options })
  } catch (e) {
    error = e
  }
  setEnv({})
  return { world, error, result }
}

const expectSid = (call, bodyOf) => {
  // the id the request itself uses: the chat id for create, the Researcher session for the rest
  if (call.route === 'create') return JSON.parse(call.body).session_id
  if (call.route === 'poll') return RS
  return JSON.parse(call.body).session_id
}

// ----------------------------------------- flag off: today's requests
const R401_EXPIRED = () => json({ detail: { error_code: 'token_expired', message: 'Session token expired' } }, 401)
const OFF_SCENARIOS = [
  ['cuid, no job', {}, { noJob: true }],
  ['cuid, with job and poll', {}, {}],
  ['e-mail owner', { userId: 'pat.qa@example.test' }, {}],
  ['empty owner', { userId: '' }, { noJob: true }],
  ['prepare 403', {}, { replies: { prepare: [() => json({ detail: 'forbidden' }, 403)] } }],
  ['create 401 token_expired body', {}, { replies: { create: [R401_EXPIRED] } }],
  ['process 401 token_expired body', {}, { replies: { process: [R401_EXPIRED] } }],
  ['poll 401', {}, { replies: { poll: [R401_EXPIRED] } }],
  ['poll 503 then ready', {}, { replies: { poll: [() => json({ detail: 'busy' }, 503)] } }],
]
const worldFor = extra => {
  const w = makeWorld({ noJob: extra.noJob })
  for (const [route, queue] of Object.entries(extra.replies ?? {})) w.replies[route].push(...queue)
  return w
}
const summarize = run => ({
  calls: run.world.calls,
  toasts: run.world.toasts.map(t => ({ title: t.title, description: t.description, variant: t.variant })),
  files: run.files,
  timeouts: run.world.timeouts,
  delays: run.world.delays,
  logs: run.world.logs,
})

async function replayOff(hook, lib) {
  const record = []
  for (const [mode, shell] of MODES) {
    for (const [name, propsExtra, extra] of OFF_SCENARIOS) {
      const run = await runHook({
        flag: undefined, shell, source: hook, lib,
        world: worldFor(extra), props: { ...hookProps(), ...propsExtra },
      })
      record.push({ scenario: `hook[${mode}]: ${name}`, ...summarize(run) })
    }
    // anything but the exact string true is off
    for (const value of ['false', '', '1', 'TRUE', 'yes', ' true', 'true ']) {
      const run = await runHook({ flag: value, shell, source: hook, lib, world: worldFor({}) })
      record.push({ scenario: `hook[${mode}]: flag "${value}"`, ...summarize(run) })
    }
  }
  for (const [name, propsExtra, extra] of OFF_SCENARIOS) {
    const run = await runLib({
      flag: undefined, source: lib, hook, world: worldFor(extra),
      options: { intent: 'template_ingest', ...(propsExtra.userId !== undefined ? { userId: propsExtra.userId } : {}) },
    })
    record.push({ scenario: `lib: ${name}`, calls: run.world.calls, error: run.error ? run.error.message : null, result: run.result })
  }
  for (const value of ['false', '', '1', 'TRUE', 'yes']) {
    const run = await runLib({ flag: value, source: lib, hook, world: worldFor({}), options: { storageOnly: true } })
    record.push({ scenario: `lib: flag "${value}"`, calls: run.world.calls, error: run.error ? run.error.message : null, result: run.result })
  }
  return record
}

const offRecord = await replayOff(hookSource, libSource)
for (const r of offRecord) {
  assert.equal(r.calls.some(c => c.url.includes('/api/identity/token')), false, `${r.scenario}: flag off never asks for a token`)
  assert.equal(r.calls.some(c => Object.keys(c.headers).some(k => k.toLowerCase() === HEADER.toLowerCase())), false, `${r.scenario}: no token header`)
  assert.equal(r.calls.length > 0 && r.calls[0].url === `${RESEARCHER}/api/v1/sessions/create`, true, `${r.scenario}: the first request is sessions/create`)
  assert.equal((r.logs ?? []).some(line => line.includes('upload-identity-token')), false, `${r.scenario}: the wrapper logs nothing`)
}
{
  // today's behaviour, as recorded: the poll sends a bare {signal} and the 401 is not retried
  const byName = Object.fromEntries(offRecord.map(r => [r.scenario, r]))
  const poll = byName['hook[classic]: cuid, with job and poll'].calls.find(c => c.route === 'poll')
  assert.deepEqual(poll.keys, ['signal'])
  assert.deepEqual(poll.headers, {})
  assert.equal(poll.method, 'GET')
  const create = byName['hook[classic]: cuid, no job'].calls.find(c => c.route === 'create')
  assert.deepEqual(create.headers, { 'Content-Type': 'application/json' })
  assert.deepEqual(create.keys, ['body', 'headers', 'method'])
  assert.equal(byName['hook[classic]: process 401 token_expired body'].calls.filter(c => c.route === 'process').length, 1, 'flag off: a 401 is not retried')
  assert.equal(byName['hook[classic]: create 401 token_expired body'].calls.filter(c => c.route === 'create').length, 1)
  assert.equal(byName['hook[classic]: poll 401'].calls.filter(c => c.route === 'poll').length, 1)
  assert.equal(byName['hook[classic]: poll 503 then ready'].calls.filter(c => c.route === 'poll').length, 2, 'the transient retry is untouched')
  assert.equal(byName['hook[classic]: prepare 403'].toasts.some(t => t.title === 'Upload failed'), true, 'flag off: a 403 is an ordinary upload failure')
  assert.equal(byName['hook[classic]: prepare 403'].toasts.some(t => t.title === 'Not your session'), false)
}

let proof = null
if (process.env.UPLOAD_IDENTITY_TOKEN_BASE_REF) {
  const ref = process.env.UPLOAD_IDENTITY_TOKEN_BASE_REF
  const baseRecord = await replayOff(readBase(ref, 'hooks/use-file-upload.ts'), readBase(ref, 'lib/researcher-upload.ts'))
  assert.deepEqual(JSON.parse(JSON.stringify(offRecord)), JSON.parse(JSON.stringify(baseRecord)), `flag off is identical to ${ref}`)
  const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
  proof = {
    ref, branch: hash(offRecord), base: hash(baseRecord), scenarios: offRecord.length,
    requests: offRecord.reduce((n, r) => n + r.calls.length, 0),
  }
  assert.equal(proof.branch, proof.base)
}

// ------------------------------------------------------- flag on: the header
for (const [mode, shell] of MODES) {
  // every Researcher call carries the token minted for the id the request uses
  const ok = await runHook({ flag: 'true', shell })
  const w = ok.world
  const rc = researcherCalls(w)
  assert.deepEqual(rc.map(c => c.route), ['create', 'prepare', 'process', 'poll'], `${mode}: all four Researcher calls`)
  for (const call of rc) {
    const header = call.headers[HEADER]
    assert.ok(header, `${mode}: ${call.route} carries ${HEADER}`)
    assert.equal(tokenSid(header), expectSid(call), `${mode}: ${call.route} token is for the session id that request uses`)
    assert.equal(call.headers['Content-Type'] ?? 'x', call.route === 'poll' ? 'x' : 'application/json', `${mode}: ${call.route} keeps its own headers`)
  }
  assert.equal(tokenSid(rc[0].headers[HEADER]), CHAT, `${mode}: create is minted for the chat session`)
  assert.equal(tokenSid(rc[1].headers[HEADER]), RS, `${mode}: storage-upload-url is minted for the id in its body`)
  assert.equal(tokenSid(rc[3].headers[HEADER]), RS, `${mode}: ingest-status is minted for the job's session`)
  assert.equal(rc[3].hasSignal, true, `${mode}: the poll keeps its per-request timeout signal`)
  assert.deepEqual(w.timeouts, [10000], `${mode}: one timeout signal for the one poll`)
  assert.deepEqual(w.mints, [CHAT, RS], `${mode}: one mint per session id; prepare, process and poll share a cache entry`)
  for (const call of w.calls.filter(c => ['put', 'link', 'mint'].includes(c.route))) {
    assert.equal(Object.keys(call.headers).some(k => k.toLowerCase() === HEADER.toLowerCase()), false, `${mode}: ${call.route} carries no token`)
  }
  for (const mint of callsFor(w, 'mint')) assert.equal(mint.method, 'GET')
  assert.equal(ok.files.length, 1)
  assert.equal(ok.files[0].status === 'error', false)
  assert.deepEqual(w.logs, [], `${mode}: nothing logged on the happy path`)

  // the body of every Researcher request is exactly what flag off sends
  const off = await runHook({ flag: undefined, shell })
  assert.deepEqual(withoutToken(asUnmarked(w)), withoutToken(asUnmarked(off.world)), `${mode}: flag on changes only the header`)

  // realistic ids: the Researcher echoes the chat id, so the whole upload costs one mint
  const same = await runHook({ flag: 'true', shell, world: makeWorld({ createSessionId: CHAT }) })
  assert.deepEqual(same.world.mints, [CHAT], `${mode}: one mint covers create, prepare, process and poll`)
  assert.equal(new Set(researcherCalls(same.world).map(c => c.headers[HEADER])).size, 1)

  // tokens off on the server: no header, requests as flag off, one probe only
  const disabled = await runHook({ flag: 'true', shell, world: makeWorld({ mint: () => json({ token_enabled: false }) }) })
  assert.equal(disabled.world.mints.length, 1, `${mode}: the "tokens off" answer is remembered`)
  assert.deepEqual(asUnmarked(disabled.world), asUnmarked(off.world), `${mode}: token_enabled false leaves every request as today`)
  assert.deepEqual(disabled.world.logs, [])
  assert.deepEqual(disabled.world.toasts.map(t => t.title), off.world.toasts.map(t => t.title))

  // the mint route is unavailable for any other reason: the upload carries on, header-less, with a coded warning
  const failures = {
    'route 503': () => json({ error: 'ownership_lookup_failed' }, 503),
    network: () => new Error('offline'),
    'login lapsed (401)': () => json({ error: 'unauthenticated' }, 401),
    'session deleted (410)': () => json({ error: 'session_deleted' }, 410),
    'bad body': () => new Response('<html>', { status: 200 }),
  }
  for (const [name, mint] of Object.entries(failures)) {
    const run = await runHook({ flag: 'true', shell, world: makeWorld({ mint }) })
    assert.deepEqual(asUnmarked(run.world), asUnmarked(off.world), `${mode}, mint ${name}: requests exactly as flag off`)
    assert.equal(run.files[0].status === 'error', false, `${mode}, mint ${name}: the upload still works`)
    assert.ok(run.world.logs.length >= 1, `${mode}, mint ${name}: a warning is logged`)
    for (const line of run.world.logs) {
      assert.match(line, /^\[upload-identity-token\] no token for this call \((network|unavailable|unauthenticated|session_deleted|bad_response)\)$/)
      assert.equal(line.includes(CHAT) || line.includes(CUID) || line.includes('tok.'), false, 'logs carry a code only')
    }
  }

  // exact string only
  for (const value of ['false', '', '1', 'TRUE', 'yes', ' true', 'true ']) {
    const run = await runHook({ flag: value, shell })
    assert.equal(run.world.mints.length, 0, `${mode}: flag "${value}" is off`)
  }

  // the owner refusal comes before any mint
  const refused = await runHook({ flag: 'true', owner: 'true', shell, props: hookProps('pat.qa@example.test') })
  assert.equal(refused.world.calls.length, 0, `${mode}: a refused owner sends and mints nothing`)
  assert.ok(refused.world.toasts.find(t => t.title === 'Upload blocked'))
  const both = await runHook({ flag: 'true', owner: 'true', shell })
  assert.equal(both.world.calls.length > 0 && researcherCalls(both.world).every(c => c.headers[HEADER]), true, `${mode}: both flags on`)
}

// ------------------------------------------------- 401: one re-mint, one retry
for (const [mode, shell] of MODES) {
  const body = { detail: { error_code: 'token_expired', message: 'Session token expired' } }
  const cases = [
    ['create', 'token_expired object body', () => json(body, 401)],
    ['prepare', 'token_expired object body', () => json(body, 401)],
    ['process', 'token_invalid string detail', () => json({ detail: 'token_invalid' }, 401)],
    ['process', 'prose "Token expired"', () => new Response('Token expired', { status: 401 })],
    ['poll', 'token_expired object body', () => json(body, 401)],
  ]
  for (const [route, label, reply] of cases) {
    const world = makeWorld()
    world.replies[route].push(reply)
    const run = await runHook({ flag: 'true', shell, world })
    const sent = callsFor(world, route)
    assert.equal(sent.length, 2, `${mode}, ${route} (${label}): the call is sent once more, once`)
    assert.notEqual(sent[0].headers[HEADER], sent[1].headers[HEADER], `${mode}, ${route}: the retry carries a fresh token`)
    assert.equal(tokenSid(sent[1].headers[HEADER]), tokenSid(sent[0].headers[HEADER]))
    assert.equal(world.mints.length, 3, `${mode}, ${route}: exactly one extra mint`)
    assert.deepEqual(sent[0].body, sent[1].body, `${mode}, ${route}: the same request`)
    assert.equal(run.files[0].status === 'error', false)
    assert.equal(world.toasts.some(t => /needs attention|limited source|Upload failed|Not your session/.test(t.title)), false, `${mode}, ${route}: the user sees nothing`)
  }

  // a 401 that is not about the token is not retried, and the Researcher's own words come through
  {
    const world = makeWorld({ noJob: true })
    world.replies.prepare.push(() => json({ detail: 'Unauthorized' }, 401))
    const run = await runHook({ flag: 'true', shell, world })
    assert.equal(callsFor(world, 'prepare').length, 1, `${mode}: a 401 that does not name the token is not retried`)
    assert.equal(world.mints.length, 2)
    assert.equal(run.files[0].status, 'error')
    assert.match(run.files[0].error, /Unauthorized/)
  }
  // a second refusal is returned as is: never a third request
  {
    const world = makeWorld({ noJob: true })
    world.replies.process.push(R401_EXPIRED, R401_EXPIRED)
    const run = await runHook({ flag: 'true', shell, world })
    assert.equal(callsFor(world, 'process').length, 2, `${mode}: two refusals end it`)
    assert.ok(world.toasts.find(t => t.title === 'Stored — source enrichment needs attention' && /token_expired|expired/i.test(t.description)))
    assert.equal(run.files[0].status, 'degraded')
  }
  // the re-mint itself is refused as "not your session": no retry
  {
    const world = makeWorld({ noJob: true })
    world.mint = (sid, count) => (count >= 3 ? json({ error: 'session_not_owned' }, 403) : json({
      token: `tok.${sid}.${count}`, expires_at: Math.floor(Date.now() / 1000) + 900, header: HEADER, ttl_seconds: 900,
    }))
    world.replies.process.push(R401_EXPIRED)
    const run = await runHook({ flag: 'true', shell, world })
    assert.equal(callsFor(world, 'process').length, 1, `${mode}: no retry when the re-mint says not your session`)
    assert.ok(world.toasts.find(t => /needs attention/.test(t.title) && NOT_YOURS.test(t.description)))
    assert.equal(run.files[0].status, 'degraded')
  }
  // the re-mint fails for any other reason: the Researcher's own 401 stands
  {
    const world = makeWorld({ noJob: true })
    world.mint = (sid, count) => (count >= 3 ? new Error('offline') : json({
      token: `tok.${sid}.${count}`, expires_at: Math.floor(Date.now() / 1000) + 900, header: HEADER, ttl_seconds: 900,
    }))
    world.replies.process.push(R401_EXPIRED)
    const run = await runHook({ flag: 'true', shell, world })
    assert.equal(callsFor(world, 'process').length, 1)
    assert.equal(run.files[0].status, 'degraded')
  }
}

// ------------------------------------------------- 403: not your session, no retry
for (const [mode, shell] of MODES) {
  const forbidden = () => json({ detail: { error_code: 'OWNER_ID_MISMATCH', message: 'forbidden' } }, 403)
  for (const route of ['create', 'prepare']) {
    const world = makeWorld({ noJob: true })
    world.replies[route].push(forbidden)
    const run = await runHook({ flag: 'true', shell, world })
    assert.equal(callsFor(world, route).length, 1, `${mode}, ${route}: a 403 is not retried`)
    assert.equal(world.mints.length, route === 'create' ? 1 : 2, `${mode}, ${route}: and not re-minted`)
    const toast = world.toasts.find(t => t.title === 'Not your session')
    assert.ok(toast, `${mode}, ${route}: the user is told`)
    assert.match(toast.description, NOT_YOURS)
    assert.equal(toast.variant, 'destructive')
    assert.equal(world.toasts.some(t => t.title === 'Upload failed'), false, 'one clear message, not two')
    assert.equal(run.files[0].status, 'error')
    assert.equal(callsFor(world, 'process').length, 0, `${mode}, ${route}: nothing later is sent`)
  }
  {
    const world = makeWorld({ noJob: true })
    world.replies.process.push(forbidden)
    const run = await runHook({ flag: 'true', shell, world })
    assert.equal(callsFor(world, 'process').length, 1, `${mode}: process-uploaded 403 is not retried`)
    assert.equal(world.mints.length, 2)
    assert.ok(world.toasts.find(t => /needs attention/.test(t.title) && NOT_YOURS.test(t.description)))
    assert.equal(run.files[0].status, 'degraded')
  }
  {
    const world = makeWorld()
    world.replies.poll.push(forbidden)
    const run = await runHook({ flag: 'true', shell, world })
    assert.equal(callsFor(world, 'poll').length, 1, `${mode}: an ingest-status 403 is neither retried nor polled again`)
    assert.ok(world.toasts.find(t => /limited source/.test(t.title) && NOT_YOURS.test(t.description)))
    assert.equal(run.files[0].status, 'degraded')
  }
  {
    // the mint route itself says the chat session is not the caller's: no Researcher call at all
    const world = makeWorld({ mint: () => json({ error: 'session_not_owned' }, 403) })
    const run = await runHook({ flag: 'true', shell, world })
    assert.equal(researcherCalls(world).length, 0, `${mode}: nothing reaches the Researcher`)
    assert.ok(world.toasts.find(t => t.title === 'Not your session' && NOT_YOURS.test(t.description)))
    assert.equal(run.files[0].status, 'error')
  }
}

// ------------------------------------------------- the upload library (composer, template ingest)
{
  const ok = await runLib({ flag: 'true', options: { intent: 'template_ingest' } })
  assert.equal(ok.error, null)
  const w = ok.world
  assert.deepEqual(researcherCalls(w).map(c => c.route), ['create', 'prepare', 'process'])
  assert.deepEqual(researcherCalls(w).map(c => tokenSid(c.headers[HEADER])), [LIB_CHAT, RS, RS], 'the id each request uses')
  assert.deepEqual(w.mints, [LIB_CHAT, RS])
  assert.equal(callsFor(w, 'put')[0].headers[HEADER], undefined, 'the storage PUT carries no token')
  assert.deepEqual(callsFor(w, 'create')[0].headers['Content-Type'], 'application/json')

  const off = await runLib({ flag: undefined, options: { intent: 'template_ingest' } })
  assert.deepEqual(withoutToken(asUnmarked(w)), withoutToken(asUnmarked(off.world)), 'lib: flag on changes only the header')

  const storageOnly = await runLib({ flag: 'true', options: { storageOnly: true } })
  assert.deepEqual(researcherCalls(storageOnly.world).map(c => c.route), ['create', 'prepare'], 'storage-only stops after the PUT')

  const disabled = await runLib({ flag: 'true', options: { intent: 'template_ingest' }, world: makeWorld({ mint: () => json({ token_enabled: false }) }) })
  assert.deepEqual(asUnmarked(disabled.world), asUnmarked(off.world), 'lib: token_enabled false leaves every request as today')
  assert.deepEqual(disabled.world.logs, [])
  const down = await runLib({ flag: 'true', options: { intent: 'template_ingest' }, world: makeWorld({ mint: () => json({ error: 'x' }, 503) }) })
  assert.deepEqual(asUnmarked(down.world), asUnmarked(off.world), 'lib: an unavailable mint route leaves every request as today')

  // 401: one re-mint, one retry
  for (const route of ['create', 'prepare', 'process']) {
    const world = makeWorld()
    world.replies[route].push(R401_EXPIRED)
    const run = await runLib({ flag: 'true', world })
    assert.equal(run.error, null, `lib ${route}: recovers`)
    assert.equal(callsFor(world, route).length, 2)
    assert.notEqual(callsFor(world, route)[0].headers[HEADER], callsFor(world, route)[1].headers[HEADER])
    assert.equal(world.mints.length, 3)
  }
  {
    const world = makeWorld()
    world.replies.process.push(R401_EXPIRED, R401_EXPIRED)
    const run = await runLib({ flag: 'true', world })
    assert.equal(callsFor(world, 'process').length, 2)
    assert.ok(run.error && /expired/i.test(run.error.message), 'a second refusal reaches the caller as the Researcher worded it')
  }
  {
    const world = makeWorld()
    world.replies.prepare.push(() => json({ detail: 'Unauthorized' }, 401))
    const run = await runLib({ flag: 'true', world })
    assert.equal(callsFor(world, 'prepare').length, 1)
    assert.equal(run.error.message, 'Unauthorized')
  }

  // 403: the caller gets a clear "not your session" and nothing more is sent
  for (const route of ['create', 'prepare', 'process']) {
    const world = makeWorld()
    world.replies[route].push(() => json({ detail: { error_code: 'OWNER_ID_MISMATCH' } }, 403))
    const run = await runLib({ flag: 'true', world })
    assert.ok(run.error, `lib ${route}: rejects`)
    assert.equal(run.error.name, 'NotYourSessionError')
    assert.match(run.error.message, NOT_YOURS)
    assert.equal(callsFor(world, route).length, 1, `lib ${route}: no retry`)
    assert.equal(world.mints.length, route === 'create' ? 1 : 2, `lib ${route}: no re-mint`)
  }
  {
    const world = makeWorld({ mint: () => json({ error: 'session_not_owned' }, 403) })
    const run = await runLib({ flag: 'true', world })
    assert.equal(run.error.name, 'NotYourSessionError')
    assert.equal(researcherCalls(world).length, 0)
  }

  // the owner refusal still comes first
  const refused = await runLib({ flag: 'true', owner: 'true', options: { userId: 'anonymous' } })
  assert.equal(refused.world.calls.length, 0, 'lib: a refused owner mints nothing')
}

// ------------------------------------------------- the wrapper on its own
{
  const world = makeWorld()
  const { wrapper, client } = loadStack(world)
  const { researcherFetch, isNotYourSessionError, isUploadIdentityTokenEnabled } = wrapper
  const seen = []
  const fetchStub = async (url, init) => { seen.push({ url, init }); return new Response('ok', { status: 200 }) }
  const stubbed = compileSource(tokenLibSource, { '@/lib/identity-token-client': client }, { ...globalsFor(world), fetch: fetchStub })
  const unit = stubbed.researcherFetch
  const fakeClient = (overrides = {}) => ({
    getCredential: async () => ({ header: HEADER, token: 'tok.s.1' }),
    withToken: async () => { throw new Error('unused') },
    invalidate() {},
    ...overrides,
  })

  // flag off: the caller's own arguments, untouched, called synchronously
  setEnv({})
  assert.equal(isUploadIdentityTokenEnabled(), false)
  const init = { method: 'POST', headers: { a: 'b' }, body: 'x' }
  let minted = 0
  const countingClient = fakeClient({ getCredential: async () => { minted += 1; return null } })
  const pending = unit('s', 'http://x.test/a', init, countingClient)
  assert.equal(seen.length, 1, 'fetch is called before researcherFetch returns (flag off)')
  assert.equal(seen[0].url, 'http://x.test/a')
  assert.equal(seen[0].init, init, 'the very same init object')
  await pending
  const factory = () => ({ signal: 'sig' })
  await unit('s', 'http://x.test/b', factory, countingClient)
  assert.deepEqual(seen[1].init, { signal: 'sig' })
  assert.equal(minted, 0, 'flag off never asks the helper')

  // flag on
  env[FLAG] = 'true'
  assert.equal(isUploadIdentityTokenEnabled(), true)
  seen.length = 0
  await unit('s', 'http://x.test/c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x' }, fakeClient())
  assert.deepEqual(plain(seen[0].init.headers), { 'Content-Type': 'application/json', [HEADER]: 'tok.s.1' }, 'the token is added, the caller headers stay')
  assert.deepEqual(Object.keys(seen[0].init).sort(), ['body', 'headers', 'method'])
  await unit('s', 'http://x.test/d', { headers: new Headers({ A: 'b' }) }, fakeClient())
  assert.equal(seen[1].init.headers.get(HEADER), 'tok.s.1')
  assert.equal(seen[1].init.headers.get('A'), 'b')
  await unit('s', 'http://x.test/e', { headers: [['A', 'b']] }, fakeClient())
  assert.equal(seen[2].init.headers.get(HEADER), 'tok.s.1')
  await unit('s', 'http://x.test/f', undefined, fakeClient())
  assert.deepEqual(plain(seen[3].init), { headers: { [HEADER]: 'tok.s.1' } })

  // no session id, or no token: the call goes out as given
  seen.length = 0
  const bare = { method: 'POST' }
  await unit('', 'http://x.test/g', bare, fakeClient())
  await unit(undefined, 'http://x.test/h', bare, fakeClient())
  await unit('s', 'http://x.test/i', bare, fakeClient({ getCredential: async () => null }))
  assert.equal(seen.every(call => call.init === bare), true, 'no id or no token: the same init object, no header')

  // a 403 with no token on the call is the service's own answer, not "not your session"
  const forbiddenStub = compileSource(tokenLibSource, { '@/lib/identity-token-client': client }, {
    ...globalsFor(world), fetch: async () => new Response('no', { status: 403 }),
  })
  const unmarked = await forbiddenStub.researcherFetch('s', 'http://x.test/j', {}, fakeClient({ getCredential: async () => null }))
  assert.equal(unmarked.status, 403)
  await assert.rejects(
    () => forbiddenStub.researcherFetch('s', 'http://x.test/k', {}, fakeClient()),
    err => isNotYourSessionError(err) && NOT_YOURS.test(err.message),
  )

  // a failed re-mint returns the Researcher's own 401, body still readable
  const refusedStub = compileSource(tokenLibSource, { '@/lib/identity-token-client': client }, {
    ...globalsFor(world), fetch: async () => new Response('{"detail":"token_expired"}', { status: 401 }),
  })
  let call = 0
  const flaky = fakeClient({ getCredential: async () => { call += 1; if (call > 1) return null; return { header: HEADER, token: 't' } } })
  const refusal = await refusedStub.researcherFetch('s', 'http://x.test/l', {}, flaky)
  assert.equal(refusal.status, 401)
  assert.equal(await refusal.text(), '{"detail":"token_expired"}', 'the body is still there for the caller')

  // after a refused token and a failed re-mint, the refused token is not reused: the next call asks again
  {
    const w2 = makeWorld()
    w2.mint = (sid, n) => (n === 2 ? new Error('offline') : json({
      token: `tok.${sid}.${n}`, expires_at: Math.floor(Date.now() / 1000) + 900, header: HEADER, ttl_seconds: 900,
    }))
    w2.replies.process.push(R401_EXPIRED)
    const real = loadStack(w2).wrapper.researcherFetch
    const url = `${RESEARCHER}/api/v1/files/process-uploaded`
    const init = () => ({ method: 'POST', body: '{}' })
    const first = await real('s', url, init)
    assert.equal(first.status, 401, 'the Researcher\'s own answer stands when the re-mint fails')
    await real('s', url, init)
    assert.deepEqual(w2.mints, ['s', 's', 's'], 'the refused token was dropped from the cache')
    assert.equal(callsFor(w2, 'process')[1].headers[HEADER], 'tok.s.3')
  }

  // a hung mint does not outlive the request's own signal
  const controller = new AbortController()
  const hung = fakeClient({ getCredential: () => new Promise(() => {}) })
  const waiting = unit('s', 'http://x.test/m', () => ({ signal: controller.signal }), hung)
  controller.abort(new Error('timed out'))
  await assert.rejects(() => waiting, /timed out/)
  assert.equal(seen.some(c => c.url.endsWith('/m')), false, 'nothing was sent')

  // lookalike error from another copy of the helper
  assert.equal(isNotYourSessionError({ code: 'session_not_owned' }), true)
  assert.equal(isNotYourSessionError(new Error('x')), false)
  assert.equal(isNotYourSessionError(null), false)
  assert.equal(isNotYourSessionError(undefined), false)
}

// ------------------------------------------------- wiring: where the code goes
{
  const strip = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  for (const [name, text] of [['hook', hookSource], ['lib', libSource]]) {
    const code = strip(text)
    assert.equal(/\bfetch\(\s*`\$\{(RESEARCHER_BASE_URL|researcherBaseUrl|getResearcherBaseUrl\(\))\}/.test(code), false, `${name}: no Researcher call bypasses researcherFetch`)
    assert.equal(/\bfetch\(\s*\n?\s*`\$\{(RESEARCHER_BASE_URL|researcherBaseUrl|getResearcherBaseUrl\(\))\}/.test(code), false)
  }
  const researcherFetchCalls = text => (strip(text).match(/\bresearcherFetch\(/g) ?? []).length
  assert.equal(researcherFetchCalls(libSource), 3, 'lib: create, storage-upload-url, process-uploaded')
  assert.equal(researcherFetchCalls(hookSource), hookHasOwnerPath ? 5 : 4, 'hook: create (each path), storage-upload-url, process-uploaded, ingest-status')
  assert.equal(/researcherFetch\(\s*(?:tokenSessionId|researcherSessionId|currentSessionId|owner\.sessionId),/.test(strip(hookSource)), true)

  // only the wrapper imports the helper; only the helper calls the mint route; Text Labs is untouched
  const skip = new Set(['node_modules', '.next', '.git', 'scripts', 'docs', 'screenshots', 'public'])
  const importers = []
  const callers = []
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) { walk(full); continue }
      if (!/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) continue
      const rel = path.relative(REPO, full)
      const text = fs.readFileSync(full, 'utf8')
      if (text.includes('upload-identity-token')) importers.push(rel)
      if (text.includes('/api/identity/token') && rel !== 'lib/identity-token-client.ts' && rel !== 'app/api/identity/token/route.ts') callers.push(rel)
    }
  }
  walk(REPO)
  assert.deepEqual(importers.sort(), ['hooks/use-file-upload.ts', 'lib/researcher-upload.ts', 'lib/upload-identity-token.ts'], 'the wrapper is used by the two upload paths only')
  assert.deepEqual(callers, [], 'nothing but the helper calls the mint route')
  assert.equal(/identity-token|X-Deckster-Session-Token/i.test(readWorking('lib/textlabs-client.ts')), false, 'Text Labs is not wired')
}

console.log('upload identity token tests passed')
if (proof) {
  console.log(`flag-off identity vs ${proof.ref}: ${proof.scenarios} scenarios, ${proof.requests} requests, sha256 branch=${proof.branch} base=${proof.base}`)
} else {
  console.log('base replay skipped (set UPLOAD_IDENTITY_TOKEN_BASE_REF=<ref> to compare with the base commit)')
}
