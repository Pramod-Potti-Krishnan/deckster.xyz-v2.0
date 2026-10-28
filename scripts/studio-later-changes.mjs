// FRONTEND-2: the registry of LATER changes in the Studio stack, the ones that come after bulk edit + chat undo (a branch merged on top of it, or stacked above it) and that the older pins cannot know about.
// Plain node, nothing is read from disk or git here. Three things about a later change make an older pin fail, and this file answers all three in one place so that no older test has to be edited for each new change:
//   1. SCOPE. Several pins read the COMMITTED diff (BASE..HEAD) and refuse any file that is not their change's, a stacked change's, a strip root or a pin they taught. A later change's files are in that diff.
//      Those scope checks skip every file in LATER_CHANGE_FILES (and only there: a file that is in no list is still a stray).
//   2. .env.example. A pin that holds .env.example to an earlier commit, with its own block (and the blocks stacked on it) taken out, sees a later change's block as an extra. stripLaterEnvBlocks(rel, text) takes each
//      registered block out (the block and the one blank line that separates it from its neighbour) wherever it sits; any other file is returned as it is.
//   3. CODE LINES. A pin that holds an app file (the Decks page, the Builder page, the viewer, the hook ...) to an earlier commit, "without this change's lines it is the base's file", sees the lines a later change added.
//      LATER_STRIPS holds one strip per later change, (rel, text) => text, exactly the function the change's own strip module exports (stripFirstPaint, stripDeckCardThumbnail ...).
// stripLaterChanges(rel, text) is what a pin calls, INNERMOST in its read (before every older strip): it applies every registered strip in order, then stripLaterEnvBlocks. The older pins already reach it with no edit of
// their own: scripts/studio-bulk-edit-undo-strip.mjs (stripBulkEditUndo) calls it first, and the three shared strip roots (open-read-only, dark-persist, add-slide-status) call stripBulkEditUndo innermost.
//
// HOW A LATER CHANGE REGISTERS (three lines, one in each list below, no test edit). Each line carries the marker "LATER-CHANGE". Name the change's own strip module with a dynamic import, so that the registration is those
// lines and nothing else (no import line; a top-level await is fine in an .mjs), for example
//   LATER_CHANGE_FILES   ...(await import('./studio-example-strip.mjs')).EXAMPLE_SCOPE_FILES, // LATER-CHANGE: <who>, <what> (<FLAG>)    every file its commit touches: code, new files, the pins it taught, package.json
//   LATER_ENV_BLOCKS     (await import('./studio-example-strip.mjs')).EXAMPLE_ENV_BLOCK, // LATER-CHANGE: <who>, <what> (<FLAG>)         the exact text of its .env.example block (leave the line out when it adds none)
//   LATER_STRIPS         (await import('./studio-example-strip.mjs')).stripExample, // LATER-CHANGE: <who>, <what> (<FLAG>)             its (rel, text) => text strip (leave the line out when it adds no line to an older file)
// An env block may carry its leading and trailing blank lines or not; it is matched on its own lines, at the start of a line, and it must be the whole block (a partial match is not a block and is left alone).
// A strip must return its text untouched for a file it does not own, and must not need the strips of older changes to have run (the registry runs first). Until a change is merged, its lines stay out of this file
// (scripts/test-studio-bulk-edit-undo.mjs and scripts/test-studio-later-changes.mjs prove the registry with a made-up change that is never committed).
//
// All three lists are empty when nothing is stacked after bulk edit + chat undo, and then nothing here changes anything: stripLaterChanges returns its text as it was given, for every file.

export const LATER_CHANGE_FILES = new Set([
  ...(await import('./studio-first-paint-strip.mjs')).FIRST_PAINT_SCOPE_FILES, // LATER-CHANGE: COMPOSER-2, studio first paint (NEXT_PUBLIC_STUDIO_FIRST_PAINT_ENABLED)
  ...(await import('./studio-deck-card-thumbnail-strip.mjs')).DECK_CARD_THUMBNAIL_SCOPE_FILES, // LATER-CHANGE: COMPOSER-2, deck card thumbnails (NEXT_PUBLIC_STUDIO_DECK_CARD_THUMBNAILS_ENABLED)
  ...(await import('./studio-chat-undo-v2-strip.mjs')).CHAT_UNDO_V2_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, chat undo v2 (NEXT_PUBLIC_STUDIO_CHAT_UNDO; no .env.example block)
  ...(await import('./studio-pass3-polish-strip.mjs')).PASS3_POLISH_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR A (NEXT_PUBLIC_STUDIO_PASS3_POLISH)
  ...(await import('./studio-pass3-polish-b-strip.mjs')).PASS3_POLISH_B_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR B (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own: the flag's block is PR A's)
  ...(await import('./studio-pass3-polish-c-strip.mjs')).PASS3_POLISH_C_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR C (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own: the flag's block is PR A's)
  ...(await import('./studio-pass3-polish-d-strip.mjs')).PASS3_POLISH_D_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR D (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own: the flag's block is PR A's)
  ...(await import('./studio-bulk-edit-prompt-text-strip.mjs')).BULK_EDIT_PROMPT_TEXT_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, bulk edit prompt text (NEXT_PUBLIC_STUDIO_BULK_EDIT_PROMPT_TEXT)
  ...(await import('./studio-pass3-polish-e-strip.mjs')).PASS3_POLISH_E_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR E (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own: the flag's block is PR A's)
  ...(await import('./studio-d1-debug-routes-strip.mjs')).D1_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, D1 security hotfix: debug env routes removed, cleanup-sessions dry run gated (no flag: PK's ruling; no .env.example block)
  ...(await import('./studio-pass3-polish-f-strip.mjs')).PASS3_POLISH_F_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR F (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own: the flag's block is PR A's)
  ...(await import('./studio-legal-short-links-strip.mjs')).LEGAL_SHORT_LINKS_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, legal short links and the marketing-slide cache header from uat, D16 a (NEXT_PUBLIC_STUDIO_LEGAL_SHORT_LINKS)
  ...(await import('./studio-pass3-polish-g-strip.mjs')).PASS3_POLISH_G_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR G (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own: the flag's block is PR A's)
  ...(await import('./studio-phone-shell-nav-strip.mjs')).PHONE_SHELL_NAV_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, phone shell 1, the bottom tab bar on phones (NEXT_PUBLIC_STUDIO_PHONE_SHELL)
  ...(await import('./studio-phone-shell-builder-top-strip.mjs')).PHONE_SHELL_TOP_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, phone shell 2, the Builder top on phones and the Director dot (NEXT_PUBLIC_STUDIO_PHONE_SHELL; no .env.example block of its own: the flag's block is PR 1's)
  ...(await import('./studio-speed-perceived-strip.mjs')).SPEED_PERCEIVED_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, Studio perceived speed: the typed message echo (NEXT_PUBLIC_STUDIO_SPEED_PERCEIVED)
  ...(await import('./studio-flow-control-strip.mjs')).FLOW_CONTROL_SCOPE_FILES, // LATER-CHANGE: FRONTEND-1, P3-1 D flow control, Studio half: the stage follows the build, steer a paused build (NEXT_PUBLIC_STUDIO_FLOW_FOCUS / _FLOW_AMEND / _FLOW_AMEND_INSTRUCTIONS)
  ...(await import('./studio-arrange-strip.mjs')).STUDIO_ARRANGE_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, Arrange works in the Studio inspector, selecting no longer raises (NEXT_PUBLIC_STUDIO_ARRANGE)
  ...(await import('./studio-model-choice-strip.mjs')).MODEL_CHOICE_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, P3-10 model choice: the Intelligence picker uses the live model catalogue (NEXT_PUBLIC_STUDIO_MODEL_CHOICE)
  ...(await import('./studio-model-slider-strip.mjs')).MODEL_SLIDER_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, P3-10 model choice, the slider variant of the composer picker, stacked on the line above (NEXT_PUBLIC_STUDIO_MODEL_CHOICE; no .env.example block, no strip of its own)
  ...(await import('./studio-model-five-strip.mjs')).MODEL_FIVE_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, P3-10 model choice, five presets (Quick, Fast, Balanced, Best, Max) on the slider and the compact picker, on dev after the line above (NEXT_PUBLIC_STUDIO_MODEL_CHOICE; no .env.example block, no strip of its own)
  ...(await import('./studio-chat-clean-strip.mjs')).CHAT_CLEAN_SCOPE_FILES, // LATER-CHANGE: FRONTEND-1, P3-1 C chat clean v3: the Director chat as one thread, the job card inline, Send <-> Stop and the slim Continue bar (NEXT_PUBLIC_STUDIO_CHAT_CLEAN)
  ...(await import('./studio-chat-element-edit-strip.mjs')).CHAT_ELEMENT_EDIT_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, chat element edit and notes refresh (NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT)
  ...(await import('./studio-chat-commands-strip.mjs')).CHAT_COMMANDS_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, P3-1 A chat parity: the composer's "/" commands and "@" mentions on chat clean (NEXT_PUBLIC_STUDIO_CHAT_COMMANDS)
  ...(await import('./studio-deck-sync-truth-strip.mjs')).DECK_SYNC_TRUTH_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B26 deck sync truth: the true slide count and no false "another tab" after chat edits (NEXT_PUBLIC_STUDIO_DECK_SYNC_TRUTH)
  ...(await import('./studio-build-failure-end-strip.mjs')).BUILD_FAILURE_END_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B27 build failure end: Studio leaves "Building..." when Director's turn ends with a reply and no build frame (NEXT_PUBLIC_STUDIO_BUILD_FAILURE_END)
  ...(await import('./studio-paused-label-strip.mjs')).PAUSED_LABEL_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B27 paused label: the build ribbon reads "Paused" while the control state is paused (NEXT_PUBLIC_STUDIO_PAUSED_LABEL)
  ...(await import('./studio-chat-parity-strip.mjs')).CHAT_PARITY_SCOPE_FILES, // LATER-CHANGE: FRONTEND-1, P3-1 A chat parity, Studio half: studio_action / studio_action_result (NEXT_PUBLIC_STUDIO_CHAT_PARITY_THEMES / _IDENTITY / _TEMPLATES)
  ...(await import('./studio-chat-element-edit-2-strip.mjs')).CHAT_ELEMENT_EDIT_2_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B32 chat element edit 2: an edit works after a reload and no stale element reference (NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT_2)
  ...(await import('./studio-model-choice-deck-save-strip.mjs')).MODEL_CHOICE_DECK_SAVE_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B37 model choice deck save: a presentation's model choice saves, and "Saved" shows only when it did (NEXT_PUBLIC_STUDIO_MODEL_CHOICE_DECK_SAVE)
  ...(await import('./studio-chat-clean-order-strip.mjs')).CHAT_CLEAN_ORDER_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B31 clean chat order: no stale working line at the outline gate, the thread's notes where they happened (NEXT_PUBLIC_STUDIO_CHAT_CLEAN_ORDER)
  ...(await import('./studio-model-choice-prefs-version-strip.mjs')).MODEL_CHOICE_PREFS_VERSION_SCOPE_FILES, // LATER-CHANGE: FRONTEND-2, B37 follow-up model choice prefs version: the save's version travels in its own header (NEXT_PUBLIC_STUDIO_MODEL_CHOICE_PREFS_VERSION)
  // one line per later change, above this comment
])

export const LATER_ENV_BLOCKS = [
  (await import('./studio-first-paint-strip.mjs')).FIRST_PAINT_ENV_BLOCK, // LATER-CHANGE: COMPOSER-2, studio first paint (NEXT_PUBLIC_STUDIO_FIRST_PAINT_ENABLED)
  (await import('./studio-deck-card-thumbnail-strip.mjs')).DECK_CARD_THUMBNAIL_ENV_BLOCK, // LATER-CHANGE: COMPOSER-2, deck card thumbnails (NEXT_PUBLIC_STUDIO_DECK_CARD_THUMBNAILS_ENABLED)
  (await import('./studio-pass3-polish-strip.mjs')).PASS3_POLISH_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR A (NEXT_PUBLIC_STUDIO_PASS3_POLISH)
  (await import('./studio-bulk-edit-prompt-text-strip.mjs')).BULK_EDIT_PROMPT_TEXT_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, bulk edit prompt text (NEXT_PUBLIC_STUDIO_BULK_EDIT_PROMPT_TEXT)
  (await import('./studio-legal-short-links-strip.mjs')).LEGAL_SHORT_LINKS_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, legal short links and the marketing-slide cache header from uat, D16 a (NEXT_PUBLIC_STUDIO_LEGAL_SHORT_LINKS)
  (await import('./studio-phone-shell-nav-strip.mjs')).PHONE_SHELL_NAV_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, phone shell 1, the bottom tab bar on phones (NEXT_PUBLIC_STUDIO_PHONE_SHELL)
  (await import('./studio-speed-perceived-strip.mjs')).SPEED_PERCEIVED_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, Studio perceived speed: the typed message echo (NEXT_PUBLIC_STUDIO_SPEED_PERCEIVED)
  (await import('./studio-flow-control-strip.mjs')).FLOW_CONTROL_ENV_BLOCK, // LATER-CHANGE: FRONTEND-1, P3-1 D flow control, Studio half (NEXT_PUBLIC_STUDIO_FLOW_FOCUS / _FLOW_AMEND / _FLOW_AMEND_INSTRUCTIONS)
  (await import('./studio-arrange-strip.mjs')).STUDIO_ARRANGE_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, Arrange works in the Studio inspector, selecting no longer raises (NEXT_PUBLIC_STUDIO_ARRANGE)
  (await import('./studio-model-choice-strip.mjs')).MODEL_CHOICE_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, P3-10 model choice: the Intelligence picker uses the live model catalogue (NEXT_PUBLIC_STUDIO_MODEL_CHOICE)
  (await import('./studio-chat-clean-strip.mjs')).CHAT_CLEAN_ENV_BLOCK, // LATER-CHANGE: FRONTEND-1, P3-1 C chat clean v3 (NEXT_PUBLIC_STUDIO_CHAT_CLEAN)
  (await import('./studio-chat-element-edit-strip.mjs')).CHAT_ELEMENT_EDIT_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, chat element edit and notes refresh (NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT)
  (await import('./studio-chat-commands-strip.mjs')).CHAT_COMMANDS_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, P3-1 A chat parity (NEXT_PUBLIC_STUDIO_CHAT_COMMANDS)
  (await import('./studio-deck-sync-truth-strip.mjs')).DECK_SYNC_TRUTH_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B26 deck sync truth: the true slide count and no false "another tab" after chat edits (NEXT_PUBLIC_STUDIO_DECK_SYNC_TRUTH)
  (await import('./studio-build-failure-end-strip.mjs')).BUILD_FAILURE_END_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B27 build failure end (NEXT_PUBLIC_STUDIO_BUILD_FAILURE_END)
  (await import('./studio-paused-label-strip.mjs')).PAUSED_LABEL_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B27 paused label (NEXT_PUBLIC_STUDIO_PAUSED_LABEL)
  (await import('./studio-chat-parity-strip.mjs')).CHAT_PARITY_ENV_BLOCK, // LATER-CHANGE: FRONTEND-1, P3-1 A chat parity, Studio half (NEXT_PUBLIC_STUDIO_CHAT_PARITY_THEMES / _IDENTITY / _TEMPLATES)
  (await import('./studio-chat-element-edit-2-strip.mjs')).CHAT_ELEMENT_EDIT_2_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B32 chat element edit 2 (NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT_2)
  (await import('./studio-model-choice-deck-save-strip.mjs')).MODEL_CHOICE_DECK_SAVE_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B37 model choice deck save (NEXT_PUBLIC_STUDIO_MODEL_CHOICE_DECK_SAVE)
  (await import('./studio-chat-clean-order-strip.mjs')).CHAT_CLEAN_ORDER_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B31 clean chat order (NEXT_PUBLIC_STUDIO_CHAT_CLEAN_ORDER)
  (await import('./studio-model-choice-prefs-version-strip.mjs')).MODEL_CHOICE_PREFS_VERSION_ENV_BLOCK, // LATER-CHANGE: FRONTEND-2, B37 follow-up model choice prefs version (NEXT_PUBLIC_STUDIO_MODEL_CHOICE_PREFS_VERSION)
  // one line per later change, above this comment
]

/** One strip per later change, (rel, text) => text, in the order the changes were stacked. */
export const LATER_STRIPS = [
  (await import('./studio-first-paint-strip.mjs')).stripFirstPaint, // LATER-CHANGE: COMPOSER-2, studio first paint (NEXT_PUBLIC_STUDIO_FIRST_PAINT_ENABLED)
  (await import('./studio-deck-card-thumbnail-strip.mjs')).stripDeckCardThumbnail, // LATER-CHANGE: COMPOSER-2, deck card thumbnails (NEXT_PUBLIC_STUDIO_DECK_CARD_THUMBNAILS_ENABLED)
  (await import('./studio-chat-undo-v2-strip.mjs')).stripChatUndoV2, // LATER-CHANGE: FRONTEND-2, chat undo v2 (NEXT_PUBLIC_STUDIO_CHAT_UNDO; no .env.example block)
  (await import('./studio-pass3-polish-strip.mjs')).stripPass3Polish, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR A (NEXT_PUBLIC_STUDIO_PASS3_POLISH)
  (await import('./studio-pass3-polish-b-strip.mjs')).stripPass3PolishB, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR B (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own)
  (await import('./studio-pass3-polish-c-strip.mjs')).stripPass3PolishC, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR C (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own)
  (await import('./studio-pass3-polish-d-strip.mjs')).stripPass3PolishD, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR D (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own)
  (await import('./studio-bulk-edit-prompt-text-strip.mjs')).stripBulkEditPromptText, // LATER-CHANGE: FRONTEND-2, bulk edit prompt text (NEXT_PUBLIC_STUDIO_BULK_EDIT_PROMPT_TEXT)
  (await import('./studio-pass3-polish-e-strip.mjs')).stripPass3PolishE, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR E (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own)
  (await import('./studio-pass3-polish-f-strip.mjs')).stripPass3PolishF, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR F (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own)
  (await import('./studio-d1-debug-routes-strip.mjs')).stripD1DebugRoutes, // LATER-CHANGE: FRONTEND-2, D1 security hotfix: debug env routes removed, cleanup-sessions dry run gated (no flag: PK's ruling; no .env.example block)
  (await import('./studio-pass3-polish-g-strip.mjs')).stripPass3PolishG, // LATER-CHANGE: FRONTEND-2, pass 3 polish set, PR G (NEXT_PUBLIC_STUDIO_PASS3_POLISH; no .env.example block of its own)
  (await import('./studio-phone-shell-nav-strip.mjs')).stripPhoneShellNav, // LATER-CHANGE: FRONTEND-2, phone shell 1, the bottom tab bar on phones (NEXT_PUBLIC_STUDIO_PHONE_SHELL)
  (await import('./studio-phone-shell-builder-top-strip.mjs')).stripPhoneShellTop, // LATER-CHANGE: FRONTEND-2, phone shell 2, the Builder top on phones and the Director dot (NEXT_PUBLIC_STUDIO_PHONE_SHELL; no .env.example block of its own: the flag's block is PR 1's)
  (await import('./studio-speed-perceived-strip.mjs')).stripSpeedPerceived, // LATER-CHANGE: FRONTEND-2, Studio perceived speed: the typed message echo (NEXT_PUBLIC_STUDIO_SPEED_PERCEIVED)
  (await import('./studio-flow-control-strip.mjs')).stripFlowControl, // LATER-CHANGE: FRONTEND-1, P3-1 D flow control, Studio half (NEXT_PUBLIC_STUDIO_FLOW_FOCUS / _FLOW_AMEND / _FLOW_AMEND_INSTRUCTIONS)
  (await import('./studio-arrange-strip.mjs')).stripStudioArrange, // LATER-CHANGE: FRONTEND-2, Arrange works in the Studio inspector, selecting no longer raises (NEXT_PUBLIC_STUDIO_ARRANGE)
  (await import('./studio-model-choice-strip.mjs')).stripModelChoice, // LATER-CHANGE: FRONTEND-2, P3-10 model choice: the Intelligence picker uses the live model catalogue (NEXT_PUBLIC_STUDIO_MODEL_CHOICE)
  (await import('./studio-chat-clean-strip.mjs')).stripChatClean, // LATER-CHANGE: FRONTEND-1, P3-1 C chat clean v3 (NEXT_PUBLIC_STUDIO_CHAT_CLEAN)
  (await import('./studio-chat-element-edit-strip.mjs')).stripChatElementEdit, // LATER-CHANGE: FRONTEND-2, chat element edit and notes refresh (NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT)
  (await import('./studio-chat-commands-strip.mjs')).stripChatCommands, // LATER-CHANGE: FRONTEND-2, P3-1 A chat parity (NEXT_PUBLIC_STUDIO_CHAT_COMMANDS)
  (await import('./studio-deck-sync-truth-strip.mjs')).stripDeckSyncTruth, // LATER-CHANGE: FRONTEND-2, B26 deck sync truth: the true slide count and no false "another tab" after chat edits (NEXT_PUBLIC_STUDIO_DECK_SYNC_TRUTH)
  (await import('./studio-build-failure-end-strip.mjs')).stripBuildFailureEnd, // LATER-CHANGE: FRONTEND-2, B27 build failure end (NEXT_PUBLIC_STUDIO_BUILD_FAILURE_END)
  (await import('./studio-paused-label-strip.mjs')).stripPausedLabel, // LATER-CHANGE: FRONTEND-2, B27 paused label (NEXT_PUBLIC_STUDIO_PAUSED_LABEL)
  (await import('./studio-chat-parity-strip.mjs')).stripChatParity, // LATER-CHANGE: FRONTEND-1, P3-1 A chat parity, Studio half (NEXT_PUBLIC_STUDIO_CHAT_PARITY_THEMES / _IDENTITY / _TEMPLATES)
  (await import('./studio-chat-element-edit-2-strip.mjs')).stripChatElementEdit2, // LATER-CHANGE: FRONTEND-2, B32 chat element edit 2 (NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT_2)
  (await import('./studio-model-choice-deck-save-strip.mjs')).stripModelChoiceDeckSave, // LATER-CHANGE: FRONTEND-2, B37 model choice deck save (NEXT_PUBLIC_STUDIO_MODEL_CHOICE_DECK_SAVE)
  (await import('./studio-chat-clean-order-strip.mjs')).stripChatCleanOrder, // LATER-CHANGE: FRONTEND-2, B31 clean chat order (NEXT_PUBLIC_STUDIO_CHAT_CLEAN_ORDER)
  (await import('./studio-model-choice-prefs-version-strip.mjs')).stripModelChoicePrefsVersion, // LATER-CHANGE: FRONTEND-2, B37 follow-up model choice prefs version (NEXT_PUBLIC_STUDIO_MODEL_CHOICE_PREFS_VERSION)
  // one line per later change, above this comment
]

const lineStart = (text, at) => at === 0 || text[at - 1] === '\n'
const lineEnd = (text, at) => at === text.length || text[at] === '\n'

/**
 * `text` without the registered blocks, when `rel` is .env.example; every other file (and the empty registry) gives `text` back untouched.
 * A block comes out with the one blank line that separated it from its neighbour: the blank line after it when something follows, else the blank line before it (the block was the last thing in the file, with or without a blank line of its own after it).
 * Only the first whole occurrence of a block is taken (a block that is there twice is a merge mistake and the older pins must still see the second); stripping twice changes nothing more.
 */
export function stripLaterEnvBlocks(rel, text) {
  if (rel !== '.env.example' || typeof text !== 'string' || LATER_ENV_BLOCKS.length === 0) return text
  let out = text
  for (const registered of LATER_ENV_BLOCKS) {
    const block = String(registered).replace(/^\n+/, '').replace(/\n+$/, '')
    if (block === '') continue
    let at = out.indexOf(block)
    while (at !== -1 && !(lineStart(out, at) && lineEnd(out, at + block.length))) at = out.indexOf(block, at + 1)
    if (at === -1) continue
    const before = out.slice(0, at), after = out.slice(at + block.length)
    if (/^\n*$/.test(after)) out = before.endsWith('\n\n') ? before.slice(0, -1) : before // last in the file (only newlines after it, whether or not the block carries its own trailing blank line): the blank line before it goes
    else if (after.startsWith('\n\n')) out = before + after.slice(2) // the blank line after it goes with it
    else out = before + after.slice(1) // no blank line after it: only the block's own lines go
  }
  return out
}

/**
 * What an older pin reads an app file or .env.example through, INNERMOST: every registered strip in order (a result that is not a string is ignored), then the registered .env.example blocks. A file no later
 * change touches, and the empty registry, come back byte for byte.
 */
export function stripLaterChanges(rel, text) {
  if (typeof text !== 'string') return text
  let out = text
  for (const strip of LATER_STRIPS) {
    if (typeof strip !== 'function') continue
    const next = strip(rel, out)
    if (typeof next === 'string') out = next
  }
  return stripLaterEnvBlocks(rel, out)
}
