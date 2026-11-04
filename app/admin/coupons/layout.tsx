import type { Metadata } from "next"
import type { ReactNode } from "react"
import { StudioP2AdminCoupons } from "@/components/admin/studio-p2-admin"
import { STUDIO_P2_ADMIN_WORDS } from "@/lib/studio-p2-admin"

// PASS2 ADMIN (NEXT_PUBLIC_STUDIO_P2_ADMIN, default off): /admin/coupons shows the page in the Studio shell's look instead of the page below this layout. Off: this layout hands the page through
// untouched and sets no title, and app/admin/coupons/page.tsx is not changed in either state.
export function generateMetadata(): Metadata {
  return process.env.NEXT_PUBLIC_STUDIO_P2_ADMIN === "true" ? { title: STUDIO_P2_ADMIN_WORDS.couponsDocumentTitle } : {}
}

export default function AdminCouponsLayout({ children }: { children: ReactNode }) {
  if (process.env.NEXT_PUBLIC_STUDIO_P2_ADMIN === "true") return <StudioP2AdminCoupons />
  return children
}
