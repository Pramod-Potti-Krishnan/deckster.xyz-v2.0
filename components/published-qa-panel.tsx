"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  ChevronDown,
  Clock,
  Copy,
  Loader2,
  MessageCircleQuestion,
  Send,
  X,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { readThreads, rememberThread, type ThreadEntry } from '@/lib/publish/qa-threads'

export interface PublicCitationView {
  kind: 'slide' | 'web'
  label: string
  slideNumber?: number
  href?: string
  quote?: string
}

export interface FaqItemView {
  id: string
  question: string
  answer: string
  citations: PublicCitationView[]
  provenanceLine: string | null
  approvedBy: string
  approvedAt: string
}

interface ThreadView {
  id: string
  question: string
  status: string
  answer: string | null
  answeredBy: string | null
  citations: PublicCitationView[]
  provenanceLine: string | null
  awaitingOwner: boolean
  deferReason: string | null
  askedAt: string
  answeredAt: string | null
}

interface PublishedQaPanelProps {
  slug: string
  ownerName: string
  /** SSR'd so the FAQ is readable before any JavaScript runs a fetch. */
  initialFaq: FaqItemView[]
  /** Q&A can be off while the FAQ stays readable — answers already published
   *  are not retracted by closing the live endpoint. */
  qaEnabled: boolean
  open: boolean
  onClose: () => void
  /** Jump the deck behind the panel to a cited slide (1-based). */
  onCiteSlide: (slideNumber: number) => void
}

const MAX_QUESTION_LENGTH = 500

/** Which answered threads this browser has already looked at. Kept separate
 *  from the server's `askerSeenAt`, which is set by the act of reading and so
 *  cannot itself drive an unread badge. */
function seenKey(slug: string) {
  return `dq_seen_${slug}`
}

function readSeen(slug: string): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(seenKey(slug))
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function writeSeen(slug: string, tokens: Set<string>) {
  try {
    window.localStorage.setItem(seenKey(slug), JSON.stringify([...tokens]))
  } catch {
    // Private browsing or a full quota. The badge is a nicety; losing it is fine.
  }
}

/**
 * Count of answered-but-unlooked-at threads, for the header badge.
 *
 * Exported so the viewer can show the dot without mounting the panel.
 */
export function useUnreadThreadCount(slug: string, enabled: boolean): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!enabled) return
    const entries = readThreads(slug)
    if (entries.length === 0) return
    let cancelled = false

    ;(async () => {
      const seen = readSeen(slug)
      const results = await Promise.all(
        entries
          .filter((entry) => !seen.has(entry.token))
          .map((entry) => fetchThread(slug, entry.token).catch(() => null))
      )
      if (cancelled) return
      setCount(results.filter((thread) => thread && !thread.awaitingOwner && thread.answer).length)
    })()

    return () => {
      cancelled = true
    }
  }, [slug, enabled])

  return count
}

async function fetchThread(slug: string, token: string): Promise<ThreadView | null> {
  const response = await fetch(`/api/publish/${slug}/thread/${encodeURIComponent(token)}`)
  if (!response.ok) return null
  const data = await response.json()
  return (data?.thread ?? null) as ThreadView | null
}

export function PublishedQaPanel({
  slug,
  ownerName,
  initialFaq,
  qaEnabled,
  open,
  onClose,
  onCiteSlide,
}: PublishedQaPanelProps) {
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [threads, setThreads] = useState<ThreadView[]>([])
  const [loadingThreads, setLoadingThreads] = useState(false)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [openFaqId, setOpenFaqId] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const entriesRef = useRef<ThreadEntry[]>([])

  const faq = initialFaq

  const loadThreads = useCallback(async () => {
    const entries = readThreads(slug)
    entriesRef.current = entries
    if (entries.length === 0) {
      setThreads([])
      return
    }
    setLoadingThreads(true)
    const results = await Promise.all(
      entries.map((entry) => fetchThread(slug, entry.token).catch(() => null))
    )
    // Newest first, and drop any thread whose deck-side row has gone (the owner
    // deleted the question) rather than showing a broken entry.
    setThreads(results.filter((thread): thread is ThreadView => !!thread).reverse())
    setLoadingThreads(false)
  }, [slug])

  useEffect(() => {
    if (!open) return
    loadThreads()
    inputRef.current?.focus()
  }, [open, loadThreads])

  // Opening the panel is "looking at it" — clear the badge for everything the
  // owner has answered by now.
  useEffect(() => {
    if (!open || threads.length === 0) return
    const seen = readSeen(slug)
    for (const entry of entriesRef.current) seen.add(entry.token)
    writeSeen(slug, seen)
  }, [open, threads.length, slug])

  const remaining = MAX_QUESTION_LENGTH - question.length
  const canSubmit = question.trim().length >= 3 && !asking && qaEnabled

  const handleAsk = useCallback(async () => {
    const text = question.trim()
    if (text.length < 3) return
    setAsking(true)
    setError(null)
    try {
      const response = await fetch(`/api/publish/${slug}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(data?.error || 'That question could not be sent. Try again shortly.')
        return
      }

      // Record the follow-up token BEFORE anything else can fail: for an
      // anonymous asker it is the only route back to the answer.
      if (data?.followUp?.token) {
        rememberThread(slug, {
          token: data.followUp.token,
          questionId: data.followUp.questionId,
          askedAt: new Date().toISOString(),
        })
      }
      setQuestion('')
      await loadThreads()
    } catch {
      setError('That question could not be sent. Check your connection and try again.')
    } finally {
      setAsking(false)
    }
  }, [question, slug, loadThreads])

  const handleCopyLink = useCallback((token: string) => {
    const url = `${window.location.origin}/p/${slug}/q/${token}`
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopiedToken(token)
        setTimeout(() => setCopiedToken(null), 2000)
      },
      () => {}
    )
  }, [slug])

  const threadTokens = useMemo(
    () => new Map(entriesRef.current.map((entry) => [entry.questionId, entry.token])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [threads]
  )

  if (!open) return null

  return (
    <aside
      // On mobile the panel is a bottom sheet, capped at 55dvh so the deck
      // above it stays visible — without the cap it takes the whole column and
      // a citation would scroll a slide the reader cannot see, which is the one
      // thing this panel is laid out to avoid.
      className="flex max-h-[55dvh] w-full flex-shrink-0 flex-col border-t border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800 md:max-h-none md:h-full md:w-[380px] md:border-l md:border-t-0"
      aria-label="Questions and answers"
    >
      <header className="flex h-12 flex-shrink-0 items-center justify-between border-b border-gray-200 px-4 dark:border-slate-700">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <MessageCircleQuestion className="h-4 w-4" />
          <span>Questions</span>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
        {faq.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Answered by {ownerName}
            </h2>
            <ul className="space-y-1">
              {faq.map((item) => (
                <li
                  key={item.id}
                  className="rounded-md border border-gray-200 dark:border-slate-700"
                >
                  <button
                    onClick={() => setOpenFaqId(openFaqId === item.id ? null : item.id)}
                    className="flex w-full items-start justify-between gap-2 px-3 py-2 text-left text-sm text-slate-800 dark:text-slate-200"
                    aria-expanded={openFaqId === item.id}
                  >
                    <span className="flex-1">{item.question}</span>
                    <ChevronDown
                      className={`mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400 transition-transform ${
                        openFaqId === item.id ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {openFaqId === item.id && (
                    <div className="border-t border-gray-100 px-3 py-2.5 dark:border-slate-700">
                      <AnswerBody text={item.answer} />
                      <Citations citations={item.citations} onCiteSlide={onCiteSlide} />
                      {item.provenanceLine && <Provenance line={item.provenanceLine} />}
                      {/* The one place a human's name appears — a person approved this text. */}
                      <p className="mt-2 flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                        <Check className="h-3 w-3" />
                        Reviewed by {item.approvedBy}
                      </p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {(threads.length > 0 || loadingThreads) && (
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Your questions
            </h2>
            {loadingThreads && threads.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </p>
            ) : (
              <ul className="space-y-3">
                {threads.map((thread) => (
                  <li key={thread.id}>
                    <QaExchange question={thread.question}>
                    {thread.answer ? (
                      <>
                        <AnswerBody text={thread.answer} />
                        <Citations citations={thread.citations} onCiteSlide={onCiteSlide} />
                        {thread.provenanceLine && <Provenance line={thread.provenanceLine} />}
                        {thread.answeredBy && (
                          <p className="mt-2.5 flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                            <Check className="h-3 w-3" />
                            Answered by {thread.answeredBy}
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="space-y-1.5">
                        {/* Deliberately NOT a spinner. A defer is a decision,
                            not work in progress — a spinner made a finished
                            answer look like a hung request. */}
                        <p className="flex items-start gap-1.5 text-[13px] text-slate-600 dark:text-slate-300">
                          <Clock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                          <span>
                            {thread.deferReason || 'This one needs a person.'}{' '}
                            <span className="text-slate-500 dark:text-slate-400">
                              Passed to {ownerName} — their answer appears here.
                            </span>
                          </span>
                        </p>
                      </div>
                    )}

                    {thread.awaitingOwner && (
                      <div className="mt-2.5 border-t border-gray-100 pt-2.5 dark:border-slate-700">
                        {/* Stated plainly rather than reassuringly: without this
                            link the thread really is unreachable, and that is the
                            price of not asking for an email. */}
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Bookmark this link — {ownerName}&apos;s answer appears here. Clear your
                          cookies without it and this thread is lost.
                        </p>
                        {threadTokens.get(thread.id) && (
                          <button
                            onClick={() => handleCopyLink(threadTokens.get(thread.id)!)}
                            className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-2 py-1 text-xs text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                          >
                            {copiedToken === threadTokens.get(thread.id) ? (
                              <>
                                <Check className="h-3 w-3" /> Copied
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" /> Copy my link
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    )}
                    </QaExchange>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {faq.length === 0 && threads.length === 0 && !loadingThreads && qaEnabled && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ask anything about this deck. Answers come from the deck and {ownerName}&apos;s
            research; anything else goes to {ownerName}.
          </p>
        )}
      </div>

      {qaEnabled ? (
        <div className="flex-shrink-0 border-t border-gray-200 p-3 dark:border-slate-700">
          {error && (
            <p className="mb-2 text-xs text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
          <textarea
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value.slice(0, MAX_QUESTION_LENGTH))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (canSubmit) handleAsk()
              }
            }}
            rows={2}
            placeholder={`Ask about this deck…`}
            disabled={asking}
            className="w-full resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
          <div className="mt-2 flex items-center justify-between">
            <span
              className={`text-xs ${
                remaining < 50 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'
              }`}
            >
              {remaining < 50 ? `${remaining} left` : 'Enter to send'}
            </span>
            <button
              onClick={handleAsk}
              disabled={!canSubmit}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {asking ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Asking…
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" /> Ask
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-shrink-0 border-t border-gray-200 p-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {ownerName} has turned off new questions on this deck.
        </div>
      )}
    </aside>
  )
}

/**
 * A generated answer, rendered.
 *
 * Markdown is enabled deliberately but NARROWLY. Researcher's prompt asks for a
 * lead sentence plus an optional short list — nothing else — so only those
 * elements are mapped. Anything the model emits outside that set (headings,
 * tables, images, raw HTML) degrades to plain text rather than rendering,
 * because this string is model output displayed under a publisher's deck and
 * the safe failure is "looks plain", never "renders something unexpected".
 *
 * Links are NOT rendered as anchors. Citations are the only sanctioned way for
 * an answer to point somewhere, and they go through the tiering boundary; an
 * inline link would route around it.
 */
export function AnswerBody({ text }: { text: string }) {
  return (
    <div className="text-[13px] leading-[1.65] text-slate-700 dark:text-slate-300">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ node, ...props }) => <p {...props} className="mb-2 last:mb-0" />,
          strong: ({ node, ...props }) => (
            <strong {...props} className="font-semibold text-slate-900 dark:text-slate-100" />
          ),
          em: ({ node, ...props }) => <em {...props} className="italic" />,
          ul: ({ node, ...props }) => (
            <ul {...props} className="my-2 space-y-1.5 list-none pl-0" />
          ),
          ol: ({ node, ...props }) => (
            <ol {...props} className="my-2 space-y-1.5 list-decimal pl-4 marker:text-slate-400" />
          ),
          li: ({ node, children, ...props }) => (
            <li {...props} className="relative pl-4 leading-[1.6] last:mb-0">
              {/* Own bullet rather than list-disc: a square reads as structure
                  instead of a second voice, and stays aligned with wrapped text. */}
              <span
                aria-hidden
                className="absolute left-0 top-[0.55em] h-1 w-1 rounded-[1px] bg-indigo-400 dark:bg-indigo-500"
              />
              {children}
            </li>
          ),
          // Everything below is deliberately flattened.
          h1: ({ node, ...props }) => <p {...props} className="mb-2 font-semibold" />,
          h2: ({ node, ...props }) => <p {...props} className="mb-2 font-semibold" />,
          h3: ({ node, ...props }) => <p {...props} className="mb-2 font-semibold" />,
          a: ({ node, children, ...props }) => <span {...props}>{children}</span>,
          code: ({ node, ...props }) => (
            <code {...props} className="rounded bg-slate-100 px-1 py-0.5 text-[12px] dark:bg-slate-700" />
          ),
          blockquote: ({ node, children }) => <p className="mb-2">{children}</p>,
          table: ({ node, children }) => <div>{children}</div>,
          img: () => null,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}

/**
 * One question and its answer, presented as an exchange.
 *
 * The asker's question is set apart and attributed ("You asked") rather than
 * styled as a chat bubble. A bubble implies a conversation with a persona; this
 * is a deck answering about itself, and the flatter treatment keeps the
 * publisher's material the loudest thing on screen.
 */
function QaExchange({
  question,
  children,
}: {
  question: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800/40">
      <div className="border-b border-gray-100 px-3.5 py-2.5 dark:border-slate-700">
        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          You asked
        </p>
        <p className="text-[13px] font-medium leading-snug text-slate-900 dark:text-slate-100">
          {question}
        </p>
      </div>
      <div className="px-3.5 py-3">{children}</div>
    </div>
  )
}

/**
 * Cited slides are clickable and move the deck behind the panel — which only
 * works because the panel narrows the stage instead of covering it.
 */
function Citations({
  citations,
  onCiteSlide,
}: {
  citations: PublicCitationView[]
  onCiteSlide: (slideNumber: number) => void
}) {
  if (citations.length === 0) return null
  return (
    <ul className="mt-3 flex flex-wrap items-start gap-1.5 border-t border-gray-100 pt-2.5 dark:border-slate-700">
      {citations.map((citation, index) =>
        citation.kind === 'slide' && citation.slideNumber ? (
          <li key={index}>
            <button
              onClick={() => onCiteSlide(citation.slideNumber!)}
              className="rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-left text-[11px] leading-snug text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
              title="Go to this slide"
            >
              {citation.label}
            </button>
          </li>
        ) : (
          <li key={index}>
            <a
              href={citation.href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="rounded border border-gray-200 px-2 py-1 text-left text-[11px] leading-snug text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {citation.label}
            </a>
          </li>
        )
      )}
    </ul>
  )
}

/**
 * The non-naming provenance line. It exists so an answer grounded in material
 * the audience cannot see still says so — without naming the file, which would
 * leak the existence and title of a private document.
 */
function Provenance({ line }: { line: string }) {
  return <p className="mt-1.5 text-xs italic text-slate-500 dark:text-slate-400">{line}</p>
}
