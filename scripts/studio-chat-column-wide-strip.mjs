// FRONTEND-2 (B51, 31 Oct; PK's UAT feedback F-10, confirmed 31 Oct 04:11Z). Flag NEXT_PUBLIC_STUDIO_CHAT_COLUMN_WIDE (exact "true", build-time, default off): the full-width first-run welcome (head, starters, Replay intro / Explore templates / Blank canvas row and the composer's
// visible box) shares one centred column of about 44% of the window (clamp 640 to 880 px), superseding PK decision #6's 560 px column (NEXT_PUBLIC_STUDIO_WELCOME_WIDTH_560) while the flag is on; and two shared custom properties are DEFINED, --studio-chat-welcome-column and
// --studio-chat-conversation-column (about 50%, clamp 640 to 1000 px, which PR #554 consumes). The docked chat panel keeps its width. Both tokens are defined only with the flag on, on the Studio shell, through a marker attribute the Director header carries only with the flag on
// (page.tsx is not touched).
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker STUDIO-CHAT-COLUMN-WIDE (a whole token), except ONE existing line that is extended (the header's opening tag gains one spread; PIN_EDITS puts the old line back). Strip those lines and the
// header is its base, byte for byte. The decisions live in lib/studio-chat-column-wide.ts; the rules are a new stylesheet whose every rule is keyed to the marker attribute.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '025a551062958cfd3593334513871c64246c0130' // #555's gated head (Welcome trim + Director mark trim), on studio dev a470679c
export const CHAT_COLUMN_WIDE_FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_COLUMN_WIDE'
export const CHAT_COLUMN_WIDE_MARKER = 'STUDIO-CHAT-COLUMN-WIDE'
/** The marker as a WHOLE token: STUDIO-CHAT-COLUMN-WIDE-X and X-STUDIO-CHAT-COLUMN-WIDE are not it. */
export const CHAT_COLUMN_WIDE_MARKER_RE = /(?<![\w-])STUDIO-CHAT-COLUMN-WIDE(?![\w-])/
/** The subject prefix of this change's own commits (not "Welcome trim:" / "Director mark trim:": those scope checks find their own commits by those prefixes). */
export const CHAT_COLUMN_WIDE_SUBJECT = 'Chat column wide:'

/** Existing files that get marked lines. */
export const CHAT_COLUMN_WIDE_FILES = ['components/builder/chat/studio-director-header.tsx']

/** New files (no base text to put back). */
export const CHAT_COLUMN_WIDE_NEW_FILES = [
  'lib/studio-chat-column-wide.ts',
  'components/builder/chat/studio-chat-column-wide.css',
  'scripts/studio-chat-column-wide-strip.mjs',
  'scripts/test-studio-chat-column-wide.mjs',
]

/** The one existing line this change extends: [text now, text before], whole lines. */
export const CHAT_COLUMN_WIDE_PIN_EDITS = {
  'components/builder/chat/studio-director-header.tsx': [
    ["    <header data-studio-director-header=\"true\" role=\"group\" aria-label=\"Director conversation\" {...(chatHeader ? { \"data-studio-chat-header\": \"true\" } : undefined)} {...studioChatColumnWideProps() /* STUDIO-CHAT-COLUMN-WIDE: the marker the wide-column stylesheet is keyed to; nothing with the flag off */}>\n",
     "    <header data-studio-director-header=\"true\" role=\"group\" aria-label=\"Director conversation\" {...(chatHeader ? { \"data-studio-chat-header\": \"true\" } : undefined)}>\n"],
  ],
}

export function putBackPin(rel, text) {
  return (CHAT_COLUMN_WIDE_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

export const CHAT_COLUMN_WIDE_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs']

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const CHAT_COLUMN_WIDE_SCOPE_FILES = new Set([...CHAT_COLUMN_WIDE_FILES, ...CHAT_COLUMN_WIDE_NEW_FILES, ...CHAT_COLUMN_WIDE_OWN_EDITS])

/** The whole .env.example block: its comment and its line. */
export const CHAT_COLUMN_WIDE_ENV_BLOCK = `# STUDIO CHAT COLUMN WIDE (FRONTEND-2, B51; PK's UAT feedback F-10 of 31 Oct: the full-width chat column is too narrow on a laptop). On for the exact value "true"; default off, and then nothing changes. Build-time value: change it on Vercel and redeploy.
# On, the full-width first-run welcome (it needs NEXT_PUBLIC_STUDIO_FIRST_RUN_V2) is one centred column of about 44% of the window, clamped 640 to 880 px: the head, the starters, the Replay intro / Explore templates / Blank canvas row and the composer's visible box. It supersedes PK decision #6's
# 560 px column (NEXT_PUBLIC_STUDIO_WELCOME_WIDTH_560) while on. It also DEFINES two CSS custom properties on the Studio shell, --studio-chat-welcome-column and --studio-chat-conversation-column (about 50%, clamped 640 to 1000 px; PR #554's conversation column reads it).
# The docked left chat panel keeps its width. The Director header carries data-studio-chat-column-wide="true" only with the flag on (the stylesheet is keyed to it).
NEXT_PUBLIC_STUDIO_CHAT_COLUMN_WIDE="false"
`

/** The file without this change's lines: the pin put back, then every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripChatColumnWide(rel, text) {
  if (typeof text !== 'string') return text
  if (!CHAT_COLUMN_WIDE_FILES.includes(rel)) return text
  return putBackPin(rel, text).split('\n').filter(line => !CHAT_COLUMN_WIDE_MARKER_RE.test(line)).join('\n')
}
