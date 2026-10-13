import { StudioSessionHygieneStyles } from '@/components/builder/studio-session-hygiene-style-tag'
import { StudioProblemCard } from '@/components/builder/studio-problem-card'
import { STUDIO_SESSION_PROBLEM_LINKS } from '@/lib/studio-session-hygiene'

/** Unknown route, Studio style (flag on only: app/not-found.tsx loads this module lazily). Server-renderable: links only. */
export function StudioNotFound() {
  return (
    <div data-studio-v4-shell="true" data-studio-not-found="true">
      <StudioSessionHygieneStyles />
      <title>Page not found | Deckster</title>
      <main data-studio-problem-main="true" data-standalone="true">
        <StudioProblemCard
          eyebrow="Error 404"
          title="We couldn’t find that page."
          body="The link may be old, or the page may have moved. Your decks and sessions are not affected."
        >
          <a data-studio-problem-action="primary" href="/builder">Back to Studio</a>
          <a data-studio-problem-action="secondary" href={STUDIO_SESSION_PROBLEM_LINKS.decks}>Go to Decks</a>
        </StudioProblemCard>
      </main>
    </div>
  )
}
