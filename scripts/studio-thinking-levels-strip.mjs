// FRONTEND-1 (PK mandate M1 of 15 Nov 2026, the thinking-level picker). Flags NEXT_PUBLIC_STUDIO_THINKING_LEVELS and NEXT_PUBLIC_STUDIO_THINKING_LEVELS_DIRECT_PREVIEW (each exact "true", default off, build-time). The picker acts only with
// NEXT_PUBLIC_STUDIO_V4_SHELL, NEXT_PUBLIC_AGENT_MODE and NEXT_PUBLIC_STUDIO_CHAT_CLEAN also on; the direct preview only with the picker on. Off, the composer, the Builder page and the socket hook are byte for byte what they were.
// Every line this change adds to an EXISTING file carries the marker THINKING-LEVELS (matched as a whole token). Some base lines are rewritten (the composer's pass-through of the level props, the send side's
// signature and its gauge, none of them a line an older registered change owns), so the strip is a list of [has, was] pairs, not a marker filter: putting each pair back gives the file at BASE_COMMIT byte for byte. The new files have no base text.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '3098f860cd97226d6405631bad870a9be5b52523' // origin/studio-v4-dev-preparation-code (#634 merged), the trunk this change sits on
export const THINKING_LEVELS_FLAGS = ["NEXT_PUBLIC_STUDIO_THINKING_LEVELS", "NEXT_PUBLIC_STUDIO_THINKING_LEVELS_DIRECT_PREVIEW"]
export const THINKING_LEVELS_MARKER = 'THINKING-LEVELS'
/** The marker as a WHOLE token: THINKING-LEVELS is this change's; THINKING-LEVELS-X and X-THINKING-LEVELS are not. */
export const THINKING_LEVELS_MARKER_RE = /(?<![\w-])THINKING-LEVELS(?![\w-])/
/** The subject prefix of this change's own commits. */
export const THINKING_LEVELS_SUBJECT = "Thinking levels:"

/** Existing files that get marked lines. */
export const THINKING_LEVELS_FILES = [
  "app/builder/page.tsx",
  "hooks/use-deckster-websocket-v2.ts",
  "components/builder/chat-input.tsx",
  "components/builder/chat/studio-chat-clean.tsx",
  "components/builder/agent-mode/build-mode-picker.tsx"
]

/** New files (no base text to put back). */
export const THINKING_LEVELS_NEW_FILES = [
  "lib/studio-thinking-levels.ts",
  "components/builder/thinking-levels/level-picker.tsx",
  "components/builder/thinking-levels/level-picker.css",
  "scripts/studio-thinking-levels-strip.mjs",
  "scripts/test-studio-thinking-levels.mjs"
]

/** The new libs that read a flag: [file, flag], one literal env read each. */
export const THINKING_LEVELS_LIB_FLAGS = [["lib/studio-thinking-levels.ts", "NEXT_PUBLIC_STUDIO_THINKING_LEVELS"], ["lib/studio-thinking-levels.ts", "NEXT_PUBLIC_STUDIO_THINKING_LEVELS_DIRECT_PREVIEW"]]

/** [text the file has now, text the file had at BASE_COMMIT] per edit (one per marked line, in the order they sit in the file); putting them back gives the base file byte for byte. */
export const THINKING_LEVELS_EDITS = {
  "app/builder/page.tsx": [
    ["  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>('auto') // THINKING-LEVELS: the level the picker was moved to (Auto until then, and after a reload or another session); it drives buildMode above and is never saved\n", ""],
    ["  const thinkingLevelRef = useRef<ThinkingLevel | undefined>(undefined) // THINKING-LEVELS: the thinking_level the next build request carries (undefined omits the key); written each render\n", ""],
    ["  const shownThinkingLevel = effectiveLevel(thinkingLevel, buildMode) // THINKING-LEVELS: the level the picker shows: the one picked, unless the build mode moved from under it (an Agent run finished, another session started), then Auto\n", ""],
    ["  thinkingLevelRef.current = STUDIO_THINKING_LEVELS_ENABLED ? shownThinkingLevel : undefined // THINKING-LEVELS: read at send time by the four build sends below, next to the build mode; the hook then says what the request RUNS as (a voice turn never starts Agent)\n", ""],
    ["  const pickThinkingLevel = (level: ThinkingLevel) => { const pick = levelPick(level, agentPlan); if (!pick) return; if (pick.mode !== 'standard') setBuildModeFrom(pick.mode); setBuildMode(pick.mode); setThinkingLevel(pick.level) } // THINKING-LEVELS: a level the plan can use drives the build mode (Fast and Auto Standard; Balanced, Best and Max Agent), exactly as a click on the build-mode chips did; nothing is sent until a build request carries it\n", ""],
    ["    if (STUDIO_THINKING_LEVELS_ENABLED && agentSessionChanged(agentSessionRef.current, currentSessionId)) setThinkingLevel('auto') // THINKING-LEVELS: a picked level belongs to the session it was picked in\n", ""],
    ["          ...(thinkingLevelRef.current ? { thinkingLevel: thinkingLevelRef.current } : {}), // THINKING-LEVELS\n", ""],
    ["              ...(thinkingLevelRef.current ? { thinkingLevel: thinkingLevelRef.current } : {}), // THINKING-LEVELS\n", ""],
    ["        ...(thinkingLevelRef.current ? { thinkingLevel: thinkingLevelRef.current } : {}), // THINKING-LEVELS\n", ""],
    ["            ...(thinkingLevelRef.current ? { thinkingLevel: thinkingLevelRef.current } : {}), // THINKING-LEVELS\n", ""],
    ["                    {...(STUDIO_THINKING_LEVELS_ENABLED ? { studioThinkingLevels: { value: shownThinkingLevel, plan: agentPlan, disabled: agentRunBusy(agentRun), onChange: pickThinkingLevel } } : {}) /* THINKING-LEVELS (NEXT_PUBLIC_STUDIO_THINKING_LEVELS): the composer's gauge becomes the level picker (Auto / Fast / Balanced / Best / Max); off, nothing is added */}\n", ""],
    ["import { STUDIO_THINKING_LEVELS_ENABLED, effectiveLevel, levelPick, type ThinkingLevel } from '@/lib/studio-thinking-levels' // THINKING-LEVELS\n", ""],
  ],
  "hooks/use-deckster-websocket-v2.ts": [
    ["import { STUDIO_THINKING_LEVELS_ENABLED, thinkingLevelOnWire, type ThinkingLevel } from '@/lib/studio-thinking-levels'; // THINKING-LEVELS (NEXT_PUBLIC_STUDIO_THINKING_LEVELS; default off)\n", ""],
    ["    thinking_level?: ThinkingLevel; // THINKING-LEVELS: the level this request asks for (auto, fast, balanced, best, max), additive: Director's logs show the route (DIRECTOR-2 reads it; today Director ignores it); omitted unless the flag is on\n", ""],
    ["  thinkingLevel?: ThinkingLevel; // THINKING-LEVELS\n", ""],
    ["          ...(STUDIO_THINKING_LEVELS_ENABLED && options?.thinkingLevel && { thinking_level: options.thinkingLevel }), // THINKING-LEVELS\n", ""],
    ["      if (STUDIO_THINKING_LEVELS_ENABLED && message.data.thinking_level) message.data.thinking_level = thinkingLevelOnWire(message.data.thinking_level, message.data.build_mode) ?? message.data.thinking_level; // THINKING-LEVELS: the level a request RUNS as, read from the build_mode it finally carries (after the voice rule above): a level that needs the Agent build but goes out without it says \"fast\"\n", ""],
  ],
  "components/builder/chat-input.tsx": [
    ["import type { LevelPickerProps } from '@/components/builder/thinking-levels/level-picker' // THINKING-LEVELS\n", ""],
    ["  studioThinkingLevels?: LevelPickerProps // THINKING-LEVELS (NEXT_PUBLIC_STUDIO_THINKING_LEVELS): the level picker's value, plan and handler; passed only with the flag on, and drawn only in the clean composer\n", ""],
    ["  studioThinkingLevels, // THINKING-LEVELS\n", ""],
    ["            {chatClean ? <StudioChatCleanSendSide composer={chatClean.composer} onStop={chatClean.onStop} picker={{ sessionId: chatClean.sessionId, disabled: !user || isLoadingSession }} research={chatCleanResearch} {...(studioThinkingLevels ? { levels: studioThinkingLevels } : {})} /> : null}{/* CHAT-CLEAN: the model picker (the gauge button) and Stop beside Send; the stylesheet moves the research options button above next to them and hides Send while Stop shows */}{/* THINKING-LEVELS: the level picker's props ride along only when the page passed them (flag on) */}\n", "            {chatClean ? <StudioChatCleanSendSide composer={chatClean.composer} onStop={chatClean.onStop} picker={{ sessionId: chatClean.sessionId, disabled: !user || isLoadingSession }} research={chatCleanResearch} /> : null}{/* CHAT-CLEAN: the model picker (the gauge button) and Stop beside Send; the stylesheet moves the research options button above next to them and hides Send while Stop shows */}\n"],
  ],
  "components/builder/chat/studio-chat-clean.tsx": [
    ["import { LevelPicker, type LevelPickerProps } from '@/components/builder/thinking-levels/level-picker' // THINKING-LEVELS (NEXT_PUBLIC_STUDIO_THINKING_LEVELS, default off)\n", ""],
    ["  levels?: LevelPickerProps // THINKING-LEVELS: the level picker's props, passed only with the flag on; it takes the model gauge's place\n", ""],
    ["export function StudioChatCleanSendSide({ composer, onStop, research, picker, levels }: StudioChatCleanSendSideProps) { // THINKING-LEVELS: levels\n", "export function StudioChatCleanSendSide({ composer, onStop, research, picker }: StudioChatCleanSendSideProps) {\n"],
    ["      {levels ? <LevelPicker {...levels} className=\"studio-chat-clean-model\" /> : <ModelPicker variant=\"slider\" sessionId={picker.sessionId} disabled={picker.disabled} className=\"studio-chat-clean-model\" />}{/* THINKING-LEVELS: with the flag on the gauge IS the level picker (Auto / Fast / Balanced / Best / Max); off, the model picker as before */}\n", "      <ModelPicker variant=\"slider\" sessionId={picker.sessionId} disabled={picker.disabled} className=\"studio-chat-clean-model\" />\n"],
  ],
  "components/builder/agent-mode/build-mode-picker.tsx": [
    ["import { STUDIO_THINKING_LEVELS_ENABLED } from \"@/lib/studio-thinking-levels\" // THINKING-LEVELS\n", ""],
    ["  if (STUDIO_THINKING_LEVELS_ENABLED) return null // THINKING-LEVELS (NEXT_PUBLIC_STUDIO_THINKING_LEVELS): the composer's gauge is the one control, and it drives this same build mode; these chips are not drawn\n", ""],
  ],
}

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, so putting them back gives the previous file byte for byte. */
export const THINKING_LEVELS_PIN_MARK = "LATER-CHANGES: registry read (THINKING-LEVELS)"
export const THINKING_LEVELS_PIN_EDITS = {
  // none: the older proofs read the files through the registry (scripts/studio-later-changes.mjs), which strips this change first
}

/** The older proofs this change teaches. */
export const THINKING_LEVELS_PIN_FILES = Object.keys(THINKING_LEVELS_PIN_EDITS)

export const THINKING_LEVELS_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...THINKING_LEVELS_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const THINKING_LEVELS_SCOPE_FILES = new Set([...THINKING_LEVELS_FILES, ...THINKING_LEVELS_NEW_FILES, ...THINKING_LEVELS_OWN_EDITS])

/** The whole .env.example block: its comments and its lines. */
export const THINKING_LEVELS_ENV_BLOCK = "# STUDIO THINKING LEVELS (FRONTEND-1; PK mandate M1, 15 Nov). On for the exact value \"true\"; default off, and then the composer and the build-mode chips are byte for byte as they were. Build-time value: change it on Vercel and redeploy.\n# On, and only with NEXT_PUBLIC_STUDIO_V4_SHELL, NEXT_PUBLIC_AGENT_MODE and NEXT_PUBLIC_STUDIO_CHAT_CLEAN also exactly \"true\": the composer's gauge is the level picker (Auto, Fast, Balanced; Best and Max with the preview flag below), and the Standard / Author / Agent chips above the composer are not drawn. Fast and Auto are the linear build (build_mode \"standard\"), Balanced is the Agent build (build_mode \"agent\", Pro and Max plans only, shown disabled with the plan reason below that). The build request also carries data.thinking_level (\"auto\", \"fast\", \"balanced\", \"best\", \"max\") so that Director's logs can show the route (DIRECTOR-2 reads it; Director ignores it today). A level is per send, never saved, and starts on Auto.\nNEXT_PUBLIC_STUDIO_THINKING_LEVELS=\"false\"\n# Best (Sonnet direct) and Max (Opus direct) have no backend yet (gap G8). Exact \"true\" (and the flag above) shows them on the scale, marked \"Coming soon: runs as Balanced for now\": picking one sends build_mode \"agent\" and thinking_level \"best\" / \"max\". Off (default): they are not on the scale.\nNEXT_PUBLIC_STUDIO_THINKING_LEVELS_DIRECT_PREVIEW=\"false\"\n"

/** The file with this change's edits put back (the previous text). Used by the strip and the proof. */
export function putBackThinkingLevels(rel, text) {
  return (THINKING_LEVELS_EDITS[rel] || THINKING_LEVELS_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The file without this change's edits: each [has, was] pair put back; every other byte stays. Any other file is returned as it is. */
export function stripThinkingLevels(rel, text) {
  if (typeof text !== 'string') return text
  if (!(rel in THINKING_LEVELS_EDITS) && !(rel in THINKING_LEVELS_PIN_EDITS)) return text
  return putBackThinkingLevels(rel, text)
}
