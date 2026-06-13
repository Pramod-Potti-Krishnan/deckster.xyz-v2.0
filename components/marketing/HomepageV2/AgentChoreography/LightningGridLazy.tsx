"use client"

import dynamic from "next/dynamic"

/**
 * Client-only lazy import of the animated grid background. It's a purely
 * decorative layer, so a late fade-in is fine and it never blocks the
 * server-rendered constellation above it.
 *
 * `ssr: false` must live in a client component in App Router (Next 15).
 */
const LightningGrid = dynamic(
  () =>
    import("./LightningGridBackground").then((m) => m.LightningGridBackground),
  { ssr: false },
)

export function LightningGridLazy() {
  return <LightningGrid />
}
