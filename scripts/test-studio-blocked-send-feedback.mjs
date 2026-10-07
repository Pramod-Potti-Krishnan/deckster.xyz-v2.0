import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

// Blocked-send feedback (flag NEXT_PUBLIC_STUDIO_BLOCKED_SEND_FEEDBACK_ENABLED, default off).
// Runs the REAL Builder gate (`preflightDirectorTurn`) and the REAL typed handler
// (`handleSendMessage`) extracted from app/builder/page.tsx, plus the real helper
// and notice leaf, with offline stand-ins for everything else. No React mount,
// no network, no socket, no sign-in. The baseline is the same functions read from
// the base commit, so flag off is compared to what shipped, not to a copy.
const BASE = '6d47cae' // studio-v4-dev-preparation-code before this change
const sha = value => crypto.createHash('sha256').update(value).digest('hex')
const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const parse = (name, text) => ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const transpile = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
const printer = ts.createPrinter({ removeComments: true })
const print = (node, root) => printer.printNode(ts.EmitHint.Unspecified, node, root)
function find(root, predicate) {
  if (predicate(root)) return root
  let match
  ts.forEachChild(root, child => { if (!match) match = find(child, predicate) })
  return match
}
function findAll(root, predicate, found = []) {
  if (predicate(root)) found.push(root)
  ts.forEachChild(root, child => { findAll(child, predicate, found) })
  return found
}
function declaration(root, name) {
  const node = find(root, n => ts.isVariableDeclaration(n) && n.name.getText(root) === name)
  assert.ok(node, `missing ${name}`)
  return node.initializer
}
let cases = 0
const check = (name, fn) => { fn(); cases++; void name }

// ---------------------------------------------------------------- helper module
function loadHelpers(env = {}) {
  const module = { exports: {} }
  vm.runInNewContext(transpile(read('lib/studio-blocked-send.ts')), { module, exports: module.exports, process: { env }, require: id => assert.fail(`helper must stay import-free: ${id}`) })
  return module.exports
}
const helpers = loadHelpers()
for (const [shell, flag, expected] of [
  [undefined, undefined, false], ['true', undefined, false], ['true', 'false', false], ['true', '1', false], ['true', 'TRUE', false],
  ['false', 'true', false], [undefined, 'true', false], ['true', 'true', true],
]) {
  check(`flag ${shell}/${flag}`, () => {
    assert.equal(helpers.studioBlockedSendFeedbackFlagOn(shell, flag), expected)
    assert.equal(loadHelpers({ NEXT_PUBLIC_STUDIO_V4_SHELL: shell, NEXT_PUBLIC_STUDIO_BLOCKED_SEND_FEEDBACK_ENABLED: flag }).STUDIO_BLOCKED_SEND_FEEDBACK_ENABLED, expected)
  })
}
assert.equal(helpers.STUDIO_BLOCKED_SEND_FEEDBACK_ENABLED, false, 'unset env is OFF')

check('quota copy: cap reached', () => {
  const n = helpers.quotaBlockedSendNotice({ which: 'daily', resetLabel: 'Wed 2:00 PM', caps: { monthlyCents: 5000 } })
  assert.equal(n.kind, 'quota')
  assert.equal(n.title, 'Message not sent')
  assert.ok(n.text.includes("so your message wasn't sent. Your text is still in the box."), n.text)
  assert.ok(n.text.startsWith('This account has no build quota left on its plan'), n.text)
  assert.ok(n.text.includes('Your daily budget resets Wed 2:00 PM'))
})
check('quota copy: plan with no allowance (free tier, $0)', () => {
  const n = helpers.quotaBlockedSendNotice({ which: 'weekly', resetLabel: 'x', caps: { monthlyCents: 0 } })
  assert.equal(n.kind, 'no_allowance')
  assert.ok(n.text.includes("includes no build quota, so your message wasn't sent. Your text is still in the box."), n.text)
  assert.ok(!n.text.includes('resets'), 'no reset promise when the plan has no allowance')
})
check('quota copy: missing caps fall back to cap reached', () => {
  assert.equal(helpers.quotaBlockedSendNotice({ which: 'daily', resetLabel: 'x' }).kind, 'quota')
  assert.equal(helpers.quotaBlockedSendNotice({ which: 'daily', resetLabel: 'x', caps: null }).kind, 'quota')
})
check('answers source never claims the composer box', () => {
  for (const n of [
    helpers.quotaBlockedSendNotice({ which: 'daily', resetLabel: 'x', caps: { monthlyCents: 0 } }, 'answers'),
    helpers.quotaBlockedSendNotice({ which: 'daily', resetLabel: 'x', caps: { monthlyCents: 100 } }, 'answers'),
    helpers.uploadBlockedSendNotice({ name: 'a.pdf', status: 'uploading' }, 'answers'),
    helpers.templateBlockedSendNotice('Locked', 'answers'),
  ]) {
    assert.equal(n.title, 'Answers not sent')
    assert.ok(n.text.includes("answers weren't sent") && n.text.includes('still in the question card'), n.text)
    assert.ok(!n.text.includes('in the box'), n.text)
  }
})
check('upload and template copy', () => {
  const pending = helpers.uploadBlockedSendNotice({ name: 'Brief.docx', status: 'uploading' })
  assert.equal(pending.kind, 'upload_pending')
  assert.ok(pending.text.startsWith("Your message wasn't sent because Brief.docx is still uploading. Your text is still in the box."), pending.text)
  const failed = helpers.uploadBlockedSendNotice({ name: 'Brief.docx', status: 'error' })
  assert.equal(failed.kind, 'upload_failed')
  assert.ok(failed.text.includes("because Brief.docx couldn't be uploaded"), failed.text)
  assert.equal(helpers.templateBlockedSendNotice('Template needs its blueprint first').text, "Your message wasn't sent. Template needs its blueprint first. Your text is still in the box.")
  assert.equal(helpers.templateBlockedSendNotice('Already ends well!').text, "Your message wasn't sent. Already ends well! Your text is still in the box.")
})
check('ids count up so a repeat re-announces', () => {
  const content = helpers.templateBlockedSendNotice('x')
  const first = helpers.nextBlockedSendNotice(null, content)
  const second = helpers.nextBlockedSendNotice(first, content)
  assert.deepEqual([first.id, second.id], [1, 2])
})

// ---------------------------------------------------------------- notice leaf (real component)
function loadNotice() {
  const module = { exports: {} }
  const node = (type, props, key) => ({ type, props: props || {}, key })
  vm.runInNewContext(transpile(read('components/builder/studio-blocked-send-notice.tsx')), {
    module, exports: module.exports,
    require: id => { assert.equal(id, 'react/jsx-runtime', `leaf may only import the JSX runtime, saw ${id}`); return { jsx: node, jsxs: node, Fragment: 'Fragment' } },
  })
  return module.exports.StudioBlockedSendNotice
}
const Notice = loadNotice()
const all = (tree, predicate, found = []) => {
  if (!tree || typeof tree !== 'object') return found
  if (Array.isArray(tree)) { tree.forEach(child => all(child, predicate, found)); return found }
  if (predicate(tree)) found.push(tree)
  all(tree.props.children, predicate, found)
  return found
}
const textOf = tree => tree == null || typeof tree === 'boolean' ? '' : typeof tree !== 'object' ? String(tree) : Array.isArray(tree) ? tree.map(textOf).join('') : textOf(tree.props.children)
check('leaf renders nothing without a notice', () => {
  assert.equal(Notice({}), null)
  assert.equal(Notice({ notice: null }), null)
})
check('leaf: one alert with the exact text, dismiss only when handed a handler', () => {
  const notice = helpers.nextBlockedSendNotice(null, helpers.quotaBlockedSendNotice({ which: 'daily', resetLabel: 'soon', caps: { monthlyCents: 0 } }))
  const withoutDismiss = Notice({ notice })
  assert.equal(withoutDismiss.props.role, 'alert')
  assert.equal(withoutDismiss.props['aria-atomic'], 'true')
  assert.equal(String(withoutDismiss.key), String(notice.id), 'a repeat is a new element so it is announced again')
  assert.equal(withoutDismiss.props['data-studio-blocked-send-notice'], 'no_allowance')
  assert.equal(textOf(all(withoutDismiss, n => n.props['data-studio-blocked-send-part'] === 'text')[0]), notice.text)
  assert.equal(all(withoutDismiss, n => n.type === 'button').length, 0)
  let dismissed = 0
  const withDismiss = Notice({ notice, onDismiss: () => { dismissed++ } })
  const [button] = all(withDismiss, n => n.type === 'button')
  assert.equal(button.props.type, 'button', 'never a submit button')
  button.props.onClick()
  assert.equal(dismissed, 1)
  assert.equal(withDismiss.props.style.overflowWrap, 'anywhere')
  assert.ok(withDismiss.props.style.background.includes('var(--ss-panel'), 'inherits the Studio palette in light and dark')
  assert.equal(all(withDismiss, n => ['a', 'input', 'form', 'img', 'iframe', 'script'].includes(n.type)).length, 0)
})

// ---------------------------------------------------------------- the real gate and handler
const pageText = read('app/builder/page.tsx')
const basePage = parse('base-page.tsx', execFileSync('git', ['show', `${BASE}:app/builder/page.tsx`], { encoding: 'utf8', cwd: new URL('..', import.meta.url).pathname, maxBuffer: 64 * 1024 * 1024 }))
const page = parse('page.tsx', pageText)
assert.equal(page.parseDiagnostics.length, 0, 'Builder syntax')
const gateSource = root => print(declaration(root, 'preflightDirectorTurn').arguments[0], root)
const handlerSource = root => print(declaration(root, 'handleSendMessage').arguments[0], root)

check('unblocked typed send path is textually unchanged (handleSendMessage)', () => {
  assert.equal(handlerSource(page), handlerSource(basePage))
  assert.equal(sha(handlerSource(page)), sha(handlerSource(basePage)))
})

const resetIso = { daily: '2026-10-08T04:00:00Z', weekly: '2026-10-12T04:00:00Z' }
const quotaStatus = (flags, wallet = 0, monthlyCents = 0) => ({ tier: monthlyCents ? 'pro' : 'free', caps: { monthlyCents }, flags: { dailyNear: false, weeklyNear: false, ...flags }, walletBalanceCents: wallet, resetAt: resetIso })

function gateHarness(root, { flag, lazy = false, call = [], ...overrides }) {
  const events = []
  let noticeState = null
  const context = {
    user: { id: 'offline-owner' }, session: { isLoadingSession: false }, awaitingDirectorReply: false,
    isExecutingSendRef: { current: false }, questionSubmissionPendingRef: { current: false },
    activeTemplate: null, isGeneratingFinal: false, uploadedFiles: [], quota: { status: null },
    isTemplateGenerationReady: template => template.ready,
    templateGenerationUnavailableReason: () => 'Template needs its blueprint first',
    setTopUpReason: text => events.push(['topup-reason', text]),
    setTopUpOpen: value => events.push(['topup-open', value]),
    toast: value => events.push(['toast', value]),
    console: { warn: (...args) => events.push(['warning', ...args]) },
    STUDIO_BLOCKED_SEND_FEEDBACK_ENABLED: flag, STUDIO_QUOTA_FAIL_CLOSED_ENABLED: false,
    setBlockedSendNotice: flag
      ? updater => { noticeState = typeof updater === 'function' ? updater(noticeState) : updater; events.push(['notice', noticeState && { id: noticeState.id, kind: noticeState.kind, title: noticeState.title, text: noticeState.text }]) }
      : () => assert.fail('flag off must never touch the notice'),
    nextBlockedSendNotice: helpers.nextBlockedSendNotice, quotaBlockedSendNotice: helpers.quotaBlockedSendNotice,
    templateBlockedSendNotice: helpers.templateBlockedSendNotice, uploadBlockedSendNotice: helpers.uploadBlockedSendNotice,
    ...overrides,
  }
  vm.runInNewContext(transpile(`globalThis.gate = ${gateSource(root)};`), context)
  const result = lazy ? undefined : context.gate(...call)
  return { result, events, context, get notice() { return noticeState } }
}
const blockedScenarios = {
  'free tier, daily cap reached, $0 reserve': { quota: { status: quotaStatus({ dailyAt: true, weeklyAt: true }, 0, 0) } },
  'pro, daily cap reached, $0 reserve': { quota: { status: quotaStatus({ dailyAt: true, weeklyAt: false }, 0, 5000) } },
  'pro, weekly cap reached, $0 reserve': { quota: { status: quotaStatus({ dailyAt: false, weeklyAt: true }, 0, 5000) } },
  'raw upload still uploading': { uploadedFiles: [{ name: 'Pending.docx', status: 'uploading' }] },
  'raw upload failed': { uploadedFiles: [{ name: 'Failed.docx', status: 'error' }] },
  'template generation locked': { activeTemplate: { id: 't', ready: false } },
}
const noticeExpected = {
  'free tier, daily cap reached, $0 reserve': 'no_allowance', 'pro, daily cap reached, $0 reserve': 'quota', 'pro, weekly cap reached, $0 reserve': 'quota',
  'raw upload still uploading': 'upload_pending', 'raw upload failed': 'upload_failed', 'template generation locked': 'template_locked',
}
const silentScenarios = {
  'unauthenticated': { user: null }, 'session loading': { session: { isLoadingSession: true } }, 'awaiting reply': { awaitingDirectorReply: true },
  'typed send in flight': { isExecutingSendRef: { current: true } }, 'question send in flight': { questionSubmissionPendingRef: { current: true } },
  'template reuse running': { activeTemplate: { ready: true }, isGeneratingFinal: true },
}
const passScenarios = {
  'no quota data yet': {},
  'plan cap reached but reserve covers it': { quota: { status: quotaStatus({ dailyAt: true, weeklyAt: true }, 1, 5000) } },
  'within plan': { quota: { status: quotaStatus({ dailyAt: false, weeklyAt: false }, 0, 5000) } },
  'upload stored': { uploadedFiles: [{ name: 'Stored.docx', status: 'stored' }] },
  'upload processing': { uploadedFiles: [{ name: 'Busy.docx', status: 'processing' }] },
}
const hashes = []
for (const [name, overrides] of Object.entries({ ...blockedScenarios, ...silentScenarios, ...passScenarios })) {
  const blocked = name in blockedScenarios, silent = name in silentScenarios
  const base = gateHarness(basePage, { flag: false, ...overrides })
  const off = gateHarness(page, { flag: false, ...overrides })
  const on = gateHarness(page, { flag: true, ...overrides })
  check(`flag off is byte-identical to the base gate: ${name}`, () => {
    assert.equal(off.result, base.result)
    assert.equal(off.result, !(blocked || silent))
    assert.equal(JSON.stringify(off.events), JSON.stringify(base.events))
    assert.equal(sha(JSON.stringify([off.result, off.events])), sha(JSON.stringify([base.result, base.events])))
    hashes.push([name, sha(JSON.stringify([off.result, off.events])).slice(0, 12)])
  })
  check(`flag on keeps every existing effect and adds only the notice: ${name}`, () => {
    assert.equal(on.result, base.result, 'same gate decision')
    const withoutNotice = on.events.filter(event => event[0] !== 'notice')
    assert.equal(JSON.stringify(withoutNotice), JSON.stringify(base.events), 'toast, top-up and warnings unchanged')
    const notices = on.events.filter(event => event[0] === 'notice')
    if (blocked) {
      assert.equal(notices.length, 1, 'exactly one notice per refused send')
      assert.equal(notices[0][1].kind, noticeExpected[name])
      assert.ok(notices[0][1].text.includes("wasn't sent") && notices[0][1].text.includes('Your text is still in the box.'))
    } else if (silent) {
      assert.equal(notices.length, 0, 'busy/duplicate refusals stay quiet, as before')
    } else {
      assert.deepEqual(notices, [['notice', null]], 'a send that passes clears any old notice')
    }
  })
}
check('quota notice names the right window and reset', () => {
  const daily = gateHarness(page, { flag: true, ...blockedScenarios['pro, daily cap reached, $0 reserve'] })
  const weekly = gateHarness(page, { flag: true, ...blockedScenarios['pro, weekly cap reached, $0 reserve'] })
  assert.ok(daily.notice.text.includes('Your daily budget resets '))
  assert.ok(weekly.notice.text.includes('Your weekly budget resets '))
  assert.ok(daily.events.find(event => event[0] === 'toast')[1].description.includes(daily.notice.text.split('resets ')[1].split(';')[0]), 'notice and toast agree on the reset time')
})
check('answers path (question card) gets its own wording; typed default unchanged', () => {
  const answers = gateHarness(page, { flag: true, call: ['answers'], ...blockedScenarios['pro, daily cap reached, $0 reserve'] })
  assert.equal(answers.notice.title, 'Answers not sent')
  assert.ok(answers.notice.text.includes('still in the question card'))
  const typed = gateHarness(page, { flag: true, ...blockedScenarios['pro, daily cap reached, $0 reserve'] })
  assert.equal(typed.notice.title, 'Message not sent')
  const offAnswers = gateHarness(page, { flag: false, call: ['answers'], ...blockedScenarios['pro, daily cap reached, $0 reserve'] })
  const baseAnswers = gateHarness(basePage, { flag: false, call: [], ...blockedScenarios['pro, daily cap reached, $0 reserve'] })
  assert.equal(JSON.stringify(offAnswers.events), JSON.stringify(baseAnswers.events), 'flag off ignores the source argument')
})
check('a repeated refusal is a new notice (re-announced); a pass then clears it', () => {
  const gate = gateHarness(page, { flag: true, ...blockedScenarios['pro, daily cap reached, $0 reserve'] })
  const second = gate.context.gate()
  assert.equal(second, false)
  assert.deepEqual(gate.events.filter(event => event[0] === 'notice').map(event => event[1].id), [1, 2])
})

// End to end through BOTH real functions: the typed handler calls the real gate.
async function sendHarness({ flag, ...overrides }) {
  const events = []
  const draft = 'Build a 10-slide investor deck for a climate-fintech seed round.'
  const gate = gateHarness(page, { flag, lazy: true, ...overrides })
  const context = {
    ...gate.context,
    preflightDirectorTurn: gate.context.gate,
    inputMessage: draft, pendingActionInput: null, pendingActionIntentRef: { current: { action: null, revision: 0 } },
    isAttachedUpload: () => false, snapshotAttachedUploads: () => [],
    questionSubmissionScopeRef: { current: { active: true, generation: 0, sessionId: 'offline-session', userId: 'offline-owner' } },
    currentSessionId: 'offline-session', wsSessionId: 'offline-session',
    setInputMessage: value => { events.push(['draft-write', typeof value === 'function' ? value(draft) : value]) },
    sendMessage: () => events.push(['transport']), sendMessageWhenConnected: async () => { events.push(['transport']); return true },
    createSession: async () => { events.push(['create-session']); return null },
    persistence: { queueMessage: () => events.push(['persist']) },
    session: { markStudioUserIntent: () => events.push(['intent']), setUserMessages: () => events.push(['echo']) },
    fetch: async () => { events.push(['network']); return { ok: false, status: 403 } },
  }
  vm.runInNewContext(transpile(`globalThis.send = ${handlerSource(page)};`), context)
  await context.send()
  return { events, gate, draft }
}
for (const [name, overrides] of Object.entries(blockedScenarios)) {
  for (const flag of [false, true]) {
    const run = await sendHarness({ flag, ...overrides })
    check(`blocked send keeps the draft; nothing leaves; notice only with flag on (${flag ? 'on' : 'off'}): ${name}`, () => {
      assert.deepEqual(run.events, [], 'no draft write, no transport, no persistence, no echo, no network, no user intent')
      const notices = run.gate.events.filter(event => event[0] === 'notice')
      assert.equal(notices.length, flag ? 1 : 0)
      assert.equal(run.gate.events.filter(event => event[0] === 'toast').length, 1, 'the toast is still posted')
    })
  }
}

// ---------------------------------------------------------------- wiring: client-only, flag-gated
check('notice state is never reachable from a send, a persistence call or an echo', () => {
  const uses = findAll(page, n => ts.isIdentifier(n) && ['setBlockedSendNotice', 'blockedSendNotice', 'blockedSendNoticeRef'].includes(n.text))
  assert.ok(uses.length >= 10, `found ${uses.length} notice references`)
  const handler = declaration(page, 'handleSendMessage')
  const forbiddenCallee = /(^|\.)(sendMessage|sendMessageWhenConnected|queueMessage|setUserMessages|updateMetadata|fetch|createSession)$/
  for (const use of uses) {
    for (let up = use.parent; up; up = up.parent) {
      assert.notEqual(up, handler, 'the typed handler is untouched')
      if (ts.isCallExpression(up)) assert.ok(!forbiddenCallee.test(up.expression.getText(page)), `notice must not flow into ${up.expression.getText(page)}`)
    }
  }
})
check('the notice renders only under the flag, after the transcript, and never inside MessageList props', () => {
  const jsx = findAll(page, n => ts.isJsxSelfClosingElement(n) && n.tagName.getText(page) === 'StudioBlockedSendNotice')
  assert.equal(jsx.length, 1)
  let guarded = false
  for (let up = jsx[0].parent; up; up = up.parent) {
    if (ts.isBinaryExpression(up) && up.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && up.getText(page).startsWith('STUDIO_BLOCKED_SEND_FEEDBACK_ENABLED &&')) guarded = true
    if (ts.isJsxSelfClosingElement(up) && up.tagName.getText(page) === 'MessageList') assert.fail('the notice is a sibling of MessageList, not a prop')
  }
  assert.ok(guarded, 'rendered only behind STUDIO_BLOCKED_SEND_FEEDBACK_ENABLED')
  assert.ok(jsx[0].attributes.getText(page).includes('onDismiss'))
})
check('the page imports only the flagged helper and the leaf', () => {
  assert.match(pageText, /from '@\/lib\/studio-blocked-send'/)
  assert.match(pageText, /from '@\/components\/builder\/studio-blocked-send-notice'/)
  assert.ok(!/process\.env\.NEXT_PUBLIC_STUDIO_BLOCKED_SEND/.test(pageText), 'the env read lives only in the helper module')
})

console.log(`Blocked-send feedback: ${cases} offline cases passed. Flag-off gate outputs identical to ${BASE} (sha256/12 per scenario): ${hashes.map(([n, h]) => `${n}=${h}`).join('; ')}`)
