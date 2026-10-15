"use client"

import type { ReactNode } from 'react'
import { Layers, Sparkles, LayoutTemplate } from 'lucide-react'
import Link from 'next/link'
import { StudioIntroReplay } from '@/components/studio-intro-replay'

/** A static first-entry specimen; the real Layout iframe owns authored slides.
 *  `planning` (PASS2B G09, flag NEXT_PUBLIC_STUDIO_FIRST_RUN_POSTER_HIDE, passed by the stage once the first message has been sent): the
 *  first-run poster no longer tells the user to "Tell Director who it's for", it says Director is shaping the outline, and the first-run actions
 *  (start a conversation, replay the intro, explore templates) are not offered under it. Absent = the poster exactly as before. */
export function StudioWelcomeStage({ studioIntroReplay, planning }: { studioIntroReplay?: ReactNode; planning?: boolean } = {}) {
  if (planning) return <div className="studio-welcome-stage" role="region" aria-label="Your presentation stage" data-studio-welcome-planning="true">
    <div className="studio-welcome-label"><Layers size={14} aria-hidden="true" /><span>Your story is taking shape</span></div>
    <div className="studio-welcome-slide" aria-label="Presentation placeholder">
      <div className="studio-welcome-rule" /><span className="studio-welcome-eyebrow">FROM CONVERSATION TO CANVAS</span>
      <h2>Your presentation<br /><em>will take shape here.</em></h2>
      <p>Director is shaping your outline.<br />It will appear on this stage for your review.</p>
      <div className="studio-welcome-slide-bottom"><span>DECKSTER STUDIO</span><span>01</span></div>
    </div>
  </div>
  return <div className="studio-welcome-stage" role="region" aria-label="Your presentation stage">
    <div className="studio-welcome-label"><Layers size={14} aria-hidden="true" /><span>Your story starts here</span></div>
    <div className="studio-welcome-slide" aria-label="Empty presentation placeholder">
      <div className="studio-welcome-rule" /><span className="studio-welcome-eyebrow">A CLEAR IDEA. A COMPELLING STORY.</span>
      <h2>Make something<br /><em>worth presenting.</em></h2>
      <p>Tell Director who it’s for and what you want to say.<br />Your presentation will take shape on this stage.</p>
      <div className="studio-welcome-slide-bottom"><span>DECKSTER STUDIO</span><span>01</span></div>
    </div>
    <div className="studio-welcome-caption"><span><Sparkles size={14} aria-hidden="true" /> Start with a conversation</span>{studioIntroReplay ?? <StudioIntroReplay />}<Link href="/studio/templates"><LayoutTemplate size={14} aria-hidden="true" />Explore templates</Link></div>
  </div>
}
