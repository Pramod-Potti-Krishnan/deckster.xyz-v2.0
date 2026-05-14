import { INVENTORY_COUNTS } from "@/lib/marketing/homepage-v2-content"
import { AnimatedCounter } from "../shared/AnimatedCounter"

const TILES: ReadonlyArray<{
  value: number
  label: string
  sublabel: string
}> = [
  {
    value: INVENTORY_COUNTS.elements,
    label: "Element types",
    sublabel: "Text, metrics, tables, images & more",
  },
  {
    value: INVENTORY_COUNTS.charts,
    label: "Chart variants",
    sublabel: "From bar to Sankey to choropleth",
  },
  {
    value: INVENTORY_COUNTS.diagrams,
    label: "Diagram patterns",
    sublabel: "Cycle, pyramid, funnel, network",
  },
  {
    value: INVENTORY_COUNTS.infographics,
    label: "Infographic templates",
    sublabel: "Comparison, statistics, roadmap",
  },
]

export function InventoryCounters() {
  return (
    <ul className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
      {TILES.map((tile) => (
        <li
          key={tile.label}
          className="rounded-2xl border border-foreground/10 bg-white px-5 py-5 text-left shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="text-3xl font-extrabold tracking-tight text-primary sm:text-4xl">
            <AnimatedCounter target={tile.value} />
          </div>
          <div className="mt-1 text-sm font-semibold text-foreground">
            {tile.label}
          </div>
          <div className="mt-1 text-[11px] leading-snug text-muted-foreground">
            {tile.sublabel}
          </div>
        </li>
      ))}
    </ul>
  )
}
