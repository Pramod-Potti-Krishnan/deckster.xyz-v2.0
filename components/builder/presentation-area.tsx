"use client"

import React from "react"
import { PresentationViewer, TextBoxFormatting, type RefineElementRequest, type SlideComposeViewerApi } from "@/components/presentation-viewer"
import { PresentationDownloadControls } from "@/components/presentation-download-controls"
import { PublishControls } from "@/components/publish-dialog"
import { SlideBuildingLoader } from "@/components/slide-building-loader"
import { BuildCanvas, type BuildCanvasProps } from "@/components/build-narration/build-canvas"
import { StagePlaceholder } from "@/components/build-narration/stage-placeholder"
import { shouldShowBlankPlaceholder } from "@/lib/build-narration-heuristics"
import type { SlideComposeThumbnailJob } from "@/components/slide-thumbnail-strip"
// Branding ("powered by deckster") lives inside PresentationViewer's
// slide column so it tracks the slide's right edge, not the container.
import { ElementType, ElementProperties } from '@/types/elements'
import type { BlankElementInfo } from '@/hooks/use-blank-elements'
import type { TemplateBlueprint, TemplateSelection, TemplateSnapshot } from '@/hooks/use-templates'
import type { SlideRefineTarget } from '@/lib/slide-refinement'
import type { BuildThemeSelection } from '@/lib/theme-builder'
import type { ThemeSyncState } from '@/lib/theme-sync'

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
  thumbnailUrlsBySlide?: Record<number, string>
  selectedTemplateElementId?: string | null
  blueprintEditorV2Enabled?: boolean
  onTemplateSlideChange?: (slideIndex: number) => void
  onTemplateElementSelect?: (overrideKey: string | null) => void
  onTemplateBlueprintChange?: (blueprint: TemplateBlueprint) => void
  // Build Narration Canvas (NEXT_PUBLIC_BUILD_NARRATION). When active, the
  // canvas overlays the stage and the legacy SlideBuildingLoader mounts are
  // suppressed. Both undefined when the flag is off — zero behavior change.
  buildNarration?: BuildCanvasProps['narration'] | null
  buildNarrationApi?: Pick<BuildCanvasProps, 'onPin' | 'control'> | null
  // Canvas v2 R1: the narration flag itself (placeholder shows before any
  // build starts, when buildNarration is still inactive) + the per-session
  // dismissal of the blank-landing placeholder.
  buildNarrationEnabled?: boolean
  blankPlaceholderDismissed?: boolean
  onDismissBlankPlaceholder?: () => void
}

export function PresentationArea({
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
  thumbnailUrlsBySlide = {},
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
}: PresentationAreaProps) {
  const narrationActive = !!(buildNarration && buildNarration.active)
  // Canvas v2 R1: cover the blank landing deck with the designed placeholder.
  const showBlankPlaceholder = shouldShowBlankPlaceholder(
    buildNarrationEnabled,
    activeVersion,
    isBlankPresentation,
    blankPlaceholderDismissed,
  )
  const stageChrome = showBlankPlaceholder
    ? {
        placeholder: (
          <StagePlaceholder mode="overlay" onDismiss={onDismissBlankPlaceholder} />
        ),
      }
    : null
  // Port review F-4 (D11): while narration owns the stage and the strawman is
  // the active version, the viewer is pointed at the blank deck — its toolbar,
  // download/publish and edit surfaces must be inert, not merely covered by
  // the canvas. Flag-off (narration inactive) keeps today's behavior exactly.
  const hiddenStrawman = narrationActive && activeVersion === 'strawman'
  return (
    <div className="flex-1 flex bg-gray-100 dark:bg-slate-800 min-w-0 min-h-0">
      <div className={narrationActive ? "flex-1 flex flex-col min-w-0 min-h-0 relative" : "flex-1 flex flex-col min-w-0 min-h-0"}>
        {narrationActive && buildNarration && (
          <BuildCanvas
            narration={buildNarration}
            onPin={buildNarrationApi?.onPin ?? (() => {})}
            control={buildNarrationApi?.control}
          />
        )}
        {presentationUrl ? (
          <PresentationViewer
            presentationUrl={presentationUrl}
            presentationId={presentationId}
            slideCount={slideCount}
            slideStructure={slideStructure}
            strawmanPreviewUrl={strawmanPreviewUrl}
            finalPresentationUrl={finalPresentationUrl}
            activeVersion={activeVersion as any}
            isBlankPresentation={isBlankPresentation}
            onVersionSwitch={onVersionSwitch}
            showControls={!hiddenStrawman}
            downloadControls={
              hiddenStrawman ? undefined : (
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
            thumbnailUrlsBySlide={thumbnailUrlsBySlide}
            templateSnapshot={templateSnapshot}
            templateSnapshotLoading={templateSnapshotLoading}
            templateCurrentSlideIndex={templateCurrentSlideIndex}
            selectedTemplateElementId={selectedTemplateElementId}
            blueprintEditorV2Enabled={blueprintEditorV2Enabled}
            onTemplateElementSelect={onTemplateElementSelect}
            onTemplateBlueprintChange={onTemplateBlueprintChange}
            toolbarOffset={toolbarOffset}
            isGenerating={narrationActive ? hiddenStrawman : (isGeneratingFinal || isGeneratingStrawman)}
            generatingMode={isGeneratingFinal ? 'default' : 'strawman'}
            stageChrome={stageChrome}
            className="flex-1"
          />
        ) : (
          <div className="flex-1 flex items-center justify-center min-h-0 p-4">
            {narrationActive ? (
              /* BuildCanvas (above) owns the stage while narration is active. */
              <div className="w-full h-full" aria-hidden />
            ) : (currentStatus || isGeneratingFinal || isGeneratingStrawman) ? (
              <SlideBuildingLoader
                className="w-full h-full"
                mode={isGeneratingFinal ? 'default' : 'strawman'}
              />
            ) : buildNarrationEnabled ? (
              /* Canvas v2 R1: designed 16:9 placeholder for the no-URL case
                 (no dismiss — there is no blank deck to reveal). */
              <StagePlaceholder mode="standalone" />
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
