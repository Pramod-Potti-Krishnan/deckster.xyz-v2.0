"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { trackCta } from "@/lib/analytics"
import { V3_CONTENT } from "@/lib/marketing/v3-content"

export function HeaderV3() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const { nav, header } = V3_CONTENT
  return (
    <header className="hdr" data-v3-header>
      <div className="hdr__in">
        <Link className="hdr__logo" href="/v3" aria-label={header.home}>
          <svg className="lg" aria-hidden="true"><use href="#logo" /></svg>
          <span className="wm">{header.wordmark}</span>
        </Link>
        <nav aria-label="Main navigation">
          {nav.map((item) => <Link key={item.label} href={item.href} className={item.label === "Build" && pathname === "/v3" ? "is-here" : undefined}>{item.label}</Link>)}
        </nav>
        <div className="hdr__cta">
          {status === "loading" ? (
            <>
              <span className="btn btn--ghost" style={{ visibility: "hidden" }} aria-hidden="true">{header.signIn}</span>
              <span className="btn btn--primary" style={{ visibility: "hidden" }} aria-hidden="true">{header.build}</span>
            </>
          ) : (
            <>
              {!session && <Link className="btn btn--ghost" href="/auth/signin" onClick={() => trackCta("v3_header_sign_in")}>{header.signIn}</Link>}
              <Link className="btn btn--primary" href={session ? "/builder" : "/pricing"} onClick={() => trackCta("v3_header_build")}>{header.build}</Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
