// UX polish 2 (FRONTEND-1 UX review, 4 Nov): NEXT_PUBLIC_STUDIO_UX_POLISH_2, exact "true", default off, read at build time. Import-free.
// On: <html> carries data-studio-ux-polish-2="true" and components/studio-ux-polish-2/studio-ux-polish-2.css applies (every rule scoped to it):
//   UX-20 one accent (the Studio accent tokens that were purple take the shell teal; marketing and the brand logo untouched), UX-16 Docs in the Studio frame on that accent,
//   UX-14 Intelligence: the replay button gets its own gutter and the "Models" bar is hidden when the catalog could not load.
// Off: nothing here is read, no attribute is set, and every page renders as before.

export const STUDIO_UX_POLISH_2_ENABLED = process.env.NEXT_PUBLIC_STUDIO_UX_POLISH_2 === 'true'

export const STUDIO_UX_POLISH_2_ATTR = 'data-studio-ux-polish-2'
