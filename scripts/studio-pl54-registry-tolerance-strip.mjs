// PL-54 (Platform card, 26 Nov 2026, from PL-42's option b): one generic tolerance for the registry-order pins in three older proofs, so a change registered later stops re-editing them. Tests only: no flag, no product code.
// The change adds TWO marked lines to each of scripts/test-studio-my-companions-wiring.mjs, scripts/test-studio-research-by-level.mjs and scripts/test-studio-upload-formats.mjs (an import and one call of
// tolerateLaterChanges from scripts/studio-registry-tolerance.mjs; no existing line is rewritten, so no older strip has to be re-ordered). Older proofs hold those three files to the base byte for byte ("dev's file"), so
// the change registers a strip: stripPl54RegistryTolerance(rel, text) takes its marked lines out of the three proofs, takes its own two lines out of scripts/studio-later-changes.mjs, and returns every other file untouched.
// Plain node, nothing is read from disk or git here.

export const PL54_BASE_COMMIT = '7a743ed281' // Studio origin/uat, the commit this change is cut from
export const PL54_COMMIT_SUBJECT = /^PL-54:/
export const PL54_MARK = 'PL-54-TOLERANCE' // every line this change adds to an older proof carries it

/** The three older proofs this change teaches (each gains exactly two lines). */
export const PL54_PIN_TEST_FILES = new Set([
  'scripts/test-studio-my-companions-wiring.mjs',
  'scripts/test-studio-research-by-level.mjs',
  'scripts/test-studio-upload-formats.mjs'
])

/** Every file this change's commits touch: what the older scope checks skip once the registry names it. */
export const PL54_SCOPE_FILES = new Set([
  ...PL54_PIN_TEST_FILES,
  'scripts/studio-registry-tolerance.mjs',
  'scripts/studio-pl54-registry-tolerance-strip.mjs',
  'scripts/test-studio-pl54-registry-tolerance.mjs',
  'scripts/studio-later-changes.mjs'
])

/** The two lines this change adds to scripts/studio-later-changes.mjs, exactly as registered. */
export const PL54_REGISTRY_LINES = [
  "  ...(await import('./studio-pl54-registry-tolerance-strip.mjs')).PL54_SCOPE_FILES, // LATER-CHANGE: PLATFORM (LEAD-PLATFORM-CLAUDE), PL-54 generic registry tolerance in three older proofs (tests only: no flag, no product code)\n",
  "  (await import('./studio-pl54-registry-tolerance-strip.mjs')).stripPl54RegistryTolerance, // LATER-CHANGE: PLATFORM (LEAD-PLATFORM-CLAUDE), PL-54 generic registry tolerance in three older proofs (tests only: no flag, no product code)\n"
]

export function stripPl54RegistryTolerance(rel, text) {
  if (typeof text !== 'string') return text
  if (rel === 'scripts/studio-later-changes.mjs') {
    let reg = text
    for (const line of PL54_REGISTRY_LINES) { const at = reg.indexOf(line); if (at >= 0) reg = reg.slice(0, at) + reg.slice(at + line.length) }
    return reg
  }
  if (!PL54_PIN_TEST_FILES.has(rel)) return text
  return text.split('\n').filter(line => !line.includes(PL54_MARK)).join('\n')
}
