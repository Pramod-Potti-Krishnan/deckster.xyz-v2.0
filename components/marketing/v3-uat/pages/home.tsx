import { Start } from "@/components/marketing/v3-uat/home/Start"
import { ZoomBuild } from "@/components/marketing/v3-uat/ZoomBuild"
import { Bring } from "@/components/marketing/v3-uat/home/Bring"
import { Knowledge } from "@/components/marketing/v3-uat/home/Knowledge"
import { Experts } from "@/components/marketing/v3-uat/home/Experts"
import { Themes } from "@/components/marketing/v3-uat/home/Themes"
import { Present } from "@/components/marketing/v3-uat/home/Present"
import { RealDeck } from "@/components/marketing/v3-uat/home/RealDeck"
import { Gallery } from "@/components/marketing/v3-uat/home/Gallery"
import { Pricing } from "@/components/marketing/v3-uat/home/Pricing"
import { Begin } from "@/components/marketing/v3-uat/home/Begin"
import { statusOf } from "@/components/marketing/v3-uat/StatusPill"
import { V3_CONTENT, showcaseAlt } from "@/lib/marketing/v3-uat-view"

export function UatHomePage() {
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
