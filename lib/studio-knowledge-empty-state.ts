/**
 * KNOWLEDGE-EMPTY-STATE (flag NEXT_PUBLIC_STUDIO_KNOWLEDGE_EMPTY_STATE, exact "true", default off; Studio shell only). Card PASS2-J6-FINDINGS, finding L9
 * "empty state"; KNOWLEDGE-2 run 0109439e, streams/ops/PASS2/J6/RUN.md section 2 (scenario 6: "light grey panel where the dark map normally is; side panel keeps
 * 'Select an entity...' with nothing to select").
 *
 * A person with no knowledge yet saw a pale grey box where the map's dark canvas normally is, and, beside it, a panel asking them to "Select an entity on the map
 * or in search" when there is nothing to select. The mock has no empty state (it shows a populated constellation), so this is a restyle of what exists:
 *  - the empty map is the map's own canvas (the dark surface, its dot grid and glow) with a faint, dashed "ghost" constellation behind the same words and the same
 *    two buttons, so the page keeps its identity and the first import does not flip the whole look;
 *  - the side panel says there is nothing to follow yet and what puts something there, instead of asking for a selection.
 * The copy of the map is the page's own (title, body, button names); only the side panel's is new.
 *
 * Pure, no imports: the test loads this file on its own. The flag is read in app/(app)/knowledge/page.tsx (exact "true", Studio shell only); with it off
 * nothing in this file runs.
 */
export const EMPTY_MAP_TITLE = 'Your graph is ready to grow'
export const EMPTY_MAP_BODY = 'Build a deck with Knowledge enabled, or import eligible past sessions to create your first entities and connections.'
export const EMPTY_PANEL_TITLE = 'Nothing to follow yet.'
export const EMPTY_PANEL_BODY = 'Entities, the relations between them and the evidence behind each one appear here once your knowledge has something in it. Import past sessions, or build a deck with Knowledge on, to start.'

/** The page's own test for "the graph loaded and has nothing in it": not while loading, not with a load error, only when a graph arrived with no entities. */
export function isEmptyGraph(state: { dataLoading: boolean; graph: { nodes?: unknown } | null | undefined; loadError: string | null | undefined }): boolean {
  const { dataLoading, graph, loadError } = state
  return !dataLoading && Boolean(graph) && Array.isArray(graph?.nodes) && graph.nodes.length === 0 && !loadError
}

export interface Ghost {
  nodes: Array<{ x: number; y: number; r: number }>
  /** Pairs of node indexes. */
  edges: Array<[number, number]>
}

/** The faint constellation behind the words, in a 100 x 60 box: seven nodes, every one joined to another, centre left clear for the text. */
export function ghostConstellation(): Ghost {
  return {
    nodes: [
      { x: 14, y: 16, r: 2.6 }, { x: 31, y: 9, r: 1.8 }, { x: 52, y: 8, r: 3 }, { x: 80, y: 14, r: 2.2 },
      { x: 90, y: 38, r: 2.8 }, { x: 68, y: 52, r: 2 }, { x: 22, y: 46, r: 2.4 }, { x: 8, y: 34, r: 1.6 },
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [1, 7], [2, 4]],
  }
}
