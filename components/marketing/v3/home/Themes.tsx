import type { CSSProperties } from "react"
import { SlideChip } from "../SlideChip"
import { ThemeSwitch, type ThemeSwitchCopy } from "../ThemeSwitch"
import { statusOf } from "../StatusPill"
import type { V3Feature } from "@/lib/marketing/v3-content"

export type ThemesCopy = Omit<ThemeSwitchCopy, "panel"> & {
  label: string
  eyebrow: string
  title: string
  lede: string
  panel: { title: string; items: readonly { text: string; feature: V3Feature }[] }
}

export function Themes({ copy, n, total }: { copy: ThemesCopy; n: number; total: number }) {
  const panel = { title: copy.panel.title, items: copy.panel.items.map((item) => ({ text: item.text, ...statusOf(item.feature) })) }
  return (
    <section className="slide slide--paper" id="themes" data-snap="slide" data-chapter="Bring" data-slide-label={copy.label} data-label={copy.label}>
      <div className="grain" />
      <div className="slide__inner">
        <div className="center">
          <span className="eyebrow" data-reveal>{copy.eyebrow}</span>
          <h2 className="h2 balance" data-reveal style={{ "--d": 1 } as CSSProperties}>{copy.title}</h2>
          <p className="lede balance" data-reveal style={{ "--d": 2 } as CSSProperties}>{copy.lede}</p>
        </div>
        <ThemeSwitch copy={{ variants: copy.variants, panel }} />
      </div>
      <SlideChip number={n} total={total} label={copy.label} />
    </section>
  )
}
