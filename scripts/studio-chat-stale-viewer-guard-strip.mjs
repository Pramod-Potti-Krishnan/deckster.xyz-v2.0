// FRONTEND-2 (B43, 28 Oct; E2E-2 batch 2, rows 34, 35, 36, Studio dev, deck 017fa691, 21:42-22:07Z: a chat element add right after a server-side chat deck change said "Done", the editor's save failed and the element was lost; every later add said "viewer not ready"
// until the whole page was reloaded). Flag NEXT_PUBLIC_STUDIO_CHAT_STALE_VIEWER_GUARD (exact "true", default off, build-time): before a chat add or edit runs the viewer must show the deck Layout holds (it is reloaded onto it, or the directive is refused), an add is "Done" only
// once it is stored, and a viewer reload ends a remembered save error. Every line this change adds to an EXISTING file is a pure insertion that carries the marker CHAT-STALE-VIEWER-GUARD (a whole token): hooks/use-textlabs-generation.ts, components/presentation-viewer.tsx and
// app/builder/page.tsx. Strip those lines and the file is its base, byte for byte. The new lib lib/chat-stale-viewer-guard.ts holds the flag and the logic. Stacked on #546 (NEXT_PUBLIC_STUDIO_CHAT_ADD_TARGETED_SAVE, frontend2/chat-add-targeted): BASE_COMMIT is its head.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines), and teaches the older proofs that read the generation hook raw (the five #546 taught) to read past its marked lines too.
// EVERY LINE CARRIES A SECOND MARKER, the marker of a change whose strip the older proofs already read their file through, so none of them needs another edit (the older proofs hold the hook, the viewer and the page to a base commit byte for byte,
// each past the strips of the changes it knew: a line none of them removes fails them, and teaching each proof one line breaks the proofs that pin the taught lines in their turn). The hook's lines also carry CHAT-ADD-TARGETED (#546's strip: the five proofs it
// taught and its own "base hook" run read the hook through it; one line reads its variable, chatAddScope, so it must go with it); the viewer's carry CHAT-PARITY (the arrange proof, COMPOSER-2's first-paint-viewer proof and the rest read the viewer through chat
// parity's strip); the page's carry CHAT-ELEMENT-EDIT-2 (the chat element edit 2 proof reads the page through its own strip). This strip takes the same lines out for everything stacked on top. The one proof taught a line is the rail add slide's wiring scan (it
// lists the markers it ignores).
// Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '792ff15a63b150dc302a5a2babcff6484446218e' // origin/frontend2/chat-add-targeted (#546's head, tree below dev 61568fe6): the change this one is stacked on
export const CHAT_STALE_VIEWER_GUARD_FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_STALE_VIEWER_GUARD'
export const CHAT_STALE_VIEWER_GUARD_MARKER = 'CHAT-STALE-VIEWER-GUARD'
/** The marker as a WHOLE token: CHAT-STALE-VIEWER-GUARD-X and X-CHAT-STALE-VIEWER-GUARD are not it. */
export const CHAT_STALE_VIEWER_GUARD_MARKER_RE = /(?<![\w-])CHAT-STALE-VIEWER-GUARD(?![\w-])/
/** The subject prefix of this change's own commits. */
export const CHAT_STALE_VIEWER_GUARD_SUBJECT = 'Stale viewer guard:'

/** Existing files that get marked lines (pure insertions only). */
export const CHAT_STALE_VIEWER_GUARD_FILES = [
  'hooks/use-textlabs-generation.ts',
  'components/presentation-viewer.tsx',
  'app/builder/page.tsx',
]

/** New files (no base text to put back). */
export const CHAT_STALE_VIEWER_GUARD_NEW_FILES = [
  'lib/chat-stale-viewer-guard.ts',
  'scripts/studio-chat-stale-viewer-guard-strip.mjs',
  'scripts/studio-chat-stale-viewer-guard-server.mjs',
  'scripts/studio-chat-stale-viewer-guard-world.mjs',
  'scripts/test-studio-chat-stale-viewer-guard.mjs',
  'scripts/fixtures/chat-stale-viewer-guard/layout-transcripts.json',
]

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, whole lines, so putting them back gives the previous file byte for byte. Every line the proof has now carries CHAT_STALE_VIEWER_GUARD_PIN_MARK. */
export const CHAT_STALE_VIEWER_GUARD_PIN_MARK = '// LATER-CHANGES: registry read (CHAT-STALE-VIEWER-GUARD)'
export const CHAT_STALE_VIEWER_GUARD_PIN_EDITS = { // the one older proof taught a line (see the note at the top)
  'scripts/test-studio-rail-add-slide.mjs': [
    ["const withoutFirstPaint = lines => lines.filter(line => !belongsToFirstPaint(line) && !line.includes('PASS3-POLISH-B') && !line.includes('CHAT-STALE-VIEWER-GUARD')) // LATER-CHANGES: registry read (PASS3-POLISH-B) // LATER-CHANGES: registry read (CHAT-STALE-VIEWER-GUARD): the stale viewer guard stacked after this change marks its own viewer lines\n",
     "const withoutFirstPaint = lines => lines.filter(line => !belongsToFirstPaint(line) && !line.includes('PASS3-POLISH-B')) // LATER-CHANGES: registry read (PASS3-POLISH-B)\n"],
  ],
}

/** The proof without this change's edits (the previous file). Used by the strip and the proof. */
export function putBackPin(rel, text) {
  return (CHAT_STALE_VIEWER_GUARD_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The older proofs this change teaches. */
export const CHAT_STALE_VIEWER_GUARD_PIN_FILES = Object.keys(CHAT_STALE_VIEWER_GUARD_PIN_EDITS)

export const CHAT_STALE_VIEWER_GUARD_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...CHAT_STALE_VIEWER_GUARD_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const CHAT_STALE_VIEWER_GUARD_SCOPE_FILES = new Set([...CHAT_STALE_VIEWER_GUARD_FILES, ...CHAT_STALE_VIEWER_GUARD_NEW_FILES, ...CHAT_STALE_VIEWER_GUARD_OWN_EDITS])

/** The whole .env.example block: its comment and its line. */
export const CHAT_STALE_VIEWER_GUARD_ENV_BLOCK = `# STUDIO STALE VIEWER GUARD (FRONTEND-2, B43; E2E-2 batch 2, rows 34, 35, 36, Studio dev, 28 Oct 21:42-22:07Z: a chat element add right after a server-side chat deck change (/add-slide, /duplicate, /delete, /undo) said "Done", the editor's whole-deck save failed and the element was lost;
# every later add then said "The presentation viewer is not ready" until the whole page was reloaded). On for the exact value "true"; default off, and then everything is exactly as today. Build-time value: change it on Vercel and redeploy. It does not need the other chat flags.
# On: before a chat element add or edit runs, the viewer's slide ids (composeGetState) are compared with Layout's own (its slide inventory). Different: the viewer is reloaded onto the server's deck first (Reload deck) and the directive runs once it shows it; it is never reloaded over edits
# it holds that are not saved, nor while it is busy: then the directive is answered failed (an add: status failed with the reason; an edit: ok:false, SLIDE_CHANGED or VIEWER_NOT_READY) and nothing is changed. A chat add is "Done" only once it is stored (the targeted save's commit, or the viewer's save
# acknowledgement); and a viewer reload ends a remembered save error, so Reload deck recovers without reloading the page. The manual Add Element panel and Edit Mode are not touched.
NEXT_PUBLIC_STUDIO_CHAT_STALE_VIEWER_GUARD="false"
`

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripChatStaleViewerGuard(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in CHAT_STALE_VIEWER_GUARD_PIN_EDITS) return putBackPin(rel, text) // an older proof this change taught: its previous text
  if (!CHAT_STALE_VIEWER_GUARD_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !CHAT_STALE_VIEWER_GUARD_MARKER_RE.test(line)).join('\n')
}
