// CA-J2F2-VIEWONLY (Studio half) — ask Downloads to render the deck in view-only
// mode so PDF and PPTX exports do not print authoring placeholders (the
// "Generate image..." spinner, "IMAGE / Click to configure", stock copy).
//
// Import-free and pure (vm-tested in scripts/test-export-view-only.mjs).
//
// Build-time flag NEXT_PUBLIC_EXPORT_VIEW_ONLY_ENABLED, literal "true" only,
// default off. Off: the request body is returned untouched (same object, no new
// key), so the JSON sent to Downloads is byte-identical to today. On: the body
// gains `view_only: true`, which Downloads (DOWNLOADS_VIEW_ONLY_RENDER_ENABLED)
// turns into `viewOnly=true` on the viewer URL. Useless alone: Downloads' flag
// and Layout's LAYOUT_VIEW_HIDES_AUTHORING_PLACEHOLDERS_ENABLED must be on first.

/** Read per call so the literal `process.env.NEXT_PUBLIC_*` is inlined by Next at build. */
export function isExportViewOnlyEnabled(): boolean {
  return process.env.NEXT_PUBLIC_EXPORT_VIEW_ONLY_ENABLED === 'true'
}

/** Flag on: append `view_only: true`. Flag off: return the payload as-is. */
export function withExportViewOnly<T extends object>(payload: T): T | (T & { view_only: true }) {
  return isExportViewOnlyEnabled() ? { ...payload, view_only: true } : payload
}
