// Offline leaf and specimen-control checks. Browser geometry/focus proof belongs to strict native capture.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import postcss from 'postcss'

const require = createRequire(import.meta.url)
const root = new URL('../', import.meta.url)
const read = file => fs.readFileSync(new URL(file, root), 'utf8')
const compile = (source, filename) => {
  const result = ts.transpileModule(source, { fileName: filename, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } })
  assert.equal((result.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error).length, 0, filename)
  return result.outputText
}
const load = (file, overrides, studio = true) => {
  const module = { exports: {} }
  vm.runInNewContext(compile(read(file), file), { module, exports: module.exports, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: studio ? 'true' : 'false' } }, require: id => id in overrides ? overrides[id] : id.endsWith('.css') ? {} : require(id) })
  return module.exports
}
const find = (tree, predicate, result = []) => {
  if (!tree || typeof tree !== 'object') return result
  if (predicate(tree)) result.push(tree)
  React.Children.forEach(tree.props?.children, child => find(child, predicate, result))
  return result
}
const json = value => JSON.parse(JSON.stringify(value))
const heuristics = load('lib/build-narration-heuristics.ts', {})
const phases = ['idle', 'planning', 'strawman', 'awaiting_user', 'building', 'qa', 'finalizing', 'complete', 'paused', 'stopped', 'error']
let checks = 0
for (const phase of phases) for (const enabled of [false, true]) for (const dismissed of [false, true]) for (const authored of [false, true]) for (const generating of [false, true]) for (const url of [false, true]) {
  assert.equal(heuristics.shouldShowBlankPlaceholder(enabled, { phase, dismissed, hasSlideStructure: authored, isGenerating: generating, hasPresentationUrl: url }), enabled && !dismissed && !authored && !generating && url && ['idle', 'planning'].includes(phase), `visibility gate ${JSON.stringify({phase, enabled, dismissed, authored, generating, url})}`)
  checks++
}
assert.equal(heuristics.shouldShowBlankPlaceholder(true, { hasPresentationUrl: true }), true)
assert.equal(heuristics.shouldShowBlankPlaceholder(undefined, { hasPresentationUrl: true }), false)
checks += 2

const MotionDiv = ({ animate, transition, ...props }) => React.createElement('div', props)
for (const studio of [false, true]) for (const reduced of [false, true]) for (const mode of ['overlay', 'standalone']) for (const hasDismiss of [false, true]) {
  let dismissed = 0
  const callback = () => dismissed++
  const { StagePlaceholder } = load('components/build-narration/stage-placeholder.tsx', { 'framer-motion': { motion: { div: MotionDiv }, useReducedMotion: () => reduced } }, studio)
  const tree = StagePlaceholder({ mode, onDismiss: hasDismiss ? callback : undefined, className: 'fixture-class' })
  const buttons = find(tree, node => node.type === 'button')
  assert.equal(buttons.length, hasDismiss ? 1 : 0)
  if (hasDismiss) {
    assert.equal(buttons[0].props.type, 'button')
    assert.equal(buttons[0].props.onClick, callback)
    assert.match(buttons[0].props.className, /focus-visible:outline/)
    buttons[0].props.onClick()
    assert.equal(dismissed, 1)
  }
  assert.match(tree.props.className, mode === 'overlay' ? /absolute inset-0/ : /aspect-video w-full max-w-5xl/)
  assert.match(tree.props.className, /fixture-class/)
  assert.equal(tree.props['data-studio-stage-placeholder'], studio ? mode : undefined)
  assert.equal(tree.props['data-has-dismiss'], studio ? String(hasDismiss) : undefined)
  const guidance = find(tree, node => node.type === MotionDiv)[0]
  assert.deepEqual(json(guidance.props.animate ?? null), reduced ? null : { y: [0, -6, 0] })
  if (reduced) assert.equal(guidance.props.transition, undefined)
  else {
    assert.equal(guidance.props.transition.duration, 5)
    assert.equal(guidance.props.transition.repeat, Infinity)
    assert.equal(guidance.props.transition.ease, 'easeInOut')
  }
  const html = renderToStaticMarkup(tree)
  assert.match(html, /Your deck will appear here/)
  assert.match(html, /Tell Director what you want to build/)
  assert.match(html, /logo-icon.png/)
  checks++
}

let state = [], cursor = 0
const PanelViewer = () => null, Placeholder = () => null
const fakeReact = { ...React, useState(initial) { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], next => { state[index] = typeof next === 'function' ? next(state[index]) : next }] } }
const fixtureFile = 'scripts/studio-v4/ten-hour-stage-placeholder-fixture.tsx'
const { default: Fixture } = load(fixtureFile, { react: fakeReact, '@/components/build-narration/stage-placeholder': { StagePlaceholder: Placeholder }, '@/components/presentation-viewer': { PresentationViewer: PanelViewer }, '@/lib/build-narration-heuristics': heuristics })
const render = () => { cursor = 0; return Fixture() }
const select = (value) => { const tree = render(); find(tree, node => node.type === 'select')[0].props.onChange({ target: { value } }); return render() }
let tree = render(), viewer = find(tree, node => node.type === PanelViewer)[0]
assert.equal(viewer.props.isGenerating, false)
assert.equal(viewer.key, null)
assert.equal(viewer.props.stageChrome.placeholder.props.mode, 'overlay')
const initialUrl = viewer.props.presentationUrl
viewer.props.stageChrome.placeholder.props.onDismiss()
tree = render(); viewer = find(tree, node => node.type === PanelViewer)[0]
assert.equal(viewer.props.stageChrome.placeholder, undefined)
assert.equal(tree.props['data-studio-stage-specimen-dismissed'], 'true')
assert.equal(viewer.props.presentationUrl, initialUrl)
find(tree, node => node.props['data-studio-stage-specimen-reset'] === 'true')[0].props.onClick()
assert.equal(find(render(), node => node.type === PanelViewer)[0].props.stageChrome.placeholder.props.mode, 'overlay')
checks++
for (const selected of ['idle', 'planning', 'authored', 'feature-off', 'strawman']) {
  tree = select(selected); viewer = find(tree, node => node.type === PanelViewer)[0]
  assert.equal(tree.props['data-studio-stage-specimen-state'], selected)
  assert.equal(tree.props['data-studio-stage-specimen-dismissed'], 'false')
  assert.equal(viewer.props.isGenerating, false)
  assert.equal(viewer.props.presentationUrl, initialUrl)
  assert.equal(Boolean(viewer.props.stageChrome.placeholder), ['idle', 'planning'].includes(selected))
  checks++
}
tree = select('standalone')
assert.equal(find(tree, node => node.type === PanelViewer).length, 0)
const standalone = find(tree, node => node.type === Placeholder)[0]
assert.equal(standalone.props.mode, 'standalone')
assert.equal(standalone.props.onDismiss, undefined)
checks++

const source = read(fixtureFile)
assert.doesNotMatch(source, /\bfetch\s*\(|postMessage\s*\(|localStorage|sessionStorage|setTimeout|WebSocket|searchParams|SlideBuildingLoader|useStageWalkthrough/)
const parent = read('components/builder/presentation-area.tsx'), viewerSource = read('components/presentation-viewer.tsx')
assert.match(parent, /<StagePlaceholder mode="overlay" onDismiss=\{onDismissBlankPlaceholder\}/)
assert.match(parent, /<StagePlaceholder mode="standalone" \/>/)
assert.match(parent, /StudioWelcomeStage \/>/)
assert.match(viewerSource, /!isFullscreen && stageChrome\?\.placeholder/)
assert.ok(viewerSource.indexOf('<iframe') < viewerSource.indexOf('!isFullscreen && stageChrome?.placeholder'))
const css = read('components/build-narration/studio-stage-leafs.css')
postcss.parse(css)
assert.match(css, /@container studio-stage-placeholder \(max-width: 480px\)/)
assert.match(css, /@container studio-stage-placeholder \(max-width: 300px\)/)
assert.match(css, /\[data-studio-stage-placeholder-dismiss\]:focus-visible \{ outline: 2px solid var\(--ss-accent\)/)
assert.match(css, /\[data-studio-stage-placeholder-guidance\] \{[^}]*max-height: 100%;[^}]*overflow-y: auto/)
assert.match(css, /\[data-studio-stage-placeholder\]\[data-has-dismiss="true"\] \[data-studio-stage-placeholder-inner\] \{ padding-bottom: 40px/)
checks++
console.log(`${checks} offline stage-placeholder visibility, leaf, motion, callback and specimen checks passed. Native viewport geometry and DOM focus require Root's isolated browser capture.`)
