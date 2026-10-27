/**
 * FRONTEND-2, P3-1 A chat parity (NEXT_PUBLIC_STUDIO_CHAT_COMMANDS, default off): the composer's "/" command menu and "@" mention menu, the PURE half.
 * Everything the menus decide is here; components/builder/chat/studio-chat-commands.tsx draws and wires the real handlers; lib/studio-chat-commands-wire.ts holds the wire.
 *
 * Each of the twelve commands resolves to exactly ONE of three things, and none is ever faked:
 *   run       Studio already has a control for it; the composer calls that control's own handler (the table is COMMAND_HANDLERS, one line per command).
 *   prefill   the composer text becomes an editable request the Director already handles; nothing is sent until the user presses Send.
 *   decline   an honest note ("Can't do this from chat yet" / a plain reason) and, where there is one, a button that does the real thing.
 * A command whose control is not on in this build, or is locked right now, declines and names the control; it never fails silently.
 */

import { filterMentionSlides, mentionToken, type MentionSlide } from '@/lib/mdc-mentions'
import {
  elementToken, fileToken, templateToken, themeToken, mentionLabel,
  type ChatCommandWireName, type ElementMentionReference, type MentionReference,
} from '@/lib/studio-chat-commands-wire'

// ---- the page's part ------------------------------------------------------------------------------------------------------------------------

export type ExportFormat = 'pdf' | 'pptx'
/** What the page hands the composer, under the flag only. */
export interface ChatCommandsPageProps {
  /** The deck's slides (what the K1 slide mentions list). */
  slides: MentionSlide[]
  /** The slide on the canvas, 1-based; null when no deck is open. */
  currentSlide: number | null
  /** The one element reference Studio already builds for a send (NEXT_PUBLIC_CHAT_ELEMENT_REFINE); null when nothing is selected or the refine flag is off. Read when the menu draws. */
  getElement: () => ElementMentionReference | null
  /** The export directive's own runner (lib/chat-theme-export.ts runExportDirective: the Download menu's downloadPDF / downloadPPTX with its rule), answered as a status. */
  exportDeck: ((format: ExportFormat) => Promise<{ status: string; error_code: string | null }>) | null
}

// ---- the words (one place) ------------------------------------------------------------------------------------------------------------------

export const CHAT_COMMANDS_WORDS = Object.freeze({
  cantYet: "Can't do this from chat yet",
  commandsHeading: 'Commands',
  hintMenu: 'Enter or Tab chooses · Esc closes',
  hintMentions: 'Enter or Tab chooses the highlighted one · Esc closes',
  dismiss: 'Dismiss',
  publishBody: "Publishing from chat isn't ready yet. The Publish button shares this deck.",
  publishButton: 'Open Publish',
  publishNotReadyTitle: 'Publish is not ready',
  publishNotReadyBody: 'The Publish button opens once the deck is built.',
  researchButton: 'Show research options',
  noDeckTitle: 'Open a deck first',
  nothingBuildingTitle: 'Nothing is building',
  nothingBuildingBody: 'There is no build running to stop.',
  alreadyStoppingTitle: 'Already stopping',
  alreadyStoppingBody: 'Director is finishing the stop. The finished slides are kept.',
  undoOffBody: "Undo from chat isn't turned on in this build.",
  undoNothingTitle: 'Nothing to undo right now',
  undoNothingBody: "Director hasn't recorded a change you can undo, or it was already undone.",
  undoAsked: 'Asked Director to undo the last change.',
  exportOffBody: "Export from chat isn't available in this build.",
  exportBusy: (format: ExportFormat) => `Preparing your ${format === 'pdf' ? 'PDF' : 'PowerPoint'}…`,
  exportDone: (format: ExportFormat) => `Your ${format === 'pdf' ? 'PDF' : 'PowerPoint'} download started.`,
  exportBlockedTitle: "Export isn't ready yet",
  exportBlockedBody: 'The Download menu opens up once the deck is built. Finish or stop the build first.',
  exportFailedTitle: "Couldn't export",
  exportFailedBody: 'Try the Download menu on the deck.',
  themeLockedTitle: 'Theme is locked',
  templateOffBody: "Templates aren't turned on in this build.",
  templateLockedTitle: 'Template is locked',
  modelOffBody: "The model picker isn't turned on in this build.",
  modelNotReadyTitle: "Model choice isn't ready",
  modelNotReadyBody: 'Wait for the deck to load, then try again.',
  researchLockedTitle: 'Locked for this deck',
  researchLockedBody: 'Research already ran, so these switches can no longer change. Start a new session to change them.',
  noSlidesBody: (what: string) => `There is no slide to ${what} yet. Build or open a deck, then try again.`,
  noFiles: 'No files in this deck yet. Attach one with the paperclip.',
  noElement: 'Select an element on the slide first.',
  noTemplates: 'No saved templates to mention yet.',
  noThemes: 'No themes to mention yet.',
  noSlides: 'No slides in this deck yet.',
  loading: 'Loading…',
  failed: "Couldn't load this list.",
})

// ---- the "/" commands -----------------------------------------------------------------------------------------------------------------------

export type ChatCommandId =
  | 'add-slide' | 'duplicate' | 'delete' | 'theme' | 'template' | 'model' | 'research' | 'web' | 'export' | 'publish' | 'undo' | 'stop'

export interface ChatCommandDef {
  id: ChatCommandId
  name: string
  blurb: string
  /** How it resolves when it can (a run command can still decline when its control is off or locked right now). */
  how: 'run' | 'prefill' | 'decline'
  args?: readonly ExportFormat[]
}

/** PK's list, in his order (PROGRAM-1, 27 Oct). */
export const CHAT_COMMANDS: readonly ChatCommandDef[] = Object.freeze([
  { id: 'add-slide', name: '/add-slide', blurb: 'Add a slide after this one', how: 'prefill' },
  { id: 'duplicate', name: '/duplicate', blurb: 'Duplicate this slide', how: 'prefill' },
  { id: 'delete', name: '/delete', blurb: 'Delete this slide', how: 'prefill' },
  { id: 'theme', name: '/theme', blurb: 'Choose a theme', how: 'run' },
  { id: 'template', name: '/template', blurb: 'Reuse a template', how: 'run' },
  { id: 'model', name: '/model', blurb: 'Choose how deeply Director thinks', how: 'run' },
  { id: 'research', name: '/research', blurb: 'Turn deep research on or off', how: 'run' },
  { id: 'web', name: '/web', blurb: 'Turn web search on or off', how: 'run' },
  { id: 'export', name: '/export', blurb: 'Download as PDF or PowerPoint', how: 'run', args: ['pdf', 'pptx'] },
  { id: 'publish', name: '/publish', blurb: 'Publish or share this deck', how: 'decline' },
  { id: 'undo', name: '/undo', blurb: 'Undo the last change', how: 'run' },
  { id: 'stop', name: '/stop', blurb: 'Stop the build', how: 'run' },
] as ChatCommandDef[])

/** The real handler behind each run command (the proof reads these from the sources). */
export const COMMAND_HANDLERS: Readonly<Record<string, string>> = Object.freeze({
  stop: 'the Send/Stop control: ChatInput studioChatClean.onStop = the Builder page chatCleanStop (sendBuildControl stop)',
  undo: "the Undo chip's own button (components/builder/chat/studio-undo-chip.tsx onClick: undo(changeId, messageId) = sendStudioUndo)",
  export: "the export directive's runner (lib/chat-theme-export.ts runExportDirective: the Download menu's downloadPDF / downloadPPTX)",
  theme: "the theme popup's own open state (ChatInput setThemeOpen + refreshSavedThemes)",
  template: "the template popup's own open state (TemplatePicker open / onOpenChange)",
  model: "the model gauge's own button (components/model-choice/model-slider.tsx trigger)",
  research: "the research options switch (ChatInput onResearchEnabledChange = the Builder page handleResearchEnabledChange)",
  web: "the research options switch (ChatInput onWebSearchEnabledChange = the Builder page handleWebSearchEnabledChange)",
  publish: "the Publish button (components/publish-dialog.tsx PublishControls trigger)",
})

// ---- triggers -------------------------------------------------------------------------------------------------------------------------------

export interface CommandTrigger { kind: 'command'; start: number; name: string; arg: string | null }
export interface MentionTrigger { kind: 'mention'; start: number; query: string }
export type MenuTrigger = CommandTrigger | MentionTrigger

/** "/" at the start of the text or after whitespace, then a name, then (after one space) an argument, all at the end of the text. */
const COMMAND_RE = /(^|\s)\/([\w-]*)(?: ([\w-]*))?$/
/** The composer's own K1 "@" expression, unchanged. */
const MENTION_RE = /@([\w ]{0,30})$/

export function detectTrigger(text: string): MenuTrigger | null {
  if (typeof text !== 'string') return null
  const mention = MENTION_RE.exec(text)
  if (mention) return { kind: 'mention', start: mention.index, query: mention[1] ?? '' }
  const command = COMMAND_RE.exec(text)
  if (command) return { kind: 'command', start: command.index + command[1].length, name: command[2] ?? '', arg: command[3] === undefined ? null : command[3] }
  return null
}

export const triggerKey = (trigger: MenuTrigger | null): string | null => (trigger ? `${trigger.kind}:${trigger.start}` : null)

export interface CommandRow {
  key: string
  id: ChatCommandId
  label: string
  blurb: string
  arg: ExportFormat | null
  /** Picking fills the text with "/name " (so the arguments show) instead of running. */
  fill: boolean
}

/** The rows for a "/" trigger: type to filter (names that start with it first, then names that contain it); after "/export " the formats. */
export function commandRows(trigger: CommandTrigger): CommandRow[] {
  if (trigger.arg !== null) {
    const command = CHAT_COMMANDS.find(item => item.id === trigger.name.toLowerCase())
    if (!command?.args) return []
    const typed = trigger.arg.toLowerCase()
    return command.args.filter(arg => arg.startsWith(typed)).map(arg => ({
      key: `${command.id}:${arg}`, id: command.id, label: `${command.name} ${arg}`, arg, fill: false,
      blurb: arg === 'pdf' ? 'Download the deck as a PDF' : 'Download the deck as a PowerPoint',
    }))
  }
  const name = trigger.name.toLowerCase()
  const starts = CHAT_COMMANDS.filter(command => command.id.startsWith(name))
  const contains = name ? CHAT_COMMANDS.filter(command => !command.id.startsWith(name) && command.id.includes(name)) : []
  return [...starts, ...contains].map(command => ({ key: command.id, id: command.id, label: command.name, blurb: command.blurb, arg: null, fill: Boolean(command.args) }))
}

// ---- resolving a command --------------------------------------------------------------------------------------------------------------------

export interface CommandContext {
  deck: { open: boolean; slide: number | null }
  stop: { visible: boolean; enabled: boolean }
  /** NEXT_PUBLIC_STUDIO_CHAT_UNDO (the Undo chip's flag). */
  undoOn: boolean
  /** The page gave the composer the export runner. */
  exportOn: boolean
  /** null = the theme popup is available; else why it is not (its trigger is disabled). */
  themeBlocked: string | null
  template: { available: boolean; blocked: string | null }
  /** NEXT_PUBLIC_STUDIO_MODEL_CHOICE (the gauge button is drawn only with it). */
  modelOn: boolean
  research: { locked: boolean }
}

export type RunAction = 'stop' | 'undo' | 'export:pdf' | 'export:pptx' | 'theme' | 'template' | 'model' | 'research' | 'web'
export type DeclineButton = 'open-publish' | 'open-research-options'

export type Resolution =
  | { kind: 'prefill'; text: string; command: ChatCommandWireName; pattern: RegExp }
  | { kind: 'run'; action: RunAction }
  | { kind: 'decline'; tone: 'cant-yet' | 'notice'; title: string; body: string; control: string | null; button: { label: string; action: DeclineButton } | null }

const W = CHAT_COMMANDS_WORDS
const decline = (tone: 'cant-yet' | 'notice', title: string, body: string, control: string | null = null, button: { label: string; action: DeclineButton } | null = null): Resolution =>
  ({ kind: 'decline', tone, title, body, control, button })
const cantYet = (body: string, control: string | null = null, button: { label: string; action: DeclineButton } | null = null) => decline('cant-yet', W.cantYet, body, control, button)

/** The one thing a "/" command does right now. Pure: the availability comes in as `ctx`; the handlers are called by the composer. */
export function resolveCommand(id: ChatCommandId, arg: ExportFormat | null, ctx: CommandContext): Resolution {
  switch (id) {
    case 'add-slide':
    case 'duplicate':
    case 'delete': {
      const slide = ctx.deck.open && ctx.deck.slide ? ctx.deck.slide : null
      if (!slide) return decline('notice', W.noDeckTitle, W.noSlidesBody(id === 'add-slide' ? 'add after' : id === 'duplicate' ? 'duplicate' : 'delete'))
      if (id === 'add-slide') return { kind: 'prefill', text: `Add a slide after slide ${slide} about `, command: 'add_slide', pattern: /^\s*Add a slide after slide \d+/ }
      if (id === 'duplicate') return { kind: 'prefill', text: `Duplicate slide ${slide}`, command: 'duplicate_slide', pattern: /^\s*Duplicate slide \d+/ }
      return { kind: 'prefill', text: `Delete slide ${slide}`, command: 'delete_slide', pattern: /^\s*Delete slide \d+/ }
    }
    case 'stop':
      if (!ctx.stop.visible) return decline('notice', W.nothingBuildingTitle, W.nothingBuildingBody, 'stop')
      if (!ctx.stop.enabled) return decline('notice', W.alreadyStoppingTitle, W.alreadyStoppingBody, 'stop')
      return { kind: 'run', action: 'stop' }
    case 'undo':
      return ctx.undoOn ? { kind: 'run', action: 'undo' } : cantYet(W.undoOffBody, 'undo')
    case 'export':
      if (!ctx.exportOn) return cantYet(W.exportOffBody, 'export')
      return { kind: 'run', action: arg === 'pptx' ? 'export:pptx' : 'export:pdf' }
    case 'theme':
      return ctx.themeBlocked ? decline('notice', W.themeLockedTitle, ctx.themeBlocked, 'theme') : { kind: 'run', action: 'theme' }
    case 'template':
      if (!ctx.template.available) return cantYet(W.templateOffBody, 'template')
      return ctx.template.blocked ? decline('notice', W.templateLockedTitle, ctx.template.blocked, 'template') : { kind: 'run', action: 'template' }
    case 'model':
      return ctx.modelOn ? { kind: 'run', action: 'model' } : cantYet(W.modelOffBody, 'model')
    case 'research':
    case 'web':
      return ctx.research.locked
        ? decline('notice', W.researchLockedTitle, W.researchLockedBody, id, { label: W.researchButton, action: 'open-research-options' })
        : { kind: 'run', action: id }
    case 'publish':
      return cantYet(W.publishBody, 'publish', { label: W.publishButton, action: 'open-publish' })
  }
}

/** What the two research switches read after the command, by the Builder's own rules (handleResearchEnabledChange: deep on turns web on; handleWebSearchEnabledChange: web off turns deep off). */
export function researchAfter(action: 'research' | 'web', deep: boolean, web: boolean): { deep: boolean; web: boolean } {
  if (action === 'research') { const next = !deep; return { deep: next, web: next ? true : web } }
  const next = !web
  return { deep: next ? deep : false, web: next }
}

export function researchNote(state: { deep: boolean; web: boolean }): string {
  return `Deep research ${state.deep ? 'on' : 'off'} · Web search ${state.web ? 'on' : 'off'}`
}

/** The text after a "/" command is taken out: whatever was typed before it stays. */
export const textBefore = (text: string, trigger: MenuTrigger): string => text.slice(0, trigger.start)

// ---- pressing a real control ----------------------------------------------------------------------------------------------------------------

export const CONTROL_SELECTORS = Object.freeze({
  undo: '[data-studio-chat-undo="idle"]',
  publish: '[data-studio-publish-trigger]',
  model: 'button[data-mpick="gauge"]',
})

export type ControlResult = 'clicked' | 'missing' | 'disabled'

interface Pressable { disabled?: boolean; getAttribute?: (name: string) => string | null; click: () => void; getClientRects?: () => { length: number } }
interface Searchable { querySelectorAll?: (selector: string) => ArrayLike<Pressable>; querySelector?: (selector: string) => Pressable | null }

/** Press the first VISIBLE control that matches (the same click a user makes, so the control's own handler runs); 'disabled' when it is there but cannot be pressed. */
export function pressControl(scope: Searchable | null | undefined, selector: string): ControlResult {
  if (!scope) return 'missing'
  const found: Pressable[] = scope.querySelectorAll ? Array.from(scope.querySelectorAll(selector)) : (scope.querySelector?.(selector) ? [scope.querySelector(selector) as Pressable] : [])
  const visible = found.filter(el => !el.getClientRects || el.getClientRects().length > 0)
  if (!visible.length) return found.length ? 'disabled' : 'missing'
  const usable = visible.find(el => el.disabled !== true && el.getAttribute?.('aria-disabled') !== 'true')
  if (!usable) return 'disabled'
  usable.click()
  return 'clicked'
}

// ---- the "@" mentions -----------------------------------------------------------------------------------------------------------------------

export type MentionSection = 'slide' | 'element' | 'file' | 'template' | 'theme'

export const MENTION_SECTION_HEADINGS: Readonly<Record<MentionSection, string>> = Object.freeze({
  slide: 'Slides', element: 'Element', file: 'Files', template: 'Templates', theme: 'Themes',
})

export interface MentionSource {
  /** Slides only with NEXT_PUBLIC_CHAT_MENTIONS (the K1 reference path parses the token). */
  slides: MentionSlide[]
  element: ElementMentionReference | null
  files: Array<{ id: string; name: string; source: 'upload' | 'second_brain' }>
  templates: { status: 'off' | 'idle' | 'loading' | 'ready' | 'failed'; items: Array<{ id: string; name: string }> }
  presets: Array<{ id: string; name: string }>
  saved: Array<{ id: string; name: string }>
  savedStatus: 'loading' | 'ready' | 'failed'
}

export interface MentionItem {
  key: string
  section: MentionSection
  label: string
  hint: string
  token: string
  /** null for a slide: K1 parses its token on send. */
  reference: MentionReference | null
}

const SECTION_WORDS: Record<string, MentionSection> = {
  slide: 'slide', slides: 'slide', element: 'element', elements: 'element', file: 'file', files: 'file', template: 'template', templates: 'template', theme: 'theme', themes: 'theme',
}

/** "slide 3" / "file report" / "theme": a leading section word narrows the list to that section and the rest filters it. */
export function parseMentionQuery(query: string): { section: MentionSection | null; rest: string } {
  const text = typeof query === 'string' ? query.trim() : ''
  const first = text.split(' ')[0]?.toLowerCase() ?? ''
  const section = SECTION_WORDS[first]
  return section ? { section, rest: text.slice(first.length).trim() } : { section: null, rest: text }
}

const contains = (name: string, rest: string) => !rest || name.toLowerCase().includes(rest.toLowerCase())

export interface MentionModel {
  items: MentionItem[]
  /** The section the user named ("@file"), when it has nothing to show: said plainly instead of closing. */
  empty: { section: MentionSection; note: string } | null
  narrowed: MentionSection | null
}

export function buildMentionModel(source: MentionSource, query: string): MentionModel {
  const { section: narrowed, rest } = parseMentionQuery(query)
  const limit = (section: MentionSection) => (narrowed === section ? 12 : section === 'slide' ? 5 : 3)
  const want = (section: MentionSection) => narrowed === null || narrowed === section
  const items: MentionItem[] = []
  if (want('slide')) {
    for (const slide of filterMentionSlides(source.slides, rest).slice(0, limit('slide'))) {
      items.push({ key: `slide:${slide.index}`, section: 'slide', label: `Slide ${slide.index + 1}`, hint: slide.title, token: mentionToken(slide), reference: null })
    }
  }
  if (want('element') && source.element && (narrowed === 'element' || contains(source.element.label, rest) || 'element'.startsWith(rest.toLowerCase()))) {
    const element = source.element
    items.push({ key: `element:${element.element_id}`, section: 'element', label: 'Selected element', hint: element.label, token: elementToken(element.label), reference: element })
  }
  if (want('file')) {
    for (const file of source.files.filter(item => contains(item.name, rest)).slice(0, limit('file'))) {
      items.push({ key: `file:${file.id}`, section: 'file', label: file.name, hint: file.source === 'second_brain' ? 'Second brain' : 'Uploaded', token: fileToken(file.name),
        reference: { kind: 'file', file_id: file.id, name: mentionLabel(file.name) || 'file', source: file.source } })
    }
  }
  if (want('template')) {
    for (const template of source.templates.items.filter(item => contains(item.name, rest)).slice(0, limit('template'))) {
      items.push({ key: `template:${template.id}`, section: 'template', label: template.name, hint: 'Template', token: templateToken(template.name),
        reference: { kind: 'template', template_id: template.id, name: mentionLabel(template.name) || 'template' } })
    }
  }
  if (want('theme')) {
    const themes = [
      ...source.saved.filter(item => contains(item.name, rest)).map(item => ({ ...item, source: 'saved' as const })),
      ...source.presets.filter(item => contains(item.name, rest)).map(item => ({ ...item, source: 'preset' as const })),
    ].slice(0, limit('theme'))
    for (const theme of themes) {
      items.push({ key: `theme:${theme.source}:${theme.id}`, section: 'theme', label: theme.name, hint: theme.source === 'saved' ? 'Saved theme' : 'Preset theme', token: themeToken(theme.name, theme.source),
        reference: { kind: 'theme', theme_id: theme.id, name: mentionLabel(theme.name) || 'theme', source: theme.source } })
    }
  }
  let empty: MentionModel['empty'] = null
  if (!items.length && narrowed) {
    const note = narrowed === 'file' ? W.noFiles
      : narrowed === 'element' ? W.noElement
      : narrowed === 'slide' ? W.noSlides
      : narrowed === 'template' ? (source.templates.status === 'loading' || source.templates.status === 'idle' ? W.loading : source.templates.status === 'failed' ? W.failed : W.noTemplates)
      : (source.savedStatus === 'loading' ? W.loading : W.noThemes)
    empty = { section: narrowed, note }
  }
  return { items, empty, narrowed }
}

/** What picking a mention does to the text: the "@…" the user typed becomes the token and a space. */
export const textWithMention = (text: string, trigger: MentionTrigger, token: string): string => `${text.slice(0, trigger.start)}${token} `

/** Move the highlight (wraps at both ends). */
export function moveHighlight(index: number, count: number, direction: 1 | -1): number {
  if (count <= 0) return 0
  return (index + direction + count) % count
}
