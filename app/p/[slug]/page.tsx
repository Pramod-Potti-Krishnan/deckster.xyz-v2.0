import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { unlockCookieName, verifyUnlockCookie } from '@/lib/publish/passcode'
import { PublishedViewer } from '@/components/published-viewer'
import { PublishPasscodeGate } from '@/components/publish-passcode-gate'

import { getPublicLayoutBaseUrl } from '@/lib/publish/service-urls'

// Slug resolution reads the database — never prerender/cache this page
export const dynamic = 'force-dynamic'

interface PublishedDeckPageProps {
  params: Promise<{ slug: string }>
}

async function loadDeck(slug: string) {
  const deck = await prisma.publishedDeck.findUnique({ where: { slug } })
  if (!deck || deck.revokedAt) return null
  return deck
}

export async function generateMetadata({ params }: PublishedDeckPageProps): Promise<Metadata> {
  const { slug } = await params
  const deck = await loadDeck(slug)
  if (!deck) {
    return {
      title: 'Presentation not found — Deckster',
      robots: { index: false, follow: false },
    }
  }
  return {
    title: `${deck.title} — Deckster`,
    description: `${deck.slideCount} slides · Published with Deckster`,
    // Only owner-designated public decks are indexable
    ...(deck.visibility === 'public' ? {} : { robots: { index: false, follow: false } }),
  }
}

export default async function PublishedDeckPage({ params }: PublishedDeckPageProps) {
  const { slug } = await params
  const deck = await loadDeck(slug)
  if (!deck) notFound()

  // Restricted decks require the passcode-unlock cookie for this slug
  if (deck.visibility === 'restricted') {
    const cookieStore = await cookies()
    const unlockCookie = cookieStore.get(unlockCookieName(slug))?.value
    if (!verifyUnlockCookie(slug, deck.passcodeHash ?? '', unlockCookie)) {
      return <PublishPasscodeGate slug={slug} title={deck.title} />
    }
  }

  // Fire-and-forget view counter — rendering never waits on (or fails with) it
  prisma.publishedDeck
    .update({ where: { id: deck.id }, data: { viewCount: { increment: 1 } } })
    .catch(() => {})

  return (
    <PublishedViewer
      title={deck.title}
      slug={deck.slug}
      layoutBaseUrl={getPublicLayoutBaseUrl()}
      snapshotPresentationId={deck.snapshotPresentationId}
      slideCount={deck.slideCount}
      allowPdf={deck.allowPdf}
      allowPptx={deck.allowPptx}
    />
  )
}
