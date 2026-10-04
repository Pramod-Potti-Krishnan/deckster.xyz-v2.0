import { Bricolage_Grotesque, Instrument_Sans, Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google"
import { HeaderV3 } from "@/components/marketing/v3/HeaderV3"
import { SvgDefs } from "@/components/marketing/v3/SvgDefs"
import { V3Runtime } from "@/components/marketing/v3/V3Runtime"
import { V3Spotlight } from "@/components/marketing/v3/V3Spotlight"
import { SnapDeck } from "@/components/marketing/SnapDeck/SnapDeck"
import { SlideProgressRail } from "@/components/marketing/SnapDeck/SlideProgressRail"
import { V3_CONTENT } from "@/lib/marketing/v3-content"
import "@/styles/marketing-v3.css"

const display = Bricolage_Grotesque({ subsets: ["latin"], axes: ["opsz"], weight: "variable", variable: "--font-display" })
const body = Instrument_Sans({ subsets: ["latin"], weight: "variable", style: ["normal", "italic"], variable: "--font-body" })
const human = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-human" })
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono" })
const slide = Inter({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-inter" })

export default function MarketingV3Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`mv3 ${display.variable} ${body.variable} ${human.variable} ${mono.variable} ${slide.variable}`}>
      <SvgDefs />
      <SnapDeck headerOffsetPx={56} />
      <V3Runtime />
      <V3Spotlight />
      <HeaderV3 copy={{ nav: V3_CONTENT.nav, menuExtra: V3_CONTENT.menuExtra, header: V3_CONTENT.header }} />
      {children}
      <SlideProgressRail variant="v3" />
    </div>
  )
}
