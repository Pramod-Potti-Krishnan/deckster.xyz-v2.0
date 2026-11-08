'use client'

// STUDIO AVATAR SPAWN MOCK (FRONTEND-2; B66, AVATAR-SPAWN): the steps of "Create my avatar" and the "My companions" list, each a plain function of its props (the container, studio-avatar-spawn-app.tsx,
// holds the state), so the proof can render every step and every state. Words are plain; the consent text is PLACEHOLDER text and says so. Nothing here reads a file, logs, stores or sends.
import { useState } from 'react'
import {
  CONSENT_ITEMS,
  CONSENT_PLACEHOLDER_NOTE,
  REFUSAL_MESSAGES,
  SPAWN_STAGES,
  STAGE_WORDS,
  allConsentTicked,
  cleanDisplayName,
  companionFallbackChain,
  stillCandidates,
  type CompanionRegistryEntry,
  type RefusalCode,
  type SpawnCandidate,
  type SpawnJob,
  type SpawnStage,
} from '@/lib/studio-avatar-spawn'
import './studio-avatar-spawn.css'

export function ConsentStep({ ticked, onToggle, onContinue, onCancel, busy }: { ticked: readonly string[]; onToggle: (id: string) => void; onContinue: () => void; onCancel: () => void; busy?: boolean }) {
  const all = allConsentTicked(ticked)
  return (
    <section className="sas-card" data-sas-step="consent" aria-labelledby="sas-consent-title">
      <h2 id="sas-consent-title">Before we start</h2>
      <p className="sas-placeholder" data-sas-part="placeholder">{CONSENT_PLACEHOLDER_NOTE}</p>
      <ul className="sas-consent">
        {CONSENT_ITEMS.map(item => (
          <li key={item.id}>
            <label>
              <input type="checkbox" checked={ticked.includes(item.id)} onChange={() => onToggle(item.id)} data-sas-consent={item.id} />
              <span>{item.text}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="sas-actions">
        <button type="button" className="sas-primary" disabled={!all || !!busy} onClick={onContinue}>Continue</button>
        <button type="button" className="sas-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </section>
  )
}

export function UploadStep({ previewUrl, hasFile, onFile, onContinue, onCancel, busy }: { previewUrl: string | null; hasFile: boolean; onFile: (file: File) => void; onContinue: () => void; onCancel: () => void; busy?: boolean }) {
  return (
    <section className="sas-card" data-sas-step="upload" aria-labelledby="sas-upload-title">
      <h2 id="sas-upload-title">Add a photo</h2>
      <p className="sas-note" data-sas-part="privacy">Your photo stays in this tab. It is not saved, logged or sent anywhere.</p>
      <div className="sas-field">
        <label htmlFor="sas-photo">A clear photo of your own face</label>
        <input id="sas-photo" type="file" accept="image/jpeg,image/png,image/heic,image/heif" onChange={event => { const file = event.target.files?.[0]; if (file) onFile(file) }} />
      </div>
      {previewUrl ? <img className="sas-preview" src={previewUrl} alt="Preview of your photo" /> : null}
      <div className="sas-actions">
        <button type="button" className="sas-primary" disabled={!hasFile || !!busy} onClick={onContinue}>Make my avatar</button>
        <button type="button" className="sas-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </section>
  )
}

const WAITING: readonly SpawnStage[] = SPAWN_STAGES.filter(stage => stage !== 'consent' && stage !== 'upload')

export function ProgressStep({ job }: { job: Pick<SpawnJob, 'stage' | 'progress'> }) {
  const at = WAITING.indexOf(job.stage as SpawnStage)
  return (
    <section className="sas-card" data-sas-step="progress" aria-labelledby="sas-progress-title" aria-busy="true">
      <h2 id="sas-progress-title">{job.stage in STAGE_WORDS ? `${STAGE_WORDS[job.stage as SpawnStage]}…` : 'Working…'}</h2>
      <div className="sas-track" role="progressbar" aria-label="Progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={job.progress}><div className="sas-fill" style={{ width: `${job.progress}%` }} /></div>
      <ol className="sas-steps" aria-label="Steps">
        {WAITING.map((stage, index) => (
          <li key={stage} data-done={index < at ? 'true' : undefined} aria-current={index === at ? 'step' : undefined}>{STAGE_WORDS[stage]}</li>
        ))}
      </ol>
    </section>
  )
}

export function MastersStep({ candidates, selectedId, onSelect, onPick, busy }: { candidates: readonly SpawnCandidate[]; selectedId: string | null; onSelect: (id: string) => void; onPick: () => void; busy?: boolean }) {
  return (
    <section className="sas-card" data-sas-step="pick" aria-labelledby="sas-pick-title">
      <h2 id="sas-pick-title">Choose your look</h2>
      <p className="sas-note" data-sas-part="placeholder-looks">These four looks are placeholders from our existing cast. The real service will draw them from your photo.</p>
      <fieldset className="sas-picks">
        <legend>Pick the one that is you</legend>
        {candidates.map(candidate => (
          <label key={candidate.id} className="sas-pick">
            <input type="radio" name="sas-master" value={candidate.id} checked={selectedId === candidate.id} onChange={() => onSelect(candidate.id)} />
            <span className="sas-pick-box"><img src={candidate.previewUrl} alt="" /><span>{candidate.label}</span></span>
          </label>
        ))}
      </fieldset>
      <p className="sas-note">When you pick, your photo is let go of for good.</p>
      <div className="sas-actions">
        <button type="button" className="sas-primary" disabled={selectedId === null || !!busy} onClick={onPick}>That&apos;s me</button>
      </div>
    </section>
  )
}

export function ReadyStep({ name, onName, onSave, busy }: { name: string; onName: (value: string) => void; onSave: () => void; busy?: boolean }) {
  return (
    <section className="sas-card" data-sas-step="ready" aria-labelledby="sas-ready-title">
      <h2 id="sas-ready-title">Your companion is ready</h2>
      <div className="sas-field">
        <label htmlFor="sas-name">Name your companion</label>
        <input id="sas-name" type="text" value={name} maxLength={40} onChange={event => onName(event.target.value)} autoComplete="off" />
      </div>
      <p className="sas-note" data-sas-part="name-note">The name is kept only in this app&apos;s own record. It is not part of the companion&apos;s files.</p>
      <div className="sas-actions">
        <button type="button" className="sas-primary" disabled={cleanDisplayName(name) === null || !!busy} onClick={onSave}>Save companion</button>
      </div>
    </section>
  )
}

/** One plain message per code and nothing to continue with: no appeal in v1. */
export function RefusedStep({ code, onBack }: { code: RefusalCode; onBack: () => void }) {
  return (
    <section className="sas-card sas-refused" data-sas-step="refused" data-sas-refusal={code} role="alert" aria-labelledby="sas-refused-title">
      <h2 id="sas-refused-title">We cannot make this companion</h2>
      <p data-sas-part="refusal-message">{REFUSAL_MESSAGES[code]}</p>
      <div className="sas-actions">
        <button type="button" className="sas-secondary" onClick={onBack}>Back to my companions</button>
      </div>
    </section>
  )
}

/** A companion's picture: its pack's portrait, then Felix's when that will not load (the fallback chain's stills). */
export function CompanionThumb({ entry }: { entry: Pick<CompanionRegistryEntry, 'packBaseUrl'> }) {
  const stills = stillCandidates(companionFallbackChain(entry))
  const [at, setAt] = useState(0)
  return <img className="sas-thumb" src={stills[Math.min(at, stills.length - 1)]} alt="" width={48} height={48} onError={() => setAt(current => Math.min(current + 1, stills.length - 1))} />
}

export function CompanionsList({ entries, chosenId, confirmingId, notice, onCreate, onChoose, onAskDelete, onConfirmDelete, onCancelDelete }: {
  entries: readonly CompanionRegistryEntry[]
  chosenId: string | null
  confirmingId: string | null
  notice?: string | null
  onCreate: () => void
  onChoose: (id: string) => void
  onAskDelete: (id: string) => void
  onConfirmDelete: (id: string) => void
  onCancelDelete: () => void
}) {
  return (
    <section className="sas-card" data-sas-step="list" aria-labelledby="sas-list-title">
      <h2 id="sas-list-title">Your companions</h2>
      {notice ? <p className="sas-note" role="status" data-sas-part="notice">{notice}</p> : null}
      {entries.length === 0 ? <p className="sas-note" data-sas-part="empty">You have no companions of your own yet.</p> : (
        <ul className="sas-list">
          {entries.map(entry => {
            const chosen = chosenId === entry.id
            return (
              <li key={entry.id} data-sas-companion={entry.id}>
                <CompanionThumb entry={entry} />
                <span className="sas-name">{entry.displayName}</span>
                {chosen ? <span className="sas-chosen" data-sas-part="chosen">Chosen</span> : null}
                <button type="button" className="sas-secondary" aria-pressed={chosen} disabled={chosen} onClick={() => onChoose(entry.id)}>{chosen ? 'Picked' : 'Pick'}</button>
                <button type="button" className="sas-danger" onClick={() => onAskDelete(entry.id)}>Delete</button>
                {confirmingId === entry.id ? (
                  <div className="sas-confirm" role="alertdialog" aria-label={`Delete ${entry.displayName}`} data-sas-part="confirm">
                    <p>Delete {entry.displayName}? This deletes the companion&apos;s pack and its previews. It cannot be undone.</p>
                    <div className="sas-actions">
                      <button type="button" className="sas-danger" onClick={() => onConfirmDelete(entry.id)}>Delete companion</button>
                      <button type="button" className="sas-secondary" onClick={onCancelDelete}>Keep it</button>
                    </div>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
      <div className="sas-actions">
        <button type="button" className="sas-primary" onClick={onCreate}>Create my avatar</button>
      </div>
    </section>
  )
}
