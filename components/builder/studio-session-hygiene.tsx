"use client"

/**
 * PASS2 #8 builder views (callers mount them only with NEXT_PUBLIC_STUDIO_SESSION_HYGIENE on):
 *  - StudioBuilderSkeleton: the route loader as the builder shell, not a blank page with a spinner.
 *  - StudioSessionProblemView: "session not found / deleted / could not load" in place of the workspace.
 * Presentation only. Colours come from the Studio shell tokens (--ss-*); the CSS is inline (see studio-session-hygiene-styles.ts).
 */
import { Layers } from 'lucide-react'
import { StudioRail } from '@/components/layout/studio-rail'
import { StudioNavigationHint } from '@/components/layout/studio-navigation-hint'
import { StudioProblemCard } from '@/components/builder/studio-problem-card'
import { StudioSessionHygieneStyles } from '@/components/builder/studio-session-hygiene-style-tag'
import {
  STUDIO_SESSION_PROBLEM_COPY,
  STUDIO_SESSION_PROBLEM_LINKS,
  type StudioSessionProblem,
} from '@/lib/studio-session-hygiene'

const RAIL_SLOTS = [0, 1, 2, 3, 4, 5, 6]
const SLIDE_SLOTS = [0, 1, 2, 3, 4]

/** The builder shell with its content still to come: rail, header, chat, canvas and slide rail. */
export function StudioBuilderSkeleton({ message = 'Loading builder...' }: { message?: string }) {
  return (
    <div data-studio-v4-shell="true" data-studio-skeleton="true" role="status" aria-live="polite" aria-busy="true">
      <StudioSessionHygieneStyles />
      <aside data-studio-skel-rail="true">
        <span data-studio-skel-brand="true"><Layers className="h-5 w-5" aria-hidden="true" /></span>
        <div data-studio-skel-nav="true">
          {RAIL_SLOTS.map(slot => <span key={slot} data-studio-skel-nav-item={slot === 0 ? 'active' : 'idle'}><i className="studio-skel-block" /></span>)}
        </div>
        <span data-studio-skel-avatar="true" className="studio-skel-block" />
      </aside>
      <div data-studio-skel-column="true">
        <header data-studio-skel-header="true">
          <i data-studio-skel-icon="true" className="studio-skel-block" />
          <i data-studio-skel-title="true" className="studio-skel-block" />
          <span data-studio-skel-actions="true">
            <i className="studio-skel-block" data-w="108" />
            <i className="studio-skel-block" data-w="92" />
            <i className="studio-skel-block" data-w="88" data-strong="true" />
          </span>
        </header>
        <div data-studio-skel-workspace="true">
          <section data-studio-skel-chat="true">
            <div data-studio-skel-chat-head="true">
              <i className="studio-skel-block" data-round="true" />
              <span><i className="studio-skel-block" data-w="96" /><i className="studio-skel-block" data-w="150" data-thin="true" /></span>
            </div>
            <div data-studio-skel-messages="true">
              <div data-studio-skel-msg="bot"><i className="studio-skel-block" data-w="64" data-thin="true" /><i className="studio-skel-block" /><i className="studio-skel-block" data-short="true" /></div>
              <div data-studio-skel-msg="user"><i className="studio-skel-block" /><i className="studio-skel-block" data-short="true" /></div>
              <div data-studio-skel-msg="bot"><i className="studio-skel-block" data-w="64" data-thin="true" /><i className="studio-skel-block" /><i className="studio-skel-block" /><i className="studio-skel-block" data-short="true" /></div>
            </div>
            <div data-studio-skel-composer="true">
              <i className="studio-skel-block" data-w="170" data-thin="true" />
              <span><i className="studio-skel-block" data-round="true" /><i className="studio-skel-block" data-round="true" /><i className="studio-skel-block" data-round="true" /><i className="studio-skel-block" data-round="true" data-send="true" /></span>
            </div>
          </section>
          <section data-studio-skel-canvas="true">
            <div data-studio-skel-toolbar="true"><i className="studio-skel-block" /><i className="studio-skel-block" /><i className="studio-skel-block" /><i className="studio-skel-block" /></div>
            <div data-studio-skel-stage="true">
              <div data-studio-skel-slide="true">
                <i className="studio-skel-block" style={{ width: '52%' }} data-title="true" />
                <i className="studio-skel-block" style={{ width: '68%' }} data-thin="true" />
                <i className="studio-skel-block" style={{ width: '44%' }} data-thin="true" />
                <i className="studio-skel-block" data-art="true" />
              </div>
              <p data-studio-skel-status="true"><span aria-hidden="true" />{message}</p>
            </div>
          </section>
          <aside data-studio-skel-slides="true">
            <i className="studio-skel-block" data-w="44" data-thin="true" />
            {SLIDE_SLOTS.map(slot => <i key={slot} className="studio-skel-block" data-thumb={slot === 0 ? 'active' : 'true'} />)}
          </aside>
        </div>
      </div>
    </div>
  )
}

/** The URL names a session this account cannot open. Shown in place of the workspace; nothing is created or connected. */
export function StudioSessionProblemView({ problem, studioShell }: { problem: StudioSessionProblem; studioShell: boolean }) {
  const copy = STUDIO_SESSION_PROBLEM_COPY[problem]
  return (
    <div data-studio-v4-shell="true" data-studio-session-problem={problem}>
      <StudioSessionHygieneStyles />
      {studioShell && (
        <StudioRail
          homeHref="https://deckster.xyz"
          studioEntry={(
            <StudioNavigationHint enabled label="Studio">
              <a href={STUDIO_SESSION_PROBLEM_LINKS.newPresentation} aria-label="Studio" aria-current="page"><Layers className="h-5 w-5" /></a>
            </StudioNavigationHint>
          )}
        />
      )}
      <main data-studio-problem-main="true">
        <StudioProblemCard eyebrow={copy.eyebrow} title={copy.title} body={copy.body} role="alert">
          {problem === 'load_error' && (
            <button type="button" data-studio-problem-action="primary" onClick={() => window.location.reload()}>Try again</button>
          )}
          <a data-studio-problem-action={problem === 'load_error' ? 'secondary' : 'primary'} href={STUDIO_SESSION_PROBLEM_LINKS.newPresentation}>Start a new presentation</a>
          <a data-studio-problem-action="secondary" href={STUDIO_SESSION_PROBLEM_LINKS.decks}>Go to Decks</a>
        </StudioProblemCard>
      </main>
    </div>
  )
}

