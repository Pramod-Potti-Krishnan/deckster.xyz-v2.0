"use client"

/**
 * Pieces of the publish wizard that only exist with NEXT_PUBLIC_STUDIO_P2_PUBLISH (lib/studio-p2-publish.ts). The wizard and the dialog render these
 * inside `STUDIO_P2_PUBLISH ? <piece/> : <what was there>`, so with the flag off none of this is mounted.
 *
 *   PublishPasscodeInput / PublishPasscodeCounter  PUB-02  masked passcode, eye toggle, "N more characters needed"
 *   PublishRecordReview                             PUB-06 + PUB-07  script and recording choices on the review step
 *   PublishDoneLink                                 PUB-10  the link, copy, open and "View as a viewer" on the done screen
 *   PublishCapabilityRows                           PUB-08 + PUB-15  one on/off row per thing the viewer page does (wizard aside, Viewer page tab)
 *   PublishQuestionsNote                            PUB-04  one line on the Questions step
 *   PublishQuestionsBadge                           PUB-11  the waiting count on the Questions tab
 *   useP2ManageFacts                                PUB-11  question counts and narration state for the manage view and the Questions tab badge
 *   publishedLink                                   NEXT_PUBLIC_STUDIO_P2_PUBLISH_ORIGIN_URL  the link on the page the owner is on
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, Copy, ExternalLink, Eye, EyeOff, Loader2, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import type { SerializedPublishedDeck } from '@/lib/publish/serialize'
import {
  capabilityRows,
  estimateRecording,
  parseNarrationState,
  parseQuestionCounts,
  passcodeCounter,
  QUESTIONS_AFTER_PUBLISH_NOTE,
  questionsBadge,
  STUDIO_P2_PUBLISH_ENABLED,
  STUDIO_P2_PUBLISH_ORIGIN_ENABLED,
  viewerLinkFor,
  voiceRateFrom,
  type CapabilityInput,
  type NarrationState,
  type QuestionCounts,
  type RecordingBudget,
} from '@/lib/studio-p2-publish'

/** PUB-02: the field is masked, with an eye to show it. Same controlled value and placeholder as the field it replaces. */
export function PublishPasscodeInput({
  fieldId,
  text,
  onText,
  placeholder,
  describedBy,
  locked,
}: {
  fieldId: string
  text: string
  onText: (next: string) => void
  placeholder: string
  describedBy?: string
  locked?: boolean
}) {
  const [shown, setShown] = useState(false)
  return (
    <div className="studio-publish-passcode">
      <Input
        id={fieldId}
        aria-describedby={describedBy}
        type={shown ? 'text' : 'password'}
        value={text}
        onChange={(e) => onText(e.target.value)}
        placeholder={placeholder}
        disabled={locked}
        autoComplete="new-password"
        className="pr-9"
      />
      <button
        type="button"
        className="studio-publish-passcode-eye"
        aria-label={shown ? 'Hide passcode' : 'Show passcode'}
        aria-pressed={shown}
        onClick={() => setShown((value) => !value)}
      >
        {shown ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
      </button>
    </div>
  )
}

/** PUB-02: "3 more characters needed" while a typed passcode is under the server's minimum; nothing otherwise. */
export function PublishPasscodeCounter({ text, counterId }: { text: string; counterId?: string }) {
  const counter = passcodeCounter(text)
  return counter ? <p id={counterId} className="studio-publish-passcode-count" role="status">{counter}</p> : null
}

function ReviewToggle({
  toggleId,
  label,
  hint,
  on,
  locked,
  onToggle,
}: {
  toggleId: string
  label: string
  hint: string
  on: boolean
  locked: boolean
  onToggle: (next: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-3 studio-publish-toggle">
      <div className="space-y-0.5">
        <Label htmlFor={toggleId} className="font-normal">{label}</Label>
        <p id={`${toggleId}-hint`} className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch id={toggleId} checked={on} disabled={locked} onCheckedChange={onToggle} aria-describedby={`${toggleId}-hint`} className="mt-0.5 flex-shrink-0" />
    </div>
  )
}

/**
 * PUB-07 + PUB-06: the two choices on the review step when narration is on.
 *
 *  - "Write the script now" is off and disabled until the session length is set (without it the script route answers 400).
 *  - "Record the narration now" starts off. Switching it on shows an estimate and a tick; only the tick (reported through onConsent as the amount
 *    ticked, in cents) lets publish record. The figure here is a proxy from the session length (the script does not exist yet); the dialog checks it
 *    again against the render route's own estimate once the script is written, before anything is charged.
 */
export function PublishRecordReview({
  deckSessionId,
  deckSlides,
  budget,
  scriptOn,
  recordOn,
  busyNow,
  onScriptToggle,
  onRecordToggle,
  onConsent,
}: {
  deckSessionId: string
  deckSlides: number | null
  budget: RecordingBudget | null
  scriptOn: boolean
  recordOn: boolean
  busyNow: boolean
  onScriptToggle: (next: boolean) => void
  onRecordToggle: (next: boolean) => void
  onConsent: (cents: number | null) => void
}) {
  const hasBudget = budget !== null
  const writes = scriptOn && hasBudget
  const wantsEstimate = recordOn && writes
  const [rate, setRate] = useState<{ name: string; costPerMinuteUsd: number } | 'loading' | 'unavailable' | null>(null)
  // The amount the owner ticked, not just "ticked": a different figure on screen is not the one they agreed to.
  const [ticked, setTicked] = useState<number | null>(null)

  // The voice the recording would use and its measured rate: the picker's own read (GET only; nothing is generated or charged).
  useEffect(() => {
    if (!wantsEstimate) return
    let cancelled = false
    setRate('loading')
    fetch(`/api/narration/voice?sessionId=${encodeURIComponent(deckSessionId)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => { if (!cancelled) setRate(voiceRateFrom(data) ?? 'unavailable') })
      .catch(() => { if (!cancelled) setRate('unavailable') })
    return () => { cancelled = true }
  }, [wantsEstimate, deckSessionId])

  const voice = typeof rate === 'object' && rate !== null ? rate : null
  const estimate = useMemo(
    () => (wantsEstimate && voice ? estimateRecording(budget, voice.costPerMinuteUsd, deckSlides) : null),
    [wantsEstimate, voice, budget, deckSlides]
  )
  const consentCents = estimate && ticked === estimate.cents ? ticked : null

  // The consent follows the figure on screen: a new figure, a switch turned off or leaving the step all take the tick back.
  const reportRef = useRef(onConsent)
  reportRef.current = onConsent
  useEffect(() => { reportRef.current(consentCents) }, [consentCents])
  useEffect(() => () => reportRef.current(null), [])
  useEffect(() => { if (!wantsEstimate) setTicked(null) }, [wantsEstimate])

  return (
    <div className="space-y-2 rounded-md border border-gray-200 p-3 dark:border-slate-700 studio-publish-record-review">
      <ReviewToggle
        toggleId="wiz-write"
        label="Write the script now"
        hint={hasBudget ? 'Drafted from each slide, sized to the time it has.' : 'Set a session length in Narration first.'}
        on={writes}
        locked={busyNow || !hasBudget}
        onToggle={onScriptToggle}
      />
      <ReviewToggle
        toggleId="wiz-record"
        label="Record the narration now"
        hint="Shows the estimate first. Nothing is charged without your confirmation."
        on={wantsEstimate}
        locked={busyNow || !writes}
        onToggle={onRecordToggle}
      />
      {wantsEstimate && (
        <div className="studio-publish-record-estimate" data-record-estimate={rate === 'loading' ? 'loading' : estimate ? 'ready' : 'unavailable'}>
          {rate === 'loading' || rate === null ? (
            <p role="status"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Checking the price of this voice…</p>
          ) : estimate && voice ? (
            <label htmlFor="wiz-record-confirm">
              <input id="wiz-record-confirm" type="checkbox" checked={consentCents !== null} disabled={busyNow} onChange={(event) => setTicked(event.target.checked ? estimate.cents : null)} />
              <span>
                <strong>Record for up to {estimate.cents}¢</strong> · about {estimate.minutes} min of audio with {voice.name}
                {estimate.segments !== null ? ` · up to ${estimate.segments} segments` : ''}
                <small>
                  Estimate only: the script is not written yet, so this is sized from your {budget?.narrationMinutes} min of talking, a shorter fallback
                  version and a closing line. Once the script exists the price is checked again; if it is higher than this, nothing is recorded and you can
                  record from Voice. Without this tick the script is written and recording waits for you in Voice.
                </small>
              </span>
            </label>
          ) : (
            <p role="status">The price of this voice is not available right now, so recording stays off. After publishing you can record from Voice, which shows the price first.</p>
          )}
        </div>
      )}
    </div>
  )
}

/** PUB-10: the finished deck's link, with copy, open, and "View as a viewer" (the public page, in a new tab). */
export function PublishDoneLink({ url }: { url: string }) {
  const { copied, copy } = useCopyToClipboard()
  const { toast } = useToast()
  return (
    <div className="studio-publish-done-link">
      <span className="studio-publish-eyebrow">Your link</span>
      <div className="studio-publish-link-actions flex items-center gap-2">
        <Input readOnly value={url} aria-label="Published deck link" className="font-mono text-xs" />
        <Button
          type="button"
          variant="outline"
          size="icon"
          title="Copy link"
          aria-label={copied ? 'Link copied' : 'Copy link'}
          className="flex-shrink-0"
          onClick={async () => {
            if (!(await copy(url))) {
              toast({ title: 'Copy failed', description: 'Could not access the clipboard. Copy the link manually.', variant: 'destructive' })
            }
          }}
        >
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        </Button>
        <Button type="button" variant="outline" size="icon" asChild title="Open link" aria-label="Open published link" className="flex-shrink-0">
          <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
        </Button>
      </div>
      <Button type="button" size="sm" asChild className="studio-publish-view-as-viewer">
        <a href={url} target="_blank" rel="noopener noreferrer">View as a viewer<ArrowRight className="ml-1 h-3.5 w-3.5" /></a>
      </Button>
    </div>
  )
}

/** PUB-08 / PUB-15: what the viewer page offers, one row per choice, on or off. Words as well as a mark, so the state is never colour alone. */
export function PublishCapabilityRows({ input, label }: { input: CapabilityInput; label: string }) {
  const rows = capabilityRows(input)
  return (
    <ul className="studio-publish-caps" aria-label={label}>
      {rows.map((row) => (
        <li key={row.id} data-capability={row.id} data-on={row.on ? 'true' : 'false'}>
          {row.on ? <Check size={14} aria-hidden="true" /> : <Minus size={14} aria-hidden="true" />}
          <span><strong>{row.label}</strong><small>{row.note}</small></span>
          <em>{row.on ? 'On' : 'Off'}</em>
        </li>
      ))}
    </ul>
  )
}

/** PUB-11: the number of questions waiting on the owner, on the Questions tab. Nothing when none wait or the count is not known. */
export function PublishQuestionsBadge({ counts }: { counts: QuestionCounts | null }) {
  const badge = questionsBadge(counts)
  if (!badge) return null
  return (
    <>
      <span className="studio-publish-badge" aria-hidden="true">{badge.text}</span>
      <span className="sr-only">{badge.label}</span>
    </>
  )
}

/** PUB-04: the Questions step stays short; the rest is set in Questions after publishing. */
export function PublishQuestionsNote() {
  return <p className="studio-publish-step-note" data-publish-questions-note="true">{QUESTIONS_AFTER_PUBLISH_NOTE}</p>
}

/** The link the owner copies and opens. Unchanged unless NEXT_PUBLIC_STUDIO_P2_PUBLISH_ORIGIN_URL is on, NEXT_PUBLIC_APP_URL is unset and the page knows its origin. */
export function publishedLink(record: Pick<SerializedPublishedDeck, 'slug' | 'publicUrl'>): string {
  return viewerLinkFor(record, process.env.NEXT_PUBLIC_APP_URL, typeof window === 'undefined' ? null : window.location.origin, STUDIO_P2_PUBLISH_ORIGIN_ENABLED)
}

/**
 * PUB-11: the facts the manage view adds, read when the dialog is open on a live copy. Two small owner-only reads, nothing written:
 *   GET /api/publish/{slug}/questions?summary=1   (counts only, flag on only)
 *   GET /api/narration/manifest?slug={slug}       (the voice and which slides have a current recording; the owner's own read of the published copy)
 * Each fact belongs to the slug it was read for, so a rotated link or another deck never shows the last one's numbers. A read that fails shows nothing extra.
 * With the flag off nothing is requested.
 */
export function useP2ManageFacts(record: SerializedPublishedDeck | null, open: boolean): { questions: QuestionCounts | null; narration: NarrationState | null } {
  const [questionsRead, setQuestionsRead] = useState<{ slug: string; counts: QuestionCounts } | null>(null)
  const [narrationRead, setNarrationRead] = useState<{ slug: string; state: NarrationState } | null>(null)
  const slug = STUDIO_P2_PUBLISH_ENABLED && open && record && !record.revokedAt ? record.slug : null
  const asks = record?.qaEnabled === true
  const narrates = record?.narrationEnabled === true
  const version = record?.republishedAt ?? record?.publishedAt ?? null

  useEffect(() => {
    if (!slug || !asks) return
    let cancelled = false
    fetch(`/api/publish/${encodeURIComponent(slug)}/questions?summary=1`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const counts = parseQuestionCounts(data)
        if (!cancelled && counts) setQuestionsRead({ slug, counts })
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [slug, asks, version])

  useEffect(() => {
    if (!slug || !narrates) return
    let cancelled = false
    fetch(`/api/narration/manifest?slug=${encodeURIComponent(slug)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const state = parseNarrationState(data)
        if (!cancelled && state) setNarrationRead({ slug, state })
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [slug, narrates, version])

  return {
    questions: slug && asks && questionsRead?.slug === slug ? questionsRead.counts : null,
    narration: slug && narrates && narrationRead?.slug === slug ? narrationRead.state : null,
  }
}
