"use client"

import { useEffect, useLayoutEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  STUDIO_UX_FINDINGS_E_ATTR, STUDIO_UX_FINDINGS_E_ENABLED, STUDIO_UX_FINDINGS_E_INTRO_OPEN_EVENT, STUDIO_UX_FINDINGS_E_LOGO_ATTR, STUDIO_UX_FINDINGS_E_NAV_ATTR,
  STUDIO_UX_FINDINGS_E_NEW_LOGO, STUDIO_UX_FINDINGS_E_PLAIN_NAV, studioUxFindingsEIntroPlayed, studioUxFindingsEIntroReconcile, studioUxFindingsEIntroSettle, studioUxFindingsEProfileTarget,
  type StudioUxFindingsEIntroHost,
} from "@/lib/studio-ux-findings-e"
import "./studio-ux-findings-e.css"

const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect

/**
 * UX findings E (NEXT_PUBLIC_STUDIO_UX_FINDINGS_E, default off). The attribute that the stylesheet is scoped to, and UX-08: the workspace intro plays once on a browser, and none plays on a browser that already holds an intro mark.
 * The mount below calls it with the session's user id; the Builder (outside the account layout) calls it with its own, so the skeleton and the Director header get the attribute too.
 * Flag off: every effect returns before it reads the document, the window or storage.
 */
export function useStudioUxFindingsE(userId: string) {
  const user = useRef(userId); user.current = userId
  const openedEarly = useRef(false)
  useBeforePaint(() => {
    if (!STUDIO_UX_FINDINGS_E_ENABLED) return
    const root = document.documentElement
    const names = [STUDIO_UX_FINDINGS_E_ATTR, ...(STUDIO_UX_FINDINGS_E_NEW_LOGO ? [STUDIO_UX_FINDINGS_E_LOGO_ATTR] : []), ...(STUDIO_UX_FINDINGS_E_PLAIN_NAV ? [STUDIO_UX_FINDINGS_E_NAV_ATTR] : [])]
    names.forEach(name => root.setAttribute(name, "true"))
    return () => names.forEach(name => root.removeAttribute(name))
  }, [])
  useBeforePaint(() => {
    if (!STUDIO_UX_FINDINGS_E_ENABLED) return
    // A browser that already holds an intro mark plays none: every screen is marked seen before any intro looks (this layout effect runs before the intro's own effect, and needs no user id).
    studioUxFindingsEIntroSettle(window as unknown as StudioUxFindingsEIntroHost)
    // The intro sends this event as it opens, before it records its own screen: the mark is written just after, so it is the last write.
    const opened = () => { if (user.current) window.setTimeout(() => studioUxFindingsEIntroPlayed(window as unknown as StudioUxFindingsEIntroHost, user.current), 0); else openedEarly.current = true }
    window.addEventListener(STUDIO_UX_FINDINGS_E_INTRO_OPEN_EVENT, opened)
    return () => window.removeEventListener(STUDIO_UX_FINDINGS_E_INTRO_OPEN_EVENT, opened)
  }, [])
  useBeforePaint(() => {
    if (!STUDIO_UX_FINDINGS_E_ENABLED || !userId) return
    studioUxFindingsEIntroReconcile(window as unknown as StudioUxFindingsEIntroHost, userId, openedEarly.current)
    openedEarly.current = false
  }, [userId])
}

function StudioUxFindingsEActive() {
  const { data } = useSession()
  const user = data?.user as { id?: string | null; email?: string | null } | undefined
  const pathname = usePathname()
  const router = useRouter()
  useStudioUxFindingsE(user?.id ?? user?.email ?? "")
  // UX-11: "Your details" is the one profile page.
  useBeforePaint(() => {
    const target = studioUxFindingsEProfileTarget(pathname)
    if (target) router.replace(target)
  }, [pathname, router])
  return null
}

/** Drawn by app/(app)/layout.tsx. It draws nothing; flag off, it returns null before any hook of the active part runs. */
export function StudioUxFindingsEMount() {
  return STUDIO_UX_FINDINGS_E_ENABLED ? <StudioUxFindingsEActive /> : null
}
