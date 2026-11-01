"use client"

import { STUDIO_STAGE_OPEN_GATE_ENABLED, useStudioStageShowCanvas } from "@/lib/studio-stage-open-gate"
import "./studio-stage-gate-show-canvas.css"

export { STUDIO_STAGE_OPEN_GATE_ENABLED }

/**
 * STUDIO-STAGE-OPEN-GATE (flag NEXT_PUBLIC_STUDIO_STAGE_OPEN_GATE, default off; PK UAT F-03, Q1): the chat header's "Show canvas". The header renders it only with the flag on, at its actions slot.
 * It draws a button only while the gate holds the stage closed (lib/studio-stage-open-gate.ts, the store the page publishes to); a click opens the stage and keeps it open for the session.
 * The look is the header's "Reconnect" button (studio-stage-gate-show-canvas.css). Nothing is sent: the click only asks the page, through the store, to open its own stage.
 */
export function StudioStageShowCanvas() {
  const showCanvas = useStudioStageShowCanvas()
  return showCanvas ? <button type="button" data-studio-stage-gate-show-canvas="true" onClick={() => showCanvas()}>Show canvas</button> : null
}
