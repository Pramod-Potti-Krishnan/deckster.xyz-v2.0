"use client"

import { useEffect, useRef, type CSSProperties } from "react"

type Status = { status: string; word: string }

export type BringFlowCopy = {
  inputs: readonly { kind: string; name: string; detail: string }[]
  template: { title: string; detail: string; alt: string; note?: string }
  knowledgeAsset: { title: string; detail: string }
  themeAsset: { title: string; detail: string }
}

const FILE_GRADIENTS: Record<string, string> = {
  PPTX: "linear-gradient(160deg,#c2410c,#f97316)",
  PDF: "linear-gradient(160deg,#991b1b,#ef4444)",
  XLSX: "linear-gradient(160deg,#166534,#22c55e)",
  HEX: "linear-gradient(160deg,#16203a,#385b9d)",
}

const SWATCHES = ["#16203a", "#385b9d", "#e8a013", "#F1F4F9", "#8791A3"] as const

function Pill({ value, note }: { value: Status; note?: string }) {
  return <span className={`st st--${value.status}`}>{value.word}{note ? ` · ${note}` : ""}</span>
}

export function BringFlow({ copy, statuses }: { copy: BringFlowCopy; statuses: { template: Status; sources: Status; theme: Status } }) {
  const flowRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const flow = flowRef.current
    const svg = svgRef.current
    if (!flow || !svg) return

    let frame = 0
    let disposed = false
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const draw = () => {
      frame = 0
      const rect = flow.getBoundingClientRect()
      const center = (element: Element) => {
        const box = element.getBoundingClientRect()
        return {
          x: box.left - rect.left + box.width / 2,
          y: box.top - rect.top + box.height / 2,
          l: box.left - rect.left,
          r: box.right - rect.left,
        }
      }
      const coreElement = flow.querySelector(".core")
      if (!coreElement || rect.width === 0 || rect.height === 0) return
      const core = center(coreElement)
      const inputs = Array.from(flow.querySelectorAll(".file")).map(center)
      const outputs = Array.from(flow.querySelectorAll(".asset")).map(center)
      svg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`)
      const curve = (a: { x: number; y: number }, b: { x: number; y: number }) => {
        const mid = (a.x + b.x) / 2
        return `M${a.x},${a.y} C${mid},${a.y} ${mid},${b.y} ${b.x},${b.y}`
      }
      // Files travel into Deckster; templates, sources and themes travel out.
      const particle = (d: string, cls: string, i: number) => reducedMotion ? "" :
        `<circle class="pt ${cls}" r="3.2"><animateMotion dur="2.4s" begin="${(i * .55).toFixed(2)}s" repeatCount="indefinite" path="${d}"/></circle>`
      const ins = inputs.map((item) => curve({ x: item.r, y: item.y }, { x: core.x - 78, y: core.y }))
      const outs = outputs.map((item) => curve({ x: core.x + 78, y: core.y }, { x: item.l, y: item.y }))
      svg.innerHTML = ins.map((d) => `<path class="in" d="${d}"/>`).join("") + outs.map((d) => `<path class="out" d="${d}"/>`).join("")
        + ins.map((d, i) => particle(d, "in", i)).join("") + outs.map((d, i) => particle(d, "out", i + 3)).join("")
    }
    const schedule = () => {
      if (disposed) return
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(draw)
    }
    const observer = new ResizeObserver(schedule)
    observer.observe(flow)
    window.addEventListener("resize", schedule)
    window.addEventListener("load", schedule)
    void document.fonts.ready.then(schedule)
    schedule()
    return () => {
      disposed = true
      if (frame) cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener("resize", schedule)
      window.removeEventListener("load", schedule)
    }
  }, [])

  return (
    <div className="flow" data-reveal style={{ "--d": 3 } as CSSProperties} ref={flowRef}>
      <svg className="flow__svg" aria-hidden="true" ref={svgRef} />
      <div className="flow__col">
        {copy.inputs.map((file) => (
          <div className="file" key={file.name}>
            <div className="file__ic" style={{ background: FILE_GRADIENTS[file.kind] ?? FILE_GRADIENTS.PPTX }}>{file.kind}</div>
            <div><b>{file.name}</b><span>{file.detail}</span></div>
          </div>
        ))}
      </div>
      <div className="flow__core"><div className="core"><svg width="86" height="86" aria-hidden="true"><use href="#logo" /></svg></div></div>
      <div className="flow__col">
        <div className="asset">
          <div className="asset__thumb">
            <img src="/marketing/v3/slides/deck-04.jpg" alt={copy.template.alt} width={96} height={54} loading="lazy" decoding="async" />
            <i className="role" style={{ left: "3%", top: "8%", width: "60%", height: "12%" }} />
            <i className="role" style={{ left: "3%", top: "26%", width: "94%", height: "30%" }} />
            <i className="role" style={{ left: "3%", top: "60%", width: "94%", height: "28%" }} />
          </div>
          <div><b>{copy.template.title}</b><span>{copy.template.detail}</span><Pill value={statuses.template} note={copy.template.note} /></div>
        </div>
        <div className="asset">
          <svg className="mini-graph" viewBox="0 0 96 54" aria-hidden="true">
            <g stroke="#5B4DFF" strokeOpacity=".45" strokeWidth="1"><path d="M12 40L30 22L52 30L70 12L84 26M30 22L52 8M52 30L70 42" /></g>
            <g fill="#5B4DFF"><circle cx="12" cy="40" r="3" /><circle cx="52" cy="30" r="3" /><circle cx="70" cy="12" r="3" /><circle cx="84" cy="26" r="3" /><circle cx="52" cy="8" r="2.5" /><circle cx="70" cy="42" r="2.5" /></g>
            <circle cx="30" cy="22" r="4" fill="#F4502F" />
          </svg>
          <div><b>{copy.knowledgeAsset.title}</b><span>{copy.knowledgeAsset.detail}</span><Pill value={statuses.sources} /></div>
        </div>
        <div className="asset">
          <div className="swatches">{SWATCHES.map((color) => <i key={color} style={{ background: color }} />)}</div>
          <div><b>{copy.themeAsset.title}</b><span>{copy.themeAsset.detail}</span><Pill value={statuses.theme} /></div>
        </div>
      </div>
    </div>
  )
}
