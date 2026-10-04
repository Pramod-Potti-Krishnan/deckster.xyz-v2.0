"use client"

import { useEffect, useRef, useState } from "react"
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
  const rootRef = useRef<HTMLDivElement>(null)
  const touchedRef = useRef(false)

  // The looks cycle on their own until the visitor picks one.
  useEffect(() => {
    const root = rootRef.current
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let visible = false
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting })
    io.observe(root)
    const timer = setInterval(() => {
      if (!visible || touchedRef.current) return
      setActive((id) => {
        const index = copy.variants.findIndex((variant) => variant.id === id)
        return copy.variants[(index + 1) % copy.variants.length].id
      })
    }, 3200)
    return () => { clearInterval(timer); io.disconnect() }
  }, [copy.variants])

  return (
    <div className="themes" style={{ marginTop: 30 }} data-reveal ref={rootRef}>
      <div className="themes__stage themes__stage--2">
        {[0, 1].map((slot) => (
          <div className={`shot${slot === 0 ? " shot--wide" : ""}`} key={slot}>
            {copy.variants.map((variant) => (
              <img
                key={variant.id}
                data-theme={variant.id}
                className={variant.id === active ? "is-on" : undefined}
                src={`/marketing/v3/slides/${variant.images[slot]}`}
                alt={`${variant.name} look, slide ${slot + 1}`}
                aria-hidden={variant.id !== active}
                width={1280}
                height={720}
                loading={variant.id === copy.variants[0]?.id ? undefined : "lazy"}
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
                touchedRef.current = true
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
          <ul className="studio__list">
            {copy.panel.items.map((item) => <li key={item.text}><span>{item.text}</span><span className={`st st--sm st--${item.status}`}>{item.word}</span></li>)}
          </ul>
        </div>
      </div>
    </div>
  )
}
