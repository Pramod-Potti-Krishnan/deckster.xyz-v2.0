"use client"

import Link from "next/link"
import { Brain, Import } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EMPTY_MAP_BODY, EMPTY_MAP_TITLE, ghostConstellation } from "@/lib/studio-knowledge-empty-state"
import "./studio-knowledge-empty-state.css"

/**
 * The Second Brain's empty map on the map's own dark canvas (card PASS2-J6-FINDINGS, L9; rules and copy in lib/studio-knowledge-empty-state.ts). Shown by the
 * page only with NEXT_PUBLIC_STUDIO_KNOWLEDGE_EMPTY_STATE on, in place of the pale empty box; the same words and the same two buttons.
 */
export function StudioKnowledgeEmptyMap({ importing, onImport }: { importing: boolean; onImport: () => void }) {
  const ghost = ghostConstellation()
  return (
    <div data-studio-knowledge-role="map-start" data-studio-knowledge-empty-state="true" className="skes">
      <svg className="skes-ghost" viewBox="0 0 100 60" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        {ghost.edges.map(([from, to]) => (
          <line key={`${from}-${to}`} x1={ghost.nodes[from].x} y1={ghost.nodes[from].y} x2={ghost.nodes[to].x} y2={ghost.nodes[to].y} />
        ))}
        {ghost.nodes.map((node, index) => <circle key={index} cx={node.x} cy={node.y} r={node.r} />)}
      </svg>
      <div className="skes-body">
        <div className="skes-icon"><Brain className="h-8 w-8" /></div>
        <h3>{EMPTY_MAP_TITLE}</h3>
        <p>{EMPTY_MAP_BODY}</p>
        <div className="skes-actions">
          <Button onClick={onImport} disabled={importing}><Import className="mr-2 h-4 w-4" /> Import past sessions</Button>
          <Button asChild variant="outline"><Link href="/builder">Build a deck</Link></Button>
        </div>
      </div>
    </div>
  )
}
