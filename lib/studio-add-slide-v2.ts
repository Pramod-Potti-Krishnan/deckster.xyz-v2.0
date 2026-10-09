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
  /**
   * P9: 0-based VISUAL index of the slide the new one follows (placeholders count); null while no deck exists.
   * Not a Layout index and not the wire `insert_after_index`: the page re-resolves it to a real slide at submit
   * (J2-MAP item8 d, see lib/studio-add-slide-v2-submit.ts).
   */
  anchorVisualIndex: number | null
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
  /** The page supplies this only when the slide composer and its async mode are on. Absent = Generate stays disabled. */
  submit?: AddSlideV2Submit<TTheme>
  /**
   * Where the Blank slide goes, resolved by the page against its compose placeholders (flag on only). Absent =
   * the old native Add position. `expectedVisualIndex` is the slide the pop-up shows as current.
   */
  resolveBlankTarget?: (expectedVisualIndex: number) => AddSlideV2BlankTarget
}

/** `position` is the persisted 0-based insert position for the native Add; undefined = keep the old default. */
export type AddSlideV2BlankTarget = { ok: true; position: number | undefined } | { ok: false; message: string }

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
  'no-submit': 'Slide generation is not available in this build.',
}

export function addSlideV2Blocker(
  draft: AddSlideV2Draft,
  context: Pick<AddSlideV2Context, 'sessionId'>,
  hasSubmit: boolean,
): AddSlideV2Blocker | null {
  // (e) J2-MAP item8: one trimmed, non-empty text for every slide type, hero types included.
  if (!draft.text.trim()) return 'empty-text'
  if (!context.sessionId) return 'no-session'
  if (!hasSubmit) return 'no-submit'
  return null
}

// THE ADAPTER SEAM. Everything the pop-up knows becomes one typed request here; the pop-up never builds a
// backend payload itself. A `submit` prop receives this request and owns the call.
//
// J2-MAP item8 status (RESULT-J2-MAP.md, streams/ops/evidence/J2-MAP/item8-wiring-20261009):
//   (a) selections   mapped below. PROGRAM-1 rulings: Auto sends NO selections key (the Director chooses);
//                    Image is a TEMP default of I1 + text_heavy_columns.
//   (b) async        wired in lib/studio-add-slide-v2-submit.ts through the page's handleSlideComposerAccepted.
//   (c) needs_input  async cannot ask (the backend forces assume_on_missing): v2.0 has no blocking questions, a
//                    needs_input reply is reported as an error that says follow-ups come in v2.1.
//   (d) index        `anchorVisualIndex` here is visual; the page resolves the real Layout anchor at submit.
//   (e) text         required for every type (blocker above).
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
    anchorVisualIndex: context.presentationId ? Math.max(0, context.currentSlide - 1) : null,
    sessionId: context.sessionId,
    presentationId: context.presentationId,
    research: { ...context.research },
    theme: context.theme,
  }
}

// (a) The existing /api/slides/compose `selections` vocabulary, per J2-MAP item8 (a). The UX values
// (`image_left`, `V1-image-text`, ...) are never sent. An empty object means "send no selections key".
export type AddSlideV2Selections = Record<string, string>

const HERO_SELECTIONS: Record<'title' | 'section' | 'closing', AddSlideV2Selections> = {
  title: { canvas_type: 'H1', content_type: 'hero' },
  section: { canvas_type: 'H2', content_type: 'hero' },
  closing: { canvas_type: 'H3', content_type: 'hero' },
}

const CONTENT_SELECTIONS: Record<AddSlideV2ContentSubtype, AddSlideV2Selections> = {
  // PROGRAM-1 ruling 1a: Auto = no selections at all; the Director chooses (so a prompt may still yield a hero).
  auto: {},
  // TEMP default (awaiting ELEMENT-3 full-image key)
  // PROGRAM-1 ruling 1b: the wide image-left mixed canvas with a text companion.
  image: { canvas_type: 'I1', content_type: 'text_heavy_columns' },
  image_left: { canvas_type: 'I1', content_type: 'text_heavy_columns' },
  image_right: { canvas_type: 'I2', content_type: 'text_heavy_columns' },
  chart: { canvas_type: 'C1', content_type: 'chart', chart_subtype: 'single' },
  infographic: { canvas_type: 'C1', content_type: 'infographic', infographic_subtype: 'vertical_center' },
  text: { canvas_type: 'C1', content_type: 'text_heavy_columns' },
}

export function addSlideV2Selections(
  slideType: AddSlideV2Type,
  subtype: AddSlideV2ContentSubtype | null,
): AddSlideV2Selections {
  if (slideType !== 'content') return { ...HERO_SELECTIONS[slideType] }
  return { ...CONTENT_SELECTIONS[subtype ?? 'auto'] }
}

// The Slide panel's default (its `webSearchMaxQueries` state); the cap is not inherited from the chat.
export const ADD_SLIDE_V2_WEB_SEARCH_MAX_QUERIES = 3

/** Wire body for POST /api/slides/compose before the async fields (job_id, async, assume_on_missing). */
export interface AddSlideV2ComposeBody<TTheme = unknown> {
  session_id: string
  presentation_id: string | null
  insert_after_index: number | null
  instruction: string
  theme: TTheme
  selections?: AddSlideV2Selections
  research: {
    use_uploaded_documents: boolean
    use_web_search: boolean
    use_deep_research: boolean
    use_knowledge_graph: boolean
    web_search_max_queries: number
  }
}

/**
 * The popup's request as the compose wire body. `insertAfterIndex` is the REAL Layout anchor the page resolved
 * (see resolveAddSlideV2Anchor), never request.anchorVisualIndex. snake_case, no UX-only fields.
 */
export function buildAddSlideV2ComposeBody<TTheme>(
  request: AddSlideV2Request<TTheme>,
  insertAfterIndex: number | null,
): AddSlideV2ComposeBody<TTheme> | null {
  if (!request.sessionId) return null
  const selections = addSlideV2Selections(request.slideType, request.contentSubtype)
  const body: AddSlideV2ComposeBody<TTheme> = {
    session_id: request.sessionId,
    presentation_id: request.presentationId,
    insert_after_index: insertAfterIndex,
    instruction: request.instruction,
    theme: request.theme,
    research: {
      use_uploaded_documents: request.research.useUploadedDocuments,
      use_web_search: request.research.useWebSearch,
      use_deep_research: request.research.useDeepResearch,
      use_knowledge_graph: request.research.useKnowledgeGraph,
      web_search_max_queries: ADD_SLIDE_V2_WEB_SEARCH_MAX_QUERIES,
    },
  }
  // No selections = the key is absent, not an empty object (global Auto).
  if (Object.keys(selections).length > 0) body.selections = selections
  return body
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

// The draft survives closing the pop-up: it lives in sessionStorage per session and deck, and is cleared only
// after a successful Generate or an explicit Discard. Every storage access is guarded; a missing, blocked or
// full storage just means no persistence.
export interface AddSlideV2DraftStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function addSlideV2DraftKey(sessionId: string | null, presentationId: string | null): string {
  return `deckster.addSlideV2.draft.v1:${sessionId ?? 'no-session'}:${presentationId ?? 'no-deck'}`
}

export function isPristineAddSlideV2Draft(draft: AddSlideV2Draft): boolean {
  const initial = initialAddSlideV2Draft()
  return draft.slideType === initial.slideType && draft.contentSubtype === initial.contentSubtype && draft.text === initial.text
}

export function loadAddSlideV2Draft(storage: AddSlideV2DraftStorage | null, key: string): AddSlideV2Draft {
  try {
    const raw = storage?.getItem(key)
    if (!raw) return initialAddSlideV2Draft()
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return initialAddSlideV2Draft()
    const { slideType, contentSubtype, text } = parsed as Record<string, unknown>
    if (typeof text !== 'string'
      || !ADD_SLIDE_V2_SLIDE_TYPES.some(option => option.value === slideType)
      || !ADD_SLIDE_V2_CONTENT_SUBTYPES.some(option => option.value === contentSubtype)) return initialAddSlideV2Draft()
    return { slideType: slideType as AddSlideV2Type, contentSubtype: contentSubtype as AddSlideV2ContentSubtype, text }
  } catch {
    return initialAddSlideV2Draft()
  }
}

export function saveAddSlideV2Draft(storage: AddSlideV2DraftStorage | null, key: string, draft: AddSlideV2Draft): void {
  try {
    if (!storage) return
    if (isPristineAddSlideV2Draft(draft)) storage.removeItem(key)
    else storage.setItem(key, JSON.stringify({ slideType: draft.slideType, contentSubtype: draft.contentSubtype, text: draft.text }))
  } catch { /* storage unavailable or full: the draft just is not kept */ }
}

export function clearAddSlideV2Draft(storage: AddSlideV2DraftStorage | null, key: string): void {
  try {
    storage?.removeItem(key)
  } catch { /* nothing to clear */ }
}

// P9, shown as a note in the pop-up.
export function addSlideV2PlacementNote(currentSlide: number): string {
  return currentSlide >= 1
    ? `The new slide is added right after slide ${currentSlide}.`
    : 'The new slide is added right after the current slide.'
}
