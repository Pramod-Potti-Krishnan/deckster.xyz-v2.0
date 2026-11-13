/**
 * K-02 owner cuid: lib/studio-upload-owner.ts compiled and run for real, plus a wiring check on
 * app/builder/page.tsx, the .env.example block and the registry lines. Offline, no network, made-up ids only.
 * Reads only the current files (no pinned base, no git, no worktree diff): it holds after later changes land.
 */
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
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
assert.equal(on.uploadOwnerId({ email: 'alice@example.test' }), 'alice@example.test'); checks++ // no id: the base's own value, as with the flag off
assert.equal(on.uploadOwnerId({ id: 'bob@example.test', email: 'bob@example.test' }), 'bob@example.test'); checks++ // an id that is not canonical: the base's value
assert.equal(on.uploadOwnerId({ id: 'anonymous' }), ''); checks++ // no e-mail either: empty, as the base is
assert.equal(on.uploadOwnerId({ id: 'uat-tpl-user' }), 'uat-tpl-user'); checks++ // dev-login id passes R2
assert.notEqual(on.uploadOwnerId({ id: CUID }), on.uploadOwnerId({ id: 'czyxwvutsrqponmlkjihgfedc' })); checks++

// the override the page spreads after the base's userId: flag off adds nothing, flag on the cuid when it is canonical, otherwise nothing (the base's e-mail stands)
for (const flag of [undefined, 'false', 'TRUE', '1']) {
  const m = load(flag)
  assert.deepEqual({ userId: user.email, ...m.uploadOwnerOverride(user) }, { userId: user.email }); checks++
  assert.equal(JSON.stringify(m.uploadOwnerOverride(user)), '{}'); checks++ // (the vm realm's objects are compared as JSON)
}
assert.deepEqual({ userId: user.email, ...on.uploadOwnerOverride(user) }, { userId: CUID }); checks++
assert.equal(JSON.stringify(on.uploadOwnerOverride(user)), JSON.stringify({ userId: CUID })); checks++ // flag on + canonical id: { userId: id }
assert.deepEqual({ userId: user.email, ...on.uploadOwnerOverride({ email: user.email }) }, { userId: user.email }); checks++ // no id: the base's e-mail stands

// ---- M1 / REVIEW-1 #3: flag on + an id that is not canonical falls back to the base (the override is {}), and the override can never produce '' or 'anonymous'
const NOT_CANONICAL = [undefined, null, '', ' ', 'anonymous', 'ANONYMOUS', 'None', 'null', 'Undefined', 'alice@example.test', 'a b', '-lead', '.lead', '_lead', 'a/b', 'a\nb', 'café', 'x'.repeat(256), 123, true, {}, []]
const CANONICAL = [CUID, 'uat-tpl-user', 'A', '0', 'a.b_c:d-e', 'user:42', 'x'.repeat(255), 'anonymous1', 'nonexistent']
const PLACEHOLDER = new Set(['', 'anonymous', 'none', 'null', 'undefined'])
const wire = userId => userId || 'anonymous' // hooks/use-file-upload.ts:184 and :220 send `userId || 'anonymous'` as user_id
const EMAILS = [undefined, null, '', 'alice@example.test']
for (const id of NOT_CANONICAL) {
  for (const email of EMAILS) {
    const baseId = email || ''
    assert.equal(JSON.stringify(on.uploadOwnerOverride({ id, email })), '{}'); checks++ // flag on + non-canonical id: {}
    assert.equal(({ userId: baseId, ...on.uploadOwnerOverride({ id, email }) }).userId, baseId); checks++ // the base's `userId: user?.email || ''` stands
    assert.equal(on.uploadOwnerId({ id, email }), baseId); checks++ // and the id helper says the same thing
    assert.equal(wire(({ userId: baseId, ...on.uploadOwnerOverride({ id, email }) }).userId), wire(baseId)); checks++ // flag on is exactly flag off on the wire
  }
}
for (const id of CANONICAL) {
  for (const email of EMAILS) {
    assert.equal(JSON.stringify(on.uploadOwnerOverride({ id, email })), JSON.stringify({ userId: id })); checks++ // flag on + canonical id: { userId: id }, whatever the e-mail
    assert.equal(({ userId: email || '', ...on.uploadOwnerOverride({ id, email }) }).userId, id); checks++
    assert.equal(on.uploadOwnerId({ id, email }), id); checks++
    for (const flag of [undefined, 'false', 'TRUE']) assert.equal(JSON.stringify(load(flag).uploadOwnerOverride({ id, email })), '{}'); checks++ // flag off: {}, whatever the id
  }
}
// nothing the override can return is an empty or placeholder owner: over a deterministic fuzz of ids (odd characters, lengths 0..300, placeholder words in every case), flag on and off
let seed = 20261113
const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff)
const ALPHABET = 'abcXYZ019._:-@ /\n\té'
const fuzz = []
for (let i = 0; i < 400; i++) fuzz.push(Array.from({ length: next() % 301 }, () => ALPHABET[next() % ALPHABET.length]).join(''))
for (const word of ['anonymous', 'none', 'null', 'undefined']) for (let i = 0; i < 1 << word.length; i++) fuzz.push([...word].map((c, k) => (i >> k) & 1 ? c.toUpperCase() : c).join(''))
fuzz.push(...NOT_CANONICAL.filter(v => typeof v === 'string'), ...CANONICAL)
const offs = [undefined, 'false', 'TRUE', '1'].map(flag => load(flag)) // every spelling that is not the exact 'true'
let produced = 0
for (const id of fuzz) {
  for (const email of EMAILS) {
    const baseId = email || ''
    const merged = { userId: baseId, ...on.uploadOwnerOverride({ id, email }) }
    for (const m of [on, ...offs]) {
      const o = m.uploadOwnerOverride({ id, email })
      if ('userId' in o) { // only ever the id itself, never an empty or placeholder owner
        assert.equal(m, on); assert.equal(o.userId, id); assert.ok(typeof o.userId === 'string' && !PLACEHOLDER.has(o.userId.toLowerCase())); assert.notEqual(wire(o.userId), 'anonymous'); produced++
      }
    }
    checks++
    assert.ok(!(PLACEHOLDER.has(String(merged.userId).toLowerCase()) && baseId !== '' && merged.userId !== baseId)); checks++ // the override never turns a known e-mail into ''/'anonymous'
    if (wire(baseId) !== 'anonymous') assert.notEqual(wire(merged.userId), 'anonymous'); checks++ // flag on is never worse than flag off on the wire
    const canonical = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/.test(id) && !PLACEHOLDER.has(id.toLowerCase()) // an independent copy of the rule
    assert.equal(JSON.stringify(on.uploadOwnerOverride({ id, email })), canonical ? JSON.stringify({ userId: id }) : '{}'); checks++
  }
}
assert.ok(produced > 0, 'the fuzz reaches the canonical branch'); checks++

// flag off = the base, hashed: the page's options (`userId: user?.email || ''` then the spread) are byte for byte the base's options without it
const sha = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
const GRID = []
for (const id of [...NOT_CANONICAL, ...CANONICAL]) for (const email of EMAILS) GRID.push({ id, email })
GRID.push(null, undefined, {})
const baseHash = sha(GRID.map(u => ({ userId: u?.email || '' })))
for (const m of offs) assert.equal(sha(GRID.map(u => ({ userId: u?.email || '', ...m.uploadOwnerOverride(u) }))), baseHash); checks++
// flag on + no canonical id anywhere in the grid is that same hash too
assert.equal(sha(GRID.filter(u => !CANONICAL.includes(u?.id)).map(u => ({ userId: u?.email || '', ...on.uploadOwnerOverride(u) }))), sha(GRID.filter(u => !CANONICAL.includes(u?.id)).map(u => ({ userId: u?.email || '' })))); checks++

const page = fs.readFileSync(path.join(REPO, 'app/builder/page.tsx'), 'utf8')
assert.match(page, /^    userId: user\?\.email \|\| '',\n    \.\.\.uploadOwnerOverride\(user\), \/\/ K-02/m); checks++ // the base's line stays, the override is spread right after it
assert.equal((page.match(/uploadOwnerOverride\(/g) || []).length, 1); checks++
assert.match(page, /import \{ uploadOwnerOverride \} from '@\/lib\/studio-upload-owner'/); checks++

// the registry strip: the page's two marked lines go (the base's own userId line was never touched); any other file is returned as it is
const { stripOwnerCuid, OWNER_CUID_ENV_BLOCK: BLOCK, OWNER_CUID_SCOPE_FILES } = await import('./studio-owner-cuid-strip.mjs')
const stripped = stripOwnerCuid('app/builder/page.tsx', page)
assert.doesNotMatch(stripped, /uploadOwnerId|studio-upload-owner|K-02/); checks++
assert.match(stripped, /^    userId: user\?\.email \|\| '',$/m); checks++
assert.equal(stripped.split('\n').length, page.split('\n').length - 2); checks++ // exactly two lines go: the import and the spread
assert.equal(stripOwnerCuid('app/builder/page.tsx', stripped), stripped); checks++ // idempotent
assert.equal(stripOwnerCuid('lib/studio-upload-owner.ts', 'x'), 'x'); checks++

// ---- M2 / REVIEW-1 #4: the .env.example block, registered like every other change's, and taken out by the registry for the older pins
const registry = await import('./studio-later-changes.mjs')
const ENV = '.env.example', FLAG = 'NEXT_PUBLIC_STUDIO_OWNER_CUID_ENABLED'
const env = fs.readFileSync(path.join(REPO, ENV), 'utf8')
const count = (text, part) => text.split(part).length - 1
const blockLines = BLOCK.replace(/\n$/, '').split('\n')
assert.ok(BLOCK.endsWith('\n') && !BLOCK.startsWith('\n')); checks++
assert.deepEqual(blockLines.slice(-1), [`${FLAG}="false"`]); checks++ // one assignment, last, default off
assert.ok(blockLines.length >= 3 && blockLines.length <= 4 && blockLines.slice(0, -1).every(line => line.startsWith('# '))); checks++ // two or three comment lines, then the flag
assert.deepEqual([...new Set(BLOCK.match(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g))], [FLAG]); checks++ // names only its own flag
assert.ok(/default off/.test(BLOCK) && /Build-time value/.test(BLOCK) && /Researcher/.test(BLOCK) && /first|only after/.test(BLOCK)); checks++ // what it is, default off, build time, the Researcher dependency
assert.ok(!BLOCK.includes('exact "true" enables it')); checks++ // the phrase older env proofs refuse
assert.equal(count(env, BLOCK), 1); checks++ // in .env.example exactly once, verbatim
assert.ok(env.includes(`\n\n${BLOCK}`)); checks++ // after one blank line
assert.equal(count(env, `${FLAG}=`), 1); checks++
const at = registry.LATER_ENV_BLOCKS.indexOf(BLOCK)
assert.ok(at >= 0, 'the registry holds the block'); checks++
const withoutLater = registry.LATER_ENV_BLOCKS.slice(at + 1).filter(block => typeof block === 'string').reduce((out, block) => out.replace(`\n${block}`, ''), env)
assert.ok(withoutLater.endsWith(`\n\n${BLOCK}`)); checks++ // the true end of the file, once the blocks registered after this one are out
// the strip takes it out and leaves the rest as it was, byte for byte (read through the registry on both sides: no pinned base)
const without = env.replace(`\n${BLOCK}`, '')
assert.ok(!without.includes(FLAG)); checks++
assert.equal(registry.stripLaterChanges(ENV, env), registry.stripLaterChanges(ENV, without)); checks++
assert.ok(!registry.stripLaterChanges(ENV, env).includes(FLAG)); checks++
assert.equal(registry.stripLaterChanges(ENV, registry.stripLaterChanges(ENV, env)), registry.stripLaterChanges(ENV, env)); checks++ // idempotent
// made-up text: the block last, in the middle, or before an unregistered later block
const base = 'A_ONE="x"\n\n# a comment\nB_TWO=\n'
const later = '# a later block\nC_THREE="false"\n'
assert.equal(registry.stripLaterEnvBlocks(ENV, `${base}\n${BLOCK}`), base); checks++
assert.equal(registry.stripLaterEnvBlocks(ENV, `${base}\n${BLOCK}\n${later}`), `${base}\n${later}`); checks++
assert.equal(registry.stripLaterEnvBlocks('other.txt', `${base}\n${BLOCK}`), `${base}\n${BLOCK}`); checks++ // only .env.example
assert.equal(stripOwnerCuid(ENV, env), env); checks++ // this change's own strip is the page's; the block is the registry's to take out
// registration: its three lines, one in each list, each at the end of its list (only other changes' registered lines after it)
assert.ok(registry.LATER_STRIPS.includes(stripOwnerCuid) && [...OWNER_CUID_SCOPE_FILES].every(rel => registry.LATER_CHANGE_FILES.has(rel))); checks++
assert.deepEqual([...OWNER_CUID_SCOPE_FILES].sort(), ['.env.example', 'app/builder/page.tsx', 'lib/studio-upload-owner.ts', 'scripts/studio-later-changes.mjs', 'scripts/studio-owner-cuid-strip.mjs', 'scripts/test-studio-upload-owner.mjs']); checks++
const regLines = fs.readFileSync(path.join(REPO, 'scripts/studio-later-changes.mjs'), 'utf8').split('\n')
const sectionOf = i => regLines.slice(0, i).reduce((name, line) => /^export const (LATER_\w+) = /.exec(line)?.[1] ?? name, '')
const own = regLines.map((line, i) => [line, i]).filter(([line]) => line.includes("'./studio-owner-cuid-strip.mjs'"))
assert.deepEqual(own.map(([line, i]) => [sectionOf(i), /\)\.(\w+), \/\/ LATER-CHANGE: /.exec(line)?.[1]]), [['LATER_CHANGE_FILES', 'OWNER_CUID_SCOPE_FILES'], ['LATER_ENV_BLOCKS', 'OWNER_CUID_ENV_BLOCK'], ['LATER_STRIPS', 'stripOwnerCuid']]); checks++
for (const [, i] of own) for (let j = i + 1; !/^\]\)?$/.test(regLines[j]); j++) assert.match(regLines[j], /^ {2}(\.\.\.)?\(await import\('\.\/studio-[\w-]+\.mjs'\)\)\.\w+, \/\/ LATER-CHANGE: |^ {2}\/\/ one line per later change/); checks++

console.log(`test-studio-upload-owner: ${checks} checks passed`)
