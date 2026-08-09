"use client"

/**
 * The owner's Q&A inbox, as a tab in the notes panel under the slide canvas.
 *
 * It lives HERE and not in the publish dialog on purpose. Every defer tells the
 * asker "their answer appears here", and that promise is only kept if answering
 * is somewhere the publisher already is. The publish dialog is a small modal
 * that already carries visibility, passcode, downloads, Q&A settings and source
 * permissions; burying a working queue behind it means reopening a crowded
 * modal to do the one task the feature exists for. The notes panel is wide,
 * persistent, and one click from the deck.
 *
 * Three actions, deliberately no more:
 *   - **Answer** — the reply reaches the asker's follow-up link.
 *   - **Publish to FAQ** — future askers get it with no model call at all.
 *   - **Block** — for the caller who is probing rather than asking.
 *
 * The one thing this must never do is put words in the publisher's mouth. The
 * machine's draft is shown as a draft, clearly labelled, and promoting it sends
 * the text back to the server as the act of approval.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Ban,
  Check,
  Clock,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

interface DeckQuestion {
  id: string
  question: string
  status: string
  gateReason: string | null
  aiAnswer: string | null
  askerName: string | null
  askerEmail: string | null
  ownerAnswer: string | null
  ownerAnsweredAt: string | null
  createdAt: string
}

interface InboxResponse {
  questions: DeckQuestion[]
  nextCursor: string | null
  unansweredCount: number
  qaEnabled: boolean
  corpusStatus: string
}

/** Why the machine stood down, in the owner's vocabulary rather than the gate's. */
const GATE_LABELS: Record<string, string> = {
  no_evidence: 'Not in the material',
  low_confidence: 'Not confident enough',
  unverified_claim: "Couldn't verify it",
  policy: 'Needs you personally',
  not_ready: 'Corpus was still building',
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

/**
 * One question, and whatever the owner can do about it.
 *
 * Answered-by-the-machine and deferred questions look deliberately different:
 * a defer is work waiting, an answered one is a record. Both can be promoted to
 * the FAQ, which is the only action that attaches the publisher's name to text.
 */
function QuestionRow({
  item,
  slug,
  onChanged,
}: {
  item: DeckQuestion
  slug: string
  onChanged: (next?: DeckQuestion) => void
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(item.ownerAnswer ?? '')
  const [busy, setBusy] = useState<string | null>(null)

  const isDeferred = item.status === 'deferred'
  const isBlocked = item.status === 'blocked'
  const answered = Boolean(item.ownerAnswer)

  const call = useCallback(
    async (action: string, path: string, body: unknown, ok: string) => {
      setBusy(action)
      try {
        const response = await fetch(`/api/publish/${slug}/questions/${item.id}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || 'That did not go through')
        toast({ title: ok })
        onChanged(data.question as DeckQuestion | undefined)
        return true
      } catch (error) {
        toast({
          title: error instanceof Error ? error.message : 'That did not go through',
          variant: 'destructive',
        })
        return false
      } finally {
        setBusy(null)
      }
    },
    [item.id, onChanged, slug, toast]
  )

  const sendAnswer = useCallback(async () => {
    const text = draft.trim()
    if (!text) return
    const sent = await call('answer', '/answer', { answerText: text }, 'Answer sent')
    if (sent) setOpen(false)
  }, [call, draft])

  // Promoting a MACHINE draft sends the text back deliberately: that round trip
  // IS the approval, and it is what lets the publisher's byline attach to words
  // they actually submitted rather than words a form claims they saw.
  const promote = useCallback(() => {
    const text = (item.ownerAnswer ?? draft ?? item.aiAnswer ?? '').trim()
    if (!text) {
      toast({ title: 'Write an answer first', variant: 'destructive' })
      return
    }
    void call('promote', '/promote', { answer: text }, 'Published to the FAQ')
  }, [call, draft, item.aiAnswer, item.ownerAnswer, toast])

  return (
    <div className="rounded-md border border-gray-200 px-3 py-2 dark:border-slate-700">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{item.question}</p>
        <span className="flex-shrink-0 whitespace-nowrap text-[11px] text-slate-400">
          {relativeTime(item.createdAt)}
        </span>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
        {answered ? (
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <Check className="h-3 w-3" /> You answered
          </span>
        ) : isBlocked ? (
          <span className="inline-flex items-center gap-1 text-slate-400">
            <Ban className="h-3 w-3" /> Blocked
          </span>
        ) : isDeferred ? (
          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <Clock className="h-3 w-3" /> Waiting on you
            {item.gateReason ? ` — ${GATE_LABELS[item.gateReason] ?? item.gateReason}` : ''}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Answered automatically
          </span>
        )}
        {item.askerName && <span>· from {item.askerName}</span>}
        {/* The email is shown but never mailed from here — see the panel note. */}
        {item.askerEmail && <span>· {item.askerEmail}</span>}
      </div>

      {/* The machine's text is labelled as a DRAFT wherever the owner has not
          answered, so nothing reads as the publisher speaking until they say so. */}
      {item.aiAnswer && !answered && (
        <p className="mt-1.5 border-l-2 border-slate-200 pl-2 text-xs italic text-slate-500 dark:border-slate-600 dark:text-slate-400">
          {item.aiAnswer}
        </p>
      )}
      {answered && (
        <p className="mt-1.5 border-l-2 border-emerald-300 pl-2 text-xs text-slate-600 dark:border-emerald-700 dark:text-slate-300">
          {item.ownerAnswer}
        </p>
      )}

      {open && (
        <div className="mt-2 space-y-1.5">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Your answer — this is what the asker sees, in your name…"
            className="min-h-[70px] resize-none text-sm"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={sendAnswer} disabled={busy !== null || !draft.trim()}>
              {busy === 'answer' ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Send className="mr-1 h-3 w-3" />
              )}
              Send
            </Button>
            {item.aiAnswer && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDraft(item.aiAnswer ?? '')}
                disabled={busy !== null}
              >
                Start from the draft
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={busy !== null}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {!open && !isBlocked && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={() => setOpen(true)} disabled={busy !== null}>
            {answered ? 'Edit answer' : 'Answer'}
          </Button>
          <Button size="sm" variant="ghost" onClick={promote} disabled={busy !== null}>
            {busy === 'promote' ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : null}
            Publish to FAQ
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-slate-400 hover:text-red-600"
            onClick={() => void call('block', '/block', {}, 'Blocked')}
            disabled={busy !== null}
          >
            {busy === 'block' ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
            Block
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * The inbox itself. Resolves the deck from the session, then reads the queue.
 *
 * `onUnansweredChange` drives the tab badge — the panel needs the count even
 * when the tab is not open, which is the whole point of a badge.
 */
export function DeckQaInbox({
  sessionId,
  onUnansweredChange,
}: {
  sessionId: string | null
  onUnansweredChange?: (count: number) => void
}) {
  const [slug, setSlug] = useState<string | null>(null)
  const [state, setState] = useState<InboxResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Read in an effect but never rendered — a ref, so changing it cannot loop.
  const notify = useRef(onUnansweredChange)
  notify.current = onUnansweredChange

  const load = useCallback(async () => {
    if (!sessionId) {
      setLoading(false)
      return
    }
    setError(null)
    try {
      const deckResponse = await fetch(`/api/publish/by-session/${sessionId}`)
      const deckData = await deckResponse.json().catch(() => ({}))
      const record = deckData?.deck ?? deckData?.publishedDeck ?? null
      if (!deckResponse.ok || !record?.slug) {
        setSlug(null)
        setState(null)
        notify.current?.(0)
        return
      }
      setSlug(record.slug)

      const response = await fetch(`/api/publish/${record.slug}/questions`)
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not load questions')
      setState(data as InboxResponse)
      notify.current?.((data as InboxResponse).unansweredCount ?? 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load questions')
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  const questions = state?.questions ?? []
  const waiting = useMemo(
    () => questions.filter((q) => !q.ownerAnswer && q.status !== 'blocked').length,
    [questions]
  )

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-slate-400">
        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Loading questions…
      </div>
    )
  }

  if (!slug) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-xs text-slate-400">
        <MessageSquare className="h-4 w-4" />
        <p>Publish this deck to start collecting questions from viewers.</p>
      </div>
    )
  }

  if (state && !state.qaEnabled) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-xs text-slate-400">
        <MessageSquare className="h-4 w-4" />
        <p>Q&amp;A is off for this deck. Turn it on under Publish → Q&amp;A.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-shrink-0 items-center justify-between pb-1.5 text-[11px] text-slate-500 dark:text-slate-400">
        <span>
          {waiting > 0
            ? `${waiting} waiting on you`
            : questions.length > 0
              ? 'Nothing waiting'
              : 'No questions yet'}
        </span>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>

      {error && <p className="pb-1.5 text-xs text-amber-600 dark:text-amber-400">{error}</p>}

      <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
        {questions.length === 0 && !error && (
          <p className="pt-6 text-center text-xs text-slate-400">
            Questions your viewers ask will appear here.
          </p>
        )}
        {questions.map((item) => (
          <QuestionRow key={item.id} item={item} slug={slug} onChanged={() => void load()} />
        ))}
      </div>
    </div>
  )
}
