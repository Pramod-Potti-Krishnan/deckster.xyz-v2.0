/**
 * FRONTEND-2 (B50, 29 Oct; parity rows 43 and 45, E2E-2 run-B3: a chat "Shorten this" on a slide TITLE came back "Done" while the title was rewritten from the instruction): the Studio INTERIM for a chat refine of a title-type text
 * box (NEXT_PUBLIC_STUDIO_CHAT_REFINE_STRUCTURAL_DECLINE, exact "true", default off, read at build time).
 *
 * Why. Studio's refine request is right: it sends the box's current text (existing_element.content) and its semantic role. The Text Service answers a role other than BODY_TEXT down its structural branch
 * (backend/text-service app/api/atomic_routes.py `request.semantic_role != SemanticTextRole.BODY_TEXT` -> generate_structural_text), whose prompt is only `User request: {prompt}`: the current text never reaches the model, so
 * "Shorten this" writes a title ABOUT the instruction. The real fix is the Text Service's (after Thursday). Until then Studio declines honestly instead of showing a false Done.
 *
 * Contract (PROGRAM-1 29 Oct 10:53Z, agreed with DIRECTOR-2): for such a box the chat refine runner (lib/chat-element-refine.ts) answers the existing `element_directive_result`
 * `{directive_id, status: 'failed', element_id, error_code: 'unsupported_type'}` BEFORE any generation (no Text Labs call, nothing changes on the canvas). Director then says its own flagged line (it owns the sentence).
 * Studio adds no copy. The manual Element panel refine is not touched (PROD-LATER).
 *
 * Which boxes. A TEXT_BOX whose semantic role (refineContext.semanticRole, the very value Studio sends as `semantic_role`) is a KNOWN STRUCTURAL role: every role of the Text Service's SemanticTextRole enum
 * (backend/text-service app/models/atomic_models.py) except BODY_TEXT, which is also Studio's own TextSemanticRole union (types/textlabs.ts) and the slot catalog's TEXT_ROLES (lib/text-slot-catalog.ts) minus BODY_TEXT.
 * Anything else keeps today's refine: BODY_TEXT, a missing role (null / undefined: the Text Service's own default is BODY_TEXT), a role Studio does not know (an unknown value never matches; the match is exact, upper case,
 * as the Text Service's enum is), and every other component type.
 *
 * Types only (no runtime import), so the proof runs it under plain node. Flag off: nothing here runs.
 */
import type { TextSemanticRole } from '@/types/textlabs'

export const CHAT_REFINE_STRUCTURAL_DECLINE_ENABLED = process.env.NEXT_PUBLIC_STUDIO_CHAT_REFINE_STRUCTURAL_DECLINE === 'true'

/**
 * Every role except BODY_TEXT. Typed as a Record over `Exclude<TextSemanticRole, 'BODY_TEXT'>`, so tsc fails when a role is added to (or dropped from) types/textlabs.ts without this table following it.
 */
const STRUCTURAL_TEXT_ROLE_TABLE: Record<Exclude<TextSemanticRole, 'BODY_TEXT'>, true> = {
  SLIDE_TITLE: true,
  SLIDE_SUBTITLE: true,
  PRESENTATION_TITLE: true,
  PRESENTATION_SUBTITLE: true,
  EYEBROW: true,
  AUTHOR_INFO: true,
  SECTION_NUMBER: true,
  SECTION_TITLE: true,
  SECTION_SUBTITLE: true,
  CLOSING_TITLE: true,
  CLOSING_SUBTITLE: true,
  CONTACT_INFO: true,
  QUOTE_ATTRIBUTION: true,
  FOOTER: true,
  SOURCES: true,
}

/** The structural roles, in the enum's order. */
export const STRUCTURAL_TEXT_ROLES: readonly string[] = Object.keys(STRUCTURAL_TEXT_ROLE_TABLE)

/** True for a known structural role only (exact, case-sensitive); BODY_TEXT, null, undefined, '' and any value that is not a role are false. */
export function isStructuralTextRole(role: unknown): boolean {
  return typeof role === 'string' && Object.prototype.hasOwnProperty.call(STRUCTURAL_TEXT_ROLE_TABLE, role)
}

/** True when a chat refine must be declined: a TEXT_BOX with a known structural role. Every other case (BODY_TEXT, no role, an unknown role, another component type) is false and keeps today's refine. */
export function declinesStructuralRefine(componentType: unknown, semanticRole: unknown): boolean {
  return componentType === 'TEXT_BOX' && isStructuralTextRole(semanticRole)
}
