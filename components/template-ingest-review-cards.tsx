"use client"

/**
 * Template Ingest (C-7) review cards v1: a light chat-adjacent strip that
 * renders, per ingested slide, the ORIGINAL slide PNG plus the fidelity score
 * reported by Director's `template_ingest_ready` frame.
 */

import { cn } from '@/lib/utils'
import type { TemplateIngestSlideFidelity } from '@/hooks/use-deckster-websocket-v2'

interface TemplateIngestReviewCardsProps {
  slides: TemplateIngestSlideFidelity[]
  className?: string
}

function fidelityTone(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'text-slate-500 dark:text-slate-400'
  if (score >= 0.85) return 'text-emerald-600 dark:text-emerald-400'
  if (score >= 0.6) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function formatFidelity(score: number | null | undefined): string {
  if (score === null || score === undefined) return '—'
  // Scores arrive as 0–1 floats; tolerate 0–100 just in case.
  const pct = score <= 1 ? score * 100 : score
  return `${Math.round(pct)}%`
}

export function TemplateIngestReviewCards({ slides, className }: TemplateIngestReviewCardsProps) {
  if (!slides.length) return null

  return (
    <div className={cn('rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800', className)}>
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Ingested slides · match vs original
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {slides.map((slide) => (
          <div
            key={slide.slide_index}
            className="overflow-hidden rounded-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
          >
            {slide.png_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={slide.png_url}
                alt={`Original slide ${slide.slide_index + 1}`}
                loading="lazy"
                className="aspect-video w-full object-cover"
              />
            ) : (
              <div className="flex aspect-video w-full items-center justify-center text-xs text-slate-400">
                Slide {slide.slide_index + 1}
              </div>
            )}
            <div className="flex items-center justify-between px-2 py-1 text-xs">
              <span className="text-slate-500 dark:text-slate-400">Slide {slide.slide_index + 1}</span>
              <span className={cn('font-semibold', fidelityTone(slide.fidelity))}>
                {formatFidelity(slide.fidelity)}
              </span>
            </div>
            {/* R3-6: surface per-slide escalation/degradation warnings so the
                user can make an informed accept/drop decision. Tolerates
                absent or malformed values (renders nothing). */}
            {Array.isArray(slide.warnings) && slide.warnings.length > 0 && (
              <div className="border-t border-amber-300/60 bg-amber-50 px-2 py-1 text-[11px] leading-snug text-amber-700 dark:border-amber-400/20 dark:bg-amber-950/40 dark:text-amber-400">
                {slide.warnings.filter((w) => typeof w === 'string' && w).join(' · ')}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
