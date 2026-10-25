import { notFound, redirect } from 'next/navigation'
import { studioLegalShortLinkTarget, type StudioLegalShortLinkSearchParams } from '@/lib/studio-legal-short-links'

export const dynamic = 'force-dynamic'

// D16 a (NEXT_PUBLIC_STUDIO_LEGAL_SHORT_LINKS, default off): /terms is the short path `uat` redirects to /legal/terms (HTTP 307), carrying the request's own query string. Off: the not-found page, as for any unknown path.
export default async function TermsShortLink({ searchParams }: { searchParams: Promise<StudioLegalShortLinkSearchParams> }) {
  const target = studioLegalShortLinkTarget('terms', process.env.NEXT_PUBLIC_STUDIO_LEGAL_SHORT_LINKS, await searchParams)
  if (target === null) notFound()
  redirect(target)
}
