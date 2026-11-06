import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { LATER_CHANGE_FILES, LATER_STRIPS, stripLaterEnvBlocks } from './studio-later-changes.mjs' // LATER-CHANGES: registry read (API-HARDENING, restack onto 1bb42d7f): the later changes' .env.example blocks; LATER_STRIPS (Option L chain): the marked lines of the changes registered before this one
import { PREPROMO_BASE, PREPROMO_DELETED } from './studio-prepromo-strip.mjs' // LATER-CHANGES: registry read (API-HARDENING, restack onto 21b5fc08): #571 deletes the mock-token route (C-07), so this pin reads the route's base text from git at PREPROMO_BASE

// Studio API hardening v1 (security audit items 2, 5, 6, 7, 9, 10; item 4, the mock-token deletion, lives in #571). Pure decisions are executed from
// lib/api-hardening-core.ts; the route wiring is pinned by reading the route sources. No network, no database.
const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const exists = path => fs.existsSync(new URL(`../${path}`, import.meta.url))
const load = path => {
  const module = { exports: {} }
  const js = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(js, { module, exports: module.exports, process: { env: {} } })
  return module.exports
}
const core = load('lib/api-hardening-core.ts')
const same = (actual, expected, message) => assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected, message)
const ON = { STUDIO_API_HARDENING_V1_ENABLED: 'true' }

// ---- flag
assert.equal(core.isApiHardeningEnabled({}), false)
assert.equal(core.isApiHardeningEnabled({ STUDIO_API_HARDENING_V1_ENABLED: 'TRUE' }), false)
assert.equal(core.isApiHardeningEnabled(ON), true)
assert.equal(core.STUDIO_API_HARDENING_FLAG.startsWith('NEXT_PUBLIC'), false)

// ---- #2 approved gate
same(core.approvalVerdict({ enabled: false, userId: null }), { allowed: true })
assert.equal(core.approvalVerdict({ enabled: true, userId: null }).status, 401)
assert.equal(core.approvalVerdict({ enabled: true, userId: 'u1', found: true, approved: false }).status, 403)
assert.equal(core.approvalVerdict({ enabled: true, userId: 'u1', found: false }).status, 403)
assert.equal(core.approvalVerdict({ enabled: true, userId: 'u1', lookupFailed: true }).status, 503)
same(core.approvalVerdict({ enabled: true, userId: 'u1', found: true, approved: true }), { allowed: true })

// ---- #5 allow-lists + ownership
const picked = core.pickAllowedKeys({ session_id: 's', user_id: 'victim', instruction: 'x', evil: 1, theme: undefined }, core.COMPOSE_BODY_KEYS)
same(picked, { session_id: 's', instruction: 'x' })
for (const keys of [core.COMPOSE_BODY_KEYS, core.REFINE_BODY_KEYS, core.HANDOFF_BODY_KEYS]) assert.equal(keys.includes('user_id'), false)
// Every key the Studio clients send survives the allow-list.
for (const key of ['session_id', 'presentation_id', 'insert_after_index', 'instruction', 'theme', 'selections', 'research', 'job_id', 'async', 'assume_on_missing']) assert.ok(core.COMPOSE_BODY_KEYS.includes(key), key)
for (const key of ['slide_id', 'slide_index']) assert.ok(core.REFINE_BODY_KEYS.includes(key), key)
for (const key of ['idempotency_key', 'pending_request', 'theme', 'template_mode', 'template_id', 'research', 'store_name', 'attachment_store_references', 'manual_deck_summary']) assert.ok(core.HANDOFF_BODY_KEYS.includes(key), key)
assert.equal(core.sessionOwnershipVerdict({ userId: 'u1', sessionId: '', sessionOwnerId: 'u1' }).status, 400)
assert.equal(core.sessionOwnershipVerdict({ userId: 'u1', sessionId: 's', sessionOwnerId: null }).status, 404)
assert.equal(core.sessionOwnershipVerdict({ userId: 'u1', sessionId: 's', sessionOwnerId: 'u1', sessionStatus: 'deleted' }).status, 404)
assert.equal(core.sessionOwnershipVerdict({ userId: 'u1', sessionId: 's', sessionOwnerId: 'u2' }).status, 403)
assert.equal(core.sessionOwnershipVerdict({ userId: 'u1', sessionId: 's', sessionOwnerId: 'u1', presentationOwnerIds: ['u1', 'u2'] }).status, 403)
same(core.sessionOwnershipVerdict({ userId: 'u1', sessionId: 's', sessionOwnerId: 'u1', presentationOwnerIds: ['u1'] }), { allowed: true })

// ---- #9 admin identity
const offEnv = { DEV_BYPASS_EMAIL: 'dev@x.com', ADMIN_EMAILS: 'boss@x.com' }
assert.equal(core.isAdminEmail('dev@x.com', offEnv), true, 'flag off keeps the old rule')
assert.equal(core.isAdminEmail('boss@x.com', offEnv), false)
const onEnv = { ...offEnv, ...ON, ADMIN_EMAILS: ' Boss@x.com , ops@x.com ' }
assert.equal(core.isAdminEmail('dev@x.com', onEnv), false, 'DEV_BYPASS_EMAIL alone is not admin')
assert.equal(core.isAdminEmail('boss@x.com', onEnv), true)
assert.equal(core.isAdminEmail('OPS@x.com', onEnv), true)
assert.equal(core.isAdminEmail(null, onEnv), false)
assert.equal(core.isAdminEmail('dev@x.com', { ...ON, DEV_BYPASS_EMAIL: 'dev@x.com' }), false, 'unset ADMIN_EMAILS = nobody')
assert.equal(core.isAdminEmail('dev@x.com', { ...ON, DEV_BYPASS_EMAIL: 'dev@x.com', ADMIN_EMAILS: ' , ' }), false, 'empty list = nobody')
assert.equal(core.isAdminEmail('', { ...ON, ADMIN_EMAILS: '' }), false, 'empty email with an empty list is not admin')
assert.equal(core.isAdminEmail('', { DEV_BYPASS_EMAIL: '' }), false, 'flag off: an empty email never matches an empty DEV_BYPASS_EMAIL')
assert.equal(core.isAdminEmail(undefined, { DEV_BYPASS_EMAIL: undefined }), false)
assert.equal(core.isAdminEmail('Dev@x.com', offEnv), false, 'flag off keeps the exact-case rule')
assert.equal(core.isAdminEmail('boss@x.com', { ...offEnv, STUDIO_API_HARDENING_V1_ENABLED: 'false' }), false)

// ---- #7 unlock lockout
same(core.unlockVerdict({ ipFailures: 4, slugFailures: 49 }), { allowed: true })
assert.equal(core.unlockVerdict({ ipFailures: 5, slugFailures: 0 }).allowed, false)
assert.equal(core.unlockVerdict({ ipFailures: 0, slugFailures: 50 }).allowed, false)
assert.equal(core.passcodeLengthPlausible('12345', 6), false)
assert.equal(core.passcodeLengthPlausible('123456', 6), true)
assert.equal(core.passcodeLengthPlausible('x'.repeat(129), 6), false)

// ---- #6 spoken-answer cache path
assert.equal(core.spokenAnswerCachePath('nova', 'abc123', 'mp3'), 'spoken/answers/nova.abc123.mp3')
assert.equal(core.spokenAnswerCachePath('../x', 'k/y', 'mp3').split('/').length, 3, 'caller text cannot add path segments')

// ---- route wiring
const costRoutes = [
  'app/api/director/ws-token/route.ts', 'app/api/identity/text-labs-token/route.ts',
  'app/api/slides/compose/route.ts', 'app/api/slides/refine/route.ts',
  'app/api/director/sessions/[sourceSessionId]/handoff/route.ts',
  'app/api/narration/render/route.ts', 'app/api/narration/script/route.ts', 'app/api/narration/voice/sample/[voiceId]/route.ts',
  'app/api/upload/route.ts', 'app/api/studio-deck-import/route.ts',
  'app/api/templates/route.ts', 'app/api/templates/[id]/enrich/route.ts', 'app/api/templates/[id]/blueprint/route.ts',
  'app/api/themes/route.ts',
  'app/api/knowledge-graph/backfill/route.ts', 'app/api/knowledge-graph/query/route.ts', 'app/api/knowledge-graph/search/route.ts',
]
for (const route of costRoutes) {
  const src = read(route)
  assert.match(src, /import \{[^}]*requireApprovedUser[^}]*\} from '@\/lib\/api-hardening'/, route)
  assert.match(src, /const notApproved = await requireApprovedUser\(\)\n\s+if \(notApproved\) return notApproved/, route)
}
for (const route of ['app/api/slides/compose/route.ts', 'app/api/slides/refine/route.ts', 'app/api/director/sessions/[sourceSessionId]/handoff/route.ts', 'app/api/slides/jobs/[jobId]/route.ts']) {
  assert.match(read(route), /await requireSessionOwner\(sessionUser\?\.id,/, `${route} owner check uses the id, not the e-mail`)
}
for (const route of ['app/api/slides/compose/route.ts', 'app/api/slides/refine/route.ts', 'app/api/director/sessions/[sourceSessionId]/handoff/route.ts']) {
  assert.match(read(route), /isApiHardeningEnabled\(\) \? pickAllowedKeys\(body, [A-Z_]+_BODY_KEYS\) : body/, route)
}
// Server-side flag only.
assert.equal(read('lib/api-hardening.ts').includes('NEXT_PUBLIC'), false)
assert.equal(read('lib/api-hardening-core.ts').includes('NEXT_PUBLIC_'), false)
// Off = no session or DB read before the flag check.
assert.match(read('lib/api-hardening.ts'), /requireApprovedUser\(\): Promise<NextResponse \| null> \{\n\s+if \(!isApiHardeningEnabled\(\)\) return null/)

// #4 is not this branch's: the mock-token deletion lives in #571, so the route is the base's, byte for byte (pinned in the strip section below).

// #10 activate compares the id (unflagged).
const activate = read('app/api/sessions/[id]/activate/route.ts')
assert.match(activate, /chatSession\.userId !== userId/)
assert.equal(activate.includes('chatSession.userId !== session.user.email'), false)

// #9 admin routes + middleware go through isAdminEmail.
for (const route of ['app/api/admin/users/route.ts', 'app/api/admin/users/approve/route.ts', 'app/api/admin/coupons/route.ts', 'app/api/admin/coupons/[id]/route.ts', 'app/api/admin/cleanup-sessions/route.ts', 'middleware.ts']) {
  const src = read(route)
  assert.match(src, /isAdminEmail\(/, route)
  assert.equal(/!==? process\.env\.DEV_BYPASS_EMAIL|=== process\.env\.DEV_BYPASS_EMAIL/.test(src), false, route)
}

// #7 unlock + #6 speak wiring.
const unlock = read('app/api/publish/[slug]/unlock/route.ts')
assert.match(unlock, /unlockVerdict\(\{ ipFailures, slugFailures \}\)/)
assert.match(unlock, /status: 429/)
assert.match(unlock, /recordRateEvent\(RATE_BUCKET_UNLOCK/)
const speak = read('app/api/narration/speak/route.ts')
assert.match(speak, /spokenAnswerCachePath\(/)
assert.match(speak, /evaluateLimits\(\{/)
assert.match(speak, /putMedia\(cachePath/)
assert.match(read('prisma/schema.prisma'), /@@map\("fe_api_rate_events"\)/)
assert.ok(exists('prisma/sql/20261104_api_rate_events.sql'))

// ---- strip, registry, .env.example block, own commits (FRONTEND-1 completion, 4 Nov) ---------------------------
const { execFileSync } = await import('node:child_process')
const strip = await import('./studio-api-hardening-strip.mjs')
const registry = await import('./studio-later-changes.mjs')
const repo = new URL('..', import.meta.url).pathname
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
const BASE = process.env.API_HARDENING_BASE || strip.BASE_COMMIT
const baseOf = rel => { try { return git('show', `${BASE}:${rel}`) } catch { return null } }
const otherStrips = (rel, text) => typeof text !== 'string' || rel !== 'prisma/schema.prisma' ? text : LATER_STRIPS.filter(fn => fn !== strip.stripApiHardening).reduce((out, fn) => { const next = typeof fn === 'function' ? fn(rel, out) : out; return typeof next === 'string' ? next : out }, text) // LATER-CHANGES: registry read (API-HARDENING, Option L chain): the schema is read as this change left it, whatever the changes registered before it marked in it (#576's schema model, added after BASE); every other owned file is compared as before, because the registered strips of changes already in BASE put back older text this change's pairs do not expect

/** Every failure of the strip / registry contract for a file map (rel -> text now). Empty = holds. */
function stripFailures(files, mod = strip) {
  const out = []
  for (const rel of [...Object.keys(mod.API_HARDENING_EDITS), '.env.example']) {
    const now = files[rel]
    if (typeof now !== 'string') { out.push(`${rel}: missing`); continue }
    if (now === baseOf(rel)) out.push(`${rel}: not changed by this change`)
    if ((rel === '.env.example' ? stripLaterEnvBlocks(rel, mod.stripApiHardening(rel, now)) : mod.stripApiHardening(rel, otherStrips(rel, now))) !== (rel === '.env.example' ? stripLaterEnvBlocks(rel, baseOf(rel)) : otherStrips(rel, baseOf(rel)))) out.push(`${rel}: strip does not give the base byte for byte`) // LATER-CHANGES: registry read (API-HARDENING): .env.example is compared without the blocks other registered changes appended after BASE
  }
  for (const rel of mod.API_HARDENING_NEW_FILES) if (baseOf(rel) !== null) out.push(`${rel}: listed as new but in the base`)
  if (mod.API_HARDENING_DELETED.length) out.push('this branch deletes nothing (the mock-token deletion lives in #571)')
  if (files['app/api/dev/mock-token/route.ts'] !== baseOf('app/api/dev/mock-token/route.ts')) out.push('app/api/dev/mock-token/route.ts is not the base byte for byte')
  for (const rel of ['app/api/admin/coupons/route.ts', 'app/api/admin/coupons/[id]/route.ts', 'app/api/admin/cleanup-sessions/route.ts']) {
    if (!/return isAdminEmail\(email\)/.test(files[rel] || '')) out.push(`${rel}: isAdmin does not go through isAdminEmail`)
    if (/DEV_BYPASS_EMAIL\n/.test((files[rel] || '').replace(/\/\/.*$/gm, ''))) out.push(`${rel}: still compares DEV_BYPASS_EMAIL in code`)
  }
  const env = files['.env.example'] || ''
  if (env.split('\n' + mod.API_HARDENING_ENV_BLOCK).length !== 2) out.push('.env.example: the block is not there exactly once')
  if (!registry.LATER_ENV_BLOCKS.slice(registry.LATER_ENV_BLOCKS.indexOf(mod.API_HARDENING_ENV_BLOCK) + 1).reduce((text, block) => { const body = String(block).replace(/^\n+/, '').replace(/\n+$/, ''); return body === '' ? text : text.replace(`\n${body}\n`, () => '') }, env).endsWith(mod.API_HARDENING_ENV_BLOCK)) out.push('.env.example: the block is not at the end') // LATER-CHANGES: registry read (BILLING-F4F6): the block is the last one of this change and the ones before it; the blocks registered AFTER this one (#569, #584 ...) are read past
  if (!/^STUDIO_API_HARDENING_V1_ENABLED="false"$/m.test(mod.API_HARDENING_ENV_BLOCK) || !/^ADMIN_EMAILS=""$/m.test(mod.API_HARDENING_ENV_BLOCK)) out.push('env block: flag off and ADMIN_EMAILS empty')
  return out
}

/** The registry's three lines: present once, LATER-CHANGE marked, last in each list. */
function registryFailures(text) {
  const out = []
  for (const [list, name] of [['LATER_CHANGE_FILES', 'API_HARDENING_SCOPE_FILES'], ['LATER_ENV_BLOCKS', 'API_HARDENING_ENV_BLOCK'], ['LATER_STRIPS', 'stripApiHardening']]) {
    const body = (text.split(`export const ${list} = `)[1] || '').split('\n  // one line per later change, above this comment')[0]
    const lines = body.split('\n').filter(line => line.includes('LATER-CHANGE'))
    const mine = lines.filter(line => line.includes(`'./studio-api-hardening-strip.mjs')).${name}`))
    if (mine.length !== 1) out.push(`${list}: ${mine.length} lines`)
    else if (((base) => lines.slice(lines.indexOf(mine[0]) + 1).some(line => base.includes(line)))(((baseOf('scripts/studio-later-changes.mjs') || '').split(`export const ${list} = `)[1] || '').split('\n  // one line per later change, above this comment')[0].split('\n'))) out.push(`${list}: not after every line of its base`) // LATER-CHANGES: registry read (BILLING-F4F6): this change's line comes after every line its base registry has; the lines registered AFTER it (#569, #584 ...) are read past
  }
  return out
}

const owned = [...Object.keys(strip.API_HARDENING_EDITS), '.env.example', 'app/api/dev/mock-token/route.ts', 'app/api/admin/coupons/route.ts', 'app/api/admin/coupons/[id]/route.ts', 'app/api/admin/cleanup-sessions/route.ts']
const MOCK = 'app/api/dev/mock-token/route.ts'
const mockDeletedLater = PREPROMO_DELETED.includes(MOCK) && LATER_CHANGE_FILES.has(MOCK) && !exists(MOCK) // LATER-CHANGES: registry read (API-HARDENING, restack onto 21b5fc08): a registered later change deletes the route; every assertion about it below is unchanged and reads its base text
const files = Object.fromEntries(owned.map(rel => [rel, rel === MOCK && mockDeletedLater ? git('show', `${PREPROMO_BASE}:${MOCK}`) : read(rel)])) // LATER-CHANGES: registry read (API-HARDENING, restack onto 21b5fc08): mock-token from PREPROMO_BASE when a registered later change deletes it
same(stripFailures(files), [], 'strip contract')
same(registryFailures(read('scripts/studio-later-changes.mjs')), [], 'registry lines')
assert.ok(registry.LATER_CHANGE_FILES.has('app/api/admin/coupons/route.ts'))
assert.ok(registry.LATER_ENV_BLOCKS.includes(strip.API_HARDENING_ENV_BLOCK))
assert.ok(registry.LATER_STRIPS.includes(strip.stripApiHardening))
for (const rel of Object.keys(strip.API_HARDENING_EDITS)) assert.ok(strip.API_HARDENING_SCOPE_FILES.has(rel), rel)

// own commits, by subject: every file an own commit touches is in scope, and every scope file that differs from the base was touched by an own commit.
const own = git('log', '--no-merges', '--format=%H %s', `${BASE}..HEAD`).split('\n').filter(Boolean).filter(line => line.slice(41).includes(strip.API_HARDENING_SUBJECT))
assert.ok(own.length >= 1, 'at least one own commit')
const ownFiles = new Set(own.flatMap(line => git('show', '--name-only', '--format=', line.slice(0, 40)).split('\n').filter(Boolean)))
for (const rel of ownFiles) assert.ok(strip.API_HARDENING_SCOPE_FILES.has(rel) || git('diff', '--name-only', `${BASE}..HEAD`, '--', rel).trim() === (rel === MOCK && mockDeletedLater ? MOCK : ''), `own commit touches ${rel}, outside scope, and leaves it changed`) // a file put back to the base (mock-token, the D1 proof) nets to nothing; LATER-CHANGES: registry read (API-HARDENING, restack onto 21b5fc08): mock-token nets to exactly the registered later change's deletion
const changed = git('diff', '--name-only', `${BASE}..HEAD`).split('\n').filter(Boolean).filter(rel => strip.API_HARDENING_SCOPE_FILES.has(rel))
for (const rel of changed) assert.ok(ownFiles.has(rel), `${rel} changed but not by an own commit`)
assert.equal(git('diff', '--name-only', `${BASE}..HEAD`, '--', 'app/api/dev/mock-token/route.ts').trim(), mockDeletedLater ? MOCK : '', 'mock-token untouched in the committed tree') // LATER-CHANGES: registry read (API-HARDENING, restack onto 21b5fc08): untouched, or exactly the registered later change's deletion

// mutants: each must be caught.
const mutants = {
  'coupons back to DEV_BYPASS_EMAIL': f => ({ ...f, 'app/api/admin/coupons/route.ts': f['app/api/admin/coupons/route.ts'].replace('return isAdminEmail(email)', 'return !!email && email === process.env.DEV_BYPASS_EMAIL') }),
  'cleanup-sessions edit lost a context byte': f => ({ ...f, 'app/api/admin/cleanup-sessions/route.ts': f['app/api/admin/cleanup-sessions/route.ts'].replace("import { isAdminEmail } from '@/lib/api-hardening-core'\n", "import { isAdminEmail } from '@/lib/api-hardening-core';\n") }),
  'mock-token deleted again': f => ({ ...f, 'app/api/dev/mock-token/route.ts': undefined }),
  'mock-token edited': f => ({ ...f, 'app/api/dev/mock-token/route.ts': f['app/api/dev/mock-token/route.ts'] + '\n' }),
  'env block twice': f => ({ ...f, '.env.example': f['.env.example'] + '\n' + strip.API_HARDENING_ENV_BLOCK }),
  'env block missing': f => ({ ...f, '.env.example': strip.stripApiHardening('.env.example', f['.env.example']) }),
  'middleware edit gone': f => ({ ...f, 'middleware.ts': strip.stripApiHardening('middleware.ts', f['middleware.ts']) }),
}
for (const [name, mutate] of Object.entries(mutants)) assert.ok(stripFailures(mutate(files)).length > 0, `mutant survived: ${name}`)
const deleting = { ...strip, API_HARDENING_DELETED: ['app/api/dev/mock-token/route.ts'] }
assert.ok(stripFailures(files, deleting).length > 0, 'mutant survived: strip lists mock-token as deleted')
const regText = read('scripts/studio-later-changes.mjs')
const regMutants = {
  'strip line removed': regText.replace(/\n.*\.stripApiHardening, \/\/ LATER-CHANGE.*/, ''),
  'env line above an older one': (() => { const mineLine = regText.split('\n').find(line => line.includes('.API_HARDENING_ENV_BLOCK, // LATER-CHANGE')), older = (baseOf('scripts/studio-later-changes.mjs') || '').split('\n').filter(line => /_ENV_BLOCK, \/\/ LATER-CHANGE/.test(line)).at(-1); return regText.replace(`${mineLine}\n`, () => '').replace(older, () => `${mineLine}\n${older}`) })(), // LATER-CHANGES: registry read (BILLING-F4F6): this change's block line moved above the last env block line its base has (a line registered before it), whatever was registered after it
  'scope line doubled': regText.replace(/(\n.*\.API_HARDENING_SCOPE_FILES, \/\/ LATER-CHANGE.*)/, '$1$1'),
}
for (const [name, text] of Object.entries(regMutants)) { assert.notEqual(text, regText, name); assert.ok(registryFailures(text).length > 0, `mutant survived: ${name}`) }
const admin = env => core.isAdminEmail('boss@x.com', env)
assert.ok([{ ...ON, ADMIN_EMAILS: 'BOSS@X.COM' }, { ...ON, ADMIN_EMAILS: 'a@x.com,boss@x.com' }].every(admin), 'list + case')

console.log('test-studio-api-hardening: all checks passed')
