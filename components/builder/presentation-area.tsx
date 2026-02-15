"use client"

import React from "react"
import { PresentationViewer, TextBoxFormatting } from "@/components/presentation-viewer"
import { PresentationDownloadControls } from "@/components/presentation-download-controls"
import { SlideBuildingLoader } from "@/components/slide-building-loader"
import { Sparkles } from "lucide-react"
import { ElementType, ElementProperties } from '@/types/elements'
import type { BlankElementInfo } from '@/hooks/use-blank-elements'
import type { ContentContext } from '@/components/content-context-form'

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
  onVersionSwitch: (version: any) => void
  currentStage: number
  currentSlideIndex: number
  onSlideChange: (slideNum: number) => void
  currentStatus: any
  isGeneratingFinal: boolean
  isGeneratingStrawman: boolean
  // Layout Service API setter
  onApiReady: (apis: any) => void
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
  }
  // Generation panel handler (for toolbar)
  onOpenGenerationPanel?: (type: string) => void
  onEditModeChange?: (isEditing: boolean) => void
  // Bottom toolbar items (moved from header)
  connected: boolean
  connecting: boolean
  showContentContextPanel: boolean
  onToggleContentContextPanel: () => void
  hasGeneratedContent: boolean
  contentContext: ContentContext
}

export function PresentationArea({
  presentationUrl,
  presentationId,
  slideCount,
  slideStructure,
  strawmanPreviewUrl,
  finalPresentationUrl,
  activeVersion,
  onVersionSwitch,
  currentStage,
  currentSlideIndex,
  onSlideChange,
  currentStatus,
  isGeneratingFinal,
  isGeneratingStrawman,
  onApiReady,
  onTextBoxSelected,
  onTextBoxDeselected,
  onElementSelected,
  onElementDeselected,
  blankElements,
  generationPanel,
  onOpenGenerationPanel,
  onEditModeChange,
  connected,
  connecting,
  showContentContextPanel,
  onToggleContentContextPanel,
  hasGeneratedContent,
  contentContext,
}: PresentationAreaProps) {
  return (
    <div className="flex-1 flex flex-col bg-gray-100">
      {presentationUrl && !isGeneratingFinal ? (
        <PresentationViewer
          presentationUrl={presentationUrl}
          presentationId={presentationId}
          slideCount={slideCount}
          slideStructure={slideStructure}
          strawmanPreviewUrl={strawmanPreviewUrl}
          finalPresentationUrl={finalPresentationUrl}
          activeVersion={activeVersion as any}
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
          onOpenGenerationPanel={onOpenGenerationPanel}
          connected={connected}
          connecting={connecting}
          showContentContextPanel={showContentContextPanel}
          onToggleContentContextPanel={onToggleContentContextPanel}
          hasGeneratedContent={hasGeneratedContent}
          contentContext={contentContext}
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
          className="flex-1"
        />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          {(currentStatus || isGeneratingFinal || isGeneratingStrawman) ? (
            <SlideBuildingLoader
              statusText={
                isGeneratingFinal
                  ? "Generating your final presentation..."
                  : isGeneratingStrawman
                  ? "Building your strawman presentation..."
                  : currentStatus?.text
              }
              estimatedTime={currentStatus?.estimated_time ?? undefined}
              className="w-full px-8"
              mode={isGeneratingFinal ? 'default' : 'strawman'}
            />
          ) : (
            <div className="text-center">
              <Sparkles className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-lg text-gray-600">Your presentation will appear here</p>
              <p className="text-sm text-gray-400 mt-2">
                Start by telling Director what presentation you'd like to create
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
