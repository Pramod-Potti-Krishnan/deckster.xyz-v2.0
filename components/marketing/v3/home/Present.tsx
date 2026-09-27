import type { CSSProperties } from "react"
import { showcaseAlt } from "@/lib/marketing/v3-content"
import { AudienceQA, type AudienceQACopy } from "../AudienceQA"
import { SlideChip } from "../SlideChip"
import { Waveform } from "../Waveform"

export interface PresentCopy {
  label: string
  eyebrow: string
  title: string
  lede: string
  player: { urlPrefix: string; urlSlug: string; access: string; caption: string; time: string; voice: string }
  qa: AudienceQACopy
  ladder: readonly { status: "live" | "build" | "next"; statusLabel: string; text: string }[]
}

export function Present({ copy }: { copy: PresentCopy }) {
  return (
    <section className="slide slide--night compact" id="present" data-snap="slide" data-slide-label={copy.label} data-label={copy.label}>
      <div className="glow glow--coral" style={{ width: "50vw", height: "50vw", right: "-14vw", top: "-10vh", opacity: 0.28 }} />
      <div className="glow glow--violet" style={{ width: "50vw", height: "50vw", left: "-16vw", bottom: "-20vh", opacity: 0.35 }} />
      <div className="grain" />
      <div className="slide__inner">
        <div className="center">
          <span className="eyebrow eyebrow--you" data-reveal>{copy.eyebrow}</span>
          <h2 className="h2 balance" data-reveal style={{ "--d": 1 } as CSSProperties}>{copy.title}</h2>
          <p className="lede balance" data-reveal style={{ "--d": 2 } as CSSProperties}>{copy.lede}</p>
        </div>
        <div className="pub pub--sm" style={{ marginTop: 24 }} data-reveal>
          <div className="player">
            <div className="player__url">
              <span className="dots-3" aria-hidden="true"><i /><i /><i /></span>
              {copy.player.urlPrefix}<b>{copy.player.urlSlug}</b><span className="lock">{copy.player.access}</span>
            </div>
            <div className="player__slide">
              <img src="/marketing/v3/slides/deck-04.jpg" alt={showcaseAlt(4)} width={1280} height={720} />
              <span className="player__cap">{copy.player.caption}</span>
            </div>
            <div className="player__bar">
              <span className="play" aria-hidden="true"><svg width="12" height="14" viewBox="0 0 12 14"><path d="M0 0l12 7-12 7z" fill="currentColor" /></svg></span>
              <Waveform count={40} />
              <span className="player__t">{copy.player.time}</span>
              <span className="player__voice">{copy.player.voice}</span>
            </div>
          </div>
          <AudienceQA copy={copy.qa} />
        </div>
        <div className="ladder pub--sm" data-reveal style={{ "--d": 2 } as CSSProperties}>
          {copy.ladder.map((item) => (
            <div key={item.text}><span className={`pill pill--${item.status}`}>{item.statusLabel}</span>{item.text}</div>
          ))}
        </div>
      </div>
      <SlideChip number={7} label={copy.label} />
    </section>
  )
}
