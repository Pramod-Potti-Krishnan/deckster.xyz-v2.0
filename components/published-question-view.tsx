import Link from 'next/link'
import { ArrowLeft, Check } from 'lucide-react'
import type { serializeThreadForAsker } from '@/lib/publish/qa-serialize'
import './studio-published-viewer.css'

const STUDIO_PUBLISHED = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'

interface PublishedQuestionViewProps {
  slug: string
  title: string
  ownerName: string
  thread: Pick<ReturnType<typeof serializeThreadForAsker>, 'question' | 'answer' | 'citations' | 'provenanceLine' | 'answeredBy'>
}

/** Display only: the public route owns access, token resolution and read receipts. */
export function PublishedQuestionView({ slug, title, ownerName, thread }: PublishedQuestionViewProps) {
  return (
    <div className="min-h-dvh bg-gray-100 px-4 py-10 dark:bg-slate-900" data-studio-v4-shell={STUDIO_PUBLISHED} data-studio-published-thread={STUDIO_PUBLISHED}>
      <div className="studio-published-thread-wrap mx-auto max-w-2xl">
        <Link
          href={`/p/${slug}`}
          className="studio-published-thread-back mb-6 inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {title}
        </Link>

        <div className="studio-published-thread-card rounded-lg border border-gray-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
          <p className="studio-published-thread-eyebrow text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            You asked
          </p>
          <h1 className="studio-published-thread-question mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
            {thread.question}
          </h1>

          <div className="studio-published-thread-answer mt-5 border-t border-gray-100 pt-5 dark:border-slate-700">
            {thread.answer ? (
              <>
                <p className="studio-published-thread-copy whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                  {thread.answer}
                </p>

                {thread.citations.length > 0 && (
                  <ul className="studio-published-thread-citations mt-3 flex flex-wrap gap-1.5">
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
                  <p className="studio-published-thread-provenance mt-2 text-xs italic text-slate-500 dark:text-slate-400">
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
              <p className="studio-published-thread-pending text-sm text-slate-500 dark:text-slate-400">
                Waiting on {ownerName}. Keep this link — the answer will appear on this page.
              </p>
            )}
          </div>
        </div>

        <p className="studio-published-thread-private mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
          This page is private to you. Anyone with the link can read it, so treat it like a
          password.
        </p>
      </div>
    </div>
  )
}
