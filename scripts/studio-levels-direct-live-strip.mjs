// FRONTEND-1 (wave 1 step 4.1c: Director now has a real direct route for Best and Max, which the level picker still calls "Coming soon: runs as Balanced for now."). Flags NEXT_PUBLIC_STUDIO_THINKING_LEVELS_DIRECT_LIVE and NEXT_PUBLIC_STUDIO_THINKING_LEVELS_MAX_LIVE (each exact "true", default off, build-time).
// DIRECT_LIVE acts only where the direct preview (NEXT_PUBLIC_STUDIO_THINKING_LEVELS_DIRECT_PREVIEW, with the picker on) already acts: Best is live (its line says what it does, its stop is not marked coming soon). MAX_LIVE acts only with DIRECT_LIVE also on: Max is live the same way, and Max is pickable on the Max plan (premium) only;
// a Pro user sees it disabled with "Max is on the Max plan." (Director's route for it needs a premium claim); Free, Starter and a plan not loaded keep the Agent shell's reasons. Max not live keeps today's words and plan rule exactly, even with DIRECT_LIVE on. Off, nothing changes: the picker, the page, the hook and the wire (build_mode, thinking_level) are what they were.
// Every line this change adds to an EXISTING file carries the marker LEVELS-DIRECT-LIVE (matched as a whole token). It touches ONE existing file, the level lib (lib/studio-thinking-levels.ts), and the level picker's component, the page and the hook are not edited at all: they read the lib's defaults, which now follow the two flags.
// Most of the lib's lines are PURE INSERTIONS; a few base lines are REWRITTEN (the ThinkingFlags shape and FLAGS_NOW, levelRefusal's and stopLine's signatures, the one-line bodies of thinkingStops and thinkingView, and the refusal call in levelPick: each gains the flags it must pass on), so the strip is a list of [has, was] pairs (a pure insertion has an empty `was`):
// putting each pair back gives the file at BASE_COMMIT byte for byte. The base constants (LEVEL_COPY.line best and max, LEVEL_COPY.comingSoon) are untouched: the live words are a new constant, LEVEL_COPY_LIVE. The new files have no base text.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.
// Older proofs are TAUGHT inserted marked lines only (LEVELS_DIRECT_LIVE_PIN_EDITS, pure insertions): the two that read the first-parent line each drop this change's subject from it, as for every later change; putting those lines back gives each proof's previous text byte for byte.

export const BASE_COMMIT = '659f66d7a431711f27c8ad54acb1505c0f3b3265' // origin/studio-v4-dev-preparation-code (#640 merged), the trunk this change sits on
export const LEVELS_DIRECT_LIVE_FLAGS = ["NEXT_PUBLIC_STUDIO_THINKING_LEVELS_DIRECT_LIVE", "NEXT_PUBLIC_STUDIO_THINKING_LEVELS_MAX_LIVE"]
export const LEVELS_DIRECT_LIVE_MARKER = 'LEVELS-DIRECT-LIVE'
/** The marker as a WHOLE token: LEVELS-DIRECT-LIVE is this change's; THINKING-LEVELS (the level picker's own marker) and X-LEVELS-DIRECT-LIVE are not. */
export const LEVELS_DIRECT_LIVE_MARKER_RE = /(?<![\w-])LEVELS-DIRECT-LIVE(?![\w-])/
/** The subject prefix of this change's own commits. */
export const LEVELS_DIRECT_LIVE_SUBJECT = "Levels direct live:"

/** Existing files that get marked lines. */
export const LEVELS_DIRECT_LIVE_FILES = [
  "lib/studio-thinking-levels.ts"
]

/** New files (no base text to put back). */
export const LEVELS_DIRECT_LIVE_NEW_FILES = [
  "scripts/studio-levels-direct-live-strip.mjs",
  "scripts/test-studio-levels-direct-live.mjs"
]

/** The libs that read a flag: [file, flag], one literal env read each. */
export const LEVELS_DIRECT_LIVE_LIB_FLAGS = [["lib/studio-thinking-levels.ts", "NEXT_PUBLIC_STUDIO_THINKING_LEVELS_DIRECT_LIVE"], ["lib/studio-thinking-levels.ts", "NEXT_PUBLIC_STUDIO_THINKING_LEVELS_MAX_LIVE"]]

/** [text the file has now, text the file had at BASE_COMMIT] per edit (one per marked line, in the order they sit in the file); putting them back gives the base file byte for byte. */
export const LEVELS_DIRECT_LIVE_EDITS = {
  "lib/studio-thinking-levels.ts": [
    [
      "export const studioThinkingDirectLiveOn = (live: string | undefined, directPreviewOn: boolean): boolean => directPreviewOn && live === 'true' // LEVELS-DIRECT-LIVE: Best is live (Director's direct route is on): exact \"true\", and only where the direct preview counts\n",
      ""
    ],
    [
      "export const studioThinkingMaxLiveOn = (live: string | undefined, directLiveOn: boolean): boolean => directLiveOn && live === 'true' // LEVELS-DIRECT-LIVE: Max is live: exact \"true\", and only where Best is live\n",
      ""
    ],
    [
      "export const STUDIO_THINKING_LEVELS_DIRECT_LIVE = studioThinkingDirectLiveOn(process.env.NEXT_PUBLIC_STUDIO_THINKING_LEVELS_DIRECT_LIVE, STUDIO_THINKING_LEVELS_DIRECT_PREVIEW) // LEVELS-DIRECT-LIVE\n",
      ""
    ],
    [
      "export const STUDIO_THINKING_LEVELS_MAX_LIVE = studioThinkingMaxLiveOn(process.env.NEXT_PUBLIC_STUDIO_THINKING_LEVELS_MAX_LIVE, STUDIO_THINKING_LEVELS_DIRECT_LIVE) // LEVELS-DIRECT-LIVE\n",
      ""
    ],
    [
      "export interface ThinkingFlags { levels: boolean; direct: boolean; bestLive?: boolean; maxLive?: boolean } // LEVELS-DIRECT-LIVE: bestLive and maxLive are optional and read false when missing\n",
      "export interface ThinkingFlags { levels: boolean; direct: boolean }\n"
    ],
    [
      "const FLAGS_NOW: ThinkingFlags = { levels: STUDIO_THINKING_LEVELS_ENABLED, direct: STUDIO_THINKING_LEVELS_DIRECT_PREVIEW, bestLive: STUDIO_THINKING_LEVELS_DIRECT_LIVE, maxLive: STUDIO_THINKING_LEVELS_MAX_LIVE } // LEVELS-DIRECT-LIVE\n",
      "const FLAGS_NOW: ThinkingFlags = { levels: STUDIO_THINKING_LEVELS_ENABLED, direct: STUDIO_THINKING_LEVELS_DIRECT_PREVIEW }\n"
    ],
    [
      "/** LEVELS-DIRECT-LIVE: when Director's direct route for a level is switched on (Best: NEXT_PUBLIC_STUDIO_THINKING_LEVELS_DIRECT_LIVE; Max: NEXT_PUBLIC_STUDIO_THINKING_LEVELS_MAX_LIVE as well) the level stops saying \"coming soon\" and says these words instead. LEVEL_COPY above is every other state's words, untouched. Plain words, never a model, provider, router or price. */\n",
      ""
    ],
    [
      "export const LEVEL_COPY_LIVE = { best: 'A deeper build, planned and written in one pass. Pro and Max plans.', max: 'Our most thorough build. Max plan only.', maxPlan: 'Max is on the Max plan.' } as const // LEVELS-DIRECT-LIVE\n",
      ""
    ],
    [
      "export const bestIsLive = (flags: ThinkingFlags): boolean => flags.direct && flags.bestLive === true // LEVELS-DIRECT-LIVE: the direct preview is on and so is Best's live flag\n",
      ""
    ],
    [
      "export const maxIsLive = (flags: ThinkingFlags): boolean => bestIsLive(flags) && flags.maxLive === true // LEVELS-DIRECT-LIVE: Best is live and so is Max's own flag\n",
      ""
    ],
    [
      "export const liveLine = (level: ThinkingLevel, flags: ThinkingFlags): string | null => (level === 'best' && bestIsLive(flags) ? LEVEL_COPY_LIVE.best : level === 'max' && maxIsLive(flags) ? LEVEL_COPY_LIVE.max : null) // LEVELS-DIRECT-LIVE: the words of a level that is live under these flags, else null (then LEVEL_COPY.line is the level's line, as before)\n",
      ""
    ],
    [
      "export function levelRefusal(level: ThinkingLevel, plan: AgentPlan | null | undefined, flags: ThinkingFlags = FLAGS_NOW): string | null { // LEVELS-DIRECT-LIVE: flags\n",
      "export function levelRefusal(level: ThinkingLevel, plan: AgentPlan | null | undefined): string | null {\n"
    ],
    [
      "  if (level === 'max' && plan === 'pro' && maxIsLive(flags)) return LEVEL_COPY_LIVE.maxPlan // LEVELS-DIRECT-LIVE: with Max live it is on the Max plan only (Director's route for it needs that plan): a Pro user sees it disabled with these words; Free, Starter and a plan not loaded keep the Agent shell's reasons below\n",
      ""
    ],
    [
      "  return THINKING_STOPS.filter(stop => flags.direct || !THINKING_DIRECT_STOPS.includes(stop)).map(stop => ({ id: stop, label: LEVEL_COPY.label[stop], disabled: levelRefusal(stop, plan, flags) !== null, comingSoon: THINKING_DIRECT_STOPS.includes(stop) && liveLine(stop, flags) === null })) // LEVELS-DIRECT-LIVE: a level whose direct route is live is not marked coming soon\n",
      "  return THINKING_STOPS.filter(stop => flags.direct || !THINKING_DIRECT_STOPS.includes(stop)).map(stop => ({ id: stop, label: LEVEL_COPY.label[stop], disabled: levelRefusal(stop, plan) !== null, comingSoon: THINKING_DIRECT_STOPS.includes(stop) }))\n"
    ],
    [
      "  if (levelRefusal(level, plan, flags) !== null) return null // LEVELS-DIRECT-LIVE: the refusal the scale shows\n",
      "  if (levelRefusal(level, plan) !== null) return null\n"
    ],
    [
      "export const stopLine = (level: ThinkingLevel, plan: AgentPlan | null | undefined, flags: ThinkingFlags = FLAGS_NOW): string => levelRefusal(level, plan, flags) ?? liveLine(level, flags) ?? LEVEL_COPY.line[level] // LEVELS-DIRECT-LIVE: a live level's own words come before the \"coming soon\" line\n",
      "export const stopLine = (level: ThinkingLevel, plan: AgentPlan | null | undefined): string => levelRefusal(level, plan) ?? LEVEL_COPY.line[level]\n"
    ],
    [
      "    stops, index, thumb: index >= 0 ? 'selected' : 'none', title: LEVEL_COPY.label[shown], line: stopLine(shown, plan, flags), // LEVELS-DIRECT-LIVE\n",
      "    stops, index, thumb: index >= 0 ? 'selected' : 'none', title: LEVEL_COPY.label[shown], line: stopLine(shown, plan),\n"
    ],
    [
      "    valueText: `${LEVEL_COPY.label[shown]}. ${stopLine(shown, plan, flags)}`, resetLabel: LEVEL_COPY.resetLabel, resetEnabled: shown !== 'auto', // LEVELS-DIRECT-LIVE\n",
      "    valueText: `${LEVEL_COPY.label[shown]}. ${stopLine(shown, plan)}`, resetLabel: LEVEL_COPY.resetLabel, resetEnabled: shown !== 'auto',\n"
    ]
  ]
}

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, so putting them back gives the previous file byte for byte. */
export const LEVELS_DIRECT_LIVE_PIN_MARK = "LATER-CHANGES: registry read (LEVELS-DIRECT-LIVE)"
export const LEVELS_DIRECT_LIVE_PIN_EDITS = {
  "scripts/test-studio-chat-element-edit.mjs": [
    [
      "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Levels direct live:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (LEVELS-DIRECT-LIVE): on a branch stacked after this change (Best and Max live in the level picker, step 4.1c), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n",
      ""
    ]
  ],
  "scripts/test-studio-deck-sync-truth.mjs": [
    [
      "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Levels direct live:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (LEVELS-DIRECT-LIVE): on a branch stacked after this change (Best and Max live in the level picker, step 4.1c), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n",
      ""
    ]
  ]
}

/** The older proofs this change teaches. */
export const LEVELS_DIRECT_LIVE_PIN_FILES = Object.keys(LEVELS_DIRECT_LIVE_PIN_EDITS)

export const LEVELS_DIRECT_LIVE_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...LEVELS_DIRECT_LIVE_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const LEVELS_DIRECT_LIVE_SCOPE_FILES = new Set([...LEVELS_DIRECT_LIVE_FILES, ...LEVELS_DIRECT_LIVE_NEW_FILES, ...LEVELS_DIRECT_LIVE_OWN_EDITS])

/** The whole .env.example block: its comments and its lines. */
export const LEVELS_DIRECT_LIVE_ENV_BLOCK = "# STUDIO THINKING LEVELS DIRECT LIVE (FRONTEND-1; wave 1 step 4.1c). On for the exact value \"true\"; default off, and then the level picker says what it said before: Best and Max read \"Coming soon: runs as Balanced for now.\" Build-time value: change it on Vercel and redeploy.\n# On, and only where the level picker's direct preview of Best and Max is on: Best is live. Its line reads \"A deeper build, planned and written in one pass. Pro and Max plans.\" and its stop is no longer marked coming soon. Director now has a direct route for it and picks it from the thinking_level the message already carries, so nothing on the wire changes (build_mode and thinking_level are as before). Off (default): Best says \"coming soon\", as today. Auto, Fast and Balanced never change.\nNEXT_PUBLIC_STUDIO_THINKING_LEVELS_DIRECT_LIVE=\"false\"\n# STUDIO THINKING LEVELS MAX LIVE (FRONTEND-1; wave 1 step 4.1c). On for the exact value \"true\"; default off. It does nothing while NEXT_PUBLIC_STUDIO_THINKING_LEVELS_DIRECT_LIVE is off: Max then keeps its \"coming soon\" words and its plan rule, as today. Build-time value, as above.\n# On, with the flag above also on: Max is live. Its line reads \"Our most thorough build. Max plan only.\", its stop is no longer marked coming soon, and it can be picked on the Max plan only (Director's route for it needs that plan). On the Pro plan it is shown but disabled, with \"Max is on the Max plan.\"; Free, Starter and a plan that is not loaded yet keep the Agent build's own reasons.\nNEXT_PUBLIC_STUDIO_THINKING_LEVELS_MAX_LIVE=\"false\"\n"

/** The file with this change's edits put back (the previous text). Used by the strip and the proof. */
export function putBackLevelsDirectLive(rel, text) {
  return (LEVELS_DIRECT_LIVE_EDITS[rel] || LEVELS_DIRECT_LIVE_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The file without this change's edits: each [has, was] pair put back; every other byte stays. Any other file is returned as it is. */
export function stripLevelsDirectLive(rel, text) {
  if (typeof text !== 'string') return text
  if (!(rel in LEVELS_DIRECT_LIVE_EDITS) && !(rel in LEVELS_DIRECT_LIVE_PIN_EDITS)) return text
  return putBackLevelsDirectLive(rel, text)
}
