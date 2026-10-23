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
import { uatMarketingMetadata } from "@/components/marketing/v3-uat/pages/metadata"

// NEXT_PUBLIC_STUDIO_UAT_MARKETING (default off): with the flag on this page is the UAT design (components/marketing/v3-uat). Off: the page below, as it was.
export const metadata: Metadata = process.env.NEXT_PUBLIC_STUDIO_UAT_MARKETING === "true" ? uatMarketingMetadata.home : {
  title: { absolute: V3_CONTENT.metadata.title },
  description: V3_CONTENT.metadata.description,
  alternates: { canonical: "/" },
}

export default async function MarketingV3HomePage() {
  if (process.env.NEXT_PUBLIC_STUDIO_UAT_MARKETING === "true") {
    const { UatHomePage } = await import("@/components/marketing/v3-uat/pages/home")
    return <UatHomePage />
  }
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
