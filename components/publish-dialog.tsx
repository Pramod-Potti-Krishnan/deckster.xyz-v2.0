"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Check,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  RefreshCw,
  Share2,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import type { SerializedPublishedDeck } from '@/lib/publish/serialize'

type PublishVisibility = 'public' | 'unlisted' | 'restricted'

/** Which single setting is mid-flight; also what `busy` is derived from */
type SettingsField = 'visibility' | 'allowPdf' | 'allowPptx' | 'passcode'

const VISIBILITY_LABELS: Record<PublishVisibility, { label: string; hint: string }> = {
  unlisted: { label: 'Unlisted', hint: 'Anyone with the link can view' },
  public: { label: 'Public', hint: 'Anyone can view; search engines may index it' },
  restricted: { label: 'Restricted', hint: 'Viewers must enter a passcode' },
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export interface PublishControlsProps {
  /** ChatSession id — the publish record key */
  sessionId: string | null
  deckTitle: string | null
  slideCount: number | null
  /** True once a final deck exists (the API 409s without one) */
  hasFinalDeck: boolean
  className?: string
}

/**
 * PublishControls — "Publish" toolbar button + Share dialog. Sits next to
 * the download controls in the viewer toolbar (composed the same way in
 * components/builder/presentation-area.tsx).
 */
export function PublishControls({
  sessionId,
  deckTitle,
  slideCount,
  hasFinalDeck,
  className = '',
}: PublishControlsProps) {
  const [open, setOpen] = useState(false)
  const [publishedSlideCount, setPublishedSlideCount] = useState<number | null>(null)
  const enabled = Boolean(sessionId) && hasFinalDeck

  // Toolbar staleness dot. Publishing freezes a snapshot, so a deck edited after
  // publishing keeps serving the old copy until the owner republishes — the whole
  // point is that they shouldn't have to open the dialog to find that out.
  // Deliberately the PLAIN by-session read (no checkStale): the slide count we
  // compare against is already a prop, so this costs one small DB read and never
  // pulls the multi-MB deck JSON off the Layout Service. It only sees the
  // slide-count kind of change; the dialog does the exact updated_at comparison.
  // Re-runs when the dialog closes, since a publish/republish/unpublish in there
  // changes the answer.
  useEffect(() => {
    if (!sessionId || !enabled || open) return
    let cancelled = false
    fetch(`/api/publish/by-session/${sessionId}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled) return
        const deck = data?.deck as SerializedPublishedDeck | null | undefined
        setPublishedSlideCount(deck && !deck.revokedAt ? deck.slideCount : null)
      })
      .catch(() => {
        if (!cancelled) setPublishedSlideCount(null)
      })
    return () => {
      cancelled = true
    }
  }, [sessionId, enabled, open])

  const slideCountDrifted =
    publishedSlideCount !== null &&
    typeof slideCount === 'number' &&
    slideCount > 0 &&
    publishedSlideCount !== slideCount

  return (
    <div className={`flex items-center ${className}`}>
      <button
        onClick={() => setOpen(true)}
        disabled={!enabled}
        className="relative flex h-12 min-w-[72px] flex-col items-center justify-center gap-0.5 rounded-md px-3 py-1 text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-700 dark:disabled:hover:text-slate-200"
        title={
          !enabled
            ? 'Publishing unlocks once the final deck is built'
            : slideCountDrifted
              ? `Published ${plural(publishedSlideCount!, 'slide')} · this deck now has ${slideCount} — republish to update the link`
              : 'Publish this deck to a shareable link'
        }
      >
        <Globe className="h-5 w-5" />
        {slideCountDrifted && (
          <span
            aria-hidden
            className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900"
          />
        )}
        <span className="text-[10px] font-medium">Publish</span>
      </button>
      {sessionId && (
        <PublishDialog
          open={open}
          onOpenChange={setOpen}
          sessionId={sessionId}
          deckTitle={deckTitle}
          slideCount={slideCount}
        />
      )}
    </div>
  )
}

interface PublishDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
  deckTitle: string | null
  slideCount: number | null
}

export function PublishDialog({
  open,
  onOpenChange,
  sessionId,
  deckTitle,
  slideCount,
}: PublishDialogProps) {
  const { toast } = useToast()
  const { copied, copy } = useCopyToClipboard()

  const [isLoading, setIsLoading] = useState(false)
  const [record, setRecord] = useState<SerializedPublishedDeck | null>(null)
  /** Exact (updated_at-based) verdict from the server, not a clock heuristic */
  const [isStale, setIsStale] = useState(false)
  const [currentSlideCount, setCurrentSlideCount] = useState<number | null>(null)

  // Settings form (drives both first publish and later PATCHes)
  const [visibility, setVisibility] = useState<PublishVisibility>('unlisted')
  const [passcode, setPasscode] = useState('')
  const [allowPdf, setAllowPdf] = useState(true)
  const [allowPptx, setAllowPptx] = useState(true)

  const [isPublishing, setIsPublishing] = useState(false)
  const [savingField, setSavingField] = useState<SettingsField | null>(null)
  const [isRotating, setIsRotating] = useState(false)
  const [isUnpublishing, setIsUnpublishing] = useState(false)
  const [confirmUnpublish, setConfirmUnpublish] = useState(false)

  const isLive = Boolean(record && !record.revokedAt)
  const busy = isPublishing || savingField !== null || isRotating || isUnpublishing

  const syncFormFromRecord = useCallback((deck: SerializedPublishedDeck | null) => {
    if (!deck) return
    setVisibility((deck.visibility as PublishVisibility) || 'unlisted')
    setAllowPdf(deck.allowPdf)
    setAllowPptx(deck.allowPptx)
    setPasscode('')
  }, [])

  // Load the current publish state whenever the dialog opens. checkStale=1 makes
  // the server also compare the live deck's updated_at against the one recorded
  // at publish time — opt-in because it costs a full deck GET, which is why the
  // toolbar's cheap poll above doesn't ask for it.
  useEffect(() => {
    if (!open) {
      setConfirmUnpublish(false)
      return
    }
    let cancelled = false
    setIsLoading(true)
    fetch(`/api/publish/by-session/${sessionId}?checkStale=1`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Failed to load publish state')
        const data = await response.json()
        if (cancelled) return
        setRecord(data.deck ?? null)
        setIsStale(Boolean(data.isStale))
        setCurrentSlideCount(
          typeof data.currentSlideCount === 'number' ? data.currentSlideCount : null
        )
        syncFormFromRecord(data.deck ?? null)
      })
      .catch(() => {
        if (cancelled) return
        setRecord(null)
        setIsStale(false)
        setCurrentSlideCount(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, sessionId, syncFormFromRecord])

  // A revoked record keeps its passcode hash, so republishing a restricted
  // deck doesn't require re-entering one
  const needsPasscode =
    visibility === 'restricted' && !passcode && !record?.hasPasscode

  // 'restricted' selected but not yet persisted — held locally until a passcode
  // is supplied, because the server (correctly) 400s restricted-without-passcode.
  // Narrow by design: with auto-save this is the ONLY way the select can differ
  // from the record, so an in-flight ordinary visibility PATCH never trips it.
  const pendingRestricted =
    isLive &&
    visibility === 'restricted' &&
    record!.visibility !== 'restricted' &&
    !record!.hasPasscode
  const pendingPasscode = isLive && visibility === 'restricted' && passcode.length > 0
  const hasUnsavedSettings = pendingRestricted || pendingPasscode

  /**
   * Fold a PATCH response back into local state, mirroring ONLY the fields the
   * request actually sent. A blanket re-sync would clobber the two things the
   * owner may legitimately be holding un-applied: typed-but-not-yet-submitted
   * passcode text, and a 'restricted' selection that is deliberately not
   * persisted until that passcode lands.
   */
  const applySavedRecord = useCallback(
    (deck: SerializedPublishedDeck, sent: Record<string, unknown>) => {
      setRecord(deck)
      if (sent.visibility !== undefined) setVisibility(deck.visibility as PublishVisibility)
      if (sent.allowPdf !== undefined) setAllowPdf(deck.allowPdf)
      if (sent.allowPptx !== undefined) setAllowPptx(deck.allowPptx)
      if (sent.passcode !== undefined) setPasscode('')
    },
    []
  )

  /**
   * Auto-save one setting. There is no "Save settings" button any more: discrete
   * toggles and selects commit on change (no debounce — they can't fire per
   * keystroke), and on failure `revert` puts the control back where it was so the
   * UI never claims a change the server rejected.
   */
  const patchSettings = useCallback(
    async (field: SettingsField, body: Record<string, unknown>, revert: () => void) => {
      if (!record) return
      setSavingField(field)
      try {
        const response = await fetch(`/api/publish/${record.slug}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(data.error || 'Failed to save setting')
        }
        applySavedRecord(data.deck, body)
      } catch (error) {
        revert()
        toast({
          title: 'Change not saved',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        })
      } finally {
        setSavingField(null)
      }
    },
    [record, applySavedRecord, toast]
  )

  const handleToggleDownload = useCallback(
    (format: 'pdf' | 'pptx', next: boolean) => {
      const previous = format === 'pdf' ? allowPdf : allowPptx
      const setter = format === 'pdf' ? setAllowPdf : setAllowPptx
      setter(next) // optimistic — reverted by patchSettings if the PATCH fails
      void patchSettings(
        format === 'pdf' ? 'allowPdf' : 'allowPptx',
        format === 'pdf' ? { allowPdf: next } : { allowPptx: next },
        () => setter(previous)
      )
    },
    [allowPdf, allowPptx, patchSettings]
  )

  const handleVisibilityChange = useCallback(
    (next: PublishVisibility) => {
      if (next === visibility) return
      const previous = visibility
      setVisibility(next)
      if (!isLive) return // not published yet: the form is submitted by Publish

      // Switching to 'restricted' while the record has no passcode would be a
      // GUARANTEED 400 (server rule: restricted requires a passcode). Hold the
      // selection locally instead, reveal the passcode field, and send
      // visibility + passcode together when the owner applies it.
      if (next === 'restricted' && !record?.hasPasscode) return

      // Leaving restricted abandons any passcode typed for it; drop the text so a
      // field the owner can no longer see can't block Republish later. The revert
      // restores it along with the selection, so a failed PATCH loses nothing.
      const previousPasscode = passcode
      if (previous === 'restricted' && next !== 'restricted') setPasscode('')

      void patchSettings('visibility', { visibility: next }, () => {
        setVisibility(previous)
        setPasscode(previousPasscode)
      })
    },
    [visibility, passcode, isLive, record, patchSettings]
  )

  const handlePasscodeSubmit = useCallback(() => {
    if (!passcode) return
    const body: Record<string, unknown> = { passcode }
    // A held-but-unsaved 'restricted' selection rides along in the SAME request,
    // so the server sees visibility + passcode together and its
    // restricted-requires-a-passcode rule is satisfied by one atomic PATCH.
    if (pendingRestricted) body.visibility = visibility
    // Nothing to revert: keep the typed text on failure so it can be retried.
    void patchSettings('passcode', body, () => {})
  }, [passcode, pendingRestricted, visibility, patchSettings])

  const handlePublish = useCallback(async (republish: boolean) => {
    setIsPublishing(true)
    try {
      const body: Record<string, unknown> = { sessionId }
      if (!republish) {
        // First publish (or re-publish after unpublish): send the whole form
        body.visibility = visibility
        body.allowPdf = allowPdf
        body.allowPptx = allowPptx
        if (passcode) body.passcode = passcode
      }
      const response = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Failed to publish')
      }
      setRecord(data.deck)
      syncFormFromRecord(data.deck)
      // The snapshot was just re-taken from the live deck, so the staleness
      // baseline the server stored is current by construction.
      setIsStale(false)
      setCurrentSlideCount(data.deck?.slideCount ?? null)
      toast({
        title: republish ? 'Deck republished' : 'Deck published',
        description: republish
          ? 'The shared link now shows the latest version of your deck.'
          : 'Your deck is live. Share the link with your audience.',
      })
    } catch (error) {
      toast({
        title: republish ? 'Republish failed' : 'Publish failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setIsPublishing(false)
    }
  }, [sessionId, visibility, allowPdf, allowPptx, passcode, syncFormFromRecord, toast])

  /**
   * Republish re-snapshots the SLIDES only — it deliberately sends no settings.
   * So rather than let a pending settings edit be silently swallowed (and then
   * wiped by the re-sync from the response), block and say so. Settings now
   * auto-save, so the only way to be here is a passcode typed but not applied
   * (optionally with the restricted switch waiting on it).
   */
  const handleRepublishClick = useCallback(() => {
    if (hasUnsavedSettings) {
      toast({
        title: 'Apply your passcode first',
        description:
          'Republish only re-snapshots the slides. Press “Update passcode” to save the passcode' +
          (pendingRestricted ? ' and the restricted switch' : '') +
          ', then republish.',
        variant: 'destructive',
      })
      return
    }
    void handlePublish(true)
  }, [hasUnsavedSettings, pendingRestricted, handlePublish, toast])

  const handleRotate = useCallback(async () => {
    if (!record) return
    setIsRotating(true)
    try {
      const response = await fetch(`/api/publish/${record.slug}/rotate`, { method: 'POST' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Failed to rotate link')
      }
      setRecord(data.deck)
      // Rotate re-snapshots too, so it re-baselines staleness server-side.
      setIsStale(false)
      setCurrentSlideCount(data.deck?.slideCount ?? null)
      toast({
        title: 'Link rotated',
        description: data.snapshotDeleted
          ? 'The old link no longer works and the previous copy has been removed. Share the new one.'
          : 'The old link is disabled and the new one is live. The previous copy is still being cleaned up.',
      })
    } catch (error) {
      toast({
        title: 'Failed to rotate link',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setIsRotating(false)
    }
  }, [record, toast])

  const handleUnpublish = useCallback(async () => {
    if (!record) return
    setIsUnpublishing(true)
    try {
      const response = await fetch(`/api/publish/${record.slug}`, { method: 'DELETE' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Failed to unpublish')
      }
      setRecord(data.deck)
      setIsStale(false)
      setConfirmUnpublish(false)
      toast({
        title: 'Deck unpublished',
        description: data.snapshotDeleted
          ? 'The link no longer works and the copy has been removed. You can publish again anytime.'
          : 'The share link is disabled. The published copy is still being cleaned up — you can publish again anytime.',
      })
    } catch (error) {
      toast({
        title: 'Failed to unpublish',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setIsUnpublishing(false)
    }
  }, [record, toast])

  const handleCopy = useCallback(async () => {
    if (!record) return
    const ok = await copy(record.publicUrl)
    if (!ok) {
      toast({
        title: 'Copy failed',
        description: 'Could not access the clipboard. Copy the link manually.',
        variant: 'destructive',
      })
    }
  }, [record, copy, toast])

  const formatDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : null

  /** Concrete delta for the staleness banner, when we can compute one */
  const slideDelta = useMemo(() => {
    if (!record || currentSlideCount === null || currentSlideCount === record.slideCount) {
      return null
    }
    return `Published ${plural(record.slideCount, 'slide')} · deck now has ${currentSlideCount}`
  }, [record, currentSlideCount])

  const visibilitySelect = (
    <div className="space-y-1.5">
      <Label htmlFor="publish-visibility">Who can view</Label>
      <Select
        value={visibility}
        onValueChange={(value) => handleVisibilityChange(value as PublishVisibility)}
        disabled={busy}
      >
        <SelectTrigger id="publish-visibility">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(VISIBILITY_LABELS) as PublishVisibility[]).map((value) => (
            <SelectItem key={value} value={value}>
              {VISIBILITY_LABELS[value].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{VISIBILITY_LABELS[visibility].hint}</p>
    </div>
  )

  // Pre-publish form: nothing is persisted until the Publish button, so the
  // controls stay plain (no auto-save, no per-field buttons).
  const settingsForm = (
    <div className="space-y-4">
      {visibilitySelect}

      {visibility === 'restricted' && (
        <div className="space-y-1.5">
          <Label htmlFor="publish-passcode">Passcode</Label>
          <Input
            id="publish-passcode"
            type="text"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Choose a passcode for viewers"
            disabled={busy}
            autoComplete="off"
          />
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="publish-allow-pdf" className="font-normal">
            Allow PDF download
          </Label>
          <Switch
            id="publish-allow-pdf"
            checked={allowPdf}
            onCheckedChange={setAllowPdf}
            disabled={busy}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="publish-allow-pptx" className="font-normal">
            Allow PPTX download
          </Label>
          <Switch
            id="publish-allow-pptx"
            checked={allowPptx}
            onCheckedChange={setAllowPptx}
            disabled={busy}
          />
        </div>
      </div>
    </div>
  )

  // Live form: every control writes through on change, so there is no
  // "Save settings" button to forget to press (and nothing to silently discard).
  const liveSettingsForm = (
    <div className="space-y-4">
      {visibilitySelect}

      {visibility === 'restricted' && (
        <div className="space-y-1.5">
          <Label htmlFor="publish-passcode">Passcode</Label>
          <div className="flex items-center gap-2">
            <Input
              id="publish-passcode"
              type="text"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder={
                record?.hasPasscode ? 'Unchanged — type to replace' : 'Choose a passcode for viewers'
              }
              disabled={busy}
              autoComplete="off"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePasscodeSubmit}
              disabled={busy || !passcode}
              className="flex-shrink-0"
            >
              {savingField === 'passcode' ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              Update passcode
            </Button>
          </div>
          {pendingRestricted && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Restricted takes effect once you set a passcode — the deck is still{' '}
              {VISIBILITY_LABELS[record!.visibility as PublishVisibility]?.label.toLowerCase() ??
                record!.visibility}
              .
            </p>
          )}
          {!pendingRestricted && pendingPasscode && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Unsaved passcode — press “Update passcode” to apply it.
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="publish-allow-pdf" className="font-normal">
            Allow PDF download
          </Label>
          <Switch
            id="publish-allow-pdf"
            checked={allowPdf}
            onCheckedChange={(next) => handleToggleDownload('pdf', next)}
            disabled={busy}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="publish-allow-pptx" className="font-normal">
            Allow PPTX download
          </Label>
          <Switch
            id="publish-allow-pptx"
            checked={allowPptx}
            onCheckedChange={(next) => handleToggleDownload('pptx', next)}
            disabled={busy}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Sharing settings save as you change them.</p>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            {isLive ? 'Deck published' : 'Publish deck'}
          </DialogTitle>
          <DialogDescription>
            {isLive
              ? 'Anyone with access can view a frozen copy of this deck.'
              : `Share a view-only copy of ${deckTitle ? `“${deckTitle}”` : 'this deck'}${
                  slideCount ? ` (${slideCount} slides)` : ''
                } at a Deckster link.`}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !isLive ? (
          <>
            {settingsForm}
            <DialogFooter>
              <Button
                onClick={() => handlePublish(false)}
                disabled={busy || needsPasscode}
                title={needsPasscode ? 'Set a passcode for restricted visibility' : undefined}
                className="w-full sm:w-auto"
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Publishing…
                  </>
                ) : (
                  'Publish'
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="space-y-5">
            {/* The link */}
            <div className="space-y-1.5">
              <Label>Public link</Label>
              <div className="flex items-center gap-2">
                <Input readOnly value={record!.publicUrl} className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  title="Copy link"
                  className="flex-shrink-0"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  asChild
                  title="Open link"
                  className="flex-shrink-0"
                >
                  <a href={record!.publicUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
                {/* Rotating mints a NEW link, so it belongs beside the link it
                    replaces — not in the footer next to Republish, where the two
                    read as interchangeable. */}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleRotate}
                  disabled={busy}
                  title="Mint a new link — the old one stops working"
                  aria-label="Mint a new link — the old one stops working"
                  className="flex-shrink-0"
                >
                  {isRotating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Published {formatDate(record!.publishedAt)}
                {record!.republishedAt ? ` · updated ${formatDate(record!.republishedAt)}` : ''}
                {record!.viewCount > 0 ? ` · ${record!.viewCount} view${record!.viewCount === 1 ? '' : 's'}` : ''}
              </p>
            </div>

            {liveSettingsForm}

            {isStale && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/50 dark:text-amber-200">
                <p className="font-medium">
                  This deck has changed since you published it — republish to update the link.
                </p>
                {slideDelta && <p className="mt-0.5 opacity-90">{slideDelta}</p>}
              </div>
            )}

            <DialogFooter className="sm:justify-between">
              {confirmUnpublish ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleUnpublish}
                  disabled={busy}
                >
                  {isUnpublishing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  Confirm unpublish
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmUnpublish(true)}
                  disabled={busy}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950"
                >
                  Unpublish
                </Button>
              )}
              {/* Primary when the published copy is out of date; still clickable
                  (a forced re-snapshot) when it isn't. */}
              <Button
                type="button"
                variant={isStale ? 'default' : 'outline'}
                size="sm"
                onClick={handleRepublishClick}
                disabled={busy}
                title={
                  isStale
                    ? 'Snapshot the latest version of the deck onto the same link'
                    : 'Re-snapshot the deck onto the same link'
                }
              >
                {isPublishing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Republish
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
