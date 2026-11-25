const ROUTE = 'app/api/director/ws-token/route.ts'
const HOOK = 'hooks/use-deckster-websocket-v2.ts'
const SERVER = 'STUDIO_RESEARCHER_OWNER_PROOF_ENABLED'
const CLIENT = 'NEXT_PUBLIC_STUDIO_RESEARCHER_OWNER_PROOF'

export const SCOPE_FILES = new Set([
  ROUTE, HOOK, '.env.example', 'scripts/studio-later-changes.mjs', 'scripts/test-studio-researcher-owner-proof.mjs',
  'scripts/fixtures/researcher-session-auth-f899342.py', 'scripts/fixtures/researcher-session-auth-parity.mjs',
])
export const ENV_BLOCK = [
  '# D16 STUDIO RESEARCHER OWNER PROOF. Both flags default off and accept only the exact value "true".',
  '# The server flag mints proof for the authenticated account and session. The public build-time flag carries it on auth_refresh.',
  `${SERVER}="false"`,
  `${CLIENT}="false"`,
].join('\n') + '\n'

export function stripResearcherOwnerProof(rel, text) {
  if (typeof text !== 'string' || (rel !== ROUTE && rel !== HOOK)) return text
  return text
    .replace(/^.* \/\/ D16-OWNER-PROOF\n/gm, '')
}
