"use client"

import type { ReactNode } from "react"
import { List, Minus, Network, Plus, RotateCcw, ScanSearch } from "lucide-react"
import { focusTitle, RESET_LABEL, toolbarState, zoomPercent } from "@/lib/studio-knowledge-map-toolbar"
import "./studio-knowledge-map-toolbar.css"

/**
 * The Second Brain map's controls, as the accepted mock draws them: "- 100% +", the entity list / map button, "Reset map" (card PASS2-J6-FINDINGS, L6; rules in
 * lib/studio-knowledge-map-toolbar.ts). Drawn by KgGraphView only with NEXT_PUBLIC_STUDIO_KNOWLEDGE_MAP_TOOLBAR on, in place of its own toolbar, with the same
 * container (so the map's own stylesheet places it) and the same handlers.
 */
export function StudioKnowledgeMapToolbar({ showList, viewScale, fitScale, selectedName, hasSelection, onToggleList, onZoomIn, onZoomOut, onReset, onFocus, extra }: {
  showList: boolean
  viewScale: number
  fitScale: number
  selectedName?: string
  hasSelection: boolean
  onToggleList: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  onFocus: () => void
  /** One more control after "Reset map" (the Second Brain Full screen button, NEXT_PUBLIC_STUDIO_P2_SECOND_BRAIN). Absent: the toolbar is exactly as it was. */
  extra?: ReactNode
}) {
  const state = toolbarState({ showList, hasSelection })
  return (
    <div data-studio-graph-toolbar="true" data-studio-graph-toolbar-kind="map" role="group" aria-label="Knowledge map controls" className="absolute right-3 top-3 z-10 hidden items-center gap-1 rounded-xl border border-white/10 bg-slate-950/80 p-1 shadow-xl backdrop-blur lg:flex">
      <div className="skmt-zoom" role="group" aria-label="Zoom">
        <button type="button" onClick={onZoomOut} disabled={state.zoomDisabled} aria-label="Zoom out" title="Zoom out"><Minus className="h-4 w-4" /></button>
        <output className="skg-zoom" aria-label="Map zoom">{zoomPercent(viewScale, fitScale)}%</output>
        <button type="button" onClick={onZoomIn} disabled={state.zoomDisabled} aria-label="Zoom in" title="Zoom in"><Plus className="h-4 w-4" /></button>
      </div>
      <button type="button" onClick={onToggleList} aria-pressed={showList} aria-label={state.listAriaLabel} title={state.listTitle}>{showList ? <Network className="h-4 w-4" /> : <List className="h-4 w-4" />}<span>{state.listLabel}</span></button>
      {state.showFocus && <button type="button" onClick={onFocus} disabled={state.focusDisabled} aria-label="Focus selected entity" title={focusTitle(selectedName)}><ScanSearch className="h-4 w-4" /><span>Focus entity</span></button>}
      <button type="button" onClick={onReset} disabled={state.resetDisabled} aria-label={RESET_LABEL} title="Fit the whole map in the panel again"><RotateCcw className="h-4 w-4" /><span>{RESET_LABEL}</span></button>
      {extra}
    </div>
  )
}
