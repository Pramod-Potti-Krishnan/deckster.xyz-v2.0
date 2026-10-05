/** Presentation-only lifecycle classification. The caller supplies an already
 * URL-policy-admitted canonical selection; this helper never chooses a deck,
 * manufactures a viewer URL, acknowledges completion or changes tools. */
export interface StudioCanvasLifecycleInput {
  displayedSessionId: string | null
  deckOwnerSessionId: string | null
  selected: {
    presentationId: string | null
    presentationUrl: string | null
    activeVersion: 'blank' | 'strawman' | 'final'
    slideCount: number | null
  }
  finalPresentationId: string | null
  finalPresentationUrl: string | null
  /** Authored structure already attributed to the displayed selection. */
  hasAuthoredStructure: boolean
  loading: boolean
  generating: boolean
  /** Pass the effective canvas phase (idle when narration is inactive). */
  phase: string
  dismissed: boolean
  connected: boolean
  connecting: boolean
}

export interface StudioCanvasLifecycle {
  mode: 'loading' | 'awaiting_owner' | 'awaiting_viewer' | 'generated' | 'authored' | 'preparing' | 'blank' | 'empty'
  connection: 'connected' | 'connecting' | 'disconnected'
  hasOwnedSelection: boolean
  hasOwnedFinal: boolean
  hasGeneratedDeck: boolean
  hasAuthoredDeck: boolean
  /** One landing decision for welcome layout and canvas placeholder. */
  showLanding: boolean
}

function present(value: string | null): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

export function classifyStudioCanvasLifecycle(input: StudioCanvasLifecycleInput): StudioCanvasLifecycle {
  const hasSelection = present(input.selected.presentationId) || present(input.selected.presentationUrl)
  // Explicit loaded metadata may own the displayed session before its socket
  // adopts it. Socket connectivity is not deck authority or a rendering gate.
  const ownsMetadata = present(input.displayedSessionId)
    && input.deckOwnerSessionId === input.displayedSessionId
  const hasOwnedSelection = ownsMetadata && hasSelection
  const hasOwnedFinal = ownsMetadata && present(input.finalPresentationId) && present(input.finalPresentationUrl)
  const hasPositiveCount = typeof input.selected.slideCount === 'number'
    && Number.isInteger(input.selected.slideCount) && input.selected.slideCount > 0
  const hasGeneratedDeck = hasOwnedSelection && hasOwnedFinal
    && input.selected.activeVersion === 'final'
    && input.selected.presentationId === input.finalPresentationId
    && input.selected.presentationUrl === input.finalPresentationUrl
    && hasPositiveCount
  const hasAuthoredDeck = ownsMetadata && input.hasAuthoredStructure
  const awaitingOwner = hasSelection && !ownsMetadata
  const awaitingViewer = hasOwnedFinal && hasPositiveCount && input.selected.activeVersion === 'final'
    && (!present(input.selected.presentationId) || !present(input.selected.presentationUrl))
  const preparing = input.generating || (input.phase !== 'idle' && input.phase !== 'planning')
  const mode: StudioCanvasLifecycle['mode'] = input.loading ? 'loading'
    : awaitingOwner ? 'awaiting_owner'
    : awaitingViewer ? 'awaiting_viewer'
    : hasGeneratedDeck ? 'generated'
    : hasAuthoredDeck ? 'authored'
    : preparing ? 'preparing'
    : hasOwnedSelection ? 'blank' : 'empty'
  return {
    mode,
    connection: input.connected ? 'connected' : input.connecting ? 'connecting' : 'disconnected',
    hasOwnedSelection,
    hasOwnedFinal,
    hasGeneratedDeck,
    hasAuthoredDeck,
    showLanding: !input.loading && !awaitingOwner && !awaitingViewer && !hasGeneratedDeck && !hasAuthoredDeck
      && !input.generating && (input.phase === 'idle' || input.phase === 'planning') && !input.dismissed,
  }
}
