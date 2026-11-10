"use client"

import { useEffect, useState, type ReactElement } from 'react'
import { Portal } from '@radix-ui/react-tooltip'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import './studio-composer-hint.css'

interface StudioComposerHintProps {
  enabled: boolean
  label: string
  suppressed?: boolean
  children: ReactElement
}

/** Keep the original trigger and its handlers intact; OFF adds no tooltip. */
export function StudioComposerHint(props: StudioComposerHintProps) {
  return props.enabled ? <ComposerHint {...props} /> : props.children
}

function ComposerHint({ label, suppressed = false, children }: StudioComposerHintProps) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (suppressed) setOpen(false)
  }, [suppressed])

  return (
    <TooltipProvider delayDuration={80}>
      <Tooltip open={open && !suppressed} onOpenChange={next => setOpen(next && !suppressed)}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <Portal>
          <TooltipContent side="top" data-studio-composer-hint="true">{label}</TooltipContent>
        </Portal>
      </Tooltip>
    </TooltipProvider>
  )
}
