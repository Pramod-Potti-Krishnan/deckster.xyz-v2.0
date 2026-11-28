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
  "scripts/studio-pl60-view-tickets-strip.mjs",
  "scripts/studio-later-changes.mjs"
])
