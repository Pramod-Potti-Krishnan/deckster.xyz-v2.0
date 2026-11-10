import { useEffect } from 'react'
import '@/components/billing/studio-payments-open-soon.css'
import { installPaymentsOpenSoon, STUDIO_PAYMENTS_OPEN_SOON_ENABLED } from '@/lib/studio-payments-open-soon'

/**
 * NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON (exact "true", default off, build-time): the controls that would start a NEW payment (Billing's upgrade and credit-pack buttons, the account menu's
 * "Upgrade for more usage" row) say "Payments open soon" and do nothing. Billing and the account menu are held byte for byte by other changes' pins, so they are gated from here:
 * <html> gets data-studio-payments-soon="true" (the stylesheet is scoped to it), lib/studio-payments-open-soon.ts marks the controls with attributes (it never changes a text node or adds or removes
 * a node, which React would trip over on its next render), the stylesheet draws the line, and one capture-phase listener stops a click, Enter or Space on a marked control.
 * Off, the effect returns before it reads the document: nothing is set, observed or listened to.
 */
export function useStudioPaymentsOpenSoon(): void {
  useEffect(() => {
    if (!STUDIO_PAYMENTS_OPEN_SOON_ENABLED) return
    return installPaymentsOpenSoon(window)
  }, [])
}
