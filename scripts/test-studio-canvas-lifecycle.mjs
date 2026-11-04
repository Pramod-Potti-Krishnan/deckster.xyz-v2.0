import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import ts from 'typescript'

const root = new URL('../', import.meta.url)
const uat = 'ee532fab4b84a6883f8a5b50675ccab692b62240'
const accepted = '33bbd65f2cb8566498a75500e94298346c58bd80'
const read = (file, ref = null) => ref
  ? execFileSync('git', ['show', `${ref}:${file}`], { encoding: 'utf8', cwd: fileURLToPath(root) })
  : fs.readFileSync(new URL(file, root), 'utf8')
function evaluate(source, context = {}) {
  const compiled = ts.transpileModule(source, { reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  assert.equal(compiled.diagnostics?.filter(item => item.category === ts.DiagnosticCategory.Error).length ?? 0, 0)
  const mod = { exports: {} }
  vm.runInNewContext(compiled.outputText, { module: mod, exports: mod.exports, ...context })
  return mod.exports
}
export const { classifyStudioCanvasLifecycle } = evaluate(read('lib/studio-canvas-lifecycle.ts'))

// Execute the actual JSX component's extracted decision expression, rather
// than copy its rules. This is source seam evidence, not a mounted component.
function variableExpression(file, name, ref) {
  const source = read(file, ref)
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let found
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === name && node.initializer) {
      assert.equal(found, undefined, `Ambiguous ${name}`)
      found = node.initializer.getText(parsed)
    }
    ts.forEachChild(node, visit)
  }
  visit(parsed)
  assert.ok(found, `Missing actual source seam ${name}`)
  return found
}
export function evaluateLegacyCanvasLanding(context, ref = accepted) {
  const { shouldShowBlankPlaceholder } = evaluate(read('lib/build-narration-heuristics.ts', ref))
  return evaluate(`export const result = ${variableExpression('components/builder/presentation-area.tsx', 'showBlankPlaceholder', ref)}`,
    { ...context, shouldShowBlankPlaceholder }).result
}
export function evaluateRestoredCanvasMetadata(session, ref = accepted) {
  return evaluate(`export const result = ${variableExpression('hooks/use-builder-session.ts', 'restoredSessionState', ref)}`,
    { session, process: { env: { NEXT_PUBLIC_STUDIO_V4_SHELL: 'true' } } }).result
}
export function evaluateCurrentStudioOverlay(context) {
  return evaluate(`const workingPlaceholder = ${variableExpression('components/builder/presentation-area.tsx', 'workingPlaceholder', null)};
    export const result = ${variableExpression('components/builder/presentation-area.tsx', 'showBlankPlaceholder', null)}`, context).result
}

export function generatedCanvasFixture() {
  return {
    displayedSessionId: 'synthetic-session', deckOwnerSessionId: 'synthetic-session',
    selected: { presentationId: 'synthetic-final', presentationUrl: 'https://layout.invalid/p/synthetic-final', activeVersion: 'final', slideCount: 5 },
    finalPresentationId: 'synthetic-final', finalPresentationUrl: 'https://layout.invalid/p/synthetic-final',
    hasAuthoredStructure: false, loading: false, generating: false, phase: 'idle', dismissed: false,
    connected: true, connecting: false,
  }
}

export function runCanvasLifecycleChecks() {
  const results = []
  function check(name, fixture, expected) {
    const result = classifyStudioCanvasLifecycle(fixture)
    for (const [key, value] of Object.entries(expected)) assert.equal(result[key], value, `${name}: ${key}`)
    results.push({ case: name, mode: result.mode, showLanding: result.showLanding, hasGeneratedDeck: result.hasGeneratedDeck })
  }
  const generated = generatedCanvasFixture()
  check('owned_completed_no_outline_structure', generated, { mode: 'generated', showLanding: false, hasGeneratedDeck: true })
  check('cold_restore_before_socket_adoption', { ...generated, connected: false, connecting: true }, { mode: 'generated', connection: 'connecting', showLanding: false })
  check('disconnected_completed_deck_remains', { ...generated, connected: false }, { mode: 'generated', connection: 'disconnected', showLanding: false })
  check('loading_does_not_offer_fresh_start', { ...generated, loading: true }, { mode: 'loading', showLanding: false })
  check('different_session_selected_metadata', { ...generated, deckOwnerSessionId: 'synthetic-other' }, { mode: 'awaiting_owner', hasGeneratedDeck: false, showLanding: false })
  check('missing_metadata_owner', { ...generated, deckOwnerSessionId: null }, { mode: 'awaiting_owner', showLanding: false })
  check('missing_displayed_session', { ...generated, displayedSessionId: null }, { mode: 'awaiting_owner', showLanding: false })
  check('explicit_blank_version_retains_tools', { ...generated, selected: { ...generated.selected, activeVersion: 'blank', presentationId: 'synthetic-blank', presentationUrl: 'https://layout.invalid/p/synthetic-blank', slideCount: 1 } }, { mode: 'blank', hasGeneratedDeck: false, hasOwnedFinal: true, showLanding: true })
  check('blank_dismissal_remains', { ...generated, selected: { ...generated.selected, activeVersion: 'blank' }, dismissed: true }, { mode: 'blank', showLanding: false })
  check('authored_manual_deck', { ...generated, selected: { ...generated.selected, activeVersion: 'blank' }, hasAuthoredStructure: true }, { mode: 'authored', showLanding: false })
  check('authored_strawman', { ...generated, selected: { ...generated.selected, activeVersion: 'strawman' }, hasAuthoredStructure: true }, { mode: 'authored', showLanding: false })
  for (const count of [null, 0, -1, NaN, Infinity, 1.5]) {
    check(`uncertain_count_${String(count)}`, { ...generated, selected: { ...generated.selected, slideCount: count } }, { hasGeneratedDeck: false })
  }
  check('different_final_identity', { ...generated, finalPresentationId: 'synthetic-old-final' }, { hasGeneratedDeck: false })
  check('different_canonical_final_url', { ...generated, finalPresentationUrl: generated.finalPresentationUrl + '?other=1' }, { hasGeneratedDeck: false })
  check('missing_final_pair', { ...generated, finalPresentationId: null }, { hasGeneratedDeck: false, hasOwnedFinal: false })
  check('owned_final_missing_selected_url', { ...generated, selected: { ...generated.selected, presentationUrl: null } }, { mode: 'awaiting_viewer', hasGeneratedDeck: false, showLanding: false })
  check('owned_final_missing_selected_id', { ...generated, selected: { ...generated.selected, presentationId: null } }, { mode: 'awaiting_viewer', hasGeneratedDeck: false, showLanding: false })
  check('owned_final_missing_selected_pair', { ...generated, selected: { ...generated.selected, presentationId: null, presentationUrl: null } }, { mode: 'awaiting_viewer', showLanding: false })
  check('missing_viewer_without_positive_count_not_generated', { ...generated, selected: { ...generated.selected, presentationUrl: null, slideCount: 0 } }, { mode: 'blank', hasGeneratedDeck: false })
  check('manual_blank_missing_viewer_not_final_recovery', { ...generated, selected: { ...generated.selected, presentationUrl: null, activeVersion: 'blank' } }, { mode: 'blank', hasGeneratedDeck: false })
  check('foreign_final_missing_viewer_never_recovered', { ...generated, deckOwnerSessionId: 'synthetic-other', selected: { ...generated.selected, presentationUrl: null } }, { mode: 'awaiting_owner', hasOwnedFinal: false, showLanding: false })
  const empty = { ...generated, selected: { presentationId: null, presentationUrl: null, activeVersion: 'final', slideCount: null }, finalPresentationId: null, finalPresentationUrl: null, deckOwnerSessionId: null }
  check('fresh_no_deck', empty, { mode: 'empty', showLanding: true })
  check('initial_connecting_not_completion', { ...empty, connecting: true, connected: false }, { mode: 'empty', connection: 'connecting', hasGeneratedDeck: false })
  check('initial_generating_without_url', { ...empty, generating: true }, { mode: 'preparing', showLanding: false })
  check('partial_build_no_final_pair', { ...generated, finalPresentationId: null, finalPresentationUrl: null, phase: 'building' }, { mode: 'preparing', showLanding: false })
  check('paused_build_preserves_recovery', { ...generated, finalPresentationId: null, phase: 'paused' }, { mode: 'preparing', showLanding: false })
  check('error_build_preserves_recovery', { ...generated, finalPresentationId: null, phase: 'error' }, { mode: 'preparing', showLanding: false })
  check('legacy_planning_landing', { ...generated, finalPresentationId: null, phase: 'planning' }, { mode: 'blank', showLanding: true })

  const sourceSeams = []
  for (const ref of [uat, accepted]) {
    const { initialNarrationState, narrationReducer } = evaluate(read('lib/build-narration-heuristics.ts', ref))
    const coldNarration = narrationReducer(initialNarrationState(), { type: 'final_url', presentationId: 'synthetic-final', ts: 1 })
    assert.equal(coldNarration.active, false)
    const metadata = evaluateRestoredCanvasMetadata({ id: 'synthetic-session', finalPresentationId: generated.finalPresentationId,
      finalPresentationUrl: generated.finalPresentationUrl, blankPresentationId: 'synthetic-blank', blankPresentationUrl: 'https://layout.invalid/p/synthetic-blank',
      slideCount: 5, currentStage: 6, stateCache: null }, ref)
    assert.equal(metadata.slideStructure, null)
    assert.equal(metadata.isBlankPresentation, true)
    const coveredBefore = evaluateLegacyCanvasLanding({ buildNarrationEnabled: true, blankPlaceholderDismissed: false,
      slideStructure: metadata.slideStructure, narrationActive: coldNarration.active, narrationPhase: coldNarration.phase,
      isGeneratingFinal: false, isGeneratingStrawman: false, presentationUrl: metadata.presentationUrl }, ref)
    assert.equal(coveredBefore, true, 'Actual restored final URL is covered by inherited idle gate')
    const after = classifyStudioCanvasLifecycle(generated)
    assert.equal(after.showLanding, false)
    sourceSeams.push({ sourceRef: ref, restoredStructureAbsent: true, retainedBlankFlag: true,
      coldNarrationActive: coldNarration.active, coldNarrationPhase: coldNarration.phase,
      inheritedOverlayBefore: coveredBefore, lifecycleLandingAfter: after.showLanding })
  }
  const currentOverlaySeams = []
  const blank = { ...generated, selected: { ...generated.selected, activeVersion: 'blank' }, finalPresentationId: null }
  for (const [name, fixture, expected] of [
    ['planning_owned_blank_waiting_overlay', { ...blank, generating: true, phase: 'planning' }, true],
    ['known_generated_never_waiting_overlay', generated, false],
    ['foreign_selection_never_working_overlay', { ...blank, deckOwnerSessionId: 'synthetic-other' }, false],
    ['authored_selection_never_working_overlay', { ...blank, hasAuthoredStructure: true }, false],
    ['dismissed_planning_never_working_overlay', { ...blank, generating: true, phase: 'planning', dismissed: true }, false],
  ]) {
    const overlay = evaluateCurrentStudioOverlay({ studioShell: true, lifecycle: classifyStudioCanvasLifecycle(fixture),
      waitingForDirector: true, narrationPhase: 'planning', legacyBlankPlaceholder: false,
      blankPlaceholderDismissed: fixture.dismissed })
    assert.equal(overlay, expected, name)
    currentOverlaySeams.push({ case: name, overlay })
  }
  return { level: 'Actual-source extracted landing/restore expressions plus pure helper; synthetic ownership and fields; no mounted viewer/browser/connected claims',
    runtime: process.version,
    sourceHashes: Object.fromEntries(['lib/studio-canvas-lifecycle.ts', 'scripts/test-studio-canvas-lifecycle.mjs']
      .map(file => [file, createHash('sha256').update(read(file)).digest('hex')])),
    checks: results.length, results, sourceSeams, currentOverlaySeams }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const receipt = runCanvasLifecycleChecks()
  const evidence = process.argv.find(value => value.startsWith('--evidence='))?.slice('--evidence='.length)
  if (evidence) fs.writeFileSync(evidence, JSON.stringify(receipt, null, 2) + '\n')
  console.log(`Studio canvas lifecycle: ${receipt.checks} cases, ${receipt.sourceSeams.length} exact-source before/after and ${receipt.currentOverlaySeams.length} current consumer seam checks passed`)
}
