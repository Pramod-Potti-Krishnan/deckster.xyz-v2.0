import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { unlockCookieName, verifyUnlockCookie } from '@/lib/publish/passcode'
import { hashFollowUpToken } from '@/lib/publish/qa-limits'
import { serializeThreadForAsker } from '@/lib/publish/qa-serialize'
import { PublishPasscodeGate } from '@/components/publish-passcode-gate'
import { PublishedQuestionView } from '@/components/published-question-view'

export const dynamic = 'force-dynamic'

interface ThreadPageProps {
  params: Promise<{ slug: string; token: string }>
}

/**
 * The bookmarkable thread page.
 *
 * This URL is the whole reason an anonymous asker can be told "the answer will
 * appear here" without being asked for an email. It is a bearer capability, so
 * it is never indexed and the token never appears in the page metadata.
 */
export const metadata: Metadata = {
  title: 'Your question — Deckster',
  robots: { index: false, follow: false },
}

export default async function ThreadPage({ params }: ThreadPageProps) {
  const { slug, token } = await params

  const deck = await prisma.publishedDeck.findUnique({
    where: { slug },
    include: { user: { select: { name: true } } },
  })
  if (!deck || deck.revokedAt) notFound()

  if (deck.visibility === 'restricted') {
    const cookieStore = await cookies()
    const unlockCookie = cookieStore.get(unlockCookieName(slug))?.value
    if (!verifyUnlockCookie(slug, deck.passcodeHash ?? '', unlockCookie)) {
      return <PublishPasscodeGate slug={slug} title={deck.title} />
    }
  }

  // Scoped by BOTH the token hash and the deck: a token from one deck must not
  // resolve on another's slug.
  const question = await prisma.deckQuestion.findUnique({
    where: { askerTokenHash: hashFollowUpToken(token) },
  })
  if (!question || question.publishedDeckId !== deck.id) notFound()

  const ownerName = deck.user?.name?.trim() || 'the deck owner'
  const thread = serializeThreadForAsker(question, {
    slug,
    citeWebSources: deck.qaCiteWebSources,
    ownerName,
  })

  // Read receipt for the owner. Never worth failing the page for.
  if (!question.askerSeenAt) {
    prisma.deckQuestion
      .update({ where: { id: question.id }, data: { askerSeenAt: new Date() } })
      .catch(() => {})
  }

  return <PublishedQuestionView slug={slug} title={deck.title} ownerName={ownerName} thread={thread} />
}
