"use client"

/**
 * The master switches on the publish dialog's main tab.
 *
 * These are the DECISIONS — what this published deck is allowed to do. The
 * detail behind each one lives in its own tab, and a tab is only reachable once
 * its switch is on. That ordering is the point: a publisher should decide
 * whether their deck answers questions before being asked to configure how it
 * answers them, and a deck that does not narrate should not present a voice
 * picker at all.
 *
 * The time budget lives here rather than under Voice because it is not a voice
 * setting. It is the shape of the session — how long you have, and how much of
 * that belongs to the audience — and it governs the script long before any
 * audio exists.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Clock, Loader2, MessageSquare, Sparkles, Volume2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { resolveBudget, suggestedReserveMinutes } from '@/lib/narration/budget'
import type { SerializedPublishedDeck } from '@/lib/publish/serialize'

interface Props {
  record: SerializedPublishedDeck
  onRecordChange: (record: SerializedPublishedDeck) => void
  disabled?: boolean
}

function Row({
  icon: Icon,
  label,
  hint,
  checked,
  onChange,
  disabled,
  id,
  nested,
}: {
  icon: typeof MessageSquare
  label: string
  hint: string
  checked: boolean
  onChange: (next: boolean) => void
  disabled: boolean
  id: string
  nested?: boolean
}) {
  return (
    <div
      className={`studio-publish-toggle flex items-start justify-between gap-3 ${
        nested ? 'ml-6 border-l border-gray-200 pl-3 dark:border-slate-700' : ''
      }`}
    >
      <div className="space-y-0.5">
        <Label htmlFor={id} className="flex items-center gap-1.5 font-normal">
          {!nested && <Icon className="h-3.5 w-3.5 text-slate-400" />}
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        className="mt-0.5 flex-shrink-0"
      />
    </div>
  )
}

// Studio draft reconciliation is local only. The existing record remains the
// source for saved summaries, feature gates and all native PATCH payloads.
const STUDIO_SESSION_DRAFTS = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'
type MinuteKey = 'narrationBudgetMinutes' | 'qaReserveMinutes'
type DraftScope = { slug: string }
type MinuteDrafts = {
  scope: DraftScope
  values: Record<MinuteKey, string>
  dirty: Record<MinuteKey, boolean>
  errors: Record<MinuteKey, string | null>
}
const minuteString = (value: number | null) => value === null ? '' : String(value)
const initialMinuteDrafts = (scope: DraftScope, record: SerializedPublishedDeck): MinuteDrafts => ({
  scope,
  values: { narrationBudgetMinutes: minuteString(record.narrationBudgetMinutes), qaReserveMinutes: minuteString(record.qaReserveMinutes) },
  dirty: { narrationBudgetMinutes: false, qaReserveMinutes: false },
  errors: { narrationBudgetMinutes: null, qaReserveMinutes: null },
})

function useStudioSessionDrafts(record: SerializedPublishedDeck, onRecordChange: Props['onRecordChange'], toast: ReturnType<typeof useToast>['toast']) {
  const scopeRef = useRef<DraftScope>({ slug: record.slug })
  if (scopeRef.current.slug !== record.slug) scopeRef.current = { slug: record.slug }
  const scope = scopeRef.current
  const mounted = useRef(false)
  const requestRef = useRef<object | null>(null)
  const pendingScopeRef = useRef<DraftScope | null>(null)
  const callbacksRef = useRef({ onRecordChange, toast })
  callbacksRef.current = { onRecordChange, toast }
  const [pending, setPending] = useState<{ scope: DraftScope; request: object; field: string } | null>(null)
  const [draftState, setDraftState] = useState(() => initialMinuteDrafts(scope, record))
  const drafts = draftState.scope === scope ? draftState : initialMinuteDrafts(scope, record)
  const draftRef = useRef(drafts)
  draftRef.current = drafts

  const update = (change: (current: MinuteDrafts) => MinuteDrafts) => {
    if (!mounted.current || scopeRef.current !== scope) return
    const next = change(draftRef.current)
    draftRef.current = next
    setDraftState(next)
  }

  useEffect(() => {
    if (!STUDIO_SESSION_DRAFTS) return
    mounted.current = true
    return () => { mounted.current = false; requestRef.current = null; pendingScopeRef.current = null }
  }, [])

  useEffect(() => {
    if (!STUDIO_SESSION_DRAFTS) return
    update((current) => ({
      ...current,
      values: {
        narrationBudgetMinutes: current.dirty.narrationBudgetMinutes ? current.values.narrationBudgetMinutes : minuteString(record.narrationBudgetMinutes),
        qaReserveMinutes: current.dirty.qaReserveMinutes ? current.values.qaReserveMinutes : minuteString(record.qaReserveMinutes),
      },
    }))
  }, [scope, record.narrationBudgetMinutes, record.qaReserveMinutes])

  const change = (key: MinuteKey, value: string) => update((current) => ({
    ...current, values: { ...current.values, [key]: value },
    dirty: { ...current.dirty, [key]: true }, errors: { ...current.errors, [key]: null },
  }))
  const reconcileNoop = (key: MinuteKey) => update((current) => ({
    ...current, values: { ...current.values, [key]: minuteString(record[key]) },
    dirty: { ...current.dirty, [key]: false }, errors: { ...current.errors, [key]: null },
  }))

  const patch = async (field: string, body: Record<string, unknown>) => {
    if (!mounted.current || scopeRef.current !== scope) return
    if (pendingScopeRef.current === scope && requestRef.current !== null) return
    const request = {}
    pendingScopeRef.current = scope
    requestRef.current = request
    const key: MinuteKey | null = field === 'narrationBudget' ? 'narrationBudgetMinutes' : field === 'narrationReserve' ? 'qaReserveMinutes' : null
    const submittedDraft = key ? draftRef.current.values[key] : null
    const currentRequest = () => mounted.current && scopeRef.current === scope && requestRef.current === request
    setPending({ scope, request, field })
    if (key) update((current) => ({ ...current, errors: { ...current.errors, [key]: null } }))
    try {
      const response = await fetch(`/api/publish/${record.slug}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await response.json().catch(() => ({}))
      if (!currentRequest()) return
      if (!response.ok) throw new Error(data.error || 'Could not save that setting')
      if (!data.deck || data.deck.slug !== scope.slug) {
        // Numeric drafts need an actual same-target record to reconcile. Other
        // switches retain their native optional-record success behavior.
        if (key) throw new Error('The server did not return the updated settings for this deck')
        return
      }
      const saved = data.deck as SerializedPublishedDeck
      if (key && saved[key] !== null && (typeof saved[key] !== 'number' || !Number.isFinite(saved[key]))) {
        throw new Error('The server did not return the saved session length')
      }
      callbacksRef.current.onRecordChange(saved)
      if (!currentRequest()) return
      if (key) update((current) => current.values[key] !== submittedDraft ? current : ({
        ...current, values: { ...current.values, [key]: minuteString(saved[key]) },
        dirty: { ...current.dirty, [key]: false }, errors: { ...current.errors, [key]: null },
      }))
    } catch (error) {
      if (!currentRequest()) return
      const message = error instanceof Error ? error.message : 'Could not save that setting'
      if (key) update((current) => current.values[key] !== submittedDraft ? current : ({
        ...current, dirty: { ...current.dirty, [key]: true }, errors: { ...current.errors, [key]: message },
      }))
      callbacksRef.current.toast({ title: key ? 'Session settings not saved' : message, variant: 'destructive' })
    } finally {
      if (currentRequest()) { requestRef.current = null; pendingScopeRef.current = null; setPending(null) }
    }
  }
  return { drafts, change, reconcileNoop, patch, saving: pending?.scope === scope && pending.request === requestRef.current ? pending.field : null }
}

function MinuteDraftNotice({ id, drafts, field, saved }: { id: string; drafts: MinuteDrafts; field: MinuteKey; saved: number | null }) {
  if (!drafts.dirty[field]) return null
  const error = drafts.errors[field]
  return (
    <p id={id} data-studio-session-unsaved={field} role={error ? 'alert' : 'status'}
      className="max-h-24 overflow-y-auto whitespace-pre-wrap break-words text-xs text-amber-700 dark:text-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 dark:focus-visible:outline-violet-300"
      tabIndex={error ? 0 : undefined} aria-label={error ? 'Session length not saved' : undefined}>
      {error ? `Not saved: ${error}. Your entry is kept. Leave this field again to retry. ` : 'Unsaved entry. Leave this field to save. '}
      {saved === null ? 'No value is saved for this field.' : `Saved value: ${saved} minutes.`}
    </p>
  )
}
// End Studio draft reconciliation.

export function PublishSessionControls({ record, onRecordChange, disabled }: Props) {
  const { toast } = useToast()
  const [saving, setSaving] = useState<string | null>(null)
  const studioDrafts = useStudioSessionDrafts(record, onRecordChange, toast)
  const activeSaving = STUDIO_SESSION_DRAFTS ? studioDrafts.saving : saving
  const busy = disabled || activeSaving !== null

  const patch = useCallback(
    async (field: string, body: Record<string, unknown>) => {
      if (STUDIO_SESSION_DRAFTS) return studioDrafts.patch(field, body)
      setSaving(field)
      try {
        const response = await fetch(`/api/publish/${record.slug}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || 'Could not save that setting')
        // Adopt the SERVER's record: the minutes are clamped server-side, so the
        // value that took effect may not be the value that was typed.
        if (data.deck) onRecordChange(data.deck as SerializedPublishedDeck)
      } catch (error) {
        toast({
          title: error instanceof Error ? error.message : 'Could not save that setting',
          variant: 'destructive',
        })
      } finally {
        setSaving(null)
      }
    },
    [record.slug, onRecordChange, toast, studioDrafts.patch]
  )

  const budget = resolveBudget(record.narrationBudgetMinutes, record.qaReserveMinutes)

  return (
    <div className="space-y-4 studio-publish-session">
      {process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && activeSaving && <p role="status" className="studio-publish-saving"><Loader2 size={12} className="animate-spin" />Saving session settings…</p>}
      <div className="space-y-3">
        {process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && <h3 className="studio-publish-section-heading">What can viewers do?</h3>}
        <Row
          id="publish-qa-enabled"
          icon={MessageSquare}
          label="Answer questions from viewers"
          hint="Viewers can ask about this deck. Anything unanswered comes to you."
          checked={record.qaEnabled}
          onChange={(next) => void patch('qaEnabled', { qaEnabled: next })}
          disabled={busy}
        />

        {/* Nested because it is meaningless on its own — you cannot choose how
            questions are answered on a deck that does not take questions. */}
        {record.qaEnabled && (
          <Row
            id="publish-qa-auto"
            icon={Sparkles}
            label="Answer automatically"
            hint={
              record.qaAutoAnswer
                ? 'Answers grounded in this deck go out immediately; the rest come to you.'
                : 'Nothing is answered automatically — every question waits for you.'
            }
            checked={record.qaAutoAnswer}
            onChange={(next) => void patch('qaAutoAnswer', { qaAutoAnswer: next })}
            disabled={busy}
            nested
          />
        )}

        <Row
          id="publish-narration-enabled"
          icon={Volume2}
          label="Narrate this deck"
          hint="The deck speaks its own script. Choose a voice under Voice."
          checked={record.narrationEnabled}
          onChange={(next) => void patch('narrationEnabled', { narrationEnabled: next })}
          disabled={busy}
        />
      </div>

      {/* The session's shape. Shown once anything time-based is switched on,
          because it governs both the script's length and how much room the
          audience gets — it is not a narration detail. */}
      {(record.narrationEnabled || record.qaEnabled) && (
        <div className="space-y-2.5 rounded-md border border-gray-200 p-3 dark:border-slate-700">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
              How long is the session?
            </span>
            {activeSaving?.startsWith('narration') && <Loader2 className="h-3 w-3 animate-spin" />}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="publish-budget" className="text-xs">
                Total minutes
              </Label>
              <Input
                id="publish-budget"
                type="number"
                min={1}
                max={480}
                placeholder="e.g. 20"
                {...(STUDIO_SESSION_DRAFTS ? {
                  value: studioDrafts.drafts.values.narrationBudgetMinutes,
                  onChange: (e: React.ChangeEvent<HTMLInputElement>) => studioDrafts.change('narrationBudgetMinutes', e.target.value),
                  'aria-describedby': studioDrafts.drafts.dirty.narrationBudgetMinutes ? 'publish-budget-unsaved' : undefined,
                } : { defaultValue: record.narrationBudgetMinutes ?? '' })}
                onBlur={(e) => {
                  const raw = e.target.value.trim()
                  // Empty means "no slot set" and must reach the server as null,
                  // not 0 — a deck budgeted at zero minutes is a different and
                  // nonsensical thing.
                  const value = raw === '' ? null : Number(raw)
                  if (value !== null && !Number.isFinite(value)) return
                  if (value !== record.narrationBudgetMinutes) {
                    void patch('narrationBudget', { narrationBudgetMinutes: value })
                  } else if (STUDIO_SESSION_DRAFTS) {
                    studioDrafts.reconcileNoop('narrationBudgetMinutes')
                  }
                }}
                disabled={busy}
              />
              {STUDIO_SESSION_DRAFTS && <MinuteDraftNotice id="publish-budget-unsaved" drafts={studioDrafts.drafts} field="narrationBudgetMinutes" saved={record.narrationBudgetMinutes} />}
            </div>
            <div className="space-y-1">
              <Label htmlFor="publish-qa-reserve" className="text-xs">
                Held for questions
              </Label>
              <Input
                id="publish-qa-reserve"
                type="number"
                min={0}
                max={480}
                placeholder={
                  record.narrationBudgetMinutes
                    ? String(suggestedReserveMinutes(record.narrationBudgetMinutes))
                    : 'auto'
                }
                {...(STUDIO_SESSION_DRAFTS ? {
                  value: studioDrafts.drafts.values.qaReserveMinutes,
                  onChange: (e: React.ChangeEvent<HTMLInputElement>) => studioDrafts.change('qaReserveMinutes', e.target.value),
                  'aria-describedby': studioDrafts.drafts.dirty.qaReserveMinutes ? 'publish-qa-reserve-unsaved' : undefined,
                } : { defaultValue: record.qaReserveMinutes ?? '' })}
                onBlur={(e) => {
                  const raw = e.target.value.trim()
                  const value = raw === '' ? null : Number(raw)
                  if (value !== null && !Number.isFinite(value)) return
                  if (value !== record.qaReserveMinutes) {
                    void patch('narrationReserve', { qaReserveMinutes: value })
                  } else if (STUDIO_SESSION_DRAFTS) {
                    studioDrafts.reconcileNoop('qaReserveMinutes')
                  }
                }}
                disabled={busy}
              />
              {STUDIO_SESSION_DRAFTS && <MinuteDraftNotice id="publish-qa-reserve-unsaved" drafts={studioDrafts.drafts} field="qaReserveMinutes" saved={record.qaReserveMinutes} />}
            </div>
          </div>

          {budget ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {budget.narrationMinutes} min
              </span>{' '}
              of talking, {budget.qaReserveMinutes} min for questions
              {budget.reserveIsDefault && ' (a fifth, the default — type your own to change it)'}.
              {' If questions run long, the deck switches to a shorter script of about '}
              {budget.compressedMinutes} min, says so, and finishes.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Leave the total blank and the script runs to its natural length rather than being
              fitted to a clock.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
