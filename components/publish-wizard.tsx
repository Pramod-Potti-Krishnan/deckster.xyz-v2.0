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

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Download, Globe, Link2, Loader2, LockKeyhole, MessageSquare, Volume2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { NarrationVoicePicker } from '@/components/narration-voice-picker'
import { resolveBudget, suggestedReserveMinutes } from '@/lib/narration/budget'
import type { SerializedPublishedDeck } from '@/lib/publish/serialize'
import type { StudioPublishPreviewSource } from '@/lib/studio-publish-preview'
import { StudioPublishPreview } from '@/components/studio-publish-preview'
import './studio-publish.css'

const STUDIO_PUBLISH = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'

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
  deckPreview?: StudioPublishPreviewSource | null
  slideCount: number | null
  /** Present when republishing — the wizard opens on the current settings
   *  rather than on defaults, so nothing silently reverts. */
  record: SerializedPublishedDeck | null
  busy: boolean
  progress: WizardStepResult[] | null
  onPublish: (choices: WizardChoices) => void
  onCancel: () => void
  /** Clears the progress view without repeating any completed service work. */
  onProgressClose?: () => void
}

const STEPS = ['Audience', 'Questions', 'Narration', 'Review'] as const
const PROGRESS_LABELS: Record<WizardStepResult['status'], string> = {
  pending: 'Waiting', running: 'In progress', done: 'Done', skipped: 'Skipped', failed: 'Failed',
}
const AUDIENCES = [
  { value: 'unlisted', icon: Link2, title: 'Anyone with the link', hint: 'Share the address with your audience.' },
  { value: 'public', icon: Globe, title: 'Anyone', hint: 'Search engines may index it. There is no public gallery.' },
  { value: 'restricted', icon: LockKeyhole, title: 'Only with a passcode', hint: 'Viewers enter a passcode before opening the deck.' },
] as const

export function PublishWizard({
  sessionId,
  deckPreview,
  slideCount,
  record,
  busy,
  progress,
  onPublish,
  onCancel,
  onProgressClose,
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

  const stepBodyRef = useRef<HTMLDivElement>(null)

  // The same dialog scroll body survives Next, Back and step navigation.
  // Reset only its position, then announce the new heading without scrolling
  // the focus target beneath the sticky step navigation. Choices stay intact.
  useLayoutEffect(() => {
    if (!STUDIO_PUBLISH || progress) return
    const stepBody = stepBodyRef.current
    if (!stepBody) return
    const scrollBody = stepBody.closest<HTMLElement>('.studio-publish-body')
    if (scrollBody) scrollBody.scrollTop = 0
    stepBody.querySelector<HTMLElement>('[data-studio-publish-step-title="true"]')?.focus({ preventScroll: true })
  }, [step, progress])

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
    const failed = progress.some((item) => item.status === 'failed')
    const published = progress[0]?.status === 'done'
    const heading = busy ? 'Setting up your deck…' : published
      ? failed ? 'Deck published · setup needs attention' : 'Your deck is live.'
      : record && !record.revokedAt ? 'The published deck could not be updated' : 'The deck could not be published'
    return (
      <div className="space-y-3 studio-publish-progress" data-studio-publish-wizard={STUDIO_PUBLISH}>
        {STUDIO_PUBLISH && <span className="studio-publish-eyebrow">Delivery status</span>}
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {STUDIO_PUBLISH ? heading : progress.every((s) => s.status === 'done' || s.status === 'skipped')
            ? 'Your deck is live.'
            : 'Setting up your deck…'}
        </p>
        <ul className="space-y-1.5" aria-live="polite" aria-busy={busy}>
          {progress.map((item) => (
            <li key={item.label} data-progress-status={item.status} className="flex items-start gap-2 text-sm">
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
              {STUDIO_PUBLISH && <span className="studio-publish-progress-label">{PROGRESS_LABELS[item.status]}</span>}
            </li>
          ))}
        </ul>
        {STUDIO_PUBLISH && !busy && (
          <div className="studio-publish-progress-actions">
            <p className="text-xs text-muted-foreground">
              {published ? failed
                ? 'The share link is live. Review the failed steps above; manage settings, scripts and recording from the published deck.'
                : 'Your published copy is ready to share. You can manage the link and its settings next.'
                : record && !record.revokedAt
                  ? 'Review your choices and try again. No new published copy was returned; the existing link remains available.'
                  : 'Review your choices and try again. No published link was returned.'}
            </p>
            <Button type="button" size="sm" onClick={onProgressClose ?? onCancel}>
              {published ? 'Manage published deck' : 'Back to choices'}
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 studio-publish-wizard" data-studio-publish-wizard={STUDIO_PUBLISH}>
      {/* Where you are, and what is still to come. A wizard that hides its own
          length is just a form that keeps asking for one more thing. */}
      {STUDIO_PUBLISH ? (
        <ol className="studio-publish-steps" aria-label="Publish setup steps">
          {STEPS.map((label, i) => (
            <li key={label} data-step-state={i < step ? 'complete' : i === step ? 'current' : 'next'}>
              <button type="button" aria-current={i === step ? 'step' : undefined}
                disabled={busy || i > step} onClick={() => setStep(i)}>
                <span>{i < step ? <Check size={13} /> : i + 1}</span>{label}
              </button>
            </li>
          ))}
        </ol>
      ) : (
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
      )}

      <div className="studio-publish-setup-grid">
      <div ref={stepBodyRef} className="min-h-[13rem] studio-publish-step-body">
        {step === 0 && (
          <div className="space-y-3">
            <Header icon={Users} title="Who is this for?" hint="You can change this later." />
            {STUDIO_PUBLISH ? (
              <fieldset className="studio-publish-audience">
                <legend>Who can view</legend>
                {AUDIENCES.map(({ value, icon: Icon, title, hint }) => (
                  <label key={value} data-selected={choices.visibility === value}>
                    <input type="radio" name="wiz-audience" value={value}
                      checked={choices.visibility === value} onChange={() => set('visibility', value)} />
                    <Icon size={17} aria-hidden="true" />
                    <span><strong>{title}</strong><small>{hint}</small></span>
                  </label>
                ))}
              </fieldset>
            ) : (
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
            )}
            {choices.visibility === 'restricted' && (
              <div className="space-y-1.5">
                <Label htmlFor="wiz-passcode">Passcode</Label>
                <Input
                  id="wiz-passcode"
                  aria-describedby={STUDIO_PUBLISH ? 'wiz-passcode-hint' : undefined}
                  type="text"
                  value={choices.passcode}
                  onChange={(e) => set('passcode', e.target.value)}
                  placeholder={record?.hasPasscode ? 'Unchanged' : 'At least 6 characters'}
                />
                {STUDIO_PUBLISH && <p id="wiz-passcode-hint" className="text-xs text-muted-foreground">{record?.hasPasscode ? 'Leave blank to keep the current passcode, or use at least six characters to replace it.' : 'Use at least six characters. This passcode is applied when you publish.'}</p>}
              </div>
            )}
            {STUDIO_PUBLISH && <h4 className="studio-publish-copies-heading">Can they keep a copy?</h4>}
            <Toggle
              id="wiz-pdf"
              label="Allow PDF download"
              hint={STUDIO_PUBLISH ? "Read-only copy of the published version" : undefined}
              checked={choices.allowPdf}
              onChange={(v) => set('allowPdf', v)}
            />
            <Toggle
              id="wiz-pptx"
              label="Allow PowerPoint download"
              hint={STUDIO_PUBLISH ? "Editable copy of the published version" : undefined}
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
                <div className={`max-h-56 overflow-y-auto rounded-md border border-gray-200 p-2 dark:border-slate-700${STUDIO_PUBLISH ? ' studio-publish-voice-options' : ''}`}>
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
                  ? STUDIO_PUBLISH ? 'Anyone · search engines may index' : 'Anyone, listed publicly'
                  : choices.visibility === 'restricted'
                    ? 'Only with the passcode'
                    : 'Anyone with the link'}
              </Summary>
              {STUDIO_PUBLISH && (
                <Summary label="Downloads">
                  {[choices.allowPdf && 'PDF', choices.allowPptx && 'PowerPoint'].filter(Boolean).join(' and ') || 'Off'}
                </Summary>
              )}
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

            {STUDIO_PUBLISH && choices.narrationEnabled && !budget && (
              <div className="studio-publish-incomplete" role="note">
                <strong>Set a session length to write the script</strong>
                <p>Publishing is available now. Narration setup needs a session length; you can also finish it later in Sharing and Voice.</p>
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setStep(2)}>Set session length</Button>
              </div>
            )}
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
                  hint={STUDIO_PUBLISH
                    ? 'Recording starts after publishing and charges your wallet. Leave this off to estimate and record later in Voice.'
                    : "You'll see the exact cost before anything is charged."}
                  checked={choices.recordNarration}
                  onChange={(v) => set('recordNarration', v)}
                />
              </div>
            )}
          </div>
        )}
      </div>
      {STUDIO_PUBLISH && (
        <aside className="studio-publish-viewer-summary" aria-label="Viewer experience based on your choices">
          <span className="studio-publish-eyebrow">What viewers get</span>
          <StudioPublishPreview sessionId={sessionId} source={deckPreview} />
          <p className="studio-publish-preview-count">{slideCount === null ? 'A view-only presentation' : `${slideCount} slides · view-only`}</p>
          <ul>
            <li><Users size={15} /><span><strong>{AUDIENCES.find((item) => item.value === choices.visibility)?.title}</strong><small>Access follows your audience choice.</small></span></li>
            <li><Download size={15} /><span><strong>{[choices.allowPdf && 'PDF', choices.allowPptx && 'PowerPoint'].filter(Boolean).join(' and ') || 'No downloads'}</strong><small>Only allowed formats appear to viewers.</small></span></li>
            <li><MessageSquare size={15} /><span><strong>Questions {choices.qaEnabled ? 'on' : 'off'}</strong><small>{choices.qaEnabled ? 'Answer sources are prepared after publishing.' : 'New questions are switched off.'}</small></span></li>
            <li><Volume2 size={15} /><span><strong>Narration {choices.narrationEnabled ? 'on' : 'off'}</strong><small>{choices.narrationEnabled ? 'Requires a script and recorded audio. Playback never autoplays.' : 'Viewers move through the slides themselves.'}</small></span></li>
          </ul>
          <p className="studio-publish-summary-note">These are your selected settings. Publication and setup results appear after you publish.</p>
        </aside>
      )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-gray-200 pt-3 dark:border-slate-700 studio-publish-wizard-actions">
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
            {STUDIO_PUBLISH ? `Next · ${STEPS[step + 1]}` : 'Next'} <ArrowRight className="ml-1 h-3.5 w-3.5" />
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
    <div className="space-y-0.5 studio-publish-step-heading">
      <p data-studio-publish-step-title={STUDIO_PUBLISH ? "true" : undefined} role={STUDIO_PUBLISH ? "heading" : undefined} aria-level={STUDIO_PUBLISH ? 3 : undefined} tabIndex={STUDIO_PUBLISH ? -1 : undefined} className="flex items-center gap-1.5 text-sm font-medium text-slate-900 dark:text-slate-100">
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
    <div className="flex items-start justify-between gap-3 studio-publish-toggle">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="font-normal">
          {label}
        </Label>
        {hint && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} aria-describedby={hint ? `${id}-hint` : undefined} className="mt-0.5 flex-shrink-0" />
    </div>
  )
}

function Summary({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="flex items-baseline justify-between gap-3 studio-publish-summary-row">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-right font-medium text-slate-800 dark:text-slate-100">{children}</span>
    </li>
  )
}
