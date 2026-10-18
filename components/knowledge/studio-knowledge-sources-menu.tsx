"use client"

import { useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import { ChevronDown, Database, Import, Loader2, RefreshCw, Settings } from "lucide-react"
import { nextMenuIndex, SOURCES_LABEL, sourcesButtonLabel, sourcesCount, sourcesMenuItems, type SourcesAction } from "@/lib/studio-knowledge-sources-menu"
import "./studio-knowledge-header-actions.css"

const ICONS = { import: Import, refresh: RefreshCw, settings: Settings } as const

/**
 * The Second Brain header's one "Sources" button (card PASS2-J6-FINDINGS, L5; rules in lib/studio-knowledge-sources-menu.ts). It holds what the header's three
 * buttons were: Import past sessions, Refresh, Knowledge settings. Shown only with NEXT_PUBLIC_STUDIO_KNOWLEDGE_HEADER_ACTIONS on. Opening it starts nothing.
 */
export function StudioKnowledgeSourcesMenu({ sessions, importing, loading, onImport, onRefresh, settingsHref }: {
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
  const itemRefs = useRef<Array<HTMLElement | null>>([])
  const menuId = useId()
  const items = sourcesMenuItems({ importing, loading })
  const enabled = items.flatMap((item, index) => (item.disabled ? [] : [index]))
  const count = sourcesCount(sessions)

  // Opening moves focus to the first item; a press outside the button or the menu closes it.
  useEffect(() => {
    if (!open) return
    itemRefs.current[enabled[0]]?.focus()
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener("pointerdown", outside)
    return () => document.removeEventListener("pointerdown", outside)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const choose = (action: SourcesAction) => { setOpen(false); if (action === "import") onImport(); else if (action === "refresh") onRefresh() }

  return (
    <div
      ref={root}
      data-studio-knowledge-sources="true"
      className="sksm"
      // Focus moving to something outside closes it. A blur with no target (Safari and Firefox on macOS do not focus a button that is clicked, so pressing an item blurs the focused one) does not:
      // a press outside is the pointerdown listener's, and closing here would unmount the item before its click.
      onBlur={event => { const next = event.relatedTarget as Node | null; if (open && next && !root.current?.contains(next)) setOpen(false) }}
    >
      <button
        ref={trigger}
        type="button"
        className="sksm-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={sourcesButtonLabel(sessions)}
        aria-busy={importing || undefined}
        onClick={() => setOpen(current => !current)}
        onKeyDown={event => { if (event.key === "ArrowDown" && !open) { event.preventDefault(); setOpen(true) } }}
      >
        {importing ? <Loader2 size={15} className="sksm-spin" aria-hidden="true" /> : <Database size={15} aria-hidden="true" />}
        <span>{SOURCES_LABEL}</span>
        {count !== null && <span className="sksm-count">{new Intl.NumberFormat().format(count)}</span>}
        <ChevronDown size={13} aria-hidden="true" />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={SOURCES_LABEL}
          className="sksm-panel"
          onKeyDown={event => {
            if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); return }
            const at = itemRefs.current.findIndex(element => element === document.activeElement)
            const next = nextMenuIndex(at, event.key, enabled)
            if (next !== null) { event.preventDefault(); itemRefs.current[next]?.focus() }
          }}
        >
          {items.map((item, index) => {
            const Icon = ICONS[item.action]
            const body = (
              <>
                <Icon size={15} aria-hidden="true" />
                <span><strong>{item.label}</strong><small>{item.hint}</small></span>
              </>
            )
            return item.action === "settings" ? (
              <Link key={item.action} ref={element => { itemRefs.current[index] = element }} href={settingsHref} role="menuitem" className="sksm-item" onClick={() => setOpen(false)}>{body}</Link>
            ) : (
              <button
                key={item.action}
                ref={element => { itemRefs.current[index] = element }}
                type="button"
                role="menuitem"
                className="sksm-item"
                disabled={item.disabled}
                onClick={() => choose(item.action)}
              >
                {body}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
