'use client'

import './studio-rail-build-placeholder.css'

import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { slideTitleLabel } from '@/lib/studio-slide-title-label'
import { slideRailV2Number } from '@/lib/studio-slide-rail-v2'
import type { RailBuildPlaceholder } from '@/lib/studio-rail-build-count'

/**
 * RAIL-SLIDES-1-MIDBUILD (NEXT_PUBLIC_STUDIO_RAIL_BUILD_COUNT, default off; the strip only renders this with the flag on and a build filling the deck): a
 * planned slide the frame on stage does not hold yet. The same card, preview and caption markup as a real row (the Studio CSS keys on those attributes),
 * but no navigation button, menu, drag or refine, so nothing can act on a slide that is not there. A built slide reads "Built" (and shows its Stage F
 * preview once that frame arrives); a slide still to come reads "Preview loading", as the strawman's rows already do.
 */
export function RailBuildPlaceholderCard({ placeholder, studio, railV2 }: { placeholder: RailBuildPlaceholder; studio: boolean; railV2: boolean }) {
  const number = placeholder.slideNumber
  const title = placeholder.title ? slideTitleLabel(placeholder.title) : `Slide ${number}`
  return (
    <div
      data-studio-thumbnail-card={studio}
      data-studio-thumbnail-build-placeholder="true"
      data-studio-thumbnail-built={placeholder.built ? 'true' : undefined}
      data-active="false"
      aria-disabled="true"
      className="relative group flex-shrink-0 w-28 rounded-md border-2 border-slate-300 dark:border-slate-700 overflow-hidden"
      title="Being built"
    >
      <div data-studio-thumbnail-preview={studio} data-has-preview={Boolean(placeholder.thumbnailUrl)} className={cn(
        'relative w-full aspect-[16/9] overflow-hidden',
        placeholder.thumbnailUrl ? 'bg-slate-950' : 'flex flex-col justify-end p-2 gap-1 bg-slate-100 dark:bg-slate-800',
      )}>
        {placeholder.thumbnailUrl ? (
          <img src={placeholder.thumbnailUrl} alt={`${title} thumbnail`} className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <>
            {placeholder.built ? (
              <span className="studio-thumbnail-placeholder-label" data-studio-thumbnail-built-label="true" role="status" aria-label="Slide built">
                <Check className="inline h-2.5 w-2.5" aria-hidden /> Built
              </span>
            ) : (
              <span className="studio-thumbnail-placeholder-label" data-studio-thumbnail-pending="true" role="status" aria-label="Preview loading">
                <Loader2 className="inline h-2.5 w-2.5 animate-spin" aria-hidden /> Preview loading
              </span>
            )}
            <div className="h-1 w-3/4 rounded-sm bg-slate-300 dark:bg-slate-600" />
            <div className="h-0.5 w-2/3 rounded-sm bg-slate-300/70 dark:bg-slate-600/60" />
            <div className="h-0.5 w-1/2 rounded-sm bg-slate-300/70 dark:bg-slate-600/60" />
          </>
        )}
      </div>
      <div data-studio-thumbnail-caption={studio} className="flex w-full items-start gap-1 px-1.5 py-1.5 bg-white dark:bg-slate-900">
        <button type="button" disabled tabIndex={-1} className="flex min-w-0 flex-1 items-start gap-1 text-left focus:outline-none">
          <span className="flex-none text-[9px] font-semibold leading-[1.6] tabular-nums text-slate-500 dark:text-slate-400">
            {railV2 ? slideRailV2Number(number) : number}
          </span>
          <span title={railV2 ? title : undefined} className="min-w-0 text-[10px] leading-tight line-clamp-2 text-slate-700 dark:text-slate-300">
            {title}
          </span>
        </button>
      </div>
    </div>
  )
}
