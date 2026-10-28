// FRONTEND-2 (B44; E2E-2 B1b rows 40 and 41 on Studio dev, root cause by DIRECTOR-2 from Studio 61568fe6, Text Labs uat d2fa38fe, Illustrator uat e8ca3230). Flag NEXT_PUBLIC_STUDIO_MDC_ELEMENT_FIELDS (exact "true", default off, build-time):
// a chat add of an icon label or a shape uses the Director's new structured fields, as the Element panel's own forms do.
//   THE DEFECT. lib/mdc-element-directive.ts builds `iconLabelConfig: {}` (Text Labs defaults to mode "icon": "Add a label saying 'Pilot stores'" came out with EMPTY text) and `shapeConfig: {}` (no shape_type: Text Labs takes custom-prompt
//   mode and Illustrator rejects "A rectangle shape": "geometry could not be verified"). The Icon/Label form sends mode 'label' with the label text as the prompt; the Shape form sends shape_type for a preset, with prompt null.
//   THE FIX (flag on). The directive payload may carry icon_label_mode ("label" | "icon", ICON_LABEL), label_text (1 to 20 characters, mode "label") and shape_type (one of Illustrator's 24 presets, SHAPE) (DIRECTOR-2's flag
//   DIRECTOR_MDC_ELEMENT_FIELDS_ENABLED). lib/mdc-element-fields.ts validates them and gives the patch; lib/mdc-element-directive.ts applyDirectiveElementFields applies it to the form data the executor just built; the page calls it once.
//   Anything absent, unknown or off-contract keeps today's form data. Flag off: nothing is read.
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker MDC-ELEMENT-FIELDS (matched as a whole token): lib/mdc-element-directive.ts (the import, the comment and the function) and app/builder/page.tsx (one
// line after the form data is built). Strip those lines and each file is its base, byte for byte. The new files (lib/mdc-element-fields.ts, this strip, a proof) have no base text.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '61568fe6b7e07972051f1103749ee4551dd76ef5' // origin/studio-v4-dev-preparation-code with #544 merged (61568fe6), which this change is cut from.
export const MDC_ELEMENT_FIELDS_FLAG = 'NEXT_PUBLIC_STUDIO_MDC_ELEMENT_FIELDS'
export const MDC_ELEMENT_FIELDS_MARKER = 'MDC-ELEMENT-FIELDS'
/** The marker as a WHOLE token: MDC-ELEMENT-FIELDS-X and X-MDC-ELEMENT-FIELDS are not it. */
export const MDC_ELEMENT_FIELDS_MARKER_RE = /(?<![\w-])MDC-ELEMENT-FIELDS(?![\w-])/
/** The subject prefix of this change's own commits. */
export const MDC_ELEMENT_FIELDS_SUBJECT = 'MDC element fields:'

/** Existing files that get marked lines (pure insertions only). */
export const MDC_ELEMENT_FIELDS_FILES = [
  'lib/mdc-element-directive.ts',
  'app/builder/page.tsx',
]

/** New files (no base text to put back). */
export const MDC_ELEMENT_FIELDS_NEW_FILES = [
  'lib/mdc-element-fields.ts',
  'scripts/studio-mdc-element-fields-strip.mjs',
  'scripts/test-studio-mdc-element-fields.mjs',
]

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, whole lines, so putting them back gives the previous file byte for byte. Every line the proof has now carries MDC_ELEMENT_FIELDS_PIN_MARK. */
export const MDC_ELEMENT_FIELDS_PIN_MARK = 'LATER-CHANGES: registry read (MDC-ELEMENT-FIELDS)'
export const MDC_ELEMENT_FIELDS_PIN_EDITS = {
  // chat element edit 2 (#538, on dev) strips the page of ITS marked lines and compares it with its base (its section 5); a later change's page line has to come out first too. One module-level helper (the strips registered after #538's, positionally: a later change needs no edit again) and the call in the check.
  "scripts/test-studio-chat-element-edit-2.mjs": [
    ["const strippedPastLater = (rel, text) => { const strips = registry.LATER_STRIPS, at = strips.indexOf(stripChatElementEdit2); return (at === -1 ? [] : strips.slice(at + 1)).reduce((out, strip) => { const next = strip(rel, out); return typeof next === 'string' ? next : out }, text) } // LATER-CHANGES: registry read (MDC-ELEMENT-FIELDS), stacked after chat element edit 2: the strips of every change registered after #538's, applied first (the rule of laterStrips below, here ahead of section 6 where that is defined)\n",
      ""],
    ["  for (const rel of CHAT_ELEMENT_EDIT_2_FILES) assert.equal(stripChatElementEdit2(rel, strippedPastLater(rel, read(rel))), baseFile(rel), `${rel}: without its marked lines the file is the base's`) // LATER-CHANGES: registry read (THEME-OWN-CHOICE), stacked after chat element edit 2 // LATER-CHANGES: registry read (MDC-ELEMENT-FIELDS): every strip registered after #538's comes out first, so a later change's page line does too\n",
      "  for (const rel of CHAT_ELEMENT_EDIT_2_FILES) assert.equal(stripChatElementEdit2(rel, themeOwnChoice.stripThemeOwnChoice(rel, read(rel))), baseFile(rel), `${rel}: without its marked lines the file is the base's`) // LATER-CHANGES: registry read (THEME-OWN-CHOICE), stacked after chat element edit 2\n"],
  ],
}

/**
 * The proof without this change's edits (the previous file). Used by the strip and the proof.
 * ORDER. Chat element edit 2's check of the page is one line that THEME OWN CHOICE (registered before this change) already swapped; this change swaps it again, so the line it leaves is theme's. A consumer registered BEFORE theme
 * applies the strips after it in registry order, theme's first: theme finds none of its swapped line (this change's text is there) and puts back the rest of its lines, which takes its import line out; then this strip runs. In that case,
 * and only then (theme's import line is gone), theme's swap of the line is taken too, so the proof comes out as the consumer's own previous file. Everywhere else (this change's own proof, a consumer after theme, theme's own, which put theme back itself) the line is left as theme's.
 */
const PIN_THEME_LINE = [ "  for (const rel of CHAT_ELEMENT_EDIT_2_FILES) assert.equal(stripChatElementEdit2(rel, themeOwnChoice.stripThemeOwnChoice(rel, read(rel))), baseFile(rel), `${rel}: without its marked lines the file is the base's`) // LATER-CHANGES: registry read (THEME-OWN-CHOICE), stacked after chat element edit 2\n",
  "  for (const rel of CHAT_ELEMENT_EDIT_2_FILES) assert.equal(stripChatElementEdit2(rel, read(rel)), baseFile(rel), `${rel}: without its marked lines the file is the base's`)\n"]
const PIN_THEME_IMPORT = "const themeOwnChoice = await import('./studio-theme-own-choice-strip.mjs') // LATER-CHANGES: registry read (THEME-OWN-CHOICE), stacked after chat element edit 2: the strip of the later change, so its marked lines in the page come out first"
export function putBackPin(rel, text, edits = MDC_ELEMENT_FIELDS_PIN_EDITS) {
  let out = (edits[rel] || []).reduce((acc, [has, was]) => acc.replace(has, () => was), text)
  if (rel in edits && out.includes(PIN_THEME_LINE[0]) && !out.includes(PIN_THEME_IMPORT)) out = out.replace(PIN_THEME_LINE[0], () => PIN_THEME_LINE[1])
  return out
}

/** The older proofs this change teaches. */
export const MDC_ELEMENT_FIELDS_PIN_FILES = Object.keys(MDC_ELEMENT_FIELDS_PIN_EDITS)

export const MDC_ELEMENT_FIELDS_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...MDC_ELEMENT_FIELDS_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const MDC_ELEMENT_FIELDS_SCOPE_FILES = new Set([...MDC_ELEMENT_FIELDS_FILES, ...MDC_ELEMENT_FIELDS_NEW_FILES, ...MDC_ELEMENT_FIELDS_OWN_EDITS])

/** The whole .env.example block: its comment and its line. */
export const MDC_ELEMENT_FIELDS_ENV_BLOCK = `# STUDIO MDC ELEMENT FIELDS (FRONTEND-2, B44; E2E-2 B1b rows 40 and 41, the Studio side of DIRECTOR-2's DIRECTOR_MDC_ELEMENT_FIELDS_ENABLED). On for the exact value "true"; default off, and then a chat add is byte for byte what it was. Build-time value: change it on Vercel and redeploy.
# On: a chat add of a label ("Add a label saying 'Pilot stores'") or a preset shape ("Add a rectangle shape") uses the fields Director now sends on the directive (icon_label_mode, label_text of at most 20 characters, shape_type) and builds the request as the Element panel's own Icon/Label and Shape forms do, so the label has its words and the shape is the shape asked for.
# A missing, unknown or off-contract field keeps today's request. Turn Director's flag on after this one. No new text.
NEXT_PUBLIC_STUDIO_MDC_ELEMENT_FIELDS="false"
`

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripMdcElementFields(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in MDC_ELEMENT_FIELDS_PIN_EDITS) return putBackPin(rel, text) // an older proof this change taught: its previous text
  if (!MDC_ELEMENT_FIELDS_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !MDC_ELEMENT_FIELDS_MARKER_RE.test(line)).join('\n')
}
