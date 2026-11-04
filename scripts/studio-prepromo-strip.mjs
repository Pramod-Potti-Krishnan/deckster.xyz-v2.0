// FRONTEND-1: pre-promotion fixes C-07 (dev mock token only in development), C-06 (template/deck-import hosts from env) and UX-01
// (no provider prices in Studio). No flag: security and honesty fixes apply in every environment. Registered in
// scripts/studio-later-changes.mjs so older byte-for-byte pins see their base's file. stripPrepromo(rel, text) puts each
// changed span back exactly as it was; any file it does not own comes back untouched.
export const PREPROMO_SCOPE_FILES = [
  'app/api/dev/mock-token/route.ts',
  'scripts/test-studio-dev-token-gate.mjs',
  'scripts/studio-prepromo-strip.mjs',
  'scripts/studio-later-changes.mjs',
  'scripts/test-studio-d1-debug-routes.mjs',
  'lib/composer-library.ts',
  'scripts/test-studio-composer-env-hosts.mjs',
  'scripts/test-studio-deck-import.mjs',
]

const MOCK_TOKEN_PAIRS = [
  [`// C-07: a local development server only. NODE_ENV must be 'development' AND the dev-mode flag must be on; any other
// environment (production, test, preview, UAT) answers 404 as if the route did not exist. Not flag-gated: applies everywhere.
function mockTokenAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'development' && env.NEXT_PUBLIC_DEV_MODE === 'true';
}
`, `// Only enable in development mode
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEV_MODE === 'true';
`],
  [`  if (!mockTokenAllowed()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
`, `  if (!isDevelopment) {
    return NextResponse.json(
      { error: 'Mock tokens are only available in development mode' },
      { status: 403 }
    );
  }
`],
]

export const PREPROMO_PAIRS = {
  'app/api/dev/mock-token/route.ts': MOCK_TOKEN_PAIRS,
}

export function stripPrepromo(rel, text) {
  const pairs = PREPROMO_PAIRS[rel]
  if (!pairs || typeof text !== 'string') return text
  let out = text
  for (const [now, was] of pairs) out = out.split(now).join(was)
  return out
}
