import { GALLERY_COPY } from "@/lib/marketing/homepage-v2-element-gallery"
import { SectionHeader } from "../shared/SectionHeader"
import { ElementGalleryLoader } from "./ElementGalleryLoader"
import { InventoryCounters } from "./InventoryCounters"

export function ElementGallerySection() {
  return (
    <section
      id="gallery"
      data-snap="slide"
      data-slide-label="Gallery"
      className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col items-center justify-start overflow-hidden bg-[hsl(240,10%,98%)] dark:bg-[hsl(240,10%,8%)] pb-6 pt-8 sm:pb-8 sm:pt-10"
    >
      <div className="container relative mx-auto w-full px-4 sm:px-6 lg:px-8">
        <SectionHeader
          tone="light"
          eyebrow={GALLERY_COPY.eyebrow}
          title={GALLERY_COPY.title}
          description={GALLERY_COPY.description}
        />

        <div className="mt-6 sm:mt-8">
          <InventoryCounters />
        </div>

        <div className="mt-6 sm:mt-8">
          <ElementGalleryLoader />
        </div>
      </div>
    </section>
  )
}
