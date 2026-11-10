"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { ChevronDown, Plug, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { STUDIO_SB_WORDS } from "@/lib/studio-p2-second-brain"
import { useStudioP2Sources } from "@/hooks/use-studio-p2-sources"
import { StudioP2SourcesList, StudioP2SourcesUpload } from "./studio-p2-sources-parts"
import "./studio-p2-second-brain.css"

// PASS2 SB-02 (NEXT_PUBLIC_STUDIO_P2_SECOND_BRAIN): the mockup's "Sources" button, made honest. Read only: the sources the graph's own evidence names, taken from the node-detail
// reads of the most reinforced entities (GET /api/knowledge-graph/nodes/<id>, the same read the inspector makes), and a link to where uploads really live. No connections, no
// "This Mac", no Include / Remove: nothing here writes. Reads only after it is first opened (hooks/use-studio-p2-sources.ts). With NEXT_PUBLIC_STUDIO_KNOWLEDGE_HEADER_ACTIONS also on the page
// renders StudioP2SourcesMenu instead, so the header has one Sources control, not two.

export function StudioP2Sources({ entities }: { entities: ReadonlyArray<{ node_id: string }> }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const panelId = useId()
  const { phase, sources, failed, retry } = useStudioP2Sources(entities, open)

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false)
    if (returnFocus) buttonRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(true) }
    const onPress = (event: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(event.target as Node)) close(false) }
    document.addEventListener("keydown", onKey)
    document.addEventListener("mousedown", onPress)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("mousedown", onPress)
    }
  }, [open, close])

  const showCount = phase === "ready" && failed === 0
  return (
    <div ref={rootRef} data-studio-p2-sources="true">
      <Button ref={buttonRef} variant="outline" aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => setOpen(current => !current)}>
        <Plug className="mr-2 h-4 w-4" />{STUDIO_SB_WORDS.sources}{showCount && <span data-studio-p2-sources-count="true">{sources.length}</span>}<ChevronDown className="ml-2 h-3.5 w-3.5" />
      </Button>
      {open && (
        <section id={panelId} data-studio-p2-sources-panel="true" aria-label={STUDIO_SB_WORDS.sourcesTitle}>
          <header>
            <h2>{STUDIO_SB_WORDS.sourcesTitle}</h2>
            <button type="button" aria-label={STUDIO_SB_WORDS.sourcesClose} onClick={() => close(true)}><X className="h-4 w-4" /></button>
          </header>
          <StudioP2SourcesList phase={phase} sources={sources} failed={failed} onRetry={retry} />
          <StudioP2SourcesUpload />
        </section>
      )}
    </div>
  )
}
