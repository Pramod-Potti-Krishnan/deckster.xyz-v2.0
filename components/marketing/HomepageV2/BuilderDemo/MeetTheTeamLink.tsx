"use client"

import { ArrowDown } from "lucide-react"
import { trackCta } from "@/lib/analytics"

/**
 * Narrative handoff from the demo slide to the agents slide — the visitor
 * just watched the team work; this stitches "watch them" → "meet them"
 * without relying on raw scrolling.
 */
export function MeetTheTeamLink() {
  const handleClick = () => {
    trackCta("demo_meet_team")
    document
      .getElementById("agents")
      ?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-5 py-2 text-sm font-medium text-white/75 backdrop-blur-md transition-all hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      Meet the eight agents behind this
      <ArrowDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
    </button>
  )
}
