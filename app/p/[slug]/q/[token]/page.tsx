import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { ArrowLeft, Check } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { unlockCookieName, verifyUnlockCookie } from '@/lib/publish/passcode'
import { hashFollowUpToken } from '@/lib/publish/qa-limits'
import { serializeThreadForAsker } from '@/lib/publish/qa-serialize'
import { PublishPasscodeGate } from '@/components/publish-passcode-gate'

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

  return (
    <div className="min-h-dvh bg-gray-100 px-4 py-10 dark:bg-slate-900">
      <div className="mx-auto max-w-2xl">
        <Link
          href={`/p/${slug}`}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {deck.title}
        </Link>

        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            You asked
          </p>
          <h1 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
            {thread.question}
          </h1>

          <div className="mt-5 border-t border-gray-100 pt-5 dark:border-slate-700">
            {thread.answer ? (
              <>
                <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                  {thread.answer}
                </p>

                {thread.citations.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {thread.citations.map((citation, index) => (
                      <li key={index}>
                        <a
                          href={
                            citation.kind === 'slide'
                              ? `/p/${slug}${citation.href?.split('#')[1] ? `#${citation.href.split('#')[1]}` : ''}`
                              : citation.href
                          }
                          {...(citation.kind === 'web'
                            ? { target: '_blank', rel: 'noopener noreferrer nofollow' }
                            : {})}
                          className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                        >
                          {citation.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}

                {thread.provenanceLine && (
                  <p className="mt-2 text-xs italic text-slate-500 dark:text-slate-400">
                    {thread.provenanceLine}
                  </p>
                )}

                {thread.answeredBy && (
                  <p className="mt-3 flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                    <Check className="h-3 w-3" />
                    Answered by {thread.answeredBy}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Waiting on {ownerName}. Keep this link — the answer will appear on this page.
              </p>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
          This page is private to you. Anyone with the link can read it, so treat it like a
          password.
        </p>
      </div>
    </div>
  )
}
