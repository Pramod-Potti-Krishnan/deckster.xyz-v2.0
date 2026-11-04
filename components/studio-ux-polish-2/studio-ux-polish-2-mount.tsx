"use client"

import { useEffect } from "react"
import { STUDIO_UX_POLISH_2_ATTR } from "@/lib/studio-ux-polish-2"
import "./studio-ux-polish-2.css"

// UX polish 2 (NEXT_PUBLIC_STUDIO_UX_POLISH_2, default off): drawn by app/layout.tsx only with the flag on. It sets one attribute on <html> so the scoped rules apply; it draws nothing.
export function StudioUxPolish2Mount() {
  useEffect(() => {
    document.documentElement.setAttribute(STUDIO_UX_POLISH_2_ATTR, "true")
    return () => document.documentElement.removeAttribute(STUDIO_UX_POLISH_2_ATTR)
  }, [])
  return null
}
