"use client"

import { useEffect, useState, type CSSProperties } from "react"

export function Waveform({ count = 40 }: { count?: number }) {
  const [heights, setHeights] = useState<number[]>([])

  useEffect(() => {
    setHeights(Array.from({ length: count }, () => 15 + Math.round(Math.random() * 65)))
  }, [count])

  return (
    <span className="wave" data-wave={count} aria-hidden="true">
      {heights.map((height, index) => <i key={index} style={{ "--i": index, "--a": height } as CSSProperties} />)}
    </span>
  )
}
