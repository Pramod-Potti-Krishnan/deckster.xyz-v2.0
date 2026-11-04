// Read-only native narrow-workspace regression proof: supplied ownership, never a service acknowledgement.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import postcss from 'postcss'
import {component as actualViewer,nodes as viewerNodes,configuredOrigin} from '../docs/studio-v4/eight-hour-parity-20261005/builder1/test-fixtures/viewer-component-harness.mjs'

const root = new URL('../', import.meta.url)
const read = file => fs.readFileSync(new URL(file, root), 'utf8')
const before = file => execFileSync('git', ['show', 'afbd12e^:' + file], { cwd: root, encoding: 'utf8' })
const parse = (source, file = 'page.tsx') => ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const all = (node, predicate) => { const found = []; const visit = node => { if (predicate(node)) found.push(node); ts.forEachChild(node, visit) }; visit(node); return found }
const page = read('app/builder/page.tsx'), ast = parse(page)
const variable = name => { const node = all(ast, node => ts.isVariableDeclaration(node) && node.name.getText(ast) === name)[0]; assert.ok(node, name); return node.initializer }
const evaluate = (expression, bindings = {}) => {
  const output = ts.transpileModule(`export const value = (${expression});`, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
  assert.deepEqual((output.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error), [])
  const module = { exports: {} }; vm.runInNewContext(output.outputText, { module, exports: module.exports, ...bindings }); return module.exports.value
}
const effects = all(ast, node => ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect')
const effectContaining = text => { const node = effects.find(node => node.arguments[0].getText(ast).includes(text)); assert.ok(node, text); return node }
const fullscreen = effectContaining('syncFullscreen')
assert.equal(fullscreen.arguments[1].getText(ast), '[studioShell]')
let cases = 0
for (const studioShell of [false, true]) for (const hasWorkspace of [false, true]) {
  const document = new EventTarget(), inside = {}, outside = {}, states = []
  document.fullscreenElement = null
  const bindings = { studioShell, document, workspaceRef: { current: hasWorkspace ? { contains: node => node === inside } : null }, setStudioViewerFullscreen: value => states.push(value) }
  const cleanup = evaluate(fullscreen.arguments[0].getText(ast), bindings)()
  assert.equal(states.length, studioShell ? 1 : 0)
  for (const element of [inside, outside, null]) {
    document.fullscreenElement = element; document.dispatchEvent(new Event('fullscreenchange'))
    if (studioShell) assert.equal(states.at(-1), hasWorkspace && element === inside, 'Only actual fullscreen descendants of this workspace own the Stage')
    else assert.equal(states.length, 0, 'Classic installs no fullscreen bridge')
  }
  if (studioShell) { const count = states.length; cleanup(); document.fullscreenElement = inside; document.dispatchEvent(new Event('fullscreenchange')); assert.equal(states.length, count, 'Native listener cleanup prevents stale fullscreen ownership') }
  else assert.equal(cleanup, undefined)
  cases++
}
const measureEffect = effectContaining('setWorkspaceInnerWidth')
assert.equal(measureEffect.arguments[1].getText(ast), '[studioShell]')
for (const studioShell of [false, true]) {
  const outer = [], inner = [], observed = [], callbacks = [], workspace = { clientWidth: 323, getBoundingClientRect: () => ({ width: 324 }) }
  let disconnected = false
  class ResizeObserver { constructor(callback) { callbacks.push(callback) } observe(node) { observed.push(node) } disconnect() { disconnected = true } }
  const cleanup = evaluate(measureEffect.arguments[0].getText(ast), { studioShell, workspaceRef: { current: workspace }, ResizeObserver, setWorkspaceWidth: value => outer.push(value), setWorkspaceInnerWidth: value => inner.push(value) })()
  assert.equal(outer.length, studioShell ? 1 : 0); assert.equal(inner.length, studioShell ? 1 : 0)
  if (studioShell) {
    assert.equal(outer[0], 324); assert.equal(inner[0], 323); assert.equal(observed[0], workspace)
    workspace.clientWidth = 598; workspace.getBoundingClientRect = () => ({ width: 599 }); callbacks[0]()
    assert.equal(outer.at(-1), 599); assert.equal(inner.at(-1), 598)
    cleanup(); assert.equal(disconnected, true)
  }
  cases++
}
const allocation = variable('workspaceLayout').arguments[0]
const widthExpression = allocation.properties.find(node => node.name?.getText(ast) === 'width').initializer.getText(ast)
assert.equal(widthExpression, 'studioOverlayWorkspace ? workspaceInnerWidth : workspaceWidth')
for (const studioShell of [false, true]) for (const workspaceWidth of [324, 600, 601, 703, 879, 880, 881, 1100]) {
  const studioOverlayWorkspace = evaluate(variable('studioOverlayWorkspace').getText(ast), { studioShell, workspaceWidth })
  assert.equal(studioOverlayWorkspace, studioShell && workspaceWidth <= 880, 'Boundary intentionally follows measured outer workspace, not viewport')
  assert.equal(evaluate(widthExpression, { studioOverlayWorkspace, workspaceInnerWidth: workspaceWidth - 1, workspaceWidth }), studioOverlayWorkspace ? workspaceWidth - 1 : workspaceWidth, 'Only overlay uses the actual border-excluded content width')
  cases++
}
const load = (source, bindings = {}) => { const module = { exports: {} }; vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module, exports: module.exports, ...bindings }); return module.exports }
const currentLayout = load(read('lib/studio-workspace-layout.ts')).allocateStudioWorkspace
const oldLayout = load(before('lib/studio-workspace-layout.ts')).allocateStudioWorkspace
const coveredExpression = variable('studioCanvasCovered').getText(ast)
const switches = all(ast, node => ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === 'button').filter(node => ['Stage', 'Chat', 'Inspector'].includes(node.children.map(child => ts.isJsxText(child) ? child.text.trim() : '').join('')))
const pressed = Object.fromEntries(switches.map(node => [node.children.map(child => ts.isJsxText(child) ? child.text.trim() : '').join(''), node.openingElement.attributes.properties.find(attr => ts.isJsxAttribute(attr) && attr.name.getText(ast) === 'aria-pressed').initializer.expression.getText(ast)]))
assert.deepEqual(Object.keys(pressed).sort(), ['Chat', 'Inspector', 'Stage'])
for (const width of [323, 599, 600, 601, 703, 879, 880, 881, 1100]) for (const activePane of ['chat', 'inspector']) for (const chatOpen of [false, true]) for (const inspectorOpen of [false, true]) for (const stageSelected of [false, true]) {
  const overlay = width <= 880, input = { width, chatPreference: 640, inspectorPreference: 420, chatOpen, inspectorOpen, activePane, overlay, stageSelected }, snapshot = JSON.stringify(input)
  const layout = currentLayout(input)
  assert.equal(JSON.stringify(input), snapshot, 'Allocation never mutates owner flags or saved preferences')
  if (!overlay) assert.equal(JSON.stringify(layout), JSON.stringify(oldLayout(input)), 'All wider allocations remain exact regardless of narrow Stage selection')
  else {
    assert.equal(layout.canvasWidth, width); assert.equal(layout.left, 0); assert.equal(layout.right, 0)
    assert.equal(layout.chatWidth, width); assert.equal(layout.inspectorWidth, width)
    const bindings = { studioOverlayWorkspace: true, studioStageSelected: stageSelected, workspaceLayout: layout }
    const states = Object.values(pressed).map(expression => evaluate(expression, bindings))
    assert.equal(states.filter(Boolean).length, 1, 'Stage/Chat/Inspector current cues are exclusive, including both owners closed')
    if (stageSelected) assert.equal(layout.chatVisible || layout.inspectorVisible, false, 'Stage hides presentation only without closing native owners')
    for (const studioViewerFullscreen of [false, true]) {
      const covered = evaluate(coveredExpression, { ...bindings, studioViewerFullscreen, activeInspector: inspectorOpen ? 'element' : null, templateParamsCollapsed: false })
      assert.equal(covered, !studioViewerFullscreen && (layout.chatVisible || layout.inspectorVisible), 'Fullscreen remains visible/non-inert even when a native inspector is selected')
    }
  }
  cases++
}
for (const stageSelected of [false, true]) for (const studioViewerFullscreen of [false, true]) {
  const layout = currentLayout({ width: 323, chatPreference: 640, inspectorPreference: 420, chatOpen: true, inspectorOpen: true, inspectorCollapsed: true, collapsedWidth: 28, activePane: 'inspector', overlay: true, stageSelected })
  assert.equal(layout.right, stageSelected ? 0 : 28, 'The native collapsed Template strip remains available without a full-width cover')
  assert.equal(layout.canvasWidth, stageSelected ? 323 : 295)
  assert.equal(evaluate(coveredExpression, { studioOverlayWorkspace: true, studioViewerFullscreen, workspaceLayout: layout, activeInspector: 'template', templateParamsCollapsed: true }), false, 'Collapsed Template never hides or inerts the Stage')
  cases++
}
const revealExpression = variable('revealStudioStage').arguments[0].getText(ast)
for (const studioShell of [false, true]) for (const workspaceWidth of [324, 600, 601]) {
  const calls = []
  evaluate(revealExpression, { studioShell, workspaceWidth, setStudioStageSelected: value => calls.push(value) })()
  assert.equal(JSON.stringify(calls), JSON.stringify(studioShell && workspaceWidth <= 880 ? [true] : []), 'Physical toolbar interaction reveals only the current narrow Studio Stage')
  cases++
}
const effectiveStageExpression = allocation.properties.find(node => node.name?.getText(ast) === 'stageSelected').initializer.getText(ast)
assert.equal(effectiveStageExpression, 'studioStageSelected || studioViewerFullscreen')
for (const studioStageSelected of [false, true]) for (const studioViewerFullscreen of [false, true]) for (const activePane of ['chat', 'inspector']) {
  const stageSelected = evaluate(effectiveStageExpression, { studioStageSelected, studioViewerFullscreen })
  const layout = currentLayout({ width: 323, chatPreference: 640, inspectorPreference: 420, chatOpen: true, inspectorOpen: true, activePane, overlay: true, stageSelected })
  assert.equal(layout.chatVisible || layout.inspectorVisible, !studioStageSelected && !studioViewerFullscreen, 'Actual page allocation hides native foreground panes during fullscreen without closing their owners')
  assert.equal(layout.canvasWidth, 323)
  assert.equal(layout.chatVisible, !stageSelected && activePane === 'chat')
  assert.equal(layout.inspectorVisible, !stageSelected && activePane === 'inspector')
  cases++
}
const selectionExpression = variable('selectWorkspacePane').arguments[0].getText(ast)
for (const pane of ['chat', 'inspector']) {
  const state = { stage: true, pane: 'chat' }
  evaluate(selectionExpression, { setStudioStageSelected: value => { state.stage = value }, setWorkspacePane: value => { state.pane = value } })(pane)
  assert.equal(state.stage, false); assert.equal(state.pane, pane)
  cases++
}
const openEffect = effectContaining('newlyOpened')
for (const studioShell of [false, true]) for (const panel of ['element', 'slide', 'template']) {
  const called = [], previousInspectorOpenRef = { current: { element: false, slide: false, template: false } }
  const bindings = { studioShell, previousInspectorOpenRef, isElementDrawerOpen: panel === 'element', isSlideDrawerOpen: panel === 'slide', isTemplateParamsDrawerOpen: panel === 'template', setPreferredInspector: value => called.push(value), selectWorkspacePane: value => called.push(value) }
  const effect = evaluate(openEffect.arguments[0].getText(ast), bindings)
  effect(); assert.equal(JSON.stringify(called), JSON.stringify(studioShell ? [panel, 'inspector'] : []), 'A genuinely newly open native inspector selects its existing owner')
  effect(); assert.equal(called.length, studioShell ? 2 : 0, 'An already open inspector does not continually override manual Stage selection')
  cases++
}
// Freeze the latest Architect-accepted private application entering this slice.
// The genuine older allocation baseline remains above. The preceding source
// guard predates accepted introduction/history/return fixes and cannot demand
// their removal; this binding retains all existing allocation negative controls.
const acceptedRef = '3dfd6bb724acfcb8565cc3b2fea8708edafb3b1e'
const acceptedPage = execFileSync('git', ['show', acceptedRef + ':app/builder/page.tsx'], { cwd: root, encoding: 'utf8' })
// Keep the exact gated read-only Publish props independently validated as well.
const approvedPreviewProps = [
  '            publishFinalPresentationId={studioShell ? finalPresentationId : undefined}\n',
  '            publishThumbnailUrlsByPresentation={studioShell ? slideThumbnailUrlsByPresentation : undefined}\n',
  '            publishThumbnailOwnerSessionId={studioShell ? currentSessionIdRef.current : undefined}\n',
]
const withoutPreviewProps = candidate => {
  for (const prop of approvedPreviewProps) {
    assert.equal(candidate.split(prop).length, 2, 'The exact gated preview prop must occur once')
    candidate = candidate.replace(prop, '')
  }
  return candidate
}
// The eight-hour Add Slide slice adds an independently tested compose entry.
// Reverse only those exact reviewed bytes before checking the older allocation.
const composeEntryAdditions = [
  `  const handleOpenSlideCompose = useCallback(() => {
    setSlideGenerationMode('compose')
    setSlideRefineTarget(null)
    setShowFormatPanel(true)
    bringToFront('slide')
  }, [bringToFront])

`,
  '            onGenerateSlide={studioShell && features.slideComposerEnabled ? handleOpenSlideCompose : undefined}\n',
]
const withoutComposeEntry = candidate => {
  for (const addition of composeEntryAdditions) {
    assert.equal(candidate.split(addition).length, 2, 'Exact reviewed compose entry occurs once')
    candidate = candidate.replace(addition, '')
  }
  return candidate
}
const assertAcceptedPage = candidate => assert.ok(withoutPreviewProps(withoutComposeEntry(candidate)) === withoutPreviewProps(acceptedPage), 'Builder retains frozen allocation source plus exact independently tested compose entry ' + acceptedRef)
assertAcceptedPage(page)
for (const [before, after] of [
  ['setStudioStageSelected(false)', 'setStudioStageSelected(true)'],
  ['studioShell && workspaceWidth <= 880', 'workspaceWidth <= 880'],
  ['aria-label="Workspace pane"', 'aria-label="Changed workspace pane"'],
  ['studioShell ? finalPresentationId : undefined', 'finalPresentationId'],
  ['studioShell ? slideThumbnailUrlsByPresentation : undefined', 'slideThumbnailUrlsByPresentation'],
  ['studioShell ? currentSessionIdRef.current : undefined', 'currentSessionIdRef.current'],
]) {
  assert.ok(page.includes(before), 'Mutation witness must exercise actual accepted source')
  assert.throws(() => assertAcceptedPage(page.replace(before, after)), 'Unknown handler/gate/markup changes must fail the complete source guard')
}
const oldAst = parse(withoutPreviewProps(acceptedPage))
const preservedAst = parse(withoutPreviewProps(withoutComposeEntry(page)))
const workspaceMarker = ' data-studio-workspace-overlay={studioShell ? String(studioOverlayWorkspace) : undefined}'
assert.equal(page.split(workspaceMarker).length, 2)
assert.equal((page.match(/workspaceWidth <= 880/g) ?? []).length, 2)
const print = node => ts.createPrinter({ removeComments: true }).printNode(ts.EmitHint.Unspecified, node, node.getSourceFile())
for (const name of ['persistStudioPaneWidth', 'handleStudioResizeStart', 'handleStudioResizeKey']) {
  const oldNode = all(oldAst, node => ts.isVariableDeclaration(node) && node.name.getText(oldAst) === name)[0]
  assert.equal(print(variable(name)), print(oldNode.initializer), 'Native persisted width and resize handlers are unchanged: ' + name)
}
for (const name of ['GenerationPanel', 'MessageList', 'ChatInput', 'PresentationArea', 'TemplateParamsPanel']) {
  const matching = node => (ts.isJsxSelfClosingElement(node) || ts.isJsxElement(node)) && (ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName).getText(node.getSourceFile()) === name
  const oldNodes = all(oldAst, matching), newNodes = all(preservedAst, matching)
  assert.ok(oldNodes.length, name)
  assert.equal(JSON.stringify(newNodes.map(print)), JSON.stringify(oldNodes.map(print)), 'Native mounted leaf props/callbacks and iframe-owner props stay exact: ' + name)
}
assert.ok(page.includes('{studioShell && !studioOverlayWorkspace &&'), 'Narrow overlay does not offer a resize control that could overwrite preferences')
assert.ok(page.includes('aria-hidden={studioCanvasCovered ? true : undefined}') && page.includes('...(studioCanvasCovered ? { inert: true } : {})'), 'The exact fullscreen-safe cover truth owns accessibility and inertness')
assert.ok(page.includes('onToolbarInteract={studioOverlayWorkspace ? revealStudioStage : undefined}'), 'Only the narrow physical toolbar interaction bridge reveals Stage')
const cssRules = postcss.parse(read('components/builder/studio-workspace.css')).nodes.filter(node => node.selector?.includes('[data-studio-canvas-covered="true"]'))
assert.equal(cssRules.length, 1); assert.deepEqual(cssRules[0].nodes.map(node => [node.prop, node.value]), [['visibility', 'hidden']], 'Cover preserves positive layout geometry; it never display:none or unmounts the iframe')
const handleRules = postcss.parse(read('components/builder/studio-workspace.css')).nodes.filter(node => node.selector?.includes('[data-studio-workspace-overlay="true"]'))
assert.equal(handleRules.length, 1)
assert.ok(handleRules[0].selector.includes('[data-studio-v4-shell="true"]') && handleRules[0].selector.includes('[data-studio-workspace-visible="true"] > [data-studio-drawer-handle]'))
assert.deepEqual(handleRules[0].nodes.map(node => [node.prop, node.value]), [['display', 'none']], 'Only redundant foreground-overlay edge handles leave keyboard order; native header Close and closed-pane handles remain')
class Element { constructor(marker) { this.marker = marker } closest(selector) { return this.marker && selector.includes(this.marker) ? this : null } }
const owns = load(read('lib/studio-canvas-shortcuts.ts'), { Element }).shouldHandleStudioCanvasShortcut
for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape']) {
  const event = { key, defaultPrevented: false, target: new Element() }
  const coveredRoot = { querySelector: selector => selector === '[data-studio-canvas-covered="true"]' ? {} : null }, clear = { querySelector: () => null }
  assert.equal(owns(event, coveredRoot), false, 'Covered Stage cannot navigate behind native foreground controls')
  assert.equal(owns(event, clear), true, 'Visible Stage retains ordinary native shortcut ownership')
  for (const marker of ['[data-studio-workspace-switch="true"]', '[data-studio-inspector-switch="true"]']) assert.equal(owns({ ...event, target: new Element(marker) }, clear), false, 'Focused workspace controls retain their own keys')
  cases++
}
// Execute the actual normal fit effect, not a duplicate sizing implementation.
// Layout's deployed c8 contract has base1920×1080/minScale0.1. These witnesses
// isolate a frontend iframe below that native floor; native/browser acceptance
// remains separate from the supplied dimensions used here.
const viewerSource = read('components/presentation-viewer.tsx'), viewerAst = parse(viewerSource, 'viewer.tsx')
const approvedCanvasProps = [
 '            tabIndex={studioShell && !isFullscreen && approvedPresentationUrl ? 0 : undefined}\n',
 '            role={studioShell && !isFullscreen && approvedPresentationUrl ? "region" : undefined}\n',
 '            aria-label={studioShell && !isFullscreen && approvedPresentationUrl ? "Slide canvas" : undefined}\n',
]
let preservedViewer = viewerSource
const reviewedViewerAdditions = [
  ['useEffect, useLayoutEffect, useCallback', 'useEffect, useCallback'],
  ['  // fullscreen query-string rewrites, before that frame can report its load.\n  useLayoutEffect(() => {', '  // fullscreen query-string rewrites.\n  useEffect(() => {'],
  ['  onGenerateSlide?: () => void\n', ''],
  ['  onGenerateSlide,\n', ''],
  ['                onGenerateSlide={onGenerateSlide}\n', ''],
]
for (const [addition, original] of reviewedViewerAdditions) {
  assert.equal(preservedViewer.split(addition).length, 2, 'Exact reviewed Viewer addition occurs once')
  preservedViewer = preservedViewer.replace(addition, original)
}
const acceptedViewer = execFileSync('git', ['show', acceptedRef + ':components/presentation-viewer.tsx'], { cwd: root, encoding: 'utf8' })
for (const prop of approvedCanvasProps) assert.equal(preservedViewer.split(prop).length, 2, 'Exactly one native canvas accessibility prop with its full gate')
assert.equal(preservedViewer, acceptedViewer, 'Latest accepted Viewer retained plus exact independently tested layout reset and compose entry')
const normalFit = all(viewerAst, node => ts.isCallExpression(node) && node.expression.getText(viewerAst) === 'useEffect')
  .find(node => node.arguments[0].getText(viewerAst).includes('const pw = width - 32'))
assert.ok(normalFit, 'Actual normal-mode fit effect')
const uatViewer = execFileSync('git', ['show', 'ee532fab4b84a6883f8a5b50675ccab692b62240:components/presentation-viewer.tsx'], { cwd: root, encoding: 'utf8' })
const uatViewerAst = parse(uatViewer, 'viewer.tsx')
const uatFit = all(uatViewerAst, node => ts.isCallExpression(node) && node.expression.getText(uatViewerAst) === 'useEffect')
  .find(node => node.arguments[0].getText(uatViewerAst).includes('const pw = width - 32'))
assert.equal(print(normalFit), print(uatFit), 'Normal fit behavior is inherited from exact UAT, not introduced by the live-transition repair')
let nativeFloorWitnesses = 0
const workspaceCss = postcss.parse(read('components/builder/studio-workspace.css'))
const floorRules = workspaceCss.nodes.filter(node => node.type === 'rule' && node.selector.includes('[data-studio-slide-space="true"]') && !node.selector.endsWith(':focus-visible'))
assert.equal(floorRules.length, 2)
for (const rule of floorRules) assert.ok(rule.selector.includes('[data-studio-v4-shell="true"]') && rule.selector.includes('[data-studio-v4-viewer]:not([data-studio-v4-fullscreen="true"])'), 'Minimum native viewport is literal Studio-only and excludes native fullscreen')
assert.deepEqual(floorRules[0].nodes.map(node => [node.prop, node.value]), [['overflow', 'auto'], ['align-items', 'safe center'], ['justify-content', 'safe center']], 'Only the fitted Stage viewport scrolls; safe alignment keeps the start edge reachable')
assert.deepEqual(floorRules[1].nodes.map(node => [node.prop, node.value]), [['min-width', '192px'], ['min-height', '108px'], ['flex-shrink', '0']])
assert.ok(floorRules[1].selector.endsWith('> div:has(> div > iframe[title="Presentation Viewer"])'), 'Native iframe wrapper alone owns the floor; placeholder and native tool portals do not')
const focusRule = workspaceCss.nodes.find(node => node.type === 'rule' && node.selector.includes('[data-studio-slide-space="true"]:focus-visible'))
assert.ok(focusRule.selector.includes('[data-studio-v4-shell="true"]') && focusRule.selector.includes(':not([data-studio-v4-fullscreen="true"])'))
assert.deepEqual(focusRule.nodes.map(node => [node.prop, node.value]), [['outline', '2px solid var(--ss-accent)'], ['outline-offset', '-2px']], 'Focused local scrolling viewport is visible without changing native geometry')
for (const thumbnailWidth of [96, 120, 180]) {
 const layout = currentLayout({ width: 323, chatPreference: 304, inspectorPreference: 360, chatOpen: true, inspectorOpen: false, activePane: 'chat', overlay: true, stageSelected: true })
 const measured = { width: layout.canvasWidth - thumbnailWidth - 6, height: 300 }, sizes = []
 class ResizeObserver { observe() {} disconnect() {} }
 const cleanup = evaluate(normalFit.arguments[0].getText(viewerAst), { isFullscreen: false, slideContainerRef: { current: { getBoundingClientRect: () => measured } }, setNormalSlideSize: value => sizes.push(value), ResizeObserver })()
 assert.equal(sizes.length, 1)
 assert.ok(sizes[0].width < 192 && sizes[0].height < 108, 'Actual positive fit can still fall below the native minimum viewport')
 assert.ok(sizes[0].width <= measured.width - 32 && sizes[0].height <= measured.height - 32, 'Frontend fit arithmetic itself stays within its supplied Stage allocation')
 cleanup(); nativeFloorWitnesses++
}
for (const measured of [{ width: 430, height: 110 }, { width: 974, height: 550 }]) {
 const sizes = [];class ResizeObserver { observe() {} disconnect() {} }
 evaluate(normalFit.arguments[0].getText(viewerAst), { isFullscreen: false, slideContainerRef: { current: { getBoundingClientRect: () => measured } }, setNormalSlideSize: value => sizes.push(value), ResizeObserver })()
 assert.equal(sizes.length, 1)
 assert.equal(sizes[0].width >= 192 && sizes[0].height >= 108, measured.height >= 140, 'Short height also crosses the native floor; ordinary wide allocation does not')
 nativeFloorWitnesses++
}
const viewer = actualViewer(viewerSource, true)
const viewerProps = { presentationUrl: `${configuredOrigin}/p/synthetic-narrow-keyboard`, presentationId: 'synthetic-narrow-keyboard', slideCount: 3, activeVersion: 'final', showControls: true }
const findIframe = tree => viewerNodes(tree).find(node => node.type === 'iframe')
let tree = viewer.render(viewerProps, true)
const iframeIdentity = findIframe(tree).key
for (const label of ['Hide thumbnails', 'Show thumbnails']) {
 const toggle = viewerNodes(tree).find(node => node.type === 'button' && node.props['aria-label'] === label)
 assert.ok(toggle, 'Native thumbnail toggle remains a labeled keyboard-focusable button')
 toggle.props.onClick(); tree = viewer.render(viewerProps)
 assert.equal(findIframe(tree).key, iframeIdentity, 'Native thumbnail width recovery retains the same iframe navigation identity')
 const strip = viewerNodes(tree).find(node => node.props?.['data-studio-v4-thumbnails'] === 'true')
 assert.equal(strip.props.style.width, label === 'Hide thumbnails' ? 0 : 120, 'Temporary native collapse does not replace the thumbnail preference')
}
console.log(`Studio narrow workspace: ${cases} supplied ownership/measurement/allocation/selection/key cases plus native handler/leaf/CSS preservation passed; ${nativeFloorWitnesses} actual UAT/current fit-contract witnesses, scoped native-floor CSS gates and actual native thumbnail-toggle continuity pass. Native fullscreen, iframe continuity and overflow keyboard geometry remain browser proof.`)
