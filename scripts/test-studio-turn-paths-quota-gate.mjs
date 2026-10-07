import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

// Quota gate on the remaining Director-turn paths
//   flag NEXT_PUBLIC_STUDIO_TURN_PATHS_QUOTA_GATE_ENABLED (default off): action buttons,
//        the Director-directed new-session auto-send, the template-ingest auto-send,
//        and the quota refresh after a turn's spend;
//   flag NEXT_PUBLIC_STUDIO_QUOTA_FAIL_CLOSED_ENABLED (default off): refuse a turn when
//        the plan picture is unknown.
// Runs the REAL code extracted from app/builder/page.tsx (the gate `preflightDirectorTurn`,
// `handleActionClick`, the `onSessionDirective` option, the template-ingest auto-send
// effect) and the REAL hooks/use-quota.ts (on a tiny hooks stand-in), plus the real flag
// helper and the real blocked-send copy helper, with offline stand-ins for everything
// else. No React mount, no network, no socket, no sign-in. The baseline is the same code
// read from the base commit, so flag off is compared to what shipped, not to a copy.
// TURN_PATHS_TEST_PAGE / TURN_PATHS_TEST_HOOK point the test at a mutated copy (used to
// prove the test fails when the code is broken); they are unset in the normal suite.
const BASE = '7ba368c' // handoff quota gate (PR 299): the commit this change is stacked on
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
function findAll(node, predicate, out = []) {
  if (predicate(node)) out.push(node)
  ts.forEachChild(node, child => findAll(child, predicate, out))
  return out
}
function declaration(source, name) {
  const node = find(source, n => ts.isVariableDeclaration(n) && n.name.getText(source) === name)
  assert.ok(node, `missing ${name}`)
  return node.initializer
}
let cases = 0
const check = (name, fn) => { fn(); cases++; void name }
const checkAsync = async (name, fn) => { await fn(); cases++; void name }
const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve() }

// ---------------------------------------------------------------- the flag helpers (import-free)
function loadModule(path, env = {}) {
  const module = { exports: {} }
  vm.runInNewContext(transpile(read(path)), { module, exports: module.exports, process: { env }, require: id => assert.fail(`${path} must stay import-free: ${id}`) })
  return module.exports
}
const LIB = 'lib/studio-turn-paths-quota-gate.ts'
const flagsLib = loadModule(LIB)
for (const [shell, flag, expected] of [
  [undefined, undefined, false], ['true', undefined, false], ['true', 'false', false], ['true', '1', false], ['true', 'TRUE', false],
  ['false', 'true', false], [undefined, 'true', false], ['true', 'true', true],
]) {
  check(`flags ${shell}/${flag}`, () => {
    assert.equal(flagsLib.studioTurnPathsQuotaGateFlagOn(shell, flag), expected)
    assert.equal(flagsLib.studioQuotaFailClosedFlagOn(shell, flag), expected)
    assert.equal(loadModule(LIB, { NEXT_PUBLIC_STUDIO_V4_SHELL: shell, NEXT_PUBLIC_STUDIO_TURN_PATHS_QUOTA_GATE_ENABLED: flag }).STUDIO_TURN_PATHS_QUOTA_GATE_ENABLED, expected)
    assert.equal(loadModule(LIB, { NEXT_PUBLIC_STUDIO_V4_SHELL: shell, NEXT_PUBLIC_STUDIO_QUOTA_FAIL_CLOSED_ENABLED: flag }).STUDIO_QUOTA_FAIL_CLOSED_ENABLED, expected)
  })
}
check('the two flags are independent of each other and both default off', () => {
  assert.equal(flagsLib.STUDIO_TURN_PATHS_QUOTA_GATE_ENABLED, false)
  assert.equal(flagsLib.STUDIO_QUOTA_FAIL_CLOSED_ENABLED, false)
  const onlyGate = loadModule(LIB, { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_STUDIO_TURN_PATHS_QUOTA_GATE_ENABLED: 'true' })
  assert.deepEqual([onlyGate.STUDIO_TURN_PATHS_QUOTA_GATE_ENABLED, onlyGate.STUDIO_QUOTA_FAIL_CLOSED_ENABLED], [true, false])
  const onlyClosed = loadModule(LIB, { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true', NEXT_PUBLIC_STUDIO_QUOTA_FAIL_CLOSED_ENABLED: 'true' })
  assert.deepEqual([onlyClosed.STUDIO_TURN_PATHS_QUOTA_GATE_ENABLED, onlyClosed.STUDIO_QUOTA_FAIL_CLOSED_ENABLED], [false, true])
})
const blockedSend = loadModule('lib/studio-blocked-send.ts')

// ---------------------------------------------------------------- the real code, now and at the base
const pageText = fs.readFileSync(process.env.TURN_PATHS_TEST_PAGE || `${root}app/builder/page.tsx`, 'utf8')
const hookText = fs.readFileSync(process.env.TURN_PATHS_TEST_HOOK || `${root}hooks/use-quota.ts`, 'utf8')
const page = parse('page.tsx', pageText)
const gitShow = path => execFileSync('git', ['show', `${BASE}:${path}`], { encoding: 'utf8', cwd: root, maxBuffer: 64 * 1024 * 1024 })
const basePage = parse('base-page.tsx', gitShow('app/builder/page.tsx'))
const baseHookText = gitShow('hooks/use-quota.ts')
assert.equal(page.parseDiagnostics.length, 0, 'Builder syntax')
const FLAG = 'STUDIO_TURN_PATHS_QUOTA_GATE_ENABLED'
const callbackOf = (source, name) => print(declaration(source, name).arguments[0], source)

// The directive handler is a property of the WS options literal, the ingest effect a useEffect call.
const directiveNode = source => {
  const prop = find(source, n => ts.isPropertyAssignment(n) && n.name.getText(source) === 'onSessionDirective')
  assert.ok(prop, 'onSessionDirective option exists')
  return prop.initializer
}
const ingestEffectCall = source => {
  const call = find(source, n => ts.isCallExpression(n) && n.expression.getText(source) === 'useEffect'
    && n.arguments[0]?.getText(source).includes("'Convert my uploaded presentation into a template'"))
  assert.ok(call, 'the template-ingest auto-send effect exists')
  return call
}

/** Printed text of `node` with every statement-level `if (<flag> ...)` removed: what is left must be the base. */
function withoutFlaggedStatements(source, node) {
  const flagged = []
  const walk = n => {
    if (ts.isIfStatement(n) && n.expression.getText(source).includes(FLAG)) { flagged.push(n); return }
    ts.forEachChild(n, walk)
  }
  walk(node)
  let text = source.text.slice(node.getStart(source), node.getEnd())
  const origin = node.getStart(source)
  for (const stmt of flagged.sort((a, b) => b.getFullStart() - a.getFullStart())) {
    text = text.slice(0, Math.max(0, stmt.getFullStart() - origin)) + text.slice(stmt.getEnd() - origin)
  }
  const reparsed = parse('stripped.tsx', `const x = ${text}`)
  return print(reparsed.statements[0].declarationList.declarations[0].initializer, reparsed)
}

check('the typed handler and the manual-deck handoff effect are not touched by this change (same text as the base)', () => {
  assert.equal(callbackOf(page, 'handleSendMessage'), callbackOf(basePage, 'handleSendMessage'))
  const handoffEffect = source => print(find(source, n => ts.isCallExpression(n) && n.expression.getText(source) === 'useEffect'
    && n.arguments[0]?.getText(source).includes('handoffSubmissionInFlightRef.current.add(submissionKey)')).arguments[0], source)
  assert.equal(handoffEffect(page), handoffEffect(basePage))
})
check('the page reads both flags only through the helper module', () => {
  assert.match(pageText, /import \{ STUDIO_QUOTA_FAIL_CLOSED_ENABLED, STUDIO_TURN_PATHS_QUOTA_GATE_ENABLED \} from '@\/lib\/studio-turn-paths-quota-gate'/)
  assert.ok(!/process\.env\.NEXT_PUBLIC_STUDIO_TURN_PATHS/.test(pageText) && !/process\.env\.NEXT_PUBLIC_STUDIO_QUOTA_FAIL/.test(pageText), 'the env reads live only in the helper module')
})
check('handleActionClick: the only text added sits behind the flag (removing it gives the base text)', () => {
  const now = declaration(page, 'handleActionClick').arguments[0], base = declaration(basePage, 'handleActionClick').arguments[0]
  assert.equal(withoutFlaggedStatements(page, now), print(base, basePage))
  assert.deepEqual(declaration(page, 'handleActionClick').arguments[1].elements.map(e => e.getText(page)), declaration(basePage, 'handleActionClick').arguments[1].elements.map(e => e.getText(basePage)),
    'dependency list unchanged (the gate is read through a ref)')
})
check('onSessionDirective: the only text added sits behind the flag (removing it gives the base text)', () => {
  assert.equal(withoutFlaggedStatements(page, directiveNode(page)), print(directiveNode(basePage), basePage))
})
check('template-ingest effect: the only text added sits behind the flag; dependencies grow by two flag-constant names', () => {
  const now = ingestEffectCall(page), base = ingestEffectCall(basePage)
  assert.equal(withoutFlaggedStatements(page, now.arguments[0]), print(base.arguments[0], basePage))
  const baseDeps = base.arguments[1].elements.map(e => e.getText(basePage)), nowDeps = now.arguments[1].elements.map(e => e.getText(page))
  assert.deepEqual(nowDeps.slice(0, baseDeps.length), baseDeps)
  assert.deepEqual(nowDeps.slice(baseDeps.length), ['ingestGateQuotaStatus', 'ingestGateQuotaLoading'])
  for (const name of nowDeps.slice(baseDeps.length)) {
    const init = declaration(page, name)
    assert.ok(ts.isConditionalExpression(init), name)
    assert.equal(init.condition.getText(page), FLAG, `${name} is constant unless the flag is on`)
    assert.equal(init.whenFalse.getText(page), 'null', `${name} is null with the flag off, so the effect re-runs exactly as before`)
  }
})
check('the gate: its dependency list grows only by two names that are constants (null) unless the fail-closed flag is on', () => {
  const now = declaration(page, 'preflightDirectorTurn'), base = declaration(basePage, 'preflightDirectorTurn')
  const baseDeps = base.arguments[1].elements.map(e => e.getText(basePage)), nowDeps = now.arguments[1].elements.map(e => e.getText(page))
  assert.deepEqual(nowDeps.slice(0, baseDeps.length), baseDeps)
  assert.deepEqual(nowDeps.slice(baseDeps.length), ['quotaFailClosedLoading', 'quotaFailClosedRefetch'])
  for (const name of nowDeps.slice(baseDeps.length)) {
    const init = declaration(page, name)
    assert.ok(ts.isConditionalExpression(init) && init.condition.getText(page) === 'STUDIO_QUOTA_FAIL_CLOSED_ENABLED' && init.whenFalse.getText(page) === 'null', name)
  }
})
check('the gate reference for the three paths is assigned only with the flag on; useQuota gets the refresh option only with the flag on', () => {
  assert.match(pageText, /if \(STUDIO_TURN_PATHS_QUOTA_GATE_ENABLED\) turnPathsGateRef\.current = preflightDirectorTurn/)
  const call = find(page, n => ts.isCallExpression(n) && n.expression.getText(page) === 'useQuota')
  assert.equal(call.arguments.length, 3)
  assert.equal(call.arguments[2].getText(page).replace(/\s+/g, ' '), 'STUDIO_TURN_PATHS_QUOTA_GATE_ENABLED ? { refreshAfterSpend: true } : undefined')
  const baseCall = find(basePage, n => ts.isCallExpression(n) && n.expression.getText(basePage) === 'useQuota')
  assert.equal(baseCall.arguments.length, 2)
})
check('every send in the three paths still goes through the same transport call as before (no new send site)', () => {
  const count = (source, re) => (source.text.match(re) || []).length
  assert.equal(count(page, /sendMessageWhenConnected\(/g), count(basePage, /sendMessageWhenConnected\(/g))
  assert.equal(count(page, /\bsendMessage\(/g), count(basePage, /\bsendMessage\(/g))
})
check('blocked-send copy helper: the new notice kinds and sources never touch the existing wording', () => {
  const { quotaBlockedSendNotice, uploadBlockedSendNotice, templateBlockedSendNotice, quotaUnknownBlockedSendNotice } = blockedSend
  const input = { which: 'daily', resetLabel: 'Thu 4:00 AM', caps: { monthlyCents: 0 } }
  assert.equal(quotaBlockedSendNotice(input).text, "This account's plan includes no build quota, so your message wasn't sent. Your text is still in the box. Add reserve credits to build.")
  assert.equal(quotaBlockedSendNotice({ ...input, caps: { monthlyCents: 5000 } }, 'answers').title, 'Answers not sent')
  assert.equal(uploadBlockedSendNotice({ name: 'A.docx', status: 'uploading' }).kind, 'upload_pending')
  assert.equal(templateBlockedSendNotice('Needs a blueprint').kind, 'template_locked')
  const action = quotaBlockedSendNotice(input, 'action'), queued = quotaBlockedSendNotice(input, 'queued')
  assert.ok(action.text.includes("your choice wasn't sent") && action.text.includes('The option is still available.') && !action.text.includes('text is still in the box'))
  assert.ok(queued.text.includes("your request wasn't sent") && queued.text.includes('stays queued') && !queued.text.includes('text is still in the box'))
  const checking = quotaUnknownBlockedSendNotice({ checking: true }), failed = quotaUnknownBlockedSendNotice({ checking: false }, 'action')
  assert.equal(checking.kind, 'quota_unknown')
  assert.ok(checking.text.includes("still checking") && checking.text.includes("wasn't sent"))
  assert.ok(failed.text.includes("couldn't confirm") && failed.text.includes('checking again') && failed.text.includes('The option is still available.'))
})

// ---------------------------------------------------------------- the world: real code, offline stand-ins
const resetIso = { daily: '2026-10-08T04:00:00Z', weekly: '2026-10-12T04:00:00Z' }
const quotaStatus = (flags, wallet = 0, monthlyCents = 0) => ({ tier: monthlyCents ? 'pro' : 'free', caps: { monthlyCents }, flags: { dailyNear: false, weeklyNear: false, dailyAt: false, weeklyAt: false, ...flags }, walletBalanceCents: wallet, resetAt: resetIso })
const FREE_ZERO = () => quotaStatus({ dailyAt: true, weeklyAt: true }, 0, 0)
const PRO_CAPPED = () => quotaStatus({ dailyAt: true }, 0, 5000)
const ALLOWED = () => quotaStatus({}, 0, 5000)
const RESERVE = () => quotaStatus({ dailyAt: true }, 500, 5000)
const QUOTAS = {
  'no plan picture yet (fetch not answered)': { status: null, isLoading: true },
  'plan picture failed to load': { status: null, isLoading: false },
  'free tier / $0 (the bypass)': { status: FREE_ZERO(), isLoading: false },
  'pro, cap reached, no reserve': { status: PRO_CAPPED(), isLoading: false },
  'cap reached, reserve covers it': { status: RESERVE(), isLoading: false },
  'allowed plan': { status: ALLOWED(), isLoading: false },
}

/**
 * The shared context for every extracted function. `gateFn` is the gate's printed source
 * (current or base). `flags` = the compile-time constants the page imports.
 */
function makeContext({ gateFn, flags = {}, notice = false, quota, awaitingDirectorReply = false, uploadedFiles = [], activeTemplate = null, isGeneratingFinal = false, user = { id: 'offline-owner' } }) {
  const events = []
  let noticeState = null
  const context = {
    user, session: { isLoadingSession: false }, awaitingDirectorReply, uploadedFiles, activeTemplate, isGeneratingFinal,
    isExecutingSendRef: { current: false }, questionSubmissionPendingRef: { current: false },
    quota: { ...quota, refetch: () => { events.push(['quota-refetch']); return Promise.resolve() } },
    toast: value => events.push(['toast', value.title, value.variant ?? 'default']),
    setTopUpReason: text => events.push(['topup-reason', text]),
    setTopUpOpen: value => events.push(['topup-open', value]),
    console: { warn: (...args) => events.push(['warning', String(args[0])]), log: () => {} },
    isTemplateGenerationReady: template => template.ready,
    templateGenerationUnavailableReason: () => 'Template needs its blueprint first',
    STUDIO_BLOCKED_SEND_FEEDBACK_ENABLED: notice,
    setBlockedSendNotice: notice
      ? updater => { noticeState = typeof updater === 'function' ? updater(noticeState) : updater; events.push(['notice', noticeState && noticeState.kind, noticeState && noticeState.title]) }
      : () => assert.fail('notice flag off must never touch the notice'),
    nextBlockedSendNotice: blockedSend.nextBlockedSendNotice, quotaBlockedSendNotice: blockedSend.quotaBlockedSendNotice,
    templateBlockedSendNotice: blockedSend.templateBlockedSendNotice, uploadBlockedSendNotice: blockedSend.uploadBlockedSendNotice,
    quotaUnknownBlockedSendNotice: blockedSend.quotaUnknownBlockedSendNotice,
    STUDIO_QUOTA_FAIL_CLOSED_ENABLED: Boolean(flags.failClosed), STUDIO_TURN_PATHS_QUOTA_GATE_ENABLED: Boolean(flags.gate),
    events, get noticeState() { return noticeState },
  }
  // The page derives these from the quota hook; they are null unless the fail-closed flag is on.
  context.quotaFailClosedLoading = flags.failClosed ? quota.isLoading : null
  context.quotaFailClosedRefetch = flags.failClosed ? context.quota.refetch : null
  vm.runInNewContext(transpile(`globalThis.gate = ${gateFn};`), context)
  // The page assigns the ref only with the flag on; with it off the ref stays null.
  context.turnPathsGateRef = { current: flags.gate ? context.gate : null }
  context.gateCalls = []
  if (flags.gate) {
    const real = context.gate
    context.turnPathsGateRef.current = (...args) => { context.gateCalls.push(JSON.stringify(args)); return real(...args) }
  }
  return context
}
const gateSource = { now: callbackOf(page, 'preflightDirectorTurn'), base: callbackOf(basePage, 'preflightDirectorTurn') }

// ================================================================ 1. the gate itself
const gateOutcome = (ctx, result) => JSON.stringify([result, ctx.events])
const gateScenarios = {
  ...Object.fromEntries(Object.entries(QUOTAS).map(([name, quota]) => [name, { quota }])),
  'raw upload still uploading': { quota: QUOTAS['allowed plan'], uploadedFiles: [{ name: 'Pending.docx', status: 'uploading' }] },
  'raw upload failed': { quota: QUOTAS['allowed plan'], uploadedFiles: [{ name: 'Failed.docx', status: 'error' }] },
  'template generation locked': { quota: QUOTAS['allowed plan'], activeTemplate: { id: 't', ready: false } },
  'unauthenticated': { quota: QUOTAS['allowed plan'], user: null },
  'awaiting reply': { quota: QUOTAS['allowed plan'], awaitingDirectorReply: true },
  'template reuse running': { quota: QUOTAS['allowed plan'], activeTemplate: { ready: true }, isGeneratingFinal: true },
}
const gateHashes = []
for (const [name, scenario] of Object.entries(gateScenarios)) {
  for (const notice of [false, true]) {
    for (const call of [[], ['answers']]) {
      check(`gate, both flags off, equals the base gate: ${name} (${call.join('/') || 'typed'}, notice ${notice})`, () => {
        const run = fn => {
          const ctx = makeContext({ gateFn: fn, notice, ...scenario })
          return gateOutcome(ctx, ctx.gate(...call))
        }
        const now = run(gateSource.now), base = run(gateSource.base)
        assert.equal(now, base)
        if (!notice && !call.length) gateHashes.push([name, sha(now).slice(0, 10)])
      })
    }
  }
}
check('gate: a refusal that exists at the base is unchanged with planOnly absent, even with both flags ON when the plan is known', () => {
  for (const [name, scenario] of Object.entries(gateScenarios)) {
    if (!scenario.quota.status) continue
    const run = (fn, flags) => { const ctx = makeContext({ gateFn: fn, flags, ...scenario }); return gateOutcome(ctx, ctx.gate()) }
    assert.equal(run(gateSource.now, { gate: true, failClosed: true }), run(gateSource.base, {}), name)
  }
})

for (const notice of [false, true]) {
  const tag = `notice flag ${notice ? 'on' : 'off'}`
  check(`gate planOnly: runs only the plan decision (${tag})`, () => {
    // Busy / upload / template conditions that would refuse a typed send are ignored ...
    for (const name of ['raw upload still uploading', 'raw upload failed', 'template generation locked', 'awaiting reply', 'template reuse running']) {
      const ctx = makeContext({ gateFn: gateSource.now, notice, ...gateScenarios[name] })
      assert.equal(ctx.gate('typed', { planOnly: true }), true, name)
      assert.deepEqual(ctx.events.filter(e => e[0] !== 'notice'), [], `${name}: silent`)
    }
    // ... and they still refuse the typed gate (the same scenarios, planOnly absent).
    for (const name of ['raw upload still uploading', 'raw upload failed', 'template generation locked', 'awaiting reply', 'template reuse running']) {
      const ctx = makeContext({ gateFn: gateSource.now, notice, ...gateScenarios[name] })
      assert.equal(ctx.gate(), false, name)
    }
    // The plan decision itself is the same code: free/$0, capped pro, and the toast + dialog + notice.
    for (const name of ['free tier / $0 (the bypass)', 'pro, cap reached, no reserve']) {
      const plain = makeContext({ gateFn: gateSource.now, notice, quota: QUOTAS[name] })
      const plan = makeContext({ gateFn: gateSource.now, notice, quota: QUOTAS[name] })
      assert.equal(plain.gate('typed'), false)
      assert.equal(plan.gate('typed', { planOnly: true }), false)
      assert.deepEqual(plan.events, plain.events, `${name}: identical toast / dialog / notice`)
      assert.equal(plan.events.filter(e => e[0] === 'toast').length, 1)
      assert.equal(plan.events.filter(e => e[0] === 'topup-open').length, 1)
    }
    for (const name of ['allowed plan', 'cap reached, reserve covers it', 'no plan picture yet (fetch not answered)', 'plan picture failed to load']) {
      const ctx = makeContext({ gateFn: gateSource.now, notice, quota: QUOTAS[name] })
      assert.equal(ctx.gate('typed', { planOnly: true }), true, name)
    }
    const unauth = makeContext({ gateFn: gateSource.now, notice, quota: QUOTAS['allowed plan'], user: null })
    assert.equal(unauth.gate('typed', { planOnly: true }), false, 'a signed-out user is still refused')
  })
}

for (const notice of [false, true]) {
  const tag = `notice flag ${notice ? 'on' : 'off'}`
  check(`fail-closed flag OFF: an unknown plan picture passes, exactly as at the base (${tag})`, () => {
    for (const name of ['no plan picture yet (fetch not answered)', 'plan picture failed to load']) {
      for (const call of [['typed'], ['typed', { planOnly: true }]]) {
        const ctx = makeContext({ gateFn: gateSource.now, flags: { gate: true }, notice, quota: QUOTAS[name] })
        assert.equal(ctx.gate(...call), true, name)
        assert.deepEqual(ctx.events.filter(e => e[0] !== 'notice'), [])
      }
    }
  })
  check(`fail-closed flag ON: an unknown plan picture refuses with a toast and notice, no top-up dialog, no refetch while still loading (${tag})`, () => {
    const ctx = makeContext({ gateFn: gateSource.now, flags: { failClosed: true }, notice, quota: QUOTAS['no plan picture yet (fetch not answered)'] })
    assert.equal(ctx.gate('typed'), false)
    assert.deepEqual(ctx.events.filter(e => e[0] === 'toast'), [['toast', 'Checking your plan', 'default']])
    assert.equal(ctx.events.filter(e => e[0] === 'topup-open' || e[0] === 'topup-reason').length, 0, 'no top-up dialog: this is not a cap')
    assert.equal(ctx.events.filter(e => e[0] === 'quota-refetch').length, 0, 'the read is already in flight')
    if (notice) assert.equal(ctx.noticeState.kind, 'quota_unknown')
  })
  check(`fail-closed flag ON: a failed plan read refuses (destructive toast), asks for the read again once, and a later success passes (${tag})`, () => {
    const ctx = makeContext({ gateFn: gateSource.now, flags: { failClosed: true }, notice, quota: QUOTAS['plan picture failed to load'] })
    assert.equal(ctx.gate('typed'), false)
    assert.deepEqual(ctx.events.filter(e => e[0] === 'toast'), [['toast', "Couldn't check your plan", 'destructive']])
    assert.equal(ctx.events.filter(e => e[0] === 'quota-refetch').length, 1)
    assert.equal(ctx.events.filter(e => e[0] === 'topup-open').length, 0)
    if (notice) { assert.equal(ctx.noticeState.kind, 'quota_unknown'); assert.ok(ctx.noticeState.text.includes("couldn't confirm")) }
    // The read comes back: the same gate (re-created by the page) passes and clears the notice.
    const later = makeContext({ gateFn: gateSource.now, flags: { failClosed: true }, notice, quota: QUOTAS['allowed plan'] })
    assert.equal(later.gate('typed'), true)
    assert.equal(later.events.filter(e => e[0] === 'toast').length, 0)
  })
  check(`fail-closed flag ON: a KNOWN plan picture behaves exactly as at the base, whatever it says (${tag})`, () => {
    for (const [name, scenario] of Object.entries(gateScenarios)) {
      if (!scenario.quota.status) continue
      const now = makeContext({ gateFn: gateSource.now, flags: { failClosed: true }, notice, ...scenario })
      const base = makeContext({ gateFn: gateSource.base, notice, ...scenario })
      assert.equal(gateOutcome(now, now.gate()), gateOutcome(base, base.gate()), name)
    }
  })
}
check('fail-closed flag ON applies to every caller of the gate (typed, answers, planOnly) and ', () => {
  for (const call of [['typed'], ['answers'], ['action', { planOnly: true }], ['queued', { planOnly: true }]]) {
    const ctx = makeContext({ gateFn: gateSource.now, flags: { failClosed: true }, notice: true, quota: QUOTAS['plan picture failed to load'] })
    assert.equal(ctx.gate(...call), false, call.join('/'))
    assert.ok(ctx.noticeState.title.endsWith('not sent'), ctx.noticeState.title)
  }
})
check('fail-closed flag ON: a repeat refusal is announced again (new notice id)', () => {
  const ctx = makeContext({ gateFn: gateSource.now, flags: { failClosed: true }, notice: true, quota: QUOTAS['plan picture failed to load'] })
  ctx.gate(); const first = ctx.noticeState.id
  ctx.gate(); assert.equal(ctx.noticeState.id, first + 1)
})

// ================================================================ 2. handleActionClick (real function)
const actionFn = { now: callbackOf(page, 'handleActionClick'), base: callbackOf(basePage, 'handleActionClick') }
function actionWorld({ fn, flags = {}, notice = false, quota, sendResult = true, awaitingDirectorReply = false, uploadedFiles = [], activeTemplate = null }) {
  const ctx = makeContext({ gateFn: gateSource.now, flags, notice, quota, awaitingDirectorReply, uploadedFiles, activeTemplate })
  const events = ctx.events
  const answered = new Set()
  Object.assign(ctx, {
    questionSubmissionScopeRef: { current: { active: true, generation: 0, sessionId: 'offline-session', userId: 'offline-owner' } },
    currentSessionId: 'offline-session', wsSessionId: 'offline-session',
    actionSubmissionPendingRef: { current: new Set() },
    session: {
      isLoadingSession: false, answeredActionsRef: { current: answered },
      markStudioUserIntent: () => events.push(['intent']),
      userMessageIdsRef: { current: { add: id => events.push(['user-id', id]) } },
      setUserMessages: updater => events.push(['user-message', typeof updater === 'function' ? updater([]).map(m => m.text) : updater]),
    },
    crypto: { randomUUID: () => 'offline-uuid' },
    setPendingActionInput: value => events.push(['pending-input', value && value.action.label]),
    textareaRef: { current: { focus: () => events.push(['focus']) } },
    persistence: { queueMessage: (message, text) => events.push(['persist', text]) },
    researchEnabled: false, webSearchEnabled: false, extendedGenerationEnabled: true, canUseKnowledgeGraph: false, knowledgeGraphEnabled: false,
    sessionStoreName: null, buildSendOptions: {},
    setIsGeneratingFinal: value => events.push(['generating', value]),
    setTemplateReuseAwaitingInput: value => events.push(['template-awaiting', value]),
    setTimeout: fnc => { fnc(); return 1 },
    sendMessageWhenConnected: async (text, _a, _b, options) => { events.push(['send', text, options.actionValue, options.actionLabel]); return sendResult },
  })
  vm.runInNewContext(transpile(`globalThis.click = ${fn};`), ctx)
  return {
    ctx, events,
    click: (action, messageId = 'card-1') => ctx.click(action, messageId),
    answered,
  }
}
const BUTTON = { label: 'Generate my deck', value: 'accept_strawman', primary: true }
const ASKING_BUTTON = { label: 'Change the outline', value: 'edit_outline', requires_input: true }
const TEMPLATE_BUTTON = { label: 'Use this template', value: 'template_use' }
const actionOutcome = w => JSON.stringify([w.events, [...w.answered]])
const actionScenarios = {
  'free tier / $0 (the bypass), generate button': { quota: QUOTAS['free tier / $0 (the bypass)'], action: BUTTON },
  'pro, cap reached, generate button': { quota: QUOTAS['pro, cap reached, no reserve'], action: BUTTON },
  'allowed plan, generate button': { quota: QUOTAS['allowed plan'], action: BUTTON },
  'no plan picture yet': { quota: QUOTAS['no plan picture yet (fetch not answered)'], action: BUTTON },
  'plan picture failed': { quota: QUOTAS['plan picture failed to load'], action: BUTTON },
  'free tier / $0, button that asks for input first': { quota: QUOTAS['free tier / $0 (the bypass)'], action: ASKING_BUTTON },
  'allowed plan, button that asks for input first': { quota: QUOTAS['allowed plan'], action: ASKING_BUTTON },
  'free tier / $0, template button with an active template': { quota: QUOTAS['free tier / $0 (the bypass)'], action: TEMPLATE_BUTTON, activeTemplate: { ready: true } },
  'allowed plan, transport refuses (send returns false)': { quota: QUOTAS['allowed plan'], action: BUTTON, sendResult: false },
  'allowed plan, a reply is awaited and a file is uploading': { quota: QUOTAS['allowed plan'], action: BUTTON, awaitingDirectorReply: true, uploadedFiles: [{ name: 'Pending.docx', status: 'uploading' }] },
}
const actionOffHashes = []
let actionPending = []
for (const [name, { action, ...scenario }] of Object.entries(actionScenarios)) {
  actionPending.push((async () => {
    await checkAsync(`handleActionClick, both flags off, equals the base handler: ${name}`, async () => {
      const run = async fn => { const w = actionWorld({ fn, ...scenario }); await w.click(action); await flush(); return actionOutcome(w) }
      const now = await run(actionFn.now), base = await run(actionFn.base)
      assert.equal(now, base)
      actionOffHashes.push([name, sha(now).slice(0, 10)])
    })
    await checkAsync(`handleActionClick, fail-closed flag alone ON: still ungated (the turn-paths flag is off): ${name}`, async () => {
      const run = async (fn, flags) => { const w = actionWorld({ fn, flags, ...scenario }); await w.click(action); await flush(); return actionOutcome(w) }
      assert.equal(await run(actionFn.now, { failClosed: true }), await run(actionFn.base, {}))
    })
  })())
}
await Promise.all(actionPending)
await checkAsync('flag off keeps the bypass exactly as it was: a free/$0 account clicking the generate button sends with no gate', async () => {
  const w = actionWorld({ fn: actionFn.now, quota: QUOTAS['free tier / $0 (the bypass)'] })
  await w.click(BUTTON); await flush()
  assert.equal(w.events.filter(e => e[0] === 'send').length, 1)
  assert.equal(w.events.filter(e => e[0] === 'toast').length, 0)
  assert.deepEqual(w.ctx.gateCalls, [])
})

for (const notice of [false, true]) {
  const tag = `notice flag ${notice ? 'on' : 'off'}`
  await checkAsync(`turn-paths flag ON, free tier / $0: the button sends nothing, marks nothing answered, records no intent; the gate speaks once (${tag})`, async () => {
    for (const quota of [QUOTAS['free tier / $0 (the bypass)'], QUOTAS['pro, cap reached, no reserve']]) {
      const w = actionWorld({ fn: actionFn.now, flags: { gate: true }, notice, quota })
      await w.click(BUTTON); await flush()
      const kinds = kind => w.events.filter(e => e[0] === kind).length
      assert.deepEqual([kinds('send'), kinds('intent'), kinds('user-message'), kinds('persist'), kinds('generating')], [0, 0, 0, 0, 0])
      assert.equal(w.answered.size, 0, 'the card stays answerable')
      assert.equal(w.ctx.actionSubmissionPendingRef.current.size, 0)
      assert.deepEqual([kinds('toast'), kinds('topup-open')], [1, 1])
      assert.deepEqual(w.ctx.gateCalls, [JSON.stringify(['action', { planOnly: true }])])
      assert.equal(kinds('notice'), notice ? 1 : 0)
      if (notice) {
        assert.ok(w.ctx.noticeState.text.includes("your choice wasn't sent") && w.ctx.noticeState.text.includes('The option is still available.'))
        assert.ok(!w.ctx.noticeState.text.includes('Your text is still in the box'))
      }
      // After a top-up the SAME card can be clicked and goes out once.
      w.ctx.quota.status = ALLOWED()
      await w.click(BUTTON); await flush()
      assert.equal(w.events.filter(e => e[0] === 'send').length, 1)
      assert.equal(w.answered.size, 1)
    }
  })
}
await checkAsync('turn-paths flag ON, the generate action on an allowed plan sends the same frames as the base (events identical apart from the notice)', async () => {
  for (const name of ['allowed plan, generate button', 'allowed plan, transport refuses (send returns false)', 'allowed plan, a reply is awaited and a file is uploading', 'no plan picture yet', 'plan picture failed']) {
    const { action, ...scenario } = actionScenarios[name]
    for (const notice of [false, true]) {
      const base = actionWorld({ fn: actionFn.base, ...scenario }); await base.click(action); await flush()
      const on = actionWorld({ fn: actionFn.now, flags: { gate: true }, notice, ...scenario }); await on.click(action); await flush()
      assert.equal(JSON.stringify(on.events.filter(e => e[0] !== 'notice')), JSON.stringify(base.events), name)
      assert.deepEqual([...on.answered], [...base.answered], name)
    }
  }
})
await checkAsync('turn-paths flag ON: a button that only opens an input box never reaches the gate, even on a free/$0 plan (its later send is gated by the typed handler)', async () => {
  const w = actionWorld({ fn: actionFn.now, flags: { gate: true }, quota: QUOTAS['free tier / $0 (the bypass)'] })
  await w.click(ASKING_BUTTON); await flush()
  assert.deepEqual(w.ctx.gateCalls, [])
  assert.equal(w.events.filter(e => e[0] === 'toast').length, 0)
  assert.equal(w.events.filter(e => e[0] === 'pending-input').length, 1)
  assert.equal(w.events.filter(e => e[0] === 'send').length, 0)
})
await checkAsync('turn-paths flag ON: a template action on a free/$0 plan is refused before it can flip the template build state', async () => {
  const w = actionWorld({ fn: actionFn.now, flags: { gate: true }, quota: QUOTAS['free tier / $0 (the bypass)'], activeTemplate: { ready: true } })
  await w.click(TEMPLATE_BUTTON); await flush()
  assert.equal(w.events.filter(e => ['send', 'generating', 'template-awaiting'].includes(e[0])).length, 0)
})
await checkAsync('turn-paths + fail-closed flags ON: the action button is refused while the plan picture is unknown, and goes out once it is known', async () => {
  for (const name of ['no plan picture yet', 'plan picture failed']) {
    const { action, ...scenario } = actionScenarios[name]
    const w = actionWorld({ fn: actionFn.now, flags: { gate: true, failClosed: true }, notice: true, ...scenario })
    await w.click(action); await flush()
    assert.equal(w.events.filter(e => e[0] === 'send').length, 0, name)
    assert.equal(w.ctx.noticeState.kind, 'quota_unknown')
    assert.equal(w.answered.size, 0)
    w.ctx.quota.status = ALLOWED()
    await w.click(action); await flush()
    assert.equal(w.events.filter(e => e[0] === 'send').length, 1, name)
  }
})
await checkAsync('a double click while the first send is in flight is still one send (the pending-key guard runs before the gate and is unchanged)', async () => {
  const w = actionWorld({ fn: actionFn.now, flags: { gate: true }, quota: QUOTAS['allowed plan'] })
  const first = w.click(BUTTON); const second = w.click(BUTTON)
  await Promise.all([first, second]); await flush()
  assert.equal(w.events.filter(e => e[0] === 'send').length, 1)
})

// ================================================================ 3. onSessionDirective (real option)
const directiveFn = { now: print(directiveNode(page), page), base: print(directiveNode(basePage), basePage) }
function directiveWorld({ fn, flags = {}, notice = false, quota, awaitingDirectorReply = false, uploadedFiles = [] }) {
  const ctx = makeContext({ gateFn: gateSource.now, flags, notice, quota, awaitingDirectorReply, uploadedFiles })
  const events = ctx.events
  Object.assign(ctx, {
    handleNewChatWrappedRef: { current: () => events.push(['new-chat']) },
    session: { setUserMessages: updater => events.push(['user-bubble', typeof updater === 'function' ? updater([]).map(m => m.text) : updater]) },
    deckIdentityRef: { current: null },
    setInputMessage: value => events.push(['draft', value]),
    sendMessageWhenConnected: (text, _a, _b, options) => { events.push(['send', text, JSON.stringify(options)]); return Promise.resolve(true) },
    Date: class FixedDate extends Date { static now() { return 1_000 } },
  })
  vm.runInNewContext(transpile(`globalThis.directive = ${fn};`), ctx)
  return { ctx, events, run: payload => ctx.directive(payload) }
}
const DIRECTIVE = { directive: 'new_session', prefill_prompt: ' Build a 10-slide investor deck for a climate-fintech seed round. ', auto_send: true }
const directiveScenarios = {
  'free tier / $0 (the bypass), auto_send': { quota: QUOTAS['free tier / $0 (the bypass)'], payload: DIRECTIVE },
  'pro, cap reached, auto_send': { quota: QUOTAS['pro, cap reached, no reserve'], payload: DIRECTIVE },
  'allowed plan, auto_send': { quota: QUOTAS['allowed plan'], payload: DIRECTIVE },
  'allowed plan, auto_send, a reply is still marked awaited (the directive frame is the reply)': { quota: QUOTAS['allowed plan'], payload: DIRECTIVE, awaitingDirectorReply: true },
  'free tier / $0, prefill without auto_send': { quota: QUOTAS['free tier / $0 (the bypass)'], payload: { ...DIRECTIVE, auto_send: false } },
  'free tier / $0, other directive': { quota: QUOTAS['free tier / $0 (the bypass)'], payload: { ...DIRECTIVE, directive: 'something_else' } },
  'free tier / $0, empty prefill': { quota: QUOTAS['free tier / $0 (the bypass)'], payload: { ...DIRECTIVE, prefill_prompt: '  ' } },
  'no plan picture yet': { quota: QUOTAS['no plan picture yet (fetch not answered)'], payload: DIRECTIVE },
}
const directiveOffHashes = []
for (const [name, { payload, ...scenario }] of Object.entries(directiveScenarios)) {
  check(`onSessionDirective, both flags off, equals the base handler: ${name}`, () => {
    const run = fn => { const w = directiveWorld({ fn, ...scenario }); w.run(payload); return JSON.stringify(w.events) }
    const now = run(directiveFn.now), base = run(directiveFn.base)
    assert.equal(now, base)
    directiveOffHashes.push([name, sha(now).slice(0, 10)])
  })
}
check('flag off keeps the bypass exactly as it was: a free/$0 account gets the auto-send and a sent bubble with no gate', () => {
  const w = directiveWorld({ fn: directiveFn.now, quota: QUOTAS['free tier / $0 (the bypass)'] })
  w.run(DIRECTIVE)
  assert.equal(w.events.filter(e => e[0] === 'send').length, 1)
  assert.equal(w.events.filter(e => e[0] === 'user-bubble').length, 1)
  assert.equal(w.events.filter(e => e[0] === 'toast').length, 0)
})
for (const notice of [false, true]) {
  const tag = `notice flag ${notice ? 'on' : 'off'}`
  check(`turn-paths flag ON, free tier / $0: the new chat opens with the brief in the composer, nothing is sent, no sent bubble, the gate speaks once (${tag})`, () => {
    for (const quota of [QUOTAS['free tier / $0 (the bypass)'], QUOTAS['pro, cap reached, no reserve']]) {
      const w = directiveWorld({ fn: directiveFn.now, flags: { gate: true }, notice, quota })
      w.run(DIRECTIVE)
      const kinds = kind => w.events.filter(e => e[0] === kind).length
      assert.deepEqual([kinds('new-chat'), kinds('send'), kinds('user-bubble')], [1, 0, 0])
      assert.deepEqual(w.events.filter(e => e[0] === 'draft'), [['draft', 'Build a 10-slide investor deck for a climate-fintech seed round.']], 'the trimmed brief is in the box, like the non-auto-send branch')
      assert.ok(w.events.findIndex(e => e[0] === 'new-chat') < w.events.findIndex(e => e[0] === 'draft'), 'composer set after the new chat clears it')
      assert.deepEqual([kinds('toast'), kinds('topup-open')], [1, 1])
      assert.deepEqual(w.ctx.gateCalls, [JSON.stringify(['typed', { planOnly: true }])])
      assert.equal(kinds('notice'), notice ? 1 : 0)
    }
  })
}
check('turn-paths flag ON: a refused auto-send leaves exactly the state of the non-auto-send branch (same events as auto_send false)', () => {
  const refused = directiveWorld({ fn: directiveFn.now, flags: { gate: true }, quota: QUOTAS['free tier / $0 (the bypass)'] })
  refused.run(DIRECTIVE)
  const manual = directiveWorld({ fn: directiveFn.now, flags: { gate: true }, quota: QUOTAS['free tier / $0 (the bypass)'] })
  manual.run({ ...DIRECTIVE, auto_send: false })
  const onlyState = events => events.filter(e => ['new-chat', 'draft', 'send', 'user-bubble'].includes(e[0]))
  assert.deepEqual(onlyState(refused.events), onlyState(manual.events))
})
check('turn-paths flag ON: an allowed plan sends the same frames as the base, even while the reply flag is still set (the gate here is plan-only)', () => {
  for (const name of ['allowed plan, auto_send', 'allowed plan, auto_send, a reply is still marked awaited (the directive frame is the reply)', 'no plan picture yet']) {
    const { payload, ...scenario } = directiveScenarios[name]
    for (const notice of [false, true]) {
      const base = directiveWorld({ fn: directiveFn.base, ...scenario }); base.run(payload)
      const on = directiveWorld({ fn: directiveFn.now, flags: { gate: true }, notice, ...scenario }); on.run(payload)
      assert.equal(JSON.stringify(on.events.filter(e => e[0] !== 'notice')), JSON.stringify(base.events), name)
    }
  }
})
check('turn-paths flag ON: directives that are not an auto-send never reach the gate', () => {
  for (const name of ['free tier / $0, prefill without auto_send', 'free tier / $0, other directive', 'free tier / $0, empty prefill']) {
    const { payload, ...scenario } = directiveScenarios[name]
    const w = directiveWorld({ fn: directiveFn.now, flags: { gate: true }, ...scenario }); w.run(payload)
    assert.deepEqual(w.ctx.gateCalls, [], name)
  }
})
check('turn-paths + fail-closed flags ON: the auto-send is refused while the plan picture is unknown', () => {
  const w = directiveWorld({ fn: directiveFn.now, flags: { gate: true, failClosed: true }, notice: true, quota: QUOTAS['plan picture failed to load'] })
  w.run(DIRECTIVE)
  assert.equal(w.events.filter(e => e[0] === 'send').length, 0)
  assert.equal(w.events.filter(e => e[0] === 'draft').length, 1)
  assert.equal(w.ctx.noticeState.kind, 'quota_unknown')
})

// ================================================================ 4. template-ingest auto-send effect (real effect)
const ingestFn = { now: print(ingestEffectCall(page).arguments[0], page), base: print(ingestEffectCall(basePage).arguments[0], basePage) }
function ingestWorld({ fn, flags = {}, notice = false, quota, sendResult = true, intent = { storage_path: 'offline/source.pptx', file_name: 'Source.pptx', kind: 'pptx' } }) {
  const ctx = makeContext({ gateFn: gateSource.now, flags, notice, quota })
  const events = ctx.events
  const storage = new Map()
  const timers = []
  if (intent) storage.set('ingest-intent:offline-session', JSON.stringify(intent))
  Object.assign(ctx, {
    window: {}, process: { env: { NEXT_PUBLIC_TEMPLATE_INGEST_ENABLED: 'true' } },
    isReady: true, currentSessionId: 'offline-session', socketSessionId: 'offline-session', connectionGeneration: 1,
    INGEST_INTENT_KEY_PREFIX: 'ingest-intent:', INGEST_JOB_KEY_PREFIX: 'ingest-job:',
    sessionStorage: { getItem: key => storage.get(key) ?? null, removeItem: key => storage.delete(key), setItem: (key, value) => storage.set(key, value) },
    ingestAutoSendSessionRef: { current: null }, ingestAutoSendGenerationRef: { current: -1 }, ingestAckTimerRef: { current: null },
    ingestChatEchoSessionRef: { current: null }, ingestGateRefusalRef: { current: null }, ingestGatePassedSessionRef: { current: null },
    setIngestResendNonce: () => events.push(['resend-nonce']),
    sendMessage: (text, _a, _b, options) => { events.push(['send', text, options.templateIngest, options.ingestUploadRef.file_name]); return ctx.sendResult },
    sendResult,
    setTimeout: (callback, ms) => { timers.push({ callback, ms }); return timers.length },
    clearTimeout: () => {},
    crypto: { randomUUID: () => 'offline-uuid' },
    session: {
      userMessageIdsRef: { current: { add: () => {} } }, setUserMessages: () => events.push(['echo']),
      hasTitleFromUserMessageRef: { current: false }, hasTitleFromPresentationRef: { current: false },
    },
    persistence: { queueMessage: () => events.push(['persist']), updateMetadata: () => events.push(['title']) },
  })
  const derive = () => {
    ctx.ingestGateQuotaStatus = flags.gate ? ctx.quota.status : null
    ctx.ingestGateQuotaLoading = flags.gate ? ctx.quota.isLoading : null
  }
  vm.runInNewContext(transpile(`globalThis.effect = ${fn};`), ctx)
  derive()
  return {
    ctx, events, storage, timers,
    run() { ctx.effect() },
    rerender(patch = {}) {
      const { quota: nextQuota, ...rest } = patch
      Object.assign(ctx, rest)
      if (nextQuota) ctx.quota = { ...ctx.quota, ...nextQuota }
      if (nextQuota) { ctx.quotaFailClosedLoading = flags.failClosed ? ctx.quota.isLoading : null }
      derive()
    },
  }
}
const ingestOutcome = w => JSON.stringify([w.events, [...w.storage.keys()], w.ctx.ingestAutoSendSessionRef.current, w.ctx.ingestAutoSendGenerationRef.current, w.timers.map(t => t.ms)])
const ingestScenarios = {
  'free tier / $0 (the bypass)': { quota: QUOTAS['free tier / $0 (the bypass)'] },
  'pro, cap reached, no reserve': { quota: QUOTAS['pro, cap reached, no reserve'] },
  'allowed plan': { quota: QUOTAS['allowed plan'] },
  'no plan picture yet': { quota: QUOTAS['no plan picture yet (fetch not answered)'] },
  'plan picture failed': { quota: QUOTAS['plan picture failed to load'] },
  'allowed plan, transport not open (send returns false)': { quota: QUOTAS['allowed plan'], sendResult: false },
  'free tier / $0, no staged intent': { quota: QUOTAS['free tier / $0 (the bypass)'], intent: null },
  'free tier / $0, malformed intent': { quota: QUOTAS['free tier / $0 (the bypass)'], intent: { storage_path: '' } },
}
const ingestOffHashes = []
for (const [name, scenario] of Object.entries(ingestScenarios)) {
  check(`template-ingest effect, both flags off, equals the base effect: ${name}`, () => {
    const run = fn => { const w = ingestWorld({ fn, ...scenario }); w.run(); w.run(); return ingestOutcome(w) }
    const now = run(ingestFn.now), base = run(ingestFn.base)
    assert.equal(now, base)
    ingestOffHashes.push([name, sha(now).slice(0, 10)])
  })
}
check('flag off keeps the bypass exactly as it was: a free/$0 account has its template ingest sent with no gate', () => {
  const w = ingestWorld({ fn: ingestFn.now, quota: QUOTAS['free tier / $0 (the bypass)'] })
  w.run()
  assert.equal(w.events.filter(e => e[0] === 'send').length, 1)
  assert.equal(w.events.filter(e => e[0] === 'toast').length, 0)
})
for (const notice of [false, true]) {
  const tag = `notice flag ${notice ? 'on' : 'off'}`
  check(`turn-paths flag ON, free tier / $0: nothing is sent, the intent stays staged and un-marked, the gate speaks once however often the effect re-runs (${tag})`, () => {
    for (const quota of [QUOTAS['free tier / $0 (the bypass)'], QUOTAS['pro, cap reached, no reserve']]) {
      const w = ingestWorld({ fn: ingestFn.now, flags: { gate: true }, notice, quota })
      w.run()
      assert.equal(w.ctx.ingestAutoSendSessionRef.current, null, 'a refusal does not mark the intent as sent (checked after the first run: the effect re-arms a stale mark on its next run)')
      for (let i = 0; i < 24; i++) w.run()
      const kinds = kind => w.events.filter(e => e[0] === kind).length
      assert.deepEqual([kinds('send'), kinds('echo'), kinds('persist'), kinds('title')], [0, 0, 0, 0])
      assert.equal(w.timers.length, 0, 'no ack timer armed')
      assert.ok(w.storage.has('ingest-intent:offline-session'), 'intent stays staged')
      assert.equal(w.ctx.ingestAutoSendSessionRef.current, null, 'not marked as sent')
      assert.deepEqual([kinds('toast'), kinds('topup-open')], [1, 1])
      assert.deepEqual(w.ctx.gateCalls, [JSON.stringify(['queued', { planOnly: true }])])
      assert.equal(kinds('notice'), notice ? 1 : 0)
      if (notice) {
        assert.ok(w.ctx.noticeState.text.includes("your request wasn't sent") && w.ctx.noticeState.text.includes('stays queued'))
        assert.ok(!w.ctx.noticeState.text.includes('text is still in the box'))
      }
    }
  })
}
check('turn-paths flag ON: while the plan picture is loading the effect waits (no gate call, no send); then it blocks or sends', () => {
  const w = ingestWorld({ fn: ingestFn.now, flags: { gate: true }, quota: QUOTAS['no plan picture yet (fetch not answered)'] })
  w.run(); w.run()
  assert.deepEqual(w.events, [])
  assert.deepEqual(w.ctx.gateCalls, [])
  w.rerender({ quota: { status: FREE_ZERO(), isLoading: false } }); w.run()
  assert.equal(w.events.filter(e => e[0] === 'send').length, 0)
  assert.equal(w.events.filter(e => e[0] === 'toast').length, 1)
  const w2 = ingestWorld({ fn: ingestFn.now, flags: { gate: true }, quota: QUOTAS['no plan picture yet (fetch not answered)'] })
  w2.run(); w2.rerender({ quota: { status: ALLOWED(), isLoading: false } }); w2.run(); w2.run()
  assert.equal(w2.events.filter(e => e[0] === 'send').length, 1, 'sent once, not once per re-run')
})
check('turn-paths flag ON: a new plan picture that is still blocked is announced once more; one that opens the gate sends exactly once', () => {
  const w = ingestWorld({ fn: ingestFn.now, flags: { gate: true }, quota: QUOTAS['free tier / $0 (the bypass)'] })
  w.run(); w.run()
  w.rerender({ quota: { status: FREE_ZERO(), isLoading: false } }); w.run(); w.run()
  assert.equal(w.events.filter(e => e[0] === 'toast').length, 2)
  assert.equal(w.events.filter(e => e[0] === 'send').length, 0)
  w.rerender({ quota: { status: RESERVE(), isLoading: false } }); w.run(); w.run(); w.run()
  assert.equal(w.events.filter(e => e[0] === 'send').length, 1)
  assert.equal(w.ctx.ingestAutoSendSessionRef.current, 'offline-session')
  assert.equal(w.events.filter(e => e[0] === 'echo').length, 1)
})
check('turn-paths flag ON: a RE-send of an intent whose first send passed the gate does not run the gate again (no spurious dialog after a spend)', () => {
  const w = ingestWorld({ fn: ingestFn.now, flags: { gate: true }, quota: QUOTAS['allowed plan'] })
  w.run()
  assert.equal(w.events.filter(e => e[0] === 'send').length, 1)
  assert.equal(w.ctx.gateCalls.length, 1)
  // The first send is acknowledged late, the plan is now exhausted by that very build, the socket re-opens: re-arm and re-send.
  w.rerender({ quota: { status: FREE_ZERO(), isLoading: false }, connectionGeneration: 2 }); w.run()
  assert.equal(w.events.filter(e => e[0] === 'send').length, 2, 'the idempotent re-send still goes out')
  assert.equal(w.ctx.gateCalls.length, 1, 'gate not consulted again')
  assert.equal(w.events.filter(e => e[0] === 'toast').length, 0)
})
check('turn-paths flag ON and the gate passes: the same events as the base effect (allowed, reserve, no data after the fetch, transport not open)', () => {
  for (const name of ['allowed plan', 'plan picture failed', 'allowed plan, transport not open (send returns false)']) {
    for (const notice of [false, true]) {
      const base = ingestWorld({ fn: ingestFn.base, ...ingestScenarios[name] }); base.run(); base.run()
      const on = ingestWorld({ fn: ingestFn.now, flags: { gate: true }, notice, ...ingestScenarios[name] }); on.run(); on.run()
      assert.equal(JSON.stringify(on.events.filter(e => e[0] !== 'notice')), JSON.stringify(base.events), name)
      assert.deepEqual([...on.storage.keys()], [...base.storage.keys()])
    }
  }
})
check('turn-paths + fail-closed flags ON: the ingest waits for the read; a failed read refuses (and asks again); a later answer sends', () => {
  const w = ingestWorld({ fn: ingestFn.now, flags: { gate: true, failClosed: true }, notice: true, quota: QUOTAS['plan picture failed to load'] })
  w.run(); w.run(); w.run()
  assert.equal(w.events.filter(e => e[0] === 'send').length, 0)
  assert.equal(w.events.filter(e => e[0] === 'toast').length, 1)
  assert.equal(w.events.filter(e => e[0] === 'quota-refetch').length, 1)
  assert.equal(w.ctx.noticeState.kind, 'quota_unknown')
  w.rerender({ quota: { status: ALLOWED(), isLoading: false } }); w.run(); w.run()
  assert.equal(w.events.filter(e => e[0] === 'send').length, 1)
})
check('turn-paths flag ON: with no staged intent, or with the template-ingest feature off, the gate is never consulted', () => {
  const none = ingestWorld({ fn: ingestFn.now, flags: { gate: true }, quota: QUOTAS['free tier / $0 (the bypass)'], intent: null }); none.run()
  assert.deepEqual([none.ctx.gateCalls, none.events], [[], []])
  const off = ingestWorld({ fn: ingestFn.now, flags: { gate: true }, quota: QUOTAS['free tier / $0 (the bypass)'] })
  off.ctx.process.env.NEXT_PUBLIC_TEMPLATE_INGEST_ENABLED = 'false'; off.run()
  assert.deepEqual([off.ctx.gateCalls, off.events], [[], []])
})

// ================================================================ 5. refresh after spend (real hooks/use-quota.ts)
function hookWorld(code, options, { quotaStatus: initial = ALLOWED() } = {}) {
  const slots = []
  let cursor = 0, dirty = false
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
  const effects = []
  const react = {
    useState: init => { const i = cursor++; if (!(i in slots)) slots[i] = { value: typeof init === 'function' ? init() : init }; return [slots[i].value, v => { const next = typeof v === 'function' ? v(slots[i].value) : v; if (!Object.is(next, slots[i].value)) dirty = true; slots[i].value = next }] },
    useRef: init => { const i = cursor++; return slots[i] ||= { current: init } },
    useCallback: (fn, deps) => { const i = cursor++; const old = slots[i]; if (old && same(old.deps, deps)) return old.fn; slots[i] = { fn, deps }; return fn },
    useEffect: (fn, deps) => { const i = cursor++; const old = slots[i]; if (old && same(old.deps, deps)) return; slots[i] = { deps }; effects.push(fn) },
  }
  const net = { calls: [], pending: [] }
  const handlers = { quota: () => ({ ok: true, body: initial }), debit: () => ({ ok: true, body: { costCents: 3, deducted: false, capped: false, quota: net.afterSpend ?? initial } }) }
  const fetch = (url, init) => {
    const kind = url.includes('/debit') ? 'debit' : 'quota'
    const entry = { kind, method: init?.method ?? 'GET', order: net.calls.length }
    net.calls.push(entry)
    return new Promise((resolve, reject) => {
      entry.settle = () => {
        const result = handlers[kind]()
        entry.settled = true
        if (result.throws) reject(new Error('offline: network down'))
        else resolve({ ok: result.ok, json: async () => result.body })
      }
      if (!net.manual) entry.settle()
      else net.pending.push(entry)
    })
  }
  const mod = { exports: {} }
  vm.runInNewContext(transpile(code), {
    module: mod, exports: mod.exports, fetch, Set, Promise, JSON, Object, Error,
    require: id => id === 'react' ? react : id === 'next-auth/react' ? { useSession: () => ({ data: { user: { id: 'offline-owner' } } }) } : assert.fail(`unexpected import ${id}`),
  })
  let result
  const render = (...args) => {
    let turns = 0
    do { assert.ok(turns++ < 20); dirty = false; cursor = 0; effects.length = 0; result = mod.exports.useQuota(args[0], args[1], options); effects.splice(0).forEach(fn => fn()) } while (dirty)
    return result
  }
  return { render, net, handlers, get result() { return result } }
}
const USAGE = (id, tokens = 1200) => [{ turn: { total_tokens: tokens }, action_type: 'chat' }, id]
const kindsOf = net => net.calls.map(c => c.kind)
await checkAsync('refresh-after-spend option absent or false: the hook makes exactly the old requests (read on mount, then one debit per turn, nothing else)', async () => {
  for (const options of [undefined, {}, { refreshAfterSpend: false }]) {
    const w = hookWorld(hookText, options)
    w.render(null, undefined); await flush()
    w.render(...USAGE('m1')); await flush(); w.render(...USAGE('m1')); await flush()
    assert.deepEqual(kindsOf(w.net), ['quota', 'debit'])
    const base = hookWorld(baseHookText, undefined)
    base.render(null, undefined); await flush(); base.render(...USAGE('m1')); await flush(); base.render(...USAGE('m1')); await flush()
    assert.deepEqual(kindsOf(w.net), kindsOf(base.net))
    assert.equal(JSON.stringify(w.result.status), JSON.stringify(base.result.status))
  }
})
await checkAsync('refresh-after-spend ON: after the wallet debit for a turn settles, the quota is read once more, strictly after the debit response (never in parallel)', async () => {
  const w = hookWorld(hookText, { refreshAfterSpend: true })
  w.net.manual = true
  w.render(null, undefined); w.net.pending.shift().settle(); await flush()
  assert.deepEqual(kindsOf(w.net), ['quota'], 'mount read')
  w.render(...USAGE('m1')); await flush()
  assert.deepEqual(kindsOf(w.net), ['quota', 'debit'], 'debit issued, nothing else while it is pending')
  w.net.afterSpend = quotaStatus({ dailyAt: true }, 0, 5000)
  w.net.pending.shift().settle(); await flush()
  assert.deepEqual(kindsOf(w.net), ['quota', 'debit', 'quota'], 'the re-read is issued only once the debit has settled')
  assert.equal(w.net.calls[2].method, 'GET')
  // The re-read reflects what the server now says: a cap reached by this very turn closes the gate for the next one.
  w.handlers.quota = () => ({ ok: true, body: quotaStatus({ dailyAt: true }, 0, 5000) })
  w.net.pending.shift().settle(); await flush(); w.render(...USAGE('m1')); await flush()
  assert.equal(w.result.status.flags.dailyAt, true)
  assert.equal(kindsOf(w.net).length, 3, 'one refresh per spend, not one per render')
})
await checkAsync('refresh-after-spend ON: the re-read also happens when the debit failed (non-OK or network error), where the snapshot would otherwise stay stale', async () => {
  for (const failure of [{ ok: false, body: {} }, { throws: true }]) {
    const w = hookWorld(hookText, { refreshAfterSpend: true })
    w.render(null, undefined); await flush()
    w.handlers.debit = () => failure
    w.render(...USAGE('m1')); await flush()
    assert.deepEqual(kindsOf(w.net), ['quota', 'debit', 'quota'])
  }
})
await checkAsync('refresh-after-spend ON: a turn with no token usage books no spend and triggers nothing; each new turn refreshes once', async () => {
  const w = hookWorld(hookText, { refreshAfterSpend: true })
  w.render(null, undefined); await flush()
  w.render({ turn: { total_tokens: 0 }, action_type: 'chat' }, 'm0'); await flush()
  assert.deepEqual(kindsOf(w.net), ['quota'])
  w.render(...USAGE('m1')); await flush()
  w.render(...USAGE('m2', 800)); await flush()
  assert.deepEqual(kindsOf(w.net), ['quota', 'debit', 'quota', 'debit', 'quota'])
})
await checkAsync('refresh-after-spend ON: when a debit succeeds the fresh snapshot is applied before the re-read, so the gate never sees an older picture than the debit gave it', async () => {
  const w = hookWorld(hookText, { refreshAfterSpend: true })
  w.net.manual = true
  w.render(null, undefined); w.net.pending.shift().settle(); await flush()
  w.render(...USAGE('m1')); await flush()
  w.net.afterSpend = quotaStatus({ dailyAt: true, weeklyAt: true }, 0, 5000)
  w.net.pending.shift().settle(); await flush()
  w.render(...USAGE('m1')); await flush()
  assert.equal(w.result.status.flags.dailyAt, true, 'applied from the debit response while the re-read is still in flight')
})

// ================================================================ summary
console.log(`Turn-paths quota gate: ${cases} offline cases passed. Flag-off outcomes identical to ${BASE}`)
console.log(`  gate (sha256/10): ${gateHashes.map(([n, h]) => `${n}=${h}`).join('; ')}`)
console.log(`  handleActionClick: ${actionOffHashes.map(([n, h]) => `${n}=${h}`).join('; ')}`)
console.log(`  onSessionDirective: ${directiveOffHashes.map(([n, h]) => `${n}=${h}`).join('; ')}`)
console.log(`  template-ingest effect: ${ingestOffHashes.map(([n, h]) => `${n}=${h}`).join('; ')}`)
