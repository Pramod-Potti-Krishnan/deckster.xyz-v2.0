"use client"

import Link from "next/link"
import type { CSSProperties } from "react"
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
  // Signed out: request access (Google sign-in, then access code or the early-access queue).
  // While the session loads, /builder is safe for everyone: middleware sends signed-out visitors to sign-in.
  const href = status === "unauthenticated" ? "/auth/signup" : "/builder"
  return (
    <Link href={href} className={className} onClick={() => trackCta(location)}>
      {children}
    </Link>
  )
}

export function TrackedLink({
  children,
  location,
  className,
  href,
  style,
  revealDelay,
}: {
  children: React.ReactNode
  location: CtaLocation
  className: string
  href: string
  style?: CSSProperties
  revealDelay?: number
}) {
  return <Link href={href} className={className} style={revealDelay === undefined ? style : { ...style, "--d": revealDelay } as CSSProperties} data-reveal={revealDelay === undefined ? undefined : ""} onClick={() => trackCta(location)}>{children}</Link>
}
