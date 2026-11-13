// FRONTEND-1 (13 Nov 2026): P-73 / P-74 from AUDIT-2's FINDINGS (found by KNOWLEDGE-3, confirmed by REVIEW-1). NO flag: it closes a data leak, so it applies everywhere (the precedent is the tier guard, PR #575, and the D1
// debug routes: PROGRAM-1's "by design, no flag"). POST /api/sessions answered 409 with the WHOLE row (userId, presentation urls and ids, the Knowledge store ids) of ANY user's chat to any signed-in caller who sent its id; now another
// user's id is a 404 with no row, the caller's own row is answered with the two fields the Builder reads (lib allow-list via pickAllowedKeys), the client only adopts a row that carries the id it asked for, and the route no longer logs
// the DATABASE_URL prefix, the e-mail or raw error text, nor echoes raw error text in a 500.
// How the older pins reach it: this change REGISTERS its files and its strip in scripts/studio-later-changes.mjs (two lines; no .env.example block: there is no flag). The strip puts back each edited file's base text:
// SESSIONS_OWNER_PAIRS holds, per file, [the text this change left, the base text it replaced] (each with two lines of context, each present exactly once), applied in order, only when every one of them is there. Any other file, and a
// file that does not carry this change's text, comes back as it is. The two older proofs' taught line is a pair with an empty base text (the line comes out).
// FOLLOW-UP (13 Nov, REVIEW-1's two P3s and DIRECTOR-2's 14:55Z recommendation, a Draft stacked on this change):
//   - the route logs no account id and no chat id on any path (the booleans stay; the pairs for those lines above are the follow-up's text);
//   - a URL session id that POST /api/sessions refuses (404: another account's chat) is never kept: the Builder mints a fresh id, creates its row, replaces the URL (no history entry) and opens the Director socket on the fresh id only
//     (hooks/use-builder-session.ts, its adoption branch; hooks/use-chat-sessions.ts says which id was refused). Every line this follow-up adds to those two EXISTING files carries the marker SESSIONS-OWNER (a whole token) and is a PURE INSERTION:
//     no base line of the hook is rewritten (older proofs hold every base line of it, in order), so each pair has an empty base text. The Builder page is not touched.
// Plain node, no imports, nothing read from disk or git here.

/** The marker every line this follow-up inserts into the two hooks carries, as a WHOLE token (SESSIONS-OWNER-X and X-SESSIONS-OWNER are not it). */
export const SESSIONS_OWNER_MARKER = 'SESSIONS-OWNER'
export const SESSIONS_OWNER_MARKER_RE = /(?<![\w-])SESSIONS-OWNER(?![\w-])/
/** The two hooks that get marked pure insertions (each pair of theirs past this change's own two in the chat hook has an empty base text). */
export const SESSIONS_OWNER_INSERTED_FILES = ['hooks/use-builder-session.ts', 'hooks/use-chat-sessions.ts']

export const BASE_COMMIT = '2f06e51ec807d4ecd5cd00edc9bfd0005a5fd0b8' // origin/studio-v4-dev-preparation-code when FRONTEND-1 cut this change
export const SESSIONS_OWNER_SCOPE_FILES = [
  'app/api/sessions/route.ts',
  'hooks/use-chat-sessions.ts',
  'hooks/use-builder-session.ts', // follow-up: marked pure insertions (the adoption branch mints a fresh id for a refused URL id)
  'scripts/test-studio-sessions-owner.mjs',
  'scripts/studio-sessions-owner-strip.mjs',
  'scripts/studio-later-changes.mjs',
  'scripts/test-studio-deck-sync-truth.mjs', // taught: one registry-read line (the first-parent commit filter), as every later change before it
  'scripts/test-studio-chat-element-edit.mjs', // taught: the same line
  'scripts/test-studio-session-hygiene.mjs', // taught: its scripted history API answers the caller's own existing row 200 as the route now does (two marked lines)
]

/** The one line this change taught the two older proofs that read their own first-parent commits (a filter by this change's commit subject). Read through the registry, an older pin or a later change's pin sees them as they were. */
export const SESSIONS_OWNER_PIN_LINE = "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Sessions:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (SESSIONS-OWNER): on a branch stacked after this change (the sessions owner check, P-73 / P-74), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n"

/** [now, before] pairs per file: the strip puts the base's text back (each `now` sits in the head's file exactly once). Generated from the diff against BASE_COMMIT. */
export const SESSIONS_OWNER_PAIRS = {
 "scripts/test-studio-chat-element-edit.mjs": [[SESSIONS_OWNER_PIN_LINE, '']],
 "scripts/test-studio-deck-sync-truth.mjs": [[SESSIONS_OWNER_PIN_LINE, '']],
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
   " * - sessionId: string (UUID from WebSocket)\n * - title?: string (optional initial title)\n *\n * Answers (a 2xx always means the row is the caller's):\n * - 201 { session }                      a new row, owned by the caller\n * - 200 { session }                      the caller's OWN row already has that id (it was a 409 with the whole row before P-73)\n * - 404 { error: 'Session not found' }   the id is another user's chat: no row, nothing about its owner, nothing written (P-73)\n * Logs carry no e-mail, no account or chat id, no DATABASE_URL and no raw error text; a 500 answers a generic message (P-74).\n */\nexport async function POST(req: NextRequest) {\n",
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
   "          }\n        });\n        console.log('[Session Create] ✅ User created successfully');\n      } catch (createError: any) {\n        console.error('[Session Create] ❌ Failed to create user:');\n        console.error('[Session Create] Code:', createError.code);\n        return NextResponse.json(\n          { error: 'Failed to create user account' },\n          { status: 500 }\n        );\n      }\n    } else {\n      console.log('[Session Create] ✅ User found in database');\n    }\n\n",
   "          }\n        });\n        console.log('[Session Create] ✅ User created successfully:', user.id);\n      } catch (createError: any) {\n        console.error('[Session Create] ❌ Failed to create user:');\n        console.error('[Session Create] Error:', createError.message);\n        console.error('[Session Create] Code:', createError.code);\n        return NextResponse.json(\n          { error: 'Failed to create user account', details: createError.message },\n          { status: 500 }\n        );\n      }\n    } else {\n      console.log('[Session Create] ✅ User found in database:', user.id);\n    }\n\n"
  ],
  [
   "    const body = await req.json();\n    const { sessionId, title } = body;\n    console.log('[Session Create] Session ID given:', !!sessionId);\n    console.log('[Session Create] Title given:', !!title);\n\n    if (!sessionId) {\n",
   "    const body = await req.json();\n    const { sessionId, title } = body;\n    console.log('[Session Create] Session ID:', sessionId);\n    console.log('[Session Create] Title:', title || '(no title)');\n\n    if (!sessionId) {\n"
  ],
  [
   "\n    if (existing) {\n      // Another user's chat is answered exactly like an id that cannot be used: no row, nothing about its owner (P-73).\n      // The [id] routes check the owner the same way (app/api/sessions/[id]/route.ts).\n      if (existing.userId !== user.id) {\n        console.warn('[Session Create] ⚠️ Session id belongs to another user, refused');\n        return NextResponse.json(\n          { error: 'Session not found' },\n          { status: 404 }\n        );\n      }\n\n      console.log('[Session Create] ⚠️ Session already exists (the caller\\'s own)');\n      return NextResponse.json(\n        { session: pickAllowedKeys(existing, SESSION_CREATE_RESPONSE_KEYS) },\n        { status: 200 }\n      );\n    }\n",
   "\n    if (existing) {\n      console.log('[Session Create] ⚠️ Session already exists:', sessionId);\n      return NextResponse.json(\n        { error: 'Session already exists', session: existing },\n        { status: 409 }\n      );\n    }\n"
  ],
  [
   "    console.log('[Session Create] Step 6: Creating chat session...');\n    console.log('[Session Create] Data:', {\n      hasTitle: !!title,\n      currentStage: 1,\n      status: 'active'\n",
   "    console.log('[Session Create] Step 6: Creating chat session...');\n    console.log('[Session Create] Data:', {\n      id: sessionId,\n      userId: user.id,\n      title: title || null,\n      currentStage: 1,\n      status: 'active'\n"
  ],
  [
   "    });\n\n    console.log('[Session Create] ✅ Chat session created successfully');\n    console.log('='.repeat(80));\n\n    return NextResponse.json({\n      session: pickAllowedKeys(newSession, SESSION_CREATE_RESPONSE_KEYS)\n    }, { status: 201 });\n\n  } catch (error: any) {\n    // The error's kind and code only: a Prisma message quotes the query (the e-mail included) and a connection error can quote the URL.\n    console.error('='.repeat(80));\n    console.error('[Session Create] ❌ FATAL ERROR creating session');\n    console.error('[Session Create] Error type:', error?.constructor?.name);\n    console.error('[Session Create] Error code:', error?.code);\n    console.error('[Session Create] Client version:', error?.clientVersion);\n    console.error('='.repeat(80));\n\n    return NextResponse.json(\n      { error: 'Internal server error' },\n      { status: 500 }\n    );\n",
   "    });\n\n    console.log('[Session Create] ✅ Chat session created successfully:', newSession.id);\n    console.log('='.repeat(80));\n\n    return NextResponse.json({\n      session: newSession\n    }, { status: 201 });\n\n  } catch (error: any) {\n    console.error('='.repeat(80));\n    console.error('[Session Create] ❌ FATAL ERROR creating session');\n    console.error('[Session Create] Error type:', error.constructor?.name);\n    console.error('[Session Create] Error message:', error.message);\n    console.error('[Session Create] Error code:', error.code);\n    console.error('[Session Create] Error meta:', error.meta);\n    console.error('[Session Create] Client version:', error.clientVersion);\n    console.error('[Session Create] Full error:', JSON.stringify(error, null, 2));\n    console.error('[Session Create] Stack trace:', error.stack);\n    console.error('='.repeat(80));\n\n    return NextResponse.json(\n      {\n        error: 'Internal server error',\n        details: error.message,\n        code: error.code\n      },\n      { status: 500 }\n    );\n"
  ]
 ],
 "hooks/use-builder-session.ts": [
  [
   "import { createSessionWasRefused } from '@/hooks/use-chat-sessions' // SESSIONS-OWNER: whether POST /api/sessions refused the URL's id as another account's chat\n",
   ""
  ],
  [
   "            if (!adopted && createSessionWasRefused(sessionParam)) { // SESSIONS-OWNER (13 Nov, REVIEW-1 P3 and DIRECTOR-2): POST /api/sessions answered 404: this id is another account's chat (a missing id is created, 201). Never keep it, not even as an unsaved local session, and never open the Director socket on it\n              const ownSessionId = crypto.randomUUID() // SESSIONS-OWNER: a fresh id of the caller's own, as the bare /builder branch below mints one\n              console.warn('⚠️ [SESSIONS-OWNER] The URL session is not this account\\'s; starting a new session under a fresh id') // SESSIONS-OWNER\n              const ownRow = await createSession(ownSessionId) // SESSIONS-OWNER: the row for the caller's own id; a failure keeps the fresh id as an unsaved local session, as the adoption below does\n              if (!mayContinueInitialization() || (ownRow && ownRow.id !== ownSessionId)) return // SESSIONS-OWNER\n              recordStudioFreshAssignment(ownSessionId, { kind: 'local_uuid', generatedSessionId: ownSessionId }) // SESSIONS-OWNER\n              clearMessages() // SESSIONS-OWNER\n              setUserMessages([]) // SESSIONS-OWNER\n              setCurrentSessionId(ownSessionId) // SESSIONS-OWNER: the socket (existingSessionId) and every later write use this id from here\n              setSessionStoreName(ownRow?.geminiStoreName || null) // SESSIONS-OWNER\n              setIsUnsavedSession(!ownRow) // SESSIONS-OWNER\n              try { if (builderCacheOwner) { if (ownRow) sessionStorage.removeItem(unsavedBuilderSessionKey(builderCacheOwner, ownSessionId)); else sessionStorage.setItem(unsavedBuilderSessionKey(builderCacheOwner, ownSessionId), 'true') } } catch {} // SESSIONS-OWNER\n              setIsResumedSession(false) // SESSIONS-OWNER\n              lastLoadedSessionRef.current = ownSessionId // SESSIONS-OWNER: the URL change below must not load it again\n              router.replace(getInitializedBuilderHref(searchParams, ownSessionId, process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'), { scroll: false }) // SESSIONS-OWNER: replace, not push: Back does not return to the other account's id\n              return // SESSIONS-OWNER\n            } // SESSIONS-OWNER\n",
   ""
  ]
 ],
 "hooks/use-chat-sessions.ts": [
  [
   "    });\n\n    if (response.ok) { // POST /api/sessions: 201 a new row, 200 the caller's own row; another account's id is a 404 and a 409 is never an adoption (P-73)\n      console.warn('[useChatSessions] Recovered missing session row:', sessionId);\n      return true;\n",
   "    });\n\n    if (response.ok || response.status === 409) {\n      console.warn('[useChatSessions] Recovered missing session row:', sessionId);\n      return true;\n"
  ],
  [
   "\n      if (!response.ok) {\n        // Try to get error details from response\n        let errorMessage = response.statusText;\n",
   "\n      if (!response.ok) {\n        // If conflict (409), session already exists - that's ok\n        if (response.status === 409) {\n          console.log('[useChatSessions] Session already exists (409)');\n          const data = await response.json();\n          return data.session;\n        }\n\n        // Try to get error details from response\n        let errorMessage = response.statusText;\n"
  ],
  [
   "\n// SESSIONS-OWNER (13 Nov, REVIEW-1 P3 and DIRECTOR-2): POST /api/sessions answers 404 for an id that is another account's chat (a missing id is created, 201). createSession answers null for that, as it does for every failure,\n// SESSIONS-OWNER: so the Builder's URL-session adoption asks here, right after its own call, whether the id it tried was refused as someone else's (it then starts a new session under a fresh id and never keeps that one).\nconst refusedCreateIds = new Set<string>(); // SESSIONS-OWNER\n/** True when the latest createSession call made for this id was answered 404: the id is another account's chat. Every call for an id clears its mark first (a call that got no answer leaves none), so a mark is never older than its call. */ // SESSIONS-OWNER\nexport function createSessionWasRefused(sessionId: string): boolean { return refusedCreateIds.has(sessionId); } // SESSIONS-OWNER\n",
   ""
  ],
  [
   "      refusedCreateIds.delete(sessionId); // SESSIONS-OWNER\n",
   ""
  ],
  [
   "      if (response.status === 404) refusedCreateIds.add(sessionId); // SESSIONS-OWNER\n",
   ""
  ]
 ],
 "scripts/test-studio-session-hygiene.mjs": [
  [
   "      if (method === 'POST' && faults.posts > 0) { faults.posts--; status = 500; out = { error: 'boom' } }\n      else if (method === 'POST') {\n        if (rows.has(body.sessionId)) { status = 200; out = { session: { id: body.sessionId, geminiStoreName: rows.get(body.sessionId).geminiStoreName ?? null } } } // LATER-CHANGES: registry read (SESSIONS-OWNER): the route answers the caller's own existing row 200 with the allow-listed row (it was a 409 with the whole row)\n        else { const row = { id: body.sessionId, status: 'active', title: body.title || 'Untitled Session', messages: [] }; rows.set(row.id, row); status = 201; out = { session: row } }\n      } else out = { sessions: [], pagination: { total: 0, limit: 50, offset: 0, hasMore: false } }\n",
   "      if (method === 'POST' && faults.posts > 0) { faults.posts--; status = 500; out = { error: 'boom' } }\n      else if (method === 'POST') {\n        if (rows.has(body.sessionId)) { status = 409; out = { session: rows.get(body.sessionId) } }\n        else { const row = { id: body.sessionId, status: 'active', title: body.title || 'Untitled Session', messages: [] }; rows.set(row.id, row); status = 201; out = { session: row } }\n      } else out = { sessions: [], pagination: { total: 0, limit: 50, offset: 0, hasMore: false } }\n"
  ],
  [
   "    check(assert.equal, bug.api.rowCreations().length, 1, 'pre-fix, flag on: a bare visit creates the empty row (the live \"Untitled Session\")')\n    check(assert.equal, patches404(bug), 8, 'pre-fix, flag on: after eight PATCH 404s (two updates x four attempts), as in the live trace')\n    check(assert.equal, bug.api.count('POST', 200), 1, 'pre-fix, flag on: with the second update\\'s recovery POST answering 200 (the row exists; a 409 before the sessions owner check)') // LATER-CHANGES: registry read (SESSIONS-OWNER)\n    check(assert.equal, bug.api.count('PATCH', 200), 2, 'pre-fix, flag on: then both PATCHes land')\n    check(assert.equal, bug.api.calls[0].method + ' ' + bug.api.calls[0].status, 'GET 404', 'pre-fix, flag on: after the one lookup that 404ed')\n",
   "    check(assert.equal, bug.api.rowCreations().length, 1, 'pre-fix, flag on: a bare visit creates the empty row (the live \"Untitled Session\")')\n    check(assert.equal, patches404(bug), 8, 'pre-fix, flag on: after eight PATCH 404s (two updates x four attempts), as in the live trace')\n    check(assert.equal, bug.api.count('POST', 409), 1, 'pre-fix, flag on: with the second update\\'s recovery POST answering 409')\n    check(assert.equal, bug.api.count('PATCH', 200), 2, 'pre-fix, flag on: then both PATCHes land')\n    check(assert.equal, bug.api.calls[0].method + ' ' + bug.api.calls[0].status, 'GET 404', 'pre-fix, flag on: after the one lookup that 404ed')\n"
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
