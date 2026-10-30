// FRONTEND-2 (B51, 30 Oct): proof of PK's UAT feedback F-01 and F-02 on the Studio first-run welcome. TWO flags, both exact "true", build-time, default off:
//   NEXT_PUBLIC_STUDIO_WELCOME_TRIM       the welcome loses the "Bring an idea..." line, the "Need a starting point?" caption, the idle "Choose a starter..." hint and Director's opening greeting bubble (Studio only; Director is unchanged)
//   NEXT_PUBLIC_STUDIO_DIRECTOR_MARK_TRIM the four-pointed star beside "Director" (header) and above the first-run welcome is not drawn; lib/studio-director-mark.ts STUDIO_DIRECTOR_MARK "none" | "deckster" is the one line to draw the real mark
//
//   node scripts/test-studio-welcome-trim.mjs        (plain node: transpile + vm of the REAL sources, react-dom/server, no network, no browser, no services)
//   WELCOME_TRIM_DIRECTOR_DIR=<backend/director checkout> node scripts/test-studio-welcome-trim.mjs     also checks the recorded frames byte for byte against Director's own result files (default ~/Deckster/backend/director when present)
//
// FRAMES: Director's own RECORDED frames of a new session, two recordings. (1) DIRECTOR-2's offline recording of one whole new Studio session from real Director code (uat 749df53e): scripts/fixtures/studio-welcome-trim/pk-f03-scenario-A.json, copied from
// workspace main streams/director2/pk-f03-new-session/scenario-A.json (sha in the fixture): connect (build_control_capability, theme_sync, presentation_init, theme_sync, the greeting), the brief, a clarifying question, the answer, the plan card, the outline, the build, ready.
// The recording masks ids and timestamps; the proof gives each frame a stable id (msg_f03_<n>) and the recorded t_ms offset from a fixed start, nothing else. The user's rows are the recording's own inbound texts, built the way Studio builds them (userMessages rows).
// (2) THEME-2's, already in this repo: scripts/fixtures/studio-theme-restore/new-session-default-theme.json, the frames Director origin/uat (a76a086) sends when a new session connects, and its reconnect replay of the same greeting id (recorded user text and reply from reconnect-theme-restore.json).
// The derived frames (a reply restamped to follow the user's turn, the greeting re-sent with a new id after a user turn) are labelled where they are made.
// What runs: components/builder/message-list.tsx, components/builder/chat/studio-welcome.tsx, components/builder/chat/studio-director-header.tsx and the libs they import, transpiled and evaluated in a vm (the pattern of test-studio-first-run-v2.mjs), with a small
// hook runtime so a mounted MessageList keeps its refs and its memo between renders (the greeting must not pop back after the first message).
// What it proves:
//  1. each flag is exact "true", and each acts alone;  2. flag off is the base: tree + markup hashes equal the BASE sources' on a matrix, for every flag spelling; the strip gives the three files back byte for byte;
//  3. WELCOME_TRIM: the exact removed and kept elements (flag-on markup is the flag-off markup minus four elements, nothing else), the busy notice stays, legacy/open-deck/restored welcomes are unchanged;
//  4. the greeting, on Director's recorded frames: hidden on an empty new session, stays hidden after the first user message and after Director's reply, a later same-text assistant message after a user turn still shows, a restored history is unchanged, the memo follows;
//  5. MARK_TRIM: the star is not drawn in the header and the welcome (none), the real mark is drawn at the star's size in both (deckster) by changing the ONE constant, the CSS can match only flag-on markup; each flag alone leaves the other's markup untouched;
//  6. scope over the COMMITTED diff, GATE-SAFE (subject across `rev-list --no-merges BASE..head`, HEAD^2 on the gate's merge, registry / .env.example / strip reads past later changes, no hash-object --stdin);  7. mutants are caught.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import ReactMarkdown from 'react-markdown'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import postcss from 'postcss'
import {
  BASE_COMMIT, WELCOME_TRIM_FILES, WELCOME_TRIM_NEW_FILES, WELCOME_TRIM_PIN_EDITS, WELCOME_TRIM_SCOPE_FILES, WELCOME_TRIM_ENV_BLOCK, WELCOME_TRIM_ANY_MARKER_RE, WELCOME_TRIM_MARKER_RE,
  DIRECTOR_MARK_TRIM_MARKER_RE, WELCOME_TRIM_SUBJECTS, WELCOME_TRIM_FLAG, DIRECTOR_MARK_TRIM_FLAG, WELCOME_TRIM_PROOF_FILES, stripWelcomeTrim,
} from './studio-welcome-trim-strip.mjs'
import * as registry from './studio-later-changes.mjs'

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
const baseText = rel => git('show', `${BASE_COMMIT}:${rel}`)

/** Every OTHER registered change's strip, in the registry's order (this change's is left out): a file is read as this change left it, whatever other changes marked in it. */
const applyAll = (list, rel, text) => list.reduce((out, strip) => { const next = typeof strip === 'function' ? strip(rel, out) : out; return typeof next === 'string' ? next : out }, text)
const otherStrips = (rel, text) => applyAll(registry.LATER_STRIPS.filter(strip => strip !== stripWelcomeTrim), rel, text)
/** The strips of every change registered AFTER this one (below this change's strip in LATER_STRIPS). */
const laterStrips = (rel, text) => { const at = registry.LATER_STRIPS.indexOf(stripWelcomeTrim); return applyAll(at === -1 ? [] : registry.LATER_STRIPS.slice(at + 1), rel, text) }
const laterBlocks = () => { const at = registry.LATER_ENV_BLOCKS.indexOf(WELCOME_TRIM_ENV_BLOCK); return at === -1 ? [] : registry.LATER_ENV_BLOCKS.slice(at + 1) }

let passed = 0
const failed = []
async function check(label, fn) {
  if (process.env.CHECK_ONLY && !label.includes(process.env.CHECK_ONLY)) return
  try { await fn(); passed++; console.log(`PASS ${label}`) } catch (error) { failed.push(label); console.error(`FAIL ${label}: ${error?.stack?.split('\n').slice(0, 5).join(' | ') ?? error}`) }
}
let caught = 0
const missed = []
async function mutant(label, run) {
  if (process.env.CHECK_ONLY) return
  try { await run(); missed.push(label); console.error(`MISSED mutant ${label}`) } catch { caught++; console.log(`CAUGHT mutant ${label}`) }
}
const swap = (text, from, to) => { assert.equal(text.split(from).length, 2, `exactly one ${JSON.stringify(from.slice(0, 80))}`); return text.replace(from, () => to) }

// ---- the loader: the real sources in a vm, with a hook runtime ------------------------------------------------------------------------------
const MESSAGE_LIST = 'components/builder/message-list.tsx', WELCOME = 'components/builder/chat/studio-welcome.tsx', HEADER = 'components/builder/chat/studio-director-header.tsx'
const TRIM_LIB = 'lib/studio-welcome-trim.ts', MARK_LIB = 'lib/studio-director-mark.ts', MARK_CSS = 'components/builder/chat/studio-director-mark-trim.css'
const env = {}
const refuse = () => { throw new Error('welcome-trim fixture refuses services, timers and writes') }
/** A mounted component's hooks: refs and memos live in `slots` by call position, as React keeps them between renders. Outside a mount (the children react-dom renders) a ref is fresh and a memo runs. */
let mounted = null
const depsEqual = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => Object.is(value, b[index]))
const hookReact = {
  ...React,
  useRef: initial => { if (!mounted) return { current: initial }; const slot = mounted.at++; return mounted.slots[slot] ?? (mounted.slots[slot] = { current: initial }) },
  useMemo: (compute, deps) => {
    if (!mounted) return compute()
    const slot = mounted.at++, prev = mounted.slots[slot]
    if (prev && depsEqual(prev.deps, deps)) return prev.value
    const value = compute(); mounted.slots[slot] = { deps, value }; mounted.computes++; return value
  },
  useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect() {},
}
const stubs = {
  react: hookReact,
  'react/jsx-runtime': jsxRuntime, 'react-markdown': ReactMarkdown,
  'lucide-react': new Proxy({}, { get: (_, name) => name === '__esModule' ? false : (props => React.createElement('svg', { 'data-icon': String(name), width: props?.size })) }),
  '@/components/ui/button': { Button: 'button' }, '@/components/ui/badge': { Badge: 'span' }, '@/components/file-chip': { FileChip: 'FileChip' },
  '@/lib/debug-log': { debugLog() {} }, '@/lib/slide-compose-async': { hasLiveTrackedEphemeralMessage: (ids, tracked) => ids.some(id => tracked.has(id)) },
  '@/lib/layout-service-client': { LAYOUT_VIEWER_URL_POLICY: {} }, '@/lib/layout-viewer-url-policy': { evaluateLayoutViewerUrl: url => ({ status: 'allowed', url }) },
  '@/lib/mdc-flags': { CHAT_CLARITY: false, CHAT_QUESTIONS: false }, '@/lib/build-narration-heuristics': { shouldRerouteEphemeral: value => Boolean(value) },
  '@/components/builder/chat/question-card': { QuestionCard: 'QuestionCard' }, '@/components/builder/chat/studio-outline-card': { StudioOutlineCard: 'StudioOutlineCard' },
  './studio-director.css': {},
}
const transpiled = new Map()
const compile = (file, text) => ts.transpileModule(text, { fileName: file, reportDiagnostics: true,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
/** `sourceOverrides`: {rel: text} compiled in place of the file on disk, into this loader only (the base's files for the identity runs, mutated copies for the mutants). This change's own lines are LIVE in the files on disk; every other change's are out. */
function createLoader(sourceOverrides = {}) {
  const cache = new Map()
  const overridden = new Map()
  const resolve = (spec, from) => {
    const base = spec.startsWith('@/') ? path.join(root, spec.slice(2)) : path.resolve(path.dirname(from), spec)
    for (const suffix of ['.ts', '.tsx']) if (fs.existsSync(base + suffix)) return base + suffix
    return null
  }
  const requireFor = (spec, from) => {
    if (spec in stubs) return stubs[spec]
    if (spec.endsWith('.css')) return {}
    if (spec.startsWith('@/') || spec.startsWith('.')) {
      const file = resolve(spec, from)
      assert.ok(file, `unresolved import ${spec} in ${path.relative(root, from)}`)
      return run(file)
    }
    throw new Error(`unexpected import ${spec} in ${path.relative(root, from)}`)
  }
  function run(file) {
    if (cache.has(file)) return cache.get(file)
    const mod = { exports: {} }
    cache.set(file, mod.exports)
    const rel = path.relative(root, file)
    if (rel in sourceOverrides) overridden.set(file, compile(file, otherStrips(rel, sourceOverrides[rel])))
    else if (!transpiled.has(file)) transpiled.set(file, compile(file, otherStrips(rel, fs.readFileSync(file, 'utf8'))))
    vm.runInNewContext(overridden.get(file) ?? transpiled.get(file), { module: mod, exports: mod.exports, process: { env }, console, fetch: refuse, setTimeout: refuse, clearTimeout: refuse, require: spec => requireFor(spec, file) })
    cache.set(file, mod.exports)
    return mod.exports
  }
  const api = { load: rel => run(path.join(root, rel)) }
  api.list = api.load(MESSAGE_LIST).MessageList
  return api
}
const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL', FIRST_RUN = 'NEXT_PUBLIC_STUDIO_FIRST_RUN_V2'
/** `shell` / `firstRun`: 'true' by default, null to leave the variable unset. `welcome` / `mark`: undefined leaves it unset. */
const setFlags = ({ shell = 'true', firstRun = 'true', welcome, mark } = {}) => {
  for (const key of [SHELL, FIRST_RUN, WELCOME_TRIM_FLAG, DIRECTOR_MARK_TRIM_FLAG]) delete env[key]
  if (shell !== null) env[SHELL] = shell
  if (firstRun !== null) env[FIRST_RUN] = firstRun
  if (welcome !== undefined) env[WELCOME_TRIM_FLAG] = welcome
  if (mark !== undefined) env[DIRECTOR_MARK_TRIM_FLAG] = mark
}
const baseOverrides = Object.fromEntries([MESSAGE_LIST, WELCOME, HEADER].map(rel => [rel, baseText(rel)]))
const loader = createLoader()
const baseLoader = createLoader(baseOverrides)
const { DIRECTOR_522_INITIAL_GREETING } = loader.load('lib/studio-greeting-lifecycle.ts')
const trimLib = loader.load(TRIM_LIB)
const markLib = loader.load(MARK_LIB)

// ---- fixtures: Director's recorded frames ---------------------------------------------------------------------------------------------------
const F03 = JSON.parse(read('scripts/fixtures/studio-welcome-trim/pk-f03-scenario-A.json'))
const SOURCE_F03 = process.env.WELCOME_TRIM_F03_SOURCE ? path.resolve(process.env.WELCOME_TRIM_F03_SOURCE) : path.join(os.homedir(), 'Deckster/.worktrees/frontend2-ws/streams/director2/pk-f03-new-session/scenario-A.json')
const SESSION = F03.source.session_id
const T0 = Date.parse('2026-10-30T12:00:00.000Z'), iso = ms => new Date(T0 + ms).toISOString()
/** The recording masks ids and timestamps (<id#n>, <ts>): a stable id per mask and the recorded offset as the time. Nothing else is touched. */
const unmask = (frame, tMs) => JSON.parse(JSON.stringify(frame).replace(/<id#(\d+)>/g, 'msg_f03_$1').replace(/"<ts>"/g, JSON.stringify(iso(tMs))))
/** What hooks/use-deckster-websocket-v2.ts keeps OUT of the chat messages (shouldAddToMessages); every other frame type is a message. Asserted against the hook's source in section 0. */
const HOOK_EXCLUDES = ['status_update', 'sync_response', 'presentation_init', 'slide_context', 'token_usage', 'slide_progress', 'slide_built', 'slide_ready', 'slide_failed', 'template_ingest_update', 'template_ingest_ready', 'template_ingest_failed', 'theme_sync', 'session_directive', 'element_directive', 'build_phase', 'build_event', 'build_control_capability']
const outbound = F03.frames.filter(frame => frame.direction === 'out').map(frame => ({ ...frame, frame: unmask(frame.frame, frame.t_ms) }))
const chatEntries = outbound.filter(frame => !HOOK_EXCLUDES.includes(frame.type))
const chatFrames = chatEntries.map(entry => entry.frame)
const inbound = F03.frames.filter(frame => frame.direction === 'in').map(frame => ({ turn: frame.turn, row: { id: `user-f03-${frame.seq}`, text: frame.frame.data.text, timestamp: T0 + frame.t_ms } }))
const THEME_NEW = JSON.parse(read('scripts/fixtures/studio-theme-restore/new-session-default-theme.json'))
const THEME_TURN = JSON.parse(read('scripts/fixtures/studio-theme-restore/reconnect-theme-restore.json'))
const connectFrames = THEME_NEW.steps[2].frames // theme_sync, presentation_init, theme_sync, chat_message (the greeting)
const connectGreeting = connectFrames.find(frame => frame.type === 'chat_message')
const reconnectGreeting = THEME_NEW.steps[16].frames.find(frame => frame.type === 'chat_message') // Director's replay of the same greeting after a reconnect
const [themeUser, themeReply] = THEME_TURN.steps[5].frames.filter(frame => frame.type === 'chat_message') // the recorded user text and Director's reply (a history replay)
const recordedGreeting = chatFrames[0] // the greeting (turn 0, 19 ms after connect)
const recordedReply = chatFrames.find(frame => frame.payload?.text?.startsWith("Here's my proposed plan")) // Director's plan card text, after the user's second turn
const recordedReply2 = chatFrames.find(frame => frame.payload?.text?.startsWith("I've created an outline")) // after the third
const recordedGreetingOnly = connectGreeting // THEME-2's recording of the same greeting (current Director connect handler)
const T = text => Date.parse(text)
const userTurn = inbound[0].row // the recording's own first brief, as Studio's row: "Help me pitch a new onboarding flow to our leadership team"
const baseProps = (over = {}) => ({
  sessionId: SESSION, userMessages: [], messages: [], userMessageIdsRef: { current: new Set() }, userMessageContentMapRef: { current: new Map() },
  hasSeenWelcomeRef: { current: false }, answeredActionsRef: { current: new Set() }, messagesEndRef: { current: null }, onActionClick: refuse,
  onDraftPrompt: () => {}, ...over,
})
const withUser = (props, user = userTurn) => ({ ...props, userMessages: [user], userMessageIdsRef: { current: new Set([user.id]) } })
const actionsMarker = React.createElement('div', { 'data-fixture-actions': 'true' }, 'stage actions')

const ser = value => JSON.stringify(value, (key, item) => typeof item === 'function' ? `[fn ${item.name || ''}]` : item === undefined ? '__undefined__' : item)
const OWN = new Set(['StudioWelcome', 'StudioFirstRunStarters', 'StudioFirstRunHead'])
const rendersNothing = child => child === false || child === true || child === null || child === undefined
function expand(node) {
  if (Array.isArray(node)) return node.filter(child => !rendersNothing(child)).map(expand)
  if (!node || typeof node !== 'object') return node
  if (typeof node.type === 'function' && OWN.has(node.type.name)) return expand(node.type(node.props))
  const props = {}
  for (const [key, value] of Object.entries(node.props ?? {})) props[key] = key === 'children' ? expand(value) : value
  return { type: typeof node.type === 'function' ? `[component ${node.type.name}]` : typeof node.type === 'symbol' ? 'Fragment' : node.type, props, key: node.key }
}
/** One mount of a MessageList: refs and memos persist between render() calls, as in React. */
function mount(api = loader) {
  const state = { slots: [], at: 0, computes: 0 }
  return {
    state,
    render(props) {
      mounted = state; state.at = 0
      try { return api.list(props) } finally { mounted = null }
    },
  }
}
/** React 19's server renderer hoists a <link rel="preload" as="image"> for an <img>; it is not part of what the components draw, so it is taken out of the markup the proof compares. */
const markupOf = tree => renderToStaticMarkup(tree).replace(/<link rel="preload" as="image"[^>]*\/>/g, '')
const once = (props, api = loader) => mount(api).render(props)
const html = (props, api = loader) => markupOf(once(props, api))
const hashOf = (props, api = loader) => { const tree = once(props, api); return sha(ser(expand(tree)) + '\n' + markupOf(tree)) }
const flat = node => Array.isArray(node) ? node.flatMap(flat) : !node || typeof node !== 'object' ? [] : [node, ...flat(node.props?.children)]
const count = (markup, pattern) => (markup.match(pattern) || []).length

const greetingProps = over => baseProps({ messages: [recordedGreeting], ...over })
const MATRIX = {
  'empty': () => baseProps(),
  'greeting-only (recorded)': () => baseProps({ messages: [recordedGreetingOnly] }),
  'greeting-and-actions': () => baseProps({ messages: [recordedGreeting], studioFirstRunActions: actionsMarker }),
  'greeting-busy': () => baseProps({ messages: [recordedGreeting], isGeneratingFinal: true, studioFirstRunActions: actionsMarker }),
  'empty-busy': () => baseProps({ currentStatus: { status: 'thinking', text: 'Thinking' } }),
  'two-greetings': () => baseProps({ messages: [recordedGreeting, { ...recordedGreeting, message_id: 'msg_dup_of_recorded' }] }),
  'greeting-and-user': () => withUser(baseProps({ messages: [recordedGreeting] })),
  'greeting-user-reply (restored)': () => withUser(baseProps({ messages: [recordedGreeting, recordedReply] })),
  'reply-only': () => baseProps({ messages: [recordedReply] }),
  'empty-with-deck-context': () => baseProps({ presentationContext: { title: 'Quarterly review', slideCount: 7 } }),
  'greeting-with-deck-context': () => baseProps({ messages: [recordedGreeting], presentationContext: { title: 'Quarterly review', slideCount: 7 } }),
  'greeting-restoring': () => baseProps({ messages: [recordedGreeting], studioRestoring: true }),
  'empty-no-draft-handler': () => baseProps({ onDraftPrompt: undefined }),
}
const SPELLINGS = [undefined, 'false', 'TRUE', '1', 'true ', '']

// ===== 0. the frames are Director's =====================================================================================================================
await check('the fixture frames are Director\'s own: the recorded greeting is accepted as DIRECTOR_522_INITIAL_GREETING, the hook keeps the non-chat frames out of the chat, and (when the source file is here) the frames are those of DIRECTOR-2\'s recording, verbatim', () => {
  assert.equal(recordedGreeting.payload.text, DIRECTOR_522_INITIAL_GREETING)
  assert.equal(recordedGreeting.role, 'assistant'); assert.equal(recordedGreeting.type, 'chat_message'); assert.equal(recordedGreeting.session_id, SESSION)
  assert.equal(recordedGreetingOnly.payload.text, DIRECTOR_522_INITIAL_GREETING)
  assert.ok(trimLib.isOpeningGreeting(recordedGreeting) && trimLib.isOpeningGreeting(recordedGreetingOnly), 'both recorded greetings are the opening greeting')
  assert.deepEqual(connectFrames.map(frame => frame.type), ['theme_sync', 'presentation_init', 'theme_sync', 'chat_message'], 'THEME-2\'s recorded connect: what Director sends a new session')
  assert.equal(connectGreeting.payload.text, DIRECTOR_522_INITIAL_GREETING); assert.equal(connectGreeting.role, 'assistant'); assert.ok(trimLib.isOpeningGreeting(connectGreeting))
  assert.equal(reconnectGreeting.message_id, connectGreeting.message_id, 'the reconnect replay carries the same id (the hook drops a repeated id, so the replay adds nothing to the chat)')
  assert.equal(themeUser.role, 'user'); assert.equal(themeReply.role, 'assistant'); assert.ok(!trimLib.isOpeningGreeting(themeReply))
  assert.match(read('hooks/use-deckster-websocket-v2.ts'), /message\.type !== 'theme_sync' &&/, 'theme_sync is not a chat message either')
  assert.ok(read('hooks/use-deckster-websocket-v2.ts').includes('!isDuplicate;'), 'a repeated message_id is dropped by the hook')
  assert.ok(!trimLib.isOpeningGreeting(recordedReply) && !trimLib.isOpeningGreeting(recordedReply2), 'Director\'s replies are not')
  assert.deepEqual(outbound.slice(0, 5).map(frame => frame.type), ['build_control_capability', 'theme_sync', 'presentation_init', 'theme_sync', 'chat_message'], 'DIRECTOR-2\'s recorded connect: nothing but the greeting is a chat message before the brief')
  assert.deepEqual(chatFrames.filter(frame => isGreeting(frame)).map(frame => frame.message_id), [recordedGreeting.message_id], 'the greeting occurs once in the whole recorded session')
  assert.equal(inbound.length, 4); assert.ok(inbound[0].row.timestamp > Date.parse(recordedGreeting.timestamp) && inbound[0].row.timestamp < Date.parse(recordedReply.timestamp), 'the recorded timeline: greeting, the brief, then Director\'s later messages')
  for (const type of HOOK_EXCLUDES) assert.ok(new RegExp(`message\\.type !== '${type}' &&`).test(read('hooks/use-deckster-websocket-v2.ts')) || type === 'session_directive' || type === 'element_directive', `the hook keeps ${type} out of the chat`)
  const hook = read('hooks/use-deckster-websocket-v2.ts')
  assert.match(hook, /message\.type !== 'status_update' &&\n\s+message\.type !== 'sync_response' &&\n\s+message\.type !== 'presentation_init' &&/, 'the hook never adds a presentation_init to the chat messages')
  if (!fs.existsSync(SOURCE_F03)) console.log(`  (source not present at ${SOURCE_F03}: fixture bytes only)`)
  else { const raw = fs.readFileSync(SOURCE_F03); assert.equal(sha(raw), F03.source.sha256, 'the source file is the one the fixture was cut from'); assert.deepEqual(JSON.parse(raw).frames, F03.frames, 'the fixture frames are the source\'s frames, verbatim') }
})
function isGreeting(frame) { return frame.type === 'chat_message' && frame.payload?.text === DIRECTOR_522_INITIAL_GREETING }

// ===== 1. the flags ====================================================================================================================================
await check('each flag is the exact string "true" (any other spelling is off), read when asked, and the two are independent', () => {
  for (const value of SPELLINGS) { setFlags({ welcome: value, mark: value }); assert.equal(trimLib.studioWelcomeTrimOn(), false, `welcome ${JSON.stringify(value)}`); assert.equal(markLib.studioDirectorMark(), null, `mark ${JSON.stringify(value)}`) }
  setFlags({ welcome: 'true' }); assert.equal(trimLib.studioWelcomeTrimOn(), true); assert.equal(markLib.studioDirectorMark(), null, 'the welcome flag does not turn the mark flag on')
  setFlags({ mark: 'true' }); assert.equal(trimLib.studioWelcomeTrimOn(), false, 'the mark flag does not turn the welcome flag on'); assert.deepEqual({ ...markLib.studioDirectorMark() }, { src: null }, 'default constant: nothing is drawn')
  assert.equal(markLib.STUDIO_DIRECTOR_MARK, 'none', 'the default mark is none')
  assert.deepEqual({ ...markLib.studioDirectorMark('deckster') }, { src: '/logo-icon-sm.png' }); assert.deepEqual({ ...markLib.studioDirectorMark('none') }, { src: null })
  setFlags({})
})
await check('the flags are documented in .env.example, default "false", each exactly once, and the lib files are import-light (no React, no I/O)', () => {
  const envFile = read('.env.example')
  for (const flag of [WELCOME_TRIM_FLAG, DIRECTOR_MARK_TRIM_FLAG]) assert.equal(count(envFile, new RegExp(`^${flag}="false"$`, 'gm')), 1, flag)
  for (const rel of [TRIM_LIB, MARK_LIB]) assert.doesNotMatch(read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''), /\b(fetch|WebSocket|localStorage|sessionStorage|XMLHttpRequest|setTimeout|from 'react')\b/, `${rel}: no I/O, no React`)
  assert.deepEqual([...read(MARK_LIB).matchAll(/^import .* from '(.*)'$/gm)].map(match => match[1]), ['@/lib/studio-new-logo'], 'the mark lib imports only the existing logo path')
})

// ===== 2. flag off is the base ==================================================================================================================================
await check('flag off is the base: for every spelling of each flag alone, on every transcript, with first-run v2 on and off, the BASE sources and this change\'s render the same element tree and the same markup', () => {
  for (const firstRun of ['true', null]) {
    setFlags({ firstRun })
    const baseline = Object.fromEntries(Object.entries(MATRIX).map(([name, make]) => [name, hashOf(make(), baseLoader)]))
    for (const value of SPELLINGS) {
      for (const flags of [{ welcome: value }, { mark: value }, { welcome: value, mark: value }]) {
        setFlags({ firstRun, ...flags })
        for (const [name, make] of Object.entries(MATRIX)) assert.equal(hashOf(make(), loader), baseline[name], `first-run ${firstRun}, ${JSON.stringify(flags)}: "${name}" is the base`)
      }
    }
  }
  setFlags({})
})
await check('flag off is the base, header: the Director header renders the same markup as the base\'s, every spelling, with and without the chat header', () => {
  for (const chatHeader of [undefined, 'true']) for (const state of ['connected', 'connecting', 'error']) {
    const props = { connectionState: state, actions: React.createElement('button', null, 'Share') }
    const make = (api, flags) => { setFlags(flags); env.NEXT_PUBLIC_STUDIO_CHAT_HEADER = chatHeader; const out = markupOf(React.createElement(api.load(HEADER).StudioDirectorHeader, props)); delete env.NEXT_PUBLIC_STUDIO_CHAT_HEADER; return out }
    const baseline = make(baseLoader, {})
    assert.match(baseline, /data-icon="Sparkles"/, 'the base draws the star')
    for (const value of SPELLINGS) for (const flags of [{ welcome: value }, { mark: value }]) assert.equal(make(loader, flags), baseline, `${chatHeader ?? 'plain'} header, ${state}, ${JSON.stringify(flags)}`)
  }
  setFlags({})
})
await check('the strip gives the three files back byte for byte (other changes\' lines out of both sides), and twice changes nothing more', () => {
  for (const rel of WELCOME_TRIM_FILES) {
    const now = read(rel), base = baseText(rel)
    assert.notEqual(now, base, `${rel} carries this change's lines`)
    assert.equal(stripWelcomeTrim(rel, now), base, `${rel}: stripped, it is the base's`)
    assert.equal(stripWelcomeTrim(rel, stripWelcomeTrim(rel, now)), base, `${rel}: idempotent`)
    assert.equal(registry.stripLaterChanges(rel, now), registry.stripLaterChanges(rel, base), `${rel}: through the registry (the older pins' read) it is the base's too`)
  }
  assert.equal(stripWelcomeTrim('lib/anything.ts', 'x'), 'x', 'a file it does not own comes back as it is')
})

// ===== 3. F-01: the exact removed and kept elements ==========================================================================================================
const REMOVED = [
  ['the "Bring an idea" line', /<p data-studio-director-welcome-part="intro">[^<]*<\/p>/],
  ['the "Need a starting point?" caption', /<p data-studio-director-welcome-part="caption">[^<]*<\/p>/],
  ['the idle "Choose a starter..." hint', /<p data-studio-director-welcome-part="hint">Choose a starter[^<]*<\/p>/],
]
const KEPT = [
  ['the head section', /<section data-studio-director-welcome="true" data-studio-first-run="true"/], ['the eyebrow', /<div data-studio-director-welcome-part="eyebrow">Your presentation brief<\/div>/],
  ['the heading', /<h2>What story are we telling today\?<\/h2>/], ['the starters section', /<section data-studio-first-run-starters="true"/],
  ['starter Pitch an idea', /data-studio-director-starter="pitch"/], ['starter Share a project update', /data-studio-director-starter="update"/], ['starter Explain a topic', /data-studio-director-starter="explain"/],
  ['the stage actions node (Replay intro / Explore templates / Blank canvas, the page\'s own)', /data-fixture-actions="true"/],
]
const cut = (markup, parts) => parts.reduce((out, [, pattern]) => out.replace(pattern, ''), markup)
await check('F-01 removed and kept: with the flag on, the empty first-run welcome is the flag-off welcome minus exactly the intro line, the caption and the idle hint; the heading, eyebrow, three starters and the stage actions stay', () => {
  setFlags({}); const off = html(baseProps({ studioFirstRunActions: actionsMarker }))
  for (const [label, pattern] of REMOVED) assert.match(off, pattern, `flag off draws ${label}`)
  setFlags({ welcome: 'true' }); const on = html(baseProps({ studioFirstRunActions: actionsMarker }))
  for (const [label, pattern] of REMOVED) assert.doesNotMatch(on, pattern, `flag on removes ${label}`)
  for (const [label, pattern] of KEPT) assert.match(on, pattern, `flag on keeps ${label}`)
  assert.equal(on, cut(off, REMOVED), 'nothing else changed: the flag-on markup is the flag-off markup with those three elements cut out')
  assert.doesNotMatch(on, /Bring an idea|Need a starting point|Choose a starter/)
  assert.equal(count(on, /data-studio-director-starter=/g), 3)
  setFlags({})
})
await check('F-01 busy: the busy notice "Director is working. Starters will be available when this step finishes." stays (status, not guidance), the starters are disabled, and the notice is the same element as today', () => {
  const props = () => baseProps({ messages: [recordedGreeting], isGeneratingFinal: true, studioFirstRunActions: actionsMarker })
  setFlags({}); const off = html(props())
  setFlags({ welcome: 'true' }); const on = html(props())
  const notice = /<p data-studio-director-welcome-part="hint">Director is working\. Starters will be available when this step finishes\.<\/p>/
  assert.match(off, notice); assert.match(on, notice, 'the busy notice stays')
  assert.equal(count(on, /disabled=""/g), 3, 'the three starters are disabled while busy')
  assert.doesNotMatch(on, /Choose a starter|Need a starting point|Bring an idea/)
  const thinking = baseProps({ currentStatus: { status: 'thinking', text: 'Thinking' } }); assert.match(html(thinking), notice, 'thinking status counts as busy too (welcomeBusy)')
  setFlags({})
})
await check('F-01 unchanged elsewhere: with the flag on the legacy welcome (first-run v2 off), an open deck\'s welcome ("What would you like to change?"), a conversation with a real turn and a restored history render exactly as the base', () => {
  const untouched = ['greeting-and-user', 'greeting-user-reply (restored)', 'reply-only', 'empty-with-deck-context', 'greeting-with-deck-context']
  setFlags({ welcome: 'true' })
  for (const name of untouched) assert.equal(hashOf(MATRIX[name](), loader), hashOf(MATRIX[name](), baseLoader), `${name}: first-run on, trim on: the base`)
  assert.match(html(MATRIX['greeting-with-deck-context']()), /What would you like to change\?/); assert.match(html(MATRIX['greeting-with-deck-context']()), /presentation assistant/, 'an open deck\'s greeting is drawn as today')
  assert.match(html(MATRIX['greeting-user-reply (restored)']()), /presentation assistant/, 'a restored history\'s greeting is drawn as today')
  setFlags({ firstRun: null, welcome: 'true' })
  for (const name of Object.keys(MATRIX)) assert.equal(hashOf(MATRIX[name](), loader), hashOf(MATRIX[name](), baseLoader), `${name}: first-run v2 OFF, trim on: the trim is the first-run welcome's, so nothing changes`)
  assert.match(html(MATRIX['empty']()), /What are we making\?/); assert.match(html(MATRIX['empty']()), /Need a starting point\?/, 'the legacy welcome keeps its own caption')
  setFlags({})
})

// ===== 4. F-01: Director's opening greeting, on Director's recorded frames =====================================================================================
const bubbles = markup => count(markup, /data-studio-director-message="director"/g)
const sawGreeting = markup => markup.includes('presentation assistant')
await check('greeting, empty new session (recorded greeting-only run): flag off draws Director\'s bubble between the head and the starters; flag on draws none, and the transcript data still holds it', () => {
  setFlags({}); const off = html(MATRIX['greeting-only (recorded)']())
  assert.ok(sawGreeting(off) && bubbles(off) === 1); assert.ok(off.indexOf('data-studio-first-run="true"') < off.indexOf('presentation assistant') && off.indexOf('presentation assistant') < off.indexOf('data-studio-first-run-starters'))
  setFlags({ welcome: 'true' })
  const props = MATRIX['greeting-only (recorded)'](), before = JSON.stringify(props.messages)
  const on = html(props)
  assert.ok(!sawGreeting(on) && bubbles(on) === 0, 'no greeting bubble')
  assert.match(on, /data-studio-first-run="true"/, 'the welcome is still the first run'); assert.equal(on, html(MATRIX['empty']()), 'the same welcome as an empty transcript')
  assert.equal(JSON.stringify(props.messages), before, 'the messages handed in are not changed (Studio\'s render skips the entry; the data stays)')
  setFlags({})
})
await check('greeting, the first user message: it does not pop back above the message (recorded greeting, the user\'s turn, Director\'s recorded reply), on one mounted list', () => {
  setFlags({ welcome: 'true' }); const m = mount()
  const empty = markupOf(m.render(greetingProps())); assert.ok(!sawGreeting(empty), 'frame 1: empty new session, hidden')
  const turn = withUser(greetingProps()); const afterSend = markupOf(m.render(turn))
  assert.ok(!sawGreeting(afterSend), 'frame 2: the user\'s first message, the greeting stays hidden'); assert.match(afterSend, /Help me pitch a new onboarding flow/); assert.doesNotMatch(afterSend, /data-studio-first-run/, 'the welcome is gone with the first message')
  const reply = markupOf(m.render(withUser(greetingProps({ messages: [recordedGreeting, recordedReply] })))); assert.ok(!sawGreeting(reply), 'frame 3: Director\'s recorded reply arrives, still no greeting')
  assert.ok(reply.indexOf('Help me pitch a new onboarding flow') < reply.indexOf('proposed plan for your presentation'), 'the transcript reads: the user\'s message, then Director\'s reply')
  const later = markupOf(m.render(withUser(greetingProps({ messages: [recordedGreeting, recordedReply, recordedReply2] })))); assert.ok(!sawGreeting(later), 'frame 4: a later Director frame, still no greeting'); assert.equal(count(later, /data-studio-director-message="user"/g), 1); assert.equal(bubbles(later), 2)
  // the same sequence with the flag off is today's: the greeting is the first bubble throughout
  setFlags({}); const o = mount(), offFrames = [greetingProps(), turn, withUser(greetingProps({ messages: [recordedGreeting, recordedReply] }))].map(props => markupOf(o.render(props)))
  assert.ok(offFrames.every(sawGreeting), 'flag off: the greeting stays in every frame, as today')
})
await check('greeting on DIRECTOR-2\'s recorded new session (real Director code, uat 749df53e, five turns): hidden on the empty new session, it does not reappear after the brief, the answer, the plan, the outline gate or the build, and every later Director message shows exactly as it would without the greeting', () => {
  const upTo = turn => ({ messages: chatEntries.filter(entry => entry.turn <= turn).map(entry => entry.frame), users: inbound.filter(entry => entry.turn <= turn).map(entry => entry.row) })
  const at = (turn, { dropGreeting = false } = {}) => { const { messages, users } = upTo(turn); return baseProps({ sessionId: SESSION, messages: dropGreeting ? messages.filter(frame => !isGreeting(frame)) : messages, userMessages: users, userMessageIdsRef: { current: new Set(users.map(row => row.id)) } }) }
  const turns = [...new Set(F03.frames.map(frame => frame.turn))].sort((a, b) => a - b)
  assert.deepEqual(turns, [0, 1, 2, 3, 4])
  setFlags({ welcome: 'true' }); const m = mount(); const on = turns.map(turn => markupOf(m.render(at(turn))))
  setFlags({}); const o = mount(); const off = turns.map(turn => markupOf(o.render(at(turn)))); const without = turns.map(turn => markupOf(mount().render(at(turn, { dropGreeting: true }))))
  assert.ok(!sawGreeting(on[0]) && /data-studio-first-run="true"/.test(on[0]) && bubbles(on[0]) === 0, 'turn 0, the empty new session: the welcome, no greeting bubble')
  assert.ok(sawGreeting(off[0]), 'turn 0, flag off: the greeting is drawn, as today')
  for (const turn of turns.slice(1)) {
    assert.ok(!sawGreeting(on[turn]), `turn ${turn}: the greeting is not drawn`)
    assert.ok(sawGreeting(off[turn]), `turn ${turn}, flag off: it is drawn, as today`)
    assert.equal(on[turn], without[turn], `turn ${turn}: flag on is exactly the flag-off render of the same transcript without the greeting (Director's later messages and the user's rows all show, nothing else moved)`)
    assert.equal(bubbles(off[turn]) - bubbles(on[turn]), 1, `turn ${turn}: one Director bubble fewer, the greeting's`)
    for (const entry of chatEntries.filter(item => item.turn <= turn && !item.frame.payload?.ephemeral && item.type === 'chat_message' && !isGreeting(item.frame))) {
      const plain = entry.frame.payload.text.split(/[*_`\n]/)[0].slice(0, 40).replace(/'/g, '&#x27;').replace(/"/g, '&quot;')
      assert.ok(on[turn].includes(plain), `turn ${turn}: Director's message "${plain.slice(0, 30)}" is drawn`)
    }
  }
  assert.equal(count(on[4], /data-studio-director-message="user"/g), 4, 'the four recorded user rows are drawn')
  assert.ok(chatEntries.some(entry => entry.turn === 4 && entry.frame.payload?.text?.startsWith('🎉 Your presentation is ready')) && on[4].includes('Your presentation is ready'), 'the last recorded Director message (ready) is drawn')
  setFlags({})
})
await check('greeting on THEME-2\'s recorded connect frames (Director origin/uat): hidden on the new session, hidden after the user\'s first message and Director\'s recorded reply, and still hidden when a reconnect replays the same greeting id; flag off draws it throughout', () => {
  const user = { id: 'user-theme-1', text: themeUser.payload.text, timestamp: T('2026-10-14T04:22:00.000Z') } // Studio's own row for the recorded user text
  const reply = { ...themeReply, session_id: connectGreeting.session_id, timestamp: '2026-10-14T04:22:05.000Z' } // DERIVED, labelled: Director's recorded reply with the session id and a time that follows the user's turn
  const at = (messages, users = []) => baseProps({ sessionId: connectGreeting.session_id, messages, userMessages: users, userMessageIdsRef: { current: new Set(users.map(row => row.id)) } })
  const frames = () => [at([connectGreeting]), at([connectGreeting], [user]), at([connectGreeting, reply], [user]), at([connectGreeting, reply, reconnectGreeting], [user])]
  setFlags({ welcome: 'true' }); const m = mount(); const on = frames().map(props => markupOf(m.render(props)))
  assert.ok(!sawGreeting(on[0]) && /data-studio-first-run="true"/.test(on[0]), 'frame 1: the new session\'s welcome, no greeting bubble')
  assert.ok(!sawGreeting(on[1]) && on[1].includes('Build a claims automation ROI deck') && !/data-studio-first-run/.test(on[1]), 'frame 2: the user\'s message, no greeting, the welcome gone')
  assert.ok(!sawGreeting(on[2]) && on[2].includes('I can build that. Who is the audience?'), 'frame 3: Director\'s recorded reply, no greeting')
  assert.ok(!sawGreeting(on[3]), 'frame 4: the reconnect replays the same greeting id: still no greeting')
  setFlags({}); const o = mount(); const off = frames().map(props => markupOf(o.render(props)))
  assert.ok(off.every(sawGreeting), 'flag off: the greeting is drawn in every frame, as today')
})
await check('greeting, a later genuine assistant message with the same words (the recorded greeting re-sent with a new id after the user\'s turn) still shows; a greeting never seen on an empty session is never hidden', () => {
  const resent = { ...recordedGreeting, message_id: 'msg_resent_after_user', timestamp: iso(400) } // DERIVED, labelled: the recorded frame with a new id and a time after the user's turn
  setFlags({ welcome: 'true' }); const m = mount()
  assert.ok(!sawGreeting(markupOf(m.render(greetingProps()))))
  assert.ok(!sawGreeting(markupOf(m.render(withUser(greetingProps())))))
  const after = markupOf(m.render(withUser(greetingProps({ messages: [recordedGreeting, recordedReply, resent] }))))
  assert.equal(count(after, /presentation assistant/g), 1, 'exactly one greeting is drawn: the later one, after the user\'s turn')
  assert.ok(after.indexOf('presentation assistant') > after.indexOf('Help me pitch a new onboarding flow'), 'it is below the user\'s message')
  // never seen empty: a history that opens with it (restored) is drawn from its first render and on every later one
  const r = mount(); const restored = withUser(greetingProps({ messages: [recordedGreeting, recordedReply] }))
  for (let i = 0; i < 3; i++) assert.ok(sawGreeting(markupOf(r.render(restored))), `restored history, render ${i + 1}: the greeting is drawn as today`)
  // a different id in a different session is never swept up by an earlier one
  const other = mount(); assert.ok(!sawGreeting(markupOf(other.render(greetingProps()))))
  assert.ok(sawGreeting(markupOf(other.render(withUser(greetingProps({ sessionId: 'another-session', messages: [{ ...recordedGreeting, message_id: 'msg_other_session', session_id: 'another-session' }, recordedReply] }))))), 'another session\'s greeting (never seen empty) is drawn')
  setFlags({})
})
await check('greeting, the welcome\'s own states: restoring then confirmed new hides it (the memo follows the flip), a restored session that settles is unchanged, two greetings are both hidden, an open deck keeps it', () => {
  setFlags({ welcome: 'true' })
  const m = mount(), props = greetingProps({ studioRestoring: true })
  assert.ok(sawGreeting(markupOf(m.render(props))) && !/data-studio-first-run/.test(markupOf(m.render(props))), 'while restoring: no welcome, and the greeting is not hidden (the session may be an existing one)')
  const settled = { ...props, studioRestoring: false }
  const computesBefore = m.state.computes
  const html2 = markupOf(m.render(settled))
  assert.ok(!sawGreeting(html2) && /data-studio-first-run="true"/.test(html2), 'confirmed new: the welcome appears and the greeting goes, in the same render')
  assert.ok(m.state.computes > computesBefore, 'the transcript memo was recomputed for the flip (its dependency list holds the hidden ids)')
  const existing = mount(), restoredProps = withUser(greetingProps({ studioRestoring: true, messages: [recordedGreeting, recordedReply] }))
  assert.ok(sawGreeting(markupOf(existing.render(restoredProps))))
  assert.ok(sawGreeting(markupOf(existing.render({ ...restoredProps, studioRestoring: false }))), 'an existing session that finishes restoring keeps its greeting')
  const two = html(baseProps({ messages: [recordedGreeting, { ...recordedGreeting, message_id: 'msg_dup' }] })); assert.ok(!sawGreeting(two) && bubbles(two) === 0, 'two greetings (a reconnect) are both hidden')
  const deck = html(MATRIX['greeting-with-deck-context']()); assert.ok(sawGreeting(deck), 'an open deck\'s welcome keeps the greeting')
  setFlags({})
})
await check('greeting, what is and is not "the opening greeting" (units on lib/studio-welcome-trim.ts)', () => {
  const g = recordedGreeting, is = trimLib.isOpeningGreeting
  assert.ok(is(g))
  assert.ok(!is({ ...g, role: undefined }) && !is({ ...g, role: 'user' }), 'only an assistant message')
  assert.ok(!is({ ...g, type: 'action_request' }) && !is({ ...g, message_id: '' }) && !is({ ...g, message_id: undefined }), 'a chat message with an id')
  assert.ok(!is({ ...g, payload: { ...g.payload, text: g.payload.text + ' ' } }) && !is({ ...g, payload: { ...g.payload, text: g.payload.text.toLowerCase() } }) && !is({ ...g, payload: null }) && !is({ ...g, payload: 'Hello' }), 'the exact words, nothing near them')
  const L = trimLib.latchOpeningGreetings, none = trimLib.NO_HIDDEN_GREETINGS
  assert.equal(L(none, [], true), none); assert.equal(L(none, [g], false), none, 'not empty: nothing is added')
  const one = L(none, [g], true); assert.deepEqual([...one], [g.message_id])
  assert.equal(L(one, [g], true), one, 'unchanged: the same set back (a stable memo dependency)'); assert.equal(L(one, [g], false), one, 'once added it stays while the entry is there, whatever the answer now')
  assert.equal(L(one, [g, recordedReply], false), one)
  assert.equal(L(one, [recordedReply], false), none, 'the entry has left the transcript: dropped')
  assert.deepEqual([...L(one, [g, { ...g, message_id: 'later' }], false)], [g.message_id], 'a same-text message that arrives when the session is no longer empty is not added')
  assert.deepEqual([...L(none, [g, { ...g, message_id: 'dup' }], true)].sort(), ['dup', g.message_id].sort())
})

// ===== 5. F-02: the star =======================================================================================================================================
const STAR_HEAD = /<span data-studio-first-run-part="mark" aria-hidden="true"><svg data-icon="Sparkles" width="22"><\/svg><\/span>/
const STAR_HEADER = /<span aria-hidden="true"><svg data-icon="Sparkles" width="13"><\/svg><\/span>/
const headerMarkup = (flags, props = {}, api = loader, chatHeader) => {
  setFlags(flags); if (chatHeader) env.NEXT_PUBLIC_STUDIO_CHAT_HEADER = 'true'
  try { return markupOf(React.createElement(api.load(HEADER).StudioDirectorHeader, { connectionState: 'connected', ...props })) } finally { delete env.NEXT_PUBLIC_STUDIO_CHAT_HEADER; setFlags({}) }
}
const deckster = size => `<img data-studio-director-mark="deckster" src="/logo-icon-sm.png" alt="" width="${size}" height="${size}"/>`
const withMarkLoader = value => createLoader({ [MARK_LIB]: swap(read(MARK_LIB), "STUDIO_DIRECTOR_MARK: 'none' | 'deckster' = 'none'", `STUDIO_DIRECTOR_MARK: 'none' | 'deckster' = '${value}'`) })
await check('F-02 "none": the star is not drawn above the first-run welcome or beside "Director"; nothing else in either changes and no gap element is left', () => {
  const props = () => baseProps({ studioFirstRunActions: actionsMarker })
  setFlags({}); const offWelcome = html(props()); assert.match(offWelcome, STAR_HEAD)
  setFlags({ mark: 'true' }); const onWelcome = html(props())
  assert.doesNotMatch(onWelcome, /data-studio-first-run-part="mark"|data-icon="Sparkles"|<img/); assert.equal(onWelcome, offWelcome.replace(STAR_HEAD, ''), 'the welcome is the flag-off welcome minus the star span, nothing else')
  for (const chatHeader of [false, true]) {
    const off = headerMarkup({}, {}, loader, chatHeader), on = headerMarkup({ mark: 'true' }, {}, loader, chatHeader)
    assert.match(off, STAR_HEADER); assert.doesNotMatch(on, /data-icon="Sparkles"|<img|aria-hidden/); assert.equal(on, off.replace(STAR_HEADER, ''), `${chatHeader ? 'chat' : 'plain'} header: minus the star span, nothing else`)
    assert.match(on, /<strong>Director<\/strong><span role="status"[^>]*data-connection-state="connected"/, 'the name and the connection stay, in order')
    assert.equal(count(on, /<span/g), 1, 'no empty placeholder span stands where the star was')
  }
})
await check('F-02 "deckster" (the ONE constant changed from "none"): the real mark public/logo-icon-sm.png is drawn at the star\'s size (22 px above the welcome, 13 px in the header) inside the star\'s own span, in both places', () => {
  const api = withMarkLoader('deckster')
  setFlags({}); const offWelcome = html(baseProps({ studioFirstRunActions: actionsMarker }), api)
  assert.match(offWelcome, STAR_HEAD, 'with the flag off the constant changes nothing: the star is drawn')
  setFlags({ mark: 'true' }); const onWelcome = html(baseProps({ studioFirstRunActions: actionsMarker }), api)
  assert.equal(onWelcome, offWelcome.replace(STAR_HEAD, `<span data-studio-first-run-part="mark" aria-hidden="true">${deckster(22)}</span>`), 'the welcome: the star replaced by the mark at 22 px, nothing else')
  for (const chatHeader of [false, true]) {
    const off = headerMarkup({}, {}, api, chatHeader), on = headerMarkup({ mark: 'true' }, {}, api, chatHeader)
    assert.equal(on, off.replace(STAR_HEADER, `<span aria-hidden="true">${deckster(13)}</span>`), `${chatHeader ? 'chat' : 'plain'} header: the star replaced by the mark at 13 px, nothing else`)
  }
  assert.equal(read(MARK_LIB).split('\n').filter(line => /^export const STUDIO_DIRECTOR_MARK:/.test(line)).length, 1, 'one line holds the choice')
  const png = fs.readFileSync(path.join(root, 'public/logo-icon-sm.png'))
  assert.equal(png.subarray(1, 4).toString(), 'PNG'); assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [160, 160], 'the asset is the 160x160 export of the logo')
  assert.match(read('lib/studio-new-logo.ts'), /STUDIO_NEW_LOGO_SRC = '\/logo-icon-sm\.png'/, 'the one path the Studio rail\'s brand tile already draws')
})
await check('each flag alone: WELCOME_TRIM leaves the star where it is, MARK_TRIM leaves the copy and the greeting where they are; both together do both', () => {
  const props = () => baseProps({ messages: [recordedGreeting], studioFirstRunActions: actionsMarker })
  setFlags({ welcome: 'true' }); const welcomeOnly = html(props()); assert.match(welcomeOnly, STAR_HEAD, 'welcome trim alone: the star stays'); assert.match(headerMarkup({ welcome: 'true' }), STAR_HEADER)
  setFlags({ mark: 'true' }); const markOnly = html(props()); assert.doesNotMatch(markOnly, STAR_HEAD)
  assert.match(markOnly, /Bring an idea/); assert.match(markOnly, /Need a starting point\?/); assert.match(markOnly, /Choose a starter/); assert.ok(sawGreeting(markOnly), 'mark trim alone: the copy and the greeting stay')
  setFlags({ welcome: 'true', mark: 'true' }); const both = html(props())
  assert.equal(both, welcomeOnly.replace(STAR_HEAD, ''), 'both: the welcome-trimmed markup minus the star'); assert.equal(both, cut(markOnly.replace(/<div data-studio-director-message="director".*?<\/div><\/div>(?=<section data-studio-first-run-starters)/s, ''), REMOVED))
  setFlags({})
})
await check('F-02 CSS: every rule of studio-director-mark-trim.css can match only flag-on markup (a header with no star span, or the <img> of the real mark); the flag-off header always has the star span', () => {
  const css = postcss.parse(read(MARK_CSS)); const selectors = []
  css.walkRules(rule => rule.selectors.forEach(selector => selectors.push(selector.trim())))
  assert.ok(selectors.length >= 4)
  for (const selector of selectors) assert.match(selector, /:not\(:has\(> \[aria-hidden="true"\]\)\)|img\[data-studio-director-mark="deckster"\]/, `can match only flag-on markup: ${selector.slice(0, 100)}`)
  for (const chatHeader of [false, true]) assert.match(headerMarkup({}, {}, loader, chatHeader), /^<header[^>]*><span aria-hidden="true">/, 'flag off: the first child of the header is the star span, so ":not(:has(> [aria-hidden]))" is false')
  const light = read('components/builder/chat/studio-director-header.css'); assert.match(light, /\[data-studio-chat-header\] > :nth-child\(n\+4\)/, 'the base counts the star as a child; the new rules count without it (n+3)')
  assert.match(read(MARK_CSS), /:nth-child\(n\+3\)/)
})

// ===== 6. scope =================================================================================================================================================
console.log('scope over the committed diff (own commits by subject across `rev-list --no-merges BASE..head`)')
const GIT_IDENT = { GIT_AUTHOR_NAME: 'gate', GIT_AUTHOR_EMAIL: 'gate@example.invalid', GIT_COMMITTER_NAME: 'gate', GIT_COMMITTER_EMAIL: 'gate@example.invalid', GIT_AUTHOR_DATE: '2026-10-30T00:00:00Z', GIT_COMMITTER_DATE: '2026-10-30T00:00:00Z' }
const plumb = (args, input) => execFileSync('git', args, { cwd: root, encoding: 'utf8', ...(input === undefined ? {} : { input }), env: { ...process.env, ...GIT_IDENT }, stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'], maxBuffer: 1 << 28, timeout: 60_000 }).trim()
/** A blob object for `text`, written from a temporary FILE (never `hash-object --stdin`: a large input through a stdin pipe once left a git child waiting forever in another proof's run): stdin ignored, a 60 s timeout, no filters. */
const blobOf = text => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wtr-blob-'))
  try { const file = path.join(dir, 'blob'); fs.writeFileSync(file, text); return plumb(['hash-object', '-w', '--no-filters', '--', file]) } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const subjectOf = c => git('log', '-1', '--format=%s', c).trim()
const parentsOf = rev => git('rev-list', '--parents', '-n', '1', rev).trim().split(/\s+/).slice(1)
const isOwnSubject = subject => WELCOME_TRIM_SUBJECTS.some(prefix => subject.startsWith(prefix))
/** This change's commits: found by SUBJECT across `rev-list --no-merges BASE..head`. A first-parent walk (`firstParentOnly`, the old query, kept for its mutant) sees nothing on the gate's merge and none of this change's commits once a change is stacked after it. */
const ownOf = (head, { firstParentOnly = false } = {}) => git('rev-list', ...(firstParentOnly ? ['--first-parent'] : []), '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean).filter(c => isOwnSubject(subjectOf(c)))
/** GATE-SAFE head of every scope query. The gate's merge has dev as its FIRST parent (it carries none of this change's commits) and this change's head as its SECOND parent: the scope runs against HEAD^2.
 *  The branch tip must be an ORDINARY commit (one parent), never itself a dev-first two-parent merge. On a branch (HEAD is this change's tip, or a merge of dev INTO it) HEAD itself is used. `gateRule: false` is the mutant that drops the rule. */
function scopeHead(ref = 'HEAD', { gateRule = true } = {}) {
  const head = git('rev-parse', `${ref}^{commit}`).trim()
  const parents = parentsOf(head)
  if (!gateRule || parents.length !== 2) return head
  return ownOf(parents[0]).length === 0 && ownOf(parents[1]).length > 0 ? parents[1] : head
}
const REAL = { norm: otherStrips, env: text => registry.stripLaterEnvBlocks('.env.example', text) }
const diffLines = text => text.split('\n').filter(line => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
const normDiff = (ctx, rel, head) => git('diff', '-U0', blobOf(ctx.norm(rel, git('show', `${BASE_COMMIT}:${rel}`))), blobOf(ctx.norm(rel, git('show', `${head}:${rel}`))))
const OLDER_PREFIXES = /^(Chat element edit|Targeted chat edit:|Targeted chat add:|Chat text set:|Text set keep look:|Structural refine decline:)/
const scopeOwnCommits = (head, opts) => {
  const own = ownOf(head, opts)
  assert.ok(own.length >= 1, 'no own commit yet')
  for (const c of own) assert.match(git('log', '-1', '--format=%B', c), /Co-Authored-By: Claude Sonnet 5\.5 <noreply@anthropic\.com>\s*$/, c.slice(0, 8))
  for (const c of git('rev-list', '--no-merges', `${BASE_COMMIT}..${head}`).split('\n').filter(Boolean)) assert.doesNotMatch(subjectOf(c), OLDER_PREFIXES, `${c.slice(0, 8)} would be taken for an older change's own commit`)
  return own
}
/** The base lines the pin puts back: the lines of the base file that contain the pinned fragment (the pin is a tail of one line, so it keeps working when a later change adds a name earlier in that line). */
const removedAllowed = (rel, baseNorm) => new Set(baseNorm.split('\n').filter(line => (WELCOME_TRIM_PIN_EDITS[rel] || []).some(([, was]) => line.includes(was.replace(/\n$/, '')))))
const scopeCommittedFiles = (head, ctx = REAL) => {
  const own = scopeOwnCommits(head)
  const touched = new Set()
  for (const c of own) for (const rel of git('show', '--name-only', '--format=', c).split('\n').filter(Boolean)) touched.add(rel)
  assert.deepEqual([...touched].sort(), [...WELCOME_TRIM_SCOPE_FILES].sort(), 'the files this change\'s own commits touch are exactly its scope')
  for (const rel of WELCOME_TRIM_FILES) {
    const diff = diffLines(normDiff(ctx, rel, head)), allowedRemoved = removedAllowed(rel, ctx.norm(rel, git('show', `${BASE_COMMIT}:${rel}`)))
    for (const line of diff) {
      if (line.startsWith('-')) assert.ok(allowedRemoved.has(line.slice(1)), `${rel}: a removed line that is not a pinned one: ${line.slice(0, 120)}`)
      else assert.match(line, WELCOME_TRIM_ANY_MARKER_RE, `${rel}: an unmarked added line: ${line.slice(0, 120)}`)
    }
    assert.ok(diff.filter(line => line.startsWith('+')).length > 0, `${rel}: the number of added lines`)
    assert.equal(diff.filter(line => line.startsWith('-')).length, (WELCOME_TRIM_PIN_EDITS[rel] || []).length, `${rel}: exactly the pinned lines are removed`)
    assert.equal(stripWelcomeTrim(rel, ctx.norm(rel, git('show', `${head}:${rel}`))), ctx.norm(rel, git('show', `${BASE_COMMIT}:${rel}`)), `${rel}: without its marked lines the file is the base's, byte for byte`)
  }
  for (const rel of WELCOME_TRIM_NEW_FILES) assert.equal(git('cat-file', '-t', `${head}:${rel}`).trim(), 'blob', rel)
  for (const rel of WELCOME_TRIM_PROOF_FILES) {
    const now = git('show', `${head}:${rel}`), dev = ctx.norm(rel, git('show', `${BASE_COMMIT}:${rel}`)), diff = diffLines(normDiff(ctx, rel, head))
    assert.equal(stripWelcomeTrim(rel, ctx.norm(rel, now)), dev, `${rel}: the proof this change taught, put back, is the base's`)
    assert.equal(ctx.norm(rel, stripWelcomeTrim(rel, now)), dev, `${rel}: in either order of the put-backs`)
    for (const line of diff.filter(line => line.startsWith('+'))) assert.match(line, /registry read \(STUDIO-WELCOME-TRIM\)/, `${rel}: an added line without the registry-read mark: ${line.slice(0, 120)}`)
    assert.ok(diff.some(line => line.startsWith('+')) && diff.length <= 8, `${rel}: a registry read of one or two lines (${diff.length} changed lines)`)
  }
  for (const rel of ['app/builder/page.tsx', 'components/builder/presentation-area.tsx', 'components/builder/studio-outline-canvas.tsx', 'components/builder/studio-first-run-actions.tsx', 'components/builder/studio-introduction.tsx', 'components/builder/studio-first-run.css',
    'components/builder/chat/studio-director-header.css', 'lib/studio-greeting-lifecycle.ts', 'lib/studio-flow-control.ts', 'hooks/use-studio-flow-control.ts', 'hooks/use-deckster-websocket-v2.ts', 'public/logo-icon-sm.png']) assert.ok(!touched.has(rel), `${rel} is not touched by this change`)
}
const scopeEnvAndRegistry = (head, ctx = REAL) => {
  const env = git('show', `${head}:.env.example`), baseEnv = git('show', `${BASE_COMMIT}:.env.example`)
  assert.equal(ctx.env(env), ctx.env(baseEnv), '.env.example is the base plus the registered blocks and nothing else')
  assert.equal(env.split(WELCOME_TRIM_ENV_BLOCK).length - 1, 1, 'this change\'s block is there exactly once, verbatim')
  assert.match(env, new RegExp(`\\n\\n${WELCOME_TRIM_ENV_BLOCK.split('\n')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), 'a blank line before the block')
  const diff = diffLines(git('diff', '-U0', `${BASE_COMMIT}..${head}`, '--', 'scripts/studio-later-changes.mjs'))
  assert.equal(diff.filter(line => line.startsWith('-')).length, 0, 'the registry loses no line')
  const mine = diff.filter(line => line.includes('studio-welcome-trim-strip.mjs'))
  assert.equal(mine.length, 3, 'the registry gains exactly this change\'s three lines'); for (const line of mine) assert.ok(line.startsWith('+') && line.includes('// LATER-CHANGE:'), line.slice(0, 140))
  assert.deepEqual(mine.map(line => /\)\.(\w+), \/\//.exec(line)?.[1]), ['WELCOME_TRIM_SCOPE_FILES', 'WELCOME_TRIM_ENV_BLOCK', 'stripWelcomeTrim'])
}
const scopeAll = (head, ctx = REAL) => { scopeOwnCommits(head); scopeCommittedFiles(head, ctx); scopeEnvAndRegistry(head, ctx) }

const HEAD = scopeHead('HEAD')
await check(`this change's own commits (subject starts "${WELCOME_TRIM_SUBJECTS.join('" or "')}", found across the whole line, no merges) exist, with the co-author line; none could be taken for an older change's`, () => { scopeOwnCommits(HEAD) })
await check('the committed files are exactly this change\'s; every line added to an existing file is a pure insertion that carries one of the two markers (the one pinned dependency-list line aside); the strip gives the base back byte for byte; the five older proofs taught a registry read put back are the base\'s', () => scopeCommittedFiles(HEAD))
await check('.env.example is the base plus the block (after one blank line); the registry gains exactly its three marked lines and loses none; no secret-shaped literal in the new files', () => {
  scopeEnvAndRegistry(HEAD)
  for (const rel of WELCOME_TRIM_NEW_FILES.filter(rel => !rel.endsWith('.json') && !rel.endsWith('.css'))) assert.doesNotMatch(fs.readFileSync(path.join(root, rel), 'utf8'), /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY)/, rel)
})
await check('every marker line is a whole-token marker line: the two markers each appear, no near-miss spelling is left in a touched file, and every marked JSX/TS line sits in the files the strip owns', () => {
  for (const rel of WELCOME_TRIM_FILES) {
    const lines = read(rel).split('\n').filter(line => /STUDIO-(WELCOME|DIRECTOR-MARK)-TRIM/.test(line))
    assert.ok(lines.length > 0 && lines.every(line => WELCOME_TRIM_ANY_MARKER_RE.test(line)), `${rel}: every line that names a marker names it as a whole token`)
  }
  assert.ok(read(MESSAGE_LIST).split('\n').some(line => WELCOME_TRIM_MARKER_RE.test(line))); assert.ok(read(HEADER).split('\n').some(line => DIRECTOR_MARK_TRIM_MARKER_RE.test(line)))
  assert.ok(!read(MESSAGE_LIST).split('\n').some(line => DIRECTOR_MARK_TRIM_MARKER_RE.test(line)), 'message-list carries only the welcome marker'); assert.ok(!read(HEADER).split('\n').some(line => WELCOME_TRIM_MARKER_RE.test(line)), 'the header carries only the mark marker')
})
const gateMerge = (dev, head) => plumb(['commit-tree', plumb(['merge-tree', '--write-tree', dev, head]).split('\n')[0], '-p', dev, '-p', head, '-m', 'gate-style merge (local, no ref)'])
const GATE = gateMerge(BASE_COMMIT, HEAD)
await check('GATE-SAFE: on a gate-style merge (first parent BASE, second parent this change\'s head) the scope head is HEAD^2 and the whole scope section passes against it; the merged tree is read too', () => {
  assert.deepEqual(parentsOf(GATE), [BASE_COMMIT, HEAD])
  assert.deepEqual(git('log', '--format=%H', '--first-parent', '--no-merges', `${BASE_COMMIT}..${GATE}`).split('\n').filter(Boolean), [], 'the gate\'s first-parent, no-merges line from BASE is empty: why HEAD itself cannot be used')
  assert.equal(scopeHead(GATE), HEAD, 'HEAD^2 is the change\'s head')
  scopeAll(scopeHead(GATE)); scopeEnvAndRegistry(GATE)
  for (const rel of WELCOME_TRIM_FILES) assert.equal(stripWelcomeTrim(rel, otherStrips(rel, git('show', `${GATE}:${rel}`))), otherStrips(rel, git('show', `${BASE_COMMIT}:${rel}`)), `the merged tree, without this change's lines, is the base's ${rel}`)
  assert.equal(scopeHead(HEAD), HEAD, 'a branch head is used as it is'); assert.equal(scopeHead(BASE_COMMIT), BASE_COMMIT, 'BASE itself is used as it is')
})
await check('mutant caught: the old first-parent own-commit query finds no own commit on the gate-style merge, and without the HEAD^2 rule the scope head is the merge itself', () => {
  const head = scopeHead(GATE, { gateRule: false })
  assert.equal(head, GATE)
  assert.throws(() => scopeOwnCommits(head, { firstParentOnly: true }), /no own commit yet/)
  assert.doesNotThrow(() => scopeOwnCommits(head), 'the subject query across the line finds them on the merge itself')
})
/** A commit (objects only, no ref) whose tree is `parent`'s with `edits` ({path: text}) applied, built through a temporary index file. */
const commitWith = (parent, edits, message) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wtr-idx-'))
  try {
    const env = { ...process.env, ...GIT_IDENT, GIT_INDEX_FILE: path.join(dir, 'index') }
    const viaIndex = (...a) => execFileSync('git', a, { cwd: root, env, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 }).trim()
    viaIndex('read-tree', parent)
    for (const [rel, text] of Object.entries(edits)) viaIndex('update-index', '--add', '--cacheinfo', `100644,${blobOf(text)},${rel}`)
    return plumb(['commit-tree', viaIndex('write-tree'), '-p', parent, '-m', message])
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const TRAILER = '\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>'
const unrelated = commitWith(BASE_COMMIT, { 'unrelated-after-base.txt': 'unrelated\n' }, 'Dev: an unrelated commit after BASE')
const ADVANCED_GATE = gateMerge(unrelated, HEAD)
await check('GATE-SAFE after dev moved on: a gate merge whose first parent is a dev commit past BASE (an unrelated commit): the scope head is still this change\'s head and the scope section passes', () => {
  assert.deepEqual(parentsOf(ADVANCED_GATE), [unrelated, HEAD]); assert.notEqual(parentsOf(ADVANCED_GATE)[0], BASE_COMMIT)
  assert.equal(scopeHead(ADVANCED_GATE), HEAD)
  scopeAll(scopeHead(ADVANCED_GATE)); scopeEnvAndRegistry(ADVANCED_GATE)
  assert.equal(ownOf(ADVANCED_GATE).length, ownOf(HEAD).length, 'the same own commits are found on the merge')
})
// a SYNTHETIC change stacked after this one: marked lines in the welcome, the header and the list (next to this change's own), a registry trio below this change's, an .env.example block, a new file
const SYN = { marker: 'SYNTHETIC-LATER', file: 'scripts/studio-synthetic-later-strip.mjs', block: '# SYNTHETIC LATER (a made-up change stacked after this one)\nNEXT_PUBLIC_SYNTHETIC_LATER="false"\n' }
const syntheticStrip = (rel, text) => WELCOME_TRIM_FILES.includes(rel) && typeof text === 'string' ? text.split('\n').filter(line => !line.includes(SYN.marker)).join('\n') : text
const syntheticCommit = parent => {
  const at = rel => git('show', `${parent}:${rel}`)
  const edits = {}
  for (const rel of WELCOME_TRIM_FILES) {
    const lines = at(rel).split('\n'); let done = false
    edits[rel] = lines.flatMap(line => { if (!done && WELCOME_TRIM_ANY_MARKER_RE.test(line) && line.startsWith('import ')) { done = true; return [line, `const syntheticLater = 1 // ${SYN.marker}`] } return [line] }).join('\n')
    if (!done) edits[rel] = lines.flatMap(line => { if (!done && /^\s*const welcomeTrim|^\s*const markTrim|^\s*const trimGreetingsRef/.test(line)) { done = true; return [line, `  const syntheticLater = 1 // ${SYN.marker}`] } return [line] }).join('\n')
    assert.ok(edits[rel].includes(SYN.marker), `the synthetic anchor exists in ${rel}`)
  }
  edits['scripts/studio-later-changes.mjs'] = at('scripts/studio-later-changes.mjs').split('\n').flatMap(line => {
    if (line.includes('WELCOME_TRIM_SCOPE_FILES')) return [line, "  ...(await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_SCOPE_FILES, // LATER-CHANGE: synthetic, stacked after this one"]
    if (line.includes('WELCOME_TRIM_ENV_BLOCK')) return [line, "  (await import('./studio-synthetic-later-strip.mjs')).SYNTHETIC_ENV_BLOCK, // LATER-CHANGE: synthetic, stacked after this one"]
    if (line.includes(').stripWelcomeTrim')) return [line, "  (await import('./studio-synthetic-later-strip.mjs')).stripSynthetic, // LATER-CHANGE: synthetic, stacked after this one"]
    return [line]
  }).join('\n')
  edits['.env.example'] = `${at('.env.example')}\n${SYN.block}`
  edits[SYN.file] = 'export const SYNTHETIC_SCOPE_FILES = new Set()\n'
  return commitWith(parent, edits, `Synthetic later: a change stacked after this one${TRAILER}`)
}
const SYNTHETIC = syntheticCommit(HEAD)
const SYN_CTX = {
  norm: (rel, text) => syntheticStrip(rel, otherStrips(rel, text)),
  env: text => registry.stripLaterEnvBlocks('.env.example', text).replace(`\n${SYN.block}`, ''),
}
await check('ROBUST AFTER MERGE: a synthetic change stacked after this one (its marked lines beside this change\'s in the three files, a registry trio, an .env.example block, a new file; its own commit has another subject) leaves this change\'s scope section passing, on the branch, on the gate\'s merge and on a merge onto an advanced dev', () => {
  assert.ok(ownOf(SYNTHETIC).length === ownOf(HEAD).length && !ownOf(SYNTHETIC).includes(SYNTHETIC), 'the later commit is not this change\'s')
  assert.equal(scopeHead(SYNTHETIC), SYNTHETIC)
  scopeAll(SYNTHETIC, SYN_CTX)
  const gate = gateMerge(BASE_COMMIT, SYNTHETIC)
  assert.equal(scopeHead(gate), SYNTHETIC); scopeAll(scopeHead(gate), SYN_CTX); scopeEnvAndRegistry(gate, SYN_CTX)
  for (const rel of WELCOME_TRIM_FILES) assert.equal(stripWelcomeTrim(rel, SYN_CTX.norm(rel, git('show', `${gate}:${rel}`))), SYN_CTX.norm(rel, git('show', `${BASE_COMMIT}:${rel}`)), `the merged tree is the base's ${rel} without this change's and the later change's lines`)
  const advanced = gateMerge(unrelated, SYNTHETIC)
  assert.equal(scopeHead(advanced), SYNTHETIC); scopeAll(scopeHead(advanced), SYN_CTX)
  // the registry reads past it: through stripLaterChanges the older pins see the base, with the later change's lines in the file too
  for (const rel of WELCOME_TRIM_FILES) assert.equal(stripWelcomeTrim(rel, syntheticStrip(rel, git('show', `${SYNTHETIC}:${rel}`))), baseText(rel), `${rel}: either order of the two strips gives the base`)
})
await check('mutant caught: the same synthetic later change fails a scope that is not told about it (its lines are unmarked additions, its registry lines extra)', () => {
  assert.throws(() => scopeCommittedFiles(SYNTHETIC), /unmarked added line|exactly its scope/)
  assert.throws(() => scopeEnvAndRegistry(SYNTHETIC), /gains exactly|base plus the registered blocks/)
})
await check('mutant caught: a stray foreign file in a "Welcome trim:" commit fails the committed-files check (own commits found by subject, the diff names the file)', () => {
  const stray = commitWith(HEAD, { 'stray-welcome-trim.txt': 'stray\n' }, `${WELCOME_TRIM_SUBJECTS[0]} a stray file${TRAILER}`)
  assert.ok(ownOf(stray).includes(stray), 'the stray commit is found by its subject')
  assert.doesNotThrow(() => scopeCommittedFiles(HEAD), 'the real head passes')
  assert.throws(() => scopeCommittedFiles(stray), /exactly its scope/, 'the committed-files check must fail on a stray file')
})
await check('mutant caught: an own commit without the co-author line, an unmarked line added to the list or the header in an own commit, and a touched foreign file, fail the scope', () => {
  const noTrailer = commitWith(HEAD, {}, `${WELCOME_TRIM_SUBJECTS[1]} no trailer`)
  assert.throws(() => scopeOwnCommits(noTrailer), error => /^[0-9a-f]{8}$/.test(error.message), 'the commit without the trailer is named')
  for (const rel of [MESSAGE_LIST, HEADER]) {
    const sneaky = commitWith(HEAD, { [rel]: git('show', `${HEAD}:${rel}`).replace('\nexport ', '\nconst sneaky = 1\nexport ') }, `${WELCOME_TRIM_SUBJECTS[0]} a sneaky line${TRAILER}`)
    assert.throws(() => scopeCommittedFiles(sneaky), /unmarked added line/, rel)
  }
  const hook = commitWith(HEAD, { 'hooks/use-deckster-websocket-v2.ts': git('show', `${HEAD}:hooks/use-deckster-websocket-v2.ts`) + '\n' }, `${WELCOME_TRIM_SUBJECTS[0]} touches the hook${TRAILER}`)
  assert.throws(() => scopeCommittedFiles(hook), /exactly its scope|is not touched/)
  const pageLine = commitWith(HEAD, { 'components/builder/studio-first-run-actions.tsx': git('show', `${HEAD}:components/builder/studio-first-run-actions.tsx`) + '\n' }, `${WELCOME_TRIM_SUBJECTS[1]} touches the stage actions${TRAILER}`)
  assert.throws(() => scopeCommittedFiles(pageLine), /exactly its scope|is not touched/)
})

// ===== 7. mutants (each one edit of the real sources, fed to the same checks) =============================================================================
if (!process.env.CHECK_ONLY) console.log('mutants')
const trimSrc = read(TRIM_LIB), markSrc = read(MARK_LIB), listSrc = read(MESSAGE_LIST), welcomeSrc = read(WELCOME), headerSrc = read(HEADER), cssSrc = read(MARK_CSS)
const mutantRun = (overrides, flags, scenario) => { const api = createLoader(overrides); setFlags(flags); try { return scenario(api) } finally { setFlags({}) } }
/** the pop-back scenario: new session greeting, then the first user message, then a reply; the greeting must be absent from every frame */
const popBack = api => { const m = mount(api); const frames = [greetingProps(), withUser(greetingProps()), withUser(greetingProps({ messages: [recordedGreeting, recordedReply] }))]; for (const props of frames) assert.ok(!sawGreeting(markupOf(m.render(props))), 'greeting hidden in every frame') }
const laterShows = api => { const m = mount(api); const resent = { ...recordedGreeting, message_id: 'msg_resent', timestamp: iso(400) }; m.render(greetingProps()); m.render(withUser(greetingProps())); assert.equal(count(markupOf(m.render(withUser(greetingProps({ messages: [recordedGreeting, recordedReply, resent] })))), /presentation assistant/g), 1) }
const restoredShows = api => { const m = mount(api); for (let i = 0; i < 2; i++) assert.ok(sawGreeting(markupOf(m.render(withUser(greetingProps({ messages: [recordedGreeting, recordedReply] })))))) }
const restoringFlip = api => { const m = mount(api), props = greetingProps({ studioRestoring: true }); m.render(props); assert.ok(!sawGreeting(markupOf(m.render({ ...props, studioRestoring: false })))) }
const markNone = api => { const out = markupOf(React.createElement(api.load(HEADER).StudioDirectorHeader, { connectionState: 'connected' })); assert.ok(!/<span aria-hidden/.test(out) && !/Sparkles/.test(out), 'the header draws no star'); assert.ok(!STAR_HEAD.test(html(baseProps(), api)), 'the welcome draws no star') }
const idleCopy = api => { const out = html(baseProps({ studioFirstRunActions: actionsMarker }), api); assert.ok(!/Bring an idea|Need a starting point|Choose a starter/.test(out)) }
await check('proof self-test: the unmutated sources pass every mutant scenario', () => {
  const pass = [[{}, { welcome: 'true' }, [popBack, laterShows, restoredShows, restoringFlip, idleCopy]], [{}, { mark: 'true' }, [markNone]]]
  for (const [overrides, flags, scenarios] of pass) for (const scenario of scenarios) mutantRun(overrides, flags, scenario)
})
await mutant('the latch forgets: the greeting is hidden only while the conversation is empty (pops back above the first message)', () => mutantRun({ [TRIM_LIB]: swap(trimSrc, 'for (const id of previous) if (present.has(id)) next.add(id)', '') }, { welcome: 'true' }, popBack))
await mutant('any exact-text greeting is hidden, whenever it arrives (a later genuine message disappears)', () => mutantRun({ [TRIM_LIB]: swap(trimSrc, 'if (emptyNewSession) for (const message of messages)', 'for (const message of messages)') }, { welcome: 'true' }, laterShows))
await mutant('any exact-text greeting is hidden, whenever it arrives (a restored history loses its greeting)', () => mutantRun({ [TRIM_LIB]: swap(trimSrc, 'if (emptyNewSession) for (const message of messages)', 'for (const message of messages)') }, { welcome: 'true' }, restoredShows))
await mutant('the list ignores a restoring session: hides on the empty answer without the open-deck and restoring guards (an open deck loses its greeting)', () => mutantRun({ [MESSAGE_LIST]: swap(listSrc, 'isEmptyStudioConversation && !presentationContext)', 'userMessages.length === 0)') }, { welcome: 'true' }, api => { assert.ok(sawGreeting(html(MATRIX['greeting-with-deck-context'](), api))) }))
await mutant('the transcript memo does not depend on the hidden ids (the flip from restoring to new leaves a stale list)', () => mutantRun({ [MESSAGE_LIST]: swap(listSrc, 'studioGreetingSafety, trimmedGreetingIds]); // STUDIO-WELCOME-TRIM', 'studioGreetingSafety]); // STUDIO-WELCOME-TRIM') }, { welcome: 'true' }, restoringFlip))
await mutant('the greeting is hidden without an assistant role check (a role-less echo is swept up)', () => mutantRun({ [TRIM_LIB]: swap(trimSrc, "message.role !== 'assistant' || ", '') }, { welcome: 'true' }, api => { assert.ok(!trimLib.isOpeningGreeting({ ...recordedGreeting, role: undefined })); const lib = api.load(TRIM_LIB); assert.ok(!lib.isOpeningGreeting({ ...recordedGreeting, role: undefined })) }))
await mutant('the busy notice is trimmed too (the idle and the busy hint both go)', () => mutantRun({ [WELCOME]: swap(welcomeSrc, '{welcomeTrim && !busy ? null : ( // STUDIO-WELCOME-TRIM', '{welcomeTrim ? null : ( // STUDIO-WELCOME-TRIM') }, { welcome: 'true' }, api => assert.match(html(baseProps({ messages: [recordedGreeting], isGeneratingFinal: true }), api), /Director is working/)))
await mutant('the intro line is not removed', () => mutantRun({ [WELCOME]: swap(welcomeSrc, '{welcomeTrim ? null : ( // STUDIO-WELCOME-TRIM\n      <p data-studio-director-welcome-part="intro">', '{false ? null : ( // STUDIO-WELCOME-TRIM\n      <p data-studio-director-welcome-part="intro">') }, { welcome: 'true' }, idleCopy))
await mutant('the caption is not removed', () => mutantRun({ [WELCOME]: swap(welcomeSrc, '{welcomeTrim ? null : ( // STUDIO-WELCOME-TRIM\n          <p data-studio-director-welcome-part="caption">', '{false ? null : ( // STUDIO-WELCOME-TRIM\n          <p data-studio-director-welcome-part="caption">') }, { welcome: 'true' }, idleCopy))
await mutant('the trim flag is read as truthy, not exactly "true"', () => { const api = createLoader({ [TRIM_LIB]: swap(trimSrc, "=== 'true'", '!== undefined') }); setFlags({ welcome: 'false' }); try { assert.equal(api.load(TRIM_LIB).studioWelcomeTrimOn(), false) } finally { setFlags({}) } })
await mutant('the mark flag is read as truthy, not exactly "true"', () => { const api = createLoader({ [MARK_LIB]: swap(markSrc, "=== 'true'", '!== undefined') }); setFlags({ mark: 'false' }); try { assert.equal(api.load(MARK_LIB).studioDirectorMark(), null) } finally { setFlags({}) } })
await mutant('the header still draws the star with the flag on', () => mutantRun({ [HEADER]: swap(headerSrc, 'markTrim.src && <span aria-hidden="true">', 'markTrim.src ?? <span aria-hidden="true"><svg data-icon="Sparkles" width="13"></svg></span> && <span aria-hidden="true">') }, { mark: 'true' }, markNone))
await mutant('the welcome still draws the star with the flag on', () => mutantRun({ [WELCOME]: swap(welcomeSrc, '{markTrim ? ( // STUDIO-DIRECTOR-MARK-TRIM', '{false ? ( // STUDIO-DIRECTOR-MARK-TRIM') }, { mark: 'true' }, markNone))
await mutant('flag off is not the base: the head drops its star even with the mark flag off', () => { const api = createLoader({ [WELCOME]: swap(welcomeSrc, '{markTrim ? ( // STUDIO-DIRECTOR-MARK-TRIM', '{true ? ( // STUDIO-DIRECTOR-MARK-TRIM') }); setFlags({}); try { assert.equal(hashOf(MATRIX['empty'](), api), hashOf(MATRIX['empty'](), baseLoader)) } finally { setFlags({}) } })
await mutant('flag off is not the base: the greeting is hidden with the trim flag off', () => { const api = createLoader({ [MESSAGE_LIST]: swap(listSrc, 'firstRunV2 && studioWelcomeTrimOn() ?', 'firstRunV2 ?') }); setFlags({}); try { assert.equal(hashOf(MATRIX['greeting-only (recorded)'](), api), hashOf(MATRIX['greeting-only (recorded)'](), baseLoader)) } finally { setFlags({}) } })
await mutant('the deckster constant does not reach the header', () => { const api = withMarkLoader('deckster'); const off = headerMarkup({}, {}, api), on = headerMarkup({ mark: 'true' }, {}, api); assert.equal(on, off.replace(STAR_HEADER, `<span aria-hidden="true">${deckster(13)}</span>`)); const broken = createLoader({ [MARK_LIB]: swap(read(MARK_LIB), "STUDIO_DIRECTOR_MARK: 'none' | 'deckster' = 'none'", "STUDIO_DIRECTOR_MARK: 'none' | 'deckster' = 'deckster'").replace("mark === 'deckster' ? STUDIO_DIRECTOR_MARK_SRC : null", 'null') }); assert.equal(headerMarkup({ mark: 'true' }, {}, broken), off.replace(STAR_HEADER, `<span aria-hidden="true">${deckster(13)}</span>`)) })
await mutant('a CSS rule that does not need the flag-on markup (the star-less selector without its :not(:has) guard)', () => { const css = postcss.parse(swap(cssSrc, '[data-studio-chat-header]:not(:has(> [aria-hidden="true"])) { grid-template-columns', '[data-studio-chat-header] { grid-template-columns')); const selectors = []; css.walkRules(rule => rule.selectors.forEach(s => selectors.push(s.trim()))); for (const s of selectors) assert.match(s, /:not\(:has\(> \[aria-hidden="true"\]\)\)|img\[data-studio-director-mark="deckster"\]/) })
await mutant('a marker line is mistyped (the strip would leave it behind)', () => { const typo = welcomeSrc.replace('// STUDIO-WELCOME-TRIM: the "Bring an idea..." line is not drawn', '// STUDIO-WELCOME-TRIMM: the "Bring an idea..." line is not drawn'); assert.notEqual(typo, welcomeSrc); assert.equal(stripWelcomeTrim(WELCOME, typo), baseText(WELCOME)) })
await mutant('a taught proof is not put back (the strip leaves its registry read in)', () => { const rel = WELCOME_TRIM_PROOF_FILES[0]; assert.equal(stripWelcomeTrim(rel, read(rel).replace(' // LATER-CHANGES: registry read (STUDIO-WELCOME-TRIM)\n', ' // LATER-CHANGES: registry read (STUDIO-WELCOME-TRIMMED)\n')), baseText(rel)) })
await mutant('the pin is not put back (the dependency-list line keeps the new name after the strip)', () => assert.equal(stripWelcomeTrim(MESSAGE_LIST, listSrc.replace('studioGreetingSafety, trimmedGreetingIds]); // STUDIO-WELCOME-TRIM', 'studioGreetingSafety, trimmedGreetingIds]); // STUDIO-WELCOME-TRIM-X')), baseText(MESSAGE_LIST)))

console.log(`\n${passed} passed, ${failed.length} failed; mutants: ${caught} caught, ${missed.length} missed`)
if (failed.length || missed.length) { if (failed.length) console.error(`failed: ${failed.join('; ')}`); if (missed.length) console.error(`missed: ${missed.join('; ')}`); process.exit(1) }
