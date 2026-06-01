import { INVENTORY_COUNTS } from "@/lib/marketing/homepage-v2-content"
import { AnimatedCounter } from "../shared/AnimatedCounter"

interface Tile {
  /** Numeric value for AnimatedCounter, or null when the value is unbounded. */
  value: number | null
  /** Symbol to render when value is null (e.g., "∞"). */
  symbol?: string
  label: string
  sublabel: string
}

const TILES: ReadonlyArray<Tile> = [
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
    sublabel: "Cloud, logical, data, kanban, gantt",
  },
  {
    value: null,
    symbol: "∞",
    label: "Infographics",
    sublabel: "Generated from anything you describe",
  },
]

export function InventoryCounters() {
  return (
    <ul className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
      {TILES.map((tile) => (
        <li
          key={tile.label}
          className="rounded-2xl border border-foreground/10 dark:border-white/10 bg-white dark:bg-white/[0.04] px-5 py-5 text-left shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="text-3xl font-extrabold tracking-tight text-primary sm:text-4xl">
            {tile.value !== null ? (
              <AnimatedCounter target={tile.value} />
            ) : (
              <span aria-label="Unlimited">{tile.symbol}</span>
            )}
          </div>
          <div className="mt-1 text-sm font-semibold text-foreground dark:text-white">
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
