"use client"

// CHAT COMMANDS (NEXT_PUBLIC_STUDIO_CHAT_COMMANDS, default off; needs NEXT_PUBLIC_STUDIO_CHAT_CLEAN and the Studio shell): the v3.1 composer's "/" command menu and "@" mention menu.
// Every decision is lib/studio-chat-commands.ts (pure); the wire is lib/studio-chat-commands-wire.ts. This file draws the two menus on the surface the composer's own "@" menu already uses
// (data-studio-composer-mentions: same card, same 11.5 / 9 px type, nothing larger than live) and wires each command to the REAL control's own handler:
//   /stop  -> the Send/Stop control's stop (studioChatClean.onStop)      /undo     -> a press on the Undo chip's own button      /export -> the export directive's runner (page)
//   /theme -> the theme popup's open state       /template -> the template popup's open state       /model  -> a press on the model gauge's own button
//   /research and /web -> the research options switches' own change handlers (same state, same lock)       /publish -> declines, with a button that presses Publish
// "@" grows the K1 slide picker into Slides · Element · Files · Templates · Themes. A pick writes a readable token into the text and registers its typed reference for the send.
// Nothing here is mounted or listened to with the flag off: ChatInput calls the hook through marked lines only, and the hook returns the inert constant.
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Copy, Download, FileText, Gauge, Globe, Layers, LayoutTemplate, MousePointerClick, Palette, Plus, Search, Share2, Square, Trash2, Undo2 } from 'lucide-react'
import { CHAT_MENTIONS } from '@/lib/mdc-flags'
import { STUDIO_CHAT_UNDO_ENABLED } from '@/lib/studio-bulk-edit-wire'
import { useTemplates } from '@/hooks/use-templates'
import {
  CHAT_COMMANDS_WORDS as W, CONTROL_SELECTORS, MENTION_SECTION_HEADINGS, buildMentionModel, commandRows, detectTrigger, moveHighlight, pressControl, researchAfter, researchNote,
  resolveCommand, textBefore, textWithMention, triggerKey,
  type ChatCommandId, type ChatCommandsPageProps, type CommandContext, type CommandRow, type CommandTrigger, type DeclineButton, type MentionItem, type MentionModel, type MentionSection,
  type MentionSource, type MentionTrigger, type Resolution, type RunAction,
} from '@/lib/studio-chat-commands'
import { STUDIO_CHAT_COMMANDS_ENABLED, registerCommand, registerMention } from '@/lib/studio-chat-commands-wire'
import '../studio-chat-commands.css'

// the model gauge is drawn only with this flag (components/model-choice/use-model-choice.ts STUDIO_MODEL_PICKER_ENABLED, the same literal read)
const MODEL_PICKER_ON = process.env.NEXT_PUBLIC_STUDIO_MODEL_CHOICE === 'true'

export interface CommandNote {
  id: number
  tone: 'cant-yet' | 'notice' | 'done'
  title: string
  body: string
  control: string | null
  button: { label: string; action: DeclineButton } | null
}

export interface StudioChatCommandsInput {
  /** null: the flag is off or the v3.1 composer is not on (the hook is then inert). */
  page: ChatCommandsPageProps | null
  text: string
  setText: (value: string) => void
  textareaRef: { current: HTMLTextAreaElement | null }
  /** The composer's Send/Stop control, and the page's stop handler behind it (build_control stop). */
  stop: { visible: boolean; enabled: boolean; run: () => void }
  popupsV2: boolean
  /** The theme popup's open handler as its trigger runs it (opens, and reads the saved themes). */
  openTheme: () => void
  themeBlocked: string | null
  /** The composer's template popup: opened through the composer's popup state with PASS2-COMPOSER-POPUPS, else through the control prop below. */
  openTemplatePopup: () => void
  template: { available: boolean; blocked: string | null; saved: boolean }
  research: { deep: boolean; web: boolean; locked: boolean; onDeep: (enabled: boolean) => void; onWeb: (enabled: boolean) => void; openOptions: () => void }
  files: Array<{ id: string; name: string; status?: string }>
  presets: Array<{ id: string; name: string }>
  saved: Array<{ id: string; name: string }>
  savedStatus: 'loading' | 'ready' | 'failed'
  refreshSaved: () => void
  disabled: boolean
}

export interface KeyEventLike {
  key: string
  shiftKey?: boolean
  preventDefault: () => void
  nativeEvent?: { isComposing?: boolean }
}

export interface StudioChatCommandsApi {
  active: boolean
  menu: React.ReactNode
  onKeyDown: (event: KeyEventLike) => boolean
  /** The template popup's control while the flag is on and PASS2-COMPOSER-POPUPS is not (else the composer's own). */
  templatePicker: { open?: boolean; onOpenChange?: (open: boolean) => void }
  textareaProps: Record<string, string | undefined>
}

const INERT: StudioChatCommandsApi = Object.freeze({ active: false, menu: null, onKeyDown: () => false, templatePicker: {}, textareaProps: {} }) as StudioChatCommandsApi
const LIST_ID = 'studio-chat-commands-list'
const optionId = (index: number) => `${LIST_ID}-option-${index}`

/** The composer's hook. All state is here; with the flag off (or no page props) it returns INERT and its effects do nothing. */
export function useStudioChatCommands(input: StudioChatCommandsInput): StudioChatCommandsApi {
  const enabled = STUDIO_CHAT_COMMANDS_ENABLED && input.page !== null && !input.disabled
  const [dismissed, setDismissed] = useState<string | null>(null)
  const [cursor, setCursor] = useState<{ sig: string; index: number }>({ sig: '', index: 0 })
  const [note, setNote] = useState<CommandNote | null>(null)
  const [templates, setTemplates] = useState<{ status: 'idle' | 'loading' | 'ready' | 'failed'; items: Array<{ id: string; name: string }> }>({ status: 'idle', items: [] })
  const [templateOpen, setTemplateOpen] = useState(false)
  const { listTemplates } = useTemplates()
  const noteSequence = useRef(0)
  const mounted = useRef(true)
  const templatesAsked = useRef(false)
  const savedAsked = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  const trigger = enabled ? detectTrigger(input.text) : null
  const key = triggerKey(trigger)
  useEffect(() => { if (!key) setDismissed(null) }, [key])

  // The lists an "@" pick shows are read only while the "@" menu is open, once each: the saved themes through the composer's own refresh (the theme popup's read), the saved templates through
  // the template popup's own list call (useTemplates().listTemplates). Nothing is read for a deck that has none of that on.
  const mentionOpen = enabled && trigger?.kind === 'mention' && dismissed !== key
  useEffect(() => {
    if (!mentionOpen) { templatesAsked.current = false; savedAsked.current = false; return }
    if (input.template.saved && templates.status !== 'ready' && !templatesAsked.current) {
      templatesAsked.current = true
      setTemplates(current => ({ ...current, status: 'loading' }))
      void listTemplates().then(res => {
        if (!mounted.current) return
        if (!res) { templatesAsked.current = false; setTemplates({ status: 'failed', items: [] }); return }
        setTemplates({ status: 'ready', items: res.templates.map(item => ({ id: item.id, name: item.name })) })
      }, () => { if (mounted.current) setTemplates({ status: 'failed', items: [] }) })
    }
    if (input.savedStatus !== 'ready' && !savedAsked.current) { savedAsked.current = true; input.refreshSaved() }
  }, [mentionOpen]) // eslint-disable-line react-hooks/exhaustive-deps -- once per opening of the menu

  const page = input.page
  const doc = typeof document !== 'undefined' ? document : null
  const ctx: CommandContext = {
    deck: { open: Boolean(page && page.slides.length > 0), slide: page?.currentSlide ?? null },
    stop: { visible: input.stop.visible, enabled: input.stop.enabled },
    undoOn: STUDIO_CHAT_UNDO_ENABLED,
    exportOn: Boolean(page?.exportDeck),
    themeBlocked: input.themeBlocked,
    template: { available: input.template.available, blocked: input.template.blocked },
    modelOn: MODEL_PICKER_ON,
    research: { locked: input.research.locked },
  }
  const source: MentionSource | null = enabled && page ? {
    slides: CHAT_MENTIONS ? page.slides : [],
    element: page.getElement(),
    files: input.files.filter(file => file.status !== 'uploading' && file.status !== 'error').map(file => ({ id: file.id, name: file.name, source: 'upload' as const })),
    templates: { status: input.template.saved ? templates.status : 'off', items: templates.items },
    presets: input.presets,
    saved: input.saved,
    savedStatus: input.savedStatus,
  } : null

  const rows: CommandRow[] = trigger?.kind === 'command' ? commandRows(trigger) : []
  const mention: MentionModel | null = trigger?.kind === 'mention' && source ? buildMentionModel(source, trigger.query) : null
  const count = trigger?.kind === 'command' ? rows.length : mention ? mention.items.length : 0
  const menuOpen = Boolean(enabled && trigger && dismissed !== key && (trigger.kind === 'command' ? rows.length > 0 : mention && (mention.items.length > 0 || mention.empty)))
  const sig = trigger ? `${key}|${trigger.kind === 'command' ? `${trigger.name} ${trigger.arg}` : trigger.query}` : ''
  const active = cursor.sig === sig && cursor.index < count ? cursor.index : 0

  useEffect(() => {
    if (!menuOpen || typeof document === 'undefined') return
    document.getElementById(optionId(active))?.scrollIntoView?.({ block: 'nearest' })
  }, [menuOpen, active, sig])

  // a note leaves by itself (a decline that carries a button stays a little longer)
  useEffect(() => {
    if (!note) return
    const timer = setTimeout(() => { if (mounted.current) setNote(current => (current && current.id === note.id ? null : current)) }, note.button ? 12000 : 8000)
    return () => clearTimeout(timer)
  }, [note?.id]) // eslint-disable-line react-hooks/exhaustive-deps -- one timer per note

  const focusEnd = () => {
    const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (callback: () => void) => setTimeout(callback, 0)
    raf(() => {
      const field = input.textareaRef.current
      if (!field) return
      field.focus?.({ preventScroll: true })
      const end = field.value.length
      field.setSelectionRange?.(end, end)
    })
  }
  const show = (next: Omit<CommandNote, 'id'>) => { if (mounted.current) setNote({ id: ++noteSequence.current, ...next }) }

  const press = (button: DeclineButton) => {
    if (button === 'open-research-options') { input.research.openOptions(); setNote(null); return }
    const result = pressControl(doc, CONTROL_SELECTORS.publish)
    if (result === 'clicked') setNote(null)
    else show({ tone: 'notice', title: W.publishNotReadyTitle, body: W.publishNotReadyBody, control: 'publish', button: null })
  }

  const run = (action: RunAction) => {
    switch (action) {
      case 'stop': input.stop.run(); return
      case 'theme': input.openTheme(); return
      case 'template': if (input.popupsV2) input.openTemplatePopup(); else setTemplateOpen(true); return
      case 'model': {
        const root = input.textareaRef.current?.closest?.('[data-studio-v4-composer]') ?? doc
        if (pressControl(root as never, CONTROL_SELECTORS.model) !== 'clicked') show({ tone: 'notice', title: W.modelNotReadyTitle, body: W.modelNotReadyBody, control: 'model', button: null })
        return
      }
      case 'undo': {
        if (pressControl(doc, CONTROL_SELECTORS.undo) === 'clicked') show({ tone: 'done', title: W.undoAsked, body: '', control: 'undo', button: null })
        else show({ tone: 'notice', title: W.undoNothingTitle, body: W.undoNothingBody, control: 'undo', button: null })
        return
      }
      case 'research':
      case 'web': {
        const next = researchAfter(action, input.research.deep, input.research.web)
        if (action === 'research') input.research.onDeep(next.deep)
        else input.research.onWeb(next.web)
        show({ tone: 'done', title: researchNote(next), body: '', control: action, button: null })
        return
      }
      case 'export:pdf':
      case 'export:pptx': {
        const format = action === 'export:pdf' ? 'pdf' : 'pptx'
        show({ tone: 'done', title: W.exportBusy(format), body: '', control: 'export', button: null })
        void Promise.resolve(page?.exportDeck?.(format)).then(result => {
          if (result?.status === 'done') show({ tone: 'done', title: W.exportDone(format), body: '', control: 'export', button: null })
          else if (result?.error_code === 'export_blocked') show({ tone: 'notice', title: W.exportBlockedTitle, body: W.exportBlockedBody, control: 'export', button: null })
          else show({ tone: 'notice', title: W.exportFailedTitle, body: W.exportFailedBody, control: 'export', button: null })
        }, () => show({ tone: 'notice', title: W.exportFailedTitle, body: W.exportFailedBody, control: 'export', button: null }))
        return
      }
    }
  }

  const execute = (resolution: Resolution, before: string) => {
    setDismissed(null)
    if (resolution.kind === 'prefill') {
      registerCommand(resolution.command, resolution.pattern)
      setNote(null)
      input.setText(`${before}${resolution.text}`)
      focusEnd()
      return
    }
    input.setText(before)
    if (resolution.kind === 'decline') {
      show({ tone: resolution.tone, title: resolution.title, body: resolution.body, control: resolution.control, button: resolution.button })
      focusEnd()
      return
    }
    setNote(null)
    run(resolution.action)
  }

  const pickCommand = (row: CommandRow) => {
    const at = trigger as CommandTrigger
    const before = textBefore(input.text, at)
    if (row.fill) { input.setText(`${before}/${row.id} `); focusEnd(); return }
    execute(resolveCommand(row.id as ChatCommandId, row.arg, ctx), before)
  }
  const pickMention = (item: MentionItem) => {
    const at = trigger as MentionTrigger
    if (item.reference) registerMention(item.token, item.reference)
    setNote(null)
    input.setText(textWithMention(input.text, at, item.token))
    focusEnd()
  }
  const pickAt = (index: number) => {
    if (trigger?.kind === 'command') { if (rows[index]) pickCommand(rows[index]) } else if (mention?.items[index]) pickMention(mention.items[index])
  }

  const onKeyDown = (event: KeyEventLike): boolean => {
    if (!enabled || event.nativeEvent?.isComposing) return false
    if (menuOpen) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        setCursor({ sig, index: moveHighlight(active, count, event.key === 'ArrowDown' ? 1 : -1) })
        return true
      }
      if ((event.key === 'Enter' || event.key === 'Tab') && !event.shiftKey && count > 0) { event.preventDefault(); pickAt(active); return true }
      if (event.key === 'Escape') { event.preventDefault(); setDismissed(key); return true }
      return false
    }
    if (note && event.key === 'Escape') { event.preventDefault(); setNote(null); return true }
    return false
  }

  if (!STUDIO_CHAT_COMMANDS_ENABLED || input.page === null) return INERT
  const menu = menuOpen && trigger
    ? <ChatCommandsMenu kind={trigger.kind} rows={rows} mention={mention} active={active} onPick={pickAt} onHover={index => setCursor({ sig, index })} />
    : note ? <ChatCommandsNote note={note} onButton={press} onDismiss={() => setNote(null)} /> : null
  return {
    active: true,
    menu,
    onKeyDown,
    templatePicker: input.popupsV2 ? {} : { open: templateOpen, onOpenChange: setTemplateOpen },
    textareaProps: menuOpen && count > 0 ? { 'aria-controls': LIST_ID, 'aria-activedescendant': optionId(active), 'aria-autocomplete': 'list' } : {},
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// The menus (presentation only)
// ---------------------------------------------------------------------------------------------------------------------

const COMMAND_ICONS: Record<ChatCommandId, React.ComponentType<{ className?: string }>> = {
  'add-slide': Plus, duplicate: Copy, delete: Trash2, theme: Palette, template: LayoutTemplate, model: Gauge, research: Search, web: Globe, export: Download, publish: Share2, undo: Undo2, stop: Square,
}
const SECTION_ICONS: Record<MentionSection, React.ComponentType<{ className?: string }>> = {
  slide: Layers, element: MousePointerClick, file: FileText, template: LayoutTemplate, theme: Palette,
}
const SURFACE = 'absolute bottom-full left-0 mb-1 w-full max-h-48 overflow-y-auto rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg z-50'
const HEADING = 'px-2.5 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500'
const ROW = 'w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800'

export interface ChatCommandsMenuProps {
  kind: 'command' | 'mention'
  rows: CommandRow[]
  mention: MentionModel | null
  active: number
  onPick: (index: number) => void
  onHover: (index: number) => void
}

export function ChatCommandsMenu({ kind, rows, mention, active, onPick, onHover }: ChatCommandsMenuProps) {
  const rowProps = (index: number) => ({
    id: optionId(index), type: 'button' as const, role: 'option' as const, tabIndex: -1, 'aria-selected': index === active, 'data-active': index === active ? 'true' : undefined,
    'data-studio-v4-type-role': 'mention-row',
    onMouseEnter: () => onHover(index),
    onMouseDown: (e: React.MouseEvent) => { e.preventDefault(); onPick(index) }, // pointer and touch: pick on press, keeping the composer's focus (the K1 menu's own rule)
    onClick: (e: React.MouseEvent) => { if (e.detail === 0) onPick(index) }, // assistive technology activation
    className: ROW,
  })
  if (kind === 'command') {
    return (
      <div data-studio-composer-mentions="true" data-studio-chat-commands-menu="commands" id={LIST_ID} role="listbox" aria-label="Commands" className={SURFACE}>
        <p role="presentation" data-studio-v4-type-role="mention-heading" data-studio-chat-commands-heading="commands" className={HEADING}>{W.commandsHeading}</p>
        {rows.map((row, index) => {
          const Icon = COMMAND_ICONS[row.id]
          return (
            <button key={row.key} {...rowProps(index)} data-studio-chat-command={row.id} aria-label={`${row.label}: ${row.blurb}`}>
              <Icon className="h-3 w-3 shrink-0" />
              <span data-studio-v4-type-role="mention-number" className="font-medium shrink-0">{row.label}</span>
              <span className="truncate text-gray-500 dark:text-slate-400">{row.blurb}</span>
            </button>
          )
        })}
        <p role="presentation" data-studio-composer-part="mention-hint">{W.hintMenu}</p>
      </div>
    )
  }
  const items = mention?.items ?? []
  const bySection: MentionSection[] = []
  for (const item of items) if (!bySection.includes(item.section)) bySection.push(item.section)
  return (
    <div data-studio-composer-mentions="true" data-studio-chat-commands-menu="mentions" id={LIST_ID} role="listbox" aria-label="Mention something" className={SURFACE}>
      {bySection.map(section => (
        <React.Fragment key={section}>
          <p role="presentation" data-studio-v4-type-role="mention-heading" data-studio-chat-commands-heading={section} className={HEADING}>{MENTION_SECTION_HEADINGS[section]}</p>
          {items.map((item, index) => {
            if (item.section !== section) return null
            const Icon = SECTION_ICONS[item.section]
            return (
              <button key={item.key} {...rowProps(index)} data-studio-chat-mention={item.section} aria-label={`Mention ${item.label}${item.hint ? `, ${item.hint}` : ''}`} title={item.hint || undefined}>
                <Icon className="h-3 w-3 shrink-0" />
                <span data-studio-v4-type-role="mention-number" className="font-medium shrink-0 max-w-[55%] truncate">{item.label}</span>
                <span className="truncate text-gray-500 dark:text-slate-400">{item.hint}</span>
              </button>
            )
          })}
        </React.Fragment>
      ))}
      {mention?.empty && <p data-studio-chat-commands-empty={mention.empty.section} role="status">{mention.empty.note}</p>}
      <p role="presentation" data-studio-composer-part="mention-hint">{W.hintMentions}</p>
    </div>
  )
}

export function ChatCommandsNote({ note, onButton, onDismiss }: { note: CommandNote; onButton: (action: DeclineButton) => void; onDismiss: () => void }) {
  return (
    <div data-studio-composer-mentions="true" data-studio-chat-commands-note={note.tone} data-studio-chat-commands-control={note.control ?? undefined} role="status" aria-live="polite" className={SURFACE}>
      <p data-studio-v4-type-role="mention-heading" data-studio-chat-commands-heading="note" className={HEADING}>{note.title}</p>
      {note.body ? <p data-studio-chat-commands-body="true">{note.body}</p> : null}
      {note.button || note.tone !== 'done' ? (
        <div data-studio-chat-commands-actions="true">
          {note.button ? <button type="button" data-studio-chat-commands-button={note.button.action} onMouseDown={e => e.preventDefault()} onClick={() => onButton(note.button!.action)}>{note.button.label}</button> : null}
          <button type="button" data-studio-chat-commands-dismiss="true" onMouseDown={e => e.preventDefault()} onClick={onDismiss}>{W.dismiss}</button>
        </div>
      ) : null}
    </div>
  )
}
