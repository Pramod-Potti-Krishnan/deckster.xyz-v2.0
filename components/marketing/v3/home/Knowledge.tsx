import type { CSSProperties } from "react"
import { KnowledgeGraphCanvas, type KnowledgeGraphCopy } from "../KnowledgeGraphCanvas"
import { SlideChip } from "../SlideChip"

export type KnowledgeCopy = KnowledgeGraphCopy & {
  label: string
  eyebrow: string
  title: string
  lede: string
  citation: {
    web: { label: string; value: string; source: string }
    graph: { label: string; value: string; sourceLead: string; sourceStrong: string }
  }
  checks: readonly string[]
}

export function Knowledge({ copy }: { copy: KnowledgeCopy }) {
  return (
    <section className="slide slide--night" id="knowledge" data-snap="slide" data-slide-label={copy.label} data-label={copy.label}>
      <div className="glow glow--violet" style={{ width: "50vw", height: "50vw", left: "-10vw", top: "10vh", opacity: .35 }} />
      <div className="grain" />
      <div className="slide__inner">
        <div className="cols cols--rev">
          <KnowledgeGraphCanvas copy={copy} />
          <div>
            <span className="eyebrow" data-reveal>{copy.eyebrow}</span>
            <h2 className="h2 balance" data-reveal style={{ "--d": 1 } as CSSProperties}>{copy.title}</h2>
            <p className="lede" data-reveal style={{ "--d": 2 } as CSSProperties}>{copy.lede}</p>
            <div className="cite" data-reveal style={{ "--d": 3 } as CSSProperties}>
              <div className="cite__row">
                <div className="cite__cell">
                  <span className="k">{copy.citation.web.label}</span>
                  <div className="v">{copy.citation.web.value}</div>
                  <span className="s">{copy.citation.web.source}</span>
                </div>
                <div className="cite__cell">
                  <span className="k" style={{ color: "var(--coral-d)" }}>{copy.citation.graph.label}</span>
                  <div className="v">{copy.citation.graph.value}</div>
                  <span className="s">{copy.citation.graph.sourceLead}<b>{copy.citation.graph.sourceStrong}</b></span>
                </div>
              </div>
            </div>
            <div className="checks" data-reveal style={{ "--d": 4 } as CSSProperties}>
              {copy.checks.map((check) => <span key={check}>{check}</span>)}
            </div>
          </div>
        </div>
      </div>
      <SlideChip number={4} label={copy.label} />
    </section>
  )
}
