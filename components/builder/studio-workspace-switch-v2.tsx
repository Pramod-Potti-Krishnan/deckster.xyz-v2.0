"use client"

import { MessageSquare, PencilLine, Presentation } from 'lucide-react'
import './studio-workspace-switch-v2.css'

// PASS2-COMPOSER-POPUPS item 5 (flag NEXT_PUBLIC_STUDIO_COMPOSER_POPUPS_V2, Studio shell only, default off): the pane strip of a narrow window
// in plain words with icons: Slides (the stage), Director (the chat), Edit (the inspector). Edit is absent, not disabled, until something is
// selected. Presentation only: the page owns the pressed states and passes the handlers it always used for Stage, Chat and Inspector.
export interface StudioWorkspaceSwitchV2Props {
  /** The Stage pane button exists only in the overlay workspace (as before). */
  showSlides: boolean
  slidesPressed: boolean
  onSlides: () => void
  directorPressed: boolean
  onDirector: () => void
  /** There is something to edit (an inspector is available). */
  showEdit: boolean
  editPressed: boolean
  onEdit: () => void
}

export function StudioWorkspaceSwitchV2(p: StudioWorkspaceSwitchV2Props) {
  return (
    <div data-studio-workspace-switch="true" data-studio-workspace-switch-v2="true" role="group" aria-label="Workspace pane" title="Narrow window: switch between panes">
      <div className="swsv2-segments">
        {p.showSlides && <button type="button" aria-pressed={p.slidesPressed} onClick={p.onSlides}><Presentation aria-hidden="true" />Slides</button>}
        <button type="button" aria-pressed={p.directorPressed} onClick={p.onDirector}><MessageSquare aria-hidden="true" />Director</button>
        {p.showEdit && <button type="button" aria-pressed={p.editPressed} onClick={p.onEdit}><PencilLine aria-hidden="true" />Edit</button>}
      </div>
    </div>
  )
}
