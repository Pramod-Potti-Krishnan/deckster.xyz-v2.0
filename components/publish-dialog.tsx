"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Check,
  Copy,
  ExternalLink,
  Globe,
  KeyRound,
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

/**
 * Staleness is THREE-valued, plus an in-flight state. 'unknown' is not a
 * synonym for 'current': the record may have no baseline (published before the
 * column existed, or by a publish whose Layout read failed), or the check
 * itself may not have come back. Those must read as "can't verify", never as
 * "up to date" — an owner who is told nothing is wrong will not republish.
 */
type Staleness = 'checking' | 'unknown' | 'current' | 'stale'

/**
 * Client-side ceiling on the staleness check. The server bounds its own Layout
 * reads, but nothing bounded the browser's wait for that response — so a hung
 * request left the verdict on 'checking' forever. Sits above the server's own
 * budget so a slow-but-working check still gets to answer.
 */
const STALENESS_CHECK_TIMEOUT_MS = 8000

const parseStaleness = (value: unknown): Staleness =>
  value === 'stale' || value === 'current' ? value : 'unknown'

/**
 * After a republish/rotate the server re-baselined by construction — but only
 * if it managed to read one. An echoed-back null baseline means the copy is
 * fresh and yet unverifiable from here on, so say 'unknown' rather than claim
 * a verification we can't repeat.
 */
const stalenessAfterResnapshot = (deck: SerializedPublishedDeck | null | undefined): Staleness =>
  deck?.sourceUpdatedAt ? 'current' : 'unknown'

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
        // Says ONLY what this dot actually knows. The dot compares slide COUNTS;
        // the dialog compares the source deck's updated_at, and the two can
        // legitimately disagree (edited slides at an unchanged count; an
        // unverifiable baseline). Asserting "republish to update the link" here
        // would let the toolbar make a claim the dialog then fails to back up.
        title={
          !enabled
            ? 'Publishing unlocks once the final deck is built'
            : slideCountDrifted
              ? `Published ${plural(publishedSlideCount!, 'slide')} · deck now has ${slideCount}`
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
        // Keyed by session so switching decks REMOUNTS the dialog rather than
        // reusing it: its settings form is local state, and a survivor from the
        // previous deck would silently become the next deck's publish payload.
        <PublishDialog
          key={sessionId}
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
  /** Pass-1 (the record read) failed — the publish state on screen is unverified */
  const [loadError, setLoadError] = useState(false)
  /** Bumped by Retry to re-run the load effect */
  const [reloadToken, setReloadToken] = useState(0)
  /** Exact (updated_at-based) verdict from the server, not a clock heuristic */
  const [staleness, setStaleness] = useState<Staleness>('unknown')
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
  const [confirmRotate, setConfirmRotate] = useState(false)

  const isLive = Boolean(record && !record.revokedAt)
  const isStale = staleness === 'stale'
  const busy = isPublishing || savingField !== null || isRotating || isUnpublishing

  /**
   * Mirror the form onto the record — and, for a DEFINITIVE "not published",
   * back onto the defaults. Returning early there left the previous deck's
   * settings sitting in the form, so opening an unpublished deck after a public
   * one offered "Public" pre-selected and published it that way. Only ever
   * called with null for a real `{deck: null}` answer, never for a failed load.
   */
  const syncFormFromRecord = useCallback((deck: SerializedPublishedDeck | null) => {
    if (!deck) {
      setVisibility('unlisted')
      setAllowPdf(true)
      setAllowPptx(true)
      setPasscode('')
      setConfirmUnpublish(false)
      setConfirmRotate(false)
      return
    }
    setVisibility((deck.visibility as PublishVisibility) || 'unlisted')
    setAllowPdf(deck.allowPdf)
    setAllowPptx(deck.allowPptx)
    setPasscode('')
  }, [])

  // Load the current publish state whenever the dialog opens, in TWO decoupled
  // passes — because the two facts have completely different failure costs.
  //
  // Pass 1 is the record: one DB read, zero Layout calls. It decides whether the
  // dialog shows the published state at all (link, copy, open, rotate,
  // unpublish), so it must not depend on the Layout Service being reachable.
  //
  // Pass 2 is the advisory staleness verdict, which DOES cost a multi-MB deck
  // GET. Its failure is contained: staleness falls back to 'unknown' and the
  // record is left untouched. A Layout outage must never make a genuinely
  // published deck render as "Publish deck" — that would strip every control the
  // owner has over a link that is still live and still serving viewers, and
  // offer a full republish as the only way out.
  //
  // A pass-1 FAILURE is not an answer, so it must not be treated as one. It
  // never nulls a record we already hold and never falls through to the publish
  // form: a POST from there carries the whole form, and the server applies it to
  // the record that is still there — turning a restricted deck unlisted (every
  // link-holder in, no passcode) and re-enabling downloads the owner had off.
  // Instead it raises loadError, which keeps the last known state on screen and
  // withholds Publish/Republish until a Retry gets a real answer. Only a
  // definitive `{deck: null}` may clear the record.
  useEffect(() => {
    if (!open) {
      setConfirmUnpublish(false)
      setConfirmRotate(false)
      return
    }
    let cancelled = false
    setIsLoading(true)
    setLoadError(false)
    setStaleness('checking')
    setCurrentSlideCount(null)

    const load = async () => {
      let deck: SerializedPublishedDeck | null = null
      try {
        const response = await fetch(`/api/publish/by-session/${sessionId}`)
        if (!response.ok) throw new Error('Failed to load publish state')
        const data = await response.json()
        deck = (data?.deck ?? null) as SerializedPublishedDeck | null
      } catch {
        if (cancelled) return
        // `record` is deliberately left as-is — see the note above.
        setLoadError(true)
        setStaleness('unknown')
        setIsLoading(false)
        return
      }
      if (cancelled) return
      setRecord(deck)
      syncFormFromRecord(deck)
      setIsLoading(false)

      // Nothing live to compare against (never published, or unpublished): the
      // server skips the Layout read for a revoked record anyway, so don't ask.
      if (!deck || deck.revokedAt) {
        setStaleness('unknown')
        return
      }

      try {
        // Client-side bound as well as the server's. Without it a hung request
        // parks the verdict on 'checking' indefinitely; the timeout aborts into
        // the catch below, which lands on 'unknown' — never on 'current'.
        const response = await fetch(`/api/publish/by-session/${sessionId}?checkStale=1`, {
          signal: AbortSignal.timeout(STALENESS_CHECK_TIMEOUT_MS),
        })
        if (!response.ok) throw new Error('Failed to check staleness')
        const data = await response.json()
        if (cancelled) return
        // Deliberately ignores data.deck: pass 1 already rendered the record, and
        // this response is older than any edit the owner has made since.
        setStaleness(parseStaleness(data?.staleness))
        setCurrentSlideCount(
          typeof data?.currentSlideCount === 'number' ? data.currentSlideCount : null
        )
      } catch {
        // Layout unreachable/slow, or the check errored. The published state
        // stays exactly as pass 1 rendered it; only the verdict is unknown.
        if (!cancelled) setStaleness('unknown')
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [open, sessionId, reloadToken, syncFormFromRecord])

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
  /**
   * Only TYPED passcode text blocks Republish. A held 'restricted' selection
   * with an empty field must not: the button that would resolve it ("Update
   * passcode") is disabled while the field is empty, so blocking there pointed
   * the owner at a control they cannot press. Nothing is at risk either — the
   * held selection was never persisted, and Republish sends no settings, so
   * letting it through discards a local-only selection rather than a saved one
   * (the select visibly snaps back to the record's real visibility afterwards).
   */
  const blocksRepublish = pendingPasscode

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
        // Defensive: a 200 without a record would otherwise walk into
        // applySavedRecord, set `record` to undefined and THEN throw — flipping
        // a live published deck to the pre-publish "Publish deck" state on what
        // is really just a malformed response. Fail as an error instead, which
        // reverts the control and toasts.
        if (!data?.deck) throw new Error('The server did not return the updated settings')
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
      // Say so when there was something to drop — the field vanishes with the
      // 'restricted' option, so a silent clear looks like the passcode was kept.
      const previousPasscode = passcode
      if (previous === 'restricted' && next !== 'restricted' && passcode) {
        setPasscode('')
        toast({
          title: 'Discarded the unsaved passcode',
          description: `${VISIBILITY_LABELS[next].label} viewers don't need one. Nothing was saved — switch back to Restricted to set one.`,
        })
      }

      void patchSettings('visibility', { visibility: next }, () => {
        setVisibility(previous)
        setPasscode(previousPasscode)
      })
    },
    [visibility, passcode, isLive, record, patchSettings, toast]
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
      if (!data?.deck) throw new Error('The server did not return the published deck')
      setRecord(data.deck)
      syncFormFromRecord(data.deck)
      // The snapshot was just re-taken from the live deck, so the baseline the
      // server stored is current by construction — unless it couldn't read one,
      // which the echoed record tells us (null sourceUpdatedAt → unverifiable).
      setStaleness(stalenessAfterResnapshot(data.deck))
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
    if (blocksRepublish) {
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
  }, [blocksRepublish, pendingRestricted, handlePublish, toast])

  const handleRotate = useCallback(async () => {
    if (!record) return
    setIsRotating(true)
    try {
      const response = await fetch(`/api/publish/${record.slug}/rotate`, { method: 'POST' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Failed to rotate link')
      }
      if (!data?.deck) throw new Error('The server did not return the rotated deck')
      setRecord(data.deck)
      setConfirmRotate(false)
      // Rotate re-snapshots too, so it re-baselines staleness server-side (same
      // "unless the baseline couldn't be read" caveat as republish).
      setStaleness(stalenessAfterResnapshot(data.deck))
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
      if (!data?.deck) throw new Error('The server did not return the unpublished deck')
      setRecord(data.deck)
      // No live copy left to compare against; the verdict is simply not applicable.
      setStaleness('unknown')
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

  /**
   * Pass-1 failed. Shown ABOVE the live state when we still hold a record, and
   * INSTEAD of the publish form when we don't — because the form's Publish sends
   * every setting, and from an unknown state those settings are guesses that the
   * server would apply to whatever record actually exists. Either way the only
   * way forward is Retry.
   */
  const loadErrorNotice = (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/50 dark:text-amber-200">
      <p className="flex-1">
        <span className="font-medium">Couldn&rsquo;t load this deck&rsquo;s publish status.</span>{' '}
        {isLive
          ? 'What you see below is the last state we loaded. Publishing is paused until this loads.'
          : 'Publishing is paused until this loads — it can’t be done safely without knowing the current settings.'}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setReloadToken((token) => token + 1)}
        disabled={busy}
        className="flex-shrink-0"
      >
        Retry
      </Button>
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
        ) : loadError && !isLive ? (
          // Nothing loaded and nothing held: show the failure, not a form whose
          // defaults would be submitted as if they were this deck's settings.
          loadErrorNotice
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
            {loadError && loadErrorNotice}

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
                    read as interchangeable. It is also the single most
                    destructive control in this dialog: it permanently kills
                    every URL already shared (strictly worse than Unpublish,
                    which can be undone by republishing the same slug). So it
                    ARMS on the first press and only acts on an explicit confirm,
                    like Unpublish — and it wears a key, not a refresh glyph,
                    which belongs to Republish, the safe "update" action. */}
                <Button
                  type="button"
                  variant={confirmRotate ? 'secondary' : 'outline'}
                  size="icon"
                  onClick={() => {
                    setConfirmUnpublish(false) // never leave two confirms armed at once
                    setConfirmRotate((armed) => !armed)
                  }}
                  disabled={busy}
                  title="Mint a new link — the old one stops working"
                  aria-label="Mint a new link — the old one stops working"
                  aria-expanded={confirmRotate}
                  className="flex-shrink-0"
                >
                  {isRotating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <KeyRound className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {confirmRotate && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/50 dark:text-amber-200">
                  <p className="flex-1">
                    <span className="font-medium">Mint a new link?</span> This link stops working
                    permanently — anyone you already shared it with loses access. To publish your
                    latest slides on the SAME link, use Republish instead.
                  </p>
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmRotate(false)}
                      disabled={busy}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={handleRotate}
                      disabled={busy}
                    >
                      {isRotating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                      Mint new link
                    </Button>
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Published {formatDate(record!.publishedAt)}
                {record!.republishedAt ? ` · updated ${formatDate(record!.republishedAt)}` : ''}
                {record!.viewCount > 0 ? ` · ${record!.viewCount} view${record!.viewCount === 1 ? '' : 's'}` : ''}
              </p>
            </div>

            {liveSettingsForm}

            {/* Four states, four different things to say. 'current' says nothing
                (the quiet default). 'stale' is the amber call to action.
                'unknown' — no stored baseline, or the check didn't come back —
                gets a NEUTRAL hint: silence there would read as "all good" and
                leave a possibly-stale link sitting unrepublished, while amber
                would nag on evidence we don't have. 'checking' says so out loud
                for the same reason: an empty space during a slow or hung check
                is indistinguishable from "up to date", which is the exact
                misreading this tri-state exists to prevent.
                All of it is suppressed while loadError is up: that notice
                already explains the situation, and pointing at Republish would
                point at a button we have deliberately withheld. */}
            {!loadError && (
              <>
                {staleness === 'checking' && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Checking whether the published copy is up to date&hellip;
                  </p>
                )}

                {staleness === 'stale' && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/50 dark:text-amber-200">
                    <p className="font-medium">
                      This deck has changed since you published it — republish to update the link.
                    </p>
                    {slideDelta && <p className="mt-0.5 opacity-90">{slideDelta}</p>}
                  </div>
                )}

                {staleness === 'unknown' && (
                  <p className="text-xs text-muted-foreground">
                    Can&rsquo;t verify whether the published copy is up to date — republish if in
                    doubt.
                    {slideDelta ? ` ${slideDelta}.` : ''}
                  </p>
                )}
              </>
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
                  onClick={() => {
                    setConfirmRotate(false) // never leave two confirms armed at once
                    setConfirmUnpublish(true)
                  }}
                  disabled={busy}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950"
                >
                  Unpublish
                </Button>
              )}
              {/* Primary when the published copy is out of date; still clickable
                  (a forced re-snapshot) when it isn't. It carries the refresh
                  glyph because THIS is the "update what's published" action —
                  the one Rotate used to wear while doing the opposite.
                  Gone entirely while loadError is up — the notice above owns the
                  next move (Retry), and no write should leave here until the
                  record on screen has been confirmed against the server. */}
              {!loadError && (
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
                  {isPublishing ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Republish
                </Button>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
