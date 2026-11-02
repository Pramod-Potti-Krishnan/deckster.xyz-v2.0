// PASS2 #4: outline review on the canvas (flag NEXT_PUBLIC_STUDIO_OUTLINE_CANVAS, exact "true", default off).
//  (a) While Director's outline gate is live, the canvas shows the outline with "Approve & build", which presses the gate's own
//      approve action through the chat card's handler (same action, same id, same answer key: no new protocol).
//  (b) A built deck's structure that Director re-sends on reconnect is no longer drawn as a new outline card below
//      "Your presentation is ready" (the dev history bug); the original outline card keeps its place.
//  (c) The outline card's count reads as the outline's ("Outline · 7 slides"), with the deck's current count beside it.
//  (d) Fix-forward (PASS2 LIVE-CHECK, session "Pilot Results"): while the canvas shows the outline, EVERY chat outline card it stands
//      for folds to the summary, including the copy the transcript keeps when Director re-sends the pending outline on reconnect
//      (the canvas pairs the live gate with the newest copy, the transcript draws the first). An older, different outline folds too,
//      marked "Earlier outline". The pre-fix tree (FIX_BASE) and in-memory mutants of the rule must fail these checks.
// Renders the REAL MessageList / StudioOutlineCard / PresentationArea / StudioOutlineCanvas server-side from the real TypeScript
// sources, and proves flag off renders byte for byte (sha256) what the base commit renders. No network, no browser, no timers.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import ts from 'typescript'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const nodeRequire = createRequire(path.join(repoRoot, 'package.json'))
const React = nodeRequire('react')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')

const FLAG = 'NEXT_PUBLIC_STUDIO_OUTLINE_CANVAS'
const ASK = 'NEXT_PUBLIC_STUDIO_ASK_CARD_IDENTITY_ENABLED'
/** The commit this feature was built on (studio-v4-dev-preparation-code at #357): flag off must render exactly as it did. */
const BASE_COMMIT = '68e3396'
/** The merged PASS2 #4 (studio-v4-dev-preparation-code at #360) this fix-forward starts from: it reproduces the live bug. */
const FIX_BASE = '5cc455d'
const STUDIO = { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' }
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
const sha = text => crypto.createHash('sha256').update(text).digest('hex')

let checks = 0
const check = (fn, ...args) => { checks++; return fn(...args) }

// ---------------------------------------------------------------- loader: transpile-on-require, repo files only
const transpiled = new Map()
function compile(rel, source) {
  const key = `${rel}\0${source}`
  if (!transpiled.has(key)) {
    const out = ts.transpileModule(source, { fileName: rel, reportDiagnostics: true, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } })
    const errors = (out.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error)
    assert.equal(errors.length, 0, `${rel} does not transpile`)
    transpiled.set(key, out.outputText)
  }
  return transpiled.get(key)
}
const commitAvailable = commit => { try { execFileSync('git', ['cat-file', '-e', `${commit}^{commit}`], { cwd: repoRoot, stdio: 'ignore' }); return true } catch { return false } }
const baseAvailable = commitAvailable(BASE_COMMIT)
const baseCache = new Map()
function baseSource(rel, commit = BASE_COMMIT) {
  const key = `${commit}:${rel}`
  if (!baseCache.has(key)) {
    try { baseCache.set(key, execFileSync('git', ['show', `${commit}:${rel}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })) }
    catch { baseCache.set(key, null) }
  }
  return baseCache.get(key)
}
const STUBS = {
  'next/navigation': { useRouter: () => ({ push() {}, replace() {}, refresh() {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/builder' },
  'next-auth/react': { useSession: () => ({ data: null, status: 'unauthenticated', update: async () => null }), signIn: async () => {}, signOut: async () => {}, SessionProvider: ({ children }) => children },
}
/** base: every repo file comes from BASE_COMMIT, or from `commit` (a file the base lacks fails to resolve). overrides: rel -> source
 * (the mutation checks). */
function createWorld({ env = {}, base = false, commit = BASE_COMMIT, overrides = {} } = {}) {
  const cache = new Map()
  const source = rel => rel in overrides ? overrides[rel] : base ? baseSource(rel, commit)
    : (fs.existsSync(path.join(repoRoot, rel)) && fs.statSync(path.join(repoRoot, rel)).isFile() ? read(rel) : null)
  const resolve = (spec, fromRel) => {
    const stem = spec.startsWith('@/') ? spec.slice(2) : path.posix.join(path.posix.dirname(fromRel), spec)
    for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) if (/\.tsx?$/.test(stem + ext) && source(stem + ext) !== null) return stem + ext
    throw new Error(`unresolved ${spec} from ${fromRel}${base ? ` at ${BASE_COMMIT}` : ''}`)
  }
  function load(rel) {
    if (cache.has(rel)) return cache.get(rel).exports
    const module = { exports: {} }
    cache.set(rel, module)
    const require = spec => {
      if (spec in STUBS) return STUBS[spec]
      if (spec.endsWith('.css')) return {}
      if (spec.startsWith('@/') || spec.startsWith('.')) return load(resolve(spec, rel))
      return nodeRequire(spec)
    }
    new Function('module', 'exports', 'require', 'process', compile(rel, source(rel)))(module, module.exports, require, { env })
    return module.exports
  }
  return { load }
}
const silence = fn => { const e = console.error, w = console.warn; console.error = console.warn = () => {}; try { return fn() } finally { console.error = e; console.warn = w } }

// ---------------------------------------------------------------- fixtures: what Director sends, as a reload restores it
const SID = 'sess-outline'
const T0 = Date.UTC(2026, 9, 8, 14, 0, 0)
const iso = s => new Date(T0 + s * 1000).toISOString()
// use-builder-session restores a Director row with its persisted time as the arrival stamp (clientTimestamp).
const frame = (type, id, s, payload, extra = {}) => ({ message_id: id, session_id: SID, timestamp: iso(s), type, payload, clientTimestamp: T0 + s * 1000, ...extra })
const TITLES = ['AI Demand Forecasting for Retail', 'Traditional retail forecasting relies on backward-looking data', 'Legacy bottlenecks drive inventory imbalance',
  'AI unifies real-time signals', 'An end-to-end data pipeline', 'A phased roadmap minimises risk', 'AI demand forecasting unifies data across retail']
const LAYOUT = 'https://layout.uat.test'
// Director websocket.py _send_slide_update: metadata carries the deck it describes (preview_url / preview_presentation_id).
const outline = (id, s, deck, { slides = 7, url = `${LAYOUT}/p/${deck}`, narrative = i => `Speaker notes for slide ${i + 1}` } = {}) => frame('slide_update', id, s, {
  operation: 'full_update', affected_slides: null,
  metadata: { main_title: 'Adopting AI-driven demand forecasting in mid-size retail', slide_count: slides, overall_theme: 'professional', design_suggestions: '',
    target_audience: "mid-size retail company's leadership team", presentation_duration: 15, preview_url: url, preview_presentation_id: deck },
  slides: Array.from({ length: slides }, (_, i) => ({ slide_id: `slide_${i + 1}`, slide_number: i + 1, slide_type: i === 0 ? 'title_slide' : 'content',
    title: TITLES[i] ?? `Slide ${i + 1}`, narrative: narrative(i), key_points: [`Point ${i + 1}`], analytics_needed: null, visuals_needed: null,
    diagrams_needed: null, structure_preference: 'L01' })) })
const chat = (id, s, text) => frame('chat_message', id, s, { text }, { role: 'assistant' })
const finalUrl = (id, s, deck) => frame('presentation_url', id, s, { url: `${LAYOUT}/p/${deck}`, presentation_id: deck, slide_count: 7,
  message: "Your presentation 'Adopting AI-driven demand forecasting in mid-size retail' with 7 slides is ready!" })
const LOOKS_PERFECT = value => ({ label: 'Looks perfect!', value, primary: true, requires_input: false })
const SOME_CHANGES = { label: 'Make some changes', value: 'request_refinement', primary: false, requires_input: false }
const outlineGate = (id, s, value = 'accept_strawman') => frame('action_request', id, s, { prompt_text: 'Does this outline look good, or would you like to make changes?', actions: [LOOKS_PERFECT(value), SOME_CHANGES] })
const retryGate = (id, s) => frame('action_request', id, s, { prompt_text: 'Evidence is incomplete on 1 slide. Retry before building?', actions: [
  { label: 'Retry research', value: 'retry_research', primary: true, requires_input: false }, SOME_CHANGES] })
const nextSteps = (id, s) => frame('action_request', id, s, { prompt_text: 'What would you like to do next?', actions: [
  { label: 'Done, looks great!', value: 'complete_presentation', primary: true, requires_input: false },
  { label: 'Make adjustments', value: 'request_adjustments', primary: false, requires_input: true }] })
const READY = "🎉 Your presentation is ready!\n\n**Adopting AI-driven demand forecasting in mid-size retail** - 7 slides\n\n[View Presentation](https://layout.uat.test/p/deck-1)"
const FIRST = { id: 'u-first', text: 'Build a deck on AI demand forecasting for mid-size retail', timestamp: T0 }
const announce = s => chat('c-outline', s, "I've created an outline with 7 slides for **Adopting AI-driven demand forecasting in mid-size retail**. Building the full deck now — watch it take shape on the canvas.")

// The dev history (MOCKUP-VS-DEV "outline"): a built deck, reloaded after a later visit. On that visit Director re-sent the
// structure (websocket.py: a BUILT session's reconnect calls _send_slide_update with the deck's url/id, a new id and the reconnect's
// time); Studio persisted the frame, so every later reload restores it below the completion. Base Studio collapses such a copy only
// when it is the same deck, in the same user turn, with identical content (coalesceOutlineStateReplays). Two ordinary histories
// defeat that, and both render the bug:
// - auto-build, then the user carried on in chat before the reconnect (a later user turn);
const DEV = {
  name: 'auto-built deck, a later user turn, structure re-sent on reconnect',
  messages: [outline('su-strawman', 10, 'deck-1'), announce(11), finalUrl('pu-final', 40, 'deck-1'), chat('c-ready', 41, READY), nextSteps('ar-next', 42),
    chat('c-later', 601, 'Done. I shortened the title.'), outline('su-reconnect', 900, 'deck-1')],
  userMessages: [FIRST, { id: 'u-later', text: 'Make the title shorter', timestamp: T0 + 600_000 }],
}
// - the approval flow: "Looks perfect!" is a user turn between the outline and the completion, and the final deck is a NEW
//   presentation (websocket.py _create_final_presentation: "Creates NEW presentation"), so even the deck id differs.
const DEV_NEW_DECK = {
  name: 'approved outline, new final deck, structure re-sent on reconnect',
  messages: [outline('su-strawman', 10, 'deck-0'), chat('c-review', 11, 'Review the structural outline in the preview.'), outlineGate('ar-gate', 12),
    finalUrl('pu-final', 40, 'deck-1'), chat('c-ready', 41, READY), nextSteps('ar-next', 42), outline('su-reconnect', 900, 'deck-1')],
  userMessages: [FIRST, { id: 'u-approve', text: 'Looks perfect!', timestamp: T0 + 20_000 }],
}
// Base already collapses the copy when nothing defeats coalescing (same deck, same turn, same content): the flag changes nothing.
const SAME_TURN = {
  name: 'auto-built deck, re-sent in the same turn (base already collapses it)',
  messages: [outline('su-strawman', 10, 'deck-1'), announce(11), finalUrl('pu-final', 40, 'deck-1'), chat('c-ready', 41, READY), nextSteps('ar-next', 42),
    outline('su-reconnect', 900, 'deck-1')],
  userMessages: [FIRST],
}
const PENDING = {
  name: 'outline waiting for approval',
  messages: [outline('su-strawman', 10, 'deck-0'), chat('c-review', 11, "I've created an outline with 7 slides. Review the structural outline in the preview."), outlineGate('ar-gate', 12, 'accept_strawman:f6510ef8dd10')],
  userMessages: [FIRST],
}
const REFINED = {
  name: 'outline refined before approval',
  messages: [outline('su-1', 10, 'deck-0'), outlineGate('ar-gate-1', 12), outline('su-2', 30, 'deck-2', { slides: 5 }), outlineGate('ar-gate-2', 31)],
  userMessages: [FIRST, { id: 'u-refine', text: 'Make some changes', timestamp: T0 + 20_000 }],
}
const LEGACY = {
  name: 'legacy combined strawman (slide_update, presentation_url, action_request)',
  messages: [outline('su-1', 10, 'deck-0'), finalUrl('pu-preview', 11, 'deck-0'), outlineGate('ar-gate', 12)],
  userMessages: [FIRST],
}
const BLOCKED = { name: 'evidence-blocked outline', messages: [outline('su-1', 10, 'deck-0'), retryGate('ar-retry', 12)], userMessages: [FIRST] }
const NO_EARLIER = { name: 'resend without an earlier outline', messages: [finalUrl('pu-final', 40, 'deck-1'), chat('c-ready', 41, READY), outline('su-reconnect', 900, 'deck-1')], userMessages: [FIRST] }

// (d) The live finding, as Studio restored it: session "Pilot Results" (Studio dev, PASS2 LIVE-CHECK), rebuilt from its persisted rows
// (read once, read-only; ids, times and deck ids replaced, long text shortened, nothing token-like). Plan approved, so the outline is
// built at once ("Building the full deck now"); the build fails. From then on Director replays the still-pending outline on EVERY
// reconnect (websocket.py _replay_strawman_review: a slide_update and an approval action_request, each under a new id at the
// reconnect's time; Studio persists both). The failed build had changed the strawman, so every replay differs from the first outline
// (an emoji title, an empty closing title, "Key content about ..." notes, service "text"). The transcript draws the first outline and
// the first replay (coalesceOutlineStateReplays drops the later identical replays of the same user turn); the canvas pairs the live
// gate with the NEWEST replay, an id no chat card carries, so before the fix both cards stayed full size.
const PILOT_DECK = 'deck-pilot'
const PILOT_SUBTITLES = ['Pilot forecast performance against historical baselines, with illustrative weekly error data',
  'Sample weekly forecast-error values for Baseline and Pilot across the testing period. Illustrative data.', 'Report the pilot results']
const PILOT_CHART = 'Pilot Testing Demonstrates Forecast Error Reduction Against Baseline Benchmarks'
const pilotOutline = (id, s, replay, extra) => frame('slide_update', id, s, {
  slides: [['title_slide', 'H1', 'hook'], ['content', 'C1', 'deep_dive'], ['closing_slide', 'H3', 'closing']].map(([slide_type, layout, purpose], i) => {
    const title = replay ? ['📋 Pilot Results', PILOT_CHART, ''][i] : ['Pilot Results', PILOT_CHART, 'Pilot Results'][i]
    return { title, purpose, service: replay ? 'text' : null, slide_id: `slide_${i + 1}`, subtitle: PILOT_SUBTITLES[i],
      narrative: replay ? `Key content about ${title}` : [' ', 'Key message: Illustrative weekly pilot tracking shows baseline error drops across trial weeks.', ' '][i],
      key_points: [], slide_type, variant_id: null, slide_number: i + 1, speaker_notes: null, semantic_group: null, visuals_needed: null,
      diagrams_needed: null, analytics_needed: null, container_layout: null, structure_preference: layout }
  }),
  is_blank: false,
  metadata: { main_title: 'Pilot Results', slide_count: 3, overall_theme: 'professional', design_suggestions: '', target_audience: 'general',
    presentation_duration: 15, preview_url: `${LAYOUT}/p/${PILOT_DECK}`, preview_presentation_id: PILOT_DECK },
  operation: 'full_update', affected_slides: null }, extra)
// Restored Director rows carry no role; use-builder-session stamps each with its persisted time (clientTimestamp).
const row = (type, id, s, payload) => frame(type, id, s, payload)
const pilotGate = (id, s, extra) => frame('action_request', id, s, { actions: [LOOKS_PERFECT('accept_strawman'), SOME_CHANGES],
  prompt_text: 'Does this outline look good, or would you like to make changes?' }, extra)
const DAY = 86400
// The visit that saw the bug: its own reconnect replay arrives live, stamped on arrival by the WebSocket hook.
const live = s => ({ clientTimestamp: T0 + s * 1000 })
const PILOT_HISTORY = [
  row('chat_message', 'p-greeting', 2, { text: "Hello! I'm your presentation assistant. What topic would you like to present on?" }),
  row('chat_message', 'p-plan', 20, { text: "Here's my proposed plan for your presentation:\n\n**Core Message**\nThe pilot reduced forecast errors.\n\n**Proposed Structure:** 3 slides" }),
  row('action_request', `msg_plan_confirm_${SID}`, 20, { prompt_text: 'Does this structure work for you?', actions: [
    { label: "Yes, let's build it!", value: 'accept_plan', primary: true, requires_input: false },
    { label: "I'd like to make changes", value: 'reject_plan', primary: false, requires_input: false }] }),
  row('chat_message', 'p-think-1', 47.874, { text: 'Reviewing your topic and audience…', ephemeral: true }),
  pilotOutline('p-outline', 69.992, false),
  row('chat_message', 'p-announce', 70.06, { text: "I've created an outline with 3 slides for **Pilot Results**. Building the full deck now — watch it take shape on the canvas." }),
  row('chat_message', 'p-think-2', 80.098, { text: 'Slide 2: layout chosen — single_chart_top_intro_plus_decision', ephemeral: true }),
  row('chat_message', 'p-error', 81.438, { text: 'Sorry, content generation encountered an error: Slide Builder build failed: plan-and-build internal error.' }),
  // reconnect replays, as persisted (the first two rows of a pair share a millisecond; the gate row comes first)
  pilotGate('p-gate-1', 313.833), pilotOutline('p-replay-1', 313.833, true),
  pilotGate('p-gate-2', 2092.47), pilotOutline('p-replay-2', 2092.47, true),
  pilotOutline('p-replay-3', 3583.474, true), pilotGate('p-gate-3', 3583.475),
]
const PILOT_USERS = [{ id: 'p-u-ask', text: 'Create exactly 3 slides titled Pilot Results: a title slide, one bar chart slide with illustrative weekly forecast-error values, and a closing slide.', timestamp: T0 + 10_000 },
  { id: 'p-u-plan', text: "Yes, let's build it!", timestamp: T0 + 46_000 }]
const PILOT = {
  name: 'Pilot Results: failed build, outline replayed on every reconnect, live replay on this visit',
  messages: [...PILOT_HISTORY, pilotOutline('p-replay-live', 3 * DAY, true, live(3 * DAY)), pilotGate('p-gate-live', 3 * DAY + 0.001, live(3 * DAY + 0.001))],
  userMessages: PILOT_USERS,
}
// The same session reloaded later: that visit's replay is persisted too (the session as it is stored now).
const PILOT_RELOADED = {
  name: 'Pilot Results, reloaded: every replay persisted',
  messages: [...PILOT_HISTORY, pilotOutline('p-replay-4', 3 * DAY, true), pilotGate('p-gate-4', 3 * DAY + 0.001)],
  userMessages: PILOT_USERS,
}
// Not messy at all: #364's clean pending outline, reopened. Director's reconnect replay alone defeated the id link.
const PENDING_REOPENED = {
  name: 'clean pending outline, reopened (Director replays it on connect)',
  messages: [...PENDING.messages, { ...outline('su-replay', 900, 'deck-0'), clientTimestamp: T0 + 900_000 },
    { ...outlineGate('ar-gate-replay', 900.001, 'accept_strawman:f6510ef8dd10'), clientTimestamp: T0 + 900_001 }],
  userMessages: PENDING.userMessages,
}
const FIXTURES = [DEV, DEV_NEW_DECK, SAME_TURN, PENDING, REFINED, LEGACY, BLOCKED, NO_EARLIER, PILOT, PILOT_RELOADED, PENDING_REOPENED]

// ---------------------------------------------------------------- MessageList, server-rendered
function renderList(world, fixture, extra = {}) {
  const { MessageList } = world.load('components/builder/message-list.tsx')
  const clicks = []
  const answered = extra.answered ?? new Set()
  const html = silence(() => renderToStaticMarkup(React.createElement(MessageList, {
    sessionId: SID, userMessages: fixture.userMessages, messages: fixture.messages,
    userMessageIdsRef: { current: new Set(fixture.userMessages.map(m => m.id)) },
    userMessageContentMapRef: { current: new Map(fixture.userMessages.map(m => [m.text.trim().toLowerCase(), m.id])) },
    hasSeenWelcomeRef: { current: true }, answeredActionsRef: { current: answered }, messagesEndRef: { current: null },
    onActionClick: (action, id, answerKey) => clicks.push({ action, id, answerKey }), onSubmitAnswers() {},
    ...extra.props,
  })))
  return { html, clicks }
}
const outlineCards = html => (html.match(/aria-label="Presentation outline"/g) ?? []).length
const at = (html, text) => { const i = html.indexOf(text); assert.ok(i >= 0, `"${text}" not rendered`); return i }

const flagOf = env => createWorld({ env }).load('lib/studio-outline-canvas.ts').STUDIO_OUTLINE_CANVAS_ENABLED
{
  check(assert.equal, flagOf({}), false, 'default off')
  for (const value of ['', 'TRUE', 'True', '1', 'yes', ' true', 'true ', 'false', 'on'])
    check(assert.equal, flagOf({ [FLAG]: value }), false, `flag "${value}" is off`)
  check(assert.equal, flagOf({ [FLAG]: 'true' }), true, 'exact "true" is on')
  check(assert.equal, createWorld({ env: { [FLAG]: 'true' } }).load('lib/director-history-presentation.ts').STUDIO_OUTLINE_CANVAS_ENABLED, true, 'one flag')
}

// ---------------------------------------------------------------- pure rules
const lib = createWorld().load('lib/studio-outline-canvas.ts')
{
  for (const value of ['accept_strawman', 'accept_strawman:f6510ef8dd10']) check(assert.equal, lib.isOutlineApproveAction({ value }), true, value)
  for (const value of ['accept_plan', 'retry_research', 'request_refinement', 'accept_strawman_x', 'xaccept_strawman', '', undefined, 7])
    check(assert.equal, lib.isOutlineApproveAction({ value }), false, String(value))
  check(assert.equal, lib.isOutlineApproveAction(null), false)
  check(assert.equal, lib.isOutlineFrame(outline('a', 1, 'd')), true)
  const blank = outline('b', 1, 'd'); blank.payload.is_blank = true
  const partial = outline('p', 1, 'd'); partial.payload.operation = 'partial_update'
  const empty = outline('e', 1, 'd', { slides: 0 })
  for (const [name, message] of [['blank', blank], ['partial', partial], ['no slides', empty], ['chat', chat('c', 1, 'x')], ['null', null]])
    check(assert.equal, lib.isOutlineFrame(message), false, name)
  check(assert.deepEqual, lib.outlineDeckIdentity(outline('a', 1, 'deck-9')), { id: 'deck-9', url: `${LAYOUT}/p/deck-9` })

  // (b) the transcript rule, on sorted transcript entries
  const entries = fixture => [...fixture.userMessages.map(m => ({ ...m, messageType: 'user' })), ...fixture.messages.map(m => ({ ...m, messageType: 'bot' }))]
    .sort((a, b) => (a.messageType === 'user' ? a.timestamp : a.clientTimestamp) - (b.messageType === 'user' ? b.timestamp : b.clientTimestamp))
  const ids = list => list.map(e => e.messageType === 'user' ? e.id : e.message_id)
  for (const fixture of [DEV, DEV_NEW_DECK, SAME_TURN]) {
    const list = entries(fixture)
    const out = lib.hideBuiltDeckStructureResends(list)
    check(assert.deepEqual, ids(out), ids(list).filter(id => id !== 'su-reconnect'), `${fixture.name}: only the re-sent structure goes`)
  }
  for (const fixture of [PENDING, REFINED, LEGACY, BLOCKED, NO_EARLIER]) {
    const list = entries(fixture)
    check(assert.equal, lib.hideBuiltDeckStructureResends(list), list, `${fixture.name}: untouched (same array)`)
  }
  // matched by URL alone, and never across decks
  const urlOnly = outline('su-url', 900, 'deck-x', { url: `${LAYOUT}/p/deck-1` }); urlOnly.payload.metadata.preview_presentation_id = ''
  const byUrl = entries({ messages: [...SAME_TURN.messages.slice(0, 5), urlOnly], userMessages: [FIRST] })
  check(assert.deepEqual, ids(lib.hideBuiltDeckStructureResends(byUrl)), ids(byUrl).filter(id => id !== 'su-url'), 'URL match')
  const otherDeck = entries({ messages: [...SAME_TURN.messages.slice(0, 5), outline('su-new', 900, 'deck-new')], userMessages: [FIRST] })
  check(assert.equal, lib.hideBuiltDeckStructureResends(otherDeck), otherDeck, 'a new outline for another deck stays')
  // an outline BEFORE the completion of the same deck (the build filled the preview deck) stays
  const sameDeckBefore = entries({ messages: [outline('su-a', 10, 'deck-1'), outline('su-b', 20, 'deck-1', { slides: 6 }), finalUrl('pu', 40, 'deck-1')], userMessages: [FIRST] })
  check(assert.equal, lib.hideBuiltDeckStructureResends(sameDeckBefore), sameDeckBefore, 'outlines before the completion stay')
}

// ---------------------------------------------------------------- (a) which outline the canvas shows
{
  const select = (fixture, over = {}, world = createWorld()) => world.load('lib/studio-outline-canvas.ts').selectStudioOutlineCanvas({
    enabled: true, blocked: false, messages: fixture.messages, answeredIds: new Set(), userTurns: fixture.userMessages, sessionId: SID, ...over })
  const pending = select(PENDING)
  check(assert.equal, pending?.gate.message_id, 'ar-gate')
  check(assert.equal, pending?.outline.message_id, 'su-strawman')
  check(assert.deepEqual, pending?.approve, LOOKS_PERFECT('accept_strawman:f6510ef8dd10'), 'the gate\'s own approve action, as sent')
  check(assert.equal, pending?.answerKey, 'ar-gate', 'flag NEXT_PUBLIC_STUDIO_ASK_CARD_IDENTITY_ENABLED off: the bare id, as the chat card')
  check(assert.equal, select(PENDING, { enabled: false }), null, 'off: nothing')
  check(assert.equal, select(PENDING, { blocked: true }), null, 'a build or template mode owns the canvas')
  check(assert.equal, select(PENDING, { answeredIds: new Set(['ar-gate']) }), null, 'answered in chat: the canvas steps back')
  check(assert.equal, select(PENDING, { sessionId: 'another-session' }), null, 'another session\'s gate never shows')
  check(assert.equal, select(BLOCKED), null, 'evidence-blocked gate: no Approve & build')
  check(assert.equal, select(DEV), null, 'built deck: no gate')
  check(assert.equal, select(DEV_NEW_DECK), null, 'the final deck retires the outline gate')
  check(assert.equal, select({ messages: [outlineGate('ar-gate', 12)] }), null, 'no outline before the gate: nothing to show')
  const refined = select(REFINED)
  check(assert.equal, refined?.gate.message_id, 'ar-gate-2', 'the newest live gate')
  check(assert.equal, refined?.outline.message_id, 'su-2', 'with the outline it asks about')
  check(assert.equal, refined?.outline.payload.slides.length, 5)
  // arrival order: a gate replayed on reconnect (re-stamped) still pairs with the newest outline before it
  const replayed = { messages: [outline('su-1', 10, 'deck-0'), { ...outlineGate('ar-gate', 12), clientTimestamp: T0 + 500_000 }], userMessages: [FIRST] }
  check(assert.equal, select(replayed)?.outline.message_id, 'su-1')
  // with ask-card identity on: the instance key, and the build lock retires it exactly as it retires the chat card
  const askWorld = createWorld({ env: { [ASK]: 'true' } })
  const ask = select(PENDING, {}, askWorld)
  check(assert.equal, ask?.answerKey, askWorld.load('lib/director-ask-identity.ts').askAnswerKey(PENDING.messages[2]))
  check(assert.notEqual, ask?.answerKey, 'ar-gate')
  check(assert.equal, select(PENDING, { locked: true }, askWorld), null, 'locked gate: no canvas')
  check(assert.equal, select(PENDING, { answeredIds: new Set([ask.answerKey]) }, askWorld), null)
}

// ---------------------------------------------------------------- flag off: MessageList == base commit, byte for byte
if (baseAvailable) {
  const baseWorld = createWorld({ env: STUDIO, base: true })
  let compared = 0
  for (const [flagName, flagEnv] of [['unset', {}], ['"false"', { [FLAG]: 'false' }], ['"TRUE"', { [FLAG]: 'TRUE' }], ['"1"', { [FLAG]: '1' }]]) {
    const work = createWorld({ env: { ...STUDIO, ...flagEnv } })
    for (const fixture of FIXTURES) for (const [propsName, props] of [['plain', {}], ['deck of 62', { presentationContext: { title: 'x', slideCount: 62 } }],
      ['canvas id undefined', { studioOutlineOnCanvas: undefined }]]) {
      const want = renderList(baseWorld, fixture, { props: propsName === 'canvas id undefined' ? {} : props }).html
      const got = renderList(work, fixture, { props }).html
      check(assert.equal, sha(got), sha(want), `flag ${flagName}, ${fixture.name}, ${propsName}: sha == ${BASE_COMMIT}`)
      compared++
    }
  }
  // the classic (non-Studio) list too
  const classicBase = createWorld({ base: true }), classicWork = createWorld({ env: { [FLAG]: 'true' } })
  for (const fixture of FIXTURES) { check(assert.equal, sha(renderList(classicWork, fixture).html), sha(renderList(classicBase, fixture).html), `classic, ${fixture.name}`); compared++ }
  console.log(`  MessageList flag off (and the classic list with the flag on) == ${BASE_COMMIT} (sha256) in ${compared} renders`)

  // StudioOutlineCard alone: no flag props = the base card
  const BaseCard = baseWorld.load('components/builder/chat/studio-outline-card.tsx').StudioOutlineCard
  const WorkCard = createWorld({ env: STUDIO }).load('components/builder/chat/studio-outline-card.tsx').StudioOutlineCard
  const noAudience = outline('n', 1, 'd'); noAudience.payload.metadata.target_audience = ''; noAudience.payload.metadata.overall_theme = ''
  for (const payload of [outline('a', 1, 'd').payload, outline('b', 1, 'd', { slides: 3 }).payload, noAudience.payload])
    for (const historyStatus of [undefined, 'earlier', 'current']) {
      const props = { payload, historyStatus, contextByIndex: { 0: { slide_index: 0, key_message: 'Why now', narrative_role: 'opening_hook', research_status: 'ok', citation_count: 2 } }, renderEvidence: () => null }
      check(assert.equal, renderToStaticMarkup(React.createElement(WorkCard, props)), renderToStaticMarkup(React.createElement(BaseCard, props)), `card ${historyStatus ?? 'plain'}`)
    }
} else {
  console.log(`  SKIP base-commit identity: ${BASE_COMMIT} is not in this clone (the checks below still run)`)
}

// ---------------------------------------------------------------- flag on: the transcript
{
  const off = createWorld({ env: STUDIO })
  const on = createWorld({ env: { ...STUDIO, [FLAG]: 'true' } })
  // As a reload restores them: use-deckster-websocket-v2 restoreMessages passes every row through projectVerifiedOutlineReplay with
  // the restored final deck as owner. That existing safeguard marks an identical copy, and base coalescing drops it only within the
  // same user turn.
  const restore = (world, fixture) => {
    const { projectVerifiedOutlineReplay } = world.load('lib/director-history-presentation.ts')
    const finalId = fixture.messages.find(m => m.type === 'presentation_url').payload.presentation_id
    const owner = { isTerminal: true, socketSessionId: SID, displayedSessionId: SID, deckOwnerSessionId: SID, finalPresentationId: finalId,
      finalPresentationUrl: `${LAYOUT}/p/${finalId}` }
    return { ...fixture, messages: fixture.messages.reduce((accepted, message) => { accepted.push(projectVerifiedOutlineReplay(message, accepted, owner)); return accepted }, []) }
  }
  check(assert.equal, outlineCards(renderList(off, restore(off, SAME_TURN)).html), 1, 'base collapses a same-turn identical copy')
  check(assert.equal, outlineCards(renderList(on, restore(on, SAME_TURN)).html), 1)
  for (const fixture of [DEV, DEV_NEW_DECK, restore(off, DEV), restore(off, DEV_NEW_DECK)]) {
    // off (= base): the dev bug, reproduced: a second outline card below the completion and "What would you like to do next?"
    const before = renderList(off, fixture).html
    check(assert.equal, outlineCards(before), 2, `${fixture.name}: off draws the re-sent structure as a second card`)
    check(assert.ok, before.lastIndexOf('aria-label="Presentation outline"') > at(before, 'What would you like to do next?'), `${fixture.name}: off, below the completion`)
    // on: one outline card, in its place before the completion
    const after = renderList(on, fixture).html
    check(assert.equal, outlineCards(after), 1, `${fixture.name}: on, one outline card`)
    check(assert.ok, at(after, 'aria-label="Presentation outline"') < at(after, 'Your presentation is ready!'), `${fixture.name}: on, the outline comes before "ready"`)
    check(assert.ok, at(after, 'Your presentation is ready!') < at(after, 'What would you like to do next?'))
    // everything else the transcript shows is unchanged: remove the one card from "before" and the rest is identical
    const cut = html => html.replace(/<div data-studio-director-message="director"[^>]*>(?:(?!<div data-studio-director-message=)[\s\S])*?aria-label="Presentation outline"[\s\S]*?(?=<div data-studio-director-message=|<div><\/div>$)/g, '')
    check(assert.equal, cut(after), cut(before), `${fixture.name}: nothing else moves`)
  }
  for (const fixture of [SAME_TURN, NO_EARLIER, REFINED, LEGACY]) check(assert.equal, outlineCards(renderList(on, fixture).html), outlineCards(renderList(off, fixture).html), `${fixture.name}: same cards`)

  // (c) the outline's own count, labelled, with the deck's current count beside it when they differ
  const labelled = renderList(on, DEV, { props: { presentationContext: { title: 'x', slideCount: 62 } } }).html
  check(assert.match, labelled, /data-studio-director-part="outline-review-meta">Outline · 7 slides · 15 min/)
  check(assert.match, labelled, /data-studio-director-part="outline-review-deck-count">The deck now has 62 slides\.<\/p>/)
  const same = renderList(on, DEV, { props: { presentationContext: { title: 'x', slideCount: 7 } } }).html
  check(assert.doesNotMatch, same, /outline-review-deck-count/, 'same count: no note')
  check(assert.doesNotMatch, renderList(on, DEV).html, /outline-review-deck-count/, 'unknown deck count: no note')
  check(assert.doesNotMatch, labelled, /The deck now has 7/, 'never a made-up number')

  // (a) in chat: the outline on the canvas keeps a summary, its slide list folded; the gate card is untouched
  const plain = renderList(on, PENDING).html
  const onCanvas = renderList(on, PENDING, { props: { studioOutlineOnCanvas: 'su-strawman' } }).html
  check(assert.doesNotMatch, plain, /outline-review-canvas-note/)
  check(assert.match, onCanvas, /data-studio-director-part="outline-review-canvas-note">The outline is on the canvas\./)
  check(assert.match, onCanvas, /<details data-studio-director-part="outline-review-details"><summary>Slide details<\/summary><p data-studio-director-part="outline-review-audience">/)
  check(assert.equal, (onCanvas.match(/data-studio-director-part="outline-review-slide"/g) ?? []).length, 7, 'every slide still reachable')
  const gateCard = html => html.slice(html.indexOf('data-studio-director-ask="approval"') - 200)
  check(assert.equal, gateCard(onCanvas).replace(/^[\s\S]*?data-studio-director-ask/, ''), gateCard(plain).replace(/^[\s\S]*?data-studio-director-ask/, ''), 'the approval card is unchanged')
  check(assert.doesNotMatch, renderList(on, PENDING, { props: { studioOutlineOnCanvas: 'some-other-id' } }).html, /outline-review-canvas-note/, 'only the outline on the canvas')

  // (a) same action, same id, same answer key as the chat card's "Looks perfect!" (no new protocol)
  for (const [name, env] of [['ask identity off', {}], ['ask identity on', { [ASK]: 'true' }]]) {
    const world = createWorld({ env: { ...STUDIO, [FLAG]: 'true', ...env } })
    const card = world.load('components/builder/chat/question-card.tsx'), Real = card.QuestionCard
    let captured = null
    card.QuestionCard = props => { if (props.messageId === 'ar-gate') captured = props; return React.createElement(Real, props) }
    const { clicks } = renderList(world, PENDING)
    card.QuestionCard = Real
    check(assert.ok, captured, `${name}: the chat gate card rendered`)
    captured.onActionClick(captured.actions[0], 'ar-gate')
    const selection = world.load('lib/studio-outline-canvas.ts').selectStudioOutlineCanvas({ enabled: true, blocked: false, messages: PENDING.messages,
      answeredIds: new Set(), userTurns: PENDING.userMessages, sessionId: SID })
    check(assert.deepEqual, [selection.approve, selection.gate.message_id, selection.answerKey], [clicks[0].action, clicks[0].id, clicks[0].answerKey],
      `${name}: Approve & build hands the owner exactly what the chat card hands it`)
  }
}

// ---------------------------------------------------------------- (d) every chat card the canvas stands for folds (the live finding)
const ON = { ...STUDIO, [FLAG]: 'true' }
const cardsOf = html => [...html.matchAll(/<section data-studio-director-part="outline-(?:history-)?review" aria-label="([^"]+)">([\s\S]*?)<\/section>/g)]
  .map(([, label, body]) => ({ label, heading: body.match(/data-studio-director-part="outline-review-heading">[\s\S]*?<span>([^<]*)<\/span>/)?.[1],
    canvasNote: body.includes('data-studio-director-part="outline-review-canvas-note">The outline is on the canvas.'),
    replacedNote: body.includes('data-studio-director-part="outline-review-superseded-note">Replaced by the outline on the canvas.</p>'),
    folded: /<details data-studio-director-part="outline-review-details"><summary>Slide details<\/summary>[\s\S]*<ol data-studio-director-part="outline-review-slides"/.test(body),
    slides: (body.match(/data-studio-director-part="outline-review-slide"/g) ?? []).length,
    titles: [...body.matchAll(/<strong>([^<]*)<\/strong>/g)].map(m => m[1]) }))
const ROLE = {
  canvas: { label: 'Presentation outline', heading: 'Presentation outline', canvasNote: true, replacedNote: false, folded: true },
  earlier: { label: 'Earlier presentation outline', heading: 'Earlier outline', canvasNote: false, replacedNote: true, folded: true },
}
const selectIn = (world, fixture) => world.load('lib/studio-outline-canvas.ts').selectStudioOutlineCanvas({ enabled: true, blocked: false,
  messages: fixture.messages, answeredIds: new Set(), userTurns: fixture.userMessages, sessionId: SID })
/** Every expectation of (d), collected (not thrown) so the pre-fix tree and each mutant can be shown to fail them. */
function foldFailures(world) {
  const failures = []
  const expect = (ok, what) => { if (!ok) failures.push(what) }
  for (const [fixture, roles, slides] of [[PILOT, ['earlier', 'canvas'], 3], [PILOT_RELOADED, ['earlier', 'canvas'], 3],
    [PENDING_REOPENED, ['canvas'], 7], [PENDING, ['canvas'], 7], [REFINED, ['earlier', 'canvas'], null]]) {
    const selection = selectIn(world, fixture)
    expect(selection, `${fixture.name}: the canvas shows an outline`)
    if (!selection) continue
    const cards = cardsOf(renderList(world, fixture, { props: { studioOutlineOnCanvas: selection.outline.message_id } }).html)
    expect(cards.length === roles.length, `${fixture.name}: ${roles.length} outline card(s), got ${cards.length}`)
    cards.forEach((card, i) => {
      const want = ROLE[roles[i]]
      if (!want) return
      for (const key of Object.keys(want)) expect(card[key] === want[key], `${fixture.name}: card ${i + 1} (${roles[i]}) ${key} = ${JSON.stringify(card[key])}`)
      if (slides) expect(card.slides === slides, `${fixture.name}: card ${i + 1} keeps all ${slides} slides under "Slide details"`)
    })
  }
  // Pure rule. Nothing on the canvas, a later outline, another session's outline, or a non-outline frame: no relation.
  const rule = world.load('lib/director-history-presentation.ts').outlineCanvasRelation
  expect(typeof rule === 'function', 'outlineCanvasRelation exists')
  if (typeof rule !== 'function') return failures
  const canvas = pilotOutline('p-canvas', 500, true)
  const relation = (card, on = canvas, id = on?.message_id) => { try { return rule(card, on, id) } catch (error) { return `threw ${error.message}` } }
  expect(relation(canvas) === 'canvas', 'the frame itself')
  expect(relation(pilotOutline('p-copy', 400, true)) === 'canvas', 'an earlier identical copy')
  const moved = pilotOutline('p-moved', 400, true)
  moved.payload.metadata = { ...moved.payload.metadata, preview_url: `${LAYOUT}/p/deck-other`, preview_presentation_id: 'deck-other' }
  expect(relation(moved) === 'canvas', 'same outline on another preview deck (viewer transport is not content)')
  expect(relation(pilotOutline('p-old', 400, false)) === 'earlier', 'an older, different outline')
  expect(relation(pilotOutline('p-later', 600, false)) === null, 'a later outline is not replaced by the canvas')
  expect(relation(pilotOutline('p-same-later', 600, true)) === 'canvas', 'a later identical copy is the same outline')
  expect(relation({ ...pilotOutline('p-other', 400, false), session_id: 'another-session' }) === null, 'another session\'s outline')
  expect(relation(pilotOutline('p-old', 400, false), null, undefined) === null, 'nothing on the canvas')
  expect(relation(pilotOutline('p-old', 400, false), null, 'p-unknown') === null, 'canvas id not in the transcript: no guess')
  const blank = pilotOutline('p-blank', 400, false); blank.payload.is_blank = true
  expect(relation(blank) === null, 'the blank deck frame')
  expect(relation(chat('c-x', 400, 'x')) === null, 'not an outline')
  return failures
}
{
  // the fixed tree: no failures, with Director's ask-card identity off and on
  for (const env of [{}, { [ASK]: 'true' }]) {
    const failures = foldFailures(createWorld({ env: { ...ON, ...env } }))
    check(assert.deepEqual, failures, [], `(d) ask identity ${env[ASK] ? 'on' : 'off'}`)
  }
  const on = createWorld({ env: ON })
  // the live session: the canvas pairs the live gate with the newest replay, which the transcript does not draw
  const selection = selectIn(on, PILOT)
  check(assert.equal, selection.outline.message_id, 'p-replay-live')
  check(assert.equal, selection.gate.message_id, 'p-gate-live')
  const html = renderList(on, PILOT, { props: { studioOutlineOnCanvas: 'p-replay-live' } }).html
  const cards = cardsOf(html)
  check(assert.deepEqual, cards.map(card => card.titles), [['Pilot Results', PILOT_CHART, 'Pilot Results'], ['📋 Pilot Results', PILOT_CHART, '']],
    'the first outline (replaced) and the first replay (on the canvas); the later identical replays are not drawn')
  check(assert.ok, at(html, 'Replaced by the outline on the canvas.') < at(html, 'Sorry, content generation encountered an error') &&
    at(html, 'Sorry, content generation encountered an error') < at(html, 'The outline is on the canvas.'), 'cards keep their places')
  check(assert.equal, (html.match(/data-studio-director-part="outline-review-canvas-note"/g) ?? []).length, 1)
  // nothing is on the canvas (a build owns it, or the gate was answered): every card is drawn exactly as before the fix
  if (commitAvailable(FIX_BASE)) {
    const prefix = createWorld({ env: ON, base: true, commit: FIX_BASE })
    for (const fixture of FIXTURES) {
      check(assert.equal, sha(renderList(on, fixture).html), sha(renderList(prefix, fixture).html), `${fixture.name}: no canvas, == ${FIX_BASE}`)
      const id = selectIn(on, fixture)?.outline.message_id
      // the approval cards and the rest of the transcript: unchanged while the canvas is up
      const rest = html => html.replace(/<section data-studio-director-part="outline-(?:history-)?review"[\s\S]*?<\/section>/g, '<outline/>')
      check(assert.equal, rest(renderList(on, fixture, { props: { studioOutlineOnCanvas: id } }).html),
        rest(renderList(prefix, fixture, { props: { studioOutlineOnCanvas: id } }).html), `${fixture.name}: only outline cards change`)
    }
    // #364's own case (the outline on the canvas is the drawn frame): byte for byte as before
    check(assert.equal, sha(renderList(on, PENDING, { props: { studioOutlineOnCanvas: 'su-strawman' } }).html),
      sha(renderList(prefix, PENDING, { props: { studioOutlineOnCanvas: 'su-strawman' } }).html), `PENDING on the canvas == ${FIX_BASE}`)

    // mutation check 1: the merged #364 tree fails (d), showing the live symptom: both cards full size, no canvas note
    check(assert.ok, foldFailures(prefix).length > 0, `${FIX_BASE} fails (d)`)
    const before = cardsOf(renderList(prefix, PILOT, { props: { studioOutlineOnCanvas: 'p-replay-live' } }).html)
    check(assert.deepEqual, before.map(card => [card.label, card.canvasNote, card.folded]), [['Presentation outline', false, false], ['Presentation outline', false, false]],
      `${FIX_BASE}: the live bug reproduced (two full outline cards, none folded)`)
    check(assert.equal, cardsOf(renderList(prefix, PENDING_REOPENED, { props: { studioOutlineOnCanvas: selectIn(prefix, PENDING_REOPENED).outline.message_id } }).html)[0].canvasNote, false,
      `${FIX_BASE}: even a clean pending outline loses the fold once Director replays it`)
  } else console.log(`  SKIP pre-fix comparisons: ${FIX_BASE} is not in this clone`)

  // mutation check 2: each in-memory mutant of the fix fails (d)
  const LIB = 'lib/director-history-presentation.ts', LIST = 'components/builder/message-list.tsx', CARD = 'components/builder/chat/studio-outline-card.tsx'
  const mutants = [
    ['id link only (the #364 rule)', LIB, "  if (outlineContent(card.payload as Record<string, any>) === outlineContent(canvas.payload as Record<string, any>)) return 'canvas'\n", ''],
    ['content compared with the viewer transport', LIB, "if (outlineContent(card.payload as Record<string, any>) === outlineContent(canvas.payload as Record<string, any>))",
      'if (JSON.stringify(card.payload) === JSON.stringify(canvas.payload))'],
    ['older outlines left full size', LIB, "time <= canvasTime ? 'earlier' : null", 'time <= canvasTime ? null : null'],
    ['later outlines marked replaced', LIB, "time <= canvasTime ? 'earlier' : null", "true ? 'earlier' : null"],
    ['any session', LIB, '  if (card.session_id && canvas.session_id && card.session_id !== canvas.session_id) return null\n', ''],
    ['MessageList drops the replaced mark', LIST, "canvasSuperseded: relation === 'earlier'", 'canvasSuperseded: false'],
    ['MessageList keeps the id link', LIST, "onCanvas: relation === 'canvas'", 'onCanvas: message.message_id === studioOutlineOnCanvas'],
    ['card does not fold a replaced outline', CARD, "</> : canvasSuperseded ? <>", '</> : false ? <>'],
  ]
  for (const [name, rel, from, to] of mutants) {
    const original = read(rel)
    check(assert.equal, original.split(from).length, 2, `mutant "${name}": its target occurs once`)
    const failures = foldFailures(createWorld({ env: ON, overrides: { [rel]: original.replace(from, to) } }))
    check(assert.ok, failures.length > 0, `mutant "${name}" is caught`)
  }
  console.log(`  (d) fold rule: ${mutants.length} mutants caught${commitAvailable(FIX_BASE) ? `, ${FIX_BASE} reproduces the live bug` : ''}`)
}

// ---------------------------------------------------------------- the canvas view
{
  const { StudioOutlineCanvas } = createWorld({ env: { ...STUDIO, [FLAG]: 'true' } }).load('components/builder/studio-outline-canvas.tsx')
  const payload = PENDING.messages[0].payload
  const html = renderToStaticMarkup(React.createElement(StudioOutlineCanvas, { outline: payload, onApprove() {} }))
  check(assert.match, html, /^<section data-studio-outline-canvas="true" aria-label="Outline review">/)
  check(assert.match, html, /<h2>A clear path through the story\.<\/h2>/)
  check(assert.match, html, /<p>7 slides · mid-size retail company&#x27;s leadership team · Review the structure before we build\.<\/p>/)
  check(assert.match, html, />Slide 01 \/ 07<\/span><h3>AI Demand Forecasting for Retail<\/h3>/)
  check(assert.equal, (html.match(/<button type="button" aria-pressed="(true|false)">/g) ?? []).length, 7, 'one row per slide')
  check(assert.equal, (html.match(/aria-pressed="true"/g) ?? []).length, 1, 'the first slide selected')
  check(assert.match, html, /data-studio-outline-canvas-part="purpose">[\s\S]*?<span>Speaker notes for slide 1<\/span>/, 'purpose: the slide narrative')
  check(assert.match, html, /<button type="button" data-studio-outline-canvas-part="approve">Approve &amp; build<svg/)
  const withContext = renderToStaticMarkup(React.createElement(StudioOutlineCanvas, { outline: payload, contextByIndex: { 0: { slide_index: 0, key_message: 'Forecasts that see demand coming' } }, onApprove() {} }))
  check(assert.match, withContext, /<span>Forecasts that see demand coming<\/span>/, 'purpose: the key message when Director sent one')
  const noAudience = { ...payload, metadata: { ...payload.metadata, target_audience: '' } }
  check(assert.match, renderToStaticMarkup(React.createElement(StudioOutlineCanvas, { outline: noAudience, onApprove() {} })), /<p>7 slides · Review the structure/)
  const css = read('components/builder/studio-outline-canvas.css')
  for (const rule of css.split('}').map(r => r.trim()).filter(r => r && !r.startsWith('@') && !r.startsWith('/*') && !/^(from|to)\b/.test(r)))
    check(assert.match, rule.replace(/^[\s\S]*?\*\/\s*/, ''), /data-studio-outline-canvas|outline-review-(canvas-note|superseded-note|details|deck-count)|^\s*\[data-studio-outline-canvas/, `scoped CSS: ${rule.slice(0, 60)}`)
}

// ---------------------------------------------------------------- PresentationArea knows nothing of it (the page mounts the overlay)
check(assert.doesNotMatch, read('components/builder/presentation-area.tsx'), /outline-?canvas|OutlineCanvas/i, 'PresentationArea is not part of this change')

// ---------------------------------------------------------------- page wiring
{
  const page = (await import('./studio-later-changes.mjs')).stripLaterChanges('app/builder/page.tsx', read('app/builder/page.tsx')) // LATER-CHANGES: registry read (STRAWMAN-STAGE): the lines of the changes registered after this one come out of the page first
  check(assert.ok, page.includes(`  const studioOutlineCanvas = selectStudioOutlineCanvas({
    enabled: STUDIO_OUTLINE_CANVAS_ENABLED && studioShell,
    blocked: templateModeOn || isGeneratingFinal || session.isLoadingSession || STUDIO_OUTLINE_CANVAS_BUSY_PHASES.has(buildNarration.phase),
    messages, answeredIds: session.answeredActionsRef.current, userTurns: session.userMessages,
    sessionId: currentSessionId, locked: approvalGatesLocked,
  })`), 'selection: the chat card\'s own inputs (messages, answered keys, user turns, session, build lock)')
  check(assert.ok, page.includes(`                        onActionClick={handleActionClick}
                        askGatesLocked={approvalGatesLocked}
                        studioOutlineOnCanvas={studioOutlineCanvas?.outline.message_id}`), 'MessageList: the chat card and the canvas share handleActionClick')
  check(assert.ok, page.includes(`            data-studio-canvas-covered={studioCanvasCovered ? "true" : undefined}
            data-studio-outline-canvas-open={studioOutlineCanvas ? "true" : undefined}`), 'the presentation column says when the outline is up')
  check(assert.ok, page.includes(`            onTemplateBlueprintChange={handleTemplateBlueprintChange}
          />
          )}
          {studioOutlineCanvas && <StudioOutlineCanvas key={studioOutlineCanvas.outline.message_id}
            outline={studioOutlineCanvas.outline.payload} contextByIndex={slideContextByIndex}
            onApprove={() => handleActionClick(studioOutlineCanvas.approve, studioOutlineCanvas.gate.message_id, studioOutlineCanvas.answerKey)} />}
          </div>`), 'Approve & build = handleActionClick(the gate\'s approve action, the gate id, its answer key), over the presentation column')
  check(assert.equal, (page.match(/handleActionClick\(/g) ?? []).length, 1, 'no other caller')
  check(assert.equal, (page.match(/studioOutlineCanvas/g) ?? []).length, 9, 'no other use of the selection')
  // off: the selection is null, so the column attribute is absent, no overlay mounts and MessageList gets undefined
  const off = createWorld().load('lib/studio-outline-canvas.ts')
  check(assert.equal, off.selectStudioOutlineCanvas({ enabled: off.STUDIO_OUTLINE_CANVAS_ENABLED && true, blocked: false, messages: PENDING.messages,
    answeredIds: new Set(), userTurns: PENDING.userMessages, sessionId: SID }), null, 'flag off: no selection even with a live gate')
  const busy = [...off.STUDIO_OUTLINE_CANVAS_BUSY_PHASES].sort()
  check(assert.deepEqual, busy, ['building', 'error', 'finalizing', 'paused', 'qa', 'stopped'])
}

// ---------------------------------------------------------------- .env.example and package.json
check(assert.match, read('.env.example'), /^NEXT_PUBLIC_STUDIO_OUTLINE_CANVAS="false"$/m, 'documented in .env.example, default off')
check(assert.equal, JSON.parse(read('package.json')).scripts['test:studio-outline-canvas'], 'node scripts/test-studio-outline-canvas.mjs')

console.log(`Studio outline canvas: ${checks} checks passed; no network.`)
