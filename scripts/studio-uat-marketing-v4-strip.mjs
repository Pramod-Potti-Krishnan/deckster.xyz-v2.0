// FRONTEND-1 (OPS-2's condition on the S39 gate of Studio PR #637, 16 Nov): uat's own marketing-v4 site, registered as a later change so the COMMITTED-DIFF scope proofs pass on uat.
// WHY. Studio PR #637 promoted dev d584d16a into uat 6a74ede5 (merge d1a2efb9). uat carried 38 commits dev did not have, all the marketing-v4 site (41 files: app/(marketing-v3)/*, components/marketing/v4/*,
// public/marketing/v4/*, lib/marketing-v4.ts, styles/marketing-v4.css). On uat, several proofs read the committed diff from their own base to HEAD, and that diff now also holds those 41 files, which no change
// registered: test-studio-agent-mode-wire (check G), test-studio-brand-kit (J4) and test-studio-later-changes (scope) failed on the S39 gate for that reason only (each passes alone on dev d584d16a).
// WHAT. The 41 paths, read from `git diff --name-only <merge-base> <uat>` with merge-base eeb78d4f (of uat 6a74ede5 and dev d584d16a), and this change's own three files. Registered by one LATER_CHANGE_FILES line
// in scripts/studio-later-changes.mjs. On dev none of the 41 is in any committed diff, so the line changes nothing there. No app file, no flag, no .env.example block, no strip (no older pin holds any of the 41).
// Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = 'd584d16ad40c9f45fd557b1c4b0d8147740cc185' // studio-v4-dev-preparation-code after #636, the branch this change is cut from
/** The uat commit the 41 paths were read from, and the merge-base with dev they were read against. */
export const UAT_COMMIT = '6a74ede56a8047f4ca78f5c3cb202b864464146c'
export const UAT_MERGE_BASE = 'eeb78d4f4b7676d75c244746f1edc7da1d269478'
export const UAT_MARKETING_V4_COMMIT_SUBJECT = /^uat marketing-v4 registry:/

/** uat's own files (merge-base..uat), all the marketing-v4 site. */
export const UAT_MARKETING_V4_FILES = [
  'app/(marketing-v3)/about/page.tsx',
  'app/(marketing-v3)/bring/page.tsx',
  'app/(marketing-v3)/build/page.tsx',
  'app/(marketing-v3)/experts/page.tsx',
  'app/(marketing-v3)/layout.tsx',
  'app/(marketing-v3)/learn/page.tsx',
  'app/(marketing-v3)/page.tsx',
  'app/(marketing-v3)/present/page.tsx',
  'app/(marketing-v3)/pricing/page.tsx',
  'components/marketing/v4/V4Runtime.tsx',
  'components/marketing/v4/content.ts',
  'components/marketing/v4/pages/about.tsx',
  'components/marketing/v4/pages/bring.tsx',
  'components/marketing/v4/pages/build.tsx',
  'components/marketing/v4/pages/experts.tsx',
  'components/marketing/v4/pages/home.tsx',
  'components/marketing/v4/pages/learn.tsx',
  'components/marketing/v4/pages/present.tsx',
  'components/marketing/v4/pages/pricing.tsx',
  'components/marketing/v4/shell.tsx',
  'lib/marketing-v4.ts',
  'public/marketing/v4/cast/arjun.webp',
  'public/marketing/v4/cast/clover.webp',
  'public/marketing/v4/cast/gabe-talking.webm',
  'public/marketing/v4/cast/gabe.webp',
  'public/marketing/v4/cast/lucia-pointing.webm',
  'public/marketing/v4/cast/lucia-talking.webm',
  'public/marketing/v4/cast/lucia.webp',
  'public/marketing/v4/cast/noor.webp',
  'public/marketing/v4/cast/ollie-pointing.webm',
  'public/marketing/v4/cast/ollie.webp',
  'public/marketing/v4/cast/tao-talking.webm',
  'public/marketing/v4/cast/tao.webp',
  'public/marketing/v4/cast/vera.webp',
  'public/marketing/v4/cast/ziggy.webp',
  'public/marketing/v4/decks/a2-01.jpg',
  'public/marketing/v4/decks/a2-04.jpg',
  'public/marketing/v4/decks/a2-05-raw.jpg',
  'public/marketing/v4/decks/a2-05.jpg',
  'public/marketing/v4/decks/a2-06.jpg',
  'styles/marketing-v4.css',
]

/** This change's own files. */
export const UAT_MARKETING_V4_OWN_FILES = ['scripts/studio-uat-marketing-v4-strip.mjs', 'scripts/test-studio-uat-marketing-v4-registry.mjs', 'scripts/studio-later-changes.mjs']

/** What the older scope checks skip once the registry names it. */
export const UAT_MARKETING_V4_SCOPE_FILES = new Set([...UAT_MARKETING_V4_FILES, ...UAT_MARKETING_V4_OWN_FILES])
