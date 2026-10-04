"use client"

import Link from 'next/link'
import { Layers, MessageSquare, Layout, Share2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { StudioIntroReplay } from '@/components/studio-intro-replay'
import './studio-about-dialog.css'

export function StudioAboutDialog({ open, onOpenChange, onCloseAutoFocus }: { open: boolean; onOpenChange: (open: boolean) => void; onCloseAutoFocus?: (event: Event) => void }) {
  if (process.env.NEXT_PUBLIC_STUDIO_V4_SHELL !== 'true') return null
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent data-studio-v4-shell="true" data-studio-about="true" onCloseAutoFocus={onCloseAutoFocus}>
      <DialogHeader><span className="sa-eyebrow"><Layers size={16} aria-hidden="true" /> DECKSTER STUDIO</span><DialogTitle>Make your next idea clear.</DialogTitle><DialogDescription className="sa-description">Your brief, slides, reusable library and sharing tools in one workspace.</DialogDescription></DialogHeader>
      <div className="sa-body">
        <div className="sa-capabilities">
          <article><MessageSquare size={19} aria-hidden="true" /><h3>Start a conversation</h3><p>Work through your brief and answer Director’s questions in Chat.</p></article>
          <article><Layout size={19} aria-hidden="true" /><h3>Shape the story</h3><p>Review slides on the canvas and work with the selected content in the Inspector.</p></article>
          <article><Share2 size={19} aria-hidden="true" /><h3>Prepare to share</h3><p>Review script, notes and references, then choose the available delivery actions.</p></article>
        </div>
        <p className="sa-note">Available tools depend on your current deck and account. The introduction is a manual guide; replaying it keeps your work intact.</p>
      </div>
      <div className="sa-actions"><StudioIntroReplay /><Link href="/help">Help</Link><button type="button" onClick={() => onOpenChange(false)}>Back to my work</button></div>
    </DialogContent>
  </Dialog>
}
