"use client"

// CHAT PARITY, WORKSPACE (NEXT_PUBLIC_STUDIO_CHAT_COMMANDS, default off; needs NEXT_PUBLIC_STUDIO_CHAT_CLEAN and the Studio shell): the composer's half of the workspace "/" commands (the "Workspace" group of the menu).
// lib/studio-chat-parity-workspace.ts decides every row (its words, whether it can run now, why not) and runs the command on the bus; this file is the glue the composer's hook calls through ONE marked line:
//   - it reads the bus's merged state the way the viewer commands read theirs (useSyncExternalStore), and gives back the rows;
//   - it owns the two parts only the composer can say: the appearance (next-themes: /dark /light /system) and the Version history row (the profile menu's own bridge: /history);
//   - it reads the saved templates the way the toolbar's picker does, only while "/template " is on screen, for "/template <name>";
//   - it registers the workspace runner on the viewer commands' bus, so a picked row runs through the same pickParity the viewer rows use (a disabled row or a hint row never runs).
// Nothing here is mounted or listened to with the flag off: the hook's effects return first, and the rows are an empty list.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { isTemplateGenerationReady, templateGenerationStatus, type SavedTemplate } from '@/hooks/use-templates'
import { STUDIO_VERSION_HISTORY_V2_ENABLED, versionHistoryBridge } from '@/lib/studio-version-history-v2'
import { registerParityRunner, type ParityRow } from '@/lib/studio-chat-parity-viewer'
import {
  NO_TEMPLATES, loadWorkspaceTemplates, publishWorkspaceState, registerWorkspacePart, runWorkspace, subscribeWorkspaceState, workspaceRows, workspaceStateSnapshot,
  type TemplateRules, type TemplatesState, type ThemeChoice,
} from '@/lib/studio-chat-parity-workspace'
import type { CommandTrigger } from '@/lib/studio-chat-commands'

registerParityRunner(runWorkspace) // a workspace row runs through the viewer commands' own pickParity -> runParity; this is the runner that answers it (a Set: loading this file twice adds nothing)

/** The picker's own short reason for a template it will not choose (components/builder/template-picker.tsx handleTemplateClick: the toast titles). */
const NOT_READY_WHY = Object.freeze({ failed: 'Template not ready', optimizing: 'Template optimizing', needs_cleanup: 'Template needs cleanup', needs_optimization: 'Template needs optimization', ready: '' })
const TEMPLATE_RULES: TemplateRules<SavedTemplate> = {
  composerLibrary: process.env.NEXT_PUBLIC_COMPOSER_LIBRARY_ENABLED === 'true',
  ready: template => isTemplateGenerationReady(template),
  why: template => NOT_READY_WHY[templateGenerationStatus(template)],
}

/** The saved templates, read once each time "/template " opens (the toolbar's picker reads them each time it opens), never while it is not on screen. */
function useWorkspaceTemplates(open: boolean, saved: boolean, list: () => Promise<{ templates: SavedTemplate[] } | null | undefined>): TemplatesState {
  const [state, setState] = useState<TemplatesState>({ status: 'idle', items: [] })
  const asked = useRef(false)
  const mounted = useRef(true)
  const listRef = useRef(list)
  listRef.current = list
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    if (!open || !saved) { asked.current = false; return }
    if (asked.current) return
    asked.current = true
    setState(current => ({ ...current, status: 'loading' }))
    void loadWorkspaceTemplates(() => listRef.current(), TEMPLATE_RULES).then(next => { if (mounted.current) setState(next) })
  }, [open, saved])
  return saved ? state : NO_TEMPLATES
}

const themeChoice = (value: string | undefined): ThemeChoice | null => (value === 'light' || value === 'dark' || value === 'system' ? value : null)

export interface ChatParityWorkspaceInput {
  /** The composer's own "the commands are on and this composer takes them" (the flag, the page's props, not disabled). */
  enabled: boolean
  trigger: CommandTrigger | null
  text: string
  /** The composer's template gate (its /template command's own): saved templates connected, and why the popup is out of reach. */
  template: { saved: boolean; blocked: string | null }
  /** The template popup's own list call (useTemplates().listTemplates). */
  listTemplates: () => Promise<{ templates: SavedTemplate[] } | null | undefined>
  /** The "/template " menu is not dismissed. */
  menuOpen: boolean
}

/** The composer's hook for the Workspace group: the rows for the trigger (an empty list with the flag off or for a trigger that is not a command). */
export function useChatParityWorkspace(input: ChatParityWorkspaceInput): ParityRow[] {
  const state = useSyncExternalStore(subscribeWorkspaceState, workspaceStateSnapshot, workspaceStateSnapshot)
  const appearance = useTheme()
  const live = useRef(appearance)
  live.current = appearance
  const trigger = input.enabled ? input.trigger : null
  const templates = useWorkspaceTemplates(Boolean(trigger && input.menuOpen && trigger.name.toLowerCase() === 'template' && trigger.arg !== null), input.template.saved, input.listTemplates)

  // the composer's own part: the appearance and the Version history row
  useEffect(() => {
    if (!input.enabled) return
    const off = registerWorkspacePart('composer', () => ({
      state: { theme: { choice: themeChoice(live.current.theme) }, history: { enabled: STUDIO_VERSION_HISTORY_V2_ENABLED, available: versionHistoryBridge.isAvailable() } },
      actions: { setTheme: (choice: ThemeChoice) => live.current.setTheme(choice), openHistory: () => versionHistoryBridge.open() },
    }))
    const stop = versionHistoryBridge.subscribe(() => publishWorkspaceState())
    return () => { stop(); off() }
  }, [input.enabled])
  useEffect(() => { if (input.enabled) publishWorkspaceState() }) // after every commit: the appearance may have changed; the bus tells the menu only when the merged state it shows changed

  if (!trigger) return []
  return workspaceRows({ name: trigger.name, arg: trigger.arg }, { state, draft: input.text.slice(0, trigger.start).trim() !== '', templates, templateBlocked: input.template.blocked })
}
