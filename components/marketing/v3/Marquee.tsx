import type { CSSProperties } from "react"

export type MarqueeChip = readonly [label: string, kind: "el" | "ch" | "dg" | "in" | "inf"]

function Chips({ chips }: { chips: readonly MarqueeChip[] }) {
  return <>{chips.map(([label, kind], index) => (
    <span className={`chip chip--${kind === "inf" ? "in chip--inf" : kind}`} key={`${label}-${index}`}><i />{label}</span>
  ))}</>
}

export function Marquee({ rows }: { rows: readonly (readonly MarqueeChip[])[] }) {
  return (
    <div className="marquee" data-reveal style={{ "--d": 4 } as CSSProperties}>
      {rows.map((row, index) => (
        <div className={`marquee__row${index === 1 ? " marquee__row--rev" : ""}`} style={index === 2 ? { animationDuration: "80s" } : undefined} key={index}>
          <Chips chips={row} />
          <span aria-hidden="true" style={{ display: "contents" }}><Chips chips={row} /></span>
        </div>
      ))}
    </div>
  )
}
