/**
 * R-20261007-frontend-23: browser uploads carry the account id, not the e-mail
 * (flag NEXT_PUBLIC_UPLOAD_OWNER_ID_ENABLED, default off).
 *
 * Offline and keyless: `fetch` is a stub, the real hook, helper and upload
 * library are compiled and run unchanged against a tiny React-hooks shim, and
 * every id below is a made-up string.
 *
 * Optional proof mode: UPLOAD_OWNER_BASE_REF=<git ref of the base, e.g. origin/uat>
 * replays the same flag-off scenarios against the base commit's hook and upload
 * library and requires the recorded requests to be identical, then prints a
 * SHA-256 of both runs.
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
const FLAG = 'NEXT_PUBLIC_UPLOAD_OWNER_ID_ENABLED'
const RESEARCHER = 'http://researcher.test'
const CUID = 'cm8xk2l0a0000abcdefghij123'
const EMAIL = 'pat.qa@example.test'

const env = {}
const readWorking = rel => fs.readFileSync(path.join(REPO, rel), 'utf8')
const readBase = (ref, rel) => execFileSync('git', ['show', `${ref}:${rel}`], { cwd: REPO, encoding: 'utf8' })

function compileSource(source, imports, extraGlobals = {}) {
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(output, {
    module,
    exports: module.exports,
    console: { log() {}, warn() {}, error() {}, info() {} },
    Promise, Set, Map, Error, JSON, Math, Date, Array, Object, String, Number, Boolean, RegExp,
    URL, URLSearchParams, AbortSignal, File, Response, setTimeout, clearTimeout,
    process: { env },
    require: name => {
      if (!(name in imports)) throw new Error(`Unexpected import ${name}`)
      return imports[name]
    },
    ...extraGlobals,
  })
  return module.exports
}

// ------------------------------------------------------------ the helper
const helperSource = readWorking('lib/upload-owner.ts')
const helper = compileSource(helperSource, {})
const {
  isUploadOwnerIdEnabled, isUploadOwnerId, builderUploadUserId, researcherUploadOwnerId,
  UploadOwnerRequiredError, UPLOAD_OWNER_REQUIRED_MESSAGE,
} = helper

// flag: exact string "true" only, read on every call
delete env[FLAG]
assert.equal(isUploadOwnerIdEnabled(), false, 'default off')
for (const value of ['', 'false', '0', '1', 'TRUE', 'True', ' true', 'true ', 'yes', 'on']) {
  env[FLAG] = value
  assert.equal(isUploadOwnerIdEnabled(), false, `"${value}" is not the exact string true`)
}
env[FLAG] = 'true'
assert.equal(isUploadOwnerIdEnabled(), true)
delete env[FLAG]

// owner shape
for (const good of [CUID, 'uat-tpl-user', 'a', 'A1.b.c:d-e', 'x'.repeat(255)]) {
  assert.equal(isUploadOwnerId(good), true, `${good.slice(0, 12)} is a usable owner id`)
}
for (const bad of [
  '', undefined, null, 42, EMAIL, 'a@b', 'pat|x', ' lead', '-lead', '.lead', 'has space', 'x'.repeat(256),
  'anonymous', 'Anonymous', 'none', 'null', 'undefined', 'ünï', 'a/b',
]) {
  assert.equal(isUploadOwnerId(bad), false, `${String(bad).slice(0, 12)} is not a usable owner id`)
}

// builderUploadUserId: off is exactly the old expression, on is the id
{
  const users = [
    { id: CUID, email: EMAIL }, { email: EMAIL }, { id: CUID }, { id: '', email: EMAIL }, { id: null, email: null }, {}, null, undefined,
  ]
  delete env[FLAG]
  for (const u of users) assert.equal(builderUploadUserId(u), u?.email || '', 'flag off equals `user?.email || \'\'`')
  env[FLAG] = 'true'
  for (const u of users) assert.equal(builderUploadUserId(u), u?.id || '', 'flag on is `user?.id || \'\'`')
  assert.equal(builderUploadUserId({ id: CUID, email: EMAIL }), CUID)
  assert.equal(builderUploadUserId({ email: EMAIL }), '', 'no id: empty, never the e-mail')
  delete env[FLAG]
}

// researcherUploadOwnerId
{
  delete env[FLAG]
  assert.equal(researcherUploadOwnerId(EMAIL), EMAIL, 'off: passes whatever it is given')
  assert.equal(researcherUploadOwnerId(''), 'anonymous')
  assert.equal(researcherUploadOwnerId(undefined), 'anonymous')
  assert.equal(researcherUploadOwnerId(null), 'anonymous')
  env[FLAG] = 'true'
  assert.equal(researcherUploadOwnerId(CUID), CUID)
  for (const bad of ['', undefined, null, EMAIL, 'anonymous', 'a|b']) {
    assert.throws(() => researcherUploadOwnerId(bad), err => err instanceof Error
      && err.name === 'UploadOwnerRequiredError' && err.message === UPLOAD_OWNER_REQUIRED_MESSAGE)
  }
  assert.match(UPLOAD_OWNER_REQUIRED_MESSAGE, /account id/)
  assert.equal(UPLOAD_OWNER_REQUIRED_MESSAGE.includes('@'), false)
  delete env[FLAG]
}

// ------------------------------------------------ recorded fetch + stubs
const calls = []
const stubFetch = async (url, init = {}) => {
  const u = String(url)
  calls.push({ url: u, method: init.method ?? 'GET', headers: init.headers ?? {}, body: typeof init.body === 'string' ? init.body : init.body ? '<binary>' : undefined })
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  if (u.endsWith('/api/v1/sessions/create')) return json({ success: true, session_id: 'researcher-session-1' })
  if (u.endsWith('/api/v1/files/storage-upload-url')) return json({ signed_url: 'http://storage.test/put/1', storage_path: 'researcher-session-1/doc.pdf' })
  if (u.startsWith('http://storage.test/')) return new Response('', { status: 200 })
  if (/\/api\/sessions\/[^/]+\/files$/.test(u)) return json({ ok: true })
  if (u.endsWith('/api/v1/files/process-uploaded')) return json({ success: true, status: 'ready', file_name: 'doc.pdf', storage_path: 'researcher-session-1/doc.pdf' })
  throw new Error(`unexpected request ${u}`)
}
const config = {
  apiConfig: { knowledgeServiceUrl: `${RESEARCHER}/` },
  uploadConfig: { maxFiles: 5 },
  getKnowledgeServiceUrl: () => `${RESEARCHER}/`,
}
// The Researcher calls go through lib/upload-identity-token.ts (R-20261007-frontend-27). Its flag
// (NEXT_PUBLIC_UPLOAD_IDENTITY_TOKEN_ENABLED) is unset throughout this test: a plain `fetch(url, init)`.
const identityClient = compileSource(readWorking('lib/identity-token-client.ts'), {}, {})
const tokenWrapper = compileSource(readWorking('lib/upload-identity-token.ts'), { '@/lib/identity-token-client': identityClient }, { fetch: stubFetch })
// Studio's upload library also reads a service-url helper; uat's does not import it.
const serviceUrlPath = 'lib/service-url.ts'
const hasServiceUrl = fs.existsSync(path.join(REPO, serviceUrlPath))
const serviceUrl = hasServiceUrl ? compileSource(readWorking(serviceUrlPath), {}) : null
// Studio's upload hook has a second, owner-scoped request path behind this build flag.
const SHELL_ENV = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const hookHasOwnerPath = readWorking('hooks/use-file-upload.ts').includes('STUDIO_UPLOAD_OWNERSHIP')
const MODES = hookHasOwnerPath ? [['classic', undefined], ['studio owner path', 'true']] : [['classic', undefined]]
const uploadStatus = compileSource(readWorking('lib/upload-status.ts'), {})
const toasts = []

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
    state: slots,
  }
  return harness
}

function loadHook(source, extraImports = {}) {
  const shim = {}
  const imports = {
    react: shim,
    '@/hooks/use-toast': { useToast: () => ({ toast: t => { toasts.push(t) } }) },
    '@/components/file-chip': {},
    '@/lib/file-validation': { validateFile: () => null },
    '@/lib/config': config,
    '@/lib/upload-status': uploadStatus,
    '@/lib/upload-owner': helper,
    '@/lib/upload-identity-token': tokenWrapper,
    ...(serviceUrl ? { '@/lib/service-url': serviceUrl } : {}),
    ...extraImports,
  }
  const mod = compileSource(source, imports, {
    fetch: stubFetch,
    crypto: { randomUUID: () => 'file-uuid-1' },
  })
  return { mod, shim }
}

function loadUploadLib(source) {
  return compileSource(source, {
    '@/lib/config': config,
    '@/lib/upload-owner': helper,
    '@/lib/upload-identity-token': tokenWrapper,
    ...(serviceUrl ? { '@/lib/service-url': serviceUrl } : {}),
  }, { fetch: stubFetch })
}

const pdf = () => new File(['%PDF-1.4 stub'], 'doc.pdf', { type: 'application/pdf' })
const normalizeCalls = list => list.map(c => ({ ...c, headers: { ...c.headers } }))

async function runHook(source, props, shell) {
  if (shell === undefined) delete env[SHELL_ENV]; else env[SHELL_ENV] = shell
  const { mod, shim } = loadHook(source)
  const harness = createHarness(mod.useFileUpload, shim)
  calls.length = 0
  toasts.length = 0
  const api = harness.render(props)
  await api.handleFilesSelected([pdf()])
  const view = harness.render(props)
  delete env[SHELL_ENV]
  return { calls: normalizeCalls(calls), toasts: toasts.slice(), files: view.files }
}

async function runLib(source, options) {
  const lib = loadUploadLib(source)
  calls.length = 0
  let error = null
  try {
    await lib.uploadFileToResearcher({ sessionId: 'sess-1', file: pdf(), ...options })
  } catch (e) {
    error = e
  }
  return { calls: normalizeCalls(calls), error }
}

const hookSource = readWorking('hooks/use-file-upload.ts')
const libSource = readWorking('lib/researcher-upload.ts')
const createBody = list => JSON.parse(list.find(c => c.url.endsWith('/api/v1/sessions/create')).body)
const anyAt = list => list.some(c => (c.body ?? '').includes('@') || c.url.includes('@') || JSON.stringify(c.headers).includes('@'))

// ---------------------------------------- flag off: today's request bodies
const OFF_SCENARIOS = [
  { name: 'chat user with e-mail', userId: EMAIL },
  { name: 'empty userId (anonymous)', userId: '' },
  { name: 'cuid userId', userId: CUID },
]
const hookProps = userId => ({ sessionId: 'sess-1234567890', userId })

async function replayOff(hookSrc, libSrc) {
  const record = []
  for (const s of OFF_SCENARIOS) {
    delete env[FLAG]
    for (const [mode, shell] of MODES) {
      const hook = await runHook(hookSrc, hookProps(s.userId), shell)
      record.push({ scenario: `hook[${mode}]: ${s.name}`, calls: hook.calls, toasts: hook.toasts.map(t => t.title) })
    }
    const lib = await runLib(libSrc, { userId: s.userId, intent: 'template_ingest' })
    record.push({ scenario: `lib: ${s.name}`, calls: lib.calls, error: lib.error ? lib.error.message : null })
  }
  // The flag set to anything but the exact string true is still off.
  for (const value of ['false', '', '1', 'TRUE', 'yes']) {
    env[FLAG] = value
    for (const [mode, shell] of MODES) {
      const hook = await runHook(hookSrc, hookProps(EMAIL), shell)
      record.push({ scenario: `hook[${mode}]: flag "${value}"`, calls: hook.calls })
    }
    const lib = await runLib(libSrc, { userId: EMAIL })
    record.push({ scenario: `lib: flag "${value}"`, calls: lib.calls })
  }
  delete env[FLAG]
  return record
}

const offRecord = await replayOff(hookSource, libSource)

// Snapshot: exactly the request bodies the base code sent.
{
  const byName = Object.fromEntries(offRecord.map(r => [r.scenario, r]))
  const expectCreate = (userId, session) => ({
    user_id: userId, session_id: session, session_name: `Session_${session.slice(0, 8)}`,
    metadata: { frontend_session_id: session, upload_path: 'direct_supabase' },
  })
  for (const [mode] of MODES) {
    assert.deepEqual(createBody(byName[`hook[${mode}]: chat user with e-mail`].calls), expectCreate(EMAIL, 'sess-1234567890'), `${mode}, flag off: the paperclip still sends the e-mail`)
    assert.deepEqual(createBody(byName[`hook[${mode}]: empty userId (anonymous)`].calls), expectCreate('anonymous', 'sess-1234567890'), `${mode}, flag off: empty becomes anonymous`)
    assert.deepEqual(createBody(byName[`hook[${mode}]: cuid userId`].calls), expectCreate(CUID, 'sess-1234567890'))
    assert.equal(byName[`hook[${mode}]: chat user with e-mail`].toasts.includes('Upload blocked'), false, 'flag off never refuses')
  }
  assert.deepEqual(createBody(byName['lib: chat user with e-mail'].calls), {
    user_id: EMAIL, session_id: 'sess-1', session_name: 'Session_sess-1',
    metadata: { frontend_session_id: 'sess-1', upload_path: 'direct_supabase', intent: 'template_ingest' },
  })
  assert.deepEqual(createBody(byName['lib: empty userId (anonymous)'].calls).user_id, 'anonymous')
  for (const r of offRecord) {
    assert.equal(r.calls.length > 0 && r.calls[0].url === `${RESEARCHER}/api/v1/sessions/create`, true, `${r.scenario}: first request is sessions/create`)
  }
}

// Optional proof: the base commit's code sends the very same requests.
let proof = null
if (process.env.UPLOAD_OWNER_BASE_REF) {
  const ref = process.env.UPLOAD_OWNER_BASE_REF
  const baseRecord = await replayOff(readBase(ref, 'hooks/use-file-upload.ts'), readBase(ref, 'lib/researcher-upload.ts'))
  assert.deepEqual(JSON.parse(JSON.stringify(offRecord)), JSON.parse(JSON.stringify(baseRecord)), `flag off is identical to ${ref}`)
  const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
  proof = { ref, branch: hash(offRecord), base: hash(baseRecord), scenarios: offRecord.length, requests: offRecord.reduce((n, r) => n + r.calls.length, 0) }
  assert.equal(proof.branch, proof.base)
}

// Studio only: the owner-scoped request path is really the one running in that mode
// (after the uploader unmounts it admits nothing; the classic path would still send).
if (hookHasOwnerPath) {
  for (const [mode, shell] of MODES) {
    env[SHELL_ENV] = shell
    const { mod, shim } = loadHook(hookSource)
    delete env[SHELL_ENV]
    const harness = createHarness(mod.useFileUpload, shim)
    calls.length = 0
    const api = harness.render(hookProps(CUID))
    harness.unmount()
    await api.handleFilesSelected([pdf()])
    assert.equal(calls.length === 0, shell === 'true', `${mode}: owner-scoped path is ${shell === 'true' ? 'active' : 'not active'}`)
  }
}

// -------------------------------------------------- flag on: the account id
env[FLAG] = 'true'
{
  for (const [mode, shell] of MODES) {
    // paperclip hook: the page hands it the cuid; every request body is free of '@'
    const ok = await runHook(hookSource, hookProps(CUID), shell)
    assert.equal(createBody(ok.calls).user_id, CUID, `${mode}, flag on: user_id is the cuid`)
    assert.equal(anyAt(ok.calls), false, `${mode}, flag on: no e-mail anywhere in the requests`)
    assert.equal(ok.calls.length, 5, `${mode}: create, storage-upload-url, PUT, link, process-uploaded`)
    assert.equal(ok.files.length, 1)
    assert.equal(ok.files[0].status === 'error', false)

    // missing id: refused, no request of any kind, no chip, a clear message
    for (const [name, userId] of [['empty', ''], ['undefined', undefined], ['e-mail', EMAIL], ['anonymous', 'anonymous'], ['pipe', 'a|b']]) {
      const refused = await runHook(hookSource, hookProps(userId), shell)
      assert.equal(refused.calls.length, 0, `hook ${mode}, ${name}: no request is sent`)
      assert.equal(refused.files.length, 0, `hook ${mode}, ${name}: no upload chip`)
      const blocked = refused.toasts.find(t => t.title === 'Upload blocked')
      assert.ok(blocked, `hook ${mode}, ${name}: the user is told`)
      assert.equal(blocked.description, UPLOAD_OWNER_REQUIRED_MESSAGE)
      assert.equal(blocked.variant, 'destructive')
    }
  }

  // the Researcher upload library (composer and template ingest)
  const lib = await runLib(libSource, { userId: CUID, intent: 'template_ingest' })
  assert.equal(lib.error, null)
  assert.equal(createBody(lib.calls).user_id, CUID)
  assert.equal(anyAt(lib.calls), false)
  for (const userId of ['', undefined, EMAIL, 'anonymous']) {
    const refused = await runLib(libSource, { userId })
    assert.equal(refused.calls.length, 0, `lib, ${String(userId)}: no request is sent`)
    assert.equal(refused.error && refused.error.message, UPLOAD_OWNER_REQUIRED_MESSAGE)
  }
}
delete env[FLAG]

// ----------------------------------------------------- wiring in the page
{
  const page = readWorking('app/builder/page.tsx')
  assert.match(page, /import \{ builderUploadUserId \} from '@\/lib\/upload-owner'/)
  const call = page.slice(page.indexOf('} = useFileUpload({'), page.indexOf('onUploadComplete', page.indexOf('} = useFileUpload({')))
  assert.match(call, /userId: builderUploadUserId\(user\),/)
  assert.equal(call.includes('user?.email'), false, 'the page no longer hard-codes the e-mail')
  const hook = readWorking('hooks/use-file-upload.ts')
  assert.equal(/user_id:\s*(owner\.)?userId \|\|/.test(hook), false, 'no inline anonymous fallback left in the hook')
  assert.equal(/user_id:\s*(owner\.)?userId \|\|/.test(libSource), false, 'no inline anonymous fallback left in the upload library')
}

console.log('upload owner id tests passed')
if (proof) {
  console.log(`flag-off identity vs ${proof.ref}: ${proof.scenarios} scenarios, ${proof.requests} requests, sha256 branch=${proof.branch} base=${proof.base}`)
} else {
  console.log('base replay skipped (set UPLOAD_OWNER_BASE_REF=<ref> to compare with the base commit)')
}
