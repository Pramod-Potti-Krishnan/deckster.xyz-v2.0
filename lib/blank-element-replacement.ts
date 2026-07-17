import type { RefineContext } from '@/hooks/use-element-refinement'

export interface GenerationPanelReplacementSnapshot {
  isOpen: boolean
  blankElementId: string | null
  editElementId: string | null
  mode: 'generate' | 'edit' | 'refine'
}

export interface BlankReplacementPanelState extends GenerationPanelReplacementSnapshot {
  refineContext: RefineContext
}

/**
 * A successful one-for-one placeholder replacement becomes refinement of the
 * inserted element. Do not steal focus if the user opened a different panel
 * while generation was in flight.
 */
export function resolveBlankReplacementPanelState(
  current: GenerationPanelReplacementSnapshot,
  replacedPlaceholderId: string,
  refineContext: RefineContext,
): BlankReplacementPanelState | null {
  if (current.isOpen && current.blankElementId !== replacedPlaceholderId) return null
  return {
    isOpen: true,
    blankElementId: null,
    editElementId: refineContext.elementId,
    mode: 'refine',
    refineContext,
  }
}
