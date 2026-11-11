import type { Metadata } from "next"
import { notFound } from "next/navigation"

// NEXT_PUBLIC_MARKETING_V4 (default off): /build exists only in the v4 design. With the flag off this route is a 404, as it was before the page existed.
export const metadata: Metadata = process.env.NEXT_PUBLIC_MARKETING_V4 === "true"
  ? {
      title: { absolute: "Build — Deckster" },
      description: "Work with your Deckster agent three ways: talk to it, point at the slide, or hand the whole build over.",
      alternates: { canonical: "/build" },
    }
  : {}

export default async function BuildPage() {
  if (process.env.NEXT_PUBLIC_MARKETING_V4 !== "true") notFound()
  const { V4BuildPage } = await import("@/components/marketing/v4/pages/build")
  return <V4BuildPage />
}
