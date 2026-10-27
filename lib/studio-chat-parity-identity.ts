/**
 * CHAT-PARITY, IDENTITY group (rows 62-64; NEXT_PUBLIC_STUDIO_CHAT_PARITY_IDENTITY): the executors of Director's footer, logo and presenter
 * requests. Each calls the click path's own function:
 *  - footer and logo (rows 62 / 63) go through the Master panel's own path (components/presentation-settings-panel.tsx): the viewer opens
 *    the panel (the Show menu's own "Master…"), the panel's own read fills the fields, the requested fields are set as if typed, and the
 *    Save button's own handler writes updateDerivativeElements to the viewer and closes the panel. A logo generation (paid, row 63) runs
 *    the panel's own generate handler; the Director's cost card confirms it first, and the sub-flag NEXT_PUBLIC_STUDIO_CHAT_PARITY_PAID_LOGO is a kill switch (off until PK rules).
 *    Clear footer and remove logo need no confirm (DIRECTOR-2, 27 Oct: chat undo restores them).
 *  - presenter details (row 64) go through the identity dialog's own writer (lib/deck-identity.ts writeDeckIdentityForm): localStorage plus
 *    the form event the Builder listens for, so the next user_message carries them as deck_identity. Values are the user's own words.
 */

import { isDeckIdentityEnabled, readDeckIdentityForm, writeDeckIdentityForm } from '@/lib/deck-identity'
import {
  chatParityBus, chatParityIdentityArgs, chatParityMasterOp, chatParityPaidBlocked, chatParityResult,
  type ChatParityMasterResult, type ChatParityRequest, type ChatParityResultData,
} from '@/lib/studio-chat-parity'

/** What the page hands the identity executors. */
export interface ChatParityIdentityDeps {
  now: () => number
  /** How long the Master panel may take for one op (the runner's wait is longer). */
  masterTimeoutMs: number
}

type Result = ChatParityResultData
const fail = (id: string, code: Parameters<typeof chatParityResult>[2]) => chatParityResult(id, 'failed', code)

/** Runs one identity request (the action is one of CHAT_PARITY_ACTIONS.identity) to a known status. */
export async function runChatParityIdentityAction(request: ChatParityRequest, presentationId: string | null, deps: ChatParityIdentityDeps): Promise<Result> {
  const id = request.requestId
  const args = chatParityIdentityArgs(request.action, request.args)
  if (!args) return fail(id, 'invalid_args')
  if (args.action === 'set_deck_identity') {
    if (!isDeckIdentityEnabled()) return fail(id, 'flag_off')
    const { action: _action, logo_url, ...rest } = args
    const next = writeDeckIdentityForm({ ...readDeckIdentityForm(), ...rest, ...(logo_url ? { logoUrl: logo_url } : {}) })
    return chatParityResult(id, 'done', null, { company: next.company ?? null, confidentiality: next.confidentiality ?? null, logo_url: next.logoUrl ?? null })
  }
  // A paid action (generate_logo): the Director's cost card confirmed it before the frame was sent (DIRECTOR-2, 27 Oct 07:29Z), so no second confirm here; the sub-flag is a kill switch.
  if (chatParityPaidBlocked(args.action)) return fail(id, 'flag_off')
  const op = chatParityMasterOp(args)
  if (!op) return fail(id, 'unsupported')
  if (!presentationId || !chatParityBus.master || !chatParityBus.openMaster) return fail(id, 'viewer_unavailable')
  let result: ChatParityMasterResult
  try {
    result = await chatParityBus.master(op, deps.now() + deps.masterTimeoutMs)
  } catch {
    return fail(id, 'write_failed')
  }
  if (result.ok) return chatParityResult(id, 'done', null, { kind: op.kind })
  return fail(id, result.error ?? 'write_failed')
}
