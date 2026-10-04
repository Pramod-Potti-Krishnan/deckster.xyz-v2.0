import { readFile } from "node:fs/promises"
import { join } from "node:path"

/**
 * Social share card (og:image) for every page that doesn't set its own.
 * Serves the same art as the marketing pages (public/marketing/v3/og-image.jpg:
 * the hero line, two real slides and the L-B logo), so a shared link looks the
 * same wherever it points. Statically generated at build time via Next's
 * file-convention metadata route.
 */
export const alt = "Deckster — Your knowledge. Your decks. Your voice."
export const size = { width: 1200, height: 630 }
export const contentType = "image/jpeg"

export default async function OpengraphImage() {
  const image = await readFile(join(process.cwd(), "public/marketing/v3/og-image.jpg"))
  return new Response(image, { headers: { "Content-Type": contentType } })
}
