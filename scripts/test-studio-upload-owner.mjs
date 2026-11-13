/**
 * K-02 owner cuid: lib/studio-upload-owner.ts compiled and run for real, plus a wiring check on
 * app/builder/page.tsx. Offline, no network, made-up ids only.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let checks = 0
function load(flag) {
  const src = fs.readFileSync(path.join(REPO, 'lib/studio-upload-owner.ts'), 'utf8')
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const module = { exports: {} }
  const env = flag === undefined ? {} : { NEXT_PUBLIC_STUDIO_OWNER_CUID_ENABLED: flag }
  vm.runInNewContext(js, { module, exports: module.exports, process: { env } })
  return module.exports
}
const CUID = 'cabcdefghijklmnopqrstuvwx'
const user = { id: CUID, email: 'alice@example.test' }

for (const flag of [undefined, 'false', 'TRUE', '1']) {
  const m = load(flag)
  assert.equal(m.STUDIO_OWNER_CUID_ENABLED, false); checks++
  assert.equal(m.uploadOwnerId(user), 'alice@example.test'); checks++ // flag off: identical to user?.email || ''
  assert.equal(m.uploadOwnerId({ id: CUID }), ''); checks++
  assert.equal(m.uploadOwnerId(null), ''); checks++
}
const on = load('true')
assert.equal(on.STUDIO_OWNER_CUID_ENABLED, true); checks++
assert.equal(on.uploadOwnerId(user), CUID); checks++
assert.equal(on.uploadOwnerId({ email: 'alice@example.test' }), ''); checks++ // never falls back to the e-mail
assert.equal(on.uploadOwnerId({ id: 'bob@example.test', email: 'bob@example.test' }), ''); checks++
assert.equal(on.uploadOwnerId({ id: 'anonymous' }), ''); checks++
assert.equal(on.uploadOwnerId({ id: 'uat-tpl-user' }), 'uat-tpl-user'); checks++ // dev-login id passes R2
assert.notEqual(on.uploadOwnerId({ id: CUID }), on.uploadOwnerId({ id: 'czyxwvutsrqponmlkjihgfedc' })); checks++

// the override the page spreads after the base's userId: flag off adds nothing, flag on the cuid (or '')
for (const flag of [undefined, 'false', 'TRUE', '1']) {
  const m = load(flag)
  assert.deepEqual({ userId: user.email, ...m.uploadOwnerOverride(user) }, { userId: user.email }); checks++
  assert.equal(JSON.stringify(m.uploadOwnerOverride(user)), '{}'); checks++ // (the vm realm's objects are compared as JSON)
}
assert.deepEqual({ userId: user.email, ...on.uploadOwnerOverride(user) }, { userId: CUID }); checks++
assert.deepEqual({ userId: user.email, ...on.uploadOwnerOverride({ email: user.email }) }, { userId: '' }); checks++ // never the e-mail

const page = fs.readFileSync(path.join(REPO, 'app/builder/page.tsx'), 'utf8')
assert.match(page, /^    userId: user\?\.email \|\| '',\n    \.\.\.uploadOwnerOverride\(user\), \/\/ K-02/m); checks++ // the base's line stays, the override is spread right after it
assert.equal((page.match(/uploadOwnerOverride\(/g) || []).length, 1); checks++
assert.match(page, /import \{ uploadOwnerOverride \} from '@\/lib\/studio-upload-owner'/); checks++

// the registry strip: the page's two marked lines go (the base's own userId line was never touched); any other file is returned as it is
const { stripOwnerCuid } = await import('./studio-owner-cuid-strip.mjs')
const stripped = stripOwnerCuid('app/builder/page.tsx', page)
assert.doesNotMatch(stripped, /uploadOwnerId|studio-upload-owner|K-02/); checks++
assert.match(stripped, /^    userId: user\?\.email \|\| '',$/m); checks++
assert.equal(stripped.split('\n').length, page.split('\n').length - 2); checks++ // exactly two lines go: the import and the spread
assert.equal(stripOwnerCuid('app/builder/page.tsx', stripped), stripped); checks++ // idempotent
assert.equal(stripOwnerCuid('lib/studio-upload-owner.ts', 'x'), 'x'); checks++
console.log(`test-studio-upload-owner: ${checks} checks passed`)
