// RUN-1 J1 R1/R2, re-implemented on Studio (flag NEXT_PUBLIC_STUDIO_HISTORY_ACTION_STATUS_ENABLED, default off).
// Renders the REAL MessageList / SlideThumbnailStrip (server-side) from the REAL TypeScript sources, both flag states, and
// compares the flag-off render with the pinned base commit byte for byte. Offline: no services, no timers, no network.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const nodeRequire = createRequire(path.join(repoRoot, 'package.json'))
const React = nodeRequire('react')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')
const BASE = '922ce1433deb3d320af2422e515744de493335e6' // studio-v4-dev-preparation-code before this change
const FLAG = 'NEXT_PUBLIC_STUDIO_HISTORY_ACTION_STATUS_ENABLED'
let failures = 0
function check(name, fn) {
  try { fn(); console.log(`ok   ${name}`) } catch (error) { failures++; console.log(`FAIL ${name}\n     ${String(error?.message ?? error).split('\n').join('\n     ')}`) }
}

// ---------------------------------------------------------------- loader: real TS sources, from disk or from a git ref
function makeLoader({ ref = null, flag = undefined } = {}) {
  const modules = new Map()
  const previous = process.env[FLAG]
  if (flag === undefined) delete process.env[FLAG]; else process.env[FLAG] = flag
  const read = rel => ref ? execFileSync('git', ['show', `${ref}:${rel}`], { encoding: 'utf8', cwd: repoRoot }) : fs.readFileSync(path.join(repoRoot, rel), 'utf8')
  const exists = rel => ref
    ? (() => { try { execFileSync('git', ['cat-file', '-e', `${ref}:${rel}`], { cwd: repoRoot, stdio: 'ignore' }); return true } catch { return false } })()
    : fs.existsSync(path.join(repoRoot, rel)) && fs.statSync(path.join(repoRoot, rel)).isFile()
  const resolve = (spec, fromRel) => {
    const base = spec.startsWith('@/') ? spec.slice(2) : path.posix.join(path.posix.dirname(fromRel), spec)
    for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) if (exists(base + ext) && /\.(tsx?)$/.test(base + ext)) return base + ext
    throw Error(`unresolved ${spec} from ${fromRel}`)
  }
  function load(rel) {
    if (modules.has(rel)) return modules.get(rel).exports
    const module = { exports: {} }; modules.set(rel, module)
    const out = ts.transpileModule(read(rel), { fileName: rel, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    const req = spec => spec.endsWith('.css') ? {} : spec.startsWith('@/') || spec.startsWith('.') ? load(resolve(spec, rel)) : nodeRequire(spec)
    vm.runInThisContext(`(function(exports, require, module, __filename){${out}\n})`, { filename: rel })(module.exports, req, module, rel)
    return module.exports
  }
  // Modules read the flag when they are first evaluated, so evaluate the ones under test now.
  const loaded = { load }
  for (const rel of ['lib/director-history-presentation.ts', 'lib/studio-director-message-policy.ts', 'components/builder/message-list.tsx', 'components/slide-thumbnail-strip.tsx'])
    if (exists(rel)) load(rel)
  if (exists('lib/studio-slide-title-label.ts')) load('lib/studio-slide-title-label.ts')
  if (previous === undefined) delete process.env[FLAG]; else process.env[FLAG] = previous
  return loaded
}
process.env.NEXT_PUBLIC_STUDIO_V4_SHELL = 'true'
const off = makeLoader({ flag: undefined })
const on = makeLoader({ flag: 'true' })
const exactTrueOnly = ['false', '1', 'TRUE', ' true', '']
const baseAvailable = (() => { try { execFileSync('git', ['cat-file', '-e', `${BASE}^{commit}`], { cwd: repoRoot, stdio: 'ignore' }); return true } catch { return false } })()
const base = baseAvailable ? makeLoader({ ref: BASE, flag: undefined }) : null

// ---------------------------------------------------------------- fixtures: what a reload restores
const SID = 'sess-1'
const T0 = Date.UTC(2026, 9, 8, 12, 0, 0)
const iso = seconds => new Date(T0 + seconds * 1000).toISOString()
const user = (id, t, text) => ({ id, messageType: 'chat_message', timestamp: iso(t), userText: text, payload: { text } })
const bot = (id, t, text) => ({ id, messageType: 'chat_message', timestamp: iso(t), payload: { text, sub_title: null, list_items: null } })
const QSET = { intro: 'A few quick questions:', questions: [{ id: 'q1', text: 'Who is the audience?', allow_free_text: true, suggestions: [{ label: 'Leadership', recommended: true }, { label: 'Engineers' }] }] }
const ask = (id, t) => ({ id, messageType: 'action_request', timestamp: iso(t), payload: { prompt_text: 'Quick questions', actions: [{ label: 'Skip questions', value: 'skip', primary: false, requires_input: false }], question_set: QSET } })
const PLAN_ID = `msg_plan_confirm_${SID}`
const plan = (t, id = PLAN_ID) => ({ id, messageType: 'action_request', timestamp: iso(t), payload: { prompt_text: 'Does this plan work?', actions: [
  { label: "Yes, let's build it!", value: 'accept_plan', primary: true, requires_input: false },
  { label: 'No, change something', value: 'reject_plan', primary: false, requires_input: true }] } })
const outline = (id, t) => ({ id, messageType: 'action_request', timestamp: iso(t), payload: { prompt_text: 'Review your outline', actions: [
  { label: 'Generate final deck', value: 'accept_strawman', primary: true, requires_input: false }] } })
const retry = (id, t) => ({ id, messageType: 'action_request', timestamp: iso(t), payload: { prompt_text: 'Current follow-up choices', actions: [
  { label: 'Retry current recovery', value: 'retry_current', primary: false, requires_input: false }] } })
const outlineFrame = (id, t) => ({ id, messageType: 'slide_update', timestamp: iso(t), payload: { operation: 'full_update', metadata: { main_title: 'Deck', presentation_duration: 5, overall_theme: 'Clean', preview_presentation_id: 'deck-1', preview_url: 'https://layout.test/p/deck-1' },
  slides: [{ slide_id: 's1', slide_number: 1, title: 'One', slide_type: 'content', narrative: 'n', key_points: [] }] } })
const finalFrame = (id, t) => ({ id, messageType: 'presentation_url', timestamp: iso(t), payload: { url: 'https://layout.test/p/deck-1', presentation_id: 'deck-1', slide_count: 1 } })
const blankFrame = (id, t) => ({ id, messageType: 'slide_update', timestamp: iso(t), payload: { is_blank: true, operation: 'full_update', metadata: { main_title: 'Blank', presentation_duration: 0, overall_theme: '' }, slides: [] } })

// Mirror of the restore block in hooks/use-builder-session.ts: user rows -> userMessages, the rest -> Director frames.
function restore(rows) {
  const userMessages = [], messages = []
  for (const row of rows) {
    if (row.userText) userMessages.push({ id: row.id, text: row.userText, timestamp: new Date(row.timestamp).getTime(), attachments: [] })
    else messages.push({ message_id: row.id, session_id: SID, timestamp: row.timestamp, type: row.messageType, payload: row.payload,
      clientTimestamp: new Date(row.timestamp?.endsWith('Z') ? row.timestamp : row.timestamp + 'Z').getTime() })
  }
  return { userMessages, messages }
}
const frozenSet = () => new Proxy(new Set(), { get(target, key) {
  if (key === 'add' || key === 'delete' || key === 'clear') return () => { throw Error(`answeredActionsRef.${String(key)} during render`) }
  const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value } })
function props({ userMessages, messages }, answered = frozenSet()) {
  return { sessionId: SID, userMessages, messages,
    userMessageIdsRef: { current: new Set(userMessages.map(item => item.id)) },
    userMessageContentMapRef: { current: new Map(userMessages.map(item => [item.text.trim().toLowerCase(), item.id])) },
    hasSeenWelcomeRef: { current: true }, answeredActionsRef: { current: answered },
    messagesEndRef: { current: null }, onActionClick() {}, onSubmitAnswers() {} }
}
const render = (world, state, answered) => renderToStaticMarkup(React.createElement(world.load('components/builder/message-list.tsx').MessageList, props(state, answered)))
const sha = html => crypto.createHash('sha256').update(html).digest('hex').slice(0, 12)
// 'active' = the live card, 'answered' / 'earlier' = the disabled history card, 'absent' = not in the transcript
function cardState(html, id) {
  const tag = html.match(new RegExp(`<div[^>]*data-director-action-id="${id}"[^>]*>`))?.[0]
  if (!tag) return 'absent'
  const history = tag.match(/data-studio-director-history-action="(answered|earlier)"/)
  if (history) return history[1]
  return /data-studio-director-ask="(questions|approval|choice)"/.test(tag) ? 'active' : `unknown:${tag}`
}
const states = (world, rows, ids, answered) => { const html = render(world, restore(rows), answered); return Object.fromEntries(ids.map(id => [id, cardState(html, id)])) }

// ---------------------------------------------------------------- scenarios (each is a reload: the answered ref starts empty)
const SCENARIOS = {
  // The J1 repro: a finished session. Every gate was answered; the replies are in the transcript.
  A_completed_session: { ids: ['q1', PLAN_ID, 'out1'], rows: [
    user('u1', 0, 'Build a deck on AI forecasting'), bot('b1', 1, 'A few questions first'), ask('q1', 2),
    user('u2', 10, 'Answers: Leadership'), bot('b2', 11, 'Here is the plan'), plan(12),
    user('u3', 20, "Yes, let's build it!"), outlineFrame('o1', 21), outline('out1', 22),
    user('u4', 30, 'Generate final deck'), finalFrame('f1', 40), bot('b4', 41, 'Your deck is ready')],
    flagOn: { q1: 'answered', [PLAN_ID]: 'earlier', out1: 'earlier' }, flagOff: { q1: 'active', [PLAN_ID]: 'earlier', out1: 'earlier' } },
  // The same session with the plan answered but no frames after it (a failed build): the reply is the only evidence.
  A2_answered_without_successor_frames: { ids: ['q1', PLAN_ID], rows: [
    user('u1', 0, 'Build a deck'), ask('q1', 2), user('u2', 10, 'Answers: Leadership'), plan(12), user('u3', 20, "Yes, let's build it!")],
    flagOn: { q1: 'answered', [PLAN_ID]: 'answered' }, flagOff: { q1: 'active', [PLAN_ID]: 'active' } },
  // The blank deck every Builder V2 session starts with must not retire anything.
  B_pending_questions_with_blank_deck: { ids: ['q1'], rows: [
    user('u1', 0, 'Build a deck on AI forecasting'), blankFrame('blank', 0.5), bot('b1', 1, 'A few questions first'), ask('q1', 2)],
    flagOn: { q1: 'active' }, flagOff: { q1: 'active' } },
  C_pending_questions_no_deck: { ids: ['q1'], rows: [user('u1', 0, 'Build a deck'), ask('q1', 2)], flagOn: { q1: 'active' }, flagOff: { q1: 'active' } },
  D_pending_plan_gate_with_blank_deck: { ids: ['q1', PLAN_ID], rows: [
    user('u1', 0, 'Build a deck'), blankFrame('blank', 0.5), ask('q1', 2), user('u2', 5, 'Answers: Leadership'), bot('b1', 6, 'Here is the plan'), plan(7)],
    flagOn: { q1: 'answered', [PLAN_ID]: 'active' }, flagOff: { q1: 'active', [PLAN_ID]: 'active' } },
  E_pending_generate_final_deck: { ids: [PLAN_ID, 'out1'], rows: [
    user('u1', 0, 'Build a deck'), plan(7), user('u2', 8, "Yes, let's build it!"), outlineFrame('o1', 15), bot('b2', 20, 'Outline ready'), outline('out1', 21)],
    flagOn: { [PLAN_ID]: 'earlier', out1: 'active' }, flagOff: { [PLAN_ID]: 'earlier', out1: 'active' } },
  // Free text sent while a native gate is pending (a side question) is not an answer to it.
  G_side_question_while_gate_pending: { ids: [PLAN_ID], rows: [
    user('u1', 0, 'Build a deck'), plan(7), user('u2', 8, 'can it be 10 slides?'), bot('b2', 9, 'Yes, I can do 10 slides.')],
    flagOn: { [PLAN_ID]: 'active' }, flagOff: { [PLAN_ID]: 'active' } },
  // A card that is not the tail but has no reply after it stays live: position and later Director frames are not evidence.
  I_not_the_tail_no_reply: { ids: ['q1', 'r1'], rows: [
    user('u1', 0, 'Build a deck'), ask('q1', 2), retry('r1', 3), bot('b1', 4, 'one'), bot('b2', 5, 'two'), bot('b3', 6, 'three'), finalFrame('f1', 7)],
    flagOn: { q1: 'active', r1: 'active' }, flagOff: { q1: 'active', r1: 'active' } },
  K_replies_before_or_at_the_card_do_not_answer: { ids: ['q1', 'q2'], rows: [
    user('u1', 0, 'Build a deck'), user('u0', 2, 'Answers: early'), ask('q1', 2), user('u2', 1, 'older'), ask('q2', 3)],
    flagOn: { q1: 'active', q2: 'active' }, flagOff: { q1: 'active', q2: 'active' } },
}

for (const [name, scenario] of Object.entries(SCENARIOS)) {
  const ids = scenario.ids
  check(`${name}: flag on`, () => assert.deepEqual(states(on, scenario.rows, ids), scenario.flagOn))
  check(`${name}: flag off keeps today's cards`, () => assert.deepEqual(states(off, scenario.rows, ids), scenario.flagOff))
}

// A reply the Director replayed into the frame list (role user) is a persisted turn too.
check('a replayed user frame after a question answers it (flag on only)', () => {
  const state = restore([user('u1', 0, 'Build a deck'), ask('q1', 2)])
  state.messages.push({ message_id: 'u-replayed', session_id: SID, timestamp: iso(10), type: 'chat_message', role: 'user', payload: { text: 'Answers: Engineers' }, clientTimestamp: T0 + 10000 })
  assert.equal(cardState(render(on, state), 'q1'), 'answered')
  assert.equal(cardState(render(off, state), 'q1'), 'active')
})
check('a card, or a user turn, with no usable time never retires anything', () => {
  const state = restore([user('u1', 0, 'Build a deck'), ask('q1', 2), user('u2', 10, 'Answers: Leadership')])
  state.messages[0].timestamp = 'not a time'; delete state.messages[0].clientTimestamp
  assert.equal(cardState(render(on, state), 'q1'), 'active')
  const turns = restore([user('u1', 0, 'Build a deck'), ask('q1', 2), user('u2', 10, 'Answers: Leadership')])
  for (const timestamp of [undefined, NaN, Infinity, '1700000000000']) {
    turns.userMessages[1] = { ...turns.userMessages[1], timestamp }
    assert.equal(cardState(render(on, turns), 'q1'), 'active', `a user turn with timestamp ${String(timestamp)} must not answer`)
  }
})

// F: the Director replays a PENDING gate with the same id after a reload (use-deckster-websocket-v2.ts upserts it in place).
check('F: a replayed pending gate is live again, whatever the transcript says about older turns', () => {
  const state = restore([user('u1', 0, 'Build a deck'), ask('q1', 2), user('u2', 5, 'Answers: Leadership'), bot('b1', 6, 'Here is the plan'), plan(7), user('u3', 8, 'can it be 10 slides?'), bot('b2', 9, 'Yes.')])
  // The replay keeps the persisted id and arrives later: it is stamped on arrival, so it sorts after every earlier turn.
  state.messages = state.messages.map(message => message.message_id === PLAN_ID ? { ...message, clientTimestamp: T0 + 3600 * 1000 } : message)
  assert.equal(cardState(render(on, state), PLAN_ID), 'active')
  // A replayed question card is live again for the same reason (the answer that preceded it is older than the replay).
  state.messages = state.messages.map(message => message.message_id === 'q1' ? { ...message, clientTimestamp: T0 + 3600 * 1000 } : message)
  assert.equal(cardState(render(on, state), 'q1'), 'active')
  assert.equal(cardState(render(on, state), PLAN_ID), 'active')
})

// H: nothing is written to the answered ref while rendering, so a card hidden by a later message comes back when it goes away.
check('H: render never writes answeredActionsRef; a transient later message does not retire a card for good', () => {
  const state = restore([user('u1', 0, 'Build a deck'), plan(7)])
  const answered = frozenSet() // add/delete/clear throw
  assert.equal(cardState(render(on, state, answered), PLAN_ID), 'active')
  const later = { ...state, messages: [...state.messages, { message_id: 'late', session_id: SID, timestamp: iso(9), type: 'chat_message', payload: { text: '(transient) working on it' }, clientTimestamp: T0 + 9000 }] }
  assert.equal(cardState(render(on, later, answered), PLAN_ID), 'active')
  assert.equal(cardState(render(on, state, answered), PLAN_ID), 'active')
  assert.equal(answered.size, 0)
  const policy = on.load('lib/studio-director-message-policy.ts').getDirectorActionPolicy
  const restored = restore([user('u1', 0, 'Build a deck'), ask('q1', 2), user('u2', 5, 'Answers: x')])
  policy(restored.messages, answered, SID, restored.userMessages)
  assert.equal(answered.size, 0)
})

// The same policy feeds the list, the Studio intro gate (page.tsx) and the voice call: one answer for all three.
check('policy: the pending-ask view (voice) and the list agree after a reload', () => {
  const { getDirectorActionPolicy } = on.load('lib/studio-director-message-policy.ts')
  const { latestPendingAsk } = on.load('lib/studio-voice-interactive.ts')
  const answeredRun = restore(SCENARIOS.A_completed_session.rows)
  const answeredPolicy = getDirectorActionPolicy(answeredRun.messages, new Set(), SID, answeredRun.userMessages)
  assert.deepEqual([...answeredPolicy.historicalActions.keys()].sort(), ['out1', 'q1', PLAN_ID].sort())
  assert.equal(latestPendingAsk(answeredRun.messages, { displayedSessionId: SID, historicalStatuses: answeredPolicy.historicalActions, activeActionIds: answeredPolicy.activeActionIds }), null)
  const pending = restore(SCENARIOS.D_pending_plan_gate_with_blank_deck.rows)
  const pendingPolicy = getDirectorActionPolicy(pending.messages, new Set(), SID, pending.userMessages)
  assert.equal(latestPendingAsk(pending.messages, { displayedSessionId: SID, historicalStatuses: pendingPolicy.historicalActions, activeActionIds: pendingPolicy.activeActionIds })?.id, PLAN_ID)
  // Without the user turns (flag off, or an old caller) the answer is today's.
  const without = getDirectorActionPolicy(answeredRun.messages, new Set(), SID)
  assert.equal(without.historicalActions.has('q1'), false)
})

check('the flag is read as the exact string "true" only', () => {
  const rows = SCENARIOS.A_completed_session.rows
  for (const value of exactTrueOnly) {
    const world = makeLoader({ flag: value })
    assert.equal(cardState(render(world, restore(rows)), 'q1'), 'active', `value ${JSON.stringify(value)} must stay off`)
  }
  assert.equal(on.load('lib/director-history-presentation.ts').STUDIO_HISTORY_ACTION_STATUS_ENABLED, true)
  assert.equal(off.load('lib/director-history-presentation.ts').STUDIO_HISTORY_ACTION_STATUS_ENABLED, false)
})

// ---------------------------------------------------------------- flag off is today, byte for byte (against the pinned base commit)
const BYTE_SCENARIOS = Object.entries(SCENARIOS).map(([name, scenario]) => [name, scenario.rows])
BYTE_SCENARIOS.push(['empty', []], ['quick-question-only', [user('u1', 0, 'Build a deck'), ask('q1', 2)]])
if (!base) console.log(`skip flag-off byte identity: base commit ${BASE.slice(0, 8)} is not in this clone`)
else for (const shell of ['true', 'false']) {
  check(`flag off == base ${BASE.slice(0, 8)} byte for byte: MessageList, Studio shell ${shell}, ${BYTE_SCENARIOS.length} transcripts`, () => {
    process.env.NEXT_PUBLIC_STUDIO_V4_SHELL = shell
    try {
      for (const [name, rows] of BYTE_SCENARIOS) {
        const state = restore(rows)
        assert.equal(sha(render(off, state)), sha(render(base, state)), `${name} differs from the base render`)
        // A frozen answered-ref makes any write during render fail, so the equality is not helped by a side effect.
      }
    } finally { process.env.NEXT_PUBLIC_STUDIO_V4_SHELL = 'true' }
  })
  check(`flag off == base: historicalActionStatuses on ${BYTE_SCENARIOS.length} transcripts, with and without user turns`, () => {
    const mine = off.load('lib/director-history-presentation.ts').historicalActionStatuses
    const theirs = base.load('lib/director-history-presentation.ts').historicalActionStatuses
    for (const [name, rows] of BYTE_SCENARIOS) {
      const state = restore(rows)
      const answered = new Set(['q-pre'])
      const left = JSON.stringify([...theirs(state.messages, answered)]), right = JSON.stringify([...mine(state.messages, answered, state.userMessages)])
      assert.equal(right, left, name)
      assert.equal(JSON.stringify([...mine(state.messages, answered)]), left, `${name} (no user turns)`)
    }
  })
}

// ---------------------------------------------------------------- R2: the rail label
const TITLES = ['closing_slide', 'title_slide', 'section_divider', 'Slide 2', '', undefined, 'Executive Summary', 'Content', 'Hero', 'Closing_Slide', '  closing_slide  ',
  'Q3 closing_slide review', 'Closing Slide', 'hero_slide', 'content', 'hero']
const stripLabels = (world, titles = TITLES) => {
  const html = renderToStaticMarkup(React.createElement(world.load('components/slide-thumbnail-strip.tsx').SlideThumbnailStrip, {
    slides: titles.map((title, index) => ({ slideNumber: index + 1, slideIndex: index, title })), currentSlide: 1, onSlideClick() {}, orientation: 'vertical', totalSlides: titles.length }))
  return { html, labels: [...html.matchAll(/aria-label="Go to slide (\d+): ([^"]*)"/g)].map(match => match[2]) }
}
check('R2: the rail shows "Closing Slide" / "Title Slide" / "Section Divider" for the raw identifiers (flag on)', () => {
  const { labels } = stripLabels(on)
  assert.equal(labels.length, TITLES.length, `labels found: ${JSON.stringify(labels)}`)
  const byTitle = Object.fromEntries(TITLES.map((title, index) => [JSON.stringify(title), labels[index]]))
  assert.equal(byTitle['"closing_slide"'], 'Closing Slide')
  assert.equal(byTitle['"title_slide"'], 'Title Slide')
  assert.equal(byTitle['"section_divider"'], 'Section Divider')
  assert.equal(byTitle['"Closing_Slide"'], 'Closing Slide')
  assert.equal(byTitle['"  closing_slide  "'], 'Closing Slide')
})
check('R2: titles the user chose are never rewritten ("Hero", "Content", prose that contains an identifier)', () => {
  const { labels } = stripLabels(on)
  const at = title => labels[TITLES.indexOf(title)]
  for (const title of ['Content', 'Hero', 'Executive Summary', 'Closing Slide', 'Q3 closing_slide review', 'hero_slide', 'content', 'hero']) assert.equal(at(title), title, title)
  assert.equal(at('Slide 2'), 'Slide 4') // today's numbering rule is untouched
  const { slideTitleLabel } = on.load('lib/studio-slide-title-label.ts')
  for (const title of ['Hero', 'Content', 'hero', 'content', 'Slide 3', 'My Deck', '']) assert.equal(slideTitleLabel(title), title)
  assert.equal(slideTitleLabel(undefined), undefined); assert.equal(slideTitleLabel(null), null); assert.equal(slideTitleLabel(7), 7)
})
check('R2: flag off, the rail markup is the base markup byte for byte; labels are the raw titles', () => {
  const mine = stripLabels(off)
  assert.equal(mine.labels[0], 'closing_slide'); assert.equal(mine.labels[1], 'title_slide'); assert.equal(mine.labels[2], 'section_divider')
  if (base) assert.equal(sha(mine.html), sha(stripLabels(base).html))
  else console.log('     (strip byte identity skipped: base commit not in this clone)')
})
check('R2: both viewer title-fallback sites use the label, and only they changed there', () => {
  const viewer = fs.readFileSync(path.join(repoRoot, 'components/presentation-viewer.tsx'), 'utf8')
  const sites = viewer.match(/title: [^\n]*slide\.slide_type[^\n]*/g) ?? []
  assert.equal(sites.length, 2, `expected exactly two slide.slide_type fallback sites, found ${sites.length}`)
  for (const site of sites) assert.match(site, /title: slideTitleLabel\(slide\.title \|\| slide\.slide_type \|\| `Slide \$\{index \+ 1\}`\),/)
  assert.match(viewer, /import \{ slideTitleLabel \} from '@\/lib\/studio-slide-title-label'/)
  const strip = fs.readFileSync(path.join(repoRoot, 'components/slide-thumbnail-strip.tsx'), 'utf8')
  assert.match(strip, /: slideTitleLabel\(slide\.title\)/)
})

// ---------------------------------------------------------------- wiring: every caller of the status passes the user turns
check('wiring: list, intro gate and voice call all pass the transcript\'s user turns; no caller writes the answered ref while rendering', () => {
  const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
  assert.match(read('components/builder/message-list.tsx'), /getDirectorActionPolicy\(messages, answeredActionsRef\.current, sessionId, userMessages\)/)
  assert.match(read('app/builder/page.tsx'), /historicalActionStatuses\(messages, session\.answeredActionsRef\.current, session\.userMessages\)/)
  const call = read('hooks/use-studio-director-call.ts')
  assert.equal((call.match(/getDirectorActionPolicy\([^)]*userMessages\)/gs) ?? []).length, 2)
  const lib = read('lib/director-history-presentation.ts')
  const body = lib.slice(lib.indexOf('export function historicalActionStatuses'))
  assert.doesNotMatch(body, /answeredIds\.(add|delete|clear)\(|answeredActionsRef/)
  assert.doesNotMatch(read('lib/studio-director-message-policy.ts'), /\.(add|delete|clear)\(answeredIds|answeredIds\.(add|delete|clear)/)
})

if (failures) { console.log(`${failures} check(s) failed`); process.exit(1) }
console.log('all Studio history action status checks passed')
