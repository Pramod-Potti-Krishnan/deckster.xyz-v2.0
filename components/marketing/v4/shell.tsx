import type { ReactNode } from "react"
import { SnapDeck } from "@/components/marketing/SnapDeck/SnapDeck"
import { SlideProgressRail } from "@/components/marketing/SnapDeck/SlideProgressRail"
import { HeaderV3 } from "@/components/marketing/v3-uat/HeaderV3"
import { SvgDefs } from "@/components/marketing/v3-uat/SvgDefs"
import { V3Runtime } from "@/components/marketing/v3-uat/V3Runtime"
import { V3Spotlight } from "@/components/marketing/v3-uat/V3Spotlight"
import { V3_CONTENT } from "@/lib/marketing/v3-uat-view"
import { MARKETING_V4_ROOT_CLASS } from "@/lib/marketing-v4"
import { STUDIO_UAT_ROOT_CLASS } from "@/lib/studio-uat-marketing"
import { V4_NAV } from "./content"
import { V4Runtime } from "./V4Runtime"

/** NEXT_PUBLIC_MARKETING_V4: the v4 shell. The UAT shell's own parts (header, deck runtime, pointer light, progress rail) with the v4 root class, the Build page in the nav and the v4 runtime. `fonts` is the layout's own font class list. */
export function V4MarketingShell({ fonts, children }: { fonts: string; children: ReactNode }) {
  return (
    <div className={`mv3 ${STUDIO_UAT_ROOT_CLASS} ${MARKETING_V4_ROOT_CLASS} ${fonts}`}>
      <SvgDefs />
      <SnapDeck headerOffsetPx={56} />
      <V3Runtime />
      <V3Spotlight />
      <HeaderV3 copy={{ nav: V4_NAV, menuExtra: V3_CONTENT.menuExtra, header: V3_CONTENT.header }} />
      {children}
      <SlideProgressRail variant="v3" />
      <V4Runtime />
    </div>
  )
}
