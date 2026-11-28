// PL-60 STUDIO-VIEW-TICKETS (Platform card, 26 Nov 2026): the Studio's other live Layout frames (the rail's live preview, the Present view-only frame, the template workspace) ask for a VIEW ticket before Layout's strip
// goes on. Stacked on claude/pl46-edit-scope (PL-46): it edits the library and hook that change created, adds one component and one proof, swaps three bare <iframe>s for the component and teaches two older tests the new
// component's name, so there is no strip: this module only names the files, which the registry's scope checks then skip. Plain node, nothing is read from disk or git here.

export const PL60_BASE_COMMIT = 'ff38c70057' // origin/claude/pl46-edit-scope, the commit this change is cut from
export const PL60_COMMIT_SUBJECT = /^PL-60:/

/** Every file this change's commits touch: what the older scope checks skip once the registry names it. */
export const PL60_SCOPE_FILES = new Set([
  "components/layout-viewer-ticketed-iframe.tsx",
  "components/present-view-only-frame.tsx",
  "components/rail-live-preview.tsx",
  "components/studio-template-workspace/shared.tsx",
  "lib/studio-layout-viewer-ticket-client.ts",
  "lib/studio-layout-viewer-ticket.ts",
  "scripts/test-present-view-only.mjs",
  "scripts/test-studio-pl46-edit-scope.mjs",
  "scripts/test-studio-pl60-view-tickets.mjs",
  "scripts/test-studio-rail-live-preview.mjs",
  "scripts/test-studio-replace-picture-hero-only.mjs",
  "scripts/studio-pl60-view-tickets-strip.mjs",
  "scripts/studio-later-changes.mjs"
])

/** Reverse hunks for older proofs taught by PL-60 and the #661 restack. */
export const PL60_REVERSE_HUNKS = {
  "scripts/test-present-view-only.mjs": [
    [
      "      if (id === '@/components/layout-viewer-ticketed-iframe') return { ViewTicketedIframe: 'iframe' } // PL-60: with NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED off the component IS the bare iframe, so this proof reads the tree as before\n",
      ""
    ]
  ],
  "scripts/test-studio-replace-picture-hero-only.mjs": [
    [
      "  for (const rel of [VIEWER, AREA, PAGE, CSS_OLD]) assert.equal(laterStrips(rel, texts[rel] ?? read(rel)), baseText(rel), `${rel}: not touched by this change (byte for byte dev's)`) // LATER-CHANGES: registry read (PL-60): later registered strips come out first\n",
      "  for (const rel of [VIEWER, AREA, PAGE, CSS_OLD]) assert.equal(read(rel), baseText(rel), `${rel}: not touched by this change (byte for byte dev's)`)\n"
    ]
  ],
}

/** Put back PL-60 / #661 taught proof lines so older strip-contract checks see their base byte for byte. */
export function stripPl60ViewTickets(rel, text) {
  if (typeof text !== 'string') return text
  const hunks = PL60_REVERSE_HUNKS[rel]
  if (!hunks) return text
  let out = text
  for (const [now, before] of hunks) { const at = out.indexOf(now); if (at >= 0) out = out.slice(0, at) + before + out.slice(at + now.length) }
  return out
}
