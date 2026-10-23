// STUDIO DECK IMPORT, "Import a PowerPoint as an editable deck" (FRONTEND-2 wrote the Studio half, FRONTEND-1 took it over and added the Builder welcome links and the imported-deck note): a button above the Decks page opens a dialog that uploads a .pptx, starts Director's import
// (POST /api/template-ingest/stage/import-reference), polls the job's `deck_import` block and opens the Builder on the finished deck. Flag NEXT_PUBLIC_STUDIO_DECK_IMPORT (exact "true"),
// default off, and only with the Studio shell. Director half: Director !518 (DIRECTOR_DECK_IMPORT_ENABLED); contract streams/director2/deck-import/CONTRACT.md.
//
// Run: node scripts/test-studio-deck-import.mjs   (plain node: transpile + vm, no network, no browser, no secrets; every secret below is made up at run time and never printed)
//   DECK_IMPORT_BASE=<commit>     the commit flag-off identity is checked against (default 8d5c494a, the studio-v4-dev-preparation-code tip this change is merged with)
//   DECK_IMPORT_QUICK=1           skip the mutants
//
// The 20 responses RECORDED from Director's real code (scripts/fixtures/deck-import/, byte copies of streams/director2/deck-import/ in the workspace, pinned by sha256 below) are replayed three ways:
// through the proxy routes (Director stubbed with the recorded status and body), through the pure rules, and through the dialog (browser -> real proxy routes -> recorded Director).
//   1. carried files: lib/director-rest-entitlement.ts and its golden vector are OPS-2's PR #312, byte for byte (git blob hashes pinned; #312's own test comes with #312); golden vector reproduced by the real helper;
//   2. lib/studio-deck-import.ts: the flag rule, the file check, the one start body, the refusals in the contract's words, every recorded job read, the finished-deck shape;
//   3. the two proxy routes (executed with stubs): 404 before any session read, signed-in only, exact Director requests, pass-through of every recorded status, the entitlement header
//      (present only when BOTH flags are on and the secret is set; the secret is never read otherwise; claims checked by an independent verifier);
//   4. the dialog and its hook (executed with a small hooks runtime): choose, upload, start, waiting/placing/opening/ready, what changed, every failure, Try again, resume, guards;
//   5. flag-off identity: the Decks page is the base's file byte for byte, the new layout hands the page back with no wrapper, every other changed file is a listed new file;
//   6. static: no 'use client' module reaches the minter, the minter is imported by the two routes only, the CSS, the env example, package.json;
//   7. mutants: every one is killed by an assertion.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
import postcss from 'postcss'
import { DECK_IMPORT_BUILDER_ADDITIONS } from './studio-deck-import-strip.mjs'
import { appendOnlyOver, createRuntime, flat, jsxRuntime, root, text as nodeText } from './studio-library-manage-harness.mjs'

const BASE_COMMIT = process.env.DECK_IMPORT_BASE || '8d5c494a7abcbfaf3d1b69eda257a5100013cb18'
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
// `git cat-file -e` first: `git show <rev>:<path with [brackets]>` prints nothing and exits 0 for a path that does not exist
const gitShow = (commit, rel) => {
  try {
    execFileSync('git', ['cat-file', '-e', `${commit}:${rel}`], { cwd: root, stdio: 'ignore' })
    return execFileSync('git', ['show', `${commit}:${rel}`], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
  } catch { return null }
}
const baseSource = rel => { const text = gitShow(BASE_COMMIT, rel); if (text === null) throw new Error(`base commit ${BASE_COMMIT} is not in this clone (fetch the full history)`); return text }

const FLAG = 'NEXT_PUBLIC_STUDIO_DECK_IMPORT'
const LIB = 'lib/studio-deck-import.ts'
const HOOK = 'hooks/use-studio-deck-import.ts'
const DIALOG = 'components/studio-deck-import/studio-deck-import-dialog.tsx'
const ENTRY = 'components/studio-deck-import/studio-deck-import-entry.tsx'
const NOTE = 'components/studio-deck-import/studio-deck-import-note.tsx'
const GATE = 'components/studio-deck-import/studio-deck-import-gate.tsx'
const PAGE = 'app/builder/page.tsx'
const POLICY = 'lib/composer-theme-policy.ts'
const STRIP = 'scripts/studio-deck-import-strip.mjs'
const CSS = 'components/studio-deck-import/studio-deck-import.css'
const LAYOUT = 'app/(app)/dashboard/layout.tsx'
const FIRSTRUN = 'components/builder/studio-first-run-actions.tsx'
const STAGE = 'components/builder/studio-welcome-stage.tsx'
const START = 'app/api/studio-deck-import/route.ts'
const JOBS = 'app/api/studio-deck-import/jobs/[jobId]/route.ts'
const HELPER = 'lib/director-rest-entitlement.ts'
const GOLDEN = 'scripts/fixtures/rest-entitlement-golden-vector.json'
const DASHBOARD = 'app/(app)/dashboard/page.tsx'
const ENVFILE = '.env.example'
const PKG = 'package.json'
const RECORDED = 'scripts/fixtures/deck-import'
const NEW_FILES = [LIB, HOOK, DIALOG, ENTRY, NOTE, GATE, CSS, LAYOUT, START, JOBS, HELPER]
// the existing files this change edits, each by a few lines: [what the change adds, what the base has]. The Builder page's lines are the strip module's (scripts/studio-deck-import-strip.mjs).
const EDITED_FILES = {
  [PAGE]: DECK_IMPORT_BUILDER_ADDITIONS,
  [FIRSTRUN]: [
    ['import { FileUp, LayoutTemplate, RectangleHorizontal } from "lucide-react"', 'import { LayoutTemplate, RectangleHorizontal } from "lucide-react"'],
    [' * NEXT_PUBLIC_STUDIO_DECK_IMPORT (default off): one more link, "Import a PowerPoint", to the Decks page, which opens its import dialog (ruling I5a). Off, it is not drawn.\n', ''],
    ['      {process.env.NEXT_PUBLIC_STUDIO_DECK_IMPORT === "true" && <Link href="/dashboard?import=pptx" className="studio-first-run-link" data-studio-deck-import-builder="true"><FileUp size={13} aria-hidden="true" />Import a PowerPoint</Link>}\n', ''],
  ],
  [STAGE]: [
    ["import { FileUp, Layers, Sparkles, LayoutTemplate } from 'lucide-react'", "import { Layers, Sparkles, LayoutTemplate } from 'lucide-react'"],
    ['\n *  NEXT_PUBLIC_STUDIO_DECK_IMPORT (default off): the caption gains "Import a PowerPoint", a link to the Decks page, which opens its import dialog (ruling I5a). Off, it is not drawn. */', ' */'],
    ["{process.env.NEXT_PUBLIC_STUDIO_DECK_IMPORT === 'true' && <Link href=\"/dashboard?import=pptx\" data-studio-deck-import-builder=\"true\"><FileUp size={14} aria-hidden=\"true\" />Import a PowerPoint</Link>}", ''],
  ],
  // Director's import marker kept by the Builder's own adoption reader (no other input gives a different answer)
  [POLICY]: [
    ["\n  /** Director's marker for a deck imported from a PowerPoint file (NEXT_PUBLIC_STUDIO_DECK_IMPORT's other half, composer_adoption.source). Absent for every other adoption. */\n  source?: 'deck_import'", ''],
    [", ...(marker.source === 'deck_import' ? { source: 'deck_import' as const } : {})", ''],
  ],
}


// ---------------------------------------------------------------- counting and overrides (for the mutants)
let checks = 0
let counting = true
const count = fn => (...args) => { if (counting) checks++; return fn(...args) }
const eq = count(assert.equal), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch)
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value)) // values built inside a vm carry its realm's prototypes
const deepEq = count((actual, expected, ...message) => assert.deepStrictEqual(plain(actual), plain(expected), ...message)) // no explicit undefined message: Node 26 rejects it when the assertion fails
const sha = value => crypto.createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex')
let OVER = {}
const src = rel => OVER[rel] ?? read(rel)

// ---------------------------------------------------------------- the recorded responses
const recordedNames = fs.readdirSync(path.join(root, RECORDED)).filter(name => /^\d\d-.*\.json$/.test(name)).sort()
const REC = Object.fromEntries(recordedNames.map(name => [name.slice(0, 2), JSON.parse(read(`${RECORDED}/${name}`))]))
// what a poll of the recorded job answers: file 06 wraps the job next to the Composer requests Director made
const jobReply = n => REC[n].body.job ?? REC[n].body
const RECORDED_SHA256 = {
  '01': '57b2f31214b945d76df0a4b8', '02': '3b0c7c0fe0333404a0950cec', '03': 'f28744dd54bdf7206e6127a0', '04': '5b49532fcfb4b6727aa82c40', '05': 'dc1629fc62fde2f398e2c002', '06': '13bdc8314dc0fc6f9274daeb',
  '07': '7758bd0eb554149caaec8eb9', '08': '06af8fd8c824e601f82f6cb2', '09': '84af1af3e5a358e58a597d8f', '10': '30860a8b237a9f68f58c44f4', '11': '40257bcc28aaacd51f9fce89', '12': '697d1b4988aafbd4c2d12af1',
  '13': '818e7978bdb7226c2d65fe06', '14': '784c23741672cda8417c4d96', '15': '81c7048caacb5aaad96ab453', '16': 'd3041762818d76ee93bf12ae', '17': 'efac6f4b940271c6600c1e50',
  // 23 Oct, Director seat2/director-import-adoption-source (!521): composer_adoption.source = "deck_import" on the job result and in the sync_response frame; none for a "Use original" deck
  '18': '49dcfc3574fda8ec6c3065e6', '19': 'b86bcdae2ccf0c9ba2f87486', '20': 'a12cb4bc56774f317f0bdad6',
}
const SESSION = 'fresh-session' // the id every recorded response carries
const JOB_ID = REC['01'].body.job_id
const USER_ID = 'user-db-7f3a' // the database id the proxies send as X-Composer-User-Id; the session's own id below differs on purpose
const EMAIL = 'person@example.test'
const FILE = { name: 'Q3 Board Review.pptx', size: 3073, type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }
const DIRECTOR_URL = 'https://directorv40-uat.up.railway.app'
// made up for this run only: never a literal, never printed
const TEST_SECRET = crypto.randomBytes(24).toString('hex')
const TEST_TOKEN = crypto.randomBytes(16).toString('hex')
const FIXED_NOW = 1790000000

// ---------------------------------------------------------------- loading: transpile + vm, a closed list of imports
const compiled = new Map()
function compile(rel, source) {
  const key = `${rel}\0${source}`
  if (!compiled.has(key)) {
    const out = ts.transpileModule(source, { fileName: rel, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } })
    assert.equal((out.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0, `${rel} compiles`)
    compiled.set(key, out.outputText)
  }
  return compiled.get(key)
}
function createWorld({ real, stubs = {}, globals = {} }) {
  const cache = new Map()
  const resolve = (spec, from) => {
    if (!spec.startsWith('@/') && !spec.startsWith('.')) return null
    const base = spec.startsWith('@/') ? spec.slice(2) : path.posix.normalize(path.posix.join(path.posix.dirname(from), spec))
    return ['.ts', '.tsx'].map(suffix => base + suffix).find(file => fs.existsSync(path.join(root, file))) ?? null
  }
  const requireFor = (spec, from) => {
    if (spec in stubs) return stubs[spec]
    if (spec === 'react/jsx-runtime') return jsxRuntime
    if (spec.endsWith('.css')) return {}
    const rel = resolve(spec, from)
    if (rel && real.includes(rel)) return load(rel)
    return assert.fail(`${from} asked for an import nobody handed in: ${spec}`)
  }
  function load(rel) {
    if (cache.has(rel)) return cache.get(rel)
    const mod = { exports: {} }
    cache.set(rel, mod.exports)
    const context = { module: mod, exports: mod.exports, console, URL, URLSearchParams, Buffer, Response, Request, Headers, AbortController, AbortSignal, TextEncoder, ...globals, require: spec => requireFor(spec, rel) }
    vm.runInNewContext(compile(rel, src(rel)), context, { filename: rel })
    cache.set(rel, mod.exports)
    return mod.exports
  }
  return { load }
}
const libWorld = () => createWorld({ real: [LIB, 'lib/studio-template-progress.ts'] })
const loadLib = () => libWorld().load(LIB)

// ---------------------------------------------------------------- the independent verifier of the REST entitlement header (written from F-rest-entitlement.md; imports nothing of the minter)
function verifyRestHeader(header, secret, { method, sub, now }) {
  const fail = why => ({ ok: false, why })
  if (typeof header !== 'string' || Buffer.byteLength(header, 'utf8') > 4096) return fail('shape')
  const parts = header.split('.')
  if (parts.length !== 2 || !parts.every(part => /^[A-Za-z0-9_-]+$/.test(part))) return fail('shape')
  const expected = crypto.createHmac('sha256', secret).update('deckster-rest-v1.' + parts[0], 'ascii').digest()
  const got = Buffer.from(parts[1], 'base64url')
  if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) return fail('signature')
  const claims = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
  if (claims.v !== 1 || claims.typ !== 'rest' || 'sid' in claims) return fail('claims')
  if (claims.m !== method) return fail('method')
  if (sub !== undefined && claims.sub !== sub) return fail('sub')
  if (!Number.isInteger(claims.iat) || !Number.isInteger(claims.exp) || claims.exp - claims.iat !== 120) return fail('lifetime')
  if (now < claims.iat - 60 || now >= claims.exp) return fail('expired')
  return { ok: true, claims }
}

// ---------------------------------------------------------------- a rig for the two proxy routes: stubs for the session, the database, Next and Director
function routeRig({ flag = 'true', helperFlag, secret, session = 'in', userLookup = 'ok', ownsSession = true, directorUrl = DIRECTOR_URL, token = TEST_TOKEN, director } = {}) {
  const envObject = {
    ...(flag === null ? {} : { [FLAG]: flag }), // null = not set (a default parameter would swallow undefined)
    ...(directorUrl === null ? {} : { COMPOSER_DIRECTOR_URL: directorUrl }),
    ...(token === null ? {} : { COMPOSER_FRONTDOOR_TOKEN: token }),
    ...(helperFlag === undefined ? {} : { DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED: helperFlag }),
    ...(secret === undefined ? {} : { DIRECTOR_WS_AUTH_SECRET: secret }),
  }
  const reads = []
  const env = new Proxy(envObject, { get: (target, key) => { reads.push(String(key)); return target[key] } })
  const calls = { session: 0, user: [], chat: [], fetch: [] }
  const reply = director ?? (() => ({ status: 200, body: {} }))
  const directorFetch = async (url, init) => {
    calls.fetch.push({ url: String(url), init })
    const answer = await reply(String(url), init)
    if (answer.throws) throw answer.throws
    return new Response(answer.raw ?? JSON.stringify(answer.body), { status: answer.status })
  }
  const stubs = {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    'next-auth': { getServerSession: async () => { calls.session++; return session === 'in' ? { user: { email: EMAIL, id: 'session-token-id' } } : null } },
    '@/lib/auth-options': { authOptions: {} },
    '@/lib/prisma': { prisma: {
      user: { findUnique: async arg => { calls.user.push(arg); if (userLookup === 'throws') throw new Error('db down'); return userLookup === 'none' ? null : { id: USER_ID } } },
      chatSession: { findFirst: async arg => { calls.chat.push(arg); return ownsSession ? { id: arg.where.id } : null } },
    } },
    crypto,
  }
  const world = createWorld({
    real: [START, JOBS, HELPER, LIB, 'lib/studio-template-progress.ts', 'lib/service-url.ts', 'lib/composer-library.ts'],
    stubs, globals: { process: { env }, fetch: directorFetch, Date: { now: () => FIXED_NOW * 1000 } },
  })
  const start = async (body, { headers = { 'content-type': 'application/json' }, raw } = {}) => {
    const { POST } = world.load(START)
    const res = await POST(new Request('http://localhost/api/studio-deck-import', { method: 'POST', headers, body: raw ?? JSON.stringify(body) }))
    return { res, json: await res.clone().json().catch(() => null) }
  }
  const job = async jobId => {
    const { GET } = world.load(JOBS)
    const res = await GET(new Request(`http://localhost/api/studio-deck-import/jobs/${jobId}`), { params: Promise.resolve({ jobId }) })
    return { res, json: await res.clone().json().catch(() => null) }
  }
  return { start, job, calls, reads, env: envObject }
}
const START_BODY = { session_id: SESSION, researcher_session_id: SESSION, storage_path: `${SESSION}/1_Q3 Board Review.pptx`, file_name: FILE.name, kind: 'pptx' }
const directorFromRecorded = () => (url, init) => {
  if ((init?.method ?? 'GET') === 'POST') return { status: REC['01'].status, body: REC['01'].body }
  return { status: 200, body: jobReply(directorFromRecorded.current ?? '02') }
}

// ================================================================ 1. carried files, blobs, base identity
async function secBlobs() {
  // OPS-2's PR #312 (origin/ops2/rest-entitlement-header-studio @ 93c1c94), carried byte for byte: the git blob ids are those of that branch
  const PINNED = { [HELPER]: '10dace49fee5c21ca93b4c3b6e3bd7e4f32d55f1', [GOLDEN]: '1d25f7b248d14311d6ca16c4784a0ca3fb4850c3' }
  for (const [rel, blob] of Object.entries(PINNED)) {
    const bytes = Buffer.from(src(rel), 'utf8')
    eq(crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), blob, `${rel} is PR #312's blob, byte for byte`)
  }
  for (const [name, digest] of Object.entries(RECORDED_SHA256)) eq(sha(fs.readFileSync(path.join(root, RECORDED, recordedNames.find(n => n.startsWith(name))))).slice(0, 24), digest, `recorded response ${name} is Director's, byte for byte`)
  eq(recordedNames.length, 20, 'all 20 recorded responses are here (17 + the three adoption-source examples)')
  // the golden vector, reproduced by the real helper (flag on, a key from the fixture; a different key must not reproduce it)
  const vector = JSON.parse(read(GOLDEN))
  eq(vector.dummy, true)
  const key = Buffer.from(vector.test_hmac_key_hex, 'hex').toString('utf8')
  const makeHelper = (env, clockSeconds) => createWorld({ real: [HELPER], stubs: { crypto }, globals: { process: { env }, Date: { now: () => clockSeconds * 1000 } } }).load(HELPER)
  for (const c of vector.cases) {
    const helper = makeHelper({ DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED: 'true', DIRECTOR_WS_AUTH_SECRET: key }, vector.fixed_clock.mint_now)
    deepEq(helper.restEntitlementHeaders(c.inputs.sub, c.inputs.method, c.inputs.bq ?? undefined), { [vector.header_name]: c.header }, `${c.id}: the golden header, through the flag-gated helper`)
    ok(verifyRestHeader(c.header, key, { method: c.verify.method, sub: c.inputs.sub, now: c.verify.now }).ok, `${c.id}: the independent verifier accepts it`)
  }
  // flag-off identity of the rest of the app: the Decks page and every file this change does not list are the base's, byte for byte
  eq(src(DASHBOARD), baseSource(DASHBOARD), 'the Decks page (app/(app)/dashboard/page.tsx) is the base commit\'s file, byte for byte')
  const changed = execFileSync('git', ['diff', '--name-only', BASE_COMMIT, '--', 'app', 'components', 'lib', 'hooks', 'middleware.ts', 'contexts', 'types', 'prisma', 'next.config.mjs', 'public', 'styles'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean)
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', 'app', 'components', 'lib', 'hooks'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean)
  deepEq([...new Set([...changed, ...untracked])].sort(), [...NEW_FILES, ...Object.keys(EDITED_FILES)].sort(), 'the only files under app, components, lib and hooks that differ from the base are this change\'s eleven new ones and the four existing files that gain a few flag-gated lines (the Builder page, the adoption reader and the two welcome components)')
  // each of those four is the base's file plus exactly the listed lines (nothing else moved)
  for (const [rel, additions] of Object.entries(EDITED_FILES)) {
    let text = src(rel)
    for (const [added, original] of additions) { eq(text.split(added).length - 1, 1, `${rel}: the addition is there once: ${added.slice(0, 50)}`); text = text.replace(added, () => original) }
    eq(text, baseSource(rel), `${rel} without this change's lines is the base's file, byte for byte`)
  }
  for (const rel of NEW_FILES.filter(file => file !== HELPER)) ok(gitShow(BASE_COMMIT, rel) === null, `${rel} is new (the base has no such file)`)
  eq(gitShow(BASE_COMMIT, HELPER), null, 'the minter is not on the base: it is carried from PR #312')
}

// ================================================================ 2. the pure rules
async function secLib() {
  const L = loadLib()
  // the flag rule
  for (const [flag, shell, want] of [['true', 'true', true], ['true', undefined, false], ['true', 'false', false], [undefined, 'true', false], ['false', 'true', false], ['TRUE', 'true', false], ['1', 'true', false], ['true ', 'true', false], ['', 'true', false], [null, 'true', false]]) {
    eq(L.studioDeckImportOn(flag, shell), want, `flag ${JSON.stringify(flag)} with shell ${JSON.stringify(shell)}`)
  }
  eq(L.DECK_IMPORT_START_ENDPOINT, '/api/studio-deck-import')
  eq(L.deckImportJobEndpoint('stage-import-abc'), '/api/studio-deck-import/jobs/stage-import-abc')
  eq(L.deckImportJobEndpoint('a/b c'), '/api/studio-deck-import/jobs/a%2Fb%20c', 'a job id is encoded')
  eq(L.DECK_IMPORT_MAX_BYTES, 100 * 1024 * 1024)
  eq(L.DECK_IMPORT_POLL_FALLBACK_MS, 3000)
  eq(L.DECK_IMPORT_POLL_RETRIES, 3)
  eq(L.DECK_IMPORT_WATCH_LIMIT_MS, 90 * 60 * 1000)

  // the file, checked before anything is uploaded (the contract's sentences, word for word)
  const PDF = 'Import the PowerPoint this PDF came from. PDF import is coming.'
  const NOT_PPTX = 'Only PowerPoint (.pptx) files can be imported. Save the file as .pptx and try again.'
  const TOO_LARGE = 'This file is too large to import. Files up to 100 MB can be imported.'
  for (const [file, want] of [
    [{ name: 'deck.pptx', size: 10 }, null], [{ name: 'DECK.PPTX', size: 10 }, null], [{ name: ' deck.pptx ', size: 10 }, null], [{ name: 'a.b.pptx', size: 100 * 1024 * 1024 }, null],
    [{ name: 'deck.pdf', size: 10 }, PDF], [{ name: 'DECK.PDF', size: 10 }, PDF], [{ name: 'deck.pdf', size: 0 }, PDF],
    [{ name: 'deck.key', size: 10 }, NOT_PPTX], [{ name: 'deck.ppt', size: 10 }, NOT_PPTX], [{ name: 'deck.pptm', size: 10 }, NOT_PPTX], [{ name: 'deckpptx', size: 10 }, NOT_PPTX], [{ name: '', size: 10 }, NOT_PPTX], [{}, NOT_PPTX], [null, NOT_PPTX],
    [{ name: 'deck.pptx', size: 0 }, 'This file is empty. Choose a PowerPoint (.pptx) file.'], [{ name: 'deck.pptx' }, 'This file is empty. Choose a PowerPoint (.pptx) file.'],
    [{ name: 'deck.pptx', size: 100 * 1024 * 1024 + 1 }, TOO_LARGE],
  ]) {
    eq(L.deckImportFileError(file), want, `file ${JSON.stringify(file)}`)
    eq(L.checkDeckImportFile(file).ok, want === null)
  }
  deepEq(L.checkDeckImportFile({ name: 'deck.pdf', size: 1 }), { ok: false, code: 'FILE_IS_PDF', message: PDF })
  eq(L.deckImportTitle('Q3 Board Review.pptx'), 'Q3 Board Review')
  eq(L.deckImportTitle('  Report.PPTX '), 'Report')
  eq(L.deckImportTitle('.pptx'), 'Imported deck')
  eq(L.deckImportTitle('x'.repeat(300) + '.pptx').length, 150, 'a title is cut at 150 characters')

  // the one start body
  deepEq(L.deckImportStartBody({ sessionId: SESSION, researcherSessionId: SESSION, storagePath: START_BODY.storage_path, fileName: FILE.name }), START_BODY)
  deepEq(Object.keys(L.deckImportStartBody({ sessionId: 'a', researcherSessionId: 'a', storagePath: 'a/b', fileName: 'c.pptx' })), ['session_id', 'researcher_session_id', 'storage_path', 'file_name', 'kind'])
  deepEq(L.DECK_IMPORT_START_KEYS, ['session_id', 'researcher_session_id', 'storage_path', 'file_name', 'kind'])
  ok(L.parseDeckImportStart(START_BODY).ok)
  deepEq(L.parseDeckImportStart(START_BODY), { ok: true, body: START_BODY })
  const bad = patch => L.parseDeckImportStart({ ...START_BODY, ...patch }).ok
  const dropped = key => { const { [key]: _gone, ...rest } = START_BODY; return L.parseDeckImportStart(rest).ok }
  for (const key of Object.keys(START_BODY)) eq(dropped(key), false, `missing ${key}`)
  eq(bad({ extra: 'x' }), false, 'a sixth key')
  eq(bad({ kind: 'pdf' }), false); eq(bad({ kind: undefined }), false); eq(bad({ kind: 'PPTX' }), false)
  eq(bad({ researcher_session_id: 'other' }), false, 'the Researcher session is the same id')
  eq(bad({ session_id: 'a b', researcher_session_id: 'a b', storage_path: 'a b/f.pptx' }), false); eq(bad({ session_id: 'x'.repeat(201), researcher_session_id: 'x'.repeat(201), storage_path: `${'x'.repeat(201)}/f.pptx` }), false)
  for (const storage_path of ['other/f.pptx', `${SESSION}/`, `${SESSION}/..`, `${SESSION}/.`, `${SESSION}/a/b.pptx`, `${SESSION}`, `/${SESSION}/f.pptx`, `${SESSION}/a%2Fb.pptx`, `${SESSION}/a\\b.pptx`, `${SESSION}/a?b.pptx`, `${SESSION}/a#b.pptx`, `${SESSION}/a:b.pptx`, `${SESSION}/a\nb.pptx`, `${SESSION}/a\0b.pptx`, '']) eq(bad({ storage_path }), false, `storage path ${JSON.stringify(storage_path)}`)
  for (const file_name of ['', 5, null]) eq(bad({ file_name }), false, `file name ${JSON.stringify(file_name)}`)
  eq(bad({ file_name: 'Keynote.key' }), true, 'the extension is Director\'s to refuse, in its own words')
  for (const payload of [null, undefined, 'x', 5, [], [START_BODY]]) eq(L.parseDeckImportStart(payload).ok, false, `payload ${JSON.stringify(payload)}`)

  // ids
  for (const [id, want] of [['stage-import-50b26aee-7a38', true], ['stage-import-', false], ['stage-import', false], ['stage-abc', false], ['upload-0123456789abcdef', false], ['stage-0123456789abcdef-import', false], ['../stage-import-x', false], ['stage-import-a/b', false], ['stage-import-a b', false], [`stage-import-${'x'.repeat(200)}`, false], [5, false], [null, false]]) eq(L.deckImportJobIdValid(id), want, `job id ${JSON.stringify(id)}`)
  eq(L.deckImportAcceptedJobId(REC['01'].body), JOB_ID)
  for (const body of [null, {}, { job_id: 'upload-123' }, { job_id: 5 }, 'x']) eq(L.deckImportAcceptedJobId(body), null, `accepted ${JSON.stringify(body)}`)

  // the refusals at the start, in the contract's words (17-route-refusals.json, all nine)
  const refusal = REC['17'].body
  const words = {
    pdf: [PDF, false], keynote: [NOT_PPTX, false], incomplete: ['The import request is incomplete. Upload the file again.', false],
    session_mismatch: ['Upload must use the authenticated Builder session', false],
    storage_path: ['Invalid upload storage reference', false], session_not_fresh: ['A fresh Director session is required', false],
    composer_async_off: ['Deck import is not available right now.', false], flag_off: ['Deck import is not available right now.', false],
    entitlement_w_missing_header: ['We could not confirm your sign-in for this request. Please reload the page and try again.', false],
  }
  deepEq(Object.keys(refusal).sort(), Object.keys(words).sort(), 'every recorded refusal has its words here')
  for (const [name, [message, retryable]] of Object.entries(words)) deepEq(L.deckImportStartFailure(refusal[name].status, refusal[name].body), { message, retryable }, `refusal ${name} (${refusal[name].status})`)
  deepEq(L.deckImportStartFailure(401, { detail: 'Authenticated Composer proxy is required' }), { message: L.DECK_IMPORT_WORDS.SIGN_IN, retryable: false }, 'the front door\'s bare 401 is not shown as developer text')
  deepEq(L.deckImportStartFailure(401, { error: 'Sign in to import a deck.' }), { message: 'Sign in to import a deck.', retryable: false }, 'Studio\'s own 401 words')
  deepEq(L.deckImportStartFailure(401, { code: 'ENTITLEMENT_INVALID', detail: 'Reload and retry.', error: 'Reload and retry.', retryable: true }), { message: 'Reload and retry.', retryable: true }, 'an entitlement refusal that says retryable')
  deepEq(L.deckImportStartFailure(502, { error: 'Deck import is temporarily unavailable. Try again.' }), { message: 'Deck import is temporarily unavailable. Try again.', retryable: true })
  deepEq(L.deckImportStartFailure(413, { error: 'Reference is too large.' }), { message: 'Reference is too large.', retryable: false })
  deepEq(L.deckImportStartFailure(500, null), { message: 'The import could not be started. Try again.', retryable: true })
  deepEq(L.deckImportStartFailure(0, 'junk'), { message: 'The import could not be started. Try again.', retryable: true })
  deepEq(L.deckImportStartFailure(400, {}), { message: 'The import could not be started. Try again.', retryable: false })

  // every recorded job read (02-16)
  const view = n => plain(L.deckImportView(jobReply(n)))
  const working = (n, stage, wordsOut, extra) => deepEq(view(n), { kind: 'working', stage, words: wordsOut, detail: null, progress: null, eta: null, waiting: false, nextMs: 3000, ...extra }, `recorded ${n}: working, ${stage}`)
  working('02', 'waiting', 'Waiting for a free slot…', { detail: 'Another file is being read first. Trying again in about 30 seconds.', waiting: true })
  working('03', 'placing', 'Placing your slides…', { progress: { label: '0 of 1 slide', done: 0, total: 1 }, eta: 'about 2 minutes left' })
  working('04', 'opening', 'Opening your deck…')
  const ready05 = view('05'), ready06 = view('06')
  eq(ready05.kind, 'ready'); eq(ready06.kind, 'ready')
  deepEq(ready05.result, REC['05'].body.deck_import.result, 'the finished deck is the recorded result')
  deepEq(ready05.summary, {
    title: 'Q3 Board Review', slideCount: 3, banner: '2 items changed. See What changed',
    headline: 'Template ready: 6 slides. All 107 pieces of text are editable. 85 of 85 elements are editable. 2 small changes are listed below.',
    lines: [{ text: 'On slide 1, letter spacing is set to normal in 1 text box.', slides: [1], source: 'composer' }, { text: 'On slide 4, a dashed outline is drawn solid.', slides: [4], source: 'composer' }],
    notesLine: null,
  }, 'recorded 05: what changed, notes copied')
  deepEq(ready06.summary, {
    title: 'Q3 Board Review', slideCount: 1, banner: '1 item changed. See What changed', headline: null,
    lines: [{ text: 'Speaker notes were not kept.', slides: [], source: 'director' }], notesLine: null,
  }, 'recorded 06: notes not kept, said once (it is already a line)')
  const failures = {
    '07': ['UPLOAD_FILE_NOT_16X9', 'Only widescreen (16:9) decks can be imported today.', false], '08': ['UPLOAD_FILE_PASSWORD_PROTECTED', 'This file is password-protected. Remove the password and try again.', false],
    '09': ['UPLOAD_FILE_TOO_LARGE', TOO_LARGE, false], '10': ['UPLOAD_FILE_TOO_MANY_SLIDES', 'This deck has more than 120 slides. Split it into smaller decks and try again.', false],
    '11': ['COMPOSER_JOB_LOST', 'Import stopped. Try again.', true], '12': ['OPEN_FAILED', 'Your file was read, but the deck could not be opened. Try again.', true],
    '13': ['IMPORT_UNAVAILABLE', 'Deck import is not available right now.', false], '14': ['PREPARE_AS_IS_FAILED', 'Your file could not be imported. Try again.', false],
    '15': ['TIMEOUT', 'This is taking too long. Try again.', true], '16': ['UPLOAD_FILE_TOO_LARGE', TOO_LARGE, false],
  }
  for (const [n, [code, message, retryable]] of Object.entries(failures)) deepEq(view(n), { kind: 'failed', code, message, retryable }, `recorded ${n}: ${code}`)
  // the other branches of the reading
  eq(L.deckImportView(null).kind, 'failed'); eq(L.deckImportView('x').kind, 'failed'); eq(L.deckImportView(undefined).retryable, true)
  deepEq(plain(L.deckImportView({ status: 'cracking' })), { kind: 'failed', code: 'IMPORT_UNAVAILABLE', message: 'Deck import is not available right now.', retryable: false }, 'a job without deck_import: Director\'s flag went off')
  deepEq(plain(L.deckImportView({ status: 'failed', errors: ['Boom.'] })), { kind: 'failed', code: null, message: 'Boom.', retryable: false })
  deepEq(plain(L.deckImportView({ status: 'failed', errors: [] })), { kind: 'failed', code: null, message: 'Your file could not be imported. Try again.', retryable: false })
  deepEq(plain(L.deckImportView({ status: 'cancelled', deck_import: { stage: 'opening' } })), { kind: 'failed', code: null, message: 'Your file could not be imported. Try again.', retryable: false }, 'a cancelled job is a failure')
  deepEq(plain(L.deckImportView({ status: 'failed', deck_import: { stage: 'failed', error: { code: 'X', message: 'Edge.', retryable: 'yes' } } })), { kind: 'failed', code: 'X', message: 'Edge.', retryable: false }, 'retryable only when exactly true')
  deepEq(plain(L.deckImportView({ status: 'failed', errors: ['From errors.'], deck_import: { stage: 'failed', error: null } })), { kind: 'failed', code: null, message: 'From errors.', retryable: false })
  eq(L.deckImportView({ status: 'assembling', deck_import: { stage: 'ready', result: {} } }).kind, 'working', 'ready needs the job complete too')
  eq(L.deckImportView({ status: 'complete', deck_import: { stage: 'opening', result: {} } }).kind, 'working', 'and the stage ready')
  deepEq(plain(L.deckImportView({ status: 'complete', deck_import: { stage: 'ready', result: null } })), { kind: 'failed', code: 'OPEN_FAILED', message: 'Your file was read, but the deck could not be opened. Try again.', retryable: true }, 'ready without a deck')
  eq(L.deckImportView({ status: 'cracking', deck_import: { stage: 'mystery' } }).words, 'Working on your deck…')
  for (const [stage, wordsOut] of [['queued', 'Getting started…'], ['converting', 'Reading your file…'], ['placing', 'Placing your slides…'], ['checking', 'Checking every slide…'], ['opening', 'Opening your deck…'], ['waiting', 'Waiting for a free slot…']]) eq(L.deckImportView({ status: 'cracking', deck_import: { stage } }).words, wordsOut, `stage ${stage}`)
  const waitingDuringOpening = L.deckImportView({ status: 'assembling', deck_import: { stage: 'opening', waiting: { retry_after_s: 1, since: 'x' } } })
  eq(waitingDuringOpening.waiting, true, 'waiting can also appear during opening'); eq(waitingDuringOpening.detail, 'Another file is being read first. Trying again in about 1 second.')
  eq(L.deckImportView({ status: 'cracking', deck_import: { stage: 'waiting', waiting: {} } }).detail, 'Another file is being read first.', 'no Retry-After: no promise of a time')
  deepEq(L.deckImportView({ status: 'cracking', deck_import: { stage: 'placing', progress: { slide_count: 30, slides_done: 12, eta_s: 95 } } }).progress, { label: '12 of 30 slides', done: 12, total: 30 })
  eq(L.deckImportView({ status: 'cracking', deck_import: { stage: 'placing', progress: { slide_count: 30, slides_done: 12, eta_s: 95 } } }).eta, 'about 2 minutes left')
  deepEq(L.deckImportView({ status: 'cracking', deck_import: { stage: 'placing', progress: { slide_count: 3, slides_done: 9 } } }).progress, { label: '3 of 3 slides', done: 3, total: 3 }, 'done never passes the total')
  eq(L.deckImportView({ status: 'cracking', deck_import: { stage: 'placing', progress: { slide_count: 0, slides_done: 0 } } }).progress, null)
  eq(L.deckImportView({ status: 'cracking', deck_import: { stage: 'waiting', waiting: { retry_after_s: 30 }, progress: { slide_count: 3, slides_done: 1, eta_s: 60 } } }).eta, null, 'no time left while waiting')
  // the summary
  const summarise = block => plain(L.deckImportView({ status: 'complete', deck_import: { stage: 'ready', result: {}, ...block } }).summary)
  eq(summarise({ what_changed: { items: [] } }).banner, null); eq(summarise({}).banner, null); eq(summarise({ what_changed: { items: [{ text: 'a' }, { text: 'b' }, { text: 'c' }] } }).banner, '3 items changed. See What changed')
  deepEq(summarise({ what_changed: { items: [{ text: 'a', slides: [2, 'x', 0, 3.5, 4] }, { text: '  ' }, { nope: 1 }, null, 'x'] } }).lines, [{ text: 'a', slides: [2, 4], source: null }], 'junk items and slide numbers are dropped')
  eq(summarise({ notes: { state: 'partial', message: 'Speaker notes were not kept on slides 2, 3.' }, what_changed: { items: [] } }).notesLine, 'Speaker notes were not kept on slides 2, 3.', 'a notes sentence the list does not carry')
  eq(summarise({ notes: { state: 'copied', message: 'Never shown.' } }).notesLine, null); eq(summarise({ notes: { state: 'none', message: 'x' } }).notesLine, null); eq(summarise({ notes: null }).notesLine, null)
  eq(summarise({ notes: { state: 'not_kept', message: 'Same.' }, what_changed: { items: [{ text: 'Same.' }] } }).notesLine, null, 'said once')
  eq(L.deckImportBanner(0), null); eq(L.deckImportBanner(1), '1 item changed. See What changed'); eq(L.deckImportBanner(12), '12 items changed. See What changed')
  // poll interval
  for (const [asked, want] of [[3000, 3000], [2000, 2000], [500, 1000], [999999, 60000], [1500.4, 1500], [0, 3000], [-5, 3000], [NaN, 3000], ['3000', 3000], [undefined, 3000]]) eq(L.deckImportNextPollMs({ poll: { next_interval_ms: asked } }), want, `interval ${asked}`)
  eq(L.deckImportNextPollMs({}), 3000); eq(L.deckImportNextPollMs(null), 3000); eq(L.deckImportNextPollMs({ poll: null }), 3000)

  // the finished deck, in the shape "Use original" stages: the same fields and adoption block composerReadyResult builds, and the same refusals
  const composer = createWorld({ real: ['lib/composer-library.ts'] }).load('lib/composer-library.ts')
  const result = REC['05'].body.deck_import.result
  const marked = ready => ({ ...ready, composer_adoption: { ...ready.composer_adoption, source: 'deck_import' } })
  deepEq(L.deckImportReadyResult(result, SESSION), marked(composer.composerReadyResult({ status: 'complete', ...result }, SESSION)), 'same as composerReadyResult for the same deck, plus the import marker')
  deepEq(L.deckImportReadyResult({ ...result, slide_count: undefined }, SESSION), marked(composer.composerReadyResult({ status: 'complete', ...result, slide_count: undefined }, SESSION)))
  eq(L.deckImportReadyResult(result, 'another-session'), null, 'not this session\'s deck')
  for (const key of ['template_id', 'presentation_id', 'viewer_url']) eq(L.deckImportReadyResult({ ...result, [key]: '' }, SESSION), null, `no ${key}`)
  eq(L.deckImportReadyResult(null, SESSION), null); eq(L.deckImportReadyResult([], SESSION), null)
  eq(L.deckImportBuilderHref('a b/c'), '/builder?session_id=a%20b%2Fc')

  // what the browser gets of a job, and the record kept for a reload
  deepEq(Object.keys(plain(L.projectDeckImportJob(jobReply('05')))).sort(), ['deck_import', 'errors', 'job_id', 'poll', 'session_id', 'status'])
  deepEq(L.projectDeckImportJob({ job_id: 'j', user_id: 'u', upload_ref: { storage_path: 'p' }, checkpoint: {}, status: 's' }), { job_id: 'j', status: 's' })
  eq(L.projectDeckImportJob(null), null); eq(L.projectDeckImportJob([1]), null); eq(L.projectDeckImportJob('x'), null)
  eq(L.deckImportPendingKey('a@b.c'), 'deckster_deck_import_job_a%40b.c')
  deepEq(L.parseDeckImportPending({ job_id: JOB_ID, session_id: SESSION, file_name: FILE.name }), { job_id: JOB_ID, session_id: SESSION, file_name: FILE.name })
  for (const record of [null, {}, { job_id: 'upload-1', session_id: SESSION, file_name: 'x' }, { job_id: JOB_ID, session_id: 'a b', file_name: 'x' }, { job_id: JOB_ID, session_id: SESSION, file_name: '' }, 'x']) eq(L.parseDeckImportPending(record), null, `record ${JSON.stringify(record)}`)
  // the Builder's welcome links to the Decks page, which opens the dialog from that query alone (ruling I5a)
  eq(L.DECK_IMPORT_BUILDER_HREF, '/dashboard?import=pptx'); eq(L.DECK_IMPORT_ENTRY_PARAM, 'import'); eq(L.DECK_IMPORT_ENTRY_VALUE, 'pptx')
  for (const [search, want] of [['?import=pptx', true], ['import=pptx', true], ['?a=1&import=pptx', true], ['?import=pptx&a=1', true], ['?import=PPTX', false], ['?import=pdf', false], ['?import=', false], ['?import', false], ['?imports=pptx', false], ['?x=import=pptx', false], ['', false], [undefined, false], [null, false], [{}, false], [5, false]]) {
    eq(L.deckImportRequested(search), want, `search ${JSON.stringify(search)}`)
  }
  for (const [location, want] of [
    [{ pathname: '/dashboard', search: '?import=pptx', hash: '' }, '/dashboard'],
    [{ pathname: '/dashboard', search: '?import=pptx&a=1&b=2', hash: '#top' }, '/dashboard?a=1&b=2#top'],
    [{ pathname: '/dashboard', search: '?a=1&import=pptx', hash: '' }, '/dashboard?a=1'],
    [{ pathname: '/dashboard', search: '?a=1', hash: '' }, '/dashboard?a=1'],
    [{ pathname: '/dashboard', search: '', hash: '' }, '/dashboard'],
    [{ pathname: '', search: 5, hash: 5 }, '/'], [{}, '/'],
  ]) eq(L.deckImportEntryCleanUrl(location), want, `address ${JSON.stringify(location)}`)

  // an imported deck, remembered in this browser, and the note the Builder shows on it (contract section 3)
  eq(L.deckImportDoneKey('a@b.c'), 'deckster_deck_import_done_a%40b.c'); eq(L.deckImportNoteDismissedKey('a@b.c'), 'deckster_deck_import_note_dismissed_a%40b.c')
  ok(L.deckImportDoneKey('u') !== L.deckImportNoteDismissedKey('u'), 'two lists, two keys')
  deepEq(L.DECK_IMPORT_NOTE_WORDS, { title: 'Imported from PowerPoint', body: 'This deck keeps the design of your PowerPoint file. Changing the theme and Add Element are not available for imported decks yet.', dismiss: 'Got it' })
  deepEq(L.parseDeckImportIdList(['a', 'b', 'a', 'x y', 5, null, '', 'c/d', 'e']), ['a', 'b', 'e'], 'only plain ids, each once, in order')
  for (const junk of [null, undefined, 'a', {}, 5]) deepEq(L.parseDeckImportIdList(junk), [], 'not a list')
  const many = Array.from({ length: 130 }, (_, i) => `s${i}`)
  eq(L.DECK_IMPORT_DONE_LIMIT, 100); deepEq(L.parseDeckImportIdList(many), many.slice(30), 'the newest hundred')
  deepEq(L.deckImportIdListWith(['a', 'b'], 'c'), ['a', 'b', 'c']); deepEq(L.deckImportIdListWith(['a', 'b'], 'a'), ['b', 'a'], 'moved to the end, not repeated')
  deepEq(L.deckImportIdListWith(['a'], 'x y'), ['a'], 'a bad id changes nothing'); deepEq(L.deckImportIdListWith(['a'], undefined), ['a']); eq(L.deckImportIdListWith(many.slice(0, 100), 'new').length, 100, 'at the limit, the oldest goes')
  eq(L.deckImportIdListWith(many.slice(0, 100), 'new')[0], 's1')
  const store = (initial = {}) => { const map = new Map(Object.entries(initial)); return { map, getItem: key => (map.has(key) ? map.get(key) : null), setItem: (key, value) => { map.set(key, String(value)) } } }
  const throwing = { getItem() { throw new TypeError('blocked') }, setItem() { throw new TypeError('blocked') } }
  let st = store()
  eq(L.deckImportNoteVisible(st, 'u1', 's1'), false, 'nothing remembered: no note')
  L.rememberDeckImported(st, 'u1', 's1'); L.rememberDeckImported(st, 'u1', 's1'); L.rememberDeckImported(st, 'u1', 's2')
  deepEq(JSON.parse(st.map.get(L.deckImportDoneKey('u1'))), ['s1', 's2'], 'remembered once each')
  eq(L.deckImportNoteVisible(st, 'u1', 's1'), true); eq(L.deckImportNoteVisible(st, 'u1', 's2'), true)
  eq(L.deckImportNoteVisible(st, 'u1', 's3'), false, 'a deck this browser did not import'); eq(L.deckImportNoteVisible(st, 'u2', 's1'), false, 'another person on the same browser')
  eq(L.deckImportNoteVisible(st, null, 's1'), false); eq(L.deckImportNoteVisible(st, '', 's1'), false); eq(L.deckImportNoteVisible(st, 'u1', null), false); eq(L.deckImportNoteVisible(st, 'u1', 'x y'), false); eq(L.deckImportNoteVisible(st, 'u1', undefined), false)
  L.dismissDeckImportNote(st, 'u1', 's1')
  eq(L.deckImportNoteVisible(st, 'u1', 's1'), false, 'dismissed for that deck'); eq(L.deckImportNoteVisible(st, 'u1', 's2'), true, 'and only that deck'); eq(L.deckImportNoteVisible(st, 'u2', 's1'), false)
  deepEq(JSON.parse(st.map.get(L.deckImportNoteDismissedKey('u1'))), ['s1'])
  st = store({ [L.deckImportDoneKey('u1')]: 'not json', [L.deckImportNoteDismissedKey('u1')]: '{"a":1}' })
  eq(L.deckImportNoteVisible(st, 'u1', 's1'), false, 'a broken record is no record'); L.rememberDeckImported(st, 'u1', 's1'); eq(L.deckImportNoteVisible(st, 'u1', 's1'), true, 'and is replaced by a good one')
  eq(L.deckImportNoteVisible(throwing, 'u1', 's1'), false, 'blocked storage: no note'); L.rememberDeckImported(throwing, 'u1', 's1'); L.dismissDeckImportNote(throwing, 'u1', 's1')
  L.rememberDeckImported(null, 'u1', 's1'); L.rememberDeckImported(undefined, 'u1', 's1'); eq(L.deckImportNoteVisible(null, 'u1', 's1'), false, 'no storage at all: nothing happens, nothing throws')
  // Director's marker (`adopted`) comes first; the record is the fallback; dismissal beats both
  st = store()
  eq(L.deckImportNoteVisible(st, 'u1', 's1', true), true, 'adopted, nothing remembered: the note'); eq(L.deckImportNoteVisible(st, 'u1', 's1', false), false); eq(L.deckImportNoteVisible(st, 'u1', 's1'), false, 'the marker defaults to absent')
  for (const odd of ['true', 1, {}, [], 'yes']) eq(L.deckImportNoteVisible(st, 'u1', 's1', odd), false, `a marker that is not exactly true (${JSON.stringify(odd)})`)
  eq(L.deckImportNoteVisible(st, null, 's1', true), false, 'no account'); eq(L.deckImportNoteVisible(st, 'u1', 'x y', true), false, 'not a plain id'); eq(L.deckImportNoteVisible(st, 'u1', null, true), false)
  L.dismissDeckImportNote(st, 'u1', 's1'); eq(L.deckImportNoteVisible(st, 'u1', 's1', true), false, 'dismissed beats the marker'); eq(L.deckImportNoteVisible(st, 'u1', 's2', true), true, 'for that deck only')
  eq(L.deckImportNoteVisible(throwing, 'u1', 's1', true), true, 'blocked storage cannot hide Director\'s marker'); eq(L.deckImportNoteVisible(null, 'u1', 's1', true), true)
  st = store(); L.rememberDeckImported(st, 'u1', 'x y'); eq(st.map.size >= 0 && JSON.parse(st.map.get(L.deckImportDoneKey('u1')) ?? '[]').length, 0, 'a bad id is not remembered')
  // the lib reads nothing from outside and keeps no secret
  const lib = src(LIB)
  nomatch(lib, /process\.env|fetch\(|window\.|document\.|sessionStorage|localStorage/, 'the rules are pure')
  nomatch(lib, /DIRECTOR_WS_AUTH_SECRET|X-Deckster-Entitlement|Authorization/i, 'no secret, no header')
}

// ================================================================ 3. the proxy routes
const nine = Object.entries(REC['17'].body)
async function secRoutes() {
  // ---- flag off: 404 before the session is read, the database is asked, or Director is called; nothing but the flag is read from the environment
  for (const flag of [null, 'false', 'TRUE', '1', '', 'true ', 'yes']) {
    for (const kind of ['start', 'job']) {
      const rig = routeRig({ flag, helperFlag: 'true', secret: TEST_SECRET, director: () => assert.fail('Director must not be called') })
      const { res, json } = kind === 'start' ? await rig.start(START_BODY) : await rig.job(JOB_ID)
      eq(res.status, 404, `${kind}: flag ${JSON.stringify(flag)} is a 404`)
      deepEq(json, { error: 'Not found' })
      eq(rig.calls.session, 0, 'no session read'); eq(rig.calls.user.length + rig.calls.chat.length, 0, 'no database read'); eq(rig.calls.fetch.length, 0, 'no Director call')
      deepEq(rig.reads, [FLAG], 'only the flag is read: not the secret, not the token')
    }
  }
  // ---- signed in only, and only the person's own session
  for (const kind of ['start', 'job']) {
    const run = rig => kind === 'start' ? rig.start(START_BODY) : rig.job(JOB_ID)
    let rig = routeRig({ session: 'out' }); let out = await run(rig)
    eq(out.res.status, 401, `${kind}: signed out`); deepEq(out.json, { error: 'Sign in to import a deck.' }); eq(rig.calls.fetch.length, 0); eq(rig.calls.user.length, 0)
    rig = routeRig({ userLookup: 'none' }); out = await run(rig)
    eq(out.res.status, 401, `${kind}: no such account`); eq(rig.calls.fetch.length, 0)
    rig = routeRig({ userLookup: 'throws' }); out = await run(rig)
    eq(out.res.status, 503, `${kind}: database down`); eq(rig.calls.fetch.length, 0)
    deepEq(rig.calls.user, [{ where: { email: EMAIL }, select: { id: true } }], `${kind}: the account is looked up by the session's e-mail`)
  }
  // ---- start: the request body
  let rig = routeRig()
  let out = await rig.start(START_BODY, { headers: { 'content-type': 'text/plain' } })
  eq(out.res.status, 415); eq(rig.calls.chat.length, 0); eq(rig.calls.fetch.length, 0)
  rig = routeRig(); out = await rig.start(null, { raw: 'x'.repeat(8193) })
  eq(out.res.status, 413); deepEq(out.json, { error: 'Reference is too large.' }); eq(rig.calls.fetch.length, 0)
  rig = routeRig(); out = await rig.start(null, { raw: JSON.stringify(START_BODY) + ' '.repeat(8192) })
  eq(out.res.status, 413, 'the cap counts every byte')
  rig = routeRig(); out = await rig.start(null, { raw: '{not json' })
  eq(out.res.status, 400); deepEq(out.json, { error: 'The import could not be started. Try again.' })
  for (const body of [{ ...START_BODY, kind: 'pdf' }, { ...START_BODY, extra: 1 }, { ...START_BODY, researcher_session_id: 'other' }, { ...START_BODY, storage_path: 'other/f.pptx' }, { ...START_BODY, user_id: 'x' }, [], 'x']) {
    rig = routeRig(); out = await rig.start(body)
    eq(out.res.status, 400, `refused before Director: ${JSON.stringify(body).slice(0, 60)}`); eq(rig.calls.fetch.length, 0); eq(rig.calls.chat.length, 0, 'not even the database')
  }
  rig = routeRig({ ownsSession: false }); out = await rig.start(START_BODY)
  eq(out.res.status, 404, 'a session that is not the person\'s own'); deepEq(out.json, { error: 'The import session was not found. Upload the file again.' }); eq(rig.calls.fetch.length, 0)
  deepEq(rig.calls.chat, [{ where: { id: SESSION, userId: USER_ID, status: { not: 'deleted' } }, select: { id: true } }], 'the session must be this person\'s and not deleted')
  // ---- configuration
  for (const options of [{ directorUrl: null }, { token: null }, { directorUrl: 'https://directorv33-production.up.railway.app' }, { directorUrl: 'http://directorv40-uat.up.railway.app' }, { directorUrl: 'not a url' }]) {
    for (const kind of ['start', 'job']) {
      rig = routeRig(options); out = kind === 'start' ? await rig.start(START_BODY) : await rig.job(JOB_ID)
      eq(out.res.status, 503, `${kind}: ${JSON.stringify(Object.keys(options))} is not configured`); eq(out.json.error, 'Deck import is not available right now.'); eq(rig.calls.fetch.length, 0)
      nomatch(JSON.stringify(out.json), new RegExp(`${TEST_TOKEN}|railway`, 'i'), 'no URL and no token in the answer')
    }
  }
  // ---- start: the exact request to Director, and every recorded answer passed through
  rig = routeRig({ director: () => ({ status: REC['01'].status, body: REC['01'].body }) })
  out = await rig.start(START_BODY)
  eq(out.res.status, 202); deepEq(out.json, REC['01'].body, 'recorded 01: the 202 passes through')
  eq(out.res.headers.get('cache-control'), 'no-store')
  eq(rig.calls.fetch.length, 1)
  const call = rig.calls.fetch[0]
  eq(call.url, `${DIRECTOR_URL}/api/template-ingest/stage/import-reference`)
  eq(call.init.method, 'POST'); eq(call.init.cache, 'no-store'); eq(call.init.redirect, 'error'); ok(call.init.signal instanceof AbortSignal, 'a timeout')
  deepEq(Object.keys(call.init.headers).sort(), ['Authorization', 'Content-Type', 'X-Composer-User-Id'], 'flag-gated entitlement off: exactly the template upload\'s three headers')
  eq(call.init.headers.Authorization, `Bearer ${TEST_TOKEN}`); eq(call.init.headers['X-Composer-User-Id'], USER_ID, 'the database id, not the session\'s'); eq(call.init.headers['Content-Type'], 'application/json')
  deepEq(JSON.parse(call.init.body), START_BODY, 'the five keys, nothing else'); deepEq(Object.keys(JSON.parse(call.init.body)), Object.keys(START_BODY))
  deepEq(rig.reads.filter(key => key === 'DIRECTOR_WS_AUTH_SECRET'), [], 'the secret is not read with the entitlement flag off')
  rig = routeRig({ director: () => ({ status: 202, body: REC['01'].body }) })
  out = await rig.start(null, { raw: JSON.stringify(START_BODY, null, 4) })
  eq(out.res.status, 202); eq(rig.calls.fetch[0].init.body, JSON.stringify(START_BODY), 'what Director gets is the checked body, written again, not the browser\'s bytes')
  for (const [name, answer] of nine) {
    rig = routeRig({ director: () => ({ status: answer.status, body: answer.body }) })
    out = await rig.start(START_BODY)
    eq(out.res.status, answer.status, `recorded 17 ${name}: status passes through`); deepEq(out.json, answer.body, `recorded 17 ${name}: body passes through`)
  }
  rig = routeRig({ director: () => ({ status: 200, raw: '<html>gateway</html>' }) }); out = await rig.start(START_BODY)
  eq(out.res.status, 502); deepEq(out.json, { error: 'Deck import is temporarily unavailable. Try again.' })
  rig = routeRig({ director: () => ({ throws: new Error(`connect ECONNREFUSED ${DIRECTOR_URL}`) }) }); out = await rig.start(START_BODY)
  eq(out.res.status, 502); nomatch(JSON.stringify(out.json), /ECONNREFUSED|railway/, 'no Director detail')

  // ---- job: ids, the exact request, every recorded job projected
  for (const jobId of ['stage-abc', 'upload-1', 'stage-import-', 'stage-import-a%2Fb', 'stage-import-a.b', '..', 'stage-import-' + 'x'.repeat(200)]) {
    rig = routeRig({ director: () => assert.fail('Director must not be called') }); out = await rig.job(jobId)
    eq(out.res.status, 404, `job id ${jobId.slice(0, 30)} is not an import job`); eq(rig.calls.fetch.length, 0)
  }
  rig = routeRig({ director: () => ({ status: 200, body: jobReply('02') }) })
  out = await rig.job(JOB_ID)
  const jcall = rig.calls.fetch[0]
  eq(jcall.url, `${DIRECTOR_URL}/api/template-ingest/stage/jobs/${JOB_ID}`); eq(jcall.init.method, 'GET'); eq(jcall.init.cache, 'no-store'); eq(jcall.init.redirect, 'error'); eq(jcall.init.body, undefined)
  deepEq(Object.keys(jcall.init.headers).sort(), ['Authorization', 'X-Composer-User-Id']); eq(jcall.init.headers['X-Composer-User-Id'], USER_ID)
  eq(out.res.headers.get('cache-control'), 'no-store')
  for (const n of ['02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16']) {
    rig = routeRig({ director: () => ({ status: REC[n].status, body: jobReply(n) }) })
    out = await rig.job(JOB_ID)
    const recorded = jobReply(n)
    eq(out.res.status, 200, `recorded ${n}`)
    deepEq(out.json.deck_import, recorded.deck_import, `recorded ${n}: deck_import reaches the browser whole`)
    deepEq(out.json.status, recorded.status); deepEq(out.json.errors, recorded.errors); deepEq(out.json.poll ?? null, recorded.poll ?? null); eq(out.json.job_id, recorded.job_id)
    deepEq(Object.keys(out.json).sort(), ['deck_import', 'errors', 'job_id', 'poll', 'session_id', 'status'].filter(key => key in recorded), `recorded ${n}: only what the dialog reads leaves the server (a failed job has no poll key)`)
    for (const key of ['user_id', 'upload_ref', 'checkpoint', 'template_progress', 'admission_report', 'capabilities', 'per_slide_fidelity', 'viewer_url']) ok(!(key in out.json), `recorded ${n}: ${key} stays on the server`)
  }
  // a job answer that is an error passes through as it is (no projection of a refusal)
  const refusal = { code: 'ENTITLEMENT_REQUIRED', detail: 'x', error: 'x', retryable: false }
  rig = routeRig({ director: () => ({ status: 401, body: refusal }) }); out = await rig.job(JOB_ID)
  eq(out.res.status, 401); deepEq(out.json, refusal)
  rig = routeRig({ director: () => ({ status: 404, body: { detail: 'Not Found' } }) }); out = await rig.job(JOB_ID)
  eq(out.res.status, 404); deepEq(out.json, { detail: 'Not Found' })
  rig = routeRig({ director: () => ({ status: 200, body: [1, 2] }) }); out = await rig.job(JOB_ID)
  eq(out.res.status, 502, 'a 200 that is not a job')
  rig = routeRig({ director: () => ({ status: 200, raw: 'not json' }) }); out = await rig.job(JOB_ID)
  eq(out.res.status, 502)
  rig = routeRig({ director: () => ({ throws: new Error('boom') }) }); out = await rig.job(JOB_ID)
  eq(out.res.status, 502); deepEq(out.json, { error: 'Deck import is temporarily unavailable. Try again.' })
}

// ================================================================ 3b. the REST entitlement header
async function secEntitlement() {
  for (const kind of ['start', 'job']) {
    const method = kind === 'start' ? 'POST' : 'GET'
    const run = rig => kind === 'start' ? rig.start(START_BODY) : rig.job(JOB_ID)
    const answer = () => kind === 'start' ? { status: 202, body: REC['01'].body } : { status: 200, body: jobReply('02') }
    // both flags on and the secret set: the header is on the one Director call, signed for the database id, with the right method and a 120 s life
    let rig = routeRig({ helperFlag: 'true', secret: TEST_SECRET, director: answer })
    let out = await run(rig)
    eq(rig.calls.fetch.length, 1)
    const headers = rig.calls.fetch[0].init.headers
    ok(typeof headers['X-Deckster-Entitlement'] === 'string' && headers['X-Deckster-Entitlement'].split('.').length === 2, `${kind}: the header is on the Director call`)
    const verdict = verifyRestHeader(headers['X-Deckster-Entitlement'], TEST_SECRET, { method, sub: USER_ID, now: FIXED_NOW + 30 })
    ok(verdict.ok, `${kind}: signed for ${method} and the id sent as X-Composer-User-Id (${verdict.why})`)
    eq(verdict.claims.sub, headers['X-Composer-User-Id'], `${kind}: sub is that same id`); ok(verdict.claims.sub !== 'session-token-id' && verdict.claims.sub !== EMAIL)
    eq(verdict.claims.iat, FIXED_NOW); eq(verdict.claims.exp, FIXED_NOW + 120); ok(!('bq' in verdict.claims), 'no quota claim on these routes')
    eq(verifyRestHeader(headers['X-Deckster-Entitlement'], TEST_SECRET, { method: method === 'POST' ? 'GET' : 'POST', now: FIXED_NOW }).ok, false, `${kind}: not valid for the other method`)
    eq(verifyRestHeader(headers['X-Deckster-Entitlement'], TEST_SECRET + 'x', { method, now: FIXED_NOW }).ok, false, `${kind}: not valid under another key`)
    deepEq(Object.keys(headers).sort(), kind === 'start' ? ['Authorization', 'Content-Type', 'X-Composer-User-Id', 'X-Deckster-Entitlement'] : ['Authorization', 'X-Composer-User-Id', 'X-Deckster-Entitlement'], `${kind}: the template upload's headers plus the one`)
    // never to the browser: not in the headers, not in the body
    ok(![...out.res.headers.keys()].some(key => /entitlement/i.test(key)), `${kind}: no entitlement header in the browser's answer`)
    nomatch(JSON.stringify(out.json), new RegExp(`${headers['X-Deckster-Entitlement'].slice(0, 20)}|${TEST_SECRET}|${TEST_TOKEN}`), `${kind}: nothing secret in the browser's body`)
    // minted per request: a second call mints again (never cached)
    const again = routeRig({ helperFlag: 'true', secret: TEST_SECRET, director: answer }); await run(again)
    eq(again.calls.fetch[0].init.headers['X-Deckster-Entitlement'], headers['X-Deckster-Entitlement'], 'same clock, same claims, same bytes (deterministic, not a cached value)')

    // either flag off, or no secret: no header, and the secret is never read
    for (const [label, options] of [
      ['helper flag unset', { helperFlag: undefined, secret: TEST_SECRET }], ['helper flag "false"', { helperFlag: 'false', secret: TEST_SECRET }], ['helper flag "TRUE"', { helperFlag: 'TRUE', secret: TEST_SECRET }],
      ['helper flag "1"', { helperFlag: '1', secret: TEST_SECRET }], ['helper flag "true " with a space', { helperFlag: 'true ', secret: TEST_SECRET }],
    ]) {
      rig = routeRig({ ...options, director: answer }); out = await run(rig)
      ok(!('X-Deckster-Entitlement' in rig.calls.fetch[0].init.headers), `${kind}: ${label}: no header`)
      deepEq(rig.reads.filter(key => key === 'DIRECTOR_WS_AUTH_SECRET'), [], `${kind}: ${label}: the secret is never read`)
    }
    rig = routeRig({ helperFlag: 'true', secret: undefined, director: answer }); out = await run(rig)
    ok(!('X-Deckster-Entitlement' in rig.calls.fetch[0].init.headers), `${kind}: helper flag on, no secret: no header (the import then runs while Director enforces nothing)`)
    eq(out.res.status, kind === 'start' ? 202 : 200)
    rig = routeRig({ helperFlag: 'true', secret: '', director: answer }); await run(rig)
    ok(!('X-Deckster-Entitlement' in rig.calls.fetch[0].init.headers), `${kind}: an empty secret signs nothing`)
    // the deck-import flag off: no header and no read, whatever else is on (the route is a 404 first)
    rig = routeRig({ flag: 'false', helperFlag: 'true', secret: TEST_SECRET, director: answer }); out = await run(rig)
    eq(out.res.status, 404); eq(rig.calls.fetch.length, 0); deepEq(rig.reads, [FLAG], `${kind}: deck-import flag off: only the flag is read`)
    // a refusal from Director passes through unchanged with the header on
    rig = routeRig({ helperFlag: 'true', secret: TEST_SECRET, director: () => ({ status: 401, body: REC['17'].body.entitlement_w_missing_header.body }) }); out = await run(rig)
    eq(out.res.status, 401); deepEq(out.json, REC['17'].body.entitlement_w_missing_header.body)
  }
  // email-keyed accounts: sub is whatever the route sends as X-Composer-User-Id (the database id)
  const rig = routeRig({ helperFlag: 'true', secret: TEST_SECRET, director: () => ({ status: 202, body: REC['01'].body }) })
  await rig.start(START_BODY)
  eq(JSON.parse(Buffer.from(rig.calls.fetch[0].init.headers['X-Deckster-Entitlement'].split('.')[0], 'base64url').toString('utf8')).sub, USER_ID)
}

// ================================================================ 4. the dialog and its hook
function createNet(handler) {
  const log = []
  const fetch = async (url, init = {}) => {
    const entry = { url: String(url), method: init.method ?? 'GET', headers: init.headers ?? {}, body: init.body, cache: init.cache, signal: init.signal }
    log.push(entry)
    if (init.signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' })
    const reply = await handler(entry)
    if (reply.throws) throw reply.throws
    return new Response(reply.raw ?? JSON.stringify(reply.body), { status: reply.status, headers: { 'content-type': 'application/json' } })
  }
  return { fetch, log, jobs: () => log.filter(entry => entry.url.startsWith('/api/studio-deck-import/jobs/')), starts: () => log.filter(entry => entry.url === '/api/studio-deck-import') }
}
/** The browser's fetch, answered by the REAL proxy routes with Director stubbed by the recorded responses (`director(url, init)` -> {status, body}). */
function proxiedNet({ director, rigOptions = {} }) {
  const rig = routeRig({ helperFlag: undefined, ...rigOptions, director })
  const net = createNet(async entry => {
    if (entry.method === 'POST') { const { res, json } = await rig.start(JSON.parse(entry.body)); return { status: res.status, body: json } }
    const { res, json } = await rig.job(decodeURIComponent(entry.url.split('/jobs/')[1])); return { status: res.status, body: json }
  })
  net.rig = rig
  return net
}

const mountedUis = []
function mountDialog({ entry = false, extraAllowed = '', net, userId = USER_ID, uuids = [SESSION, 'fresh-session-2', 'fresh-session-3'], layoutOrigin = 'http://127.0.0.1:8544', researcherUrl = 'http://127.0.0.1:8000', storage = new Map(), createSessionFails = false, uploadFails = null, open = true, search = '', local = new Map(), localBlocked = false, historyFails = false } = {}) {
  const clock = { now: 1_000_000 }
  const delays = []
  const pending = new Set()
  const sessions = [], uploads = [], assigned = [], closed = [], replaced = []
  const localStorage = localBlocked === true ? { getItem() { throw new TypeError('blocked') }, setItem() { throw new TypeError('blocked') } } : { getItem: key => local.get(key) ?? null, setItem: (key, value) => { local.set(key, String(value)) } }
  let runaway = false
  const setTimeoutFake = (fn, ms) => { if (delays.length > 400) { runaway = true; return 0 } /* a loop that never ends stalls here instead of spinning */ delays.push(ms); const id = setImmediate(() => { pending.delete(id); clock.now += ms; fn() }); pending.add(id); return id }
  const clearTimeoutFake = id => { clearImmediate(id); pending.delete(id) }
  const policyModule = createWorld({ real: ['lib/layout-viewer-url-policy.ts'] }).load('lib/layout-viewer-url-policy.ts')
  const props = { open, onOpenChange: value => closed.push(value) }
  let Comp = null
  const rt = createRuntime(() => Comp(props))
  const stubs = {
    react: rt.react,
    '@/hooks/use-auth': { useAuth: () => ({ user: userId ? { id: userId, email: EMAIL } : undefined }) },
    '@/hooks/use-chat-sessions': { useChatSessions: () => ({ createSession: async (id, title) => { sessions.push({ id, title }); return createSessionFails ? null : { id } } }) },
    '@/lib/researcher-upload': { uploadFileToResearcher: async options => {
      uploads.push(options)
      if (uploadFails) throw new Error(uploadFails)
      options.onProgress?.({ percent: 40, stage: 'upload' }); options.onProgress?.({ percent: 100, stage: 'upload' })
      return { researcherSessionId: options.sessionId, storagePath: `${options.sessionId}/1_${options.file.name}`, jobId: null, fileName: options.file.name }
    } },
    '@/lib/layout-viewer-url-policy': policyModule,
    '@/lib/layout-service-client': { LAYOUT_VIEWER_URL_POLICY: policyModule.createLayoutViewerUrlPolicy(layoutOrigin, extraAllowed) },
    '@/components/ui/button': { Button: 'Button' },
    '@/components/ui/dialog': { Dialog: 'Dialog', DialogContent: 'DialogContent', DialogDescription: 'DialogDescription', DialogHeader: 'DialogHeader', DialogTitle: 'DialogTitle' },
    'lucide-react': { FileUp: 'FileUp', Loader2: 'Loader2' },
  }
  const world = createWorld({
    real: [DIALOG, HOOK, ENTRY, LIB, 'lib/studio-template-progress.ts', 'lib/composer-library.ts', 'lib/service-url.ts'], stubs,
    globals: {
      process: { env: { NEXT_PUBLIC_KNOWLEDGE_SERVICE_URL: researcherUrl, NEXT_PUBLIC_LAYOUT_SERVICE_URL: layoutOrigin } },
      fetch: net.fetch, setTimeout: setTimeoutFake, clearTimeout: clearTimeoutFake, Date: { now: () => clock.now },
      sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => { storage.set(key, String(value)) }, removeItem: key => { storage.delete(key) } },
      window: Object.defineProperty({ location: { assign: href => assigned.push(href), search, pathname: '/dashboard', hash: '' }, history: { state: { as: 'next' }, replaceState: (...args) => { if (historyFails) throw new TypeError('no history'); replaced.push(args) } } }, 'localStorage', localBlocked === 'access' ? { get() { throw new TypeError('blocked') } } : { value: localStorage }), crypto: { randomUUID: () => uuids.shift() ?? `extra-session-${uuids.length}` },
    },
  })
  Comp = entry ? () => world.load(ENTRY).StudioDeckImportEntry() : world.load(DIALOG).StudioDeckImportDialog
  const api = {
    rt, net, storage, sessions, uploads, assigned, closed, delays, clock, world, props, local, replaced,
    mount() { rt.render() },
    async idle() { let stable = 0, last = ''; for (let i = 0; i < 600 && stable < 8; i++) { await rt.settle(); const sig = `${net.log.length}:${pending.size}:${rt.renders}`; if (sig === last) stable++; else { stable = 0; last = sig } } assert.ok(!runaway, 'the dialog polls without end') },
    action: name => rt.find(node => node.props?.['data-studio-deck-import-action'] === name)[0] ?? null,
    async click(name) { const node = api.action(name); assert.ok(node, `the ${name} button is shown`); assert.ok(!node.props.disabled, `the ${name} button is enabled`); node.props.onClick(); await api.idle() },
    async choose(file) { const input = rt.one(node => node.type === 'input' && node.props.type === 'file'); input.props.onChange({ target: { files: file ? [file] : [] } }); await api.idle() },
    words: () => nodeText(rt.find(node => node.props?.['data-studio-deck-import-words'] === 'true')[0] ?? null).replace(/\s+/g, ' ').trim(),
    shown: name => nodeText(rt.find(node => node.props?.[`data-studio-deck-import-${name}`] === 'true')[0] ?? null).replace(/\s+/g, ' ').trim(),
    has: name => rt.find(node => node.props?.[`data-studio-deck-import-${name}`] !== undefined).length > 0,
    phase: () => ['choose', 'working', 'ready', 'failed'].find(name => api.has(name)),
    dialog: () => rt.one(node => node.type === 'Dialog'),
  }
  mountedUis.push(api)
  return api
}
const recordedDirector = (sequence, { start = () => ({ status: REC['01'].status, body: REC['01'].body }) } = {}) => {
  const queue = [...sequence]
  return (url, init) => {
    if ((init?.method ?? 'GET') === 'POST') return start()
    const next = queue.length > 1 ? queue.shift() : queue[0]
    return typeof next === 'string' ? { status: REC[next].status, body: jobReply(next) } : { status: next.status ?? 200, body: next.body }
  }
}
const importFlow = async (ui, file = FILE) => { ui.mount(); await ui.choose(file); await ui.click('start') }

async function secUi() {
  // ---- nothing runs until a file is chosen; the picker allows .pptx and .pdf (the PDF only to be told it is coming)
  let ui = mountDialog({ net: createNet(() => assert.fail('no request before a file is chosen')) })
  ui.mount(); await ui.idle()
  eq(ui.phase(), 'choose'); eq(ui.net.log.length, 0); eq(ui.sessions.length, 0)
  const input = ui.rt.one(node => node.type === 'input')
  eq(input.props.accept, '.pptx,.pdf'); eq(input.props.id, 'studio-deck-import-file')
  ok(ui.rt.find(node => node.type === 'label' && node.props.htmlFor === 'studio-deck-import-file').length === 1, 'the picker has its label')
  ok(ui.action('start').props.disabled, 'Import deck waits for a file')
  match(nodeText(ui.rt.tree), /Import a PowerPoint deck/); match(nodeText(ui.rt.tree), /widescreen \(16:9\), up to 100 MB/)
  match(nodeText(ui.rt.tree), /It keeps the design of your file; every word stays editable text/)
  // ---- local refusals: the contract's own sentences, nothing uploaded
  for (const [file, sentence] of [
    [{ name: 'Board.pdf', size: 5000 }, 'Import the PowerPoint this PDF came from. PDF import is coming.'],
    [{ name: 'Board.key', size: 5000 }, 'Only PowerPoint (.pptx) files can be imported. Save the file as .pptx and try again.'],
    [{ name: 'Board.pptx', size: 0 }, 'This file is empty. Choose a PowerPoint (.pptx) file.'],
    [{ name: 'Board.pptx', size: 100 * 1024 * 1024 + 1 }, 'This file is too large to import. Files up to 100 MB can be imported.'],
  ]) {
    ui = mountDialog({ net: createNet(() => assert.fail('a refused file is never uploaded')) })
    ui.mount(); await ui.choose(file)
    eq(ui.shown('error'), sentence, `${file.name} ${file.size}`); ok(ui.action('start').props.disabled, 'and Import deck stays disabled')
    eq(ui.uploads.length + ui.sessions.length + ui.net.log.length, 0)
    ui.action('start').props.onClick(); await ui.idle()
    eq(ui.uploads.length + ui.sessions.length + ui.net.log.length, 0, 'even when clicked')
    await ui.choose({ name: 'Board.pptx', size: 5000 })
    eq(ui.has('error'), false, 'choosing a good file clears the note'); ok(!ui.action('start').props.disabled)
    await ui.choose(null)
    ok(ui.action('start').props.disabled, 'clearing the choice disables Import deck again')
  }
  // ---- the happy path, step by step, through the REAL proxy routes with the recorded Director answers
  const director = recordedDirector(['02', '03', '04', '05'])
  ui = mountDialog({ net: proxiedNet({ director }) })
  await importFlow(ui)
  eq(ui.phase(), 'ready'); eq(ui.net.jobs().length, 4, 'start once, then four reads: waiting, placing, opening, ready')
  deepEq(ui.sessions, [{ id: SESSION, title: 'Q3 Board Review' }], 'one fresh session, titled with the file name without .pptx')
  eq(ui.uploads.length, 1); const upload = ui.uploads[0]
  eq(upload.sessionId, SESSION); eq(upload.userId, USER_ID); eq(upload.storageOnly, true, 'storage only, as the template upload'); eq(upload.intent, 'composer_template'); eq(upload.file, FILE)
  eq(ui.net.starts().length, 1); const started = ui.net.starts()[0]
  eq(started.method, 'POST'); deepEq(JSON.parse(started.body), { session_id: SESSION, researcher_session_id: SESSION, storage_path: `${SESSION}/1_${FILE.name}`, file_name: FILE.name, kind: 'pptx' }, 'one id is the Researcher session and the Director session')
  deepEq(started.headers, { 'Content-Type': 'application/json' }, 'the browser sends no credential of any kind'); eq(started.cache, 'no-store'); ok(started.signal instanceof AbortSignal)
  for (const entry of ui.net.jobs()) { eq(entry.method, 'GET'); eq(entry.url, `/api/studio-deck-import/jobs/${JOB_ID}`); deepEq(entry.headers, {}); eq(entry.cache, 'no-store') }
  deepEq(ui.delays.filter(ms => ms !== 0), [3000, 3000, 3000], 'Director\'s poll.next_interval_ms (3000) between the reads')
  // staged like "Use original"; the pending record is gone; the Builder is not opened until the person has read what changed
  deepEq([...ui.storage.keys()], [`deckster_composer_ready_${SESSION}`], 'only the staged result remains')
  const composer = ui.world.load('lib/composer-library.ts')
  deepEq(JSON.parse(ui.storage.get(`deckster_composer_ready_${SESSION}`)), { user_id: USER_ID, result: (ready => ({ ...ready, composer_adoption: { ...ready.composer_adoption, source: 'deck_import' } }))(composer.composerReadyResult({ status: 'complete', ...REC['05'].body.deck_import.result }, SESSION)) }, 'the staged record is the Use-original shape, marked as an import')
  eq(ui.assigned.length, 0, 'banner to read first: the Builder is not opened on its own')
  eq(ui.words(), 'Your deck is ready.'); match(ui.shown('count'), /Q3 Board Review · 3 slides/); eq(ui.shown('banner'), '2 items changed. See What changed')
  deepEq(ui.rt.find(node => node.type === 'li').map(node => nodeText(node)), ['On slide 1, letter spacing is set to normal in 1 text box.', 'On slide 4, a dashed outline is drawn solid.'])
  ui.action('open').props.onClick()
  deepEq(ui.assigned, [`/builder?session_id=${SESSION}`], 'Open deck opens the Builder on the session')
  deepEq([...ui.local.keys()], [`deckster_deck_import_done_${USER_ID}`], 'this browser remembers the import (for the Builder\'s note), and writes nothing else to local storage')
  deepEq(JSON.parse(ui.local.get(`deckster_deck_import_done_${USER_ID}`)), [SESSION], 'by session id')
  ok(ui.net.log.every(entry => !JSON.stringify(entry.headers).match(/entitlement|authorization|bearer/i)), 'no secret or entitlement header ever leaves the browser')
  // ---- the words shown at each step (held reads)
  {
    const held = []
    const net = createNet(async entry => {
      if (entry.method === 'POST') return { status: 202, body: REC['01'].body }
      return new Promise(resolve => held.push(resolve))
    })
    ui = mountDialog({ net })
    ui.mount(); await ui.choose(FILE); ui.action('start').props.onClick(); await ui.idle()
    eq(held.length, 1, 'the first read is waiting')
    eq(ui.phase(), 'working'); eq(ui.words(), 'Starting the import…', 'the start went through; the first read is awaited'); ok(!ui.has('choose') && !ui.has('failed'))
    ok(ui.rt.find(node => node.type === 'Loader2').length >= 1, 'a spinner')
    const answerWith = async n => { const resolve = held.shift(); const body = (({ job_id, status, session_id, errors, poll, deck_import }) => ({ job_id, status, session_id, errors, poll, deck_import }))(jobReply(n)); resolve({ status: 200, body }); await ui.idle() }
    await answerWith('02')
    eq(ui.words(), 'Waiting for a free slot…'); eq(ui.shown('detail'), 'Another file is being read first. Trying again in about 30 seconds.', 'a busy slot is a note, not an error'); ok(!ui.has('error')); eq(ui.has('meter'), false)
    await answerWith('03')
    eq(ui.words(), 'Placing your slides…'); eq(ui.has('detail'), false); eq(ui.shown('count'), '0 of 1 slide · about 2 minutes left')
    const meter = ui.rt.one(node => node.props?.role === 'progressbar'); eq(meter.props['aria-valuenow'], 0); eq(meter.props['aria-valuemax'], 1)
    ok(ui.rt.one(node => node.props?.['data-studio-deck-import-working'] === 'true').props.role === 'status', 'announced politely')
    await answerWith('04')
    eq(ui.words(), 'Opening your deck…'); eq(ui.has('meter'), false); eq(ui.has('count'), false)
    eq(ui.action('start'), null, 'no second start while it works')
    ui.dialog().props.onOpenChange(false); await ui.idle()
    deepEq(ui.closed, [], 'the dialog cannot be closed while it works')
    // a 4-of-12 read shows the bar
    held.length = 0
  }
  // ---- nothing to report: the Builder opens on its own (derived from recorded 05: no changes, no notes)
  {
    const clean = jobReply('05'), derived = { ...clean, deck_import: { ...clean.deck_import, what_changed: { headline: null, items: [] }, notes: { state: 'none', copied: 0, message: null, reason: null, slides_not_kept: [] } } }
    ui = mountDialog({ net: proxiedNet({ director: recordedDirector([{ body: derived }]) }) })
    await importFlow(ui)
    deepEq(ui.assigned, [`/builder?session_id=${SESSION}`], 'with nothing changed, straight into the Builder'); eq(ui.words(), 'Opening your deck…'); eq(ui.action('open'), null)
    ok(ui.storage.has(`deckster_composer_ready_${SESSION}`), 'staged before it opens')
    deepEq(JSON.parse(ui.local.get(`deckster_deck_import_done_${USER_ID}`)), [SESSION], 'remembered before it opens too')
    // storage that refuses to be read or written must not stop the deck from opening
    ui = mountDialog({ net: proxiedNet({ director: recordedDirector([{ body: derived }]) }), localBlocked: true })
    await importFlow(ui)
    deepEq(ui.assigned, [`/builder?session_id=${SESSION}`], 'blocked local storage: the Builder still opens'); eq(ui.local.size, 0)
    ui = mountDialog({ net: proxiedNet({ director: recordedDirector([{ body: derived }]) }), localBlocked: 'access' })
    await importFlow(ui)
    deepEq(ui.assigned, [`/builder?session_id=${SESSION}`], 'a browser that throws on reading localStorage at all: the Builder still opens'); eq(ui.local.size, 0)
  }
  // ---- recorded 06: the notes were not kept (said once, as a change)
  ui = mountDialog({ net: proxiedNet({ director: recordedDirector(['06']) }) })
  await importFlow(ui)
  eq(ui.phase(), 'ready'); eq(ui.shown('banner'), '1 item changed. See What changed'); deepEq(ui.rt.find(node => node.type === 'li').map(node => nodeText(node)), ['Speaker notes were not kept.'])
  eq(ui.assigned.length, 0); ok(ui.action('open'), 'Open deck is offered')
  // ---- partial notes: Director's notes sentence is shown even when no list line carries it
  {
    const derived = { ...jobReply('05'), deck_import: { ...jobReply('05').deck_import, what_changed: { headline: null, items: [] }, notes: { state: 'partial', copied: 1, message: 'Speaker notes were not kept on slides 2, 3.', reason: 'too_long', slides_not_kept: [2, 3] } } }
    ui = mountDialog({ net: proxiedNet({ director: recordedDirector([{ body: derived }]) }) })
    await importFlow(ui)
    deepEq(ui.rt.find(node => node.type === 'li').map(node => nodeText(node)), ['Speaker notes were not kept on slides 2, 3.']); eq(ui.has('banner'), false, 'no "N items changed" banner for a notes line alone'); ok(ui.action('open'))
  }
  // ---- every failure (07-16): Director's words as they are; "Try again" only when retryable
  const retryable = { '11': true, '12': true, '15': true }
  for (const n of ['07', '08', '09', '10', '11', '12', '13', '14', '15', '16']) {
    ui = mountDialog({ net: proxiedNet({ director: recordedDirector(['03', n]) }) })
    await importFlow(ui)
    const message = REC[n].body.deck_import.error.message
    eq(ui.phase(), 'failed', `recorded ${n}`); eq(ui.shown('error'), message, `recorded ${n}: the words as they are`)
    eq(!!ui.action('retry'), !!retryable[n], `recorded ${n}: Try again only when retryable`)
    ok(ui.action('another'), `recorded ${n}: Choose another file`)
    eq(ui.assigned.length, 0, 'nothing opens'); eq(ui.storage.size, 0, 'nothing staged, nothing kept to resume'); eq(ui.local.size, 0, 'a failed import is not remembered as an imported deck')
    eq(ui.net.jobs().length, 2, 'polling ends at the failure')
    ok(ui.rt.find(node => node.props?.role === 'alert').length >= 1, 'announced as an alert')
    ui.dialog().props.onOpenChange(false); await ui.idle(); deepEq(ui.closed, [false], 'a failure can be closed'); eq(ui.phase(), 'choose', 'and closing starts the next visit from the picker')
  }
  // ---- Try again is a NEW import: a new session id, a new upload, a new job
  {
    ui = mountDialog({ net: proxiedNet({ director: recordedDirector(['11']) }) })
    await importFlow(ui)
    eq(ui.phase(), 'failed'); eq(ui.shown('error'), 'Import stopped. Try again.')
    await ui.click('retry')
    eq(ui.sessions.length, 2, 'a second session'); deepEq(ui.sessions.map(s => s.id), [SESSION, 'fresh-session-2'])
    eq(ui.uploads.length, 2, 'a second upload'); eq(ui.uploads[1].sessionId, 'fresh-session-2'); eq(ui.uploads[1].file, FILE, 'of the same file')
    eq(ui.net.starts().length, 2); eq(JSON.parse(ui.net.starts()[1].body).session_id, 'fresh-session-2'); eq(JSON.parse(ui.net.starts()[1].body).researcher_session_id, 'fresh-session-2')
    eq(ui.phase(), 'failed', 'and the recorded loss answers again'); ui.action('another').props.onClick(); await ui.idle()
    eq(ui.phase(), 'choose'); ok(ui.action('start').props.disabled, 'Choose another file starts over with no file'); eq(ui.has('error'), false)
  }
  // ---- a retried import that succeeds opens ITS session, not the first one
  {
    const second = { ...jobReply('05'), session_id: 'fresh-session-2', deck_import: { ...jobReply('05').deck_import, what_changed: { headline: null, items: [] }, result: { ...jobReply('05').deck_import.result, session_id: 'fresh-session-2' } } }
    let reads = 0
    ui = mountDialog({ net: proxiedNet({ director: (url, init) => (init?.method === 'POST' ? { status: 202, body: REC['01'].body } : ++reads === 1 ? { status: 200, body: jobReply('11') } : { status: 200, body: second }) }) })
    await importFlow(ui); await ui.click('retry')
    deepEq(ui.assigned, ['/builder?session_id=fresh-session-2']); ok(ui.storage.has('deckster_composer_ready_fresh-session-2'))
  }
  // ---- every refusal at the start (17): the contract's words, no polling, nothing kept
  const startWords = {
    pdf: 'Import the PowerPoint this PDF came from. PDF import is coming.', keynote: 'Only PowerPoint (.pptx) files can be imported. Save the file as .pptx and try again.', incomplete: 'The import request is incomplete. Upload the file again.',
    session_mismatch: 'Upload must use the authenticated Builder session', storage_path: 'Invalid upload storage reference', session_not_fresh: 'A fresh Director session is required',
    composer_async_off: 'Deck import is not available right now.', flag_off: 'Deck import is not available right now.', entitlement_w_missing_header: 'We could not confirm your sign-in for this request. Please reload the page and try again.',
  }
  for (const [name, answer] of nine) {
    ui = mountDialog({ net: proxiedNet({ director: () => ({ status: answer.status, body: answer.body }) }) })
    await importFlow(ui)
    eq(ui.phase(), 'failed', `refusal ${name}`); eq(ui.shown('error'), startWords[name], `refusal ${name}: the words`)
    eq(ui.net.jobs().length, 0, `refusal ${name}: no polling`); eq(ui.storage.size, 0); eq(ui.action('retry'), null, `refusal ${name}: a refusal that cannot succeed offers no Try again`); ok(ui.action('another'))
  }
  // ---- transport trouble: the proxy answering 502 while polling is retried three times in a row, then it ends
  {
    const bad = { status: 502, body: { error: 'Deck import is temporarily unavailable. Try again.' } }
    ui = mountDialog({ net: createNet(entry => entry.method === 'POST' ? { status: 202, body: REC['01'].body } : [bad, bad, bad, { status: 200, body: jobReply('04') }, { status: 200, body: jobReply('05') }][ui.net.jobs().length - 1]) })
    await importFlow(ui)
    eq(ui.net.jobs().length, 5, 'three 502s are tolerated on the same job'); eq(ui.phase(), 'ready'); eq(ui.net.starts().length, 1, 'and the job is never started twice')
    ui = mountDialog({ net: createNet(entry => entry.method === 'POST' ? { status: 202, body: REC['01'].body } : bad) })
    await importFlow(ui)
    eq(ui.net.jobs().length, 4, 'the fourth 502 in a row ends it'); eq(ui.phase(), 'failed'); eq(ui.shown('error'), 'Deck import is temporarily unavailable. Try again.'); ok(ui.action('retry'), 'a transport failure can be tried again'); eq(ui.storage.size, 0)
    ui = mountDialog({ net: createNet(entry => entry.method === 'POST' ? { status: 202, body: REC['01'].body } : { throws: new TypeError('network down') }) })
    await importFlow(ui)
    eq(ui.net.jobs().length, 4, 'a dropped connection is tolerated three times too'); eq(ui.shown('error'), 'We lost touch with the import. Try again.'); ok(ui.action('retry'))
    ui = mountDialog({ net: createNet(entry => entry.method === 'POST' ? { status: 202, body: REC['01'].body } : { status: 404, body: { detail: 'Not Found' } }) })
    await importFlow(ui)
    eq(ui.net.jobs().length, 1, 'a 404 ends it at once'); eq(ui.shown('error'), 'Deck import is not available right now.'); eq(ui.action('retry'), null)
    ui = mountDialog({ net: createNet(entry => entry.method === 'POST' ? { status: 202, body: REC['01'].body } : { status: 200, body: { job_id: JOB_ID, status: 'cracking' } }) })
    await importFlow(ui)
    eq(ui.shown('error'), 'Deck import is not available right now.', 'a job without deck_import (Director\'s flag went off)'); eq(ui.action('retry'), null)
    ui = mountDialog({ net: createNet(entry => entry.method === 'POST' ? { status: 200, body: { nope: 1 } } : assert.fail('no job, no read')) })
    await importFlow(ui)
    eq(ui.shown('error'), 'The import could not be started. Try again.', 'a start with no job id'); ok(ui.action('retry'))
    ui = mountDialog({ net: createNet(entry => entry.method === 'POST' ? { status: 202, body: { job_id: 'upload-0123456789abcdef' } } : assert.fail('not an import job, no read')) })
    await importFlow(ui)
    eq(ui.shown('error'), 'The import could not be started. Try again.', 'a start that names some other kind of job'); eq(ui.storage.size, 0)
    ui = mountDialog({ net: createNet(entry => entry.method === 'POST' ? { throws: new TypeError('network down') } : assert.fail('no job, no read')) })
    await importFlow(ui)
    eq(ui.shown('error'), 'The import could not be started. Try again.', 'a start that cannot connect'); ok(ui.action('retry'))
  }
  // ---- steps before the start
  ui = mountDialog({ net: createNet(() => assert.fail('no request')), createSessionFails: true }); await importFlow(ui)
  eq(ui.shown('error'), 'The import could not be started. Try again.'); eq(ui.uploads.length, 0, 'no session, no upload'); ok(ui.action('retry'))
  ui = mountDialog({ net: createNet(() => assert.fail('no request')), uploadFails: 'Storage upload failed (403)' }); await importFlow(ui)
  eq(ui.shown('error'), 'Storage upload failed (403)'); ok(ui.action('retry')); eq(ui.net.log.length, 0, 'no start after a failed upload')
  ui = mountDialog({ net: createNet(() => assert.fail('no request')), researcherUrl: 'https://researcher-v1.up.railway.app' }); await importFlow(ui)
  eq(ui.shown('error'), 'Deck import is not available right now.', 'the Researcher must be the UAT one or a local one, as for the template upload'); eq(ui.sessions.length, 0); eq(ui.action('retry'), null)
  ui = mountDialog({ net: createNet(() => assert.fail('no request')), userId: null }); ui.mount(); await ui.choose(FILE)
  ok(ui.action('start').props.disabled, 'no account, no import')
  ui.action('start').props.onClick(); await ui.idle()
  eq(ui.sessions.length + ui.uploads.length + ui.net.log.length, 0, 'and a forced click starts nothing')
  // ---- the deck is not opened when the result is not the approved one
  for (const [label, patch] of [['an origin Layout does not serve', { viewer_url: 'https://evil.example/p/x' }], ['another session', { session_id: 'not-mine' }], ['no viewer address', { viewer_url: '' }]]) {
    const derived = { ...jobReply('05'), deck_import: { ...jobReply('05').deck_import, result: { ...jobReply('05').deck_import.result, ...patch } } }
    ui = mountDialog({ net: proxiedNet({ director: recordedDirector([{ body: derived }]) }) })
    await importFlow(ui)
    eq(ui.shown('error'), 'Your file was read, but the deck could not be opened. Try again.', label); ok(ui.action('retry')); eq(ui.assigned.length, 0); eq(ui.storage.size, 0, 'nothing staged')
  }
  {
    const elsewhere = { ...jobReply('05'), deck_import: { ...jobReply('05').deck_import, what_changed: { headline: null, items: [] }, result: { ...jobReply('05').deck_import.result, viewer_url: 'https://prod-layout.example/p/x' } } }
    ui = mountDialog({ net: proxiedNet({ director: recordedDirector([{ body: elsewhere }]) }), extraAllowed: 'https://prod-layout.example' }); await importFlow(ui)
    eq(ui.shown('error'), 'Your file was read, but the deck could not be opened. Try again.', 'a viewer on an origin the policy lists but UAT and local do not'); eq(ui.assigned.length, 0); eq(ui.storage.size, 0)
  }
  ui = mountDialog({ net: proxiedNet({ director: recordedDirector(['05']) }), layoutOrigin: 'http://127.0.0.1:9999' }); await importFlow(ui)
  eq(ui.shown('error'), 'Your file was read, but the deck could not be opened. Try again.', 'a viewer on another origin than Layout\'s'); eq(ui.assigned.length, 0)
  // ---- reopening picks a stored import up again, without a new upload
  {
    const storage = new Map([[`deckster_deck_import_job_${USER_ID}`, JSON.stringify({ job_id: JOB_ID, session_id: SESSION, file_name: FILE.name })]])
    ui = mountDialog({ net: proxiedNet({ director: recordedDirector(['03', '05']) }), storage })
    ui.mount(); await ui.idle()
    eq(ui.sessions.length + ui.uploads.length + ui.net.starts().length, 0, 'no new session, upload or start'); eq(ui.net.jobs().length, 2); eq(ui.phase(), 'ready')
    ok(!storage.has(`deckster_deck_import_job_${USER_ID}`) && storage.has(`deckster_composer_ready_${SESSION}`), 'the record is exchanged for the staged result')
    storage.set(`deckster_deck_import_job_${USER_ID}`, 'not json')
    ui = mountDialog({ net: createNet(() => assert.fail('a broken record starts nothing')), storage }); ui.mount(); await ui.idle(); eq(ui.phase(), 'choose')
    storage.set(`deckster_deck_import_job_${USER_ID}`, JSON.stringify({ job_id: 'upload-1', session_id: SESSION, file_name: 'x' }))
    ui = mountDialog({ net: createNet(() => assert.fail('a record for another kind of job starts nothing')), storage }); ui.mount(); await ui.idle(); eq(ui.phase(), 'choose')
    ui = mountDialog({ net: createNet(() => assert.fail('a closed dialog polls nothing')), storage: new Map([[`deckster_deck_import_job_${USER_ID}`, JSON.stringify({ job_id: JOB_ID, session_id: SESSION, file_name: 'x' })]]), open: false }); ui.mount(); await ui.idle()
    eq(ui.net.log.length, 0)
  }
  // ---- the stored record exists while the import runs
  {
    const held = []
    const storage = new Map()
    ui = mountDialog({ net: createNet(entry => entry.method === 'POST' ? { status: 202, body: REC['01'].body } : new Promise(resolve => held.push(resolve))), storage })
    ui.mount(); await ui.choose(FILE); ui.action('start').props.onClick(); await ui.idle()
    ok(storage.has(`deckster_deck_import_job_${USER_ID}`), 'the job is kept')
    deepEq(JSON.parse(storage.get(`deckster_deck_import_job_${USER_ID}`)), { job_id: JOB_ID, session_id: SESSION, file_name: FILE.name }, 'the job is kept so a reload can pick it up')
    // unmounting stops the polling: nothing is asked afterwards, and the record stays for the next time
    ui.rt.unmount(); const before = ui.net.log.length; held.shift()({ status: 200, body: jobReply('02') }); await ui.idle()
    eq(ui.net.log.length, before, 'no read after the dialog is gone'); ok(storage.has(`deckster_deck_import_job_${USER_ID}`))
  }
  // ---- a job that never finishes ends at the watch limit
  {
    ui = mountDialog({ net: createNet(entry => entry.method === 'POST' ? { status: 202, body: REC['01'].body } : { status: 200, body: { ...jobReply('03'), poll: { next_interval_ms: 60000 } } }) })
    await importFlow(ui)
    eq(ui.phase(), 'failed'); eq(ui.shown('error'), 'This is taking too long. Try again.'); ok(ui.action('retry'))
    ok(ui.clock.now - 1_000_000 > 90 * 60 * 1000, 'after more than 90 minutes'); eq(ui.net.jobs().length, 92, 'one read a minute until then')
  }
  // ---- the entry: a button, the dialog only while open
  {
    const entryUi = mountDialog({ entry: true, net: createNet(() => assert.fail('no request')) })
    const rt = entryUi.rt
    let tree = rt.render()
    const button = rt.one(node => node.props?.['data-studio-deck-import-open'] === 'true')
    eq(nodeText(button).trim(), 'Import a PowerPoint'); eq(button.props.variant, 'outline'); eq(rt.find(node => typeof node.type === 'function').length, 0, 'closed: no dialog is mounted')
    eq(tree.props['data-studio-deck-import-bar'], 'true')
    button.props.onClick(); tree = rt.render()
    ok(rt.find(node => typeof node.type === 'function').length === 1, 'open: the dialog is mounted')
    eq(entryUi.replaced.length, 0, 'arriving without the query leaves the address alone')
  }
  // ---- the Builder's welcome links to /dashboard?import=pptx: the Decks page opens the dialog once, and takes the query out of the address
  for (const [search, opens] of [['?import=pptx', true], ['?a=1&import=pptx', true], ['?import=pdf', false], ['?import=', false], ['?imports=pptx', false], ['', false]]) {
    const entryUi = mountDialog({ entry: true, search, net: createNet(() => assert.fail('opening the dialog asks for nothing')) })
    entryUi.rt.render(); await entryUi.idle()
    eq(entryUi.rt.find(node => typeof node.type === 'function').length, opens ? 1 : 0, `${JSON.stringify(search)}: the dialog is ${opens ? 'open' : 'closed'}`)
    eq(entryUi.replaced.length, opens ? 1 : 0, `${JSON.stringify(search)}: the address is cleaned ${opens ? 'once' : 'never'}`)
    if (opens) {
      const [state, title, url] = entryUi.replaced[0]
      deepEq(plain(state), { as: 'next' }, 'the router\'s own history state is kept'); eq(title, ''); eq(url, search === '?import=pptx' ? '/dashboard' : '/dashboard?a=1', 'same path, same other query, no import')
      eq(entryUi.net.log.length + entryUi.sessions.length + entryUi.uploads.length, 0, 'opening is not starting')
    }
  }
  {
    const entryUi = mountDialog({ entry: true, search: '?import=pptx', historyFails: true, net: createNet(() => assert.fail('no request')) })
    entryUi.rt.render(); await entryUi.idle()
    eq(entryUi.rt.find(node => typeof node.type === 'function').length, 1, 'a history that refuses still leaves the dialog open')
  }
}


// ================================================================ 4b. the note in the Builder's chat column for an imported deck (contract section 3)
const NOTE_WORDS = { title: 'Imported from PowerPoint', body: 'This deck keeps the design of your PowerPoint file. Changing the theme and Add Element are not available for imported decks yet.', dismiss: 'Got it' }
function mountNote({ userId = USER_ID, sessionId = SESSION, adopted = false, local = new Map(), blocked = false, className = 'mx-3 mt-2', user = userId ? { id: userId, email: EMAIL } : undefined } = {}) {
  const store = blocked === true ? { getItem() { throw new TypeError('blocked') }, setItem() { throw new TypeError('blocked') } } : { getItem: key => local.get(key) ?? null, setItem: (key, value) => { local.set(key, String(value)) } }
  const props = { sessionId, adopted, className }
  let Comp = null
  const rt = createRuntime(() => Comp(props))
  const world = createWorld({
    real: [NOTE, LIB, 'lib/studio-template-progress.ts'],
    stubs: { react: rt.react, '@/hooks/use-auth': { useAuth: () => ({ user }) }, 'lucide-react': { Info: 'Info' } },
    globals: { window: Object.defineProperty({}, 'localStorage', blocked === 'access' ? { get() { throw new TypeError('blocked') } } : { value: store }), fetch: () => assert.fail('the note asks for nothing'), sessionStorage: { getItem: () => assert.fail('the note reads no session storage'), setItem: () => assert.fail('no session storage') } },
  })
  Comp = world.load(NOTE).StudioDeckImportNote
  const api = {
    rt, local, props,
    async show() { rt.render(); await rt.settle(); return api },
    note: () => rt.find(node => node.props?.['data-studio-deck-import-note'] === 'true')[0] ?? null,
    dismiss: () => rt.one(node => node.props?.['data-studio-deck-import-note-dismiss'] === 'true'),
  }
  mountedUis.push(api)
  return api
}
async function secNote() {
  const done = (...ids) => new Map([[`deckster_deck_import_done_${USER_ID}`, JSON.stringify(ids)]])
  const dismissed = (...ids) => [`deckster_deck_import_note_dismissed_${USER_ID}`, JSON.stringify(ids)]
  // an imported deck shows the note, in Studio's plain words: by Director's marker (any device, nothing remembered here) ...
  let n = await mountNote({ adopted: true }).show()
  ok(n.note(), 'Director marks the deck as an import: the note, with nothing remembered in this browser'); eq(n.note().type, 'aside'); eq(n.note().props.role, 'note'); eq(n.note().props['aria-label'], NOTE_WORDS.title); eq(n.note().props.className, 'mx-3 mt-2', 'the page gives it its margins')
  const words = nodeText(n.note()).replace(/\s+/g, ' ').trim()
  eq(words, `${NOTE_WORDS.title}${NOTE_WORDS.body}${NOTE_WORDS.dismiss}`, 'the title, the sentence, the button')
  match(words, /Changing the theme and Add Element are not available for imported decks yet\./); nomatch(words, /Deck theme not ready|stored source theme|AI /, 'its own words, not the Builder\'s refusal')
  eq(n.dismiss().type, 'button'); eq(n.dismiss().props.type, 'button')
  // ... or, as the fallback, by this browser's own record of its imports (Director's flag off, or an older Director)
  n = await mountNote({ local: done(SESSION) }).show(); ok(n.note(), 'imported here, no marker from Director: the note')
  // not an import: nothing (a template deck, another person, no session, no account, a broken or blocked store)
  for (const [label, options] of [
    ['a deck Director does not mark and this browser did not import', { local: done('some-other-session') }],
    ['no record at all and no marker', { local: new Map() }],
    ['another person on this browser, no marker', { local: new Map([['deckster_deck_import_done_someone-else', JSON.stringify([SESSION])]]) }],
    ['no session', { local: done(SESSION), sessionId: null }],
    ['a session id that is not a plain id', { local: done(SESSION), sessionId: 'a b', adopted: true }],
    ['no account (even with the marker)', { local: done(SESSION), userId: null, adopted: true }],
    ['a broken record, no marker', { local: new Map([[`deckster_deck_import_done_${USER_ID}`, 'not json']]) }],
    ['marker not exactly true', { local: new Map(), adopted: 'yes' }],
    ['dismissed already (marker)', { local: new Map([dismissed(SESSION)]), adopted: true }],
    ['dismissed already (record)', { local: new Map([[`deckster_deck_import_done_${USER_ID}`, JSON.stringify([SESSION])], dismissed(SESSION)]) }],
  ]) {
    n = await mountNote(options).show()
    eq(n.note(), null, `${label}: no note`)
  }
  n = await mountNote({ adopted: true, local: new Map([dismissed('another')]) }).show(); ok(n.note(), 'dismissed for another deck: this one still shows')
  // blocked storage: the marker still shows it (nothing to read, nothing to write); the record alone cannot
  n = await mountNote({ adopted: true, blocked: true }).show(); ok(n.note(), 'blocked storage + Director\'s marker: the note')
  n = await mountNote({ adopted: true, blocked: 'access' }).show(); ok(n.note(), 'a browser that throws on reading localStorage at all + the marker: the note')
  n = await mountNote({ local: done(SESSION), blocked: true }).show(); eq(n.note(), null, 'blocked storage and no marker: no note')
  n = await mountNote({ local: done(SESSION), blocked: 'access' }).show(); eq(n.note(), null, 'unreadable localStorage and no marker: no note')
  // "Got it" hides it, remembers it for this deck only, and writes nothing else
  n = await mountNote({ adopted: true, local: done(SESSION, 'second') }).show()
  n.dismiss().props.onClick(); await n.rt.settle()
  eq(n.note(), null, 'gone at once'); ok(n.local.has(`deckster_deck_import_note_dismissed_${USER_ID}`), 'the dismissal is written'); deepEq(JSON.parse(n.local.get(`deckster_deck_import_note_dismissed_${USER_ID}`)), [SESSION], 'remembered for that deck')
  deepEq([...n.local.keys()].sort(), [`deckster_deck_import_done_${USER_ID}`, `deckster_deck_import_note_dismissed_${USER_ID}`].sort(), 'nothing else is written')
  deepEq(JSON.parse(n.local.get(`deckster_deck_import_done_${USER_ID}`)), [SESSION, 'second'], 'the import record is not touched')
  n = await mountNote({ adopted: true, local: n.local }).show(); eq(n.note(), null, 'and stays gone on the next visit')
  n = await mountNote({ adopted: true, local: n.local, sessionId: 'second' }).show(); ok(n.note(), 'another imported deck still has its note')
  // the Builder can switch session without a reload: the note follows the page's props
  n = await mountNote({ adopted: true }).show()
  ok(n.note()); n.props.adopted = false; n.props.sessionId = 'a-deck-built-here'; n.rt.render(); await n.rt.settle(); eq(n.note(), null, 'a deck built here has none')
  n.props.adopted = true; n.props.sessionId = SESSION; n.rt.render(); await n.rt.settle(); ok(n.note(), 'and the imported one has it again')
  // Director's marker arrives after the page drew (the sync_response comes after the first render): the note appears then
  n = await mountNote({}).show(); eq(n.note(), null, 'before the marker: none'); n.props.adopted = true; n.rt.render(); await n.rt.settle(); ok(n.note(), 'the marker arrives: the note')
  // the component asks for nothing and stores nothing but the person's "Got it"
  const note = src(NOTE)
  nomatch(note.replace(/\/\*[\s\S]*?\*\//g, ''), /\bfetch\b|WebSocket|XMLHttpRequest|sessionStorage|sendBeacon|navigator\.|document\.|useSearchParams/, 'no request, socket, session storage, DOM reach-in or address read')
  match(note, /'use client'|"use client"/)
}

// ================================================================ 4b2. Director's marker, composer_adoption.source (Director !521): replayed from the recorded examples 18-20, and the Builder page's reading of it
async function secAdoption() {
  const L = loadLib()
  const policy = createWorld({ real: [POLICY] }).load(POLICY)
  const frame19 = REC['19'].frame.payload, frame20 = REC['20'].frame.payload
  // 19: the sync_response of an imported deck, on any device: the adoption block carries source "deck_import" and the Builder's own reader keeps it
  const imported = policy.readComposerAdoption(frame19.composer_adoption, frame19.presentation_id)
  deepEq(plain(imported), { schema_version: 'composer-adoption-v1', template_id: frame19.composer_adoption.template_id, presentation_id: frame19.presentation_id, frozen_theme: true, source: 'deck_import' }, 'recorded 19: the reader keeps source')
  deepEq(plain(policy.composerThemeFromSync(frame19.composer_adoption, frame19.presentation_id, false)), { composerAdoption: plain(imported), composerThemeResolved: true }, 'and the theme policy resolves the same')
  // 20: a "Use original" deck has no source, and the reader's answer is the old one, key for key
  const original = policy.readComposerAdoption(frame20.composer_adoption, frame20.presentation_id)
  deepEq(plain(original), { schema_version: 'composer-adoption-v1', template_id: 'tpl-1', presentation_id: frame20.presentation_id, frozen_theme: true }, 'recorded 20: no source key')
  ok(!('source' in original), 'not even an undefined one')
  // only the exact marker is kept; the block is still refused when it is not this deck's or not the schema
  for (const source of ['other', 'DECK_IMPORT', '', null, true, 1, { x: 1 }, ['deck_import']]) ok(!('source' in policy.readComposerAdoption({ ...frame19.composer_adoption, source }, frame19.presentation_id)), `source ${JSON.stringify(source)} is not kept`)
  eq(policy.readComposerAdoption(frame19.composer_adoption, 'another-deck'), null, 'another deck\'s block is refused, marker or not')
  eq(policy.readComposerAdoption({ ...frame19.composer_adoption, schema_version: 'composer-adoption-v2' }, frame19.presentation_id), null)
  eq(policy.readComposerAdoption({ ...frame19.composer_adoption, frozen_theme: false }, frame19.presentation_id), null)
  eq(policy.readComposerAdoption(undefined, frame19.presentation_id), null)
  // 18: the job read of the same import: the finished deck is staged with the marker (this flow knows it is an import), and the reader keeps it
  const job18 = jobReply('18')
  eq(job18.deck_import.result.composer_adoption.source, 'deck_import', 'recorded 18: Director marks the job result too')
  const staged = L.deckImportReadyResult(job18.deck_import.result, job18.deck_import.result.session_id)
  eq(staged.composer_adoption.source, 'deck_import'); deepEq(plain(policy.readComposerAdoption(staged.composer_adoption, staged.presentation_id)), plain(staged.composer_adoption), 'the staged block survives the Builder\'s own reader')
  const staged05 = L.deckImportReadyResult(jobReply('05').deck_import.result, SESSION)
  eq(staged05.composer_adoption.source, 'deck_import', 'recorded 05 (Director\'s flag off, no marker): the staged block still says import')
  // the page's reading, evaluated from its own text: adopted = source is "deck_import" for THIS deck
  const page = src(PAGE)
  const adoptedExpr = (page.match(/<StudioDeckImportNote [^>]*?adopted=\{([^}]*)\}/) ?? [])[1]
  ok(adoptedExpr, 'the page passes `adopted`')
  const adoptedFor = (composerAdoption, effectivePresentationId) => vm.runInNewContext(`(${adoptedExpr})`, { composerAdoption, effectivePresentationId })
  eq(adoptedFor(imported, frame19.presentation_id), true, 'recorded 19 on its own deck: adopted')
  eq(adoptedFor(imported, 'another-deck'), false, 'the marker of a deck that is not the one on screen does not count')
  eq(adoptedFor(original, frame20.presentation_id), false, 'recorded 20 (Use original): not adopted'); eq(adoptedFor(null, frame19.presentation_id), false); eq(adoptedFor(undefined, undefined), false)
  // ... and what the note does with it, with nothing remembered in this browser
  const empty = { getItem: () => null, setItem: () => assert.fail('reading writes nothing') }
  eq(L.deckImportNoteVisible(empty, USER_ID, SESSION, adoptedFor(imported, frame19.presentation_id)), true, 'imported deck, any device: the note')
  eq(L.deckImportNoteVisible(empty, USER_ID, SESSION, adoptedFor(original, frame20.presentation_id)), false, 'a Use original deck: none')
  // the page line: flag-gated first, the Studio shell, no note while the session loads, never for the new-session address; the note is loaded lazily and only on the client
  match(page, /\{process\.env\.NEXT_PUBLIC_STUDIO_DECK_IMPORT === 'true' && studioShell && !session\.isLoadingSession && !!currentSessionId && currentSessionId !== 'new' && <StudioDeckImportNote className="mx-3 mt-2" sessionId=\{currentSessionId\} adopted=/)
  match(page, /const StudioDeckImportNote = nextDynamic\(\(\) => import\('@\/components\/studio-deck-import\/studio-deck-import-note'\)\.then\(module => module\.StudioDeckImportNote\), \{ ssr: false \}\)/)
  eq((page.match(/StudioDeckImportNote/g) ?? []).length, 3, 'named in the const (twice, with the module\'s export) and the JSX tag only')
  // the strip: the page without these lines is the base's page (checked with the other edited files above), and every addition occurs once
  eq(DECK_IMPORT_BUILDER_ADDITIONS.length, 2)
  for (const [added] of DECK_IMPORT_BUILDER_ADDITIONS) eq(page.split(added).length - 1, 1, `the page has the addition once: ${added.slice(0, 60)}`)
  // the sibling strips (the roots other pins call) take this change's lines out too, through the duplicate-deck strip they all run first
  const dup = await import(`${pathToFileURL(path.join(root, 'scripts/studio-duplicate-deck-strip.mjs')).href}?v=${Date.now()}`)
  const stripped = dup.stripDuplicateDeck(PAGE, page)
  nomatch(stripped, /StudioDeckImportNote|NEXT_PUBLIC_STUDIO_DECK_IMPORT/, 'a sibling pin that strips the page sees none of this change\'s lines')
}

// ================================================================ 4c. the Builder's welcome links to the Decks page (ruling I5a)
async function secBuilder() {
  const L = loadLib()
  const icons = { FileUp: 'FileUp', LayoutTemplate: 'LayoutTemplate', RectangleHorizontal: 'RectangleHorizontal', Layers: 'Layers', Sparkles: 'Sparkles' }
  const stubs = { 'next/link': { default: 'Link' }, 'lucide-react': icons, '@/components/builder/studio-introduction': { StudioIntroductionButton: 'StudioIntroductionButton' }, '@/components/studio-intro-replay': { StudioIntroReplay: 'StudioIntroReplay' }, '@/components/builder/studio-first-run-actions': {} }
  const component = (rel, env, name, base = false) => {
    const previous = OVER
    OVER = base ? { ...OVER, [rel]: baseSource(rel) } : OVER
    try { return createWorld({ real: [rel], stubs, globals: { process: { env } } }).load(rel)[name] } finally { OVER = previous }
  }
  const links = tree => flat(tree).filter(node => node.props?.['data-studio-deck-import-builder'] === 'true')
  // React draws nothing for `false`, `null` and `undefined` children, so the flag-off tree (which holds a `false` where the link would be) is compared with those left out
  const isLink = child => !!child && typeof child === 'object' && child.props?.['data-studio-deck-import-builder'] === 'true'
  const drawn = (tree, drop = false) => JSON.stringify(plain(tree), (key, value) => (Array.isArray(value) ? value.filter(child => child !== false && child !== null && !(drop && isLink(child))) : value))
  const without = tree => drawn(tree, true)
  const cases = [
    [FIRSTRUN, 'StudioFirstRunActions', [{ onStartBlank: () => {} }, {}], 'studio-first-run-link'],
    [STAGE, 'StudioWelcomeStage', [{}, { studioIntroReplay: 'the replay' }, { planning: true }], null],
  ]
  for (const [rel, name, propSets, className] of cases) {
    for (const props of propSets) {
      const baseTree = sha(drawn(component(rel, {}, name, true)(props)))
      // off: every flag spelling but the exact one renders the base's bytes
      for (const flag of [undefined, 'false', 'TRUE', '1', '', 'yes', 'true ', null]) {
        const tree = component(rel, flag === undefined ? {} : { [FLAG]: flag }, name)(props)
        eq(links(tree).length, 0, `${name}: flag ${JSON.stringify(flag)}: no link`)
        eq(sha(drawn(tree)), baseTree, `${name}: flag ${JSON.stringify(flag)}: what is drawn is the base's, byte for byte`)
      }
      // on: the base plus one link to the Decks page (not on the planning poster, which has no caption)
      const on = component(rel, { [FLAG]: 'true' }, name)(props)
      const found = links(on)
      if (props.planning) { eq(found.length, 0, `${name}: the planning poster has no actions to add to`); eq(sha(drawn(on)), baseTree); continue }
      eq(found.length, 1, `${name}: one link`)
      eq(found[0].type, 'Link'); eq(found[0].props.href, L.DECK_IMPORT_BUILDER_HREF, 'it goes to /dashboard?import=pptx'); eq(nodeText(found[0]).trim(), 'Import a PowerPoint')
      ok(flat(found[0]).some(node => node.type === 'FileUp' && node.props['aria-hidden'] === 'true'), 'with a decorative icon'); if (className) eq(found[0].props.className, className, 'in the row\'s own link style')
      eq(sha(without(on)), baseTree, `${name}: take the link out and it is the base's tree`)
      const siblings = flat(on).filter(node => node.type === 'Link').map(node => node.props.href)
      deepEq(siblings, ['/studio/templates', L.DECK_IMPORT_BUILDER_HREF], 'after Explore templates, not instead of it')
    }
  }
  // the literal in both components is the lib's constant, and each reads the flag inline and exactly
  for (const rel of [FIRSTRUN, STAGE]) {
    const source = src(rel)
    eq([...source.matchAll(/href="([^"]*import=pptx[^"]*)"/g)].map(found => found[1]).join(), L.DECK_IMPORT_BUILDER_HREF, `${rel}: the link is the lib's constant`)
    match(source, /process\.env\.NEXT_PUBLIC_STUDIO_DECK_IMPORT === ["']true["'] &&/); nomatch(source, /process\.env\[|\{ *NEXT_PUBLIC/)
    nomatch(source.replace(/\/\*[\s\S]*?\*\//g, ''), /\b(fetch|WebSocket|XMLHttpRequest|localStorage|sessionStorage|sendBeacon|navigator\.)\b/, `${rel}: no request, socket or storage`)
  }
}

// ================================================================ 5. the layout: flag off hands the page back as it was
async function secLayout() {
  const SENTINEL = { type: 'main', props: { 'data-studio-decks': 'true', children: 'the page' }, key: null }
  // the layout hands the page back or puts the gate (a small client module that loads the button lazily) above it; the gate is a stub here and has its own checks below
  const layoutFor = env => createWorld({ real: [LAYOUT], stubs: { '@/components/studio-deck-import/studio-deck-import-gate': { StudioDeckImportEntryGate: 'StudioDeckImportEntryGate' } }, globals: { process: { env } } }).load(LAYOUT).default
  const render = env => layoutFor(env)({ children: SENTINEL })
  const hashes = []
  for (const shell of [undefined, 'false', 'true']) {
    for (const flag of [undefined, 'false', 'TRUE', '1', '', 'yes', 'true ', 'true']) {
      const env = { ...(shell === undefined ? {} : { NEXT_PUBLIC_STUDIO_V4_SHELL: shell }), ...(flag === undefined ? {} : { [FLAG]: flag }) }
      const tree = render(env)
      if (shell === 'true' && flag === 'true') {
        eq(tree.type, 'Fragment'); deepEq(tree.props.children.map(child => child.type), ['StudioDeckImportEntryGate', 'main'], 'on: the button\'s gate, then the page'); ok(tree.props.children[1] === SENTINEL, 'the page itself, untouched')
      } else {
        eq(tree.type, 'Fragment', 'off: a bare fragment'); ok(tree.props.children === SENTINEL, `off (shell ${shell}, flag ${JSON.stringify(flag)}): exactly the page, no wrapper, no button`); deepEq(Object.keys(tree.props), ['children'])
        hashes.push(sha(plain(tree)))
      }
    }
  }
  eq(new Set(hashes).size, 1, 'every "off" rendering is the same bytes')
  // reading the flag: inline and exact
  const layout = src(LAYOUT)
  match(layout, /process\.env\.NEXT_PUBLIC_STUDIO_DECK_IMPORT !== "true"/); match(layout, /process\.env\.NEXT_PUBLIC_STUDIO_V4_SHELL !== "true"/)
  nomatch(layout, /process\.env\[|\{ *NEXT_PUBLIC|= process\.env;?$/m, 'read inline, as Next needs')
  // the layout names the gate and nothing else of the feature: the button's module and stylesheet are not reachable from the layout, so its own script and stylesheet lists do not carry them
  eq([...layout.matchAll(/^import .* from ["']([^"']+)["']/gm)].map(found => found[1]).sort().join(), '@/components/studio-deck-import/studio-deck-import-gate,react', 'the layout imports react and the gate, nothing else')
  nomatch(layout, /next\/dynamic|\bimport\(/, 'and loads nothing itself')
  // ---- the gate: the one client module the Decks layout names; it loads the button lazily from its own module (server-rendered, so there is no jump when the page arrives)
  {
    const loaded = []
    const dynamic = (loader, options) => { const name = `lazy${loaded.length}`; loaded.push({ name, loader, options }); return name }
    const entryModule = { StudioDeckImportEntry: 'EntryComponent' }
    const gate = createWorld({ real: [GATE], stubs: { 'next/dynamic': { default: dynamic }, './studio-deck-import-entry': entryModule }, globals: { process: { env: {} } } }).load(GATE)
    eq(loaded.length, 1, 'one lazy component, nothing else'); eq(gate.StudioDeckImportEntryGate().type, 'lazy0'); eq(Object.keys(gate).join(), 'StudioDeckImportEntryGate')
    eq(loaded[0].options, undefined, 'the button is server-rendered (no jump when the page arrives)')
    eq(await loaded[0].loader(), 'EntryComponent', 'it loads the button\'s module')
    const source = src(GATE)
    match(source, /^"use client"|^'use client'/m); eq([...source.matchAll(/^import .* from ["']([^"']+)["']/gm)].map(found => found[1]).join(), 'next/dynamic', 'its only import is next/dynamic')
    nomatch(source.replace(/\/\/[^\n]*/g, ''), /process\.env|\bfetch\b|localStorage|sessionStorage/, 'it reads and does nothing itself')
  }
  return hashes[0]
}

// ================================================================ 6. static checks
const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name.startsWith('.')) continue
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) walk(rel, out); else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) out.push(rel)
  }
  return out
}
async function secStatic() {
  // ---- the minter is server-only: imported by the two routes and nothing else; no 'use client' module reaches it, directly or through anything it imports
  const files = ['app', 'components', 'hooks', 'lib', 'contexts'].filter(dir => fs.existsSync(path.join(root, dir))).flatMap(dir => walk(dir))
  const text = new Map(files.map(rel => [rel, OVER[rel] ?? read(rel)]))
  for (const rel of NEW_FILES) if (!text.has(rel)) text.set(rel, src(rel))
  const resolve = (spec, from) => {
    if (!spec.startsWith('@/') && !spec.startsWith('.')) return null
    const base = spec.startsWith('@/') ? spec.slice(2) : path.posix.normalize(path.posix.join(path.posix.dirname(from), spec))
    return [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`, `${base}.js`, `${base}.mjs`].find(candidate => text.has(candidate)) ?? null
  }
  const importsOf = rel => [...text.get(rel).matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\(\s*)['"]([^'"]+)['"]/g)].map(found => resolve(found[1], rel)).filter(Boolean)
  const isClient = rel => /^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*['"]use client['"]/.test(text.get(rel))
  const clientRoots = [...text.keys()].filter(isClient)
  ok(clientRoots.length > 100, `the walk sees the app's client modules (${clientRoots.length})`)
  ok(clientRoots.includes(HOOK) && clientRoots.includes(DIALOG) && clientRoots.includes(ENTRY) && clientRoots.includes(NOTE) && clientRoots.includes(GATE), 'this change\'s client modules are client modules'); ok(!clientRoots.includes(LAYOUT), 'and its layout is server code')
  const seen = new Set()
  const stack = [...clientRoots]
  while (stack.length) { const rel = stack.pop(); if (seen.has(rel)) continue; seen.add(rel); stack.push(...importsOf(rel)) }
  ok(seen.size > clientRoots.length, 'the closure follows imports')
  ok(!seen.has(HELPER), 'no "use client" module, and nothing a client module imports, reaches lib/director-rest-entitlement')
  deepEq([...text.keys()].filter(rel => rel !== HELPER && /director-rest-entitlement/.test(text.get(rel))).sort(), [JOBS, START].sort(), 'the minter is imported by the two import routes only')
  for (const rel of [START, JOBS]) { ok(!isClient(rel), `${rel} is server code`); match(text.get(rel), /from '@\/lib\/director-rest-entitlement'/); eq((text.get(rel).match(/restEntitlementHeaders\(/g) ?? []).length, 1, `${rel}: one signed call`); eq((text.get(rel).match(/\bfetch\(/g) ?? []).length, 1, `${rel}: one Director fetch`) }
  match(text.get(START), /restEntitlementHeaders\(userId, 'POST'\)/); match(text.get(JOBS), /restEntitlementHeaders\(userId, 'GET'\)/)
  for (const rel of [START, JOBS]) match(text.get(rel), /process\.env\.NEXT_PUBLIC_STUDIO_DECK_IMPORT === 'true' && process\.env\.DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED === 'true'\s*\? restEntitlementHeaders/, `${rel}: signed only when both flags are on`)
  for (const rel of [START, JOBS]) { const s = text.get(rel); ok(s.indexOf("NEXT_PUBLIC_STUDIO_DECK_IMPORT !== 'true'") < s.indexOf('getServerSession('), `${rel}: the flag is checked before the session is read`); nomatch(s, /\bprocess\.env\.DIRECTOR_WS_AUTH_SECRET/, `${rel}: never reads the secret itself`) }
  const helper = text.get(HELPER)
  nomatch(helper, /\bconsole\b|NEXT_PUBLIC_|['"]use client['"]/, 'the minter never logs, reads only server env, and is not a client module')
  // nothing a browser runs names the secret, the header or the minter
  const mine = [HOOK, DIALOG, ENTRY, NOTE, GATE, LIB, LAYOUT, CSS, FIRSTRUN, STAGE]
  for (const rel of mine) nomatch(text.get(rel) ?? src(rel), /DIRECTOR_WS_AUTH_SECRET|X-Deckster-Entitlement|director-rest-entitlement|DECKSTER_REST_ENTITLEMENT/i, `${rel}: no secret, no header, no minter`)
  for (const rel of [HOOK, DIALOG, ENTRY, NOTE, LIB]) nomatch(text.get(rel), /COMPOSER_FRONTDOOR_TOKEN|COMPOSER_DIRECTOR_URL|Authorization/, `${rel}: no server credential in browser code`)
  // no literal secret anywhere in the files this change adds (a bearer, an api key, a signed blob)
  for (const rel of NEW_FILES.filter(file => file !== HELPER)) nomatch(text.get(rel), /Bearer [A-Za-z0-9._-]{16,}|\bsk-[A-Za-z0-9]{16,}|\beyJ[A-Za-z0-9_-]{20,}|[A-Fa-f0-9]{40,}/, `${rel}: no literal secret`)
  nomatch(read('scripts/test-studio-deck-import.mjs'), /Bearer [A-Za-z0-9._-]{16,}|\bsk-[A-Za-z0-9]{16,}|\beyJ[A-Za-z0-9_-]{20,}/, 'the test: no literal bearer, key or signed blob (its secrets are made up at run time)')
  // ---- the sheet: every rule hangs on this change's markers; tokens are defined for light and dark; nothing forced
  const root_ = postcss.parse(src(CSS))
  const selectors = []
  root_.walkRules(rule => { for (const selector of rule.selectors) selectors.push({ selector, rule }) })
  ok(selectors.length > 25, `the sheet has ${selectors.length} selectors`)
  for (const { selector } of selectors) match(selector, /data-studio-deck-import/, `anchored: ${selector.slice(0, 70)}`)
  root_.walkDecls(decl => { ok(!decl.important, `no !important: ${decl.prop}`) })
  const defined = (selector) => { const out = new Set(); root_.walkRules(rule => { if (rule.selectors.includes(selector)) rule.walkDecls(decl => { if (decl.prop.startsWith('--sdi-')) out.add(decl.prop) }) }); return out }
  const light = defined('[data-studio-deck-import-dialog="true"]'), dark = defined('.dark [data-studio-deck-import-dialog="true"]')
  ok(light.size >= 9, 'the dialog defines its own tokens'); deepEq([...dark].sort(), [...light].sort(), 'dark redefines every token light defines')
  const used = new Set(); root_.walkDecls(decl => { for (const found of decl.value.matchAll(/var\((--[a-z-]+)/g)) used.add(found[1]) })
  for (const name of used) ok(name.startsWith('--sdi-') ? light.has(name) : ['--ss-line', '--ss-panel', '--ss-text', '--ss-teal', '--ss-surface', '--ss-accent'].includes(name), `${name} is a token that exists`)
  eq(root_.nodes.filter(node => node.type === 'rule' && node.selector.startsWith('[data-studio-v4-shell="true"] [data-studio-deck-import-bar')).length, 2, 'the entry bar is scoped to the Studio shell')
  // the note in the Builder's chat column: its own rule, in flow, light and dark tokens shared with the dialog, a visible focus ring on its button
  {
    const noteRule = root_.nodes.find(node => node.type === 'rule' && node.selector === '[data-studio-deck-import-note="true"]')
    ok(noteRule, 'the note has its own rule')
    const decls = Object.fromEntries(noteRule.nodes.filter(node => node.type === 'decl').map(node => [node.prop, node.value]))
    ok(!('position' in decls) && !('z-index' in decls) && !('transform' in decls), 'in flow in the chat column, like the other notices: not positioned, no layer of its own')
    for (const selector of ['[data-studio-deck-import-note="true"]', '.dark [data-studio-deck-import-note="true"]']) ok(selectors.some(entry => entry.rule.selectors.includes(selector) && entry.rule.nodes.some(node => node.type === 'decl' && node.prop === '--sdi-panel')), `${selector} defines the tokens`)
    ok(selectors.some(entry => entry.selector === '[data-studio-deck-import-note-dismiss="true"]:focus-visible'), 'its button shows focus')
  }
  // ---- the example: the flag's block is last, documents the flag off, names no other change's flag, and the base's lines are all still there in order
  const env = src(ENVFILE)
  const baseEnv = baseSource(ENVFILE)
  const blockStart = env.indexOf('# STUDIO DECK IMPORT, ')
  ok(blockStart > 0, 'the block is there'); eq(env.split(`${FLAG}="false"`).length - 1, 1, 'one line sets the flag, to "false"')
  const flagLine = `${FLAG}="false"\n`
  const blockEnd = env.indexOf(flagLine) + flagLine.length
  ok(blockEnd > blockStart, 'the flag line closes the block')
  const block = env.slice(blockStart, blockEnd)
  ok(block.trimEnd().endsWith(`${FLAG}="false"`), 'the block ends with the flag line')
  // PASS2 ADMIN stays the last of the Pass 2 blocks this change must not move: the block sits BEFORE it (FRONTEND-1 ruling, 23 Oct)
  const adminAt = env.indexOf('# PASS2 ADMIN (')
  ok(adminAt > blockEnd, 'the block sits before the PASS2 ADMIN block'); eq(env.slice(blockEnd, blockEnd + 1), '\n', 'one blank line between this block and the PASS2 ADMIN block')
  eq(env.slice(blockEnd - flagLine.length - 1, blockEnd - flagLine.length), '\n', 'the block starts on its own line')
  const without = env.slice(0, blockStart) + env.slice(blockEnd)
  eq(without, baseEnv, 'and here it is exactly the base\'s file: the block is inserted, nothing else moved')
  const blockFlags = [...block.matchAll(/\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+){2,}\b/g)].map(found => found[0])
  deepEq([...new Set(blockFlags)].sort(), ['COMPOSER_DIRECTOR_URL', 'COMPOSER_FRONTDOOR_TOKEN', 'DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED', 'DIRECTOR_DECK_IMPORT_ENABLED', FLAG].sort(), 'the block names this flag, Director\'s, and the existing front-door settings only')
  nomatch(block, /^DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED=|^DIRECTOR_WS_AUTH_SECRET/m, 'the helper\'s flag is documented where it belongs, not here')
  ok(block.split('\n').every(line => line === '' || line.startsWith('#') || /^[A-Z][A-Z0-9_]*=/.test(line)), 'comments, blanks and one env line')
  match(block, /\/dashboard\?import=pptx, which opens the same dialog/); match(block, /Changing the theme and Add Element are not available for imported decks yet\./)
  match(block, /both routes named below answer 404/); match(block, /exact value "true" turns it on; default off/); match(block, /calls no AI model/)
  for (const other of ['STUDIO_KG_ASK', 'LIBRARY_MANAGE', 'library-manage', 'DUPLICATE_DECK', 'duplicate-deck', 'P2_POLISH', 'P2_PUBLISH', 'DECK_MUTATION_DEDUPE']) nomatch(block, new RegExp(other), `the block reuses nothing of ${other}`)
  // ---- package.json: one added script, nothing else
  const pkg = src(PKG), basePkg = baseSource(PKG)
  eq(pkg.replace(/,\n    "test:studio-deck-import": "node scripts\/test-studio-deck-import\.mjs"/, ''), basePkg, 'package.json is the base plus the one script')
  ok(appendOnlyOver(PKG, pkg, basePkg), 'and an append-only change for the sibling pins')
  eq(JSON.parse(pkg).scripts['test:studio-deck-import'], 'node scripts/test-studio-deck-import.mjs'); deepEq(JSON.parse(pkg).dependencies, JSON.parse(basePkg).dependencies, 'no dependency added'); deepEq(JSON.parse(pkg).devDependencies, JSON.parse(basePkg).devDependencies)
  eq(execFileSync('git', ['diff', '--name-only', BASE_COMMIT, '--', 'pnpm-lock.yaml', 'next.config.mjs', 'middleware.ts', 'vercel.json', 'prisma'], { cwd: root, encoding: 'utf8' }), '', 'no lock file, config or schema change')
}

// ================================================================ run
const SECTIONS = { blobs: secBlobs, lib: secLib, routes: secRoutes, entitlement: secEntitlement, ui: secUi, note: secNote, adoption: secAdoption, builder: secBuilder, layout: secLayout, static: secStatic }
async function proveAll(over = {}, only = null) {
  OVER = over
  const out = {}
  try { for (const [name, fn] of Object.entries(SECTIONS)) if (!only || only.includes(name)) out[name] = await fn() } finally { OVER = {}; for (const ui of mountedUis.splice(0)) ui.rt.unmount() }
  return out
}
const t0 = Date.now()
const real = await proveAll()
const realChecks = checks
const realMs = Date.now() - t0
counting = false
console.log(`flag-off layout sha256 ${real.layout.slice(0, 16)} (every shell/flag combination except shell+flag "true" renders these bytes)`)
if (process.env.DECK_IMPORT_QUICK) { console.log(`Studio deck import (quick, mutants skipped): ${realChecks} checks passed in ${realMs} ms; no network.`); process.exit(0) }

// ================================================================ 7. mutants: [file, name, from, to, sections that must notice]
const M = [
  // the rules
  [LIB, 'flag: either one is enough', "flag === 'true' && shell === 'true'", "flag === 'true' || shell === 'true'", ['lib']],
  [LIB, 'flag: any value is on', "return flag === 'true' && shell === 'true'", "return Boolean(flag) && shell === 'true'", ['lib']],
  [LIB, 'start endpoint', "'/api/studio-deck-import'\nexport", "'/api/studio-deck-import/start'\nexport", ['lib', 'ui']],
  [LIB, 'job endpoint not encoded', 'encodeURIComponent(jobId)', 'jobId', ['lib']],
  [LIB, 'size cap moved', 'DECK_IMPORT_MAX_BYTES = 100 * 1024 * 1024', 'DECK_IMPORT_MAX_BYTES = 200 * 1024 * 1024', ['lib']],
  [LIB, 'size cap off by one', 'size > DECK_IMPORT_MAX_BYTES', 'size >= DECK_IMPORT_MAX_BYTES', ['lib']],
  [LIB, 'poll fallback moved', 'DECK_IMPORT_POLL_FALLBACK_MS = 3000', 'DECK_IMPORT_POLL_FALLBACK_MS = 5000', ['lib', 'ui']],
  [LIB, 'retries moved', 'DECK_IMPORT_POLL_RETRIES = 3', 'DECK_IMPORT_POLL_RETRIES = 30', ['lib', 'ui']],
  [LIB, 'PDF sentence', 'PDF import is coming.', 'PDF import is not coming.', ['lib', 'ui']],
  [LIB, 'PDF treated as not pptx', "if (name.endsWith('.pdf')) return refuse('FILE_IS_PDF')\n", '', ['lib']],
  [LIB, 'extension check dropped', "if (!name.endsWith('.pptx')) return refuse('FILE_NOT_PPTX')", '', ['lib']],
  [LIB, 'case-sensitive extension', 'file.name.trim().toLowerCase()', 'file.name.trim()', ['lib']],
  [LIB, 'empty file passes', "if (!(size > 0)) return refuse('FILE_EMPTY')", '', ['lib']],
  [LIB, 'too large passes', "if (size > DECK_IMPORT_MAX_BYTES) return refuse('UPLOAD_FILE_TOO_LARGE')", '', ['lib']],
  [LIB, 'title keeps the extension', ".replace(/\\.pptx$/i, '')", '', ['lib']],
  [LIB, 'kind sent as pdf', "file_name: parts.fileName, kind: 'pptx' }", "file_name: parts.fileName, kind: 'pdf' }", ['lib', 'ui']],
  [LIB, 'start body gains a user id', "kind: 'pptx' }\n}\n\n/**\n * The proxy's", "kind: 'pptx', user_id: parts.sessionId } as DeckImportStartBody\n}\n\n/**\n * The proxy's", ['lib', 'ui']],
  [LIB, 'researcher session may differ', 'researcher_session_id !== session_id', 'false', ['lib', 'routes']],
  [LIB, 'storage namespace unchecked', "parts[0] !== session_id ||", '', ['lib', 'routes']],
  [LIB, 'traversal allowed', "parts[1] === '..' ||", '', ['lib', 'routes']],
  [LIB, 'special characters allowed', '/[\\\\%?#:\\x00-\\x1f]/.test(path)', 'false', ['lib', 'routes']],
  [LIB, 'extension enforced at the proxy', "if (kind !== 'pptx' ||", "if (kind !== 'pptx' || !String(file_name).endsWith('.pptx') ||", ['lib', 'routes']],
  [LIB, 'job prefix dropped', 'value.startsWith(DECK_IMPORT_JOB_PREFIX) && ', '', ['lib', 'routes']],
  [LIB, 'entitlement words lost', "str(data.error) ?? str(data.detail) ?? DECK_IMPORT_WORDS.SIGN_IN, retryable: data.retryable === true", 'DECK_IMPORT_WORDS.SIGN_IN, retryable: data.retryable === true', ['lib', 'ui']],
  [LIB, 'coded refusal retryable', "return { message: detail.message as string, retryable: false }", "return { message: detail.message as string, retryable: true }", ['lib', 'ui']],
  [LIB, '404 words', "if (status === 404) return { message: DECK_IMPORT_WORDS.IMPORT_UNAVAILABLE, retryable: false }", "if (status === 404) return { message: DECK_IMPORT_WORDS.START_FAILED, retryable: false }", ['lib', 'ui']],
  [LIB, '5xx not retryable', "retryable: status >= 500 }\n  return { message: DECK_IMPORT_WORDS.START_FAILED", "retryable: false }\n  return { message: DECK_IMPORT_WORDS.START_FAILED", ['lib', 'ui']],
  [LIB, 'failed job shown retryable', "error.retryable === true)", "error.retryable !== false)", ['lib', 'ui']],
  [LIB, 'failure words replaced', "str(error.message) ?? firstError", "firstError", ['lib', 'ui']],
  [LIB, 'ready without complete', "if (stage === 'ready' && status === 'complete')", "if (stage === 'ready')", ['lib']],
  [LIB, 'ready without result', "if (!isDict(block.result)) return failed('OPEN_FAILED'", "if (false) return failed('OPEN_FAILED'", ['lib']],
  [LIB, 'waiting is an error', "words: waitingNow ? STAGE_WORDS.waiting", "words: waitingNow ? DECK_IMPORT_WORDS.NOT_IMPORTED", ['lib', 'ui']],
  [LIB, 'waiting only by stage', "const waitingNow = stage === 'waiting' || waiting !== null", "const waitingNow = stage === 'waiting'", ['lib']],
  [LIB, 'retry-after promised', "Trying again in about ${retryAfter}", "Trying again in about ${retryAfter + 1}", ['lib', 'ui']],
  [LIB, 'plural seconds', "retryAfter === 1 ? 'second' : 'seconds'", "'seconds'", ['lib']],
  [LIB, 'done passes the total', 'Math.min(done, total), total }', 'done, total }', ['lib']],
  [LIB, 'time left while waiting', 'eta: waitingNow ? null :', 'eta:', ['lib']],
  [LIB, 'poll clamp low', 'Math.max(TEMPLATE_POLL_MIN_MS', 'Math.max(0', ['lib']],
  [LIB, 'poll clamp high', 'Math.min(TEMPLATE_POLL_MAX_MS', 'Math.min(600000', ['lib']],
  [LIB, 'banner singular', "${items === 1 ? 'item' : 'items'}", "items", ['lib', 'ui']],
  [LIB, 'banner when none', 'return items > 0 ?', 'return items >= 0 ?', ['lib']],
  [LIB, 'junk items kept', "if (!isDict(item) || !str(item.text)) continue", '', ['lib']],
  [LIB, 'notes said twice', 'notesMessage && !lines.some(line => line.text === notesMessage) ? notesMessage : null', 'notesMessage', ['lib', 'ui']],
  [LIB, 'copied notes shown', "(notes.state === 'not_kept' || notes.state === 'partial')", "(notes.state !== 'none')", ['lib']],
  [LIB, 'other session accepted', 'session_id !== expectedSessionId ||', '', ['lib', 'ui']],
  [LIB, 'viewer address optional', ' || !str(viewer_url)) return null', ') return null', ['lib', 'ui']],
  [LIB, 'builder href not encoded', 'encodeURIComponent(sessionId)}`', 'sessionId}`', ['lib']],
  [LIB, 'projection leaks the upload', "['job_id', 'status', 'session_id', 'errors', 'poll', 'deck_import']", "['job_id', 'status', 'session_id', 'errors', 'poll', 'deck_import', 'upload_ref']", ['lib', 'routes']],
  [LIB, 'pending key shared', 'deckster_deck_import_job_${encodeURIComponent(userId)}', 'deckster_deck_import_job_${userId}', ['lib']],
  [LIB, 'pending accepts other jobs', 'if (!isDict(raw) || !deckImportJobIdValid(raw.job_id) ||', 'if (!isDict(raw) ||', ['lib', 'ui']],
  // the routes
  [START, 'start: flag ignored', "if (process.env.NEXT_PUBLIC_STUDIO_DECK_IMPORT !== 'true') {", 'if (false) {', ['routes', 'entitlement', 'static']],
  [START, 'start: flag read after the session', "  if (process.env.NEXT_PUBLIC_STUDIO_DECK_IMPORT !== 'true') {\n    return NextResponse.json({ error: 'Not found' }, { status: 404 })\n  }\n  const session = await getServerSession(authOptions)", "  const session = await getServerSession(authOptions)\n  if (process.env.NEXT_PUBLIC_STUDIO_DECK_IMPORT !== 'true') {\n    return NextResponse.json({ error: 'Not found' }, { status: 404 })\n  }", ['routes', 'static']],
  [START, 'start: signed-out allowed', "if (!session?.user?.email) return", "if (false) return", ['routes']],
  [START, 'start: ownership unchecked', 'if (!ownedSession) return', 'if (false) return', ['routes']],
  [START, 'start: deleted session allowed', "status: { not: 'deleted' }", "status: { not: 'none' }", ['routes']],
  [START, 'start: any person\'s session', 'where: { id: checked.body.session_id, userId, status', 'where: { id: checked.body.session_id, status', ['routes']],
  [START, 'start: body cap off', 'bytes > DECK_IMPORT_START_MAX_BYTES', 'bytes > 10 * DECK_IMPORT_START_MAX_BYTES', ['routes']],
  [START, 'start: browser body forwarded', 'body = JSON.stringify(checked.body)', 'body = Buffer.concat(chunks).toString(\'utf8\')', ['routes']],
  [START, 'start: wrong Director path', '/api/template-ingest/stage/import-reference`', '/api/template-ingest/stage/upload-reference`', ['routes', 'ui']],
  [START, 'start: wrong method', "method: 'POST',\n      headers: {\n        Authorization", "method: 'PUT',\n      headers: {\n        Authorization", ['routes']],
  [START, 'start: no front-door token', 'Authorization: `Bearer ${token}`,', '', ['routes']],
  [START, 'start: session id as the user', "'X-Composer-User-Id': userId,\n        'Content-Type'", "'X-Composer-User-Id': session.user.email,\n        'Content-Type'", ['routes']],
  [START, 'start: production Director allowed', "requireComposerServiceUrl(configured, 'directorv40-uat.up.railway.app')", 'configured', ['routes']],
  [START, 'start: redirects followed', "redirect: 'error',", '', ['routes']],
  [START, 'start: cached', "cache: 'no-store',\n      redirect", "redirect", ['routes']],
  [START, 'start: refusal swallowed', 'return NextResponse.json(answer, { status: response.status,', 'return NextResponse.json(answer, { status: 200,', ['routes', 'ui']],
  [START, 'start: detail leaked', "{ error: 'Deck import is temporarily unavailable. Try again.' }, { status: 502 })\n  }\n}", "{ error: String(error) }, { status: 502 })\n  }\n}", ['routes']],
  [START, 'start: signed with both flags needed', "process.env.DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED === 'true'\n      ? restEntitlementHeaders(userId, 'POST')", "true\n      ? restEntitlementHeaders(userId, 'POST')", ['entitlement', 'static']],
  [START, 'start: signed whatever the deck flag', "process.env.NEXT_PUBLIC_STUDIO_DECK_IMPORT === 'true' && process.env.DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED === 'true'\n      ? restEntitlementHeaders(userId, 'POST')", "process.env.DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED === 'true'\n      ? restEntitlementHeaders(userId, 'POST')", ['static']],
  [START, 'start: signed for the wrong method', "restEntitlementHeaders(userId, 'POST')", "restEntitlementHeaders(userId, 'GET')", ['entitlement', 'static']],
  [START, 'start: signed for the e-mail', "restEntitlementHeaders(userId, 'POST')", "restEntitlementHeaders(session.user.email, 'POST')", ['entitlement', 'static']],
  [START, 'start: never signed', ': {}\n    const response', ': {}\n    const response = await fetch(`${base}/api/template-ingest/stage/import-reference`, { method: \'POST\', headers: { Authorization: `Bearer ${token}`, \'X-Composer-User-Id\': userId, \'Content-Type\': \'application/json\' }, body, cache: \'no-store\', redirect: \'error\', signal: AbortSignal.timeout(25000) })\n    const unused', ['entitlement', 'static']],
  [JOBS, 'job: flag ignored', "if (process.env.NEXT_PUBLIC_STUDIO_DECK_IMPORT !== 'true') {", 'if (false) {', ['routes', 'entitlement', 'static']],
  [JOBS, 'job: any job id', 'if (!deckImportJobIdValid(jobId))', 'if (false)', ['routes']],
  [JOBS, 'job: signed-out allowed', "if (!session?.user?.email) return", "if (false) return", ['routes']],
  [JOBS, 'job: wrong path', '/api/template-ingest/stage/jobs/${encodeURIComponent(jobId)}', '/api/template-ingest/stage/jobs/${jobId}/x', ['routes', 'ui']],
  [JOBS, 'job: whole job leaks', 'const job = response.ok ? projectDeckImportJob(answer) : answer', 'const job = answer', ['routes']],
  [JOBS, 'job: signed for the wrong method', "restEntitlementHeaders(userId, 'GET')", "restEntitlementHeaders(userId, 'POST')", ['entitlement', 'static']],
  [JOBS, 'job: signed whatever the deck flag', "process.env.NEXT_PUBLIC_STUDIO_DECK_IMPORT === 'true' && process.env.DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED === 'true'\n      ? restEntitlementHeaders(userId, 'GET')", "process.env.DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED === 'true'\n      ? restEntitlementHeaders(userId, 'GET')", ['static']],
  [JOBS, 'job: never signed', "? restEntitlementHeaders(userId, 'GET')\n      : {}", "? {}\n      : {}", ['entitlement', 'static']],
  [JOBS, 'job: cached', "cache: 'no-store',\n      redirect", "redirect", ['routes']],
  [JOBS, 'job: a body on a GET', "method: 'GET',\n      headers", "method: 'GET',\n      body: '{}',\n      headers", ['routes']],
  // the carried minter: any edit is caught by the blob pin
  [HELPER, 'minter edited', "const SIGNING_DOMAIN = 'deckster-rest-v1.'", "const SIGNING_DOMAIN = 'deckster-rest-v2.'", ['blobs']],
  [HELPER, 'minter ignores its flag', "return process.env.DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED === 'true'", 'return true', ['blobs', 'entitlement']],
  // the hook
  [HOOK, 'upload not storage-only', 'storageOnly: true', 'storageOnly: false', ['ui']],
  [HOOK, 'start without a fresh id', 'const sessionId = crypto.randomUUID()', "const sessionId = 'fixed-session'", ['ui']],
  [HOOK, 'session title', 'deckImportTitle(file.name)', 'file.name', ['ui']],
  [HOOK, 'researcher guard dropped', "try { requireComposerServiceUrl(process.env.NEXT_PUBLIC_KNOWLEDGE_SERVICE_URL, 'researcher-v11-uat.up.railway.app') }", 'try { }', ['ui']],
  [HOOK, 'layout guard dropped', "requireComposerServiceUrl(new URL(ready.viewer_url).origin, 'layout-builder-v75-uat.up.railway.app')", '', ['ui']],
  [HOOK, 'viewer policy dropped', "if (evaluateLayoutViewerUrl(ready.viewer_url, LAYOUT_VIEWER_URL_POLICY).status !== 'allowed') throw new Error('unapproved viewer address')", '', ['ui']],
  [HOOK, 'result not staged', "sessionStorage.setItem(`${COMPOSER_READY_KEY_PREFIX}${pending.session_id}`, JSON.stringify({ user_id: uid, result: ready }))", '', ['ui']],
  [HOOK, 'staged for nobody', '{ user_id: uid, result: ready }', '{ result: ready }', ['ui']],
  [HOOK, 'always opens', 'if (!view.summary.banner && !view.summary.notesLine) window.location.assign(href)', 'window.location.assign(href)', ['ui']],
  [HOOK, 'never opens', 'if (!view.summary.banner && !view.summary.notesLine) window.location.assign(href)', '', ['ui']],
  [HOOK, 'pending kept after ready', 'sessionStorage.removeItem(pendingKey)\n        } catch', '} catch', ['ui']],
  [HOOK, 'pending not kept', 'try { sessionStorage.setItem(deckImportPendingKey(userId), JSON.stringify(pending)) }', 'try { }', ['ui']],
  [HOOK, 'failure keeps the record', "if (pendingKey) { try { sessionStorage.removeItem(pendingKey) } catch { /* nothing stored */ } }", '', ['ui']],
  [HOOK, 'poll without no-store', "fetch(deckImportJobEndpoint(pending.job_id), { cache: 'no-store', signal })", 'fetch(deckImportJobEndpoint(pending.job_id), { signal })', ['ui']],
  [HOOK, 'start with credentials', "signal, headers: { 'Content-Type': 'application/json' },", "signal, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer x' },", ['ui']],
  [HOOK, 'retries not bounded', '++transient <= DECK_IMPORT_POLL_RETRIES) {\n            if', 'true) {\n            if', ['ui']],
  [HOOK, 'any status retried', '[502, 503, 504].includes(response.status) &&', 'response.status >= 400 &&', ['ui']],
  [HOOK, 'watch limit ignored', 'Date.now() - startedAt > DECK_IMPORT_WATCH_LIMIT_MS', 'false', ['ui']],
  [HOOK, 'failed job keeps polling', "if (view.kind === 'failed') return fail(", "if (view.kind === 'failed') fail(", ['ui']],
  [HOOK, 'wait ignores the interval', 'if (!await pause(view.nextMs, signal)) return', 'if (!await pause(1, signal)) return', ['ui']],
  [HOOK, 'unmount does not stop', 'useEffect(() => () => { controllerRef.current?.abort() }, [])', 'useEffect(() => () => { }, [])', ['ui']],
  [HOOK, 'resume ignored', 'if (!pending) return\n    const controller', 'return\n    const controller', ['ui']],
  [HOOK, 'resume while closed', 'if (!open || !userId) return\n    let pending', 'if (!userId) return\n    let pending', ['ui']],
  [HOOK, 'no account needed', 'if (!file || !userId || phase', 'if (!file || phase', ['ui']],
  [HOOK, 'file check skipped', "if (refusal) { setFileError(refusal); return }", '', ['ui']],
  [HOOK, 'retry keeps the old session', 'const sessionId = crypto.randomUUID()', 'const sessionId = retried.current ??= crypto.randomUUID()', ['ui']],
  [HOOK, 'start answer unchecked', 'const jobId = response.ok ? deckImportAcceptedJobId(body) : null', 'const jobId = (body as { job_id?: string } | null)?.job_id ?? null', ['ui']],
  [HOOK, 'refusal words lost', ': deckImportStartFailure(response.status, body))', ': { message: DECK_IMPORT_WORDS.START_FAILED, retryable: true })', ['ui']],
  [HOOK, 'reset keeps the file', 'setFile(null); setFileError(null); setFailure(null)', 'setFileError(null); setFailure(null)', ['ui']],
  // the dialog
  [DIALOG, 'closable while working', "if (phase === 'working') return\n", '', ['ui']],
  [DIALOG, 'picker refuses a PDF', 'accept=".pptx,.pdf"', 'accept=".pptx"', ['ui']],
  [DIALOG, 'retry always offered', '{failure.retryable && <Button', '{<Button', ['ui']],
  [DIALOG, 'retry never offered', '{failure.retryable && <Button', '{false && <Button', ['ui']],
  [DIALOG, 'error not an alert', 'data-studio-deck-import-error="true" role="alert">{failure.message}', 'data-studio-deck-import-error="true">{failure.message}', ['ui']],
  [DIALOG, 'status not announced', 'role="status" aria-live="polite" tabIndex={0} aria-label="Import status"', 'tabIndex={0} aria-label="Import status"', ['ui']],
  [DIALOG, 'no open button for a banner', "{(summary.banner || summary.notesLine) && <Button data-studio-deck-import-action=\"open\"", "{false && <Button data-studio-deck-import-action=\"open\"", ['ui']],
  [DIALOG, 'banner dropped', '{summary.banner && <p data-studio-deck-import-banner="true">', '{false && <p data-studio-deck-import-banner="true">', ['ui']],
  [DIALOG, 'bar without numbers', 'aria-valuenow={working.progress.done}', '', ['ui']],
  [DIALOG, 'another file keeps the choice', 'onClick={imp.reset}', 'onClick={() => {}}', ['ui']],
  [DIALOG, 'close does not reset', "if (!next) imp.reset()\n", '', ['ui']],
  [DIALOG, 'start enabled without a file', 'disabled={!imp.canStart}', 'disabled={false}', ['ui']],
  [ENTRY, 'dialog always mounted', '{open && <StudioDeckImportDialog', '{<StudioDeckImportDialog', ['ui']],
  [ENTRY, 'button label', 'Import a PowerPoint\n', 'Import deck\n', ['ui']],
  // the Builder's welcome links, the query and the imported-deck note
  [LIB, 'entry param moved', "DECK_IMPORT_ENTRY_PARAM = 'import'", "DECK_IMPORT_ENTRY_PARAM = 'open'", ['lib', 'builder']],
  [LIB, 'any import value opens', 'get(DECK_IMPORT_ENTRY_PARAM) === DECK_IMPORT_ENTRY_VALUE', 'get(DECK_IMPORT_ENTRY_PARAM) !== null', ['lib', 'ui']],
  [LIB, 'clean address keeps the query', '    params.delete(DECK_IMPORT_ENTRY_PARAM)\n', '', ['lib', 'ui']],
  [LIB, 'clean address drops the hash', 'return `${pathname}${rest}${hash}`', 'return `${pathname}${rest}`', ['lib']],
  [LIB, 'done key shared by everyone', 'deckster_deck_import_done_${encodeURIComponent(userId)}', 'deckster_deck_import_done', ['lib', 'note']],
  [LIB, 'dismissed key is the done key', 'deckster_deck_import_note_dismissed_${encodeURIComponent(userId)}', 'deckster_deck_import_done_${encodeURIComponent(userId)}', ['lib', 'note']],
  [LIB, 'bad ids kept in the list', 'if (deckImportSafeId(entry) && !seen.has(entry))', 'if (!seen.has(entry))', ['lib']],
  [LIB, 'repeated ids kept', 'if (deckImportSafeId(entry) && !seen.has(entry)) { seen.add(entry); out.push(entry) }', 'if (deckImportSafeId(entry)) { out.push(entry) }', ['lib']],
  [LIB, 'list limit dropped', 'return out.slice(-DECK_IMPORT_DONE_LIMIT)', 'return out', ['lib']],
  [LIB, 'oldest kept at the limit', 'return out.slice(-DECK_IMPORT_DONE_LIMIT)', 'return out.slice(0, DECK_IMPORT_DONE_LIMIT)', ['lib']],
  [LIB, 'remembering does not move to the end', 'list.filter(id => id !== sessionId)', 'list', ['lib']],
  [LIB, 'note words say AI', 'Changing the theme and Add Element are not', 'Changing the theme and AI Add Element are not', ['lib', 'note', 'static']],
  [LIB, 'a failing write throws', 'catch { /* a full or blocked store: the note is simply not shown */ }', 'catch (error) { throw error }', ['lib']],
  [LIB, 'a failing read answers nothing', 'catch { return [] }\n}\nfunction writeIdList', 'catch { return undefined as unknown as string[] }\n}\nfunction writeIdList', ['lib', 'note']],
  [HOOK, 'import not remembered', 'try { rememberDeckImported(window.localStorage, uid, pending.session_id) } catch { /* no localStorage: the note is not shown */ }', '', ['ui']],
  [HOOK, 'remembered for nobody', 'rememberDeckImported(window.localStorage, uid, pending.session_id)', "rememberDeckImported(window.localStorage, 'anyone', pending.session_id)", ['ui']],
  [HOOK, 'remembered under the file name', 'rememberDeckImported(window.localStorage, uid, pending.session_id)', 'rememberDeckImported(window.localStorage, uid, pending.file_name)', ['ui']],
  [HOOK, 'unreadable localStorage stops the open', 'try { rememberDeckImported(window.localStorage, uid, pending.session_id) } catch { /* no localStorage: the note is not shown */ }', 'rememberDeckImported(window.localStorage, uid, pending.session_id)', ['ui']],
  [ENTRY, 'the query is ignored', 'if (!deckImportRequested(window.location.search)) return', 'return', ['ui']],
  [ENTRY, 'any query opens', 'if (!deckImportRequested(window.location.search)) return', 'if (!window.location.search) return', ['ui']],
  [ENTRY, 'the address keeps the query', "try { window.history.replaceState(window.history.state, '', deckImportEntryCleanUrl(window.location)) }", 'try { }', ['ui']],
  [ENTRY, 'the router\'s history state dropped', "window.history.replaceState(window.history.state, ''", "window.history.replaceState(null, ''", ['ui']],
  [ENTRY, 'a refusing history stops the dialog', "try { window.history.replaceState(window.history.state, '', deckImportEntryCleanUrl(window.location)) } catch { /* the address keeps the query; the dialog is open all the same */ }", "window.history.replaceState(window.history.state, '', deckImportEntryCleanUrl(window.location))", ['ui']],
  // the adoption marker (Director !521) and the note's rule
  [LIB, 'adoption not frozen', 'frozen_theme: true, source: \'deck_import\' }', 'frozen_theme: false, source: \'deck_import\' } as never', ['lib', 'ui']],
  [LIB, 'staged result without the import marker', "frozen_theme: true, source: 'deck_import' },\n    session_id: expectedSessionId,", "frozen_theme: true },\n    session_id: expectedSessionId,", ['lib', 'ui', 'adoption']],
  [LIB, 'dismissal ignored', "  if (readIdList(store, deckImportNoteDismissedKey(userId)).includes(sessionId)) return false\n", '', ['lib', 'note']],
  [LIB, 'dismissal beats nothing', "  if (readIdList(store, deckImportNoteDismissedKey(userId)).includes(sessionId)) return false\n  return adopted === true ||", "  if (readIdList(store, deckImportNoteDismissedKey(userId)).includes(sessionId) && !adopted) return false\n  return adopted === true ||", ['lib', 'note']],
  [LIB, 'Director\'s marker not enough', 'return adopted === true ||', 'return false ||', ['lib', 'note', 'adoption']],
  [LIB, 'any truthy marker counts', 'return adopted === true ||', 'return !!adopted ||', ['lib', 'note']],
  [LIB, 'the record is not the fallback', 'adopted === true || readIdList(store, deckImportDoneKey(userId)).includes(sessionId)', 'adopted === true', ['lib', 'note']],
  [LIB, 'note needs the record even with the marker', 'adopted === true || readIdList(store, deckImportDoneKey(userId)).includes(sessionId)', 'adopted === true && readIdList(store, deckImportDoneKey(userId)).includes(sessionId)', ['lib', 'note']],
  [POLICY, 'adoption reader keeps any source', "marker.source === 'deck_import' ? { source: 'deck_import' as const } : {}", "marker.source ? { source: marker.source as 'deck_import' } : {}", ['adoption']],
  [POLICY, 'adoption reader drops the marker', "...(marker.source === 'deck_import' ? { source: 'deck_import' as const } : {})", '', ['adoption']],
  [POLICY, 'adoption reader invents the marker', "marker.source === 'deck_import' ? { source: 'deck_import' as const } : {}", "{ source: 'deck_import' as const }", ['adoption']],
  [POLICY, 'adoption reader accepts another deck', 'marker.presentation_id !== presentationId', 'false', ['adoption']],
  [PAGE, 'page: note drawn without the flag', "process.env.NEXT_PUBLIC_STUDIO_DECK_IMPORT === 'true' && studioShell && !session.isLoadingSession && !!currentSessionId && currentSessionId !== 'new' && <StudioDeckImportNote", "studioShell && !session.isLoadingSession && !!currentSessionId && currentSessionId !== 'new' && <StudioDeckImportNote", ['adoption', 'blobs']],
  [PAGE, 'page: note drawn outside the shell', "'true' && studioShell && !session.isLoadingSession && !!currentSessionId && currentSessionId !== 'new' && <StudioDeckImportNote", "'true' && !session.isLoadingSession && !!currentSessionId && currentSessionId !== 'new' && <StudioDeckImportNote", ['adoption', 'blobs']],
  [PAGE, 'page: note drawn on the new-session address', " && currentSessionId !== 'new' && <StudioDeckImportNote", ' && <StudioDeckImportNote', ['adoption', 'blobs']],
  [PAGE, 'page: marker of any deck', ' && composerAdoption.presentation_id === effectivePresentationId} />}', '} />}', ['adoption', 'blobs']],
  [PAGE, 'page: marker read from another field', "composerAdoption?.source === 'deck_import'", "composerAdoption?.template_id === 'deck_import'", ['adoption', 'blobs']],
  [PAGE, 'page: note imported statically', "const StudioDeckImportNote = nextDynamic(() => import('@/components/studio-deck-import/studio-deck-import-note').then(module => module.StudioDeckImportNote), { ssr: false })", "const StudioDeckImportNote = (null as never)", ['adoption', 'blobs']],
  [PAGE, 'page: note rendered on the server', "module.StudioDeckImportNote), { ssr: false })", "module.StudioDeckImportNote))", ['adoption', 'blobs']],
  [NOTE, 'note for every session', 'visible = deckImportNoteVisible(window.localStorage, userId, sessionId, adopted)', 'visible = true', ['note']],
  [NOTE, 'note ignores the marker', 'visible = deckImportNoteVisible(window.localStorage, userId, sessionId, adopted)', 'visible = deckImportNoteVisible(window.localStorage, userId, sessionId, false)', ['note']],
  [NOTE, 'note without a marker when storage is blocked', "visible = adopted && !!userId && !!sessionId", 'visible = false', ['note']],
  [NOTE, 'note re-reads only once', '  }, [userId, sessionId, adopted])', '  }, [])', ['note']],
  [NOTE, 'the page cannot give it margins', ' className={className}>', '>', ['note']],
  [NOTE, 'dismissal not remembered', 'try { dismissDeckImportNote(window.localStorage, userId, sessionId) } catch { /* the note comes back next time */ }', '', ['note']],
  [NOTE, 'dismissal for every deck', 'dismissDeckImportNote(window.localStorage, userId, sessionId)', "dismissDeckImportNote(window.localStorage, userId, 'all')", ['note']],
  [NOTE, 'note stays after Got it', '        setShownFor(null)\n      }}>', '      }}>', ['note']],
  [NOTE, 'note without a role', 'role="note" ', '', ['note']],
  [NOTE, 'note asks the network', 'const { user } = useAuth()', "const { user } = useAuth(); fetch('/api/x')", ['note']],
  [NOTE, 'note for any session once it has a person', 'if (!userId || !sessionId || shownFor !== sessionId) return null', 'if (!userId || !sessionId) return null', ['note']],
  [FIRSTRUN, 'first run: link always drawn', 'process.env.NEXT_PUBLIC_STUDIO_DECK_IMPORT === "true" && <Link', 'true && <Link', ['builder', 'blobs']],
  [FIRSTRUN, 'first run: any value draws it', 'process.env.NEXT_PUBLIC_STUDIO_DECK_IMPORT === "true" && <Link', 'process.env.NEXT_PUBLIC_STUDIO_DECK_IMPORT !== "false" && <Link', ['builder', 'blobs']],
  [FIRSTRUN, 'first run: link goes elsewhere', 'href="/dashboard?import=pptx"', 'href="/dashboard"', ['builder', 'blobs']],
  [FIRSTRUN, 'first run: link in the wrong style', 'className="studio-first-run-link" data-studio-deck-import-builder', 'className="x" data-studio-deck-import-builder', ['builder', 'blobs']],
  [STAGE, 'stage: link always drawn', "process.env.NEXT_PUBLIC_STUDIO_DECK_IMPORT === 'true' && <Link", 'true && <Link', ['builder', 'blobs']],
  [STAGE, 'stage: any value draws it', "process.env.NEXT_PUBLIC_STUDIO_DECK_IMPORT === 'true' && <Link", "process.env.NEXT_PUBLIC_STUDIO_DECK_IMPORT !== 'false' && <Link", ['builder', 'blobs']],
  [STAGE, 'stage: link goes elsewhere', 'href="/dashboard?import=pptx"', 'href="/dashboard"', ['builder', 'blobs']],
  [CSS, 'css: note rule unanchored', '[data-studio-deck-import-note-dismiss="true"]:hover { color', '.dismiss:hover { color', ['static']],
  [CSS, 'css: note token that does not exist', 'border-left: 3px solid var(--sdi-accent)', 'border-left: 3px solid var(--sdi-nonexistent)', ['static']],
  [CSS, 'css: note has no dark tokens', '.dark [data-studio-deck-import-dialog="true"], .dark [data-studio-deck-import-note="true"] {', '.dark [data-studio-deck-import-dialog="true"] {', ['static']],
  [ENVFILE, 'env: the block is not before the Admin block', '# PASS2 ADMIN (', '# PASS2 ADMIN-X (', ['static']],
  [ENVFILE, 'env: the Builder link undocumented', '/dashboard?import=pptx, which opens the same dialog', '/dashboard, which opens the same dialog', ['static']],
  [ENVFILE, 'env: the note undocumented', 'Changing the theme and Add Element are not available for imported decks yet.', 'Changing the theme is not available.', ['static']],
  // the layout
  [LAYOUT, 'layout: flag ignored', ' || process.env.NEXT_PUBLIC_STUDIO_DECK_IMPORT !== "true"', '', ['layout']],
  [LAYOUT, 'layout: shell ignored', 'process.env.NEXT_PUBLIC_STUDIO_V4_SHELL !== "true" || ', '', ['layout']],
  [LAYOUT, 'layout: wrapper when off', 'return <>{children}</>\n  return', 'return <div>{children}</div>\n  return', ['layout']],
  [LAYOUT, 'layout: button below the page', '<StudioDeckImportEntryGate />\n    {children}', '{children}\n    <StudioDeckImportEntryGate />', ['layout']],
  [LAYOUT, 'layout: imports the button itself', 'import type { ReactNode } from "react"\n', 'import type { ReactNode } from "react"\nimport { StudioDeckImportEntry } from "@/components/studio-deck-import/studio-deck-import-entry"\n', ['layout']],
  [GATE, 'gate: button client only', 'module.StudioDeckImportEntry))\n', 'module.StudioDeckImportEntry), { ssr: false })\n', ['layout']],
  [GATE, 'gate: button loads the note', 'import("./studio-deck-import-entry")', 'import("./studio-deck-import-note")', ['layout']],
  [GATE, 'gate: static import of the button', 'import dynamic from "next/dynamic"\n', 'import dynamic from "next/dynamic"\nimport { StudioDeckImportEntry } from "./studio-deck-import-entry"\n', ['layout']],
  [GATE, 'gate: not a client module', '"use client"\n', '', ['layout']],
  // the sheet, the example and the manifest
  [CSS, 'css: an unanchored rule', '[data-studio-deck-import-hint="true"], [data-studio-deck-import-detail="true"]', '.hint, [data-studio-deck-import-detail="true"]', ['static']],
  [CSS, 'css: forced', 'font-size: 12px; box-shadow: none; white-space: nowrap;', 'font-size: 12px !important; box-shadow: none; white-space: nowrap;', ['static']],
  [CSS, 'css: a token that does not exist', 'background: var(--sdi-error-bg); color: var(--sdi-danger); font-size: 12px;', 'background: var(--sdi-nonexistent); color: var(--sdi-danger); font-size: 12px;', ['static']],
  [CSS, 'css: dark misses a token', '--sdi-error-bg: #322728;', '', ['static']],
  [ENVFILE, 'env: default on', `${FLAG}="false"`, `${FLAG}="true"`, ['static']],
  [ENVFILE, 'env: undocumented', `${FLAG}="false"`, `${FLAG}_X="false"`, ['static']],
  [ENVFILE, 'env: names the helper\'s flag as a setting', 'NEXT_PUBLIC_STUDIO_DECK_IMPORT="false"', 'DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED="false"\nNEXT_PUBLIC_STUDIO_DECK_IMPORT="false"', ['static']],
  [ENVFILE, 'env: claims AI', 'The import calls no AI model.', 'The import calls an AI model.', ['static']],
  [ENVFILE, 'env: an unlisted change to the example', 'NEXT_PUBLIC_STUDIO_KG_ASK="false"\n', 'NEXT_PUBLIC_STUDIO_KG_ASK="false" # changed\n', ['static']],
  [PKG, 'package: script renamed', '"test:studio-deck-import": "node scripts/test-studio-deck-import.mjs"', '"test:studio-deck-imports": "node scripts/test-studio-deck-import.mjs"', ['static']],
  [DASHBOARD, 'page: touched', 'export default function DashboardPage', 'export default function DashboardPage2', ['blobs']],
]
const missing = M.filter(([file, , from]) => !(OVERFILE(file)).includes(from)).map(([file, name]) => `${file}: ${name}`)
function OVERFILE(file) { return read(file) }
assert.deepEqual(missing, [], `mutants whose text is not in the source: ${missing.join('; ')}`)
const survivors = []
const stray = []
const crashKills = []
let killed = 0
for (const [file, name, from, to, sections] of M) {
  const source = read(file)
  const mutated = source.replace(from, () => to)
  assert.notEqual(mutated, source, `mutant "${name}" changes the source`)
  try { await proveAll({ [file]: mutated }, sections); survivors.push(`${file}: ${name}`) }
  catch (error) {
    // killed by an assertion, or by the code under test failing on the mutated input (a TypeError inside lib/hook/route, matched by name: an error made inside the vm is not an
    // instance of this realm's classes); never by a source that no longer compiles, never by the harness itself
    const assertion = error?.code === 'ERR_ASSERTION'
    if (!(assertion || ['TypeError', 'ReferenceError'].includes(error?.name)) || / compiles$/.test(String(error?.message))) { stray.push(`${file}: ${name}: ${String(error?.stack ?? error).split('\n').slice(0, 3).join(' | ')}`); continue }
    killed++
    if (!assertion) crashKills.push(name)
  }
}
counting = true
assert.deepEqual(stray, [], `mutants that broke the harness or the source instead of a check: ${stray.join('\n')}`)
assert.deepEqual(survivors, [], `mutants survived: ${survivors.join('; ')}`)
eq(killed, M.length)
checks = realChecks + 1
console.log(`Studio deck import: ${realChecks} checks passed in ${realMs} ms, ${killed}/${M.length} mutants killed (${crashKills.length} by the code under test failing on the mutated input: ${crashKills.join('; ') || 'none'}); no network.`)
process.exit(0)
