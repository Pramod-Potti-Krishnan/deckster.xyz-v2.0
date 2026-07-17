"use client"

import { useCallback, useRef } from "react"
import { TextLabsFormData, TextLabsComponentType } from '@/types/textlabs'
import { sendMessage as sendTextLabsMessage, buildApiPayload, buildInsertionParams, generateInfographic, getDefaultSize } from '@/lib/textlabs-client'
import type { RefineContext } from '@/hooks/use-element-refinement'
import type { BlankElementInfo } from '@/hooks/use-blank-elements'
import {
  ElementGenerationPreflightError,
  parseElementGenerationMetadata,
  readElementGenerationSnapshot,
  remapElementGridPositions,
} from '@/lib/element-geometry'
import { normalizeSemanticComponentType } from '@/lib/element-semantic-type'
import { componentSupportsThemeVariants, parseElementThemeAssignments } from '@/lib/element-theme-variants'
import { resolveElementThemeMetadata } from '@/lib/textlabs-theme-metadata'
import { buildElementGenerationContext, parseSlideGenerationContext } from '@/lib/element-generation-context'
import type { ElementResearchCapabilities, ElementResearchMode } from '@/types/textlabs'
import {
  buildElementResearchPolicy,
  hasSelectedElementResearchSource,
} from '@/lib/element-research-policy'
import type { ThemeSyncState } from '@/lib/theme-sync'
import { restoreBlankElementAfterFailure } from '@/lib/blank-element-recovery'
import { parseThemeVariantSource, responseStyleOwner } from '@/lib/element-provenance'

const THEME_CHANGED_DURING_GENERATION =
  'The deck theme changed while this element was being generated. Wait for Applied, then generate again.'

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
    closePanel: () => void
    openPanel: (type: TextLabsComponentType) => void
    openPanelForElement: (type: TextLabsComponentType, elementId: string) => void
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
  deckContext?: Record<string, unknown> | null
  researchSessionId?: string | null
  researchStoreName?: string | null
  researchUserId?: string | null
  researchCapabilities: ElementResearchCapabilities
  getThemeSyncSnapshot: () => ThemeSyncState
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
  deckContext,
  researchSessionId,
  researchStoreName,
  researchUserId,
  researchCapabilities,
  getThemeSyncSnapshot,
  toast,
}: UseTextLabsGenerationParams) {
  const activeGenerationKeysRef = useRef<Set<string>>(new Set())

  const handleGenerate = useCallback(async (formData: TextLabsFormData) => {
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
    let refineOverlayActive = false
    let refineElementDeleted = false

    // The displayed presentation owned by the hook is authoritative. Form
    // callbacks can remain mounted across deck transitions and must not revive
    // a captured presentation ID from the previous viewer.
    formData.presentationId = presentationId ?? null
    if (formData.useDeckTheme === true && !formData.presentationId) {
      generationPanel.setIsGenerating(false)
      generationPanel.setError('The active presentation is unavailable, so its deck theme cannot be resolved.')
      activeGenerationKeysRef.current.delete(generationKey)
      return
    }
    const expectedThemeSync = formData.useDeckTheme === true
      ? getThemeSyncSnapshot()
      : null
    if (
      formData.useDeckTheme === true &&
      (
        expectedThemeSync?.status !== 'applied' ||
        !expectedThemeSync.requestId ||
        expectedThemeSync.presentationId !== formData.presentationId
      )
    ) {
      generationPanel.setIsGenerating(false)
      generationPanel.setError('The selected deck theme is not Applied to this presentation yet.')
      activeGenerationKeysRef.current.delete(generationKey)
      return
    }
    const themeIsStillAuthoritative = () => {
      if (!expectedThemeSync) return true
      const current = getThemeSyncSnapshot()
      return current.status === 'applied'
        && current.requestId === expectedThemeSync.requestId
        && current.presentationId === expectedThemeSync.presentationId
    }
    const assertThemeIsStillAuthoritative = () => {
      if (!themeIsStillAuthoritative()) throw new Error(THEME_CHANGED_DURING_GENERATION)
    }

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
        activeGenerationKeysRef.current.delete(generationKey)
        return
      }
      if (!layoutServiceApis?.sendElementCommand) {
        generationPanel.setIsGenerating(false)
        generationPanel.setError('The presentation is still loading. Wait a moment and try again.')
        activeGenerationKeysRef.current.delete(generationKey)
        return
      }
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
        generationPanel.setIsGenerating(false)
        generationPanel.setError(
          error instanceof ElementGenerationPreflightError && error.stage === 'theme_metadata'
            ? "Couldn't apply the deck's current theme treatment to this element. The placeholder was left unchanged. Please try again."
            : "Couldn't read the element's current size and position. The placeholder was left unchanged. Please try again.",
        )
        activeGenerationKeysRef.current.delete(generationKey)
        return
      }
    }

    if (refineContext) {
      if (!layoutServiceApis?.sendElementCommand) {
        generationPanel.setIsGenerating(false)
        generationPanel.setError('The presentation is still loading. Wait a moment and try again.')
        activeGenerationKeysRef.current.delete(generationKey)
        return
      }

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

        applyPositionToFormData(formData, liveGridPosition)
        const themeVariantId = formData.useDeckTheme === true
          ? snapshot.themeVariantId ?? refineContext.themeVariantId
          : null
        const themeBindings = formData.useDeckTheme === true
          ? snapshot.themeBindings ?? refineContext.themeBindings
          : null
        formData.existingElement = {
          ...refineContext.existingElement,
          component_type: liveComponentType,
          normalized_component_type: liveComponentType,
          grid_position: liveGridPosition,
          theme_variant_id: themeVariantId,
          theme_bindings: themeBindings,
          style_owner: snapshot.styleOwner ?? refineContext.styleOwner,
          theme_variant_source: snapshot.themeVariantSource ?? refineContext.themeVariantSource,
        }
        formData.themeVariantId = themeVariantId
        formData.themeBindings = themeBindings
      } catch (error) {
        console.error('[TextLabs] Element regeneration preflight failed:', error)
        generationPanel.setIsGenerating(false)
        generationPanel.setError(
          error instanceof ElementGenerationPreflightError && error.stage === 'theme_metadata'
            ? "Couldn't apply the deck's current theme treatment to this element. The original was left unchanged. Please try again."
            : "Couldn't read this element's current size and position. The original was left unchanged. Please try again.",
        )
        activeGenerationKeysRef.current.delete(generationKey)
        return
      }

      formData.refine = true
      formData.replaceElementId = refineContext.elementId
      formData.existingElement = formData.existingElement ?? refineContext.existingElement
      formData.count = 1

    }

    // Track current element ID locally — React state updates are async,
    // so we can't re-read generationPanel.blankElementId after spinner swap
    let currentBlankId = blankId
    let currentBlankInfo = blankInfo
    let blankTrackingWasRemoved = false

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
          generationPanel.setIsGenerating(false)
          generationPanel.setError('The requested multi-element layout is incomplete. The placeholder was left unchanged.')
          activeGenerationKeysRef.current.delete(generationKey)
          return
        }
        formData.elements = remapElementGridPositions(
          formElements,
          formData.positionConfig,
          livePosition,
        )
      }
      formData.themeVariantId = formData.useDeckTheme === true
        ? blankInfo.themeVariantId ?? null
        : null
      formData.themeBindings = formData.useDeckTheme === true
        ? blankInfo.themeBindings ?? null
        : null
      applyPositionToFormData(formData, {
        ...livePosition,
        auto_position: false,
      })
    }

    const generationSlideIndex = blankInfo?.slideIndex ?? refineContext?.slideIndex ?? currentSlideIndex
    formData.slideIndex = generationSlideIndex

    const effectiveResearchSessionId = researchSessionId
      ?? refineContext?.research.session_id
      ?? null
    const effectiveResearchStoreName = researchStoreName
      ?? refineContext?.research.store_name
      ?? null
    const researchPolicy = buildElementResearchPolicy({
      mode: generationPanel.researchMode,
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
    if (generationPanel.researchMode === 'on' && !hasSelectedElementResearchSource(researchPolicy)) {
      generationPanel.setIsGenerating(false)
      generationPanel.setError(
        'Research is on, but no available source is selected. Enable Web Search or configure Uploaded Documents or Knowledge Graph.',
      )
      activeGenerationKeysRef.current.delete(generationKey)
      return
    }
    formData.research = researchPolicy

    if (!layoutServiceApis?.sendElementCommand) {
      generationPanel.setIsGenerating(false)
      generationPanel.setError('The presentation viewer is unavailable, so live slide context could not be read.')
      activeGenerationKeysRef.current.delete(generationKey)
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
            presentationId || 'unsaved',
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
        generationPanel.setIsGenerating(false)
        activeGenerationKeysRef.current.delete(generationKey)
        return
      }
    }

    if (!themeIsStillAuthoritative()) {
      generationPanel.setError(THEME_CHANGED_DURING_GENERATION)
      generationPanel.setIsGenerating(false)
      activeGenerationKeysRef.current.delete(generationKey)
      return
    }

    // Only mutate the live refine UI after every fallible preflight has passed.
    // From this point onward, the generation try/finally always clears it.
    if (refineContext && layoutServiceApis?.sendElementCommand) {
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
          themeVariantSource: 'element_generation',
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

    generationPanel.closePanel()
    generationPanel.setIsGenerating(false)

    // Grounded generation may include one bounded Researcher round-trip.
    const controller = new AbortController()
    const timeoutId = setTimeout(
      () => controller.abort(),
      generationPanel.researchMode === 'off' ? 30_000 : 90_000,
    )
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
            research: formData.research,
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
      assertThemeIsStillAuthoritative()

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
        blankTrackingWasRemoved = true
      }

      // Insert each element into the canvas
      const effectiveSlideIndex = generationSlideIndex
      const formElements = 'elements' in formData ? formData.elements : undefined
      const authoritativeGridPosition = currentBlankInfo && formData.count <= 1 ? {
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
        assertThemeIsStillAuthoritative()
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
        let elementWithPosition: Parameters<typeof buildInsertionParams>[1] = {
          ...element,
          semantic_role: formData.componentType === 'TEXT_BOX' && formData.slotKind === 'accessory'
            ? null
            : element.semantic_role ?? (formData.componentType === 'TEXT_BOX' ? formData.semanticRole : null),
          slot_name: element.slot_name ?? (formData.componentType === 'TEXT_BOX' ? formData.slotName : null),
          slot_kind: element.slot_kind ?? (formData.componentType === 'TEXT_BOX' ? formData.slotKind : null),
          accessory_type: element.accessory_type ?? (formData.componentType === 'TEXT_BOX' ? formData.accessoryType : null),
          citations_used: element.citations_used ?? response.citations_used ?? null,
          resolved_geometry: element.resolved_geometry ?? response.resolved_geometry ?? null,
          platinum_profile: element.platinum_profile ?? response.platinum_profile ?? null,
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
        const insertionComponentType = refineContext?.elementType ?? element.component_type
        const { method, params } = buildInsertionParams(
          insertionComponentType,
          elementWithPosition,
          formData.positionConfig,
          formData.paddingConfig,
          formData.z_index,
          effectiveSlideIndex
        )

        const citationsUsed = Array.isArray(params.citationsUsed) ? params.citationsUsed : []
        const usesSemanticUpsert = insertionComponentType === 'TEXT_BOX' && (
          Boolean(params.slotName) ||
          params.semanticRole !== 'BODY_TEXT' ||
          citationsUsed.length > 0 ||
          Boolean(refineContext?.slotName)
        )
        const insertResponse = usesSemanticUpsert
          ? await layoutServiceApis?.sendElementCommand('upsertSemanticElement', {
              elementId: params.elementId,
              replacesElementId: refineContext?.elementId,
              slideIndex: effectiveSlideIndex,
              content: params.content,
              semanticRole: params.semanticRole,
              slotName: params.slotName,
              slotKind: params.slotKind,
              accessoryType: params.accessoryType,
              geometry: params.slotKind === 'body' ? {
                gridRow: params.gridRow,
                gridColumn: params.gridColumn,
              } : undefined,
              citationsUsed,
              metadata: {
                componentType: params.componentType,
                researchProvenance: params.researchProvenance,
                styleOwner: params.styleOwner,
                themeVariantId: params.themeVariantId,
                themeBindings: params.themeBindings,
                resolvedGeometry: params.resolvedGeometry,
                platinumProfile: params.platinumProfile,
              },
            })
          : await layoutServiceApis?.sendElementCommand(
              method === 'insertElement' ? 'insertTextBox' : method,
              params as Record<string, any>,
            )
        if (usesSemanticUpsert && refineContext) refineElementDeleted = true
        const insertedElementId = typeof insertResponse?.elementId === 'string'
          ? insertResponse.elementId
          : typeof params.elementId === 'string'
            ? params.elementId
            : null
        if (insertedElementId) insertedElementIds.push(insertedElementId)
      }
      assertThemeIsStillAuthoritative()

      if (refineContext && !refineElementDeleted && layoutServiceApis?.sendElementCommand) {
        try {
          assertThemeIsStillAuthoritative()
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
        const timeoutSeconds = generationPanel.researchMode === 'off' ? 30 : 90
        errorMessage = `Generation timed out after ${timeoutSeconds} seconds. Try again or simplify your prompt.`
      } else if (err instanceof TypeError && err.message.includes('fetch')) {
        errorMessage = 'Network error. Check your connection and try again.'
      } else if (err instanceof Error) {
        errorMessage = err.message
      }
      console.error('[TextLabs] Generation error:', err)

      if (
        (!refineContext || !refineElementDeleted) &&
        insertedElementIds.length > 0 &&
        layoutServiceApis?.sendElementCommand
      ) {
        const rollbackResults = await Promise.allSettled(
          insertedElementIds.map(elementId => layoutServiceApis.sendElementCommand('deleteElement', { elementId })),
        )
        if (rollbackResults.some(result => result.status === 'rejected')) {
          errorMessage += ' Some generated elements could not be removed; reload the slide before retrying.'
        }
        insertedElementIds.length = 0
      }
      // Restore placeholder on failure
      if (currentBlankId && currentBlankInfo && layoutServiceApis?.sendElementCommand) {
        blankElements.setStatus(currentBlankId, 'blank')
        const placeholderHtml = buildPlaceholderHtml(currentBlankId, formData.componentType)
        const gridRow = `${currentBlankInfo.startRow}/${currentBlankInfo.startRow + currentBlankInfo.height}`
        const gridColumn = `${currentBlankInfo.startCol}/${currentBlankInfo.startCol + currentBlankInfo.width}`
        try {
          await restoreBlankElementAfterFailure({
            elementId: currentBlankId,
            trackingWasRemoved: blankTrackingWasRemoved,
            deleteElement: () => layoutServiceApis.sendElementCommand('deleteElement', {
              elementId: currentBlankId,
            }),
            insertElement: () => layoutServiceApis.sendElementCommand('insertTextBox', {
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
              themeVariantSource: 'element_generation',
            }),
            restoreTracking: restoredElementId => {
              blankElements.removeElement(currentBlankId)
              blankElements.addElement({
                ...currentBlankInfo,
                elementId: restoredElementId,
                status: 'blank',
              })
              blankElements.trackElement(restoredElementId)
              const latestPanel = generationPanel.getSnapshot()
              if (!latestPanel.isOpen) {
                generationPanel.openPanelForElement(currentBlankInfo.componentType, restoredElementId)
              }
            },
            onDeleteError: deleteError => {
              console.warn('[TextLabs] Spinner was already absent during placeholder recovery:', deleteError)
            },
          })
        } catch (restoreErr) {
          console.warn('[TextLabs] Failed to restore placeholder after error:', restoreErr)
        }
      }
      // openPanelForElement clears prior panel errors, so publish the final
      // failure only after any placeholder/tracking recovery has completed.
      const latestPanel = generationPanel.getSnapshot()
      const ownsCurrentPanel = currentBlankId
        ? latestPanel.blankElementId === currentBlankId
        : refineContext
          ? latestPanel.editElementId === refineContext.elementId
          : !latestPanel.isOpen
      if (ownsCurrentPanel || !latestPanel.isOpen) {
        generationPanel.setError(errorMessage)
      } else {
        toast({
          title: 'Element generation failed',
          description: errorMessage,
        })
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
      activeGenerationKeysRef.current.delete(generationKey)
    }
  }, [
    generationPanel,
    textLabsSession,
    layoutServiceApis,
    presentationId,
    toast,
    currentSlideIndex,
    blankElements,
    deckContext,
    researchSessionId,
    researchStoreName,
    researchUserId,
    researchCapabilities,
    getThemeSyncSnapshot,
  ])

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
        themeVariantSource: 'element_generation',
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
