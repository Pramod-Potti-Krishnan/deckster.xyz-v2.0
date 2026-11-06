"use client"

import { useEffect, useRef, type CSSProperties, type PointerEvent } from "react"
import Link from "next/link"
import { track } from "@vercel/analytics"
import { snapToAdjacent } from "@/components/marketing/SnapDeck/use-snap-navigation"
import { V3_CONTENT, showcaseAlt } from "@/lib/marketing/v3-content"
import { BuildCta } from "./BuildCta"
import { SlideChip } from "./SlideChip"

const WW = 992, WH = 572, TW = 320, TH = 180
const C0 = { x: WW / 2, y: WH / 2 }, C1 = { x: 496, y: 286 }, C2 = { x: 439.5, y: 306.5 }, EW = 185, EH = 98
const ease = (t: number) => t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const seg = (p: number, a: number, b: number) => Math.min(1, Math.max(0, (p - a) / (b - a)))

function TargetSlide() {
  const copy = V3_CONTENT.zoom.slide
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

const ctaLocations = ["v3_zoom_approve", "v3_zoom_keep", "v3_zoom_regenerate"] as const

export function ZoomBuild() {
  const sectionRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const lastAltRef = useRef<string>("deck")
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const copy = V3_CONTENT.zoom

  useEffect(() => {
    const zoom = sectionRef.current, stage = stageRef.current, world = worldRef.current
    if (!zoom || !stage || !world) return
    const zSlide = zoom.querySelector<HTMLElement>(".sl")
    const cards = zoom.querySelectorAll<HTMLElement>(".xchg__card")
    const labels = zoom.querySelectorAll<HTMLElement>(".alt__lbl")
    const indicator = zoom.querySelector<HTMLElement>(".alt__ind")
    let raf: number | null = null
    const zoomUpdate = () => {
      const W = stage.clientWidth, H = stage.clientHeight
      const span = Math.max(1, zoom.offsetHeight - H)
      const p = Math.min(1, Math.max(0, (window.scrollY + 56 - zoom.offsetTop) / span))
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
      zSlide?.classList.toggle("sl--waterfall", p > .86)
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
    <section ref={sectionRef} className="slide slide--night zoom" id="zoom" data-snap="slide" data-slide-label={copy.label} data-label={copy.label} data-stops="0,0.5,0.96" data-alt="deck" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { touchStartRef.current = null }}>
      <div ref={stageRef} className="zoom__stage" data-chip-host>
        <div className="dots" />
        <div ref={worldRef} className="zoom__world">
          {copy.tiles.slice(0, 4).map((tile) => <Tile key={tile.slide} {...tile} />)}
          <div className="tile tile--target"><TargetSlide /></div>
          {copy.tiles.slice(4).map((tile) => <Tile key={tile.slide} {...tile} />)}
        </div>
        <div className="zoom__hud">
          <div className="zoom__head"><span className="eyebrow">{copy.eyebrow}</span><h2 className="h2">{copy.title}</h2></div>
          <div className="alt"><div className="alt__track"><div className="alt__ind" />
            {copy.altitudes.map((altitude) => <span key={altitude} className={`alt__lbl${altitude === "Deck" ? " is-on" : ""}`} data-alt={altitude.toLowerCase()}>{altitude}</span>)}
          </div></div>
          <div className="xchg">
            {copy.exchanges.map((exchange, index) => (
              <div className={`xchg__card${index === 0 ? " is-on" : ""}`} data-alt={exchange.altitude} key={exchange.altitude} inert={index !== 0} aria-hidden={index !== 0}>
                <div className="who"><i style={{ background: "var(--coral-d)" }} />{exchange.who}</div>
                <span className="you">{exchange.request}</span>
                <span className="agent">{exchange.response}</span>
                <div className="act">
                  <BuildCta className="btn btn--you" location={ctaLocations[index]}>{exchange.action}</BuildCta>
                  <Link className="btn btn--ghost" href="/pricing">{exchange.secondary}</Link>
                </div>
              </div>
            ))}
          </div>
          <div className="zoom__foot">{copy.foot}</div>
        </div>
        <SlideChip number={2} label={copy.label} />
      </div>
    </section>
  )
}

function Tile({ slide, tag, title }: { slide: number; tag: string; title: string }) {
  return (
    <div className="tile">
      <img src={`/marketing/v3/slides/deck-${String(slide).padStart(2, "0")}.jpg`} alt={showcaseAlt(slide, title)} width={1280} height={724} />
      <span className="tile__tag">{tag}</span>
    </div>
  )
}
