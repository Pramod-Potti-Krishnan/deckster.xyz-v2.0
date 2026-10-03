"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { trackCta } from "@/lib/analytics"

type NavItem = { label: string; href: string }

export interface HeaderV3Copy {
  nav: readonly NavItem[]
  menuExtra: readonly NavItem[]
  header: { home: string; wordmark: string; signIn: string; build: string; open: string; menu: string; close: string }
}

export function HeaderV3({ copy }: { copy: HeaderV3Copy }) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const { nav, header } = copy

  // Close the phone menu on navigation and on Escape.
  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  // Anchor links (Build → /#zoom) are never "current": they are a slide, not a page.
  const isHere = (href: string) => !href.includes("#") && pathname === href
  const buildHref = session ? "/builder" : status === "unauthenticated" ? "/auth/signup" : "/builder"

  return (
    <header className="hdr" data-v3-header>
      <div className="hdr__in">
        <Link className="hdr__logo" href="/" aria-label={header.home}>
          <svg className="lg" aria-hidden="true"><use href="#logo" /></svg>
          <span className="wm">{header.wordmark}</span>
        </Link>
        <nav aria-label="Main navigation">
          {nav.map((item) => <Link key={item.label} href={item.href} className={isHere(item.href) ? "is-here" : undefined} aria-current={isHere(item.href) ? "page" : undefined}>{item.label}</Link>)}
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
              <Link className="btn btn--primary" href={buildHref} onClick={() => trackCta("v3_header_build")}>{session ? header.open : header.build}</Link>
            </>
          )}
          <button type="button" className="hdr__menu" aria-expanded={open} aria-controls="v3-menu" aria-label={open ? header.close : header.menu} onClick={() => { if (!open) trackCta("v3_menu"); setOpen(!open) }}>
            <svg viewBox="0 0 24 24" aria-hidden="true">{open
              ? <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              : <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}</svg>
          </button>
        </div>
      </div>
      {open && (
        <div className="msheet" id="v3-menu">
          {[...nav, ...copy.menuExtra].map((item) => (
            <Link key={item.label} className="msheet__link" href={item.href} onClick={() => setOpen(false)}>{item.label}</Link>
          ))}
          <div className="msheet__cta">
            {!session && <Link className="btn btn--ghost" href="/auth/signin">{header.signIn}</Link>}
            <Link className="btn btn--primary" href={buildHref}>{session ? header.open : header.build}</Link>
          </div>
        </div>
      )}
    </header>
  )
}
