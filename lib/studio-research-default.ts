// RESEARCH-DEFAULT (KNOWLEDGE-3 for FRONTEND-1). Flag NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON, exact "true", default off, build-time (read once, as a literal, so Next inlines it).
// On, a new chat in the Builder starts with web search on (app/builder/page.tsx: its first state and the new-chat reset). Deep research stays off, and a reopened chat keeps the value it was saved with. Off, the page is byte for byte what it was.
export const STUDIO_RESEARCH_DEFAULT_ON = process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON === 'true'
