/**
 * Citation tiering — a confidentiality rule, not a styling preference.
 *
 * What the system may GROUND ON and what it may NAME TO A VIEWER are different
 * questions. Researcher returns the full, tier-blind citation set because the
 * gates (citation validity, numeric containment) must verify against ALL the
 * evidence. Filtering happens here, at the serialization boundary, and nowhere
 * else.
 *
 *   T1  deck slides        -> always named. The audience is looking at the deck
 *                             and can verify the claim against it.
 *   T2  public web         -> named only if the publisher opted in. The URL is
 *                             public, so naming it leaks nothing.
 *   T3  uploads, research  -> NEVER named. No filename, title, page, quote or
 *       and anything KG      count. Grounding only, with a non-naming
 *                             provenance line instead.
 *
 * Why T3 is absolute: naming an internal source leaks the EXISTENCE and TITLE of
 * a private document to an external viewer. On a deck sent to five clients,
 * "from Acme_pricing_v3.pdf, page 7" is a confidentiality incident even when the
 * answer itself was harmless.
 */

export type SourceKind = 'deck' | 'web' | 'document' | 'research'

/** The full, tier-blind citation as Researcher returns it. */
export interface InternalCitation {
  source_kind?: string | null
  source_ref?: string | null
  source_label?: string | null
  slide_number?: number | null
  page_number?: number | null
  source_url?: string | null
  quote?: string | null
  score?: number | null
}

/** What a viewer is allowed to see. Note there is no `source_ref` and no filename. */
export interface PublicCitation {
  kind: 'slide' | 'web'
  label: string
  slideNumber?: number
  href?: string
  quote?: string
}

const T1: SourceKind[] = ['deck']
const T2: SourceKind[] = ['web']

/**
 * Split a full citation set into what may be shown and whether a non-naming
 * provenance line is required.
 *
 * `citeWebSources` is the publisher's per-deck choice for T2 only. T1 is always
 * shown and T3 is never shown — neither is configurable, because one is
 * verifiable by the viewer and the other is a leak.
 */
export function citationsForViewer(
  citations: InternalCitation[] | null | undefined,
  options: { slug: string; citeWebSources: boolean; ownerName: string }
): { citations: PublicCitation[]; provenanceLine: string | null } {
  const all = Array.isArray(citations) ? citations : []
  const publicCitations: PublicCitation[] = []
  let usedPrivateSource = false

  for (const citation of all) {
    const kind = (citation.source_kind || '') as SourceKind

    if (T1.includes(kind)) {
      const slideNumber =
        typeof citation.slide_number === 'number' ? citation.slide_number : undefined
      publicCitations.push({
        kind: 'slide',
        label: citation.source_label || (slideNumber ? `Slide ${slideNumber}` : 'This deck'),
        slideNumber,
        // The viewer iframe supports #/N deep links, 0-based.
        href: slideNumber ? `/p/${options.slug}#/${slideNumber - 1}` : undefined,
        // A quote is only safe to echo when the viewer can already read the source.
        quote: citation.quote || undefined,
      })
      continue
    }

    if (T2.includes(kind)) {
      if (!options.citeWebSources) {
        // Opted out: it still grounded the answer, so it still earns a
        // provenance line — it just is not named.
        usedPrivateSource = true
        continue
      }
      publicCitations.push({
        kind: 'web',
        label: citation.source_label || citation.source_url || 'Web source',
        href: citation.source_url || undefined,
        // Deliberately no quote: a quote from a page the viewer has not opened
        // adds nothing they cannot get from the link, and keeps the payload lean.
      })
      continue
    }

    // T3 — document | research | anything unrecognised. Unrecognised kinds fall
    // here ON PURPOSE: a new source type must default to private, never leak by
    // virtue of not being in a list.
    usedPrivateSource = true
  }

  return {
    citations: publicCitations,
    provenanceLine: usedPrivateSource
      ? `From ${options.ownerName}'s background material.`
      : null,
  }
}

/**
 * Marker kind for a source that grounded an answer but may never be named.
 *
 * Unrecognised by `citationsForViewer` ON PURPOSE, so it lands in T3 and earns
 * a provenance line without carrying anything to leak.
 */
export const REDACTED_SOURCE_KIND = 'redacted'

/**
 * The form a citation takes when it is STORED on a public row (an FAQ entry).
 *
 * Storing the viewer projection here would be a type-confusion trap: the read
 * path filters again, and a `PublicCitation` has no `source_kind`, so every
 * citation would fall into T3 — silently dropping the citations AND fabricating
 * a "used private material" line on answers grounded purely in deck slides.
 * That is a false confidentiality signal, which is worse than no signal.
 *
 * So the stored form stays INTERNAL-shaped, and confidentiality is preserved by
 * redaction rather than by projection: T1 and T2 keep their data, T3 collapses
 * to a bare marker. Re-filtering on read is then correct AND idempotent, and no
 * private filename is ever written to a row that gets served publicly.
 */
export function redactCitationsForStorage(
  citations: InternalCitation[] | null | undefined
): InternalCitation[] {
  const all = Array.isArray(citations) ? citations : []
  return all.map((citation) => {
    const kind = (citation.source_kind || '') as SourceKind

    if (T1.includes(kind)) {
      return {
        source_kind: kind,
        source_label: citation.source_label ?? null,
        slide_number: citation.slide_number ?? null,
        quote: citation.quote ?? null,
      }
    }
    if (T2.includes(kind)) {
      // Kept whole: the publisher may flip `citeWebSources` later, and the read
      // filter honours that. Redacting here would make the choice one-way.
      return {
        source_kind: kind,
        source_label: citation.source_label ?? null,
        source_url: citation.source_url ?? null,
      }
    }
    // T3 — everything else. No label, no ref, no page, no quote, no URL.
    return { source_kind: REDACTED_SOURCE_KIND }
  })
}

/**
 * Fixed viewer-facing description of the corpus.
 *
 * Never mentions document counts, kinds or names. A count is itself a leak — it
 * tells an external reader how much private material exists. The owner-facing
 * string in the publish dialog may be specific; this one may not.
 */
export const VIEWER_CORPUS_DESCRIPTION =
  'Answers come from this deck and the publisher’s research.'
