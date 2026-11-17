// KNOWLEDGE-3 for FRONTEND-1 (the Research default). Flag NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON (exact "true", default off, build-time).
// On, a new chat in the Builder starts with web search on: the Builder page's first `webSearchEnabled` state and its new-chat reset read the flag. Deep research (`researchEnabled`) stays false in both places, and the restore of a reopened chat is untouched.
// Off, the page is byte for byte what it was. Nothing in the hook or the composer changes: web_search already goes out on every build message.
// Every line this change adds to an EXISTING file carries the marker RESEARCH-DEFAULT (matched as a whole token). Two of them REPLACE a base line (the two `false` initial values, so each pair's `was` is that base line) and one is a pure insertion
// (the import, whose `was` is empty), so the strip is a list of [has, was] pairs: putting each back gives the file at BASE_COMMIT byte for byte. The new files have no base text.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.
// Six older proofs are TAUGHT it as well (RESEARCH_DEFAULT_PIN_EDITS, pure insertions): they hold the Builder page to an older base as pure insertions (a base line may never be replaced), which two rewritten base lines break, so they read the page
// through this strip (or drop this change's lines from the diff they count, or its subject from the first-parent line they read); putting those lines back gives each proof's previous text byte for byte.

export const BASE_COMMIT = '0dcc90d0eecd2bba078fb3e334216afe722b5f78' // origin/studio-v4-dev-preparation-code (#638 merged), the trunk this change sits on
export const RESEARCH_DEFAULT_FLAGS = ["NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON"]
export const RESEARCH_DEFAULT_MARKER = 'RESEARCH-DEFAULT'
/** The marker as a WHOLE token: RESEARCH-DEFAULT is this change's; RESEARCH-DEFAULT-X and X-RESEARCH-DEFAULT are not. */
export const RESEARCH_DEFAULT_MARKER_RE = /(?<![\w-])RESEARCH-DEFAULT(?![\w-])/
/** The subject prefix of this change's own commits. */
export const RESEARCH_DEFAULT_SUBJECT = "Research default:"

/** Existing files that get marked lines. */
export const RESEARCH_DEFAULT_FILES = [
  "app/builder/page.tsx"
]

/** New files (no base text to put back). */
export const RESEARCH_DEFAULT_NEW_FILES = [
  "lib/studio-research-default.ts",
  "scripts/studio-research-default-strip.mjs",
  "scripts/test-studio-research-default.mjs"
]

/** The new libs that read a flag: [file, flag], one literal env read each. */
export const RESEARCH_DEFAULT_LIB_FLAGS = [["lib/studio-research-default.ts", "NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON"]]

/** [text the file has now, text the file had at BASE_COMMIT] per edit (one per marked line, in the order they sit in the file); putting them back gives the base file byte for byte. */
export const RESEARCH_DEFAULT_EDITS = {
  "app/builder/page.tsx": [
    [
      "  const [webSearchEnabled, setWebSearchEnabled] = useState(STUDIO_RESEARCH_DEFAULT_ON) // RESEARCH-DEFAULT (NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON, default off): a new chat starts with web search on; deep research stays off\n",
      "  const [webSearchEnabled, setWebSearchEnabled] = useState(false)\n"
    ],
    [
      "    setWebSearchEnabled(STUDIO_RESEARCH_DEFAULT_ON) // RESEARCH-DEFAULT (NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON, default off): the new-chat reset gives the same start; deep research stays off\n",
      "    setWebSearchEnabled(false)\n"
    ],
    [
      "import { STUDIO_RESEARCH_DEFAULT_ON } from '@/lib/studio-research-default' // RESEARCH-DEFAULT\n",
      ""
    ]
  ]
}

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, so putting them back gives the previous file byte for byte. */
export const RESEARCH_DEFAULT_PIN_MARK = "LATER-CHANGES: registry read (RESEARCH-DEFAULT)"
export const RESEARCH_DEFAULT_PIN_EDITS = {
  "scripts/test-studio-job-ledger.mjs": [
    [
      "import { stripResearchDefault, RESEARCH_DEFAULT_FILES } from './studio-research-default-strip.mjs' // LATER-CHANGES: registry read (RESEARCH-DEFAULT): the Research default (stacked after this change) rewrites two lines and adds an import in the Builder page; this proof reads the page as the change before left it\n",
      ""
    ],
    [
      "{ const realRead = fs.readFileSync; fs.readFileSync = function (file, ...rest) { const out = realRead.call(this, file, ...rest); const rel = typeof file === 'string' ? path.relative(root, file) : ''; return typeof out === 'string' && RESEARCH_DEFAULT_FILES.includes(rel) ? stripResearchDefault(rel, out) : out } } // LATER-CHANGES: registry read (RESEARCH-DEFAULT): every read of the Builder page goes through that change's own strip (never the whole registry), so this proof sees the page as the change before left it\n",
      ""
    ]
  ],
  "scripts/test-studio-new-deck-handoff-send.mjs": [
    [
      "import { stripResearchDefault, RESEARCH_DEFAULT_FILES } from './studio-research-default-strip.mjs' // LATER-CHANGES: registry read (RESEARCH-DEFAULT): the Research default (stacked after this change) rewrites two lines and adds an import in the Builder page; this proof reads the page as the change before left it\n",
      ""
    ],
    [
      "{ const realRead = fs.readFileSync; fs.readFileSync = function (file, ...rest) { const out = realRead.call(this, file, ...rest); const rel = typeof file === 'string' ? path.relative(root, file) : ''; return typeof out === 'string' && RESEARCH_DEFAULT_FILES.includes(rel) ? stripResearchDefault(rel, out) : out } } // LATER-CHANGES: registry read (RESEARCH-DEFAULT): every read of the Builder page goes through that change's own strip (never the whole registry), so this proof sees the page as the change before left it\n",
      ""
    ]
  ],
  "scripts/test-studio-chat-element-refine.mjs": [
    [
      "import { stripResearchDefault, RESEARCH_DEFAULT_FILES } from './studio-research-default-strip.mjs' // stacked after #475: LATER-CHANGES: registry read (RESEARCH-DEFAULT): the Research default (stacked after this change) rewrites two lines and adds an import in the Builder page; this proof reads the page as the change before left it\n",
      ""
    ],
    [
      "{ const realRead = fs.readFileSync; fs.readFileSync = function (file, ...rest) { const out = realRead.call(this, file, ...rest); const rel = typeof file === 'string' ? path.relative(root, file) : ''; return typeof out === 'string' && RESEARCH_DEFAULT_FILES.includes(rel) ? stripResearchDefault(rel, out) : out } } // stacked after #475: LATER-CHANGES: registry read (RESEARCH-DEFAULT): every read of the Builder page goes through that change's own strip (never the whole registry), so this proof sees the page as the change before left it\n",
      ""
    ]
  ],
  "scripts/test-studio-chat-element-edit.mjs": [
    [
      "import { researchDefaultDiffLine } from './studio-research-default-strip.mjs' // LATER-CHANGES: registry read (RESEARCH-DEFAULT): the Research default (stacked after this change) rewrites two base lines of the Builder page and adds a marked import; this proof drops them from the diff it counts\n",
      ""
    ],
    [
      "  diff.splice(0, diff.length, ...diff.filter(line => !researchDefaultDiffLine(line))) // LATER-CHANGES: registry read (RESEARCH-DEFAULT): the Research default's lines of the page's diff (the added ones, and the two base lines they replace) are its own, not this change's\n",
      ""
    ],
    [
      "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Research default:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (RESEARCH-DEFAULT): on a branch stacked after this change (the Research default), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n",
      ""
    ]
  ],
  "scripts/test-studio-deck-sync-truth.mjs": [
    [
      "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Research default:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (RESEARCH-DEFAULT): on a branch stacked after this change (the Research default), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n",
      ""
    ]
  ],
  "scripts/test-studio-billing-f5-usage.mjs": [
    [
      "import { researchDefaultDiffLine } from './studio-research-default-strip.mjs' // LATER-CHANGES: registry read (RESEARCH-DEFAULT): the Research default (stacked after this change) rewrites two base lines of the Builder page and adds a marked import; this proof drops them from the diff it counts\n",
      ""
    ],
    [
      "  added.splice(0, added.length, ...added.filter(l => !researchDefaultDiffLine(l))) // LATER-CHANGES: registry read (RESEARCH-DEFAULT): the Research default's lines of the diff (the added ones, and the two base lines they replace) are its own, not a stray\n",
      ""
    ]
  ]
}

/** The older proofs this change teaches. */
export const RESEARCH_DEFAULT_PIN_FILES = Object.keys(RESEARCH_DEFAULT_PIN_EDITS)

export const RESEARCH_DEFAULT_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...RESEARCH_DEFAULT_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const RESEARCH_DEFAULT_SCOPE_FILES = new Set([...RESEARCH_DEFAULT_FILES, ...RESEARCH_DEFAULT_NEW_FILES, ...RESEARCH_DEFAULT_OWN_EDITS])

/** The whole .env.example block: its comments and its line. */
export const RESEARCH_DEFAULT_ENV_BLOCK = "# STUDIO RESEARCH DEFAULT (KNOWLEDGE-3 for FRONTEND-1). On for the exact value \"true\"; default off, and then the Builder page is byte for byte as it was. Build-time value: change it on Vercel and redeploy.\n# On: a new chat in the Builder starts with Research (web search) switched on, in the composer's first state and in the new-chat reset. Deep research stays off, and a reopened chat keeps the value it was saved with. The build message already carries data.web_search on every send, so nothing else changes.\nNEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_ON=\"false\"\n"

/** The file with this change's edits put back (the previous text). Used by the strip and the proof. */
export function putBackResearchDefault(rel, text) {
  return (RESEARCH_DEFAULT_EDITS[rel] || RESEARCH_DEFAULT_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The file without this change's edits: each [has, was] pair put back; every other byte stays. Any other file is returned as it is. */
export function stripResearchDefault(rel, text) {
  if (typeof text !== 'string') return text
  if (!(rel in RESEARCH_DEFAULT_EDITS) && !(rel in RESEARCH_DEFAULT_PIN_EDITS)) return text
  return putBackResearchDefault(rel, text)
}

const RESEARCH_DEFAULT_WAS_LINES = new Set(Object.values(RESEARCH_DEFAULT_EDITS).flat().map(([, was]) => was.replace(/\n$/, '')).filter(line => line !== ''))
/** Whether a line of `git diff -U0` (with its "+" or "-") is this change's: an added line that carries the marker, or a removed line that is one of the base lines this change rewrites. For the older proofs that count a diff against an older base. */
export function researchDefaultDiffLine(line) {
  if (typeof line !== 'string') return false
  if (line.startsWith('+') && !line.startsWith('+++')) return RESEARCH_DEFAULT_MARKER_RE.test(line)
  if (line.startsWith('-') && !line.startsWith('---')) return RESEARCH_DEFAULT_WAS_LINES.has(line.slice(1))
  return false
}
