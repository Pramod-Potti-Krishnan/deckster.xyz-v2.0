"use client"

import { useCallback } from "react"
import { TextLabsFormData, TextLabsComponentType } from '@/types/textlabs'
import { sendMessage as sendTextLabsMessage, buildApiPayload, buildInsertionParams, generateInfographic, getDefaultSize } from '@/lib/textlabs-client'

interface UseTextLabsGenerationParams {
  generationPanel: {
    blankElementId: string | null
    isOpen: boolean
    elementType: TextLabsComponentType | null
    isGenerating: boolean
    error: string | null
    setIsGenerating: (v: boolean) => void
    setError: (v: string | null) => void
    closePanel: () => void
    openPanel: (type: TextLabsComponentType) => void
    openPanelForElement: (type: TextLabsComponentType, elementId: string) => void
    changeElementType: (type: TextLabsComponentType) => void
  }
  blankElements: {
    getElement: (id: string) => any
    setStatus: (id: string, status: 'blank' | 'generating') => void
    removeElement: (id: string) => void
    addElement: (info: any) => void
  }
  textLabsSession: {
    ensureSession: () => Promise<string>
  }
  layoutServiceApis: {
    sendElementCommand: (action: string, params: Record<string, any>) => Promise<any>
  } | null
  currentSlideIndex: number
  toast: (opts: { title: string; description: string }) => void
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
  currentSlideIndex,
  toast,
}: UseTextLabsGenerationParams) {
  const handleGenerate = useCallback(async (formData: TextLabsFormData) => {
    generationPanel.setIsGenerating(true)
    generationPanel.setError(null)

    // Check if we're generating for a blank element on canvas
    const blankId = generationPanel.blankElementId
    const blankInfo = blankId ? blankElements.getElement(blankId) : null

    // Track current element ID locally — React state updates are async,
    // so we can't re-read generationPanel.blankElementId after spinner swap
    let currentBlankId = blankId
    let currentBlankInfo = blankInfo

    // If blank element exists, override position from canvas and force count=1
    if (blankInfo) {
      formData.count = 1
      formData.positionConfig = {
        start_col: blankInfo.startCol,
        start_row: blankInfo.startRow,
        position_width: blankInfo.width,
        position_height: blankInfo.height,
        auto_position: false,
      }
      const fd = formData as any
      if (fd.imageConfig) {
        fd.imageConfig.start_col = blankInfo.startCol
        fd.imageConfig.start_row = blankInfo.startRow
        fd.imageConfig.width = blankInfo.width
        fd.imageConfig.height = blankInfo.height
        fd.imageConfig.position_width = blankInfo.width
        fd.imageConfig.position_height = blankInfo.height
      }
      if (fd.infographicConfig) {
        fd.infographicConfig.start_col = blankInfo.startCol
        fd.infographicConfig.start_row = blankInfo.startRow
        fd.infographicConfig.width = blankInfo.width
        fd.infographicConfig.height = blankInfo.height
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

    try {
      const sessionId = await textLabsSession.ensureSession()

      let response
      if (formData.componentType === 'INFOGRAPHIC' && formData.referenceImage) {
        response = await generateInfographic(
          sessionId,
          formData.prompt,
          formData.referenceImage,
          formData.infographicConfig as Record<string, unknown>
        )
      } else {
        const { message, options } = buildApiPayload(sessionId, formData)
        response = await sendTextLabsMessage(sessionId, message, options)
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
      const effectiveSlideIndex = currentBlankInfo?.slideIndex ?? currentSlideIndex
      for (const element of elements) {
        const { method, params } = buildInsertionParams(
          element.component_type,
          element,
          formData.positionConfig,
          formData.paddingConfig,
          formData.z_index,
          effectiveSlideIndex
        )

        const command = method === 'insertElement' ? 'insertTextBox' : method
        await layoutServiceApis?.sendElementCommand(command, params as Record<string, any>)
      }

      generationPanel.closePanel()
      toast({
        title: 'Element generated',
        description: `${formData.componentType.replace(/_/g, ' ')} added to slide`,
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
      generationPanel.setIsGenerating(false)
    }
  }, [generationPanel, textLabsSession, layoutServiceApis, toast, currentSlideIndex, blankElements])

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
      })

      const layoutElementId = response?.elementId || tempId

      blankElements.addElement({
        elementId: layoutElementId,
        componentType,
        slideIndex: currentSlideIndex,
        startCol,
        startRow,
        width: defaults.width,
        height: defaults.height,
        status: 'blank',
      })

      generationPanel.openPanelForElement(componentType, layoutElementId)
    } catch (err) {
      console.warn('[TextLabs] Failed to insert blank placeholder, falling back to direct panel:', err)
      generationPanel.openPanel(componentType)
    }
  }, [generationPanel, layoutServiceApis, blankElements, currentSlideIndex])

  return { handleGenerate, handleOpenPanel }
}
