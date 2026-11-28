// PL-46 STUDIO-EDIT-SCOPE (Platform card, 26 Nov 2026): the Studio asks Layout for a viewer ticket with a scope. Stacked on program1/studio-flip-enablers: it edits the route, the library and the hook that change created,
// adds one proof, and adds NO line to any older file (components/presentation-viewer.tsx is untouched), so there is no strip: this module only names the files, which the registry's scope checks then skip.
// Plain node, nothing is read from disk or git here.

export const PL46_BASE_COMMIT = 'c9427cef8c' // origin/program1/studio-flip-enablers, the commit this change is cut from (it contains c3077a5e)
export const PL46_COMMIT_SUBJECT = /^PL-46:/

/** Every file this change's commits touch: what the older scope checks skip once the registry names it. */
export const PL46_SCOPE_FILES = new Set([
  "app/api/presentations/[id]/viewer-ticket/route.ts",
  "lib/studio-layout-viewer-ticket.ts",
  "lib/studio-layout-viewer-ticket-client.ts",
  "scripts/test-studio-pl46-edit-scope.mjs",
  "scripts/studio-pl46-edit-scope-strip.mjs",
  "scripts/studio-later-changes.mjs"
])
