export type TemplateDeckVersion = 'blank' | 'strawman' | 'final';

export type TemplateSaveDisabledReason =
  | 'template_builder_disabled'
  | 'missing_session'
  | 'template_mode'
  | 'blank_presentation'
  | 'not_final_deck'
  | 'missing_presentation';

export interface TemplateSaveGateInput {
  templateBuilderEnabled?: boolean | null;
  sessionId?: string | null;
  deckOwnerSessionId?: string | null;
  presentationUrl?: string | null;
  presentationId?: string | null;
  finalPresentationUrl?: string | null;
  finalPresentationId?: string | null;
  templateSavePresentationId?: string | null;
  activeVersion?: TemplateDeckVersion | null;
  isBlankPresentation?: boolean | null;
  templateModeOn?: boolean | null;
}

export interface TemplateSaveGateResult {
  canSave: boolean;
  sourcePresentationId: string | null;
  disabledReason: TemplateSaveDisabledReason | null;
}

export function extractPresentationIdFromViewerUrl(url?: string | null): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url, 'https://deckster.local');
    const match = parsed.pathname.match(/\/p\/([^/]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  } catch {
    const path = url.split('#', 1)[0]?.split('?', 1)[0] ?? '';
    const match = path.match(/\/p\/([^/]+)/);
    return match?.[1] ? safeDecodeURIComponent(match[1]) : null;
  }
}

export function getTemplateSaveGate(input: TemplateSaveGateInput): TemplateSaveGateResult {
  const activeVersion = input.activeVersion ?? 'final';
  const sourcePresentationId = resolveTemplateSourcePresentationId(input, activeVersion);

  if (!input.templateBuilderEnabled) {
    return { canSave: false, sourcePresentationId, disabledReason: 'template_builder_disabled' };
  }

  if (!input.sessionId) {
    return { canSave: false, sourcePresentationId, disabledReason: 'missing_session' };
  }

  if (input.templateModeOn) {
    return { canSave: false, sourcePresentationId, disabledReason: 'template_mode' };
  }

  if (input.isBlankPresentation) {
    return { canSave: false, sourcePresentationId, disabledReason: 'blank_presentation' };
  }

  if (activeVersion !== 'final') {
    return { canSave: false, sourcePresentationId, disabledReason: 'not_final_deck' };
  }

  if (!sourcePresentationId || !(input.finalPresentationUrl || input.presentationUrl)) {
    return { canSave: false, sourcePresentationId, disabledReason: 'missing_presentation' };
  }

  return { canSave: true, sourcePresentationId, disabledReason: null };
}

function resolveTemplateSourcePresentationId(
  input: TemplateSaveGateInput,
  activeVersion: TemplateDeckVersion,
): string | null {
  return (
    normalizeId(input.templateSavePresentationId)
    ?? normalizeId(input.finalPresentationId)
    ?? (activeVersion === 'final' ? normalizeId(input.presentationId) : null)
    ?? extractPresentationIdFromViewerUrl(input.finalPresentationUrl)
    ?? (activeVersion === 'final' ? extractPresentationIdFromViewerUrl(input.presentationUrl) : null)
  );
}

function normalizeId(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
