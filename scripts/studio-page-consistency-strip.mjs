// FRONTEND-1 page consistency (frontend1/page-consistency, 4 Nov), flag NEXT_PUBLIC_STUDIO_PAGE_CONSISTENCY (the string "true", with the Studio shell; default off, build-time).
//   UX-07: Billing on the Studio shell tokens (a scoped stylesheet; Billing's own file is not touched). UX-10: Settings and Billing get the library pages' top bar and the rail's "Your details" highlight.
//   One create label: every create button reads "+ Presentation" (the Pass 2 DET-12 shell's label, the newest Studio shell, 21 Oct; "New deck" was PASS2B G56 / top bar v2, 12-15 Oct).
// Every line this change adds to an existing file carries the marker PAGE-CONSISTENCY (a whole token). Two existing lines are rewritten (the rail's "Your details" link and the Builder's create button):
// PAGE_CONSISTENCY_EDITS holds [line now, line before] and the strip puts the line before back FIRST, then takes the marked lines out. Strip the change and each file is its base, byte for byte.
// How the older pins reach it: registered in scripts/studio-later-changes.mjs (three lines). Plain node, nothing read from disk or git here.

export const BASE_COMMIT = '82e27ed6' // frontend1/ux-honesty-polish at the start of this change
export const PAGE_CONSISTENCY_FLAG = 'NEXT_PUBLIC_STUDIO_PAGE_CONSISTENCY'
export const PAGE_CONSISTENCY_MARKER_RE = /(?<![\w-])PAGE-CONSISTENCY(?![\w-])/

/** [line now, line before]: the two rewritten lines. */
export const PAGE_CONSISTENCY_EDITS = {
  "components/layout/studio-rail.tsx": [
    [
      "        <StudioNavigationHint enabled label=\"Your details\"><Link href=\"/studio/details\" aria-label=\"Your details\" aria-current={pathname==='/studio/details' || studioRailDetailsCurrent(STUDIO_PAGE_CONSISTENCY_ENABLED, pathname) ? 'page' : undefined}><UserRound className=\"h-5 w-5\" /></Link></StudioNavigationHint>{/* PAGE-CONSISTENCY (UX-10): Settings and Billing mark Your details */}\n",
      "        <StudioNavigationHint enabled label=\"Your details\"><Link href=\"/studio/details\" aria-label=\"Your details\" aria-current={pathname==='/studio/details' ? 'page' : undefined}><UserRound className=\"h-5 w-5\" /></Link></StudioNavigationHint>\n"
    ]
  ],
  "components/builder/builder-header.tsx": [
    [
      "              <Button className=\"studio-shell-new\" onClick={onNewPresentation} aria-label={studioTopBarV2 ? studioTopBarNewName : studioCreateLabel(studioCreateWord, \"Add presentation\")} title={studioTopBarV2 ? studioTopBarNewName : studioCreateLabel(studioCreateWord, \"Add presentation\")}><Plus className=\"h-4 w-4\" /><span>{studioTopBarV2 ? studioTopBarNewLabel : studioCreateLabel(studioCreateWord, \"Presentation\")}</span></Button>{/* PAGE-CONSISTENCY: one create label */}\n",
      "              <Button className=\"studio-shell-new\" onClick={onNewPresentation} aria-label={studioTopBarV2 ? \"New deck\" : studioCreateLabel(studioCreateWord, \"Add presentation\")} title={studioTopBarV2 ? \"New deck\" : studioCreateLabel(studioCreateWord, \"Add presentation\")}><Plus className=\"h-4 w-4\" /><span>{studioTopBarV2 ? \"New deck\" : studioCreateLabel(studioCreateWord, \"Presentation\")}</span></Button>\n"
    ]
  ]
}

/** Existing files with marked lines. */
export const PAGE_CONSISTENCY_FILES = ['app/(app)/layout.tsx', 'components/layout/app-header.tsx', 'components/layout/studio-rail.tsx', 'components/builder/builder-header.tsx', 'lib/studio-create-word.ts']

/** New files. */
export const PAGE_CONSISTENCY_NEW_FILES = ['lib/studio-page-consistency.ts', 'components/studio-page-consistency/studio-page-consistency-mount.tsx', 'components/studio-page-consistency/studio-page-consistency.css', 'scripts/studio-page-consistency-strip.mjs', 'scripts/test-studio-page-consistency.mjs']

export const PAGE_CONSISTENCY_ENV_BLOCK = "# STUDIO PAGE CONSISTENCY (FRONTEND-1, UX-07 / UX-10). On only for the string \"true\" (and only with NEXT_PUBLIC_STUDIO_V4_SHELL); default off, and then nothing changes. Build-time value: change it on Vercel and redeploy.\n# On: Settings and Billing get the Studio top bar of the library pages (their own title, \"Back to Studio\", \"+ Presentation\") and the rail marks \"Your details\" there; Billing's cards use the Studio shell\n# tokens and the \"Your details\" section heading style; every create button reads \"+ Presentation\" (the newest Studio shell's label). Labels and styles only: routes and handlers are unchanged.\nNEXT_PUBLIC_STUDIO_PAGE_CONSISTENCY=\"false\"\n"

/** Every file this change's commit touches. */
export const PAGE_CONSISTENCY_SCOPE_FILES = new Set([...PAGE_CONSISTENCY_FILES, ...PAGE_CONSISTENCY_NEW_FILES, 'scripts/studio-later-changes.mjs', '.env.example'])

/** The file as it was before this change. Any other file is returned as it is. */
export function stripPageConsistency(rel, text) {
  if (typeof text !== 'string' || !PAGE_CONSISTENCY_FILES.includes(rel)) return text
  let out = text
  for (const [now, was] of PAGE_CONSISTENCY_EDITS[rel] || []) out = out.replace(now, () => was)
  return out.split('\n').filter(line => !PAGE_CONSISTENCY_MARKER_RE.test(line)).join('\n')
}
