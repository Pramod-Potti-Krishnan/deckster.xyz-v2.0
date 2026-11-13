// FRONTEND-1 (13 Nov 2026): P-73 / P-74 from AUDIT-2's FINDINGS (found by KNOWLEDGE-3, confirmed by REVIEW-1). NO flag: it closes a data leak, so it applies everywhere (the precedent is the tier guard, PR #575, and the D1
// debug routes: PROGRAM-1's "by design, no flag"). POST /api/sessions answered 409 with the WHOLE row (userId, presentation urls and ids, the Knowledge store ids) of ANY user's chat to any signed-in caller who sent its id; now another
// user's id is a 404 with no row, the caller's own row is answered with the two fields the Builder reads (lib allow-list via pickAllowedKeys), the client only adopts a row that carries the id it asked for, and the route no longer logs
// the DATABASE_URL prefix, the e-mail or raw error text, nor echoes raw error text in a 500.
// How the older pins reach it: this change REGISTERS its files and its strip in scripts/studio-later-changes.mjs (two lines; no .env.example block: there is no flag). The strip puts back each edited file's base text:
// SESSIONS_OWNER_PAIRS holds, per file, [the text this change left, the base text it replaced] (each with two lines of context, each present exactly once), applied in order, only when every one of them is there. Any other file, and a
// file that does not carry this change's text, comes back as it is. Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '2f06e51ec807d4ecd5cd00edc9bfd0005a5fd0b8' // origin/studio-v4-dev-preparation-code when FRONTEND-1 cut this change
export const SESSIONS_OWNER_SCOPE_FILES = [
  'app/api/sessions/route.ts',
  'hooks/use-chat-sessions.ts',
  'scripts/test-studio-sessions-owner.mjs',
  'scripts/studio-sessions-owner-strip.mjs',
  'scripts/studio-later-changes.mjs',
  'scripts/test-studio-deck-sync-truth.mjs', // taught: one registry-read line (the first-parent commit filter), as every later change before it
  'scripts/test-studio-chat-element-edit.mjs', // taught: the same line
]

/** [now, before] pairs per file: the strip puts the base's text back (each `now` sits in the head's file exactly once). Generated from the diff against BASE_COMMIT. */
export const SESSIONS_OWNER_PAIRS = {
 "app/api/sessions/route.ts": [
  [
   "import { authOptions } from '@/lib/auth-options';\nimport { prisma } from '@/lib/prisma';\nimport { pickAllowedKeys } from '@/lib/api-hardening-core';\n\n/**\n",
   "import { authOptions } from '@/lib/auth-options';\nimport { prisma } from '@/lib/prisma';\n\n/**\n"
  ],
  [
   "}\n\n/**\n * What POST answers with for a chat session row: the two fields the Builder's clients read (the id, and geminiStoreName\n * when it adopts an id), nothing else. The row also holds userId, the presentation urls and ids and the Knowledge store\n * ids, which a caller never needs back from a create (P-73).\n */\nconst SESSION_CREATE_RESPONSE_KEYS = ['id', 'geminiStoreName'] as const;\n\n/**\n * POST /api/sessions\n",
   "}\n\n/**\n * POST /api/sessions\n"
  ],
  [
   " * - sessionId: string (UUID from WebSocket)\n * - title?: string (optional initial title)\n *\n * Answers:\n * - 201 { session }                      a new row, owned by the caller\n * - 409 { error, session }               the caller's OWN row already has that id (the client treats it as success)\n * - 404 { error: 'Session not found' }   the id is another user's chat: no row, nothing about its owner (P-73)\n * Logs carry no e-mail, no DATABASE_URL and no raw error text; a 500 answers a generic message (P-74).\n */\nexport async function POST(req: NextRequest) {\n",
   " * - sessionId: string (UUID from WebSocket)\n * - title?: string (optional initial title)\n */\nexport async function POST(req: NextRequest) {\n"
  ],
  [
   "  console.log('[Session Create] Environment:', process.env.NODE_ENV);\n  console.log('[Session Create] DATABASE_URL configured:', !!process.env.DATABASE_URL);\n  console.log('[Session Create] DIRECT_URL configured:', !!process.env.DIRECT_URL);\n\n",
   "  console.log('[Session Create] Environment:', process.env.NODE_ENV);\n  console.log('[Session Create] DATABASE_URL configured:', !!process.env.DATABASE_URL);\n  console.log('[Session Create] DATABASE_URL prefix:', process.env.DATABASE_URL?.substring(0, 40) + '...');\n  console.log('[Session Create] DIRECT_URL configured:', !!process.env.DIRECT_URL);\n\n"
  ],
  [
   "    }\n\n    console.log('[Session Create] ✅ Authenticated');\n\n    // Get user from database\n    console.log('[Session Create] Step 2: Finding user in database...');\n    console.log('[Session Create] Attempting Prisma query: user.findUnique by email');\n\n    let user;\n",
   "    }\n\n    console.log('[Session Create] ✅ Authenticated user:', session.user.email);\n\n    // Get user from database\n    console.log('[Session Create] Step 2: Finding user in database...');\n    console.log('[Session Create] Attempting Prisma query: user.findUnique({ where: { email:', session.user.email, '}})');\n\n    let user;\n"
  ],
  [
   "      console.error('[Session Create] ❌ Database error during user lookup:');\n      console.error('[Session Create] Error name:', dbError.name);\n      console.error('[Session Create] Error code:', dbError.code);\n      console.error('[Session Create] Client version:', dbError.clientVersion);\n      throw dbError; // Re-throw to be caught by outer catch\n",
   "      console.error('[Session Create] ❌ Database error during user lookup:');\n      console.error('[Session Create] Error name:', dbError.name);\n      console.error('[Session Create] Error message:', dbError.message);\n      console.error('[Session Create] Error code:', dbError.code);\n      console.error('[Session Create] Error meta:', dbError.meta);\n      console.error('[Session Create] Client version:', dbError.clientVersion);\n      throw dbError; // Re-throw to be caught by outer catch\n"
  ],
  [
   "    // If user doesn't exist in DB (shouldn't happen with PrismaAdapter, but handle gracefully)\n    if (!user) {\n      console.warn('[Session Create] ⚠️ User not found in database, creating');\n      console.log('[Session Create] Step 3: Creating user in database...');\n\n",
   "    // If user doesn't exist in DB (shouldn't happen with PrismaAdapter, but handle gracefully)\n    if (!user) {\n      console.warn('[Session Create] ⚠️ User not found in database, creating:', session.user.email);\n      console.log('[Session Create] Step 3: Creating user in database...');\n\n"
  ],
  [
   "      } catch (createError: any) {\n        console.error('[Session Create] ❌ Failed to create user:');\n        console.error('[Session Create] Code:', createError.code);\n        return NextResponse.json(\n          { error: 'Failed to create user account' },\n          { status: 500 }\n        );\n",
   "      } catch (createError: any) {\n        console.error('[Session Create] ❌ Failed to create user:');\n        console.error('[Session Create] Error:', createError.message);\n        console.error('[Session Create] Code:', createError.code);\n        return NextResponse.json(\n          { error: 'Failed to create user account', details: createError.message },\n          { status: 500 }\n        );\n"
  ],
  [
   "    const { sessionId, title } = body;\n    console.log('[Session Create] Session ID:', sessionId);\n    console.log('[Session Create] Title given:', !!title);\n\n    if (!sessionId) {\n",
   "    const { sessionId, title } = body;\n    console.log('[Session Create] Session ID:', sessionId);\n    console.log('[Session Create] Title:', title || '(no title)');\n\n    if (!sessionId) {\n"
  ],
  [
   "\n    if (existing) {\n      // Another user's chat is answered exactly like an id that cannot be used: no row, nothing about its owner (P-73).\n      // The [id] routes check the owner the same way (app/api/sessions/[id]/route.ts).\n      if (existing.userId !== user.id) {\n        console.warn('[Session Create] ⚠️ Session id belongs to another user, refused:', sessionId);\n        return NextResponse.json(\n          { error: 'Session not found' },\n          { status: 404 }\n        );\n      }\n\n      console.log('[Session Create] ⚠️ Session already exists:', sessionId);\n      return NextResponse.json(\n        { error: 'Session already exists', session: pickAllowedKeys(existing, SESSION_CREATE_RESPONSE_KEYS) },\n        { status: 409 }\n      );\n",
   "\n    if (existing) {\n      console.log('[Session Create] ⚠️ Session already exists:', sessionId);\n      return NextResponse.json(\n        { error: 'Session already exists', session: existing },\n        { status: 409 }\n      );\n"
  ],
  [
   "      id: sessionId,\n      userId: user.id,\n      hasTitle: !!title,\n      currentStage: 1,\n      status: 'active'\n",
   "      id: sessionId,\n      userId: user.id,\n      title: title || null,\n      currentStage: 1,\n      status: 'active'\n"
  ],
  [
   "\n    return NextResponse.json({\n      session: pickAllowedKeys(newSession, SESSION_CREATE_RESPONSE_KEYS)\n    }, { status: 201 });\n\n  } catch (error: any) {\n    // The error's kind and code only: a Prisma message quotes the query (the e-mail included) and a connection error can quote the URL.\n    console.error('='.repeat(80));\n    console.error('[Session Create] ❌ FATAL ERROR creating session');\n    console.error('[Session Create] Error type:', error?.constructor?.name);\n    console.error('[Session Create] Error code:', error?.code);\n    console.error('[Session Create] Client version:', error?.clientVersion);\n    console.error('='.repeat(80));\n\n    return NextResponse.json(\n      { error: 'Internal server error' },\n      { status: 500 }\n    );\n",
   "\n    return NextResponse.json({\n      session: newSession\n    }, { status: 201 });\n\n  } catch (error: any) {\n    console.error('='.repeat(80));\n    console.error('[Session Create] ❌ FATAL ERROR creating session');\n    console.error('[Session Create] Error type:', error.constructor?.name);\n    console.error('[Session Create] Error message:', error.message);\n    console.error('[Session Create] Error code:', error.code);\n    console.error('[Session Create] Error meta:', error.meta);\n    console.error('[Session Create] Client version:', error.clientVersion);\n    console.error('[Session Create] Full error:', JSON.stringify(error, null, 2));\n    console.error('[Session Create] Stack trace:', error.stack);\n    console.error('='.repeat(80));\n\n    return NextResponse.json(\n      {\n        error: 'Internal server error',\n        details: error.message,\n        code: error.code\n      },\n      { status: 500 }\n    );\n"
  ]
 ],
 "hooks/use-chat-sessions.ts": [
  [
   "}\n\n/**\n * POST /api/sessions answers 201 { session } for a new row and 409 { error, session } for the caller's OWN row with that id;\n * an id that belongs to another account is a 404 with no row (P-73). Only a row that carries the id that was asked for is\n * this account's session: anything else is not an adoption.\n */\nfunction ownRowFromCreateAnswer(body: any, sessionId: string): ChatSession | null {\n  const row = body?.session;\n  return row && typeof row === 'object' && row.id === sessionId ? (row as ChatSession) : null;\n}\n\nasync function ensureSessionRow(sessionId: string): Promise<boolean> {\n  try {\n",
   "}\n\nasync function ensureSessionRow(sessionId: string): Promise<boolean> {\n  try {\n"
  ],
  [
   "    });\n\n    if (response.ok || (response.status === 409 && ownRowFromCreateAnswer(await response.json().catch(() => null), sessionId))) {\n      console.warn('[useChatSessions] Recovered missing session row:', sessionId);\n      return true;\n",
   "    });\n\n    if (response.ok || response.status === 409) {\n      console.warn('[useChatSessions] Recovered missing session row:', sessionId);\n      return true;\n"
  ],
  [
   "\n      if (!response.ok) {\n        // If conflict (409), session already exists - that's ok when it is this account's own row\n        if (response.status === 409) {\n          const row = ownRowFromCreateAnswer(await response.json().catch(() => null), sessionId);\n          if (!row) throw new Error('Failed to create session (409): the existing session is not available');\n          console.log('[useChatSessions] Session already exists (409)');\n          return row;\n        }\n\n",
   "\n      if (!response.ok) {\n        // If conflict (409), session already exists - that's ok\n        if (response.status === 409) {\n          console.log('[useChatSessions] Session already exists (409)');\n          const data = await response.json();\n          return data.session;\n        }\n\n"
  ]
 ]
}

/** (rel, text) => text: an owned file comes back as the base's file; any other file, or a file that does not carry this change's text, comes back as it is. */
export function stripSessionsOwner(rel, text) {
  const pairs = SESSIONS_OWNER_PAIRS[rel]
  if (!pairs || typeof text !== 'string') return text
  let out = text
  for (const [now, before] of pairs) {
    if (out.split(now).length !== 2) return text
    out = out.replace(now, () => before)
  }
  return out
}
