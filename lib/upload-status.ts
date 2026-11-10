export type UploadLifecycleStatus =
  | 'uploading'
  | 'stored'
  | 'processing'
  | 'success'
  | 'degraded'
  | 'error'

export type IngestReadiness = {
  success?: boolean | null
  status?: string | null
  annotation_status?: string | null
  parse_status?: string | null
  error?: string | null
  degraded_reason?: string | null
  warning?: string | null
  readiness?: {
    fully_ready?: boolean | null
    partial?: boolean | null
    text_extracted?: boolean | null
    summary_ready?: boolean | null
    inventory_ready?: boolean | null
    semantic_query_verified?: boolean | null
    object_storage_status?: string | null
    extraction_status?: string | null
    table_extraction_status?: string | null
    semantic_index_status?: string | null
    degraded_reasons?: string[] | null
    retryable_steps?: string[] | null
  } | null
}

export function getEnrichmentLabel(
  readiness: IngestReadiness | null | undefined,
): string {
  const state = readiness?.readiness
  if (state?.semantic_query_verified) return 'Searchable'
  if (state?.inventory_ready && state?.summary_ready) {
    return 'Research-ready · indexing'
  }
  if (state?.text_extracted) return 'Read · building inventory'
  return 'Reading document'
}

export type EnrichmentOutcome = {
  status: 'success' | 'degraded'
  detail?: string
}

export type UploadStatusPresentation = {
  label: string
  ariaLabel: string
  blocksSend: boolean
  showActivity: boolean
  showProgress: boolean
}

const DEGRADED_STATUSES = new Set(['degraded', 'partial'])
const DEGRADED_ANNOTATION_STATUSES = new Set([
  'empty',
  'insufficient_text',
  'upstream_error',
])

function normalize(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase()
}

export function resolveEnrichmentOutcome(
  readiness: IngestReadiness | null | undefined,
): EnrichmentOutcome {
  if (!readiness) return { status: 'success' }

  const status = normalize(readiness.status)
  const parseStatus = normalize(readiness.parse_status)
  const annotationStatus = normalize(readiness.annotation_status)
  const explicitDetail = (
    readiness.degraded_reason
    || readiness.error
    || readiness.warning
    || readiness.readiness?.degraded_reasons?.join('; ')
    || ''
  ).trim()

  const degraded = (
    readiness.success === false
    || status === 'failed'
    || DEGRADED_STATUSES.has(status)
    || DEGRADED_STATUSES.has(parseStatus)
    || DEGRADED_ANNOTATION_STATUSES.has(annotationStatus)
    || readiness.readiness?.partial === true
    || readiness.readiness?.fully_ready === false
    || readiness.readiness?.semantic_query_verified === false
    // Some current Researcher paths expose a usable-but-limited result as
    // status=ready plus an error/degradation reason.
    || (status === 'ready' && Boolean(explicitDetail))
  )

  if (!degraded) return { status: 'success' }

  const detail = explicitDetail || (
    annotationStatus
      ? `Source enrichment completed with ${annotationStatus.replace(/_/g, ' ')}.`
      : 'Some source enrichment could not be completed.'
  )
  return { status: 'degraded', detail }
}

export function getUploadStatusPresentation(
  status: UploadLifecycleStatus,
  fileName: string,
  detail?: string,
): UploadStatusPresentation {
  switch (status) {
    case 'uploading':
      return {
        label: 'Uploading…',
        ariaLabel: `${fileName}: uploading`,
        blocksSend: true,
        showActivity: true,
        showProgress: true,
      }
    case 'stored':
      return {
        label: 'Stored',
        ariaLabel: `${fileName}: stored and attached`,
        blocksSend: false,
        showActivity: false,
        showProgress: false,
      }
    case 'processing':
      return {
        label: 'Enriching in background',
        ariaLabel: `${fileName}: stored and enriching sources in the background`,
        blocksSend: false,
        showActivity: false,
        showProgress: false,
      }
    case 'success':
      return {
        label: 'Searchable',
        ariaLabel: `${fileName}: stored, enriched, and searchable`,
        blocksSend: false,
        showActivity: false,
        showProgress: false,
      }
    case 'degraded':
      return {
        label: 'Stored — partial / needs attention',
        ariaLabel: `${fileName}: stored; source enrichment is partial and may need attention${detail ? `. ${detail}` : ''}`,
        blocksSend: false,
        showActivity: false,
        showProgress: false,
      }
    case 'error':
      return {
        label: 'Upload failed',
        ariaLabel: `${fileName}: upload failed${detail ? `. ${detail}` : ''}`,
        blocksSend: true,
        showActivity: false,
        showProgress: false,
      }
  }
}
