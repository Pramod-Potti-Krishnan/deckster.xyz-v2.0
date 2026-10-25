import { notFound, redirect } from 'next/navigation'
import { studioLegalShortLinkTarget } from '@/lib/studio-legal-short-links'

export const dynamic = 'force-dynamic'

// D16 a (NEXT_PUBLIC_STUDIO_LEGAL_SHORT_LINKS, default off): /privacy is the short path `uat` redirects to /legal/privacy (HTTP 307). Off: the not-found page, as for any unknown path.
export default function PrivacyShortLink() {
  const target = studioLegalShortLinkTarget('privacy', process.env.NEXT_PUBLIC_STUDIO_LEGAL_SHORT_LINKS)
  if (target === null) notFound()
  redirect(target)
}
