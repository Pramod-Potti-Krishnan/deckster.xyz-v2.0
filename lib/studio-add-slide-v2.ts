// J2 v2: the generate-first "Add slide" side panel (PK feedback J2-P1..P11, ops/program/J2-V2-FEEDBACK.md).
//
// This file is import-free on purpose: the panel state, the option table and its kill switches, the copy tables,
// the draft storage helpers and the single adapter seam (`buildAddSlideV2Request`) are plain TypeScript so a
// node test can load them without a bundler.
//
// Flag NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED (exact "true"; default off). Off = the existing Add Slide
// picker, byte for byte.

// Literal property access so Next inlines the value into the client bundle.
export const ADD_SLIDE_V2_ENABLED = process.env.NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED === 'true'

// P2: the generate panel offers exactly these slide types.
export type AddSlideV2Type = 'title' | 'section' | 'closing' | 'content'
// P3 / P11: content styles. Only meaningful when the slide type is "content". Plain "Image" (a full-image slide)
// is gone: no end-to-end path exists for it.
export type AddSlideV2ContentSubtype =
  | 'auto'
  | 'text'
  | 'image_left'
  | 'image_right'
  | 'chart'
  | 'infographic'
  | 'table'
  | 'diagram'

// ---- Options and their kill switches ---------------------------------------------------------------------------------
// One table. An option is shown only when its id is in the resolved set (see resolveAddSlideV2Options). One rule:
//   hidden = (the default-hidden ids: stage 2 + the opt-in id `regenerate`) + DISABLED, minus ENABLED; DISABLED always wins.
//   - NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_DISABLED_OPTIONS="image_left" ADDS ids to the hidden set; it never un-hides the
//     default (DEC-P8: stage 2 stays hidden until it is proven).
//   - NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED_OPTIONS="chart" REMOVES the named ids from the default-hidden set;
//     "all" removes every stage-2 id. The opt-in id `regenerate` (the Regenerate section for a generated slide) is only
//     ever enabled by naming it, and also needs NEXT_PUBLIC_STUDIO_SLIDE_REGENERATE_ENABLED=true.
export type AddSlideV2OptionId =
  | AddSlideV2Type
  | AddSlideV2ContentSubtype
  | 'blank'
  | 'catalog'
  | 'blank_theme'
  | 'regenerate'

export interface AddSlideV2OptionConfig {
  id: AddSlideV2OptionId
  group: 'type' | 'style' | 'extra'
  label: string
  hint: string
  /** DEC-P8 proof stage: 1 = Title/Section/Closing/Auto/Text/Image left/right, 2 = Chart/Infographic/Table/Diagram. */
  stage: 1 | 2
  /** Off unless named in NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED_OPTIONS (`all` does not include it). */
  optIn?: boolean
}

export const ADD_SLIDE_V2_OPTION_CONFIG: ReadonlyArray<AddSlideV2OptionConfig> = [
  { id: 'title', group: 'type', label: 'Title', hint: 'Opening slide', stage: 1 },
  { id: 'section', group: 'type', label: 'Section', hint: 'Chapter break', stage: 1 },
  { id: 'closing', group: 'type', label: 'Closing', hint: 'Wrap-up slide', stage: 1 },
  { id: 'content', group: 'type', label: 'Content', hint: 'Text, charts, images', stage: 1 },
  { id: 'auto', group: 'style', label: 'Auto', hint: 'Let Deckster choose', stage: 1 },
  { id: 'text', group: 'style', label: 'Text', hint: 'Text-led slide', stage: 1 },
  { id: 'image_left', group: 'style', label: 'Image left', hint: 'Image on the left, text on the right', stage: 1 },
  { id: 'image_right', group: 'style', label: 'Image right', hint: 'Image on the right, text on the left', stage: 1 },
  { id: 'chart', group: 'style', label: 'Chart', hint: 'Data visualization', stage: 2 },
  { id: 'infographic', group: 'style', label: 'Infographic', hint: 'Visual explanation', stage: 2 },
  { id: 'table', group: 'style', label: 'Table', hint: 'Rows and columns', stage: 2 },
  { id: 'diagram', group: 'style', label: 'Diagram', hint: 'Structured diagram', stage: 2 },
  { id: 'blank', group: 'extra', label: 'Blank slide', hint: 'An empty slide, no generation', stage: 1 },
  { id: 'catalog', group: 'extra', label: 'Browse layout catalog', hint: 'The classic layout picker', stage: 1 },
  { id: 'blank_theme', group: 'extra', label: 'Blank slide follows the deck theme', hint: 'Background from the deck theme', stage: 1 },
  { id: 'regenerate', group: 'extra', label: 'Regenerate this slide', hint: 'Rebuild the slide on screen in place', stage: 1, optIn: true },
]

export const ADD_SLIDE_V2_STAGE2_IDS: ReadonlyArray<AddSlideV2OptionId> =
  ADD_SLIDE_V2_OPTION_CONFIG.filter(option => option.stage === 2).map(option => option.id)

export function parseAddSlideV2OptionList(raw: string | undefined | null): Set<string> {
  return new Set((raw ?? '').split(',').map(part => part.trim().toLowerCase()).filter(Boolean))
}

/** Shorthand in the ENABLED list for every stage-2 id (not the opt-in scaffold). */
export const ADD_SLIDE_V2_ENABLE_ALL = 'all'

/**
 * The ids that are shown. Default-hidden ids (stage 2, opt-in) show only when named in `rawEnabled` (or `all` for
 * stage 2); `rawDisabled` hides more and wins over `rawEnabled`. Unknown ids are ignored, so a typo never shows or
 * hides anything by accident, and unset, blank or "none" behave like an empty list.
 */
export function resolveAddSlideV2Options(
  rawDisabled: string | undefined | null,
  rawEnabled?: string | undefined | null,
): ReadonlySet<string> {
  const disabled = parseAddSlideV2OptionList(rawDisabled)
  const enabled = parseAddSlideV2OptionList(rawEnabled)
  const enableAllStage2 = enabled.has(ADD_SLIDE_V2_ENABLE_ALL)
  return new Set(
    ADD_SLIDE_V2_OPTION_CONFIG
      .filter(option => {
        if (disabled.has(option.id)) return false
        if (option.stage !== 2 && !option.optIn) return true
        return enabled.has(option.id) || (enableAllStage2 && option.stage === 2)
      })
      .map(option => option.id),
  )
}

// Literal property access so Next inlines the values into the client bundle.
export const ADD_SLIDE_V2_OPTIONS: ReadonlySet<string> = resolveAddSlideV2Options(
  process.env.NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_DISABLED_OPTIONS,
  process.env.NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED_OPTIONS,
)

export interface AddSlideV2Option<T extends string> {
  value: T
  label: string
  hint: string
}

function optionsOf<T extends string>(group: AddSlideV2OptionConfig['group']): ReadonlyArray<AddSlideV2Option<T>> {
  return ADD_SLIDE_V2_OPTION_CONFIG
    .filter(option => option.group === group)
    .map(option => ({ value: option.id as T, label: option.label, hint: option.hint }))
}

/** Every configured slide type / style, in display order, whether or not it is switched on. */
export const ADD_SLIDE_V2_SLIDE_TYPES: ReadonlyArray<AddSlideV2Option<AddSlideV2Type>> = optionsOf<AddSlideV2Type>('type')
export const ADD_SLIDE_V2_CONTENT_SUBTYPES: ReadonlyArray<AddSlideV2Option<AddSlideV2ContentSubtype>> = optionsOf<AddSlideV2ContentSubtype>('style')

export function addSlideV2OptionOn(id: AddSlideV2OptionId, options: ReadonlySet<string> = ADD_SLIDE_V2_OPTIONS): boolean {
  return options.has(id)
}

/** The styles that are switched on. */
export function availableAddSlideV2Subtypes(options: ReadonlySet<string> = ADD_SLIDE_V2_OPTIONS): ReadonlyArray<AddSlideV2Option<AddSlideV2ContentSubtype>> {
  return ADD_SLIDE_V2_CONTENT_SUBTYPES.filter(option => options.has(option.value))
}

/** The slide types that are switched on. "Content" also needs at least one content style. */
export function availableAddSlideV2Types(options: ReadonlySet<string> = ADD_SLIDE_V2_OPTIONS): ReadonlyArray<AddSlideV2Option<AddSlideV2Type>> {
  return ADD_SLIDE_V2_SLIDE_TYPES.filter(option => options.has(option.value)
    && (option.value !== 'content' || availableAddSlideV2Subtypes(options).length > 0))
}

// P4: the only free-text field.
export const ADD_SLIDE_V2_PROMPT_LABEL = 'What should this slide say?'
// P6: the one extra action. There is deliberately no placeholder generation mode (P1, P6).
export const ADD_SLIDE_V2_BLANK_LABEL = 'Blank slide'
// DEC-P1: a quiet secondary link to the classic layout picker, not a mode.
export const ADD_SLIDE_V2_CATALOG_LABEL = 'Browse layout catalog'

export interface AddSlideV2Draft {
  slideType: AddSlideV2Type
  contentSubtype: AddSlideV2ContentSubtype
  text: string
}

export function initialAddSlideV2Draft(options: ReadonlySet<string> = ADD_SLIDE_V2_OPTIONS): AddSlideV2Draft {
  const types = availableAddSlideV2Types(options)
  const styles = availableAddSlideV2Subtypes(options)
  return {
    slideType: types.some(option => option.value === 'content') ? 'content' : (types[0]?.value ?? 'content'),
    contentSubtype: styles.some(option => option.value === 'auto') ? 'auto' : (styles[0]?.value ?? 'auto'),
    text: '',
  }
}

export type AddSlideV2Action =
  | { type: 'set_slide_type'; value: AddSlideV2Type }
  | { type: 'set_content_subtype'; value: AddSlideV2ContentSubtype }
  | { type: 'set_text'; value: string }
  | { type: 'reset' }

export function reduceAddSlideV2Draft(
  draft: AddSlideV2Draft,
  action: AddSlideV2Action,
  options: ReadonlySet<string> = ADD_SLIDE_V2_OPTIONS,
): AddSlideV2Draft {
  switch (action.type) {
    case 'set_slide_type':
      return availableAddSlideV2Types(options).some(option => option.value === action.value)
        ? { ...draft, slideType: action.value }
        : draft
    case 'set_content_subtype':
      return availableAddSlideV2Subtypes(options).some(option => option.value === action.value)
        ? { ...draft, contentSubtype: action.value }
        : draft
    case 'set_text':
      return { ...draft, text: action.value }
    case 'reset':
      return initialAddSlideV2Draft(options)
    default:
      return draft
  }
}

// The style applies to content slides only; a remembered choice stays dormant for the other types.
export function activeAddSlideV2Subtype(draft: AddSlideV2Draft): AddSlideV2ContentSubtype | null {
  return draft.slideType === 'content' ? draft.contentSubtype : null
}

// DEC-P2: Title, Section and Closing need a little more than one word; Content keeps "not empty".
export const ADD_SLIDE_V2_HERO_MIN_WORDS = 2

/**
 * Words for the minimum above: whitespace-separated tokens that contain a letter or digit. A token written in a script
 * without spaces (Han, kana, Hangul) counts one word per two characters, so "市场分析" is two words.
 */
export function countAddSlideV2Words(text: string): number {
  const alnum = new RegExp('[\\p{L}\\p{N}]', 'u')
  const spaceless = new RegExp('[\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}]', 'gu')
  let words = 0
  for (const token of text.split(/\s+/)) {
    if (!alnum.test(token)) continue
    const cjk = token.match(spaceless)?.length ?? 0
    words += cjk >= 2 ? Math.ceil(cjk / 2) : 1
  }
  return words
}

// P7: research and theme follow the chat's settings; the panel only displays them.
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
 * viewer chain as one optional prop (P7). The page also owns the drawer: it says whether the panel is open and
 * where in the Element drawer it renders (`panelHost`).
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
   * the old native Add position. `expectedVisualIndex` is the slide the panel shows as current.
   */
  resolveBlankTarget?: (expectedVisualIndex: number) => AddSlideV2BlankTarget
  /**
   * J2V2-REGENERATE (flag NEXT_PUBLIC_STUDIO_SLIDE_REGENERATE_ENABLED, plus the option id `regenerate`): rebuild the
   * generated slide on screen in place. Absent = no Regenerate section.
   */
  regenerate?: AddSlideV2RegenerateSettings<TTheme>
  /** The Element drawer is showing this panel. */
  panelOpen: boolean
  /** The element inside the Element drawer the panel renders into (null until the drawer is mounted). */
  panelHost: HTMLElement | null
  /** Toolbar button / panel close. The page closes the other Element panels when this opens. */
  onPanelOpenChange: (open: boolean) => void
}

/** `position` is the persisted 0-based insert position for the native Add; undefined = keep the old default. */
export type AddSlideV2BlankTarget = { ok: true; position: number | undefined } | { ok: false; message: string }

/** What the Add Slide picker hands the panel entry: the page's settings plus what only the viewer knows. */
export interface AddSlideV2EntryConfig<TTheme = unknown> {
  settings: AddSlideV2Settings<TTheme>
  currentSlide: number
  slideCount: number
  theme: TTheme
  /** The deck's slides in real order (id and title), for Regenerate. Only sent while Regenerate is configured. */
  slides?: ReadonlyArray<AddSlideV2SlideRow>
}

export type AddSlideV2Blocker = 'no-options' | 'empty-text' | 'too-short' | 'no-session' | 'no-submit' | 'busy'

export const ADD_SLIDE_V2_BLOCKER_COPY: Record<AddSlideV2Blocker, string> = {
  'no-options': 'Slide generation options are switched off in this build.',
  'empty-text': 'Describe what the slide should say.',
  'too-short': `Add at least ${ADD_SLIDE_V2_HERO_MIN_WORDS} words, for example a short title.`,
  'no-session': 'No active builder session yet.',
  'no-submit': 'Slide generation is not available in this build.',
  busy: 'This slide is already being regenerated.',
}

// What stops a request being built at all (the submit wiring is checked separately, in addSlideV2Blocker).
function requestBlocker(
  draft: AddSlideV2Draft,
  sessionId: string | null,
  options: ReadonlySet<string>,
): Exclude<AddSlideV2Blocker, 'no-submit'> | null {
  const types = availableAddSlideV2Types(options)
  if (!types.some(option => option.value === draft.slideType)) return 'no-options'
  if (draft.slideType === 'content' && !availableAddSlideV2Subtypes(options).some(option => option.value === draft.contentSubtype)) return 'no-options'
  // (e) J2-MAP item8: trimmed, non-empty text for every slide type ...
  const text = draft.text.trim()
  if (!text) return 'empty-text'
  // ... and DEC-P2: a couple of words for the hero types.
  if (draft.slideType !== 'content' && countAddSlideV2Words(text) < ADD_SLIDE_V2_HERO_MIN_WORDS) return 'too-short'
  if (!sessionId) return 'no-session'
  return null
}

export function addSlideV2Blocker(
  draft: AddSlideV2Draft,
  context: Pick<AddSlideV2Context, 'sessionId'>,
  hasSubmit: boolean,
  options: ReadonlySet<string> = ADD_SLIDE_V2_OPTIONS,
): AddSlideV2Blocker | null {
  const blocker = requestBlocker(draft, context.sessionId, options)
  if (blocker) return blocker
  if (!hasSubmit) return 'no-submit'
  return null
}

// THE ADAPTER SEAM. Everything the panel knows becomes one typed request here; the panel never builds a
// backend payload itself. A `submit` prop receives this request and owns the call.
//
// J2-MAP item8 status (RESULT-J2-MAP.md, streams/ops/evidence/J2-MAP/item8-wiring-20261009):
//   (a) selections   mapped below. PROGRAM-1 rulings: Auto sends NO selections key (the Director chooses). Table and
//                    Diagram reuse the Slide panel's own mapping (components/slide-generation-panel/compose-helpers.ts).
//   (b) async        wired in lib/studio-add-slide-v2-submit.ts through the page's handleSlideComposerAccepted.
//   (c) needs_input  async cannot ask (the backend forces assume_on_missing): v2.0 has no blocking questions, a
//                    needs_input reply is reported as an error that says follow-ups come in v2.1.
//   (d) index        `anchorVisualIndex` here is visual; the page resolves the real Layout anchor at submit.
//   (e) text         required for every type; Title/Section/Closing need a couple of words (DEC-P2).
// Returns null while the request would be refused (no options, empty or too short text, no session).
export function buildAddSlideV2Request<TTheme>(
  draft: AddSlideV2Draft,
  context: AddSlideV2Context<TTheme>,
  options: ReadonlySet<string> = ADD_SLIDE_V2_OPTIONS,
): AddSlideV2Request<TTheme> | null {
  if (requestBlocker(draft, context.sessionId, options) || !context.sessionId) return null
  return {
    mode: 'generate',
    slideType: draft.slideType,
    contentSubtype: activeAddSlideV2Subtype(draft),
    instruction: draft.text.trim(),
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
  image_left: { canvas_type: 'I1', content_type: 'text_heavy_columns' },
  image_right: { canvas_type: 'I2', content_type: 'text_heavy_columns' },
  chart: { canvas_type: 'C1', content_type: 'chart', chart_subtype: 'single' },
  infographic: { canvas_type: 'C1', content_type: 'infographic', infographic_subtype: 'vertical_center' },
  text: { canvas_type: 'C1', content_type: 'text_heavy_columns' },
  // Table and Diagram are the Slide panel's own choices (J2-MAP: "Table maps content_type:table,text_subtype:table";
  // Diagram = the panel's default Diagram preset, an idea board). The test pins both against compose-helpers.
  table: { canvas_type: 'C1', content_type: 'table', text_subtype: 'table' },
  diagram: { canvas_type: 'C1', content_type: 'diagram_idea_board', diagram_subtype: 'idea_board' },
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
 * The panel's request as the compose wire body. `insertAfterIndex` is the REAL Layout anchor the page resolved
 * (see resolveAddSlideV2Anchor), never request.anchorVisualIndex. snake_case, no UX-only fields.
 * An explicit Diagram forces all research off, exactly as the Slide panel does (J2-MAP: "forced OFF for explicit diagrams").
 */
export function buildAddSlideV2ComposeBody<TTheme>(
  request: AddSlideV2Request<TTheme>,
  insertAfterIndex: number | null,
): AddSlideV2ComposeBody<TTheme> | null {
  if (!request.sessionId) return null
  const selections = addSlideV2Selections(request.slideType, request.contentSubtype)
  const researchOff = request.slideType === 'content' && request.contentSubtype === 'diagram'
  const body: AddSlideV2ComposeBody<TTheme> = {
    session_id: request.sessionId,
    presentation_id: request.presentationId,
    insert_after_index: insertAfterIndex,
    instruction: request.instruction,
    theme: request.theme,
    research: {
      use_uploaded_documents: !researchOff && request.research.useUploadedDocuments,
      use_web_search: !researchOff && request.research.useWebSearch,
      use_deep_research: !researchOff && request.research.useDeepResearch,
      use_knowledge_graph: !researchOff && request.research.useKnowledgeGraph,
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

// DEC-P6: a Blank slide follows the deck theme. Layout's B1-blank renderer defaults its background to a hard-coded
// #ffffff (src/renderers/split-templates.js renderB1Blank, Layout @ 839d95b) while its other blank layouts use
// var(--theme-bg, #ffffff), so a Blank in a dark deck came out white. The native Add already forwards a
// `background_color`; this is the same value the other renderers default to. Switch: option id `blank_theme`.
export const ADD_SLIDE_V2_BLANK_BACKGROUND = 'var(--theme-bg, #ffffff)'

/** What the Blank passes to the native Add besides the layout. undefined = the old call, untouched. */
export interface AddSlideV2NativeAddOptions {
  position?: number
  backgroundColor?: string
}

export function addSlideV2BlankNativeOptions(
  position: number | undefined,
  options: ReadonlySet<string> = ADD_SLIDE_V2_OPTIONS,
): AddSlideV2NativeAddOptions | undefined {
  const native: AddSlideV2NativeAddOptions = {}
  if (position !== undefined) native.position = position
  if (options.has('blank_theme')) native.backgroundColor = ADD_SLIDE_V2_BLANK_BACKGROUND
  return Object.keys(native).length > 0 ? native : undefined
}

// DEC-P9: after a generated slide lands, the viewer follows it if the user is still where they were when they
// pressed Generate (or on the pending placeholder). The page keeps the slide each job was started from.
const MAX_REMEMBERED_FOLLOWS = 20
export function rememberAddSlideV2Follow(follow: Map<string, number>, jobId: string, submitVisualIndex: number): void {
  follow.delete(jobId)
  follow.set(jobId, submitVisualIndex)
  while (follow.size > MAX_REMEMBERED_FOLLOWS) {
    const oldest = follow.keys().next().value
    if (oldest === undefined) break
    follow.delete(oldest)
  }
}

// The draft survives closing the panel: it lives in sessionStorage per session and deck, and is cleared only
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

export function isPristineAddSlideV2Draft(draft: AddSlideV2Draft, options: ReadonlySet<string> = ADD_SLIDE_V2_OPTIONS): boolean {
  const initial = initialAddSlideV2Draft(options)
  return draft.slideType === initial.slideType && draft.contentSubtype === initial.contentSubtype && draft.text === initial.text
}

// A stored choice that is no longer on offer (an option was switched off since) falls back to the default
// choice; the text the user wrote is kept.
export function loadAddSlideV2Draft(
  storage: AddSlideV2DraftStorage | null,
  key: string,
  options: ReadonlySet<string> = ADD_SLIDE_V2_OPTIONS,
): AddSlideV2Draft {
  const initial = initialAddSlideV2Draft(options)
  try {
    const raw = storage?.getItem(key)
    if (!raw) return initial
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return initial
    const { slideType, contentSubtype, text } = parsed as Record<string, unknown>
    if (typeof text !== 'string') return initial
    return {
      slideType: availableAddSlideV2Types(options).some(option => option.value === slideType) ? slideType as AddSlideV2Type : initial.slideType,
      contentSubtype: availableAddSlideV2Subtypes(options).some(option => option.value === contentSubtype) ? contentSubtype as AddSlideV2ContentSubtype : initial.contentSubtype,
      text,
    }
  } catch {
    return initial
  }
}

export function saveAddSlideV2Draft(
  storage: AddSlideV2DraftStorage | null,
  key: string,
  draft: AddSlideV2Draft,
  options: ReadonlySet<string> = ADD_SLIDE_V2_OPTIONS,
): void {
  try {
    if (!storage) return
    if (isPristineAddSlideV2Draft(draft, options)) storage.removeItem(key)
    else storage.setItem(key, JSON.stringify({ slideType: draft.slideType, contentSubtype: draft.contentSubtype, text: draft.text }))
  } catch { /* storage unavailable or full: the draft just is not kept */ }
}

export function clearAddSlideV2Draft(storage: AddSlideV2DraftStorage | null, key: string): void {
  try {
    storage?.removeItem(key)
  } catch { /* nothing to clear */ }
}

// P9, shown as a note in the panel.
export function addSlideV2PlacementNote(currentSlide: number): string {
  return currentSlide >= 1
    ? `The new slide is added right after slide ${currentSlide}.`
    : 'The new slide is added right after the current slide.'
}

// ---- Regenerate a generated slide in place (J2V2-REGENERATE) --------------------------------------------------------
// Flag NEXT_PUBLIC_STUDIO_SLIDE_REGENERATE_ENABLED (default off) plus the option id `regenerate`.
//
// Backend: the Slide panel's own Refine path. POST /api/slides/refine -> Director /api/v1/slides/refine-one (J2-MAP
// RESULT section 5) builds the new slide, moves it before the old one, and deletes the old one only after that, so the
// original stays on screen until the new slide is ready and survives a failure (DEC-P5, see
// lib/studio-add-slide-v2-regenerate.ts). The new slide gets a new id and the same position. Hero targets (title,
// section, closing) are restyle-only in Director v1: the request has to say it is still a hero, so those kinds always
// send their explicit H1 / H2 / H3 selections (otherwise Director falls back to a content shape and refuses).
export const ADD_SLIDE_V2_REGENERATE_ENABLED = process.env.NEXT_PUBLIC_STUDIO_SLIDE_REGENERATE_ENABLED === 'true'

/** One slide of the deck in real (Layout) order, as the viewer's rail knows it. */
export interface AddSlideV2SlideRow {
  slideId: string | null
  title: string
}

export interface AddSlideV2RegenerateTarget {
  /** The stable Layout id; a refine is addressed by it. */
  slideId: string
  /** 0-based REAL Layout index (compose placeholders do not count). */
  layoutIndex: number
  /** 1-based number on screen (placeholders count). */
  slideNumber: number
  title: string
  kind: AddSlideV2Type
  /** The slide's original instruction (pre-fills the box); '' when none is known. */
  instruction: string
  /** How the slide was recognised as generated: a compose job this session, or the Director's slide context. */
  source: 'compose' | 'context'
  /** A refine of this slide is already running. */
  busy: boolean
}

export interface AddSlideV2RegenerateDraft {
  /** Content slides only; Auto keeps the slide's own shape. */
  contentSubtype: AddSlideV2ContentSubtype
  text: string
}

export function initialAddSlideV2RegenerateDraft(
  target: Pick<AddSlideV2RegenerateTarget, 'instruction'>,
  options: ReadonlySet<string> = ADD_SLIDE_V2_OPTIONS,
): AddSlideV2RegenerateDraft {
  const styles = availableAddSlideV2Subtypes(options)
  return {
    contentSubtype: styles.some(option => option.value === 'auto') ? 'auto' : (styles[0]?.value ?? 'auto'),
    text: target.instruction,
  }
}

export interface AddSlideV2RegenerateRequest<TTheme = unknown> {
  mode: 'regenerate'
  target: AddSlideV2RegenerateTarget
  /** null unless the target is a content slide. */
  contentSubtype: AddSlideV2ContentSubtype | null
  instruction: string
  /** 0-based VISUAL index the panel showed; the page checks it is still the selection at submit. */
  visualIndex: number
  sessionId: string | null
  presentationId: string | null
  research: AddSlideV2Research
  theme: TTheme
}

export type AddSlideV2RegenerateSubmitResult = { ok: true; jobId: string } | { ok: false; message: string }
export type AddSlideV2RegenerateSubmit<TTheme = unknown> = (request: AddSlideV2RegenerateRequest<TTheme>) => Promise<AddSlideV2RegenerateSubmitResult>

/** What the page knows about a regenerate job, in the vocabulary of the DEC-P5 state machine. */
export type AddSlideV2RegenerateJobStatus =
  | { status: 'building' }
  | { status: 'failed'; message: string }
  | { status: 'ready'; newSlideId: string }

export interface AddSlideV2RegenerateSettings<TTheme = unknown> {
  /** The slide on screen as a regenerate target, or null when it is not a generated slide the page can regenerate. */
  resolveTarget: (visualIndex: number, slides: ReadonlyArray<AddSlideV2SlideRow>) => AddSlideV2RegenerateTarget | null
  /** Absent while the refiner, the composer or its async mode is off: the section is shown but disabled. */
  submit?: AddSlideV2RegenerateSubmit<TTheme>
  /** null = the page no longer knows the job (for example after a reload). */
  jobStatus: (jobId: string) => AddSlideV2RegenerateJobStatus | null
}

/** Only the kinds the backend can keep: a hero stays a hero, so the target decides the type. */
export function addSlideV2RegenerateIsHero(kind: AddSlideV2Type): boolean {
  return kind !== 'content'
}

export const ADD_SLIDE_V2_KIND_LABEL: Record<AddSlideV2Type, string> = {
  title: 'Title',
  section: 'Section',
  closing: 'Closing',
  content: 'Content',
}

/** The kind a Director canvas type stands for: H1 title, H2 section, H3 closing, anything else content. */
export function addSlideV2KindFromCanvas(canvas: unknown): AddSlideV2Type {
  switch (String(canvas ?? '').trim().toUpperCase()) {
    case 'H1': return 'title'
    case 'H2': return 'section'
    case 'H3': return 'closing'
    default: return 'content'
  }
}

export function addSlideV2RegenerateBlocker(
  draft: AddSlideV2RegenerateDraft,
  target: AddSlideV2RegenerateTarget,
  context: Pick<AddSlideV2Context, 'sessionId'>,
  hasSubmit: boolean,
  options: ReadonlySet<string> = ADD_SLIDE_V2_OPTIONS,
): AddSlideV2Blocker | null {
  if (!options.has('regenerate')) return 'no-options'
  if (target.busy) return 'busy'
  if (target.kind === 'content' && !availableAddSlideV2Subtypes(options).some(option => option.value === draft.contentSubtype)) return 'no-options'
  const text = draft.text.trim()
  if (!text) return 'empty-text'
  if (addSlideV2RegenerateIsHero(target.kind) && countAddSlideV2Words(text) < ADD_SLIDE_V2_HERO_MIN_WORDS) return 'too-short'
  if (!context.sessionId) return 'no-session'
  if (!hasSubmit) return 'no-submit'
  return null
}

export function buildAddSlideV2RegenerateRequest<TTheme>(
  draft: AddSlideV2RegenerateDraft,
  target: AddSlideV2RegenerateTarget,
  context: AddSlideV2Context<TTheme>,
  options: ReadonlySet<string> = ADD_SLIDE_V2_OPTIONS,
): AddSlideV2RegenerateRequest<TTheme> | null {
  const blocker = addSlideV2RegenerateBlocker(draft, target, context, true, options)
  if (blocker || !context.sessionId) return null
  return {
    mode: 'regenerate',
    target,
    contentSubtype: target.kind === 'content' ? draft.contentSubtype : null,
    instruction: draft.text.trim(),
    visualIndex: Math.max(0, context.currentSlide - 1),
    sessionId: context.sessionId,
    presentationId: context.presentationId,
    research: { ...context.research },
    theme: context.theme,
  }
}

/** Wire body for POST /api/slides/refine before the async fields (job_id, async, assume_on_missing). */
export interface AddSlideV2RefineBody<TTheme = unknown> {
  session_id: string
  presentation_id: string | null
  slide_id: string
  slide_index: number
  instruction: string
  theme: TTheme
  selections?: AddSlideV2Selections
  research: AddSlideV2ComposeBody['research']
}

/**
 * The regenerate request as the refine wire body. `layoutIndex` is the REAL Layout index the page resolved at submit
 * (never the visual one). A hero kind sends its explicit hero selections, a content slide the chosen style, and Auto
 * sends none, so Director keeps the slide's own shape. An explicit Diagram forces all research off, as in Add.
 */
export function buildAddSlideV2RefineBody<TTheme>(
  request: AddSlideV2RegenerateRequest<TTheme>,
  layoutIndex: number,
): AddSlideV2RefineBody<TTheme> | null {
  if (!request.sessionId || !request.target.slideId) return null
  const selections = addSlideV2Selections(request.target.kind, request.contentSubtype)
  const researchOff = request.target.kind === 'content' && request.contentSubtype === 'diagram'
  const body: AddSlideV2RefineBody<TTheme> = {
    session_id: request.sessionId,
    presentation_id: request.presentationId,
    slide_id: request.target.slideId,
    slide_index: Math.max(0, layoutIndex),
    instruction: request.instruction,
    theme: request.theme,
    research: {
      use_uploaded_documents: !researchOff && request.research.useUploadedDocuments,
      use_web_search: !researchOff && request.research.useWebSearch,
      use_deep_research: !researchOff && request.research.useDeepResearch,
      use_knowledge_graph: !researchOff && request.research.useKnowledgeGraph,
      web_search_max_queries: ADD_SLIDE_V2_WEB_SEARCH_MAX_QUERIES,
    },
  }
  if (Object.keys(selections).length > 0) body.selections = selections
  return body
}

// ---- What the page remembers about slides it generated (the "existing compose metadata") -----------------------------
// A finished compose or refine job is removed from the page's job map, so on its own it cannot say which slide came
// from a job. The page records the slide id at slide_ready: the kind (from the request's canvas type), and the
// original instruction that pre-fills Regenerate. In memory for the session; deck-built slides are recognised by the
// Director's slide context instead (see resolveAddSlideV2RegenerateTarget in lib/studio-add-slide-v2-submit.ts).
export interface AddSlideV2GeneratedRecord {
  kind: AddSlideV2Type
  instruction: string
}

/** The slide fields of the Director's slide-context frame that Regenerate reads (hooks/use-deckster-websocket-v2.ts). */
export interface AddSlideV2ContextSlide {
  canvas_type?: string
  key_message?: string
}

export interface AddSlideV2GeneratedStore {
  /** real slide id -> what generated it */
  slides: Map<string, AddSlideV2GeneratedRecord>
  /** real slide id -> the Director's context for a slide the deck build generated (see rememberAddSlideV2DeckContext) */
  context: Map<string, AddSlideV2ContextSlide>
  /** job id -> the new slide id, for the jobs that finished (a finished job is removed from the page's job map) */
  completed: Map<string, string>
  /** job id -> why it failed: a failed refine is removed from the page's job map too (the page only toasts it) */
  failed: Map<string, string>
}

export const ADD_SLIDE_V2_GENERATED_MAX = 200
const ADD_SLIDE_V2_COMPLETED_MAX = 40
const ADD_SLIDE_V2_FAILED_MAX = 40
const ADD_SLIDE_V2_CONTEXT_MAX = 300
const ADD_SLIDE_V2_INSTRUCTION_MAX = 2000

export function createAddSlideV2GeneratedStore(): AddSlideV2GeneratedStore {
  return { slides: new Map(), context: new Map(), completed: new Map(), failed: new Map() }
}

function capMap<K, V>(map: Map<K, V>, max: number): void {
  while (map.size > max) {
    const oldest = map.keys().next()
    if (oldest.done) return
    map.delete(oldest.value)
  }
}

/**
 * Record a finished job: the new slide is generated, and a replaced slide no longer exists. The kind is the
 * request's canvas type; a request without one (Auto) keeps the replaced slide's kind.
 */
export function rememberAddSlideV2Generated(
  store: AddSlideV2GeneratedStore,
  input: { jobId: string; realSlideId: string; replacedSlideId?: string | null; request: Record<string, unknown> | null },
): void {
  const realSlideId = input.realSlideId.trim()
  if (!realSlideId) return
  const replaced = input.replacedSlideId ? store.slides.get(input.replacedSlideId) : undefined
  const selections = input.request?.selections
  const canvas = selections && typeof selections === 'object' ? (selections as Record<string, unknown>).canvas_type : undefined
  const instruction = typeof input.request?.instruction === 'string' ? input.request.instruction.trim().slice(0, ADD_SLIDE_V2_INSTRUCTION_MAX) : ''
  store.slides.delete(realSlideId)
  store.slides.set(realSlideId, {
    kind: canvas !== undefined ? addSlideV2KindFromCanvas(canvas) : (replaced?.kind ?? 'content'),
    instruction,
  })
  if (input.replacedSlideId && input.replacedSlideId !== realSlideId) store.slides.delete(input.replacedSlideId)
  if (input.jobId) {
    store.completed.delete(input.jobId)
    store.completed.set(input.jobId, realSlideId)
  }
  capMap(store.slides, ADD_SLIDE_V2_GENERATED_MAX)
  capMap(store.completed, ADD_SLIDE_V2_COMPLETED_MAX)
}

/** Record a failed regenerate job: the original slide was kept and `message` says why (never empty). */
export function rememberAddSlideV2Failed(store: AddSlideV2GeneratedStore, jobId: string, message: string | null | undefined): void {
  if (!jobId) return
  store.failed.delete(jobId)
  store.failed.set(jobId, (message ?? '').trim().slice(0, 300) || 'The slide could not be regenerated.')
  capMap(store.failed, ADD_SLIDE_V2_FAILED_MAX)
}

/**
 * The Director's slide context is keyed by BUILD position, so an insert, a delete or a reorder makes a position point at
 * a neighbour. The first time it lines up with the deck (one entry per slide) each slide's entry is remembered by slide
 * id, and from then on the id carries it. A deck that has already changed since the build is never guessed at: nothing
 * is remembered, so those slides are simply not regenerable. Slides already remembered keep their first entry.
 */
export function rememberAddSlideV2DeckContext(
  store: AddSlideV2GeneratedStore,
  slides: ReadonlyArray<AddSlideV2SlideRow>,
  contextByIndex: Record<number, AddSlideV2ContextSlide> | null,
): void {
  if (!contextByIndex || slides.length === 0 || Object.keys(contextByIndex).length !== slides.length) return
  slides.forEach((row, index) => {
    const slideId = row.slideId?.trim()
    const entry = contextByIndex[index]
    if (!slideId || !entry || store.context.has(slideId)) return
    store.context.set(slideId, { canvas_type: entry.canvas_type, key_message: entry.key_message })
  })
  capMap(store.context, ADD_SLIDE_V2_CONTEXT_MAX)
}
