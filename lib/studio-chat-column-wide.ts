// FRONTEND-2 (B51, 31 Oct; PK's UAT feedback F-10, confirmed 31 Oct 04:11Z): the full-width chat column is too narrow on a laptop; match ChatGPT's desktop widths, in Deckster's style. Flag NEXT_PUBLIC_STUDIO_CHAT_COLUMN_WIDE
// (exact "true", build-time, default off). With it on, (1) the Director header carries one marker attribute, and (2) components/builder/chat/studio-chat-column-wide.css, keyed to that marker, defines two shared CSS custom properties on the Studio shell
// and uses the first for the first-run welcome: the head, the starters, the Replay intro / Explore templates / Blank canvas row and the composer's VISIBLE box all share one centred column of about 44% of the window (clamped 640 to 880 px) instead of
// 620 / 668 px (or the 560 px column of NEXT_PUBLIC_STUDIO_WELCOME_WIDTH_560, PK decision #6 of 16 Oct, which this supersedes whenever the flag is on). The second token is for the conversation column after the first message (about 50%, clamped 640 to 1000 px):
// PR #554 reads it through var() with a fallback; this change only DEFINES it. The docked left chat panel keeps its width: every rule is keyed to the full-width first-run stage.
// Plain TypeScript, no React, no I/O. The widths are CSS; this file holds the flag, the marker and the exact strings the stylesheet must carry (scripts/test-studio-chat-column-wide.mjs proves they are equal).

export const STUDIO_CHAT_COLUMN_WIDE_FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_COLUMN_WIDE'
export const STUDIO_CHAT_COLUMN_WIDE_MARKER = 'STUDIO-CHAT-COLUMN-WIDE'

/** The attribute the Director header carries only with the flag on; the stylesheet's rules are keyed to it. */
export const STUDIO_CHAT_COLUMN_WIDE_ATTRIBUTE = 'data-studio-chat-column-wide'

/** The two shared tokens (exact names: PR #554 reads them through var() with a fallback). */
export const STUDIO_CHAT_WELCOME_COLUMN_TOKEN = '--studio-chat-welcome-column'
export const STUDIO_CHAT_CONVERSATION_COLUMN_TOKEN = '--studio-chat-conversation-column'

/**
 * Their values. The window-relative part is PK's (44% / 640 to 880 px; 50% / 640 to 1000 px). The cap is "100% - 8px": a percentage inside a custom property is resolved where the property is USED, and the blocks that use these tokens sit
 * in the chat's scroll content, whose own 12 px side padding already leaves a 12 px gutter, so the column never overflows the chat area and keeps a 16 px gutter on a narrow window (the composer's rule applies the same cap to its element).
 */
export const STUDIO_CHAT_WELCOME_COLUMN_VALUE = 'min(clamp(640px, 44vw, 880px), 100% - 8px)'
export const STUDIO_CHAT_CONVERSATION_COLUMN_VALUE = 'min(clamp(640px, 50vw, 1000px), 100% - 8px)'

/** The composer's own padding on both sides (its p-3, 12 px each, as lib/studio-welcome-width.ts documents): its element is the column plus this, so the VISIBLE box is as wide as the column. The stylesheet's `24px` must equal it. */
export const STUDIO_CHAT_COMPOSER_INSET_PX = 24

/** True only for the exact string "true". Read when called (a proof sets the variable per case); the build inlines `process.env.NEXT_PUBLIC_STUDIO_CHAT_COLUMN_WIDE` here as it does for every other flag. */
export function studioChatColumnWideOn(): boolean {
  return process.env.NEXT_PUBLIC_STUDIO_CHAT_COLUMN_WIDE === 'true'
}

/** Props to spread on the Director header: the marker with the flag on, `{}` (no key at all) otherwise. */
export function studioChatColumnWideProps(): { 'data-studio-chat-column-wide'?: 'true' } {
  return studioChatColumnWideOn() ? { 'data-studio-chat-column-wide': 'true' } : {}
}
