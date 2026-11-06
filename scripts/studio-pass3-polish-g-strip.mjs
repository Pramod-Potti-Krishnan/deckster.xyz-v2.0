// FRONTEND-2 (25 Oct: the Pass 3 polish set, PR G: PK's phone review, decision C "Original sizes, iPhone-only zoom fix"; the Intelligence "Auto" label, decision D, is NOT in this head, see the PR body). Flag
// NEXT_PUBLIC_STUDIO_PASS3_POLISH (exact "true", default off, build-time): the SAME flag as the others, PR A's lib/studio-pass3-polish.ts (it also needs NEXT_PUBLIC_STUDIO_V4_SHELL). PR G takes PR A's section 2 out of
// PR A's stylesheet (the three rules that made every phone text control 16px with a 1.5 or 1.35 line, !important), so a phone's text controls keep the sizes the Studio's own stylesheets give them, and stops iOS Safari's focus
// zoom on iPhone and iPad only, by adding maximum-scale=1 to the viewport meta (lib/studio-pass3-polish-g.ts). PR E's E1 (the composer's empty hint, 12px on one line), E2 and PR F's F1 are not touched.
// It EDITS FILES OF OUR OWN OLDER CHANGES, which other proofs hold to an earlier commit, so this module is the usual strip with a restore table, in three parts, all behind stripPass3PolishG(rel, text) (registered in
// scripts/studio-later-changes.mjs, and read by the three older proofs it teaches):
//   1. the Builder page and the account layout: each gets two lines that carry the marker PASS3-POLISH-G (matched as a WHOLE token, so PR A's PASS3-POLISH and -B ... -F never take its lines, and its strip never takes theirs);
//      a line with the marker goes;
//   2. PR A's stylesheet: its section 2 (PASS3_POLISH_G_SECTION_2) is replaced by a short comment (PASS3_POLISH_G_SECTION_2_STUB); the strip puts the removed text back, so PR A's, PR E's and PR F's proofs, which read that
//      section, read it as PR A left it;
//   3. the three older proofs (PASS3_POLISH_G_PIN_EDITS): each reads its sources one line differently (through this strip); putBackPin gives the base commit's file back byte for byte.
// scripts/test-studio-pass3-polish-g.mjs proves every part against BASE_COMMIT (git show). Plain node, no imports, nothing read from disk or git here; any other file comes back as it is.

export const BASE_COMMIT = '15e2d90f1f9e6a876c2147ec002c076408e419cc' // studio dev head (Merge pull request #512, legal short links) this change is cut from
export const PASS3_POLISH_G_MARKER = 'PASS3-POLISH-G'
/** The marker as a WHOLE token: PASS3-POLISH-G is this change's; PASS3-POLISH, PASS3-POLISH-B ... -F and any other suffix are not. */
export const PASS3_POLISH_G_MARKER_RE = /(?<![\w-])PASS3-POLISH-G(?![\w-])/
export const PASS3_POLISH_G_BUILDER = 'app/builder/page.tsx'
export const PASS3_POLISH_G_LAYOUT = 'app/(app)/layout.tsx'
export const PASS3_POLISH_G_A_CSS = 'components/studio-pass3-polish/studio-pass3-polish.css'
export const PASS3_POLISH_G_LIB = 'lib/studio-pass3-polish-g.ts'
export const PASS3_POLISH_G_MOUNT = 'components/studio-pass3-polish/studio-pass3-polish-g-mount.tsx'

/** The two app files whose existing lines are held to a base commit: only marked lines are added to them. */
export const PASS3_POLISH_G_FILES = [PASS3_POLISH_G_BUILDER, PASS3_POLISH_G_LAYOUT]

/** PR A's section 2 as it stood at BASE_COMMIT (from its header comment to the closing brace of its media query; no trailing newline). */
export const PASS3_POLISH_G_SECTION_2 = `/* ===== SECTION 2: iOS focus zoom (text controls are 16px on a phone) ===== */
/* iOS Safari zooms the whole page when a text control under 16px takes focus, and does not zoom back. The Studio sets 11px to 13.6px on its controls (the Director prompt is 13.6px, the Decks search
   13px, the composer menus 11.5px, and about thirty more rules), one rule per surface at different specificities, so this one wins with !important. It changes the font size and the line height and
   nothing else: no padding, no height, no width (every Studio field is a fixed-height box, and the line height scales with the size so a taller line never clips). It is written for text inputs,
   native selects, textareas and contenteditable; buttons, labels, links, icons, checkboxes, radios, ranges, colour and file inputs are not in it. The guard keeps it off FRONTEND-1's areas:
   Settings and profile pages, Billing, Shortcuts, Your details, the account menu, Publish (dialog, wizard, popups, Q&A inbox), the published viewer and its ask panel, Admin, Docs and Help. */
@media (max-width: 640px) {
  html[data-studio-pass3-polish="true"] :is(input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):not([type="color"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"]):not([type="hidden"]), select, textarea, [contenteditable]:not([contenteditable="false"])):not(:is([data-studio-settings], [data-studio-billing], [data-studio-p2-shortcuts], [data-studio-personal="details"], [data-studio-v4-profile], [data-studio-publish], [data-studio-publish-popup], [data-studio-publish-wizard], [data-studio-qa-inbox], [data-studio-published-viewer], [data-studio-published-ask], [data-studio-published-qa], [data-studio-p2-admin], [data-studio-p2-docs], [data-studio-p2-help], [data-studio-help-content]) *) {
    font-size: 16px !important;
  }
  html[data-studio-pass3-polish="true"] :is(textarea, [contenteditable]:not([contenteditable="false"])):not(:is([data-studio-settings], [data-studio-billing], [data-studio-p2-shortcuts], [data-studio-personal="details"], [data-studio-v4-profile], [data-studio-publish], [data-studio-publish-popup], [data-studio-publish-wizard], [data-studio-qa-inbox], [data-studio-published-viewer], [data-studio-published-ask], [data-studio-published-qa], [data-studio-p2-admin], [data-studio-p2-docs], [data-studio-p2-help], [data-studio-help-content]) *) {
    line-height: 1.5 !important;
  }
  html[data-studio-pass3-polish="true"] input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):not([type="color"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"]):not([type="hidden"]):not(:is([data-studio-settings], [data-studio-billing], [data-studio-p2-shortcuts], [data-studio-personal="details"], [data-studio-v4-profile], [data-studio-publish], [data-studio-publish-popup], [data-studio-publish-wizard], [data-studio-qa-inbox], [data-studio-published-viewer], [data-studio-published-ask], [data-studio-published-qa], [data-studio-p2-admin], [data-studio-p2-docs], [data-studio-p2-help], [data-studio-help-content]) *) {
    line-height: 1.35 !important;
  }
}`

/** What PR G leaves in its place in PR A's stylesheet. */
export const PASS3_POLISH_G_SECTION_2_STUB = `/* ===== SECTION 2: (removed by PR G) a phone's text controls keep their own sizes ===== */
/* PASS3-POLISH-G (PK, 25 Oct, "Original sizes, iPhone-only zoom fix"): the three rules that forced every phone text control to 16px (font-size, !important) and a 1.5 or 1.35 line (line-height, !important) were here. PK finds 16px
   too big, so with the flag on a phone's text controls keep the sizes and lines the Studio's own stylesheets give them (the Director prompt 13.6px on a 20px line, the Decks search 13px, the composer menus 11.5px ...). What they were
   for, iOS Safari's zoom when a text control under 16px takes focus, is stopped on iPhone and iPad only, by the viewport meta (lib/studio-pass3-polish-g.ts: maximum-scale=1). Sections 1, 3, 4 and 5 are as they were. PR E's E1
   (the composer's empty hint, 12px on one line), E2 and PR F's F1 (the selects' right padding and ellipsis) stay in their own stylesheets. scripts/studio-pass3-polish-g-strip.mjs holds the removed text, so PR A's proof still reads it. */`

/** The older proofs this change teaches (FRONTEND-2's own: they read PR A's stylesheet, or every file, without the registry): [text the proof has now, text the base commit's proof has] per edit, whole lines, so putting them back gives the base file byte for byte. Each line the proof has now carries PASS3_POLISH_G_PIN_MARK. */
export const PASS3_POLISH_G_PIN_MARK = '// LATER-CHANGES: registry read (PASS3-POLISH-G)'
export const PASS3_POLISH_G_PIN_EDITS = {
  'scripts/test-studio-pass3-polish.mjs': [
    ["import { stripPass3PolishG } from './studio-pass3-polish-g-strip.mjs' // LATER-CHANGES: registry read (PASS3-POLISH-G)\n", ''],
    ["const read = rel => (rel in overrides ? overrides[rel] : rel === 'components/studio-pass3-polish/studio-pass3-polish.css' ? stripPass3PolishG(rel, fs.readFileSync(path.join(root, rel), 'utf8')) : fs.readFileSync(path.join(root, rel), 'utf8')) // LATER-CHANGES: registry read (PASS3-POLISH-G)\n", "const read = rel => (rel in overrides ? overrides[rel] : fs.readFileSync(path.join(root, rel), 'utf8'))\n"],
  ],
  'scripts/test-studio-pass3-polish-e.mjs': [
    ["import { stripPass3PolishG } from './studio-pass3-polish-g-strip.mjs' // LATER-CHANGES: registry read (PASS3-POLISH-G)\n", ''],
    ["const read = rel => (rel in overrides ? overrides[rel] : stripPass3PolishG(rel, fs.readFileSync(path.join(root, rel), 'utf8'))) // LATER-CHANGES: registry read (PASS3-POLISH-G)\n", "const read = rel => (rel in overrides ? overrides[rel] : fs.readFileSync(path.join(root, rel), 'utf8'))\n"],
  ],
  'scripts/test-studio-pass3-polish-f.mjs': [
    ["import { stripPass3PolishG } from './studio-pass3-polish-g-strip.mjs' // LATER-CHANGES: registry read (PASS3-POLISH-G)\n", ''],
    ["const read = rel => (rel in overrides ? overrides[rel] : stripPass3PolishG(rel, fs.readFileSync(path.join(root, rel), 'utf8'))) // LATER-CHANGES: registry read (PASS3-POLISH-G)\n", "const read = rel => (rel in overrides ? overrides[rel] : fs.readFileSync(path.join(root, rel), 'utf8'))\n"],
  ],
}

/** The proof without this change's edits (the base commit's file). Used by the proof only. */
export function putBackPin(rel, text) {
  return (PASS3_POLISH_G_PIN_EDITS[rel] || []).reduce((out, [has, base]) => out.replace(has, () => base), text)
}

/** The older proofs this change teaches. */
export const PASS3_POLISH_G_PIN_FILES = Object.keys(PASS3_POLISH_G_PIN_EDITS)

/** New files (no base text to put back). */
export const PASS3_POLISH_G_NEW_FILES = [
  PASS3_POLISH_G_LIB,
  PASS3_POLISH_G_MOUNT,
  'scripts/studio-pass3-polish-g-strip.mjs',
  'scripts/test-studio-pass3-polish-g.mjs',
]

/** Files this change edits that are not new: PR A's stylesheet (section 2 out), the registry (two lines: its files and its strip) and the three older proofs it teaches. No .env.example block: the flag's block is PR A's. */
export const PASS3_POLISH_G_OWN_EDITS = [PASS3_POLISH_G_A_CSS, 'scripts/studio-later-changes.mjs', ...PASS3_POLISH_G_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const PASS3_POLISH_G_SCOPE_FILES = new Set([...PASS3_POLISH_G_FILES, ...PASS3_POLISH_G_NEW_FILES, ...PASS3_POLISH_G_OWN_EDITS])

/**
 * The file without this change's edits: the Builder page and the account layout lose every line that carries the marker (as a whole token); PR A's stylesheet gets its section 2 back in place of the stub (only when the
 * stub is there exactly once); the three older proofs get the base commit's reading lines back. Every other byte stays, and any other file is returned as it is.
 */
export function stripPass3PolishG(rel, text) {
  if (typeof text !== 'string') return text
  if (PASS3_POLISH_G_FILES.includes(rel)) return text.split('\n').filter(line => !PASS3_POLISH_G_MARKER_RE.test(line)).join('\n')
  if (rel === PASS3_POLISH_G_A_CSS) return text.split(PASS3_POLISH_G_SECTION_2_STUB).length === 2 ? text.replace(PASS3_POLISH_G_SECTION_2_STUB, () => PASS3_POLISH_G_SECTION_2) : text
  if (rel in PASS3_POLISH_G_PIN_EDITS) return putBackPin(rel, text)
  return text
}
