export type DeckVersion = 'blank' | 'strawman' | 'final';

export interface DirectorSyncPayload {
  current_state: string;
  presentation_url?: string | null;
  presentation_id?: string | null;
  slide_count?: number | null;
}

export interface DirectorSyncRecoverableState {
  presentationUrl: string | null;
  finalPresentationUrl: string | null;
  deckOwnerSessionId: string | null;
  presentationId: string | null;
  finalPresentationId: string | null;
  activeVersion: DeckVersion;
  isBlankPresentation: boolean;
  slideCount: number | null;
  currentStatus: unknown | null;
}

const FINAL_SYNC_STATES = new Set(['CONTENT_GENERATED', 'COMPLETE']);

export function shouldRecoverFinalFromSync(
  payload: DirectorSyncPayload,
  state: DirectorSyncRecoverableState,
): boolean {
  const finalUrl = payload.presentation_url;
  if (!finalUrl || !FINAL_SYNC_STATES.has(payload.current_state)) {
    return false;
  }

  return (
    state.activeVersion !== 'final'
    || state.presentationUrl !== finalUrl
    || state.finalPresentationUrl !== finalUrl
    || (!!payload.presentation_id && state.finalPresentationId !== payload.presentation_id)
  );
}

export function applyFinalSyncRecovery<TState extends DirectorSyncRecoverableState>(
  state: TState,
  payload: DirectorSyncPayload,
  sessionId: string,
): { state: TState; didRecover: boolean; didChangeDisplayedDeck: boolean } {
  if (!shouldRecoverFinalFromSync(payload, state)) {
    return { state, didRecover: false, didChangeDisplayedDeck: false };
  }

  const finalId = payload.presentation_id
    ?? state.finalPresentationId
    ?? state.presentationId;
  const didChangeDisplayedDeck = (
    state.activeVersion !== 'final'
    || state.presentationUrl !== payload.presentation_url
  );
  const samePresentation = (
    state.presentationUrl === payload.presentation_url
    || (!!payload.presentation_id && (
      state.presentationId === payload.presentation_id
      || state.finalPresentationId === payload.presentation_id
    ))
  );
  const nextSlideCount = samePresentation
    ? Math.max(state.slideCount ?? 0, payload.slide_count ?? 0) || state.slideCount
    : payload.slide_count ?? state.slideCount;

  return {
    state: {
      ...state,
      presentationUrl: payload.presentation_url ?? state.presentationUrl,
      finalPresentationUrl: payload.presentation_url ?? state.finalPresentationUrl,
      deckOwnerSessionId: sessionId,
      presentationId: finalId,
      finalPresentationId: finalId,
      activeVersion: 'final',
      isBlankPresentation: false,
      slideCount: nextSlideCount,
      currentStatus: null,
    },
    didRecover: true,
    didChangeDisplayedDeck,
  };
}
