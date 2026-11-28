const ROUTE = 'app/api/director/ws-token/route.ts'
const HOOK = 'hooks/use-deckster-websocket-v2.ts'
const SERVER = 'STUDIO_RESEARCHER_OWNER_PROOF_ENABLED'
const CLIENT = 'NEXT_PUBLIC_STUDIO_RESEARCHER_OWNER_PROOF'

export const SCOPE_FILES = new Set([
  ROUTE,
  HOOK,
  '.env.example',
  'scripts/studio-later-changes.mjs',
  'scripts/test-studio-researcher-owner-proof.mjs',
  'scripts/fixtures/researcher-session-auth-f899342.py',
  'scripts/fixtures/researcher-session-auth-parity.mjs',
  'scripts/studio-researcher-owner-proof-strip.mjs',
  'scripts/test-studio-chat-element-edit.mjs',
  'scripts/test-studio-deck-sync-truth.mjs',
  'scripts/test-director-question-submit.mjs',
  'scripts/test-studio-researcher-token-mint-sites.mjs',
  'scripts/test-studio-sessions-owner.mjs',
])
export const ENV_BLOCK = [
  '# D16 STUDIO RESEARCHER OWNER PROOF. Both flags default off and accept only the exact value "true".',
  '# The server flag mints proof for the authenticated account and session. The public build-time flag carries it on auth_refresh.',
  `${SERVER}="false"`,
  `${CLIENT}="false"`,
].join('\n') + '\n'

// Older proof files also pin these D16 successor registrations to their earlier bytes.
const FIRST_PARENT_PIN = "  shas.splice(0, shas.length, ...shas.filter(sha => !/^(?:Researcher owner proof:|(?:Add Studio Researcher owner proof to Director websocket refresh|Prove Director reconnect parity when owner proof is enabled|Pin Studio websocket proof to Researcher token source)$)/.test(git('log', '-1', '--format=%s', sha).trimEnd()))) // LATER-CHANGES: registry read (RESEARCHER-OWNER-PROOF): the approved D16 WS proof commits belong to the later change, not this guard's own first-parent scope.\n"

export function stripResearcherOwnerProof(rel, text) {
  if (typeof text !== 'string') return text
  if (rel === ROUTE || rel === HOOK) return text.replace(/^.* \/\/ D16-OWNER-PROOF\n/gm, '')
  if (rel === 'scripts/test-studio-chat-element-edit.mjs' || rel === 'scripts/test-studio-deck-sync-truth.mjs') {
    return text.replace(FIRST_PARENT_PIN, '')
  }
  return text
}
