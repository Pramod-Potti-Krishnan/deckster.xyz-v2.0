import type { ReactNode } from "react"
import { SnapDeck } from "@/components/marketing/SnapDeck/SnapDeck"
import { SlideProgressRail } from "@/components/marketing/SnapDeck/SlideProgressRail"
import { V3_CONTENT } from "@/lib/marketing/v3-uat-view"
import { STUDIO_UAT_ROOT_CLASS } from "@/lib/studio-uat-marketing"
import { HeaderV3 } from "./HeaderV3"
import { SvgDefs } from "./SvgDefs"
import { V3Runtime } from "./V3Runtime"
import { V3Spotlight } from "./V3Spotlight"

/** NEXT_PUBLIC_STUDIO_UAT_MARKETING: the UAT Landing shell (UAT's layout: its header with the phone menu, the pointer light, no on-screen up/down arrows). `fonts` is the layout's own font class list. */
export function UatMarketingShell({ fonts, children }: { fonts: string; children: ReactNode }) {
  return (
    <div className={`mv3 ${STUDIO_UAT_ROOT_CLASS} ${fonts}`}>
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
