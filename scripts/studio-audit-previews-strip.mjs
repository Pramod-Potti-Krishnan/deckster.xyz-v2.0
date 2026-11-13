// FRONTEND-1 (production frontend audit, P-01 deck-card previews, P-07 Duplicate, P-29 slide rail and Publish preview). Flags NEXT_PUBLIC_STUDIO_DECK_CARD_REHOME and NEXT_PUBLIC_STUDIO_INVENTORY_FALLBACK (exact "true", default off, build-time).
// P-01 (deck-card previews) and P-07 (Duplicate): a deck whose saved viewer URL belongs to another environment's Layout is "unavailable" on the Decks page even when this Layout has the deck (lib/studio-deck-card-rehome.ts has the root cause and the fix).
// P-29 (slide rail and Publish preview): Layout's slide inventory answers 405 on production, so the rail has no slide list of its own and the Publish preview no image (lib/studio-inventory-fallback.ts has the root cause, what the presentation GET can
// and cannot give, and the fix).
// Every line this change adds to an EXISTING file carries the marker AUDIT-PREVIEWS (matched as a whole token). Some base lines are rewritten, so the strip is a list of [has, was] pairs, not a marker filter: putting each pair back gives the file at BASE_COMMIT
// byte for byte (a pair is one hunk of the committed diff: the lines the file has now, the lines it had). The new files have no base text.
// The four-line edit of FRONTEND-1's test-studio-voice-call.mjs (the .env.example "last thing in the file" pin reads the blocks registered after voice-call's) that this change used to carry, byte-identical to #603's, is in dev since 506bcbb3: no edit of that proof is carried here.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '796d84420e0f1b233c91365e3053adc71441eb90' // origin/studio-v4-dev-preparation-code (#624 merged), the trunk this change sits on (restacked from eeb78d4f, #598 merged)
export const AUDIT_PREVIEWS_FLAGS = ["NEXT_PUBLIC_STUDIO_DECK_CARD_REHOME","NEXT_PUBLIC_STUDIO_INVENTORY_FALLBACK"]
export const AUDIT_PREVIEWS_MARKER = 'AUDIT-PREVIEWS'
/** The marker as a WHOLE token: AUDIT-PREVIEWS-X and X-AUDIT-PREVIEWS are not this change's. */
export const AUDIT_PREVIEWS_MARKER_RE = /(?<![\w-])AUDIT-PREVIEWS(?![\w-])/
/** The subject prefix of this change's own commits. */
export const AUDIT_PREVIEWS_SUBJECT = 'Audit fix:'

/** Existing files that get marked lines. */
export const AUDIT_PREVIEWS_FILES = ["app/(app)/dashboard/page.tsx","components/studio-publish-preview.tsx","hooks/use-slide-rail-identity.ts","lib/slide-rail-identity.ts"]

/** New files (no base text to put back). */
export const AUDIT_PREVIEWS_NEW_FILES = [
  "lib/studio-deck-card-rehome.ts",
  "lib/studio-inventory-fallback.ts",
  "hooks/use-studio-deck-card-rehome.ts",
  "hooks/use-studio-publish-preview-frame.ts",
  "components/studio-publish-preview-frame.tsx",
  "scripts/studio-audit-previews-strip.mjs",
  "scripts/test-studio-audit-previews.mjs"
]

/** The new libs that read a flag: [file, flag], each import-free with one literal env read. */
export const AUDIT_PREVIEWS_LIB_FLAGS = [["lib/studio-deck-card-rehome.ts","NEXT_PUBLIC_STUDIO_DECK_CARD_REHOME"],["lib/studio-inventory-fallback.ts","NEXT_PUBLIC_STUDIO_INVENTORY_FALLBACK"]]

/** [text the file has now, text the file had at BASE_COMMIT] per edit (one per hunk), in the order they sit in the file; putting them back gives the base file byte for byte. */
export const AUDIT_PREVIEWS_EDITS = {
  "app/(app)/dashboard/page.tsx": [
    ["import { useStudioDeckCardRehome, useStudioDeckRehomeVersion, studioDeckRehomeDecision } from \"@/hooks/use-studio-deck-card-rehome\" // AUDIT-PREVIEWS (NEXT_PUBLIC_STUDIO_DECK_CARD_REHOME, default off): a card whose saved viewer URL is another environment's uses this one when the deck exists here\n", ""],
    ["  const savedDecision = evaluateLayoutViewerUrl(candidate, LAYOUT_VIEWER_URL_POLICY) // AUDIT-PREVIEWS\n  const rehome = useStudioDeckCardRehome(candidate, savedDecision) // AUDIT-PREVIEWS: flag off = nothing asked, url null\n  const decision = rehome.url ? evaluateLayoutViewerUrl(rehome.url, LAYOUT_VIEWER_URL_POLICY) : savedDecision // AUDIT-PREVIEWS\n", "  const decision = evaluateLayoutViewerUrl(candidate, LAYOUT_VIEWER_URL_POLICY)\n"],
    ["    <div ref={rehome.boxRef} className=\"relative h-full w-full\">{/* AUDIT-PREVIEWS */}\n", "    <div className=\"relative h-full w-full\">\n"],
    ["      {decision.status === 'blocked' && !rehome.pending && ( // AUDIT-PREVIEWS\n", "      {decision.status === 'blocked' && (\n"],
    ["  useStudioDeckRehomeVersion() // AUDIT-PREVIEWS: the Duplicate items re-read their decision when a card's read settles (flag off: never subscribes)\n", ""],
    ["    const target = duplicateTargetFor(presentation, url => studioDeckRehomeDecision(url, saved => evaluateLayoutViewerUrl(saved, LAYOUT_VIEWER_URL_POLICY))) // AUDIT-PREVIEWS\n", "    const target = duplicateTargetFor(presentation, url => evaluateLayoutViewerUrl(url, LAYOUT_VIEWER_URL_POLICY))\n"],
    ["    const target = duplicateTargetFor(presentation, url => studioDeckRehomeDecision(url, saved => evaluateLayoutViewerUrl(saved, LAYOUT_VIEWER_URL_POLICY))) // AUDIT-PREVIEWS\n", "    const target = duplicateTargetFor(presentation, url => evaluateLayoutViewerUrl(url, LAYOUT_VIEWER_URL_POLICY))\n"],
  ],
  "components/studio-publish-preview.tsx": [
    ["import { useStudioPublishPreviewFrame } from '@/hooks/use-studio-publish-preview-frame' // AUDIT-PREVIEWS (NEXT_PUBLIC_STUDIO_INVENTORY_FALLBACK, default off)\nimport { PublishPreviewFrame } from '@/components/studio-publish-preview-frame' // AUDIT-PREVIEWS\n", ""],
    ["  const frame = useStudioPublishPreviewFrame(sessionId, source, preview) // AUDIT-PREVIEWS: no image from any source and this Layout has the deck: slide 1 in a view-only frame; flag off = null\n", ""],
    ["      ) : frame ? ( // AUDIT-PREVIEWS\n        <PublishPreviewFrame src={frame.src} /> // AUDIT-PREVIEWS\n", ""],
  ],
  "hooks/use-slide-rail-identity.ts": [
    ["import { STUDIO_INVENTORY_FALLBACK_ENABLED, readInventoryFallback } from '@/lib/studio-inventory-fallback' // AUDIT-PREVIEWS (NEXT_PUBLIC_STUDIO_INVENTORY_FALLBACK, default off)\n", ""],
    ["      ...(STUDIO_INVENTORY_FALLBACK_ENABLED ? { readFallback: async args => { const derived = await readInventoryFallback(args); return derived.kind === 'ok' ? derived : null } } : {}), // AUDIT-PREVIEWS\n", ""],
  ],
  "lib/slide-rail-identity.ts": [
    ["  readFallback, // AUDIT-PREVIEWS\n", ""],
    ["  /** NEXT_PUBLIC_STUDIO_INVENTORY_FALLBACK (the hook passes it only with the flag on): asked once when the inventory answers 404 or 405; a result stands in for the inventory, null keeps the answer. */ // AUDIT-PREVIEWS\n  readFallback?: (args: { baseUrl: string; presentationId: string; fetchImpl: typeof fetch; signal?: AbortSignal }) => Promise<SlideInventoryResult | null> // AUDIT-PREVIEWS\n", ""],
    ["      if (readFallback && result.kind === 'unavailable' && (result.reason === 'http_404' || result.reason === 'http_405')) { const derived = await readFallback({ baseUrl, presentationId, fetchImpl, signal: abort?.signal }).catch(() => null); if (derived) result = derived } // AUDIT-PREVIEWS\n", ""],
  ],
}

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, so putting them back gives the previous file byte for byte. */
// test-studio-create-word.mjs and test-studio-plain-nav-labels.mjs are not here: dev reads them through stripLaterChanges (RESTACK-UX-PC), which applies this change's strip once it is registered, so no edit of them is carried.
export const AUDIT_PREVIEWS_PIN_MARK = "LATER-CHANGES: registry read (AUDIT-PREVIEWS)"
export const AUDIT_PREVIEWS_PIN_EDITS = {
  "scripts/test-studio-chat-element-edit.mjs": [
    ["  shas.splice(0, shas.length, ...shas.filter(sha => !/^Audit fix:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (AUDIT-PREVIEWS): on a branch stacked after this change (the audit P-01 / P-07 / P-29 previews fix), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n", ""],
  ],
  "scripts/test-studio-deck-sync-truth.mjs": [
    ["  shas.splice(0, shas.length, ...shas.filter(sha => !/^Audit fix:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (AUDIT-PREVIEWS): on a branch stacked after this change (the audit P-01 / P-07 / P-29 previews fix), the first-parent commits are its own, not this change's; with none left the identity checks cover the files\n", ""],
  ],
  "scripts/test-studio-deck-card-count.mjs": [
    ["import { stripAuditPreviews } from './studio-audit-previews-strip.mjs' // LATER-CHANGES: registry read (AUDIT-PREVIEWS)\n", ""],
    ["const read = rel => stripDeckCardThumbnail(rel, stripAuditPreviews(rel, fs.readFileSync(path.join(root, rel), 'utf8'))) // LATER-CHANGES: registry read (AUDIT-PREVIEWS); DECK-CARD-THUMBNAIL: its marked lines on the Decks page come out first\n", "const read = rel => stripDeckCardThumbnail(rel, fs.readFileSync(path.join(root, rel), 'utf8')) // DECK-CARD-THUMBNAIL: its marked lines on the Decks page come out first\n"],
  ],
  "scripts/test-studio-deck-cards-v2.mjs": [
    ["import { stripAuditPreviews } from './studio-audit-previews-strip.mjs' // LATER-CHANGES: registry read (AUDIT-PREVIEWS)\n", ""],
    ["const read = file => stripDeckCardThumbnail(file, stripAuditPreviews(file, fs.readFileSync(path.join(root, file), 'utf8'))); // LATER-CHANGES: registry read (AUDIT-PREVIEWS); DECK-CARD-THUMBNAIL: its marked lines on the Decks page come out first\n", "const read = file => stripDeckCardThumbnail(file, fs.readFileSync(path.join(root, file), 'utf8')); // DECK-CARD-THUMBNAIL: its marked lines on the Decks page come out first\n"],
  ],
  "scripts/test-atlas-decks-pagination.mjs": [
    ["import { stripAuditPreviews } from './studio-audit-previews-strip.mjs' // LATER-CHANGES: registry read (AUDIT-PREVIEWS)\n", ""],
    ["const source = stripAuditPreviews('app/(app)/dashboard/page.tsx', fs.readFileSync(new URL('../app/(app)/dashboard/page.tsx', import.meta.url), 'utf8')) // LATER-CHANGES: registry read (AUDIT-PREVIEWS)\n", "const source = fs.readFileSync(new URL('../app/(app)/dashboard/page.tsx', import.meta.url), 'utf8')\n"],
  ],
  "scripts/test-present-view-only.mjs": [
    ["import { stripAuditPreviews } from './studio-audit-previews-strip.mjs' // LATER-CHANGES: registry read (AUDIT-PREVIEWS)\n", ""],
    ["const read = path => stripAuditPreviews(path, fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')) // LATER-CHANGES: registry read (AUDIT-PREVIEWS)\n", "const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')\n"],
  ],
  "scripts/test-studio-deck-card-thumbnail-cards.mjs": [
    ["import { stripAuditPreviews } from './studio-audit-previews-strip.mjs' // LATER-CHANGES: registry read (AUDIT-PREVIEWS)\n", ""],
    ["const read = rel => stripAuditPreviews(rel, fs.readFileSync(path.join(root, rel), 'utf8')) // LATER-CHANGES: registry read (AUDIT-PREVIEWS)\n", "const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')\n"],
  ],
  "scripts/test-studio-deck-card-thumbnail.mjs": [
    ["import { stripAuditPreviews } from './studio-audit-previews-strip.mjs' // LATER-CHANGES: registry read (AUDIT-PREVIEWS)\n", ""],
    ["const pageText = stripAuditPreviews(DASHBOARD_PAGE, read(DASHBOARD_PAGE)) // LATER-CHANGES: registry read (AUDIT-PREVIEWS): this change's lines come out first\n", "const pageText = read(DASHBOARD_PAGE)\n"],
  ],
  "scripts/test-studio-rail-slide-identity.mjs": [
    ["    if (name === '@/lib/studio-inventory-fallback') return { STUDIO_INVENTORY_FALLBACK_ENABLED: false, readInventoryFallback: async () => ({ kind: 'unavailable', reason: 'stub' }) } // LATER-CHANGES: registry read (AUDIT-PREVIEWS): the hook now imports the fallback lib (flag off here: the base's hook)\n", ""],
  ],
  "scripts/test-studio-publish-preview.mjs": [
    ["    if (name === '@/hooks/use-studio-publish-preview-frame') return { useStudioPublishPreviewFrame: () => null } // LATER-CHANGES: registry read (AUDIT-PREVIEWS): flag off, the frame hook answers null\n    if (name === '@/components/studio-publish-preview-frame') return { PublishPreviewFrame: 'PublishPreviewFrame' } // LATER-CHANGES: registry read (AUDIT-PREVIEWS)\n", ""],
  ],
  "scripts/test-studio-publish-preview-inventory.mjs": [
    ["    '@/hooks/use-studio-publish-preview-frame': { useStudioPublishPreviewFrame: () => null }, '@/components/studio-publish-preview-frame': { PublishPreviewFrame: 'PublishPreviewFrame' }, // LATER-CHANGES: registry read (AUDIT-PREVIEWS): the component now imports the frame hook (flag off: null) and the frame\n", ""],
    ["    const head = stripLaterChanges(COMPONENT, fs.readFileSync(path.join(root, COMPONENT), 'utf8')).split('\\n'), base = baseOf(COMPONENT).split('\\n') // LATER-CHANGES: registry read (AUDIT-PREVIEWS): a later change's lines come out first\n", "    const head = fs.readFileSync(path.join(root, COMPONENT), 'utf8').split('\\n'), base = baseOf(COMPONENT).split('\\n')\n"],
  ],
}

// FRONTEND-1's voice-call proof (the four-line after-merge edit): in dev since 506bcbb3, so it is the base's own text and no edit of it is carried (nothing to put back).

/** The older proofs this change teaches. */
export const AUDIT_PREVIEWS_PIN_FILES = Object.keys(AUDIT_PREVIEWS_PIN_EDITS)

export const AUDIT_PREVIEWS_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...AUDIT_PREVIEWS_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const AUDIT_PREVIEWS_SCOPE_FILES = new Set([...AUDIT_PREVIEWS_FILES, ...AUDIT_PREVIEWS_NEW_FILES, ...AUDIT_PREVIEWS_OWN_EDITS])

/** The whole .env.example block: its comment and its lines. */
export const AUDIT_PREVIEWS_ENV_BLOCK = "# STUDIO AUDIT PREVIEWS (FRONTEND-1; production frontend audit P-01, P-07, P-29). Both on for the exact value \"true\"; default off, and then the Decks page, the slide rail and the Publish preview are byte for byte what they were. Build-time values: change them on Vercel and redeploy.\n# NEXT_PUBLIC_STUDIO_DECK_CARD_REHOME: a deck card whose saved viewer URL is another environment's Layout reads, once per deck and only when the card first comes on screen, whether this Layout has that presentation (GET {Layout}/api/presentations/{id}, aborted at the status).\n# Exists: the card shows this Layout's viewer for it, read-only, and Duplicate works on this Layout. Does not exist (404) or the read fails: the honest \"Preview unavailable in this environment\" note and the disabled Duplicate stay. Nothing is written.\nNEXT_PUBLIC_STUDIO_DECK_CARD_REHOME=\"false\"\n# NEXT_PUBLIC_STUDIO_INVENTORY_FALLBACK: where Layout's slide inventory answers 404 or 405 (production: LAYOUT_SLIDE_THUMBNAILS_ENABLED off), (a) the slide rail's list (ids, titles, layouts) is derived from the presentation GET, every slide \"no preview, none coming\" - with\n# NEXT_PUBLIC_STUDIO_RAIL_LIVE_PREVIEW_FALLBACK_ENABLED also on, each card then draws its slide in a view-only frame; (b) a Publish preview with no image from any source shows slide 1 in a view-only frame when this Layout has the deck. No image can be derived: images live behind the same Layout flag.\nNEXT_PUBLIC_STUDIO_INVENTORY_FALLBACK=\"false\"\n"

/** The file with this change's edits put back (the previous text). Used by the strip and the proof. */
export function putBackAuditPreviews(rel, text) {
  return (AUDIT_PREVIEWS_EDITS[rel] || AUDIT_PREVIEWS_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The file without this change's edits: each [has, was] pair put back; every other byte stays. Any other file is returned as it is. */
export function stripAuditPreviews(rel, text) {
  if (typeof text !== 'string') return text
  if (!(rel in AUDIT_PREVIEWS_EDITS) && !(rel in AUDIT_PREVIEWS_PIN_EDITS)) return text
  return putBackAuditPreviews(rel, text)
}
