"use client"

import React from "react"
import { PresentationViewer, TextBoxFormatting, type RefineElementRequest, type SlideComposeViewerApi } from "@/components/presentation-viewer"
import { PresentationDownloadControls } from "@/components/presentation-download-controls"
import { SlideBuildingLoader } from "@/components/slide-building-loader"
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
  generationPanel: {
    openPanelForElement: (componentType: any, elementId: string) => void
  }
): boolean {
  if (blankElements.isBlankElement(elementId)) {
    const info = blankElements.getElement(elementId)
    if (info) {
      if (info.status === 'generating') return true // no panel during generation
      generationPanel.openPanelForElement(info.componentType, elementId)
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
  onTextBoxSelected: (elementId: string, formatting: TextBoxFormatting | null) => void
  onTextBoxDeselected: () => void
  // Element selection
  onElementSelected: (elementId: string, elementType: ElementType, properties: ElementProperties) => void
  onElementDeselected: () => void
  // Blank elements
  blankElements: {
    isBlankElement: (id: string) => boolean
    getElement: (id: string) => BlankElementInfo | undefined
    updatePosition: (elementId: string, startCol: number, startRow: number, width: number, height: number) => void
  }
  generationPanel: {
    openPanelForElement: (componentType: any, elementId: string) => void
    isGenerating: boolean
  }
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
  selectedTemplateElementId?: string | null
  blueprintEditorV2Enabled?: boolean
  onTemplateSlideChange?: (slideIndex: number) => void
  onTemplateElementSelect?: (overrideKey: string | null) => void
  onTemplateBlueprintChange?: (blueprint: TemplateBlueprint) => void
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
  blankElements,
  generationPanel,
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
  selectedTemplateElementId = null,
  blueprintEditorV2Enabled = false,
  onTemplateSlideChange,
  onTemplateElementSelect,
  onTemplateBlueprintChange,
}: PresentationAreaProps) {
  return (
    <div className="flex-1 flex bg-gray-100 dark:bg-slate-800 min-w-0 min-h-0">
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
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
            showControls={true}
            downloadControls={
              <PresentationDownloadControls
                presentationUrl={presentationUrl}
                presentationId={presentationId}
                slideCount={slideCount}
                stage={currentStage}
              />
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
            onTextBoxSelected={(elementId, formatting) => {
              if (handleBlankElementClick(elementId, blankElements, generationPanel)) return
              onTextBoxSelected(elementId, formatting)
            }}
            onTextBoxDeselected={onTextBoxDeselected}
            onElementSelected={(elementId, elementType, properties) => {
              if (handleBlankElementClick(elementId, blankElements, generationPanel)) return
              onElementSelected(elementId, elementType, properties)
            }}
            onElementDeselected={onElementDeselected}
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
            templateSelectionLocked={templateSelectionLocked || generationPanel.isGenerating}
            templateModeOn={templateModeOn}
            onTemplateModeChange={onTemplateModeChange}
            templateModeAvailable={templateModeAvailable}
            composeJobs={composeJobs}
            onRefineSlide={onRefineSlide}
            templateSnapshot={templateSnapshot}
            templateSnapshotLoading={templateSnapshotLoading}
            templateCurrentSlideIndex={templateCurrentSlideIndex}
            selectedTemplateElementId={selectedTemplateElementId}
            blueprintEditorV2Enabled={blueprintEditorV2Enabled}
            onTemplateElementSelect={onTemplateElementSelect}
            onTemplateBlueprintChange={onTemplateBlueprintChange}
            toolbarOffset={toolbarOffset}
            isGenerating={isGeneratingFinal || isGeneratingStrawman}
            generatingMode={isGeneratingFinal ? 'default' : 'strawman'}
            className="flex-1"
          />
        ) : (
          <div className="flex-1 flex items-center justify-center min-h-0 p-4">
            {(currentStatus || isGeneratingFinal || isGeneratingStrawman) ? (
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
