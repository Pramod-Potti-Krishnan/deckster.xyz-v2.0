"use client"

// FRONTEND-2 (PK's W2 ruling 1, 2 Nov; flag NEXT_PUBLIC_STUDIO_TEMPLATE_MATCH): the one check at the top of the chat composer's "Reuse a template" pop-up: "Use my best-matching template", ticked by default. Ticked, Director uses the
// best-matching template on its own; unticked, no template is applied at all (your theme only). It is the user's own setting, kept on this device for every deck (lib/studio-template-match.ts), and sent to Director on each connect and each tick.
import { useId } from "react"
import { TEMPLATE_MATCH_WORDS } from "@/lib/studio-template-match"
import { useStudioTemplateMatch } from "@/hooks/use-studio-template-match"
import "./studio-template-match.css"

export function StudioTemplateAutoApplyCheck() {
  const id = useId()
  const { autoApply, setAutoApply } = useStudioTemplateMatch()
  return (
    <div data-studio-template-match="auto">
      <input id={id} type="checkbox" checked={autoApply} onChange={event => setAutoApply(event.target.checked)} />
      <label htmlFor={id}><b>{TEMPLATE_MATCH_WORDS.checkLabel}</b><span>{autoApply ? TEMPLATE_MATCH_WORDS.checkHelpOn : TEMPLATE_MATCH_WORDS.checkHelpOff}</span></label>
    </div>
  )
}
