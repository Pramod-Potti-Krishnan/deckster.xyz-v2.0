import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

// Regression guard for two credential-handling rules:
//   1. /api/dev/mock-token mints a JWT only when the server-side NODE_ENV is
//      "development" and JWT_SECRET is configured. A public NEXT_PUBLIC_* flag
//      must never enable it, and there is no hard-coded fallback signing key.
//   2. No code logs a prefix (or any part) of a connection string or secret.
// Everything is exercised with stubs: no signing library, database or network.
const root = fileURLToPath(new URL('..', import.meta.url))
const read = (path) => readFileSync(join(root, path), 'utf8')
let checks = 0
const ok = (condition, message) => { assert.ok(condition, message); checks++ }
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); checks++ }

function load(source, { env, dependencies = {}, log = () => {} }) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  })
  assert.equal(compiled.diagnostics?.length || 0, 0)
  const exports = {}
  const sink = (...args) => log(args.map(String).join(' '))
  vm.runInNewContext(compiled.outputText, {
    exports,
    process: { env },
    require(name) {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected import ${name}`)
      return dependencies[name]
    },
    console: { log: sink, error: sink, warn: sink, info: sink, debug: sink },
    TextEncoder,
  })
  return exports
}

const nextServer = { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } }

// ---------------------------------------------------------------------------
// 1. Behaviour of the mock-token route.
// ---------------------------------------------------------------------------
const routePath = 'app/api/dev/mock-token/route.ts'
const routeSource = read(routePath)
const usesDevDeployment = routeSource.includes("@/lib/dev-deployment")

function mockTokenRoute(env) {
  const signing = { constructed: 0, secrets: [] }
  const dependencies = {
    'next/server': nextServer,
    jose: {
      SignJWT: class {
        constructor() { signing.constructed++ }
        setProtectedHeader() { return this }
        setExpirationTime() { return this }
        setIssuedAt() { return this }
        async sign(secret) { signing.secrets.push(Buffer.from(secret).toString('utf8')); return 'stub.jwt.token' }
      },
    },
  }
  if (usesDevDeployment) {
    dependencies['@/lib/dev-deployment'] = load(read('lib/dev-deployment.ts'), { env })
  }
  return { route: load(routeSource, { env, dependencies }), signing }
}
const request = { json: async () => ({ user_id: 'unit_user' }) }

// (a) Anything other than NODE_ENV=development refuses, even when the public flag
//     and a signing secret are both present.
for (const nodeEnv of [undefined, '', 'production', 'test', 'staging', 'Development']) {
  const env = { NEXT_PUBLIC_DEV_MODE: 'true', JWT_SECRET: 'unit-test-secret-not-real' }
  if (nodeEnv !== undefined) env.NODE_ENV = nodeEnv
  const { route, signing } = mockTokenRoute(env)
  for (const method of ['POST', 'GET']) {
    const result = await route[method](request)
    equal(result.status, 403, `${method} must refuse with NODE_ENV=${JSON.stringify(nodeEnv)} even when NEXT_PUBLIC_DEV_MODE=true`)
    ok(!('access_token' in result.body), `${method} must not return a token with NODE_ENV=${JSON.stringify(nodeEnv)}`)
  }
  equal(signing.constructed, 0, `no JWT may be constructed with NODE_ENV=${JSON.stringify(nodeEnv)}`)
}

// (a2) Development but no JWT_SECRET: refuse (no fallback key), regardless of the public flag.
for (const secret of [undefined, '']) {
  for (const publicFlag of [undefined, 'true']) {
    const env = { NODE_ENV: 'development' }
    if (secret !== undefined) env.JWT_SECRET = secret
    if (publicFlag !== undefined) env.NEXT_PUBLIC_DEV_MODE = publicFlag
    const { route, signing } = mockTokenRoute(env)
    for (const method of ['POST', 'GET']) {
      const result = await route[method](request)
      equal(result.status, 500, `${method} must refuse without JWT_SECRET (secret=${JSON.stringify(secret)})`)
      ok(!('access_token' in result.body), `${method} must not return a token without JWT_SECRET`)
    }
    equal(signing.constructed, 0, 'no JWT may be constructed without JWT_SECRET')
  }
}

// (a3) Local development with a configured secret still works and signs with that secret only.
{
  const { route, signing } = mockTokenRoute({ NODE_ENV: 'development', JWT_SECRET: 'unit-test-secret-not-real' })
  const post = await route.POST(request)
  equal(post.status, 200, 'POST must still mint in development with JWT_SECRET set')
  equal(post.body.access_token, 'stub.jwt.token', 'POST returns the signed token')
  equal(post.body.user_id, 'unit_user', 'POST echoes the requested user id')
  equal(signing.constructed, 1, 'exactly one JWT is signed')
  equal(signing.secrets[0], 'unit-test-secret-not-real', 'the token is signed with JWT_SECRET, not any other key')
  const get = await route.GET(request)
  equal(get.status, 200, 'GET reports availability in development with JWT_SECRET set')
}

if (usesDevDeployment) {
  // Studio dev deployments answer 404 before anything else, whatever the flags say.
  const { route, signing } = mockTokenRoute({
    STUDIO_V4_DEV_DEPLOYMENT: 'true', NODE_ENV: 'development', NEXT_PUBLIC_DEV_MODE: 'true', JWT_SECRET: 'unit-test-secret-not-real',
  })
  for (const method of ['POST', 'GET']) {
    const result = await route[method](request)
    equal(result.status, 404, `${method} stays 404 on the Studio dev deployment`)
  }
  equal(signing.constructed, 0, 'no JWT on the Studio dev deployment')
}

// (b) Static: no hard-coded key, no fallback after JWT_SECRET, no public-flag gate.
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const routeCode = stripComments(routeSource)
ok(!routeCode.includes('dev-secret-key'), 'the hard-coded fallback signing key must be gone from the route')
ok(!/JWT_SECRET\s*(\|\||\?\?)/.test(routeCode), 'JWT_SECRET must have no fallback expression')
ok(!routeCode.includes('NEXT_PUBLIC_DEV_MODE'), 'the route must not read NEXT_PUBLIC_DEV_MODE')
ok(/process\.env\.NODE_ENV\s*===\s*'development'/.test(routeCode), 'the route keeps its NODE_ENV=development gate')
ok(!/NEXT_PUBLIC_/.test(routeCode), 'the route must not read any NEXT_PUBLIC_* variable')

// ---------------------------------------------------------------------------
// 2. Repo-wide static scans (app/, lib/, components/, hooks/, middleware).
// ---------------------------------------------------------------------------
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  if (entry.name === 'node_modules' || entry.name === '.next') return []
  const full = join(dir, entry.name)
  if (entry.isDirectory()) return walk(full)
  return /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name) ? [full] : []
})
const scanned = ['app', 'lib', 'components', 'hooks'].filter((dir) => existsSync(join(root, dir)))
  .flatMap((dir) => walk(join(root, dir)))
if (existsSync(join(root, 'middleware.ts'))) scanned.push(join(root, 'middleware.ts'))
ok(scanned.length > 100, 'the source scan must actually cover the app')

const truncation = '\\.(?:substring|slice|substr)\\s*\\('
const rules = [
  ['a hard-coded dev signing key', /dev-secret-key-for-testing-only/],
  ['the public NEXT_PUBLIC_DEV_MODE flag', /NEXT_PUBLIC_DEV_MODE/],
  ['a truncated DATABASE_URL / DIRECT_URL', new RegExp(`\\b(?:DATABASE_URL|DIRECT_URL)\\b[^\\n]*${truncation}`)],
  ['a log of a truncated secret-bearing env value', new RegExp(`console\\.\\w+\\([^\\n]*process\\.env\\.[A-Z0-9_]*(?:URL|SECRET|KEY|TOKEN|PASSWORD)[A-Z0-9_]*\\??${truncation}`)],
  ['a log of a raw connection string', /console\.\w+\([^\n]*(?<!!)process\.env\.(?:DATABASE_URL|DIRECT_URL)\b/],
]
for (const file of scanned) {
  const rel = relative(root, file).split('\\').join('/')
  const code = stripComments(readFileSync(file, 'utf8'))
  for (const [label, pattern] of rules) {
    assert.equal(pattern.test(code), false, `${rel} must not contain ${label}`)
  }
  checks += rules.length
}

// ---------------------------------------------------------------------------
// 3. Runtime proof: neither module that used to print the prefix logs any of the URL.
// ---------------------------------------------------------------------------
const sentinelUrl = 'postgresql://sentinel-user:sentinel-pass@sentinel-host.invalid:6543/sentinel_db'
const forbiddenFragments = [sentinelUrl.slice(0, 8), 'sentinel', 'postgresql://']
const logged = []
const assertNoUrlLogged = (label) => {
  ok(logged.length > 0, `${label} must still log its configured/environment lines`)
  for (const line of logged) {
    for (const fragment of forbiddenFragments) {
      ok(!line.toLowerCase().includes(fragment.toLowerCase()), `${label} logged part of the connection string: ${JSON.stringify(line.slice(0, 60))}`)
    }
  }
  ok(logged.some((line) => /DATABASE_URL configured:\s*true/.test(line)), `${label} keeps the boolean configured line`)
}

logged.length = 0
class PrismaClient { constructor() {} }
load(read('lib/prisma.ts'), {
  env: { NODE_ENV: 'production', DATABASE_URL: sentinelUrl, DIRECT_URL: sentinelUrl },
  dependencies: { '@prisma/client': { PrismaClient } },
  log: (line) => logged.push(line),
})
assertNoUrlLogged('lib/prisma.ts')

logged.length = 0
const sessions = load(read('app/api/sessions/route.ts'), {
  env: { NODE_ENV: 'production', DATABASE_URL: sentinelUrl, DIRECT_URL: sentinelUrl },
  dependencies: {
    'next/server': nextServer,
    'next-auth': { getServerSession: async () => null },
    '@/lib/auth-options': { authOptions: {} },
    '@/lib/prisma': { prisma: new Proxy({}, { get() { throw new Error('no database access expected') } }) },
  },
  log: (line) => logged.push(line),
})
const unauthenticated = await sessions.POST({ json: async () => ({}) })
equal(unauthenticated.status, 401, 'POST /api/sessions still rejects an unauthenticated caller')
assertNoUrlLogged('app/api/sessions/route.ts')

console.log(`${checks} dev-token and log hardening checks passed; mock-token is development-only with no fallback key, and no connection-string prefix is logged.`)
