// KNOWLEDGE-3 for FRONTEND-1 (the Research default). Flags NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON and NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_FREE (each the exact "true", each default off, build-time).
// On a new chat, or a chat with no outline yet, web search starts on for paid plans (starter, pro, premium); free plans only when NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_FREE is also on. A chat that already has an outline opens with web search off, as before. Deep research is unchanged.
// How: ONE marked effect in the Builder page, once per chat, when the plan is known (agentPlanOf(user.tier), the page's agentPlan) and the chat has loaded, sets web search to researchDefaultFor(plan, flags) (lib/studio-research-default.ts) unless the chat already has its outline
// (the loaded row's strawman or final deck, or Director's hasStrawman latch) or the person changed the switch in that chat first (the effect sees the switch's value change in that chat before it has decided). The first state of web search, the new-chat reset, the two switch handlers and the session restore are the BASE's lines.
// Off, the page behaves as it did (the effect returns first). Nothing in the hook or the composer changes: web_search already goes out on every build message.
// Every line this change adds to an EXISTING file carries the marker RESEARCH-DEFAULT (matched as a whole token) and is a PURE INSERTION (no base line is rewritten or touched: the page gains thirteen lines in two places), so the strip is a list of [has, was] pairs whose `was` is empty: putting each back gives the file at BASE_COMMIT byte for byte. The new files have no base text.
// How the older pins reach it: this change REGISTERS its files, its .env.example blocks and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.
// Two older proofs are TAUGHT one line each (RESEARCH_DEFAULT_PIN_EDITS, pure insertions): they read the first-parent line of BASE..HEAD, which carries this change's own commits, so each drops this change's subject from it (as for every later change); putting those lines back gives each proof's previous text byte for byte.

export const BASE_COMMIT = '0dcc90d0eecd2bba078fb3e334216afe722b5f78' // origin/studio-v4-dev-preparation-code (#638 merged), the trunk this change sits on
export const RESEARCH_DEFAULT_FLAGS = ["NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON", "NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_FREE"]
export const RESEARCH_DEFAULT_MARKER = 'RESEARCH-DEFAULT'
/** The marker as a WHOLE token: RESEARCH-DEFAULT is this change's; RESEARCH-DEFAULT-X and X-RESEARCH-DEFAULT are not. */
export const RESEARCH_DEFAULT_MARKER_RE = /(?<![\w-])RESEARCH-DEFAULT(?![\w-])/
/** The subject prefix of this change's own commits. */
export const RESEARCH_DEFAULT_SUBJECT = "Research default:"

/** Existing files that get marked lines. */
export const RESEARCH_DEFAULT_FILES = [
  "app/builder/page.tsx"
]

/** New files (no base text to put back). */
export const RESEARCH_DEFAULT_NEW_FILES = [
  "lib/studio-research-default.ts",
  "scripts/studio-research-default-strip.mjs",
  "scripts/test-studio-research-default.mjs"
]

/** The new libs that read a flag: [file, flag], one literal env read each. */
export const RESEARCH_DEFAULT_LIB_FLAGS = [["lib/studio-research-default.ts", "NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON"], ["lib/studio-research-default.ts", "NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_FREE"]]

/** [text the file has now, text the file had at BASE_COMMIT] per edit (one per marked insertion, in the order they sit in the file); putting them back gives the base file byte for byte. */
export const RESEARCH_DEFAULT_EDITS = {
  "app/builder/page.tsx": [
    [
      "  const researchChatRef = useRef<{ id: string | null; applied: boolean; touched: boolean; web: boolean }>({ id: null, applied: false, touched: false, web: false }) // RESEARCH-DEFAULT (NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON / _FREE, default off): the chat the default was last decided for, whether it has been (once per chat), whether the person changed the switch in it first, and the switch's value as last seen\n",
      ""
    ],
    [
      "  useEffect(() => { // RESEARCH-DEFAULT (NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON / _FREE, default off): once per chat, when the plan is known and the chat has loaded, web search starts at the plan's default (paid on; free only with the FREE flag); a chat that already has its outline (the loaded row's, or Director's latch) gets off, as before; a switch the person changed in this chat first stands; an outline appearing later in the same chat changes nothing (it is decided once)\n",
      ""
    ],
    [
      "    if (!STUDIO_RESEARCH_DEFAULT_ON) return // RESEARCH-DEFAULT: flag off, nothing here runs\n",
      ""
    ],
    [
      "    const chat = researchChatRef.current // RESEARCH-DEFAULT\n",
      ""
    ],
    [
      "    if (chat.id !== currentSessionId) { if (chat.id !== null) { chat.applied = false; chat.touched = false } chat.id = currentSessionId } // RESEARCH-DEFAULT: another chat starts over (the new-chat reset lands here, with its new id); a change made before the page's first chat had an id stays with it\n",
      ""
    ],
    [
      "    else if (webSearchEnabled !== chat.web && !chat.applied) chat.touched = true // RESEARCH-DEFAULT: the switch changed in this chat before its default was decided: the person's own change, whenever the plan arrives, is not overridden\n",
      ""
    ],
    [
      "    chat.web = webSearchEnabled // RESEARCH-DEFAULT\n",
      ""
    ],
    [
      "    if (!currentSessionId || agentPlan === null || session.isLoadingSession || chat.applied) return // RESEARCH-DEFAULT: wait for the plan and for the chat's load (the restore and the end of loading commit together); decided once per chat\n",
      ""
    ],
    [
      "    chat.applied = true // RESEARCH-DEFAULT\n",
      ""
    ],
    [
      "    if (chat.touched) return // RESEARCH-DEFAULT\n",
      ""
    ],
    [
      "    setWebSearchEnabled(!(hasStrawman || strawmanPreviewUrl || strawmanPresentationId || finalPresentationUrl || finalPresentationId) && researchDefaultFor(agentPlan, { on: STUDIO_RESEARCH_DEFAULT_ON, free: STUDIO_RESEARCH_DEFAULT_FREE })) // RESEARCH-DEFAULT: an outlined chat gets off, any other chat the plan's default; deep research is not touched\n",
      ""
    ],
    [
      "  }, [currentSessionId, agentPlan, hasStrawman, session.isLoadingSession, webSearchEnabled]) // RESEARCH-DEFAULT\n",
      ""
    ],
    [
      "import { STUDIO_RESEARCH_DEFAULT_FREE, STUDIO_RESEARCH_DEFAULT_ON, researchDefaultFor } from '@/lib/studio-research-default' // RESEARCH-DEFAULT\n",
      ""
    ]
  ]
}

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, so putting them back gives the previous file byte for byte. */
export const RESEARCH_DEFAULT_PIN_MARK = "LATER-CHANGES: registry read (RESEARCH-DEFAULT)"
export const RESEARCH_DEFAULT_PIN_EDITS = {
  "scripts/test-studio-chat-element-edit.mjs": [
    [
      "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Research default:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (RESEARCH-DEFAULT): on a branch stacked after this change (the Research default), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n",
      ""
    ]
  ],
  "scripts/test-studio-deck-sync-truth.mjs": [
    [
      "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Research default:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (RESEARCH-DEFAULT): on a branch stacked after this change (the Research default), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n",
      ""
    ]
  ]
}

/** The older proofs this change teaches. */
export const RESEARCH_DEFAULT_PIN_FILES = Object.keys(RESEARCH_DEFAULT_PIN_EDITS)

export const RESEARCH_DEFAULT_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...RESEARCH_DEFAULT_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const RESEARCH_DEFAULT_SCOPE_FILES = new Set([...RESEARCH_DEFAULT_FILES, ...RESEARCH_DEFAULT_NEW_FILES, ...RESEARCH_DEFAULT_OWN_EDITS])

/** The whole .env.example block: the comments and the line of each of the two flags (one blank line between them). */
export const RESEARCH_DEFAULT_ENV_BLOCK = "# STUDIO RESEARCH DEFAULT (KNOWLEDGE-3 for FRONTEND-1). On for the exact value \"true\"; default off, and then the Builder page behaves as it did. Build-time value: change it on Vercel and redeploy. The plan is read from the signed-in session (agentPlanOf(user.tier)); a paid plan is starter, pro or premium.\n# On a new chat, or a chat with no outline yet, web search starts on for paid plans (starter, pro, premium); free plans only when NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_FREE is also on. A chat that already has an outline opens with web search off, as before. Deep research is unchanged. (Once per chat, when the plan is known and the chat has loaded, web search is set to the plan's default, unless the chat already has its outline or the person changed the switch in that chat first; an outline appearing later in the same chat changes nothing.) The build message already carries data.web_search on every send, so nothing else changes.\nNEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON=\"false\"\n\n# STUDIO RESEARCH DEFAULT FREE (KNOWLEDGE-3 for FRONTEND-1). On for the exact value \"true\"; default off. It does nothing while NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON is off; with both on, the free plan gets the default too. Build-time value, as above.\n# On a new chat, or a chat with no outline yet, web search starts on for paid plans (starter, pro, premium); free plans only when NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_FREE is also on. A chat that already has an outline opens with web search off, as before. Deep research is unchanged.\nNEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_FREE=\"false\"\n"

/** The file with this change's edits put back (the previous text). Used by the strip and the proof. */
export function putBackResearchDefault(rel, text) {
  return (RESEARCH_DEFAULT_EDITS[rel] || RESEARCH_DEFAULT_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The file without this change's edits: each [has, was] pair put back; every other byte stays. Any other file is returned as it is. */
export function stripResearchDefault(rel, text) {
  if (typeof text !== 'string') return text
  if (!(rel in RESEARCH_DEFAULT_EDITS) && !(rel in RESEARCH_DEFAULT_PIN_EDITS)) return text
  return putBackResearchDefault(rel, text)
}
