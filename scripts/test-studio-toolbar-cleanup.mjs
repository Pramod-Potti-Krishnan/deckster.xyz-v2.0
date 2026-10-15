// PASS2 #5 (frontend-2): Studio builder toolbar cleanup.
// Flag NEXT_PUBLIC_STUDIO_TOOLBAR_CLEANUP (exact "true", Studio shell only), default off. Flag off must render the toolbar and the
// slide footer exactly as the base did.
// Run: node scripts/test-studio-toolbar-cleanup.mjs   (plain node: transpile + vm, no network, no React runtime)
//   PRINT_GOLDEN=1 node scripts/test-studio-toolbar-cleanup.mjs   re-prints the flag-off golden (run a copy of this file in a
//   pristine checkout of the base: origin/studio-v4-dev-preparation-code at 1ed7248, before this change).
//
// The proof is made on the REAL source: the whole toolbar block of components/presentation-viewer.tsx (authoring strip, present
// control, delivery controls, fullscreen overlay, and the three portals the strip, the slide footer and the header render into)
// is cut out by AST and evaluated, so a later edit to the viewer is tested, not a copy of it.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import postcss from 'postcss'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const VIEWER = 'components/presentation-viewer.tsx'
const CSS = 'components/builder/studio-canvas.css'
const FLAG = 'NEXT_PUBLIC_STUDIO_TOOLBAR_CLEANUP'

// ---- tiny JSX "runtime": elements become {type, props, children}; function components are expanded by `serialise` -------
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
const sha = text => crypto.createHash('sha256').update(text).digest('hex')

// ---- cut real source out of the viewer ------------------------------------------------------------------------------
const viewerSource = ts.createSourceFile(VIEWER, read(VIEWER), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
function find(node, predicate) {
  if (predicate(node)) return node
  let match
  ts.forEachChild(node, child => { if (!match) match = find(child, predicate) })
  return match
}
const declaration = name => find(viewerSource, n => ts.isVariableDeclaration(n) && n.name.getText(viewerSource) === name)
const authoringDeclaration = declaration('authoringControls')
assert.ok(authoringDeclaration, 'authoringControls is declared in the viewer')
let toolbarBlock = authoringDeclaration
while (toolbarBlock && !ts.isArrowFunction(toolbarBlock)) toolbarBlock = toolbarBlock.parent
assert.ok(toolbarBlock, 'authoringControls sits inside the toolbar block (an immediately-invoked arrow)')
const cleanupDeclaration = declaration('studioToolbarCleanup') // new with this change; the base has none (undefined = off)

// Compile one expression of the real source once, then run it against any scope. Free capitalised names (icons, UI parts)
// resolve to name-only stubs; everything else must come from `scope`, or the run fails loudly.
function compile(expressionText, { call = false } = {}) {
  const js = ts.transpileModule(`(${expressionText})${call ? '()' : ''};`, { compilerOptions: JSX_OPTIONS, fileName: 'expression.tsx' }).outputText
  const script = new vm.Script(`with (__scope) { ${js} }`)
  return scope => {
    const proxy = new Proxy(scope, {
      has: (target, key) => typeof key === 'string' && (key in target || (/^[A-Z]/.test(key) && !(key in globalThis))),
      get: (target, key) => key === Symbol.unscopables ? undefined : key in target ? target[key] : String(key),
    })
    return script.runInContext(vm.createContext({ __scope: proxy, console }))
  }
}
const evaluate = (expressionText, scope) => compile(expressionText)(scope)
const renderToolbarBlock = compile(toolbarBlock.getText(viewerSource), { call: true })

// ---- the viewer's environment, with every handler recorded ------------------------------------------------------------
const TARGETS = { authoring: 'target:authoring', present: 'target:present', header: 'target:header' }
function makeEnvironment(state) {
  const {
    studioShell = true, isFullscreen = false, viewerIsReady = true, templateBuilderEnabled = false, portals = true, presentViewOnlyActive = false,
    isGenerating = false, versions = false, showToolbar = true, selection = false, env = {}, withFormatHandler = true,
  } = state
  const calls = []
  const record = name => (...args) => { calls.push(name); return undefined }
  const scope = {
    __jsx: jsx, [FRAGMENT]: FRAGMENT, process: { env },
    studioShell, isFullscreen, viewerIsReady, templateBuilderEnabled, presentViewOnlyActive, isGenerating, showToolbar,
    templateIngestEnabled: false, canSaveTemplate: true, templateSaveGate: { canSave: true, disabledReason: null, sourcePresentationId: 'p' },
    templateModeAvailable: true, templateModeOn: false, templateSelectionLocked: false, studioPartialArtifact: false, studioWorkflowRequest: null,
    toolbarTemplateMenuOpen: false, toolbarTemplatePickerOpen: false,
    onStudioFormatRequested: withFormatHandler ? record('onStudioFormatRequested') : undefined,
    studioFormatBusy: false, studioFormatSelection: selection ? { isCurrent: () => true } : null,
    studioTabPausedHint: undefined, // NEXT_PUBLIC_STUDIO_ONE_LIVE_TAB: a new prop of the viewer; absent = the base toolbar, byte for byte
    isSlideMutationPending: false, isEditMode: false, isGridActive: false, isBordersActive: false, isSaving: false, saveStatus: 'saved',
    resolvedTheme: 'light', activeVersion: 'blank', strawmanPreviewUrl: versions ? 'https://example.invalid/s' : null, finalPresentationUrl: versions ? 'https://example.invalid/f' : null,
    ADD_SLIDE_V2_ENABLED: false, STUDIO_DISABLED_REASONS_ENABLED: false, STUDIO_SLIDE_COUNT_SYNC_ENABLED: false, addSlideV2Settings: null, buildThemeSelection: null, slideThumbnails: [],
    currentSlide: 1, totalSlides: 7, slideCount: 7, visualTotalSlides: 7, syncedFooterTotal: () => 7, toolbarOffset: 0,
    authoringStripRef: { current: null }, viewerInteractionIntentRef: { current: 0 }, toolbarDropdownPortalContainer: null,
    downloadControls: 'DOWNLOAD', onOpenGenerationPanel: record('onOpenGenerationPanel'), onGenerateSlide: record('onGenerateSlide'), onSelectTemplate: record('onSelectTemplate'),
    onTemplateModeChange: record('onTemplateModeChange'), onVersionSwitch: record('onVersionSwitch'),
    handleAddSlide: record('handleAddSlide'), handleFullscreen: function handleFullscreen() { calls.push('handleFullscreen') },
    handleInsertTable: record('handleInsertTable'), handleInsertChart: record('handleInsertChart'), handleInsertTextBox: record('handleInsertTextBox'),
    handleInsertImage: record('handleInsertImage'), handleInsertInfographic: record('handleInsertInfographic'), handleInsertDiagram: record('handleInsertDiagram'),
    handleSaveChanges: record('handleSaveChanges'), handleToggleBorders: record('handleToggleBorders'), handleToggleEditModeButton: record('handleToggleEditModeButton'),
    handleToggleGrid: record('handleToggleGrid'), setShowPresentationSettings: record('setShowPresentationSettings'), setShowTemplateIngest: record('setShowTemplateIngest'),
    setShowTemplateSave: record('setShowTemplateSave'), setShowThemePanel: record('setShowThemePanel'), setTheme: record('setTheme'),
    setToolbarTemplateMenuOpen: record('setToolbarTemplateMenuOpen'), setToolbarTemplatePickerOpen: record('setToolbarTemplatePickerOpen'),
    studioAuthoringPortalTarget: portals ? TARGETS.authoring : null, studioPresentPortalTarget: portals ? TARGETS.present : null, toolbarPortalTarget: portals ? TARGETS.header : null,
    createPortal: (child, target) => ({ type: 'Portal', props: { target }, children: [child] }),
    cn: (...parts) => parts.flat(Infinity).filter(part => typeof part === 'string' && part).join(' '),
  }
  // The flag declaration is new; the base has none (undefined = off), which keeps the base golden capturable.
  scope.studioToolbarCleanup = cleanupDeclaration ? evaluate(cleanupDeclaration.initializer.getText(viewerSource), scope) : undefined
  const render = () => renderToolbarBlock(scope)
  return { scope, calls, render }
}

// ---- the matrix the flag-off proof runs over -------------------------------------------------------------------------
const BOOLS = [false, true]
const AXES = ['studioShell', 'isFullscreen', 'viewerIsReady', 'templateBuilderEnabled', 'portals', 'presentViewOnlyActive', 'isGenerating', 'versions', 'showToolbar', 'selection']
const MATRIX = []
const build = (index, cell) => {
  if (index === AXES.length) { MATRIX.push({ ...cell }); return }
  for (const value of BOOLS) build(index + 1, { ...cell, [AXES[index]]: value })
}
build(0, {})
const cellName = cell => AXES.map(axis => `${axis}=${cell[axis] ? 1 : 0}`).join(' ')
const matrixDigest = (extra = {}) => {
  const hashes = MATRIX.map(cell => sha(serialise(makeEnvironment({ ...cell, ...extra }).render())))
  return sha(hashes.join('\n'))
}

// The flag-off golden: the digest of the per-cell hashes of the whole toolbar block over the full matrix (1024 cells), captured
// from the base viewer (origin/studio-v4-dev-preparation-code at 1ed7248, before this change) with the flag unset.
// BASE_CSS_DIGEST is the digest of studio-canvas.css (comments removed, whitespace normalised) at the same commit.
const BASE_MATRIX_DIGEST = '75b2b530ba3593cd89fc999c9d2c9217a1ebcd8f7ea81ab3bd800a4b9f2131a0'
const BASE_CSS_DIGEST = 'ada53725e3f305b598a563e9fe928970b0b045eab48c26a8a67462687bb7d7b1'

const normaliseCss = (css, { dropMarked = false } = {}) => {
  const ast = postcss.parse(css)
  ast.walkComments(comment => comment.remove())
  if (dropMarked) {
    ast.walkRules(rule => { if (/data-studio-(toolbar-present|position-only)/.test(rule.selector)) rule.remove() })
    ast.walkAtRules(atRule => { if (atRule.nodes && atRule.nodes.length === 0) atRule.remove() })
  }
  return ast.toString().replace(/\s+/g, ' ').trim()
}

if (process.env.PRINT_GOLDEN) {
  console.log(JSON.stringify({ BASE_MATRIX_DIGEST: matrixDigest(), BASE_CSS_DIGEST: sha(normaliseCss(read(CSS), { dropMarked: true })), cells: MATRIX.length }, null, 2))
  process.exit(0)
}

let testCount = 0
function run(name, fn) {
  testCount += 1
  try { fn() } catch (err) { console.error(`FAIL: ${name}`); throw err }
}

// ---- helpers over a render ---------------------------------------------------------------------------------------------
const ON = { env: { [FLAG]: 'true' } }
const portalFor = (rendered, target) => findAll(rendered, node => node.type === 'Portal' && node.props.target === target)
const controlsOf = rendered => {
  const [portal] = portalFor(rendered, TARGETS.authoring)
  if (!portal) return null
  return findAll(portal, node => node.type === 'div' && node.props['data-studio-v4-authoring-controls'] === 'true')[0].children[0]
}
// The strip's controls in order: the button title, "Add Slide" for the layout picker, "|" for a divider.
const itemsOf = strip => {
  const items = []
  for (const child of strip.children.flat(Infinity)) {
    if (child === null || child === undefined || typeof child === 'boolean') continue
    if (child.type === FRAGMENT) { items.push(...itemsOf({ children: child.children })); continue }
    if (child.type === 'SlideLayoutPicker') items.push('Add Slide')
    else if (child.type === 'button') items.push(child.props.title)
    else if (child.type === 'DropdownMenu') items.push(findAll(child, node => node.type === 'button')[0].props.title)
    else if (child.type === 'div' && child.props['aria-hidden'] === 'true') items.push('|')
    else items.push(`?${String(child.type)}`)
  }
  return items
}
const presentButtons = rendered => findAll(rendered, node => node.type === 'button' && /^(Present fullscreen|Exit fullscreen \(ESC\))$/.test(node.props.title || ''))
const SHELL = { studioShell: true, isFullscreen: false }
const STRIP_OFF = ['Add Slide', 'Add an element', 'Format the selected element', 'Templates — coming soon', 'Presentation theme', '|', 'Editing mode + theme', 'Display options']
const STRIP_ON = ['Add Slide', 'Add an element', 'Format the selected element', 'Presentation theme', '|', 'Editing mode + theme', 'Display options', '|', 'Present fullscreen']

// ---- the flag ---------------------------------------------------------------------------------------------------------
run('the flag is read in the viewer as the exact string "true", only in the Studio shell, and defaults off', () => {
  assert.match(read(VIEWER), /process\.env\.NEXT_PUBLIC_STUDIO_TOOLBAR_CLEANUP === 'true'/)
  assert.ok(cleanupDeclaration, 'the viewer declares studioToolbarCleanup')
  const expression = cleanupDeclaration.initializer.getText(viewerSource)
  for (const [value, expected] of [[undefined, false], ['', false], ['false', false], ['1', false], ['TRUE', false], ['True', false], [' true', false], ['true ', false], ['yes', false], ['true', true]]) {
    for (const studioShell of BOOLS) {
      const env = value === undefined ? {} : { [FLAG]: value }
      assert.equal(evaluate(expression, { process: { env }, studioShell }), expected && studioShell, `${JSON.stringify(value)} shell=${studioShell}`)
    }
  }
})

run('the flag is documented in .env.example, default "false", and has an npm script', () => {
  assert.match(read('.env.example'), /^NEXT_PUBLIC_STUDIO_TOOLBAR_CLEANUP="false"$/m)
  assert.equal(JSON.parse(read('package.json')).scripts['test:studio-toolbar-cleanup'], 'node scripts/test-studio-toolbar-cleanup.mjs')
})

// ---- flag off is the base ---------------------------------------------------------------------------------------------
run('flag off (unset, "false" or any non-"true" value): the whole toolbar block renders byte-for-byte as the base did, over 1024 states', () => {
  assert.equal(MATRIX.length, 1024)
  for (const value of [undefined, 'false', '1', 'TRUE', ' true', 'true ']) {
    const env = value === undefined ? {} : { [FLAG]: value }
    assert.equal(matrixDigest({ env }), BASE_MATRIX_DIGEST, `flag=${JSON.stringify(value)}`)
  }
})

run('flag on, but outside the Studio shell (classic builder): the toolbar block is still the base, in every state', () => {
  const classic = MATRIX.filter(cell => !cell.studioShell)
  const baseDigest = sha(classic.map(cell => sha(serialise(makeEnvironment({ ...cell }).render()))).join('\n'))
  const onDigest = sha(classic.map(cell => sha(serialise(makeEnvironment({ ...cell, ...ON }).render()))).join('\n'))
  assert.equal(onDigest, baseDigest)
})

run('the base toolbar the flag falls back to is the one the viewer always had', () => {
  const rendered = makeEnvironment({ ...SHELL }).render()
  assert.deepEqual(itemsOf(controlsOf(rendered)), STRIP_OFF)
  const present = presentButtons(rendered)
  assert.equal(present.length, 1, 'one Present button in the whole normal Studio viewer')
  assert.equal(present[0].props['data-studio-toolbar-present'], undefined)
  const footer = portalFor(rendered, TARGETS.present)[0]
  assert.equal(findAll(footer, node => node.type === 'button').length, 1, 'Present is in the footer')
  assert.match(textOf(footer), /^Slide 1 \/ 7Present$/)
  assert.equal(findAll(footer, node => node.props && node.props['data-studio-position-only']).length, 0)
})

// ---- flag on: the toolbar -----------------------------------------------------------------------------------------------
run('flag on: the greyed-out "Templates — coming soon" button is gone, nothing else in the strip is', () => {
  const rendered = makeEnvironment({ ...SHELL, ...ON }).render()
  const items = itemsOf(controlsOf(rendered))
  assert.ok(!items.includes('Templates — coming soon'))
  assert.doesNotMatch(serialise(rendered), /coming soon/i)
  assert.deepEqual(items, STRIP_ON)
  assert.deepEqual(STRIP_ON.filter(item => item !== 'Present fullscreen').slice(0, -1), STRIP_OFF.filter(item => item !== 'Templates — coming soon'), 'only the dead button is missing')
})

run('flag on: Format stays, and is still only unavailable until an element is selected (contextual, not unconnected)', () => {
  const formatOf = state => findAll(makeEnvironment({ ...SHELL, ...ON, ...state }).render(), node => node.type === 'button' && node.props.title === 'Format the selected element')
  const noSelection = formatOf({ selection: false })
  assert.equal(noSelection.length, 1)
  assert.equal(noSelection[0].props.disabled, true, 'disabled with nothing selected')
  const selected = formatOf({ selection: true })
  assert.equal(selected.length, 1)
  assert.equal(selected[0].props.disabled, false, 'enabled once an element is selected')
  const selectedEnv = makeEnvironment({ ...SHELL, ...ON, selection: true })
  findAll(selectedEnv.render(), node => node.type === 'button' && node.props.title === 'Format the selected element')[0].props.onClick()
  assert.deepEqual(selectedEnv.calls, ['onStudioFormatRequested'], 'it reaches the real format handler')
  assert.equal(formatOf({ withFormatHandler: false }).length, 0, 'without a format handler it is not drawn (as before)')
  const before = findAll(makeEnvironment({ ...SHELL, selection: false }).render(), node => node.type === 'button' && node.props.title === 'Format the selected element')[0]
  assert.equal(before.props.disabled, true)
})

run('flag on with saved templates connected (NEXT_PUBLIC_TEMPLATE_BUILDER_ENABLED): the working Template menu is shown, exactly as before', () => {
  for (const state of [{ templateBuilderEnabled: true }, { templateBuilderEnabled: true, versions: true, selection: true }]) {
    const off = makeEnvironment({ ...SHELL, ...state }).render()
    const on = makeEnvironment({ ...SHELL, ...ON, ...state }).render()
    assert.ok(itemsOf(controlsOf(on)).includes('Template options'))
    // the Template menu itself (the DropdownMenu holding it) is identical with and without the flag
    const templateMenu = rendered => serialise(findAll(rendered, node => node.type === 'DropdownMenu' && findAll(node, n => n.type === 'button' && n.props.title === 'Template options').length > 0))
    assert.equal(templateMenu(on), templateMenu(off))
    assert.notEqual(templateMenu(on), '')
  }
})

run('flag on: Present closes the authoring strip (after a divider), filled and marked, and is the only Present button', () => {
  const rendered = makeEnvironment({ ...SHELL, ...ON }).render()
  const items = itemsOf(controlsOf(rendered))
  assert.deepEqual(items, STRIP_ON)
  const present = presentButtons(rendered)
  assert.equal(present.length, 1)
  assert.equal(present[0].props['data-studio-toolbar-present'], 'true')
  assert.equal(textOf(present[0]), 'Present')
  assert.ok(findAll(controlsOf(rendered), node => node === present[0]).length === 1, 'the one Present button is inside the strip')
  // the strip's wrapper keeps its roles
  const strip = findAll(rendered, node => node.props && node.props['data-studio-v4-authoring-controls'] === 'true')[0]
  assert.equal(strip.props.role, 'group')
  assert.equal(strip.props['aria-label'], 'Slide authoring controls')
})

run('flag on: the slide footer keeps the slide position and loses only the Present button', () => {
  const rendered = makeEnvironment({ ...SHELL, ...ON }).render()
  const footer = portalFor(rendered, TARGETS.present)[0]
  const group = findAll(footer, node => node.props && node.props['data-studio-slide-controls'] === 'true')[0]
  assert.equal(group.props.role, 'group')
  assert.equal(group.props['aria-label'], 'Presentation controls')
  assert.equal(group.props['data-studio-position-only'], 'true')
  assert.equal(textOf(group), 'Slide 1 / 7')
  assert.equal(findAll(footer, node => node.type === 'button').length, 0)
})

run('flag on: the header delivery controls (Save feedback, Download) are untouched, with or without the flag', () => {
  for (const state of [{}, { versions: true }, { viewerIsReady: false }]) {
    const header = rendered => serialise(portalFor(rendered, TARGETS.header))
    assert.equal(header(makeEnvironment({ ...SHELL, ...ON, ...state }).render()), header(makeEnvironment({ ...SHELL, ...state }).render()))
  }
})

run('flag on: the same handler and the same disabled rule as before for Present (it still calls handleFullscreen; disabled until the viewer is ready)', () => {
  for (const viewerIsReady of BOOLS) {
    const before = presentButtons(makeEnvironment({ ...SHELL, viewerIsReady }).render())[0]
    const after = presentButtons(makeEnvironment({ ...SHELL, ...ON, viewerIsReady }).render())[0]
    assert.equal(after.props.disabled, before.props.disabled)
    assert.equal(after.props.disabled, !viewerIsReady)
    assert.equal(after.props.title, before.props.title)
    assert.equal(after.props.onClick.name, 'handleFullscreen')
    assert.equal(before.props.onClick.name, 'handleFullscreen')
  }
  const environment = makeEnvironment({ ...SHELL, ...ON })
  presentButtons(environment.render())[0].props.onClick()
  assert.deepEqual(environment.calls, ['handleFullscreen'])
})

run('flag on, fullscreen: Present stays where it was (the Exit button in the floating toolbar), the strip carries no Present, the dead Template is gone', () => {
  const off = makeEnvironment({ studioShell: true, isFullscreen: true }).render()
  const on = makeEnvironment({ studioShell: true, isFullscreen: true, ...ON }).render()
  const exitButtons = rendered => presentButtons(rendered)
  assert.equal(exitButtons(on).length, 1)
  assert.equal(exitButtons(on)[0].props.title, 'Exit fullscreen (ESC)')
  assert.equal(exitButtons(on)[0].props['data-studio-toolbar-present'], undefined)
  assert.equal(textOf(exitButtons(on)[0]), 'Exit')
  assert.equal(serialise(exitButtons(on)), serialise(exitButtons(off)), 'the Exit button is the base one')
  assert.equal(portalFor(on, TARGETS.authoring).length, 0, 'no strip portal in fullscreen')
  assert.match(serialise(off), /coming soon/i)
  assert.doesNotMatch(serialise(on), /coming soon/i)
  assert.doesNotMatch(serialise(on), /data-studio-toolbar-present|data-studio-position-only/)
})

run('flag on: the header, strip and footer each render only into their own portal, and without a portal target nothing extra is drawn', () => {
  const none = makeEnvironment({ ...SHELL, ...ON, portals: false }).render()
  assert.equal(portalFor(none, TARGETS.authoring).length + portalFor(none, TARGETS.present).length, 0)
  assert.equal(presentButtons(none).length, 0, 'no stray Present when its slot is not mounted')
})

run('flag on: while Director builds (isGenerating) the strip and the footer dim and ignore the pointer, as before', () => {
  const rendered = makeEnvironment({ ...SHELL, ...ON, isGenerating: true }).render()
  const wrappers = findAll(rendered, node => node.props && (node.props['data-studio-v4-authoring'] === 'true' || node.props['data-studio-slide-controls'] === 'true'))
  assert.equal(wrappers.length, 2)
  for (const wrapper of wrappers) assert.match(wrapper.props.className, /pointer-events-none opacity-50/)
})

// ---- scope: presentation only ------------------------------------------------------------------------------------------
run('the viewer change is the flag, the Template fallback, the Present placement and nothing that talks to a service', () => {
  const source = read(VIEWER)
  assert.equal([...source.matchAll(/studioToolbarCleanup/g)].length, 2 + 1, 'declared once, used for the Template fallback and for presentInStrip')
  assert.equal([...source.matchAll(/presentInStrip/g)].length, 5, 'declared, marker, strip, footer position, footer Present')
  assert.equal([...source.matchAll(/data-studio-toolbar-present/g)].length, 1)
  assert.equal([...source.matchAll(/data-studio-position-only/g)].length, 1)
  assert.equal([...source.matchAll(/NEXT_PUBLIC_STUDIO_TOOLBAR_CLEANUP/g)].length, 2, 'the declaration and its comment')
})

run('presentControl is declared before authoringControls (the strip embeds it) and is still the one control used by the fullscreen toolbar', () => {
  const source = read(VIEWER)
  assert.ok(source.indexOf('const presentControl = (') < source.indexOf('const authoringControls = ('))
  assert.equal([...source.matchAll(/const presentControl = \(/g)].length, 1)
  assert.match(source, /\{\(!studioShell \|\| isFullscreen\) && presentControl\}/)
})

run('the stylesheet: every added rule needs a flag-on marker, and the rest of studio-canvas.css is exactly the base', () => {
  const css = read(CSS)
  const ast = postcss.parse(css)
  let marked = 0
  ast.walkRules(rule => {
    if (/data-studio-(toolbar-present|position-only)/.test(rule.selector)) {
      marked += 1
      for (const selector of rule.selectors) assert.match(selector, /data-studio-(toolbar-present|position-only)="true"/, `unscoped selector: ${selector}`)
    }
  })
  assert.equal(marked, 7, 'three strip rules, two narrow-strip rules, two footer rules')
  assert.equal(sha(normaliseCss(css, { dropMarked: true })), BASE_CSS_DIGEST)
})

console.log(`PASS: studio toolbar cleanup (${testCount} tests)`)
