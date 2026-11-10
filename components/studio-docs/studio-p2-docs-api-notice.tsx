import { STUDIO_DOCS_WORDS as W } from "@/lib/studio-p2-docs"
import "./studio-p2-docs.css"

// PASS2 Docs (NEXT_PUBLIC_STUDIO_P2_DOCS): /docs/api documents an API this product does not have yet (no key screen, no /v1 endpoint), so the page says so under the site's header and the rules in
// studio-p2-docs.css mute everything after the notice down to the footer. The page's words and markup are not changed.
export function StudioApiNotice() {
  return (
    <div className="sd-api-notice container mx-auto px-4" role="note" aria-labelledby="sd-api-notice-title">
      <div className="sd-api-notice__box">
        <p id="sd-api-notice-title" className="sd-api-notice__title">{W.apiNoticeTitle}</p>
        <p className="sd-api-notice__text">{W.apiNoticeBody}</p>
      </div>
    </div>
  )
}
