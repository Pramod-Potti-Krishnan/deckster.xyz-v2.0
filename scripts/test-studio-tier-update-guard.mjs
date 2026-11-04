#!/usr/bin/env node
// Proof: a client session update() cannot raise tier or other entitlements.
// Transpiles lib/auth-session-update.ts with TypeScript, runs the cases, then runs mutants
// (each mutant must make the proof FAIL).
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const req = createRequire(join(root, 'package.json'))
let ts
try { ts = req('typescript') } catch { ts = createRequire(join(root, '..', 'frontend', 'package.json'))('typescript') }

const helperSrc = readFileSync(join(root, 'lib/auth-session-update.ts'), 'utf8')
const authSrc = readFileSync(join(root, 'lib/auth-options.ts'), 'utf8')
const debitSrc = readFileSync(join(root, 'app/api/wallet/debit/route.ts'), 'utf8')
const quotaSrc = readFileSync(join(root, 'app/api/usage/quota/route.ts'), 'utf8')
const tierSrc = readFileSync(join(root, 'lib/quota/server-tier.ts'), 'utf8')

async function load(src) {
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
}

const quiet = () => { const e = console.error; console.error = () => {}; return () => { console.error = e } }

async function proof(src, auth, routes = { debit: debitSrc, quota: quotaSrc, tier: tierSrc }) {
  const { applySessionUpdate, refreshEntitlementsIfStale } = await load(src)
  const fails = []
  const base = { id: 'u1', name: 'Old', picture: 'old.png', tier: 'free', approved: false, walletBalanceCents: 0, subscription: null }
  const db = { tier: 'free', approved: false, walletBalanceCents: 0, subscription: null }
  const loader = async () => db
  const evil = { tier: 'max', plan: 'max', credits: 1e9, role: 'admin', isInternal: true, premium: true, limits: {}, approved: true, walletBalanceCents: 999999, subscription: { status: 'active', tier: 'premium', currentPeriodEnd: 'x' }, id: 'other' }

  let t = await applySessionUpdate(base, evil, loader)
  if (t.tier !== 'free') fails.push('tier escalated to ' + t.tier)
  if (t.approved !== false) fails.push('approved forged')
  if (t.walletBalanceCents !== 0) fails.push('wallet forged')
  if (t.subscription !== null) fails.push('subscription forged')
  if (t.id !== 'u1') fails.push('id forged')
  for (const k of ['plan', 'credits', 'role', 'isInternal', 'premium', 'limits']) if (k in t) fails.push(k + ' copied')

  t = await applySessionUpdate(base, { name: 'New', image: 'new.png', tier: 'max' }, loader)
  if (t.name !== 'New') fails.push('name not updated')
  if (t.picture !== 'new.png') fails.push('image not updated')
  if (t.tier !== 'free') fails.push('tier escalated alongside name')

  // Legit post-redeem / post-checkout refresh: DB changed server-side, update() reflects it.
  t = await applySessionUpdate(base, { tier: 'free' }, async () => ({ ...db, tier: 'pro', approved: true, walletBalanceCents: 500 }))
  if (t.tier !== 'pro' || t.approved !== true || t.walletBalanceCents !== 500) fails.push('server refresh not applied')

  // DB failure keeps the existing server-issued tier; never falls back to the payload.
  const restore = quiet()
  t = await applySessionUpdate(base, { tier: 'max' }, async () => { throw new Error('db down') })
  restore()
  if (t.tier !== 'free') fails.push('tier taken from payload on DB failure')

  // Wiring: auth-options must route update through the helper and never read session.tier.
  if (/session\.(tier|approved|walletBalanceCents)\b/.test(auth)) fails.push('auth-options reads entitlement from update payload')
  if (!/trigger === "update"[\s\S]{0,200}applySessionUpdate\(/.test(auth)) fails.push('auth-options update branch not guarded')
  // Refresh: a stale escalated token heals after 60s; the throttle holds within 60s.
  const now = 1_000_000_000
  let hits = 0
  const counting = async () => { hits++; return db }
  const escalated = { ...base, tier: 'premium', approved: true, entitlementCheckedAt: now - 61_000 }
  t = await refreshEntitlementsIfStale(escalated, counting, now)
  if (t.tier !== 'free' || t.approved !== false) fails.push('stale escalated token did not heal')
  if (t.entitlementCheckedAt !== now) fails.push('entitlementCheckedAt not stamped')
  const legacy = { ...base, tier: 'premium' } // pre-fix token, no checkedAt
  t = await refreshEntitlementsIfStale(legacy, counting, now)
  if (t.tier !== 'free') fails.push('legacy token without checkedAt did not heal')
  hits = 0
  const fresh = { ...base, tier: 'pro', entitlementCheckedAt: now - 30_000 }
  t = await refreshEntitlementsIfStale(fresh, counting, now)
  if (hits !== 0) fails.push('throttle broken: DB read within 60s')
  if (t.tier !== 'pro') fails.push('fresh token changed within throttle')
  const restore2 = quiet()
  t = await refreshEntitlementsIfStale(escalated, async () => { throw new Error('db down') }, now)
  restore2()
  if (t.tier !== 'premium') fails.push('DB failure on refresh did not keep existing values')
  if (!/return refreshEntitlementsIfStale\(token, loadServerEntitlements\)/.test(auth)) fails.push('auth-options refresh not wired')

  // Debit + quota routes ignore a forged session tier: tier comes from the DB helper.
  for (const [name, r] of [['debit', routes.debit], ['quota', routes.quota]]) {
    if (/session\.user\.tier/.test(r)) fails.push(name + ' reads session.user.tier')
    if (!/const tier = await getServerTier\(session\.user\.id\)/.test(r)) fails.push(name + ' does not read tier from DB')
  }
  if (!/prisma\.user\.findUnique\(\{ where: \{ id: userId \}/.test(routes.tier)) fails.push('server-tier does not read the User row')
  return fails
}

const mutants = [
  ['re-allow tier', s => s.replace('if (typeof p.image', 'if (typeof p.tier === "string") next.tier = p.tier\n  if (typeof p.image')],
  ['spread payload', s => s.replace('const next: Record<string, unknown> = { ...token }', 'const next: Record<string, unknown> = { ...token, ...(payload as object) }')],
  ['drop name update', s => s.replace('if (typeof p.name === "string") next.name = p.name', '')],
  ['skip server refresh', s => s.replace('const fresh = await loadServerEntitlements(userId)', 'const fresh = null as any')],
  ['no throttle', s => s.replace('if (now - checkedAt <= ENTITLEMENT_TTL_MS) return token', '')],
  ['never refresh', s => s.replace('if (now - checkedAt <= ENTITLEMENT_TTL_MS) return token', 'return token')],
  ['refresh error clears to payload-ish', s => s.replace('console.error("[Auth] Entitlement refresh failed on token refresh:", error)\n    return token', 'return { ...token, tier: "max" } as T')],
  ['payload fallback on error', s => s.replace('console.error("[Auth] Entitlement refresh failed on session update:", error)', 'next.tier = p.tier')],
]
const authMutants = [
  ['auth reads session.tier', s => s.replace('return applySessionUpdate(token, session, loadServerEntitlements)', 'token.tier = (session as any).tier; return token')],
]

const routeMutants = [
  ['debit reads session tier', r => ({ ...r, debit: r.debit.replace('const tier = await getServerTier(session.user.id)', 'const tier = (session.user.tier ?? "free") as Tier') })],
  ['quota reads session tier', r => ({ ...r, quota: r.quota.replace('const tier = await getServerTier(session.user.id)', 'const tier = (session.user.tier ?? "free") as Tier') })],
]
authMutants.push(['auth refresh unwired', s => s.replace('return refreshEntitlementsIfStale(token, loadServerEntitlements)', 'return token')])

let ok = true
const real = await proof(helperSrc, authSrc)
console.log(real.length ? 'FAIL real: ' + real.join('; ') : 'PASS real implementation')
if (real.length) ok = false
for (const [name, mut] of mutants) {
  const m = mut(helperSrc)
  if (m === helperSrc) { console.log('MUTANT NOT APPLIED: ' + name); ok = false; continue }
  const f = await proof(m, authSrc)
  console.log(f.length ? `killed mutant: ${name}` : `SURVIVED mutant: ${name}`)
  if (!f.length) ok = false
}
for (const [name, mut] of authMutants) {
  const m = mut(authSrc)
  if (m === authSrc) { console.log('MUTANT NOT APPLIED: ' + name); ok = false; continue }
  const f = await proof(helperSrc, m)
  console.log(f.length ? `killed mutant: ${name}` : `SURVIVED mutant: ${name}`)
  if (!f.length) ok = false
}
const baseRoutes = { debit: debitSrc, quota: quotaSrc, tier: tierSrc }
for (const [name, mut] of routeMutants) {
  const m = mut(baseRoutes)
  if (JSON.stringify(m) === JSON.stringify(baseRoutes)) { console.log('MUTANT NOT APPLIED: ' + name); ok = false; continue }
  const f = await proof(helperSrc, authSrc, m)
  console.log(f.length ? `killed mutant: ${name}` : `SURVIVED mutant: ${name}`)
  if (!f.length) ok = false
}
console.log(ok ? 'TIER UPDATE GUARD PROOF: PASS' : 'TIER UPDATE GUARD PROOF: FAIL')
process.exit(ok ? 0 : 1)
