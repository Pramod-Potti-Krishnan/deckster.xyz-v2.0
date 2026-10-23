// FRONTEND-2: Director's new-deck handoff sends its brief on the NEW session's socket (NEXT_PUBLIC_STUDIO_NEW_DECK_HANDOFF_SEND, default off).
// The exact text this change adds to the files it touches, so a pin that holds one of them to an earlier commit can first put the base text
// back (stripNewDeckHandoffSend(rel, text)), the way the other *-strip.mjs files do. scripts/test-studio-new-deck-handoff-send.mjs proves that
// stripping gives back BASE_COMMIT's file byte for byte. Every piece is a pure insertion, removed on its own (no neighbouring text is needed),
// .env.example's block included. New files (no base text to put back): NEW_DECK_HANDOFF_SEND_NEW_FILES below.

export const BASE_COMMIT = '45231a219c333d29a8cbf3fea9768c179ba7be7f'

const ENV_BLOCK = `# NEW-DECK HANDOFF SEND (FRONTEND-2, the Builder; Director's new_session directive, MDC P4 / K3). On for the exact value "true"; default
# off, and then nothing changes. Build-time value: change it on Vercel and redeploy. It matters only with NEXT_PUBLIC_CHAT_DIRECTIVES on
# (Director sends session_directive only to mdc1 clients). On: when Director's new_session directive carries auto_send, Studio opens the
# fresh session, shows the brief as the user's message and sends it there exactly once, as an ordinary user_message with the usual
# client_caps, right after the NEW session's socket opens; a reconnect, a socket that drops and opens again, or a retry never sends it a
# second time. If that socket does not open within 12 s, nothing is sent and nothing is retried: the message is taken away, the brief goes
# back in the input box and the usual "Couldn't reach the Director" notice shows, so the user sends it. Off: the old path, whose send still
# waited on the old session's socket and so never went out. A directive without auto_send only fills the input box, on or off.
NEXT_PUBLIC_STUDIO_NEW_DECK_HANDOFF_SEND="false"

`

const PAGE_IMPORT = `// NEXT_PUBLIC_STUDIO_NEW_DECK_HANDOFF_SEND (default off): Director's new-deck handoff sends its brief on the NEW session's socket, once (hooks/use-studio-new-deck-handoff-send.ts).
import { STUDIO_NEW_DECK_HANDOFF_SEND_ENABLED, useStudioNewDeckHandoffSend } from '@/hooks/use-studio-new-deck-handoff-send'
`

export const NEW_DECK_HANDOFF_PAGE_DIRECTIVE = `        // NEXT_PUBLIC_STUDIO_NEW_DECK_HANDOFF_SEND: the brief goes out once the NEW session's socket is open, exactly once (the hook below). Off: the send below, as before.
        if (STUDIO_NEW_DECK_HANDOFF_SEND_ENABLED) { armNewDeckHandoffSend({ sessionId: session.currentSessionIdRef.current, text: prefill, bubbleId: \`user-nd-\${ts}\`, options: { ...(deckIdentityRef.current ? { deckIdentity: deckIdentityRef.current } : {}) } }); return }
`

export const NEW_DECK_HANDOFF_PAGE_HOOK = `  // NEXT_PUBLIC_STUDIO_NEW_DECK_HANDOFF_SEND (default off): the brief of Director's new-deck handoff, sent on the NEW session's socket once it opens, once; not sent: back in the box.
  const armNewDeckHandoffSend = useStudioNewDeckHandoffSend({ currentSessionId, wsSessionId, socketSessionId, connected, connectionGeneration, sendMessageWhenConnected, setInputMessage, setUserMessages: session.setUserMessages, toast })
`

// [text this change has, text the base has]; each `added` is a literal that occurs once in the file.
const CHANGES = {
  '.env.example': [[ENV_BLOCK, '']],
  'app/builder/page.tsx': [
    [PAGE_IMPORT, ''],
    [NEW_DECK_HANDOFF_PAGE_DIRECTIVE, ''],
    [NEW_DECK_HANDOFF_PAGE_HOOK, ''],
  ],
}

export const NEW_DECK_HANDOFF_SEND_FILES = Object.keys(CHANGES)
export const NEW_DECK_HANDOFF_SEND_NEW_FILES = ['hooks/use-studio-new-deck-handoff-send.ts',
  'scripts/studio-new-deck-handoff-send-strip.mjs', 'scripts/test-studio-new-deck-handoff-send.mjs',
  // DIRECTOR-2's recorded frames (deckster-workspace streams/director2/preview-b/frames/c-redirect-mdc1.json), copied verbatim.
  'scripts/fixtures/studio-new-deck-handoff-send/c-redirect-mdc1.json']
export const NEW_DECK_HANDOFF_SEND_CHANGES = CHANGES

/** The file without this change's lines. Any other file (or a file that no longer carries them) is returned as it is. */
export function stripNewDeckHandoffSend(rel, text) {
  const table = CHANGES[rel]
  if (!table) return text
  return table.reduce((out, [added, original]) => out.replace(added, () => original), text)
}
