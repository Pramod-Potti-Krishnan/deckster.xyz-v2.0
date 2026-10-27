// FRONTEND-2 (P3-1 A chat parity, 27 Oct). Flag NEXT_PUBLIC_STUDIO_CHAT_COMMANDS (the string "true", default off, build-time; it needs NEXT_PUBLIC_STUDIO_CHAT_CLEAN and the Studio shell): the v3.1 composer's "/" command
// menu (/add-slide, /duplicate, /delete, /theme, /template, /model, /research, /web, /export, /publish, /undo, /stop) and "@" mention menu (Slides · Element · Files · Templates · Themes), stacked on chat clean (#530).
// lib/studio-chat-commands.ts decides (pure), lib/studio-chat-commands-wire.ts is the wire in one place (references of kind file / template / theme, user_message.data.command, the caps mentions2 / commands1),
// components/builder/chat/studio-chat-commands.tsx draws the two menus and wires each command to the real control's own handler, components/builder/studio-chat-commands.css styles them on the composer's own "@" surface.
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker CHAT-COMMANDS (matched as a whole token): components/builder/chat-input.tsx, app/builder/page.tsx and hooks/use-deckster-websocket-v2.ts.
// Strip the marked lines and each file is chat clean's (#530's head), byte for byte. No existing line of app code is rewritten.
// Older proofs that read those files raw are taught to read them through the registry (CHAT_COMMANDS_PIN_EDITS, [line now, line before], whole lines, every line now carrying "registry read (CHAT-COMMANDS)").
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '8cfd5f37116916de63bc6ab35694785bd97b32cb' // studio dev at #522 (merged into this branch; it holds #530, which this change was cut from): the tree diff from it to this change's newest commit is this change
export const CHAT_COMMANDS_FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_COMMANDS'
export const CHAT_COMMANDS_MARKER = 'CHAT-COMMANDS'
/** The subject prefix of this change's own commits. */
export const CHAT_COMMANDS_SUBJECT = 'Chat commands:'
/** The marker as a WHOLE token: CHAT-COMMANDS-X or X-CHAT-COMMANDS are not this change's (the underscore flag name is not either). */
export const CHAT_COMMANDS_MARKER_RE = /(?<![\w-])CHAT-COMMANDS(?![\w-])/

/** Existing files that get marked lines (pure insertions only). */
export const CHAT_COMMANDS_FILES = [
  'components/builder/chat-input.tsx',
  'app/builder/page.tsx',
  'hooks/use-deckster-websocket-v2.ts',
]

/** The older proofs this change teaches: [line now, line before] per edit, whole lines (a line now carries "registry read (CHAT-COMMANDS)" and occurs once in its file; a line before of "" is an inserted line). */
export const CHAT_COMMANDS_PIN_EDITS = {
  "scripts/test-studio-pass2b-chat.mjs": [
    [
      "    for (const file of Object.keys(GOLDEN.imports)) if (sha(importLines(chatCleanStrip.stripChatClean(file, commandsStrip.stripChatCommands(file, read(file)))).join('\\n')) !== GOLDEN.imports[file]) fail(`${file}: its import lines changed (the existing pin tests load it with an allow-list of imports)`) // LATER-CHANGES: registry read (CHAT-CLEAN): the import lines a change registered after this one adds (chat clean's, in chat-input.tsx and message-list.tsx) are its own registry read (CHAT-COMMANDS): a change registered after chat clean (chat commands) adds its import lines to chat-input.tsx too; they come out first.\n",
      "    for (const file of Object.keys(GOLDEN.imports)) if (sha(importLines(read(file)).join('\\n')) !== GOLDEN.imports[file]) fail(`${file}: its import lines changed (the existing pin tests load it with an allow-list of imports)`)\n",
    ],
    [
      "const commandsStrip = await import('./studio-chat-commands-strip.mjs') // LATER-CHANGES: registry read (CHAT-COMMANDS): the strip of the change stacked after chat clean, so its marked lines come out before the pins below read a file\n",
      "",
    ],
  ],
  // the hook's buildUserMessage carries this change's flag-gated lines, and this proof runs buildUserMessage in a sandbox of its own: the flag is named there, off
  "scripts/test-theme-font-selection.mjs": [
    [
      "  context.STUDIO_CHAT_COMMANDS_ENABLED = false // LATER-CHANGES: registry read (CHAT-COMMANDS), stacked after #475: NEXT_PUBLIC_STUDIO_CHAT_COMMANDS's two flag-gated lines in buildUserMessage (#532), off here like the other flags\n",
      "",
    ],
  ],
}

/** The proofs taught. */
export const CHAT_COMMANDS_PIN_FILES = Object.keys(CHAT_COMMANDS_PIN_EDITS)

/** New files (no base text to put back). */
export const CHAT_COMMANDS_NEW_FILES = [
  'lib/studio-chat-commands.ts',
  'lib/studio-chat-commands-wire.ts',
  'components/builder/chat/studio-chat-commands.tsx',
  'components/builder/studio-chat-commands.css',
  'scripts/studio-chat-commands-strip.mjs',
  'scripts/test-studio-chat-commands.mjs',
]

/** Files this change edits that are neither marked app code nor new: its .env.example block, the registry (three lines) and the older proofs it teaches. No package.json script: run the proof with `node scripts/test-studio-chat-commands.mjs`. */
export const CHAT_COMMANDS_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...CHAT_COMMANDS_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const CHAT_COMMANDS_SCOPE_FILES = new Set([...CHAT_COMMANDS_FILES, ...CHAT_COMMANDS_NEW_FILES, ...CHAT_COMMANDS_OWN_EDITS])

/** The whole .env.example block: its comments and its one line. */
export const CHAT_COMMANDS_ENV_BLOCK = `# STUDIO CHAT COMMANDS (FRONTEND-2; P3-1 A chat parity, PK's ask of 27 Oct). On only for the string "true"; default off, and then the composer, the sends and the socket frames are byte for byte what they were. Build-time value: change it on Vercel and redeploy. It needs NEXT_PUBLIC_STUDIO_CHAT_CLEAN and the Studio shell (the menus live in the v3.1 composer); without them it does nothing.
# On: typing "/" at the start of the composer (or after a space) opens a short command menu (type to filter; arrows, Enter or Tab, Esc; 44 px rows on phones): /add-slide, /duplicate and /delete fill in an editable request for the current slide (nothing is sent until Send), /theme, /template and /model open the composer's own pickers,
# /research and /web flip the options menu's switches (the same lock), /export pdf|pptx runs the Download menu's own export, /undo presses the Undo chip, /stop is the Send/Stop control's stop, and /publish says plainly that publishing from chat is not ready and offers the Publish button. A command whose control is off or locked says so and names the control; none fails silently.
# Typing "@" opens the mention menu in sections (Slides · Element · Files · Templates · Themes). A pick writes a readable token (@[File: name], @[Template: name], @[Theme: name]) and, on send, adds a typed reference to user_message.data.references; /add-slide, /duplicate and /delete add data.command; the caps mentions2 and commands1 are advertised only with this flag on (lib/studio-chat-commands-wire.ts is the whole wire; the Director side is DIRECTOR_MDC_MENTIONS_COMMANDS_ENABLED).
NEXT_PUBLIC_STUDIO_CHAT_COMMANDS="false"
`

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays (a taught proof gets its previous lines back). Any other file is returned as it is. */
export function stripChatCommands(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in CHAT_COMMANDS_PIN_EDITS) return putBackChatCommandsEdits(rel, text) // an older proof this change taught: its previous text, so a proof that holds it byte for byte reads it as it was
  if (!CHAT_COMMANDS_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !CHAT_COMMANDS_MARKER_RE.test(line)).join('\n')
}

/** The proof without this change's taught lines (the previous file). */
export function putBackChatCommandsEdits(rel, text) {
  return (CHAT_COMMANDS_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}
