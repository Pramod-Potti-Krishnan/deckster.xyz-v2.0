// FRONTEND-1 (chat parity round C2, Studio half): proof of NEXT_PUBLIC_STUDIO_CHAT_PARITY_DECKOPS and NEXT_PUBLIC_STUDIO_CHAT_PARITY_PUBLISH (each the exact string "true", default off, build-time).
//
// WHAT IS PROVED
//   0. The Director contract, read from Director's own code when the repo is on this machine (origin/uat @ DIRECTOR_REV): the action lists, the caps, the read-only set, the extra error codes, the delete token, the layout list, the name
//      bound, the 25 s windows, the result fields; every file:line the libs cite holds the text they say it holds. (Skipped with a NOTE, never failed, when the repo is absent: a CI checkout has no Director.)
//   1. The pure part (lib/studio-chat-parity-c2.ts): flags and caps (the cap is advertised only with its flag, after the three older groups' caps), the refusals, every action's args (positives and negatives), the evidence helpers.
//   2. deck_ops, Director frame by frame, on a fake viewer / page: each action maps to the right handler with the right args; a write is `done` only on evidence; stale / reordered targets are refused; a build, a paused tab, a template or a
//      pending slide write waits; the delete never runs without Director's card token; every answer has the shape Director's result_fields reads.
//   3. publish, the same, against a fake of the Publish dialog's own endpoints: the requests are the dialog's own (no wizard, no narration call), a first publish never overwrites a live record, a republish sends no settings, a passcode /
//      restricted / slug / link never gets through, a link is never sent back to Director, a blocked clipboard or popup is not a success.
//   4. The entry point (lib/studio-chat-parity-c2-run.ts): owner check, no deck, invalid args, a group whose flag is off, the budget, a thrown error.
//   5. The wiring, run for real from the marked lines: the viewer's one effect (components/presentation-viewer.tsx) and the Builder page's runner block and routing line (app/builder/page.tsx) on fakes of their scope.
//   6. The sources: every marked line, the strip gives each touched file its base back byte for byte, flag off is the base, .env.example, the registry, the two older proofs taught, the scope (read from the COMMITTED diff only).
//   7. Mutants: each must be caught.
//
//   node scripts/test-studio-chat-parity-c2.mjs
//
// Offline: no socket, no fetch (every fetch here is a fake); git is read only for 0 and 6.
process.env.NODE_ENV = 'production'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

setTimeout(() => { process.stderr.write('[watchdog] test-studio-chat-parity-c2 stalled for 240 s; exit 124\n'); process.exit(124) }, Number(process.env.STUDIO_PROOF_TRACE_WATCHDOG_MS) || 240_000).unref()

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = rel => fs.readFileSync(path.join(repo, rel), 'utf8')
const registry = await import('./studio-later-changes.mjs')
const stripModule = await import('./studio-chat-parity-c2-strip.mjs')
const { BASE_COMMIT, CHAT_PARITY_C2_FILES, CHAT_PARITY_C2_NEW_FILES, CHAT_PARITY_C2_SCOPE_FILES, CHAT_PARITY_C2_ENV_BLOCK, CHAT_PARITY_C2_SUBJECT, CHAT_PARITY_C2_MARKER_RE } = stripModule
const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 28, timeout: 60_000 })
const baseCache = new Map()
const baseText = rel => { if (!baseCache.has(rel)) baseCache.set(rel, git('show', `${BASE_COMMIT}:${rel}`)); return baseCache.get(rel) }
let passed = 0, failed = 0
async function check(label, fn) {
  try { await fn(); passed++; console.log(`  ok   ${label}`) } catch (error) { failed++; console.log(`  FAIL ${label}\n       ${String(error?.message ?? error).split('\n').join('\n       ')}`) }
}
async function throws(fn) { try { await fn(); return false } catch { return true } }
const plain = value => JSON.parse(JSON.stringify(value))

const PARITY = 'lib/studio-chat-parity.ts', C2 = 'lib/studio-chat-parity-c2.ts', DECKOPS = 'lib/studio-chat-parity-deckops.ts', PUBLISH = 'lib/studio-chat-parity-publish.ts', RUN = 'lib/studio-chat-parity-c2-run.ts'
const RUNNERS = 'lib/studio-chat-parity-runners.ts', DUP = 'lib/studio-duplicate-deck.ts', PAGE = 'app/builder/page.tsx', VIEWER = 'components/presentation-viewer.tsx', HOOK = 'hooks/use-deckster-websocket-v2.ts'
const ENV = '.env.example', REGISTRY = 'scripts/studio-later-changes.mjs', STRIP = 'scripts/studio-chat-parity-c2-strip.mjs', SELF = 'scripts/test-studio-chat-parity-c2.mjs', VOICE_CALL = 'scripts/test-studio-voice-call.mjs', OLD_PROOF = 'scripts/test-studio-chat-parity.mjs'
const FLAG_DECKOPS = 'NEXT_PUBLIC_STUDIO_CHAT_PARITY_DECKOPS', FLAG_PUBLISH = 'NEXT_PUBLIC_STUDIO_CHAT_PARITY_PUBLISH'

// ---- the TS modules, transpiled into a bare function scope with a fake process ----------------------------------------------------------------
function compile(text, fileName) {
  const out = ts.transpileModule(text, { fileName, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, isolatedModules: true } })
  const errors = (out.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error)
  if (errors.length) throw new Error(`${fileName} does not transpile: ${ts.flattenDiagnosticMessageText(errors[0].messageText, '\n')}`)
  return out.outputText
}
/** One module: `requires` maps an import specifier to its exports; an unlisted import is an error (the pure files must not grow imports). */
function loadModule(text, fileName, requires = {}, env = {}, scope = {}) {
  const module = { exports: {} }
  const require = name => { if (name in requires) return requires[name]; throw new Error(`${fileName}: unexpected import ${name}`) }
  const names = ['module', 'exports', 'require', 'process', ...Object.keys(scope)]
  new Function(...names, compile(text, fileName))(module, module.exports, require, { env }, ...Object.values(scope))
  return module.exports
}
const texts = Object.fromEntries([PARITY, C2, DECKOPS, PUBLISH, RUN, RUNNERS, DUP, PAGE, VIEWER, HOOK, ENV, REGISTRY, STRIP, SELF, VOICE_CALL, OLD_PROOF].map(rel => [rel, read(rel)]))
const ALL_ON = { [FLAG_DECKOPS]: 'true', [FLAG_PUBLISH]: 'true' }
function loadAll(t = texts, env = ALL_ON, scope = {}) {
  const parity = loadModule(t[PARITY], PARITY, {}, env)
  const dup = loadModule(t[DUP], DUP)
  const c2 = loadModule(t[C2], C2, { '@/lib/studio-chat-parity': parity })
  const deckops = loadModule(t[DECKOPS], DECKOPS, { '@/lib/studio-chat-parity-c2': c2, '@/lib/studio-duplicate-deck': dup, '@/lib/studio-chat-parity': parity })
  const publish = loadModule(t[PUBLISH], PUBLISH, { '@/lib/studio-chat-parity-c2': c2, '@/lib/studio-chat-parity': parity })
  const runners = loadModule(t[RUNNERS], RUNNERS, { '@/lib/studio-chat-parity': parity, '@/lib/studio-chat-parity-themes': {}, '@/lib/studio-chat-parity-identity': {}, '@/lib/studio-chat-parity-templates': {} }, {}, { setTimeout, clearTimeout })
  const run = loadModule(t[RUN], RUN, { '@/lib/studio-chat-parity-runners': runners, '@/lib/studio-chat-parity': parity, '@/lib/studio-chat-parity-c2': c2, '@/lib/studio-chat-parity-deckops': deckops, '@/lib/studio-chat-parity-publish': publish }, {}, { setTimeout: scope.setTimeout ?? setTimeout, clearTimeout: scope.clearTimeout ?? clearTimeout })
  return { parity, dup, c2, deckops, publish, runners, run, texts: t }
}
const M = loadAll()

// ---- Director's own code, when it is on this machine ----------------------------------------------------------------------------------------------
const DIRECTOR_REV = 'e30b41d4d814ec019394ae5c609d005919410c62' // Director origin/uat at the start of this change
const DIRECTOR_REPO = process.env.DIRECTOR_REPO || path.join(os.homedir(), 'Software/Deckster/backend/director')
const directorText = (() => {
  const cache = new Map()
  return rel => {
    if (cache.has(rel)) return cache.get(rel)
    let text = null
    try { text = execFileSync('git', ['-C', DIRECTOR_REPO, 'show', `${DIRECTOR_REV}:${rel}`], { encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'], timeout: 30_000 }) } catch { text = null }
    cache.set(rel, text); return text
  }
})()
const DECK_PY = 'src/utils/mdc_chat_parity_deck.py', PUBLISH_PY = 'src/utils/mdc_chat_parity_publish.py', ACTION_PY = 'src/utils/mdc_studio_action.py'
const hasDirector = directorText(DECK_PY) !== null && directorText(PUBLISH_PY) !== null && directorText(ACTION_PY) !== null
const pyLine = (rel, n) => (directorText(rel) ?? '').split('\n')[n - 1] ?? ''
/** The quoted tuple / string literals of a python line or block starting at `start` (a regex of the line). */
const pyStrings = (rel, startPattern, endPattern = null) => {
  const lines = (directorText(rel) ?? '').split('\n'); const at = lines.findIndex(line => startPattern.test(line)); assert.ok(at >= 0, `${rel}: ${startPattern} is there`)
  let block = lines[at], i = at
  while (endPattern ? !endPattern.test(lines[i]) : (block.split('(').length > block.split(')').length)) { i++; block += '\n' + lines[i]; if (i - at > 40) break }
  return [...block.matchAll(/"([^"]+)"/g)].map(m => m[1])
}

// ---- fakes ----------------------------------------------------------------------------------------------------------------------------------------
/** Virtual time: wait advances the clock and yields; nothing ever sleeps. */
function clock() { let t = 1_000_000; return { now: () => t, wait: async ms => { t += ms; await Promise.resolve() } } }
function fakeTimers() {
  const pending = new Map(); let id = 0
  return { set: (fn, ms) => { const key = ++id; pending.set(key, { fn, ms }); return key }, clear: key => { pending.delete(key) }, fire: () => { for (const [key, timer] of [...pending]) { pending.delete(key); timer.fn() } }, get count() { return pending.size }, get last() { return [...pending.values()].pop() } }
}

/**
 * A deck world: the slides' ids and layouts, the viewer's selection and state, and a fake viewer / page whose handlers do what the real ones do to that world.
 * `lag` is how many reads pass before an add / layout change shows in the viewer's order (the iframe answering late).
 */
function deckWorld(options = {}) {
  const w = {
    ids: ['s1', 's2', 's3'], layouts: ['H1-structured', 'C1-text', 'C1-text'], current: 0, edit: false, rail: true, ready: true, pending: false, fullscreen: false, fullscreenAllowed: true,
    placeholders: false, orderNull: false, layoutUnreadable: false, lag: 0, nextId: 1, calls: [], gate: { building: false, paused: false, templateMode: false },
    blankAvailable: true, blankStarted: false, ...options,
  }
  let readsLeft = 0, later = null
  const settle = () => { if (later && readsLeft <= 0) { later(); later = null } }
  w.order = () => ({ nativeCount: w.ids.length, currentVisualIndex: w.current, slideIds: [...w.ids] })
  w.readOrder = async () => { if (readsLeft > 0) readsLeft--; settle(); return w.orderNull ? null : w.placeholders ? 'busy' : w.order() }
  w.readLayout = async index => { settle(); return w.layoutUnreadable ? null : w.layouts[index] ?? null }
  w.viewer = {
    addSlide: async (layout, opts) => {
      w.calls.push(['addSlide', layout, opts])
      const apply = () => { const at = Math.min(opts?.position ?? w.ids.length, w.ids.length); w.ids.splice(at, 0, `n${w.nextId++}`); w.layouts.splice(at, 0, layout); w.current = at }
      if (w.lag > 0) { readsLeft = w.lag; later = apply } else apply()
    },
    changeLayout: async (index, layout) => {
      w.calls.push(['changeLayout', index, layout])
      const apply = () => { w.layouts[index] = layout }
      if (w.lag > 0) { readsLeft = w.lag; later = apply } else apply()
    },
    present: async () => { w.calls.push(['present']); if (w.fullscreenAllowed) w.fullscreen = true },
    setMode: async edit => { w.calls.push(['setMode', edit]); w.edit = edit },
    setRail: visible => { w.calls.push(['setRail', visible]); w.rail = visible },
    state: () => ({ ready: w.ready, mutationPending: w.pending, editMode: w.edit, rail: w.rail }),
  }
  w.goTo = async index => { w.calls.push(['goTo', index]); w.current = index }
  w.sessionCalls = []
  w.session = {
    rename: async (id, name) => { w.sessionCalls.push(['rename', id, name]); return w.renameAnswer === undefined ? name : w.renameAnswer },
    deleteDeck: async id => { w.sessionCalls.push(['deleteDeck', id]); return w.deleteAnswer === undefined ? true : w.deleteAnswer },
    startNew: () => { w.sessionCalls.push(['startNew']) },
    duplicate: w.duplicate === undefined ? null : w.duplicate,
  }
  return w
}
function deckDeps(w, clk = clock(), overrides = {}) {
  return {
    sessionId: () => 'sess-1', viewer: () => (w.noViewer ? null : w.viewer), goToSlide: () => (w.noGoTo ? null : w.goTo), readOrder: w.readOrder, readLayout: w.readLayout,
    blankOptions: position => ({ position, backgroundColor: '#ffffff' }), gate: () => w.gate, fullscreen: () => w.fullscreen,
    blank: w.noBlank ? null : { available: () => w.blankAvailable, start: () => { w.calls.push(['startBlank']); if (w.blankWorks !== false) w.blankStarted = true }, started: () => w.blankStarted },
    session: w.session, wait: clk.wait, now: clk.now, ...overrides,
  }
}
const target = (index = 1, w = null) => ({ slide_index: index, slide_id: ['s1', 's2', 's3'][index], expected_slide_count: 3 })
/** A request as Director frames it (mdc_studio_action.send :161-204): the frame's payload read by the real lib. */
let requestCounter = 0
function frame(group, action, args, { presentationId = 'deck-1', sessionId = 'sess-1' } = {}) {
  requestCounter++
  return { type: 'studio_action', message_id: `msg_sact_${requestCounter}`, session_id: sessionId, timestamp: '2026-11-10T00:00:00Z', role: 'assistant',
    payload: { request_id: `sa_${String(requestCounter).padStart(12, '0')}`, group, action, presentation_id: presentationId, args, label: action.replace(/_/g, ' ') } }
}
const owner = { sessionId: 'sess-1', isCurrent: () => true }
const displayed = (extra = {}) => () => ({ sessionId: 'sess-1', deckOwnerSessionId: 'sess-1', presentationId: 'deck-1', epoch: 1, ...extra })

/** The fields Director reads from a result (mdc_studio_action.result_fields :299, ported): status is one of done / failed / dismissed; the code only a contract value. */
const DIRECTOR_ERROR_CODES = ['not_owner', 'viewer_unavailable', 'flag_off', 'not_found', 'locked', 'invalid_args', 'write_failed', 'timeout', 'theme_failed', 'theme_locked', 'theme_auto', 'invalid_url', 'generate_failed']
const DECK_EXTRA = ['no_deck', 'busy', 'unsupported', 'stale_target', 'fullscreen_denied', 'name_taken']
const PUBLISH_EXTRA = ['no_deck', 'not_published', 'passcode_required', 'browser_blocked', 'state_changed', 'snapshot_failed', 'unsupported']
function directorReads(group, resultFrame, requestId) {
  const body = resultFrame.payload
  assert.equal(resultFrame.type, 'studio_action_result', 'the result frame type')
  assert.equal(body.request_id, requestId, 'the result carries the request id')
  assert.ok(['done', 'failed', 'dismissed'].includes(body.status), `a status Director knows: ${body.status}`)
  if (body.status === 'done') assert.equal(body.error_code, null, 'a done result has no error code')
  else { const known = [...DIRECTOR_ERROR_CODES, ...(group === 'deck_ops' ? DECK_EXTRA : PUBLISH_EXTRA)]; assert.ok(known.includes(body.error_code), `a code Director knows for ${group}: ${body.error_code}`) }
  assert.deepEqual(Object.keys(body).sort(), ['error_code', 'request_id', 'status'], 'only the three fields (detail is ignored by Director, and never carries a link, a name or a count here)')
  return { status: body.status, code: body.error_code }
}
/** The whole path: frame -> the lib's request -> the entry point -> the result frame, as the page does it. */
async function runFrame(f, deps, { ownerRecord = owner, timers = null, mods = M } = {}) {
  const request = mods.parity.chatParityRequest(f)
  assert.ok(request, 'the lib reads the frame')
  const run = timers ? loadAll(mods.texts, ALL_ON, { setTimeout: timers.set, clearTimeout: timers.clear }).run : mods.run
  const outcome = await run.runChatParityC2Action(request, ownerRecord, deps, f)
  const resultFrame = mods.parity.chatParityResultFrame(outcome.data)
  return { ...directorReads(request.group, resultFrame, request.requestId), outcome, resultFrame }
}
const deckFrame = (action, args, opts) => frame('deck_ops', action, args, opts)
const publishFrame = (action, args, opts) => frame('publish', action, args, opts)

// ============================================================================================================================================
// 0. The Director contract
// ============================================================================================================================================
function contractChecks() {
  if (!hasDirector) { console.log(`NOTE contract: Director's repo is not at ${DIRECTOR_REPO} (or ${DIRECTOR_REV.slice(0, 8)} is not in it): the contract is checked against the copies in this file only`); return }
  // deck_ops: mdc_chat_parity_deck.py
  assert.deepEqual(pyStrings(DECK_PY, /^CLIENT_CAPS = /), ['mdc1', 'deckops1'], 'deck.py:19 the caps Director needs (mdc1 AND deckops1)')
  assert.equal(M.parity.CHAT_PARITY_C2_GROUP_CAPS.deck_ops, 'deckops1')
  const caps = pyStrings(DECK_PY, /^CAPABILITIES = \(/, /\)\s*$/)
  assert.deepEqual(caps, ['start_blank_canvas', 'add_blank_slide', 'change_layout', 'goto_slide', 'rename_deck', 'duplicate_deck', 'delete_deck', 'present', 'view_mode', 'slide_rail'], 'deck.py:20-21 the capabilities')
  const sent = [...caps.slice(0, 8), 'set_view_mode', 'set_slide_rail'] // deck.py:22-23 ACTION_CAPABILITIES: the first eight keys, then set_view_mode and set_slide_rail
  assert.match(pyLine(DECK_PY, 22), /CAPABILITIES\[:8\]/); assert.match(pyLine(DECK_PY, 23), /set_view_mode="view_mode", set_slide_rail="slide_rail"/)
  assert.deepEqual([...M.c2.CHAT_PARITY_C2_ACTIONS.deck_ops].sort(), [...sent].sort(), 'the actions Studio runs are exactly the actions Director sends (deck.py:22-23)')
  assert.deepEqual(pyStrings(DECK_PY, /^READ_ONLY_ACTIONS = /), ['goto_slide', 'present', 'set_view_mode', 'set_slide_rail'], 'deck.py:24 read-only')
  assert.deepEqual(pyStrings(DECK_PY, /^EXTRA_ERROR_CODES = /), DECK_EXTRA, 'deck.py:26 the extra error codes')
  assert.match(pyLine(DECK_PY, 32), /NAME_MAX_CHARS = 150/); assert.equal(M.c2.CHAT_PARITY_C2_NAME_MAX, 150)
  const layouts = [...(directorText(DECK_PY).split('LAYOUT_LABELS = {')[1].split('\n}')[0]).matchAll(/"([A-Z]\d-[a-z-]+)":/g)].map(m => m[1])
  assert.deepEqual([...M.c2.CHAT_PARITY_C2_LAYOUTS], layouts, 'deck.py:38-50 the 19 layout codes, in Director\'s order')
  assert.match(pyLine(DECK_PY, 265), /args\.update\(layout=layout, preserve_content=True\)/, 'deck.py:265 change_layout sends preserve_content: True')
  assert.match(pyLine(DECK_PY, 279), /position="end", insertion_index=len\(_slides\(session\)\)/, 'deck.py:279 add at the end: insertion_index is the slide count')
  assert.match(pyLine(DECK_PY, 285), /insertion_index=target\["slide_index"\] \+ \(position == "after"\)/, 'deck.py:285 before / after: the index (+1 after)')
  assert.match(pyLine(DECK_PY, 327), /token = "dd_" \+ uuid\.uuid4\(\)\.hex\[:24\]/, 'deck.py:327 the delete token'); assert.match(pyLine(DECK_PY, 388), /"delete_deck", \{"confirmed": True, "confirmation_id": deleteCard\}/, 'deck.py:388 the delete args')
  assert.match(pyLine(DECK_PY, 349), /if clicked is not True:/, 'deck.py:349 only a structured click confirms a delete')
  assert.match(pyLine(DECK_PY, 324), /async def _ask_delete/); assert.match(pyLine(DECK_PY, 426), /def closing_text/)
  // publish: mdc_chat_parity_publish.py
  assert.deepEqual(pyStrings(PUBLISH_PY, /^CLIENT_CAPS = /), ['mdc1', 'publish1'], 'publish.py:24 the caps')
  assert.equal(M.parity.CHAT_PARITY_C2_GROUP_CAPS.publish, 'publish1')
  const publishActions = pyStrings(PUBLISH_PY, /^ACTION_CAPABILITIES = \{/, /^\}/).filter((_, i) => i % 2 === 0)
  assert.deepEqual([...M.c2.CHAT_PARITY_C2_ACTIONS.publish].sort(), [...publishActions].sort(), 'publish.py:29-37 the publish actions')
  assert.deepEqual(pyStrings(PUBLISH_PY, /^READ_ACTIONS = /), ['open_publish_link', 'copy_publish_link'], 'publish.py:38 the read actions')
  assert.deepEqual(pyStrings(PUBLISH_PY, /^EXTRA_ERROR_CODES = \(/, /^\)/), PUBLISH_EXTRA, 'publish.py:51-54 the extra error codes')
  assert.match(pyLine(PUBLISH_PY, 47), /RESULT_TTL_SECONDS = 25\.0/); assert.match(pyLine(ACTION_PY, 47), /DEFAULT_TIMEOUT_SECONDS = 25\.0/)
  assert.ok(M.deckops.CHAT_PARITY_DECKOPS_BUDGET_MS < 25_000 && M.publish.CHAT_PARITY_PUBLISH_BUDGET_MS < 25_000, 'Studio answers inside Director\'s 25 s')
  assert.match(pyLine(PUBLISH_PY, 465), /if clicked is not True:/, 'publish.py:465 only a structured click confirms a publish action'); assert.match(pyLine(PUBLISH_PY, 394), /async def _ask/)
  const bounds = directorText(PUBLISH_PY).match(/\{"qaDailyCap": \((\d+), (\d+)\), "qaMonthlyCap": \((\d+), (\d+)\),\s*"narrationBudgetMinutes": \((\d+), (\d+)\), "qaReserveMinutes": \((\d+), (\d+)\)\}/)
  assert.ok(bounds, 'publish.py:302-303 the bounds are there'); const b = bounds.slice(1).map(Number)
  assert.deepEqual(plain(M.c2.CHAT_PARITY_C2_PUBLISH_BOUNDS), { qaDailyCap: [b[0], b[1]], qaMonthlyCap: [b[2], b[3]], narrationBudgetMinutes: [b[4], b[5]], qaReserveMinutes: [b[6], b[7]] }, 'the integer bounds are Director\'s')
  assert.match(pyLine(PUBLISH_PY, 310), /\{"visibility": "unlisted", "allowPdf": False, "allowPptx": False, \*\*provided\}/, 'publish.py:310 the safe defaults of a first publish')
  assert.match(pyLine(PUBLISH_PY, 315), /qaEnabled/); assert.match(pyLine(PUBLISH_PY, 322), /qaReserveMinutes/)
  // the shared plumbing: mdc_studio_action.py
  assert.deepEqual(pyStrings(ACTION_PY, /^ERROR_CODES = \(/, /^$/).slice(0, 13).concat([]).every(code => DIRECTOR_ERROR_CODES.includes(code)), true, 'action.py:53 the shared error codes')
  assert.match(pyLine(ACTION_PY, 50), /STATUSES = \(STATUS_DONE, "failed", "dismissed"\)/)
  assert.match(pyLine(ACTION_PY, 299), /def result_fields/); { const body = directorText(ACTION_PY).split('def result_fields')[1].split('def ')[0]; for (const key of ['request_id', 'status', 'error_code']) assert.ok(body.includes(`body.get("${key}")`), `action.py:299-311 ${key} is read`) }
  assert.match(pyLine(ACTION_PY, 172), /create_studio_action\(session_id=session\.id, group=group, action=action, presentation_id=session\.presentation_id or ""/, 'action.py:172 the frame: group, action, presentation_id (empty when there is no deck), args, label')
}

// ============================================================================================================================================
// 1. The pure part
// ============================================================================================================================================
function pureChecks(mods = M, t = texts) {
  const { parity, c2 } = mods
  // -- flags and caps ---------------------------------------------------------------------------------------------------------------------
  const off = loadModule(t[PARITY], PARITY, {}, {})
  for (const [value, want] of [[undefined, false], ['false', false], ['TRUE', false], ['1', false], [' true', false], ['yes', false], ['', false], ['true', true]]) {
    assert.equal(loadModule(t[PARITY], PARITY, {}, { [FLAG_DECKOPS]: value }).STUDIO_CHAT_PARITY_DECKOPS_ENABLED, want, `deckops flag ${JSON.stringify(value)}`)
    assert.equal(loadModule(t[PARITY], PARITY, {}, { [FLAG_PUBLISH]: value }).STUDIO_CHAT_PARITY_PUBLISH_ENABLED, want, `publish flag ${JSON.stringify(value)}`)
  }
  assert.deepEqual([off.STUDIO_CHAT_PARITY_DECKOPS_ENABLED, off.STUDIO_CHAT_PARITY_PUBLISH_ENABLED, off.STUDIO_CHAT_PARITY_C2_ANY_ENABLED, off.STUDIO_CHAT_PARITY_ANY_ENABLED], [false, false, false, false], 'unset: nothing on')
  assert.deepEqual([...off.CHAT_PARITY_CAPS], [], 'flag off: no cap at all, so client_caps is exactly what it was (the hook adds caps only when this list is not empty)')
  const caps = env => [...loadModule(t[PARITY], PARITY, {}, env).CHAT_PARITY_CAPS]
  assert.deepEqual(caps({ [FLAG_DECKOPS]: 'true' }), ['deckops1'], 'deckops on: deckops1 only')
  assert.deepEqual(caps({ [FLAG_PUBLISH]: 'true' }), ['publish1'], 'publish on: publish1 only')
  assert.deepEqual(caps(ALL_ON), ['deckops1', 'publish1'], 'both on: group order')
  assert.deepEqual(caps({ [FLAG_DECKOPS]: 'yes', [FLAG_PUBLISH]: '1' }), [], 'anything but "true" is off')
  const three = { NEXT_PUBLIC_STUDIO_CHAT_PARITY_THEMES: 'true', NEXT_PUBLIC_STUDIO_CHAT_PARITY_IDENTITY: 'true', NEXT_PUBLIC_STUDIO_CHAT_PARITY_TEMPLATES: 'true' }
  assert.deepEqual(caps({ ...three, ...ALL_ON }), ['themes1', 'identity1', 'templates1', 'deckops1', 'publish1'], 'after the three older groups\' caps')
  assert.deepEqual(caps(three), ['themes1', 'identity1', 'templates1'], 'the older groups alone: exactly their caps (nothing of C2)')
  assert.equal(loadModule(t[PARITY], PARITY, {}, { [FLAG_DECKOPS]: 'true' }).STUDIO_CHAT_PARITY_ANY_ENABLED, true, 'a C2 flag alone takes the request frame out of band')
  assert.equal(loadModule(t[PARITY], PARITY, {}, { NEXT_PUBLIC_STUDIO_CHAT_PARITY_THEMES: 'true' }).STUDIO_CHAT_PARITY_C2_ANY_ENABLED, false, 'an older flag does not turn C2 on')
  assert.deepEqual({ ...parity.CHAT_PARITY_C2_GROUP_CAPS }, { deck_ops: 'deckops1', publish: 'publish1' }); assert.ok(Object.isFrozen(parity.CHAT_PARITY_C2_FLAGS) && Object.isFrozen(parity.CHAT_PARITY_C2_GROUP_CAPS), 'frozen')
  assert.deepEqual(parity.chatParityC2Caps({ deck_ops: true, publish: false }), ['deckops1']); assert.deepEqual(parity.chatParityC2Caps({ deck_ops: 1, publish: 'true' }), [], 'only boolean true counts')
  assert.deepEqual(parity.addChatParityCaps({ client_caps: ['mdc1', 'themes1'] }, ['deckops1', 'publish1']), { client_caps: ['mdc1', 'themes1', 'deckops1', 'publish1'] }, 'added after whatever caps are there (mdc1 first, which Director needs as well)')
  // the three older groups are not touched
  assert.deepEqual(Object.keys(parity.CHAT_PARITY_ACTIONS).sort(), ['identity', 'templates', 'themes'], 'CHAT_PARITY_ACTIONS still lists exactly the three older groups')
  assert.deepEqual(Object.keys(parity.CHAT_PARITY_FLAGS).sort(), ['identity', 'templates', 'themes'], 'CHAT_PARITY_FLAGS too')
  assert.equal(parity.chatParityRefusal({ requestId: 'r', group: 'deck_ops', action: 'goto_slide', presentationId: null, args: {}, label: '' }), 'flag_off', 'the older refusal does not know the C2 groups: flag_off (the page routes them before it)')
  // -- the actions and the refusals ------------------------------------------------------------------------------------------------------
  assert.deepEqual([...c2.CHAT_PARITY_C2_ACTIONS.deck_ops], ['start_blank_canvas', 'add_blank_slide', 'change_layout', 'goto_slide', 'rename_deck', 'duplicate_deck', 'delete_deck', 'present', 'set_view_mode', 'set_slide_rail'])
  assert.deepEqual([...c2.CHAT_PARITY_C2_ACTIONS.publish], ['publish_deck', 'republish_deck', 'unpublish_deck', 'rotate_publish_link', 'configure_publish', 'open_publish_link', 'copy_publish_link'])
  assert.deepEqual([...c2.CHAT_PARITY_C2_READ_ONLY].sort(), ['copy_publish_link', 'goto_slide', 'open_publish_link', 'present', 'set_slide_rail', 'set_view_mode'], 'the read-only set is Director\'s')
  assert.deepEqual([...c2.CHAT_PARITY_C2_CARD_ACTIONS].sort(), ['configure_publish', 'delete_deck', 'publish_deck', 'republish_deck', 'rotate_publish_link', 'unpublish_deck'], 'the actions behind Director\'s click card')
  assert.ok([...c2.CHAT_PARITY_C2_CARD_ACTIONS].every(a => !c2.CHAT_PARITY_C2_READ_ONLY.has(a)), 'no action is both read-only and behind a card')
  const req = (group, action) => ({ requestId: 'r', group, action, presentationId: 'd', args: {}, label: '' })
  assert.equal(c2.isChatParityC2Group('deck_ops') && c2.isChatParityC2Group('publish'), true); for (const g of ['themes', 'deckops', 'Publish', '', undefined, null, 5]) assert.equal(c2.isChatParityC2Group(g), false, `not a C2 group: ${String(g)}`)
  assert.equal(c2.chatParityC2Refusal(req('deck_ops', 'goto_slide'), { deck_ops: false, publish: true }), 'flag_off', 'group off')
  assert.equal(c2.chatParityC2Refusal(req('publish', 'copy_publish_link'), { deck_ops: true, publish: false }), 'flag_off', 'the other group on does not help')
  assert.equal(c2.chatParityC2Refusal(req('themes', 'save_theme'), { deck_ops: true, publish: true }), 'flag_off', 'not a C2 group')
  assert.equal(c2.chatParityC2Refusal(req('deck_ops', 'goto_slide'), { deck_ops: 'true', publish: true }), 'flag_off', 'only boolean true is on')
  assert.equal(c2.chatParityC2Refusal(req('deck_ops', 'copy_publish_link'), { deck_ops: true, publish: true }), 'unsupported', 'an action of the other group')
  assert.equal(c2.chatParityC2Refusal(req('deck_ops', 'view_mode'), { deck_ops: true, publish: true }), 'unsupported', 'view_mode is a capability key, not a frame action (Director sends set_view_mode)')
  assert.equal(c2.chatParityC2Refusal(req('publish', 'delete_deck'), { deck_ops: true, publish: true }), 'unsupported')
  assert.equal(c2.chatParityC2Refusal(req('deck_ops', 'goto_slide'), { deck_ops: true, publish: false }), null); assert.equal(c2.chatParityC2Refusal(req('publish', 'configure_publish'), { deck_ops: false, publish: true }), null)
  assert.equal(c2.chatParityC2Refusal(req('deck_ops', 'goto_slide')), null, 'the default flags are this build\'s (both on here)')
  // -- the result ------------------------------------------------------------------------------------------------------------------------
  assert.deepEqual(plain(c2.chatParityC2Result('sa_1', 'done')), { request_id: 'sa_1', status: 'done', error_code: null })
  assert.deepEqual(plain(c2.chatParityC2Result('sa_1', 'done', 'busy')), { request_id: 'sa_1', status: 'done', error_code: null }, 'a done result carries no code')
  assert.deepEqual(plain(c2.chatParityC2Result('sa_1', 'failed', 'stale_target')), { request_id: 'sa_1', status: 'failed', error_code: 'stale_target' })
  assert.deepEqual(plain(c2.chatParityC2Result('sa_1', 'dismissed', 'busy')), { request_id: 'sa_1', status: 'dismissed', error_code: null })
  // -- deck_ops args -----------------------------------------------------------------------------------------------------------------------
  const D = (action, args) => c2.chatParityDeckOpsArgs(action, args)
  const T = { slide_index: 1, slide_id: 's2', expected_slide_count: 3 }
  assert.deepEqual(plain(D('goto_slide', T)), { action: 'goto_slide', target: { slideIndex: 1, slideId: 's2', expectedSlideCount: 3 } })
  for (const bad of [{ ...T, slide_index: -1 }, { ...T, slide_index: 3 }, { ...T, slide_index: 1.5 }, { ...T, slide_index: '1' }, { ...T, slide_id: '' }, { ...T, slide_id: ' s2' }, { ...T, slide_id: 's'.repeat(129) }, { ...T, slide_id: 7 }, { ...T, expected_slide_count: 0 }, { ...T, expected_slide_count: 5001 }, { ...T, expected_slide_count: '3' }, { slide_index: 1 }, {}]) assert.equal(D('goto_slide', bad), null, `goto: ${JSON.stringify(bad)}`)
  const L = { ...T, layout: 'S4-comparison', preserve_content: true }
  assert.deepEqual(plain(D('change_layout', L)), { action: 'change_layout', target: { slideIndex: 1, slideId: 's2', expectedSlideCount: 3 }, layout: 'S4-comparison' })
  for (const layout of c2.CHAT_PARITY_C2_LAYOUTS) assert.notEqual(D('change_layout', { ...L, layout }), null, `layout ${layout}`)
  assert.equal(c2.CHAT_PARITY_C2_LAYOUTS.length, 19, '19 layouts')
  for (const bad of [{ ...L, layout: 'X9-nope' }, { ...L, layout: 's4-comparison' }, { ...L, layout: '' }, { ...L, layout: 7 }, { ...L, preserve_content: false }, { ...L, preserve_content: 'true' }, { ...T, layout: 'S4-comparison' }, { layout: 'S4-comparison', preserve_content: true }]) assert.equal(D('change_layout', bad), null, `change_layout: ${JSON.stringify(bad)}`)
  assert.deepEqual(plain(D('add_blank_slide', { layout: 'B1-blank', expected_slide_count: 3, position: 'end', insertion_index: 3 })), { action: 'add_blank_slide', position: 'end', insertionIndex: 3, expectedSlideCount: 3, target: null }, 'at the end (deck.py:279)')
  assert.deepEqual(plain(D('add_blank_slide', { layout: 'B1-blank', expected_slide_count: 3, position: 'before', insertion_index: 1, ...T })), { action: 'add_blank_slide', position: 'before', insertionIndex: 1, expectedSlideCount: 3, target: { slideIndex: 1, slideId: 's2', expectedSlideCount: 3 } }, 'before slide 2: the index (deck.py:285)')
  assert.deepEqual(plain(D('add_blank_slide', { layout: 'B1-blank', expected_slide_count: 3, position: 'after', insertion_index: 2, ...T })).insertionIndex, 2, 'after slide 2: index + 1')
  for (const bad of [{ layout: 'C1-text', expected_slide_count: 3, position: 'end', insertion_index: 3 }, { layout: 'B1-blank', expected_slide_count: 3, position: 'end', insertion_index: 2 }, { layout: 'B1-blank', expected_slide_count: 3, position: 'middle', insertion_index: 1 },
    { layout: 'B1-blank', expected_slide_count: 3, position: 'before', insertion_index: 2, ...T }, { layout: 'B1-blank', expected_slide_count: 3, position: 'after', insertion_index: 1, ...T }, { layout: 'B1-blank', expected_slide_count: 3, position: 'before', insertion_index: 1 },
    { layout: 'B1-blank', position: 'end', insertion_index: 3 }, { layout: 'B1-blank', expected_slide_count: 3, insertion_index: 3 }, { layout: 'B1-blank', expected_slide_count: 3, position: 'end', insertion_index: -1 }, { layout: 'B1-blank', expected_slide_count: 3, position: 'end', insertion_index: '3' }]) assert.equal(D('add_blank_slide', bad), null, `add: ${JSON.stringify(bad)}`)
  assert.deepEqual(plain(D('rename_deck', { name: '  Q3 plan  ' })), { action: 'rename_deck', name: 'Q3 plan' }, 'trimmed'); assert.notEqual(D('rename_deck', { name: 'x'.repeat(150) }), null, '150 is allowed')
  for (const bad of [{ name: '' }, { name: '   ' }, { name: 'x'.repeat(151) }, { name: 'two\nlines' }, { name: 'tab\there' }, { name: 'nul\u0000' }, { name: 'del\u007f' }, { name: 5 }, {}]) assert.equal(D('rename_deck', bad), null, `rename: ${JSON.stringify(bad)}`)
  const deleteCard = 'dd_0123456789abcdef01234567'
  assert.deepEqual(plain(D('delete_deck', { confirmed: true, confirmation_id: deleteCard })), { action: 'delete_deck', confirmationId: deleteCard })
  for (const bad of [{ confirmed: false, confirmation_id: deleteCard }, { confirmed: 'true', confirmation_id: deleteCard }, { confirmed: 1, confirmation_id: deleteCard }, { confirmation_id: deleteCard }, { confirmed: true }, { confirmed: true, confirmation_id: '' }, { confirmed: true, confirmation_id: 'dd_0123' }, { confirmed: true, confirmation_id: 'dd_0123456789ABCDEF01234567' },
    { confirmed: true, confirmation_id: 'xx_0123456789abcdef01234567' }, { confirmed: true, confirmation_id: `${deleteCard}0` }, {}]) assert.equal(D('delete_deck', bad), null, `delete without Director's card token is refused: ${JSON.stringify(bad)}`)
  assert.deepEqual(plain(D('set_view_mode', { mode: 'edit' })), { action: 'set_view_mode', mode: 'edit' }); assert.deepEqual(plain(D('set_view_mode', { mode: 'view' })), { action: 'set_view_mode', mode: 'view' })
  for (const bad of [{ mode: 'View' }, { mode: 'toggle' }, { mode: true }, {}]) assert.equal(D('set_view_mode', bad), null, `mode: ${JSON.stringify(bad)}`)
  assert.deepEqual(plain(D('set_slide_rail', { visible: false })), { action: 'set_slide_rail', visible: false })
  for (const bad of [{ visible: 'true' }, { visible: 1 }, { visible: null }, {}]) assert.equal(D('set_slide_rail', bad), null, `rail: ${JSON.stringify(bad)}`)
  for (const a of ['start_blank_canvas', 'duplicate_deck', 'present']) assert.deepEqual(plain(D(a, {})), { action: a }, `${a} takes no args`)
  assert.equal(D('nope', {}), null)
  // -- evidence ----------------------------------------------------------------------------------------------------------------------------
  const o = (...ids) => ({ nativeCount: ids.length, currentVisualIndex: 0, slideIds: ids })
  const tg = { slideIndex: 1, slideId: 's2', expectedSlideCount: 3 }
  assert.equal(c2.chatParityC2TargetStale(o('s1', 's2', 's3'), tg), false); assert.equal(c2.chatParityC2TargetStale(o('s1', 's3', 's2'), tg), true, 'reordered'); assert.equal(c2.chatParityC2TargetStale(o('s1', 's2'), tg), true, 'fewer'); assert.equal(c2.chatParityC2TargetStale(o('s1', 's2', 's3', 's4'), tg), true, 'more')
  assert.equal(c2.chatParityC2TargetStale({ nativeCount: 3, currentVisualIndex: 0, slideIds: ['s1', 's2'] }, tg), true, 'an order whose count and ids disagree')
  assert.equal(c2.chatParityC2CountStale(o('a', 'b', 'c'), 3), false); assert.equal(c2.chatParityC2CountStale(o('a', 'b'), 3), true)
  assert.equal(c2.chatParityC2AddVerified(o('a', 'b', 'c'), o('a', 'n', 'b', 'c'), 1), true); assert.equal(c2.chatParityC2AddVerified(o('a', 'b', 'c'), o('a', 'b', 'c', 'n'), 3), true, 'at the end')
  assert.equal(c2.chatParityC2AddVerified(o('a', 'b', 'c'), o('n', 'a', 'b', 'c'), 0), true, 'at the start')
  assert.equal(c2.chatParityC2AddVerified(o('a', 'b', 'c'), o('a', 'n', 'b', 'c'), 2), false, 'the new slide is not where it was asked')
  assert.equal(c2.chatParityC2AddVerified(o('a', 'b', 'c'), o('a', 'b', 'c'), 1), false, 'nothing added'); assert.equal(c2.chatParityC2AddVerified(o('a', 'b', 'c'), o('a', 'n', 'm', 'b', 'c'), 1), false, 'two added')
  assert.equal(c2.chatParityC2AddVerified(o('a', 'b', 'c'), o('a', 'c', 'n', 'b'), 2), false, 'others reordered'); assert.equal(c2.chatParityC2AddVerified(o('a', 'b', 'c'), o('a', 'b', 'b2', 'c'), 1), false, 'the slide at the index is an old one'); assert.equal(c2.chatParityC2AddVerified(o('a', 'b', 'c'), o('a', 'b', 'b', 'c'), 1), false, 'the slide at the index repeats an old id (the others are where they were)')
  assert.equal(c2.chatParityC2AddVerified(o('a', 'b'), o('a', 'b', 'n'), 9), false, 'an index outside the deck')
  assert.equal(c2.chatParityC2LayoutShapeKept(o('a', 'b', 'c'), o('a', 'b2', 'c'), 1), true, 'the changed slide may carry a new id'); assert.equal(c2.chatParityC2LayoutShapeKept(o('a', 'b', 'c'), o('a', 'b', 'c'), 1), true)
  assert.equal(c2.chatParityC2LayoutShapeKept(o('a', 'b', 'c'), o('a', 'b'), 1), false, 'a slide lost'); assert.equal(c2.chatParityC2LayoutShapeKept(o('a', 'b', 'c'), o('c', 'b', 'a'), 1), false, 'reordered'); assert.equal(c2.chatParityC2LayoutShapeKept(o('a', 'b', 'c'), o('x', 'b', 'c'), 1), false, 'another slide changed')
  // -- publish args ------------------------------------------------------------------------------------------------------------------------
  const P = (action, args) => c2.chatParityPublishArgs(action, args)
  assert.deepEqual(plain(P('publish_deck', { visibility: 'unlisted', allowPdf: false, allowPptx: false })), { action: 'publish_deck', visibility: 'unlisted', allowPdf: false, allowPptx: false })
  assert.deepEqual(plain(P('publish_deck', { visibility: 'public', allowPdf: true, allowPptx: false })), { action: 'publish_deck', visibility: 'public', allowPdf: true, allowPptx: false })
  assert.deepEqual(plain(P('publish_deck', {})), { action: 'publish_deck', visibility: 'unlisted', allowPdf: false, allowPptx: false }, 'a missing setting reads as the least exposure (publish.py:310)')
  for (const bad of [{ visibility: 'restricted' }, { visibility: 'private' }, { visibility: 'PUBLIC' }, { allowPdf: 'true' }, { allowPptx: 1 }, { passcode: 'secret1' }, { slug: 'abc' }, { url: 'https://x' }, { sessionId: 's' }, { qaEnabled: true }, { visibility: 'unlisted', extra: 1 }]) assert.equal(P('publish_deck', bad), null, `publish_deck: ${JSON.stringify(bad)}`)
  for (const a of ['republish_deck', 'unpublish_deck', 'rotate_publish_link', 'open_publish_link', 'copy_publish_link']) { assert.deepEqual(plain(P(a, {})), { action: a }); for (const bad of [{ slug: 'x' }, { passcode: 'x' }, { visibility: 'public' }, { url: 'https://x' }]) assert.equal(P(a, bad), null, `${a} with ${JSON.stringify(bad)}`) }
  assert.deepEqual(plain(P('configure_publish', { allowPdf: true })), { action: 'configure_publish', settings: { allowPdf: true } })
  assert.deepEqual(plain(P('configure_publish', { qaEnabled: true, qaDailyCap: 10, qaMonthlyCap: 100 })).settings, { qaEnabled: true, qaDailyCap: 10, qaMonthlyCap: 100 })
  assert.deepEqual(plain(P('configure_publish', { narrationEnabled: true, narrationBudgetMinutes: 30, qaReserveMinutes: 5 })).settings, { narrationEnabled: true, narrationBudgetMinutes: 30, qaReserveMinutes: 5 })
  assert.deepEqual(plain(P('configure_publish', { visibility: 'unlisted', allowPptx: false })).settings, { visibility: 'unlisted', allowPptx: false })
  for (const bad of [{}, { passcode: 'abcdef' }, { visibility: 'restricted' }, { slug: 'x' }, { allowPdf: 'yes' }, { qaEnabled: true }, { qaEnabled: true, qaDailyCap: 10 }, { qaDailyCap: 11, qaMonthlyCap: 10 }, { qaDailyCap: 1001 }, { qaDailyCap: -1 }, { qaMonthlyCap: 20001 }, { qaDailyCap: 1.5 }, { qaDailyCap: '5' },
    { narrationEnabled: true }, { qaReserveMinutes: 5 }, { narrationBudgetMinutes: 0 }, { narrationBudgetMinutes: 481 }, { narrationBudgetMinutes: 10, qaReserveMinutes: 11 }, { narrationBudgetMinutes: 10, qaReserveMinutes: 481 }, { voice: 'maya' }, { narrationScript: 'x' }, { allowPdf: true, url: 'https://x' }]) assert.equal(P('configure_publish', bad), null, `configure: ${JSON.stringify(bad)}`)
  assert.notEqual(P('configure_publish', { qaEnabled: false }), null, 'switching questions off needs no caps'); assert.notEqual(P('configure_publish', { qaDailyCap: 10, qaMonthlyCap: 10 }), null, 'equal caps')
  assert.notEqual(P('configure_publish', { narrationBudgetMinutes: 10, qaReserveMinutes: 10 }), null, 'reserve equal to the total')
  assert.equal(P('nope', {}), null)
  // the C2 libs: no import beyond the lib; nothing here reads a chat input
  assert.deepEqual([...t[C2].matchAll(/^import .*$/gm)].map(m => m[0].replace(/\s+/g, ' ')), ["import { CHAT_PARITY_C2_FLAGS, chatParityResult, type ChatParityC2Flags, type ChatParityErrorCode, type ChatParityRequest, type ChatParityResultData } from '@/lib/studio-chat-parity'"], 'the pure file imports only the older lib')
  const code = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, removeComments: true } }).outputText
  assert.equal(/user_message|sendMessage|inputMessage|handleSendMessage|action_value|confirm_publish|confirm_delete/.test(code(t[C2] + t[DECKOPS] + t[PUBLISH] + t[RUN])), false, 'no typed text, no send, no card value is read by any C2 file: a typed yes can confirm nothing')
}

// ============================================================================================================================================
// 2. deck_ops, frame by frame
// ============================================================================================================================================
async function deckOpsChecks(mods = M) {
  const rf = (f, deps, opts = {}) => runFrame(f, deps, { ...opts, mods })
  const send = async (action, args, w, { opts, deps } = {}) => rf(deckFrame(action, args, opts), deckOpsDepsOf(w, deps))
  const deckOpsDepsOf = (w, extra = {}) => ({ displayed: displayed(), deckOps: deckDeps(w, clock(), extra) })
  // ---- goto_slide (row 32): the viewer's own go-to, then the selection read back
  { const w = deckWorld(); const r = await send('goto_slide', { slide_index: 2, slide_id: 's3', expected_slide_count: 3 }, w)
    assert.deepEqual([r.status, r.code], ['done', null]); assert.deepEqual(w.calls, [['goTo', 2]], 'the viewer\'s own go-to-slide, with the 0-based index') }
  { const w = deckWorld({ ids: ['s1', 's2', 's3'] }); w.goTo = async index => { w.calls.push(['goTo', index]) } // the selection never moves: not done
    const r = await send('goto_slide', { slide_index: 2, slide_id: 's3', expected_slide_count: 3 }, w); assert.deepEqual([r.status, r.code], ['failed', 'write_failed'], 'the optimistic move is not a done'); assert.deepEqual(w.calls, [['goTo', 2]]) }
  for (const [name, args, code] of [['a slide count that changed', { slide_index: 1, slide_id: 's2', expected_slide_count: 4 }, 'stale_target'], ['a slide that moved', { slide_index: 1, slide_id: 's3', expected_slide_count: 3 }, 'stale_target'], ['an id that is not in the deck', { slide_index: 0, slide_id: 'zz', expected_slide_count: 3 }, 'stale_target']]) {
    const w = deckWorld(); const r = await send('goto_slide', args, w); assert.deepEqual([r.status, r.code], ['failed', code], name); assert.deepEqual(w.calls, [], `${name}: the viewer is not moved to another slide`) }
  { const w = deckWorld({ placeholders: true }); const r = await send('goto_slide', { slide_index: 1, slide_id: 's2', expected_slide_count: 3 }, w); assert.deepEqual([r.status, r.code], ['failed', 'busy'], 'a compose placeholder on screen'); assert.deepEqual(w.calls, []) }
  { const w = deckWorld({ orderNull: true }); const r = await send('goto_slide', { slide_index: 1, slide_id: 's2', expected_slide_count: 3 }, w); assert.deepEqual([r.status, r.code], ['failed', 'viewer_unavailable'], 'the viewer cannot answer') }
  { const w = deckWorld({ noGoTo: true }); const r = await send('goto_slide', { slide_index: 1, slide_id: 's2', expected_slide_count: 3 }, w); assert.deepEqual([r.status, r.code], ['failed', 'viewer_unavailable']) }
  { const w = deckWorld({ gate: { building: true, paused: true, templateMode: true }, pending: true }); const r = await send('goto_slide', { slide_index: 2, slide_id: 's3', expected_slide_count: 3 }, w)
    assert.deepEqual([r.status, r.code], ['done', null], 'navigation stays usable while a build runs or a write waits (Director: read-only actions, deck.py:24)'); assert.deepEqual(w.calls, [['goTo', 2]]) }
  // ---- add_blank_slide (row 24): the Add Slide panel's own Blank call
  for (const [position, index, args, at] of [['end', 3, { layout: 'B1-blank', expected_slide_count: 3, position: 'end', insertion_index: 3 }, 3], ['before', 1, { layout: 'B1-blank', expected_slide_count: 3, position: 'before', insertion_index: 1, slide_index: 1, slide_id: 's2' }, 1], ['after', 1, { layout: 'B1-blank', expected_slide_count: 3, position: 'after', insertion_index: 2, slide_index: 1, slide_id: 's2' }, 2]]) {
    for (const lag of [0, 3]) {
      const w = deckWorld({ lag }); const r = await send('add_blank_slide', args, w)
      assert.deepEqual([r.status, r.code], ['done', null], `${position}, lag ${lag}`); assert.deepEqual(w.calls, [['addSlide', 'B1-blank', { position: at, backgroundColor: '#ffffff' }]], `${position}: the blank layout, the insertion index as the position, the panel's own native options`)
      assert.equal(w.ids.length, 4); assert.ok(w.ids[at].startsWith('n'), 'the new slide is where it was asked')
    }
  }
  for (const [name, patch, code] of [['a build running', { gate: { building: true, paused: false, templateMode: false } }, 'busy'], ['this tab paused', { gate: { building: false, paused: true, templateMode: false } }, 'busy'], ['a template in use', { gate: { building: false, paused: false, templateMode: true } }, 'busy'],
    ['a slide write still pending', { pending: true }, 'busy'], ['the viewer not ready', { ready: false }, 'viewer_unavailable'], ['no viewer', { noViewer: true }, 'viewer_unavailable'], ['a compose placeholder', { placeholders: true }, 'busy'], ['an unreadable order', { orderNull: true }, 'viewer_unavailable']]) {
    const w = deckWorld(patch); const r = await send('add_blank_slide', { layout: 'B1-blank', expected_slide_count: 3, position: 'end', insertion_index: 3 }, w); assert.deepEqual([r.status, r.code], ['failed', code], name); assert.deepEqual(w.calls, [], `${name}: nothing is added`) }
  { const w = deckWorld(); const r = await send('add_blank_slide', { layout: 'B1-blank', expected_slide_count: 2, position: 'end', insertion_index: 2 }, w); assert.deepEqual([r.status, r.code], ['failed', 'stale_target'], 'the deck grew since Director read it'); assert.deepEqual(w.calls, []) }
  { const w = deckWorld(); const r = await send('add_blank_slide', { layout: 'B1-blank', expected_slide_count: 3, position: 'before', insertion_index: 1, slide_index: 1, slide_id: 's3' }, w); assert.deepEqual([r.status, r.code], ['failed', 'stale_target'], 'the named slide is not at that index'); assert.deepEqual(w.calls, []) }
  { const w = deckWorld(); w.viewer.addSlide = async (layout, opts) => { w.calls.push(['addSlide', layout, opts]) } // the add never shows
    const r = await send('add_blank_slide', { layout: 'B1-blank', expected_slide_count: 3, position: 'end', insertion_index: 3 }, w); assert.deepEqual([r.status, r.code], ['failed', 'timeout'], 'no evidence in time: unknown, never a done') }
  { const w = deckWorld(); w.viewer.addSlide = async (layout, opts) => { w.calls.push(['addSlide']); w.ids.splice(0, 0, 'n1') } // the slide landed at the wrong place
    const r = await send('add_blank_slide', { layout: 'B1-blank', expected_slide_count: 3, position: 'end', insertion_index: 3 }, w); assert.deepEqual([r.status, r.code], ['failed', 'write_failed'], 'evidence that disagrees is a failure') }
  // ---- change_layout (row 27)
  for (const lag of [0, 4]) { const w = deckWorld({ lag }); const r = await send('change_layout', { slide_index: 1, slide_id: 's2', expected_slide_count: 3, layout: 'S4-comparison', preserve_content: true }, w)
    assert.deepEqual([r.status, r.code], ['done', null], `lag ${lag}`); assert.deepEqual(w.calls, [['changeLayout', 1, 'S4-comparison']], 'the slide menu\'s own Change Layout, the 0-based index, the layout code'); assert.equal(w.layouts[1], 'S4-comparison') }
  { const w = deckWorld(); w.layouts[1] = 'S4-comparison'; const r = await send('change_layout', { slide_index: 1, slide_id: 's2', expected_slide_count: 3, layout: 'S4-comparison', preserve_content: true }, w); assert.deepEqual([r.status, r.code], ['done', null], 'already that layout (Layout\'s own record)'); assert.deepEqual(w.calls, [], 'nothing is written') }
  { const w = deckWorld(); w.viewer.changeLayout = async (i, l) => { w.calls.push(['changeLayout', i, l]) } // Layout never changes
    const r = await send('change_layout', { slide_index: 1, slide_id: 's2', expected_slide_count: 3, layout: 'S4-comparison', preserve_content: true }, w); assert.deepEqual([r.status, r.code], ['failed', 'write_failed'], 'Layout still reads the old layout: not done') }
  { const w = deckWorld({ layoutUnreadable: true }); const r = await send('change_layout', { slide_index: 1, slide_id: 's2', expected_slide_count: 3, layout: 'S4-comparison', preserve_content: true }, w); assert.deepEqual([r.status, r.code], ['failed', 'timeout'], 'the layout cannot be read back: unknown, never a done') }
  { const w = deckWorld(); w.viewer.changeLayout = async (i, l) => { w.calls.push(['changeLayout']); w.layouts[1] = 'S4-comparison'; w.ids.pop() } // a slide lost on the way
    const r = await send('change_layout', { slide_index: 1, slide_id: 's2', expected_slide_count: 3, layout: 'S4-comparison', preserve_content: true }, w); assert.deepEqual([r.status, r.code], ['failed', 'write_failed'], 'the deck lost its shape') }
  for (const [name, patch, code] of [['a build running', { gate: { building: true, paused: false, templateMode: false } }, 'busy'], ['a pending slide write', { pending: true }, 'busy'], ['the viewer not ready', { ready: false }, 'viewer_unavailable']]) {
    const w = deckWorld(patch); const r = await send('change_layout', { slide_index: 1, slide_id: 's2', expected_slide_count: 3, layout: 'S4-comparison', preserve_content: true }, w); assert.deepEqual([r.status, r.code], ['failed', code], name); assert.deepEqual(w.calls, [], name) }
  { const w = deckWorld(); const r = await send('change_layout', { slide_index: 1, slide_id: 's3', expected_slide_count: 3, layout: 'S4-comparison', preserve_content: true }, w); assert.deepEqual([r.status, r.code], ['failed', 'stale_target'], 'a reordered target is never moved to another slide'); assert.deepEqual(w.calls, []) }
  { const w = deckWorld(); const r = await send('change_layout', { slide_index: 1, slide_id: 's2', expected_slide_count: 3, layout: 'B1-blank', preserve_content: false }, w); assert.deepEqual([r.status, r.code], ['failed', 'invalid_args'], 'content is always preserved'); assert.deepEqual(w.calls, []) }
  // ---- present (row 92): done only when the browser is in full screen
  { const w = deckWorld(); const r = await send('present', {}, w); assert.deepEqual([r.status, r.code], ['done', null]); assert.deepEqual(w.calls, [['present']]) }
  { const w = deckWorld({ fullscreenAllowed: false }); const r = await send('present', {}, w); assert.deepEqual([r.status, r.code], ['failed', 'fullscreen_denied'], 'a refused full screen is not claimed'); assert.deepEqual(w.calls, [['present']]) }
  { const w = deckWorld({ fullscreen: true }); const r = await send('present', {}, w); assert.deepEqual([r.status, r.code], ['done', null], 'already full screen'); assert.deepEqual(w.calls, [], 'the toggle is not called (it would leave full screen)') }
  { const w = deckWorld({ ready: false }); const r = await send('present', {}, w); assert.deepEqual([r.status, r.code], ['failed', 'viewer_unavailable']) }
  { const w = deckWorld({ gate: { building: true, paused: false, templateMode: false } }); const r = await send('present', {}, w); assert.deepEqual([r.status, r.code], ['done', null], 'presenting is usable while a build runs') }
  // ---- set_view_mode (row 115) and set_slide_rail (row 117): the requested value, never a toggle
  { const w = deckWorld(); const r = await send('set_view_mode', { mode: 'edit' }, w); assert.deepEqual([r.status, r.code], ['done', null]); assert.deepEqual(w.calls, [['setMode', true]], 'true = Edit') }
  { const w = deckWorld({ edit: true }); const r = await send('set_view_mode', { mode: 'view' }, w); assert.deepEqual([r.status, r.code], ['done', null]); assert.deepEqual(w.calls, [['setMode', false]]) }
  { const w = deckWorld({ edit: true }); const r = await send('set_view_mode', { mode: 'edit' }, w); assert.deepEqual([r.status, r.code], ['done', null], 'already there'); assert.deepEqual(w.calls, [], 'no blind toggle') }
  { const w = deckWorld(); w.viewer.setMode = async edit => { w.calls.push(['setMode', edit]) }; const r = await send('set_view_mode', { mode: 'edit' }, w); assert.deepEqual([r.status, r.code], ['failed', 'write_failed'], 'the viewer did not switch') }
  { const w = deckWorld(); const r = await send('set_slide_rail', { visible: false }, w); assert.deepEqual([r.status, r.code], ['done', null]); assert.deepEqual(w.calls, [['setRail', false]]) }
  { const w = deckWorld({ rail: false }); const r = await send('set_slide_rail', { visible: false }, w); assert.deepEqual([r.status, r.code], ['done', null]); assert.deepEqual(w.calls, [], 'already hidden: no toggle') }
  { const w = deckWorld(); w.viewer.setRail = visible => { w.calls.push(['setRail', visible]) }; const r = await send('set_slide_rail', { visible: false }, w); assert.deepEqual([r.status, r.code], ['failed', 'write_failed']) }
  { const w = deckWorld({ ready: false }); for (const [a, args] of [['set_view_mode', { mode: 'edit' }], ['set_slide_rail', { visible: false }]]) { const r = await send(a, args, w); assert.deepEqual([r.status, r.code], ['failed', 'viewer_unavailable'], a) } }
  // ---- start_blank_canvas (row 2)
  { const w = deckWorld(); const r = await send('start_blank_canvas', {}, w, { opts: { presentationId: '' } }); assert.deepEqual([r.status, r.code], ['done', null]); assert.deepEqual(w.calls, [['startBlank']], 'the welcome\'s own Start on a blank canvas') }
  { const w = deckWorld({ blankAvailable: false }); const r = await send('start_blank_canvas', {}, w); assert.deepEqual([r.status, r.code], ['failed', 'unsupported'], 'a deck is open: never started over it (Director\'s line: use New first)'); assert.deepEqual(w.calls, []) }
  { const w = deckWorld({ noBlank: true }); const r = await send('start_blank_canvas', {}, w); assert.deepEqual([r.status, r.code], ['failed', 'unsupported']) }
  { const w = deckWorld({ gate: { building: true, paused: false, templateMode: false } }); const r = await send('start_blank_canvas', {}, w); assert.deepEqual([r.status, r.code], ['failed', 'busy']); assert.deepEqual(w.calls, []) }
  { const w = deckWorld({ blankWorks: false }); const r = await send('start_blank_canvas', {}, w); assert.deepEqual([r.status, r.code], ['failed', 'write_failed'], 'the canvas did not start') }
  // ---- rename_deck (row 99)
  { const w = deckWorld(); const r = await send('rename_deck', { name: 'Q3 plan' }, w); assert.deepEqual([r.status, r.code], ['done', null]); assert.deepEqual(w.sessionCalls, [['rename', 'sess-1', 'Q3 plan']], 'the session row\'s own title save, for the displayed session') }
  { const w = deckWorld({ renameAnswer: null }); const r = await send('rename_deck', { name: 'Q3 plan' }, w); assert.deepEqual([r.status, r.code], ['failed', 'write_failed'], 'the save did not come back') }
  { const w = deckWorld({ renameAnswer: 'Another title' }); const r = await send('rename_deck', { name: 'Q3 plan' }, w); assert.deepEqual([r.status, r.code], ['failed', 'write_failed'], 'the saved row answers a different title') }
  { const w = deckWorld({ gate: { building: true, paused: false, templateMode: false } }); const r = await send('rename_deck', { name: 'x' }, w); assert.deepEqual([r.status, r.code], ['failed', 'busy']); assert.deepEqual(w.sessionCalls, []) }
  { const w = deckWorld(); const r = await send('rename_deck', { name: 'two\nlines' }, w); assert.deepEqual([r.status, r.code], ['failed', 'invalid_args']); assert.deepEqual(w.sessionCalls, []) }
  // ---- delete_deck (row 97): never without Director's card token, never during a build, the new session only after the answer
  const DEL = { confirmed: true, confirmation_id: 'dd_0123456789abcdef01234567' }
  { const w = deckWorld(); const r = await send('delete_deck', DEL, w); assert.deepEqual([r.status, r.code], ['done', null]); assert.deepEqual(w.sessionCalls, [['deleteDeck', 'sess-1']], 'the Sessions list\'s own delete'); assert.equal(typeof r.outcome.after, 'function', 'the New flow is handed back to run AFTER the answer is sent'); r.outcome.after(); assert.deepEqual(w.sessionCalls.at(-1), ['startNew']) }
  for (const [name, args] of [['no confirmation at all', {}], ['confirmed false', { ...DEL, confirmed: false }], ['confirmed as the string true', { ...DEL, confirmed: 'true' }], ['no card token', { confirmed: true }], ['a deleteCard that is not Director\'s', { confirmed: true, confirmation_id: 'yes' }], ['a typed yes as the deleteCard', { confirmed: true, confirmation_id: 'yes delete it' }], ['an uppercase deleteCard', { confirmed: true, confirmation_id: 'dd_0123456789ABCDEF01234567' }]]) {
    const w = deckWorld(); const r = await send('delete_deck', args, w); assert.deepEqual([r.status, r.code], ['failed', 'invalid_args'], name); assert.deepEqual(w.sessionCalls, [], `${name}: nothing is deleted`); assert.equal(r.outcome.after, null) }
  { const w = deckWorld({ gate: { building: true, paused: false, templateMode: false } }); const r = await send('delete_deck', DEL, w); assert.deepEqual([r.status, r.code], ['failed', 'busy'], 'never while a build runs'); assert.deepEqual(w.sessionCalls, []); assert.equal(r.outcome.after, null) }
  { const w = deckWorld({ gate: { building: false, paused: true, templateMode: false } }); const r = await send('delete_deck', DEL, w); assert.deepEqual([r.status, r.code], ['failed', 'busy'], 'not from a paused tab'); assert.deepEqual(w.sessionCalls, []) }
  { const w = deckWorld({ deleteAnswer: false }); const r = await send('delete_deck', DEL, w); assert.deepEqual([r.status, r.code], ['failed', 'write_failed'], 'the server did not acknowledge: not done, no new session'); assert.deepEqual(w.sessionCalls, [['deleteDeck', 'sess-1']]); assert.equal(r.outcome.after, null) }
  // ---- duplicate_deck (row 96): the Decks page's Duplicate, its own function
  const layoutOk = { success: true, presentation_id: 'copy-deck', slide_count: 3, url: '/p/copy-deck' }
  const dupWorld = (patch = {}) => {
    const log = []
    const route = async (input, init = {}) => {
      log.push([init.method || 'GET', input]); const json = body => ({ ok: true, status: 200, json: async () => body })
      if (String(input).endsWith('/duplicate')) return patch.layout ? patch.layout() : json(layoutOk)
      if (input === '/api/sessions' && init.method === 'POST') return patch.create ? patch.create() : json({ session: { id: 'copy-session' } })
      if (String(input).startsWith('/api/sessions/') && init.method === 'PATCH') return patch.patch ? patch.patch() : json({ session: { id: 'copy-session', createdAt: 'c', updatedAt: 'u' } })
      if (String(input).startsWith('/api/sessions/') && init.method === 'DELETE') return json({})
      throw new Error(`unexpected request ${init.method} ${input}`)
    }
    let n = 0
    return { log, duplicate: { loadSession: async id => (patch.row === undefined ? { title: 'Q3 plan', currentStage: 6, slideCount: 3, finalPresentationUrl: 'https://layout.example/p/deck-1', strawmanPreviewUrl: null } : patch.row), evaluateUrl: url => (url.startsWith('https://layout.example/') ? { status: 'allowed', url } : { status: 'blocked' }),
      deps: { fetch: route, layoutBaseUrl: () => 'https://layout.example', newId: () => `id-${++n}`, now: () => new Date('2026-11-10T00:00:00Z'), sleep: async () => {} } } }
  }
  { const d = dupWorld(); const w = deckWorld({ duplicate: d.duplicate }); const r = await send('duplicate_deck', {}, w); assert.deepEqual([r.status, r.code], ['done', null])
    assert.deepEqual(d.log.map(([m, u]) => `${m} ${u}`), ['POST https://layout.example/api/presentations/deck-1/duplicate', 'POST /api/sessions', 'PATCH /api/sessions/id-2'], 'Layout copies, then the new session row, then its slot: the Decks page\'s own three steps') }
  { const w = deckWorld(); const r = await send('duplicate_deck', {}, w); assert.deepEqual([r.status, r.code], ['failed', 'unsupported'], 'NEXT_PUBLIC_STUDIO_DUPLICATE_DECK off: no click path, none from chat') }
  { const d = dupWorld({ row: null }); const w = deckWorld({ duplicate: d.duplicate }); const r = await send('duplicate_deck', {}, w); assert.deepEqual([r.status, r.code], ['failed', 'not_found']); assert.deepEqual(d.log, []) }
  { const d = dupWorld({ row: { title: 'x', finalPresentationUrl: null, strawmanPreviewUrl: null } }); const w = deckWorld({ duplicate: d.duplicate }); const r = await send('duplicate_deck', {}, w); assert.deepEqual([r.status, r.code], ['failed', 'unsupported'], 'no saved deck to copy'); assert.deepEqual(d.log, []) }
  { const d = dupWorld({ row: { title: 'x', finalPresentationUrl: 'https://elsewhere.example/p/d', strawmanPreviewUrl: null } }); const w = deckWorld({ duplicate: d.duplicate }); const r = await send('duplicate_deck', {}, w); assert.deepEqual([r.status, r.code], ['failed', 'unsupported'], 'a deck stored in another environment'); assert.deepEqual(d.log, []) }
  { const d = dupWorld({ layout: () => ({ ok: false, status: 500, json: async () => ({}) }) }); const w = deckWorld({ duplicate: d.duplicate }); const r = await send('duplicate_deck', {}, w); assert.deepEqual([r.status, r.code], ['failed', 'write_failed'], 'Layout could not copy it') }
  { const d = dupWorld({ layout: () => ({ ok: false, status: 404, json: async () => ({ detail: 'Not Found' }) }) }); const w = deckWorld({ duplicate: d.duplicate }); const r = await send('duplicate_deck', {}, w); assert.deepEqual([r.status, r.code], ['failed', 'unsupported'], 'Layout with the copy switched off') }
  { const d = dupWorld({ patch: () => ({ ok: false, status: 500, json: async () => ({}) }) }); const w = deckWorld({ duplicate: d.duplicate }); const r = await send('duplicate_deck', {}, w); assert.deepEqual([r.status, r.code], ['failed', 'write_failed'], 'the copy\'s row did not save: not done'); assert.ok(d.log.some(([m]) => m === 'DELETE'), 'the half-made row is removed, as on the Decks page') }
  { const d = dupWorld(); const w = deckWorld({ duplicate: d.duplicate, gate: { building: true, paused: false, templateMode: false } }); const r = await send('duplicate_deck', {}, w); assert.deepEqual([r.status, r.code], ['failed', 'busy']); assert.deepEqual(d.log, []) }
  // ---- every answer has the shape Director reads (checked inside runFrame); one result per frame, on the request's own id
  { const w = deckWorld(); const f = deckFrame('goto_slide', { slide_index: 0, slide_id: 's1', expected_slide_count: 3 }); const r = await rf(f, deckOpsDepsOf(w)); assert.equal(r.resultFrame.payload.request_id, f.payload.request_id); assert.equal(r.resultFrame.type, 'studio_action_result') }
}

// ============================================================================================================================================
// 3. publish, against a fake of the Publish dialog's own endpoints
// ============================================================================================================================================
function publishWorld(options = {}) {
  const w = { record: undefined, session: { finalPresentationId: 'deck-1' }, calls: [], copied: [], opened: [], gate: { building: false, paused: false }, clipboard: true, popup: true, readFails: false, ...options }
  const deck = (patch = {}) => ({ id: 'rec-1', slug: 'abc123', sessionId: 'sess-1', sourcePresentationId: 'deck-1', snapshotPresentationId: 'snap-1', title: 'Q3', slideCount: 3, visibility: 'unlisted', hasPasscode: false, allowPdf: false, allowPptx: false, viewCount: 0,
    publishedAt: '2026-11-01T00:00:00Z', republishedAt: null, revokedAt: null, sourceUpdatedAt: null, publicUrl: 'https://deckster.example/p/abc123', qaEnabled: false, qaDailyCap: 0, qaMonthlyCap: 0, narrationEnabled: false, narrationBudgetMinutes: null, qaReserveMinutes: null, ...patch })
  w.deck = deck
  if (w.record === 'live') w.record = deck()
  const res = (ok, status, body) => ({ ok, status, json: async () => body })
  w.fetch = async (input, init = {}) => {
    const method = init.method || 'GET'; w.calls.push([method, String(input), init.body ? JSON.parse(init.body) : undefined])
    if (method === 'GET' && String(input).startsWith('/api/publish/by-session/')) { if (w.readFails) return res(false, 500, {}); return res(true, 200, { deck: w.record ?? null }) }
    if (method === 'POST' && input === '/api/publish') { const body = JSON.parse(init.body); if (w.postAnswer) return w.postAnswer(body, w); return res(true, 200, { deck: w.record ? { ...w.record, ...(body.visibility ? { visibility: body.visibility } : {}), republishedAt: '2026-11-10T00:00:00Z' } : deck({ visibility: body.visibility, allowPdf: body.allowPdf, allowPptx: body.allowPptx }) }) }
    if (method === 'PATCH' && String(input).startsWith('/api/publish/')) { const body = JSON.parse(init.body); if (w.patchAnswer) return w.patchAnswer(body, w); return res(true, 200, { deck: { ...w.record, ...body } }) }
    if (method === 'DELETE' && String(input).startsWith('/api/publish/')) { if (w.deleteAnswer) return w.deleteAnswer(w); return res(true, 200, { deck: { ...w.record, revokedAt: '2026-11-10T00:00:00Z' } }) }
    if (method === 'POST' && String(input).endsWith('/rotate')) { if (w.rotateAnswer) return w.rotateAnswer(w); return res(true, 200, { deck: { ...w.record, slug: 'zzz999', publicUrl: 'https://deckster.example/p/zzz999' } }) }
    throw new Error(`unexpected request ${method} ${input}`)
  }
  w.deps = { sessionId: () => 'sess-1', fetch: w.fetch, loadSession: async () => (w.session === null ? null : w.session), link: record => `https://deckster.example/p/${record.slug}`, copy: async text => { w.copied.push(text); return w.clipboard }, open: url => { w.opened.push(url); return w.popup }, gate: () => w.gate }
  return w
}
async function publishChecks(mods = M) {
  const rf = (f, deps, opts = {}) => runFrame(f, deps, { ...opts, mods })
  const send = async (action, args, w, opts) => rf(publishFrame(action, args, opts), { displayed: displayed(), publish: w.deps })
  const writes = w => w.calls.filter(([m]) => m !== 'GET')
  // ---- copy / open (row 85): reads of the live link, never sent back
  { const w = publishWorld({ record: 'live' }); const r = await send('copy_publish_link', {}, w); assert.deepEqual([r.status, r.code], ['done', null]); assert.deepEqual(w.copied, ['https://deckster.example/p/abc123'], 'the dialog\'s own link, copied'); assert.deepEqual(writes(w), [], 'a read writes nothing')
    assert.equal(JSON.stringify(r.resultFrame).includes('abc123'), false, 'the link never goes back to Director (c2-publish-contract: do not echo the link)') }
  { const w = publishWorld({ record: 'live' }); const r = await send('open_publish_link', {}, w); assert.deepEqual([r.status, r.code], ['done', null]); assert.deepEqual(w.opened, ['https://deckster.example/p/abc123'], 'opened in a new tab by the page\'s opener') }
  { const w = publishWorld({ record: 'live', clipboard: false }); const r = await send('copy_publish_link', {}, w); assert.deepEqual([r.status, r.code], ['failed', 'browser_blocked'], 'a blocked clipboard is not a copy') }
  { const w = publishWorld({ record: 'live', popup: false }); const r = await send('open_publish_link', {}, w); assert.deepEqual([r.status, r.code], ['failed', 'browser_blocked'], 'a blocked popup is not an open') }
  for (const a of ['copy_publish_link', 'open_publish_link']) {
    { const w = publishWorld({ record: undefined }); const r = await send(a, {}, w); assert.deepEqual([r.status, r.code], ['failed', 'not_published'], `${a}: never published`) }
    { const w = publishWorld({ record: 'live' }); w.record = w.deck({ revokedAt: '2026-11-02T00:00:00Z' }); const r = await send(a, {}, w); assert.deepEqual([r.status, r.code], ['failed', 'not_published'], `${a}: unpublished`) }
    { const w = publishWorld({ record: 'live' }); w.record = w.deck({ sessionId: 'someone-else' }); const r = await send(a, {}, w); assert.deepEqual([r.status, r.code], ['failed', 'state_changed'], `${a}: not this session's record`); assert.deepEqual([w.copied, w.opened], [[], []]) }
    { const w = publishWorld({ record: 'live', readFails: true }); const r = await send(a, {}, w); assert.deepEqual([r.status, r.code], ['failed', 'write_failed'], `${a}: a failed read is not an answer`) }
    { const w = publishWorld({ record: 'live' }); const { publicUrl, ...noLink } = w.deck(); w.record = noLink; const r = await send(a, {}, w); assert.deepEqual([r.status, r.code], ['failed', 'write_failed'], `${a}: a record without its public link is not a record`); assert.deepEqual([w.copied, w.opened], [[], []]) }
    { const w = publishWorld({ record: 'live' }); w.deps.link = () => 'javascript:alert(1)'; const r = await send(a, {}, w); assert.deepEqual([r.status, r.code], ['failed', 'write_failed'], `${a}: only an http(s) link`); assert.deepEqual([w.copied, w.opened], [[], []]) }
    { const w = publishWorld({ record: 'live', gate: { building: true, paused: true } }); const r = await send(a, {}, w); assert.deepEqual([r.status, r.code], ['done', null], `${a}: link reads stay usable while a build runs`) }
  }
  // ---- publish_deck: a first publish only
  { const w = publishWorld(); const r = await send('publish_deck', { visibility: 'unlisted', allowPdf: false, allowPptx: false }, w); assert.deepEqual([r.status, r.code], ['done', null])
    assert.deepEqual(writes(w), [['POST', '/api/publish', { sessionId: 'sess-1', visibility: 'unlisted', allowPdf: false, allowPptx: false }]], 'POST /api/publish with the safe defaults, no passcode, no wizard') }
  { const w = publishWorld(); const r = await send('publish_deck', { visibility: 'public', allowPdf: true, allowPptx: false }, w); assert.deepEqual([r.status, r.code], ['done', null]); assert.equal(writes(w)[0][2].visibility, 'public', 'the visibility the user\'s card named') }
  { const w = publishWorld({ record: 'live' }); const r = await send('publish_deck', { visibility: 'public', allowPdf: true, allowPptx: true }, w); assert.deepEqual([r.status, r.code], ['failed', 'state_changed'], 'a live record: its settings are never overwritten by a first publish'); assert.deepEqual(writes(w), []) }
  { const w = publishWorld({ session: { finalPresentationId: null } }); const r = await send('publish_deck', {}, w); assert.deepEqual([r.status, r.code], ['failed', 'no_deck'], 'no final deck yet'); assert.deepEqual(writes(w), []) }
  { const w = publishWorld({ session: { finalPresentationId: 'another-deck' } }); const r = await send('publish_deck', {}, w); assert.deepEqual([r.status, r.code], ['failed', 'state_changed'], 'the session\'s final deck is not the one the request names'); assert.deepEqual(writes(w), []) }
  { const w = publishWorld({ session: null }); const r = await send('publish_deck', {}, w); assert.deepEqual([r.status, r.code], ['failed', 'write_failed']) }
  { const w = publishWorld({ gate: { building: true, paused: false } }); const r = await send('publish_deck', {}, w); assert.deepEqual([r.status, r.code], ['failed', 'locked'], 'a build running'); assert.deepEqual(w.calls, [], 'not even a read') }
  { const w = publishWorld({ gate: { building: false, paused: true } }); const r = await send('publish_deck', {}, w); assert.deepEqual([r.status, r.code], ['failed', 'locked']); assert.deepEqual(w.calls, []) }
  { const w = publishWorld({ postAnswer: async () => ({ ok: false, status: 409, json: async () => ({ error: 'no final deck' }) }) }); const r = await send('publish_deck', {}, w); assert.deepEqual([r.status, r.code], ['failed', 'no_deck'], '409: the server says there is no final deck') }
  { const w = publishWorld({ postAnswer: async () => ({ ok: false, status: 502, json: async () => ({ error: 'snapshot' }) }) }); const r = await send('publish_deck', {}, w); assert.deepEqual([r.status, r.code], ['failed', 'snapshot_failed']) }
  { const w = publishWorld({ postAnswer: async () => ({ ok: true, status: 200, json: async () => ({}) }) }); const r = await send('publish_deck', {}, w); assert.deepEqual([r.status, r.code], ['failed', 'snapshot_failed'], '200 without a deck is not a publish') }
  { const w = publishWorld({ postAnswer: async (body, world) => ({ ok: true, status: 200, json: async () => ({ deck: world.deck({ visibility: 'public' }) }) }) }); const r = await send('publish_deck', { visibility: 'unlisted' }, w); assert.deepEqual([r.status, r.code], ['failed', 'state_changed'], 'the server answers a more open visibility than asked: not done') }
  { const w = publishWorld({ postAnswer: async (body, world) => ({ ok: true, status: 200, json: async () => ({ deck: world.deck({ revokedAt: '2026-11-10T00:00:00Z' }) }) }) }); const r = await send('publish_deck', {}, w); assert.deepEqual([r.status, r.code], ['failed', 'state_changed'], 'a revoked record is not a live publish') }
  for (const bad of [{ visibility: 'restricted' }, { passcode: 'secret1' }, { slug: 'abc' }, { url: 'https://x' }, { allowPdf: 'yes' }]) { const w = publishWorld(); const r = await send('publish_deck', bad, w); assert.deepEqual([r.status, r.code], ['failed', 'invalid_args'], `publish_deck ${JSON.stringify(bad)}`); assert.deepEqual(w.calls, [], 'nothing is read or sent') }
  // ---- republish_deck: no settings sent, the link and the sharing settings kept
  { const w = publishWorld({ record: 'live' }); const r = await send('republish_deck', {}, w); assert.deepEqual([r.status, r.code], ['done', null]); assert.deepEqual(writes(w), [['POST', '/api/publish', { sessionId: 'sess-1' }]], 'POST /api/publish with the session id and no settings (c2-publish-contract.md: republish preserves the link and the settings)') }
  { const w = publishWorld({ record: undefined }); const r = await send('republish_deck', {}, w); assert.deepEqual([r.status, r.code], ['failed', 'not_published']); assert.deepEqual(writes(w), []) }
  { const w = publishWorld({ record: 'live' }); w.record = w.deck({ revokedAt: 'x' }); const r = await send('republish_deck', {}, w); assert.deepEqual([r.status, r.code], ['failed', 'not_published'], 'an unpublished record is not republished from chat'); assert.deepEqual(writes(w), []) }
  { const w = publishWorld({ record: 'live', postAnswer: async (body, world) => ({ ok: true, status: 200, json: async () => ({ deck: { ...world.record, republishedAt: '2026-11-10T00:00:00Z', slug: 'changed' } }) }) }); const r = await send('republish_deck', {}, w); assert.deepEqual([r.status, r.code], ['failed', 'state_changed'], 'the link changed: not a plain republish') }
  { const w = publishWorld({ record: 'live', postAnswer: async (body, world) => ({ ok: true, status: 200, json: async () => ({ deck: { ...world.record, republishedAt: '2026-11-10T00:00:00Z', visibility: 'public' } }) }) }); const r = await send('republish_deck', {}, w); assert.deepEqual([r.status, r.code], ['failed', 'state_changed'], 'the sharing settings changed') }
  { const w = publishWorld({ record: 'live', postAnswer: async (body, world) => ({ ok: true, status: 200, json: async () => ({ deck: { ...world.record } }) }) }); const r = await send('republish_deck', {}, w); assert.deepEqual([r.status, r.code], ['failed', 'state_changed'], 'no republish stamp: not shown done') }
  { const w = publishWorld({ record: 'live', session: { finalPresentationId: 'another-deck' } }); const r = await send('republish_deck', {}, w); assert.deepEqual([r.status, r.code], ['failed', 'state_changed']); assert.deepEqual(writes(w), []) }
  // ---- unpublish_deck
  { const w = publishWorld({ record: 'live' }); const r = await send('unpublish_deck', {}, w); assert.deepEqual([r.status, r.code], ['done', null]); assert.deepEqual(writes(w), [['DELETE', '/api/publish/abc123', undefined]]) }
  { const w = publishWorld({ record: 'live', deleteAnswer: async () => ({ ok: true, status: 200, json: async () => ({ deck: { slug: 'abc123', sessionId: 'sess-1', visibility: 'unlisted', allowPdf: false, allowPptx: false, revokedAt: null, republishedAt: null, publicUrl: 'https://deckster.example/p/abc123' } }) }) }); const r = await send('unpublish_deck', {}, w); assert.deepEqual([r.status, r.code], ['failed', 'state_changed'], 'the record is still live: not done') }
  { const w = publishWorld({ record: 'live', deleteAnswer: async () => ({ ok: false, status: 500, json: async () => ({}) }) }); const r = await send('unpublish_deck', {}, w); assert.deepEqual([r.status, r.code], ['failed', 'write_failed']) }
  { const w = publishWorld({ record: undefined }); const r = await send('unpublish_deck', {}, w); assert.deepEqual([r.status, r.code], ['failed', 'not_published']) }
  // ---- rotate_publish_link
  { const w = publishWorld({ record: 'live' }); const r = await send('rotate_publish_link', {}, w); assert.deepEqual([r.status, r.code], ['done', null]); assert.deepEqual(writes(w), [['POST', '/api/publish/abc123/rotate', undefined]]) }
  { const w = publishWorld({ record: 'live', rotateAnswer: async () => ({ ok: true, status: 200, json: async () => ({ deck: { slug: 'abc123', sessionId: 'sess-1', visibility: 'unlisted', allowPdf: false, allowPptx: false, revokedAt: null, republishedAt: null, publicUrl: 'https://deckster.example/p/abc123' } }) }) }); const r = await send('rotate_publish_link', {}, w); assert.deepEqual([r.status, r.code], ['failed', 'state_changed'], 'the link did not change: not done') }
  { const w = publishWorld({ record: 'live', rotateAnswer: async () => ({ ok: false, status: 502, json: async () => ({}) }) }); const r = await send('rotate_publish_link', {}, w); assert.deepEqual([r.status, r.code], ['failed', 'snapshot_failed']) }
  // ---- configure_publish
  { const w = publishWorld({ record: 'live' }); const r = await send('configure_publish', { allowPdf: true, visibility: 'public' }, w); assert.deepEqual([r.status, r.code], ['done', null]); assert.deepEqual(writes(w), [['PATCH', '/api/publish/abc123', { allowPdf: true, visibility: 'public' }]], 'PATCH /api/publish/{slug} with exactly the named settings') }
  { const w = publishWorld({ record: 'live' }); const r = await send('configure_publish', { qaEnabled: true, qaDailyCap: 10, qaMonthlyCap: 100 }, w); assert.deepEqual([r.status, r.code], ['done', null]); assert.deepEqual(writes(w)[0][2], { qaEnabled: true, qaDailyCap: 10, qaMonthlyCap: 100 }) }
  { const w = publishWorld({ record: 'live', patchAnswer: async (body, world) => ({ ok: true, status: 200, json: async () => ({ deck: { ...world.record, allowPdf: false } }) }) }); const r = await send('configure_publish', { allowPdf: true }, w); assert.deepEqual([r.status, r.code], ['failed', 'write_failed'], 'the answer does not show the setting: not done') }
  { const w = publishWorld({ record: 'live', patchAnswer: async () => ({ ok: false, status: 409, json: async () => ({}) }) }); const r = await send('configure_publish', { allowPdf: true }, w); assert.deepEqual([r.status, r.code], ['failed', 'write_failed']) }
  { const w = publishWorld({ record: undefined }); const r = await send('configure_publish', { allowPdf: true }, w); assert.deepEqual([r.status, r.code], ['failed', 'not_published']); assert.deepEqual(writes(w), []) }
  for (const bad of [{ passcode: 'abcdef' }, { visibility: 'restricted' }, { qaEnabled: true }, { slug: 'x' }, {}]) { const w = publishWorld({ record: 'live' }); const r = await send('configure_publish', bad, w); assert.deepEqual([r.status, r.code], ['failed', 'invalid_args'], JSON.stringify(bad)); assert.deepEqual(w.calls, [], 'nothing is read or sent') }
  // ---- the dialog's own requests only: nothing paid, no wizard, no narration
  { const calls = []; for (const [a, args, world] of [['publish_deck', {}, publishWorld()], ['republish_deck', {}, publishWorld({ record: 'live' })], ['unpublish_deck', {}, publishWorld({ record: 'live' })], ['rotate_publish_link', {}, publishWorld({ record: 'live' })], ['configure_publish', { qaEnabled: true, qaDailyCap: 1, qaMonthlyCap: 2, narrationEnabled: true, narrationBudgetMinutes: 10 }, publishWorld({ record: 'live' })], ['copy_publish_link', {}, publishWorld({ record: 'live' })]]) { await send(a, args, world); calls.push(...world.calls) }
    assert.ok(calls.length > 6 && calls.every(([, url]) => url.startsWith('/api/publish')), 'every request goes to /api/publish...'); assert.equal(calls.some(([, url]) => /narration|script|render|audio/.test(url)), false, 'never a narration script or a recording (the wizard\'s paid steps)') }
  // ---- no deck on screen
  { const w = publishWorld({ record: 'live' }); const r = await rf(publishFrame('copy_publish_link', {}, { presentationId: '' }), { displayed: displayed(), publish: w.deps }); assert.deepEqual([r.status, r.code], ['failed', 'no_deck']); assert.deepEqual(w.calls, []) }
}

// ============================================================================================================================================
// 4. The entry point
// ============================================================================================================================================
async function entryChecks(mods = M) {
  const rf = (f, deps, opts = {}) => runFrame(f, deps, { ...opts, mods })
  const w = deckWorld(); const base = { displayed: displayed(), deckOps: deckDeps(w) }
  // not the deck on screen / not this session
  { const r = await rf(deckFrame('goto_slide', { slide_index: 0, slide_id: 's1', expected_slide_count: 3 }, { presentationId: 'another' }), base); assert.deepEqual([r.status, r.code], ['failed', 'not_owner'], 'a request for another deck'); assert.deepEqual(w.calls, []) }
  { const r = await rf(deckFrame('goto_slide', { slide_index: 0, slide_id: 's1', expected_slide_count: 3 }), base, { ownerRecord: { sessionId: 'other-session', isCurrent: () => true } }); assert.deepEqual([r.status, r.code], ['failed', 'not_owner'], 'a socket of another session') }
  { const r = await rf(deckFrame('goto_slide', { slide_index: 0, slide_id: 's1', expected_slide_count: 3 }, { sessionId: 'other' }), base); assert.deepEqual([r.status, r.code], ['failed', 'not_owner'], 'a frame for another session') }
  { const r = await rf(deckFrame('goto_slide', { slide_index: 0, slide_id: 's1', expected_slide_count: 3 }), { ...base, displayed: displayed({ deckOwnerSessionId: 'someone-else' }) }); assert.deepEqual([r.status, r.code], ['failed', 'not_owner'], 'a foreign deck on screen') }
  // no deck named: only a blank canvas can go ahead
  for (const a of ['goto_slide', 'add_blank_slide', 'change_layout', 'rename_deck', 'duplicate_deck', 'delete_deck', 'present', 'set_view_mode', 'set_slide_rail']) { const r = await rf(deckFrame(a, {}, { presentationId: '' }), base); assert.deepEqual([r.status, r.code], ['failed', 'no_deck'], `${a} with no deck`) }
  assert.deepEqual(w.calls, []); assert.deepEqual(w.sessionCalls, [])
  { const r = await rf(deckFrame('start_blank_canvas', {}, { presentationId: '' }), { displayed: displayed({ presentationId: null }), deckOps: deckDeps(deckWorld()) }); assert.deepEqual([r.status, r.code], ['done', null], 'a blank canvas needs no deck (Director sends an empty presentation id: c2-deck-contract.md :87)') }
  // invalid args, unsupported actions, groups off
  { const r = await rf(deckFrame('goto_slide', { slide_index: 'x' }), base); assert.deepEqual([r.status, r.code], ['failed', 'invalid_args']) }
  { const r = await rf(deckFrame('fly_to_moon', {}), base); assert.deepEqual([r.status, r.code], ['failed', 'unsupported']) }
  { const r = await rf(deckFrame('copy_publish_link', {}), base); assert.deepEqual([r.status, r.code], ['failed', 'unsupported'], 'a publish action in the deck group') }
  { const r = await rf(deckFrame('goto_slide', { slide_index: 0, slide_id: 's1', expected_slide_count: 3 }), { displayed: displayed() }); assert.deepEqual([r.status, r.code], ['failed', 'flag_off'], 'no deck_ops deps (the flag is off on the page)') }
  { const r = await rf(deckFrame('fly_to_moon', {}), { displayed: displayed() }); assert.deepEqual([r.status, r.code], ['failed', 'flag_off'], 'a group that is off says flag_off before it says anything about the action') }
  { const r = await rf(publishFrame('copy_publish_link', {}), base); assert.deepEqual([r.status, r.code], ['failed', 'flag_off'], 'no publish deps') }
  { const r = await rf(frame('themes', 'save_theme', {}), base); assert.deepEqual([r.status, r.code], ['failed', 'flag_off'], 'not a C2 group') }
  // the budget: a run that never answers is answered `timeout` inside Director's 25 s; a thrown error is `write_failed`
  { const t = fakeTimers(); const hang = deckWorld(); hang.viewer.setMode = () => new Promise(() => {}) // never settles
    const run = loadAll(mods.texts, ALL_ON, { setTimeout: t.set, clearTimeout: t.clear }).run; const f = deckFrame('set_view_mode', { mode: 'edit' }); const request = mods.parity.chatParityRequest(f)
    const pending = run.runChatParityC2Action(request, owner, { displayed: displayed(), deckOps: deckDeps(hang) }, f); await Promise.resolve(); await Promise.resolve()
    assert.ok(mods.publish.CHAT_PARITY_PUBLISH_BUDGET_MS < 25_000 && mods.publish.CHAT_PARITY_PUBLISH_BUDGET_MS > 0, 'the publish budget is inside Director\'s 25 s as well (publish.py:47)')
    assert.equal(t.count, 1, 'one timer for the run'); assert.ok(t.last.ms < 25_000 && t.last.ms === mods.deckops.CHAT_PARITY_DECKOPS_BUDGET_MS, 'the budget is inside Director\'s window'); t.fire(); const out = await pending
    assert.deepEqual(plain(out.data), { request_id: request.requestId, status: 'failed', error_code: 'timeout' }); assert.equal(out.after, null) }
  { const t = fakeTimers(); const ok = deckWorld(); const run = loadAll(mods.texts, ALL_ON, { setTimeout: t.set, clearTimeout: t.clear }).run; const f = deckFrame('present', {}); const out = await run.runChatParityC2Action(mods.parity.chatParityRequest(f), owner, { displayed: displayed(), deckOps: deckDeps(ok) }, f); assert.equal(out.data.status, 'done'); assert.equal(t.count, 0, 'the timer is cleared when the run answers') }
  { const t = fakeTimers(); const pw = publishWorld({ record: 'live' }); const run = loadAll(mods.texts, ALL_ON, { setTimeout: t.set, clearTimeout: t.clear }).run; const f = publishFrame('copy_publish_link', {}); await run.runChatParityC2Action(mods.parity.chatParityRequest(f), owner, { displayed: displayed(), publish: pw.deps }, f) }
  { const boom = deckWorld(); boom.viewer.setMode = async () => { throw new Error('boom') }; const r = await rf(deckFrame('set_view_mode', { mode: 'edit' }), { displayed: displayed(), deckOps: deckDeps(boom) }); assert.deepEqual([r.status, r.code], ['failed', 'write_failed'], 'a thrown error is a failure, never a rejection') }
  { const boom = publishWorld({ record: 'live' }); boom.deps.fetch = async () => { throw new Error('offline') }; const r = await rf(publishFrame('republish_deck', {}), { displayed: displayed(), publish: boom.deps }); assert.deepEqual([r.status, r.code], ['failed', 'write_failed'], 'offline') }
  // the answer is built on the request's own id, whatever the failure
  for (const [a, args] of [['goto_slide', { slide_index: 9 }], ['nope', {}], ['rename_deck', {}]]) { const f = deckFrame(a, args); const r = await rf(f, base); assert.equal(r.resultFrame.payload.request_id, f.payload.request_id, a) }
}

// ============================================================================================================================================
// 5. The wiring, run for real from the marked lines
// ============================================================================================================================================
const markedLines = (text, rel) => text.split('\n').filter(line => CHAT_PARITY_C2_MARKER_RE.test(line))
/** The block of marked lines from the line that starts with `from` up to and including the first marked line equal to `to` (trimmed). */
function blockOf(text, from, to) {
  const lines = text.split('\n'); const start = lines.findIndex(line => line.trim().startsWith(from)); assert.ok(start >= 0, `a line starts with ${from}`)
  const end = lines.findIndex((line, i) => i >= start && line === to); assert.ok(end >= start, `${to} closes the block`)
  const block = lines.slice(start, end + 1); assert.ok(block.every(line => CHAT_PARITY_C2_MARKER_RE.test(line)), 'every line of the block carries the marker'); return block.join('\n')
}
/** Runs a block of marked lines as the body of a function whose scope is `scope`, returning `exposed` names. */
function runBlock(block, scope, exposed) {
  const wrapper = `export function harness({ ${Object.keys(scope).join(', ')} }) {\n${block}\nreturn { ${exposed.join(', ')} }\n}`
  const module = { exports: {} }
  new Function('module', 'exports', compile(wrapper, 'harness.ts'))(module, module.exports)
  return module.exports.harness(scope)
}
async function viewerChecks(t = texts) {
  const block = blockOf(t[VIEWER], '// CHAT-PARITY-C2 (NEXT_PUBLIC_STUDIO_CHAT_PARITY_DECKOPS', '  }, []) // CHAT-PARITY-C2: registered once; its methods read the live ref above at call time')
  const calls = [], effects = [], refs = []
  const handlers = {
    handleAddSlide: async (layout, options) => { calls.push(['addSlide', layout, options]) }, handleChangeLayout: async (index, layout) => { calls.push(['changeLayout', index, layout]) },
    handleFullscreen: async () => { calls.push(['fullscreen']) }, handleToggleEditModeButton: async edit => { calls.push(['mode', edit]) },
  }
  const state = { viewerIsReady: true, isSlideMutationPending: false, slideMutationPendingRef: { current: false }, isEditMode: false, showThumbnails: true }
  const bus = { viewer: null }
  let importCount = 0
  const build = env => {
    effects.length = 0; refs.length = 0; importCount = 0
    const useRef = initial => { const ref = { current: initial }; refs.push(ref); return ref }
    const useEffect = fn => { effects.push(fn) }
    const rewritten = block.replace("void import('@/lib/studio-chat-parity-deckops')", 'void __importBus()')
    const scope = { useRef, useEffect, ...handlers, ...state, process: { env }, setShowThumbnails: visible => { calls.push(['rail', visible]) }, SlideLayoutType: undefined, __importBus: () => { importCount++; return Promise.resolve({ chatParityDeckOpsBus: bus }) } }
    runBlock(rewritten, scope, [])
    return effects[0]
  }
  // flag off: the ref is never assigned, the effect registers nothing, nothing is imported
  { bus.viewer = null; const effect = build({}); assert.equal(typeof effect, 'function'); const cleanup = effect(); await Promise.resolve(); await Promise.resolve(); assert.equal(importCount, 0, 'flag off: the bus module is not even loaded'); assert.equal(bus.viewer, null); assert.equal(cleanup, undefined); assert.equal(refs[0].current, null, 'flag off: the live ref is not assigned') }
  { bus.viewer = null; const effect = build({ [FLAG_DECKOPS]: 'false' }); effect(); await Promise.resolve(); assert.equal(importCount, 0, '"false" is off'); const effect2 = build({ [FLAG_DECKOPS]: 'TRUE' }); effect2(); await Promise.resolve(); assert.equal(importCount, 0, 'only the exact string "true" is on') }
  // flag on: the bus gets a viewer whose methods call THIS render's handlers and read THIS render's state
  bus.viewer = null; const effect = build({ [FLAG_DECKOPS]: 'true' }); const cleanup = effect(); await Promise.resolve(); await Promise.resolve()
  assert.equal(importCount, 1, 'loaded once, inside the effect'); assert.ok(bus.viewer, 'registered')
  const live = refs[0]; assert.equal(live.current.ready, true)
  await bus.viewer.addSlide('B1-blank', { position: 2, backgroundColor: '#fff' }); await bus.viewer.changeLayout(1, 'S4-comparison'); await bus.viewer.present(); await bus.viewer.setMode(true); bus.viewer.setRail(false)
  assert.deepEqual(calls.splice(0), [['addSlide', 'B1-blank', { position: 2, backgroundColor: '#fff' }], ['changeLayout', 1, 'S4-comparison'], ['fullscreen'], ['mode', true], ['rail', false]], 'each method is the viewer\'s own handler, with the same arguments')
  assert.deepEqual(bus.viewer.state(), { ready: true, mutationPending: false, editMode: false, rail: true })
  live.current = { ...live.current, ready: false, pending: true, edit: true, rail: false }; assert.deepEqual(bus.viewer.state(), { ready: false, mutationPending: true, editMode: true, rail: false }, 'the state is read at call time, from the latest render')
  live.current = null; assert.deepEqual(bus.viewer.state(), { ready: false, mutationPending: false, editMode: false, rail: true }, 'a viewer that is gone reads as not ready'); await bus.viewer.addSlide('B1-blank'); assert.deepEqual(calls, [], 'and runs nothing')
  cleanup(); assert.equal(bus.viewer, null, 'unmount clears the bus')
  // an unmount before the module arrived registers nothing
  { bus.viewer = null; const e = build({ [FLAG_DECKOPS]: 'true' }); const c = e(); c(); await Promise.resolve(); await Promise.resolve(); assert.equal(bus.viewer, null, 'unmounted before the import resolved: nothing registered') }
  // the ready, pending, edit and rail inputs are the viewer's own state (text pins)
  assert.match(block, /ready: viewerIsReady, pending: isSlideMutationPending \|\| slideMutationPendingRef\.current, edit: isEditMode, rail: showThumbnails/, 'the live state is the viewer\'s own')
  assert.equal((t[VIEWER].match(/process\.env\.NEXT_PUBLIC_STUDIO_CHAT_PARITY_DECKOPS/g) || []).length, 2, 'the flag is read inline twice (the ref and the effect), as the identity group\'s bus is')
}

async function pageChecks(t = texts, mods = M) {
  const block = blockOf(t[PAGE], '// CHAT-PARITY-C2 (NEXT_PUBLIC_STUDIO_CHAT_PARITY_DECKOPS / _PUBLISH', '  } // CHAT-PARITY-C2')
  const log = []
  const w = deckWorld()
  const refs = []
  const calls = { updateSession: [], deleteSession: [], loadSession: [], storage: [], send: [], publishedLink: [], clipboard: [], opened: [], runs: [] }
  const sessionsHook = { updateSession: async (id, patch) => { calls.updateSession.push([id, patch]); return { title: patch.title } }, deleteSession: async id => { calls.deleteSession.push(id); return true }, loadSession: async id => { calls.loadSession.push(id); return { finalPresentationId: 'deck-1', title: 'Q3', currentStage: 6, slideCount: 3, finalPresentationUrl: 'https://layout.example/p/deck-1' } } }
  const store = kind => ({ removeItem: key => calls.storage.push([kind, 'remove', key]), getItem: key => (key === 'last:u1' ? 'sess-1' : null) })
  const build = (flags, extra = {}) => {
    const scope = {
      useChatSessions: () => sessionsHook, useRef: initial => { const ref = { current: initial }; refs.push(ref); return ref },
      blankPlaceholderDismissed: false, studioPartialMetadata: false, isGeneratingFinal: false, isGeneratingStrawman: false, templateReuseAwaitingInput: false, slideComposeThumbnailJobs: [], templateModeOn: false, oneLiveTabSuperseded: false,
      runChatParityC2Action: async (request, ownerRecord, deps, message) => { calls.runs.push({ request, deps, message }); return { data: { request_id: request.requestId, status: 'done', error_code: null }, after: () => calls.send.push('after') } },
      elementDirectiveGenerationOwnerRef: { current: { sessionId: 'sess-1', deckOwnerSessionId: 'sess-1', presentationId: 'deck-1', epoch: 1 } },
      STUDIO_CHAT_PARITY_DECKOPS_ENABLED: flags.deckops, STUDIO_CHAT_PARITY_PUBLISH_ENABLED: flags.publish,
      chatParityDeckOpsBus: { viewer: w.viewer }, layoutServiceApis: { goToSlide: w.goTo }, composeViewerApiRef: { current: { composeGetState: async () => composeReceipt } },
      parseStudioNativeSlideOrder: receipt => (receipt?.success === true && receipt.placeholders.length === 0 ? { nativeCount: receipt.slides.length, currentVisualIndex: receipt.current_visual_index, slideIds: receipt.slides.map(s => s.slide_id) } : null),
      readChatParityInventoryLayout: async input => { calls.inventory = input; return 'C1-text' }, fetch: async () => ({ ok: true }), getLayoutServiceUrl: () => 'https://layout.example', addSlideV2BlankNativeOptions: position => ({ position, blank: true }),
      studioShell: true, studioWelcome: true, handleStartOnBlankCanvas: () => { calls.send.push('startBlank') }, user: { id: 'u1', email: 'u@example.com' },
      sessionCacheKey: (o, s) => `session:${o}:${s}`, sessionMetadataCacheKey: (o, s) => `meta:${o}:${s}`, lastBuilderSessionKey: o => `last:${o}`, handleNewChatWrappedRef: { current: () => calls.send.push('newChat') },
      evaluateLayoutViewerUrl: (url, policy) => ({ status: 'allowed', url }), LAYOUT_VIEWER_URL_POLICY: { policy: true }, publishedLink: record => { calls.publishedLink.push(record); return 'https://deckster.example/p/x' },
      navigator: { clipboard: { writeText: async text => { calls.clipboard.push(text) } } }, window: { open: (url, target) => { calls.opened.push([url, target]); return { opener: 'x' } } }, document: { fullscreenElement: null }, crypto: { randomUUID: () => 'uuid-1' },
      sessionStorage: store('session'), localStorage: store('local'), chatParityBus: { send: data => { calls.send.push(data) } }, process: { env: { NEXT_PUBLIC_STUDIO_DUPLICATE_DECK: 'true' } },
      ...extra,
    }
    return runBlock(block, scope, ['runChatParityC2Frame', 'chatParityC2BlankRef', 'chatParityC2Building'])
  }
  const composeReceipt = { success: true, action: 'composeGetState', current_visual_index: 1, real_slide_count: 2, visual_section_count: 2, total_visual_sections: 2, placeholders: [], current_placeholder_job_id: null, slides: [{ slide_id: 'a', visual_index: 0, layout_index: 0 }, { slide_id: 'b', visual_index: 1, layout_index: 1 }] }
  const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve() }
  const request = { requestId: 'sa_1', group: 'deck_ops', action: 'goto_slide', presentationId: 'deck-1', args: {}, label: '' }
  const ownerRecord = { sessionId: 'sess-1', isCurrent: () => true }
  // flag off both: no deps at all (the entry point answers flag_off), the answer is sent on the delivering socket
  { const h = build({ deckops: false, publish: false }); h.runChatParityC2Frame(request, { session_id: 'sess-1' }, ownerRecord); await Promise.resolve(); await Promise.resolve()
    const run = calls.runs.pop(); assert.deepEqual(Object.keys(run.deps).sort(), ['displayed'], 'both flags off: the runner gets no group deps'); assert.equal(run.message.session_id, 'sess-1'); assert.deepEqual(calls.send.splice(0).map(x => (typeof x === 'string' ? x : x.status)), ['done', 'after'], 'the answer is sent, then the follow-up') }
  // deck_ops on: the deps are the click paths' own
  const h = build({ deckops: true, publish: false }); h.runChatParityC2Frame(request, { session_id: 'sess-1' }, ownerRecord); await Promise.resolve(); await Promise.resolve()
  const run = calls.runs.pop(); const d = run.deps.deckOps; assert.deepEqual(Object.keys(run.deps).sort(), ['deckOps', 'displayed'], 'deck_ops on, publish off: only the deck_ops deps'); calls.send.length = 0
  assert.deepEqual(run.deps.displayed(), { sessionId: 'sess-1', deckOwnerSessionId: 'sess-1', presentationId: 'deck-1', epoch: 1 }, 'the K5 owner record'); assert.equal(d.sessionId(), 'sess-1')
  assert.strictEqual(d.viewer(), w.viewer, 'the viewer is the one on the bus'); assert.strictEqual(d.goToSlide(), w.goTo, 'go-to-slide is the viewer\'s own (layoutServiceApis.goToSlide)')
  assert.deepEqual(plain(await d.readOrder()), { nativeCount: 2, currentVisualIndex: 1, slideIds: ['a', 'b'] }, 'Layout\'s own order, as the stale-viewer guard reads it'); assert.equal(await build({ deckops: true }, { composeViewerApiRef: { current: null } }).runChatParityC2Frame && (await (async () => { build({ deckops: true }, { composeViewerApiRef: { current: null } }).runChatParityC2Frame(request, {}, ownerRecord); return calls.runs.pop().deps.deckOps.readOrder() })()), null, 'no compose api: null')
  { const placeholders = { ...composeReceipt, placeholders: [{ job_id: 'j', visual_index: 1 }] }; build({ deckops: true }, { composeViewerApiRef: { current: { composeGetState: async () => placeholders } } }).runChatParityC2Frame(request, {}, ownerRecord); assert.equal(await calls.runs.pop().deps.deckOps.readOrder(), 'busy', 'a compose placeholder reads as busy') }
  { build({ deckops: true }, { composeViewerApiRef: { current: { composeGetState: async () => { throw new Error('x') } } } }).runChatParityC2Frame(request, {}, ownerRecord); assert.equal(await calls.runs.pop().deps.deckOps.readOrder(), null, 'a throwing read is null') }
  assert.equal(await d.readLayout(1), 'C1-text'); assert.deepEqual(calls.inventory.presentationId, 'deck-1'); assert.equal(calls.inventory.baseUrl, 'https://layout.example'); assert.equal(calls.inventory.slideIndex, 1, 'Layout\'s inventory for the displayed deck')
  assert.deepEqual(plain(d.blankOptions(3)), { position: 3, blank: true }, 'the Add Slide panel\'s own blank options')
  assert.deepEqual(d.gate(), { building: false, paused: false, templateMode: false })
  for (const [name, patch, key] of [['isGeneratingFinal', { isGeneratingFinal: true }, 'building'], ['isGeneratingStrawman', { isGeneratingStrawman: true }, 'building'], ['templateReuseAwaitingInput', { templateReuseAwaitingInput: true }, 'building'], ['studioPartialMetadata', { studioPartialMetadata: true }, 'building'], ['a compose job', { slideComposeThumbnailJobs: [{}] }, 'building'], ['oneLiveTabSuperseded', { oneLiveTabSuperseded: true }, 'paused'], ['templateModeOn', { templateModeOn: true }, 'templateMode']]) {
    build({ deckops: true }, patch).runChatParityC2Frame(request, {}, ownerRecord); const gate = calls.runs.pop().deps.deckOps.gate(); assert.equal(gate[key], true, `${name} gates writes (${key})`) }
  await flush(); calls.send.length = 0
  assert.equal(d.fullscreen(), false); assert.equal(d.blank.available(), true, 'the welcome is on stage and the canvas not started'); d.blank.start(); assert.deepEqual(calls.send.splice(0), ['startBlank'], 'the welcome\'s own handler')
  { build({ deckops: true }, { blankPlaceholderDismissed: true }).runChatParityC2Frame(request, {}, ownerRecord); assert.equal(calls.runs.pop().deps.deckOps.blank.available(), false, 'a started canvas is not started again') }
  { build({ deckops: true }, { studioWelcome: false }).runChatParityC2Frame(request, {}, ownerRecord); assert.equal(calls.runs.pop().deps.deckOps.blank.available(), false, 'no welcome on stage (a deck is open): never started over it') }
  { build({ deckops: true }, { studioShell: false }).runChatParityC2Frame(request, {}, ownerRecord); assert.equal(calls.runs.pop().deps.deckOps.blank, null, 'no Studio shell, no such control') }
  const hh = build({ deckops: true }); assert.equal(hh.chatParityC2BlankRef.current, false, 'the ref follows blankPlaceholderDismissed'); assert.equal(build({ deckops: true }, { blankPlaceholderDismissed: true }).chatParityC2BlankRef.current, true)
  // the session calls are the Sessions list's own
  assert.equal(await d.session.rename('sess-1', 'Q3 plan'), 'Q3 plan'); assert.deepEqual(calls.updateSession.splice(0), [['sess-1', { title: 'Q3 plan' }]], 'PATCH of the title through the hook\'s updateSession')
  assert.equal(await d.session.deleteDeck('sess-1'), true); assert.deepEqual(calls.deleteSession.splice(0), ['sess-1'], 'useChatSessions.deleteSession')
  assert.deepEqual(calls.storage.splice(0), [['session', 'remove', 'session:u1:sess-1'], ['session', 'remove', 'meta:u1:sess-1'], ['local', 'remove', 'last:u1']], 'the Sessions list\'s cache cleanup, and the last-builder-session key when it points at the deleted deck')
  await flush(); calls.send.length = 0
  d.session.startNew(); assert.deepEqual(calls.send.splice(0), ['newChat'], 'the Builder\'s New flow')
  { build({ deckops: true }, { sessionStorage: { removeItem() { throw new Error('blocked') } }, localStorage: { getItem() { throw new Error('blocked') }, removeItem() {} } }).runChatParityC2Frame(request, {}, ownerRecord); assert.equal(await calls.runs.pop().deps.deckOps.session.deleteDeck('sess-1'), true, 'a browser that cannot clear its cache does not undo a delete the server acknowledged') }
  { const failing = { ...sessionsHook, deleteSession: async () => false }; build({ deckops: true }, { useChatSessions: () => failing }).runChatParityC2Frame(request, {}, ownerRecord); assert.equal(await calls.runs.pop().deps.deckOps.session.deleteDeck('sess-1'), false, 'not acknowledged: false, and no cache is cleared'); assert.deepEqual(calls.storage, []) }
  assert.ok(d.session.duplicate, 'NEXT_PUBLIC_STUDIO_DUPLICATE_DECK on: the Decks page\'s duplicate'); assert.equal((await d.session.duplicate.loadSession('sess-1')).title, 'Q3'); assert.deepEqual(d.session.duplicate.evaluateUrl('u'), { status: 'allowed', url: 'u' })
  assert.deepEqual([d.session.duplicate.deps.layoutBaseUrl(), d.session.duplicate.deps.newId(), d.session.duplicate.deps.now() instanceof Date], ['https://layout.example', 'uuid-1', true], 'the deps the Decks page builds')
  { build({ deckops: true }, { process: { env: {} } }).runChatParityC2Frame(request, {}, ownerRecord); assert.equal(calls.runs.pop().deps.deckOps.session.duplicate, null, 'the duplicate flag off: no duplicate') }
  // publish on: the dialog's own requests
  { const hp = build({ deckops: false, publish: true }); hp.runChatParityC2Frame({ ...request, group: 'publish', action: 'copy_publish_link' }, {}, ownerRecord); const r = calls.runs.pop(); const p = r.deps.publish; assert.deepEqual(Object.keys(r.deps).sort(), ['displayed', 'publish'], 'publish on, deck_ops off: only the publish deps')
    assert.equal(p.sessionId(), 'sess-1'); assert.equal(p.link({ slug: 'x', publicUrl: 'u' }), 'https://deckster.example/p/x', 'the dialog\'s own link helper'); assert.equal(calls.publishedLink.length, 1)
    assert.equal(await p.copy('text'), true); assert.deepEqual(calls.clipboard, ['text'], 'navigator.clipboard.writeText, as the dialog\'s useCopyToClipboard'); assert.equal(p.open('https://deckster.example/p/x'), true); assert.deepEqual(calls.opened, [['https://deckster.example/p/x', '_blank']], 'window.open: a new tab')
    assert.deepEqual(p.gate(), { building: false, paused: false }); assert.equal((await p.loadSession('sess-1')).finalPresentationId, 'deck-1')
    { build({ publish: true }, { navigator: { clipboard: { writeText: async () => { throw new Error('denied') } } } }).runChatParityC2Frame(request, {}, ownerRecord); assert.equal(await calls.runs.pop().deps.publish.copy('x'), false, 'a blocked clipboard') }
    { build({ publish: true }, { window: { open: () => null } }).runChatParityC2Frame(request, {}, ownerRecord); assert.equal(calls.runs.pop().deps.publish.open('https://x.example'), false, 'a blocked popup') }
    { build({ publish: true }, { window: { open: () => { throw new Error('x') } } }).runChatParityC2Frame(request, {}, ownerRecord); assert.equal(calls.runs.pop().deps.publish.open('https://x.example'), false) } }
  // the answer is not sent on a socket that is no longer current, but the follow-up still runs
  { await flush(); calls.send.length = 0; const h2 = build({ deckops: true }); h2.runChatParityC2Frame(request, {}, { sessionId: 'sess-1', isCurrent: () => false }); await flush(); assert.deepEqual(calls.send.splice(0), ['after'], 'a stale socket gets no answer') }
  // the routing line in the existing runner
  const routing = t[PAGE].split('\n').filter(line => line.includes('isChatParityC2Group(request.group)'))
  assert.equal(routing.length, 1); assert.ok(CHAT_PARITY_C2_MARKER_RE.test(routing[0]))
  const route = (c2Flags, group, ownerCurrent = true) => {
    const sent = [], ran = []
    const fn = runBlock(`const runner = (request, message, owner) => {\n${routing[0]}\nreturn 'fell through'\n}`, { isChatParityC2Group: mods.c2.isChatParityC2Group, chatParityC2Refusal: req => mods.c2.chatParityC2Refusal(req, c2Flags), chatParityBus: { send: data => sent.push(data) }, chatParityResult: mods.parity.chatParityResult, runChatParityC2Frame: (...args) => ran.push(args) }, ['runner'])
    const outcome = fn.runner({ requestId: 'sa_9', group, action: group === 'publish' ? 'copy_publish_link' : 'goto_slide' }, {}, { isCurrent: () => ownerCurrent })
    return { outcome, sent: plain(sent), ran: ran.length }
  }
  assert.deepEqual(route({ deck_ops: true, publish: false }, 'deck_ops'), { outcome: undefined, sent: [], ran: 1 }, 'a C2 group with its flag on goes to the C2 runner')
  assert.deepEqual(route({ deck_ops: false, publish: false }, 'deck_ops'), { outcome: undefined, sent: [{ request_id: 'sa_9', status: 'failed', error_code: 'flag_off' }], ran: 0 }, 'its flag off: answered flag_off at once (nothing runs)')
  assert.deepEqual(route({ deck_ops: false, publish: false }, 'deck_ops', false), { outcome: undefined, sent: [], ran: 0 }, 'a stale socket is not answered')
  assert.deepEqual(route({ deck_ops: true, publish: true }, 'themes'), { outcome: 'fell through', sent: [], ran: 0 }, 'another group falls through to the older runner, untouched')
  assert.deepEqual(route({ deck_ops: true, publish: true }, 'publish'), { outcome: undefined, sent: [], ran: 1 })
  // placement: the routing line sits right after the older runner reads the request, before the older refusal
  const lines = t[PAGE].split('\n'); const at = lines.findIndex(line => line.includes('isChatParityC2Group(request.group)'))
  assert.match(lines[at - 1], /const request = chatParityRequest\(message\); if \(!request\) return \/\/ CHAT-PARITY$/, 'right after the request is read'); assert.match(lines[at + 1], /const refusal = chatParityRefusal\(request\)/, 'before the older refusal')
  assert.equal(CHAT_PARITY_C2_MARKER_RE.test(lines[at - 1]), false, 'the older line is not edited')
  // the hook: untouched (the request frame and the caps ride the older seam)
  assert.equal(t[HOOK], baseText(HOOK), 'the socket hook is the base\'s file (no line of it changes)')
  assert.equal(t[RUNNERS], baseText(RUNNERS), 'the older runners file is the base\'s file')
  for (const rel of ['lib/studio-chat-parity-themes.ts', 'lib/studio-chat-parity-identity.ts', 'lib/studio-chat-parity-templates.ts']) assert.equal(read(rel), baseText(rel), `${rel} is the base's file`)
}

// ============================================================================================================================================
// 6. The sources
// ============================================================================================================================================
/** The strips of the changes registered after this one come out first: a later change that touches these files must not hide this change's edits from the identity check. */
const laterStrips = (rel, text, reg = registry) => { const strips = reg.LATER_STRIPS, at = strips.indexOf(stripModule.stripChatParityC2); return (at === -1 ? [] : strips.slice(at + 1)).reduce((out, strip) => { const next = strip(rel, out); return typeof next === 'string' ? next : out }, text) }
const SECRET = /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|xox[bp]-)/
const REWRITTEN = new Set(['export const STUDIO_CHAT_PARITY_ANY_ENABLED = Object.values(CHAT_PARITY_FLAGS).some(Boolean)', 'export const CHAT_PARITY_CAPS: readonly string[] = chatParityCaps(CHAT_PARITY_FLAGS)'])
function lineDiff(was, now) {
  const count = new Map(); for (const line of was.split('\n')) count.set(line, (count.get(line) || 0) + 1)
  const added = []; for (const line of now.split('\n')) { const n = count.get(line) || 0; if (n > 0) count.set(line, n - 1); else added.push(line) }
  const removed = []; for (const [line, n] of count) for (let i = 0; i < n; i++) removed.push(line)
  return { added, removed }
}
function sourceChecks(t, mod = stripModule, reg = registry) {
  const { stripChatParityC2, CHAT_PARITY_C2_FILES: files, CHAT_PARITY_C2_ENV_BLOCK: block } = mod
  // the strip gives each touched file its base back, byte for byte, and is idempotent: flag off is the base
  for (const rel of files) {
    const now = laterStrips(rel, t[rel], reg), out = stripChatParityC2(rel, now)
    assert.equal(out, baseText(rel), `${rel}: without this change's edits the file is the base's, byte for byte`)
    assert.equal(stripChatParityC2(rel, out), out, `${rel}: stripping twice changes nothing more`)
    assert.notEqual(now, baseText(rel), `${rel}: the change is there to strip`)
  }
  for (const rel of ['hooks/use-deckster-websocket-v2.ts', 'lib/studio-chat-parity-runners.ts', ENV, REGISTRY]) assert.equal(stripChatParityC2(rel, 'x\nCHAT-PARITY-C2\n'), 'x\nCHAT-PARITY-C2\n', `${rel}: a file this change does not own comes back as it is`)
  assert.equal(stripChatParityC2(PAGE, 5), 5, 'a text that is not a string comes back as it is')
  // every line a touched file gains carries the marker; the only base lines lost are the two rewritten ones
  for (const rel of files) {
    const diff = lineDiff(baseText(rel), laterStrips(rel, t[rel], reg))
    for (const line of diff.added) assert.match(line, CHAT_PARITY_C2_MARKER_RE, `${rel}: a line added to the file carries the marker: ${line.trim().slice(0, 100)}`)
    for (const line of diff.removed) assert.ok(rel === PARITY && REWRITTEN.has(line), `${rel}: a base line is lost that this change does not rewrite: ${line.trim().slice(0, 100)}`)
    assert.equal(diff.removed.length, rel === PARITY ? 2 : 0, `${rel}: the base lines this change rewrites`)
  }
  assert.deepEqual(mod.CHAT_PARITY_C2_FILES, [PARITY, PAGE, VIEWER], 'the existing files this change marks')
  assert.deepEqual([...mod.CHAT_PARITY_C2_NEW_FILES].sort(), [C2, DECKOPS, PUBLISH, RUN, STRIP, SELF].sort(), 'the new files')
  const count = rel => t[rel].split('\n').filter(line => CHAT_PARITY_C2_MARKER_RE.test(line)).length
  assert.ok(count(VIEWER) >= 10 && count(VIEWER) <= 30, 'the viewer gains a few lines (one ref, one effect), in one region'); const viewerLines = t[VIEWER].split('\n'), first = viewerLines.findIndex(l => CHAT_PARITY_C2_MARKER_RE.test(l)), last = viewerLines.length - 1 - [...viewerLines].reverse().findIndex(l => CHAT_PARITY_C2_MARKER_RE.test(l))
  assert.equal(last - first + 1, count(VIEWER), 'all of them are one contiguous block (a separate region, for the other builder\'s viewer lines)')
  assert.ok(count(PAGE) >= 20, 'the page carries its runner block, routing line and imports')
  // the pure files read the env once each (the flag reads are in the older lib), nothing else reads it
  assert.equal((t[PARITY].match(/process\.env\.NEXT_PUBLIC_STUDIO_CHAT_PARITY_DECKOPS\b/g) || []).length, 1); assert.equal((t[PARITY].match(/process\.env\.NEXT_PUBLIC_STUDIO_CHAT_PARITY_PUBLISH\b/g) || []).length, 1)
  for (const rel of [C2, DECKOPS, PUBLISH, RUN, PAGE, HOOK]) assert.equal((t[rel].match(/process\.env\.NEXT_PUBLIC_STUDIO_CHAT_PARITY_(DECKOPS|PUBLISH)\b/g) || []).length, 0, `${rel} does not read the C2 env itself`)
  assert.equal((t[VIEWER].match(/process\.env\.NEXT_PUBLIC_STUDIO_CHAT_PARITY_PUBLISH\b/g) || []).length, 0, 'the viewer has no part in publish')
  // the older proofs this change teaches: the chat parity proof's own-commit walk (one line), and FRONTEND-1's voice-call proof's four-line registry-read edit, byte for byte with #603 / #604
  assert.deepEqual([...mod.CHAT_PARITY_C2_PIN_FILES], [OLD_PROOF], 'the older proofs this change teaches'); assert.deepEqual([...mod.CHAT_PARITY_C2_VOICE_CALL_PIN_FILES], [VOICE_CALL])
  { const now = t[OLD_PROOF], diff = lineDiff(baseText(OLD_PROOF), now)
    assert.equal(stripChatParityC2(OLD_PROOF, now), baseText(OLD_PROOF), `${OLD_PROOF}: without this change's line the proof is the base's, byte for byte`)
    assert.deepEqual([diff.removed.length, diff.added.length], [1, 1], `${OLD_PROOF}: one line changed, nothing else`); assert.ok(diff.added[0].includes(mod.CHAT_PARITY_C2_PIN_MARK) && diff.added[0].includes(BASE_COMMIT), `${OLD_PROOF}: the line carries the pin mark and starts the walk at the base`) }
  { const now = t[VOICE_CALL], diff = lineDiff(baseText(VOICE_CALL), now)
    assert.equal(stripChatParityC2(VOICE_CALL, laterStrips(VOICE_CALL, now, reg)), baseText(VOICE_CALL), `${VOICE_CALL}: without the four lines the proof is the base's, byte for byte`)
    assert.equal(stripChatParityC2(VOICE_CALL, stripChatParityC2(VOICE_CALL, now)), stripChatParityC2(VOICE_CALL, now), `${VOICE_CALL}: stripping twice changes nothing more`)
    assert.deepEqual([diff.removed.length, diff.added.length], [2, 4], `${VOICE_CALL}: two base lines changed and two lines inserted, nothing else`)
    for (const line of diff.added) assert.ok(line.endsWith(mod.CHAT_PARITY_C2_VOICE_CALL_PIN_MARK), `${VOICE_CALL}: a line added carries the registry-read mark: ${line.trim().slice(0, 90)}`)
    const lines = now.split('\n'), at = lines.findIndex(line => line.startsWith("const core = await import('./studio-voice-core-strip.mjs')"))
    assert.ok(at >= 0 && lines[at + 1].startsWith('const laterRegistry = await import(') && lines[at + 2].startsWith('const laterEnvOut = text =>'), `${VOICE_CALL}: the two inserted lines sit right after the strip imports`)
    assert.equal(now.split('\n').filter(line => line.includes('laterEnvOut(')).length, 2, `${VOICE_CALL}: the helper is read by the two .env.example pins`) }
  // .env.example: the base plus the block, after one blank line; both flags documented "false", once
  assert.equal(t[ENV], `${baseText(ENV)}\n${block}`, '.env.example is the base plus the block')
  assert.match(block, new RegExp(`^${FLAG_DECKOPS}="false"$`, 'm')); assert.match(block, new RegExp(`^${FLAG_PUBLISH}="false"$`, 'm'))
  for (const flag of [FLAG_DECKOPS, FLAG_PUBLISH]) assert.equal((t[ENV].match(new RegExp(`^${flag}=`, 'gm')) || []).length, 1, `${flag}: one assignment`)
  assert.equal(/exact "true" enables it/.test(block), false, 'the block does not use the phrase older proofs read')
  assert.equal(t[ENV].split('\n').filter(line => line.startsWith('#') === false && line.trim() !== '').slice(-2).join('|'), `${FLAG_DECKOPS}="false"|${FLAG_PUBLISH}="false"`, 'the block is the last thing in the file, after voice-call\'s')
  assert.ok(t[ENV].indexOf(block) > t[ENV].indexOf('NEXT_PUBLIC_STUDIO_VOICE_CALL_BUTTONS='), 'it comes after voice-call\'s block')
}
function registryChecks(text, texts2 = texts, reg = registry) {
  const { CHAT_PARITY_C2_SCOPE_FILES: scope, stripChatParityC2, CHAT_PARITY_C2_ENV_BLOCK: block } = stripModule
  for (const list of ['LATER_CHANGE_FILES', 'LATER_ENV_BLOCKS', 'LATER_STRIPS']) {
    const start = text.indexOf(`export const ${list} = `), end = text.indexOf('// one line per later change, above this comment', start)
    assert.ok(start >= 0 && end > start, `${list} is in the registry, with its marker comment after the lines`)
    const body = text.slice(start, end).split('\n'), own = body.findIndex(line => line.includes('studio-chat-parity-c2-strip.mjs')), voice = body.findIndex(line => line.includes('studio-voice-call-strip.mjs'))
    assert.ok(own > voice && voice > 0, `${list}: this change's line comes after the voice call's (the end of the stack at the time)`)
    assert.equal(body.filter(line => line.includes('studio-chat-parity-c2-strip.mjs')).length, 1, `${list}: one line names this change's strip`)
    assert.equal(body.findIndex(line => line.includes('one line per later change')) === -1, true)
  }
  const registered = text.split('\n').filter(line => line.includes('studio-chat-parity-c2-strip.mjs'))
  assert.equal(registered.length, 3, 'the registry gains exactly its three lines'); assert.ok(registered.every(line => line.includes('// LATER-CHANGE: FRONTEND-1, chat parity C2')), 'each carries the registry marker')
  assert.deepEqual(lineDiff(baseText(REGISTRY), text).removed, [], 'and loses none')
  assert.equal(lineDiff(baseText(REGISTRY), text).added.filter(line => registered.includes(line)).length, 3, 'the three lines are what it gains (a change registered later adds its own)')
  assert.ok(reg.LATER_STRIPS.includes(stripChatParityC2), 'the strip is registered'); assert.ok(reg.LATER_ENV_BLOCKS.includes(block), 'the block is registered')
  assert.ok([...scope].every(rel => reg.LATER_CHANGE_FILES.has(rel)), 'every scope file is registered')
  for (const rel of CHAT_PARITY_C2_FILES) assert.equal(reg.stripLaterChanges(rel, texts2[rel]), reg.stripLaterChanges(rel, baseText(rel)), `${rel}: read through the registry it is the base's (older proofs read it like that)`)
  assert.equal(reg.stripLaterEnvBlocks(ENV, texts2[ENV]).includes(FLAG_DECKOPS), false, 'the registry takes the block out of .env.example')
}
/** This change's own commits, found by SUBJECT across `rev-list --no-merges` (so a merge of dev does not hide or add any). */
function ownCommits(ref = 'HEAD') { return git('rev-list', '--no-merges', `${BASE_COMMIT}..${ref}`).split('\n').filter(Boolean).filter(commit => git('log', '-1', '--format=%s', commit).startsWith(CHAT_PARITY_C2_SUBJECT)) }
/** The files that differ from the base: what this change's own commits touch, that the COMMITTED diff BASE..HEAD still shows. Nothing is read from the working tree, the index or the untracked files: a polluted tree must not fail the scope check. */
function touchedFiles(commits) { const net = new Set(git('diff', '--name-only', `${BASE_COMMIT}..HEAD`).split('\n').filter(Boolean)); return new Set(commits.flatMap(commit => git('show', '--name-only', '--format=', commit).split('\n')).filter(rel => rel && net.has(rel))) }
function scopeCheck(commits, extra = []) { assert.deepEqual([...touchedFiles(commits), ...extra].filter(rel => !CHAT_PARITY_C2_SCOPE_FILES.has(rel)).sort(), [], 'no file outside this change\'s scope differs from the base') }
function messageProblems(subject, body) {
  const problems = []
  if (!subject.startsWith(CHAT_PARITY_C2_SUBJECT)) problems.push(`the subject starts "${CHAT_PARITY_C2_SUBJECT}"`)
  if (!/^Co-Authored-By: Claude Opus 5\.5 <noreply@anthropic\.com>\s*$/m.test(body)) problems.push('the co-author line')
  return problems
}

// ============================================================================================================================================
// run
// ============================================================================================================================================
await check('0. the Director contract (Director\'s own code at the pinned commit): caps, actions, read-only set, extra codes, delete token, layouts, name bound, windows, result fields, and every file:line cited', () => contractChecks())
await check('1. the pure part: flags and caps (a cap only with its flag, after the older groups\'), refusals, every action\'s args (positives and negatives), the evidence helpers', () => pureChecks())
await check('2. deck_ops frame by frame: each Director frame runs the right handler with the right args; done only on evidence; stale targets, builds, pending writes and the delete token are honoured; every answer has the shape Director reads', () => deckOpsChecks())
await check('3. publish frame by frame, against a fake of the Publish dialog\'s own endpoints: the dialog\'s requests only, a first publish never overwrites a live record, a republish sends no settings, no passcode / restricted / slug / link, no link back to Director', () => publishChecks())
await check('4. the entry point: owner check, no deck, invalid args, unsupported, a group whose flag is off, the budget inside Director\'s 25 s, a thrown error', () => entryChecks())
await check('5a. the viewer\'s one effect, run from its marked lines: flag off registers nothing and loads nothing; on, each method is the viewer\'s own handler and the state is read at call time', () => viewerChecks())
await check('5b. the Builder page\'s runner block and routing line, run from their marked lines: the deps are the click paths\' own, the answer goes out before the follow-up, a stale socket gets none; the older files are untouched', () => pageChecks())
await check('6a. the strip gives the three touched files their base back byte for byte (flag off is the base); every marked line is where it should be; the older proofs taught; .env.example', () => sourceChecks(texts))
await check('6b. the registry names this change in all three lists (strip, block, files) and loses nothing; read through it, the files are the base\'s', () => registryChecks(texts[REGISTRY]))
await check('6c. the scope: every file that differs from the base (own commits, edited, new) is this change\'s; the own commits carry the subject and the co-author line; no secret-shaped literal in the new files', () => {
  const own = ownCommits()
  scopeCheck(own)
  assert.deepEqual(CHAT_PARITY_C2_NEW_FILES.filter(rel => !fs.existsSync(path.join(repo, rel))), [], 'the new files exist')
  if (git('status', '--porcelain').trim() === '') assert.ok(own.length >= 1, 'a clean tree has this change committed (commits whose subject starts "Chat parity C2:")')
  for (const commit of own) assert.deepEqual(messageProblems(git('log', '-1', '--format=%s', commit).trim(), git('log', '-1', '--format=%B', commit)), [], `commit ${commit.slice(0, 8)}`)
  for (const rel of [...CHAT_PARITY_C2_NEW_FILES, ENV]) assert.doesNotMatch(read(rel), SECRET, `${rel}: no secret-shaped literal`)
})

// ============================================================================================================================================
// 7. Mutants: each must be caught
// ============================================================================================================================================
const mutate = (text, from, to, name) => { assert.equal(text.split(from).length - 1, 1, `mutant "${name}": the text to change is there exactly once`); return text.replace(from, () => to) }
const dataModule = text => import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`)
const withText = (rel, mutant) => ({ ...texts, [rel]: mutant })
/** Sections 1 to 4 on a set of file texts. */
const behaviour = async t => { const mods = loadAll(t); pureChecks(mods, t); await deckOpsChecks(mods); await publishChecks(mods); await entryChecks(mods) }
// [file, name, text to change, the change]: each must make a behaviour section (1 to 4) fail
const MUTANTS = [
  // flags and caps
  [PARITY, 'the deckops flag accepts "1"', "chatParityFlagOn(process.env.NEXT_PUBLIC_STUDIO_CHAT_PARITY_DECKOPS)", "(process.env.NEXT_PUBLIC_STUDIO_CHAT_PARITY_DECKOPS === '1' || chatParityFlagOn(process.env.NEXT_PUBLIC_STUDIO_CHAT_PARITY_DECKOPS))"],
  [PARITY, 'the publish flag is always on', "chatParityFlagOn(process.env.NEXT_PUBLIC_STUDIO_CHAT_PARITY_PUBLISH)", 'true'],
  [PARITY, 'the deckops cap is wrong', "deck_ops: 'deckops1'", "deck_ops: 'deckops'"],
  [PARITY, 'the publish cap is wrong', "publish: 'publish1'", "publish: 'publish'"],
  [PARITY, 'the C2 caps are never added', '[...chatParityCaps(CHAT_PARITY_FLAGS), ...chatParityC2Caps(CHAT_PARITY_C2_FLAGS)]', 'chatParityCaps(CHAT_PARITY_FLAGS)'],
  [PARITY, 'the C2 caps are sent whatever the flags say', "filter(group => flags[group] === true).map(group => CHAT_PARITY_C2_GROUP_CAPS[group])", "map(group => CHAT_PARITY_C2_GROUP_CAPS[group])"],
  [PARITY, 'the C2 caps come before the older ones', '[...chatParityCaps(CHAT_PARITY_FLAGS), ...chatParityC2Caps(CHAT_PARITY_C2_FLAGS)]', '[...chatParityC2Caps(CHAT_PARITY_C2_FLAGS), ...chatParityCaps(CHAT_PARITY_FLAGS)]'],
  [PARITY, 'a C2 flag does not take the frame out of band', 'Object.values(CHAT_PARITY_FLAGS).some(Boolean) || STUDIO_CHAT_PARITY_C2_ANY_ENABLED', 'Object.values(CHAT_PARITY_FLAGS).some(Boolean)'],
  [PARITY, 'an older flag turns C2 on', 'export const STUDIO_CHAT_PARITY_C2_ANY_ENABLED = Object.values(CHAT_PARITY_C2_FLAGS).some(Boolean)', 'export const STUDIO_CHAT_PARITY_C2_ANY_ENABLED = Object.values(CHAT_PARITY_C2_FLAGS).some(Boolean) || STUDIO_CHAT_PARITY_THEMES_ENABLED'],
  [PARITY, 'the C2 groups join the older actions table', "export const CHAT_PARITY_C2_FLAGS: Readonly<ChatParityC2Flags> = Object.freeze({ deck_ops: STUDIO_CHAT_PARITY_DECKOPS_ENABLED, publish: STUDIO_CHAT_PARITY_PUBLISH_ENABLED })", "export const CHAT_PARITY_C2_FLAGS: Readonly<ChatParityC2Flags> = Object.freeze({ deck_ops: STUDIO_CHAT_PARITY_DECKOPS_ENABLED, publish: STUDIO_CHAT_PARITY_PUBLISH_ENABLED, themes: true })"],
  // the pure file
  [C2, 'delete runs without the card token (confirmed only)', "return args.confirmed === true && CONFIRMATION_ID.test(id) ? { action, confirmationId: id } : null", "return args.confirmed === true ? { action, confirmationId: id } : null"],
  [C2, 'delete runs without confirmed', "return args.confirmed === true && CONFIRMATION_ID.test(id) ? { action, confirmationId: id } : null", "return CONFIRMATION_ID.test(id) ? { action, confirmationId: id } : null"],
  [C2, 'delete takes any dd_ string', "const CONFIRMATION_ID = /^dd_[0-9a-f]{24}$/", "const CONFIRMATION_ID = /^dd_/"],
  [C2, 'delete accepts confirmed as a truthy value', "args.confirmed === true && CONFIRMATION_ID", "Boolean(args.confirmed) && CONFIRMATION_ID"],
  [C2, 'the layout allowlist lets any code through', "CHAT_PARITY_C2_LAYOUTS.includes(layout) && args.preserve_content === true", "layout !== '' && args.preserve_content === true"],
  [C2, 'content is not required to be preserved', "CHAT_PARITY_C2_LAYOUTS.includes(layout) && args.preserve_content === true", "CHAT_PARITY_C2_LAYOUTS.includes(layout)"],
  [C2, 'a blank add may use another layout', "if (args.layout !== CHAT_PARITY_C2_BLANK_LAYOUT || ", "if ("],
  [C2, 'the end insertion index is not checked', "if (position === 'end') return args.insertion_index === args.expected_slide_count ? ", "if (position === 'end') return true ? "],
  [C2, 'before / after insertion index is not checked', "args.insertion_index !== target.slideIndex + (position === 'after' ? 1 : 0)", "false"],
  [C2, 'the slide id may be empty', "if (!slideId || slideId !== slideId.trim() || slideId.length > SLIDE_ID_MAX || args.slide_index >= args.expected_slide_count) return null", "if (args.slide_index >= args.expected_slide_count) return null"],
  [C2, 'an index past the count is a target', "|| args.slide_index >= args.expected_slide_count) return null", ") return null"],
  [C2, 'a deck name may hold a newline', "if (code < 32 || code === 127) return null", "if (code === 127) return null"],
  [C2, 'a deck name is not bounded', "if (!name || name.length > CHAT_PARITY_C2_NAME_MAX) return null", "if (!name) return null"],
  [C2, 'the rail takes a truthy value', "typeof args.visible === 'boolean' ? { action, visible: args.visible } : null", "args.visible !== undefined ? { action, visible: Boolean(args.visible) } : null"],
  [C2, 'the mode takes any string', "args.mode === 'view' || args.mode === 'edit' ? { action, mode: args.mode } : null", "typeof args.mode === 'string' ? { action, mode: args.mode } : null"],
  [C2, 'publish takes restricted visibility', "if (args.visibility !== 'public' && args.visibility !== 'unlisted') return null; out.visibility = args.visibility", "out.visibility = args.visibility as ChatParityPublishVisibility"],
  [C2, 'publish takes keys it does not list (a passcode)', "for (const key of Object.keys(args)) if (!allowed.includes(key)) return null", ""],
  [C2, 'a read takes args', "case 'republish_deck': case 'unpublish_deck': case 'rotate_publish_link': case 'open_publish_link': case 'copy_publish_link': return Object.keys(args).length === 0 ? { action } : null", "case 'republish_deck': case 'unpublish_deck': case 'rotate_publish_link': case 'open_publish_link': case 'copy_publish_link': return { action }"],
  [C2, 'a first publish defaults to public', "visibility: settings.visibility ?? 'unlisted'", "visibility: settings.visibility ?? 'public'"],
  [C2, 'a first publish defaults downloads on', "allowPdf: settings.allowPdf ?? false, allowPptx: settings.allowPptx ?? false", "allowPdf: settings.allowPdf ?? true, allowPptx: settings.allowPptx ?? true"],
  [C2, 'the question caps are not required with qaEnabled', "if (settings.qaEnabled === true && (settings.qaDailyCap === undefined || settings.qaMonthlyCap === undefined)) return null", ""],
  [C2, 'the daily cap may exceed the monthly', "if (settings.qaDailyCap !== undefined && settings.qaMonthlyCap !== undefined && settings.qaDailyCap > settings.qaMonthlyCap) return null", ""],
  [C2, 'narration may be enabled without a session length', "if ((settings.narrationEnabled === true || settings.qaReserveMinutes !== undefined) && settings.narrationBudgetMinutes === undefined) return null", ""],
  [C2, 'the reserve may exceed the session length', "if ((settings.qaReserveMinutes ?? 0) > (settings.narrationBudgetMinutes ?? 480)) return null", ""],
  [C2, 'the bounds are looser', "qaDailyCap: [0, 1000]", "qaDailyCap: [0, 100000]"],
  [C2, 'an empty configure is accepted', "if (!settings || Object.keys(settings).length === 0) return null", "if (!settings) return null"],
  [C2, 'a group that is off is not refused', "if (!isChatParityC2Group(group) || flags[group] !== true) return 'flag_off'", "if (!isChatParityC2Group(group)) return 'flag_off'"],
  [C2, 'an unknown action is not refused', "if (!CHAT_PARITY_C2_ACTIONS[group].includes(request.action)) return 'unsupported'", ""],
  [C2, 'a failure carries no code', "return chatParityResult(requestId, status, errorCode as ChatParityErrorCode | null)", "return chatParityResult(requestId, status, null)"],
  [C2, 'the target check ignores the id', "|| order.slideIds[target.slideIndex] !== target.slideId", ""],
  [C2, 'the target check ignores the count', "return order.nativeCount !== target.expectedSlideCount || ", "return "],
  [C2, 'an add is verified without checking the other slides', "return rest.length === before.slideIds.length && rest.every((id, index) => id === before.slideIds[index])", "return true"],
  [C2, 'an add is verified with an old id at the index', "if (!added || before.slideIds.includes(added)) return false", "if (!added) return false"],
  [C2, 'a layout change is verified without its shape', "return after.slideIds.every((id, at) => at === index || id === before.slideIds[at])", "return true"],
  // the deck_ops runner
  [DECKOPS, 'goto does not check the selection', "const seen = await until(deps, 3_000, () => deps.readOrder(), value => value !== null && value !== 'busy' && value.currentVisualIndex === args.target.slideIndex && value.slideIds[args.target.slideIndex] === args.target.slideId)\n      return seen.ok ? done(requestId) : fail(requestId, 'write_failed')", "return done(requestId)"],
  [DECKOPS, 'goto skips the stale check', "if (chatParityC2TargetStale(before, args.target)) return fail(requestId, 'stale_target')\n      await goTo(", "await goTo("],
  [DECKOPS, 'goto is gated like a write', "      const goTo = deps.goToSlide()\n", "      const goTo = deps.goToSlide(); if (deps.gate().building) return fail(requestId, 'busy')\n"],
  [DECKOPS, 'add passes the wrong position', "await gate.viewer.addSlide(CHAT_PARITY_C2_BLANK_LAYOUT, deps.blankOptions(args.insertionIndex))", "await gate.viewer.addSlide(CHAT_PARITY_C2_BLANK_LAYOUT, deps.blankOptions(args.insertionIndex + 1))"],
  [DECKOPS, 'add uses another layout', "await gate.viewer.addSlide(CHAT_PARITY_C2_BLANK_LAYOUT, deps.blankOptions(args.insertionIndex))", "await gate.viewer.addSlide('C1-text', deps.blankOptions(args.insertionIndex))"],
  [DECKOPS, 'add is not gated', "case 'add_blank_slide': {\n      const gate = writeGate(deps, true)", "case 'add_blank_slide': {\n      const gate = writeGate({ ...deps, gate: () => ({ building: false, paused: false, templateMode: false }) }, true)"],
  [DECKOPS, 'a pending slide write does not wait', "if (viewer.state().mutationPending) return { block: 'busy', viewer }", ""],
  [DECKOPS, 'a template in use does not wait', "if (state.building || state.paused || state.templateMode) return { block: 'busy', viewer }", "if (state.building || state.paused) return { block: 'busy', viewer }"],
  [DECKOPS, 'a paused tab does not wait', "if (state.building || state.paused || state.templateMode) return { block: 'busy', viewer }", "if (state.building || state.templateMode) return { block: 'busy', viewer }"],
  [DECKOPS, 'add skips the stale check', "if (chatParityC2CountStale(before, args.expectedSlideCount) || (args.target && chatParityC2TargetStale(before, args.target))) return fail(requestId, 'stale_target')", ""],
  [DECKOPS, 'add skips the target check', "|| (args.target && chatParityC2TargetStale(before, args.target))", ""],
  [DECKOPS, 'add is done without evidence', "return chatParityC2AddVerified(before, seen.last as ChatParityC2SlideOrder, args.insertionIndex) ? done(requestId) : fail(requestId, 'write_failed')", "return done(requestId)"],
  [DECKOPS, 'add without evidence in time is a done', "if (!seen.ok) return fail(requestId, 'timeout')\n      return chatParityC2AddVerified", "if (!seen.ok) return done(requestId)\n      return chatParityC2AddVerified"],
  [DECKOPS, 'layout is done without reading it back', "return chatParityC2LayoutShapeKept(before, seen.last.order, args.target.slideIndex) ? done(requestId) : fail(requestId, 'write_failed')", "return done(requestId)"],
  [DECKOPS, 'layout shape is not checked', "return chatParityC2LayoutShapeKept(before, seen.last.order, args.target.slideIndex) ? done(requestId)", "return true ? done(requestId)"],
  [DECKOPS, 'layout accepts any readable layout', "}, value => value !== null && value.layout === args.layout)", "}, value => value !== null && value.layout !== null)"],
  [DECKOPS, 'a layout that stays old is unknown, not a failure', "return seen.last && seen.last.layout !== null ? fail(requestId, 'write_failed') : fail(requestId, 'timeout')", "return fail(requestId, 'timeout')"],
  [DECKOPS, 'layout calls the viewer with the wrong index', "await gate.viewer.changeLayout(args.target.slideIndex, args.layout)", "await gate.viewer.changeLayout(args.target.slideIndex + 1, args.layout)"],
  [DECKOPS, 'an unreadable layout is a done', "return seen.last && seen.last.layout !== null ? fail(requestId, 'write_failed') : fail(requestId, 'timeout')", "return done(requestId)"],
  [DECKOPS, 'layout skips the stale check', "if (chatParityC2TargetStale(before, args.target)) return fail(requestId, 'stale_target')\n      // Already that layout", "// Already that layout"],
  [DECKOPS, 'present toggles out of full screen', "if (deps.fullscreen()) return done(requestId)\n", ""],
  [DECKOPS, 'present is done without full screen', "return seen.ok ? done(requestId) : fail(requestId, 'fullscreen_denied')", "return done(requestId)"],
  [DECKOPS, 'a refused full screen is a generic failure', "fail(requestId, 'fullscreen_denied')", "fail(requestId, 'write_failed')"],
  [DECKOPS, 'the mode is toggled blindly', "if (viewer.state().editMode === edit) return done(requestId)\n      await viewer.setMode(edit)", "await viewer.setMode(edit)"],
  [DECKOPS, 'the mode is done without reading it back', "return seen.ok ? done(requestId) : fail(requestId, 'write_failed')\n    }\n    case 'set_slide_rail'", "return done(requestId)\n    }\n    case 'set_slide_rail'"],
  [DECKOPS, 'the mode asks for the opposite', "await viewer.setMode(edit)", "await viewer.setMode(!edit)"],
  [DECKOPS, 'the rail is toggled blindly', "if (viewer.state().rail === args.visible) return done(requestId)\n      viewer.setRail(args.visible)", "viewer.setRail(args.visible)"],
  [DECKOPS, 'the rail is done without reading it back', "const seen = await until(deps, 1_500, () => viewer.state().rail, value => value === args.visible)\n      return seen.ok ? done(requestId) : fail(requestId, 'write_failed')", "return done(requestId)"],
  [DECKOPS, 'a blank canvas starts over an open deck', "if (!blank || !blank.available()) return fail(requestId, 'unsupported')", "if (!blank) return fail(requestId, 'unsupported')"],
  [DECKOPS, 'a blank canvas starts during a build', "if (state.building || state.paused) return fail(requestId, 'busy')\n      blank.start()", "blank.start()"],
  [DECKOPS, 'a blank canvas is done without being started', "const seen = await until(deps, 3_000, () => blank.started(), value => value === true)\n      return seen.ok ? done(requestId) : fail(requestId, 'write_failed')", "return done(requestId)"],
  [DECKOPS, 'rename is done without the saved title', "return saved === args.name ? done(requestId) : fail(requestId, 'write_failed')", "return done(requestId)"],
  [DECKOPS, 'rename ignores a running build', "const state = deps.gate()\n      if (state.building || state.paused) return fail(requestId, 'busy')\n      if (!sessionId) return fail(requestId, 'no_deck')\n      const saved", "if (!sessionId) return fail(requestId, 'no_deck')\n      const saved"],
  [DECKOPS, 'delete runs during a build', "const state = deps.gate()\n      if (state.building || state.paused) return fail(requestId, 'busy')\n      if (!sessionId) return fail(requestId, 'no_deck')\n      const acknowledged", "if (!sessionId) return fail(requestId, 'no_deck')\n      const acknowledged"],
  [DECKOPS, 'delete is done without the server\'s acknowledgement', "return acknowledged ? done(requestId, () => deps.session.startNew()) : fail(requestId, 'write_failed')", "return done(requestId, () => deps.session.startNew())"],
  [DECKOPS, 'delete starts the new session before the answer', "return acknowledged ? done(requestId, () => deps.session.startNew()) : fail(requestId, 'write_failed')", "if (acknowledged) deps.session.startNew(); return acknowledged ? done(requestId) : fail(requestId, 'write_failed')"],
  [DECKOPS, 'a failed delete starts a new session', "return acknowledged ? done(requestId, () => deps.session.startNew()) : fail(requestId, 'write_failed')", "return acknowledged ? done(requestId, () => deps.session.startNew()) : { data: chatParityC2Result(requestId, 'failed', 'write_failed'), after: () => deps.session.startNew() }"],
  [DECKOPS, 'duplicate runs without its flag', "if (!copy) return fail(requestId, 'unsupported')", ""],
  [DECKOPS, 'duplicate is done whatever happens', "if (result.ok) return done(requestId)", "if (true) return done(requestId)"],
  [DECKOPS, 'duplicate does not check the target', "if (!target.ok) return fail(requestId, 'unsupported')", ""],
  [DECKOPS, 'duplicate runs during a build', "case 'duplicate_deck': {\n      const state = deps.gate()\n      if (state.building || state.paused) return fail(requestId, 'busy')\n", "case 'duplicate_deck': {\n"],
  [DECKOPS, 'the evidence window is never read twice', "if (last !== undefined && accept(last)) return { ok: true, last }", "if (last !== undefined) return { ok: true, last }"],
  [DECKOPS, 'the budget is not inside Director\'s window', 'export const CHAT_PARITY_DECKOPS_BUDGET_MS = 20_000', 'export const CHAT_PARITY_DECKOPS_BUDGET_MS = 30_000'],
  [DECKOPS, 'the module imports a chat input', "import type { ChatParityResultData } from '@/lib/studio-chat-parity'", "import type { ChatParityResultData } from '@/lib/studio-chat-parity'\nimport { sendMessage } from '@/hooks/use-deckster-websocket-v2'\nexport const leak = sendMessage"],
  // the publish runner
  [PUBLISH, 'a first publish overwrites a live record', "if (before !== 'none' && !before.revokedAt) return fail(requestId, 'state_changed')\n      const sent", "const sent"],
  [PUBLISH, 'a first publish sends the passcode field', "body: JSON.stringify({ sessionId, visibility: args.visibility, allowPdf: args.allowPdf, allowPptx: args.allowPptx })", "body: JSON.stringify({ sessionId, visibility: args.visibility, allowPdf: args.allowPdf, allowPptx: args.allowPptx, passcode: '' })"],
  [PUBLISH, 'a first publish is done without the server\'s deck', "return deck.sessionId === sessionId && !deck.revokedAt && deck.visibility === args.visibility && deck.allowPdf === args.allowPdf && deck.allowPptx === args.allowPptx ? done(requestId) : fail(requestId, 'state_changed')", "return done(requestId)"],
  [PUBLISH, 'a first publish ignores a 409', "if (sent.status === 409) return fail(requestId, 'no_deck')\n      if (!sent.ok || !sent.deck) return fail(requestId, 'snapshot_failed')\n      const deck = sent.deck\n      return deck.sessionId", "if (!sent.ok || !sent.deck) return fail(requestId, 'snapshot_failed')\n      const deck = sent.deck\n      return deck.sessionId"],
  [PUBLISH, 'a republish sends the settings', "body: JSON.stringify({ sessionId }) })\n      if (sent.status === 409) return fail(requestId, 'no_deck')\n      if (!sent.ok || !sent.deck) return fail(requestId, 'snapshot_failed')\n      const deck = sent.deck\n      const kept", "body: JSON.stringify({ sessionId, visibility: 'public' }) })\n      if (sent.status === 409) return fail(requestId, 'no_deck')\n      if (!sent.ok || !sent.deck) return fail(requestId, 'snapshot_failed')\n      const deck = sent.deck\n      const kept"],
  [PUBLISH, 'a republish does not check the link is kept', "const kept = deck.slug === before.slug && deck.sessionId === sessionId && !deck.revokedAt\n        && deck.visibility === before.visibility && deck.allowPdf === before.allowPdf && deck.allowPptx === before.allowPptx", "const kept = true"],
  [PUBLISH, 'a republish is done without a stamp', "return kept && Boolean(deck.republishedAt) && deck.republishedAt !== before.republishedAt ? done(requestId) : fail(requestId, 'state_changed')", "return kept ? done(requestId) : fail(requestId, 'state_changed')"],
  [PUBLISH, 'an unpublish is done while the record is live', "return sent.deck.slug === before.slug && Boolean(sent.deck.revokedAt) ? done(requestId) : fail(requestId, 'state_changed')", "return done(requestId)"],
  [PUBLISH, 'a rotate is done with the same link', "return sent.deck.sessionId === sessionId && !sent.deck.revokedAt && sent.deck.slug !== before.slug ? done(requestId) : fail(requestId, 'state_changed')", "return done(requestId)"],
  [PUBLISH, 'configure is done without the setting', "return sent.deck.slug === before.slug && !sent.deck.revokedAt && settingsApplied(sent.deck, args.settings) ? done(requestId) : fail(requestId, 'write_failed')", "return done(requestId)"],
  [PUBLISH, 'configure sends more than was named', "body: JSON.stringify(args.settings) })\n      if (!sent.ok || !sent.deck) return fail(requestId, 'write_failed')\n      return sent.deck.slug", "body: JSON.stringify({ ...args.settings, passcode: '' }) })\n      if (!sent.ok || !sent.deck) return fail(requestId, 'write_failed')\n      return sent.deck.slug"],
  [PUBLISH, 'a write runs during a build', "if (!read) { const state = deps.gate(); if (state.building || state.paused) return fail(requestId, 'locked') }", ""],
  [PUBLISH, 'a write does not check the final deck', "if (row.finalPresentationId !== presentationId) return fail(requestId, 'state_changed')", ""],
  [PUBLISH, 'a write without a final deck goes on', "if (!row.finalPresentationId) return fail(requestId, 'no_deck')", ""],
  [PUBLISH, 'a failed record read is an answer', "if (before === null) return fail(requestId, 'write_failed')", "if (before === null) return fail(requestId, 'not_published')"],
  [PUBLISH, 'a revoked record is a live link', "if (before === 'none' || before.revokedAt) return fail(requestId, 'not_published')\n    if (before.sessionId !== sessionId)", "if (before === 'none') return fail(requestId, 'not_published')\n    if (before.sessionId !== sessionId)"],
  [PUBLISH, 'a copy of another session\'s record', "if (before.sessionId !== sessionId) return fail(requestId, 'state_changed')", ""],
  [PUBLISH, 'any link is opened', "if (!/^https?:\\/\\//i.test(link)) return fail(requestId, 'write_failed')", ""],
  [PUBLISH, 'a blocked clipboard is a copy', "return (await deps.copy(link).catch(() => false)) ? done(requestId) : fail(requestId, 'browser_blocked')", "await deps.copy(link).catch(() => false); return done(requestId)"],
  [PUBLISH, 'a blocked popup is an open', "return deps.open(link) ? done(requestId) : fail(requestId, 'browser_blocked')", "deps.open(link); return done(requestId)"],
  [PUBLISH, 'the link goes back in a detail', "const done = (requestId: string): ChatParityPublishOutcome => ({ data: chatParityC2Result(requestId, 'done'), after: null })", "const done = (requestId: string): ChatParityPublishOutcome => ({ data: { ...chatParityC2Result(requestId, 'done'), detail: { link: 'x' } }, after: null })"],
  [PUBLISH, 'the wizard\'s narration call is made', "const row = await deps.loadSession(sessionId).catch(() => null)", "await deps.fetch('/api/narration/script', { method: 'POST' }); const row = await deps.loadSession(sessionId).catch(() => null)"],
  [PUBLISH, 'the budget is not inside Director\'s window', 'export const CHAT_PARITY_PUBLISH_BUDGET_MS = 20_000', 'export const CHAT_PARITY_PUBLISH_BUDGET_MS = 30_000'],
  [PUBLISH, 'a record without a public link is accepted', " && typeof value.publicUrl === 'string'", ""],
  // the entry point
  [RUN, 'no owner check', "if (!check.ok) return fail('not_owner')", ""],
  [RUN, 'a request with no deck goes ahead', "if (request.action !== 'start_blank_canvas' && request.presentationId === null) return fail('no_deck')", ""],
  [RUN, 'a blank canvas needs a deck', "if (request.action !== 'start_blank_canvas' && request.presentationId === null) return fail('no_deck')", "if (request.presentationId === null) return fail('no_deck')"],
  [RUN, 'invalid deck args run', "const args = chatParityDeckOpsArgs(request.action, request.args)\n      if (!args) return fail('invalid_args')", "const args = chatParityDeckOpsArgs(request.action, request.args) as never"],
  [RUN, 'invalid publish args run', "const args = chatParityPublishArgs(request.action, request.args)\n      if (!args) return fail('invalid_args')", "const args = chatParityPublishArgs(request.action, request.args) as never"],
  [RUN, 'the flags are not read from the deps', "chatParityC2Refusal(request, { deck_ops: Boolean(deps.deckOps), publish: Boolean(deps.publish) })", "chatParityC2Refusal(request, { deck_ops: true, publish: true })"],
  [RUN, 'no budget', "return await withTimeout(runChatParityDeckOpsAction(request.requestId, args, deps.deckOps), CHAT_PARITY_DECKOPS_BUDGET_MS, () => fail('timeout'))", "return await runChatParityDeckOpsAction(request.requestId, args, deps.deckOps)"],
  [RUN, 'a timeout is a done', "CHAT_PARITY_DECKOPS_BUDGET_MS, () => fail('timeout'))", "CHAT_PARITY_DECKOPS_BUDGET_MS, () => ({ data: chatParityC2Result(request.requestId, 'done'), after: null }))"],
  [RUN, 'the timer is never cleared', "settled = true; clearTimeout(timer); resolve(value) } }, error", "settled = true; resolve(value) } }, error"],
  [RUN, 'a thrown error rejects', "} catch {\n    return fail('write_failed')\n  }", "} finally {\n  }"],
  [RUN, 'the answer carries the wrong id', "data: chatParityC2Result(request.requestId, 'failed', code)", "data: chatParityC2Result('x', 'failed', code)"],
]
for (const [rel, name, from, to] of MUTANTS) {
  await check(`mutant caught: ${rel.replace('lib/studio-chat-parity-', '').replace('lib/', '')}: ${name}`, async () => {
    const mutant = mutate(texts[rel], from, to, name)
    assert.ok(await throws(async () => behaviour(withText(rel, mutant))), 'sections 1 to 4 must fail')
  })
}
// the viewer's and the page's marked lines
const VIEWER_MUTANTS = [
  ['the flag is read as "1"', "process.env.NEXT_PUBLIC_STUDIO_CHAT_PARITY_DECKOPS !== 'true') return // CHAT-PARITY-C2", "process.env.NEXT_PUBLIC_STUDIO_CHAT_PARITY_DECKOPS === 'false') return // CHAT-PARITY-C2"],
  ['the effect registers whatever the flag says', "    if (process.env.NEXT_PUBLIC_STUDIO_CHAT_PARITY_DECKOPS !== 'true') return // CHAT-PARITY-C2\n", ''],
  ['the live ref is assigned with the flag off', "if (process.env.NEXT_PUBLIC_STUDIO_CHAT_PARITY_DECKOPS === 'true') chatParityDeckLiveRef.current = {", "chatParityDeckLiveRef.current = {"],
  ['addSlide calls the layout handler', "addSlide: async (layout, options) => { await live()?.addSlide(layout as SlideLayoutType, options) }", "addSlide: async (layout, options) => { await live()?.changeLayout(0, layout as SlideLayoutType) }"],
  ['addSlide drops the options', "await live()?.addSlide(layout as SlideLayoutType, options)", "await live()?.addSlide(layout as SlideLayoutType)"],
  ['changeLayout swaps its arguments', "await live()?.changeLayout(slideIndex, layout as SlideLayoutType)", "await live()?.changeLayout(layout as unknown as number, slideIndex as unknown as SlideLayoutType)"],
  ['present toggles the mode', "present: async () => { await live()?.fullscreen() }", "present: async () => { await live()?.mode(true) }"],
  ['setMode ignores the requested mode', "setMode: async edit => { await live()?.mode(edit) }", "setMode: async edit => { await live()?.mode() }"],
  ['setRail inverts', "setRail: visible => setShowThumbnails(visible)", "setRail: visible => setShowThumbnails(!visible)"],
  ['the state reads a stale closure', "state: () => ({ ready: live()?.ready ?? false, mutationPending: live()?.pending ?? false, editMode: live()?.edit ?? false, rail: live()?.rail ?? true })", "state: ((snapshot) => () => snapshot)({ ready: true, mutationPending: false, editMode: false, rail: true })"],
  ['the cleanup does not clear the bus', "return () => { gone = true; if (bus) bus.viewer = null } // CHAT-PARITY-C2", "return () => { gone = true } // CHAT-PARITY-C2"],
  ['an unmount before the import still registers', "      if (gone) return // CHAT-PARITY-C2\n", ''],
  ['the pending state ignores the ref', "pending: isSlideMutationPending || slideMutationPendingRef.current,", "pending: isSlideMutationPending,"],
]
for (const [name, from, to] of VIEWER_MUTANTS) await check(`mutant caught: viewer: ${name}`, async () => { const mutant = mutate(texts[VIEWER], from, to, name); assert.ok(await throws(async () => { await viewerChecks(withText(VIEWER, mutant)); sourceChecks(withText(VIEWER, mutant)) }), 'sections 5a and 6a must fail') })
const PAGE_MUTANTS = [
  ['delete does not clear the caches', "try { sessionStorage.removeItem(sessionCacheKey(cacheOwner, sessionId)); sessionStorage.removeItem(sessionMetadataCacheKey(cacheOwner, sessionId)) } catch { /* the row is gone; a browser that cannot clear its cache still reloads the list */ } // CHAT-PARITY-C2", "// CHAT-PARITY-C2"],
  ['delete is done whether or not the server acknowledged', "if (!(await chatParityC2Sessions.deleteSession(sessionId))) return false // CHAT-PARITY-C2", "await chatParityC2Sessions.deleteSession(sessionId) // CHAT-PARITY-C2"],
  ['rename saves another field', "chatParityC2Sessions.updateSession(sessionId, { title: name })", "chatParityC2Sessions.updateSession(sessionId, { description: name } as never)"],
  ['start new runs the wrong handler', "startNew: () => handleNewChatWrappedRef.current?.(), // CHAT-PARITY-C2", "startNew: () => handleStartOnBlankCanvas(), // CHAT-PARITY-C2"],
  ['the answer is sent after the follow-up', "      if (owner.isCurrent()) chatParityBus.send?.(outcome.data) // CHAT-PARITY-C2\n      try { outcome.after?.() } catch { /* the answer is sent; a failed follow-up is the user's to repeat from the button */ } // CHAT-PARITY-C2", "      try { outcome.after?.() } catch { /* x */ } // CHAT-PARITY-C2\n      if (owner.isCurrent()) chatParityBus.send?.(outcome.data) // CHAT-PARITY-C2"],
  ['the answer is sent on a stale socket', "if (owner.isCurrent()) chatParityBus.send?.(outcome.data) // CHAT-PARITY-C2", "chatParityBus.send?.(outcome.data) // CHAT-PARITY-C2"],
  ['both groups get deps whatever the flags', "...(STUDIO_CHAT_PARITY_DECKOPS_ENABLED ? { deckOps: { // CHAT-PARITY-C2", "...(true ? { deckOps: { // CHAT-PARITY-C2"],
  ['publish deps whatever the flag', "...(STUDIO_CHAT_PARITY_PUBLISH_ENABLED ? { publish: {", "...(true ? { publish: {"],
  ['a build does not gate (the compose jobs)', " || slideComposeThumbnailJobs.length > 0 // CHAT-PARITY-C2: the viewer's own", " // CHAT-PARITY-C2: the viewer's own"],
  ['a paused tab does not gate', "paused: oneLiveTabSuperseded, templateMode: templateModeOn", "paused: false, templateMode: templateModeOn"],
  ['the blank canvas starts over an open deck', "available: () => studioWelcome && !blankPlaceholderDismissed,", "available: () => !blankPlaceholderDismissed,"],
  ['the blank ref is not kept', "chatParityC2BlankRef.current = blankPlaceholderDismissed // CHAT-PARITY-C2", "chatParityC2BlankRef.current = false // CHAT-PARITY-C2"],
  ['the link helper is not the dialog\'s', "link: record => publishedLink(record), // CHAT-PARITY-C2", "link: record => record.publicUrl, // CHAT-PARITY-C2"],
  ['the popup opens in the same tab', "window.open(url, '_blank')", "window.open(url, '_self')"],
  ['a blocked popup is a success', "if (!tab) return false;", ""],
  ['the order is read from the wrong source', "const compose = composeViewerApiRef.current; if (!compose) return null // CHAT-PARITY-C2", "const compose = { composeGetState: async () => ({}) } as never // CHAT-PARITY-C2"],
  ['the duplicate flag is ignored', "duplicate: process.env.NEXT_PUBLIC_STUDIO_DUPLICATE_DECK === 'true' ? {", "duplicate: true ? {"],
  ['the routing line lets the C2 groups fall through', "if (isChatParityC2Group(request.group)) {", "if (false && isChatParityC2Group(request.group)) {"],
  ['the routing line forgets the flag-off answer', "if (c2Refusal) { if (owner.isCurrent()) chatParityBus.send?.(chatParityResult(request.requestId, 'failed', c2Refusal)); return }", "if (c2Refusal) return"],
  ['the routing line runs the older runner too', "runChatParityC2Frame(request, message, owner); return } // CHAT-PARITY-C2", "runChatParityC2Frame(request, message, owner) } // CHAT-PARITY-C2"],
]
for (const [name, from, to] of PAGE_MUTANTS) await check(`mutant caught: page: ${name}`, async () => { const mutant = mutate(texts[PAGE], from, to, name); assert.ok(await throws(async () => { await pageChecks(withText(PAGE, mutant)); sourceChecks(withText(PAGE, mutant)) }), 'sections 5b and 6a must fail') })
await check('mutant caught: an unmarked line in the viewer, the page or the older lib; a marker moved to another line (a base line rewritten without its pair)', async () => {
  for (const [rel, anchor] of [[VIEWER, '  // Debug: Log button states\n'], [PAGE, "import { runChatParityAction } from '@/lib/studio-chat-parity-runners' // CHAT-PARITY\n"], [PARITY, 'export type ChatParityGroup']]) {
    const text = texts[rel]; assert.equal(text.split(anchor).length - 1, 1)
    assert.ok(await throws(() => sourceChecks(withText(rel, text.replace(anchor, `const stray = 1\n${anchor}`)))), `${rel}: an unmarked added line`)
  }
  assert.ok(await throws(() => sourceChecks(withText(PARITY, mutate(texts[PARITY], 'export const STUDIO_CHAT_PARITY_ANY_ENABLED = Object.values(CHAT_PARITY_FLAGS).some(Boolean) || STUDIO_CHAT_PARITY_C2_ANY_ENABLED // CHAT-PARITY-C2\n', 'export const STUDIO_CHAT_PARITY_ANY_ENABLED = Object.values(CHAT_PARITY_FLAGS).some(Boolean) || STUDIO_CHAT_PARITY_C2_ANY_ENABLED  // CHAT-PARITY-C2\n', 'spacing')))), 'a rewritten base line whose pair no longer matches')
  assert.ok(await throws(() => sourceChecks(withText(PARITY, texts[PARITY].replace('// CHAT-PARITY-C2: two more groups', '// two more groups')))), 'a comment line that lost its marker')
})
await check('mutant caught: the older files this change must not touch (the socket hook, the older runners, the themes / identity / templates files)', async () => {
  for (const rel of [HOOK, RUNNERS]) assert.ok(await throws(() => pageChecks({ ...texts, [rel]: `${texts[rel]}\n// touched\n` })), `${rel} touched`)
})
await check('mutant caught: .env.example with a flag on by default, one flag missing, or the block missing', async () => {
  assert.ok(await throws(() => sourceChecks(withText(ENV, texts[ENV].replace(`${FLAG_DECKOPS}="false"`, `${FLAG_DECKOPS}="true"`)))))
  assert.ok(await throws(() => sourceChecks(withText(ENV, texts[ENV].replace(`${FLAG_PUBLISH}="false"\n`, '')))))
  assert.ok(await throws(() => sourceChecks(withText(ENV, baseText(ENV)))))
})
await check('mutant caught: a taught proof with an unmarked extra line, without this change\'s line, or with the pin mark changed', async () => {
  const rel = OLD_PROOF, text = texts[rel]
  assert.ok(await throws(() => sourceChecks(withText(rel, `${text}// stray\n`))), 'an unmarked extra line')
  assert.ok(await throws(() => sourceChecks(withText(rel, text.replace(`'${BASE_COMMIT}'`, "'HEAD'")))), 'the walk starts at HEAD again (the proof would read this change\'s commit as its own)')
  assert.ok(await throws(() => sourceChecks(withText(rel, text.replace('registry read (CHAT-PARITY-C2)', 'registry read (OTHER)')))), 'the pin mark changed')
  const voice = texts[VOICE_CALL]
  assert.ok(await throws(() => sourceChecks(withText(VOICE_CALL, voice.split('\n').filter(line => !line.includes('laterEnvOut = text =>')).join('\n')))), 'the voice-call helper line removed')
  assert.ok(await throws(() => sourceChecks(withText(VOICE_CALL, voice.replace('registry read (UX-FINDINGS-E)', 'registry read (CHAT-PARITY-C2)')))), 'the voice-call lines carry another mark than #603\'s')
})
const STRIP_TEXT = texts[STRIP]
const stripLine = needle => { const found = STRIP_TEXT.split('\n').filter(line => line.includes(needle)); assert.equal(found.length, 1, `the strip has one line with ${needle}`); return found[0] }
/** A [has, was] pair that spans two lines: the line with `needle` and the one after it. */
const stripPair = needle => { const lines = STRIP_TEXT.split('\n'); const at = lines.findIndex(line => line.includes(needle)); assert.ok(at >= 0, `the strip has a pair with ${needle}`); return `${lines[at]}\n${lines[at + 1]}\n` }
const STRIP_MUTANTS = [
  ['the strip puts nothing back', "const pairs = CHAT_PARITY_C2_EDITS[rel] || CHAT_PARITY_C2_PIN_EDITS[rel] || CHAT_PARITY_C2_VOICE_CALL_PIN_EDITS[rel] || []", 'const pairs = []'],
  ['the strip keeps marked lines', "return CHAT_PARITY_C2_FILES.includes(rel) ? out.split('\\n').filter(line => !CHAT_PARITY_C2_MARKER_RE.test(line)).join('\\n') : out", 'return out'],
  ['the strip drops lines with the older marker too', 'export const CHAT_PARITY_C2_MARKER_RE = /(?<![\\w-])CHAT-PARITY-C2(?![\\w-])/', 'export const CHAT_PARITY_C2_MARKER_RE = /CHAT-PARITY/'],
  ['the any-flag pair is missing', `${stripLine('export const STUDIO_CHAT_PARITY_ANY_ENABLED = Object.values')}\n`, ''],
  ['the caps pair puts back a changed line', "'export const CHAT_PARITY_CAPS: readonly string[] = chatParityCaps(CHAT_PARITY_FLAGS)\\n']", "'export const CHAT_PARITY_CAPS: readonly string[] = chatParityCaps(CHAT_PARITY_FLAGS) as string[]\\n']"],
  ['the older proof\'s pair is missing', stripPair("const OWN = (() => { try { return git('log', '-1', '--format=%H', '-E', '--grep=^Chat parity', '${BASE_COMMIT}')"), ''],
  ['the strip does not know the older proof', "if (!CHAT_PARITY_C2_FILES.includes(rel) && !(rel in CHAT_PARITY_C2_PIN_EDITS) && !(rel in CHAT_PARITY_C2_VOICE_CALL_PIN_EDITS)) return text", "if (!CHAT_PARITY_C2_FILES.includes(rel) && !(rel in CHAT_PARITY_C2_VOICE_CALL_PIN_EDITS)) return text"],
  ['the strip touches a file it does not own', "if (!CHAT_PARITY_C2_FILES.includes(rel) && !(rel in CHAT_PARITY_C2_PIN_EDITS) && !(rel in CHAT_PARITY_C2_VOICE_CALL_PIN_EDITS)) return text", "if (rel === 'hooks/use-deckster-websocket-v2.ts') return text.toUpperCase()"],
  ['the voice-call import pair is missing', `${stripLine("const laterRegistry = await import(")}\n`, ''],
  ['the voice-call helper pair is missing', `${stripLine('const laterEnvOut = text =>')}\n`, ''],
  ['the voice-call "last thing in the file" pair puts back a changed line', '"  ok(env.endsWith(', '"  ok(env.startsWith('],
  ['the voice-call ".env.example adds its block" pair puts back a changed line', '"    ok(envDiff.map(', '"    ok(envDiff.filter('],
  ['the scope lists the viewer twice and forgets the page', "export const CHAT_PARITY_C2_FILES = [PARITY_LIB, BUILDER_PAGE, VIEWER]", "export const CHAT_PARITY_C2_FILES = [PARITY_LIB, VIEWER, VIEWER]"],
  ['a new file is out of the scope', "  'lib/studio-chat-parity-publish.ts',\n", ''],
]
for (const [name, from, to] of STRIP_MUTANTS) await check(`mutant caught: strip: ${name}`, async () => { const mutant = await dataModule(mutate(STRIP_TEXT, from, to, name)); assert.ok(await throws(() => sourceChecks(texts, mutant)), 'section 6 must fail') })
await check('mutant caught: a stray file outside the scope (in a commit) fails the scope check, a polluted working tree does not; a commit message without the subject or the co-author line fails the message check', async () => {
  const own = ownCommits()
  assert.doesNotThrow(() => scopeCheck(own), 'the real tree passes')
  assert.ok(await throws(() => scopeCheck(own, ['stray-chat-parity-c2.txt'])), 'a stray file fails the scope check')
  assert.ok(await throws(() => scopeCheck(own, ['hooks/use-deckster-websocket-v2.ts'])), 'an app file nobody registered fails it too')
  const stray = path.join(repo, 'stray-chat-parity-c2.txt'), before = [...touchedFiles(own)].sort()
  fs.writeFileSync(stray, 'stray\n')
  try { assert.deepEqual([...touchedFiles(own)].sort(), before, 'an untracked stray file does not change the files read'); assert.doesNotThrow(() => scopeCheck(own), 'and does not fail the scope check') } finally { fs.rmSync(stray) }
  assert.deepEqual(messageProblems('Chat parity C2: a change', 'body\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n'), [], 'a good message has no problem')
  assert.deepEqual(messageProblems('Chat parity C2: a change', 'body\n'), ['the co-author line'], 'no co-author line')
  assert.deepEqual(messageProblems('Fix the parity', 'body\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n'), [`the subject starts "${CHAT_PARITY_C2_SUBJECT}"`], 'another subject')
})
await check('mutant caught: the registry without one of the three lines, with a line changed, or with a base line lost', async () => {
  const text = texts[REGISTRY], lines = text.split('\n')
  const mine = lines.map((line, index) => [line, index]).filter(([line]) => line.includes('studio-chat-parity-c2-strip.mjs'))
  assert.equal(mine.length, 3)
  assert.doesNotThrow(() => registryChecks(text), 'the real registry passes')
  for (const [, index] of mine) assert.ok(await throws(() => registryChecks(lines.filter((_, at) => at !== index).join('\n'))), `without line ${index + 1}`)
  assert.ok(await throws(() => registryChecks(text.replace('// LATER-CHANGE: FRONTEND-1, chat parity C2: Studio executor', '// LATER-CHANGE: FRONTEND-1, parity: Studio executor'))), 'a changed marker comment')
  assert.ok(await throws(() => registryChecks(lines.filter(line => !line.includes('studio-voice-call-strip.mjs')).join('\n'))), 'a base line lost')
  assert.ok(await throws(() => registryChecks(lines.filter(line => !line.includes('one line per later change, above this comment')).join('\n'))), 'the marker comments lost')
})

console.log(`\n${failed ? 'FAILED' : 'PASS'}: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
