// THINKING-LEVELS (FRONTEND-1, PK mandate M1 of 15 Nov 2026: "the picker's four positions map to the four levels; Auto lets Deckster choose"). Flag NEXT_PUBLIC_STUDIO_THINKING_LEVELS, exact "true", default off, build-time.
// It acts only where the things it stands on are on too, each exact "true": NEXT_PUBLIC_STUDIO_V4_SHELL, NEXT_PUBLIC_AGENT_MODE (Balanced IS the Agent build: its cards, its estimate, its frames) and NEXT_PUBLIC_STUDIO_CHAT_CLEAN (the composer the
// picker sits in). Off, the Builder page, the composer and the socket hook are byte for byte what they were: the Standard / Author / Agent chips (#607 / #621) and the model gauge stay as they are.
//
// THE MAP (PK's level map, mandates doc): Auto = Deckster chooses; Fast = the linear flow (today's Standard); Balanced = our agentic harness (today's Agent); Best = Sonnet direct and Max = Opus direct, which have NO backend yet (gap G8,
// DIRECTOR-2), so they are shown only behind NEXT_PUBLIC_STUDIO_THINKING_LEVELS_DIRECT_PREVIEW (exact "true", default off: off, Best and Max are not on the scale) and, while shown, run as Balanced ("Coming soon: runs as Balanced for now").
// ONE CONTROL: with the flag on, the composer's gauge IS the level picker (the slider PK knows, drawn from the same classes) and the build-mode chips above the composer are not drawn. A level DRIVES the page's existing build mode (Fast and Auto are
// "standard", Balanced / Best / Max are "agent"), so #621's whole wire stays in force unchanged: Agent only for Pro and Max, only on a signed socket (Director decides), Standard said out loud on Pro and Max (Director's Agent opt-in is sticky), a voice turn
// never starts Agent, the picker cannot change under a run, and it goes back to Auto once a run is over. A level is a per-send choice, never a saved preference: it is NOT written to the model router and it starts on Auto after a reload.
// MODEL CHOICE: untouched. The router's presets and the live catalogue (lib/studio-model-choice.ts, the Intelligence page) still say which model each step of the Fast build uses; the Advanced / specific-model rows of the old gauge are the Intelligence page's now.
// WIRE: the build_mode key as #621 sends it, plus ONE additive key on the same user message, "thinking_level" ("auto" | "fast" | "balanced" | "best" | "max"), so that Director's logs can show the route (DIRECTOR-2 reads it; today Director ignores it).
// Pure: nothing here sends, stores or fetches anything.
import { AGENT_COPY, agentEligible, type AgentPlan, type BuildMode } from '@/lib/studio-agent-mode'

export type ThinkingLevel = 'auto' | 'fast' | 'balanced' | 'best' | 'max'
/** The positions on the scale: Auto is not one of them (it is where the picker rests, and the reset icon returns to it). */
export type ThinkingStop = Exclude<ThinkingLevel, 'auto'>
export const THINKING_LEVELS: readonly ThinkingLevel[] = ['auto', 'fast', 'balanced', 'best', 'max']
/** The scale, quickest first. Best and Max are on it only with the direct preview. */
export const THINKING_STOPS: readonly ThinkingStop[] = ['fast', 'balanced', 'best', 'max']
export const THINKING_DIRECT_STOPS: readonly ThinkingStop[] = ['best', 'max']

/** Exact "true" for each of the four, and only then. */
export const studioThinkingLevelsOn = (levels: string | undefined, agent: string | undefined, shell: string | undefined, chatClean: string | undefined): boolean =>
  levels === 'true' && agent === 'true' && shell === 'true' && chatClean === 'true'
/** The direct preview counts only with the level picker itself on. */
export const studioThinkingDirectPreviewOn = (preview: string | undefined, levelsOn: boolean): boolean => levelsOn && preview === 'true'
export const STUDIO_THINKING_LEVELS_ENABLED = studioThinkingLevelsOn(process.env.NEXT_PUBLIC_STUDIO_THINKING_LEVELS, process.env.NEXT_PUBLIC_AGENT_MODE, process.env.NEXT_PUBLIC_STUDIO_V4_SHELL, process.env.NEXT_PUBLIC_STUDIO_CHAT_CLEAN)
export const STUDIO_THINKING_LEVELS_DIRECT_PREVIEW = studioThinkingDirectPreviewOn(process.env.NEXT_PUBLIC_STUDIO_THINKING_LEVELS_DIRECT_PREVIEW, STUDIO_THINKING_LEVELS_ENABLED)

export interface ThinkingFlags { levels: boolean; direct: boolean }
const FLAGS_NOW: ThinkingFlags = { levels: STUDIO_THINKING_LEVELS_ENABLED, direct: STUDIO_THINKING_LEVELS_DIRECT_PREVIEW }

// ---- the words (one place, so a proof can read every string the picker can say; plain words, never a model, provider, router or price) ------------------------------------------------------------------------------
export const LEVEL_COPY = {
  pickerLabel: 'Thinking level',
  label: { auto: 'Auto', fast: 'Fast', balanced: 'Balanced', best: 'Best', max: 'Max' } as Record<ThinkingLevel, string>,
  line: {
    auto: 'Deckster picks how to build this deck.',
    fast: 'The quickest build, step by step.',
    balanced: 'The agent build. Pro and Max plans.',
    best: 'Coming soon: runs as Balanced for now.',
    max: 'Coming soon: runs as Balanced for now.',
  } as Record<ThinkingLevel, string>,
  comingSoon: 'Coming soon: runs as Balanced for now.',
  resetLabel: 'Auto: Deckster chooses',
  busyNote: 'The level cannot change while the agent build is running.',
} as const

// ---- what each position does to the build -------------------------------------------------------------------------------------------------------------------------------------------------------------------
/** The build mode a level drives: Balanced, and Best and Max (which run as Balanced until their own route exists) are the Agent build; Auto and Fast are the linear one. */
export const levelBuildMode = (level: ThinkingLevel): BuildMode => (level === 'balanced' || level === 'best' || level === 'max' ? 'agent' : 'standard')
/** A level that needs the Agent build, and so a Pro or Max plan. */
export const levelNeedsAgent = (level: ThinkingLevel): boolean => levelBuildMode(level) === 'agent'
const isLevel = (value: unknown): value is ThinkingLevel => typeof value === 'string' && (THINKING_LEVELS as readonly string[]).includes(value)

export interface ThinkingStopView { id: ThinkingStop; label: string; disabled: boolean; comingSoon: boolean }
/** Why a level cannot be picked on this plan, in the Agent shell's own words (Free, Starter, and a plan that is not loaded yet); null when it can. */
export function levelRefusal(level: ThinkingLevel, plan: AgentPlan | null | undefined): string | null {
  if (!levelNeedsAgent(level) || agentEligible(plan)) return null
  return plan ? AGENT_COPY.reasonPlan : AGENT_COPY.reasonUnknownPlan
}
/** The stops on the scale: Fast, Balanced, and Best and Max only with the direct preview. A stop the plan cannot use is shown and disabled; Best and Max are marked as coming soon. */
export function thinkingStops(plan: AgentPlan | null | undefined, flags: ThinkingFlags = FLAGS_NOW): ThinkingStopView[] {
  return THINKING_STOPS.filter(stop => flags.direct || !THINKING_DIRECT_STOPS.includes(stop)).map(stop => ({ id: stop, label: LEVEL_COPY.label[stop], disabled: levelRefusal(stop, plan) !== null, comingSoon: THINKING_DIRECT_STOPS.includes(stop) }))
}
/** What a pick does, or null when it is refused (the flag is off, a level that is not on the scale, a plan that cannot use it): the level the page keeps, and the build mode it drives. */
export function levelPick(level: unknown, plan: AgentPlan | null | undefined, flags: ThinkingFlags = FLAGS_NOW): { level: ThinkingLevel; mode: BuildMode } | null {
  if (!flags.levels || !isLevel(level)) return null
  if (level !== 'auto' && !thinkingStops(plan, flags).some(stop => stop.id === level)) return null
  if (levelRefusal(level, plan) !== null) return null
  return { level, mode: levelBuildMode(level) }
}
/** The level the picker shows, given the one the page kept and the build mode it holds now: a kept level whose mode is not the page's any more (a run finished, another session) reads as Auto. */
export const effectiveLevel = (level: ThinkingLevel, mode: BuildMode): ThinkingLevel => (levelBuildMode(level) === mode ? level : 'auto')
/** The "thinking_level" a build request carries, given the level the picker shows and the build_mode the request carries: what the request RUNS as. A level that needs the Agent build but goes out without it (a voice turn never starts Agent; a plan that cannot) says "fast". */
export const thinkingLevelOnWire = (level: ThinkingLevel | undefined, sentMode: BuildMode | undefined): ThinkingLevel | undefined =>
  level === undefined ? undefined : levelNeedsAgent(level) && sentMode !== 'agent' ? 'fast' : level

// ---- what the picker shows ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
/** The line under a position's name: the plan's reason where it cannot be used, "coming soon" for the direct levels, else the level's own line. */
export const stopLine = (level: ThinkingLevel, plan: AgentPlan | null | undefined): string => levelRefusal(level, plan) ?? LEVEL_COPY.line[level]
export interface ThinkingView {
  stops: ThinkingStopView[]
  /** The thumb's stop, or -1 on Auto (no thumb: the picker rests there). */
  index: number
  thumb: 'selected' | 'none'
  title: string
  line: string
  valueText: string
  resetLabel: string
  /** The reset icon (back to Auto) has something to clear. */
  resetEnabled: boolean
}
export function thinkingView(level: ThinkingLevel, plan: AgentPlan | null | undefined, flags: ThinkingFlags = FLAGS_NOW): ThinkingView {
  const stops = thinkingStops(plan, flags)
  const index = stops.findIndex(stop => stop.id === level)
  const shown: ThinkingLevel = index >= 0 ? level : 'auto'
  return {
    stops, index, thumb: index >= 0 ? 'selected' : 'none', title: LEVEL_COPY.label[shown], line: stopLine(shown, plan),
    valueText: `${LEVEL_COPY.label[shown]}. ${stopLine(shown, plan)}`, resetLabel: LEVEL_COPY.resetLabel, resetEnabled: shown !== 'auto',
  }
}
