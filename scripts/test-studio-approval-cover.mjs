import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import ts from 'typescript'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
const configuredOrigin = 'https://layout.invalid'
function viewerNodes(node) {
  if (node == null || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(viewerNodes)
  return [node, ...viewerNodes(node.props?.children)]
}

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
  const dependencies = { react: React, 'react/jsx-runtime': jsxRuntime }
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
  return {
    render(props) {
      const tree = PresentationArea(props)
      const viewer = viewerNodes(tree).find(node => node.type === dependencies['@/components/presentation-viewer'].PresentationViewer)
      assert.ok(viewer, 'Native Viewer remains mounted')
      return { viewer, placeholder: viewer.props.stageChrome?.placeholder,
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

for (const phase of ['idle', 'planning', 'awaiting_user']) {
  check(`owned_contentless_${phase}_keeps_waiting_cover`, () => {
    const actual = fixture().render({ ...baseProps, currentStatus: { status: 'awaiting_user' }, buildNarration: narration(phase) })
    assert.ok(actual.placeholder, 'Real approval gate must keep the owned contentless canvas covered')
    assert.equal(viewerNodes(actual.placeholder).find(node => node.props?.activity === 'awaiting_user')?.props.activity, 'awaiting_user')
    assert.equal(actual.viewer.props.stageChrome.ribbon.props.narration.phase, phase)
    assert.equal(actual.viewer.props.presentationUrl, url)
    return { cover: true, gatePhasePreserved: phase, nativeSourcePreserved: true }
  })
  check(`dismissed_${phase}_preserves_native_access`, () => {
    const actual = fixture().render({ ...baseProps, currentStatus: { status: 'awaiting_user' }, buildNarration: narration(phase), blankPlaceholderDismissed: true })
    assert.equal(actual.placeholder, undefined)
    assert.equal(actual.viewer.props.presentationUrl, url)
    return { cover: false, nativeSourcePreserved: true }
  })
}
for (const state of [
  { activeVersion: 'strawman', isBlankPresentation: false, strawmanPreviewUrl: url, slideStructure: { slides: [{ title: 'Owned outline' }] } },
  { activeVersion: 'final', isBlankPresentation: false, finalPresentationUrl: url, publishFinalPresentationId: 'synthetic-blank-dismiss' },
  { slideStructure: { slides: [{ title: 'Owned authored slide' }] } },
]) check('authored_generated_foreign_canvas_not_covered', () => {
  const actual = fixture().render({ ...baseProps, ...state, currentStatus: { status: 'awaiting_user' }, buildNarration: narration('awaiting_user') })
  assert.equal(actual.placeholder, undefined)
  return { cover: false, context: state }
})
check('real_waiting_dismiss_callback_preserved', () => {
  let dismissed = false
  const callback = () => { dismissed = true }
  const props = { ...baseProps, currentStatus: { status: 'awaiting_user' }, buildNarration: narration('awaiting_user'), onDismissBlankPlaceholder: callback }
  const f = fixture(), actual = f.render(props)
  assert.equal(actual.dismissButtons.length, 1)
  assert.equal(actual.dismissButtons[0].props.onClick, callback)
  actual.dismissButtons[0].props.onClick()
  assert.equal(f.render({ ...props, blankPlaceholderDismissed: dismissed }).placeholder, undefined)
  return { callbackIdentityPreserved: true, explicitDismissWorks: true }
})
const receipt = { source: sourceRef ?? 'working-source', runtime: process.version,
  level: 'Actual PresentationArea function/JSX and actual lifecycle libraries; Viewer/waiting/ribbon are named child leaves. No ReactDOM/browser/native execution or services.',
  sourceHashes: Object.fromEntries(['components/builder/presentation-area.tsx', 'lib/studio-canvas-lifecycle.ts'].map(file => [file, createHash('sha256').update(read(file)).digest('hex')])), checks: results.length, results, connectedFixProven: false }
const evidence = process.argv.find(arg => arg.startsWith('--evidence='))?.slice('--evidence='.length)
if (evidence) fs.writeFileSync(evidence, JSON.stringify(receipt, null, 2) + '\n')
console.log(`${results.length} actual Area approval-cover cases passed`)
