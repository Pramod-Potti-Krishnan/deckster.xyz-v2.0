/**
 * Owner-route guard for published-deck Q&A.
 *
 * Seven routes let a signed-in user read questions asked on their deck, answer
 * them, and publish text under their own name. Every one of them needs the same
 * two checks, and getting either wrong on any single route exposes another
 * publisher's inbox. So they live here once rather than being retyped seven
 * times.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

export interface OwnedDeck {
  id: string
  slug: string
  userId: string
  title: string
  version: number
  revokedAt: Date | null
  qaEnabled: boolean
  qaCiteWebSources: boolean
  qaCorpusStatus: string
  qaCorpusVersion: number | null
  ownerName: string
}

/**
 * Resolve the deck and prove the caller owns it.
 *
 * A revoked deck is still owned: the owner must be able to read the questions
 * that came in before they unpublished, and to answer them. Public routes
 * reject revoked decks; owner routes do not.
 */
export async function requireDeckOwner(
  slug: string
): Promise<{ deck: OwnedDeck; userId: string; error?: undefined } | { error: NextResponse }> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const [user, deck] = await Promise.all([
    prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true },
    }),
    prisma.publishedDeck.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        userId: true,
        title: true,
        version: true,
        revokedAt: true,
        qaEnabled: true,
        qaCiteWebSources: true,
        qaCorpusStatus: true,
        qaCorpusVersion: true,
        user: { select: { name: true } },
      },
    }),
  ])

  if (!user) {
    return { error: NextResponse.json({ error: 'User not found' }, { status: 404 }) }
  }
  // Same 404 for "no such deck" and "not yours": a slug is a capability token,
  // and distinguishing the two would turn this route into an oracle that
  // confirms which slugs exist.
  if (!deck || deck.userId !== user.id) {
    return { error: NextResponse.json({ error: 'Published deck not found' }, { status: 404 }) }
  }

  return {
    userId: user.id,
    deck: {
      id: deck.id,
      slug: deck.slug,
      userId: deck.userId,
      title: deck.title,
      version: deck.version,
      revokedAt: deck.revokedAt,
      qaEnabled: deck.qaEnabled,
      qaCiteWebSources: deck.qaCiteWebSources,
      qaCorpusStatus: deck.qaCorpusStatus,
      qaCorpusVersion: deck.qaCorpusVersion,
      ownerName: deck.user?.name?.trim() || user.name?.trim() || 'the deck owner',
    },
  }
}

/**
 * Load a question that belongs to this deck.
 *
 * Scoped by BOTH id and deck: an id alone is a global key, so without the deck
 * clause an owner could answer or delete a question asked on somebody else's
 * deck by pasting its id into their own deck's URL.
 */
export async function findOwnedQuestion(deckId: string, questionId: string) {
  return prisma.deckQuestion.findFirst({
    where: { id: questionId, publishedDeckId: deckId },
  })
}

export async function findOwnedFaq(deckId: string, faqId: string) {
  return prisma.deckFaqItem.findFirst({
    where: { id: faqId, publishedDeckId: deckId },
  })
}

/** Bound free text from an owner form. Long enough for a real answer, short
 *  enough that the column is not an upload target. */
export function validateOwnerText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > maxLength) return null
  return trimmed
}
