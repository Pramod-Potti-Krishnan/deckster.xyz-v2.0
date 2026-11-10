import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

/**
 * Social share card (og:image), statically generated at build time via
 * Next's file-convention metadata route. Echoes the hero's dark mesh:
 * near-black canvas with purple/cyan/pink radial blooms and the brand
 * gradient on the closing headline line.
 */
// NEXT_PUBLIC_STUDIO_UAT_MARKETING (default off): with the flag on the card is UAT's (public/marketing/v3/og-image.jpg: the hero line, two real slides and the L-B logo). Off: the generated card below, as it was.
const STUDIO_UAT_MARKETING = process.env.NEXT_PUBLIC_STUDIO_UAT_MARKETING === "true"
export const alt = STUDIO_UAT_MARKETING ? "Deckster — Your knowledge. Your decks. Your voice." : "Deckster — A team of AI agents builds your deck"
export const size = { width: 1200, height: 630 }
export const contentType = STUDIO_UAT_MARKETING ? "image/jpeg" : "image/png"

export default async function OpengraphImage() {
  if (STUDIO_UAT_MARKETING) {
    const image = await readFile(join(process.cwd(), "public/marketing/v3/og-image.jpg"))
    return new Response(image, { headers: { "Content-Type": contentType } })
  }
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          backgroundColor: "hsl(240, 10%, 4%)",
          backgroundImage: [
            "radial-gradient(ellipse 720px 480px at 18% 0%, hsla(280, 90%, 45%, 0.50), transparent 70%)",
            "radial-gradient(ellipse 720px 480px at 100% 100%, hsla(200, 95%, 50%, 0.40), transparent 70%)",
            "radial-gradient(ellipse 600px 400px at 0% 100%, hsla(320, 85%, 55%, 0.30), transparent 70%)",
          ].join(", "),
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            color: "white",
            fontSize: 38,
            fontWeight: 700,
            letterSpacing: -1,
          }}
        >
          Deckster
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              color: "white",
              fontSize: 72,
              fontWeight: 700,
              letterSpacing: -2,
              lineHeight: 1.1,
            }}
          >
            A team of AI agents
          </div>
          <div
            style={{
              color: "white",
              fontSize: 72,
              fontWeight: 700,
              letterSpacing: -2,
              lineHeight: 1.1,
            }}
          >
            builds your deck.
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 44,
              fontWeight: 700,
              letterSpacing: -1,
              lineHeight: 1.15,
              backgroundImage:
                "linear-gradient(90deg, #a78bfa 0%, #f472b6 50%, #22d3ee 100%)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            You direct them — one sentence at a time.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            color: "rgba(255, 255, 255, 0.6)",
            fontSize: 28,
            fontWeight: 500,
          }}
        >
          deckster.xyz
        </div>
      </div>
    ),
    { ...size },
  )
}
