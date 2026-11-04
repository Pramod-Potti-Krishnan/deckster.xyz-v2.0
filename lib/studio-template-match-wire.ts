// FRONTEND-2 (W2 P4-7/8; flag NEXT_PUBLIC_STUDIO_TEMPLATE_MATCH, default off): the capability on the wire. Two things the Director socket hook needs and nothing else.
//   addTemplateMatchCap(data)   : template_match1, LAST in a user_message's client_caps (after every other cap), only with the flag on (the hook's line is gated by the flag).
//   templateMatchBaseCaps()     : the capabilities every user_message of this client advertises, built by the same helpers in the same order as the hook's buildUserMessage (the proof holds the two together),
//                                 for the two messages that go out before any user_message (template_auto_apply on connect, template_switch). The message builders add template_match1 themselves.
// Flag off: nothing here is called.
import { CHAT_DIRECTIVES } from '@/lib/mdc-flags'
import { CHAT_ELEMENT_REFINE_ENABLED, addChatElementRefineFields } from '@/lib/chat-element-refine-wire'
import { CHAT_ELEMENT_EDIT_ENABLED, addChatElementEditCaps } from '@/lib/chat-element-edit-wire'
import { CHAT_THEME_EXPORT_CAPS } from '@/lib/chat-theme-export-wire'
import { BULK_EDIT_UNDO_CLIENT_CAPS, addBulkEditUndoCaps } from '@/lib/studio-bulk-edit-wire'
import { STUDIO_CHAT_COMMANDS_ENABLED, addChatCommandsFields } from '@/lib/studio-chat-commands-wire'
import { CHAT_PARITY_CAPS, addChatParityCaps } from '@/lib/studio-chat-parity'
import { withTemplateMatchCap } from '@/lib/studio-template-match'

/** Adds template_match1 to `data.client_caps`, last, once. */
export function addTemplateMatchCap(data: Record<string, unknown>): Record<string, unknown> {
  data.client_caps = withTemplateMatchCap(data.client_caps)
  return data
}

/** The caps of a user_message without template_match1: the hook's own order (mdc1, theme1 / export1, element_refine1, element_edit1 / notes1, bulk_edit1 / undo1, mentions2 / commands1, themes1 / identity1 / templates1). */
export function templateMatchBaseCaps(): string[] {
  const data: Record<string, unknown> = {
    ...(CHAT_DIRECTIVES && { client_caps: ['mdc1'] }),
    ...(CHAT_THEME_EXPORT_CAPS.length > 0 && { client_caps: [...(CHAT_DIRECTIVES ? ['mdc1'] : []), ...CHAT_THEME_EXPORT_CAPS] }),
  }
  if (CHAT_ELEMENT_REFINE_ENABLED) addChatElementRefineFields(data, null)
  if (CHAT_ELEMENT_EDIT_ENABLED) addChatElementEditCaps(data)
  if (BULK_EDIT_UNDO_CLIENT_CAPS.length > 0) addBulkEditUndoCaps(data)
  if (STUDIO_CHAT_COMMANDS_ENABLED) addChatCommandsFields(data, '')
  if (CHAT_PARITY_CAPS.length > 0) addChatParityCaps(data)
  return Array.isArray(data.client_caps) ? (data.client_caps as unknown[]).filter((cap): cap is string => typeof cap === 'string') : []
}
