/**
 * Shared Studio "something is not here" card: a missing-deck illustration, an eyebrow, a serif headline, one calm
 * sentence and two actions. No state and no client APIs, so a server component (the 404 page) can render it.
 */
import type { ReactNode } from 'react'

/** A stack of slide cards with one dashed outline: the deck that is not here. Decorative. */
function MissingDeckArt() {
  return (
    <svg data-studio-problem-art="true" viewBox="0 0 120 84" aria-hidden="true" focusable="false">
      <rect x="22" y="10" width="78" height="52" rx="6" className="back" />
      <rect x="14" y="20" width="78" height="52" rx="6" className="front" />
      <rect x="24" y="31" width="34" height="4" rx="2" className="line" />
      <rect x="24" y="41" width="52" height="3" rx="1.5" className="line soft" />
      <rect x="24" y="48" width="40" height="3" rx="1.5" className="line soft" />
      <rect x="26" y="56" width="14" height="10" rx="2" className="line soft" />
      <rect x="44" y="56" width="14" height="10" rx="2" className="line soft" />
      <circle cx="96" cy="64" r="13" className="badge" />
      <path d="M92.5 60.8a3.7 3.7 0 1 1 5.2 3.4c-1.2.6-1.7 1.2-1.7 2.4" className="mark" />
      <circle cx="96" cy="70.4" r="1.1" className="dot" />
    </svg>
  )
}

export function StudioProblemCard({ eyebrow, title, body, role, children }: { eyebrow: string; title: string; body: string; role?: 'alert'; children: ReactNode }) {
  return (
    <section data-studio-problem-card="true" role={role}>
      <MissingDeckArt />
      <p data-studio-problem-eyebrow="true">{eyebrow}</p>
      {/* A style prop on purpose: see the Tailwind note in scripts/test-studio-session-hygiene.mjs */}
      <h1 style={{ textWrap: 'balance' }}>{title}</h1>
      <p data-studio-problem-body="true">{body}</p>
      <div data-studio-problem-actions="true">{children}</div>
    </section>
  )
}

