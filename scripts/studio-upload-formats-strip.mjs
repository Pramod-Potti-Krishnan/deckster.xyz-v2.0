// FRONTEND-1 (wave 1 step 0.9-S "narrow the Studio upload picker's formats"; the formats are the Researcher's, settled by KNOWLEDGE-3 and AGENT-1G). Flags NEXT_PUBLIC_STUDIO_UPLOAD_FORMATS_NARROW and NEXT_PUBLIC_STUDIO_UPLOAD_TEXT_FORMATS (each the exact "true", default off, build-time).
// NARROW (with the Studio shell on): the composer's file picker offers only what the Researcher reads today, .pdf .docx .txt .md .xlsx .csv .pptx and the images .png .jpg .jpeg .gif .webp (no .doc, .xls or .ppt), and a file dropped on the composer that is not on the same list is left out. TEXT_FORMATS acts only with NARROW on: it adds .json .xml .yaml .yml .py .js .ts .java .go .rs
// (the Researcher reads them only with its own text-formats switch, merged dark: turn TEXT_FORMATS on only after that switch is on in the same environment). Off, the picker's accept string, the drop and the page are what they were.
// The picker's accept string and the drop's check are built from ONE set of lists (lib/studio-upload-formats.ts), so they cannot drift apart.
// Every line this change adds to an EXISTING file carries the marker STUDIO-UPLOAD-FORMATS (matched as a whole token) and is a PURE INSERTION (no base line is rewritten: the composer gains three lines in three places), so the strip is a list of [has, was] pairs whose `was` is empty:
// putting each back gives the file at BASE_COMMIT byte for byte. The new files have no base text.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.
// Older proofs are TAUGHT inserted marked lines only (UPLOAD_FORMATS_PIN_EDITS, pure insertions): the two that read the first-parent line of BASE..HEAD each drop this change's commits from it (as for every later change; the first commit of this change has no subject prefix, so the line names both forms of the subject),
// and the proofs that hold the composer to its base read it through this change's own strip (an import and a read hook, as the hero-only Replace picture change taught the Replace picture proof); putting those lines back gives each proof's previous text byte for byte.

export const BASE_COMMIT = "374d697a6482504972ef3454df572bf513a8957b" // origin/studio-v4-dev-preparation-code (#642, #644 and #645 merged), the trunk this change sits on
export const UPLOAD_FORMATS_FLAGS = ["NEXT_PUBLIC_STUDIO_UPLOAD_FORMATS_NARROW", "NEXT_PUBLIC_STUDIO_UPLOAD_TEXT_FORMATS"]
export const UPLOAD_FORMATS_MARKER = "STUDIO-UPLOAD-FORMATS"
/** The marker as a WHOLE token: STUDIO-UPLOAD-FORMATS is this change's; X-STUDIO-UPLOAD-FORMATS and STUDIO-UPLOAD-FORMATS-X are not. */
export const UPLOAD_FORMATS_MARKER_RE = /(?<![\w-])STUDIO-UPLOAD-FORMATS(?![\w-])/
/** The subject prefix of this change's own commits; the one commit that came before it (Codex's, kept with its author) is "Narrow Studio upload formats behind flags" with no prefix. */
export const UPLOAD_FORMATS_SUBJECT = "Upload formats:"
export const UPLOAD_FORMATS_FIRST_SUBJECT = "Narrow Studio upload formats behind flags"
/** Both forms of this change's commit subjects (a merge of dev carries the prefix too, and is left out of the scope by --no-merges; a subject read from git ends in a newline, hence the \s*). */
export const UPLOAD_FORMATS_SUBJECT_RE = /^(Upload formats:|Narrow Studio upload formats behind flags\s*$)/

/** Existing files that get marked lines. */
export const UPLOAD_FORMATS_FILES = [
  "components/builder/chat-input.tsx"
]

/** New files (no base text to put back). */
export const UPLOAD_FORMATS_NEW_FILES = [
  "lib/studio-upload-formats.ts",
  "scripts/studio-upload-formats-strip.mjs",
  "scripts/test-studio-upload-formats.mjs"
]

/** The new libs that read a flag: [file, flag], one literal env read each. */
export const UPLOAD_FORMATS_LIB_FLAGS = [["lib/studio-upload-formats.ts", "NEXT_PUBLIC_STUDIO_UPLOAD_FORMATS_NARROW"], ["lib/studio-upload-formats.ts", "NEXT_PUBLIC_STUDIO_UPLOAD_TEXT_FORMATS"]]

/** [text the file has now, text the file had at BASE_COMMIT] per edit (one per marked line, in the order they sit in the file); putting them back gives the base file byte for byte. */
export const UPLOAD_FORMATS_EDITS = {
  "components/builder/chat-input.tsx": [
    [
      "import { STUDIO_UPLOAD_ACCEPT, acceptsUploadFile } from '@/lib/studio-upload-formats' // STUDIO-UPLOAD-FORMATS\n",
      ""
    ],
    [
      "      {...(studio && STUDIO_UPLOAD_ACCEPT ? { accept: STUDIO_UPLOAD_ACCEPT } : {})} // STUDIO-UPLOAD-FORMATS (NEXT_PUBLIC_STUDIO_UPLOAD_FORMATS_NARROW, default off): the picker offers only what the Researcher reads today (lib/studio-upload-formats.ts); off, the accept above stands\n",
      ""
    ],
    [
      "          if (studio && STUDIO_UPLOAD_ACCEPT) files.splice(0, files.length, ...files.filter(file => acceptsUploadFile(file.name))) // STUDIO-UPLOAD-FORMATS: with the narrow flag on, a dropped file that is not on the picker's list is left out (nothing is said; when none is left, nothing happens); off, every dropped file goes on as before\n",
      ""
    ]
  ]
}

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, so putting them back gives the previous file byte for byte. */
export const UPLOAD_FORMATS_PIN_MARK = "LATER-CHANGES: registry read (STUDIO-UPLOAD-FORMATS)"
export const UPLOAD_FORMATS_PIN_EDITS = {
  "scripts/test-studio-chat-element-edit.mjs": [
    [
      "  shas.splice(0, shas.length, ...shas.filter(sha => !/^(Upload formats:|Narrow Studio upload formats behind flags\\s*$)/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (STUDIO-UPLOAD-FORMATS): on a branch stacked after this change (the Studio upload picker formats, wave 1 step 0.9-S; its first commit has no subject prefix), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n",
      ""
    ]
  ],
  "scripts/test-studio-deck-sync-truth.mjs": [
    [
      "  shas.splice(0, shas.length, ...shas.filter(sha => !/^(Upload formats:|Narrow Studio upload formats behind flags\\s*$)/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (STUDIO-UPLOAD-FORMATS): on a branch stacked after this change (the Studio upload picker formats, wave 1 step 0.9-S; its first commit has no subject prefix), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n",
      ""
    ]
  ]
}

/** The older proofs this change teaches. */
export const UPLOAD_FORMATS_PIN_FILES = Object.keys(UPLOAD_FORMATS_PIN_EDITS)

export const UPLOAD_FORMATS_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...UPLOAD_FORMATS_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const UPLOAD_FORMATS_SCOPE_FILES = new Set([...UPLOAD_FORMATS_FILES, ...UPLOAD_FORMATS_NEW_FILES, ...UPLOAD_FORMATS_OWN_EDITS])

/** The whole .env.example block: its comments and its two lines. */
export const UPLOAD_FORMATS_ENV_BLOCK = "# STUDIO UPLOAD FORMATS (FRONTEND-1, wave 1 step 0.9-S). Both flags take the exact value \"true\" and default off; off, nothing changes (the composer's file picker and drag and drop take what they always did). Build-time values: change them on Vercel and redeploy. Both act only with the Studio shell also on.\n# NARROW (the first flag): the composer's file picker offers only what the Researcher reads today: .pdf .docx .txt .md .xlsx .csv .pptx and the images .png .jpg .jpeg .gif .webp (no .doc, .xls or .ppt, which it does not read), and a file dropped on the composer that is not on that list is left out (nothing is said).\n# TEXT FORMATS (the second flag): acts only with the first flag on; it adds .json .xml .yaml .yml .py .js .ts .java .go .rs to the picker and to the drop.\n# Turn the second flag on only after the Researcher's text-formats switch is on in the same environment; until then those files are offered and the Researcher does not read them.\nNEXT_PUBLIC_STUDIO_UPLOAD_FORMATS_NARROW=\"false\"\nNEXT_PUBLIC_STUDIO_UPLOAD_TEXT_FORMATS=\"false\"\n"

/** The file with this change's edits put back (the previous text). Used by the strip and the proof. */
export function putBackUploadFormats(rel, text) {
  return (UPLOAD_FORMATS_EDITS[rel] || UPLOAD_FORMATS_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The file without this change's edits: each [has, was] pair put back; every other byte stays. Any other file is returned as it is. */
export function stripUploadFormats(rel, text) {
  if (typeof text !== 'string') return text
  if (!(rel in UPLOAD_FORMATS_EDITS) && !(rel in UPLOAD_FORMATS_PIN_EDITS)) return text
  return putBackUploadFormats(rel, text)
}
