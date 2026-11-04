// C-07 (pre-promotion): /api/dev/mock-token signs a token ONLY on a local development server, NODE_ENV === 'development' AND
// NEXT_PUBLIC_DEV_MODE === 'true'. Every other environment (production, test, preview) answers 404, dev-mode flag or not.
// No flag: a security fix applies in every environment. Plain node; the route is transpiled and run in a sandbox (no server, no network).
// Mutants: each weakening of the gate must be killed by an assertion below.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const ROUTE = 'app/api/dev/mock-token/route.ts'
const source = readFileSync(ROUTE, 'utf8')

async function run(src, env, method) {
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  let signed = 0
  class SignJWT {
    constructor(claims) { this.claims = claims }
    setProtectedHeader() { return this } setExpirationTime() { return this } setIssuedAt() { return this }
    async sign() { signed++; return 'signed.' + this.claims.user_id }
  }
  vm.runInNewContext(out, {
    exports, TextEncoder, process: { env },
    console: { log() {}, error() {} },
    require(name) {
      if (name === 'next/server') return { NextResponse: { json: (body, o) => ({ body, status: o?.status || 200 }) } }
      if (name === 'jose') return { SignJWT }
      if (name === '@/lib/dev-deployment') return { isStudioDevDeployment: () => env.STUDIO_V4_DEV_DEPLOYMENT === 'true' }
      throw new Error('unexpected import ' + name)
    },
  })
  const req = { json: async () => ({ user_id: 'someone_else' }) }
  const res = await exports[method](req)
  return { ...res, signed }
}

async function check(src) {
  let n = 0
  for (const NODE_ENV of ['production', 'test', undefined, 'development']) {
    for (const DEV of [undefined, 'false', 'TRUE', '1', 'true']) {
      const env = { NODE_ENV, NEXT_PUBLIC_DEV_MODE: DEV }
      const allowed = NODE_ENV === 'development' && DEV === 'true'
      for (const method of ['GET', 'POST']) {
        const r = await run(src, env, method)
        if (allowed) {
          assert.equal(r.status, 200, `${method} ${NODE_ENV}/${DEV} answers`)
          if (method === 'POST') { assert.equal(r.body.access_token, 'signed.someone_else'); assert.equal(r.signed, 1) }
        } else {
          assert.equal(r.status, 404, `${method} NODE_ENV=${NODE_ENV} DEV_MODE=${DEV} is 404`)
          assert.equal(JSON.stringify(r.body), '{"error":"Not found"}')
          assert.equal(r.signed, 0, 'no token signed')
        }
        n++
      }
    }
  }
  // the Studio dev deployment stays 404 even on a development server with the flag
  for (const method of ['GET', 'POST']) {
    const r = await run(src, { NODE_ENV: 'development', NEXT_PUBLIC_DEV_MODE: 'true', STUDIO_V4_DEV_DEPLOYMENT: 'true' }, method)
    assert.equal(r.status, 404); assert.equal(r.signed, 0); n++
  }
  return n
}

const checks = await check(source)

const MUTANTS = [
  ['OR instead of AND (the old bug)', "env.NODE_ENV === 'development' && env.NEXT_PUBLIC_DEV_MODE === 'true'", "env.NODE_ENV === 'development' || env.NEXT_PUBLIC_DEV_MODE === 'true'"],
  ['flag only', "env.NODE_ENV === 'development' && env.NEXT_PUBLIC_DEV_MODE === 'true'", "env.NEXT_PUBLIC_DEV_MODE === 'true'"],
  ['NODE_ENV only', "env.NODE_ENV === 'development' && env.NEXT_PUBLIC_DEV_MODE === 'true'", "env.NODE_ENV === 'development'"],
  ['not production', "env.NODE_ENV === 'development' &&", "env.NODE_ENV !== 'production' &&"],
  ['403 instead of 404', "if (!mockTokenAllowed()) {\n    return NextResponse.json({ error: 'Not found' }, { status: 404 });", "if (!mockTokenAllowed()) {\n    return NextResponse.json({ error: 'Not found' }, { status: 403 });"],
  ['POST ungated', "export async function POST(request: NextRequest) {\n  if (isStudioDevDeployment()) {\n    return NextResponse.json({ error: 'Not found' }, { status: 404 });\n  }\n  if (!mockTokenAllowed()) {", "export async function POST(request: NextRequest) {\n  if (isStudioDevDeployment()) {\n    return NextResponse.json({ error: 'Not found' }, { status: 404 });\n  }\n  if (false) {"],
  ['dev deployment guard dropped', "export async function POST(request: NextRequest) {\n  if (isStudioDevDeployment()) {", "export async function POST(request: NextRequest) {\n  if (false) {"],
]
let killed = 0
for (const [name, from, to] of MUTANTS) {
  assert.ok(source.includes(from), `mutant "${name}" applies`)
  let survived = false
  try { await check(source.replace(from, to)); survived = true } catch { killed++ }
  assert.ok(!survived, `mutant survived: ${name}`)
}
console.log(`dev token gate: ${checks} checks passed, ${killed}/${MUTANTS.length} mutants killed`)
