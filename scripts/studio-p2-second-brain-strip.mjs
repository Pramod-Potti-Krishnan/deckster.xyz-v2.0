// SB-08 (NEXT_PUBLIC_STUDIO_P2_SECOND_BRAIN): the exact text this change adds, as [text with the change, base text] per file.
export const BASE_COMMIT = 'fbc77c0430099ec7e11a188307ee5521b6937719'
export const CHANGES = {
  'components/knowledge/studio-knowledge-inspector.tsx': [
    [
      `import { typeColor, type KgViewNode } from "./kg-graph-view"\nimport { STUDIO_P2_SECOND_BRAIN_ENABLED as p2Brain, inspectorStats } from "@/lib/studio-p2-second-brain"\n`,
      `import { typeColor, type KgViewNode } from "./kg-graph-view"\n`,
    ],
    [
      `{p2Brain ? <><dl className="ski-p2-stats" aria-label="What this entity is built on">{inspectorStats(selected.node.mention_count, selected.evidence.length, selected.provenance_session_ids.length).map(stat => <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl><span className="ski-p2-rule" aria-hidden="true" /></> : <span>{selected.node.mention_count ?? 0} mentions · {selected.provenance_session_ids.length} contributing sessions</span>}`,
      `<span>{selected.node.mention_count ?? 0} mentions · {selected.provenance_session_ids.length} contributing sessions</span>`,
    ],
  ],
  'components/knowledge/studio-knowledge.css': [
    [
      `[data-studio-knowledge-inspector="true"] .ski-identity > span { display: block; color: var(--ss-muted); font-size: 10px; line-height: 1.6; margin-top: 7px; }\n/* NEXT_PUBLIC_STUDIO_P2_SECOND_BRAIN (SB-08): the three-number strip and the rule under it; the markup exists only with the flag. */\n[data-studio-knowledge-inspector="true"] .ski-identity > .ski-p2-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin: 16px 0 0; }\n[data-studio-knowledge-inspector="true"] .ski-p2-stats > div { min-width: 0; }\n[data-studio-knowledge-inspector="true"] .ski-p2-stats dd { order: -1; margin: 0; color: var(--ss-text); font-size: 24px; line-height: 1.15; font-weight: 400; font-variant-numeric: tabular-nums; }\n[data-studio-knowledge-inspector="true"] .ski-p2-stats > div { display: flex; flex-direction: column; }\n[data-studio-knowledge-inspector="true"] .ski-p2-stats dt { margin-top: 4px; color: var(--ss-muted); font-size: 10px; line-height: 1.4; }\n[data-studio-knowledge-inspector="true"] .ski-identity > .ski-p2-rule { display: block; height: 3px; margin-top: 14px; border-radius: 999px; background: linear-gradient(90deg, var(--ss-accent), var(--ss-teal)); opacity: .75; }\n`,
      `[data-studio-knowledge-inspector="true"] .ski-identity > span { display: block; color: var(--ss-muted); font-size: 10px; line-height: 1.6; margin-top: 7px; }\n`,
    ],
  ],
}

export const FILES = Object.keys(CHANGES)
export function stripP2SecondBrain(rel, text) {
  return (CHANGES[rel] ?? []).reduce((out, [added, base]) => out.replace(added, () => base), text)
}
