// PL-42 (Platform card, 26 Nov 2026): the locked research switches say the outline is written, not that research ran. Copy only, no flag: it is live at merge.
// The change replaces ONE sentence in five source files (four on the card, the /kg lock found while testing, ARCH-PLATFORM 09:22Z) and in the two assertions of scripts/test-studio-chat-commands.mjs that pinned
// the old reply; and, by ARCH-PLATFORM's ruling (a) of 09:22Z, it teaches three older registry-order pins (test-studio-my-companions-wiring, test-studio-research-by-level, test-studio-upload-formats).
// Older proofs hold those files to the base byte for byte ("dev's file"); so this change registers a code strip: stripPl42LockedCopy(rel, text) puts each replaced line back as dev had it (generated from the diff,
// not retyped), takes this change's own two lines out of scripts/studio-later-changes.mjs, and returns every other file untouched. Plain node, nothing is read from disk or git here.
import { stripUploadFormats } from './studio-upload-formats-strip.mjs'   // the change stacked directly before this one: its strip also edits the My companions and Research by level proofs, so it is run again after they are put back

export const PL42_BASE_COMMIT = 'af225a0c8f' // Studio origin/uat, the commit this change is cut from
export const PL42_COMMIT_SUBJECT = /^PL-42:/

/** Every file this change's commits touch: what the older scope checks skip once the registry names it. */
export const PL42_SCOPE_FILES = new Set([
  "components/builder/chat-input.tsx",
  "lib/studio-chat-clean.ts",
  "lib/studio-research-switch.ts",
  "lib/studio-chat-commands.ts",
  "lib/studio-chat-parity-workspace.ts",
  "scripts/test-studio-chat-commands.mjs",
  "scripts/test-studio-my-companions-wiring.mjs",
  "scripts/test-studio-research-by-level.mjs",
  "scripts/test-studio-upload-formats.mjs",
  "scripts/test-studio-pl42-locked-copy.mjs",
  "scripts/studio-pl42-locked-copy-strip.mjs",
  "scripts/studio-later-changes.mjs"
])

/** The three older proofs this change teaches (the reverse hunks of these are run through the strip of the change before, see below). */
export const PL42_PIN_TEST_FILES = new Set([
  "scripts/test-studio-my-companions-wiring.mjs",
  "scripts/test-studio-research-by-level.mjs",
  "scripts/test-studio-upload-formats.mjs"
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
  "lib/studio-chat-parity-workspace.ts": [
    ["  kgLocked: 'Locked for this deck: its outline is already written.',\n", "  kgLocked: 'Locked: research already ran for this deck.',\n"],
  ],
  "scripts/test-studio-chat-commands.mjs": [
    ["      eq([r.kind, r.title, r.body.startsWith('Locked for this deck: its outline is already written.'), r.button], ['decline', 'Locked for this deck', true, { label: 'Show research options', action: 'open-research-options' }], `${id}: locked once research has run, with a button to the options menu`)\n", "      eq([r.kind, r.title, r.body.startsWith('Research already ran'), r.button], ['decline', 'Locked for this deck', true, { label: 'Show research options', action: 'open-research-options' }], `${id}: locked once research has run, with a button to the options menu`)\n"],
    ["    eq([locked.records.calls, noteOf(locked).text.slice(0, 3)], [[], ['Locked for this deck', 'Locked for this deck: its outline is already written. Start a new deck to change these.', 'Show research options']], '/research once research has run: the lock holds, with the way to the options menu')\n", "    eq([locked.records.calls, noteOf(locked).text.slice(0, 3)], [[], ['Locked for this deck', 'Research already ran, so these switches can no longer change. Start a new session to change them.', 'Show research options']], '/research once research has run: the lock holds, with the way to the options menu')\n"],
  ],
  "scripts/test-studio-my-companions-wiring.mjs": [
    ["import { stripPl42LockedCopy } from './studio-pl42-locked-copy-strip.mjs' // LATER-CHANGES: registry read (PL-42 locked research switches copy): chat-input.tsx carries one replaced sentence of that change; this proof checks the files it must not touch are dev's, so it reads them through that change's own strip\n", ""],
    ["{ const realRead = fs.readFileSync; fs.readFileSync = function (file, ...rest) { const out = realRead.call(this, file, ...rest); const rel = typeof file === 'string' ? path.relative(root, file) : ''; return typeof out === 'string' ? stripPl42LockedCopy(rel, out) : out } } // LATER-CHANGES: registry read (PL-42 locked research switches copy): every read goes through that change's own strip (its replaced sentence put back, its two registry lines out, nothing else), so this proof sees the files as dev has them\n", ""],
  ],
  "scripts/test-studio-research-by-level.mjs": [
    ["import { stripPl42LockedCopy, PL42_SCOPE_FILES } from './studio-pl42-locked-copy-strip.mjs' // LATER-CHANGES: registry read (PL-42 locked research switches copy): a later change (stacked after this one) registers two lines and puts one sentence in files this proof holds to dev's; this proof reads them without it and counts its files in the whole-range scope\n", ""],
    ["{ const realRead = fs.readFileSync; fs.readFileSync = function (file, ...rest) { const out = realRead.call(this, file, ...rest); const rel = typeof file === 'string' ? path.relative(root, file) : ''; return typeof out === 'string' ? stripPl42LockedCopy(rel, out) : out } } // LATER-CHANGES: registry read (PL-42 locked research switches copy): every read goes through that change's own strip (its replaced sentence put back, its two registry lines out, nothing else), so this proof sees the files as dev has them\n", ""],
    ["  assert.ok(registry.LATER_STRIPS.includes(STRIP_FN) && registry.LATER_STRIPS.slice(registry.LATER_STRIPS.indexOf(STRIP_FN) + 1).every(strip => strip === stripUploadFormats || strip === stripPl42LockedCopy), 'the strip runs last, but for the Studio upload formats change\\'s and PL-42\\'s (the order the changes were stacked)') // LATER-CHANGES: registry read (STUDIO-UPLOAD-FORMATS): that change's strip is registered after this one\n", "  assert.ok(registry.LATER_STRIPS.includes(STRIP_FN) && registry.LATER_STRIPS.slice(registry.LATER_STRIPS.indexOf(STRIP_FN) + 1).every(strip => strip === stripUploadFormats), 'the strip runs last, but for the Studio upload formats change\\'s (the order the changes were stacked)') // LATER-CHANGES: registry read (STUDIO-UPLOAD-FORMATS): that change's strip is registered after this one\n"],
    ["const wholeRangeOutside = (names, marketing = UAT_MARKETING_V4_SCOPE_FILES) => names.filter(Boolean).filter(rel => !SCOPE.has(rel) && !UPLOAD_FORMATS_SCOPE_FILES.has(rel) && !PL42_SCOPE_FILES.has(rel) && !marketing.has(rel)).sort() // RESEARCH-BY-LEVEL (S67): the committed files of BASE..HEAD that no scope names; a promotion merge of dev into uat carries uat's own marketing-v4 commits, left out by exact path (the uat marketing registry's set), never by prefix and never every later change's files; LATER-CHANGES: registry read (STUDIO-UPLOAD-FORMATS): taught to that change's pin with the other lines of this proof\n", "const wholeRangeOutside = (names, marketing = UAT_MARKETING_V4_SCOPE_FILES) => names.filter(Boolean).filter(rel => !SCOPE.has(rel) && !UPLOAD_FORMATS_SCOPE_FILES.has(rel) && !marketing.has(rel)).sort() // RESEARCH-BY-LEVEL (S67): the committed files of BASE..HEAD that no scope names; a promotion merge of dev into uat carries uat's own marketing-v4 commits, left out by exact path (the uat marketing registry's set), never by prefix and never every later change's files; LATER-CHANGES: registry read (STUDIO-UPLOAD-FORMATS): taught to that change's pin with the other lines of this proof\n"],
  ],
  "scripts/test-studio-upload-formats.mjs": [
    ["import { stripPl42LockedCopy } from './studio-pl42-locked-copy-strip.mjs' // LATER-CHANGES: registry read (PL-42 locked research switches copy): a later change (stacked after this one) registers its lines after this change's; this proof names them as the only lines that may follow\n", ""],
    ["const laterOnly = (rel, text) => { const strips = registry.LATER_STRIPS, at = strips.indexOf(STRIP_FN); return (at === -1 ? [] : strips.slice(at + 1)).reduce((out, strip) => { const next = strip === stripPl42LockedCopy ? strip(rel, out, false) : strip(rel, out); return typeof next === 'string' ? next : out }, text) }   // PL-42's strip, run after this one in the registry, puts its taught proofs back to dev's text but leaves this change's marked lines (rerunEarlier = false)\n", "const laterOnly = (rel, text) => { const strips = registry.LATER_STRIPS, at = strips.indexOf(STRIP_FN); return (at === -1 ? [] : strips.slice(at + 1)).reduce((out, strip) => { const next = strip(rel, out); return typeof next === 'string' ? next : out }, text) }\n"],
    ["function registryChecks(text = stripPl42LockedCopy(REGISTRY, read(REGISTRY))) {   // PL-42's two registry lines (stacked after this change) are read out first\n", "function registryChecks(text = read(REGISTRY)) {\n"],
    ["    assert.ok(at > 0, `${list}: this change's line is in the list`); assert.ok(rows.slice(at + 1).every(row => row.includes('studio-pl42-locked-copy-strip.mjs')), `${list}: the line is at the true end, just above the marker comment (but for PL-42's, stacked after this change)`)\n", "    assert.ok(at > 0, `${list}: this change's line is in the list`); assert.equal(at, rows.length - 1, `${list}: the line is at the true end, just above the marker comment`)\n"],
    ["  assert.ok(registry.LATER_STRIPS.includes(STRIP_FN) && registry.LATER_STRIPS.slice(registry.LATER_STRIPS.indexOf(STRIP_FN) + 1).every(strip => strip === stripPl42LockedCopy), 'the strip runs last, but for PL-42\\'s (the order the changes were stacked)'); assert.equal(registry.LATER_ENV_BLOCKS.at(-1), ENV_BLOCK, 'the block is the last')\n", "  assert.equal(registry.LATER_STRIPS.at(-1), STRIP_FN, 'the strip runs last (the order the changes were stacked)'); assert.equal(registry.LATER_ENV_BLOCKS.at(-1), ENV_BLOCK, 'the block is the last')\n"],
    ["  const now = laterOnly(CHAT, read(CHAT))   // PL-42's strip (registered after this one) puts the one replaced sentence of the composer back first\n", "  const now = read(CHAT)\n"],
  ],
}

/** (rel, text, rerunEarlier = true) => text: each replaced line put back as dev had it (once each, only where it stands whole), the registry without this change's two lines; any other file as it is.
 *  For the three taught proofs the strip of the Upload formats change (registered before this one, it also edits those proofs on lines this change had edited) is run again after the put-back;
 *  a reader that applies only the strips registered AFTER its own (Upload formats' laterOnly) passes rerunEarlier = false. */
export function stripPl42LockedCopy(rel, text, rerunEarlier = true) {
  if (typeof text !== 'string') return text
  if (rel === 'scripts/studio-later-changes.mjs') {
    let reg = text
    for (const line of PL42_REGISTRY_LINES) { const at = reg.indexOf(line); if (at >= 0) reg = reg.slice(0, at) + reg.slice(at + line.length) }
    return reg
  }
  if (!PL42_REVERSE_HUNKS[rel]) return text
  let out = text
  for (const [now, was] of PL42_REVERSE_HUNKS[rel]) { const at = out.indexOf(now); if (at >= 0) out = out.slice(0, at) + was + out.slice(at + now.length) }
  if (rerunEarlier && PL42_PIN_TEST_FILES.has(rel)) { const next = stripUploadFormats(rel, out); if (typeof next === 'string') out = next }
  return out
}
