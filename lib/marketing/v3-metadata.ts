import type { Metadata } from "next"

const OG_IMAGE = { url: "/marketing/v3/og-image.jpg", width: 1200, height: 630, alt: "Deckster — Your knowledge. Your decks. Your voice." }

/** Per-page metadata for the v3 marketing pages: canonical, Open Graph and Twitter all point at the page itself. */
export function v3Metadata({ path, title, description }: { path: string; title: string; description: string }): Metadata {
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: "Deckster", url: path, title, description, images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE.url] },
  }
}
