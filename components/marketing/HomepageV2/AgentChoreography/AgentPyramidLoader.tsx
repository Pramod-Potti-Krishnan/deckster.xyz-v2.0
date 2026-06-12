"use client"

import dynamic from "next/dynamic"

/**
 * Client-only dynamic imports for the heavy parts of the agents slide —
 * mirrors the BuilderDemoLoader pattern. The pyramid (framer-motion drag +
 * per-frame connector overlay) and the animated lightning grid load as
 * below-the-fold chunks; the section header stays server-rendered.
 *
 * `ssr: false` must live in a client component in App Router (Next 15).
 */
const AgentPyramid = dynamic(
  () => import("./AgentPyramid").then((m) => m.AgentPyramid),
  {
    ssr: false,
    loading: () => <AgentPyramidSkeleton />,
  },
)

const LightningGrid = dynamic(
  () =>
    import("./LightningGridBackground").then((m) => m.LightningGridBackground),
  { ssr: false },
)

export function AgentPyramidLoader() {
  return <AgentPyramid />
}

/** Background grid renders nothing until its chunk arrives — it's a purely
 *  decorative layer, so a late fade-in is fine. */
export function LightningGridLazy() {
  return <LightningGrid />
}

/** Static placeholder matching the pyramid's 1/3/4 card layout — same
 *  wrappers and gaps as the real rows, so no layout shift on hydrate. */
function AgentPyramidSkeleton() {
  return (
    <div
      aria-hidden
      className="relative mx-auto mt-6 flex max-w-6xl flex-col items-center gap-10 sm:mt-8 sm:gap-14"
    >
      {[1, 3, 4].map((count, row) => (
        <div
          key={row}
          className="relative z-10 flex w-full flex-wrap items-stretch justify-center gap-4 sm:gap-5"
        >
          {Array.from({ length: count }, (_, i) => (
            <div
              key={i}
              className="h-[120px] w-full max-w-[260px] flex-1 basis-[220px] rounded-2xl border border-white/10 bg-white/[0.04]"
            />
          ))}
        </div>
      ))}
    </div>
  )
}
