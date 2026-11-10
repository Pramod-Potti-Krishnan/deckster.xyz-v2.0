/**
 * J3-EMPTY-PROMPT-GUARD (J3 pass 2, R5-9): the Add Element panel's Generate button stayed enabled with an empty "Generation prompt", so a
 * paid generation could be fired with nothing to generate from (the forms then quietly substituted a stand-in prompt such as "shopping cart
 * icon", "custom shape" or "Generate an infographic"). Flag NEXT_PUBLIC_STUDIO_EMPTY_PROMPT_GUARD, exact 'true', default off; off is today's
 * panel exactly.
 *
 * On: Generate is disabled, and every other way into the same submit (the Cmd/Ctrl+Enter shortcut, the error box's retry button) does
 * nothing, while the prompt is empty or only whitespace, and only where the prompt is actually required:
 * - only a NEW element (panel mode 'generate'). Refine / Edit current / variation work on an element that already exists and keep today's rules;
 * - not while the panel asks to "Check generation result" (retryStrategy 'resume_same_attempt'): that re-reads an attempt already paid for;
 * - not when the form says its prompt is optional right now (MandatoryConfig.promptOptional): Chart with Custom JSON data, a preset Shape
 *   (only a custom shape reads the prompt), an Infographic with a reference image or manual segment rows.
 *
 * Pure: no React, no DOM, no network.
 */

export const STUDIO_EMPTY_PROMPT_GUARD_ENABLED = process.env.NEXT_PUBLIC_STUDIO_EMPTY_PROMPT_GUARD === 'true'

/** The hint a blocked Generate button carries (title / accessible description). */
export const EMPTY_PROMPT_HINT = 'Describe what you want to generate'

/**
 * Empty = nothing a person could read: no characters, whitespace only (including no-break spaces) or only zero-width characters
 * (which String.trim keeps, and which a paste can leave behind).
 */
export function isEmptyElementPrompt(prompt: unknown): boolean {
  if (typeof prompt !== 'string') return true
  return prompt.replace(/[\u200b-\u200d\u2060\ufeff]/g, '').trim() === ''
}

/** True when any registered mandatory config says the prompt is optional right now. */
export function mandatoryConfigPromptOptional(
  config: { promptOptional?: boolean } | ReadonlyArray<{ promptOptional?: boolean }> | null | undefined,
): boolean {
  if (!config) return false
  const configs = Array.isArray(config) ? config : [config as { promptOptional?: boolean }]
  return configs.some(entry => entry?.promptOptional === true)
}

export interface EmptyPromptGuardInput {
  /** Defaults to the flag; a test may pass it. */
  enabled?: boolean
  mode: 'generate' | 'edit' | 'refine'
  prompt: unknown
  retryStrategy?: string | null
  /** The form's own say (see mandatoryConfigPromptOptional). */
  promptOptional?: boolean
}

/** True when Generate must do nothing because a required prompt is empty. Always false with the flag off. */
export function emptyPromptBlocksGenerate(input: EmptyPromptGuardInput): boolean {
  if (!(input.enabled ?? STUDIO_EMPTY_PROMPT_GUARD_ENABLED)) return false
  if (input.mode !== 'generate') return false
  if (input.retryStrategy === 'resume_same_attempt') return false
  if (input.promptOptional === true) return false
  return isEmptyElementPrompt(input.prompt)
}
