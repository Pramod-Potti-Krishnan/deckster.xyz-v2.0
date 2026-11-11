// FRONTEND-1 (production frontend audit, P-17, Present mode Exit). Flag NEXT_PUBLIC_STUDIO_PRESENT_EXIT_FIX (exact "true", default off, build-time).
// P-17 "Present, slide navigation and exit": the Exit control did not return to the Builder. lib/studio-present-exit.ts has the root cause and the fix: the toggle (handleFullscreen) decides enter or leave from the browser's
// document.fullscreenElement alone, so a page that says "presenting" while the browser says "not full screen" takes the ENTER branch when Exit is pressed. With the flag on, that state leaves Present on the page's own authority.
// Every line this change adds to an EXISTING file carries the marker AUDIT-PRESENT-EXIT (matched as a whole token). Some base lines are rewritten, so the strip is a list of [has, was] pairs, not a marker filter: putting each pair back gives the file at BASE_COMMIT
// byte for byte (a pair is one hunk of the committed diff: the lines the file has now, the lines it had). The new files have no base text.
// FRONTEND-2's UX findings E (#603) carries the same four-line edit of FRONTEND-1's test-studio-voice-call.mjs (the .env.example "last thing in the file" pin must take out the env blocks registered after voice-call's); this change carries it too, BYTE-IDENTICAL, so every PR merges clean in any order.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = 'eeb78d4f4b7676d75c244746f1edc7da1d269478' // origin/studio-v4-dev-preparation-code (#598 merged) at the start of this change
export const AUDIT_PRESENT_EXIT_FLAGS = ["NEXT_PUBLIC_STUDIO_PRESENT_EXIT_FIX"]
export const AUDIT_PRESENT_EXIT_MARKER = 'AUDIT-PRESENT-EXIT'
/** The marker as a WHOLE token: AUDIT-PRESENT-EXIT-X and X-AUDIT-PRESENT-EXIT are not this change's. */
export const AUDIT_PRESENT_EXIT_MARKER_RE = /(?<![\w-])AUDIT-PRESENT-EXIT(?![\w-])/
/** The subject prefix of this change's own commits. */
export const AUDIT_PRESENT_EXIT_SUBJECT = 'Audit fix:'

/** Existing files that get marked lines. */
export const AUDIT_PRESENT_EXIT_FILES = ["components/presentation-viewer.tsx"]

/** New files (no base text to put back). */
export const AUDIT_PRESENT_EXIT_NEW_FILES = [
  "lib/studio-present-exit.ts",
  "scripts/studio-audit-present-exit-strip.mjs",
  "scripts/test-studio-audit-present-exit.mjs"
]

/** The new libs that read a flag: [file, flag], each import-free with one literal env read. */
export const AUDIT_PRESENT_EXIT_LIB_FLAGS = [["lib/studio-present-exit.ts","NEXT_PUBLIC_STUDIO_PRESENT_EXIT_FIX"]]

/** [text the file has now, text the file had at BASE_COMMIT] per edit (one per hunk), in the order they sit in the file; putting them back gives the base file byte for byte. */
export const AUDIT_PRESENT_EXIT_EDITS = {
  "components/presentation-viewer.tsx": [
    ["import { STUDIO_PRESENT_EXIT_FIX_ENABLED, presentExitDesynced, leaveBrowserFullscreen } from '@/lib/studio-present-exit' // AUDIT-PRESENT-EXIT\n", ""],
    ["  const isFullscreenRef = useRef(isFullscreen); isFullscreenRef.current = isFullscreen // AUDIT-PRESENT-EXIT: the toggle reads the page's own state through a ref (its callback is not rebuilt for it)\n", ""],
    ["      if (presentExitDesynced(STUDIO_PRESENT_EXIT_FIX_ENABLED, isFullscreenRef.current, Boolean(document.fullscreenElement))) { await leaveBrowserFullscreen(document); if (!isCurrent()) return; setIsFullscreen(false); return } // AUDIT-PRESENT-EXIT: the page says presenting, the browser says not full screen: Exit leaves Present (the toggle below would ask for fullscreen again)\n", ""],
  ],
}

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, so putting them back gives the previous file byte for byte. */
export const AUDIT_PRESENT_EXIT_PIN_MARK = "LATER-CHANGES: registry read (AUDIT-PRESENT-EXIT)"
export const AUDIT_PRESENT_EXIT_PIN_EDITS = {
  "scripts/test-studio-chat-element-edit.mjs": [
    ["  shas.splice(0, shas.length, ...shas.filter(sha => !/^Audit fix:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (AUDIT-PRESENT-EXIT): on a branch stacked after this change (the audit P-17 Present exit fix), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n", ""],
  ],
  "scripts/test-studio-deck-sync-truth.mjs": [
    ["  shas.splice(0, shas.length, ...shas.filter(sha => !/^Audit fix:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (AUDIT-PRESENT-EXIT): on a branch stacked after this change (the audit P-17 Present exit fix), the first-parent commits are its own, not this change's; with none left the identity checks cover the files\n", ""],
  ],
}

/**
 * FRONTEND-1's voice-call proof with the four-line after-merge edit FRONTEND-1 OK'd for UX findings E (FE1-OK-REQUEST-2.md section 2, #603 carries the same lines): its .env.example pins read the file raw, so a later change's env block
 * shows up in it. [line now, line before] per edit, whole lines; was = '' for an inserted line. Put back, the proof is the base's.
 */
export const AUDIT_PRESENT_EXIT_VOICE_CALL_PIN_MARK = '// LATER-CHANGES: registry read (UX-FINDINGS-E)'
export const AUDIT_PRESENT_EXIT_VOICE_CALL_PIN_EDITS = {
  "scripts/test-studio-voice-call.mjs": [
    ["const laterRegistry = await import('./studio-later-changes.mjs') // LATER-CHANGES: registry read (UX-FINDINGS-E)\n", ""],
    ["const laterEnvOut = text => laterRegistry.LATER_ENV_BLOCKS.slice(laterRegistry.LATER_ENV_BLOCKS.indexOf(strip.VOICE_CALL_ENV_BLOCK) + 1).reduce((out, block) => out.replace(`\\n${block}`, ''), text) // LATER-CHANGES: registry read (UX-FINDINGS-E)\n", ""],
    ["  ok(laterEnvOut(env).endsWith(`\\n${strip.VOICE_CALL_ENV_BLOCK}`) && strip.VOICE_CALL_ENV_BLOCK.endsWith('\\n'), '.env.example: the block is the last thing in the file, after one blank line') // LATER-CHANGES: registry read (UX-FINDINGS-E)\n", "  ok(env.endsWith(`\\n${strip.VOICE_CALL_ENV_BLOCK}`) && strip.VOICE_CALL_ENV_BLOCK.endsWith('\\n'), '.env.example: the block is the last thing in the file, after one blank line')\n"],
    ["    ok(laterEnvOut(`${envDiff.map(line => line.slice(1)).join('\\n')}\\n`).trimEnd().endsWith(strip.VOICE_CALL_ENV_BLOCK.trimEnd()), '.env.example: this change adds exactly its block (after ELEMENT-3\\'s two lines)') // LATER-CHANGES: registry read (UX-FINDINGS-E)\n", "    ok(envDiff.map(line => line.slice(1)).join('\\n').endsWith(strip.VOICE_CALL_ENV_BLOCK.trimEnd()), '.env.example: this change adds exactly its block (after ELEMENT-3\\'s two lines)')\n"],
  ],
}
/** The proof it edits, and the anchor the two inserted lines go right after. */
export const AUDIT_PRESENT_EXIT_VOICE_CALL_PIN_FILES = Object.keys(AUDIT_PRESENT_EXIT_VOICE_CALL_PIN_EDITS)
export const AUDIT_PRESENT_EXIT_VOICE_CALL_PIN_ANCHOR = "const core = await import('./studio-voice-core-strip.mjs')"

/** The older proofs this change teaches. */
export const AUDIT_PRESENT_EXIT_PIN_FILES = Object.keys(AUDIT_PRESENT_EXIT_PIN_EDITS)

export const AUDIT_PRESENT_EXIT_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...AUDIT_PRESENT_EXIT_PIN_FILES, ...AUDIT_PRESENT_EXIT_VOICE_CALL_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const AUDIT_PRESENT_EXIT_SCOPE_FILES = new Set([...AUDIT_PRESENT_EXIT_FILES, ...AUDIT_PRESENT_EXIT_NEW_FILES, ...AUDIT_PRESENT_EXIT_OWN_EDITS])

/** The whole .env.example block: its comment and its lines. */
export const AUDIT_PRESENT_EXIT_ENV_BLOCK = "# STUDIO PRESENT EXIT FIX (FRONTEND-1; production frontend audit P-17). On for the exact value \"true\"; default off, and then Present mode behaves byte for byte as it did. Build-time value: change it on Vercel and redeploy.\n# On, when the page says it is presenting but the browser reports no full-screen element (the two disagree), pressing Exit leaves Present (it asks the browser to leave only while the browser is in fullscreen, and a refusal is swallowed) instead of asking for fullscreen again. Nothing else changes.\nNEXT_PUBLIC_STUDIO_PRESENT_EXIT_FIX=\"false\"\n"

/** The file with this change's edits put back (the previous text). Used by the strip and the proof. */
export function putBackAuditPresentExit(rel, text) {
  return (AUDIT_PRESENT_EXIT_EDITS[rel] || AUDIT_PRESENT_EXIT_PIN_EDITS[rel] || AUDIT_PRESENT_EXIT_VOICE_CALL_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The file without this change's edits: each [has, was] pair put back; every other byte stays. Any other file is returned as it is. */
export function stripAuditPresentExit(rel, text) {
  if (typeof text !== 'string') return text
  if (!(rel in AUDIT_PRESENT_EXIT_EDITS) && !(rel in AUDIT_PRESENT_EXIT_PIN_EDITS) && !(rel in AUDIT_PRESENT_EXIT_VOICE_CALL_PIN_EDITS)) return text
  return putBackAuditPresentExit(rel, text)
}
