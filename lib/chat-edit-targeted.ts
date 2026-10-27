/**
 * FRONTEND-2 (B33, 27 Oct; PK 18:19Z: "chat element edits touch only the target element; never trigger Edit Mode whole-deck autosave"): targeted chat edit
 * (NEXT_PUBLIC_STUDIO_CHAT_EDIT_TARGETED_SAVE, exact "true", default off, read at build time; it acts only with NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT on).
 *
 * Root cause (layout-builder uat @ 05cf75d). Every save Layout's editor makes is a WHOLE-DECK save: src/utils/auto-save.js buildSaveRequest() (~264) collects
 * every `.reveal .slides > section`, collectSlideContent() -> collectTextBoxes() (~525) collects every `.inserted-textbox` on each, and the layout text
 * direct-element-creator.js draws from slide.content on EVERY slide at load (viewer/presentation-viewer.html ~1300 createElementsForTemplate: title,
 * eyebrow, footer, Sources) are `.inserted-textbox`es that are not stored as text boxes. PUT /api/presentations/{id}/slides (server.py update_all_slides)
 * stores each slide's collections wholesale. #522's runner (lib/chat-element-edit.ts) enters edit mode, runs the viewer commands (each marks its slide
 * changed: auto-save.js markContentChanged, debounced triggerSave) and flushes with the viewer's saveAllChanges (edit-mode.js: markContentChanged(null,
 * 'manual_save') + forceSave), so one chat edit on slide 2 wrote "Auto-save from editor" with every slide's layout text stored as text boxes (E2E-2,
 * session 57f9e99a, deck 1343a54f, 27 Oct 17:15Z: snapshot r46).
 *
 * With the flag on, step 6 of the runner go through Layout's targeted save (layout-builder frontend2/layout-targeted-save, LAYOUT_CHAT_TARGETED_SAVE_ENABLED):
 * beginTargetedElementSave {elementId, slideIndex} (the viewer holds its slide's change marks, so no whole-deck save is scheduled), the SAME viewer
 * commands, then commitTargetedElementSave {saveId} (the viewer collects that one element with auto-save.js's own collector and Layout stores only it).
 * `ok:true` means Layout answered the commit saved. No saveAllChanges, no save-ack watch. A manual Edit Mode change is not touched (PROD-LATER).
 * Layout's flag off: begin answers "Unknown action", so the edit is refused UNSUPPORTED_OP before any command changes anything (never a silent ok:true).
 *
 * Import-free (types only), so the proof runs it under plain node. Flag off: nothing here runs.
 */
import type { ElementEditErrorCode, ElementEditResultData } from '@/lib/chat-element-edit-wire'

export const CHAT_EDIT_TARGETED_SAVE_ENABLED = process.env.NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT === 'true'
  && process.env.NEXT_PUBLIC_STUDIO_CHAT_EDIT_TARGETED_SAVE === 'true'

/** Layout's targeted save commands (chat_targeted_save.py ACTIONS). */
export const TARGETED_SAVE_COMMANDS = {
  begin: 'beginTargetedElementSave',
  commit: 'commitTargetedElementSave',
  cancel: 'cancelTargetedElementSave',
} as const

export interface TargetedStep {
  route: 'element' | 'textbox'
  action: string
  params: Record<string, unknown>
}

export interface TargetedSaveContext {
  directiveId: string
  elementId: string
  slideIndex: number
  steps: ReadonlyArray<TargetedStep>
  /** The runner's owner check: false once the session, deck or epoch on screen changed (nothing may be sent then). */
  owns: () => boolean
  currentSlideIndex: () => number
  sendElement: (action: string, params: Record<string, unknown>) => Promise<any>
  sendTextBox: (action: string, params: Record<string, unknown>) => Promise<any>
  /** The runner's own mapping of a viewer command's error (lib/chat-element-edit.ts elementEditCommandErrorCode). */
  commandErrorCode: (error: unknown) => ElementEditErrorCode
  /** Called once the first command changed the slide (the runner's `applied`). */
  markApplied: () => void
}

const messageOf = (error: unknown): string => {
  const raw = typeof error === 'string' ? error : (error as { message?: unknown } | null)?.message
  return typeof raw === 'string' ? raw : ''
}

/** The error of a begin: Layout's refusals (src/utils/chat-targeted-save.js), else the runner's own mapping ("Unknown action" = Layout's flag off = UNSUPPORTED_OP). */
export function beginErrorCode(error: unknown, commandErrorCode: (error: unknown) => ElementEditErrorCode): ElementEditErrorCode {
  const message = messageOf(error)
  if (message === 'Another targeted save is open') return 'BUSY'
  if (message === 'Element is not on that slide') return 'SLIDE_CHANGED'
  if (message === 'This element type is not saved on its own') return 'UNSUPPORTED_OP'
  if (message === 'Auto-save is not available') return 'VIEWER_NOT_READY'
  return commandErrorCode(error)
}

const okReply = (reply: any) => {
  if (reply && reply.success === false) throw new Error(typeof reply.error === 'string' ? reply.error : 'Command failed')
  return reply
}

/** Step 6 of the runner with the flag on: begin, the plan's commands, commit. Returns the result to send, or null when nothing may be sent. */
export async function runTargetedElementSave(ctx: TargetedSaveContext): Promise<ElementEditResultData | null> {
  const fail = (code: ElementEditErrorCode): ElementEditResultData => ({ directive_id: ctx.directiveId, ok: false, error_code: code })
  let saveId: string | null = null
  const cancel = async () => {
    if (!saveId) return
    const held = saveId
    saveId = null
    try { await ctx.sendTextBox(TARGETED_SAVE_COMMANDS.cancel, { saveId: held }) } catch { /* the scope also closes on its own */ }
  }
  try {
    const begun = okReply(await ctx.sendTextBox(TARGETED_SAVE_COMMANDS.begin, { elementId: ctx.elementId, slideIndex: ctx.slideIndex }))
    saveId = typeof begun?.saveId === 'string' && begun.saveId ? begun.saveId : null
    if (!saveId) throw new Error('Command failed')
  } catch (error) {
    return ctx.owns() ? fail(beginErrorCode(error, ctx.commandErrorCode)) : null
  }
  let applied = false
  for (const step of ctx.steps) {
    if (!ctx.owns()) { await cancel(); return null }
    if (ctx.currentSlideIndex() !== ctx.slideIndex) { await cancel(); return fail(applied ? 'SAVE_FAILED' : 'SLIDE_CHANGED') }
    try {
      okReply(await (step.route === 'element' ? ctx.sendElement : ctx.sendTextBox)(step.action, step.params))
    } catch (error) {
      await cancel()
      return ctx.owns() ? fail(applied ? 'SAVE_FAILED' : ctx.commandErrorCode(error)) : null
    }
    applied = true
    ctx.markApplied()
  }
  if (!ctx.owns()) { await cancel(); return null }
  const held = saveId
  saveId = null
  try {
    okReply(await ctx.sendTextBox(TARGETED_SAVE_COMMANDS.commit, { saveId: held }))
  } catch {
    return ctx.owns() ? fail('SAVE_FAILED') : null
  }
  return ctx.owns() ? { directive_id: ctx.directiveId, ok: true } : null
}
