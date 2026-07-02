"use client"

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useTemplates } from '@/hooks/use-templates'

interface TemplateSaveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The WS session whose agreed deck Director will snapshot (source_session_id). */
  sessionId: string | null
  /** The session that produced the currently displayed deck URLs. */
  deckOwnerSessionId?: string | null
  /** The built presentation currently owned by that session. */
  sourcePresentationId?: string | null
}

/**
 * "Save as Template" dialog. Captures a name and asks Director to freeze the
 * current deck's design (structure + theme, content → typed slots) for reuse.
 * Director builds the snapshot from the session's strawman + the frozen plans
 * captured during the build. See TEMPLATE_PLAN.md §1/§3.
 */
export function TemplateSaveDialog({
  open,
  onOpenChange,
  sessionId,
  deckOwnerSessionId,
  sourcePresentationId,
}: TemplateSaveDialogProps) {
  const { toast } = useToast()
  const { saveTemplate, loading } = useTemplates()
  const [name, setName] = useState('')

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast({ title: 'Name required', description: 'Give your template a name.', variant: 'destructive' })
      return
    }
    if (!sessionId) {
      toast({ title: 'No deck to save', description: 'Build and agree a deck first.', variant: 'destructive' })
      return
    }
    if (!sourcePresentationId) {
      toast({ title: 'No completed deck to save', description: 'Build a deck before saving a template.', variant: 'destructive' })
      return
    }
    if (!deckOwnerSessionId || deckOwnerSessionId !== sessionId) {
      toast({
        title: 'Deck/session mismatch',
        description: 'Refresh this session before saving the deck as a template.',
        variant: 'destructive',
      })
      return
    }
    const result = await saveTemplate({
      name: trimmed,
      sourceSessionId: sessionId,
      sourcePresentationId,
    })
    if (result) {
      toast({
        title: 'Template saved',
        description: `"${result.name}" (${result.slide_count} slides) is ready to reuse.`,
      })
      setName('')
      onOpenChange(false)
    } else {
      toast({
        title: 'Could not save template',
        description: 'The deck may not be finished yet, or the service is unreachable.',
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save as Template</DialogTitle>
          <DialogDescription>
            Lock this deck&apos;s structure, layout and theme so you can reuse it later
            with fresh content. The content is replaced by typed slots — nothing you typed
            is stored as-is.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="template-name">Template name</Label>
          <Input
            id="template-name"
            placeholder="e.g. Monthly Revenue Report"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleSave() }}
            autoFocus
            disabled={loading}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={loading || !name.trim() || !sessionId || !sourcePresentationId || deckOwnerSessionId !== sessionId}
          >
            {loading ? 'Saving…' : 'Save Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
