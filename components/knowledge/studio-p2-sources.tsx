"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import { ChevronDown, FileText, Loader2, Plug, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  STUDIO_SB_MAX_SOURCE_ENTITIES, STUDIO_SB_UPLOAD_HREF, STUDIO_SB_WORDS, studioAggregateSources, studioPassagesText, type StudioSource,
} from "@/lib/studio-p2-second-brain"
import "./studio-p2-second-brain.css"

// PASS2 SB-02 (NEXT_PUBLIC_STUDIO_P2_SECOND_BRAIN): the mockup's "Sources" button, made honest. Read only: the sources the graph's own evidence names, taken from the node-detail
// reads of the most reinforced entities (GET /api/knowledge-graph/nodes/<id>, the same read the inspector makes), and a link to where uploads really live. No connections, no
// "This Mac", no Include / Remove: nothing here writes. Reads only after it is first opened.
type Phase = "idle" | "loading" | "ready"

export function StudioP2Sources({ entities }: { entities: ReadonlyArray<{ node_id: string }> }) {
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>("idle")
  const [sources, setSources] = useState<StudioSource[]>([])
  const [failed, setFailed] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const startedRef = useRef(-1)
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)
  const panelId = useId()
  const ids = entities.slice(0, STUDIO_SB_MAX_SOURCE_ENTITIES).map(entity => entity.node_id).filter(Boolean)
  const idsKey = ids.join("|")

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  // The list belongs to the entities it was read for: a refreshed graph with other top entities reads again the next time the panel is open.
  useEffect(() => {
    startedRef.current = -1
    setPhase("idle")
  }, [idsKey])

  useEffect(() => {
    if (!open || startedRef.current === attempt) return
    startedRef.current = attempt
    const controller = new AbortController()
    abortRef.current?.abort()
    abortRef.current = controller
    setPhase("loading")
    void (async () => {
      const details: unknown[] = []
      let unreadable = 0
      await Promise.all(ids.map(async id => {
        try {
          const response = await fetch(`/api/knowledge-graph/nodes/${encodeURIComponent(id)}`, { signal: controller.signal })
          if (!response.ok) throw new Error("unreadable")
          details.push(await response.json())
        } catch {
          unreadable += 1
        }
      }))
      if (!mountedRef.current || controller.signal.aborted) return
      setSources(studioAggregateSources(details))
      setFailed(unreadable)
      setPhase("ready")
    })()
  }, [open, attempt, idsKey])

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
            <p data-studio-p2-sources-state="partial" role="status">{STUDIO_SB_WORDS.sourcesPartial} <button type="button" onClick={() => setAttempt(current => current + 1)}>{STUDIO_SB_WORDS.sourcesRetry}</button></p>
          )}
          <footer>
            <Link href={STUDIO_SB_UPLOAD_HREF} data-studio-p2-sources-upload="true">{STUDIO_SB_WORDS.upload}</Link>
            <small>{STUDIO_SB_WORDS.uploadHint}</small>
          </footer>
        </section>
      )}
    </div>
  )
}
