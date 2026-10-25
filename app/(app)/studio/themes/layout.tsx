import type { ReactNode } from "react"
import "@/components/studio-pass3-polish/studio-pass3-polish-f.css" // PASS3-POLISH-F (NEXT_PUBLIC_STUDIO_PASS3_POLISH, default off): every rule is scoped to data-studio-pass3-polish="true"; on a phone the Themes font selects end in an ellipsis before the chevron

/**
 * NEXT_PUBLIC_STUDIO_PASS3_POLISH (PR A's flag, exact "true", default off; build-time), Pass 3 polish F. This layout only brings polish F's stylesheet to the Themes page: every rule in it is scoped to
 * <html data-studio-pass3-polish="true">, which only PR A's mount sets, and only with the flag on. It renders the page exactly as it is: no wrapper, no element, no request, no environment read.
 * The Themes page, its workspace and the account layout are not touched (the account layout and PR E's import line are held byte for byte by PR E's proof; the page by the library-manage pin).
 */
export default function StudioThemesLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
