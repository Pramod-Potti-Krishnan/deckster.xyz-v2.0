/**
 * P4-15 piece B (Studio, DARK): the "from Google Drive" badge on a slide's source citations.
 * Flag NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED (exact "true", default off). Client-safe: no node: imports.
 *
 * Where the data comes from. Director's slide_context frame carries each slide's Researcher content blob, whose
 * `source_citations[]` entries may hold `source_origin` = {source_type, source_ref, title, source_url, source_modified_at}:
 *   - Researcher stamps it on bound upload citations whose file came from a connector (slide_detail_service_v2.py:466,
 *     origin built by services/connectors/provenance.py `origin_from_job`; source_type is PROVIDER_GDRIVE = "gdrive").
 *   - Director keeps it only behind DIRECTOR_CITATION_SOURCE_ORIGIN_ENABLED and signed WebSocket admission
 *     (src/utils/citation_source_origin.py, src/models/researcher_v2_models.py `SourceCitation.source_origin`), and its
 *     display-link policy leaves source_url as an https URL without query or fragment.
 * A Drive citation is one whose source_origin.source_type is "gdrive". Anything else (no source_origin, another type, the
 * flag off, a malformed blob) yields no rows, so the caller draws exactly what it drew before.
 */
import { isGdriveConnectorEnabled } from '@/lib/connectors-gdrive-flag'

export type CitationSourceKind = 'drive' | 'web' | 'upload'

export interface CitationSourceRow {
  key: string
  kind: CitationSourceKind
  /** What the reader sees as the source's name: the Drive title, the page label or the uploaded file name. */
  name: string
  /** Web only: the page's host. */
  host?: string
  /** Drive: the file's webViewLink (Google hosts only). Web: the page (http/https only). Never set for uploads. */
  href?: string
}

// Wording pending PK decision OD-2 ("from Google Drive" is the mock's proposal; the alternatives are "Drive" / "Your Drive").
export const DRIVE_BADGE_LABEL = 'from Google Drive'
export const DRIVE_LINK_LABEL = 'Open in Drive'

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')
const lower = (value: unknown): string => text(value).toLowerCase()

function parseHttpUrl(value: unknown): URL | null {
  const raw = text(value)
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (url.username || url.password) return null
    return url
  } catch {
    return null
  }
}

/** A Drive webViewLink: https on a Google host (drive.google.com, docs.google.com, ...). Anything else is shown without a link. */
export function driveFileHref(value: unknown): string | undefined {
  const url = parseHttpUrl(value)
  if (!url || url.protocol !== 'https:') return undefined
  const host = url.hostname.toLowerCase()
  return host === 'google.com' || host.endsWith('.google.com') ? url.href : undefined
}

function webHref(value: unknown): { href: string; host: string } | null {
  const url = parseHttpUrl(value)
  return url ? { href: url.href, host: url.hostname.replace(/^www\./, '') } : null
}

/**
 * The source rows of one slide's content blob, only when the flag is on and at least one citation is a Drive file:
 * [] otherwise. The Drive rows come with the slide's web and uploaded sources so the three badges read together;
 * citations whose origin is unknown (model knowledge, graph, research, no kind) are left out. Deduped per source.
 */
export function citationSourceRows(content: unknown, enabled: boolean = isGdriveConnectorEnabled()): CitationSourceRow[] {
  if (!enabled) return []
  const citations = record(content)?.source_citations
  if (!Array.isArray(citations)) return []
  const rows: CitationSourceRow[] = []
  const seen = new Set<string>()
  let drive = 0
  for (const entry of citations) {
    const citation = record(entry)
    if (!citation) continue
    const origin = record(citation.source_origin)
    const sourceKind = lower(citation.source_kind)
    const kind = lower(citation.kind)
    let row: CitationSourceRow | null = null
    if (origin && lower(origin.source_type) === 'gdrive') {
      const name = text(origin.title) || text(citation.document_filename) || text(citation.label) || 'Google Drive file'
      row = { key: `drive:${text(origin.source_ref) || text(origin.source_url) || name}`, kind: 'drive', name, href: driveFileHref(origin.source_url) }
    } else if (sourceKind === 'web' || (!sourceKind && kind === 'external')) {
      const page = webHref(citation.url)
      const name = text(citation.label) || page?.host || ''
      if (name) row = { key: `web:${page?.href || name}`, kind: 'web', name, host: page?.host, href: page?.href }
    } else if (sourceKind === 'upload' || (!sourceKind && kind === 'internal')) {
      const name = text(citation.document_filename) || text(citation.label)
      if (name) row = { key: `upload:${name}`, kind: 'upload', name }
    }
    if (!row || seen.has(row.key)) continue
    seen.add(row.key)
    if (row.kind === 'drive') drive += 1
    rows.push(row)
  }
  return drive > 0 ? rows : []
}
