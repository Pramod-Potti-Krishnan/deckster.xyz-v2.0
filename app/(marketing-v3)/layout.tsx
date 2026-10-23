import { Bricolage_Grotesque, Instrument_Sans, Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google"
import { HeaderV3 } from "@/components/marketing/v3/HeaderV3"
import { SvgDefs } from "@/components/marketing/v3/SvgDefs"
import { V3Runtime } from "@/components/marketing/v3/V3Runtime"
import { SnapDeck } from "@/components/marketing/SnapDeck/SnapDeck"
import { SlideNavArrows } from "@/components/marketing/SnapDeck/SlideNavArrows"
import { SlideProgressRail } from "@/components/marketing/SnapDeck/SlideProgressRail"
import "@/styles/marketing-v3.css"
// NEXT_PUBLIC_STUDIO_UAT_MARKETING: UAT's rules, every one scoped to .mv3:where(.mv3-uat), so inert on any page that is not the UAT tree. Imported here, straight after the base sheet, so they come after it in the cascade whatever the flag (a stylesheet pulled in only by the shell's import() lands before the base sheet).
import "@/styles/marketing-v3-uat.css"

const display = Bricolage_Grotesque({ subsets: ["latin"], axes: ["opsz"], weight: "variable", variable: "--font-display" })
const body = Instrument_Sans({ subsets: ["latin"], weight: "variable", style: ["normal", "italic"], variable: "--font-body" })
const human = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-human" })
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono" })
const slide = Inter({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-inter" })

// NEXT_PUBLIC_STUDIO_UAT_MARKETING (default off): with the flag on the page is wrapped in UAT's shell (its header, runtime and pointer light; components/marketing/v3-uat/shell.tsx). The import() sits inside the flag test, so with it off the build drops the shell. Off: the layout below, as it was.
export default async function MarketingV3Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (process.env.NEXT_PUBLIC_STUDIO_UAT_MARKETING === "true") {
    const { UatMarketingShell } = await import("@/components/marketing/v3-uat/shell")
    return <UatMarketingShell fonts={`${display.variable} ${body.variable} ${human.variable} ${mono.variable} ${slide.variable}`}>{children}</UatMarketingShell>
  }
  return (
    <div className={`mv3 ${display.variable} ${body.variable} ${human.variable} ${mono.variable} ${slide.variable}`}>
      <SvgDefs />
      <SnapDeck headerOffsetPx={56} />
      <V3Runtime />
      <HeaderV3 />
      {children}
      <SlideProgressRail variant="v3" />
      <div className="hidden max-[820px]:contents"><SlideNavArrows /></div>
    </div>
  )
}
