/**
 * FRONTEND-2 (B48, 29 Oct; E2E-2 B3 row 42, Studio dev 973fa22b, deck d68f9b14): chat add stacking, a chat-added element lands on top of the slide's content like an Element panel add, so it can be selected
 * (NEXT_PUBLIC_STUDIO_CHAT_ADD_STACKING, exact "true", default off, read at build time).
 *
 * Root cause (Studio's). A chat add runs the Element panel's own pipeline (app/builder/page.tsx elementDirectiveRunnerRef -> handleApprovedTextLabsGenerate -> hooks/use-textlabs-generation.ts handleGenerate, invocation kind
 * 'chat-add'), on the form data lib/mdc-element-directive.ts buildFormDataForDirective makes. That form data carries `z_index: 1` (BASE, since the first MDC commit, 30 Aug), where every Element panel form starts at its type's own
 * default, TEXT_LABS_ELEMENT_DEFAULTS[type].zIndex = 1000 (types/textlabs.ts; the form's z-index box). buildInsertionParams sends that z as the insert's zIndex and Layout (src/utils/element-manager.js insertChart / insertTextBox /
 * insertImage: `z-index: ${config.zIndex || ++counter}`) honours it as given. The slide's own elements (the stored text boxes, the infographic or picture of the template) are at z 100, so a chat add at z 1 is painted UNDER them
 * (visible through whatever is transparent) and every click inside its box lands on the z-100 element above it (E2E-2: the flow-chip infographic took the click meant for the chart). The saved z is the same 1 (auto-save.js and
 * chat-targeted-save.js store the element's own style.zIndex), so it is still under after a reload. Layout is as designed; nothing in it is at fault.
 *
 * With the flag on, a chat add's insert is sent with the z the Element panel's own add of that type starts at (and so stored with): the same rule, not a new number. A chat add that names none of its own (it never does: the directive carries
 * no z) lands where the panel's would. Only the chat add (invocation kind 'chat-add') is touched: the manual Add Element panel keeps whatever the user set, a chat refine replaces an element in place, and the position, size, content and save path of
 * the add are as before.
 *
 * Imports only types/textlabs.ts (no imports of its own), so the proof runs it under plain node. Flag off: nothing here runs.
 */
import { TEXT_LABS_ELEMENT_DEFAULTS } from '@/types/textlabs'

export const CHAT_ADD_STACKING_ENABLED = process.env.NEXT_PUBLIC_STUDIO_CHAT_ADD_STACKING === 'true'

/**
 * The z-index the Element panel's own add of `componentType` starts at (its form's default), or null when the type has no panel default (the insert then keeps the z it was built with).
 * A cited TABLE upsert carries no z at all (Layout places it), exactly as the panel's own table add does, so this changes nothing there.
 */
export function chatAddStackedZIndex(componentType: unknown): number | null {
  const defaults = (TEXT_LABS_ELEMENT_DEFAULTS as Record<string, { zIndex?: unknown } | undefined>)[typeof componentType === 'string' ? componentType : '']
  const zIndex = defaults?.zIndex
  return typeof zIndex === 'number' && Number.isFinite(zIndex) ? zIndex : null
}
