"use client"

/**
 * Asking during a presentation.
 *
 * Two ways to ask, and they are genuinely different experiences rather than one
 * experience with a setting:
 *
 *   **In writing** — the answer appears in this panel and the presenter never
 *   stops. You asked a side question; you get a side answer. Nothing is
 *   interrupted, nothing is spoken, and the deck carries straight on.
 *
 *   **From the presenter** — the presenter finishes the slide they are on,
 *   pauses, and answers out loud. The question is sent the MOMENT you submit it,
 *   so the rest of the slide is spent working on the answer rather than making
 *   you wait for it afterwards.
 *
 * The rule that shapes the second one: **nothing about the answer appears until
 * the presenter has said it.** Putting the written answer on screen while they
 * are still talking asks someone to read and listen at once, and they will do
 * neither. The text arrives when the speaking ends, as the detail behind what
 * was just said.
 *
 * It sits on the RIGHT, narrow, over the deck — not centred. A question is an
 * aside; a modal in the middle of the slide says the presentation has stopped
 * for it, which in the written case is not even true.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, MessageCircleQuestion, Send, X } from 'lucide-react'
import { AnswerBody } from '@/components/published-qa-panel'
import { rememberThread } from '@/lib/publish/qa-threads'

export type AskMode = 'written' | 'presenter'

interface Citation {
  label: string
  slideNumber?: number | null
}

export interface AskedQuestion {
  question: string
  questionId: string | null
  answer: string | null
  deferred: boolean
  deferMessage: string | null
  citations: Citation[]
  provenanceLine: string | null
  mode: AskMode
}

interface Props {
  slug: string
  open: boolean
  onClose: () => void
  /** Handed to the presenter, who says it at the end of the current slide. */
  onQueueForPresenter: (asked: AskedQuestion) => void
  onCiteSlide: (slideNumber: number) => void
  /** False when the deck's voice is too slow to answer aloud — the choice is
   *  then not offered at all, rather than offered and disappointing. */
  canSpeak: boolean
  /** The question the presenter is speaking right now, or has finished. Drives
   *  when the written detail is allowed to appear. */
  speakingAnswerId: string | null
  spokenAnswerIds: string[]
  /** The deck has finished and the reserve time is running. Questions are
   *  answered immediately, because there is no slide left to wait for. */
  questionTime?: boolean
}

export function PresenterQuestion({
  slug,
  open,
  onClose,
  onQueueForPresenter,
  onCiteSlide,
  canSpeak,
  speakingAnswerId,
  spokenAnswerIds,
  questionTime,
}: Props) {
  const [question, setQuestion] = useState('')
  const [mode, setMode] = useState<AskMode>('written')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // ONE question, not a thread. Asking during a presentation is a single act:
  // you have a question, you ask it, and you wait for it to be dealt with. A
  // running chat invites a conversation the presenter is not having.
  const [asked, setAsked] = useState<AskedQuestion | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const submit = useCallback(async () => {
    const text = question.trim()
    if (text.length < 3) return
    const asking = mode
    setSending(true)
    setError(null)
    setQuestion('')
    try {
      const response = await fetch(`/api/publish/${slug}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.error || 'That question could not be sent.')

      // The same browser-side thread the written panel reads, so a question
      // asked mid-presentation is still in the record afterwards — and for a
      // deferred one it is the only route back to the owner's eventual reply.
      if (data?.followUp?.token) {
        rememberThread(slug, {
          token: data.followUp.token,
          questionId: data.followUp.questionId,
          askedAt: new Date().toISOString(),
        })
      }

      const next: AskedQuestion = {
        question: text,
        questionId: typeof data?.followUp?.questionId === 'string' ? data.followUp.questionId : null,
        answer: typeof data.answer === 'string' ? data.answer : null,
        deferred: data.status === 'deferred',
        deferMessage: typeof data.message === 'string' ? data.message : null,
        citations: Array.isArray(data.citations) ? data.citations : [],
        provenanceLine: data.provenanceLine ?? null,
        mode: asking,
      }

      setAsked(next)
      // In question time every answer is spoken: the deck has stopped, the time
      // was reserved for this, and offering a "written only" option would be
      // offering to stay silent during the one part of the session that exists
      // for talking.
      if ((questionTime || asking === 'presenter') && next.answer) onQueueForPresenter(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That question could not be sent.')
    } finally {
      setSending(false)
    }
  }, [question, mode, slug, onQueueForPresenter, questionTime])

  if (!open) return null

  return (
    <aside
      className="pointer-events-auto absolute right-3 top-3 flex w-full max-w-sm flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      style={{ maxHeight: 'calc(100% - 1.5rem)' }}
    >
      <header className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-3 py-2 dark:border-slate-700">
        <p className="flex items-center gap-1.5 text-sm font-medium text-slate-900 dark:text-slate-100">
          <MessageCircleQuestion className="h-4 w-4 text-slate-400" />
          {questionTime ? 'Questions' : 'Ask a question'}
        </p>
        <button
          onClick={onClose}
          aria-label="Close"
          className="rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {asked && (
        <div className="min-h-0 overflow-y-auto px-3 py-2.5">
          {(() => {
            // A spoken answer reveals nothing until it has been said. Reading and
            // listening at once means doing neither.
            const speaking = asked.mode === 'presenter' && speakingAnswerId === asked.questionId
            const alreadySpoken =
              asked.mode !== 'presenter' ||
              (asked.questionId !== null && spokenAnswerIds.includes(asked.questionId))
            const hidden = asked.mode === 'presenter' && !alreadySpoken

            return (
              <>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">You asked</p>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                  {asked.question}
                </p>

                {asked.mode === 'presenter' && !asked.answer && !asked.deferred && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                    <Loader2 className="h-3 w-3 animate-spin" /> Working on it…
                  </p>
                )}
                {speaking && (
                  <p className="mt-1.5 text-xs text-indigo-600 dark:text-indigo-400">
                    The presenter is answering this now…
                  </p>
                )}
                {hidden && !speaking && asked.answer && (
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                    Ready — the presenter answers at the end of this slide.
                  </p>
                )}

                {/* Markdown, not raw text. The answer prompt asks for short lists
                    and bold labels, and rendering them literally put ** and - on
                    the screen. */}
                {asked.answer && !hidden && (
                  <div className="mt-1.5">
                    <AnswerBody text={asked.answer} />
                  </div>
                )}

                {asked.deferred && (
                  <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">
                    {asked.deferMessage ?? 'That one needs a person — it has been passed on.'}
                  </p>
                )}

                {asked.citations.length > 0 && !hidden && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {asked.citations.map((citation, c) => (
                      <button
                        key={`${citation.label}-${c}`}
                        onClick={() =>
                          citation.slideNumber ? onCiteSlide(citation.slideNumber) : undefined
                        }
                        disabled={!citation.slideNumber}
                        className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] text-indigo-700 disabled:cursor-default dark:bg-indigo-950 dark:text-indigo-300"
                      >
                        {citation.label}
                      </button>
                    ))}
                  </div>
                )}
                {asked.provenanceLine && !hidden && (
                  <p className="mt-1 text-[11px] italic text-slate-500">{asked.provenanceLine}</p>
                )}

                {/* Done with this one. Asking again is a deliberate act, not the
                    next line of a chat. */}
                {(asked.answer && !hidden) || asked.deferred ? (
                  <button
                    onClick={() => setAsked(null)}
                    className="mt-2 text-xs text-indigo-600 underline dark:text-indigo-400"
                  >
                    Ask something else
                  </button>
                ) : null}
              </>
            )
          })()}
        </div>
      )}

      {!asked && (
      <div className="flex-shrink-0 space-y-2 border-t border-gray-200 px-3 py-2.5 dark:border-slate-700">
        {/* The choice comes BEFORE the question, because it changes what asking
            means — one interrupts the presentation and one does not. */}
        {canSpeak && !questionTime && (
          <div className="flex gap-1 rounded-md bg-slate-100 p-0.5 text-xs dark:bg-slate-800">
            {(
              [
                ['written', 'Answer in writing'],
                ['presenter', 'Ask the presenter'],
              ] as [AskMode, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setMode(value)}
                className={`flex-1 rounded px-2 py-1 transition-colors ${
                  mode === value
                    ? 'bg-white font-medium text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                    : 'text-slate-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {questionTime
            ? 'The deck is finished — ask anything and it answers straight away.'
            : mode === 'written' || !canSpeak
              ? 'Answered here. The presentation keeps going.'
              : 'The presenter finishes this slide, then answers out loud.'}
        </p>

        <div className="flex items-end gap-1.5">
          <textarea
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void submit()
              }
            }}
            rows={2}
            maxLength={500}
            placeholder="Type your question…"
            className="flex-1 resize-none rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800"
          />
          <button
            onClick={() => void submit()}
            disabled={sending || question.trim().length < 3}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-indigo-600 text-white disabled:opacity-40"
            aria-label="Send"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
      )}
    </aside>
  )
}
