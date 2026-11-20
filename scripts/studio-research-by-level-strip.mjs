// FRONTEND-1 (wave 1 step 0.5c "research by level"; the rules were settled by DIRECTOR-2, AGENT-1G and FRONTEND-1). Flag NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_BY_LEVEL (the exact "true", default off, build-time).
// In a chat with no outline yet, moving the thinking-level picker to Best or Max turns web search on; moving it to anything else (Fast, Balanced, Auto, the automatic return to Auto after a run or a chat change included) turns it off again if THIS rule turned it on; the person's own change of the web switch (or of Deep research) in a chat always wins; an outline ends the rule; a new chat starts over. Deep research and the knowledge graph are not touched.
// The decision is a pure function (lib/studio-research-by-level.ts, researchByLevel); the Builder page keeps one state per chat in a ref, runs ONE marked effect on the shown level / chat / outline, and notes the person's own change of the two research switches, keyed to the chat the page shows (a chat that is still loading included), by two marked wrappers handed to the composer through one marked prop spread, and the dashboard hand-off's switches (the person's own choice, for the chat it opens) by one marked line next to the hand-off's setters. Off, nothing runs.
// Every line this change adds to an EXISTING file carries the marker RESEARCH-BY-LEVEL (matched as a whole token) and is a PURE INSERTION (no base line is rewritten: the page gains 12 lines in five places), so the strip is a list of [has, was] pairs whose `was` is empty: putting each back gives the file at BASE_COMMIT byte for byte. The new files have no base text.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.
// Five older proofs are TAUGHT inserted marked lines only (RESEARCH_BY_LEVEL_PIN_EDITS, pure insertions): the two that read the first-parent line of BASE..HEAD each drop this change's subject from it (as for every later change), and the three that pin the raw Builder page (the plan-based research default's proof pins every line that reads or sets web search, and this change reads and sets it in marked lines; the hero-only Replace picture's and the My companions wiring proofs hold the page to dev's, byte for byte) read it through this change's own strip, as the hero-only change taught the Replace picture proof; putting those lines back gives each proof's previous text byte for byte.

export const BASE_COMMIT = "fa3a65176fd141247e8c7b472dedfb9eee90f312" // origin/frontend1/levels-direct-live (PR 644: dev 8db4ce8e with #642 merged, then the Levels direct live commits), the head this change is stacked on: the Studio Drafts are one line, dev 8db4ce8e, PR 644, this change. The page, the older proofs this change teaches, .env.example and the registry are read at it; it moves to the trunk when PR 644 merges (as for every stacked change)
export const RESEARCH_BY_LEVEL_FLAGS = ["NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_BY_LEVEL"]
export const RESEARCH_BY_LEVEL_MARKER = 'RESEARCH-BY-LEVEL'
/** The marker as a WHOLE token: RESEARCH-BY-LEVEL is this change's; RESEARCH-BY-LEVEL-X and X-RESEARCH-BY-LEVEL are not (nor is the plan-based default's own marker). */
export const RESEARCH_BY_LEVEL_MARKER_RE = /(?<![\w-])RESEARCH-BY-LEVEL(?![\w-])/
/** The subject prefix of this change's own commits. */
export const RESEARCH_BY_LEVEL_SUBJECT = "Research by level:"

/** Existing files that get marked lines. */
export const RESEARCH_BY_LEVEL_FILES = [
  "app/builder/page.tsx"
]

/** New files (no base text to put back). */
export const RESEARCH_BY_LEVEL_NEW_FILES = [
  "lib/studio-research-by-level.ts",
  "scripts/studio-research-by-level-strip.mjs",
  "scripts/test-studio-research-by-level.mjs"
]

/** The new libs that read a flag: [file, flag], one literal env read each. */
export const RESEARCH_BY_LEVEL_LIB_FLAGS = [["lib/studio-research-by-level.ts", "NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_BY_LEVEL"]]

/** [text the file has now, text the file had at BASE_COMMIT] per edit (one per marked line, in the order they sit in the file); putting them back gives the base file byte for byte. */
export const RESEARCH_BY_LEVEL_EDITS = {
  "app/builder/page.tsx": [
    [
      "  const researchLevelRef = useRef<ResearchByLevelState>(RESEARCH_BY_LEVEL_FRESH) // RESEARCH-BY-LEVEL (NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_BY_LEVEL, default off): what the rule knows of this chat: which chat, whether the person changed the web switch in it (or for the chat being opened, while it loads), whether the rule itself turned web search on (lib/studio-research-by-level.ts)\n",
      ""
    ],
    [
      "  const researchByPerson = useCallback((enabled: boolean) => { researchLevelRef.current = researchByLevel(researchLevelRef.current, { kind: 'touch', chat: currentSessionId }).state; handleResearchEnabledChange(enabled) }, [handleResearchEnabledChange, currentSessionId]) // RESEARCH-BY-LEVEL: the composer's Deep research switch, as the base handles it; the person's own change is noted first, for the chat the page shows now (a chat that is still loading included; turning Deep research on turns web search on)\n",
      ""
    ],
    [
      "  const webSearchByPerson = useCallback((enabled: boolean) => { researchLevelRef.current = researchByLevel(researchLevelRef.current, { kind: 'touch', chat: currentSessionId }).state; handleWebSearchEnabledChange(enabled) }, [handleWebSearchEnabledChange, currentSessionId]) // RESEARCH-BY-LEVEL: the composer's web search switch (and /web), as the base handles it; the person's own change is noted first, for the chat the page shows now (a chat that is still loading included), and always wins\n",
      ""
    ],
    [
      "  useEffect(() => { // RESEARCH-BY-LEVEL (NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_BY_LEVEL, default off): in a chat with no outline yet, the shown level Best or Max turns web search on; any other level (Auto after a run or a chat change included) turns it off again if this rule turned it on; the person's own change of the switch in the chat always wins; an outline ends the rule; a new chat starts over; deep research and the knowledge graph are not touched (lib/studio-research-by-level.ts)\n",
      ""
    ],
    [
      "    if (!STUDIO_RESEARCH_DEFAULT_BY_LEVEL || session.isLoadingSession) return // RESEARCH-BY-LEVEL: flag off, nothing here runs; a chat still loading is not decided (the end of loading runs this again)\n",
      ""
    ],
    [
      "    const decided = researchByLevel(researchLevelRef.current, { kind: 'level', chat: currentSessionId, level: shownThinkingLevel, noOutline: !(hasStrawman || strawmanPreviewUrl || strawmanPresentationId || finalPresentationUrl || finalPresentationId), web: webSearchEnabled }) // RESEARCH-BY-LEVEL\n",
      ""
    ],
    [
      "    researchLevelRef.current = decided.state // RESEARCH-BY-LEVEL\n",
      ""
    ],
    [
      "    if (decided.web !== undefined) setWebSearchEnabled(decided.web) // RESEARCH-BY-LEVEL\n",
      ""
    ],
    [
      "  }, [currentSessionId, shownThinkingLevel, hasStrawman, strawmanPreviewUrl, strawmanPresentationId, finalPresentationUrl, finalPresentationId, session.isLoadingSession]) // RESEARCH-BY-LEVEL\n",
      ""
    ],
    [
      "    if (STUDIO_RESEARCH_DEFAULT_BY_LEVEL) researchLevelRef.current = researchByLevel(researchLevelRef.current, { kind: 'touch', chat: pending.new_session_id }).state // RESEARCH-BY-LEVEL (NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_BY_LEVEL, default off): the switches this hand-off set are what the person chose on the dashboard composer and sent with the message, so they count as the person's own change for the chat it opens, whatever their value: in a chat started from the dashboard the rule does nothing\n",
      ""
    ],
    [
      "                    {...(STUDIO_RESEARCH_DEFAULT_BY_LEVEL ? { onResearchEnabledChange: researchByPerson, onWebSearchEnabledChange: webSearchByPerson } : ({} as { onResearchEnabledChange?: typeof researchByPerson; onWebSearchEnabledChange?: typeof webSearchByPerson }))} // RESEARCH-BY-LEVEL (NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_BY_LEVEL): the two research switches (the composer's, and /research and /web through the same props) note the person's own change before the base's handlers run; off, the base's props stand\n",
      ""
    ],
    [
      "import { RESEARCH_BY_LEVEL_FRESH, STUDIO_RESEARCH_DEFAULT_BY_LEVEL, researchByLevel, type ResearchByLevelState } from '@/lib/studio-research-by-level' // RESEARCH-BY-LEVEL\n",
      ""
    ]
  ]
}

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, so putting them back gives the previous file byte for byte. */
export const RESEARCH_BY_LEVEL_PIN_MARK = "LATER-CHANGES: registry read (RESEARCH-BY-LEVEL)"
export const RESEARCH_BY_LEVEL_PIN_EDITS = {
  "scripts/test-studio-research-default.mjs": [
    [
      "import { stripResearchByLevel, RESEARCH_BY_LEVEL_FILES } from './studio-research-by-level-strip.mjs' // LATER-CHANGES: registry read (RESEARCH-BY-LEVEL): the research-by-level change (stacked after this change) marks lines in the Builder page, a second writer and reader of web search; this proof reads the page as this change left it\n",
      ""
    ],
    [
      "{ const realRead = fs.readFileSync; fs.readFileSync = function (file, ...rest) { const out = realRead.call(this, file, ...rest); const rel = typeof file === 'string' ? path.relative(root, file) : ''; return typeof out === 'string' && RESEARCH_BY_LEVEL_FILES.includes(rel) ? stripResearchByLevel(rel, out) : out } } // LATER-CHANGES: registry read (RESEARCH-BY-LEVEL): every read of a file the research-by-level change marks goes through that change's own strip (never the registry), so this proof sees the file as this change left it\n",
      ""
    ]
  ],
  "scripts/test-studio-replace-picture-hero-only.mjs": [
    [
      "import { stripResearchByLevel, RESEARCH_BY_LEVEL_FILES } from './studio-research-by-level-strip.mjs' // LATER-CHANGES: registry read (RESEARCH-BY-LEVEL): the research-by-level change (stacked after this change) marks lines in the Builder page; this proof checks that the page is dev's, so it reads the page as this change left it\n",
      ""
    ],
    [
      "{ const realRead = fs.readFileSync; fs.readFileSync = function (file, ...rest) { const out = realRead.call(this, file, ...rest); const rel = typeof file === 'string' ? path.relative(root, file) : ''; return typeof out === 'string' && RESEARCH_BY_LEVEL_FILES.includes(rel) ? stripResearchByLevel(rel, out) : out } } // LATER-CHANGES: registry read (RESEARCH-BY-LEVEL): every read of a file the research-by-level change marks goes through that change's own strip (never the registry), so this proof sees the file as this change left it\n",
      ""
    ]
  ],
  "scripts/test-studio-my-companions-wiring.mjs": [
    [
      "import { stripResearchByLevel, RESEARCH_BY_LEVEL_FILES } from './studio-research-by-level-strip.mjs' // LATER-CHANGES: registry read (RESEARCH-BY-LEVEL): the research-by-level change (stacked after this change and after the live Best and Max change) marks lines in the Builder page; this proof checks that the page is dev's, so it reads the page as this change left it\n",
      ""
    ],
    [
      "{ const realRead = fs.readFileSync; fs.readFileSync = function (file, ...rest) { const out = realRead.call(this, file, ...rest); const rel = typeof file === 'string' ? path.relative(root, file) : ''; return typeof out === 'string' && RESEARCH_BY_LEVEL_FILES.includes(rel) ? stripResearchByLevel(rel, out) : out } } // LATER-CHANGES: registry read (RESEARCH-BY-LEVEL): every read of a file the research-by-level change marks goes through that change's own strip (never the registry), so this proof sees the file as this change left it\n",
      ""
    ]
  ],
  "scripts/test-studio-chat-element-edit.mjs": [
    [
      "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Research by level:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (RESEARCH-BY-LEVEL): on a branch stacked after this change (research by level, wave 1 step 0.5c), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n",
      ""
    ]
  ],
  "scripts/test-studio-deck-sync-truth.mjs": [
    [
      "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Research by level:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (RESEARCH-BY-LEVEL): on a branch stacked after this change (research by level, wave 1 step 0.5c), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n",
      ""
    ]
  ]
}

/** The older proofs this change teaches. */
export const RESEARCH_BY_LEVEL_PIN_FILES = Object.keys(RESEARCH_BY_LEVEL_PIN_EDITS)

export const RESEARCH_BY_LEVEL_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...RESEARCH_BY_LEVEL_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const RESEARCH_BY_LEVEL_SCOPE_FILES = new Set([...RESEARCH_BY_LEVEL_FILES, ...RESEARCH_BY_LEVEL_NEW_FILES, ...RESEARCH_BY_LEVEL_OWN_EDITS])

/** The whole .env.example block: its comments and its line. */
export const RESEARCH_BY_LEVEL_ENV_BLOCK = "# STUDIO RESEARCH DEFAULT BY LEVEL (FRONTEND-1, wave 1 step 0.5c). On for the exact value \"true\"; default off, and then the Builder page behaves as it did. Build-time value: change it on Vercel and redeploy. This is the levels-3/4 default: web search by thinking level. It acts only where the level picker itself is on and shows Best and Max.\n# On, in a chat with no outline yet: moving the level picker to Best or Max turns web search on. Moving it to Fast, Balanced or back to Auto (the automatic return to Auto after a run or a chat change included) turns it off again, but only when this rule is the one that turned it on, and only while the chat still has no outline. The person's own change of the web search switch (or of Deep research) in a chat always wins: after it this rule does nothing more in that chat. A new chat starts over. Once the chat has an outline the rule does nothing. Deep research and the knowledge graph are never touched.\n# Off, nothing here runs. Every level later is the plan-based research default, which has its own flags.\nNEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_BY_LEVEL=\"false\"\n"

/** The file with this change's edits put back (the previous text). Used by the strip and the proof. */
export function putBackResearchByLevel(rel, text) {
  return (RESEARCH_BY_LEVEL_EDITS[rel] || RESEARCH_BY_LEVEL_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The file without this change's edits: each [has, was] pair put back; every other byte stays. Any other file is returned as it is. */
export function stripResearchByLevel(rel, text) {
  if (typeof text !== 'string') return text
  if (!(rel in RESEARCH_BY_LEVEL_EDITS) && !(rel in RESEARCH_BY_LEVEL_PIN_EDITS)) return text
  return putBackResearchByLevel(rel, text)
}
