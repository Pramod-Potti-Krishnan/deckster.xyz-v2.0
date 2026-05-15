import { GALLERY_COPY } from "@/lib/marketing/homepage-v2-element-gallery"
import { SectionHeader } from "../shared/SectionHeader"
import { ElementGalleryGrid } from "./ElementGalleryGrid"
import { InventoryCounters } from "./InventoryCounters"

export function ElementGallerySection() {
  return (
    <section
      id="gallery"
      data-snap="slide"
      className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col items-center justify-start overflow-hidden bg-[hsl(240,10%,98%)] pb-6 pt-8 sm:pb-8 sm:pt-10"
    >
      <div className="container relative mx-auto w-full px-4 sm:px-6 lg:px-8">
        <SectionHeader
          tone="light"
          eyebrow={GALLERY_COPY.eyebrow}
          title={GALLERY_COPY.title}
          description={GALLERY_COPY.description}
        />

        <div className="mt-6 sm:mt-8">
          <p className="mb-4 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/70">
            {GALLERY_COPY.countersEyebrow}
          </p>
          <InventoryCounters />
        </div>

        <div className="mt-6 sm:mt-8">
          <ElementGalleryGrid />
        </div>
      </div>
    </section>
  )
}
