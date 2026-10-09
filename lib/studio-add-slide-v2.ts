// J2 v2: generate-first "Add slide" pop-up (PK feedback J2-P1..P9, ops/program/J2-V2-FEEDBACK.md).
//
// Scaffold only. This file is import-free on purpose: the pop-up state, the copy tables and the single
// adapter seam (`buildAddSlideV2Request`) are plain TypeScript so a node test can load them without a bundler.
//
// Flag NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED (exact "true"; default off). Off = the existing Add Slide
// picker, byte for byte.

// Literal property access so Next inlines the value into the client bundle.
export const ADD_SLIDE_V2_ENABLED = process.env.NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED === 'true'

// P2: the generate pop-up offers exactly these slide types.
export type AddSlideV2Type = 'title' | 'section' | 'closing' | 'content'
// P3: content sub-types. Only meaningful when the slide type is "content".
export type AddSlideV2ContentSubtype =
  | 'auto'
  | 'image'
  | 'image_left'
  | 'image_right'
  | 'chart'
  | 'infographic'
  | 'text'

export interface AddSlideV2Option<T extends string> {
  value: T
  label: string
  hint: string
}

export const ADD_SLIDE_V2_SLIDE_TYPES: ReadonlyArray<AddSlideV2Option<AddSlideV2Type>> = [
  { value: 'title', label: 'Title', hint: 'Opening slide' },
  { value: 'section', label: 'Section', hint: 'Chapter break' },
  { value: 'closing', label: 'Closing', hint: 'Wrap-up slide' },
  { value: 'content', label: 'Content', hint: 'Text, charts, images' },
]

export const ADD_SLIDE_V2_CONTENT_SUBTYPES: ReadonlyArray<AddSlideV2Option<AddSlideV2ContentSubtype>> = [
  { value: 'auto', label: 'Auto', hint: 'Let Deckster choose' },
  { value: 'image', label: 'Image', hint: 'Image-led slide' },
  { value: 'image_left', label: 'Image left', hint: 'Image on the left, text on the right' },
  { value: 'image_right', label: 'Image right', hint: 'Image on the right, text on the left' },
  { value: 'chart', label: 'Chart', hint: 'Data visualization' },
  { value: 'infographic', label: 'Infographic', hint: 'Visual explanation' },
  { value: 'text', label: 'Text', hint: 'Text-led slide' },
]

// P4: the only free-text field.
export const ADD_SLIDE_V2_PROMPT_LABEL = 'What should this slide say?'
// P6: the one secondary option. There is deliberately no placeholder / layout-picker mode (P1, P6).
export const ADD_SLIDE_V2_BLANK_LABEL = 'Blank slide'

export interface AddSlideV2Draft {
  slideType: AddSlideV2Type
  contentSubtype: AddSlideV2ContentSubtype
  text: string
}

export function initialAddSlideV2Draft(): AddSlideV2Draft {
  return { slideType: 'content', contentSubtype: 'auto', text: '' }
}

export type AddSlideV2Action =
  | { type: 'set_slide_type'; value: AddSlideV2Type }
  | { type: 'set_content_subtype'; value: AddSlideV2ContentSubtype }
  | { type: 'set_text'; value: string }
  | { type: 'reset' }

export function reduceAddSlideV2Draft(draft: AddSlideV2Draft, action: AddSlideV2Action): AddSlideV2Draft {
  switch (action.type) {
    case 'set_slide_type':
      return ADD_SLIDE_V2_SLIDE_TYPES.some(option => option.value === action.value)
        ? { ...draft, slideType: action.value }
        : draft
    case 'set_content_subtype':
      return ADD_SLIDE_V2_CONTENT_SUBTYPES.some(option => option.value === action.value)
        ? { ...draft, contentSubtype: action.value }
        : draft
    case 'set_text':
      return { ...draft, text: action.value }
    case 'reset':
      return initialAddSlideV2Draft()
    default:
      return draft
  }
}

// The sub-type applies to content slides only; a remembered choice stays dormant for the other types.
export function activeAddSlideV2Subtype(draft: AddSlideV2Draft): AddSlideV2ContentSubtype | null {
  return draft.slideType === 'content' ? draft.contentSubtype : null
}

// P7: research and theme follow the chat's settings; the pop-up only displays them.
export interface AddSlideV2Research {
  useUploadedDocuments: boolean
  useWebSearch: boolean
  useDeepResearch: boolean
  useKnowledgeGraph: boolean
}

export interface AddSlideV2Context<TTheme = unknown> {
  sessionId: string | null
  presentationId: string | null
  /** 1-based number of the slide on screen. P9: the new slide lands right after it. */
  currentSlide: number
  slideCount: number
  research: AddSlideV2Research
  theme: TTheme
  themeLabel: string
}

/** What the user asked for, with no backend vocabulary in it. */
export interface AddSlideV2Request<TTheme = unknown> {
  mode: 'generate'
  slideType: AddSlideV2Type
  /** null unless slideType is "content". */
  contentSubtype: AddSlideV2ContentSubtype | null
  instruction: string
  /** P9: 0-based index of the slide the new one follows; null while no deck exists yet. */
  insertAfterIndex: number | null
  sessionId: string | null
  presentationId: string | null
  research: AddSlideV2Research
  theme: TTheme
}

export type AddSlideV2SubmitResult = { ok: true } | { ok: false; message: string }
export type AddSlideV2Submit<TTheme = unknown> = (request: AddSlideV2Request<TTheme>) => Promise<AddSlideV2SubmitResult>

/**
 * Resolved by the builder page from the same state the Slide panel reads (resolveSlideComposeSessionId,
 * effectivePresentationId, the chat's research toggles, the build theme profile), then passed down the
 * viewer chain as one optional prop (P7).
 */
export interface AddSlideV2Settings<TTheme = unknown> {
  sessionId: string | null
  presentationId: string | null
  research: AddSlideV2Research
  themeProfileName: string | null
  /** TODO(J2-MAP): the page supplies this once generation is wired. Absent = Generate stays disabled. */
  submit?: AddSlideV2Submit<TTheme>
}

/** What the Add Slide picker hands the pop-up entry: the page's settings plus what only the viewer knows. */
export interface AddSlideV2EntryConfig<TTheme = unknown> {
  settings: AddSlideV2Settings<TTheme>
  currentSlide: number
  slideCount: number
  theme: TTheme
}

export type AddSlideV2Blocker = 'empty-text' | 'no-session' | 'no-submit'

export const ADD_SLIDE_V2_BLOCKER_COPY: Record<AddSlideV2Blocker, string> = {
  'empty-text': 'Describe what the slide should say.',
  'no-session': 'No active builder session yet.',
  'no-submit': 'Generation is not connected in this build yet.',
}

export function addSlideV2Blocker(
  draft: AddSlideV2Draft,
  context: Pick<AddSlideV2Context, 'sessionId'>,
  hasSubmit: boolean,
): AddSlideV2Blocker | null {
  if (!draft.text.trim()) return 'empty-text'
  if (!context.sessionId) return 'no-session'
  if (!hasSubmit) return 'no-submit'
  return null
}

// THE ADAPTER SEAM. Everything the pop-up knows becomes one typed request here; the pop-up never builds a
// backend payload itself. A `submit` prop receives this request and owns the call.
//
// TODO(J2-MAP): the J2-MAP findings decide the rest of the wiring. Open points, none decided here:
//   - how each slide type / sub-type becomes the backend `selections` vocabulary (image, image left,
//     image right and Auto have no existing /api/slides/compose equivalent in the Slide panel);
//   - which endpoint and mode (sync vs async job) carries it, and how the accepted job reaches the builder
//     page's compose job queue (placeholder, poller, watchdog) so the slide appears;
//   - the needs_input / error path;
//   - which slide index is "current" (this viewer's currentSlide vs the page's selectedLayoutSlideIndex);
//   - sessionId / presentationId must be the page's resolved values (resolveSlideComposeSessionId,
//     effectivePresentationId), which `addSlideV2Settings` already carries.
// Returns null while the request would be refused (empty text, no session).
export function buildAddSlideV2Request<TTheme>(
  draft: AddSlideV2Draft,
  context: AddSlideV2Context<TTheme>,
): AddSlideV2Request<TTheme> | null {
  const instruction = draft.text.trim()
  if (!instruction || !context.sessionId) return null
  return {
    mode: 'generate',
    slideType: draft.slideType,
    contentSubtype: activeAddSlideV2Subtype(draft),
    instruction,
    insertAfterIndex: context.presentationId ? Math.max(0, context.currentSlide - 1) : null,
    sessionId: context.sessionId,
    presentationId: context.presentationId,
    research: { ...context.research },
    theme: context.theme,
  }
}

export interface AddSlideV2ResearchRow {
  key: keyof AddSlideV2Research
  label: string
  on: boolean
}

export function describeAddSlideV2Research(research: AddSlideV2Research): AddSlideV2ResearchRow[] {
  return [
    { key: 'useWebSearch', label: 'Web search', on: research.useWebSearch },
    { key: 'useDeepResearch', label: 'Deep research', on: research.useDeepResearch },
    { key: 'useUploadedDocuments', label: 'Your documents', on: research.useUploadedDocuments },
    { key: 'useKnowledgeGraph', label: 'Knowledge graph', on: research.useKnowledgeGraph },
  ]
}

// Same wording as the Slide panel's theme row (slide-generation-panel/index.tsx getBuildThemeLabel);
// the preset catalog is passed in so this file stays import-free.
export function describeAddSlideV2Theme(
  selection: { mode?: string; preset_id?: string; primary_hex?: string },
  profileName: string | null | undefined,
  presets: ReadonlyArray<{ preset_id: string; name: string }>,
): string {
  if (selection.mode === 'auto') return 'Auto — matches deck'
  if (profileName) return profileName
  if (selection.mode === 'preset') {
    const preset = presets.find(item => item.preset_id === selection.preset_id)
    return preset?.name || selection.preset_id || 'Deck default'
  }
  if (selection.mode === 'custom') {
    return selection.primary_hex ? `Brand ${selection.primary_hex}` : 'Custom theme'
  }
  return 'Deck default'
}

// P9, shown as a note in the pop-up.
export function addSlideV2PlacementNote(currentSlide: number): string {
  return currentSlide >= 1
    ? `The new slide is added right after slide ${currentSlide}.`
    : 'The new slide is added right after the current slide.'
}
