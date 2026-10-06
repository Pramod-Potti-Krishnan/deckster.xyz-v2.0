import type { SerializedPublishedDeck } from '@/lib/publish/serialize'

interface Props {
  record: SerializedPublishedDeck | null
  sessionId: string
  isLoading: boolean
  loadError: boolean
  staleness: 'checking' | 'unknown' | 'current' | 'stale'
}

const confirmedText = (value: unknown) => typeof value === 'string' && value.trim().length > 0
const savedPermission = (value: unknown) => value === true ? 'Allowed' : value === false ? 'Not allowed' : 'Not confirmed'
const savedMinutes = (value: unknown, minimum: number) => value === null ? 'Not set' : typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= 480 ? `${value} min` : 'Not confirmed'

/** Saved settings only: no source-deck preview, draft, playback or service read. */
export function StudioPublishViewerSummary({ record, sessionId, isLoading, loadError, staleness }: Props) {
  if (isLoading) {
    return <p className="studio-publish-viewer-status" role="status">Loading saved publish settings…</p>
  }
  if (!record || record.sessionId !== sessionId || !confirmedText(record.slug)
    || !confirmedText(record.snapshotPresentationId) || record.revokedAt !== null) {
    return (
      <div className="studio-publish-viewer-status" role="status">
        <strong>Published copy not confirmed</strong>
        <p>A current saved copy is needed to show its viewer settings.</p>
      </div>
    )
  }

  const title = confirmedText(record.title) ? record.title : 'Published title not confirmed'
  const count = typeof record.slideCount === 'number' && Number.isSafeInteger(record.slideCount) && record.slideCount >= 0
    ? `${record.slideCount} ${record.slideCount === 1 ? 'slide' : 'slides'}` : 'Slide count not confirmed'
  const access = record.visibility === 'public' ? 'Public'
    : record.visibility === 'unlisted' ? 'Unlisted'
    : record.visibility === 'restricted' ? 'Restricted' : 'Not confirmed'
  const passcode = record.hasPasscode === true ? 'Set in saved settings'
    : record.hasPasscode === false ? 'Not set' : 'Not confirmed'
  const questions = record.qaEnabled === true ? 'On in saved settings'
    : record.qaEnabled === false ? 'Off in saved settings' : 'Not confirmed'
  const answers = record.qaAutoAnswer === true ? 'Automatic answers configured'
    : record.qaAutoAnswer === false ? 'Manual answers configured' : 'Answer policy not confirmed'
  const narration = record.narrationEnabled === true ? 'On in saved settings'
    : record.narrationEnabled === false ? 'Off in saved settings' : 'Not confirmed'
  const freshness = loadError ? 'Publish status could not be refreshed. These are the last loaded saved settings.'
    : staleness === 'checking' ? 'Checking whether the published slides match the source…'
    : staleness === 'current' ? 'Published slides match the source at the last check.'
    : staleness === 'stale' ? 'The source deck has changed since this copy was published.'
    : 'Whether the published slides match the source is not confirmed.'

  return (
    <section className="studio-publish-viewer-page" aria-label="Published viewer page summary">
      <div className="studio-publish-viewer-heading">
        <h3>{loadError ? 'Last loaded viewer settings' : 'Saved viewer settings'}</h3>
        <p>For the published copy. Unsaved changes in other tabs are not included.</p>
      </div>
      <p className="studio-publish-viewer-status" role="status">{freshness}</p>
      <div className="studio-publish-viewer-grid">
        <aside className="studio-publish-viewer-preview" aria-label="Published copy preview unavailable">
          <span className="studio-publish-viewer-eyebrow">Published copy</span>
          <strong>{title}</strong>
          <span>{count}</span>
          <div className="studio-publish-viewer-unavailable">
            <strong>Preview unavailable</strong>
            <p>A preview of the frozen published slides is not available here.</p>
          </div>
        </aside>
        <dl className="studio-publish-viewer-facts">
          <div><dt>Who can view</dt><dd>{access}</dd></div>
          <div><dt>Passcode</dt><dd>{passcode}</dd></div>
          <div><dt>PDF download</dt><dd>{savedPermission(record.allowPdf)}</dd></div>
          <div><dt>PowerPoint download</dt><dd>{savedPermission(record.allowPptx)}</dd></div>
          <div><dt>Questions</dt><dd>{questions}<small>{answers}</small></dd></div>
          <div><dt>Narration</dt><dd>{narration}<small>Playback and recordings are not confirmed here.</small></dd></div>
          <div><dt>Session budget</dt><dd>{savedMinutes(record.narrationBudgetMinutes, 1)}<small>Saved total time budget</small></dd></div>
          <div><dt>Question reserve</dt><dd>{savedMinutes(record.qaReserveMinutes, 0)}</dd></div>
        </dl>
      </div>
      <p className="studio-publish-viewer-note">This summary shows saved configuration, not a check of download access, question readiness or playable narration. Spoken presenter interaction is unavailable here.</p>
    </section>
  )
}
