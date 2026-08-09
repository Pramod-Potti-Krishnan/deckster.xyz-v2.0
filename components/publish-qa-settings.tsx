"use client"

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ChevronDown, FileText, Globe, Layers, Loader2, Search } from 'lucide-react'
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
          {record.qaCorpusStatus !== 'ready' && record.qaCorpusStatus !== 'partial' && (
            <p className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <span>
                Questions are being collected, but answering starts once this deck&apos;s content
                has been prepared. Republish to build it now.
              </span>
            </p>
          )}

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
                {needsRefreeze && (
                  <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                    {/* Honest about WHEN it takes effect: the frozen corpus still
                        holds the old content until a republish rebuilds it. */}
                    <span>Republish the deck to apply the sources you turned off.</span>
                  </p>
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
