import type { DiagramGenerationConfig } from '@/types/textlabs'

export type RefineGenerationConfig =
  | Record<string, unknown>
  | DiagramGenerationConfig
  | null

function readGenerationConfig(value: unknown): Exclude<RefineGenerationConfig, null> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Exclude<RefineGenerationConfig, null>
    : null
}

/**
 * The config returned by Text Labs describes the element that was actually
 * rendered. It can contain Generator-authored state such as CUSTOM
 * `generated_ir` or the exact Gantt tasks, so it must win over the submitted
 * control snapshot when preparing an immediate follow-up refine.
 */
export function resolveRefineGenerationConfig(
  returnedConfig: unknown,
  submittedConfig: unknown,
): RefineGenerationConfig {
  return readGenerationConfig(returnedConfig)
    ?? readGenerationConfig(submittedConfig)
    ?? null
}
