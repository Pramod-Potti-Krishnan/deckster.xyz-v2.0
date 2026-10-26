// FRONTEND-2 (P3-10 MODEL CHOICE, the SLIDER variant of the composer picker). Flag NEXT_PUBLIC_STUDIO_MODEL_CHOICE (the same one, exact "true", default off): ModelPicker variant="slider" is a 24 px gauge icon that opens a
// popover with a slider over ordered stops (components/model-choice/model-slider.tsx, its stylesheet, lib/studio-model-slider.ts, the shared row components/model-choice/model-option.tsx). Stacked on #521
// (frontend2/model-choice-ui); it adds NO .env.example block, NO route and NO edit to any app file: the picker is placed by FRONTEND-1 and nothing here mounts it. Plain node, no imports, nothing read from disk or git here.
//
// What it registers (scripts/studio-later-changes.mjs, ONE line, LATER_CHANGE_FILES): every file its commits touch, so that the older scope checks that read a committed diff skip them. There is no env block and
// no strip: no existing app file carries a line of this change.

export const MODEL_SLIDER_FLAG = 'NEXT_PUBLIC_STUDIO_MODEL_CHOICE'
/** #521's head (frontend2/model-choice-ui): the commit this change is stacked on. */
export const MODEL_SLIDER_BASE_COMMIT = '42f51ca952ebca3ccf4548d260f3870601e4f22e'
/** The subject prefix of this change's own commits. */
export const MODEL_SLIDER_SUBJECT = 'Model choice slider: '

/** Files this change adds. */
export const MODEL_SLIDER_NEW_FILES = [
  'lib/studio-model-slider.ts',
  'components/model-choice/model-option.tsx',
  'components/model-choice/model-slider.tsx',
  'components/model-choice/model-slider.css',
  'scripts/studio-model-slider-strip.mjs',
]
/** Files of #521 this change edits (all of them #521's own: the catalogue helper, the picker, its kit, fixture and proofs, the registry). */
export const MODEL_SLIDER_EDITED_FILES = [
  'lib/studio-model-choice.ts',
  'components/model-choice/model-picker.tsx',
  'scripts/studio-model-picker-kit.mjs',
  'scripts/render-model-picker-fixture.mjs',
  'scripts/test-studio-model-picker.mjs',
  'scripts/test-studio-model-choice.mjs',
  'scripts/studio-later-changes.mjs',
]
/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const MODEL_SLIDER_SCOPE_FILES = new Set([...MODEL_SLIDER_NEW_FILES, ...MODEL_SLIDER_EDITED_FILES])
