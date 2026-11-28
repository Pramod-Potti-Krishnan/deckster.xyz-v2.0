import localFont from "next/font/local"
import "../fonts/marketing-subsets.css"
import { HeaderV3 } from "@/components/marketing/v3/HeaderV3"
import { SvgDefs } from "@/components/marketing/v3/SvgDefs"
import { V3Runtime } from "@/components/marketing/v3/V3Runtime"
import { SnapDeck } from "@/components/marketing/SnapDeck/SnapDeck"
import { SlideNavArrows } from "@/components/marketing/SnapDeck/SlideNavArrows"
import { SlideProgressRail } from "@/components/marketing/SnapDeck/SlideProgressRail"
import "@/styles/marketing-v3.css"
// NEXT_PUBLIC_STUDIO_UAT_MARKETING: UAT's rules, every one scoped to .mv3:where(.mv3-uat), so inert on any page that is not the UAT tree. Imported here, straight after the base sheet, so they come after it in the cascade whatever the flag (a stylesheet pulled in only by the shell's import() lands before the base sheet).
import "@/styles/marketing-v3-uat.css"
// NEXT_PUBLIC_MARKETING_V4: the v4 rules, every one scoped to .mv3:where(.mv4), so inert on any page that is not the v4 tree. Imported last so they follow both sheets in the cascade.
import "@/styles/marketing-v4.css"

const display = localFont({
  src: "../fonts/bricolage-grotesque-latin.woff2",
  weight: "200 800",
  style: "normal",
  variable: "--font-display",
  adjustFontFallback: false,
  fallback: ["'Bricolage Grotesque Fallback'"],
  declarations: [
    { prop: "font-family", value: "Bricolage Grotesque" },
    { prop: "unicode-range", value: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" },
    { prop: "font-stretch", value: "100%" },
  ],
})

const body = localFont({
  src: [
    { path: "../fonts/instrument-sans-italic-latin.woff2", weight: "400 700", style: "italic" },
    { path: "../fonts/instrument-sans-latin.woff2", weight: "400 700", style: "normal" },
  ],
  variable: "--font-body",
  adjustFontFallback: false,
  fallback: ["'Instrument Sans Fallback'"],
  declarations: [
    { prop: "font-family", value: "Instrument Sans" },
    { prop: "unicode-range", value: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" },
    { prop: "font-stretch", value: "100%" },
  ],
})

const human = localFont({
  src: [
    { path: "../fonts/instrument-serif-italic-latin.woff2", weight: "400", style: "italic" },
    { path: "../fonts/instrument-serif-latin.woff2", weight: "400", style: "normal" },
  ],
  variable: "--font-human",
  adjustFontFallback: false,
  fallback: ["'Instrument Serif Fallback'"],
  declarations: [
    { prop: "font-family", value: "Instrument Serif" },
    { prop: "unicode-range", value: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" },
  ],
})

const mono = localFont({
  src: [
    { path: "../fonts/jetbrains-mono-latin.woff2", weight: "400", style: "normal" },
    { path: "../fonts/jetbrains-mono-latin.woff2", weight: "500", style: "normal" },
    { path: "../fonts/jetbrains-mono-latin.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-mono",
  adjustFontFallback: false,
  fallback: ["'JetBrains Mono Fallback'"],
  declarations: [
    { prop: "font-family", value: "JetBrains Mono" },
    { prop: "unicode-range", value: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" },
  ],
})

const slide = localFont({
  src: [
    { path: "../fonts/inter-latin.woff2", weight: "400", style: "normal" },
    { path: "../fonts/inter-latin.woff2", weight: "600", style: "normal" },
    { path: "../fonts/inter-latin.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-inter",
  adjustFontFallback: false,
  fallback: ["'Inter Fallback'"],
  declarations: [
    { prop: "font-family", value: "Inter" },
    { prop: "unicode-range", value: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" },
  ],
})

// NEXT_PUBLIC_STUDIO_UAT_MARKETING (default off): with the flag on the page is wrapped in UAT's shell (its header, runtime and pointer light; components/marketing/v3-uat/shell.tsx). The import() sits inside the flag test: the shell is loaded only then (and a build that defines the variable as anything but true leaves it out of the bundle). Off: the layout below, as it was.
export default async function MarketingV3Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  // NEXT_PUBLIC_MARKETING_V4 (default off): with the flag on the page is wrapped in the v4 shell (components/marketing/v4/shell.tsx). Off: as below.
  if (process.env.NEXT_PUBLIC_MARKETING_V4 === "true") {
    const { V4MarketingShell } = await import("@/components/marketing/v4/shell")
    return <V4MarketingShell fonts={`${display.variable} ${body.variable} ${human.variable} ${mono.variable} ${slide.variable}`}>{children}</V4MarketingShell>
  }
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
