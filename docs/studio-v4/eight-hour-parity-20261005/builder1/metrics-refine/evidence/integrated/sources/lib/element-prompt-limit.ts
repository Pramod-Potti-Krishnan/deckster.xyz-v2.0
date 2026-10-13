export interface ElementPromptLengthState {
  length: number
  limit: number | null
  overLimit: boolean
  overflow: number
}

export const CUSTOM_DIAGRAM_PROMPT_MAX_LENGTH = 1200

export function unicodeCodePointLength(value: string): number {
  // Match Python/Pydantic max_length semantics. JavaScript's string.length
  // counts a non-BMP character as two UTF-16 code units.
  return Array.from(value).length
}

export function elementPromptLengthState(
  prompt: string,
  maxLength: number | null | undefined,
): ElementPromptLengthState {
  const limit = typeof maxLength === 'number' && Number.isFinite(maxLength) && maxLength > 0
    ? Math.floor(maxLength)
    : null
  const length = unicodeCodePointLength(prompt)
  const overflow = limit === null ? 0 : Math.max(0, length - limit)
  return {
    length,
    limit,
    overLimit: overflow > 0,
    overflow,
  }
}
