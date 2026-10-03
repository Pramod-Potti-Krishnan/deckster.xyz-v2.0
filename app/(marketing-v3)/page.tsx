import type { Metadata } from "next"
import { Start } from "@/components/marketing/v3/home/Start"
import { ZoomBuild } from "@/components/marketing/v3/ZoomBuild"
import { Bring } from "@/components/marketing/v3/home/Bring"
import { Knowledge } from "@/components/marketing/v3/home/Knowledge"
import { Experts } from "@/components/marketing/v3/home/Experts"
import { Themes } from "@/components/marketing/v3/home/Themes"
import { Present } from "@/components/marketing/v3/home/Present"
import { RealDeck } from "@/components/marketing/v3/home/RealDeck"
import { Gallery } from "@/components/marketing/v3/home/Gallery"
import { Pricing } from "@/components/marketing/v3/home/Pricing"
import { Begin } from "@/components/marketing/v3/home/Begin"
import { statusOf } from "@/components/marketing/v3/StatusPill"
import { v3Metadata } from "@/lib/marketing/v3-metadata"
import { V3_CONTENT, showcaseAlt } from "@/lib/marketing/v3-content"

export const metadata: Metadata = v3Metadata({
  path: "/",
  title: V3_CONTENT.metadata.title,
  description: V3_CONTENT.metadata.description,
})

export default function MarketingV3HomePage() {
  const c = V3_CONTENT
  const hasRealDeck = c.realDeck.url.length > 0
  // Order follows the spine (M-19): Build first (live today), then Bring, Present, plans.
  const total = hasRealDeck ? 11 : 10
  let n = 0
  const next = () => ++n
  return (
    <main>
      <Start n={next()} total={total} />
      <ZoomBuild copy={c.zoom} n={next()} total={total} tileAlts={c.zoom.tiles.map((tile) => showcaseAlt(tile.slide, tile.title))} slideStatus={statusOf("slidePanel")} />
      <Experts copy={c.experts} n={next()} total={total} />
      <Gallery copy={c.gallery} n={next()} total={total} />
      <Bring copy={c.bring} n={next()} total={total} />
      <Knowledge copy={c.knowledge} n={next()} total={total} />
      <Themes copy={c.themes} n={next()} total={total} />
      <Present copy={c.present} n={next()} total={total} />
      {hasRealDeck && <RealDeck copy={c.realDeck} n={next()} total={total} />}
      <Pricing copy={c.pricingHome} n={next()} total={total} />
      <Begin copy={c.begin} n={next()} total={total} hasRealDeck={hasRealDeck} />
    </main>
  )
}
