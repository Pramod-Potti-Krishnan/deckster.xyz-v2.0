"use client"

import Link from "next/link"
import { FileText, Loader2 } from "lucide-react"
import { STUDIO_SB_UPLOAD_HREF, STUDIO_SB_WORDS, studioPassagesText } from "@/lib/studio-p2-second-brain"
import type { StudioSourcesRead } from "@/hooks/use-studio-p2-sources"

// PASS2 SB-02 (NEXT_PUBLIC_STUDIO_P2_SECOND_BRAIN): the two pieces of the read-only Sources panel that both homes share, the stand-alone popover (StudioP2Sources) and the header menu
// that holds it with Import / Refresh / Settings (StudioP2SourcesMenu, both flags on). Markup only, no state; each piece is a fragment, so a panel's own children are exactly these.

/** The reading state, the empty note, the sources and the partial-read note, from one read of the evidence. */
export function StudioP2SourcesList({ phase, sources, failed, onRetry }: Pick<StudioSourcesRead, "phase" | "sources" | "failed"> & { onRetry: () => void }) {
  return (
    <>
      {phase !== "ready" && <p role="status" data-studio-p2-sources-state="loading"><Loader2 className="h-3.5 w-3.5 animate-spin" />{STUDIO_SB_WORDS.sourcesLoading}</p>}
      {phase === "ready" && sources.length === 0 && <p data-studio-p2-sources-state="empty">{STUDIO_SB_WORDS.sourcesEmpty}</p>}
      {phase === "ready" && sources.length > 0 && (
        <ul>
          {sources.map(source => (
            <li key={source.key} data-studio-p2-source="true">
              <FileText className="h-4 w-4" />
              <span><strong>{source.name}</strong><small>{source.kind} · {studioPassagesText(source.passages)}</small></span>
            </li>
          ))}
        </ul>
      )}
      {phase === "ready" && failed > 0 && (
        <p data-studio-p2-sources-state="partial" role="status">{STUDIO_SB_WORDS.sourcesPartial} <button type="button" onClick={onRetry}>{STUDIO_SB_WORDS.sourcesRetry}</button></p>
      )}
    </>
  )
}

/** Where uploads really live: a link to a fresh Studio session and the plain statement that nothing is added from this page. */
export function StudioP2SourcesUpload() {
  return (
    <footer>
      <Link href={STUDIO_SB_UPLOAD_HREF} data-studio-p2-sources-upload="true">{STUDIO_SB_WORDS.upload}</Link>
      <small>{STUDIO_SB_WORDS.uploadHint}</small>
    </footer>
  )
}
