"use client"

import React, { useCallback, useEffect, useState } from 'react'
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

const VISIBILITY_LABELS: Record<PublishVisibility, { label: string; hint: string }> = {
  unlisted: { label: 'Unlisted', hint: 'Anyone with the link can view' },
  public: { label: 'Public', hint: 'Anyone can view; search engines may index it' },
  restricted: { label: 'Restricted', hint: 'Viewers must enter a passcode' },
}

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
  const enabled = Boolean(sessionId) && hasFinalDeck

  return (
    <div className={`flex items-center ${className}`}>
      <button
        onClick={() => setOpen(true)}
        disabled={!enabled}
        className="flex h-12 min-w-[72px] flex-col items-center justify-center gap-0.5 rounded-md px-3 py-1 text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-700 dark:disabled:hover:text-slate-200"
        title={enabled
          ? 'Publish this deck to a shareable link'
          : 'Publishing unlocks once the final deck is built'}
      >
        <Globe className="h-5 w-5" />
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

  // Settings form (drives both first publish and later PATCHes)
  const [visibility, setVisibility] = useState<PublishVisibility>('unlisted')
  const [passcode, setPasscode] = useState('')
  const [allowPdf, setAllowPdf] = useState(true)
  const [allowPptx, setAllowPptx] = useState(true)

  const [isPublishing, setIsPublishing] = useState(false)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [isRotating, setIsRotating] = useState(false)
  const [isUnpublishing, setIsUnpublishing] = useState(false)
  const [confirmUnpublish, setConfirmUnpublish] = useState(false)

  const isLive = Boolean(record && !record.revokedAt)
  const busy = isPublishing || isSavingSettings || isRotating || isUnpublishing

  const syncFormFromRecord = useCallback((deck: SerializedPublishedDeck | null) => {
    if (!deck) return
    setVisibility((deck.visibility as PublishVisibility) || 'unlisted')
    setAllowPdf(deck.allowPdf)
    setAllowPptx(deck.allowPptx)
    setPasscode('')
  }, [])

  // Load the current publish state whenever the dialog opens
  useEffect(() => {
    if (!open) {
      setConfirmUnpublish(false)
      return
    }
    let cancelled = false
    setIsLoading(true)
    fetch(`/api/publish/by-session/${sessionId}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Failed to load publish state')
        const data = await response.json()
        if (cancelled) return
        setRecord(data.deck ?? null)
        syncFormFromRecord(data.deck ?? null)
      })
      .catch(() => {
        if (!cancelled) setRecord(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, sessionId, syncFormFromRecord])

  const needsPasscode =
    visibility === 'restricted' && !passcode && !(isLive && record?.hasPasscode)

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

  const handleSaveSettings = useCallback(async () => {
    if (!record) return
    setIsSavingSettings(true)
    try {
      const body: Record<string, unknown> = {
        visibility,
        allowPdf,
        allowPptx,
      }
      if (passcode) body.passcode = passcode
      const response = await fetch(`/api/publish/${record.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save settings')
      }
      setRecord(data.deck)
      syncFormFromRecord(data.deck)
      toast({ title: 'Sharing settings saved' })
    } catch (error) {
      toast({
        title: 'Failed to save settings',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setIsSavingSettings(false)
    }
  }, [record, visibility, allowPdf, allowPptx, passcode, syncFormFromRecord, toast])

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
      toast({
        title: 'Link rotated',
        description: 'The old link no longer works. Share the new one.',
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
      setConfirmUnpublish(false)
      toast({
        title: 'Deck unpublished',
        description: 'The link no longer works. You can publish again anytime.',
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

  const settingsForm = (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="publish-visibility">Who can view</Label>
        <Select
          value={visibility}
          onValueChange={(value) => setVisibility(value as PublishVisibility)}
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

      {visibility === 'restricted' && (
        <div className="space-y-1.5">
          <Label htmlFor="publish-passcode">Passcode</Label>
          <Input
            id="publish-passcode"
            type="text"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder={
              isLive && record?.hasPasscode
                ? 'Unchanged — type to replace'
                : 'Choose a passcode for viewers'
            }
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
              </div>
              <p className="text-xs text-muted-foreground">
                Published {formatDate(record!.publishedAt)}
                {record!.republishedAt ? ` · updated ${formatDate(record!.republishedAt)}` : ''}
                {record!.viewCount > 0 ? ` · ${record!.viewCount} view${record!.viewCount === 1 ? '' : 's'}` : ''}
              </p>
            </div>

            {settingsForm}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSaveSettings}
                disabled={busy || needsPasscode}
                title={needsPasscode ? 'Set a passcode for restricted visibility' : undefined}
              >
                {isSavingSettings ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Save settings
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handlePublish(true)}
                disabled={busy}
                title="Snapshot the latest version of the deck onto the same link"
              >
                {isPublishing ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                )}
                Republish
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRotate}
                disabled={busy}
                title="Mint a new link; the old one stops working"
              >
                {isRotating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Rotate link
              </Button>
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
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
