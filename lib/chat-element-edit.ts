/**
 * FRONTEND-2 Pass 3 (P3-1 A, chat parity): edit an element from chat (NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT, exact "true", default off, read at build
 * time), the RUNNER half. The wire half (flag, caps, frame routing, result frame) is lib/chat-element-edit-wire.ts; the viewer's save acknowledgement is
 * lib/chat-element-edit-save.ts.
 *
 * Director's `element_edit` {op: delete | order | place | style} runs through the presentation viewer's OWN element commands, the postMessage commands the
 * editor toolbar and the element panels send, never a server PATCH (Layout renders element content at creation only). The viewer commands, read from the
 * Layout viewer (viewer/presentation-viewer.html), are:
 *   read      getSlideGenerationContext {slideIndex, targetElementId}  the element, its renderer / component type, its grid box, its locked flag
 *   delete    deleteElement {elementId}
 *   order     bringTextBoxToFront / sendTextBoxToBack {elementId}      front, back (ElementManager.bringToFront / sendToBack: any element)
 *   place     resizeTextBox {elementId, gridRow, gridColumn}           the only command that sets a grid position (a textbox-rendered element)
 *   style     setTextBoxFontWeight / setTextBoxFontSize / setTextBoxColor {themeBinding} / setTextBoxAlignment (a TEXT_BOX), size read with getTextBoxFormatting
 * What the viewer has NO command for is UNSUPPORTED_OP, never faked: order forward / backward (Layout has no one-step z-order command), italic (Layout
 * has no whole-box italic setter; applyTextFormatCommand formats the current text selection), place / style on an element type those commands do not
 * serve, and Studio's own Arrange tab commands bringToFront / bringForward / sendBackward / alignElement / positionElement (Studio sends them; the Layout
 * viewer has no such case).
 *
 * `ok:true` means SAVED. Layout's autosave drops changes made outside edit mode and does not track a z-order change at all, so the runner enters edit mode
 * the way selecting an element does, then flushes with the viewer's own `saveAllChanges` (the toolbar's Save) and waits for the viewer's `saveStatusChanged`
 * acknowledgement that came after the change was tracked (watchViewerSave). No ack in time, or an error ack: SAVE_FAILED. One result per directive_id;
 * a stale socket or owner sends nothing.
 */

import {
  ELEMENT_EDIT_ALIGNS, ELEMENT_EDIT_ANCHORS, ELEMENT_EDIT_OPS, ELEMENT_EDIT_ORDERS, elementEditFields,
} from '@/lib/chat-element-edit-wire'
import type {
  ElementEditAnchor, ElementEditDirectiveMessage, ElementEditDirectiveOwner, ElementEditErrorCode, ElementEditOrder, ElementEditResultData,
} from '@/lib/chat-element-edit-wire'
import { watchViewerSave } from '@/lib/chat-element-edit-save'
import type { SaveWatchTimers, ViewerSaveEvent } from '@/lib/chat-element-edit-save'
import { FREE_SPOT_BOUNDS, parseFreeSpotSpan } from '@/lib/element-free-spot'

export {
  CHAT_ELEMENT_EDIT_ENABLED, ELEMENT_EDIT_CLIENT_CAPS, ELEMENT_EDIT_DIRECTIVE_TYPE, addChatElementEditCaps, elementEditDirectiveId, elementEditResultFrame,
} from '@/lib/chat-element-edit-wire'
export type {
  ElementEditDirectiveMessage, ElementEditDirectiveOwner, ElementEditErrorCode, ElementEditResultData,
} from '@/lib/chat-element-edit-wire'

/** The viewer commands this change sends (and no others). */
export const VIEWER_COMMANDS = {
  readSlide: 'getSlideGenerationContext',
  readFormatting: 'getTextBoxFormatting',
  deleteElement: 'deleteElement',
  front: 'bringTextBoxToFront',
  back: 'sendTextBoxToBack',
  place: 'resizeTextBox',
  bold: 'setTextBoxFontWeight',
  size: 'setTextBoxFontSize',
  color: 'setTextBoxColor',
  align: 'setTextBoxAlignment',
  flushSave: 'saveAllChanges',
} as const

/** Element ids over this length are not a real element (Director !511's reference rule). */
export const ELEMENT_EDIT_ID_MAX = 128
/** Budget for the viewer's save acknowledgement after the change: Layout's autosave retries 3 times, a second apart. */
export const ELEMENT_EDIT_SAVE_TIMEOUT_MS = 20_000
/** Studio's own font-size list (components/textbox-format-panel/style-tab.tsx FONT_SIZES); size_step moves one place along it. */
export const FONT_SIZE_STEPS: readonly number[] = [12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96, 115, 120]
/** The deck theme palette tokens (hooks/use-deck-theme-palette.ts DeckThemeToken.id): the only colours a chat edit may bind. */
export const PALETTE_BINDINGS: readonly string[] = [
  '--theme-primary', '--theme-accent-1', '--theme-accent-2', '--theme-surface', '--theme-text-heading', '--theme-text-body',
]

// ---- the directive, validated before the viewer is touched ----------------------------------------------------------------------------

export type ValidElementEdit =
  | { op: 'delete' }
  | { op: 'order'; order: ElementEditOrder }
  | { op: 'place'; anchor: ElementEditAnchor }
  | { op: 'style'; bold?: boolean; italic?: boolean; sizeStep?: -1 | 1; binding?: string; align?: 'left' | 'center' | 'right' }

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/** CONTRACT: the colour token is a theme palette token. Studio binds the six palette ids ('--theme-accent-1', or 'accent_1', 'accent-1'); anything else is INVALID_VALUE. */
export function paletteBindingFor(token: unknown): string | null {
  if (typeof token !== 'string') return null
  const name = token.trim().toLowerCase().replace(/_/g, '-').replace(/^--theme-/, '').replace(/^theme-/, '')
  const binding = `--theme-${name}`
  return name && PALETTE_BINDINGS.includes(binding) ? binding : null
}

const STYLE_KEYS = ['bold', 'italic', 'size_step', 'color_token', 'align']

/** The op and its values. INVALID_VALUE for an unknown op, order, anchor, size_step, colour token or alignment, or a style with nothing to apply. */
export function validateElementEdit(fields: Record<string, unknown>): { ok: true; edit: ValidElementEdit } | { ok: false; code: ElementEditErrorCode } {
  const invalid = { ok: false as const, code: 'INVALID_VALUE' as const }
  const op = fields.op
  if (typeof op !== 'string' || !(ELEMENT_EDIT_OPS as readonly string[]).includes(op)) return invalid
  if (op === 'delete') return { ok: true, edit: { op: 'delete' } }
  if (op === 'order') {
    return typeof fields.order === 'string' && (ELEMENT_EDIT_ORDERS as readonly string[]).includes(fields.order)
      ? { ok: true, edit: { op: 'order', order: fields.order as ElementEditOrder } }
      : invalid
  }
  if (op === 'place') {
    const anchor = isRecord(fields.place) ? fields.place.anchor : null
    return typeof anchor === 'string' && (ELEMENT_EDIT_ANCHORS as readonly string[]).includes(anchor)
      ? { ok: true, edit: { op: 'place', anchor: anchor as ElementEditAnchor } }
      : invalid
  }
  const style = fields.style
  if (!isRecord(style)) return invalid
  const keys = Object.keys(style).filter(key => style[key] !== undefined)
  if (keys.length === 0 || keys.some(key => !STYLE_KEYS.includes(key))) return invalid
  const edit: ValidElementEdit & { op: 'style' } = { op: 'style' }
  if ('bold' in style && style.bold !== undefined) { if (typeof style.bold !== 'boolean') return invalid; edit.bold = style.bold }
  if ('italic' in style && style.italic !== undefined) { if (typeof style.italic !== 'boolean') return invalid; edit.italic = style.italic }
  if ('size_step' in style && style.size_step !== undefined) { if (style.size_step !== 1 && style.size_step !== -1) return invalid; edit.sizeStep = style.size_step }
  if ('color_token' in style && style.color_token !== undefined) {
    const binding = paletteBindingFor(style.color_token)
    if (!binding) return invalid
    edit.binding = binding
  }
  if ('align' in style && style.align !== undefined) {
    if (typeof style.align !== 'string' || !(ELEMENT_EDIT_ALIGNS as readonly string[]).includes(style.align)) return invalid
    edit.align = style.align as 'left' | 'center' | 'right'
  }
  return { ok: true, edit }
}

// ---- the element, as the viewer reports it ---------------------------------------------------------------------------------------------

export interface LiveElement {
  elementId: string
  rendererType: string | null
  componentType: string | null
  locked: boolean
  gridRow: string | null
  gridColumn: string | null
}

/** The target element in a `getSlideGenerationContext` answer, or null (not a success, another slide, no list, not in it). */
export function liveElementFromContext(response: unknown, slideIndex: number, elementId: string): LiveElement | null {
  if (!isRecord(response) || response.success !== true) return null
  if (Number(response.slide_index ?? response.slideIndex) !== slideIndex || !Array.isArray(response.elements)) return null
  for (const raw of response.elements) {
    if (!isRecord(raw) || raw.element_id !== elementId) continue
    const position = isRecord(raw.position) ? raw.position : {}
    const properties = isRecord(raw.properties) ? raw.properties : {}
    return {
      elementId,
      rendererType: typeof raw.renderer_type === 'string' ? raw.renderer_type : null,
      componentType: typeof raw.component_type === 'string' ? raw.component_type.toUpperCase() : null,
      locked: properties.locked === true,
      gridRow: typeof position.gridRow === 'string' ? position.gridRow : null,
      gridColumn: typeof position.gridColumn === 'string' ? position.gridColumn : null,
    }
  }
  return null
}

/** A text box proper: the one element type the text-format commands serve (METRICS, SHAPE, ICON_LABEL ride the same renderer but are not text). */
const isTextBox = (element: LiveElement) => element.componentType === 'TEXT_BOX' && (element.rendererType ?? 'textbox') === 'textbox'
const isTextboxRendered = (element: LiveElement) => element.rendererType === 'textbox'

const snap = (value: number) => Math.round(value * 5) / 5
const span = (start: number, end: number) => `${snap(start)}/${snap(end)}`

/**
 * Where an anchor puts a box of the same size, on the logical 32 x 18 grid (grid lines 1..33 and 1..19, 0.2 minor grid), inside the content area
 * (FREE_SPOT_BOUNDS: columns 2..32, rows 4..18). left / center / right move it horizontally (center is the horizontal centre), top / middle / bottom
 * vertically (middle is the vertical centre), the four corners both. A box larger than the area is pinned to the area's start and kept on the grid.
 */
export function placementFor(anchor: ElementEditAnchor, gridRow: string | null, gridColumn: string | null): { gridRow: string; gridColumn: string } | null {
  const rows = parseFreeSpotSpan(gridRow)
  const cols = parseFreeSpotSpan(gridColumn)
  if (!rows || !cols) return null
  const { minCol, maxCol, minRow, maxRow } = FREE_SPOT_BOUNDS
  const width = cols[1] - cols[0]
  const height = rows[1] - rows[0]
  const horizontal = anchor === 'left' || anchor === 'top-left' || anchor === 'bottom-left' ? 'start'
    : anchor === 'right' || anchor === 'top-right' || anchor === 'bottom-right' ? 'end'
      : anchor === 'center' ? 'middle' : null
  const vertical = anchor === 'top' || anchor === 'top-left' || anchor === 'top-right' ? 'start'
    : anchor === 'bottom' || anchor === 'bottom-left' || anchor === 'bottom-right' ? 'end'
      : anchor === 'middle' ? 'middle' : null
  const place = (mode: 'start' | 'end' | 'middle' | null, current: number, size: number, min: number, max: number, last: number) => {
    const raw = mode === 'start' ? min : mode === 'end' ? max - size : mode === 'middle' ? (min + max - size) / 2 : current
    return Math.max(1, Math.min(raw, last - size))
  }
  const startCol = place(horizontal, cols[0], width, minCol, maxCol, 33)
  const startRow = place(vertical, rows[0], height, minRow, maxRow, 19)
  return { gridRow: span(startRow, startRow + height), gridColumn: span(startCol, startCol + width) }
}

/** The next entry of the font size list above (+1) or below (-1) `current`; the end of the list stays where it is. Null when the size cannot be read. */
export function steppedFontSize(current: number | null, step: -1 | 1): number | null {
  if (current === null || !Number.isFinite(current) || current <= 0) return null
  if (step === 1) return FONT_SIZE_STEPS.find(size => size > current + 0.01) ?? FONT_SIZE_STEPS[FONT_SIZE_STEPS.length - 1]
  const smaller = FONT_SIZE_STEPS.filter(size => size < current - 0.01)
  return smaller.length ? smaller[smaller.length - 1] : FONT_SIZE_STEPS[0]
}

/** The font size (px) in a `getTextBoxFormatting` answer ("24px", "18pt", 24), or null. */
export function fontSizeFromFormatting(response: unknown): number | null {
  const formatting = isRecord(response) && isRecord(response.formatting) ? response.formatting : null
  const raw = formatting?.fontSize
  const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number.parseFloat(raw) : NaN
  return Number.isFinite(value) && value > 0 ? value : null
}

export interface ViewerStep {
  /** 'element' goes through the viewer's sendElementCommand (the router), 'textbox' through sendTextBoxCommand (plain postMessage, the text panels' path). */
  route: 'element' | 'textbox'
  action: string
  params: Record<string, unknown>
}

/** The viewer commands for a valid edit on this element, or the code when the viewer has no command for it. `fontSizePx` is the box's current size (size_step only). */
export function planViewerSteps(edit: ValidElementEdit, element: LiveElement, fontSizePx: number | null): { ok: true; steps: ViewerStep[] } | { ok: false; code: ElementEditErrorCode } {
  const unsupported = { ok: false as const, code: 'UNSUPPORTED_OP' as const }
  const elementId = element.elementId
  switch (edit.op) {
    case 'delete':
      return { ok: true, steps: [{ route: 'element', action: VIEWER_COMMANDS.deleteElement, params: { elementId } }] }
    case 'order':
      // forward / backward: Layout has no one-step z-order command.
      if (edit.order === 'front') return { ok: true, steps: [{ route: 'textbox', action: VIEWER_COMMANDS.front, params: { elementId } }] }
      if (edit.order === 'back') return { ok: true, steps: [{ route: 'textbox', action: VIEWER_COMMANDS.back, params: { elementId } }] }
      return unsupported
    case 'place': {
      if (!isTextboxRendered(element)) return unsupported
      const target = placementFor(edit.anchor, element.gridRow, element.gridColumn)
      if (!target) return unsupported
      return { ok: true, steps: [{ route: 'textbox', action: VIEWER_COMMANDS.place, params: { elementId, gridRow: target.gridRow, gridColumn: target.gridColumn } }] }
    }
    case 'style': {
      if (!isTextBox(element) || edit.italic !== undefined) return unsupported
      const steps: ViewerStep[] = []
      if (edit.bold !== undefined) steps.push({ route: 'textbox', action: VIEWER_COMMANDS.bold, params: { elementId, fontWeight: edit.bold ? '700' : '400' } })
      if (edit.sizeStep !== undefined) {
        const size = steppedFontSize(fontSizePx, edit.sizeStep)
        if (size === null) return unsupported
        steps.push({ route: 'textbox', action: VIEWER_COMMANDS.size, params: { elementId, fontSize: size } })
      }
      if (edit.binding !== undefined) steps.push({ route: 'textbox', action: VIEWER_COMMANDS.color, params: { elementId, themeBinding: edit.binding } })
      if (edit.align !== undefined) steps.push({ route: 'textbox', action: VIEWER_COMMANDS.align, params: { elementId, alignment: edit.align } })
      return steps.length ? { ok: true, steps } : unsupported
    }
  }
}

// ---- viewer failures ---------------------------------------------------------------------------------------------------------------------

/** A viewer rejection (presentation-viewer's sendCommand rejects with the reply's `error`) as one of Director's codes. */
export function elementEditCommandErrorCode(error: unknown): ElementEditErrorCode {
  const raw = typeof error === 'string' ? error : (error as { message?: unknown } | null)?.message
  const message = typeof raw === 'string' ? raw : ''
  if (message === 'Command timeout' || message === 'Iframe not ready' || /viewer|Layout service|Layout Service/.test(message)) return 'VIEWER_NOT_READY'
  if (message === 'view-only') return 'ELEMENT_LOCKED'
  if (/^Unknown action:/.test(message) || /RECREATE_REQUIRED/.test(message)) return 'UNSUPPORTED_OP'
  if (/not found/i.test(message)) return 'ELEMENT_NOT_FOUND'
  // A parameter the viewer refused, or anything else: the viewer cannot do this honestly.
  return 'UNSUPPORTED_OP'
}

/** The error of the element read: Layout answers "Target element X was not found on slide N" / "Slide N not found". */
function readErrorCode(error: unknown): ElementEditErrorCode {
  const raw = typeof error === 'string' ? error : (error as { message?: unknown } | null)?.message
  const message = typeof raw === 'string' ? raw : ''
  if (/was not found on slide/i.test(message)) return 'ELEMENT_NOT_FOUND'
  if (/^Slide \d+ not found/.test(message)) return 'SLIDE_CHANGED'
  if (message === 'view-only') return 'ELEMENT_LOCKED'
  return 'VIEWER_NOT_READY'
}

// ---- one at a time, one result per directive ----------------------------------------------------------------------------------------

export interface ElementEditGate {
  /** 'duplicate': this directive_id was already admitted (no second run, no second result); 'busy': another edit is still running; 'run': go ahead. */
  admit: (directiveId: string) => 'run' | 'duplicate' | 'busy'
  done: (directiveId: string) => void
}

/** The tab's single-flight gate and the directive ids it has seen (the last `limit`). */
export function createElementEditGate(limit = 500): ElementEditGate {
  const seen = new Set<string>()
  let running: string | null = null
  return {
    admit(directiveId) {
      if (seen.has(directiveId)) return 'duplicate'
      seen.add(directiveId)
      if (seen.size > limit) { const oldest = seen.values().next().value; if (oldest !== undefined) seen.delete(oldest) }
      if (running !== null) return 'busy'
      running = directiveId
      return 'run'
    },
    done(directiveId) { if (running === directiveId) running = null },
  }
}

// ---- the runner -------------------------------------------------------------------------------------------------------------------------------

export interface ElementEditRunnerDeps {
  /** The session and presentation on screen now (the page's owner record, the K5 add runner's). */
  displayed: () => { sessionId?: string | null; deckOwnerSessionId?: string | null; presentationId?: string | null; epoch?: number }
  gate: ElementEditGate
  /** This tab is superseded by another live tab. */
  paused: () => boolean
  /** Template authoring mode: the viewer's elements are not edited from chat. */
  templateMode: () => boolean
  slideCount: () => number
  currentSlideIndex: () => number
  /** The slide_id the page knows at an index (null when it does not). */
  slideIdAt: (slideIndex: number) => string | null
  goToSlide?: ((slideIndex: number) => Promise<void>) | null
  /** The page's viewer APIs: the element router (reads, delete) and the plain text box path (the other commands). */
  sendElementCommand?: ((action: string, params: Record<string, unknown>) => Promise<any>) | null
  sendTextBoxCommand?: ((action: string, params: Record<string, unknown>) => Promise<any>) | null
  /** The viewer's own lazy edit mode (lib/chat-element-edit-save.ts); false when the viewer is not mounted or did not enter it. */
  ensureEditMode: () => Promise<boolean>
  subscribeSave: (listener: (event: ViewerSaveEvent) => void) => () => void
  /** Wait after a slide change (the K5 add runner waits 400 ms). */
  settle: () => Promise<void>
  timers?: SaveWatchTimers
  saveTimeoutMs?: number
}

/**
 * Runs one `element_edit` and returns the `element_edit_result.data` to send, or null when nothing may be sent (a stale socket or owner, a repeat of a
 * directive already handled, a frame with no directive_id). `ok:true` only after the viewer's autosave acknowledged the change.
 */
export async function runElementEditDirective(
  message: ElementEditDirectiveMessage,
  owner: ElementEditDirectiveOwner,
  deps: ElementEditRunnerDeps,
): Promise<ElementEditResultData | null> {
  const fields = elementEditFields(message)
  const directiveId = typeof fields.directive_id === 'string' && fields.directive_id.trim() ? fields.directive_id : null
  if (!directiveId) return null

  const start = deps.displayed()
  const owns = () => {
    const now = deps.displayed()
    return Boolean(owner.isCurrent() && start.sessionId && start.presentationId
      && now.sessionId === start.sessionId && now.deckOwnerSessionId === start.sessionId && now.presentationId === start.presentationId
      && now.epoch === start.epoch)
  }
  // 0. A stale socket, another session, or a deck that is not on screen under this session: nothing is sent.
  if (!owner.sessionId || !owns() || start.sessionId !== owner.sessionId
    || (typeof fields.session_id === 'string' && fields.session_id !== owner.sessionId)
    || (typeof message.session_id === 'string' && message.session_id !== owner.sessionId)) return null

  const admitted = deps.gate.admit(directiveId)
  if (admitted === 'duplicate') return null
  const fail = (code: ElementEditErrorCode): ElementEditResultData => ({ directive_id: directiveId, ok: false, error_code: code })
  if (admitted === 'busy') return fail('BUSY')

  let applied = false
  const runSteps = async (): Promise<ElementEditResultData | null> => {
    const sendElement = deps.sendElementCommand
    const sendTextBox = deps.sendTextBoxCommand
    // 1. The shape of the directive, before the viewer is touched.
    const elementId = typeof fields.element_id === 'string' && fields.element_id && fields.element_id.length <= ELEMENT_EDIT_ID_MAX ? fields.element_id : null
    if (!elementId) return fail('ELEMENT_NOT_FOUND')
    const target = fields.slide_index
    if (typeof target !== 'number' || !Number.isInteger(target) || target < 0 || typeof fields.presentation_id !== 'string' || !fields.presentation_id) return fail('INVALID_VALUE')
    const checked = validateElementEdit(fields)
    if (!checked.ok) return fail(checked.code)
    // 2. The viewer, the deck and the slide.
    if (deps.paused() || !sendElement || !sendTextBox) return fail('VIEWER_NOT_READY')
    if (fields.presentation_id !== start.presentationId) return fail('SLIDE_CHANGED')
    const slideCount = deps.slideCount()
    if (slideCount > 0 && target >= slideCount) return fail('SLIDE_CHANGED')
    const sameSlide = () => {
      const knownId = deps.slideIdAt(target)
      return !(typeof fields.slide_id === 'string' && fields.slide_id && knownId && fields.slide_id !== knownId)
    }
    if (!sameSlide()) return fail('SLIDE_CHANGED')
    if (deps.currentSlideIndex() !== target) {
      if (!deps.goToSlide) return fail('SLIDE_CHANGED')
      try {
        await deps.goToSlide(target)
        await deps.settle()
      } catch {
        return owns() ? fail('VIEWER_NOT_READY') : null
      }
      if (!owns()) return null
      if (deps.currentSlideIndex() !== target || !sameSlide()) return fail('SLIDE_CHANGED')
    }
    // 3. The element, as the viewer reports it.
    let element: LiveElement | null
    try {
      element = liveElementFromContext(await sendElement(VIEWER_COMMANDS.readSlide, { slideIndex: target, targetElementId: elementId }), target, elementId)
    } catch (error) {
      return owns() ? fail(readErrorCode(error)) : null
    }
    if (!owns()) return null
    if (!element) return fail('ELEMENT_NOT_FOUND')
    if (element.locked || deps.templateMode()) return fail('ELEMENT_LOCKED')
    // 4. What the viewer can do for it (the size of a text box is read for size_step only).
    let fontSizePx: number | null = null
    if (checked.edit.op === 'style' && checked.edit.sizeStep !== undefined && isTextBox(element) && checked.edit.italic === undefined) {
      try {
        fontSizePx = fontSizeFromFormatting(await sendTextBox(VIEWER_COMMANDS.readFormatting, { elementId }))
      } catch (error) {
        return owns() ? fail(elementEditCommandErrorCode(error)) : null
      }
      if (!owns()) return null
    }
    const plan = planViewerSteps(checked.edit, element, fontSizePx)
    if (!plan.ok) return fail(plan.code)
    // 5. Edit mode, so that Layout's autosave tracks the change.
    let editing = false
    try {
      editing = await deps.ensureEditMode()
    } catch {
      editing = false
    }
    if (!owns()) return null
    if (!editing) return fail('VIEWER_NOT_READY')
    // 6. Apply, flush, wait for the ack. The watch opens first: Layout posts `unsaved` while it handles the command, before its reply.
    const watch = watchViewerSave(deps.subscribeSave, deps.timers)
    try {
      for (const step of plan.steps) {
        if (!owns()) return null
        if (deps.currentSlideIndex() !== target) return fail(applied ? 'SAVE_FAILED' : 'SLIDE_CHANGED')
        try {
          const reply = await (step.route === 'element' ? sendElement : sendTextBox)(step.action, step.params)
          if (reply && reply.success === false) throw new Error(typeof reply.error === 'string' ? reply.error : 'Command failed')
        } catch (error) {
          return owns() ? fail(applied ? 'SAVE_FAILED' : elementEditCommandErrorCode(error)) : null
        }
        applied = true
      }
      if (!owns()) return null
      // The viewer's own Save (the toolbar's): it marks the deck changed and saves now, which a z-order change needs and the others only hurry along.
      try {
        await sendTextBox(VIEWER_COMMANDS.flushSave, {})
      } catch {
        // The debounced autosave is still pending for a tracked change; no ack in time is SAVE_FAILED below.
      }
      const outcome = await watch.settled(deps.saveTimeoutMs ?? ELEMENT_EDIT_SAVE_TIMEOUT_MS)
      if (!owns()) return null
      return outcome === 'saved' ? { directive_id: directiveId as string, ok: true } : fail('SAVE_FAILED')
    } finally {
      watch.close()
    }
  }

  try {
    return await runSteps()
  } catch {
    // Not expected (every step catches its own failure). A change already applied but not confirmed saved is a save failure; else the viewer was not usable.
    return owns() ? fail(applied ? 'SAVE_FAILED' : 'VIEWER_NOT_READY') : null
  } finally {
    deps.gate.done(directiveId)
  }
}
