"use client"

import { useRef, useState, type SyntheticEvent } from 'react'
import { ImageIcon } from 'lucide-react'
import { resolveStudioPublishPreview, type StudioPublishPreviewSource } from '@/lib/studio-publish-preview'

interface Props {
  sessionId: string
  source?: StudioPublishPreviewSource | null
}

/** A supplied current Final thumbnail, never proof of the published snapshot. */
export function StudioPublishPreview({ sessionId, source }: Props) {
  const preview = resolveStudioPublishPreview(sessionId, source)
  return (
    <figure className="studio-publish-deck-preview" aria-label="Current deck preview">
      <div className="studio-publish-preview-bar">Current deck preview</div>
      {preview.status === 'ready' ? (
        <OwnedPreviewImage key={preview.ownerKey} ownerKey={preview.ownerKey} thumbnailUrl={preview.thumbnailUrl} />
      ) : (
        <PreviewFallback loading={preview.status === 'loading'} />
      )}
      <figcaption>First slide · Final deck.{preview.status === 'ready' && ' Preview image can lag recent edits.'}</figcaption>
    </figure>
  )
}

function PreviewFallback({ loading, failed = false }: { loading: boolean; failed?: boolean }) {
  return (
    <div className="studio-publish-preview-fallback" role="status" aria-busy={loading}>
      <ImageIcon size={22} aria-hidden="true" />
      <strong>{loading ? 'Loading deck preview…' : 'Deck preview unavailable'}</strong>
      <span>{loading ? 'Waiting for the existing slide image.' : failed ? 'The slide image could not be loaded.' : 'No image is available for this deck.'}</span>
    </div>
  )
}

function OwnedPreviewImage({ ownerKey, thumbnailUrl }: { ownerKey: string; thumbnailUrl: string }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const imageRef = useRef<HTMLImageElement>(null)
  const ownsEvent = (event: SyntheticEvent<HTMLImageElement>) =>
    imageRef.current === event.currentTarget &&
    event.currentTarget.getAttribute('data-studio-preview-owner') === ownerKey &&
    event.currentTarget.getAttribute('src') === thumbnailUrl
  return (
    <div className="studio-publish-preview-image" data-preview-status={status} aria-busy={status === 'loading'}>
      {status !== 'error' && (
        // Use only the already-returned image URL. No iframe, optimizer,
        // thumbnail request or generation is introduced by this preview.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imageRef}
          src={thumbnailUrl}
          alt="First slide of the current Final deck"
          data-studio-preview-owner={ownerKey}
          onLoad={(event) => { if (ownsEvent(event)) setStatus('ready') }}
          onError={(event) => { if (ownsEvent(event)) setStatus('error') }}
        />
      )}
      {status !== 'ready' && <PreviewFallback loading={status === 'loading'} failed={status === 'error'} />}
    </div>
  )
}
