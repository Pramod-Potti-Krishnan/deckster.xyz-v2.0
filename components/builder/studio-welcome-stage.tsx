"use client"

import { Layers, Sparkles, LayoutTemplate } from 'lucide-react'
import Link from 'next/link'
import { StudioIntroReplay } from '@/components/studio-intro-replay'

/** A static first-entry specimen; the real Layout iframe owns authored slides. */
export function StudioWelcomeStage() {
  return <div className="studio-welcome-stage" role="region" aria-label="Your presentation stage">
    <div className="studio-welcome-label"><Layers size={14} aria-hidden="true" /><span>Your story starts here</span></div>
    <div className="studio-welcome-slide" aria-label="Empty presentation placeholder">
      <div className="studio-welcome-rule" /><span className="studio-welcome-eyebrow">A CLEAR IDEA. A COMPELLING STORY.</span>
      <h2>Make something<br /><em>worth presenting.</em></h2>
      <p>Tell Director who it’s for and what you want to say.<br />Your presentation will take shape on this stage.</p>
      <div className="studio-welcome-slide-bottom"><span>DECKSTER STUDIO</span><span>01</span></div>
    </div>
    <div className="studio-welcome-caption"><span><Sparkles size={14} aria-hidden="true" /> Start with a conversation</span><StudioIntroReplay /><Link href="/studio/templates"><LayoutTemplate size={14} aria-hidden="true" />Explore templates</Link></div>
  </div>
}
