"use client"

import Link from "next/link"
import { useSession } from "next-auth/react"
import { trackCta, type CtaLocation } from "@/lib/analytics"

export function BuildCta({
  children,
  location,
  className,
}: {
  children: React.ReactNode
  location: CtaLocation
  className: string
}) {
  const { data: session, status } = useSession()
  return (
    <Link href={status === "loading" ? "#" : session ? "/builder" : "/pricing"} className={className} aria-disabled={status === "loading"} onClick={(event) => {
      if (status === "loading") { event.preventDefault(); return }
      trackCta(location)
    }}>
      {children}
    </Link>
  )
}

export function TrackedLink({
  children,
  location,
  className,
  href,
}: {
  children: React.ReactNode
  location: CtaLocation
  className: string
  href: string
}) {
  return <Link href={href} className={className} onClick={() => trackCta(location)}>{children}</Link>
}
