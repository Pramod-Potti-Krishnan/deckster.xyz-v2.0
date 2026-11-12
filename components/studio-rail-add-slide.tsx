'use client'

import './studio-rail-add-slide.css'

import { Plus } from 'lucide-react'
import { STUDIO_DISABLED_REASONS_ENABLED } from '@/lib/studio-disabled-reasons'
import { RAIL_ADD_SLIDE_LABEL, type RailAddSlideState } from '@/lib/studio-rail-add-slide'
import { StudioDisabledReason } from './studio-disabled-reason'

export interface RailAddSlideProps extends RailAddSlideState {
  /** Opens the Add Slide panel: the toolbar button's own handler (`addSlideV2Settings.onPanelOpenChange`), called with `true`. */
  onOpen: () => void
}

/**
 * PASS2B G21 (NEXT_PUBLIC_STUDIO_RAIL_ADD_SLIDE, default off; the strip only renders this with the flag on): the rail's footer button. It opens the
 * existing Add Slide panel and sends nothing itself (see lib/studio-rail-add-slide.ts). Its box around the button is the toolbar's: with
 * DISABLED_REASONS on the same StudioDisabledReason (a tooltip and a tab stop while it is greyed), with it off the paused-tab title span.
 */
export function RailAddSlideButton({ disabled, reason, tabPaused, onOpen }: RailAddSlideProps) {
  const button = (
    <button type="button" data-studio-rail-add-slide="true" disabled={disabled} onClick={() => onOpen()}>
      <Plus aria-hidden="true" />
      <span>{RAIL_ADD_SLIDE_LABEL}</span>
    </button>
  )
  return (
    <div data-studio-rail-footer="true">
      {STUDIO_DISABLED_REASONS_ENABLED
        ? <StudioDisabledReason reason={reason} label={RAIL_ADD_SLIDE_LABEL} tabPaused={tabPaused}>{button}</StudioDisabledReason>
        : tabPaused && reason
        ? <span title={reason} data-studio-tab-paused="true" className="inline-flex [&_button]:pointer-events-none">{button}</span>
        : button}
    </div>
  )
}
