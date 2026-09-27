import type { Metadata } from "next"
import { Start } from "@/components/marketing/v3/home/Start"
import { ZoomBuild } from "@/components/marketing/v3/ZoomBuild"
import { Bring } from "@/components/marketing/v3/home/Bring"
import { Knowledge } from "@/components/marketing/v3/home/Knowledge"
import { Experts } from "@/components/marketing/v3/home/Experts"
import { Themes } from "@/components/marketing/v3/home/Themes"
import { Present } from "@/components/marketing/v3/home/Present"
import { Gallery } from "@/components/marketing/v3/home/Gallery"
import { Pricing } from "@/components/marketing/v3/home/Pricing"
import { Begin } from "@/components/marketing/v3/home/Begin"
import { V3_CONTENT } from "@/lib/marketing/v3-content"

export const metadata: Metadata = {
  title: { absolute: V3_CONTENT.metadata.title },
  description: V3_CONTENT.metadata.description,
  alternates: { canonical: "/" },
}

export default function MarketingV3HomePage() {
  return (
    <main>
      <Start />
      <ZoomBuild />
      <Bring copy={V3_CONTENT.bring} />
      <Knowledge copy={V3_CONTENT.knowledge} />
      <Experts copy={V3_CONTENT.experts} />
      <Themes copy={V3_CONTENT.themes} />
      <Present copy={V3_CONTENT.present} />
      <Gallery copy={V3_CONTENT.gallery} />
      <Pricing copy={V3_CONTENT.pricingHome} />
      <Begin copy={V3_CONTENT.begin} />
    </main>
  )
}
