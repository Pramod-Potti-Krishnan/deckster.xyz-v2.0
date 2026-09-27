"use client"

import { useEffect, useRef, type CSSProperties } from "react"

type GraphNode = {
  x: number
  y: number
  r: number
  yours: boolean
  born: number
  links: GraphNode[]
  dx: number
  dy: number
}

export type KnowledgeGraphCopy = {
  legend: { research: string; documents: string }
  stats: { decks: string; facts: string; sources: string }
}

export function KnowledgeGraphCanvas({ copy, style }: { copy: KnowledgeGraphCopy; style?: CSSProperties }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const decksRef = useRef<HTMLElement>(null)
  const factsRef = useRef<HTMLElement>(null)
  const sourcesRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext("2d")
    if (!canvas || !context) return

    const nodes: GraphNode[] = []
    const MAX = 110
    let width = 0
    let height = 0
    let dpr = 1
    let lastAdd = 0
    const start = performance.now()
    let frame = 0

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      dpr = Math.min(2, window.devicePixelRatio || 1)
      width = rect.width
      height = rect.height
      canvas.width = width * dpr
      canvas.height = height * dpr
    }
    const random = (min: number, max: number) => min + Math.random() * (max - min)
    const add = () => {
      const yours = nodes.length % 5 === 2
      const anchor = nodes.length > 4 ? nodes[Math.floor(Math.random() * nodes.length)] : null
      const x = anchor ? Math.min(width - 20, Math.max(20, anchor.x + random(-90, 90))) : random(width * .3, width * .7)
      const y = anchor ? Math.min(height - 60, Math.max(20, anchor.y + random(-70, 70))) : random(height * .3, height * .6)
      const node: GraphNode = { x, y, r: yours ? 4.2 : 3, yours, born: performance.now(), links: [], dx: 0, dy: 0 }
      if (anchor) node.links.push(anchor)
      nodes.filter((other) => other !== anchor && Math.hypot(other.x - x, other.y - y) < 80).slice(0, 2)
        .forEach((other) => node.links.push(other))
      nodes.push(node)
      if (decksRef.current) decksRef.current.textContent = String(Math.max(1, Math.round(nodes.length / 4.6)))
      if (factsRef.current) factsRef.current.textContent = (nodes.length * 11 + 60).toLocaleString()
      if (sourcesRef.current) sourcesRef.current.textContent = String(Math.max(1, Math.round(nodes.length / 1.15)))
    }
    const draw = (now: number) => {
      if (nodes.length < MAX && now - lastAdd > (nodes.length < 20 ? 160 : 420)) {
        add()
        lastAdd = now
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.clearRect(0, 0, width, height)
      const time = (now - start) / 1000
      nodes.forEach((node, index) => {
        node.dx = Math.sin(time * .6 + index) * 2.2
        node.dy = Math.cos(time * .5 + index * 1.3) * 2.2
      })
      context.lineWidth = 1
      nodes.forEach((node) => node.links.forEach((linked) => {
        const alpha = Math.min(1, (now - node.born) / 900)
        context.strokeStyle = node.yours || linked.yours
          ? `rgba(255,123,95,${.28 * alpha})`
          : `rgba(156,147,255,${.22 * alpha})`
        context.beginPath()
        context.moveTo(node.x + node.dx, node.y + node.dy)
        context.lineTo(linked.x + linked.dx, linked.y + linked.dy)
        context.stroke()
      }))
      nodes.forEach((node) => {
        const alpha = Math.min(1, (now - node.born) / 700)
        const radius = node.r * (.6 + .4 * alpha)
        context.fillStyle = node.yours ? `rgba(255,123,95,${alpha})` : `rgba(156,147,255,${.9 * alpha})`
        context.beginPath()
        context.arc(node.x + node.dx, node.y + node.dy, radius, 0, Math.PI * 2)
        context.fill()
        if (node.yours) {
          context.strokeStyle = `rgba(255,123,95,${.35 * alpha})`
          context.beginPath()
          context.arc(node.x + node.dx, node.y + node.dy, radius + 4, 0, Math.PI * 2)
          context.stroke()
        }
      })
      frame = requestAnimationFrame(draw)
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    window.addEventListener("resize", resize)
    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener("resize", resize)
    }
  }, [])

  return (
    <div className="kg" data-reveal style={style}>
      <canvas id="kg-canvas" ref={canvasRef} aria-hidden="true" />
      <div className="kg__legend">
        <span><i style={{ background: "#9C93FF" }} />{copy.legend.research}</span>
        <span><i style={{ background: "#FF7B5F" }} />{copy.legend.documents}</span>
      </div>
      <div className="kg__stats">
        <div><b data-kg="decks" ref={decksRef}>1</b><span>{copy.stats.decks}</span></div>
        <div><b data-kg="facts" ref={factsRef}>60</b><span>{copy.stats.facts}</span></div>
        <div><b data-kg="sources" ref={sourcesRef}>1</b><span>{copy.stats.sources}</span></div>
      </div>
    </div>
  )
}
