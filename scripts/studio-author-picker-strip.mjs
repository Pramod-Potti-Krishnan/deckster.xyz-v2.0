// FRONTEND-1 (Pass 5 author lane F-1, 4 Nov). Flag NEXT_PUBLIC_STUDIO_AUTHOR_PICKER (the string "true", default off, build-time): a Standard / Author choice on the outline
// approval, visible only for a verified server-signed premium/internal tier claim (none reaches the client yet, so it is hidden today). Decisions: lib/studio-author-picker.ts (pure);
// the control: components/builder/chat/author-build-picker.tsx. Every line added to an EXISTING file is a pure insertion carrying the marker AUTHOR-PICKER (whole token):
// components/builder/chat/question-card.tsx (one import, one render line) and hooks/use-deckster-websocket-v2.ts (one import, one optional type field, one spread).
// Strip the marked lines and each file is its base, byte for byte. Plain node, no imports.

export const BASE_COMMIT = '3e1ce88eec23fbfd33f249332d06a65ad05ffc40' // origin/studio-v4-dev-preparation-code at the start of this change
export const AUTHOR_PICKER_FLAGS = ['NEXT_PUBLIC_STUDIO_AUTHOR_PICKER']
export const AUTHOR_PICKER_MARKER = 'AUTHOR-PICKER'
export const AUTHOR_PICKER_MARKER_RE = /(?<![\w-])AUTHOR-PICKER(?![\w-])/

export const AUTHOR_PICKER_FILES = ['components/builder/chat/question-card.tsx', 'hooks/use-deckster-websocket-v2.ts']
export const AUTHOR_PICKER_NEW_FILES = [
  'lib/studio-author-picker.ts',
  'components/builder/chat/author-build-picker.tsx',
  'scripts/studio-author-picker-strip.mjs',
  'scripts/test-studio-author-picker.mjs',
]
export const AUTHOR_PICKER_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs']
export const AUTHOR_PICKER_SCOPE_FILES = new Set([...AUTHOR_PICKER_FILES, ...AUTHOR_PICKER_NEW_FILES, ...AUTHOR_PICKER_OWN_EDITS])

export const AUTHOR_PICKER_ENV_BLOCK = `# STUDIO AUTHOR PICKER (FRONTEND-1; Pass 5 author lane F-1). On only for the string "true"; default off, and then nothing changes. Build-time value: change it on Vercel and redeploy.
# On: the outline approval shows a "Standard / Author" choice, but ONLY when a verified server-signed tier claim says premium or internal (never the editable session tier).
# No signed claim reaches the browser yet (bq claim, PR #304), so the choice stays hidden even with this on. Choosing Author sends build_mode:"author" on the outline accept.
NEXT_PUBLIC_STUDIO_AUTHOR_PICKER="false"
`

/** The file without this change's lines: every line carrying the marker (whole token) is removed; any other file is returned as it is. */
export function stripAuthorPicker(rel, text) {
  if (typeof text !== 'string' || !AUTHOR_PICKER_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !AUTHOR_PICKER_MARKER_RE.test(line)).join('\n')
}
