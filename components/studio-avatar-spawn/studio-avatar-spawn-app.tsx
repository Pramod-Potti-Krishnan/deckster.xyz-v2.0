'use client'

// STUDIO AVATAR SPAWN MOCK (FRONTEND-2; B66, AVATAR-SPAWN): the "My companions" page's body. Flag NEXT_PUBLIC_STUDIO_AVATAR_SPAWN (exact "true", only with the Studio shell, default off): off, <StudioAvatarSpawnApp /> returns null.
// It holds the flow's state (consent, photo in memory, the job, the list) and talks to ONE SpawnClient: the MockSpawnClient unless the caller hands in another (the real service has no client yet). No network, no image call, no paid
// call, no console call. The photo lives in a PhotoHold: preview only, never written to storage, never logged, never sent, and let go of when a look is picked, when a job is refused, when the person cancels and on unmount.
import { useEffect, useRef, useState } from 'react'
import {
  MockSpawnClient,
  PhotoHold,
  STUDIO_AVATAR_SPAWN_ENABLED,
  buildConsentRecord,
  deletedNotice,
  pickAndDiscard,
  refuseScenarioFrom,
  savedNotice,
  viewOfJob,
  type SpawnClient,
  type SpawnJob,
  type StoredCompanionEntry,
} from '@/lib/studio-avatar-spawn'
import { CompanionsList, ConsentStep, MastersStep, ProgressStep, ReadyStep, RefusedStep, UploadStep } from './steps'

const TRY_AGAIN = 'Something went wrong. Please try again.'
const WAITING_STAGES = ['intake', 'masters', 'building']

export function StudioAvatarSpawnApp({ userId, client }: { userId: string | null | undefined; client?: SpawnClient }) {
  if (!STUDIO_AVATAR_SPAWN_ENABLED) return null
  return (
    <main className="mx-auto max-w-2xl p-6" data-testid="studio-companions-page">
      <h1 className="text-2xl font-semibold">My companions</h1>
      <p className="mt-1 text-sm text-muted-foreground" data-sas-part="mock">This is a preview. Nothing is sent anywhere and no picture is made yet.</p>
      <div data-studio-avatar-spawn="true">
        {userId ? <AvatarSpawnFlow key={userId} userId={userId} client={client} /> : <p className="sas-note" role="status">Loading…</p>}
      </div>
    </main>
  )
}

type Mode = 'list' | 'consent' | 'flow'

function AvatarSpawnFlow({ userId, client: given }: { userId: string; client?: SpawnClient }) {
  const [client, setClient] = useState<SpawnClient | null>(given ?? null)
  const [entries, setEntries] = useState<StoredCompanionEntry[]>([])
  const [mode, setMode] = useState<Mode>('list')
  const [ticked, setTicked] = useState<string[]>([])
  const [job, setJob] = useState<SpawnJob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [hasFile, setHasFile] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const holdRef = useRef<PhotoHold | null>(null)
  const hold = () => (holdRef.current ??= new PhotoHold(typeof URL !== 'undefined' ? URL : null))

  // The client is made in the browser, after the first render, so no storage is touched while rendering on the server.
  useEffect(() => {
    if (given) { setClient(given); return }
    setClient(new MockSpawnClient({ userId, refuse: refuseScenarioFrom(window.location.search) }))
  }, [given, userId])
  useEffect(() => {
    let live = true
    if (client) client.listPacks().then(list => { if (live) setEntries(list) }).catch(() => { if (live) setError(TRY_AGAIN) })
    return () => { live = false }
  }, [client])
  // The mock's stages move on timers; the page asks for the job again, as it would of the service.
  const jobId = job?.id, stage = job?.stage
  useEffect(() => {
    if (!client || !jobId || !stage || !WAITING_STAGES.includes(stage)) return
    let live = true
    const timer = setInterval(() => {
      client.getJob(jobId).then(next => {
        if (!live || !next) return
        if (next.stage === 'refused') { hold().discard(); setPreviewUrl(null); setHasFile(false) }
        setJob(next)
      }).catch(() => { if (live) setError(TRY_AGAIN) })
    }, 400)
    return () => { live = false; clearInterval(timer) }
  }, [client, jobId, stage])
  useEffect(() => () => holdRef.current?.discard(), [])

  const refresh = () => { if (client) client.listPacks().then(setEntries).catch(() => setError(TRY_AGAIN)) }
  const reset = () => {
    hold().discard()
    setPreviewUrl(null); setHasFile(false); setJob(null); setTicked([]); setSelectedId(null); setName(''); setError(null); setBusy(false); setMode('list')
  }
  const run = (task: () => Promise<void>) => { setBusy(true); setError(null); task().catch(() => setError(TRY_AGAIN)).finally(() => setBusy(false)) }

  const renderStep = () => {
    if (mode === 'consent') {
      return (
        <ConsentStep
          ticked={ticked}
          busy={busy}
          onToggle={id => setTicked(current => (current.includes(id) ? current.filter(item => item !== id) : [...current, id]))}
          onCancel={reset}
          onContinue={() => {
            const consent = buildConsentRecord(ticked, Date.now())
            if (!consent || !client) return
            run(async () => { setJob(await client.createJob(consent)); setMode('flow') })
          }}
        />
      )
    }

    if (mode === 'flow' && job) {
      const view = viewOfJob(job)
      if (view === 'upload') {
        return (
          <UploadStep
            previewUrl={previewUrl}
            hasFile={hasFile}
            busy={busy}
            onFile={file => { setPreviewUrl(hold().hold(file)); setHasFile(true) }}
            onCancel={reset}
            onContinue={() => { const photo = hold().current(); if (!photo || !client) return; run(async () => { setJob(await client.submitPhoto(job.id, photo)) }) }}
          />
        )
      }
      if (view === 'progress') return <ProgressStep job={job} />
      if (view === 'pick') {
        return (
          <MastersStep
            candidates={job.candidates}
            selectedId={selectedId}
            busy={busy}
            onSelect={setSelectedId}
            onPick={() => { if (!selectedId || !client) return; setPreviewUrl(null); setHasFile(false); run(async () => { setJob(await pickAndDiscard(client, hold(), job.id, selectedId)) }) }}
          />
        )
      }
      if (view === 'ready') {
        return (
          <ReadyStep
            name={name}
            busy={busy}
            onName={setName}
            onSave={() => {
              if (!client) return
              run(async () => {
                const saved = await client.saveDisplayName(job.id, name)
                reset()
                setNotice(savedNotice(saved.displayName))
                refresh()
              })
            }}
          />
        )
      }
      if (job.refusal) return <RefusedStep code={job.refusal} onBack={reset} />
    }

    return (
      <CompanionsList
        entries={entries}
        chosenId={chosenId}
        confirmingId={confirmingId}
        notice={notice}
        onCreate={() => { setNotice(null); setMode('consent') }}
        onChoose={id => { setChosenId(id); setNotice(null) }}
        onAskDelete={id => { setConfirmingId(id); setNotice(null) }}
        onCancelDelete={() => setConfirmingId(null)}
        onConfirmDelete={id => {
          if (!client) return
          const gone = entries.find(entry => entry.id === id)
          setConfirmingId(null)
          client.deletePack(id).then(() => {
            setChosenId(current => (current === id ? null : current))
            setNotice(deletedNotice(gone ? gone.displayName : null))
            refresh()
          }).catch(() => setError(TRY_AGAIN))
        }}
      />
    )
  }
  return <>{renderStep()}{error ? <p className="sas-error" role="alert" data-sas-part="error">{error}</p> : null}</>
}
