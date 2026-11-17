// RESEARCH-DEFAULT (KNOWLEDGE-3 for FRONTEND-1). Flag NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON, exact "true", default off, build-time (read once, as a literal, so Next inlines it).
// On a new chat, or a chat that has no outline yet, web search starts on. A chat that already has an outline opens with web search off, as before. Deep research is unchanged.
// (app/builder/page.tsx: its first state and the new-chat reset start web search on; one line in the session-restore wrapper sets it off, once, for a chat opened with its strawman or final deck already in the loaded row. Off, the page is byte for byte what it was.)
export const STUDIO_RESEARCH_DEFAULT_ON = process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON === 'true'
