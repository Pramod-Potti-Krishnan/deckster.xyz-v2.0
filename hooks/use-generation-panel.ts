'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { TextLabsComponentType, TextLabsFormData } from '@/types/textlabs'
import type { RefineContext } from '@/hooks/use-element-refinement'
import type { ElementResearchMode } from '@/types/textlabs'
import type { GenerationPanelDraft } from '@/components/generation-panel/types'
import type { TextLabsRetryStrategy } from '@/lib/textlabs-client'
import {
  isNonResearchVisualElement,
  restoreElementResearchSelection,
} from '@/lib/element-research-policy'
import { resolveBlankReplacementPanelState } from '@/lib/blank-element-replacement'
import { stripChartDataUpdateMode } from '@/lib/chart-data-contract'

function cloneFormDataForDraft(formData: TextLabsFormData): TextLabsFormData {
  const copy: Record<string, unknown> = {}
  Object.entries(formData as unknown as Record<string, unknown>).forEach(([key, value]) => {
    if (key === 'referenceImage') return
    if (key === 'generationContext' || key === 'slideContext' || key === 'deckContext') return
    if (key === 'existingElement') return
    if (value !== undefined) copy[key] = value
  })
  const durableCopy = formData.componentType === 'CHART'
    ? stripChartDataUpdateMode(copy)
    : copy
  try {
    return JSON.parse(JSON.stringify(durableCopy)) as unknown as TextLabsFormData
  } catch (_error) {
    return durableCopy as unknown as TextLabsFormData
  }
}

function showAdvancedFromGenerationConfig(formData?: TextLabsFormData | null): boolean | undefined {
  const generationConfig = formData?.generationConfig
  if (!generationConfig || typeof generationConfig !== 'object' || Array.isArray(generationConfig)) return undefined
  return typeof generationConfig.showAdvanced === 'boolean' ? generationConfig.showAdvanced : undefined
}

/**
 * Manages the GenerationPanel open/close state and selected element type.
 * Remembers the last-used element type within the session.
 * Tracks which blank element (if any) the panel is configuring.
 * Supports 'generate' and 'edit' modes for element creation vs editing.
 */
export function useGenerationPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [activationId, setActivationId] = useState(0)
  const [elementType, setElementType] = useState<TextLabsComponentType>('TEXT_BOX')
  const [error, setErrorState] = useState<string | null>(null)
  const [retryStrategy, setRetryStrategy] = useState<TextLabsRetryStrategy | null>(null)
  const [blankElementId, setBlankElementId] = useState<string | null>(null)

  // Edit mode state
  const [mode, setMode] = useState<'generate' | 'edit' | 'refine'>('generate')
  const [editElementId, setEditElementId] = useState<string | null>(null)
  const [refineContext, setRefineContext] = useState<RefineContext | null>(null)
  const [researchMode, setResearchMode] = useState<ElementResearchMode>('off')
  const [researchWeb, setResearchWeb] = useState(false)
  const [researchUploadedDocs, setResearchUploadedDocs] = useState(false)
  const [researchKnowledgeGraph, setResearchKnowledgeGraph] = useState(false)
  const [draftKey, setDraftKey] = useState<string | null>(null)
  const [draftVersion, setDraftVersion] = useState(0)
  const [activeGenerationKeys, setActiveGenerationKeys] = useState<Set<string>>(
    () => new Set(),
  )
  const draftsRef = useRef<Map<string, GenerationPanelDraft>>(new Map())
  const generationTargetKey = draftKey
    ?? `${mode}:${blankElementId ?? editElementId ?? elementType}`
  const isGenerating = activeGenerationKeys.has(generationTargetKey)
  const hasActiveGenerations = activeGenerationKeys.size > 0
  const setIsGenerating = useCallback((value: boolean) => {
    const key = generationTargetKey
    setActiveGenerationKeys(previous => {
      const next = new Set(previous)
      if (value) next.add(key)
      else next.delete(key)
      return next
    })
  }, [generationTargetKey])
  const setError = useCallback((value: string | null) => {
    setErrorState(value)
    setRetryStrategy(null)
  }, [])
  const snapshotRef = useRef({
    isOpen,
    blankElementId,
    editElementId,
    mode,
  })

  useEffect(() => {
    snapshotRef.current = {
      isOpen,
      blankElementId,
      editElementId,
      mode,
    }
  }, [isOpen, blankElementId, editElementId, mode])

  const applyDraftResearch = useCallback((key: string | null) => {
    const draft = key ? draftsRef.current.get(key) : null
    if (draft?.researchMode) {
      setResearchMode(draft.researchMode)
      setResearchWeb(Boolean(draft.researchWeb))
      setResearchUploadedDocs(Boolean(draft.researchUploadedDocs))
      setResearchKnowledgeGraph(Boolean(draft.researchKnowledgeGraph))
      return
    }
    setResearchMode('off')
    setResearchWeb(false)
    setResearchUploadedDocs(false)
    setResearchKnowledgeGraph(false)
  }, [])

  const activateDraftKey = useCallback((nextKey: string | null, shouldReset: boolean) => {
    setDraftKey(nextKey)
    if (shouldReset) {
      setActivationId(previous => previous + 1)
      applyDraftResearch(nextKey)
    }
  }, [applyDraftResearch])

  const updateCurrentDraft = useCallback((patch: Partial<GenerationPanelDraft>) => {
    const key = draftKey
    if (!key) return
    const previous = draftsRef.current.get(key) || {}
    const next: GenerationPanelDraft = {
      ...previous,
      ...patch,
      formData: patch.formData
        ? cloneFormDataForDraft(patch.formData)
        : patch.formData === null
          ? null
          : previous.formData,
    }
    draftsRef.current.set(key, next)
    setDraftVersion(previousVersion => previousVersion + 1)
  }, [draftKey])

  const rememberDraftForElement = useCallback((elementId: string, formData?: TextLabsFormData | null) => {
    const source = draftKey ? draftsRef.current.get(draftKey) : null
    const next: GenerationPanelDraft = {
      ...(source || {}),
      prompt: formData?.prompt ?? source?.prompt,
      showAdvanced: showAdvancedFromGenerationConfig(formData) ?? source?.showAdvanced ?? false,
      formData: formData ? cloneFormDataForDraft(formData) : source?.formData ?? null,
      researchMode,
      researchWeb,
      researchUploadedDocs,
      researchKnowledgeGraph,
    }
    draftsRef.current.set(`element:${elementId}`, next)
    setDraftVersion(previousVersion => previousVersion + 1)
  }, [draftKey, researchKnowledgeGraph, researchMode, researchUploadedDocs, researchWeb])

  const resetResearch = useCallback(() => {
    setResearchMode('off')
    setResearchWeb(false)
    setResearchUploadedDocs(false)
    setResearchKnowledgeGraph(false)
  }, [])

  const normalizeResearchForType = useCallback((type: TextLabsComponentType) => {
    if (isNonResearchVisualElement(type)) resetResearch()
  }, [resetResearch])

  /** Open panel for a specific blank element on the canvas */
  const openPanelForElement = useCallback((type: TextLabsComponentType, elementId: string) => {
    const nextDraftKey = `blank:${elementId}`
    const sameTarget = draftKey === nextDraftKey && elementType === type
    setElementType(type)
    activateDraftKey(nextDraftKey, !sameTarget)
    normalizeResearchForType(type)
    setBlankElementId(elementId)
    setMode('generate')
    setEditElementId(null)
    setRefineContext(null)
    setIsOpen(true)
    setError(null)
  }, [activateDraftKey, draftKey, elementType, normalizeResearchForType])

  /** Keep the current draft when Layout replaces the same placeholder identity. */
  const resumePanelForElement = useCallback((type: TextLabsComponentType, elementId: string) => {
    const previousKey = draftKey
    const nextDraftKey = `blank:${elementId}`
    if (previousKey && previousKey !== nextDraftKey) {
      const draft = draftsRef.current.get(previousKey)
      if (draft) draftsRef.current.set(nextDraftKey, draft)
    }
    setElementType(type)
    setDraftKey(nextDraftKey)
    normalizeResearchForType(type)
    setBlankElementId(elementId)
    setMode('generate')
    setEditElementId(null)
    setRefineContext(null)
    setIsOpen(true)
    setError(null)
  }, [draftKey, normalizeResearchForType])

  /** Open panel in edit mode for an existing element */
  const openPanelForEdit = useCallback((type: TextLabsComponentType, elementId: string) => {
    const nextDraftKey = `element:${elementId}`
    const sameTarget = draftKey === nextDraftKey && elementType === type
    setElementType(type)
    activateDraftKey(nextDraftKey, !sameTarget)
    normalizeResearchForType(type)
    setBlankElementId(null)
    setMode('edit')
    setEditElementId(elementId)
    setRefineContext(null)
    setIsOpen(true)
    setError(null)
  }, [activateDraftKey, draftKey, elementType, normalizeResearchForType])

  /** Open panel in refine mode for an existing element. */
  const openPanelForRefine = useCallback((type: TextLabsComponentType, context: RefineContext) => {
    const nextDraftKey = `element:${context.elementId}`
    const sameTarget = draftKey === nextDraftKey && elementType === type
    setElementType(type)
    activateDraftKey(nextDraftKey, !sameTarget)
    normalizeResearchForType(type)
    setBlankElementId(null)
    setMode('refine')
    setEditElementId(context.elementId)
    setRefineContext(context)
    const restoredResearch = restoreElementResearchSelection(
      type,
      context.researchProvenance,
      context.slotKind,
      context.accessoryType,
    )
    setResearchMode(restoredResearch.mode)
    setResearchWeb(restoredResearch.web)
    setResearchUploadedDocs(restoredResearch.uploadedDocuments)
    setResearchKnowledgeGraph(restoredResearch.knowledgeGraph)
    setIsOpen(true)
    setError(null)
  }, [activateDraftKey, draftKey, elementType, normalizeResearchForType])

  const closePanel = useCallback(() => {
    setIsOpen(false)
    setError(null)
  }, [])

  const changeElementType = useCallback((type: TextLabsComponentType) => {
    setElementType(type)
    setDraftKey(null)
    setActivationId(previous => previous + 1)
    setError(null)
    resetResearch()
  }, [resetResearch])

  const completeBlankReplacement = useCallback((
    type: TextLabsComponentType,
    replacedPlaceholderId: string,
    nextRefineContext: RefineContext,
  ) => {
    const next = resolveBlankReplacementPanelState(
      snapshotRef.current,
      replacedPlaceholderId,
      nextRefineContext,
    )
    if (!next) return

    const nextDraftKey = `element:${nextRefineContext.elementId}`
    const previousDraftKey = `blank:${replacedPlaceholderId}`
    const previousDraft = draftsRef.current.get(previousDraftKey)
    if (previousDraft && !draftsRef.current.has(nextDraftKey)) {
      draftsRef.current.set(nextDraftKey, previousDraft)
      setDraftVersion(previousVersion => previousVersion + 1)
    }

    snapshotRef.current = {
      isOpen: next.isOpen,
      blankElementId: next.blankElementId,
      editElementId: next.editElementId,
      mode: next.mode,
    }
    setElementType(type)
    activateDraftKey(nextDraftKey, true)
    normalizeResearchForType(type)
    setBlankElementId(null)
    setMode('refine')
    setEditElementId(nextRefineContext.elementId)
    setRefineContext(nextRefineContext)
    setIsOpen(true)
    setError(null)
  }, [activateDraftKey, normalizeResearchForType])

  const getSnapshot = useCallback(() => snapshotRef.current, [])

  return {
    isOpen,
    activationId,
    draftKey,
    currentDraft: draftKey ? draftsRef.current.get(draftKey) || null : null,
    draftVersion,
    elementType,
    isGenerating,
    hasActiveGenerations,
    error,
    retryStrategy,
    blankElementId,
    mode,
    editElementId,
    refineContext,
    researchMode,
    researchWeb,
    researchUploadedDocs,
    researchKnowledgeGraph,
    openPanelForElement,
    resumePanelForElement,
    openPanelForEdit,
    openPanelForRefine,
    closePanel,
    changeElementType,
    getSnapshot,
    updateCurrentDraft,
    rememberDraftForElement,
    completeBlankReplacement,
    setIsGenerating,
    setError,
    setRetryStrategy,
    setResearchMode,
    setResearchWeb,
    setResearchUploadedDocs,
    setResearchKnowledgeGraph,
  }
}
