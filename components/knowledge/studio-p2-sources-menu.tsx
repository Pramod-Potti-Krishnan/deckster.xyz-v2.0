"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import { ChevronDown, Import, Loader2, Plug, RefreshCw, Settings, X } from "lucide-react"
import { SOURCES_LABEL, sourcesButtonLabel, sourcesCount, sourcesMenuItems, type SourcesAction } from "@/lib/studio-knowledge-sources-menu"
import { STUDIO_SB_WORDS } from "@/lib/studio-p2-second-brain"
import { useStudioP2Sources } from "@/hooks/use-studio-p2-sources"
import { StudioP2SourcesList, StudioP2SourcesUpload } from "./studio-p2-sources-parts"
import "./studio-knowledge-header-actions.css"
import "./studio-p2-second-brain.css"

const ICONS = { import: Import, refresh: RefreshCw, settings: Settings } as const

/**
 * The Second Brain header's ONE "Sources" control when both NEXT_PUBLIC_STUDIO_KNOWLEDGE_HEADER_ACTIONS (J6 L5: the menu of Import past sessions / Refresh / Knowledge settings,
 * StudioKnowledgeSourcesMenu) and NEXT_PUBLIC_STUDIO_P2_SECOND_BRAIN (SB-02: the read-only list of the sources the graph's evidence names, StudioP2Sources) are on. Each flag alone
 * renders its own component as before; the page renders this one only when both are on, so the header never shows two Sources buttons.
 *
 * It is the mock's popover (title, close, the sources, "Add a file or link") with the maintenance actions the header-actions menu carried below it, one button above both: the
 * trigger, its number (the deck sessions that contribute knowledge, there at rest) and the three actions with their busy rules are the menu's own (lib/studio-knowledge-sources-menu.ts);
 * the list and its read are the popover's (hooks/use-studio-p2-sources.ts, studio-p2-sources-parts.tsx). A panel that shows read-only rows is a disclosure, not role="menu" (a menu
 * may hold nothing but items), so Tab moves through it, Escape or a press outside closes it, and nothing is read before it is first opened.
 */
export function StudioP2SourcesMenu({ entities, sessions, importing, loading, onImport, onRefresh, settingsHref }: {
  /** The graph's most reinforced entities (stats.top_entities): the evidence behind them is what the list reads. */
  entities: ReadonlyArray<{ node_id: string }>
  /** stats.sessions_consolidated, or undefined until the stats are loaded. */
  sessions: number | undefined
  importing: boolean
  loading: boolean
  onImport: () => void
  onRefresh: () => void
  settingsHref: string
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const { phase, sources, failed, retry } = useStudioP2Sources(entities, open)
  const items = sourcesMenuItems({ importing, loading })
  const count = sourcesCount(sessions)

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false)
    if (returnFocus) trigger.current?.focus()
  }, [])

  // Escape closes and hands focus back to the button; a press outside the control closes without moving focus.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(true) }
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) close(false) }
    document.addEventListener("keydown", onKey)
    document.addEventListener("pointerdown", outside)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("pointerdown", outside)
    }
  }, [open, close])

  const choose = (action: SourcesAction) => { setOpen(false); if (action === "import") onImport(); else if (action === "refresh") onRefresh() }

  return (
    <div
      ref={root}
      data-studio-knowledge-sources="true"
      data-studio-p2-sources="true"
      data-studio-p2-sources-menu="true"
      className="sksm"
      // Focus moving to something outside closes it. A blur with no target (Safari and Firefox on macOS do not focus a button that is clicked, so pressing an item blurs the focused one) does not:
      // a press outside is the pointerdown listener's, and closing here would unmount the item before its click.
      onBlur={event => { const next = event.relatedTarget as Node | null; if (open && next && !root.current?.contains(next)) setOpen(false) }}
    >
      <button
        ref={trigger}
        type="button"
        className="sksm-trigger"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={sourcesButtonLabel(sessions)}
        aria-busy={importing || undefined}
        onClick={() => setOpen(current => !current)}
      >
        {importing ? <Loader2 size={15} className="sksm-spin" aria-hidden="true" /> : <Plug size={15} aria-hidden="true" />}
        <span>{SOURCES_LABEL}</span>
        {count !== null && <span className="sksm-count">{new Intl.NumberFormat().format(count)}</span>}
        <ChevronDown size={13} aria-hidden="true" />
      </button>
      {open && (
        <section id={panelId} data-studio-p2-sources-panel="true" aria-label={STUDIO_SB_WORDS.sourcesTitle}>
          <header>
            <h2>{STUDIO_SB_WORDS.sourcesTitle}</h2>
            <button type="button" aria-label={STUDIO_SB_WORDS.sourcesClose} onClick={() => close(true)}><X className="h-4 w-4" /></button>
          </header>
          <div data-studio-p2-sources-body="true">
            <StudioP2SourcesList phase={phase} sources={sources} failed={failed} onRetry={retry} />
          </div>
          <StudioP2SourcesUpload />
          <div role="group" aria-label={STUDIO_SB_WORDS.sourcesActions} data-studio-p2-sources-actions="true">
            {items.map(item => {
              const Icon = ICONS[item.action]
              const body = (
                <>
                  <Icon size={15} aria-hidden="true" />
                  <span><strong>{item.label}</strong><small>{item.hint}</small></span>
                </>
              )
              return item.action === "settings" ? (
                <Link key={item.action} href={settingsHref} onClick={() => setOpen(false)}>{body}</Link>
              ) : (
                <button key={item.action} type="button" disabled={item.disabled} onClick={() => choose(item.action)}>{body}</button>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
