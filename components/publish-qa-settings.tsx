"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  FileText,
  Globe,
  Layers,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { SerializedPublishedDeck } from '@/lib/publish/serialize'

interface QaSource {
  sourceRef: string
  sourceKind: string
  sourceLabel: string | null
  chunkCount: number
  allowedForQa: boolean
}

interface PublishQaSettingsProps {
  record: SerializedPublishedDeck
  onRecordChange: (record: SerializedPublishedDeck) => void
  disabled?: boolean
}

/**
 * Tone presets. These are STYLE only — Researcher grounds the answer with the
 * tone absent from its context and restyles afterwards, so no value here can
 * make the system answer something it would otherwise refuse.
 */
const TONE_PRESETS: { value: string; label: string; hint: string }[] = [
  { value: 'professional', label: 'Professional', hint: 'Clear and businesslike.' },
  { value: 'friendly', label: 'Friendly', hint: 'Warm and conversational, still precise.' },
  { value: 'concise', label: 'Concise', hint: 'One or two sentences wherever possible.' },
  { value: 'technical', label: 'Technical', hint: 'Keeps technical terms rather than simplifying.' },
]

const KIND_META: Record<string, { label: string; icon: typeof FileText; sensitive: boolean }> = {
  deck: { label: 'Slides', icon: Layers, sensitive: false },
  web: { label: 'Web pages', icon: Globe, sensitive: false },
  document: { label: 'Your uploads', icon: FileText, sensitive: true },
  research: { label: 'Research', icon: Search, sensitive: true },
}

/** How long a build may run before we offer a way out of it. */
const BUILD_STALL_MS = 90_000

/**
 * What the corpus is doing, and the one control that changes it.
 *
 * Deliberately explicit about 'building' and 'failed' rather than showing a
 * generic spinner: a deck that is collecting questions but cannot yet answer
 * them is a state the owner needs to understand, not one to paper over.
 */
function CorpusStatusRow({
  status,
  rebuilding,
  onRebuild,
  disabled,
}: {
  status: string
  rebuilding: boolean
  onRebuild: () => void
  disabled: boolean
}) {
  const [stalled, setStalled] = useState(false)

  useEffect(() => {
    if (status !== 'building') {
      setStalled(false)
      return
    }
    const timer = setTimeout(() => setStalled(true), BUILD_STALL_MS)
    return () => clearTimeout(timer)
  }, [status])

  if (status === 'ready' || status === 'partial') {
    return (
      <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
        Ready to answer questions.
      </p>
    )
  }

  if (status === 'building') {
    return (
      <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
        <p className="flex items-center gap-1.5">
          <Loader2 className="h-3.5 w-3.5 flex-shrink-0 animate-spin" />
          Preparing this deck&apos;s content — questions asked meanwhile go to you.
        </p>
        {/* The build runs in background work after the response. If that
            instance is killed mid-flight, nothing ever writes a terminal
            status and the deck sits in 'building' forever — answering nothing,
            with no way out. So the retry stays reachable once a build has run
            long enough to be suspicious. */}
        {stalled && (
          <button
            type="button"
            onClick={onRebuild}
            disabled={disabled || rebuilding}
            className="inline-flex items-center gap-1.5 underline underline-offset-2 disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${rebuilding ? 'animate-spin' : ''}`} />
            Taking too long? Start again
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
      <div className="space-y-1">
        <p>
          {status === 'failed'
            ? "This deck's content could not be prepared, so questions are being collected for you rather than answered."
            : "Questions are collected for you until this deck's content is prepared."}
        </p>
        <button
          type="button"
          onClick={onRebuild}
          disabled={disabled || rebuilding}
          className="inline-flex items-center gap-1.5 rounded border border-amber-300 px-2 py-1 font-medium transition-colors hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:hover:bg-amber-900"
        >
          <RefreshCw className={`h-3 w-3 ${rebuilding ? 'animate-spin' : ''}`} />
          {rebuilding ? 'Starting…' : 'Prepare now'}
        </button>
      </div>
    </div>
  )
}

export function PublishQaSettings({
  record,
  onRecordChange,
  disabled = false,
}: PublishQaSettingsProps) {
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sources, setSources] = useState<QaSource[] | null>(null)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [needsRefreeze, setNeedsRefreeze] = useState(false)
  const [corpusStatus, setCorpusStatus] = useState(record.qaCorpusStatus)
  const [rebuilding, setRebuilding] = useState(false)
  const autoBuiltRef = useRef(false)

  const patch = useCallback(
    async (field: string, body: Record<string, unknown>) => {
      setSaving(field)
      setError(null)
      try {
        const response = await fetch(`/api/publish/${record.slug}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || 'Could not save that setting')
        // Adopt the SERVER's record rather than the optimistic value: the caps
        // are clamped server-side, so the number that took effect may not be
        // the number that was typed.
        if (data.deck) onRecordChange(data.deck as SerializedPublishedDeck)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save that setting')
      } finally {
        setSaving(null)
      }
    },
    [record.slug, onRecordChange]
  )

  useEffect(() => {
    setCorpusStatus(record.qaCorpusStatus)
  }, [record.qaCorpusStatus])

  // A build runs after the response, so the only way to learn it finished is to
  // ask. Polling stops as soon as it leaves 'building' — no idle timer.
  useEffect(() => {
    if (corpusStatus !== 'building') return
    let cancelled = false
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`/api/publish/${record.slug}/qa-corpus`)
        if (!response.ok) return
        const data = await response.json()
        if (cancelled) return
        if (data?.status && data.status !== 'building') {
          setCorpusStatus(data.status)
          setRebuilding(false)
          setNeedsRefreeze(false)
        }
      } catch {
        // Transient; the next tick tries again.
      }
    }, 4000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [corpusStatus, record.slug])

  const rebuildCorpus = useCallback(async () => {
    setRebuilding(true)
    setError(null)
    try {
      const response = await fetch(`/api/publish/${record.slug}/qa-corpus`, { method: 'POST' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not start the rebuild')
      setCorpusStatus('building')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the rebuild')
      setRebuilding(false)
    }
  }, [record.slug])

  // Self-heal the one state that should be impossible.
  //
  // Publishing and enabling Q&A both schedule a build via `after()`, which runs
  // AFTER the response is sent. If that background work does not survive on the
  // host — a real possibility we cannot verify outside a deployed environment —
  // the deck lands on qaEnabled=true with status 'none' and answers nothing,
  // forever, until a human notices and presses a button.
  //
  // 'none' + enabled is therefore treated as "the trigger did not run" and
  // repaired on sight. It cannot loop: refreshQaCorpus only ever writes
  // 'building' and then a terminal status, never back to 'none', and the ref
  // makes it once-per-mount regardless.
  useEffect(() => {
    if (!record.qaEnabled || corpusStatus !== 'none' || autoBuiltRef.current) return
    autoBuiltRef.current = true
    void rebuildCorpus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.qaEnabled, corpusStatus])

  const loadSources = useCallback(async () => {
    try {
      const response = await fetch(`/api/publish/${record.slug}/qa-sources`)
      if (!response.ok) return
      const data = await response.json()
      setSources((data?.sources ?? []) as QaSource[])
    } catch {
      // The toggle list is an enhancement; freeze-time defaults still apply.
    }
  }, [record.slug])

  useEffect(() => {
    if (sourcesOpen && sources === null) void loadSources()
  }, [sourcesOpen, sources, loadSources])

  const toggleSource = useCallback(
    async (source: QaSource, next: boolean) => {
      setSources((current) =>
        (current ?? []).map((row) =>
          row.sourceRef === source.sourceRef ? { ...row, allowedForQa: next } : row
        )
      )
      try {
        const response = await fetch(`/api/publish/${record.slug}/qa-sources`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sources: [
              {
                sourceRef: source.sourceRef,
                sourceKind: source.sourceKind,
                sourceLabel: source.sourceLabel,
                allowedForQa: next,
              },
            ],
          }),
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || 'Could not update that source')
        if (data.needsRefreeze) setNeedsRefreeze(true)
      } catch (e) {
        setSources((current) =>
          (current ?? []).map((row) =>
            row.sourceRef === source.sourceRef ? { ...row, allowedForQa: !next } : row
          )
        )
        setError(e instanceof Error ? e.message : 'Could not update that source')
      }
    },
    [record.slug]
  )

  const busy = disabled || saving !== null

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <Label htmlFor="publish-qa-enabled" className="font-normal">
            Answer questions from viewers
          </Label>
          <p className="text-xs text-muted-foreground">
            Viewers can ask about this deck. Answers come only from the deck and the sources you
            allow below — anything else is passed to you.
          </p>
        </div>
        <Switch
          id="publish-qa-enabled"
          checked={record.qaEnabled}
          onCheckedChange={(next) => patch('qaEnabled', { qaEnabled: next })}
          disabled={busy}
          className="mt-0.5 flex-shrink-0"
        />
      </div>

      {record.qaEnabled && (
        <>
          <CorpusStatusRow
            status={corpusStatus}
            rebuilding={rebuilding}
            onRebuild={rebuildCorpus}
            disabled={disabled}
          />

          <div className="space-y-1.5">
            <Label htmlFor="publish-qa-tone">Answer style</Label>
            <Select
              value={record.qaTonePreset}
              onValueChange={(value) => patch('qaTonePreset', { qaTonePreset: value })}
              disabled={busy}
            >
              <SelectTrigger id="publish-qa-tone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONE_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {TONE_PRESETS.find((preset) => preset.value === record.qaTonePreset)?.hint}{' '}
              Style only — it never changes what the answer is willing to say.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <Label htmlFor="publish-qa-cite-web" className="font-normal">
                Name public web sources
              </Label>
              <p className="text-xs text-muted-foreground">
                Your own documents are never named to viewers either way.
              </p>
            </div>
            <Switch
              id="publish-qa-cite-web"
              checked={record.qaCiteWebSources}
              onCheckedChange={(next) => patch('qaCiteWebSources', { qaCiteWebSources: next })}
              disabled={busy}
              className="flex-shrink-0"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="publish-qa-daily">Questions per day</Label>
              <Input
                id="publish-qa-daily"
                type="number"
                min={0}
                max={1000}
                defaultValue={record.qaDailyCap}
                onBlur={(e) => {
                  const value = Number(e.target.value)
                  if (Number.isFinite(value) && value !== record.qaDailyCap) {
                    void patch('qaDailyCap', { qaDailyCap: value })
                  }
                }}
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="publish-qa-monthly">Per month</Label>
              <Input
                id="publish-qa-monthly"
                type="number"
                min={0}
                max={20000}
                defaultValue={record.qaMonthlyCap}
                onBlur={(e) => {
                  const value = Number(e.target.value)
                  if (Number.isFinite(value) && value !== record.qaMonthlyCap) {
                    void patch('qaMonthlyCap', { qaMonthlyCap: value })
                  }
                }}
                disabled={busy}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Answering uses your plan allowance. These caps are the ceiling on what this deck can
            spend.
          </p>

          <div className="rounded-md border border-gray-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setSourcesOpen((value) => !value)}
              className="flex w-full items-center justify-between px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
              aria-expanded={sourcesOpen}
            >
              <span>What it can answer from</span>
              <ChevronDown
                className={`h-4 w-4 text-slate-400 transition-transform ${sourcesOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {sourcesOpen && (
              <div className="space-y-2 border-t border-gray-100 px-3 py-2 dark:border-slate-700">
                {sources === null ? (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                  </p>
                ) : sources.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nothing prepared yet. Republish the deck to build the answer sources.
                  </p>
                ) : (
                  sources.map((source) => {
                    const meta = KIND_META[source.sourceKind] ?? {
                      label: source.sourceKind,
                      icon: FileText,
                      sensitive: true,
                    }
                    const Icon = meta.icon
                    return (
                      <div
                        key={source.sourceRef}
                        className="flex items-center justify-between gap-2"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <Icon className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                          <span className="truncate text-xs text-slate-700 dark:text-slate-300">
                            {source.sourceLabel || source.sourceRef}
                          </span>
                          {meta.sensitive && (
                            <span className="flex-shrink-0 rounded bg-slate-100 px-1 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                              private
                            </span>
                          )}
                        </div>
                        <Switch
                          checked={source.allowedForQa}
                          onCheckedChange={(next) => toggleSource(source, next)}
                          disabled={disabled}
                          className="flex-shrink-0"
                        />
                      </div>
                    )
                  })
                )}
                <p className="pt-1 text-xs text-muted-foreground">
                  Sources marked private are never named to viewers, even when an answer uses
                  them. Turn one off and it is not used at all.
                </p>
                {needsRefreeze && corpusStatus !== 'building' && (
                  <div className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                    {/* Honest about WHEN it takes effect: turning a source off
                        records the decision, but the frozen corpus still holds
                        its content until a rebuild drops it. */}
                    <span>
                      Not applied yet —{' '}
                      <button
                        type="button"
                        onClick={rebuildCorpus}
                        className="underline underline-offset-2"
                        disabled={disabled || rebuilding}
                      >
                        rebuild now
                      </button>{' '}
                      to remove the sources you turned off.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
