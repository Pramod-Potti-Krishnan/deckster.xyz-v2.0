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
  studio: { title: string; lead: string }
}

export function ThemeSwitch({ copy }: { copy: ThemeSwitchCopy }) {
  const [active, setActive] = useState(copy.variants[0]?.id ?? "")
  const current = copy.variants.find((variant) => variant.id === active) ?? copy.variants[0]

  return (
    <div className="themes" style={{ marginTop: 30 }} data-reveal>
      <div className="themes__stage">
        {[0, 1, 2].map((slot) => (
          <div className={`shot${slot === 0 ? " shot--wide" : ""}`} key={slot}>
            {copy.variants.map((variant) => (
              <img
                key={variant.id}
                data-theme={variant.id}
                className={variant.id === active ? "is-on" : undefined}
                src={`/marketing/v3/slides/${variant.images[slot]}`}
                alt={`${variant.name} theme preview, slide ${slot + 1}`}
                aria-hidden={variant.id !== active}
                width={1280}
                height={720}
              />
            ))}
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
        <div className="studio"><b>{copy.studio.title}</b>{copy.studio.lead}<strong data-theme-name>{current?.name}</strong>.</div>
      </div>
    </div>
  )
}
