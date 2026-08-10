"use client"

/**
 * Deciding what a published deck IS, before publishing it.
 *
 * The old flow asked two questions — who can see this, may they download it —
 * published, and only then revealed that the deck could also answer questions
 * and narrate itself. You had to publish something before you could find out
 * what you were publishing.
 *
 * So the choices come first and the button comes last. Four steps, in the order
 * the decisions actually depend on each other: who it is for, whether it
 * answers, whether it speaks, and then a summary of what is about to happen —
 * including what it will cost, before it costs anything.
 *
 * **Why the work happens after the publish, not before.** Freezing the Q&A
 * corpus, drafting a script and recording audio all need a published deck to
 * hang off. Rather than pretend otherwise, the last step publishes and then
 * shows the work being done, one line at a time. That is honest about the
 * ordering and it is also the only moment where watching progress is genuinely
 * useful.
 */

import { useCallback, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Loader2, MessageSquare, Volume2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { NarrationVoicePicker } from '@/components/narration-voice-picker'
import { resolveBudget, suggestedReserveMinutes } from '@/lib/narration/budget'
import type { SerializedPublishedDeck } from '@/lib/publish/serialize'

export interface WizardChoices {
  visibility: 'public' | 'unlisted' | 'restricted'
  passcode: string
  allowPdf: boolean
  allowPptx: boolean
  qaEnabled: boolean
  qaAutoAnswer: boolean
  narrationEnabled: boolean
  narrationBudgetMinutes: number | null
  qaReserveMinutes: number | null
  writeScript: boolean
  recordNarration: boolean
}

export interface WizardStepResult {
  label: string
  status: 'pending' | 'running' | 'done' | 'skipped' | 'failed'
  detail?: string
}

interface Props {
  sessionId: string
  slideCount: number | null
  /** Present when republishing — the wizard opens on the current settings
   *  rather than on defaults, so nothing silently reverts. */
  record: SerializedPublishedDeck | null
  busy: boolean
  progress: WizardStepResult[] | null
  onPublish: (choices: WizardChoices) => void
  onCancel: () => void
}

const STEPS = ['Audience', 'Questions', 'Narration', 'Review'] as const

export function PublishWizard({
  sessionId,
  slideCount,
  record,
  busy,
  progress,
  onPublish,
  onCancel,
}: Props) {
  const [step, setStep] = useState(0)
  const [choices, setChoices] = useState<WizardChoices>(() => ({
    visibility: (record?.visibility as WizardChoices['visibility']) ?? 'unlisted',
    passcode: '',
    allowPdf: record?.allowPdf ?? true,
    allowPptx: record?.allowPptx ?? true,
    qaEnabled: record?.qaEnabled ?? false,
    qaAutoAnswer: record?.qaAutoAnswer ?? true,
    narrationEnabled: record?.narrationEnabled ?? false,
    narrationBudgetMinutes: record?.narrationBudgetMinutes ?? null,
    qaReserveMinutes: record?.qaReserveMinutes ?? null,
    // Both default ON when narration is being switched on, because a deck that
    // narrates but has no script and no audio is a setting, not a feature.
    writeScript: true,
    recordNarration: true,
  }))

  const set = useCallback(
    <K extends keyof WizardChoices>(key: K, value: WizardChoices[K]) =>
      setChoices((prev) => ({ ...prev, [key]: value })),
    []
  )

  const budget = resolveBudget(choices.narrationBudgetMinutes, choices.qaReserveMinutes)
  const needsPasscode = choices.visibility === 'restricted' && !choices.passcode && !record?.hasPasscode

  // Steps that are switched off are skipped entirely rather than shown empty.
  const visibleSteps = useMemo(() => [0, 1, 2, 3], [])

  if (progress) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {progress.every((s) => s.status === 'done' || s.status === 'skipped')
            ? 'Your deck is live.'
            : 'Setting up your deck…'}
        </p>
        <ul className="space-y-1.5">
          {progress.map((item) => (
            <li key={item.label} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center">
                {item.status === 'running' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {item.status === 'done' && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                {item.status === 'failed' && <span className="text-amber-600">!</span>}
                {(item.status === 'pending' || item.status === 'skipped') && (
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                )}
              </span>
              <span
                className={
                  item.status === 'skipped'
                    ? 'text-slate-400'
                    : 'text-slate-700 dark:text-slate-200'
                }
              >
                {item.label}
                {item.detail && (
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    {item.detail}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Where you are, and what is still to come. A wizard that hides its own
          length is just a form that keeps asking for one more thing. */}
      <ol className="flex items-center gap-1 text-xs">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-1">
            <span
              className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-medium ${
                i < step
                  ? 'bg-emerald-500 text-white'
                  : i === step
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-200 text-slate-500 dark:bg-slate-700'
              }`}
            >
              {i < step ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span
              className={
                i === step ? 'font-medium text-slate-900 dark:text-slate-100' : 'text-slate-400'
              }
            >
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />}
          </li>
        ))}
      </ol>

      <div className="min-h-[13rem]">
        {step === 0 && (
          <div className="space-y-3">
            <Header icon={Users} title="Who is this for?" hint="You can change this later." />
            <div className="space-y-1.5">
              <Label htmlFor="wiz-visibility">Who can view</Label>
              <select
                id="wiz-visibility"
                value={choices.visibility}
                onChange={(e) => set('visibility', e.target.value as WizardChoices['visibility'])}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="unlisted">Anyone with the link</option>
                <option value="public">Anyone — listed publicly</option>
                <option value="restricted">Only people with a passcode</option>
              </select>
            </div>
            {choices.visibility === 'restricted' && (
              <div className="space-y-1.5">
                <Label htmlFor="wiz-passcode">Passcode</Label>
                <Input
                  id="wiz-passcode"
                  type="text"
                  value={choices.passcode}
                  onChange={(e) => set('passcode', e.target.value)}
                  placeholder={record?.hasPasscode ? 'Unchanged' : 'At least 6 characters'}
                />
              </div>
            )}
            <Toggle
              id="wiz-pdf"
              label="Allow PDF download"
              checked={choices.allowPdf}
              onChange={(v) => set('allowPdf', v)}
            />
            <Toggle
              id="wiz-pptx"
              label="Allow PowerPoint download"
              checked={choices.allowPptx}
              onChange={(v) => set('allowPptx', v)}
            />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <Header
              icon={MessageSquare}
              title="Should it answer questions?"
              hint="Viewers can ask about the deck. Anything it can't answer comes to you."
            />
            <Toggle
              id="wiz-qa"
              label="Answer questions from viewers"
              checked={choices.qaEnabled}
              onChange={(v) => set('qaEnabled', v)}
            />
            {choices.qaEnabled && (
              <div className="ml-6 border-l border-gray-200 pl-3 dark:border-slate-700">
                <Toggle
                  id="wiz-qa-auto"
                  label="Answer automatically"
                  hint={
                    choices.qaAutoAnswer
                      ? 'Answers grounded in this deck go out immediately; the rest come to you.'
                      : 'Nothing is answered automatically — every question waits for you.'
                  }
                  checked={choices.qaAutoAnswer}
                  onChange={(v) => set('qaAutoAnswer', v)}
                />
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <Header
              icon={Volume2}
              title="Should it present itself?"
              hint="The deck speaks its own script, and viewers can raise a hand to ask."
            />
            <Toggle
              id="wiz-narration"
              label="Narrate this deck"
              checked={choices.narrationEnabled}
              onChange={(v) => set('narrationEnabled', v)}
            />
            {choices.narrationEnabled && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="wiz-budget" className="text-xs">
                      How long is the session?
                    </Label>
                    <Input
                      id="wiz-budget"
                      type="number"
                      min={1}
                      max={480}
                      placeholder="e.g. 20"
                      value={choices.narrationBudgetMinutes ?? ''}
                      onChange={(e) =>
                        set(
                          'narrationBudgetMinutes',
                          e.target.value === '' ? null : Number(e.target.value)
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="wiz-reserve" className="text-xs">
                      Held for questions
                    </Label>
                    <Input
                      id="wiz-reserve"
                      type="number"
                      min={0}
                      max={480}
                      placeholder={
                        choices.narrationBudgetMinutes
                          ? String(suggestedReserveMinutes(choices.narrationBudgetMinutes))
                          : 'auto'
                      }
                      value={choices.qaReserveMinutes ?? ''}
                      onChange={(e) =>
                        set('qaReserveMinutes', e.target.value === '' ? null : Number(e.target.value))
                      }
                    />
                  </div>
                </div>
                {budget && (
                  <p className="text-xs text-muted-foreground">
                    {budget.narrationMinutes} min of talking, {budget.qaReserveMinutes} min for
                    questions.
                  </p>
                )}
                {/* The picker without a slug: choosing a voice works before
                    publishing, while writing and recording do not — so those
                    controls stay disabled here and happen in the last step. */}
                <div className="max-h-56 overflow-y-auto rounded-md border border-gray-200 p-2 dark:border-slate-700">
                  <NarrationVoicePicker sessionId={sessionId} slideCount={slideCount} />
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <Header icon={Check} title="Ready to publish" hint="Here's what happens next." />
            <ul className="space-y-1.5 text-sm">
              <Summary label="Who can view">
                {choices.visibility === 'public'
                  ? 'Anyone, listed publicly'
                  : choices.visibility === 'restricted'
                    ? 'Only with the passcode'
                    : 'Anyone with the link'}
              </Summary>
              <Summary label="Questions">
                {choices.qaEnabled
                  ? choices.qaAutoAnswer
                    ? 'Answered automatically, the rest come to you'
                    : 'Every question comes to you'
                  : 'Off'}
              </Summary>
              <Summary label="Narration">
                {choices.narrationEnabled
                  ? budget
                    ? `On · ${budget.narrationMinutes} min of talking`
                    : 'On · no session length set'
                  : 'Off'}
              </Summary>
            </ul>

            {choices.narrationEnabled && (
              <div className="space-y-2 rounded-md border border-gray-200 p-3 dark:border-slate-700">
                <Toggle
                  id="wiz-write"
                  label="Write the script now"
                  hint="Drafted from each slide, sized to the time it has."
                  checked={choices.writeScript}
                  onChange={(v) => set('writeScript', v)}
                />
                <Toggle
                  id="wiz-record"
                  label="Record the narration now"
                  hint="You'll see the exact cost before anything is charged."
                  checked={choices.recordNarration}
                  onChange={(v) => set('recordNarration', v)}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-gray-200 pt-3 dark:border-slate-700">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => (step === 0 ? onCancel() : setStep((s) => s - 1))}
          disabled={busy}
        >
          {step === 0 ? 'Cancel' : <><ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back</>}
        </Button>
        {step < visibleSteps.length - 1 ? (
          <Button size="sm" onClick={() => setStep((s) => s + 1)} disabled={busy || (step === 0 && needsPasscode)}>
            Next <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button size="sm" onClick={() => onPublish(choices)} disabled={busy}>
            {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {record ? 'Republish' : 'Publish'}
          </Button>
        )}
      </div>
    </div>
  )
}

function Header({
  icon: Icon,
  title,
  hint,
}: {
  icon: typeof Users
  title: string
  hint: string
}) {
  return (
    <div className="space-y-0.5">
      <p className="flex items-center gap-1.5 text-sm font-medium text-slate-900 dark:text-slate-100">
        <Icon className="h-4 w-4 text-slate-400" />
        {title}
      </p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

function Toggle({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string
  label: string
  hint?: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="font-normal">
          {label}
        </Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="mt-0.5 flex-shrink-0" />
    </div>
  )
}

function Summary({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="flex items-baseline justify-between gap-3">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-right font-medium text-slate-800 dark:text-slate-100">{children}</span>
    </li>
  )
}
