// RESEARCH-DEFAULT (KNOWLEDGE-3 for FRONTEND-1). Flags NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON and NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_FREE, each the exact string "true", each default off, build-time (each read once, as a literal, so Next inlines it).
// On a new chat, or a chat with no outline yet, web search starts on for paid plans (starter, pro, premium); free plans only when NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_FREE is also on. A chat that already has an outline opens with web search off, as before. Deep research is unchanged.
// (app/builder/page.tsx: one effect, once per chat, when the plan is known and the chat has loaded, sets web search to researchDefaultFor(plan, flags) unless the chat already has its outline or the person changed the switch in that chat first. FREE does nothing while ON is off. Off, the page behaves as it did.)
export const STUDIO_RESEARCH_DEFAULT_ON = process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON === 'true'
export const STUDIO_RESEARCH_DEFAULT_FREE = process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_FREE === 'true'

/** Web search's default for a chat with no outline: on for a paid plan (starter, pro, premium), on for the free plan only with the FREE flag, off for any other or unknown plan (null), and off for everyone while ON is off. */
export function researchDefaultFor(plan: string | null | undefined, flags: { on: boolean; free: boolean }): boolean {
  if (flags.on !== true) return false
  if (plan === 'starter' || plan === 'pro' || plan === 'premium') return true
  if (plan === 'free') return flags.free === true
  return false
}
