import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// Regression guard for the removed unauthenticated debug routes: environment
// details must never be served to anonymous callers again. If a developer needs
// an env check, use a local script instead of adding a route.
const root = fileURLToPath(new URL('..', import.meta.url))
let checks = 0

// 1. The removed routes must stay removed.
for (const removed of ['app/api/debug/check-env', 'app/api/test-env']) {
  assert.equal(existsSync(join(root, removed)), false, `${removed} must not exist`)
  checks++
}

// 2. No page or route handler under app/ may read auth/database secret material,
//    or enumerate process.env. The single allowlisted handler is dev-only.
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = join(dir, entry.name)
  if (entry.isDirectory()) return walk(full)
  return /^(route|page)\.(ts|tsx|js|jsx|mjs)$/.test(entry.name) ? [full] : []
})
const secretRead = /process\.env\.(NEXTAUTH_SECRET|GOOGLE_CLIENT_SECRET)\b/
const envEnumeration = /Object\.(keys|entries|values)\(\s*process\.env\s*\)|JSON\.stringify\(\s*process\.env\b|\.\.\.process\.env\b/
const devOnlyAllowlist = new Map([
  ['app/api/debug/env/route.ts', "process.env.NODE_ENV === 'development'"],
])

for (const file of walk(join(root, 'app'))) {
  const rel = relative(root, file).split('\\').join('/')
  const source = readFileSync(file, 'utf8')
  assert.equal(envEnumeration.test(source), false, `${rel} must not enumerate process.env`)
  checks++
  if (!secretRead.test(source)) continue
  assert.ok(devOnlyAllowlist.has(rel), `${rel} must not read NEXTAUTH_SECRET or GOOGLE_CLIENT_SECRET`)
  const gate = devOnlyAllowlist.get(rel)
  const gateIndex = source.indexOf(gate)
  assert.ok(gateIndex !== -1, `${rel} must keep its development-only gate`)
  assert.ok(gateIndex < source.search(secretRead), `${rel} must check the development-only gate before reading secrets`)
  assert.match(source, /status:\s*403/, `${rel} must refuse outside development`)
  checks += 3
}

console.log(`${checks} debug-env-route removal checks passed; removed routes absent, no env enumeration, no secret reads outside the dev-only allowlist.`)
