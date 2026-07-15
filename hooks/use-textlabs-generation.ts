"use client"

import { useCallback, useRef } from "react"
import { TextLabsFormData, TextLabsComponentType } from '@/types/textlabs'
import { sendMessage as sendTextLabsMessage, buildApiPayload, buildInsertionParams, generateInfographic, getDefaultSize } from '@/lib/textlabs-client'
import type { RefineContext } from '@/hooks/use-element-refinement'
import type { BlankElementInfo } from '@/hooks/use-blank-elements'
import { parseElementGenerationMetadata, parseGetElementGeometryResponse } from '@/lib/element-geometry'
import { normalizeSemanticComponentType } from '@/lib/element-semantic-type'
import { parseElementThemeAssignments } from '@/lib/element-theme-variants'

interface UseTextLabsGenerationParams {
  generationPanel: {
    blankElementId: string | null
    isOpen: boolean
    elementType: TextLabsComponentType | null
    isGenerating: boolean
    error: string | null
    mode: 'generate' | 'edit' | 'refine'
    refineContext: RefineContext | null
    refineWebResearch: boolean
    refineUploadedDocs: boolean
    setIsGenerating: (v: boolean) => void
    setError: (v: string | null) => void
    closePanel: () => void
    openPanel: (type: TextLabsComponentType) => void
    openPanelForElement: (type: TextLabsComponentType, elementId: string) => void
    changeElementType: (type: TextLabsComponentType) => void
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
  }
  textLabsSession: {
    ensureSession: (signal?: AbortSignal) => Promise<string>
  }
  layoutServiceApis: {
    sendElementCommand: (action: string, params: Record<string, any>) => Promise<any>
  } | null
  presentationId?: string | null
  currentSlideIndex: number
  toast: (opts: { title: string; description: string }) => void
}

function applyPositionToFormData(formData: TextLabsFormData, positionConfig: NonNullable<TextLabsFormData['positionConfig']>) {
  formData.positionConfig = positionConfig
  const fd = formData as any
  if (fd.imageConfig) {
    fd.imageConfig.start_col = positionConfig.start_col
    fd.imageConfig.start_row = positionConfig.start_row
    fd.imageConfig.width = positionConfig.position_width
    fd.imageConfig.height = positionConfig.position_height
    fd.imageConfig.position_width = positionConfig.position_width
    fd.imageConfig.position_height = positionConfig.position_height
  }
  if (fd.infographicConfig) {
    fd.infographicConfig.start_col = positionConfig.start_col
    fd.infographicConfig.start_row = positionConfig.start_row
    fd.infographicConfig.width = positionConfig.position_width
    fd.infographicConfig.height = positionConfig.position_height
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

// Spinner HTML for generating state
function buildSpinnerHtml(elementId: string, componentType: string): string {
  const label = componentType.replace(/_/g, ' ')
  return `<div data-blank-element="${elementId}" data-element-type="${componentType}" style="display:flex;align-items:center;justify-content:center;height:100%;border:2px solid #a5b4fc;border-radius:8px;background:rgba(238,241,247,0.8);"><div style="text-align:center;color:#6366f1;"><div style="width:24px;height:24px;border:3px solid #c7d2fe;border-top-color:#6366f1;border-radius:50%;margin:0 auto;animation:spin 1s linear infinite;"></div><div style="font-size:12px;font-weight:500;margin-top:8px;">Generating ${label}...</div></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style></div>`
}

export function useTextLabsGeneration({
  generationPanel,
  blankElements,
  textLabsSession,
  layoutServiceApis,
  presentationId,
  currentSlideIndex,
  toast,
}: UseTextLabsGenerationParams) {
  const generateInFlightRef = useRef(false)

  const handleGenerate = useCallback(async (formData: TextLabsFormData) => {
    if (generateInFlightRef.current) return
    generateInFlightRef.current = true

    // Lock the submit path before the async geometry lookup so a double-click
    // cannot start two concurrent placeholder swaps.
    generationPanel.setIsGenerating(true)
    generationPanel.setError(null)
    const refineContext = generationPanel.mode === 'refine' ? generationPanel.refineContext : null
    let refineOverlayActive = false
    let refineElementDeleted = false

    // A blank placeholder's live DOM geometry is authoritative. Resolve it before
    // mutating canvas state or starting Text Labs so a failed query leaves
    // the user's placeholder untouched instead of falling back to stale defaults.
    const blankId = generationPanel.blankElementId
    const trackedBlankInfo = blankId ? blankElements.getElement(blankId) : undefined
    let blankInfo = trackedBlankInfo

    if (blankId) {
      if (!trackedBlankInfo) {
        generationPanel.setIsGenerating(false)
        generationPanel.setError('This placeholder is no longer available. Add the element again and retry.')
        generateInFlightRef.current = false
        return
      }
      if (!layoutServiceApis?.sendElementCommand) {
        generationPanel.setIsGenerating(false)
        generationPanel.setError('The presentation is still loading. Wait a moment and try again.')
        generateInFlightRef.current = false
        return
      }
      try {
        const geometryResponse = await layoutServiceApis.sendElementCommand('getElementGeometry', {
          elementId: blankId,
        })
        const geometry = parseGetElementGeometryResponse(geometryResponse, blankId)
        const metadata = parseElementGenerationMetadata(geometryResponse)
        blankInfo = {
          ...trackedBlankInfo,
          ...geometry,
          themeVariantId: metadata.themeVariantId ?? trackedBlankInfo.themeVariantId ?? null,
          themeBindings: metadata.themeBindings ?? trackedBlankInfo.themeBindings ?? null,
        }
        blankElements.updatePosition(
          blankId,
          geometry.startCol,
          geometry.startRow,
          geometry.width,
          geometry.height,
        )
        blankElements.updateGenerationMetadata(blankId, metadata)
      } catch (error) {
        console.error('[TextLabs] Failed to read live blank geometry:', error)
        generationPanel.setIsGenerating(false)
        generationPanel.setError(
          "Couldn't read the element's current size and position. The placeholder was left unchanged. Please try again.",
        )
        generateInFlightRef.current = false
        return
      }
    }

    formData.presentationId = formData.presentationId ?? presentationId ?? null

    if (refineContext) {
      if (!layoutServiceApis?.sendElementCommand) {
        generationPanel.setIsGenerating(false)
        generationPanel.setError('The presentation is still loading. Wait a moment and try again.')
        generateInFlightRef.current = false
        return
      }

      try {
        const geometryResponse = await layoutServiceApis.sendElementCommand('getElementGeometry', {
          elementId: refineContext.elementId,
        })
        const geometry = parseGetElementGeometryResponse(geometryResponse, refineContext.elementId)
        const metadata = parseElementGenerationMetadata(geometryResponse)
        const liveComponentType = normalizeSemanticComponentType(metadata.componentType)
          ?? refineContext.elementType
        const liveGridPosition = {
          start_col: geometry.startCol,
          start_row: geometry.startRow,
          position_width: geometry.width,
          position_height: geometry.height,
          auto_position: false,
        }

        applyPositionToFormData(formData, liveGridPosition)
        formData.existingElement = {
          ...refineContext.existingElement,
          component_type: liveComponentType,
          normalized_component_type: liveComponentType,
          grid_position: liveGridPosition,
          theme_variant_id: metadata.themeVariantId ?? refineContext.themeVariantId,
          theme_bindings: metadata.themeBindings ?? refineContext.themeBindings,
        }
        formData.themeVariantId = metadata.themeVariantId ?? refineContext.themeVariantId
        formData.themeBindings = metadata.themeBindings ?? refineContext.themeBindings
      } catch (error) {
        console.error('[TextLabs] Failed to read live refine geometry:', error)
        generationPanel.setIsGenerating(false)
        generationPanel.setError(
          "Couldn't read this element's current size and position. The original was left unchanged. Please try again.",
        )
        generateInFlightRef.current = false
        return
      }

      formData.refine = true
      formData.replaceElementId = refineContext.elementId
      formData.existingElement = formData.existingElement ?? refineContext.existingElement
      formData.slideContext = refineContext.slideContext
      formData.deckContext = refineContext.deckContext
      formData.research = {
        web: generationPanel.refineWebResearch,
        uploaded_docs: generationPanel.refineUploadedDocs,
        store_name: refineContext.research.store_name,
        session_id: refineContext.research.session_id,
      }
      formData.count = 1

      try {
        await layoutServiceApis.sendElementCommand('setElementGenerationState', {
          elementId: refineContext.elementId,
          generating: true,
          label: 'Regenerating…',
        })
        refineOverlayActive = true
      } catch (error) {
        // Layout deployments before the transient overlay command remain usable;
        // geometry and safe replacement are still enforced.
        console.warn('[TextLabs] Regeneration overlay is unavailable:', error)
      }
    }

    // Track current element ID locally — React state updates are async,
    // so we can't re-read generationPanel.blankElementId after spinner swap
    let currentBlankId = blankId
    let currentBlankInfo = blankInfo

    // If blank element exists, override position from canvas and force count=1
    if (blankInfo) {
      formData.count = 1
      formData.themeVariantId = blankInfo.themeVariantId ?? null
      formData.themeBindings = blankInfo.themeBindings ?? null
      applyPositionToFormData(formData, {
        start_col: blankInfo.startCol,
        start_row: blankInfo.startRow,
        position_width: blankInfo.width,
        position_height: blankInfo.height,
        auto_position: false,
      })
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
          slideIndex: currentSlideIndex,
          seed: [
            presentationId || 'unsaved',
            currentSlideIndex,
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
        generationPanel.setIsGenerating(false)
        generateInFlightRef.current = false
        return
      }
    }

    // Set status to generating and update canvas to spinner
    if (blankId && blankInfo && layoutServiceApis?.sendElementCommand) {
      blankElements.setStatus(blankId, 'generating')
      const spinnerHtml = buildSpinnerHtml(blankId, formData.componentType)
      const gridRow = `${blankInfo.startRow}/${blankInfo.startRow + blankInfo.height}`
      const gridColumn = `${blankInfo.startCol}/${blankInfo.startCol + blankInfo.width}`
      try {
        await layoutServiceApis.sendElementCommand('deleteElement', { elementId: blankId })
        const reinsertResponse = await layoutServiceApis.sendElementCommand('insertTextBox', {
          elementId: blankId,
          slideIndex: blankInfo.slideIndex,
          content: spinnerHtml,
          gridRow,
          gridColumn,
          positionWidth: blankInfo.width,
          positionHeight: blankInfo.height,
          zIndex: 10,
          draggable: false,
          resizable: false,
          skipAutoSize: true,
          componentType: normalizeSemanticComponentType(formData.componentType) ?? blankInfo.componentType,
          themeVariantId: blankInfo.themeVariantId,
          themeBindings: blankInfo.themeBindings,
        })
        const newId = reinsertResponse?.elementId
        if (newId && newId !== blankId) {
          blankElements.removeElement(blankId)
          blankElements.addElement({ ...blankInfo, elementId: newId, status: 'generating' })
          generationPanel.openPanelForElement(blankInfo.componentType, newId)
          currentBlankId = newId
          currentBlankInfo = { ...blankInfo, elementId: newId }
        }
      } catch (err) {
        console.warn('[TextLabs] Failed to update blank to spinner:', err)
      }
    }

    // 30-second timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)
    const insertedElementIds: string[] = []

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
            useDeckTheme: formData.useDeckTheme,
            themeOverrides: formData.themeOverrides as Record<string, unknown> | null | undefined,
            themeVariantId: formData.themeVariantId,
            themeBindings: formData.themeBindings,
            refine: formData.refine,
            existingElement: formData.existingElement,
            slideContext: formData.slideContext,
            deckContext: formData.deckContext,
            research: formData.research as Record<string, unknown> | null | undefined,
          },
          controller.signal,
        )
      } else {
        const { message, options } = buildApiPayload(sessionId, formData)
        response = await sendTextLabsMessage(sessionId, message, options, controller.signal)
      }

      if (response.error) {
        throw new Error(response.error)
      }

      const elements = response.elements || (response.element ? [response.element] : [])

      if (elements.length === 0) {
        throw new Error('No elements returned from API')
      }

      // Delete blank placeholder before inserting generated content
      if (currentBlankId && currentBlankInfo && layoutServiceApis?.sendElementCommand) {
        try {
          await layoutServiceApis.sendElementCommand('deleteElement', { elementId: currentBlankId })
        } catch (err) {
          console.warn('[TextLabs] Failed to delete blank placeholder:', err)
        }
        blankElements.removeElement(currentBlankId)
      }

      // Insert each element into the canvas
      const effectiveSlideIndex = currentBlankInfo?.slideIndex ?? refineContext?.slideIndex ?? currentSlideIndex
      const formElements = 'elements' in formData ? formData.elements : undefined
      const authoritativeGridPosition = currentBlankInfo ? {
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
        const fallbackGridPosition = formElements?.[index]?.grid_position
        const existingThemeVariantId = refineContext
          ? (formData.existingElement?.theme_variant_id as string | null | undefined)
          : null
        const existingThemeBindings = refineContext
          ? (formData.existingElement?.theme_bindings as Record<string, string> | null | undefined)
          : null
        let elementWithPosition: Parameters<typeof buildInsertionParams>[1] = {
          ...element,
          theme_variant_id: element.theme_variant_id ?? existingThemeVariantId,
          theme_bindings: element.theme_bindings ?? existingThemeBindings,
        }
        if (authoritativeGridPosition) {
          elementWithPosition = { ...elementWithPosition, grid_position: authoritativeGridPosition }
        } else if (fallbackGridPosition && !(element as any).grid_position) {
          elementWithPosition = { ...elementWithPosition, grid_position: fallbackGridPosition }
        }
        const insertionComponentType = refineContext?.elementType ?? element.component_type
        const { method, params } = buildInsertionParams(
          insertionComponentType,
          elementWithPosition,
          formData.positionConfig,
          formData.paddingConfig,
          formData.z_index,
          effectiveSlideIndex
        )

        const command = method === 'insertElement' ? 'insertTextBox' : method
        const insertResponse = await layoutServiceApis?.sendElementCommand(command, params as Record<string, any>)
        const insertedElementId = typeof insertResponse?.elementId === 'string'
          ? insertResponse.elementId
          : typeof params.elementId === 'string'
            ? params.elementId
            : null
        if (insertedElementId) insertedElementIds.push(insertedElementId)
      }

      if (refineContext && layoutServiceApis?.sendElementCommand) {
        try {
          await layoutServiceApis.sendElementCommand('deleteElement', { elementId: refineContext.elementId })
          refineElementDeleted = true
        } catch (deleteError) {
          const rollbackResults = await Promise.allSettled(
            insertedElementIds.map(elementId => layoutServiceApis.sendElementCommand('deleteElement', { elementId })),
          )
          const rollbackFailed = rollbackResults.some(result => result.status === 'rejected')
          insertedElementIds.length = 0
          throw new Error(
            rollbackFailed
              ? 'The original could not be replaced and the generated copy could not be fully rolled back. Reload the slide before trying again.'
              : 'The original could not be replaced. The generated copy was removed and your original was left unchanged.',
            { cause: deleteError },
          )
        }
      }

      generationPanel.closePanel()
      toast({
        title: refineContext ? 'Element refined' : 'Element generated',
        description: refineContext
          ? `${formData.componentType.replace(/_/g, ' ')} updated on slide`
          : `${formData.componentType.replace(/_/g, ' ')} added to slide`,
      })
      console.log(`[TextLabs] Generated ${elements.length} ${formData.componentType} element(s)`)
    } catch (err) {
      let errorMessage = 'Generation failed'
      if (err instanceof DOMException && err.name === 'AbortError') {
        errorMessage = 'Generation timed out after 30 seconds. Try again or simplify your prompt.'
      } else if (err instanceof TypeError && err.message.includes('fetch')) {
        errorMessage = 'Network error. Check your connection and try again.'
      } else if (err instanceof Error) {
        errorMessage = err.message
      }
      generationPanel.setError(errorMessage)
      console.error('[TextLabs] Generation error:', err)

      if (refineContext && !refineElementDeleted && insertedElementIds.length > 0 && layoutServiceApis?.sendElementCommand) {
        await Promise.allSettled(
          insertedElementIds.map(elementId => layoutServiceApis.sendElementCommand('deleteElement', { elementId })),
        )
      }

      // Restore placeholder on failure
      if (currentBlankId && currentBlankInfo && layoutServiceApis?.sendElementCommand) {
        blankElements.setStatus(currentBlankId, 'blank')
        const placeholderHtml = buildPlaceholderHtml(currentBlankId, formData.componentType)
        const gridRow = `${currentBlankInfo.startRow}/${currentBlankInfo.startRow + currentBlankInfo.height}`
        const gridColumn = `${currentBlankInfo.startCol}/${currentBlankInfo.startCol + currentBlankInfo.width}`
        try {
          await layoutServiceApis.sendElementCommand('deleteElement', { elementId: currentBlankId })
          const restoreResponse = await layoutServiceApis.sendElementCommand('insertTextBox', {
            elementId: currentBlankId,
            slideIndex: currentBlankInfo.slideIndex,
            content: placeholderHtml,
            gridRow,
            gridColumn,
            positionWidth: currentBlankInfo.width,
            positionHeight: currentBlankInfo.height,
            zIndex: 10,
            draggable: true,
            resizable: true,
            skipAutoSize: true,
            componentType: currentBlankInfo.componentType,
            themeVariantId: currentBlankInfo.themeVariantId,
            themeBindings: currentBlankInfo.themeBindings,
          })
          const newId = restoreResponse?.elementId
          if (newId && newId !== currentBlankId) {
            blankElements.removeElement(currentBlankId)
            blankElements.addElement({ ...currentBlankInfo, elementId: newId, status: 'blank' })
            generationPanel.openPanelForElement(currentBlankInfo.componentType, newId)
          }
        } catch (restoreErr) {
          console.warn('[TextLabs] Failed to restore placeholder after error:', restoreErr)
        }
      }
    } finally {
      clearTimeout(timeoutId)
      if (refineContext && refineOverlayActive && !refineElementDeleted && layoutServiceApis?.sendElementCommand) {
        try {
          await layoutServiceApis.sendElementCommand('setElementGenerationState', {
            elementId: refineContext.elementId,
            generating: false,
          })
        } catch (error) {
          console.warn('[TextLabs] Failed to clear regeneration overlay:', error)
        }
      }
      generationPanel.setIsGenerating(false)
      generateInFlightRef.current = false
    }
  }, [generationPanel, textLabsSession, layoutServiceApis, presentationId, toast, currentSlideIndex, blankElements])

  const handleOpenPanel = useCallback(async (type: string) => {
    const componentType = type as TextLabsComponentType
    const defaults = getDefaultSize(componentType)
    const startCol = 2
    const startRow = 4

    if (!layoutServiceApis?.sendElementCommand) {
      generationPanel.openPanel(componentType)
      return
    }

    try {
      const tempId = `blank_${Date.now()}`
      const placeholderHtml = buildPlaceholderHtml(tempId, componentType)

      const gridRow = `${startRow}/${startRow + defaults.height}`
      const gridColumn = `${startCol}/${startCol + defaults.width}`

      const response = await layoutServiceApis.sendElementCommand('insertTextBox', {
        elementId: tempId,
        slideIndex: currentSlideIndex,
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
      })

      const layoutElementId = response?.elementId || tempId
      const metadata = parseElementGenerationMetadata(response)

      blankElements.addElement({
        elementId: layoutElementId,
        componentType,
        slideIndex: currentSlideIndex,
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
      console.warn('[TextLabs] Failed to insert blank placeholder, falling back to direct panel:', err)
      generationPanel.openPanel(componentType)
    }
  }, [generationPanel, layoutServiceApis, blankElements, currentSlideIndex])

  return { handleGenerate, handleOpenPanel }
}
