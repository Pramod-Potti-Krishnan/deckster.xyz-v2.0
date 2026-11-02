"use client"

// FRONTEND-1 (F-06, F-11; flag NEXT_PUBLIC_STUDIO_STRAWMAN_STAGE): the one quiet line under the deck viewer while the deck is still Director's strawman: no action is needed, building starts by itself.
// What each slide says about itself (title, key points, content type) is the preview deck's own slide, not the stage's. No button: the approval is Director's, not the stage's.
import { STRAWMAN_STAGE_NO_ACTION_LINE } from "@/lib/studio-strawman-stage"
import "./studio-strawman-note.css"

export function StudioStrawmanNote() {
  return <p data-studio-strawman-note="true">{STRAWMAN_STAGE_NO_ACTION_LINE}</p>
}
