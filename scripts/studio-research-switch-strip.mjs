// FRONTEND-1 (PK mandate M4 of 15 Nov 2026, the Research on / off switch). Flag NEXT_PUBLIC_STUDIO_RESEARCH_SWITCH (exact "true", default off, build-time). It acts only with NEXT_PUBLIC_STUDIO_V4_SHELL and NEXT_PUBLIC_STUDIO_CHAT_CLEAN also on.
// Off, the composer is byte for byte what it was. Nothing new is sent: the switch is the composer's web-search state (data.web_search / data.deep_research, which Director already reads and latches).
// Every line this change adds to an EXISTING file carries the marker RESEARCH-SWITCH (matched as a whole token) and is a pure insertion, so the strip is a list of [has, was] pairs whose `was` is empty: putting each back gives the file at BASE_COMMIT
// byte for byte (the level picker's own lines in the same file are another change's and stay, see scripts/studio-thinking-levels-strip.mjs). The new files have no base text.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '3098f860cd97226d6405631bad870a9be5b52523' // origin/studio-v4-dev-preparation-code (#634 merged), the trunk this change sits on
export const RESEARCH_SWITCH_FLAGS = ["NEXT_PUBLIC_STUDIO_RESEARCH_SWITCH"]
export const RESEARCH_SWITCH_MARKER = 'RESEARCH-SWITCH'
/** The marker as a WHOLE token: RESEARCH-SWITCH is this change's; RESEARCH-SWITCH-X and X-RESEARCH-SWITCH are not. */
export const RESEARCH_SWITCH_MARKER_RE = /(?<![\w-])RESEARCH-SWITCH(?![\w-])/
/** The subject prefix of this change's own commits. */
export const RESEARCH_SWITCH_SUBJECT = "Research switch:"

/** Existing files that get marked lines. */
export const RESEARCH_SWITCH_FILES = [
  "components/builder/chat/studio-chat-clean.tsx"
]

/** New files (no base text to put back). */
export const RESEARCH_SWITCH_NEW_FILES = [
  "lib/studio-research-switch.ts",
  "scripts/studio-research-switch-strip.mjs",
  "scripts/test-studio-research-switch.mjs"
]

/** The new libs that read a flag: [file, flag], one literal env read each. */
export const RESEARCH_SWITCH_LIB_FLAGS = [["lib/studio-research-switch.ts", "NEXT_PUBLIC_STUDIO_RESEARCH_SWITCH"]]

/** [text the file has now, text the file had at BASE_COMMIT] per edit (one per marked line, in the order they sit in the file); putting them back gives the base file byte for byte. */
export const RESEARCH_SWITCH_EDITS = {
  "components/builder/chat/studio-chat-clean.tsx": [
    ["import { RESEARCH_COPY, STUDIO_RESEARCH_SWITCH_ENABLED, researchSwitchNext, researchSwitchOn } from '@/lib/studio-research-switch' // RESEARCH-SWITCH (NEXT_PUBLIC_STUDIO_RESEARCH_SWITCH, default off)\n", ""],
    ["      {STUDIO_RESEARCH_SWITCH_ENABLED && !chips ? <button type=\"button\" aria-pressed={researchSwitchOn(research)} disabled={research.locked} onClick={() => { const next = researchSwitchNext(research); if (next !== null) research.onWeb(next) }} data-studio-chat-clean-toggle=\"research\" title={research.locked ? RESEARCH_COPY.lockedNote : RESEARCH_COPY.note}><Search size={11} aria-hidden=\"true\" />{RESEARCH_COPY.label}</button> : null}{/* RESEARCH-SWITCH (NEXT_PUBLIC_STUDIO_RESEARCH_SWITCH, M4): Research on / off beside the model / level button; it is the composer's web-search state (deep research implies it), nothing new on the wire; off, null */}\n", ""],
  ],
}

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, so putting them back gives the previous file byte for byte. */
export const RESEARCH_SWITCH_PIN_MARK = "LATER-CHANGES: registry read (RESEARCH-SWITCH)"
export const RESEARCH_SWITCH_PIN_EDITS = {
  // none: the older proofs read the files through the registry (scripts/studio-later-changes.mjs), which strips this change first
}

/** The older proofs this change teaches. */
export const RESEARCH_SWITCH_PIN_FILES = Object.keys(RESEARCH_SWITCH_PIN_EDITS)

export const RESEARCH_SWITCH_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...RESEARCH_SWITCH_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const RESEARCH_SWITCH_SCOPE_FILES = new Set([...RESEARCH_SWITCH_FILES, ...RESEARCH_SWITCH_NEW_FILES, ...RESEARCH_SWITCH_OWN_EDITS])

/** The whole .env.example block: its comments and its lines. */
export const RESEARCH_SWITCH_ENV_BLOCK = "# STUDIO RESEARCH SWITCH (FRONTEND-1; PK mandate M4, 15 Nov). On for the exact value \"true\"; default off, and then the composer is byte for byte as it was. Build-time value: change it on Vercel and redeploy.\n# On, and only with NEXT_PUBLIC_STUDIO_V4_SHELL and NEXT_PUBLIC_STUDIO_CHAT_CLEAN also exactly \"true\": a \"Research\" on / off chip beside the model / level button in the composer, separate from the level. It is the composer's web-search state (deep research, in the research options menu, implies it): nothing new on the wire, the build request already carries data.web_search and data.deep_research, which Director reads and latches. Off by default, as today; locked once the deck's strawman exists.\nNEXT_PUBLIC_STUDIO_RESEARCH_SWITCH=\"false\"\n"

/** The file with this change's edits put back (the previous text). Used by the strip and the proof. */
export function putBackResearchSwitch(rel, text) {
  return (RESEARCH_SWITCH_EDITS[rel] || RESEARCH_SWITCH_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The file without this change's edits: each [has, was] pair put back; every other byte stays. Any other file is returned as it is. */
export function stripResearchSwitch(rel, text) {
  if (typeof text !== 'string') return text
  if (!(rel in RESEARCH_SWITCH_EDITS) && !(rel in RESEARCH_SWITCH_PIN_EDITS)) return text
  return putBackResearchSwitch(rel, text)
}
