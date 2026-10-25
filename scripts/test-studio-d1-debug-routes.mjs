// FRONTEND-2 (25 Oct 2026): proof for D1, the prod security hotfix PK approved at 12:28Z. NO flag (a security fix, PK's ruling). The same change is PR-main's; its proof there is scripts/test-d1-debug-routes.mjs.
// Run: node scripts/test-studio-d1-debug-routes.mjs   (plain node: the route is transpiled with typescript and run in a vm with next/server, next-auth, prisma and the environment stubbed; `git` reads the base commit and the
// committed diff; no network, no server, no database, no real secret: the values below are made-up placeholders)
//   1. deleted   app/api/debug/check-env/route.ts and app/api/test-env/route.ts are gone (on disk and at HEAD); the two reviewed debug/dev routes are the base's, byte for byte; nothing in app/, components/, lib/, hooks/,
//                middleware.ts, next.config, vercel.json links the removed routes, and the files that still name them are exactly the known ones (reported, not edited)
//   2. route     the cleanup-sessions route is the base's file plus the three D1 blocks, each once, in place; isAdmin is the coupons route's, byte for byte; POST's text is the base's; the dev guard stays first in GET and
//                POST; the route reads CRON_SECRET, DEV_BYPASS_EMAIL and its old threshold variable, nothing else
//   3. GET       no auth, a wrong bearer, an empty or unset CRON_SECRET with "Bearer " / "Bearer undefined", a non-admin, an email-less session, a failing session lookup: 401 { error: 'Unauthorized' } with no database
//                access at all; the cron's bearer, or an admin session: 200 with the base route's dry-run body; the dev deployment: 404 before any of it
//   4. POST      the base POST and this POST, run side by side in the same worlds, answer the same and touch the database the same (an admin session does NOT open POST)
//   5. change    the strip, the registry (two lines: the files just before PR F's, the strip after it), scope (the COMMITTED diff only, BASE..HEAD), no credential-shaped literal
//   6. mutants   each one must make sections 1-5 fail
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import {
  BASE_COMMIT, D1_BLOCKS, D1_DELETED, D1_GATE, D1_REMOVED_ROUTES, D1_HELPERS, D1_IMPORTS, D1_NEW_FILES, D1_OWN_EDITS, D1_ROUTE, D1_SCOPE_FILES, D1_SUBJECT, stripD1DebugRoutes,
} from './studio-d1-debug-routes-strip.mjs'
import { LATER_CHANGE_FILES, LATER_ENV_BLOCKS, LATER_STRIPS, stripLaterChanges } from './studio-later-changes.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.env.D1_DEBUG_ROUTES_BASE || BASE_COMMIT
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
const gitOk = (...args) => { try { git(...args); return true } catch { return false } }
const baseCache = new Map()
const baseOf = rel => { if (!baseCache.has(rel)) baseCache.set(rel, git('show', `${BASE}:${rel}`)); return baseCache.get(rel) }
let overrides = {} // in-memory mutations: rel -> text (a file that is there), or null (a file that is gone)
const read = rel => (rel in overrides ? overrides[rel] : fs.readFileSync(path.join(root, rel), 'utf8'))
const exists = rel => (rel in overrides ? overrides[rel] !== null : fs.existsSync(path.join(root, rel)))

let checks = 0
const count = fn => (...args) => { checks++; return fn(...args) }
const eq = count(assert.equal), deep = count(assert.deepEqual), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch)

const REGISTRY = 'scripts/studio-later-changes.mjs', PROOF = 'scripts/test-studio-d1-debug-routes.mjs', STRIP = 'scripts/studio-d1-debug-routes-strip.mjs'
const COUPONS = 'app/api/admin/coupons/route.ts', DEV_HELPER = 'lib/dev-deployment.ts'
// reviewed and left alone: debug/env answers 403 outside NODE_ENV=development; dev/mock-token answers 403 unless NODE_ENV=development or NEXT_PUBLIC_DEV_MODE=true (and 404 on the dev deployment)
const KEPT = ['app/api/debug/env/route.ts', 'app/api/dev/mock-token/route.ts']
// the files that still name a removed route at HEAD, all reported and none edited: an archived plan, and two older pins that already fail on the base (the dev-deployment pin's baseline commit is not in this clone; the
// dev-server pin needs a running server); and this change's own two scripts
const KNOWN_LINKS = ['docs/archive/old-plans/CODE_ARCHIVE_PLAN.md', 'scripts/test-studio-dev-deployment.mjs', 'scripts/test-studio-dev-server.mjs', STRIP, PROOF].sort()
const LINK = /(?<![\w-])(check-env|test-env)(?![\w-])/
const APP_DIRS = ['app', 'components', 'lib', 'hooks']
const APP_FILES = ['middleware.ts', 'next.config.mjs', 'next.config.js', 'next.config.ts', 'vercel.json']

// ---------------------------------------------------------------- 1. deleted
// a route per app/**/page|route file, route groups dropped (the same rule as the legal-short-links proof)
const routesOf = files => [...new Set(files
  .filter(file => /^app\/(.*\/)?(page|route)\.(tsx|ts|jsx|js)$/.test(file))
  .map(file => '/' + file.replace(/^app\//, '').replace(/(^|\/)(page|route)\.\w+$/, '').split('/').filter(segment => segment && !/^\(.*\)$/.test(segment)).join('/')))].sort()
function proveDeleted() {
  for (const rel of D1_DELETED) {
    ok(!exists(rel), `deleted: ${rel} is not on disk`)
    ok(!exists(path.dirname(rel)) || rel in overrides, `deleted: its folder ${path.dirname(rel)} is gone too`)
    ok(!gitOk('cat-file', '-e', `HEAD:${rel}`), `deleted: ${rel} is not in the committed tree`)
    ok(gitOk('cat-file', '-e', `${BASE}:${rel}`), `deleted: ${rel} was in the base`)
  }
  for (const rel of KEPT) eq(read(rel), baseOf(rel), `deleted: ${rel} (reviewed, left alone) is the base's, byte for byte`)
  // the route list (the committed trees, with any in-memory mutation applied): the base's routes minus HEAD's are exactly D1's two (routes a later change ADDS, like #512's /terms and /privacy, are not removals)
  const appFiles = ref => git('ls-tree', '-r', '--name-only', ref, '--', 'app').split('\n').filter(Boolean)
  const headFiles = new Set(appFiles('HEAD'))
  for (const [rel, text] of Object.entries(overrides)) if (rel.startsWith('app/')) { if (text === null) headFiles.delete(rel); else headFiles.add(rel) }
  const before = routesOf(appFiles(BASE)), after = routesOf([...headFiles])
  deep(before.filter(route => !after.includes(route)), D1_REMOVED_ROUTES, 'deleted: the route list loses exactly /api/debug/check-env and /api/test-env')
  deep(routesOf(D1_DELETED), D1_REMOVED_ROUTES, 'deleted: and those are the routes the two deleted files served')
  let committed = ''
  try { committed = git('grep', '-l', '-I', '-E', '(^|[^A-Za-z0-9_-])(check-env|test-env)([^A-Za-z0-9_-]|$)', 'HEAD', '--', '.', ':!pnpm-lock.yaml', ':!package-lock.json') } catch { committed = '' }
  const links = new Set(committed.split('\n').filter(Boolean).map(line => line.replace(/^HEAD:/, '')))
  for (const [rel, text] of Object.entries(overrides)) if (typeof text === 'string' && LINK.test(text)) links.add(rel); else if (text === null) links.delete(rel)
  deep([...links].sort(), KNOWN_LINKS, 'deleted: the files that name a removed route are exactly the known ones')
  for (const rel of links) ok(!APP_DIRS.some(dir => rel.startsWith(`${dir}/`)) && !APP_FILES.includes(rel), `deleted: ${rel} is not app code`)
  for (const rel of APP_FILES) if (exists(rel)) nomatch(read(rel), LINK, `deleted: ${rel} names no removed route`)
}

// ---------------------------------------------------------------- 2. route text
const sectionOf = (text, name) => {
  const at = text.indexOf(`export async function ${name}(`)
  assert.ok(at !== -1, `${name} is exported`)
  const next = text.indexOf('\nexport async function ', at + 1)
  return text.slice(at, next === -1 ? text.length : next)
}
const DEV_GUARD = "  if (isStudioDevDeployment()) {\n    return NextResponse.json({ error: 'Not found' }, { status: 404 })\n  }\n"
const importsOf = text => ts.createSourceFile('route.ts', text, ts.ScriptTarget.Latest, true).statements.filter(ts.isImportDeclaration).map(s => s.moduleSpecifier.text)
function proveRoute() {
  const head = read(D1_ROUTE), base = baseOf(D1_ROUTE)
  for (const [i, block] of D1_BLOCKS.entries()) eq(head.split(block).length - 1, 1, `route: D1 block ${i + 1} is in the route exactly once`)
  eq(stripD1DebugRoutes(D1_ROUTE, head), base, 'route: without the three D1 blocks the route is the base\'s file, byte for byte')
  ok(head.startsWith(`import { NextRequest, NextResponse } from 'next/server'\n${D1_IMPORTS}import { prisma } from '@/lib/prisma'\n`), 'route: the two imports sit right after next/server')
  ok(head.includes(`  10\n)\n\n${D1_HELPERS}/**\n * GET - Dry run mode\n`), 'route: the check sits right after ABANDONMENT_THRESHOLD_HOURS, before GET')
  const get = sectionOf(head, 'GET'), post = sectionOf(head, 'POST')
  ok(get.startsWith(`export async function GET(req: NextRequest) {\n${DEV_GUARD}  try {\n${D1_GATE}    const cutoffTime = new Date(\n`), 'route: GET runs the dev guard, then the D1 gate, before anything else')
  ok(get.indexOf(D1_GATE) !== -1 && get.indexOf(D1_GATE) < get.indexOf('prisma.'), 'route: the gate comes before GET\'s first database call')
  eq((head.match(/canReadDryRun\(/g) ?? []).length, 2, 'route: canReadDryRun is defined once and called once')
  ok(!post.includes('canReadDryRun') && !post.includes('getServerSession') && !post.includes('isAdmin'), 'route: POST does not use the new check')
  eq(post, sectionOf(base, 'POST'), 'route: POST\'s text is the base\'s, byte for byte')
  ok(post.startsWith(`export async function POST(req: NextRequest) {\n${DEV_GUARD}`), 'route: the dev guard is still first in POST')
  const isAdminOf = text => (text.match(/\nfunction isAdmin\(email: string \| null \| undefined\): boolean \{\n[^\n]*\n\}\n/) ?? [])[0]
  ok(isAdminOf(head) !== undefined, 'route: isAdmin is there')
  eq(isAdminOf(head), isAdminOf(read(COUPONS)), 'route: isAdmin is the coupons route\'s, byte for byte')
  deep([...new Set([...head.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map(m => m[1]))].sort(), ['CRON_SECRET', 'DEV_BYPASS_EMAIL', 'SESSION_CLEANUP_THRESHOLD_HOURS'], 'route: it reads CRON_SECRET, DEV_BYPASS_EMAIL and the threshold, and no flag')
  deep(importsOf(head), ['next/server', 'next-auth', '@/lib/auth-options', '@/lib/prisma', '@/lib/dev-deployment'], 'route: imports are the base\'s plus next-auth and the session options (the coupons route\'s)')
  deep(importsOf(base), ['next/server', '@/lib/prisma', '@/lib/dev-deployment'], 'route: the base imported next/server, prisma and the dev guard')
}

// ---------------------------------------------------------------- 3 + 4. the route, run
const FIXED_NOW = Date.UTC(2026, 9, 25, 12, 0, 0)
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [FIXED_NOW])) }
  static now() { return FIXED_NOW }
}
const hoursAgo = h => new Date(FIXED_NOW - h * 3600 * 1000)
const ROWS = [
  { id: 'session-placeholder-1', userId: 'user-placeholder-1', createdAt: hoursAgo(50), geminiStoreName: null, uploadedFiles: [{ id: 'file-1', fileName: 'one.pdf', fileSize: 2048, geminiFileUri: null, geminiStoreName: null }] },
  { id: 'session-placeholder-2', userId: 'user-placeholder-2', createdAt: hoursAgo(30), geminiStoreName: 'store-placeholder', uploadedFiles: [] },
]
const CRON = 'test-cron-secret-placeholder', ADMIN = 'd1-admin@example.test', OTHER = 'd1-someone-else@example.test'
const AUTH_OPTIONS = { placeholder: 'authOptions' }
const transpile = source => {
  const out = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true })
  assert.equal(out.diagnostics?.length || 0, 0, 'transpiles without diagnostics')
  return out.outputText
}
function run(source, sandbox) {
  const module = { exports: {} }
  vm.runInNewContext(transpile(source), { module, exports: module.exports, console: { log() {}, info() {}, warn() {}, error() {} }, ...sandbox })
  return module.exports
}
function makePrisma(world) {
  const model = name => new Proxy({}, {
    get: (_, op) => async () => {
      world.db.push(`${name}.${String(op)}`)
      if (name === 'chatSession' && op === 'findMany') return world.rows
      if (op === 'deleteMany') return { count: world.rows.length }
      return null
    },
  })
  return new Proxy({}, { get: (_, name) => { world.touched++; return model(String(name)) } })
}
// a header object that hands back the exact string (a runtime that does not trim), and the real Headers (which trims "Bearer " to "Bearer")
const exactHeaders = value => ({ get: name => (String(name).toLowerCase() === 'authorization' && value !== undefined ? value : null) })
async function call(source, method, { env = {}, auth, session = null, sessionThrows = false, rows = ROWS, realHeaders = false } = {}) {
  const world = { env: { ...env }, session, sessionThrows, rows, db: [], touched: 0, lookups: 0 }
  const helper = run(read(DEV_HELPER), { process: { env: world.env } })
  const route = run(source, {
    process: { env: world.env },
    Date: FixedDate,
    require: name => {
      const deps = {
        'next/server': { NextResponse: { json: (body, init) => ({ body: JSON.parse(JSON.stringify(body)), status: init?.status ?? 200 }) } },
        'next-auth': {
          getServerSession: async options => {
            world.lookups++
            assert.equal(options, AUTH_OPTIONS, 'the session is read with the app\'s authOptions')
            if (world.sessionThrows) throw new Error('session lookup failed (test)')
            return world.session
          },
        },
        '@/lib/auth-options': { authOptions: AUTH_OPTIONS },
        '@/lib/prisma': { prisma: makePrisma(world) },
        '@/lib/dev-deployment': helper,
      }
      if (!Object.hasOwn(deps, name)) throw new Error(`Unexpected import ${name}`)
      return deps[name]
    },
  })
  const headers = realHeaders ? new Headers(auth === undefined ? {} : { authorization: auth }) : exactHeaders(auth)
  const result = await route[method]({ headers })
  return { status: result.status, body: result.body, db: world.db, touched: world.touched, lookups: world.lookups }
}
const UNAUTHORIZED = { error: 'Unauthorized' }
const sessionOf = email => ({ user: email === undefined ? { name: 'No Email' } : { name: 'Placeholder', email } })
// [label, options, status]; every 401 must also touch no database model at all
const GET_CASES = [
  ['no auth, CRON_SECRET set', { env: { CRON_SECRET: CRON } }, 401],
  ['no auth, nothing configured', { env: {} }, 401],
  ['a wrong bearer', { env: { CRON_SECRET: CRON }, auth: 'Bearer wrong-placeholder' }, 401],
  ['the secret without "Bearer "', { env: { CRON_SECRET: CRON }, auth: CRON }, 401],
  ['a lower-case "bearer "', { env: { CRON_SECRET: CRON }, auth: `bearer ${CRON}` }, 401],
  ['the bearer with a trailing space', { env: { CRON_SECRET: CRON }, auth: `Bearer ${CRON} ` }, 401],
  ['CRON_SECRET unset, "Bearer "', { env: {}, auth: 'Bearer ' }, 401],
  ['CRON_SECRET unset, "Bearer undefined"', { env: {}, auth: 'Bearer undefined' }, 401],
  ['CRON_SECRET unset, "Bearer undefined" (real Headers)', { env: {}, auth: 'Bearer undefined', realHeaders: true }, 401],
  ['CRON_SECRET empty, "Bearer "', { env: { CRON_SECRET: '' }, auth: 'Bearer ' }, 401],
  ['CRON_SECRET empty, "Bearer"', { env: { CRON_SECRET: '' }, auth: 'Bearer' }, 401],
  ['CRON_SECRET empty, "Bearer " (real Headers)', { env: { CRON_SECRET: '' }, auth: 'Bearer ', realHeaders: true }, 401],
  ['the correct bearer', { env: { CRON_SECRET: CRON }, auth: `Bearer ${CRON}` }, 200],
  ['the correct bearer (real Headers)', { env: { CRON_SECRET: CRON }, auth: `Bearer ${CRON}`, realHeaders: true }, 200],
  ['an admin session', { env: { DEV_BYPASS_EMAIL: ADMIN }, session: sessionOf(ADMIN) }, 200],
  ['an admin session with a wrong bearer', { env: { DEV_BYPASS_EMAIL: ADMIN, CRON_SECRET: CRON }, auth: 'Bearer wrong-placeholder', session: sessionOf(ADMIN) }, 200],
  ['a non-admin session', { env: { DEV_BYPASS_EMAIL: ADMIN, CRON_SECRET: CRON }, session: sessionOf(OTHER) }, 401],
  ['a non-admin session, no admin configured', { env: {}, session: sessionOf(OTHER) }, 401],
  ['an email-less session, no admin configured', { env: {}, session: sessionOf(undefined) }, 401],
  ['a null-email session, no admin configured', { env: {}, session: sessionOf(null) }, 401],
  ['an empty-email session, admin empty', { env: { DEV_BYPASS_EMAIL: '' }, session: sessionOf('') }, 401],
  ['a session with no user', { env: { DEV_BYPASS_EMAIL: ADMIN }, session: {} }, 401],
  ['the session lookup fails', { env: { DEV_BYPASS_EMAIL: ADMIN }, sessionThrows: true }, 401],
]
async function proveGet() {
  const source = read(D1_ROUTE)
  const expected = await call(baseOf(D1_ROUTE), 'GET', {})
  eq(expected.status, 200, 'GET: the base route answered the dry run to anyone (the exposure)')
  ok(expected.body.sessions.length === ROWS.length && expected.body.sessions[0].userId === ROWS[0].userId, 'GET: ... with session ids and owner ids')
  for (const [label, options, status] of GET_CASES) {
    const got = await call(source, 'GET', options)
    eq(got.status, status, `GET ${label}: ${status}`)
    if (status === 401) {
      deep(got.body, UNAUTHORIZED, `GET ${label}: the body is { error: 'Unauthorized' }`)
      eq(got.touched, 0, `GET ${label}: no database model is touched`)
    } else {
      deep(got.body, expected.body, `GET ${label}: the base route's dry-run body`)
      deep(got.db, ['chatSession.findMany'], `GET ${label}: one read, as before`)
    }
    if (options.auth === `Bearer ${CRON}` && options.env.CRON_SECRET === CRON) eq(got.lookups, 0, `GET ${label}: the cron is let in without a session lookup`)
  }
  for (const [label, options] of [
    ['no auth', { env: { STUDIO_V4_DEV_DEPLOYMENT: 'true', CRON_SECRET: CRON } }],
    ['an admin session', { env: { STUDIO_V4_DEV_DEPLOYMENT: 'true', DEV_BYPASS_EMAIL: ADMIN }, session: sessionOf(ADMIN) }],
    ['the correct bearer', { env: { STUDIO_V4_DEV_DEPLOYMENT: 'true', CRON_SECRET: CRON }, auth: `Bearer ${CRON}` }],
  ]) {
    const dev = await call(source, 'GET', options)
    deep([dev.status, dev.body, dev.touched, dev.lookups], [404, { error: 'Not found' }, 0, 0], `GET on the dev deployment, ${label}: 404 before the gate, the session and the database`)
  }
}
const POST_CASES = [
  ['CRON_SECRET unset', { env: {} }],
  ['CRON_SECRET unset, "Bearer undefined"', { env: {}, auth: 'Bearer undefined' }],
  ['CRON_SECRET empty, "Bearer "', { env: { CRON_SECRET: '' }, auth: 'Bearer ' }],
  ['a wrong bearer', { env: { CRON_SECRET: CRON }, auth: 'Bearer wrong-placeholder' }],
  ['an admin session, no bearer', { env: { CRON_SECRET: CRON, DEV_BYPASS_EMAIL: ADMIN }, session: sessionOf(ADMIN) }],
  ['the correct bearer, two rows', { env: { CRON_SECRET: CRON }, auth: `Bearer ${CRON}` }],
  ['the correct bearer, no rows', { env: { CRON_SECRET: CRON }, auth: `Bearer ${CRON}`, rows: [] }],
  ['the dev deployment', { env: { CRON_SECRET: CRON, STUDIO_V4_DEV_DEPLOYMENT: 'true' }, auth: `Bearer ${CRON}` }],
]
async function provePost() {
  const source = read(D1_ROUTE), base = baseOf(D1_ROUTE)
  const seen = []
  for (const [label, options] of POST_CASES) {
    const [mine, before] = [await call(source, 'POST', options), await call(base, 'POST', options)]
    deep({ ...mine, lookups: 0 }, { ...before, lookups: 0 }, `POST ${label}: the same answer and the same database calls as the base`)
    eq(mine.lookups, 0, `POST ${label}: no session lookup`)
    seen.push(mine.status)
  }
  deep(seen, [500, 500, 500, 401, 401, 200, 200, 404], 'POST: misconfigured 500, refused 401, the real delete 200, the dev deployment 404 (as before)')
}

// ---------------------------------------------------------------- 5. the change
function proveChange() {
  // the strip
  eq(stripD1DebugRoutes('app/api/admin/coupons/route.ts', D1_GATE), D1_GATE, 'strip: any other file comes back as it is')
  eq(stripD1DebugRoutes(D1_ROUTE, 7), 7, 'strip: a non-string comes back')
  eq(stripD1DebugRoutes(D1_ROUTE, `a\n${D1_GATE}b\n${D1_GATE}`), `a\n${D1_GATE}b\n${D1_GATE}`, 'strip: a block that is there twice is left alone')
  eq(stripLaterChanges(D1_ROUTE, read(D1_ROUTE)), baseOf(D1_ROUTE), 'strip: through the registry, the route reads as the base\'s')
  // the registry: two lines, after PR F's, nothing in the env blocks
  const registry = read(REGISTRY)
  const lines = registry.split('\n').filter(line => line.includes("'./studio-d1-debug-routes-strip.mjs'"))
  eq(lines.length, 2, 'registry: exactly two lines for this change: its files and its strip (no .env.example block)')
  ok(lines.every(line => line.includes('// LATER-CHANGE: FRONTEND-2, D1 security hotfix')), 'registry: each carries the LATER-CHANGE marker')
  match(lines[0], /^ {2}\.\.\.\(await import\('\.\/studio-d1-debug-routes-strip\.mjs'\)\)\.D1_SCOPE_FILES,/, 'registry: line 1 is the files')
  match(lines[1], /^ {2}\(await import\('\.\/studio-d1-debug-routes-strip\.mjs'\)\)\.stripD1DebugRoutes,/, 'registry: line 2 is the strip')
  const at1 = registry.indexOf(lines[0]), at2 = registry.indexOf(lines[1])
  const files = registry.indexOf('export const LATER_CHANGE_FILES'), blocks = registry.indexOf('export const LATER_ENV_BLOCKS'), strips = registry.indexOf('export const LATER_STRIPS')
  ok(files < at1 && at1 < blocks && strips < at2, 'registry: the files line is in LATER_CHANGE_FILES, the strip line in LATER_STRIPS')
  const fFiles = registry.indexOf("'./studio-pass3-polish-f-strip.mjs')).PASS3_POLISH_F_SCOPE_FILES"), fStrip = registry.indexOf("'./studio-pass3-polish-f-strip.mjs')).stripPass3PolishF")
  ok(fFiles > 0 && at1 < fFiles && registry.indexOf('\n', at1) + 1 === registry.lastIndexOf('\n', fFiles) + 1, 'registry: the files line sits just before PR F\'s (never at the insertion point after it, which #512 uses)')
  ok(fStrip > 0 && fStrip < at2, 'registry: the strip line comes after PR F\'s (strips run in stacking order)')
  ok(!registry.slice(blocks, strips).includes('studio-d1-debug-routes-strip'), 'registry: nothing of this change is in LATER_ENV_BLOCKS')
  ok(LATER_STRIPS.includes(stripD1DebugRoutes), 'registry: the registry holds the strip')
  ok([...D1_SCOPE_FILES].every(rel => LATER_CHANGE_FILES.has(rel)), 'registry: the registry names every file of this change')
  ok(!LATER_ENV_BLOCKS.some(block => /D1 security hotfix|CRON_SECRET/.test(String(block))), 'registry: no env block')
  deep([...D1_SCOPE_FILES].sort(), [D1_ROUTE, ...D1_DELETED, ...D1_NEW_FILES, ...D1_OWN_EDITS].sort(), 'scope: the change is the route, the two deleted routes, its two scripts, the registry and four FRONTEND-2 pins\' tolerances')
}
function proveScope() {
  // the COMMITTED diff only (BASE..HEAD): the working tree is never consulted (the suite writes into docs/)
  const own = new Set(), all = new Set()
  for (const block of git('log', '--no-merges', '--name-only', '--format=%x01%s', `${BASE}..HEAD`).split('\x01').filter(Boolean)) {
    const [subject, ...names] = block.split('\n')
    for (const name of names) if (name) { all.add(name); if (D1_SUBJECT.test(subject)) own.add(name) }
  }
  deep([...own].sort(), [...D1_SCOPE_FILES].sort(), 'scope: the D1 commits touch exactly the D1 files')
  ok([...all].every(rel => LATER_CHANGE_FILES.has(rel)), `scope: every file committed since the base is a registered change's (strays: ${[...all].filter(rel => !LATER_CHANGE_FILES.has(rel)).join(', ') || 'none'})`)
  // each file's status in the FIRST D1 commit that touches it (D1's own commits, oldest first): a file another change added after the base (#512's proof) is one D1 modifies
  const status = {}
  for (const block of git('log', '--reverse', '--no-merges', '--no-renames', '--name-status', '--format=%x01%s', `${BASE}..HEAD`).split('\x01').filter(Boolean)) {
    const [subject, ...lines] = block.split('\n')
    if (D1_SUBJECT.test(subject)) for (const line of lines.filter(Boolean)) { const [code, rel] = line.split('\t'); if (!(rel in status)) status[rel] = code }
  }
  deep(Object.fromEntries([...D1_SCOPE_FILES].sort().map(rel => [rel, status[rel]])), Object.fromEntries([...D1_SCOPE_FILES].sort().map(rel => [rel, D1_DELETED.includes(rel) ? 'D' : D1_NEW_FILES.includes(rel) ? 'A' : 'M'])), 'scope: the two routes deleted, the two scripts added, the route, the registry and the pins modified')
  // no credential-shaped literal in what this change adds (the patterns are built from pieces so this file does not match itself)
  const shapes = [['sk', '_(live|test)_[A-Za-z0-9]{8,}'], ['gh', 'p_[A-Za-z0-9]{20,}'], ['AK', 'IA[0-9A-Z]{16}'], ['-----BEGIN [A-Z ]*PRI', 'VATE KEY-----'], ['ey', 'J[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}'], ['xo', 'x[abps]-[A-Za-z0-9-]{10,}']].map(([a, b]) => new RegExp(a + b))
  const added = git('diff', '--no-renames', BASE, 'HEAD', '--', ...D1_SCOPE_FILES).split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++')).join('\n')
  for (const shape of shapes) nomatch(added, shape, `scope: no ${shape.source.slice(0, 6)}... literal is added`)
  ok(/placeholder/.test(CRON) && /\.test$/.test(ADMIN) && /\.test$/.test(OTHER), 'scope: the test values are placeholders')
}

// ---------------------------------------------------------------- run, then the mutants
async function prove() {
  proveDeleted()
  proveRoute()
  await proveGet()
  await provePost()
  proveChange()
}
await prove()
proveScope()
const proved = checks

const ROUTE_TEXT = read(D1_ROUTE)
const swap = (from, to) => { assert.ok(ROUTE_TEXT.split(from).length === 2, `mutant anchor is unique: ${from.slice(0, 60)}`); return { [D1_ROUTE]: ROUTE_TEXT.replace(from, to) } }
const FIND = '    })\n\n    const sessionDetails = '
const MUTANTS = [
  ['drop the check', swap(D1_GATE, '')],
  ['invert the check', swap('    if (!(await canReadDryRun(req))) {', '    if (await canReadDryRun(req)) {')],
  ['allow an empty secret', swap("  if (cronSecret && req.headers.get('authorization')", "  if (req.headers.get('authorization')")],
  ['allow an empty-string secret', swap("  if (cronSecret && req.headers.get('authorization')", "  if (cronSecret !== undefined && req.headers.get('authorization')")],
  ['any signed-in user', swap('  return !!session?.user && isAdmin(session.user.email)', '  return !!session?.user')],
  ['no admin path', swap('  return !!session?.user && isAdmin(session.user.email)', '  return false')],
  ['isAdmin without the email guard', swap('  return !!email && email === process.env.DEV_BYPASS_EMAIL', '  return email === process.env.DEV_BYPASS_EMAIL')],
  ['a failing session lookup is not caught', swap('  const session = await getServerSession(authOptions).catch(() => null)', '  const session = await getServerSession(authOptions)')],
  ['the check after the query', { [D1_ROUTE]: ROUTE_TEXT.replace(D1_GATE, '').replace(FIND, `    })\n\n${D1_GATE}    const sessionDetails = `) }],
  ['the dev guard after the gate', { [D1_ROUTE]: ROUTE_TEXT.replace(`export async function GET(req: NextRequest) {\n${DEV_GUARD}  try {\n${D1_GATE}`, `export async function GET(req: NextRequest) {\n  try {\n${D1_GATE}${DEV_GUARD}`) }],
  ['POST opened to admins', swap('    if (authHeader !== `Bearer ${expectedSecret}`) {', '    if (authHeader !== `Bearer ${expectedSecret}` && !(await canReadDryRun(req))) {')],
  ['POST check dropped', swap('    if (authHeader !== `Bearer ${expectedSecret}`) {', '    if (false) {')],
  ['check-env restored', { [D1_DELETED[0]]: baseOf(D1_DELETED[0]) }],
  ['test-env restored', { [D1_DELETED[1]]: baseOf(D1_DELETED[1]) }],
  ['a new link to a removed route', { 'lib/d1-mutant-link.ts': "export const probe = () => fetch('/api/test-env')\n" }],
  ['a reviewed route touched', { [KEPT[0]]: `${baseOf(KEPT[0])}// touched\n` }],
  ['another route removed', { 'app/api/version/route.ts': null }],
  ['the coupons isAdmin drifts', { [COUPONS]: read(COUPONS).replace('  return !!email && email === process.env.DEV_BYPASS_EMAIL', '  return !!email && email.toLowerCase() === process.env.DEV_BYPASS_EMAIL') }],
  ['a new flag read', swap('  const cronSecret = process.env.CRON_SECRET\n', "  const cronSecret = process.env.NEXT_PUBLIC_D1_GATE === 'off' ? '' : process.env.CRON_SECRET\n")],
  ['the registry loses the strip line', { [REGISTRY]: read(REGISTRY).split('\n').filter(line => !line.includes('.stripD1DebugRoutes, // LATER-CHANGE')).join('\n') }],
  ['the files line after PR F\'s (#512\'s insertion point)', { [REGISTRY]: (lines => { const at = lines.findIndex(line => line.includes('.D1_SCOPE_FILES, // LATER-CHANGE')); const [mine] = lines.splice(at, 1); lines.splice(at + 1, 0, mine); return lines.join('\n') })(read(REGISTRY).split('\n')) }],
]
// the mutants of the route's code must ALSO be caught by running it (sections 3 and 4 alone), not only by its text
const BEHAVIOURAL = new Set(['drop the check', 'invert the check', 'allow an empty secret', 'allow an empty-string secret', 'any signed-in user', 'no admin path', 'isAdmin without the email guard',
  'a failing session lookup is not caught', 'the check after the query', 'the dev guard after the gate', 'POST opened to admins', 'POST check dropped'])
const fails = async fn => { try { await fn() } catch { return true } return false }
let killed = 0, killedByRunning = 0
for (const [name, mutation] of MUTANTS) {
  overrides = mutation
  const failed = await fails(prove)
  const failedRunning = BEHAVIOURAL.has(name) ? await fails(async () => { await proveGet(); await provePost() }) : false
  overrides = {}
  assert.ok(failed, `mutant survived: ${name}`)
  killed++
  if (BEHAVIOURAL.has(name)) { assert.ok(failedRunning, `mutant survived the run of the route: ${name}`); killedByRunning++ }
}
await prove() // and clean again
console.log(`D1 debug routes (dev): ${proved} checks passed, ${killed}/${MUTANTS.length} mutants killed (${killedByRunning}/${BEHAVIOURAL.size} of the code mutants also by running the route); no network, no server, no database, no real secret.`)
