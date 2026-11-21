// FRONTEND-1 (wave 1 step 0.9-S "narrow the Studio upload picker's formats"; the formats are the Researcher's, settled by KNOWLEDGE-3 and AGENT-1G). Flags NEXT_PUBLIC_STUDIO_UPLOAD_FORMATS_NARROW and NEXT_PUBLIC_STUDIO_UPLOAD_TEXT_FORMATS (each the exact "true", default off, build-time).
// NARROW (with the Studio shell on): the composer's file picker offers only what the Researcher reads today, .pdf .docx .txt .md .xlsx .csv .pptx and the images .png .jpg .jpeg .gif .webp (no .doc, .xls or .ppt), and a file dropped on the composer that is not on the same list is left out. TEXT_FORMATS acts only with NARROW on: it adds .json .xml .yaml .yml .py .js .ts .java .go .rs
// (the Researcher reads them only with its own text-formats switch, merged dark: turn TEXT_FORMATS on only after that switch is on in the same environment). Off, the picker's accept string, the drop and the page are what they were.
// The picker's accept string and the drop's check are built from ONE set of lists (lib/studio-upload-formats.ts), so they cannot drift apart.
// Every line this change adds to an EXISTING file carries the marker STUDIO-UPLOAD-FORMATS (matched as a whole token) and is a PURE INSERTION (no base line is rewritten: the composer gains three lines in three places), so the strip is a list of [has, was] pairs whose `was` is empty:
// putting each back gives the file at BASE_COMMIT byte for byte: the composer (three marked lines), .env.example (the block, last) and the registry (its three lines). The new files have no base text.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.
// Older proofs are TAUGHT marked lines (UPLOAD_FORMATS_PIN_EDITS): the two that read the first-parent line of BASE..HEAD each drop this change's commits from it (as for every later change; the first commit of this change has no subject prefix, so the line names both forms of the subject); the Drive composer proof, which loads the real composer over a table of stubs for its imports, gains one stub;
// the proofs that hold the composer, .env.example or the registry to their bytes read them through this change's own strip (an import and a read hook, as the research-by-level change taught its neighbours; UPLOAD_FORMATS_READ_FILES). Most taught lines are pure insertions; three REWRITE one line each (the My companions wiring proof's list of files dev must not have, which named lib/studio-upload-formats.ts as another change's;
// the research-by-level proof's check that its strip runs last, and its check that no file is outside its scope), because those say "last" and "alone" of a change that now has one stacked after it. Putting each pair back gives each proof's previous text byte for byte.

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
      "      {...(studio && STUDIO_UPLOAD_ACCEPT ? { accept: STUDIO_UPLOAD_ACCEPT } : ({} as { accept?: string }))} // STUDIO-UPLOAD-FORMATS (NEXT_PUBLIC_STUDIO_UPLOAD_FORMATS_NARROW, default off): the picker offers only what the Researcher reads today (lib/studio-upload-formats.ts); off, the accept above stands\n",
      ""
    ],
    [
      "          if (studio && STUDIO_UPLOAD_ACCEPT) files.splice(0, files.length, ...files.filter(file => acceptsUploadFile(file.name))) // STUDIO-UPLOAD-FORMATS: with the narrow flag on, a dropped file that is not on the picker's list is left out (nothing is said; when none is left, nothing happens); off, every dropped file goes on as before\n",
      ""
    ]
  ],
  ".env.example": [
    [
      "\n# STUDIO UPLOAD FORMATS (FRONTEND-1, wave 1 step 0.9-S). Both flags take the exact value \"true\" and default off; off, nothing changes (the composer's file picker and drag and drop take what they always did). Build-time values: change them on Vercel and redeploy. Both act only with the Studio shell also on.\n# NARROW (the first flag): the composer's file picker offers only what the Researcher reads today: .pdf .docx .txt .md .xlsx .csv .pptx and the images .png .jpg .jpeg .gif .webp (no .doc, .xls or .ppt, which it does not read), and a file dropped on the composer that is not on that list is left out (nothing is said).\n# TEXT FORMATS (the second flag): acts only with the first flag on; it adds .json .xml .yaml .yml .py .js .ts .java .go .rs to the picker and to the drop.\n# Turn the second flag on only after the Researcher's text-formats switch is on in the same environment; until then those files are offered and the Researcher does not read them.\nNEXT_PUBLIC_STUDIO_UPLOAD_FORMATS_NARROW=\"false\"\nNEXT_PUBLIC_STUDIO_UPLOAD_TEXT_FORMATS=\"false\"\n",
      ""
    ]
  ],
  "scripts/studio-later-changes.mjs": [
    [
      "  ...(await import('./studio-upload-formats-strip.mjs')).UPLOAD_FORMATS_SCOPE_FILES, // LATER-CHANGE: FRONTEND-1, Upload formats: the composer's file picker and drop take only the formats the Researcher reads today, its data and source files too with a second flag once the Researcher's switch for them is on (NEXT_PUBLIC_STUDIO_UPLOAD_FORMATS_NARROW)\n",
      ""
    ],
    [
      "  (await import('./studio-upload-formats-strip.mjs')).UPLOAD_FORMATS_ENV_BLOCK, // LATER-CHANGE: FRONTEND-1, Upload formats: the composer's file picker and drop take only the formats the Researcher reads today, its data and source files too with a second flag once the Researcher's switch for them is on (NEXT_PUBLIC_STUDIO_UPLOAD_FORMATS_NARROW)\n",
      ""
    ],
    [
      "  (await import('./studio-upload-formats-strip.mjs')).stripUploadFormats, // LATER-CHANGE: FRONTEND-1, Upload formats: the composer's file picker and drop take only the formats the Researcher reads today, its data and source files too with a second flag once the Researcher's switch for them is on (NEXT_PUBLIC_STUDIO_UPLOAD_FORMATS_NARROW)\n",
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
  ],
  "scripts/test-studio-connectors-gdrive-composer.mjs": [
    [
      "  '@/lib/studio-upload-formats': { STUDIO_UPLOAD_ACCEPT: undefined, acceptsUploadFile: () => true }, // LATER-CHANGES: registry read (STUDIO-UPLOAD-FORMATS): the composer's static import of the upload formats lib (the narrow flag is off here: no narrowed accept string, so the picker and the drop are the base's)\n",
      ""
    ]
  ],
  "scripts/test-studio-my-companions-wiring.mjs": [
    [
      "import { stripUploadFormats, UPLOAD_FORMATS_FILES } from './studio-upload-formats-strip.mjs' // LATER-CHANGES: registry read (STUDIO-UPLOAD-FORMATS): the Studio upload formats change (stacked after this change) marks lines in the composer; this proof checks that the composer is dev's, so it reads the composer as this change left it\n",
      ""
    ],
    [
      "{ const realRead = fs.readFileSync; fs.readFileSync = function (file, ...rest) { const out = realRead.call(this, file, ...rest); const rel = typeof file === 'string' ? path.relative(root, file) : ''; return typeof out === 'string' && UPLOAD_FORMATS_FILES.includes(rel) ? stripUploadFormats(rel, out) : out } } // LATER-CHANGES: registry read (STUDIO-UPLOAD-FORMATS): every read of a file the Studio upload formats change marks goes through that change's own strip (never the registry), so this proof sees the file as this change left it\n",
      ""
    ],
    [
      "const UNTOUCHED = ['app/builder/page.tsx', 'components/builder/chat-input.tsx', 'middleware.ts', 'next.config.mjs', 'components/studio-avatar-spawn/steps.tsx', 'components/studio-avatar-spawn/studio-avatar-spawn-app.tsx', 'components/studio-avatar-spawn/studio-avatar-spawn.css', 'lib/studio-avatar-spawn.ts', 'components/builder/voice-call/companion-player.tsx', 'components/builder/voice-call/layered-face.ts', 'lib/studio-thinking-levels.ts'] // LATER-CHANGES: registry read (STUDIO-UPLOAD-FORMATS): the Studio upload formats change (stacked after this change) creates lib/studio-upload-formats.ts, which this list held absent (\"another change's, not yet merged\"); it is not listed any more\n",
      "const UNTOUCHED = ['app/builder/page.tsx', 'components/builder/chat-input.tsx', 'middleware.ts', 'next.config.mjs', 'components/studio-avatar-spawn/steps.tsx', 'components/studio-avatar-spawn/studio-avatar-spawn-app.tsx', 'components/studio-avatar-spawn/studio-avatar-spawn.css', 'lib/studio-avatar-spawn.ts', 'components/builder/voice-call/companion-player.tsx', 'components/builder/voice-call/layered-face.ts', 'lib/studio-thinking-levels.ts', 'lib/studio-upload-formats.ts']\n"
    ]
  ],
  "scripts/test-studio-research-by-level.mjs": [
    [
      "import { UAT_MARKETING_V4_SCOPE_FILES } from './studio-uat-marketing-v4-strip.mjs' // RESEARCH-BY-LEVEL (S67): uat's own marketing-v4 site, the set the uat marketing registry names; read by check F's whole-range scope only; LATER-CHANGES: registry read (STUDIO-UPLOAD-FORMATS): taught to that change's pin with the other lines of this proof\n",
      ""
    ],
    [
      "import { stripUploadFormats, UPLOAD_FORMATS_READ_FILES, UPLOAD_FORMATS_SCOPE_FILES } from './studio-upload-formats-strip.mjs' // LATER-CHANGES: registry read (STUDIO-UPLOAD-FORMATS): the Studio upload formats change (stacked after this change) marks lines in the composer and adds a block, three registry lines and a splice line to files this proof holds to this change's own bytes; this proof reads them as this change left them\n",
      ""
    ],
    [
      "{ const realRead = fs.readFileSync; fs.readFileSync = function (file, ...rest) { const out = realRead.call(this, file, ...rest); const rel = typeof file === 'string' ? path.relative(root, file) : ''; return typeof out === 'string' && UPLOAD_FORMATS_READ_FILES.includes(rel) ? stripUploadFormats(rel, out) : out } } // LATER-CHANGES: registry read (STUDIO-UPLOAD-FORMATS): every read of a file the Studio upload formats change edits goes through that change's own strip (never the registry), so this proof sees the file as this change left it\n",
      ""
    ],
    [
      "const wholeRangeOutside = (names, marketing = UAT_MARKETING_V4_SCOPE_FILES) => names.filter(Boolean).filter(rel => !SCOPE.has(rel) && !UPLOAD_FORMATS_SCOPE_FILES.has(rel) && !marketing.has(rel)).sort() // RESEARCH-BY-LEVEL (S67): the committed files of BASE..HEAD that no scope names; a promotion merge of dev into uat carries uat's own marketing-v4 commits, left out by exact path (the uat marketing registry's set), never by prefix and never every later change's files; LATER-CHANGES: registry read (STUDIO-UPLOAD-FORMATS): taught to that change's pin with the other lines of this proof\n",
      ""
    ],
    [
      "  assert.ok(registry.LATER_STRIPS.includes(STRIP_FN) && registry.LATER_STRIPS.slice(registry.LATER_STRIPS.indexOf(STRIP_FN) + 1).every(strip => strip === stripUploadFormats), 'the strip runs last, but for the Studio upload formats change\\'s (the order the changes were stacked)') // LATER-CHANGES: registry read (STUDIO-UPLOAD-FORMATS): that change's strip is registered after this one\n",
      "  assert.equal(registry.LATER_STRIPS.at(-1), STRIP_FN, 'the strip runs last (the order the changes were stacked)')\n"
    ],
    [
      "  assert.deepEqual(wholeRangeOutside(git('diff', '--name-only', `${BASE_COMMIT}..HEAD`).split('\\n')), [], 'over the whole committed range no file is outside the scope either') // LATER-CHANGES: registry read (STUDIO-UPLOAD-FORMATS): the files of the Studio upload formats change, stacked after this one, are its own; RESEARCH-BY-LEVEL (S67): so are, on a promotion merge of dev into uat, uat's own marketing-v4 files (see wholeRangeOutside)\n",
      "  assert.deepEqual(git('diff', '--name-only', `${BASE_COMMIT}..HEAD`).split('\\n').filter(Boolean).filter(rel => !SCOPE.has(rel)).sort(), [], 'over the whole committed range no file is outside the scope either')\n"
    ],
    [
      "  assert.deepEqual(wholeRangeOutside([...UAT_MARKETING_V4_SCOPE_FILES, ...SCOPE, ...UPLOAD_FORMATS_SCOPE_FILES, 'lib/stray-file.ts', 'components/marketing/v4/not-uats-own.tsx']), ['components/marketing/v4/not-uats-own.tsx', 'lib/stray-file.ts'], 'a promotion merge: uat\\'s own marketing-v4 files, this change\\'s and the upload formats change\\'s are left out; a stray product file and a marketing path uat does not own are still named') // RESEARCH-BY-LEVEL (S67): the table row for the line above; LATER-CHANGES: registry read (STUDIO-UPLOAD-FORMATS): taught to that change's pin with the other lines of this proof\n",
      ""
    ],
    [
      "await mutant('scope: the whole-range check no longer leaves out uat\\'s own marketing files (a promotion merge)', () => assert.deepEqual(wholeRangeOutside([...UAT_MARKETING_V4_SCOPE_FILES], new Set()), [])) // RESEARCH-BY-LEVEL (S67): the filter dropped; LATER-CHANGES: registry read (STUDIO-UPLOAD-FORMATS): taught to that change's pin with the other lines of this proof\n",
      ""
    ]
  ]
}

/** The older proofs this change teaches. */
export const UPLOAD_FORMATS_PIN_FILES = Object.keys(UPLOAD_FORMATS_PIN_EDITS)

export const UPLOAD_FORMATS_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...UPLOAD_FORMATS_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const UPLOAD_FORMATS_SCOPE_FILES = new Set([...UPLOAD_FORMATS_FILES, ...UPLOAD_FORMATS_NEW_FILES, ...UPLOAD_FORMATS_OWN_EDITS])

/** Every EXISTING file this change edits: an older proof that holds one of them to the bytes it had reads it through this strip (a read hook on fs.readFileSync, never the registry). */
export const UPLOAD_FORMATS_READ_FILES = [...UPLOAD_FORMATS_FILES, ...UPLOAD_FORMATS_OWN_EDITS]

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
