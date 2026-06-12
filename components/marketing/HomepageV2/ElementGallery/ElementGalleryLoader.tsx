"use client"

import dynamic from "next/dynamic"

/**
 * Client-only dynamic import for the gallery carousel — mirrors the
 * BuilderDemoLoader pattern. GalleryGlyph alone is ~1500 lines of SVG, so
 * the whole grid loads as its own below-the-fold chunk while the section
 * header and inventory counters stay server-rendered.
 *
 * `ssr: false` must live in a client component in App Router (Next 15).
 */
const ElementGalleryGrid = dynamic(
  () => import("./ElementGalleryGrid").then((m) => m.ElementGalleryGrid),
  {
    ssr: false,
    loading: () => <ElementGallerySkeleton />,
  },
)

export function ElementGalleryLoader() {
  return <ElementGalleryGrid />
}

/** Static placeholder matching the grid's bounding box (filter pills +
 *  card carousel + caption) so the slide doesn't shift on hydrate. */
function ElementGallerySkeleton() {
  return (
    <div aria-hidden className="w-full">
      <div className="mx-auto mb-6 flex flex-wrap items-center justify-center gap-2">
        {[56, 96, 80, 92, 110].map((w, i) => (
          <div
            key={i}
            style={{ width: w }}
            className="h-8 rounded-full border border-foreground/10 bg-foreground/[0.04] dark:border-white/10 dark:bg-white/[0.06]"
          />
        ))}
      </div>
      <div className="overflow-hidden px-10 pb-2">
        <div className="flex w-max gap-3 sm:gap-3.5">
          {Array.from({ length: 10 }, (_, i) => (
            <div
              key={i}
              className="h-[206px] w-40 shrink-0 rounded-xl border border-foreground/10 bg-foreground/[0.03] dark:border-white/10 dark:bg-white/[0.04] sm:w-44"
            />
          ))}
        </div>
      </div>
      <div className="mt-3 h-4" />
    </div>
  )
}
