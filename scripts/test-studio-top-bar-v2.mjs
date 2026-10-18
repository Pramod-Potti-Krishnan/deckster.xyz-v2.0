// PASS2-PK-FOUR #1 (frontend-2): the Studio builder top bar as in the accepted v4 mockup.
// Flag NEXT_PUBLIC_STUDIO_TOP_BAR_V2 (exact "true", Studio shell only), default off. Flag off must render the top bar exactly as
// the base did.
// Run: node scripts/test-studio-top-bar-v2.mjs   (plain node: transpile + vm, no network, no React runtime)
//   PRINT_GOLDEN=1 node scripts/test-studio-top-bar-v2.mjs   re-prints the flag-off goldens (run a copy of this file in a pristine
//   checkout of the base: origin/studio-v4-dev-preparation-code at 5cc455d, before this change).
//
// The proof is made on the REAL source: the BuilderHeader component, the PresentationDownloadControls component and the Publish
// trigger are cut out of their files by AST and evaluated with a tiny JSX runtime, so a later edit is tested, not a copy. The
// same checks are then run against in-memory mutants of the change, each of which must be caught.
//
// FRONTEND-2 fix-forward (fe2/fix-topbar-saved-unsaved): "Saved" also needs a history row. With NEXT_PUBLIC_STUDIO_SESSION_HYGIENE a bare
// /builder is an unsaved local session (no row until the first real action) whose blank deck the viewer already calls "saved", so the
// top bar claimed a save that had not happened. Saved now shows only when the viewer says saved AND the Builder's own isUnsavedSession
// flag (the one the hygiene hooks use) is false; hygiene off, or TOP_BAR_V2 off, is exactly as before.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import postcss from 'postcss'
import { stripP2Publish } from './studio-p2-publish-strip.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = file => fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file), 'utf8') : null
const FILES = {
  header: 'components/builder/builder-header.tsx',
  download: 'components/presentation-download-controls.tsx',
  publish: 'components/publish-dialog.tsx',
  viewer: 'components/presentation-viewer.tsx',
  page: 'app/builder/page.tsx',
  hygiene: 'lib/studio-session-hygiene.ts',
  lib: 'lib/studio-top-bar-v2.ts',
  css: 'components/builder/studio-top-bar-v2.css',
}
const FLAG = 'NEXT_PUBLIC_STUDIO_TOP_BAR_V2'
const SHELL = 'NEXT_PUBLIC_STUDIO_V4_SHELL'
const HYGIENE = 'NEXT_PUBLIC_STUDIO_SESSION_HYGIENE'
const ORIGINAL = Object.fromEntries(Object.entries(FILES).map(([key, file]) => [key, read(file)]))

// ---- tiny JSX "runtime": elements become {type, props, children}; components stay unexpanded (their name is the type) ------
const FRAGMENT = '__Fragment'
const jsx = (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) })
const JSX_OPTIONS = { jsx: ts.JsxEmit.React, jsxFactory: '__jsx', jsxFragmentFactory: FRAGMENT, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
function serialise(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(serialise).join('')
  if (node.type === FRAGMENT) return serialise(node.children)
  const attrs = Object.keys(node.props).sort().map(key => typeof node.props[key] === 'function' ? `${key}=<fn>` : `${key}=${JSON.stringify(node.props[key])}`)
  return `<${String(node.type)}${attrs.length ? ' ' + attrs.join(' ') : ''}>${serialise(node.children)}</${String(node.type)}>`
}
const textOf = node => {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  return textOf(node.children)
}
const findAll = (node, predicate, found = []) => {
  if (node === null || node === undefined || typeof node !== 'object') return found
  if (Array.isArray(node)) { node.forEach(child => findAll(child, predicate, found)); return found }
  if (predicate(node)) found.push(node)
  findAll(node.children, predicate, found)
  return found
}
// the element children of a node, with fragments flattened and false/null/'' dropped (what React would put in the DOM)
const elementsOf = node => node.children.flat(Infinity).flatMap(child =>
  child && typeof child === 'object' ? (child.type === FRAGMENT ? elementsOf(child) : [child]) : (typeof child === 'string' && child ? [child] : []))
const sha = text => crypto.createHash('sha256').update(text).digest('hex')

// ---- cutting real source ------------------------------------------------------------------------------------------------
const parsed = new Map()
function parse(file, text) {
  const key = `${file}\n${text}`
  if (!parsed.has(key)) parsed.set(key, ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX))
  return parsed.get(key)
}
function find(node, predicate) {
  if (predicate(node)) return node
  let match
  ts.forEachChild(node, child => { if (!match) match = find(child, predicate) })
  return match
}
function findEvery(node, predicate, found = []) {
  if (predicate(node)) found.push(node)
  ts.forEachChild(node, child => { findEvery(child, predicate, found) })
  return found
}
// Compile one expression of the real source, then run it against a scope. Free capitalised names (icons, UI parts) resolve to
// name-only stubs; everything else must come from `scope`, or the run fails loudly.
const compiled = new Map()
const context = vm.createContext({ __scope: null, console })
function compile(expressionText) {
  if (compiled.has(expressionText)) return compiled.get(expressionText)
  const js = ts.transpileModule(`(${expressionText});`, { compilerOptions: JSX_OPTIONS, fileName: 'expression.tsx' }).outputText
  const script = new vm.Script(`with (__scope) { ${js} }`)
  const evaluate = scope => {
    context.__scope = new Proxy(scope, {
      has: (target, key) => typeof key === 'string' && (key in target || (/^[A-Z]/.test(key) && !(key in globalThis))),
      get: (target, key) => key === Symbol.unscopables ? undefined : key in target ? target[key] : String(key),
    })
    return script.runInContext(context)
  }
  compiled.set(expressionText, evaluate)
  return evaluate
}
// Top-level `const X = <expr>` declarations of a module, evaluated in order into the scope (the module's own constants).
function moduleConstants(sourceFile, scope, names = null) {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      const name = declaration.name.getText(sourceFile)
      if (names && !names.includes(name)) continue
      if (declaration.initializer) scope[name] = compile(declaration.initializer.getText(sourceFile))(scope)
    }
  }
  return scope
}
const functionText = (sourceFile, name) => {
  const node = find(sourceFile, n => ts.isFunctionDeclaration(n) && n.name && n.name.text === name)
  assert.ok(node, `function ${name} exists`)
  return node.getText(sourceFile).replace(/^export\s+/, '')
}
// The lib's flag constant for an env (undefined when the lib does not exist, as in the base).
function topBarEnabled(src, env) {
  if (!src.lib) return undefined
  const sourceFile = parse(FILES.lib, src.lib)
  return moduleConstants(sourceFile, { process: { env } }, ['STUDIO_TOP_BAR_V2_ENABLED']).STUDIO_TOP_BAR_V2_ENABLED
}
// The session-hygiene lib's flag constant for an env (the header reads this one, never the env directly).
function hygieneEnabled(src, env) {
  const sourceFile = parse(FILES.hygiene, src.hygiene)
  return moduleConstants(sourceFile, { process: { env } }, ['STUDIO_SESSION_HYGIENE_ENABLED']).STUDIO_SESSION_HYGIENE_ENABLED
}
function libModule(src) {
  const js = ts.transpileModule(src.lib, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  vm.runInNewContext(js, { module, exports: module.exports, process: { env: {} } })
  return module.exports
}

// ---- the header ---------------------------------------------------------------------------------------------------------
const recorder = () => { const calls = []; const make = name => { const fn = (...args) => { calls.push(name) }; Object.defineProperty(fn, 'name', { value: name }); return fn }; return { calls, make } }
function renderHeader(src, cell) {
  const { env = {}, isDark = false, isChatHistoryOpen = false, deckTitle, wsError = null, deckIdentity = false, saveState = null, isUnsavedSession } = cell
  const sourceFile = parse(FILES.header, src.header)
  const rec = recorder()
  const scope = {
    __jsx: jsx, [FRAGMENT]: FRAGMENT, process: { env },
    React: { useRef: () => ({ current: null }), useEffect: () => {}, useSyncExternalStore: (subscribe, getSnapshot) => { subscribe(() => {}); return getSnapshot() } },
    useTheme: () => ({ resolvedTheme: isDark ? 'dark' : 'light' }),
    isDeckIdentityEnabled: () => deckIdentity,
    STUDIO_TOP_BAR_V2_ENABLED: topBarEnabled(src, env),
    STUDIO_SESSION_HYGIENE_ENABLED: hygieneEnabled(src, env),
    getStudioDeckSaveState: () => saveState,
    subscribeStudioDeckSaveState: () => () => {},
    studioTopBarSavedLabel: src.lib ? libModule(src).studioTopBarSavedLabel : undefined,
    // PASS2B G56 (00cb07f, NEXT_PUBLIC_STUDIO_CREATE_WORD, default off): the create-button helper; off it returns the call site's own word.
    studioCreateLabel: (unified, original) => unified === true ? 'New deck' : original,
  }
  moduleConstants(sourceFile, scope)
  const props = { wsError, onNewPresentation: rec.make('onNewPresentation'), onOpenChatHistory: rec.make('onOpenChatHistory'), isChatHistoryOpen,
    toolbarSlotRef: rec.make('toolbarSlotRef'), onToolbarInteract: rec.make('onToolbarInteract') }
  if (deckTitle !== undefined) props.deckTitle = deckTitle
  if (isUnsavedSession !== undefined) props.isUnsavedSession = isUnsavedSession
  const component = compile(functionText(sourceFile, 'BuilderHeader'))(scope)
  return { tree: component(props), props, calls: rec.calls }
}

// ---- the download (Export) control -------------------------------------------------------------------------------------
function renderDownload(src, cell) {
  const { env = {}, presentationUrl = 'https://layout.invalid/p/deck', presentationId = 'deck', stage = 6, slideCount = 7, downloading = 'none', feedback = null } = cell
  const sourceFile = parse(FILES.download, src.download)
  const states = [downloading === 'pdf', downloading === 'pptx', 'high', feedback, null]
  let call = 0
  const scope = {
    __jsx: jsx, [FRAGMENT]: FRAGMENT, process: { env }, document: { fullscreenElement: null },
    useState: initial => [call < states.length ? states[call++] : initial, () => {}],
    useToast: () => ({ toast: () => {} }),
    STUDIO_TOP_BAR_V2_ENABLED: topBarEnabled(src, env),
    // PASS2B G16 (9a9f0e4, NEXT_PUBLIC_STUDIO_EXPORT_AFTER_BUILD, default off): the export gate; off it never blocks (null).
    studioExportBlockedReason: () => null,
  }
  moduleConstants(sourceFile, scope)
  const component = compile(functionText(sourceFile, 'PresentationDownloadControls'))(scope)
  return component({ presentationUrl, presentationId, slideCount, stage })
}

// ---- the Publish trigger --------------------------------------------------------------------------------------------------
function renderPublishTrigger(src, cell) {
  const { env = {}, sessionId = 's1', enabled = true, publishedSlideCount = null, slideCount = 7 } = cell
  const sourceFile = parse(FILES.publish, src.publish)
  const trigger = find(sourceFile, n => ts.isJsxElement(n) && n.openingElement.attributes.properties.some(a => ts.isJsxAttribute(a) && a.name.getText(sourceFile) === 'data-studio-publish-trigger'))
  assert.ok(trigger, 'the Publish trigger exists')
  const scope = {
    __jsx: jsx, [FRAGMENT]: FRAGMENT, process: { env }, STUDIO_TOP_BAR_V2_ENABLED: topBarEnabled(src, env),
    publishTriggerRef: { current: null }, sessionId, setOpen: function setOpen() {}, enabled, publishedSlideCount, slideCount,
    slideCountDrifted: publishedSlideCount !== null && typeof slideCount === 'number' && slideCount > 0 && publishedSlideCount !== slideCount,
  }
  moduleConstants(sourceFile, scope, ['STUDIO_PUBLISH', 'STUDIO_TOP_BAR_GLOBE', 'plural'])
  return compile(trigger.getText(sourceFile))(scope)
}

// ---- matrices -------------------------------------------------------------------------------------------------------------
const BOOLS = [false, true]
const product = axes => Object.entries(axes).reduce((cells, [key, values]) => cells.flatMap(cell => values.map(value => ({ ...cell, [key]: value }))), [{}])
const baseEnv = cell => ({ ...(cell.shell ? { [SHELL]: 'true' } : {}), ...(cell.labels ? { NEXT_PUBLIC_STUDIO_V4_LABELS: 'true' } : {}), ...(cell.tokens ? { NEXT_PUBLIC_STUDIO_V4_TOKENS: 'true' } : {}) })
const HEADER_MATRIX = product({ shell: BOOLS, labels: BOOLS, tokens: BOOLS, isDark: BOOLS, isChatHistoryOpen: BOOLS, deckTitle: [undefined, '', 'AI-driven demand forecasting for retail'],
  wsError: [null, { message: 'Connection lost' }], deckIdentity: BOOLS, saveState: ['saved', 'saving', 'unsaved', 'error', null] })
const FEEDBACK = { none: null, converting: { sourceUrl: 'https://layout.invalid/p/deck', sourceId: 'deck', format: 'PDF', status: 'converting', message: 'Preparing your PDF…' },
  started: { sourceUrl: 'https://layout.invalid/p/deck', sourceId: 'deck', format: 'PowerPoint', status: 'started', message: 'Your browser download has started.' },
  failed: { sourceUrl: 'https://layout.invalid/p/deck', sourceId: 'deck', format: 'PDF', status: 'failed', message: 'Failed to download PDF' },
  otherDeck: { sourceUrl: 'https://layout.invalid/p/other', sourceId: 'other', format: 'PDF', status: 'failed', message: 'x' } }
const DOWNLOAD_MATRIX = product({ shell: BOOLS, presentationUrl: [null, 'https://layout.invalid/p/deck'], stage: [0, 4, 6], downloading: ['none', 'pdf', 'pptx'],
  feedback: Object.keys(FEEDBACK), slideCount: [null, 7] })
const PUBLISH_MATRIX = product({ shell: BOOLS, sessionId: [null, 's1'], enabled: BOOLS, publishedSlideCount: [null, 7, 5], slideCount: [null, 7] })
const withFlag = (env, flag) => flag === undefined ? env : { ...env, [FLAG]: flag }
// `extra`: { hygiene, isUnsavedSession } layered on every cell (the session state the fix reads; not given: as the base, which never passed it)
const headerDigest = (src, flag, extra = {}) => sha(HEADER_MATRIX.map(cell => sha(serialise(renderHeader(src, {
  ...cell, ...(extra.isUnsavedSession === undefined ? {} : { isUnsavedSession: extra.isUnsavedSession }),
  env: { ...withFlag(baseEnv(cell), flag), ...(extra.hygiene ? { [HYGIENE]: 'true' } : {}) } }).tree))).join('\n'))
const downloadDigest = (src, flag) => sha(DOWNLOAD_MATRIX.map(cell => sha(serialise(renderDownload(src, { ...cell, feedback: FEEDBACK[cell.feedback], env: withFlag(baseEnv(cell), flag) })))).join('\n'))
const publishDigest = (src, flag) => sha(PUBLISH_MATRIX.map(cell => sha(serialise(renderPublishTrigger(src, { ...cell, env: withFlag(baseEnv(cell), flag) })))).join('\n'))

// The flag-off goldens: digests of the per-cell render hashes over the full matrices (header 1920 cells, Export 360, Publish 48),
// captured from the base (origin/studio-v4-dev-preparation-code at 5cc455d, before this change) with the flag unset.
const GOLDEN = {
  header: 'b06ac5d6bbd60199a24e5710f23f6aee168f17af4be6b8ee8f909ce4c34370e8',
  download: 'b3434ae1372c93034ff8435dd1e1049ed8b57e4048b8e798c3704215e0080118',
  publish: 'f1f88672f05cb5a459934b320640ba8b6649e30ece44b9edd2f1051ad97e6a89',
}

if (process.env.PRINT_GOLDEN) {
  console.log(JSON.stringify({ header: headerDigest(ORIGINAL, undefined), download: downloadDigest(ORIGINAL, undefined), publish: publishDigest(ORIGINAL, undefined),
    cells: { header: HEADER_MATRIX.length, download: DOWNLOAD_MATRIX.length, publish: PUBLISH_MATRIX.length } }, null, 2))
  process.exit(0)
}

// ---- the checks, as functions of the source texts (so the mutants below can be run through the same checks) ----------------
const OFF_VALUES = [undefined, '', 'false', '0', '1', 'TRUE', 'True', ' true', 'true ', 'yes']
const OFF_DIGEST_VALUES = [undefined, 'false', 'TRUE', 'true ']
const SHELL_ON = { [SHELL]: 'true' }
const ON = { ...SHELL_ON, [FLAG]: 'true' }
const DECK = 'AI-driven demand forecasting for retail'
const headingOf = tree => findAll(tree, node => node.props && node.props.className === 'studio-shell-heading')[0]
const actionsOf = tree => findAll(tree, node => node.props && node.props.className === 'studio-shell-header-actions')[0]
const headerOf = tree => findAll(tree, node => node.type === 'header')[0]
const exportTrigger = tree => findAll(tree, node => node.type === 'button')[0]
const menuOf = tree => findAll(tree, node => node.type === 'DropdownMenuContent')[0]

const CHECKS = {
  'the flag is the exact string "true", only in the Studio shell, and defaults off': src => {
    assert.ok(src.lib, 'lib/studio-top-bar-v2.ts exists')
    for (const value of OFF_VALUES) for (const shell of BOOLS) {
      assert.equal(topBarEnabled(src, withFlag(shell ? SHELL_ON : {}, value)), false, `flag=${JSON.stringify(value)} shell=${shell}`)
    }
    assert.equal(topBarEnabled(src, { [FLAG]: 'true' }), false, 'needs the Studio shell')
    assert.equal(topBarEnabled(src, ON), true)
    assert.match(src.lib, /process\.env\.NEXT_PUBLIC_STUDIO_TOP_BAR_V2 === 'true'/)
  },
  'flag on: "Saved" also needs a history row: with session hygiene on, an unsaved session shows no "Saved" in any save state': src => {
    const savedMarkers = (env, saveState, isUnsavedSession) =>
      findAll(renderHeader(src, { env, deckTitle: DECK, saveState, isUnsavedSession }).tree, node => node.props && node.props['data-studio-top-bar-saved']).length
    for (const hygiene of BOOLS) for (const isUnsavedSession of [undefined, false, true]) for (const saveState of ['saved', 'saving', 'unsaved', 'error', null]) {
      const env = { ...ON, ...(hygiene ? { [HYGIENE]: 'true' } : {}) }
      const expected = saveState === 'saved' && !(hygiene && isUnsavedSession === true) ? 1 : 0
      assert.equal(savedMarkers(env, saveState, isUnsavedSession), expected, `hygiene=${hygiene} isUnsavedSession=${isUnsavedSession} saveState=${saveState}`)
    }
    // the bare-/builder case of the bug, spelled out: hygiene on, unsaved session, the viewer calls the blank deck saved -> nothing claimed
    const hygieneOn = { ...ON, [HYGIENE]: 'true' }
    assert.equal(savedMarkers(hygieneOn, 'saved', true), 0)
    assert.doesNotMatch(serialise(renderHeader(src, { env: hygieneOn, deckTitle: DECK, saveState: 'saved', isUnsavedSession: true }).tree), /Saved/)
    // the rest of the bar is untouched by the session state: same tree except the Saved status
    const strip = tree => serialise(tree).replace(/<span data-studio-top-bar-saved="true" role="status">.*?<\/span>/, '')
    assert.equal(strip(renderHeader(src, { env: hygieneOn, deckTitle: DECK, saveState: 'saved', isUnsavedSession: true }).tree),
      strip(renderHeader(src, { env: hygieneOn, deckTitle: DECK, saveState: 'saved', isUnsavedSession: false }).tree))
  },
  'flag on: after the first action writes the row (isUnsavedSession turns false), "Saved" shows when the viewer says saved, and not before': src => {
    const hygieneOn = { ...ON, [HYGIENE]: 'true' }
    const saved = (saveState, isUnsavedSession) => findAll(renderHeader(src, { env: hygieneOn, deckTitle: DECK, saveState, isUnsavedSession }).tree, node => node.props && node.props['data-studio-top-bar-saved']).length
    // bare /builder -> first message / upload / theme pick / manual Add Slide: the viewer's state is 'saved' throughout; the row decides
    assert.deepEqual([saved('saved', true), saved('saved', true), saved('saved', false)], [0, 0, 1])
    // a deck that is saving right after the row exists still claims nothing; it says Saved once the viewer does
    assert.deepEqual([saved('saving', false), saved('saved', false)], [0, 1])
    // a saved session (opened from the sidebar) keeps its Saved
    assert.equal(saved('saved', false), 1)
  },
  'session hygiene off (unset or any non-"true" value): "Saved" is exactly as today even for an unsaved session': src => {
    for (const value of OFF_VALUES.filter(v => v !== undefined)) for (const isUnsavedSession of [undefined, false, true]) {
      const env = { ...ON, [HYGIENE]: value }
      assert.equal(hygieneEnabled(src, env), false, `hygiene=${JSON.stringify(value)}`)
      const saved = findAll(renderHeader(src, { env, deckTitle: DECK, saveState: 'saved', isUnsavedSession }).tree, node => node.props && node.props['data-studio-top-bar-saved'])
      assert.equal(saved.length, 1, `hygiene=${JSON.stringify(value)} isUnsavedSession=${isUnsavedSession}`)
    }
    assert.equal(hygieneEnabled(src, { ...ON, [HYGIENE]: 'true' }), true)
    // the unsaved-aware label has the same default as the old one-argument call
    const lib = libModule(src)
    assert.equal(lib.studioTopBarSavedLabel('saved'), 'Saved')
    assert.equal(lib.studioTopBarSavedLabel('saved', false), 'Saved')
    assert.equal(lib.studioTopBarSavedLabel('saved', true), null)
    assert.deepEqual(['saving', 'unsaved', 'error', null].map(state => lib.studioTopBarSavedLabel(state, false)), [null, null, null, null])
  },
  'the Builder page hands the header its own unsaved-session flag: the same state the first-action row save is given': src => {
    const sourceFile = parse(FILES.page, src.page)
    const headers = findEvery(sourceFile, n => ts.isJsxSelfClosingElement(n) && n.tagName.getText(sourceFile) === 'BuilderHeader')
    assert.equal(headers.length, 1, 'one BuilderHeader')
    const attrs = headers[0].attributes.properties.filter(a => ts.isJsxAttribute(a) && a.name.getText(sourceFile) === 'isUnsavedSession')
    assert.equal(attrs.length, 1, 'the header gets isUnsavedSession')
    assert.equal(attrs[0].initializer.expression.getText(sourceFile), 'isUnsavedSession', 'the page state itself, not a copy or a constant')
    const saves = findEvery(sourceFile, n => ts.isCallExpression(n) && n.expression.getText(sourceFile) === 'useSaveSessionOnFirstAction')
    assert.equal(saves.length, 1)
    const given = saves[0].arguments[0].properties.find(p => p.name.getText(sourceFile) === 'isUnsavedSession')
    assert.ok(given && ts.isShorthandPropertyAssignment(given), 'the first-action save reads the same variable')
    const states = findEvery(sourceFile, n => ts.isVariableDeclaration(n) && n.name.getText(sourceFile).startsWith('[isUnsavedSession,'))
    assert.equal(states.length, 1, 'one isUnsavedSession state in the page')
    // the header reads the hygiene flag only through the hygiene lib
    assert.match(src.header, /import \{ STUDIO_SESSION_HYGIENE_ENABLED \} from "@\/lib\/studio-session-hygiene"/)
    assert.doesNotMatch(src.header, /process\.env\.NEXT_PUBLIC_STUDIO_SESSION_HYGIENE/)
  },
  'flag off (unset, "false" or any non-"true" value): the header renders byte-for-byte as the base, over 1920 states': src => {
    for (const value of OFF_DIGEST_VALUES) assert.equal(headerDigest(src, value), GOLDEN.header, `flag=${JSON.stringify(value)}`)
  },
  'flag off: the Download control renders byte-for-byte as the base, over 360 states': src => {
    for (const value of OFF_DIGEST_VALUES) assert.equal(downloadDigest(src, value), GOLDEN.download, `flag=${JSON.stringify(value)}`)
  },
  'flag off: the Publish trigger renders byte-for-byte as the base, over 48 states': src => {
    for (const value of OFF_DIGEST_VALUES) assert.equal(publishDigest(src, value), GOLDEN.publish, `flag=${JSON.stringify(value)}`)
  },
  'flag on outside the Studio shell (classic builder): header, Download and Publish are the base, in every state': src => {
    const classic = { [FLAG]: 'true' }
    const headerCells = HEADER_MATRIX.filter(cell => !cell.shell && !cell.labels && !cell.tokens)
    for (const cell of headerCells) assert.equal(serialise(renderHeader(src, { ...cell, env: classic }).tree), serialise(renderHeader(src, { ...cell, env: {} }).tree))
    for (const cell of DOWNLOAD_MATRIX.filter(c => !c.shell)) {
      const c = { ...cell, feedback: FEEDBACK[cell.feedback] }
      assert.equal(serialise(renderDownload(src, { ...c, env: classic })), serialise(renderDownload(src, { ...c, env: {} })))
    }
    for (const cell of PUBLISH_MATRIX.filter(c => !c.shell)) assert.equal(serialise(renderPublishTrigger(src, { ...cell, env: classic })), serialise(renderPublishTrigger(src, { ...cell, env: {} })))
  },
  'TOP_BAR_V2 off: the header is byte-for-byte the base whatever the session state and the hygiene flag, over 1920 states each': src => {
    for (const extra of [{ hygiene: true, isUnsavedSession: true }, { hygiene: true, isUnsavedSession: false }, { hygiene: false, isUnsavedSession: true }]) {
      assert.equal(headerDigest(src, undefined, extra), GOLDEN.header, JSON.stringify(extra))
      assert.equal(headerDigest(src, 'false', extra), GOLDEN.header, `flag "false" ${JSON.stringify(extra)}`)
    }
    // flag on but outside the Studio shell (classic builder): the session state changes nothing either
    for (const cell of HEADER_MATRIX.filter(c => !c.shell && !c.labels && !c.tokens)) {
      const plain = serialise(renderHeader(src, { ...cell, env: { [FLAG]: 'true' } }).tree)
      assert.equal(serialise(renderHeader(src, { ...cell, isUnsavedSession: true, env: { [FLAG]: 'true', [HYGIENE]: 'true' } }).tree), plain)
    }
  },
  'flag on: the header carries the v2 marker; the left reads toggle | Workspace / deck name, Saved': src => {
    const { tree, props } = renderHeader(src, { env: ON, deckTitle: DECK, saveState: 'saved' })
    assert.equal(headerOf(tree).props['data-studio-top-bar-v2'], 'true')
    const items = elementsOf(headingOf(tree))
    assert.deepEqual(items.map(item => typeof item === 'string' ? item : item.type), ['StudioNavigationHint', 'span', 'Link', 'span', 'span', 'span'])
    const [toggle, divider, crumb, separator, deck, saved] = items
    const toggleButton = toggle.children[0]
    assert.equal(toggleButton.props.onClick, props.onOpenChatHistory, 'the toggle keeps its handler')
    assert.equal(toggleButton.props['aria-label'], 'Open deck list')
    assert.equal(divider.props['data-studio-top-bar-divider'], 'true'); assert.equal(divider.props['aria-hidden'], 'true')
    assert.equal(crumb.props.href, '/dashboard'); assert.equal(crumb.props.prefetch, false, 'no prefetch request'); assert.equal(textOf(crumb), 'Workspace'); assert.equal(crumb.props['data-studio-top-bar-crumb'], 'true')
    assert.equal(textOf(separator), '/'); assert.equal(separator.props['aria-hidden'], 'true')
    assert.equal(textOf(deck), DECK); assert.equal(deck.props.title, DECK); assert.equal(deck.props['data-studio-top-bar-deck'], 'true')
    assert.equal(textOf(saved), 'Saved'); assert.equal(saved.props.role, 'status'); assert.equal(saved.children[0].type, 'Check')
    // no undo / redo, no status pill
    assert.doesNotMatch(serialise(tree), /Undo|Redo|Local concept/)
  },
  'flag on: "Saved" shows only when the viewer reports the deck saved, never for saving / unsaved / failed / nothing on stage': src => {
    for (const [saveState, shown] of [['saved', true], ['saving', false], ['unsaved', false], ['error', false], [null, false]]) {
      const saved = findAll(renderHeader(src, { env: ON, deckTitle: DECK, saveState }).tree, node => node.props && node.props['data-studio-top-bar-saved'])
      assert.equal(saved.length, shown ? 1 : 0, `saveState=${saveState}`)
    }
    const lib = libModule(src)
    assert.deepEqual(['saved', 'saving', 'unsaved', 'error', null].map(lib.studioTopBarSavedLabel), ['Saved', null, null, null, null])
  },
  'flag on: the deck name is the one the header always showed (default "Studio")': src => {
    for (const [deckTitle, shown] of [[undefined, 'Studio'], ['', ''], [DECK, DECK]]) {
      const deck = findAll(renderHeader(src, { env: ON, deckTitle }).tree, node => node.props && node.props['data-studio-top-bar-deck'])[0]
      assert.equal(textOf(deck), shown)
    }
  },
  'flag on: "+ New deck" is the "+ Presentation" button renamed: same handler, accessible name matches the label': src => {
    const { tree, props, calls } = renderHeader(src, { env: ON })
    const button = elementsOf(actionsOf(tree))[0]
    assert.equal(button.type, 'Button'); assert.equal(button.props.className, 'studio-shell-new')
    assert.equal(textOf(button), 'New deck'); assert.equal(button.props['aria-label'], 'New deck'); assert.equal(button.props.title, 'New deck')
    assert.equal(button.children[0].type, 'Plus')
    assert.equal(button.props.onClick, props.onNewPresentation)
    button.props.onClick(); assert.deepEqual(calls, ['onNewPresentation'])
    const off = elementsOf(actionsOf(renderHeader(src, { env: SHELL_ON }).tree))[0]
    assert.equal(textOf(off), 'Presentation'); assert.equal(off.props['aria-label'], 'Add presentation')
  },
  'flag on: the delivery slot (Export, Publish) is the same portal target as before, and nothing else on the right changed': src => {
    const on = renderHeader(src, { env: ON }); const off = renderHeader(src, { env: SHELL_ON })
    const slot = tree => elementsOf(actionsOf(tree))[1]
    assert.equal(slot(on.tree).props['data-studio-v4-toolbar-target'], 'true')
    assert.equal(slot(on.tree).props.ref, on.props.toolbarSlotRef)
    assert.equal(serialise(slot(on.tree)), serialise(slot(off.tree)))
    assert.equal(elementsOf(actionsOf(on.tree)).length, 2)
  },
  'flag on: the trigger reads "Export" with a menu chevron; same menu, same PDF / PPTX handlers, same disabled rule': src => {
    for (const cell of DOWNLOAD_MATRIX.filter(c => c.shell)) {
      const c = { ...cell, feedback: FEEDBACK[cell.feedback] }
      const on = renderDownload(src, { ...c, env: ON }); const off = renderDownload(src, { ...c, env: SHELL_ON })
      assert.equal(serialise(menuOf(on)), serialise(menuOf(off)), 'the menu is unchanged')
      const [tOn, tOff] = [exportTrigger(on), exportTrigger(off)]
      assert.equal(tOn.props.disabled, tOff.props.disabled)
      const label = findAll(tOn, node => node.type === 'span')[0]
      assert.equal(textOf(label), cell.downloading === 'none' ? 'Export' : 'Converting')
      const chevron = findAll(tOn, node => node.type === 'ChevronDown')
      assert.equal(chevron.length, 1); assert.equal(chevron[0].props['data-studio-export-chevron'], 'true'); assert.equal(chevron[0].props['aria-hidden'], 'true')
      if (cell.downloading === 'none') assert.match(tOn.props['aria-label'], /^Export /)
    }
    const items = findAll(menuOf(renderDownload(src, { env: ON })), node => node.type === 'DropdownMenuItem')
    assert.deepEqual(items.slice(0, 2).map(item => item.props.onClick.name), ['handleDownloadPDF', 'handleDownloadPPTX'])
    const trigger = exportTrigger(renderDownload(src, { env: ON }))
    assert.equal(trigger.props.title, 'Export as PDF or PPTX')
    assert.equal(exportTrigger(renderDownload(src, { env: ON, presentationUrl: null })).props['aria-label'], 'Export unavailable until presentation is ready')
  },
  'flag on: the Publish trigger is the same button with the mockup globe (Globe2); handler, title, disabled rule unchanged': src => {
    for (const cell of PUBLISH_MATRIX.filter(c => c.shell)) {
      const on = renderPublishTrigger(src, { ...cell, env: ON }); const off = renderPublishTrigger(src, { ...cell, env: SHELL_ON })
      assert.equal(on.children[0].type, 'Globe2'); assert.equal(off.children[0].type, 'Globe')
      assert.equal(serialise({ ...on, children: on.children.slice(1) }), serialise({ ...off, children: off.children.slice(1) }))
      assert.equal(on.props.onClick.toString(), off.props.onClick.toString())
    }
  },
  'the viewer only mirrors its existing save state for the top bar, and only with the flag on': src => {
    const sourceFile = parse(FILES.viewer, src.viewer)
    const effects = findEvery(sourceFile, n => ts.isCallExpression(n) && n.expression.getText(sourceFile) === 'useEffect' && n.getText(sourceFile).includes('publishStudioDeckSaveState'))
    assert.equal(effects.length, 2, 'one effect publishes, one clears on unmount')
    const [publishEffect, clearEffect] = effects
    for (const effect of effects) assert.match(effect.arguments[0].getText(sourceFile), /^\(\) => \{\s*if \(!STUDIO_TOP_BAR_V2_ENABLED \|\| !studioShell\) return\b/)
    assert.equal(publishEffect.arguments[1].getText(sourceFile), '[studioShell, viewerIsReady, isGenerating, studioPartialArtifact, isSaving, saveStatus]')
    const run = (effect, state) => {
      const published = []
      const result = compile(effect.arguments[0].getText(sourceFile))({ ...state, publishStudioDeckSaveState: value => published.push(value) })()
      return { published, result }
    }
    const READY = { studioShell: true, viewerIsReady: true, isGenerating: false, studioPartialArtifact: false, isSaving: false, saveStatus: 'saved' }
    for (const enabled of [false, undefined]) {
      assert.deepEqual(run(publishEffect, { ...READY, STUDIO_TOP_BAR_V2_ENABLED: enabled }).published, [], 'flag off: nothing is published')
      assert.equal(run(clearEffect, { ...READY, STUDIO_TOP_BAR_V2_ENABLED: enabled }).result, undefined)
    }
    assert.deepEqual(run(publishEffect, { ...READY, studioShell: false, STUDIO_TOP_BAR_V2_ENABLED: true }).published, [])
    const on = state => run(publishEffect, { ...READY, ...state, STUDIO_TOP_BAR_V2_ENABLED: true }).published
    assert.deepEqual(on({}), ['saved'])
    assert.deepEqual(on({ saveStatus: 'unsaved' }), ['unsaved'])
    assert.deepEqual(on({ saveStatus: 'error' }), ['error'])
    assert.deepEqual(on({ isSaving: true }), ['saving'])
    assert.deepEqual(on({ viewerIsReady: false }), [null], 'nothing settled on stage')
    assert.deepEqual(on({ isGenerating: true }), [null], 'Director is building')
    assert.deepEqual(on({ studioPartialArtifact: true }), [null], 'a partial deck')
    const cleared = run(clearEffect, { ...READY, STUDIO_TOP_BAR_V2_ENABLED: true })
    assert.equal(typeof cleared.result, 'function'); cleared.result(); assert.deepEqual(cleared.published, [null])
  },
  'the save-state mirror holds no logic: it stores, notifies on change and nothing else': src => {
    const lib = libModule(src)
    const seen = []
    const stop = lib.subscribeStudioDeckSaveState(() => seen.push(lib.getStudioDeckSaveState()))
    assert.equal(lib.getStudioDeckSaveState(), null)
    lib.publishStudioDeckSaveState('saved'); lib.publishStudioDeckSaveState('saved'); lib.publishStudioDeckSaveState('saving'); lib.publishStudioDeckSaveState(null)
    stop(); lib.publishStudioDeckSaveState('error')
    assert.deepEqual(seen, ['saved', 'saving', null])
    assert.doesNotMatch(src.lib, /fetch\(|WebSocket|postMessage|localStorage|sessionStorage|XMLHttpRequest/)
  },
  'the stylesheet: every rule needs a flag-on marker, so with the flag off none can match': src => {
    assert.ok(src.css, 'studio-top-bar-v2.css exists')
    assert.match(src.header, /import "\.\/studio-top-bar-v2\.css"/)
    let rules = 0
    postcss.parse(src.css).walkRules(rule => {
      rules += 1
      for (const selector of rule.selectors) assert.match(selector, /\[data-studio-top-bar-v2="true"\]|\[data-studio-export-chevron\]/, `unscoped selector: ${selector}`)
    })
    assert.ok(rules >= 20, `the top bar rules are there (${rules})`)
    // the markers exist only in flag-on renders
    const offRenders = [renderHeader(src, { env: SHELL_ON, deckTitle: DECK, saveState: 'saved' }).tree, renderDownload(src, { env: SHELL_ON })]
    for (const tree of offRenders) assert.doesNotMatch(serialise(tree), /data-studio-top-bar|data-studio-export-chevron/)
  },
  'scope: the change talks to no service and adds no request': src => {
    // + NEXT_PUBLIC_STUDIO_P2_PUBLISH adds one flag-gated estimate fetch to the dialog; scripts/test-studio-p2-publish.mjs pins it, so it is taken out first.
    for (const key of ['header', 'download', 'publish']) assert.equal((key === 'publish' ? stripP2Publish('components/publish-dialog.tsx', src[key]) : src[key]).split('fetch(').length, ORIGINAL_FETCH_COUNTS[key], `${key}: no new fetch`)
    assert.equal([...src.header.matchAll(/studioTopBarV2/g)].length, 10, 'header: declared once; the store gate (2), the marker, the breadcrumb, the deck marker, Saved and the three New deck strings')
  },
  'the flag is documented in .env.example, default "false", and has an npm script': () => {
    assert.match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_TOP_BAR_V2="false"$/m)
    assert.equal(JSON.parse(read('package.json')).scripts['test:studio-top-bar-v2'], 'node scripts/test-studio-top-bar-v2.mjs')
  },
}
// "fetch(" pieces (occurrences + 1) in the three component files at the base (5cc455d: 0, 0 and 10 calls): the change adds none.
const ORIGINAL_FETCH_COUNTS = { header: 1, download: 1, publish: 11 }

let testCount = 0
function run(name, fn) {
  testCount += 1
  try { fn() } catch (err) { console.error(`FAIL: ${name}`); throw err }
}
for (const [name, check] of Object.entries(CHECKS)) run(name, () => check(ORIGINAL))

// ---- mutation checks: each in-memory mutant of the change must be caught by the checks above ------------------------------
const caught = src => Object.values(CHECKS).some(check => { try { check(src); return false } catch { return true } })
const MUTANTS = [
  ['flag read loosely (!== "false")', 'lib', `process.env.NEXT_PUBLIC_STUDIO_TOP_BAR_V2 === 'true'`, `process.env.NEXT_PUBLIC_STUDIO_TOP_BAR_V2 !== 'false'`],
  ['flag ignores the Studio shell', 'lib', `process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env`, `true && process.env`],
  ['header ignores the flag', 'header', 'const studioTopBarV2 = studioShell && STUDIO_TOP_BAR_V2_ENABLED', 'const studioTopBarV2 = studioShell'],
  // PASS2B G56 (00cb07f): the flag-off word is now the helper's fallback argument.
  ['flag-off label changed', 'header', 'studioCreateLabel(studioCreateWord, "Presentation")}', 'studioCreateLabel(studioCreateWord, "Presentations")}'],
  ['flag-off accessible name changed', 'header', 'aria-label={studioTopBarV2 ? "New deck" : studioCreateLabel(studioCreateWord, "Add presentation")}', 'aria-label={studioTopBarV2 ? "New deck" : studioCreateLabel(studioCreateWord, "Add deck")}'],
  ['marker always on', 'header', `{...(studioTopBarV2 ? { 'data-studio-top-bar-v2': 'true' } : {})}`, `data-studio-top-bar-v2="true"`],
  ['Saved shown for every state', 'lib', `return state === 'saved' && !sessionUnsaved ? 'Saved' : null`, `return state && !sessionUnsaved ? 'Saved' : null`],
  ['Saved shown while saving', 'lib', `return state === 'saved' && !sessionUnsaved ? 'Saved' : null`, `return (state === 'saved' || state === 'saving') && !sessionUnsaved ? 'Saved' : null`],
  ['Saved ignores an unsaved session', 'lib', `return state === 'saved' && !sessionUnsaved ? 'Saved' : null`, `return state === 'saved' ? 'Saved' : null`],
  ['unsaved-session gate inverted', 'lib', `return state === 'saved' && !sessionUnsaved ? 'Saved' : null`, `return state === 'saved' && sessionUnsaved ? 'Saved' : null`],
  ['unsaved-session default flipped', 'lib', `sessionUnsaved = false`, `sessionUnsaved = true`],
  ['header drops the unsaved session from the label', 'header', `), STUDIO_SESSION_HYGIENE_ENABLED && isUnsavedSession)`, `))`],
  ['header ignores the hygiene flag (an unsaved session hides Saved with hygiene off)', 'header', `STUDIO_SESSION_HYGIENE_ENABLED && isUnsavedSession)`, `isUnsavedSession)`],
  ['header gates on hygiene alone (every session hides Saved)', 'header', `STUDIO_SESSION_HYGIENE_ENABLED && isUnsavedSession)`, `STUDIO_SESSION_HYGIENE_ENABLED)`],
  ['header reads the unsaved flag inverted', 'header', `STUDIO_SESSION_HYGIENE_ENABLED && isUnsavedSession)`, `STUDIO_SESSION_HYGIENE_ENABLED && !isUnsavedSession)`],
  ['header prop defaults to unsaved', 'header', `isUnsavedSession = false,`, `isUnsavedSession = true,`],
  ['header reads the hygiene flag from the env directly', 'header', `import { STUDIO_SESSION_HYGIENE_ENABLED } from "@/lib/studio-session-hygiene"`, `const STUDIO_SESSION_HYGIENE_ENABLED = process.env.NEXT_PUBLIC_STUDIO_SESSION_HYGIENE === 'true'`],
  ['hygiene flag read loosely', 'hygiene', `process.env.NEXT_PUBLIC_STUDIO_SESSION_HYGIENE === 'true'`, `process.env.NEXT_PUBLIC_STUDIO_SESSION_HYGIENE !== 'false'`],
  ['page does not hand the header the flag', 'page', `          isUnsavedSession={isUnsavedSession}\n        />`, `        />`],
  ['page hands the header a constant', 'page', `isUnsavedSession={isUnsavedSession}\n        />`, `isUnsavedSession={false}\n        />`],
  ['Export label leaks into flag off', 'download', `: STUDIO_EXPORT_LABEL ? 'Export' : 'Download'}`, `: 'Export'}`],
  ['Export flag ignores the flag', 'download', 'const STUDIO_EXPORT_LABEL = STUDIO_DELIVERY && STUDIO_TOP_BAR_V2_ENABLED;', 'const STUDIO_EXPORT_LABEL = STUDIO_DELIVERY;'],
  ['Export menu changed', 'download', '<DropdownMenuContent align="end" className="w-48"', '<DropdownMenuContent align="start" className="w-48"'],
  ['Publish icon unflagged', 'publish', '{STUDIO_TOP_BAR_GLOBE ? <Globe2 className="h-5 w-5" /> : <Globe className="h-5 w-5" />}', '<Globe2 className="h-5 w-5" />'],
  ['viewer publishes with the flag off', 'viewer', `    if (!STUDIO_TOP_BAR_V2_ENABLED || !studioShell) return
    publishStudioDeckSaveState(`, `    publishStudioDeckSaveState(`],
  ['viewer reports Saved while Director builds', 'viewer', 'viewerIsReady && !isGenerating && !studioPartialArtifact ?', 'viewerIsReady && !studioPartialArtifact ?'],
  ['unscoped CSS rule', 'css', '[data-studio-v4-shell="true"] [data-studio-top-bar-v2="true"] .studio-shell-new { height: 28px;', '[data-studio-v4-shell="true"] .studio-shell-new { height: 28px;'],
]
run(`mutation checks: ${MUTANTS.length} in-memory mutants of the change are each caught`, () => {
  for (const [name, key, from, to] of MUTANTS) {
    assert.equal(ORIGINAL[key].split(from).length, 2, `mutant "${name}": its target occurs once`)
    assert.ok(caught({ ...ORIGINAL, [key]: ORIGINAL[key].replace(from, to) }), `mutant "${name}" is caught`)
  }
})

console.log(`PASS: studio top bar v2 (${testCount} tests, ${MUTANTS.length} mutants caught)`)
