// FRONTEND-2 (25 Oct 2026): D1, the prod security hotfix PK approved at 12:28Z ("all as recommended"). NO flag: it is a security fix (PK's ruling). The SAME change goes to main (frontend2/d1-prod-debug-routes-main).
//   - app/api/debug/check-env/route.ts and app/api/test-env/route.ts are deleted (the routes 404). check-env answered the length and first characters of NEXTAUTH_SECRET to anyone; middleware.ts covers no /api path.
//   - GET /api/admin/cleanup-sessions (the dry run, which lists abandoned session ids with their owners' user ids) needs the Vercel cron's `Authorization: Bearer <CRON_SECRET>` with CRON_SECRET non-empty, or a signed-in
//     admin by the coupons route's isAdmin (DEV_BYPASS_EMAIL). Anything else is 401 { error: 'Unauthorized' } before any database call. POST (the real delete) is unchanged. The dev branch's isStudioDevDeployment guard stays first.
// The three blocks below are the change's ONLY added lines in the route, the same bytes on main and here (the dev file keeps its own guard lines, which main does not have).
// How the older pins reach it: this change REGISTERS its files and its strip (scripts/studio-later-changes.mjs, two lines; no .env.example block: there is no flag). The files line sits just BEFORE PR F's (a Set: the
// order does not matter), so that it never shares an insertion point with another later change's line after PR F's (#512). It is the first later change to delete files and modify an existing app file, so three
// FRONTEND-2 pins that checked the whole BASE..HEAD range get a one-line tolerance for a registered later change's files (later-changes and thumbnail-last-good: "nothing deleted"; pass3-polish-f: #512's exact line). The strip takes the three blocks out of the cleanup-sessions
// route (exact text, each only when it is there exactly once), so a pin that reads that route through stripLaterChanges sees the base's file. Plain node, no imports, nothing read from disk or git here; any other file comes back as it is.

export const BASE_COMMIT = '4b96755c27511fc408478eda5fd9138e32effad8' // studio-v4-dev-preparation-code (#511 merged), this change is cut from
export const D1_SUBJECT = /^D1 security hotfix:/
export const D1_ROUTE = 'app/api/admin/cleanup-sessions/route.ts'
export const D1_DELETED = ['app/api/debug/check-env/route.ts', 'app/api/test-env/route.ts']

/** The two imports, right after the next/server import. */
export const D1_IMPORTS = [
  "import { getServerSession } from 'next-auth'",
  "import { authOptions } from '@/lib/auth-options'",
  '',
].join('\n')

/** The check, right after ABANDONMENT_THRESHOLD_HOURS. isAdmin is the coupons route's function, byte for byte. */
export const D1_HELPERS = [
  '/**',
  " * Who may read the dry run (PK's D1 ruling, 25 Oct 2026). It lists abandoned session ids with their",
  " * owners' user ids, so it needs the Vercel cron's `Authorization: Bearer <CRON_SECRET>` (CRON_SECRET",
  " * set and non-empty) or a signed-in admin, by the coupons route's check. POST keeps its own check below.",
  ' */',
  'function isAdmin(email: string | null | undefined): boolean {',
  '  return !!email && email === process.env.DEV_BYPASS_EMAIL',
  '}',
  '',
  'async function canReadDryRun(req: NextRequest): Promise<boolean> {',
  '  const cronSecret = process.env.CRON_SECRET',
  "  if (cronSecret && req.headers.get('authorization') === `Bearer ${cronSecret}`) return true",
  '  const session = await getServerSession(authOptions).catch(() => null)',
  '  return !!session?.user && isAdmin(session.user.email)',
  '}',
  '',
  '',
].join('\n')

/** The gate, the first statement inside GET's try (after the dev guard): before any database call. */
export const D1_GATE = [
  '    if (!(await canReadDryRun(req))) {',
  "      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })",
  '    }',
  '',
  '',
].join('\n')

export const D1_BLOCKS = [D1_IMPORTS, D1_HELPERS, D1_GATE]

/** New files (no base text). */
export const D1_NEW_FILES = ['scripts/studio-d1-debug-routes-strip.mjs', 'scripts/test-studio-d1-debug-routes.mjs']

/** Files this change edits that are not app code: the registry (two lines: its files and its strip) and the three FRONTEND-2 pins' one-line tolerances. No FRONTEND-1 test is edited. */
export const D1_OWN_EDITS = ['scripts/studio-later-changes.mjs', 'scripts/test-studio-later-changes.mjs', 'scripts/test-studio-thumbnail-last-good.mjs', 'scripts/test-studio-pass3-polish-f.mjs']

/** Every file this change's commits touch (the deleted routes too): what the older scope checks skip once the registry names it. */
export const D1_SCOPE_FILES = new Set([D1_ROUTE, ...D1_DELETED, ...D1_NEW_FILES, ...D1_OWN_EDITS])

/** The route without this change's three blocks (each taken out only when it is there exactly once); any other file, and a non-string, comes back as it is. */
export function stripD1DebugRoutes(rel, text) {
  if (rel !== D1_ROUTE || typeof text !== 'string') return text
  let out = text
  for (const block of D1_BLOCKS) {
    const at = out.indexOf(block)
    if (at !== -1 && out.indexOf(block, at + 1) === -1) out = out.slice(0, at) + out.slice(at + block.length)
  }
  return out
}
