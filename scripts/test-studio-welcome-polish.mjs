// PASS2B G01 + G02 (FRONTEND-2): the Studio welcome, closer to the accepted v4 mockup. Flag NEXT_PUBLIC_STUDIO_WELCOME_POLISH (exact "true",
// Studio shell only), default off.
//   G01: the welcome's eyebrow "Your presentation brief" becomes a time-of-day greeting with the user's first name ("Good morning, Alex"; the
//        page's CSS upper-cases it). No usable name (none, empty, an email) -> the time of day alone. No clock (server snapshot) -> the old words.
//   G02: the collapsed "Slide" edge tab on the right edge is left out on the welcome screen and over the outline (not where a deck exists).
//
// Run: node scripts/test-studio-welcome-polish.mjs   (plain node: transpile + vm, no network, no browser, no env)
//   WELCOME_POLISH_BASE=<commit> overrides the base commit the flag-off identity is checked against (default 687b694).
//
// Proven on the REAL sources: lib/studio-welcome-polish.ts, components/builder/chat/studio-welcome.tsx, components/builder/message-list.tsx and
// app/builder/page.tsx:
//   1. the pure decisions (part of the day, first name, eyebrow words, the edge-tab rule) over their whole grids, against an independent oracle;
//   2. the component: without `greeting` the markup is the base commit's, byte for byte, over a props matrix (first-run head, plain welcome,
//      continuing welcome); with it, only the eyebrow's words change (against a controlled clock), the continuing welcome is untouched, an email is
//      never drawn, and the server snapshot (no clock) keeps the old words;
//   3. MessageList and the page: with the G01/G02 text removed each file is the base commit's; the wiring is exact (flag read inline, exact "true",
//      Studio shell only; the name is the session user's name, never the email; only the Slide handle is wrapped);
//   4. mutation check: every mutant of the four sources is killed by sections 1-3.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { stripAddSlideStatus } from './studio-add-slide-status-strip.mjs'
import { stripDarkPersist } from './studio-theme-dark-persist-strip.mjs'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const nodeRequire = createRequire(path.join(repoRoot, 'package.json'))
const React = nodeRequire('react')
const jsxRuntime = nodeRequire('react/jsx-runtime')
const { renderToStaticMarkup } = nodeRequire('react-dom/server')
const BASE_COMMIT = process.env.WELCOME_POLISH_BASE || '687b694'
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')
function baseSource(rel) {
  try {
    execFileSync('git', ['cat-file', '-e', `${BASE_COMMIT}^{commit}`], { cwd: repoRoot, stdio: 'ignore' })
    return execFileSync('git', ['show', `${BASE_COMMIT}:${rel}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch { return null }
}
let checks = 0
let counting = true
const count = fn => (...args) => { if (counting) checks++; return fn(...args) }
const eq = count(assert.equal), ok = count(assert.ok), match = count(assert.match), nomatch = count(assert.doesNotMatch)

const LIB = 'lib/studio-welcome-polish.ts'
const WELCOME = 'components/builder/chat/studio-welcome.tsx'
const LIST = 'components/builder/message-list.tsx'
const PAGE = 'app/builder/page.tsx'
const SOURCES = { [LIB]: read(LIB), [WELCOME]: read(WELCOME), [LIST]: read(LIST), [PAGE]: read(PAGE) }
const FLAG = 'NEXT_PUBLIC_STUDIO_WELCOME_POLISH'

const compile = (source, fileName) => ts.transpileModule(source, { fileName, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
function loadLib(source) {
  const module = { exports: {} }
  new Function('module', 'exports', compile(source, LIB))(module, module.exports)
  return module.exports
}

// ---------------------------------------------------------------- 1. the pure decisions
const HOURS = [-1, 0, 1, 4, 5, 8, 11, 12, 13, 16, 17, 18, 21, 23, 24, 25]
const NOT_HOURS = [NaN, Infinity, 12.5, 0.5, '9', '', null, undefined, {}, [], true]
const NAMES = [
  ['Alex Morgan', 'Alex'], ['Alex', 'Alex'], ['  Alex  Morgan ', 'Alex'], ['alex morgan', 'alex'], ['ALEX', 'ALEX'], ['A', 'A'], ['Dev User', 'Dev'], ['José Luis García', 'José'],
  ['李雷', '李雷'], ["O'Brien Kelly", "O'Brien"], ['Mary-Jane Watson', 'Mary-Jane'], ['x'.repeat(24), 'x'.repeat(24)], ['Jo Doe', 'Jo'],
  ['x'.repeat(25), null], ['alex@example.com', null], ['Alex Morgan alex@example.com', null], ['Alex <alex@example.com>', null], ['@', null], ['a@b', null],
  ['', null], ['   ', null], ['\n\t', null], ['123', null], ['-', null], ['--- ---', null], ['42 Alex', null],
  [null, null], [undefined, null], [42, null], [{}, null], [['Alex'], null], [true, null],
]
const part = hour => Number.isInteger(hour) && hour >= 0 && hour <= 23 ? (hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening') : null
function proveLib(lib, label = 'lib') {
  for (const hour of [...HOURS, ...NOT_HOURS]) eq(lib.studioGreetingPart(hour), typeof hour === 'number' ? part(hour) : null, `${label}: part of the day for ${String(hour)}`)
  for (let hour = 0; hour <= 23; hour++) eq(lib.studioGreetingPart(hour), part(hour), `${label}: hour ${hour}`)
  for (const [name, want] of NAMES) eq(lib.studioFirstName(name), want, `${label}: first name of ${JSON.stringify(name)}`)
  const words = { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' }
  for (let hour = 0; hour <= 23; hour++) {
    for (const [name, first] of NAMES) {
      const want = words[part(hour)] + (first ? `, ${first}` : '')
      eq(lib.studioWelcomeEyebrow({ hour, name, fallback: 'FALLBACK' }), want, `${label}: eyebrow at ${hour} for ${JSON.stringify(name)}`)
      ok(!lib.studioWelcomeEyebrow({ hour, name, fallback: 'FALLBACK' }).includes('@'), `${label}: never an email`)
    }
    eq(lib.studioWelcomeEyebrow({ hour, fallback: 'FALLBACK' }), words[part(hour)], `${label}: no name key at ${hour}`)
  }
  for (const hour of [...NOT_HOURS.filter(value => typeof value !== 'number' || !Number.isInteger(value)), -1, 24, 99]) {
    for (const name of ['Alex Morgan', null]) eq(lib.studioWelcomeEyebrow({ hour, name, fallback: 'Your presentation brief' }), 'Your presentation brief', `${label}: no usable hour (${String(hour)}) keeps the fallback`)
  }
  eq(lib.studioWelcomeEyebrow({ hour: 9, name: 'Alex', fallback: '' }), 'Good morning, Alex', `${label}: the fallback is not part of a greeting`)
  // the edge tab: hidden only with the flag, only while the panel is closed, only where nothing is built yet (welcome, outline)
  for (const enabled of [false, true]) for (const panelOpen of [false, true]) for (const landing of [false, true]) for (const builtDeck of [false, true]) for (const activeVersion of ['blank', 'strawman', 'final']) {
    const want = enabled && !panelOpen && !builtDeck && (landing || activeVersion === 'strawman')
    eq(lib.studioSlideEdgeTabHidden({ enabled, panelOpen, landing, builtDeck, activeVersion }), want, `${label}: edge tab ${JSON.stringify({ enabled, panelOpen, landing, builtDeck, activeVersion })}`)
  }
}
proveLib(loadLib(SOURCES[LIB]))

// ---------------------------------------------------------------- 2. the component
const clock = { hour: 9 }
// The local hour is whatever the test says; the UTC hour is deliberately different, so a UTC read cannot pass on a machine set to UTC.
class FakeDate extends Date {
  constructor(...args) { if (args.length) super(...args); else super(2026, 9, 15, 3, 30, 0) }
  getHours() { return clock.hour }
  getUTCHours() { return (clock.hour + 5) % 24 }
}
const lucide = new Proxy({}, { get: (_, name) => name === '__esModule' ? false : (props => React.createElement('svg', { 'data-icon': String(name), width: props?.size })) })
function welcomeComponent(welcomeSource, libSource, { clockAvailable }) {
  const module = { exports: {} }
  const lib = loadLib(libSource)
  const stubs = {
    react: clockAvailable ? { ...React, useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot() } : React,
    'react/jsx-runtime': jsxRuntime, 'lucide-react': lucide, '@/lib/studio-welcome-polish': lib,
  }
  vm.runInNewContext(compile(welcomeSource, WELCOME), { module, exports: module.exports, Date: FakeDate, require: spec => { if (!(spec in stubs)) throw new Error(`unexpected import ${spec}`); return stubs[spec] } })
  return module.exports
}
const render = (Welcome, props) => renderToStaticMarkup(React.createElement(Welcome.StudioWelcome, props))
const noop = () => {}
const CONTEXT = { title: 'Quarterly review', slideCount: 7 }
const PLAIN = [{}, { onDraftPrompt: noop }, { onDraftPrompt: noop, busy: true }, { connectionState: 'connected' }, { connectionState: 'error', onDraftPrompt: noop }]
const FIRST = PLAIN.map(props => ({ ...props, firstRun: true }))
const CONTINUING = [{ presentationContext: CONTEXT }, { presentationContext: CONTEXT, onDraftPrompt: noop }, { presentationContext: CONTEXT, firstRun: true }, { presentationContext: { title: null, slideCount: null }, onDraftPrompt: noop }]
const BASE_WORDS = 'Your presentation brief'
const eyebrowOf = html => html.match(/data-studio-director-welcome-part="eyebrow">(?:<svg[^>]*><\/svg>)?([^<]*)</)?.[1]
function proveWelcome(welcomeSource, libSource, label = 'welcome') {
  const baseWelcomeSource = baseSource(WELCOME)
  const Work = hour => { clock.hour = hour; return welcomeComponent(welcomeSource, libSource, { clockAvailable: true }) }
  const Server = welcomeComponent(welcomeSource, libSource, { clockAvailable: false })
  const Base = baseWelcomeSource ? welcomeComponent(baseWelcomeSource, SOURCES[LIB], { clockAvailable: true }) : null
  // flag off: no `greeting` anywhere -> the base commit's markup, with and without a clock
  if (Base) for (const props of [...PLAIN, ...FIRST, ...CONTINUING]) {
    for (const [name, Component] of [['clock', Work(9)], ['no clock', Server]]) eq(render(Component, props), render(Base, props), `${label}: no greeting (${name}) is the base commit's markup for ${JSON.stringify(Object.keys(props))}`)
  }
  for (const props of [...PLAIN, ...FIRST]) eq(eyebrowOf(render(Server, props)), BASE_WORDS, `${label}: the eyebrow reads ${BASE_WORDS} without a greeting`)
  for (const props of [...PLAIN, ...FIRST]) {
    const first = props.firstRun === true
    // the server snapshot has no clock: the old words, and the markup is the base commit's
    for (const greeting of [{ name: 'Alex Morgan' }, { name: null }, {}]) {
      const html = render(Server, { ...props, greeting })
      eq(eyebrowOf(html), BASE_WORDS, `${label}: server snapshot keeps the old words`)
      if (Base) eq(html, render(Base, props), `${label}: server snapshot markup is the base commit's`)
    }
    for (const [hour, words] of [[0, 'Good morning'], [9, 'Good morning'], [11, 'Good morning'], [12, 'Good afternoon'], [16, 'Good afternoon'], [17, 'Good evening'], [23, 'Good evening']]) {
      const Component = Work(hour)
      const named = render(Component, { ...props, greeting: { name: 'Alex Morgan' } })
      eq(eyebrowOf(named), `${words}, Alex`, `${label}: ${first ? 'first-run head' : 'plain welcome'} at ${hour}`)
      eq(eyebrowOf(render(Component, { ...props, greeting: { name: null } })), words, `${label}: no name at ${hour}`)
      eq(eyebrowOf(render(Component, { ...props, greeting: {} })), words, `${label}: no name key at ${hour}`)
      for (const email of ['alex@example.com', 'Alex Morgan <alex@example.com>']) {
        const html = render(Component, { ...props, greeting: { name: email } })
        eq(eyebrowOf(html), words, `${label}: an email is never drawn`)
        nomatch(html, /@/, `${label}: no "@" anywhere`)
      }
      // only the eyebrow's words change
      if (Base) eq(named.replace(`${words}, Alex`, BASE_WORDS), render(Base, props), `${label}: nothing but the eyebrow's words differs`)
    }
  }
  // the continuing welcome is a different head: a greeting does not touch it
  if (Base) for (const props of CONTINUING) for (const hour of [9, 14, 20]) eq(render(Work(hour), { ...props, greeting: { name: 'Alex Morgan' } }), render(Base, props), `${label}: continuing welcome untouched at ${hour}`)
  eq(eyebrowOf(render(Work(9), { ...CONTINUING[0], greeting: { name: 'Alex' } })), 'Your current presentation', `${label}: continuing eyebrow`)
}
proveWelcome(SOURCES[WELCOME], SOURCES[LIB])
if (!baseSource(WELCOME)) console.log(`  SKIP base-commit welcome identity: ${BASE_COMMIT} is not in this clone`)

// ---------------------------------------------------------------- 3. MessageList and the page
const LIST_G01 = [
  /, type StudioWelcomeGreeting \} from "@\/components\/builder\/chat\/studio-welcome"/,
  /  \/\*\* PASS2B G01[^\n]*\n  studioWelcomeGreeting\?: StudioWelcomeGreeting\n/,
  /  studioWelcomeGreeting,\n/,
  /          \{\.\.\.\(studioWelcomeGreeting \? \{ greeting: studioWelcomeGreeting \} : \{\}\)\}\n/,
]
const stripList = text => text.replace(LIST_G01[0], ' } from "@/components/builder/chat/studio-welcome"').replace(LIST_G01[1], '').replace(LIST_G01[2], '').replace(LIST_G01[3], '')
const PAGE_IMPORT = "import { studioSlideEdgeTabHidden } from '@/lib/studio-welcome-polish'\n"
const PAGE_SPREAD = "                        {...(studioShell && process.env.NEXT_PUBLIC_STUDIO_WELCOME_POLISH === 'true' ? { studioWelcomeGreeting: { name: user?.name ?? null } } : {})}\n"
const PAGE_CONST = `  // PASS2B G02 (flag NEXT_PUBLIC_STUDIO_WELCOME_POLISH, default off): no collapsed Slide edge tab on the welcome screen or over the outline.
  const studioSlideTabHidden = studioShell && studioSlideEdgeTabHidden({
    enabled: process.env.NEXT_PUBLIC_STUDIO_WELCOME_POLISH === 'true', panelOpen: isSlideDrawerOpen || studioSlideVisible,
    landing: studioWelcome, builtDeck: studioCanvasLifecycle.hasGeneratedDeck, activeVersion: effectiveActiveVersion,
  })
`
const PAGE_OPEN = '              {!studioSlideTabHidden && (\n'
const PAGE_CLOSE = '              </button>\n              )}\n'
// + PASS2B J2-04 (NEXT_PUBLIC_STUDIO_ADD_SLIDE_STATUS) adds three flag-gated entries to the page; scripts/studio-add-slide-status-strip.mjs takes them out first.
const stripPage = text => stripDarkPersist(PAGE, stripAddSlideStatus(PAGE, text)).replace(PAGE_IMPORT, '').replace(PAGE_SPREAD, '').replace(PAGE_CONST, '').replace(PAGE_OPEN, '').replace(PAGE_CLOSE, '              </button>\n')
function provePage(page, label = 'page') {
  eq((page.match(/process\.env\.NEXT_PUBLIC_STUDIO_WELCOME_POLISH/g) ?? []).length, 2, `${label}: the flag is read twice, inline (the greeting and the edge tab)`)
  eq(page.split(PAGE_SPREAD).length - 1, 1, `${label}: the exact-flag, Studio-shell greeting spread, once`)
  eq(page.split(PAGE_CONST).length - 1, 1, `${label}: the exact-flag, Studio-shell edge-tab decision, once`)
  eq(page.split(PAGE_IMPORT).length - 1, 1, `${label}: the import`)
  const spreadAt = page.indexOf(PAGE_SPREAD), listAt = page.indexOf('                      <MessageList\n'), listEnd = page.indexOf('\n                      />\n', listAt)
  ok(listAt > 0 && listEnd > listAt && spreadAt > listAt && spreadAt < listEnd, `${label}: the spread is on MessageList`)
  // only the Slide handle is wrapped, and exactly around its button
  eq(page.split(PAGE_OPEN).length - 1, 1, `${label}: one wrapper`)
  const openAt = page.indexOf(PAGE_OPEN), closeAt = page.indexOf(PAGE_CLOSE, openAt)
  ok(closeAt > openAt, `${label}: the wrapper closes`)
  const wrapped = page.slice(openAt, closeAt + PAGE_CLOSE.length)
  match(wrapped, /^ {14}\{!studioSlideTabHidden && \(\n {14}<button\n/, `${label}: it opens on a button`)
  eq((wrapped.match(/<button/g) ?? []).length, 1, `${label}: one button inside`)
  match(wrapped, /data-studio-drawer-handle=\{studioShell \? 'slide' : undefined\}/, `${label}: the Slide handle`)
  nomatch(wrapped, /data-studio-drawer-handle=\{studioShell \? '(?:element|director)'/, `${label}: not another handle`)
  for (const other of ["'element'", "'director'"]) {
    const at = page.indexOf(`data-studio-drawer-handle={studioShell ? ${other} : undefined}`)
    ok(at > 0 && (at < openAt || at > closeAt), `${label}: the ${other} handle is outside the wrapper`)
  }
  const basePage = baseSource(PAGE)
  if (basePage) eq(stripPage(page), basePage, `${label}: without the G01/G02 text the page is ${BASE_COMMIT}'s`)
}
function proveList2(source, label = 'list') {
  eq(source.split('studioWelcomeGreeting').length - 1, 4, `${label}: the prop is named four times (declaration, destructure, spread condition and value)`)
  match(source, /\{\.\.\.\(studioWelcomeGreeting \? \{ greeting: studioWelcomeGreeting \} : \{\}\)\}/, `${label}: handed down only when present, as \`greeting\``)
  nomatch(source, /process\.env\.NEXT_PUBLIC_STUDIO_WELCOME_POLISH/, `${label}: the flag is the page's alone`)
  const welcomeAt = source.indexOf('<StudioWelcome\n'), end = source.indexOf('/>', welcomeAt)
  ok(source.slice(welcomeAt, end).includes('studioWelcomeGreeting'), `${label}: it is on StudioWelcome`)
  const baseList = baseSource(LIST)
  if (baseList) eq(stripList(source), baseList, `${label}: without the G01 text the file is ${BASE_COMMIT}'s`)
}
provePage(SOURCES[PAGE]); proveList2(SOURCES[LIST])

// the component itself: one clock read, nothing else that reaches out; the helper module has no imports and no clock
function proveStatic(welcome, lib, label = 'static') {
  nomatch(welcome.replace(/\/\*[\s\S]*?\*\//g, ''), /\b(fetch|WebSocket|XMLHttpRequest|localStorage|sessionStorage|sendBeacon|navigator\.)\b/, `${label}: no request, socket or storage`)
  eq((welcome.match(/new Date\(\)/g) ?? []).length, 1, `${label}: one clock read`)
  match(welcome, /const serverHour = \(\): number \| null => null/, `${label}: the server snapshot has no hour`)
  match(welcome, /useSyncExternalStore<number \| null>\(subscribeNever, clientHour, serverHour\)/, `${label}: the hour is an external snapshot, read on the client`)
  nomatch(lib, /^import |require\(|\bDate\b|\bfetch\b/m, `${label}: the helper module is import-free and has no clock`)
}
proveStatic(SOURCES[WELCOME], SOURCES[LIB])

// ---------------------------------------------------------------- 4. mutation check
const MUTANTS = [
  // the pure decisions
  [LIB, 'noon is afternoon', 'hour < 12 ? \'morning\'', 'hour < 13 ? \'morning\''],
  [LIB, 'five is evening', 'hour < 17 ? \'afternoon\'', 'hour < 18 ? \'afternoon\''],
  [LIB, 'evening is afternoon', ': \'evening\'\n}', ': \'afternoon\'\n}'],
  [LIB, 'hour 24 accepted', 'hour > 23', 'hour > 24'],
  [LIB, 'negative hour accepted', '|| hour < 0 ||', '|| hour < -5 ||'],
  [LIB, 'fractional hour accepted', '!Number.isInteger(hour) || ', ''],
  [LIB, 'email as a name', "if (!trimmed || trimmed.includes('@')) return null", 'if (!trimmed) return null'],
  [LIB, 'whole name', 'const first = trimmed.split(/\\s+/)[0]', 'const first = trimmed'],
  [LIB, 'last name', 'const first = trimmed.split(/\\s+/)[0]', 'const first = trimmed.split(/\\s+/).pop() as string'],
  [LIB, 'no letter needed', '!/\\p{L}/u.test(first) || ', ''],
  [LIB, 'no length guard', ' || first.length > 24', ''],
  [LIB, 'length guard 25', 'first.length > 24', 'first.length > 25'],
  [LIB, 'name not trimmed', 'const trimmed = name.trim()', 'const trimmed = name'],
  [LIB, 'non-string names', "if (typeof name !== 'string') return null", "if (typeof name !== 'string') return String(name)"],
  [LIB, 'name always drawn', 'return first ? `${GREETING_WORDS[part]}, ${first}` : GREETING_WORDS[part]', 'return `${GREETING_WORDS[part]}, ${first}`'],
  [LIB, 'name never drawn', 'return first ? `${GREETING_WORDS[part]}, ${first}` : GREETING_WORDS[part]', 'return GREETING_WORDS[part]'],
  [LIB, 'no fallback', 'if (!part) return fallback', 'if (!part) return GREETING_WORDS.morning'],
  [LIB, 'words changed', "afternoon: 'Good afternoon'", "afternoon: 'Good day'"],
  [LIB, 'edge tab: flag ignored', 'if (!enabled || panelOpen || builtDeck) return false', 'if (panelOpen || builtDeck) return false'],
  [LIB, 'edge tab: open panel loses its tab', 'if (!enabled || panelOpen || builtDeck) return false', 'if (!enabled || builtDeck) return false'],
  [LIB, 'edge tab: built deck loses its tab', 'if (!enabled || panelOpen || builtDeck) return false', 'if (!enabled || panelOpen) return false'],
  [LIB, 'edge tab: landing ignored', 'return landing || activeVersion === \'strawman\'', 'return activeVersion === \'strawman\''],
  [LIB, 'edge tab: outline ignored', 'return landing || activeVersion === \'strawman\'', 'return landing'],
  [LIB, 'edge tab: blank deck loses its tab', 'return landing || activeVersion === \'strawman\'', 'return landing || activeVersion !== \'final\''],
  [LIB, 'edge tab: always hidden', 'return landing || activeVersion === \'strawman\'', 'return true'],
  // the component
  [WELCOME, 'greeting ignored (plain)', 'greeting ? <StudioGreetingText greeting={greeting} fallback="Your presentation brief" /> : "Your presentation brief"', '"Your presentation brief"'],
  [WELCOME, 'greeting ignored (first run)', '{greeting ? <StudioGreetingText greeting={greeting} fallback={FIRST_RUN_COPY.eyebrow} /> : FIRST_RUN_COPY.eyebrow}', '{FIRST_RUN_COPY.eyebrow}'],
  [WELCOME, 'greeting reaches the continuing welcome', '{continuing ? "Your current presentation" : greeting ?', '{continuing ? (greeting ? <StudioGreetingText greeting={greeting} fallback="x" /> : "Your current presentation") : greeting ?'],
  [WELCOME, 'first-run head never told', 'return <StudioFirstRunHead greeting={greeting} />', 'return <StudioFirstRunHead />'],
  [WELCOME, 'clock on the server', 'const serverHour = (): number | null => null', 'const serverHour = (): number | null => new Date().getHours()'],
  [WELCOME, 'hour not local', 'new Date().getHours()', 'new Date().getUTCHours()'],
  [WELCOME, 'name ignored', 'name: greeting.name, fallback', 'name: null, fallback'],
  [WELCOME, 'email name', 'name: greeting.name, fallback', 'name: "someone@example.com", fallback'],
  [WELCOME, 'fallback ignored', 'return <>{studioWelcomeEyebrow({ hour, name: greeting.name, fallback })}</>', 'return <>{studioWelcomeEyebrow({ hour, name: greeting.name, fallback: "" })}</>'],
  [WELCOME, 'always the greeting', 'greeting ? <StudioGreetingText greeting={greeting} fallback="Your presentation brief" /> : "Your presentation brief"', '<StudioGreetingText greeting={greeting ?? {}} fallback="Your presentation brief" />'],
  [WELCOME, 'a request', 'const subscribeNever = () => () => {}', 'const subscribeNever = () => () => {}\nvoid fetch("/api/x")'],
  [WELCOME, 'markup changed', '<div data-studio-director-welcome-part="eyebrow"><Sparkles size={13}', '<div data-studio-director-welcome-part="eyebrow" data-x="1"><Sparkles size={13}'],
  [WELCOME, 'heading changed', 'What story are we telling today?', 'What story are we telling?'],
  // MessageList
  [LIST, 'prop never handed down', '{...(studioWelcomeGreeting ? { greeting: studioWelcomeGreeting } : {})}', ''],
  [LIST, 'greeting always handed down', '{...(studioWelcomeGreeting ? { greeting: studioWelcomeGreeting } : {})}', '{...{ greeting: studioWelcomeGreeting ?? {} }}'],
  [LIST, 'flag read here', 'studioWelcomeGreeting,\n  messagesEndRef,', 'studioWelcomeGreeting: process.env.NEXT_PUBLIC_STUDIO_WELCOME_POLISH === \'true\' ? studioWelcomeGreeting : undefined,\n  messagesEndRef,'],
  [LIST, 'another branch changed', 'const restoringSession = firstRunV2 && studioRestoring === true && !presentationContext', 'const restoringSession = firstRunV2 && studioRestoring === true'],
  // the page
  [PAGE, 'greeting without the flag', "studioShell && process.env.NEXT_PUBLIC_STUDIO_WELCOME_POLISH === 'true' ? { studioWelcomeGreeting", "studioShell ? { studioWelcomeGreeting"],
  [PAGE, 'greeting flag read loosely', "process.env.NEXT_PUBLIC_STUDIO_WELCOME_POLISH === 'true' ? { studioWelcomeGreeting", "process.env.NEXT_PUBLIC_STUDIO_WELCOME_POLISH !== 'false' ? { studioWelcomeGreeting"],
  [PAGE, 'greeting outside the Studio shell', "studioShell && process.env.NEXT_PUBLIC_STUDIO_WELCOME_POLISH === 'true' ? { studioWelcomeGreeting", "process.env.NEXT_PUBLIC_STUDIO_WELCOME_POLISH === 'true' ? { studioWelcomeGreeting"],
  [PAGE, 'the email as the name', '{ name: user?.name ?? null }', '{ name: user?.name ?? user?.email ?? null }'],
  [PAGE, 'the email only', '{ name: user?.name ?? null }', '{ name: user?.email ?? null }'],
  [PAGE, 'edge tab flag read loosely', "enabled: process.env.NEXT_PUBLIC_STUDIO_WELCOME_POLISH === 'true', panelOpen", "enabled: process.env.NEXT_PUBLIC_STUDIO_WELCOME_POLISH !== 'false', panelOpen"],
  [PAGE, 'edge tab flag ignored', "enabled: process.env.NEXT_PUBLIC_STUDIO_WELCOME_POLISH === 'true', panelOpen", 'enabled: true, panelOpen'],
  [PAGE, 'edge tab outside the Studio shell', 'const studioSlideTabHidden = studioShell && studioSlideEdgeTabHidden', 'const studioSlideTabHidden = studioSlideEdgeTabHidden'],
  [PAGE, 'open panel not considered', 'panelOpen: isSlideDrawerOpen || studioSlideVisible', 'panelOpen: false'],
  [PAGE, 'visible panel not considered', 'panelOpen: isSlideDrawerOpen || studioSlideVisible', 'panelOpen: isSlideDrawerOpen'],
  [PAGE, 'landing signal wrong', 'landing: studioWelcome, builtDeck', 'landing: false, builtDeck'],
  [PAGE, 'built deck signal wrong', 'builtDeck: studioCanvasLifecycle.hasGeneratedDeck, activeVersion', 'builtDeck: false, activeVersion'],
  [PAGE, 'authored deck counts as built', 'builtDeck: studioCanvasLifecycle.hasGeneratedDeck, activeVersion', 'builtDeck: studioCanvasLifecycle.hasAuthoredDeck, activeVersion'],
  [PAGE, 'version signal wrong', 'activeVersion: effectiveActiveVersion,\n  })', 'activeVersion: activeVersion,\n  })'],
  [PAGE, 'tab never drawn', '{!studioSlideTabHidden && (\n              <button', '{false && (\n              <button'],
  [PAGE, 'tab always drawn', '{!studioSlideTabHidden && (\n              <button', '{true && (\n              <button'],
  [PAGE, 'wrapper condition removed', '{!studioSlideTabHidden && (\n              <button', '{(\n              <button'],
]
let killed = 0
counting = false
for (const [file, name, from, to] of MUTANTS) {
  const source = SOURCES[file]
  assert.ok(source.includes(from), `mutant "${name}": the text it replaces exists in ${file}`)
  const mutated = source.replace(from, () => to)
  assert.notEqual(mutated, source, `mutant "${name}" changes the source`)
  let survived = false
  try {
    if (file === LIB) { proveLib(loadLib(mutated), name); proveWelcome(SOURCES[WELCOME], mutated, name); proveStatic(SOURCES[WELCOME], mutated, name) }
    if (file === WELCOME) { proveStatic(mutated, SOURCES[LIB], name); proveWelcome(mutated, SOURCES[LIB], name) }
    if (file === LIST) proveList2(mutated, name)
    if (file === PAGE) provePage(mutated, name)
    survived = true
  } catch (error) { assert.equal(error?.code, 'ERR_ASSERTION', `mutant "${name}" must be killed by an assertion, not a crash: ${error}`); killed++ }
  assert.ok(!survived, `mutant survived: ${name}`)
}
counting = true
eq(killed, MUTANTS.length)

// ---------------------------------------------------------------- .env.example
match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_WELCOME_POLISH="false"$/m, 'documented in .env.example, default off')

console.log(`Studio welcome polish (G01 greeting, G02 edge tab): ${checks} checks passed, ${killed}/${MUTANTS.length} mutants killed; no network.`)
