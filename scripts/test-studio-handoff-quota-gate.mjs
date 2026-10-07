import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

// Quota gate on the manual-deck handoff auto-submit
// (flag NEXT_PUBLIC_STUDIO_HANDOFF_QUOTA_GATE_ENABLED, default off).
// Runs the REAL auto-submit effect, the REAL gate (`preflightDirectorTurn`) and the
// REAL typed handler (`handleSendMessage`) extracted from app/builder/page.tsx, plus
// the real flag helper and the real blocked-send copy helper, with offline stand-ins
// for everything else. No React mount, no network, no socket, no sign-in. The
// baseline is the same code read from the base commit, so flag off is compared to
// what shipped, not to a copy.
const BASE = '66ce219' // blocked-send feedback (PR 298): the commit this change is stacked on
const sha = value => crypto.createHash('sha256').update(value).digest('hex')
const root = new URL('..', import.meta.url).pathname
const read = path => fs.readFileSync(`${root}${path}`, 'utf8')
const parse = (name, text) => ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const transpile = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
const printer = ts.createPrinter({ removeComments: true })
const print = (node, source) => printer.printNode(ts.EmitHint.Unspecified, node, source)
function find(node, predicate) {
  if (predicate(node)) return node
  let match
  ts.forEachChild(node, child => { if (!match) match = find(child, predicate) })
  return match
}
function declaration(source, name) {
  const node = find(source, n => ts.isVariableDeclaration(n) && n.name.getText(source) === name)
  assert.ok(node, `missing ${name}`)
  return node.initializer
}
let cases = 0
const check = (name, fn) => { fn(); cases++; void name }

// ---------------------------------------------------------------- the flag helper (import-free)
function loadModule(path, env = {}) {
  const module = { exports: {} }
  vm.runInNewContext(transpile(read(path)), { module, exports: module.exports, process: { env }, require: id => assert.fail(`${path} must stay import-free: ${id}`) })
  return module.exports
}
const gateLib = loadModule('lib/studio-handoff-quota-gate.ts')
for (const [shell, flag, expected] of [
  [undefined, undefined, false], ['true', undefined, false], ['true', 'false', false], ['true', '1', false], ['true', 'TRUE', false],
  ['false', 'true', false], [undefined, 'true', false], ['true', 'true', true],
]) {
  check(`flag ${shell}/${flag}`, () => {
    assert.equal(gateLib.studioHandoffQuotaGateFlagOn(shell, flag), expected)
    assert.equal(loadModule('lib/studio-handoff-quota-gate.ts', { NEXT_PUBLIC_STUDIO_V4_SHELL: shell, NEXT_PUBLIC_STUDIO_HANDOFF_QUOTA_GATE_ENABLED: flag }).STUDIO_HANDOFF_QUOTA_GATE_ENABLED, expected)
  })
}
assert.equal(gateLib.STUDIO_HANDOFF_QUOTA_GATE_ENABLED, false, 'unset env is OFF')
const blockedSend = loadModule('lib/studio-blocked-send.ts')

// ---------------------------------------------------------------- the real code, now and at the base
const pageText = read('app/builder/page.tsx')
const page = parse('page.tsx', pageText)
const basePage = parse('base-page.tsx', execFileSync('git', ['show', `${BASE}:app/builder/page.tsx`], { encoding: 'utf8', cwd: root, maxBuffer: 64 * 1024 * 1024 }))
assert.equal(page.parseDiagnostics.length, 0, 'Builder syntax')
const callbackOf = (source, name) => print(declaration(source, name).arguments[0], source)
const effectCall = source => find(source, n => ts.isCallExpression(n) && n.expression.getText(source) === 'useEffect'
  && n.arguments[0]?.getText(source).includes('handoffSubmissionInFlightRef.current.add(submissionKey)'))
assert.ok(effectCall(page) && effectCall(basePage), 'the handoff auto-submit effect exists now and at the base')
const effectSource = source => print(effectCall(source).arguments[0], source)
const effectDeps = source => effectCall(source).arguments[1].elements.map(element => element.getText(source))

check('the gate and the typed handler are not touched by this change (same text as the base)', () => {
  assert.equal(callbackOf(page, 'preflightDirectorTurn'), callbackOf(basePage, 'preflightDirectorTurn'))
  assert.equal(callbackOf(page, 'handleSendMessage'), callbackOf(basePage, 'handleSendMessage'))
})
check('the first Send passes the gate BEFORE the manual-deck conflict dialog can open (so a $0 user never reaches it)', () => {
  const handler = declaration(page, 'handleSendMessage')
  const text = handler.getText(page)
  const gateAt = text.indexOf('if (!preflightDirectorTurn()) return')
  const dialogAt = text.indexOf('setPendingManualDeckBuild(')
  assert.ok(gateAt > 0 && dialogAt > gateAt, `gate at ${gateAt}, dialog at ${dialogAt}`)
})
check('"Add generated slides" goes through the typed handler (and so the gate)', () => {
  assert.match(declaration(page, 'handlePrependGeneratedSlides').getText(page), /void handleSendMessage\(undefined, pending\.messageText, \{ manualDeck \}\)/)
})
check('the effect dependency list only grows by three flag-constant names; the old ones are untouched', () => {
  const base = effectDeps(basePage), now = effectDeps(page)
  assert.deepEqual(now.slice(0, base.length), base)
  assert.deepEqual(now.slice(base.length), ['handoffGateQuotaStatus', 'handoffGateQuotaLoading', 'handoffGateBusy'])
  for (const name of now.slice(base.length)) {
    const init = declaration(page, name)
    assert.ok(ts.isConditionalExpression(init), name)
    assert.equal(init.condition.getText(page), 'STUDIO_HANDOFF_QUOTA_GATE_ENABLED', `${name} is constant unless the flag is on`)
    assert.equal(init.whenFalse.getText(page), 'null', `${name} is null with the flag off, so the effect re-runs exactly as before`)
  }
})
check('the page reads the flag only through the helper module', () => {
  assert.match(pageText, /import \{ STUDIO_HANDOFF_QUOTA_GATE_ENABLED \} from '@\/lib\/studio-handoff-quota-gate'/)
  assert.ok(!/process\.env\.NEXT_PUBLIC_STUDIO_HANDOFF/.test(pageText), 'the env read lives only in the helper module')
})
check('the only text added to the effect sits behind the flag', () => {
  const added = effectSource(page).replace(effectSource(basePage), '')
  // Remove the one flagged block from the current text; what remains must equal the base text.
  const now = effectSource(page)
  const start = now.indexOf('if (STUDIO_HANDOFF_QUOTA_GATE_ENABLED) {')
  const end = now.indexOf('handoffSubmissionInFlightRef.current.add(submissionKey)')
  assert.ok(start > 0 && end > start)
  assert.equal(now.slice(0, start) + now.slice(end), effectSource(basePage))
  void added
})

// ---------------------------------------------------------------- the world: real effect + real gate
const resetIso = { daily: '2026-10-08T04:00:00Z', weekly: '2026-10-12T04:00:00Z' }
const quotaStatus = (flags, wallet = 0, monthlyCents = 0) => ({ tier: monthlyCents ? 'pro' : 'free', caps: { monthlyCents }, flags: { dailyNear: false, weeklyNear: false, dailyAt: false, weeklyAt: false, ...flags }, walletBalanceCents: wallet, resetAt: resetIso })
const FREE_ZERO = () => quotaStatus({ dailyAt: true, weeklyAt: true }, 0, 0)
const PRO_CAPPED = () => quotaStatus({ dailyAt: true }, 0, 5000)
const ALLOWED = () => quotaStatus({}, 0, 5000)
const RESERVE = () => quotaStatus({ dailyAt: true }, 500, 5000)
const staged = (extra = {}) => ({
  version: 1, owner_user_id: 'offline-owner', submission_state: 'staged', source_session_id: 'offline-source', new_session_id: 'offline-session',
  idempotency_key: 'offline-op-key', text: 'Build a 10-slide investor deck for a climate-fintech seed round.', store_name: null, file_count: 0,
  attachments: [], deep_research: false, web_search: false, extended_generation: false, use_knowledge_graph: false,
  theme: { mode: 'auto' }, template_mode: false, template_id: null, ...extra,
})

/**
 * One offline Builder around one effect source. `rerender(patch)` models a React
 * render with changed values (the same vm globals the effect and the gate read),
 * `run()` models the effect firing again (its dependencies changed, for ANY reason).
 */
function world({ effect, gate = true, notice = false, studio = true, quota = { status: null, isLoading: false }, pending = staged(), sendResult = true, draft = '', ...extra }) {
  const events = []
  let noticeState = null
  const context = {
    isReady: true, currentSessionId: 'offline-session', authScopeUserId: 'offline-owner', studioShell: studio, deckIdentity: null,
    window: { sessionStorage: { token: 'offline' } },
    user: { id: 'offline-owner' }, session: null, awaitingDirectorReply: false, uploadedFiles: [], activeTemplate: null, isGeneratingFinal: false,
    isExecutingSendRef: { current: false }, questionSubmissionPendingRef: { current: false },
    quota, draft, pendingRecord: pending,
    readCurrentStudioHandoff: () => context.pendingRecord,
    readPendingHandoff: () => context.pendingRecord,
    canAutomaticallySubmitStudioHandoff: record => Boolean(record) && (record.submission_state === undefined || record.submission_state === 'staged'),
    markStudioHandoffSubmitted: (record, _owner, sent) => sent ? { ...record, submission_state: 'submitted' } : record,
    pendingHandoffMemoryRef: { current: null },
    handoffSubmissionInFlightRef: { current: new Set() },
    handoffGateRefusalRef: { current: null },
    sendMessage: (...args) => { events.push(['transport', args[0], args[1], args[2], JSON.parse(JSON.stringify(args[3]))]); return context.sendResult },
    sendResult,
    setPendingHandoffRevision: () => events.push(['revision']),
    savePendingHandoff: (_storage, record) => events.push(['save-record', record.submission_state]),
    clearPendingHandoff: () => events.push(['clear-record']),
    setHandoffStorageWarning: value => events.push(['storage-warning', value && 'set']),
    attachmentsFromPayload: () => [],
    setInputMessage: value => {
      context.draft = typeof value === 'function' ? value(context.draft) : value
      events.push(['draft', context.draft])
    },
    setSessionStoreName: value => events.push(['store', value]),
    setResearchEnabled: value => events.push(['research', value]),
    setWebSearchEnabled: value => events.push(['web', value]),
    setExtendedGenerationEnabled: value => events.push(['extended', value]),
    setKnowledgeGraphEnabled: value => events.push(['kg', value]),
    clearAllFiles: () => events.push(['clear-files']),
    fetch: (url, init) => { events.push(['persist', url, JSON.parse(init.body).messages[0].userText]); return Promise.resolve({}) },
    // gate stand-ins
    toast: value => events.push(['toast', value.title]),
    setTopUpReason: text => events.push(['topup-reason', text]),
    setTopUpOpen: value => events.push(['topup-open', value]),
    console: { warn: (...args) => events.push(['warning', String(args[0])]) },
    isTemplateGenerationReady: template => template.ready,
    templateGenerationUnavailableReason: () => 'Template needs its blueprint first',
    STUDIO_BLOCKED_SEND_FEEDBACK_ENABLED: notice,
    setBlockedSendNotice: notice
      ? updater => { noticeState = typeof updater === 'function' ? updater(noticeState) : updater; events.push(['notice', noticeState && noticeState.kind]) }
      : () => assert.fail('notice flag off must never touch the notice'),
    nextBlockedSendNotice: blockedSend.nextBlockedSendNotice, quotaBlockedSendNotice: blockedSend.quotaBlockedSendNotice,
    templateBlockedSendNotice: blockedSend.templateBlockedSendNotice, uploadBlockedSendNotice: blockedSend.uploadBlockedSendNotice,
    // flag and the flag-constant values the page computes
    STUDIO_HANDOFF_QUOTA_GATE_ENABLED: gate,
    ...extra,
  }
  const sessionStub = () => ({
    isLoadingSession: false,
    userMessageIdsRef: { current: { add: id => events.push(['user-id', id]) } },
    userMessageContentMapRef: { current: { set: (text, id) => events.push(['user-map', text, id]) } },
    hasTitleFromUserMessageRef: { current: false },
    setUserMessages: () => events.push(['user-message']),
  })
  context.session = sessionStub()
  vm.runInNewContext(transpile(`globalThis.gate = ${callbackOf(page, 'preflightDirectorTurn')}; globalThis.runEffect = ${effect}`), context)
  context.handoffGateRef = { current: context.gate }
  const derive = () => {
    context.handoffGateQuotaStatus = gate ? context.quota.status : null
    context.handoffGateQuotaLoading = gate ? context.quota.isLoading : null
    context.handoffGateBusy = gate ? context.session.isLoadingSession || context.awaitingDirectorReply : null
  }
  derive()
  return {
    context, events,
    rerender(patch = {}) { Object.assign(context, patch); derive() },
    run() { context.runEffect() },
    get notice() { return noticeState },
    count: kind => events.filter(event => event[0] === kind).length,
  }
}
const effects = { base: effectSource(basePage), now: effectSource(page) }
const outcome = w => JSON.stringify([w.events, [...w.context.handoffSubmissionInFlightRef.current], w.context.draft, w.context.pendingHandoffMemoryRef.current && w.context.pendingHandoffMemoryRef.current.submission_state])

// ---- flag off: the effect behaves exactly as at the base, whatever the plan picture says
const scenarios = {
  'no quota data yet': {},
  'free tier, daily cap reached, $0 reserve (the bypass)': { quota: { status: FREE_ZERO(), isLoading: false } },
  'pro, cap reached, $0 reserve': { quota: { status: PRO_CAPPED(), isLoading: false } },
  'allowed plan': { quota: { status: ALLOWED(), isLoading: false } },
  'quota still loading': { quota: { status: null, isLoading: true } },
  'transport not open (send returns false)': { sendResult: false },
  'classic shell (non-Studio)': { studio: false, quota: { status: FREE_ZERO(), isLoading: false } },
  'not ready': { isReady: false },
  'no staged record': { pending: null },
  'already submitted record': { pending: staged({ submission_state: 'submitted' }) },
  'composer already holds a draft': { draft: 'my own draft', quota: { status: FREE_ZERO(), isLoading: false } },
  'session loading': { session: { isLoadingSession: true } },
}
const offHashes = []
for (const [name, extra] of Object.entries(scenarios)) {
  check(`flag off is byte-identical to the base effect: ${name}`, () => {
    const mk = effect => {
      const { session: sessionOverride, ...rest } = extra
      const w = world({ effect, gate: false, ...rest })
      if (sessionOverride) w.rerender({ session: { ...w.context.session, ...sessionOverride } })
      w.run(); w.run() // a second run: unrelated dependency changed
      return w
    }
    const base = mk(effects.base), now = mk(effects.now)
    assert.equal(outcome(now), outcome(base))
    offHashes.push([name, sha(outcome(now)).slice(0, 12)])
  })
}
check('flag off keeps the bypass exactly as it was (the bug stays visible until the flag is turned on)', () => {
  const w = world({ effect: effects.now, gate: false, quota: { status: FREE_ZERO(), isLoading: false } })
  w.run()
  assert.equal(w.count('transport'), 1, 'sent with no gate')
  assert.equal(w.count('toast'), 0)
})

// ---- flag on: blocked, silent waits, passes
const frozenReason = w => ({
  transport: w.count('transport'), toast: w.count('toast'), topup: w.events.filter(e => e[0] === 'topup-open').length,
  inflight: w.context.handoffSubmissionInFlightRef.current.size, save: w.count('save-record'), persist: w.count('persist'),
  userMessage: w.count('user-message'), revision: w.count('revision'), memory: w.context.pendingHandoffMemoryRef.current,
})
for (const notice of [false, true]) {
  const tag = notice ? 'notice flag on' : 'notice flag off'
  check(`flag on, free tier / $0: nothing is sent, the staged record is untouched, the text is kept, the gate speaks once (${tag})`, () => {
    const w = world({ effect: effects.now, notice, quota: { status: FREE_ZERO(), isLoading: false } })
    w.run()
    assert.deepEqual(frozenReason(w), { transport: 0, toast: 1, topup: 1, inflight: 0, save: 0, persist: 0, userMessage: 0, revision: 0, memory: null })
    assert.equal(w.context.draft, staged().text, 'text goes into the empty composer')
    assert.equal(w.events.find(e => e[0] === 'toast')[1], 'Daily limit reached')
    assert.equal(w.count('notice'), notice ? 1 : 0)
    if (notice) {
      assert.equal(w.notice.kind, 'no_allowance')
      assert.ok(w.notice.text.includes("wasn't sent") && w.notice.text.includes('Your text is still in the box.'))
    }
    assert.equal(w.context.pendingRecord.submission_state, 'staged', 'record stays staged so the effect can still submit it with its key')
  })
}
check('flag on, pro plan with a cap reached and no reserve is refused the same way', () => {
  const w = world({ effect: effects.now, quota: { status: PRO_CAPPED(), isLoading: false } })
  w.run()
  assert.equal(w.count('transport'), 0)
  assert.equal(w.count('toast'), 1)
})
check('a draft already in the composer is never overwritten (the text stays in the staged record)', () => {
  const w = world({ effect: effects.now, draft: 'my own draft', quota: { status: FREE_ZERO(), isLoading: false } })
  w.run()
  assert.equal(w.context.draft, 'my own draft')
  assert.equal(w.count('transport'), 0)
  assert.equal(w.context.pendingRecord.submission_state, 'staged')
})
check('while the plan picture is loading the effect waits: no send, no gate call, no draft write', () => {
  const w = world({ effect: effects.now, quota: { status: null, isLoading: true } })
  w.run(); w.run()
  assert.deepEqual(w.events, [])
  assert.equal(w.context.handoffSubmissionInFlightRef.current.size, 0)
  // ... and when it lands as free/$0 the send is refused, when it lands as allowed it goes out.
  w.rerender({ quota: { status: FREE_ZERO(), isLoading: false } }); w.run()
  assert.equal(w.count('transport'), 0)
  assert.equal(w.count('toast'), 1)
  const w2 = world({ effect: effects.now, quota: { status: null, isLoading: true } })
  w2.run(); w2.rerender({ quota: { status: ALLOWED(), isLoading: false } }); w2.run()
  assert.equal(w2.count('transport'), 1)
})
check('quota fetch that fails (loading done, no status) behaves like every other turn: the gate has no data and passes', () => {
  const w = world({ effect: effects.now, quota: { status: null, isLoading: false } })
  w.run()
  assert.equal(w.count('transport'), 1)
})
check('while the session is loading or a reply is awaited the effect waits silently (no draft write, no toast)', () => {
  for (const patch of [{ session: { isLoadingSession: true } }, { awaitingDirectorReply: true }]) {
    const w = world({ effect: effects.now, quota: { status: FREE_ZERO(), isLoading: false } })
    w.rerender(patch.session ? { session: { ...w.context.session, ...patch.session } } : patch)
    w.run()
    assert.deepEqual(w.events, [])
    w.rerender(patch.session ? { session: { ...w.context.session, isLoadingSession: false } } : { awaitingDirectorReply: false }); w.run()
    assert.equal(w.count('toast'), 1, 'evaluated as soon as the wait is over')
    assert.equal(w.count('transport'), 0)
  }
})
check('the effect re-running for unrelated dependencies does not repeat the refusal (one toast, one dialog, one notice)', () => {
  const w = world({ effect: effects.now, notice: true, quota: { status: FREE_ZERO(), isLoading: false } })
  for (let i = 0; i < 25; i++) w.run()
  assert.equal(w.count('toast'), 1)
  assert.equal(w.events.filter(e => e[0] === 'topup-open').length, 1)
  assert.equal(w.count('notice'), 1)
  assert.equal(w.count('draft'), 1)
  assert.equal(w.count('transport'), 0)
})
check('a new plan picture that is still blocked is announced once more; one that opens the gate sends exactly once with the key', () => {
  const w = world({ effect: effects.now, quota: { status: FREE_ZERO(), isLoading: false } })
  w.run(); w.run()
  w.rerender({ quota: { status: FREE_ZERO(), isLoading: false } }); w.run(); w.run()
  assert.equal(w.count('toast'), 2)
  assert.equal(w.count('transport'), 0)
  w.rerender({ quota: { status: RESERVE(), isLoading: false } }); w.run(); w.run(); w.run()
  assert.equal(w.count('transport'), 1, 'sent once, not once per re-run')
  const sent = w.events.find(e => e[0] === 'transport')
  assert.equal(sent[1], staged().text)
  assert.equal(sent[4].handoffIdempotencyKey, 'offline-op-key', 'the staged key travels with the send, so Director accepts it')
  assert.equal(w.context.draft, '', 'the composer copy is cleared by the send, as before')
  assert.equal(w.context.pendingRecord.submission_state, 'staged')
  assert.equal(w.context.pendingHandoffMemoryRef.current.submission_state, 'submitted')
  assert.equal(w.count('persist'), 1)
})
check('a notice from a refused auto-submit is cleared when the gate later passes', () => {
  const w = world({ effect: effects.now, notice: true, quota: { status: FREE_ZERO(), isLoading: false } })
  w.run()
  assert.equal(w.notice.kind, 'no_allowance')
  w.rerender({ quota: { status: ALLOWED(), isLoading: false } }); w.run()
  assert.equal(w.notice, null)
  assert.equal(w.count('transport'), 1)
})

// ---- flag on and allowed: identical to the base, byte for byte
for (const [name, extra] of Object.entries({
  'allowed plan': { quota: { status: ALLOWED(), isLoading: false } },
  'cap reached but reserve covers it': { quota: { status: RESERVE(), isLoading: false } },
  'no quota data after the fetch': { quota: { status: null, isLoading: false } },
  'transport not open (send returns false)': { quota: { status: ALLOWED(), isLoading: false }, sendResult: false },
})) {
  for (const notice of [false, true]) {
    check(`flag on and the gate passes: same events as the base effect (${name}, notice ${notice})`, () => {
      const base = world({ effect: effects.base, gate: false, ...extra }); base.run(); base.run()
      const on = world({ effect: effects.now, gate: true, notice, ...extra }); on.run(); on.run()
      const stripNotice = events => events.filter(event => event[0] !== 'notice')
      assert.equal(JSON.stringify(stripNotice(on.events)), JSON.stringify(base.events))
      assert.equal(sha(JSON.stringify([...on.context.handoffSubmissionInFlightRef.current])), sha(JSON.stringify([...base.context.handoffSubmissionInFlightRef.current])))
      assert.equal(on.context.draft, base.context.draft)
    })
  }
}
check('classic shell: the gate flag is Studio-only (build-time helper), the effect is untouched', () => {
  assert.equal(gateLib.studioHandoffQuotaGateFlagOn('false', 'true'), false)
})

// ---- the other typed paths still share the gate unchanged
check('first Send with free/$0 never reaches the manual-deck inspection (real handler, real gate)', () => {
  const w = world({ effect: effects.now, quota: { status: FREE_ZERO(), isLoading: false } })
  const events = w.events
  Object.assign(w.context, {
    inputMessage: 'Build a deck', pendingActionInput: null, pendingActionIntentRef: { current: { action: null, revision: 0 } },
    isAttachedUpload: () => false, snapshotAttachedUploads: () => [],
    questionSubmissionScopeRef: { current: { active: true, generation: 0, sessionId: 'offline-session', userId: 'offline-owner' } },
    wsSessionId: 'offline-session', preflightDirectorTurn: w.context.gate,
    blankPresentationId: 'blank', presentationId: 'blank', effectivePresentationId: 'blank', templateModeOn: false,
    shouldInspectManualDeckBeforeBuild: () => true, markStudioUserIntent: undefined,
    setPendingManualDeckBuild: () => events.push(['dialog']),
  })
  w.context.session.markStudioUserIntent = () => events.push(['intent'])
  w.context.fetch = () => { events.push(['inspect-fetch']); return Promise.resolve({ ok: false }) }
  vm.runInNewContext(transpile(`globalThis.send = ${callbackOf(page, 'handleSendMessage')};`), w.context)
  w.context.send()
  assert.equal(events.filter(e => ['dialog', 'inspect-fetch', 'intent', 'transport'].includes(e[0])).length, 0)
  assert.equal(events.filter(e => e[0] === 'toast').length, 1)
})

console.log(`Handoff quota gate: ${cases} offline cases passed. Flag-off effect outcomes identical to ${BASE} (sha256/12 per scenario): ${offHashes.map(([n, h]) => `${n}=${h}`).join('; ')}`)
