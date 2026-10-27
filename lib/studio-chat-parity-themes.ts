/**
 * CHAT-PARITY, THEMES group (rows 56-59, 61; NEXT_PUBLIC_STUDIO_CHAT_PARITY_THEMES): the executors of Director's theme requests. Each calls
 * the function the click path calls, handed in by the Builder page as `deps.themes`:
 *  - the composer palette's useThemeProfiles writes (saveTheme, setStandardTheme, clearStandardTheme, renameTheme) and its listThemes read;
 *  - the theme picker's own apply (the page's applyChatThemeSelection = handleBuildThemeChange without the build-selection lock) and the
 *    active-profile setter, answered from the page's own theme sync for a built deck (as runThemeDirective, lib/chat-theme-export.ts).
 * After a library write the page is told (CHAT_PARITY_THEME_LIBRARY_EVENT) so the composer palette re-reads its list.
 * Fonts are validated against the font-selection feature's own list (lib/theme-fonts.ts THEME_FONT_FAMILIES), DIRECTOR-2's point 3.
 */

import { applyThemeFontPolicy, setThemeFont, THEME_FONT_FAMILIES, THEME_FONT_SELECTION_ENABLED } from '@/lib/theme-fonts'
import { themeSelectionFingerprint, type BuildThemeSelection } from '@/lib/theme-builder'
import type { ThemeSyncState } from '@/lib/theme-sync'
import type { SavedThemeProfile, ThemeProfilesResponse } from '@/hooks/use-theme-profiles'
import { CHAT_PARITY_THEME_LIBRARY_EVENT, chatParityResult, chatParityThemeArgs, type ChatParityRequest, type ChatParityResultData } from '@/lib/studio-chat-parity'

export interface ChatParityActiveProfile { id: string; name: string; theme_payload: BuildThemeSelection }

/** What the page hands the theme executors: the click paths' own functions and reads. */
export interface ChatParityThemeDeps {
  listThemes: () => Promise<ThemeProfilesResponse | null>
  saveTheme: (args: { name: string; theme: BuildThemeSelection; setStandard?: boolean }) => Promise<SavedThemeProfile | null>
  setStandardTheme: (id: string) => Promise<SavedThemeProfile | null>
  clearStandardTheme: () => Promise<boolean>
  renameTheme: (id: string, name: string) => Promise<SavedThemeProfile | null>
  /** The selection the composer shows now (buildThemeSelectionRef.current). */
  currentSelection: () => BuildThemeSelection
  /** The page's applyChatThemeSelection; returns the selection it set. */
  apply: (selection: BuildThemeSelection) => BuildThemeSelection
  setActiveProfile: (profile: ChatParityActiveProfile | null) => void
  /** The page's theme guards at arrival (the theme directive's: a build, an outline, a template reuse or Template Mode lock the picker). */
  locks: () => { composerBlocked: boolean; composerFrozen: boolean; templateMode: boolean; generating: boolean }
  themeSync: () => ThemeSyncState
  wait: () => Promise<void>
  now: () => number
  /** Longer than the page's THEME_SYNC_TIMEOUT_MS, whose timer commits `failed` first. */
  timeoutMs: number
}

type Result = ChatParityResultData
const fail = (id: string, code: Parameters<typeof chatParityResult>[2]) => chatParityResult(id, 'failed', code)
const libraryChanged = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHAT_PARITY_THEME_LIBRARY_EVENT)) }

/** The runner's lock answer, as runThemeDirective: `theme_locked` for a build, an outline, a template reuse or Template Mode; `theme_failed` for a frozen composer. */
function lockRefusal(locks: ReturnType<ChatParityThemeDeps['locks']>): 'theme_locked' | 'theme_failed' | null {
  if (locks.composerBlocked && locks.composerFrozen) return 'theme_locked'
  if (locks.templateMode) return 'theme_locked'
  if (locks.composerBlocked) return 'theme_failed'
  if (locks.generating) return 'theme_locked'
  return null
}

/**
 * Applies `selection` through the picker's own apply and, for a built deck, waits for the page's theme sync to report it (as runThemeDirective).
 * With no deck on screen the selection is the coming build's and the answer is `done` at once.
 */
async function applyAndSettle(id: string, selection: BuildThemeSelection, presentationId: string | null, owns: () => boolean, deps: ChatParityThemeDeps, detail: Record<string, unknown>): Promise<Result> {
  const refusal = lockRefusal(deps.locks())
  if (refusal) return fail(id, refusal)
  const start = deps.themeSync()
  const applied = deps.apply(selection)
  if (!presentationId) return chatParityResult(id, 'done', null, detail)
  const fingerprint = themeSelectionFingerprint(applied)
  const deadline = deps.now() + deps.timeoutMs
  for (;;) {
    if (!owns()) return fail(id, 'not_owner')
    const sync = deps.themeSync()
    if (sync.presentationId === presentationId && sync.themeFingerprint === fingerprint) {
      if (sync.status === 'applied') return chatParityResult(id, 'done', null, detail)
      if (sync.status === 'failed' && sync !== start) return fail(id, 'theme_failed')
    }
    if (deps.now() >= deadline) return fail(id, 'timeout')
    await deps.wait()
  }
}

async function findTheme(deps: ChatParityThemeDeps, themeId: string): Promise<SavedThemeProfile | null> {
  const list = await deps.listThemes()
  return list?.themes.find(theme => theme.id === themeId) ?? null
}

/** Runs one theme request (the action is one of CHAT_PARITY_ACTIONS.themes) to a known status. */
export async function runChatParityThemeAction(request: ChatParityRequest, presentationId: string | null, owns: () => boolean, deps: ChatParityThemeDeps): Promise<Result> {
  const id = request.requestId
  const args = chatParityThemeArgs(request.action, request.args, THEME_FONT_FAMILIES)
  if (!args) return fail(id, 'invalid_args')
  switch (args.action) {
    case 'set_theme_fonts': {
      if (!THEME_FONT_SELECTION_ENABLED) return fail(id, 'flag_off')
      let next = deps.currentSelection()
      if (args.font_family) next = setThemeFont(next, 'font_family', args.font_family)
      if (args.font_family_heading) next = setThemeFont(next, 'font_family_heading', args.font_family_heading)
      return applyAndSettle(id, next, presentationId, owns, deps, { font_family: next.font_family ?? null, font_family_heading: next.font_family_heading ?? null })
    }
    case 'save_theme': {
      const theme = deps.currentSelection()
      if (theme.mode === 'auto') return fail(id, 'theme_auto')
      const saved = await deps.saveTheme({ name: args.name, theme, setStandard: args.set_standard })
      if (!saved?.id || !saved.theme_payload) return fail(id, 'write_failed')
      const payload = applyThemeFontPolicy(saved.theme_payload)
      deps.apply(payload)
      deps.setActiveProfile({ id: saved.id, name: saved.name, theme_payload: payload })
      libraryChanged()
      return chatParityResult(id, 'done', null, { theme_id: saved.id, name: saved.name, is_standard: saved.is_standard === true })
    }
    case 'set_standard_theme': {
      if (!(await findTheme(deps, args.theme_id))) return fail(id, 'not_found')
      const result = await deps.setStandardTheme(args.theme_id)
      if (!result || result.id !== args.theme_id || result.is_standard !== true) return fail(id, 'write_failed')
      libraryChanged()
      return chatParityResult(id, 'done', null, { theme_id: result.id, name: result.name })
    }
    case 'clear_standard_theme': {
      if (!(await deps.clearStandardTheme())) return fail(id, 'write_failed')
      libraryChanged()
      return chatParityResult(id, 'done')
    }
    case 'rename_theme': {
      if (!(await findTheme(deps, args.theme_id))) return fail(id, 'not_found')
      const result = await deps.renameTheme(args.theme_id, args.name)
      if (!result || result.id !== args.theme_id) return fail(id, 'write_failed')
      libraryChanged()
      return chatParityResult(id, 'done', null, { theme_id: result.id, name: typeof result.name === 'string' && result.name ? result.name : args.name })
    }
    case 'apply_saved_theme': {
      const profile = await findTheme(deps, args.theme_id)
      if (!profile) return fail(id, 'not_found')
      const payload = applyThemeFontPolicy(profile.theme_payload)
      if (!payload || typeof payload !== 'object' || payload.mode === 'auto') return fail(id, 'theme_failed')
      const refusal = lockRefusal(deps.locks())
      if (refusal) return fail(id, refusal)
      // The profile first, so the picker's apply (which keeps a profile that matches the selection) shows the saved theme's name.
      deps.setActiveProfile({ id: profile.id, name: profile.name, theme_payload: payload })
      return applyAndSettle(id, payload, presentationId, owns, deps, { theme_id: profile.id, name: profile.name })
    }
  }
}
