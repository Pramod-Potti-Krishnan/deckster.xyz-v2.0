import type { ReactNode } from "react"
import "./studio-p2-docs.css"

// PASS2 Docs (NEXT_PUBLIC_STUDIO_P2_DOCS): the marker the page's tokens and rules hang on. It adds no element but this one; the page inside keeps the site's own header and footer.
export function StudioDocsFrame({ area, children }: { area: "docs" | "legal" | "agents"; children: ReactNode }) {
  return <div data-studio-p2-docs={area}>{children}</div>
}
