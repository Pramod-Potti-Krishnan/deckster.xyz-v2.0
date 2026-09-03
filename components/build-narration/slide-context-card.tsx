"use client"

import React from 'react'
import { BookOpenCheck, CircleAlert, CircleHelp } from 'lucide-react'
import type { SlideContextItem } from '@/hooks/use-deckster-websocket-v2'

/**
 * Canvas v2 R3 — "what research went into this": a compact strip for the slide
 * currently on stage, fed by slide_context (narrative_role, key_message,
 * evidence readiness). Styling mirrors chat's strawman EvidenceBadge
 * (message-list.tsx) — deliberately duplicated, not extracted, to keep the
 * flag-off diff at zero; dedup is a follow-up.
 */
export function SlideContextCard({
  context,
  slideIndex,
  className,
}: {
  context: SlideContextItem | null | undefined
  slideIndex: number | null
  className?: string
}) {
  if (slideIndex === null || !context) return null
  const role = (context.narrative_role || '').replace(/_/g, ' ')
  const ready = context.research_ready === true
  const status = (context.research_status || '').replace(/_/g, ' ')
  const citations = context.citation_count ?? 0
  const sources = context.source_types || []
  const issues = context.research_issues || []

  return (
    <div
      className={[
        'flex min-w-0 items-center gap-2 rounded-md border border-border/70 bg-card/70 px-2.5 py-1.5',
        className || '',
      ].join(' ')}
      data-testid="bn-slide-context"
    >
      <span className="flex-none text-[11px] font-medium text-foreground/80">
        Slide {slideIndex + 1}
      </span>
      {role && (
        <span className="flex-none rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
          {role}
        </span>
      )}
      {context.key_message && (
        <span className="truncate text-xs text-muted-foreground" title={context.key_message}>
          {context.key_message}
        </span>
      )}
      <span
        className={[
          'ml-auto flex flex-none items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]',
          ready
            ? 'border-emerald-300/60 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
            : issues.length
              ? 'border-amber-300/60 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
              : 'border-border bg-muted text-muted-foreground',
        ].join(' ')}
        title={
          issues.length
            ? `Research issues: ${issues.join('; ')}`
            : sources.length
              ? `Sources: ${sources.join(', ')}`
              : status || undefined
        }
      >
        {ready ? (
          <BookOpenCheck className="h-3 w-3" aria-hidden />
        ) : issues.length ? (
          <CircleAlert className="h-3 w-3" aria-hidden />
        ) : (
          <CircleHelp className="h-3 w-3" aria-hidden />
        )}
        {ready ? 'Evidence ready' : status || 'No research'}
        {citations > 0 ? ` · ${citations} citation${citations > 1 ? 's' : ''}` : ''}
      </span>
    </div>
  )
}
