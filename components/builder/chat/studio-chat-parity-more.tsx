"use client"

// CHAT PARITY, MORE (NEXT_PUBLIC_STUDIO_CHAT_PARITY_COMMANDS, default off; needs NEXT_PUBLIC_STUDIO_CHAT_COMMANDS, NEXT_PUBLIC_STUDIO_CHAT_CLEAN and the Studio shell): the composer's half of the remaining "/" commands and the two picks that were declines (/publish, @template).
// lib/studio-chat-parity-more.ts decides every row (its words, whether it can run now, why not) and runs the command; this file is the glue the composer's hook calls through ONE marked line:
//   - it reads the model gauge's state from the bus the gauge's own hook registers on (useSyncExternalStore), the suggested templates from the template-match store, and the saved themes and templates the way the toolbar and the Themes page read them;
//   - it hands the lib the browser calls it may use (the router, a new tab, the hand-off write, the Publish press, the template switch) on every commit;
//   - it registers the runner on the viewer commands' bus, so a picked row runs through the same pickParity the other rows use (a disabled row or a hint row never runs);
//   - it gives the composer the two picks that are not rows: /publish presses the Publish button, and a picked @template is chosen the way /template <name> chooses it.
// Nothing here is mounted or listened to with the flag off: the effects return first, and the rows are an empty list.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { isTemplateGenerationReady, templateGenerationStatus, type SavedTemplate } from '@/hooks/use-templates'
import { studioTemplateMatchStore, switchTemplate } from '@/hooks/use-studio-template-match'
import { pickerAvailable } from '@/lib/studio-template-match'
import { COMPOSER_TEMPLATE_DELETE_REASON, isUserOwnedLibraryItem } from '@/lib/studio-library-manage'
import { studioKgAskCheck } from '@/lib/studio-kg-ask'
import { CONTROL_SELECTORS, pressControl, type CommandTrigger } from '@/lib/studio-chat-commands'
import { registerParityRunner, runParity, subscribeViewerState, viewerStateSnapshot, type ParityResult, type ParityRow } from '@/lib/studio-chat-parity-viewer'
import { loadWorkspaceTemplates, type TemplateRules } from '@/lib/studio-chat-parity-workspace'
import { putBrowserHandoff } from '@/lib/studio-chat-parity-more-handoff'
import {
  MORE_WORDS, moreRows, openPublish, runMore, setMoreLive, subscribeMoreModel, moreModelSnapshot, templateMentionRun,
  type MoreEnv, type MoreListStatus, type MoreTemplateChoice,
} from '@/lib/studio-chat-parity-more'

registerParityRunner(runMore) // a row of this half runs through the viewer commands' own pickParity -> runParity; this is the runner that answers it (a Set: loading this file twice adds nothing)

const THEME_DELETE_ON = process.env.NEXT_PUBLIC_STUDIO_THEME_LIBRARY_MANAGE === 'true' // the Themes page draws Delete only with this flag
const TEMPLATE_DELETE_ON = process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_LIBRARY_MANAGE === 'true' // the Templates page, the same
const ASK_ON = process.env.NEXT_PUBLIC_STUDIO_KG_ASK === 'true' && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' // the Knowledge page draws the Ask box with both (app/(app)/knowledge/page.tsx KG_ASK)
const MODEL_ON = process.env.NEXT_PUBLIC_STUDIO_MODEL_CHOICE === 'true' // the gauge is drawn only with this flag
const LAUNCH_WORDING = process.env.NEXT_PUBLIC_STUDIO_LAUNCH_WORDING === 'true' // the Templates page's own wording for a Composer template (templates-workspace.tsx)

/** The picker's own short reason for a template it will not choose (components/builder/template-picker.tsx handleTemplateClick: the toast titles), as the workspace half reads it. */
const NOT_READY_WHY = Object.freeze({ failed: 'Template not ready', optimizing: 'Template optimizing', needs_cleanup: 'Template needs cleanup', needs_optimization: 'Template needs optimization', ready: '' })
const TEMPLATE_RULES: TemplateRules<SavedTemplate> = {
  composerLibrary: false, // a Composer template is a row here too (the Templates page lists it, with Delete disabled and its reason)
  ready: template => isTemplateGenerationReady(template),
  why: template => NOT_READY_WHY[templateGenerationStatus(template)],
}
const MENTION_RULES: TemplateRules<SavedTemplate> = { ...TEMPLATE_RULES, composerLibrary: process.env.NEXT_PUBLIC_COMPOSER_LIBRARY_ENABLED === 'true' } // the toolbar's own list

type ListTemplates = () => Promise<{ templates: SavedTemplate[] } | null | undefined>

/** The saved templates as delete rows: the Templates page's own reasons for a row it will not delete. */
async function loadDeleteChoices(list: ListTemplates): Promise<{ status: MoreListStatus; items: MoreTemplateChoice[] }> {
  try {
    const res = await list()
    if (!res || !Array.isArray(res.templates)) return { status: 'failed', items: [] }
    const items = res.templates.filter(template => typeof template.id === 'string' && typeof template.name === 'string').map((template): MoreTemplateChoice => ({
      id: template.id, name: template.name,
      why: 'stage_template_summary' in template ? (LAUNCH_WORDING ? "Composer templates can't be deleted here." : COMPOSER_TEMPLATE_DELETE_REASON) : isUserOwnedLibraryItem(template) ? null : MORE_WORDS.notYours,
    }))
    return { status: 'ready', items }
  } catch { return { status: 'failed', items: [] } }
}

export interface ChatParityMoreInput {
  /** The composer's own "the chat parity commands are on and this composer takes them" (the commands flag, the chain's flag, the page's props, not disabled): the hook's parityOn. Off, this hook returns no rows and no picks, writes no hand-off and registers nothing. */
  enabled: boolean
  /** The signed-in account (its user id), or null: a hand-off is written for that account only, and with none it is not written. */
  account: string | null
  trigger: CommandTrigger | null
  /** The "/" menu is not dismissed. */
  menuOpen: boolean
  /** The composer's Send is Stop: a build is running. */
  building: boolean
  /** The saved themes the composer already reads (the theme popup's read), the state of that read, and the read itself. */
  saved: Array<{ id: string; name: string }>
  savedStatus: 'loading' | 'ready' | 'failed'
  refreshSaved: () => void
  /** The composer's template gate: saved templates are connected. */
  templateSaved: boolean
  /** The template popup's own list call (useTemplates().listTemplates). */
  listTemplates: ListTemplates
}

export interface ChatParityMoreApi {
  rows: ParityRow[]
  /** A picked "@" template: chosen like the toolbar chooses it, answered as a note. Null with the commands off. */
  template: ((id: string) => Promise<ParityResult>) | null
  /** /publish: presses the Publish button (the wizard opens; publishing stays a click in it). Null with the commands off. */
  publish: (() => ParityResult) | null
}
const INERT: ChatParityMoreApi = Object.freeze({ rows: [], template: null, publish: null }) as ChatParityMoreApi

/** The App Router, or null outside one (a fixture, the proofs' harness render the composer with none): the page is then opened with a plain navigation. useRouter throws without a router, after reading its context, so the hooks stay in the same order. */
function useOptionalRouter(): { push: (path: string) => void } | null {
  try { return useRouter() } catch { return null }
}

export function useChatParityMore(input: ChatParityMoreInput): ChatParityMoreApi {
  const router = useOptionalRouter()
  const model = useSyncExternalStore(subscribeMoreModel, moreModelSnapshot, moreModelSnapshot)
  const viewer = useSyncExternalStore(subscribeViewerState, viewerStateSnapshot, viewerStateSnapshot)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const trigger = input.enabled ? input.trigger : null
  const name = trigger?.name.toLowerCase() ?? ''
  const open = Boolean(trigger && input.menuOpen && trigger.arg !== null)

  // the saved themes: read again each time "/delete-theme " opens (the theme popup reads them each time it opens)
  const themesAsked = useRef(false)
  const askThemes = open && name === 'delete-theme'
  useEffect(() => {
    if (!askThemes) { themesAsked.current = false; return }
    if (themesAsked.current) return
    themesAsked.current = true
    input.refreshSaved()
  }, [askThemes]) // eslint-disable-line react-hooks/exhaustive-deps -- once per opening of the menu

  // the saved templates: read once each time "/delete-template " opens (the toolbar's picker reads them each time it opens)
  const [templates, setTemplates] = useState<{ status: MoreListStatus; items: MoreTemplateChoice[] }>({ status: 'idle', items: [] })
  const templatesAsked = useRef(false)
  const listRef = useRef(input.listTemplates)
  listRef.current = input.listTemplates
  const askTemplates = open && name === 'delete-template' && input.templateSaved
  useEffect(() => {
    if (!askTemplates) { templatesAsked.current = false; return }
    if (templatesAsked.current) return
    templatesAsked.current = true
    setTemplates(current => ({ ...current, status: 'loading' }))
    void loadDeleteChoices(() => listRef.current()).then(next => { if (mounted.current) setTemplates(next) })
  }, [askTemplates])

  const snapshot = studioTemplateMatchStore.getSnapshot() // the suggested templates Director sent; the store is empty with its flag off
  const env: MoreEnv = {
    themes: { status: input.savedStatus, items: input.saved },
    templates: input.templateSaved ? templates : { status: 'ready', items: [] },
    model, modelOn: MODEL_ON,
    match: pickerAvailable(snapshot.frame) ? snapshot.rows.map(row => ({ templateId: row.templateId, name: row.name, inUse: row.inUse })) : [],
    flags: { themeDelete: THEME_DELETE_ON, templateDelete: TEMPLATE_DELETE_ON, ask: ASK_ON },
    checkQuestion: text => { const checked = studioKgAskCheck(text); return checked.ok ? { ok: true, question: checked.question } : { ok: false, message: checked.message } },
  }
  const live = useRef({ env, building: input.building, viewer, account: input.account })
  live.current = { env, building: input.building, viewer, account: input.account }
  useEffect(() => {
    if (!input.enabled) return
    setMoreLive({
      env: () => live.current.env, building: () => live.current.building, viewer: () => live.current.viewer, handoff: request => putBrowserHandoff({ ...request, account: live.current.account }),
      go: path => { if (router) router.push(path); else window.location.assign(path) }, openTab: path => { window.open(path, '_blank', 'noopener') },
      pressPublish: () => pressControl(document, CONTROL_SELECTORS.publish), switchTemplate,
    })
  }) // after every commit: the handles always read this render's state
  useEffect(() => () => setMoreLive(null), [])

  if (!input.enabled) return INERT
  return {
    rows: trigger ? moreRows({ name: trigger.name, arg: trigger.arg }, env) : [],
    publish: () => openPublish(() => pressControl(document, CONTROL_SELECTORS.publish)),
    template: async id => {
      const state = await loadWorkspaceTemplates(() => listRef.current(), MENTION_RULES) // the toolbar reads the list when its picker opens; the full record is what handleSelectTemplate takes
      const answer = templateMentionRun(state, id)
      if ('note' in answer) return { ok: false, note: answer.note }
      return runParity(answer.run as never, { building: live.current.building, choosePreset: () => {}, showCanvas: null }) // the workspace half's own select: its block, its handler, what it saw
    },
  }
}
