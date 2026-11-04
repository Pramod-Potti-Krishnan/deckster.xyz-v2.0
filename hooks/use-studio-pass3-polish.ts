import { useEffect } from 'react'
import '@/components/studio-pass3-polish/studio-pass3-polish.css'
import { installPass3Polish, STUDIO_PASS3_POLISH_ENABLED } from '@/lib/studio-pass3-polish'

/**
 * NEXT_PUBLIC_STUDIO_PASS3_POLISH (exact "true", default off, build-time): the Pass 3 polish set. While a Studio route is on screen <html> carries data-studio-pass3-polish="true", and the
 * stylesheet imported above (every rule scoped to that attribute, in numbered sections) is the whole of the change: no markup, no handler, no request, no stored value.
 * The Builder page calls this hook; the account pages get it from StudioPass3PolishMount (app/(app)/layout.tsx), which the layout draws only with the flag on.
 * Off, the effect returns before it reads the document: nothing is set, observed or listened to, and the stylesheet matches nothing.
 */
export function useStudioPass3Polish(): void {
  useEffect(() => {
    if (!STUDIO_PASS3_POLISH_ENABLED) return
    return installPass3Polish(document)
  }, [])
}
