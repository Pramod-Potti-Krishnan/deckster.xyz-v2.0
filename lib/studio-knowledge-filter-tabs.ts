/**
 * KNOWLEDGE-FILTER-TABS (flag NEXT_PUBLIC_STUDIO_KNOWLEDGE_FILTER_TABS, exact "true", default off; Studio shell only). Card PASS2-J6-FINDINGS, finding L4
 * "what the filters filter (content tabs, user vocabulary)"; KNOWLEDGE-2 run 0109439e, streams/ops/PASS2/J6/RUN.md section 2.
 *
 * The Second Brain page filtered its map with one chip per ENTITY TYPE in the system's words ("metric 2", "org 2", "event 1" ...), every chip looking
 * "on", and nothing to say "this is everything". The accepted mock (design/studio-v4-mockup/components/knowledge-map.tsx, `km-kind-row`) filters
 * with a row of tabs in the person's words: "Everything 28" first (the selected one), then one tab per kind with its count.
 *
 * What this does, on the data the page already has (stats.nodes_by_type) and nothing else:
 *  - kind names in plain words ("Organizations", "People", "Places", "Metrics" ...) instead of the type codes;
 *  - an "Everything" tab with the total, selected while nothing is hidden;
 *  - a kind tab is selected when it is the only kind showing; picking a tab shows that kind alone, picking "Everything" shows all.
 * The page's own state does not change shape: it is still the set of HIDDEN entity types (`hiddenTypes`), so the map, the "hidden by your type
 * filters" note and the "All entity types are hidden" state work as before. A set with several kinds showing (the note's "Show ... entities" button
 * can leave one) selects no tab ("mixed"); "Everything" is how a person gets back.
 *
 * Not in this change (they need data the entity graph does not have, so they are new features, not a restyle): the mock's content kinds
 * (Presentations, Research, Datasets, Templates, Themes, Models), its "All topics" / "All types" dropdowns and "Included for Director".
 *
 * Pure, no imports: the test loads this file on its own. The flag is read in app/(app)/knowledge/page.tsx (exact "true", Studio shell only); with it
 * off nothing in this file runs.
 */
export const EVERYTHING_LABEL = 'Everything'

// The entity types the Knowledge Graph service writes (components/knowledge/kg-graph-view.tsx TYPE_COLORS), in the words a person uses for them.
const KIND_LABELS: Readonly<Record<string, string>> = {
  ORG: 'Organizations',
  PERSON: 'People',
  CONCEPT: 'Ideas',
  METRIC: 'Metrics',
  PRODUCT: 'Products',
  EVENT: 'Events',
  PLACE: 'Places',
  TECHNOLOGY: 'Technologies',
  TREND: 'Trends',
}

const typeKey = (entityType: unknown): string => String(entityType ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_')

/** "ORG" -> "Organizations". A type this list does not know is shown as its own words ("LEGAL_ENTITY" -> "Legal entity"), never as a code. */
export function knowledgeKindLabel(entityType: unknown): string {
  const key = typeKey(entityType)
  if (key === '') return 'Other'
  const known = KIND_LABELS[key]
  if (known) return known
  const words = key.toLowerCase().replace(/_+/g, ' ').trim()
  return words === '' ? 'Other' : words.charAt(0).toUpperCase() + words.slice(1)
}

export interface KindCount {
  entity_type: string
  count: number
}

export interface FilterTab {
  /** null for "Everything". */
  entityType: string | null
  label: string
  count: number
  selected: boolean
}

export interface FilterTabs {
  tabs: FilterTab[]
  /** Several kinds are showing, so no tab is selected. */
  mixed: boolean
}

/** The kinds the stats response lists, each once (a repeated type adds its count), with a count that is a whole number >= 0. */
function kindsOf(nodesByType: unknown): KindCount[] {
  if (!Array.isArray(nodesByType)) return []
  const kinds: KindCount[] = []
  for (const item of nodesByType) {
    if (typeof item !== 'object' || item === null) continue
    const { entity_type: entityType, count } = item as { entity_type?: unknown; count?: unknown }
    if (typeof entityType !== 'string' || entityType === '') continue
    const n = typeof count === 'number' && Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
    const seen = kinds.find(kind => kind.entity_type === entityType)
    if (seen) seen.count += n
    else kinds.push({ entity_type: entityType, count: n })
  }
  return kinds
}

/** The tab row for these kinds and this set of HIDDEN entity types. No kinds, no row (empty list). */
export function filterTabs(nodesByType: unknown, hidden: ReadonlySet<string>): FilterTabs {
  const kinds = kindsOf(nodesByType)
  if (kinds.length === 0) return { tabs: [], mixed: false }
  const showing = kinds.filter(kind => !hidden.has(kind.entity_type))
  const nothingHidden = showing.length === kinds.length
  const onlyOne = !nothingHidden && showing.length === 1 ? showing[0].entity_type : null
  return {
    tabs: [
      { entityType: null, label: EVERYTHING_LABEL, count: kinds.reduce((sum, kind) => sum + kind.count, 0), selected: nothingHidden },
      ...kinds.map(kind => ({ entityType: kind.entity_type, label: knowledgeKindLabel(kind.entity_type), count: kind.count, selected: kind.entity_type === onlyOne })),
    ],
    mixed: !nothingHidden && onlyOne === null,
  }
}

/** The set of hidden entity types after picking a tab: null = "Everything" (nothing hidden); a kind = every other kind hidden. */
export function hiddenAfterPick(entityType: string | null, nodesByType: unknown): Set<string> {
  const kinds = kindsOf(nodesByType)
  if (entityType === null || !kinds.some(kind => kind.entity_type === entityType)) return new Set()
  return new Set(kinds.filter(kind => kind.entity_type !== entityType).map(kind => kind.entity_type))
}
