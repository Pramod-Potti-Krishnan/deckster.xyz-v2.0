// PROGRAM-1 (4 Nov 2026), completed by FRONTEND-1: Studio API hardening v1, the security audit's items 2, 5, 6, 7, 9 and 10 (STUDIO_API_HARDENING_V1_ENABLED, server only, default off;
// the activate id fix ships unflagged). Item 4 (deleting app/api/dev/mock-token) is NOT here: it lives in PR #571 (frontend1/prepromo-fixes), so this branch leaves that file as the base has it.
// Admin (item 9): with the flag on, /admin, /api/admin/users(/approve), /api/admin/coupons(/[id]) and /api/admin/cleanup-sessions accept only ADMIN_EMAILS (comma-separated, any case, empty = nobody);
// off, the signed-in email against DEV_BYPASS_EMAIL as before. Before the flag goes on (PK): apply prisma/sql/20261104_api_rate_events.sql and set ADMIN_EMAILS.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and its strip in scripts/studio-later-changes.mjs (three lines, at the end of each list).
// The strip puts back each edited file's base text: API_HARDENING_EDITS holds, per file, [the text this change left, the base text it replaced] (each with a line of context, each present exactly once),
// applied in order, only when every one of them is there; .env.example loses exactly API_HARDENING_ENV_BLOCK. Any other file comes back as it is. Plain node, no I/O.

export const BASE_COMMIT = '3e1ce88eec23fbfd33f249332d06a65ad05ffc40' // origin/studio-v4-dev-preparation-code when FRONTEND-1 completed this change
export const API_HARDENING_SUBJECT = 'API hardening' // own commits: "Studio API hardening v1 ..." and "API hardening: ..."
export const API_HARDENING_FLAG = 'STUDIO_API_HARDENING_V1_ENABLED'
export const API_HARDENING_DELETED = [] // the mock-token deletion lives in #571
export const API_HARDENING_NEW_FILES = [
  'lib/api-hardening-core.ts',
  'lib/api-hardening.ts',
  'prisma/sql/20261104_api_rate_events.sql',
  'scripts/studio-api-hardening-strip.mjs',
  'scripts/test-studio-api-hardening.mjs',
]

export const API_HARDENING_EDITS = {
 "app/api/admin/cleanup-sessions/route.ts": [
  [
   "import { isStudioDevDeployment } from '@/lib/dev-deployment'\nimport { isAdminEmail } from '@/lib/api-hardening-core'\n",
   "import { isStudioDevDeployment } from '@/lib/dev-deployment'\n"
  ],
  [
   "function isAdmin(email: string | null | undefined): boolean {\n  // STUDIO_API_HARDENING_V1_ENABLED: on, ADMIN_EMAILS only (comma list, any case; empty = nobody); off, DEV_BYPASS_EMAIL as before.\n  return isAdminEmail(email)\n",
   "function isAdmin(email: string | null | undefined): boolean {\n  return !!email && email === process.env.DEV_BYPASS_EMAIL\n"
  ]
 ],
 "app/api/admin/coupons/[id]/route.ts": [
  [
   "import { studioP2AdminOn, studioP2AdminParseExpiry } from \"@/lib/studio-p2-admin\"\nimport { isAdminEmail } from \"@/lib/api-hardening-core\"\n",
   "import { studioP2AdminOn, studioP2AdminParseExpiry } from \"@/lib/studio-p2-admin\"\n"
  ],
  [
   "function isAdmin(email: string | null | undefined): boolean {\n  // STUDIO_API_HARDENING_V1_ENABLED: on, ADMIN_EMAILS only (comma list, any case; empty = nobody); off, DEV_BYPASS_EMAIL as before.\n  return isAdminEmail(email)\n",
   "function isAdmin(email: string | null | undefined): boolean {\n  return !!email && email === process.env.DEV_BYPASS_EMAIL\n"
  ]
 ],
 "app/api/admin/coupons/route.ts": [
  [
   "import { studioP2AdminOn, studioP2AdminPageWindow, studioP2AdminPaging, studioP2AdminParseExpiry, studioP2AdminTotalsFromGroups } from \"@/lib/studio-p2-admin\"\nimport { isAdminEmail } from \"@/lib/api-hardening-core\"\n",
   "import { studioP2AdminOn, studioP2AdminPageWindow, studioP2AdminPaging, studioP2AdminParseExpiry, studioP2AdminTotalsFromGroups } from \"@/lib/studio-p2-admin\"\n"
  ],
  [
   "function isAdmin(email: string | null | undefined): boolean {\n  // STUDIO_API_HARDENING_V1_ENABLED: on, ADMIN_EMAILS only (comma list, any case; empty = nobody); off, DEV_BYPASS_EMAIL as before.\n  return isAdminEmail(email)\n",
   "function isAdmin(email: string | null | undefined): boolean {\n  return !!email && email === process.env.DEV_BYPASS_EMAIL\n"
  ]
 ],
 "app/api/admin/users/approve/route.ts": [
  [
   "import { prisma } from '@/lib/prisma';\nimport { isAdminEmail } from '@/lib/api-hardening-core';\n",
   "import { prisma } from '@/lib/prisma';\n"
  ],
  [
   "    // Check if user is admin\n    // STUDIO_API_HARDENING_V1_ENABLED: on, admin = ADMIN_EMAILS only (DEV_BYPASS_EMAIL no longer doubles as admin); off, unchanged.\n    const isAdmin = isAdminEmail(session.user.email);\n",
   "    // Check if user is admin\n    const isAdmin = !!session.user.email && session.user.email === process.env.DEV_BYPASS_EMAIL;\n"
  ]
 ],
 "app/api/admin/users/route.ts": [
  [
   "import { prisma } from '@/lib/prisma';\nimport { isAdminEmail } from '@/lib/api-hardening-core';\nimport { studioP2AdminOn, studioP2AdminPageWindow, studioP2AdminUsersQuery, studioP2AdminUsersWhere } from '@/lib/studio-p2-admin';",
   "import { prisma } from '@/lib/prisma';\nimport { studioP2AdminOn, studioP2AdminPageWindow, studioP2AdminUsersQuery, studioP2AdminUsersWhere } from '@/lib/studio-p2-admin';"
  ],
  [
   "    // Check if user is admin (must match DEV_BYPASS_EMAIL)\n    // STUDIO_API_HARDENING_V1_ENABLED: on, admin = ADMIN_EMAILS only (DEV_BYPASS_EMAIL no longer doubles as admin); off, unchanged.\n    const isAdmin = isAdminEmail(session.user.email);\n",
   "    // Check if user is admin (must match DEV_BYPASS_EMAIL)\n    const isAdmin = !!session.user.email && session.user.email === process.env.DEV_BYPASS_EMAIL;\n"
  ]
 ],
 "app/api/director/sessions/[sourceSessionId]/handoff/route.ts": [
  [
   "import { authOptions } from '@/lib/auth-options'\nimport { HANDOFF_BODY_KEYS, isApiHardeningEnabled, pickAllowedKeys, requireApprovedUser, requireSessionOwner } from '@/lib/api-hardening'\n",
   "import { authOptions } from '@/lib/auth-options'\n"
  ],
  [
   ") {\n  // STUDIO_API_HARDENING_V1_ENABLED (server, default off): approved users only, read from the DB. Off, this returns null and nothing changes.\n  const notApproved = await requireApprovedUser()\n  if (notApproved) return notApproved\n  const session = await getServerSession(authOptions)",
   ") {\n  const session = await getServerSession(authOptions)"
  ],
  [
   "  const { sourceSessionId } = await context.params\n  // STUDIO_API_HARDENING_V1_ENABLED (server, default off): only the owner of the source session may hand it off. Off, null.\n  const notOwner = await requireSessionOwner(sessionUser?.id, sourceSessionId)\n  if (notOwner) return notOwner\n  const payload = {",
   "  const { sourceSessionId } = await context.params\n  const payload = {"
  ],
  [
   "  const payload = {\n    // Hardening on: only the keys the Studio sends are forwarded.\n    ...(isApiHardeningEnabled() ? pickAllowedKeys(body, HANDOFF_BODY_KEYS) : body),\n    // Never trust a browser-provided owner id. This must exactly match the id",
   "  const payload = {\n    ...body,\n    // Never trust a browser-provided owner id. This must exactly match the id"
  ]
 ],
 "app/api/director/ws-token/route.ts": [
  [
   "import { getUserSubscription } from '@/lib/stripe/stripe-utils'\nimport { requireApprovedUser } from '@/lib/api-hardening'\n",
   "import { getUserSubscription } from '@/lib/stripe/stripe-utils'\n"
  ],
  [
   "export async function GET(request: NextRequest) {\n  // STUDIO_API_HARDENING_V1_ENABLED (server, default off): approved users only, read from the DB. Off, this returns null and nothing changes.\n  const notApproved = await requireApprovedUser()\n  if (notApproved) return notApproved\n  const session = await getServerSession(authOptions)",
   "export async function GET(request: NextRequest) {\n  const session = await getServerSession(authOptions)"
  ]
 ],
 "app/api/identity/text-labs-token/route.ts": [
  [
   "} from '@/lib/text-labs-identity-mint'\nimport { requireApprovedUser } from '@/lib/api-hardening'\n",
   "} from '@/lib/text-labs-identity-mint'\n"
  ],
  [
   "export async function GET() {\n  // STUDIO_API_HARDENING_V1_ENABLED (server, default off): approved users only, read from the DB. Off, this returns null and nothing changes.\n  const notApproved = await requireApprovedUser()\n  if (notApproved) return notApproved\n  if (!textLabsSignedRequestsEnabled()) {",
   "export async function GET() {\n  if (!textLabsSignedRequestsEnabled()) {"
  ]
 ],
 "app/api/knowledge-graph/backfill/route.ts": [
  [
   "import { getKgBaseUrl, kgHeaders, requireKgEntitled } from '@/lib/kg-proxy'\nimport { requireApprovedUser } from '@/lib/api-hardening'\n",
   "import { getKgBaseUrl, kgHeaders, requireKgEntitled } from '@/lib/kg-proxy'\n"
  ],
  [
   "export async function POST(request: Request) {\n  // STUDIO_API_HARDENING_V1_ENABLED (server, default off): approved users only, read from the DB. Off, this returns null and nothing changes.\n  const notApproved = await requireApprovedUser()\n  if (notApproved) return notApproved\n  const gate = await requireKgEntitled()",
   "export async function POST(request: Request) {\n  const gate = await requireKgEntitled()"
  ]
 ],
 "app/api/knowledge-graph/query/route.ts": [
  [
   "import { studioKgAskBackendBody, studioKgAskCheck, studioKgAskOn } from '@/lib/studio-kg-ask'\nimport { requireApprovedUser } from '@/lib/api-hardening'\n",
   "import { studioKgAskBackendBody, studioKgAskCheck, studioKgAskOn } from '@/lib/studio-kg-ask'\n"
  ],
  [
   "export async function POST(request: NextRequest) {\n  // STUDIO_API_HARDENING_V1_ENABLED (server, default off): approved users only, read from the DB. Off, this returns null and nothing changes.\n  const notApproved = await requireApprovedUser()\n  if (notApproved) return notApproved\n  if (process.env.NEXT_PUBLIC_STUDIO_KG_ASK !== 'true') {",
   "export async function POST(request: NextRequest) {\n  if (process.env.NEXT_PUBLIC_STUDIO_KG_ASK !== 'true') {"
  ]
 ],
 "app/api/knowledge-graph/search/route.ts": [
  [
   "import { getKgBaseUrl, kgHeaders, requireKgEntitled } from '@/lib/kg-proxy'\nimport { requireApprovedUser } from '@/lib/api-hardening'\n",
   "import { getKgBaseUrl, kgHeaders, requireKgEntitled } from '@/lib/kg-proxy'\n"
  ],
  [
   "export async function POST(request: NextRequest) {\n  // STUDIO_API_HARDENING_V1_ENABLED (server, default off): approved users only, read from the DB. Off, this returns null and nothing changes.\n  const notApproved = await requireApprovedUser()\n  if (notApproved) return notApproved\n  const gate = await requireKgEntitled()",
   "export async function POST(request: NextRequest) {\n  const gate = await requireKgEntitled()"
  ]
 ],
 "app/api/narration/render/route.ts": [
  [
   "import { DEFAULT_CLOSING_LINE } from '@/lib/narration/spoken';\nimport { requireApprovedUser } from '@/lib/api-hardening'\n",
   "import { DEFAULT_CLOSING_LINE } from '@/lib/narration/spoken';\n"
  ],
  [
   "export async function POST(request: NextRequest) {\n  // STUDIO_API_HARDENING_V1_ENABLED (server, default off): approved users only, read from the DB. Off, this returns null and nothing changes.\n  const notApproved = await requireApprovedUser()\n  if (notApproved) return notApproved\n  try {",
   "export async function POST(request: NextRequest) {\n  try {"
  ]
 ],
 "app/api/narration/script/route.ts": [
  [
   "import { narrationCallContext } from '@/lib/narration/model-router';\nimport { requireApprovedUser } from '@/lib/api-hardening'\n",
   "import { narrationCallContext } from '@/lib/narration/model-router';\n"
  ],
  [
   "export async function POST(request: NextRequest) {\n  // STUDIO_API_HARDENING_V1_ENABLED (server, default off): approved users only, read from the DB. Off, this returns null and nothing changes.\n  const notApproved = await requireApprovedUser()\n  if (notApproved) return notApproved\n  try {",
   "export async function POST(request: NextRequest) {\n  try {"
  ]
 ],
 "app/api/narration/speak/route.ts": [
  [
   "import { narrationCallContext } from '@/lib/narration/model-router';\nimport { contentKey, getMedia, putMedia } from '@/lib/narration/media-store';\nimport { getVoice } from '@/lib/narration/voices';\nimport { clientIpFrom, evaluateLimits, hashAskerIp, IP_BURST_WINDOW_MS, startOfUtcDay, startOfUtcMonth } from '@/lib/publish/qa-limits';\nimport {\n  RATE_BUCKET_SPEAK,\n  countRateEvents,\n  isApiHardeningEnabled,\n  recordRateEvent,\n  spokenAnswerCachePath,\n} from '@/lib/api-hardening';\n",
   "import { narrationCallContext } from '@/lib/narration/model-router';\n"
  ],
  [
   "        narrationEnabled: true,\n        qaDailyCap: true,\n        qaMonthlyCap: true,\n        qaVisitorBurstLimit: true,\n        qaVisitorDailyLimit: true,\n      },",
   "        narrationEnabled: true,\n      },"
  ],
  [
   "    // was worth, and the full text is already on screen with its citations.\n    const precis = spokenPrecis(text);\n\n    // STUDIO_API_HARDENING_V1_ENABLED (server, default off): a replayed answer is served from storage (one render per\n    // answer text + voice), and a fresh render is bounded by the same per-visitor and per-deck limits as /ask, counted\n    // in fe_api_rate_events. Off, every call renders and bills exactly as before.\n    let cachePath: string | null = null;\n    if (isApiHardeningEnabled()) {\n      const spec = getVoice(voice);\n      cachePath = spokenAnswerCachePath(\n        spec.id,\n        contentKey({ text: precis, model: spec.model, providerVoice: spec.providerVoice }),\n        spec.responseFormat === 'pcm' ? 'wav' : 'mp3'\n      );\n      const stored = await getMedia(cachePath);\n      if (stored) {\n        return new NextResponse(new Uint8Array(stored.body), {\n          headers: { 'Content-Type': stored.contentType, 'Cache-Control': 'no-store' },\n        });\n      }\n      const ipHash = hashAskerIp(clientIpFrom(request.headers));\n      const now = new Date();\n      const [ipInWindow, ipToday, deckToday, deckThisMonth] = await Promise.all([\n        countRateEvents({ bucket: RATE_BUCKET_SPEAK, subject: ipHash, since: new Date(now.getTime() - IP_BURST_WINDOW_MS) }),\n        countRateEvents({ bucket: RATE_BUCKET_SPEAK, subject: ipHash, since: startOfUtcDay(now) }),\n        countRateEvents({ bucket: RATE_BUCKET_SPEAK, scope: deck.id, since: startOfUtcDay(now) }),\n        countRateEvents({ bucket: RATE_BUCKET_SPEAK, scope: deck.id, since: startOfUtcMonth(now) }),\n      ]);\n      const verdict = evaluateLimits({\n        blocked: 0,\n        ipInWindow,\n        ipToday,\n        deckToday,\n        deckThisMonth,\n        deckDailyCap: deck.qaDailyCap,\n        deckMonthlyCap: deck.qaMonthlyCap,\n        visitorBurstLimit: deck.qaVisitorBurstLimit,\n        visitorDailyLimit: deck.qaVisitorDailyLimit,\n      });\n      if (!verdict.allowed) {\n        return NextResponse.json(\n          { error: 'Too many requests' },\n          {\n            status: 429,\n            headers: verdict.reason === 'rate_limited' && verdict.retryAfterSeconds\n              ? { 'Retry-After': String(verdict.retryAfterSeconds) }\n              : undefined,\n          }\n        );\n      }\n      await recordRateEvent(RATE_BUCKET_SPEAK, deck.id, ipHash);\n    }\n\n    const spoken = await speakAnswer(precis, voice, routed);\n    if (!spoken) return NextResponse.json({ error: 'Could not speak that' }, { status: 502 });",
   "    // was worth, and the full text is already on screen with its citations.\n    const spoken = await speakAnswer(spokenPrecis(text), voice, routed);\n    if (!spoken) return NextResponse.json({ error: 'Could not speak that' }, { status: 502 });"
  ],
  [
   "    if (!spoken) return NextResponse.json({ error: 'Could not speak that' }, { status: 502 });\n    if (cachePath) {\n      try {\n        await putMedia(cachePath, spoken.body, spoken.contentType);\n      } catch (error) {\n        console.error('[Narration] could not cache a spoken answer:', error);\n      }\n    }\n",
   "    if (!spoken) return NextResponse.json({ error: 'Could not speak that' }, { status: 502 });\n"
  ]
 ],
 "app/api/narration/voice/sample/[voiceId]/route.ts": [
  [
   "import { contentKey, getMedia, putMedia, voiceSamplePath } from '@/lib/narration/media-store';\nimport { requireApprovedUser } from '@/lib/api-hardening'\n",
   "import { contentKey, getMedia, putMedia, voiceSamplePath } from '@/lib/narration/media-store';\n"
  ],
  [
   ") {\n  // STUDIO_API_HARDENING_V1_ENABLED (server, default off): approved users only, read from the DB. Off, this returns null and nothing changes.\n  const notApproved = await requireApprovedUser()\n  if (notApproved) return notApproved\n  try {",
   ") {\n  try {"
  ]
 ],
 "app/api/publish/[slug]/unlock/route.ts": [
  [
   "  verifyPasscode,\n  MIN_PASSCODE_LENGTH,\n} from '@/lib/publish/passcode';",
   "  verifyPasscode,\n} from '@/lib/publish/passcode';"
  ],
  [
   "} from '@/lib/publish/passcode';\nimport { clientIpFrom, hashAskerIp } from '@/lib/publish/qa-limits';\nimport {\n  RATE_BUCKET_UNLOCK,\n  UNLOCK_WINDOW_MS,\n  countRateEvents,\n  isApiHardeningEnabled,\n  passcodeLengthPlausible,\n  recordRateEvent,\n  unlockVerdict,\n} from '@/lib/api-hardening';\n",
   "} from '@/lib/publish/passcode';\n"
  ],
  [
   "\n    // STUDIO_API_HARDENING_V1_ENABLED (server, default off): shared per-IP and per-deck failure counters with a\n    // 15-minute lockout (fe_api_rate_events), and implausible-length passcodes skip the scrypt work. Off, unchanged.\n    const hardened = isApiHardeningEnabled();\n    let ipHash = '';\n    if (hardened) {\n      ipHash = hashAskerIp(clientIpFrom(req.headers));\n      const since = new Date(Date.now() - UNLOCK_WINDOW_MS);\n      const [ipFailures, slugFailures] = await Promise.all([\n        countRateEvents({ bucket: RATE_BUCKET_UNLOCK, scope: deck.id, subject: ipHash, since }),\n        countRateEvents({ bucket: RATE_BUCKET_UNLOCK, scope: deck.id, since }),\n      ]);\n      const verdict = unlockVerdict({ ipFailures, slugFailures });\n      if (!verdict.allowed) {\n        return NextResponse.json(\n          { error: 'Too many attempts. Try again later.' },\n          { status: 429, headers: { 'Retry-After': String(verdict.retryAfterSeconds) } }\n        );\n      }\n    }\n\n    const plausible = !hardened || passcodeLengthPlausible(passcode, MIN_PASSCODE_LENGTH);\n    if (!passcode || !plausible || !verifyPasscode(passcode, deck.passcodeHash)) {\n      if (hardened) await recordRateEvent(RATE_BUCKET_UNLOCK, deck.id, ipHash);\n      await delay(FAILURE_DELAY_MS);",
   "\n    if (!passcode || !verifyPasscode(passcode, deck.passcodeHash)) {\n      await delay(FAILURE_DELAY_MS);"
  ]
 ],
 "app/api/sessions/[id]/activate/route.ts": [
  [
   "\n    // ChatSession.userId holds the user's id, never the e-mail (security audit #10: comparing with the e-mail 403'd everyone).\n    const userId = (session?.user as { id?: string | null } | undefined)?.id\n    if (!userId) {\n      return NextResponse.json(",
   "\n    if (!session?.user?.email) {\n      return NextResponse.json("
  ],
  [
   "\n    if (chatSession.userId !== userId) {\n      return NextResponse.json(",
   "\n    if (chatSession.userId !== session.user.email) {\n      return NextResponse.json("
  ]
 ],
 "app/api/slides/compose/route.ts": [
  [
   "import { composeEntitlementHeaders } from '@/lib/studio-compose-entitlement'\nimport { COMPOSE_BODY_KEYS, isApiHardeningEnabled, pickAllowedKeys, requireApprovedUser, requireSessionOwner } from '@/lib/api-hardening'\n",
   "import { composeEntitlementHeaders } from '@/lib/studio-compose-entitlement'\n"
  ],
  [
   "export async function POST(req: NextRequest) {\n  // STUDIO_API_HARDENING_V1_ENABLED (server, default off): approved users only, read from the DB. Off, this returns null and nothing changes.\n  const notApproved = await requireApprovedUser()\n  if (notApproved) return notApproved\n  if (process.env.NEXT_PUBLIC_SLIDE_COMPOSER_ENABLED !== 'true') {",
   "export async function POST(req: NextRequest) {\n  if (process.env.NEXT_PUBLIC_SLIDE_COMPOSER_ENABLED !== 'true') {"
  ],
  [
   "  }\n\n  // STUDIO_API_HARDENING_V1_ENABLED (server, default off): the session (and presentation) must be the caller's own. Off, null.\n  const notOwner = await requireSessionOwner(sessionUser?.id, body.session_id, body.presentation_id)\n  if (notOwner) return notOwner\n",
   "  }\n"
  ],
  [
   "  const payload = {\n    // Hardening on: only the keys the Studio sends are forwarded (no caller-chosen extras such as user_id overrides).\n    ...(isApiHardeningEnabled() ? pickAllowedKeys(body, COMPOSE_BODY_KEYS) : body),\n    user_id: effectiveUserId,",
   "  const payload = {\n    ...body,\n    user_id: effectiveUserId,"
  ]
 ],
 "app/api/slides/jobs/[jobId]/route.ts": [
  [
   "import { authOptions } from '@/lib/auth-options'\nimport { requireSessionOwner } from '@/lib/api-hardening'\n",
   "import { authOptions } from '@/lib/auth-options'\n"
  ],
  [
   "  }\n\n  // STUDIO_API_HARDENING_V1_ENABLED (server, default off): the session (and presentation) must be the caller's own. Off, null.\n  const notOwner = await requireSessionOwner(sessionUser?.id, sessionId, presentationId)\n  if (notOwner) return notOwner\n",
   "  }\n"
  ]
 ],
 "app/api/slides/refine/route.ts": [
  [
   "import { authOptions } from '@/lib/auth-options'\nimport { REFINE_BODY_KEYS, isApiHardeningEnabled, pickAllowedKeys, requireApprovedUser, requireSessionOwner } from '@/lib/api-hardening'\n",
   "import { authOptions } from '@/lib/auth-options'\n"
  ],
  [
   "export async function POST(req: NextRequest) {\n  // STUDIO_API_HARDENING_V1_ENABLED (server, default off): approved users only, read from the DB. Off, this returns null and nothing changes.\n  const notApproved = await requireApprovedUser()\n  if (notApproved) return notApproved\n  if (process.env.NEXT_PUBLIC_SLIDE_REFINER_ENABLED !== 'true') {",
   "export async function POST(req: NextRequest) {\n  if (process.env.NEXT_PUBLIC_SLIDE_REFINER_ENABLED !== 'true') {"
  ],
  [
   "\n  // STUDIO_API_HARDENING_V1_ENABLED (server, default off): the session (and presentation) must be the caller's own. Off, null.\n  const notOwner = await requireSessionOwner(sessionUser?.id, body.session_id, body.presentation_id)\n  if (notOwner) return notOwner\n\n  const payload = {",
   "\n  const payload = {"
  ],
  [
   "  const payload = {\n    // Hardening on: only the keys the Studio sends are forwarded.\n    ...(isApiHardeningEnabled() ? pickAllowedKeys(body, REFINE_BODY_KEYS) : body),\n    user_id: userId,",
   "  const payload = {\n    ...body,\n    user_id: userId,"
  ]
 ],
 "app/api/studio-deck-import/route.ts": [
  [
   "import { DECK_IMPORT_START_MAX_BYTES, DECK_IMPORT_WORDS, parseDeckImportStart } from '@/lib/studio-deck-import'\nimport { requireApprovedUser } from '@/lib/api-hardening'\n",
   "import { DECK_IMPORT_START_MAX_BYTES, DECK_IMPORT_WORDS, parseDeckImportStart } from '@/lib/studio-deck-import'\n"
  ],
  [
   "export async function POST(req: NextRequest) {\n  // STUDIO_API_HARDENING_V1_ENABLED (server, default off): approved users only, read from the DB. Off, this returns null and nothing changes.\n  const notApproved = await requireApprovedUser()\n  if (notApproved) return notApproved\n  if (process.env.NEXT_PUBLIC_STUDIO_DECK_IMPORT !== 'true') {",
   "export async function POST(req: NextRequest) {\n  if (process.env.NEXT_PUBLIC_STUDIO_DECK_IMPORT !== 'true') {"
  ]
 ],
 "app/api/templates/[id]/blueprint/route.ts": [
  [
   "import { authOptions } from '@/lib/auth-options';\nimport { requireApprovedUser } from '@/lib/api-hardening'\n",
   "import { authOptions } from '@/lib/auth-options';\n"
  ],
  [
   "export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {\n  // STUDIO_API_HARDENING_V1_ENABLED (server, default off): approved users only, read from the DB. Off, this returns null and nothing changes.\n  const notApproved = await requireApprovedUser()\n  if (notApproved) return notApproved\n  const userId = await resolveUserId();",
   "export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {\n  const userId = await resolveUserId();"
  ]
 ],
 "app/api/templates/[id]/enrich/route.ts": [
  [
   "import { authOptions } from '@/lib/auth-options';\nimport { requireApprovedUser } from '@/lib/api-hardening'\n",
   "import { authOptions } from '@/lib/auth-options';\n"
  ],
  [
   "export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {\n  // STUDIO_API_HARDENING_V1_ENABLED (server, default off): approved users only, read from the DB. Off, this returns null and nothing changes.\n  const notApproved = await requireApprovedUser()\n  if (notApproved) return notApproved\n  const userId = await resolveUserId();",
   "export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {\n  const userId = await resolveUserId();"
  ]
 ],
 "app/api/templates/route.ts": [
  [
   "import { authOptions } from '@/lib/auth-options';\nimport { requireApprovedUser } from '@/lib/api-hardening'\n",
   "import { authOptions } from '@/lib/auth-options';\n"
  ],
  [
   "export async function POST(req: NextRequest) {\n  // STUDIO_API_HARDENING_V1_ENABLED (server, default off): approved users only, read from the DB. Off, this returns null and nothing changes.\n  const notApproved = await requireApprovedUser()\n  if (notApproved) return notApproved\n  const userId = await resolveUserId();",
   "export async function POST(req: NextRequest) {\n  const userId = await resolveUserId();"
  ]
 ],
 "app/api/themes/route.ts": [
  [
   "import { authOptions } from '@/lib/auth-options'\nimport { requireApprovedUser } from '@/lib/api-hardening'\n",
   "import { authOptions } from '@/lib/auth-options'\n"
  ],
  [
   "export async function POST(req: NextRequest) {\n  // STUDIO_API_HARDENING_V1_ENABLED (server, default off): approved users only, read from the DB. Off, this returns null and nothing changes.\n  const notApproved = await requireApprovedUser()\n  if (notApproved) return notApproved\n  const userId = await resolveUserId()",
   "export async function POST(req: NextRequest) {\n  const userId = await resolveUserId()"
  ]
 ],
 "app/api/upload/route.ts": [
  [
   "} from '@/lib/knowledge-service-client';\nimport { requireApprovedUser } from '@/lib/api-hardening'\n",
   "} from '@/lib/knowledge-service-client';\n"
  ],
  [
   "export async function POST(req: NextRequest) {\n  // STUDIO_API_HARDENING_V1_ENABLED (server, default off): approved users only, read from the DB. Off, this returns null and nothing changes.\n  const notApproved = await requireApprovedUser()\n  if (notApproved) return notApproved\n  try {",
   "export async function POST(req: NextRequest) {\n  try {"
  ]
 ],
 "middleware.ts": [
  [
   "import { studioP2AdminOn } from \"@/lib/studio-p2-admin\"\nimport { isAdminEmail } from \"@/lib/api-hardening-core\"\n",
   "import { studioP2AdminOn } from \"@/lib/studio-p2-admin\"\n"
  ],
  [
   "    const email = (req as any).nextauth.token?.email\n    // STUDIO_API_HARDENING_V1_ENABLED: on, ADMIN_EMAILS only; off, DEV_BYPASS_EMAIL as before.\n    if (!isAdminEmail(email, {\n      STUDIO_API_HARDENING_V1_ENABLED: process.env.STUDIO_API_HARDENING_V1_ENABLED,\n      DEV_BYPASS_EMAIL: process.env.DEV_BYPASS_EMAIL,\n      ADMIN_EMAILS: process.env.ADMIN_EMAILS,\n    })) {\n      return NextResponse.redirect(new URL(\"/builder\", req.url))",
   "    const email = (req as any).nextauth.token?.email\n    if (!email || email !== process.env.DEV_BYPASS_EMAIL) {\n      return NextResponse.redirect(new URL(\"/builder\", req.url))"
  ]
 ],
 "prisma/schema.prisma": [
  [
   "\n/// Studio API hardening v1 (STUDIO_API_HARDENING_V1_ENABLED): shared attempt counters for public endpoints\n/// (publish unlock failures, spoken-answer renders). One row per counted event; `subject` is an HMAC of the IP.\n/// Read only while the flag is on; apply prisma/sql/20261104_api_rate_events.sql before turning it on.\nmodel ApiRateEvent {\n  id        String   @id @default(cuid())\n  bucket    String\n  scope     String\n  subject   String\n  createdAt DateTime @default(now()) @map(\"created_at\")\n\n  @@index([bucket, scope, createdAt])\n  @@index([bucket, subject, createdAt])\n  @@map(\"fe_api_rate_events\")\n}\n",
   ""
  ]
 ]
}

export const API_HARDENING_SCOPE_FILES = new Set([
  ...Object.keys(API_HARDENING_EDITS),
  ...API_HARDENING_DELETED,
  ...API_HARDENING_NEW_FILES,
  'scripts/studio-later-changes.mjs',
  '.env.example',
  'app/api/dev/mock-token/route.ts', // touched by this branch's first commit (deleted) and its second (put back to the base): net unchanged; the deletion lives in #571
  // the older proofs this change taught to read through it
  'scripts/test-admin-email-guard.mjs',
  'scripts/test-studio-kg-ask.mjs',
  'scripts/test-studio-legal-short-links.mjs',
  'scripts/test-studio-d1-debug-routes.mjs',
  'scripts/test-studio-dev-dependencies.mjs',
  'scripts/test-studio-narration-router.mjs',
  'scripts/test-studio-p2-admin.mjs',
  'scripts/test-studio-uat-marketing.mjs',
  'scripts/test-studio-template-library-manage.mjs',
  'scripts/test-studio-tl-signed-requests.mjs',
])

export const API_HARDENING_ENV_BLOCK = `# STUDIO API HARDENING V1 (PROGRAM-1 / FRONTEND-1; security audit items 2, 5, 6, 7, 9, 10). Server only; on for the exact value "true", default off, and then every route behaves as before.
# On: approved users only on the paid routes, session owners checked, request bodies allow-listed, publish unlock lockout, spoken-answer cache, and admin = ADMIN_EMAILS only.
# BEFORE turning it on: apply prisma/sql/20261104_api_rate_events.sql and set ADMIN_EMAILS (empty = nobody is admin).
STUDIO_API_HARDENING_V1_ENABLED="false"
# Admins while STUDIO_API_HARDENING_V1_ENABLED is on: comma-separated emails, matched case-insensitively. Empty = nobody (fail closed). Ignored while the flag is off (DEV_BYPASS_EMAIL is admin then).
ADMIN_EMAILS=""
`

export function stripApiHardening(rel, text) {
  if (rel === '.env.example' && typeof text === 'string') return text.split('\n' + API_HARDENING_ENV_BLOCK).length === 2 ? text.replace('\n' + API_HARDENING_ENV_BLOCK, '') : text
  const edits = API_HARDENING_EDITS[rel]
  if (!edits || typeof text !== 'string') return text
  if (!edits.every(([added]) => text.split(added).length === 2)) return text
  let out = text
  for (const [added, base] of edits) out = out.replace(added, () => base)
  return out
}
