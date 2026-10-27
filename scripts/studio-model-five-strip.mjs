// FRONTEND-2 (P3-10 MODEL CHOICE, five presets). Flag NEXT_PUBLIC_STUDIO_MODEL_CHOICE (the same one, exact "true", default off). PK (PROGRAM-1, 26 Oct, item 6) wants the composer's model slider on FIVE stops, Quick, Fast,
// Balanced, Best and Max, and ROUTER-2 adds the two presets (quick and max; the wire id of Fast stays "economy") with a top-level preset_order and preset_hints in the catalogue (behind Director's flag
// DIRECTOR_MODEL_CATALOGUE_PRESETS_ENABLED, off: absent until it is on). The Studio routes accept the two ids (lib/studio-model-choice-server.ts reads the one list in lib/studio-model-choice.ts), the catalogue
// helper reads the order and the hints, and the slider and the compact picker list the presets in the catalogue's order with their hints. No new route, no env block, no edit to any app file. Plain node, no imports,
// nothing read from disk or git here.
//
// What it registers (scripts/studio-later-changes.mjs, ONE line, LATER_CHANGE_FILES): every file its commits touch, so that the older scope checks that read a committed diff skip them. There is no env block and no
// strip: no existing app file carries a line of this change.

export const MODEL_FIVE_FLAG = 'NEXT_PUBLIC_STUDIO_MODEL_CHOICE'
/** Studio dev (studio-v4-dev-preparation-code) with #521 and #526 merged: the commit this change is cut from. */
export const MODEL_FIVE_BASE_COMMIT = '59588574415409a288917b5842424c0840d3e195'
/** The subject prefix of this change's own commits. */
export const MODEL_FIVE_SUBJECT = 'Model choice five: '

/** Files this change adds. */
export const MODEL_FIVE_NEW_FILES = [
  'scripts/studio-model-five-strip.mjs',
  'scripts/fixtures/studio-model-choice/catalogue-five-presets.json',
]
/** Files already on dev (#521, #526) that this change edits. */
export const MODEL_FIVE_EDITED_FILES = [
  'lib/studio-model-choice.ts',
  'lib/studio-model-choice-server.ts',
  'lib/studio-model-picker.ts',
  'lib/studio-model-slider.ts',
  'components/model-choice/model-slider.tsx',
  'components/model-choice/model-slider.css',
  'scripts/render-model-picker-fixture.mjs',
  'scripts/test-studio-model-picker.mjs',
  'scripts/test-studio-model-choice.mjs',
  'scripts/studio-later-changes.mjs',
]
/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const MODEL_FIVE_SCOPE_FILES = new Set([...MODEL_FIVE_NEW_FILES, ...MODEL_FIVE_EDITED_FILES])
