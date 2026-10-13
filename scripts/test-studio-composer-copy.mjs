// PASS2-PK-FOUR #2 (frontend-2): the composer's idle placeholder in plain words.
// Flag NEXT_PUBLIC_STUDIO_COMPOSER_COPY (exact "true", Studio shell only), default off. Flag off must render exactly as the base did.
//
// Run: node scripts/test-studio-composer-copy.mjs   (plain node: transpile + vm, no network, no timers, no writes)
//   COMPOSER_COPY_ROOT=<pristine base checkout> PRINT_GOLDEN=1 node scripts/test-studio-composer-copy.mjs
//     re-prints the flag-off hashes below from the base sources.
//
// The proof runs on the REAL source, components/builder/chat-input.tsx, transpiled and evaluated in a vm. ChatInput is called as a
// function (hooks stubbed, effects not run), so what is hashed is the element tree it returns plus its static markup. Section 5
// mutates the source in memory and shows that each check here fails for the mistake it guards against.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const treeRoot = process.env.COMPOSER_COPY_ROOT
  ? path.resolve(process.env.COMPOSER_COPY_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = file => fs.readFileSync(path.join(treeRoot, file), 'utf8')
const FLAG = 'NEXT_PUBLIC_STUDIO_COMPOSER_COPY'
const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const sha = text => crypto.createHash('sha256').update(text).digest('hex')
const refuse = () => { throw new Error('composer-copy fixture refuses services, timers and writes') }
const CHAT_INPUT = 'components/builder/chat-input.tsx'

const COPY_DECK = 'Ask for a change, or describe a new deck…'
const COPY_NO_DECK = 'What would you like to present?'
const BASE_IDLE = 'Message Director...'

// ---- module loader: ChatInput from a source string, in a vm, with explicit stubs --------------------------------------------------
const env = {}
const hookStubs = {
  useState: init => [typeof init === 'function' ? init() : init, () => {}], useEffect() {}, useLayoutEffect() {},
  useRef: current => ({ current }), useCallback: callback => callback, useMemo: callback => callback(),
}
const reactStub = { ...React, ...hookStubs }
const host = tag => ({ children }) => React.createElement(tag, null, children)
const passthrough = ({ children }) => React.createElement(React.Fragment, null, children)
const nothing = () => null
const stubs = {
  react: reactStub,
  'react/jsx-runtime': await import('react/jsx-runtime'),
  'lucide-react': new Proxy({}, { get: (_, name) => name === '__esModule' ? false : function Icon() { return React.createElement('svg', { 'data-icon': String(name) }) } }),
  '@/components/ui/button': { Button: function Button({ children }) { return React.createElement('button', null, children) } },
  '@/components/ui/textarea': { Textarea: function Textarea(p) { return React.createElement('textarea', { placeholder: p.placeholder, 'aria-label': p['aria-label'], disabled: p.disabled, rows: p.rows, defaultValue: p.value }) } },
  '@/components/ui/switch': { Switch: function Switch() { return React.createElement('button', { role: 'switch' }) } },
  '@/components/ui/dropdown-menu': { DropdownMenu: passthrough, DropdownMenuContent: passthrough, DropdownMenuTrigger: passthrough },
  '@/components/file-chip': { FileChip: function FileChip() { return React.createElement('span', { 'data-file-chip': 'true' }) } },
  '@/components/builder/chat/mention-popover': { SlideMentionPopover: nothing },
  '@/lib/mdc-mentions': { filterMentionSlides: () => [], mentionToken: refuse },
  '@/lib/mdc-flags': { CHAT_MENTIONS: false },
  '@/lib/config': { getThemeBuilderUrl: refuse, features: { enableFileUploads: true } },
  '@/lib/service-url': { ServiceUrlConfigError: class ServiceUrlConfigError extends Error {} },
  '@/lib/theme-builder': { FALLBACK_THEME_PRESETS: [], isValidThemeHex: () => true, normalizeThemePresetId: value => value },
  '@/hooks/use-theme-profiles': { useThemeProfiles: () => ({ loading: false, error: null, listThemes: refuse, saveTheme: refuse, setStandardTheme: refuse, clearStandardTheme: refuse, deleteTheme: refuse }) },
  '@/hooks/use-templates': { isTemplateGenerationReady: () => false, templateGenerationUnavailableReason: () => '' },
  './template-picker': { TemplatePicker: nothing },
  './studio-composer-hint': { StudioComposerHint: passthrough },
  './studio-theme-menu': { StudioThemeMenu: nothing },
  // PASS2-COMPOSER-POPUPS: the V2 popup helpers; the flag is off in this test, so they are never called.
  '@/lib/studio-composer-popups': { nextComposerPopup: refuse, keepPopupOpenForDropdownList: refuse },
}
const transpileCache = new Map()
function loadChatInput(source) {
  if (!transpileCache.has(source)) {
    const out = ts.transpileModule(source, { fileName: CHAT_INPUT, reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } })
    assert.deepEqual((out.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error), [], 'chat-input transpiles')
    transpileCache.set(source, out.outputText)
  }
  const mod = { exports: {} }
  vm.runInNewContext(transpileCache.get(source), {
    module: mod, exports: mod.exports, process: { env }, console, fetch: refuse, setTimeout: refuse, clearTimeout: refuse, localStorage: undefined,
    require: spec => { assert.ok(spec in stubs, `unexpected import ${spec}`); return stubs[spec] },
  })
  return mod.exports.ChatInput
}
/** Explicit values only: undefined means the variable is not set at all. */
const setFlags = ({ shell, flag }) => {
  for (const key of [SHELL, FLAG]) delete env[key]
  if (shell !== undefined) env[SHELL] = shell
  if (flag !== undefined) env[FLAG] = flag
}

// ---- fixtures: every state the composer's placeholder chain can be in ----------------------------------------------------------------
const action = { label: 'Revise this slide', value: 'revise', primary: false, requires_input: true }
const pending = { action, messageId: 'synthetic-pending', timestamp: 1 }
const makeProps = (over = {}) => ({
  inputMessage: '', onInputChange: () => {}, onSubmit: () => {}, uploadedFiles: [], onFilesSelected: refuse, onRemoveFile: refuse, onClearAllFiles: refuse,
  pendingActionInput: null, onCancelAction: () => {}, researchEnabled: false, onResearchEnabledChange: refuse, webSearchEnabled: false,
  onWebSearchEnabledChange: refuse, knowledgeGraphEnabled: false, onKnowledgeGraphEnabledChange: refuse, showKnowledgeGraphToggle: false,
  knowledgeGraphAccess: 'unavailable', onKnowledgeGraphAccessClick: refuse, isReady: true, isLoadingSession: false, connected: true, connecting: false,
  user: { id: 'synthetic-user' }, currentSessionId: 'synthetic-session', onRequestSession: refuse, buildTheme: { mode: 'auto' }, onBuildThemeChange: refuse,
  ...over,
})
const IDLE_STATES = ['idle', 'idle-draft', 'idle-uploading', 'idle-slides', 'idle-research-on']
const STATES = {
  'idle': () => makeProps(),
  'idle-draft': () => makeProps({ inputMessage: 'Make the title shorter' }),
  'idle-uploading': () => makeProps({ uploadedFiles: [{ id: 'f1', name: 'brief.pdf', status: 'uploading', size: 10, type: 'application/pdf' }] }),
  'idle-slides': () => makeProps({ mentionSlides: [{ index: 0, title: 'Opening', slide_id: 's1' }, { index: 1, title: 'Plan', slide_id: 's2' }] }),
  'idle-research-on': () => makeProps({ researchEnabled: true, webSearchEnabled: true }),
  'no-user': () => makeProps({ user: null }),
  'loading-session': () => makeProps({ isLoadingSession: true }),
  'disconnected': () => makeProps({ connected: false, connecting: false }),
  'connecting': () => makeProps({ connected: false, connecting: true }),
  'template-running': () => makeProps({ isTemplateReuseRunning: true }),
  'awaiting-reply': () => makeProps({ awaitingReply: true }),
  'pending-action': () => makeProps({ pendingActionInput: pending }),
}
const DECK_VALUES = [undefined, false, true]

// ---- serialisation and hashing --------------------------------------------------------------------------------------------------
const ser = (value, { skipPlaceholder = false } = {}) => JSON.stringify(value, (key, item) =>
  typeof item === 'function' ? `[fn ${item.name || ''}]` : typeof item === 'symbol' ? String(item) : item === undefined ? '__undefined__'
    : skipPlaceholder && key === 'placeholder' ? '<placeholder>' : item)
const treeOf = (ChatInput, props) => ChatInput(props)
const markupOf = tree => renderToStaticMarkup(tree)
const hashOf = (ChatInput, props) => { const tree = treeOf(ChatInput, props); return sha(ser(tree) + '\n' + markupOf(tree)) }
const flat = node => Array.isArray(node) ? node.flatMap(flat) : !node || typeof node !== 'object' ? [] : [node, ...flat(node.props?.children)]
const textarea = tree => flat(tree).find(node => node.type?.name === 'Textarea')
const placeholderOf = (ChatInput, props) => textarea(treeOf(ChatInput, props)).props.placeholder

/** Hashes of every state for one shell and flag value. The deck prop must not change a flag-off hash, so all three values are hashed. */
function identityHashes(ChatInput, { shell, flag }) {
  setFlags({ shell, flag })
  const out = {}
  for (const [name, make] of Object.entries(STATES)) {
    out[name] = DECK_VALUES.map(deckOpen => hashOf(ChatInput, makeProps({ ...make(), ...(deckOpen === undefined ? {} : { deckOpen }) })))
  }
  return out
}
const goldenKey = (name, shell) => `${name}|shell:${shell === 'true'}`

// Flag-off hashes of the BASE sources (studio-v4-dev-preparation-code 5cc455d), one per state and shell value.
const GOLDEN = {
  'idle|shell:true': 'fd0e03bbbec9478129ec81038e52b81a9ced1eafe71322f92c90aa113440b165',
  'idle-draft|shell:true': 'ccd0fd53665fdc1b5b691889bc2791d1e83ed800471885f5e0a58ce70df46152',
  'idle-uploading|shell:true': '66a446b0eddd992a020a852d77fb6333bd0c43b70f82cbfdb375b66bec14cd2f',
  'idle-slides|shell:true': 'fd0e03bbbec9478129ec81038e52b81a9ced1eafe71322f92c90aa113440b165',
  'idle-research-on|shell:true': 'c61f4a8a84db9c618bff47a9ed83564c866de4637818bbda55f4522c34da6ddc',
  'no-user|shell:true': 'bae89241664c223b0c3fd181d8d64e326da31a90ada2741a5ac67cfdfcc632ae',
  'loading-session|shell:true': '1d1c6ef623f8c9440effd391037e165ab20570eb6d5bb9723cef7767e0115f9c',
  'disconnected|shell:true': 'a804f8a0a3a83cda2bda61d5130ffdf384e38ff4600510be04526bbe76ce88b5',
  'connecting|shell:true': '4042181e165dad4e7fad36bce1a35642250b7f98fbf655836f1731802a974732',
  'template-running|shell:true': '90b6e9a793bbc23c0767872f2073f1bc61c96f569756d2e2daf15ae1009b437a',
  'awaiting-reply|shell:true': '96c584927add81222245e8d9e9a2b3c99cbd3789b9d684d62bbf21b2e0ba030f',
  'pending-action|shell:true': '4caf2ea931da1a4d37edd56c9becb582fa6deff1b0868b920680be6c7f3696d7',
  'idle|shell:false': 'fa7c14c3eeb9d9319f34f21a63219b1662ec96606bd07007ee553ce933666db9',
  'idle-draft|shell:false': '4a9185240e775c0a1d9b8bcae02bb34ffb983ef1fc6da0c578ffdb5b72bcf1da',
  'idle-uploading|shell:false': 'aab78eef03efe95b957d4ff83e421f787d93f99aee162b917b1a6e92832fb1fb',
  'idle-slides|shell:false': 'fa7c14c3eeb9d9319f34f21a63219b1662ec96606bd07007ee553ce933666db9',
  'idle-research-on|shell:false': '7aa1560b92c5cc68d2d2ff6fc8ad09605f2f336a2cded0805109efc0bdb37899',
  'no-user|shell:false': 'c5bd19d977db1ab6bd510ef248bf2ba10ff9e77990d7de81aab3ed4b0cec752b',
  'loading-session|shell:false': 'cd9b002fe87de9c7d50ee9e26c330cea42cb1a7984932111195d5fc7efeaa41a',
  'disconnected|shell:false': 'c950b3f72e00cb8fc01fd19200145838cc8eacfdf4e4f14363dab5b58c55b07a',
  'connecting|shell:false': '770d6bab9f0db6dd1f76e0d40962c3400aead93b58cd8d332ba0b3e2bf7ef8a5',
  'template-running|shell:false': 'f4c38ae4ae50a8b7251c070a919b6ac6418256ae27f11e0bf2ec618bd9075d34',
  'awaiting-reply|shell:false': '802b98ffa78c9551ac8e1e06207427c9bcdfa1725d4106c41f81e79bea1e28e1',
  'pending-action|shell:false': '5f66cfd66c3b9a28b6200cab426c8ab76cc94666caf65b5ec99bcb3f323c2f44',
}
if (process.env.PRINT_GOLDEN === '1') {
  const ChatInput = loadChatInput(read(CHAT_INPUT))
  const printed = {}
  for (const shell of ['true', 'false']) {
    const got = identityHashes(ChatInput, { shell, flag: undefined })
    for (const [name, hashes] of Object.entries(got)) { assert.equal(new Set(hashes).size, 1, `${name}: the base ignores deckOpen`); printed[goldenKey(name, shell)] = hashes[0] }
  }
  console.log(JSON.stringify(printed, null, 2))
  process.exit(0)
}

// ---- the checks, as functions of a source string (so section 5 can run them on mutants) ----------------------------------------------
const FLAG_OFF_SPELLINGS = [undefined, 'false', 'TRUE', '1', 'true ', '']
/** 1. Flag off (any spelling but the exact string "true", or no Studio shell): the same element tree and markup as the base. */
function flagOffIdentity(source) {
  const problems = []
  const ChatInput = loadChatInput(source)
  const check = (label, shell, flag) => {
    for (const [name, hashes] of Object.entries(identityHashes(ChatInput, { shell, flag }))) {
      for (const hash of hashes) if (hash !== GOLDEN[goldenKey(name, shell)]) problems.push(`${label}: ${name}`)
    }
  }
  for (const flag of FLAG_OFF_SPELLINGS) for (const shell of ['true', 'false']) check(`flag ${JSON.stringify(flag)} shell ${shell}`, shell, flag)
  // The flag is read only with the Studio shell: any shell value but the exact string "true", with the flag on, changes nothing.
  for (const shell of ['false', undefined, 'TRUE']) check(`flag on, shell ${JSON.stringify(shell)}`, shell, 'true')
  return problems
}
/** 2. Flag on: the idle placeholder is the new wording, every other placeholder is the base's, and nothing else differs. */
function flagOnWording(source) {
  const problems = []
  const ChatInput = loadChatInput(source)
  for (const [name, make] of Object.entries(STATES)) {
    for (const deckOpen of DECK_VALUES) {
      const props = makeProps({ ...make(), ...(deckOpen === undefined ? {} : { deckOpen }) })
      setFlags({ shell: 'true', flag: undefined })
      const off = treeOf(ChatInput, props)
      setFlags({ shell: 'true', flag: 'true' })
      const on = treeOf(ChatInput, props)
      const offPlaceholder = textarea(off).props.placeholder, onPlaceholder = textarea(on).props.placeholder
      const expected = IDLE_STATES.includes(name) ? (deckOpen === true ? COPY_DECK : COPY_NO_DECK) : offPlaceholder
      if (onPlaceholder !== expected) problems.push(`${name} deckOpen=${deckOpen}: placeholder is ${JSON.stringify(onPlaceholder)}, expected ${JSON.stringify(expected)}`)
      if (IDLE_STATES.includes(name) && offPlaceholder !== BASE_IDLE) problems.push(`${name}: flag-off idle placeholder is ${JSON.stringify(offPlaceholder)}`)
      // Placeholder text only: tree and markup are otherwise the same.
      if (ser(on, { skipPlaceholder: true }) !== ser(off, { skipPlaceholder: true })) problems.push(`${name} deckOpen=${deckOpen}: the element tree differs beyond the placeholder`)
      const strip = html => html.replace(/ placeholder="[^"]*"/, ' placeholder=""')
      if (strip(markupOf(on)) !== strip(markupOf(off))) problems.push(`${name} deckOpen=${deckOpen}: the markup differs beyond the placeholder`)
      // The accessible name stays "Message Director" (Studio), which the captures and assistive tech find the composer by.
      if (textarea(on).props['aria-label'] !== 'Message Director') problems.push(`${name}: aria-label is ${JSON.stringify(textarea(on).props['aria-label'])}`)
    }
  }
  return problems
}
/** 3. Handlers: the same calls with the same arguments, flag on or off. */
function handlerLog(ChatInput, flag, deckOpen) {
  setFlags({ shell: 'true', flag })
  const log = []
  const props = makeProps({
    inputMessage: 'Make the title shorter', deckOpen, onSubmit: (...args) => log.push(['submit', args.length, args[0]?.type ?? null]),
    onInputChange: value => log.push(['change', value]), onStopAwaiting: () => log.push(['stop']), onCancelAction: () => log.push(['cancel']),
  })
  const key = (tree, k, extra = {}) => { const area = textarea(tree); area.props.onKeyDown({ key: k, shiftKey: false, preventDefault: () => log.push(['preventDefault', k]), ...extra }) }
  let tree = treeOf(ChatInput, props)
  const area = textarea(tree)
  area.props.onChange({ target: { value: 'typed' } })
  key(tree, 'Enter'); key(tree, 'Enter', { shiftKey: true }); key(tree, 'Escape'); key(tree, 'a')
  flat(tree).find(node => node.type === 'form').props.onSubmit({ type: 'submit', preventDefault: () => log.push(['preventDefault', 'form']) })
  log.push(['disabled', area.props.disabled])
  tree = treeOf(ChatInput, { ...props, awaitingReply: true })
  key(tree, 'Enter'); key(tree, 'Escape')
  flat(tree).find(node => node.type === 'form').props.onSubmit({ type: 'submit', preventDefault: () => log.push(['preventDefault', 'form']) })
  tree = treeOf(ChatInput, { ...props, pendingActionInput: pending })
  key(tree, 'Escape')
  return log
}
function handlersUnchanged(source) {
  const problems = []
  const ChatInput = loadChatInput(source)
  for (const deckOpen of [undefined, false, true]) {
    const off = handlerLog(ChatInput, undefined, deckOpen), on = handlerLog(ChatInput, 'true', deckOpen)
    if (JSON.stringify(off) !== JSON.stringify(on)) problems.push(`deckOpen=${deckOpen}: handler calls differ`)
    if (!off.some(entry => entry[0] === 'submit')) problems.push('no submit happened')
  }
  return problems
}

// ---- 1-3. on the real source ----------------------------------------------------------------------------------------------------------
const source = read(CHAT_INPUT)
{
  const ChatInput = loadChatInput(source)
  setFlags({ shell: 'true', flag: undefined })
  assert.equal(placeholderOf(ChatInput, makeProps()), BASE_IDLE, 'the hashed tree holds the base idle placeholder')
  assert.equal(placeholderOf(ChatInput, makeProps({ deckOpen: true })), BASE_IDLE, 'flag off ignores deckOpen')
  assert.ok(Object.keys(GOLDEN).length === Object.keys(STATES).length * 2, 'a golden hash per state and shell value')
}
assert.deepEqual(flagOffIdentity(source), [], 'flag off renders exactly as the base')
assert.deepEqual(flagOnWording(source), [], 'flag on changes the idle placeholder and nothing else')
assert.deepEqual(handlersUnchanged(source), [], 'send, keys, change and cancel are unchanged')
{
  // Spot-check the wording against the literal strings (not only against the helper that built the expectations).
  const ChatInput = loadChatInput(source)
  setFlags({ shell: 'true', flag: 'true' })
  assert.equal(placeholderOf(ChatInput, makeProps({ deckOpen: true })), 'Ask for a change, or describe a new deck…')
  assert.equal(placeholderOf(ChatInput, makeProps({ deckOpen: false })), 'What would you like to present?')
  assert.equal(placeholderOf(ChatInput, makeProps()), 'What would you like to present?', 'no deck information means no deck')
  assert.equal(placeholderOf(ChatInput, makeProps({ user: null, deckOpen: true })), 'Authenticating...')
  assert.equal(placeholderOf(ChatInput, makeProps({ isLoadingSession: true, deckOpen: true })), 'Loading...')
  assert.equal(placeholderOf(ChatInput, makeProps({ connected: false, connecting: false })), 'Disconnected - send to reconnect')
  assert.equal(placeholderOf(ChatInput, makeProps({ connected: false, connecting: true })), 'Connecting...')
  assert.equal(placeholderOf(ChatInput, makeProps({ isTemplateReuseRunning: true })), 'Director is working...')
  assert.equal(placeholderOf(ChatInput, makeProps({ awaitingReply: true })), 'Director is replying… (Esc to type anyway)')
  assert.equal(placeholderOf(ChatInput, makeProps({ pendingActionInput: pending })), 'Type your changes... (ESC to cancel)')
}

// ---- 4. wiring: the page passes one boolean, derived the way the transcript derives "a deck is open" -----------------------------------
{
  const page = read('app/builder/page.tsx')
  const decl = /  const studioComposerDeckOpen = (studioShell && process\.env\.NEXT_PUBLIC_STUDIO_COMPOSER_COPY === 'true'\n    \? (Boolean\(effectivePresentationUrl && \(!isBlankPresentation \|\| \(slideStructure\?\.slides \?\? \[\]\)\.length > 0\)\))\n    : undefined)\n/.exec(page)
  assert.ok(decl, 'one named, flag-gated deck-open boolean in the page')
  assert.equal((page.match(/studioComposerDeckOpen/g) || []).length, 2, 'declared once, passed once')
  assert.equal((page.match(/\n\s+deckOpen=\{studioComposerDeckOpen\}\n/g) || []).length, 1, 'passed to the composer as deckOpen')
  assert.equal((page.match(/<ChatInput\b/g) || []).length, 1)
  // Same predicate as the transcript's presentationContext, so the placeholder and the transcript agree on "deck open".
  const inner = '(effectivePresentationUrl && (!isBlankPresentation || (slideStructure?.slides ?? []).length > 0))'
  assert.ok(page.includes(`presentationContext={studioShell && ${inner.slice(1, -1)} ? {`), 'MessageList asks the same question')
  const fn = new Function('studioShell', 'effectivePresentationUrl', 'isBlankPresentation', 'slideStructure', 'process', `return ${decl[1]}`)
  const slides = [{ title: 'Opening' }]
  const ask = (flag, over) => fn(...Object.values({ studioShell: true, effectivePresentationUrl: 'https://viewer.example/p/1', isBlankPresentation: false, slideStructure: { slides }, ...over }), { env: { NEXT_PUBLIC_STUDIO_COMPOSER_COPY: flag } })
  assert.equal(ask(undefined, {}), undefined, 'flag unset: undefined, nothing computed')
  assert.equal(ask('false', {}), undefined)
  assert.equal(ask('TRUE', {}), undefined)
  assert.equal(ask('true', { studioShell: false }), undefined, 'outside the Studio shell')
  assert.equal(ask('true', {}), true, 'a presentation with slides')
  assert.equal(ask('true', { slideStructure: null }), true, 'a restored deck whose slide structure is not cached is still a deck')
  assert.equal(ask('true', { effectivePresentationUrl: null }), false, 'no presentation')
  assert.equal(ask('true', { effectivePresentationUrl: '' }), false)
  assert.equal(ask('true', { isBlankPresentation: true, slideStructure: { slides: [] } }), false, 'the new-session blank canvas is not a deck yet')
  assert.equal(ask('true', { isBlankPresentation: true, slideStructure: null }), false)
  assert.equal(ask('true', { isBlankPresentation: true }), true, 'a blank canvas the person has added slides to')
}

// ---- 5. mutation check: each guard fails for the mistake it guards against ------------------------------------------------------------
{
  const mutate = (from, to) => { assert.equal(source.split(from).length - 1, 1, `mutation anchor appears once: ${from.slice(0, 60)}`); return source.replace(from, to) }
  const flagGuard = "studio && process.env.NEXT_PUBLIC_STUDIO_COMPOSER_COPY === 'true'"
  const mutants = [
    ['flag guard dropped (copy always on)', mutate(flagGuard, 'studio'), flagOffIdentity],
    ['flag read as "not false" (unset counts as on)', mutate("process.env.NEXT_PUBLIC_STUDIO_COMPOSER_COPY === 'true'", "process.env.NEXT_PUBLIC_STUDIO_COMPOSER_COPY !== 'false'"), flagOffIdentity],
    ['flag read loosely (any set value counts as on)', mutate("process.env.NEXT_PUBLIC_STUDIO_COMPOSER_COPY === 'true'", 'Boolean(process.env.NEXT_PUBLIC_STUDIO_COMPOSER_COPY)'), flagOffIdentity],
    ['Studio shell requirement dropped', mutate(flagGuard, "process.env.NEXT_PUBLIC_STUDIO_COMPOSER_COPY === 'true'"), flagOffIdentity],
    ['base idle placeholder changed with the flag off', mutate('                        : "Message Director..."', '                        : "Message Director…"'), flagOffIdentity],
    ['an unrelated state wording touched', mutate('? "Connecting..."', '? "Connecting…"'), flagOffIdentity],
    ['the two wordings swapped', mutate('(deckOpen ? "Ask for a change, or describe a new deck…" : "What would you like to present?")', '(deckOpen ? "What would you like to present?" : "Ask for a change, or describe a new deck…")'), flagOnWording],
    ['deckOpen ignored', mutate('(deckOpen ? "Ask for a change, or describe a new deck…" : "What would you like to present?")', '"What would you like to present?"'), flagOnWording],
    ['new wording leaks into the connecting state', mutate('? "Connecting..."', '? (studioComposerCopy ? "What would you like to present?" : "Connecting...")'), flagOnWording],
    ['accessible name changed', mutate('aria-label={studio ? "Message Director" : undefined}', 'aria-label={studio ? "Message" : undefined}'), flagOnWording],
    ['an extra attribute added to the textarea with the flag on', mutate('data-studio-v4-type-role="prompt"\n            ref=', 'data-studio-v4-type-role="prompt" data-copy={studioComposerCopy ? "1" : undefined}\n            ref='), flagOnWording],
    ['send fires twice', mutate('    onSubmit(e)\n  }', '    onSubmit(e)\n    if (studioComposerCopy) onSubmit(e)\n  }'), handlersUnchanged],
    ['Enter no longer sends with the flag on', mutate("                guardedSubmit()\n              }", "                if (!studioComposerCopy) guardedSubmit()\n              }"), handlersUnchanged],
  ]
  for (const [name, mutant, check] of mutants) {
    assert.notEqual(mutant, source, `${name}: the mutation changed the source`)
    assert.ok(check(mutant).length > 0, `mutation check: "${name}" must be caught by ${check.name}`)
  }
  console.log(`mutation check: ${mutants.length} mutants, each caught`)
}

// ---- 6. nothing else changed: flag documented, script registered, flag read only where intended --------------------------------------
{
  assert.match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_COMPOSER_COPY="false"$/m, 'documented, default off')
  assert.equal(JSON.parse(read('package.json')).scripts['test:studio-composer-copy'], 'node scripts/test-studio-composer-copy.mjs')
  const readers = []
  const walk = dir => { for (const entry of fs.readdirSync(path.join(treeRoot, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name)
    if (entry.isDirectory()) { if (!['node_modules', '.next', 'scripts'].includes(entry.name)) walk(rel) }
    else if (/\.(tsx?|css)$/.test(entry.name) && read(rel).includes(FLAG)) readers.push(rel)
  } }
  for (const dir of ['app', 'components', 'hooks', 'lib']) walk(dir)
  assert.deepEqual(readers.sort(), ['app/builder/page.tsx', CHAT_INPUT], 'the flag is read in the page and the composer only')
  // The composer change adds no request, socket, storage or timer.
  const added = source.split('\n').filter(line => /studioComposerCopy|deckOpen/.test(line)).join('\n')
  assert.doesNotMatch(added, /\b(fetch|WebSocket|XMLHttpRequest|localStorage|sessionStorage|sendBeacon|setTimeout|setInterval)\b/)
}
console.log(`Studio composer copy passed: flag off equals the base for ${Object.keys(STATES).length} composer states x 2 shell values x 3 deckOpen values x ${FLAG_OFF_SPELLINGS.length} flag spellings (element tree + markup), flag on changes only the idle placeholder ("${COPY_DECK}" with a deck open, "${COPY_NO_DECK}" otherwise), handlers and accessible name are unchanged, and each guard fails its mutant.`)
