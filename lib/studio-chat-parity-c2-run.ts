// CHAT-PARITY-C2 (FRONTEND-1): the entry point of Director's C2 `studio_action` requests (groups `deck_ops` and `publish`). The page calls it for a request whose group is one of them (the existing runner of lib/studio-chat-parity-runners.ts
// is not touched: its three groups, its executor table and its proofs read exactly what they read). One owner check (the request belongs to the session and the deck on screen, and stays so: the K5 add / refine / theme rule), then
// the group's executor under a budget inside Director's 25 s, then a known status: `unsupported` / `flag_off` for what this build does not run, `invalid_args` for args that do not fit, `not_owner`, `no_deck`, `timeout`, `write_failed`.
// It never rejects and never answers twice. The caller sends `data` (on the delivering socket only, while that socket is current), then runs `after`.

import { chatParityOwnerCheck, type ChatParityDisplayedDeck, type ChatParityOwner } from '@/lib/studio-chat-parity-runners'
import type { ChatParityRequest } from '@/lib/studio-chat-parity'
import {
  chatParityC2Refusal, chatParityC2Result, chatParityDeckOpsArgs, chatParityPublishArgs, type ChatParityC2ErrorCode,
} from '@/lib/studio-chat-parity-c2'
import { CHAT_PARITY_DECKOPS_BUDGET_MS, runChatParityDeckOpsAction, type ChatParityDeckOpsDeps, type ChatParityDeckOpsOutcome } from '@/lib/studio-chat-parity-deckops'
import { CHAT_PARITY_PUBLISH_BUDGET_MS, runChatParityPublishAction, type ChatParityPublishDeps } from '@/lib/studio-chat-parity-publish'

/** What the page hands the C2 runner: the displayed deck, and each group's deps (present only with that group's flag on). */
export interface ChatParityC2Deps {
  displayed: () => ChatParityDisplayedDeck
  deckOps?: ChatParityDeckOpsDeps
  publish?: ChatParityPublishDeps
}

export type ChatParityC2Outcome = ChatParityDeckOpsOutcome

function withTimeout<T>(run: Promise<T>, ms: number, onTimeout: () => T): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => { if (!settled) { settled = true; resolve(onTimeout()) } }, ms)
    run.then(value => { if (!settled) { settled = true; clearTimeout(timer); resolve(value) } }, error => { if (!settled) { settled = true; clearTimeout(timer); reject(error) } })
  })
}

export async function runChatParityC2Action(request: ChatParityRequest, owner: ChatParityOwner, deps: ChatParityC2Deps, message: { session_id?: string } | null = null): Promise<ChatParityC2Outcome> {
  const fail = (code: ChatParityC2ErrorCode): ChatParityC2Outcome => ({ data: chatParityC2Result(request.requestId, 'failed', code), after: null })
  const group = request.group as string
  const refusal = chatParityC2Refusal(request, { deck_ops: Boolean(deps.deckOps), publish: Boolean(deps.publish) })
  if (refusal) return fail(refusal)
  const check = chatParityOwnerCheck(request, message, owner, deps.displayed)
  if (!check.ok) return fail('not_owner')
  // Every action but a blank canvas is for a deck; a request that names none (Director sends an empty id for a session with no deck) has nothing to act on.
  if (request.action !== 'start_blank_canvas' && request.presentationId === null) return fail('no_deck')
  try {
    if (group === 'deck_ops' && deps.deckOps) {
      const args = chatParityDeckOpsArgs(request.action, request.args)
      if (!args) return fail('invalid_args')
      return await withTimeout(runChatParityDeckOpsAction(request.requestId, args, deps.deckOps), CHAT_PARITY_DECKOPS_BUDGET_MS, () => fail('timeout'))
    }
    if (group === 'publish' && deps.publish) {
      const args = chatParityPublishArgs(request.action, request.args)
      if (!args) return fail('invalid_args')
      return await withTimeout(runChatParityPublishAction(request.requestId, request.presentationId, args, deps.publish), CHAT_PARITY_PUBLISH_BUDGET_MS, () => fail('timeout'))
    }
    return fail('flag_off')
  } catch {
    return fail('write_failed')
  }
}
