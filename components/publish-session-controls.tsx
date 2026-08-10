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

import { useCallback, useState } from 'react'
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
      className={`flex items-start justify-between gap-3 ${
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

export function PublishSessionControls({ record, onRecordChange, disabled }: Props) {
  const { toast } = useToast()
  const [saving, setSaving] = useState<string | null>(null)
  const busy = disabled || saving !== null

  const patch = useCallback(
    async (field: string, body: Record<string, unknown>) => {
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
    [record.slug, onRecordChange, toast]
  )

  const budget = resolveBudget(record.narrationBudgetMinutes, record.qaReserveMinutes)

  return (
    <div className="space-y-4">
      <div className="space-y-3">
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
            {saving?.startsWith('narration') && <Loader2 className="h-3 w-3 animate-spin" />}
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
                defaultValue={record.narrationBudgetMinutes ?? ''}
                onBlur={(e) => {
                  const raw = e.target.value.trim()
                  // Empty means "no slot set" and must reach the server as null,
                  // not 0 — a deck budgeted at zero minutes is a different and
                  // nonsensical thing.
                  const value = raw === '' ? null : Number(raw)
                  if (value !== null && !Number.isFinite(value)) return
                  if (value !== record.narrationBudgetMinutes) {
                    void patch('narrationBudget', { narrationBudgetMinutes: value })
                  }
                }}
                disabled={busy}
              />
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
                defaultValue={record.qaReserveMinutes ?? ''}
                onBlur={(e) => {
                  const raw = e.target.value.trim()
                  const value = raw === '' ? null : Number(raw)
                  if (value !== null && !Number.isFinite(value)) return
                  if (value !== record.qaReserveMinutes) {
                    void patch('narrationReserve', { qaReserveMinutes: value })
                  }
                }}
                disabled={busy}
              />
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
