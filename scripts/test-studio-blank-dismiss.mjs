import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import ts from 'typescript'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { component as nativeViewer, nodes as viewerNodes, configuredOrigin } from '../docs/studio-v4/twenty-four-hour-parity-20261005/builder1/first-slice/test-fixtures/viewer-component-harness.mjs'

const sourceRef = process.argv.find(arg => arg.startsWith('--source-ref='))?.slice('--source-ref='.length)
const before = '56ca1b45ed28686666ec7e9f76c0e607b052e413'
const fixed = !sourceRef
const read = file => sourceRef ? execFileSync('git', ['show', `${sourceRef}:${file}`], { encoding: 'utf8' })
  : fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const refuse = () => { throw Error('Blank-dismiss fixture refuses services, timers, native commands and browser actions') }
function load(file, dependencies = {}) {
  const mod = { exports: {} }
  const result = ts.transpileModule(read(file), { reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } })
  assert.equal(result.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length ?? 0, 0)
  vm.runInNewContext(result.outputText, { module: mod, exports: mod.exports, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' } },
    URL, fetch: refuse, setTimeout: refuse, require(name) { assert.ok(name in dependencies, `Unexpected dependency ${name}`); return dependencies[name] } })
  return mod.exports
}
function fixture() {
  let layoutEffects = []
  const dependencies = { react: { ...React, useLayoutEffect: callback => layoutEffects.push(callback) },
    'react/jsx-runtime': jsxRuntime,
    'react-dom': { createPortal: (children, container) => React.createElement('fixture-portal', { container }, children) } }
  const source = ts.createSourceFile('area.tsx', read('components/builder/presentation-area.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || statement.importClause?.isTypeOnly) continue
    const name = statement.moduleSpecifier.text
    if (name in dependencies) continue
    if (name.startsWith('@/lib/')) { dependencies[name] = load(`lib/${name.slice('@/lib/'.length)}.ts`); continue }
    assert.ok(name.startsWith('@/components/') || name === '@/types/elements', name)
    dependencies[name] = Object.fromEntries((statement.importClause?.namedBindings?.elements || [])
      .filter(binding => !binding.isTypeOnly).map(binding => {
        const key = binding.propertyName?.text ?? binding.name.text
        return [key, key === 'useStageWalkthrough' ? () => {} : `${name}:${key}`]
      }))
  }
  const { PresentationArea } = load('components/builder/presentation-area.tsx', dependencies)
  const native = nativeViewer(read('components/presentation-viewer.tsx'), true)
  let first = true
  return {
    render(props) {
      layoutEffects = []
      const tree = PresentationArea(props)
      // The actual Area pins a selected owner at committed native mount.
      // Execute its layout effects after constructing this render's tree.
      for (const effect of layoutEffects) effect()
      const viewer = viewerNodes(tree).find(node => node.type === dependencies['@/components/presentation-viewer'].PresentationViewer)
      assert.ok(viewer, 'Native blank viewer remains mounted')
      const nativeTree = native.render(viewer.props, first); first = false
      const iframe = viewerNodes(nativeTree).find(node => node.type === 'iframe')
      assert.ok(iframe, 'Actual native iframe remains mounted')
      return { viewer, iframe, tree: nativeTree, placeholder: viewer.props.stageChrome?.placeholder,
        placeholderInNative: viewerNodes(nativeTree).some(node => node === viewer.props.stageChrome?.placeholder),
        dismissButtons: viewerNodes(viewer.props.stageChrome?.placeholder).filter(node => node.type === 'button' && node.props['data-testid'] === 'bn-placeholder-dismiss') }
    },
  }
}
const heuristics = load('lib/build-narration-heuristics.ts')
const url = `${configuredOrigin}/p/synthetic-blank-dismiss`
const baseProps = {
  sessionId: 'synthetic-session', publishSessionId: 'synthetic-session', deckOwnerSessionId: 'synthetic-session',
  presentationUrl: url, presentationId: 'synthetic-blank-dismiss', activeVersion: 'blank', isBlankPresentation: true,
  slideCount: 1, slideStructure: null, strawmanPreviewUrl: null, finalPresentationUrl: null, publishFinalPresentationId: null,
  buildNarrationEnabled: true, buildNarration: null, currentSlideIndex: 0, currentStage: 0,
  currentStatus: null, isGeneratingFinal: false, isGeneratingStrawman: false,
  blankPlaceholderDismissed: false, awaitingDirectorReply: false, connected: true, connecting: false,
  generationPanel: { hasActiveGenerations: false }, blankElements: {},
  onSlideChange: refuse, onVersionSwitch: refuse, onDismissBlankPlaceholder: refuse,
}
const narration = phase => ({ ...heuristics.initialNarrationState(), active: true, phase, slideCount: 1, slidesDone: 0 })
const results = []
function check(name, run) { const result = run(); results.push({ case: name, ...result }) }

for (const [name, activity] of [
  ['thinking', { currentStatus: { status: 'thinking' } }],
  ['planning', { buildNarration: narration('planning'), isGeneratingStrawman: true }],
  ['pending_reply', { awaitingDirectorReply: true }],
]) check(`dismissed_${name}_does_not_cover_native_blank`, () => {
  const rendered = fixture().render({ ...baseProps, ...activity, blankPlaceholderDismissed: true })
  assert.equal(Boolean(rendered.placeholder), !fixed, `${name} waiting cover must honor prior dismissal`)
  assert.equal(rendered.iframe.props.src, url)
  return { waitingCover: Boolean(rendered.placeholder), expectedRegressionBefore: !fixed, nativeIframeMounted: true, sameNativeSource: true }
})

check('initial_planning_exact_callback_then_rerender_removes_cover', () => {
  const f = fixture(), plan = narration('planning')
  let dismissed = false, callbacks = 0
  const onDismiss = () => { callbacks++; dismissed = true }
  const props = { ...baseProps, buildNarration: plan, isGeneratingStrawman: true, onDismissBlankPlaceholder: onDismiss }
  const initial = f.render(props)
  assert.ok(initial.placeholder)
  assert.equal(initial.placeholderInNative, true)
  assert.equal(initial.dismissButtons.length, fixed ? 1 : 0, 'Initial waiting cover retains one native parent dismiss affordance')
  if (!fixed) return { planningCover: true, dismissAffordances: 0, expectedRegressionBefore: true, nativeIframeMounted: true }
  const button = initial.dismissButtons[0]
  assert.equal(button.props.onClick, onDismiss, 'The precise parent callback is preserved')
  button.props.onClick()
  assert.equal(callbacks, 1)
  const after = f.render({ ...props, blankPlaceholderDismissed: dismissed })
  assert.equal(after.placeholder, undefined)
  assert.equal(after.iframe.props.src, initial.iframe.props.src)
  assert.equal(after.viewer.props.presentationId, initial.viewer.props.presentationId)
  assert.equal(after.viewer.props.stageChrome.ribbon.props.narration, plan)
  assert.equal(after.viewer.props.stageChrome.footer.props.narration, plan)
  return { planningCover: true, dismissAffordances: 1, exactCallbackPreserved: true, callbacks, afterCover: false,
    sameNativeSource: true, samePresentationId: true, realPlanningChromePreserved: true }
})

check('building_outline_intro_shield_survives_blank_dismissal', () => {
  const plan = narration('building'), controls = { enabled: true, onPause: refuse, onStop: refuse, onResume: refuse }
  const rendered = fixture().render({ ...baseProps, activeVersion: 'strawman', isBlankPresentation: false,
    blankPlaceholderDismissed: true, showOutlinePreview: true, buildNarration: plan, buildNarrationApi: { control: controls } })
  assert.equal(rendered.placeholder?.props['data-studio-outline-preview'], 'true')
  assert.equal(rendered.dismissButtons.length, 0)
  assert.equal(viewerNodes(rendered.placeholder).some(node => typeof node.props?.onClick === 'function'), false)
  assert.equal(rendered.placeholder.props.className.includes('pointer-events-none'), true)
  assert.equal(rendered.placeholderInNative, true)
  assert.equal(rendered.viewer.props.stageChrome.ribbon.props.control, controls)
  assert.equal(rendered.viewer.props.stageChrome.ribbon.props.narration, plan)
  assert.equal(rendered.iframe.props.src, url)
  return { actionlessOutlineShieldRetained: true, dismissAffordances: 0, nativeIframeMounted: true,
    realBuildControlIdentityPreserved: true, sameNativeSource: true }
})

check('genuine_build_chrome_never_gets_blank_dismiss_callback', () => {
  for (const phase of ['building', 'paused', 'error']) {
    const rendered = fixture().render({ ...baseProps, activeVersion: 'strawman', isBlankPresentation: false,
      blankPlaceholderDismissed: true, buildNarration: narration(phase), showOutlinePreview: false })
    assert.equal(rendered.dismissButtons.length, 0)
    assert.equal(rendered.placeholder, undefined)
    assert.equal(rendered.viewer.props.stageChrome.ribbon.props.narration.phase, phase)
    assert.equal(rendered.iframe.props.src, url)
  }
  return { buildingPausedErrorRemainNative: true, dismissAffordances: 0 }
})

const receipt = { source: sourceRef ?? 'working-source', beforeRef: before, expectedFixed: fixed, runtime: process.version,
  level: 'Actual PresentationArea function/JSX, actual native PresentationViewer function/hook harness, synthetic parent callback/rerender. Child waiting/ribbon components are named leaves; no browser/native iframe execution or services.',
  sourceHashes: Object.fromEntries(['components/builder/presentation-area.tsx', 'components/presentation-viewer.tsx', 'lib/studio-canvas-lifecycle.ts']
    .map(file => [file, createHash('sha256').update(read(file)).digest('hex')])),
  checks: results.length, results, connectedCauseProven: false }
const evidence = process.argv.find(arg => arg.startsWith('--evidence='))?.slice('--evidence='.length)
if (evidence) fs.writeFileSync(evidence, JSON.stringify(receipt, null, 2) + '\n')
console.log(`${results.length} actual Area/native blank-dismiss groups passed (${fixed ? 'candidate' : 'before regression receipt'})`)
