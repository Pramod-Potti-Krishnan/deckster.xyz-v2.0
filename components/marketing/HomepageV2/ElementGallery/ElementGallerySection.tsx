import { GALLERY_COPY } from "@/lib/marketing/homepage-v2-element-gallery"
import { SectionHeader } from "../shared/SectionHeader"
import { ElementGalleryGrid } from "./ElementGalleryGrid"
import { InventoryCounters } from "./InventoryCounters"

export function ElementGallerySection() {
  return (
    <section
      id="gallery"
      className="relative isolate overflow-hidden bg-[hsl(240,10%,98%)] py-20 sm:py-24 lg:py-28"
    >
      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          tone="light"
          eyebrow={GALLERY_COPY.eyebrow}
          title={GALLERY_COPY.title}
          description={GALLERY_COPY.description}
        />

        <div className="mt-12 sm:mt-14">
          <p className="mb-5 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/70">
            {GALLERY_COPY.countersEyebrow}
          </p>
          <InventoryCounters />
        </div>

        <div className="mt-14 sm:mt-16">
          <ElementGalleryGrid />
        </div>
      </div>
    </section>
  )
}
