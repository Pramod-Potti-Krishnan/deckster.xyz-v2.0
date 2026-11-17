// FRONTEND-1 (PK's UAT test of Replace picture, 17 Nov 2026: the button was offered on content slides, where a photo behind dense text hurts reading, and on open the dialog showed behind the slide first). Flag NEXT_PUBLIC_STUDIO_REPLACE_PICTURE_HERO_ONLY (exact "true", default off, build-time).
// It acts only where Replace picture itself acts (NEXT_PUBLIC_STUDIO_REPLACE_SLIDE_PICTURE with the Studio shell). Off, the Replace picture lib, hook and control are what they were: every line this change adds to an EXISTING file is marked, and the new files are inert.
// With it on: (1) a slide that Layout says is eligible but whose target is KNOWN to be slide_background (a layout with no picture slot) offers no Replace picture (the button is greyed with "This slide's layout has no picture slot, so its picture cannot be replaced here.", the hook's own re-check at Replace included); Layout's own refusal of a slide keeps Layout's reason; an unknown target and hero_slot stay as they were.
// (2) the dialog and its overlay are drawn at full strength in front of the viewer from the first frame (replace-picture-hero-only.css, reached only through a data attribute the control sets with the flag on).
// Every line this change adds to an EXISTING file carries the marker REPLACE-PICTURE-HERO-ONLY (matched as a whole token) and is a PURE INSERTION (no base line is rewritten), so the strip is a list of [has, was] pairs whose `was` is empty: putting each back gives the file at BASE_COMMIT byte for byte.
// The new files have no base text. The viewer, the slide area and the Builder page are not touched.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.
// Older proofs are TAUGHT inserted marked lines only (HERO_ONLY_PIN_EDITS, pure insertions): the two that read the first-parent line each drop this change's subject from it, as for every later change; putting those lines back gives each proof's previous text byte for byte.

export const BASE_COMMIT = '4cb2cd79f4559abc6928f0912c9405f8d58ddadc' // origin/studio-v4-dev-preparation-code (#641 merged), the trunk this change sits on
export const HERO_ONLY_FLAGS = ["NEXT_PUBLIC_STUDIO_REPLACE_PICTURE_HERO_ONLY"]
export const HERO_ONLY_MARKER = 'REPLACE-PICTURE-HERO-ONLY'
/** The marker as a WHOLE token: REPLACE-PICTURE-HERO-ONLY is this change's; REPLACE-PICTURE (the Replace picture change's own marker) and X-REPLACE-PICTURE-HERO-ONLY are not. */
export const HERO_ONLY_MARKER_RE = /(?<![\w-])REPLACE-PICTURE-HERO-ONLY(?![\w-])/
/** The subject prefix of this change's own commits. */
export const HERO_ONLY_SUBJECT = "Replace picture hero only:"

/** Existing files that get marked lines. */
export const HERO_ONLY_FILES = [
  "lib/studio-replace-picture.ts",
  "hooks/use-studio-replace-picture.ts",
  "components/builder/replace-picture/replace-picture-control.tsx"
]

/** New files (no base text to put back). */
export const HERO_ONLY_NEW_FILES = [
  "lib/studio-replace-picture-hero-only.ts",
  "components/builder/replace-picture/replace-picture-hero-only.css",
  "scripts/studio-replace-picture-hero-only-strip.mjs",
  "scripts/test-studio-replace-picture-hero-only.mjs"
]

/** The new libs that read a flag: [file, flag], one literal env read each. */
export const HERO_ONLY_LIB_FLAGS = [["lib/studio-replace-picture-hero-only.ts", "NEXT_PUBLIC_STUDIO_REPLACE_PICTURE_HERO_ONLY"]]

/** [text the file has now, text the file had at BASE_COMMIT] per edit (one per marked line, in the order they sit in the file); putting them back gives the base file byte for byte. */
export const HERO_ONLY_EDITS = {
  "lib/studio-replace-picture.ts": [
    [
      "  heroOnlyReason?: string | null // REPLACE-PICTURE-HERO-ONLY: the hero-only rule's words when it applies to the slide on screen (hooks/use-studio-replace-picture.ts, lib/studio-replace-picture-hero-only.ts); absent or null: the rule adds no reason\n",
      ""
    ],
    [
      "  if (typeof a.heroOnlyReason === 'string' && a.heroOnlyReason !== '') return a.heroOnlyReason // REPLACE-PICTURE-HERO-ONLY: last: a slide Layout says is eligible but whose layout has no picture slot (target slide_background) offers no picture; every reason above, Layout's own not-eligible one included, comes first\n",
      ""
    ]
  ],
  "hooks/use-studio-replace-picture.ts": [
    [
      "import { STUDIO_REPLACE_PICTURE_HERO_ONLY, heroOnlyReasonFor } from '@/lib/studio-replace-picture-hero-only' // REPLACE-PICTURE-HERO-ONLY\n",
      ""
    ],
    [
      "    heroOnlyReason: heroOnlyReasonFor(eligibility, STUDIO_REPLACE_PICTURE_HERO_ONLY), // REPLACE-PICTURE-HERO-ONLY (NEXT_PUBLIC_STUDIO_REPLACE_PICTURE_HERO_ONLY, default off): a slide Layout says is eligible but whose layout has no picture slot (target slide_background) offers none; Layout's own refusal keeps its words; flag off, null\n",
      ""
    ]
  ],
  "components/builder/replace-picture/replace-picture-control.tsx": [
    [
      "import { STUDIO_REPLACE_PICTURE_HERO_ONLY } from \"@/lib/studio-replace-picture-hero-only\" // REPLACE-PICTURE-HERO-ONLY\n",
      ""
    ],
    [
      "import \"./replace-picture-hero-only.css\" // REPLACE-PICTURE-HERO-ONLY\n",
      ""
    ],
    [
      "          {...(STUDIO_REPLACE_PICTURE_HERO_ONLY ? { \"data-studio-replace-picture-layer\": \"front\" } : {})} // REPLACE-PICTURE-HERO-ONLY (NEXT_PUBLIC_STUDIO_REPLACE_PICTURE_HERO_ONLY, default off): the dialog and its overlay are in front of the viewer from the first frame (replace-picture-hero-only.css); flag off, no attribute\n",
      ""
    ]
  ]
}

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, so putting them back gives the previous file byte for byte. */
export const HERO_ONLY_PIN_MARK = "LATER-CHANGES: registry read (REPLACE-PICTURE-HERO-ONLY)"
export const HERO_ONLY_PIN_EDITS = {
  "scripts/test-studio-replace-picture.mjs": [
    [
      "import { stripReplacePictureHeroOnly, HERO_ONLY_FILES } from './studio-replace-picture-hero-only-strip.mjs' // LATER-CHANGES: registry read (REPLACE-PICTURE-HERO-ONLY): the hero-only change (stacked after this change) marks lines in this change's lib, hook and control; this proof reads them as this change left them\n",
      ""
    ],
    [
      "{ const realRead = fs.readFileSync; fs.readFileSync = function (file, ...rest) { const out = realRead.call(this, file, ...rest); const rel = typeof file === 'string' ? path.relative(root, file) : ''; return typeof out === 'string' && HERO_ONLY_FILES.includes(rel) ? stripReplacePictureHeroOnly(rel, out) : out } } // LATER-CHANGES: registry read (REPLACE-PICTURE-HERO-ONLY): every read of a file the hero-only change marks goes through that change's own strip (never the registry), so this proof sees the file as this change left it\n",
      ""
    ]
  ],
  "scripts/test-studio-chat-element-edit.mjs": [
    [
      "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Replace picture hero only:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (REPLACE-PICTURE-HERO-ONLY): on a branch stacked after this change (the hero-only Replace picture), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n",
      ""
    ]
  ],
  "scripts/test-studio-deck-sync-truth.mjs": [
    [
      "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Replace picture hero only:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (REPLACE-PICTURE-HERO-ONLY): on a branch stacked after this change (the hero-only Replace picture), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n",
      ""
    ]
  ]
}

/** The older proofs this change teaches. */
export const HERO_ONLY_PIN_FILES = Object.keys(HERO_ONLY_PIN_EDITS)

export const HERO_ONLY_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...HERO_ONLY_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const REPLACE_PICTURE_HERO_ONLY_SCOPE_FILES = new Set([...HERO_ONLY_FILES, ...HERO_ONLY_NEW_FILES, ...HERO_ONLY_OWN_EDITS])

/** The whole .env.example block: its comments and its line. */
export const REPLACE_PICTURE_HERO_ONLY_ENV_BLOCK = "# STUDIO REPLACE PICTURE HERO ONLY (FRONTEND-1; PK's UAT test of Replace picture, 17 Nov). On for the exact value \"true\"; default off, and then the Replace picture button and its dialog are exactly as they were. Build-time value: change it on Vercel and redeploy.\n# On, and only where the Replace picture action itself is on: the button is offered only on a slide whose layout has a picture slot (Layout's hero_slot target: the title, section and closing layouts). When Layout's slide catalog says the slide on screen is eligible but takes its picture as its background (every other layout, where a photo behind dense text hurts reading), the button is greyed with \"This slide's layout has no picture slot, so its picture cannot be replaced here.\" The words speak of the layout, never of a slide role, so they are true for a title slide in another layout too. If Layout itself declines the slide (for example a slide from a saved template), Layout's own reason is shown instead. A slide whose kind is not known (the catalog has not been read, or does not list the slide) stays as it is today: the button is on and Layout decides when Replace is pressed. The rule is checked again when Replace is pressed.\n# Also on: the Replace picture dialog and its dark overlay are drawn at full strength, in front of the viewer, from the first frame (without it the dialog fades in over 200 ms, and the slide shows through it while it does).\nNEXT_PUBLIC_STUDIO_REPLACE_PICTURE_HERO_ONLY=\"false\"\n"

/** The file with this change's edits put back (the previous text). Used by the strip and the proof. */
export function putBackReplacePictureHeroOnly(rel, text) {
  return (HERO_ONLY_EDITS[rel] || HERO_ONLY_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The file without this change's edits: each [has, was] pair put back; every other byte stays. Any other file is returned as it is. */
export function stripReplacePictureHeroOnly(rel, text) {
  if (typeof text !== 'string') return text
  if (!(rel in HERO_ONLY_EDITS) && !(rel in HERO_ONLY_PIN_EDITS)) return text
  return putBackReplacePictureHeroOnly(rel, text)
}
