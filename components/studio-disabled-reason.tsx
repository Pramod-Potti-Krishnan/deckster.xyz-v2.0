'use client'

import { useId, type ReactNode } from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '@/lib/utils'

interface StudioDisabledReasonProps {
  /** Why the wrapped control is disabled right now; null / empty when it is enabled (then this is a plain, inert box). */
  reason: string | null
  /** The wrapped control's accessible name ("Add Element"), read with the reason when the box takes focus. */
  label: string
  /** The reason is the ONE_LIVE_TAB "this tab is paused" sentence: keeps that wrapper's `data-studio-tab-paused` marker. */
  tabPaused?: boolean
  /** The fullscreen element, so the tooltip is inside what fullscreen shows (the viewer's toolbarDropdownPortalContainer). */
  portalContainer?: HTMLElement
  children: ReactNode
}

/**
 * PASS2B batch 1 (NEXT_PUBLIC_STUDIO_DISABLED_REASONS, default off; the viewer only renders this with the flag on): the box around a toolbar
 * control that says why the control is greyed. It EXTENDS the wrapper ONE_LIVE_TAB (#396) added in presentation-viewer.tsx (`tabPausedWrap`, a
 * `title` on a span around a disabled button): the same box, with the same `[&_button]:pointer-events-none` so a disabled button no longer swallows
 * the pointer, now also
 * - a keyboard tab stop while the control is disabled (a disabled button is never focusable, so Tab skipped it and no tooltip could show),
 * - a tooltip on hover AND on keyboard focus (Radix Tooltip; Esc dismisses it), in a portal so the toolbar's overflow cannot clip it,
 * - and aria: role="button" + aria-disabled="true" + the control's own name, with the reason as aria-describedby (a visually hidden span).
 *
 * While the control is enabled the box is inert (no role, no tab stop, no tooltip) and renders the same children in the same place, so toggling
 * disabled <-> enabled never remounts them (focus, an open menu and the picker's state survive).
 */
export function StudioDisabledReason({ reason, label, tabPaused, portalContainer, children }: StudioDisabledReasonProps) {
  const reasonId = useId()
  const blocked = typeof reason === 'string' && reason !== ''
  return (
    <TooltipPrimitive.Provider delayDuration={150} skipDelayDuration={0}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <span
            data-studio-disabled-reason={blocked ? 'true' : undefined}
            data-studio-tab-paused={blocked && tabPaused ? 'true' : undefined}
            role={blocked ? 'button' : undefined}
            tabIndex={blocked ? 0 : undefined}
            aria-disabled={blocked ? true : undefined}
            aria-label={blocked ? label : undefined}
            aria-describedby={blocked ? reasonId : undefined}
            className={cn(
              'inline-flex rounded-md',
              blocked && '[&_button]:pointer-events-none cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--ss-accent,#6d28d9)]',
            )}
          >
            {children}
          </span>
        </TooltipPrimitive.Trigger>
        {blocked && <span id={reasonId} className="sr-only">{reason}</span>}
        {blocked && (
          <TooltipPrimitive.Portal container={portalContainer}>
            <TooltipPrimitive.Content
              side="bottom"
              sideOffset={6}
              collisionPadding={8}
              data-studio-disabled-reason-tip="true"
              className="z-[100] max-w-[260px] rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs leading-4 text-slate-700 shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {reason}
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Portal>
        )}
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}
