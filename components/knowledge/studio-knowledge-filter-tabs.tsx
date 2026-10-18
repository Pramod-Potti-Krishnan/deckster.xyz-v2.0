"use client"

import { filterTabs, hiddenAfterPick } from "@/lib/studio-knowledge-filter-tabs"
import "./studio-knowledge-filter-tabs.css"

/**
 * The Second Brain map's filter, as the accepted mock draws it: "Everything N" first, then one tab per kind in plain words (card PASS2-J6-FINDINGS, L4;
 * rules in lib/studio-knowledge-filter-tabs.ts). Shown only with NEXT_PUBLIC_STUDIO_KNOWLEDGE_FILTER_TABS on. It reads and writes the page's own set of
 * hidden entity types, so nothing else about the map changes.
 */
export function StudioKnowledgeFilterTabs({ nodesByType, hiddenTypes, onPick, colorFor }: {
  nodesByType: unknown
  hiddenTypes: ReadonlySet<string>
  onPick: (hidden: Set<string>) => void
  colorFor: (entityType: string) => string
}) {
  const { tabs } = filterTabs(nodesByType, hiddenTypes)
  if (tabs.length === 0) return null
  return (
    <div data-studio-knowledge-filter-tabs="true" role="group" aria-label="Show the map by kind of knowledge" className="skft">
      {tabs.map(tab => (
        <button
          key={tab.entityType ?? "everything"}
          type="button"
          aria-pressed={tab.selected}
          className={tab.selected ? "skft-tab is-selected" : "skft-tab"}
          onClick={() => onPick(hiddenAfterPick(tab.entityType, nodesByType))}
        >
          {tab.entityType !== null && <i className="skft-dot" style={{ backgroundColor: colorFor(tab.entityType) }} aria-hidden="true" />}
          {tab.label}
          <span className="skft-count">{new Intl.NumberFormat().format(tab.count)}</span>
        </button>
      ))}
    </div>
  )
}
