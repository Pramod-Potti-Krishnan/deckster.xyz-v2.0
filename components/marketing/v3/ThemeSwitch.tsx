"use client"

import { useState } from "react"
import { trackCta } from "@/lib/analytics"

export interface ThemeVariant {
  id: string
  name: string
  note: string
  swatches: readonly string[]
  images: readonly string[]
}

export interface ThemeSwitchCopy {
  variants: readonly ThemeVariant[]
  panel: { title: string; items: readonly { text: string; status: string; word: string }[] }
}

export function ThemeSwitch({ copy }: { copy: ThemeSwitchCopy }) {
  const [active, setActive] = useState(copy.variants[0]?.id ?? "")
  const current = copy.variants.find((variant) => variant.id === active) ?? copy.variants[0]

  return (
    <div className="themes" style={{ marginTop: 30 }} data-reveal>
      <div className="themes__stage themes__stage--2">
        {(current?.images ?? []).map((image, slot) => (
          <div className={`shot${slot === 0 ? " shot--wide" : ""}`} key={`${current?.id}-${slot}`}>
            {/* Only the active look is in the page; switching loads the next one. */}
            <img
              className="is-on"
              src={`/marketing/v3/slides/${image}`}
              alt={`${current?.name} look, slide ${slot + 1}`}
              width={1280}
              height={720}
              loading="lazy"
              decoding="async"
            />
          </div>
        ))}
      </div>
      <div>
        <div className="tswitch" data-theme-switch>
          {copy.variants.map((variant) => (
            <button
              type="button"
              key={variant.id}
              data-theme={variant.id}
              className={variant.id === active ? "is-on" : undefined}
              aria-pressed={variant.id === active}
              onClick={() => {
                setActive(variant.id)
                trackCta("v3_theme_switch", { theme: variant.id })
              }}
            >
              <span className="sw" aria-hidden="true">{variant.swatches.map((color) => <i key={color} style={{ background: color }} />)}</span>
              <div><b>{variant.name}</b><span>{variant.note}</span></div>
            </button>
          ))}
        </div>
        <div className="studio">
          <b>{copy.panel.title}</b>
          {copy.panel.items.map((item) => <span key={item.text} style={{ display: "inline-flex", alignItems: "center", gap: 6, margin: "2px 12px 2px 0" }}>{item.text} <span className={`st st--sm st--${item.status}`}>{item.word}</span></span>)}
        </div>
      </div>
    </div>
  )
}
