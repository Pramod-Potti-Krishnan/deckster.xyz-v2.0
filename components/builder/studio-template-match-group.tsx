"use client"

// FRONTEND-2 (W2 P4-7/8; flag NEXT_PUBLIC_STUDIO_TEMPLATE_MATCH): the choices of "Use with this deck": the candidates Director's matcher listed (top 3), the one in use, and "No template". One list for the Template picker's
// popover (StudioTemplateMatchGroup) and the phone sheet (StudioTemplateMatchChoices). Coverage as "7 of 8 slides", owner as Yours / Library, never a score or a Fit %. Switching applies to the slides not built yet.
import { useState } from "react"
import { TEMPLATE_MATCH_WORDS, defaultPickerChoice, pickerAvailable, switchButtonLabel } from "@/lib/studio-template-match"
import { useStudioTemplateMatch } from "@/hooks/use-studio-template-match"
import "./studio-template-match.css"

/** The rows, the primary button ("Switch to <name>") and the note. `onDone` runs after a switch and on Cancel. `sheet` leaves out the Cancel button (the sheet closes by its handle, Escape or a tap outside). */
export function StudioTemplateMatchChoices({ onDone, sheet = false }: { onDone: () => void; sheet?: boolean }) {
  const match = useStudioTemplateMatch()
  const rows = match.rows
  const [picked, setPicked] = useState<string | null | undefined>(undefined)
  const chosen = picked !== undefined && rows.some(row => row.templateId === picked) ? picked : defaultPickerChoice(rows)
  const row = chosen === undefined ? null : rows.find(candidate => candidate.templateId === chosen) ?? null
  const apply = () => {
    if (!row || row.inUse) return
    match.switchTemplate(row.templateId)
    onDone()
  }
  return (
    <>
      <div role="radiogroup" aria-label={TEMPLATE_MATCH_WORDS.groupTitle} data-studio-template-match="rows">
        {rows.map(candidate => (
          <button key={candidate.templateId ?? "none"} type="button" role="radio" aria-checked={candidate.templateId === chosen && row !== null} data-studio-template-match="row"
            data-studio-template-match-option={candidate.templateId ?? "none"} title={candidate.name} onClick={() => setPicked(candidate.templateId)}>
            <span data-studio-template-match="row-info">
              <span data-studio-template-match="row-name">
                <span>{candidate.name}</span>
                {candidate.owner && <span data-studio-template-match="pill">{candidate.owner}</span>}
                {candidate.inUse && <span data-studio-template-match="pill" data-kind="use">{TEMPLATE_MATCH_WORDS.inUse}</span>}
              </span>
              {candidate.why && <span data-studio-template-match="row-why">{candidate.why}</span>}
            </span>
            {candidate.coverage && <span data-studio-template-match="row-cov">{candidate.coverage}</span>}
          </button>
        ))}
      </div>
      <div data-studio-template-match="acts">
        <button type="button" data-primary="true" disabled={!row || row.inUse} onClick={apply}>{switchButtonLabel(row && row.templateId !== null ? row.name : null)}</button>
        {!sheet && <button type="button" onClick={onDone}>{TEMPLATE_MATCH_WORDS.cancel}</button>}
      </div>
      {!sheet && <p data-studio-template-match="note">{TEMPLATE_MATCH_WORDS.switchNote}</p>}
    </>
  )
}

/** The group on top of the Template picker's popover; nothing while there is nothing to choose from (no match, auto-apply off). */
export function StudioTemplateMatchGroup({ onDone }: { onDone: () => void }) {
  const match = useStudioTemplateMatch()
  if (!pickerAvailable(match.frame)) return null
  return (
    <section data-studio-template-match="group" aria-label={TEMPLATE_MATCH_WORDS.groupTitle}>
      <h4 data-studio-template-match="group-title">{TEMPLATE_MATCH_WORDS.groupTitle}</h4>
      <p data-studio-template-match="group-help">{TEMPLATE_MATCH_WORDS.groupHelp}</p>
      <StudioTemplateMatchChoices onDone={onDone} />
    </section>
  )
}
