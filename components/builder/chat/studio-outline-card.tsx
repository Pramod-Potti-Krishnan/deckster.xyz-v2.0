"use client"

import type { ReactNode } from "react"
import { ChevronDown, ListOrdered } from "lucide-react"
import type { SlideContextItem, SlideUpdate } from "@/hooks/use-deckster-websocket-v2"

interface StudioOutlineCardProps {
  payload: SlideUpdate["payload"]
  contextByIndex?: Record<number, SlideContextItem> | null
  renderEvidence: (context?: SlideContextItem) => ReactNode
}

/** Reads the existing outline/context only; expanding a row never sends or mutates. */
export function StudioOutlineCard({ payload, contextByIndex, renderEvidence }: StudioOutlineCardProps) {
  return (
    <section data-studio-director-part="outline-review" aria-label="Presentation outline">
      <div data-studio-director-part="outline-review-heading"><ListOrdered size={13} aria-hidden="true" /><span>Presentation outline</span></div>
      <h3>{payload.metadata.main_title}</h3>
      <p data-studio-director-part="outline-review-meta">{payload.slides.length} slides · {payload.metadata.presentation_duration} min{payload.metadata.overall_theme && ` · ${payload.metadata.overall_theme}`}</p>
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
    </section>
  )
}
