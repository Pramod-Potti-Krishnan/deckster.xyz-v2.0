/**
 * PASS2-PAGES Second brain (streams/ops/PASS2-PAGES/second-brain.md) SB-08: the inspector header gets the mock's three-number strip, filled
 * with the live numbers the node-detail response already carries (mentions, returned evidence, contributing sessions), plus the mock's thin
 * gradient rule. The mock's "Coverage %" is sample-goal maths and is not shown. "Focus on this topic" stays in the map toolbar (Focus entity).
 * SB-17 (shared shell row) is its own PR.
 *
 * Flag NEXT_PUBLIC_STUDIO_P2_SECOND_BRAIN: exact "true" and the literal Studio shell. Off: every rendered byte is unchanged.
 * Import-free on purpose, so scripts/test-studio-p2-second-brain.mjs can run the real file in a bare vm.
 */
export const STUDIO_P2_SECOND_BRAIN_ENABLED =
  process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_P2_SECOND_BRAIN === 'true'

export interface InspectorStat { label: string; value: string }

/** The three numbers, in the mock's order. A missing or broken count shows "0" (as the text line did for mentions). */
export function inspectorStats(mentions: unknown, evidence: unknown, sessions: unknown): InspectorStat[] {
  const count = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0)
  const stat = (n: number, one: string, many: string): InspectorStat => ({ label: n === 1 ? one : many, value: n.toLocaleString('en-US') })
  return [
    stat(count(mentions), 'Mention', 'Mentions'),
    stat(count(evidence), 'Evidence snippet', 'Evidence snippets'),
    stat(count(sessions), 'Session', 'Sessions'),
  ]
}
