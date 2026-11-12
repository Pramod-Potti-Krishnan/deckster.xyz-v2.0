"use client"

// FRONTEND-2 (PK's W2 P4-7/8 rulings, 2 Nov; flag NEXT_PUBLIC_STUDIO_TEMPLATE_MATCH): the one line above the slide that says which template Director applied: "Using your template <name> · <n> of <m> slides", "<n> slides use
// your templates" or "Using <name> for the slides not built yet", with Change (the Template picker on a desktop, the "Use with this deck" bottom sheet on a phone) and, after a switch, Undo.
// It is a sibling above the viewer (components/builder/presentation-area.tsx), drawn only with a deck on the stage and not in template mode, and never while the stage-open gate holds the stage closed (lib/studio-stage-open-gate.ts).
// No badge for auto-apply off, no_match, or no template applied. Director's "No action needed" line under the slide stays as it is.
import { ChevronRight, LayoutTemplate } from "lucide-react"
import { useStudioStageOpen } from "@/lib/studio-stage-open-gate"
import { STUDIO_PHONE_SHELL_ENABLED } from "@/lib/studio-phone-shell"
import { TEMPLATE_MATCH_WORDS } from "@/lib/studio-template-match"
import { requestTemplatePicker, setTemplateSheetOpen, switchTemplate, useStudioTemplateMatch } from "@/hooks/use-studio-template-match"
import { StudioTemplateMatchSheet } from "./studio-template-match-sheet"
import "./studio-template-match.css"

/** The phone shell's width (components/layout/studio-phone-shell.css): 640 px and narrower. */
const PHONE_QUERY = "(max-width: 640px)"
const onPhone = () => STUDIO_PHONE_SHELL_ENABLED && typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(PHONE_QUERY).matches

export function StudioTemplateMatchBadge() {
  const stageOpen = useStudioStageOpen()
  const match = useStudioTemplateMatch()
  const badge = match.badge
  if (!stageOpen || !badge) return null
  const change = () => { if (onPhone()) setTemplateSheetOpen(true); else requestTemplatePicker() }
  return (
    <div data-studio-template-match="badge-row">
      <div data-studio-template-match="badge" role="status" data-kind={badge.kind}>
        <LayoutTemplate aria-hidden="true" />
        <span data-studio-template-match="badge-text" title={badge.text}>{badge.text}</span>
        <span data-studio-template-match="sep" aria-hidden="true">{"·"}</span>
        <button type="button" data-studio-template-match-action="change" onClick={change}>{TEMPLATE_MATCH_WORDS.badgeChange}<ChevronRight aria-hidden="true" /></button>
        {badge.undo && <>
          <span data-studio-template-match="sep" aria-hidden="true">{"·"}</span>
          <button type="button" data-studio-template-match-action="undo" onClick={() => { if (badge.undo) switchTemplate(badge.undo.to) }}>{TEMPLATE_MATCH_WORDS.badgeUndo}</button>
        </>}
      </div>
      <StudioTemplateMatchSheet />
    </div>
  )
}
