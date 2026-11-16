"use client"

import { useEffect } from "react"
import { STUDIO_PAGE_CONSISTENCY_ATTR } from "@/lib/studio-page-consistency"
import "./studio-page-consistency.css"

// UX-07 (NEXT_PUBLIC_STUDIO_PAGE_CONSISTENCY, default off): drawn by app/(app)/layout.tsx only with the flag on. It sets one attribute on <html> so the scoped rules apply; it draws nothing.
export function StudioPageConsistencyMount() {
  useEffect(() => {
    document.documentElement.setAttribute(STUDIO_PAGE_CONSISTENCY_ATTR, "true")
    return () => document.documentElement.removeAttribute(STUDIO_PAGE_CONSISTENCY_ATTR)
  }, [])
  return null
}
