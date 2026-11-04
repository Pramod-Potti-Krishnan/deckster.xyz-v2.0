/**
 * FRONTEND-2 (B42, 28 Oct; E2E-2 batch 2, rows 37 and 38, Studio dev, 21:11Z): targeted chat add, a chat element ADD saves only the new element and never sets off the editor's
 * whole-deck autosave (NEXT_PUBLIC_STUDIO_CHAT_ADD_TARGETED_SAVE, exact "true", default off, read at build time). The add-side twin of #540 (lib/chat-edit-targeted.ts), which covers the element EDIT.
 *
 * Root cause (layout-builder uat @ 92c0bbb4). The chat add runs the Element panel's own pipeline (app/builder/page.tsx elementDirectiveRunnerRef -> handleApprovedTextLabsGenerate ->
 * hooks/use-textlabs-generation.ts handleGenerate, invocation kind 'chat-add'), whose insert reaches the viewer as insertTextBox / insertImage / insertChart ...; lib/studio-insert-persist.ts
 * (NEXT_PUBLIC_STUDIO_INSERT_PERSIST) first puts the viewer in edit mode, so the insert's change mark (element-manager.js triggerAutoSave -> auto-save.js markContentChanged) schedules the
 * editor's debounced save (2.5 s). That save is a WHOLE-DECK save: auto-save.js buildSaveRequest() collects every `.reveal .slides > section`, and collectTextBoxes() collects every
 * `.inserted-textbox` on each, including the layout text direct-element-creator.js draws from slide.content on every slide (title, section label, footer, Sources), which is not stored as
 * text boxes. PUT /api/presentations/{id}/slides stores each slide's collections wholesale, so one chat add wrote "Auto-save from editor" with 16 layout text boxes stored on all 4 slides.
 *
 * With the flag on, each viewer insert of a chat add goes through Layout's targeted save (chat_targeted_save.py, LAYOUT_CHAT_TARGETED_SAVE_ENABLED; the add twin of what #540 does for edits):
 *   1. openChatAddScope: Layout's begin needs an element that is already on the slide, and the new one is not there yet. So the scope is opened on an element that is (any text box, image,
 *      chart, infographic or diagram of the slide, read with getSlideGenerationContext): beginTargetedElementSave holds the slide's change marks, so the insert schedules no whole-deck save;
 *   2. the hook sends the insert, as today (edit mode, the same command, the same parameters);
 *   3. finish: cancelTargetedElementSave closes the anchor's scope (its held marks are dropped, nothing is saved for the anchor), then the NEW element, named by the insert's own answer (Layout
 *      names a new text box itself, so the id comes from the response), gets its own scope and commit through #540's runTargetedElementSave with no steps: begin, commit, and a commit slower
 *      than Layout's 3 s reply is read as pending until lib/chat-edit-targeted.ts TARGETED_SAVE_COMMIT_TIMEOUT_MS (20 s). Layout PUTs only that element's record
 *      (.../slides/{i}/elements/{id}/chat-save): the stored deck gains that one element and nothing else.
 * The placeholder: a chat add inserts none (handleGenerate: `blankId = invocation ? null : ...`; a chat add is dismissed while the Element panel holds one), so none can be stored; and the
 * commit carries the record of the one element named by the insert's answer, so no other element on the slide (a blank placeholder included) can be in the save.
 *
 * Fallbacks (the add is then saved exactly as today, by the editor's autosave, and says so through ctx.report): Layout's targeted save is off (begin answers "Unknown action"), the host has
 * no text box command route, the slide has no element to hold the marks with, another targeted save is open, or the insert is not one Layout stores on its own (a cited table upsert ...).
 * Never a silent ok: a save that was started and is not confirmed (Layout refused it, or it was still unknown after 20 s) throws and the add is reported failed. The element that was never stored
 * is taken off the slide again under a scope that holds the delete's change mark too (discard), so the removal does not schedule a whole-deck save either; if even that fails the hook's own
 * rollback deletes it, as it always did (today's path, a failure path only). An add that changed owner mid-way sends nothing more.
 * The manual Add Element panel never reaches this (the call site requires invocation kind 'chat-add'). A manual Edit Mode change is not touched (PROD-LATER).
 *
 * Imports only #540's targeted-save module (which imports types only), so the proof runs it under plain node. Flag off: nothing here runs.
 */
import { TARGETED_SAVE_COMMANDS, runTargetedElementSave } from '@/lib/chat-edit-targeted'

export const CHAT_ADD_TARGETED_SAVE_ENABLED = process.env.NEXT_PUBLIC_STUDIO_CHAT_ADD_TARGETED_SAVE === 'true'

/**
 * The viewer inserts of a chat add whose element is one of the classes Layout's targeted save stores on its own (src/utils/chat-targeted-save.js TYPES): insertTextBox (TEXT_BOX, METRICS, SHAPE, ICON_LABEL), insertChart (CHART)
 * and insertImage (IMAGE). The seven types a chat add can make (lib/mdc-element-directive.ts DIRECTIVE_TYPES) reach no other store-on-its-own insert; a cited TABLE or metrics upsert (upsertCitedElement) is saved as today.
 */
export const CHAT_ADD_TARGETED_INSERTS: ReadonlySet<string> = new Set(['insertTextBox', 'insertImage', 'insertChart'])

/** getSlideGenerationContext's `renderer_type` of the elements an anchor may be (the registry types of those five classes). */
const ANCHOR_RENDERERS: ReadonlySet<string> = new Set(['textbox', 'image', 'chart', 'infographic', 'diagram'])

export const CHAT_ADD_NOT_SAVED_MESSAGE = 'The new element could not be saved on its own, so it was not kept. Nothing else in the deck was changed. Try again.'
export const CHAT_ADD_CHANGED_MESSAGE = 'The presentation viewer changed while the new element was being saved.'

export type ChatAddSaveNote = { saved: 'targeted' } | { saved: 'editor-autosave'; reason: string }

export interface ChatAddScopeContext {
  slideIndex: number
  /** The viewer command the hook is about to send (the insert). */
  insertAction: string
  /** The hook's own element command sender (lease checked): the slide read. */
  sendElement: (action: string, params: Record<string, unknown>) => Promise<any>
  /** The viewer's text box command route (layoutServiceApis.sendTextBoxCommand), which carries Layout's begin / commit / cancel / status; null when the host has none. */
  sendTextBox: ((action: string, params: Record<string, unknown>) => Promise<any>) | null
  /** The generation's owner check: false once the presentation or viewer on screen changed (nothing more may be sent then). */
  owns: () => boolean
  /** Waits `ms` (the page's timer); defaults to setTimeout. */
  wait?: (ms: number) => Promise<void>
  /** Where the add ends up: saved on its own, or the reason today's whole-deck path was kept. */
  report?: (note: ChatAddSaveNote) => void
}

export interface ChatAddScope {
  /** After the insert answered with `elementId`: closes the anchor's scope, then saves only that element. Resolves once it is stored; throws when it is not (or the owner changed). */
  finish: (elementId: string) => Promise<void>
  /** Closes the scope without saving (the insert failed). Never throws; a scope already closed is left alone. */
  cancel: () => Promise<void>
  /** True once a save that failed has taken the unsaved element off the slide again (so the caller's own rollback must not delete it a second time). */
  readonly removed: boolean
}

const messageOf = (error: unknown): string => {
  const raw = typeof error === 'string' ? error : (error as { message?: unknown } | null)?.message
  return typeof raw === 'string' ? raw : ''
}

const okReply = (reply: any) => {
  if (reply && reply.success === false) throw new Error(typeof reply.error === 'string' ? reply.error : 'Command failed')
  return reply
}

/** The element to hold the slide's marks with: the first element of the slide's generation context whose class Layout stores on its own. */
export function chatAddAnchorOf(context: any): string | null {
  const elements = context && context.success !== false && Array.isArray(context.elements) ? context.elements : []
  for (const element of elements) {
    const id = typeof element?.element_id === 'string' ? element.element_id : ''
    if (id && ANCHOR_RENDERERS.has(String(element?.renderer_type ?? '').toLowerCase())) return id
  }
  return null
}

/**
 * Called before the hook sends a chat add's insert. Returns the open scope, or null when the add is to be saved as today (the reason goes to ctx.report); nothing is held then.
 */
export async function openChatAddScope(ctx: ChatAddScopeContext): Promise<ChatAddScope | null> {
  const today = (reason: string): null => { ctx.report?.({ saved: 'editor-autosave', reason }); return null }
  if (!CHAT_ADD_TARGETED_INSERTS.has(ctx.insertAction)) return today(`${ctx.insertAction} is not saved on its own`)
  const sendTextBox = ctx.sendTextBox
  if (!sendTextBox) return today('the viewer has no text box command route')
  let found: string | null
  try {
    found = chatAddAnchorOf(await ctx.sendElement('getSlideGenerationContext', { slideIndex: ctx.slideIndex }))
  } catch (error) {
    return today(`the slide could not be read: ${messageOf(error) || 'no answer'}`)
  }
  if (!found) return today('the slide has no element to hold its change marks with')
  const anchorId: string = found
  let saveId: string | null
  try {
    const begun = okReply(await sendTextBox(TARGETED_SAVE_COMMANDS.begin, { elementId: anchorId, slideIndex: ctx.slideIndex }))
    saveId = typeof begun?.saveId === 'string' && begun.saveId ? begun.saveId : null
    if (!saveId) throw new Error('Command failed')
  } catch (error) {
    return today(`Layout's targeted save is not available: ${messageOf(error) || 'no answer'}`)
  }
  let open: string | null = saveId
  let removed = false
  const close = async () => {
    if (!open) return
    const held = open
    open = null
    try { await sendTextBox(TARGETED_SAVE_COMMANDS.cancel, { saveId: held }) } catch { /* the scope also closes on its own (Layout's 30 s TTL) */ }
  }
  /** A save that failed leaves an element on screen that was never stored. It is taken off again under a scope that holds the delete's change mark (the anchor's), so the removal does not schedule a whole-deck save either. */
  const discard = async (elementId: string) => {
    let held: string | null = null
    try {
      const begun = okReply(await sendTextBox(TARGETED_SAVE_COMMANDS.begin, { elementId: anchorId, slideIndex: ctx.slideIndex }))
      held = typeof begun?.saveId === 'string' && begun.saveId ? begun.saveId : null
      if (!held) return
      okReply(await ctx.sendElement('deleteElement', { elementId }))
      removed = true
    } catch { /* the caller's own rollback then tries, as it always did */ } finally {
      if (held) try { await sendTextBox(TARGETED_SAVE_COMMANDS.cancel, { saveId: held }) } catch { /* closes on its own */ }
    }
  }
  if (!ctx.owns()) { await close(); return today('the presentation changed') }
  return {
    cancel: close,
    get removed() { return removed },
    finish: async (elementId: string) => {
      await close()
      if (!ctx.owns()) throw new Error(CHAT_ADD_CHANGED_MESSAGE)
      const result = await runTargetedElementSave({
        directiveId: 'chat-add', elementId, slideIndex: ctx.slideIndex, steps: [], owns: ctx.owns, currentSlideIndex: () => ctx.slideIndex,
        sendElement: ctx.sendElement, sendTextBox, commandErrorCode: () => 'SAVE_FAILED', markApplied: () => {}, ...(ctx.wait ? { wait: ctx.wait } : {}),
      })
      if (result === null) throw new Error(CHAT_ADD_CHANGED_MESSAGE)
      if (!result.ok) {
        if (ctx.owns()) await discard(elementId)
        throw new Error(CHAT_ADD_NOT_SAVED_MESSAGE)
      }
      ctx.report?.({ saved: 'targeted' })
    },
  }
}
