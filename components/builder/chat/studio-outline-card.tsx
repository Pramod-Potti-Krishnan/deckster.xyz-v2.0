"use client"

import type { ReactNode } from "react"
import { ChevronDown, ListOrdered } from "lucide-react"
import type { SlideContextItem, SlideUpdate } from "@/hooks/use-deckster-websocket-v2"
import { STUDIO_STRAWMAN_CHAT_ENABLED } from "@/lib/studio-strawman-chat" // STRAWMAN-CHAT

interface StudioOutlineCardProps {
  payload: SlideUpdate["payload"]
  contextByIndex?: Record<number, SlideContextItem> | null
  renderEvidence: (context?: SlideContextItem) => ReactNode
  historyStatus?: 'earlier' | 'current'
  /** PASS2 #4 (NEXT_PUBLIC_STUDIO_OUTLINE_CANVAS; all four undefined when off). onCanvas: this outline is on the canvas, so the
   * chat keeps its summary and folds the slide list. outlineLabel: the count reads as the outline's ("Outline · 7 slides"), with
   * the deck's current count beside it when the two differ (deckSlideCount). canvasSuperseded: an older, different outline that the
   * one on the canvas replaced; it folds the same way and is marked "Earlier outline". */
  onCanvas?: boolean
  canvasSuperseded?: boolean
  outlineLabel?: boolean
  deckSlideCount?: number | null
}

/** Reads the existing outline/context only; expanding a row never sends or mutates. */
export function StudioOutlineCard({ payload, contextByIndex, renderEvidence, historyStatus, onCanvas, canvasSuperseded, outlineLabel, deckSlideCount }: StudioOutlineCardProps) {
  if (STUDIO_STRAWMAN_CHAT_ENABLED) return null // STRAWMAN-CHAT: no outline card in the chat at all (F-08, PK 31 Oct): Director's one line and the Looks perfect / Make some changes buttons stay
  const details = <>
      {payload.metadata.target_audience && <p data-studio-director-part="outline-review-audience">For {payload.metadata.target_audience}</p>}
      <p data-studio-director-part="outline-review-hint">Expand a slide to review its content and research details.</p>
      <ol data-studio-director-part="outline-review-slides" tabIndex={0} aria-label="Outline slides">
        {payload.slides.map((slide, index) => {
          const context = contextByIndex?.[index]
          const hasResearch = Boolean(context?.research_status || context?.research_ready != null
            || context?.citation_count != null || context?.source_types?.length || context?.research_issues?.length)
          return (
            <li key={slide.slide_id || index}>
              <details data-studio-director-part="outline-review-slide">
                <summary>
                  <span data-studio-director-part="outline-review-number">{slide.slide_number}</span>
                  <span data-studio-director-part="outline-review-summary">
                    <strong>{slide.title}</strong>
                    {context?.key_message && <small data-studio-director-part="outline-review-preview">{context.key_message}</small>}
                    <span data-studio-director-part="outline-review-tags">
                      {slide.slide_type && <span data-studio-director-part="outline-review-kind">{slide.slide_type}</span>}
                      {context?.narrative_role && <span data-studio-director-part="outline-review-role">{context.narrative_role.replace(/_/g, " ")}</span>}
                      {renderEvidence(context)}
                    </span>
                  </span>
                  <ChevronDown size={13} aria-hidden="true" />
                </summary>
                <div data-studio-director-part="outline-review-content">
                  {context?.key_message && <p data-studio-director-part="outline-review-takeaway"><b>Key message</b>{context.key_message}</p>}
                  {slide.narrative && <p>{slide.narrative}</p>}
                  {slide.key_points?.length > 0 && <ul>{slide.key_points.map((point, pointIndex) => <li key={pointIndex}>{point}</li>)}</ul>}
                  {hasResearch && (
                    <div data-studio-director-part="research-details">
                      <strong>Research details</strong>
                      {context?.research_status && <p><b>Status</b>{context.research_status.replace(/_/g, " ")}</p>}
                      {context?.research_ready != null && <p><b>Readiness</b>{context.research_ready ? "Ready" : "Not ready"}</p>}
                      {context?.citation_count != null && <p><b>Citations</b>{context.citation_count}</p>}
                      {context?.source_types?.length ? <p><b>Source types</b>{context.source_types.join(", ")}</p> : null}
                      {context?.research_issues?.length ? <div><b>Research notes</b><ul>{context.research_issues.map((issue, issueIndex) => <li key={issueIndex}>{issue}</li>)}</ul></div> : null}
                    </div>
                  )}
                </div>
              </details>
            </li>
          )
        })}
      </ol>
  </>
  const card = (
    <section data-studio-director-part={historyStatus === 'earlier' ? 'outline-history-review' : 'outline-review'} aria-label={historyStatus === 'earlier' || canvasSuperseded ? 'Earlier presentation outline' : 'Presentation outline'}>
      <div data-studio-director-part="outline-review-heading"><ListOrdered size={13} aria-hidden="true" /><span>{historyStatus === 'earlier' || canvasSuperseded ? 'Earlier outline' : historyStatus === 'current' ? 'Current outline' : 'Presentation outline'}</span></div>
      {historyStatus === 'current' && <p className="text-xs text-muted-foreground">This outline has different notes. The earlier outline remains available above.</p>}
      <h3>{payload.metadata.main_title}</h3>
      <p data-studio-director-part="outline-review-meta">{outlineLabel ? 'Outline · ' : null}{payload.slides.length} slides · {payload.metadata.presentation_duration} min{payload.metadata.overall_theme && ` · ${payload.metadata.overall_theme}`}</p>
      {outlineLabel && typeof deckSlideCount === 'number' && Number.isFinite(deckSlideCount) && deckSlideCount !== payload.slides.length
        ? <p data-studio-director-part="outline-review-deck-count">The deck now has {deckSlideCount} slides.</p> : null}
      {onCanvas ? <>
        <p data-studio-director-part="outline-review-canvas-note">The outline is on the canvas. Review each slide there, then approve it or ask for changes.</p>
        <details data-studio-director-part="outline-review-details"><summary>Slide details</summary>{details}</details>
      </> : canvasSuperseded ? <>
        <p data-studio-director-part="outline-review-superseded-note">Replaced by the outline on the canvas.</p>
        <details data-studio-director-part="outline-review-details"><summary>Slide details</summary>{details}</details>
      </> : details}
    </section>
  )
  return historyStatus === 'earlier' ? <details data-studio-director-part="outline-history" className="mt-2 rounded-lg border p-3">
    <summary className="cursor-pointer text-xs font-medium">Earlier outline · {payload.slides.length} slides</summary>
    <p className="text-xs text-muted-foreground">Previous outline notes. Expand to compare with the current outline.</p>
    {card}
  </details> : card
}
