import type { TemplateEnrichmentResult } from '@/hooks/use-templates'

const RETRY_FIELDS = [
  'blueprint_enrichment_status', 'blueprint_enrichment_error', 'blueprint_enriched_at',
  'template_purity_status', 'template_purity_error', 'template_purified_at',
] as const

export interface TemplateRetryAcknowledgement<T> {
  template: T
  /** Local diagnostic history, separate from the latest authoritative fields. */
  previousErrors: string[]
}

/** A retry acknowledgement does not imply cleanup pending, readiness or success.
 * Copy only explicitly returned fields; an explicit null is distinct from an
 * omitted field. Never assign one template's acknowledgement to another. */
export function mergeTemplateRetryAcknowledgement<T extends { id: string }>(
  template: T,
  result: TemplateEnrichmentResult | null | undefined,
): TemplateRetryAcknowledgement<T> | null {
  if (!result || typeof result.id !== 'string' || !result.id || result.id !== template.id) return null
  const next = { ...template } as T & Partial<TemplateEnrichmentResult>
  for (const field of RETRY_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(result, field)) {
      // The response type already defines each wire field. A structural merge
      // avoids overwriting omitted fields or inventing an optimistic status.
      Object.assign(next, { [field]: result[field] })
    }
  }
  const source = template as T & Partial<TemplateEnrichmentResult>
  const previousErrors = [...new Set([source.blueprint_enrichment_error, source.template_purity_error]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0))]
  return { template: next, previousErrors }
}
