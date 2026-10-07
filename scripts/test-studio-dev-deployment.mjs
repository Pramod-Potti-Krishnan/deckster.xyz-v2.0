import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const baseline = 'e7a59554c1e61b0b4bb67da4e3deda5026dbb70a'
// The debug env routes (api/debug/check-env, api/test-env) were removed outright;
// scripts/test-no-debug-env-routes.mjs guards their absence.
const routes = [
  ['app/api/dev/mock-token/route.ts', ['GET', 'POST']],
  ['app/api/admin/cleanup-sessions/route.ts', ['GET', 'POST']],
]
let checks = 0
const blocked = () => { throw new Error('Guard reached a protected side effect') }
const protectedObject = new Proxy({}, { get: blocked })

function load(source, env, dependencies, { allowLog = false } = {}) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  })
  assert.equal(compiled.diagnostics?.length || 0, 0)
  const exports = {}
  vm.runInNewContext(compiled.outputText, {
    exports,
    process: { env },
    require(name) {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected import ${name}`)
      return dependencies[name]
    },
    console: { log: allowLog ? () => {} : blocked, error: blocked, warn: blocked },
    TextEncoder,
  })
  return exports
}

const helperSource = readFileSync('lib/dev-deployment.ts', 'utf8')
for (const value of [undefined, 'false', 'TRUE', '1', 'true']) {
  const env = { STUDIO_V4_DEV_DEPLOYMENT: value }
  const helper = load(helperSource, env, {})
  assert.equal(helper.isStudioDevDeployment(), value === 'true')
  env.STUDIO_V4_DEV_DEPLOYMENT = 'true'
  assert.equal(helper.isStudioDevDeployment(), true, 'Guard must read current server environment')
  checks += 2
}

for (const [path, methods] of routes) {
  const source = readFileSync(path, 'utf8')
  const previous = execFileSync('git', ['show', `${baseline}:${path}`], { encoding: 'utf8' })
  const withoutGuard = source
    .replace(/^import \{ isStudioDevDeployment \} from '@\/lib\/dev-deployment';?\n/m, '')
    .replace(/  if \(isStudioDevDeployment\(\)\) \{\n    return NextResponse\.json\(\{ error: 'Not found' \}, \{ status: 404 \}\);?\n  \}\n/g, '')
  assert.equal(withoutGuard.trimEnd(), previous.trimEnd(), `${path} changed beyond the explicit guard`)
  checks++
  for (const nodeEnv of ['production', 'development']) {
    // Even an accidentally enabled public mock flag must not bypass the server boundary.
    const env = new Proxy({
      STUDIO_V4_DEV_DEPLOYMENT: 'true', NODE_ENV: nodeEnv, NEXT_PUBLIC_DEV_MODE: 'true',
    }, {
      get(target, name) {
        if (['NEXTAUTH_SECRET', 'JWT_SECRET', 'CRON_SECRET', 'DATABASE_URL'].includes(name)) blocked()
        return target[name]
      },
      ownKeys: blocked,
    })
    const helper = load(helperSource, env, {})
    const route = load(source, env, {
      'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
      '@/lib/dev-deployment': helper,
      '@/lib/prisma': { prisma: protectedObject },
      jose: { SignJWT: class { constructor() { blocked() } } },
    })
    for (const method of methods) {
      const result = await route[method](protectedObject)
      assert.equal(result.status, 404)
      assert.equal(JSON.stringify(result.body), JSON.stringify({ error: 'Not found' }))
      checks++
    }
  }
}

const qaRoutePath = 'app/api/publish/[slug]/qa-sources/route.ts'
const previousQaRoute = execFileSync('git', ['show', `${baseline}:${qaRoutePath}`], { encoding: 'utf8' })
const qaHelperSource = readFileSync('lib/publish/qa-source-policy.ts', 'utf8')
assert.ok(previousQaRoute.includes(qaHelperSource.trimEnd()), 'Moved Q&A policy must remain byte-identical')
const qaRoute = readFileSync(qaRoutePath, 'utf8')
assert.equal(
  qaRoute.replace("import { defaultAllowForKind } from '@/lib/publish/qa-source-policy'\n", ''),
  previousQaRoute.replace(qaHelperSource + '\n', ''),
  'Q&A handlers must remain unchanged apart from relocating the invalid route export',
)
checks += 2
const qaHelper = load(qaHelperSource, {}, {})
for (const kind of ['deck', 'web', 'upload', 'research', 'document', '', 'unknown']) {
  assert.equal(qaHelper.defaultAllowForKind(kind), kind === 'deck' || kind === 'web')
  checks++
}

for (const databaseUrl of [undefined, 'unit-test-configured-url']) {
  const capturedOptions = []
  const prismaModule = load(readFileSync('lib/prisma.ts', 'utf8'), {
    NODE_ENV: 'production', DATABASE_URL: databaseUrl,
  }, {
    '@prisma/client': { PrismaClient: class {
      constructor(options) { capturedOptions.push(options) }
    } },
  }, { allowLog: true })
  assert.equal(capturedOptions.length, 1)
  assert.equal(prismaModule.prisma, prismaModule.default)
  const options = capturedOptions[0]
  assert.equal(JSON.stringify(options.log), JSON.stringify(['error']))
  assert.equal(Object.hasOwn(options, 'datasources'), databaseUrl !== undefined)
  if (databaseUrl !== undefined) assert.equal(options.datasources.db.url, databaseUrl)
  checks += 4
}

console.log(`${checks} development deployment guard, Q&A policy, Prisma construction and unchanged-contract checks passed; no secret reads, token signing, request reads, database operations or service calls.`)
