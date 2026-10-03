"use client"

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react"
import Link from "next/link"
import { track } from "@vercel/analytics"
import { snapToAdjacent } from "@/components/marketing/SnapDeck/use-snap-navigation"
import type { V3_CONTENT } from "@/lib/marketing/v3-content"
import { trackCta } from "@/lib/analytics"
import { SlideChip } from "./SlideChip"

type ZoomCopy = typeof V3_CONTENT.zoom
type Mode = ZoomCopy["modes"][number]["id"]

const WW = 992, WH = 572, TW = 320, TH = 180
const C0 = { x: WW / 2, y: WH / 2 }, C1 = { x: 496, y: 286 }, C2 = { x: 439.5, y: 306.5 }, EW = 185, EH = 98
const ease = (t: number) => t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const seg = (p: number, a: number, b: number) => Math.min(1, Math.max(0, (p - a) / (b - a)))

function TargetSlide({ copy }: { copy: ZoomCopy["slide"] }) {
  const points = copy.bars.slice(0, 5).map((bar, index) => `${(index + .5) * (600 / 6)},${100 - bar.height}`).join(" ")
  return (
    <div className="sl">
      <div className="sl__eyebrow">{copy.eyebrow}</div>
      <h3 className="sl__title el" data-el={copy.elements.title}>{copy.title}<em>{copy.titleAccent}</em></h3>
      <div className="sl__metrics el" data-el={copy.elements.metrics}>
        {copy.metrics.map((metric) => <div className="sl__m" key={metric.label}><b>{metric.value}</b><span>{metric.label}</span></div>)}
      </div>
      <div className="sl__chart el el--target" data-el={copy.elements.chart}>
        <h4 className="t1">{copy.chartTitle}</h4><h4 className="t2">{copy.waterfallTitle}</h4>
        <div className="sub">{copy.chartSub}</div>
        <div className="bars">
          {copy.bars.map((bar, index) => (
            <div className={index === 5 ? "bar total" : "bar"} key={bar.label} style={{ "--h": bar.height, "--b": bar.base, "--wh": bar.waterfallHeight } as CSSProperties}>
              <i><b><span className="v1">{bar.value}</span><span className="v2">{bar.waterfallValue}</span></b></i>
              <span><span className="v1">{bar.label}</span><span className="v2">{bar.waterfallLabel}</span></span>
            </div>
          ))}
        </div>
        <svg className="sl__line" viewBox="0 0 600 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={points} />
          {copy.bars.slice(0, 5).map((bar, index) => <circle key={bar.label} cx={(index + .5) * 100} cy={100 - bar.height} r="2.4" />)}
        </svg>
        <table className="sl__table">
          <thead><tr>{copy.tableHead.map((head) => <th key={head}>{head}</th>)}</tr></thead>
          <tbody>{copy.bars.slice(0, 5).map((bar) => <tr key={bar.label}><td>{bar.label}</td><td>{bar.value}</td></tr>)}</tbody>
        </table>
        <div className="sl__cite"><b>{copy.sourceLabel}</b> {copy.source}</div>
      </div>
      <div className="sl__side el" data-el={copy.elements.text}>
        {copy.sides.map((side) => <div className="box" key={side.title}><b>{side.title}</b><p>{side.body}</p></div>)}
      </div>
      <div className="sl__band el" data-el={copy.elements.takeaway}>{copy.takeaway}</div>
      <div className="sl__foot">{copy.foot}</div><div className="sl__num">{copy.number}</div>
    </div>
  )
}

const ctaLocations = ["v3_zoom_approve", "v3_zoom_keep"] as const

export function ZoomBuild({ copy, n, total, tileAlts, slideStatus }: {
  copy: ZoomCopy
  n: number
  total: number
  tileAlts: readonly string[]
  slideStatus: { status: string; word: string }
}) {
  const sectionRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const lastAltRef = useRef<string>("deck")
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const [mode, setMode] = useState<Mode | null>(null)
  const modeRef = useRef<Mode | null>(null)
  const applyModeRef = useRef<(p?: number) => void>(() => {})

  useEffect(() => {
    const zoom = sectionRef.current, stage = stageRef.current, world = worldRef.current
    if (!zoom || !stage || !world) return
    const zSlide = zoom.querySelector<HTMLElement>(".sl")
    const cards = zoom.querySelectorAll<HTMLElement>(".xchg__card")
    const labels = zoom.querySelectorAll<HTMLElement>(".alt__lbl")
    const indicator = zoom.querySelector<HTMLElement>(".alt__ind")
    let raf: number | null = null
    let lastP = 0
    const applyMode = (p = lastP) => {
      const chosen = modeRef.current
      zSlide?.classList.toggle("sl--waterfall", chosen ? chosen === "waterfall" : p > .86)
      zSlide?.classList.toggle("sl--line", chosen === "line")
      zSlide?.classList.toggle("sl--table", chosen === "table")
    }
    applyModeRef.current = applyMode
    const zoomUpdate = () => {
      const W = stage.clientWidth, H = stage.clientHeight
      const span = Math.max(1, zoom.offsetHeight - H)
      const p = Math.min(1, Math.max(0, (window.scrollY + 56 - zoom.offsetTop) / span))
      lastP = p
      const narrow = W < 900
      const s0 = Math.min((W * (narrow ? .88 : .52)) / WW, (H * .5) / WH)
      const S1 = Math.min((W * (narrow ? .92 : .53)) / TW, (H * .66) / TH)
      const S2 = Math.min((W * (narrow ? .94 : .6)) / EW, (H * .6) / EH)
      const t1 = ease(seg(p, .10, .42)), t2 = ease(seg(p, .56, .84))
      const s = lerp(lerp(s0, S1, t1), S2, t2)
      const cx = lerp(lerp(C0.x, C1.x, t1), C2.x, t2)
      const cy = lerp(lerp(C0.y, C1.y, t1), C2.y, t2)
      const shift = narrow ? 0 : 70 + (1 - t1) * 90
      const tx = W / 2 - shift - cx * s, ty = H / 2 + 14 - cy * s
      world.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${s.toFixed(4)})`
      const alt = p < .34 ? "deck" : p < .62 ? "slide" : "element"
      if (zoom.dataset.alt !== alt) {
        zoom.dataset.alt = alt
        cards.forEach((card) => {
          const visible = card.dataset.alt === alt
          card.classList.toggle("is-on", visible)
          card.inert = !visible
          card.setAttribute("aria-hidden", String(!visible))
        })
        labels.forEach((label) => label.classList.toggle("is-on", label.dataset.alt === alt))
      }
      if (lastAltRef.current !== alt) {
        lastAltRef.current = alt
        track("zoom_stop", { alt })
      }
      if (indicator) indicator.style.top = `${(p * 100).toFixed(1)}%`
      applyMode(p)
    }
    const onScroll = () => {
      if (raf !== null) return
      raf = requestAnimationFrame(() => { raf = null; zoomUpdate() })
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      if (raf !== null) cancelAnimationFrame(raf)
    }
  }, [])

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch") touchStartRef.current = { x: event.clientX, y: event.clientY }
  }
  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "touch") return
    const start = touchStartRef.current
    touchStartRef.current = null
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) return
    if ((event.target as HTMLElement).closest("a,button,input,textarea,select")) return
    snapToAdjacent(1)
  }

  return (
    <section ref={sectionRef} className="slide slide--night zoom" id="zoom" data-snap="slide" data-slide-label={copy.label} data-label={copy.label} data-chapter="Build" data-stops="0,0.5,0.96" data-alt="deck" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { touchStartRef.current = null }}>
      <div ref={stageRef} className="zoom__stage" data-chip-host>
        <div className="dots" />
        <div ref={worldRef} className="zoom__world">
          {copy.tiles.slice(0, 4).map((tile, index) => <Tile key={tile.slide} {...tile} alt={tileAlts[index]} />)}
          <div className="tile tile--target"><TargetSlide copy={copy.slide} /></div>
          {copy.tiles.slice(4).map((tile, index) => <Tile key={tile.slide} {...tile} alt={tileAlts[index + 4]} />)}
        </div>
        <div className="zoom__hud">
          <div className="zoom__head"><span className="eyebrow">{copy.eyebrow}</span><h2 className="h2">{copy.title}</h2></div>
          <div className="alt"><div className="alt__track"><div className="alt__ind" />
            {copy.altitudes.map((altitude) => <span key={altitude} className={`alt__lbl${altitude === "Deck" ? " is-on" : ""}`} data-alt={altitude.toLowerCase()}>{altitude}</span>)}
          </div></div>
          <div className="xchg">
            {copy.exchanges.map((exchange, index) => (
              <div className={`xchg__card${index === 0 ? " is-on" : ""}`} data-alt={exchange.altitude} key={exchange.altitude} inert={index !== 0} aria-hidden={index !== 0}>
                <div className="who"><i style={{ background: "var(--coral-d)" }} />{exchange.who}{"feature" in exchange && <span className={`st st--sm st--${slideStatus.status}`}>{slideStatus.word}</span>}</div>
                <span className="you">{exchange.request}</span>
                <span className="agent">{exchange.response}</span>
                {"action" in exchange ? (
                  <div className="act">
                    <button type="button" className="btn btn--you" onClick={() => { trackCta(ctaLocations[index]); snapToAdjacent(1) }}>{exchange.action}</button>
                    <Link className="btn btn--ghost" href={exchange.secondaryHref}>{exchange.secondary}</Link>
                  </div>
                ) : (
                  <div className="try" role="group" aria-label={exchange.tryLabel}>
                    <span className="try__k">{exchange.tryLabel}</span>
                    {copy.modes.map((item) => {
                      const pressed = (mode ?? "waterfall") === item.id
                      return <button type="button" key={item.id} aria-pressed={pressed} onClick={() => {
                        modeRef.current = item.id
                        setMode(item.id)
                        applyModeRef.current()
                        trackCta("v3_zoom_try", { mode: item.id })
                      }}>{item.label}</button>
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="zoom__foot">{copy.foot}</div>
        </div>
        <SlideChip number={n} total={total} label={copy.label} />
      </div>
    </section>
  )
}

function Tile({ slide, tag, alt }: { slide: number; tag: string; title: string; alt: string }) {
  return (
    <div className="tile">
      <img src={`/marketing/v3/slides/deck-${String(slide).padStart(2, "0")}.jpg`} alt={alt} width={1280} height={724} loading="lazy" decoding="async" />
      <span className="tile__tag">{tag}</span>
    </div>
  )
}
