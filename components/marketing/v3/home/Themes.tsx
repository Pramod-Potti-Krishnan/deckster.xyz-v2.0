import type { CSSProperties } from "react"
import { SlideChip } from "../SlideChip"
import { ThemeSwitch, type ThemeSwitchCopy } from "../ThemeSwitch"

export type ThemesCopy = ThemeSwitchCopy & {
  label: string
  eyebrow: string
  title: string
  lede: string
}

export function Themes({ copy }: { copy: ThemesCopy }) {
  return (
    <section className="slide slide--paper" id="themes" data-snap="slide" data-slide-label={copy.label} data-label={copy.label}>
      <div className="grain" />
      <div className="slide__inner">
        <div className="center">
          <span className="eyebrow" data-reveal>{copy.eyebrow}</span>
          <h2 className="h2 balance" data-reveal style={{ "--d": 1 } as CSSProperties}>{copy.title}</h2>
          <p className="lede balance" data-reveal style={{ "--d": 2 } as CSSProperties}>{copy.lede}</p>
        </div>
        <ThemeSwitch copy={copy} />
      </div>
      <SlideChip number={6} label={copy.label} />
    </section>
  )
}
