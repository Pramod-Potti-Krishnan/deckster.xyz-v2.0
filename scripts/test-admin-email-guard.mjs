/**
 * Admin users routes: the admin check needs a NON-EMPTY session email that equals a NON-EMPTY
 * DEV_BYPASS_EMAIL (GET /api/admin/users and POST /api/admin/users/approve).
 *
 * The bug this guards against: `session.user.email === process.env.DEV_BYPASS_EMAIL` is
 * `undefined === undefined` when the variable is not set and the session carries no email, so
 * a signed-in session without an email passed as admin. The coupon routes already guard with
 * `!!email && email === process.env.DEV_BYPASS_EMAIL`; the users routes now match that form.
 *
 * Offline and keyless: the auth session, the database and the environment are stubs defined in
 * this file (the addresses below are made-up .test strings), and the two real route files are
 * compiled and run unchanged. A route may also import lib/studio-p2-admin.ts (the NEXT_PUBLIC_STUDIO_P2_ADMIN
 * flag test and query helpers): that file is import-free and is compiled and run for real, not stubbed. Mutation checks recompile each route with its guard removed and
 * require the same scenarios to fail. No git, no network, no real account.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const USERS_ROUTE = 'app/api/admin/users/route.ts'
const APPROVE_ROUTE = 'app/api/admin/users/approve/route.ts'
const ADMIN_EMAIL = 'admin-guard-test@example.test'
const OTHER_EMAIL = 'someone-else@example.test'
const GUARD = '!!session.user.email && '

let checks = 0
const ok = (cond, label) => { assert.ok(cond, label); checks += 1 }
const eq = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks += 1 }

const read = relative => fs.readFileSync(path.join(REPO, relative), 'utf8')
const transpile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

// The one project module a route may import besides the stubs below. It has no imports of its own, so it is run as it is: a stub would hide what the route takes from it. The environment is the route's
// (the flag arrives as an argument), and the file is only read when a route asks for it.
const REAL_MODULES = { '@/lib/studio-p2-admin': 'lib/studio-p2-admin.ts' }
const realExports = new Map()
function loadReal(name) {
  if (!realExports.has(name)) {
    const file = REAL_MODULES[name], module = { exports: {} }
    vm.runInNewContext(transpile(read(file)), {
      module,
      exports: module.exports,
      Date, Promise, Object, Error,
      require: dependency => { throw new Error(`${file} must have no imports of its own (${dependency})`) },
    })
    realExports.set(name, module.exports)
  }
  return realExports.get(name)
}

// ------------------------------------------------- the code under test
// One sandbox per load: its own env, session and fake database, so scenarios never leak.
function load(source) {
  const state = { session: null, env: {}, calls: [], errors: [] }
  const prisma = {
    user: {
      findMany: async args => { state.calls.push(['findMany', args]); return [{ id: 'u1', email: OTHER_EMAIL, approved: false }] },
      update: async args => {
        state.calls.push(['update', args])
        return { id: args.where.id, email: OTHER_EMAIL, approved: args.data.approved }
      },
    },
  }
  const imports = {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    'next-auth': { getServerSession: async () => state.session },
    '@/lib/auth-options': { authOptions: {} },
    '@/lib/prisma': { prisma },
  }
  const module = { exports: {} }
  vm.runInNewContext(transpile(source), {
    module,
    exports: module.exports,
    Date, Promise, Object, Error,
    process: { env: state.env },
    console: { error: (...args) => state.errors.push(args.map(String).join(' ')), log() {}, warn() {}, info() {} },
    require: name => {
      if (name in REAL_MODULES) return loadReal(name)
      if (!(name in imports)) throw new Error(`Unexpected import ${name}`)
      return imports[name]
    },
  })
  return { exports: module.exports, state }
}

// ------------------------------------------------- scenarios
// Each route is driven the same way; `call` returns the Response.
const ROUTES = {
  'GET /api/admin/users': {
    file: USERS_ROUTE,
    call: ({ exports }) => exports.GET({}),
    effects: state => state.calls.filter(([name]) => name === 'findMany').length,
  },
  'POST /api/admin/users/approve': {
    file: APPROVE_ROUTE,
    call: ({ exports }) => exports.POST({ json: async () => ({ userId: 'u1', approved: true }) }),
    effects: state => state.calls.filter(([name]) => name === 'update').length,
  },
}

const sessionWith = email => ({ user: email === undefined ? { name: 'No Email' } : { name: 'Test', email } })

// [label, env, session, expected status, expected database calls]
const SCENARIOS = [
  ['env unset, no session', {}, null, 401, 0],
  ['env unset, session without a user', {}, {}, 401, 0],
  ['env unset, session without an email', {}, sessionWith(undefined), 403, 0],
  ['env unset, session with a null email', {}, sessionWith(null), 403, 0],
  ['env unset, session with an empty email', {}, sessionWith(''), 403, 0],
  ['env unset, session with an email', {}, sessionWith(OTHER_EMAIL), 403, 0],
  ['env empty, session without an email', { DEV_BYPASS_EMAIL: '' }, sessionWith(undefined), 403, 0],
  ['env empty, session with an empty email', { DEV_BYPASS_EMAIL: '' }, sessionWith(''), 403, 0],
  ['env empty, session with an email', { DEV_BYPASS_EMAIL: '' }, sessionWith(OTHER_EMAIL), 403, 0],
  ['env set, no session', { DEV_BYPASS_EMAIL: ADMIN_EMAIL }, null, 401, 0],
  ['env set, session without a user', { DEV_BYPASS_EMAIL: ADMIN_EMAIL }, {}, 401, 0],
  ['env set, matching email', { DEV_BYPASS_EMAIL: ADMIN_EMAIL }, sessionWith(ADMIN_EMAIL), 200, 1],
  ['env set, other email', { DEV_BYPASS_EMAIL: ADMIN_EMAIL }, sessionWith(OTHER_EMAIL), 403, 0],
  ['env set, session without an email', { DEV_BYPASS_EMAIL: ADMIN_EMAIL }, sessionWith(undefined), 403, 0],
  ['env set, session with a null email', { DEV_BYPASS_EMAIL: ADMIN_EMAIL }, sessionWith(null), 403, 0],
  ['env set, session with an empty email', { DEV_BYPASS_EMAIL: ADMIN_EMAIL }, sessionWith(''), 403, 0],
]

// Runs every scenario against one route's source and returns the labels that did not behave.
async function failures(routeName, source) {
  const route = ROUTES[routeName]
  const failed = []
  for (const [label, env, session, status, effects] of SCENARIOS) {
    const loaded = load(source)
    Object.assign(loaded.state.env, env)
    loaded.state.session = session
    let good = false
    try {
      const response = await route.call(loaded)
      const body = await response.json()
      good = response.status === status && route.effects(loaded.state) === effects
      if (good && status === 401) good = body.error === 'Unauthorized'
      if (good && status === 403) good = body.error === 'Forbidden - Admin access required'
      if (good && status === 200) good = route.effects(loaded.state) === 1 && loaded.state.errors.length === 0
    } catch {
      good = false
    }
    if (!good) failed.push(label)
  }
  return failed
}

// ================================================= 1. the real routes behave on every scenario
for (const routeName of Object.keys(ROUTES)) {
  const source = read(ROUTES[routeName].file)
  eq(await failures(routeName, source), [], `${routeName}: every scenario behaves`)
}

// ================================================= 2. what a granted admin gets
{
  const users = load(read(USERS_ROUTE))
  Object.assign(users.state.env, { DEV_BYPASS_EMAIL: ADMIN_EMAIL })
  users.state.session = sessionWith(ADMIN_EMAIL)
  const response = await users.exports.GET({})
  eq(response.status, 200, 'GET users: admin gets 200')
  eq((await response.json()).users.length, 1, 'GET users: admin sees the user list')

  const approve = load(read(APPROVE_ROUTE))
  Object.assign(approve.state.env, { DEV_BYPASS_EMAIL: ADMIN_EMAIL })
  approve.state.session = sessionWith(ADMIN_EMAIL)
  const done = await approve.exports.POST({ json: async () => ({ userId: 'u9', approved: true }) })
  eq(done.status, 200, 'POST approve: admin gets 200')
  const [[, update]] = approve.state.calls
  eq(update.where.id, 'u9', 'POST approve: updates the requested user')
  eq(update.data.approvedBy, ADMIN_EMAIL, 'POST approve: records the admin as approver')
  const bad = await approve.exports.POST({ json: async () => ({ userId: 'u9' }) })
  eq(bad.status, 400, 'POST approve: an admin with a bad body still gets 400')
}

// ================================================= 3. mutation checks: removing the guard must fail
for (const routeName of Object.keys(ROUTES)) {
  const source = read(ROUTES[routeName].file)
  ok(source.includes(GUARD), `${routeName}: the guard text is present to mutate`)
  const guardless = source.replace(GUARD, '')
  ok(guardless !== source, `${routeName}: the mutation changed the source`)
  const failed = await failures(routeName, guardless)
  ok(failed.includes('env unset, session without an email'), `${routeName}: without the guard, env unset + no email is caught`)
  ok(failed.includes('env empty, session with an empty email'), `${routeName}: without the guard, env empty + empty email is caught`)
  // Removing the whole admin check, or flipping it, is caught too.
  const open = source.replace('if (!isAdmin) {', 'if (false) {')
  ok(open !== source, `${routeName}: the open-door mutation changed the source`)
  ok((await failures(routeName, open)).includes('env set, other email'), `${routeName}: without the admin check, another user is caught`)
}

// ================================================= 4. one form across the admin routes
// Every comparison with DEV_BYPASS_EMAIL under app/api/admin must be preceded by a truthiness
// check on the email being compared, like the coupon routes.
const walk = dir => fs.readdirSync(path.join(REPO, dir), { withFileTypes: true })
  .flatMap(entry => (entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]))
const adminFiles = walk('app/api/admin').filter(file => /\.tsx?$/.test(file))
let compared = 0
for (const file of adminFiles) {
  const source = read(file)
  for (const match of source.matchAll(/===\s*process\.env\.DEV_BYPASS_EMAIL/g)) {
    compared += 1
    const before = source.slice(0, match.index).split('\n').pop()
    ok(/!!\s*[\w.]+\s*&&\s*[\w.]+\s*$/.test(before), `${file}: DEV_BYPASS_EMAIL comparison is preceded by a non-empty check`)
  }
}
ok(compared >= 4, `found the admin comparisons (${compared}: 2 coupon routes + 2 users routes)`)

console.log(`admin email guard: ${checks} checks passed`)
