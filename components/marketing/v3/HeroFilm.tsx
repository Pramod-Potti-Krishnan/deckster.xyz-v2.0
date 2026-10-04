"use client"

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"

export interface HeroFilmCopy {
  steps: readonly string[]
  brief: string
  files: readonly string[]
  planWho: string
  plan: string
  approve: string
  change: string
  building: string
  of: string
  request: string
  working: string
  agent: string
  bold: string
  tail: string
  url: string
  published: string
  narrating: string
  voice: string
  askWho: string
  ask: string
  answerWho: string
  answer: string
  source: string
}

type Scene = 0 | 1 | 2 | 3 | 4 | 5 // brief, plan, build, refine, publish, present
type Camera = "deck" | "slide" | "element" | "present"

// The world is the same 3×3 deck as the scroll zoom (slide 2): 320×180 tiles, 16 px gaps.
const WW = 992, WH = 572, TW = 320, TH = 180, EW = 185, EH = 98
// "present" frames the top-middle slide (the five-step model) full screen, as a published deck plays.
const CENTER = { deck: { x: WW / 2, y: WH / 2 }, slide: { x: 496, y: 286 }, element: { x: 439.5, y: 306.5 }, present: { x: 496, y: 90 } }
const ORDER = [0, 1, 2, 3, 5, 6, 7, 8, 4] // build order: the crisp centre slide lands last
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * The hero's film: brief → plan → build → refine (zoom into one chart) → publish, on a loop.
 * Explains the product without a scroll. Runs only while on screen; reduced-motion visitors get
 * the finished frame (deck built, chart refined, link published).
 */
export function HeroFilm({ copy, tiles, target, youLabel, statusWord, betaWord }: {
  copy: HeroFilmCopy
  tiles: readonly { src: string; alt: string }[]
  target: ReactNode
  youLabel: string
  statusWord: string
  betaWord: string
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 640, h: 400 })
  const [scene, setScene] = useState<Scene>(4)
  const [brief, setBrief] = useState(copy.brief)
  const [files, setFiles] = useState(copy.files.length)
  const [approved, setApproved] = useState(true)
  const [built, setBuilt] = useState(9)
  const [camera, setCamera] = useState<Camera>("deck")
  const [request, setRequest] = useState(copy.request)
  const [agent, setAgent] = useState<"hidden" | "working" | "done">("hidden")
  const [waterfall, setWaterfall] = useState(true)
  const [published, setPublished] = useState(true)
  const [qa, setQa] = useState(0) // 0 none, 1 question, 2 answer

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const observer = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }))
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  // The chart morph reuses the scroll zoom's waterfall styles on the crisp slide.
  useEffect(() => {
    frameRef.current?.querySelector(".sl")?.classList.toggle("sl--waterfall", waterfall)
  }, [waterfall])

  const reset = useCallback(() => {
    setScene(0); setBrief(""); setFiles(0); setApproved(false); setBuilt(0)
    setCamera("deck"); setRequest(""); setAgent("hidden"); setWaterfall(false); setPublished(false); setQa(0)
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let visible = false
    let cancelled = false
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting }, { threshold: .35 })
    io.observe(root)
    const type = async (text: string, set: (value: string) => void, speed: number) => {
      for (let i = 1; i <= text.length && !cancelled; i++) { set(text.slice(0, i)); await wait(speed) }
    }
    const run = async () => {
      await wait(700)
      while (!cancelled) {
        if (!visible) { await wait(300); continue }
        reset()
        await wait(500)
        await type(copy.brief, setBrief, 24)
        for (let i = 1; i <= copy.files.length; i++) { await wait(320); setFiles(i) }
        await wait(700)
        setScene(1)
        await wait(1500)
        setApproved(true)
        await wait(800)
        setScene(2)
        for (let i = 1; i <= 9; i++) { await wait(170); setBuilt(i) }
        await wait(900)
        setScene(3)
        setCamera("slide")
        await wait(1700)
        setCamera("element")
        await wait(1300)
        await type(copy.request, setRequest, 34)
        await wait(250)
        setAgent("working")
        await wait(1200)
        setWaterfall(true)
        setAgent("done")
        await wait(2600)
        setScene(4)
        setAgent("hidden")
        setCamera("deck")
        await wait(1200)
        setPublished(true)
        await wait(2200)
        // the published deck presents itself and takes a question (beta)
        setScene(5)
        setCamera("present")
        await wait(1900)
        setQa(1)
        await wait(1500)
        setQa(2)
        await wait(3600)
      }
    }
    void run()
    return () => { cancelled = true; io.disconnect() }
  }, [copy, reset])

  const W = size.w, H = size.h
  const scale = {
    deck: Math.min((W * .9) / WW, (H * .84) / WH),
    slide: Math.min((W * .9) / TW, (H * .86) / TH),
    present: Math.min((W * .98) / TW, (H * .98) / TH),
    element: Math.min((W * .88) / EW, (H * .74) / EH),
  }[camera]
  const c = CENTER[camera]
  const worldStyle = { transform: `translate(${(W / 2 - c.x * scale).toFixed(1)}px, ${(H / 2 - c.y * scale).toFixed(1)}px) scale(${scale.toFixed(4)})` }
  const tileFor = (index: number) => (index === 4 ? null : tiles[index < 4 ? index : index - 1])

  return (
    <div className="film" ref={rootRef} data-reveal style={{ "--d": 2 } as CSSProperties} data-alt={camera} data-scene={scene}>
      <div className="film__frame" ref={frameRef}>
        <div className="film__world" style={worldStyle}>
          {Array.from({ length: 9 }, (_, index) => {
            const tile = tileFor(index)
            const isBuilt = ORDER.indexOf(index) < built
            return (
              <div key={index} className={`tile${index === 4 ? " tile--target" : ""}${isBuilt ? " is-built" : ""}`}>
                {tile ? <img src={tile.src} alt={tile.alt} width={1280} height={724} /> : target}
              </div>
            )
          })}
        </div>

        <div className={`film__brief${scene <= 1 ? " is-on" : ""}`} aria-hidden={scene > 1}>
          <div className="film__msg film__msg--you">
            <span className="k">{youLabel}</span>
            <span className="you">{brief}{scene === 0 && <i className="caret" />}</span>
            <div className="film__files">{copy.files.slice(0, files).map((file) => <span key={file}>{file}</span>)}</div>
          </div>
          <div className={`film__msg film__msg--agent${scene === 1 ? " is-on" : ""}`}>
            <span className="k">{copy.planWho}</span>
            <span>{copy.plan}</span>
            <div className="film__act">
              <span className={`film__btn film__btn--yes${approved ? " is-pressed" : ""}`}>{copy.approve}</span>
              <span className="film__btn">{copy.change}</span>
            </div>
            <svg className={`film__cursor${scene === 1 ? " is-on" : ""}${approved ? " is-click" : ""}`} viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3l7 17 2.5-6.5L20 11z" fill="currentColor" /></svg>
          </div>
        </div>

        <div className={`film__hud${scene === 2 ? " is-on" : ""}`}>{copy.building} {Math.max(1, Math.round(built * 16 / 9))} {copy.of}<i style={{ transform: `scaleX(${built / 9})` }} /></div>

        <div className={`film__you${scene === 3 && request ? " is-on" : ""}`}>
          <svg className="cur" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3l7 17 2.5-6.5L20 11z" fill="currentColor" /></svg>
          <div><span className="k">{youLabel}</span><span className="you">{request}</span></div>
        </div>
        <div className={`film__agent${agent !== "hidden" ? " is-on" : ""}`}>
          {agent === "working"
            ? <>{copy.working}<span className="dots" aria-hidden="true"><i /><i /><i /></span></>
            : <>{copy.agent}<b>{copy.bold}</b>{copy.tail}</>}
        </div>

        <div className={`film__present${scene === 5 ? " is-on" : ""}`}>
          <div className="film__qa">
            <div className={`film__q${qa >= 1 ? " is-on" : ""}`}><span className="k">{copy.askWho}</span>{copy.ask}</div>
            <div className={`film__a${qa >= 2 ? " is-on" : ""}`}><span className="k">{copy.answerWho}</span>{copy.answer}<span className="film__src">{copy.source}</span></div>
          </div>
          <div className="film__narr">
            <span className="play" aria-hidden="true"><svg width="10" height="12" viewBox="0 0 12 14"><path d="M0 0l12 7-12 7z" fill="currentColor" /></svg></span>
            <span className="film__wave" aria-hidden="true">{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ ["--i" as string]: i }} />)}</span>
            <span>{copy.narrating}</span>
            <span className="st st--beta st--sm">{betaWord}</span>
          </div>
        </div>

        <div className={`film__link${published && scene === 4 ? " is-on" : ""}`}>
          <span className="dots-3" aria-hidden="true"><i /><i /><i /></span>{copy.url}<span className="st st--live st--sm">{statusWord}</span>
        </div>
      </div>
      <ol className="film__steps" aria-label="How Deckster works">
        {copy.steps.map((step, index) => <li key={step} className={index === scene ? "is-on" : index < scene ? "is-done" : undefined}>{step}</li>)}
      </ol>
    </div>
  )
}
