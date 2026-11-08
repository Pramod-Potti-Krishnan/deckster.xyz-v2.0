// BILLING-L5 (FRONTEND-2, B67; L-BILLING F3 = S-1): the cut-over backfill of router entitlements for the QA cohort ONLY. DRY RUN by default.
//
//   node scripts/billing-entitlement-backfill.mjs --accounts <accounts.json>            prints the planned PUTs; sends nothing, reads no environment value, touches no database
//   STUDIO_ROUTER_ENTITLEMENTS_PUSH=true node scripts/billing-entitlement-backfill.mjs --accounts <accounts.json> --apply
//                                                                                        the ONLY write path: needs BOTH --apply and the flag; then each planned PUT goes through pushEntitlement
//                                                                                        (lib/billing/router-entitlements.ts: the router address and ROUTER_ENTITLEMENTS_API_KEY from the server environment)
//
// <accounts.json> is a JSON array an operator exports (this script never reads Studio's database: UAT's database is the shared production Supabase). Each entry:
//   { "cohort": "qa", "user": { "id", "tier", "updatedAt" }, "subscription": { "status", "tier", "currentPeriodStart", "currentPeriodEnd", "updatedAt" } | null }
// Only entries with cohort exactly "qa" are planned; every other entry is counted and left alone (spec R6: no real-user backfill). The entitlement of each is built by the SAME buildEntitlement the webhook uses
// (the library is transpiled from its TypeScript source here, so there is one mapping, not two). Output: one "PLAN PUT ..." or "SKIP <id> <reason>" line per QA entry, and one summary line. Never a key.
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const LIB = 'lib/billing/router-entitlements.ts'
const USAGE = 'usage: node scripts/billing-entitlement-backfill.mjs --accounts <accounts.json> [--apply]   (dry run unless --apply AND STUDIO_ROUTER_ENTITLEMENTS_PUSH=true)'

/** In a dry run the library sees an environment that refuses every read, a fetch that refuses every call and a database that refuses every access: nothing can leave this process. */
const refusing = what => new Proxy({}, { get(_, name) { if (name === Symbol.toPrimitive || name === 'then') return undefined; throw new Error(`the dry run reads no ${what} (${String(name)})`) }, has() { throw new Error(`the dry run reads no ${what}`) }, ownKeys() { throw new Error(`the dry run reads no ${what}`) } })
const NO_FETCH = () => { throw new Error('the dry run sends nothing') }
const NO_DATABASE = refusing('database')

/** The library, transpiled from its source and run in its own context with the given environment and fetch. Only its two imports are resolved: the URL helper (real) and the database (refused). */
export function loadEntitlementsLibrary({ env, fetchImpl, readSource = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8') }) {
  const cache = new Map()
  const load = rel => {
    if (cache.has(rel)) return cache.get(rel).exports
    const module = { exports: {} }
    cache.set(rel, module)
    const code = ts.transpileModule(readSource(rel), { fileName: rel, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
    const req = spec => {
      if (spec === '@/lib/service-url') return load('lib/service-url.ts')
      if (spec === '@/lib/prisma') return { prisma: NO_DATABASE }
      throw new Error(`the backfill does not load ${spec}`)
    }
    vm.runInNewContext(code, { module, exports: module.exports, require: req, process: { env }, fetch: fetchImpl, AbortSignal, URL }, { filename: rel })
    return module.exports
  }
  return load(LIB)
}

function parseArgs(argv) {
  const args = { accounts: null, apply: false, help: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--accounts') args.accounts = argv[++i] ?? null
    else if (argv[i] === '--apply') args.apply = true
    else if (argv[i] === '--help' || argv[i] === '-h') args.help = true
    else throw new Error(`unknown argument ${JSON.stringify(argv[i])}`)
  }
  return args
}

const ROUTER_USER_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/
const shownId = id => (typeof id === 'string' && ROUTER_USER_ID.test(id) ? id : 'invalid')

/** Returns the exit code. `env` is read ONLY when --apply is given (first the flag, then, inside the library, the router address and the key). */
export async function main(argv, { env = process.env, fetchImpl = globalThis.fetch, readFile = file => fs.readFileSync(file, 'utf8'), out = line => console.log(line), err = line => console.error(line), readSource } = {}) {
  let args
  try { args = parseArgs(argv) } catch (error) { err(String(error.message)); err(USAGE); return 2 }
  if (args.help) { out(USAGE); return 0 }
  if (!args.accounts) { err(USAGE); return 2 }
  let accounts
  try { accounts = JSON.parse(readFile(args.accounts)) } catch { err('the accounts file could not be read as JSON'); return 2 }
  if (!Array.isArray(accounts)) { err('the accounts file must hold a JSON array'); return 2 }
  if (args.apply && env.STUDIO_ROUTER_ENTITLEMENTS_PUSH !== 'true') { err('refusing --apply: STUDIO_ROUTER_ENTITLEMENTS_PUSH is not "true"; nothing was sent'); return 3 }

  const lib = args.apply ? loadEntitlementsLibrary({ env, fetchImpl, readSource }) : loadEntitlementsLibrary({ env: refusing('environment'), fetchImpl: NO_FETCH, readSource })
  let planned = 0, skipped = 0, notQa = 0, pushed = 0, failed = 0
  for (const entry of accounts) {
    if (!entry || typeof entry !== 'object' || entry.cohort !== 'qa') { notQa++; continue }
    const built = lib.buildEntitlement(entry.user, entry.subscription ?? null, 'backfill')
    if (!built.ok) { skipped++; out(`SKIP ${shownId(entry.user?.id)} ${built.reason}`); continue }
    planned++
    out(`PLAN PUT /v1/entitlements/${encodeURIComponent(built.userId)} ${JSON.stringify(built.body)}`)
    if (args.apply) {
      const outcome = await lib.pushEntitlement(built)
      out(lib.entitlementPushLogLine(built.userId, 'backfill', outcome))
      if (!outcome.skipped && outcome.ok) pushed++
      else failed++
    }
  }
  out(args.apply
    ? `APPLIED: ${planned} planned, ${skipped} skipped, ${notQa} not in cohort qa, ${pushed} pushed, ${failed} not pushed`
    : `DRY RUN: ${planned} planned, ${skipped} skipped, ${notQa} not in cohort qa; nothing was sent`)
  return args.apply && failed > 0 ? 1 : 0
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(await main(process.argv.slice(2)))
