"use client"

import dynamic from "next/dynamic"
import { BuilderDemoSkeleton } from "./BuilderDemoSkeleton"

/**
 * Client-only dynamic import for the heavy BuilderDemo. Server-renders the
 * skeleton (matching bounding box → no CLS); the real component hydrates
 * on the client.
 *
 * `ssr: false` must live in a client component in App Router (Next 15).
 */
const BuilderDemo = dynamic(
  () => import("./BuilderDemo").then((m) => m.BuilderDemo),
  {
    ssr: false,
    loading: () => <BuilderDemoSkeleton />,
  },
)

export function BuilderDemoLoader() {
  return <BuilderDemo />
}
