// PASS2 #2 (frontend-2): the Studio Builder's first-run home, closer to the accepted v4 mockup.
// Flag NEXT_PUBLIC_STUDIO_FIRST_RUN_V2 (exact "true", Studio shell only), default off. Flag off must render exactly as the base did.
//
// Run: node scripts/test-studio-first-run-v2.mjs   (plain node: transpile + vm, no network, no React runtime beyond react-dom/server)
//   FIRST_RUN_V2_ROOT=<pristine base checkout> PRINT_GOLDEN=1 node scripts/test-studio-first-run-v2.mjs
//     re-prints the flag-off hashes below from the base sources.
//
// J2 pass-2 P1 (fix-forward, same flag): an existing session that is still restoring is never drawn as a first run (sections 5 and 6).
//
// The proof runs on the REAL sources: components/builder/message-list.tsx and components/builder/chat/studio-welcome.tsx (and the
// libs they use) are transpiled and evaluated in a vm. Everything the page owns (stage, composer, handlers) is out of scope here by
// design: the change is MessageList choosing a different welcome, plus CSS keyed to markup that exists only with the flag on.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import ReactMarkdown from 'react-markdown'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import postcss from 'postcss'

const treeRoot = process.env.FIRST_RUN_V2_ROOT
  ? path.resolve(process.env.FIRST_RUN_V2_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = file => fs.readFileSync(path.join(treeRoot, file), 'utf8')
const FLAG = 'NEXT_PUBLIC_STUDIO_FIRST_RUN_V2'
const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const refuse = () => { throw new Error('first-run fixture refuses services, timers and writes') }

// ---- module loader: transpile repo files and run them in a vm --------------------------------------------------------------
const env = {}
const stubs = {
  react: { ...React, useMemo: callback => callback(), useState: init => [typeof init === 'function' ? init() : init, () => {}], useRef: current => ({ current }), useEffect() {} },
  'react/jsx-runtime': jsxRuntime, 'react-markdown': ReactMarkdown,
  'lucide-react': new Proxy({}, { get: (_, name) => name === '__esModule' ? false : (props => React.createElement('svg', { 'data-icon': String(name), width: props?.size })) }),
  '@/components/ui/button': { Button: 'button' }, '@/components/ui/badge': { Badge: 'span' }, '@/components/file-chip': { FileChip: 'FileChip' },
  '@/lib/debug-log': { debugLog() {} }, '@/lib/slide-compose-async': { hasLiveTrackedEphemeralMessage: refuse },
  '@/lib/layout-service-client': { LAYOUT_VIEWER_URL_POLICY: {} }, '@/lib/layout-viewer-url-policy': { evaluateLayoutViewerUrl: refuse },
  '@/lib/mdc-flags': { CHAT_CLARITY: false, CHAT_QUESTIONS: false }, '@/lib/build-narration-heuristics': { shouldRerouteEphemeral: value => Boolean(value) },
  '@/components/builder/chat/question-card': { QuestionCard: 'QuestionCard' }, '@/components/builder/chat/studio-outline-card': { StudioOutlineCard: 'StudioOutlineCard' },
  './studio-director.css': {},
}
const transpiled = new Map()
function createLoader(sourceOverrides = {}) {
  const cache = new Map()
  const overridden = new Map()
  const resolve = (spec, from) => {
    const base = spec.startsWith('@/') ? path.join(treeRoot, spec.slice(2)) : path.resolve(path.dirname(from), spec)
    for (const suffix of ['.ts', '.tsx']) if (fs.existsSync(base + suffix)) return base + suffix
    return null
  }
  const requireFor = (spec, from) => {
    if (spec in stubs) return stubs[spec]
    if (spec.endsWith('.css')) return {}
    if (spec.startsWith('@/') || spec.startsWith('.')) {
      const file = resolve(spec, from)
      assert.ok(file, `unresolved import ${spec} in ${path.relative(treeRoot, from)}`)
      return run(file)
    }
    throw new Error(`unexpected import ${spec} in ${path.relative(treeRoot, from)}`)
  }
  function run(file) {
    if (cache.has(file)) return cache.get(file)
    const mod = { exports: {} }
    cache.set(file, mod.exports)
    const compile = text => ts.transpileModule(text, { fileName: file, reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    const rel = path.relative(treeRoot, file)
    // A mutated copy of a source (mutation checks only) is compiled into this loader's own cache, never the shared one.
    if (rel in sourceOverrides) overridden.set(file, compile(sourceOverrides[rel]))
    else if (!transpiled.has(file)) transpiled.set(file, compile(fs.readFileSync(file, 'utf8')))
    vm.runInNewContext(overridden.get(file) ?? transpiled.get(file), { module: mod, exports: mod.exports, process: { env }, console, fetch: refuse, setTimeout: refuse, clearTimeout: refuse, require: spec => requireFor(spec, file) })
    cache.set(file, mod.exports)
    return mod.exports
  }
  return { load: rel => run(path.join(treeRoot, rel)) }
}
const loader = createLoader()
const { MessageList } = loader.load('components/builder/message-list.tsx')
const welcomeModule = loader.load('components/builder/chat/studio-welcome.tsx')
const { DIRECTOR_522_INITIAL_GREETING } = loader.load('lib/studio-greeting-lifecycle.ts')
const setFlags = ({ shell = 'true', flag } = {}) => {
  for (const key of [SHELL, FLAG]) delete env[key]
  if (shell !== undefined) env[SHELL] = shell
  if (flag !== undefined) env[FLAG] = flag
}

// ---- fixtures ---------------------------------------------------------------------------------------------------------------
const SESSION = 'synthetic-first-run-session'
const T0 = '2026-10-12T09:00:00Z'
const blank = { message_id: 'blank-1', session_id: SESSION, timestamp: T0, type: 'slide_update', payload: { operation: 'full_update', is_blank: true, metadata: { main_title: 'Untitled Presentation' }, slides: [] } }
const greeting = { message_id: 'greet-1', session_id: SESSION, timestamp: T0, type: 'chat_message', payload: { text: DIRECTOR_522_INITIAL_GREETING, sub_title: null, list_items: null, format: 'markdown', ephemeral: false } }
const greetingAgain = { ...greeting, message_id: 'greet-2' }
const directorReply = { message_id: 'reply-1', session_id: SESSION, timestamp: T0, type: 'chat_message', payload: { text: 'Who is this for?' } }
const userTurn = { id: 'user-1', text: 'A pitch for the Q3 review', timestamp: Date.parse(T0) }
const baseProps = (over = {}) => ({
  sessionId: SESSION, userMessages: [], messages: [], userMessageIdsRef: { current: new Set() }, userMessageContentMapRef: { current: new Map() },
  hasSeenWelcomeRef: { current: false }, answeredActionsRef: { current: new Set() }, messagesEndRef: { current: null }, onActionClick: refuse,
  onDraftPrompt: () => {}, ...over,
})
const actionsMarker = React.createElement('div', { 'data-fixture-actions': 'true' }, 'stage actions')
const MATRIX = {
  'empty': () => baseProps(),
  'blank-update-only': () => baseProps({ messages: [blank] }),
  'blank-update-then-greeting': () => baseProps({ messages: [blank, greeting] }),
  'greeting-only': () => baseProps({ messages: [greeting] }),
  'two-greetings': () => baseProps({ messages: [greeting, greetingAgain] }),
  'greeting-and-user': () => baseProps({ messages: [greeting], userMessages: [userTurn], userMessageIdsRef: { current: new Set([userTurn.id]) } }),
  'director-reply-only': () => baseProps({ messages: [directorReply] }),
  'greeting-then-reply': () => baseProps({ messages: [greeting, directorReply] }),
  'empty-with-deck-context': () => baseProps({ presentationContext: { title: 'Quarterly review', slideCount: 7 } }),
  'greeting-with-deck-context': () => baseProps({ messages: [greeting], presentationContext: { title: 'Quarterly review', slideCount: 7 } }),
  'empty-busy': () => baseProps({ currentStatus: { status: 'thinking', text: 'Thinking' } }),
  'greeting-busy': () => baseProps({ messages: [greeting], isGeneratingFinal: true }),
  'greeting-with-actions-node': () => baseProps({ messages: [greeting], studioFirstRunActions: actionsMarker }),
  'empty-no-draft-handler': () => baseProps({ onDraftPrompt: undefined }),
}

// ---- serialisation: element tree, our own components expanded, everything else left as a named leaf -------------------------------
const OWN = new Set(['StudioWelcome', 'StudioFirstRunStarters', 'StudioFirstRunHead'])
const ser = value => JSON.stringify(value, (key, item) => typeof item === 'function' ? `[fn ${item.name || ''}]` : item === undefined ? '__undefined__' : item)
// React renders no output for true / false / null / undefined children, so an element tree is compared without them: the proof is
// that the elements React would turn into DOM are the same, and (below) that their static markup is the same too.
const rendersNothing = child => child === false || child === true || child === null || child === undefined
function expand(node) {
  if (Array.isArray(node)) return node.filter(child => !rendersNothing(child)).map(expand)
  if (!node || typeof node !== 'object') return node
  if (typeof node.type === 'function' && OWN.has(node.type.name)) return expand(node.type(node.props))
  const props = {}
  for (const [key, value] of Object.entries(node.props ?? {})) props[key] = key === 'children' ? expand(value) : value
  return { type: typeof node.type === 'function' ? `[component ${node.type.name}]` : typeof node.type === 'symbol' ? 'Fragment' : node.type, props, key: node.key }
}
const treeOf = props => MessageList(props)
const hashOfWith = (List, props) => { const tree = List(props); return sha(ser(expand(tree)) + '\n' + renderToStaticMarkup(tree)) }
const hashOf = props => { const tree = treeOf(props); return sha(ser(expand(tree)) + '\n' + renderToStaticMarkup(tree)) }
const hashes = flag => {
  setFlags({ flag })
  return Object.fromEntries(Object.entries(MATRIX).map(([name, make]) => [name, hashOf(make())]))
}

// Flag-off hashes of the BASE sources (studio-v4-dev-preparation-code 68e3396), computed over the matrix above.
const GOLDEN = {
  'empty': '0ad2481c2acc19ea2752b0aedd0dcaac60a50ee0213bf9976bcdd8c4a75bd41a',
  'blank-update-only': '697d1dcc58ba56ff5f4b724a8c66aa36863570c937ee18a5d2a89bff7beb1a9c',
  'blank-update-then-greeting': '0f8542f4debd28b7d25defd337ea626af107febea2c097bb6fa12296e7fbff40',
  'greeting-only': '4239f8b8c1714460853506758b24f9488141cbe463b53d7d1d83c102ac1addd8',
  'two-greetings': 'efe4e83ffe1ccb56ce72dd2222ebf96969cdc75350d5392e597f215d4686f17a',
  'greeting-and-user': '617bb68906925f7bf72b7cede759fd2ba7ee4e7be36866a90e2dd026bb08d308',
  'director-reply-only': '56521714b8e6c65f2da42126aa97a3154aa4ffdd961b791b8f4a4c1ebe9dc6c8',
  'greeting-then-reply': '17ed5924c8b1dec26a19dc0e549a83fb38d0af2b887e072761ced32290c8a83a',
  'empty-with-deck-context': '0a512fc5942abfe28fea359b213f82b22646c57ee58ef7967a51992a0b3645e4',
  'greeting-with-deck-context': '4239f8b8c1714460853506758b24f9488141cbe463b53d7d1d83c102ac1addd8',
  'empty-busy': '2e3217c64085d6ed423689bb53247dd299406eb5d2ad0b8499409993476b88fb',
  'greeting-busy': '2cc4fa4c119384aa995bfb5ddd56290d5cda7ff5da2df35ab6e301a4ede7cd4c',
  'greeting-with-actions-node': '4239f8b8c1714460853506758b24f9488141cbe463b53d7d1d83c102ac1addd8',
  'empty-no-draft-handler': '28314b6f7841977db57ab9956948982e29fc6da72ffa447191b495a33fc851d8',
}
if (process.env.PRINT_GOLDEN === '1') {
  console.log(JSON.stringify(hashes(undefined), null, 2))
  process.exit(0)
}

const html = props => renderToStaticMarkup(treeOf(props))
const flat = node => Array.isArray(node) ? node.flatMap(flat) : !node || typeof node !== 'object' ? [] : [node, ...flat(node.props?.children)]
const text = node => Array.isArray(node) ? node.map(text).join('') : node == null || typeof node === 'boolean' ? '' : typeof node === 'object' ? text(node.props?.children) : String(node)

// ---- 1. flag off: exactly the base --------------------------------------------------------------------------------------------
setFlags({ flag: undefined })
assert.match(ser(expand(treeOf(MATRIX['empty']()))), /What are we making\?/, 'the hashed tree holds the brief welcome')
assert.match(ser(expand(treeOf(MATRIX['greeting-only']()))), /presentation assistant/, 'the hashed tree holds the greeting bubble')
for (const value of [undefined, 'false', 'TRUE', '1', 'true ', '']) {
  const got = hashes(value)
  for (const name of Object.keys(MATRIX)) assert.equal(got[name], GOLDEN[name], `flag ${JSON.stringify(value)}: "${name}" renders exactly as the base`)
}
{
  // The flag is read only with the Studio shell, and only as the exact string "true".
  const shellOff = (() => { setFlags({ shell: 'false', flag: 'true' }); return Object.fromEntries(Object.entries(MATRIX).map(([n, m]) => [n, hashOf(m())])) })()
  const shellOffBase = (() => { setFlags({ shell: 'false' }); return Object.fromEntries(Object.entries(MATRIX).map(([n, m]) => [n, hashOf(m())])) })()
  assert.deepEqual(shellOff, shellOffBase, 'outside the Studio shell the flag changes nothing')
}

// ---- 2. flag on: what the first-run welcome is --------------------------------------------------------------------------------
setFlags({ flag: 'true' })
const firstRunCases = ['empty', 'blank-update-only', 'blank-update-then-greeting', 'greeting-only', 'two-greetings', 'empty-busy', 'greeting-busy', 'greeting-with-actions-node', 'empty-no-draft-handler']
const notFirstRun = ['greeting-and-user', 'director-reply-only', 'greeting-then-reply', 'empty-with-deck-context', 'greeting-with-deck-context']
for (const name of firstRunCases) {
  const markup = html(MATRIX[name]())
  assert.match(markup, /data-studio-director-welcome="true"/, `${name}: the welcome is shown`)
  assert.match(markup, /data-studio-first-run="true"/, `${name}: it is the first-run welcome`)
  assert.match(markup, /<h2>What story are we telling today\?<\/h2>/, `${name}: the heading`)
  assert.doesNotMatch(markup, /What are we making\?/, `${name}: the old heading is gone`)
  assert.doesNotMatch(markup, /data-studio-director-welcome-part="brief"/, `${name}: the Topic / Audience / Outcome scaffold is gone`)
  assert.match(markup, /Bring an idea, who it(’|&#x27;|')s for, and what you want them to take away\./, `${name}: one line of guidance`)
}
for (const name of notFirstRun) {
  const markup = html(MATRIX[name]())
  assert.doesNotMatch(markup, /data-studio-first-run/, `${name}: a real conversation or an open deck is not a first run`)
}
{
  // The greeting stays Director's own bubble, between the head and the starters.
  const markup = html(MATRIX['greeting-only']())
  const head = markup.indexOf('data-studio-first-run="true"'), bubble = markup.indexOf('Hello! I'), starters = markup.indexOf('data-studio-first-run-starters')
  assert.ok(head >= 0 && head < bubble && bubble < starters, 'order: heading, Director greeting, starters')
  assert.equal((markup.match(/data-studio-director-message="director"/g) || []).length, 1, 'the greeting is rendered once, by the existing path')
  // Without a greeting yet the starters are still there, right under the head.
  const early = html(MATRIX['empty']())
  assert.match(early, /data-studio-first-run-starters="true"/)
  assert.doesNotMatch(early, /data-studio-director-message/)
}
{
  // Starters: the same three, the same drafts, the same busy rule as the existing welcome (same strings, same handler).
  const drafted = [], draftedBefore = []
  const onDraftPrompt = value => drafted.push(value)
  setFlags({ flag: undefined })
  const baseStarters = flat(expand(treeOf(baseProps({ onDraftPrompt: value => draftedBefore.push(value) })))).filter(node => node.props?.['data-studio-director-starter'])
  setFlags({ flag: 'true' })
  const nowStarters = flat(expand(treeOf(baseProps({ onDraftPrompt, messages: [greeting] })))).filter(node => node.props?.['data-studio-director-starter'])
  assert.equal(nowStarters.length, 3)
  assert.deepEqual(nowStarters.map(node => node.props['data-studio-director-starter']), baseStarters.map(node => node.props['data-studio-director-starter']))
  assert.deepEqual(nowStarters.map(node => node.props['aria-label']), baseStarters.map(node => node.props['aria-label']))
  assert.deepEqual(nowStarters.map(node => text(node)), baseStarters.map(node => text(node)))
  nowStarters.forEach(node => node.props.onClick()); baseStarters.forEach(node => node.props.onClick())
  assert.equal(drafted.length, 3); assert.deepEqual(drafted, draftedBefore, 'each starter asks for the same editable draft')
  // Busy: disabled and inert, as before.
  const busyStarters = flat(expand(treeOf(baseProps({ onDraftPrompt, messages: [greeting], isGeneratingFinal: true })))).filter(node => node.props?.['data-studio-director-starter'])
  assert.ok(busyStarters.every(node => node.props.disabled === true))
  drafted.length = 0; busyStarters.forEach(node => node.props.onClick()); assert.equal(drafted.length, 0, 'a busy Director takes no starter')
  // No draft handler, no starters (as before).
  assert.doesNotMatch(html(MATRIX['empty-no-draft-handler']()), /data-studio-director-starter/)
}
{
  // The stage's quiet actions arrive as the page's node, under the starters, and only in the first-run welcome.
  const withActions = html(MATRIX['greeting-with-actions-node']())
  assert.ok(withActions.indexOf('data-studio-director-starter') < withActions.indexOf('data-fixture-actions'), 'actions sit under the starters')
  assert.doesNotMatch(html(baseProps({ messages: [greeting, directorReply], studioFirstRunActions: actionsMarker })), /data-fixture-actions/, 'gone with the first message')
}
{
  // Any Director message but its standard greeting, or a user turn, ends the first run (the transcript is then the existing one).
  const other = html(baseProps({ messages: [{ ...greeting, payload: { ...greeting.payload, text: DIRECTOR_522_INITIAL_GREETING + ' ' } }] }))
  assert.doesNotMatch(other, /data-studio-first-run/, 'only Director\'s exact opening greeting counts')
  const echoed = html(baseProps({ messages: [greeting], userMessageIdsRef: { current: new Set([greeting.message_id]) } }))
  assert.doesNotMatch(echoed, /data-studio-first-run="true"/, 'a message the person sent is never Director\'s greeting')
}

// ---- 3. the CSS can match nothing unless the flag-on markup is present ---------------------------------------------------------
{
  const css = postcss.parse(read('components/builder/studio-first-run.css'))
  const rules = []
  css.walkRules(rule => rules.push(rule.selector))
  assert.ok(rules.length > 10)
  for (const selector of rules.flatMap(selector => selector.split(/,(?![^()]*\))/)).map(part => part.trim())) {
    assert.match(selector, /data-studio-first-run/, `rule can only match flag-on markup: ${selector.slice(0, 90)}`)
  }
  const layout = rules.filter(selector => selector.endsWith(' [data-studio-v4-shell-presentation]'))
  assert.equal(layout.length, 1, 'one rule hides the stage')
  assert.match(layout[0], /:has\(> \[data-studio-v4-shell-presentation\]\[data-studio-first-run-stage="true"\]\)/, 'only when the page marks the stage free to step aside')
  assert.match(layout[0], /:has\(\[data-studio-workspace-drawer="deck"\]\[data-studio-workspace-visible="true"\] \[data-studio-first-run\]\)/, 'only while the chat itself is showing the welcome')
  let hidesWithVisibility = false
  css.walkRules(rule => { if (rule.selector.endsWith('[data-studio-v4-shell-presentation]')) rule.walkDecls('visibility', decl => { hidesWithVisibility = decl.value === 'hidden' }) })
  assert.ok(hidesWithVisibility, 'the stage stays mounted: it is hidden with visibility, never display:none or unmounting')
}

// ---- 4. nothing else changed: wiring, no new request, flag documented ---------------------------------------------------------
{
  const page = read('app/builder/page.tsx')
  assert.equal((page.match(/const handleDismissBlankPlaceholder = \(\) => \{/g) || []).length, 1)
  assert.match(page, /const handleDismissBlankPlaceholder = \(\) => \{\n    if \(studioShell && studioSlideComposeOwnerRef\.current !== studioInitialSelectedTarget\.owner\) return\n    studioExplicitBlankOwnerRef\.current = studioInitialSelectedTarget\.owner\n    setBlankPlaceholderDismissed\(true\)\n  \}/, 'the dismiss handler is the one the stage always had')
  assert.match(page, /onDismissBlankPlaceholder=\{handleDismissBlankPlaceholder\}/)
  assert.doesNotMatch(page, /onDismissBlankPlaceholder=\{\(\) =>/, 'no second copy of the handler')
  assert.match(page, /studioFirstRunActions=\{studioShell && process\.env\.NEXT_PUBLIC_STUDIO_FIRST_RUN_V2 === 'true'\n\s+\? <StudioFirstRunActions onStartBlank=\{effectivePresentationUrl \? handleDismissBlankPlaceholder : undefined\} \/> : undefined\}/, 'actions are offered only with the flag; Start on a blank canvas only when a blank deck exists')
  assert.match(page, /const studioFirstRunStage = studioShell && process\.env\.NEXT_PUBLIC_STUDIO_FIRST_RUN_V2 === 'true' && studioWelcome\n\s+&& !viewerWorkflowRequest && !studioViewerFullscreen && !workspaceLayout\.inspectorVisible/, 'the stage steps aside only in the landing state: no workflow link, no fullscreen, no inspector')
  assert.match(page, /data-studio-first-run-stage=\{studioFirstRunStage && !studioFirstRunRestoring \? "true" : undefined\}/, 'the stage attribute is the #365 one, plus the restoring gate (section 5)')
  assert.match(page, /if \(studioShell && process\.env\.NEXT_PUBLIC_STUDIO_FIRST_RUN_V2 === 'true'\) \{\n\s+const viewport = messagesEndRef\.current\?\.closest\('\[data-radix-scroll-area-viewport\]'\)\n\s+if \(viewport\?\.querySelector\('\[data-studio-first-run\]'\)\) \{ viewport\.scrollTop = 0; return \}/, 'the greeting does not scroll the welcome off its heading')
  for (const file of ['components/builder/studio-first-run-actions.tsx', 'components/builder/chat/studio-welcome.tsx', 'components/builder/studio-first-run.css']) {
    const source = read(file)
    assert.doesNotMatch(source.replace(/\/\*[\s\S]*?\*\//g, ''), /\b(fetch|WebSocket|XMLHttpRequest|localStorage|sessionStorage|sendBeacon|navigator\.)\b/, `${file}: no request, socket or storage`)
  }
  const actions = read('components/builder/studio-first-run-actions.tsx')
  assert.match(actions, /<StudioIntroductionButton className="studio-first-run-link" \/>/, 'Replay intro is the existing control')
  assert.match(actions, /<Link href="\/studio\/templates"/, 'Explore templates goes where the stage link goes')
  assert.match(actions, /onClick=\{onStartBlank\}/)
  assert.match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_FIRST_RUN_V2="false"$/m, 'documented, default off')
  assert.equal(JSON.parse(read('package.json')).scripts['test:studio-first-run-v2'], 'node scripts/test-studio-first-run-v2.mjs')
}

// ---- 5. J2 pass-2 P1: an existing deck must not flash the first-run welcome while its session restores ---------------------------
// Cause: the welcome shows whenever the transcript holds no user turn, and that is also true for the moment an existing session's history
// is still being fetched (the page renders, session.isLoadingSession is true, userMessages is [] and Director may already have greeted).
// Fix (same flag): the page tells MessageList the session is restoring; the first-run welcome (head, starters, stage actions) and the
// plain welcome are then not drawn, and the stage is not hidden. A confirmed-new session (restoring false) is exactly what it was.
const restoring = props => ({ ...props, studioRestoring: true })
const welcomeMarks = /data-studio-director-welcome|data-studio-first-run|data-studio-director-starter|What story are we telling|What are we making|data-fixture-actions/
setFlags({ flag: 'true' })
for (const name of firstRunCases) {
  const markup = html(restoring(MATRIX[name]()))
  assert.doesNotMatch(markup, welcomeMarks, `${name}: a session that is still restoring draws no welcome at all (no head, no starters, no stage actions)`)
}
for (const name of Object.keys(MATRIX)) {
  // Restoring only withholds the welcome. Whatever else the transcript holds is drawn exactly as it was (a cached conversation, a reply).
  if (firstRunCases.includes(name)) continue
  assert.equal(html(restoring(MATRIX[name]())), html(MATRIX[name]()), `${name}: a transcript with a real turn or an open deck is untouched by restoring`)
}
for (const value of [undefined, false]) {
  for (const name of firstRunCases) {
    const markup = html({ ...MATRIX[name](), studioRestoring: value })
    assert.match(markup, /data-studio-first-run="true"/, `${name}: studioRestoring ${value}: a session confirmed new is still the first-run welcome`)
    assert.equal(markup, html(MATRIX[name]()), `${name}: studioRestoring ${value} changes nothing`)
  }
}
{
  // The frame order the person sees on opening an existing deck: restoring (nothing), then the restored transcript (no welcome, no first run).
  const restored = html(baseProps({ messages: [directorReply], userMessages: [userTurn], userMessageIdsRef: { current: new Set([userTurn.id]) } }))
  assert.doesNotMatch(restored, /data-studio-first-run/)
  assert.match(restored, /A pitch for the Q3 review/)
  const loadingFrame = html(restoring(baseProps({ messages: [greeting] })))
  assert.doesNotMatch(loadingFrame, welcomeMarks, 'frame 1 (history still loading): no welcome')
  const settledEmpty = html(baseProps({ messages: [greeting] }))
  assert.match(settledEmpty, /data-studio-first-run="true"/, 'a history that finished loading empty is a new session: the welcome appears then')
}
// Flag off (or outside the Studio shell): the prop is ignored, the render is the base's, byte for byte.
for (const value of [undefined, 'false', 'TRUE', '1', 'true ', '']) {
  setFlags({ flag: value })
  for (const name of Object.keys(MATRIX)) assert.equal(hashOf(restoring(MATRIX[name]())), GOLDEN[name], `flag ${JSON.stringify(value)}: studioRestoring is ignored ("${name}" is the base)`)
}
setFlags({ shell: 'false', flag: 'true' })
const shellOffRestoring = Object.fromEntries(Object.entries(MATRIX).map(([n, m]) => [n, hashOf(restoring(m()))]))
setFlags({ shell: 'false' })
assert.deepEqual(shellOffRestoring, Object.fromEntries(Object.entries(MATRIX).map(([n, m]) => [n, hashOf(m())])), 'outside the Studio shell studioRestoring changes nothing')
setFlags({ flag: 'true' })
const WIRING = /const studioFirstRunRestoring = process\.env\.NEXT_PUBLIC_STUDIO_FIRST_RUN_V2 === 'true' && isStudioSessionRestoring\(\{\n\s+loadingSession: session\.isLoadingSession,\n\s+knownFresh: studioInitialKnownFresh,\n\s+localUnsavedRoute: session\.isLoadingSession && isLocalUnsavedRoute\(authScopeUserId, searchParams\.get\('session_id'\), \(\) => window\.sessionStorage\),\n\s+\}\)\n/
const restoringLib = loader.load('lib/studio-first-run-restoring.ts')
const unsavedKey = (owner, id) => `deckster_unsaved_v2_${encodeURIComponent(owner)}_${id}`
const storageWith = items => ({ getItem: key => (key in items ? items[key] : null) })
const checkRestoringLib = lib => {
  const { isStudioSessionRestoring, isLocalUnsavedRoute } = lib
  // the decision table: restoring only while loading, and only when the session is not known to be new
  for (const loadingSession of [true, false]) for (const knownFresh of [true, false]) for (const localUnsavedRoute of [true, false]) {
    assert.equal(isStudioSessionRestoring({ loadingSession, knownFresh, localUnsavedRoute }), loadingSession && !knownFresh && !localUnsavedRoute,
      `restoring(loading=${loadingSession}, fresh=${knownFresh}, unsaved=${localUnsavedRoute})`)
  }
  const OWNER = 'fixture-user-001', A = 'aaaaaaaa-0000-4000-8000-00000000000a', B = 'bbbbbbbb-0000-4000-8000-00000000000b'
  const mine = () => storageWith({ [unsavedKey(OWNER, A)]: 'true' })
  assert.equal(isLocalUnsavedRoute(OWNER, A, mine), true, 'a route id this tab generated and has not saved')
  assert.equal(isLocalUnsavedRoute(OWNER, B, mine), false, 'the marker is per id: a stale marker for session A says nothing about existing session B (switching A -> B)')
  assert.equal(isLocalUnsavedRoute('someone-else', A, mine), false, 'the marker is per account')
  assert.equal(isLocalUnsavedRoute(OWNER, A, () => storageWith({ [unsavedKey(OWNER, A)]: 'false' })), false, 'only the exact "true" marker counts')
  assert.equal(isLocalUnsavedRoute(OWNER, 'new', mine), false, 'the "new" placeholder is not an id')
  assert.equal(isLocalUnsavedRoute(OWNER, null, mine), false, 'no route id')
  assert.equal(isLocalUnsavedRoute('', A, mine), false, 'no account')
  assert.equal(isLocalUnsavedRoute(OWNER, A, () => { throw new Error('blocked storage') }), false, 'storage that throws is no proof')
  assert.equal(isLocalUnsavedRoute(OWNER, A, () => ({ getItem() { throw new Error('blocked storage') } })), false, 'a read that throws is no proof')
  assert.equal(isLocalUnsavedRoute(OWNER, A, () => undefined), false, 'no storage (server render)')
  // the whole decision, as the page composes it, for each way a Builder is opened
  const decide = ({ route, loading, fresh = false, storage }) => isStudioSessionRestoring({ loadingSession: loading, knownFresh: fresh,
    localUnsavedRoute: loading && isLocalUnsavedRoute(OWNER, route, () => storage) })
  assert.equal(decide({ route: B, loading: true, storage: storageWith({}) }), true, 'open an existing deck by URL: restoring')
  assert.equal(decide({ route: B, loading: true, storage: storageWith({ [unsavedKey(OWNER, A)]: 'true' }) }), true, 'from an unsaved session to an existing one: restoring')
  assert.equal(decide({ route: B, loading: false, storage: storageWith({}) }), false, 'history loaded: not restoring (a history that is empty is a new session)')
  assert.equal(decide({ route: A, loading: true, fresh: true, storage: storageWith({}) }), false, 'a local UUID the hook just assigned: not restoring')
  assert.equal(decide({ route: A, loading: true, storage: storageWith({ [unsavedKey(OWNER, A)]: 'true' }) }), false, 'reload of a bare session\'s own URL (unsaved): not restoring')
  assert.equal(decide({ route: null, loading: false, storage: storageWith({}) }), false, 'bare /builder before the id is assigned: not restoring')
}
checkRestoringLib(restoringLib)
{
  // The page wiring: restoring is "the history is still loading, and this is not a UUID the page just made itself", it is passed only
  // with the flag, and it also keeps the stage out of the first-run hidden state.
  const page = read('app/builder/page.tsx')
  assert.equal((page.match(/const studioFirstRunRestoring = /g) || []).length, 1)
  assert.match(page, /import \{ isLocalUnsavedRoute, isStudioSessionRestoring \} from '@\/lib\/studio-first-run-restoring'/)
  assert.match(page, WIRING, 'restoring = the history is loading and the session is neither a UUID the hook just assigned nor a local unsaved id; only with the flag')
  assert.match(page, /studioRestoring=\{studioShell && process\.env\.NEXT_PUBLIC_STUDIO_FIRST_RUN_V2 === 'true' \? studioFirstRunRestoring : undefined\}/, 'passed to the transcript only with the flag')
  assert.match(page, /data-studio-first-run-stage=\{studioFirstRunStage && !studioFirstRunRestoring \? "true" : undefined\}/, 'the stage is never hidden while the session restores')
  assert.ok(page.indexOf('const studioInitialKnownFresh = ') < page.indexOf('const studioFirstRunRestoring = '), 'defined after the value it reads (no use before definition)')
  assert.ok(page.indexOf('const studioFirstRunRestoring = ') < page.indexOf('studioRestoring={'), 'defined before it is used')
}

// ---- 6. mutation checks: the section-5 assertions must fail when the fix is taken out ---------------------------------------------
{
  const source = read('components/builder/message-list.tsx')
  const mutate = (label, from, to) => {
    assert.ok(source.includes(from), `mutation "${label}": the text to mutate is present`)
    return createLoader({ 'components/builder/message-list.tsx': source.replace(from, to) }).load('components/builder/message-list.tsx').MessageList
  }
  setFlags({ flag: 'true' })
  const tryRender = (List, props) => { try { return renderToStaticMarkup(List(props)) } catch (error) { return `THROWN ${error.message}` } }
  const cases = {
    'restoring ignored (the #365 behaviour)': ['const restoringSession = firstRunV2 && studioRestoring === true && !presentationContext', 'const restoringSession = false'],
    'restoring honoured without the flag': ['const restoringSession = firstRunV2 && studioRestoring === true && !presentationContext', 'const restoringSession = studioRestoring === true && !presentationContext'],
    'restoring also hides an open deck\'s own welcome': ['const restoringSession = firstRunV2 && studioRestoring === true && !presentationContext', 'const restoringSession = firstRunV2 && studioRestoring === true'],
    'restoring hides the whole transcript, not just the welcome': ['const restoringSession = firstRunV2 && studioRestoring === true && !presentationContext', 'const restoringSession = firstRunV2 && studioRestoring === true && !presentationContext; if (restoringSession) return null'],
  }
  for (const [label, [from, to]] of Object.entries(cases)) {
    const List = mutate(label, from, to)
    const caught = []
    // (a) a restoring session must draw no welcome
    if (welcomeMarks.test(tryRender(List, restoring(MATRIX['empty']())))) caught.push('restoring draws a welcome')
    // (b) a confirmed-new session must still draw the first-run welcome
    if (!/data-studio-first-run="true"/.test(tryRender(List, MATRIX['greeting-only']()))) caught.push('confirmed new no longer first-run')
    // (c) flag off (or shell off): the prop is ignored
    setFlags({ flag: undefined })
    if (hashOfWith(List, restoring(MATRIX['empty']())) !== GOLDEN['empty']) caught.push('flag off differs from the base')
    setFlags({ flag: 'true' })
    // (d) a real conversation is untouched by restoring
    const real = baseProps({ messages: [directorReply], userMessages: [userTurn], userMessageIdsRef: { current: new Set([userTurn.id]) } })
    if (tryRender(List, restoring(real)) !== tryRender(List, real) || !/A pitch for the Q3 review/.test(tryRender(List, restoring(real)))) caught.push('a real transcript changed')
    const deck = MATRIX['empty-with-deck-context']()
    if (tryRender(List, restoring(deck)) !== tryRender(List, deck)) caught.push('an open deck\'s welcome changed')
    assert.ok(caught.length > 0, `mutation "${label}" must be caught by the section-5 assertions`)
    console.log(`  mutation caught: ${label} -> ${caught.join('; ')}`)
  }
  // the page wiring regexes catch the obvious regressions too
  const page = read('app/builder/page.tsx')
  assert.match(page, WIRING)
  assert.doesNotMatch(page.replace('    knownFresh: studioInitialKnownFresh,\n', ''), WIRING, 'dropping the fresh-assignment exception from the wiring is caught')
  assert.doesNotMatch(page.replace('loadingSession: session.isLoadingSession,', 'loadingSession: true,'), WIRING, 'ignoring the loading state in the wiring is caught')
  assert.doesNotMatch(page.replace("process.env.NEXT_PUBLIC_STUDIO_FIRST_RUN_V2 === 'true' && isStudioSessionRestoring", 'isStudioSessionRestoring'), WIRING, 'computing it without the flag is caught')
  assert.doesNotMatch(page.replace("studioFirstRunStage && !studioFirstRunRestoring ?", 'studioFirstRunStage ?'), /data-studio-first-run-stage=\{studioFirstRunStage && !studioFirstRunRestoring \? "true" : undefined\}/, 'dropping the stage gate is caught')
  // the policy module: each way of getting it wrong fails the decision table
  const libSource = read('lib/studio-first-run-restoring.ts')
  const libMutations = {
    'restoring without a load': ['return input.loadingSession && !input.knownFresh && !input.localUnsavedRoute', 'return !input.knownFresh && !input.localUnsavedRoute'],
    'a fresh UUID counts as restoring (new-session flicker)': ['return input.loadingSession && !input.knownFresh && !input.localUnsavedRoute', 'return input.loadingSession && !input.localUnsavedRoute'],
    'a reload of an unsaved session counts as restoring': ['return input.loadingSession && !input.knownFresh && !input.localUnsavedRoute', 'return input.loadingSession && !input.knownFresh'],
    'the marker of another id counts': ['readSessionOrigin(storage, ownerId, routeSessionId)', "readSessionOrigin(storage, ownerId, 'aaaaaaaa-0000-4000-8000-00000000000a')"],
    'throwing storage is trusted': ['try { storage = getStorage() } catch { return false }', 'storage = getStorage()'],
  }
  for (const [label, [from, to]] of Object.entries(libMutations)) {
    assert.ok(libSource.includes(from), `lib mutation "${label}": text present`)
    const mutated = createLoader({ 'lib/studio-first-run-restoring.ts': libSource.replace(from, to) }).load('lib/studio-first-run-restoring.ts')
    assert.throws(() => checkRestoringLib(mutated), `lib mutation "${label}" must be caught by the decision table`)
    console.log(`  mutation caught: ${label}`)
  }
  setFlags({ flag: 'true' })
}
console.log(`Studio first-run v2 passed: flag off hashes equal the base for ${Object.keys(MATRIX).length} transcripts x 6 flag spellings, flag on shows the centred serif welcome (heading, greeting, same three starters, the stage's actions) only while nothing has been said, the CSS can match only flag-on markup, and (J2 pass-2 P1) a session whose history is still loading draws no welcome and leaves the stage in place (new, unsaved and freshly assigned sessions are exempt), checked by mutation against the transcript, the page wiring and the decision table.`)
