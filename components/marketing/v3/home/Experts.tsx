import type { CSSProperties } from "react"
import { SlideChip } from "../SlideChip"
import { ExpertsLoop, type ExpertsLoopContent } from "../ExpertsLoop"

export interface ExpertsContent {
  label: string
  eyebrow: string
  title: string
  lede: string
  you: { initials: string; name: string; role: string }
  director: { name: string; role: string }
  agents: readonly { id: string; name: string; role: string; color: string }[]
  gates: readonly { number: string; name: string; action: string }[]
  loop: ExpertsLoopContent
}

export function Experts({ copy }: { copy: ExpertsContent }) {
  return (
    <section className="slide slide--paper" id="experts" data-snap="slide" data-slide-label={copy.label} data-label={copy.label}>
      <div className="grain" />
      <div className="slide__inner">
        <div className="cols cols--tight">
          <div>
            <span className="eyebrow eyebrow--you" data-reveal>{copy.eyebrow}</span>
            <h2 className="h2 balance" data-reveal style={{ "--d": 1 } as CSSProperties}>{copy.title}</h2>
            <p className="lede" data-reveal style={{ "--d": 2 } as CSSProperties}>{copy.lede}</p>
            <div className="org" data-reveal style={{ "--d": 3 } as CSSProperties}>
              <div className="org__you">
                <span className="av">{copy.you.initials}</span>
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
          <ExpertsLoop copy={copy.loop} />
        </div>
      </div>
      <SlideChip number={5} label={copy.label} />
    </section>
  )
}
