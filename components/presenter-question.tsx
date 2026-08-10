"use client"

/**
 * Raising a hand during a narrated deck.
 *
 * The whole mechanism rests on one property: **the mic and the question box are
 * only ever opened during a pause the system invited.** A deck that could accept
 * a question at any moment would have to interrupt itself mid-sentence to
 * answer, and a page that could listen whenever it liked is a very different
 * thing to put behind a public link.
 *
 * So the sequence is fixed: raise hand → the run finishes the slide it is on →
 * it pauses and invites the question → the answer arrives → narration resumes
 * from the next slide.
 *
 * Waiting for the slide to end rather than cutting the audio is what makes this
 * feel like a presenter taking a question rather than a machine being
 * interrupted. It costs a few seconds and buys the entire impression.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Clock, Hand, Loader2, Send, X } from 'lucide-react'
import { rememberThread } from '@/lib/publish/qa-threads'

export type HandState = 'down' | 'raised' | 'asking' | 'answering' | 'answered'

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
}

interface Props {
  slug: string
  state: HandState
  /** Set when the question box is open but the run has not paused yet. */
  pendingUntilSlideEnds: boolean
  onRaise: () => void
  onCancel: () => void
  onAsked: (asked: AskedQuestion) => void
  /** Whether this deck's voice is fast enough to answer out loud. */
  speaksAnswers?: boolean
  onResume: () => void
  /** Told to the presenter so it cannot resume narration over a reply that is
   *  still being spoken — the failure this whole change exists to fix. */
  onSpeakingChange?: (speaking: boolean) => void
  asked: AskedQuestion | null
  onCiteSlide: (slideNumber: number) => void
}

export function PresenterQuestion({
  slug,
  state,
  speaksAnswers,
  onSpeakingChange,
  pendingUntilSlideEnds,
  onRaise,
  onCancel,
  onAsked,
  onResume,
  asked,
  onCiteSlide,
}: Props) {
  const [question, setQuestion] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const spokenFor = useRef<string | null>(null)
  const answerAudio = useRef<HTMLAudioElement | null>(null)
  const [speaking, setSpeaking] = useState(false)

  const stopSpeaking = useCallback(() => {
    answerAudio.current?.pause()
    answerAudio.current = null
    setSpeaking(false)
    onSpeakingChange?.(false)
  }, [onSpeakingChange])

  useEffect(() => () => { answerAudio.current?.pause() }, [])

  /**
   * Say the answer out loud.
   *
   * Only for voices measured fast enough to start inside the live-answer
   * threshold — and always AFTER the text is on screen, never instead of it.
   * A spoken answer cannot be re-read or verified against a citation; the text
   * and the chips are the record, the audio is the delivery.
   */
  useEffect(() => {
    if (!speaksAnswers || !asked?.questionId || !asked.answer) return
    if (spokenFor.current === asked.questionId) return
    spokenFor.current = asked.questionId
    setSpeaking(true)
    onSpeakingChange?.(true)
    void (async () => {
      try {
        const response = await fetch('/api/narration/speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, kind: 'answer', questionId: asked.questionId }),
        })
        if (!response.ok) {
          setSpeaking(false)
          onSpeakingChange?.(false)
          return
        }
        const element = new Audio(URL.createObjectURL(await response.blob()))
        answerAudio.current = element
        const done = () => {
          setSpeaking(false)
          onSpeakingChange?.(false)
        }
        element.addEventListener('ended', done)
        element.addEventListener('error', done)
        void element.play().catch(done)
      } catch {
        // The written answer is already on screen — audio is additive, and its
        // failure must not leave the deck believing it is still talking.
        setSpeaking(false)
        onSpeakingChange?.(false)
      }
    })()
  }, [asked, speaksAnswers, slug, onSpeakingChange])

  const submit = useCallback(async () => {
    const text = question.trim()
    if (text.length < 3) return
    setSending(true)
    setError(null)
    try {
      // The same endpoint the written panel uses. Every gate, every citation
      // rule and every spend control already lives there — a second path would
      // be a second place for them to drift out of agreement.
      const response = await fetch(`/api/publish/${slug}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.error || 'That question could not be sent.')
      // Recorded in the SAME browser-side thread list the written panel reads.
      // A question asked mid-presentation is still a question this person asked
      // of this deck — it belongs in the record, not only in the overlay that
      // disappears when the run ends. It is also the only route back to the
      // owner's eventual reply on a deferred one.
      if (data?.followUp?.token) {
        rememberThread(slug, {
          token: data.followUp.token,
          questionId: data.followUp.questionId,
          askedAt: new Date().toISOString(),
        })
      }
      onAsked({
        question: text,
        questionId:
          typeof data?.followUp?.questionId === 'string' ? data.followUp.questionId : null,
        answer: typeof data.answer === 'string' ? data.answer : null,
        deferred: data.status === 'deferred',
        deferMessage: typeof data.message === 'string' ? data.message : null,
        citations: Array.isArray(data.citations) ? data.citations : [],
        provenanceLine: data.provenanceLine ?? null,
      })
      setQuestion('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That question could not be sent.')
    } finally {
      setSending(false)
    }
  }, [question, slug, onAsked])

  if (state === 'down') {
    return (
      <button
        onClick={onRaise}
        className="flex h-9 items-center gap-1.5 rounded-full bg-white/15 px-3 text-sm text-white transition-colors hover:bg-white/25"
        title="Ask a question — the deck will pause at the end of this slide"
      >
        <Hand className="h-4 w-4" />
        <span className="hidden sm:inline">Raise hand</span>
      </button>
    )
  }

  return (
    <div className="pointer-events-auto w-full max-w-2xl rounded-lg bg-white/95 p-4 text-slate-900 shadow-2xl backdrop-blur dark:bg-slate-900/95 dark:text-slate-100">
      {/* The invited pause is stated, not implied. An audience that does not
          know the deck is waiting for them will not speak. */}
      {pendingUntilSlideEnds && (
        <p className="mb-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Clock className="h-3 w-3" />
          Finishing this slide, then I&apos;ll take your question.
        </p>
      )}

      {state !== 'answered' && (
        <>
          <div className="flex items-start gap-2">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void submit()
                }
              }}
              autoFocus
              rows={2}
              maxLength={500}
              placeholder="What would you like to ask?"
              className="flex-1 resize-none rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800"
            />
            <button
              onClick={() => void submit()}
              disabled={sending || question.trim().length < 3}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-indigo-600 text-white disabled:opacity-40"
              aria-label="Send the question"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={onCancel}
              disabled={sending}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              aria-label="Never mind"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
        </>
      )}

      {state === 'answered' && asked && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">You asked</p>
          <p className="text-sm font-medium">{asked.question}</p>

          {asked.answer ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{asked.answer}</p>
          ) : (
            <p className="flex items-start gap-1.5 text-sm text-slate-600 dark:text-slate-300">
              <Clock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
              <span>{asked.deferMessage ?? 'That one needs a person — it has been passed on.'}</span>
            </p>
          )}

          {/* Citations stay clickable even mid-presentation: a spoken answer
              cannot be verified, a chip can. */}
          {asked.citations.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {asked.citations.map((citation, i) => (
                <button
                  key={`${citation.label}-${i}`}
                  onClick={() =>
                    citation.slideNumber ? onCiteSlide(citation.slideNumber) : undefined
                  }
                  disabled={!citation.slideNumber}
                  className="rounded-md bg-indigo-50 px-2 py-1 text-xs text-indigo-700 disabled:cursor-default dark:bg-indigo-950 dark:text-indigo-300"
                >
                  {citation.label}
                </button>
              ))}
            </div>
          )}
          {asked.provenanceLine && (
            <p className="text-xs italic text-slate-500 dark:text-slate-400">
              {asked.provenanceLine}
            </p>
          )}

          {/* Resuming while the reply is still being spoken is what put two
              voices on top of each other. The control says what it is waiting
              for, and offers a way past it rather than trapping anyone. */}
          <div className="mt-1 flex items-center gap-2">
            <button
              onClick={() => {
                stopSpeaking()
                onResume()
              }}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white"
            >
              {speaking ? 'Skip and carry on' : 'Carry on'}
            </button>
            {speaking && (
              <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                Answering…
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
