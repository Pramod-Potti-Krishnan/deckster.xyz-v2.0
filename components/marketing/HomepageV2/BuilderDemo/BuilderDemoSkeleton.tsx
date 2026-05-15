import { BUILDER_DEMO_MIN_HEIGHT } from "./BuilderDemo"

/** Static skeleton matching BuilderDemo's bounding box. Renders during SSR
 *  and while the dynamic chunk loads — prevents layout shift. */
export function BuilderDemoSkeleton() {
  return (
    <div
      aria-hidden
      className="grid w-full grid-cols-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-5"
      style={{ minHeight: BUILDER_DEMO_MIN_HEIGHT }}
    >
      <div className="min-h-[320px] rounded-xl border border-white/10 bg-black/30 lg:min-h-0" />
      <div className="flex min-h-0 flex-col gap-3">
        <div className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-black/30">
          <div className="w-full pt-[56.25%]" />
        </div>
        <div className="h-10 rounded-xl border border-white/10 bg-black/30" />
      </div>
    </div>
  )
}
