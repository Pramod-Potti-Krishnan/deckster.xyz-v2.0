// FRONTEND-2 (25 Oct: the Pass 3 polish set, PR F, stacked on PR E #510). Flag NEXT_PUBLIC_STUDIO_PASS3_POLISH (exact "true", default off, build-time): the SAME flag as the others, PR A's lib/studio-pass3-polish.ts (it also needs
// NEXT_PUBLIC_STUDIO_V4_SHELL). PR F puts right the one regression the whole-site A/B sweep of 0e267a2c found: on a phone the Themes page's Heading font and Body font selects ran "Theme default" under the chevron at PR A's 16px
// ("Theme defau▾"). It is CSS only, in a stylesheet of its own (components/studio-pass3-polish/studio-pass3-polish-f.css, every rule scoped to <html data-studio-pass3-polish="true">), PR E's E2 declarations for those two selects.
// Where it is imported: a NEW pass-through layout for /studio/themes (app/(app)/studio/themes/layout.tsx, the pattern of app/(app)/studio/intelligence/layout.tsx), one marked line. NO EXISTING FILE gets a line: the account layout
// (where PR E's line is) is held byte for byte by PR E's proof (it reads the file as it is), and the Themes page by scripts/test-studio-theme-library-manage.mjs (byte equal to its base). The marker PASS3-POLISH-F is matched as a
// WHOLE token, so PR A's PASS3-POLISH, PR E's PASS3-POLISH-E and the others never take its line, and its strip never takes theirs.
// How the older pins reach it: this change REGISTERS its files and its strip (scripts/studio-later-changes.mjs, two lines; no .env.example block: the flag's block is PR A's). The strip touches only the new layout (no older pin
// holds it); scripts/test-studio-pass3-polish-f.mjs proves that without the marked line the layout is a pure pass-through. Plain node, no imports, nothing read from disk or git here; any other file comes back as it is.

export const BASE_COMMIT = '0e267a2c4e4596cebf0fd9de72e7f02a4b82d4c0' // PR E's head (#510), this change is cut from
export const PASS3_POLISH_F_MARKER = 'PASS3-POLISH-F'
/** The marker as a WHOLE token: PASS3-POLISH-F is this change's; PASS3-POLISH, PASS3-POLISH-B ... -E and any other suffix are not. */
export const PASS3_POLISH_F_MARKER_RE = /(?<![\w-])PASS3-POLISH-F(?![\w-])/
export const PASS3_POLISH_F_LAYOUT = 'app/(app)/studio/themes/layout.tsx'
export const PASS3_POLISH_F_CSS = 'components/studio-pass3-polish/studio-pass3-polish-f.css'

/** The files whose marked lines the strip takes out: the new Themes layout only (no existing file is changed). */
export const PASS3_POLISH_F_FILES = [PASS3_POLISH_F_LAYOUT]

/** New files (no base text to put back). */
export const PASS3_POLISH_F_NEW_FILES = [
  PASS3_POLISH_F_CSS,
  PASS3_POLISH_F_LAYOUT,
  'scripts/studio-pass3-polish-f-strip.mjs',
  'scripts/test-studio-pass3-polish-f.mjs',
]

/** Files this change edits that are not app code: the registry (two lines: its files and its strip). No older test is edited. */
export const PASS3_POLISH_F_OWN_EDITS = ['scripts/studio-later-changes.mjs']

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const PASS3_POLISH_F_SCOPE_FILES = new Set([...PASS3_POLISH_F_NEW_FILES, ...PASS3_POLISH_F_OWN_EDITS])

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripPass3PolishF(rel, text) {
  if (!PASS3_POLISH_F_FILES.includes(rel) || typeof text !== 'string') return text
  return text.split('\n').filter(line => !PASS3_POLISH_F_MARKER_RE.test(line)).join('\n')
}
