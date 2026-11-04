import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

// Studio API hardening v1 (security audit items 2, 4, 5, 6, 7, 9, 10). Pure decisions are executed from
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

// #4 mock-token is gone (unflagged).
assert.equal(exists('app/api/dev/mock-token/route.ts'), false)

// #10 activate compares the id (unflagged).
const activate = read('app/api/sessions/[id]/activate/route.ts')
assert.match(activate, /chatSession\.userId !== userId/)
assert.equal(activate.includes('chatSession.userId !== session.user.email'), false)

// #9 admin routes + middleware go through isAdminEmail.
for (const route of ['app/api/admin/users/route.ts', 'app/api/admin/users/approve/route.ts', 'middleware.ts']) {
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

console.log('test-studio-api-hardening: all checks passed')
