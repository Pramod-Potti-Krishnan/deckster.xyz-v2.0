// RUN-J1J3-FINAL D-A1 / D-A2 / NEW-E1 (flag NEXT_PUBLIC_STUDIO_ASK_CARD_IDENTITY_ENABLED, exact "true", default off).
//   D-A1: Director's plan gate has ONE id for the whole session (msg_plan_confirm_<session>). The answered mark was kept by that id, so a plan
//         re-asked after a correction arrived "Answered" and disabled. An answer now belongs to ONE ask (id + the frame's own timestamp).
//   NEW-E1 / D-A2: Director builds the outline gate with a fresh random id and re-sends it on every reconnect while the outline is unapproved,
//         so a stopped deck restored several live copies. Only the NEWEST approval gate stays live; none while a build runs, is paused or stopped,
//         or the session is over.
// Renders the REAL MessageList / QuestionCard (server-side) from the REAL TypeScript sources. No git, no network, no timers: the repo root is
// anchored on this package's own package.json. Mutation checks edit the sources in memory and require the suite to notice every one.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const nodeRequire = createRequire(path.join(repoRoot, 'package.json'))
const React = nodeRequire('react')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')
const ASK = 'NEXT_PUBLIC_STUDIO_ASK_CARD_IDENTITY_ENABLED'
const HISTORY = 'NEXT_PUBLIC_STUDIO_HISTORY_ACTION_STATUS_ENABLED'
process.env.NEXT_PUBLIC_STUDIO_V4_SHELL = 'true'

// ---------------------------------------------------------------- loader: real TS sources from disk, optionally edited in memory
const transpiled = new Map()
function transpile(rel, text) {
  const key = crypto.createHash('sha1').update(rel).update('\0').update(text).digest('hex')
  if (!transpiled.has(key)) transpiled.set(key, ts.transpileModule(text, { fileName: rel, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)
  return transpiled.get(key)
}
function makeWorld({ ask, history, mutate = [] } = {}) {
  const modules = new Map()
  const world = { captured: new Map(), clicks: [], mutate }
  // The two flags are read when a module is first evaluated; the Studio shell flag is read by MessageList on every render.
  const saved = { [ASK]: process.env[ASK], [HISTORY]: process.env[HISTORY] }
  const setEnv = (name, value) => { if (value === undefined) delete process.env[name]; else process.env[name] = value }
  setEnv(ASK, ask); setEnv(HISTORY, history)
  const read = rel => {
    let text = fs.readFileSync(path.join(repoRoot, rel), 'utf8')
    for (const mutant of mutate.filter(item => item.file === rel)) {
      assert.equal(text.split(mutant.from).length, 2, `mutant "${mutant.name}": expected exactly one occurrence in ${rel}`)
      text = text.replace(mutant.from, mutant.to)
    }
    return text
  }
  const exists = rel => fs.existsSync(path.join(repoRoot, rel)) && fs.statSync(path.join(repoRoot, rel)).isFile()
  const resolve = (spec, fromRel) => {
    const base = spec.startsWith('@/') ? spec.slice(2) : path.posix.join(path.posix.dirname(fromRel), spec)
    for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) if (exists(base + ext) && /\.(tsx?)$/.test(base + ext)) return base + ext
    throw Error(`unresolved ${spec} from ${fromRel}`)
  }
  function load(rel) {
    if (modules.has(rel)) return modules.get(rel).exports
    const module = { exports: {} }; modules.set(rel, module)
    const req = spec => spec.endsWith('.css') ? {} : spec.startsWith('@/') || spec.startsWith('.') ? load(resolve(spec, rel)) : nodeRequire(spec)
    vm.runInThisContext(`(function(exports, require, module, __filename){${transpile(rel, read(rel))}\n})`, { filename: rel })(module.exports, req, module, rel)
    return module.exports
  }
  // The real card, observed: every render records the props MessageList handed it, so a test can press its buttons.
  const card = load('components/builder/chat/question-card.tsx'), RealCard = card.QuestionCard
  card.QuestionCard = function ObservedCard(props) { world.captured.set(props.messageId, props); return React.createElement(RealCard, props) }
  Object.assign(world, {
    read, load,
    MessageList: load('components/builder/message-list.tsx').MessageList,
    identity: load('lib/director-ask-identity.ts'),
    history: load('lib/director-history-presentation.ts'),
    policy: load('lib/studio-director-message-policy.ts'),
    voice: load('lib/studio-voice-interactive.ts'),
    transcript: load('lib/director-transcript.ts'),
  })
  for (const [name, value] of Object.entries(saved)) setEnv(name, value)
  return world
}

// ---------------------------------------------------------------- fixtures: what the Director sends and what a reload restores
const SID = 'sess-1'
const T0 = Date.UTC(2026, 9, 10, 2, 40, 0)
const iso = seconds => new Date(T0 + seconds * 1000).toISOString()
const ms = seconds => T0 + seconds * 1000
const frame = (type, id, t, payload, extra = {}) => ({ message_id: id, session_id: SID, timestamp: iso(t), type, payload, clientTimestamp: ms(t), ...extra })
const chat = (id, t, text) => frame('chat_message', id, t, { text })
const PLAN_ID = `msg_plan_confirm_${SID}`
const ACCEPT_PLAN = { label: "Yes, let's build it!", value: 'accept_plan', primary: true, requires_input: false }
const REJECT_PLAN = { label: "I'd like to make changes", value: 'reject_plan', primary: false, requires_input: false }
// Exactly the Director's plan gate: one deterministic id, the same prose every time it is asked.
const planGate = (t, id = PLAN_ID, extra = {}) => frame('action_request', id, t, { prompt_text: 'Does this structure work for you?', actions: [ACCEPT_PLAN, REJECT_PLAN] }, extra)
const OUTLINE_TEXT = 'Does this outline look good, or would you like to make changes?'
const LOOKS_PERFECT = value => ({ label: 'Looks perfect!', value, primary: true, requires_input: false })
const SOME_CHANGES = { label: 'Make some changes', value: 'request_refinement', primary: false, requires_input: false }
// With the J1 approval guard the accept value carries the outline identity; without it, the bare value.
const outlineGate = (id, t, value = 'accept_strawman:f6510ef8dd10') => frame('action_request', id, t, { prompt_text: OUTLINE_TEXT, actions: [LOOKS_PERFECT(value), SOME_CHANGES] })
const blockedGate = (id, t) => frame('action_request', id, t, { prompt_text: 'Evidence is incomplete on 1 slide. Retry before building?', actions: [
  { label: 'Retry research', value: 'retry_research', primary: true, requires_input: false }, SOME_CHANGES] })
const QSET = { intro: 'A few quick questions:', questions: [{ id: 'q1', text: 'Who is the audience?', allow_free_text: true, suggestions: [{ label: 'Leadership', recommended: true }] }] }
const questionCard = (id, t) => frame('action_request', id, t, { prompt_text: 'Quick questions', actions: [{ label: 'Skip questions', value: 'skip', primary: false, requires_input: false }], question_set: QSET })
const retryCard = (id, t) => frame('action_request', id, t, { prompt_text: 'Current follow-up choices', actions: [{ label: 'Retry current recovery', value: 'retry_current', primary: false, requires_input: false }] })
const userTurn = (id, t, text) => ({ id, text, timestamp: ms(t) })
const clone = value => JSON.parse(JSON.stringify(value))
// Every real session opens with the user's first message; without it the Studio shell shows its welcome guide instead of the transcript.
const FIRST_TURN = userTurn('u-first', 0, 'Build a deck on weekly team stand-ups')
const newState = (messages = [], userMessages = []) => ({ messages, userMessages: [FIRST_TURN, ...userMessages] })

// Mirror of the live path in hooks/use-deckster-websocket-v2.ts: the frame is stamped on arrival; a repeated action_request id is an upsert in
// place (the replay is authoritative for its own card), any other repeated id is dropped.
function arrive(state, incoming, arrivalSeconds) {
  const stamped = { ...incoming, clientTimestamp: ms(arrivalSeconds) }
  const exists = state.messages.some(item => item.message_id === stamped.message_id)
  if (!exists) return { ...state, messages: [...state.messages, stamped] }
  return stamped.type === 'action_request'
    ? { ...state, messages: state.messages.map(item => item.message_id === stamped.message_id ? stamped : item) } : state
}
// The restore block of hooks/use-builder-session.ts: Director rows keep their persisted time as the arrival stamp. The persisted row of an
// id is the FIRST one (persistedMessageIdsRef never saves an id twice), and the answered ref starts empty.
const restored = (messages, userMessages = []) => newState(clone(messages).map(item => ({ ...item, clientTimestamp: Date.parse(item.timestamp) })), clone(userMessages))

// ---------------------------------------------------------------- rendering
function render(world, state, { answered = new Set(), locked, sessionId = SID } = {}) {
  world.captured.clear()
  return renderToStaticMarkup(React.createElement(world.MessageList, {
    sessionId, userMessages: state.userMessages, messages: state.messages,
    userMessageIdsRef: { current: new Set(state.userMessages.map(item => item.id)) },
    userMessageContentMapRef: { current: new Map(state.userMessages.map(item => [item.text.trim().toLowerCase(), item.id])) },
    hasSeenWelcomeRef: { current: true }, answeredActionsRef: { current: answered }, messagesEndRef: { current: null },
    askGatesLocked: locked,
    // The owner's side of a click, as page.tsx handleActionClick commits it: the answer is recorded under the key MessageList passed.
    onActionClick(action, id, answerKey = id) { world.clicks.push({ action, id, answerKey }); answered.add(answerKey) },
    onSubmitAnswers() {},
  }))
}
// 'active' = the live card, 'answered' / 'earlier' = the disabled history card, 'absent' = not in the transcript
function cardState(html, id) {
  const tag = html.match(new RegExp(`<div[^>]*data-director-action-id="${id}"[^>]*>`))?.[0]
  if (!tag) return 'absent'
  const history = tag.match(/data-studio-director-history-action="(answered|earlier)"/)
  if (history) return history[1]
  return /data-studio-director-ask="(questions|approval|choice)"/.test(tag) ? 'active' : `unknown:${tag}`
}
const cardCount = (html, id) => (html.match(new RegExp(`data-director-action-id="${id}"`, 'g')) ?? []).length
const statesOf = (world, state, ids, options) => { const html = render(world, state, options); return Object.fromEntries(ids.map(id => [id, cardState(html, id)])) }
// A card is ENABLED when it is live and pressing its first button reaches the owner; the probe leaves no trace.
function enabled(world, id, answered) {
  const props = world.captured.get(id)
  if (!props) return false
  const before = world.clicks.length, snapshot = new Set(answered)
  props.onActionClick(props.actions[0], id)
  const fired = world.clicks.length > before
  world.clicks.length = before; answered.clear(); for (const key of snapshot) answered.add(key)
  return fired
}
const enabledIds = (world, html, ids, answered) => ids.filter(id => cardState(html, id) === 'active' && enabled(world, id, answered))

// ---------------------------------------------------------------- the suite (run on clean sources, then once per mutant)
function runSuite(mutate = []) {
  const results = []
  const check = (name, fn) => { try { fn(); results.push({ name, ok: true }) } catch (error) { results.push({ name, ok: false, error: String(error?.message ?? error) }) } }
  const W = {
    on: makeWorld({ ask: 'true', mutate }), onH: makeWorld({ ask: 'true', history: 'true', mutate }),
    off: makeWorld({ mutate }), offH: makeWorld({ history: 'true', mutate }),
  }
  const ON = [['ask on', W.on], ['ask on + history on', W.onH]]

  // ===== D-A1: a plan re-asked after a correction is live
  for (const [label, world] of ON) {
    check(`D-A1 (${label}): the plan re-asked after "I'd like to make changes" + a correction is live, clickable and answerable`, () => {
      const answered = new Set()
      let state = newState([chat('c1', 1, 'Here is my proposed plan'), planGate(2)])
      let html = render(world, state, { answered })
      assert.equal(cardState(html, PLAN_ID), 'active'); assert.ok(enabled(world, PLAN_ID, answered))
      // The user presses "I'd like to make changes" (the owner records the answer under the key MessageList passed).
      world.captured.get(PLAN_ID).onActionClick(REJECT_PLAN, PLAN_ID)
      assert.equal(world.clicks.at(-1).action.value, 'reject_plan')
      assert.equal(answered.size, 1); assert.notEqual([...answered][0], PLAN_ID, 'the answer is keyed to the ask, not to the reused id')
      state = { ...state, userMessages: [FIRST_TURN, userTurn('u1', 3, REJECT_PLAN.label), userTurn('u2', 10, 'Make the risks slide focus on data quality')] }
      assert.equal(cardState(render(world, state, { answered }), PLAN_ID), 'answered', 'the answered ask stays answered')
      // Director revises the plan and asks again: same id, a new frame (new timestamp), arriving live.
      state = arrive(state, chat('c2', 11, 'Here is the revised plan'), 11)
      state = arrive(state, planGate(12), 12)
      assert.equal(state.messages.filter(item => item.message_id === PLAN_ID).length, 1, 'the re-ask is an in-place upsert: one entry')
      html = render(world, state, { answered })
      assert.equal(cardState(html, PLAN_ID), 'active', 'the re-asked card must be live'); assert.ok(enabled(world, PLAN_ID, answered), 'and pressing it must reach the owner')
      // Answering it records THAT ask; a third ask after another correction is live again.
      world.captured.get(PLAN_ID).onActionClick(ACCEPT_PLAN, PLAN_ID)
      assert.equal(answered.size, 2)
      state = { ...state, userMessages: [...state.userMessages, userTurn('u3', 13, ACCEPT_PLAN.label)] }
      assert.equal(cardState(render(world, state, { answered }), PLAN_ID), 'answered')
      state = arrive(state, planGate(20), 20)
      assert.equal(cardState(render(world, state, { answered }), PLAN_ID), 'active')
    })
    check(`D-A1 (${label}): the same re-ask when the reject action asks for input (requires_input) is live too`, () => {
      const answered = new Set(), reject = { ...REJECT_PLAN, requires_input: true }
      let state = newState([frame('action_request', PLAN_ID, 2, { prompt_text: 'Does this structure work for you?', actions: [ACCEPT_PLAN, reject] })])
      render(world, state, { answered }); world.captured.get(PLAN_ID).onActionClick(reject, PLAN_ID)
      state = arrive(state, frame('action_request', PLAN_ID, 12, { prompt_text: 'Does this structure work for you?', actions: [ACCEPT_PLAN, reject] }), 12)
      assert.equal(cardState(render(world, state, { answered }), PLAN_ID), 'active')
    })
    check(`D-A1 (${label}): after a reload the answered ref is empty and a replayed pending plan gate is live`, () => {
      // The persisted row is the first ask (T1); Director's reconnect replay is the pending re-ask, stamped on arrival.
      let state = restored([chat('c1', 1, 'plan'), planGate(2), chat('c2', 11, 'revised plan')], [userTurn('u1', 3, REJECT_PLAN.label), userTurn('u2', 10, 'Make the risks slide focus on data quality')])
      state = arrive(state, planGate(12), 40)
      assert.equal(cardState(render(world, state), PLAN_ID), 'active')
    })
    check(`D-A1 (${label}): identical prose never decides an answer: an answered ask does not retire a later one with another id and the same text`, () => {
      const answered = new Set(), first = outlineGate('out-a', 2)
      let state = newState([first])
      render(world, state, { answered }); world.captured.get('out-a').onActionClick(first.payload.actions[0], 'out-a')
      state = arrive(arrive(state, chat('c', 6, 'one more thing'), 6), outlineGate('out-b', 9), 9)
      const html = render(world, state, { answered })
      assert.equal(cardState(html, 'out-a'), 'answered'); assert.equal(cardState(html, 'out-b'), 'active'); assert.ok(enabled(world, 'out-b', answered))
    })
  }
  check('D-A1 (ask off): today\'s behaviour is kept: the re-asked plan arrives "Answered" and cannot be pressed', () => {
    const answered = new Set()
    let state = newState([planGate(2)])
    render(W.off, state, { answered }); W.off.captured.get(PLAN_ID).onActionClick(REJECT_PLAN, PLAN_ID)
    assert.deepEqual([...answered], [PLAN_ID], 'flag off records the bare id, exactly as before')
    assert.equal(W.off.clicks.at(-1).answerKey, PLAN_ID)
    state = arrive(state, planGate(12), 12)
    const html = render(W.off, state, { answered })
    assert.equal(cardState(html, PLAN_ID), 'answered'); assert.equal(enabled(W.off, PLAN_ID, answered), false)
  })
  check('D-A1: a retained card callback cannot press an ask that was answered (a second press on the same instance is refused)', () => {
    for (const [, world] of ON) {
      const answered = new Set(), state = newState([planGate(2)])
      render(world, state, { answered })
      const props = world.captured.get(PLAN_ID); world.clicks.length = 0
      props.onActionClick(ACCEPT_PLAN, PLAN_ID); props.onActionClick(ACCEPT_PLAN, PLAN_ID)
      assert.equal(world.clicks.length, 1)
    }
  })
  check('keys: an ask instance is the id plus the frame timestamp; ask off the bare id; the prose never enters', () => {
    const a = W.on.identity, b = W.off.identity
    const first = { message_id: 'm', timestamp: iso(1), payload: { prompt_text: 'x' } }, again = { message_id: 'm', timestamp: iso(2), payload: { prompt_text: 'x' } }
    assert.notEqual(a.askAnswerKey(first), a.askAnswerKey(again))
    assert.equal(a.askAnswerKey(first), a.askAnswerKey({ ...first, payload: { prompt_text: 'different words' } }))
    assert.notEqual(a.askAnswerKey(first), a.askAnswerKey({ ...first, message_id: 'n' }))
    assert.equal(b.askAnswerKey(first), 'm'); assert.equal(b.askAnswerKey(again), 'm')
    assert.equal(a.isAskAnswered(new Set([a.askAnswerKey(first)]), first), true)
    assert.equal(a.isAskAnswered(new Set([a.askAnswerKey(first)]), again), false)
    assert.equal(a.isAskAnswered(new Set(['m']), first), false, 'a bare id from another time is not this ask')
    assert.equal(b.isAskAnswered(new Set(['m']), again), true)
    assert.equal(a.askAnswerKey({ message_id: 'm' }), a.askAnswerKey({ message_id: 'm', timestamp: undefined }), 'no timestamp degrades to the id')
  })

  // ===== D-A2: duplicates
  for (const [label, world] of [...ON, ['ask off', W.off], ['ask off + history on', W.offH]]) {
    check(`D-A2 (${label}): two entries with the SAME message id collapse to one card`, () => {
      const state = newState([outlineGate('out-x', 2), chat('c', 5, 'between'), { ...outlineGate('out-x', 9), clientTimestamp: ms(9) }])
      const html = render(world, state)
      assert.equal(cardCount(html, 'out-x'), 1)
      assert.equal(cardState(html, 'out-x'), 'active', 'the one card is live: an id is never its own successor')
      assert.equal(world.transcript.deduplicateDirectorTranscript(state.messages.map(item => ({ ...item, messageType: 'bot' })), []).filter(item => item.message_id === 'out-x').length, 1)
    })
  }
  for (const [label, world] of ON) {
    check(`D-A2 (${label}): two genuinely separate asks (different ids, identical prose) are both kept; only the newest is live`, () => {
      const state = restored([outlineGate('out-a', 2), outlineGate('out-b', 9)])
      const html = render(world, state)
      assert.equal(cardCount(html, 'out-a'), 1); assert.equal(cardCount(html, 'out-b'), 1)
      assert.deepEqual([cardState(html, 'out-a'), cardState(html, 'out-b')], ['earlier', 'active'])
    })
  }
  for (const [label, world] of [['ask off', W.off], ['ask off + history on', W.offH]]) {
    check(`D-A2 (${label}): today both copies stay live`, () => {
      const html = render(world, restored([outlineGate('out-a', 2), outlineGate('out-b', 9)]))
      assert.deepEqual([cardState(html, 'out-a'), cardState(html, 'out-b')], ['active', 'active'])
    })
  }
  check('replayed history (history on): an older identical-text card the user answered stays answered; the newer copy stays live', () => {
    // Persisted rows: first outline gate, "Looks perfect!", then the gate the Director sent again (a new id, the same words).
    const rows = [chat('c1', 1, 'outline ready'), outlineGate('out-1', 2), chat('c2', 6, 'Preparing your approved outline'), outlineGate('out-2', 8)]
    const turns = [userTurn('u1', 5, 'Looks perfect!')]
    for (const world of [W.onH, W.offH]) {
      assert.deepEqual(statesOf(world, restored(rows, turns), ['out-1', 'out-2']), { 'out-1': 'answered', 'out-2': 'active' })
    }
    // The Director also replays the user turn as a frame (history replay stamps arrival much later); the answer is timed by its own stamp.
    const state = restored(rows, [])
    state.messages.push({ message_id: 'hist-u1', session_id: SID, timestamp: iso(5), type: 'chat_message', role: 'user', payload: { text: 'Looks perfect!' }, clientTimestamp: ms(100000) })
    assert.deepEqual(statesOf(W.onH, state, ['out-1', 'out-2']), { 'out-1': 'answered', 'out-2': 'active' })
    // History off: nothing records the answer after a reload, so the older copy is only an earlier step; the newest is still the one live card.
    assert.deepEqual(statesOf(W.on, restored(rows, turns), ['out-1', 'out-2']), { 'out-1': 'earlier', 'out-2': 'active' })
  })

  // ===== NEW-E1: only the newest approval gate is live
  const staleRows = n => {
    const rows = [chat('c1', 1, 'outline ready'), outlineGate('o0', 2), chat('c2', 6, 'Preparing your approved outline')]
    for (let i = 1; i <= n; i++) rows.push(outlineGate(`o${i}`, 10 + 4 * i))
    return rows
  }
  const idsOf = n => Array.from({ length: n + 1 }, (_, i) => `o${i}`)
  for (const n of [1, 2, 3, 5]) {
    check(`NEW-E1: ${n} stale outline asks after an approved one: only the latest is enabled (history on, after a reload)`, () => {
      const answered = new Set(), state = restored(staleRows(n), [userTurn('u1', 5, 'Looks perfect!')]), ids = idsOf(n)
      const html = render(W.onH, state, { answered })
      assert.deepEqual(enabledIds(W.onH, html, ids, answered), [`o${n}`])
      assert.equal(cardState(html, 'o0'), 'answered')
      for (let i = 1; i < n; i++) assert.equal(cardState(html, `o${i}`), 'earlier', `o${i} is superseded`)
    })
    check(`NEW-E1: ${n} stale outline asks, history off: only the latest is enabled, every older one is an earlier step`, () => {
      const answered = new Set(), state = restored(staleRows(n), [userTurn('u1', 5, 'Looks perfect!')]), ids = idsOf(n)
      const html = render(W.on, state, { answered })
      assert.deepEqual(enabledIds(W.on, html, ids, answered), [`o${n}`])
      for (let i = 0; i < n; i++) assert.equal(cardState(html, `o${i}`), 'earlier')
    })
    check(`NEW-E1: ${n} stale asks, flag off: today every copy after the approval is enabled`, () => {
      const answered = new Set(), state = restored(staleRows(n), [userTurn('u1', 5, 'Looks perfect!')])
      const html = render(W.offH, state, { answered })
      assert.deepEqual(enabledIds(W.offH, html, idsOf(n), answered), idsOf(n).slice(1))
    })
  }
  check('NEW-E1: the same asks arriving live (not restored) leave the same single enabled gate', () => {
    for (const world of [W.on, W.onH]) {
      let state = newState([chat('c1', 1, 'outline ready'), outlineGate('o0', 2)], [userTurn('u1', 5, 'Looks perfect!')])
      for (let i = 1; i <= 4; i++) state = arrive(state, outlineGate(`o${i}`, 10 + i), 10 + i)
      const answered = new Set(), html = render(world, state, { answered })
      assert.deepEqual(enabledIds(world, html, idsOf(4), answered), ['o4'])
    }
  })
  check('NEW-E1: the newest gate answered by the user leaves nothing enabled', () => {
    const answered = new Set(), state = restored(staleRows(3), [])
    render(W.on, state, { answered }); W.on.captured.get('o3').onActionClick(state.messages.find(item => item.message_id === 'o3').payload.actions[0], 'o3')
    const html = render(W.on, state, { answered })
    assert.deepEqual(enabledIds(W.on, html, idsOf(3), answered), []); assert.equal(cardState(html, 'o3'), 'answered')
  })
  check('NEW-E1: the J1 guard value (accept_strawman:<identity>), the bare value and the blocked (retry research) gate are all approval gates', () => {
    const state = restored([outlineGate('g1', 2, 'accept_strawman'), outlineGate('g2', 4, 'accept_strawman:abc'), blockedGate('g3', 6), outlineGate('g4', 8, 'accept_strawman:def')])
    assert.deepEqual(statesOf(W.on, state, ['g1', 'g2', 'g3', 'g4']), { g1: 'earlier', g2: 'earlier', g3: 'earlier', g4: 'active' })
    const blockedLast = restored([outlineGate('g1', 2), blockedGate('g3', 6)])
    assert.deepEqual(statesOf(W.on, blockedLast, ['g1', 'g3']), { g1: 'earlier', g3: 'active' })
  })
  check('NEW-E1: a plan gate older than a later outline gate is an earlier step, and the other way round the plan stays live', () => {
    assert.deepEqual(statesOf(W.on, restored([planGate(2), outlineGate('o1', 9)]), [PLAN_ID, 'o1']), { [PLAN_ID]: 'earlier', o1: 'active' })
    assert.deepEqual(statesOf(W.on, restored([outlineGate('o1', 2), planGate(9)]), [PLAN_ID, 'o1']), { [PLAN_ID]: 'active', o1: 'earlier' })
  })
  check('NEW-E1: non-gate cards (questions, follow-up choices) are never superseded', () => {
    const state = restored([questionCard('q1', 2), retryCard('r1', 3), outlineGate('o1', 4), questionCard('q2', 5), retryCard('r2', 6), outlineGate('o2', 7)])
    assert.deepEqual(statesOf(W.on, state, ['q1', 'r1', 'o1', 'q2', 'r2', 'o2']), { q1: 'active', r1: 'active', o1: 'earlier', q2: 'active', r2: 'active', o2: 'active' })
  })
  check('NEW-E1: gates of another session are not compared with this one; a tie goes to the later entry; a card with no usable time is never retired', () => {
    const other = { ...outlineGate('x1', 20), session_id: 'sess-2' }
    const policy = W.on.policy.getDirectorActionPolicy
    const mixed = restored([outlineGate('o1', 2), other, outlineGate('o2', 9)])
    const statuses = W.on.history.historicalActionStatuses(mixed.messages, new Set())
    assert.equal(statuses.get('x1'), undefined); assert.equal(statuses.get('o1'), 'earlier'); assert.equal(statuses.get('o2'), undefined)
    assert.deepEqual([...policy(mixed.messages, new Set(), SID).activeActionIds].sort(), ['o2'])
    const tie = restored([outlineGate('t1', 5), outlineGate('t2', 5)])
    assert.deepEqual(statesOf(W.on, tie, ['t1', 't2']), { t1: 'earlier', t2: 'active' })
    const timeless = restored([outlineGate('n1', 5), outlineGate('n2', 8)]); timeless.messages[0].timestamp = 'not a time'; delete timeless.messages[0].clientTimestamp
    assert.deepEqual(statesOf(W.on, timeless, ['n1', 'n2']), { n1: 'active', n2: 'active' }, 'a card without a time cannot be proven older')
  })
  check('NEW-E1: a lone gate is live', () => { assert.deepEqual(statesOf(W.on, restored([outlineGate('only', 2)]), ['only']), { only: 'active' }) })

  // ===== NEW-E1: no gate while a build is running, paused, stopped or over
  const LOCKED_INPUTS = {
    'generating the final deck': { generatingFinal: true },
    'phase building': { narrationPhase: 'building' }, 'phase qa': { narrationPhase: 'qa' }, 'phase finalizing': { narrationPhase: 'finalizing' },
    'phase paused': { narrationPhase: 'paused' }, 'phase stopped': { narrationPhase: 'stopped' },
    'control stopped': { narrationControl: 'stopped' }, 'control stop_requested': { narrationControl: 'stop_requested' },
    'control paused': { narrationControl: 'paused' }, 'control pause_requested': { narrationControl: 'pause_requested' },
    'workflow COMPLETE': { workflowState: 'COMPLETE' }, 'workflow CONTENT_GENERATED': { workflowState: 'CONTENT_GENERATED' },
  }
  const OPEN_INPUTS = {
    'nothing': {}, 'phase idle': { narrationPhase: 'idle' }, 'phase planning (a corrected plan is being re-asked)': { narrationPhase: 'planning' },
    'phase strawman': { narrationPhase: 'strawman' }, 'phase awaiting_user': { narrationPhase: 'awaiting_user' }, 'phase complete': { narrationPhase: 'complete' },
    'phase error (a retry gate may be re-asked)': { narrationPhase: 'error' }, 'control running': { narrationControl: 'running' },
    'control resume_requested': { narrationControl: 'resume_requested' },
    'workflow TOPIC_SET': { workflowState: 'TOPIC_SET' }, 'workflow REFINE_STRAWMAN': { workflowState: 'REFINE_STRAWMAN' }, 'workflow BLANK_PRESENTATION': { workflowState: 'BLANK_PRESENTATION' },
    'workflow NEW': { workflowState: 'NEW' }, 'workflow null': { workflowState: null },
  }
  check('lock inputs: every running / paused / stopped / finished signal locks the gates (ask on)', () => {
    for (const [name, inputs] of Object.entries(LOCKED_INPUTS)) assert.equal(W.on.identity.askGatesLocked(inputs), true, name)
  })
  check('lock inputs: planning, outline drafting, waiting for the user, errors and a new session never lock (ask on)', () => {
    for (const [name, inputs] of Object.entries(OPEN_INPUTS)) assert.equal(W.on.identity.askGatesLocked(inputs), false, name)
  })
  check('lock inputs: ask off never locks, whatever the build says', () => {
    for (const [name, inputs] of Object.entries(LOCKED_INPUTS)) assert.equal(W.off.identity.askGatesLocked(inputs), false, name)
  })
  const stoppedDeck = () => restored(staleRows(4), [userTurn('u1', 5, 'Looks perfect!')])
  for (const [label, world] of ON) {
    check(`NEW-E1 (${label}): after Stop no approval card is enabled, and the cards read as earlier steps`, () => {
      const answered = new Set(), html = render(world, stoppedDeck(), { answered, locked: world.identity.askGatesLocked({ narrationPhase: 'stopped', narrationControl: 'stopped' }) })
      assert.deepEqual(enabledIds(world, html, idsOf(4), answered), [])
      for (const id of idsOf(4)) assert.ok(['answered', 'earlier'].includes(cardState(html, id)), id)
    })
    check(`NEW-E1 (${label}): an in-flight build (generating the final deck, or phase building) disables the gate buttons`, () => {
      for (const inputs of [{ generatingFinal: true }, { narrationPhase: 'building' }, { narrationPhase: 'qa' }]) {
        const answered = new Set(), state = restored([chat('c1', 1, 'outline'), outlineGate('o1', 2)])
        const html = render(world, state, { answered, locked: world.identity.askGatesLocked(inputs) })
        assert.deepEqual(enabledIds(world, html, ['o1'], answered), [], JSON.stringify(inputs))
        assert.equal(cardState(html, 'o1'), 'earlier')
      }
    })
    check(`NEW-E1 (${label}): after a reload the same lock gives the same cards as the session that was live`, () => {
      const rows = staleRows(4), turns = [userTurn('u1', 5, 'Looks perfect!')]
      let live = newState([rows[0], rows[1]], [...turns])
      for (const row of rows.slice(2)) live = arrive(live, row, Date.parse(row.timestamp) / 1000 - T0 / 1000)
      const locked = world.identity.askGatesLocked({ narrationPhase: 'stopped', narrationControl: 'stopped' })
      const left = statesOf(world, live, idsOf(4), { locked }), right = statesOf(world, restored(rows, turns), idsOf(4), { locked })
      assert.deepEqual(left, right)
      assert.deepEqual(Object.values(right).filter(state => state === 'active'), [])
      // Without the lock (Resume pressed, the build over, or the Director no longer reports one) the newest gate is the one live card again.
      assert.deepEqual(Object.values(statesOf(world, restored(rows, turns), idsOf(4), { locked: false })).filter(state => state === 'active'), ['active'])
    })
    check(`NEW-E1 (${label}): the lock leaves questions and follow-up choices alone`, () => {
      const answered = new Set(), state = restored([questionCard('q1', 2), retryCard('r1', 3), outlineGate('o1', 4)])
      const html = render(world, state, { answered, locked: true })
      assert.deepEqual(enabledIds(world, html, ['q1', 'r1', 'o1'], answered), ['q1', 'r1'])
    })
    check(`NEW-E1 (${label}): the lock never overwrites "answered" and offers no button of a locked gate`, () => {
      const answered = new Set(), state = restored([outlineGate('o1', 2), outlineGate('o2', 9)], [userTurn('u1', 5, 'Looks perfect!')])
      const html = render(world, state, { answered, locked: true })
      assert.equal(cardState(html, 'o1'), world === W.onH ? 'answered' : 'earlier'); assert.equal(cardState(html, 'o2'), 'earlier')
      assert.equal(world.captured.has('o2'), false, 'no live card, so no callback to press')
    })
  }
  check('NEW-E1 (ask off): the lock is ignored and today\'s cards come back unchanged', () => {
    const answered = new Set(), html = render(W.offH, stoppedDeck(), { answered, locked: true })
    assert.deepEqual(enabledIds(W.offH, html, idsOf(4), answered), idsOf(4).slice(1))
    const policy = W.off.policy.getDirectorActionPolicy(stoppedDeck().messages, new Set(), SID, [])
    assert.equal(W.off.identity.lockApprovalGatePolicy(policy, stoppedDeck().messages, true), policy, 'the very same policy object')
  })
  check('policy: the voice call\'s pending ask follows the same gates (newest only; none while locked)', () => {
    for (const world of [W.on, W.onH]) {
      const state = stoppedDeck(), base = world.policy.getDirectorActionPolicy(state.messages, new Set(), SID, state.userMessages)
      const pending = policy => world.voice.latestPendingAsk(state.messages, { displayedSessionId: SID, historicalStatuses: policy.historicalActions, activeActionIds: policy.activeActionIds })
      assert.equal(pending(base)?.id, 'o4')
      assert.equal(pending(world.identity.lockApprovalGatePolicy(base, state.messages, true)), null)
      assert.equal(pending(world.identity.lockApprovalGatePolicy(base, state.messages, false))?.id, 'o4')
    }
  })
  check('policy: a locked gate leaves activeActionIds, so a callback retained from before the lock cannot press it; other cards stay active', () => {
    for (const world of [W.on, W.onH]) {
      const state = restored([questionCard('q1', 2), retryCard('r1', 3), outlineGate('o1', 4), outlineGate('o2', 9)], [userTurn('u1', 3.5, 'Skip questions')])
      const base = world.policy.getDirectorActionPolicy(state.messages, new Set(), SID, [])
      assert.ok(base.activeActionIds.has('o2'))
      const locked = world.identity.lockApprovalGatePolicy(base, state.messages, true)
      assert.deepEqual([...locked.activeActionIds].sort(), ['q1', 'r1'])
      assert.deepEqual([...base.activeActionIds].sort(), ['o2', 'q1', 'r1'], 'the input policy is never written')
      assert.equal(locked.historicalActions.get('o2'), 'earlier')
    }
  })
  check('policy: lockApprovalGateStatuses (the Studio intro gate) agrees with lockApprovalGatePolicy', () => {
    const state = stoppedDeck(), statuses = W.on.history.historicalActionStatuses(state.messages, new Set(), state.userMessages)
    const locked = W.on.identity.lockApprovalGateStatuses(statuses, state.messages, true)
    assert.deepEqual(idsOf(4).filter(id => !locked.has(id)), [])
    assert.equal(W.on.identity.lockApprovalGateStatuses(statuses, state.messages, false), statuses, 'open: the very same map')
    assert.equal(statuses.has('o4'), false, 'the input map is never written')
  })

  // ===== #343 cases are unchanged with the ask flag on (the matrix of scripts/test-studio-history-action-status.mjs, flag-on column)
  const QID = 'q1', OUT = 'out1'
  const gateOutline = (id, t) => frame('action_request', id, t, { prompt_text: 'Review your outline', actions: [{ label: 'Generate final deck', value: 'accept_strawman', primary: true, requires_input: false }] })
  const outlineFrame = (id, t) => frame('slide_update', id, t, { operation: 'full_update', metadata: { main_title: 'Deck', presentation_duration: 5, overall_theme: 'Clean', preview_presentation_id: 'deck-1', preview_url: 'https://layout.test/p/deck-1' },
    slides: [{ slide_id: 's1', slide_number: 1, title: 'One', slide_type: 'content', narrative: 'n', key_points: [] }] })
  const finalFrame = (id, t) => frame('presentation_url', id, t, { url: 'https://layout.test/p/deck-1', presentation_id: 'deck-1', slide_count: 1 })
  const blankFrame = (id, t) => frame('slide_update', id, t, { is_blank: true, operation: 'full_update', metadata: { main_title: 'Blank', presentation_duration: 0, overall_theme: '' }, slides: [] })
  const MATRIX = {
    A_completed_session: { ids: [QID, PLAN_ID, OUT], on: { [QID]: 'answered', [PLAN_ID]: 'earlier', [OUT]: 'earlier' }, off: { [QID]: 'active', [PLAN_ID]: 'earlier', [OUT]: 'earlier' },
      messages: [chat('b1', 1, 'A few questions first'), questionCard(QID, 2), chat('b2', 11, 'Here is the plan'), planGate(12), outlineFrame('o1', 21), gateOutline(OUT, 22), finalFrame('f1', 40), chat('b4', 41, 'Your deck is ready')],
      turns: [userTurn('u1', 0, 'Build a deck'), userTurn('u2', 10, 'Answers: Leadership'), userTurn('u3', 20, ACCEPT_PLAN.label), userTurn('u4', 30, 'Generate final deck')] },
    A2_answered_without_successor_frames: { ids: [QID, PLAN_ID], on: { [QID]: 'answered', [PLAN_ID]: 'answered' }, off: { [QID]: 'active', [PLAN_ID]: 'active' },
      messages: [questionCard(QID, 2), planGate(12)], turns: [userTurn('u1', 0, 'Build a deck'), userTurn('u2', 10, 'Answers: Leadership'), userTurn('u3', 20, ACCEPT_PLAN.label)] },
    B_pending_questions_with_blank_deck: { ids: [QID], on: { [QID]: 'active' }, off: { [QID]: 'active' }, messages: [blankFrame('blank', 0.5), chat('b1', 1, 'A few questions first'), questionCard(QID, 2)], turns: [userTurn('u1', 0, 'Build a deck')] },
    D_pending_plan_gate_with_blank_deck: { ids: [QID, PLAN_ID], on: { [QID]: 'answered', [PLAN_ID]: 'active' }, off: { [QID]: 'active', [PLAN_ID]: 'active' },
      messages: [blankFrame('blank', 0.5), questionCard(QID, 2), chat('b1', 6, 'Here is the plan'), planGate(7)], turns: [userTurn('u1', 0, 'Build a deck'), userTurn('u2', 5, 'Answers: Leadership')] },
    E_pending_generate_final_deck: { ids: [PLAN_ID, OUT], on: { [PLAN_ID]: 'earlier', [OUT]: 'active' }, off: { [PLAN_ID]: 'earlier', [OUT]: 'active' },
      messages: [planGate(7), outlineFrame('o1', 15), chat('b2', 20, 'Outline ready'), gateOutline(OUT, 21)], turns: [userTurn('u1', 0, 'Build a deck'), userTurn('u2', 8, ACCEPT_PLAN.label)] },
    G_side_question_while_gate_pending: { ids: [PLAN_ID], on: { [PLAN_ID]: 'active' }, off: { [PLAN_ID]: 'active' },
      messages: [planGate(7), chat('b2', 9, 'Yes, I can do 10 slides.')], turns: [userTurn('u1', 0, 'Build a deck'), userTurn('u2', 8, 'can it be 10 slides?')] },
    I_not_the_tail_no_reply: { ids: [QID, 'r1'], on: { [QID]: 'active', r1: 'active' }, off: { [QID]: 'active', r1: 'active' },
      messages: [questionCard(QID, 2), retryCard('r1', 3), chat('b1', 4, 'one'), chat('b2', 5, 'two'), chat('b3', 6, 'three'), finalFrame('f1', 7)], turns: [userTurn('u1', 0, 'Build a deck')] },
    K_replies_before_or_at_the_card_do_not_answer: { ids: [QID, 'q2'], on: { [QID]: 'active', q2: 'active' }, off: { [QID]: 'active', q2: 'active' },
      messages: [questionCard(QID, 2), questionCard('q2', 3)], turns: [userTurn('u1', 0, 'Build a deck'), userTurn('u0', 2, 'Answers: early'), userTurn('u2', 1, 'older')] },
  }
  for (const [name, scenario] of Object.entries(MATRIX)) {
    check(`#343 ${name}: ask on + history on keeps the history-flag result`, () => assert.deepEqual(statesOf(W.onH, restored(scenario.messages, scenario.turns), scenario.ids), scenario.on))
    check(`#343 ${name}: ask on + history off keeps today's cards`, () => assert.deepEqual(statesOf(W.on, restored(scenario.messages, scenario.turns), scenario.ids), scenario.off))
    check(`#343 ${name}: ask off is untouched`, () => {
      assert.deepEqual(statesOf(W.offH, restored(scenario.messages, scenario.turns), scenario.ids), scenario.on)
      assert.deepEqual(statesOf(W.off, restored(scenario.messages, scenario.turns), scenario.ids), scenario.off)
    })
  }

  // ===== flag parsing and flag-off identity
  check('the flag is read as the exact string "true" only', () => {
    for (const value of ['false', '1', 'TRUE', ' true', '', 'yes']) {
      const world = makeWorld({ ask: value, mutate })
      assert.equal(world.identity.STUDIO_ASK_CARD_IDENTITY_ENABLED, false, JSON.stringify(value))
      assert.equal(world.identity.askAnswerKey({ message_id: 'm', timestamp: iso(1) }), 'm')
      assert.equal(world.identity.askGatesLocked({ generatingFinal: true }), false)
      assert.deepEqual(enabledIds(world, render(world, restored(staleRows(2), [])), idsOf(2), new Set()), idsOf(2), `${JSON.stringify(value)} keeps every copy live`)
    }
    assert.equal(W.on.identity.STUDIO_ASK_CARD_IDENTITY_ENABLED, true)
    assert.equal(makeWorld({ mutate }).identity.STUDIO_ASK_CARD_IDENTITY_ENABLED, false, 'unset is off')
  })
  check('ask off: statuses, the lock wrappers and the markup do not depend on the new code (same as an off world with the lock asked for)', () => {
    for (const rows of [staleRows(0), staleRows(3), [planGate(2)], [questionCard('q1', 2), outlineGate('o1', 3)]]) {
      const state = restored(rows, [userTurn('u1', 5, 'Looks perfect!')])
      const plain = render(W.offH, state), locked = render(W.offH, state, { locked: true })
      assert.equal(crypto.createHash('sha256').update(plain).digest('hex'), crypto.createHash('sha256').update(locked).digest('hex'))
    }
  })

  // ===== wiring (the page and the director-call hook cannot be rendered offline; their expressions are pinned)
  check('wiring: the hook still upserts a repeated action_request id in place (the premise of D-A1)', () => {
    const source = W.on.read('hooks/use-deckster-websocket-v2.ts')
    assert.match(source, /const upsertActionRequest =\s*message\.type === 'action_request' && isDuplicate;/)
    assert.match(source, /m\.message_id === message\.message_id \? transcriptMessage : m,/)
  })
  check('wiring: page.tsx records and checks the answer under the answerKey MessageList hands it, and locks every consumer of the policy', () => {
    const page = W.on.read('app/builder/page.tsx')
    assert.match(page, /async \(action: ActionRequest\['payload'\]\['actions'\]\[0\], actionRequestMessageId: string, answerKey: string = actionRequestMessageId\) =>/)
    assert.match(page, /JSON\.stringify\(\[origin\.generation, origin\.sessionId, origin\.userId, answerKey\]\)/)
    assert.match(page, /session\.answeredActionsRef\.current\.has\(answerKey\)\) return/)
    assert.equal((page.match(/session\.answeredActionsRef\.current\.add\(answerKey\)/g) ?? []).length, 2)
    assert.doesNotMatch(page, /answeredActionsRef\.current\.(add|has)\(actionRequestMessageId\)/)
    assert.match(page, /const approvalGatesLocked = askGatesLocked\(\{\s*generatingFinal: isGeneratingFinal, narrationPhase: buildNarration\.phase, narrationControl: buildNarration\.control,\s*workflowState: directorWorkflowState,\s*\}\)/)
    assert.match(page, /lockApprovalGateStatuses\(\s*historicalActionStatuses\(messages, session\.answeredActionsRef\.current, session\.userMessages\), messages, approvalGatesLocked\)/)
    assert.match(page, /askGatesLocked: approvalGatesLocked, messageListSessionId: currentSessionId/)
    assert.match(page, /askGatesLocked=\{approvalGatesLocked\}/)
  })
  check('wiring: MessageList and the voice hook apply the lock to getDirectorActionPolicy, and MessageList passes the answer key', () => {
    const list = W.on.read('components/builder/message-list.tsx')
    assert.match(list, /lockApprovalGatePolicy\(\s*getDirectorActionPolicy\(messages, answeredActionsRef\.current, sessionId, userMessages\), messages, askGatesLocked\)/)
    assert.match(list, /onActionClick\(action, messageId, answerKey\)/)
    assert.match(list, /answeredActionsRef\.current\.has\(answerKey\)\) return/)
    const hook = W.on.read('hooks/use-studio-director-call.ts')
    assert.equal((hook.match(/lockApprovalGatePolicy\(/g) ?? []).length, 2)
    assert.match(hook, /current\.options\.messages, current\.options\.askGatesLocked\)/); assert.match(hook, /messages, options\.askGatesLocked\)/)
  })
  check('wiring: .env.example documents the flag off; package.json has the script', () => {
    assert.match(fs.readFileSync(path.join(repoRoot, '.env.example'), 'utf8'), /^NEXT_PUBLIC_STUDIO_ASK_CARD_IDENTITY_ENABLED="false"$/m)
    assert.equal(JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).scripts['test:studio-ask-card-identity'], 'node scripts/test-studio-ask-card-identity.mjs')
  })
  return results
}

// ---------------------------------------------------------------- mutants: each edits one source in memory and must be noticed
const ID = 'lib/director-ask-identity.ts', HP = 'lib/director-history-presentation.ts', ML = 'components/builder/message-list.tsx', TR = 'lib/director-transcript.ts'
const PAGE = 'app/builder/page.tsx', HOOK = 'hooks/use-studio-director-call.ts'
const MUTANTS = [
  ['key ignores the timestamp (a re-ask is the same ask)', ID, '`${message.message_id}\\u0000${stamp}`', 'message.message_id'],
  ['key is the prompt text', ID, '`${message.message_id}\\u0000${stamp}`', 'String((message as { payload?: { prompt_text?: unknown } }).payload?.prompt_text)'],
  ['answer key ignores the flag (always the instance)', ID, 'return STUDIO_ASK_CARD_IDENTITY_ENABLED ? askInstanceKey(message) : message.message_id', 'return askInstanceKey(message)'],
  ['answer key never uses the instance', ID, 'return STUDIO_ASK_CARD_IDENTITY_ENABLED ? askInstanceKey(message) : message.message_id', 'return message.message_id'],
  ['isAskAnswered falls back to the bare id', ID, 'return answeredIds.has(askAnswerKey(message))', 'return answeredIds.has(askAnswerKey(message)) || answeredIds.has(message.message_id)'],
  ['gate detection loses the J1 guard value', ID, "|| value.startsWith('accept_strawman:')", ''],
  ['gate detection loses retry_research', ID, " || value === 'retry_research'", ''],
  ['gate detection loses accept_plan', ID, "value === 'accept_plan' || ", ''],
  ['gate detection loses the bare accept_strawman', ID, " || value === 'accept_strawman'\n      ", '\n      '],
  ['lock ignores the final-deck build', ID, 'Boolean(inputs.generatingFinal)', 'false'],
  ['lock forgets phase stopped', ID, "'paused', 'stopped'])\nconst LOCKING_CONTROLS", "'paused'])\nconst LOCKING_CONTROLS"],
  ['lock forgets phase building', ID, "new Set(['building', 'qa', 'finalizing', 'paused', 'stopped'])", "new Set(['qa', 'finalizing', 'paused', 'stopped'])"],
  ['lock also locks planning (breaks a corrected plan)', ID, "new Set(['building', 'qa', 'finalizing', 'paused', 'stopped'])", "new Set(['planning', 'building', 'qa', 'finalizing', 'paused', 'stopped'])"],
  ['lock forgets control stopped', ID, "new Set(['pause_requested', 'paused', 'stopped', 'stop_requested'])", "new Set(['pause_requested', 'paused', 'stop_requested'])"],
  ['lock forgets a finished session', ID, "new Set(['COMPLETE', 'CONTENT_GENERATED'])", "new Set(['COMPLETE'])"],
  ['lock ignores the flag', ID, 'if (!STUDIO_ASK_CARD_IDENTITY_ENABLED) return false\n  return Boolean', 'return Boolean'],
  ['status lock ignores the flag', ID, 'if (!STUDIO_ASK_CARD_IDENTITY_ENABLED || !locked) return statuses', 'if (!locked) return statuses'],
  ['status lock never locks', ID, 'if (!STUDIO_ASK_CARD_IDENTITY_ENABLED || !locked) return statuses', 'if (true) return statuses'],
  ['status lock overwrites an answered card', ID, "if (message.type !== 'action_request' || next.has(message.message_id)) continue", "if (message.type !== 'action_request') continue"],
  ['status lock hits every action card, not only gates', ID, 'if (!isApprovalGate((message.payload as { actions?: readonly { value?: unknown }[] } | undefined)?.actions)) continue', ''],
  ['policy lock keeps the locked gate active', ID, 'activeActionIds: new Set([...policy.activeActionIds].filter(id => !historicalActions.has(id)))', 'activeActionIds: policy.activeActionIds'],
  ['supersession retires every gate', HP, 'if (newest && gate.id !== newest.id && Number.isFinite(gate.time))', 'if (newest && Number.isFinite(gate.time))'],
  ['supersession retires nothing', HP, 'if (newest && gate.id !== newest.id && Number.isFinite(gate.time))', 'if (false)'],
  ['supersession compares entries, not ids (an id supersedes itself)', HP, 'if (newest && gate.id !== newest.id && Number.isFinite(gate.time))', 'if (newest && gate !== newest && Number.isFinite(gate.time))'],
  ['supersession: a tie goes to the earlier entry', HP, '(!newest || gate.time >= newest.time)', '(!newest || gate.time > newest.time)'],
  ['supersession: the OLDEST gate wins', HP, '(!newest || gate.time >= newest.time)', '(!newest || gate.time <= newest.time)'],
  ['supersession ignores the session', HP, "bySession.get(message.session_id ?? '') ?? []", "bySession.get('') ?? []"],
  ['supersession overwrites an answered card', HP, '      if (statuses.has(gate.id)) continue\n', ''],
  ['supersession retires a card with no usable time', HP, 'gate.id !== newest.id && Number.isFinite(gate.time))', 'gate.id !== newest.id)'],
  ['supersession is not behind the flag', HP, 'if (STUDIO_ASK_CARD_IDENTITY_ENABLED) retireSupersededApprovalGates(messages, statuses)', 'retireSupersededApprovalGates(messages, statuses)'],
  ['statuses answer by the bare id again (D-A1)', HP, 'if (isAskAnswered(answeredIds, message)) {', 'if (answeredIds.has(message.message_id)) {'],
  ['MessageList ignores the lock', ML, 'lockApprovalGatePolicy(\n    getDirectorActionPolicy(messages, answeredActionsRef.current, sessionId, userMessages), messages, askGatesLocked)', 'getDirectorActionPolicy(messages, answeredActionsRef.current, sessionId, userMessages)'],
  ['MessageList hands the bare id as the answer key', ML, 'return ask ? askAnswerKey(ask) : messageId', 'return messageId'],
  ['MessageList drops the answer key from the click', ML, 'onActionClick(action, messageId, answerKey)', 'onActionClick(action, messageId)'],
  ['MessageList checks the bare id for an answered ask', ML, 'answeredActionsRef.current.has(answerKey)) return\n    onActionClick', 'answeredActionsRef.current.has(messageId)) return\n    onActionClick'],
  ['transcript no longer collapses the same id', TR, 'if (seenIds.has(id)) {', 'if (false) {'],
  ['page records the bare id again', PAGE, 'session.answeredActionsRef.current.has(answerKey)) return', 'session.answeredActionsRef.current.has(actionRequestMessageId)) return'],
  ['page commits the bare id again', PAGE, "      session.answeredActionsRef.current.add(answerKey)\n      setPendingActionInput", "      session.answeredActionsRef.current.add(actionRequestMessageId)\n      setPendingActionInput"],
  ['page does not lock the intro gate', PAGE, 'lockApprovalGateStatuses(\n    historicalActionStatuses(messages, session.answeredActionsRef.current, session.userMessages), messages, approvalGatesLocked)', 'historicalActionStatuses(messages, session.answeredActionsRef.current, session.userMessages)'],
  ['page does not hand the lock to MessageList', PAGE, 'askGatesLocked={approvalGatesLocked}', ''],
  ['voice hook ignores the lock (list wiring)', HOOK, 'messages, options.askGatesLocked)', 'messages, undefined)'],
].map(([name, file, from, to]) => ({ name, file, from, to }))

const clean = runSuite()
let failed = 0
for (const result of clean) { if (result.ok) console.log(`ok   ${result.name}`); else { failed++; console.log(`FAIL ${result.name}\n     ${result.error.split('\n').join('\n     ')}`) } }
console.log(`${clean.length - failed}/${clean.length} checks pass on the real sources`)

let survivors = 0
if (!failed) {
  for (const mutant of MUTANTS) {
    const run = runSuite([mutant]), killedBy = run.filter(item => !item.ok)
    if (killedBy.length) console.log(`killed  ${mutant.name}  (${killedBy.length} check${killedBy.length === 1 ? '' : 's'}, first: ${killedBy[0].name})`)
    else { survivors++; console.log(`SURVIVED ${mutant.name}`) }
  }
  console.log(`${MUTANTS.length - survivors}/${MUTANTS.length} mutants killed`)
}
if (failed || survivors) { console.log(`${failed} failing check(s), ${survivors} surviving mutant(s)`); process.exit(1) }
console.log('all Studio ask-card identity checks passed')
