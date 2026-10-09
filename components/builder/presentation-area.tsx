"use client"

import React from "react"
import { createPortal } from 'react-dom'
import { classifyStudioCanvasLifecycle, type StudioCanvasLifecycle } from '@/lib/studio-canvas-lifecycle'
import { StudioWaitingState } from '@/components/builder/studio-waiting-state'
import type { StudioWorkflowRequest } from "@/lib/studio-workflow"
import { StudioWelcomeStage } from "@/components/builder/studio-welcome-stage"
import { PresentationViewer, TextBoxFormatting, type RefineElementRequest, type SlideComposeViewerApi, type StudioThumbnailMutationCapture } from "@/components/presentation-viewer"
import { PresentationDownloadControls } from "@/components/presentation-download-controls"
import { PublishControls } from "@/components/publish-dialog"
import { SlideBuildingLoader } from "@/components/slide-building-loader"
import { StagePlaceholder } from "@/components/build-narration/stage-placeholder"
import { StageRibbon } from "@/components/build-narration/stage-ribbon"
import { StageProgressFooter } from "@/components/build-narration/stage-progress-footer"
import { SlideFrameGlow } from "@/components/build-narration/slide-frame-glow"
import { QAPill } from "@/components/build-narration/qa-pill"
import { SlideContextCard } from "@/components/build-narration/slide-context-card"
import { useStageWalkthrough } from "@/components/build-narration/use-stage-walkthrough"
import type { PauseStopControlProps } from "@/components/build-narration/pause-stop-control"
import type { SlideContextItem } from "@/hooks/use-deckster-websocket-v2"
import {
  exportControlsAllowed,
  shouldShowBlankPlaceholder,
  type NarrationState,
} from "@/lib/build-narration-heuristics"
import type { SlideComposeThumbnailJob } from "@/components/slide-thumbnail-strip"
// Branding ("powered by deckster") lives inside PresentationViewer's
// slide column so it tracks the slide's right edge, not the container.
import { ElementType, ElementProperties } from '@/types/elements'
import type { BlankElementInfo } from '@/hooks/use-blank-elements'
import type { TemplateBlueprint, TemplateSelection, TemplateSnapshot } from '@/hooks/use-templates'
import type { SlideRefineTarget } from '@/lib/slide-refinement'
import type { BuildThemeSelection } from '@/lib/theme-builder'
import type { AddSlideV2Settings } from '@/lib/studio-add-slide-v2'
import type { ThemeSyncState } from '@/lib/theme-sync'
import type { SlideThumbnailUrlsByPresentation } from '@/lib/stage-f-thumbnails'

/** Check if a selected element is a blank placeholder; if so, open generation panel instead of format panel */
export function handleBlankElementClick(
  elementId: string,
  blankElements: {
    isBlankElement: (id: string) => boolean
    getElement: (id: string) => BlankElementInfo | undefined
  },
  openBlankGenerationPanel: (componentType: any, elementId: string) => void,
): boolean {
  if (blankElements.isBlankElement(elementId)) {
    const info = blankElements.getElement(elementId)
    if (info) {
      if (info.status === 'generating') return true // no panel during generation
      openBlankGenerationPanel(info.componentType, elementId)
    }
    return true
  }
  return false
}

export interface PresentationAreaProps {
  onStudioFormatRequested?: (selection: import('@/lib/studio-format-native').StudioFormatSelectionHandle) => void
  studioFormatBusy?: boolean
  onStudioIntroductionSafetyChange?: (safety: import("@/components/presentation-viewer").StudioIntroductionSafety | null) => void
  studioIntroReplay?: React.ReactNode
  showOutlinePreview?: boolean
  studioCanvasLifecycle?: StudioCanvasLifecycle
  studioInitialNativeDeferred?: boolean
  studioPartialStagePending?: boolean
  studioPartialArtifact?: boolean
  onStudioPartialNativeReadback?: (readback: import('@/components/presentation-viewer').StudioPartialNativeReadback) => void
  studioNativeOwner?: object
  onStudioNativeMounted?: (owner: object) => void
  awaitingDirectorReply?: boolean
  studioWorkflowRequest?: StudioWorkflowRequest | null
  presentationUrl: string | null
  presentationId: string | null
  slideCount: number | null
  slideStructure: any
  strawmanPreviewUrl: string | null
  finalPresentationUrl: string | null
  activeVersion: string | null
  isBlankPresentation?: boolean
  onVersionSwitch: (version: any) => void
  currentStage: number
  currentSlideIndex: number
  onSlideChange: (slideNum: number) => void
  currentStatus: any
  isGeneratingFinal: boolean
  isGeneratingStrawman: boolean
  // Layout Service API setter
  onApiReady: (apis: any) => void
  onComposeApiReady?: (apis: SlideComposeViewerApi | null) => void
  // Text box selection
  onTextBoxSelected: (
    elementId: string,
    formatting: TextBoxFormatting | null,
    componentType?: string,
  ) => void
  onTextBoxDeselected: () => void
  // Element selection
  onElementSelected: (elementId: string, elementType: ElementType, properties: ElementProperties) => void
  onElementDeselected: () => void
  onElementDeleted: (elementId: string) => void
  // Blank elements
  blankElements: {
    isBlankElement: (id: string) => boolean
    getElement: (id: string) => BlankElementInfo | undefined
    updatePosition: (elementId: string, startCol: number, startRow: number, width: number, height: number) => void
  }
  generationPanel: {
    isGenerating: boolean
    hasActiveGenerations: boolean
  }
  onOpenBlankGenerationPanel: (componentType: any, elementId: string) => void
  // Generation panel handler (for toolbar)
  onOpenGenerationPanel?: (type: string) => void
  onRefineElementRequested?: (payload: RefineElementRequest) => void
  onEditModeChange?: (isEditing: boolean) => void
  buildThemeSelection: BuildThemeSelection
  themeSync: ThemeSyncState
  onBuildThemeChange: (selection: BuildThemeSelection) => void
  // Bottom toolbar items (moved from header)
  connected: boolean
  connecting: boolean
  toolbarPortalTarget?: HTMLDivElement | null
  toolbarOffset?: number
  // Publish: ChatSession id + gate (final deck required by the publish API)
  publishSessionId?: string | null
  deckTitle?: string | null
  hasFinalDeck?: boolean
  publishFinalPresentationId?: string | null
  publishThumbnailUrlsByPresentation?: SlideThumbnailUrlsByPresentation
  publishThumbnailOwnerSessionId?: string | null
  // Template Builder: WS session id (source for "Save as Template") + gate
  sessionId?: string | null
  deckOwnerSessionId?: string | null
  templateSavePresentationId?: string | null
  templateBuilderEnabled?: boolean
  onSelectTemplate?: (template: TemplateSelection) => void
  onTemplateOptimizationFailed?: (templateId: string) => void
  templateSelectionLocked?: boolean
  templateModeOn?: boolean
  onTemplateModeChange?: (enabled: boolean) => void
  templateModeAvailable?: boolean
  templateSnapshot?: TemplateSnapshot | null
  templateSnapshotLoading?: boolean
  templateCurrentSlideIndex?: number
  composeJobs?: SlideComposeThumbnailJob[]
  onRefineSlide?: (target: SlideRefineTarget) => void
  onGenerateSlide?: () => void
  addSlideV2Settings?: AddSlideV2Settings<BuildThemeSelection>
  thumbnailUrlsBySlide?: Record<number, string>
  onThumbnailInvalidated?: (presentationId: string) => void
  onThumbnailMutationCapture?: StudioThumbnailMutationCapture
  studioOwnerUserId?: string | null
  selectedTemplateElementId?: string | null
  blueprintEditorV2Enabled?: boolean
  onTemplateSlideChange?: (slideIndex: number) => void
  onTemplateElementSelect?: (overrideKey: string | null) => void
  onTemplateBlueprintChange?: (blueprint: TemplateBlueprint) => void
  // Build Narration v2 (NEXT_PUBLIC_BUILD_NARRATION). When active, narration
  // renders as chrome around the slide via the viewer's stageChrome slots and
  // the legacy SlideBuildingLoader mounts are suppressed. Both undefined when
  // the flag is off — zero behavior change.
  buildNarration?: NarrationState | null
  buildNarrationApi?: {
    onPin: (slideIndex: number | null) => void
    control?: Omit<PauseStopControlProps, 'control' | 'slidesDone' | 'slideCount'>
  } | null
  // Canvas v2 R1: the narration flag itself (placeholder shows before any
  // build starts, when buildNarration is still inactive) + the per-session
  // dismissal of the blank-landing placeholder.
  buildNarrationEnabled?: boolean
  blankPlaceholderDismissed?: boolean
  onDismissBlankPlaceholder?: () => void
  // Canvas v2 R3: research context per slide + viewer navigation for the deck
  // walkthrough (0-based postMessage goToSlide — never remounts the iframe).
  slideContextByIndex?: Record<number, SlideContextItem> | null
  narrationNavigate?: ((slideIndex: number) => void) | null
}

export function PresentationArea({
  studioCanvasLifecycle,
  studioInitialNativeDeferred = false,
  studioNativeOwner,
  studioPartialStagePending = false,
  studioPartialArtifact = false,
  onStudioPartialNativeReadback,
  onStudioNativeMounted,
  studioIntroReplay,
  onStudioIntroductionSafetyChange,
  showOutlinePreview = false,
  awaitingDirectorReply = false,
  presentationUrl,
  presentationId,
  slideCount,
  slideStructure,
  strawmanPreviewUrl,
  finalPresentationUrl,
  activeVersion,
  isBlankPresentation = false,
  onVersionSwitch,
  currentStage,
  currentSlideIndex,
  onSlideChange,
  currentStatus,
  isGeneratingFinal,
  isGeneratingStrawman,
  onApiReady,
  onComposeApiReady,
  onStudioFormatRequested,
  studioFormatBusy,
  onTextBoxSelected,
  onTextBoxDeselected,
  onElementSelected,
  onElementDeselected,
  onElementDeleted,
  blankElements,
  generationPanel,
  onOpenBlankGenerationPanel,
  onOpenGenerationPanel,
  onRefineElementRequested,
  onEditModeChange,
  buildThemeSelection,
  themeSync,
  onBuildThemeChange,
  connected,
  connecting,
  toolbarPortalTarget,
  toolbarOffset,
  publishSessionId,
  deckTitle,
  hasFinalDeck = false,
  publishFinalPresentationId,
  publishThumbnailUrlsByPresentation,
  publishThumbnailOwnerSessionId,
  sessionId,
  deckOwnerSessionId,
  templateSavePresentationId,
  templateBuilderEnabled,
  onSelectTemplate,
  onTemplateOptimizationFailed,
  templateSelectionLocked = false,
  templateModeOn = false,
  onTemplateModeChange,
  templateModeAvailable = false,
  templateSnapshot = null,
  templateSnapshotLoading = false,
  templateCurrentSlideIndex,
  composeJobs = [],
  onRefineSlide,
  onGenerateSlide,
  addSlideV2Settings,
  thumbnailUrlsBySlide = {},
  onThumbnailInvalidated,
  onThumbnailMutationCapture,
  studioOwnerUserId,
  selectedTemplateElementId = null,
  blueprintEditorV2Enabled = false,
  onTemplateSlideChange,
  onTemplateElementSelect,
  onTemplateBlueprintChange,
  buildNarration = null,
  buildNarrationApi = null,
  buildNarrationEnabled = false,
  blankPlaceholderDismissed = false,
  onDismissBlankPlaceholder,
  slideContextByIndex = null,
  narrationNavigate = null,
  studioWorkflowRequest = null,
}: PresentationAreaProps) {
  const studioShell = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'
  const narrationActive = !!(buildNarration && buildNarration.active)
  const narrationPhase = buildNarration?.phase ?? 'idle'
  // Canvas v2 R3: the deck walkthrough — auto-step the real strawman once,
  // then follow freshly built slides during the write phases; user navigation
  // cancels automation for the remainder of the phase.
  useStageWalkthrough({
    enabled: narrationActive,
    phase: narrationPhase,
    slideCount: buildNarration?.slideCount ?? 0,
    focusSlide: buildNarration?.focusSlide ?? null,
    navigate: narrationNavigate,
    currentSlideIndex,
  })
  // F-4 export-safety, re-derived for v2 (the old hidden-strawman state is gone):
  // Download/Publish only when the deck on stage is a settled artifact.
  const exportsAllowed = !studioPartialArtifact && exportControlsAllowed(narrationActive, narrationPhase)
  // Toolbar hidden only while nothing real is on stage yet.
  const toolbarSuppressed = narrationActive && narrationPhase === 'planning'
  // Canvas v2 R1 (rev 2): cover any CONTENTLESS landing deck with the designed
  // placeholder — restore can mislabel a fresh deck 'final', so the gate keys
  // on authored content (slide structure), not on the version label.
  const legacyBlankPlaceholder = shouldShowBlankPlaceholder(buildNarrationEnabled, {
    dismissed: blankPlaceholderDismissed,
    hasSlideStructure: Boolean(
      slideStructure && Array.isArray(slideStructure?.slides ?? slideStructure)
        ? (slideStructure?.slides ?? slideStructure).length > 0
        : slideStructure,
    ),
    // Legacy loader veto only when narration is NOT active (mirrors the
    // viewer's isGenerating suppression): under narration, planning keeps the
    // placeholder up with ribbon/glow around it.
    isGenerating: narrationActive ? false : isGeneratingFinal || isGeneratingStrawman,
    phase: narrationActive ? narrationPhase : 'idle',
    hasPresentationUrl: Boolean(presentationUrl),
  })
  const lifecycle = studioCanvasLifecycle ?? classifyStudioCanvasLifecycle({
    displayedSessionId: publishSessionId ?? sessionId ?? null,
    deckOwnerSessionId: deckOwnerSessionId ?? null,
    selected: { presentationId, presentationUrl,
      activeVersion: activeVersion === 'blank' || activeVersion === 'strawman' ? activeVersion : 'final', slideCount },
    finalPresentationId: publishFinalPresentationId ?? null,
    finalPresentationUrl,
    hasAuthoredStructure: Boolean((slideStructure?.slides ?? (Array.isArray(slideStructure) ? slideStructure : [])).length),
    loading: false,
    generating: narrationActive ? false : isGeneratingFinal || isGeneratingStrawman,
    phase: narrationActive ? narrationPhase : 'idle',
    dismissed: blankPlaceholderDismissed,
    connected, connecting,
  })
  const waitingActivity = currentStatus?.status === 'thinking' || awaitingDirectorReply ? 'thinking' as const
    : currentStatus?.status === 'awaiting_user' ? 'awaiting_user' as const
    : (isGeneratingFinal || isGeneratingStrawman || currentStatus?.status === 'generating') ? 'planning' as const : undefined
  const waitingForDirector = narrationActive || !!waitingActivity
  const workingPlaceholder = studioShell && !blankPlaceholderDismissed && lifecycle.hasOwnedSelection
    && !lifecycle.hasGeneratedDeck && !lifecycle.hasAuthoredDeck
    && waitingForDirector && (narrationPhase === 'idle' || narrationPhase === 'planning' || narrationPhase === 'awaiting_user')
  const showBlankPlaceholder = studioShell
    ? !studioPartialArtifact && ((legacyBlankPlaceholder && lifecycle.showLanding) || workingPlaceholder)
    : legacyBlankPlaceholder
  // Visual intro only. Native ribbon/footer, viewer identity and real build state stay active.
  const outlinePreview = studioShell && !studioPartialArtifact && showOutlinePreview && narrationActive
    && buildNarration?.phase === 'building' && buildNarration.slidesDone === 0
  const waitingNarration = outlinePreview && buildNarration
    ? { ...buildNarration, phase: 'strawman' as const, phaseLabel: 'Outline ready — building has begun' }
    : buildNarration
  const focusContext =
    narrationActive && slideContextByIndex ? slideContextByIndex[currentSlideIndex] : null
  // Canvas v2 R2/R3: narration chrome anchors to the slide via the viewer slots.
  const stageChrome =
    showBlankPlaceholder || outlinePreview || studioPartialStagePending || (narrationActive && buildNarration)
      ? {
          placeholder: outlinePreview ? (
            <div className="absolute inset-0 z-30 pointer-events-none" data-studio-outline-preview="true"><StudioWaitingState scope="canvas" narration={waitingNarration} /></div>
          ) : showBlankPlaceholder ? (
            studioShell && waitingForDirector ? <div className="absolute inset-0 z-30">
              <StudioWaitingState scope="canvas" narration={waitingNarration} activity={waitingActivity} />
              {workingPlaceholder && onDismissBlankPlaceholder && <button type="button" onClick={onDismissBlankPlaceholder}
                className="absolute bottom-3 right-4 rounded-md px-2 py-1 text-xs text-muted-foreground/80 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                data-testid="bn-placeholder-dismiss" data-studio-stage-placeholder-dismiss="true">Start on this blank canvas</button>}
            </div>
              : <StagePlaceholder mode="overlay" onDismiss={onDismissBlankPlaceholder} />
          ) : undefined,
          ribbon:
            studioPartialStagePending || (narrationActive && buildNarration) ? (
              <>
                {narrationActive && buildNarration ? <StageRibbon narration={buildNarration} control={buildNarrationApi?.control} /> : null}
                {studioPartialStagePending ? <div role="status" className="px-4 py-2 text-sm bg-background text-muted-foreground border-b">
                  New slides are available. Keeping the current canvas until it is ready to switch.
                </div> : null}
              </>
            ) : undefined,
          frame:
            narrationActive && buildNarration ? (
              <>
                <SlideFrameGlow phase={buildNarration.phase} />
                {narrationPhase === 'qa' ? <QAPill narration={buildNarration} /> : null}
              </>
            ) : undefined,
          footer:
            narrationActive && buildNarration ? (
              <StageProgressFooter
                narration={buildNarration}
                researchCard={
                  <SlideContextCard
                    context={focusContext}
                    slideIndex={narrationActive ? currentSlideIndex : null}
                  />
                }
              />
            ) : undefined,
        }
      : null
  const mountNative = Boolean(presentationUrl && !studioInitialNativeDeferred
    && !(studioShell && lifecycle.mode === 'awaiting_owner' && !templateModeOn))
  React.useLayoutEffect(() => {
    if (studioShell && mountNative && studioNativeOwner) onStudioNativeMounted?.(studioNativeOwner)
  }, [studioShell, mountNative, studioNativeOwner, onStudioNativeMounted])
  return (
    <div className="flex-1 flex bg-gray-100 dark:bg-slate-800 min-w-0 min-h-0">
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {presentationUrl && mountNative ? (
          <PresentationViewer
            studioPartialArtifact={studioPartialArtifact}
            onStudioPartialNativeReadback={onStudioPartialNativeReadback}
            studioWorkflowRequest={studioWorkflowRequest}
            presentationUrl={presentationUrl}
            presentationId={presentationId}
            slideCount={slideCount}
            completedBuildSnapshot={
              buildNarrationEnabled && !templateModeOn && buildNarration?.phase === 'complete'
              && buildNarration.buildId && buildNarration.buildPresentationId === presentationId
              && activeVersion === 'final' && presentationUrl === finalPresentationUrl
              ? {
                  buildId: buildNarration.buildId,
                  presentationId: buildNarration.buildPresentationId!,
                  slideCount: buildNarration.slideCount,
                }
              : null
            }
            slideStructure={slideStructure}
            strawmanPreviewUrl={strawmanPreviewUrl}
            finalPresentationUrl={finalPresentationUrl}
            activeVersion={activeVersion as any}
            isBlankPresentation={isBlankPresentation}
            onVersionSwitch={onVersionSwitch}
            showControls={!toolbarSuppressed}
            downloadControls={
              !exportsAllowed ? undefined : (
                <>
                  <PresentationDownloadControls
                    presentationUrl={presentationUrl}
                    presentationId={presentationId}
                    slideCount={slideCount}
                    stage={currentStage}
                  />
                  <PublishControls
                    sessionId={publishSessionId ?? null}
                    deckTitle={deckTitle ?? null}
                    slideCount={slideCount}
                    hasFinalDeck={hasFinalDeck}
                    deckPreview={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? {
                      sessionId: publishSessionId ?? null,
                      ownerSessionId: deckOwnerSessionId ?? null,
                      finalPresentationId: publishFinalPresentationId ?? null,
                      thumbnailUrlsByPresentation: publishThumbnailUrlsByPresentation,
                      thumbnailOwnerSessionId: publishThumbnailOwnerSessionId ?? null,
                      firstSlide: Array.isArray(slideStructure?.slides) ? slideStructure.slides[0] ?? null : null,
                      loading: isGeneratingFinal,
                    } : undefined}
                  />
                </>
              )
            }
            onSlideChange={(slideNum) => {
              if (templateModeOn) {
                onTemplateSlideChange?.(Math.max(0, slideNum - 1))
              }
              onSlideChange(slideNum)
            }}
            onEditModeChange={(isEditing) => {
              console.log(`✏️ Edit mode: ${isEditing ? 'ON' : 'OFF'}`)
              onEditModeChange?.(isEditing)
            }}
            onStudioFormatRequested={onStudioFormatRequested}
            studioFormatBusy={studioFormatBusy}
            onTextBoxSelected={(elementId, formatting, componentType) => {
              if (handleBlankElementClick(elementId, blankElements, onOpenBlankGenerationPanel)) return
              onTextBoxSelected(elementId, formatting, componentType)
            }}
            onTextBoxDeselected={onTextBoxDeselected}
            onElementSelected={(elementId, elementType, properties) => {
              if (handleBlankElementClick(elementId, blankElements, onOpenBlankGenerationPanel)) return
              onElementSelected(elementId, elementType, properties)
            }}
            onElementDeselected={onElementDeselected}
            onElementDeleted={onElementDeleted}
            onApiReady={onApiReady}
            onComposeApiReady={onComposeApiReady}
            onOpenGenerationPanel={onOpenGenerationPanel}
            onRefineElementRequested={onRefineElementRequested}
            buildThemeSelection={buildThemeSelection}
            themeSync={themeSync}
            onBuildThemeChange={onBuildThemeChange}
            connected={connected}
            connecting={connecting}
            onElementMoved={(elementId, gridRow, gridColumn) => {
              if (blankElements.isBlankElement(elementId)) {
                const rowParts = gridRow.split('/').map(Number)
                const colParts = gridColumn.split('/').map(Number)
                if (rowParts.length === 2 && colParts.length === 2) {
                  blankElements.updatePosition(
                    elementId,
                    colParts[0],
                    rowParts[0],
                    colParts[1] - colParts[0],
                    rowParts[1] - rowParts[0]
                  )
                }
              }
            }}
            toolbarPortalTarget={toolbarPortalTarget}
            sessionId={sessionId}
            deckOwnerSessionId={deckOwnerSessionId}
            templateSavePresentationId={templateSavePresentationId}
            templateBuilderEnabled={templateBuilderEnabled}
            onSelectTemplate={onSelectTemplate}
            onTemplateOptimizationFailed={onTemplateOptimizationFailed}
            templateSelectionLocked={templateSelectionLocked || generationPanel.hasActiveGenerations}
            templateModeOn={templateModeOn}
            onTemplateModeChange={onTemplateModeChange}
            templateModeAvailable={templateModeAvailable}
            composeJobs={composeJobs}
            onRefineSlide={onRefineSlide}
            onGenerateSlide={onGenerateSlide}
            addSlideV2Settings={addSlideV2Settings}
            thumbnailUrlsBySlide={thumbnailUrlsBySlide}
            onThumbnailInvalidated={onThumbnailInvalidated}
            onThumbnailMutationCapture={onThumbnailMutationCapture}
            studioOwnerUserId={studioOwnerUserId}
            templateSnapshot={templateSnapshot}
            templateSnapshotLoading={templateSnapshotLoading}
            templateCurrentSlideIndex={templateCurrentSlideIndex}
            selectedTemplateElementId={selectedTemplateElementId}
            blueprintEditorV2Enabled={blueprintEditorV2Enabled}
            onTemplateElementSelect={onTemplateElementSelect}
            onTemplateBlueprintChange={onTemplateBlueprintChange}
            toolbarOffset={toolbarOffset}
            isGenerating={narrationActive ? false : workingPlaceholder ? false : (isGeneratingFinal || isGeneratingStrawman)}
            generatingMode={isGeneratingFinal ? 'default' : 'strawman'}
            onStudioIntroductionSafetyChange={onStudioIntroductionSafetyChange}
            studioIntroReplay={studioIntroReplay}
            stageChrome={stageChrome}
            className="flex-1"
          />
        ) : studioShell && studioInitialNativeDeferred ? (
          <div className="flex-1 flex min-h-0 items-center justify-center p-4" data-studio-initial-native-deferred="true">
            {toolbarPortalTarget && createPortal(<div data-studio-v4-delivery="true"><div className="flex flex-shrink-0 items-center gap-1">
              <PresentationDownloadControls presentationUrl={null} presentationId={null} slideCount={null} stage={0} />
              <PublishControls sessionId={null} deckTitle={deckTitle ?? null} slideCount={null} hasFinalDeck={false} />
            </div></div>, toolbarPortalTarget)}
            <div className="flex w-full min-h-0 flex-col items-center gap-3">
              {narrationActive && buildNarration && <StageRibbon narration={buildNarration} control={buildNarrationApi?.control} />}
              <StudioWelcomeStage studioIntroReplay={studioIntroReplay} />
              {waitingForDirector && <StudioWaitingState scope="canvas" narration={waitingNarration} activity={waitingActivity} />}
              {onDismissBlankPlaceholder && <button type="button" onClick={onDismissBlankPlaceholder}
                className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                data-studio-stage-placeholder-dismiss="true">Start on this blank canvas</button>}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center min-h-0 p-4">
            {studioShell ? (
              (lifecycle.mode === 'awaiting_owner' || lifecycle.mode === 'awaiting_viewer') ? <StudioWaitingState scope="canvas" message="Loading your selected deck…" />
                : waitingForDirector ? <div className="flex w-full min-h-0 flex-col gap-4">
                  {narrationActive && buildNarration && <StageRibbon narration={buildNarration} control={buildNarrationApi?.control} />}
                  <StudioWaitingState scope="canvas" narration={waitingNarration} activity={waitingActivity} />
                  {narrationActive && buildNarration && <StageProgressFooter narration={buildNarration} />}
                </div>
                : <StudioWelcomeStage studioIntroReplay={studioIntroReplay} />
            ) : buildNarrationEnabled ? (
              /* Canvas v2 R1: designed 16:9 placeholder for the no-URL case
                 (no dismiss — there is no blank deck to reveal). */
              <StagePlaceholder mode="standalone" />
            ) : (currentStatus || isGeneratingFinal || isGeneratingStrawman) ? (
              <SlideBuildingLoader
                className="w-full h-full"
                mode={isGeneratingFinal ? 'default' : 'strawman'}
              />
            ) : (
              <div className="text-center">
                <img src="/logo-icon.png" alt="" aria-hidden className="h-16 w-16 mx-auto mb-4 opacity-40" />
                <p className="text-lg text-slate-600 dark:text-slate-300">Your presentation will appear here</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">
                  Start by telling Director what presentation you'd like to create
                </p>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  )
}
