"use client"

import { useCallback, useEffect, useRef } from "react"
import { TextLabsFormData, TextLabsComponentType, TextLabsPositionConfig } from '@/types/textlabs'
import {
  TextLabsRequestError,
  type TextLabsRetryStrategy,
  sendMessage as sendTextLabsMessage,
  buildApiPayload,
  buildInsertionParams,
  buildSemanticUpsertParams,
  detachMetricsOverrideBindings,
  generateInfographic,
  getDefaultSize,
} from '@/lib/textlabs-client'
import type { RefineContext } from '@/hooks/use-element-refinement'
import type { BlankElementInfo } from '@/hooks/use-blank-elements'
import {
  ElementGenerationPreflightError,
  parseElementGenerationMetadata,
  readElementGenerationSnapshot,
  remapElementGridPositions,
} from '@/lib/element-geometry'
import { normalizeSemanticComponentType } from '@/lib/element-semantic-type'
import { mergeLiveDiagramRendererConfig } from '@/lib/diagram-renderer-state'
import { componentSupportsThemeVariants, parseElementThemeAssignments } from '@/lib/element-theme-variants'
import { resolveElementThemeMetadata } from '@/lib/textlabs-theme-metadata'
import { buildElementGenerationContext, parseSlideGenerationContext } from '@/lib/element-generation-context'
import type { ElementResearchCapabilities, ElementResearchMode } from '@/types/textlabs'
import {
  buildElementResearchPolicy,
  hasSelectedElementResearchSource,
  isNonResearchVisualElement,
} from '@/lib/element-research-policy'
import {
  hasSameThemeSyncIdentity,
  isSameThemeGenerationAuthority,
  type ThemeGenerationAuthority,
  type ThemeReadinessResult,
  type ThemeSyncState,
} from '@/lib/theme-sync'
import { restoreBlankElementAfterFailure } from '@/lib/blank-element-recovery'
import { parseThemeVariantSource, responseStyleOwner } from '@/lib/element-provenance'
import { resolveMetricsLayout } from '@/lib/metrics-layout'
import {
  chartRefinementDataSnapshot,
  mergeChartPanelGenerationConfig,
  researchedChartRecoveryMessage,
  synchronizeChartPanelGenerationConfig,
} from '@/lib/chart-data-contract'
import {
  assertLayoutCommandSucceeded,
  createLayoutMutationId,
  layoutCommandSucceeded,
  layoutMutationStateIsAmbiguous,
  sendLayoutMutationWithReconciliation,
} from '@/lib/layout-command-result'
import {
  isDiagramGenerationType,
  resolveElementGenerationTimeoutMs,
} from '@/lib/element-generation-timeout'
import {
  CUSTOM_DIAGRAM_PROMPT_MAX_LENGTH,
  elementPromptLengthState,
} from '@/lib/element-prompt-limit'
import { resolveRefineGenerationConfig } from '@/lib/refine-generation-config'
import { normalizePersistedDiagramSubtype } from '@/lib/diagram-catalog'
import { imageEditPreflightError } from '@/lib/image-refinement'
import {
  diagramBackendDeadlineBudgetMs,
  diagramRetryCandidateForPreDispatch,
  diagramGenerationRequestFingerprint,
  diagramRetryStrategyForFailure,
  executeDiagramRequestWithFreshAttemptHandoff,
  isAmbiguousDiagramRequestFailure,
  remainingDiagramBackendDeadlineMs,
  resolveDiagramGenerationAttemptId,
  type DiagramFreshAttemptHandoffRegistry,
  type DiagramRetryCandidate,
  type ElementGenerationSubmitIntent,
} from '@/lib/element-generation-retry'
import type { TextLabsResponse } from '@/types/textlabs'

const THEME_CHANGED_DURING_GENERATION =
  'The deck theme changed while this element was being generated. Wait for Applied, then generate again.'
const PRESENTATION_CHANGED_DURING_GENERATION =
  'The active presentation changed while this element was being generated. Reload the original presentation before retrying.'
const snapGridLine = (value: number) => Number((Math.round(value * 5) / 5).toFixed(1))
const NEUTRAL_THEME_FALLBACK = {
  primary: '#4F46E5',
  secondary: '#64748B',
  surface: '#F8FAFC',
  border: '#CBD5E1',
  accents: ['#4F46E5', '#0284C7', '#059669', '#D97706', '#DC2626'] as string[],
  text: '#0F172A',
  background: '#FFFFFF',
}

interface UseTextLabsGenerationParams {
  generationPanel: {
    blankElementId: string | null
    isOpen: boolean
    elementType: TextLabsComponentType | null
    isGenerating: boolean
    error: string | null
    mode: 'generate' | 'edit' | 'refine'
    refineContext: RefineContext | null
    researchMode: ElementResearchMode
    researchWeb: boolean
    researchUploadedDocs: boolean
    researchKnowledgeGraph: boolean
    setIsGenerating: (v: boolean) => void
    setError: (v: string | null) => void
    setRetryStrategy: (v: TextLabsRetryStrategy | null) => void
    closePanel: () => void
    openPanelForElement: (type: TextLabsComponentType, elementId: string) => void
    resumePanelForElement: (type: TextLabsComponentType, elementId: string) => void
    openPanelForRefine: (type: TextLabsComponentType, context: RefineContext) => void
    rememberDraftForElement: (elementId: string, formData?: TextLabsFormData | null) => void
    completeBlankReplacement: (
      type: TextLabsComponentType,
      replacedPlaceholderId: string,
      refineContext: RefineContext,
    ) => void
    changeElementType: (type: TextLabsComponentType) => void
    getSnapshot: () => {
      isOpen: boolean
      blankElementId: string | null
      editElementId: string | null
      mode: 'generate' | 'edit' | 'refine'
    }
  }
  blankElements: {
    getElement: (id: string) => BlankElementInfo | undefined
    updatePosition: (elementId: string, startCol: number, startRow: number, width: number, height: number) => void
    setStatus: (id: string, status: 'blank' | 'generating') => void
    updateGenerationMetadata: (
      id: string,
      metadata: Pick<BlankElementInfo, 'themeVariantId' | 'themeBindings'>,
    ) => void
    removeElement: (id: string) => void
    addElement: (info: BlankElementInfo) => void
    trackElement: (id: string | null) => void
  }
  textLabsSession: {
    ensureSession: (signal?: AbortSignal) => Promise<string>
  }
  layoutServiceApis: {
    sendElementCommand: (action: string, params: Record<string, any>) => Promise<any>
  } | null
  presentationId?: string | null
  currentSlideIndex: number
  getCurrentSlideIndex?: () => number
  deckContext?: Record<string, unknown> | null
  researchSessionId?: string | null
  researchStoreName?: string | null
  researchUserId?: string | null
  researchCapabilities: ElementResearchCapabilities
  getThemeSyncSnapshot: () => ThemeSyncState
  ensureThemeReady: (presentationId: string) => Promise<ThemeReadinessResult>
  toast: (opts: { title: string; description: string }) => void
}

function greatestCommonDivisor(a: number, b: number): number {
  return b === 0 ? a : greatestCommonDivisor(b, a % b)
}

function applyPositionToFormData(
  formData: TextLabsFormData,
  positionConfig: NonNullable<TextLabsFormData['positionConfig']>,
  includeTopLevelPosition = true,
) {
  if (includeTopLevelPosition) formData.positionConfig = positionConfig
  const fd = formData as any
  if (fd.imageConfig) {
    fd.imageConfig.start_col = positionConfig.start_col
    fd.imageConfig.start_row = positionConfig.start_row
    fd.imageConfig.width = positionConfig.position_width
    fd.imageConfig.height = positionConfig.position_height
    fd.imageConfig.position_width = positionConfig.position_width
    fd.imageConfig.position_height = positionConfig.position_height
    fd.imageConfig.grid_row = `${positionConfig.start_row}/${positionConfig.start_row + positionConfig.position_height}`
    fd.imageConfig.grid_column = `${positionConfig.start_col}/${positionConfig.start_col + positionConfig.position_width}`
    if (Object.prototype.hasOwnProperty.call(fd.imageConfig, 'aspect_ratio')) {
      const scaledWidth = Math.round(positionConfig.position_width * 1000)
      const scaledHeight = Math.round(positionConfig.position_height * 1000)
      const divisor = greatestCommonDivisor(scaledWidth, scaledHeight)
      fd.imageConfig.aspect_ratio =
        `${scaledWidth / divisor}:${scaledHeight / divisor}`
    }
  }
  if (fd.infographicConfig) {
    fd.infographicConfig.start_col = positionConfig.start_col
    fd.infographicConfig.start_row = positionConfig.start_row
    fd.infographicConfig.width = positionConfig.position_width
    fd.infographicConfig.height = positionConfig.position_height
    fd.infographicConfig.grid_row =
      `${positionConfig.start_row}/${positionConfig.start_row + positionConfig.position_height}`
    fd.infographicConfig.grid_column =
      `${positionConfig.start_col}/${positionConfig.start_col + positionConfig.position_width}`
  }
  if (fd.shapeConfig) {
    fd.shapeConfig.start_col = positionConfig.start_col
    fd.shapeConfig.start_row = positionConfig.start_row
    fd.shapeConfig.position_width = positionConfig.position_width
    fd.shapeConfig.position_height = positionConfig.position_height
  }
}

// Placeholder HTML builder for blank elements on canvas
function buildPlaceholderHtml(elementId: string, componentType: string): string {
  const ELEMENT_ICONS: Record<string, string> = {
    TEXT_BOX: '\u{1F4DD}', METRICS: '\u{1F4CA}', TABLE: '\u25A6', CHART: '\u{1F4C8}',
    IMAGE: '\u{1F5BC}\uFE0F', ICON_LABEL: '\u{1F3F7}\uFE0F', SHAPE: '\u2B1F',
    INFOGRAPHIC: '\u{1F3A8}', DIAGRAM: '\u{1F3D7}\uFE0F',
  }
  const icon = ELEMENT_ICONS[componentType] || '\u{1F4DD}'
  const label = componentType.replace(/_/g, ' ')
  return `<div data-blank-element="${elementId}" data-element-type="${componentType}" style="display:flex;align-items:center;justify-content:center;height:100%;border:2px dashed #c7d2fe;border-radius:8px;background:rgba(238,241,247,0.6);cursor:pointer;"><div style="text-align:center;color:#6366f1;"><div style="font-size:28px;line-height:1;">${icon}</div><div style="font-size:13px;font-weight:600;margin-top:6px;">${label}</div><div style="font-size:11px;margin-top:2px;opacity:0.7;">Click to configure</div></div></div>`
}

function parseGridSpan(value: unknown): [number, number] | null {
  if (typeof value !== 'string') return null
  const parts = value.split('/').map(part => Number(part.trim()))
  if (parts.length !== 2 || parts.some(part => !Number.isFinite(part))) return null
  return [parts[0], parts[1]]
}

function gridPositionFromInsertionParams(params: Record<string, unknown>): TextLabsPositionConfig | null {
  const rowSpan = parseGridSpan(params.gridRow)
  const columnSpan = parseGridSpan(params.gridColumn)
  const startRow = rowSpan?.[0]
  const startCol = columnSpan?.[0]
  const positionHeight = typeof params.positionHeight === 'number'
    ? params.positionHeight
    : rowSpan ? rowSpan[1] - rowSpan[0] : undefined
  const positionWidth = typeof params.positionWidth === 'number'
    ? params.positionWidth
    : columnSpan ? columnSpan[1] - columnSpan[0] : undefined
  if (
    typeof startCol !== 'number' ||
    typeof startRow !== 'number' ||
    typeof positionWidth !== 'number' ||
    typeof positionHeight !== 'number'
  ) return null
  return {
    start_col: startCol,
    start_row: startRow,
    position_width: positionWidth,
    position_height: positionHeight,
    auto_position: false,
  }
}

export function useTextLabsGeneration({
  generationPanel,
  blankElements,
  textLabsSession,
  layoutServiceApis,
  presentationId,
  currentSlideIndex,
  getCurrentSlideIndex,
  deckContext,
  researchSessionId,
  researchStoreName,
  researchUserId,
  researchCapabilities,
  getThemeSyncSnapshot,
  ensureThemeReady,
  toast,
}: UseTextLabsGenerationParams) {
  const activeGenerationKeysRef = useRef<Set<string>>(new Set())
  const retryCandidateRef = useRef<DiagramRetryCandidate | null>(null)
  const freshDiagramAttemptHandoffsRef = useRef<
    DiagramFreshAttemptHandoffRegistry<TextLabsResponse>
  >(new Map())
  const generationHookMountedRef = useRef(true)
  useEffect(() => {
    generationHookMountedRef.current = true
    return () => {
      generationHookMountedRef.current = false
      freshDiagramAttemptHandoffsRef.current.clear()
    }
  }, [])
  const activePresentationTargetRef = useRef({
    presentationId: presentationId ?? null,
    epoch: 0,
  })
  if (activePresentationTargetRef.current.presentationId !== (presentationId ?? null)) {
    activePresentationTargetRef.current = {
      presentationId: presentationId ?? null,
      epoch: activePresentationTargetRef.current.epoch + 1,
    }
  }
  const renderPresentationTarget = activePresentationTargetRef.current

  const handleGenerate = useCallback(async (
    formData: TextLabsFormData,
    submitIntent: ElementGenerationSubmitIntent = 'generate',
  ) => {
    const retryCandidate = diagramRetryCandidateForPreDispatch(
      submitIntent,
      retryCandidateRef.current,
    )
    // A normal Generate action is a deliberate new request. An explicit Retry
    // keeps its ambiguous identity through browser-only preflight and consumes
    // it exactly once immediately before the prepared request is dispatched.
    if (submitIntent !== 'retry') retryCandidateRef.current = null
    if (
      formData.componentType === 'CUSTOM'
      && elementPromptLengthState(
        formData.prompt,
        CUSTOM_DIAGRAM_PROMPT_MAX_LENGTH,
      ).overLimit
    ) {
      generationPanel.setError(
        `CUSTOM prompts support up to ${CUSTOM_DIAGRAM_PROMPT_MAX_LENGTH.toLocaleString()} characters. Shorten the prompt and try again.`,
      )
      return
    }
    const expectedPresentationTarget = renderPresentationTarget
    const refineContext = generationPanel.mode === 'refine' ? generationPanel.refineContext : null
    const generationKey = refineContext
      ? `refine:${refineContext.elementId}`
      : `blank:${generationPanel.blankElementId ?? 'direct'}`
    if (activeGenerationKeysRef.current.has(generationKey)) return
    activeGenerationKeysRef.current.add(generationKey)

    // Lock this panel's submit path before the async geometry lookup so a
    // double-click cannot start two concurrent swaps for the same placeholder.
    generationPanel.setIsGenerating(true)
    generationPanel.setError(null)
    const freshGenerationAttemptId = crypto.randomUUID()
    let generationAttemptId = freshGenerationAttemptId
    formData.generationAttemptId = generationAttemptId
    let refineOverlayActive = false
    let blankOverlayActive = false
    let refineElementDeleted = false
    let dispatchedDiagramRequestFingerprint: string | null = null
    let diagramRequestWasDispatched = false

    // The displayed presentation owned by the hook is authoritative. Form
    // callbacks can remain mounted across deck transitions and must not revive
    // a captured presentation ID from the previous viewer.
    formData.presentationId = expectedPresentationTarget.presentationId
    const presentationIsStillAuthoritative = () => (
      generationHookMountedRef.current
      && activePresentationTargetRef.current.presentationId === expectedPresentationTarget.presentationId
      && activePresentationTargetRef.current.epoch === expectedPresentationTarget.epoch
    )
    const blankId = generationPanel.blankElementId
    const trackedBlankInfo = blankId ? blankElements.getElement(blankId) : undefined
    let blankInfo = trackedBlankInfo
    let currentBlankId = blankId
    let currentBlankInfo = trackedBlankInfo
    let blankTrackingWasRemoved = false
    const insertedElementIds: string[] = []
    let generationLifecycleCleaned = false

    const cleanupGenerationLifecycle = async () => {
      if (generationLifecycleCleaned) return
      generationLifecycleCleaned = true
      const refineOverlayTargetSurvived = !refineElementDeleted
        || Boolean(refineContext && insertedElementIds.includes(refineContext.elementId))
      if (currentBlankId && blankOverlayActive && !blankTrackingWasRemoved) {
        try {
          blankElements.setStatus(currentBlankId, 'blank')
        } catch (error) {
          console.warn('[TextLabs] Failed to reset blank generation status:', error)
        }
      }
      if (
        presentationIsStillAuthoritative()
        && currentBlankId
        && blankOverlayActive
        && !blankTrackingWasRemoved
        && layoutServiceApis?.sendElementCommand
      ) {
        try {
          const overlayResponse = await layoutServiceApis.sendElementCommand('setElementGenerationState', {
            elementId: currentBlankId,
            generating: false,
          })
          assertLayoutCommandSucceeded(overlayResponse, 'Generation overlay cleanup')
        } catch (error) {
          console.warn('[TextLabs] Failed to clear generation overlay:', error)
        }
      }
      if (
        presentationIsStillAuthoritative()
        && refineContext
        && refineOverlayActive
        && refineOverlayTargetSurvived
        && layoutServiceApis?.sendElementCommand
      ) {
        try {
          const overlayResponse = await layoutServiceApis.sendElementCommand('setElementGenerationState', {
            elementId: refineContext.elementId,
            generating: false,
          })
          assertLayoutCommandSucceeded(overlayResponse, 'Regeneration overlay cleanup')
        } catch (error) {
          console.warn('[TextLabs] Failed to clear regeneration overlay:', error)
        }
      }
      try {
        generationPanel.setIsGenerating(false)
      } catch (error) {
        console.warn('[TextLabs] Failed to reset generation panel state:', error)
      }
      activeGenerationKeysRef.current.delete(generationKey)
    }

    try {
      if (!presentationIsStillAuthoritative()) {
        generationPanel.setError(PRESENTATION_CHANGED_DURING_GENERATION)
        return
      }
      if (blankId && !trackedBlankInfo) {
        generationPanel.setError('This placeholder is no longer available. Add the element again and retry.')
        return
      }
      if (formData.useDeckTheme === true && !formData.presentationId) {
        generationPanel.setError('The active presentation is unavailable, so its deck theme cannot be resolved.')
        return
      }
      if ((blankId || refineContext) && !layoutServiceApis?.sendElementCommand) {
        generationPanel.setError('The presentation is still loading. Wait a moment and try again.')
        return
      }

      // Start visible progress immediately after the presentation + element
      // identity is validated. Theme, geometry, and slide-context preflights can
      // all take noticeable time; every exit below is covered by the outer
      // lifecycle finally without replacing the authoritative placeholder.
      if (refineContext && layoutServiceApis?.sendElementCommand) {
        try {
          const overlayResponse = await layoutServiceApis.sendElementCommand('setElementGenerationState', {
            elementId: refineContext.elementId,
            generating: true,
            label: 'Regenerating…',
          })
          assertLayoutCommandSucceeded(overlayResponse, 'Regeneration overlay')
          refineOverlayActive = true
        } catch (error) {
          try {
            await layoutServiceApis.sendElementCommand('setElementGenerationState', {
              elementId: refineContext.elementId,
              generating: false,
            })
          } catch {
            // The recoverable error below asks the user to reload when the
            // command's final viewer state cannot be confirmed.
          }
          const message = error instanceof Error
            ? `The presentation viewer could not show regeneration progress: ${error.message}`
            : 'The presentation viewer could not show regeneration progress.'
          generationPanel.setError(`${message} Reload the slide and try again.`)
          return
        }
      }

      if (blankId && trackedBlankInfo && layoutServiceApis?.sendElementCommand) {
        blankElements.setStatus(blankId, 'generating')
        try {
          const overlayResponse = await layoutServiceApis.sendElementCommand('setElementGenerationState', {
            elementId: blankId,
            generating: true,
            label: 'Generating…',
          })
          assertLayoutCommandSucceeded(overlayResponse, 'Generation overlay')
          blankOverlayActive = true
        } catch (error) {
          blankElements.setStatus(blankId, 'blank')
          try {
            await layoutServiceApis.sendElementCommand('setElementGenerationState', {
              elementId: blankId,
              generating: false,
            })
          } catch {
            // A lost acknowledgement can leave the viewer state ambiguous. The
            // recoverable error below asks the user to reload before retry.
          }
          const message = error instanceof Error
            ? `The presentation viewer could not show generation progress: ${error.message}`
            : 'The presentation viewer could not show generation progress.'
          generationPanel.setError(`${message} Reload the slide and try again.`)
          return
        }
      }
    const requestedThemePresentationId = (
      formData.useDeckTheme === true
      && formData.componentType !== 'CODE_DISPLAY'
    )
      ? formData.presentationId
      : null
    let expectedThemeSync: ThemeSyncState | null = null
    let expectedThemeAuthority: ThemeGenerationAuthority | null = null
    let expectedThemeSource: 'director' | 'layout' | 'neutral' | null = null
    const themeSyncBeforeReadiness = requestedThemePresentationId
      ? getThemeSyncSnapshot()
      : null
    if (requestedThemePresentationId) {
      let readiness: ThemeReadinessResult
      try {
        readiness = await ensureThemeReady(requestedThemePresentationId)
      } catch (error) {
        readiness = {
          ready: false,
          code: 'failed',
          error: error instanceof Error
            ? error.message
            : 'The selected deck theme could not be prepared. Reapply it, then generate again.',
        }
      }
      if (!presentationIsStillAuthoritative()) {
        generationPanel.setError(PRESENTATION_CHANGED_DURING_GENERATION)
        return
      }
      if (!readiness.ready) {
        generationPanel.setError(readiness.error)
        toast({
          title: 'Deck theme not ready',
          description: readiness.error,
        })
        return
      }
      if (readiness.notice) {
        toast({
          title: 'Using a neutral element theme',
          description: readiness.notice,
        })
      }
      expectedThemeSource = readiness.source
      const themeSyncAfterReadiness = getThemeSyncSnapshot()
      if (readiness.source === 'neutral') {
        formData.useDeckTheme = false
        formData.themeOverrides = { ...NEUTRAL_THEME_FALLBACK }
        if (formData.generationConfig) {
          formData.generationConfig = {
            ...formData.generationConfig,
            theme_resolution: 'neutral_fallback',
          }
        }
      }
      if (readiness.source === 'director') {
        expectedThemeSync = readiness.sync
        if (
          expectedThemeSync.status !== 'applied' ||
          !expectedThemeSync.requestId ||
          expectedThemeSync.presentationId !== requestedThemePresentationId
        ) {
          generationPanel.setError('The selected deck theme acknowledgement did not match this presentation. Generate again.')
          return
        }
        expectedThemeAuthority = {
          presentationId: requestedThemePresentationId,
          themeFingerprint: expectedThemeSync.themeFingerprint,
          fallbackSync: expectedThemeSync,
        }
      } else if (readiness.source === 'layout') {
        // A persisted Layout theme can be selected while Director is offline.
        // Pin the semantic selection and the pre-probe state, then re-evaluate
        // the live Director state after the probe. A reconnect may legitimately
        // replace status/request/source identity while applying the exact same
        // presentation + selection.
        if (!themeSyncBeforeReadiness) {
          generationPanel.setError(THEME_CHANGED_DURING_GENERATION)
          return
        }
        expectedThemeAuthority = {
          presentationId: requestedThemePresentationId,
          themeFingerprint: readiness.sync.themeFingerprint
            ?? (
              themeSyncBeforeReadiness.presentationId === requestedThemePresentationId
                ? themeSyncBeforeReadiness.themeFingerprint
                : null
            ),
          fallbackSync: themeSyncBeforeReadiness,
        }
        if (!isSameThemeGenerationAuthority(expectedThemeAuthority, themeSyncAfterReadiness)) {
          generationPanel.setError(THEME_CHANGED_DURING_GENERATION)
          return
        }
      } else {
        // Neutral rendering is an explicit palette fallback, not the selected
        // deck theme. Keep it pinned by exact mutation identity.
        if (
          !themeSyncBeforeReadiness
          || !hasSameThemeSyncIdentity(
            themeSyncBeforeReadiness,
            themeSyncAfterReadiness,
          )
        ) {
          generationPanel.setError(THEME_CHANGED_DURING_GENERATION)
          return
        }
        expectedThemeSync = themeSyncAfterReadiness
      }
    }
    const themeIsStillAuthoritative = () => {
      if (!requestedThemePresentationId) return true
      const current = getThemeSyncSnapshot()
      if (expectedThemeAuthority) {
        return isSameThemeGenerationAuthority(expectedThemeAuthority, current)
      }
      return Boolean(
        expectedThemeSource === 'neutral'
        && expectedThemeSync
        && hasSameThemeSyncIdentity(current, expectedThemeSync),
      )
    }
    const generationTargetError = () => {
      if (!presentationIsStillAuthoritative()) return PRESENTATION_CHANGED_DURING_GENERATION
      if (!themeIsStillAuthoritative()) return THEME_CHANGED_DURING_GENERATION
      return null
    }
    const assertGenerationTargetIsStillAuthoritative = () => {
      const error = generationTargetError()
      if (error) throw new Error(error)
    }

    // A blank placeholder's live DOM geometry is authoritative. Resolve it
    // before starting Text Labs so a failed query leaves the user's placeholder
    // untouched instead of falling back to stale defaults.
    if (blankId && trackedBlankInfo && layoutServiceApis?.sendElementCommand) {
      try {
        const supportsLayoutThemeMetadata = componentSupportsThemeVariants(formData.componentType)
        const snapshot = await readElementGenerationSnapshot({
          sendCommand: layoutServiceApis.sendElementCommand,
          elementId: blankId,
          componentType: formData.componentType,
          useDeckTheme: formData.useDeckTheme === true,
          requiresThemeVariant: supportsLayoutThemeMetadata,
          themeVariantSource: 'element_generation',
        })
        blankInfo = {
          ...trackedBlankInfo,
          startCol: snapshot.startCol,
          startRow: snapshot.startRow,
          width: snapshot.width,
          height: snapshot.height,
          // A new leaf placeholder does not carry user-authored detach state.
          // Its empty Layout metadata must remain absent so Text Labs applies
          // the component theme defaults. Existing elements preserve explicit
          // `{}` through the refine path below.
          themeVariantId: supportsLayoutThemeMetadata
            ? snapshot.themeVariantId ?? trackedBlankInfo.themeVariantId ?? null
            : null,
          themeBindings: supportsLayoutThemeMetadata
            ? snapshot.themeBindings ?? trackedBlankInfo.themeBindings ?? null
            : null,
        }
        if (snapshot.zIndex !== null) formData.z_index = snapshot.zIndex
        blankElements.updatePosition(
          blankId,
          snapshot.startCol,
          snapshot.startRow,
          snapshot.width,
          snapshot.height,
        )
        blankElements.updateGenerationMetadata(blankId, snapshot)
      } catch (error) {
        console.error('[TextLabs] Element generation preflight failed:', error)
        generationPanel.setError(
          error instanceof ElementGenerationPreflightError && error.stage === 'theme_metadata'
            ? "Couldn't apply the deck's current theme treatment to this element. The placeholder was left unchanged. Please try again."
            : "Couldn't read the element's current size and position. The placeholder was left unchanged. Please try again.",
        )
        return
      }
    }

    if (refineContext) {
      if (!layoutServiceApis?.sendElementCommand) {
        generationPanel.setError('The presentation is still loading. Wait a moment and try again.')
        return
      }

      // Contextual accessories (currently template Logo) render through the
      // IMAGE form, whose generic fields do not know about template identity.
      // Carry the persisted slot metadata forward before geometry preflight so
      // Layout remains the owner of accessory geometry and atomic replacement.
      formData.slotName = formData.slotName ?? refineContext.slotName
      formData.slotKind = formData.slotKind ?? refineContext.slotKind
      formData.accessoryType = formData.accessoryType ?? refineContext.accessoryType

      try {
        const snapshot = await readElementGenerationSnapshot({
          sendCommand: layoutServiceApis.sendElementCommand,
          elementId: refineContext.elementId,
          componentType: refineContext.elementType,
          useDeckTheme: formData.useDeckTheme === true,
          requiresThemeVariant: componentSupportsThemeVariants(refineContext.elementType),
          themeVariantSource: refineContext.themeVariantSource,
        })
        const liveComponentType = normalizeSemanticComponentType(snapshot.componentType)
          ?? refineContext.elementType
        const liveGridPosition = {
          start_col: snapshot.startCol,
          start_row: snapshot.startRow,
          position_width: snapshot.width,
          position_height: snapshot.height,
          auto_position: false,
        }

        applyPositionToFormData(
          formData,
          liveGridPosition,
          formData.slotKind !== 'accessory',
        )
        if (snapshot.zIndex !== null) formData.z_index = snapshot.zIndex
        const themeVariantId = formData.useDeckTheme === true
          ? snapshot.themeVariantId ?? refineContext.themeVariantId
          : null
        const themeBindings = formData.useDeckTheme === true
          ? snapshot.themeBindings ?? refineContext.themeBindings
          : null
        const mergedRendererConfig = mergeLiveDiagramRendererConfig(
          formData.generationConfig as Record<string, unknown> | null | undefined,
          'diagramConfig' in formData
            ? formData.diagramConfig as Record<string, unknown>
            : null,
          snapshot.generationConfig,
        )
        if ('diagramConfig' in formData) {
          formData.diagramConfig = mergedRendererConfig.diagramConfig
        }
        if (mergedRendererConfig.generationConfig) {
          formData.generationConfig = mergedRendererConfig.generationConfig
        }
        formData.existingElement = {
          ...refineContext.existingElement,
          component_type: liveComponentType,
          normalized_component_type: liveComponentType,
          grid_position: liveGridPosition,
          theme_variant_id: themeVariantId,
          theme_bindings: themeBindings,
          style_owner: snapshot.styleOwner ?? refineContext.styleOwner,
          theme_variant_source: snapshot.themeVariantSource ?? refineContext.themeVariantSource,
          metrics_color_variant: snapshot.metricsColorVariant ?? refineContext.metricsColorVariant,
          generation_config: mergedRendererConfig.generationConfig
            ?? snapshot.generationConfig
            ?? refineContext.existingElement?.generation_config,
        }
        formData.themeVariantId = themeVariantId
        formData.themeBindings = themeBindings
        if (
          formData.componentType === 'METRICS'
          && !Object.prototype.hasOwnProperty.call(formData.metricsConfig, 'color_variant')
        ) {
          const persistedColor = snapshot.metricsColorVariant ?? refineContext.metricsColorVariant
          if (persistedColor) {
            formData.metricsConfig = {
              ...formData.metricsConfig,
              color_variant: persistedColor,
            }
          }
        }
      } catch (error) {
        console.error('[TextLabs] Element regeneration preflight failed:', error)
        generationPanel.setError(
          error instanceof ElementGenerationPreflightError && error.stage === 'theme_metadata'
            ? "Couldn't apply the deck's current theme treatment to this element. The original was left unchanged. Please try again."
            : "Couldn't read this element's current size and position. The original was left unchanged. Please try again.",
        )
        return
      }

      formData.refine = true
      formData.replaceElementId = refineContext.elementId
      formData.existingElement = formData.existingElement ?? refineContext.existingElement
      formData.count = 1

    }

    // React state updates are async, so keep the refreshed blank snapshot local.
    currentBlankInfo = blankInfo

    // If a blank element exists, its live canvas bounds are authoritative. For
    // text/metric multi-instance generation, preserve the requested count and
    // remap the form's child layout into those live bounds.
    if (blankInfo) {
      const livePosition = {
        start_col: blankInfo.startCol,
        start_row: blankInfo.startRow,
        position_width: blankInfo.width,
        position_height: blankInfo.height,
      }
      const supportsMultipleInstances = formData.componentType === 'TEXT_BOX' || formData.componentType === 'METRICS'
      if (!supportsMultipleInstances) {
        formData.count = 1
      } else if (formData.count > 1) {
        const formElements = 'elements' in formData ? formData.elements : undefined
        if (!formData.positionConfig || !formElements || formElements.length !== formData.count) {
          generationPanel.setError('The requested multi-element layout is incomplete. The placeholder was left unchanged.')
          return
        }
        if (formData.componentType === 'METRICS') {
          // The geometry preflight is authoritative. Re-run only the structural
          // 0.2-grid splitter here so Auto responds to a last-second resize;
          // Text Service still owns every content-fit value.
          const liveLayout = resolveMetricsLayout(
            livePosition,
            formData.count,
            formData.metricsLayoutChoice ?? formData.layout,
          )
          if (!liveLayout.viable) {
            generationPanel.setError('The live placeholder is too small for the requested metric cards. Resize it and try again.')
            return
          }
          formData.layout = liveLayout.layout
          formData.metricsConfig = { ...formData.metricsConfig, layout: liveLayout.layout }
          formData.elements = liveLayout.boxes.map(grid_position => ({ grid_position }))
        } else {
          formData.elements = remapElementGridPositions(
            formElements,
            formData.positionConfig,
            livePosition,
          )
        }
      }
      formData.themeVariantId = formData.useDeckTheme === true
        ? blankInfo.themeVariantId ?? null
        : null
      formData.themeBindings = formData.useDeckTheme === true
        ? blankInfo.themeBindings ?? null
        : null
      applyPositionToFormData(
        formData,
        {
          ...livePosition,
          auto_position: false,
        },
        formData.slotKind !== 'accessory',
      )
    }

    // Enforce minimum card geometry for every Metrics request, including a
    // single card and requests without a tracked blank placeholder. The live
    // blank bounds above have already replaced the form snapshot when present.
    if (formData.componentType === 'METRICS' && formData.positionConfig) {
      const metricsLayout = resolveMetricsLayout(
        formData.positionConfig,
        formData.count,
        formData.metricsLayoutChoice ?? formData.layout,
      )
      if (!metricsLayout.viable) {
        generationPanel.setError('The live placeholder is too small for the requested metric cards. Resize it and try again.')
        return
      }
    }

    const generationSlideIndex = blankInfo?.slideIndex
      ?? refineContext?.slideIndex
      ?? getCurrentSlideIndex?.()
      ?? currentSlideIndex
    formData.slideIndex = generationSlideIndex

    const nonResearchVisual = isNonResearchVisualElement(
      formData.componentType,
      formData.slotKind,
      formData.accessoryType,
    )
    const effectiveResearchSessionId = researchSessionId
      ?? refineContext?.research.session_id
      ?? null
    const effectiveResearchStoreName = researchStoreName
      ?? refineContext?.research.store_name
      ?? null
    const diagramCodeDoesNotResearch = formData.componentType === 'CODE_DISPLAY'
    const researchDisabled = nonResearchVisual || diagramCodeDoesNotResearch
    const effectiveResearchMode: ElementResearchMode = researchDisabled
      ? 'off'
      : generationPanel.researchMode
    const researchPolicy = researchDisabled
      ? null
      : buildElementResearchPolicy({
          mode: effectiveResearchMode,
          selection: {
            web: generationPanel.researchWeb,
            uploadedDocuments: generationPanel.researchUploadedDocs,
            knowledgeGraph: generationPanel.researchKnowledgeGraph,
          },
          capabilities: researchCapabilities,
          storeName: effectiveResearchStoreName,
          sessionId: effectiveResearchSessionId,
          userId: researchUserId,
        })
    if (!researchDisabled && effectiveResearchMode === 'on' && researchPolicy && !hasSelectedElementResearchSource(researchPolicy)) {
      generationPanel.setError(
        'Research is on, but no available source is selected. Enable Web Search or configure Uploaded Documents or Knowledge Graph.',
      )
      return
    }
    if (researchPolicy) formData.research = researchPolicy
    else delete formData.research

    if (!layoutServiceApis?.sendElementCommand) {
      generationPanel.setError('The presentation viewer is unavailable, so live slide context could not be read.')
      return
    }
    const deckReference = deckContext ?? refineContext?.deckContext ?? null
    try {
      const contextResponse = await layoutServiceApis.sendElementCommand('getSlideGenerationContext', {
        slideIndex: generationSlideIndex,
        targetElementId: blankId ?? refineContext?.elementId ?? undefined,
      })
      const liveSlide = parseSlideGenerationContext(contextResponse, generationSlideIndex)
      const generationContext = buildElementGenerationContext(
        formData.prompt,
        formData.componentType,
        liveSlide,
        deckReference,
      )
      formData.generationContext = generationContext
      formData.slideContext = generationContext.reference_context.slide ?? null
      formData.deckContext = generationContext.reference_context.deck ?? null
    } catch (error) {
      // Slide/deck context improves relevance but is reference material, not
      // generation intent. Never substitute a stale Director plan by index;
      // continue with the exact prompt and an explicit degraded-context marker.
      console.warn('[TextLabs] Live slide context unavailable; continuing prompt-first:', error)
      const generationContext = buildElementGenerationContext(
        formData.prompt,
        formData.componentType,
        {
          slide_index: generationSlideIndex,
          context_status: 'unavailable',
          elements: [],
        },
        deckReference,
      )
      formData.generationContext = generationContext
      formData.slideContext = generationContext.reference_context.slide ?? null
      formData.deckContext = generationContext.reference_context.deck ?? null
    }

    if (
      (formData.componentType === 'TEXT_BOX' || formData.componentType === 'METRICS') &&
      formData.useDeckTheme === true &&
      formData.count > 1 &&
      formData.elements?.length === formData.count &&
      layoutServiceApis?.sendElementCommand
    ) {
      try {
        const assignmentResponse = await layoutServiceApis.sendElementCommand('getElementThemeVariants', {
          componentType: formData.componentType,
          count: formData.count,
          slideIndex: generationSlideIndex,
          seed: [
            formData.presentationId || 'unsaved',
            generationSlideIndex,
            formData.componentType,
            JSON.stringify(formData.elements.map(item => item.grid_position)),
          ].join(':'),
        })
        const assignments = parseElementThemeAssignments(
          assignmentResponse,
          formData.componentType,
          formData.count,
        )
        formData.elements = formData.elements.map((element, index) => ({
          ...element,
          theme_variant_id: assignments[index].themeVariantId,
          theme_bindings: assignments[index].themeBindings,
        }))
      } catch (error) {
        console.error('[TextLabs] Multi-element theme assignments failed:', error)
        generationPanel.setError(
          "Couldn't assign deterministic deck-theme treatments. No elements were generated; retry when the presentation is available.",
        )
        return
      }
    }

    if (formData.componentType === 'METRICS') {
      // Persist the same sparse ownership metadata that is sent over the wire.
      // Otherwise a response without bindings metadata could fall back to the
      // pre-request ThemeContract map and silently reattach a manual override.
      formData.themeBindings = detachMetricsOverrideBindings(
        formData.themeBindings,
        formData.metricsConfig,
      )
      formData.elements = formData.elements?.map(element => ({
        ...element,
        theme_bindings: detachMetricsOverrideBindings(
          element.theme_bindings,
          formData.metricsConfig,
        ),
      }))
    }

    if (formData.componentType === 'IMAGE') {
      const imagePreflightError = imageEditPreflightError(
        formData.imageConfig.operation,
        formData.existingElement,
      )
      if (imagePreflightError) {
        generationPanel.setError(imagePreflightError)
        generationPanel.setIsGenerating(false)
        activeGenerationKeysRef.current.delete(generationKey)
        return
      }
    }

    if (formData.componentType === 'CHART') {
      formData.generationConfig = synchronizeChartPanelGenerationConfig(
        formData.generationConfig as Record<string, unknown> | null | undefined,
        formData,
      )
    }

    const preflightTargetError = generationTargetError()
    if (preflightTargetError) {
      generationPanel.setError(preflightTargetError)
      return
    }

    // Structured planning and creative rendering are internal Text Labs work
    // and can exceed the short no-research timeout without invoking Researcher.
    const generationTimeoutMs = resolveElementGenerationTimeoutMs(
      formData.componentType,
      effectiveResearchMode,
    )
    const controller = new AbortController()
    const browserDeadlineAtMs = Date.now() + generationTimeoutMs
    const timeoutId = setTimeout(
      () => controller.abort(),
      generationTimeoutMs,
    )
    let generatedRefineContext: RefineContext | null = null
    const requiresGroundedChartData = formData.componentType === 'CHART'
      && formData.chartConfig.requested_data_source_mode === 'auto'
      && formData.research?.mode === 'on'
    const lifecycleMutationId = createLayoutMutationId(
      refineContext ? `refine:${refineContext.elementId}` : 'generate',
    )

    try {
      const sessionId = await textLabsSession.ensureSession(controller.signal)

      let response
      if (formData.componentType === 'INFOGRAPHIC' && formData.referenceImage) {
        response = await generateInfographic(
          sessionId,
          formData.prompt,
          formData.referenceImage,
          formData.infographicConfig as Record<string, unknown>,
          {
            presentationId: formData.presentationId,
            slideIndex: formData.slideIndex,
            useDeckTheme: formData.useDeckTheme,
            themeOverrides: formData.themeOverrides as Record<string, unknown> | null | undefined,
            themeVariantId: formData.themeVariantId,
            themeBindings: formData.themeBindings,
            refine: formData.refine,
            existingElement: formData.existingElement,
            slideContext: formData.slideContext,
            deckContext: formData.deckContext,
            generationContext: formData.generationContext,
          },
          controller.signal,
        )
      } else {
        const { message, options } = buildApiPayload(sessionId, formData)
        let reusedDiagramAttempt = false
        if (isDiagramGenerationType(formData.componentType)) {
          dispatchedDiagramRequestFingerprint = diagramGenerationRequestFingerprint({
            sessionId,
            message,
            options: { ...options },
          })
          const resolvedAttempt = resolveDiagramGenerationAttemptId({
            submitIntent,
            freshAttemptId: freshGenerationAttemptId,
            requestFingerprint: dispatchedDiagramRequestFingerprint,
            retryCandidate,
          })
          reusedDiagramAttempt = resolvedAttempt.reused
          generationAttemptId = resolvedAttempt.attemptId
          formData.generationAttemptId = generationAttemptId
          options.generationAttemptId = generationAttemptId

          // Session creation consumes part of the browser's absolute budget.
          // Propagate only the real remainder and keep a cleanup window in
          // which Text Labs can return/cancel before the browser aborts.
          const backendDeadlineMs = remainingDiagramBackendDeadlineMs(
            browserDeadlineAtMs,
            Date.now(),
          )
          if (backendDeadlineMs === null) {
            controller.abort()
            throw new DOMException(
              'Insufficient remaining time for diagram generation',
              'AbortError',
            )
          }
          options.deadlineMs = backendDeadlineMs
          // All fallible browser-only preflight has completed and the exact
          // request fingerprint is now frozen. Consume the candidate at the
          // dispatch boundary; an ambiguous failure below republishes it.
          retryCandidateRef.current = null
        }
        // Do not replay /api/chat/message automatically: Auto routing,
        // Researcher, and prompt construction all happen before leaf
        // singleflight. The sole exception is a recovered same-attempt result
        // that explicitly says its terminal model failure needs one fresh run.
        diagramRequestWasDispatched = isDiagramGenerationType(formData.componentType)
        if (diagramRequestWasDispatched) {
          const initialAttemptId = generationAttemptId
          const requestResult = await executeDiagramRequestWithFreshAttemptHandoff({
            submitIntent,
            reusedAttempt: reusedDiagramAttempt,
            initialAttemptId,
            freshAttemptId: freshGenerationAttemptId,
            registry: freshDiagramAttemptHandoffsRef.current,
            resolveFreshBackendDeadlineMs: () => (
              diagramBackendDeadlineBudgetMs(
                browserDeadlineAtMs,
                Date.now(),
              )
            ),
            send: async (attemptId, freshBackendDeadlineMs) => {
              generationAttemptId = attemptId
              formData.generationAttemptId = attemptId
              options.generationAttemptId = attemptId
              if (attemptId !== initialAttemptId) {
                if (freshBackendDeadlineMs === undefined) {
                  throw new DOMException(
                    'Insufficient remaining time for fresh diagram recovery',
                    'AbortError',
                  )
                }
                options.deadlineMs = freshBackendDeadlineMs
              }
              return sendTextLabsMessage(
                sessionId,
                message,
                options,
                controller.signal,
              )
            },
            onFreshAttempt: attemptId => {
              generationAttemptId = attemptId
              formData.generationAttemptId = attemptId
              options.generationAttemptId = attemptId
            },
            onDecision: decision => {
              console.info(
                '[TextLabs] Diagram fresh-attempt decision',
                {
                  submitIntentIsRetry: decision.submitIntentIsRetry,
                  reusedAttempt: decision.reusedAttempt,
                  retryStrategy: decision.retryStrategy,
                  policyEligible: decision.policyEligible,
                  existingHandoff: decision.existingHandoff,
                  registryCapacityAvailable: decision.registryCapacityAvailable,
                  backendBudgetMs: decision.backendBudgetMs,
                  freshAttemptStarted: decision.freshAttemptStarted,
                  freshAttemptJoined: decision.freshAttemptJoined,
                },
              )
            },
          })
          generationAttemptId = requestResult.attemptId
          formData.generationAttemptId = generationAttemptId
          options.generationAttemptId = generationAttemptId
          response = requestResult.response
        } else {
          response = await sendTextLabsMessage(sessionId, message, options, controller.signal)
        }
      }

      if (response.error) {
        throw new Error(
          requiresGroundedChartData
            ? researchedChartRecoveryMessage(response.error)
            : response.error,
        )
      }
      assertGenerationTargetIsStillAuthoritative()

      const elements = response.elements || (response.element ? [response.element] : [])

      if (elements.length === 0) {
        throw new Error(
          requiresGroundedChartData
            ? researchedChartRecoveryMessage(response.message || 'No valid source-backed dataset was returned.')
            : 'No elements returned from API',
        )
      }

      // Insert each element into the canvas
      const effectiveSlideIndex = generationSlideIndex
      const formElements = 'elements' in formData ? formData.elements : undefined
      const manuallyPositionedChart = formData.componentType === 'CHART'
        && formData.positionConfig?.auto_position === false
      const authoritativeGridPosition = manuallyPositionedChart && formData.positionConfig ? {
        start_col: formData.positionConfig.start_col,
        start_row: formData.positionConfig.start_row,
        position_width: formData.positionConfig.position_width,
        position_height: formData.positionConfig.position_height,
      } : currentBlankInfo && formData.count <= 1 ? {
        start_col: currentBlankInfo.startCol,
        start_row: currentBlankInfo.startRow,
        position_width: currentBlankInfo.width,
        position_height: currentBlankInfo.height,
      } : refineContext && formData.positionConfig ? {
        start_col: formData.positionConfig.start_col,
        start_row: formData.positionConfig.start_row,
        position_width: formData.positionConfig.position_width,
        position_height: formData.positionConfig.position_height,
      } : undefined
      for (const [index, element] of elements.entries()) {
        assertGenerationTargetIsStillAuthoritative()
        const fallbackGridPosition = formElements?.[index]?.grid_position
        const existingThemeVariantId = refineContext
          ? (formData.existingElement?.theme_variant_id as string | null | undefined)
          : null
        const existingThemeBindings = refineContext
          ? (formData.existingElement?.theme_bindings as Record<string, string> | null | undefined)
          : null
        const requestedElementTheme = formElements?.[index]
        const resolvedTheme = resolveElementThemeMetadata(element, {
          themeVariantId: requestedElementTheme?.theme_variant_id
            ?? formData.themeVariantId
            ?? existingThemeVariantId,
          themeBindings: requestedElementTheme?.theme_bindings
            ?? formData.themeBindings
            ?? existingThemeBindings,
        })
        const returnedGenerationConfig = element.generation_config
          ?? element.generationConfig
          ?? element.metadata?.generation_config
          ?? element.metadata?.generationConfig
          ?? response.generation_config
          ?? response.generationConfig
          ?? null
        const resolvedChartMetadata = formData.componentType === 'CHART'
          ? element.resolved_chart_metadata
            ?? element.metadata?.resolved_chart_metadata
            ?? response.resolved_chart_metadata
            ?? null
          : null
        const effectiveGenerationConfig = formData.componentType === 'CHART'
          ? mergeChartPanelGenerationConfig(
              formData.generationConfig,
              returnedGenerationConfig,
              resolvedChartMetadata,
            )
          : returnedGenerationConfig ?? formData.generationConfig ?? null
        let elementWithPosition: Parameters<typeof buildInsertionParams>[1] = {
          ...element,
          semantic_role: formData.componentType === 'TEXT_BOX' && formData.slotKind === 'accessory'
            ? null
            : element.semantic_role ?? (formData.componentType === 'TEXT_BOX' ? formData.semanticRole : null),
          slot_name: element.slot_name ?? (formData.componentType === 'TEXT_BOX' ? formData.slotName : null),
          slot_kind: element.slot_kind ?? (formData.componentType === 'TEXT_BOX' ? formData.slotKind : null),
          accessory_type: element.accessory_type ?? (formData.componentType === 'TEXT_BOX' ? formData.accessoryType : null),
          // COMPOSE returns an aggregate compatibility list plus a per-box
          // subset. Never attach the aggregate to every metric card.
          citations_used: element.citations_used ?? (
            formData.componentType === 'METRICS' && elements.length > 1
              ? null
              : response.citations_used ?? null
          ),
          research_provenance: element.research_provenance ?? response.research_provenance ?? null,
          source_provenance: element.source_provenance ?? response.source_provenance ?? null,
          source_citation: element.source_citation ?? response.source_citation ?? null,
          requested_data_source_mode: formData.componentType === 'CHART'
            ? formData.chartConfig.requested_data_source_mode
            : null,
          resolved_chart_metadata: resolvedChartMetadata,
          generation_config: effectiveGenerationConfig,
          resolved_geometry: element.resolved_geometry ?? response.resolved_geometry ?? null,
          platinum_profile: element.platinum_profile ?? response.platinum_profile ?? null,
          resolved_metrics_profile: element.resolved_metrics_profile ?? (
            elements.length === 1 ? response.resolved_metrics_profile ?? null : null
          ),
          generationConfig: effectiveGenerationConfig,
          theme_variant_id: resolvedTheme.themeVariantId,
          theme_bindings: resolvedTheme.themeBindings,
          // Ownership describes the newly returned HTML. Never carry the
          // previous element's owner or infer it from component type.
          style_owner: responseStyleOwner(element),
          // Variant provenance belongs to the assignment workflow and remains
          // stable across refinement/replacement.
          theme_variant_source: parseThemeVariantSource(refineContext?.themeVariantSource)
            ?? parseThemeVariantSource((element as any).theme_variant_source)
            ?? parseThemeVariantSource((element as any).themeVariantSource)
            ?? parseThemeVariantSource((element as any).metadata?.theme_variant_source)
            ?? parseThemeVariantSource((element as any).metadata?.themeVariantSource)
            ?? 'element_generation',
        }
        if (authoritativeGridPosition) {
          elementWithPosition = { ...elementWithPosition, grid_position: authoritativeGridPosition }
        } else if (fallbackGridPosition && !(element as any).grid_position) {
          elementWithPosition = { ...elementWithPosition, grid_position: fallbackGridPosition }
        }
        const insertionComponentType = formData.slotKind === 'accessory'
          ? element.component_type
          : refineContext?.elementType ?? element.component_type
        const { method, params } = buildInsertionParams(
          insertionComponentType,
          elementWithPosition,
          formData.positionConfig,
          formData.paddingConfig,
          formData.z_index,
          effectiveSlideIndex
        )
        const semanticUpsertParams = buildSemanticUpsertParams(
          params,
          effectiveSlideIndex,
          refineContext?.elementId,
        )
        const citationsUsed = Array.isArray(params.citationsUsed) ? params.citationsUsed : []
        const usesCitedUpsert = insertionComponentType === 'TABLE' || (
          insertionComponentType === 'METRICS'
          && (citationsUsed.length > 0 || Boolean(refineContext))
        )
        const citedUpsertParams = usesCitedUpsert
          ? {
              componentType: params.componentType,
              elementId: params.elementId,
              replacesElementId: index === 0 ? refineContext?.elementId : undefined,
              slideIndex: effectiveSlideIndex,
              content: params.content,
              geometry: {
                gridRow: params.gridRow,
                gridColumn: params.gridColumn,
                positionWidth: params.positionWidth,
                positionHeight: params.positionHeight,
              },
              citationsUsed,
              metadata: {
                researchProvenance: params.researchProvenance,
                styleOwner: params.styleOwner,
                themeVariantId: params.themeVariantId,
                themeBindings: params.themeBindings,
                themeVariantSource: params.themeVariantSource,
                resolvedMetricsProfile: params.resolvedMetricsProfile,
                metricsColorVariant: params.metricsColorVariant,
                resolvedTableProfile: params.resolvedTableProfile,
                generationConfig: params.generationConfig,
              },
            }
          : null
        const insertionAction = citedUpsertParams
          ? 'upsertCitedElement'
          : semanticUpsertParams ? 'upsertSemanticElement'
          : method === 'insertElement' ? 'insertTextBox' : method
        const insertResponse = await sendLayoutMutationWithReconciliation(
          layoutServiceApis.sendElementCommand,
          insertionAction,
          (citedUpsertParams ?? semanticUpsertParams ?? params) as Record<string, unknown>,
          `${lifecycleMutationId}:insert:${index}`,
        )
        assertLayoutCommandSucceeded(
          insertResponse,
          usesCitedUpsert
            ? 'Cited element upsert'
            : semanticUpsertParams ? 'Semantic element upsert' : 'Element insertion',
        )
        if ((semanticUpsertParams || usesCitedUpsert) && refineContext && index === 0) refineElementDeleted = true
        const insertedElementId = typeof insertResponse?.elementId === 'string'
          ? insertResponse.elementId
          : typeof params.elementId === 'string'
            ? params.elementId
            : null
        // Layout replaces charts in place when Analytics/Text Labs preserve
        // the existing element ID. Do not run generic refinement cleanup on
        // the newly replaced chart.
        if (
          refineContext &&
          method === 'insertChart' &&
          insertedElementId === refineContext.elementId
        ) {
          refineElementDeleted = true
        }
        if (insertedElementId) {
          insertedElementIds.push(insertedElementId)
          generationPanel.rememberDraftForElement(insertedElementId, formData)
          if (!generatedRefineContext) {
            const generatedContent = (
              params.content
              ?? params.htmlContent
              ?? params.chartHtml
              ?? params.imageUrl
              ?? ''
            )
            const generatedConfig = resolveRefineGenerationConfig(
              params.generationConfig,
              formData.generationConfig,
            )
            const generatedGridPosition = gridPositionFromInsertionParams(params)
            const generatedComponentType = normalizeSemanticComponentType(formData.componentType)
              ?? (formData.componentType as TextLabsComponentType)
            const generatedDiagramSubtype = normalizePersistedDiagramSubtype(
              generatedConfig?.resolved_type,
            ) ?? normalizePersistedDiagramSubtype(
              generatedConfig?.diagram_type,
            ) ?? (
              typeof params.diagramSubtype === 'string'
                ? normalizePersistedDiagramSubtype(params.diagramSubtype)
                : null
            )
            const generatedResearchProvenance = params.researchProvenance
              && typeof params.researchProvenance === 'object'
              && !Array.isArray(params.researchProvenance)
              ? params.researchProvenance as Record<string, unknown>
              : null
            const generatedZIndex = typeof params.zIndex === 'number' && Number.isFinite(params.zIndex)
              ? params.zIndex
              : typeof formData.z_index === 'number' && Number.isFinite(formData.z_index)
                ? formData.z_index
                : null
            const generatedChartData = chartRefinementDataSnapshot(
              generatedComponentType,
              params as Record<string, unknown>,
            )
            const generatedProperties = params.structuredPlan
              || Object.keys(generatedChartData).length > 0
              ? {
                  ...generatedChartData,
                  ...(params.structuredPlan
                    ? { structuredPlan: params.structuredPlan }
                    : {}),
                }
              : undefined
            generatedRefineContext = {
              elementId: insertedElementId,
              elementType: generatedComponentType,
              slideIndex: effectiveSlideIndex,
              gridPosition: generatedGridPosition,
              themeVariantId: typeof params.themeVariantId === 'string' ? params.themeVariantId : null,
              themeBindings: params.themeBindings && typeof params.themeBindings === 'object'
                ? params.themeBindings as Record<string, string>
                : null,
              styleOwner: typeof params.styleOwner === 'string' ? params.styleOwner : null,
              themeVariantSource: typeof params.themeVariantSource === 'string' ? params.themeVariantSource : null,
              semanticRole: typeof params.semanticRole === 'string' ? params.semanticRole as RefineContext['semanticRole'] : null,
              slotName: typeof params.slotName === 'string' ? params.slotName : null,
              slotKind: typeof params.slotKind === 'string' ? params.slotKind as RefineContext['slotKind'] : null,
              accessoryType: typeof params.accessoryType === 'string' ? params.accessoryType : null,
              generationConfig: generatedConfig,
              citationsUsed,
              metricsColorVariant: typeof params.metricsColorVariant === 'string' ? params.metricsColorVariant : null,
              researchProvenance: generatedResearchProvenance,
              diagramSubtype: generatedDiagramSubtype,
              zIndex: generatedZIndex,
              existingElement: {
                element_id: insertedElementId,
                component_type: generatedComponentType,
                renderer_type: params.componentType,
                theme_variant_id: typeof params.themeVariantId === 'string' ? params.themeVariantId : null,
                theme_bindings: params.themeBindings && typeof params.themeBindings === 'object'
                  ? params.themeBindings as Record<string, string>
                  : null,
                style_owner: typeof params.styleOwner === 'string' ? params.styleOwner : null,
                theme_variant_source: typeof params.themeVariantSource === 'string' ? params.themeVariantSource : null,
                semantic_role: typeof params.semanticRole === 'string' ? params.semanticRole : null,
                slot_name: typeof params.slotName === 'string' ? params.slotName : null,
                slot_kind: typeof params.slotKind === 'string' ? params.slotKind : null,
                accessory_type: typeof params.accessoryType === 'string' ? params.accessoryType : null,
                generation_config: generatedConfig,
                citations_used: citationsUsed,
                metrics_color_variant: typeof params.metricsColorVariant === 'string' ? params.metricsColorVariant : null,
                research_provenance: generatedResearchProvenance,
                diagram_subtype: generatedDiagramSubtype,
                z_index: generatedZIndex,
                ...generatedChartData,
                properties: generatedProperties,
                content: generatedContent,
                grid_position: generatedGridPosition,
              },
              slideContext: formData.slideContext && typeof formData.slideContext === 'object'
                ? formData.slideContext as Record<string, unknown>
                : null,
              deckContext: formData.deckContext && typeof formData.deckContext === 'object'
                ? formData.deckContext as Record<string, unknown>
                : deckContext ?? null,
              research: {
                store_name: researchDisabled ? null : effectiveResearchStoreName,
                session_id: researchDisabled ? null : effectiveResearchSessionId,
              },
            }
          }
        }
      }
      assertGenerationTargetIsStillAuthoritative()

      // Create-first replacement: preserve the original placeholder until
      // every generated element has been acknowledged by Layout. A failed
      // insertion therefore leaves the authoritative original recoverable.
      if (
        currentBlankId
        && layoutServiceApis?.sendElementCommand
        && !insertedElementIds.includes(currentBlankId)
      ) {
        try {
          const deleteResponse = await sendLayoutMutationWithReconciliation(
            layoutServiceApis.sendElementCommand,
            'deleteElement',
            { elementId: currentBlankId },
            `${lifecycleMutationId}:delete-placeholder-after-insert`,
          )
          assertLayoutCommandSucceeded(
            deleteResponse,
            'Original placeholder deletion',
          )
          blankElements.removeElement(currentBlankId)
          blankTrackingWasRemoved = true
          blankOverlayActive = false
        } catch (deleteError) {
          if (layoutMutationStateIsAmbiguous(deleteError)) {
            // The placeholder may already be gone. Keep the inserted content
            // and let reload reconcile the saved slide; rolling it back could
            // otherwise leave the user with neither copy.
            insertedElementIds.length = 0
          }
          throw deleteError
        }
      }

      if (refineContext && !refineElementDeleted && layoutServiceApis?.sendElementCommand) {
        try {
          assertGenerationTargetIsStillAuthoritative()
          const deleteResponse = await sendLayoutMutationWithReconciliation(
            layoutServiceApis.sendElementCommand,
            'deleteElement',
            { elementId: refineContext.elementId },
            `${lifecycleMutationId}:delete-original`,
          )
          assertLayoutCommandSucceeded(deleteResponse, 'Original element deletion')
          refineElementDeleted = true
        } catch (deleteError) {
          if (!presentationIsStillAuthoritative()) {
            // The command API may now point at another viewer. Leave both old
            // presentation copies recoverable instead of issuing rollback
            // mutations against an unrelated presentation.
            insertedElementIds.length = 0
            throw new Error(PRESENTATION_CHANGED_DURING_GENERATION, { cause: deleteError })
          }
          if (layoutMutationStateIsAmbiguous(deleteError)) {
            // The original may already be gone. Do not roll back the new copy
            // while deletion state is unknown, or a lost receipt could erase
            // both elements.
            insertedElementIds.length = 0
            throw deleteError
          }
          const rollbackResults = await Promise.allSettled(
            insertedElementIds.map((elementId, index) => sendLayoutMutationWithReconciliation(
              layoutServiceApis.sendElementCommand,
              'deleteElement',
              { elementId },
              `${lifecycleMutationId}:rollback-original-delete:${index}`,
            )),
          )
          const rollbackFailed = rollbackResults.some(result => (
            result.status === 'rejected' || !layoutCommandSucceeded(result.value)
          ))
          insertedElementIds.length = 0
          throw new Error(
            rollbackFailed
              ? 'The original could not be replaced and the generated copy could not be fully rolled back. Reload the slide before trying again.'
              : 'The original could not be replaced. The generated copy was removed and your original was left unchanged.',
            { cause: deleteError },
          )
        }
      }

      if (currentBlankId && generatedRefineContext && elements.length === 1) {
        generationPanel.completeBlankReplacement(
          generatedRefineContext.elementType,
          currentBlankId,
          generatedRefineContext,
        )
      } else if (generatedRefineContext && generationPanel.getSnapshot().isOpen) {
        generationPanel.openPanelForRefine(generatedRefineContext.elementType, generatedRefineContext)
      }
      toast({
        title: refineContext ? 'Element refined' : 'Element generated',
        description: refineContext
          ? `${formData.componentType.replace(/_/g, ' ')} updated on slide`
          : `${formData.componentType.replace(/_/g, ' ')} added to slide`,
      })
      console.log(`[TextLabs] Generated ${elements.length} ${formData.componentType} element(s)`)
    } catch (err) {
      let errorRetryStrategy = diagramRequestWasDispatched
        ? diagramRetryStrategyForFailure(err)
        : null
      if (
        diagramRequestWasDispatched
        && dispatchedDiagramRequestFingerprint
        && errorRetryStrategy === 'resume_same_attempt'
        && isAmbiguousDiagramRequestFailure(err)
      ) {
        retryCandidateRef.current = {
          attemptId: generationAttemptId,
          requestFingerprint: dispatchedDiagramRequestFingerprint,
        }
      } else if (diagramRequestWasDispatched) {
        // A terminal response must never retain an older ambiguous identity.
        retryCandidateRef.current = null
      }
      let errorMessage = 'Generation failed'
      if (
        controller.signal.aborted
        || (err instanceof Error && err.name === 'AbortError')
      ) {
        const timeoutSeconds = generationTimeoutMs / 1000
        errorMessage = `Generation timed out after ${timeoutSeconds} seconds. Try again or simplify your prompt.`
      } else if (err instanceof TextLabsRequestError) {
        errorRetryStrategy = err.retryStrategy
        const reference = err.requestId
          ? ` Request reference: ${err.requestId.slice(0, 12)}.`
          : ` Request reference: ${generationAttemptId.slice(0, 12)}.`
        const downstreamReference = (
          err.downstreamRequestId
          && err.downstreamRequestId !== err.requestId
        )
          ? ` Diagram reference: ${err.downstreamRequestId.slice(0, 12)}.`
          : ''
        if (err.kind === 'transport') {
          errorMessage = `The generation service could not be reached.${reference}${downstreamReference}`
        } else {
          errorMessage = `${err.message}${reference}${downstreamReference}`
        }
      } else if (err instanceof TypeError && /fetch|network/i.test(err.message)) {
        errorMessage = `The generation service could not be reached. Request reference: ${generationAttemptId.slice(0, 12)}.`
      } else if (err instanceof Error) {
        errorMessage = err.message
      }
      if (
        requiresGroundedChartData &&
        !errorMessage.includes('Data Source → Illustrative') &&
        /research|chart data|valid data|source-backed|no elements/i.test(errorMessage)
      ) {
        errorMessage = researchedChartRecoveryMessage(errorMessage)
      }
      console.error('[TextLabs] Generation error:', err)

      const presentationTargetChanged = !presentationIsStillAuthoritative()
      if (presentationTargetChanged) {
        errorMessage = PRESENTATION_CHANGED_DURING_GENERATION
        errorRetryStrategy = 'do_not_retry'
        // The captured command bridge may now resolve to a different iframe.
        // Never perform compensating mutations until the original deck is
        // reloaded and its actual lifecycle state can be inspected.
        insertedElementIds.length = 0
      }
      if (
        !presentationTargetChanged &&
        (!refineContext || !refineElementDeleted) &&
        insertedElementIds.length > 0 &&
        layoutServiceApis?.sendElementCommand
      ) {
        const rollbackResults = await Promise.allSettled(
          insertedElementIds.map((elementId, index) => sendLayoutMutationWithReconciliation(
            layoutServiceApis.sendElementCommand,
            'deleteElement',
            { elementId },
            `${lifecycleMutationId}:rollback-generation:${index}`,
          )),
        )
        if (rollbackResults.some(result => (
          result.status === 'rejected' || !layoutCommandSucceeded(result.value)
        ))) {
          errorMessage += ' Some generated elements could not be removed; reload the slide before retrying.'
        }
        insertedElementIds.length = 0
      }
      // Restore placeholder on failure
      let restoredBlankElementId: string | null = currentBlankId
      if (
        !presentationTargetChanged &&
        currentBlankId &&
        currentBlankInfo &&
        blankTrackingWasRemoved &&
        layoutServiceApis?.sendElementCommand
      ) {
        const recoveryBlankInfo = currentBlankInfo
        blankElements.setStatus(currentBlankId, 'blank')
        const placeholderHtml = buildPlaceholderHtml(currentBlankId, formData.componentType)
        const gridRow = `${snapGridLine(recoveryBlankInfo.startRow)}/${snapGridLine(recoveryBlankInfo.startRow + recoveryBlankInfo.height)}`
        const gridColumn = `${snapGridLine(recoveryBlankInfo.startCol)}/${snapGridLine(recoveryBlankInfo.startCol + recoveryBlankInfo.width)}`
        try {
          restoredBlankElementId = await restoreBlankElementAfterFailure({
            elementId: currentBlankId,
            trackingWasRemoved: blankTrackingWasRemoved,
            deleteElement: () => layoutServiceApis.sendElementCommand('deleteElement', {
              elementId: currentBlankId,
            }),
            insertElement: () => layoutServiceApis.sendElementCommand('insertTextBox', {
              elementId: currentBlankId,
              slideIndex: recoveryBlankInfo.slideIndex,
              content: placeholderHtml,
              gridRow,
              gridColumn,
              positionWidth: recoveryBlankInfo.width,
              positionHeight: recoveryBlankInfo.height,
              zIndex: 10,
              draggable: true,
              resizable: true,
              skipAutoSize: true,
              componentType: recoveryBlankInfo.componentType,
              themeVariantId: recoveryBlankInfo.themeVariantId,
              themeBindings: recoveryBlankInfo.themeBindings,
              themeVariantSource: 'element_generation',
            }),
            restoreTracking: restoredElementId => {
              blankElements.removeElement(currentBlankId)
              blankElements.addElement({
                ...recoveryBlankInfo,
                elementId: restoredElementId,
                status: 'blank',
              })
              blankElements.trackElement(restoredElementId)
              const latestPanel = generationPanel.getSnapshot()
              if (!latestPanel.isOpen) {
                generationPanel.resumePanelForElement(recoveryBlankInfo.componentType, restoredElementId)
              }
            },
            onDeleteError: deleteError => {
              console.warn('[TextLabs] Spinner was already absent during placeholder recovery:', deleteError)
            },
          })
          const latestPanel = generationPanel.getSnapshot()
          if (restoredBlankElementId && (!latestPanel.isOpen || latestPanel.blankElementId === currentBlankId)) {
            generationPanel.resumePanelForElement(recoveryBlankInfo.componentType, restoredBlankElementId)
          }
        } catch (restoreErr) {
          console.warn('[TextLabs] Failed to restore placeholder after error:', restoreErr)
        }
      } else if (!presentationTargetChanged && currentBlankId && currentBlankInfo) {
        // Pre-insertion failures leave the original placeholder in place.
        blankElements.setStatus(currentBlankId, 'blank')
      }
      // openPanelForElement clears prior panel errors, so publish the final
      // failure only after any placeholder/tracking recovery has completed.
      const latestPanel = generationPanel.getSnapshot()
      const ownsCurrentPanel = currentBlankId
        ? latestPanel.blankElementId === currentBlankId || latestPanel.blankElementId === restoredBlankElementId
        : refineContext
          ? latestPanel.editElementId === refineContext.elementId
          : !latestPanel.isOpen
      if (currentBlankId && currentBlankInfo && (!latestPanel.isOpen || ownsCurrentPanel)) {
        generationPanel.setError(errorMessage)
        generationPanel.setRetryStrategy(errorRetryStrategy)
      } else if (ownsCurrentPanel || !latestPanel.isOpen) {
        generationPanel.setError(errorMessage)
        generationPanel.setRetryStrategy(errorRetryStrategy)
      } else {
        toast({
          title: 'Element generation failed',
          description: errorMessage,
        })
      }
      } finally {
        clearTimeout(timeoutId)
      }
    } finally {
      await cleanupGenerationLifecycle()
    }
  }, [
    generationPanel,
    textLabsSession,
    layoutServiceApis,
    renderPresentationTarget,
    toast,
    currentSlideIndex,
    getCurrentSlideIndex,
    blankElements,
    deckContext,
    researchSessionId,
    researchStoreName,
    researchUserId,
    researchCapabilities,
    getThemeSyncSnapshot,
    ensureThemeReady,
  ])

  const handleOpenPanel = useCallback(async (type: string) => {
    const componentType = type as TextLabsComponentType
    const defaults = getDefaultSize(componentType)
    const startCol = 2
    const startRow = 4

    if (!layoutServiceApis?.sendElementCommand) {
      const message = 'The presentation viewer is not ready, so an element placeholder could not be added.'
      generationPanel.setError(message)
      toast({ title: 'Element not added', description: message })
      return
    }

    try {
      const targetSlideIndex = getCurrentSlideIndex?.() ?? currentSlideIndex
      const tempId = `blank_${Date.now()}`
      const placeholderHtml = buildPlaceholderHtml(tempId, componentType)

      const gridRow = `${startRow}/${startRow + defaults.height}`
      const gridColumn = `${startCol}/${startCol + defaults.width}`

      const response = await layoutServiceApis.sendElementCommand('insertTextBox', {
        elementId: tempId,
        slideIndex: targetSlideIndex,
        content: placeholderHtml,
        gridRow,
        gridColumn,
        positionWidth: defaults.width,
        positionHeight: defaults.height,
        zIndex: defaults.zIndex,
        draggable: true,
        resizable: true,
        skipAutoSize: true,
        componentType,
        themeVariantSource: 'element_generation',
      })
      if (response?.success === false) {
        throw new Error(response.error || 'Layout rejected the blank placeholder')
      }

      const layoutElementId = response?.elementId || tempId
      const metadata = parseElementGenerationMetadata(response)

      blankElements.addElement({
        elementId: layoutElementId,
        componentType,
        slideIndex: targetSlideIndex,
        startCol,
        startRow,
        width: defaults.width,
        height: defaults.height,
        status: 'blank',
        themeVariantId: metadata.themeVariantId,
        themeBindings: metadata.themeBindings,
      })
      generationPanel.openPanelForElement(componentType, layoutElementId)
    } catch (err) {
      console.warn('[TextLabs] Failed to insert blank placeholder:', err)
      const message = 'The element placeholder could not be added. Please wait for the slide to finish loading and try again.'
      generationPanel.setError(message)
      toast({ title: 'Element not added', description: message })
    }
  }, [generationPanel, layoutServiceApis, blankElements, currentSlideIndex, getCurrentSlideIndex, toast])

  return { handleGenerate, handleOpenPanel }
}
