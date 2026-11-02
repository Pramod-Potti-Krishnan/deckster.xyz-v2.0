// FRONTEND-2 (PK, 2 Nov 17:48Z, relayed by PROGRAM-1: the template auto-apply check is per USER across devices). Flag NEXT_PUBLIC_STUDIO_TEMPLATE_AUTO_APPLY_SERVER (the string "true", default off, build-time, and effective only together with
// NEXT_PUBLIC_STUDIO_TEMPLATE_MATCH, #559). Stacked on #559: the check was per user on THIS device (localStorage); it is now also stored on the user (Prisma UserPreferences.templateAutoApply, column fe_user_preferences.template_auto_apply,
// nullable, NULL = never set = ON) with localStorage only as a cache. A NEW route app/api/preferences/template-auto-apply/route.ts (GET / PUT, signed-in only, 404 with the flag off) is the server half; the existing app/api/preferences/route.ts
// and the settings pages are NOT touched. Studio asks once per page (when the Director socket first opens): a stored boolean that differs from the cache replaces it (cache, check, a re-sent template_auto_apply); null or an error keeps the cache.
// Every toggle and every frame-driven change (a chat "no template") is PUT, in order, fire-and-forget, one more try after a network error or a 5xx; a failure keeps the local value.
// THE DATABASE COMES FIRST: Prisma's generated client selects EVERY field, so once schema.prisma has the field and the column does not exist, the existing /api/preferences route fails for every user. prisma/sql/20261102_template_auto_apply.sql
// (additive, idempotent, hand-run in the Supabase SQL editor by PK or someone PK names) is applied BEFORE this change is merged; OPS-2 does no production write and refuses to merge until a read-only information_schema check shows the column.
// Every decision is lib/studio-template-auto-apply-server.ts (pure, import-free); hooks/use-studio-template-auto-apply-server.ts is the fetch; the route is the server half. Every line this change adds to an EXISTING file is a pure insertion that carries
// the marker STUDIO-TEMPLATE-AUTO-APPLY-SERVER (matched as a whole token): six in hooks/use-studio-template-match.ts (#559's store) and ONE in prisma/schema.prisma. Strip the marked lines and each file is its base, byte for byte.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines), and teaches the older proofs that read past it (STUDIO_TEMPLATE_AUTO_APPLY_SERVER_PIN_EDITS).
// Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '59c0d06ab8cd7e54746c91e5a200550f33334d63' // origin/frontend2/template-match (#559, frozen): the change this one is stacked on; its commits are not this change's own
export const STUDIO_TEMPLATE_AUTO_APPLY_SERVER_FLAG = 'NEXT_PUBLIC_STUDIO_TEMPLATE_AUTO_APPLY_SERVER'
export const STUDIO_TEMPLATE_AUTO_APPLY_SERVER_MARKER = 'STUDIO-TEMPLATE-AUTO-APPLY-SERVER'
/** The marker as a WHOLE token: STUDIO-TEMPLATE-AUTO-APPLY-SERVER-X and X-STUDIO-TEMPLATE-AUTO-APPLY-SERVER are not it. */
export const STUDIO_TEMPLATE_AUTO_APPLY_SERVER_MARKER_RE = /(?<![\w-])STUDIO-TEMPLATE-AUTO-APPLY-SERVER(?![\w-])/
/** The subject prefix of this change's own commits (the proof finds them by it). */
export const STUDIO_TEMPLATE_AUTO_APPLY_SERVER_SUBJECT = 'Template auto-apply server:'

/** Existing files that get marked lines (pure insertions only). */
export const STUDIO_TEMPLATE_AUTO_APPLY_SERVER_FILES = [
  'hooks/use-studio-template-match.ts',
  'prisma/schema.prisma',
]

/** New files (no base text to put back). */
export const STUDIO_TEMPLATE_AUTO_APPLY_SERVER_NEW_FILES = [
  'prisma/sql/20261102_template_auto_apply.sql',
  'lib/studio-template-auto-apply-server.ts',
  'hooks/use-studio-template-auto-apply-server.ts',
  'app/api/preferences/template-auto-apply/route.ts',
  'scripts/studio-template-auto-apply-server-strip.mjs',
  'scripts/test-studio-template-auto-apply-server.mjs',
]

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, whole lines, so putting them back gives the previous file byte for byte. Every line the proof has now carries STUDIO_TEMPLATE_AUTO_APPLY_SERVER_PIN_MARK. */
export const STUDIO_TEMPLATE_AUTO_APPLY_SERVER_PIN_MARK = '// LATER-CHANGES: registry read (STUDIO-TEMPLATE-AUTO-APPLY-SERVER)'
/** The line the first-parent scope checks of two older proofs get: a branch stacked after an older change has this change's commits on its first-parent line, and they are this change's own, not that change's. */
const FIRST_PARENT_SUBJECT_LINE = `  shas.splice(0, shas.length, ...shas.filter(sha => !/^Template auto-apply server:/.test(git('log', '-1', '--format=%s', sha)))) ${STUDIO_TEMPLATE_AUTO_APPLY_SERVER_PIN_MARK}: on a branch stacked after this change (the template auto-apply server's), the first-parent commits are its own, not this change's; with none left the pins and identity checks above cover the files\n`
export const STUDIO_TEMPLATE_AUTO_APPLY_SERVER_PIN_EDITS = {
  // the first-parent scope check of test-studio-chat-element-edit.mjs: a branch stacked after this change has this change's commits on the first-parent line
  "scripts/test-studio-chat-element-edit.mjs": [[FIRST_PARENT_SUBJECT_LINE, ""]],
  // the first-parent scope check of test-studio-deck-sync-truth.mjs: the same
  "scripts/test-studio-deck-sync-truth.mjs": [[FIRST_PARENT_SUBJECT_LINE, ""]],
  // the template match's own proof (#559): on the real branch it wants its registry lines to close their lists; this change is registered after it, so its own registry lines may follow the template match's (the hook that proof's synthetic later change already uses)
  "scripts/test-studio-template-match.mjs": [
    [
      `  REAL.laterRegistryLine = (previous => line => previous?.(line) || line.includes('studio-template-auto-apply-server-strip.mjs'))(REAL.laterRegistryLine) ${STUDIO_TEMPLATE_AUTO_APPLY_SERVER_PIN_MARK}: the template auto-apply server's registry lines may follow this change's three (a later change's own line)\n`,
      "",
    ],
  ],
}

/** The proof without this change's edits (the previous file). Used by the strip and the proof. */
export function putBackPin(rel, text) {
  return (STUDIO_TEMPLATE_AUTO_APPLY_SERVER_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The older proofs this change teaches. */
export const STUDIO_TEMPLATE_AUTO_APPLY_SERVER_PIN_FILES = Object.keys(STUDIO_TEMPLATE_AUTO_APPLY_SERVER_PIN_EDITS)

/** Files this change edits that are neither marked app code nor new: its .env.example block, the registry (three lines) and the older proofs it teaches. */
export const STUDIO_TEMPLATE_AUTO_APPLY_SERVER_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...STUDIO_TEMPLATE_AUTO_APPLY_SERVER_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const STUDIO_TEMPLATE_AUTO_APPLY_SERVER_SCOPE_FILES = new Set([...STUDIO_TEMPLATE_AUTO_APPLY_SERVER_FILES, ...STUDIO_TEMPLATE_AUTO_APPLY_SERVER_NEW_FILES, ...STUDIO_TEMPLATE_AUTO_APPLY_SERVER_OWN_EDITS])

/** The whole .env.example block: its comments and its line. */
export const STUDIO_TEMPLATE_AUTO_APPLY_SERVER_ENV_BLOCK = `# STUDIO TEMPLATE AUTO-APPLY SERVER (FRONTEND-2; PK's 2 Nov 17:48Z ruling: the template auto-apply check is per USER across devices). On for the exact value "true" and ONLY together with NEXT_PUBLIC_STUDIO_TEMPLATE_MATCH; default off, and then Studio is exactly as the template match has it (the check lives on this device only) and the route /api/preferences/template-auto-apply answers 404.
# Build-time value: change it on Vercel and redeploy. DATABASE FIRST: run prisma/sql/20261102_template_auto_apply.sql in the Supabase SQL editor BEFORE the change that adds templateAutoApply to prisma/schema.prisma is merged (the existing /api/preferences route selects every field, so a missing column breaks the Settings pages); never flip this flag before that column exists.
# On: the check is stored on the user (fe_user_preferences.template_auto_apply, NULL = never set = ON) and the browser's localStorage is only a cache. Studio asks once per page, when the Director socket first opens; a stored value that differs from the cache replaces it (and template_auto_apply is sent again). Every toggle and every change a frame brings (a chat "no template") is saved for the user.
NEXT_PUBLIC_STUDIO_TEMPLATE_AUTO_APPLY_SERVER="false"
`

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays (a taught proof gets its previous lines back). Any other file is returned as it is. */
export function stripStudioTemplateAutoApplyServer(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in STUDIO_TEMPLATE_AUTO_APPLY_SERVER_PIN_EDITS) return putBackPin(rel, text) // an older proof this change taught: its previous text
  if (!STUDIO_TEMPLATE_AUTO_APPLY_SERVER_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !STUDIO_TEMPLATE_AUTO_APPLY_SERVER_MARKER_RE.test(line)).join('\n')
}
