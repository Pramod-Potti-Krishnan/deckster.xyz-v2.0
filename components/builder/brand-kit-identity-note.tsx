"use client"

import { useStandardBrandKit } from "@/hooks/use-brand-kit"
import { brandKitIdentityOverride } from "@/lib/deck-identity"
import { BRAND_COPY, isStudioBrandKitEnabled } from "@/lib/studio-brand-kit"

// BRAND-KIT-CALLER (FRONTEND-1, Brand Kit, Studio caller half; BK-Q2 and FRONTEND-2's review of #624, finding 3): a line in the Presenter details dialog saying that the STANDARD theme's brand kit is in effect. A kit replaces the three browser
// fields on a new deck (whole record, as ruled), so a person who typed a confidentiality line here must not find it silently left off: this says it, and says what the deck takes instead. It reads what a build reads (the same standard theme, the same
// pure resolver), once per opening of the dialog, fails soft (no note when there is no kit, the read fails or the flag is off), and never changes what is stored: the browser fields are untouched and come back when the standard theme has no brand details.
// NEXT_PUBLIC_STUDIO_BRAND_KIT off: nothing is fetched and nothing is drawn.
export function BrandKitIdentityNote({ open }: { open: boolean }) {
  const kit = useStandardBrandKit(open && isStudioBrandKitEnabled())
  const override = brandKitIdentityOverride(kit)
  if (!open || !override) return null
  return (
    <p role="note" data-studio-deck-identity-note="true" data-studio-brand-kit-identity="true" className="text-xs">
      {BRAND_COPY.identityNote(override.company, override.confidentiality, Boolean(override.logoUrl))}
    </p>
  )
}
