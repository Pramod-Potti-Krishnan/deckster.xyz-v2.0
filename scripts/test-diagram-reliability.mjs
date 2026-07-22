import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function loadTypeScript(relativePath) {
  const source = fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  })
  const mod = { exports: {} }
  vm.runInNewContext(compiled.outputText, { module: mod, exports: mod.exports })
  return mod.exports
}

const rendererState = loadTypeScript('../lib/diagram-renderer-state.ts')
const mergedLiveGantt = rendererState.mergeLiveDiagramRendererConfig(
  {
    diagram_type: 'GANTT_CHART',
    settings: { time_unit: 'months', task_column_width_px: 270 },
    renderer_states: { gantt: { task_column_width_px: 270 } },
    renderer_state_actions: { gantt: 'staleAction' },
    renderer_state_content_dirty: { gantt: false },
  },
  { time_unit: 'months', task_column_width_px: 270 },
  {
    diagram_type: 'GANTT_CHART',
    settings: { time_unit: 'weeks', task_column_width_px: 390 },
    renderer_states: { gantt: { task_column_width_px: 390 } },
    renderer_state_actions: { gantt: 'taskColumnResize' },
    renderer_state_content_dirty: { gantt: true },
  },
)
assert.equal(mergedLiveGantt.generationConfig.settings.time_unit, 'months')
assert.equal(mergedLiveGantt.generationConfig.settings.task_column_width_px, 390)
assert.equal(mergedLiveGantt.generationConfig.renderer_states.gantt.task_column_width_px, 390)
assert.equal(
  mergedLiveGantt.generationConfig.renderer_state_actions.gantt,
  'taskColumnResize',
)
assert.equal(
  mergedLiveGantt.generationConfig.renderer_state_content_dirty.gantt,
  true,
)
assert.equal(mergedLiveGantt.diagramConfig.task_column_width_px, 390)

const mergedLiveChevron = rendererState.mergeLiveDiagramRendererConfig(
  {
    diagram_type: 'CHEVRON_MATURITY',
    settings: { time_unit: 'quarters', row_label_width_px: 180 },
  },
  { time_unit: 'quarters' },
  {
    diagram_type: 'CHEVRON_MATURITY',
    settings: { row_label_width_px: 264 },
    renderer_states: { chevron: { row_label_width_px: 264 } },
  },
)
assert.equal(mergedLiveChevron.generationConfig.settings.row_label_width_px, 264)
assert.equal(mergedLiveChevron.diagramConfig.row_label_width_px, 264)

const parsedGantt = rendererState.parseDiagramRendererStateUpdate({
  type: 'updateGanttState',
  elementId: 'diagram:gantt-1',
  ganttData: {
    task_column_width_px: 360,
    tasks: [{ task: 'Factory acceptance test' }],
  },
  action: 'taskColumnResize',
})
assert.equal(parsedGantt.rendererType, 'gantt')
assert.equal(parsedGantt.action, 'taskColumnResize')
assert.equal(parsedGantt.state.task_column_width_px, 360)
assert.equal(parsedGantt.state.tasks[0].task, 'Factory acceptance test')
assert.equal(
  rendererState.parseDiagramRendererStateUpdate({
    type: 'updateGanttState',
    elementId: '<script>alert(1)</script>',
    ganttData: { task_column_width_px: 360 },
  }),
  null,
)
const parsedLogical = rendererState.parseDiagramRendererStateUpdate({
  type: 'updateLogArchState',
  elementId: 'diagram:logical-1',
  logArchData: { components: [{ id: 'api' }] },
})
assert.equal(parsedLogical.rendererType, 'logical_architecture')
assert.equal(parsedLogical.state.components[0].id, 'api')
const parsedData = rendererState.parseDiagramRendererStateUpdate({
  type: 'updateDataArchitectureState',
  elementId: 'diagram:data-1',
  dataArchitectureData: { entities: [{ name: 'Account' }] },
})
assert.equal(parsedData.rendererType, 'data_architecture')
assert.equal(parsedData.state.entities[0].name, 'Account')
assert.equal(
  rendererState.parseDiagramRendererStateUpdate({
    type: 'updateGanttState',
    elementId: 'diagram:gantt-2',
    ganttData: { oversized: 'x'.repeat(256 * 1024 + 1) },
  }),
  null,
)

const timeout = loadTypeScript('../lib/element-generation-timeout.ts')
assert.equal(timeout.resolveElementGenerationTimeoutMs('DIAGRAM_AUTO', 'off'), 150_000)

const generationRetry = loadTypeScript('../lib/element-generation-retry.ts')
const frozenFingerprint = generationRetry.diagramGenerationRequestFingerprint({
  sessionId: 'session-1',
  message: 'Build an AWS event platform',
  options: {
    componentType: 'CLOUD_ARCHITECTURE',
    generationAttemptId: 'attempt-old',
    deadlineMs: 140_000,
    generationConfig: {
      settings: { provider: 'aws', show_layers: true },
      diagram_type: 'CLOUD_ARCHITECTURE',
    },
  },
})
assert.equal(
  generationRetry.diagramGenerationRequestFingerprint({
    sessionId: 'session-1',
    message: 'Build an AWS event platform',
    options: {
      generationConfig: {
        diagram_type: 'CLOUD_ARCHITECTURE',
        settings: { show_layers: true, provider: 'aws' },
      },
      deadlineMs: 93_000,
      generationAttemptId: 'attempt-retry',
      componentType: 'CLOUD_ARCHITECTURE',
    },
  }),
  frozenFingerprint,
  'object key order and transport-only fields do not change request identity',
)
const editedFingerprint = generationRetry.diagramGenerationRequestFingerprint({
  sessionId: 'session-1',
  message: 'Build a GCP event platform',
  options: {
    componentType: 'CLOUD_ARCHITECTURE',
    generationConfig: {
      diagram_type: 'CLOUD_ARCHITECTURE',
      settings: { provider: 'gcp', show_layers: true },
    },
  },
})
assert.notEqual(
  editedFingerprint,
  frozenFingerprint,
  'prompt/config edits invalidate transport retry identity',
)
assert.notEqual(
  generationRetry.diagramGenerationRequestFingerprint({
    sessionId: 'session-2',
    message: 'Build an AWS event platform',
    options: {
      componentType: 'CLOUD_ARCHITECTURE',
      generationConfig: {
        diagram_type: 'CLOUD_ARCHITECTURE',
        settings: { provider: 'aws', show_layers: true },
      },
    },
  }),
  frozenFingerprint,
  'a deliberate Text Labs session reset is a different HTTP request identity',
)
const identicalRetry = generationRetry.resolveDiagramGenerationAttemptId({
  submitIntent: 'retry',
  freshAttemptId: 'fresh-attempt',
  requestFingerprint: frozenFingerprint,
  retryCandidate: {
    attemptId: 'failed-attempt',
    requestFingerprint: frozenFingerprint,
  },
})
assert.equal(identicalRetry.attemptId, 'failed-attempt')
assert.equal(identicalRetry.reused, true)
const ambiguousCandidate = {
  attemptId: 'ambiguous-paid-attempt',
  requestFingerprint: frozenFingerprint,
}
const candidateAfterFailedRetryPreflight =
  generationRetry.diagramRetryCandidateForPreDispatch(
    'retry',
    ambiguousCandidate,
  )
assert.deepEqual(
  candidateAfterFailedRetryPreflight,
  ambiguousCandidate,
  'an explicit retry that exits before dispatch retains the ambiguous paid request identity',
)
const retryAfterRecoveredPreflight = generationRetry.resolveDiagramGenerationAttemptId({
  submitIntent: 'retry',
  freshAttemptId: 'must-not-be-used',
  requestFingerprint: frozenFingerprint,
  retryCandidate: generationRetry.diagramRetryCandidateForPreDispatch(
    'retry',
    candidateAfterFailedRetryPreflight,
  ),
})
assert.equal(
  retryAfterRecoveredPreflight.attemptId,
  'ambiguous-paid-attempt',
  'ambiguous failure -> failed retry preflight -> next explicit retry reuses the original attempt',
)
assert.equal(
  generationRetry.diagramRetryCandidateForPreDispatch(
    'generate',
    ambiguousCandidate,
  ),
  null,
  'a deliberate Generate action abandons the ambiguous retry identity',
)
const intentionalRegeneration = generationRetry.resolveDiagramGenerationAttemptId({
  submitIntent: 'generate',
  freshAttemptId: 'fresh-attempt',
  requestFingerprint: frozenFingerprint,
  retryCandidate: {
    attemptId: 'failed-attempt',
    requestFingerprint: frozenFingerprint,
  },
})
assert.equal(intentionalRegeneration.attemptId, 'fresh-attempt')
assert.equal(
  intentionalRegeneration.reused,
  false,
  'the normal send/regenerate action always mints a fresh attempt',
)
const editedRetry = generationRetry.resolveDiagramGenerationAttemptId({
  submitIntent: 'retry',
  freshAttemptId: 'fresh-after-edit',
  requestFingerprint: editedFingerprint,
  retryCandidate: {
    attemptId: 'failed-attempt',
    requestFingerprint: frozenFingerprint,
  },
})
assert.equal(editedRetry.attemptId, 'fresh-after-edit')
assert.equal(
  editedRetry.reused,
  false,
  'an explicit retry after a request edit mints a fresh attempt',
)
assert.equal(
  generationRetry.remainingDiagramBackendDeadlineMs(150_000, 0),
  140_000,
)
assert.equal(
  generationRetry.remainingDiagramBackendDeadlineMs(150_000, 8_500),
  131_500,
  'session/preflight elapsed time is removed from the propagated deadline',
)
assert.equal(
  generationRetry.remainingDiagramBackendDeadlineMs(11_000, 0),
  1_000,
)
assert.equal(
  generationRetry.remainingDiagramBackendDeadlineMs(10_999, 0),
  null,
  'no paid request starts without the minimum budget and cleanup reserve',
)
assert.equal(
  generationRetry.remainingFreshDiagramBackendDeadlineMs(70_000, 0),
  60_000,
  'a recovered G2 receives the full 60s Diagram Generator HTTP window',
)
assert.equal(
  generationRetry.remainingFreshDiagramBackendDeadlineMs(69_999, 0),
  null,
  'a recovered G2 is suppressed when only 59,999ms remains after cleanup',
)
assert.equal(
  generationRetry.diagramBackendDeadlineBudgetMs(69_999, 0),
  59_999,
  'decision telemetry retains the exact under-budget value without dispatching',
)
const settledHandoffRegistry = new Map([
  ['G1-expiring', {
    attemptId: 'G2-expiring',
    promise: Promise.resolve({ success: true }),
    createdAtMs: 100,
    settledAtMs: 1_000,
  }],
])
generationRetry.pruneDiagramFreshAttemptHandoffs(
  settledHandoffRegistry,
  1_000 + generationRetry.DIAGRAM_FRESH_ATTEMPT_HANDOFF_TTL_MS - 1,
)
assert.equal(
  settledHandoffRegistry.size,
  1,
  'a settled G2 remains joinable until its exact TTL boundary',
)
generationRetry.pruneDiagramFreshAttemptHandoffs(
  settledHandoffRegistry,
  1_000 + generationRetry.DIAGRAM_FRESH_ATTEMPT_HANDOFF_TTL_MS,
)
assert.equal(
  settledHandoffRegistry.size,
  0,
  'a settled G2 is pruned deterministically at the TTL boundary',
)
const oversizedHandoffRegistry = new Map()
for (
  let index = 0;
  index < generationRetry.DIAGRAM_FRESH_ATTEMPT_HANDOFF_REGISTRY_MAX_ENTRIES + 3;
  index += 1
) {
  oversizedHandoffRegistry.set(`G1-${index}`, {
    attemptId: `G2-${index}`,
    promise: Promise.resolve({ success: true }),
    createdAtMs: index,
    settledAtMs: index,
  })
}
generationRetry.pruneDiagramFreshAttemptHandoffs(
  oversizedHandoffRegistry,
  1_000,
)
assert.equal(
  oversizedHandoffRegistry.size,
  generationRetry.DIAGRAM_FRESH_ATTEMPT_HANDOFF_REGISTRY_MAX_ENTRIES,
  'the retained handoff registry cannot grow beyond its hard size cap',
)
assert.equal(
  oversizedHandoffRegistry.has('G1-0'),
  false,
  'bounded pruning removes the oldest settled handoff first',
)
assert.equal(
  generationRetry.isAmbiguousDiagramRequestFailure({
    kind: 'transport',
    retryable: true,
  }),
  true,
)
assert.equal(
  generationRetry.isAmbiguousDiagramRequestFailure({
    name: 'AbortError',
  }),
  true,
  'a browser deadline abort after dispatch preserves the attempt identity',
)
for (const status of [502, 503, 504]) {
  assert.equal(
    generationRetry.isAmbiguousDiagramRequestFailure({
      kind: 'http',
      status,
      retryable: true,
    }),
    true,
    `retryable HTTP ${status} preserves attempt identity because completion is ambiguous`,
  )
}
for (const status of [408, 425, 429, 500]) {
  assert.equal(
    generationRetry.isAmbiguousDiagramRequestFailure({
      kind: 'http',
      status,
      retryable: true,
    }),
    false,
    `HTTP ${status} is not treated as an ambiguous gateway completion`,
  )
}
assert.equal(
  generationRetry.isAmbiguousDiagramRequestFailure({
    kind: 'application',
    status: 504,
    retryable: true,
  }),
  false,
  'a correlated application response is definitive even when retryable',
)
assert.equal(
  generationRetry.isAmbiguousDiagramRequestFailure({
    kind: 'application',
    retryable: true,
    ambiguousCompletion: true,
  }),
  true,
  'Text Labs preserves an ambiguous downstream completion through its HTTP-200 envelope',
)
assert.equal(
  generationRetry.diagramRetryStrategyForFailure({
    kind: 'application',
    retryable: true,
    retryStrategy: 'start_fresh_attempt',
  }),
  'start_fresh_attempt',
)
assert.equal(
  generationRetry.diagramRetryStrategyForFailure({
    kind: 'transport',
    retryable: true,
  }),
  'resume_same_attempt',
  'legacy ambiguous transport failures resume their correlated attempt',
)
assert.equal(
  generationRetry.diagramRetryStrategyForFailure({
    kind: 'http',
    retryable: false,
  }),
  'do_not_retry',
)
assert.equal(
  generationRetry.shouldAutoStartFreshDiagramAttempt({
    submitIntent: 'retry',
    reusedAttempt: true,
    retryStrategy: 'start_fresh_attempt',
    freshAttemptAlreadyStarted: false,
  }),
  true,
  'a recovered terminal model failure starts exactly one fresh attempt',
)
for (const input of [
  {
    submitIntent: 'generate',
    reusedAttempt: true,
    retryStrategy: 'start_fresh_attempt',
    freshAttemptAlreadyStarted: false,
  },
  {
    submitIntent: 'retry',
    reusedAttempt: false,
    retryStrategy: 'start_fresh_attempt',
    freshAttemptAlreadyStarted: false,
  },
  {
    submitIntent: 'retry',
    reusedAttempt: true,
    retryStrategy: 'resume_same_attempt',
    freshAttemptAlreadyStarted: false,
  },
  {
    submitIntent: 'retry',
    reusedAttempt: true,
    retryStrategy: 'start_fresh_attempt',
    freshAttemptAlreadyStarted: true,
  },
]) {
  assert.equal(
    generationRetry.shouldAutoStartFreshDiagramAttempt(input),
    false,
    'initial, uncorrelated, resume, and repeated requests never auto-spend',
  )
}

const viewerSource = fs.readFileSync(
  new URL('../components/presentation-viewer.tsx', import.meta.url),
  'utf8',
)
assert.match(viewerSource, /parseDiagramRendererStateUpdate\(event\.data\)/)
assert.match(viewerSource, /postCommand\(iframeRef\.current, 'updateDiagramRendererState', pending\)/)
assert.match(viewerSource, /update\.action === 'taskColumnResize'/)
assert.match(viewerSource, /update\.action === 'rowLabelResize'/)
assert.match(viewerSource, /postCommand\(iframeRef\.current, 'updateDiagramRendererState', update\)/)
assert.match(viewerSource, /window\.setTimeout\(\(\) => \{[\s\S]*\}, 250\)/)

const routerSource = fs.readFileSync(
  new URL('../lib/element-command-router.ts', import.meta.url),
  'utf8',
)
assert.match(routerSource, /'updateDiagramRendererState'/)
assert.match(routerSource, /'updateGanttState'/)
assert.match(routerSource, /'updateLogArchState'/)
assert.match(routerSource, /'updateDataArchitectureState'/)

const versionRouteSource = fs.readFileSync(
  new URL('../app/api/version/route.ts', import.meta.url),
  'utf8',
)
assert.match(versionRouteSource, /dynamic = 'force-dynamic'/)
assert.match(versionRouteSource, /no-store, no-cache, must-revalidate/)

const buildGuardSource = fs.readFileSync(
  new URL('../components/build-version-guard.tsx', import.meta.url),
  'utf8',
)
assert.match(buildGuardSource, /window\.addEventListener\('focus'/)
assert.match(buildGuardSource, /document\.addEventListener\('visibilitychange'/)
assert.match(buildGuardSource, /controller\.abort\(\), 5_000/)
assert.match(buildGuardSource, /isCompatibleDiagramCatalog\(catalog\)/)
assert.match(buildGuardSource, /DIAGRAM_CATALOG_VERSION/)
assert.match(buildGuardSource, /catalogResponse\.status === 400 \|\| catalogResponse\.status === 404/)
assert.match(buildGuardSource, /window\.location\.reload\(\)/)
assert.match(buildGuardSource, /role="alertdialog"/)
assert.match(buildGuardSource, /Deckster was updated/)
assert.match(buildGuardSource, />\s*Reload now\s*</)
assert.doesNotMatch(buildGuardSource, /Deckster UAT|Reload UAT|but UAT/)

const generationInputSource = fs.readFileSync(
  new URL('../components/generation-panel/shared/generation-input.tsx', import.meta.url),
  'utf8',
)
assert.match(generationInputSource, /onSubmit\(primarySubmitIntent\)/)
assert.match(generationInputSource, /onSubmit\('retry'\)/)
assert.match(generationInputSource, /onClick=\{handleRetry\}/)
assert.match(generationInputSource, /Check generation result/)
assert.match(generationInputSource, /Try fresh generation/)
assert.match(generationInputSource, /retryStrategy !== 'do_not_retry'/)
assert.match(
  generationInputSource,
  /retryStrategy === 'resume_same_attempt' \? 'retry' : 'generate'/,
)

const generationPanelSource = fs.readFileSync(
  new URL('../components/generation-panel/index.tsx', import.meta.url),
  'utf8',
)
assert.match(
  generationPanelSource,
  /intent === 'generate' && retryStrategy === 'resume_same_attempt'/,
)
assert.match(
  generationPanelSource,
  /submitIntentRef\.current = \{ key: panelTargetKey, intent: effectiveIntent \}/,
)
assert.match(generationPanelSource, /await onGenerate\(formData, submitIntent\)/)

const generationHookSource = fs.readFileSync(
  new URL('../hooks/use-textlabs-generation.ts', import.meta.url),
  'utf8',
)
assert.match(generationHookSource, /submitIntent !== 'retry'/)
assert.match(generationHookSource, /diagramRetryCandidateForPreDispatch\(/)
assert.match(generationHookSource, /resolveDiagramGenerationAttemptId\(\{/)
assert.match(generationHookSource, /remainingDiagramBackendDeadlineMs\([\s\S]*browserDeadlineAtMs/)
assert.match(generationHookSource, /diagramBackendDeadlineBudgetMs\(/)
assert.match(generationHookSource, /executeDiagramRequestWithFreshAttemptHandoff\(\{/)
assert.match(generationHookSource, /registry: freshDiagramAttemptHandoffsRef\.current/)
assert.match(generationHookSource, /resolveFreshBackendDeadlineMs: \(\) => \(/)
assert.match(generationHookSource, /onFreshAttempt: attemptId => \{/)
assert.match(generationHookSource, /onDecision: decision => \{/)
assert.match(generationHookSource, /generationAttemptId = requestResult\.attemptId/)
assert.match(generationHookSource, /freshDiagramAttemptHandoffsRef\.current\.clear\(\)/)
assert.doesNotMatch(generationHookSource, /recoveredAttemptId|freshAttemptId: attemptId\.slice/)
assert.match(generationHookSource, /activeGenerationKeysRef\.current\.has\(generationKey\)/)
assert.match(generationHookSource, /activeGenerationKeysRef\.current\.add\(generationKey\)/)
assert.match(generationHookSource, /activeGenerationKeysRef\.current\.delete\(generationKey\)/)
assert.match(
  generationHookSource,
  /diagramRequestWasDispatched[\s\S]*isAmbiguousDiagramRequestFailure\(err\)/,
)
assert.doesNotMatch(
  generationHookSource,
  /diagramRequestWasDispatched[\s\S]{0,180}err instanceof TextLabsRequestError/,
)
const retryCandidateReadIndex = generationHookSource.indexOf(
  'diagramRetryCandidateForPreDispatch(',
)
const backendDeadlineIndex = generationHookSource.indexOf(
  'const backendDeadlineMs = remainingDiagramBackendDeadlineMs(',
)
const retryCandidateConsumeIndex = generationHookSource.indexOf(
  'retryCandidateRef.current = null',
  backendDeadlineIndex,
)
assert.ok(retryCandidateReadIndex >= 0)
assert.ok(backendDeadlineIndex > retryCandidateReadIndex)
assert.ok(
  retryCandidateConsumeIndex > backendDeadlineIndex,
  'an explicit retry candidate is not consumed until the prepared request reaches dispatch',
)

console.log('diagram reliability regression tests passed')
