/**
 * FRONTEND-2 Pass 3: refine an element from chat (NEXT_PUBLIC_CHAT_ELEMENT_REFINE, exact "true", default off, read at build time).
 *
 * Contract: ops/program/pass3/DIRECTOR-2-REFINE-ELEMENT-DESIGN.md §3 (references), §5 (cap, directive frame, runner), §6 (flag), and
 * streams/frontend/pass3/REFINE-ELEMENT-STUDIO-NOTES.md (Director !511's five rules, the Layout command of layout-builder !245).
 *
 * With the flag on, Studio
 *  - adds `element_refine1` to `user_message.data.client_caps`;
 *  - adds AT MOST ONE `{kind:'element', element_id, element_type, slide_index, slide_id, label}` to `user_message.data.references` when an
 *    element is selected at send time (skipped when its type is off Director's allow-list or its id is over 128 characters);
 *  - runs Director's `element_refine_directive` (runElementRefineDirective below) and always answers it with
 *    `element_directive_result {directive_id, status, element_id, error_code}`. Studio never shows a failure line of its own: Director says it.
 * Flag off: none of this runs, and the send payload, the socket handling and the page are exactly as before.
 */

import type { RefineContext } from '@/hooks/use-element-refinement'
import type { TextLabsGenerationResult } from '@/hooks/use-textlabs-generation'
import type { TextLabsComponentType, TextLabsFormData } from '@/types/textlabs'
import { buildFormDataForDirective } from '@/lib/mdc-element-directive'
import { normalizeSemanticComponentType } from '@/lib/element-semantic-type'
import type {
  ChatElementReference, ElementRefineDirectiveMessage, ElementRefineDirectiveOwner, ElementRefineDirectivePayload, ElementRefineErrorCode,
  ElementRefineResultData, ElementRefineStatus,
} from '@/lib/chat-element-refine-wire'

export {
  CHAT_ELEMENT_REFINE_ENABLED, ELEMENT_REFINE_CLIENT_CAP, ELEMENT_REFINE_DIRECTIVE_TYPE, addChatElementRefineFields, elementRefineDirectiveId,
} from '@/lib/chat-element-refine-wire'
export type {
  ChatElementReference, ElementRefineDirectiveMessage, ElementRefineDirectiveOwner, ElementRefineDirectivePayload, ElementRefineErrorCode,
  ElementRefineResultData, ElementRefineStatus,
} from '@/lib/chat-element-refine-wire'

/** The Layout viewer command of layout-builder !245 (LAYOUT_REQUEST_ELEMENT_REFINE_ENABLED). */
export const REQUEST_ELEMENT_REFINE_ACTION = 'requestElementRefine'

/** Director !511 rule 1: the only element types it keeps on a reference (compared case-insensitively). */
export const DIRECTOR_ELEMENT_REFERENCE_TYPES: readonly string[] = [
  'TEXT_BOX', 'METRICS', 'TABLE', 'CHART', 'IMAGE', 'ICON_LABEL', 'SHAPE', 'INFOGRAPHIC', 'DIAGRAM', 'CODE_DISPLAY', 'KANBAN_BOARD',
  'GANTT_CHART', 'CHEVRON_MATURITY', 'IDEA_BOARD', 'CLOUD_ARCHITECTURE', 'LOGICAL_ARCHITECTURE', 'DATA_ARCHITECTURE', 'CUSTOM', 'DIAGRAM_AUTO',
]
/** Director !511 rule 4. */
export const ELEMENT_REFERENCE_ID_MAX = 128

// ---- the selection and the reference --------------------------------------------------------------------------------------------

/** What Studio knows about the canvas selection, captured when the element was selected (slide_index is that moment's slide). */
export interface ChatElementSelection {
  elementId: string
  /** The viewer's type for the selection: 'TEXT_BOX' for a text box, else the viewer's element type ('chart', 'image', ...). */
  elementType: string | null
  slideIndex: number
  slideId: string | null
}

const LABELS: Record<string, string> = {
  TEXT_BOX: 'Text box', METRICS: 'Metrics', TABLE: 'Table', CHART: 'Chart', IMAGE: 'Image', ICON_LABEL: 'Icon label', SHAPE: 'Shape',
  INFOGRAPHIC: 'Infographic', DIAGRAM: 'Diagram',
}

function referenceType(value: string | null): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const raw = value.trim().toUpperCase().replace(/[-\s]/g, '_')
  if (DIRECTOR_ELEMENT_REFERENCE_TYPES.includes(raw)) return raw
  const semantic = normalizeSemanticComponentType(value)
  return semantic && DIRECTOR_ELEMENT_REFERENCE_TYPES.includes(semantic) ? semantic : null
}

/** The one element reference for a send, or null (nothing selected, a type off Director's list, an id over 128, no known slide). */
export function chatElementReferenceFor(selection: ChatElementSelection | null | undefined): ChatElementReference | null {
  if (!selection) return null
  const { elementId, slideIndex } = selection
  if (typeof elementId !== 'string' || !elementId || elementId.length > ELEMENT_REFERENCE_ID_MAX) return null
  if (!Number.isInteger(slideIndex) || slideIndex < 0) return null
  const elementType = referenceType(selection.elementType)
  if (!elementType) return null
  return {
    kind: 'element',
    element_id: elementId,
    element_type: elementType,
    slide_index: slideIndex,
    slide_id: typeof selection.slideId === 'string' && selection.slideId ? selection.slideId : null,
    label: `${LABELS[elementType] ?? elementType.charAt(0) + elementType.slice(1).toLowerCase().replace(/_/g, ' ')} · slide ${slideIndex + 1}`,
  }
}

// ---- the directive ----------------------------------------------------------------------------------------------------------------

/** A Layout bridge rejection (presentation-viewer's sendCommand rejects with the reply's `error`) as one of Director's codes. */
export function elementRefineCommandErrorCode(error: unknown): ElementRefineErrorCode {
  const raw = typeof error === 'string' ? error : (error as { message?: unknown } | null)?.message
  const message = typeof raw === 'string' ? raw : ''
  if (message === 'element_not_found') return 'element_not_found'
  if (message === 'Command timeout') return 'timeout'
  // 'Unknown action: requestElementRefine' (Layout's flag off), 'view-only', 'Iframe not ready', a parameter error, anything else.
  return 'viewer_unavailable'
}

/** The form a chat refine sends through the panel pipeline: the K5 add form for that type, with the instruction as its prompt. */
export function chatRefineFormData(componentType: TextLabsComponentType, instruction: string, refineContext: RefineContext): TextLabsFormData | null {
  const formData = buildFormDataForDirective(componentType, instruction)
  if (!formData) return null
  // The Element panel refines with the deck theme by default (lib/visual-form-draft.ts resolveDraftThemeSource).
  formData.useDeckTheme = true
  if (formData.componentType === 'TEXT_BOX' && refineContext.semanticRole) formData.semanticRole = refineContext.semanticRole
  return formData
}

export type ChatRefineInvocation = { kind: 'chat-refine'; slideIndex: number; refineContext: RefineContext }

export interface ElementRefineRunnerDeps {
  /** The session and presentation on screen now (the page's owner). */
  displayed: () => { sessionId?: string | null; deckOwnerSessionId?: string | null; presentationId?: string | null; epoch?: number }
  /** The Element panel is open or a generation (or another chat refine) is running. */
  isBusy: () => boolean
  slideCount: () => number
  currentSlideIndex: () => number
  goToSlide?: ((slideIndex: number) => Promise<void>) | null
  sendElementCommand?: ((action: string, params: Record<string, unknown>) => Promise<any>) | null
  /** The page's own element-type mapping and blank-placeholder rule (the ones handleRefineElementRequested uses). */
  componentTypeOf: (payload: Record<string, unknown>) => TextLabsComponentType | null
  isBlankPlaceholder: (payload: Record<string, unknown>) => boolean
  buildRefineContext: (payload: Record<string, unknown>, componentType: TextLabsComponentType) => RefineContext
  /** handleApprovedTextLabsGenerate with the chat-refine invocation. */
  generate: (formData: TextLabsFormData, invocation: ChatRefineInvocation) => Promise<TextLabsGenerationResult>
  /** Wait after a slide change (the K5 add runner waits 400 ms). */
  settle: () => Promise<void>
}

/**
 * Runs one `element_refine_directive` and returns the `element_directive_result.data` to send. Every exit is a known status
 * (`refined`, `failed` + code, `dismissed`); `element_id` is the directive's element. Nothing here talks to Director or the user.
 */
export async function runElementRefineDirective(
  message: ElementRefineDirectiveMessage,
  owner: ElementRefineDirectiveOwner,
  deps: ElementRefineRunnerDeps,
): Promise<ElementRefineResultData> {
  try {
    return await runSteps(message, owner, deps)
  } catch {
    // Not expected (every step catches its own failure); still a known status, so Director can close its pending directive.
    const payload = (message?.payload ?? {}) as Partial<ElementRefineDirectivePayload>
    return { directive_id: String(payload.directive_id), status: 'failed', element_id: typeof payload.element_id === 'string' && payload.element_id ? payload.element_id : null, error_code: 'generation_failed' }
  }
}

async function runSteps(
  message: ElementRefineDirectiveMessage,
  owner: ElementRefineDirectiveOwner,
  deps: ElementRefineRunnerDeps,
): Promise<ElementRefineResultData> {
  const payload = (message.payload ?? {}) as Partial<ElementRefineDirectivePayload>
  const directiveId = String(payload.directive_id)
  const elementId = typeof payload.element_id === 'string' && payload.element_id ? payload.element_id : null
  const result = (status: ElementRefineStatus, errorCode: ElementRefineErrorCode | null = null): ElementRefineResultData => ({
    directive_id: directiveId, status, element_id: elementId, error_code: status === 'failed' ? errorCode : null,
  })

  const start = deps.displayed()
  const owns = () => {
    const now = deps.displayed()
    return Boolean(start.sessionId && start.presentationId
      && now.sessionId === start.sessionId && now.deckOwnerSessionId === start.sessionId && now.presentationId === start.presentationId
      && now.epoch === start.epoch)
  }
  // 1. The directive belongs to the session and the presentation on screen.
  if (!owner.sessionId || !owns() || start.sessionId !== owner.sessionId
    || (typeof message.session_id === 'string' && message.session_id !== owner.sessionId)
    || payload.presentation_id !== start.presentationId) return result('failed', 'not_owner')
  // 2. The Element panel is open or a generation is running: leave it.
  if (deps.isBusy()) return result('dismissed')
  // 3. The slide, then the element on it.
  const target = payload.slide_index
  if (!elementId || elementId.length > ELEMENT_REFERENCE_ID_MAX || typeof target !== 'number' || !Number.isInteger(target) || target < 0) {
    return result('failed', 'element_not_found')
  }
  const slideCount = deps.slideCount()
  if (slideCount > 0 && target >= slideCount) return result('failed', 'element_not_found')
  if (!deps.sendElementCommand) return result('failed', 'viewer_unavailable')
  if (deps.currentSlideIndex() !== target) {
    if (!deps.goToSlide) return result('failed', 'viewer_unavailable')
    try {
      await deps.goToSlide(target)
      await deps.settle()
    } catch {
      return result('failed', 'viewer_unavailable')
    }
    if (!owns()) return result('failed', 'not_owner')
    if (deps.currentSlideIndex() !== target) return result('failed', 'viewer_unavailable')
  }
  // 4. The element's refine payload from the viewer (Layout !245), with no side effect there.
  let refinePayload: Record<string, unknown>
  try {
    const response = await deps.sendElementCommand(REQUEST_ELEMENT_REFINE_ACTION, { elementId })
    const data = response?.data
    if (!response?.success || !data || typeof data !== 'object') return result('failed', 'viewer_unavailable')
    refinePayload = data as Record<string, unknown>
  } catch (error) {
    return result('failed', elementRefineCommandErrorCode(error))
  }
  if (!owns()) return result('failed', 'not_owner')
  if (refinePayload.elementId !== elementId
    || (typeof refinePayload.slideIndex === 'number' && refinePayload.slideIndex !== target)) return result('failed', 'element_not_found')
  // 5. The same refine the Element panel runs (handleApprovedTextLabsGenerate, refine branch).
  const componentType = deps.componentTypeOf(refinePayload)
  if (!componentType || deps.isBlankPlaceholder(refinePayload)) return result('failed', 'generation_failed')
  let refineContext: RefineContext
  let formData: TextLabsFormData | null
  try {
    refineContext = deps.buildRefineContext(refinePayload, componentType)
    formData = typeof payload.instruction === 'string' && payload.instruction.trim()
      ? chatRefineFormData(componentType, payload.instruction, refineContext)
      : null
  } catch {
    return result('failed', 'generation_failed')
  }
  if (!formData) return result('failed', 'generation_failed')
  if (deps.isBusy()) return result('dismissed')
  let outcome: TextLabsGenerationResult
  try {
    outcome = await deps.generate(formData, { kind: 'chat-refine', slideIndex: target, refineContext })
  } catch {
    return result('failed', 'generation_failed')
  }
  // 6. Swapped in place (or not).
  if (outcome.status !== 'inserted') return result('failed', 'generation_failed')
  if (!owns() || outcome.presentationId !== start.presentationId) return result('failed', 'not_owner')
  if (outcome.slideIndex !== target || !outcome.elementIds.length) return result('failed', 'generation_failed')
  return result('refined')
}
