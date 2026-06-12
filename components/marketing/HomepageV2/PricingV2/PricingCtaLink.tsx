"use client"

import Link from "next/link"
import { trackCta, type CtaLocation } from "@/lib/analytics"

/**
 * Client wrapper for pricing CTAs — the pricing section is server-rendered,
 * so click tracking lives in this leaf instead of converting the whole
 * section to a client component.
 */
export function PricingCtaLink({
  href,
  location,
  className,
  children,
}: {
  href: string
  location: CtaLocation
  className?: string
  children: React.ReactNode
}) {
  return (
    <Link href={href} className={className} onClick={() => trackCta(location)}>
      {children}
    </Link>
  )
}
