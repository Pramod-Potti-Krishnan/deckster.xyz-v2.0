"use client"

// FRONTEND-1 (F-05, F-06; flag NEXT_PUBLIC_STUDIO_STRAWMAN_STAGE): the quiet plan strip under the slide on the stage while the deck is still Director's strawman: the slide's title, its content type, its key points,
// and the one plain line that building starts by itself. Reads only what lib/studio-strawman-stage.ts hands it; an empty field is not drawn; no button (the approval is Director's, not the stage's).
import { STRAWMAN_STAGE_NO_ACTION_LINE, type StrawmanStagePlan } from "@/lib/studio-strawman-stage"
import "./studio-strawman-plan.css"

export function StudioStrawmanPlan({ plan }: { plan: StrawmanStagePlan | null }) {
  const hasPlan = Boolean(plan && (plan.title || plan.chip || plan.points.length))
  return (
    <section data-studio-strawman-plan="true" aria-label="Slide plan">
      {plan && hasPlan && (
        <div data-studio-strawman-plan-part="plan" aria-live="polite">
          <div data-studio-strawman-plan-part="head">
            {plan.position !== null && plan.total !== null && <span data-studio-strawman-plan-part="position">Slide {plan.position} of {plan.total}</span>}
            {plan.chip && <span data-studio-strawman-plan-part="chip">{plan.chip}</span>}
          </div>
          {plan.title && <h3 data-studio-strawman-plan-part="title">{plan.title}</h3>}
          {plan.points.length > 0 && (
            <ul data-studio-strawman-plan-part="points" aria-label="Key points">
              {plan.points.map((point, i) => <li key={i}>{point}</li>)}
            </ul>
          )}
        </div>
      )}
      <p data-studio-strawman-plan-part="note">{STRAWMAN_STAGE_NO_ACTION_LINE}</p>
    </section>
  )
}
