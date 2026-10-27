// FRONTEND-1 (P3-1 A chat parity, Studio half, 27 Oct). Flags NEXT_PUBLIC_STUDIO_CHAT_PARITY_NOTES / _THEMES / _IDENTITY / _TEMPLATES (the string "true", each default off, build-time): Director's
// studio_action requests run through the click paths' own functions and are answered with studio_action_result; deck_mutation notes_updated re-reads the Notes panel. Every decision is
// lib/studio-chat-parity.ts (pure, import-free); lib/studio-chat-parity-runners.ts runs the executors. Contract: deckster-workspace streams/frontend1/chat-parity-p3/CONTRACTS.md.
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker CHAT-PARITY (matched as a whole token): hooks/use-deckster-websocket-v2.ts, app/builder/page.tsx (the
// import at the end with the flow and chat-clean imports, for the same older proof), components/slide-notes-panel.tsx, types/mdc.ts. No existing line of app code is rewritten. Strip the marked lines
// and each file is its base, byte for byte. One older proof is taught (CHAT_PARITY_PIN_EDITS): the font-selection proof runs the hook's buildUserMessage in a sandbox and needs the new constant.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = "14a06c3053047acc7f6a613afd1138dabf4a3c54" // origin/studio-v4-dev-preparation-code (#530 merged); the tree diff from it to this change's newest commit is this change
export const CHAT_PARITY_FLAGS = ['NEXT_PUBLIC_STUDIO_CHAT_PARITY_NOTES', 'NEXT_PUBLIC_STUDIO_CHAT_PARITY_THEMES', 'NEXT_PUBLIC_STUDIO_CHAT_PARITY_IDENTITY', 'NEXT_PUBLIC_STUDIO_CHAT_PARITY_TEMPLATES']
export const CHAT_PARITY_MARKER = 'CHAT-PARITY'
/** The marker as a WHOLE token: CHAT-PARITY-X or X-CHAT-PARITY are not this change's. */
export const CHAT_PARITY_MARKER_RE = /(?<![\w-])CHAT-PARITY(?![\w-])/

/** Existing files that get marked lines (pure insertions only). */
export const CHAT_PARITY_FILES = [
  'hooks/use-deckster-websocket-v2.ts',
  'app/builder/page.tsx',
  'components/slide-notes-panel.tsx',
  'types/mdc.ts',
  'components/builder/chat-input.tsx', // THEMES: the palette's re-read listener (FRONTEND-2's file, their OK of 27 Oct 04:14Z)
]

/** The older proofs this change teaches: [line now, line before] per edit, whole lines (a line now carries "registry read (CHAT-PARITY)" and occurs once in its file; a line before of "" is an inserted line). */
export const CHAT_PARITY_PIN_EDITS = {
  'scripts/test-studio-pass2b-chat.mjs': [
    ["const chatParityStrip = await import('./studio-chat-parity-strip.mjs') // stacked after #475: LATER-CHANGES: registry read (CHAT-PARITY): the strip of the change stacked after chat clean, so its marked lines (the palette's re-read listener in chat-input.tsx) come out too\n", ""],
    ["    for (const file of Object.keys(GOLDEN.imports)) if (sha(importLines(chatCleanStrip.stripChatClean(file, chatParityStrip.stripChatParity(file, read(file)))).join('\\n')) !== GOLDEN.imports[file]) fail(`${file}: its import lines changed (the existing pin tests load it with an allow-list of imports)`) // LATER-CHANGES: registry read (CHAT-CLEAN): the import lines a change registered after this one adds (chat clean's, in chat-input.tsx and message-list.tsx) are its own // stacked after #475: LATER-CHANGES: registry read (CHAT-PARITY): chat parity's import line in chat-input.tsx is its own\n", "    for (const file of Object.keys(GOLDEN.imports)) if (sha(importLines(chatCleanStrip.stripChatClean(file, read(file))).join('\\n')) !== GOLDEN.imports[file]) fail(`${file}: its import lines changed (the existing pin tests load it with an allow-list of imports)`) // LATER-CHANGES: registry read (CHAT-CLEAN): the import lines a change registered after this one adds (chat clean's, in chat-input.tsx and message-list.tsx) are its own\n"],
  ],
  'scripts/test-theme-font-selection.mjs': [
    [
      "  context.CHAT_PARITY_CAPS = [] // stacked after #475: LATER-CHANGES: registry read (CHAT-PARITY): NEXT_PUBLIC_STUDIO_CHAT_PARITY_*'s one flag-gated line in buildUserMessage (notes1 / themes1 / identity1 / templates1), empty (all off) here\n",
      "",
    ],
  ],
}
export const CHAT_PARITY_PIN_FILES = Object.keys(CHAT_PARITY_PIN_EDITS)

/** New files (no base text to put back). */
export const CHAT_PARITY_NEW_FILES = [
  'lib/studio-chat-parity.ts',
  'lib/studio-chat-parity-runners.ts',
  'lib/studio-chat-parity-themes.ts',
  'scripts/studio-chat-parity-strip.mjs',
  'scripts/test-studio-chat-parity.mjs',
]

/** Files this change edits that are neither marked app code nor new: its .env.example block, the registry (three lines) and the older proof it teaches. No package.json script: run the proof with `node scripts/test-studio-chat-parity.mjs`. */
export const CHAT_PARITY_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...CHAT_PARITY_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const CHAT_PARITY_SCOPE_FILES = new Set([...CHAT_PARITY_FILES, ...CHAT_PARITY_NEW_FILES, ...CHAT_PARITY_OWN_EDITS])

/** The whole .env.example block: its comments and its flag lines (a group's commit appends its comment and line to the block's end). */
export const CHAT_PARITY_ENV_BLOCK = "# STUDIO CHAT PARITY (FRONTEND-1; P3-1 A post-Thursday rows, Studio half; contract: deckster-workspace streams/frontend1/chat-parity-p3/CONTRACTS.md, DIRECTOR-2 GO 27 Oct). Four switches, one per row\n# group, each on only for the string \"true\"; all default off, and then chat sends, socket handling, the Builder page and the Notes panel are byte for byte what they were. Build-time values: change them on\n# Vercel and redeploy. Each pairs with a Director flag of its own (DIRECTOR_MDC_THEME_LIBRARY_ENABLED / _IDENTITY_ / _TEMPLATES_, and for notes DIRECTOR_MDC_ELEMENT_EDIT_ENABLED + CHAT_CAP_SPEAKER_NOTES).\n# With a group on, each user_message adds the group's cap to client_caps (notes1 / themes1 / identity1 / templates1), Director's studio_action {request_id, group, action, presentation_id, args, label} is\n# taken out of band (never the transcript) and run through the SAME function the click path runs, and studio_action_result {request_id, status: done | failed | dismissed, error_code} answers it on the\n# delivering socket (only \"done\" is success; Director closes the turn with its own line). A request for a group that is off answers failed / flag_off at once.\n# NEXT_PUBLIC_STUDIO_CHAT_PARITY_NOTES: rows 105 / 106 / 108. Director writes a slide's speaker notes, script or references itself (narration PATCH) and sends deck_mutation {mutation: \"notes_updated\",\n# slide_index, presentation_id, fields?}; Studio accepts that mutation (this socket's session, the deck on screen, each message once) and the Notes panel re-reads the unedited drafts from Layout, so the\n# next autosave carries the fresh updated_at. THIS CHANGES NO SLIDE.\nNEXT_PUBLIC_STUDIO_CHAT_PARITY_NOTES=\"false\"\n# NEXT_PUBLIC_STUDIO_CHAT_PARITY_THEMES: rows 56 / 57 / 58 / 59 / 61. Director's set_theme_fonts {font_family?, font_family_heading?} (the font-selection feature's own eight families; needs\n# NEXT_PUBLIC_THEME_FONT_SELECTION_ENABLED), save_theme {name, set_standard?}, set_standard_theme {theme_id}, clear_standard_theme, rename_theme {theme_id, name} (needs the Themes page's\n# rename route, the one its own manage flag turns on) and apply_saved_theme {theme_id} run the composer palette's own library writes and the theme picker's own apply (a built deck is answered from\n# its theme sync, as the chat theme directive; a build, an outline, a template reuse or Template Mode refuse it as theme_locked), then the palette re-reads its list. Themes are always named by\n# id (Director resolves a name from its own store). Deleting a saved theme stays on the Themes page (row 60: declined by Director). THIS WRITES THE THEME LIBRARY AND THE DECK'S THEME.\nNEXT_PUBLIC_STUDIO_CHAT_PARITY_THEMES=\"false\"\n"

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays (a taught proof gets its previous lines back). Any other file is returned as it is. */
export function stripChatParity(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in CHAT_PARITY_PIN_EDITS) return putBackChatParityEdits(rel, text) // an older proof this change taught: its previous text, so a proof that holds it byte for byte reads it as it was
  if (!CHAT_PARITY_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !CHAT_PARITY_MARKER_RE.test(line)).join('\n')
}

/** The proof without this change's taught lines (the previous file). */
export function putBackChatParityEdits(rel, text) {
  return (CHAT_PARITY_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}
