// FRONTEND-2 P3-4 slice C: Director's job ledger in Studio (flag NEXT_PUBLIC_STUDIO_JOB_LEDGER, exact "true", default off, build-time).
// Director side: !527 (DIRECTOR_JOB_LEDGER_ENABLED), contract deckster-workspace streams/director2/job-ledger/CONTRACT.md.
//
//   node scripts/test-studio-job-ledger.mjs              # everything, offline, plain node (transpile + vm; no network, no build)
//   node scripts/test-studio-job-ledger.mjs --no-mutants
//
// What it proves:
//  1. lib/studio-job-ledger.ts (pure, import-free): the seq rule, terminal rows, the sync merge and [], the words for every failure code,
//     the Retry state machine (DIRECTOR-2's four rules: re-enable before the dedupe, the 15 s timeout, a retried row shows no card,
//     the newest row of a retry chain offers it), deck_build and the client route without Retry, Dismiss, the directive join;
//  2. the REAL Director socket hook, fed DIRECTOR-2's five RECORDED frame files (scripts/fixtures/studio-job-ledger, copied verbatim from
//     deckster-workspace 561f004ba29; sha256 checked below) one frame at a time, as the socket text of each frame: the page's callbacks get
//     exactly the rows; job_update never enters the transcript or the cache and does not unlock the turn; the card's Retry puts exactly
//     {"type":"job_retry","data":{"job_id":"<id>"}} on the socket, once per click;
//  3. flag off: the hook (this tree, four spellings of "off") and the base hook (BASE_COMMIT) put the same bytes on the socket and leave the
//     same transcript, state and cache for the same frames, and no callback is called;
//  4. the page's real wiring (its option spread and its card expression, cut out of app/builder/page.tsx and evaluated): the card mounts only
//     with the flag on (Studio shell), and the page passes the ledger's intake to the hook;
//  5. the strip module gives back BASE_COMMIT's files byte for byte, and the three shared strip roots chain it;
//  6. mutants, each caught.
// Rows marked "derived" are built from the contract's row shape (not recorded): the failed-retry chain, a client-route row, a deck_build
// row with a retry route, a refused row, and an impossible change after a terminal row.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import React from 'react'
import { Root, hostNodes, textOf } from './studio-chat-harness/mini-react.mjs'
import { createEnvironment } from './studio-chat-harness/fake-env.mjs'
import { createModuleLoader } from './studio-chat-harness/module-loader.mjs'
import { BASE_ENV } from './studio-chat-harness/profiles.mjs'
import { stripJobLedger, BASE_COMMIT, JOB_LEDGER_FILES, JOB_LEDGER_NEW_FILES, JOB_LEDGER_CHANGES } from './studio-job-ledger-strip.mjs'
import { stripOpenReadOnly } from './studio-open-read-only-strip.mjs'
import { stripDarkPersist } from './studio-theme-dark-persist-strip.mjs'
import { stripAddSlideStatus } from './studio-add-slide-status-strip.mjs'
import { stripNewDeckHandoffSend } from './studio-new-deck-handoff-send-strip.mjs' // stacked after #475: the new-deck handoff send puts its .env.example block between this block and # PASS2 ADMIN
import { stripPublishPreviewInventory } from './studio-publish-preview-inventory-strip.mjs' // #475 stacked: the Publish preview from Layout's inventory (NEXT_PUBLIC_STUDIO_PUBLISH_PREVIEW_INVENTORY_ENABLED) puts its .env.example block after the new-deck handoff's
import { stripLaunchWording } from './studio-launch-wording-strip.mjs' // NEXT_PUBLIC_STUDIO_LAUNCH_WORDING (launched wording): its flag-gated edits come out first, before every older change's strip
import { stripPublishReviewFit } from './studio-publish-review-fit-strip.mjs' // stacked after #475: the publish review fit change puts its .env.example block between this block and # PASS2 ADMIN too
import { stripVersionHistoryDeckOnly } from './studio-version-history-deck-only-strip.mjs' // stacked after #475: the version history deck-only change puts its .env.example block between this block and # PASS2 ADMIN too
import { stripComposeEntitlement } from './studio-compose-entitlement-strip.mjs' // stacked after #475: Add Slide compose signs its user puts its .env.example block between that one and # PASS2 ADMIN

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = rel => stripLaunchWording(rel, fs.readFileSync(path.join(root, rel), 'utf8'))
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const plain = value => JSON.parse(JSON.stringify(value === undefined ? null : value))
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
const baseFile = rel => git('show', `${BASE_COMMIT}:${rel}`)

const FLAG = 'NEXT_PUBLIC_STUDIO_JOB_LEDGER'
const LIB = 'lib/studio-job-ledger.ts'
const HOOK = 'hooks/use-deckster-websocket-v2.ts'
const PAGE = 'app/builder/page.tsx'
const CARD = 'components/builder/chat/studio-job-ledger-card.tsx'
const CSS = 'components/builder/chat/studio-job-ledger-card.css'
const ENV = '.env.example'
const FIXTURES = 'scripts/fixtures/studio-job-ledger'
// sha256 of DIRECTOR-2's recorded files (deckster-workspace 561f004ba29, streams/director2/job-ledger/), copied verbatim.
const RECORDED = {
  'job-update-each-state.json': '50769d46a8f33916955a9f31f776127a13c9d7566d8ebb5505566187899405df',
  'job-retry-round-trip.json': '2868172ae0835ad37174a967f753e9e0011dc3e873fc86c8cc8dc411ca2495b0',
  'directive-never-answered.json': 'e05440cd584878d9505bf9b2d44f480c2817dc87382ee417b17f24317bef43ac',
  'deck-build-stall.json': 'd0e9984b3b74eef528364018986ec068992cd37aa17c71481cb61a2c4abd9210',
  'sync-response-with-jobs.json': 'd69c74140ad50e56289892062fc53c7f1c2f6c1aeb5f1bcb394addd2b47af985',
}
const recordedText = Object.fromEntries(Object.keys(RECORDED).map(name => [name, read(`${FIXTURES}/${name}`)]))
const rec = Object.fromEntries(Object.entries(recordedText).map(([name, text]) => [name, JSON.parse(text)]))
const EACH = rec['job-update-each-state.json'], ROUND = rec['job-retry-round-trip.json'], DIRECTIVE = rec['directive-never-answered.json']
const STALL = rec['deck-build-stall.json'], SYNC = rec['sync-response-with-jobs.json']
const SESSION = 's_e2e', RESTART_SESSION = 'sess-restart'
const A = 'mdc_84655ee777f4', B = 'mdc_224648c1d2a2', EL = 'el_0e870f857120', BUILD = 'bld_5f3a9c1d2e7b', LOST = 'mdc_lost00000001'
const EACH_ORDER = ['queued', 'running', 'failed', 'done', 'timed_out', 'cancelled', 'failed_lost_on_restart']
const ALL_FRAMES = [ // every recorded Director-to-Studio frame, in file order
  ...EACH_ORDER.map(k => EACH[k]), ...ROUND['1_chat_compose_fails'], ...ROUND['3_outbound_after_job_retry'], ...ROUND['4_second_job_retry_same_old_id_answers'],
  ...DIRECTIVE.directive_and_running_row, ...DIRECTIVE.after_deadline, ...STALL, SYNC,
]
const JOB_RETRY_BYTES = JSON.stringify(ROUND['2_inbound_job_retry']) // what Director received in the recording
const derive = (row, patch) => ({ ...plain(row), ...patch })

const SOURCES = Object.fromEntries([LIB, HOOK, PAGE, CARD, CSS, ENV].map(rel => [rel, read(rel)]))
SOURCES[ENV] = stripPublishPreviewInventory(ENV, SOURCES[ENV]) // #475 stacked: that latest block (NEXT_PUBLIC_STUDIO_PUBLISH_PREVIEW_INVENTORY_ENABLED) comes out first, before the new-deck handoff's
SOURCES[ENV] = stripNewDeckHandoffSend(ENV, SOURCES[ENV]) // stacked after #475: that later block (NEXT_PUBLIC_STUDIO_NEW_DECK_HANDOFF_SEND) comes out first, so this block is still right before # PASS2 ADMIN
SOURCES[ENV] = stripPublishReviewFit(ENV, SOURCES[ENV]) // stacked after #475: that later block (NEXT_PUBLIC_STUDIO_PUBLISH_REVIEW_FIT) comes out first too, so this block is still right before # PASS2 ADMIN
SOURCES[ENV] = stripVersionHistoryDeckOnly(ENV, SOURCES[ENV]) // stacked after #475: that later block (NEXT_PUBLIC_STUDIO_VERSION_HISTORY_DECK_ONLY) comes out first too, so this block is still right before # PASS2 ADMIN
SOURCES[ENV] = stripComposeEntitlement(ENV, SOURCES[ENV]) // stacked after #475: the block after that (STUDIO_COMPOSE_ENTITLEMENT_ENABLED) comes out too, so this block is still right before # PASS2 ADMIN

let checks = 0
const quiet = { on: false }
const failures = []
async function check(label, fn) {
  if (quiet.on) { await fn(); checks++; return }
  try { await fn(); checks++; console.log(`PASS ${label}`) } catch (error) { failures.push(label); console.error(`FAIL ${label}: ${error?.stack?.split('\n').slice(0, 4).join(' | ') ?? error}`) }
}

// ---- 1. the lib, plain -------------------------------------------------------------------------------------------------------------
const transpile = (text, jsx = false) => ts.transpileModule(text, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, ...(jsx ? { jsx: ts.JsxEmit.ReactJSX } : {}) },
}).outputText
function loadLib(text, env = {}) {
  const mod = { exports: {} }
  vm.runInNewContext(transpile(text), { module: mod, exports: mod.exports, process: { env: { ...env } }, require: id => { throw new Error(`the lib must stay import-free: ${id}`) } })
  return mod.exports
}

async function libChecks(src) {
  const lib = loadLib(src[LIB], { [FLAG]: 'true' })
  const L = lib.EMPTY_JOB_LEDGER
  const apply = (ledger, ...rows) => rows.reduce((next, row) => lib.applyJobUpdate(next, row), ledger)
  const sync = (ledger, rows) => lib.applyJobsSync(ledger, rows)
  const cards = (ledger, now = 0) => plain(lib.jobLedgerCards(ledger, now))
  const card = (ledger, id, now = 0) => cards(ledger, now).find(c => c.jobId === id) ?? null
  const failedA = EACH.failed.payload, queuedA = EACH.queued.payload, runningA = EACH.running.payload
  const queuedB = ROUND['3_outbound_after_job_retry'][0].payload, runningB = ROUND['3_outbound_after_job_retry'][1].payload, doneB = ROUND['3_outbound_after_job_retry'][3].payload
  const one = apply(L, queuedA, runningA, failedA) // A: queued -> running -> failed (recorded)

  await check('lib: the flag is on for the exact value "true" only', () => {
    assert.equal(lib.STUDIO_JOB_LEDGER_ENABLED, true)
    for (const value of [undefined, '', 'false', 'TRUE', 'True', '1', ' true', 'true ', 'yes']) assert.equal(loadLib(src[LIB], value === undefined ? {} : { [FLAG]: value }).STUDIO_JOB_LEDGER_ENABLED, false, JSON.stringify(value))
    assert.equal(lib.JOB_UPDATE_TYPE, 'job_update')
  })
  await check('lib: a row is passed on exactly as it came; a broken one is refused; jobs [] is a list, a missing jobs is null', () => {
    for (const frame of ALL_FRAMES.filter(f => f.type === 'job_update')) assert.equal(lib.jobLedgerRow(frame.payload), frame.payload)
    for (const bad of [null, undefined, 'x', [], {}, { ...failedA, job_id: '' }, { ...failedA, seq: 0 }, { ...failedA, seq: 1.5 }, { ...failedA, seq: '3' }, { ...failedA, state: 'paused' }, { ...failedA, kind: '' }]) assert.equal(lib.jobLedgerRow(bad), null, JSON.stringify(bad))
    assert.deepEqual(plain(lib.jobLedgerRows(SYNC.payload.jobs)), SYNC.payload.jobs)
    assert.deepEqual(plain(lib.jobLedgerRows([])), [])
    assert.deepEqual(plain(lib.jobLedgerRows([failedA, { job_id: 'x' }])), [failedA])
    for (const missing of [undefined, null, {}, 'jobs']) assert.equal(lib.jobLedgerRows(missing), null)
  })
  await check('lib: the highest seq is kept per job_id (queued 1, running 2, failed 3)', () => {
    assert.deepEqual(plain(one.rows), { [A]: failedA })
    assert.deepEqual(plain(apply(L, queuedA).rows[A]), queuedA)
    assert.deepEqual(plain(apply(L, queuedA, runningA).rows[A]), runningA)
  })
  await check('lib: a frame with the same seq is dropped (the duplicate is not taken, even with other content)', () => {
    const duplicate = derive(failedA, { updated_at: '2027-01-15T08:09:00.000Z', failure: { code: 'refused', retryable: false }, retry: null }) // derived
    assert.equal(lib.applyJobUpdate(one, duplicate), one)
    assert.deepEqual(plain(lib.applyJobUpdate(one, duplicate).rows[A]), failedA)
    assert.equal(lib.applyJobUpdate(one, failedA), one)
    const moving = apply(L, ...STALL.slice(0, 2).map(f => f.payload)) // an open row (the build's moved deadline, seq 2): the seq rule alone drops a repeat
    const repeat = derive(STALL[1].payload, { deadline_at: '2027-01-15T08:30:00.000Z' }) // derived
    assert.equal(lib.applyJobUpdate(moving, repeat), moving)
    assert.equal(sync(moving, [repeat]), moving)
    assert.deepEqual(plain(moving.rows[BUILD]), STALL[1].payload)
  })
  await check('lib: a frame with a lower seq is dropped', () => {
    assert.equal(lib.applyJobUpdate(one, runningA), one)
    assert.equal(lib.applyJobUpdate(one, queuedA), one)
    const running = apply(L, queuedA, runningA)
    assert.equal(lib.applyJobUpdate(running, queuedA), running)
  })
  await check('lib: a terminal row never changes again (derived seq 4 after failed / done / timed out / cancelled is dropped)', () => {
    for (const terminal of [failedA, doneB, EACH.timed_out.payload, EACH.cancelled.payload]) {
      const held = apply(L, terminal)
      const later = derive(terminal, { seq: terminal.seq + 1, state: 'running', failure: null, retry: null }) // derived: the contract says this never happens
      assert.equal(lib.applyJobUpdate(held, later), held, terminal.state)
      assert.equal(sync(held, [later]), held, `${terminal.state} (sync)`)
      assert.equal(lib.isTerminalJobState(terminal.state), true)
    }
    for (const open of ['queued', 'running']) assert.equal(lib.isTerminalJobState(open), false)
  })
  await check('lib: sync_response jobs merge by the same rule; [] changes nothing; a sync never erases or downgrades a row', () => {
    const synced = sync(L, lib.jobLedgerRows(SYNC.payload.jobs))
    assert.deepEqual(plain(synced.rows), { [LOST]: SYNC.payload.jobs[0], exp_0123456789ab: SYNC.payload.jobs[1] })
    assert.equal(sync(one, []), one, '[]: the same ledger')
    assert.equal(sync(synced, []), synced, '[]: nothing erased')
    assert.equal(sync(one, [runningA, queuedA]), one, 'an older seq in a sync does not replace the newer local row')
    assert.deepEqual(plain(sync(one, [SYNC.payload.jobs[1]]).rows[A]), failedA, 'a row the sync does not list is kept')
    assert.deepEqual(plain(sync(apply(L, queuedA), [failedA]).rows[A]), failedA, 'a newer synced row is taken')
    assert.deepEqual(cards(sync(one, [])), cards(one))
  })
  await check('lib: the cards are the failed (lost_on_restart included) and timed-out rows, newest first; done, cancelled, queued and running show nothing', () => {
    const all = apply(L, ...EACH_ORDER.map(k => EACH[k].payload))
    assert.deepEqual(cards(all).map(c => [c.jobId, c.state]), [[LOST, 'failed'], [EL, 'timed_out']], 'same updated_at: the latest change first; A is retried by the done row, so it has no card')
    const later = apply(all, ...STALL.map(f => f.payload))
    assert.equal(cards(later)[0].jobId, BUILD, 'a later updated_at comes first')
    for (const state of ['done', 'cancelled', 'queued', 'running']) assert.equal(lib.isShownJobState(state), false, state)
    assert.equal(cards(apply(L, doneB)).length, 0)
    assert.equal(cards(apply(L, EACH.cancelled.payload)).length, 0)
    assert.equal(cards(apply(L, queuedA, runningA)).length, 0)
  })
  await check("lib: Studio's own words for every failure code of the closed list, kind-aware, never a code, id or raw error", () => {
    const want = [
      [failedA, "Adding a slide didn't finish", 'Something it relies on had a problem.'],
      [EACH.timed_out.payload, 'Adding an element to slide 4 ran out of time', 'It may still have gone through. Check slide 4 before you try again.'],
      [EACH.failed_lost_on_restart.payload, 'Adding a slide was interrupted', 'Deckster restarted while it was running, so it may not have finished.'],
      [STALL[2].payload, "The build hasn't made progress for a while", 'It may still pick up. If it has stopped, use Resume to continue it.'],
      [EACH.cancelled.payload, 'Changing the theme was stopped', 'It was stopped on request, so nothing more will happen.'],
      [derive(EACH.cancelled.payload, { state: 'failed', failure: { code: 'refused', retryable: false } }), "Changing the theme wasn't accepted", 'Nothing was changed.'],
      [derive(failedA, { kind: 'slide_refine', failure: { code: 'not_found', retryable: false }, retry: null }), "Refining slide 4 couldn't go ahead", "What it was meant to change isn't there any more."],
      [derive(SYNC.payload.jobs[1], { state: 'timed_out', failure: { code: 'deadline_exceeded', retryable: true } }), 'The export ran out of time', 'It may still have finished. Check your downloads before you try again.'],
      [derive(EACH.cancelled.payload, { state: 'timed_out', failure: { code: 'deadline_exceeded', retryable: true } }), 'Changing the theme ran out of time', 'It may still have gone through. Check the deck before you try again.'],
      [derive(failedA, { state: 'timed_out', failure: { code: 'deadline_exceeded', retryable: true } }), 'Adding a slide ran out of time', 'It may still have gone through. Check slide 4 before you try again.'],
      [derive(failedA, { kind: 'element_refine', slide_index: 0 }), "Refining an element on slide 1 didn't finish", 'Something it relies on had a problem.'],
      [derive(failedA, { kind: 'slide_refine', slide_index: null }), "Refining a slide didn't finish", 'Something it relies on had a problem.'],
      [derive(failedA, { failure: { code: 'brand_new_code', retryable: true } }), "Adding a slide didn't finish", ''],
      [derive(failedA, { kind: 'brand_new_kind' }), "This step didn't finish", 'Something it relies on had a problem.'],
    ]
    for (const [row, title, body] of want) assert.deepEqual(plain(lib.jobLedgerCopy(row)), { title, body }, `${row.kind} ${row.failure?.code}`)
    const kinds = ['slide_compose', 'slide_refine', 'deck_build', 'element_directive', 'element_refine', 'theme', 'export']
    const codes = ['deadline_exceeded', 'service_unavailable', 'lost_on_restart', 'refused', 'not_found', 'cancelled_by_user']
    for (const kind of kinds) for (const code of codes) for (const state of ['failed', 'timed_out']) {
      const row = derive(failedA, { kind, state, failure: { code, retryable: true } })
      const { title, body } = lib.jobLedgerCopy(row)
      assert.ok(title.length > 10, `${kind} ${code}: a title`)
      const text = `${title} ${body}`
      for (const raw of [...codes, A, 'error', 'Error', 'Slide Builder', 'undefined', 'null', 'NaN', '_']) assert.ok(!text.includes(raw), `${kind} ${code}: no "${raw}" in ${JSON.stringify(text)}`)
    }
    const titles = codes.map(code => lib.jobLedgerCopy(derive(failedA, { failure: { code, retryable: true } })).title)
    assert.equal(new Set(titles).size, codes.length, 'each code has its own words')
    assert.equal(lib.jobSubject(derive(failedA, { kind: 'theme', slide_index: 3 })), 'Changing the theme')
    assert.equal(lib.jobSubject(derive(failedA, { kind: 'export' })), 'The export')
    assert.equal(lib.jobSubject(STALL[0].payload), 'The build')
  })
  await check('lib: Retry is offered on a failed frame-route row; a click sends retry.job_id and disables it; a double click never sends twice', () => {
    assert.equal(card(one, A).retry, 'ready')
    const first = lib.startJobRetry(one, A, 1_000)
    assert.equal(first.send, A)
    assert.equal(first.send, failedA.retry.job_id)
    assert.equal(card(first.ledger, A, 1_000).retry, 'waiting')
    assert.equal(lib.startJobRetry(first.ledger, A, 1_001).send, null, 'a second click while waiting sends nothing')
    assert.equal(lib.startJobRetry(first.ledger, A, 15_999).send, null)
    assert.equal(lib.startJobRetry(one, 'no-such-job', 1_000).send, null)
    assert.deepEqual(plain(first.ledger.rows), plain(one.rows), 'a click never changes a row')
  })
  await check('lib rule 1: a refused retry (the old row back at the SAME seq) re-enables Retry, although the seq rule drops the row', () => {
    const waiting = lib.startJobRetry(one, A, 1_000).ledger
    const echoed = lib.applyJobUpdate(waiting, failedA) // the recorded failed row, unchanged: Director's answer to a refused job_retry
    assert.deepEqual(plain(echoed.rows), plain(one.rows), 'the row itself is not taken again')
    assert.equal(card(echoed, A, 1_001).retry, 'ready')
    assert.equal(lib.startJobRetry(echoed, A, 1_001).send, A, 'and the next click sends')
    assert.equal(card(lib.applyJobUpdate(waiting, STALL[0].payload), A, 1_001).retry, 'waiting', 'another job is not a reply')
    assert.equal(card(sync(waiting, [failedA]), A, 1_001).retry, 'waiting', 'the old row in a sync is not a reply')
  })
  await check('lib rule 2: with no reply, Retry comes back after exactly 15 s, and a click after that sends again', () => {
    assert.equal(lib.JOB_RETRY_REPLY_TIMEOUT_MS, 15_000)
    const waiting = lib.startJobRetry(one, A, 1_000).ledger
    assert.equal(lib.nextJobRetryWakeAt(waiting, 1_000), 16_000)
    assert.equal(card(waiting, A, 15_999).retry, 'waiting')
    assert.equal(card(waiting, A, 16_000).retry, 'ready')
    assert.equal(lib.nextJobRetryWakeAt(waiting, 16_000), null)
    assert.equal(lib.nextJobRetryWakeAt(one, 0), null)
    const again = lib.startJobRetry(waiting, A, 16_000)
    assert.equal(again.send, A)
    assert.equal(card(again.ledger, A, 16_001).retry, 'waiting')
  })
  await check('lib rule 3: once a row retries it, the old row keeps its state and route but shows no card (and no Retry): by frame, by sync, in either order', () => {
    const waiting = lib.startJobRetry(one, A, 1_000).ledger
    assert.equal(card(waiting, A, 1_000).retry, 'waiting', 'until the reply: Retrying…')
    const retried = lib.applyJobUpdate(waiting, queuedB) // recorded: the retry's row, retry_of A
    assert.equal(card(retried, A, 1_001), null, 'the retry row arrives: the old card goes away')
    assert.deepEqual(cards(retried, 1_001), [], 'and the queued retry shows nothing: the chat\'s own progress takes over')
    assert.deepEqual(plain(retried.pending), {}, 'the retry row is the reply')
    const finished = apply(retried, runningB, doneB, ROUND['4_second_job_retry_same_old_id_answers'][0].payload)
    assert.deepEqual(plain(finished.rows[A]), failedA, 'the old row never changes: still failed, still its retry route')
    assert.deepEqual(cards(finished), [])
    assert.equal(lib.isJobRetried(finished, A), true)
    assert.equal(lib.jobRetryState(finished, finished.rows[A], 2_000), 'none', 'belt and braces: no Retry either')
    assert.equal(lib.startJobRetry(finished, A, 2_000).send, null)
    for (const order of [[failedA, doneB], [doneB, failedA]]) {
      assert.equal(card(sync(L, order), A), null, 'sync, both rows')
      assert.equal(card(apply(L, ...order), A), null, 'frames, both rows')
      assert.equal(card(sync(apply(L, order[0]), [order[1]]), A), null, 'one by frame, the other by sync')
    }
    assert.equal(card(sync(lib.startJobRetry(one, A, 1_000).ledger, [doneB]), A, 1_001), null, 'a reconnect that brings the retry back')
    assert.deepEqual(plain(sync(lib.startJobRetry(one, A, 1_000).ledger, [doneB]).pending), {}, 'a synced retry row ends the wait')
  })
  await check('lib rule 4 (derived chain): a retry that fails gets its own card and Retry, with its own id; the original shows no card', () => {
    const failedB = derive(queuedB, { state: 'failed', seq: 3, failure: { code: 'service_unavailable', retryable: true }, retry: { via: 'frame', job_id: B } }) // derived
    const chain = apply(one, queuedB, runningB, failedB)
    assert.deepEqual(cards(chain).map(c => [c.jobId, c.retry]), [[B, 'ready']])
    assert.equal(lib.startJobRetry(chain, A, 1_000).send, null)
    const click = lib.startJobRetry(chain, B, 1_000)
    assert.equal(click.send, B)
    const C = 'mdc_0c0ffee00003'
    const queuedC = derive(queuedB, { job_id: C, retry_of: B, seq: 1 }) // derived
    const third = lib.applyJobUpdate(click.ledger, queuedC)
    assert.deepEqual(cards(third, 1_001), [], 'the third try is under way: no card for A or B')
    const failedC = derive(queuedC, { state: 'timed_out', seq: 2, failure: { code: 'deadline_exceeded', retryable: true }, retry: { via: 'frame', job_id: C } }) // derived
    assert.deepEqual(cards(lib.applyJobUpdate(third, failedC), 1_002).map(c => [c.jobId, c.retry]), [[C, 'ready']])
  })
  await check('lib: deck_build never offers Retry (recorded stall; derived row with a frame route too); its timed-out words point at Resume', () => {
    const stalled = apply(L, ...STALL.map(f => f.payload))
    assert.deepEqual(cards(stalled).map(c => [c.jobId, c.state, c.retry]), [[BUILD, 'timed_out', 'none']])
    assert.match(card(stalled, BUILD).body, /use Resume/)
    const routed = derive(STALL[2].payload, { retry: { via: 'frame', job_id: BUILD } }) // derived: Director never sends this
    assert.equal(lib.offersFrameRetry(routed), false)
    assert.equal(card(apply(L, routed), BUILD).retry, 'none')
    assert.equal(lib.startJobRetry(apply(L, routed), BUILD, 0).send, null)
  })
  await check('lib: a client-route row (Studio REST compose / refine) gets the words but no Retry button (derived)', () => {
    const client = derive(failedA, { job_id: 'studio-job-7', retry: { via: 'client', job_id: 'studio-job-7' } })
    const held = apply(L, client)
    assert.deepEqual(card(held, 'studio-job-7'), { jobId: 'studio-job-7', kind: 'slide_compose', state: 'failed', title: "Adding a slide didn't finish", body: 'Something it relies on had a problem.', retry: 'none', directiveId: null })
    assert.equal(lib.startJobRetry(held, 'studio-job-7', 0).send, null)
    const refused = derive(failedA, { failure: { code: 'refused', retryable: false }, retry: null })
    assert.equal(card(apply(L, refused), A).retry, 'none', 'not retryable: no Retry')
    assert.equal(card(apply(L, derive(failedA, { failure: { code: 'service_unavailable', retryable: false } })), A).retry, 'none', 'retryable false wins over a route')
  })
  await check('lib: Dismiss hides that card in this tab only (the row stays); the store sends nothing for it', () => {
    const dismissed = lib.dismissJob(one, A)
    assert.equal(cards(dismissed).length, 0)
    assert.deepEqual(plain(dismissed.rows), plain(one.rows))
    assert.equal(lib.dismissJob(dismissed, A), dismissed)
    let t = 5_000
    const store = lib.createJobLedgerStore(() => t)
    const sends = []
    const send = id => { sends.push(id); return true }
    let notified = 0
    const unsubscribe = store.subscribe(() => { notified++ })
    for (const row of [queuedA, runningA, failedA]) store.onJobUpdate(row, { sessionId: SESSION })
    store.dismiss(SESSION, A)
    assert.deepEqual(sends, [])
    assert.equal(cards(store.ledger(SESSION)).length, 0)
    assert.equal(notified, 4)
    unsubscribe()
    store.dismiss(SESSION, A)
    assert.equal(notified, 4)
    // The store's Retry: once per reply; a send that did not go out stops waiting at once.
    const other = lib.createJobLedgerStore(() => t)
    for (const row of [queuedA, runningA, failedA]) other.onJobUpdate(row, { sessionId: SESSION })
    assert.equal(other.retry(SESSION, A, send), true)
    assert.equal(other.retry(SESSION, A, send), false)
    assert.deepEqual(sends, [A])
    t += 15_000
    assert.equal(other.retry(SESSION, A, () => false), false)
    assert.equal(card(other.ledger(SESSION), A, t).retry, 'ready', 'a send that did not go out leaves Retry on')
    assert.deepEqual(plain(other.ledger(RESTART_SESSION)), plain(lib.EMPTY_JOB_LEDGER), "another session's ledger is its own")
    other.onJobsSync(SYNC.payload.jobs, { sessionId: RESTART_SESSION })
    assert.deepEqual(cards(other.ledger(RESTART_SESSION)).map(c => c.jobId), [LOST])
    assert.deepEqual(cards(other.ledger(SESSION), t).map(c => c.jobId), [A])
  })
  await check('lib: a directive row joins its directive by directive_id (recorded directive-never-answered)', () => {
    const directive = DIRECTIVE.directive_and_running_row[0].payload
    const held = apply(L, ...DIRECTIVE.directive_and_running_row.slice(1).map(f => f.payload), DIRECTIVE.after_deadline[0].payload)
    assert.deepEqual(plain(lib.jobRowForDirective(held, directive.directive_id)), DIRECTIVE.after_deadline[0].payload)
    assert.equal(lib.jobDirectiveId(DIRECTIVE.after_deadline[0].payload), directive.directive_id)
    assert.equal(card(held, EL).directiveId, directive.directive_id)
    for (const kind of ['element_refine', 'theme', 'export']) assert.equal(lib.jobDirectiveId(derive(failedA, { kind })), A, kind)
    for (const row of [failedA, STALL[0].payload]) assert.equal(lib.jobDirectiveId(row), null, row.kind)
    assert.equal(lib.jobRowForDirective(one, A), null, 'a compose job is not a directive')
    assert.equal(lib.jobRowForDirective(held, 'el_unknown'), null)
    assert.equal(lib.jobRowForDirective(held, ''), null)
  })
}

// ---- 2-4. the REAL hook, the REAL card and the page's own wiring -------------------------------------------------------------------
/** Read the files of `texts` as given while `fn` loads modules (the harness loader reads from disk): runs a mutant or the base hook. */
function withFileTexts(texts, fn) {
  const targets = new Map(Object.entries(texts).filter(([, text]) => typeof text === 'string').map(([rel, text]) => [path.join(root, rel), text]))
  const original = fs.readFileSync
  fs.readFileSync = function (file, ...rest) { const hit = targets.get(path.resolve(String(file))); return hit !== undefined ? hit : original.call(this, file, ...rest) }
  try { return fn() } finally { fs.readFileSync = original }
}

/** The page's own expressions for this change, cut out of app/builder/page.tsx: the hook option spread and the card expression. */
function pageParts(pageText) {
  const ast = ts.createSourceFile(PAGE, pageText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const find = (predicate, node = ast) => { if (predicate(node)) return node; let hit = null; ts.forEachChild(node, child => { if (!hit) hit = find(predicate, child) }); return hit }
  const hookCall = find(node => ts.isCallExpression(node) && node.expression.getText(ast) === 'useDecksterWebSocketV2')
  const spread = hookCall?.arguments[0]?.properties?.find(p => ts.isSpreadAssignment(p) && p.getText(ast).includes('onJobUpdate'))
  const mounts = [] // the innermost JSX expression that holds the card (an outer conditional holds it too)
  find(node => { if (ts.isJsxExpression(node) && node.expression && node.getText(ast).includes('<StudioJobLedgerCards')) mounts.push(node); return false })
  const mount = mounts.sort((a, b) => a.getWidth(ast) - b.getWidth(ast))[0] ?? null
  return { ast, hookCall, spread, mount, options: spread?.expression.getText(ast) ?? null, card: mount?.expression.getText(ast) ?? null }
}
const compiled = new Map()
const evalExpr = (text, scope) => {
  if (!compiled.has(text)) compiled.set(text, new vm.Script(ts.transpileModule(`(${text})`, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText))
  return compiled.get(text).runInNewContext(scope)
}

async function mountStudio({ src, flag, session = SESSION, hookText = undefined, page = true, spies = false }) {
  const env = createEnvironment({ processEnv: { ...BASE_ENV, NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_CHAT_DIRECTIVES: 'true', ...(flag === undefined ? {} : { [FLAG]: flag }) } })
  const user = { id: 'synthetic-user', email: 'synthetic-user@example.invalid' }
  const loader = createModuleLoader({ root, globals: env.globals, stubs: { react: React }, fileStubs: { 'hooks/use-auth': { useAuth: () => ({ user, isLoading: false }) } } })
  const texts = { [LIB]: src[LIB], [HOOK]: hookText === undefined ? src[HOOK] : hookText, [CARD]: src[CARD] }
  const { hookModule, lib, cardModule } = withFileTexts(texts, () => ({ hookModule: loader.load(HOOK), lib: loader.load(LIB), cardModule: loader.load(CARD) }))
  const seen = { jobUpdates: [], jobsSyncs: [], messages: [], elementDirectives: [] }
  const ledger = cardModule.studioJobLedger
  const spyLedger = {
    onJobUpdate: (row, owner) => { seen.jobUpdates.push({ row: plain(row), sessionId: owner.sessionId, current: owner.isCurrent() }); ledger.onJobUpdate(row, owner) },
    onJobsSync: (rows, owner) => { seen.jobsSyncs.push({ rows: plain(rows), sessionId: owner.sessionId, current: owner.isCurrent() }); ledger.onJobsSync(rows, owner) },
  }
  const parts = page ? pageParts(src[PAGE]) : null
  if (page) assert.ok(parts.options && parts.card, "the page's option spread and card expression are found")
  const pageOptions = page ? evalExpr(parts.options, { STUDIO_JOB_LEDGER_ENABLED: lib.STUDIO_JOB_LEDGER_ENABLED, studioJobLedger: spyLedger }) : {}
  const probe = { api: null }
  function Probe() {
    probe.api = hookModule.useDecksterWebSocketV2({
      autoConnect: false, existingSessionId: session,
      onMessage: message => { seen.messages.push(message.message_id) },
      onElementDirective: payload => { seen.elementDirectives.push(plain(payload)) },
      ...pageOptions,
      // Flag-off proof: the callbacks handed straight to the hook, whatever the page does.
      ...(spies ? spyLedger : {}),
    })
    if (!page) return null
    return evalExpr(parts.card, { React, STUDIO_JOB_LEDGER_ENABLED: lib.STUDIO_JOB_LEDGER_ENABLED, studioShell: true, StudioJobLedgerCards: cardModule.StudioJobLedgerCards,
      currentSessionId: session, wsSessionId: probe.api.sessionId, sendControlMessage: probe.api.sendControlMessage }) || null
  }
  const rootNode = new Root()
  const settle = async () => { for (let calm = 0, rounds = 0; calm < 2; rounds++) { if (rounds > 80) throw new Error('did not settle'); await env.macrotask(); calm = rootNode.flush() ? 0 : calm + 1 } }
  rootNode.setElement(React.createElement(Probe))
  await settle()
  probe.api.ensureConnected()
  await env.clock.advance(0, settle)
  assert.equal(env.sockets.length, 1, 'one socket')
  env.sockets[0].serverOpen()
  await env.clock.advance(0, settle)
  const cardNodes = () => hostNodes(rootNode.tree).filter(node => node.props?.['data-studio-job-ledger'] !== undefined)
  const part = (node, name) => hostNodes(node).find(n => n.props?.['data-studio-job-ledger-part'] === name) ?? null
  return {
    env, lib, ledger, seen, settle,
    get api() { return probe.api },
    async deliver(frame) { env.sockets[0].serverMessage(JSON.stringify(frame)); await env.clock.advance(0, settle) },
    async advance(ms) { await env.clock.advance(ms, settle) },
    sent: () => env.outbound.filter(item => item.data !== 'ping').map(item => item.data),
    cards: () => cardNodes().map(node => ({ jobId: node.props['data-studio-job-ledger-id'], state: node.props['data-studio-job-ledger'], title: textOf(part(node, 'title')),
      body: part(node, 'body') ? textOf(part(node, 'body')) : '', retry: part(node, 'retry') ? { label: textOf(part(node, 'retry')), disabled: Boolean(part(node, 'retry').props.disabled) } : null })),
    async click(jobId, name) {
      const node = cardNodes().find(n => n.props['data-studio-job-ledger-id'] === jobId)
      assert.ok(node, `a card for ${jobId}`)
      const button = part(node, name)
      assert.ok(button, `${jobId} has ${name}`)
      button.props.onClick()
      await settle()
    },
    state: () => plain({ messages: probe.api.messages.map(m => [m.message_id, m.type]), awaiting: probe.api.awaitingDirectorReply, status: probe.api.currentStatus ?? null,
      presentationId: probe.api.presentationId ?? null, workflow: probe.api.directorWorkflowState ?? null, cache: env.sessionStorage.dump(),
      consoleErrors: env.consoleEvents.filter(e => e.level === 'error').length }),
    unmount() { rootNode.unmount() },
  }
}

const jobRows = list => list.filter(f => f.type === 'job_update').map(f => f.payload)

async function hookChecks(src) {
  await check('hook (flag on): each recorded job_update reaches onJobUpdate exactly, for this socket\'s session only; none enters the transcript', async () => {
    const studio = await mountStudio({ src, flag: 'true' })
    for (const key of EACH_ORDER) await studio.deliver(EACH[key])
    const mine = EACH_ORDER.map(k => EACH[k]).filter(f => f.session_id === SESSION)
    assert.equal(mine.length, 6)
    assert.deepEqual(studio.seen.jobUpdates, mine.map(f => ({ row: f.payload, sessionId: SESSION, current: true })), 'the other session\'s lost_on_restart frame is not forwarded')
    assert.deepEqual(studio.seen.messages, [], 'no job frame reaches onMessage')
    assert.deepEqual(studio.state().messages, [])
    assert.ok(!JSON.stringify(studio.state().cache).includes('job_update'), 'nor the cache')
    assert.deepEqual(studio.cards().map(c => [c.jobId, c.state, c.retry?.label ?? null]), [[EL, 'timed_out', 'Retry']], 'the retried row A shows no card (the done row retries it)')
    studio.unmount()
    const other = await mountStudio({ src, flag: 'true', session: RESTART_SESSION })
    await other.deliver(EACH.failed_lost_on_restart)
    await other.deliver(EACH.failed)
    assert.deepEqual(other.seen.jobUpdates, [{ row: EACH.failed_lost_on_restart.payload, sessionId: RESTART_SESSION, current: true }])
    assert.deepEqual(other.cards().map(c => [c.jobId, c.title, c.retry?.label ?? null]), [[LOST, 'Adding a slide was interrupted', 'Retry']])
    other.unmount()
  })
  await check('hook + card (flag on): the recorded round trip; Retry sends exactly the recorded job_retry once, double click included; the retry hides it', async () => {
    const studio = await mountStudio({ src, flag: 'true' })
    for (const frame of ROUND['1_chat_compose_fails']) await studio.deliver(frame)
    assert.deepEqual(studio.seen.jobUpdates.map(u => u.row), jobRows(ROUND['1_chat_compose_fails']))
    assert.deepEqual(studio.seen.messages, ROUND['1_chat_compose_fails'].filter(f => f.type !== 'job_update').map(f => f.message_id), 'every other frame reaches onMessage as before; no job_update does')
    assert.deepEqual(studio.state().messages.map(([, type]) => type), ['chat_message', 'chat_message'], 'the transcript holds the two chat lines only')
    assert.deepEqual(studio.cards(), [{ jobId: A, state: 'failed', title: "Adding a slide didn't finish", body: 'Something it relies on had a problem.', retry: { label: 'Retry', disabled: false } }])
    const before = studio.sent().length
    await studio.click(A, 'retry')
    assert.deepEqual(studio.cards()[0].retry, { label: 'Retrying…', disabled: true })
    await studio.click(A, 'retry') // a double click: the disabled button's handler, or a click before the re-render
    assert.deepEqual(studio.sent().slice(before), [JOB_RETRY_BYTES], 'one job_retry, byte for byte the recorded inbound frame')
    assert.equal(JOB_RETRY_BYTES, `{"type":"job_retry","data":{"job_id":"${A}"}}`)
    await studio.deliver(ROUND['3_outbound_after_job_retry'][0]) // the retry's queued row (retry_of A): the reply
    assert.deepEqual(studio.cards(), [], 'the old card goes away when the retry row arrives; the chat\'s own progress takes over')
    for (const frame of ROUND['3_outbound_after_job_retry'].slice(1)) await studio.deliver(frame)
    assert.deepEqual(studio.cards(), [], 'the done retry shows nothing')
    for (const frame of ROUND['4_second_job_retry_same_old_id_answers']) await studio.deliver(frame)
    assert.deepEqual(studio.seen.jobUpdates.map(u => u.row), jobRows([...ROUND['1_chat_compose_fails'], ...ROUND['3_outbound_after_job_retry'], ...ROUND['4_second_job_retry_same_old_id_answers']]))
    assert.equal(studio.sent().slice(before).length, 1, 'nothing is retried automatically')
    assert.deepEqual(plain(studio.ledger.ledger(SESSION).rows[A]), EACH.failed.payload)
    studio.unmount()
  })
  await check('hook + card rule 1: the refused answer (the recorded failed row again, same seq) re-enables Retry; the next click sends once more', async () => {
    const studio = await mountStudio({ src, flag: 'true' })
    for (const frame of ROUND['1_chat_compose_fails']) await studio.deliver(frame)
    await studio.click(A, 'retry')
    await studio.deliver(EACH.failed)
    assert.deepEqual(studio.cards()[0].retry, { label: 'Retry', disabled: false })
    await studio.click(A, 'retry')
    assert.deepEqual(studio.sent().filter(s => s.includes('job_retry')), [JOB_RETRY_BYTES, JOB_RETRY_BYTES])
    studio.unmount()
  })
  await check('hook + card rule 2: no reply: disabled for 15 s on the clock, then Retry comes back by itself; a click then sends', async () => {
    const studio = await mountStudio({ src, flag: 'true' })
    for (const frame of ROUND['1_chat_compose_fails']) await studio.deliver(frame)
    await studio.click(A, 'retry')
    await studio.advance(14_999)
    assert.deepEqual(studio.cards()[0].retry, { label: 'Retrying…', disabled: true })
    await studio.click(A, 'retry')
    await studio.advance(1)
    assert.deepEqual(studio.cards()[0].retry, { label: 'Retry', disabled: false })
    assert.equal(studio.sent().filter(s => s.includes('job_retry')).length, 1)
    await studio.click(A, 'retry')
    assert.deepEqual(studio.sent().filter(s => s.includes('job_retry')), [JOB_RETRY_BYTES, JOB_RETRY_BYTES])
    studio.unmount()
  })
  await check('hook + card: the recorded build stall gives one card with no Retry that points at Resume; Dismiss hides it and sends nothing', async () => {
    const studio = await mountStudio({ src, flag: 'true' })
    for (const frame of STALL) await studio.deliver(frame)
    assert.deepEqual(studio.seen.jobUpdates.map(u => u.row), jobRows(STALL))
    assert.deepEqual(studio.cards(), [{ jobId: BUILD, state: 'timed_out', title: "The build hasn't made progress for a while", body: 'It may still pick up. If it has stopped, use Resume to continue it.', retry: null }])
    const before = studio.sent()
    await studio.click(BUILD, 'dismiss')
    assert.deepEqual(studio.cards(), [])
    assert.deepEqual(studio.sent(), before, 'Dismiss sends nothing')
    assert.ok(studio.ledger.ledger(SESSION).rows[BUILD], 'the row is kept; only the card is hidden')
    studio.unmount()
  })
  await check('hook + card: the recorded directive that was never answered: the directive runs as before, its row joins it, Retry is offered', async () => {
    const studio = await mountStudio({ src, flag: 'true' })
    for (const frame of [...DIRECTIVE.directive_and_running_row, ...DIRECTIVE.after_deadline]) await studio.deliver(frame)
    const directive = DIRECTIVE.directive_and_running_row[0]
    assert.deepEqual(studio.seen.elementDirectives, [directive.payload], 'the element_directive reaches its runner as before')
    assert.deepEqual(studio.seen.jobUpdates.map(u => u.row), jobRows([...DIRECTIVE.directive_and_running_row, ...DIRECTIVE.after_deadline]))
    assert.deepEqual(studio.seen.messages, [DIRECTIVE.after_deadline[1].message_id], "Director's one chat line is in the transcript as before")
    assert.deepEqual(plain(studio.lib.jobRowForDirective(studio.ledger.ledger(SESSION), directive.payload.directive_id)), DIRECTIVE.after_deadline[0].payload)
    assert.deepEqual(studio.cards(), [{ jobId: EL, state: 'timed_out', title: 'Adding an element to slide 4 ran out of time', body: 'It may still have gone through. Check slide 4 before you try again.', retry: { label: 'Retry', disabled: false } }])
    await studio.click(EL, 'retry')
    assert.deepEqual(studio.sent().filter(s => s.includes('job_retry')), [`{"type":"job_retry","data":{"job_id":"${EL}"}}`])
    studio.unmount()
  })
  await check('hook + card: the recorded sync_response after a restart: onJobsSync gets exactly its jobs; the frame is applied as before; [] is passed on', async () => {
    const studio = await mountStudio({ src, flag: 'true', session: RESTART_SESSION })
    await studio.deliver(SYNC)
    assert.deepEqual(studio.seen.jobsSyncs, [{ rows: SYNC.payload.jobs, sessionId: RESTART_SESSION, current: true }])
    assert.equal(studio.state().workflow, 'TOPIC_SET', 'the sync_response itself is applied as before')
    assert.deepEqual(studio.cards().map(c => [c.jobId, c.title, c.retry?.label ?? null]), [[LOST, 'Adding a slide was interrupted', 'Retry']], 'the done export shows nothing')
    await studio.deliver(EACH.failed_lost_on_restart) // the same row as a job_update, same seq: dropped by the ledger
    assert.equal(studio.cards().length, 1)
    await studio.deliver({ ...SYNC, message_id: 'msg_sync_empty', payload: { ...SYNC.payload, jobs: [] } }) // derived: "nothing open"
    assert.deepEqual(studio.seen.jobsSyncs.at(-1).rows, [])
    assert.equal(studio.cards().length, 1, '[] erases nothing')
    const { jobs, ...withoutJobs } = SYNC.payload
    await studio.deliver({ ...SYNC, message_id: 'msg_sync_nojobs', payload: withoutJobs }) // derived: Director's flag off
    assert.equal(studio.seen.jobsSyncs.length, 2, 'a sync_response without jobs calls nothing')
    await studio.deliver({ ...SYNC, message_id: 'msg_sync_foreign', session_id: SESSION }) // derived: another session's sync
    assert.equal(studio.seen.jobsSyncs.length, 2, "another session's sync is not taken")
    studio.unmount()
  })
  await check('hook (flag on): a job_update does not unlock the turn (a state tick), exactly as when it was dropped', async () => {
    for (const flag of ['true', undefined]) {
      const studio = await mountStudio({ src, flag })
      studio.api.sendMessage('Add a competitor pricing slide')
      await studio.settle()
      assert.equal(studio.api.awaitingDirectorReply, true)
      await studio.deliver(EACH.queued)
      await studio.deliver(EACH.failed)
      assert.equal(studio.api.awaitingDirectorReply, true, `flag ${flag}`)
      studio.unmount()
    }
  })
}

/** Every recorded frame and a send of each kind, on a socket of each recorded session: what the hook does with them, as bytes and state. */
async function hookTrace({ src, flag, hookText }) {
  const result = { sent: [], trace: [], jobUpdates: 0, jobsSyncs: 0, messages: [], elementDirectives: [] }
  for (const session of [SESSION, RESTART_SESSION]) {
    const studio = await mountStudio({ src, flag, hookText, session, page: false, spies: true })
    studio.api.sendMessage('Add a competitor pricing slide')
    await studio.settle()
    for (const frame of ALL_FRAMES) { await studio.deliver(frame); result.trace.push(studio.state()) }
    studio.api.sendControlMessage('template_ingest_cancel', { job_id: 'ingest-1' })
    studio.api.sendControlMessage('cancel_template_reuse')
    await studio.settle()
    result.sent.push(...studio.sent())
    result.jobUpdates += studio.seen.jobUpdates.length
    result.jobsSyncs += studio.seen.jobsSyncs.length
    result.messages.push(...studio.seen.messages)
    result.elementDirectives.push(...studio.seen.elementDirectives)
    studio.unmount()
  }
  return result
}
let baseTrace = null
async function identityChecks(src) {
  await check('identity (flag off): this hook, for four spellings of off, and the base hook give the same bytes, transcript, state, cache and callbacks for every recorded frame', async () => {
    baseTrace ??= await hookTrace({ src, flag: undefined, hookText: baseFile(HOOK) })
    assert.equal(baseTrace.jobUpdates + baseTrace.jobsSyncs, 0)
    for (const flag of [undefined, 'false', '1', 'TRUE']) {
      const head = await hookTrace({ src, flag })
      assert.deepEqual(head, baseTrace, `flag=${flag}`)
    }
  })
  await check('identity (flag on): the transcript, state and cache are the same frame for frame; only the two callbacks are called', async () => {
    const on = await hookTrace({ src, flag: 'true' })
    const off = await hookTrace({ src, flag: undefined })
    assert.deepEqual(on.trace, off.trace)
    assert.deepEqual(on.sent, off.sent)
    assert.deepEqual([on.messages, on.elementDirectives], [off.messages, off.elementDirectives])
    assert.equal(on.jobUpdates, ALL_FRAMES.filter(f => f.type === 'job_update').length, "each job_update on its own session's socket")
    assert.equal(on.jobsSyncs, 1, "the recorded sync, on its own session's socket")
  })
}

function pageChecks(src) {
  const page = src[PAGE]
  return check("page: the card mounts only with the flag on (Studio shell), right after the transcript; the hook gets the ledger's intake only with it on", async () => {
    const parts = pageParts(page)
    assert.ok(parts.spread && parts.mount)
    assert.equal(parts.options, '(STUDIO_JOB_LEDGER_ENABLED ? { onJobUpdate: studioJobLedger.onJobUpdate, onJobsSync: studioJobLedger.onJobsSync } : {})')
    assert.equal((page.match(/^import \{ STUDIO_JOB_LEDGER_ENABLED \} from '@\/lib\/studio-job-ledger'$/gm) || []).length, 1)
    assert.equal((page.match(/^import \{ StudioJobLedgerCards, studioJobLedger \} from '@\/components\/builder\/chat\/studio-job-ledger-card'$/gm) || []).length, 1)
    assert.equal((page.match(/<StudioJobLedgerCards/g) || []).length, 1, 'one mount')
    const end = page.indexOf('suppressEphemeral={effectiveBuildNarrationEnabled}\n                      />\n')
    assert.ok(end > 0 && page.slice(end).indexOf('<StudioJobLedgerCards') < 400, 'right after the MessageList, beside the recovery card it renders last')
    assert.ok(page.indexOf('<StudioJobLedgerCards') < page.indexOf('{STUDIO_BLOCKED_SEND_FEEDBACK_ENABLED && blockedSendNotice && ('))
    const ledger = { onJobUpdate() {}, onJobsSync() {} }
    assert.deepEqual(Object.keys(evalExpr(parts.options, { STUDIO_JOB_LEDGER_ENABLED: false, studioJobLedger: ledger })), [])
    const on = evalExpr(parts.options, { STUDIO_JOB_LEDGER_ENABLED: true, studioJobLedger: ledger })
    assert.deepEqual(Object.keys(on), ['onJobUpdate', 'onJobsSync'])
    assert.ok(on.onJobUpdate === ledger.onJobUpdate && on.onJobsSync === ledger.onJobsSync)
    const sends = []
    const scope = (flag, shell) => ({ React, STUDIO_JOB_LEDGER_ENABLED: flag, studioShell: shell, StudioJobLedgerCards: function StudioJobLedgerCards() { return null },
      currentSessionId: '', wsSessionId: 'ws-session', sendControlMessage: (type, data) => { sends.push(JSON.stringify({ type, data })); return true } })
    for (const [flag, shell] of [[false, true], [false, false], [true, false]]) assert.equal(evalExpr(parts.card, scope(flag, shell)), false, `flag ${flag} shell ${shell}`)
    const element = evalExpr(parts.card, scope(true, true))
    assert.equal(element.type.name, 'StudioJobLedgerCards')
    assert.equal(element.props.sessionId, 'ws-session', 'the session shown: currentSessionId || wsSessionId')
    assert.equal(element.props.sendJobRetry(A), true)
    assert.deepEqual(sends, [JOB_RETRY_BYTES], "the page's sender: sendControlMessage('job_retry', { job_id })")
  })
}

function staticChecks(src) {
  return check('card, css and .env.example: the card only reads the ledger; the css is keyed to its own attributes and the shell tokens; the flag is documented once', async () => {
    const card = src[CARD]
    const imports = [...card.matchAll(/^import (?:.* from )?"([^"]+)"$/gm)].map(m => m[1])
    assert.deepEqual(imports, ['react', 'lucide-react', '@/lib/studio-job-ledger', './studio-job-ledger-card.css'])
    assert.ok(card.includes('import { AlertCircle } from "lucide-react"') && card.includes('<AlertCircle size={14} aria-hidden="true" />'), 'an alert icon, 14 px, hidden from assistive tech')
    assert.ok(!/fetch\(|WebSocket|\.send\(|localStorage|sessionStorage/.test(card), 'the card sends and stores nothing itself')
    const css = src[CSS].replace(/\/\*[\s\S]*?\*\//g, '')
    const rules = css.split('}').map(r => r.trim()).filter(Boolean)
    for (const rule of rules) {
      const selector = rule.split('{')[0].trim()
      if (selector.startsWith('@media')) continue
      for (const one of selector.split(',')) assert.match(one.trim(), /^\[data-studio-v4-shell="true"\] \[data-studio-job-ledger(-[a-z]+)?(="[a-z]+")?\]/, one)
    }
    assert.ok(!/#[0-9a-fA-F]{3,8}\b|rgb\(/.test(css), 'colours come from the shell tokens only (light and dark)')
    for (const token of ['--ss-line', '--ss-surface', '--ss-text', '--ss-muted', '--ss-teal', '--ss-panel', '--ss-accent']) assert.ok(css.includes(`var(${token})`), token)
    const env = src[ENV]
    assert.equal((env.match(/^NEXT_PUBLIC_STUDIO_JOB_LEDGER="false"$/gm) || []).length, 1)
    const at = env.indexOf('\n\n# P3-4 DIRECTOR\'S JOB LEDGER IN STUDIO') // after the Text Labs block and any FRONTEND-2 block stacked since (P3-4b's)
    assert.ok(at > env.indexOf('TEXT_LABS_IDENTITY_SECRET=') && /\(FRONTEND-2[,)]/.test(env.slice(env.lastIndexOf('\n\n', at - 1) + 2, at)), 'after the last FRONTEND-2 block')
    assert.ok(env.indexOf('NEXT_PUBLIC_STUDIO_JOB_LEDGER="false"\n\n# PASS2 ADMIN (FRONTEND-1') > 0, 'right before # PASS2 ADMIN')
  })
}

async function stripChecks() {
  await check('strip: stripping gives back the base files byte for byte; new files are new; the three shared strip roots chain it', async () => {
    assert.deepEqual([...JOB_LEDGER_FILES].sort(), [ENV, PAGE, HOOK].sort())
    for (const rel of JOB_LEDGER_FILES) {
      const stripped = stripJobLedger(rel, read(rel))
      assert.notEqual(read(rel), baseFile(rel), `${rel} is changed`)
      let later = false // a later PR's commit on this file after the base: then the stacked rule
      try { later = git('log', '--format=%s', `${BASE_COMMIT}..HEAD`, '--', rel).split('\n').filter(Boolean).some(s => !/P3-4c|P3-4 slice C/.test(s)) } catch { later = false }
      if (!later) { assert.equal(sha(stripped), sha(baseFile(rel)), `${rel}: byte for byte`); continue }
      assert.ok(!/JOB_LEDGER|job_retry|onJobUpdate|onJobsSync|StudioJobLedgerCards/.test(stripped), `${rel}: none of this change's text is left (stacked)`)
      let at = 0
      for (const line of baseFile(rel).split('\n')) { const i = stripped.indexOf(line, at); assert.ok(i >= 0, `${rel}: base line kept in order (stacked)`); at = i + line.length }
    }
    assert.equal(stripJobLedger('lib/other.ts', 'x'), 'x')
    for (const rel of JOB_LEDGER_FILES) for (const [added, original] of JOB_LEDGER_CHANGES[rel]) { // every added piece names the flag
      assert.equal(read(rel).split(added).length, 2, `${rel}: each added piece occurs once`)
      assert.match(added.split('\n').filter(line => !original.split('\n').includes(line)).join('\n'), /STUDIO_JOB_LEDGER/, rel)
    }
    for (const rel of JOB_LEDGER_NEW_FILES) {
      assert.ok(fs.existsSync(path.join(root, rel)), rel)
      assert.throws(() => git('cat-file', '-e', `${BASE_COMMIT}:${rel}`), undefined, `${rel} is new`)
    }
    for (const name of Object.keys(RECORDED)) assert.ok(JOB_LEDGER_NEW_FILES.includes(`${FIXTURES}/${name}`), name)
    for (const strip of [stripOpenReadOnly, stripDarkPersist, stripAddSlideStatus]) assert.equal(sha(strip(PAGE, read(PAGE))), sha(strip(PAGE, baseFile(PAGE))), strip.name)
  })
  await check("fixtures: DIRECTOR-2's five recorded files, verbatim", () => {
    for (const [name, digest] of Object.entries(RECORDED)) assert.equal(sha(recordedText[name]), digest, name)
  })
}

async function suite(src, { identity = true, strip = true } = {}) {
  await libChecks(src)
  await hookChecks(src)
  if (identity) await identityChecks(src)
  await pageChecks(src)
  await staticChecks(src)
  if (strip) await stripChecks()
}

// ---- 6. mutants: each must fail at least one check ---------------------------------------------------------------------------------
const MUTANTS = [
  ['seq compare (a duplicate seq is taken)', LIB, 'row.seq <= stored.seq', 'row.seq < stored.seq'],
  ['terminal guard dropped', LIB, ' || isTerminalJobState(stored.state)))', '))'],
  ['[] clears the ledger', LIB, 'return rows.reduce((next, row) => acceptRow(withoutPending(next, [row.retry_of]), row), ledger)', 'return rows.length ? rows.reduce((next, row) => acceptRow(withoutPending(next, [row.retry_of]), row), ledger) : EMPTY_JOB_LEDGER'],
  ['Retry offered on the client route', LIB, "row.retry?.via === 'frame' && typeof", "(row.retry?.via === 'frame' || row.retry?.via === 'client') && typeof"],
  ['Retry offered for deck_build', LIB, "isShownJobState(row.state) && row.kind !== 'deck_build' && row.failure", 'isShownJobState(row.state) && row.failure'],
  ['Retry enabled in flight', LIB, "now - clickedAt < JOB_RETRY_REPLY_TIMEOUT_MS ? 'waiting' : 'ready'", "now - clickedAt < 0 ? 'waiting' : 'ready'"],
  ['no re-enable on the same-seq echo (the dedupe first)', LIB, 'return acceptRow(withoutPending(ledger, [row.job_id, row.retry_of]), row)', 'const next = acceptRow(ledger, row); return next === ledger ? ledger : withoutPending(next, [row.job_id, row.retry_of])'],
  ['the timeout value', LIB, 'JOB_RETRY_REPLY_TIMEOUT_MS = 15_000', 'JOB_RETRY_REPLY_TIMEOUT_MS = 30_000'],
  ['the flag spelling', LIB, "process.env.NEXT_PUBLIC_STUDIO_JOB_LEDGER === 'true'", 'Boolean(process.env.NEXT_PUBLIC_STUDIO_JOB_LEDGER)'],
  ['the intake not gated on the flag (job_update)', HOOK, 'if (STUDIO_JOB_LEDGER_ENABLED && (parsedMessage.type as unknown) === JOB_UPDATE_TYPE) {', 'if ((parsedMessage.type as unknown) === JOB_UPDATE_TYPE) {'],
  ['the intake not gated on the flag (sync jobs)', HOOK, "if (STUDIO_JOB_LEDGER_ENABLED && parsedMessage.type === 'sync_response'", "if (parsedMessage.type === 'sync_response'"],
  ['the job_retry shape', PAGE, "sendControlMessage('job_retry', { job_id: jobId })", "sendControlMessage('job_retry', { job_id: jobId, session_id: currentSessionId || wsSessionId } as { job_id: string })"],
  ['Dismiss sends something', CARD, 'onClick={() => store.dismiss(sessionId, card.jobId)}', 'onClick={() => { store.dismiss(sessionId, card.jobId); sendJobRetry(card.jobId) }}'],
  ['a retried row keeps its card (rule 3)', LIB, ' && !ledger.dismissed[row.job_id] && !isJobRetried(ledger, row.job_id))', ' && !ledger.dismissed[row.job_id])'],
  ['a retried row keeps its Retry (rule 3, belt and braces)', LIB, "if (!offersFrameRetry(row) || isJobRetried(ledger, row.job_id)) return 'none'", "if (!offersFrameRetry(row)) return 'none'"],
  ["another session's job_update taken", HOOK, 'const row = parsedMessage.session_id === socketSessionId ? jobLedgerRow(parsedMessage.payload) : null;', 'const row = jobLedgerRow(parsedMessage.payload);'],
  ['a job_update unlocks the turn', HOOK, "if (STUDIO_JOB_LEDGER_ENABLED && (parsedMessage.type as unknown) === JOB_UPDATE_TYPE) {\n", "if (STUDIO_JOB_LEDGER_ENABLED && (parsedMessage.type as unknown) === JOB_UPDATE_TYPE) {\n              clearAwaitReply();\n"],
  ['a raw failure code in the words', LIB, "return { title: `${subject} didn't finish`, body: 'Something it relies on had a problem.' }", "return { title: `${subject} didn't finish (${row.failure?.code})`, body: 'Something it relies on had a problem.' }"],
  ['the card mounts without the flag', PAGE, '{STUDIO_JOB_LEDGER_ENABLED && studioShell && (\n                        <StudioJobLedgerCards', '{studioShell && (\n                        <StudioJobLedgerCards'],
  ['the card never re-enables by itself (no wake timer)', CARD, 'const timer = setTimeout(() => rerender(n => n + 1), Math.max(0, wakeAt - Date.now()))', 'const timer = setTimeout(() => undefined, Math.max(0, wakeAt - Date.now()))'],
  ["another session's sync jobs taken", HOOK, "parsedMessage.type === 'sync_response' && parsedMessage.session_id === socketSessionId) {", "parsedMessage.type === 'sync_response') {"],
]

await suite(SOURCES)
console.log(`job ledger: ${checks} checks passed${failures.length ? `, ${failures.length} FAILED` : ''}`)
if (failures.length) process.exit(1)
if (!process.argv.includes('--no-mutants')) {
  const survivors = []
  const names = new Set()
  quiet.on = true
  for (const [name, file, from, to] of MUTANTS) {
    assert.ok(!names.has(name), `mutant name unique: ${name}`); names.add(name)
    assert.equal(SOURCES[file].split(from).length, 2, `mutant "${name}": its text occurs once in ${file}`)
    const mutated = { ...SOURCES, [file]: SOURCES[file].replace(from, () => to) }
    try { await suite(mutated, { identity: file === HOOK || file === LIB, strip: false }); survivors.push(name) } catch { /* caught */ }
  }
  quiet.on = false
  assert.deepEqual(survivors, [], `mutants survived: ${survivors.join(', ')}`)
  console.log(`PASS mutation check: ${MUTANTS.length} of ${MUTANTS.length} mutants fail at least one check`)
}
