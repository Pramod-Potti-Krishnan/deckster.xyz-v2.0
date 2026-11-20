'use client'

// MY COMPANIONS (AVATAR-W5 Step A, for FRONTEND-1): /studio/companions with NEXT_PUBLIC_STUDIO_MY_COMPANIONS on (exact "true", only with the Studio shell, default off: then <MyCompanionsPage /> returns null).
// LIST ONLY: the signed-in owner's own companions from GET /api/avatar/companions (the server decides who the owner is), each with its portrait (its pack's portrait-512.webp through the pack route, Felix's when that does not
// load: the mock's CompanionThumb, reused) and its name. No Pick, no Create, no Delete, no file input: there is nothing real to upload to until Step B. The look is the mock list's (studio-avatar-spawn.css, unchanged).
// No console call; the only request is the lib's (lib/studio-my-companions.ts loadMyCompanions), made in the browser after the first render.
import { useEffect, useState } from 'react'
import { STUDIO_MY_COMPANIONS_ENABLED, loadMyCompanions, type MyCompanion, type MyCompanionsFetch } from '@/lib/studio-my-companions'
import { CompanionThumb } from './steps'
import './studio-avatar-spawn.css'

/** What the page shows: the list being asked for, the owner's list (possibly empty), or the plain words for a list that could not be had. */
export type MyCompanionsView = { state: 'loading' } | { state: 'ready'; entries: readonly MyCompanion[] } | { state: 'error' }

export const MY_COMPANIONS_LOADING = 'Loading…'
export const MY_COMPANIONS_EMPTY = 'You have no companions of your own yet.'
export const MY_COMPANIONS_ERROR = 'Your companions could not be loaded. Please try again later.'

/** The page's markup for one view: a plain function of it, so the proof can render every state. */
export function MyCompanionsList({ view }: { view: MyCompanionsView }) {
  return (
    <main className="mx-auto max-w-2xl p-6" data-testid="studio-my-companions-page">
      <h1 className="text-2xl font-semibold">My companions</h1>
      <div data-studio-avatar-spawn="true">
        <section className="sas-card" data-sas-step="list" aria-label="Your companions" aria-busy={view.state === 'loading' ? true : undefined}>
          {view.state === 'loading' ? <p className="sas-note" role="status" data-sas-part="loading">{MY_COMPANIONS_LOADING}</p> : null}
          {view.state === 'error' ? <p className="sas-error" role="alert" data-sas-part="error">{MY_COMPANIONS_ERROR}</p> : null}
          {view.state === 'ready' && view.entries.length === 0 ? <p className="sas-note" data-sas-part="empty">{MY_COMPANIONS_EMPTY}</p> : null}
          {view.state === 'ready' && view.entries.length > 0 ? (
            <ul className="sas-list">
              {view.entries.map(entry => (
                <li key={entry.id} data-sas-companion={entry.id}>
                  <CompanionThumb entry={entry} />
                  <span className="sas-name">{entry.displayName}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </main>
  )
}

/** The owner's list, asked for once after the first render. `fetchFn` is the browser's fetch unless a test hands in its own. */
function MyCompanionsLoader({ fetchFn }: { fetchFn?: MyCompanionsFetch }) {
  const [view, setView] = useState<MyCompanionsView>({ state: 'loading' })
  useEffect(() => {
    let live = true
    const get = fetchFn ?? (typeof window !== 'undefined' && typeof window.fetch === 'function' ? window.fetch.bind(window) : null)
    void loadMyCompanions(get).then(list => { if (live) setView(list ? { state: 'ready', entries: list } : { state: 'error' }) })
    return () => { live = false }
  }, [fetchFn])
  return <MyCompanionsList view={view} />
}

export function MyCompanionsPage({ fetchFn }: { fetchFn?: MyCompanionsFetch }) {
  if (!STUDIO_MY_COMPANIONS_ENABLED) return null
  return <MyCompanionsLoader fetchFn={fetchFn} />
}
