// FRONTEND-1 (Brand Kit, the Studio caller half; spec streams/pass5/BRAND-KIT-CALLER.md, items BK-C1..BK-C19, with BK-Q1..Q12 at their proposed defaults): ONE flag-off Draft on the Studio dev branch (studio-v4-dev-preparation-code, 6872a813).
// Flag NEXT_PUBLIC_STUDIO_BRAND_KIT: the exact string "true", default off. Off, the two new routes answer 404 before anything is read, no Brand Kit UI is mounted, no request is made, and the eight existing theme proxy fetches are what they were.
//   - POST /api/brand/extract (new): signed in, approved, the file checked (PNG or JPEG, 4 MiB, magic bytes), a per-person daily cap, ONE paid call to Theme Builder with the server-only key, Theme Builder's answer cleaned and passed on with no-store;
//   - GET and PUT /api/themes/[id]/brand (new): Director's brand record, signed with the existing entitlement helper, the PUT body checked (Director's six keys only, https logo link, the limits, the eight catalog fonts), an empty record refused unless ?clear=1;
//   - the four existing theme proxy files (eight fetches) sign with the same helper, only with the Brand Kit flag on (and the helper's own entitlement flag and secret);
//   - the Themes page (components/studio-libraries/themes-workspace.tsx, brand-kit-panel.tsx): extract (after consent, one click) -> proposal in its own state (originals, derived roles, every warning, every failing contrast row, fonts) -> "Use these colours" (the only write to the draft) ->
//     the kit form (logo link, footer, confidentiality) and a sample slide -> Save: the page's own save creates the theme, then ONE PUT of the brand record; a failed PUT leaves the theme saved with a retry that repeats only the PUT; the saved theme's details are read for the selected row;
//   - a new deck (lib/deck-identity.ts resolveDeckIdentityForm, hooks/use-deck-identity.ts): the STANDARD theme's kit REPLACES the browser copy for logo / confidentiality / company (footer), source stays "form"; read once, fail soft.
// NOT built (needs PK, BK-B5): a logo host (no bucket, no upload route). lib/studio-brand-kit.ts has the typed seam (BrandLogoHost, BRAND_LOGO_HOST = null, a TODO); the UI takes only a logo link the person already has, and the image picked for suggestions is not kept.
// Every line this change adds to an EXISTING file carries the marker BRAND-KIT-CALLER (matched as a whole token). Most are insertions ([has, was] with was = ''); the REWRITTEN lines (a theme proxy's init, the save button's guard, two lines of the identity hook) put the base's line back.
// Putting each pair back gives the file at BASE_COMMIT byte for byte. The new files (libs, a hook, routes, a component, a stylesheet, this strip, a proof) have no base text.
// Older proofs this change teaches (tests only, every line carries the registry-read mark): the two that read the first-parent commits of BASE..HEAD for their own commits' subjects get one more inserted line each, "Brand kit caller:", right after the shell's;
// the Deck import proof, whose "the minter is imported by the two import routes only" walk gets two more inserted lines (the Brand Kit's server lib and its brand record route, which sign with the same helper and are proved by this change's own proof), right after the compose lib's line;
// and eight Themes-page proofs (font selection, base dropdown, preview canon, the two Atlas Themes proofs, draft ownership, library manage, support access) that held the Themes page or its proxy to a base byte for byte without reading the registry: each now reads that file through stripLaterChanges.
// How the older pins reach it: it REGISTERS its files, its .env.example block and its strip (scripts/studio-later-changes.mjs, three lines). The voice-call proof's .env.example pin (21d254c6) already reads the blocks registered after its own, so no edit of it is carried.
// Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '6872a8139f67e7c032f39ec064d0fdfed4e7b616' // origin/studio-v4-dev-preparation-code (#607 merged), the trunk this change sits on
export const BRAND_KIT_FLAGS = ['NEXT_PUBLIC_STUDIO_BRAND_KIT']
export const BRAND_KIT_MARKER = 'BRAND-KIT-CALLER'
/** The marker as a WHOLE token: BRAND-KIT-CALLER is this change's; BRAND-KIT-CALLER-X and X-BRAND-KIT-CALLER are not. */
export const BRAND_KIT_MARKER_RE = /(?<![\w-])BRAND-KIT-CALLER(?![\w-])/
/** The subject prefix of this change's own commits. */
export const BRAND_KIT_SUBJECT = 'Brand kit caller:'

export const THEME_PROXY_FILES = ['app/api/themes/route.ts', 'app/api/themes/[id]/route.ts', 'app/api/themes/[id]/standard/route.ts', 'app/api/themes/standard/route.ts']
export const THEMES_WORKSPACE = 'components/studio-libraries/themes-workspace.tsx'
export const DECK_IDENTITY_LIB = 'lib/deck-identity.ts'
export const DECK_IDENTITY_HOOK = 'hooks/use-deck-identity.ts'
/** Existing app files that get marked lines. */
export const BRAND_KIT_APP_FILES = [...THEME_PROXY_FILES, THEMES_WORKSPACE, DECK_IDENTITY_LIB, DECK_IDENTITY_HOOK]
/** New files (no base text to put back). */
export const BRAND_KIT_NEW_FILES = [
  'lib/studio-brand-kit.ts', 'lib/studio-brand-kit-state.ts', 'lib/studio-brand-kit-server.ts', 'lib/studio-brand-kit-cap.ts',
  'hooks/use-brand-kit.ts',
  'app/api/brand/extract/route.ts', 'app/api/themes/[id]/brand/route.ts',
  'components/studio-libraries/brand-kit-panel.tsx', 'components/studio-libraries/brand-kit.css',
  'scripts/studio-brand-kit-strip.mjs', 'scripts/test-studio-brand-kit.mjs',
]

/** The exact text of this change's .env.example block (the registry takes it out, with the blank line that separates it, for the older pins). */
export const BRAND_KIT_ENV_BLOCK = `# STUDIO BRAND KIT CALLER (FRONTEND-1; Brand Kit, the Studio half; spec streams/pass5/BRAND-KIT-CALLER.md). NEXT_PUBLIC_STUDIO_BRAND_KIT: the exact value "true" turns on the Brand Kit on the Themes page (colour suggestions from a logo, a kit form with a sample slide,
# the kit saved to the theme, and the signed Director calls it needs); anything else, including unset, is off, and then nothing changes: the two new routes answer 404 before anything is read, nothing is drawn, no request is made, and the eight existing theme proxy
# fetches are what they were. Build-time value: change it on Vercel and redeploy. It does not host logo files (no logo host exists yet): the kit takes a logo link the person already has, https only.
# On the server it needs THEME_BUILDER_BRAND_EXTRACT_KEY (SERVER-ONLY, never a NEXT_PUBLIC_ name, never logged or sent to the browser; the same value as Theme Builder's TB_BRAND_EXTRACT_API_KEY). Check before turning the flag on that the Theme Builder address and the Director
# address this project uses are the UAT hosts, not the production ones listed in this file: the extract call and the brand writes go where those point.
# Saving the kit also needs the entitlement header on (DECKSTER_REST_ENTITLEMENT_HEADER_ENABLED "true" with the Director auth secret set): Director's brand routes refuse an unsigned call. With the Brand Kit flag on, the existing theme calls are signed the same way.
# STUDIO_BRAND_EXTRACT_DAILY_CAP: the most colour suggestions one person gets per UTC day (each is one paid vision call); a whole number from 1 to 100, default 10 when unset.
# A new deck takes the STANDARD theme's kit only with NEXT_PUBLIC_DECK_IDENTITY_ENABLED on; the logo and footer are drawn only with Slide Builder's DECK_FOOTER_CONSTANT_ENABLED and Layout's LAYOUT_LOGO_SLOT_ENABLED.
NEXT_PUBLIC_STUDIO_BRAND_KIT="false"
THEME_BUILDER_BRAND_EXTRACT_KEY=
STUDIO_BRAND_EXTRACT_DAILY_CAP=
`

/** [text the file has now, text the file had at BASE_COMMIT] per edit, whole lines (with their newline), in the order they sit in the file; was = '' for an inserted line. Putting them back gives the base file byte for byte. */
export const BRAND_KIT_EDITS = {
  "app/api/themes/route.ts": [
    ["import { brandKitSignedHeaders, brandKitSignedInit } from '@/lib/studio-brand-kit-server' // BRAND-KIT-CALLER (NEXT_PUBLIC_STUDIO_BRAND_KIT): signs the Director call when the flag AND the entitlement flag are on; off, nothing is added\n", ""],
    ["      { cache: 'no-store', ...brandKitSignedInit(userId, 'GET') }, // BRAND-KIT-CALLER\n", "      { cache: 'no-store' },\n"],
    ["        headers: { 'Content-Type': 'application/json', ...brandKitSignedHeaders(userId, 'POST') }, // BRAND-KIT-CALLER\n", "        headers: { 'Content-Type': 'application/json' },\n"],
  ],
  "app/api/themes/[id]/route.ts": [
    ["import { brandKitSignedHeaders, brandKitSignedInit } from '@/lib/studio-brand-kit-server' // BRAND-KIT-CALLER (NEXT_PUBLIC_STUDIO_BRAND_KIT): signs the Director call when the flag AND the entitlement flag are on; off, nothing is added\n", ""],
    ["      { cache: 'no-store', ...brandKitSignedInit(userId, 'GET') }, // BRAND-KIT-CALLER\n", "      { cache: 'no-store' },\n"],
    ["        headers: { 'Content-Type': 'application/json', ...brandKitSignedHeaders(userId, 'PATCH') }, // BRAND-KIT-CALLER\n", "        headers: { 'Content-Type': 'application/json' },\n"],
    ["      { method: 'DELETE', ...brandKitSignedInit(userId, 'DELETE') }, // BRAND-KIT-CALLER\n", "      { method: 'DELETE' },\n"],
  ],
  "app/api/themes/[id]/standard/route.ts": [
    ["import { brandKitSignedHeaders, brandKitSignedInit } from '@/lib/studio-brand-kit-server' // BRAND-KIT-CALLER (NEXT_PUBLIC_STUDIO_BRAND_KIT): signs the Director call when the flag AND the entitlement flag are on; off, nothing is added\n", ""],
    ["      { method: 'PUT', ...brandKitSignedInit(userId, 'PUT') }, // BRAND-KIT-CALLER\n", "      { method: 'PUT' },\n"],
  ],
  "app/api/themes/standard/route.ts": [
    ["import { brandKitSignedHeaders, brandKitSignedInit } from '@/lib/studio-brand-kit-server' // BRAND-KIT-CALLER (NEXT_PUBLIC_STUDIO_BRAND_KIT): signs the Director call when the flag AND the entitlement flag are on; off, nothing is added\n", ""],
    ["      { cache: 'no-store', ...brandKitSignedInit(userId, 'GET') }, // BRAND-KIT-CALLER\n", "      { cache: 'no-store' },\n"],
    ["      { method: 'DELETE', ...brandKitSignedInit(userId, 'DELETE') }, // BRAND-KIT-CALLER\n", "      { method: 'DELETE' },\n"],
  ],
  "components/studio-libraries/themes-workspace.tsx": [
    ["import { BRAND_KIT_ENABLED, BrandKitSavedDetails, BrandKitSection, BrandKitStatus, useBrandKitDraft } from './brand-kit-panel' // BRAND-KIT-CALLER (NEXT_PUBLIC_STUDIO_BRAND_KIT, exact \"true\", default off): the Brand Kit on this page\n", ""],
    ["  const brandKit = useBrandKitDraft(BRAND_KIT_ENABLED) // BRAND-KIT-CALLER: the kit's own state (the proposal, the form, the save status); with the flag off it holds an empty reducer and never starts a request\n", ""],
    ["  const canSave = Boolean(name.trim() && draft.mode !== 'auto' && !invalidColors && !duplicateName && !operation && !brandKit.blocksSave) // BRAND-KIT-CALLER: a brand detail that cannot be saved (an http logo link, a footer over 200 characters) keeps Save off, so no theme is created without its kit\n", "  const canSave = Boolean(name.trim() && draft.mode !== 'auto' && !invalidColors && !duplicateName && !operation)\n"],
    ["    if (brandKit.enabled) brandKit.reset() // BRAND-KIT-CALLER: a new draft starts with an empty kit (a theme saved without its brand details keeps its retry)\n", ""],
    ["      if (brandKit.enabled) await brandKit.saveAfterTheme({ id: result.id, name: result.name, theme_payload: result.theme_payload }) // BRAND-KIT-CALLER: the theme row exists, so now the brand record is PUT once (nothing when the kit form is empty); a failure leaves the theme saved and a retry that repeats only the PUT\n", ""],
    ["    {brandKit.enabled && <BrandKitStatus kit={brandKit} standardId={standard?.id} selectedId={selectedId} busy={!accountReady || Boolean(operation)} onSetStandard={() => void changeStandard()} />}{/* BRAND-KIT-CALLER: the brand save's status, its retry and where it applies */}\n", ""],
    ["            {brandKit.enabled && <BrandKitSection kit={brandKit} draft={draft} name={name} patchDraft={patchDraft} locked={Boolean(operation)} />}{/* BRAND-KIT-CALLER: colour suggestions from a logo, the kit form and a sample slide */}\n", ""],
    ["          {brandKit.enabled && mode === 'library' && selected && <BrandKitSavedDetails key={selected.id} themeId={selected.id} isStandard={Boolean(selected.is_standard)} />}{/* BRAND-KIT-CALLER: the selected theme's saved brand details (one read, never one per row) */}\n", ""],
  ],
  "lib/deck-identity.ts": [
    ["// BRAND-KIT-CALLER (NEXT_PUBLIC_STUDIO_BRAND_KIT, BK-C17/C18): the brand kit of the STANDARD saved theme as a deck's identity form. Pure. No kit, or a kit with none of the three identity fields (a fonts-only kit), gives the browser form back as it is\n", ""],
    ["// BRAND-KIT-CALLER (the same object, so flag-off and kit-absent output is byte-identical to today). Otherwise the kit REPLACES the browser copy for all three fields (BK-Q2, whole record: a field the kit left empty stays empty, an old browser value never comes back):\n", ""],
    ["// BRAND-KIT-CALLER kit.logo_url to logoUrl, kit.confidentiality to confidentiality, kit.footer to company (the only free-text slot: DeckIdentity has no footer field and Director composes the footer from identity). `source` stays what buildDeckIdentity says (\"form\").\n", ""],
    ["export interface BrandKitIdentityInput { logo_url?: string | null; footer?: string | null; confidentiality?: string | null } // BRAND-KIT-CALLER\n", ""],
    ["export function resolveDeckIdentityForm(kit: BrandKitIdentityInput | null | undefined, form: DeckIdentityForm): DeckIdentityForm { // BRAND-KIT-CALLER\n", ""],
    ["  const logoUrl = cleanLogoUrl(kit?.logo_url), company = cleanIdentityValue(kit?.footer), confidentiality = cleanIdentityValue(kit?.confidentiality); // BRAND-KIT-CALLER\n", ""],
    ["  if (!logoUrl && !company && !confidentiality) return form; // BRAND-KIT-CALLER\n", ""],
    ["  return { ...(company ? { company } : {}), ...(confidentiality ? { confidentiality } : {}), ...(logoUrl ? { logoUrl } : {}) }; // BRAND-KIT-CALLER\n", ""],
    ["} // BRAND-KIT-CALLER\n", ""],
  ],
  "hooks/use-deck-identity.ts": [
    ["import { resolveDeckIdentityForm } from '@/lib/deck-identity' // BRAND-KIT-CALLER\n", ""],
    ["import { useStandardBrandKit } from '@/hooks/use-brand-kit' // BRAND-KIT-CALLER\n", ""],
    ["import { isStudioBrandKitEnabled } from '@/lib/studio-brand-kit' // BRAND-KIT-CALLER\n", ""],
    ["  const brandKit = useStandardBrandKit(enabled && isStudioBrandKitEnabled()) // BRAND-KIT-CALLER (NEXT_PUBLIC_STUDIO_BRAND_KIT): the STANDARD theme's brand record, read once and fail soft; null with the flag off (nothing is fetched) and on any error\n", ""],
    ["    return buildDeckIdentity({ sessionName, form: resolveDeckIdentityForm(brandKit, form), now: new Date() }) // BRAND-KIT-CALLER\n", "    return buildDeckIdentity({ sessionName, form, now: new Date() })\n"],
    ["  }, [enabled, sessionName, form, brandKit]) // BRAND-KIT-CALLER\n", "  }, [enabled, sessionName, form])\n"],
  ],
}

/** The older proofs this change teaches: [text the proof has now, text it had before] per edit (was = '' for an inserted line). Every line a taught proof has now carries BRAND_KIT_PIN_MARK. */
export const BRAND_KIT_PIN_MARK = '// LATER-CHANGES: registry read (BRAND-KIT-CALLER)'
const PIN_LINE = "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Brand kit caller:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (BRAND-KIT-CALLER): on a branch stacked after this change (the Brand Kit caller), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n"
const MINTER_LINES = [
  "  text.delete('lib/studio-brand-kit-server.ts') // LATER-CHANGES: registry read (BRAND-KIT-CALLER): the Brand Kit's server-only lib (it signs the eight theme proxy fetches) also reaches the minter; scripts/test-studio-brand-kit.mjs proves it, and the closure walk above already ran over it\n",
  "  text.delete('app/api/themes/[id]/brand/route.ts') // LATER-CHANGES: registry read (BRAND-KIT-CALLER): the Brand Kit's brand record route signs its Director calls with the same helper (proved by scripts/test-studio-brand-kit.mjs)\n",
]
// the eight Themes-page proofs that held the Themes page / the theme proxies to a base without reading the registry: each now reads the file through stripLaterChanges (innermost, as the registry's own header says), so this change's marked lines come out first
const MARK = 'LATER-CHANGES: registry read (BRAND-KIT-CALLER)'
const REG_IMPORT = `import { stripLaterChanges } from './studio-later-changes.mjs' // ${MARK}\n`
const LM_NOW = `import { stripLibraryManage as stripLibraryManageBase } from './studio-library-manage-strip.mjs' // ${MARK}\n`
const LM_WAS = "import { stripLibraryManage } from './studio-library-manage-strip.mjs'\n"
const LM_WRAP = `const stripLibraryManage = (rel, text) => stripLibraryManageBase(rel, stripLaterChanges(rel, text)) // ${MARK}: a later change's marked lines (the Brand Kit's, in the Themes page) come out first\n`
const LM_PAIRS = [[LM_NOW, LM_WAS], [REG_IMPORT, ''], [LM_WRAP, '']]
const CT_NOW = `const currentText=stripLaunchWording(file,stripLaterChanges(file,fs.readFileSync(new URL(file,root),'utf8'))) // ${MARK}: a later change's marked lines come out first\n`
const CT_WAS = "const currentText=stripLaunchWording(file,fs.readFileSync(new URL(file,root),'utf8'))\n"
const RM_NOW = `const readMutable = makeReader(MUTATIONS, 'THEME_MANAGE_TEST_MUTATION') // ${MARK}\n`
const RM_WAS = "const read = makeReader(MUTATIONS, 'THEME_MANAGE_TEST_MUTATION')\n"
const RM_WRAP = `const read = rel => stripLaterChanges(rel, readMutable(rel)) // ${MARK}: a later change's marked lines (the Brand Kit's, in the Themes page and the theme proxies) come out first\n`
export const BRAND_KIT_PIN_EDITS = {
  // two older proofs walk the first-parent line of BASE..HEAD without merges and require every subject on it to be their own: this change's commits (subject "Brand kit caller:") are left out of that line, like every later change's
  'scripts/test-studio-chat-element-edit.mjs': [[PIN_LINE, '']],
  'scripts/test-studio-deck-sync-truth.mjs': [[PIN_LINE, '']],
  // the Deck import proof lists the files that import the entitlement minter (its two routes, and the compose lib it deletes from the list); the Brand Kit's two files that sign are taken out the same way
  'scripts/test-studio-deck-import.mjs': MINTER_LINES.map(line => [line, '']),
  'scripts/test-theme-font-selection.mjs': LM_PAIRS,
  'scripts/test-studio-theme-base-dropdown.mjs': LM_PAIRS,
  'scripts/test-studio-theme-preview-canon.mjs': LM_PAIRS,
  'scripts/test-atlas-themes-recovery.mjs': LM_PAIRS,
  'scripts/test-atlas-themes-account-boundary.mjs': LM_PAIRS,
  'scripts/test-studio-theme-support-access.mjs': LM_PAIRS,
  'scripts/test-studio-theme-draft-ownership.mjs': [[REG_IMPORT, ''], [CT_NOW, CT_WAS]],
  'scripts/test-studio-theme-library-manage.mjs': [[REG_IMPORT, ''], [RM_NOW, RM_WAS], [RM_WRAP, '']],
}
/** Where the taught lines go: right after the line that starts with this text, per proof. */
export const BRAND_KIT_PIN_ANCHORS = {
  'scripts/test-studio-chat-element-edit.mjs': "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Agent mode shell:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (AGENT-MODE-SHELL)",
  'scripts/test-studio-deck-sync-truth.mjs': "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Agent mode shell:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (AGENT-MODE-SHELL)",
  'scripts/test-studio-deck-import.mjs': "  text.delete('lib/studio-compose-entitlement.ts')",
}
export const BRAND_KIT_PIN_FILES = Object.keys(BRAND_KIT_PIN_EDITS)

/** Every [has, was] pair this change makes to an existing file, by file: the app files and the two taught proofs. */
export const BRAND_KIT_ALL_EDITS = { ...BRAND_KIT_EDITS, ...BRAND_KIT_PIN_EDITS }

/** Files this change edits that are not app code: .env.example (its block), the registry (three lines) and the older proofs it teaches. */
export const BRAND_KIT_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...BRAND_KIT_PIN_FILES]
/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const BRAND_KIT_SCOPE_FILES = new Set([...BRAND_KIT_APP_FILES, ...BRAND_KIT_NEW_FILES, ...BRAND_KIT_OWN_EDITS])

/** `text` with one whole line put back: `has` is the line with its newline, and it counts only at the start of a line (never the tail of a longer one). Only the first occurrence goes: a line that is there twice is a merge mistake the older pins must still see. */
function putBackLine(text, has, was) {
  let at = text.indexOf(has)
  while (at !== -1 && !(at === 0 || text[at - 1] === '\n')) at = text.indexOf(has, at + 1)
  return at === -1 ? text : text.slice(0, at) + was + text.slice(at + has.length)
}

/** The file with this change's edits put back (the previous text). Idempotent: a file that has none of the lines comes back as it is. */
export function putBackBrandKit(rel, text) {
  return (Object.prototype.hasOwnProperty.call(BRAND_KIT_ALL_EDITS, rel) ? BRAND_KIT_ALL_EDITS[rel] : []).reduce((out, [has, was]) => putBackLine(out, has, was), text)
}

/** The file without this change's edits: each [has, was] pair put back; every other byte stays. Any other file (and .env.example, which the registry's env block list takes care of) is returned as it is. */
export function stripBrandKit(rel, text) {
  if (typeof text !== 'string') return text
  if (!Object.prototype.hasOwnProperty.call(BRAND_KIT_ALL_EDITS, rel)) return text
  return putBackBrandKit(rel, text)
}
