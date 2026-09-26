import type { Metadata } from "next"
import { Start } from "@/components/marketing/v3/home/Start"
import { ZoomBuild } from "@/components/marketing/v3/ZoomBuild"
import { V3_CONTENT } from "@/lib/marketing/v3-content"

export const metadata: Metadata = {
  title: { absolute: V3_CONTENT.metadata.title },
  description: V3_CONTENT.metadata.description,
  alternates: { canonical: "/v3" },
}

export default function MarketingV3HomePage() {
  return <main><Start /><ZoomBuild /></main>
}
