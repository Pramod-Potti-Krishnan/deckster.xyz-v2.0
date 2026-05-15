import { GALLERY_COPY } from "@/lib/marketing/homepage-v2-element-gallery"
import { SectionHeader } from "../shared/SectionHeader"
import { ElementGalleryGrid } from "./ElementGalleryGrid"
import { InventoryCounters } from "./InventoryCounters"

export function ElementGallerySection() {
  return (
    <section
      id="gallery"
      className="relative isolate flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-[hsl(240,10%,98%)] py-16 sm:py-20"
    >
      <div className="container relative mx-auto w-full px-4 sm:px-6 lg:px-8">
        <SectionHeader
          tone="light"
          eyebrow={GALLERY_COPY.eyebrow}
          title={GALLERY_COPY.title}
          description={GALLERY_COPY.description}
        />

        <div className="mt-8 sm:mt-10">
          <p className="mb-4 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/70">
            {GALLERY_COPY.countersEyebrow}
          </p>
          <InventoryCounters />
        </div>

        <div className="mt-8 sm:mt-10">
          <ElementGalleryGrid />
        </div>
      </div>
    </section>
  )
}
