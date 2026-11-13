"use client"

/**
 * AUDIT P-29 (NEXT_PUBLIC_STUDIO_INVENTORY_FALLBACK, default off): slide 1 itself, view-only, for a Publish preview that has no image from any source and whose deck this Layout has
 * (hooks/use-studio-publish-preview-frame.ts). `src` already went through the Layout viewer allow-list (lib/rail-live-preview.ts railLivePreviewSrc: the view-only builder, `#/0`, the policy).
 * Not clickable, not focusable, hidden from assistive technology: the figure's own caption says what it is.
 */
export function PublishPreviewFrame({ src }: { src: string }) {
  return (
    <div className="studio-publish-preview-image" data-preview-status="frame">
      <iframe src={src} title="First slide of the current Final deck (view only)" aria-hidden="true" tabIndex={-1} loading="lazy" style={{ width: '100%', height: '100%', border: 0, pointerEvents: 'none' }} />
    </div>
  )
}
