// PL-42 (Platform card, 26 Nov 2026): the locked research switches say the outline is written, not that research ran. Copy only, no flag: it is live at merge.
// The change replaces ONE sentence in four source files and in the two assertions of scripts/test-studio-chat-commands.mjs that pinned the old reply. Older proofs hold those files
// to the base byte for byte ("dev's file"); so this change registers a code strip: stripPl42LockedCopy(rel, text) puts each replaced line back as dev had it (generated from the diff, not retyped),
// takes this change's own two lines out of scripts/studio-later-changes.mjs, and returns every other file untouched. Plain node, nothing is read from disk or git here.

export const PL42_BASE_COMMIT = 'af225a0c8f' // Studio origin/uat, the commit this change is cut from
export const PL42_COMMIT_SUBJECT = /^PL-42:/

/** Every file this change's commits touch: what the older scope checks skip once the registry names it. */
export const PL42_SCOPE_FILES = new Set([
  "components/builder/chat-input.tsx",
  "lib/studio-chat-clean.ts",
  "lib/studio-research-switch.ts",
  "lib/studio-chat-commands.ts",
  "scripts/test-studio-chat-commands.mjs",
  "scripts/test-studio-pl42-locked-copy.mjs",
  "scripts/studio-pl42-locked-copy-strip.mjs",
  "scripts/studio-later-changes.mjs"
])

/** The two lines this change adds to scripts/studio-later-changes.mjs, exactly as registered (generated from the registry, not retyped). */
export const PL42_REGISTRY_LINES = [
  "  ...(await import('./studio-pl42-locked-copy-strip.mjs')).PL42_SCOPE_FILES, // LATER-CHANGE: PLATFORM (LEAD-PLATFORM-CLAUDE), PL-42 locked research switches: the panel notice, the tooltips and the chat reply say the outline is written, not that research ran (no flag, live at merge)\n",
  "  (await import('./studio-pl42-locked-copy-strip.mjs')).stripPl42LockedCopy, // LATER-CHANGE: PLATFORM (LEAD-PLATFORM-CLAUDE), PL-42 locked research switches: the panel notice, the tooltips and the chat reply say the outline is written, not that research ran (no flag, live at merge)\n"
]

/** The reverse hunks: [text as it stands now, text as dev had it], generated from the diff against the base. */
export const PL42_REVERSE_HUNKS = {
  "components/builder/chat-input.tsx": [
    ["                      Locked for this deck: its outline is already written. Start a new deck to change these.\n", "                      Locked for this deck \u2014 research already ran. Start a new\n                      session to change these.\n"],
  ],
  "lib/studio-chat-clean.ts": [
    ["  lockedNote: 'Locked for this deck: its outline is already written. Start a new deck to change these.',\n", "  lockedNote: 'Locked for this deck \u2014 research already ran',\n"],
  ],
  "lib/studio-research-switch.ts": [
    ["  lockedNote: 'Locked for this deck: its outline is already written. Start a new deck to change these.',\n", "  lockedNote: 'Locked for this deck \u2014 research already ran',\n"],
  ],
  "lib/studio-chat-commands.ts": [
    ["  researchLockedBody: 'Locked for this deck: its outline is already written. Start a new deck to change these.',\n", "  researchLockedBody: 'Research already ran, so these switches can no longer change. Start a new session to change them.',\n"],
  ],
  "scripts/test-studio-chat-commands.mjs": [
    ["      eq([r.kind, r.title, r.body.startsWith('Locked for this deck: its outline is already written.'), r.button], ['decline', 'Locked for this deck', true, { label: 'Show research options', action: 'open-research-options' }], `${id}: locked once research has run, with a button to the options menu`)\n", "      eq([r.kind, r.title, r.body.startsWith('Research already ran'), r.button], ['decline', 'Locked for this deck', true, { label: 'Show research options', action: 'open-research-options' }], `${id}: locked once research has run, with a button to the options menu`)\n"],
    ["    eq([locked.records.calls, noteOf(locked).text.slice(0, 3)], [[], ['Locked for this deck', 'Locked for this deck: its outline is already written. Start a new deck to change these.', 'Show research options']], '/research once research has run: the lock holds, with the way to the options menu')\n", "    eq([locked.records.calls, noteOf(locked).text.slice(0, 3)], [[], ['Locked for this deck', 'Research already ran, so these switches can no longer change. Start a new session to change them.', 'Show research options']], '/research once research has run: the lock holds, with the way to the options menu')\n"],
  ],
}

/** (rel, text) => text: each replaced line put back as dev had it (once each, only where it stands whole), the registry without this change's two lines; any other file as it is. */
export function stripPl42LockedCopy(rel, text) {
  if (typeof text !== 'string') return text
  if (rel === 'scripts/studio-later-changes.mjs') {
    let reg = text
    for (const line of PL42_REGISTRY_LINES) { const at = reg.indexOf(line); if (at >= 0) reg = reg.slice(0, at) + reg.slice(at + line.length) }
    return reg
  }
  if (!PL42_REVERSE_HUNKS[rel]) return text
  let out = text
  for (const [now, was] of PL42_REVERSE_HUNKS[rel]) { const at = out.indexOf(now); if (at >= 0) out = out.slice(0, at) + was + out.slice(at + now.length) }
  return out
}
