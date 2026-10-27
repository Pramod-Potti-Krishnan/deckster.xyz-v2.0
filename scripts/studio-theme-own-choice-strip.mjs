// FRONTEND-2 (B34, PROGRAM-1 GO 27 Oct 17:24Z: "theme-contract version + 'locked' after reload: investigate + fix"; E2E-2 finding F5, session 57f9e99a, deck 1343a54f). Flag NEXT_PUBLIC_STUDIO_THEME_OWN_CHOICE (exact "true", default off, build-time).
// After a reload Studio no longer adopts Director's RESOLVED theme as the user's own lock. Director stores the resolved selection (Auto becomes corporate_light) under a real request id, so the connect-time `restored` theme_sync
// (NEXT_PUBLIC_STUDIO_THEME_RESTORE) was adopted as a pick: "Theme locked: Corporate Light" and the preset in every later send. With the flag on, a tab whose own record says Auto and that still holds Auto keeps Auto, commits the
// theme-sync state applied for it and sends nothing; every other restore is adopted as before. The new rule is lib/studio-theme-own-choice.ts (a NEW file); no new copy, no Director change.
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker THEME-OWN-CHOICE (matched as a whole token): app/builder/page.tsx (two import names, the restore branch, one recording line at each of the two pick
// sites) and lib/studio-theme-restore.ts (one re-export line, so the restore harness, which spreads that module into the page's scope, sees the new names). Strip those lines and each file is its base, byte for byte.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '4520303b3a7b2105844e34dedf616c1e7d1edffd' // origin/studio-v4-dev-preparation-code (#537 merged): dev, which this change branches from.
export const THEME_OWN_CHOICE_FLAG = 'NEXT_PUBLIC_STUDIO_THEME_OWN_CHOICE'
export const THEME_OWN_CHOICE_MARKER = 'THEME-OWN-CHOICE'
/** The marker as a WHOLE token: THEME-OWN-CHOICE-X or X-THEME-OWN-CHOICE are not this change's. */
export const THEME_OWN_CHOICE_MARKER_RE = /(?<![\w-])THEME-OWN-CHOICE(?![\w-])/
/** The subject prefix of this change's own commits. */
export const THEME_OWN_CHOICE_SUBJECT = 'Theme own choice:'

/** Existing files that get marked lines (pure insertions only). */
export const THEME_OWN_CHOICE_FILES = [
  'app/builder/page.tsx',
  'lib/studio-theme-restore.ts',
]

/** New files (no base text to put back). */
export const THEME_OWN_CHOICE_NEW_FILES = [
  'lib/studio-theme-own-choice.ts',
  'scripts/studio-theme-own-choice-strip.mjs',
  'scripts/test-studio-theme-own-choice.mjs',
  'scripts/fixtures/studio-theme-own-choice/baselines/flag-off.json',
  'scripts/fixtures/studio-theme-own-choice/fresh-tab-no-record-unchanged.json',
  'scripts/fixtures/studio-theme-own-choice/reload-auto-stays-auto.json',
  'scripts/fixtures/studio-theme-own-choice/reload-explicit-auto-stays-auto.json',
  'scripts/fixtures/studio-theme-own-choice/reload-other-tab-pick-adopted.json',
  'scripts/fixtures/studio-theme-own-choice/reload-picked-corporate-light-stays-locked.json',
  'scripts/fixtures/studio-theme-own-choice/reload-picked-preset-stays-locked.json',
]

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, whole lines, so putting them back gives the previous file byte for byte. Every line the proof has now carries THEME_OWN_CHOICE_PIN_MARK. */
export const THEME_OWN_CHOICE_PIN_MARK = '// LATER-CHANGES: registry read (THEME-OWN-CHOICE)'
export const THEME_OWN_CHOICE_PIN_EDITS = {
  // #475's identity check counts each of its added page literals in the page read WITHOUT the registry; the recording line this change puts in applyChatThemeSelection sits inside the runner block's literal. The check now reads past later changes' marked lines (the registry is already imported there).
  'scripts/test-studio-chat-theme-export.mjs': [
    ["    const head = stripLaterChanges(rel, stripModelCatalog(rel, stripNarrationRouter(rel, read(rel)))) // #475's block / registration out first (stacked), then #473's (stacked on this change) // LATER-CHANGES: registry read (THEME-OWN-CHOICE), stacked after #475: a later change's marked lines inside the add/theme runner's block (the recording line in applyChatThemeSelection) come out before each of #475's added literals is counted\n",
      "    const head = stripModelCatalog(rel, stripNarrationRouter(rel, read(rel))) // #475's block / registration out first (stacked), then #473's (stacked on this change)\n"],
    ["await check('mutation: the stack-tolerant rules refuse a base line dropped from a shared file, this change\\'s line left after its strip or gone from HEAD, an own file missing and a stray in its family; they take a later PR\\'s line and file (stacked after #475)', async () => { const shared = CHAT_THEME_EXPORT_FILES.filter(rel => rel !== '.env.example').map(rel => ({ rel, head: stripLaterChanges(rel, stripModelCatalog(rel, stripNarrationRouter(rel, read(rel)))), strip: text => stripChatThemeExport(rel, text), base: baseFile(rel), changes: CHAT_THEME_EXPORT_CHANGES[rel] })); const results = stackMutants({ change: STACK[472], changed: git('diff', '--name-only', BASE_COMMIT, 'HEAD', '--', '.').split('\\n').filter(Boolean), known: STACKED_KNOWN, shared, kept: [{ rel: 'scripts/studio-library-manage-harness.mjs', stack: git('show', `${STACK[475].head}:scripts/studio-library-manage-harness.mjs`), head: read('scripts/studio-library-manage-harness.mjs') }] }); for (const [label, held] of results) assert.ok(held, label); console.log(`stack-tolerant (#472): ${results.filter(([label]) => label.includes('mutant:')).length} mutants caught, ${results.filter(([label]) => label.includes('control:')).length} controls taken`) }) // stacked after #475, scripts/studio-stack-tolerant.mjs // LATER-CHANGES: registry read (THEME-OWN-CHOICE), stacked after #475: the same read as the identity check above (a later change's marked lines come out first)\n",
      "await check('mutation: the stack-tolerant rules refuse a base line dropped from a shared file, this change\\'s line left after its strip or gone from HEAD, an own file missing and a stray in its family; they take a later PR\\'s line and file (stacked after #475)', async () => { const shared = CHAT_THEME_EXPORT_FILES.filter(rel => rel !== '.env.example').map(rel => ({ rel, head: stripModelCatalog(rel, stripNarrationRouter(rel, read(rel))), strip: text => stripChatThemeExport(rel, text), base: baseFile(rel), changes: CHAT_THEME_EXPORT_CHANGES[rel] })); const results = stackMutants({ change: STACK[472], changed: git('diff', '--name-only', BASE_COMMIT, 'HEAD', '--', '.').split('\\n').filter(Boolean), known: STACKED_KNOWN, shared, kept: [{ rel: 'scripts/studio-library-manage-harness.mjs', stack: git('show', `${STACK[475].head}:scripts/studio-library-manage-harness.mjs`), head: read('scripts/studio-library-manage-harness.mjs') }] }); for (const [label, held] of results) assert.ok(held, label); console.log(`stack-tolerant (#472): ${results.filter(([label]) => label.includes('mutant:')).length} mutants caught, ${results.filter(([label]) => label.includes('control:')).length} controls taken`) }) // stacked after #475, scripts/studio-stack-tolerant.mjs\n"],
  ],
}

/** The proof without this change's edits (the previous file). Used by the strip and the proof. */
export function putBackPin(rel, text) {
  return (THEME_OWN_CHOICE_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The older proofs this change teaches. */
export const THEME_OWN_CHOICE_PIN_FILES = Object.keys(THEME_OWN_CHOICE_PIN_EDITS)

export const THEME_OWN_CHOICE_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...THEME_OWN_CHOICE_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const THEME_OWN_CHOICE_SCOPE_FILES = new Set([...THEME_OWN_CHOICE_FILES, ...THEME_OWN_CHOICE_NEW_FILES, ...THEME_OWN_CHOICE_OWN_EDITS])

/** The whole .env.example block: its comment and its line. */
export const THEME_OWN_CHOICE_ENV_BLOCK = `# STUDIO THEME OWN CHOICE (FRONTEND-2; PROGRAM-1 GO 27 Oct). On for the exact value "true"; default off, and then the Builder is exactly as before. Build-time value: change it on Vercel and redeploy. Pairs with NEXT_PUBLIC_STUDIO_THEME_RESTORE (it only matters
# with that flag on): Director stores the RESOLVED theme (Auto becomes corporate_light) under a real request id, so after a reload the restored theme was adopted as the user's own pick ("Theme locked: Corporate Light", and the preset in every later send).
# On: a tab that has seen this session with no pick (its own record says Auto) and still holds Auto keeps Auto after a reload: no theme chip, nothing sent. A theme the user picked (the picker, or a chat theme change) stays that theme and stays locked, and any
# restored theme other than Director's default is adopted as before. A tab with no record of the session (a closed and reopened tab, a session from before this flag) behaves as before. No new text, no Director change.
NEXT_PUBLIC_STUDIO_THEME_OWN_CHOICE="false"
`

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripThemeOwnChoice(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in THEME_OWN_CHOICE_PIN_EDITS) return putBackPin(rel, text) // an older proof this change taught: its previous text
  if (!THEME_OWN_CHOICE_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !THEME_OWN_CHOICE_MARKER_RE.test(line)).join('\n')
}
