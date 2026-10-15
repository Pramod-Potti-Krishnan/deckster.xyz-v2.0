/**
 * PASS2B batch 2 (J3-09): a preset Shape (anything but Custom) sends `shape_config.prompt: null` and only Custom reads the prompt, yet the Add Element
 * panel's box still showed "e.g., a red star" and took text that was then silently dropped. Flag NEXT_PUBLIC_STUDIO_SHAPE_PRESET_PROMPT_HINT, exact
 * 'true', default off; off is today's panel exactly.
 *
 * On: while a preset is selected the Shape form tells the panel (MandatoryConfig.promptDisabledHint) that its prompt is not read, and the prompt box
 * becomes read-only + aria-disabled with this sentence visible under it. The typed text is kept (the panel still owns it), so choosing Custom again
 * shows it and sends it. Custom is unchanged. The request is unchanged: a preset still sends prompt: null, and the top-level prompt the form builds is
 * whatever it was. The empty-prompt guard (#398) keeps its rule: a preset opts out of it (promptOptional), Custom needs text.
 *
 * Pure: no React, no DOM, no network.
 */

export const STUDIO_SHAPE_PRESET_PROMPT_HINT_ENABLED = process.env.NEXT_PUBLIC_STUDIO_SHAPE_PRESET_PROMPT_HINT === 'true'

/** The sentence under the read-only prompt box. */
export const SHAPE_PRESET_PROMPT_HINT = "Presets don't use a prompt. Choose Custom to describe a shape."

/** The hint the Shape form registers for the selected shape type; undefined for Custom and always with the flag off. */
export function shapePresetPromptHint(shapeType: string, enabled: boolean = STUDIO_SHAPE_PRESET_PROMPT_HINT_ENABLED): string | undefined {
  if (!enabled) return undefined
  return shapeType === 'custom' ? undefined : SHAPE_PRESET_PROMPT_HINT
}

/** The slice of the Shape form's registered mandatory config this adds: `{ promptDisabledHint }` for a preset, `{}` for Custom and with the flag off. */
export function shapePresetPromptHintConfig(shapeType: string, enabled: boolean = STUDIO_SHAPE_PRESET_PROMPT_HINT_ENABLED): { promptDisabledHint?: string } {
  const promptDisabledHint = shapePresetPromptHint(shapeType, enabled)
  return promptDisabledHint === undefined ? {} : { promptDisabledHint }
}
