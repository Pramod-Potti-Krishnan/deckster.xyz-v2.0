import type { CSSProperties } from "react"
import { SlideChip } from "../SlideChip"
import { ExpertsLoop, type ExpertsLoopContent } from "../ExpertsLoop"
import { statusOf } from "../StatusPill"

export interface ExpertsContent {
  label: string
  eyebrow: string
  title: string
  lede: string
  you: { name: string; role: string }
  director: { name: string; role: string }
  agents: readonly { id: string; name: string; role: string; color: string }[]
  gates: readonly { number: string; name: string; action: string }[]
  loop: ExpertsLoopContent
}

export function Experts({ copy, n, total }: { copy: ExpertsContent; n: number; total: number }) {
  return (
    <section className="slide slide--paper" id="experts" data-snap="slide" data-chapter="Build" data-slide-label={copy.label} data-label={copy.label}>
      <div className="grain" />
      <div className="slide__inner">
        <div className="cols cols--tight">
          <div>
            <span className="eyebrow eyebrow--you" data-reveal>{copy.eyebrow}</span>
            <h2 className="h2 balance" data-reveal style={{ "--d": 1 } as CSSProperties}>{copy.title}</h2>
            <p className="lede" data-reveal style={{ "--d": 2 } as CSSProperties}>{copy.lede}</p>
            <div className="org" data-reveal style={{ "--d": 3 } as CSSProperties}>
              <div className="org__you">
                <span className="av" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="8" r="4" fill="currentColor" /><path d="M4 20c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" fill="currentColor" /></svg></span>
                <div><b>{copy.you.name}</b><br /><span>{copy.you.role}</span></div>
              </div>
              <div className="org__line" />
              <div className="org__dir"><i className="dot" /><div><b>{copy.director.name}</b> <span>{copy.director.role}</span></div></div>
              <div className="org__row">
                {copy.agents.map((agent) => (
                  <div key={agent.id}>
                    <i className="dot" style={{ background: agent.color }} />
                    <b>{agent.name}</b><span>{agent.role}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="gates" data-reveal style={{ "--d": 4 } as CSSProperties}>
              {copy.gates.map((gate) => (
                <div className="gate" key={gate.number}><i>{gate.number}</i><b>{gate.name}</b> {gate.action}</div>
              ))}
            </div>
          </div>
          <ExpertsLoop copy={copy.loop} status={statusOf("buildControl")} />
        </div>
      </div>
      <SlideChip number={n} total={total} label={copy.label} />
    </section>
  )
}
