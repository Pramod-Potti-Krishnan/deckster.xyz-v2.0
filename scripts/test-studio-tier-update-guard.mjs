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

async function load(src) {
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
}

const quiet = () => { const e = console.error; console.error = () => {}; return () => { console.error = e } }

async function proof(src, auth) {
  const { applySessionUpdate } = await load(src)
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
  return fails
}

const mutants = [
  ['re-allow tier', s => s.replace('if (typeof p.image', 'if (typeof p.tier === "string") next.tier = p.tier\n  if (typeof p.image')],
  ['spread payload', s => s.replace('const next: Record<string, unknown> = { ...token }', 'const next: Record<string, unknown> = { ...token, ...(payload as object) }')],
  ['drop name update', s => s.replace('if (typeof p.name === "string") next.name = p.name', '')],
  ['skip server refresh', s => s.replace('const fresh = await loadServerEntitlements(userId)', 'const fresh = null as any')],
  ['payload fallback on error', s => s.replace('console.error("[Auth] Entitlement refresh failed on session update:", error)', 'next.tier = p.tier')],
]
const authMutants = [
  ['auth reads session.tier', s => s.replace('return applySessionUpdate(token, session, loadServerEntitlements)', 'token.tier = (session as any).tier; return token')],
]

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
console.log(ok ? 'TIER UPDATE GUARD PROOF: PASS' : 'TIER UPDATE GUARD PROOF: FAIL')
process.exit(ok ? 0 : 1)
