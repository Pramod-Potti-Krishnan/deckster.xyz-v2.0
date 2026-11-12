// FRONTEND-2 (B66): the Studio "Create my avatar" create / pick / delete MOCK (page /studio/companions; spec streams/companions-expansion/SPAWN-SPEC.md sections 2 to 4). Flag NEXT_PUBLIC_STUDIO_AVATAR_SPAWN (exact "true", only with
// NEXT_PUBLIC_STUDIO_V4_SHELL, build-time, default off), defined in lib/studio-avatar-spawn.ts. Off: the route calls notFound() and <StudioAvatarSpawnApp /> returns null. No network, no image call, no paid call; the photo is never stored.
// NEW FILES ONLY. This change adds NO line to any existing app file (FRONTEND-1 owns them all): the lines it would need there are DRAFTS (AVATAR_SPAWN_DRAFT below, quoted in the PR body), not applied, waiting for the owner's OK.
// Every line this change adds to an EXISTING file carries the marker AVATAR-SPAWN (a WHOLE token): the .env.example block (its header and its flag line), the three registry lines (their LATER-CHANGE comment) and the two taught proofs.
// Strip the lines and each existing file is dev's, byte for byte (stripAvatarSpawn(rel, text)); .env.example is taken back by the registry's block strip (scripts/studio-later-changes.mjs).
// The older proofs this change teaches (tests only, every line carries the registry-read mark): the two that read the first-parent commits of BASE..HEAD for their own commits' subjects get one more inserted line each, for "Avatar spawn mock:",
// as #567 / #568 / B61 / B63 did. No FRONTEND-1 file is edited at all: the four lines of their voice-call proof that FRONTEND-1 OK'd are dev's now (#607, D94), so this change carries nothing there. How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '0cbeec0ea8e3aa55c587ecb66db892626329d68a' // #606' head (chain #600 → #606), the head this change is chained on
export const AVATAR_SPAWN_FLAG = 'NEXT_PUBLIC_STUDIO_AVATAR_SPAWN'
export const AVATAR_SPAWN_MARKER = 'AVATAR-SPAWN'
/** The marker as a WHOLE token: AVATAR-SPAWN is this change's; AVATAR-SPAWN-X and X-AVATAR-SPAWN are not. */
export const AVATAR_SPAWN_MARKER_RE = /(?<![\w-])AVATAR-SPAWN(?![\w-])/
/** The subject prefix of this change's own commits. */
export const AVATAR_SPAWN_SUBJECT = 'Avatar spawn mock:'

/** New files (no base text to put back): the route, the lib, the components and their stylesheet, this strip and its proof. */
export const AVATAR_SPAWN_NEW_FILES = [
  'app/(app)/studio/companions/page.tsx',
  'lib/studio-avatar-spawn.ts',
  'components/studio-avatar-spawn/steps.tsx',
  'components/studio-avatar-spawn/studio-avatar-spawn-app.tsx',
  'components/studio-avatar-spawn/studio-avatar-spawn.css',
  'scripts/studio-avatar-spawn-strip.mjs',
  'scripts/test-studio-avatar-spawn.mjs',
]

/** The older proofs this change teaches: [text the proof has now, text the base commit's proof has] per edit, whole lines, so putting them back gives the base file byte for byte. Every line a taught proof has now carries AVATAR_SPAWN_PIN_MARK. */
export const AVATAR_SPAWN_PIN_MARK = '// LATER-CHANGES: registry read (AVATAR-SPAWN)'
const FIRST_PARENT_LINE = "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Avatar spawn mock:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (AVATAR-SPAWN): on a branch stacked after this change (the avatar spawn mock), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n"
export const AVATAR_SPAWN_PIN_EDITS = {
  'scripts/test-studio-deck-sync-truth.mjs': [[FIRST_PARENT_LINE, '']],
  'scripts/test-studio-chat-element-edit.mjs': [[FIRST_PARENT_LINE, '']],
}
/** Where each taught line goes: AFTER the dev line that starts with this text (dev's last subject filter of the form `!/^…:/` now, the agent mode shell's: #607, D94). An ORDER, not adjacency: another change's registered subject filter may sit between (a change that merges first). */
export const AVATAR_SPAWN_PIN_AFTER = "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Agent mode shell:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (AGENT-MODE-SHELL)"
/** The older proofs this change teaches. */
export const AVATAR_SPAWN_PIN_FILES = Object.keys(AVATAR_SPAWN_PIN_EDITS)
/** Every [has, was] pair this change makes in an existing file, by file: the two taught proofs (nothing of FRONTEND-1's: dev has their voice-call proof lines). The .env.example block is the registry's, below. */
export const AVATAR_SPAWN_EDITS = { ...AVATAR_SPAWN_PIN_EDITS }

/** Files this change edits that are not app code: .env.example (its block, appended), the registry (three lines: its files, its block, its strip), and the older proofs it teaches. */
export const AVATAR_SPAWN_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...AVATAR_SPAWN_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const AVATAR_SPAWN_SCOPE_FILES = new Set([...AVATAR_SPAWN_NEW_FILES, ...AVATAR_SPAWN_OWN_EDITS])

/** The whole .env.example block: its comments and its line (appended at the end of the file, after one blank line). */
export const AVATAR_SPAWN_ENV_BLOCK = `# STUDIO AVATAR SPAWN MOCK (FRONTEND-2; B66, AVATAR-SPAWN; spec streams/companions-expansion/SPAWN-SPEC.md). On for the exact value "true" and only with the Studio shell (NEXT_PUBLIC_STUDIO_V4_SHELL "true"); default off, and then
# /studio/companions is a 404 and nothing else changes. Build-time value: change it on Vercel and redeploy. On, the page lists the person's own companions and walks create (consent, photo, four looks, name) / pick / delete as a MOCK: it runs in the
# browser with no network, no image call and no paid call, the four looks are existing cast portraits, the new companion points at an existing committed pack, and the photo is never stored. The spawn service does not exist yet.
NEXT_PUBLIC_STUDIO_AVATAR_SPAWN="false"
`

/**
 * The lines this change would need in FRONTEND-1's files, for the owner to apply or adapt. NOT applied here. Each is { file, after (dev line numbers, eeb78d4f), anchor (those lines, quoted), line (byte for byte) }.
 * The picker is a one-tap cycle in dev (no picker yet), the call hook is not told the user, and the pack loader builds `/companions/<pack>/...` itself: the owner decides how the group reaches a real picker and how a u- pack
 * loads (resolvePackUrl / companionFallbackChain in lib/studio-avatar-spawn.ts are the pieces). The account deletion line needs the real spawn client, which does not exist yet.
 */
export const AVATAR_SPAWN_DRAFT = [
  {
    topic: 'Picker: a "My companions" group beside the cast (the list the call offers)',
    file: 'lib/studio-voice-call-ui.ts', after: 30, anchor: '  return [...new Set([fallback, ...COMPANION_CHOICES])]\n}',
    line: 'export const companionChoicesWithMine = (fallback: string, mine: readonly { id: string }[]): string[] => [...new Set([...companionChoices(fallback), ...mine.map(entry => entry.id)])] // AVATAR-SPAWN: "My companions" after the cast; ids are opaque (u-...), never folder names',
  },
  {
    topic: 'Picker: the signed-in person\'s own companions, read in the call hook',
    file: 'hooks/use-studio-voice-call.ts', after: 7, anchor: "import { STUDIO_VOICE_CALL_BUTTONS, STUDIO_VOICE_CALL_UI_ENABLED, STUDIO_VOICE_COMPANION, companionChoices, isTalkKey, nextCompanion, readCompanionChoice, spaceBelongsToTarget, voiceCallBus, disarmVoiceTurn, writeCompanionChoice, type VoiceCallComposerProps } from '@/lib/studio-voice-call-ui'",
    line: "import { myCompanionsGroup } from '@/lib/studio-avatar-spawn' // AVATAR-SPAWN: the person's own companions (none with the flag off)",
  },
  {
    topic: 'Picker: the group, next to CHOICES (the hook is not told the user today; FRONTEND-1 decides how it learns it)',
    file: 'hooks/use-studio-voice-call.ts', after: 31, anchor: 'const CHOICES = companionChoices(STUDIO_VOICE_COMPANION)',
    line: 'const mineOf = (userId: string | null | undefined) => myCompanionsGroup(deviceStorage(), userId) // AVATAR-SPAWN: "My companions", listed after CHOICES (empty with the flag off)',
  },
  {
    topic: 'Navigation: a link to /studio/companions in the account rail (imports first)',
    file: 'components/layout/studio-rail.tsx', after: 9, anchor: 'import { studioNavLabels } from "@/lib/studio-nav-labels"',
    line: 'import { STUDIO_AVATAR_SPAWN_ENABLED } from "@/lib/studio-avatar-spawn" // AVATAR-SPAWN',
  },
  {
    topic: 'Navigation: the rail link itself, after "Your details"',
    file: 'components/layout/studio-rail.tsx', after: 35, anchor: '        <StudioNavigationHint enabled label="Your details"><Link href="/studio/details" aria-label="Your details" aria-current={pathname===\'/studio/details\' || studioRailDetailsCurrent(STUDIO_PAGE_CONSISTENCY_ENABLED, pathname) ? \'page\' : undefined}><UserRound className="h-5 w-5" /></Link></StudioNavigationHint>{/* PAGE-CONSISTENCY (UX-10): Settings and Billing mark Your details */}',
    line: '        {STUDIO_AVATAR_SPAWN_ENABLED && <StudioNavigationHint enabled label="My companions"><Link href="/studio/companions" aria-label="My companions" aria-current={pathname===\'/studio/companions\' ? \'page\' : undefined}><UserRound className="h-5 w-5" /></Link></StudioNavigationHint>}{/* AVATAR-SPAWN */}',
  },
  {
    topic: 'Account deletion: erase the owner\'s spawned packs (spec section 4, Erase). Needs the real spawn client; not applicable until the service exists',
    file: 'app/api/account/route.ts', after: 46, anchor: '    await prisma.payment.deleteMany({ where: { userId } })',
    line: '    await eraseSpawnOwner({ app: "deckster", tenantId: userId, userId }) // AVATAR-SPAWN: DELETE /v1/owners/{app}/{tenantId}/{userId}; a call to the real spawn client (import it first), which does not exist yet',
  },
]

/** `text` with one whole line taken out: `has` is the line with its newline, and it counts only at the start of a line (never the tail of a longer one). Only the first occurrence goes: a line that is there twice is a merge mistake the older pins must still see. */
function putBackLine(text, has, was) {
  let at = text.indexOf(has)
  while (at !== -1 && !(at === 0 || text[at - 1] === '\n')) at = text.indexOf(has, at + 1)
  return at === -1 ? text : text.slice(0, at) + was + text.slice(at + has.length)
}

/** The file without this change's lines: an older proof this change taught gets its base text back. Any other file is returned as it is (the .env.example block is taken out by the registry). Idempotent. */
export function stripAvatarSpawn(rel, text) {
  if (typeof text !== 'string') return text
  if (!Object.prototype.hasOwnProperty.call(AVATAR_SPAWN_EDITS, rel)) return text
  return AVATAR_SPAWN_EDITS[rel].reduce((out, [has, was]) => putBackLine(out, has, was), text)
}
